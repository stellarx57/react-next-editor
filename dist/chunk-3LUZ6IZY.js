import { sanitizeImageSrc, sanitizeUrl, sanitizeHtmlSync } from './chunk-T4KZ6KN3.js';
import { DEFAULT_FEATURES } from './chunk-LBY6ULPF.js';
import { __export } from './chunk-PZ5AY32C.js';
import { Schema, Node } from 'prosemirror-model';
import { tableNodes, goToNextCell, columnResizing, tableEditing, deleteTable, toggleHeaderColumn, toggleHeaderRow, splitCell, mergeCells, deleteColumn, addColumnAfter, addColumnBefore, deleteRow, addRowAfter, addRowBefore } from 'prosemirror-tables';
import { redo, undo, history } from 'prosemirror-history';
import { joinForward, joinBackward, deleteSelection, selectParentNode, selectAll, toggleMark, setBlockType, chainCommands, exitCode, baseKeymap, wrapIn, lift } from 'prosemirror-commands';
import { splitListItem, sinkListItem, liftListItem, wrapInList } from 'prosemirror-schema-list';
export { splitListItem } from 'prosemirror-schema-list';
import { Plugin, EditorState } from 'prosemirror-state';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { smartQuotes, ellipsis, emDash, wrappingInputRule, textblockTypeInputRule, inputRules } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import { Decoration, DecorationSet } from 'prosemirror-view';

// src/core/schema/nodes.ts
var nodes_exports = {};
__export(nodes_exports, {
  blockquote: () => blockquote,
  bullet_list: () => bullet_list,
  doc: () => doc,
  hard_break: () => hard_break,
  heading: () => heading,
  horizontal_rule: () => horizontal_rule,
  image: () => image,
  list_item: () => list_item,
  nodeAlign: () => nodeAlign,
  ordered_list: () => ordered_list,
  page_break: () => page_break,
  paragraph: () => paragraph,
  text: () => text
});

// src/core/schema/attrs.ts
var ALIGN_VALUES = [
  "left",
  "center",
  "right",
  "justify"
];
var MAX_INDENT = 12;
var INDENT_STEP_EM = 3;
var blockAttrs = {
  align: { default: null },
  indent: { default: 0 },
  lineHeight: { default: null }
};
function readBlockAttrs(dom) {
  const textAlign = dom.style.textAlign || dom.getAttribute("align") || "";
  const align = ALIGN_VALUES.includes(textAlign) ? textAlign : null;
  let indent = 0;
  const marginLeft = dom.style.marginLeft;
  if (marginLeft) {
    const em2 = parseFloat(marginLeft);
    if (Number.isFinite(em2) && em2 > 0) {
      const unit = /px$/.test(marginLeft) ? em2 / 16 : em2;
      indent = Math.min(MAX_INDENT, Math.max(0, Math.round(unit / INDENT_STEP_EM)));
    }
  }
  let lineHeight = null;
  const lh = dom.style.lineHeight;
  if (lh) {
    const value = parseFloat(lh);
    if (Number.isFinite(value) && value > 0 && value <= 10) {
      lineHeight = Math.round(value * 100) / 100;
    }
  }
  return { align, indent, lineHeight };
}
function blockDOMAttrs(node, extra) {
  const attrs = node.attrs;
  const styles = [];
  if (attrs.align) styles.push(`text-align: ${attrs.align}`);
  if (attrs.indent && attrs.indent > 0) {
    styles.push(`margin-left: ${attrs.indent * INDENT_STEP_EM}em`);
  }
  if (attrs.lineHeight) styles.push(`line-height: ${attrs.lineHeight}`);
  const out = { ...extra };
  if (styles.length) out.style = styles.join("; ");
  return out;
}
function clampIndent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_INDENT, Math.max(0, Math.round(value)));
}
function isTextAlign(value) {
  return typeof value === "string" && ALIGN_VALUES.includes(value);
}

