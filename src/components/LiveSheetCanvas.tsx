import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Layers,
  Scissors,
  Grid,
  RotateCw,
  Eye,
  Sliders,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import {
  PDFItem,
  PrintSettings,
  PaperSize,
  Language,
  PageAdjustment,
  GridLayoutSettings,
} from '../types';
import { renderPdfPageToDataUrl } from '../utils/pdfRenderUtils';
import { calculateGridCellOrder } from '../utils/gridImpositionUtils';
import { PAPER_DIMENSIONS_MM } from './PrintPreviewSheet';

interface LiveSheetCanvasProps {
  items: PDFItem[];
  settings: PrintSettings;
  lang: Language;
  theme: 'dark' | 'light';
  activePageGlobalIndex: number;
  onSelectGlobalPage: (index: number) => void;
  zoomLevel: number;
  showRulers: boolean;
  showMargins: boolean;
  onOpenPageStudioForCurrent: (item: PDFItem) => void;
  onFilesSelected: (files: File[]) => void;
  onImagesSelected: (files: File[]) => void;
  onLoadSamples: () => void;
}

export const LiveSheetCanvas: React.FC<LiveSheetCanvasProps> = ({
  items,
  settings,
  lang,
  theme,
  activePageGlobalIndex,
  onSelectGlobalPage,
  zoomLevel,
  showRulers,
  showMargins,
  onOpenPageStudioForCurrent,
  onFilesSelected,
  onImagesSelected,
  onLoadSamples,
}) => {
  const isDark = theme === 'dark';
  const isFa = lang === 'fa';

  const [currentSheetIndex, setCurrentSheetIndex] = useState<number>(0);
  const [renderedPagesCache, setRenderedPagesCache] = useState<Record<string, string>>({});
  const [isLoadingActivePage, setIsLoadingActivePage] = useState<boolean>(false);

  // Collect all selected printable pages
  const printablePages = useMemo(() => {
    const list: {
      globalIndex: number;
      item: PDFItem;
      pageNum: number;
      adjustment?: PageAdjustment;
    }[] = [];

    let count = 0;
    for (const item of items) {
      if (!item.selected) continue;
      const pCount = item.pageCount || 1;
      for (let p = 1; p <= pCount; p++) {
        const adj = item.pageAdjustments?.[p];
        if (!adj || adj.selectedForPrint) {
          list.push({
            globalIndex: count++,
            item,
            pageNum: p,
            adjustment: adj,
          });
        }
      }
    }
    return list;
  }, [items]);

  // Imposition N-Up calculations
  const isGridEnabled = Boolean(settings.gridLayout?.enabled);
  const gridRows = isGridEnabled ? settings.gridLayout?.rows || 1 : 1;
  const gridCols = isGridEnabled ? settings.gridLayout?.cols || 1 : 1;
  const cellsPerSheet = gridRows * gridCols;

  // Calculate total physical sheets
  const totalSheets = useMemo(() => {
    if (printablePages.length === 0) return 0;
    if (settings.gridLayout?.repeatPage) {
      return printablePages.length; // Each sheet repeats one page
    }
    return Math.ceil(printablePages.length / cellsPerSheet);
  }, [printablePages.length, cellsPerSheet, settings.gridLayout?.repeatPage]);

  // Keep sheet index within bounds
  useEffect(() => {
    if (totalSheets === 0) {
      setCurrentSheetIndex(0);
    } else if (currentSheetIndex >= totalSheets) {
      setCurrentSheetIndex(Math.max(0, totalSheets - 1));
    }
  }, [totalSheets, currentSheetIndex]);

  // Calculate pages assigned to the current sheet
  const currentSheetPages = useMemo(() => {
    if (printablePages.length === 0) return [];

    if (settings.gridLayout?.repeatPage) {
      // Repeat current selected page across all cells of the sheet
      const target = printablePages[currentSheetIndex] || printablePages[0];
      return Array(cellsPerSheet).fill(target);
    }

    const startIdx = currentSheetIndex * cellsPerSheet;
    const endIdx = startIdx + cellsPerSheet;
    const pagesForThisSheet = printablePages.slice(startIdx, endIdx);

    // Fill remaining empty cells with null
    const result: (typeof printablePages[0] | null)[] = [...pagesForThisSheet];
    while (result.length < cellsPerSheet) {
      result.push(null);
    }
    return result;
  }, [printablePages, currentSheetIndex, cellsPerSheet, settings.gridLayout?.repeatPage]);

  // Cell order flow (RTL rows, LTR rows, etc.)
  const cellOrderIndices = useMemo(() => {
    if (!isGridEnabled) return [0];
    return calculateGridCellOrder(gridRows, gridCols, settings.gridLayout?.order || 'rtl-rows');
  }, [isGridEnabled, gridRows, gridCols, settings.gridLayout?.order]);

  // Render high-res preview for pages on the current active sheet
  useEffect(() => {
    let isCancelled = false;
    const pagesToRender = currentSheetPages.filter(Boolean) as typeof printablePages;

    if (pagesToRender.length === 0) return;

    setIsLoadingActivePage(true);
    const renderPromises = pagesToRender.map(async (pageTask) => {
      const key = `${pageTask.item.id}_${pageTask.pageNum}`;
      if (renderedPagesCache[key]) return;

      try {
        const res = await renderPdfPageToDataUrl(pageTask.item.file, pageTask.pageNum, 1.2);
        if (!isCancelled) {
          setRenderedPagesCache((prev) => ({ ...prev, [key]: res.dataUrl }));
        }
      } catch (err) {
        console.warn('Live preview render notice:', err);
      }
    });

    Promise.all(renderPromises).finally(() => {
      if (!isCancelled) setIsLoadingActivePage(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [currentSheetPages, renderedPagesCache]);

  // Paper geometry in mm
  const basePaper = PAPER_DIMENSIONS_MM[settings.paperSize] || PAPER_DIMENSIONS_MM.A4;
  const isLandscape = settings.orientation === 'landscape';

  const effectiveWidthMm = isLandscape
    ? Math.max(basePaper.widthMm, basePaper.heightMm)
    : Math.min(basePaper.widthMm, basePaper.heightMm);

  const effectiveHeightMm = isLandscape
    ? Math.min(basePaper.widthMm, basePaper.heightMm)
    : Math.max(basePaper.widthMm, basePaper.heightMm);

  // Drag and drop handler when canvas is empty
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const pdfs = files.filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    const imgs = files.filter(
      (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|tiff?|svg)$/i.test(f.name)
    );

    if (pdfs.length > 0) onFilesSelected(pdfs);
    if (imgs.length > 0) onImagesSelected(imgs);
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`relative flex-1 flex flex-col h-full overflow-hidden select-none transition-colors ${
        isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-slate-200/70 text-slate-900'
      }`}
    >
      {/* Top Ruler */}
      {showRulers && items.length > 0 && (
        <div className="h-5 border-b border-neutral-300 dark:border-neutral-800 bg-black/5 dark:bg-neutral-900/60 flex items-center px-6 text-[9px] font-mono text-neutral-400 overflow-hidden shrink-0">
          <div className="flex justify-between w-full">
            {Array.from({ length: 11 }).map((_, i) => (
              <span key={i} className="flex flex-col items-center">
                <span>{Math.round((i * effectiveWidthMm) / 10)}mm</span>
                <span className="h-1 w-px bg-neutral-400/50" />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sheet Viewport Area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-8">
        {items.length === 0 ? (
          /* Empty Workspace State / Drag & Drop Hub */
          <div
            className={`max-w-md w-full p-8 rounded-2xl border-2 border-dashed text-center flex flex-col items-center gap-4 transition-all ${
              isDark
                ? 'border-neutral-700 bg-neutral-900/50 text-neutral-300'
                : 'border-slate-300 bg-white/80 text-slate-700 shadow-sm'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500">
              <UploadCloud className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-bold">
                {isFa ? 'اسناد PDF خود را به اینجا بکشید' : 'Drag & Drop PDF Documents Here'}
              </h2>
              <p className="text-xs text-neutral-400">
                {isFa
                  ? 'پشتیبانی از شمارش خودکار، مونتاژ شیت‌بندی، فیلترهای نوری و چاپ مستقیم'
                  : 'Fast offline page counting, sheet imposition, image filters, and direct printing'}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <label className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs">
                <span>{isFa ? 'انتخاب فایل از رایانه' : 'Browse Files'}</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={(e) => {
                    if (e.target.files) {
                      const files = Array.from(e.target.files);
                      onFilesSelected(files);
                    }
                  }}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={onLoadSamples}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isDark
                    ? 'border-neutral-700 hover:bg-neutral-800 text-neutral-300'
                    : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isFa ? 'فایل‌های تستی' : 'Sample Files'}</span>
              </button>
            </div>
          </div>
        ) : printablePages.length === 0 ? (
          <div className="text-center text-neutral-400 space-y-2">
            <Layers className="w-10 h-10 mx-auto opacity-50" />
            <p className="text-xs">
              {isFa
                ? 'هیچ صفحه‌ای برای چاپ فعال نیست. از پنل صفحات تیک صفحات را بزنید.'
                : 'No pages selected for print. Check pages in the sidebar.'}
            </p>
          </div>
        ) : (
          /* Live Scaled WYSIWYG Print Sheet */
          <div
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: 'transform 0.12s ease-out',
            }}
            className="flex items-center justify-center p-2"
          >
            {/* The Physical Paper Sheet */}
            <div
              style={{
                width: isLandscape ? '640px' : '460px',
                aspectRatio: `${effectiveWidthMm} / ${effectiveHeightMm}`,
              }}
              className="relative bg-white text-slate-900 rounded-xs shadow-[0_16px_50px_rgba(0,0,0,0.35)] border border-slate-300 dark:border-neutral-700 flex flex-col items-center justify-center overflow-hidden transition-all duration-150"
            >
              {/* Guillotine Cutting Marks (Cropping Crosses) */}
              {Boolean(settings.gridLayout?.showCutMarks) && (
                <>
                  <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-slate-700 pointer-events-none z-30" />
                  <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-slate-700 pointer-events-none z-30" />
                  <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-slate-700 pointer-events-none z-30" />
                  <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-slate-700 pointer-events-none z-30" />
                </>
              )}

              {/* Gutter Guide (Booklet spine binding margin) */}
              {Boolean(settings.gutterMm && settings.gutterMm > 0) && (
                <div
                  style={{ width: `${(settings.gutterMm || 0) * 2}px` }}
                  className="absolute inset-y-0 start-1/2 -translate-x-1/2 bg-amber-400/15 border-x border-dashed border-amber-500/60 pointer-events-none z-25 flex items-center justify-center"
                >
                  <span className="text-[8px] font-mono text-amber-600 rotate-90 whitespace-nowrap">
                    Gutter {settings.gutterMm}mm
                  </span>
                </div>
              )}

              {/* Margins Boundary Guide */}
              {showMargins && (
                <div className="absolute inset-4 sm:inset-5 border border-dashed border-blue-400/60 pointer-events-none z-20 flex flex-col justify-between">
                  <div className="flex justify-between p-1 text-[8px] font-mono text-blue-500/80">
                    <span>{effectiveWidthMm}mm</span>
                    <span>{isFa ? 'حاشیه امن چاپ' : 'Print Safe Area'}</span>
                  </div>
                  <div className="flex justify-between p-1 text-[8px] font-mono text-blue-500/80">
                    <span>{isLandscape ? 'Landscape (افقی)' : 'Portrait (عمودی)'}</span>
                    <span>{effectiveHeightMm}mm</span>
                  </div>
                </div>
              )}

              {/* N-Up Imposition Grid Layout */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
                  gap: isGridEnabled ? `${settings.gridLayout?.horizontalGapMm || 3}px` : '0px',
                  padding: isGridEnabled ? '12px' : '8px',
                  width: '100%',
                  height: '100%',
                }}
                className="w-full h-full relative z-10"
              >
                {Array.from({ length: cellsPerSheet }).map((_, cellIdx) => {
                  const targetOrderIndex = cellOrderIndices[cellIdx] || 0;
                  const pageTask = currentSheetPages[targetOrderIndex];
                  const hasPage = Boolean(pageTask);

                  const previewImg = hasPage
                    ? renderedPagesCache[`${pageTask!.item.id}_${pageTask!.pageNum}`]
                    : null;

                  const adj = pageTask?.adjustment;

                  // CSS filter calculations
                  const filterParts: string[] = [];
                  if (settings.colorMode === 'bw' || adj?.threshold) {
                    filterParts.push('contrast(220%) grayscale(100%)');
                  } else if (settings.colorMode === 'grayscale' || adj?.grayscale) {
                    filterParts.push('grayscale(100%)');
                  }
                  if (adj?.brightness && adj.brightness !== 100) {
                    filterParts.push(`brightness(${adj.brightness}%)`);
                  }
                  if (adj?.contrast && adj.contrast !== 100) {
                    filterParts.push(`contrast(${adj.contrast}%)`);
                  }
                  if (adj?.invert) {
                    filterParts.push('invert(100%)');
                  }

                  const filterString = filterParts.length > 0 ? filterParts.join(' ') : 'none';
                  const totalRot =
                    ((pageTask?.item.rotation || 0) + (adj?.rotation || 0) + (adj?.fineAngle || 0)) %
                    360;

                  return (
                    <div
                      key={cellIdx}
                      onClick={() => {
                        if (pageTask) {
                          onSelectGlobalPage(pageTask.globalIndex);
                        }
                      }}
                      className={`relative rounded-xs overflow-hidden flex items-center justify-center p-1 transition-all group ${
                        isGridEnabled
                          ? 'border border-dashed border-neutral-300 dark:border-neutral-400/30 hover:border-blue-500 bg-white'
                          : 'bg-white'
                      }`}
                    >
                      {previewImg ? (
                        <img
                          src={previewImg}
                          alt="Sheet cell preview"
                          style={{
                            filter: filterString,
                            transform: totalRot ? `rotate(${totalRot}deg)` : undefined,
                          }}
                          className="max-w-full max-h-full object-contain pointer-events-none"
                        />
                      ) : hasPage ? (
                        <div className="flex flex-col items-center gap-1 text-slate-400">
                          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-[9px] font-mono">#{pageTask!.pageNum}</span>
                        </div>
                      ) : (
                        <div className="w-full h-full bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-300 font-mono">
                          {isFa ? 'خالی' : 'Empty'}
                        </div>
                      )}

                      {/* Cell Order / Page Badge */}
                      {hasPage && (
                        <div className="absolute top-1 start-1 bg-black/60 text-white font-mono text-[8px] px-1 rounded-xs font-semibold backdrop-blur-xs">
                          {pageTask!.pageNum}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sheet Navigation Strip */}
      {totalSheets > 1 && (
        <div
          className={`h-9 border-t flex items-center justify-between px-4 text-xs shrink-0 select-none ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-400">
              {isFa ? 'ورق‌زدن شیت‌های چاپ:' : 'Sheet Navigation:'}
            </span>
            <div className="flex items-center gap-1 font-mono font-bold">
              <button
                type="button"
                disabled={currentSheetIndex <= 0}
                onClick={() => setCurrentSheetIndex((prev) => Math.max(0, prev - 1))}
                className="p-1 rounded hover:bg-neutral-700/40 disabled:opacity-30 cursor-pointer"
                title={isFa ? 'شیت قبلی' : 'Previous Sheet'}
              >
                {isFa ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>

              <span className="px-2 py-0.5 rounded bg-black/10 dark:bg-neutral-800">
                {currentSheetIndex + 1} / {totalSheets}
              </span>

              <button
                type="button"
                disabled={currentSheetIndex >= totalSheets - 1}
                onClick={() => setCurrentSheetIndex((prev) => Math.min(totalSheets - 1, prev + 1))}
                className="p-1 rounded hover:bg-neutral-700/40 disabled:opacity-30 cursor-pointer"
                title={isFa ? 'شیت بعدی' : 'Next Sheet'}
              >
                {isFa ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="text-[11px] text-neutral-400 font-mono hidden sm:block">
            {effectiveWidthMm} × {effectiveHeightMm} mm · {settings.paperSize} · {cellsPerSheet}-Up
          </div>
        </div>
      )}
    </div>
  );
};
