/**
 * Document import (§5.7). Best-effort conversion of external `.docx` files into
 * the editor's schema. Optional, lazily-loaded `mammoth` dependency.
 */
export {
  importDocx,
  importDocxToJSON,
  type DocxImportResult,
  type DocxImportOptions,
  type DocxToJsonOptions,
} from './docx';
