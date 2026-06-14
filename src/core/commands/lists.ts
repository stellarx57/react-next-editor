import type { NodeType, Schema, Node as PMNode } from 'prosemirror-model';
import type { Command, EditorState, Transaction } from 'prosemirror-state';
import { liftListItem, sinkListItem, wrapInList } from 'prosemirror-schema-list';
import type { EditorCommand } from './helpers';

interface ParentList {
  node: PMNode;
  pos: number;
  depth: number;
}

/** Find the nearest ancestor list node (bullet or ordered) of the selection. */
function findParentList(state: EditorState, listTypes: NodeType[]): ParentList | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (listTypes.includes(node.type)) {
      return { node, pos: $from.before(depth), depth };
    }
  }
  return null;
}

/** Set `checked` on each immediate list_item child of the list at `listPos`. */
function setItemsChecked(tr: Transaction, list: PMNode, listPos: number, checked: boolean | null) {
  let offset = listPos + 1;
  list.forEach((child) => {
    if (child.type.name === 'list_item' && child.attrs.checked !== checked) {
      tr.setNodeAttribute(offset, 'checked', checked);
    }
    offset += child.nodeSize;
  });
}

/**
 * Toggle a list of the given type/kind on the current selection:
 * - not in a list → wrap into the target list;
 * - in a list of the same type/kind → lift out (remove the list);
 * - in a list of a different type/kind → convert the list to the target.
 */
function toggleList(
  schema: Schema,
  targetType: NodeType,
  targetAttrs: Record<string, unknown>,
): Command {
  const listItem = schema.nodes.list_item;
  const listTypes = [schema.nodes.bullet_list, schema.nodes.ordered_list].filter(
    Boolean,
  ) as NodeType[];

  return (state, dispatch, view) => {
    const parent = findParentList(state, listTypes);

    if (!parent) {
      const wrap = wrapInList(targetType, targetAttrs);
      if (targetAttrs.kind === 'task') {
        // Wrap, then mark the produced items as task items.
        return wrap(
          state,
          (tr) => {
            if (!dispatch) return;
            const next = tr.doc.resolve(tr.selection.from);
            for (let depth = next.depth; depth > 0; depth--) {
              const node = next.node(depth);
              if (node.type === targetType) {
                setItemsChecked(tr, node, next.before(depth), false);
                break;
              }
            }
            dispatch(tr);
          },
          view,
        );
      }
      return wrap(state, dispatch, view);
    }

    const sameType = parent.node.type === targetType;
    const sameKind =
      targetType.name !== 'bullet_list' || parent.node.attrs.kind === targetAttrs.kind;

    if (sameType && sameKind) {
      return liftListItem(listItem)(state, dispatch, view);
    }

    // Convert the existing list to the target type/kind.
    if (dispatch) {
      const tr = state.tr.setNodeMarkup(parent.pos, targetType, targetAttrs);
      const checked = targetAttrs.kind === 'task' ? false : null;
      setItemsChecked(tr, parent.node, parent.pos, checked);
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** Whether the selection is inside a list of the given type/kind. */
function isInList(state: EditorState, type: NodeType, kind?: string): boolean {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type === type && (kind === undefined || node.attrs.kind === kind)) return true;
  }
  return false;
}

export function createListCommands(schema: Schema): Record<string, EditorCommand> {
  const n = schema.nodes;
  const cmds: Record<string, EditorCommand> = {};
  if (!n.list_item) return cmds;

  if (n.bullet_list) {
    const run = toggleList(schema, n.bullet_list, { kind: 'bullet' });
    cmds.bulletList = {
      run,
      isActive: (state) => isInList(state, n.bullet_list, 'bullet'),
    };
  }
  if (n.ordered_list) {
    const run = toggleList(schema, n.ordered_list, { order: 1 });
    cmds.orderedList = {
      run,
      isActive: (state) => isInList(state, n.ordered_list),
    };
  }
  if (n.bullet_list) {
    const run = toggleList(schema, n.bullet_list, { kind: 'task' });
    cmds.taskList = {
      run,
      isActive: (state) => isInList(state, n.bullet_list, 'task'),
    };
  }

  const sink = sinkListItem(n.list_item);
  const liftItem = liftListItem(n.list_item);
  cmds.sinkListItem = { run: sink, isEnabled: (state) => sink(state, undefined, undefined) };
  cmds.liftListItem = { run: liftItem, isEnabled: (state) => liftItem(state, undefined, undefined) };

  return cmds;
}

/** The split-list-item command, for Enter handling inside lists. */
export { splitListItem } from 'prosemirror-schema-list';
