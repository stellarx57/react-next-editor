/**
 * CSS value sanitization (§5.12). These DOM-free helpers are the single guard
 * for every attribute value that is interpolated into an inline `style` string
 * by a node/mark `toDOM`. They neutralize CSS injection from attacker-controlled
 * document JSON (e.g. a shared/loaded document) — values like
 * `"left;background:url(//evil)"` can never break out of their declaration or
 * introduce `url(...)` fetches.
 *
 * Pure and isomorphic: safe to import in the schema (browser and Node).
 */

const ALIGN_VALUES = new Set(['left', 'center', 'right', 'justify']);

/** Validate a text-alignment keyword, or null. */
export function cssAlign(value: unknown): 'left' | 'center' | 'right' | 'justify' | null {
  return typeof value === 'string' && ALIGN_VALUES.has(value)
    ? (value as 'left' | 'center' | 'right' | 'justify')
    : null;
}

/**
 * Coerce a value to a finite number clamped to [min, max], or null if it is not
 * numeric. Accepts numbers or numeric strings (with an optional leading number),
 * so a malicious `"0;background:url(x)"` parses to `0` (or null) — never a
 * style breakout.
 */
export function cssNumber(value: unknown, min: number, max: number): number | null {
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string') {
    // Only accept a clean numeric token; reject anything with extra characters
    // (so "5;x" or "1px;background:..." is rejected rather than coerced to 5).
    const trimmed = value.trim();
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
    n = parseFloat(trimmed);
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

/** Coerce a value to a clamped, rounded integer, or null. */
export function cssInteger(value: unknown, min: number, max: number): number | null {
  const n = cssNumber(value, min, max);
  return n === null ? null : Math.round(n);
}

/**
 * Validate and normalize a CSS color (hex / rgb / rgba / named), rejecting
 * anything that could carry an injection (e.g. `url(...)`, `expression(...)`).
 */
export function normalizeCssColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(v)) return v;
  if (/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/.test(v)) return v;
  if (/^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/.test(v)) return v;
  if (/^[a-z]{3,20}$/.test(v)) return v; // named colors
  return null;
}

/**
 * Sanitize a font-family value to a safe character set (letters, digits, space,
 * comma, hyphen, underscore). Strips quotes, semicolons, parentheses, etc., so
 * `url(...)`/declaration breakouts are impossible. Returns null if empty.
 */
export function cssFontFamily(value: unknown): string | null {
  if (value == null) return null;
  const cleaned = String(value)
    .replace(/[^a-zA-Z0-9 ,_-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned : null;
}
