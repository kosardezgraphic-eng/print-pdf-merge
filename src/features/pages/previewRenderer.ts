import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as UTIF from 'utif';
import {
  cacheLosslessPngFrame,
  getCachedLosslessPngFrame,
  getSourceBytes,
  getSourceFromVault,
} from './fileVault';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

const MAX_OPEN_PDF_DOCS = 8;
const MAX_CACHED_IMAGES = 240;
const MAX_CONCURRENT_RENDERS = 2;

const pdfDocLru = new Map<
  string,
  { doc: pdfjsLib.PDFDocumentProxy; task: pdfjsLib.PDFDocumentLoadingTask }
>();
const dataUrlLru = new Map<string, string>();
const inflightRenders = new Map<string, Promise<string>>();

let activeRenderCount = 0;
const renderWaitQueue: Array<() => void> = [];

function acquireRenderSlot(): Promise<void> {
  if (activeRenderCount < MAX_CONCURRENT_RENDERS) {
    activeRenderCount++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    renderWaitQueue.push(() => {
      activeRenderCount++;
      resolve();
    });
  });
}

function releaseRenderSlot(): void {
  activeRenderCount = Math.max(0, activeRenderCount - 1);
  const next = renderWaitQueue.shift();
  if (next) next();
}

function putLruImage(key: string, dataUrl: string): void {
  if (dataUrlLru.has(key)) {
    dataUrlLru.delete(key);
  }
  dataUrlLru.set(key, dataUrl);
  while (dataUrlLru.size > MAX_CACHED_IMAGES) {
    const oldestKey = dataUrlLru.keys().next().value;
    if (oldestKey === undefined) break;
    dataUrlLru.delete(oldestKey);
  }
}

export function getCachedRenderUrl(
  sourceFileId: string,
  sourcePageIndex: number,
  tier: 'thumb' | 'sheet'
): string | undefined {
  const key = `${sourceFileId}:${sourcePageIndex}:${tier}`;
  const hit = dataUrlLru.get(key);
  if (hit) {
    // Refresh LRU order
    dataUrlLru.delete(key);
    dataUrlLru.set(key, hit);
  }
  return hit;
}

export async function getOpenPdfProxy(sourceFileId: string): Promise<pdfjsLib.PDFDocumentProxy> {
  const existing = pdfDocLru.get(sourceFileId);
  if (existing) {
    pdfDocLru.delete(sourceFileId);
    pdfDocLru.set(sourceFileId, existing);
    return existing.doc;
  }

  const rawBytes = await getSourceBytes(sourceFileId);
  // Copy slice because pdf.js worker transfers the underlying ArrayBuffer!
  const copyForWorker = rawBytes.slice();
  const task = pdfjsLib.getDocument({ data: copyForWorker });
  const doc = await task.promise;

  pdfDocLru.set(sourceFileId, { doc, task });
  while (pdfDocLru.size > MAX_OPEN_PDF_DOCS) {
    const oldestId = pdfDocLru.keys().next().value;
    if (oldestId === undefined) break;
    const evicted = pdfDocLru.get(oldestId);
    pdfDocLru.delete(oldestId);
    if (evicted) {
      try {
        await evicted.doc.cleanup();
        await evicted.task.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  return doc;
}

export function evictPdfProxyCache(sourceFileId?: string): void {
  if (sourceFileId) {
    const entry = pdfDocLru.get(sourceFileId);
    pdfDocLru.delete(sourceFileId);
    if (entry) {
      void entry.doc.cleanup().catch(() => {});
      void entry.task.destroy().catch(() => {});
    }
    for (const k of Array.from(dataUrlLru.keys())) {
      if (k.startsWith(`${sourceFileId}:`)) {
        dataUrlLru.delete(k);
      }
    }
    return;
  }

  for (const entry of pdfDocLru.values()) {
    void entry.doc.cleanup().catch(() => {});
    void entry.task.destroy().catch(() => {});
  }
  pdfDocLru.clear();
  dataUrlLru.clear();
}

/**
 * Convert an image frame (including TIFF/WebP/BMP) to lossless PNG Uint8Array for pdf-lib embedding.
 */
export async function decodeImageFrameToLosslessPng(
  sourceFileId: string,
  frameIndex: number
): Promise<Uint8Array> {
  const cached = getCachedLosslessPngFrame(sourceFileId, frameIndex);
  if (cached) return cached;

  const entry = getSourceFromVault(sourceFileId);
  if (!entry) {
    throw new Error('فایل تصویر در حافظه برنامه یافت نشد.');
  }
  const rawBytes = await getSourceBytes(sourceFileId);

  if (entry.meta.imageFormat === 'tiff') {
    const ifds = UTIF.decode(rawBytes);
    const ifd = ifds[frameIndex] ?? ifds[0];
    if (!ifd) {
      throw new Error(`فریم شماره ${frameIndex + 1} در فایل TIFF قابل خواندن نیست.`);
    }
    UTIF.decodeImage(rawBytes, ifd);
    const rgba = UTIF.toRGBA8(ifd);
    const canvas = document.createElement('canvas');
    canvas.width = ifd.width;
    canvas.height = ifd.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('امکان ایجاد بوم پردازش تصویر وجود ندارد.');
    const imgData = new ImageData(new Uint8ClampedArray(rgba), ifd.width, ifd.height);
    ctx.putImageData(imgData, 0, 0);

    const pngBytes = await canvasToPngBytes(canvas);
    canvas.width = 0;
    canvas.height = 0;
    cacheLosslessPngFrame(sourceFileId, frameIndex, pngBytes);
    return pngBytes;
  }

  // Browser-decodable raster formats (WebP, BMP, or fallback) -> 1:1 lossless PNG
  const blob = new Blob([rawBytes.slice().buffer], { type: entry.meta.mimeType || 'image/png' });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await loadHtmlImage(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('امکان پردازش تصویر وجود ندارد.');
    ctx.drawImage(img, 0, 0);
    const pngBytes = await canvasToPngBytes(canvas);
    canvas.width = 0;
    canvas.height = 0;
    cacheLosslessPngFrame(sourceFileId, frameIndex, pngBytes);
    return pngBytes;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('خطا در تبدیل بدون افت تصویر به PNG'));
          return;
        }
        const ab = await blob.arrayBuffer();
        resolve(new Uint8Array(ab));
      },
      'image/png'
    );
  });
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('خطا در بارگذاری تصویر ورودی'));
    img.src = url;
  });
}

