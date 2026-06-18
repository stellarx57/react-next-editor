import { DOMParser as PMDOMParser, type Schema } from 'prosemirror-model';
import type { DocumentJSON, FeatureFlags } from '../config/types';
import { buildSchema } from '../core/schema/schema';
import { sanitizeHtml } from '../security/sanitize';

/**
 * Best-effort DOCX import (F-7.2 / F-7.3). External `.docx` files are converted
 * to HTML with `mammoth` (BSD), sanitized (§5.12), then parsed into the editor
 * schema via ProseMirror's DOMParser. Fidelity is best-effort: supported
 * structures (headings, lists, tables, bold/italic/underline, links, images)
 * map across; unsupported Word constructs degrade gracefully. `mammoth` is an
 * optional dependency, lazily imported, so it never bloats the editor bundle.
 *
 * Browser-oriented (needs a DOM to parse HTML). For server-side import, run in
 * an environment that provides `document` (e.g. jsdom).
 */

export interface DocxImportResult {
  /** The imported document as ProseMirror JSON. */
  doc: DocumentJSON;
  /** Non-fatal conversion warnings from mammoth (unsupported features, etc.). */
  warnings: string[];
  /** The sanitized intermediate HTML (useful for debugging/inspection). */
  html: string;
}

export interface DocxImportOptions {
  /**
   * Additional mammoth style mappings (e.g. `"p[style-name='Quote'] => blockquote"`).
   * Merged with the built-in defaults.
   */
  styleMap?: string[];
}

/**
 * Input accepted by mammoth. Its browser build reads only `arrayBuffer`; its
 * Node build reads only `buffer` (or `path`). We populate both so whichever
 * build a bundler resolved finds its supported key.
 */
type MammothInput = { arrayBuffer?: ArrayBuffer; buffer?: Uint8Array };

/** Minimal structural type for the parts of mammoth we use. */
interface MammothModule {
  convertToHtml(
    input: MammothInput,
    options?: {
      styleMap?: string[];
      includeDefaultStyleMap?: boolean;
      ignoreEmptyParagraphs?: boolean;
    },
  ): Promise<{ value: string; messages: Array<{ type: string; message: string }> }>;
}

let mammothPromise: Promise<MammothModule> | null = null;
async function loadMammoth(): Promise<MammothModule> {
  if (!mammothPromise) {
    mammothPromise = (async () => {
      try {
        // Plain dynamic import so bundlers code-split `mammoth` into an async
        // chunk and resolve its `browser` build — DOCX import works in the
        // browser, not just in Node. `mammoth` is an optional peer: consumers
        // that never import DOCX can exclude it from their build (e.g. webpack
        // `resolve.alias: { mammoth: false }`).
        const mod = (await import('mammoth')) as { default?: MammothModule } & MammothModule;
        return (mod.default ?? mod) as MammothModule;
      } catch {
        throw new Error(
          "react-next-editor: DOCX import requires 'mammoth'. Install it (npm i mammoth).",
        );
      }
    })();
  }
  return mammothPromise;
}

/**
 * Default style mappings improving fidelity for common Word styles. Mammoth's
 * built-in map already covers Heading 1–6, bold/italic, lists, tables, links and
 * images; these extend it to titles, quotes, captions and higher heading levels
 * so more structure survives import.
 */
const DEFAULT_STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Heading 7'] => h6:fresh",
  "p[style-name='Heading 8'] => h6:fresh",
  "p[style-name='Heading 9'] => h6:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  "p[style-name='Caption'] => p.rne-caption:fresh > em",
  "r[style-name='Strong'] => strong",
  "r[style-name='Emphasis'] => em",
  "r[style-name='Book Title'] => em",
];

/**
 * Build the mammoth input. The raw bytes are normalized to an `ArrayBuffer`, and
 * a `Buffer` view is added when one is available. BOTH keys are supplied because
 * mammoth's browser and Node builds accept different ones (`arrayBuffer` vs
 * `buffer`) — and `typeof Buffer` is not a reliable environment signal in
 * bundled browsers (polyfills and the browser build's own global `Buffer` leak),
 * so it must not be used to *choose* between them.
 */
async function buildMammothInput(input: ArrayBuffer | Uint8Array | Blob): Promise<MammothInput> {
  let arrayBuffer: ArrayBuffer;
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    arrayBuffer = await input.arrayBuffer();
  } else if (input instanceof ArrayBuffer) {
    arrayBuffer = input;
  } else if (input instanceof Uint8Array) {
    arrayBuffer = input.buffer.slice(
      input.byteOffset,
      input.byteOffset + input.byteLength,
    ) as ArrayBuffer;
  } else {
    throw new Error('react-next-editor: unsupported DOCX input type.');
  }

  const out: MammothInput = { arrayBuffer };
  // A Buffer view for mammoth's Node build; harmless (ignored) for the browser
  // build, which reads `arrayBuffer` first.
  if (typeof Buffer !== 'undefined') {
    out.buffer = Buffer.from(new Uint8Array(arrayBuffer));
  }
  return out;
}

/**
 * Import a `.docx` file into the given schema. Returns the document JSON plus
 * any conversion warnings. Never throws on unsupported content — only on a
 * genuinely unreadable file or a missing DOM/mammoth.
 */
export async function importDocx(
  input: ArrayBuffer | Uint8Array | Blob,
  schema: Schema,
  options: DocxImportOptions = {},
): Promise<DocxImportResult> {
  if (typeof document === 'undefined') {
    throw new Error('react-next-editor: importDocx requires a DOM (browser or jsdom).');
  }

  const mammoth = await loadMammoth();
  const mammothInput = await buildMammothInput(input);

  const { value: rawHtml, messages } = await mammoth.convertToHtml(mammothInput, {
    styleMap: [...DEFAULT_STYLE_MAP, ...(options.styleMap ?? [])],
    includeDefaultStyleMap: true,
    // Preserve blank paragraphs so Word's spacing-by-empty-paragraph survives.
    ignoreEmptyParagraphs: false,
  });

  const html = await sanitizeHtml(rawHtml);

  const container = document.createElement('div');
  container.innerHTML = html;
  const parsed = PMDOMParser.fromSchema(schema).parse(container);
  // Guarantee a valid, renderable document (F-11.5). Throws here only if the
  // schema cannot represent the content at all — caught by the caller.
  parsed.check();

  return {
    doc: parsed.toJSON() as DocumentJSON,
    warnings: messages.map((m) => m.message),
    html,
  };
}

/** Options for {@link importDocxToJSON}. */
export interface DocxToJsonOptions extends DocxImportOptions {
  /**
   * Feature flags controlling which schema nodes/marks the imported document may
   * use. Defaults to all features enabled (matching a default editor instance).
   */
  features?: Partial<FeatureFlags>;
}

/**
 * Convenience over {@link importDocx}: builds the editor schema internally from
 * the given feature flags, so callers can convert a `.docx` to document JSON
 * without constructing a ProseMirror {@link Schema} themselves. Pass the same
 * `features` you give the editor so the result is guaranteed to load.
 */
export async function importDocxToJSON(
  input: ArrayBuffer | Uint8Array | Blob,
  options: DocxToJsonOptions = {},
): Promise<DocxImportResult> {
  const schema = buildSchema(options.features);
  return importDocx(input, schema, options);
}
