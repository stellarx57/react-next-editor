import type { MarkSpec } from 'prosemirror-model';
import { sanitizeUrl } from '../../security/sanitize';
import { cssFontFamily, cssNumber, normalizeCssColor } from '../../security/css';

/**
 * Mark specifications. Each is a self-contained {@link MarkSpec} with parse and
 * serialize rules. Marks that carry style (font, size, colors) are attribute
 * marks; their `toDOM` emits inline styles only — never active content — and
 * their `parseDOM` reads from the corresponding CSS property so pasted content
 * round-trips (F-4.2, F-11.4).
 */

export const strong: MarkSpec = {
  parseDOM: [
    { tag: 'strong' },
    { tag: 'b', getAttrs: (node) => (node as HTMLElement).style.fontWeight !== 'normal' && null },
    { style: 'font-weight=400', clearMark: (m) => m.type.name === 'strong' },
    {
      style: 'font-weight',
      getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null,
    },
  ],
  toDOM() {
    return ['strong', 0];
  },
};

export const em: MarkSpec = {
  parseDOM: [
    { tag: 'i' },
    { tag: 'em' },
    { style: 'font-style=italic' },
    { style: 'font-style=normal', clearMark: (m) => m.type.name === 'em' },
  ],
  toDOM() {
    return ['em', 0];
  },
};

export const underline: MarkSpec = {
  parseDOM: [
    { tag: 'u' },
    {
      style: 'text-decoration',
      getAttrs: (value) => (value as string).includes('underline') && null,
    },
    {
      style: 'text-decoration-line',
      getAttrs: (value) => (value as string).includes('underline') && null,
    },
  ],
  toDOM() {
    return ['u', 0];
  },
};

export const strikethrough: MarkSpec = {
  parseDOM: [
    { tag: 's' },
    { tag: 'del' },
    { tag: 'strike' },
    {
      style: 'text-decoration',
      getAttrs: (value) => (value as string).includes('line-through') && null,
    },
  ],
  toDOM() {
    return ['s', 0];
  },
};

export const superscript: MarkSpec = {
  excludes: 'subscript',
  parseDOM: [{ tag: 'sup' }, { style: 'vertical-align=super' }],
  toDOM() {
    return ['sup', 0];
  },
};

export const subscript: MarkSpec = {
  excludes: 'superscript',
  parseDOM: [{ tag: 'sub' }, { style: 'vertical-align=sub' }],
  toDOM() {
    return ['sub', 0];
  },
};

export const code: MarkSpec = {
  parseDOM: [{ tag: 'code' }],
  toDOM() {
    return ['code', { class: 'rne-inline-code' }, 0];
  },
};

export const link: MarkSpec = {
  attrs: {
    href: {},
    title: { default: null },
    target: { default: '_blank' },
  },
  inclusive: false,
  parseDOM: [
    {
      tag: 'a[href]',
      getAttrs(dom) {
        const el = dom as HTMLElement;
        const rawHref = el.getAttribute('href');
        const href = sanitizeUrl(rawHref);
        // Drop the link entirely if the URL is unsafe (e.g. javascript:).
        if (!href) return false;
        return {
          href,
          title: el.getAttribute('title'),
          target: el.getAttribute('target') ?? '_blank',
        };
      },
    },
  ],
  toDOM(mark) {
    const href = sanitizeUrl(mark.attrs.href as string) ?? '';
    const target = (mark.attrs.target as string) || '_blank';
    return [
      'a',
      {
        href,
        title: (mark.attrs.title as string) ?? null,
        target,
        rel: 'noopener noreferrer nofollow',
      },
      0,
    ];
  },
};

export const fontFamily: MarkSpec = {
  attrs: { family: {} },
  parseDOM: [
    {
      style: 'font-family',
      getAttrs: (value) => {
        const family = cssFontFamily(value);
        return family ? { family } : false;
      },
    },
  ],
  toDOM(mark) {
    const family = cssFontFamily(mark.attrs.family);
    return family ? ['span', { style: `font-family: ${family}` }, 0] : ['span', 0];
  },
};

export const fontSize: MarkSpec = {
  attrs: { size: {} },
  parseDOM: [
    {
      style: 'font-size',
      getAttrs: (value) => {
        const size = parseFontSize(value as string);
        return size ? { size } : false;
      },
    },
  ],
  toDOM(mark) {
    const size = cssNumber(mark.attrs.size, 1, 1638);
    return size ? ['span', { style: `font-size: ${size}pt` }, 0] : ['span', 0];
  },
};

export const textColor: MarkSpec = {
  attrs: { color: {} },
  parseDOM: [
    {
      style: 'color',
      getAttrs: (value) => {
        const color = normalizeCssColor(value);
        return color ? { color } : false;
      },
    },
  ],
  toDOM(mark) {
    const color = normalizeCssColor(mark.attrs.color);
    return color ? ['span', { style: `color: ${color}` }, 0] : ['span', 0];
  },
};

export const highlight: MarkSpec = {
  attrs: { color: { default: '#fff2a8' } },
  parseDOM: [
    { tag: 'mark' },
    {
      style: 'background-color',
      getAttrs: (value) => {
        const color = normalizeCssColor(value);
        return color ? { color } : false;
      },
    },
  ],
  toDOM(mark) {
    const color = normalizeCssColor(mark.attrs.color) ?? '#fff2a8';
    return ['mark', { style: `background-color: ${color}` }, 0];
  },
};

/** Parse a CSS font-size (pt/px) into a clamped point value, or null. */
function parseFontSize(value: string): number | null {
  const match = /(\d+(?:\.\d+)?)\s*(pt|px)?/.exec(value);
  if (!match) return null;
  const num = parseFloat(match[1]!);
  if (!Number.isFinite(num) || num <= 0) return null;
  // 1px ≈ 0.75pt
  const pt = (match[2] ?? 'pt') === 'px' ? num * 0.75 : num;
  return cssNumber(Math.round(pt * 100) / 100, 1, 1638);
}
