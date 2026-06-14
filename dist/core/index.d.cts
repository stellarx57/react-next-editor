export { B as BuildPluginsOptions, C as CommandSet, a as CreateEditorStateOptions, D as DEFAULT_COLOR_PALETTE, b as DEFAULT_FEATURES, c as DEFAULT_FONT_FAMILIES, d as DEFAULT_FONT_SIZES, e as DEFAULT_PAGE, f as DEFAULT_STRINGS, g as DEFAULT_TOOLBAR_GROUPS, h as DocumentStats, E as EditorCommand, i as EditorContent, I as INDENT_STEP_EM, j as ImageAttrs, L as LinkAttrs, M as MAX_INDENT, P as PAGE_DIMENSIONS_MM, T as TextAlign, k as blockAttrs, l as blockDOMAttrs, m as buildPlugins, n as buildSchema, o as changeIndent, p as clampIndent, q as countDocument, r as createCommands, s as createDoc, t as createEditorState, u as createTableNode, v as defaultEnabled, w as defaultSchema, x as editingCommands, y as getActiveMarkAttrs, z as insertImage, A as insertTable, F as isBlockActive, G as isInNode, H as isMarkActive, J as isTextAlign, K as isTextblockAttrActive, N as preloadSanitizer, O as readBlockAttrs, Q as removeLink, R as resolvePageDimensions, S as sanitizeHtml, U as sanitizeHtmlSync, V as sanitizeImageSrc, W as sanitizeUrl, X as setLink, Y as setMark, Z as setTextblockAttr, _ as themeToCssVars, $ as unsetMark } from '../sanitize-Bub3nwsz.cjs';
import { NodeSpec, Node, MarkSpec, Schema } from 'prosemirror-model';
export { D as DocumentJSON, E as EditorMode, a as EditorStrings, F as FeatureFlags, P as PageConfig, b as PageSize, S as SaveStatus, T as ThemeTokens, c as ToolbarConfig, d as ToolbarItemId } from '../types--ae1gYNt.cjs';
import { Command, Plugin } from 'prosemirror-state';
export { splitListItem } from 'prosemirror-schema-list';

/**
 * Node specifications. Each is a self-contained {@link NodeSpec}. The schema is
 * assembled from these by {@link buildSchema} according to the enabled feature
 * flags, so disabling a feature removes its node entirely and the document can
 * never contain it (F-10.2, F-11.5).
 */
declare const doc: NodeSpec;
declare const text: NodeSpec;
declare const paragraph: NodeSpec;
declare const heading: NodeSpec;
declare const blockquote: NodeSpec;
declare const horizontal_rule: NodeSpec;
/** Custom manual page break (F-3.5). An atom that renders as a non-editable break. */
declare const page_break: NodeSpec;
declare const hard_break: NodeSpec;
declare const image: NodeSpec;
/** List item, with an optional `checked` attribute powering task lists (F-2.8). */
declare const list_item: NodeSpec;
declare const bullet_list: NodeSpec;
declare const ordered_list: NodeSpec;
/** Return the text alignment attribute of a block node, if any. */
declare function nodeAlign(node: Node): string | null;

declare const nodes_blockquote: typeof blockquote;
declare const nodes_bullet_list: typeof bullet_list;
declare const nodes_doc: typeof doc;
declare const nodes_hard_break: typeof hard_break;
declare const nodes_heading: typeof heading;
declare const nodes_horizontal_rule: typeof horizontal_rule;
declare const nodes_image: typeof image;
declare const nodes_list_item: typeof list_item;
declare const nodes_nodeAlign: typeof nodeAlign;
declare const nodes_ordered_list: typeof ordered_list;
declare const nodes_page_break: typeof page_break;
declare const nodes_paragraph: typeof paragraph;
declare const nodes_text: typeof text;
declare namespace nodes {
  export { nodes_blockquote as blockquote, nodes_bullet_list as bullet_list, nodes_doc as doc, nodes_hard_break as hard_break, nodes_heading as heading, nodes_horizontal_rule as horizontal_rule, nodes_image as image, nodes_list_item as list_item, nodes_nodeAlign as nodeAlign, nodes_ordered_list as ordered_list, nodes_page_break as page_break, nodes_paragraph as paragraph, nodes_text as text };
}

/**
 * Mark specifications. Each is a self-contained {@link MarkSpec} with parse and
 * serialize rules. Marks that carry style (font, size, colors) are attribute
 * marks; their `toDOM` emits inline styles only — never active content — and
 * their `parseDOM` reads from the corresponding CSS property so pasted content
 * round-trips (F-4.2, F-11.4).
 */
declare const strong: MarkSpec;
declare const em: MarkSpec;
declare const underline: MarkSpec;
declare const strikethrough: MarkSpec;
declare const superscript: MarkSpec;
declare const subscript: MarkSpec;
declare const code: MarkSpec;
declare const link: MarkSpec;
declare const fontFamily: MarkSpec;
declare const fontSize: MarkSpec;
declare const textColor: MarkSpec;
declare const highlight: MarkSpec;

declare const marks_code: typeof code;
declare const marks_em: typeof em;
declare const marks_fontFamily: typeof fontFamily;
declare const marks_fontSize: typeof fontSize;
declare const marks_highlight: typeof highlight;
declare const marks_link: typeof link;
declare const marks_strikethrough: typeof strikethrough;
declare const marks_strong: typeof strong;
declare const marks_subscript: typeof subscript;
declare const marks_superscript: typeof superscript;
declare const marks_textColor: typeof textColor;
declare const marks_underline: typeof underline;
declare namespace marks {
  export { marks_code as code, marks_em as em, marks_fontFamily as fontFamily, marks_fontSize as fontSize, marks_highlight as highlight, marks_link as link, marks_strikethrough as strikethrough, marks_strong as strong, marks_subscript as subscript, marks_superscript as superscript, marks_textColor as textColor, marks_underline as underline };
}

/**
 * Clear character and paragraph formatting across the selection (F-1.8):
 * removes all inline marks, resets alignment/indent/line-height, and converts
 * headings back to normal paragraphs. Node sizes are unchanged so the iteration
 * over the original document stays position-stable.
 */
declare function clearFormatting(schema: Schema): Command;

/**
 * Markdown-style input rules (F-4.x convenience): typing `# `, `> `, `- `, `1. `
 * etc. transforms the current block. Rules are added only for nodes present in
 * the schema, and typography rules (smart quotes, ellipsis, em-dash) are always
 * safe to include.
 */
declare function buildInputRules(schema: Schema): Plugin;

/**
 * Build the editor keymaps (F-4.3). Returns two plugins: the custom bindings
 * (formatting, structure) and the ProseMirror base keymap, in that priority
 * order. Bindings reference only commands whose nodes/marks exist in the schema.
 */
declare function buildKeymapPlugins(schema: Schema): Plugin[];

/**
 * Show placeholder text in an empty document (F-4.7). Adds a node decoration
 * carrying the placeholder as a `data-placeholder` attribute, which the
 * stylesheet renders as ghost text. Purely decorative — never mutates the doc.
 */
declare function placeholderPlugin(text: string): Plugin;

/**
 * Make task-list checkboxes interactive. Clicking the rendered checkbox toggles
 * the `checked` attribute of the enclosing `list_item`. Implemented via a DOM
 * mousedown handler so it works without a custom node view. No-op when the
 * editor is not editable.
 */
declare function taskListPlugin(schema: Schema): Plugin;

export { buildInputRules, buildKeymapPlugins, clearFormatting, marks as markSpecs, nodes as nodeSpecs, placeholderPlugin, taskListPlugin };
