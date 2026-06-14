/**
 * Security primitives (§5.12). These functions are the single ingress point for
 * untrusted content: pasted/imported HTML, link and image URLs. They are
 * dependency-light and (for URLs) DOM-free so the schema can be imported in
 * Node for export/tests without pulling a DOM library.
 */

/** URL schemes permitted in hyperlinks. Everything else is rejected. */
const SAFE_LINK_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:', 'ftp:']);

/** URL schemes permitted for images. `data:` is allowed only for image MIME types. */
const SAFE_IMAGE_SCHEMES = new Set(['http:', 'https:', 'blob:']);

const DANGEROUS_SCHEME = /^(javascript|vbscript|data|file):/i;

/**
 * Strip control characters and spaces used to obfuscate a URL scheme
 * (e.g. "java\tscript:"). Implemented with char-code inspection to avoid
 * embedding control characters in source.
 */
function stripControlChars(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    // Drop C0/C1 control ranges and the space character.
    if (code <= 0x20 || (code >= 0x7f && code <= 0x9f)) continue;
    out += value[i];
  }
  return out;
}

/**
 * Validate and normalize a hyperlink URL. Returns the cleaned URL, or `null` if
 * the URL is missing or uses an unsafe scheme (e.g. `javascript:`). Relative and
 * fragment/anchor URLs are allowed (F-12.2, F-12.5).
 */
export function sanitizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  const cleaned = stripControlChars(value);
  if (!cleaned) return null;
  if (DANGEROUS_SCHEME.test(cleaned)) return null;

  // Protocol-relative URLs are upgraded to https (checked before single-'/').
  if (cleaned.startsWith('//')) return `https:${cleaned}`;
  // Relative URLs and anchors are safe to keep.
  if (
    cleaned.startsWith('/') ||
    cleaned.startsWith('#') ||
    cleaned.startsWith('?') ||
    cleaned.startsWith('./') ||
    cleaned.startsWith('../')
  ) {
    return cleaned;
  }

  // If it has a scheme, it must be in the allow-list.
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned);
  if (schemeMatch) {
    const scheme = `${schemeMatch[1]!.toLowerCase()}:`;
    return SAFE_LINK_SCHEMES.has(scheme) ? cleaned : null;
  }

  // No scheme and not obviously relative: treat as a bare host/path.
  return cleaned;
}

/**
 * Validate an image source. Accepts http(s)/blob URLs and `data:image/*` URIs,
 * rejecting SVG data URIs and any active-content scheme (F-12.5).
 */
export function sanitizeImageSrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  const cleaned = stripControlChars(value);
  if (!cleaned) return null;

  if (/^data:/i.test(cleaned)) {
    // Permit only raster image data URIs; reject SVG (can carry script).
    if (/^data:image\/(png|jpe?g|gif|webp|bmp|x-icon|vnd\.microsoft\.icon);/i.test(cleaned)) {
      return cleaned;
    }
    return null;
  }

  if (cleaned.startsWith('//')) return `https:${cleaned}`;
  if (cleaned.startsWith('/') || cleaned.startsWith('./') || cleaned.startsWith('../')) {
    return cleaned;
  }

  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned);
  if (schemeMatch) {
    const scheme = `${schemeMatch[1]!.toLowerCase()}:`;
    return SAFE_IMAGE_SCHEMES.has(scheme) ? cleaned : null;
  }
  return cleaned;
}

/** Allowed tags for pasted HTML — a conservative, document-oriented subset. */
const ALLOWED_HTML_TAGS = [
  'p',
  'br',
  'span',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'strike',
  'sub',
  'sup',
  'mark',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'hr',
  'caption',
  'colgroup',
  'col',
];

const ALLOWED_HTML_ATTRS = [
  'href',
  'title',
  'target',
  'src',
  'alt',
  'width',
  'height',
  'colspan',
  'rowspan',
  'style',
  'align',
  'start',
  'type',
  'data-checked',
];

/** Minimal structural type for the DOMPurify instance we use (avoids hard dep on its types). */
interface DOMPurifyInstance {
  sanitize(dirty: string, config?: Record<string, unknown>): string;
  addHook(entryPoint: string, hook: (node: unknown) => void): void;
}
type DOMPurifyFactory = (window: Window & typeof globalThis) => DOMPurifyInstance;

let purifierPromise: Promise<((html: string) => string) | null> | null = null;
/** Resolved synchronous purify function, cached after the first async load. */
let cachedPurify: ((html: string) => string) | null = null;

/**
 * Lazily build a DOMPurify-backed HTML sanitizer. Returns a function that cleans
 * HTML, or `null` if no DOM is available (in which case callers fall back to
 * ProseMirror's own DOM parsing of the already-browser-provided fragment). This
 * is lazy so importing the schema in Node never loads a DOM library.
 */
async function getPurifier(): Promise<((html: string) => string) | null> {
  if (purifierPromise) return purifierPromise;
  purifierPromise = (async () => {
    if (typeof window === 'undefined') return null;
    const mod = await import('dompurify');
    const factory = (mod.default ?? mod) as unknown as DOMPurifyFactory;
    const purify = factory(window as unknown as Window & typeof globalThis);
    // Force-strip event handlers and dangerous protocols defensively.
    purify.addHook('afterSanitizeAttributes', (node) => {
      const el = node as Element;
      if (el.hasAttribute && el.hasAttribute('href')) {
        const safe = sanitizeUrl(el.getAttribute('href'));
        if (safe) el.setAttribute('href', safe);
        else el.removeAttribute('href');
      }
      if (el.tagName === 'IMG' && el.hasAttribute('src')) {
        const safe = sanitizeImageSrc(el.getAttribute('src'));
        if (safe) el.setAttribute('src', safe);
        else el.removeAttribute('src');
      }
      if (el.tagName === 'A') {
        el.setAttribute('rel', 'noopener noreferrer nofollow');
      }
    });
    const fn = (html: string) =>
      purify.sanitize(html, {
        ALLOWED_TAGS: ALLOWED_HTML_TAGS,
        ALLOWED_ATTR: ALLOWED_HTML_ATTRS,
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'svg', 'math'],
        FORBID_ATTR: ['srcset'],
        ALLOW_DATA_ATTR: false,
        USE_PROFILES: { html: true },
      });
    cachedPurify = fn;
    return fn;
  })();
  return purifierPromise;
}

/**
 * Preload the DOM sanitizer so a later synchronous paste can be cleaned without
 * waiting. Safe to call in the browser on editor mount. No-op in Node.
 */
export async function preloadSanitizer(): Promise<void> {
  await getPurifier();
}

/**
 * Sanitize an HTML string synchronously, best-effort: uses the cached DOM
 * sanitizer if it has been loaded, otherwise returns the input unchanged for
 * ProseMirror's own parser (which never executes content and is constrained by
 * the schema and per-attribute URL sanitization). Use for the paste transform.
 */
export function sanitizeHtmlSync(html: string): string {
  return cachedPurify ? cachedPurify(html) : html;
}

/**
 * Sanitize an HTML string for safe parsing into the editor. No script, inline
 * event handlers, or active content survives (F-12.1, F-12.2). When no DOM
 * sanitizer is available the input is returned unchanged for ProseMirror's own
 * parser, which never executes content.
 */
export async function sanitizeHtml(html: string): Promise<string> {
  const purify = await getPurifier();
  return purify ? purify(html) : html;
}
