/**
 * Framework-agnostic editor core (no React, no backend). Exposes the schema,
 * commands, plugins, state factory and small utilities. Importable in Node for
 * tests and the isomorphic exporters.
 */
export * from './schema/index';
export * from './commands/index';
export * from './plugins/index';
export {
  createEditorState,
  createDoc,
  type CreateEditorStateOptions,
  type EditorContent,
} from './state/createEditorState';
export { countDocument, type DocumentStats } from './utils';

export type {
  DocumentJSON,
  EditorMode,
  FeatureFlags,
  PageSize,
  PageConfig,
  ThemeTokens,
  ToolbarItemId,
  ToolbarConfig,
  EditorStrings,
  SaveStatus,
} from '../config/types';
export {
  DEFAULT_FEATURES,
  DEFAULT_PAGE,
  DEFAULT_STRINGS,
  DEFAULT_TOOLBAR_GROUPS,
  DEFAULT_FONT_FAMILIES,
  DEFAULT_FONT_SIZES,
  DEFAULT_COLOR_PALETTE,
  PAGE_DIMENSIONS_MM,
  resolvePageDimensions,
  themeToCssVars,
} from '../config/defaults';
export {
  sanitizeUrl,
  sanitizeImageSrc,
  sanitizeHtml,
  sanitizeHtmlSync,
  preloadSanitizer,
} from '../security/sanitize';
