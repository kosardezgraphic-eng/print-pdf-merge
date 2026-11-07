import React, { useState, useEffect } from 'react';
import {
  Printer,
  Download,
  Eye,
  RotateCcw,
  RotateCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Settings,
  HelpCircle,
  Sun,
  Moon,
  Globe,
  Sliders,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { Language, ElectronPrinter, PrintSettings } from '../types';

interface QuickAccessBarProps {
  lang: Language;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onToggleLang: () => void;
  onOpenHelp: () => void;
  onPrintNow: () => void;
  onSaveAsPdf: () => void;
  onPreviewPdf: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  currentPageNumber: number;
  totalPageCount: number;
  onJumpToPage: (page: number) => void;
  activePrinterName: string;
  onChangePrinterName: (name: string) => void;
  onOpenPreflight: () => void;
  onOpenPrinterSettings: () => void;
  hasFiles: boolean;
}

export const QuickAccessBar: React.FC<QuickAccessBarProps> = ({
  lang,
  theme,
  onToggleTheme,
  onToggleLang,
  onOpenHelp,
  onPrintNow,
  onSaveAsPdf,
  onPreviewPdf,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  currentPageNumber,
  totalPageCount,
  onJumpToPage,
  activePrinterName,
  onChangePrinterName,
  onOpenPreflight,
  onOpenPrinterSettings,
  hasFiles,
}) => {
  const isDark = theme === 'dark';
  const isFa = lang === 'fa';

  const [printers, setPrinters] = useState<ElectronPrinter[]>([]);
  const [jumpInput, setJumpInput] = useState<string>('');
  const [isPrinterDropdownOpen, setIsPrinterDropdownOpen] = useState<boolean>(false);

  // Load hardware printers if running in Electron environment
  useEffect(() => {
    if (window.electronAPI?.getPrinters) {
      window.electronAPI
        .getPrinters()
        .then((list) => {
          if (list && list.length > 0) {
            setPrinters(list);
            if (!activePrinterName) {
              const def = list.find((p) => p.isDefault) || list[0];
              onChangePrinterName(def.name);
            }
          }
        })
        .catch((err) => console.warn('Printer fetch notice:', err));
    }
  }, [activePrinterName, onChangePrinterName]);

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(jumpInput, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPageCount) {
      onJumpToPage(num);
      setJumpInput('');
    }
  };

  return (
    <header
      className={`w-full border-b select-none transition-colors shrink-0 relative z-50 overflow-visible ${
        isDark
          ? 'bg-neutral-900 border-neutral-800 text-neutral-100'
          : 'bg-white border-slate-200 text-slate-900 shadow-xs'
      }`}
    >
      <div className="px-3 sm:px-4 h-12 flex items-center justify-between gap-2 overflow-visible">
        {/* Left Zone: Brand + Direct Print & Save Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Logo & Product Name */}
          <div className="flex items-center gap-2 me-2">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Printer className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-sm tracking-tight text-blue-600 dark:text-blue-400">
                PDF Counter
              </span>
              <span className="text-xs font-semibold text-neutral-500 hidden md:inline">
                &amp; Merger Pro
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-800 hidden sm:block" />

          {/* Primary Action: PRINT NOW */}
          <button
            type="button"
            onClick={onPrintNow}
            disabled={!hasFiles}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
              hasFiles
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:scale-97'
                : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed opacity-60'
            }`}
            title={isFa ? 'چاپ فوری (کلید میانبر: Ctrl+P)' : 'Print Now (Ctrl+P)'}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isFa ? 'چاپ فوری' : 'Print Now'}</span>
            <kbd className="hidden lg:inline-block text-[10px] font-mono px-1 py-0.2 bg-blue-700/50 rounded-xs">
              Ctrl+P
            </kbd>
          </button>

          {/* Secondary Action: Save as PDF */}
          <button
            type="button"
            onClick={onSaveAsPdf}
            disabled={!hasFiles}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              hasFiles
                ? isDark
                  ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border-neutral-700'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300'
                : 'opacity-40 cursor-not-allowed border-transparent'
            }`}
            title={isFa ? 'ذخیره شیت‌ها یا فایل به‌صورت PDF نهایی' : 'Save as PDF Document'}
          >
            <Download className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">{isFa ? 'ذخیره به‌صورت PDF' : 'Save as PDF'}</span>
          </button>

          {/* Pre-flight Summary Button */}
          <button
            type="button"
            onClick={onOpenPreflight}
            disabled={!hasFiles}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              hasFiles
                ? isDark
                  ? 'bg-neutral-800/80 hover:bg-neutral-750 text-neutral-300 border-neutral-700/70'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                : 'opacity-40 cursor-not-allowed border-transparent'
            }`}
            title={isFa ? 'بررسی خلاصه قبل از چاپ (Pre-flight)' : 'Pre-flight Summary Checklist'}
          >
            <Eye className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden md:inline">{isFa ? 'خلاصه قبل چاپ' : 'Pre-flight'}</span>
          </button>

          {/* Undo / Redo */}
          <div className="flex items-center border border-neutral-300 dark:border-neutral-750 rounded-lg overflow-hidden ms-1">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-1.5 transition-colors cursor-pointer ${
                canUndo
                  ? isDark
                    ? 'hover:bg-neutral-800 text-neutral-200'
                    : 'hover:bg-slate-100 text-slate-800'
                  : 'opacity-30 cursor-not-allowed text-neutral-400'
              }`}
              title={isFa ? 'بازگشت به عقب (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-3.5 bg-neutral-300 dark:bg-neutral-750" />
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-1.5 transition-colors cursor-pointer ${
                canRedo
                  ? isDark
                    ? 'hover:bg-neutral-800 text-neutral-200'
                    : 'hover:bg-slate-100 text-slate-800'
                  : 'opacity-30 cursor-not-allowed text-neutral-400'
              }`}
              title={isFa ? 'انجام دوباره (Ctrl+Y)' : 'Redo (Ctrl+Y)'}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Jump to Page */}
          {totalPageCount > 1 && (
            <form onSubmit={handleJumpSubmit} className="hidden sm:flex items-center gap-1 ms-1">
              <span className="text-[11px] text-neutral-400">{isFa ? 'صفحه:' : 'Page:'}</span>
              <input
                type="number"
                min={1}
                max={totalPageCount}
                placeholder={`${currentPageNumber}/${totalPageCount}`}
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                className={`w-14 px-1.5 py-0.5 text-xs text-center font-mono rounded-md border transition-colors ${
                  isDark
                    ? 'bg-neutral-800 border-neutral-700 text-neutral-100 focus:border-blue-500'
                    : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'
                }`}
              />
            </form>
          )}
        </div>

        {/* Right Zone: Printer Selector & System Preferences */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Active Printer Dropdown & Status */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsPrinterDropdownOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
                isDark
                  ? 'bg-neutral-800 hover:bg-neutral-750 border-neutral-700 text-neutral-200'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800'
              }`}
              title={isFa ? 'انتخاب چاپگر مقصد' : 'Select Target Printer'}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Printer className="w-3.5 h-3.5 text-neutral-400" />
              <span className="max-w-[110px] sm:max-w-[140px] truncate font-mono text-[11px]">
                {activePrinterName || (isFa ? 'انتخاب خودکار ویندوز' : 'System Default')}
              </span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>

            {isPrinterDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setIsPrinterDropdownOpen(false)}
                />
                <div
                  className={`absolute top-full end-0 mt-1.5 w-64 rounded-xl border shadow-2xl py-1.5 z-50 text-xs ${
                    isDark
                      ? 'bg-neutral-900 border-neutral-750 text-neutral-100'
                      : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                <div className="px-3 py-1 text-[11px] font-semibold text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                  {isFa ? 'چاپگرهای در دسترس' : 'Available Printers'}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onChangePrinterName('');
                    setIsPrinterDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-start flex items-center justify-between hover:bg-blue-600/10 transition-colors cursor-pointer ${
                    !activePrinterName ? 'text-blue-500 font-bold' : ''
                  }`}
                >
                  <span className="truncate">{isFa ? 'انتخاب خودکار ویندوز (Default)' : 'Windows Default / Auto'}</span>
                  {!activePrinterName && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />}
                </button>

                {printers.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      onChangePrinterName(p.name);
                      setIsPrinterDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-start flex items-center justify-between hover:bg-blue-600/10 transition-colors cursor-pointer ${
                      activePrinterName === p.name ? 'text-blue-500 font-bold' : ''
                    }`}
                  >
                    <div className="truncate">
                      <div className="truncate">{p.displayName || p.name}</div>
                      <div className="text-[10px] text-neutral-400 font-mono">
                        {p.isDefault ? (isFa ? 'پرینتر پیش‌فرض' : 'Default') : isFa ? 'آماده' : 'Ready'}
                      </div>
                    </div>
                    {activePrinterName === p.name && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    )}
                  </button>
                ))}

                <div className="border-t border-neutral-200 dark:border-neutral-800 mt-1 pt-1 px-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrinterDropdownOpen(false);
                      onOpenPrinterSettings();
                    }}
                    className="w-full text-center py-1.5 text-blue-500 hover:underline flex items-center justify-center gap-1"
                  >
                    <Settings className="w-3 h-3" />
                    <span>{isFa ? 'تنظیمات پیشرفته چاپگر...' : 'Advanced Printer Settings...'}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

          {/* Quick Help */}
          <button
            type="button"
            onClick={onOpenHelp}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 border-neutral-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
            }`}
            title={isFa ? 'راهنمای کاربری و نسخه ویندوز' : 'Help & Windows Guide'}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Language Switcher */}
          <button
            type="button"
            onClick={onToggleLang}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? 'text-neutral-300 hover:text-white bg-neutral-800 border-neutral-700'
                : 'text-slate-700 hover:text-slate-900 bg-slate-100 border-slate-200'
            }`}
            title={isFa ? 'Switch to English' : 'تغییر به زبان فارسی'}
          >
            <Globe className="w-3 h-3 text-neutral-400" />
            <span className="font-semibold text-[11px]">{isFa ? 'EN' : 'فا'}</span>
          </button>

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={onToggleTheme}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? 'text-neutral-300 hover:text-white bg-neutral-800 border-neutral-700'
                : 'text-slate-700 hover:text-slate-900 bg-slate-100 border-slate-200'
            }`}
            title={isDark ? (isFa ? 'حالت روشن' : 'Light Mode') : isFa ? 'حالت تیره' : 'Dark Mode'}
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
          </button>
        </div>
      </div>
    </header>
  );
};
