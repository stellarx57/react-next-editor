import type { Schema } from 'prosemirror-model';
import type { Command } from 'prosemirror-state';
import type { EditorCommand } from './helpers';

/**
 * Clear character and paragraph formatting across the selection (F-1.8):
 * removes all inline marks, resets alignment/indent/line-height, and converts
 * headings back to normal paragraphs. Node sizes are unchanged so the iteration
 * over the original document stays position-stable.
 */
export function clearFormatting(schema: Schema): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;
    if (dispatch) {
      const tr = state.tr;
      tr.removeMark(from, to);
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isTextblock) return true;
        const specAttrs = node.type.spec.attrs ?? {};
        if (schema.nodes.heading && node.type === schema.nodes.heading && schema.nodes.paragraph) {
          tr.setNodeMarkup(pos, schema.nodes.paragraph, {
            align: null,
            indent: 0,
            lineHeight: null,
          });
        } else {
          const attrs = { ...node.attrs };
          if ('align' in specAttrs) attrs.align = null;
          if ('indent' in specAttrs) attrs.indent = 0;
          if ('lineHeight' in specAttrs) attrs.lineHeight = null;
          tr.setNodeMarkup(pos, undefined, attrs);
        }
        return true;
      });
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

export function createFormatCommands(schema: Schema): Record<string, EditorCommand> {
  const run = clearFormatting(schema);
  return {
    clearFormatting: {
      run,
      isEnabled: (state) => !state.selection.empty,
    },
  };
}
