import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { buildSchema } from '../schema/schema';
import { createCommands } from './index';
import { createDoc } from '../state/createEditorState';
import { documentToHtml } from '../../export/html';

const schema = buildSchema({});
const commands = createCommands(schema);

function selectedState(): EditorState {
  const doc = createDoc(schema, {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
  });
  const base = EditorState.create({ schema, doc });
  // Select "Hello" (positions 1..6).
  return base.apply(base.tr.setSelection(TextSelection.create(base.doc, 1, 6)));
}

function apply(state: EditorState, command: ReturnType<typeof commands.marks.setTextColor>): EditorState {
  let next = state;
  command(state, (tr) => {
    next = state.apply(tr);
  });
  return next;
}

describe('text color command', () => {
  it('applies a text color to the selection', () => {
    const state = apply(selectedState(), commands.marks.setTextColor('#df4a36'));
    expect(documentToHtml(state.doc.toJSON() as never)).toContain('color: #df4a36');
    expect(commands.marks.getActiveTextColor(state)).toBe('#df4a36');
  });

  it('updates an existing color to a new color (replaces, not stacks)', () => {
    let state = apply(selectedState(), commands.marks.setTextColor('#df4a36'));
    state = apply(state, commands.marks.setTextColor('#6aa84f'));
    const html = documentToHtml(state.doc.toJSON() as never);
    expect(html).toContain('color: #6aa84f');
    expect(html).not.toContain('#df4a36');
    expect(commands.marks.getActiveTextColor(state)).toBe('#6aa84f');
  });

  it('clears a text color', () => {
    let state = apply(selectedState(), commands.marks.setTextColor('#df4a36'));
    state = apply(state, commands.marks.clearTextColor());
    expect(documentToHtml(state.doc.toJSON() as never)).not.toContain('color:');
    expect(commands.marks.getActiveTextColor(state)).toBeNull();
  });

  it('accepts an arbitrary custom hex color', () => {
    const state = apply(selectedState(), commands.marks.setTextColor('#123abc'));
    expect(documentToHtml(state.doc.toJSON() as never)).toContain('color: #123abc');
  });
});
