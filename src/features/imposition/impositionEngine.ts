import { resolveSheetDimensionsMm } from '../../shared/paperSizes';
import {
  EMPTY_SLOT_MARKER,
  FlowDirection,
  LayoutSettings,
  PageItem,
  RotationDegrees,
  SlotOverridesMap,
} from '../../shared/types';
import { mmToPt } from '../../shared/units';

export interface PdfRectPt {
  x: number; // From left edge in PDF points (72 DPI)
  y: number; // From bottom edge in PDF points (PDF standard origin)
  width: number;
  height: number;
}

export interface ComputedContentPlacement {
  page: PageItem;
  /** Top-left origin (mm) for screen preview */
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  /** Bottom-left origin (pt) for pdf-lib vector placement */
  pdfRectPt: PdfRectPt;
  /** Combined rotation (0 | 90 | 180 | 270) clockwise in screen space */
  totalRotationCw: RotationDegrees;
  /** Whether auto-rotate added +90° */
  autoRotated: boolean;
  /** Whether content exceeds cell box and must be clipped to cell bounds */
  requiresClip: boolean;
}

export interface ComputedCellLayout {
  cellIndex: number; // 0 .. rows*cols - 1 (row-major: r * cols + c)
  sequenceOrder: number; // 1-based reading order index according to flowDirection
  row: number;
  col: number;
  /** Top-left origin (mm) */
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  /** Bottom-left origin (pt) */
  pdfRectPt: PdfRectPt;
  isOverridden: boolean;
  isExplicitlyEmpty: boolean;
  content: ComputedContentPlacement | null;
}

export interface CropMarkSegment {
  x1Mm: number;
  y1Mm: number;
  x2Mm: number;
  y2Mm: number;
  x1Pt: number;
  y1Pt: number;
  x2Pt: number;
  y2Pt: number;
}

export interface ComputedSheetLayout {
  sheetIndex: number; // 0-based
  sheetNumber: number; // 1-based
  widthMm: number;
  heightMm: number;
  widthPt: number;
  heightPt: number;
  cells: ComputedCellLayout[];
  cropMarks: CropMarkSegment[];
}

export interface LayoutWarning {
  code:
    | 'INVALID_USABLE_AREA'
    | 'GRID_EXCEEDS_MARGINS'
    | 'NEAR_PAPER_EDGE'
    | 'ACTUAL_SIZE_CLIPPED';
  severity: 'error' | 'warning';
  messageFa: string;
}

export interface ImpositionPlan {
  sheetWidthMm: number;
  sheetHeightMm: number;
  sheetWidthPt: number;
  sheetHeightPt: number;
  effectiveRows: number;
  effectiveCols: number;
  cellsPerSheet: number;
  cellWidthMm: number;
  cellHeightMm: number;
  cellWidthPt: number;
  cellHeightPt: number;
  usableBoxMm: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  gridBoxMm: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  sheets: ComputedSheetLayout[];
  totalSourcePagesActive: number;
  totalExpandedItems: number;
  warnings: LayoutWarning[];
}

/**
 * Returns an array `slotToCellIndex` of length `rows * cols`:
 * `slotToCellIndex[sequenceIdx]` gives the visual row-major matrix cell index (`r * cols + c`).
 */
export function calculateMatrixFlowOrder(
  rows: number,
  cols: number,
  flowDirection: FlowDirection
): number[] {
  const safeRows = Math.max(1, Math.floor(rows));
  const safeCols = Math.max(1, Math.floor(cols));
  const result: number[] = [];

  switch (flowDirection) {
    case 'ltr-row':
      for (let r = 0; r < safeRows; r++) {
        for (let c = 0; c < safeCols; c++) {
          result.push(r * safeCols + c);
        }
      }
      break;

    case 'rtl-row':
      for (let r = 0; r < safeRows; r++) {
        for (let c = safeCols - 1; c >= 0; c--) {
          result.push(r * safeCols + c);
        }
      }
      break;

    case 'ltr-col':
      for (let c = 0; c < safeCols; c++) {
        for (let r = 0; r < safeRows; r++) {
          result.push(r * safeCols + c);
        }
      }
      break;

    case 'rtl-col':
      for (let c = safeCols - 1; c >= 0; c--) {
        for (let r = 0; r < safeRows; r++) {
          result.push(r * safeCols + c);
        }
      }
      break;
  }

  return result;
}

/**
 * Convert a top-left rectangle in mm to a PDF bottom-left rectangle in points (72 DPI).
 */
