import type { MarkSpec } from 'prosemirror-model';
import { sanitizeUrl } from '../../security/sanitize';

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
        const family = (value as string).replace(/["']/g, '').trim();
        return family ? { family } : false;
      },
    },
  ],
  toDOM(mark) {
    return ['span', { style: `font-family: ${cssSafe(mark.attrs.family as string)}` }, 0];
  },
};

export const fontSize: MarkSpec = {
  attrs: { size: {} },
  parseDOM: [
    {
      style: 'font-size',
      getAttrs: (value) => {
        const size = parseSize(value as string);
        return size ? { size } : false;
      },
    },
  ],
  toDOM(mark) {
    return ['span', { style: `font-size: ${cssSafe(String(mark.attrs.size))}pt` }, 0];
  },
};

export const textColor: MarkSpec = {
  attrs: { color: {} },
  parseDOM: [
    {
      style: 'color',
      getAttrs: (value) => {
        const color = normalizeColor(value as string);
        return color ? { color } : false;
      },
    },
  ],
  toDOM(mark) {
    return ['span', { style: `color: ${cssSafe(mark.attrs.color as string)}` }, 0];
  },
};

export const highlight: MarkSpec = {
  attrs: { color: { default: '#fff2a8' } },
  parseDOM: [
    { tag: 'mark' },
    {
      style: 'background-color',
      getAttrs: (value) => {
        const color = normalizeColor(value as string);
        return color ? { color } : false;
      },
    },
  ],
  toDOM(mark) {
    return ['mark', { style: `background-color: ${cssSafe(mark.attrs.color as string)}` }, 0];
  },
};

/** Escape a CSS value so it cannot terminate the declaration or inject more. */
function cssSafe(value: string): string {
  return String(value).replace(/[;{}<>"']/g, '');
}

/** Parse a CSS font-size into a point value, accepting pt/px units. */
function parseSize(value: string): number | null {
  const match = /(\d+(?:\.\d+)?)\s*(pt|px)?/.exec(value);
  if (!match) return null;
  const num = parseFloat(match[1]!);
  if (!Number.isFinite(num) || num <= 0 || num > 1638) return null;
  const unit = match[2] ?? 'pt';
  // 1px ≈ 0.75pt
  const pt = unit === 'px' ? num * 0.75 : num;
  return Math.round(pt * 100) / 100;
}

/** Validate and normalize a CSS color, rejecting anything with injection risk. */
function normalizeColor(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$|^#[0-9a-f]{4}$|^#[0-9a-f]{6}$|^#[0-9a-f]{8}$/.test(v)) return v;
  if (/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/.test(v)) return v;
  if (/^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/.test(v)) return v;
  if (/^[a-z]{3,20}$/.test(v)) return v; // named colors
  return null;
}
