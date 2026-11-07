import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { BottomStatusBar } from './app/BottomStatusBar';
import { InspectorPanel } from './app/InspectorPanel';
import { TopHeader } from './app/TopHeader';
import { computeImpositionPlan } from './features/imposition/impositionEngine';
import { createDemoFiles, ingestFilesBatch, RawInputCandidate } from './features/pages/fileIngestor';
import { PagesSidebar } from './features/pages/PagesSidebar';
import { buildImposedPdfBytes } from './features/pdf-output/pdfBuilder';
import { saveGeneratedPdf } from './features/pdf-output/savePdfOutput';
import { SheetPreviewWorkspace } from './features/preview/SheetPreviewWorkspace';
import {
  dispatchNativePrintJob,
  fetchInstalledPrinters,
  fetchPrinterCapabilities,
} from './features/printer/printerService';
import { parseSheetRange } from './shared/units';
import { useStudioStore } from './store/useStudioStore';

export default function App() {
  const theme = useStudioStore((s) => s.theme);
  const pages = useStudioStore((s) => s.pages);
  const selectedPageIds = useStudioStore((s) => s.selectedPageIds);
  const layout = useStudioStore((s) => s.layout);
  const slotOverrides = useStudioStore((s) => s.slotOverrides);
  const activeSheetIndex = useStudioStore((s) => s.activeSheetIndex);
  const printers = useStudioStore((s) => s.printers);
  const printJob = useStudioStore((s) => s.printJob);
  const toasts = useStudioStore((s) => s.toasts);
  const desktopManifestToRestore = useStudioStore((s) => s.desktopManifestToRestore);

  const appendPages = useStudioStore((s) => s.appendPages);
  const setIngestStatus = useStudioStore((s) => s.setIngestStatus);
  const pushToast = useStudioStore((s) => s.pushToast);
  const dismissToast = useStudioStore((s) => s.dismissToast);
  const setPrinters = useStudioStore((s) => s.setPrinters);
  const setIsLoadingPrinters = useStudioStore((s) => s.setIsLoadingPrinters);
  const setCapabilities = useStudioStore((s) => s.setCapabilities);
  const setIsLoadingCapabilities = useStudioStore((s) => s.setIsLoadingCapabilities);
  const setPrintProgress = useStudioStore((s) => s.setPrintProgress);
  const setInspectorTab = useStudioStore((s) => s.setInspectorTab);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  const selectAllPages = useStudioStore((s) => s.selectAllPages);
  const removePages = useStudioStore((s) => s.removePages);
  const rotatePagesClockwise = useStudioStore((s) => s.rotatePagesClockwise);
  const clearDesktopRestoreManifest = useStudioStore((s) => s.clearDesktopRestoreManifest);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.lang = 'fa';
    root.dir = 'rtl';
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [theme]);

  // Compute live deterministic matrix imposition plan
  const plan = useMemo(
    () => computeImpositionPlan(pages, layout, slotOverrides),
    [pages, layout, slotOverrides]
  );

  // Load installed printers
  const refreshPrinters = useCallback(async () => {
    setIsLoadingPrinters(true);
    try {
      const list = await fetchInstalledPrinters();
      setPrinters(list);
    } catch (err) {
      pushToast('error', `خطا در خواندن لیست چاپگرها: ${(err as Error).message}`);
    } finally {
      setIsLoadingPrinters(false);
    }
  }, [setIsLoadingPrinters, setPrinters, pushToast]);

  useEffect(() => {
    void refreshPrinters();
  }, [refreshPrinters]);

  // Load native Win32 DeviceCapabilitiesW whenever selected printer changes
  const activePrinterPort = useMemo(
    () => printers.find((p) => p.name === printJob.printerName)?.portName,
    [printers, printJob.printerName]
  );

  useEffect(() => {
    if (!printJob.printerName) {
      setCapabilities(null);
      return;
    }
    let cancelled = false;
    setIsLoadingCapabilities(true);
    fetchPrinterCapabilities(printJob.printerName, activePrinterPort)
      .then((caps) => {
        if (!cancelled) setCapabilities(caps);
      })
      .catch((err) => {
        if (!cancelled) {
          pushToast('warning', `عدم دسترسی به جزئیات درایور: ${(err as Error).message}`);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCapabilities(false);
      });

    return () => {
      cancelled = true;
    };
  }, [printJob.printerName, activePrinterPort, setCapabilities, setIsLoadingCapabilities, pushToast]);

  // Subscribe to Electron native print progress events
  useEffect(() => {
    if (!window.electronAPI?.onPrintStatus) return;
    return window.electronAPI.onPrintStatus((st) => {
      setPrintProgress({
        phase: 'sending-to-printer',
        percent: st.percent,
        messageFa: st.messageFa,
      });
    });
  }, [setPrintProgress]);

  // Ingest files helper
  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setIngestStatus(true, `در حال بارگذاری ${files.length} فایل...`);
      try {
        const candidates: RawInputCandidate[] = files.map((file) => ({
          name: file.name,
          file,
        }));
        const res = await ingestFilesBatch(candidates, (curr, total, name) => {
          setIngestStatus(true, `خواندن فایل ${curr} از ${total}: ${name}`);
        });

        if (res.addedPages.length > 0) {
          appendPages(res.addedPages);
          pushToast(
            'success',
            `${res.addedPages.length} صفحه از ${res.addedSources.length} فایل اضافه شد.`
          );
        }
        for (const err of res.errors) {
          pushToast('error', `${err.fileName}: ${err.reasonFa}`);
        }
      } finally {
        setIngestStatus(false, '');
      }
    },
    [appendPages, pushToast, setIngestStatus]
  );

  const handleLoadDemoFiles = useCallback(async () => {
    setIngestStatus(true, 'در حال ساخت فایل‌های برداری نمونه...');
    try {
      const demos = await createDemoFiles();
      await handleFilesSelected(demos);
    } finally {
      setIngestStatus(false, '');
    }
  }, [handleFilesSelected, setIngestStatus]);

  // Restore last Electron desktop session files from local paths
  const handleRestoreDesktopManifest = useCallback(async () => {
    if (!window.electronAPI?.readLocalFile || desktopManifestToRestore.length === 0) {
      clearDesktopRestoreManifest();
      return;
    }

    setIngestStatus(true, 'در حال بازیابی فایل‌های پروژه قبلی...');
    try {
      const uniquePaths = Array.from(new Set(desktopManifestToRestore.map((e) => e.filePath)));
      const candidates: RawInputCandidate[] = [];

      for (const fp of uniquePaths) {
        const loaded = await window.electronAPI.readLocalFile(fp);
        if (loaded.ok && loaded.bytes && loaded.name) {
          candidates.push({
            name: loaded.name,
            bytes: loaded.bytes,
            filePath: fp,
          });
        }
      }

      if (candidates.length === 0) {
        pushToast('warning', 'فایل‌های جلسه قبلی در مسیر قبلی یافت نشدند.');
        clearDesktopRestoreManifest();
        return;
      }

      const ingested = await ingestFilesBatch(candidates);
      // Reconstruct exact saved page sequence, rotations, enabled flags, and copies
      const sourceIdByPath = new Map(
        ingested.addedSources
          .filter((s) => Boolean(s.filePath))
          .map((s) => [s.filePath!, s.id])
      );
      const ingestedPageLookup = new Map(
        ingested.addedPages.map((p) => [`${p.sourceFileId}:${p.sourcePageIndex}`, p])
      );

      const restoredPages = desktopManifestToRestore
        .map((entry, idx) => {
          const srcId = sourceIdByPath.get(entry.filePath);
          if (!srcId) return null;
          const template = ingestedPageLookup.get(`${srcId}:${entry.sourcePageIndex}`);
          if (!template) return null;
          return {
            ...template,
            id: `${template.id}_r${idx}`,
            rotation: entry.rotation,
            enabled: entry.enabled,
            copies: entry.copies,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (restoredPages.length > 0) {
        appendPages(restoredPages);
        pushToast('success', `پروژه قبلی (${restoredPages.length} صفحه) بازیابی شد.`);
      }
      clearDesktopRestoreManifest();
    } finally {
      setIngestStatus(false, '');
    }
  }, [
    desktopManifestToRestore,
    clearDesktopRestoreManifest,
    setIngestStatus,
    appendPages,
    pushToast,
  ]);

  // Save final imposed vector PDF
  const handleSavePdf = useCallback(async () => {
    if (plan.sheets.length === 0) return;

    setPrintProgress({
      phase: 'building-pdf',
      percent: 10,
      messageFa: 'در حال ساخت خروجی برداری PDF...',
    });

    try {
      const pdfBytes = await buildImposedPdfBytes({
        plan,
        onProgress: (percent, messageFa) =>
          setPrintProgress({ phase: 'building-pdf', percent, messageFa }),
      });

      const baseLabel =
        layout.mode === 'repeat'
          ? `Kosar_Repeat_${layout.rows}x${layout.cols}_${layout.paperSize}`
          : layout.mode === 'nup'
          ? `Kosar_NUp_${layout.rows}x${layout.cols}_${layout.paperSize}`
          : `Kosar_Merged_${layout.paperSize}`;

      const saveRes = await saveGeneratedPdf(pdfBytes, `${baseLabel}.pdf`);
      if (saveRes.canceled) {
        setPrintProgress({ phase: 'idle', percent: 0, messageFa: '' });
        return;
      }
      if (!saveRes.ok) {
        setPrintProgress({
          phase: 'error',
          percent: 0,
          messageFa: 'ذخیره فایل PDF ناموفق بود.',
          errorDetails: saveRes.errorMessageFa,
        });
        pushToast('error', saveRes.errorMessageFa || 'خطا در ذخیره فایل PDF');
        return;
      }

      setPrintProgress({
        phase: 'completed',
        percent: 100,
        messageFa: 'فایل PDF بدون افت کیفیت با موفقیت ذخیره شد.',
      });
      pushToast('success', 'فایل PDF خروجی با موفقیت ذخیره شد.');
    } catch (err) {
      const msg = (err as Error).message || 'خطا در تولید فایل PDF';
      setPrintProgress({
        phase: 'error',
        percent: 0,
        messageFa: 'خطا در ساخت فایل PDF',
        errorDetails: msg,
      });
      pushToast('error', msg);
    }
  }, [plan, layout, setPrintProgress, pushToast]);

  // Execute Native Print (Full Job or 1-Sheet Test Print)
  const handleExecutePrint = useCallback(
    async (mode: 'all' | 'test-single-sheet') => {
      if (plan.sheets.length === 0) return;
      setInspectorTab('print');

      if (!printJob.printerName) {
        pushToast('error', 'لطفاً ابتدا یک چاپگر انتخاب کنید.');
        return;
      }

      const criticalError = plan.warnings.find((w) => w.severity === 'error');
      if (criticalError && layout.cellSizeMode === 'auto') {
        pushToast('error', criticalError.messageFa);
        return;
      }

      let baseSheetIndices: number[];
      if (mode === 'test-single-sheet') {
        const clamped = Math.min(activeSheetIndex, plan.sheets.length - 1);
        baseSheetIndices = [Math.max(0, clamped)];
      } else if (printJob.sheetRangeMode === 'custom') {
        const parsed = parseSheetRange(printJob.customSheetRange, plan.sheets.length);
        if (parsed.error) {
          pushToast('error', parsed.error);
          return;
        }
        baseSheetIndices = parsed.indices;
      } else {
        baseSheetIndices = plan.sheets.map((s) => s.sheetIndex);
      }

      const requestedCopies =
        mode === 'test-single-sheet' ? 1 : Math.max(1, printJob.copies || 1);

      // Uncollated multi-copy: expand sheet sequence [0,0,0, 1,1,1] in PDF XObject stream & send 1x
      // Collated multi-copy: send PDF sheets once & pass copies=N to hardware driver
      let finalSheetIndices = baseSheetIndices;
      let driverCopies = requestedCopies;
      if (requestedCopies > 1 && !printJob.collate) {
        finalSheetIndices = [];
        for (const sIdx of baseSheetIndices) {
          for (let c = 0; c < requestedCopies; c++) {
            finalSheetIndices.push(sIdx);
          }
        }
        driverCopies = 1;
      }

      try {
        setPrintProgress({
          phase: 'building-pdf',
          percent: 8,
          messageFa: 'در حال آماده‌سازی برداری شیت‌ها برای ارسال به چاپگر...',
        });

        const pdfBytes = await buildImposedPdfBytes({
          plan,
          sheetIndices: finalSheetIndices,
          onProgress: (pct, msg) =>
            setPrintProgress({
              phase: 'building-pdf',
              percent: Math.round(pct * 0.8),
              messageFa: msg,
            }),
        });

        setPrintProgress({
          phase: 'sending-to-printer',
          percent: 84,
          messageFa: `در حال ارسال به چاپگر «${printJob.printerName}»...`,
        });

        const printResult = await dispatchNativePrintJob({
          pdfBytes,
          jobTitle:
            mode === 'test-single-sheet'
              ? `Kosar Test Sheet #${baseSheetIndices[0] + 1}`
              : `Kosar Print Job (${baseSheetIndices.length} Sheets)`,
          printerName: printJob.printerName,
          paperId: printJob.paperId,
          paperName: printJob.paperName,
          binId: printJob.binId,
          binName: printJob.binName,
          duplex: mode === 'test-single-sheet' ? 'simplex' : printJob.duplex,
          colorMode: printJob.colorMode,
          copies: driverCopies,
          collate: printJob.collate,
        });

        if (!printResult.ok) {
          setPrintProgress({
            phase: 'error',
            percent: 0,
            messageFa: 'ارسال به چاپگر ناموفق بود.',
            errorDetails: printResult.errorMessageFa,
          });
          pushToast('error', printResult.errorMessageFa || 'خطا در چاپ');
          return;
        }

        setPrintProgress({
          phase: 'completed',
          percent: 100,
          messageFa:
            mode === 'test-single-sheet'
              ? `چاپ تست شیت ${baseSheetIndices[0] + 1} با موفقیت ارسال شد.`
              : 'فرمان چاپ با موفقیت تحویل صف چاپ شد.',
          errorDetails: printResult.commandSummary,
        });
        pushToast(
          'success',
          mode === 'test-single-sheet'
            ? `شیت تست شماره ${baseSheetIndices[0] + 1} به چاپگر ارسال شد.`
            : 'فرمان چاپ با موفقیت ارسال شد.'
        );
      } catch (err) {
        const msg = (err as Error).message || 'خطای غیرمنتظره هنگام چاپ';
        setPrintProgress({
          phase: 'error',
          percent: 0,
          messageFa: 'خطا در فرآیند چاپ',
          errorDetails: msg,
        });
        pushToast('error', msg);
      }
    },
    [
      plan,
      printJob,
      layout.cellSizeMode,
      activeSheetIndex,
      setInspectorTab,
      setPrintProgress,
      pushToast,
    ]
  );

  // Global Print-Shop Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (ctrl && key === 'o') {
        e.preventDefault();
        fileInputRef.current?.click();
        return;
      }
      if (ctrl && key === 'p') {
        e.preventDefault();
        void handleExecutePrint('all');
        return;
      }
      if (ctrl && key === 's') {
        e.preventDefault();
        void handleSavePdf();
        return;
      }

      if (isEditable) return;

      if (ctrl && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((ctrl && key === 'y') || (ctrl && e.shiftKey && key === 'z')) {
        e.preventDefault();
        redo();
      } else if (ctrl && key === 'a') {
        e.preventDefault();
        selectAllPages();
      } else if (e.key === 'Delete' && selectedPageIds.length > 0) {
        e.preventDefault();
        removePages(selectedPageIds);
      } else if (key === 'r' && !ctrl && selectedPageIds.length > 0) {
        e.preventDefault();
        rotatePagesClockwise(selectedPageIds);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleExecutePrint,
    handleSavePdf,
    undo,
    redo,
    selectAllPages,
    removePages,
    rotatePagesClockwise,
    selectedPageIds,
  ]);

  return (
    <div dir="rtl" className="h-screen w-screen overflow-hidden flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Hidden multi-file picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,.bmp,application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          e.target.value = '';
          void handleFilesSelected(list);
        }}
      />

      {/* Top Bar with Always-Visible Print & Save PDF */}
      <TopHeader
        totalSheets={plan.sheets.length}
        onTriggerFilePicker={() => fileInputRef.current?.click()}
        onSavePdf={() => void handleSavePdf()}
        onPrintAll={() => void handleExecutePrint('all')}
        onPrintTestSheet={() => void handleExecutePrint('test-single-sheet')}
      />

      {/* Unified 3-Panel Workspace (RTL: Right=Pages, Center=Live Sheet Preview, Left=Layout & Print Tabs) */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <PagesSidebar onTriggerFilePicker={() => fileInputRef.current?.click()} />

        <SheetPreviewWorkspace
          plan={plan}
          onTriggerFilePicker={() => fileInputRef.current?.click()}
          onFilesDropped={(files) => void handleFilesSelected(files)}
          onLoadDemoFiles={() => void handleLoadDemoFiles()}
          onRestoreDesktopManifest={() => void handleRestoreDesktopManifest()}
        />

        <InspectorPanel
          plan={plan}
          onRefreshPrinters={() => void refreshPrinters()}
          onExecutePrint={(mode) => void handleExecutePrint(mode)}
        />
      </div>

      {/* Compact Footer Status Bar */}
      <BottomStatusBar plan={plan} />

      {/* Non-intrusive Toast Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-10 left-4 z-50 flex flex-col gap-2 max-w-sm">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-3.5 py-2.5 rounded-xl border shadow-lg flex items-center gap-2 text-xs font-medium backdrop-blur-md ${
                t.type === 'error'
                  ? 'bg-rose-950/90 border-rose-700 text-rose-100'
                  : t.type === 'warning'
                  ? 'bg-amber-950/90 border-amber-700 text-amber-100'
                  : t.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-700 text-emerald-100'
                  : 'bg-slate-900/90 border-slate-700 text-slate-100'
              }`}
            >
              {t.type === 'error' || t.type === 'warning' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : t.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <Info className="w-4 h-4 shrink-0" />
              )}
              <span className="flex-1 leading-relaxed">{t.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
