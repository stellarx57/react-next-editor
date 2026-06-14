import { buildSchema, createCommands, createDoc, buildPlugins, createEditorState, countDocument } from './chunk-NR6UA3IR.js';
export { buildPlugins, buildSchema, countDocument, createCommands, createDoc, createEditorState, defaultSchema } from './chunk-NR6UA3IR.js';
import { exportDocument } from './chunk-HRVQGBSO.js';
export { downloadBlob, downloadText, exportDocument, printDocumentToPdf } from './chunk-HRVQGBSO.js';
import { IndexedDBStore, DocumentPersistence, requestPersistentStorage } from './chunk-WSWRQZS3.js';
export { ConflictError, ConnectivityMonitor, DocumentPersistence, IndexedDBStore, MemoryStore, SyncEngine, requestPersistentStorage } from './chunk-WSWRQZS3.js';
import { documentToText } from './chunk-7ATKBEH3.js';
export { documentToDocxBlob, documentToDocxBuffer, documentToText } from './chunk-7ATKBEH3.js';
import { documentToHtml } from './chunk-PDBEZLLY.js';
export { buildPrintDocument, documentToHtml } from './chunk-PDBEZLLY.js';
import { preloadSanitizer } from './chunk-MWO7FWCI.js';
export { sanitizeHtml, sanitizeImageSrc, sanitizeUrl } from './chunk-MWO7FWCI.js';
import { resolvePageDimensions, themeToCssVars, DEFAULT_COLOR_PALETTE, DEFAULT_FONT_SIZES, DEFAULT_FONT_FAMILIES, DEFAULT_STRINGS, DEFAULT_PAGE, DEFAULT_FEATURES, DEFAULT_TOOLBAR_GROUPS } from './chunk-LBY6ULPF.js';
export { DEFAULT_COLOR_PALETTE, DEFAULT_FEATURES, DEFAULT_FONT_FAMILIES, DEFAULT_FONT_SIZES, DEFAULT_PAGE, DEFAULT_STRINGS, DEFAULT_TOOLBAR_GROUPS, PAGE_DIMENSIONS_MM, resolvePageDimensions, themeToCssVars } from './chunk-LBY6ULPF.js';
import './chunk-PZ5AY32C.js';
import { createContext, forwardRef, useRef, useMemo, useState, useCallback, useImperativeHandle, useEffect, Fragment, Component, useContext } from 'react';
import { EditorView } from 'prosemirror-view';
import { EditorState, TextSelection } from 'prosemirror-state';
import { jsx, jsxs } from 'react/jsx-runtime';

