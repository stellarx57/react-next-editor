import type { DocumentJSON, PageConfig } from '../config/types';
import type { TextConversionOptions } from '../export/text';
import type { DocxNodeConverter } from '../export/docx';

/**
 * Programmatic export service types (§5.6.2, §8.8). This module is server-side
 * (Node) and never imports the React layer or any DOM. It consumes the same
 * isomorphic converters the client uses, so output is consistent (F-6.11).
 *
 * It is OPTIONAL and additive (C-1): editing and offline/client export do not
 * depend on it.
 */

/** Supported programmatic export formats. */
export type ServerExportFormat = 'docx' | 'pdf' | 'txt' | 'html';

/** MIME types for the supported formats. */
export const CONTENT_TYPES: Record<ServerExportFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
  html: 'text/html; charset=utf-8',
};

export const FILE_EXTENSIONS: Record<ServerExportFormat, string> = {
  docx: 'docx',
  pdf: 'pdf',
  txt: 'txt',
  html: 'html',
};

/** A single export request: a document (by id or inline) and a target format. */
export interface ExportRequest {
  /** Stored document id, resolved via the injected {@link DocumentStoreReader}. */
  documentId?: string;
  /** Inline document JSON (used instead of, or as a fallback for, `documentId`). */
  documentJson?: DocumentJSON;
  format: ServerExportFormat;
  options?: {
    page?: PageConfig;
    title?: string;
    /** Base filename (without extension). Defaults to documentId/title/'document'. */
    filename?: string;
    text?: TextConversionOptions;
  };
  /**
   * When true (and a {@link StorageAdapter} is configured), the rendered file is
   * written to storage and a reference/URL is returned (F-6.10). Otherwise the
   * bytes are returned inline.
   */
  store?: boolean;
}

/** Result of a single export. Never throws; failures are reported here (F-6.17). */
export interface ExportResult {
  status: 'ok' | 'error';
  format: ServerExportFormat;
  filename: string;
  contentType: string;
  /** Present when not stored: the rendered bytes. */
  bytes?: Uint8Array;
  /** Present when stored: a URL to fetch the file. */
  url?: string;
  /** Present when stored: an opaque storage reference (e.g. a path or key). */
  ref?: string;
  /** Identifies which input produced this result in a batch. */
  documentId?: string;
  error?: string;
}

/**
 * Reads stored document JSON by id, without a live editor (F-6.9). Inject your
 * backend/data-store implementation.
 */
export interface DocumentStoreReader {
  loadDocument(id: string): Promise<DocumentJSON | null>;
}

/**
 * Persists rendered files to system/object storage and returns a reference/URL
 * (F-6.10). Filesystem and in-memory implementations ship with the package.
 */
export interface StorageAdapter {
  write(key: string, data: Uint8Array, contentType: string): Promise<{ url: string; ref: string }>;
}

/**
 * Renders the shared print HTML to a PDF using a headless browser (F-6.14).
 * Injected so the package does not hard-depend on Puppeteer/Playwright. A
 * Playwright-based factory is provided ({@link createPlaywrightPdfRenderer}).
 */
export interface PdfRenderer {
  render(html: string, options?: { page?: PageConfig }): Promise<Uint8Array>;
  /** Release resources (e.g. close the browser). */
  close?(): Promise<void>;
}

/** Context passed to the authorization hook (e.g. headers, token, user). */
export interface ExportAuthContext {
  headers?: Record<string, string | undefined>;
  token?: string | null;
  [key: string]: unknown;
}

export interface ExportServiceOptions {
  /** Resolves `documentId` to stored JSON (F-6.9). Required for id-based exports. */
  store?: DocumentStoreReader;
  /** Writes rendered files to storage (F-6.10). Required for `store: true` exports. */
  storage?: StorageAdapter;
  /** Server PDF renderer (F-6.14). Required for `format: 'pdf'`. */
  pdfRenderer?: PdfRenderer;
  /** Custom DOCX node converters, matching the client's (F-6.16). */
  nodeConverters?: Record<string, DocxNodeConverter>;
  /**
   * Authorize a request and its document access (F-6.15). Return false to reject.
   * Throwing is also treated as a rejection.
   */
  authorize?: (request: ExportRequest, context: ExportAuthContext) => Promise<boolean> | boolean;
}

/** Status of an asynchronous batch job (F-6.13). */
export interface ExportJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total: number;
  completed: number;
  results: ExportResult[];
  createdAt: number;
  finishedAt?: number;
  error?: string;
}
