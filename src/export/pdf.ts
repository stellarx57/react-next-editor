import type { DocumentJSON, PageConfig } from '../config/types';
import { DEFAULT_PAGE } from '../config/defaults';
import { buildPrintDocument } from './html';

export interface PdfPrintOptions {
  page?: PageConfig;
  title?: string;
}

/**
 * Client-side PDF export via the browser's print-to-PDF (§8.4). Renders the
 * shared print HTML (matching the on-screen document and the server renderer)
 * into a hidden iframe and invokes print. Vector output with selectable text,
 * works fully offline, no server round-trip (F-6.3, F-6.4, NF-8).
 *
 * Resolves once printing has been initiated. The user chooses "Save as PDF" in
 * the browser's print dialog.
 */
export function printDocumentToPdf(doc: DocumentJSON, options: PdfPrintOptions = {}): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('printDocumentToPdf requires a browser environment.'));
  }
  const page = options.page ?? DEFAULT_PAGE;
  const html = buildPrintDocument(doc, page, options.title);

  return new Promise<void>((resolve, reject) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const cleanup = () => {
        // Delay removal so the print dialog can read the document.
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1000);
      };

      const win = iframe.contentWindow;
      const docu = iframe.contentDocument || win?.document;
      if (!win || !docu) {
        cleanup();
        reject(new Error('Unable to access print frame document.'));
        return;
      }

      docu.open();
      docu.write(html);
      docu.close();

      const doPrint = () => {
        try {
          win.focus();
          win.print();
          resolve();
        } catch (err) {
          reject(err as Error);
        } finally {
          cleanup();
        }
      };

      // Give the frame a tick to lay out before printing.
      if (docu.readyState === 'complete') {
        setTimeout(doPrint, 50);
      } else {
        iframe.addEventListener('load', () => setTimeout(doPrint, 50), { once: true });
      }
    } catch (err) {
      reject(err as Error);
    }
  });
}

export { buildPrintDocument, printStylesheet } from './html';
