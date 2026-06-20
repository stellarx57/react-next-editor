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
import { type Command, EditorState, Selection, TextSelection } from 'prosemirror-state';
import { Node as PMNode, type Schema } from 'prosemirror-model';

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
import type { PaginationGeometry } from '../core/pagination/plugin';
import { createCommands, type CommandSet } from '../core/commands/index';
import { createDoc, createEditorState } from '../core/state/createEditorState';
import { preloadSanitizer } from '../security/sanitize';
import { documentToText } from '../export/text';
import { documentToHtml } from '../export/html';
import { exportDocument } from '../export/index';
import { DocumentPersistence } from '../persistence/autosave';
import { IndexedDBStore, requestPersistentStorage } from '../persistence/indexeddb';
import { ConnectivityMonitor } from '../sync/connectivity';
import { SyncEngine } from '../sync/engine';
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

/** CSS pixels per millimetre at 96 DPI (the CSS reference). */
const PX_PER_MM = 96 / 25.4;
/** Visual gap (px) drawn on the canvas between consecutive page sheets. */
const PAGE_GAP_PX = 24;

/** Convert a page configuration (mm) into concrete pixel geometry, or null. */
function computePaginationGeometry(page: PageConfig): PaginationGeometry | null {
  if (page.pagination !== 'visual') return null;
  const { width, height } = resolvePageDimensions(page);
  const m = page.margins;
  const pageWidthPx = width * PX_PER_MM;
  const pageHeightPx = height * PX_PER_MM;
  const marginTopPx = m.top * PX_PER_MM;
  const marginBottomPx = m.bottom * PX_PER_MM;
  const marginLeftPx = m.left * PX_PER_MM;
  const contentWidthPx = Math.max(1, (width - m.left - m.right) * PX_PER_MM);
  const contentHeightPx = pageHeightPx - marginTopPx - marginBottomPx;
  if (contentHeightPx <= 0) return null;
  return {
    pageWidthPx,
    pageHeightPx,
    marginTopPx,
    marginBottomPx,
    marginLeftPx,
    contentWidthPx,
    contentHeightPx,
    interPageOffsetPx: marginBottomPx + PAGE_GAP_PX + marginTopPx,
  };
}

/**
 * Create a ref object for {@link EditorProps.apiRef}. Unlike a React `ref`, this
 * plain mutable ref survives `next/dynamic(..., { ssr: false })`, so it is the
 * recommended way to obtain the {@link EditorRef} imperative API in Next.js App
 * Router code. The editor populates `.current` on mount and clears it on unmount.
 */
export function useEditorApiRef(): React.MutableRefObject<EditorRef | null> {
  return useRef<EditorRef | null>(null);
}

