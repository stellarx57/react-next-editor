'use strict';

var chunkRSAUVRYX_cjs = require('./chunk-RSAUVRYX.cjs');
var chunkSRDIWQEX_cjs = require('./chunk-SRDIWQEX.cjs');
var chunkAT25KOMU_cjs = require('./chunk-AT25KOMU.cjs');

// src/export/text.ts
function documentToText(doc, options = {}) {
  const opts = {
    includeLinkUrls: options.includeLinkUrls ?? false,
    images: options.images ?? "alt",
    newline: options.newline ?? "\n"
  };
  const blocks = (doc.content ?? []).map((node) => serializeBlock(node, opts, 0));
  return blocks.filter((b) => b !== null).join(opts.newline + opts.newline).replace(/\n{3,}/g, "\n\n").trim();
}
function serializeBlock(node, opts, depth) {
  switch (node.type) {
    case "paragraph":
    case "heading":
      return serializeInline(node.content ?? [], opts);
    case "blockquote":
      return (node.content ?? []).map((child) => serializeBlock(child, opts, depth)).filter((b) => b !== null).map((line) => `> ${line}`).join(opts.newline);
    case "bullet_list":
    case "ordered_list":
      return serializeList(node, opts, depth);
    case "horizontal_rule":
      return "---";
    case "page_break":
      return "\f";
    case "table":
      return serializeTable(node, opts);
    default:
      if (node.content) {
        return node.content.map((child) => serializeBlock(child, opts, depth)).filter((b) => b !== null).join(opts.newline);
      }
      return node.text ?? null;
  }
}
function serializeList(node, opts, depth) {
  const ordered = node.type === "ordered_list";
  const start = ordered ? Number(node.attrs?.order ?? 1) : 0;
  const indent = "  ".repeat(depth);
  const lines = [];
  let index = start;
  for (const item of node.content ?? []) {
    if (item.type !== "list_item") continue;
    const checked = item.attrs?.checked;
    let marker;
    if (checked === true) marker = "[x]";
    else if (checked === false) marker = "[ ]";
    else if (ordered) marker = `${index}.`;
    else marker = "-";
    const children = item.content ?? [];
    const firstBlock = children[0];
    const firstText = firstBlock ? serializeBlock(firstBlock, opts, depth) ?? "" : "";
    lines.push(`${indent}${marker} ${firstText}`.trimEnd());
    for (let i = 1; i < children.length; i++) {
      const child = children[i];
      if (child.type === "bullet_list" || child.type === "ordered_list") {
        lines.push(serializeList(child, opts, depth + 1));
      } else {
        const text = serializeBlock(child, opts, depth + 1);
        if (text) lines.push(`${indent}  ${text}`);
      }
    }
    if (ordered) index++;
  }
  return lines.join(opts.newline);
}
function serializeTable(node, opts) {
  const rows = [];
  for (const row of node.content ?? []) {
    if (row.type !== "table_row") continue;
    const cells = (row.content ?? []).map(
      (cell) => (cell.content ?? []).map((block) => serializeBlock(block, opts, 0)).filter((b) => b !== null).join(" ").replace(/\t/g, " ")
    );
    rows.push(cells.join("	"));
  }
  return rows.join(opts.newline);
}
function serializeInline(content, opts) {
  let out = "";
  for (const node of content) {
    if (node.type === "text") {
      let text = node.text ?? "";
      if (opts.includeLinkUrls && node.marks) {
        const link = node.marks.find((m) => m.type === "link");
        if (link?.attrs?.href) text = `${text} (${String(link.attrs.href)})`;
      }
      out += text;
    } else if (node.type === "hard_break") {
      out += opts.newline;
    } else if (node.type === "image") {
      if (opts.images === "alt") {
        const alt = node.attrs?.alt;
        if (alt) out += String(alt);
      }
    } else if (node.content) {
      out += serializeInline(node.content, opts);
    }
  }
  return out;
}

