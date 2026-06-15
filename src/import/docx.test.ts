import { describe, expect, it } from 'vitest';
import type { DocumentJSON } from '../config/types';
import { defaultSchema } from '../core/schema/schema';
import { documentToDocxBuffer } from '../export/docx';
import { documentToText } from '../export/text';
import { importDocx } from './docx';

const source: DocumentJSON = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1, align: null, indent: 0, lineHeight: null },
      content: [{ type: 'text', text: 'Judgement of the Tribunal' }],
    },
    {
      type: 'paragraph',
      attrs: { align: null, indent: 0, lineHeight: null },
      content: [
        { type: 'text', text: 'This decision is ' },
        { type: 'text', marks: [{ type: 'strong' }], text: 'final' },
        { type: 'text', text: ' and ' },
        { type: 'text', marks: [{ type: 'em' }], text: 'binding' },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'bullet_list',
      attrs: { kind: 'bullet' },
      content: [
        {
          type: 'list_item',
          attrs: { checked: null },
          content: [
            {
              type: 'paragraph',
              attrs: { align: null, indent: 0, lineHeight: null },
              content: [{ type: 'text', text: 'First ground' }],
            },
          ],
        },
        {
          type: 'list_item',
          attrs: { checked: null },
          content: [
            {
              type: 'paragraph',
              attrs: { align: null, indent: 0, lineHeight: null },
              content: [{ type: 'text', text: 'Second ground' }],
            },
          ],
        },
      ],
    },
  ],
};

describe('importDocx (round-trip from our own exporter)', () => {
  it('imports a generated .docx and preserves text content and structure', async () => {
    const buffer = await documentToDocxBuffer(source);
    const result = await importDocx(new Uint8Array(buffer), defaultSchema);

    expect(result.doc.type).toBe('doc');
    const text = documentToText(result.doc);
    expect(text).toContain('Judgement of the Tribunal');
    expect(text).toContain('This decision is final and binding.');
    expect(text).toContain('First ground');
    expect(text).toContain('Second ground');

    // The first block is a heading, and the document contains a list.
    const types = (result.doc.content ?? []).map((n) => n.type);
    expect(types).toContain('heading');
    const hasList = (result.doc.content ?? []).some(
      (n) => n.type === 'bullet_list' || n.type === 'ordered_list',
    );
    expect(hasList).toBe(true);
  });

  it('preserves inline emphasis marks', async () => {
    const buffer = await documentToDocxBuffer(source);
    const result = await importDocx(new Uint8Array(buffer), defaultSchema);
    const json = JSON.stringify(result.doc);
    // Bold and italic survive the round-trip as marks.
    expect(json).toContain('"strong"');
    expect(json).toContain('"em"');
  });

  it('produces a schema-valid document and surfaces warnings array', async () => {
    const buffer = await documentToDocxBuffer(source);
    const result = await importDocx(new Uint8Array(buffer), defaultSchema);
    // Re-parsing the JSON must succeed (valid document).
    expect(() => JSON.parse(JSON.stringify(result.doc))).not.toThrow();
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});
