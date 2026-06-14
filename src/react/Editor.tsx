'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { EditorView } from 'prosemirror-view';
import { type Command, EditorState, TextSelection } from 'prosemirror-state';
import type { Schema } from 'prosemirror-model';

import type { DocumentJSON, EditorStrings, FeatureFlags, PageConfig, SaveStatus } from '../config/types';
import {
  DEFAULT_COLOR_PALETTE,
  DEFAULT_FEATURES,
  DEFAULT_FONT_FAMILIES,
  DEFAULT_FONT_SIZES,
  DEFAULT_PAGE,
  DEFAULT_STRINGS,
  resolvePageDimensions,
  themeToCssVars,
} from '../config/defaults';
import { buildSchema } from '../core/schema/schema';
import { buildPlugins } from '../core/plugins/index';
import { createCommands, type CommandSet } from '../core/commands/index';
import { createDoc, createEditorState } from '../core/state/createEditorState';
import { preloadSanitizer } from '../security/sanitize';
import { documentToText } from '../export/text';
import { documentToHtml } from '../export/html';
import { exportDocument } from '../export/index';
import { DocumentPersistence } from '../persistence/autosave';
import { IndexedDBStore, requestPersistentStorage } from '../persistence/indexeddb';
import { EditorContext } from './EditorContext';
import { EditorErrorBoundary } from './ErrorBoundary';
import { Toolbar } from './toolbar/Toolbar';
import { StatusBar } from './StatusBar';
import type { EditorContextValue, EditorProps, EditorRef } from './types';

interface ResolvedConfig {
  features: FeatureFlags;
  page: PageConfig;
  strings: EditorStrings;
  fontFamilies: string[];
  fontSizes: number[];
  colorPalette: string[];
  editable: boolean;
  placeholder: string | undefined;
}

function resolveConfig(props: EditorProps): ResolvedConfig {
  return {
    features: { ...DEFAULT_FEATURES, ...props.features },
    page: {
      ...DEFAULT_PAGE,
      ...props.page,
      margins: { ...DEFAULT_PAGE.margins, ...props.page?.margins },
    },
    strings: { ...DEFAULT_STRINGS, ...props.strings },
    fontFamilies: props.fontFamilies ?? DEFAULT_FONT_FAMILIES,
    fontSizes: props.fontSizes ?? DEFAULT_FONT_SIZES,
    colorPalette: props.colorPalette ?? DEFAULT_COLOR_PALETTE,
    editable: !(props.readOnly || props.mode === 'readonly'),
    placeholder: props.placeholder,
  };
}

