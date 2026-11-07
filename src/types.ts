export type TextAlignment = 'right' | 'center' | 'left';
export type NumberingNumberFormat = 'persian' | 'english' | 'roman' | 'abjad';

export type OverlayTargetScope =
  | 'all'
  | 'even'
  | 'odd'
  | 'first'
  | 'last'
  | 'current'
  | 'selected';

export interface PageOverlayText {
  id: string;
  text: string;
  xPercent: number; // 0 to 100%
  yPercent: number; // 0 to 100%
  fontSize: number; // pt or px, default 18
  fontFamily: string; // Vazirmatn, Shabnam, Sahel, IranNastaliq, B Titr, Arial, etc.
  color: string; // hex / rgba
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align: TextAlignment;
  opacity: number; // 0 to 1
  rotation: number; // degrees
  syncGroupId?: string; // linked across pages if set
  targetScope?: OverlayTargetScope;
}

export interface PageOverlayNumbering {
  id: string;
  enabled: boolean;
  xPercent: number; // 0 to 100%
  yPercent: number; // 0 to 100%
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  opacity: number;
  format: NumberingNumberFormat; // 'persian' (۱ ۲ ۳), 'english' (1 2 3), 'roman' (I, II, III), 'abjad' (الف، ب، ج...)
  template: string; // e.g., "صفحه {page} از {total}" or "Page {page}" or "{page}" or "No. {pad6}"
  startOffset: number; // starting offset to add, e.g. start from 1 or +5 or 1001
  padZeros?: number; // zero padding length, e.g. 6 for 000125 or 000001
  customScript?: string; // custom JS evaluation or formula e.g. "page * 2" or "page + 10"
  syncGroupId?: string;
  targetScope?: OverlayTargetScope;
}

export interface CanvasGuideline {
  id: string;
  type: 'horizontal' | 'vertical';
  positionPercent: number; // 0 to 100% of canvas width/height
  color?: string;
}

export type ShapeType =
  | 'rectangle'
  | 'rounded-rect'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'triangle'
  | 'polygon'
  | 'star'
  | 'diamond'
  | 'badge';

export interface PageOverlayShape {
  id: string;
  type: ShapeType;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  fillColor: string; // hex / rgba or 'transparent'
  strokeColor: string;
  strokeWidth: number; // px
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  borderRadius?: number; // for rounded-rect
  opacity: number; // 0 to 1
  rotation: number;
  syncGroupId?: string;
  targetScope?: OverlayTargetScope;
}

export interface PageAdjustment {
  brightness: number; // 50% to 200%, default 100%
  contrast: number; // 50% to 200%, default 100%
  grayscale: boolean;
  threshold: boolean; // B&W pure threshold
  invert: boolean;
  crop: {
    top: number; // percent 0 to 40
    bottom: number;
    left: number;
    right: number;
  };
  rotation: number; // 0, 90, 180, 270
  fineAngle?: number; // Fine deskew angle in degrees (-45 to +45 with 0.1 deg step)
  offsetX?: number; // Horizontal image position offset in percent (-50 to +50)
  offsetY?: number; // Vertical image position offset in percent (-50 to +50)
  scale?: number; // Image scale percent (50 to 200, default 100)
  selectedForPrint: boolean;
  texts?: PageOverlayText[];
  shapes?: PageOverlayShape[];
  pageNumbering?: PageOverlayNumbering;
  pageNumberings?: PageOverlayNumbering[];
}

export interface CustomCellOverride {
  offsetXPercent?: number; // relative shift in percent (-100% to +100%)
  offsetYPercent?: number; // relative shift in percent (-100% to +100%)
  scalePercent?: number; // cell-specific scale percent (20% to 300%)
  widthMm?: number; // custom cell width in mm
  heightMm?: number; // custom cell height in mm
  rotation?: number; // cell-specific rotation in degrees (0, 90, 180, 270)
  fineAngle?: number; // fine deskew angle (-45 to +45)
  brightness?: number; // 50% to 200%
  contrast?: number; // 50% to 200%
  grayscale?: boolean;
  threshold?: boolean;
  invert?: boolean;
  crop?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  border?: boolean;
  borderColor?: string;
  borderWidth?: number;
  hidden?: boolean;
  assignedPageIndex?: number;
}

export interface PDFItem {
  id: string;
  name: string;
  size: number;
  file: File;
  pageCount: number | null;
  status: 'loading' | 'ready' | 'error';
  errorMessage?: string;
  pageRange?: string; // e.g., "all" or "1-5, 8"
  rotation?: number; // 0, 90, 180, 270
  selected: boolean;
  addedAt: number;
  previewUrl?: string;
  pageAdjustments?: Record<number, PageAdjustment>;
}

export type SortBy = 'order' | 'name-asc' | 'name-desc' | 'pages-asc' | 'pages-desc' | 'size-asc' | 'size-desc';

