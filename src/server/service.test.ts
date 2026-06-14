import { describe, expect, it, vi } from 'vitest';
import type { DocumentJSON } from '../config/types';
import { createExportService } from './service';
import { createExportHandler } from './http';
import { MemoryStorage } from './storage';
import type { DocumentStoreReader, PdfRenderer } from './types';

const doc: DocumentJSON = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1, align: null, indent: 0, lineHeight: null },
      content: [{ type: 'text', text: 'Order' }],
    },
    {
      type: 'paragraph',
      attrs: { align: null, indent: 0, lineHeight: null },
      content: [{ type: 'text', text: 'Body text.' }],
    },
  ],
};

const store: DocumentStoreReader = {
  loadDocument: async (id) => (id === 'doc-1' ? doc : null),
};

const fakePdf: PdfRenderer = {
  render: vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46])), // %PDF
};

describe('ExportService', () => {
  it('exports inline JSON to plain text', async () => {
    const svc = createExportService();
    const result = await svc.export({ documentJson: doc, format: 'txt' });
    expect(result.status).toBe('ok');
    expect(result.contentType).toContain('text/plain');
    expect(new TextDecoder().decode(result.bytes)).toContain('Order');
    expect(result.filename.endsWith('.txt')).toBe(true);
  });

  it('reads a stored document by id and renders DOCX bytes (PK zip)', async () => {
    const svc = createExportService({ store });
    const result = await svc.export({ documentId: 'doc-1', format: 'docx' });
    expect(result.status).toBe('ok');
    expect(result.bytes!.length).toBeGreaterThan(1000);
    expect(result.bytes![0]).toBe(0x50);
    expect(result.bytes![1]).toBe(0x4b);
  });

  it('writes to storage and returns a URL when store is requested', async () => {
    const storage = new MemoryStorage();
    const svc = createExportService({ store, storage });
    const result = await svc.export({ documentId: 'doc-1', format: 'txt', store: true });
    expect(result.status).toBe('ok');
    expect(result.url).toBe('memory:doc-1.txt');
    expect(result.bytes).toBeUndefined();
    expect(new TextDecoder().decode(storage.get('doc-1.txt')!.data)).toContain('Order');
  });

  it('renders PDF via the injected renderer and errors without one', async () => {
    const ok = await createExportService({ pdfRenderer: fakePdf }).export({
      documentJson: doc,
      format: 'pdf',
    });
    expect(ok.status).toBe('ok');
    expect(ok.contentType).toBe('application/pdf');
    expect(fakePdf.render).toHaveBeenCalledOnce();

    const noRenderer = await createExportService().export({ documentJson: doc, format: 'pdf' });
    expect(noRenderer.status).toBe('error');
    expect(noRenderer.error).toContain('PDF renderer');
  });

  it('reports a clear error for a missing document (no malformed file)', async () => {
    const svc = createExportService({ store });
    const result = await svc.export({ documentId: 'missing', format: 'docx' });
    expect(result.status).toBe('error');
    expect(result.error).toBe('document not found');
    expect(result.bytes).toBeUndefined();
  });

  it('enforces authorization', async () => {
    const svc = createExportService({ authorize: (req) => req.documentId === 'allowed' });
    const denied = await svc.export({ documentJson: doc, format: 'txt' });
    expect(denied.status).toBe('error');
    expect(denied.error).toBe('unauthorized');
  });

  it('runs a batch with independent per-document status (F-6.17)', async () => {
    const svc = createExportService({ store });
    const results = await svc.exportBatch([
      { documentId: 'doc-1', format: 'txt' },
      { documentId: 'missing', format: 'txt' },
    ]);
    expect(results[0]!.status).toBe('ok');
    expect(results[1]!.status).toBe('error');
  });

  it('supports asynchronous jobs', async () => {
    const svc = createExportService({ store });
    const { jobId } = svc.enqueue([{ documentId: 'doc-1', format: 'txt' }]);
    expect(jobId).toMatch(/^job-/);
    // Allow the in-process job to run.
    await new Promise((r) => setTimeout(r, 20));
    const job = svc.getJob(jobId);
    expect(job?.status).toBe('completed');
    expect(job?.results[0]?.status).toBe('ok');
  });
});

describe('createExportHandler', () => {
  const svc = createExportService({ store, storage: new MemoryStorage() });
  const handle = createExportHandler(svc);

  it('returns binary for an inline single export', async () => {
    const res = await handle(
      new Request('http://x/export', {
        method: 'POST',
        body: JSON.stringify({ documentJson: doc, format: 'txt' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(await res.text()).toContain('Order');
  });

  it('returns JSON with a URL when stored', async () => {
    const res = await handle(
      new Request('http://x/export', {
        method: 'POST',
        body: JSON.stringify({ documentId: 'doc-1', format: 'txt', store: true }),
      }),
    );
    const data = (await res.json()) as { url: string; status: string };
    expect(data.status).toBe('ok');
    expect(data.url).toContain('memory:');
  });

  it('rejects non-POST and malformed bodies', async () => {
    expect((await handle(new Request('http://x', { method: 'GET' }))).status).toBe(405);
    const bad = await handle(new Request('http://x', { method: 'POST', body: '{' }));
    expect(bad.status).toBe(400);
  });
});
