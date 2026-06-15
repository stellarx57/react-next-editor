import { T as TextConversionOptions } from '../docx-BUrf4PFj.js';
export { D as DocxContext, a as DocxExportOptions, b as DocxNodeConverter, d as documentToDocxBlob, c as documentToDocxBuffer, e as documentToText } from '../docx-BUrf4PFj.js';
import { D as DocumentJSON, P as PageConfig } from '../types-B4z0Quvv.js';
import 'docx';

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

export { type ExportFormat, type PdfPrintOptions, TextConversionOptions, buildPrintDocument, documentToHtml, downloadBlob, downloadText, exportDocument, printDocumentToPdf, printStylesheet };
