import { Plugin } from 'prosemirror-state';
import type { Schema } from 'prosemirror-model';

/**
 * Make task-list checkboxes interactive. Clicking the rendered checkbox toggles
 * the `checked` attribute of the enclosing `list_item`. Implemented via a DOM
 * mousedown handler so it works without a custom node view. No-op when the
 * editor is not editable.
 */
export function taskListPlugin(schema: Schema): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          if (!view.editable) return false;
          const target = event.target as HTMLElement | null;
          if (!target || !target.classList?.contains('rne-task-checkbox')) return false;

          // posAtDOM / resolve can throw for a transiently-detached node; never
          // let a stray click break the editor (F-11.1).
          try {
            const pos = view.posAtDOM(target, 0);
            if (pos == null || pos < 0) return false;

            const $pos = view.state.doc.resolve(pos);
            for (let depth = $pos.depth; depth > 0; depth--) {
              const node = $pos.node(depth);
              if (node.type === schema.nodes.list_item && node.attrs.checked !== null) {
                const itemPos = $pos.before(depth);
                const tr = view.state.tr.setNodeAttribute(itemPos, 'checked', !node.attrs.checked);
                view.dispatch(tr);
                event.preventDefault();
                return true;
              }
            }
          } catch {
            return false;
          }
          return false;
        },
      },
    },
  });
}
