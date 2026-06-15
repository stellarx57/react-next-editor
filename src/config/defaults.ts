import type {
  EditorStrings,
  FeatureFlags,
  PageConfig,
  PageSize,
  ThemeTokens,
  ToolbarItemId,
} from './types';

/** All features enabled by default; integrations opt out per instance. */
export const DEFAULT_FEATURES: FeatureFlags = {
  bold: true,
  italic: true,
  underline: true,
  strikethrough: true,
  superscript: true,
  subscript: true,
  code: true,
  fontFamily: true,
  fontSize: true,
  textColor: true,
  highlight: true,
  clearFormatting: true,
  headings: true,
  alignment: true,
  lineSpacing: true,
  indentation: true,
  bulletList: true,
  orderedList: true,
  taskList: true,
  blockquote: true,
  horizontalRule: true,
  table: true,
  image: true,
  link: true,
  pageBreak: true,
  history: true,
  wordCount: true,
  docxImport: true,
};

/** Physical page dimensions in millimetres for the supported standard sizes. */
export const PAGE_DIMENSIONS_MM: Record<Exclude<PageSize, 'custom'>, { width: number; height: number }> =
  {
    A4: { width: 210, height: 297 },
    Letter: { width: 215.9, height: 279.4 },
    Legal: { width: 215.9, height: 355.6 },
    A5: { width: 148, height: 210 },
  };

export const DEFAULT_PAGE: PageConfig = {
  size: 'A4',
  orientation: 'portrait',
  margins: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 },
  showPageChrome: true,
};

/** Resolve a {@link PageConfig} to concrete content-box dimensions in millimetres. */
export function resolvePageDimensions(page: PageConfig): { width: number; height: number } {
  let width: number;
  let height: number;
  if (page.size === 'custom') {
    width = page.widthMm ?? PAGE_DIMENSIONS_MM.A4.width;
    height = page.heightMm ?? PAGE_DIMENSIONS_MM.A4.height;
  } else {
    ({ width, height } = PAGE_DIMENSIONS_MM[page.size]);
  }
  if (page.orientation === 'landscape') {
    return { width: height, height: width };
  }
  return { width, height };
}

/** Default English UI strings (NF-6: externalized for localization). */
export const DEFAULT_STRINGS: EditorStrings = {
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strikethrough: 'Strikethrough',
  superscript: 'Superscript',
  subscript: 'Subscript',
  code: 'Inline code',
  textColor: 'Text color',
  highlight: 'Highlight',
  clearFormatting: 'Clear formatting',
  fontFamily: 'Font',
  fontSize: 'Font size',
  paragraphStyle: 'Style',
  paragraph: 'Normal text',
  heading: 'Heading',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  alignJustify: 'Justify',
  bulletList: 'Bulleted list',
  orderedList: 'Numbered list',
  taskList: 'Task list',
  indent: 'Increase indent',
  outdent: 'Decrease indent',
  blockquote: 'Blockquote',
  horizontalRule: 'Horizontal rule',
  link: 'Link',
  linkPrompt: 'Enter URL',
  removeLink: 'Remove link',
  image: 'Image',
  imagePrompt: 'Enter image URL',
  imageAltPrompt: 'Describe the image (alt text)',
  table: 'Table',
  insertTable: 'Insert table',
  addRowBefore: 'Insert row above',
  addRowAfter: 'Insert row below',
  deleteRow: 'Delete row',
  addColumnBefore: 'Insert column left',
  addColumnAfter: 'Insert column right',
  deleteColumn: 'Delete column',
  mergeCells: 'Merge cells',
  splitCell: 'Split cell',
  deleteTable: 'Delete table',
  pageBreak: 'Page break',
  importDocx: 'Import .docx',
  undo: 'Undo',
  redo: 'Redo',
  words: 'words',
  characters: 'characters',
  readOnly: 'Read only',
};

/** Font families offered by the font picker. Consumers can override via config. */
export const DEFAULT_FONT_FAMILIES: string[] = [
  'Arial',
  'Calibri',
  'Cambria',
  'Georgia',
  'Helvetica',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Courier New',
];

/** Font sizes (pt) offered by the size picker. */
export const DEFAULT_FONT_SIZES: number[] = [8, 9, 10, 11, 12, 14, 16, 18, 24, 30, 36, 48, 60, 72];

/** A palette of colors offered by the color/highlight pickers. */
export const DEFAULT_COLOR_PALETTE: string[] = [
  '#000000',
  '#434343',
  '#666666',
  '#999999',
  '#b7b7b7',
  '#cccccc',
  '#ffffff',
  '#df4a36',
  '#e69138',
  '#f1c232',
  '#6aa84f',
  '#45818e',
  '#3d85c6',
  '#674ea7',
  '#a64d79',
];

/** Default toolbar layout, grouped. Filtered by enabled features at render time. */
export const DEFAULT_TOOLBAR_GROUPS: ToolbarItemId[][] = [
  ['undo', 'redo'],
  ['paragraphStyle', 'fontFamily', 'fontSize'],
  ['bold', 'italic', 'underline', 'strikethrough', 'superscript', 'subscript', 'code'],
  ['textColor', 'highlight', 'clearFormatting'],
  ['alignLeft', 'alignCenter', 'alignRight', 'alignJustify'],
  ['bulletList', 'orderedList', 'taskList', 'indent', 'outdent'],
  ['blockquote', 'horizontalRule', 'link', 'image', 'table', 'pageBreak'],
  ['importDocx'],
];

/** Map a {@link ThemeTokens} object to a CSS custom-property style record. */
export function themeToCssVars(theme: ThemeTokens | undefined): Record<string, string> {
  if (!theme) return {};
  const map: Array<[keyof ThemeTokens, string]> = [
    ['fontFamily', '--rne-font-family'],
    ['fontSize', '--rne-font-size'],
    ['textColor', '--rne-text-color'],
    ['background', '--rne-background'],
    ['canvasBackground', '--rne-canvas-background'],
    ['pageBackground', '--rne-page-background'],
    ['accent', '--rne-accent'],
    ['toolbarBackground', '--rne-toolbar-background'],
    ['toolbarColor', '--rne-toolbar-color'],
    ['toolbarActiveBackground', '--rne-toolbar-active-background'],
    ['borderColor', '--rne-border-color'],
    ['borderRadius', '--rne-border-radius'],
    ['selectionColor', '--rne-selection-color'],
  ];
  const out: Record<string, string> = {};
  for (const [key, cssVar] of map) {
    const value = theme[key];
    if (value != null) out[cssVar] = value;
  }
  return out;
}
