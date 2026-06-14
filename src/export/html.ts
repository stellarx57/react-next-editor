import type { DocumentJSON, PageConfig } from '../config/types';
import { sanitizeImageSrc, sanitizeUrl } from '../security/sanitize';
import { cssAlign, cssFontFamily, cssInteger, cssNumber, normalizeCssColor } from '../security/css';
import { resolvePageDimensions } from '../config/defaults';

/** Escape text for safe inclusion in HTML element content. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape a value for inclusion in a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

/** Order in which inline marks are nested (outermost first). */
const MARK_ORDER = [
  'link',
  'textColor',
  'highlight',
  'fontFamily',
  'fontSize',
  'strong',
  'em',
  'underline',
  'strikethrough',
  'superscript',
  'subscript',
  'code',
];

interface MarkJSON {
  type: string;
  attrs?: Record<string, unknown>;
}

function openMark(mark: MarkJSON): string {
  const attrs = mark.attrs ?? {};
  switch (mark.type) {
    case 'strong':
      return '<strong>';
    case 'em':
      return '<em>';
    case 'underline':
      return '<u>';
    case 'strikethrough':
      return '<s>';
    case 'superscript':
      return '<sup>';
    case 'subscript':
      return '<sub>';
    case 'code':
      return '<code>';
    case 'link': {
      const href = sanitizeUrl(String(attrs.href ?? '')) ?? '';
      const title = attrs.title ? ` title="${escapeAttr(String(attrs.title))}"` : '';
      return `<a href="${escapeAttr(href)}"${title} rel="noopener noreferrer nofollow">`;
    }
    case 'fontFamily': {
      const family = cssFontFamily(attrs.family);
      return family ? `<span style="font-family: ${family}">` : '<span>';
    }
    case 'fontSize': {
      const size = cssNumber(attrs.size, 1, 1638);
      return size ? `<span style="font-size: ${size}pt">` : '<span>';
    }
    case 'textColor': {
      const color = normalizeCssColor(attrs.color);
      return color ? `<span style="color: ${color}">` : '<span>';
    }
    case 'highlight': {
      const color = normalizeCssColor(attrs.color) ?? '#fff2a8';
      return `<mark style="background-color: ${color}">`;
    }
    default:
      return '';
  }
}

function closeMark(mark: MarkJSON): string {
  switch (mark.type) {
    case 'strong':
      return '</strong>';
    case 'em':
      return '</em>';
    case 'underline':
      return '</u>';
    case 'strikethrough':
      return '</s>';
    case 'superscript':
      return '</sup>';
    case 'subscript':
      return '</sub>';
    case 'code':
      return '</code>';
    case 'link':
      return '</a>';
    case 'fontFamily':
    case 'fontSize':
    case 'textColor':
      return '</span>';
    case 'highlight':
      return '</mark>';
    default:
      return '';
  }
}

