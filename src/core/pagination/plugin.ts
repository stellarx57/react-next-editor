import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import {
  type BlockMetric,
  type PaginationResult,
  computePagination,
  paginationEquals,
} from './compute';

/**
 * Visual pagination plugin (F-5.3–F-5.5). Measures the document's top-level
 * blocks, computes page breaks at block boundaries, inserts transparent spacer
 * widget decorations so content visually flows across discrete page sheets, and
 * imperatively renders the page-sheet background layer with repeating
 * headers/footers and live page numbers.
 *
 * It NEVER mutates the document — pagination is purely visual (widget
 * decorations + a sibling background layer). All measurement is wrapped so a
 * failure degrades gracefully to single-flow rendering (F-11.1).
 */

export const paginationKey = new PluginKey<PaginationPluginState>('rne-pagination');

/** Concrete pixel geometry for the current page configuration. */
export interface PaginationGeometry {
  pageWidthPx: number;
  pageHeightPx: number;
  marginTopPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  contentWidthPx: number;
  /** Usable content height per page (page height − top/bottom margins). */
  contentHeightPx: number;
  /** bottom margin + page gap + top margin. */
  interPageOffsetPx: number;
}

export interface PaginationRunningElement {
  show?: boolean;
  /** Static text; `{page}` and `{pages}` are replaced with the live numbers. */
  text?: string;
  /** Horizontal alignment within the content width. Default: header left, footer center. */
  align?: 'left' | 'center' | 'right';
}

export interface PaginationOptions {
  /** Returns the current pixel geometry, or null to disable pagination. */
  getGeometry: () => PaginationGeometry | null;
  /** Returns the background-layer element the plugin renders sheets into. */
  getBackgroundLayer: () => HTMLElement | null;
  header?: PaginationRunningElement;
  footer?: PaginationRunningElement & { pageNumbers?: boolean };
  /** Called when the page count changes. */
  onPageCount?: (count: number) => void;
  /**
   * Receives a `requestMeasure` callback the consumer can invoke to force a
   * re-measure (e.g. after changing page geometry at runtime).
   */
  register?: (requestMeasure: () => void) => void;
}

interface PaginationPluginState {
  result: PaginationResult | null;
  decorations: DecorationSet;
}

function buildDecorations(doc: PMNode, result: PaginationResult | null) {
  if (!result || result.breaks.length === 0) return DecorationSet.empty;
  const decorations = result.breaks.map((br) =>
    Decoration.widget(
      br.pos,
      () => {
        const el = document.createElement('div');
        el.className = 'rne-page-spacer';
        el.style.height = `${Math.max(0, br.spacerHeight)}px`;
        el.setAttribute('contenteditable', 'false');
        el.setAttribute('aria-hidden', 'true');
        return el;
      },
      { side: -1, key: `rne-pb:${br.pos}:${Math.round(br.spacerHeight)}`, ignoreSelection: true },
    ),
  );
  return DecorationSet.create(doc, decorations);
}

export function paginationPlugin(options: PaginationOptions): Plugin<PaginationPluginState> {
  return new Plugin<PaginationPluginState>({
    key: paginationKey,
    state: {
      init: () => ({ result: null, decorations: DecorationSet.empty }),
      apply(tr, prev) {
        const meta = tr.getMeta(paginationKey) as { result: PaginationResult } | undefined;
        if (meta) {
          return { result: meta.result, decorations: buildDecorations(tr.doc, meta.result) };
        }
        if (tr.docChanged) {
          // Keep the stored break positions in sync with the mapped decorations
          // so natural-coordinate measurement stays accurate between re-measures.
          const result = prev.result
            ? {
                ...prev.result,
                breaks: prev.result.breaks.map((b) => ({ ...b, pos: tr.mapping.map(b.pos) })),
              }
            : prev.result;
          return { result, decorations: prev.decorations.map(tr.mapping, tr.doc) };
        }
        return prev;
      },
    },
    props: {
      decorations(state) {
        return paginationKey.getState(state)?.decorations ?? DecorationSet.empty;
      },
    },
    view(view) {
      return new PaginationView(view, options);
    },
  });
}