const EditorInner = forwardRef<EditorRef, EditorProps>(function EditorInner(props, ref) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const persistenceRef = useRef<DocumentPersistence | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const config = useMemo(() => resolveConfig(props), [props]);
  const cfgRef = useRef(config);
  cfgRef.current = config;

  // Build the editing engine (schema + commands) once per feature set + placeholder.
  const featureKey = useMemo(() => JSON.stringify(config.features), [config.features]);
  const engine = useMemo(() => {
    const schema: Schema = buildSchema(config.features);
    const commands: CommandSet = createCommands(schema);
    return { schema, commands };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureKey]);

  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [ready, setReady] = useState(false);

  // ---- Imperative handle (F-10.15, F-10.16) ----
  const getJSON = useCallback((): DocumentJSON => {
    const view = viewRef.current;
    return (view ? view.state.doc.toJSON() : createDoc(engine.schema, null).toJSON()) as DocumentJSON;
  }, [engine.schema]);

  const setContent = useCallback(
    (content: DocumentJSON | string | null) => {
      const view = viewRef.current;
      if (!view) return;
      const doc = createDoc(view.state.schema, content);
      const state = EditorState.create({ doc, plugins: view.state.plugins });
      view.updateState(state);
      setEditorState(state);
    },
    [],
  );

  const handle = useMemo<EditorRef>(
    () => ({
      getJSON,
      getText: (options) => documentToText(getJSON(), options),
      getHTML: () => documentToHtml(getJSON()),
      setContent,
      focus: () => viewRef.current?.focus(),
      isDirty: () => persistenceRef.current?.isDirty() ?? false,
      save: async () => {
        await persistenceRef.current?.saveNow(getJSON());
      },
      clearLocalData: async () => {
        await persistenceRef.current?.clearLocal();
      },
      exportAs: (format, filename) =>
        exportDocument(getJSON(), format, {
          filename: filename ?? propsRef.current.documentId,
          page: cfgRef.current.page,
          title: filename ?? propsRef.current.documentId,
        }),
      getView: () => viewRef.current,
      getState: () => viewRef.current?.state ?? null,
      getSchema: () => viewRef.current?.state.schema ?? null,
    }),
    [getJSON, setContent],
  );

  useImperativeHandle(ref, () => handle, [handle]);

  // ---- Create the ProseMirror view once (golden rule: PM owns the DOM) ----
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    void preloadSanitizer();

    const plugins = buildPlugins(engine.schema, {
      placeholder: cfgRef.current.placeholder,
      history: cfgRef.current.features.history,
      extraPlugins: propsRef.current.extensions?.plugins,
    });

    const initialContent =
      propsRef.current.value ?? propsRef.current.initialContent ?? null;
    const state = createEditorState({ schema: engine.schema, plugins, content: initialContent });

    const view = new EditorView(mount, {
      state,
      editable: () => !(propsRef.current.readOnly || propsRef.current.mode === 'readonly'),
      attributes: {
        class: 'rne-prosemirror',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': propsRef.current.ariaLabel ?? 'Document editor',
      },
      dispatchTransaction(tr) {
        const v = viewRef.current;
        if (!v) return;
        const newState = v.state.apply(tr);
        v.updateState(newState);
        setEditorState(newState);

        const p = propsRef.current;
        if (tr.docChanged) {
          const json = newState.doc.toJSON() as DocumentJSON;
          p.onChange?.(json, handle);
          persistenceRef.current?.scheduleSave(json);
        }
        if (tr.selectionSet) {
          p.onSelectionChange?.(newState);
        }
      },
    });

    viewRef.current = view;
    setEditorState(view.state);
    setReady(true);
    propsRef.current.onReady?.(handle);

    return () => {
      view.destroy();
      viewRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  // ---- Keep editability in sync without recreating the view ----
  useEffect(() => {
    viewRef.current?.setProps({
      editable: () => config.editable,
    });
    // Re-render to update toolbar disabled state.
    setEditorState((s) => s);
  }, [config.editable]);

  // ---- Local persistence + crash recovery (F-9.2, F-11.9) ----
  useEffect(() => {
    const documentId = props.documentId;
    const persistenceEnabled = props.persistence?.enabled ?? !!documentId;
    if (!documentId || !persistenceEnabled || !ready) return;

    const store = props.persistence?.store ?? new IndexedDBStore();
    const persistence = new DocumentPersistence({
      documentId,
      store,
      debounceMs: props.persistence?.debounceMs,
      metadata: props.metadata,
      onStatus: (status, detail) => {
        setSaveStatus(status);
        propsRef.current.onSaveStatusChange?.(status, detail);
      },
    });
    persistenceRef.current = persistence;

    if (props.persistence?.requestPersistent !== false) {
      void requestPersistentStorage();
    }

    let cancelled = false;
    void (async () => {
      const record = await persistence.load();
      if (cancelled || !record) return;
      // Only restore from local storage when no explicit controlled value is set.
      if (propsRef.current.value == null) {
        setContent(record.doc);
      }
    })();

    return () => {
      cancelled = true;
      void persistence.destroy();
      persistenceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.documentId, ready]);

  // ---- Controlled value sync (F-10.20) ----
  useEffect(() => {
    const view = viewRef.current;
    if (!view || props.value == null) return;
    const current = JSON.stringify(view.state.doc.toJSON());
    const next = JSON.stringify(props.value);
    if (current === next) return;
    const doc = createDoc(view.state.schema, props.value);
    const selectionPos = Math.min(view.state.selection.from, doc.content.size);
    const state = EditorState.create({ doc, plugins: view.state.plugins });
    const withSel = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, Math.max(0, selectionPos))),
    );
    view.updateState(withSel);
    setEditorState(withSel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);

  // ---- Context for toolbar/children ----
  const runCommand = useCallback((command: Command): boolean => {
    const view = viewRef.current;
    if (!view) return false;
    const result = command(view.state, view.dispatch, view);
    view.focus();
    return result;
  }, []);

  const contextValue = useMemo<EditorContextValue>(
    () => ({
      view: viewRef.current,
      state: editorState,
      schema: engine.schema,
      commands: engine.commands,
      strings: config.strings,
      features: config.features,
      fontFamilies: config.fontFamilies,
      fontSizes: config.fontSizes,
      colorPalette: config.colorPalette,
      editable: config.editable,
      run: runCommand,
    }),
    [editorState, engine, config, runCommand],
  );

  // ---- Layout / page surface ----
  const { width } = resolvePageDimensions(config.page);
  const showChrome = config.page.showPageChrome;
  const rootStyle = useMemo(
    () => ({
      ...themeToCssVars(props.theme),
      '--rne-page-width': `${width}mm`,
      '--rne-page-padding': `${config.page.margins.top}mm ${config.page.margins.right}mm ${config.page.margins.bottom}mm ${config.page.margins.left}mm`,
      ...props.style,
    }),
    [props.theme, props.style, width, config.page.margins],
  );

  const toolbarEnabled = props.toolbar !== false && (props.toolbar?.enabled ?? true) && config.editable;
  const statusBarEnabled = props.statusBar ?? true;

  return (
    <EditorContext.Provider value={contextValue}>
      <div
        className={`rne-root${props.className ? ` ${props.className}` : ''}`}
        style={rootStyle as React.CSSProperties}
        data-ready={ready}
      >
        {toolbarEnabled && <Toolbar config={props.toolbar || undefined} />}
        <div className={`rne-canvas${showChrome ? '' : ' rne-canvas--plain'}`}>
          <div className="rne-page">
            <div ref={mountRef} className="rne-mount" />
          </div>
        </div>
        {statusBarEnabled && <StatusBar saveStatus={saveStatus} hasPersistence={!!props.documentId} />}
      </div>
    </EditorContext.Provider>
  );
});

/**
 * The embeddable rich document editor (F-10.17). Client-only — load via
 * `next/dynamic(() => import('react-next-editor').then(m => m.Editor), { ssr: false })`.
 * Wrapped in an error boundary so a failure never takes down the host (F-11.2).
 */
export const Editor = forwardRef<EditorRef, EditorProps>(function Editor(props, ref) {
  return (
    <EditorErrorBoundary onError={props.onError}>
      <EditorInner {...props} ref={ref} />
    </EditorErrorBoundary>
  );
});
