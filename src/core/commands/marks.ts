import type { MarkType, Schema } from 'prosemirror-model';
import type { Command } from 'prosemirror-state';
import { toggleMark as pmToggleMark } from 'prosemirror-commands';
import { type EditorCommand, getActiveMarkAttrs, isMarkActive } from './helpers';

/**
 * Apply a mark (with attributes) across the selection, replacing any existing
 * mark of the same type. For an empty selection the mark is stored for the next
 * typed input. Used by attribute marks (font, size, color, highlight).
 */
export function setMark(type: MarkType, attrs?: Record<string, unknown>): Command {
  return (state, dispatch) => {
    const { selection } = state;
    if (dispatch) {
      const tr = state.tr;
      if (selection.empty) {
        tr.addStoredMark(type.create(attrs));
      } else {
        for (const range of selection.ranges) {
          const { $from, $to } = range;
          tr.addMark($from.pos, $to.pos, type.create(attrs));
        }
        tr.scrollIntoView();
      }
      dispatch(tr);
    }
    return true;
  };
}

/** Remove a mark from the selection (and from stored marks when empty). */
export function unsetMark(type: MarkType): Command {
  return (state, dispatch) => {
    const { selection } = state;
    if (dispatch) {
      const tr = state.tr;
      if (selection.empty) {
        tr.removeStoredMark(type);
      } else {
        for (const range of selection.ranges) {
          tr.removeMark(range.$from.pos, range.$to.pos, type);
        }
      }
      dispatch(tr);
    }
    return true;
  };
}

function toggle(type: MarkType): EditorCommand {
  const run = pmToggleMark(type);
  return {
    run,
    isActive: (state) => isMarkActive(state, type),
    isEnabled: (state) => run(state, undefined, undefined),
  };
}

/**
 * Build all mark-related commands for a schema. Commands whose mark is absent
 * from the schema (feature disabled) are simply omitted.
 */
export function createMarkCommands(schema: Schema): Record<string, EditorCommand> {
  const cmds: Record<string, EditorCommand> = {};
  const m = schema.marks;

  if (m.strong) cmds.bold = toggle(m.strong);
  if (m.em) cmds.italic = toggle(m.em);
  if (m.underline) cmds.underline = toggle(m.underline);
  if (m.strikethrough) cmds.strikethrough = toggle(m.strikethrough);
  if (m.superscript) cmds.superscript = toggle(m.superscript);
  if (m.subscript) cmds.subscript = toggle(m.subscript);
  if (m.code) cmds.code = toggle(m.code);

  return cmds;
}

/** Parametric mark commands (need a runtime value from the UI). */
export function createParametricMarkCommands(schema: Schema) {
  const m = schema.marks;
  return {
    setFontFamily: (family: string): Command =>
      m.fontFamily ? setMark(m.fontFamily, { family }) : noop,
    clearFontFamily: (): Command => (m.fontFamily ? unsetMark(m.fontFamily) : noop),
    setFontSize: (size: number): Command => (m.fontSize ? setMark(m.fontSize, { size }) : noop),
    clearFontSize: (): Command => (m.fontSize ? unsetMark(m.fontSize) : noop),
    setTextColor: (color: string): Command =>
      m.textColor ? setMark(m.textColor, { color }) : noop,
    clearTextColor: (): Command => (m.textColor ? unsetMark(m.textColor) : noop),
    setHighlight: (color: string): Command =>
      m.highlight ? setMark(m.highlight, { color }) : noop,
    clearHighlight: (): Command => (m.highlight ? unsetMark(m.highlight) : noop),
    getActiveFontFamily: (state: Parameters<typeof getActiveMarkAttrs>[0]): string | null =>
      m.fontFamily ? ((getActiveMarkAttrs(state, m.fontFamily)?.family as string) ?? null) : null,
    getActiveFontSize: (state: Parameters<typeof getActiveMarkAttrs>[0]): number | null =>
      m.fontSize ? ((getActiveMarkAttrs(state, m.fontSize)?.size as number) ?? null) : null,
    getActiveTextColor: (state: Parameters<typeof getActiveMarkAttrs>[0]): string | null =>
      m.textColor ? ((getActiveMarkAttrs(state, m.textColor)?.color as string) ?? null) : null,
  };
}

const noop: Command = () => false;
