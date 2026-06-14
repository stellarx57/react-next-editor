import { describe, expect, it } from 'vitest';
import type { DocumentJSON } from '../config/types';
import { documentToText } from './text';
import { documentToHtml, buildPrintDocument } from './html';
import { documentToDocxBuffer } from './docx';
import { DEFAULT_PAGE } from '../config/defaults';

const sample: DocumentJSON = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1, align: 'center', indent: 0, lineHeight: null },
      content: [{ type: 'text', text: 'Judgement' }],
    },
    {
      type: 'paragraph',
      attrs: { align: null, indent: 0, lineHeight: null },
      content: [
        { type: 'text', text: 'In the matter of ' },
        { type: 'text', marks: [{ type: 'strong' }], text: 'Case 123' },
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
              content: [{ type: 'text', text: 'First point' }],
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
              content: [{ type: 'text', text: 'Second point' }],
            },
          ],
        },
      ],
    },
    {
      type: 'table',
      content: [
        {
          type: 'table_row',
          content: [
            {
              type: 'table_header',
              attrs: { colspan: 1, rowspan: 1, colwidth: null, background: null, align: null },
              content: [
                {
                  type: 'paragraph',
                  attrs: { align: null, indent: 0, lineHeight: null },
                  content: [{ type: 'text', text: 'Party' }],
                },
              ],
            },
            {
              type: 'table_cell',
              attrs: { colspan: 1, rowspan: 1, colwidth: null, background: null, align: null },
              content: [
                {
                  type: 'paragraph',
                  attrs: { align: null, indent: 0, lineHeight: null },
                  content: [{ type: 'text', text: 'Plaintiff' }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('plain-text conversion', () => {
  it('follows the documented structure rules', () => {
    const text = documentToText(sample);
    expect(text).toContain('Judgement');
    expect(text).toContain('In the matter of Case 123.');
    expect(text).toContain('- First point');
    expect(text).toContain('- Second point');
    // Table cells are tab-delimited.
    expect(text).toContain('Party\tPlaintiff');
  });

  it('optionally appends link URLs', () => {
    const doc: DocumentJSON = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { align: null, indent: 0, lineHeight: null },
          content: [
            {
              type: 'text',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
              text: 'site',
            },
          ],
        },
      ],
    };
    expect(documentToText(doc, { includeLinkUrls: true })).toBe('site (https://example.com)');
    expect(documentToText(doc)).toBe('site');
  });
});

describe('HTML conversion', () => {
  it('escapes text and emits expected structure', () => {
    const doc: DocumentJSON = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { align: null, indent: 0, lineHeight: null },
          content: [{ type: 'text', text: '<script>alert(1)</script>' }],
        },
      ],
    };
    const html = documentToHtml(doc);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('builds a standalone print document with page CSS', () => {
    const html = buildPrintDocument(sample, DEFAULT_PAGE, 'Judgement');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('@page');
    expect(html).toContain('Judgement');
  });
});

describe('DOCX conversion', () => {
  it('produces a valid, non-empty .docx buffer (zip signature PK)', async () => {
    const buffer = await documentToDocxBuffer(sample, { page: DEFAULT_PAGE, title: 'Judgement' });
    expect(buffer.length).toBeGreaterThan(1000);
    // DOCX is a zip; first two bytes are 'PK'.
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it('supports custom node converters', async () => {
    const doc: DocumentJSON = {
      type: 'doc',
      content: [{ type: 'signature', attrs: { name: 'Registrar' } }],
    };
    const buffer = await documentToDocxBuffer(doc, {
      nodeConverters: {
        signature: (node, ctx) => [
          new ctx.docx.Paragraph({
            children: [new ctx.docx.TextRun({ text: `Signed: ${String(node.attrs?.name)}` })],
          }),
        ],
      },
    });
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
