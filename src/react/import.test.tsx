import { describe, expect, it } from 'vitest';
import { createRef } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { Editor } from './Editor';
import type { EditorRef } from './types';
import type { DocumentJSON } from '../config/types';
import { documentToDocxBuffer } from '../export/docx';

afterEach(() => cleanup());

const emptyStart: DocumentJSON = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { align: null, indent: 0, lineHeight: null },
      content: [{ type: 'text', text: 'placeholder' }],
    },
  ],
};

const docToImport: DocumentJSON = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1, align: null, indent: 0, lineHeight: null },
      content: [{ type: 'text', text: 'Imported Heading' }],
    },
    {
      type: 'paragraph',
      attrs: { align: null, indent: 0, lineHeight: null },
      content: [{ type: 'text', text: 'Imported body paragraph.' }],
    },
  ],
};

describe('<Editor> DOCX import via ref', () => {
  it('imports a .docx file and replaces the document content', async () => {
    const ref = createRef<EditorRef>();
    render(<Editor ref={ref} initialContent={emptyStart} persistence={{ enabled: false }} />);
    await waitFor(() => expect(ref.current?.getView()).not.toBeNull());

    const buffer = await documentToDocxBuffer(docToImport);

    let warnings: string[] = [];
    await act(async () => {
      const result = await ref.current!.importDocx(new Uint8Array(buffer));
      warnings = result.warnings;
    });

    const text = ref.current!.getText();
    expect(text).toContain('Imported Heading');
    expect(text).toContain('Imported body paragraph.');
    expect(text).not.toContain('placeholder');
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('renders an import button in the toolbar by default', async () => {
    const { container } = render(
      <Editor initialContent={emptyStart} persistence={{ enabled: false }} />,
    );
    await waitFor(() => expect(container.querySelector('.rne-toolbar')).not.toBeNull());
    expect(container.querySelector('[aria-label="Import .docx"]')).not.toBeNull();
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
  });

  it('omits the import button when the feature is disabled', async () => {
    const { container } = render(
      <Editor
        initialContent={emptyStart}
        persistence={{ enabled: false }}
        features={{ docxImport: false }}
      />,
    );
    await waitFor(() => expect(container.querySelector('.rne-toolbar')).not.toBeNull());
    expect(container.querySelector('[aria-label="Import .docx"]')).toBeNull();
  });
});
