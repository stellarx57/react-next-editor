import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

/**
 * Show placeholder text in an empty document (F-4.7). Adds a node decoration
 * carrying the placeholder as a `data-placeholder` attribute, which the
 * stylesheet renders as ghost text. Purely decorative — never mutates the doc.
 */
export function placeholderPlugin(text: string): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const { doc } = state;
        const isEmpty =
          doc.childCount === 1 &&
          doc.firstChild != null &&
          doc.firstChild.isTextblock &&
          doc.firstChild.content.size === 0;
        if (!isEmpty) return null;
        const decoration = Decoration.node(0, doc.firstChild!.nodeSize, {
          class: 'rne-empty',
          'data-placeholder': text,
        });
        return DecorationSet.create(doc, [decoration]);
      },
    },
  });
}
