'use client';

import { useEffect, useRef, useState } from 'react';
import type { Command } from 'prosemirror-state';
import { useEditorContext } from '../EditorContext';
import { ToolbarIcon } from './icons';

interface ColorButtonProps {
  iconName: 'textColor' | 'highlight';
  label: string;
  /** Build a command that applies the chosen color. */
  apply: (color: string) => Command;
  /** Build a command that clears the color, if supported. */
  clear?: () => Command;
  /** The currently-active color, for the swatch. */
  activeColor?: string | null;
}

/** A color picker button with a palette popover (text color / highlight). */
export function ColorButton({ iconName, label, apply, clear, activeColor }: ColorButtonProps) {
  const { run, colorPalette } = useEditorContext();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="rne-color-btn" ref={containerRef}>
      <button
        type="button"
        className="rne-btn"
        title={label}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <ToolbarIcon name={iconName} />
          <span className="rne-color-swatch" style={{ background: activeColor ?? '#000' }} />
        </span>
      </button>
      {open && (
        <div className="rne-color-popover" role="menu">
          {colorPalette.map((color) => (
            <button
              key={color}
              type="button"
              className="rne-color-cell"
              style={{ background: color }}
              title={color}
              aria-label={color}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                run(apply(color));
                setOpen(false);
              }}
            />
          ))}
          {clear && (
            <button
              type="button"
              className="rne-color-cell"
              style={{ background: '#fff', gridColumn: 'span 8', height: 22 }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                run(clear());
                setOpen(false);
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}
