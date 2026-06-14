import type { DocumentJSON, PageConfig } from '../config/types';
import { DEFAULT_PAGE, resolvePageDimensions } from '../config/defaults';
import { sanitizeUrl } from '../security/sanitize';

/**
 * Isomorphic DOCX serializer (§8.3). Walks the document JSON and emits OOXML via
 * the `docx` library, which runs in both the browser (Blob) and Node
 * (Buffer/Stream). A per-node mapping is used so custom nodes can register their
 * own conversion (F-6.16, F-10.14). The `docx` module is imported lazily so it
 * stays out of the initial bundle (NF-2) and remains optional.
 */

/** A converter for a custom node type, returning docx block elements. */
export type DocxNodeConverter = (
  node: DocumentJSON,
  ctx: DocxContext,
) => unknown[];

export interface DocxExportOptions {
  page?: PageConfig;
  title?: string;
  /** Custom node converters keyed by node type name (extension mapping). */
  nodeConverters?: Record<string, DocxNodeConverter>;
}

export interface DocxContext {
  serializeBlocks: (nodes: DocumentJSON[]) => unknown[];
  docx: DocxModule;
}

type DocxModule = typeof import('docx');

let docxModulePromise: Promise<DocxModule> | null = null;
async function loadDocx(): Promise<DocxModule> {
  if (!docxModulePromise) docxModulePromise = import('docx');
  return docxModulePromise;
}

const HALF_POINT = 2; // docx font sizes are in half-points
const INDENT_TWIP_PER_LEVEL = 720; // 0.5 inch

function toHex(value: unknown): string | null {
  const v = String(value ?? '').trim();
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(v);
  if (!m) return null;
  const hex = m[1]!;
  return hex.length === 3
    ? hex
        .split('')
        .map((c) => c + c)
        .join('')
    : hex;
}

interface MarkJSON {
  type: string;
  attrs?: Record<string, unknown>;
}

class DocxSerializer {
  private docx!: DocxModule;
  private numberingConfigs: unknown[] = [];
  private refCounter = 0;
  private converters: Record<string, DocxNodeConverter>;

  constructor(converters: Record<string, DocxNodeConverter> = {}) {
    this.converters = converters;
  }

  private allocListRef(ordered: boolean): string {
    const d = this.docx;
    const reference = `rne-list-${this.refCounter++}`;
    const levels = Array.from({ length: 9 }, (_, level) => {
      if (ordered) {
        const formats = [
          d.LevelFormat.DECIMAL,
          d.LevelFormat.LOWER_LETTER,
          d.LevelFormat.LOWER_ROMAN,
        ];
        return {
          level,
          format: formats[level % 3]!,
          text: `%${level + 1}.`,
          alignment: d.AlignmentType.START,
          style: { paragraph: { indent: { left: (level + 1) * 720, hanging: 360 } } },
        };
      }
      const bullets = ['•', '◦', '▪'];
      return {
        level,
        format: d.LevelFormat.BULLET,
        text: bullets[level % 3]!,
        alignment: d.AlignmentType.START,
        style: { paragraph: { indent: { left: (level + 1) * 720, hanging: 360 } } },
      };
    });
    this.numberingConfigs.push({ reference, levels });
    return reference;
  }

  /** Build run options from a text node's marks. */
  private runOptions(marks: MarkJSON[]): Record<string, unknown> {
    const d = this.docx;
    const o: Record<string, unknown> = {};
    for (const mark of marks) {
      switch (mark.type) {
        case 'strong':
          o.bold = true;
          break;
        case 'em':
          o.italics = true;
          break;
        case 'underline':
          o.underline = {};
          break;
        case 'strikethrough':
          o.strike = true;
          break;
        case 'superscript':
          o.superScript = true;
          break;
        case 'subscript':
          o.subScript = true;
          break;
        case 'code':
          o.font = 'Courier New';
          break;
        case 'fontFamily':
          o.font = String(mark.attrs?.family ?? '');
          break;
        case 'fontSize': {
          const size = Number(mark.attrs?.size);
          if (Number.isFinite(size) && size > 0) o.size = Math.round(size * HALF_POINT);
          break;
        }
        case 'textColor': {
          const hex = toHex(mark.attrs?.color);
          if (hex) o.color = hex;
          break;
        }
        case 'highlight': {
          const hex = toHex(mark.attrs?.color);
          if (hex) o.shading = { type: d.ShadingType.CLEAR, fill: hex };
          break;
        }
        default:
          break;
      }
    }
    return o;
  }