// src/core/schema/nodes.ts
var doc = { content: "block+" };
var text = { group: "inline" };
var paragraph = {
  group: "block",
  content: "inline*",
  attrs: { ...blockAttrs },
  parseDOM: [{ tag: "p", getAttrs: (dom) => readBlockAttrs(dom) }],
  toDOM(node) {
    return ["p", blockDOMAttrs(node), 0];
  }
};
var heading = {
  group: "block",
  content: "inline*",
  defining: true,
  attrs: { level: { default: 1 }, ...blockAttrs },
  parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
    tag: `h${level}`,
    getAttrs: (dom) => ({
      level,
      ...readBlockAttrs(dom)
    })
  })),
  toDOM(node) {
    const level = node.attrs.level || 1;
    return [`h${Math.min(6, Math.max(1, level))}`, blockDOMAttrs(node), 0];
  }
};
var blockquote = {
  group: "block",
  content: "block+",
  defining: true,
  parseDOM: [{ tag: "blockquote" }],
  toDOM() {
    return ["blockquote", { class: "rne-blockquote" }, 0];
  }
};
var horizontal_rule = {
  group: "block",
  parseDOM: [{ tag: "hr" }],
  toDOM() {
    return ["hr", { class: "rne-hr" }];
  }
};
var page_break = {
  group: "block",
  atom: true,
  selectable: true,
  parseDOM: [{ tag: "div[data-page-break]" }, { tag: "div.rne-page-break" }],
  toDOM() {
    return [
      "div",
      { "data-page-break": "true", class: "rne-page-break", contenteditable: "false" }
    ];
  }
};
var hard_break = {
  inline: true,
  group: "inline",
  selectable: false,
  parseDOM: [{ tag: "br" }],
  toDOM() {
    return ["br"];
  }
};
var MAX_IMAGE_WIDTH = 2e3;
var image = {
  inline: true,
  group: "inline",
  draggable: true,
  attrs: {
    src: {},
    alt: { default: null },
    title: { default: null },
    width: { default: null }
  },
  parseDOM: [
    {
      tag: "img[src]",
      getAttrs(dom) {
        const el = dom;
        const src = sanitizeImageSrc(el.getAttribute("src"));
        if (!src) return false;
        const widthAttr = el.getAttribute("width") ?? el.style.width;
        let width = null;
        if (widthAttr) {
          const num = parseInt(widthAttr, 10);
          if (Number.isFinite(num) && num > 0) width = Math.min(MAX_IMAGE_WIDTH, num);
        }
        return {
          src,
          alt: el.getAttribute("alt"),
          title: el.getAttribute("title"),
          width
        };
      }
    }
  ],
  toDOM(node) {
    const { src, alt, title, width } = node.attrs;
    const safeSrc = sanitizeImageSrc(src) ?? "";
    const attrs = { src: safeSrc, class: "rne-image" };
    if (alt) attrs.alt = alt;
    if (title) attrs.title = title;
    if (width) attrs.style = `width: ${width}px`;
    return ["img", attrs];
  }
};
var list_item = {
  content: "paragraph block*",
  defining: true,
  attrs: { checked: { default: null } },
  parseDOM: [
    {
      tag: "li",
      getAttrs(dom) {
        const el = dom;
        const dc = el.getAttribute("data-checked");
        if (dc === "true") return { checked: true };
        if (dc === "false") return { checked: false };
        return { checked: null };
      }
    }
  ],
  toDOM(node) {
    const checked = node.attrs.checked;
    if (checked === null) return ["li", 0];
    return [
      "li",
      { "data-checked": String(checked), class: "rne-task-item" },
      ["span", { class: "rne-task-checkbox", contenteditable: "false" }],
      ["div", { class: "rne-task-content" }, 0]
    ];
  }
};
var bullet_list = {
  group: "block",
  content: "list_item+",
  attrs: { kind: { default: "bullet" } },
  parseDOM: [
    {
      tag: "ul",
      getAttrs(dom) {
        const el = dom;
        const isTask = el.getAttribute("data-type") === "task" || el.classList.contains("rne-task-list") || !!el.querySelector("li[data-checked]");
        return { kind: isTask ? "task" : "bullet" };
      }
    }
  ],
  toDOM(node) {
    const kind = node.attrs.kind;
    return kind === "task" ? ["ul", { "data-type": "task", class: "rne-task-list" }, 0] : ["ul", { class: "rne-bullet-list" }, 0];
  }
};
var ordered_list = {
  group: "block",
  content: "list_item+",
  attrs: { order: { default: 1 } },
  parseDOM: [
    {
      tag: "ol",
      getAttrs(dom) {
        const el = dom;
        const start = el.getAttribute("start");
        const order = start ? parseInt(start, 10) : 1;
        return { order: Number.isFinite(order) && order > 0 ? order : 1 };
      }
    }
  ],
  toDOM(node) {
    const order = node.attrs.order || 1;
    return order === 1 ? ["ol", { class: "rne-ordered-list" }, 0] : ["ol", { order, start: order, class: "rne-ordered-list" }, 0];
  }
};
function nodeAlign(node) {
  return node.attrs?.align ?? null;
}

