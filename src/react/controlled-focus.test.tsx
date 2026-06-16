import { describe, expect, it, afterEach } from 'vitest';
import { createRef } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { Editor } from './Editor';
import type { EditorRef } from './types';
import type { DocumentJSON } from '../config/types';

afterEach(() => cleanup());

const docA: DocumentJSON = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { align: null, indent: 0, lineHeight: null },
      content: [{ type: 'text', text: 'AAA' }],
    },
  ],
};
const docB: DocumentJSON = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { align: null, indent: 0, lineHeight: null },
      content: [{ type: 'text', text: 'BBB' }],
    },
  ],
};

describe('controlled value reconciliation (input latency fix)', () => {
  it('does NOT reconcile an external value while the editor is focused', async () => {
    const ref = createRef<EditorRef>();
    const { rerender } = render(
      <Editor ref={ref} value={docA} onChange={() => {}} persistence={{ enabled: false }} />,
    );
    await waitFor(() => expect(ref.current?.getView()).not.toBeNull());

    act(() => ref.current!.getView()!.focus());
    expect(ref.current!.getView()!.hasFocus()).toBe(true);

    // An external value arrives while typing — it must be ignored (no revert).
    rerender(
      <Editor ref={ref} value={docB} onChange={() => {}} persistence={{ enabled: false }} />,
    );
    expect(ref.current!.getText()).toContain('AAA');
    expect(ref.current!.getText()).not.toContain('BBB');
  });

  it('reconciles an external value when the editor is NOT focused', async () => {
    const ref = createRef<EditorRef>();
    const { rerender } = render(
      <Editor ref={ref} value={docA} onChange={() => {}} persistence={{ enabled: false }} />,
    );
    await waitFor(() => expect(ref.current?.getView()).not.toBeNull());
    expect(ref.current!.getView()!.hasFocus()).toBe(false);

    rerender(
      <Editor ref={ref} value={docB} onChange={() => {}} persistence={{ enabled: false }} />,
    );
    await waitFor(() => expect(ref.current!.getText()).toContain('BBB'));
  });
});
