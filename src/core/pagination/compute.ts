/**
 * Pure page-break computation for visual pagination (F-5.3). Given the measured
 * positions/heights of the document's content (in a single, un-paginated flow)
 * and the page geometry, it computes where pages break and where each page's
 * content sits in the rendered (spaced) layout.
 *
 * This function is intentionally DOM-free and deterministic so it can be tested
 * exhaustively. The plugin supplies real measurements; here we only do math.
 *
 * Breaking is **unit-based**. A short block is a single unit (it moves to the
 * next page whole). A tall text block supplies its individual **lines**, so the
 * algorithm can break *inside* it at a line boundary — content flows across
 * pages instead of overflowing (line-level splitting). The document model is
 * never touched; breaks are realized as widget-decoration spacers.
 *
 * The only residual case is a *single unit* (one line, or an unsplittable atom
 * such as an image or table row) taller than a whole page: it cannot be divided
 * and is left to overflow in place.
 */

/** A breakable unit: either a whole block or one line within a tall block. */
export interface LineMetric {
  /** ProseMirror position where a spacer mounts to push this line down. */
  pos: number;
  /** Natural top offset of the line (px), in the un-paginated flow. */
  top: number;
  /** Line height (px). */
  height: number;
}

export interface BlockMetric {
  /** ProseMirror position immediately before the block (where a spacer mounts). */
  pos: number;
  /** Natural top offset of the block (px), in the un-paginated flow. */
  top: number;
  /** Block height (px), including its own vertical margins. */
  height: number;
  /**
   * Optional line metrics for a tall, splittable text block. When present (and
   * containing more than one line) the block is broken at line boundaries rather
   * than moved whole.
   */
  lines?: LineMetric[];
}

export interface PageGeometry {
  /** Usable content height per page (px) = page height − top/bottom margins. */
  contentHeight: number;
  /**
   * Vertical distance (px) between one page's content bottom and the next page's
   * content top in the rendered layout = bottom margin + page gap + top margin.
   */
  interPageOffset: number;
}

export interface PageBreak {
  /** Position before the unit that starts the new page. */
  pos: number;
  /** Height of the spacer widget to insert before that unit (px). */
  spacerHeight: number;
  /** 0-based index of the page this break begins. */
  pageIndex: number;
  /** True when the break falls inside a block (between lines) rather than at a block boundary. */
  inline: boolean;
}

export interface PaginationResult {
  breaks: PageBreak[];
  pageCount: number;
  /** Rendered Y (px) where each page's content begins (page 0 at 0). */
  pageContentTops: number[];
}

interface Unit {
  pos: number;
  top: number;
  height: number;
  inline: boolean;
}

const EPS = 0.5;

/** Flatten blocks into an ordered list of breakable units (lines or blocks). */
function toUnits(blocks: BlockMetric[]): Unit[] {
  const units: Unit[] = [];
  for (const block of blocks) {
    if (!Number.isFinite(block.top) || !Number.isFinite(block.height)) continue;
    if (block.lines && block.lines.length > 1) {
      block.lines.forEach((line, i) => {
        if (!Number.isFinite(line.top) || !Number.isFinite(line.height)) return;
        // The first line breaks at the block boundary; later lines break inline.
        units.push({ pos: line.pos, top: line.top, height: line.height, inline: i > 0 });
      });
    } else {
      units.push({ pos: block.pos, top: block.top, height: block.height, inline: false });
    }
  }
  units.sort((a, b) => a.top - b.top);
  return units;
}

export function computePagination(blocks: BlockMetric[], geo: PageGeometry): PaginationResult {
  const contentHeight = Math.max(1, geo.contentHeight);
  const interPageOffset = Math.max(0, geo.interPageOffset);

  const units = toUnits(blocks);
  const breaks: PageBreak[] = [];
  const pageContentTops: number[] = [0];

  let pageStart = 0; // natural top where the current page's content begins
  let cumSpacer = 0; // total spacer height inserted so far
  let pageIndex = 0;

  for (const unit of units) {
    const bottom = unit.top + unit.height;
    const overflows = bottom - pageStart > contentHeight + EPS;
    const startsBelowPageTop = unit.top - pageStart > EPS;

    if (overflows && startsBelowPageTop) {
      const usedHeight = unit.top - pageStart;
      const spacerHeight = Math.max(0, contentHeight - usedHeight) + interPageOffset;
      pageIndex += 1;
      cumSpacer += spacerHeight;
      breaks.push({ pos: unit.pos, spacerHeight, pageIndex, inline: unit.inline });
      // The new page's content begins at this unit; its rendered top is the
      // unit's natural top plus all spacers inserted up to and including this one.
      pageContentTops.push(unit.top + cumSpacer);
      pageStart = unit.top;
    }
  }

  return { breaks, pageCount: pageIndex + 1, pageContentTops };
}

/** Whether two pagination results are equivalent (avoids redundant re-renders). */
export function paginationEquals(a: PaginationResult | null, b: PaginationResult | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.pageCount !== b.pageCount || a.breaks.length !== b.breaks.length) return false;
  for (let i = 0; i < a.breaks.length; i++) {
    const x = a.breaks[i]!;
    const y = b.breaks[i]!;
    if (x.pos !== y.pos || Math.abs(x.spacerHeight - y.spacerHeight) > 1) return false;
  }
  return true;
}
