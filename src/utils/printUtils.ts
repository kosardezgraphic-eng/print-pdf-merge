import { PDFItem, PrintSettings, PageAdjustment, PAPER_DIMENSIONS_MM } from '../types';
import { renderPdfPageToDataUrl, renderPdfPagesBatch } from './pdfRenderUtils';
import {
  buildImposedSheets,
  renderImposedSheetCanvas,
  calculateBookletPageOrder,
  GridCellData,
} from './gridImpositionUtils';
import { renderOverlaysOnCanvas } from './overlayRenderUtils';

/**
 * Apply canvas brightness, contrast, grayscale, invert, crop, and overlay texts/shapes/numbering
 */
export async function processPageForPrint(
  dataUrl: string,
  width: number,
  height: number,
  adj: PageAdjustment,
  pageNum: number = 1,
  totalPages: number = 1
): Promise<string> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {}
  }

  const img = new Image();
  img.src = dataUrl;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  // Calculate crop rectangle in physical pixels
  const cropLeft = (adj.crop.left / 100) * width;
  const cropRight = (adj.crop.right / 100) * width;
  const cropTop = (adj.crop.top / 100) * height;
  const cropBottom = (adj.crop.bottom / 100) * height;

  const croppedWidth = Math.max(10, width - cropLeft - cropRight);
  const croppedHeight = Math.max(10, height - cropTop - cropBottom);

  const totalAngle = (adj.rotation || 0) + (adj.fineAngle || 0);

  let finalW = croppedWidth;
  let finalH = croppedHeight;

  if (totalAngle !== 0) {
    const rad = (totalAngle * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    finalW = Math.round(croppedWidth * cos + croppedHeight * sin);
    finalH = Math.round(croppedWidth * sin + croppedHeight * cos);
  }

  canvas.width = finalW;
  canvas.height = finalH;

  // Background white so rotating leaves clean white corners
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, finalW, finalH);

  // Build CSS filter string
  const filters: string[] = [];
  if (adj.brightness !== 100) {
    filters.push(`brightness(${adj.brightness}%)`);
  }
  if (adj.contrast !== 100) {
    filters.push(`contrast(${adj.contrast}%)`);
  }
  if (adj.grayscale) {
    filters.push('grayscale(100%)');
  }
  if (adj.invert) {
    filters.push('invert(100%)');
  }

  ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';

  const shiftX = ((adj.offsetX || 0) / 100) * croppedWidth;
  const shiftY = ((adj.offsetY || 0) / 100) * croppedHeight;
  const scale = (adj.scale || 100) / 100;

  if (totalAngle !== 0) {
    const rad = (totalAngle * Math.PI) / 180;
    ctx.save();
    ctx.translate(finalW / 2 + shiftX, finalH / 2 + shiftY);
    ctx.rotate(rad);
    if (scale !== 1) {
      ctx.scale(scale, scale);
    }
    ctx.drawImage(
      img,
      cropLeft,
      cropTop,
      croppedWidth,
      croppedHeight,
      -croppedWidth / 2,
      -croppedHeight / 2,
      croppedWidth,
      croppedHeight
    );
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(shiftX, shiftY);
    if (scale !== 1) {
      ctx.translate((croppedWidth * (1 - scale)) / 2, (croppedHeight * (1 - scale)) / 2);
      ctx.scale(scale, scale);
    }
    // Draw the cropped portion directly
    ctx.drawImage(
      img,
      cropLeft,
      cropTop,
      croppedWidth,
      croppedHeight,
      0,
      0,
      croppedWidth,
      croppedHeight
    );
    ctx.restore();
  }

  // Pure B&W threshold conversion for razor-sharp text
  if (adj.threshold) {
    const imgData = ctx.getImageData(0, 0, finalW, finalH);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const thresholdVal = gray > 140 ? 255 : 0;
      data[i] = thresholdVal;
      data[i + 1] = thresholdVal;
      data[i + 2] = thresholdVal;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // Render text overlays, shapes, and page numbering
  ctx.filter = 'none';
  renderOverlaysOnCanvas(ctx, finalW, finalH, adj, pageNum, totalPages);

  const finalDataUrl = canvas.toDataURL('image/jpeg', 0.90);
  img.src = '';
  canvas.width = 0;
  canvas.height = 0;
  return finalDataUrl;
}

