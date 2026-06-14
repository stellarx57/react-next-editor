# react-next-editor

A comprehensive, performant, secure, configurable, customizable, reusable and
pluggable **Word-style rich document editor** for React / Next.js, built directly
on [ProseMirror](https://prosemirror.net). It edits structured documents,
persists locally for offline-first use, synchronizes to your REST API, and
exports to **DOCX, PDF and plain text** — with no external document-rendering
server.

Built entirely in TypeScript. Ships ESM + CJS + types. React is a peer
dependency.

---

## Features

- **Rich editing** — bold/italic/underline/strike, super/subscript, inline code,
  font family/size, text & highlight colors, clear formatting.
- **Structure** — H1–H6, alignment, indentation, line spacing, bullet/numbered/
  task lists, blockquotes, horizontal rules, tables (insert/merge/split, cell
  styling), images, links, manual page breaks.
- **Word-like page surface** — A4/Letter/Legal/A5/custom, configurable margins,
  single-flow page model (print/PDF paginate naturally).
- **Offline-first** — durable IndexedDB persistence, debounced autosave,
  crash/reload recovery, a durable outbox, connectivity detection and a sync
  engine with exponential backoff and a version-guard conflict path.
- **Export** — isomorphic converters (browser **and** Node) to DOCX (`docx`),
  PDF (print stylesheet / headless browser) and plain text, so client and server
  output match.
- **Configurable & extensible** — one props object, per-feature toggles,
  data-driven customizable toolbar, CSS-variable theming, injectable strings,
  custom plugins and custom DOCX node mappings, injectable persistence/sync/asset
  adapters.
- **Robust & secure** — schema-enforced validity, sanitized paste/URL/image
  ingress (no active content), an error boundary that contains failures, and a
  release dependency tree with no known vulnerabilities.
- **Accessible & responsive** — keyboard-navigable, ARIA-labeled toolbar; fully
  responsive from mobile to desktop.

## Installation

```bash
npm install react-next-editor
```

`react` and `react-dom` (18.2+ or 19) are peer dependencies. `docx` is an
optional dependency, lazily imported only when you export to DOCX.

## Quick start (Next.js App Router)

The editor is **client-only** (it needs the DOM). Load it with `next/dynamic`
and `{ ssr: false }`, and import the stylesheet once.

```tsx
'use client';

import dynamic from 'next/dynamic';
import 'react-next-editor/styles.css';

const Editor = dynamic(
  () => import('react-next-editor').then((m) => m.Editor),
  { ssr: false },
);

export default function MyEditor() {
  return (
    <div style={{ height: 600 }}>
      <Editor
        documentId="judgement-123"
        placeholder="Start typing…"
        onChange={(json) => console.log(json)}
      />
    </div>
  );
}
```

## Configuration (selected props)

| Prop | Type | Description |
|------|------|-------------|
| `documentId` | `string` | Stable id for local persistence/sync. |
| `initialContent` | `DocumentJSON \| string \| null` | Uncontrolled initial content. |
| `value` / `onChange` | controlled | Controlled usage (ProseMirror JSON). |
| `mode` / `readOnly` | `'edit' \| 'readonly'` / `boolean` | Editing mode. |
| `features` | `Partial<FeatureFlags>` | Per-feature toggles. |
| `page` | `Partial<PageConfig>` | Size, orientation, margins, page chrome. |
| `toolbar` | `ToolbarConfig \| false` | Reorder/add/remove items, or hide. |
| `theme` | `ThemeTokens` | CSS-variable design tokens. |
| `strings` | `Partial<EditorStrings>` | Localized UI strings. |
| `persistence` | `PersistenceConfig` | Local store, autosave, adapter. |
| `sync` | `SyncConfig` | REST adapter; offline edits auto-upload on reconnect. |
| `dir` | `'ltr' \| 'rtl' \| 'auto'` | Text direction (RTL aware). |
| `extensions` | `EditorExtensions` | Custom PM plugins, custom DOCX mappings. |
| `onReady` / `onSelectionChange` / `onSaveStatusChange` / `onError` | events | Lifecycle hooks. |

A `ref` exposes an imperative handle: `getJSON()`, `getText()`, `getHTML()`,
`setContent()`, `focus()`, `isDirty()`, `save()`, `clearLocalData()`,
`exportAs()`, and escape hatches `getView()` / `getState()` / `getSchema()`.

## Theming

Every visual aspect is a CSS variable under `.rne-root`; override any `--rne-*`
token (or pass `theme`) — no forking required.

```css
.rne-root { --rne-accent: #df4a36; --rne-page-background: #fff; }
```

## Export

```ts
import {
  documentToText,
  documentToDocxBlob,
  documentToDocxBuffer, // Node
  printDocumentToPdf,   // client print-to-PDF
  buildPrintDocument,   // shared HTML for server PDF
  exportDocument,       // high-level: download / print
} from 'react-next-editor/export';
```

The same converters run in the browser and in Node, so an optional server export
API produces output consistent with the client.

### Programmatic export service (server, optional)

`react-next-editor/server` is a Node-only, additive export service. It reads
stored or inline document JSON, renders DOCX/PDF/text/HTML with the **same**
converters, optionally writes the result to storage, and is authenticated via an
injected hook. It does not change the offline/client guarantees — editing works
with it absent.

```ts
import {
  createExportService,
  createExportHandler,
  FilesystemStorage,
  createPlaywrightPdfRenderer, // optional; requires `playwright`
} from 'react-next-editor/server';

const service = createExportService({
  store: { loadDocument: (id) => db.loadDocJson(id) }, // F-6.9
  storage: new FilesystemStorage({ baseDir: '/var/exports', baseUrl: '/exports' }), // F-6.10
  pdfRenderer: createPlaywrightPdfRenderer(), // F-6.14 (server PDF)
  authorize: (req, ctx) => canAccess(ctx.token, req.documentId), // F-6.15
});

// Single, batch, or async job:
const result = await service.export({ documentId: 'doc-1', format: 'docx', store: true });
const results = await service.exportBatch([...]);            // F-6.12, per-doc status
const { jobId } = service.enqueue([...]);                    // F-6.13 async
```

Use it directly as a **Next.js App Router** route handler:

```ts
// app/api/export/route.ts
import { createExportService, createExportHandler } from 'react-next-editor/server';
export const runtime = 'nodejs';
const handle = createExportHandler(createExportService(/* …adapters… */));
export const POST = handle;
```

## Subpath entry points (tree-shaking)

- `react-next-editor` — React component + everything (default).
- `react-next-editor/core` — framework-agnostic schema/commands/plugins/state.
- `react-next-editor/export` — isomorphic DOCX/PDF/text converters.
- `react-next-editor/persistence` — adapters, IndexedDB store, sync engine.
- `react-next-editor/styles.css` — the stylesheet.

## Extensibility

Register custom ProseMirror plugins and a matching DOCX mapping without forking:

```tsx
<Editor
  extensions={{
    plugins: [myPlugin],
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

## Adapters (persistence / sync / assets)

The editor core depends only on interfaces; inject your own implementations.

```ts
import { IndexedDBStore, SyncEngine, ConnectivityMonitor } from 'react-next-editor/persistence';
```

`LocalStoreAdapter`, `RemoteSyncAdapter` and `AssetUploadAdapter` let the same
editor work against any backend/storage. The remote adapter uses your app's auth
(tokens are never embedded in the editor) and must use HTTPS.

## Security

All pasted/loaded content is sanitized; URLs and image sources are validated;
SVG/`data:` script vectors and active content are rejected; inline `style`
values from document JSON are re-validated at render time so a crafted attribute
(e.g. `align: "left;background:url(...)"`) cannot inject CSS; oversized data URIs
are rejected; and the editor never executes embedded scripts. Integrators remain
responsible for backend auth, transport (HTTPS), and storage policy. See
`sanitizeUrl`, `sanitizeImageSrc`, `sanitizeHtml`.

**Content Security Policy.** The editor applies formatting (alignment, color,
font, highlight) via inline `style` *attributes*, so it requires
`style-src 'unsafe-inline'` (or `style-src-attr 'unsafe-inline'`). It does not
use inline `<script>` or `eval`, so `script-src` can be strict (nonce/hash
based). At-rest encryption of the local IndexedDB store is not built in; for
sensitive deployments, wrap the injected `LocalStoreAdapter` to encrypt values.

## Scripts

```bash
npm run build        # bundle (tsup): ESM + CJS + d.ts + styles.css
npm run type-check   # tsc --noEmit
npm run lint         # eslint
npm test             # vitest
npm run verify       # type-check + lint + test
```

## License

MIT.
