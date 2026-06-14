'use client';

import { Fragment, type KeyboardEvent, useCallback, useMemo, useRef } from 'react';
import type { EditorState } from 'prosemirror-state';
import type { FeatureFlags, ToolbarConfig, ToolbarItemId } from '../../config/types';
import { DEFAULT_TOOLBAR_GROUPS } from '../../config/defaults';
import { useEditorContext } from '../EditorContext';
import { ToolbarButton } from './ToolbarButton';
import { ColorButton } from './ColorButton';
import { ToolbarIcon } from './icons';

const FEATURE_OF: Partial<Record<ToolbarItemId, keyof FeatureFlags>> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strikethrough: 'strikethrough',
  superscript: 'superscript',
  subscript: 'subscript',
  code: 'code',
  paragraphStyle: 'headings',
  fontFamily: 'fontFamily',
  fontSize: 'fontSize',
  textColor: 'textColor',
  highlight: 'highlight',
  clearFormatting: 'clearFormatting',
  alignLeft: 'alignment',
  alignCenter: 'alignment',
  alignRight: 'alignment',
  alignJustify: 'alignment',
  bulletList: 'bulletList',
  orderedList: 'orderedList',
  taskList: 'taskList',
  indent: 'indentation',
  outdent: 'indentation',
  blockquote: 'blockquote',
  horizontalRule: 'horizontalRule',
  link: 'link',
  image: 'image',
  table: 'table',
  pageBreak: 'pageBreak',
  undo: 'history',
  redo: 'history',
};

/** Item ids backed directly by a registry command (rendered as icon buttons). */
const COMMAND_ITEMS = new Set<ToolbarItemId>([
  'undo',
  'redo',
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'superscript',
  'subscript',
  'code',
  'clearFormatting',
  'alignLeft',
  'alignCenter',
  'alignRight',
  'alignJustify',
  'bulletList',
  'orderedList',
  'taskList',
  'indent',
  'outdent',
  'blockquote',
  'horizontalRule',
  'pageBreak',
]);

function activeBlockValue(state: EditorState | null): string {
  if (!state) return 'p';
  const node = state.selection.$head.parent;
  if (node.type.name === 'heading') return `h${node.attrs.level as number}`;
  return 'p';
}

interface ToolbarProps {
  config?: ToolbarConfig;
}

