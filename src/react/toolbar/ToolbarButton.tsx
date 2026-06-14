'use client';

import type { EditorCommand } from '../../core/commands/helpers';
import { useEditorContext } from '../EditorContext';
import { ToolbarIcon } from './icons';

interface ToolbarButtonProps {
  iconName: string;
  label: string;
  command: EditorCommand;
}

/** A single command button reflecting active/enabled state (F-10.6, NF-4). */
export function ToolbarButton({ iconName, label, command }: ToolbarButtonProps) {
  const { state, run } = useEditorContext();
  const active = state ? (command.isActive?.(state) ?? false) : false;
  const enabled = state ? (command.isEnabled ? command.isEnabled(state) : true) : false;

  return (
    <button
      type="button"
      className={`rne-btn${active ? ' rne-btn--active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={command.isActive ? active : undefined}
      disabled={!enabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => run(command.run)}
    >
      <ToolbarIcon name={iconName} />
    </button>
  );
}
