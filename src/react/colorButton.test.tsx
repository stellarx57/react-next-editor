import { describe, expect, it } from 'vitest';
import { createRef } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { TextSelection } from 'prosemirror-state';
import { Editor } from './Editor';
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

/** Select all text in the first paragraph via the live view. */
function selectAll(ref: EditorRef) {
  const view = ref.getView()!;
  const end = view.state.doc.content.size - 1;
  act(() => {
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, end)));
  });
}

describe('ColorButton custom color', () => {
  it('renders a custom color input in the text-color popover', async () => {
    const { container } = render(<Editor initialContent={initial} persistence={{ enabled: false }} />);
    await waitFor(() => expect(container.querySelector('.rne-toolbar')).not.toBeNull());

    const colorBtn = container.querySelector('[aria-label="Text color"]') as HTMLButtonElement;
    expect(colorBtn).not.toBeNull();
    act(() => colorBtn.click());

    const input = container.querySelector('[aria-label="Text color: custom color"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.type).toBe('color');
  });

  it('applies an arbitrary chosen color to the selection', async () => {
    const ref = createRef<EditorRef>();
    const { container } = render(
      <Editor ref={ref} initialContent={initial} persistence={{ enabled: false }} />,
    );
    await waitFor(() => expect(ref.current?.getView()).not.toBeNull());

    selectAll(ref.current!);

    const colorBtn = container.querySelector('[aria-label="Text color"]') as HTMLButtonElement;
    act(() => colorBtn.click());

    const input = container.querySelector('[aria-label="Text color: custom color"]') as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: '#123abc' } });
    });

    expect(ref.current!.getHTML()).toContain('color: #123abc');
  });
});
