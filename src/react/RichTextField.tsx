'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type FocusEvent,
} from 'react';
import type { DocumentJSON, ToolbarConfig, ToolbarItemId } from '../config/types';
import { DEFAULT_TOOLBAR_GROUPS } from '../config/defaults';
import { documentToText, type TextConversionOptions } from '../export/text';
import { documentToHtml } from '../export/html';
import { Editor } from './Editor';
import type { EditorProps, EditorRef } from './types';

/** Derived representations passed alongside the JSON string on every change. */
export interface RichTextFieldChangeMeta {
  /** Plain-text rendering (ideal for a companion text column or previews). */
  text: string;
  /** HTML rendering of the document. */
  html: string;
  /** The document as ProseMirror JSON (the parsed form of the emitted string). */
  json: DocumentJSON;
}

/** Imperative handle for {@link RichTextField} — the editor API plus `commit`. */
export interface RichTextFieldRef extends EditorRef {
  /**
   * Flush any pending debounced change immediately so the latest content is
   * emitted through `onChange` synchronously. Call this before reading form
   * state on submit when a non-zero `debounceMs` is in effect.
   */
  commit(): void;
}

/**
 * Props for {@link RichTextField}. A form-first superset of {@link EditorProps}:
 * `value`/`onChange` speak document-JSON *strings* (what most apps store) and the
 * debounce, flush-on-blur, and derived text/html are handled internally.
 */
export interface RichTextFieldProps
  extends Omit<EditorProps, 'value' | 'onChange' | 'apiRef'> {
  /**
   * Controlled value as a document-JSON *string*. An empty string or a value
   * that is not a serialized document renders an empty editor (legacy plain-text
   * values can be seeded via `initialContent`).
   */
  value?: string;
  /**
   * Emitted (debounced) with the serialized JSON string and derived
   * representations. Pair with `value` for a controlled field.
   */
  onChange?: (value: string, meta: RichTextFieldChangeMeta) => void;
  /** Debounce applied to `onChange`, in ms (default 250). `0` emits synchronously. */
  debounceMs?: number;
  /** Add Download Word / Download PDF actions to the toolbar. Default false. */
  download?: boolean;
  /**
   * Enable the "Import .docx" toolbar action (also turns on `features.docxImport`).
   * Default false — the import button is hidden unless explicitly allowed.
   */
  allowDocxImport?: boolean;
  /** Options forwarded to the plain-text conversion in `onChange` meta. */
  textOptions?: TextConversionOptions;
  /** Imperative handle as a prop (survives `next/dynamic`). */
  apiRef?: React.MutableRefObject<RichTextFieldRef | null>;
}

/** An empty document, returned by the handle before the editor has mounted. */
const EMPTY_DOC: DocumentJSON = { type: 'doc', content: [{ type: 'paragraph' }] };

/** Parse a JSON string into a document node, or null when it is not one. */
function parseDoc(value: string | undefined): DocumentJSON | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as DocumentJSON;
    return parsed && parsed.type === 'doc' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * A form-oriented wrapper around {@link Editor}. It stores and emits the document
 * as a JSON **string** (so it drops straight into string-valued form state),
 * debounces `onChange`, flushes on blur, and exposes `commit()` for submit-time
 * flushing. Optional `download` adds Word/PDF toolbar actions and
 * `allowDocxImport` enables Word upload — no custom UI required. All other
 * {@link EditorProps} (offline `persistence`/`documentId`, `readOnly`, `theme`,
 * `page`, …) pass straight through.
 */
export const RichTextField = forwardRef<RichTextFieldRef, RichTextFieldProps>(
  function RichTextField(props, ref) {
    const {
      value,
      onChange,
      debounceMs = 250,
      download = false,
      allowDocxImport = false,
      textOptions,
      apiRef,
      features: featuresProp,
      toolbar: toolbarProp,
      ...rest
    } = props;

    const editorApiRef = useRef<EditorRef | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const textOptionsRef = useRef(textOptions);
    textOptionsRef.current = textOptions;

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingRef = useRef<DocumentJSON | null>(null);

    const emit = useCallback((json: DocumentJSON) => {
      pendingRef.current = null;
      const cb = onChangeRef.current;
      if (!cb) return;
      cb(JSON.stringify(json), {
        text: documentToText(json, textOptionsRef.current),
        html: documentToHtml(json),
        json,
      });
    }, []);

    const flush = useCallback(() => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (pendingRef.current) emit(pendingRef.current);
    }, [emit]);

    const handleEditorChange = useCallback(
      (json: DocumentJSON) => {
        pendingRef.current = json;
        if (debounceMs <= 0) {
          emit(json);
          return;
        }
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          if (pendingRef.current) emit(pendingRef.current);
        }, debounceMs);
      },
      [debounceMs, emit],
    );

    // Flush a pending change when focus leaves the field entirely (not when it
    // merely moves between the toolbar and the editing surface).
    const handleBlur = useCallback(
      (e: FocusEvent<HTMLDivElement>) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        flush();
      },
      [flush],
    );

    // Clear any pending timer on unmount.
    useEffect(
      () => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      },
      [],
    );

    const parsedValue = useMemo(() => parseDoc(value), [value]);

    const mergedFeatures = useMemo(
      () => ({ docxImport: allowDocxImport, ...featuresProp }),
      [allowDocxImport, featuresProp],
    );

    const mergedToolbar = useMemo<ToolbarConfig | false | undefined>(() => {
      if (!download || toolbarProp === false) return toolbarProp;
      const baseGroups = toolbarProp?.groups ?? DEFAULT_TOOLBAR_GROUPS;
      const exportGroup: ToolbarItemId[] = ['exportDocx', 'exportPdf'];
      return { ...toolbarProp, groups: [...baseGroups, exportGroup] };
    }, [download, toolbarProp]);

    const fieldHandle = useMemo<RichTextFieldRef>(
      () => ({
        getJSON: () => editorApiRef.current?.getJSON() ?? EMPTY_DOC,
        getText: (options) => editorApiRef.current?.getText(options) ?? '',
        getHTML: () => editorApiRef.current?.getHTML() ?? '',
        setContent: (content) => editorApiRef.current?.setContent(content),
        importDocx: (file) =>
          editorApiRef.current?.importDocx(file) ?? Promise.resolve({ warnings: [] }),
        focus: () => editorApiRef.current?.focus(),
        isDirty: () => editorApiRef.current?.isDirty() ?? false,
        save: () => editorApiRef.current?.save() ?? Promise.resolve(),
        clearLocalData: () => editorApiRef.current?.clearLocalData() ?? Promise.resolve(),
        exportAs: (format, filename) =>
          editorApiRef.current?.exportAs(format, filename) ?? Promise.resolve(),
        getView: () => editorApiRef.current?.getView() ?? null,
        getState: () => editorApiRef.current?.getState() ?? null,
        getSchema: () => editorApiRef.current?.getSchema() ?? null,
        commit: flush,
      }),
      [flush],
    );

    useImperativeHandle(ref, () => fieldHandle, [fieldHandle]);

    // Mirror the handle onto the optional `apiRef` prop (survives next/dynamic).
    useEffect(() => {
      if (!apiRef) return;
      apiRef.current = fieldHandle;
      return () => {
        if (apiRef.current === fieldHandle) apiRef.current = null;
      };
    }, [apiRef, fieldHandle]);

    return (
      <div className="rne-field" onBlur={handleBlur}>
        <Editor
          {...rest}
          value={parsedValue}
          onChange={handleEditorChange}
          features={mergedFeatures}
          toolbar={mergedToolbar}
          apiRef={editorApiRef}
        />
      </div>
    );
  },
);
