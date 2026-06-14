/**
 * react-next-editor — public entry point.
 *
 * A comprehensive, configurable, secure, offline-first Word-style rich document
 * editor for React/Next.js, built directly on ProseMirror, with DOCX/PDF/text
 * export.
 *
 * The default entry includes the React component. Import the framework-agnostic
 * core, exporters, or persistence from their subpaths to keep bundles lean:
 *   - `react-next-editor/core`
 *   - `react-next-editor/export`
 *   - `react-next-editor/persistence`
 *
 * The editor is client-only (C-4). In Next.js App Router, load it via:
 *   const Editor = dynamic(
 *     () => import('react-next-editor').then((m) => m.Editor),
 *     { ssr: false },
 *   );
 * and import the stylesheet once: `import 'react-next-editor/styles.css'`.
 */

// React integration (primary surface)
export {
  Editor,
  EditorErrorBoundary,
  EditorContext,
  useEditorContext,
  Toolbar,
  ToolbarButton,
  ToolbarIcon,
  StatusBar,
} from './react/index';
export type {
  EditorProps,
  EditorRef,
  EditorEvents,
  EditorExtensions,
  PersistenceConfig,
  SyncConfig,
  EditorContextValue,
} from './react/types';

// Configuration types & defaults
export type {
  DocumentJSON,
  EditorMode,
  FeatureFlags,
  PageSize,
  PageConfig,
  ThemeTokens,
  ToolbarItemId,
  ToolbarConfig,
  EditorStrings,
  SaveStatus,
} from './config/types';
export {
  DEFAULT_FEATURES,
  DEFAULT_PAGE,
  DEFAULT_STRINGS,
  DEFAULT_TOOLBAR_GROUPS,
  DEFAULT_FONT_FAMILIES,
  DEFAULT_FONT_SIZES,
  DEFAULT_COLOR_PALETTE,
  PAGE_DIMENSIONS_MM,
  resolvePageDimensions,
  themeToCssVars,
} from './config/defaults';

// Core engine (schema, commands, plugins, state) — re-exported for advanced use
export {
  buildSchema,
  defaultSchema,
  createCommands,
  createEditorState,
  createDoc,
  buildPlugins,
  countDocument,
} from './core/index';
export type { CommandSet, EditorCommand } from './core/commands/index';

// Exporters
export {
  documentToText,
  documentToHtml,
  documentToDocxBlob,
  documentToDocxBuffer,
  buildPrintDocument,
  printDocumentToPdf,
  exportDocument,
  downloadBlob,
  downloadText,
} from './export/index';
export type {
  ExportFormat,
  TextConversionOptions,
  DocxExportOptions,
  DocxNodeConverter,
  PdfPrintOptions,
} from './export/index';

// Persistence & sync
export {
  MemoryStore,
  IndexedDBStore,
  requestPersistentStorage,
  DocumentPersistence,
  ConnectivityMonitor,
  SyncEngine,
  ConflictError,
} from './persistence/index';
export type {
  StoredDocument,
  OutboxEntry,
  LocalStoreAdapter,
  RemoteSyncAdapter,
  RemoteSaveResult,
  AssetUploadAdapter,
  SaveStatusListener,
} from './persistence/index';

// Security helpers
export { sanitizeUrl, sanitizeImageSrc, sanitizeHtml } from './security/sanitize';
