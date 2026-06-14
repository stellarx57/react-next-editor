import { D as DocumentJSON, P as PageConfig } from '../types-D1QUFKtw.js';
import * as DocxNamespace from 'docx';

/**
 * Options governing plain-text conversion (F-6.20). Defaults follow the
 * documented structure rules: blocks separated by blank lines, list items on
 * their own lines, table cells tab-delimited, images replaced by alt text,
 * links rendered as their text.
 */
interface TextConversionOptions {
    /** Append the URL after link text as " (url)". Default false. */
    includeLinkUrls?: boolean;
    /** Replacement for images: 'alt' uses alt text, 'omit' drops them. Default 'alt'. */
    images?: 'alt' | 'omit';
    /** Newline sequence. Default '\n'. */
    newline?: string;
}
/**
 * Convert a ProseMirror document (JSON) to plain text (F-6.18). Pure and
 * isomorphic: identical output in the browser and on the server (F-6.19).
 */
declare function documentToText(doc: DocumentJSON, options?: TextConversionOptions): string;

/** Serialize a document (JSON) to an HTML fragment (the document body content). */
declare function documentToHtml(doc: DocumentJSON): string;
/** Print-oriented stylesheet matching the on-screen document surface. */
declare function printStylesheet(page: PageConfig): string;
/**
 * Build a complete, standalone HTML document for PDF rendering — used by both
 * the client print path and the server headless-browser renderer so output is
 * consistent (F-6.4, F-6.11).
 */
declare function buildPrintDocument(doc: DocumentJSON, page: PageConfig, title?: string): string;

/**
 * Isomorphic DOCX serializer (§8.3). Walks the document JSON and emits OOXML via
 * the `docx` library, which runs in both the browser (Blob) and Node
 * (Buffer/Stream). A per-node mapping is used so custom nodes can register their
 * own conversion (F-6.16, F-10.14). The `docx` module is imported lazily so it
 * stays out of the initial bundle (NF-2) and remains optional.
 */
/** A converter for a custom node type, returning docx block elements. */
type DocxNodeConverter = (node: DocumentJSON, ctx: DocxContext) => unknown[];
interface DocxExportOptions {
    page?: PageConfig;
    title?: string;
    /** Custom node converters keyed by node type name (extension mapping). */
    nodeConverters?: Record<string, DocxNodeConverter>;
}
interface DocxContext {
    serializeBlocks: (nodes: DocumentJSON[]) => unknown[];
    docx: DocxModule;
}
type DocxModule = typeof DocxNamespace;
/** Serialize a document to a DOCX Blob for client-side download (F-6.1, F-6.6). */
declare function documentToDocxBlob(doc: DocumentJSON, options?: DocxExportOptions): Promise<Blob>;
/** Serialize a document to a DOCX Buffer for server-side storage (F-6.10). */
declare function documentToDocxBuffer(doc: DocumentJSON, options?: DocxExportOptions): Promise<Buffer>;

interface PdfPrintOptions {
    page?: PageConfig;
    title?: string;
}
/**
 * Client-side PDF export via the browser's print-to-PDF (§8.4). Renders the
 * shared print HTML (matching the on-screen document and the server renderer)
 * into a hidden iframe and invokes print. Vector output with selectable text,
 * works fully offline, no server round-trip (F-6.3, F-6.4, NF-8).
 *
 * Resolves once printing has been initiated. The user chooses "Save as PDF" in
 * the browser's print dialog.
 */
declare function printDocumentToPdf(doc: DocumentJSON, options?: PdfPrintOptions): Promise<void>;

/**
 * Trigger a client-side file download without a server round-trip (F-6.6).
 * Browser-only; throws a clear error if called without a DOM.
 */
declare function downloadBlob(blob: Blob, filename: string): void;
/** Convenience: download a UTF-8 text string as a file. */
declare function downloadText(text: string, filename: string, mime?: string): void;

/**
 * Export pipeline (§5.6). Shared, isomorphic converters from document JSON to
 * plain text, HTML, DOCX and (client) PDF — the same code powers interactive
 * download and the programmatic API so output is consistent (F-6.7, F-6.11).
 */

/** Supported export target formats. */
type ExportFormat = 'docx' | 'pdf' | 'txt' | 'html';
/**
 * High-level interactive export helper used by the toolbar/host: convert the
 * given document to the requested format and trigger a client download (DOCX,
 * TXT) or open the print dialog (PDF). Returns once the action has started.
 */
declare function exportDocument(doc: DocumentJSON, format: ExportFormat, options?: {
    filename?: string;
    page?: PageConfig;
    title?: string;
    text?: TextConversionOptions;
}): Promise<void>;

export { type DocxContext, type DocxExportOptions, type DocxNodeConverter, type ExportFormat, type PdfPrintOptions, type TextConversionOptions, buildPrintDocument, documentToDocxBlob, documentToDocxBuffer, documentToHtml, documentToText, downloadBlob, downloadText, exportDocument, printDocumentToPdf, printStylesheet };
