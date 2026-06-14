import { openDB } from 'idb';

// src/persistence/types.ts
var ConflictError = class extends Error {
  constructor(message, remote) {
    super(message);
    this.remote = remote;
    this.name = "ConflictError";
  }
};

// src/persistence/memory.ts
var MemoryStore = class {
  constructor() {
    this.docs = /* @__PURE__ */ new Map();
    this.outbox = /* @__PURE__ */ new Map();
    this.assets = /* @__PURE__ */ new Map();
  }
  async getDocument(id) {
    return this.docs.get(id) ?? null;
  }
  async putDocument(record) {
    this.docs.set(record.id, structuredCloneSafe(record));
  }
  async deleteDocument(id) {
    this.docs.delete(id);
  }
  async listDocuments() {
    return [...this.docs.values()];
  }
  async enqueue(entry) {
    this.outbox.set(entry.id, { ...entry });
  }
  async dequeue(id) {
    this.outbox.delete(id);
  }
  async listOutbox() {
    return [...this.outbox.values()];
  }
  async putAsset(key, blob) {
    this.assets.set(key, blob);
  }
  async getAsset(key) {
    return this.assets.get(key) ?? null;
  }
  async deleteAsset(key) {
    this.assets.delete(key);
  }
  async clear() {
    this.docs.clear();
    this.outbox.clear();
    this.assets.clear();
  }
};
function structuredCloneSafe(value) {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
    }
  }
  return JSON.parse(JSON.stringify(value));
}
var DB_VERSION = 1;
var STORE_DOCS = "documents";
var STORE_OUTBOX = "outbox";
var STORE_ASSETS = "assets";
var IndexedDBStore = class _IndexedDBStore {
  constructor(dbName = "react-next-editor") {
    this.dbPromise = null;
    this.fallback = null;
    this.dbName = dbName;
  }
  /** Whether IndexedDB is usable in the current environment. */
  static isSupported() {
    return typeof indexedDB !== "undefined";
  }
  async db() {
    if (!_IndexedDBStore.isSupported()) {
      if (!this.fallback) this.fallback = new MemoryStore();
      return null;
    }
    if (!this.dbPromise) {
      this.dbPromise = openDB(this.dbName, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_DOCS)) {
            db.createObjectStore(STORE_DOCS, { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
            db.createObjectStore(STORE_OUTBOX, { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains(STORE_ASSETS)) {
            db.createObjectStore(STORE_ASSETS);
          }
        }
      }).catch((err) => {
        console.error("[react-next-editor] IndexedDB unavailable, using memory store.", err);
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
  async getDocument(id) {
    const db = await this.db();
    if (!db) return this.fallback.getDocument(id);
    return await db.get(STORE_DOCS, id) ?? null;
  }
  async putDocument(record) {
    const db = await this.db();
    if (!db) return this.fallback.putDocument(record);
    await db.put(STORE_DOCS, record);
  }
  async deleteDocument(id) {
    const db = await this.db();
    if (!db) return this.fallback.deleteDocument(id);
    await db.delete(STORE_DOCS, id);
  }
  async listDocuments() {
    const db = await this.db();
    if (!db) return this.fallback.listDocuments();
    return db.getAll(STORE_DOCS);
  }
  async enqueue(entry) {
    const db = await this.db();
    if (!db) return this.fallback.enqueue(entry);
    await db.put(STORE_OUTBOX, entry);
  }
  async dequeue(id) {
    const db = await this.db();
    if (!db) return this.fallback.dequeue(id);
    await db.delete(STORE_OUTBOX, id);
  }
  async listOutbox() {
    const db = await this.db();
    if (!db) return this.fallback.listOutbox();
    return db.getAll(STORE_OUTBOX);
  }
  async putAsset(key, blob) {
    const db = await this.db();
    if (!db) return this.fallback.putAsset(key, blob);
    await db.put(STORE_ASSETS, blob, key);
  }
  async getAsset(key) {
    const db = await this.db();
    if (!db) return this.fallback.getAsset(key);
    return await db.get(STORE_ASSETS, key) ?? null;
  }
  async deleteAsset(key) {
    const db = await this.db();
    if (!db) return this.fallback.deleteAsset(key);
    await db.delete(STORE_ASSETS, key);
  }
  async clear() {
    const db = await this.db();
    if (!db) return this.fallback.clear();
    await Promise.all([
      db.clear(STORE_DOCS),
      db.clear(STORE_OUTBOX),
      db.clear(STORE_ASSETS)
    ]);
  }
};
async function requestPersistentStorage() {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
  }
  return false;
}

// src/persistence/autosave.ts
var DocumentPersistence = class {
  constructor(options) {
    this.current = null;
    this.timer = null;
    this.pending = null;
    this.destroyed = false;
    this.writing = false;
    this.id = options.documentId;
    this.store = options.store;
    this.debounceMs = options.debounceMs ?? 800;
    this.onStatus = options.onStatus;
    this.metadata = options.metadata;
  }
  emit(status, detail) {
    this.onStatus?.(status, detail);
  }
  /** Load the latest locally-persisted document (crash/reload recovery, F-11.9). */
  async load() {
    const record = await this.store.getDocument(this.id);
    this.current = record;
    return record;
  }
  /** The current stored record, if loaded/saved. */
  getRecord() {
    return this.current;
  }
  /** Whether there are unsynced local changes. */
  isDirty() {
    return this.current?.dirty ?? false;
  }
  /** Schedule a debounced save of the latest document JSON (F-4.8). */
  scheduleSave(doc) {
    if (this.destroyed) return;
    this.pending = doc;
    this.emit("savingLocal");
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, this.debounceMs);
  }
  /** Immediately persist any pending document (e.g. on blur/unmount). */
  async flush() {
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
  async saveNow(doc) {
    if (this.writing) {
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
        attempts: 0
      });
      this.current = record;
      this.emit("savedLocal");
      return record;
    } catch (err) {
      this.emit("syncFailed", { error: err?.message });
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
  makeRecord(doc) {
    const prev = this.current;
    return {
      id: this.id,
      doc,
      rev: (prev?.rev ?? 0) + 1,
      baseVersion: prev?.baseVersion ?? null,
      dirty: true,
      updatedAt: Date.now(),
      metadata: this.metadata ?? prev?.metadata
    };
  }
  /** Mark the document as synced after a successful remote save (NF-10). */
  async markSynced(version, serverDoc) {
    if (!this.current) return;
    const record = {
      ...this.current,
      doc: serverDoc ?? this.current.doc,
      baseVersion: version,
      dirty: false
    };
    await this.store.putDocument(record);
    await this.store.dequeue(this.id);
    this.current = record;
    this.emit("synced");
  }
  /** Purge this document's locally-persisted data and outbox entry (F-12.7). */
  async clearLocal() {
    await this.store.deleteDocument(this.id);
    await this.store.dequeue(this.id);
    this.current = null;
  }
  /** Stop the autosave timer and flush pending work. */
  async destroy() {
    this.destroyed = true;
    await this.flush();
  }
};

// src/sync/connectivity.ts
var ConnectivityMonitor = class {
  constructor(options = {}) {
    this.timer = null;
    this.started = false;
    this.handleOnline = () => void this.check();
    this.handleOffline = () => this.set(false);
    this.ping = options.ping;
    this.intervalMs = options.intervalMs ?? 3e4;
    this.onChange = options.onChange;
    this.online = typeof navigator !== "undefined" ? navigator.onLine : true;
  }
  isOnline() {
    return this.online;
  }
  start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    if (this.intervalMs > 0) {
      this.timer = setInterval(() => void this.check(), this.intervalMs);
    }
    void this.check();
  }
  stop() {
    if (!this.started || typeof window === "undefined") return;
    this.started = false;
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  /** Re-evaluate connectivity now, confirming reachability via ping when set. */
  async check() {
    const navOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!navOnline) {
      this.set(false);
      return false;
    }
    if (!this.ping) {
      this.set(true);
      return true;
    }
    try {
      const reachable = await this.ping();
      this.set(reachable);
      return reachable;
    } catch {
      this.set(false);
      return false;
    }
  }
  set(online) {
    if (online !== this.online) {
      this.online = online;
      this.onChange?.(online);
    }
  }
};

// src/sync/engine.ts
var MAX_BACKOFF_MS = 5 * 6e4;
var SyncEngine = class {
  constructor(options) {
    this.flushing = false;
    this.abortController = null;
    this.store = options.store;
    this.remote = options.remote;
    this.maxAttempts = options.maxAttempts ?? 6;
    this.baseDelayMs = options.baseDelayMs ?? 1e3;
    this.onStatus = options.onStatus;
    this.onConflict = options.onConflict;
  }
  emit(status, detail) {
    this.onStatus?.(status, detail);
  }
  /**
   * Process every queued document once. Re-entrancy-safe: concurrent calls are
   * coalesced. Returns the number of documents successfully synced.
   */
  async flush() {
    if (this.flushing) return 0;
    this.flushing = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    let synced = 0;
    try {
      const entries = await this.store.listOutbox();
      if (entries.length === 0) return 0;
      this.emit("syncing");
      const now = Date.now();
      for (const entry of entries) {
        if (signal.aborted) break;
        if (entry.nextAttemptAt && entry.nextAttemptAt > now) continue;
        const record = await this.store.getDocument(entry.id);
        if (!record || !record.dirty || record.rev !== entry.rev) {
          await this.store.dequeue(entry.id);
          continue;
        }
        try {
          const result = await this.remote.save(record, signal);
          const latest = await this.store.getDocument(entry.id);
          if (latest && latest.rev === record.rev) {
            await this.store.putDocument({
              ...latest,
              doc: result.doc ?? latest.doc,
              baseVersion: result.version,
              dirty: false
            });
            await this.store.dequeue(entry.id);
          } else {
            await this.store.dequeue(entry.id);
          }
          synced++;
        } catch (err) {
          if (err instanceof ConflictError) {
            await this.store.enqueue({
              ...entry,
              attempts: entry.attempts + 1,
              lastError: "conflict",
              nextAttemptAt: Number.MAX_SAFE_INTEGER
              // park until resolved
            });
            this.onConflict?.(record, err.remote);
            this.emit("syncFailed", { error: "conflict" });
            continue;
          }
          const attempts = entry.attempts + 1;
          const backoff = Math.min(MAX_BACKOFF_MS, this.baseDelayMs * 2 ** entry.attempts);
          await this.store.enqueue({
            ...entry,
            attempts,
            lastError: err?.message ?? "upload failed",
            nextAttemptAt: attempts >= this.maxAttempts ? Number.MAX_SAFE_INTEGER : Date.now() + backoff
          });
          this.emit("syncFailed", { error: err?.message });
        }
      }
      const remaining = await this.store.listOutbox();
      this.emit(remaining.length === 0 ? "synced" : "savedLocal");
      return synced;
    } finally {
      this.flushing = false;
      this.abortController = null;
    }
  }
  /** Abort an in-flight flush (e.g. on going offline or unmount). */
  cancel() {
    this.abortController?.abort();
  }
  /**
   * Re-queue a parked/conflicted document for another attempt (used by a
   * host-defined conflict resolution flow after the user chooses to overwrite).
   */
  async retry(id, baseVersion) {
    const record = await this.store.getDocument(id);
    if (!record) return;
    if (baseVersion !== void 0) {
      await this.store.putDocument({ ...record, baseVersion });
    }
    await this.store.enqueue({
      id,
      rev: record.rev,
      queuedAt: Date.now(),
      attempts: 0
    });
  }
};

export { ConflictError, ConnectivityMonitor, DocumentPersistence, IndexedDBStore, MemoryStore, SyncEngine, requestPersistentStorage };
//# sourceMappingURL=chunk-WSWRQZS3.js.map
//# sourceMappingURL=chunk-WSWRQZS3.js.map