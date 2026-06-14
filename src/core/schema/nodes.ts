import type { Node as PMNode, NodeSpec } from 'prosemirror-model';
import { sanitizeImageSrc } from '../../security/sanitize';
import { blockAttrs, blockDOMAttrs, readBlockAttrs } from './attrs';

/**
 * Node specifications. Each is a self-contained {@link NodeSpec}. The schema is
 * assembled from these by {@link buildSchema} according to the enabled feature
 * flags, so disabling a feature removes its node entirely and the document can
 * never contain it (F-10.2, F-11.5).
 */

export const doc: NodeSpec = { content: 'block+' };

export const text: NodeSpec = { group: 'inline' };

export const paragraph: NodeSpec = {
  group: 'block',
  content: 'inline*',
  attrs: { ...blockAttrs },
  parseDOM: [{ tag: 'p', getAttrs: (dom) => readBlockAttrs(dom as HTMLElement) }],
  toDOM(node) {
    return ['p', blockDOMAttrs(node), 0];
  },
};

export const heading: NodeSpec = {
  group: 'block',
  content: 'inline*',
  defining: true,
  attrs: { level: { default: 1 }, ...blockAttrs },
  parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
    tag: `h${level}`,
    getAttrs: (dom: string | HTMLElement) => ({
      level,
      ...readBlockAttrs(dom as HTMLElement),
    }),
  })),
  toDOM(node) {
    const level = (node.attrs.level as number) || 1;
    return [`h${Math.min(6, Math.max(1, level))}`, blockDOMAttrs(node), 0];
  },
};

export const blockquote: NodeSpec = {
  group: 'block',
  content: 'block+',
  defining: true,
  parseDOM: [{ tag: 'blockquote' }],
  toDOM() {
    return ['blockquote', { class: 'rne-blockquote' }, 0];
  },
};

export const horizontal_rule: NodeSpec = {
  group: 'block',
  parseDOM: [{ tag: 'hr' }],
  toDOM() {
    return ['hr', { class: 'rne-hr' }];
  },
};

/** Custom manual page break (F-3.5). An atom that renders as a non-editable break. */
export const page_break: NodeSpec = {
  group: 'block',
  atom: true,
  selectable: true,
  parseDOM: [{ tag: 'div[data-page-break]' }, { tag: 'div.rne-page-break' }],
  toDOM() {
    return [
      'div',
      { 'data-page-break': 'true', class: 'rne-page-break', contenteditable: 'false' },
    ];
  },
};

export const hard_break: NodeSpec = {
  inline: true,
  group: 'inline',
  selectable: false,
  parseDOM: [{ tag: 'br' }],
  toDOM() {
    return ['br'];
  },
};

const MAX_IMAGE_WIDTH = 2000;

export const image: NodeSpec = {
  inline: true,
  group: 'inline',
  draggable: true,
  attrs: {
    src: {},
    alt: { default: null },
    title: { default: null },
    width: { default: null },
  },
  parseDOM: [
    {
      tag: 'img[src]',
      getAttrs(dom) {
        const el = dom as HTMLElement;
        const src = sanitizeImageSrc(el.getAttribute('src'));
        if (!src) return false;
        const widthAttr = el.getAttribute('width') ?? el.style.width;
        let width: number | null = null;
        if (widthAttr) {
          const num = parseInt(widthAttr, 10);
          if (Number.isFinite(num) && num > 0) width = Math.min(MAX_IMAGE_WIDTH, num);
        }
        return {
          src,
          alt: el.getAttribute('alt'),
          title: el.getAttribute('title'),
          width,
        };
      },
    },
  ],
  toDOM(node) {
    const { src, alt, title, width } = node.attrs as {
      src: string;
      alt: string | null;
      title: string | null;
      width: number | null;
    };
    const safeSrc = sanitizeImageSrc(src) ?? '';
    const attrs: Record<string, string> = { src: safeSrc, class: 'rne-image' };
    if (alt) attrs.alt = alt;
    if (title) attrs.title = title;
    if (width) attrs.style = `width: ${width}px`;
    return ['img', attrs];
  },
};

/** List item, with an optional `checked` attribute powering task lists (F-2.8). */
export const list_item: NodeSpec = {
  content: 'paragraph block*',
  defining: true,
  attrs: { checked: { default: null } },
  parseDOM: [
    {
      tag: 'li',
      getAttrs(dom) {
        const el = dom as HTMLElement;
        const dc = el.getAttribute('data-checked');
        if (dc === 'true') return { checked: true };
        if (dc === 'false') return { checked: false };
        return { checked: null };
      },
    },
  ],
  toDOM(node) {
    const checked = node.attrs.checked as boolean | null;
    if (checked === null) return ['li', 0];
    return [
      'li',
      { 'data-checked': String(checked), class: 'rne-task-item' },
      ['span', { class: 'rne-task-checkbox', contenteditable: 'false' }],
      ['div', { class: 'rne-task-content' }, 0],
    ];
  },
};

export const bullet_list: NodeSpec = {
  group: 'block',
  content: 'list_item+',
  attrs: { kind: { default: 'bullet' } },
  parseDOM: [
    {
      tag: 'ul',
      getAttrs(dom) {
        const el = dom as HTMLElement;
        const isTask =
          el.getAttribute('data-type') === 'task' ||
          el.classList.contains('rne-task-list') ||
          !!el.querySelector('li[data-checked]');
        return { kind: isTask ? 'task' : 'bullet' };
      },
    },
  ],
  toDOM(node) {
    const kind = node.attrs.kind as string;
    return kind === 'task'
      ? ['ul', { 'data-type': 'task', class: 'rne-task-list' }, 0]
      : ['ul', { class: 'rne-bullet-list' }, 0];
  },
};

export const ordered_list: NodeSpec = {
  group: 'block',
  content: 'list_item+',
  attrs: { order: { default: 1 } },
  parseDOM: [
    {
      tag: 'ol',
      getAttrs(dom) {
        const el = dom as HTMLElement;
        const start = el.getAttribute('start');
        const order = start ? parseInt(start, 10) : 1;
        return { order: Number.isFinite(order) && order > 0 ? order : 1 };
      },
    },
  ],
  toDOM(node) {
    const order = (node.attrs.order as number) || 1;
    return order === 1
      ? ['ol', { class: 'rne-ordered-list' }, 0]
      : ['ol', { order, start: order, class: 'rne-ordered-list' }, 0];
  },
};

/** Return the text alignment attribute of a block node, if any. */
export function nodeAlign(node: PMNode): string | null {
  return (node.attrs?.align as string) ?? null;
}
