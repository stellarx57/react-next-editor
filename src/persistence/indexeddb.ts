import { type IDBPDatabase, openDB } from 'idb';
import type { LocalStoreAdapter, OutboxEntry, StoredDocument } from './types';
import { MemoryStore } from './memory';

const DB_VERSION = 1;
const STORE_DOCS = 'documents';
const STORE_OUTBOX = 'outbox';
const STORE_ASSETS = 'assets';

/**
 * Durable {@link LocalStoreAdapter} backed by IndexedDB (§8.7). `localStorage`
 * is explicitly rejected (too small, synchronous, string-only). Falls back to an
 * in-memory store when IndexedDB is unavailable (SSR, private mode) so the
 * editor never crashes (F-11.1).
 */
export class IndexedDBStore implements LocalStoreAdapter {
  private dbName: string;
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private fallback: MemoryStore | null = null;

  constructor(dbName = 'react-next-editor') {
    this.dbName = dbName;
  }

  /** Whether IndexedDB is usable in the current environment. */
  static isSupported(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  private async db(): Promise<IDBPDatabase | null> {
    if (!IndexedDBStore.isSupported()) {
      if (!this.fallback) this.fallback = new MemoryStore();
      return null;
    }
    if (!this.dbPromise) {
      this.dbPromise = openDB(this.dbName, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_DOCS)) {
            db.createObjectStore(STORE_DOCS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
            db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_ASSETS)) {
            db.createObjectStore(STORE_ASSETS);
          }
        },
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[react-next-editor] IndexedDB unavailable, using memory store.', err);
        this.fallback = new MemoryStore();
        throw err;
      });
    }
    try {
      return await this.dbPromise;
    } catch {
      return null;
    }
  }

  async getDocument(id: string): Promise<StoredDocument | null> {
    const db = await this.db();
    if (!db) return this.fallback!.getDocument(id);
    return (await db.get(STORE_DOCS, id)) ?? null;
  }

  async putDocument(record: StoredDocument): Promise<void> {
    const db = await this.db();
    if (!db) return this.fallback!.putDocument(record);
    await db.put(STORE_DOCS, record);
  }

  async deleteDocument(id: string): Promise<void> {
    const db = await this.db();
    if (!db) return this.fallback!.deleteDocument(id);
    await db.delete(STORE_DOCS, id);
  }

  async listDocuments(): Promise<StoredDocument[]> {
    const db = await this.db();
    if (!db) return this.fallback!.listDocuments();
    return db.getAll(STORE_DOCS);
  }

  async enqueue(entry: OutboxEntry): Promise<void> {
    const db = await this.db();
    if (!db) return this.fallback!.enqueue(entry);
    await db.put(STORE_OUTBOX, entry);
  }

  async dequeue(id: string): Promise<void> {
    const db = await this.db();
    if (!db) return this.fallback!.dequeue(id);
    await db.delete(STORE_OUTBOX, id);
  }

  async listOutbox(): Promise<OutboxEntry[]> {
    const db = await this.db();
    if (!db) return this.fallback!.listOutbox();
    return db.getAll(STORE_OUTBOX);
  }

  async putAsset(key: string, blob: Blob): Promise<void> {
    const db = await this.db();
    if (!db) return this.fallback!.putAsset(key, blob);
    await db.put(STORE_ASSETS, blob, key);
  }

  async getAsset(key: string): Promise<Blob | null> {
    const db = await this.db();
    if (!db) return this.fallback!.getAsset(key);
    return (await db.get(STORE_ASSETS, key)) ?? null;
  }

  async deleteAsset(key: string): Promise<void> {
    const db = await this.db();
    if (!db) return this.fallback!.deleteAsset(key);
    await db.delete(STORE_ASSETS, key);
  }

  async clear(): Promise<void> {
    const db = await this.db();
    if (!db) return this.fallback!.clear();
    await Promise.all([
      db.clear(STORE_DOCS),
      db.clear(STORE_OUTBOX),
      db.clear(STORE_ASSETS),
    ]);
  }
}

/**
 * Request persistent storage to reduce eviction risk for unsynced data (F-9.11).
 * Resolves to whether persistence was granted; never throws.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    /* ignore */
  }
  return false;
}
