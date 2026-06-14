'use client';

import { useEffect, useState } from 'react';
import type { SaveStatus } from '../config/types';
import { countDocument, type DocumentStats } from '../core/utils';
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

/**
 * Word/character count (F-4.5) and visible save/sync status (F-9.4, NF-10).
 *
 * The count is an O(n) document walk, so it is recomputed only when the document
 * actually changes (not on selection changes) and is debounced — keeping typing
 * responsive on large documents (NF-1).
 */
export function StatusBar({ saveStatus, hasPersistence }: StatusBarProps) {
  const { state, strings } = useEditorContext();
  const doc = state?.doc;
  const [stats, setStats] = useState<DocumentStats | null>(null);

  useEffect(() => {
    if (!doc) {
      setStats(null);
      return;
    }
    // `doc` identity is stable across selection-only transactions, so this fires
    // only on real edits. Debounce to avoid walking a large doc on every keystroke.
    const id = setTimeout(() => setStats(countDocument(doc)), 300);
    return () => clearTimeout(id);
  }, [doc]);

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
