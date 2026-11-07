import {
  PDFDocument,
  PDFEmbeddedPage,
  PDFImage,
  clip,
  degrees,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
} from 'pdf-lib';
import type { ImpositionPlan, PdfRectPt } from '../imposition/impositionEngine';
import { getSourceBytes, getSourceFromVault } from '../pages/fileVault';
import { decodeImageFrameToLosslessPng } from '../pages/previewRenderer';
import type { RotationDegrees } from '../../shared/types';

export interface BuildPdfOptions {
  plan: ImpositionPlan;
  /** Optional subset of 0-based sheet indices to export/print (omit for all sheets) */
  sheetIndices?: number[];
  /** Optional custom source byte resolver (useful for headless Node/Vitest tests) */
  resolveBytes?: (sourceFileId: string) => Promise<Uint8Array>;
  onProgress?: (percent: number, messageFa: string) => void;
}

export interface RotatedDrawBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotateCcwDeg: number;
}

/**
 * Compute exact pdf-lib anchor (x, y), unrotated (width, height), and CCW rotation angle
 * so that rotating an object clockwise by `rotationCw` lands strictly inside `targetRectPt`.
 */
export function computePdfRotatedDrawParams(
  targetRectPt: PdfRectPt,
  rotationCw: RotationDegrees
): RotatedDrawBox {
  const { x, y, width: W, height: H } = targetRectPt;
  const normCw = (((rotationCw % 360) + 360) % 360) as RotationDegrees;

  switch (normCw) {
    case 0:
      return { x, y, width: W, height: H, rotateCcwDeg: 0 };
    case 90:
      // 90° clockwise == -90° (270°) counter-clockwise around top-left corner (x, y + H)
      return { x, y: y + H, width: H, height: W, rotateCcwDeg: -90 };
    case 180:
      // 180° around top-right corner (x + W, y + H)
      return { x: x + W, y: y + H, width: W, height: H, rotateCcwDeg: 180 };
    case 270:
      // 270° clockwise == +90° counter-clockwise around bottom-right corner (x + W, y)
      return { x: x + W, y, width: H, height: W, rotateCcwDeg: 90 };
  }
}

/**
 * Build the final 100% vector / original-image-bytes PDF document from an ImpositionPlan.
 * - PDF pages are embedded via `embedPages` (vector XObjects, zero rasterization).
 * - JPEG and PNG images are embedded directly from original file bytes (`embedJpg` / `embedPng`).
 * - WebP, BMP, and TIFF frames are decoded 1:1 into lossless PNG (`embedPng`).
 * - Repeated pages/images share a single XObject reference for minimal file size & fast spooling.
 */
