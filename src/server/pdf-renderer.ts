import type { PdfRenderer } from './types';

/**
 * Headless-browser PDF renderers (F-6.14). Playwright/Puppeteer are NOT
 * dependencies of this package — install whichever you use. The factories
 * lazily import the engine and throw a clear, actionable error if it is absent,
 * so the rest of the export service works without them.
 *
 * Both render the SAME shared print HTML the client uses, so server PDFs match
 * the on-screen document and client output (F-6.11).
 */

interface BrowserLike {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
}
interface PageLike {
  setContent(html: string, options?: Record<string, unknown>): Promise<void>;
  pdf(options?: Record<string, unknown>): Promise<Uint8Array | Buffer>;
  close(): Promise<void>;
}

export interface PlaywrightPdfOptions {
  /** Print background colors/images. Default true. */
  printBackground?: boolean;
  /** Honour the document's `@page` size rules. Default true. */
  preferCSSPageSize?: boolean;
  /** Launch arguments forwarded to chromium. */
  launchArgs?: string[];
}

/**
 * PDF renderer backed by Playwright's bundled Chromium. Requires `playwright`
 * to be installed in the host. The browser is launched lazily and reused;
 * call `close()` to release it.
 */
export function createPlaywrightPdfRenderer(options: PlaywrightPdfOptions = {}): PdfRenderer {
  let browserPromise: Promise<BrowserLike> | null = null;

  async function getBrowser(): Promise<BrowserLike> {
    if (!browserPromise) {
      browserPromise = (async () => {
        let mod: { chromium?: { launch(opts?: Record<string, unknown>): Promise<BrowserLike> } };
        try {
          // Variable specifier so the optional, possibly-absent dep is not
          // resolved at type-check/build time.
          const spec = 'playwright';
          mod = (await import(spec)) as typeof mod;
        } catch {
          throw new Error(
            "react-next-editor: server PDF requires 'playwright'. Install it (npm i playwright) " +
              'or provide a custom PdfRenderer.',
          );
        }
        if (!mod.chromium) throw new Error('react-next-editor: playwright.chromium is unavailable.');
        return mod.chromium.launch({ args: options.launchArgs ?? [] });
      })();
    }
    return browserPromise;
  }

  return {
    async render(html, _opts) {
      const browser = await getBrowser();
      const page = await browser.newPage();
      try {
        await page.setContent(html, { waitUntil: 'networkidle' });
        const buffer = await page.pdf({
          printBackground: options.printBackground ?? true,
          preferCSSPageSize: options.preferCSSPageSize ?? true,
        });
        return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      } finally {
        await page.close();
      }
    },
    async close() {
      if (browserPromise) {
        const browser = await browserPromise;
        await browser.close();
        browserPromise = null;
      }
    },
  };
}

/**
 * PDF renderer backed by Puppeteer. Requires `puppeteer` to be installed.
 * Equivalent behaviour to the Playwright renderer.
 */
export function createPuppeteerPdfRenderer(options: PlaywrightPdfOptions = {}): PdfRenderer {
  let browserPromise: Promise<BrowserLike> | null = null;

  async function getBrowser(): Promise<BrowserLike> {
    if (!browserPromise) {
      browserPromise = (async () => {
        let mod: { default?: { launch(opts?: Record<string, unknown>): Promise<BrowserLike> } };
        try {
          // Variable specifier so the optional, possibly-absent dep is not
          // resolved at type-check/build time.
          const spec = 'puppeteer';
          mod = (await import(spec)) as typeof mod;
        } catch {
          throw new Error(
            "react-next-editor: server PDF requires 'puppeteer'. Install it (npm i puppeteer) " +
              'or provide a custom PdfRenderer.',
          );
        }
        const launcher = mod.default;
        if (!launcher) throw new Error('react-next-editor: puppeteer launcher is unavailable.');
        return launcher.launch({ args: options.launchArgs ?? [] });
      })();
    }
    return browserPromise;
  }

  return {
    async render(html, _opts) {
      const browser = await getBrowser();
      const page = await browser.newPage();
      try {
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const buffer = await page.pdf({
          printBackground: options.printBackground ?? true,
          preferCSSPageSize: options.preferCSSPageSize ?? true,
        });
        return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      } finally {
        await page.close();
      }
    },
    async close() {
      if (browserPromise) {
        const browser = await browserPromise;
        await browser.close();
        browserPromise = null;
      }
    },
  };
}
