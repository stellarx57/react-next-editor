'use client';

import { useMemo, type CSSProperties, type ReactElement } from 'react';
import type { DocumentJSON } from '../config/types';
import { documentToText, type TextConversionOptions } from '../export/text';

export interface DocumentTextProps {
  /** The document: ProseMirror JSON, a JSON string, or null/undefined. */
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
 * A read-only, plain-text preview of a document. Serializes with the shared
 * {@link documentToText} converter and renders the result as text only (no HTML,
 * no editor, no `dangerouslySetInnerHTML`) — safe even for attacker-controlled
 * JSON. Ideal for list rows, cards, and table cells that need a short, clamped
 * summary of rich content.
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
