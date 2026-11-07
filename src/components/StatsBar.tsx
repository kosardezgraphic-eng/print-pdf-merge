import React from 'react';
import { Layers, FileStack, HardDrive, CheckSquare, Merge, Printer, LayoutGrid } from 'lucide-react';
import { translations } from '../utils/translations';
import { Language, PDFItem } from '../types';
import { formatBytes } from '../utils/pdfUtils';

interface StatsBarProps {
  items: PDFItem[];
  lang: Language;
  theme: 'dark' | 'light';
  onOpenMergeModal: () => void;
  onOpenPrintModal: () => void;
  onOpenGridModal: () => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  items,
  lang,
  theme,
  onOpenMergeModal,
  onOpenPrintModal,
  onOpenGridModal,
}) => {
  const t = translations[lang];
  const isDark = theme === 'dark';

  const totalFiles = items.length;
  const totalPages = items.reduce((sum, item) => sum + (item.pageCount || 0), 0);
  const totalSizeBytes = items.reduce((sum, item) => sum + item.size, 0);
  const selectedCount = items.filter((item) => item.selected).length;
  const selectedPages = items
    .filter((item) => item.selected)
    .reduce((sum, item) => sum + (item.pageCount || 0), 0);

  const isCountingAny = items.some((item) => item.status === 'loading');

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-2">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Main Hero Card: Total Pages Count */}
        <div
          className={`col-span-2 sm:col-span-2 lg:col-span-2 rounded-2xl p-4 sm:p-5 relative overflow-hidden border transition-all ${
            isDark
              ? 'bg-gradient-to-br from-blue-900/40 via-neutral-900 to-neutral-850 border-blue-600/40 shadow-lg shadow-blue-950/20 text-white'
              : 'bg-gradient-to-br from-blue-50 via-white to-slate-50 border-blue-200 shadow-sm text-slate-900'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-500" />
                {t.totalPages}
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight font-mono tabular-nums">
                  {isCountingAny ? (
                    <span className="inline-block animate-pulse text-blue-500">...</span>
                  ) : (
                    totalPages.toLocaleString()
                  )}
                </span>
                <span className={`text-sm font-medium ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                  {t.pagesUnit}
                </span>
              </div>
            </div>

            {/* Quick Actions (Grid Imposition, Batch Print, Merge) */}
            <div className="flex flex-col gap-1.5 items-end justify-between">
              {/* N-Up Grid Imposition Button */}
              <button
                onClick={onOpenGridModal}
                disabled={totalFiles === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  totalFiles >= 1
                    ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-sm shadow-purple-600/30 cursor-pointer active:scale-95'
                    : isDark
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-750'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
                title="چیدمان جدولی و چند صفحه در یک برگ (N-Up Imposition)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>چیدمان جدولی (N-Up)</span>
              </button>

              {/* Batch Print Button */}
              <button
                onClick={onOpenPrintModal}
                disabled={totalFiles === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  totalFiles >= 1
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30 cursor-pointer active:scale-95'
                    : isDark
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-750'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
                title={totalFiles === 0 ? t.selectAtLeastOnePrint : t.printBtn}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{t.printBtn}</span>
              </button>

              {/* Merge Button */}
              <button
                onClick={onOpenMergeModal}
                disabled={totalFiles < 2}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  totalFiles >= 2
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/30 cursor-pointer active:scale-95'
                    : isDark
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-750'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
                title={totalFiles < 2 ? t.selectAtLeastTwo : t.mergeBtn}
              >
                <Merge className="w-3.5 h-3.5" />
                <span>{t.mergeBtn}</span>
              </button>
            </div>
          </div>

          <div
            className={`mt-3 pt-3 border-t flex items-center justify-between text-xs ${
              isDark ? 'border-neutral-800 text-neutral-400' : 'border-slate-200 text-slate-500'
            }`}
          >
            <span>
              {selectedCount > 0 && selectedCount !== totalFiles
                ? `${t.selectedFiles}: ${selectedCount} ${t.filesUnit} (${selectedPages} ${t.pagesUnit})`
                : `${t.avgPages}: ${totalFiles > 0 ? (totalPages / totalFiles).toFixed(1) : 0} ${t.pagesUnit}`}
            </span>
            {isCountingAny && (
              <span className="text-amber-500 font-medium animate-pulse text-[11px]">
                در حال شمارش سریع...
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Total Files */}
        <div
          className={`rounded-2xl p-4 flex flex-col justify-between border transition-colors ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <span className={`text-xs font-medium flex items-center gap-1.5 ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
            <FileStack className="w-3.5 h-3.5 text-blue-500" />
            {t.totalFiles}
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums">
              {totalFiles.toLocaleString()}
            </span>
            <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-slate-400'}`}>{t.filesUnit}</span>
          </div>
          <div className={`mt-2 text-[11px] truncate ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
            {totalFiles > 0 ? `${selectedCount} انتخاب شده` : 'در انتظار فایل'}
          </div>
        </div>

        {/* Card 3: Total Size */}
        <div
          className={`rounded-2xl p-4 flex flex-col justify-between border transition-colors ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <span className={`text-xs font-medium flex items-center gap-1.5 ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
            <HardDrive className="w-3.5 h-3.5 text-blue-500" />
            {t.totalSize}
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums">
              {formatBytes(totalSizeBytes)}
            </span>
          </div>
          <div className={`mt-2 text-[11px] ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
            پردازش آفلاین در حافظه
          </div>
        </div>

        {/* Card 4: Selection Status */}
        <div
          className={`rounded-2xl p-4 flex flex-col justify-between border transition-colors ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <span className={`text-xs font-medium flex items-center gap-1.5 ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
            <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
            {t.selectedFiles}
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums">
              {selectedCount}
            </span>
            <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-slate-400'}`}>/ {totalFiles}</span>
          </div>
          <div className={`mt-2 text-[11px] ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
            {selectedCount === totalFiles ? 'تمام فایل‌ها فعال' : `${selectedPages} صفحه برای پردازش`}
          </div>
        </div>

        {/* Card 5: Print Ready Summary */}
        <div
          className={`rounded-2xl p-4 flex flex-col justify-between border transition-colors ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <span className={`text-xs font-medium flex items-center gap-1.5 ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
            <Printer className="w-3.5 h-3.5 text-emerald-500" />
            وضعیت چاپگر
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              آماده
            </span>
          </div>
          <div className={`mt-2 text-[11px] truncate ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
            A4 / سینی خودکار / B&W
          </div>
        </div>
      </div>
    </section>
  );
};