export type ViewMode = 'table' | 'cards';

export type Language = 'fa' | 'en';

export type GridFlowOrder = 'rtl-rows' | 'ltr-rows' | 'rtl-cols' | 'ltr-cols';

export interface GridLayoutSettings {
  enabled: boolean;
  rows: number; // 1 to 30
  cols: number; // 1 to 30
  repeatPage: boolean; // if true, repeat current page across all grid cells
  order: GridFlowOrder; // direction
  horizontalGapMm: number; // horizontal spacing between cells in mm
  verticalGapMm: number; // vertical spacing between cells in mm
  marginTopMm: number; // margin top in mm
  marginBottomMm: number; // margin bottom in mm
  marginLeftMm: number; // margin left in mm
  marginRightMm: number; // margin right in mm
  outerMarginMm?: number; // legacy uniform margin
  cellScalePercent: number; // 50% to 150% (scaling within cell)
  offsetXPercent: number; // -30% to +30% offset
  offsetYPercent: number; // -30% to +30% offset
  showCutMarks: boolean; // print cutting guidelines for trimming
  showMarginGuides?: boolean; // show margin lines on sheet
  customCellOverrides?: Record<number, CustomCellOverride>; // individual cell position & size overrides
}

export const defaultGridLayoutSettings: GridLayoutSettings = {
  enabled: false,
  rows: 4,
  cols: 3,
  repeatPage: false,
  order: 'rtl-rows',
  horizontalGapMm: 3,
  verticalGapMm: 3,
  marginTopMm: 8,
  marginBottomMm: 8,
  marginLeftMm: 8,
  marginRightMm: 8,
  cellScalePercent: 100,
  offsetXPercent: 0,
  offsetYPercent: 0,
  showCutMarks: true,
  showMarginGuides: true,
};

export type PaperSize = 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'B5';

export const PAPER_DIMENSIONS_MM: Record<
  PaperSize,
  { widthMm: number; heightMm: number; nameFa: string; nameEn: string }
> = {
  A4: { widthMm: 210, heightMm: 297, nameFa: 'A4 (۲۱۰ × ۲۹۷ میلی‌متر)', nameEn: 'A4 (210 × 297 mm)' },
  A3: { widthMm: 297, heightMm: 420, nameFa: 'A3 (۲۹۷ × ۴۲۰ میلی‌متر)', nameEn: 'A3 (297 × 420 mm)' },
  A5: { widthMm: 148, heightMm: 210, nameFa: 'A5 (۱۴۸ × ۲۱۰ میلی‌متر)', nameEn: 'A5 (148 × 210 mm)' },
  Letter: { widthMm: 215.9, heightMm: 279.4, nameFa: 'Letter (۸.۵ × ۱۱ اینچ)', nameEn: 'Letter (8.5 × 11 in)' },
  Legal: { widthMm: 215.9, heightMm: 355.6, nameFa: 'Legal (۸.۵ × ۱۴ اینچ)', nameEn: 'Legal (8.5 × 14 in)' },
  B5: { widthMm: 176, heightMm: 250, nameFa: 'B5 (۱۷۶ × ۲۵۰ میلی‌متر)', nameEn: 'B5 (176 × 250 mm)' },
};

export type PaperTray = 'auto' | 'tray1' | 'tray2' | 'manual' | 'envelope';

export type ColorMode = 'color' | 'grayscale' | 'bw';

export type DuplexMode = 'simplex' | 'duplexLong' | 'duplexShort' | 'booklet';

export type PrintOrientation = 'auto' | 'portrait' | 'landscape';

export type PrintSpoolMode = 'continuous' | 'separate';

export interface PrintSettings {
  printerName: string;
  printSpoolMode: PrintSpoolMode;
  paperSize: PaperSize;
  paperTray: PaperTray;
  colorMode: ColorMode;
  duplex: DuplexMode;
  orientation: PrintOrientation;
  copies: number;
  scaling: 'fit' | 'actual' | 'shrink';
  collate: boolean;
  gridLayout?: GridLayoutSettings;
  gutterMm?: number; // center margin for binding / booklet
  jobFromNewSheet?: boolean; // start each document from a fresh sheet
  oddEvenFilter?: 'all' | 'odd' | 'even';
  reverseOrder?: boolean;
}

export type RibbonTab = 'file' | 'layout' | 'effects' | 'insert' | 'crop' | 'tools' | 'view';

export interface PrintProfile {
  id: string;
  name: string;
  nameFa: string;
  description: string;
  settings: {
    paperSize: PaperSize;
    duplex: DuplexMode;
    colorMode: ColorMode;
    orientation: PrintOrientation;
    copies?: number;
    scaling?: 'fit' | 'actual' | 'shrink';
    gutterMm?: number;
    gridLayout?: Partial<GridLayoutSettings>;
  };
}

