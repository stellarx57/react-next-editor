'use client';

import { useMemo, type CSSProperties, type ReactElement } from 'react';
import type { DocumentJSON } from '../config/types';
import { documentToText, type TextConversionOptions } from '../export/text';

export interface DocumentTextProps {
  /**
   * The content: ProseMirror JSON, a document-JSON string, a plain-text string
   * (rendered as-is — useful for legacy/pre-rich-text values), or null.
   */
  value: DocumentJSON | string | null | undefined;
  /**
   * Clamp the rendered text to N lines with a trailing ellipsis (CSS
   * line-clamp). Omit for no clamping.
   */
  clamp?: number;
  /** Text shown when the document is empty or blank. Default ''. */
  empty?: string;
  /** Options forwarded to {@link documentToText}. */
  textOptions?: TextConversionOptions;
  /** Element to render. Default 'p'. */
  as?: 'p' | 'div' | 'span';
  className?: string;
  style?: CSSProperties;
}

/** Parse/normalize the input to a document node, or null if it is not one. */
function toDoc(value: DocumentTextProps['value']): DocumentJSON | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as DocumentJSON;
      return parsed?.type === 'doc' ? parsed : null;
    } catch {
      return null;
    }
  }
  return value.type === 'doc' ? value : null;
}

/**
 * A read-only, plain-text preview of a document. Serializes document JSON with
 * the shared {@link documentToText} converter and renders the result as text
 * only (no HTML, no editor, no `dangerouslySetInnerHTML`) — safe even for
 * attacker-controlled JSON. A string that is **not** document JSON is treated as
 * already-plain text and rendered as-is, so this also previews legacy/migrated
 * values that were stored as plain strings. Ideal for list rows, cards, and
 * table cells that need a short, clamped summary of mixed content.
 */
export function DocumentText({
  value,
  clamp,
  empty = '',
  textOptions,
  as = 'p',
  className,
  style,
}: DocumentTextProps): ReactElement {
  const text = useMemo(() => {
    if (typeof value === 'string') {
      // A document-JSON string is converted; any other string is already plain
      // text (a legacy/pre-rich-text value) and is rendered verbatim.
      const doc = toDoc(value);
      return (doc ? documentToText(doc, textOptions) : value).trim();
    }
    const doc = toDoc(value);
    return doc ? documentToText(doc, textOptions).trim() : '';
  }, [value, textOptions]);

  const clampStyle: CSSProperties = clamp
    ? {
        display: '-webkit-box',
        WebkitLineClamp: clamp,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
      }
    : { whiteSpace: 'pre-wrap' };

  const Tag = as;
  return (
    <Tag
      className={`rne-document-text${className ? ` ${className}` : ''}`}
      style={{ ...clampStyle, ...style }}
    >
      {text || empty}
    </Tag>
  );
}
