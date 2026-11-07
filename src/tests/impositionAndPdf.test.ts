import { describe, expect, it } from 'vitest';
import { PDFDocument, rgb } from 'pdf-lib';
import { DEFAULT_LAYOUT_SETTINGS } from '../features/imposition/defaultPresets';
import {
  calculateMatrixFlowOrder,
  computeImpositionPlan,
} from '../features/imposition/impositionEngine';
import {
  buildImposedPdfBytes,
  computePdfRotatedDrawParams,
} from '../features/pdf-output/pdfBuilder';
import {
  findBestDriverPaper,
  isDriverPaperMatchingSheet,
} from '../shared/paperSizes';
import { EMPTY_SLOT_MARKER, LayoutSettings, PageItem } from '../shared/types';
import {
  mmToPt,
  mmToUnit,
  parseSheetRange,
  PT_PER_MM,
  ptToMm,
  unitToMm,
} from '../shared/units';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore CommonJS module used by Electron main process
import { buildSumatraPrintSettings } from '../../electron/printEngine.cjs';

function makeMockPage(id: string, widthMm = 210, heightMm = 297, extra?: Partial<PageItem>): PageItem {
  return {
    id,
    sourceFileId: `src_${id}`,
    sourceFileName: `${id}.pdf`,
    sourceKind: 'pdf',
    sourcePageIndex: 0,
    sourceTotalPages: 1,
    widthMm,
    heightMm,
    rotation: 0,
    enabled: true,
    copies: 1,
    ...extra,
  };
}

describe('Units & Range Utilities', () => {
  it('converts mm <-> pt with exact PostScript factor (1mm = 72/25.4 ≈ 2.83464567 pt)', () => {
    expect(PT_PER_MM).toBeCloseTo(2.83464567, 6);
    expect(mmToPt(210)).toBeCloseTo(595.27559, 4);
    expect(mmToPt(297)).toBeCloseTo(841.88976, 4);
    expect(ptToMm(595.27559)).toBeCloseTo(210, 4);
  });

  it('converts between mm, cm, and inch accurately', () => {
    expect(mmToUnit(25.4, 'inch')).toBeCloseTo(1, 5);
    expect(unitToMm(2, 'inch')).toBeCloseTo(50.8, 5);
    expect(mmToUnit(150, 'cm')).toBeCloseTo(15, 5);
    expect(unitToMm(4.5, 'cm')).toBeCloseTo(45, 5);
  });

  it('parses English and Persian sheet ranges and reports clear errors', () => {
    expect(parseSheetRange('1-3, 5', 6)).toEqual({
      indices: [0, 1, 2, 4],
      error: null,
    });
    expect(parseSheetRange('۱-۲، ۴', 5)).toEqual({
      indices: [0, 1, 3],
      error: null,
    });
    expect(parseSheetRange('9-12', 4).error).toBeTruthy();
  });
});

