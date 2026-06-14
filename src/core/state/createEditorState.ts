import { Node as PMNode, type Schema } from 'prosemirror-model';
import { EditorState, type Plugin } from 'prosemirror-state';
import type { DocumentJSON } from '../../config/types';

export type EditorContent = DocumentJSON | string | null | undefined;

/**
 * Build a document node from arbitrary initial content, defensively (F-11.4):
 * - `null`/`undefined` → an empty document;
 * - a string → paragraphs split on newlines (plain-text initial content);
 * - ProseMirror JSON → parsed and integrity-checked, falling back to empty on
 *   any error so malformed input can never crash the editor.
 */
export function createDoc(schema: Schema, content: EditorContent): PMNode {
  if (content == null) return emptyDoc(schema);

  if (typeof content === 'string') {
    return docFromText(schema, content);
  }

  try {
    const node = PMNode.fromJSON(schema, content as Record<string, unknown>);
    node.check();
    return node;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[react-next-editor] Invalid initial content, using empty document.', err);
    return emptyDoc(schema);
  }
}

function emptyDoc(schema: Schema): PMNode {
  const doc = schema.nodes.doc.createAndFill();
  if (!doc) throw new Error('Schema cannot create an empty document.');
  return doc;
}

function docFromText(schema: Schema, text: string): PMNode {
  const paragraphType = schema.nodes.paragraph;
  const lines = text.split(/\r\n|\r|\n/);
  const paragraphs = lines.map((line) =>
    line ? paragraphType.create(null, schema.text(line)) : paragraphType.createAndFill()!,
  );
  if (paragraphs.length === 0) return emptyDoc(schema);
  return schema.nodes.doc.create(null, paragraphs);
}

export interface CreateEditorStateOptions {
  schema: Schema;
  plugins: Plugin[];
  content?: EditorContent;
}

/** Construct the initial {@link EditorState} for the editor. */
export function createEditorState(options: CreateEditorStateOptions): EditorState {
  const { schema, plugins, content } = options;
  return EditorState.create({
    doc: createDoc(schema, content),
    plugins,
  });
}
