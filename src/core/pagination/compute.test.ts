import { describe, expect, it } from 'vitest';
import { computePagination, paginationEquals, type BlockMetric } from './compute';

/** Build evenly-stacked blocks of a given height. */
function stack(count: number, height: number, startPos = 1): BlockMetric[] {
  const blocks: BlockMetric[] = [];
  let top = 0;
  let pos = startPos;
  for (let i = 0; i < count; i++) {
    blocks.push({ pos, top, height });
    top += height;
    pos += 10;
  }
  return blocks;
}

const geo = { contentHeight: 1000, interPageOffset: 200 };

describe('computePagination', () => {
  it('returns a single page when content fits', () => {
    const result = computePagination(stack(5, 100), geo); // 500px < 1000px
    expect(result.pageCount).toBe(1);
    expect(result.breaks).toHaveLength(0);
    expect(result.pageContentTops).toEqual([0]);
  });

  it('handles an empty document', () => {
    const result = computePagination([], geo);
    expect(result.pageCount).toBe(1);
    expect(result.breaks).toHaveLength(0);
    expect(result.pageContentTops).toEqual([0]);
  });

  it('breaks before the block that overflows the page', () => {
    // 11 blocks × 100px = 1100px. Page content height 1000px.
    // Blocks 0..9 occupy 0..1000 (fit). Block 10 (top 1000) overflows → break.
    const result = computePagination(stack(11, 100), geo);
    expect(result.pageCount).toBe(2);
    expect(result.breaks).toHaveLength(1);
    const br = result.breaks[0]!;
    expect(br.pageIndex).toBe(1);
    // Block 10 starts exactly at 1000 (== pageStart 0 + contentHeight) — but
    // 1000 - 0 = contentHeight, bottom 1100 > 1000 so it overflows; usedHeight
    // = 1000, spacer = max(0, 1000-1000) + 200 = 200.
    expect(br.spacerHeight).toBe(200);
  });

  it('fills the remaining space when a block breaks mid-page', () => {
    // Blocks: 0(0..600,h600), 1(600..1300,h700). Block1 overflows at pageStart 0
    // (1300>1000), starts below top (600>0) → break. usedHeight=600,
    // spacer = (1000-600) + 200 = 600.
    const blocks: BlockMetric[] = [
      { pos: 1, top: 0, height: 600 },
      { pos: 11, top: 600, height: 700 },
    ];
    const result = computePagination(blocks, geo);
    expect(result.pageCount).toBe(2);
    expect(result.breaks[0]!.spacerHeight).toBe(600);
    // Page 1 content begins at natural 600 + spacer 600 = 1200 = 1*(1000+200).
    expect(result.pageContentTops).toEqual([0, 1200]);
  });

  it('paginates many pages with aligned content tops', () => {
    // 30 blocks × 100 = 3000px over 1000px pages → 3 pages.
    const result = computePagination(stack(30, 100), geo);
    expect(result.pageCount).toBe(3);
    expect(result.pageContentTops).toEqual([0, 1200, 2400]);
  });

  it('does not split a block taller than a page; it overflows in place', () => {
    // Block 0 is 1500px (taller than 1000px page). It starts at page top, so no
    // break before it; block 1 follows.
    const blocks: BlockMetric[] = [
      { pos: 1, top: 0, height: 1500 },
      { pos: 11, top: 1500, height: 100 },
    ];
    const result = computePagination(blocks, geo);
    // Block 1 (top 1500) overflows page 0 (1600 > 1000, starts below top) → break.
    expect(result.pageCount).toBe(2);
    expect(result.breaks).toHaveLength(1);
    expect(result.breaks[0]!.pos).toBe(11);
    // usedHeight = 1500 (> contentHeight) → spacer = max(0, 1000-1500)+200 = 200.
    expect(result.breaks[0]!.spacerHeight).toBe(200);
  });

  it('ignores non-finite metrics defensively', () => {
    const blocks: BlockMetric[] = [
      { pos: 1, top: 0, height: 100 },
      { pos: 11, top: NaN, height: 100 },
      { pos: 21, top: 200, height: 100 },
    ];
    expect(() => computePagination(blocks, geo)).not.toThrow();
  });

  it('clamps degenerate geometry without dividing by zero', () => {
    const result = computePagination(stack(3, 100), { contentHeight: 0, interPageOffset: -50 });
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(result.pageContentTops[0]!)).toBe(true);
  });
});

describe('paginationEquals', () => {
  it('detects equal and differing results', () => {
    const a = computePagination(stack(30, 100), geo);
    const b = computePagination(stack(30, 100), geo);
    const c = computePagination(stack(40, 100), geo);
    expect(paginationEquals(a, b)).toBe(true);
    expect(paginationEquals(a, c)).toBe(false);
    expect(paginationEquals(a, null)).toBe(false);
    expect(paginationEquals(null, null)).toBe(true);
  });
});