// src/export/docx.ts
var docxModulePromise = null;
async function loadDocx() {
  if (!docxModulePromise) docxModulePromise = import('docx');
  return docxModulePromise;
}
var HALF_POINT = 2;
var INDENT_TWIP_PER_LEVEL = 720;
function toHex(value) {
  const v = String(value ?? "").trim();
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(v);
  if (!m) return null;
  const hex = m[1];
  return hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
}
var DocxSerializer = class {
  constructor(converters = {}) {
    this.numberingConfigs = [];
    this.refCounter = 0;
    this.converters = converters;
  }
  allocListRef(ordered) {
    const d = this.docx;
    const reference = `rne-list-${this.refCounter++}`;
    const levels = Array.from({ length: 9 }, (_, level) => {
      if (ordered) {
        const formats = [
          d.LevelFormat.DECIMAL,
          d.LevelFormat.LOWER_LETTER,
          d.LevelFormat.LOWER_ROMAN
        ];
        return {
          level,
          format: formats[level % 3],
          text: `%${level + 1}.`,
          alignment: d.AlignmentType.START,
          style: { paragraph: { indent: { left: (level + 1) * 720, hanging: 360 } } }
        };
      }
      const bullets = ["\u2022", "\u25E6", "\u25AA"];
      return {
        level,
        format: d.LevelFormat.BULLET,
        text: bullets[level % 3],
        alignment: d.AlignmentType.START,
        style: { paragraph: { indent: { left: (level + 1) * 720, hanging: 360 } } }
      };
    });
    this.numberingConfigs.push({ reference, levels });
    return reference;
  }
  /** Build run options from a text node's marks. */
  runOptions(marks) {
    const d = this.docx;
    const o = {};
    for (const mark of marks) {
      switch (mark.type) {
        case "strong":
          o.bold = true;
          break;
        case "em":
          o.italics = true;
          break;
        case "underline":
          o.underline = {};
          break;
        case "strikethrough":
          o.strike = true;
          break;
        case "superscript":
          o.superScript = true;
          break;
        case "subscript":
          o.subScript = true;
          break;
        case "code":
          o.font = "Courier New";
          break;
        case "fontFamily":
          o.font = String(mark.attrs?.family ?? "");
          break;
        case "fontSize": {
          const size = Number(mark.attrs?.size);
          if (Number.isFinite(size) && size > 0) o.size = Math.round(size * HALF_POINT);
          break;
        }
        case "textColor": {
          const hex = toHex(mark.attrs?.color);
          if (hex) o.color = hex;
          break;
        }
        case "highlight": {
          const hex = toHex(mark.attrs?.color);
          if (hex) o.shading = { type: d.ShadingType.CLEAR, fill: hex };
          break;
        }
      }
    }
    return o;
  }
  /** Serialize inline content into docx runs / hyperlinks. */
  inlineChildren(content) {
    const d = this.docx;
    if (!content) return [];
    const out = [];
    for (const node of content) {
      if (node.type === "text") {
        const marks = node.marks ?? [];
        const link = marks.find((m) => m.type === "link");
        const runOpts = this.runOptions(marks.filter((m) => m.type !== "link"));
        const run = new d.TextRun({ text: node.text ?? "", ...runOpts });
        if (link?.attrs?.href) {
          const href = chunkSRDIWQEX_cjs.sanitizeUrl(String(link.attrs.href));
          if (href) {
            out.push(new d.ExternalHyperlink({ children: [run], link: href }));
            continue;
          }
        }
        out.push(run);
      } else if (node.type === "hard_break") {
        out.push(new d.TextRun({ break: 1 }));
      } else if (node.type === "image") {
        const img = this.imageRun(node);
        if (img) out.push(img);
      }
    }
    return out;
  }
  imageRun(node) {
    const d = this.docx;
    const src = String(node.attrs?.src ?? "");
    const match = /^data:image\/(png|jpe?g|gif|bmp);base64,([A-Za-z0-9+/=]+)$/.exec(src);
    if (!match) return null;
    const raw = match[1];
    const type = raw === "jpeg" ? "jpg" : raw;
    const data = base64ToUint8(match[2]);
    const width = Number(node.attrs?.width) || 300;
    const height = Math.round(width * 0.75);
    try {
      return new d.ImageRun({
        data,
        type,
        transformation: { width, height }
      });
    } catch {
      return null;
    }
  }
  alignment(attrs) {
    const d = this.docx;
    switch (attrs?.align) {
      case "center":
        return d.AlignmentType.CENTER;
      case "right":
        return d.AlignmentType.RIGHT;
      case "justify":
        return d.AlignmentType.JUSTIFIED;
      case "left":
        return d.AlignmentType.LEFT;
      default:
        return void 0;
    }
  }
  paragraphProps(node) {
    const props = {};
    const align = this.alignment(node.attrs);
    if (align !== void 0) props.alignment = align;
    const indent = Number(node.attrs?.indent ?? 0);
    if (indent > 0) props.indent = { left: indent * INDENT_TWIP_PER_LEVEL };
    const lineHeight = Number(node.attrs?.lineHeight);
    if (Number.isFinite(lineHeight) && lineHeight > 0) {
      props.spacing = { line: Math.round(lineHeight * 240), lineRule: "auto" };
    }
    return props;
  }
  headingLevel(level) {
    const d = this.docx;
    const map = [
      d.HeadingLevel.HEADING_1,
      d.HeadingLevel.HEADING_2,
      d.HeadingLevel.HEADING_3,
      d.HeadingLevel.HEADING_4,
      d.HeadingLevel.HEADING_5,
      d.HeadingLevel.HEADING_6
    ];
    return map[Math.min(5, Math.max(0, level - 1))];
  }
  serializeBlocks(nodes) {
    const out = [];
    for (const node of nodes) out.push(...this.serializeBlock(node));
    return out;
  }
  serializeBlock(node) {
    const d = this.docx;
    const custom = this.converters[node.type];
    if (custom) {
      return custom(node, { serializeBlocks: (n) => this.serializeBlocks(n), docx: this.docx });
    }
    switch (node.type) {
      case "paragraph":
        return [
          new d.Paragraph({
            ...this.paragraphProps(node),
            children: this.inlineChildren(node.content)
          })
        ];
      case "heading":
        return [
          new d.Paragraph({
            ...this.paragraphProps(node),
            heading: this.headingLevel(Number(node.attrs?.level ?? 1)),
            children: this.inlineChildren(node.content)
          })
        ];
      case "blockquote":
        return (node.content ?? []).flatMap((child) => {
          const blocks = this.serializeBlock(child);
          return blocks;
        });
      case "horizontal_rule":
        return [
          new d.Paragraph({
            border: { bottom: { style: d.BorderStyle.SINGLE, size: 6, space: 1, color: "999999" } },
            children: []
          })
        ];
      case "page_break":
        return [new d.Paragraph({ children: [new d.PageBreak()] })];
      case "bullet_list":
      case "ordered_list":
        return this.serializeList(node, node.type === "ordered_list", 0);
      case "table":
        return [this.serializeTable(node)];
      default:
        if (node.content) return this.serializeBlocks(node.content);
        return [];
    }
  }
  serializeList(node, ordered, level) {
    const d = this.docx;
    const reference = this.allocListRef(ordered);
    const out = [];
    for (const item of node.content ?? []) {
      if (item.type !== "list_item") continue;
      const children = item.content ?? [];
      const checked = item.attrs?.checked;
      const prefix = checked === true ? "\u2611 " : checked === false ? "\u2610 " : "";
      children.forEach((child, idx) => {
        if (child.type === "bullet_list" || child.type === "ordered_list") {
          out.push(...this.serializeList(child, child.type === "ordered_list", level + 1));
        } else if (idx === 0) {
          const runs = this.inlineChildren(child.content);
          const first = prefix ? [new d.TextRun({ text: prefix }), ...runs] : runs;
          out.push(
            new d.Paragraph({
              numbering: { reference, level },
              children: first
            })
          );
        } else {
          out.push(
            new d.Paragraph({
              indent: { left: (level + 1) * INDENT_TWIP_PER_LEVEL },
              children: this.inlineChildren(child.content)
            })
          );
        }
      });
    }
    return out;
  }
  serializeTable(node) {
    const d = this.docx;
    const rows = (node.content ?? []).filter((row) => row.type === "table_row").map((row) => {
      const cells = (row.content ?? []).map((cell) => {
        const fill = toHex(cell.attrs?.background);
        return new d.TableCell({
          children: this.serializeBlocks(cell.content ?? []),
          columnSpan: Number(cell.attrs?.colspan ?? 1) || 1,
          rowSpan: Number(cell.attrs?.rowspan ?? 1) || 1,
          ...fill ? { shading: { type: d.ShadingType.CLEAR, fill } } : {}
        });
      });
      return new d.TableRow({ children: cells });
    });
    return new d.Table({
      rows,
      width: { size: 100, type: d.WidthType.PERCENTAGE }
    });
  }
  async build(doc, options) {
    this.docx = await loadDocx();
    const d = this.docx;
    const page = options.page ?? chunkAT25KOMU_cjs.DEFAULT_PAGE;
    const { width, height } = chunkAT25KOMU_cjs.resolvePageDimensions(page);
    const children = this.serializeBlocks(doc.content ?? []);
    const mmToTwip = (mm) => Math.round(mm / 25.4 * 1440);
    return new d.Document({
      numbering: { config: this.numberingConfigs },
      sections: [
        {
          properties: {
            page: {
              size: { width: mmToTwip(width), height: mmToTwip(height) },
              margin: {
                top: mmToTwip(page.margins.top),
                right: mmToTwip(page.margins.right),
                bottom: mmToTwip(page.margins.bottom),
                left: mmToTwip(page.margins.left)
              }
            }
          },
          children
        }
      ]
    });
  }
};
function base64ToUint8(b64) {
  if (typeof atob === "function") {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}
async function documentToDocxBlob(doc, options = {}) {
  const serializer = new DocxSerializer(options.nodeConverters);
  const document2 = await serializer.build(doc, options);
  const { Packer } = await loadDocx();
  return Packer.toBlob(document2);
}
async function documentToDocxBuffer(doc, options = {}) {
  const serializer = new DocxSerializer(options.nodeConverters);
  const document2 = await serializer.build(doc, options);
  const { Packer } = await loadDocx();
  return Packer.toBuffer(document2);
}

// src/export/pdf.ts
function printDocumentToPdf(doc, options = {}) {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("printDocumentToPdf requires a browser environment."));
  }
  const page = options.page ?? chunkAT25KOMU_cjs.DEFAULT_PAGE;
  const html = chunkRSAUVRYX_cjs.buildPrintDocument(doc, page, options.title);
  return new Promise((resolve, reject) => {
    try {
      const iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const cleanup = () => {
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1e3);
      };
      const win = iframe.contentWindow;
      const docu = iframe.contentDocument || win?.document;
      if (!win || !docu) {
        cleanup();
        reject(new Error("Unable to access print frame document."));
        return;
      }
      docu.open();
      docu.write(html);
      docu.close();
      const doPrint = () => {
        try {
          win.focus();
          win.print();
          resolve();
        } catch (err) {
          reject(err);
        } finally {
          cleanup();
        }
      };
      if (docu.readyState === "complete") {
        setTimeout(doPrint, 50);
      } else {
        iframe.addEventListener("load", () => setTimeout(doPrint, 50), { once: true });
      }
    } catch (err) {
      reject(err);
    }
  });
}

