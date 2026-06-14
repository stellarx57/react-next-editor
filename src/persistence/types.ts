import type { DocumentJSON, SaveStatus } from '../config/types';

/**
 * Persistence and sync adapter interfaces (F-10.12). The editor core knows
 * nothing about REST or IndexedDB; consumers inject implementations of these
 * interfaces so the same editor works against any backend/storage. Default
 * IndexedDB and in-memory implementations ship with the package.
 */

/** A stored document record: canonical JSON plus sync metadata. */
export interface StoredDocument {
  id: string;
  /** Canonical ProseMirror document JSON (F-8.1, C-5). */
  doc: DocumentJSON;
  /** Monotonic local revision, bumped on every local save. */
  rev: number;
  /** Server-acknowledged version, for optimistic-concurrency conflict checks. */
  baseVersion?: string | number | null;
  /** Whether the record has unsynced local changes. */
  dirty: boolean;
  updatedAt: number;
  /** Arbitrary per-document metadata supplied by the host. */
  metadata?: Record<string, unknown>;
}

/** An entry in the durable outbox of documents awaiting upload (F-9.5). */
export interface OutboxEntry {
  id: string;
  rev: number;
  queuedAt: number;
  attempts: number;
  lastError?: string | null;
  nextAttemptAt?: number;
}

/**
 * Local, durable document store (F-9.2, NF-9). The default implementation uses
 * IndexedDB; an in-memory implementation is provided for SSR/tests.
 */
export interface LocalStoreAdapter {
  getDocument(id: string): Promise<StoredDocument | null>;
  putDocument(record: StoredDocument): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  listDocuments(): Promise<StoredDocument[]>;

  /** Outbox operations for the sync engine. */
  enqueue(entry: OutboxEntry): Promise<void>;
  dequeue(id: string): Promise<void>;
  listOutbox(): Promise<OutboxEntry[]>;

  /** Binary asset (offline image) operations (F-9.10). */
  putAsset?(key: string, blob: Blob): Promise<void>;
  getAsset?(key: string): Promise<Blob | null>;
  deleteAsset?(key: string): Promise<void>;

  /** Purge all locally persisted data (F-12.7). */
  clear(): Promise<void>;
}

/** Result of a remote save, carrying the new server version (NF-10). */
export interface RemoteSaveResult {
  version: string | number;
  /** Optional canonical document returned by the server (e.g. rewritten asset URLs). */
  doc?: DocumentJSON;
}

/** Raised by a {@link RemoteSyncAdapter} when a stale write is rejected (F-9.9). */
export class ConflictError extends Error {
  constructor(
    message: string,
    public readonly remote?: { version: string | number; doc?: DocumentJSON },
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

/**
 * Remote document API (F-9.6, F-9.7). Injected by the host using its own auth
 * (F-12.4). Implementations MUST use HTTPS (F-12.3) and SHOULD be idempotent
 * (NF-10). On a version conflict, throw {@link ConflictError}.
 */
export interface RemoteSyncAdapter {
  /** Create or update the document on the server; returns the new version. */
  save(record: StoredDocument, signal?: AbortSignal): Promise<RemoteSaveResult>;
  /** Fetch the latest server copy, or null if it does not exist. */
  fetch?(id: string, signal?: AbortSignal): Promise<StoredDocument | null>;
  /** Best-effort reachability check used for connectivity confirmation (§8.7). */
  ping?(signal?: AbortSignal): Promise<boolean>;
}

/** Uploads offline-inserted assets and returns canonical URLs (F-9.10, F-12.5). */
export interface AssetUploadAdapter {
  upload(blob: Blob, meta: { filename?: string; mime: string }): Promise<{ url: string }>;
}

/** Listener for save/sync status transitions (F-9.4, F-10.15). */
export type SaveStatusListener = (status: SaveStatus, detail?: { error?: string }) => void;