  /** Serialize inline content into docx runs / hyperlinks. */
  private inlineChildren(content: DocumentJSON[] | undefined): unknown[] {
    const d = this.docx;
    if (!content) return [];
    const out: unknown[] = [];
    for (const node of content) {
      if (node.type === 'text') {
        const marks = (node.marks ?? []) as MarkJSON[];
        const link = marks.find((m) => m.type === 'link');
        const runOpts = this.runOptions(marks.filter((m) => m.type !== 'link'));
        const run = new d.TextRun({ text: node.text ?? '', ...runOpts });
        if (link?.attrs?.href) {
          const href = sanitizeUrl(String(link.attrs.href));
          if (href) {
            out.push(new d.ExternalHyperlink({ children: [run], link: href }));
            continue;
          }
        }
        out.push(run);
      } else if (node.type === 'hard_break') {
        out.push(new d.TextRun({ break: 1 }));
      } else if (node.type === 'image') {
        const img = this.imageRun(node);
        if (img) out.push(img);
      }
    }
    return out;
  }

  private imageRun(node: DocumentJSON): unknown | null {
    const d = this.docx;
    const src = String(node.attrs?.src ?? '');
    const match = /^data:image\/(png|jpe?g|gif|bmp);base64,([A-Za-z0-9+/=]+)$/.exec(src);
    if (!match) return null; // remote images can't be fetched synchronously; skipped
    const raw = match[1]!;
    const type = raw === 'jpeg' ? 'jpg' : raw;
    const data = base64ToUint8(match[2]!);
    const width = Number(node.attrs?.width) || 300;
    const height = Math.round(width * 0.75);
    try {
      return new d.ImageRun({
        data,
        type: type as 'png' | 'jpg' | 'gif' | 'bmp',
        transformation: { width, height },
      });
    } catch {
      return null;
    }
  }

  private alignment(attrs: Record<string, unknown> | undefined): unknown {
    const d = this.docx;
    switch (attrs?.align) {
      case 'center':
        return d.AlignmentType.CENTER;
      case 'right':
        return d.AlignmentType.RIGHT;
      case 'justify':
        return d.AlignmentType.JUSTIFIED;
      case 'left':
        return d.AlignmentType.LEFT;
      default:
        return undefined;
    }
  }

  private paragraphProps(node: DocumentJSON): Record<string, unknown> {
    const props: Record<string, unknown> = {};
    const align = this.alignment(node.attrs);
    if (align !== undefined) props.alignment = align;
    const indent = Number(node.attrs?.indent ?? 0);
    if (indent > 0) props.indent = { left: indent * INDENT_TWIP_PER_LEVEL };
    const lineHeight = Number(node.attrs?.lineHeight);
    if (Number.isFinite(lineHeight) && lineHeight > 0) {
      props.spacing = { line: Math.round(lineHeight * 240), lineRule: 'auto' };
    }
    return props;
  }

  private headingLevel(level: number): unknown {
    const d = this.docx;
    const map = [
      d.HeadingLevel.HEADING_1,
      d.HeadingLevel.HEADING_2,
      d.HeadingLevel.HEADING_3,
      d.HeadingLevel.HEADING_4,
      d.HeadingLevel.HEADING_5,
      d.HeadingLevel.HEADING_6,
    ];
    return map[Math.min(5, Math.max(0, level - 1))];
  }

  serializeBlocks(nodes: DocumentJSON[]): unknown[] {
    const out: unknown[] = [];
    for (const node of nodes) out.push(...this.serializeBlock(node));
    return out;
  }

  private serializeBlock(node: DocumentJSON): unknown[] {
    const d = this.docx;
    const custom = this.converters[node.type];
    if (custom) {
      return custom(node, { serializeBlocks: (n) => this.serializeBlocks(n), docx: this.docx });
    }
    switch (node.type) {
      case 'paragraph':
        return [
          new d.Paragraph({
            ...this.paragraphProps(node),
            children: this.inlineChildren(node.content) as never,
          }),
        ];
      case 'heading':
        return [
          new d.Paragraph({
            ...this.paragraphProps(node),
            heading: this.headingLevel(Number(node.attrs?.level ?? 1)) as never,
            children: this.inlineChildren(node.content) as never,
          }),
        ];
      case 'blockquote':
        return (node.content ?? []).flatMap((child) => {
          const blocks = this.serializeBlock(child);
          return blocks;
        });
      case 'horizontal_rule':
        return [
          new d.Paragraph({
            border: { bottom: { style: d.BorderStyle.SINGLE, size: 6, space: 1, color: '999999' } },
            children: [],
          }),
        ];
      case 'page_break':
        return [new d.Paragraph({ children: [new d.PageBreak()] })];
      case 'bullet_list':
      case 'ordered_list':
        return this.serializeList(node, node.type === 'ordered_list', 0);
      case 'table':
        return [this.serializeTable(node)];
      default:
        if (node.content) return this.serializeBlocks(node.content);
        return [];
    }
  }

