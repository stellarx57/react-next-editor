import type { DocumentJSON } from '../config/types';
import { DEFAULT_PAGE } from '../config/defaults';
import { documentToDocxBuffer } from '../export/docx';
import { documentToText } from '../export/text';
import { buildPrintDocument } from '../export/html';
import {
  CONTENT_TYPES,
  FILE_EXTENSIONS,
  type ExportAuthContext,
  type ExportJob,
  type ExportRequest,
  type ExportResult,
  type ExportServiceOptions,
  type ServerExportFormat,
} from './types';

function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * The programmatic export service (§8.8). Converts our own stored/inline JSON to
 * DOCX/PDF/text/HTML using the shared isomorphic converters, optionally persists
 * the result to storage, and reports per-document status. It is authenticated/
 * access-controlled via the injected `authorize` hook (F-6.15) and never emits a
 * malformed file silently — failures are returned as `status: 'error'` (F-6.17).
 */
export class ExportService {
  private readonly options: ExportServiceOptions;
  private readonly jobs = new Map<string, ExportJob>();
  private jobSeq = 0;

  constructor(options: ExportServiceOptions = {}) {
    this.options = options;
    if (!options.authorize) {
      // eslint-disable-next-line no-console
      console.warn(
        'react-next-editor: ExportService created without an `authorize` hook — ' +
          'all requests are allowed. Provide `authorize` to enforce access control (F-6.15).',
      );
    }
  }

  /** Render a single export request (synchronous result). */
  async export(request: ExportRequest, context: ExportAuthContext = {}): Promise<ExportResult> {
    const base = this.baseResult(request);
    try {
      if (this.options.authorize) {
        let allowed = false;
        try {
          allowed = await this.options.authorize(request, context);
        } catch {
          allowed = false;
        }
        if (!allowed) return { ...base, status: 'error', error: 'unauthorized' };
      }

      const doc = await this.resolveDocument(request);
      if (!doc) {
        return { ...base, status: 'error', error: 'document not found' };
      }

      const { bytes, contentType } = await this.render(request.format, doc, request);

      if (request.store) {
        if (!this.options.storage) {
          return { ...base, status: 'error', error: 'no storage adapter configured' };
        }
        const { url, ref } = await this.options.storage.write(base.filename, bytes, contentType);
        return { ...base, status: 'ok', contentType, url, ref };
      }

      return { ...base, status: 'ok', contentType, bytes };
    } catch (err) {
      return { ...base, status: 'error', error: (err as Error)?.message ?? 'export failed' };
    }
  }

  /**
   * Render multiple requests in one call (F-6.12), each with independent status
   * (F-6.17). Failures of one item do not abort the others.
   */
  async exportBatch(
    requests: ExportRequest[],
    context: ExportAuthContext = {},
  ): Promise<ExportResult[]> {
    return Promise.all(requests.map((req) => this.export(req, context)));
  }

  /**
   * Enqueue a batch as an asynchronous job (F-6.13). Returns immediately with a
   * job id; poll {@link getJob} for status/results. This is a simple in-process
   * runner — swap in a durable queue (e.g. BullMQ) for production scale.
   */
  enqueue(requests: ExportRequest[], context: ExportAuthContext = {}): { jobId: string } {
    const id = `job-${Date.now()}-${++this.jobSeq}`;
    const job: ExportJob = {
      id,
      status: 'pending',
      total: requests.length,
      completed: 0,
      results: [],
      createdAt: Date.now(),
    };
    this.jobs.set(id, job);

    void (async () => {
      job.status = 'running';
      try {
        for (const req of requests) {
          const result = await this.export(req, context);
          job.results.push(result);
          job.completed++;
        }
        job.status = 'completed';
      } catch (err) {
        job.status = 'failed';
        job.error = (err as Error)?.message ?? 'job failed';
      } finally {
        job.finishedAt = Date.now();
      }
    })();

    return { jobId: id };
  }

  /** Look up an async job's status and results. */
  getJob(jobId: string): ExportJob | null {
    return this.jobs.get(jobId) ?? null;
  }

  /** Release renderer resources (e.g. close the headless browser). */
  async close(): Promise<void> {
    await this.options.pdfRenderer?.close?.();
  }

  // --- internals ---

  private baseResult(request: ExportRequest): ExportResult {
    const name = request.options?.filename ?? request.documentId ?? request.options?.title ?? 'document';
    const ext = FILE_EXTENSIONS[request.format];
    const filename = name.toLowerCase().endsWith(`.${ext}`) ? name : `${name}.${ext}`;
    return {
      status: 'error',
      format: request.format,
      filename,
      contentType: CONTENT_TYPES[request.format],
      documentId: request.documentId,
    };
  }

  private async resolveDocument(request: ExportRequest): Promise<DocumentJSON | null> {
    if (request.documentJson) return request.documentJson;
    if (request.documentId && this.options.store) {
      return this.options.store.loadDocument(request.documentId);
    }
    return null;
  }

  private async render(
    format: ServerExportFormat,
    doc: DocumentJSON,
    request: ExportRequest,
  ): Promise<{ bytes: Uint8Array; contentType: string }> {
    const page = request.options?.page ?? DEFAULT_PAGE;
    const title = request.options?.title ?? request.options?.filename;
    switch (format) {
      case 'docx': {
        const buffer = await documentToDocxBuffer(doc, {
          page,
          title,
          nodeConverters: this.options.nodeConverters,
        });
        return { bytes: new Uint8Array(buffer), contentType: CONTENT_TYPES.docx };
      }
      case 'txt':
        return {
          bytes: encodeText(documentToText(doc, request.options?.text)),
          contentType: CONTENT_TYPES.txt,
        };
      case 'html':
        return {
          bytes: encodeText(buildPrintDocument(doc, page, title)),
          contentType: CONTENT_TYPES.html,
        };
      case 'pdf': {
        if (!this.options.pdfRenderer) {
          throw new Error('no PDF renderer configured');
        }
        const html = buildPrintDocument(doc, page, title);
        const bytes = await this.options.pdfRenderer.render(html, { page });
        return { bytes, contentType: CONTENT_TYPES.pdf };
      }
      default:
        throw new Error(`unsupported format: ${String(format)}`);
    }
  }
}

/** Create a configured {@link ExportService}. */
export function createExportService(options: ExportServiceOptions = {}): ExportService {
  return new ExportService(options);
}
