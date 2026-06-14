import type { Node as PMNode } from 'prosemirror-model';

export interface DocumentStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
}

/**
 * Compute word and character counts for a document (F-4.5). Walks text nodes
 * directly — cheap and lean for large documents (NF-1).
 */
export function countDocument(doc: PMNode): DocumentStats {
  let text = '';
  doc.descendants((node) => {
    if (node.isText && node.text) {
      text += node.text;
    } else if (node.type.name === 'hard_break') {
      text += ' ';
    }
    return true;
  });
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  return {
    words,
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
  };
}
