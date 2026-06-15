'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import type { DocumentJSON } from '../config/types';
import { documentToHtml } from '../export/html';
import { preloadSanitizer, sanitizeHtmlSync } from '../security/sanitize';

export interface DocumentViewProps {
  /** The document to render: ProseMirror JSON, a JSON string, or null/undefined. */
  value: DocumentJSON | string | null | undefined;
  /** Extra class appended to the root element. */
  className?: string;
  style?: CSSProperties;
}

/** Parse/normalize the input to a document node, or null if it is not one. */
function toDoc(value: DocumentViewProps['value']): DocumentJSON | null {
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
 * Lightweight, read-only document renderer. Unlike {@link Editor}, it does NOT
 * mount a ProseMirror `EditorView` — it serializes the document to HTML with the
 * shared {@link documentToHtml} serializer and renders it directly. Ideal for
 * cards, lists, previews, and any place that only needs to *display* content
 * cheaply (no editing, no toolbar, minimal cost per instance).
 *
 * Security: `documentToHtml` already emits only whitelisted, escaped HTML with
 * sanitized URLs/CSS, so output is safe even for attacker-controlled JSON. Once
 * the DOM sanitizer has loaded, a DOMPurify pass is applied as defense-in-depth.
 *
 * Styling: wrap your app once with the package stylesheet
 * (`import 'react-next-editor-js/styles.css'`) so `.rne-document-view` content is
 * themed consistently with the editor.
 */
export function DocumentView({ value, className, style }: DocumentViewProps): ReactElement {
  // Preload the DOM sanitizer so the defense-in-depth pass becomes active.
  const [sanitizerReady, setSanitizerReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void preloadSanitizer().then(() => {
      if (alive) setSanitizerReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const html = useMemo(() => {
    const doc = toDoc(value);
    if (!doc) return '';
    const raw = documentToHtml(doc);
    // `raw` is already safe; apply DOMPurify once available for defense-in-depth.
    return sanitizerReady ? sanitizeHtmlSync(raw) : raw;
  }, [value, sanitizerReady]);

  return (
    <div
      className={`rne-root rne-document-view${className ? ` ${className}` : ''}`}
      style={style}
      // eslint-disable-next-line react/no-danger -- html is produced by the package's
      // own sanitizing serializer (and DOMPurify-hardened once loaded).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
