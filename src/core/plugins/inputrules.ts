import type { Schema } from 'prosemirror-model';
import {
  type InputRule,
  inputRules,
  smartQuotes,
  ellipsis,
  emDash,
  wrappingInputRule,
  textblockTypeInputRule,
} from 'prosemirror-inputrules';
import type { Plugin } from 'prosemirror-state';

/**
 * Markdown-style input rules (F-4.x convenience): typing `# `, `> `, `- `, `1. `
 * etc. transforms the current block. Rules are added only for nodes present in
 * the schema, and typography rules (smart quotes, ellipsis, em-dash) are always
 * safe to include.
 */
export function buildInputRules(schema: Schema): Plugin {
  const rules: InputRule[] = [...smartQuotes, ellipsis, emDash];
  const n = schema.nodes;

  if (n.blockquote) {
    rules.push(wrappingInputRule(/^\s*>\s$/, n.blockquote));
  }
  if (n.ordered_list) {
    rules.push(
      wrappingInputRule(
        /^(\d+)\.\s$/,
        n.ordered_list,
        (match) => ({ order: +match[1]! }),
        (match, node) => node.childCount + (node.attrs.order as number) === +match[1]!,
      ),
    );
  }
  if (n.bullet_list) {
    rules.push(wrappingInputRule(/^\s*([-+*])\s$/, n.bullet_list));
  }
  if (n.heading) {
    rules.push(
      textblockTypeInputRule(/^(#{1,6})\s$/, n.heading, (match) => ({
        level: match[1]!.length,
      })),
    );
  }

  return inputRules({ rules });
}
