import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { PDFItem, PageAdjustment, PageOverlayNumbering } from '../types';
import { renderPdfPageToDataUrl } from './pdfRenderUtils';
import { processPageForPrint } from './printUtils';

/**
 * Fast page counting using pdf-lib
 * Uses lightweight parsing to extract page count in milliseconds.
 */
export async function getPdfPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  // PDFDocument.load with ignoreEncryption: true allows reading basic info even if password-protected without full decrypt
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  return pdfDoc.getPageCount();
}

/**
 * Parse human page range like "1-3, 5, 8-10" or "all" into 0-based indices array
 */
export function parsePageRange(rangeStr: string | undefined, totalPages: number): number[] {
  if (!rangeStr || rangeStr.trim().toLowerCase() === 'all' || rangeStr.trim() === '') {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const result = new Set<number>();
  const parts = rangeStr.split(/[,،]/); // support both English and Persian commas

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr.trim(), 10);
      const end = parseInt(endStr.trim(), 10);
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        for (let i = min; i <= max; i++) {
          result.add(i - 1);
        }
      }
    } else {
      const pageNum = parseInt(trimmed, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        result.add(pageNum - 1);
      }
    }
  }

  const sorted = Array.from(result).sort((a, b) => a - b);
  return sorted.length > 0 ? sorted : Array.from({ length: totalPages }, (_, i) => i);
}

/**
 * Merge multiple PDF items into a single merged PDF Document
 */
export async function mergePdfs(
  items: PDFItem[],
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{ blob: Blob; totalPages: number }> {
  const mergedPdf = await PDFDocument.create();
  let totalMergedPages = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress?.(i + 1, items.length, item.name);

    try {
      const arrayBuffer = await item.file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const sourcePageCount = sourcePdf.getPageCount();
      const pageIndices = parsePageRange(item.pageRange, sourcePageCount);

      const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);

      for (const page of copiedPages) {
        if (item.rotation) {
          const currentRotation = page.getRotation().angle;
          page.setRotation(degrees((currentRotation + item.rotation) % 360));
        }
        mergedPdf.addPage(page);
        totalMergedPages++;
      }
    } catch (err) {
      console.error(`Error processing file ${item.name}:`, err);
      throw new Error(`خطا در پردازش فایل "${item.name}": ${(err as Error).message}`);
    }

    // Yield to the event loop so progress updates are smooth
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  const mergedPdfBytes = await mergedPdf.save();
  // Return the new merged PDF as a Blob
  const blob = new Blob([mergedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  return { blob, totalPages: totalMergedPages };
}

/**
 * Merge pages with custom brightness, contrast, crop, filters, and dynamic page numbering
 */
export async function mergePdfsWithAdjustments(
  pagesToMerge: {
    file: File;
    fileName: string;
    pageNumInFile: number;
    adj: PageAdjustment;
  }[],
  globalNumbering?: PageOverlayNumbering,
  onProgress?: (current: number, total: number, msg: string) => void
): Promise<{ blob: Blob; totalPages: number }> {
  const pdfDoc = await PDFDocument.create();
  const total = pagesToMerge.length;

  for (let i = 0; i < total; i++) {
    const item = pagesToMerge[i];
    onProgress?.(i + 1, total, `پردازش و رندر صفحه ${i + 1} از ${total} (${item.fileName})...`);

    // Merge global page numbering if provided and enabled
    const finalAdj: PageAdjustment = JSON.parse(JSON.stringify(item.adj));
    if (globalNumbering && globalNumbering.enabled) {
      if (!finalAdj.pageNumberings) {
        finalAdj.pageNumberings = [];
      }
      finalAdj.pageNumberings.push(globalNumbering);
    }

    // Render raw PDF page at crisp 2.0 scale
    const raw = await renderPdfPageToDataUrl(item.file, item.pageNumInFile, 2.0);

    // Apply brightness, contrast, crop, overlays & page numbers
    const processedUrl = await processPageForPrint(
      raw.dataUrl,
      raw.width,
      raw.height,
      finalAdj,
      i + 1,
      total
    );

    // Embed processed image into pdfDoc
    const imgBytes = await fetch(processedUrl).then((r) => r.arrayBuffer());
    const embeddedImg = await pdfDoc.embedJpg(imgBytes);

    const pageW = raw.width * 0.75;
    const pageH = raw.height * 0.75;

    const page = pdfDoc.addPage([pageW, pageH]);
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: pageW,
      height: pageH,
    });

    // Revoke blob URL if created
    if (processedUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(processedUrl);
      } catch {}
    }

    // Yield to main thread
    await new Promise((r) => setTimeout(r, 10));
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  return { blob, totalPages: total };
}

/**
 * Generate 3 clean sample PDF files in memory for instant testing
 */
