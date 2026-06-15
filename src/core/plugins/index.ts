import { Plugin, type EditorState, type Transaction } from 'prosemirror-state';
import type { Schema } from 'prosemirror-model';
import { history } from 'prosemirror-history';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { columnResizing, tableEditing } from 'prosemirror-tables';
import { sanitizeHtmlSync } from '../../security/sanitize';
import { buildInputRules } from './inputrules';
import { buildKeymapPlugins } from './keymap';
import { placeholderPlugin } from './placeholder';
import { taskListPlugin } from './taskList';
import { paginationPlugin, type PaginationOptions } from '../pagination/plugin';

export { buildInputRules } from './inputrules';
export { buildKeymapPlugins } from './keymap';
export { placeholderPlugin } from './placeholder';
export { taskListPlugin } from './taskList';
export {
  paginationPlugin,
  paginationKey,
  type PaginationOptions,
  type PaginationGeometry,
} from '../pagination/plugin';

/** Sanitize pasted HTML before ProseMirror parses it (F-11.4, F-12.1). */
function pasteSanitizerPlugin(): Plugin {
  return new Plugin({
    props: {
      transformPastedHTML(html) {
        return sanitizeHtmlSync(html);
      },
    },
  });
}

export interface BuildPluginsOptions {
  /** Placeholder text shown when the document is empty. */
  placeholder?: string;
  /** Enable undo/redo history (default true). */
  history?: boolean;
  /** Additional plugins appended after the built-ins (extension API). */
  extraPlugins?: Plugin[];
  /** Visual pagination options. When provided, the pagination plugin is added. */
  pagination?: PaginationOptions;
  /**
   * Optional hook invoked for every dispatched transaction (used by the React
   * layer to surface change/selection events without re-rendering the surface).
   */
  appendTransaction?: (
    transactions: readonly Transaction[],
    oldState: EditorState,
    newState: EditorState,
  ) => Transaction | null | undefined;
}

/**
 * Assemble the full plugin stack for a schema. The stack is feature-aware: table
 * and history plugins are only added when supported. The order places input
 * rules and keymaps first, structural helpers next, and table editing last.
 */
export function buildPlugins(schema: Schema, options: BuildPluginsOptions = {}): Plugin[] {
  const plugins: Plugin[] = [];

  if (options.history !== false) {
    plugins.push(history());
  }

  plugins.push(buildInputRules(schema));
  plugins.push(...buildKeymapPlugins(schema));
  plugins.push(dropCursor({ color: 'var(--rne-accent, #df4a36)', width: 2 }));
  plugins.push(gapCursor());

  if (schema.nodes.table) {
    plugins.push(columnResizing());
    plugins.push(tableEditing());
  }

  plugins.push(taskListPlugin(schema));
  plugins.push(pasteSanitizerPlugin());

  if (options.placeholder) {
    plugins.push(placeholderPlugin(options.placeholder));
  }

  if (options.pagination) {
    plugins.push(paginationPlugin(options.pagination));
  }

  if (options.appendTransaction) {
    const hook = options.appendTransaction;
    plugins.push(new Plugin({ appendTransaction: (trs, oldS, newS) => hook(trs, oldS, newS) ?? null }));
  }

  if (options.extraPlugins?.length) {
    plugins.push(...options.extraPlugins);
  }

  return plugins;
}