/**
 * Get or create hidden iframe for clean printing with realistic dimensions
 * so the browser print engine does not collapse layout or print blank pages.
 */
function getPrintIframe(): HTMLIFrameElement {
  let printIframe = document.getElementById('pdf-print-iframe') as HTMLIFrameElement | null;
  if (!printIframe) {
    printIframe = document.createElement('iframe');
    printIframe.id = 'pdf-print-iframe';
    printIframe.style.position = 'fixed';
    printIframe.style.right = '0';
    printIframe.style.bottom = '0';
    printIframe.style.width = '800px';
    printIframe.style.height = '1100px';
    printIframe.style.border = 'none';
    printIframe.style.opacity = '0.001';
    printIframe.style.pointerEvents = 'none';
    printIframe.style.zIndex = '-9999';
    document.body.appendChild(printIframe);
  }
  return printIframe;
}

/**
 * Ensures all images inside the print iframe are fully loaded and decoded
 * before invoking window.print(). Prevents blank page printing in all browsers.
 */
async function waitForIframeImagesToLoad(iframeDoc: Document, timeoutMs = 12000): Promise<void> {
  const images = Array.from(iframeDoc.getElementsByTagName('img'));
  if (images.length === 0) return;

  const loadPromises = images.map((img) => {
    if (img.complete && img.naturalWidth > 0) {
      if ('decode' in img) {
        return (img.decode() as Promise<void>).catch(() => {});
      }
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      let isSettled = false;
      const done = () => {
        if (!isSettled) {
          isSettled = true;
          resolve();
        }
      };
      img.onload = async () => {
        if ('decode' in img) {
          try {
            await (img.decode() as Promise<void>);
          } catch {}
        }
        done();
      };
      img.onerror = done;
    });
  });

  const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([Promise.all(loadPromises), timeoutPromise]);

  // Give the browser rendering engine 2 frames to paint
  await new Promise((resolve) => setTimeout(resolve, 250));
}

/**
 * Print a single PDF document separately with optimized batch page rendering
 */