export function toPdfRectPt(
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  sheetHeightMm: number
): PdfRectPt {
  return {
    x: mmToPt(xMm),
    y: mmToPt(sheetHeightMm - yMm - heightMm),
    width: mmToPt(widthMm),
    height: mmToPt(heightMm),
  };
}

/**
 * Expand enabled pages according to each page's `copies` count.
 */
export function expandActivePages(pages: PageItem[]): PageItem[] {
  const expanded: PageItem[] = [];
  for (const page of pages) {
    if (!page.enabled) continue;
    const count = Math.max(1, Math.min(500, Math.floor(page.copies || 1)));
    for (let i = 0; i < count; i++) {
      expanded.push(page);
    }
  }
  return expanded;
}

/**
 * Compute placement of a single PageItem inside a cell box.
 */
export function computeContentPlacementInCell(
  page: PageItem,
  cellXMm: number,
  cellYMm: number,
  cellWidthMm: number,
  cellHeightMm: number,
  sheetHeightMm: number,
  settings: Pick<
    LayoutSettings,
    'scaleMode' | 'alignHorizontal' | 'alignVertical' | 'autoRotate'
  >
): ComputedContentPlacement {
  const rawW = Math.max(1, page.widthMm || 210);
  const rawH = Math.max(1, page.heightMm || 297);

  const userRot = page.rotation;
  let pageW = userRot === 90 || userRot === 270 ? rawH : rawW;
  let pageH = userRot === 90 || userRot === 270 ? rawW : rawH;
  let totalRotationCw: RotationDegrees = userRot;
  let autoRotated = false;

  if (settings.autoRotate && cellWidthMm > 0 && cellHeightMm > 0) {
    const isPageLandscape = pageW - pageH > 0.5;
    const isPagePortrait = pageH - pageW > 0.5;
    const isCellLandscape = cellWidthMm - cellHeightMm > 0.5;
    const isCellPortrait = cellHeightMm - cellWidthMm > 0.5;

    if ((isPageLandscape && isCellPortrait) || (isPagePortrait && isCellLandscape)) {
      totalRotationCw = (((userRot + 90) % 360) as RotationDegrees);
      const tmp = pageW;
      pageW = pageH;
      pageH = tmp;
      autoRotated = true;
    }
  }

  let drawWidthMm = cellWidthMm;
  let drawHeightMm = cellHeightMm;

  switch (settings.scaleMode) {
    case 'fit': {
      const scale = Math.min(cellWidthMm / pageW, cellHeightMm / pageH);
      drawWidthMm = pageW * scale;
      drawHeightMm = pageH * scale;
      break;
    }
    case 'fill': {
      const scale = Math.max(cellWidthMm / pageW, cellHeightMm / pageH);
      drawWidthMm = pageW * scale;
      drawHeightMm = pageH * scale;
      break;
    }
    case 'stretch': {
      drawWidthMm = cellWidthMm;
      drawHeightMm = cellHeightMm;
      break;
    }
    case 'actual': {
      drawWidthMm = pageW;
      drawHeightMm = pageH;
      break;
    }
  }

  let offsetXMm = 0;
  if (settings.alignHorizontal === 'center') {
    offsetXMm = (cellWidthMm - drawWidthMm) / 2;
  } else if (settings.alignHorizontal === 'right') {
    offsetXMm = cellWidthMm - drawWidthMm;
  }

  let offsetYMm = 0;
  if (settings.alignVertical === 'middle') {
    offsetYMm = (cellHeightMm - drawHeightMm) / 2;
  } else if (settings.alignVertical === 'bottom') {
    offsetYMm = cellHeightMm - drawHeightMm;
  }

  const contentXMm = cellXMm + offsetXMm;
  const contentYMm = cellYMm + offsetYMm;
  const requiresClip =
    drawWidthMm > cellWidthMm + 0.02 || drawHeightMm > cellHeightMm + 0.02;

  return {
    page,
    xMm: contentXMm,
    yMm: contentYMm,
    widthMm: drawWidthMm,
    heightMm: drawHeightMm,
    pdfRectPt: toPdfRectPt(contentXMm, contentYMm, drawWidthMm, drawHeightMm, sheetHeightMm),
    totalRotationCw,
    autoRotated,
    requiresClip,
  };
}

/**
 * Generate guillotine perimeter crop marks outside the matrix so cut lines never dirty artwork.
 */