class PaginationView {
  private view: EditorView;
  private readonly options: PaginationOptions;
  private scheduled = false;
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(view: EditorView, options: PaginationOptions) {
    this.view = view;
    this.options = options;

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.schedule());
      this.resizeObserver.observe(view.dom);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onWindowResize);
    }
    // Images change block heights after they load.
    view.dom.addEventListener('load', this.onAssetLoad, true);

    options.register?.(() => this.schedule());
    this.schedule();
  }

  private readonly onWindowResize = () => this.schedule();
  private readonly onAssetLoad = (e: Event) => {
    if ((e.target as HTMLElement | null)?.tagName === 'IMG') this.schedule();
  };

  update(view: EditorView, prevState: EditorState) {
    this.view = view;
    if (view.state.doc !== prevState.doc) this.schedule();
  }

  private schedule() {
    if (this.scheduled || this.destroyed) return;
    this.scheduled = true;
    const raf =
      typeof requestAnimationFrame !== 'undefined'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16);
    raf(() => {
      this.scheduled = false;
      if (!this.destroyed) this.measure();
    });
  }

  private measure() {
    try {
      const geo = this.options.getGeometry();
      const bg = this.options.getBackgroundLayer();
      if (!geo || !bg || geo.contentHeightPx <= 0 || geo.pageHeightPx <= 0) {
        this.clearBackground(bg);
        return;
      }

      const current = paginationKey.getState(this.view.state)?.result ?? null;
      const blocks = this.measureBlocks(geo, current);
      const result = computePagination(blocks, {
        contentHeight: geo.contentHeightPx,
        interPageOffset: geo.interPageOffsetPx,
      });

      this.renderBackground(bg, geo, result);
      this.options.onPageCount?.(result.pageCount);

      if (!paginationEquals(result, current)) {
        this.view.dispatch(this.view.state.tr.setMeta(paginationKey, { result }));
      }
    } catch {
      // Measurement must never break editing — fall back to single-flow.
    }
  }

  /** Measure top-level blocks in spacer-independent natural coordinates. */
  private measureBlocks(geo: PaginationGeometry, current: PaginationResult | null): BlockMetric[] {
    const view = this.view;
    const contentRect = view.dom.getBoundingClientRect();
    const paddingTop = geo.marginTopPx;
    const currentBreaks = current?.breaks ?? [];

    const offsets: number[] = [];
    const naturalTops: number[] = [];
    const rectHeights: number[] = [];

    view.state.doc.forEach((_node, offset) => {
      let dom: Node | null = null;
      try {
        dom = view.nodeDOM(offset);
      } catch {
        dom = null;
      }
      if (!(dom instanceof HTMLElement)) return;
      const rect = dom.getBoundingClientRect();
      const renderedTop = rect.top - contentRect.top;
      let spacerBefore = 0;
      for (const br of currentBreaks) if (br.pos <= offset) spacerBefore += br.spacerHeight;
      offsets.push(offset);
      naturalTops.push(renderedTop - spacerBefore - paddingTop);
      rectHeights.push(rect.height);
    });

    const blocks: BlockMetric[] = [];
    for (let i = 0; i < offsets.length; i++) {
      // Use the gap to the next block (captures collapsed margins) as the height;
      // the last block uses its own rect height.
      const height =
        i < offsets.length - 1
          ? Math.max(rectHeights[i]!, naturalTops[i + 1]! - naturalTops[i]!)
          : rectHeights[i]!;
      blocks.push({ pos: offsets[i]!, top: naturalTops[i]!, height });
    }
    return blocks;
  }

  private renderBackground(bg: HTMLElement, geo: PaginationGeometry, result: PaginationResult) {
    while (bg.firstChild) bg.removeChild(bg.firstChild);

    const { pageContentTops, pageCount } = result;
    const headerCfg = this.options.header;
    const footerCfg = this.options.footer;

    for (let p = 0; p < pageCount; p++) {
      const sheetTop = pageContentTops[p] ?? p * (geo.contentHeightPx + geo.interPageOffsetPx);

      const sheet = document.createElement('div');
      sheet.className = 'rne-page-sheet';
      sheet.style.top = `${sheetTop}px`;
      sheet.style.height = `${geo.pageHeightPx}px`;
      sheet.style.width = `${geo.pageWidthPx}px`;
      bg.appendChild(sheet);

      if (headerCfg?.show && headerCfg.text) {
        bg.appendChild(
          this.runningElement(
            'rne-page-header',
            interpolate(headerCfg.text, p + 1, pageCount),
            sheetTop + geo.marginTopPx * 0.35,
            geo,
            headerCfg.align ?? 'left',
          ),
        );
      }

      const footerText =
        footerCfg?.text ?? (footerCfg?.pageNumbers ? 'Page {page} of {pages}' : undefined);
      if ((footerCfg?.show || footerCfg?.pageNumbers) && footerText) {
        bg.appendChild(
          this.runningElement(
            'rne-page-footer',
            interpolate(footerText, p + 1, pageCount),
            sheetTop + geo.pageHeightPx - geo.marginBottomPx * 0.6,
            geo,
            footerCfg.align ?? 'center',
          ),
        );
      }
    }

    const lastTop = pageContentTops[pageCount - 1] ?? 0;
    const totalHeight = lastTop + geo.pageHeightPx;
    bg.style.height = `${totalHeight}px`;
    const container = bg.parentElement;
    if (container) container.style.minHeight = `${totalHeight}px`;
  }

  private runningElement(
    className: string,
    text: string,
    top: number,
    geo: PaginationGeometry,
    align: 'left' | 'center' | 'right',
  ): HTMLElement {
    const el = document.createElement('div');
    el.className = className;
    el.textContent = text;
    el.style.position = 'absolute';
    el.style.top = `${top}px`;
    el.style.left = `${geo.marginLeftPx}px`;
    el.style.width = `${geo.contentWidthPx}px`;
    el.style.textAlign = align;
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  private clearBackground(bg: HTMLElement | null) {
    if (!bg) return;
    while (bg.firstChild) bg.removeChild(bg.firstChild);
    bg.style.height = '';
    const container = bg.parentElement;
    if (container) container.style.minHeight = '';
  }

  destroy() {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.onWindowResize);
    this.view.dom.removeEventListener('load', this.onAssetLoad, true);
  }
}

function interpolate(text: string, page: number, pages: number): string {
  return text.replace(/\{page\}/g, String(page)).replace(/\{pages\}/g, String(pages));
}
