import { describe, expect, it, vi } from 'vitest';
import type { DocumentJSON } from '../config/types';
import { MemoryStore } from './memory';
import { DocumentPersistence } from './autosave';
import { SyncEngine } from '../sync/engine';
import { ConflictError, type RemoteSyncAdapter, type StoredDocument } from './types';

const doc: DocumentJSON = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { align: null, indent: 0, lineHeight: null },
      content: [{ type: 'text', text: 'hello' }],
    },
  ],
};

describe('DocumentPersistence', () => {
  it('saves locally, marks dirty, enqueues outbox, and recovers on load', async () => {
    const store = new MemoryStore();
    const p = new DocumentPersistence({ documentId: 'doc-1', store, debounceMs: 5 });
    await p.saveNow(doc);

    const record = await store.getDocument('doc-1');
    expect(record).not.toBeNull();
    expect(record!.dirty).toBe(true);
    expect(record!.rev).toBe(1);
    expect((await store.listOutbox()).length).toBe(1);

    // A fresh manager recovers the persisted state (crash/reload recovery).
    const p2 = new DocumentPersistence({ documentId: 'doc-1', store });
    const recovered = await p2.load();
    expect(recovered!.doc).toEqual(doc);
  });

  it('debounced scheduleSave coalesces to a single write', async () => {
    const store = new MemoryStore();
    const putSpy = vi.spyOn(store, 'putDocument');
    const p = new DocumentPersistence({ documentId: 'd', store, debounceMs: 10 });
    p.scheduleSave(doc);
    p.scheduleSave(doc);
    p.scheduleSave(doc);
    await p.flush();
    expect(putSpy).toHaveBeenCalledTimes(1);
  });
});

describe('SyncEngine', () => {
  it('uploads queued documents and clears the dirty flag on success', async () => {
    const store = new MemoryStore();
    const p = new DocumentPersistence({ documentId: 'doc-1', store });
    await p.saveNow(doc);

    const remote: RemoteSyncAdapter = {
      save: vi.fn(async () => ({ version: 42 })),
    };
    const engine = new SyncEngine({ store, remote });
    const synced = await engine.flush();

    expect(synced).toBe(1);
    expect(remote.save).toHaveBeenCalledOnce();
    const record = await store.getDocument('doc-1');
    expect(record!.dirty).toBe(false);
    expect(record!.baseVersion).toBe(42);
    expect((await store.listOutbox()).length).toBe(0);
  });

  it('retries with backoff on transient failure and keeps the document queued', async () => {
    const store = new MemoryStore();
    const p = new DocumentPersistence({ documentId: 'doc-1', store });
    await p.saveNow(doc);

    const remote: RemoteSyncAdapter = {
      save: vi.fn(async () => {
        throw new Error('network down');
      }),
    };
    const engine = new SyncEngine({ store, remote });
    await engine.flush();

    const outbox = await store.listOutbox();
    expect(outbox.length).toBe(1);
    expect(outbox[0]!.attempts).toBe(1);
    expect(outbox[0]!.nextAttemptAt).toBeGreaterThan(Date.now());
    const record = await store.getDocument('doc-1');
    expect(record!.dirty).toBe(true); // not lost
  });

  it('parks a conflicted document and invokes the conflict handler', async () => {
    const store = new MemoryStore();
    const p = new DocumentPersistence({ documentId: 'doc-1', store });
    await p.saveNow(doc);

    const onConflict = vi.fn();
    const remote: RemoteSyncAdapter = {
      save: vi.fn(async (_record: StoredDocument) => {
        throw new ConflictError('stale', { version: 99 });
      }),
    };
    const engine = new SyncEngine({ store, remote, onConflict });
    await engine.flush();

    expect(onConflict).toHaveBeenCalledOnce();
    const record = await store.getDocument('doc-1');
    expect(record!.dirty).toBe(true);
  });
});
