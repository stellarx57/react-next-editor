import type { Node as PMNode, Schema } from 'prosemirror-model';
import type { Command } from 'prosemirror-state';
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  mergeCells,
  splitCell,
  toggleHeaderColumn,
  toggleHeaderRow,
} from 'prosemirror-tables';
import { sanitizeImageSrc } from '../../security/sanitize';
import type { EditorCommand } from './helpers';

export interface ImageAttrs {
  src: string;
  alt?: string | null;
  title?: string | null;
  width?: number | null;
}

/** Insert an inline image at the selection, after validating the source. */
export function insertImage(schema: Schema, attrs: ImageAttrs): Command {
  return (state, dispatch) => {
    const type = schema.nodes.image;
    if (!type) return false;
    const src = sanitizeImageSrc(attrs.src);
    if (!src) return false;
    if (dispatch) {
      const node = type.create({
        src,
        alt: attrs.alt ?? null,
        title: attrs.title ?? null,
        width: attrs.width ?? null,
      });
      dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    }
    return true;
  };
}

/** Build a `rows × cols` table node, optionally with a header row. */
export function createTableNode(
  schema: Schema,
  rows: number,
  cols: number,
  withHeaderRow: boolean,
): PMNode | null {
  const { table, table_row, table_cell, table_header } = schema.nodes;
  if (!table || !table_row || !table_cell) return null;
  const headerType = table_header ?? table_cell;

  const rowNodes: PMNode[] = [];
  for (let r = 0; r < rows; r++) {
    const cells: PMNode[] = [];
    for (let c = 0; c < cols; c++) {
      const cellType = withHeaderRow && r === 0 ? headerType : table_cell;
      const cell = cellType.createAndFill();
      if (!cell) return null;
      cells.push(cell);
    }
    rowNodes.push(table_row.create(null, cells));
  }
  return table.create(null, rowNodes);
}

/** Insert a table at the selection. */
export function insertTable(schema: Schema, rows = 3, cols = 3, withHeaderRow = true): Command {
  return (state, dispatch) => {
    const node = createTableNode(schema, rows, cols, withHeaderRow);
    if (!node) return false;
    if (dispatch) dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };
}

/** Re-export the prosemirror-tables editing commands, gated by schema support. */
export function createTableCommands(schema: Schema): Record<string, EditorCommand> {
  if (!schema.nodes.table) return {};
  const wrap = (run: Command): EditorCommand => ({
    run,
    isEnabled: (state) => run(state, undefined, undefined),
  });
  return {
    addRowBefore: wrap(addRowBefore),
    addRowAfter: wrap(addRowAfter),
    deleteRow: wrap(deleteRow),
    addColumnBefore: wrap(addColumnBefore),
    addColumnAfter: wrap(addColumnAfter),
    deleteColumn: wrap(deleteColumn),
    mergeCells: wrap(mergeCells),
    splitCell: wrap(splitCell),
    toggleHeaderRow: wrap(toggleHeaderRow),
    toggleHeaderColumn: wrap(toggleHeaderColumn),
    deleteTable: wrap(deleteTable),
  };
}