/** Data-driven, keyboard-accessible toolbar (F-1–F-3, F-10.6, NF-4). */
export function Toolbar({ config }: ToolbarProps) {
  const ctx = useEditorContext();
  const { state, commands, strings, features, run, fontFamilies, fontSizes } = ctx;

  const groups = config?.groups ?? DEFAULT_TOOLBAR_GROUPS;
  const sticky = config?.sticky ?? true;
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Arrow-key navigation between toolbar buttons (WCAG toolbar pattern). Tab
  // order is preserved; arrows move focus among enabled buttons. Selects keep
  // their native arrow behaviour (and remain reachable via Tab), so they are not
  // part of the arrow ring.
  const onToolbarKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const active = document.activeElement as HTMLElement | null;
    if (active?.tagName === 'SELECT') return;
    const root = toolbarRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled])'));
    if (items.length === 0) return;
    const idx = active ? items.indexOf(active) : -1;
    if (idx === -1) return;
    e.preventDefault();
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    items[next]?.focus();
  }, []);

  const renderedGroups = useMemo(() => {
    return groups
      .map((group) => group.filter((id) => isItemAvailable(id, features, commands)))
      .filter((group) => group.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, features, commands]);

  const labelFor = (id: ToolbarItemId): string =>
    (strings as unknown as Record<string, string>)[id] ?? id;

  function renderItem(id: ToolbarItemId) {
    if (COMMAND_ITEMS.has(id)) {
      const command = commands.registry[id];
      if (!command) return null;
      return <ToolbarButton key={id} iconName={id} label={labelFor(id)} command={command} />;
    }

    switch (id) {
      case 'paragraphStyle':
        return (
          <select
            key={id}
            className="rne-select"
            aria-label={strings.paragraphStyle}
            value={activeBlockValue(state)}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'p') run(commands.blocks.setParagraph());
              else run(commands.blocks.setHeading(Number(v.slice(1))));
            }}
          >
            <option value="p">{strings.paragraph}</option>
            {[1, 2, 3, 4, 5, 6].map((lvl) => (
              <option key={lvl} value={`h${lvl}`}>{`${strings.heading} ${lvl}`}</option>
            ))}
          </select>
        );
      case 'fontFamily':
        return (
          <select
            key={id}
            className="rne-select"
            aria-label={strings.fontFamily}
            value={state ? (commands.marks.getActiveFontFamily(state) ?? '') : ''}
            onChange={(e) => {
              const v = e.target.value;
              run(v ? commands.marks.setFontFamily(v) : commands.marks.clearFontFamily());
            }}
          >
            <option value="">{strings.fontFamily}</option>
            {fontFamilies.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>
                {f}
              </option>
            ))}
          </select>
        );
      case 'fontSize':
        return (
          <select
            key={id}
            className="rne-select"
            style={{ maxWidth: 70 }}
            aria-label={strings.fontSize}
            value={state ? (commands.marks.getActiveFontSize(state) ?? '') : ''}
            onChange={(e) => {
              const v = e.target.value;
              run(v ? commands.marks.setFontSize(Number(v)) : commands.marks.clearFontSize());
            }}
          >
            <option value="">{strings.fontSize}</option>
            {fontSizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        );
      case 'textColor':
        return (
          <ColorButton
            key={id}
            iconName="textColor"
            label={strings.textColor}
            apply={(c) => commands.marks.setTextColor(c)}
            clear={() => commands.marks.clearTextColor()}
            activeColor={state ? commands.marks.getActiveTextColor(state) : null}
          />
        );
      case 'highlight':
        return (
          <ColorButton
            key={id}
            iconName="highlight"
            label={strings.highlight}
            apply={(c) => commands.marks.setHighlight(c)}
            clear={() => commands.marks.clearHighlight()}
          />
        );
      case 'link':
        return (
          <button
            key={id}
            type="button"
            className="rne-btn"
            title={strings.link}
            aria-label={strings.link}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (!state) return;
              const prev = commands.links.getActiveLink(state);
              const url = window.prompt(strings.linkPrompt, prev?.href ?? 'https://');
              if (url === null) return;
              if (url.trim() === '') run(commands.links.removeLink);
              else run(commands.links.setLink({ href: url.trim() }));
            }}
          >
            <ToolbarIcon name="link" />
          </button>
        );
      case 'image':
        return (
          <button
            key={id}
            type="button"
            className="rne-btn"
            title={strings.image}
            aria-label={strings.image}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const url = window.prompt(strings.imagePrompt, 'https://');
              if (!url || !url.trim()) return;
              // Prompt for alt text so inserted images are accessible (NF-4).
              const alt = window.prompt(strings.imageAltPrompt, '');
              run(commands.insert.image({ src: url.trim(), alt: alt?.trim() || null }));
            }}
          >
            <ToolbarIcon name="image" />
          </button>
        );
      case 'table':
        return (
          <button
            key={id}
            type="button"
            className="rne-btn"
            title={strings.insertTable}
            aria-label={strings.insertTable}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(commands.insert.table(3, 3, true))}
          >
            <ToolbarIcon name="table" />
          </button>
        );
      default:
        return null;
    }
  }

  return (
    <div
      ref={toolbarRef}
      className={`rne-toolbar${sticky ? ' rne-toolbar--sticky' : ''}`}
      role="toolbar"
      aria-label="Formatting"
      onKeyDown={onToolbarKeyDown}
    >
      {renderedGroups.map((group, gi) => (
        <Fragment key={gi}>
          {gi > 0 && <span className="rne-toolbar-separator" aria-hidden="true" />}
          <div className="rne-toolbar-group">{group.map(renderItem)}</div>
        </Fragment>
      ))}
    </div>
  );
}

function isItemAvailable(
  id: ToolbarItemId,
  features: FeatureFlags,
  commands: ReturnType<typeof useEditorContext>['commands'],
): boolean {
  if (id === 'separator') return false;
  const feature = FEATURE_OF[id];
  if (feature && !features[feature]) return false;
  if (COMMAND_ITEMS.has(id) && !commands.registry[id]) return false;
  return true;
}
