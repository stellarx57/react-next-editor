import { describe, expect, it, afterEach } from 'vitest';
import { createRef } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { TextSelection } from 'prosemirror-state';
import { Editor } from './Editor';
import type { EditorRef } from './types';
import type { DocumentJSON } from '../config/types';

afterEach(() => cleanup());

const para = (text: string): DocumentJSON => ({
  type: 'paragraph',
  attrs: { align: null, indent: 0, lineHeight: null },
  content: [{ type: 'text', text }],
});

const doc: DocumentJSON = {
  type: 'doc',
  content: [para('First'), para('Second'), para('Third')],
};

describe('click-anywhere: the whole surface places the caret', () => {
  it('a mousedown on the page chrome (outside the editable content) moves the caret', async () => {
    const ref = createRef<EditorRef>();
    const { container } = render(
      <Editor ref={ref} initialContent={doc} persistence={{ enabled: false }} />,
    );
    await waitFor(() => expect(ref.current?.getView()).not.toBeNull());
    const view = ref.current!.getView()!;

    // Start with the caret at the very beginning.
    act(() => {
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
    });
    expect(view.state.selection.from).toBe(1);

    // A mousedown on the canvas chrome (the element itself, not the editable
    // content) is handled by the surface handler. In jsdom there is no layout, so
    // coordinate mapping is unavailable and the handler falls back to the document
    // end — proving the click was handled and the caret was placed.
    const canvas = container.querySelector('.rne-canvas') as HTMLElement;
    act(() => {
      fireEvent.mouseDown(canvas);
    });

    expect(view.state.selection.from).toBeGreaterThan(1);
  });
});