  private serializeList(node: DocumentJSON, ordered: boolean, level: number): unknown[] {
    const d = this.docx;
    const reference = this.allocListRef(ordered);
    const out: unknown[] = [];
    for (const item of node.content ?? []) {
      if (item.type !== 'list_item') continue;
      const children = item.content ?? [];
      const checked = item.attrs?.checked;
      const prefix =
        checked === true ? '☑ ' : checked === false ? '☐ ' : '';

      children.forEach((child, idx) => {
        if (child.type === 'bullet_list' || child.type === 'ordered_list') {
          out.push(...this.serializeList(child, child.type === 'ordered_list', level + 1));
        } else if (idx === 0) {
          const runs = this.inlineChildren(child.content);
          const first = prefix ? [new d.TextRun({ text: prefix }), ...runs] : runs;
          out.push(
            new d.Paragraph({
              numbering: { reference, level },
              children: first as never,
            }),
          );
        } else {
          out.push(
            new d.Paragraph({
              indent: { left: (level + 1) * INDENT_TWIP_PER_LEVEL },
              children: this.inlineChildren(child.content) as never,
            }),
          );
        }
      });
    }
    return out;
  }

  private serializeTable(node: DocumentJSON): unknown {
    const d = this.docx;
    const rows = (node.content ?? [])
      .filter((row) => row.type === 'table_row')
      .map((row) => {
        const cells = (row.content ?? []).map((cell) => {
          const fill = toHex(cell.attrs?.background);
          return new d.TableCell({
            children: this.serializeBlocks(cell.content ?? []) as never,
            columnSpan: Number(cell.attrs?.colspan ?? 1) || 1,
            rowSpan: Number(cell.attrs?.rowspan ?? 1) || 1,
            ...(fill ? { shading: { type: d.ShadingType.CLEAR, fill } } : {}),
          });
        });
        return new d.TableRow({ children: cells });
      });
    return new d.Table({
      rows,
      width: { size: 100, type: d.WidthType.PERCENTAGE },
    });
  }

  async build(doc: DocumentJSON, options: DocxExportOptions): Promise<unknown> {
    this.docx = await loadDocx();
    const d = this.docx;
    const page = options.page ?? DEFAULT_PAGE;
    const { width, height } = resolvePageDimensions(page);
    const children = this.serializeBlocks(doc.content ?? []);
    const mmToTwip = (mm: number) => Math.round((mm / 25.4) * 1440);

    return new d.Document({
      numbering: { config: this.numberingConfigs as never },
      sections: [
        {
          properties: {
            page: {
              size: { width: mmToTwip(width), height: mmToTwip(height) },
              margin: {
                top: mmToTwip(page.margins.top),
                right: mmToTwip(page.margins.right),
                bottom: mmToTwip(page.margins.bottom),
                left: mmToTwip(page.margins.left),
              },
            },
          },
          children: children as never,
        },
      ],
    });
  }
}

function base64ToUint8(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  // Node fallback.
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/** Serialize a document to a DOCX Blob for client-side download (F-6.1, F-6.6). */
export async function documentToDocxBlob(
  doc: DocumentJSON,
  options: DocxExportOptions = {},
): Promise<Blob> {
  const serializer = new DocxSerializer(options.nodeConverters);
  const document = await serializer.build(doc, options);
  const { Packer } = await loadDocx();
  return Packer.toBlob(document as never);
}

/** Serialize a document to a DOCX Buffer for server-side storage (F-6.10). */
export async function documentToDocxBuffer(
  doc: DocumentJSON,
  options: DocxExportOptions = {},
): Promise<Buffer> {
  const serializer = new DocxSerializer(options.nodeConverters);
  const document = await serializer.build(doc, options);
  const { Packer } = await loadDocx();
  return Packer.toBuffer(document as never);
}
