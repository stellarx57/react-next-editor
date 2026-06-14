import { D as DocumentJSON, S as SaveStatus } from '../types--ae1gYNt.js';

/**
 * Persistence and sync adapter interfaces (F-10.12). The editor core knows
 * nothing about REST or IndexedDB; consumers inject implementations of these
 * interfaces so the same editor works against any backend/storage. Default
 * IndexedDB and in-memory implementations ship with the package.
 */
/** A stored document record: canonical JSON plus sync metadata. */
interface StoredDocument {
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
interface OutboxEntry {
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
interface LocalStoreAdapter {
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
interface RemoteSaveResult {
    version: string | number;
    /** Optional canonical document returned by the server (e.g. rewritten asset URLs). */
    doc?: DocumentJSON;
}
/** Raised by a {@link RemoteSyncAdapter} when a stale write is rejected (F-9.9). */
declare class ConflictError extends Error {
    readonly remote?: {
        version: string | number;
        doc?: DocumentJSON;
    } | undefined;
    constructor(message: string, remote?: {
        version: string | number;
        doc?: DocumentJSON;
    } | undefined);
}
/**
 * Remote document API (F-9.6, F-9.7). Injected by the host using its own auth
 * (F-12.4). Implementations MUST use HTTPS (F-12.3) and SHOULD be idempotent
 * (NF-10). On a version conflict, throw {@link ConflictError}.
 */
interface RemoteSyncAdapter {
    /** Create or update the document on the server; returns the new version. */
    save(record: StoredDocument, signal?: AbortSignal): Promise<RemoteSaveResult>;
    /** Fetch the latest server copy, or null if it does not exist. */
    fetch?(id: string, signal?: AbortSignal): Promise<StoredDocument | null>;
    /** Best-effort reachability check used for connectivity confirmation (§8.7). */
    ping?(signal?: AbortSignal): Promise<boolean>;
}
/** Uploads offline-inserted assets and returns canonical URLs (F-9.10, F-12.5). */
interface AssetUploadAdapter {
    upload(blob: Blob, meta: {
        filename?: string;
        mime: string;
    }): Promise<{
        url: string;
    }>;
}
/** Listener for save/sync status transitions (F-9.4, F-10.15). */
type SaveStatusListener = (status: SaveStatus, detail?: {
    error?: string;
}) => void;

/**
 * In-memory {@link LocalStoreAdapter}. Used as an SSR-safe fallback when
 * IndexedDB is unavailable and as a test double. Not durable across reloads.
 */
declare class MemoryStore implements LocalStoreAdapter {
    private docs;
    private outbox;
    private assets;
    getDocument(id: string): Promise<StoredDocument | null>;
    putDocument(record: StoredDocument): Promise<void>;
    deleteDocument(id: string): Promise<void>;
    listDocuments(): Promise<StoredDocument[]>;
    enqueue(entry: OutboxEntry): Promise<void>;
    dequeue(id: string): Promise<void>;
    listOutbox(): Promise<OutboxEntry[]>;
    putAsset(key: string, blob: Blob): Promise<void>;
    getAsset(key: string): Promise<Blob | null>;
    deleteAsset(key: string): Promise<void>;
    clear(): Promise<void>;
}

/**
 * Durable {@link LocalStoreAdapter} backed by IndexedDB (§8.7). `localStorage`
 * is explicitly rejected (too small, synchronous, string-only). Falls back to an
 * in-memory store when IndexedDB is unavailable (SSR, private mode) so the
 * editor never crashes (F-11.1).
 */
declare class IndexedDBStore implements LocalStoreAdapter {
    private dbName;
    private dbPromise;
    private fallback;
    constructor(dbName?: string);
    /** Whether IndexedDB is usable in the current environment. */
    static isSupported(): boolean;
    private db;
    getDocument(id: string): Promise<StoredDocument | null>;
    putDocument(record: StoredDocument): Promise<void>;
    deleteDocument(id: string): Promise<void>;
    listDocuments(): Promise<StoredDocument[]>;
    enqueue(entry: OutboxEntry): Promise<void>;
    dequeue(id: string): Promise<void>;
    listOutbox(): Promise<OutboxEntry[]>;
    putAsset(key: string, blob: Blob): Promise<void>;
    getAsset(key: string): Promise<Blob | null>;
    deleteAsset(key: string): Promise<void>;
    clear(): Promise<void>;
}
/**
 * Request persistent storage to reduce eviction risk for unsynced data (F-9.11).
 * Resolves to whether persistence was granted; never throws.
 */
declare function requestPersistentStorage(): Promise<boolean>;

interface DocumentPersistenceOptions {
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
declare class DocumentPersistence {
    private readonly id;
    private readonly store;
    private readonly debounceMs;
    private readonly onStatus?;
    private metadata?;
    private current;
    private timer;
    private pending;
    private destroyed;
    private writing;
    constructor(options: DocumentPersistenceOptions);
    private emit;
    /** Load the latest locally-persisted document (crash/reload recovery, F-11.9). */
    load(): Promise<StoredDocument | null>;
    /** The current stored record, if loaded/saved. */
    getRecord(): StoredDocument | null;
    /** Whether there are unsynced local changes. */
    isDirty(): boolean;
    /** Schedule a debounced save of the latest document JSON (F-4.8). */
    scheduleSave(doc: DocumentJSON): void;
    /** Immediately persist any pending document (e.g. on blur/unmount). */
    flush(): Promise<void>;
    /**
     * Persist a document to the local store, atomically bump the revision, mark it
     * dirty and enqueue it in the outbox for later upload. Writes are serialized to
     * avoid partial saves (NF-9).
     */
    saveNow(doc: DocumentJSON): Promise<StoredDocument>;
    private makeRecord;
    /** Mark the document as synced after a successful remote save (NF-10). */
    markSynced(version: string | number, serverDoc?: DocumentJSON): Promise<void>;
    /** Purge this document's locally-persisted data and outbox entry (F-12.7). */
    clearLocal(): Promise<void>;
    /** Stop the autosave timer and flush pending work. */
    destroy(): Promise<void>;
}

/**
 * Connectivity detection (§8.7). Listens to `online`/`offline` events but does
 * NOT trust `navigator.onLine` alone (it reports interface presence, not API
 * reachability); when a `ping` is provided, real reachability is confirmed
 * before reporting "online". Safe to construct in any environment.
 */
interface ConnectivityOptions {
    /** Confirms real API reachability (e.g. a HEAD to the data API). */
    ping?: (signal?: AbortSignal) => Promise<boolean>;
    /** Polling interval in ms while running (default 30s). 0 disables polling. */
    intervalMs?: number;
    onChange?: (online: boolean) => void;
}
declare class ConnectivityMonitor {
    private readonly ping?;
    private readonly intervalMs;
    private readonly onChange?;
    private online;
    private timer;
    private started;
    constructor(options?: ConnectivityOptions);
    isOnline(): boolean;
    private readonly handleOnline;
    private readonly handleOffline;
    start(): void;
    stop(): void;
    /** Re-evaluate connectivity now, confirming reachability via ping when set. */
    check(): Promise<boolean>;
    private set;
}

interface SyncEngineOptions {
    store: LocalStoreAdapter;
    remote: RemoteSyncAdapter;
    /** Max upload attempts before a document is parked for manual retry (default 6). */
    maxAttempts?: number;
    /** Base backoff delay in ms (default 1000). Doubles per attempt, capped at 5min. */
    baseDelayMs?: number;
    onStatus?: SaveStatusListener;
    /** Invoked when a version conflict is detected (F-9.9). */
    onConflict?: (local: StoredDocument, remote?: {
        version: string | number;
    }) => void;
}
/**
 * Flushes the durable outbox to the REST API on demand/reconnect (F-9.6–F-9.8).
 * Idempotent uploads, exponential backoff on transient failure, and a
 * version-guard conflict path (G-2 default). Edits are never lost: a document
 * stays dirty and queued until the server confirms it.
 */
declare class SyncEngine {
    private readonly store;
    private readonly remote;
    private readonly maxAttempts;
    private readonly baseDelayMs;
    private readonly onStatus?;
    private readonly onConflict?;
    private flushing;
    private abortController;
    constructor(options: SyncEngineOptions);
    private emit;
    /**
     * Process every queued document once. Re-entrancy-safe: concurrent calls are
     * coalesced. Returns the number of documents successfully synced.
     */
    flush(): Promise<number>;
    /** Abort an in-flight flush (e.g. on going offline or unmount). */
    cancel(): void;
    /**
     * Re-queue a parked/conflicted document for another attempt (used by a
     * host-defined conflict resolution flow after the user chooses to overwrite).
     */
    retry(id: string, baseVersion?: string | number | null): Promise<void>;
}

export { type AssetUploadAdapter, ConflictError, ConnectivityMonitor, type ConnectivityOptions, DocumentPersistence, type DocumentPersistenceOptions, IndexedDBStore, type LocalStoreAdapter, MemoryStore, type OutboxEntry, type RemoteSaveResult, type RemoteSyncAdapter, type SaveStatusListener, type StoredDocument, SyncEngine, type SyncEngineOptions, requestPersistentStorage };
