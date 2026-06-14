import type { DocumentJSON } from '../config/types';

/**
 * Options governing plain-text conversion (F-6.20). Defaults follow the
 * documented structure rules: blocks separated by blank lines, list items on
 * their own lines, table cells tab-delimited, images replaced by alt text,
 * links rendered as their text.
 */
export interface TextConversionOptions {
  /** Append the URL after link text as " (url)". Default false. */
  includeLinkUrls?: boolean;
  /** Replacement for images: 'alt' uses alt text, 'omit' drops them. Default 'alt'. */
  images?: 'alt' | 'omit';
  /** Newline sequence. Default '\n'. */
  newline?: string;
}

interface ResolvedOptions {
  includeLinkUrls: boolean;
  images: 'alt' | 'omit';
  newline: string;
}

/**
 * Convert a ProseMirror document (JSON) to plain text (F-6.18). Pure and
 * isomorphic: identical output in the browser and on the server (F-6.19).
 */
export function documentToText(doc: DocumentJSON, options: TextConversionOptions = {}): string {
  const opts: ResolvedOptions = {
    includeLinkUrls: options.includeLinkUrls ?? false,
    images: options.images ?? 'alt',
    newline: options.newline ?? '\n',
  };
  const blocks = (doc.content ?? []).map((node) => serializeBlock(node, opts, 0));
  return blocks
    .filter((b) => b !== null)
    .join(opts.newline + opts.newline)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function serializeBlock(node: DocumentJSON, opts: ResolvedOptions, depth: number): string | null {
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return serializeInline(node.content ?? [], opts);
    case 'blockquote':
      return (node.content ?? [])
        .map((child) => serializeBlock(child, opts, depth))
        .filter((b) => b !== null)
        .map((line) => `> ${line}`)
        .join(opts.newline);
    case 'bullet_list':
    case 'ordered_list':
      return serializeList(node, opts, depth);
    case 'horizontal_rule':
      return '---';
    case 'page_break':
      return '\f';
    case 'table':
      return serializeTable(node, opts);
    default:
      // Unknown block: best-effort recurse so custom nodes still contribute text.
      if (node.content) {
        return node.content
          .map((child) => serializeBlock(child, opts, depth))
          .filter((b) => b !== null)
          .join(opts.newline);
      }
      return node.text ?? null;
  }
}

function serializeList(node: DocumentJSON, opts: ResolvedOptions, depth: number): string {
  const ordered = node.type === 'ordered_list';
  const start = ordered ? Number(node.attrs?.order ?? 1) : 0;
  const indent = '  '.repeat(depth);
  const lines: string[] = [];
  let index = start;

  for (const item of node.content ?? []) {
    if (item.type !== 'list_item') continue;
    const checked = item.attrs?.checked;
    let marker: string;
    if (checked === true) marker = '[x]';
    else if (checked === false) marker = '[ ]';
    else if (ordered) marker = `${index}.`;
    else marker = '-';

    const children = item.content ?? [];
    const firstBlock = children[0];
    const firstText = firstBlock ? (serializeBlock(firstBlock, opts, depth) ?? '') : '';
    lines.push(`${indent}${marker} ${firstText}`.trimEnd());

    for (let i = 1; i < children.length; i++) {
      const child = children[i]!;
      if (child.type === 'bullet_list' || child.type === 'ordered_list') {
        lines.push(serializeList(child, opts, depth + 1));
      } else {
        const text = serializeBlock(child, opts, depth + 1);
        if (text) lines.push(`${indent}  ${text}`);
      }
    }
    if (ordered) index++;
  }
  return lines.join(opts.newline);
}

function serializeTable(node: DocumentJSON, opts: ResolvedOptions): string {
  const rows: string[] = [];
  for (const row of node.content ?? []) {
    if (row.type !== 'table_row') continue;
    const cells = (row.content ?? []).map((cell) =>
      (cell.content ?? [])
        .map((block) => serializeBlock(block, opts, 0))
        .filter((b) => b !== null)
        .join(' ')
        .replace(/\t/g, ' '),
    );
    rows.push(cells.join('\t'));
  }
  return rows.join(opts.newline);
}

function serializeInline(content: DocumentJSON[], opts: ResolvedOptions): string {
  let out = '';
  for (const node of content) {
    if (node.type === 'text') {
      let text = node.text ?? '';
      if (opts.includeLinkUrls && node.marks) {
        const link = node.marks.find((m) => m.type === 'link');
        if (link?.attrs?.href) text = `${text} (${String(link.attrs.href)})`;
      }
      out += text;
    } else if (node.type === 'hard_break') {
      out += opts.newline;
    } else if (node.type === 'image') {
      if (opts.images === 'alt') {
        const alt = node.attrs?.alt;
        if (alt) out += String(alt);
      }
    } else if (node.content) {
      out += serializeInline(node.content, opts);
    }
  }
  return out;
}
