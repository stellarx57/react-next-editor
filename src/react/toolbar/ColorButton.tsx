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

/**
 * Normalize a color to a 6-digit hex for the native color input, which only
 * accepts that form. Shorthand `#abc` is expanded; anything else falls back.
 */
function toHexInputValue(color: string | null | undefined, fallback: string): string {
  if (typeof color === 'string') {
    const v = color.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(v)) return v;
    if (/^#[0-9a-f]{3}$/.test(v)) {
      return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    }
  }
  return fallback;
}

/** A color picker button with a palette popover + custom picker (text color / highlight). */
export function ColorButton({ iconName, label, apply, clear, activeColor }: ColorButtonProps) {
  const { run, colorPalette } = useEditorContext();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const defaultColor = iconName === 'highlight' ? '#fff2a8' : '#000000';

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
        ref={buttonRef}
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
        <div
          className="rne-color-popover"
          role="menu"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              buttonRef.current?.focus();
            }
          }}
        >
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
          {/* Custom color — pick any color, not just the palette. The ProseMirror
              selection persists in editor state even though the native picker
              takes DOM focus, so the chosen color applies to the selected text. */}
          <label className="rne-color-custom">
            <span className="rne-color-custom-label">Custom</span>
            <input
              type="color"
              className="rne-color-input"
              aria-label={`${label}: custom color`}
              defaultValue={toHexInputValue(activeColor, defaultColor)}
              onChange={(e) => run(apply(e.target.value))}
            />
          </label>
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