export function buildSheetCropMarks(
  cells: ComputedCellLayout[],
  gridBoxMm: { x: number; y: number; width: number; height: number },
  sheetWidthMm: number,
  sheetHeightMm: number
): CropMarkSegment[] {
  if (cells.length === 0) return [];

  const markOffsetMm = 1.5;
  const markLenMm = 4.0;
  const segments: CropMarkSegment[] = [];

  const addSeg = (x1: number, y1: number, x2: number, y2: number) => {
    const cx1 = Math.max(0, Math.min(sheetWidthMm, x1));
    const cy1 = Math.max(0, Math.min(sheetHeightMm, y1));
    const cx2 = Math.max(0, Math.min(sheetWidthMm, x2));
    const cy2 = Math.max(0, Math.min(sheetHeightMm, y2));
    const len = Math.hypot(cx2 - cx1, cy2 - cy1);
    if (len < 0.4) return;
    segments.push({
      x1Mm: cx1,
      y1Mm: cy1,
      x2Mm: cx2,
      y2Mm: cy2,
      x1Pt: mmToPt(cx1),
      y1Pt: mmToPt(sheetHeightMm - cy1),
      x2Pt: mmToPt(cx2),
      y2Pt: mmToPt(sheetHeightMm - cy2),
    });
  };

  // Unique X cut positions from all column left/right boundaries
  const xStops = new Set<number>();
  const yStops = new Set<number>();
  for (const cell of cells) {
    xStops.add(Number(cell.xMm.toFixed(3)));
    xStops.add(Number((cell.xMm + cell.widthMm).toFixed(3)));
    yStops.add(Number(cell.yMm.toFixed(3)));
    yStops.add(Number((cell.yMm + cell.heightMm).toFixed(3)));
  }

  const topEdge = gridBoxMm.y;
  const bottomEdge = gridBoxMm.y + gridBoxMm.height;
  const leftEdge = gridBoxMm.x;
  const rightEdge = gridBoxMm.x + gridBoxMm.width;

  for (const x of xStops) {
    // Top vertical tick
    addSeg(x, topEdge - markOffsetMm - markLenMm, x, topEdge - markOffsetMm);
    // Bottom vertical tick
    addSeg(x, bottomEdge + markOffsetMm, x, bottomEdge + markOffsetMm + markLenMm);
  }

  for (const y of yStops) {
    // Left horizontal tick
    addSeg(leftEdge - markOffsetMm - markLenMm, y, leftEdge - markOffsetMm, y);
    // Right horizontal tick
    addSeg(rightEdge + markOffsetMm, y, rightEdge + markOffsetMm + markLenMm, y);
  }

  return segments;
}

/**
 * Pure, deterministic matrix imposition engine.
 * Used identically by both the live interactive preview and the pdf-lib vector output builder.
 */
