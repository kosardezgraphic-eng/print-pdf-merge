import { PDFDocument, EncryptedPDFError, rgb, StandardFonts } from 'pdf-lib';
import * as UTIF from 'utif';
import type { ImageSubFormat, PageItem, SourceFileMeta } from '../../shared/types';
import { ptToMm } from '../../shared/units';
import { putSourceInVault } from './fileVault';

export interface IngestErrorItem {
  fileName: string;
  reasonFa: string;
}

export interface IngestBatchResult {
  addedPages: PageItem[];
  addedSources: SourceFileMeta[];
  errors: IngestErrorItem[];
}

function makeUid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Detect supported file format from magic bytes and filename extension.
 */
export function detectInputFormat(
  name: string,
  bytes: Uint8Array
): { kind: 'pdf' } | { kind: 'image'; imageFormat: ImageSubFormat; mimeType: string } | null {
  // %PDF-
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return { kind: 'pdf' };
  }

  // PNG: 89 50 4E 47
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { kind: 'image', imageFormat: 'png', mimeType: 'image/png' };
  }

  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { kind: 'image', imageFormat: 'jpeg', mimeType: 'image/jpeg' };
  }

  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { kind: 'image', imageFormat: 'webp', mimeType: 'image/webp' };
  }

  // TIFF: II*\0 (49 49 2A 00) or MM\0* (4D 4D 00 2A)
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
  ) {
    return { kind: 'image', imageFormat: 'tiff', mimeType: 'image/tiff' };
  }

  // BMP: BM (42 4D)
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return { kind: 'image', imageFormat: 'bmp', mimeType: 'image/bmp' };
  }

  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return { kind: 'pdf' };
  if (ext === 'jpg' || ext === 'jpeg') {
    return { kind: 'image', imageFormat: 'jpeg', mimeType: 'image/jpeg' };
  }
  if (ext === 'png') return { kind: 'image', imageFormat: 'png', mimeType: 'image/png' };
  if (ext === 'webp') return { kind: 'image', imageFormat: 'webp', mimeType: 'image/webp' };
  if (ext === 'tif' || ext === 'tiff') {
    return { kind: 'image', imageFormat: 'tiff', mimeType: 'image/tiff' };
  }
  if (ext === 'bmp') return { kind: 'image', imageFormat: 'bmp', mimeType: 'image/bmp' };

  return null;
}

/**
 * Extract DPI metadata from PNG pHYs or JPEG JFIF header when present (fallback 300 DPI for print images).
 */
function detectRasterDpi(bytes: Uint8Array, format: ImageSubFormat): number {
  const DEFAULT_PRINT_DPI = 300;

  if (format === 'png') {
    // Scan PNG chunks up to IDAT for pHYs
    let offset = 8;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset, false);
      const type = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      );
      if (type === 'pHYs' && length === 9 && offset + 8 + 9 <= bytes.length) {
        const ppuX = view.getUint32(offset + 8, false);
        const unit = bytes[offset + 16];
        if (unit === 1 && ppuX > 0) {
          const dpi = ppuX * 0.0254;
          if (dpi >= 36 && dpi <= 2400) return dpi;
        }
        break;
      }
      if (type === 'IDAT' || type === 'IEND') break;
      offset += 12 + length;
    }
  } else if (format === 'jpeg') {
    // Check APP0 JFIF density
    if (
      bytes.length > 20 &&
      bytes[2] === 0xff &&
      bytes[3] === 0xe0 &&
      bytes[6] === 0x4a && // 'J'
      bytes[7] === 0x46 && // 'F'
      bytes[8] === 0x49 && // 'I'
      bytes[9] === 0x46 // 'F'
    ) {
      const units = bytes[13];
      const xDensity = (bytes[14] << 8) | bytes[15];
      if (units === 1 && xDensity >= 36 && xDensity <= 2400) {
        return xDensity;
      }
      if (units === 2 && xDensity >= 14 && xDensity <= 1000) {
        return xDensity * 2.54;
      }
    }
  }

  return DEFAULT_PRINT_DPI;
}

function readImageNaturalDimensions(bytes: Uint8Array, mimeType: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([bytes.slice().buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      URL.revokeObjectURL(url);
      if (w <= 0 || h <= 0) {
        reject(new Error('ابعاد تصویر نامعتبر است'));
      } else {
        resolve({ width: w, height: h });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('فایل تصویر خراب است یا قابل رمزگشایی نیست'));
    };
    img.src = url;
  });
}

export interface RawInputCandidate {
  name: string;
  file?: File;
  bytes?: Uint8Array;
  filePath?: string;
}

