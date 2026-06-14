/**
 * Offline-first persistence (§8.5, §8.7). Adapter interfaces plus default
 * IndexedDB and in-memory stores, an autosave manager, connectivity detection
 * and a sync engine. The editor core depends only on the interfaces (F-10.12).
 */
export type {
  StoredDocument,
  OutboxEntry,
  LocalStoreAdapter,
  RemoteSyncAdapter,
  RemoteSaveResult,
  AssetUploadAdapter,
  SaveStatusListener,
} from './types';
export { ConflictError } from './types';
export { MemoryStore } from './memory';
export { IndexedDBStore, requestPersistentStorage } from './indexeddb';
export { DocumentPersistence, type DocumentPersistenceOptions } from './autosave';
export { ConnectivityMonitor, type ConnectivityOptions } from '../sync/connectivity';
export { SyncEngine, type SyncEngineOptions } from '../sync/engine';
