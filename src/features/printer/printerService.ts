import type {
  NativePrintRequest,
  NativePrintResult,
  PrinterCapabilities,
  PrinterInfo,
} from '../../shared/types';

/**
 * Realistic simulated copy-center printers used ONLY when previewing in a standard web browser
 * outside Electron Windows desktop, so UI controls (Bypass Tray, SRA3/A4 mismatch warnings,
 * Duplex, Offline badges) are 100% interactive in browser dev mode.
 */
const SIMULATED_WEB_PRINTERS: PrinterInfo[] = [
  {
    name: 'Konica Minolta bizhub C308 (محیط پیش‌نمایش وب)',
    displayName: 'Konica Minolta bizhub C308 (شبیه‌ساز مرورگر)',
    isDefault: true,
    isOffline: false,
    statusCode: 0,
    statusTextFa: 'آماده به کار (محیط وب)',
    portName: 'IP_192.168.1.200',
    driverName: 'KONICA MINOLTA C368SeriesPCL',
  },
  {
    name: 'HP LaserJet Pro M404dn (محیط پیش‌نمایش وب)',
    displayName: 'HP LaserJet Pro M404dn (شبیه‌ساز مرورگر)',
    isDefault: false,
    isOffline: false,
    statusCode: 0,
    statusTextFa: 'آماده به کار (محیط وب)',
    portName: 'USB001',
    driverName: 'HP Universal Printing PCL 6',
  },
  {
    name: 'Epson L805 Photo (آفلاین آزمایشی)',
    displayName: 'Epson L805 Photo (آفلاین)',
    isDefault: false,
    isOffline: true,
    statusCode: 128,
    statusTextFa: 'آفلاین / عدم اتصال',
    portName: 'USB002',
    driverName: 'EPSON L805 Series',
  },
];

const SIMULATED_CAPABILITIES: Record<string, PrinterCapabilities> = {
  'Konica Minolta bizhub C308 (محیط پیش‌نمایش وب)': {
    printerName: 'Konica Minolta bizhub C308 (محیط پیش‌نمایش وب)',
    papers: [
      { id: 9, name: 'A4 (210 × 297 mm)', widthMm: 210, heightMm: 297 },
      { id: 8, name: 'A3 (297 × 420 mm)', widthMm: 297, heightMm: 420 },
      { id: 260, name: 'SRA3 (320 × 450 mm)', widthMm: 320, heightMm: 450 },
      { id: 11, name: 'A5 (148 × 210 mm)', widthMm: 148, heightMm: 210 },
      { id: 42, name: 'B5 ISO (176 × 250 mm)', widthMm: 176, heightMm: 250 },
    ],
    bins: [
      { id: 7, name: 'انتخاب خودکار سینی (Auto)' },
      { id: 4, name: 'Bypass Tray (سینی دستی کنار)' },
      { id: 257, name: 'Tray 1 (کاست اول - A4)' },
      { id: 258, name: 'Tray 2 (کاست دوم - A3)' },
      { id: 259, name: 'Tray 3 (کاست سوم - مقوا)' },
    ],
    supportsDuplex: true,
    supportsColor: true,
    source: 'simulated',
  },
  'HP LaserJet Pro M404dn (محیط پیش‌نمایش وب)': {
    printerName: 'HP LaserJet Pro M404dn (محیط پیش‌نمایش وب)',
    papers: [
      { id: 9, name: 'A4 (210 × 297 mm)', widthMm: 210, heightMm: 297 },
      { id: 11, name: 'A5 (148 × 210 mm)', widthMm: 148, heightMm: 210 },
      { id: 1, name: 'Letter (8.5 × 11 in)', widthMm: 215.9, heightMm: 279.4 },
      { id: 5, name: 'Legal (8.5 × 14 in)', widthMm: 215.9, heightMm: 355.6 },
    ],
    bins: [
      { id: 7, name: 'Automatically Select' },
      { id: 4, name: 'Tray 1 (Manual / Bypass)' },
      { id: 1, name: 'Tray 2 (250-Sheet Cassette)' },
    ],
    supportsDuplex: true,
    supportsColor: false,
    source: 'simulated',
  },
};

export function isElectronDesktop(): boolean {
  return Boolean(typeof window !== 'undefined' && window.electronAPI?.isDesktop);
}

export async function fetchInstalledPrinters(): Promise<PrinterInfo[]> {
  if (isElectronDesktop() && window.electronAPI) {
    return window.electronAPI.getPrinters();
  }
  return SIMULATED_WEB_PRINTERS;
}

export async function fetchPrinterCapabilities(
  printerName: string,
  portName?: string
): Promise<PrinterCapabilities> {
  if (isElectronDesktop() && window.electronAPI) {
    return window.electronAPI.getPrinterCapabilities(printerName, portName);
  }
  return (
    SIMULATED_CAPABILITIES[printerName] ?? {
      printerName,
      papers: [
        { id: 9, name: 'A4 (210 × 297 mm)', widthMm: 210, heightMm: 297 },
        { id: 11, name: 'A5 (148 × 210 mm)', widthMm: 148, heightMm: 210 },
      ],
      bins: [
        { id: 7, name: 'Auto Select' },
        { id: 4, name: 'Manual Feed / Bypass Tray' },
      ],
      supportsDuplex: false,
      supportsColor: true,
      source: 'simulated',
    }
  );
}

export async function triggerDriverPreferencesDialog(
  printerName: string
): Promise<{ ok: boolean; errorMessageFa?: string }> {
  if (isElectronDesktop() && window.electronAPI) {
    return window.electronAPI.openPrinterPreferences(printerName);
  }
  return {
    ok: false,
    errorMessageFa:
      'باز کردن پنجره تنظیمات اختصاصی درایور (PrintUIEntry) نیازمند اجرای نسخه دسکتاپ ویندوز (Electron) است.',
  };
}

export async function dispatchNativePrintJob(
  request: NativePrintRequest
): Promise<NativePrintResult> {
  if (isElectronDesktop() && window.electronAPI) {
    return window.electronAPI.printPdfNative(request);
  }

  // In web preview mode, open generated vector PDF in a new tab or print viewer cleanly
  try {
    const blob = new Blob([request.pdfBytes.slice().buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      return {
        ok: false,
        errorCode: 'WEB_POPUP_BLOCKED',
        errorMessageFa:
          'در پیش‌نمایش مرورگر وب، ارسال مستقیم به سینی پرینتر ویندوز فعال نیست و پاپ‌آپ مرورگر مسدود شد. در نسخه دسکتاپ ویندوز (Electron) چاپ به صورت مستقیم ارسال می‌شود.',
      };
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return {
      ok: true,
      engine: 'BrowserPDFViewer',
      commandSummary:
        'فایل PDF برداری نهایی تولید و در نمایشگر PDF مرورگر باز شد (در نسخه ویندوز مستقیماً به SumatraPDF ارسال می‌شود).',
    };
  } catch (err) {
    return {
      ok: false,
      errorCode: 'WEB_FALLBACK_ERROR',
      errorMessageFa: (err as Error).message,
    };
  }
}