/**
 * Ingest multiple PDFs and Images (JPG, PNG, WebP, TIFF, BMP) asynchronously without freezing the UI.
 * Expands every PDF page and every multi-page TIFF frame into independent `PageItem` records.
 */
export async function ingestFilesBatch(
  candidates: RawInputCandidate[],
  onProgress?: (processed: number, total: number, currentName: string) => void
): Promise<IngestBatchResult> {
  const addedPages: PageItem[] = [];
  const addedSources: SourceFileMeta[] = [];
  const errors: IngestErrorItem[] = [];

  for (let idx = 0; idx < candidates.length; idx++) {
    const item = candidates[idx];
    onProgress?.(idx + 1, candidates.length, item.name);

    try {
      let bytes: Uint8Array;
      let filePath = item.filePath;

      if (item.bytes) {
        bytes = item.bytes;
      } else if (item.file) {
        if (item.file.size === 0) {
          errors.push({ fileName: item.name, reasonFa: 'فایل خالی است (حجم صفر بایت).' });
          continue;
        }
        if (!filePath && typeof window !== 'undefined' && window.electronAPI?.getFilePath) {
          try {
            const p = window.electronAPI.getFilePath(item.file);
            if (p) filePath = p;
          } catch {
            // Ignore in web mode
          }
        }
        const ab = await item.file.arrayBuffer();
        bytes = new Uint8Array(ab);
      } else {
        errors.push({ fileName: item.name, reasonFa: 'داده فایل قابل خواندن نیست.' });
        continue;
      }

      const detected = detectInputFormat(item.name, bytes);
      if (!detected) {
        errors.push({
          fileName: item.name,
          reasonFa: 'فرمت فایل پشتیبانی نمی‌شود (فقط PDF, JPG, PNG, WebP, TIFF, BMP مجاز است).',
        });
        continue;
      }

      const sourceId = makeUid('src');

      if (detected.kind === 'pdf') {
        let pdfDoc: PDFDocument;
        try {
          // Do NOT ignoreEncryption silently first so password-protected PDFs give a clear error!
          pdfDoc = await PDFDocument.load(bytes, { updateMetadata: false });
        } catch (err) {
          if (
            err instanceof EncryptedPDFError ||
            String((err as Error)?.message || '').toLowerCase().includes('encrypt')
          ) {
            // Try loading owner-password-only PDFs (print-restricted PDFs without user open password)
            try {
              pdfDoc = await PDFDocument.load(bytes, {
                ignoreEncryption: true,
                updateMetadata: false,
              });
              // Verify pages are readable and not encrypted with a user open password
              if (pdfDoc.getPageCount() === 0) {
                throw new Error('Empty encrypted PDF');
              }
            } catch {
              errors.push({
                fileName: item.name,
                reasonFa: 'این فایل PDF رمزدار (قفل‌شده) است. ابتدا رمز آن را باز کنید.',
              });
              continue;
            }
          } else {
            errors.push({
              fileName: item.name,
              reasonFa: 'فایل PDF خراب یا آسیب‌دیده است و ساختار معتبری ندارد.',
            });
            continue;
          }
        }

        const pageCount = pdfDoc.getPageCount();
        if (pageCount <= 0) {
          errors.push({ fileName: item.name, reasonFa: 'این فایل PDF فاقد صفحه است.' });
          continue;
        }

        const meta: SourceFileMeta = {
          id: sourceId,
          name: item.name,
          filePath,
          kind: 'pdf',
          mimeType: 'application/pdf',
          sizeBytes: bytes.byteLength,
          pageCount,
          addedAt: Date.now(),
        };

        putSourceInVault({ meta, file: item.file, bytes });
        addedSources.push(meta);

        const pdfPages = pdfDoc.getPages();
        for (let p = 0; p < pageCount; p++) {
          const pdfPage = pdfPages[p];
          const cropBox = pdfPage.getCropBox();
          const intrinsicRot = ((pdfPage.getRotation().angle % 360) + 360) % 360;
          const rawWidthMm = ptToMm(cropBox.width);
          const rawHeightMm = ptToMm(cropBox.height);
          const isRotatedSideways = intrinsicRot === 90 || intrinsicRot === 270;

          addedPages.push({
            id: makeUid('pg'),
            sourceFileId: sourceId,
            sourceFileName: item.name,
            sourceKind: 'pdf',
            sourcePageIndex: p,
            sourceTotalPages: pageCount,
            widthMm: Number((isRotatedSideways ? rawHeightMm : rawWidthMm).toFixed(2)),
            heightMm: Number((isRotatedSideways ? rawWidthMm : rawHeightMm).toFixed(2)),
            rotation: 0,
            enabled: true,
            copies: 1,
          });
        }
      } else {
        // Image (JPG, PNG, WebP, BMP, TIFF)
        if (detected.imageFormat === 'tiff') {
          let ifds: UTIF.IFD[];
          try {
            ifds = UTIF.decode(bytes).filter((ifd) => (ifd.width || 0) > 0 && (ifd.height || 0) > 0);
            if (ifds.length === 0) {
              // Some TIFFs populate width/height after decodeImage on first IFD
              const rawIfds = UTIF.decode(bytes);
              if (rawIfds.length > 0) {
                UTIF.decodeImage(bytes, rawIfds[0]);
                ifds = rawIfds.filter((ifd) => (ifd.width || 0) > 0 && (ifd.height || 0) > 0);
              }
            }
          } catch {
            errors.push({
              fileName: item.name,
              reasonFa: 'فایل تصویر TIFF آسیب‌دیده یا غیرقابل خواندن است.',
            });
            continue;
          }

          if (ifds.length === 0) {
            errors.push({ fileName: item.name, reasonFa: 'هیچ تصویر معتبری در فایل TIFF یافت نشد.' });
            continue;
          }

          const meta: SourceFileMeta = {
            id: sourceId,
            name: item.name,
            filePath,
            kind: 'image',
            imageFormat: 'tiff',
            mimeType: 'image/tiff',
            sizeBytes: bytes.byteLength,
            pageCount: ifds.length,
            addedAt: Date.now(),
          };
          putSourceInVault({ meta, file: item.file, bytes });
          addedSources.push(meta);

          for (let f = 0; f < ifds.length; f++) {
            const ifd = ifds[f];
            const xRes = Array.isArray(ifd.t282) && ifd.t282[0] ? Number(ifd.t282[0]) : 300;
            const unitTag = Array.isArray(ifd.t296) ? Number(ifd.t296[0]) : 2;
            const dpi =
              unitTag === 3 ? xRes * 2.54 : xRes >= 36 && xRes <= 2400 ? xRes : 300;

            const widthMm = (ifd.width / dpi) * 25.4;
            const heightMm = (ifd.height / dpi) * 25.4;

            addedPages.push({
              id: makeUid('pg'),
              sourceFileId: sourceId,
              sourceFileName: item.name,
              sourceKind: 'image',
              imageFormat: 'tiff',
              sourcePageIndex: f,
              sourceTotalPages: ifds.length,
              widthMm: Number(Math.max(5, widthMm).toFixed(2)),
              heightMm: Number(Math.max(5, heightMm).toFixed(2)),
              pixelWidth: ifd.width,
              pixelHeight: ifd.height,
              rotation: 0,
              enabled: true,
              copies: 1,
            });
          }
        } else {
          // JPG, PNG, WebP, BMP
          let dims: { width: number; height: number };
          try {
            dims = await readImageNaturalDimensions(bytes, detected.mimeType);
          } catch {
            errors.push({
              fileName: item.name,
              reasonFa: 'فایل تصویری آسیب‌دیده است و باز نمی‌شود.',
            });
            continue;
          }

          const dpi = detectRasterDpi(bytes, detected.imageFormat);
          const widthMm = (dims.width / dpi) * 25.4;
          const heightMm = (dims.height / dpi) * 25.4;

          const meta: SourceFileMeta = {
            id: sourceId,
            name: item.name,
            filePath,
            kind: 'image',
            imageFormat: detected.imageFormat,
            mimeType: detected.mimeType,
            sizeBytes: bytes.byteLength,
            pageCount: 1,
            addedAt: Date.now(),
          };
          putSourceInVault({ meta, file: item.file, bytes });
          addedSources.push(meta);

          addedPages.push({
            id: makeUid('pg'),
            sourceFileId: sourceId,
            sourceFileName: item.name,
            sourceKind: 'image',
            imageFormat: detected.imageFormat,
            sourcePageIndex: 0,
            sourceTotalPages: 1,
            widthMm: Number(Math.max(5, widthMm).toFixed(2)),
            heightMm: Number(Math.max(5, heightMm).toFixed(2)),
            pixelWidth: dims.width,
            pixelHeight: dims.height,
            rotation: 0,
            enabled: true,
            copies: 1,
          });
        }
      }
    } catch (err) {
      errors.push({
        fileName: item.name,
        reasonFa: `خطا در خواندن فایل: ${(err as Error).message || 'فرمت نامعتبر'}`,
      });
    }

    // Yield to UI event loop every 2 files so large drag-drops never freeze the screen
    if (idx % 2 === 1) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return { addedPages, addedSources, errors };
}

/**
 * Generate clean sample print-shop files (1 multi-page invoice PDF + 1 business card PDF) for instant demo/testing.
 */
export async function createDemoFiles(): Promise<File[]> {
  const files: File[] = [];

  // 1) 4-page A4 document
  {
    const doc = await PDFDocument.create();
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const font = await doc.embedFont(StandardFonts.Helvetica);

    const accents = [
      rgb(0.11, 0.36, 0.75),
      rgb(0.06, 0.52, 0.42),
      rgb(0.68, 0.32, 0.1),
      rgb(0.42, 0.2, 0.65),
    ];

    for (let i = 1; i <= 4; i++) {
      const p = doc.addPage([595.28, 841.89]);
      p.drawRectangle({
        x: 28,
        y: 28,
        width: 595.28 - 56,
        height: 841.89 - 56,
        borderColor: accents[i - 1],
        borderWidth: 2,
      });
      p.drawRectangle({
        x: 28,
        y: 841.89 - 108,
        width: 595.28 - 56,
        height: 80,
        color: accents[i - 1],
      });
      p.drawText(`KOSAR PRINT STUDIO - SAMPLE SHEET #${i}`, {
        x: 48,
        y: 841.89 - 75,
        size: 18,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      p.drawText(`Vector Test Page ${i} of 4  |  Exact A4 (210 x 297 mm)`, {
        x: 48,
        y: 841.89 - 155,
        size: 13,
        font: fontBold,
        color: rgb(0.15, 0.2, 0.28),
      });
      p.drawText(
        `100% Vector PDF Embedding via pdf-lib (No JPEG Rasterization). Crisp lines at any DPI.`,
        {
          x: 48,
          y: 841.89 - 185,
          size: 10.5,
          font,
          color: rgb(0.3, 0.35, 0.42),
        }
      );

      // Precision calibration crosshair in center
      const cx = 595.28 / 2;
      const cy = 841.89 / 2;
      p.drawCircle({
        x: cx,
        y: cy,
        size: 70,
        borderColor: accents[i - 1],
        borderWidth: 1.2,
      });
      p.drawLine({
        start: { x: cx - 95, y: cy },
        end: { x: cx + 95, y: cy },
        thickness: 0.8,
        color: accents[i - 1],
      });
      p.drawLine({
        start: { x: cx, y: cy - 95 },
        end: { x: cx, y: cy + 95 },
        thickness: 0.8,
        color: accents[i - 1],
      });
      p.drawText(`PAGE ${i}`, {
        x: cx - 34,
        y: cy - 6,
        size: 16,
        font: fontBold,
        color: accents[i - 1],
      });
    }

    const bytes = await doc.save();
    files.push(
      new File([bytes.slice().buffer], 'Brochure_A4_4Pages.pdf', {
        type: 'application/pdf',
      })
    );
  }

  // 2) 90x50mm Business Card vector PDF
  {
    const doc = await PDFDocument.create();
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const font = await doc.embedFont(StandardFonts.Helvetica);

    const wPt = (90 * 72) / 25.4;
    const hPt = (50 * 72) / 25.4;
    const card = doc.addPage([wPt, hPt]);

    card.drawRectangle({
      x: 0,
      y: 0,
      width: wPt,
      height: hPt,
      color: rgb(0.08, 0.11, 0.18),
    });
    card.drawRectangle({
      x: 8,
      y: 8,
      width: wPt - 16,
      height: hPt - 16,
      borderColor: rgb(0.85, 0.68, 0.25),
      borderWidth: 1.2,
    });
    card.drawText('KOSAR DIGITAL PRINT', {
      x: 20,
      y: hPt - 42,
      size: 13,
      font: fontBold,
      color: rgb(0.95, 0.78, 0.32),
    });
    card.drawText('Business Card Sample (90 x 50 mm)', {
      x: 20,
      y: hPt - 64,
      size: 9,
      font,
      color: rgb(0.88, 0.9, 0.95),
    });
    card.drawText('Tel: 021-88000000  |  100% Vector', {
      x: 20,
      y: 22,
      size: 8,
      font,
      color: rgb(0.65, 0.72, 0.82),
    });

    const bytes = await doc.save();
    files.push(
      new File([bytes.slice().buffer], 'BusinessCard_90x50mm.pdf', {
        type: 'application/pdf',
      })
    );
  }

  return files;
}
