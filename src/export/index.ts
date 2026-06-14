/**
 * Export pipeline (§5.6). Shared, isomorphic converters from document JSON to
 * plain text, HTML, DOCX and (client) PDF — the same code powers interactive
 * download and the programmatic API so output is consistent (F-6.7, F-6.11).
 */
export { documentToText, type TextConversionOptions } from './text';
export {
  documentToHtml,
  buildPrintDocument,
  printStylesheet,
} from './html';
export {
  documentToDocxBlob,
  documentToDocxBuffer,
  type DocxExportOptions,
  type DocxNodeConverter,
  type DocxContext,
} from './docx';
export { printDocumentToPdf, type PdfPrintOptions } from './pdf';
export { downloadBlob, downloadText } from './download';

import type { DocumentJSON, PageConfig } from '../config/types';
import { documentToText, type TextConversionOptions } from './text';
import { documentToDocxBlob } from './docx';
import { printDocumentToPdf } from './pdf';
import { downloadBlob, downloadText } from './download';

/** Supported export target formats. */
export type ExportFormat = 'docx' | 'pdf' | 'txt' | 'html';

/**
 * High-level interactive export helper used by the toolbar/host: convert the
 * given document to the requested format and trigger a client download (DOCX,
 * TXT) or open the print dialog (PDF). Returns once the action has started.
 */
export async function exportDocument(
  doc: DocumentJSON,
  format: ExportFormat,
  options: {
    filename?: string;
    page?: PageConfig;
    title?: string;
    text?: TextConversionOptions;
  } = {},
): Promise<void> {
  const base = options.filename ?? options.title ?? 'document';
  switch (format) {
    case 'docx': {
      const blob = await documentToDocxBlob(doc, { page: options.page, title: options.title });
      downloadBlob(blob, ensureExt(base, 'docx'));
      return;
    }
    case 'pdf':
      await printDocumentToPdf(doc, { page: options.page, title: options.title });
      return;
    case 'txt':
      downloadText(documentToText(doc, options.text), ensureExt(base, 'txt'));
      return;
    case 'html': {
      const { buildPrintDocument } = await import('./html');
      downloadText(
        buildPrintDocument(doc, options.page ?? (await import('../config/defaults')).DEFAULT_PAGE, options.title),
        ensureExt(base, 'html'),
        'text/html',
      );
      return;
    }
    default:
      throw new Error(`Unsupported export format: ${String(format)}`);
  }
}

function ensureExt(name: string, ext: string): string {
  return name.toLowerCase().endsWith(`.${ext}`) ? name : `${name}.${ext}`;
}
