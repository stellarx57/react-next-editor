import type { MarkType, Schema } from 'prosemirror-model';
import type { Command, EditorState } from 'prosemirror-state';
import { sanitizeUrl } from '../../security/sanitize';
import { type EditorCommand, getActiveMarkAttrs, isMarkActive } from './helpers';

export interface LinkAttrs {
  href: string;
  title?: string | null;
  target?: string;
}

/** Find the document range covered by a link mark around a position. */
function linkRangeAt(
  state: EditorState,
  type: MarkType,
  pos: number,
): { from: number; to: number } | null {
  const $pos = state.doc.resolve(pos);
  const mark = type.isInSet($pos.marks());
  if (!mark) return null;
  let start = pos;
  let end = pos;
  // Walk left and right while the same link mark is present.
  while (start > 0 && mark.isInSet(state.doc.resolve(start - 1).marks())) start--;
  const docSize = state.doc.content.size;
  while (end < docSize && mark.isInSet(state.doc.resolve(end + 1).marks())) end++;
  return { from: start, to: end };
}

/** Apply or update a link over the selection (or insert the URL as linked text). */
export function setLink(type: MarkType, attrs: LinkAttrs): Command {
  return (state, dispatch) => {
    const href = sanitizeUrl(attrs.href);
    if (!href) return false;
    const markAttrs = { href, title: attrs.title ?? null, target: attrs.target ?? '_blank' };
    const { empty, from, to } = state.selection;

    if (dispatch) {
      const tr = state.tr;
      if (empty) {
        const text = state.schema.text(href, [type.create(markAttrs)]);
        tr.replaceSelectionWith(text, false);
      } else {
        tr.addMark(from, to, type.create(markAttrs));
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** Remove the link mark, expanding an empty selection to the full link range. */
export function removeLink(type: MarkType): Command {
  return (state, dispatch) => {
    const { empty, from, to } = state.selection;
    if (empty) {
      const range = linkRangeAt(state, type, from);
      if (!range) return false;
      if (dispatch) dispatch(state.tr.removeMark(range.from, range.to, type));
      return true;
    }
    if (!state.doc.rangeHasMark(from, to, type)) return false;
    if (dispatch) dispatch(state.tr.removeMark(from, to, type));
    return true;
  };
}

export function createLinkCommands(schema: Schema) {
  const type = schema.marks.link;
  if (!type) {
    return {
      commands: {} as Record<string, EditorCommand>,
      setLink: (() => false) as Command,
      removeLink: (() => false) as Command,
      getActiveLink: (_state: EditorState): LinkAttrs | null => null,
      isLinkActive: (_state: EditorState): boolean => false,
    };
  }
  const commands: Record<string, EditorCommand> = {
    removeLink: {
      run: removeLink(type),
      isEnabled: (state) => isMarkActive(state, type),
    },
  };
  return {
    commands,
    setLink: (attrs: LinkAttrs): Command => setLink(type, attrs),
    removeLink: removeLink(type),
    getActiveLink: (state: EditorState): LinkAttrs | null =>
      getActiveMarkAttrs(state, type) as LinkAttrs | null,
    isLinkActive: (state: EditorState): boolean => isMarkActive(state, type),
  };
}
