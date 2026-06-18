import { describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { RichTextField, type RichTextFieldRef } from './RichTextField';
import type { DocumentJSON } from '../config/types';

afterEach(() => cleanup());

const seed: DocumentJSON = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { align: null, indent: 0, lineHeight: null },
      content: [{ type: 'text', text: 'Start' }],
    },
  ],
};

/** Insert text at the document start via the live view (triggers onChange). */
function typeViaView(api: RichTextFieldRef | null, text: string) {
  const view = api?.getView();
  if (!view) throw new Error('view not ready');
  act(() => {
    view.dispatch(view.state.tr.insertText(text, 1));
  });
}

describe('<RichTextField>', () => {
  it('emits a JSON string plus derived text/html on change (debounce 0)', async () => {
    const apiRef: { current: RichTextFieldRef | null } = { current: null };
    const onChange = vi.fn();
    render(
      <RichTextField
        apiRef={apiRef}
        value={JSON.stringify(seed)}
        debounceMs={0}
        onChange={onChange}
        persistence={{ enabled: false }}
      />,
    );
    await waitFor(() => expect(apiRef.current?.getView()).not.toBeNull());

    typeViaView(apiRef.current, 'X');

    expect(onChange).toHaveBeenCalled();
    const [value, meta] = onChange.mock.calls.at(-1)!;
    expect(typeof value).toBe('string');
    expect(JSON.parse(value).type).toBe('doc');
    expect(meta.text).toContain('XStart');
    expect(meta.html).toContain('XStart');
    expect(meta.json.type).toBe('doc');
  });

  it('debounces onChange and flushes synchronously via commit()', async () => {
    const apiRef: { current: RichTextFieldRef | null } = { current: null };
    const onChange = vi.fn();
    render(
      <RichTextField
        apiRef={apiRef}
        value={JSON.stringify(seed)}
        debounceMs={10000}
        onChange={onChange}
        persistence={{ enabled: false }}
      />,
    );
    await waitFor(() => expect(apiRef.current?.getView()).not.toBeNull());

    typeViaView(apiRef.current, 'Y');
    // With a long debounce the change has not been emitted yet.
    expect(onChange).not.toHaveBeenCalled();

    act(() => apiRef.current!.commit());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][1].text).toContain('YStart');
  });

  it('adds Download Word/PDF actions when download is set', async () => {
    const { container } = render(
      <RichTextField value={JSON.stringify(seed)} download persistence={{ enabled: false }} />,
    );
    await waitFor(() => expect(container.querySelector('.rne-toolbar')).not.toBeNull());
    expect(container.querySelector('[aria-label="Download Word"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Download PDF"]')).not.toBeNull();
  });

  it('hides the import action by default and shows it when allowDocxImport is set', async () => {
    const { container, rerender } = render(
      <RichTextField value={JSON.stringify(seed)} persistence={{ enabled: false }} />,
    );
    await waitFor(() => expect(container.querySelector('.rne-toolbar')).not.toBeNull());
    expect(container.querySelector('[aria-label="Import .docx"]')).toBeNull();

    rerender(
      <RichTextField value={JSON.stringify(seed)} allowDocxImport persistence={{ enabled: false }} />,
    );
    await waitFor(() =>
      expect(container.querySelector('[aria-label="Import .docx"]')).not.toBeNull(),
    );
  });
});