export async function generateSamplePdfs(): Promise<File[]> {
  const samples: File[] = [];

  // Sample 1: 4 pages document
  {
    const doc1 = await PDFDocument.create();
    const font = await doc1.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc1.embedFont(StandardFonts.HelveticaBold);

    const colors = [
      rgb(0.12, 0.35, 0.65),
      rgb(0.15, 0.55, 0.45),
      rgb(0.65, 0.35, 0.15),
      rgb(0.35, 0.25, 0.55),
    ];

    for (let p = 1; p <= 4; p++) {
      const page = doc1.addPage([595.28, 841.89]); // A4
      const { width, height } = page.getSize();

      // Top banner
      page.drawRectangle({
        x: 40,
        y: height - 100,
        width: width - 80,
        height: 60,
        color: colors[p - 1],
      });

      page.drawText(`Document A - Invoice & Report`, {
        x: 60,
        y: height - 70,
        size: 18,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      page.drawText(`Page ${p} of 4`, {
        x: width - 140,
        y: height - 70,
        size: 14,
        font: font,
        color: rgb(1, 1, 1),
      });

      page.drawText(`This is page number ${p} generated for fast offline page counting and merge testing.`, {
        x: 50,
        y: height - 160,
        size: 12,
        font: font,
        color: rgb(0.2, 0.2, 0.2),
      });

      page.drawText(`- Item Ref: INV-2026-00${p}`, {
        x: 50,
        y: height - 200,
        size: 11,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });

      page.drawText(`- Status: Ready for merge`, {
        x: 50,
        y: height - 225,
        size: 11,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });

      // Bottom footer
      page.drawLine({
        start: { x: 40, y: 50 },
        end: { x: width - 40, y: 50 },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
      });

      page.drawText(`PDF Counter & Merger Pro Demo - Windows 11 Fluent Utility`, {
        x: 50,
        y: 35,
        size: 9,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    const bytes1 = await doc1.save();
    samples.push(new File([bytes1.buffer as ArrayBuffer], 'Invoice_Sample_4Pages.pdf', { type: 'application/pdf' }));
  }

  // Sample 2: 7 pages document
  {
    const doc2 = await PDFDocument.create();
    const font = await doc2.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc2.embedFont(StandardFonts.HelveticaBold);

    for (let p = 1; p <= 7; p++) {
      const page = doc2.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();

      page.drawText(`Official Contract - Multi-Page Document`, {
        x: 50,
        y: height - 80,
        size: 20,
        font: fontBold,
        color: rgb(0.1, 0.2, 0.3),
      });

      page.drawText(`Section ${p}: Terms & Specification Document`, {
        x: 50,
        y: height - 120,
        size: 13,
        font: fontBold,
        color: rgb(0.2, 0.4, 0.6),
      });

      page.drawText(`Page [ ${p} / 7 ] - Validating batch page counting performance`, {
        x: 50,
        y: height - 160,
        size: 11,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });

      page.drawRectangle({
        x: 50,
        y: height - 350,
        width: width - 100,
        height: 150,
        borderColor: rgb(0.7, 0.7, 0.8),
        borderWidth: 1,
        color: rgb(0.97, 0.98, 1.0),
      });

      page.drawText(`Contract clause paragraph details for clause #${p}.`, {
        x: 70,
        y: height - 230,
        size: 10,
        font: font,
        color: rgb(0.2, 0.2, 0.2),
      });

      page.drawText(`Page ${p} of 7`, {
        x: width / 2 - 30,
        y: 35,
        size: 10,
        font: font,
        color: rgb(0.4, 0.4, 0.4),
      });
    }

    const bytes2 = await doc2.save();
    samples.push(new File([bytes2.buffer as ArrayBuffer], 'Legal_Contract_7Pages.pdf', { type: 'application/pdf' }));
  }

  // Sample 3: 2 pages document
  {
    const doc3 = await PDFDocument.create();
    const font = await doc3.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc3.embedFont(StandardFonts.HelveticaBold);

    for (let p = 1; p <= 2; p++) {
      const page = doc3.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();

      page.drawText(`Technical Appendix & Drawings`, {
        x: 50,
        y: height - 80,
        size: 18,
        font: fontBold,
        color: rgb(0.6, 0.2, 0.2),
      });

      page.drawText(`Appendix Sheet ${p} of 2`, {
        x: 50,
        y: height - 110,
        size: 12,
        font: font,
        color: rgb(0.4, 0.4, 0.4),
      });

      page.drawRectangle({
        x: 50,
        y: 100,
        width: width - 100,
        height: height - 250,
        borderColor: rgb(0.6, 0.6, 0.6),
        borderWidth: 1.5,
      });

      page.drawText(`[Technical Schema Diagram Layout Sheet #${p}]`, {
        x: width / 2 - 120,
        y: height / 2,
        size: 14,
        font: fontBold,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    const bytes3 = await doc3.save();
    samples.push(new File([bytes3.buffer as ArrayBuffer], 'Technical_Appendix_2Pages.pdf', { type: 'application/pdf' }));
  }

  return samples;
}

/**
 * Format bytes to readable size (KB, MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
