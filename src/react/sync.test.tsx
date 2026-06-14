import { describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { Editor } from './Editor';
import type { EditorRef } from './types';
import { MemoryStore } from '../persistence/memory';
import type { DocumentJSON } from '../config/types';
import type { RemoteSyncAdapter } from '../persistence/types';

afterEach(() => cleanup());

const initial: DocumentJSON = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { align: null, indent: 0, lineHeight: null },
      content: [{ type: 'text', text: 'Start' }],
    },
  ],
};

describe('<Editor> auto-sync wiring (F-9.6, F-9.14)', () => {
  it('persists locally then uploads to the remote adapter on edit', async () => {
    const ref = createRef<EditorRef>();
    const store = new MemoryStore();
    const save = vi.fn<RemoteSyncAdapter['save']>(async () => ({ version: 7 }));
    const remote: RemoteSyncAdapter = { save, ping: async () => true };
    const statuses: string[] = [];

    render(
      <Editor
        ref={ref}
        documentId="doc-sync-1"
        initialContent={initial}
        persistence={{ enabled: true, store, debounceMs: 5, requestPersistent: false }}
        sync={{ remote, pingIntervalMs: 0 }}
        onSaveStatusChange={(s) => statuses.push(s)}
      />,
    );

    await waitFor(() => expect(ref.current?.getView()).not.toBeNull());

    // Make a real edit (goes through dispatchTransaction → autosave → outbox → sync).
    act(() => {
      const view = ref.current!.getView()!;
      view.dispatch(view.state.tr.insertText('!', 6));
    });

    await waitFor(() => expect(save).toHaveBeenCalled(), { timeout: 2000 });

    // The document was uploaded and the dirty flag cleared with the server version.
    const record = await store.getDocument('doc-sync-1');
    expect(record?.dirty).toBe(false);
    expect(record?.baseVersion).toBe(7);
    expect(statuses).toContain('savedLocal');
    await waitFor(() => expect(statuses).toContain('synced'));
  });

  it('does not attempt sync when no remote adapter is configured', async () => {
    const ref = createRef<EditorRef>();
    const store = new MemoryStore();
    render(
      <Editor
        ref={ref}
        documentId="doc-local-only"
        initialContent={initial}
        persistence={{ enabled: true, store, debounceMs: 5, requestPersistent: false }}
      />,
    );
    await waitFor(() => expect(ref.current?.getView()).not.toBeNull());
    act(() => {
      const view = ref.current!.getView()!;
      view.dispatch(view.state.tr.insertText('!', 6));
    });
    // The edit is queued in the durable outbox for a future session/sync.
    await waitFor(async () => {
      const outbox = await store.listOutbox();
      expect(outbox.length).toBe(1);
    });
  });
});
