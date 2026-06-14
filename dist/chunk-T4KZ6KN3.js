// src/security/sanitize.ts
var SAFE_LINK_SCHEMES = /* @__PURE__ */ new Set(["http:", "https:", "mailto:", "tel:", "ftp:"]);
var SAFE_IMAGE_SCHEMES = /* @__PURE__ */ new Set(["http:", "https:", "blob:"]);
var DANGEROUS_SCHEME = /^(javascript|vbscript|data|file):/i;
function stripControlChars(value) {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 32 || code >= 127 && code <= 159) continue;
    out += value[i];
  }
  return out;
}
function sanitizeUrl(raw) {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  const cleaned = stripControlChars(value);
  if (!cleaned) return null;
  if (DANGEROUS_SCHEME.test(cleaned)) return null;
  if (cleaned.startsWith("/") || cleaned.startsWith("#") || cleaned.startsWith("?") || cleaned.startsWith("./") || cleaned.startsWith("../")) {
    return cleaned;
  }
  if (cleaned.startsWith("//")) return `https:${cleaned}`;
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned);
  if (schemeMatch) {
    const scheme = `${schemeMatch[1].toLowerCase()}:`;
    return SAFE_LINK_SCHEMES.has(scheme) ? cleaned : null;
  }
  return cleaned;
}
function sanitizeImageSrc(raw) {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  const cleaned = stripControlChars(value);
  if (!cleaned) return null;
  if (/^data:/i.test(cleaned)) {
    if (/^data:image\/(png|jpe?g|gif|webp|bmp|x-icon|vnd\.microsoft\.icon);/i.test(cleaned)) {
      return cleaned;
    }
    return null;
  }
  if (cleaned.startsWith("/") || cleaned.startsWith("./") || cleaned.startsWith("../")) {
    return cleaned;
  }
  if (cleaned.startsWith("//")) return `https:${cleaned}`;
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned);
  if (schemeMatch) {
    const scheme = `${schemeMatch[1].toLowerCase()}:`;
    return SAFE_IMAGE_SCHEMES.has(scheme) ? cleaned : null;
  }
  return cleaned;
}
var ALLOWED_HTML_TAGS = [
  "p",
  "br",
  "span",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "strike",
  "sub",
  "sup",
  "mark",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "hr",
  "caption",
  "colgroup",
  "col"
];
var ALLOWED_HTML_ATTRS = [
  "href",
  "title",
  "target",
  "src",
  "alt",
  "width",
  "height",
  "colspan",
  "rowspan",
  "style",
  "align",
  "start",
  "type",
  "data-checked"
];
var purifierPromise = null;
var cachedPurify = null;
async function getPurifier() {
  if (purifierPromise) return purifierPromise;
  purifierPromise = (async () => {
    if (typeof window === "undefined") return null;
    const mod = await import('dompurify');
    const factory = mod.default ?? mod;
    const purify = factory(window);
    purify.addHook("afterSanitizeAttributes", (node) => {
      const el = node;
      if (el.hasAttribute && el.hasAttribute("href")) {
        const safe = sanitizeUrl(el.getAttribute("href"));
        if (safe) el.setAttribute("href", safe);
        else el.removeAttribute("href");
      }
      if (el.tagName === "IMG" && el.hasAttribute("src")) {
        const safe = sanitizeImageSrc(el.getAttribute("src"));
        if (safe) el.setAttribute("src", safe);
        else el.removeAttribute("src");
      }
      if (el.tagName === "A") {
        el.setAttribute("rel", "noopener noreferrer nofollow");
      }
    });
    const fn = (html) => purify.sanitize(html, {
      ALLOWED_TAGS: ALLOWED_HTML_TAGS,
      ALLOWED_ATTR: ALLOWED_HTML_ATTRS,
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "svg", "math"],
      FORBID_ATTR: ["srcset"],
      ALLOW_DATA_ATTR: false,
      USE_PROFILES: { html: true }
    });
    cachedPurify = fn;
    return fn;
  })();
  return purifierPromise;
}
async function preloadSanitizer() {
  await getPurifier();
}
function sanitizeHtmlSync(html) {
  return cachedPurify ? cachedPurify(html) : html;
}
async function sanitizeHtml(html) {
  const purify = await getPurifier();
  return purify ? purify(html) : html;
}

export { preloadSanitizer, sanitizeHtml, sanitizeHtmlSync, sanitizeImageSrc, sanitizeUrl };
//# sourceMappingURL=chunk-T4KZ6KN3.js.map
//# sourceMappingURL=chunk-T4KZ6KN3.js.map