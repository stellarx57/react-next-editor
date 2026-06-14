import { Schema, Node, MarkType, Attrs, NodeType } from 'prosemirror-model';
import { F as FeatureFlags, D as DocumentJSON, P as PageConfig, a as EditorStrings, d as ToolbarItemId, b as PageSize, T as ThemeTokens } from './types-D1QUFKtw.js';
import * as prosemirror_state from 'prosemirror-state';
import { Command, EditorState, Plugin, Transaction } from 'prosemirror-state';

/**
 * Build a ProseMirror {@link Schema} from a set of enabled features. The schema
 * is the backbone of the editor (NF-7): nodes/marks, commands, persistence and
 * the serializers all derive from it. Disabled features are omitted so an
 * invalid or unsupported document is structurally impossible (F-11.5).
 *
 * Core nodes (`doc`, `paragraph`, `text`, `hard_break`) are always present.
 */
declare function buildSchema(features?: Partial<FeatureFlags>): Schema;
/** A schema with all features enabled — convenient for tests and full editors. */
declare const defaultSchema: Schema;

/** Permitted text-alignment values. `null` means "inherit / default (left in LTR)". */
type TextAlign = 'left' | 'center' | 'right' | 'justify' | null;
/** Maximum indent levels, to bound the document and prevent runaway nesting. */
declare const MAX_INDENT = 12;
/** Indent step in em units, applied as `margin-left`. */
declare const INDENT_STEP_EM = 3;
/**
 * Shared block attributes for paragraph and heading nodes: text alignment,
 * indentation level, and line height. Validity is enforced here so the document
 * can never hold an out-of-range value (F-11.5).
 */
declare const blockAttrs: {
    align: {
        default: TextAlign;
    };
    indent: {
        default: number;
    };
    lineHeight: {
        default: number | null;
    };
};
/** Read block attributes from a DOM element during paste/parse. */
declare function readBlockAttrs(dom: HTMLElement): {
    align: TextAlign;
    indent: number;
    lineHeight: number | null;
};
/** Build the DOM attribute object (style/class) for a block node's attributes. */
declare function blockDOMAttrs(node: Node, extra?: Record<string, string>): Record<string, string>;
/** Clamp an indent value into the valid range. */
declare function clampIndent(value: number): number;
/** Type guard for a valid alignment value. */
declare function isTextAlign(value: unknown): value is Exclude<TextAlign, null>;

/**
 * A toolbar-aware command: the ProseMirror {@link Command} to dispatch plus
 * optional predicates the toolbar uses to reflect active and enabled state
 * (F-10.6, NF-4).
 */
interface EditorCommand {
    run: Command;
    /** Whether the command's formatting is currently applied to the selection. */
    isActive?: (state: EditorState) => boolean;
    /** Whether the command can currently run. Defaults to `run(state)` (dry run). */
    isEnabled?: (state: EditorState) => boolean;
}
/** Determine whether a mark is active across the current selection. */
declare function isMarkActive(state: EditorState, type: MarkType): boolean;
/** Return the attributes of an active mark, or null if not present. */
declare function getActiveMarkAttrs(state: EditorState, type: MarkType): Attrs | null;
/**
 * Whether every selected top-level block is of `type` (optionally matching the
 * given attributes). Used to reflect heading/alignment/list active state.
 */
declare function isBlockActive(state: EditorState, type: NodeType, attrs?: Record<string, unknown>): boolean;
/** Whether an ancestor of the selection is of the given node type. */
declare function isInNode(state: EditorState, type: NodeType): boolean;
/** Default enabled-check: run the command without a dispatch function. */
declare function defaultEnabled(run: Command): (state: EditorState) => boolean;

/**
 * Apply a mark (with attributes) across the selection, replacing any existing
 * mark of the same type. For an empty selection the mark is stored for the next
 * typed input. Used by attribute marks (font, size, color, highlight).
 */
declare function setMark(type: MarkType, attrs?: Record<string, unknown>): Command;
/** Remove a mark from the selection (and from stored marks when empty). */
declare function unsetMark(type: MarkType): Command;
/** Parametric mark commands (need a runtime value from the UI). */
declare function createParametricMarkCommands(schema: Schema): {
    setFontFamily: (family: string) => Command;
    clearFontFamily: () => Command;
    setFontSize: (size: number) => Command;
    clearFontSize: () => Command;
    setTextColor: (color: string) => Command;
    clearTextColor: () => Command;
    setHighlight: (color: string) => Command;
    clearHighlight: () => Command;
    getActiveFontFamily: (state: Parameters<typeof getActiveMarkAttrs>[0]) => string | null;
    getActiveFontSize: (state: Parameters<typeof getActiveMarkAttrs>[0]) => number | null;
    getActiveTextColor: (state: Parameters<typeof getActiveMarkAttrs>[0]) => string | null;
};