export async function buildImposedPdfBytes(options: BuildPdfOptions): Promise<Uint8Array> {
  const { plan, sheetIndices, resolveBytes, onProgress } = options;

  const targetSheets =
    sheetIndices && sheetIndices.length > 0
      ? sheetIndices
          .map((idx) => plan.sheets[idx])
          .filter((s): s is NonNullable<typeof s> => Boolean(s))
      : plan.sheets;

  if (targetSheets.length === 0) {
    throw new Error('هیچ شیت فعالی برای تولید خروجی PDF وجود ندارد.');
  }

  onProgress?.(5, 'در حال آماده‌سازی سند برداری PDF...');

  const outDoc = await PDFDocument.create();
  outDoc.setCreator('Kosar Print Studio 2.0');
  outDoc.setProducer('Kosar Print Studio (pdf-lib Vector Engine)');

  // Caches so each source PDF / page / image is loaded & embedded only ONCE
  const loadedSourcePdfs = new Map<string, PDFDocument>();
  const embeddedPagesCache = new Map<
    string,
    { embedded: PDFEmbeddedPage; intrinsicRotCw: RotationDegrees }
  >();
  const embeddedImagesCache = new Map<string, PDFImage>();

  const fetchBytes = resolveBytes ?? getSourceBytes;

  const getEmbeddedPdfPage = async (
    sourceFileId: string,
    sourcePageIndex: number
  ): Promise<{ embedded: PDFEmbeddedPage; intrinsicRotCw: RotationDegrees }> => {
    const key = `${sourceFileId}:${sourcePageIndex}`;
    const cached = embeddedPagesCache.get(key);
    if (cached) return cached;

    let srcPdf = loadedSourcePdfs.get(sourceFileId);
    if (!srcPdf) {
      const bytes = await fetchBytes(sourceFileId);
      srcPdf = await PDFDocument.load(bytes, {
        ignoreEncryption: true,
        updateMetadata: false,
      });
      loadedSourcePdfs.set(sourceFileId, srcPdf);
    }

    const srcPage = srcPdf.getPage(sourcePageIndex);
    const cropBox = srcPage.getCropBox();
    const mediaBox = srcPage.getMediaBox();

    // Ensure embedPage uses CropBox if narrower than MediaBox
    const hasCustomCrop =
      Math.abs(cropBox.x - mediaBox.x) > 0.1 ||
      Math.abs(cropBox.y - mediaBox.y) > 0.1 ||
      Math.abs(cropBox.width - mediaBox.width) > 0.1 ||
      Math.abs(cropBox.height - mediaBox.height) > 0.1;

    const embedded = hasCustomCrop
      ? await outDoc.embedPage(srcPage, {
          left: cropBox.x,
          bottom: cropBox.y,
          right: cropBox.x + cropBox.width,
          top: cropBox.y + cropBox.height,
        })
      : (await outDoc.embedPages([srcPage]))[0];

    const rawAngle = (((srcPage.getRotation().angle % 360) + 360) % 360);
    const intrinsicRotCw: RotationDegrees =
      rawAngle === 90 || rawAngle === 180 || rawAngle === 270 ? rawAngle : 0;

    const record = { embedded, intrinsicRotCw };
    embeddedPagesCache.set(key, record);
    return record;
  };

  const getEmbeddedImage = async (
    sourceFileId: string,
    sourcePageIndex: number,
    imageFormat?: string
  ): Promise<PDFImage> => {
    const key = `${sourceFileId}:${sourcePageIndex}`;
    const cached = embeddedImagesCache.get(key);
    if (cached) return cached;

    const vaultEntry = getSourceFromVault(sourceFileId);
    const fmt = imageFormat ?? vaultEntry?.meta.imageFormat ?? 'png';

    let embedded: PDFImage;
    if (fmt === 'jpeg') {
      const rawBytes = await fetchBytes(sourceFileId);
      embedded = await outDoc.embedJpg(rawBytes);
    } else if (fmt === 'png') {
      const rawBytes = await fetchBytes(sourceFileId);
      embedded = await outDoc.embedPng(rawBytes);
    } else {
      // WebP, BMP, or multi-page TIFF -> 1:1 lossless PNG
      const losslessPng = await decodeImageFrameToLosslessPng(sourceFileId, sourcePageIndex);
      embedded = await outDoc.embedPng(losslessPng);
    }

    embeddedImagesCache.set(key, embedded);
    return embedded;
  };

  for (let i = 0; i < targetSheets.length; i++) {
    const sheet = targetSheets[i];
    const pct = 10 + Math.round(((i + 1) / targetSheets.length) * 80);
    onProgress?.(
      pct,
      `در حال مونتاژ برداری شیت ${i + 1} از ${targetSheets.length}...`
    );

    const outPage = outDoc.addPage([sheet.widthPt, sheet.heightPt]);

    for (const cell of sheet.cells) {
      const placement = cell.content;
      if (!placement) continue;

      const { page } = placement;

      if (placement.requiresClip) {
        outPage.pushOperators(
          pushGraphicsState(),
          rectangle(
            cell.pdfRectPt.x,
            cell.pdfRectPt.y,
            cell.pdfRectPt.width,
            cell.pdfRectPt.height
          ),
          clip(),
          endPath()
        );
      }

      if (page.sourceKind === 'pdf') {
        const { embedded, intrinsicRotCw } = await getEmbeddedPdfPage(
          page.sourceFileId,
          page.sourcePageIndex
        );
        const combinedCw = (((intrinsicRotCw + placement.totalRotationCw) % 360) as RotationDegrees);
        const drawBox = computePdfRotatedDrawParams(placement.pdfRectPt, combinedCw);

        outPage.drawPage(embedded, {
          x: drawBox.x,
          y: drawBox.y,
          width: drawBox.width,
          height: drawBox.height,
          rotate: degrees(drawBox.rotateCcwDeg),
        });
      } else {
        const embeddedImg = await getEmbeddedImage(
          page.sourceFileId,
          page.sourcePageIndex,
          page.imageFormat
        );
        const drawBox = computePdfRotatedDrawParams(
          placement.pdfRectPt,
          placement.totalRotationCw
        );

        outPage.drawImage(embeddedImg, {
          x: drawBox.x,
          y: drawBox.y,
          width: drawBox.width,
          height: drawBox.height,
          rotate: degrees(drawBox.rotateCcwDeg),
        });
      }

      if (placement.requiresClip) {
        outPage.pushOperators(popGraphicsState());
      }
    }

    // Vector guillotine crop marks (0.35 pt crisp registration dark gray/black)
    if (sheet.cropMarks.length > 0) {
      for (const seg of sheet.cropMarks) {
        outPage.drawLine({
          start: { x: seg.x1Pt, y: seg.y1Pt },
          end: { x: seg.x2Pt, y: seg.y2Pt },
          thickness: 0.35,
          color: rgb(0.15, 0.15, 0.15),
        });
      }
    }

    // Yield periodically on huge jobs to keep UI responsive
    if (i % 4 === 3) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  onProgress?.(95, 'در حال نهایی‌سازی بایت‌های فایل PDF...');
  const finalBytes = await outDoc.save({ useObjectStreams: true });
  onProgress?.(100, 'فایل PDF برداری آماده شد.');
  return finalBytes;
}
