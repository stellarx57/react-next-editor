import { Schema, type MarkSpec, type NodeSpec } from 'prosemirror-model';
import { tableNodes } from 'prosemirror-tables';
import type { FeatureFlags } from '../../config/types';
import { DEFAULT_FEATURES } from '../../config/defaults';
import { cssAlign, normalizeCssColor } from '../../security/css';
import * as nodeSpecs from './nodes';
import * as markSpecs from './marks';

/**
 * Build a ProseMirror {@link Schema} from a set of enabled features. The schema
 * is the backbone of the editor (NF-7): nodes/marks, commands, persistence and
 * the serializers all derive from it. Disabled features are omitted so an
 * invalid or unsupported document is structurally impossible (F-11.5).
 *
 * Core nodes (`doc`, `paragraph`, `text`, `hard_break`) are always present.
 */
export function buildSchema(features: Partial<FeatureFlags> = {}): Schema {
  const f: FeatureFlags = { ...DEFAULT_FEATURES, ...features };

  const nodes: Record<string, NodeSpec> = {
    doc: nodeSpecs.doc,
    paragraph: nodeSpecs.paragraph,
  };

  if (f.headings) nodes.heading = nodeSpecs.heading;
  if (f.blockquote) nodes.blockquote = nodeSpecs.blockquote;
  if (f.horizontalRule) nodes.horizontal_rule = nodeSpecs.horizontal_rule;

  // List nodes (bullet/ordered/task share list_item).
  if (f.bulletList || f.orderedList || f.taskList) {
    nodes.list_item = nodeSpecs.list_item;
    if (f.bulletList || f.taskList) nodes.bullet_list = nodeSpecs.bullet_list;
    if (f.orderedList) nodes.ordered_list = nodeSpecs.ordered_list;
  }

  // Tables via prosemirror-tables, with cell styling attributes (F-3.2).
  if (f.table) {
    const tnodes = tableNodes({
      tableGroup: 'block',
      cellContent: 'block+',
      cellAttributes: {
        background: {
          default: null,
          getFromDOM(dom) {
            return (dom as HTMLElement).style.backgroundColor || null;
          },
          setDOMAttr(value, attrs) {
            const color = normalizeCssColor(value);
            if (color) {
              attrs.style = `${(attrs.style as string) || ''}background-color: ${color};`;
            }
          },
        },
        align: {
          default: null,
          getFromDOM(dom) {
            return (dom as HTMLElement).style.textAlign || null;
          },
          setDOMAttr(value, attrs) {
            const align = cssAlign(value);
            if (align) {
              attrs.style = `${(attrs.style as string) || ''}text-align: ${align};`;
            }
          },
        },
      },
    });
    Object.assign(nodes, tnodes);
  }

  if (f.image) nodes.image = nodeSpecs.image;
  if (f.pageBreak) nodes.page_break = nodeSpecs.page_break;

  // text + hard_break always come after block nodes so block nodes win parse priority.
  nodes.text = nodeSpecs.text;
  nodes.hard_break = nodeSpecs.hard_break;

  const marks: Record<string, MarkSpec> = {};
  if (f.link) marks.link = markSpecs.link;
  if (f.bold) marks.strong = markSpecs.strong;
  if (f.italic) marks.em = markSpecs.em;
  if (f.underline) marks.underline = markSpecs.underline;
  if (f.strikethrough) marks.strikethrough = markSpecs.strikethrough;
  if (f.superscript) marks.superscript = markSpecs.superscript;
  if (f.subscript) marks.subscript = markSpecs.subscript;
  if (f.code) marks.code = markSpecs.code;
  if (f.fontFamily) marks.fontFamily = markSpecs.fontFamily;
  if (f.fontSize) marks.fontSize = markSpecs.fontSize;
  if (f.textColor) marks.textColor = markSpecs.textColor;
  if (f.highlight) marks.highlight = markSpecs.highlight;

  return new Schema({ nodes, marks });
}

/** A schema with all features enabled — convenient for tests and full editors. */
export const defaultSchema: Schema = buildSchema();
