/**
 * Pure page-break computation for visual pagination (F-5.3). Given the measured
 * positions/heights of the document's top-level blocks (in a single, un-paginated
 * flow) and the page geometry, it computes where pages break and where each
 * page's content sits in the rendered (spaced) layout.
 *
 * This function is intentionally DOM-free and deterministic so it can be tested
 * exhaustively. The plugin supplies real measurements; here we only do math.
 *
 * Breaks occur at *block boundaries* (a block that would overflow the current
 * page is pushed to the next page). A single block taller than a page is left in
 * place and allowed to overflow — it is never split (no line-level layout), which
 * keeps the algorithm robust and the document model untouched.
 */

export interface BlockMetric {
  /** ProseMirror position immediately before the block (where a spacer mounts). */
  pos: number;
  /** Natural top offset of the block (px), in the un-paginated flow. */
  top: number;
  /** Block height (px), including its own vertical margins. */
  height: number;
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
  /** Position before the block that starts the new page. */
  pos: number;
  /** Height of the spacer widget to insert before that block (px). */
  spacerHeight: number;
  /** 0-based index of the page this break begins. */
  pageIndex: number;
}

export interface PaginationResult {
  breaks: PageBreak[];
  pageCount: number;
  /** Rendered Y (px) where each page's content begins (page 0 at 0). */
  pageContentTops: number[];
}

const EPS = 0.5;

export function computePagination(
  blocks: BlockMetric[],
  geo: PageGeometry,
): PaginationResult {
  const contentHeight = Math.max(1, geo.contentHeight);
  const interPageOffset = Math.max(0, geo.interPageOffset);

  const breaks: PageBreak[] = [];
  const pageContentTops: number[] = [0];

  let pageStart = 0; // natural top where the current page's content begins
  let cumSpacer = 0; // total spacer height inserted so far
  let pageIndex = 0;

  for (const block of blocks) {
    if (!Number.isFinite(block.top) || !Number.isFinite(block.height)) continue;
    const top = block.top;
    const bottom = top + block.height;

    const overflows = bottom - pageStart > contentHeight + EPS;
    const startsBelowPageTop = top - pageStart > EPS;

    if (overflows && startsBelowPageTop) {
      const usedHeight = top - pageStart;
      const spacerHeight = Math.max(0, contentHeight - usedHeight) + interPageOffset;
      pageIndex += 1;
      cumSpacer += spacerHeight;
      breaks.push({ pos: block.pos, spacerHeight, pageIndex });
      // The new page's content begins at this block; its rendered top is the
      // block's natural top plus all spacers inserted up to and including this one.
      pageContentTops.push(top + cumSpacer);
      pageStart = top;
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