// src/core/schema/marks.ts
var marks_exports = {};
__export(marks_exports, {
  code: () => code,
  em: () => em,
  fontFamily: () => fontFamily,
  fontSize: () => fontSize,
  highlight: () => highlight,
  link: () => link,
  strikethrough: () => strikethrough,
  strong: () => strong,
  subscript: () => subscript,
  superscript: () => superscript,
  textColor: () => textColor,
  underline: () => underline
});
var strong = {
  parseDOM: [
    { tag: "strong" },
    { tag: "b", getAttrs: (node) => node.style.fontWeight !== "normal" && null },
    { style: "font-weight=400", clearMark: (m) => m.type.name === "strong" },
    {
      style: "font-weight",
      getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null
    }
  ],
  toDOM() {
    return ["strong", 0];
  }
};
var em = {
  parseDOM: [
    { tag: "i" },
    { tag: "em" },
    { style: "font-style=italic" },
    { style: "font-style=normal", clearMark: (m) => m.type.name === "em" }
  ],
  toDOM() {
    return ["em", 0];
  }
};
var underline = {
  parseDOM: [
    { tag: "u" },
    {
      style: "text-decoration",
      getAttrs: (value) => value.includes("underline") && null
    },
    {
      style: "text-decoration-line",
      getAttrs: (value) => value.includes("underline") && null
    }
  ],
  toDOM() {
    return ["u", 0];
  }
};
var strikethrough = {
  parseDOM: [
    { tag: "s" },
    { tag: "del" },
    { tag: "strike" },
    {
      style: "text-decoration",
      getAttrs: (value) => value.includes("line-through") && null
    }
  ],
  toDOM() {
    return ["s", 0];
  }
};
var superscript = {
  excludes: "subscript",
  parseDOM: [{ tag: "sup" }, { style: "vertical-align=super" }],
  toDOM() {
    return ["sup", 0];
  }
};
var subscript = {
  excludes: "superscript",
  parseDOM: [{ tag: "sub" }, { style: "vertical-align=sub" }],
  toDOM() {
    return ["sub", 0];
  }
};
var code = {
  parseDOM: [{ tag: "code" }],
  toDOM() {
    return ["code", { class: "rne-inline-code" }, 0];
  }
};
var link = {
  attrs: {
    href: {},
    title: { default: null },
    target: { default: "_blank" }
  },
  inclusive: false,
  parseDOM: [
    {
      tag: "a[href]",
      getAttrs(dom) {
        const el = dom;
        const rawHref = el.getAttribute("href");
        const href = sanitizeUrl(rawHref);
        if (!href) return false;
        return {
          href,
          title: el.getAttribute("title"),
          target: el.getAttribute("target") ?? "_blank"
        };
      }
    }
  ],
  toDOM(mark) {
    const href = sanitizeUrl(mark.attrs.href) ?? "";
    const target = mark.attrs.target || "_blank";
    return [
      "a",
      {
        href,
        title: mark.attrs.title ?? null,
        target,
        rel: "noopener noreferrer nofollow"
      },
      0
    ];
  }
};
var fontFamily = {
  attrs: { family: {} },
  parseDOM: [
    {
      style: "font-family",
      getAttrs: (value) => {
        const family = value.replace(/["']/g, "").trim();
        return family ? { family } : false;
      }
    }
  ],
  toDOM(mark) {
    return ["span", { style: `font-family: ${cssSafe(mark.attrs.family)}` }, 0];
  }
};
var fontSize = {
  attrs: { size: {} },
  parseDOM: [
    {
      style: "font-size",
      getAttrs: (value) => {
        const size = parseSize(value);
        return size ? { size } : false;
      }
    }
  ],
  toDOM(mark) {
    return ["span", { style: `font-size: ${cssSafe(String(mark.attrs.size))}pt` }, 0];
  }
};
var textColor = {
  attrs: { color: {} },
  parseDOM: [
    {
      style: "color",
      getAttrs: (value) => {
        const color = normalizeColor(value);
        return color ? { color } : false;
      }
    }
  ],
  toDOM(mark) {
    return ["span", { style: `color: ${cssSafe(mark.attrs.color)}` }, 0];
  }
};
var highlight = {
  attrs: { color: { default: "#fff2a8" } },
  parseDOM: [
    { tag: "mark" },
    {
      style: "background-color",
      getAttrs: (value) => {
        const color = normalizeColor(value);
        return color ? { color } : false;
      }
    }
  ],
  toDOM(mark) {
    return ["mark", { style: `background-color: ${cssSafe(mark.attrs.color)}` }, 0];
  }
};
function cssSafe(value) {
  return String(value).replace(/[;{}<>"']/g, "");
}
function parseSize(value) {
  const match = /(\d+(?:\.\d+)?)\s*(pt|px)?/.exec(value);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (!Number.isFinite(num) || num <= 0 || num > 1638) return null;
  const unit = match[2] ?? "pt";
  const pt = unit === "px" ? num * 0.75 : num;
  return Math.round(pt * 100) / 100;
}
function normalizeColor(value) {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$|^#[0-9a-f]{4}$|^#[0-9a-f]{6}$|^#[0-9a-f]{8}$/.test(v)) return v;
  if (/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/.test(v)) return v;
  if (/^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/.test(v)) return v;
  if (/^[a-z]{3,20}$/.test(v)) return v;
  return null;
}

// src/core/schema/schema.ts
function buildSchema(features = {}) {
  const f = { ...DEFAULT_FEATURES, ...features };
  const nodes = {
    doc,
    paragraph
  };
  if (f.headings) nodes.heading = heading;
  if (f.blockquote) nodes.blockquote = blockquote;
  if (f.horizontalRule) nodes.horizontal_rule = horizontal_rule;
  if (f.bulletList || f.orderedList || f.taskList) {
    nodes.list_item = list_item;
    if (f.bulletList || f.taskList) nodes.bullet_list = bullet_list;
    if (f.orderedList) nodes.ordered_list = ordered_list;
  }
  if (f.table) {
    const tnodes = tableNodes({
      tableGroup: "block",
      cellContent: "block+",
      cellAttributes: {
        background: {
          default: null,
          getFromDOM(dom) {
            return dom.style.backgroundColor || null;
          },
          setDOMAttr(value, attrs) {
            if (value) {
              attrs.style = `${attrs.style || ""}background-color: ${String(value).replace(/[;{}<>"']/g, "")};`;
            }
          }
        },
        align: {
          default: null,
          getFromDOM(dom) {
            return dom.style.textAlign || null;
          },
          setDOMAttr(value, attrs) {
            if (value) {
              attrs.style = `${attrs.style || ""}text-align: ${String(value).replace(/[;{}<>"']/g, "")};`;
            }
          }
        }
      }
    });
    Object.assign(nodes, tnodes);
  }
  if (f.image) nodes.image = image;
  if (f.pageBreak) nodes.page_break = page_break;
  nodes.text = text;
  nodes.hard_break = hard_break;
  const marks = {};
  if (f.link) marks.link = link;
  if (f.bold) marks.strong = strong;
  if (f.italic) marks.em = em;
  if (f.underline) marks.underline = underline;
  if (f.strikethrough) marks.strikethrough = strikethrough;
  if (f.superscript) marks.superscript = superscript;
  if (f.subscript) marks.subscript = subscript;
  if (f.code) marks.code = code;
  if (f.fontFamily) marks.fontFamily = fontFamily;
  if (f.fontSize) marks.fontSize = fontSize;
  if (f.textColor) marks.textColor = textColor;
  if (f.highlight) marks.highlight = highlight;
  return new Schema({ nodes, marks });
}
var defaultSchema = buildSchema();

// src/core/commands/helpers.ts
function isMarkActive(state, type) {
  const { from, $from, to, empty } = state.selection;
  if (empty) {
    return !!type.isInSet(state.storedMarks || $from.marks());
  }
  return state.doc.rangeHasMark(from, to, type);
}
function getActiveMarkAttrs(state, type) {
  const { $from, empty } = state.selection;
  if (empty) {
    const mark = type.isInSet(state.storedMarks || $from.marks());
    return mark ? mark.attrs : null;
  }
  const { from, to } = state.selection;
  let attrs = null;
  state.doc.nodesBetween(from, to, (node) => {
    if (attrs) return false;
    const mark = node.marks.find((m) => m.type === type);
    if (mark) attrs = mark.attrs;
    return true;
  });
  return attrs;
}
function isBlockActive(state, type, attrs) {
  const { from, to } = state.selection;
  let found = false;
  let allMatch = true;
  state.doc.nodesBetween(from, to, (node) => {
    if (node.type.isTextblock || node.type === type) {
      if (node.type === type && matchAttrs(node.attrs, attrs)) {
        found = true;
      } else if (node.type.isTextblock) {
        if (!(node.type === type && matchAttrs(node.attrs, attrs))) allMatch = false;
      }
    }
    return true;
  });
  return found && allMatch;
}
function matchAttrs(nodeAttrs, attrs) {
  if (!attrs) return true;
  return Object.keys(attrs).every((key) => nodeAttrs[key] === attrs[key]);
}
function isInNode(state, type) {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type === type) return true;
  }
  return false;
}
function defaultEnabled(run) {
  return (state) => run(state, void 0, void 0);
}

// src/core/commands/marks.ts
function setMark(type, attrs) {
  return (state, dispatch) => {
    const { selection } = state;
    if (dispatch) {
      const tr = state.tr;
      if (selection.empty) {
        tr.addStoredMark(type.create(attrs));
      } else {
        for (const range of selection.ranges) {
          const { $from, $to } = range;
          tr.addMark($from.pos, $to.pos, type.create(attrs));
        }
        tr.scrollIntoView();
      }
      dispatch(tr);
    }
    return true;
  };
}
function unsetMark(type) {
  return (state, dispatch) => {
    const { selection } = state;
    if (dispatch) {
      const tr = state.tr;
      if (selection.empty) {
        tr.removeStoredMark(type);
      } else {
        for (const range of selection.ranges) {
          tr.removeMark(range.$from.pos, range.$to.pos, type);
        }
      }
      dispatch(tr);
    }
    return true;
  };
}
function toggle(type) {
  const run = toggleMark(type);
  return {
    run,
    isActive: (state) => isMarkActive(state, type),
    isEnabled: (state) => run(state, void 0, void 0)
  };
}
function createMarkCommands(schema) {
  const cmds = {};
  const m = schema.marks;
  if (m.strong) cmds.bold = toggle(m.strong);
  if (m.em) cmds.italic = toggle(m.em);
  if (m.underline) cmds.underline = toggle(m.underline);
  if (m.strikethrough) cmds.strikethrough = toggle(m.strikethrough);
  if (m.superscript) cmds.superscript = toggle(m.superscript);
  if (m.subscript) cmds.subscript = toggle(m.subscript);
  if (m.code) cmds.code = toggle(m.code);
  return cmds;
}
function createParametricMarkCommands(schema) {
  const m = schema.marks;
  return {
    setFontFamily: (family) => m.fontFamily ? setMark(m.fontFamily, { family }) : noop,
    clearFontFamily: () => m.fontFamily ? unsetMark(m.fontFamily) : noop,
    setFontSize: (size) => m.fontSize ? setMark(m.fontSize, { size }) : noop,
    clearFontSize: () => m.fontSize ? unsetMark(m.fontSize) : noop,
    setTextColor: (color) => m.textColor ? setMark(m.textColor, { color }) : noop,
    clearTextColor: () => m.textColor ? unsetMark(m.textColor) : noop,
    setHighlight: (color) => m.highlight ? setMark(m.highlight, { color }) : noop,
    clearHighlight: () => m.highlight ? unsetMark(m.highlight) : noop,
    getActiveFontFamily: (state) => m.fontFamily ? getActiveMarkAttrs(state, m.fontFamily)?.family ?? null : null,
    getActiveFontSize: (state) => m.fontSize ? getActiveMarkAttrs(state, m.fontSize)?.size ?? null : null,
    getActiveTextColor: (state) => m.textColor ? getActiveMarkAttrs(state, m.textColor)?.color ?? null : null
  };
}
var noop = () => false;
var noop2 = () => false;
function setTextblockAttr(attr, value) {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    let applicable = false;
    const tr = state.tr;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.isTextblock && attr in (node.type.spec.attrs ?? {})) {
        applicable = true;
        if (dispatch) tr.setNodeAttribute(pos, attr, value);
      }
      return true;
    });
    if (!applicable) return false;
    if (dispatch) dispatch(tr.scrollIntoView());
    return true;
  };
}
function isTextblockAttrActive(state, attr, value) {
  const { from, to } = state.selection;
  let any = false;
  let all = true;
  state.doc.nodesBetween(from, to, (node) => {
    if (node.isTextblock && attr in (node.type.spec.attrs ?? {})) {
      any = true;
      if (node.attrs[attr] !== value) all = false;
    }
    return true;
  });
  return any && all;
}
function changeIndent(delta) {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    let changed = false;
    const tr = state.tr;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.isTextblock && "indent" in (node.type.spec.attrs ?? {})) {
        const next = clampIndent(node.attrs.indent + delta);
        if (next !== node.attrs.indent) {
          changed = true;
          if (dispatch) tr.setNodeAttribute(pos, "indent", next);
        }
      }
      return true;
    });
    if (!changed) return false;
    if (dispatch) dispatch(tr.scrollIntoView());
    return true;
  };
}
function insertBlock(type) {
  return (state, dispatch) => {
    if (!type) return false;
    if (dispatch) {
      dispatch(state.tr.replaceSelectionWith(type.create()).scrollIntoView());
    }
    return true;
  };
}
function createBlockCommands(schema) {
  const n = schema.nodes;
  const cmds = {};
  if (n.paragraph) {
    const run = setBlockType(n.paragraph);
    cmds.paragraph = {
      run,
      isActive: (state) => isBlockActive(state, n.paragraph),
      isEnabled: (state) => run(state, void 0, void 0)
    };
  }
  if (schema.nodes.blockquote) {
    const wrap = wrapIn(schema.nodes.blockquote);
    cmds.blockquote = {
      run: (state, dispatch, view) => {
        if (isInNode(state, schema.nodes.blockquote)) return lift(state, dispatch);
        return wrap(state, dispatch, view);
      },
      isActive: (state) => isInNode(state, schema.nodes.blockquote)
    };
  }
  if (n.horizontal_rule) {
    const run = insertBlock(n.horizontal_rule);
    cmds.horizontalRule = { run, isEnabled: (state) => run(state, void 0, void 0) };
  }
  if (n.page_break) {
    const run = insertBlock(n.page_break);
    cmds.pageBreak = { run, isEnabled: (state) => run(state, void 0, void 0) };
  }
  if (n.paragraph?.spec.attrs && "align" in n.paragraph.spec.attrs) {
    const aligns = [
      ["alignLeft", "left"],
      ["alignCenter", "center"],
      ["alignRight", "right"],
      ["alignJustify", "justify"]
    ];
    for (const [name, value] of aligns) {
      const run = setTextblockAttr("align", value);
      cmds[name] = {
        run,
        isActive: (state) => isTextblockAttrActive(state, "align", value),
        isEnabled: (state) => run(state, void 0, void 0)
      };
    }
    const indentRun = changeIndent(1);
    const outdentRun = changeIndent(-1);
    cmds.indent = { run: indentRun, isEnabled: (state) => indentRun(state, void 0, void 0) };
    cmds.outdent = {
      run: outdentRun,
      isEnabled: (state) => outdentRun(state, void 0, void 0)
    };
  }
  return cmds;
}
function createParametricBlockCommands(schema) {
  const n = schema.nodes;
  return {
    setParagraph: () => n.paragraph ? setBlockType(n.paragraph) : noop2,
    setHeading: (level) => n.heading ? setBlockType(n.heading, { level }) : noop2,
    setAlign: (align) => setTextblockAttr("align", align),
    setLineHeight: (lineHeight) => setTextblockAttr("lineHeight", lineHeight)
  };
}
function findParentList(state, listTypes) {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (listTypes.includes(node.type)) {
      return { node, pos: $from.before(depth), depth };
    }
  }
  return null;
}
function setItemsChecked(tr, list, listPos, checked) {
  let offset = listPos + 1;
  list.forEach((child) => {
    if (child.type.name === "list_item" && child.attrs.checked !== checked) {
      tr.setNodeAttribute(offset, "checked", checked);
    }
    offset += child.nodeSize;
  });
}
function toggleList(schema, targetType, targetAttrs) {
  const listItem = schema.nodes.list_item;
  const listTypes = [schema.nodes.bullet_list, schema.nodes.ordered_list].filter(
    Boolean
  );
  return (state, dispatch, view) => {
    const parent = findParentList(state, listTypes);
    if (!parent) {
      const wrap = wrapInList(targetType, targetAttrs);
      if (targetAttrs.kind === "task") {
        return wrap(
          state,
          (tr) => {
            if (!dispatch) return;
            const next = tr.doc.resolve(tr.selection.from);
            for (let depth = next.depth; depth > 0; depth--) {
              const node = next.node(depth);
              if (node.type === targetType) {
                setItemsChecked(tr, node, next.before(depth), false);
                break;
              }
            }
            dispatch(tr);
          },
          view
        );
      }
      return wrap(state, dispatch, view);
    }
    const sameType = parent.node.type === targetType;
    const sameKind = targetType.name !== "bullet_list" || parent.node.attrs.kind === targetAttrs.kind;
    if (sameType && sameKind) {
      return liftListItem(listItem)(state, dispatch, view);
    }
    if (dispatch) {
      const tr = state.tr.setNodeMarkup(parent.pos, targetType, targetAttrs);
      const checked = targetAttrs.kind === "task" ? false : null;
      setItemsChecked(tr, parent.node, parent.pos, checked);
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}
function isInList(state, type, kind) {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type === type && (kind === void 0 || node.attrs.kind === kind)) return true;
  }
  return false;
}
function createListCommands(schema) {
  const n = schema.nodes;
  const cmds = {};
  if (!n.list_item) return cmds;
  if (n.bullet_list) {
    const run = toggleList(schema, n.bullet_list, { kind: "bullet" });
    cmds.bulletList = {
      run,
      isActive: (state) => isInList(state, n.bullet_list, "bullet")
    };
  }
  if (n.ordered_list) {
    const run = toggleList(schema, n.ordered_list, { order: 1 });
    cmds.orderedList = {
      run,
      isActive: (state) => isInList(state, n.ordered_list)
    };
  }
  if (n.bullet_list) {
    const run = toggleList(schema, n.bullet_list, { kind: "task" });
    cmds.taskList = {
      run,
      isActive: (state) => isInList(state, n.bullet_list, "task")
    };
  }
  const sink = sinkListItem(n.list_item);
  const liftItem = liftListItem(n.list_item);
  cmds.sinkListItem = { run: sink, isEnabled: (state) => sink(state, void 0, void 0) };
  cmds.liftListItem = { run: liftItem, isEnabled: (state) => liftItem(state, void 0, void 0) };
  return cmds;
}

