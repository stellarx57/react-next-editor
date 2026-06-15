# react-next-editor

A comprehensive, performant, secure, configurable, customizable, reusable, and
pluggable **Word-style rich document editor** for React and Next.js, built
directly on [ProseMirror](https://prosemirror.net).

It provides a familiar word-processor authoring experience, works fully offline,
synchronizes to your own REST API, and produces shareable **DOCX, PDF, and plain
text** — all without any external document-rendering server. It is written
entirely in TypeScript and ships ESM + CJS builds with complete type
definitions.

```tsx
import dynamic from 'next/dynamic';
import 'react-next-editor/styles.css';

const Editor = dynamic(() => import('react-next-editor').then((m) => m.Editor), {
  ssr: false,
});

<Editor documentId="doc-2024-08" placeholder="Start typing…" />;
```

---

## Table of contents

- [Highlights](#highlights)
- [Design principles](#design-principles)
- [Installation](#installation)
- [Quick start (Next.js App Router)](#quick-start-nextjs-app-router)
- [Usage patterns](#usage-patterns)
- [Configuration](#configuration)
  - [Props reference](#props-reference)
  - [Feature flags](#feature-flags)
  - [Page configuration](#page-configuration)
  - [Toolbar](#toolbar)
  - [Theming](#theming)
  - [Localization](#localization)
- [Imperative API (ref)](#imperative-api-ref)
- [Events](#events)
- [Custom toolbars & panels](#custom-toolbars--panels)
- [Visual pagination](#visual-pagination)
- [DOCX import](#docx-import)
- [Export](#export)
  - [Client-side export](#client-side-export)
  - [Programmatic export service (server)](#programmatic-export-service-server)
- [Offline-first persistence & sync](#offline-first-persistence--sync)
- [Extensibility](#extensibility)
- [Security](#security)
- [Accessibility & internationalization](#accessibility--internationalization)
- [Subpath entry points](#subpath-entry-points)
- [SSR & browser support](#ssr--browser-support)
- [TypeScript](#typescript)
- [Architecture](#architecture)
- [Limitations & non-goals](#limitations--non-goals)
- [Development](#development)
- [License](#license)

---

## Highlights

- **Rich text** — bold, italic, underline, strikethrough, superscript,
  subscript, inline code, font family, font size, text color, highlight, and
  clear-formatting.
- **Block & structural** — headings (H1–H6), text alignment, indentation, line
  spacing, bulleted / numbered / **task** lists, blockquotes, horizontal rules,
  **tables** (insert, add/remove rows & columns, merge/split cells, cell
  background & alignment, column resizing), images (URL / paste / data-URI,
  resize), hyperlinks, and manual page breaks.
- **Word-like page surface** — A4 / Letter / Legal / A5 / custom sizes,
  configurable margins and orientation. Document-styled single flow by default,
  or **true visual pagination** with discrete on-screen page sheets, repeating
  headers/footers, and live page numbers.
- **Offline-first** — durable IndexedDB persistence, debounced autosave,
  crash/reload recovery, a durable outbox, connectivity detection (real
  reachability, not just `navigator.onLine`), and a sync engine with exponential
  backoff and a version-guard conflict path. Offline edits upload automatically
  on reconnect.
- **Export** — isomorphic converters that run **identically in the browser and
  Node**: DOCX (via `docx`), PDF (browser print or a headless-browser renderer),
  plain text, and HTML. An optional server export service renders stored JSON to
  files and writes them to storage.
- **Import** — best-effort `.docx` import (via `mammoth`), sanitized and parsed
  into the schema.
- **Configurable & extensible** — a single documented props object, per-feature
  toggles, a data-driven customizable toolbar, CSS-variable theming, injectable
  localized strings, custom ProseMirror plugins, custom DOCX node mappings, and
  injectable persistence / sync / asset adapters.
- **Robust & secure** — schema-enforced document validity, sanitized
  paste/URL/image ingress with no active content, render-time CSS sanitization,
  a React error boundary that contains failures, and a release dependency tree
  with no known vulnerabilities.
- **Accessible & responsive** — keyboard-navigable, ARIA-labeled toolbar with
  arrow-key navigation; RTL aware; fully responsive from mobile to desktop.

## Design principles

- **ProseMirror owns the DOM.** The React layer mounts and disposes the
  `EditorView` but never re-renders the editing surface, which avoids the most
  common class of integration bugs.
- **Core vs. adapters.** The editing core is backend-agnostic. Persistence,
  sync, and asset upload are injected as adapter interfaces, so the same editor
  works against any backend.
- **Offline-first.** The local store is the source of truth during editing; the
  network is best-effort and never in the critical path.
- **One schema, shared serializers.** The document schema underpins the editor,
  persistence, and every exporter, so on-screen, downloaded, and API-rendered
  output stay consistent.

## Installation

```bash
npm install react-next-editor
```

`react` and `react-dom` (`^18.2` or `^19`) are **peer dependencies**.

Two optional dependencies are lazily imported only when their feature is used —
install them where you need them:

```bash
npm install docx       # DOCX export (client + server)
npm install mammoth    # DOCX import
# Server PDF rendering (optional): one of
npm install playwright # or: npm install puppeteer
```

Import the stylesheet once in your app:

```ts
import 'react-next-editor/styles.css';
```

## Quick start (Next.js App Router)

The editor is **client-only** — it requires the DOM and must not be
server-rendered. Load it with `next/dynamic` and `{ ssr: false }`.

```tsx
'use client';

import dynamic from 'next/dynamic';
import { useRef } from 'react';
import type { EditorRef, DocumentJSON } from 'react-next-editor';
import 'react-next-editor/styles.css';

const Editor = dynamic(() => import('react-next-editor').then((m) => m.Editor), {
  ssr: false,
});

export default function MyEditor() {
  const ref = useRef<EditorRef>(null);

  return (
    <div style={{ height: '80vh' }}>
      <Editor
        ref={ref}
        documentId="doc-2024-08"
        placeholder="Start typing…"
        onChange={(json: DocumentJSON) => {
          /* persist / lift state */
        }}
      />
    </div>
  );
}
```

Give the editor a sized container (e.g. a fixed height or a flex parent): it
fills its parent and scrolls its own canvas.

## Usage patterns

**Uncontrolled (recommended).** Provide `initialContent`; read changes via
`onChange` or the `ref`.

```tsx
<Editor initialContent={docJson} onChange={(json) => save(json)} />
```

**Controlled.** Provide `value` (ProseMirror JSON) together with `onChange`. The
editor reconciles external value changes without disturbing the cursor when the
content is unchanged.

```tsx
<Editor value={value} onChange={(json) => setValue(json)} />
```

**Read-only / view mode.**

```tsx
<Editor initialContent={docJson} readOnly /> // or mode="readonly"
```

**Plain-text or empty start.** `initialContent` also accepts a plain string
(split into paragraphs) or `null` (empty document).

### Saving to your backend

`onChange` fires on every keystroke, so debounce writes to your API. For
full offline-first behaviour (queue offline, upload on reconnect) prefer the
[`sync` adapter](#offline-first-persistence--sync) instead of saving manually.

```tsx
import { useMemo, useRef } from 'react';
import type { DocumentJSON } from 'react-next-editor';

function useDebouncedSave(documentId: string, wait = 800) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  return useMemo(
    () => (json: DocumentJSON) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void fetch(`/api/documents/${documentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc: json }),
        });
      }, wait);
    },
    [documentId, wait],
  );
}

function MyEditor({ id }: { id: string }) {
  const save = useDebouncedSave(id);
  return <Editor documentId={id} onChange={(json) => save(json)} />;
}
```

## Configuration

Everything is driven by a single props object. Every field is optional; sensible
defaults apply.

### Props reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `documentId` | `string` | — | Stable id used for local persistence and sync. |
| `initialContent` | `DocumentJSON \| string \| null` | empty | Initial content for uncontrolled usage. |
| `value` | `DocumentJSON \| null` | — | Controlled value (use with `onChange`). |
| `mode` | `'edit' \| 'readonly'` | `'edit'` | Editing mode. |
| `readOnly` | `boolean` | `false` | Convenience alias for read-only. |
| `placeholder` | `string` | — | Placeholder for an empty document. |
| `features` | `Partial<FeatureFlags>` | all on | Per-feature toggles. |
| `page` | `Partial<PageConfig>` | A4 | Size, orientation, margins, chrome, pagination, header/footer. |
| `toolbar` | `ToolbarConfig \| false` | default | Toolbar layout, or `false` to hide. |
| `statusBar` | `boolean` | `true` | Show the word/character + sync status bar. |
| `theme` | `ThemeTokens` | — | Design tokens (CSS variables). |
| `strings` | `Partial<EditorStrings>` | English | Localized UI strings. |
| `fontFamilies` | `string[]` | built-in | Font picker options. |
| `fontSizes` | `number[]` (pt) | built-in | Size picker options. |
| `colorPalette` | `string[]` | built-in | Color/highlight palette. |
| `extensions` | `EditorExtensions` | — | Custom plugins and custom DOCX mappings. |
| `persistence` | `PersistenceConfig` | auto | Local store, autosave, store adapter. |
| `sync` | `SyncConfig` | — | REST adapter; auto-upload on reconnect. |
| `metadata` | `Record<string, unknown>` | — | Per-document metadata stored alongside content. |
| `dir` | `'ltr' \| 'rtl' \| 'auto'` | `'ltr'` | Text direction (RTL aware). |
| `ariaLabel` | `string` | `'Document editor'` | Accessible label for the editing region. |
| `className` | `string` | — | Class added to the root element. |
| `style` | `React.CSSProperties` | — | Inline style on the root element. |
| `children` | `React.ReactNode` | — | Custom UI rendered inside the editor context (see [Custom toolbars & panels](#custom-toolbars--panels)). |
| `onReady` | `(ref: EditorRef) => void` | — | Fired once the editor is mounted. |
| `onChange` | `(json: DocumentJSON, ref: EditorRef) => void` | — | Fired on every document change. |
| `onSelectionChange` | `(state: EditorState) => void` | — | Fired on selection change. |
| `onSaveStatusChange` | `(status: SaveStatus, detail?) => void` | — | Fired on save/sync transitions. |
| `onError` | `(error: Error) => void` | — | Fired when the error boundary contains a failure. |

### Feature flags

Every feature can be toggled. Disabling one removes its schema node/mark,
commands, input rules, and toolbar item together.

```tsx
<Editor features={{ table: false, image: false, taskList: false }} />
```

Available flags: `bold`, `italic`, `underline`, `strikethrough`, `superscript`,
`subscript`, `code`, `fontFamily`, `fontSize`, `textColor`, `highlight`,
`clearFormatting`, `headings`, `alignment`, `lineSpacing`, `indentation`,
`bulletList`, `orderedList`, `taskList`, `blockquote`, `horizontalRule`,
`table`, `image`, `link`, `pageBreak`, `history`, `wordCount`, `docxImport`.

### Page configuration

```ts
interface PageConfig {
  size: 'A4' | 'Letter' | 'Legal' | 'A5' | 'custom';
  widthMm?: number;       // when size === 'custom'
  heightMm?: number;      // when size === 'custom'
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number }; // mm
  showPageChrome: boolean;          // white sheet on a canvas (single-flow)
  pagination?: 'none' | 'visual';   // see "Visual pagination"
  header?: PageRunningElement;       // visual pagination only
  footer?: PageFooterElement;        // visual pagination only
}
```

```tsx
<Editor page={{ size: 'Letter', orientation: 'portrait', margins: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 } }} />
```

### Toolbar

The built-in toolbar is data-driven: define ordered **groups** of item ids to
reorder or remove controls, toggle `sticky`, or hide it with `toolbar={false}`.

```tsx
<Editor
  toolbar={{
    sticky: true,
    groups: [
      ['undo', 'redo'],
      ['paragraphStyle', 'fontFamily', 'fontSize'],
      ['bold', 'italic', 'underline', 'textColor', 'highlight'],
      ['bulletList', 'orderedList', 'link', 'image', 'table'],
    ],
  }}
/>
```

The available item ids are exported as the `ToolbarItemId` union, and the default
layout is `DEFAULT_TOOLBAR_GROUPS`. Items whose feature is disabled are filtered
out automatically.

To go beyond reordering — adding your own buttons, dropdowns, or panels — hide
the built-in toolbar and render your own controls as `children`, reading live
editor state through `useEditorContext()`. See
[Custom toolbars & panels](#custom-toolbars--panels).

### Theming

Every visual aspect is a CSS custom property scoped under `.rne-root`. Override
any `--rne-*` token in your stylesheet, or pass the `theme` prop — no forking.

```css
.rne-root {
  --rne-accent: #2563eb;
  --rne-page-background: #ffffff;
  --rne-canvas-background: #f3f4f6;
  --rne-toolbar-background: #ffffff;
  --rne-border-radius: 6px;
}
```

```tsx
<Editor theme={{ accent: '#0b5cad', pageBackground: '#fff' }} />
```

Common tokens: `fontFamily`, `fontSize`, `textColor`, `background`,
`canvasBackground`, `pageBackground`, `accent`, `toolbarBackground`,
`toolbarColor`, `toolbarActiveBackground`, `borderColor`, `borderRadius`,
`selectionColor`.

### Localization

All UI strings are externalized and overridable (`EditorStrings`). The default
set is English.

```tsx
<Editor strings={{ bold: 'Gras', italic: 'Italique', link: 'Lien' }} />
```

## Imperative API (ref)

A `ref` of type `EditorRef` exposes an imperative handle.

| Method | Returns | Description |
|--------|---------|-------------|
| `getJSON()` | `DocumentJSON` | Current document as ProseMirror JSON. |
| `getText(options?)` | `string` | Document as plain text. |
| `getHTML()` | `string` | Document as an HTML fragment. |
| `setContent(content)` | `void` | Replace content (`DocumentJSON \| string \| null`). |
| `importDocx(file)` | `Promise<{ warnings }>` | Import a `.docx`, replacing content (undoable). |
| `focus()` | `void` | Focus the editing surface. |
| `isDirty()` | `boolean` | Whether there are unsynced local changes. |
| `save()` | `Promise<void>` | Force an immediate local save. |
| `clearLocalData()` | `Promise<void>` | Purge this document's local data. |
| `exportAs(format, filename?)` | `Promise<void>` | Download/print (`'docx' \| 'pdf' \| 'txt' \| 'html'`). |
| `getView()` | `EditorView \| null` | Escape hatch: the ProseMirror view. |
| `getState()` | `EditorState \| null` | Escape hatch: the editor state. |
| `getSchema()` | `Schema \| null` | The active schema. |

```tsx
const ref = useRef<EditorRef>(null);
// …
await ref.current?.exportAs('docx', 'doc-2024-08');
const text = ref.current?.getText();
```

## Events

```tsx
<Editor
  onReady={(ref) => console.log('ready')}
  onChange={(json, ref) => persist(json)}
  onSelectionChange={(state) => updateInspector(state)}
  onSaveStatusChange={(status, detail) => setBadge(status)} // 'savingLocal' | 'savedLocal' | 'syncing' | 'synced' | 'syncFailed' | 'offline' | 'idle'
  onError={(error) => report(error)}
/>
```

## Custom toolbars & panels

Render your own UI as `children` of `<Editor>`; those components run inside the
editor's context and can call `useEditorContext()` to read live state and
dispatch commands. This is the way to build a fully custom toolbar, a slash menu,
a word-count badge, or an inspector panel.

`useEditorContext()` returns:

| Field | Description |
|-------|-------------|
| `state` | The current `EditorState` (re-renders on every change). |
| `view` | The live `EditorView` (or `null` before mount). |
| `schema` | The active schema. |
| `commands` | The command set: `registry` (toolbar commands), `marks`, `blocks`, `links`, `insert`. |
| `run(command)` | Dispatch a ProseMirror command against the view and refocus. |
| `importDocx(file)` | Import a `.docx`, replacing content. |
| `editable` | Whether the editor is currently editable. |
| `strings`, `features`, `fontFamilies`, `fontSizes`, `colorPalette` | Resolved config. |

A custom bold button that reflects active state:

```tsx
'use client';
import { useEditorContext } from 'react-next-editor';

function BoldButton() {
  const { commands, run, state } = useEditorContext();
  const active = state ? commands.registry.bold.isActive?.(state) : false;
  const enabled = state ? commands.registry.bold.isEnabled?.(state) ?? true : false;
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={!enabled}
      onMouseDown={(e) => e.preventDefault()} // keep selection
      onClick={() => run(commands.registry.bold.run)}
      style={{ fontWeight: active ? 700 : 400 }}
    >
      B
    </button>
  );
}
```

Compose it into a custom toolbar and hide the built-in one with `toolbar={false}`:

```tsx
import { useEditorContext } from 'react-next-editor';

function MyToolbar() {
  const { commands, run } = useEditorContext();
  return (
    <div className="my-toolbar">
      <BoldButton />
      <button onMouseDown={(e) => e.preventDefault()} onClick={() => run(commands.blocks.setHeading(1))}>
        H1
      </button>
      <button onMouseDown={(e) => e.preventDefault()} onClick={() => run(commands.insert.table(3, 3, true))}>
        Table
      </button>
      <button onClick={() => run(commands.links.setLink({ href: 'https://example.com' }))}>
        Link
      </button>
    </div>
  );
}

<Editor initialContent={docJson} toolbar={false}>
  <MyToolbar />
</Editor>;
```

Command groups available on `commands`:

- `registry[id]` — every built-in toolbar command (`bold`, `italic`, `alignLeft`,
  `bulletList`, `addRowAfter`, …) as `{ run, isActive?, isEnabled? }`.
- `marks` — parametric mark commands: `setFontFamily(name)`, `setFontSize(pt)`,
  `setTextColor(hex)`, `setHighlight(hex)`, and `getActive*` readers.
- `blocks` — `setParagraph()`, `setHeading(level)`, `setAlign(a)`, `setLineHeight(n)`.
- `links` — `setLink({ href })`, `removeLink`, `getActiveLink(state)`.
- `insert` — `image({ src, alt })`, `table(rows, cols, withHeaderRow)`.

> `useEditorContext()` must be called from a component rendered as a child of
> `<Editor>`. Outside that subtree it throws.

## Visual pagination

By default the editor renders a single document-styled flow (cheap and robust;
print and PDF paginate naturally). Opt into **true visual pagination** to split
content across discrete on-screen page sheets with repeating headers/footers and
live page numbers:

```tsx
<Editor
  page={{
    size: 'A4',
    pagination: 'visual',
    header: { show: true, text: 'Confidential', align: 'left' },
    footer: { pageNumbers: true }, // "Page X of Y"
    // or a custom footer: footer: { show: true, text: '{page} / {pages}', align: 'center' }
  }}
/>
```

`{page}` and `{pages}` in header/footer text are replaced with the live page
number and total. Pagination is **purely visual**: it measures block heights and
inserts spacer decorations plus a page-sheet background layer — it **never
mutates the document**, so content integrity is guaranteed even if measurement is
imperfect. It re-measures on edits, resize, and image load.

> Breaks occur at block boundaries; a single block taller than a page overflows
> rather than being split (there is no line-level layout engine). Set
> `pagination` at mount time.

## DOCX import

Best-effort import of external `.docx` files (`mammoth` converts to HTML, which
is sanitized and parsed into the schema). Available as a toolbar button (enabled
by the `docxImport` feature) and imperatively:

```tsx
const input = e.target as HTMLInputElement;
const file = input.files?.[0];
if (file) {
  const { warnings } = await ref.current!.importDocx(file); // File | ArrayBuffer | Uint8Array
}
```

Supported structures (headings, lists, tables, bold/italic/underline, links,
images) map across; unsupported Word constructs degrade gracefully. Requires the
optional `mammoth` dependency. The lower-level converter is also available:

```ts
import { importDocx } from 'react-next-editor/import';
const { doc, warnings, html } = await importDocx(arrayBuffer, schema);
```

## Export

All converters are isomorphic and share one implementation, so browser download,
client print, and server rendering produce consistent output.

### Client-side export

```ts
import {
  exportDocument,       // high-level: download (docx/txt/html) or print (pdf)
  documentToText,       // DocumentJSON -> string
  documentToHtml,       // DocumentJSON -> HTML fragment
  documentToDocxBlob,   // DocumentJSON -> Blob (browser)
  printDocumentToPdf,   // open the print dialog with a print stylesheet
  buildPrintDocument,   // standalone print HTML (shared with the server PDF path)
  downloadBlob, downloadText,
} from 'react-next-editor/export';

await exportDocument(doc, 'docx', { filename: 'report', page });
await printDocumentToPdf(doc, { page, title: 'Report' });
const txt = documentToText(doc, { includeLinkUrls: true });
```

The simplest path is `ref.current.exportAs('docx' | 'pdf' | 'txt' | 'html')`.

### Programmatic export service (server)

`react-next-editor/server` is an **optional, Node-only** service that converts
stored or inline document JSON to DOCX/PDF/text/HTML using the same converters,
optionally writes results to storage, and enforces access control via an injected
hook. The editor's offline/client export does not depend on it.

```ts
import {
  createExportService,
  createExportHandler,
  FilesystemStorage,
  createPlaywrightPdfRenderer, // optional; requires `playwright` (or use createPuppeteerPdfRenderer)
} from 'react-next-editor/server';

const service = createExportService({
  store: { loadDocument: (id) => db.loadDocJson(id) }, // read stored JSON by id
  storage: new FilesystemStorage({ baseDir: '/var/exports', baseUrl: '/exports' }),
  pdfRenderer: createPlaywrightPdfRenderer(), // server PDF
  authorize: (req, ctx) => canAccess(ctx.token, req.documentId),
  nodeConverters: { /* custom node -> DOCX mappings, matching the client */ },
});

const single = await service.export({ documentId: 'doc-1', format: 'docx', store: true });
const batch  = await service.exportBatch([{ documentId: 'a', format: 'pdf' }, /* … */]);
const { jobId } = service.enqueue([/* … */]); // async; poll service.getJob(jobId)
```

Use it directly as a Next.js App Router route handler (it is a standard
`(Request) => Promise<Response>`):

```ts
// app/api/export/route.ts
import { createExportService, createExportHandler } from 'react-next-editor/server';

export const runtime = 'nodejs'; // DOCX/PDF need Node
const handle = createExportHandler(createExportService(/* …adapters… */));
export const POST = handle;
```

Errors are reported as `status: 'error'` per document — the service never emits a
malformed file silently. Storage and PDF rendering are pluggable
(`StorageAdapter`, `PdfRenderer`); a `MemoryStorage` is provided for tests.

## Offline-first persistence & sync

When given a `documentId`, the editor autosaves to a durable local store
(IndexedDB by default), recovers the latest state after a crash/reload, and — if
a `sync.remote` adapter is provided — uploads queued changes automatically when
connectivity returns.

```tsx
import { ConflictError } from 'react-next-editor';
import type { RemoteSyncAdapter } from 'react-next-editor';

const remote: RemoteSyncAdapter = {
  async save(record, signal) {
    const res = await fetch(`/api/docs/${record.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc: record.doc, baseVersion: record.baseVersion }),
      signal,
    });
    if (res.status === 409) throw new ConflictError('stale', await res.json());
    return { version: (await res.json()).version };
  },
  ping: async () => (await fetch('/api/health')).ok,
};

<Editor
  documentId="doc-2024-08"
  persistence={{ enabled: true }}          // IndexedDB autosave (default when documentId is set)
  sync={{ remote, onConflict: (local, remote) => promptUser(local, remote) }}
/>;
```

How it works:

- **Local persistence** (`PersistenceConfig`) — debounced autosave of
  `doc.toJSON()` to a `LocalStoreAdapter`; the default is `IndexedDBStore` (with
  an in-memory fallback). Configure `store`, `debounceMs`, `requestPersistent`.
- **Outbox** — every local save is recorded in a durable outbox that survives
  reloads and restarts.
- **Connectivity** (`ConnectivityMonitor`) — listens to `online`/`offline` and,
  when a `ping` is provided, confirms real API reachability rather than trusting
  `navigator.onLine`.
- **Sync engine** (`SyncEngine`) — on reconnect and after each local save, flushes
  the outbox with idempotent uploads and exponential backoff. On a version
  conflict (throw `ConflictError`), the document is parked and `onConflict` fires;
  edits are never silently lost.

Adapters are injectable, so the same editor works against any backend. Provide a
custom local store via `persistence.store` and a remote via `sync.remote`:

```tsx
import { IndexedDBStore } from 'react-next-editor/persistence';
import type { LocalStoreAdapter, StoredDocument } from 'react-next-editor';

// Example: wrap the built-in store to encrypt documents at rest.
class EncryptedStore implements LocalStoreAdapter {
  constructor(private readonly inner = new IndexedDBStore()) {}
  async putDocument(r: StoredDocument) {
    return this.inner.putDocument({ ...r, doc: encrypt(r.doc) as never });
  }
  async getDocument(id: string) {
    const r = await this.inner.getDocument(id);
    return r ? { ...r, doc: decrypt(r.doc) } : null;
  }
  // delegate the rest…
  listDocuments = (...a: never[]) => this.inner.listDocuments(...(a as []));
  deleteDocument = (id: string) => this.inner.deleteDocument(id);
  enqueue = this.inner.enqueue.bind(this.inner);
  dequeue = this.inner.dequeue.bind(this.inner);
  listOutbox = this.inner.listOutbox.bind(this.inner);
  clear = this.inner.clear.bind(this.inner);
}

<Editor documentId="doc-2024-08" persistence={{ store: new EncryptedStore() }} sync={{ remote }} />;
```

`LocalStoreAdapter`, `RemoteSyncAdapter`, and `AssetUploadAdapter` are exported
from `react-next-editor/persistence` (and the package root). The editor wires
`LocalStoreAdapter` (via `persistence.store`) and `RemoteSyncAdapter` (via
`sync.remote`); `AssetUploadAdapter` is provided as an interface for building your
own image/asset upload pipeline. Auth tokens are supplied through your adapter and
are never embedded in the editor; all network access must use HTTPS.

## Extensibility

Register custom ProseMirror plugins and matching DOCX mappings without forking:

```tsx
<Editor
  extensions={{
    plugins: [myPlugin], // any prosemirror-state Plugin[]
    docxNodeConverters: {
      signature: (node, ctx) => [
        new ctx.docx.Paragraph({
          children: [new ctx.docx.TextRun({ text: `Signed: ${node.attrs?.name}` })],
        }),
      ],
    },
  }}
/>
```

For deeper control, the framework-agnostic core is exported from
`react-next-editor/core` (`buildSchema`, `createCommands`, `buildPlugins`,
`createEditorState`, `countDocument`, …), and `ref.getView()` / `getState()` /
`getSchema()` provide direct access to the underlying ProseMirror objects.

## Security

The editor follows a defense-in-depth posture:

- All pasted, imported, or loaded content is sanitized; `<script>`, inline event
  handlers, and other active content are stripped.
- Link and image URLs are validated; `javascript:`/`vbscript:`/`data:text/html`
  and SVG/script data-URIs are rejected, and oversized data-URIs are capped.
- Inline `style` values from document JSON are re-validated at render time, so a
  crafted attribute (e.g. `align: "left;background:url(...)"`) cannot inject CSS.
- The schema enforces document validity, so the document cannot enter an invalid
  or unrenderable state.
- A React error boundary contains failures so a fault in the editor cannot bring
  down the host app.

Helpers `sanitizeUrl`, `sanitizeImageSrc`, and `sanitizeHtml` are exported for
reuse.

**Content Security Policy.** Formatting (alignment, color, font, highlight) uses
inline `style` *attributes*, so the editor requires `style-src 'unsafe-inline'`
(or `style-src-attr 'unsafe-inline'`). It uses no inline `<script>` or `eval`, so
`script-src` can remain strict (nonce/hash based).

**Integrator responsibilities.** Backend authentication/authorization, transport
(HTTPS), CSP, and storage policy are the host's responsibility. At-rest
encryption of the local IndexedDB store is not built in; for sensitive
deployments, wrap the injected `LocalStoreAdapter` to encrypt values, and use
`clearLocalData()` (e.g. on logout) to purge.

## Accessibility & internationalization

- Toolbar controls are keyboard-navigable with ARIA labels, active/pressed state,
  and arrow-key (Home/End/←/→) movement between buttons.
- The editing region is an ARIA `textbox`; provide an `ariaLabel`.
- Color popovers close on `Escape`; image insertion prompts for alt text.
- RTL is supported via the `dir` prop; all UI strings are externalized for
  localization.

## Subpath entry points

Import only what you need to keep bundles lean.

| Entry | Contents |
|-------|----------|
| `react-next-editor` | React component, hooks, and the full public API (default). |
| `react-next-editor/core` | Framework-agnostic schema, commands, plugins (incl. pagination), and state factory. |
| `react-next-editor/export` | Isomorphic DOCX/PDF/text/HTML converters and download helpers. |
| `react-next-editor/import` | Best-effort `.docx` importer. |
| `react-next-editor/persistence` | Adapters, IndexedDB/memory stores, autosave, connectivity, sync engine. |
| `react-next-editor/server` | Node-only programmatic export service and route handler. |
| `react-next-editor/styles.css` | The stylesheet. |

## SSR & browser support

The editor requires the DOM and must be loaded client-side only — use
`next/dynamic` with `{ ssr: false }` (or a `'use client'` boundary). The package
guards DOM access so importing it on the server does not crash, but the component
itself renders only on the client.

Supported browsers: the latest two versions of Chrome, Edge, Firefox, and Safari.

## TypeScript

The package ships complete type definitions for every public API. React is a peer
dependency and is kept external so a single React instance is used.

```ts
import type {
  EditorProps, EditorRef, DocumentJSON, FeatureFlags, PageConfig,
  ThemeTokens, ToolbarConfig, EditorStrings, SaveStatus,
  PersistenceConfig, SyncConfig, RemoteSyncAdapter, LocalStoreAdapter,
} from 'react-next-editor';
```

## Architecture

```
src/
  core/         schema (nodes/marks), commands, plugins, state, pagination
  react/        Editor component, toolbar, status bar, error boundary, context
  export/       isomorphic text / html / docx / pdf converters
  import/       best-effort docx import
  persistence/  adapter interfaces, IndexedDB + memory stores, autosave
  sync/         connectivity monitor, sync engine
  server/       programmatic export service, storage, PDF renderers, route handler
  security/     URL / image / HTML / CSS sanitization
  config/       types and defaults
  styles/       editor.css
```

The document schema is the single source of truth: nodes/marks, commands,
persistence, and every serializer derive from it.

## Limitations & non-goals

- No separate self-hosted document-rendering server (by design).
- No real-time multi-user collaboration (the architecture leaves room for it).
- DOCX import and export are best-effort, not byte-perfect round-trips of
  arbitrary externally-authored Word documents.
- Visual pagination breaks at block boundaries (no line-level splitting); a block
  taller than a page overflows in place.

## Development

```bash
npm run build        # bundle (tsup): ESM + CJS + .d.ts + styles.css
npm run type-check   # tsc --noEmit
npm run lint         # eslint
npm test             # vitest
npm run verify       # type-check + lint + test
```

## License

MIT.
