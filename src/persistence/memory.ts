import type { LocalStoreAdapter, OutboxEntry, StoredDocument } from './types';

/**
 * In-memory {@link LocalStoreAdapter}. Used as an SSR-safe fallback when
 * IndexedDB is unavailable and as a test double. Not durable across reloads.
 */
export class MemoryStore implements LocalStoreAdapter {
  private docs = new Map<string, StoredDocument>();
  private outbox = new Map<string, OutboxEntry>();
  private assets = new Map<string, Blob>();

  async getDocument(id: string): Promise<StoredDocument | null> {
    return this.docs.get(id) ?? null;
  }

  async putDocument(record: StoredDocument): Promise<void> {
    this.docs.set(record.id, structuredCloneSafe(record));
  }

  async deleteDocument(id: string): Promise<void> {
    this.docs.delete(id);
  }

  async listDocuments(): Promise<StoredDocument[]> {
    return [...this.docs.values()];
  }

  async enqueue(entry: OutboxEntry): Promise<void> {
    this.outbox.set(entry.id, { ...entry });
  }

  async dequeue(id: string): Promise<void> {
    this.outbox.delete(id);
  }

  async listOutbox(): Promise<OutboxEntry[]> {
    return [...this.outbox.values()];
  }

  async putAsset(key: string, blob: Blob): Promise<void> {
    this.assets.set(key, blob);
  }

  async getAsset(key: string): Promise<Blob | null> {
    return this.assets.get(key) ?? null;
  }

  async deleteAsset(key: string): Promise<void> {
    this.assets.delete(key);
  }

  async clear(): Promise<void> {
    this.docs.clear();
    this.outbox.clear();
    this.assets.clear();
  }
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      /* fall through */
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