const EditorInner = forwardRef<EditorRef, EditorProps>(function EditorInner(props, ref) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const persistenceRef = useRef<DocumentPersistence | null>(null);
  const pageBgRef = useRef<HTMLDivElement | null>(null);
  const remeasureRef = useRef<(() => void) | null>(null);
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

  const importDocxIntoEditor = useCallback(
    async (file: ArrayBuffer | Uint8Array | Blob): Promise<{ warnings: string[] }> => {
      const view = viewRef.current;
      if (!view) return { warnings: [] };
      const { importDocx } = await import('../import/docx');
      const result = await importDocx(file, view.state.schema);
      // Replace the whole document via a dispatched transaction so the change is
      // undoable and flows through onChange/autosave like any other edit.
      const node = PMNode.fromJSON(view.state.schema, result.doc);
      const v = viewRef.current;
      if (v) {
        const tr = v.state.tr.replaceWith(0, v.state.doc.content.size, node.content);
        v.dispatch(tr.scrollIntoView());
      }
      return { warnings: result.warnings };
    },
    [],
  );

  const exportAs = useCallback(
    (format: 'docx' | 'pdf' | 'txt' | 'html', filename?: string) =>
      exportDocument(getJSON(), format, {
        filename: filename ?? propsRef.current.documentId,
        page: cfgRef.current.page,
        title: filename ?? propsRef.current.documentId,
      }),
    [getJSON],
  );

  const handle = useMemo<EditorRef>(
    () => ({
      getJSON,
      getText: (options) => documentToText(getJSON(), options),
      getHTML: () => documentToHtml(getJSON()),
      setContent,
      importDocx: importDocxIntoEditor,
      focus: () => viewRef.current?.focus(),
      isDirty: () => persistenceRef.current?.isDirty() ?? false,
      save: async () => {
        await persistenceRef.current?.saveNow(getJSON());
      },
      clearLocalData: async () => {
        await persistenceRef.current?.clearLocal();
      },
      exportAs,
      getView: () => viewRef.current,
      getState: () => viewRef.current?.state ?? null,
      getSchema: () => viewRef.current?.state.schema ?? null,
    }),
    [getJSON, setContent, importDocxIntoEditor, exportAs],
  );

  useImperativeHandle(ref, () => handle, [handle]);

  // Mirror the imperative handle onto the optional `apiRef` prop. Consumers that
  // load the editor through `next/dynamic` (which does not forward React refs)
  // pass an `apiRef` and still get the full API. Cleared on unmount.
  useEffect(() => {
    const apiRef = props.apiRef;
    if (!apiRef) return;
    apiRef.current = handle;
    return () => {
      if (apiRef.current === handle) apiRef.current = null;
    };
  }, [props.apiRef, handle]);

  // ---- Create the ProseMirror view once (golden rule: PM owns the DOM) ----
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    void preloadSanitizer();

    const paginated = cfgRef.current.page.pagination === 'visual';
    const plugins = buildPlugins(engine.schema, {
      placeholder: cfgRef.current.placeholder,
      history: cfgRef.current.features.history,
      extraPlugins: propsRef.current.extensions?.plugins,
      pagination: paginated
        ? {
            getGeometry: () => computePaginationGeometry(cfgRef.current.page),
            getBackgroundLayer: () => pageBgRef.current,
            header: cfgRef.current.page.header,
            footer: cfgRef.current.page.footer,
            register: (fn) => {
              remeasureRef.current = fn;
            },
          }
        : undefined,
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
        dir: propsRef.current.dir ?? 'ltr',
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

  // ---- Local persistence, crash recovery (F-9.2, F-11.9), and sync (F-9.6–F-9.9, F-9.14) ----
  useEffect(() => {
    const documentId = props.documentId;
    const persistenceEnabled = props.persistence?.enabled ?? !!documentId;
    if (!documentId || !persistenceEnabled || !ready) return;

    const store = props.persistence?.store ?? new IndexedDBStore();
    const sync = props.sync;
    const auto = sync?.auto ?? true;

    let engine: SyncEngine | null = null;
    let monitor: ConnectivityMonitor | null = null;

    // Shared status handler: surfaces both local-save and sync transitions, and
    // triggers an upload after each successful local save when online (F-9.6).
    const handleStatus = (status: SaveStatus, detail?: { error?: string }) => {
      setSaveStatus(status);
      propsRef.current.onSaveStatusChange?.(status, detail);
      if (status === 'savedLocal' && engine && auto && (monitor?.isOnline() ?? true)) {
        void engine.flush();
      }
    };

    const persistence = new DocumentPersistence({
      documentId,
      store,
      debounceMs: props.persistence?.debounceMs,
      metadata: props.metadata,
      onStatus: handleStatus,
    });
    persistenceRef.current = persistence;

    if (sync?.remote) {
      engine = new SyncEngine({
        store,
        remote: sync.remote,
        maxAttempts: sync.maxAttempts,
        onStatus: handleStatus,
        onConflict: sync.onConflict,
      });
      const remotePing = sync.remote.ping?.bind(sync.remote);
      monitor = new ConnectivityMonitor({
        ping: remotePing,
        intervalMs: sync.pingIntervalMs,
        onChange: (online) => {
          if (online) {
            if (auto && engine) void engine.flush();
          } else {
            handleStatus('offline');
          }
        },
      });
      monitor.start();
      if (auto) void engine.flush(); // attempt to drain any queue from a prior session
    }

    if (props.persistence?.requestPersistent !== false) {
      void requestPersistentStorage();
    }

    let cancelled = false;
    void (async () => {
      const record = await persistence.load();
      if (cancelled || !record) return;
      const view = viewRef.current;
      if (!view) return;

      // Decide whether to surface the locally-persisted draft. By default a
      // *dirty* draft (unsaved local edits) is restored even over a controlled
      // value, so offline work made in a prior session is never lost on reopen;
      // a clean (already-synced) draft yields to the controlled/server value.
      const strategy = propsRef.current.persistence?.restore ?? 'whenDirty';
      const hasControlledValue = propsRef.current.value != null;
      const shouldRestore =
        strategy === 'always'
          ? true
          : strategy === 'whenEmpty'
            ? !hasControlledValue
            : /* whenDirty */ !hasControlledValue || record.dirty;
      if (!shouldRestore) return;

      // Nothing to do when the draft already matches the on-screen content.
      if (JSON.stringify(view.state.doc.toJSON()) === JSON.stringify(record.doc)) return;

      // Apply the draft over the current content. Re-checked guards keep this
      // safe even when invoked later (e.g. after the host prompts the user).
      const applyRestore = () => {
        if (cancelled) return;
        const v = viewRef.current;
        if (!v) return;
        if (JSON.stringify(v.state.doc.toJSON()) === JSON.stringify(record.doc)) return;
        setContent(record.doc);
        // Propagate to a controlled parent so its state matches the restored
        // draft (otherwise a later save could persist the pre-restore value).
        propsRef.current.onChange?.(record.doc, handle);
        propsRef.current.onLocalRestore?.({ updatedAt: record.updatedAt, rev: record.rev });
      };
      const discard = () => persistence.clearLocal();

      const onLocalDraft = propsRef.current.onLocalDraft;
      if (onLocalDraft) {
        // Defer the decision to the host (e.g. ask the user) instead of
        // overwriting the on-screen content automatically.
        onLocalDraft(
          { doc: record.doc, updatedAt: record.updatedAt, rev: record.rev },
          { restore: applyRestore, discard },
        );
      } else {
        applyRestore();
      }
    })();

    return () => {
      cancelled = true;
      monitor?.stop();
      engine?.cancel();
      void persistence.destroy();
      persistenceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.documentId, ready, props.sync?.remote]);

  // ---- Controlled value sync (F-10.20) ----
  useEffect(() => {
    const view = viewRef.current;
    if (!view || props.value == null) return;
    // While the user is typing, the editor's own state is authoritative: an
    // incoming `value` is almost always the echo of the change we just emitted
    // through `onChange`. Reconciling it here would (a) cost two full-document
    // serializations per keystroke and (b) risk reverting in-flight edits. Defer
    // until the editor is not focused, when an external value change is real.
    if (view.hasFocus()) return;
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

  // ---- Click-anywhere: the whole editing surface is active (place the caret) ----
  // The editable element only covers its own content; clicks on the page chrome
  // around it (margins/padding, or empty space the content doesn't reach) would
  // otherwise do nothing. Map such clicks to the nearest document position so the
  // user can start typing anywhere within the surface. Clicks on the editable
  // content itself are left to ProseMirror's native handling.
  const handleSurfaceMouseDown = useCallback((e: React.MouseEvent) => {
    const view = viewRef.current;
    if (!view || !view.editable) return;
    if (view.dom.contains(e.target as Node)) return;
    e.preventDefault();
    const size = view.state.doc.content.size;
    // Map the click to the nearest document position; fall back to the document
    // end when coordinate mapping is unavailable (no layout) so the caret is
    // always placed and the user can start typing.
    let pos = size;
    try {
      const found = view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (found) pos = Math.max(0, Math.min(found.pos, size));
    } catch {
      /* no layout — use the document end */
    }
    try {
      const selection = Selection.near(view.state.doc.resolve(pos), -1);
      view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
    } catch {
      /* never let a stray click throw */
    }
    view.focus();
  }, []);

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
      importDocx: importDocxIntoEditor,
      exportAs,
    }),
    [editorState, engine, config, runCommand, importDocxIntoEditor, exportAs],
  );

  // ---- Layout / page surface ----
  const { width } = resolvePageDimensions(config.page);
  const showChrome = config.page.showPageChrome;
  const paginated = config.page.pagination === 'visual';

  // Stable signature of the page geometry; force a re-measure when it changes.
  const pageGeometryKey = useMemo(
    () =>
      JSON.stringify({
        p: config.page.pagination,
        s: config.page.size,
        o: config.page.orientation,
        w: config.page.widthMm,
        h: config.page.heightMm,
        m: config.page.margins,
        hdr: config.page.header,
        ftr: config.page.footer,
      }),
    [config.page],
  );
  useEffect(() => {
    if (paginated) remeasureRef.current?.();
  }, [pageGeometryKey, paginated]);

  const geometry = useMemo(
    () => computePaginationGeometry(config.page),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageGeometryKey],
  );

  const rootStyle = useMemo(() => {
    const base: Record<string, string> = {
      ...themeToCssVars(props.theme),
      '--rne-page-width': `${width}mm`,
      '--rne-page-padding': `${config.page.margins.top}mm ${config.page.margins.right}mm ${config.page.margins.bottom}mm ${config.page.margins.left}mm`,
    };
    if (geometry) {
      base['--rne-page-w'] = `${geometry.pageWidthPx}px`;
      base['--rne-page-h'] = `${geometry.pageHeightPx}px`;
      base['--rne-content-w'] = `${geometry.contentWidthPx}px`;
      base['--rne-mt'] = `${geometry.marginTopPx}px`;
      base['--rne-ml'] = `${geometry.marginLeftPx}px`;
    }
    return { ...base, ...(props.style as Record<string, string> | undefined) };
  }, [props.theme, props.style, width, config.page.margins, geometry]);

  const toolbarEnabled = props.toolbar !== false && (props.toolbar?.enabled ?? true) && config.editable;
  const statusBarEnabled = props.statusBar ?? true;

  return (
    <EditorContext.Provider value={contextValue}>
      <div
        className={`rne-root${props.className ? ` ${props.className}` : ''}`}
        style={rootStyle as React.CSSProperties}
        data-ready={ready}
        dir={props.dir ?? 'ltr'}
      >
        {toolbarEnabled && <Toolbar config={props.toolbar || undefined} />}
        {props.children}
        <div
          className={`rne-canvas${showChrome ? '' : ' rne-canvas--plain'}${paginated ? ' rne-canvas--paged' : ''}`}
          onMouseDown={handleSurfaceMouseDown}
        >
          {paginated ? (
            <div className="rne-paged">
              <div ref={pageBgRef} className="rne-page-bg" aria-hidden="true" />
              <div ref={mountRef} className="rne-mount rne-mount--paged" />
            </div>
          ) : (
            <div className="rne-page">
              <div ref={mountRef} className="rne-mount" />
            </div>
          )}
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