// src/export/download.ts
function downloadBlob(blob, filename) {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("downloadBlob requires a browser environment.");
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
function downloadText(text, filename, mime = "text/plain") {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

// src/export/index.ts
async function exportDocument(doc, format, options = {}) {
  const base = options.filename ?? options.title ?? "document";
  switch (format) {
    case "docx": {
      const blob = await documentToDocxBlob(doc, { page: options.page, title: options.title });
      downloadBlob(blob, ensureExt(base, "docx"));
      return;
    }
    case "pdf":
      await printDocumentToPdf(doc, { page: options.page, title: options.title });
      return;
    case "txt":
      downloadText(documentToText(doc, options.text), ensureExt(base, "txt"));
      return;
    case "html": {
      const { buildPrintDocument: buildPrintDocument2 } = await import('./html-22BYHMZQ.cjs');
      downloadText(
        buildPrintDocument2(doc, options.page ?? (await import('./defaults-RXR3GJHJ.cjs')).DEFAULT_PAGE, options.title),
        ensureExt(base, "html"),
        "text/html"
      );
      return;
    }
    default:
      throw new Error(`Unsupported export format: ${String(format)}`);
  }
}
function ensureExt(name, ext) {
  return name.toLowerCase().endsWith(`.${ext}`) ? name : `${name}.${ext}`;
}

exports.documentToDocxBlob = documentToDocxBlob;
exports.documentToDocxBuffer = documentToDocxBuffer;
exports.documentToText = documentToText;
exports.downloadBlob = downloadBlob;
exports.downloadText = downloadText;
exports.exportDocument = exportDocument;
exports.printDocumentToPdf = printDocumentToPdf;
//# sourceMappingURL=chunk-W42WUCAR.cjs.map
//# sourceMappingURL=chunk-W42WUCAR.cjs.map