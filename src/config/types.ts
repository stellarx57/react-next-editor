/**
 * Public configuration types for the editor.
 *
 * The entire editor is driven by a single, documented configuration object
 * (F-10.1). Every field is optional; sensible defaults are applied by
 * {@link resolveConfig}. Feature flags (F-10.2), page setup, theming (F-10.5),
 * localized strings (F-10.8) and injectable adapters (F-10.12) are all expressed
 * here so an integration can enable only what it needs without forking.
 */

/** ProseMirror document JSON. Kept structural so consumers don't import PM types. */
export type DocumentJSON = {
  type: string;
  content?: DocumentJSON[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
};

/** The editing surface mode (F-10.3). `comment`/`suggest` are reserved for future use. */
export type EditorMode = 'edit' | 'readonly';

/**
 * Individually toggleable features (F-10.2). Omitted flags fall back to
 * {@link DEFAULT_FEATURES}. Disabling a feature removes its schema nodes/marks,
 * commands, input rules and toolbar items together.
 */
export interface FeatureFlags {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  superscript: boolean;
  subscript: boolean;
  code: boolean;
  fontFamily: boolean;
  fontSize: boolean;
  textColor: boolean;
  highlight: boolean;
  clearFormatting: boolean;
  headings: boolean;
  alignment: boolean;
  lineSpacing: boolean;
  indentation: boolean;
  bulletList: boolean;
  orderedList: boolean;
  taskList: boolean;
  blockquote: boolean;
  horizontalRule: boolean;
  table: boolean;
  image: boolean;
  link: boolean;
  pageBreak: boolean;
  history: boolean;
  wordCount: boolean;
  docxImport: boolean;
}

/** Standard page sizes plus a custom escape hatch. */
export type PageSize = 'A4' | 'Letter' | 'Legal' | 'A5' | 'custom';

/** Page geometry, in millimetres unless `size` is `custom` with explicit dimensions. */
export interface PageConfig {
  size: PageSize;
  /** Used only when `size === 'custom'`. Width in mm. */
  widthMm?: number;
  /** Used only when `size === 'custom'`. Height in mm. */
  heightMm?: number;
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  /** Show the page as a white sheet on a canvas background (single-flow model). */
  showPageChrome: boolean;
}

/**
 * Design tokens exposed as CSS custom properties (F-10.5). Any subset can be
 * supplied; unspecified tokens inherit the stylesheet defaults. Consumers theme
 * the editor without editing component source.
 */
export interface ThemeTokens {
  fontFamily?: string;
  fontSize?: string;
  textColor?: string;
  background?: string;
  canvasBackground?: string;
  pageBackground?: string;
  accent?: string;
  toolbarBackground?: string;
  toolbarColor?: string;
  toolbarActiveBackground?: string;
  borderColor?: string;
  borderRadius?: string;
  selectionColor?: string;
}

/** Built-in toolbar item identifiers. Consumers may also register custom items. */
export type ToolbarItemId =
  | 'undo'
  | 'redo'
  | 'separator'
  | 'paragraphStyle'
  | 'fontFamily'
  | 'fontSize'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'superscript'
  | 'subscript'
  | 'code'
  | 'textColor'
  | 'highlight'
  | 'clearFormatting'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'alignJustify'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'indent'
  | 'outdent'
  | 'blockquote'
  | 'horizontalRule'
  | 'link'
  | 'image'
  | 'table'
  | 'pageBreak'
  | 'importDocx';

/**
 * Toolbar configuration (F-10.6). `groups` defines ordered groups of item ids;
 * built-in items can be reordered, removed, or replaced and custom items added.
 */
export interface ToolbarConfig {
  /** When false the toolbar is not rendered at all. */
  enabled?: boolean;
  /**
   * Ordered groups of toolbar items. Each entry is an array of item ids; groups
   * are visually separated. If omitted, a sensible default layout is used,
   * filtered by the enabled {@link FeatureFlags}.
   */
  groups?: ToolbarItemId[][];
  /** Sticky-position the toolbar at the top of the editor. Default true. */
  sticky?: boolean;
}

/** Injectable, localizable UI strings (F-10.8, NF-6). */
export interface EditorStrings {
  bold: string;
  italic: string;
  underline: string;
  strikethrough: string;
  superscript: string;
  subscript: string;
  code: string;
  textColor: string;
  highlight: string;
  clearFormatting: string;
  fontFamily: string;
  fontSize: string;
  paragraphStyle: string;
  paragraph: string;
  heading: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  alignJustify: string;
  bulletList: string;
  orderedList: string;
  taskList: string;
  indent: string;
  outdent: string;
  blockquote: string;
  horizontalRule: string;
  link: string;
  linkPrompt: string;
  removeLink: string;
  image: string;
  imagePrompt: string;
  imageAltPrompt: string;
  table: string;
  insertTable: string;
  addRowBefore: string;
  addRowAfter: string;
  deleteRow: string;
  addColumnBefore: string;
  addColumnAfter: string;
  deleteColumn: string;
  mergeCells: string;
  splitCell: string;
  deleteTable: string;
  pageBreak: string;
  importDocx: string;
  undo: string;
  redo: string;
  words: string;
  characters: string;
  readOnly: string;
}

/** Sync/save status surfaced to the host (F-9.4, NF-10). */
export type SaveStatus =
  | 'idle'
  | 'savingLocal'
  | 'savedLocal'
  | 'syncing'
  | 'synced'
  | 'syncFailed'
  | 'offline';
