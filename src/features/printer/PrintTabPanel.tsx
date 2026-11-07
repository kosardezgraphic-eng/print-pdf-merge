import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Printer,
  RefreshCw,
  SlidersHorizontal,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { ImpositionPlan } from '../imposition/impositionEngine';
import { NumericField } from '../../shared/NumericField';
import { findBestDriverPaper, isDriverPaperMatchingSheet } from '../../shared/paperSizes';
import type { PrintColorOption, PrintDuplexOption } from '../../shared/types';
import { parseSheetRange } from '../../shared/units';
import { useStudioStore } from '../../store/useStudioStore';
import { triggerDriverPreferencesDialog } from './printerService';

interface PrintTabPanelProps {
  plan: ImpositionPlan;
  onRefreshPrinters: () => void;
  onExecutePrint: (mode: 'all' | 'test-single-sheet') => void;
}

export const PrintTabPanel: React.FC<PrintTabPanelProps> = ({
  plan,
  onRefreshPrinters,
  onExecutePrint,
}) => {
  const printers = useStudioStore((s) => s.printers);
  const capabilities = useStudioStore((s) => s.capabilities);
  const isLoadingPrinters = useStudioStore((s) => s.isLoadingPrinters);
  const isLoadingCapabilities = useStudioStore((s) => s.isLoadingCapabilities);
  const printJob = useStudioStore((s) => s.printJob);
  const printProgress = useStudioStore((s) => s.printProgress);
  const layout = useStudioStore((s) => s.layout);
  const activeSheetIndex = useStudioStore((s) => s.activeSheetIndex);

  const updatePrintJob = useStudioStore((s) => s.updatePrintJob);
  const selectDriverPaper = useStudioStore((s) => s.selectDriverPaper);
  const selectDriverBin = useStudioStore((s) => s.selectDriverBin);
  const pushToast = useStudioStore((s) => s.pushToast);

  const activePrinter = printers.find((p) => p.name === printJob.printerName) ?? null;
  const selectedPaper =
    capabilities?.papers.find((p) => p.id === printJob.paperId) ?? null;

  const isPaperMismatched =
    selectedPaper !== null &&
    !isDriverPaperMatchingSheet(plan.sheetWidthMm, plan.sheetHeightMm, selectedPaper);

  const suggestedPaper = capabilities
    ? findBestDriverPaper(
        capabilities.papers,
        plan.sheetWidthMm,
        plan.sheetHeightMm,
        layout.paperSize
      )
    : undefined;

  const totalSheets = plan.sheets.length;
  const rangeValidation =
    printJob.sheetRangeMode === 'custom'
      ? parseSheetRange(printJob.customSheetRange, Math.max(1, totalSheets))
      : { indices: [], error: null };

  const isBusy =
    printProgress.phase === 'building-pdf' ||
    printProgress.phase === 'sending-to-printer';

  const handleOpenDriverPreferences = async () => {
    if (!printJob.printerName) return;
    const res = await triggerDriverPreferencesDialog(printJob.printerName);
    if (!res.ok && res.errorMessageFa) {
      pushToast('warning', res.errorMessageFa);
    }
  };

  return (
    <div className="space-y-4 p-3.5 text-xs">
      {/* 1. Printer Selection & Status */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5 text-blue-500" />
            <span>چاپگر ویندوز</span>
          </span>
          <button
            type="button"
            onClick={onRefreshPrinters}
            disabled={isLoadingPrinters}
            className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingPrinters ? 'animate-spin' : ''}`} />
            <span>تازه‌سازی</span>
          </button>
        </div>

        <select
          value={printJob.printerName}
          onChange={(e) => updatePrintJob({ printerName: e.target.value })}
          className="w-full h-8 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
        >
          {printers.length === 0 ? (
            <option value="">هیچ چاپگری شناسایی نشد</option>
          ) : (
            printers.map((p) => (
              <option key={p.name} value={p.name}>
                {p.isDefault ? '★ ' : ''}
                {p.displayName} {p.isOffline ? '(آفلاین)' : ''}
              </option>
            ))
          )}
        </select>

        {/* Online / Offline Badge + Native Driver Preferences Button */}
        {activePrinter && (
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 min-w-0">
              {activePrinter.isOffline ? (
                <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              )}
              <span
                className={`text-[11px] font-medium truncate ${
                  activePrinter.isOffline
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {activePrinter.statusTextFa}
              </span>
            </div>

            <button
              type="button"
              onClick={handleOpenDriverPreferences}
              title="باز کردن پنجره Printing Preferences خود درایور ویندوز"
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 shrink-0 transition cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>تنظیمات پیشرفته درایور</span>
            </button>
          </div>
        )}
      </section>

      {/* 2. Real Driver Paper & Tray Capabilities */}
      <section className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-700 dark:text-slate-200">
            کاغذ و سینی ورودی درایور
          </span>
          {isLoadingCapabilities && (
            <span className="text-[10px] text-blue-500 animate-pulse">
              در حال خواندن درایور...
            </span>
          )}
        </div>

        {/* Driver Paper Dropdown */}
        <div className="space-y-1">
          <label className="text-[11px] text-slate-600 dark:text-slate-300 block">
            کاغذ تعریف‌شده در پرینتر (DC_PAPERS):
          </label>
          <select
            value={printJob.paperId ?? ''}
            onChange={(e) => {
              const id = Number.parseInt(e.target.value, 10);
              const found = capabilities?.papers.find((p) => p.id === id);
              if (found) selectDriverPaper(found);
            }}
            className="w-full h-8 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
          >
            {(capabilities?.papers ?? []).map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.name}
                {paper.widthMm > 0
                  ? ` (${paper.widthMm}×${paper.heightMm} mm)`
                  : ''}{' '}
                [ID:{paper.id}]
              </option>
            ))}
          </select>
        </div>

        {/* Mismatch Warning */}
        {isPaperMismatched && selectedPaper && (
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 space-y-1.5 text-[11px] text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                اندازه شیت چیدمان (
                <strong dir="ltr" className="font-num">
                  {Math.round(plan.sheetWidthMm)}×{Math.round(plan.sheetHeightMm)} mm
                </strong>
                ) با کاغذ انتخابی پرینتر (<strong>{selectedPaper.name}</strong>) هم‌خوانی ندارد!
              </p>
            </div>
            {suggestedPaper && (
              <button
                type="button"
                onClick={() => selectDriverPaper(suggestedPaper)}
                className="w-full py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer"
              >
                انتخاب خودکار «{suggestedPaper.name}»
              </button>
            )}
          </div>
        )}

        {/* Driver Tray / Bin Dropdown */}
        <div className="space-y-1">
          <label className="text-[11px] text-slate-600 dark:text-slate-300 block">
            سینی تغذیه کاغذ / Tray (DC_BINS):
          </label>
          <select
            value={printJob.binId ?? ''}
            onChange={(e) => {
              if (!e.target.value) {
                selectDriverBin(null);
                return;
              }
              const id = Number.parseInt(e.target.value, 10);
              const found = capabilities?.bins.find((b) => b.id === id) ?? null;
              selectDriverBin(found);
            }}
            className="w-full h-8 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
          >
            <option value="">پیش‌فرض درایور (بدون اجبار سینی)</option>
            {(capabilities?.bins ?? []).map((bin) => (
              <option key={bin.id} value={bin.id}>
                {bin.name} [Bin ID:{bin.id}]
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* 3. Duplex & Color */}
      <section className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
        <span className="font-bold text-slate-700 dark:text-slate-200 block">
          چاپ دورو و رنگ
        </span>

        <div className="space-y-1">
          <label className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between">
            <span>حالت چاپ پشت‌ورو (Duplex):</span>
            {capabilities && !capabilities.supportsDuplex && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                درایور تک‌رو است
              </span>
            )}
          </label>
          <select
            disabled={Boolean(capabilities && !capabilities.supportsDuplex)}
            value={printJob.duplex}
            onChange={(e) =>
              updatePrintJob({ duplex: e.target.value as PrintDuplexOption })
            }
            className="w-full h-8 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs disabled:opacity-50"
          >
            <option value="simplex">یک‌رو (Simplex)</option>
            <option value="duplexlong">دورو — چرخش از لبه بلند (کتاب استاندارد)</option>
            <option value="duplexshort">دورو — چرخش از لبه کوتاه (تقویمی / افقی)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              { id: 'color', label: 'رنگی (Color)', disabled: capabilities && !capabilities.supportsColor },
              { id: 'monochrome', label: 'سیاه‌وسفید (Mono)', disabled: false },
            ] as Array<{ id: PrintColorOption; label: string; disabled?: boolean }>
          ).map((cm) => (
            <button
              key={cm.id}
              type="button"
              disabled={Boolean(cm.disabled)}
              onClick={() => updatePrintJob({ colorMode: cm.id })}
              className={`h-8 rounded-md border font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                printJob.colorMode === cm.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {cm.label}
            </button>
          ))}
        </div>
      </section>

      {/* 4. Copies, Collate & Sheet Range */}
      <section className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
        <span className="font-bold text-slate-700 dark:text-slate-200 block">
          تعداد سری و محدوده شیت‌ها
        </span>

        <NumericField
          label="تعداد سری چاپ (Copies)"
          rawValue={printJob.copies}
          min={1}
          max={999}
          step={1}
          onChange={(v) => updatePrintJob({ copies: Math.max(1, Math.round(v)) })}
        />

        {printJob.copies > 1 && (
          <label className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 cursor-pointer">
            <span>مرتب‌سازی دسته‌ای سری‌ها (Collate: ۱،۲،۳ سپس ۱،۲،۳)</span>
            <input
              type="checkbox"
              checked={printJob.collate}
              onChange={(e) => updatePrintJob({ collate: e.target.checked })}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
          </label>
        )}

        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => updatePrintJob({ sheetRangeMode: 'all' })}
              className={`h-7 rounded border text-[11px] font-semibold cursor-pointer ${
                printJob.sheetRangeMode === 'all'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              همه شیت‌ها ({totalSheets})
            </button>
            <button
              type="button"
              onClick={() => updatePrintJob({ sheetRangeMode: 'custom' })}
              className={`h-7 rounded border text-[11px] font-semibold cursor-pointer ${
                printJob.sheetRangeMode === 'custom'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              محدوده شیت دلخواه
            </button>
          </div>

          {printJob.sheetRangeMode === 'custom' && (
            <div className="space-y-1">
              <input
                type="text"
                dir="ltr"
                placeholder="مثال: 1-3, 5"
                value={printJob.customSheetRange}
                onChange={(e) => updatePrintJob({ customSheetRange: e.target.value })}
                className="w-full h-8 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-num text-left focus:outline-none focus:border-blue-500"
              />
              {rangeValidation.error ? (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">
                  {rangeValidation.error}
                </p>
              ) : (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  {rangeValidation.indices.length} شیت برای چاپ انتخاب شد.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-2.5 py-1.5 rounded bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 text-[10px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>ارسال برداری مستقیم با مقیاس دقیق ۱۰۰٪ (noscale) بدون افت کیفیت</span>
        </div>
      </section>

      {/* 5. Progress & Print Buttons */}
      {printProgress.phase !== 'idle' && (
        <div
          className={`p-2.5 rounded-lg border text-xs space-y-1.5 ${
            printProgress.phase === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : printProgress.phase === 'completed'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2 font-medium">
            <span>{printProgress.messageFa}</span>
            {isBusy && <span className="font-num">{printProgress.percent}%</span>}
          </div>
          {isBusy && (
            <div className="w-full h-1.5 rounded-full bg-blue-200 dark:bg-blue-900 overflow-hidden">
              <div
                style={{ width: `${printProgress.percent}%` }}
                className="h-full bg-blue-600 transition-all duration-200"
              />
            </div>
          )}
          {printProgress.errorDetails && (
            <p className="text-[11px] opacity-90 leading-relaxed">
              {printProgress.errorDetails}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2 pt-1">
        <button
          type="button"
          disabled={totalSheets === 0 || isBusy}
          onClick={() => onExecutePrint('test-single-sheet')}
          className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          <FlaskConical className="w-3.5 h-3.5 text-amber-500" />
          <span>چاپ تست همین شیت (شیت {activeSheetIndex + 1})</span>
        </button>

        <button
          type="button"
          disabled={
            totalSheets === 0 ||
            isBusy ||
            Boolean(printJob.sheetRangeMode === 'custom' && rangeValidation.error)
          }
          onClick={() => onExecutePrint('all')}
          className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          <Printer className="w-4 h-4" />
          <span>شروع چاپ مستقیم (Ctrl+P)</span>
        </button>
      </div>
    </div>
  );
};