/**
 * Render a page/image ONLY for on-screen thumbnail or live sheet preview (never used for print/PDF!).
 * Uses concurrency throttling and LRU caching so 500-page PDFs stay silky smooth.
 */
export async function renderPagePreviewUrl(
  sourceFileId: string,
  sourcePageIndex: number,
  tier: 'thumb' | 'sheet'
): Promise<string> {
  const cacheKey = `${sourceFileId}:${sourcePageIndex}:${tier}`;
  const cached = getCachedRenderUrl(sourceFileId, sourcePageIndex, tier);
  if (cached) return cached;

  const existingPromise = inflightRenders.get(cacheKey);
  if (existingPromise) return existingPromise;

  const taskPromise = (async () => {
    await acquireRenderSlot();
    try {
      const again = getCachedRenderUrl(sourceFileId, sourcePageIndex, tier);
      if (again) return again;

      const entry = getSourceFromVault(sourceFileId);
      if (!entry) throw new Error('فایل یافت نشد');

      const targetMaxPx = tier === 'thumb' ? 260 : 1100;
      let dataUrl: string;

      if (entry.meta.kind === 'pdf') {
        const pdfDoc = await getOpenPdfProxy(sourceFileId);
        const page = await pdfDoc.getPage(sourcePageIndex + 1);
        const baseViewport = page.getViewport({ scale: 1 });
        const maxSide = Math.max(baseViewport.width, baseViewport.height, 1);
        const scale = Math.min(2.5, Math.max(0.25, targetMaxPx / maxSide));
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, canvas, viewport }).promise;
        dataUrl = canvas.toDataURL('image/webp', tier === 'thumb' ? 0.8 : 0.9);
        canvas.width = 0;
        canvas.height = 0;
      } else if (entry.meta.imageFormat === 'tiff') {
        const pngBytes = await decodeImageFrameToLosslessPng(sourceFileId, sourcePageIndex);
        const blob = new Blob([pngBytes.slice().buffer], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        try {
          const img = await loadHtmlImage(url);
          dataUrl = scaleImageToPreviewUrl(img, targetMaxPx, tier);
        } finally {
          URL.revokeObjectURL(url);
        }
      } else {
        const rawBytes = await getSourceBytes(sourceFileId);
        const blob = new Blob([rawBytes.slice().buffer], {
          type: entry.meta.mimeType || 'image/jpeg',
        });
        const url = URL.createObjectURL(blob);
        try {
          const img = await loadHtmlImage(url);
          dataUrl = scaleImageToPreviewUrl(img, targetMaxPx, tier);
        } finally {
          URL.revokeObjectURL(url);
        }
      }

      putLruImage(cacheKey, dataUrl);
      return dataUrl;
    } finally {
      inflightRenders.delete(cacheKey);
      releaseRenderSlot();
    }
  })();

  inflightRenders.set(cacheKey, taskPromise);
  return taskPromise;
}

function scaleImageToPreviewUrl(
  img: HTMLImageElement,
  targetMaxPx: number,
  tier: 'thumb' | 'sheet'
): string {
  const nw = Math.max(1, img.naturalWidth || img.width);
  const nh = Math.max(1, img.naturalHeight || img.height);
  const ratio = Math.min(1, targetMaxPx / Math.max(nw, nh));
  const w = Math.max(1, Math.round(nw * ratio));
  const h = Math.max(1, Math.round(nh * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL('image/webp', tier === 'thumb' ? 0.8 : 0.92);
  canvas.width = 0;
  canvas.height = 0;
  return out;
}
