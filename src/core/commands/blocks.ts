import type { NodeType, Schema } from 'prosemirror-model';
import type { Command, EditorState } from 'prosemirror-state';
import { setBlockType, wrapIn, lift } from 'prosemirror-commands';
import { clampIndent, type TextAlign } from '../schema/attrs';
import { type EditorCommand, isBlockActive, isInNode } from './helpers';

const noop: Command = () => false;

/** Set an attribute on every textblock in the selection that supports it. */
export function setTextblockAttr(attr: string, value: unknown): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    let applicable = false;
    const tr = state.tr;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.isTextblock && attr in (node.type.spec.attrs ?? {})) {
        applicable = true;
        if (dispatch) tr.setNodeAttribute(pos, attr, value);
      }
      return true;
    });
    if (!applicable) return false;
    if (dispatch) dispatch(tr.scrollIntoView());
    return true;
  };
}

/** Whether every selected textblock has the given attribute value. */
export function isTextblockAttrActive(state: EditorState, attr: string, value: unknown): boolean {
  const { from, to } = state.selection;
  let any = false;
  let all = true;
  state.doc.nodesBetween(from, to, (node) => {
    if (node.isTextblock && attr in (node.type.spec.attrs ?? {})) {
      any = true;
      if (node.attrs[attr] !== value) all = false;
    }
    return true;
  });
  return any && all;
}

/** Shift indentation of selected textblocks by `delta`, clamped to valid range. */
export function changeIndent(delta: number): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    let changed = false;
    const tr = state.tr;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.isTextblock && 'indent' in (node.type.spec.attrs ?? {})) {
        const next = clampIndent((node.attrs.indent as number) + delta);
        if (next !== node.attrs.indent) {
          changed = true;
          if (dispatch) tr.setNodeAttribute(pos, 'indent', next);
        }
      }
      return true;
    });
    if (!changed) return false;
    if (dispatch) dispatch(tr.scrollIntoView());
    return true;
  };
}

/** Insert an atom block (horizontal rule, page break) at the selection. */
function insertBlock(type: NodeType): Command {
  return (state, dispatch) => {
    if (!type) return false;
    if (dispatch) {
      dispatch(state.tr.replaceSelectionWith(type.create()).scrollIntoView());
    }
    return true;
  };
}

export function createBlockCommands(schema: Schema): Record<string, EditorCommand> {
  const n = schema.nodes;
  const cmds: Record<string, EditorCommand> = {};

  if (n.paragraph) {
    const run = setBlockType(n.paragraph);
    cmds.paragraph = {
      run,
      isActive: (state) => isBlockActive(state, n.paragraph),
      isEnabled: (state) => run(state, undefined, undefined),
    };
  }

  if (schema.nodes.blockquote) {
    const wrap = wrapIn(schema.nodes.blockquote);
    cmds.blockquote = {
      run: (state, dispatch, view) => {
        if (isInNode(state, schema.nodes.blockquote)) return lift(state, dispatch);
        return wrap(state, dispatch, view);
      },
      isActive: (state) => isInNode(state, schema.nodes.blockquote),
    };
  }

  if (n.horizontal_rule) {
    const run = insertBlock(n.horizontal_rule);
    cmds.horizontalRule = { run, isEnabled: (state) => run(state, undefined, undefined) };
  }
  if (n.page_break) {
    const run = insertBlock(n.page_break);
    cmds.pageBreak = { run, isEnabled: (state) => run(state, undefined, undefined) };
  }

  // Alignment commands.
  if (n.paragraph?.spec.attrs && 'align' in n.paragraph.spec.attrs) {
    const aligns: Array<[string, Exclude<TextAlign, null>]> = [
      ['alignLeft', 'left'],
      ['alignCenter', 'center'],
      ['alignRight', 'right'],
      ['alignJustify', 'justify'],
    ];
    for (const [name, value] of aligns) {
      const run = setTextblockAttr('align', value);
      cmds[name] = {
        run,
        isActive: (state) => isTextblockAttrActive(state, 'align', value),
        isEnabled: (state) => run(state, undefined, undefined),
      };
    }

    const indentRun = changeIndent(1);
    const outdentRun = changeIndent(-1);
    cmds.indent = { run: indentRun, isEnabled: (state) => indentRun(state, undefined, undefined) };
    cmds.outdent = {
      run: outdentRun,
      isEnabled: (state) => outdentRun(state, undefined, undefined),
    };
  }

  return cmds;
}

/** Parametric block commands needing a runtime value. */
export function createParametricBlockCommands(schema: Schema) {
  const n = schema.nodes;
  return {
    setParagraph: (): Command => (n.paragraph ? setBlockType(n.paragraph) : noop),
    setHeading: (level: number): Command =>
      n.heading ? setBlockType(n.heading, { level }) : noop,
    setAlign: (align: Exclude<TextAlign, null>): Command => setTextblockAttr('align', align),
    setLineHeight: (lineHeight: number | null): Command => setTextblockAttr('lineHeight', lineHeight),
  };
}