export async function executeSingleItemPrint(
  item: PDFItem,
  settings: PrintSettings,
  onProgress?: (pct: number, message: string) => void
): Promise<{ success: boolean; totalPrintedPages: number }> {
  const totalP = item.pageCount || 1;
  let activePages: number[] = [];
  for (let p = 1; p <= totalP; p++) {
    const adj = item.pageAdjustments?.[p];
    if (!adj || adj.selectedForPrint) {
      activePages.push(p);
    }
  }

  // Filter odd / even pages if requested
  if (settings.oddEvenFilter === 'odd') {
    activePages = activePages.filter((p) => p % 2 !== 0);
  } else if (settings.oddEvenFilter === 'even') {
    activePages = activePages.filter((p) => p % 2 === 0);
  }
  if (settings.reverseOrder) {
    activePages.reverse();
  }

  if (activePages.length === 0) {
    throw new Error(`هیچ صفحه‌ای برای چاپ در سند "${item.name}" انتخاب نشده است.`);
  }

  onProgress?.(5, `در حال آماده‌سازی صفحات سند: ${item.name}`);

  const pageImages: { dataUrl: string; pageNum: number; fileName: string }[] = [];
  const CHUNK_SIZE = 5; // Process in batches of 5 pages to avoid memory spikes and thread blocking

  for (let i = 0; i < activePages.length; i += CHUNK_SIZE) {
    const chunkPageNums = activePages.slice(i, i + CHUNK_SIZE);
    onProgress?.(
      Math.round(5 + (i / activePages.length) * 75),
      `در حال پردازش صفحات ${i + 1} تا ${Math.min(activePages.length, i + CHUNK_SIZE)} از ${activePages.length}...`
    );

    // Extract pages in this chunk with high fidelity 2.8 scale (~200+ DPI)
    const renderedRawMap = await renderPdfPagesBatch(item.file, chunkPageNums, 2.8);

    for (let j = 0; j < chunkPageNums.length; j++) {
      const p = chunkPageNums[j];
      const adj = item.pageAdjustments?.[p] || {
        brightness: 100,
        contrast: 100,
        grayscale: settings.colorMode === 'grayscale',
        threshold: settings.colorMode === 'bw',
        invert: false,
        crop: { top: 0, bottom: 0, left: 0, right: 0 },
        rotation: item.rotation || 0,
        selectedForPrint: true,
      };

      const raw = renderedRawMap.get(p);
      if (raw) {
        const finalUrl = await processPageForPrint(raw.dataUrl, raw.width, raw.height, adj, p, totalP);
        pageImages.push({ dataUrl: finalUrl, pageNum: p, fileName: item.name });
      }
    }

    // Yield to main thread for garbage collection and browser paint cycles
    await new Promise((r) => setTimeout(r, 25));
  }

  // Handle N-Up Grid Imposition if enabled
  let finalSheetsToPrint: { dataUrl: string; pageNum: number; fileName: string }[] = pageImages;

  if (settings.gridLayout && settings.gridLayout.enabled) {
    onProgress?.(85, 'مونتاژ و چیدمان صفحات در قالب جدول (N-Up)...');
    let cellPages: GridCellData[] = pageImages.map((pg) => ({
      pageNumber: pg.pageNum,
      dataUrl: pg.dataUrl,
      sourceFileName: pg.fileName,
    }));

    // Booklet imposition reordering if requested
    if (settings.duplex === 'booklet') {
      const blankCellFactory = () => ({
        pageNumber: 0,
        dataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        sourceFileName: item.name,
      });
      cellPages = calculateBookletPageOrder(cellPages, blankCellFactory);
    }

    const imposed = buildImposedSheets(cellPages, settings.gridLayout);
    const basePaper = PAPER_DIMENSIONS_MM[settings.paperSize] || PAPER_DIMENSIONS_MM.A4;
    const isLandscape = settings.orientation === 'landscape';
    const paperW = isLandscape
      ? Math.max(basePaper.widthMm, basePaper.heightMm)
      : Math.min(basePaper.widthMm, basePaper.heightMm);
    const paperH = isLandscape
      ? Math.min(basePaper.widthMm, basePaper.heightMm)
      : Math.max(basePaper.widthMm, basePaper.heightMm);

    finalSheetsToPrint = [];
    for (let sIdx = 0; sIdx < imposed.length; sIdx++) {
      const sheetUrl = await renderImposedSheetCanvas(
        imposed[sIdx],
        settings.gridLayout,
        paperW,
        paperH,
        2.5
      );
      finalSheetsToPrint.push({
        dataUrl: sheetUrl,
        pageNum: sIdx + 1,
        fileName: `${item.name} Sheet ${sIdx + 1}`,
      });
      await new Promise((r) => setTimeout(r, 15));
    }
  }

  onProgress?.(95, 'ارسال به پنجره چاپ...');

  const paperDimensions: Record<string, string> = {
    A4: '210mm 297mm',
    A3: '297mm 420mm',
    A5: '148mm 210mm',
    Letter: '8.5in 11in',
    Legal: '8.5in 14in',
    B5: '176mm 250mm',
  };

  const paperSizeRule = paperDimensions[settings.paperSize] || '210mm 297mm';
  const orientationRule =
    settings.orientation === 'landscape'
      ? 'landscape'
      : settings.orientation === 'portrait'
      ? 'portrait'
      : '';

  const printIframe = getPrintIframe();
  const iframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
  if (!iframeDoc) throw new Error('عدم دسترسی به iframe چاپ.');

  // Emulator of copies in browser fallback print to ensure correct volume without hanging
  let browserSpoolPages = [...finalSheetsToPrint];
  const copiesCount = settings.copies || 1;
  if (copiesCount > 1 && !(typeof window !== 'undefined' && window.electronAPI?.isDesktop)) {
    browserSpoolPages = [];
    if (settings.collate) {
      for (let c = 0; c < copiesCount; c++) {
        browserSpoolPages.push(...finalSheetsToPrint);
      }
    } else {
      for (const pg of finalSheetsToPrint) {
        for (let c = 0; c < copiesCount; c++) {
          browserSpoolPages.push(pg);
        }
      }
    }
  }

  let imgScalingStyle = 'max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;';
  if (settings.scaling === 'shrink') {
    imgScalingStyle = 'max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: scale-down;';
  } else if (settings.scaling === 'actual') {
    imgScalingStyle = 'width: auto; height: auto; object-fit: none;';
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="utf-8">
      <title>${item.name} - ${settings.printerName}</title>
      <style>
        @page {
          size: ${paperSizeRule} ${orientationRule};
          margin: 0;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          background: #ffffff !important;
          color: #000000;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .page-container {
          page-break-before: auto;
          page-break-after: always;
          page-break-inside: avoid;
          break-after: page;
          break-inside: avoid;
          width: 100%;
          height: 100%;
          min-height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          box-sizing: border-box;
        }
        .page-container:last-child {
          page-break-after: auto;
          break-after: auto;
        }
        img.print-page {
          ${imgScalingStyle}
          display: block;
          margin: auto;
        }
      </style>
    </head>
    <body>
      ${browserSpoolPages
        .map(
          (pg) => `
        <div class="page-container">
          <img class="print-page" src="${pg.dataUrl}" alt="Page ${pg.pageNum}" />
        </div>
      `
        )
        .join('')}
    </body>
    </html>
  `;

  // If running in desktop Electron with native printer access
  if (typeof window !== 'undefined' && window.electronAPI?.isDesktop && window.electronAPI.printToDevice) {
    onProgress?.(98, `در حال ارسال به چاپگر "${settings.printerName}"...`);
    const isCustomDevice = Boolean(settings.printerName && !settings.printerName.includes('Default Spooler'));
    try {
      const result = await window.electronAPI.printToDevice({
        deviceName: isCustomDevice ? settings.printerName : undefined,
        copies: settings.copies || 1,
        duplex: settings.duplex,
        colorMode: settings.colorMode,
        color: settings.colorMode !== 'bw',
        landscape: settings.orientation === 'landscape',
        paperSize: settings.paperSize,
        silent: isCustomDevice,
        htmlContent,
        collate: settings.collate,
      });
      if (result && result.cancelled) {
        return { success: false, totalPrintedPages: 0 };
      }
      return { success: true, totalPrintedPages: finalSheetsToPrint.length };
    } catch (err) {
      console.warn('Native printer failed:', err);
      throw new Error(`خطای چاپ درایور پرینتر: ${(err as Error).message || err}`);
    }
  }

  iframeDoc.open();
  iframeDoc.write(htmlContent);
  iframeDoc.close();

  onProgress?.(96, 'در حال بارگذاری کامل و رندر تصاویر قبل از چاپ...');
  await waitForIframeImagesToLoad(iframeDoc);

  onProgress?.(100, 'دیالوگ چاپ فراخوانی شد.');

  try {
    printIframe.contentWindow?.focus();
    printIframe.contentWindow?.print();
  } catch (err) {
    console.error('Trigger print failed:', err);
    window.print();
  }

  return { success: true, totalPrintedPages: finalSheetsToPrint.length };
}

/**
 * Print all selected PDF documents continuously (merged into one print job)
 * Optimized with batch rendering, document memory disposal, and non-blocking main thread yields.
 */
export async function executeContinuousBatchPrint(
  items: PDFItem[],
  settings: PrintSettings,
  onProgress: (currentFile: number, totalFiles: number, currentPage: number, totalPages: number, percentage: number, fileName: string) => void
): Promise<{ success: boolean; totalPrintedPages: number }> {
  // 1. Gather all individual page print tasks across all documents
  let tasks: { item: PDFItem; pageNum: number; fileIdx: number }[] = [];
  for (let fIdx = 0; fIdx < items.length; fIdx++) {
    const item = items[fIdx];
    const pageCount = item.pageCount || 1;
    for (let p = 1; p <= pageCount; p++) {
      const adj = item.pageAdjustments?.[p];
      if (!adj || adj.selectedForPrint) {
        tasks.push({ item, pageNum: p, fileIdx: fIdx });
      }
    }
  }

  // Filter odd / even pages if requested
  if (settings.oddEvenFilter === 'odd') {
    tasks = tasks.filter((t) => t.pageNum % 2 !== 0);
  } else if (settings.oddEvenFilter === 'even') {
    tasks = tasks.filter((t) => t.pageNum % 2 === 0);
  }
  if (settings.reverseOrder) {
    tasks.reverse();
  }

  const grandTotalPages = tasks.length;
  if (grandTotalPages === 0) {
    throw new Error('هیچ صفحه‌ای برای چاپ انتخاب نشده است.');
  }

  const printIframe = getPrintIframe();
  const iframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
  if (!iframeDoc) throw new Error('امکان دسترسی به پنجره چاپ فراهم نیست.');

  const pageImages: { dataUrl: string; fileName: string; pageNum: number }[] = [];
  const CHUNK_SIZE = 6; // Process in batches of 6 pages to avoid main thread blocking and memory buildup

  for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
    const chunkTasks = tasks.slice(i, i + CHUNK_SIZE);
    const pct = Math.round((i / tasks.length) * 75);

    // Show friendly localized chunking status
    onProgress(
      chunkTasks[0].fileIdx + 1,
      items.length,
      i + 1,
      tasks.length,
      pct,
      `در حال پردازش صفحات ${i + 1} تا ${Math.min(tasks.length, i + CHUNK_SIZE)} از ${tasks.length} در صف پس‌زمینه...`
    );

    // Group chunk tasks by file index to render them in batch efficiently
    const tasksByFileIdx = new Map<number, typeof chunkTasks>();
    for (const t of chunkTasks) {
      if (!tasksByFileIdx.has(t.fileIdx)) {
        tasksByFileIdx.set(t.fileIdx, []);
      }
      tasksByFileIdx.get(t.fileIdx)!.push(t);
    }

    // Process each group inside this chunk with high fidelity 2.8 scale (~200+ DPI)
    for (const [fIdx, fileTasks] of tasksByFileIdx.entries()) {
      const item = items[fIdx];
      const pageNumbers = fileTasks.map((t) => t.pageNum);

      const renderedRawMap = await renderPdfPagesBatch(item.file, pageNumbers, 2.8);

      for (const t of fileTasks) {
        const p = t.pageNum;
        const adj = item.pageAdjustments?.[p] || {
          brightness: 100,
          contrast: 100,
          grayscale: settings.colorMode === 'grayscale',
          threshold: settings.colorMode === 'bw',
          invert: false,
          crop: { top: 0, bottom: 0, left: 0, right: 0 },
          rotation: item.rotation || 0,
          selectedForPrint: true,
        };

        const raw = renderedRawMap.get(p);
        if (raw) {
          const finalUrl = await processPageForPrint(raw.dataUrl, raw.width, raw.height, adj, p, item.pageCount || 1);
          pageImages.push({
            dataUrl: finalUrl,
            fileName: item.name,
            pageNum: p,
          });
        }
      }
    }

    // Yield back control to browser for garbage collection and screen updates
    await new Promise((resolve) => setTimeout(resolve, 35));
  }

  // Handle N-Up Grid Imposition if enabled
  let finalSheetsToPrint: { dataUrl: string; pageNum: number; fileName: string }[] = pageImages;

  if (settings.gridLayout && settings.gridLayout.enabled) {
    onProgress(items.length, items.length, grandTotalPages, grandTotalPages, 85, 'مونتاژ صفحات در قالب جدول N-Up...');
    const cellsPerSheet = (settings.gridLayout.rows || 1) * (settings.gridLayout.cols || 1);
    let cellPages: GridCellData[] = [];

    // Support jobFromNewSheet: pad cells before new file starts
    if (settings.jobFromNewSheet && !settings.gridLayout.repeatPage) {
      let currentFileName = '';
      for (const pg of pageImages) {
        if (currentFileName && pg.fileName !== currentFileName) {
          const rem = cellPages.length % cellsPerSheet;
          if (rem !== 0) {
            const padCount = cellsPerSheet - rem;
            for (let k = 0; k < padCount; k++) {
              cellPages.push({
                pageNumber: 0,
                dataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
                sourceFileName: '',
              });
            }
          }
        }
        currentFileName = pg.fileName;
        cellPages.push({
          pageNumber: pg.pageNum,
          dataUrl: pg.dataUrl,
          sourceFileName: pg.fileName,
        });
      }
    } else {
      cellPages = pageImages.map((pg) => ({
        pageNumber: pg.pageNum,
        dataUrl: pg.dataUrl,
        sourceFileName: pg.fileName,
      }));
    }

    // Booklet imposition reordering if requested
    if (settings.duplex === 'booklet') {
      const blankCellFactory = () => ({
        pageNumber: 0,
        dataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        sourceFileName: '',
      });
      cellPages = calculateBookletPageOrder(cellPages, blankCellFactory);
    }

    const imposed = buildImposedSheets(cellPages, settings.gridLayout);
    const basePaper = PAPER_DIMENSIONS_MM[settings.paperSize] || PAPER_DIMENSIONS_MM.A4;
    const isLandscape = settings.orientation === 'landscape';
    const paperW = isLandscape
      ? Math.max(basePaper.widthMm, basePaper.heightMm)
      : Math.min(basePaper.widthMm, basePaper.heightMm);
    const paperH = isLandscape
      ? Math.min(basePaper.widthMm, basePaper.heightMm)
      : Math.max(basePaper.widthMm, basePaper.heightMm);

    finalSheetsToPrint = [];
    for (let sIdx = 0; sIdx < imposed.length; sIdx++) {
      const sheetUrl = await renderImposedSheetCanvas(
        imposed[sIdx],
        settings.gridLayout,
        paperW,
        paperH,
        2.5
      );
      finalSheetsToPrint.push({
        dataUrl: sheetUrl,
        pageNum: sIdx + 1,
        fileName: `Imposed Sheet ${sIdx + 1}`,
      });
      await new Promise((r) => setTimeout(r, 15));
    }
  }

  onProgress(items.length, items.length, grandTotalPages, grandTotalPages, 95, 'آماده‌سازی صف چاپ ویندوز...');

  const paperDimensions: Record<string, string> = {
    A4: '210mm 297mm',
    A3: '297mm 420mm',
    A5: '148mm 210mm',
    Letter: '8.5in 11in',
    Legal: '8.5in 14in',
    B5: '176mm 250mm',
  };

  const paperSizeRule = paperDimensions[settings.paperSize] || '210mm 297mm';
  const orientationRule =
    settings.orientation === 'landscape'
      ? 'landscape'
      : settings.orientation === 'portrait'
      ? 'portrait'
      : '';

  // Emulator of copies in browser fallback print to ensure correct volume without hanging
  let browserSpoolPages = [...finalSheetsToPrint];
  const copiesCount = settings.copies || 1;
  if (copiesCount > 1 && !(typeof window !== 'undefined' && window.electronAPI?.isDesktop)) {
    browserSpoolPages = [];
    if (settings.collate) {
      for (let c = 0; c < copiesCount; c++) {
        browserSpoolPages.push(...finalSheetsToPrint);
      }
    } else {
      for (const pg of finalSheetsToPrint) {
        for (let c = 0; c < copiesCount; c++) {
          browserSpoolPages.push(pg);
        }
      }
    }
  }

  let imgScalingStyle = 'max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;';
  if (settings.scaling === 'shrink') {
    imgScalingStyle = 'max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: scale-down;';
  } else if (settings.scaling === 'actual') {
    imgScalingStyle = 'width: auto; height: auto; object-fit: none;';
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="utf-8">
      <title>Batch Print Spool - ${settings.printerName}</title>
      <style>
        @page {
          size: ${paperSizeRule} ${orientationRule};
          margin: 0;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          background: #ffffff !important;
          color: #000000;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .page-container {
          page-break-before: auto;
          page-break-after: always;
          page-break-inside: avoid;
          break-after: page;
          break-inside: avoid;
          width: 100%;
          height: 100%;
          min-height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          box-sizing: border-box;
        }
        .page-container:last-child {
          page-break-after: auto;
          break-after: auto;
        }
        img.print-page {
          ${imgScalingStyle}
          display: block;
          margin: auto;
        }
      </style>
    </head>
    <body>
      ${browserSpoolPages
        .map(
          (pg) => `
        <div class="page-container">
          <img class="print-page" src="${pg.dataUrl}" alt="${pg.fileName} Page ${pg.pageNum}" />
        </div>
      `
        )
        .join('')}
    </body>
    </html>
  `;

  // If running in desktop Electron with native printer access
  if (typeof window !== 'undefined' && window.electronAPI?.isDesktop && window.electronAPI.printToDevice) {
    onProgress(items.length, items.length, grandTotalPages, grandTotalPages, 98, `در حال ارسال مستقیم به چاپگر "${settings.printerName}"...`);
    const isCustomDevice = Boolean(settings.printerName && !settings.printerName.includes('Default Spooler'));
    try {
      const result = await window.electronAPI.printToDevice({
        deviceName: isCustomDevice ? settings.printerName : undefined,
        copies: settings.copies || 1,
        duplex: settings.duplex,
        colorMode: settings.colorMode,
        color: settings.colorMode !== 'bw',
        landscape: settings.orientation === 'landscape',
        paperSize: settings.paperSize,
        silent: isCustomDevice,
        htmlContent,
        collate: settings.collate,
      });
      if (result && result.cancelled) {
        return { success: false, totalPrintedPages: 0 };
      }
      return { success: true, totalPrintedPages: finalSheetsToPrint.length };
    } catch (err) {
      console.warn('Native batch printer failed:', err);
      throw new Error(`خطای چاپ درایور پرینتر: ${(err as Error).message || err}`);
    }
  }

  iframeDoc.open();
  iframeDoc.write(htmlContent);
  iframeDoc.close();

  onProgress(items.length, items.length, grandTotalPages, grandTotalPages, 96, 'در حال بارگذاری کامل و آماده‌سازی تصاویر در صف چاپ...');
  await waitForIframeImagesToLoad(iframeDoc);

  onProgress(items.length, items.length, grandTotalPages, grandTotalPages, 100, 'در حال فراخوانی دیالوگ چاپ...');

  try {
    printIframe.contentWindow?.focus();
    printIframe.contentWindow?.print();
  } catch (err) {
    console.error('Trigger print failed:', err);
    window.print();
  }

  return { success: true, totalPrintedPages: finalSheetsToPrint.length };
}

/**
 * Universal dispatcher
 */
export async function executeBatchPrint(
  items: PDFItem[],
  settings: PrintSettings,
  onProgress: (currentFile: number, totalFiles: number, currentPage: number, totalPages: number, percentage: number, fileName: string) => void
): Promise<{ success: boolean; totalPrintedPages: number }> {
  return executeContinuousBatchPrint(items, settings, onProgress);
}