/** Set an attribute on every textblock in the selection that supports it. */
declare function setTextblockAttr(attr: string, value: unknown): Command;
/** Whether every selected textblock has the given attribute value. */
declare function isTextblockAttrActive(state: EditorState, attr: string, value: unknown): boolean;
/** Shift indentation of selected textblocks by `delta`, clamped to valid range. */
declare function changeIndent(delta: number): Command;
/** Parametric block commands needing a runtime value. */
declare function createParametricBlockCommands(schema: Schema): {
    setParagraph: () => Command;
    setHeading: (level: number) => Command;
    setAlign: (align: Exclude<TextAlign, null>) => Command;
    setLineHeight: (lineHeight: number | null) => Command;
};

interface LinkAttrs {
    href: string;
    title?: string | null;
    target?: string;
}
/** Apply or update a link over the selection (or insert the URL as linked text). */
declare function setLink(type: MarkType, attrs: LinkAttrs): Command;
/** Remove the link mark, expanding an empty selection to the full link range. */
declare function removeLink(type: MarkType): Command;
declare function createLinkCommands(schema: Schema): {
    commands: Record<string, EditorCommand>;
    setLink: (_attrs: LinkAttrs) => Command;
    removeLink: Command;
    getActiveLink: (_state: EditorState) => LinkAttrs | null;
    isLinkActive: (_state: EditorState) => boolean;
};

interface ImageAttrs {
    src: string;
    alt?: string | null;
    title?: string | null;
    width?: number | null;
}
/** Insert an inline image at the selection, after validating the source. */
declare function insertImage(schema: Schema, attrs: ImageAttrs): Command;
/** Build a `rows × cols` table node, optionally with a header row. */
declare function createTableNode(schema: Schema, rows: number, cols: number, withHeaderRow: boolean): Node | null;
/** Insert a table at the selection. */
declare function insertTable(schema: Schema, rows?: number, cols?: number, withHeaderRow?: boolean): Command;

/** The full set of commands derived from a schema, ready for toolbar/keymap use. */
interface CommandSet {
    /** Static, parameter-free commands keyed by toolbar item id. */
    registry: Record<string, EditorCommand>;
    /** Parametric mark commands (font family/size, colors). */
    marks: ReturnType<typeof createParametricMarkCommands>;
    /** Parametric block commands (heading level, alignment, line height). */
    blocks: ReturnType<typeof createParametricBlockCommands>;
    /** Link commands (set/remove/inspect). */
    links: ReturnType<typeof createLinkCommands>;
    /** Insert helpers needing arguments. */
    insert: {
        image: (attrs: ImageAttrs) => ReturnType<typeof insertImage>;
        table: (rows?: number, cols?: number, withHeaderRow?: boolean) => ReturnType<typeof insertTable>;
    };
}
/**
 * Assemble every command for a schema. Commands whose feature is disabled are
 * omitted from the registry, so the toolbar and keymap reference only what the
 * document can actually contain.
 */
declare function createCommands(schema: Schema): CommandSet;
/** Generic editing commands occasionally useful to consumers. */
declare const editingCommands: {
    selectAll: prosemirror_state.Command;
    selectParentNode: prosemirror_state.Command;
    deleteSelection: prosemirror_state.Command;
    joinBackward: prosemirror_state.Command;
    joinForward: prosemirror_state.Command;
};

interface BuildPluginsOptions {
    /** Placeholder text shown when the document is empty. */
    placeholder?: string;
    /** Enable undo/redo history (default true). */
    history?: boolean;
    /** Additional plugins appended after the built-ins (extension API). */
    extraPlugins?: Plugin[];
    /**
     * Optional hook invoked for every dispatched transaction (used by the React
     * layer to surface change/selection events without re-rendering the surface).
     */
    appendTransaction?: (transactions: readonly Transaction[], oldState: EditorState, newState: EditorState) => Transaction | null | undefined;
}
/**
 * Assemble the full plugin stack for a schema. The stack is feature-aware: table
 * and history plugins are only added when supported. The order places input
 * rules and keymaps first, structural helpers next, and table editing last.
 */
declare function buildPlugins(schema: Schema, options?: BuildPluginsOptions): Plugin[];

type EditorContent = DocumentJSON | string | null | undefined;
/**
 * Build a document node from arbitrary initial content, defensively (F-11.4):
 * - `null`/`undefined` → an empty document;
 * - a string → paragraphs split on newlines (plain-text initial content);
 * - ProseMirror JSON → parsed and integrity-checked, falling back to empty on
 *   any error so malformed input can never crash the editor.
 */
declare function createDoc(schema: Schema, content: EditorContent): Node;
interface CreateEditorStateOptions {
    schema: Schema;
    plugins: Plugin[];
    content?: EditorContent;
}
/** Construct the initial {@link EditorState} for the editor. */
declare function createEditorState(options: CreateEditorStateOptions): EditorState;

