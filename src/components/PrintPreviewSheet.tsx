import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Layers,
  Sparkles,
  Maximize,
  RotateCw,
  Eye,
  Check,
  Grid,
} from 'lucide-react';
import { PDFItem, PrintSettings, PaperSize, Language } from '../types';
import { renderPdfPageToDataUrl } from '../utils/pdfRenderUtils';
import { calculateGridCellOrder } from '../utils/gridImpositionUtils';

interface PrintPreviewSheetProps {
  items: PDFItem[];
  selectedItemIds: string[];
  settings: PrintSettings;
  theme: 'dark' | 'light';
  lang: Language;
}

// Physical Paper dimensions in millimeters
export const PAPER_DIMENSIONS_MM: Record<
  PaperSize,
  { widthMm: number; heightMm: number; nameFa: string; nameEn: string }
> = {
  A4: { widthMm: 210, heightMm: 297, nameFa: 'A4 (۲۱۰ × ۲۹۷ میلی‌متر)', nameEn: 'A4 (210 × 297 mm)' },
  A3: { widthMm: 297, heightMm: 420, nameFa: 'A3 (۲۹۷ × ۴۲۰ میلی‌متر)', nameEn: 'A3 (297 × 420 mm)' },
  A5: { widthMm: 148, heightMm: 210, nameFa: 'A5 (۱۴۸ × ۲۱۰ میلی‌متر)', nameEn: 'A5 (148 × 210 mm)' },
  Letter: { widthMm: 215.9, heightMm: 279.4, nameFa: 'Letter (۸.۵ × ۱۱ اینچ)', nameEn: 'Letter (8.5 × 11 in)' },
  Legal: { widthMm: 215.9, heightMm: 355.6, nameFa: 'Legal (۸.۵ × ۱۴ اینچ)', nameEn: 'Legal (8.5 × 14 in)' },
  B5: { widthMm: 176, heightMm: 250, nameFa: 'B5 (۱۷۶ × ۲۵۰ میلی‌متر)', nameEn: 'B5 (176 × 250 mm)' },
};

// In-memory cache for rendered preview data URLs: "itemId_pageNum" -> dataUrl
const previewCache = new Map<string, { dataUrl: string; width: number; height: number }>();

