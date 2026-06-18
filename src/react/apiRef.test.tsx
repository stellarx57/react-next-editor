import { describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
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
      content: [{ type: 'text', text: 'Via apiRef' }],
    },
  ],
};

describe('Editor apiRef prop', () => {
  it('populates the imperative API on a plain ref prop and clears it on unmount', async () => {
    const apiRef: { current: EditorRef | null } = { current: null };
    const { unmount } = render(
      <Editor apiRef={apiRef} initialContent={initial} persistence={{ enabled: false }} />,
    );

    await waitFor(() => expect(apiRef.current?.getView()).not.toBeNull());
    expect(apiRef.current?.getText()).toContain('Via apiRef');
    expect(apiRef.current?.getJSON().type).toBe('doc');
    expect(typeof apiRef.current?.exportAs).toBe('function');

    act(() => unmount());
    expect(apiRef.current).toBeNull();
  });
});