export function computeImpositionPlan(
  pages: PageItem[],
  settings: LayoutSettings,
  slotOverrides: SlotOverridesMap = {}
): ImpositionPlan {
  const { widthMm: sheetWidthMm, heightMm: sheetHeightMm } = resolveSheetDimensionsMm(
    settings.paperSize,
    settings.orientation,
    settings.customWidthMm,
    settings.customHeightMm
  );

  const sheetWidthPt = mmToPt(sheetWidthMm);
  const sheetHeightPt = mmToPt(sheetHeightMm);

  const effectiveRows = settings.mode === 'single' ? 1 : Math.max(1, Math.floor(settings.rows));
  const effectiveCols = settings.mode === 'single' ? 1 : Math.max(1, Math.floor(settings.cols));
  const cellsPerSheet = effectiveRows * effectiveCols;

  const gapX = effectiveCols > 1 ? Math.max(0, settings.gapHorizontalMm) : 0;
  const gapY = effectiveRows > 1 ? Math.max(0, settings.gapVerticalMm) : 0;

  const mTop = Math.max(0, settings.marginsMm.top);
  const mBottom = Math.max(0, settings.marginsMm.bottom);
  const mLeft = Math.max(0, settings.marginsMm.left);
  const mRight = Math.max(0, settings.marginsMm.right);

  const usableWidthMm = sheetWidthMm - mLeft - mRight;
  const usableHeightMm = sheetHeightMm - mTop - mBottom;

  const warnings: LayoutWarning[] = [];

  let rawCellWidthMm: number;
  let rawCellHeightMm: number;

  if (settings.cellSizeMode === 'manual' && settings.mode !== 'single') {
    rawCellWidthMm = Math.max(1, settings.manualCellWidthMm);
    rawCellHeightMm = Math.max(1, settings.manualCellHeightMm);
  } else {
    rawCellWidthMm = (usableWidthMm - (effectiveCols - 1) * gapX) / effectiveCols;
    rawCellHeightMm = (usableHeightMm - (effectiveRows - 1) * gapY) / effectiveRows;
  }

  if (usableWidthMm <= 2 || usableHeightMm <= 2 || rawCellWidthMm <= 1 || rawCellHeightMm <= 1) {
    warnings.push({
      code: 'INVALID_USABLE_AREA',
      severity: 'error',
      messageFa:
        'مجموع حاشیه‌ها و فاصله بین خانه‌ها از ابعاد کاغذ بزرگ‌تر است. لطفاً حاشیه یا تعداد سطر/ستون را کاهش دهید.',
    });
  }

  const cellWidthMm = Math.max(1, rawCellWidthMm);
  const cellHeightMm = Math.max(1, rawCellHeightMm);

  const totalGridWidthMm = effectiveCols * cellWidthMm + (effectiveCols - 1) * gapX;
  const totalGridHeightMm = effectiveRows * cellHeightMm + (effectiveRows - 1) * gapY;

  const gridStartXMm =
    settings.cellSizeMode === 'manual' && settings.mode !== 'single'
      ? mLeft + (usableWidthMm - totalGridWidthMm) / 2
      : mLeft;
  const gridStartYMm =
    settings.cellSizeMode === 'manual' && settings.mode !== 'single'
      ? mTop + (usableHeightMm - totalGridHeightMm) / 2
      : mTop;

  if (
    totalGridWidthMm > usableWidthMm + 0.05 ||
    totalGridHeightMm > usableHeightMm + 0.05
  ) {
    const overX = Math.max(0, totalGridWidthMm - usableWidthMm);
    const overY = Math.max(0, totalGridHeightMm - usableHeightMm);
    warnings.push({
      code: 'GRID_EXCEEDS_MARGINS',
      severity: 'error',
      messageFa: `ابعاد جدول (${totalGridWidthMm.toFixed(1)}×${totalGridHeightMm.toFixed(1)} mm) از ناحیه داخل حاشیه‌ها بیرون زده است${
        overX > 0.05 ? ` (عرض +${overX.toFixed(1)} mm)` : ''
      }${overY > 0.05 ? ` (ارتفاع +${overY.toFixed(1)} mm)` : ''}.`,
    });
  }

  const minEdgeDist = Math.min(
    gridStartXMm,
    gridStartYMm,
    sheetWidthMm - (gridStartXMm + totalGridWidthMm),
    sheetHeightMm - (gridStartYMm + totalGridHeightMm)
  );

  if (settings.bleedWarningMm > 0 && minEdgeDist < settings.bleedWarningMm - 0.01) {
    warnings.push({
      code: 'NEAR_PAPER_EDGE',
      severity: 'warning',
      messageFa: `فاصله محتوا تا لبه کاغذ (${Math.max(0, minEdgeDist).toFixed(1)} mm) کمتر از حاشیه امن چاپگر (${settings.bleedWarningMm} mm) است و ممکن است در چاپگرهای غیر Borderless بریده شود.`,
    });
  }

  const activeSourceCount = pages.filter((p) => p.enabled).length;
  const expandedPages = expandActivePages(pages);
  const pageById = new Map<string, PageItem>(pages.map((p) => [p.id, p]));

  const flowSlotToCellIdx = calculateMatrixFlowOrder(
    effectiveRows,
    effectiveCols,
    settings.flowDirection
  );
  // Inverse map: cellIdx -> 1-based sequence order
  const cellIdxToSequenceOrder = new Array<number>(cellsPerSheet).fill(1);
  flowSlotToCellIdx.forEach((cIdx, seqIdx) => {
    cellIdxToSequenceOrder[cIdx] = seqIdx + 1;
  });

  // Build raw sheet page assignments before slotOverrides
  const rawSheetAssignments: (PageItem | null)[][] = [];

  if (expandedPages.length > 0) {
    if (settings.mode === 'repeat') {
      // Each expanded page gets a full sheet repeating that page in every cell
      for (const pg of expandedPages) {
        rawSheetAssignments.push(new Array<PageItem | null>(cellsPerSheet).fill(pg));
      }
    } else {
      // 'single' (cellsPerSheet=1) or 'nup' (sequential flow across cells)
      const sheetCount = Math.ceil(expandedPages.length / cellsPerSheet);
      for (let s = 0; s < sheetCount; s++) {
        const slice = expandedPages.slice(s * cellsPerSheet, (s + 1) * cellsPerSheet);
        const cellsForSheet = new Array<PageItem | null>(cellsPerSheet).fill(null);
        for (let seqIdx = 0; seqIdx < slice.length; seqIdx++) {
          const targetCellIdx = flowSlotToCellIdx[seqIdx] ?? seqIdx;
          cellsForSheet[targetCellIdx] = slice[seqIdx];
        }
        rawSheetAssignments.push(cellsForSheet);
      }
    }
  }

  let hasActualSizeClippedWarning = false;
  const sheets: ComputedSheetLayout[] = rawSheetAssignments.map((assignedCells, sIdx) => {
    const computedCells: ComputedCellLayout[] = [];

    for (let r = 0; r < effectiveRows; r++) {
      for (let c = 0; c < effectiveCols; c++) {
        const cellIdx = r * effectiveCols + c;
        const xMm = gridStartXMm + c * (cellWidthMm + gapX);
        const yMm = gridStartYMm + r * (cellHeightMm + gapY);

        const overrideKey = `${sIdx}:${cellIdx}`;
        const overrideVal = slotOverrides[overrideKey];

        let effectivePage: PageItem | null = assignedCells[cellIdx] ?? null;
        let isOverridden = false;
        let isExplicitlyEmpty = false;

        if (overrideVal !== undefined) {
          isOverridden = true;
          if (overrideVal === EMPTY_SLOT_MARKER) {
            effectivePage = null;
            isExplicitlyEmpty = true;
          } else {
            effectivePage = pageById.get(overrideVal) ?? effectivePage;
          }
        }

        let content: ComputedContentPlacement | null = null;
        if (effectivePage) {
          content = computeContentPlacementInCell(
            effectivePage,
            xMm,
            yMm,
            cellWidthMm,
            cellHeightMm,
            sheetHeightMm,
            settings
          );
          if (settings.scaleMode === 'actual' && content.requiresClip) {
            hasActualSizeClippedWarning = true;
          }
        }

        computedCells.push({
          cellIndex: cellIdx,
          sequenceOrder: cellIdxToSequenceOrder[cellIdx] ?? cellIdx + 1,
          row: r,
          col: c,
          xMm,
          yMm,
          widthMm: cellWidthMm,
          heightMm: cellHeightMm,
          pdfRectPt: toPdfRectPt(xMm, yMm, cellWidthMm, cellHeightMm, sheetHeightMm),
          isOverridden,
          isExplicitlyEmpty,
          content,
        });
      }
    }

    const gridBox = {
      x: gridStartXMm,
      y: gridStartYMm,
      width: totalGridWidthMm,
      height: totalGridHeightMm,
    };

    const cropMarks = settings.cropMarks
      ? buildSheetCropMarks(computedCells, gridBox, sheetWidthMm, sheetHeightMm)
      : [];

    return {
      sheetIndex: sIdx,
      sheetNumber: sIdx + 1,
      widthMm: sheetWidthMm,
      heightMm: sheetHeightMm,
      widthPt: sheetWidthPt,
      heightPt: sheetHeightPt,
      cells: computedCells,
      cropMarks,
    };
  });

  if (hasActualSizeClippedWarning) {
    warnings.push({
      code: 'ACTUAL_SIZE_CLIPPED',
      severity: 'warning',
      messageFa:
        'در حالت «اندازه اصلی (۱:۱)»، ابعاد برخی صفحات بزرگ‌تر از خانه جدول است و بخش بیرون‌زده برش می‌خورد.',
    });
  }

  return {
    sheetWidthMm,
    sheetHeightMm,
    sheetWidthPt,
    sheetHeightPt,
    effectiveRows,
    effectiveCols,
    cellsPerSheet,
    cellWidthMm,
    cellHeightMm,
    cellWidthPt: mmToPt(cellWidthMm),
    cellHeightPt: mmToPt(cellHeightMm),
    usableBoxMm: {
      x: mLeft,
      y: mTop,
      width: Math.max(0, usableWidthMm),
      height: Math.max(0, usableHeightMm),
    },
    gridBoxMm: {
      x: gridStartXMm,
      y: gridStartYMm,
      width: totalGridWidthMm,
      height: totalGridHeightMm,
    },
    sheets,
    totalSourcePagesActive: activeSourceCount,
    totalExpandedItems: expandedPages.length,
    warnings,
  };
}
