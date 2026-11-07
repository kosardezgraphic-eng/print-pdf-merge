export type PaperSizeId =
  | 'A4'
  | 'A3'
  | 'A5'
  | 'SRA3'
  | 'B5'
  | 'B4'
  | 'Letter'
  | 'Legal'
  | 'Custom';

export type SheetOrientation = 'portrait' | 'landscape';

export type ImpositionMode = 'single' | 'nup' | 'repeat';

export type FlowDirection = 'rtl-row' | 'ltr-row' | 'rtl-col' | 'ltr-col';

export type CellScaleMode = 'fit' | 'fill' | 'stretch' | 'actual';

export type HorizontalAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

export type RotationDegrees = 0 | 90 | 180 | 270;

export type SourceFileKind = 'pdf' | 'image';

export type ImageSubFormat = 'jpeg' | 'png' | 'webp' | 'bmp' | 'tiff';

export interface SourceFileMeta {
  id: string;
  name: string;
  filePath?: string; // Available on Electron desktop via webUtils.getPathForFile
  kind: SourceFileKind;
  imageFormat?: ImageSubFormat;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  addedAt: number;
}

/**
 * Every individual page of every PDF and every image/TIFF frame is an independent item
 * in the workspace thumbnail list.
 */
export interface PageItem {
  id: string;
  sourceFileId: string;
  sourceFileName: string;
  sourceKind: SourceFileKind;
  imageFormat?: ImageSubFormat;
  sourcePageIndex: number; // 0-based page index in source PDF or multi-page TIFF
  sourceTotalPages: number;
  widthMm: number;
  heightMm: number;
  pixelWidth?: number;
  pixelHeight?: number;
  rotation: RotationDegrees;
  enabled: boolean;
  copies: number;
  thumbnailDataUrl?: string;
}

export interface MarginsMm {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface LayoutSettings {
  mode: ImpositionMode;
  paperSize: PaperSizeId;
  customWidthMm: number;
  customHeightMm: number;
  orientation: SheetOrientation;
  rows: number;
  cols: number;
  flowDirection: FlowDirection;
  marginsMm: MarginsMm;
  marginsLocked: boolean;
  gapHorizontalMm: number;
  gapVerticalMm: number;
  cellSizeMode: 'auto' | 'manual';
  manualCellWidthMm: number;
  manualCellHeightMm: number;
  scaleMode: CellScaleMode;
  alignHorizontal: HorizontalAlign;
  alignVertical: VerticalAlign;
  autoRotate: boolean;
  cropMarks: boolean;
  bleedWarningMm: number;
}

export const EMPTY_SLOT_MARKER = '__EMPTY_SLOT__' as const;

/**
 * Key format: `${sheetIndex}:${cellIndex}`
 * Value: `pageItemId` or `EMPTY_SLOT_MARKER`
 */
export type SlotOverridesMap = Record<string, string>;

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  isBuiltIn?: boolean;
  layout: Partial<LayoutSettings>;
}

/**
 * Native Windows Printer & Driver Capabilities (read via winspool.drv DeviceCapabilitiesW)
 */
export interface DriverPaperCapability {
  id: number; // Win32 DMPAPER_* or driver custom ID
  name: string; // From DC_PAPERNAMES
  widthMm: number; // From DC_PAPERSIZE (0.1mm -> mm)
  heightMm: number;
}

export interface DriverBinCapability {
  id: number; // Win32 DMBIN_* or driver custom ID (e.g. 4 = Manual/Bypass Tray)
  name: string; // From DC_BINNAMES
}

export interface PrinterCapabilities {
  printerName: string;
  papers: DriverPaperCapability[];
  bins: DriverBinCapability[];
  supportsDuplex: boolean;
  supportsColor: boolean;
  source: 'winspool' | 'powershell' | 'simulated';
}

export interface PrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
  isOffline: boolean;
  statusCode: number;
  statusTextFa: string;
  portName?: string;
  driverName?: string;
}

export type PrintDuplexOption = 'simplex' | 'duplexlong' | 'duplexshort';
export type PrintColorOption = 'color' | 'monochrome';

export interface PrintJobSettings {
  printerName: string;
  paperId: number | null;
  paperName: string;
  binId: number | null;
  binName: string;
  duplex: PrintDuplexOption;
  colorMode: PrintColorOption;
  copies: number;
  collate: boolean;
  sheetRangeMode: 'all' | 'custom';
  customSheetRange: string;
}

export interface PrintProgressState {
  phase: 'idle' | 'building-pdf' | 'sending-to-printer' | 'completed' | 'error';
  percent: number;
  messageFa: string;
  errorDetails?: string;
}

export interface NativePrintRequest {
  pdfBytes: Uint8Array;
  jobTitle: string;
  printerName: string;
  paperId: number | null;
  paperName: string;
  binId: number | null;
  binName: string;
  duplex: PrintDuplexOption;
  colorMode: PrintColorOption;
  copies: number;
  collate: boolean;
}

export interface NativePrintResult {
  ok: boolean;
  engine?: string;
  commandSummary?: string;
  errorCode?: string;
  errorMessageFa?: string;
}

export interface LocalFilePayload {
  ok: boolean;
  name?: string;
  mimeType?: string;
  bytes?: Uint8Array;
  error?: string;
}

export interface ElectronBridgeAPI {
  isDesktop: boolean;
  platform: string;
  getFilePath: (file: File) => string;
  readLocalFile: (filePath: string) => Promise<LocalFilePayload>;
  savePdfDialog: (pdfBytes: Uint8Array, suggestedName: string) => Promise<{ ok: boolean; canceled?: boolean; savedPath?: string; error?: string }>;
  getPrinters: () => Promise<PrinterInfo[]>;
  getPrinterCapabilities: (printerName: string, portName?: string) => Promise<PrinterCapabilities>;
  openPrinterPreferences: (printerName: string) => Promise<{ ok: boolean; errorMessageFa?: string }>;
  printPdfNative: (request: NativePrintRequest) => Promise<NativePrintResult>;
  onPrintStatus?: (callback: (status: { percent: number; messageFa: string }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronBridgeAPI;
  }
}
