import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection, type Command } from 'prosemirror-state';
import { Node as PMNode } from 'prosemirror-model';
import { buildSchema, defaultSchema } from '../schema/schema';
import { createCommands } from './index';

function stateWithText(text: string): EditorState {
  const doc = PMNode.fromJSON(defaultSchema, {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { align: null, indent: 0, lineHeight: null },
        content: text ? [{ type: 'text', text }] : [],
      },
    ],
  });
  return EditorState.create({ schema: defaultSchema, doc });
}

function selectAll(state: EditorState): EditorState {
  const sel = TextSelection.create(state.doc, 1, state.doc.content.size - 1);
  return state.apply(state.tr.setSelection(sel));
}

function run(state: EditorState, command: Command): EditorState {
  let next = state;
  command(state, (tr) => {
    next = state.apply(tr);
  });
  return next;
}

describe('command registry', () => {
  const cmds = createCommands(defaultSchema);

  it('applies and reflects bold across a selection', () => {
    let state = selectAll(stateWithText('hello'));
    expect(cmds.registry.bold.isActive!(state)).toBe(false);
    state = run(state, cmds.registry.bold.run);
    expect(cmds.registry.bold.isActive!(state)).toBe(true);
    expect(state.doc.rangeHasMark(1, state.doc.content.size - 1, defaultSchema.marks.strong)).toBe(
      true,
    );
  });

  it('sets and detects a heading level', () => {
    let state = selectAll(stateWithText('Title'));
    state = run(state, cmds.blocks.setHeading(2));
    expect(state.doc.firstChild!.type.name).toBe('heading');
    expect(state.doc.firstChild!.attrs.level).toBe(2);
  });

  it('toggles a bullet list and reflects active state', () => {
    let state = selectAll(stateWithText('item'));
    expect(cmds.registry.bulletList.isActive!(state)).toBe(false);
    state = run(state, cmds.registry.bulletList.run);
    expect(state.doc.firstChild!.type.name).toBe('bullet_list');
    expect(cmds.registry.bulletList.isActive!(state)).toBe(true);
  });

  it('converts a bullet list to a task list', () => {
    let state = selectAll(stateWithText('todo'));
    state = run(state, cmds.registry.bulletList.run);
    state = selectAll(state);
    state = run(state, cmds.registry.taskList.run);
    const list = state.doc.firstChild!;
    expect(list.type.name).toBe('bullet_list');
    expect(list.attrs.kind).toBe('task');
    expect(list.firstChild!.attrs.checked).toBe(false);
  });

  it('applies a font size as an attribute mark', () => {
    let state = selectAll(stateWithText('sized'));
    state = run(state, cmds.marks.setFontSize(18));
    expect(cmds.marks.getActiveFontSize(state)).toBe(18);
  });

  it('sets a link and rejects an unsafe URL', () => {
    let state = selectAll(stateWithText('click'));
    state = run(state, cmds.links.setLink({ href: 'https://example.com' }));
    expect(cmds.links.getActiveLink(state)?.href).toBe('https://example.com');

    let unsafe = selectAll(stateWithText('evil'));
    const before = unsafe.doc.toJSON();
    // eslint-disable-next-line no-script-url
    unsafe = run(unsafe, cmds.links.setLink({ href: 'javascript:alert(1)' }));
    expect(unsafe.doc.toJSON()).toEqual(before);
  });

  it('clears formatting back to a plain paragraph', () => {
    let state = selectAll(stateWithText('formatted'));
    state = run(state, cmds.registry.bold.run);
    state = selectAll(state);
    state = run(state, cmds.blocks.setHeading(1));
    state = selectAll(state);
    state = run(state, cmds.registry.clearFormatting.run);
    expect(state.doc.firstChild!.type.name).toBe('paragraph');
    expect(state.doc.rangeHasMark(1, state.doc.content.size - 1, defaultSchema.marks.strong)).toBe(
      false,
    );
  });

  it('gracefully no-ops commands whose feature is disabled', () => {
    const minimal = createCommands(buildSchema({ link: false, table: false }));
    expect(minimal.registry.bold).toBeDefined();
    expect(minimal.registry.removeLink).toBeUndefined();
    // setLink returns a command that simply does nothing rather than throwing.
    const state = selectAll(stateWithText('text'));
    expect(() => run(state, minimal.links.setLink({ href: 'https://x.io' }))).not.toThrow();
  });
});
