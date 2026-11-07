import React, { useState } from 'react';
import {
  Download,
  Eye,
  FilePlus2,
  FlaskConical,
  Keyboard,
  Moon,
  Printer,
  Redo2,
  Ruler,
  Sun,
  Undo2,
} from 'lucide-react';
import type { LengthUnit } from '../shared/units';
import { useStudioStore } from '../store/useStudioStore';

interface TopHeaderProps {
  totalSheets: number;
  onTriggerFilePicker: () => void;
  onSavePdf: () => void;
  onPrintAll: () => void;
  onPrintTestSheet: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  totalSheets,
  onTriggerFilePicker,
  onSavePdf,
  onPrintAll,
  onPrintTestSheet,
}) => {
  const theme = useStudioStore((s) => s.theme);
  const unit = useStudioStore((s) => s.unit);
  const showRulers = useStudioStore((s) => s.showRulers);
  const showGuides = useStudioStore((s) => s.showGuides);
  const historyPastCount = useStudioStore((s) => s.historyPast.length);
  const historyFutureCount = useStudioStore((s) => s.historyFuture.length);
  const printProgress = useStudioStore((s) => s.printProgress);

  const toggleTheme = useStudioStore((s) => s.toggleTheme);
  const setUnit = useStudioStore((s) => s.setUnit);
  const setShowRulers = useStudioStore((s) => s.setShowRulers);
  const setShowGuides = useStudioStore((s) => s.setShowGuides);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);

  const [showShortcuts, setShowShortcuts] = useState(false);

  const isBusy =
    printProgress.phase === 'building-pdf' ||
    printProgress.phase === 'sending-to-printer';

  return (
    <header className="h-13 px-3 sm:px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 shrink-0 relative z-40 select-none">
      {/* Right (RTL Start): Brand + Add Files + Undo/Redo */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-2 me-1">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Printer className="w-4 h-4 stroke-[2.3]" />
          </div>
          <div className="leading-tight hidden sm:block">
            <h1 className="text-sm font-bold text-slate-900 dark:text-white">
              استودیو چاپ کوثر
            </h1>
            <p className="text-[10px] text-slate-400 font-num">Kosar Print Studio 2.0</p>
          </div>
        </div>

        <span className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

        <button
          type="button"
          onClick={onTriggerFilePicker}
          title="افزودن فایل‌های PDF و تصویر (Ctrl+O)"
          className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 transition cursor-pointer"
        >
          <FilePlus2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>افزودن فایل</span>
        </button>

        {/* Undo / Redo */}
        <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 h-8 p-0.5">
          <button
            type="button"
            disabled={historyPastCount === 0}
            onClick={undo}
            title="بازگشت به مرحله قبل (Ctrl+Z)"
            className="px-2 h-full rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition cursor-pointer disabled:cursor-not-allowed"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={historyFutureCount === 0}
            onClick={redo}
            title="انجام دوباره (Ctrl+Y)"
            className="px-2 h-full rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition cursor-pointer disabled:cursor-not-allowed"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center / Primary Always-Visible Output Buttons: Save PDF + Test Print + Print */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={totalSheets === 0 || isBusy}
          onClick={onSavePdf}
          title="ذخیره خروجی برداری PDF (ادغام / شیت‌بندی / تبدیل عکس به PDF) — Ctrl+S"
          className="h-9 px-3.5 rounded-lg border border-emerald-600/80 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" />
          <span>ذخیره PDF</span>
        </button>

        <button
          type="button"
          disabled={totalSheets === 0 || isBusy}
          onClick={onPrintTestSheet}
          title="چاپ آزمایشی فقط شیت فعلی برای کنترل ابعاد و سینی"
          className="hidden md:inline-flex h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold items-center gap-1.5 transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          <FlaskConical className="w-3.5 h-3.5 text-amber-500" />
          <span>چاپ تست ۱ شیت</span>
        </button>

        <button
          type="button"
          disabled={totalSheets === 0 || isBusy}
          onClick={onPrintAll}
          title="ارسال مستقیم به چاپگر (Ctrl+P)"
          className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          <Printer className="w-4 h-4" />
          <span>چاپ</span>
          {totalSheets > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-blue-800/70 text-[10px] font-num">
              {totalSheets} شیت
            </span>
          )}
        </button>
      </div>

      {/* Left (RTL End): Minimal View Controls (Unit, Ruler, Guides, Shortcuts, Theme) */}
      <div className="flex items-center gap-1.5">
        {/* Unit Selector */}
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as LengthUnit)}
          title="واحد اندازه‌گیری"
          dir="ltr"
          className="h-8 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-num font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
        >
          <option value="mm">mm</option>
          <option value="cm">cm</option>
          <option value="inch">inch</option>
        </select>

        {/* Minimal View Toggles */}
        <button
          type="button"
          onClick={() => setShowRulers(!showRulers)}
          title="نمایش / مخفی‌سازی خط‌کش فیزیکی"
          className={`h-8 w-8 rounded-lg border flex items-center justify-center transition cursor-pointer ${
            showRulers
              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400'
              : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setShowGuides(!showGuides)}
          title="نمایش / مخفی‌سازی خطوط راهنمای حاشیه و خانه‌ها"
          className={`h-8 w-8 rounded-lg border flex items-center justify-center transition cursor-pointer ${
            showGuides
              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400'
              : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
        </button>

        {/* Shortcuts Quick Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowShortcuts((v) => !v)}
            title="کلیدهای میانبر صفحه کلید"
            className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>

          {showShortcuts && (
            <div className="absolute left-0 top-10 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3 text-xs space-y-1.5 z-50">
              <div className="font-bold text-slate-800 dark:text-slate-100 pb-1 border-b border-slate-200 dark:border-slate-800">
                کلیدهای میانبر سریع چاپخانه
              </div>
              {[
                ['افزودن فایل', 'Ctrl + O'],
                ['چاپ فوری', 'Ctrl + P'],
                ['ذخیره PDF خروجی', 'Ctrl + S'],
                ['بازگشت / تکرار', 'Ctrl + Z / Y'],
                ['انتخاب همه صفحات', 'Ctrl + A'],
                ['چرخش ۹۰° انتخابی', 'R'],
                ['حذف صفحات انتخابی', 'Delete'],
                ['زوم روی شیت', 'Ctrl + Scroll'],
              ].map(([label, key]) => (
                <div key={key} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 dark:text-slate-300">{label}</span>
                  <kbd
                    dir="ltr"
                    className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-num text-[10px] text-slate-700 dark:text-slate-200"
                  >
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Theme Switcher */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'تغییر به تم روشن' : 'تغییر به تم تیره'}
          className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </header>
  );
};