// src/core/commands/format.ts
function clearFormatting(schema) {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;
    if (dispatch) {
      const tr = state.tr;
      tr.removeMark(from, to);
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isTextblock) return true;
        const specAttrs = node.type.spec.attrs ?? {};
        if (schema.nodes.heading && node.type === schema.nodes.heading && schema.nodes.paragraph) {
          tr.setNodeMarkup(pos, schema.nodes.paragraph, {
            align: null,
            indent: 0,
            lineHeight: null
          });
        } else {
          const attrs = { ...node.attrs };
          if ("align" in specAttrs) attrs.align = null;
          if ("indent" in specAttrs) attrs.indent = 0;
          if ("lineHeight" in specAttrs) attrs.lineHeight = null;
          tr.setNodeMarkup(pos, void 0, attrs);
        }
        return true;
      });
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}
function createFormatCommands(schema) {
  const run = clearFormatting(schema);
  return {
    clearFormatting: {
      run,
      isEnabled: (state) => !state.selection.empty
    }
  };
}

// src/core/commands/links.ts
function linkRangeAt(state, type, pos) {
  const $pos = state.doc.resolve(pos);
  const mark = type.isInSet($pos.marks());
  if (!mark) return null;
  let start = pos;
  let end = pos;
  while (start > 0 && mark.isInSet(state.doc.resolve(start - 1).marks())) start--;
  const docSize = state.doc.content.size;
  while (end < docSize && mark.isInSet(state.doc.resolve(end + 1).marks())) end++;
  return { from: start, to: end };
}
function setLink(type, attrs) {
  return (state, dispatch) => {
    const href = sanitizeUrl(attrs.href);
    if (!href) return false;
    const markAttrs = { href, title: attrs.title ?? null, target: attrs.target ?? "_blank" };
    const { empty, from, to } = state.selection;
    if (dispatch) {
      const tr = state.tr;
      if (empty) {
        const text2 = state.schema.text(href, [type.create(markAttrs)]);
        tr.replaceSelectionWith(text2, false);
      } else {
        tr.addMark(from, to, type.create(markAttrs));
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}
function removeLink(type) {
  return (state, dispatch) => {
    const { empty, from, to } = state.selection;
    if (empty) {
      const range = linkRangeAt(state, type, from);
      if (!range) return false;
      if (dispatch) dispatch(state.tr.removeMark(range.from, range.to, type));
      return true;
    }
    if (!state.doc.rangeHasMark(from, to, type)) return false;
    if (dispatch) dispatch(state.tr.removeMark(from, to, type));
    return true;
  };
}
function createLinkCommands(schema) {
  const type = schema.marks.link;
  if (!type) {
    const noop3 = () => false;
    return {
      commands: {},
      setLink: (_attrs) => noop3,
      removeLink: noop3,
      getActiveLink: (_state) => null,
      isLinkActive: (_state) => false
    };
  }
  const commands = {
    removeLink: {
      run: removeLink(type),
      isEnabled: (state) => isMarkActive(state, type)
    }
  };
  return {
    commands,
    setLink: (attrs) => setLink(type, attrs),
    removeLink: removeLink(type),
    getActiveLink: (state) => getActiveMarkAttrs(state, type),
    isLinkActive: (state) => isMarkActive(state, type)
  };
}
function insertImage(schema, attrs) {
  return (state, dispatch) => {
    const type = schema.nodes.image;
    if (!type) return false;
    const src = sanitizeImageSrc(attrs.src);
    if (!src) return false;
    if (dispatch) {
      const node = type.create({
        src,
        alt: attrs.alt ?? null,
        title: attrs.title ?? null,
        width: attrs.width ?? null
      });
      dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    }
    return true;
  };
}
function createTableNode(schema, rows, cols, withHeaderRow) {
  const { table, table_row, table_cell, table_header } = schema.nodes;
  if (!table || !table_row || !table_cell) return null;
  const headerType = table_header ?? table_cell;
  const rowNodes = [];
  for (let r = 0; r < rows; r++) {
    const cells = [];
    for (let c = 0; c < cols; c++) {
      const cellType = withHeaderRow && r === 0 ? headerType : table_cell;
      const cell = cellType.createAndFill();
      if (!cell) return null;
      cells.push(cell);
    }
    rowNodes.push(table_row.create(null, cells));
  }
  return table.create(null, rowNodes);
}
function insertTable(schema, rows = 3, cols = 3, withHeaderRow = true) {
  return (state, dispatch) => {
    const node = createTableNode(schema, rows, cols, withHeaderRow);
    if (!node) return false;
    if (dispatch) dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };
}
function createTableCommands(schema) {
  if (!schema.nodes.table) return {};
  const wrap = (run) => ({
    run,
    isEnabled: (state) => run(state, void 0, void 0)
  });
  return {
    addRowBefore: wrap(addRowBefore),
    addRowAfter: wrap(addRowAfter),
    deleteRow: wrap(deleteRow),
    addColumnBefore: wrap(addColumnBefore),
    addColumnAfter: wrap(addColumnAfter),
    deleteColumn: wrap(deleteColumn),
    mergeCells: wrap(mergeCells),
    splitCell: wrap(splitCell),
    toggleHeaderRow: wrap(toggleHeaderRow),
    toggleHeaderColumn: wrap(toggleHeaderColumn),
    deleteTable: wrap(deleteTable)
  };
}

// src/core/commands/index.ts
function createCommands(schema) {
  const registry = {
    undo: { run: undo, isEnabled: (state) => undo(state) },
    redo: { run: redo, isEnabled: (state) => redo(state) },
    ...createMarkCommands(schema),
    ...createBlockCommands(schema),
    ...createListCommands(schema),
    ...createFormatCommands(schema),
    ...createTableCommands(schema)
  };
  const linkApi = createLinkCommands(schema);
  Object.assign(registry, linkApi.commands);
  return {
    registry,
    marks: createParametricMarkCommands(schema),
    blocks: createParametricBlockCommands(schema),
    links: linkApi,
    insert: {
      image: (attrs) => insertImage(schema, attrs),
      table: (rows = 3, cols = 3, withHeaderRow = true) => insertTable(schema, rows, cols, withHeaderRow)
    }
  };
}
var editingCommands = {
  selectAll,
  selectParentNode,
  deleteSelection,
  joinBackward,
  joinForward
};
function buildInputRules(schema) {
  const rules = [...smartQuotes, ellipsis, emDash];
  const n = schema.nodes;
  if (n.blockquote) {
    rules.push(wrappingInputRule(/^\s*>\s$/, n.blockquote));
  }
  if (n.ordered_list) {
    rules.push(
      wrappingInputRule(
        /^(\d+)\.\s$/,
        n.ordered_list,
        (match) => ({ order: +match[1] }),
        (match, node) => node.childCount + node.attrs.order === +match[1]
      )
    );
  }
  if (n.bullet_list) {
    rules.push(wrappingInputRule(/^\s*([-+*])\s$/, n.bullet_list));
  }
  if (n.heading) {
    rules.push(
      textblockTypeInputRule(/^(#{1,6})\s$/, n.heading, (match) => ({
        level: match[1].length
      }))
    );
  }
  return inputRules({ rules });
}
function buildKeymapPlugins(schema) {
  const bindings = {};
  const m = schema.marks;
  const n = schema.nodes;
  const bind = (key, cmd) => {
    if (cmd) bindings[key] = cmd;
  };
  bind("Mod-z", undo);
  bind("Shift-Mod-z", redo);
  bind("Mod-y", redo);
  if (m.strong) bind("Mod-b", toggleMark(m.strong));
  if (m.em) bind("Mod-i", toggleMark(m.em));
  if (m.underline) bind("Mod-u", toggleMark(m.underline));
  if (m.strikethrough) bind("Mod-Shift-s", toggleMark(m.strikethrough));
  if (m.code) bind("Mod-e", toggleMark(m.code));
  if (m.superscript) bind("Mod-.", toggleMark(m.superscript));
  if (m.subscript) bind("Mod-,", toggleMark(m.subscript));
  if (n.paragraph) bind("Shift-Mod-0", setBlockType(n.paragraph));
  if (n.heading) {
    for (let level = 1; level <= 6; level++) {
      bind(`Shift-Mod-${level}`, setBlockType(n.heading, { level }));
    }
  }
  const listItem = n.list_item;
  if (listItem) {
    bind("Enter", splitListItem(listItem));
  }
  const tabChain = [];
  const shiftTabChain = [];
  if (n.table) {
    tabChain.push(goToNextCell(1));
    shiftTabChain.push(goToNextCell(-1));
  }
  if (listItem) {
    tabChain.push(sinkListItem(listItem));
    shiftTabChain.push(liftListItem(listItem));
  }
  tabChain.push(changeIndent(1));
  shiftTabChain.push(changeIndent(-1));
  bindings["Tab"] = chainCommands(...tabChain);
  bindings["Shift-Tab"] = chainCommands(...shiftTabChain);
  if (n.hard_break) {
    const br = n.hard_break;
    const insertBreak = chainCommands(exitCode, (state, dispatch) => {
      if (dispatch) dispatch(state.tr.replaceSelectionWith(br.create()).scrollIntoView());
      return true;
    });
    bind("Shift-Enter", insertBreak);
    bind("Mod-Enter", insertBreak);
  }
  return [keymap(bindings), keymap(baseKeymap)];
}
function placeholderPlugin(text2) {
  return new Plugin({
    props: {
      decorations(state) {
        const { doc: doc2 } = state;
        const isEmpty = doc2.childCount === 1 && doc2.firstChild != null && doc2.firstChild.isTextblock && doc2.firstChild.content.size === 0;
        if (!isEmpty) return null;
        const decoration = Decoration.node(0, doc2.firstChild.nodeSize, {
          class: "rne-empty",
          "data-placeholder": text2
        });
        return DecorationSet.create(doc2, [decoration]);
      }
    }
  });
}
function taskListPlugin(schema) {
  return new Plugin({
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          if (!view.editable) return false;
          const target = event.target;
          if (!target || !target.classList?.contains("rne-task-checkbox")) return false;
          const pos = view.posAtDOM(target, 0);
          if (pos == null || pos < 0) return false;
          const $pos = view.state.doc.resolve(pos);
          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth);
            if (node.type === schema.nodes.list_item && node.attrs.checked !== null) {
              const itemPos = $pos.before(depth);
              const tr = view.state.tr.setNodeAttribute(itemPos, "checked", !node.attrs.checked);
              view.dispatch(tr);
              event.preventDefault();
              return true;
            }
          }
          return false;
        }
      }
    }
  });
}

