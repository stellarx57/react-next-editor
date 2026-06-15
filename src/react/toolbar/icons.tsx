'use client';

import type { JSX } from 'react';

/**
 * Compact 24×24 inline SVG icons for toolbar controls. Inline so the package has
 * no icon-font dependency and icons inherit `currentColor` for theming.
 */
const PATHS: Record<string, JSX.Element> = {
  undo: <path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" />,
  redo: <path d="M12 5V1l5 5-5 5V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z" />,
  bold: (
    <path d="M7 5h6a3.5 3.5 0 0 1 1.5 6.66A3.5 3.5 0 0 1 13 19H7V5zm3 2v3h3a1.5 1.5 0 0 0 0-3h-3zm0 5v4h3a2 2 0 0 0 0-4h-3z" />
  ),
  italic: <path d="M10 4h7v2h-2.3l-3 12H14v2H7v-2h2.3l3-12H10V4z" />,
  underline: <path d="M6 4v7a6 6 0 0 0 12 0V4h-2.5v7a3.5 3.5 0 0 1-7 0V4H6zm-1 16h14v2H5v-2z" />,
  strikethrough: (
    <path d="M3 11h18v2H3v-2zm9-7c2.5 0 4 1.3 4.3 3h-2.4c-.2-.7-.8-1.2-1.9-1.2-1.2 0-2 .6-2 1.5 0 .5.3.9 1 1.2H9.2C8.5 9 8 8.2 8 7.2 8 5.3 9.7 4 12 4zm2 11.5c0 1.9-1.6 3.5-4.2 3.5-2.6 0-4.3-1.4-4.5-3.4h2.4c.2.9 1 1.5 2.2 1.5 1.3 0 2.1-.6 2.1-1.6 0-.2 0-.4-.1-.5H14z" />
  ),
  superscript: (
    <path d="M4 7l4 5-4 5h2.5L9 13.5 11.5 17H14l-4-5 4-5h-2.5L9 10.5 6.5 7H4zm16-1c0-.8-.6-1.5-1.7-1.5-.9 0-1.6.5-1.8 1.3h1c.1-.3.4-.5.8-.5.4 0 .7.2.7.6 0 .6-1 1-2.3 2.1V9h3.6v-.9h-1.9c1-.8 1.6-1.3 1.6-2.2z" />
  ),
  subscript: (
    <path d="M4 4l4 5-4 5h2.5L9 10.5 11.5 14H14l-4-5 4-5h-2.5L9 7.5 6.5 4H4zm16 13c0-.8-.6-1.5-1.7-1.5-.9 0-1.6.5-1.8 1.3h1c.1-.3.4-.5.8-.5.4 0 .7.2.7.6 0 .6-1 1-2.3 2.1V20h3.6v-.9h-1.9c1-.8 1.6-1.3 1.6-2.1z" />
  ),
  code: <path d="M9 7l-5 5 5 5 1.4-1.4L6.8 12l3.6-3.6L9 7zm6 0l-1.4 1.4L17.2 12l-3.6 3.6L15 17l5-5-5-5z" />,
  textColor: <path d="M5 18h14v2H5v-2zM9.6 4h2.8l4.1 11h-2.3l-1-3H8.8l-1 3H5.5L9.6 4zm-.2 6.1h3.2L11 5.6 9.4 10.1z" />,
  highlight: <path d="M4 18h16v3H4v-3zM15.6 3.4l3 3-7.8 7.8-3.6.6.6-3.6 7.8-7.8zM6 13l3 3H6v-3z" />,
  clearFormatting: (
    <path d="M6 5v2h5l-2.8 9h2.5l2.8-9H19V5H6zM4.7 17.3 17.3 4.7l1.4 1.4L6.1 18.7l-1.4-1.4z" />
  ),
  alignLeft: <path d="M3 4h18v2H3V4zm0 5h12v2H3V9zm0 5h18v2H3v-2zm0 5h12v2H3v-2z" />,
  alignCenter: <path d="M3 4h18v2H3V4zm3 5h12v2H6V9zm-3 5h18v2H3v-2zm3 5h12v2H6v-2z" />,
  alignRight: <path d="M3 4h18v2H3V4zm6 5h12v2H9V9zm-6 5h18v2H3v-2zm6 5h12v2H9v-2z" />,
  alignJustify: <path d="M3 4h18v2H3V4zm0 5h18v2H3V9zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />,
  bulletList: (
    <path d="M4 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm4 .5h13v2H8V6zm-4 4.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm4 .5h13v2H8v-2zm-4 4.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm4 .5h13v2H8v-2z" />
  ),
  orderedList: (
    <path d="M3 6h1V3H2v1h1v2zm5 0h13v2H8V6zm0 5h13v2H8v-2zm0 5h13v2H8v-2zM2 12.8h2v.5H3v.5h1v.5H2v.7h3v-3H2v.8zm1 4.2H2v.8h1.8v.4L2 19v.9h3V17H4l-1 .5V17z" />
  ),
  taskList: (
    <path d="M3 5h6v6H3V5zm2 2v2h2V7H5zm6-1h10v2H11V6zm0 5h10v2H11v-2zm0 5h10v2H11v-2zM3 15.4l1.4-1.4 1.1 1.1 2.6-2.6L9.5 14l-4 4L3 15.4z" />
  ),
  indent: <path d="M3 4h18v2H3V4zm8 5h10v2H11V9zm0 5h10v2H11v-2zm-8 5h18v2H3v-2zm0-9 4 3-4 3V10z" />,
  outdent: <path d="M3 4h18v2H3V4zm8 5h10v2H11V9zm0 5h10v2H11v-2zm-8 5h18v2H3v-2zM7 10v6l-4-3 4-3z" />,
  blockquote: (
    <path d="M7 7c-2 0-3.5 1.6-3.5 3.6 0 1.8 1.3 3 2.9 3 .2 0 .4 0 .6-.1-.4 1-1.4 1.8-2.5 2.1l.6 1.4C7.7 16.9 9.5 14.8 9.5 12 9.5 9.2 8.4 7 7 7zm9 0c-2 0-3.5 1.6-3.5 3.6 0 1.8 1.3 3 2.9 3 .2 0 .4 0 .6-.1-.4 1-1.4 1.8-2.5 2.1l.6 1.4c2.1-.6 3.9-2.7 3.9-5.5C18.5 9.2 17.4 7 16 7z" />
  ),
  horizontalRule: <path d="M3 11h18v2H3v-2z" />,
  link: (
    <path d="M10.6 13.4a1 1 0 0 0 1.4 0l3-3a3 3 0 0 0-4.3-4.3l-1.5 1.5 1.4 1.4 1.5-1.5a1 1 0 0 1 1.5 1.5l-3 3a1 1 0 0 0 0 1.4zm2.8-2.8a1 1 0 0 0-1.4 0l-3 3A3 3 0 0 0 13.3 18l1.5-1.5-1.4-1.4-1.5 1.5a1 1 0 0 1-1.5-1.5l3-3a1 1 0 0 0 0-1.4z" />
  ),
  image: (
    <path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v9l4-4 3 3 3-3 3 3V6H5zm3 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
  ),
  table: (
    <path d="M3 4h18v16H3V4zm2 2v3h5V6H5zm7 0v3h7V6h-7zm-7 5v3h5v-3H5zm7 0v3h7v-3h-7zm-7 5v2h5v-2H5zm7 0v2h7v-2h-7z" />
  ),
  pageBreak: (
    <path d="M6 3h8l4 4v4h-2V8h-3V5H6v6H4V3h2zm-2 13h2v2h2v-2h2v2h2v-2h2v2h2v-2h2v5H4v-5z" />
  ),
  importDocx: (
    <path d="M5 3h9l5 5v6h-2V9h-4V5H7v14h5v2H5V3zm8 11 4 4 4-4h-3v-4h-2v4h-3z" />
  ),
};

export function ToolbarIcon({ name }: { name: string }): JSX.Element {
  const path = PATHS[name];
  if (!path) {
    return <span aria-hidden="true">{name.slice(0, 2)}</span>;
  }
  return (
    <svg className="rne-btn-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {path}
    </svg>
  );
}
