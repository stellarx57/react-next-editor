'use client';

export { Editor } from './Editor';
export { DocumentView, type DocumentViewProps } from './DocumentView';
export { EditorErrorBoundary } from './ErrorBoundary';
export { EditorContext, useEditorContext } from './EditorContext';
export { Toolbar } from './toolbar/Toolbar';
export { ToolbarButton } from './toolbar/ToolbarButton';
export { ToolbarIcon } from './toolbar/icons';
export { StatusBar } from './StatusBar';
export type {
  EditorProps,
  EditorRef,
  EditorEvents,
  EditorExtensions,
  PersistenceConfig,
  SyncConfig,
  EditorContextValue,
} from './types';
