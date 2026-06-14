import { describe, expect, it } from 'vitest';
import { cssAlign, cssFontFamily, cssInteger, cssNumber, normalizeCssColor } from './css';
import { defaultSchema } from '../core/schema/schema';
import { documentToHtml } from '../export/html';
import type { DocumentJSON } from '../config/types';

describe('css value sanitization', () => {
  it('validates alignment keywords', () => {
    expect(cssAlign('center')).toBe('center');
    expect(cssAlign('left;background:url(//evil)')).toBeNull();
    expect(cssAlign(42)).toBeNull();
  });

  it('coerces numbers and rejects injection strings', () => {
    expect(cssNumber('12', 1, 100)).toBe(12);
    expect(cssNumber(5, 1, 100)).toBe(5);
    expect(cssNumber('0;background:url(x)', 1, 100)).toBeNull();
    expect(cssNumber('999', 1, 100)).toBe(100); // clamped
    expect(cssInteger('3.7', 0, 12)).toBe(4);
  });

  it('validates colors and rejects url()/expression()', () => {
    expect(normalizeCssColor('#df4a36')).toBe('#df4a36');
    expect(normalizeCssColor('rgb(10, 20, 30)')).toBe('rgb(10, 20, 30)');
    expect(normalizeCssColor('red')).toBe('red');
    expect(normalizeCssColor('url(//evil)')).toBeNull();
    expect(normalizeCssColor('red;background:url(x)')).toBeNull();
    expect(normalizeCssColor('expression(alert(1))')).toBeNull();
  });

  it('sanitizes font-family to a safe character set', () => {
    expect(cssFontFamily('Times New Roman')).toBe('Times New Roman');
    expect(cssFontFamily('Arial, sans-serif')).toBe('Arial, sans-serif');
    expect(cssFontFamily('x;background:url(//evil)')).toBe('xbackgroundurlevil');
    expect(cssFontFamily('"})')).toBeNull();
  });
});

describe('CSS injection is neutralized in toDOM (live editor)', () => {
  it('drops a malicious block align value', () => {
    const node = defaultSchema.nodes.paragraph.create({
      align: 'left;background:url(//evil/x.png)',
      indent: 0,
      lineHeight: null,
    });
    const dom = defaultSchema.nodes.paragraph.spec.toDOM!(node) as [string, Record<string, string>];
    const style = dom[1].style ?? '';
    expect(style).not.toContain('url(');
    expect(style).not.toContain('background');
  });

  it('drops a malicious image width value', () => {
    const node = defaultSchema.nodes.image.create({
      src: 'https://x.io/a.png',
      width: '0;background:url(//evil)' as unknown as number,
      alt: null,
      title: null,
    });
    const dom = defaultSchema.nodes.image.spec.toDOM!(node) as [string, Record<string, string>];
    const style = dom[1].style ?? '';
    expect(style).not.toContain('url(');
    expect(style).not.toContain('background');
  });

  it('drops a malicious font-size mark value', () => {
    const mark = defaultSchema.marks.fontSize.create({ size: '12;background:url(x)' });
    const dom = defaultSchema.marks.fontSize.spec.toDOM!(mark, true) as [
      string,
      Record<string, string>,
    ];
    // Invalid size → plain span with no style.
    expect(dom[1].style ?? '').toBe('');
  });
});

describe('CSS injection is neutralized in the HTML/PDF serializer', () => {
  it('omits injected align/color/width from exported HTML', () => {
    const doc: DocumentJSON = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { align: 'left;background:url(//evil)', indent: 0, lineHeight: null },
          content: [
            {
              type: 'text',
              marks: [{ type: 'textColor', attrs: { color: 'red;background:url(//evil)' } }],
              text: 'x',
            },
            { type: 'image', attrs: { src: 'https://x.io/a.png', width: '0;background:url(//evil)' } },
          ],
        },
      ],
    };
    const html = documentToHtml(doc);
    expect(html).not.toContain('url(');
    expect(html).not.toContain('background:');
  });
});
