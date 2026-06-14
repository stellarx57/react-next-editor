'use client';

import { useMemo } from 'react';
import type { SaveStatus } from '../config/types';
import { countDocument } from '../core/utils';
import { useEditorContext } from './EditorContext';

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: '',
  savingLocal: 'Saving…',
  savedLocal: 'Saved locally',
  syncing: 'Syncing…',
  synced: 'Synced',
  syncFailed: 'Sync failed',
  offline: 'Offline',
};

interface StatusBarProps {
  saveStatus: SaveStatus;
  hasPersistence: boolean;
}

/** Word/character count (F-4.5) and visible save/sync status (F-9.4, NF-10). */
export function StatusBar({ saveStatus, hasPersistence }: StatusBarProps) {
  const { state, strings } = useEditorContext();

  const stats = useMemo(() => (state ? countDocument(state.doc) : null), [state]);

  return (
    <div className="rne-statusbar">
      <span>
        {stats
          ? `${stats.words} ${strings.words} · ${stats.characters} ${strings.characters}`
          : ''}
      </span>
      {hasPersistence && saveStatus !== 'idle' && (
        <span className="rne-status-badge">
          <span className={`rne-status-dot rne-status-dot--${saveStatus}`} />
          {STATUS_LABEL[saveStatus]}
        </span>
      )}
    </div>
  );
}