// src/core/plugins/index.ts
function pasteSanitizerPlugin() {
  return new Plugin({
    props: {
      transformPastedHTML(html) {
        return sanitizeHtmlSync(html);
      }
    }
  });
}
function buildPlugins(schema, options = {}) {
  const plugins = [];
  if (options.history !== false) {
    plugins.push(history());
  }
  plugins.push(buildInputRules(schema));
  plugins.push(...buildKeymapPlugins(schema));
  plugins.push(dropCursor({ color: "var(--rne-accent, #df4a36)", width: 2 }));
  plugins.push(gapCursor());
  if (schema.nodes.table) {
    plugins.push(columnResizing());
    plugins.push(tableEditing());
  }
  plugins.push(taskListPlugin(schema));
  plugins.push(pasteSanitizerPlugin());
  if (options.placeholder) {
    plugins.push(placeholderPlugin(options.placeholder));
  }
  if (options.appendTransaction) {
    const hook = options.appendTransaction;
    plugins.push(new Plugin({ appendTransaction: (trs, oldS, newS) => hook(trs, oldS, newS) ?? null }));
  }
  if (options.extraPlugins?.length) {
    plugins.push(...options.extraPlugins);
  }
  return plugins;
}
function createDoc(schema, content) {
  if (content == null) return emptyDoc(schema);
  if (typeof content === "string") {
    return docFromText(schema, content);
  }
  try {
    const node = Node.fromJSON(schema, content);
    node.check();
    return node;
  } catch (err) {
    console.error("[react-next-editor] Invalid initial content, using empty document.", err);
    return emptyDoc(schema);
  }
}
function emptyDoc(schema) {
  const doc2 = schema.nodes.doc.createAndFill();
  if (!doc2) throw new Error("Schema cannot create an empty document.");
  return doc2;
}
function docFromText(schema, text2) {
  const paragraphType = schema.nodes.paragraph;
  const lines = text2.split(/\r\n|\r|\n/);
  const paragraphs = lines.map(
    (line) => line ? paragraphType.create(null, schema.text(line)) : paragraphType.createAndFill()
  );
  if (paragraphs.length === 0) return emptyDoc(schema);
  return schema.nodes.doc.create(null, paragraphs);
}
function createEditorState(options) {
  const { schema, plugins, content } = options;
  return EditorState.create({
    doc: createDoc(schema, content),
    plugins
  });
}

// src/core/utils.ts
function countDocument(doc2) {
  let text2 = "";
  doc2.descendants((node) => {
    if (node.isText && node.text) {
      text2 += node.text;
    } else if (node.type.name === "hard_break") {
      text2 += " ";
    }
    return true;
  });
  const trimmed = text2.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  return {
    words,
    characters: text2.length,
    charactersNoSpaces: text2.replace(/\s/g, "").length
  };
}

export { INDENT_STEP_EM, MAX_INDENT, blockAttrs, blockDOMAttrs, buildInputRules, buildKeymapPlugins, buildPlugins, buildSchema, changeIndent, clampIndent, clearFormatting, countDocument, createCommands, createDoc, createEditorState, createTableNode, defaultEnabled, defaultSchema, editingCommands, getActiveMarkAttrs, insertImage, insertTable, isBlockActive, isInNode, isMarkActive, isTextAlign, isTextblockAttrActive, marks_exports, nodes_exports, placeholderPlugin, readBlockAttrs, removeLink, setLink, setMark, setTextblockAttr, taskListPlugin, unsetMark };
//# sourceMappingURL=chunk-3LUZ6IZY.js.map
//# sourceMappingURL=chunk-3LUZ6IZY.js.map