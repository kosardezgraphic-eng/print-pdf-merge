import type { DriverPaperCapability, PaperSizeId, SheetOrientation } from './types';

export interface StandardPaperSpec {
  id: Exclude<PaperSizeId, 'Custom'>;
  nameFa: string;
  shortLabel: string;
  widthMm: number;
  heightMm: number;
  win32PaperId?: number; // Standard DMPAPER_* constant from wingdi.h
}

export const STANDARD_PAPERS: Record<Exclude<PaperSizeId, 'Custom'>, StandardPaperSpec> = {
  A4: {
    id: 'A4',
    nameFa: 'A4 استاندارد (۲۱۰ × ۲۹۷ mm)',
    shortLabel: 'A4',
    widthMm: 210,
    heightMm: 297,
    win32PaperId: 9, // DMPAPER_A4
  },
  A3: {
    id: 'A3',
    nameFa: 'A3 استاندارد (۲۹۷ × ۴۲۰ mm)',
    shortLabel: 'A3',
    widthMm: 297,
    heightMm: 420,
    win32PaperId: 8, // DMPAPER_A3
  },
  A5: {
    id: 'A5',
    nameFa: 'A5 استاندارد (۱۴۸ × ۲۱۰ mm)',
    shortLabel: 'A5',
    widthMm: 148,
    heightMm: 210,
    win32PaperId: 11, // DMPAPER_A5
  },
  SRA3: {
    id: 'SRA3',
    nameFa: 'SRA3 چاپ دیجیتال (۳۲۰ × ۴۵۰ mm)',
    shortLabel: 'SRA3',
    widthMm: 320,
    heightMm: 450,
  },
  B5: {
    id: 'B5',
    nameFa: 'B5 ایزو (۱۷۶ × ۲۵۰ mm)',
    shortLabel: 'B5',
    widthMm: 176,
    heightMm: 250,
    win32PaperId: 42, // DMPAPER_ISO_B5 (or 13 JIS B5)
  },
  B4: {
    id: 'B4',
    nameFa: 'B4 ایزو (۲۵۰ × ۳۵۳ mm)',
    shortLabel: 'B4',
    widthMm: 250,
    heightMm: 353,
    win32PaperId: 12,
  },
  Letter: {
    id: 'Letter',
    nameFa: 'Letter (۲۱۵.۹ × ۲۷۹.۴ mm)',
    shortLabel: 'Letter',
    widthMm: 215.9,
    heightMm: 279.4,
    win32PaperId: 1, // DMPAPER_LETTER
  },
  Legal: {
    id: 'Legal',
    nameFa: 'Legal (۲۱۵.۹ × ۳۵۵.۶ mm)',
    shortLabel: 'Legal',
    widthMm: 215.9,
    heightMm: 355.6,
    win32PaperId: 5, // DMPAPER_LEGAL
  },
};

export const PAPER_SIZE_LIST: PaperSizeId[] = [
  'A4',
  'A3',
  'A5',
  'SRA3',
  'B5',
  'B4',
  'Letter',
  'Legal',
  'Custom',
];

/**
 * Resolve exact sheet width & height in mm taking orientation into account.
 */
export function resolveSheetDimensionsMm(
  paperSize: PaperSizeId,
  orientation: SheetOrientation,
  customWidthMm: number,
  customHeightMm: number
): { widthMm: number; heightMm: number } {
  const base =
    paperSize === 'Custom'
      ? {
          widthMm: Math.max(20, customWidthMm || 210),
          heightMm: Math.max(20, customHeightMm || 297),
        }
      : STANDARD_PAPERS[paperSize];

  const shortSide = Math.min(base.widthMm, base.heightMm);
  const longSide = Math.max(base.widthMm, base.heightMm);

  if (orientation === 'landscape') {
    return { widthMm: longSide, heightMm: shortSide };
  }
  return { widthMm: shortSide, heightMm: longSide };
}

/**
 * Check whether a printer driver's selected paper matches the layout sheet dimensions
 * (orientation-agnostic because PDF page dimensions handle portrait/landscape orientation,
 * while physical paper loaded in the tray has fixed physical dimensions).
 */
export function isDriverPaperMatchingSheet(
  sheetWidthMm: number,
  sheetHeightMm: number,
  driverPaper: Pick<DriverPaperCapability, 'widthMm' | 'heightMm'> | null | undefined,
  toleranceMm = 3.5
): boolean {
  if (!driverPaper || driverPaper.widthMm <= 0 || driverPaper.heightMm <= 0) {
    return true; // Unknown physical size from driver; don't show false alarm
  }
  const sheetShort = Math.min(sheetWidthMm, sheetHeightMm);
  const sheetLong = Math.max(sheetWidthMm, sheetHeightMm);
  const paperShort = Math.min(driverPaper.widthMm, driverPaper.heightMm);
  const paperLong = Math.max(driverPaper.widthMm, driverPaper.heightMm);

  return (
    Math.abs(sheetShort - paperShort) <= toleranceMm &&
    Math.abs(sheetLong - paperLong) <= toleranceMm
  );
}

/**
 * Find the best matching driver paper capability for a target sheet dimension.
 */
export function findBestDriverPaper(
  papers: DriverPaperCapability[],
  sheetWidthMm: number,
  sheetHeightMm: number,
  preferredPaperSizeId?: PaperSizeId
): DriverPaperCapability | undefined {
  if (papers.length === 0) return undefined;

  if (preferredPaperSizeId && preferredPaperSizeId !== 'Custom') {
    const win32Id = STANDARD_PAPERS[preferredPaperSizeId]?.win32PaperId;
    if (win32Id !== undefined) {
      const exactIdMatch = papers.find((p) => p.id === win32Id);
      if (exactIdMatch) return exactIdMatch;
    }
  }

  return papers.find((p) => isDriverPaperMatchingSheet(sheetWidthMm, sheetHeightMm, p, 3.5));
}
