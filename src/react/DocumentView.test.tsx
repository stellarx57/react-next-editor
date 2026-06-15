import { describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { DocumentView } from './DocumentView';
import type { DocumentJSON } from '../config/types';

afterEach(() => cleanup());

const doc: DocumentJSON = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1, align: null, indent: 0, lineHeight: null },
      content: [{ type: 'text', text: 'Title' }],
    },
    {
      type: 'paragraph',
      attrs: { align: null, indent: 0, lineHeight: null },
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', marks: [{ type: 'strong' }], text: 'world' },
      ],
    },
  ],
};

describe('<DocumentView>', () => {
  it('renders document JSON as HTML without mounting an editor', () => {
    const { container } = render(<DocumentView value={doc} />);
    const root = container.querySelector('.rne-document-view');
    expect(root).not.toBeNull();
    // No ProseMirror editing surface is created.
    expect(container.querySelector('.ProseMirror')).toBeNull();
    expect(root!.querySelector('h1')?.textContent).toBe('Title');
    expect(root!.querySelector('strong')?.textContent).toBe('world');
  });

  it('accepts a JSON string and renders the same output', () => {
    const { container } = render(<DocumentView value={JSON.stringify(doc)} />);
    expect(container.querySelector('.rne-document-view h1')?.textContent).toBe('Title');
  });

  it('renders nothing for null/invalid input', () => {
    const { container } = render(<DocumentView value={null} />);
    expect(container.querySelector('.rne-document-view')?.innerHTML).toBe('');
  });

  it('does not emit active content from hostile text (escaped)', async () => {
    const hostile: DocumentJSON = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { align: null, indent: 0, lineHeight: null },
          content: [{ type: 'text', text: '<script>alert(1)</script>' }],
        },
      ],
    };
    const { container } = render(<DocumentView value={hostile} />);
    // Wait for the sanitizer preload to settle, then assert no script element exists.
    await waitFor(() => {
      expect(container.querySelector('.rne-document-view script')).toBeNull();
    });
    expect(container.querySelector('.rne-document-view')?.innerHTML).toContain('&lt;script&gt;');
  });
});
