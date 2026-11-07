import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  FileText,
  Layers,
  Settings,
  CheckCircle2,
  AlertCircle,
  Check,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ListOrdered,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { translations } from '../utils/translations';
import {
  Language,
  PDFItem,
  PrintSettings,
  PaperSize,
  PaperTray,
  ColorMode,
  DuplexMode,
  PrintOrientation,
  PrintSpoolMode,
  GridLayoutSettings,
  defaultGridLayoutSettings,
  ElectronPrinter,
} from '../types';
import { executeContinuousBatchPrint, executeSingleItemPrint } from '../utils/printUtils';
import { GridMatrixPicker } from './GridMatrixPicker';
import { PrintPreviewSheet } from './PrintPreviewSheet';

interface PrintModalProps {
  items: PDFItem[];
  lang: Language;
  theme: 'dark' | 'light';
  onClose: () => void;
  initialGridSettings?: GridLayoutSettings;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  items,
  lang,
  theme,
  onClose,
  initialGridSettings,
}) => {
  const t = translations[lang];
  const isDark = theme === 'dark';

  // Mobile active tab: 'settings' or 'preview'
  const [mobileTab, setMobileTab] = useState<'settings' | 'preview'>('settings');

  // Selection of files to print
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(() =>
    items.map((i) => i.id)
  );

  // Print settings
  const [settings, setSettings] = useState<PrintSettings>({
    printerName: 'Windows Default Spooler (چاپگر پیش‌فرض سیستم)',
    printSpoolMode: 'continuous',
    paperSize: 'A4',
    paperTray: 'auto',
    colorMode: 'bw',
    duplex: 'simplex',
    orientation: 'auto',
    copies: 1,
    scaling: 'fit',
    collate: true,
    gridLayout: initialGridSettings || { ...defaultGridLayoutSettings },
  });

  // Printing state
  const [isPrinting, setIsPrinting] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [printSuccess, setPrintSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status map for separate printing mode: itemId -> 'waiting' | 'printing' | 'done' | 'error'
  const [fileStatus, setFileStatus] = useState<Record<string, 'waiting' | 'printing' | 'done' | 'error'>>({});

  // System printers detected on Windows machine
  const [systemPrinters, setSystemPrinters] = useState<ElectronPrinter[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  // Auto-detect Windows printers
  const refreshPrinters = async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.getPrinters) {
      setLoadingPrinters(true);
      try {
        const list = await window.electronAPI.getPrinters();
        if (list && list.length > 0) {
          setSystemPrinters(list);
          // Set to default Windows printer if not already customized
          const defaultP = list.find((p) => p.isDefault);
          if (defaultP) {
            setSettings((prev) => ({
              ...prev,
              printerName: defaultP.name,
            }));
          }
        }
      } catch (err) {
        console.warn('Printer discovery error:', err);
      } finally {
        setLoadingPrinters(false);
      }
    }
  };

  useEffect(() => {
    refreshPrinters();
  }, []);

  const targetItems = items.filter((i) => selectedItemIds.includes(i.id));

  const totalPagesToPrint = targetItems.reduce((sum, item) => {
    const totalP = item.pageCount || 1;
    let activePages = 0;
    for (let p = 1; p <= totalP; p++) {
      const adj = item.pageAdjustments?.[p];
      if (!adj || adj.selectedForPrint) {
        activePages++;
      }
    }
    return sum + activePages;
  }, 0);

  const toggleItemSelect = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // 1. Continuous (Merged) Print Execution
  const handleContinuousPrint = async () => {
    if (targetItems.length === 0) {
      setErrorMessage(t.selectAtLeastOnePrint);
      return;
    }

    setIsPrinting(true);
    setErrorMessage(null);
    setProgressPercent(5);
    setProgressText('در حال آماده‌سازی و ادغام اسناد جهت چاپ یکسره...');

    try {
      await executeContinuousBatchPrint(
        targetItems,
        settings,
        (currentF, totalF, currentP, totalP, pct, fileName) => {
          setProgressPercent(pct);
          setProgressText(`${fileName} (${currentP} از ${totalP} صفحه)`);
        }
      );

      setPrintSuccess(true);
      setProgressPercent(100);
      setProgressText('اسناد با موفقیت به صف چاپگر ارسال شدند!');
    } catch (err) {
      console.error('Print spool error:', err);
      setErrorMessage((err as Error).message || 'خطا در صف چاپ');
    } finally {
      setIsPrinting(false);
    }
  };

  // 2. Individual / Separate Print for a single specific file
  const handlePrintSingleFile = async (item: PDFItem) => {
    setIsPrinting(true);
    setErrorMessage(null);
    setFileStatus((prev) => ({ ...prev, [item.id]: 'printing' }));
    setProgressText(`در حال ارسال سند "${item.name}" به صف چاپ...`);

    try {
      await executeSingleItemPrint(item, settings, (pct, msg) => {
        setProgressPercent(pct);
        setProgressText(msg);
      });
      setFileStatus((prev) => ({ ...prev, [item.id]: 'done' }));
    } catch (err) {
      console.error(`Error printing ${item.name}:`, err);
      setFileStatus((prev) => ({ ...prev, [item.id]: 'error' }));
      setErrorMessage((err as Error).message);
    } finally {
      setIsPrinting(false);
    }
  };

  // 3. Sequential Separate Printing of all files one-by-one
  const handlePrintAllSeparately = async () => {
    if (targetItems.length === 0) {
      setErrorMessage(t.selectAtLeastOnePrint);
      return;
    }

    setIsPrinting(true);
    setErrorMessage(null);

    const initialStatus: Record<string, 'waiting' | 'printing' | 'done' | 'error'> = {};
    targetItems.forEach((i) => (initialStatus[i.id] = 'waiting'));
    setFileStatus(initialStatus);

    for (let idx = 0; idx < targetItems.length; idx++) {
      const item = targetItems[idx];
      setFileStatus((prev) => ({ ...prev, [item.id]: 'printing' }));
      setProgressText(`در حال پردازش و چاپ سند ${idx + 1} از ${targetItems.length}: ${item.name}`);
      const basePct = Math.round((idx / targetItems.length) * 100);
      setProgressPercent(basePct);

      try {
        await executeSingleItemPrint(item, settings);
        setFileStatus((prev) => ({ ...prev, [item.id]: 'done' }));
      } catch (err) {
        console.error(`Failed printing ${item.name}:`, err);
        setFileStatus((prev) => ({ ...prev, [item.id]: 'error' }));
      }

      // Small pause between separate spool jobs so Windows spooler processes each cleanly
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    setProgressPercent(100);
    setProgressText('تمامی اسناد به صورت مجزا به صف چاپگر فرستاده شدند.');
    setIsPrinting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-6xl max-h-[92vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-colors ${
          isDark
            ? 'bg-neutral-900 border-neutral-750 text-neutral-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between transition-colors shrink-0 ${
            isDark ? 'bg-neutral-950/80 border-neutral-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-500">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {t.printModalTitle}
              </h3>
              <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                {targetItems.length} سند · {totalPagesToPrint} صفحه انتخابی جهت چاپ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Mobile Tab Switcher */}
            {!printSuccess && (
              <div className="flex lg:hidden items-center bg-black/10 dark:bg-neutral-800 p-1 rounded-xl border border-neutral-700/40 text-xs">
                <button
                  type="button"
                  onClick={() => setMobileTab('settings')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    mobileTab === 'settings'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  تنظیمات چاپ
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab('preview')}
                  className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-all cursor-pointer ${
                    mobileTab === 'preview'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>پیش‌نمایش برگه</span>
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-slate-200 text-slate-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        {printSuccess ? (
          <div className="p-6 sm:p-8 space-y-4 py-8 overflow-y-auto">
            <div
              className={`p-5 rounded-xl border flex items-start gap-3 ${
                isDark
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">{t.printSuccessTitle}</h4>
                <p className="text-xs mt-1 leading-relaxed">
                  {t.printSuccessDesc}
                </p>
                <p className="text-xs font-mono mt-2 text-emerald-600 dark:text-emerald-400">
                  تعداد کل صفحات چاپ شده: {totalPagesToPrint} صفحه ({settings.paperSize} / {settings.colorMode === 'bw' ? 'B&W' : 'Color'})
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors cursor-pointer"
              >
                {t.close}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Split Workspace: Left Panel (Settings) & Right Panel (Live Print Preview) */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
              {/* Settings Column */}
              <div
                className={`lg:w-[48%] xl:w-[45%] p-4 sm:p-5 space-y-4 overflow-y-auto ${
                  mobileTab === 'settings' ? 'block' : 'hidden lg:block'
                }`}
              >
                {/* 2 Print Mode Options (Continuous vs Separate) */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold">
                    نحوه ارسال کار چاپ به چاپگر:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Option 1: Continuous / Merged */}
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, printSpoolMode: 'continuous' })}
                    className={`p-3.5 rounded-xl border text-start transition-all cursor-pointer ${
                      settings.printSpoolMode === 'continuous'
                        ? isDark
                          ? 'bg-blue-950/50 border-blue-500 text-white ring-1 ring-blue-500'
                          : 'bg-blue-50 border-blue-500 text-blue-950 ring-1 ring-blue-500'
                        : isDark
                        ? 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Layers className="w-4 h-4 text-blue-500" />
                      <span>چاپ پیوسته و یکسره (ادغام کارها)</span>
                    </div>
                    <p className={`text-[11px] mt-1.5 leading-relaxed ${
                      isDark ? 'text-neutral-400' : 'text-slate-500'
                    }`}>
                      تمام فایل‌های انتخابی ادغام شده و در یک نوبت و یکسره به پرینتر فرستاده می‌شوند.
                    </p>
                  </button>

                  {/* Option 2: Separate / Individual */}
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, printSpoolMode: 'separate' })}
                    className={`p-3.5 rounded-xl border text-start transition-all cursor-pointer ${
                      settings.printSpoolMode === 'separate'
                        ? isDark
                          ? 'bg-emerald-950/50 border-emerald-500 text-white ring-1 ring-emerald-500'
                          : 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500'
                        : isDark
                        ? 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <ListOrdered className="w-4 h-4 text-emerald-500" />
                      <span>چاپ مجزا و تفکیک‌شده (جداگانه)</span>
                    </div>
                    <p className={`text-[11px] mt-1.5 leading-relaxed ${
                      isDark ? 'text-neutral-400' : 'text-slate-500'
                    }`}>
                      هر فایل به عنوان یک کار چاپ مستقل با نام مجزا ارسال می‌شود تا اسناد با هم مخلوط نشوند.
                    </p>
                  </button>
                </div>
              </div>

              {/* Target Files Selection Strip */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold">
                    انتخاب فایل‌ها ({selectedItemIds.length} از {items.length})
                  </span>
                  <button
                    onClick={() =>
                      setSelectedItemIds(
                        selectedItemIds.length === items.length
                          ? []
                          : items.map((i) => i.id)
                      )
                    }
                    className="text-blue-500 hover:underline text-[11px] cursor-pointer"
                  >
                    {selectedItemIds.length === items.length
                      ? t.deselectAll
                      : t.selectAll}
                  </button>
                </div>

                <div
                  className={`max-h-36 overflow-y-auto rounded-xl border p-2 space-y-1 ${
                    isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {items.map((item) => {
                    const isChecked = selectedItemIds.includes(item.id);
                    const status = fileStatus[item.id];

                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleItemSelect(item.id)}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? isDark
                              ? 'bg-neutral-850 text-white'
                              : 'bg-white text-slate-900 shadow-sm border border-slate-200'
                            : isDark
                            ? 'opacity-60 hover:opacity-100'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <button
                            type="button"
                            className={`w-4 h-4 rounded flex items-center justify-center ${
                              isChecked
                                ? 'bg-blue-600 text-white'
                                : isDark
                                ? 'border border-neutral-600'
                                : 'border border-slate-300'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                          <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ps-2" onClick={(e) => e.stopPropagation()}>
                          <span className="font-mono text-neutral-400">
                            {item.pageCount} صفحه
                          </span>

                          {/* Quick single print button when in Separate mode */}
                          {settings.printSpoolMode === 'separate' && (
                            <button
                              type="button"
                              onClick={() => handlePrintSingleFile(item)}
                              disabled={isPrinting}
                              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                                status === 'done'
                                  ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40'
                                  : status === 'printing'
                                  ? 'bg-amber-600/20 text-amber-400 border-amber-500/40 animate-pulse'
                                  : isDark
                                  ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border-neutral-700'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                              }`}
                              title="چاپ جداگانه همین سند"
                            >
                              {status === 'done'
                                ? 'چاپ شد'
                                : status === 'printing'
                                ? 'در حال چاپ...'
                                : 'چاپ این سند'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Printer Hardware & Spool Settings Grid */}
              <div
                className={`p-4 rounded-xl border space-y-4 text-xs ${
                  isDark ? 'bg-neutral-950/40 border-neutral-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 pb-1 border-b border-neutral-800/40 font-bold">
                  <Settings className="w-4 h-4 text-blue-500" />
                  <span>تنظیمات سخت‌افزاری چاپگر و برگه</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Printer Select with Live Windows Detection */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-neutral-400 font-medium">
                        {t.printerSelect}
                      </label>
                      <button
                        type="button"
                        onClick={refreshPrinters}
                        disabled={loadingPrinters}
                        className="text-[11px] text-blue-500 hover:underline flex items-center gap-1 cursor-pointer"
                        title="بروزرسانی و جستجوی مجدد چاپگرهای متصل به ویندوز"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingPrinters ? 'animate-spin' : ''}`} />
                        <span>بروزرسانی چاپگرها</span>
                      </button>
                    </div>
                    <select
                      value={settings.printerName}
                      onChange={(e) => setSettings({ ...settings, printerName: e.target.value })}
                      className={`w-full p-2 rounded-lg border text-xs focus:outline-none focus:border-blue-500 ${
                        isDark ? 'bg-neutral-900 border-neutral-750 text-white' : 'bg-white border-slate-300 text-slate-800'
                      }`}
                    >
                      {systemPrinters.length > 0 ? (
                        <>
                          <optgroup label="چاپگرهای واقعی شناسایی‌شده در ویندوز">
                            {systemPrinters.map((p) => (
                              <option key={p.name} value={p.name}>
                                {p.name} {p.isDefault ? '⭐ [پیش‌فرض ویندوز]' : ''}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="انتخاب دستی">
                            <option value="Windows Default Spooler (دیالوگ ویندوز)">
                              دیالوگ مستقیم چاپ ویندوز (انتخاب از تمام پرینترها)
                            </option>
                          </optgroup>
                        </>
                      ) : (
                        <>
                          <option value="Windows Default Spooler (چاپگر پیش‌فرض سیستم)">
                            دیالوگ مستقیم چاپ ویندوز (نمایش تمام پرینترهای نصب‌شده روی رایانه)
                          </option>
                          <option value="Microsoft Print to PDF">
                            Microsoft Print to PDF (پرینتر مجازی ویندوز)
                          </option>
                        </>
                      )}
                    </select>
                    <p className="text-[10px] text-neutral-400 mt-1 flex items-center gap-1">
                      {systemPrinters.length > 0 ? (
                        <span className="text-emerald-500 font-medium">
                          ✓ {systemPrinters.length} چاپگر واقعی ویندوز متصل و شناسایی شدند.
                        </span>
                      ) : (
                        <span>
                          ℹ️ در نسخه دسکتاپ ویندوز (.exe)، کلیه پرینترهای متصل به رایانه به صورت خودکار شناسایی می‌شوند.
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Paper Size */}
                  <div>
                    <label className="block text-neutral-400 mb-1 font-medium">
                      {t.paperSize}
                    </label>
                    <select
                      value={settings.paperSize}
                      onChange={(e) => setSettings({ ...settings, paperSize: e.target.value as PaperSize })}
                      className={`w-full p-2 rounded-lg border text-xs focus:outline-none focus:border-blue-500 font-mono ${
                        isDark ? 'bg-neutral-900 border-neutral-750 text-white' : 'bg-white border-slate-300 text-slate-800'
                      }`}
                    >
                      <option value="A4">A4 (210 × 297 mm) - استاندارد</option>
                      <option value="A3">A3 (297 × 420 mm) - بزرگ</option>
                      <option value="A5">A5 (148 × 210 mm) - نیم‌ورق</option>
                      <option value="Letter">Letter (8.5 × 11 in) - استاندارد بین‌المللی</option>
                      <option value="Legal">Legal (8.5 × 14 in) - اسناد حقوقی بلند</option>
                      <option value="B5">B5 (176 × 250 mm) - کتابی</option>
                    </select>
                  </div>

                  {/* Paper Tray */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-neutral-400 font-medium">
                        {t.paperTray}
                      </label>
                      <span className="text-[10px] text-amber-500 font-mono">
                        (مدیریت در درایور پرینتر)
                      </span>
                    </div>
                    <select
                      disabled
                      value="auto"
                      title="موتور چاپ کرومیوم/الکترون فاقد API مستقیم انتخاب سینی است؛ سینی پیش‌فرض تنظیم‌شده در کنترل پنل پرینتر ویندوز استفاده می‌شود."
                      className={`w-full p-2 rounded-lg border text-xs opacity-60 cursor-not-allowed ${
                        isDark ? 'bg-neutral-900 border-neutral-750 text-neutral-400' : 'bg-slate-100 border-slate-300 text-slate-500'
                      }`}
                    >
                      <option value="auto">سینی پیش‌فرض تنظیم‌شده در درایور ویندوز (Default Driver Tray)</option>
                    </select>
                  </div>

                  {/* Color Mode */}
                  <div>
                    <label className="block text-neutral-400 mb-1 font-medium">
                      {t.colorMode}
                    </label>
                    <select
                      value={settings.colorMode}
                      onChange={(e) => setSettings({ ...settings, colorMode: e.target.value as ColorMode })}
                      className={`w-full p-2 rounded-lg border text-xs focus:outline-none focus:border-blue-500 ${
                        isDark ? 'bg-neutral-900 border-neutral-750 text-white' : 'bg-white border-slate-300 text-slate-800'
                      }`}
                    >
                      <option value="bw">سیاه و سفید خالص پرینتری (Laser Pure B&W)</option>
                      <option value="grayscale">خاکستری استاندارد (Standard Grayscale)</option>
                      <option value="color">تمام رنگی (Full Color)</option>
                    </select>
                  </div>

                   {/* Duplex */}
                  <div>
                    <label className="block text-neutral-400 mb-1 font-medium">
                      {t.duplex}
                    </label>
                    <select
                      value={settings.duplex}
                      onChange={(e) => setSettings({ ...settings, duplex: e.target.value as DuplexMode })}
                      className={`w-full p-2 rounded-lg border text-xs focus:outline-none focus:border-blue-500 ${
                        isDark ? 'bg-neutral-900 border-neutral-750 text-white' : 'bg-white border-slate-300 text-slate-800'
                      }`}
                    >
                      <option value="simplex">یک‌رو (Simplex)</option>
                      <option value="duplexLong">دورو - ورق‌زدن از لبه بلند (Duplex Long Edge)</option>
                      <option value="duplexShort">دورو - ورق‌زدن از لبه کوتاه (Duplex Short Edge)</option>
                      <option value="booklet">جزوه و بوکلت تا شده (Booklet Imposition)</option>
                    </select>
                  </div>

                  {/* Print Orientation */}
                  <div>
                    <label className="block text-neutral-400 mb-1 font-medium">
                      جهت قرارگیری برگه (Orientation)
                    </label>
                    <select
                      value={settings.orientation}
                      onChange={(e) => setSettings({ ...settings, orientation: e.target.value as PrintOrientation })}
                      className={`w-full p-2 rounded-lg border text-xs focus:outline-none focus:border-blue-500 ${
                        isDark ? 'bg-neutral-900 border-neutral-750 text-white' : 'bg-white border-slate-300 text-slate-800'
                      }`}
                    >
                      <option value="auto">انتخاب خودکار هوشمند (Auto Portrait/Landscape)</option>
                      <option value="portrait">عمودی (Portrait)</option>
                      <option value="landscape">افقی (Landscape)</option>
                    </select>
                  </div>

                  {/* Image Scaling */}
                  <div>
                    <label className="block text-neutral-400 mb-1 font-medium">
                      مقیاس تصویر و تناسب (Scaling)
                    </label>
                    <select
                      value={settings.scaling}
                      onChange={(e) => setSettings({ ...settings, scaling: e.target.value as 'fit' | 'actual' | 'shrink' })}
                      className={`w-full p-2 rounded-lg border text-xs focus:outline-none focus:border-blue-500 ${
                        isDark ? 'bg-neutral-900 border-neutral-750 text-white' : 'bg-white border-slate-300 text-slate-800'
                      }`}
                    >
                      <option value="fit">تناسب کامل با اندازه برگه (Fit to Page)</option>
                      <option value="shrink">کاهش اندازه فقط در صورت لزوم (Shrink to Page)</option>
                      <option value="actual">اندازه واقعی و اصلی سند (Actual Size)</option>
                    </select>
                  </div>

                  {/* Copies */}
                  <div>
                    <label className="block text-neutral-400 mb-1 font-medium">
                      {t.copies}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={settings.copies}
                        onChange={(e) =>
                          setSettings({ ...settings, copies: Math.max(1, parseInt(e.target.value) || 1) })
                        }
                        className={`w-24 p-2 rounded-lg border text-xs focus:outline-none focus:border-blue-500 font-mono ${
                          isDark ? 'bg-neutral-900 border-neutral-750 text-white' : 'bg-white border-slate-300 text-slate-800'
                        }`}
                      />
                      <label className="flex items-center gap-1.5 text-neutral-400 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={settings.collate}
                          onChange={(e) => setSettings({ ...settings, collate: e.target.checked })}
                          className="accent-blue-600"
                        />
                        <span>دسته‌بندی منظم نسخه‌ها (Collate)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* N-Up Grid Imposition Card */}
              <div
                className={`p-4 rounded-xl border space-y-3 text-xs transition-colors ${
                  settings.gridLayout?.enabled
                    ? isDark
                      ? 'bg-purple-950/20 border-purple-500/40'
                      : 'bg-purple-50/50 border-purple-300'
                    : isDark
                    ? 'bg-neutral-950/40 border-neutral-800'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 font-bold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings.gridLayout?.enabled || false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          gridLayout: {
                            ...(settings.gridLayout || defaultGridLayoutSettings),
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 accent-purple-600"
                    />
                    <span className="flex items-center gap-1.5 text-xs sm:text-sm">
                      <GridMatrixPicker
                        rows={settings.gridLayout?.rows || 4}
                        cols={settings.gridLayout?.cols || 3}
                        onChange={(r, c) =>
                          setSettings({
                            ...settings,
                            gridLayout: {
                              ...(settings.gridLayout || defaultGridLayoutSettings),
                              enabled: true,
                              rows: r,
                              cols: c,
                            },
                          })
                        }
                        theme={theme}
                      />
                      <span>چیدمان جدولی در هر برگ (N-Up Imposition)</span>
                    </span>
                  </label>

                  {settings.gridLayout?.enabled && (
                    <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                      {settings.gridLayout.cols * settings.gridLayout.rows} صفحه در هر برگ
                    </span>
                  )}
                </div>

                {settings.gridLayout?.enabled && (
                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-purple-500/20">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={settings.gridLayout.repeatPage}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            gridLayout: {
                              ...settings.gridLayout!,
                              repeatPage: e.target.checked,
                            },
                          })
                        }
                        className="accent-purple-600"
                      />
                      <span className="text-xs">تکرار هر صفحه در تمام جدول (Repeat)</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <span className="text-neutral-400">ترتیب:</span>
                      <select
                        value={settings.gridLayout.order}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            gridLayout: {
                              ...settings.gridLayout!,
                              order: e.target.value as GridLayoutSettings['order'],
                            },
                          })
                        }
                        className={`p-1.5 rounded-lg border text-xs ${
                          isDark
                            ? 'bg-neutral-900 border-neutral-750 text-white'
                            : 'bg-white border-slate-300 text-slate-800'
                        }`}
                      >
                        <option value="rtl-rows">افقی راست‌به‌چپ (فارسی) [2 1 / 4 3]</option>
                        <option value="ltr-rows">افقی چپ‌به‌راست (لاتین) [1 2 / 3 4]</option>
                        <option value="rtl-cols">عمودی ستونی راست‌به‌چپ</option>
                        <option value="ltr-cols">عمودی ستونی چپ‌به‌راست</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Real-Time Print Preview Column */}
            <div
              className={`lg:w-[52%] xl:w-[55%] flex flex-col border-t lg:border-t-0 lg:border-s border-neutral-800/40 bg-neutral-950/20 overflow-hidden ${
                mobileTab === 'preview' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              <PrintPreviewSheet
                items={items}
                selectedItemIds={selectedItemIds}
                settings={settings}
                theme={theme}
                lang={lang}
              />
            </div>
          </div>

          {/* Bottom Sticky Action & Progress Bar */}
          <div
            className={`p-4 sm:px-6 sm:py-3.5 border-t shrink-0 flex flex-col gap-2.5 ${
              isDark ? 'bg-neutral-950/80 border-neutral-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            {/* Progress Bar */}
            {isPrinting && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-300">{progressText}</span>
                  <span className="font-mono font-bold text-blue-500">
                    {progressPercent}%
                  </span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-150 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Footer CTA */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isPrinting}
                className={`px-4 py-2.5 text-xs font-medium rounded-xl transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-750'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {t.cancel}
              </button>

              <div className="flex items-center gap-2">
                {settings.printSpoolMode === 'continuous' ? (
                  <button
                    type="button"
                    onClick={handleContinuousPrint}
                    disabled={isPrinting || targetItems.length === 0}
                    className="flex items-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                  >
                    <Layers className="w-4 h-4" />
                    <span>{isPrinting ? 'در حال ارسال یکسره...' : 'شروع چاپ یکپارچه (ادغام و چاپ)'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePrintAllSeparately}
                    disabled={isPrinting || targetItems.length === 0}
                    className="flex items-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <ListOrdered className="w-4 h-4" />
                    <span>{isPrinting ? 'در حال ارسال مجزا...' : 'شروع چاپ تمام اسناد (به‌صورت مجزا)'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  </div>
);
};
