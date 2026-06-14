import type { Attrs, Node as PMNode } from 'prosemirror-model';
import { cssAlign, cssInteger, cssNumber } from '../../security/css';

/** Permitted text-alignment values. `null` means "inherit / default (left in LTR)". */
export type TextAlign = 'left' | 'center' | 'right' | 'justify' | null;

const ALIGN_VALUES: ReadonlyArray<Exclude<TextAlign, null>> = [
  'left',
  'center',
  'right',
  'justify',
];

/** Maximum indent levels, to bound the document and prevent runaway nesting. */
export const MAX_INDENT = 12;
/** Indent step in em units, applied as `margin-left`. */
export const INDENT_STEP_EM = 3;

/**
 * Shared block attributes for paragraph and heading nodes: text alignment,
 * indentation level, and line height. Validity is enforced here so the document
 * can never hold an out-of-range value (F-11.5).
 */
export const blockAttrs = {
  align: { default: null as TextAlign },
  indent: { default: 0 },
  lineHeight: { default: null as number | null },
};

/** Read block attributes from a DOM element during paste/parse. */
export function readBlockAttrs(dom: HTMLElement): {
  align: TextAlign;
  indent: number;
  lineHeight: number | null;
} {
  const textAlign = dom.style.textAlign || dom.getAttribute('align') || '';
  const align = (ALIGN_VALUES as readonly string[]).includes(textAlign)
    ? (textAlign as TextAlign)
    : null;

  let indent = 0;
  const marginLeft = dom.style.marginLeft;
  if (marginLeft) {
    const em = parseFloat(marginLeft);
    if (Number.isFinite(em) && em > 0) {
      const unit = /px$/.test(marginLeft) ? em / 16 : em;
      indent = Math.min(MAX_INDENT, Math.max(0, Math.round(unit / INDENT_STEP_EM)));
    }
  }

  let lineHeight: number | null = null;
  const lh = dom.style.lineHeight;
  if (lh) {
    const value = parseFloat(lh);
    if (Number.isFinite(value) && value > 0 && value <= 10) {
      lineHeight = Math.round(value * 100) / 100;
    }
  }

  return { align, indent, lineHeight };
}

/** Build the DOM attribute object (style/class) for a block node's attributes. */
export function blockDOMAttrs(node: PMNode, extra?: Record<string, string>): Record<string, string> {
  const attrs = node.attrs as Attrs;
  const styles: string[] = [];
  // Every value is re-validated here (never trust attrs from loaded JSON) so a
  // crafted value such as "left;background:url(...)" cannot inject CSS (§5.12).
  const align = cssAlign(attrs.align);
  if (align) styles.push(`text-align: ${align}`);
  const indent = cssInteger(attrs.indent, 0, MAX_INDENT);
  if (indent && indent > 0) styles.push(`margin-left: ${indent * INDENT_STEP_EM}em`);
  const lineHeight = cssNumber(attrs.lineHeight, 0.1, 10);
  if (lineHeight) styles.push(`line-height: ${lineHeight}`);

  const out: Record<string, string> = { ...extra };
  if (styles.length) out.style = styles.join('; ');
  return out;
}

/** Clamp an indent value into the valid range. */
export function clampIndent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_INDENT, Math.max(0, Math.round(value)));
}

/** Type guard for a valid alignment value. */
export function isTextAlign(value: unknown): value is Exclude<TextAlign, null> {
  return typeof value === 'string' && (ALIGN_VALUES as readonly string[]).includes(value);
}