interface DocumentStats {
    words: number;
    characters: number;
    charactersNoSpaces: number;
}
/**
 * Compute word and character counts for a document (F-4.5). Walks text nodes
 * directly — cheap and lean for large documents (NF-1).
 */
declare function countDocument(doc: Node): DocumentStats;

/** All features enabled by default; integrations opt out per instance. */
declare const DEFAULT_FEATURES: FeatureFlags;
/** Physical page dimensions in millimetres for the supported standard sizes. */
declare const PAGE_DIMENSIONS_MM: Record<Exclude<PageSize, 'custom'>, {
    width: number;
    height: number;
}>;
declare const DEFAULT_PAGE: PageConfig;
/** Resolve a {@link PageConfig} to concrete content-box dimensions in millimetres. */
declare function resolvePageDimensions(page: PageConfig): {
    width: number;
    height: number;
};
/** Default English UI strings (NF-6: externalized for localization). */
declare const DEFAULT_STRINGS: EditorStrings;
/** Font families offered by the font picker. Consumers can override via config. */
declare const DEFAULT_FONT_FAMILIES: string[];
/** Font sizes (pt) offered by the size picker. */
declare const DEFAULT_FONT_SIZES: number[];
/** A palette of colors offered by the color/highlight pickers. */
declare const DEFAULT_COLOR_PALETTE: string[];
/** Default toolbar layout, grouped. Filtered by enabled features at render time. */
declare const DEFAULT_TOOLBAR_GROUPS: ToolbarItemId[][];
/** Map a {@link ThemeTokens} object to a CSS custom-property style record. */
declare function themeToCssVars(theme: ThemeTokens | undefined): Record<string, string>;

/**
 * Security primitives (§5.12). These functions are the single ingress point for
 * untrusted content: pasted/imported HTML, link and image URLs. They are
 * dependency-light and (for URLs) DOM-free so the schema can be imported in
 * Node for export/tests without pulling a DOM library.
 */
/**
 * Validate and normalize a hyperlink URL. Returns the cleaned URL, or `null` if
 * the URL is missing or uses an unsafe scheme (e.g. `javascript:`). Relative and
 * fragment/anchor URLs are allowed (F-12.2, F-12.5).
 */
declare function sanitizeUrl(raw: string | null | undefined): string | null;
/**
 * Validate an image source. Accepts http(s)/blob URLs and `data:image/*` URIs,
 * rejecting SVG data URIs and any active-content scheme (F-12.5).
 */
declare function sanitizeImageSrc(raw: string | null | undefined): string | null;
/**
 * Preload the DOM sanitizer so a later synchronous paste can be cleaned without
 * waiting. Safe to call in the browser on editor mount. No-op in Node.
 */
declare function preloadSanitizer(): Promise<void>;
/**
 * Sanitize an HTML string synchronously, best-effort: uses the cached DOM
 * sanitizer if it has been loaded, otherwise returns the input unchanged for
 * ProseMirror's own parser (which never executes content and is constrained by
 * the schema and per-attribute URL sanitization). Use for the paste transform.
 */
declare function sanitizeHtmlSync(html: string): string;
/**
 * Sanitize an HTML string for safe parsing into the editor. No script, inline
 * event handlers, or active content survives (F-12.1, F-12.2). When no DOM
 * sanitizer is available the input is returned unchanged for ProseMirror's own
 * parser, which never executes content.
 */
declare function sanitizeHtml(html: string): Promise<string>;

export { unsetMark as $, insertTable as A, type BuildPluginsOptions as B, type CommandSet as C, DEFAULT_COLOR_PALETTE as D, type EditorCommand as E, isBlockActive as F, isInNode as G, isMarkActive as H, INDENT_STEP_EM as I, isTextAlign as J, isTextblockAttrActive as K, type LinkAttrs as L, MAX_INDENT as M, preloadSanitizer as N, readBlockAttrs as O, PAGE_DIMENSIONS_MM as P, removeLink as Q, resolvePageDimensions as R, sanitizeHtml as S, type TextAlign as T, sanitizeHtmlSync as U, sanitizeImageSrc as V, sanitizeUrl as W, setLink as X, setMark as Y, setTextblockAttr as Z, themeToCssVars as _, type CreateEditorStateOptions as a, DEFAULT_FEATURES as b, DEFAULT_FONT_FAMILIES as c, DEFAULT_FONT_SIZES as d, DEFAULT_PAGE as e, DEFAULT_STRINGS as f, DEFAULT_TOOLBAR_GROUPS as g, type DocumentStats as h, type EditorContent as i, type ImageAttrs as j, blockAttrs as k, blockDOMAttrs as l, buildPlugins as m, buildSchema as n, changeIndent as o, clampIndent as p, countDocument as q, createCommands as r, createDoc as s, createEditorState as t, createTableNode as u, defaultEnabled as v, defaultSchema as w, editingCommands as x, getActiveMarkAttrs as y, insertImage as z };
