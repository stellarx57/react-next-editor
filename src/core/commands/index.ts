import type { Schema } from 'prosemirror-model';
import { redo, undo } from 'prosemirror-history';
import {
  selectParentNode,
  deleteSelection,
  joinBackward,
  joinForward,
  selectAll,
} from 'prosemirror-commands';
import type { EditorCommand } from './helpers';
import { createMarkCommands, createParametricMarkCommands } from './marks';
import { createBlockCommands, createParametricBlockCommands } from './blocks';
import { createListCommands } from './lists';
import { createFormatCommands } from './format';
import { createLinkCommands } from './links';
import { createTableCommands, insertImage, insertTable, type ImageAttrs } from './insert';

export * from './helpers';
export { setMark, unsetMark } from './marks';
export { setTextblockAttr, changeIndent, isTextblockAttrActive } from './blocks';
export { splitListItem } from './lists';
export { setLink, removeLink, type LinkAttrs } from './links';
export {
  insertImage,
  insertTable,
  createTableNode,
  type ImageAttrs,
} from './insert';
export { clearFormatting } from './format';

/** The full set of commands derived from a schema, ready for toolbar/keymap use. */
export interface CommandSet {
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
export function createCommands(schema: Schema): CommandSet {
  const registry: Record<string, EditorCommand> = {
    undo: { run: undo, isEnabled: (state) => undo(state) },
    redo: { run: redo, isEnabled: (state) => redo(state) },
    ...createMarkCommands(schema),
    ...createBlockCommands(schema),
    ...createListCommands(schema),
    ...createFormatCommands(schema),
    ...createTableCommands(schema),
  };

  const linkApi = createLinkCommands(schema);
  Object.assign(registry, linkApi.commands);

  return {
    registry,
    marks: createParametricMarkCommands(schema),
    blocks: createParametricBlockCommands(schema),
    links: linkApi,
    insert: {
      image: (attrs: ImageAttrs) => insertImage(schema, attrs),
      table: (rows = 3, cols = 3, withHeaderRow = true) =>
        insertTable(schema, rows, cols, withHeaderRow),
    },
  };
}

/** Generic editing commands occasionally useful to consumers. */
export const editingCommands = {
  selectAll,
  selectParentNode,
  deleteSelection,
  joinBackward,
  joinForward,
};
