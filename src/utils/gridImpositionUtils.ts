import { GridLayoutSettings, PaperSize, PrintOrientation } from '../types';

export interface GridCellData {
  pageNumber: number;
  dataUrl: string;
  sourceFileName: string;
}

export interface ImposedSheet {
  sheetIndex: number;
  cells: (GridCellData | null)[]; // length = rows * cols
}

/**
 * Calculates cell coordinates for each cell in the grid
 */
export function calculateGridCellOrder(
  rows: number,
  cols: number,
  order: GridLayoutSettings['order']
): number[] {
  const total = rows * cols;
  const indices: number[] = new Array(total);

  let counter = 0;

  if (order === 'rtl-rows') {
    // Row by row, from Right to Left (Standard Persian RTL: 2 1 / 4 3)
    for (let r = 0; r < rows; r++) {
      for (let c = cols - 1; c >= 0; c--) {
        indices[r * cols + c] = counter++;
      }
    }
  } else if (order === 'ltr-rows') {
    // Row by row, from Left to Right (Standard LTR: 1 2 / 3 4)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        indices[r * cols + c] = counter++;
      }
    }
  } else if (order === 'rtl-cols') {
    // Column by column, from Right to Left
    for (let c = cols - 1; c >= 0; c--) {
      for (let r = 0; r < rows; r++) {
        indices[r * cols + c] = counter++;
      }
    }
  } else {
    // Column by column, from Left to Right
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        indices[r * cols + c] = counter++;
      }
    }
  }

  return indices;
}

/**
 * Calculates saddle-stitch booklet page sequence for 2-Up duplex printing.
 * Total pages are padded to a multiple of 4 with blank pages.
 * Sheet 1 Front: [Page N, Page 1]
 * Sheet 1 Back:  [Page 2, Page N-1]
 * Sheet 2 Front: [Page N-2, Page 3]
 * Sheet 2 Back:  [Page 4, Page N-3]
 */
export function calculateBookletPageOrder<T>(pages: T[], blankFactory: () => T): T[] {
  if (pages.length === 0) return [];
  const rem = pages.length % 4;
  const paddingNeeded = rem === 0 ? 0 : 4 - rem;
  const padded = [...pages];
  for (let i = 0; i < paddingNeeded; i++) {
    padded.push(blankFactory());
  }

  const n = padded.length;
  const sheetsCount = n / 4;
  const result: T[] = [];

  for (let s = 0; s < sheetsCount; s++) {
    // Sheet s Front
    result.push(padded[n - 1 - 2 * s]);
    result.push(padded[2 * s]);

    // Sheet s Back
    result.push(padded[2 * s + 1]);
    result.push(padded[n - 2 - 2 * s]);
  }

  return result;
}

/**
 * Groups pages into sheets based on grid layout & repeat settings
 */
export function buildImposedSheets(
  pages: GridCellData[],
  settings: GridLayoutSettings
): ImposedSheet[] {
  const { rows, cols, repeatPage, order } = settings;
  const cellsPerSheet = rows * cols;
  const cellOrder = calculateGridCellOrder(rows, cols, order);

  if (pages.length === 0) return [];

  const sheets: ImposedSheet[] = [];

  if (repeatPage) {
    // Each input page produces 1 sheet with that page repeated in ALL cells
    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const page = pages[pIdx];
      const cells: (GridCellData | null)[] = new Array(cellsPerSheet).fill(page);
      sheets.push({
        sheetIndex: pIdx + 1,
        cells,
      });
    }
  } else {
    // Sequential flow: pages placed according to order
    const totalSheets = Math.ceil(pages.length / cellsPerSheet);

    for (let s = 0; s < totalSheets; s++) {
      const sheetPages = pages.slice(s * cellsPerSheet, (s + 1) * cellsPerSheet);
      const cells: (GridCellData | null)[] = new Array(cellsPerSheet).fill(null);

      // Place pages according to directional cell order
      for (let i = 0; i < sheetPages.length; i++) {
        const slotIdx = cellOrder.indexOf(i);
        if (slotIdx !== -1) {
          cells[slotIdx] = sheetPages[i];
        } else {
          cells[i] = sheetPages[i];
        }
      }

      sheets.push({
        sheetIndex: s + 1,
        cells,
      });
    }
  }

  // Apply custom assignedPageIndex cell overrides if specified
  if (settings.customCellOverrides) {
    for (const sheet of sheets) {
      for (let c = 0; c < cellsPerSheet; c++) {
        const override = settings.customCellOverrides[c];
        if (override?.assignedPageIndex !== undefined && pages[override.assignedPageIndex]) {
          sheet.cells[c] = pages[override.assignedPageIndex];
        }
      }
    }
  }

  return sheets;
}