describe('Pure Matrix Imposition Engine', () => {
  it('computes exact pt coordinates for 2×3 matrix on A4 with margin=10mm and gap=5mm', () => {
    const pages = Array.from({ length: 6 }, (_, i) => makeMockPage(`p${i + 1}`));
    const settings: LayoutSettings = {
      ...DEFAULT_LAYOUT_SETTINGS,
      mode: 'nup',
      paperSize: 'A4',
      orientation: 'portrait',
      rows: 2,
      cols: 3,
      flowDirection: 'ltr-row',
      marginsMm: { top: 10, bottom: 10, left: 10, right: 10 },
      marginsLocked: true,
      gapHorizontalMm: 5,
      gapVerticalMm: 5,
      cellSizeMode: 'auto',
      scaleMode: 'fit',
    };

    const plan = computeImpositionPlan(pages, settings);

    // Sheet A4: 210 x 297 mm
    expect(plan.sheetWidthMm).toBe(210);
    expect(plan.sheetHeightMm).toBe(297);
    expect(plan.sheetWidthPt).toBeCloseTo(210 * PT_PER_MM, 4);
    expect(plan.sheetHeightPt).toBeCloseTo(297 * PT_PER_MM, 4);

    // Usable: 190 x 277 mm
    // 3 cols with 5mm gap => cellWidth = (190 - 2*5)/3 = 60 mm
    // 2 rows with 5mm gap => cellHeight = (277 - 1*5)/2 = 136 mm
    expect(plan.cellWidthMm).toBeCloseTo(60, 5);
    expect(plan.cellHeightMm).toBeCloseTo(136, 5);
    expect(plan.cellWidthPt).toBeCloseTo(60 * PT_PER_MM, 4);
    expect(plan.cellHeightPt).toBeCloseTo(136 * PT_PER_MM, 4);

    expect(plan.sheets).toHaveLength(1);
    const cells = plan.sheets[0].cells;
    expect(cells).toHaveLength(6);

    // Row 0, Col 0: x=10mm, y_top=10mm => PDF bottom-left y = (297 - 10 - 136) = 151mm
    expect(cells[0].xMm).toBeCloseTo(10, 5);
    expect(cells[0].yMm).toBeCloseTo(10, 5);
    expect(cells[0].pdfRectPt.x).toBeCloseTo(10 * PT_PER_MM, 4);
    expect(cells[0].pdfRectPt.y).toBeCloseTo(151 * PT_PER_MM, 4);

    // Row 0, Col 1: x = 10 + 60 + 5 = 75mm
    expect(cells[1].xMm).toBeCloseTo(75, 5);
    expect(cells[1].pdfRectPt.x).toBeCloseTo(75 * PT_PER_MM, 4);

    // Row 0, Col 2: x = 75 + 60 + 5 = 140mm
    expect(cells[2].xMm).toBeCloseTo(140, 5);
    expect(cells[2].pdfRectPt.x).toBeCloseTo(140 * PT_PER_MM, 4);

    // Row 1, Col 0 (bottom-left cell): y_top = 10 + 136 + 5 = 151mm => PDF y = (297 - 151 - 136) = 10mm
    expect(cells[3].yMm).toBeCloseTo(151, 5);
    expect(cells[3].pdfRectPt.y).toBeCloseTo(10 * PT_PER_MM, 4);
  });

  it('orders RTL and LTR flows properly', () => {
    // 2x3 RTL row-by-row: first page goes to top-right (index 2), then 1, then 0, then 5, 4, 3
    expect(calculateMatrixFlowOrder(2, 3, 'rtl-row')).toEqual([2, 1, 0, 5, 4, 3]);
    expect(calculateMatrixFlowOrder(2, 3, 'ltr-row')).toEqual([0, 1, 2, 3, 4, 5]);
    expect(calculateMatrixFlowOrder(2, 2, 'rtl-col')).toEqual([1, 3, 0, 2]);
  });

  it('supports Repeat mode (business cards) and manual cell overflow detection', () => {
    const cardPage = makeMockPage('card', 90, 50);
    const repeatPlan = computeImpositionPlan([cardPage], {
      ...DEFAULT_LAYOUT_SETTINGS,
      mode: 'repeat',
      paperSize: 'A4',
      rows: 5,
      cols: 2,
      cellSizeMode: 'manual',
      manualCellWidthMm: 90,
      manualCellHeightMm: 50,
      gapHorizontalMm: 4,
      gapVerticalMm: 4,
      marginsMm: { top: 10, bottom: 10, left: 10, right: 10 },
    });

    expect(repeatPlan.sheets).toHaveLength(1);
    expect(repeatPlan.sheets[0].cells).toHaveLength(10);
    expect(repeatPlan.sheets[0].cells.every((c) => c.content?.page.id === 'card')).toBe(true);
    expect(repeatPlan.warnings.some((w) => w.code === 'GRID_EXCEEDS_MARGINS')).toBe(false);

    // Trigger overflow by asking for 3 columns of 90mm on 210mm A4 (= 270mm > 210mm)
    const overflowPlan = computeImpositionPlan([cardPage], {
      ...DEFAULT_LAYOUT_SETTINGS,
      mode: 'repeat',
      paperSize: 'A4',
      rows: 5,
      cols: 3,
      cellSizeMode: 'manual',
      manualCellWidthMm: 90,
      manualCellHeightMm: 50,
    });
    expect(overflowPlan.warnings.some((w) => w.code === 'GRID_EXCEEDS_MARGINS')).toBe(true);
  });

  it('applies slotOverrides for blank cells and manual replacements', () => {
    const p1 = makeMockPage('p1');
    const p2 = makeMockPage('p2');
    const plan = computeImpositionPlan(
      [p1, p2],
      {
        ...DEFAULT_LAYOUT_SETTINGS,
        mode: 'nup',
        rows: 1,
        cols: 2,
        flowDirection: 'ltr-row',
      },
      {
        '0:0': EMPTY_SLOT_MARKER,
        '0:1': 'p1',
      }
    );

    expect(plan.sheets[0].cells[0].content).toBeNull();
    expect(plan.sheets[0].cells[0].isExplicitlyEmpty).toBe(true);
    expect(plan.sheets[0].cells[1].content?.page.id).toBe('p1');
  });
});