var EditorContext = createContext(null);
function useEditorContext() {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error("useEditorContext must be used within a react-next-editor <Editor>.");
  }
  return ctx;
}
var EditorErrorBoundary = class extends Component {
  constructor(props) {
    super(props);
    this.handleReset = () => {
      this.setState({ error: null });
    };
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[react-next-editor] Editor error contained by boundary:", error, info);
    this.props.onError?.(error);
  }
  render() {
    if (this.state.error) {
      return /* @__PURE__ */ jsx("div", { className: "rne-root", children: /* @__PURE__ */ jsxs("div", { className: "rne-error", role: "alert", children: [
        /* @__PURE__ */ jsx("strong", { children: this.props.fallbackMessage ?? "The editor encountered a problem." }),
        /* @__PURE__ */ jsx("p", { children: "Your latest saved content is preserved locally. You can try to recover the editor." }),
        /* @__PURE__ */ jsx("button", { type: "button", onClick: this.handleReset, children: "Reload editor" })
      ] }) });
    }
    return this.props.children;
  }
};
var PATHS = {
  undo: /* @__PURE__ */ jsx("path", { d: "M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" }),
  redo: /* @__PURE__ */ jsx("path", { d: "M12 5V1l5 5-5 5V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z" }),
  bold: /* @__PURE__ */ jsx("path", { d: "M7 5h6a3.5 3.5 0 0 1 1.5 6.66A3.5 3.5 0 0 1 13 19H7V5zm3 2v3h3a1.5 1.5 0 0 0 0-3h-3zm0 5v4h3a2 2 0 0 0 0-4h-3z" }),
  italic: /* @__PURE__ */ jsx("path", { d: "M10 4h7v2h-2.3l-3 12H14v2H7v-2h2.3l3-12H10V4z" }),
  underline: /* @__PURE__ */ jsx("path", { d: "M6 4v7a6 6 0 0 0 12 0V4h-2.5v7a3.5 3.5 0 0 1-7 0V4H6zm-1 16h14v2H5v-2z" }),
  strikethrough: /* @__PURE__ */ jsx("path", { d: "M3 11h18v2H3v-2zm9-7c2.5 0 4 1.3 4.3 3h-2.4c-.2-.7-.8-1.2-1.9-1.2-1.2 0-2 .6-2 1.5 0 .5.3.9 1 1.2H9.2C8.5 9 8 8.2 8 7.2 8 5.3 9.7 4 12 4zm2 11.5c0 1.9-1.6 3.5-4.2 3.5-2.6 0-4.3-1.4-4.5-3.4h2.4c.2.9 1 1.5 2.2 1.5 1.3 0 2.1-.6 2.1-1.6 0-.2 0-.4-.1-.5H14z" }),
  superscript: /* @__PURE__ */ jsx("path", { d: "M4 7l4 5-4 5h2.5L9 13.5 11.5 17H14l-4-5 4-5h-2.5L9 10.5 6.5 7H4zm16-1c0-.8-.6-1.5-1.7-1.5-.9 0-1.6.5-1.8 1.3h1c.1-.3.4-.5.8-.5.4 0 .7.2.7.6 0 .6-1 1-2.3 2.1V9h3.6v-.9h-1.9c1-.8 1.6-1.3 1.6-2.2z" }),
  subscript: /* @__PURE__ */ jsx("path", { d: "M4 4l4 5-4 5h2.5L9 10.5 11.5 14H14l-4-5 4-5h-2.5L9 7.5 6.5 4H4zm16 13c0-.8-.6-1.5-1.7-1.5-.9 0-1.6.5-1.8 1.3h1c.1-.3.4-.5.8-.5.4 0 .7.2.7.6 0 .6-1 1-2.3 2.1V20h3.6v-.9h-1.9c1-.8 1.6-1.3 1.6-2.1z" }),
  code: /* @__PURE__ */ jsx("path", { d: "M9 7l-5 5 5 5 1.4-1.4L6.8 12l3.6-3.6L9 7zm6 0l-1.4 1.4L17.2 12l-3.6 3.6L15 17l5-5-5-5z" }),
  textColor: /* @__PURE__ */ jsx("path", { d: "M5 18h14v2H5v-2zM9.6 4h2.8l4.1 11h-2.3l-1-3H8.8l-1 3H5.5L9.6 4zm-.2 6.1h3.2L11 5.6 9.4 10.1z" }),
  highlight: /* @__PURE__ */ jsx("path", { d: "M4 18h16v3H4v-3zM15.6 3.4l3 3-7.8 7.8-3.6.6.6-3.6 7.8-7.8zM6 13l3 3H6v-3z" }),
  clearFormatting: /* @__PURE__ */ jsx("path", { d: "M6 5v2h5l-2.8 9h2.5l2.8-9H19V5H6zM4.7 17.3 17.3 4.7l1.4 1.4L6.1 18.7l-1.4-1.4z" }),
  alignLeft: /* @__PURE__ */ jsx("path", { d: "M3 4h18v2H3V4zm0 5h12v2H3V9zm0 5h18v2H3v-2zm0 5h12v2H3v-2z" }),
  alignCenter: /* @__PURE__ */ jsx("path", { d: "M3 4h18v2H3V4zm3 5h12v2H6V9zm-3 5h18v2H3v-2zm3 5h12v2H6v-2z" }),
  alignRight: /* @__PURE__ */ jsx("path", { d: "M3 4h18v2H3V4zm6 5h12v2H9V9zm-6 5h18v2H3v-2zm6 5h12v2H9v-2z" }),
  alignJustify: /* @__PURE__ */ jsx("path", { d: "M3 4h18v2H3V4zm0 5h18v2H3V9zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" }),
  bulletList: /* @__PURE__ */ jsx("path", { d: "M4 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm4 .5h13v2H8V6zm-4 4.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm4 .5h13v2H8v-2zm-4 4.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm4 .5h13v2H8v-2z" }),
  orderedList: /* @__PURE__ */ jsx("path", { d: "M3 6h1V3H2v1h1v2zm5 0h13v2H8V6zm0 5h13v2H8v-2zm0 5h13v2H8v-2zM2 12.8h2v.5H3v.5h1v.5H2v.7h3v-3H2v.8zm1 4.2H2v.8h1.8v.4L2 19v.9h3V17H4l-1 .5V17z" }),
  taskList: /* @__PURE__ */ jsx("path", { d: "M3 5h6v6H3V5zm2 2v2h2V7H5zm6-1h10v2H11V6zm0 5h10v2H11v-2zm0 5h10v2H11v-2zM3 15.4l1.4-1.4 1.1 1.1 2.6-2.6L9.5 14l-4 4L3 15.4z" }),
  indent: /* @__PURE__ */ jsx("path", { d: "M3 4h18v2H3V4zm8 5h10v2H11V9zm0 5h10v2H11v-2zm-8 5h18v2H3v-2zm0-9 4 3-4 3V10z" }),
  outdent: /* @__PURE__ */ jsx("path", { d: "M3 4h18v2H3V4zm8 5h10v2H11V9zm0 5h10v2H11v-2zm-8 5h18v2H3v-2zM7 10v6l-4-3 4-3z" }),
  blockquote: /* @__PURE__ */ jsx("path", { d: "M7 7c-2 0-3.5 1.6-3.5 3.6 0 1.8 1.3 3 2.9 3 .2 0 .4 0 .6-.1-.4 1-1.4 1.8-2.5 2.1l.6 1.4C7.7 16.9 9.5 14.8 9.5 12 9.5 9.2 8.4 7 7 7zm9 0c-2 0-3.5 1.6-3.5 3.6 0 1.8 1.3 3 2.9 3 .2 0 .4 0 .6-.1-.4 1-1.4 1.8-2.5 2.1l.6 1.4c2.1-.6 3.9-2.7 3.9-5.5C18.5 9.2 17.4 7 16 7z" }),
  horizontalRule: /* @__PURE__ */ jsx("path", { d: "M3 11h18v2H3v-2z" }),
  link: /* @__PURE__ */ jsx("path", { d: "M10.6 13.4a1 1 0 0 0 1.4 0l3-3a3 3 0 0 0-4.3-4.3l-1.5 1.5 1.4 1.4 1.5-1.5a1 1 0 0 1 1.5 1.5l-3 3a1 1 0 0 0 0 1.4zm2.8-2.8a1 1 0 0 0-1.4 0l-3 3A3 3 0 0 0 13.3 18l1.5-1.5-1.4-1.4-1.5 1.5a1 1 0 0 1-1.5-1.5l3-3a1 1 0 0 0 0-1.4z" }),
  image: /* @__PURE__ */ jsx("path", { d: "M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v9l4-4 3 3 3-3 3 3V6H5zm3 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" }),
  table: /* @__PURE__ */ jsx("path", { d: "M3 4h18v16H3V4zm2 2v3h5V6H5zm7 0v3h7V6h-7zm-7 5v3h5v-3H5zm7 0v3h7v-3h-7zm-7 5v2h5v-2H5zm7 0v2h7v-2h-7z" }),
  pageBreak: /* @__PURE__ */ jsx("path", { d: "M6 3h8l4 4v4h-2V8h-3V5H6v6H4V3h2zm-2 13h2v2h2v-2h2v2h2v-2h2v2h2v-2h2v5H4v-5z" })
};
function ToolbarIcon({ name }) {
  const path = PATHS[name];
  if (!path) {
    return /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: name.slice(0, 2) });
  }
  return /* @__PURE__ */ jsx("svg", { className: "rne-btn-icon", viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", children: path });
}
function ToolbarButton({ iconName, label, command }) {
  const { state, run } = useEditorContext();
  const active = state ? command.isActive?.(state) ?? false : false;
  const enabled = state ? command.isEnabled ? command.isEnabled(state) : true : false;
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      className: `rne-btn${active ? " rne-btn--active" : ""}`,
      title: label,
      "aria-label": label,
      "aria-pressed": command.isActive ? active : void 0,
      disabled: !enabled,
      onMouseDown: (e) => e.preventDefault(),
      onClick: () => run(command.run),
      children: /* @__PURE__ */ jsx(ToolbarIcon, { name: iconName })
    }
  );
}
function ColorButton({ iconName, label, apply, clear, activeColor }) {
  const { run, colorPalette } = useEditorContext();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return /* @__PURE__ */ jsxs("div", { className: "rne-color-btn", ref: containerRef, children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: "rne-btn",
        title: label,
        "aria-label": label,
        "aria-haspopup": "true",
        "aria-expanded": open,
        onMouseDown: (e) => e.preventDefault(),
        onClick: () => setOpen((v) => !v),
        children: /* @__PURE__ */ jsxs("span", { style: { display: "flex", flexDirection: "column", alignItems: "center" }, children: [
          /* @__PURE__ */ jsx(ToolbarIcon, { name: iconName }),
          /* @__PURE__ */ jsx("span", { className: "rne-color-swatch", style: { background: activeColor ?? "#000" } })
        ] })
      }
    ),
    open && /* @__PURE__ */ jsxs("div", { className: "rne-color-popover", role: "menu", children: [
      colorPalette.map((color) => /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "rne-color-cell",
          style: { background: color },
          title: color,
          "aria-label": color,
          onMouseDown: (e) => e.preventDefault(),
          onClick: () => {
            run(apply(color));
            setOpen(false);
          }
        },
        color
      )),
      clear && /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "rne-color-cell",
          style: { background: "#fff", gridColumn: "span 8", height: 22 },
          onMouseDown: (e) => e.preventDefault(),
          onClick: () => {
            run(clear());
            setOpen(false);
          },
          children: "\u2715"
        }
      )
    ] })
  ] });
}
var FEATURE_OF = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strikethrough: "strikethrough",
  superscript: "superscript",
  subscript: "subscript",
  code: "code",
  paragraphStyle: "headings",
  fontFamily: "fontFamily",
  fontSize: "fontSize",
  textColor: "textColor",
  highlight: "highlight",
  clearFormatting: "clearFormatting",
  alignLeft: "alignment",
  alignCenter: "alignment",
  alignRight: "alignment",
  alignJustify: "alignment",
  bulletList: "bulletList",
  orderedList: "orderedList",
  taskList: "taskList",
  indent: "indentation",
  outdent: "indentation",
  blockquote: "blockquote",
  horizontalRule: "horizontalRule",
  link: "link",
  image: "image",
  table: "table",
  pageBreak: "pageBreak",
  undo: "history",
  redo: "history"
};
var COMMAND_ITEMS = /* @__PURE__ */ new Set([
  "undo",
  "redo",
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "superscript",
  "subscript",
  "code",
  "clearFormatting",
  "alignLeft",
  "alignCenter",
  "alignRight",
  "alignJustify",
  "bulletList",
  "orderedList",
  "taskList",
  "indent",
  "outdent",
  "blockquote",
  "horizontalRule",
  "pageBreak"
]);
function activeBlockValue(state) {
  if (!state) return "p";
  const node = state.selection.$head.parent;
  if (node.type.name === "heading") return `h${node.attrs.level}`;
  return "p";
}
function Toolbar({ config }) {
  const ctx = useEditorContext();
  const { state, commands, strings, features, run, fontFamilies, fontSizes } = ctx;
  const groups = config?.groups ?? DEFAULT_TOOLBAR_GROUPS;
  const sticky = config?.sticky ?? true;
  const renderedGroups = useMemo(() => {
    return groups.map((group) => group.filter((id) => isItemAvailable(id, features, commands))).filter((group) => group.length > 0);
  }, [groups, features, commands]);
  const labelFor = (id) => strings[id] ?? id;
  function renderItem(id) {
    if (COMMAND_ITEMS.has(id)) {
      const command = commands.registry[id];
      if (!command) return null;
      return /* @__PURE__ */ jsx(ToolbarButton, { iconName: id, label: labelFor(id), command }, id);
    }
    switch (id) {
      case "paragraphStyle":
        return /* @__PURE__ */ jsxs(
          "select",
          {
            className: "rne-select",
            "aria-label": strings.paragraphStyle,
            value: activeBlockValue(state),
            onMouseDown: (e) => e.stopPropagation(),
            onChange: (e) => {
              const v = e.target.value;
              if (v === "p") run(commands.blocks.setParagraph());
              else run(commands.blocks.setHeading(Number(v.slice(1))));
            },
            children: [
              /* @__PURE__ */ jsx("option", { value: "p", children: strings.paragraph }),
              [1, 2, 3, 4, 5, 6].map((lvl) => /* @__PURE__ */ jsx("option", { value: `h${lvl}`, children: `${strings.heading} ${lvl}` }, lvl))
            ]
          },
          id
        );
      case "fontFamily":
        return /* @__PURE__ */ jsxs(
          "select",
          {
            className: "rne-select",
            "aria-label": strings.fontFamily,
            value: state ? commands.marks.getActiveFontFamily(state) ?? "" : "",
            onChange: (e) => {
              const v = e.target.value;
              run(v ? commands.marks.setFontFamily(v) : commands.marks.clearFontFamily());
            },
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: strings.fontFamily }),
              fontFamilies.map((f) => /* @__PURE__ */ jsx("option", { value: f, style: { fontFamily: f }, children: f }, f))
            ]
          },
          id
        );
      case "fontSize":
        return /* @__PURE__ */ jsxs(
          "select",
          {
            className: "rne-select",
            style: { maxWidth: 70 },
            "aria-label": strings.fontSize,
            value: state ? commands.marks.getActiveFontSize(state) ?? "" : "",
            onChange: (e) => {
              const v = e.target.value;
              run(v ? commands.marks.setFontSize(Number(v)) : commands.marks.clearFontSize());
            },
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: strings.fontSize }),
              fontSizes.map((s) => /* @__PURE__ */ jsx("option", { value: s, children: s }, s))
            ]
          },
          id
        );
      case "textColor":
        return /* @__PURE__ */ jsx(
          ColorButton,
          {
            iconName: "textColor",
            label: strings.textColor,
            apply: (c) => commands.marks.setTextColor(c),
            clear: () => commands.marks.clearTextColor(),
            activeColor: state ? commands.marks.getActiveTextColor(state) : null
          },
          id
        );
      case "highlight":
        return /* @__PURE__ */ jsx(
          ColorButton,
          {
            iconName: "highlight",
            label: strings.highlight,
            apply: (c) => commands.marks.setHighlight(c),
            clear: () => commands.marks.clearHighlight()
          },
          id
        );
      case "link":
        return /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: "rne-btn",
            title: strings.link,
            "aria-label": strings.link,
            onMouseDown: (e) => e.preventDefault(),
            onClick: () => {
              if (!state) return;
              const prev = commands.links.getActiveLink(state);
              const url = window.prompt(strings.linkPrompt, prev?.href ?? "https://");
              if (url === null) return;
              if (url.trim() === "") run(commands.links.removeLink);
              else run(commands.links.setLink({ href: url.trim() }));
            },
            children: /* @__PURE__ */ jsx(ToolbarIcon, { name: "link" })
          },
          id
        );
      case "image":
        return /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: "rne-btn",
            title: strings.image,
            "aria-label": strings.image,
            onMouseDown: (e) => e.preventDefault(),
            onClick: () => {
              const url = window.prompt(strings.imagePrompt, "https://");
              if (url && url.trim()) run(commands.insert.image({ src: url.trim() }));
            },
            children: /* @__PURE__ */ jsx(ToolbarIcon, { name: "image" })
          },
          id
        );
      case "table":
        return /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: "rne-btn",
            title: strings.insertTable,
            "aria-label": strings.insertTable,
            onMouseDown: (e) => e.preventDefault(),
            onClick: () => run(commands.insert.table(3, 3, true)),
            children: /* @__PURE__ */ jsx(ToolbarIcon, { name: "table" })
          },
          id
        );
      default:
        return null;
    }
  }
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: `rne-toolbar${sticky ? " rne-toolbar--sticky" : ""}`,
      role: "toolbar",
      "aria-label": "Formatting",
      children: renderedGroups.map((group, gi) => /* @__PURE__ */ jsxs(Fragment, { children: [
        gi > 0 && /* @__PURE__ */ jsx("span", { className: "rne-toolbar-separator", "aria-hidden": "true" }),
        /* @__PURE__ */ jsx("div", { className: "rne-toolbar-group", children: group.map(renderItem) })
      ] }, gi))
    }
  );
}
function isItemAvailable(id, features, commands) {
  if (id === "separator") return false;
  const feature = FEATURE_OF[id];
  if (feature && !features[feature]) return false;
  if (COMMAND_ITEMS.has(id) && !commands.registry[id]) return false;
  return true;
}
var STATUS_LABEL = {
  idle: "",
  savingLocal: "Saving\u2026",
  savedLocal: "Saved locally",
  syncing: "Syncing\u2026",
  synced: "Synced",
  syncFailed: "Sync failed",
  offline: "Offline"
};
function StatusBar({ saveStatus, hasPersistence }) {
  const { state, strings } = useEditorContext();
  const stats = useMemo(() => state ? countDocument(state.doc) : null, [state]);
  return /* @__PURE__ */ jsxs("div", { className: "rne-statusbar", children: [
    /* @__PURE__ */ jsx("span", { children: stats ? `${stats.words} ${strings.words} \xB7 ${stats.characters} ${strings.characters}` : "" }),
    hasPersistence && saveStatus !== "idle" && /* @__PURE__ */ jsxs("span", { className: "rne-status-badge", children: [
      /* @__PURE__ */ jsx("span", { className: `rne-status-dot rne-status-dot--${saveStatus}` }),
      STATUS_LABEL[saveStatus]
    ] })
  ] });
}
function resolveConfig(props) {
  return {
    features: { ...DEFAULT_FEATURES, ...props.features },
    page: {
      ...DEFAULT_PAGE,
      ...props.page,
      margins: { ...DEFAULT_PAGE.margins, ...props.page?.margins }
    },
    strings: { ...DEFAULT_STRINGS, ...props.strings },
    fontFamilies: props.fontFamilies ?? DEFAULT_FONT_FAMILIES,
    fontSizes: props.fontSizes ?? DEFAULT_FONT_SIZES,
    colorPalette: props.colorPalette ?? DEFAULT_COLOR_PALETTE,
    editable: !(props.readOnly || props.mode === "readonly"),
    placeholder: props.placeholder
  };
}
var EditorInner = forwardRef(function EditorInner2(props, ref) {
  const mountRef = useRef(null);
  const viewRef = useRef(null);
  const persistenceRef = useRef(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const config = useMemo(() => resolveConfig(props), [props]);
  const cfgRef = useRef(config);
  cfgRef.current = config;
  const featureKey = useMemo(() => JSON.stringify(config.features), [config.features]);
  const engine = useMemo(() => {
    const schema = buildSchema(config.features);
    const commands = createCommands(schema);
    return { schema, commands };
  }, [featureKey]);
  const [editorState, setEditorState] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [ready, setReady] = useState(false);
  const getJSON = useCallback(() => {
    const view = viewRef.current;
    return view ? view.state.doc.toJSON() : createDoc(engine.schema, null).toJSON();
  }, [engine.schema]);
  const setContent = useCallback(
    (content) => {
      const view = viewRef.current;
      if (!view) return;
      const doc = createDoc(view.state.schema, content);
      const state = EditorState.create({ doc, plugins: view.state.plugins });
      view.updateState(state);
      setEditorState(state);
    },
    []
  );
  const handle = useMemo(
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
      exportAs: (format, filename) => exportDocument(getJSON(), format, {
        filename: filename ?? propsRef.current.documentId,
        page: cfgRef.current.page,
        title: filename ?? propsRef.current.documentId
      }),
      getView: () => viewRef.current,
      getState: () => viewRef.current?.state ?? null,
      getSchema: () => viewRef.current?.state.schema ?? null
    }),
    [getJSON, setContent]
  );
  useImperativeHandle(ref, () => handle, [handle]);
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    void preloadSanitizer();
    const plugins = buildPlugins(engine.schema, {
      placeholder: cfgRef.current.placeholder,
      history: cfgRef.current.features.history,
      extraPlugins: propsRef.current.extensions?.plugins
    });
    const initialContent = propsRef.current.value ?? propsRef.current.initialContent ?? null;
    const state = createEditorState({ schema: engine.schema, plugins, content: initialContent });
    const view = new EditorView(mount, {
      state,
      editable: () => !(propsRef.current.readOnly || propsRef.current.mode === "readonly"),
      attributes: {
        class: "rne-prosemirror",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": propsRef.current.ariaLabel ?? "Document editor"
      },
      dispatchTransaction(tr) {
        const v = viewRef.current;
        if (!v) return;
        const newState = v.state.apply(tr);
        v.updateState(newState);
        setEditorState(newState);
        const p = propsRef.current;
        if (tr.docChanged) {
          const json = newState.doc.toJSON();
          p.onChange?.(json, handle);
          persistenceRef.current?.scheduleSave(json);
        }
        if (tr.selectionSet) {
          p.onSelectionChange?.(newState);
        }
      }
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
  }, [engine]);
  useEffect(() => {
    viewRef.current?.setProps({
      editable: () => config.editable
    });
    setEditorState((s) => s);
  }, [config.editable]);
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
      }
    });
    persistenceRef.current = persistence;
    if (props.persistence?.requestPersistent !== false) {
      void requestPersistentStorage();
    }
    let cancelled = false;
    void (async () => {
      const record = await persistence.load();
      if (cancelled || !record) return;
      if (propsRef.current.value == null) {
        setContent(record.doc);
      }
    })();
    return () => {
      cancelled = true;
      void persistence.destroy();
      persistenceRef.current = null;
    };
  }, [props.documentId, ready]);
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
      state.tr.setSelection(TextSelection.create(state.doc, Math.max(0, selectionPos)))
    );
    view.updateState(withSel);
    setEditorState(withSel);
  }, [props.value]);
  const runCommand = useCallback((command) => {
    const view = viewRef.current;
    if (!view) return false;
    const result = command(view.state, view.dispatch, view);
    view.focus();
    return result;
  }, []);
  const contextValue = useMemo(
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
      run: runCommand
    }),
    [editorState, engine, config, runCommand]
  );
  const { width } = resolvePageDimensions(config.page);
  const showChrome = config.page.showPageChrome;
  const rootStyle = useMemo(
    () => ({
      ...themeToCssVars(props.theme),
      "--rne-page-width": `${width}mm`,
      "--rne-page-padding": `${config.page.margins.top}mm ${config.page.margins.right}mm ${config.page.margins.bottom}mm ${config.page.margins.left}mm`,
      ...props.style
    }),
    [props.theme, props.style, width, config.page.margins]
  );
  const toolbarEnabled = props.toolbar !== false && (props.toolbar?.enabled ?? true) && config.editable;
  const statusBarEnabled = props.statusBar ?? true;
  return /* @__PURE__ */ jsx(EditorContext.Provider, { value: contextValue, children: /* @__PURE__ */ jsxs(
    "div",
    {
      className: `rne-root${props.className ? ` ${props.className}` : ""}`,
      style: rootStyle,
      "data-ready": ready,
      children: [
        toolbarEnabled && /* @__PURE__ */ jsx(Toolbar, { config: props.toolbar || void 0 }),
        /* @__PURE__ */ jsx("div", { className: `rne-canvas${showChrome ? "" : " rne-canvas--plain"}`, children: /* @__PURE__ */ jsx("div", { className: "rne-page", children: /* @__PURE__ */ jsx("div", { ref: mountRef, className: "rne-mount" }) }) }),
        statusBarEnabled && /* @__PURE__ */ jsx(StatusBar, { saveStatus, hasPersistence: !!props.documentId })
      ]
    }
  ) });
});
var Editor = forwardRef(function Editor2(props, ref) {
  return /* @__PURE__ */ jsx(EditorErrorBoundary, { onError: props.onError, children: /* @__PURE__ */ jsx(EditorInner, { ...props, ref }) });
});

export { Editor, EditorContext, EditorErrorBoundary, StatusBar, Toolbar, ToolbarButton, ToolbarIcon, useEditorContext };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map