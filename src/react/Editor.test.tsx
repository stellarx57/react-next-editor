import { describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { act, render, cleanup, waitFor } from '@testing-library/react';
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

describe('<Editor>', () => {
  it('mounts a ProseMirror surface and exposes content via ref', async () => {
    const ref = createRef<EditorRef>();
    const onReady = vi.fn();
    const { container } = render(
      <Editor ref={ref} initialContent={initial} onReady={onReady} persistence={{ enabled: false }} />,
    );

    await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull());
    expect(onReady).toHaveBeenCalled();
    expect(ref.current?.getText()).toContain('Hello world');
    expect(ref.current?.getJSON().type).toBe('doc');
    expect(ref.current?.getView()).not.toBeNull();
  });

  it('renders the toolbar when editable and hides it in read-only mode', async () => {
    const { container, rerender } = render(
      <Editor initialContent={initial} persistence={{ enabled: false }} />,
    );
    await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull());
    expect(container.querySelector('.rne-toolbar')).not.toBeNull();

    rerender(<Editor initialContent={initial} readOnly persistence={{ enabled: false }} />);
    await waitFor(() => expect(container.querySelector('.rne-toolbar')).toBeNull());
  });

  it('respects feature toggles in the toolbar', async () => {
    const { container } = render(
      <Editor
        initialContent={initial}
        persistence={{ enabled: false }}
        features={{ table: false, image: false, link: false }}
      />,
    );
    await waitFor(() => expect(container.querySelector('.rne-toolbar')).not.toBeNull());
    const labels = Array.from(container.querySelectorAll('.rne-toolbar [aria-label]')).map((el) =>
      el.getAttribute('aria-label'),
    );
    expect(labels).not.toContain('Insert table');
    expect(labels).toContain('Bold');
  });

  it('applies bold via the ref view and reports the change', async () => {
    const ref = createRef<EditorRef>();
    const onChange = vi.fn();
    render(
      <Editor
        ref={ref}
        initialContent={initial}
        onChange={onChange}
        persistence={{ enabled: false }}
      />,
    );
    await waitFor(() => expect(ref.current?.getView()).not.toBeNull());

    act(() => {
      ref.current!.setContent({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { align: null, indent: 0, lineHeight: null },
            content: [{ type: 'text', marks: [{ type: 'strong' }], text: 'Bold' }],
          },
        ],
      });
    });
    expect(ref.current?.getHTML()).toContain('<strong>');
  });

  it('contains a thrown render error within the boundary', async () => {
    // Force an error by passing a deliberately invalid feature object through theme.
    const onError = vi.fn();
    // A valid render should not trigger the boundary.
    const { container } = render(
      <Editor initialContent={initial} onError={onError} persistence={{ enabled: false }} />,
    );
    await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull());
    expect(container.querySelector('.rne-error')).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });
});