export const PrintPreviewSheet: React.FC<PrintPreviewSheetProps> = ({
  items,
  selectedItemIds,
  settings,
  theme,
  lang,
}) => {
  const isDark = theme === 'dark';

  // Zoom scale for the preview viewport: 0.6 to 1.4
  const [zoomLevel, setZoomLevel] = useState<number>(0.9);
  const [showMarginGuides, setShowMarginGuides] = useState<boolean>(true);
  const [currentSheetIndex, setCurrentSheetIndex] = useState<number>(0);

  // Active printable pages list across selected items
  const activePrintablePages = useMemo(() => {
    const list: { item: PDFItem; pageNum: number; globalPageNum: number }[] = [];
    const selectedItems = items.filter((i) => selectedItemIds.includes(i.id));

    let gCount = 1;
    for (const item of selectedItems) {
      const pageCount = item.pageCount || 1;
      for (let p = 1; p <= pageCount; p++) {
        const adj = item.pageAdjustments?.[p];
        if (!adj || adj.selectedForPrint) {
          list.push({ item, pageNum: p, globalPageNum: gCount++ });
        }
      }
    }
    return list;
  }, [items, selectedItemIds]);

  // Keep sheet index within bounds
  useEffect(() => {
    if (activePrintablePages.length === 0) {
      setCurrentSheetIndex(0);
    } else if (currentSheetIndex >= activePrintablePages.length) {
      setCurrentSheetIndex(activePrintablePages.length - 1);
    }
  }, [activePrintablePages.length, currentSheetIndex]);

  const currentPageTask = activePrintablePages[currentSheetIndex] || null;

  // Rendered preview page state
  const [renderedData, setRenderedData] = useState<{
    dataUrl: string;
    width: number;
    height: number;
  } | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState<boolean>(false);

  // Load preview data URL for current page
  useEffect(() => {
    if (!currentPageTask) {
      setRenderedData(null);
      return;
    }

    const { item, pageNum } = currentPageTask;
    const cacheKey = `${item.id}_${pageNum}`;

    if (previewCache.has(cacheKey)) {
      setRenderedData(previewCache.get(cacheKey)!);
      return;
    }

    let isCancelled = false;
    setIsLoadingPage(true);

    renderPdfPageToDataUrl(item.file, pageNum, 1.0)
      .then((res) => {
        if (!isCancelled) {
          previewCache.set(cacheKey, res);
          setRenderedData(res);
          setIsLoadingPage(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn('Preview render error:', err);
          setIsLoadingPage(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [currentPageTask]);

  // Determine physical Paper dimensions & orientation
  const basePaper = PAPER_DIMENSIONS_MM[settings.paperSize] || PAPER_DIMENSIONS_MM.A4;

  const isLandscape = useMemo(() => {
    if (settings.orientation === 'landscape') return true;
    if (settings.orientation === 'portrait') return false;
    // Auto: determine based on image aspect ratio or default
    if (renderedData) {
      return renderedData.width > renderedData.height;
    }
    return false;
  }, [settings.orientation, renderedData]);

  const effectivePaperWidthMm = isLandscape
    ? Math.max(basePaper.widthMm, basePaper.heightMm)
    : Math.min(basePaper.widthMm, basePaper.heightMm);

  const effectivePaperHeightMm = isLandscape
    ? Math.min(basePaper.widthMm, basePaper.heightMm)
    : Math.max(basePaper.widthMm, basePaper.heightMm);

  const paperAspectRatio = effectivePaperWidthMm / effectivePaperHeightMm;

  // Active adjustment for current page
  const pageAdjustment = useMemo(() => {
    if (!currentPageTask) return null;
    return currentPageTask.item.pageAdjustments?.[currentPageTask.pageNum] || null;
  }, [currentPageTask]);

  // CSS Filters corresponding to colorMode & page adjustments
  const previewFilter = useMemo(() => {
    const filters: string[] = [];

    // Hardware Color Mode
    if (settings.colorMode === 'bw') {
      filters.push('contrast(220%) grayscale(100%)');
    } else if (settings.colorMode === 'grayscale') {
      filters.push('grayscale(100%)');
    }

    // Page Studio Adjustments
    if (pageAdjustment) {
      if (pageAdjustment.brightness && pageAdjustment.brightness !== 100) {
        filters.push(`brightness(${pageAdjustment.brightness}%)`);
      }
      if (pageAdjustment.contrast && pageAdjustment.contrast !== 100) {
        filters.push(`contrast(${pageAdjustment.contrast}%)`);
      }
      if (pageAdjustment.invert) {
        filters.push('invert(100%)');
      }
    }

    return filters.length > 0 ? filters.join(' ') : 'none';
  }, [settings.colorMode, pageAdjustment]);

  // Image rotation
  const totalRotation = useMemo(() => {
    if (!currentPageTask) return 0;
    const baseRot = currentPageTask.item.rotation || 0;
    const adjRot = pageAdjustment?.rotation || 0;
    const fineRot = pageAdjustment?.fineAngle || 0;
    return (baseRot + adjRot + fineRot) % 360;
  }, [currentPageTask, pageAdjustment]);

  // CSS Image scaling style inside the paper container
  const scalingStyle = useMemo(() => {
    if (settings.scaling === 'shrink') {
      return 'max-w-full max-h-full object-scale-down';
    }
    if (settings.scaling === 'actual') {
      return 'w-auto h-auto object-none';
    }
    // Default 'fit'
    return 'max-w-full max-h-full object-contain';
  }, [settings.scaling]);

  // N-Up Grid Imposition Info
  const isGridEnabled = Boolean(settings.gridLayout?.enabled);
  const gridRows = settings.gridLayout?.rows || 4;
  const gridCols = settings.gridLayout?.cols || 3;
  const totalCells = gridRows * gridCols;

  const cellOrderIndices = useMemo(() => {
    if (!isGridEnabled) return [];
    return calculateGridCellOrder(gridRows, gridCols, settings.gridLayout?.order || 'rtl-rows');
  }, [isGridEnabled, gridRows, gridCols, settings.gridLayout?.order]);

  return (
    <div className="flex flex-col h-full select-none">
      {/* Top Toolbar: Navigation & Zoom */}
      <div
        className={`px-4 py-2.5 border-b flex items-center justify-between gap-2 text-xs transition-colors shrink-0 ${
          isDark ? 'bg-neutral-950/80 border-neutral-800' : 'bg-slate-100/80 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-1.5 font-bold">
          <Eye className="w-4 h-4 text-blue-500" />
          <span>پیش‌نمایش زنده برگه چاپ (Print Preview)</span>
        </div>

        {/* Page Switcher */}
        {activePrintablePages.length > 1 && (
          <div className="flex items-center gap-1 bg-black/10 dark:bg-neutral-900 px-2 py-1 rounded-lg border border-neutral-700/40">
            <button
              type="button"
              disabled={currentSheetIndex <= 0}
              onClick={() => setCurrentSheetIndex((prev) => Math.max(0, prev - 1))}
              className="p-0.5 rounded hover:bg-neutral-700/50 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="صفحه قبلی"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <span className="font-mono text-[11px] px-1 font-semibold">
              {currentSheetIndex + 1} / {activePrintablePages.length}
            </span>

            <button
              type="button"
              disabled={currentSheetIndex >= activePrintablePages.length - 1}
              onClick={() =>
                setCurrentSheetIndex((prev) =>
                  Math.min(activePrintablePages.length - 1, prev + 1)
                )
              }
              className="p-0.5 rounded hover:bg-neutral-700/50 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="صفحه بعدی"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Zoom & Margin Guideline toggles */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.1))}
            className={`p-1.5 rounded-lg border transition-colors ${
              isDark
                ? 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-neutral-300'
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
            title="کوچک‌نمایی (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="font-mono text-[11px] w-9 text-center font-semibold text-neutral-400">
            {Math.round(zoomLevel * 100)}%
          </span>

          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(1.5, z + 0.1))}
            className={`p-1.5 rounded-lg border transition-colors ${
              isDark
                ? 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-neutral-300'
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
            title="بزرگ‌نمایی (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowMarginGuides((v) => !v)}
            className={`ms-1.5 px-2 py-1 rounded-lg border text-[11px] flex items-center gap-1 transition-colors ${
              showMarginGuides
                ? 'bg-blue-600/15 border-blue-500/40 text-blue-500 font-medium'
                : isDark
                ? 'bg-neutral-900 border-neutral-800 text-neutral-400'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
            title="نمایش یا عدم نمایش خطوط راهنمای حاشیه چاپ"
          >
            <span>حاشیه‌ها</span>
          </button>
        </div>
      </div>

      {/* Main Canvas / Paper Sheet Viewport */}
      <div
        className={`relative flex-1 p-4 sm:p-6 overflow-auto flex items-center justify-center min-h-[340px] max-h-[480px] transition-colors ${
          isDark ? 'bg-neutral-950/60' : 'bg-slate-100/70'
        }`}
      >
        {activePrintablePages.length === 0 ? (
          <div className="text-center text-neutral-400 py-12 space-y-2">
            <Layers className="w-10 h-10 mx-auto text-neutral-500 opacity-60" />
            <p className="text-xs">هیچ صفحه‌ای برای پیش‌نمایش یا چاپ انتخاب نشده است.</p>
          </div>
        ) : (
          <div
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease-out',
            }}
            className="flex items-center justify-center p-2"
          >
            {/* The Physical Paper Sheet */}
            <div
              style={{
                width: isLandscape ? '460px' : '330px',
                aspectRatio: `${effectivePaperWidthMm} / ${effectivePaperHeightMm}`,
              }}
              className="relative bg-white text-slate-900 rounded-xs shadow-[0_12px_45px_rgba(0,0,0,0.35)] border border-slate-300 dark:border-neutral-600 flex flex-col items-center justify-center overflow-hidden transition-all duration-200"
            >
              {/* Paper Printable Safe Area / Margins Guide */}
              {showMarginGuides && (
                <div className="absolute inset-3 sm:inset-4 border border-dashed border-blue-400/50 pointer-events-none z-20 flex flex-col justify-between">
                  <div className="flex justify-between p-0.5 text-[8px] font-mono text-blue-400/80">
                    <span>{effectivePaperWidthMm}mm</span>
                    <span>حاشیه امن چاپ</span>
                  </div>
                  <div className="flex justify-between p-0.5 text-[8px] font-mono text-blue-400/80">
                    <span>{isLandscape ? 'Landscape (افقی)' : 'Portrait (عمودی)'}</span>
                    <span>{effectivePaperHeightMm}mm</span>
                  </div>
                </div>
              )}

              {/* Sheet Corner Cut Marks */}
              {showMarginGuides && (
                <>
                  <div className="absolute top-1 left-1 w-2.5 h-2.5 border-t border-l border-slate-400 pointer-events-none" />
                  <div className="absolute top-1 right-1 w-2.5 h-2.5 border-t border-r border-slate-400 pointer-events-none" />
                  <div className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b border-l border-slate-400 pointer-events-none" />
                  <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b border-r border-slate-400 pointer-events-none" />
                </>
              )}

              {/* Mode A: N-Up Grid Imposition View */}
              {isGridEnabled ? (
                <div className="w-full h-full p-4 relative z-10 flex flex-col justify-center">
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
                      gap: `${settings.gridLayout?.horizontalGapMm || 2}px`,
                      width: '100%',
                      height: '100%',
                    }}
                    className="border border-purple-400/60 rounded-xs bg-purple-50/20"
                  >
                    {Array.from({ length: totalCells }).map((_, cIdx) => {
                      const orderNum = cellOrderIndices[cIdx] + 1;
                      return (
                        <div
                          key={cIdx}
                          className="border border-dashed border-purple-300 dark:border-purple-400/40 relative flex items-center justify-center p-1 bg-white/70 overflow-hidden"
                        >
                          {renderedData ? (
                            <img
                              src={renderedData.dataUrl}
                              alt="Cell Preview"
                              style={{
                                filter: previewFilter,
                                transform: totalRotation ? `rotate(${totalRotation}deg)` : undefined,
                              }}
                              className="max-w-full max-h-full object-contain pointer-events-none"
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-100 rounded-xs flex items-center justify-center text-[9px] text-slate-400 font-mono">
                              #{orderNum}
                            </div>
                          )}

                          {/* Cell Order Badge */}
                          <span className="absolute top-0.5 right-0.5 bg-purple-600 text-white font-mono text-[8px] px-1 rounded-xs font-bold shadow-xs">
                            {orderNum}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Mode B: Standard Single Document Page View */
                <div className="w-full h-full relative z-10 p-3 flex items-center justify-center overflow-hidden">
                  {isLoadingPage ? (
                    <div className="flex flex-col items-center gap-2 text-slate-400 py-6">
                      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] font-mono">در حال آماده‌سازی تصویر برگه...</span>
                    </div>
                  ) : renderedData ? (
                    <img
                      src={renderedData.dataUrl}
                      alt={currentPageTask?.item.name || 'Page Preview'}
                      style={{
                        filter: previewFilter,
                        transform: totalRotation ? `rotate(${totalRotation}deg)` : undefined,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      }}
                      className={`${scalingStyle} pointer-events-none transition-all duration-150`}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-slate-400">
                      <FileText className="w-8 h-8 stroke-[1.5]" />
                      <span className="text-[11px]">پیش‌نمایش این صفحه بارگذاری نشد</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Badge: Active Paper & Print Specs */}
      <div
        className={`px-4 py-2 border-t flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono transition-colors shrink-0 ${
          isDark ? 'bg-neutral-950/90 border-neutral-800 text-neutral-300' : 'bg-slate-100 border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <span className="font-bold text-blue-500">
            {basePaper.nameFa}
          </span>
          <span className="text-neutral-400">·</span>
          <span>
            {isLandscape ? 'افقی (Landscape)' : 'عمودی (Portrait)'}
          </span>
          <span className="text-neutral-400">·</span>
          <span className="text-emerald-500 font-semibold">
            {settings.colorMode === 'bw'
              ? 'سیاه و سفید پرینتری'
              : settings.colorMode === 'grayscale'
              ? 'خاکستری'
              : 'تمام رنگی'}
          </span>
          <span className="text-neutral-400">·</span>
          <span className="text-purple-400">
            مقیاس: {settings.scaling === 'fit' ? 'تناسب برگه' : settings.scaling === 'shrink' ? 'کاهش در صورت لزوم' : 'اندازه واقعی'}
          </span>
        </div>

        {currentPageTask && (
          <div className="flex items-center gap-1 text-[11px] text-neutral-400 truncate">
            <span className="truncate max-w-[130px] font-sans" title={currentPageTask.item.name}>
              {currentPageTask.item.name}
            </span>
            <span>(صفحه {currentPageTask.pageNum} از {currentPageTask.item.pageCount})</span>
          </div>
        )}
      </div>
    </div>
  );
};