export const defaultPrintProfiles: PrintProfile[] = [
  {
    id: 'a4-duplex-bw',
    name: 'Standard A4 Duplex B&W',
    nameFa: 'چاپ اداری A4 دورو سیاه‌وسفید',
    description: 'کاغذ A4، چاپ دورو لبه بلند، سیاه و سفید با صرفه‌جویی در تونر',
    settings: {
      paperSize: 'A4',
      duplex: 'duplexLong',
      colorMode: 'bw',
      orientation: 'portrait',
      scaling: 'fit',
      gutterMm: 0,
      gridLayout: { enabled: false },
    },
  },
  {
    id: 'booklet-a5',
    name: 'Booklet / Brochure (A4 to A5)',
    nameFa: 'جزوه و بوکلت A5 (دو صفحه در برگه A4)',
    description: 'چیدمان ۲ صفحه در یک برگه A4 افقی، دورو لبه کوتاه جهت تا کردن و منگنه',
    settings: {
      paperSize: 'A4',
      duplex: 'booklet',
      colorMode: 'grayscale',
      orientation: 'landscape',
      scaling: 'fit',
      gutterMm: 8,
      gridLayout: {
        enabled: true,
        rows: 1,
        cols: 2,
        order: 'rtl-rows',
        repeatPage: false,
        showCutMarks: true,
        horizontalGapMm: 4,
        verticalGapMm: 0,
        marginTopMm: 8,
        marginBottomMm: 8,
        marginLeftMm: 8,
        marginRightMm: 8,
      },
    },
  },
  {
    id: 'nup-4in1',
    name: '4-Up Study / Handout',
    nameFa: 'مطالعه و خلاصه (۴ صفحه در یک برگ)',
    description: '۴ صفحه در هر برگ A4، فشرده و مرتب برای مطالعه و جزوه کلاسی',
    settings: {
      paperSize: 'A4',
      duplex: 'duplexLong',
      colorMode: 'grayscale',
      orientation: 'portrait',
      scaling: 'fit',
      gutterMm: 0,
      gridLayout: {
        enabled: true,
        rows: 2,
        cols: 2,
        order: 'rtl-rows',
        repeatPage: false,
        showCutMarks: true,
        horizontalGapMm: 3,
        verticalGapMm: 3,
        marginTopMm: 6,
        marginBottomMm: 6,
        marginLeftMm: 6,
        marginRightMm: 6,
      },
    },
  },
  {
    id: 'cards-labels-3x4',
    name: 'Business Cards / Labels (12-Up)',
    nameFa: 'کارت ویزیت و برچسب (۱۲تایی ۳×۴)',
    description: '۱۲ خانه با خطوط راهنمای برش گیوتین و تکرار برگه برای چاپ انبوه',
    settings: {
      paperSize: 'A4',
      duplex: 'simplex',
      colorMode: 'color',
      orientation: 'portrait',
      scaling: 'fit',
      gutterMm: 0,
      gridLayout: {
        enabled: true,
        rows: 4,
        cols: 3,
        order: 'rtl-rows',
        repeatPage: true,
        showCutMarks: true,
        horizontalGapMm: 2,
        verticalGapMm: 2,
        marginTopMm: 8,
        marginBottomMm: 8,
        marginLeftMm: 8,
        marginRightMm: 8,
      },
    },
  },
  {
    id: 'single-high-color',
    name: 'High Quality Full Color',
    nameFa: 'کیفیت بالا تمام‌رنگی تک‌رو',
    description: 'کیفیت طبیعی اصلی و بدون تغییرات فشرده‌سازی برای بروشور و کاتالوگ',
    settings: {
      paperSize: 'A4',
      duplex: 'simplex',
      colorMode: 'color',
      orientation: 'auto',
      scaling: 'actual',
      gutterMm: 0,
      gridLayout: { enabled: false },
    },
  },
];

export interface PrintProgress {
  status: 'idle' | 'rendering' | 'spooling' | 'completed' | 'error';
  currentFile: number;
  totalFiles: number;
  currentPage: number;
  totalPages: number;
  fileName: string;
  percentage: number;
  errorMessage?: string;
}

export interface MergeOptions {
  fileName: string;
  onlySelected: boolean;
  addBookmarks: boolean;
}

export interface ElectronPrinter {
  name: string;
  displayName?: string;
  description?: string;
  status: number;
  isDefault: boolean;
  options?: Record<string, any>;
}

declare global {
  interface Window {
    electronAPI?: {
      isDesktop: boolean;
      platform: string;
      getPrinters: () => Promise<ElectronPrinter[]>;
      printToDevice: (options: {
        deviceName?: string;
        copies?: number;
        duplex?: string;
        colorMode?: string;
        color?: boolean;
        landscape?: boolean;
        paperSize?: string;
        silent?: boolean;
        htmlContent?: string;
        url?: string;
        collate?: boolean;
      }) => Promise<{ success: boolean; cancelled?: boolean }>;
    };
  }
}

