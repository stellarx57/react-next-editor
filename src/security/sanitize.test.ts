import { describe, expect, it } from 'vitest';
import { sanitizeImageSrc, sanitizeUrl } from './sanitize';

describe('sanitizeUrl', () => {
  it('accepts safe schemes and relative URLs', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
    expect(sanitizeUrl('http://example.com/path?q=1#h')).toBe('http://example.com/path?q=1#h');
    expect(sanitizeUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(sanitizeUrl('tel:+123')).toBe('tel:+123');
    expect(sanitizeUrl('/relative/path')).toBe('/relative/path');
    expect(sanitizeUrl('#anchor')).toBe('#anchor');
    expect(sanitizeUrl('./rel')).toBe('./rel');
  });

  it('upgrades protocol-relative URLs to https', () => {
    expect(sanitizeUrl('//cdn.example.com/x')).toBe('https://cdn.example.com/x');
  });

  it('rejects dangerous schemes including obfuscated ones', () => {
    // eslint-disable-next-line no-script-url
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBeNull();
    expect(sanitizeUrl('data:text/html,<script>')).toBeNull();
    expect(sanitizeUrl('file:///etc/passwd')).toBeNull();
    // Obfuscation with control characters / spaces inside the scheme.
    expect(sanitizeUrl('java\tscript:alert(1)')).toBeNull();
    expect(sanitizeUrl(' javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('JaVaScRiPt:alert(1)')).toBeNull();
  });

  it('rejects empty/nullish input', () => {
    expect(sanitizeUrl('')).toBeNull();
    expect(sanitizeUrl(null)).toBeNull();
    expect(sanitizeUrl(undefined)).toBeNull();
  });
});

describe('sanitizeImageSrc', () => {
  it('accepts http(s)/blob and raster data URIs', () => {
    expect(sanitizeImageSrc('https://x.io/a.png')).toBe('https://x.io/a.png');
    expect(sanitizeImageSrc('blob:https://x.io/abc')).toBe('blob:https://x.io/abc');
    expect(sanitizeImageSrc('data:image/png;base64,iVBORw0KGgo=')).toBe(
      'data:image/png;base64,iVBORw0KGgo=',
    );
  });

  it('rejects SVG and script-bearing data URIs', () => {
    expect(sanitizeImageSrc('data:image/svg+xml,<svg onload=alert(1)>')).toBeNull();
    expect(sanitizeImageSrc('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    // eslint-disable-next-line no-script-url
    expect(sanitizeImageSrc('javascript:alert(1)')).toBeNull();
  });
});
