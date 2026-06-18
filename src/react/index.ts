'use client';

export { Editor, useEditorApiRef } from './Editor';
export {
  RichTextField,
  type RichTextFieldProps,
  type RichTextFieldRef,
  type RichTextFieldChangeMeta,
} from './RichTextField';
export { DocumentView, type DocumentViewProps } from './DocumentView';
export { DocumentText, type DocumentTextProps } from './DocumentText';
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
