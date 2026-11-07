import React, { useMemo } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Printer,
  FileText,
  Layers,
  Copy,
  CheckCircle2,
  X,
  Sparkles,
  ArrowRight,
  Palette,
  Check,
} from 'lucide-react';
import { PDFItem, PrintSettings, Language } from '../types';

interface PreflightModalProps {
  items: PDFItem[];
  settings: PrintSettings;
  lang: Language;
  theme: 'dark' | 'light';
  onClose: () => void;
  onConfirmPrint: () => void;
}

export const PreflightModal: React.FC<PreflightModalProps> = ({
  items,
  settings,
  lang,
  theme,
  onClose,
  onConfirmPrint,
}) => {
  const isDark = theme === 'dark';
  const isFa = lang === 'fa';

  const selectedItems = useMemo(() => items.filter((i) => i.selected), [items]);

  // Compute total printable pages
  const totalPrintablePages = useMemo(() => {
    let count = 0;
    for (const item of selectedItems) {
      const pCount = item.pageCount || 1;
      for (let p = 1; p <= pCount; p++) {
        const adj = item.pageAdjustments?.[p];
        if (!adj || adj.selectedForPrint) {
          count++;
        }
      }
    }
    return count;
  }, [selectedItems]);

  // Imposition sheets calculation
  const isGrid = Boolean(settings.gridLayout?.enabled);
  const rows = isGrid ? settings.gridLayout?.rows || 1 : 1;
  const cols = isGrid ? settings.gridLayout?.cols || 1 : 1;
  const cellsPerSheet = rows * cols;

  const totalSheetsNeeded = useMemo(() => {
    if (totalPrintablePages === 0) return 0;
    if (settings.gridLayout?.repeatPage) return totalPrintablePages;
    return Math.ceil(totalPrintablePages / cellsPerSheet);
  }, [totalPrintablePages, cellsPerSheet, settings.gridLayout?.repeatPage]);

  // Physical sheets of paper (accounting for duplex)
  const physicalPaperSheets = useMemo(() => {
    if (settings.duplex === 'simplex') {
      return totalSheetsNeeded * settings.copies;
    }
    // Duplex: 2 sheets per physical paper sheet
    return Math.ceil(totalSheetsNeeded / 2) * settings.copies;
  }, [totalSheetsNeeded, settings.duplex, settings.copies]);

  // Warnings / Validation Pre-flight check
  const warnings: { id: string; messageFa: string; messageEn: string; level: 'warn' | 'info' }[] = [];

  if (settings.duplex !== 'simplex' && totalSheetsNeeded % 2 !== 0) {
    warnings.push({
      id: 'odd-duplex',
      messageFa: 'تعداد شیت‌ها فرد است؛ آخرین برگه به صورت تک‌رو چاپ خواهد شد.',
      messageEn: 'Odd number of sheets; the final sheet will print on one side only.',
      level: 'info',
    });
  }

  if (settings.paperSize === 'A3' && (!settings.printerName || settings.printerName.toLowerCase().includes('deskjet'))) {
    warnings.push({
      id: 'a3-check',
      messageFa: 'اندازه کاغذ A3 انتخاب شده است. لطفاً مطمئن شوید چاپگر شما از قطع A3 پشتیبانی می‌کند.',
      messageEn: 'A3 paper selected. Please verify your printer hardware supports A3 feeding.',
      level: 'warn',
    });
  }

  if (items.some((i) => !i.selected)) {
    warnings.push({
      id: 'unselected-files',
      messageFa: 'برخی اسناد تیک نخورده‌اند و در این نوبت چاپ نخواهند شد.',
      messageEn: 'Some files are unchecked and will be excluded from this print job.',
      level: 'info',
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-colors flex flex-col ${
          isDark ? 'bg-neutral-900 border-neutral-750 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/15 text-emerald-500 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">
                {isFa ? 'خلاصه و اعتبارسنجی پیش از چاپ (Pre-flight)' : 'Pre-flight Print Verification'}
              </h2>
              <p className="text-[11px] text-neutral-400">
                {isFa ? 'بررسی تیراژ، مشخصات کاغذ و تطابق سخت‌افزاری' : 'Verification of sheets, paper specs, and print queue'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-black/10 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-neutral-850 border-neutral-750' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-[10px] text-neutral-400 font-semibold">{isFa ? 'اسناد انتخابی' : 'Files'}</div>
              <div className="text-lg font-bold font-mono text-blue-500 mt-0.5">
                {selectedItems.length}
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isDark ? 'bg-neutral-850 border-neutral-750' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-[10px] text-neutral-400 font-semibold">{isFa ? 'کل صفحات مبدا' : 'Pages'}</div>
              <div className="text-lg font-bold font-mono text-emerald-500 mt-0.5">
                {totalPrintablePages}
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isDark ? 'bg-neutral-850 border-neutral-750' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-[10px] text-neutral-400 font-semibold">{isFa ? 'تعداد شیت‌ها' : 'Sheets'}</div>
              <div className="text-lg font-bold font-mono text-purple-500 mt-0.5">
                {totalSheetsNeeded}
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isDark ? 'bg-neutral-850 border-neutral-750' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-[10px] text-neutral-400 font-semibold">{isFa ? 'برگ فیزیکی کاغذ' : 'Paper Sheets'}</div>
              <div className="text-lg font-bold font-mono text-amber-500 mt-0.5">
                {physicalPaperSheets}
              </div>
            </div>
          </div>

          {/* Print Specifications Summary */}
          <div className={`p-3.5 rounded-xl border space-y-2 text-xs font-mono ${isDark ? 'bg-neutral-850 border-neutral-750' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex justify-between pb-1 border-b border-neutral-200 dark:border-neutral-750">
              <span className="text-neutral-400">{isFa ? 'چاپگر مقصد:' : 'Target Printer:'}</span>
              <span className="font-semibold text-neutral-100 dark:text-white">
                {settings.printerName || (isFa ? 'چاپگر پیش‌فرض سیستم' : 'System Default')}
              </span>
            </div>

            <div className="flex justify-between pb-1 border-b border-neutral-200 dark:border-neutral-750">
              <span className="text-neutral-400">{isFa ? 'اندازه و جهت کاغذ:' : 'Paper & Orientation:'}</span>
              <span className="font-semibold">
                {settings.paperSize} · {settings.orientation}
              </span>
            </div>

            <div className="flex justify-between pb-1 border-b border-neutral-200 dark:border-neutral-750">
              <span className="text-neutral-400">{isFa ? 'حالت چاپ دورو:' : 'Duplex Mode:'}</span>
              <span className="font-semibold">
                {settings.duplex === 'simplex'
                  ? isFa ? 'یک‌رو (Simplex)' : 'Simplex'
                  : settings.duplex === 'booklet'
                  ? isFa ? 'جزوه و بوکلت تا شده' : 'Booklet'
                  : isFa ? 'دورو' : 'Duplex'}
              </span>
            </div>

            <div className="flex justify-between pb-1 border-b border-neutral-200 dark:border-neutral-750">
              <span className="text-neutral-400">{isFa ? 'مونتاژ صفحات (N-Up):' : 'Imposition:'}</span>
              <span className="font-semibold">
                {isGrid ? `${rows} × ${cols} (${cellsPerSheet} صفحه در هر شیت)` : isFa ? 'تک‌صفحه (1-Up)' : '1-Up Standard'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-400">{isFa ? 'تعداد نسخه‌ها (Copies):' : 'Copies:'}</span>
              <span className="font-semibold">{settings.copies} نسخه</span>
            </div>
          </div>

          {/* Warnings List */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((w) => (
                <div
                  key={w.id}
                  className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                    w.level === 'warn'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{isFa ? w.messageFa : w.messageEn}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2.5 bg-black/5 dark:bg-neutral-950/40">
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              isDark ? 'border-neutral-700 hover:bg-neutral-800' : 'border-slate-300 hover:bg-slate-100'
            }`}
          >
            {isFa ? 'انصراف' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onConfirmPrint();
            }}
            disabled={totalPrintablePages === 0}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/30 flex items-center gap-2 cursor-pointer active:scale-97 disabled:opacity-40"
          >
            <Printer className="w-4 h-4" />
            <span>{isFa ? 'تایید و ارسال به چاپگر' : 'Proceed to Print'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
