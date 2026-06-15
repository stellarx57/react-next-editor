import { describe, expect, it } from 'vitest';
import { createRef } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { Editor } from './Editor';
import type { EditorRef } from './types';
import type { DocumentJSON } from '../config/types';

afterEach(() => cleanup());

function longDoc(paragraphs: number): DocumentJSON {
  return {
    type: 'doc',
    content: Array.from({ length: paragraphs }, (_, i) => ({
      type: 'paragraph',
      attrs: { align: null, indent: 0, lineHeight: null },
      content: [{ type: 'text', text: `Paragraph number ${i + 1}.` }],
    })),
  };
}

describe('<Editor> visual pagination', () => {
  it('renders the paged structure (sheets layer + content layer) without crashing', async () => {
    const { container } = render(
      <Editor
        initialContent={longDoc(40)}
        persistence={{ enabled: false }}
        page={{
          pagination: 'visual',
          header: { show: true, text: 'Case No. 123' },
          footer: { pageNumbers: true },
        }}
      />,
    );
    await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull());
    // The paged container, background layer and content layer are present.
    expect(container.querySelector('.rne-paged')).not.toBeNull();
    expect(container.querySelector('.rne-page-bg')).not.toBeNull();
    expect(container.querySelector('.rne-mount--paged')).not.toBeNull();
    expect(container.querySelector('.rne-canvas--paged')).not.toBeNull();
  });

  it('preserves document integrity in paged mode (no content mutation)', async () => {
    const ref = createRef<EditorRef>();
    const doc = longDoc(30);
    render(
      <Editor
        ref={ref}
        initialContent={doc}
        persistence={{ enabled: false }}
        page={{ pagination: 'visual' }}
      />,
    );
    await waitFor(() => expect(ref.current?.getView()).not.toBeNull());
    // Pagination is purely visual: the document JSON is unchanged.
    const json = ref.current!.getJSON();
    expect(json.content).toHaveLength(30);
    const text = ref.current!.getText();
    expect(text).toContain('Paragraph number 1.');
    expect(text).toContain('Paragraph number 30.');
  });

  it('renders the single-flow page surface when pagination is off (default)', async () => {
    const { container } = render(
      <Editor initialContent={longDoc(5)} persistence={{ enabled: false }} />,
    );
    await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull());
    expect(container.querySelector('.rne-page')).not.toBeNull();
    expect(container.querySelector('.rne-paged')).toBeNull();
  });

  it('stays editable in paged mode', async () => {
    const ref = createRef<EditorRef>();
    render(
      <Editor
        ref={ref}
        initialContent={longDoc(10)}
        persistence={{ enabled: false }}
        page={{ pagination: 'visual' }}
      />,
    );
    await waitFor(() => expect(ref.current?.getView()).not.toBeNull());
    act(() => {
      const view = ref.current!.getView()!;
      view.dispatch(view.state.tr.insertText('!', 1));
    });
    expect(ref.current!.getText()).toContain('!Paragraph number 1.');
  });
});
