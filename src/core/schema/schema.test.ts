import { describe, expect, it } from 'vitest';
import { Node as PMNode } from 'prosemirror-model';
import { buildSchema, defaultSchema } from './schema';

describe('schema construction', () => {
  it('always includes core nodes and ordered structure', () => {
    expect(defaultSchema.nodes.doc).toBeDefined();
    expect(defaultSchema.nodes.paragraph).toBeDefined();
    expect(defaultSchema.nodes.text).toBeDefined();
    expect(defaultSchema.nodes.hard_break).toBeDefined();
  });

  it('includes all marks when fully enabled', () => {
    for (const mark of [
      'strong',
      'em',
      'underline',
      'strikethrough',
      'superscript',
      'subscript',
      'code',
      'link',
      'fontFamily',
      'fontSize',
      'textColor',
      'highlight',
    ]) {
      expect(defaultSchema.marks[mark], `mark ${mark}`).toBeDefined();
    }
  });

  it('includes table and list nodes when enabled', () => {
    expect(defaultSchema.nodes.table).toBeDefined();
    expect(defaultSchema.nodes.table_row).toBeDefined();
    expect(defaultSchema.nodes.table_cell).toBeDefined();
    expect(defaultSchema.nodes.bullet_list).toBeDefined();
    expect(defaultSchema.nodes.ordered_list).toBeDefined();
    expect(defaultSchema.nodes.list_item).toBeDefined();
  });

  it('omits disabled features from the schema', () => {
    const minimal = buildSchema({
      table: false,
      image: false,
      bulletList: false,
      orderedList: false,
      taskList: false,
      link: false,
      highlight: false,
    });
    expect(minimal.nodes.table).toBeUndefined();
    expect(minimal.nodes.image).toBeUndefined();
    expect(minimal.nodes.bullet_list).toBeUndefined();
    expect(minimal.marks.link).toBeUndefined();
    expect(minimal.marks.highlight).toBeUndefined();
    // Core nodes survive.
    expect(minimal.nodes.paragraph).toBeDefined();
    expect(minimal.marks.strong).toBeDefined();
  });

  it('enforces validity: an invalid document shape fails the integrity check', () => {
    // A heading containing a block child is invalid (heading is inline-only).
    const node = PMNode.fromJSON(defaultSchema, {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, align: null, indent: 0, lineHeight: null },
          content: [{ type: 'paragraph' }],
        },
      ],
    });
    expect(() => node.check()).toThrow();
  });

  it('round-trips a valid document through JSON without loss', () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2, align: 'center', indent: 0, lineHeight: null },
          content: [{ type: 'text', text: 'Title' }],
        },
        {
          type: 'paragraph',
          attrs: { align: null, indent: 1, lineHeight: 1.5 },
          content: [
            { type: 'text', marks: [{ type: 'strong' }], text: 'Bold' },
            { type: 'text', text: ' and ' },
            {
              type: 'text',
              marks: [{ type: 'fontSize', attrs: { size: 14 } }],
              text: 'sized',
            },
          ],
        },
      ],
    };
    const node = PMNode.fromJSON(defaultSchema, json);
    expect(node.toJSON()).toEqual(json);
  });

  it('clamps heading levels to 1..6 on render', () => {
    const node = defaultSchema.nodes.heading.create({ level: 9 });
    expect(node.attrs.level).toBe(9);
    // toDOM clamps the tag name even if an out-of-range level slipped in.
    const dom = defaultSchema.nodes.heading.spec.toDOM!(node) as [string, ...unknown[]];
    expect(dom[0]).toBe('h6');
  });
});
