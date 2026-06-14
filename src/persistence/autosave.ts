import type { DocumentJSON, SaveStatus } from '../config/types';
import type { LocalStoreAdapter, SaveStatusListener, StoredDocument } from './types';

export interface DocumentPersistenceOptions {
  documentId: string;
  store: LocalStoreAdapter;
  /** Debounce window for autosave writes (default 800ms). */
  debounceMs?: number;
  /** Initial metadata to attach to the stored record. */
  metadata?: Record<string, unknown>;
  onStatus?: SaveStatusListener;
}

/**
 * Manages local-first persistence for a single document (F-8.x, F-9.2, NF-9):
 * debounced autosave of `doc.toJSON()` to the durable store, dirty-flag and
 * outbox maintenance for later sync, and crash/reload recovery via {@link load}.
 * The local store is the source of truth during editing; the network is never in
 * the critical path (C-7, NF-8).
 */
export class DocumentPersistence {
  private readonly id: string;
  private readonly store: LocalStoreAdapter;
  private readonly debounceMs: number;
  private readonly onStatus?: SaveStatusListener;
  private metadata?: Record<string, unknown>;

  private current: StoredDocument | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: DocumentJSON | null = null;
  private destroyed = false;
  private writing = false;

  constructor(options: DocumentPersistenceOptions) {
    this.id = options.documentId;
    this.store = options.store;
    this.debounceMs = options.debounceMs ?? 800;
    this.onStatus = options.onStatus;
    this.metadata = options.metadata;
  }

  private emit(status: SaveStatus, detail?: { error?: string }): void {
    this.onStatus?.(status, detail);
  }

  /** Load the latest locally-persisted document (crash/reload recovery, F-11.9). */
  async load(): Promise<StoredDocument | null> {
    const record = await this.store.getDocument(this.id);
    this.current = record;
    return record;
  }

  /** The current stored record, if loaded/saved. */
  getRecord(): StoredDocument | null {
    return this.current;
  }

  /** Whether there are unsynced local changes. */
  isDirty(): boolean {
    return this.current?.dirty ?? false;
  }

  /** Schedule a debounced save of the latest document JSON (F-4.8). */
  scheduleSave(doc: DocumentJSON): void {
    if (this.destroyed) return;
    this.pending = doc;
    this.emit('savingLocal');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, this.debounceMs);
  }

  /** Immediately persist any pending document (e.g. on blur/unmount). */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending == null) return;
    const doc = this.pending;
    this.pending = null;
    await this.saveNow(doc);
  }

  /**
   * Persist a document to the local store, atomically bump the revision, mark it
   * dirty and enqueue it in the outbox for later upload. Writes are serialized to
   * avoid partial saves (NF-9).
   */
  async saveNow(doc: DocumentJSON): Promise<StoredDocument> {
    if (this.writing) {
      // Coalesce concurrent writes: keep the latest as pending and return current.
      this.pending = doc;
      return this.current ?? this.makeRecord(doc);
    }
    this.writing = true;
    try {
      const record = this.makeRecord(doc);
      await this.store.putDocument(record);
      await this.store.enqueue({
        id: this.id,
        rev: record.rev,
        queuedAt: record.updatedAt,
        attempts: 0,
      });
      this.current = record;
      this.emit('savedLocal');
      return record;
    } catch (err) {
      this.emit('syncFailed', { error: (err as Error)?.message });
      throw err;
    } finally {
      this.writing = false;
      if (this.pending != null) {
        const next = this.pending;
        this.pending = null;
        await this.saveNow(next);
      }
    }
  }

  private makeRecord(doc: DocumentJSON): StoredDocument {
    const prev = this.current;
    return {
      id: this.id,
      doc,
      rev: (prev?.rev ?? 0) + 1,
      baseVersion: prev?.baseVersion ?? null,
      dirty: true,
      updatedAt: Date.now(),
      metadata: this.metadata ?? prev?.metadata,
    };
  }

  /** Mark the document as synced after a successful remote save (NF-10). */
  async markSynced(version: string | number, serverDoc?: DocumentJSON): Promise<void> {
    if (!this.current) return;
    const record: StoredDocument = {
      ...this.current,
      doc: serverDoc ?? this.current.doc,
      baseVersion: version,
      dirty: false,
    };
    await this.store.putDocument(record);
    await this.store.dequeue(this.id);
    this.current = record;
    this.emit('synced');
  }

  /** Purge this document's locally-persisted data and outbox entry (F-12.7). */
  async clearLocal(): Promise<void> {
    await this.store.deleteDocument(this.id);
    await this.store.dequeue(this.id);
    this.current = null;
  }

  /** Stop the autosave timer and flush pending work. */
  async destroy(): Promise<void> {
    this.destroyed = true;
    await this.flush();
  }
}
