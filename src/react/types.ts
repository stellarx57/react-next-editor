import type { Command, EditorState, Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Schema } from 'prosemirror-model';
import type {
  DocumentJSON,
  EditorMode,
  EditorStrings,
  FeatureFlags,
  PageConfig,
  SaveStatus,
  ThemeTokens,
  ToolbarConfig,
} from '../config/types';
import type { CommandSet } from '../core/commands/index';
import type { DocxNodeConverter, TextConversionOptions } from '../export/index';
import type { LocalStoreAdapter, RemoteSyncAdapter, StoredDocument } from '../persistence/types';

/** Imperative handle exposed via `ref` (F-10.15, F-10.16). */
export interface EditorRef {
  /** The current document as ProseMirror JSON (F-8.1). */
  getJSON(): DocumentJSON;
  /** The document as plain text (F-6.18). */
  getText(options?: TextConversionOptions): string;
  /** The document as an HTML fragment. */
  getHTML(): string;
  /** Replace the document content. */
  setContent(content: DocumentJSON | string | null): void;
  /**
   * Import an external `.docx` file, replacing the current content (best-effort,
   * F-7.2). Requires the optional `mammoth` dependency. Returns conversion
   * warnings. The change is undoable and triggers `onChange`/autosave.
   */
  importDocx(file: ArrayBuffer | Uint8Array | Blob): Promise<{ warnings: string[] }>;
  /** Focus the editing surface. */
  focus(): void;
  /** Whether the document has unsynced local changes. */
  isDirty(): boolean;
  /** Force an immediate local save (flush autosave). */
  save(): Promise<void>;
  /** Purge this document's locally-persisted data (F-12.7). */
  clearLocalData(): Promise<void>;
  /** Trigger an interactive export + download/print. */
  exportAs(format: 'docx' | 'pdf' | 'txt' | 'html', filename?: string): Promise<void>;
  /** Escape hatch: the underlying ProseMirror view (F-10.16). */
  getView(): EditorView | null;
  /** Escape hatch: the current editor state. */
  getState(): EditorState | null;
  /** The schema in use. */
  getSchema(): Schema | null;
}

/** Lifecycle/state events (F-10.15). */
export interface EditorEvents {
  /** Fired once the view is mounted and ready. */
  onReady?: (ref: EditorRef) => void;
  /** Fired on every document change with the new JSON. */
  onChange?: (json: DocumentJSON, ref: EditorRef) => void;
  /** Fired when the selection changes. */
  onSelectionChange?: (state: EditorState) => void;
  /** Fired when the local-save / sync status changes (F-9.4). */
  onSaveStatusChange?: (status: SaveStatus, detail?: { error?: string }) => void;
  /** Fired when the editor or a feature throws; contained by the error boundary. */
  onError?: (error: Error) => void;
}

/** Extension hooks (F-10.13, F-10.14). */
export interface EditorExtensions {
  /** Extra ProseMirror plugins appended to the stack. */
  plugins?: Plugin[];
  /** Custom DOCX node converters keyed by node type (F-6.16). */
  docxNodeConverters?: Record<string, DocxNodeConverter>;
}

/**
 * Synchronization configuration (F-9.6–F-9.9, F-9.14). When provided alongside
 * a persisted `documentId`, the editor owns a connectivity monitor and a sync
 * engine: offline edits queue in the durable outbox and upload automatically on
 * reconnect, with no user action. Surfaces status through `onSaveStatusChange`.
 */
export interface SyncConfig {
  /** REST adapter that persists the document JSON to your API (F-9.7). */
  remote: RemoteSyncAdapter;
  /** Auto-flush the outbox on reconnect and after each local save. Default true. */
  auto?: boolean;
  /** Connectivity ping interval in ms (default 30000). */
  pingIntervalMs?: number;
  /** Max upload attempts before a document is parked for manual retry (default 6). */
  maxAttempts?: number;
  /** Invoked when a version conflict is detected (F-9.9). */
  onConflict?: (local: StoredDocument, remote?: { version: string | number }) => void;
}

/** Local persistence configuration (F-8.x, F-9.2). */
export interface PersistenceConfig {
  /** Enable durable local autosave. Default true when a documentId is given. */
  enabled?: boolean;
  /** Injected store adapter; defaults to the built-in IndexedDB store. */
  store?: LocalStoreAdapter;
  /** Autosave debounce in ms (default 800). */
  debounceMs?: number;
  /** Request persistent storage on mount (F-9.11). Default true. */
  requestPersistent?: boolean;
}

/**
 * The single, documented configuration object for the editor (F-10.1). Every
 * field is optional; sensible defaults apply (resolveConfig). Integration points
 * are explicit props/callbacks — no host-app internals are referenced (F-10.11).
 */
export interface EditorProps extends EditorEvents {
  /** Stable id used for local persistence and sync. */
  documentId?: string;
  /** Initial content for uncontrolled usage. */
  initialContent?: DocumentJSON | string | null;
  /** Controlled value (with `onChange`) for controlled usage (F-10.20). */
  value?: DocumentJSON | null;
  /** Editing mode (F-10.3). `readOnly` is a convenience alias. */
  mode?: EditorMode;
  readOnly?: boolean;
  /** Placeholder text for an empty document (F-4.7). */
  placeholder?: string;
  /** Per-feature toggles (F-10.2). */
  features?: Partial<FeatureFlags>;
  /** Page geometry (F-5.1, F-5.2). */
  page?: Partial<PageConfig>;
  /** Toolbar layout/customization (F-10.6), or false to hide. */
  toolbar?: ToolbarConfig | false;
  /** Show the word/character status bar. Default true. */
  statusBar?: boolean;
  /** Theme tokens (F-10.5). */
  theme?: ThemeTokens;
  /** Localized UI strings (F-10.8). */
  strings?: Partial<EditorStrings>;
  /** Font families offered in the font picker. */
  fontFamilies?: string[];
  /** Font sizes (pt) offered in the size picker. */
  fontSizes?: number[];
  /** Color palette for the color/highlight pickers. */
  colorPalette?: string[];
  /** Extension hooks (F-10.13). */
  extensions?: EditorExtensions;
  /** Local persistence configuration. */
  persistence?: PersistenceConfig;
  /** Synchronization to a REST API (offline edits auto-upload on reconnect). */
  sync?: SyncConfig;
  /** Per-document metadata stored alongside the content. */
  metadata?: Record<string, unknown>;
  /** Root element class and inline style (theming/layout). */
  className?: string;
  style?: React.CSSProperties;
  /** Accessible label for the editing region (NF-4). */
  ariaLabel?: string;
  /** Text direction for the document (NF-6, RTL awareness). Default 'ltr'. */
  dir?: 'ltr' | 'rtl' | 'auto';
}

/** Value provided through {@link EditorContext} to toolbar and children. */
export interface EditorContextValue {
  view: EditorView | null;
  state: EditorState | null;
  schema: Schema;
  commands: CommandSet;
  strings: EditorStrings;
  features: FeatureFlags;
  fontFamilies: string[];
  fontSizes: number[];
  colorPalette: string[];
  editable: boolean;
  /** Run a ProseMirror command against the live view and refocus. */
  run: (command: Command) => boolean;
  /** Import a `.docx` file, replacing content (best-effort). */
  importDocx: (file: ArrayBuffer | Uint8Array | Blob) => Promise<{ warnings: string[] }>;
}
