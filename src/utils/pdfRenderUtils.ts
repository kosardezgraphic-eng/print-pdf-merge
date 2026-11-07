import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure pdfjs worker locally via Vite bundled URL so it works 100% offline in Electron & browser
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export interface PageAdjustment {
  brightness: number; // 100 is default (percent: 50% to 200%)
  contrast: number; // 100 is default (percent: 50% to 200%)
  grayscale: boolean; // convert to clean grayscale
  threshold: boolean; // black & white high contrast threshold for documents
  invert: boolean; // invert colors
  crop: {
    top: number; // percentage (0 to 40%)
    bottom: number;
    left: number;
    right: number;
  };
  rotation: number; // 0, 90, 180, 270
  fineAngle?: number; // fine deskew angle in degrees (-45 to +45)
  offsetX?: number; // Horizontal image position offset in percent (-50 to +50)
  offsetY?: number; // Vertical image position offset in percent (-50 to +50)
  scale?: number; // Image scale percent (50 to 200)
  selectedForPrint: boolean;
}

export const defaultAdjustment: PageAdjustment = {
  brightness: 100,
  contrast: 100,
  grayscale: false,
  threshold: false,
  invert: false,
  crop: { top: 0, bottom: 0, left: 0, right: 0 },
  rotation: 0,
  fineAngle: 0,
  offsetX: 0,
  offsetY: 0,
  scale: 100,
  selectedForPrint: true,
};

/**
 * Render a single specific page from a File with proper worker & memory cleanup
 */
export async function renderPdfPageToDataUrl(
  file: File,
  pageNumber: number,
  scale = 0.5
): Promise<{ dataUrl: string; width: number; height: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  try {
    pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(pageNumber);

    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (!context) {
      throw new Error('Canvas context not available');
    }

    // @ts-expect-error pdfjs typing
    await page.render({ canvasContext: context, viewport }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    // Free canvas memory
    canvas.width = 0;
    canvas.height = 0;

    return {
      dataUrl,
      width: viewport.width,
      height: viewport.height,
    };
  } finally {
    if (pdfDoc) {
      try {
        pdfDoc.cleanup();
      } catch {}
    }
    try {
      loadingTask.destroy();
    } catch {}
  }
}

/**
 * High-performance batch PDF renderer for multiple pages from a single file.
 * Opens PDF document once, renders all requested pages, and cleans up memory completely.
 */
export async function renderPdfPagesBatch(
  file: File,
  pageNumbers: number[],
  scale = 1.0,
  onPageProgress?: (pageIndex: number, total: number) => void
): Promise<Map<number, { dataUrl: string; width: number; height: number }>> {
  const results = new Map<number, { dataUrl: string; width: number; height: number }>();
  if (pageNumbers.length === 0) return results;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;

  try {
    pdfDoc = await loadingTask.promise;

    for (let i = 0; i < pageNumbers.length; i++) {
      const pNum = pageNumbers[i];
      try {
        const page = await pdfDoc.getPage(pNum);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (context) {
          // @ts-expect-error pdfjs typing
          await page.render({ canvasContext: context, viewport }).promise;
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          results.set(pNum, {
            dataUrl,
            width: viewport.width,
            height: viewport.height,
          });

          // Memory cleanup for canvas
          canvas.width = 0;
          canvas.height = 0;
        }
      } catch (err) {
        console.warn(`Error rendering page ${pNum} of file ${file.name}:`, err);
      }

      onPageProgress?.(i + 1, pageNumbers.length);
      // Yield to main thread every page so browser stays responsive and GC can run
      await new Promise((r) => setTimeout(r, 5));
    }
  } finally {
    if (pdfDoc) {
      try {
        pdfDoc.cleanup();
      } catch {}
    }
    try {
      loadingTask.destroy();
    } catch {}
  }

  return results;
}
