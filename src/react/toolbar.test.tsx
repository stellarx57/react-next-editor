import { describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
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

describe('Toolbar accessibility', () => {
  it('exposes a labelled toolbar role', async () => {
    const { container } = render(<Editor initialContent={initial} persistence={{ enabled: false }} />);
    await waitFor(() => expect(container.querySelector('.rne-toolbar')).not.toBeNull());
    const toolbar = container.querySelector('.rne-toolbar')!;
    expect(toolbar.getAttribute('role')).toBe('toolbar');
    expect(toolbar.getAttribute('aria-label')).toBeTruthy();
  });

  it('moves focus between controls with arrow keys', async () => {
    const { container } = render(<Editor initialContent={initial} persistence={{ enabled: false }} />);
    await waitFor(() => expect(container.querySelector('.rne-toolbar button')).not.toBeNull());
    const toolbar = container.querySelector('.rne-toolbar') as HTMLElement;
    // The handler navigates among enabled buttons (selects use native arrows).
    const items = Array.from(toolbar.querySelectorAll<HTMLElement>('button:not([disabled])'));
    expect(items.length).toBeGreaterThan(1);

    act(() => items[0]!.focus());
    fireEvent.keyDown(toolbar, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(items[1]);

    fireEvent.keyDown(toolbar, { key: 'End' });
    expect(document.activeElement).toBe(items[items.length - 1]);

    fireEvent.keyDown(toolbar, { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('renders export buttons when a toolbar group requests them', async () => {
    const { container } = render(
      <Editor
        initialContent={initial}
        persistence={{ enabled: false }}
        toolbar={{ groups: [['bold'], ['exportDocx', 'exportPdf']] }}
      />,
    );
    await waitFor(() => expect(container.querySelector('.rne-toolbar')).not.toBeNull());
    expect(container.querySelector('[aria-label="Download Word"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Download PDF"]')).not.toBeNull();
    // Default toolbars (no explicit group) must NOT gain export buttons.
    cleanup();
    const plain = render(<Editor initialContent={initial} persistence={{ enabled: false }} />);
    await waitFor(() => expect(plain.container.querySelector('.rne-toolbar')).not.toBeNull());
    expect(plain.container.querySelector('[aria-label="Download Word"]')).toBeNull();
  });

  it('prompts for alt text when inserting an image (NF-4)', async () => {
    const ref = createRef<EditorRef>();
    const promptSpy = vi
      .spyOn(window, 'prompt')
      .mockReturnValueOnce('https://example.com/a.png') // URL
      .mockReturnValueOnce('A descriptive caption'); // alt

    const { container } = render(
      <Editor ref={ref} initialContent={initial} persistence={{ enabled: false }} />,
    );
    await waitFor(() => expect(container.querySelector('.rne-toolbar')).not.toBeNull());

    const imageBtn = container.querySelector('[aria-label="Image"]') as HTMLButtonElement;
    expect(imageBtn).not.toBeNull();
    act(() => imageBtn.click());

    expect(promptSpy).toHaveBeenCalledTimes(2);
    const json = ref.current!.getJSON();
    const html = ref.current!.getHTML();
    expect(JSON.stringify(json)).toContain('A descriptive caption');
    expect(html).toContain('alt="A descriptive caption"');
    promptSpy.mockRestore();
  });
});
