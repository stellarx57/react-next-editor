import type { ExportService } from './service';
import type { ExportRequest, ExportResult } from './types';

/**
 * A web-standard `(Request) => Promise<Response>` handler factory for the export
 * service (F-6.8). It works directly as a Next.js App Router route handler, or
 * in any Fetch-API server. Authentication is delegated to the service's
 * `authorize` hook; the Bearer token (if any) is passed through as context.
 *
 * Request body shapes (POST, JSON):
 *   - `{ jobId }`                        → returns the async job status
 *   - `{ async: true, requests: [...] }` → enqueues a batch, returns `{ jobId }`
 *   - `{ requests: [...] }`              → synchronous batch, returns `{ results }`
 *   - a single {@link ExportRequest}     → returns the file (binary) or a `{ url }`
 */
export function createExportHandler(service: ExportService) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return json({ error: 'method not allowed' }, 405);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid JSON body' }, 400);
    }

    const context = { token: bearerToken(request), headers: headerRecord(request) };

    if (isRecord(body) && typeof body.jobId === 'string') {
      const job = service.getJob(body.jobId);
      return job ? json(job) : json({ error: 'job not found' }, 404);
    }

    if (isRecord(body) && Array.isArray(body.requests)) {
      const requests = body.requests as ExportRequest[];
      if (body.async === true) {
        return json(service.enqueue(requests, context), 202);
      }
      const results = await service.exportBatch(requests, context);
      return json({ results: results.map(serializeResult) });
    }

    if (isRecord(body) && typeof body.format === 'string') {
      const result = await service.export(body as unknown as ExportRequest, context);
      if (result.status === 'error') {
        return json({ ...serializeResult(result) }, statusForError(result.error));
      }
      if (result.url) {
        return json(serializeResult(result));
      }
      // Inline binary download.
      return new Response(result.bytes as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': result.contentType,
          'Content-Disposition': `attachment; filename="${result.filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return json({ error: 'malformed request' }, 400);
  };
}

/** Serialize a result for JSON transport: bytes become base64 (omit when stored). */
function serializeResult(result: ExportResult): Record<string, unknown> {
  const { bytes, ...rest } = result;
  return bytes && !result.url ? { ...rest, base64: toBase64(bytes) } : rest;
}

function statusForError(error?: string): number {
  if (error === 'unauthorized') return 401;
  if (error === 'document not found') return 404;
  return 400;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function bearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match ? match[1]! : null;
}

function headerRecord(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  // eslint-disable-next-line no-undef
  return btoa(binary);
}
