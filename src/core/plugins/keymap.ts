import type { Schema } from 'prosemirror-model';
import type { Command, Plugin } from 'prosemirror-state';
import { keymap } from 'prosemirror-keymap';
import {
  baseKeymap,
  chainCommands,
  exitCode,
  setBlockType,
  toggleMark,
} from 'prosemirror-commands';
import { redo, undo } from 'prosemirror-history';
import { liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list';
import { goToNextCell } from 'prosemirror-tables';
import { changeIndent } from '../commands/blocks';

/**
 * Build the editor keymaps (F-4.3). Returns two plugins: the custom bindings
 * (formatting, structure) and the ProseMirror base keymap, in that priority
 * order. Bindings reference only commands whose nodes/marks exist in the schema.
 */
export function buildKeymapPlugins(schema: Schema): Plugin[] {
  const bindings: Record<string, Command> = {};
  const m = schema.marks;
  const n = schema.nodes;

  const bind = (key: string, cmd: Command | undefined) => {
    if (cmd) bindings[key] = cmd;
  };

  // History.
  bind('Mod-z', undo);
  bind('Shift-Mod-z', redo);
  bind('Mod-y', redo);

  // Inline marks.
  if (m.strong) bind('Mod-b', toggleMark(m.strong));
  if (m.em) bind('Mod-i', toggleMark(m.em));
  if (m.underline) bind('Mod-u', toggleMark(m.underline));
  if (m.strikethrough) bind('Mod-Shift-s', toggleMark(m.strikethrough));
  if (m.code) bind('Mod-e', toggleMark(m.code));
  if (m.superscript) bind('Mod-.', toggleMark(m.superscript));
  if (m.subscript) bind('Mod-,', toggleMark(m.subscript));

  // Block types.
  if (n.paragraph) bind('Shift-Mod-0', setBlockType(n.paragraph));
  if (n.heading) {
    for (let level = 1; level <= 6; level++) {
      bind(`Shift-Mod-${level}`, setBlockType(n.heading, { level }));
    }
  }

  // Lists: split on Enter, indent/outdent on Tab.
  const listItem = n.list_item;
  if (listItem) {
    bind('Enter', splitListItem(listItem));
  }

  const tabChain: Command[] = [];
  const shiftTabChain: Command[] = [];
  if (n.table) {
    tabChain.push(goToNextCell(1));
    shiftTabChain.push(goToNextCell(-1));
  }
  if (listItem) {
    tabChain.push(sinkListItem(listItem));
    shiftTabChain.push(liftListItem(listItem));
  }
  tabChain.push(changeIndent(1));
  shiftTabChain.push(changeIndent(-1));
  bindings['Tab'] = chainCommands(...tabChain);
  bindings['Shift-Tab'] = chainCommands(...shiftTabChain);

  // Hard break.
  if (n.hard_break) {
    const br = n.hard_break;
    const insertBreak: Command = chainCommands(exitCode, (state, dispatch) => {
      if (dispatch) dispatch(state.tr.replaceSelectionWith(br.create()).scrollIntoView());
      return true;
    });
    bind('Shift-Enter', insertBreak);
    bind('Mod-Enter', insertBreak);
  }

  return [keymap(bindings), keymap(baseKeymap)];
}
