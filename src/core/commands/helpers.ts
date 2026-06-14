import type { MarkType, NodeType, Attrs } from 'prosemirror-model';
import type { EditorState, Command } from 'prosemirror-state';

/**
 * A toolbar-aware command: the ProseMirror {@link Command} to dispatch plus
 * optional predicates the toolbar uses to reflect active and enabled state
 * (F-10.6, NF-4).
 */
export interface EditorCommand {
  run: Command;
  /** Whether the command's formatting is currently applied to the selection. */
  isActive?: (state: EditorState) => boolean;
  /** Whether the command can currently run. Defaults to `run(state)` (dry run). */
  isEnabled?: (state: EditorState) => boolean;
}

/** Determine whether a mark is active across the current selection. */
export function isMarkActive(state: EditorState, type: MarkType): boolean {
  const { from, $from, to, empty } = state.selection;
  if (empty) {
    return !!type.isInSet(state.storedMarks || $from.marks());
  }
  return state.doc.rangeHasMark(from, to, type);
}

/** Return the attributes of an active mark, or null if not present. */
export function getActiveMarkAttrs(state: EditorState, type: MarkType): Attrs | null {
  const { $from, empty } = state.selection;
  if (empty) {
    const mark = type.isInSet(state.storedMarks || $from.marks());
    return mark ? mark.attrs : null;
  }
  const { from, to } = state.selection;
  let attrs: Attrs | null = null;
  state.doc.nodesBetween(from, to, (node) => {
    if (attrs) return false;
    const mark = node.marks.find((m) => m.type === type);
    if (mark) attrs = mark.attrs;
    return true;
  });
  return attrs;
}

/**
 * Whether every selected top-level block is of `type` (optionally matching the
 * given attributes). Used to reflect heading/alignment/list active state.
 */
export function isBlockActive(
  state: EditorState,
  type: NodeType,
  attrs?: Record<string, unknown>,
): boolean {
  const { from, to } = state.selection;
  let found = false;
  let allMatch = true;
  state.doc.nodesBetween(from, to, (node) => {
    if (node.type.isTextblock || node.type === type) {
      if (node.type === type && matchAttrs(node.attrs, attrs)) {
        found = true;
      } else if (node.type.isTextblock) {
        if (!(node.type === type && matchAttrs(node.attrs, attrs))) allMatch = false;
      }
    }
    return true;
  });
  return found && allMatch;
}

function matchAttrs(nodeAttrs: Attrs, attrs?: Record<string, unknown>): boolean {
  if (!attrs) return true;
  return Object.keys(attrs).every((key) => nodeAttrs[key] === attrs[key]);
}

/** Whether an ancestor of the selection is of the given node type. */
export function isInNode(state: EditorState, type: NodeType): boolean {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type === type) return true;
  }
  return false;
}

/** Default enabled-check: run the command without a dispatch function. */
export function defaultEnabled(run: Command): (state: EditorState) => boolean {
  return (state) => run(state, undefined, undefined);
}
