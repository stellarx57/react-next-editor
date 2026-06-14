import type { SaveStatus } from '../config/types';
import {
  ConflictError,
  type LocalStoreAdapter,
  type RemoteSyncAdapter,
  type SaveStatusListener,
  type StoredDocument,
} from '../persistence/types';

export interface SyncEngineOptions {
  store: LocalStoreAdapter;
  remote: RemoteSyncAdapter;
  /** Max upload attempts before a document is parked for manual retry (default 6). */
  maxAttempts?: number;
  /** Base backoff delay in ms (default 1000). Doubles per attempt, capped at 5min. */
  baseDelayMs?: number;
  onStatus?: SaveStatusListener;
  /** Invoked when a version conflict is detected (F-9.9). */
  onConflict?: (local: StoredDocument, remote?: { version: string | number }) => void;
}

const MAX_BACKOFF_MS = 5 * 60_000;

/**
 * Flushes the durable outbox to the REST API on demand/reconnect (F-9.6–F-9.8).
 * Idempotent uploads, exponential backoff on transient failure, and a
 * version-guard conflict path (G-2 default). Edits are never lost: a document
 * stays dirty and queued until the server confirms it.
 */
export class SyncEngine {
  private readonly store: LocalStoreAdapter;
  private readonly remote: RemoteSyncAdapter;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly onStatus?: SaveStatusListener;
  private readonly onConflict?: SyncEngineOptions['onConflict'];

  private flushing = false;
  private abortController: AbortController | null = null;

  constructor(options: SyncEngineOptions) {
    this.store = options.store;
    this.remote = options.remote;
    this.maxAttempts = options.maxAttempts ?? 6;
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.onStatus = options.onStatus;
    this.onConflict = options.onConflict;
  }

  private emit(status: SaveStatus, detail?: { error?: string }): void {
    this.onStatus?.(status, detail);
  }

  /**
   * Process every queued document once. Re-entrancy-safe: concurrent calls are
   * coalesced. Returns the number of documents successfully synced.
   */
  async flush(): Promise<number> {
    if (this.flushing) return 0;
    this.flushing = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    let synced = 0;

    try {
      const entries = await this.store.listOutbox();
      if (entries.length === 0) return 0;
      this.emit('syncing');
      const now = Date.now();

      for (const entry of entries) {
        if (signal.aborted) break;
        if (entry.nextAttemptAt && entry.nextAttemptAt > now) continue;

        const record = await this.store.getDocument(entry.id);
        if (!record || !record.dirty || record.rev !== entry.rev) {
          // Stale or already-synced entry; clear it.
          await this.store.dequeue(entry.id);
          continue;
        }

        try {
          const result = await this.remote.save(record, signal);
          // Only clear the dirty flag if no newer local revision arrived meanwhile.
          const latest = await this.store.getDocument(entry.id);
          if (latest && latest.rev === record.rev) {
            await this.store.putDocument({
              ...latest,
              doc: result.doc ?? latest.doc,
              baseVersion: result.version,
              dirty: false,
            });
            await this.store.dequeue(entry.id);
          } else {
            // A newer edit exists; leave it queued under its own rev.
            await this.store.dequeue(entry.id);
          }
          synced++;
        } catch (err) {
          if (err instanceof ConflictError) {
            await this.store.enqueue({
              ...entry,
              attempts: entry.attempts + 1,
              lastError: 'conflict',
              nextAttemptAt: Number.MAX_SAFE_INTEGER, // park until resolved
            });
            this.onConflict?.(record, err.remote);
            this.emit('syncFailed', { error: 'conflict' });
            continue;
          }
          const attempts = entry.attempts + 1;
          const backoff = Math.min(MAX_BACKOFF_MS, this.baseDelayMs * 2 ** entry.attempts);
          await this.store.enqueue({
            ...entry,
            attempts,
            lastError: (err as Error)?.message ?? 'upload failed',
            nextAttemptAt:
              attempts >= this.maxAttempts ? Number.MAX_SAFE_INTEGER : Date.now() + backoff,
          });
          this.emit('syncFailed', { error: (err as Error)?.message });
        }
      }

      const remaining = await this.store.listOutbox();
      this.emit(remaining.length === 0 ? 'synced' : 'savedLocal');
      return synced;
    } finally {
      this.flushing = false;
      this.abortController = null;
    }
  }

  /** Abort an in-flight flush (e.g. on going offline or unmount). */
  cancel(): void {
    this.abortController?.abort();
  }

  /**
   * Re-queue a parked/conflicted document for another attempt (used by a
   * host-defined conflict resolution flow after the user chooses to overwrite).
   */
  async retry(id: string, baseVersion?: string | number | null): Promise<void> {
    const record = await this.store.getDocument(id);
    if (!record) return;
    if (baseVersion !== undefined) {
      await this.store.putDocument({ ...record, baseVersion });
    }
    await this.store.enqueue({
      id,
      rev: record.rev,
      queuedAt: Date.now(),
      attempts: 0,
    });
  }
}
