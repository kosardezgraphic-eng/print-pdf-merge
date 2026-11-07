import React from 'react';
import {
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Printer,
  FileText,
  Layers,
  Table as TableIcon,
  LayoutGrid,
  CheckCircle2,
} from 'lucide-react';
import { Language, PaperSize, DuplexMode } from '../types';

interface BottomStatusBarProps {
  lang: Language;
  theme: 'dark' | 'light';
  currentPageNumber: number;
  totalPageCount: number;
  totalPhysicalSheets: number;
  currentSheetNumber: number;
  paperSize: PaperSize;
  orientation: 'auto' | 'portrait' | 'landscape';
  duplex: DuplexMode;
  zoomLevel: number;
  onChangeZoom: (level: number) => void;
  onRotateCurrent: () => void;
  viewMode: 'sheet' | 'cards' | 'table';
  onChangeViewMode: (mode: 'sheet' | 'cards' | 'table') => void;
  statusMessage?: string;
  hasFiles: boolean;
}

export const BottomStatusBar: React.FC<BottomStatusBarProps> = ({
  lang,
  theme,
  currentPageNumber,
  totalPageCount,
  totalPhysicalSheets,
  currentSheetNumber,
  paperSize,
  orientation,
  duplex,
  zoomLevel,
  onChangeZoom,
  onRotateCurrent,
  viewMode,
  onChangeViewMode,
  statusMessage,
  hasFiles,
}) => {
  const isDark = theme === 'dark';
  const isFa = lang === 'fa';

  const duplexLabels: Record<DuplexMode, { fa: string; en: string }> = {
    simplex: { fa: 'یک‌رو', en: '1-Sided' },
    duplexLong: { fa: 'دورو بلند', en: '2-Sided Long' },
    duplexShort: { fa: 'دورو کوتاه', en: '2-Sided Short' },
    booklet: { fa: 'بوکلت و جزوه', en: 'Booklet' },
  };

  return (
    <footer
      className={`w-full h-8 border-t px-3 flex items-center justify-between text-[11px] select-none shrink-0 transition-colors relative z-30 ${
        isDark
          ? 'bg-neutral-900 border-neutral-800 text-neutral-300'
          : 'bg-white border-slate-300 text-slate-700 shadow-xs'
      }`}
    >
      {/* Left Zone: Status text & Page/Sheet stats */}
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex items-center gap-1.5 truncate">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="truncate">
            {statusMessage ||
              (isFa
                ? 'آماده چاپ — کلیدهای میانبر: Ctrl+P چاپ | Ctrl+X پیش‌پرواز و چاپ'
                : 'Ready for print — Shortcuts: Ctrl+P Print | Ctrl+X Pre-flight')}
          </span>
        </div>

        {hasFiles && (
          <div className="hidden sm:flex items-center gap-2 border-s border-neutral-300 dark:border-neutral-750 ps-3 font-mono">
            <span>
              {isFa ? 'صفحه:' : 'Page:'} {currentPageNumber || 1} / {totalPageCount}
            </span>
            <span>·</span>
            <span>
              {isFa ? 'شیت:' : 'Sheet:'} {currentSheetNumber || 1} / {totalPhysicalSheets || 1}
            </span>
          </div>
        )}
      </div>

      {/* Right Zone: Paper Specs, Quick Rotate, Zoom Slider & View Modes */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Paper & Duplex Spec Badge */}
        <div className="hidden md:flex items-center gap-1.5 font-mono text-[10px] text-neutral-400">
          <span>{paperSize}</span>
          <span>·</span>
          <span>{orientation === 'landscape' ? (isFa ? 'افقی' : 'Landscape') : isFa ? 'عمودی' : 'Portrait'}</span>
          <span>·</span>
          <span>{isFa ? duplexLabels[duplex].fa : duplexLabels[duplex].en}</span>
        </div>

        <div className="h-3 w-px bg-neutral-300 dark:bg-neutral-750 hidden md:block" />

        {/* Fast 90-degree rotate */}
        <button
          type="button"
          onClick={onRotateCurrent}
          disabled={!hasFiles}
          className={`p-1 rounded hover:bg-black/10 dark:hover:bg-neutral-800 transition-colors ${
            hasFiles ? 'cursor-pointer text-blue-500' : 'opacity-30 cursor-not-allowed'
          }`}
          title={isFa ? 'چرخش سریع صفحه' : 'Rotate page'}
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        {/* Zoom Controls & Slider */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChangeZoom(Math.max(0.4, zoomLevel - 0.1))}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title={isFa ? 'کوچک‌نمایی' : 'Zoom Out'}
          >
            <ZoomOut className="w-3 h-3" />
          </button>

          <input
            type="range"
            min={0.4}
            max={1.6}
            step={0.05}
            value={zoomLevel}
            onChange={(e) => onChangeZoom(parseFloat(e.target.value))}
            className="w-16 sm:w-20 accent-blue-600 cursor-pointer h-1"
          />

          <button
            type="button"
            onClick={() => onChangeZoom(Math.min(1.6, zoomLevel + 0.1))}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title={isFa ? 'بزرگ‌نمایی' : 'Zoom In'}
          >
            <ZoomIn className="w-3 h-3" />
          </button>

          <span className="font-mono text-[10px] w-8 text-center font-bold">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>

        <div className="h-3 w-px bg-neutral-300 dark:bg-neutral-750" />

        {/* View Mode Icons */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onChangeViewMode('sheet')}
            className={`p-1 rounded transition-colors cursor-pointer ${
              viewMode === 'sheet'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title={isFa ? 'پیش‌نمایش شیت چاپی (WYSIWYG)' : 'Sheet Preview'}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode('cards')}
            className={`p-1 rounded transition-colors cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title={isFa ? 'نمای کارتی اسناد' : 'Cards View'}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode('table')}
            className={`p-1 rounded transition-colors cursor-pointer ${
              viewMode === 'table'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title={isFa ? 'نمای جدولی فشرده' : 'Table View'}
          >
            <TableIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