function sortMarks(marks: MarkJSON[]): MarkJSON[] {
  return [...marks].sort((a, b) => {
    const ia = MARK_ORDER.indexOf(a.type);
    const ib = MARK_ORDER.indexOf(b.type);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

function serializeInline(content: DocumentJSON[] | undefined): string {
  if (!content) return '';
  let out = '';
  for (const node of content) {
    if (node.type === 'text') {
      const marks = sortMarks((node.marks ?? []) as MarkJSON[]);
      let text = escapeHtml(node.text ?? '');
      for (let i = marks.length - 1; i >= 0; i--) text = openMark(marks[i]!) + text;
      for (const mark of marks) text += closeMark(mark);
      out += text;
    } else if (node.type === 'hard_break') {
      out += '<br>';
    } else if (node.type === 'image') {
      out += serializeImage(node);
    }
  }
  return out;
}

function serializeImage(node: DocumentJSON): string {
  const src = sanitizeImageSrc(String(node.attrs?.src ?? ''));
  if (!src) return '';
  const alt = node.attrs?.alt ? ` alt="${escapeAttr(String(node.attrs.alt))}"` : ' alt=""';
  const title = node.attrs?.title ? ` title="${escapeAttr(String(node.attrs.title))}"` : '';
  const safeWidth = cssInteger(node.attrs?.width, 1, 4000);
  const width = safeWidth ? ` style="width: ${safeWidth}px"` : '';
  return `<img class="rne-image" src="${escapeAttr(src)}"${alt}${title}${width}>`;
}

function blockStyle(attrs: Record<string, unknown> | undefined): string {
  if (!attrs) return '';
  const styles: string[] = [];
  const align = cssAlign(attrs.align);
  if (align) styles.push(`text-align: ${align}`);
  const indent = cssInteger(attrs.indent, 0, 12);
  if (indent && indent > 0) styles.push(`margin-left: ${indent * 3}em`);
  const lineHeight = cssNumber(attrs.lineHeight, 0.1, 10);
  if (lineHeight) styles.push(`line-height: ${lineHeight}`);
  return styles.length ? ` style="${styles.join('; ')}"` : '';
}

function serializeBlock(node: DocumentJSON): string {
  switch (node.type) {
    case 'paragraph':
      return `<p${blockStyle(node.attrs)}>${serializeInline(node.content) || '<br>'}</p>`;
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      return `<h${level}${blockStyle(node.attrs)}>${serializeInline(node.content)}</h${level}>`;
    }
    case 'blockquote':
      return `<blockquote class="rne-blockquote">${(node.content ?? []).map(serializeBlock).join('')}</blockquote>`;
    case 'horizontal_rule':
      return '<hr class="rne-hr">';
    case 'page_break':
      return '<div class="rne-page-break"></div>';
    case 'bullet_list':
    case 'ordered_list':
      return serializeList(node);
    case 'table':
      return serializeTable(node);
    default:
      if (node.content) return node.content.map(serializeBlock).join('');
      return '';
  }
}

function serializeList(node: DocumentJSON): string {
  const ordered = node.type === 'ordered_list';
  const kind = node.attrs?.kind;
  const tag = ordered ? 'ol' : 'ul';
  const order = ordered ? Number(node.attrs?.order ?? 1) : 1;
  const startAttr = ordered && order !== 1 ? ` start="${order}"` : '';
  const classAttr = ordered
    ? ' class="rne-ordered-list"'
    : kind === 'task'
      ? ' class="rne-task-list" data-type="task"'
      : ' class="rne-bullet-list"';

  const items = (node.content ?? [])
    .map((item) => {
      if (item.type !== 'list_item') return '';
      const checked = item.attrs?.checked;
      const inner = (item.content ?? []).map(serializeBlock).join('');
      if (checked === true || checked === false) {
        const box = checked ? '☑' : '☐';
        return `<li class="rne-task-item" data-checked="${checked}"><span class="rne-task-checkbox">${box}</span><div class="rne-task-content">${inner}</div></li>`;
      }
      return `<li>${inner}</li>`;
    })
    .join('');
  return `<${tag}${classAttr}${startAttr}>${items}</${tag}>`;
}

function serializeTable(node: DocumentJSON): string {
  const rows = (node.content ?? [])
    .map((row) => {
      if (row.type !== 'table_row') return '';
      const cells = (row.content ?? [])
        .map((cell) => {
          const tag = cell.type === 'table_header' ? 'th' : 'td';
          const attrs = cell.attrs ?? {};
          const parts: string[] = [];
          const colspan = cssInteger(attrs.colspan, 1, 100);
          if (colspan && colspan > 1) parts.push(`colspan="${colspan}"`);
          const rowspan = cssInteger(attrs.rowspan, 1, 100);
          if (rowspan && rowspan > 1) parts.push(`rowspan="${rowspan}"`);
          const styles: string[] = [];
          const bg = normalizeCssColor(attrs.background);
          if (bg) styles.push(`background-color: ${bg}`);
          const cellAlign = cssAlign(attrs.align);
          if (cellAlign) styles.push(`text-align: ${cellAlign}`);
          if (styles.length) parts.push(`style="${styles.join('; ')}"`);
          const attrStr = parts.length ? ` ${parts.join(' ')}` : '';
          return `<${tag}${attrStr}>${(cell.content ?? []).map(serializeBlock).join('')}</${tag}>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table class="rne-table"><tbody>${rows}</tbody></table>`;
}

/** Serialize a document (JSON) to an HTML fragment (the document body content). */
export function documentToHtml(doc: DocumentJSON): string {
  return (doc.content ?? []).map(serializeBlock).join('\n');
}

/** Print-oriented stylesheet matching the on-screen document surface. */
export function printStylesheet(page: PageConfig): string {
  const { width, height } = resolvePageDimensions(page);
  const { top, right, bottom, left } = page.margins;
  return `
    @page { size: ${width}mm ${height}mm; margin: ${top}mm ${right}mm ${bottom}mm ${left}mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Georgia, serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #111;
    }
    .rne-print-page { width: ${width - left - right}mm; margin: 0 auto; }
    h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.25em; }
    h4 { font-size: 1.1em; } h5 { font-size: 1em; } h6 { font-size: 0.9em; }
    p { margin: 0 0 0.6em; }
    blockquote.rne-blockquote { border-left: 3px solid #ccc; margin: 0 0 0.6em; padding-left: 1em; color: #444; }
    hr.rne-hr { border: none; border-top: 1px solid #ccc; margin: 1em 0; }
    img.rne-image { max-width: 100%; height: auto; }
    table.rne-table { border-collapse: collapse; width: 100%; margin: 0 0 0.8em; }
    table.rne-table td, table.rne-table th { border: 1px solid #999; padding: 4px 8px; vertical-align: top; }
    table.rne-table th { background: #f0f0f0; font-weight: bold; }
    ul, ol { margin: 0 0 0.6em; padding-left: 1.6em; }
    ul.rne-task-list { list-style: none; padding-left: 0.4em; }
    .rne-task-item { display: flex; gap: 0.4em; align-items: flex-start; }
    .rne-page-break { break-after: page; page-break-after: always; height: 0; }
    code { font-family: 'Courier New', monospace; background: #f3f3f3; padding: 0 2px; }
  `.trim();
}

/**
 * Build a complete, standalone HTML document for PDF rendering — used by both
 * the client print path and the server headless-browser renderer so output is
 * consistent (F-6.4, F-6.11).
 */
export function buildPrintDocument(
  doc: DocumentJSON,
  page: PageConfig,
  title = 'Document',
): string {
  const body = documentToHtml(doc);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${printStylesheet(page)}</style>
</head>
<body>
<div class="rne-print-page">
${body}
</div>
</body>
</html>`;
}
