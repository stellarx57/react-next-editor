import { describe, expect, it } from 'vitest';
import { createRef } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { TextSelection } from 'prosemirror-state';
import { Editor } from './Editor';
import { useEditorContext } from './EditorContext';
import type { EditorRef } from './types';
import type { DocumentJSON } from '../config/types';

afterEach(() => cleanup());

const initial: DocumentJSON = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { align: null, indent: 0, lineHeight: null },
      content: [{ type: 'text', text: 'Hello world' }],
    },
  ],
};

/** A custom control that reflects and toggles bold via the editor context. */
function CustomBoldButton() {
  const { commands, run, state } = useEditorContext();
  const active = state ? (commands.registry.bold.isActive?.(state) ?? false) : false;
  return (
    <button
      type="button"
      className="custom-bold"
      data-active={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => run(commands.registry.bold.run)}
    >
      Bold
    </button>
  );
}

describe('<Editor> children + useEditorContext', () => {
  it('renders children inside the context provider and exposes editor context', async () => {
    const { container } = render(
      <Editor initialContent={initial} toolbar={false} persistence={{ enabled: false }}>
        <CustomBoldButton />
      </Editor>,
    );
    await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull());
    // The built-in toolbar is hidden; the custom control is rendered.
    expect(container.querySelector('.rne-toolbar')).toBeNull();
    expect(container.querySelector('.custom-bold')).not.toBeNull();
  });

  it('a custom control can dispatch commands and reflect active state', async () => {
    const ref = createRef<EditorRef>();
    const { container } = render(
      <Editor ref={ref} initialContent={initial} toolbar={false} persistence={{ enabled: false }}>
        <CustomBoldButton />
      </Editor>,
    );
    await waitFor(() => expect(ref.current?.getView()).not.toBeNull());

    // Select the paragraph text, then toggle bold through the custom control.
    act(() => {
      const view = ref.current!.getView()!;
      const sel = TextSelection.create(view.state.doc, 1, view.state.doc.content.size - 1);
      view.dispatch(view.state.tr.setSelection(sel));
    });

    const button = container.querySelector('.custom-bold') as HTMLButtonElement;
    expect(button.getAttribute('data-active')).toBe('false');
    act(() => button.click());

    expect(button.getAttribute('data-active')).toBe('true');
    expect(ref.current!.getHTML()).toContain('<strong>');
  });
});