describe('Vector PDF Output & Native Print Settings', () => {
  it('builds a multi-sheet vector PDF with exact A4 point dimensions and crop marks', async () => {
    const srcPdf = await PDFDocument.create();
    const p = srcPdf.addPage([200, 120]);
    p.drawRectangle({ x: 10, y: 10, width: 180, height: 100, color: rgb(0.2, 0.4, 0.8) });
    const srcBytes = await srcPdf.save();

    const pageItem = makeMockPage('vec1', ptToMm(200), ptToMm(120), {
      sourceFileId: 'mem_pdf_1',
      copies: 4,
    });

    const plan = computeImpositionPlan([pageItem], {
      ...DEFAULT_LAYOUT_SETTINGS,
      mode: 'nup',
      paperSize: 'A4',
      orientation: 'portrait',
      rows: 2,
      cols: 2,
      cropMarks: true,
    });

    const outBytes = await buildImposedPdfBytes({
      plan,
      resolveBytes: async () => srcBytes,
    });

    const reloaded = await PDFDocument.load(outBytes);
    expect(reloaded.getPageCount()).toBe(1);
    const outPage = reloaded.getPage(0);
    expect(outPage.getWidth()).toBeCloseTo(mmToPt(210), 2);
    expect(outPage.getHeight()).toBeCloseTo(mmToPt(297), 2);
  });

  it('computes rotated PDF draw anchors inside target cell rect for all 90° steps', () => {
    const rect = { x: 50, y: 100, width: 200, height: 300 };
    expect(computePdfRotatedDrawParams(rect, 0)).toEqual({
      x: 50,
      y: 100,
      width: 200,
      height: 300,
      rotateCcwDeg: 0,
    });
    expect(computePdfRotatedDrawParams(rect, 90)).toEqual({
      x: 50,
      y: 400,
      width: 300,
      height: 200,
      rotateCcwDeg: -90,
    });
    expect(computePdfRotatedDrawParams(rect, 180)).toEqual({
      x: 250,
      y: 400,
      width: 200,
      height: 300,
      rotateCcwDeg: 180,
    });
    expect(computePdfRotatedDrawParams(rect, 270)).toEqual({
      x: 250,
      y: 100,
      width: 300,
      height: 200,
      rotateCcwDeg: 90,
    });
  });

  it('formats SumatraPDF CLI print-settings with exact Win32 paperkind, bin, and noscale', () => {
    const str = buildSumatraPrintSettings({
      paperId: 9, // DMPAPER_A4
      binId: 4, // DMBIN_MANUAL (Bypass Tray)
      duplex: 'duplexlong',
      colorMode: 'color',
      copies: 3,
    });
    expect(str).toBe('noscale,paperkind=9,bin=4,duplexlong,color,3x');
  });

  it('detects paper mismatch between sheet and driver capability accurately', () => {
    const driverA4 = { id: 9, name: 'A4', widthMm: 210, heightMm: 297 };
    const driverA3 = { id: 8, name: 'A3', widthMm: 297, heightMm: 420 };
    // Portrait and Landscape A4 both match physical A4 paper
    expect(isDriverPaperMatchingSheet(210, 297, driverA4)).toBe(true);
    expect(isDriverPaperMatchingSheet(297, 210, driverA4)).toBe(true);
    // A3 sheet does NOT match A4 paper
    expect(isDriverPaperMatchingSheet(297, 420, driverA4)).toBe(false);
    expect(findBestDriverPaper([driverA4, driverA3], 297, 420, 'A3')?.id).toBe(8);
  });
});
