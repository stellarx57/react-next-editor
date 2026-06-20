import { describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { Editor } from './Editor';
import type { EditorRef } from './types';
import { MemoryStore } from '../persistence/memory';
import type { DocumentJSON } from '../config/types';
import type { StoredDocument } from '../persistence/types';

afterEach(() => cleanup());

function para(text: string): DocumentJSON {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { align: null, indent: 0, lineHeight: null },
        content: [{ type: 'text', text }],
      },
    ],
  };
}

const serverValue = para('Server content');

function draftRecord(id: string, text: string, dirty: boolean): StoredDocument {
  return { id, doc: para(text), rev: 1, baseVersion: dirty ? null : 1, dirty, updatedAt: 1700 };
}

describe('offline draft restore over a controlled value', () => {
  it('restores an unsaved (dirty) draft and notifies, so reopened offline work is seen', async () => {
    const store = new MemoryStore();
    await store.putDocument(draftRecord('doc-dirty', 'Offline draft', true));

    const ref = createRef<EditorRef>();
    const onChange = vi.fn();
    const onLocalRestore = vi.fn();
    render(
      <Editor
        ref={ref}
        documentId="doc-dirty"
        value={serverValue}
        onChange={onChange}
        onLocalRestore={onLocalRestore}
        persistence={{ enabled: true, store, requestPersistent: false }}
      />,
    );

    await waitFor(() => expect(ref.current?.getView()).not.toBeNull());
    // The unsaved offline draft is surfaced over the controlled/server value.
    await waitFor(() => expect(ref.current?.getText()).toContain('Offline draft'));
    expect(ref.current?.getText()).not.toContain('Server content');
    // The controlled parent is told (so a later save persists the draft, not the
    // pre-restore value) and the host is notified of the restore.
    expect(onChange).toHaveBeenCalled();
    await waitFor(() => expect(onLocalRestore).toHaveBeenCalled());
    expect(onLocalRestore.mock.calls[0][0]).toMatchObject({ updatedAt: 1700, rev: 1 });
  });

  it('does NOT restore a clean (synced) draft — the controlled value wins', async () => {
    const store = new MemoryStore();
    await store.putDocument(draftRecord('doc-clean', 'Stale synced draft', false));

    const ref = createRef<EditorRef>();
    const onLocalRestore = vi.fn();
    render(
      <Editor
        ref={ref}
        documentId="doc-clean"
        value={serverValue}
        onLocalRestore={onLocalRestore}
        persistence={{ enabled: true, store, requestPersistent: false }}
      />,
    );

    await waitFor(() => expect(ref.current?.getView()).not.toBeNull());
    // Give the async load a tick; the server content must remain.
    await new Promise((r) => setTimeout(r, 20));
    expect(ref.current?.getText()).toContain('Server content');
    expect(ref.current?.getText()).not.toContain('Stale synced draft');
    expect(onLocalRestore).not.toHaveBeenCalled();
  });

  it('defers to onLocalDraft (does not auto-apply); restore() applies, discard() drops', async () => {
    const store = new MemoryStore();
    await store.putDocument(draftRecord('doc-prompt', 'Offline draft', true));

    const ref = createRef<EditorRef>();
    let actions: { restore: () => void; discard: () => Promise<void> } | null = null;
    const onLocalDraft = vi.fn((_draft, a) => {
      actions = a;
    });

    render(
      <Editor
        ref={ref}
        documentId="doc-prompt"
        value={serverValue}
        onLocalDraft={onLocalDraft}
        persistence={{ enabled: true, store, requestPersistent: false }}
      />,
    );

    await waitFor(() => expect(ref.current?.getView()).not.toBeNull());
    await waitFor(() => expect(onLocalDraft).toHaveBeenCalled());
    // The draft is NOT applied automatically — the server value remains on screen.
    expect(ref.current?.getText()).toContain('Server content');
    expect(ref.current?.getText()).not.toContain('Offline draft');

    // Host approves → the draft is applied.
    act(() => actions!.restore());
    await waitFor(() => expect(ref.current?.getText()).toContain('Offline draft'));
  });

  it('onLocalDraft discard() purges the local draft', async () => {
    const store = new MemoryStore();
    await store.putDocument(draftRecord('doc-discard', 'Offline draft', true));

    const ref = createRef<EditorRef>();
    let actions: { restore: () => void; discard: () => Promise<void> } | null = null;
    render(
      <Editor
        ref={ref}
        documentId="doc-discard"
        value={serverValue}
        onLocalDraft={(_d, a) => {
          actions = a;
        }}
        persistence={{ enabled: true, store, requestPersistent: false }}
      />,
    );
    await waitFor(() => expect(ref.current?.getView()).not.toBeNull());
    await waitFor(() => expect(actions).not.toBeNull());

    await act(async () => {
      await actions!.discard();
    });
    expect(await store.getDocument('doc-discard')).toBeNull();
    // Content stays on the server value (draft was dropped, not applied).
    expect(ref.current?.getText()).toContain('Server content');
  });

  it("'whenEmpty' keeps the controlled value even for a dirty draft", async () => {
    const store = new MemoryStore();
    await store.putDocument(draftRecord('doc-empty', 'Dirty draft', true));

    const ref = createRef<EditorRef>();
    render(
      <Editor
        ref={ref}
        documentId="doc-empty"
        value={serverValue}
        persistence={{ enabled: true, store, requestPersistent: false, restore: 'whenEmpty' }}
      />,
    );

    await waitFor(() => expect(ref.current?.getView()).not.toBeNull());
    await new Promise((r) => setTimeout(r, 20));
    expect(ref.current?.getText()).toContain('Server content');
    expect(ref.current?.getText()).not.toContain('Dirty draft');
  });
});
