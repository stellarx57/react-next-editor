'use client';

import { createContext, useContext } from 'react';
import type { EditorContextValue } from './types';

/** Context providing the live view/state/commands to the toolbar and children. */
export const EditorContext = createContext<EditorContextValue | null>(null);

/** Access the editor context; throws if used outside an <Editor>. */
export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error('useEditorContext must be used within a react-next-editor <Editor>.');
  }
  return ctx;
}