/**
 * Renders a full imposed sheet to an HTML5 Canvas and returns dataUrl
 */
export async function renderImposedSheetCanvas(
  sheet: ImposedSheet,
  settings: GridLayoutSettings,
  paperWidthMm: number,
  paperHeightMm: number,
  scale = 2.0 // render resolution multiplier
): Promise<string> {
  const {
    rows,
    cols,
    horizontalGapMm,
    verticalGapMm,
    cellScalePercent,
    offsetXPercent,
    offsetYPercent,
    showCutMarks,
    showMarginGuides,
  } = settings;

  // 4 Independent margins
  const marginTopMm = settings.marginTopMm ?? settings.outerMarginMm ?? 8;
  const marginBottomMm = settings.marginBottomMm ?? settings.outerMarginMm ?? 8;
  const marginLeftMm = settings.marginLeftMm ?? settings.outerMarginMm ?? 8;
  const marginRightMm = settings.marginRightMm ?? settings.outerMarginMm ?? 8;

  // Pixels per mm
  const ppm = 3.7795 * scale; // ~96dpi * scale
  const canvasWidth = Math.round(paperWidthMm * ppm);
  const canvasHeight = Math.round(paperHeightMm * ppm);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background white sheet
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Usable area inside 4 margins
  const topPx = marginTopMm * ppm;
  const bottomPx = marginBottomMm * ppm;
  const leftPx = marginLeftMm * ppm;
  const rightPx = marginRightMm * ppm;

  const hGapPx = horizontalGapMm * ppm;
  const vGapPx = verticalGapMm * ppm;

  const gridAreaWidth = Math.max(10, canvasWidth - leftPx - rightPx);
  const gridAreaHeight = Math.max(10, canvasHeight - topPx - bottomPx);

  const cellWidth = Math.max(5, (gridAreaWidth - (cols - 1) * hGapPx) / cols);
  const cellHeight = Math.max(5, (gridAreaHeight - (rows - 1) * vGapPx) / rows);

  // Pre-load images
  const loadedImages: Record<number, HTMLImageElement> = {};
  await Promise.all(
    sheet.cells.map(async (cell, idx) => {
      if (!cell) return;
      const img = new Image();
      img.src = cell.dataUrl;
      await new Promise((res) => {
        img.onload = res;
        img.onerror = res;
      });
      loadedImages[idx] = img;
    })
  );

  // Draw margin guidelines if enabled
  if (showMarginGuides) {
    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(leftPx, topPx, gridAreaWidth, gridAreaHeight);
    ctx.restore();
  }

  // Draw cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellIdx = r * cols + c;
      const cellData = sheet.cells[cellIdx];
      const img = loadedImages[cellIdx];

      const cellOverride = settings.customCellOverrides?.[cellIdx];

      const customShiftX = ((cellOverride?.offsetXPercent ?? offsetXPercent) / 100) * cellWidth;
      const customShiftY = ((cellOverride?.offsetYPercent ?? offsetYPercent) / 100) * cellHeight;
      const customScale = (cellOverride?.scalePercent ?? cellScalePercent) / 100;
      const customRotation = cellOverride?.rotation ?? 0;

      const effectiveCellW = cellOverride?.widthMm ? cellOverride.widthMm * ppm : cellWidth;
      const effectiveCellH = cellOverride?.heightMm ? cellOverride.heightMm * ppm : cellHeight;

      const cellX = leftPx + c * (cellWidth + hGapPx);
      const cellY = topPx + r * (cellHeight + vGapPx);

      // Draw cut guidelines / borders if enabled
      if (showCutMarks) {
        ctx.save();
        ctx.strokeStyle = cellOverride ? '#3b82f6' : '#cbd5e1';
        ctx.lineWidth = cellOverride ? 1.5 : 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(cellX, cellY, effectiveCellW, effectiveCellH);
        ctx.restore();
      }

      // Draw custom solid cell border if requested
      if (cellOverride?.border) {
        ctx.save();
        ctx.strokeStyle = cellOverride.borderColor || '#1e293b';
        ctx.lineWidth = (cellOverride.borderWidth || 1) * ppm * 0.3;
        ctx.setLineDash([]);
        ctx.strokeRect(cellX, cellY, effectiveCellW, effectiveCellH);
        ctx.restore();
      }

      if (cellData && img && img.naturalWidth > 0 && !cellOverride?.hidden) {
        // Source crop rectangle
        const crop = cellOverride?.crop || { top: 0, bottom: 0, left: 0, right: 0 };
        const sx = ((crop.left || 0) / 100) * img.naturalWidth;
        const sy = ((crop.top || 0) / 100) * img.naturalHeight;
        const sw = Math.max(1, img.naturalWidth - sx - ((crop.right || 0) / 100) * img.naturalWidth);
        const sh = Math.max(1, img.naturalHeight - sy - ((crop.bottom || 0) / 100) * img.naturalHeight);

        // Calculate image aspect ratio fitting within cell
        const imgAspect = sw / sh;
        const cellAspect = effectiveCellW / effectiveCellH;

        let drawW = effectiveCellW;
        let drawH = effectiveCellH;

        if (imgAspect > cellAspect) {
          drawW = effectiveCellW;
          drawH = effectiveCellW / imgAspect;
        } else {
          drawH = effectiveCellH;
          drawW = effectiveCellH * imgAspect;
        }

        // Apply cell scale & offsets
        drawW *= customScale;
        drawH *= customScale;

        const imgCenterX = cellX + effectiveCellW / 2 + customShiftX;
        const imgCenterY = cellY + effectiveCellH / 2 + customShiftY;

        ctx.save();
        // Clip to cell bounds so image doesn't bleed into neighbor cells
        ctx.beginPath();
        ctx.rect(cellX, cellY, effectiveCellW, effectiveCellH);
        ctx.clip();

        // Apply cell-specific image filters
        const filters: string[] = [];
        if (cellOverride?.brightness !== undefined && cellOverride.brightness !== 100) {
          filters.push(`brightness(${cellOverride.brightness}%)`);
        }
        if (cellOverride?.contrast !== undefined && cellOverride.contrast !== 100) {
          filters.push(`contrast(${cellOverride.contrast}%)`);
        }
        if (cellOverride?.grayscale) {
          filters.push('grayscale(100%)');
        }
        if (cellOverride?.invert) {
          filters.push('invert(100%)');
        }
        if (filters.length > 0) {
          ctx.filter = filters.join(' ');
        }

        const totalCellAngle = (customRotation || 0) + (cellOverride?.fineAngle || 0);

        if (totalCellAngle !== 0) {
          ctx.translate(imgCenterX, imgCenterY);
          ctx.rotate((totalCellAngle * Math.PI) / 180);
          ctx.drawImage(img, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
        } else {
          ctx.drawImage(img, sx, sy, sw, sh, imgCenterX - drawW / 2, imgCenterY - drawH / 2, drawW, drawH);
        }
        ctx.restore();
      }
    }
  }

  // Draw crop corner marks at sheet edges if showCutMarks is enabled
  if (showCutMarks) {
    ctx.save();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    const markLength = 8 * ppm;

    // 4 corners of margins
    const x0 = leftPx;
    const y0 = topPx;
    const x1 = canvasWidth - rightPx;
    const y1 = canvasHeight - bottomPx;

    // Top-Left mark
    ctx.beginPath();
    ctx.moveTo(x0 - markLength, y0);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x0, y0 - markLength);
    ctx.stroke();

    // Top-Right mark
    ctx.beginPath();
    ctx.moveTo(x1 + markLength, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x1, y0 - markLength);
    ctx.stroke();

    // Bottom-Left mark
    ctx.beginPath();
    ctx.moveTo(x0 - markLength, y1);
    ctx.lineTo(x0, y1);
    ctx.lineTo(x0, y1 + markLength);
    ctx.stroke();

    // Bottom-Right mark
    ctx.beginPath();
    ctx.moveTo(x1 + markLength, y1);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1, y1 + markLength);
    ctx.stroke();

    ctx.restore();
  }

  return canvas.toDataURL('image/jpeg', 0.94);
}
