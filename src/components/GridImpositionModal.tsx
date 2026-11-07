import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Grid,
  Printer,
  Download,
  Layers,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sliders,
  Scissors,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ArrowDown,
  LayoutGrid,
  Maximize2,
  Move,
  ZoomIn,
  Eye,
  RotateCw,
  Crosshair,
  Sun,
  Crop,
  Square,
  EyeOff,
  Palette,
} from 'lucide-react';
import { translations } from '../utils/translations';
import { Language, PDFItem, GridLayoutSettings, PaperSize, CustomCellOverride } from '../types';
import { GridMatrixPicker } from './GridMatrixPicker';
import {
  GridCellData,
  buildImposedSheets,
  renderImposedSheetCanvas,
  ImposedSheet,
} from '../utils/gridImpositionUtils';
import { renderPdfPageToDataUrl } from '../utils/pdfRenderUtils';
import { processPageForPrint } from '../utils/printUtils';
import { savePdfFile } from '../utils/fileSystem';
import { PDFDocument } from 'pdf-lib';

interface GridImpositionModalProps {
  items: PDFItem[];
  lang: Language;
  theme: 'dark' | 'light';
  onClose: () => void;
  onPrintWithGrid?: (gridSettings: GridLayoutSettings) => void;
}

export const GridImpositionModal: React.FC<GridImpositionModalProps> = ({
  items,
  lang,
  theme,
  onClose,
  onPrintWithGrid,
}) => {
  const t = translations[lang];
  const isDark = theme === 'dark';

  // Target paper dimensions
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const paperWidthMm = orientation === 'portrait' ? 210 : 297;
  const paperHeightMm = orientation === 'portrait' ? 297 : 210;

  // Grid layout settings with 4-sided margins
  const [gridSettings, setGridSettings] = useState<GridLayoutSettings>({
    enabled: true,
    rows: 4,
    cols: 3, // e.g. 3 x 4
    repeatPage: false,
    order: 'rtl-rows', // [2 1 / 4 3]
    horizontalGapMm: 3,
    verticalGapMm: 3,
    marginTopMm: 8,
    marginBottomMm: 8,
    marginLeftMm: 8,
    marginRightMm: 8,
    cellScalePercent: 100,
    offsetXPercent: 0,
    offsetYPercent: 0,
    showCutMarks: true,
    showMarginGuides: true,
  });

  // Selected cell index for individual resizing/repositioning/adjusting
  const [selectedCellIdx, setSelectedCellIdx] = useState<number | null>(0);
  const [cellControlTab, setCellControlTab] = useState<
    'transform' | 'crop' | 'color' | 'rotation' | 'border'
  >('transform');

  // Helper to update individual cell override
  const updateCellOverride = (cellIdx: number, updates: Partial<CustomCellOverride>) => {
    setGridSettings((prev) => {
      const currentOverrides = prev.customCellOverrides || {};
      const existing = currentOverrides[cellIdx] || {
        offsetXPercent: prev.offsetXPercent,
        offsetYPercent: prev.offsetYPercent,
        scalePercent: prev.cellScalePercent,
        rotation: 0,
        fineAngle: 0,
        brightness: 100,
        contrast: 100,
        grayscale: false,
        threshold: false,
        invert: false,
        crop: { top: 0, bottom: 0, left: 0, right: 0 },
        border: false,
        hidden: false,
      };
      return {
        ...prev,
        customCellOverrides: {
          ...currentOverrides,
          [cellIdx]: {
            ...existing,
            ...updates,
          },
        },
      };
    });
  };

  const resetCellOverride = (cellIdx: number) => {
    setGridSettings((prev) => {
      if (!prev.customCellOverrides) return prev;
      const nextOverrides = { ...prev.customCellOverrides };
      delete nextOverrides[cellIdx];
      return {
        ...prev,
        customCellOverrides: nextOverrides,
      };
    });
  };

  const applyCellOverrideToAll = (cellIdx: number) => {
    const currentOverrides = gridSettings.customCellOverrides || {};
    const source = currentOverrides[cellIdx] || {
      offsetXPercent: gridSettings.offsetXPercent,
      offsetYPercent: gridSettings.offsetYPercent,
      scalePercent: gridSettings.cellScalePercent,
      rotation: 0,
      fineAngle: 0,
      brightness: 100,
      contrast: 100,
      grayscale: false,
      threshold: false,
      invert: false,
      crop: { top: 0, bottom: 0, left: 0, right: 0 },
      border: false,
      hidden: false,
    };
    const totalCells = gridSettings.rows * gridSettings.cols;
    const newOverrides: Record<number, CustomCellOverride> = {};
    for (let i = 0; i < totalCells; i++) {
      newOverrides[i] = JSON.parse(JSON.stringify(source));
    }
    setGridSettings((prev) => ({
      ...prev,
      customCellOverrides: newOverrides,
    }));
  };

  const resetAllCellOverrides = () => {
    setGridSettings((prev) => ({
      ...prev,
      customCellOverrides: {},
    }));
  };

  // Current preview sheet index (0-based)
  const [currentSheetIdx, setCurrentSheetIdx] = useState(0);

  // Cached prepared pages
  const [preparedPages, setPreparedPages] = useState<GridCellData[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(true);

  // Rendered sheet canvas preview
  const [sheetPreviewUrl, setSheetPreviewUrl] = useState<string | null>(null);
  const [isRenderingSheet, setIsRenderingSheet] = useState(false);

  // Interactive on-sheet drag state
  const sheetContainerRef = useRef<HTMLDivElement>(null);
  const [activeDrag, setActiveDrag] = useState<
    'topMargin' | 'bottomMargin' | 'leftMargin' | 'rightMargin' | 'panCell' | null
  >(null);

  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialSettings: GridLayoutSettings;
    rectWidth: number;
    rectHeight: number;
  }>({
    startX: 0,
    startY: 0,
    initialSettings: { ...gridSettings },
    rectWidth: 1,
    rectHeight: 1,
  });

  // Prepare input pages (applying any adjustments from page studio)
  useEffect(() => {
    let isCancelled = false;

    async function loadPages() {
      setIsLoadingPages(true);
      const results: GridCellData[] = [];

      for (const item of items) {
        if (!item.selected && items.length > 1) continue;
        const totalP = item.pageCount || 1;

        for (let p = 1; p <= totalP; p++) {
          if (isCancelled) break;
          const adj = item.pageAdjustments?.[p];
          if (adj && !adj.selectedForPrint) continue;

          try {
            const raw = await renderPdfPageToDataUrl(item.file, p, 0.7);
            const processedUrl = adj
              ? await processPageForPrint(raw.dataUrl, raw.width, raw.height, adj)
              : raw.dataUrl;

            results.push({
              pageNumber: p,
              dataUrl: processedUrl,
              sourceFileName: item.name,
            });
          } catch (err) {
            console.warn(`Error loading page ${p} of ${item.name}:`, err);
          }
        }
      }

      if (!isCancelled) {
        setPreparedPages(results);
        setIsLoadingPages(false);
      }
    }

    loadPages();
    return () => {
      isCancelled = true;
    };
  }, [items]);

  // Build sheets whenever settings or pages change
  const sheets: ImposedSheet[] = buildImposedSheets(preparedPages, gridSettings);
  const totalSheets = Math.max(1, sheets.length);

  // Render the current sheet preview
  useEffect(() => {
    let isCancelled = false;

    async function updateSheetPreview() {
      if (sheets.length === 0) return;
      const targetSheet = sheets[Math.min(currentSheetIdx, sheets.length - 1)];
      if (!targetSheet) return;

      setIsRenderingSheet(true);
      try {
        const url = await renderImposedSheetCanvas(
          targetSheet,
          gridSettings,
          paperWidthMm,
          paperHeightMm,
          1.5
        );
        if (!isCancelled) {
          setSheetPreviewUrl(url);
        }
      } catch (err) {
        console.error('Error rendering sheet preview:', err);
      } finally {
        if (!isCancelled) {
          setIsRenderingSheet(false);
        }
      }
    }

    updateSheetPreview();
    return () => {
      isCancelled = true;
    };
  }, [
    sheets,
    currentSheetIdx,
    gridSettings,
    paperWidthMm,
    paperHeightMm,
  ]);

  // Pages Sidebar state
  const [showPagesSidebar, setShowPagesSidebar] = useState(true);

  // Direct On-Image Interactive Cell Manipulation state
  const [activeCellDragHandle, setActiveCellDragHandle] = useState<
    'move' | 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br' | 'crop-t' | 'crop-b' | 'crop-l' | 'crop-r' | null
  >(null);

  const cellDragDataRef = useRef<{
    startX: number;
    startY: number;
    cellIdx: number;
    initialOverride: CustomCellOverride;
    cellWidthPx: number;
    cellHeightPx: number;
  }>({
    startX: 0,
    startY: 0,
    cellIdx: 0,
    initialOverride: {},
    cellWidthPx: 1,
    cellHeightPx: 1,
  });

  const handleCellPointerDown = (
    cellIdx: number,
    handle: 'move' | 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br' | 'crop-t' | 'crop-b' | 'crop-l' | 'crop-r',
    e: React.PointerEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    const cellElem = target.closest('.grid-cell-container') as HTMLElement;
    const rect = cellElem ? cellElem.getBoundingClientRect() : target.getBoundingClientRect();

    const currentOverride = gridSettings.customCellOverrides?.[cellIdx] || {
      offsetXPercent: gridSettings.offsetXPercent,
      offsetYPercent: gridSettings.offsetYPercent,
      scalePercent: gridSettings.cellScalePercent,
      rotation: 0,
      fineAngle: 0,
      brightness: 100,
      contrast: 100,
      crop: { top: 0, bottom: 0, left: 0, right: 0 },
    };

    cellDragDataRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      cellIdx,
      initialOverride: JSON.parse(JSON.stringify(currentOverride)),
      cellWidthPx: rect.width || 1,
      cellHeightPx: rect.height || 1,
    };

    setActiveCellDragHandle(handle);
  };

  useEffect(() => {
    if (!activeCellDragHandle) return;

    const handlePointerMove = (e: PointerEvent) => {
      const { startX, startY, cellIdx, initialOverride, cellWidthPx, cellHeightPx } =
        cellDragDataRef.current;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      if (activeCellDragHandle === 'move') {
        const pctX = (deltaX / cellWidthPx) * 100;
        const pctY = (deltaY / cellHeightPx) * 100;

        const nextOffX = Math.max(
          -100,
          Math.min(100, Math.round(((initialOverride.offsetXPercent ?? gridSettings.offsetXPercent) + pctX) * 2) / 2)
        );
        const nextOffY = Math.max(
          -100,
          Math.min(100, Math.round(((initialOverride.offsetYPercent ?? gridSettings.offsetYPercent) + pctY) * 2) / 2)
        );

        updateCellOverride(cellIdx, { offsetXPercent: nextOffX, offsetYPercent: nextOffY });
        return;
      }

      // Handle corner and edge resizing
      let scaleFactor = 0;
      switch (activeCellDragHandle) {
        case 'br':
          scaleFactor = (deltaX / cellWidthPx + deltaY / cellHeightPx) * 100;
          break;
        case 'tl':
          scaleFactor = (-deltaX / cellWidthPx - deltaY / cellHeightPx) * 100;
          break;
        case 'tr':
          scaleFactor = (deltaX / cellWidthPx - deltaY / cellHeightPx) * 100;
          break;
        case 'bl':
          scaleFactor = (-deltaX / cellWidthPx + deltaY / cellHeightPx) * 100;
          break;
        case 'mr':
        case 'ml':
          scaleFactor = (Math.abs(deltaX) / cellWidthPx) * 150 * (deltaX > 0 ? 1 : -1);
          break;
        case 'bc':
        case 'tc':
          scaleFactor = (Math.abs(deltaY) / cellHeightPx) * 150 * (deltaY > 0 ? 1 : -1);
          break;
        case 'crop-t': {
          const pct = Math.max(0, Math.min(80, Math.round(((initialOverride.crop?.top || 0) + (deltaY / cellHeightPx) * 100))));
          updateCellOverride(cellIdx, { crop: { ...(initialOverride.crop || { top: 0, bottom: 0, left: 0, right: 0 }), top: pct } });
          return;
        }
        case 'crop-b': {
          const pct = Math.max(0, Math.min(80, Math.round(((initialOverride.crop?.bottom || 0) - (deltaY / cellHeightPx) * 100))));
          updateCellOverride(cellIdx, { crop: { ...(initialOverride.crop || { top: 0, bottom: 0, left: 0, right: 0 }), bottom: pct } });
          return;
        }
        case 'crop-l': {
          const pct = Math.max(0, Math.min(80, Math.round(((initialOverride.crop?.left || 0) + (deltaX / cellWidthPx) * 100))));
          updateCellOverride(cellIdx, { crop: { ...(initialOverride.crop || { top: 0, bottom: 0, left: 0, right: 0 }), left: pct } });
          return;
        }
        case 'crop-r': {
          const pct = Math.max(0, Math.min(80, Math.round(((initialOverride.crop?.right || 0) - (deltaX / cellWidthPx) * 100))));
          updateCellOverride(cellIdx, { crop: { ...(initialOverride.crop || { top: 0, bottom: 0, left: 0, right: 0 }), right: pct } });
          return;
        }
      }

      const nextScale = Math.max(
        20,
        Math.min(300, Math.round((initialOverride.scalePercent ?? gridSettings.cellScalePercent) + scaleFactor))
      );
      updateCellOverride(cellIdx, { scalePercent: nextScale });
    };

    const handlePointerUp = () => {
      setActiveCellDragHandle(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeCellDragHandle, gridSettings]);

  // Handle on-sheet interactive dragging (margins & cell panning)
  const handlePointerDown = (
    type: 'topMargin' | 'bottomMargin' | 'leftMargin' | 'rightMargin' | 'panCell',
    e: React.PointerEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const container = sheetContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialSettings: { ...gridSettings },
      rectWidth: rect.width || 1,
      rectHeight: rect.height || 1,
    };

    setActiveDrag(type);
  };

  useEffect(() => {
    if (!activeDrag) return;

    const handlePointerMove = (e: PointerEvent) => {
      const { startX, startY, initialSettings, rectWidth, rectHeight } = dragStartRef.current;

      // Delta in mm
      const deltaXPercent = (e.clientX - startX) / rectWidth;
      const deltaYPercent = (e.clientY - startY) / rectHeight;

      const deltaXMm = deltaXPercent * paperWidthMm;
      const deltaYMm = deltaYPercent * paperHeightMm;

      if (activeDrag === 'topMargin') {
        const newTop = Math.max(0, Math.min(50, initialSettings.marginTopMm + deltaYMm));
        setGridSettings((prev) => ({ ...prev, marginTopMm: Math.round(newTop * 10) / 10 }));
      } else if (activeDrag === 'bottomMargin') {
        const newBottom = Math.max(0, Math.min(50, initialSettings.marginBottomMm - deltaYMm));
        setGridSettings((prev) => ({ ...prev, marginBottomMm: Math.round(newBottom * 10) / 10 }));
      } else if (activeDrag === 'leftMargin') {
        const newLeft = Math.max(0, Math.min(50, initialSettings.marginLeftMm + deltaXMm));
        setGridSettings((prev) => ({ ...prev, marginLeftMm: Math.round(newLeft * 10) / 10 }));
      } else if (activeDrag === 'rightMargin') {
        const newRight = Math.max(0, Math.min(50, initialSettings.marginRightMm - deltaXMm));
        setGridSettings((prev) => ({ ...prev, marginRightMm: Math.round(newRight * 10) / 10 }));
      } else if (activeDrag === 'panCell') {
        // Direct cell panning (Shift X / Shift Y)
        const shiftX = Math.max(-25, Math.min(25, initialSettings.offsetXPercent + deltaXPercent * 100));
        const shiftY = Math.max(-25, Math.min(25, initialSettings.offsetYPercent + deltaYPercent * 100));
        setGridSettings((prev) => ({
          ...prev,
          offsetXPercent: Math.round(shiftX),
          offsetYPercent: Math.round(shiftY),
        }));
      }
    };

    const handlePointerUp = () => {
      setActiveDrag(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeDrag, paperWidthMm, paperHeightMm]);

  // Calculate cell dimensions in mm for info display
  const usableWidthMm =
    paperWidthMm -
    gridSettings.marginLeftMm -
    gridSettings.marginRightMm -
    (gridSettings.cols - 1) * gridSettings.horizontalGapMm;
  const usableHeightMm =
    paperHeightMm -
    gridSettings.marginTopMm -
    gridSettings.marginBottomMm -
    (gridSettings.rows - 1) * gridSettings.verticalGapMm;

  const cellWidthMm = Math.max(1, Math.round(usableWidthMm / gridSettings.cols));
  const cellHeightMm = Math.max(1, Math.round(usableHeightMm / gridSettings.rows));

  // Margin percentages for overlay guide positions
  const topMarginPct = (gridSettings.marginTopMm / paperHeightMm) * 100;
  const bottomMarginPct = (gridSettings.marginBottomMm / paperHeightMm) * 100;
  const leftMarginPct = (gridSettings.marginLeftMm / paperWidthMm) * 100;
  const rightMarginPct = (gridSettings.marginRightMm / paperWidthMm) * 100;

  // Export Imposed PDF
  const handleExportImposedPdf = async () => {
    if (sheets.length === 0) return;

    try {
      const pdfDoc = await PDFDocument.create();

      for (let s = 0; s < sheets.length; s++) {
        const sheet = sheets[s];
        const dataUrl = await renderImposedSheetCanvas(
          sheet,
          gridSettings,
          paperWidthMm,
          paperHeightMm,
          2.5 // high print quality
        );

        const imageBytes = await fetch(dataUrl).then((res) => res.arrayBuffer());
        const embeddedImg = await pdfDoc.embedJpg(imageBytes);

        // Standard 72 points per inch (1 mm = 2.83465 pt)
        const pageWidthPt = paperWidthMm * 2.83465;
        const pageHeightPt = paperHeightMm * 2.83465;

        const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
        page.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: pageWidthPt,
          height: pageHeightPt,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const filename = `Imposed_Grid_${gridSettings.cols}x${gridSettings.rows}_${new Date().toISOString().slice(0, 10)}.pdf`;
      await savePdfFile(blob, filename);
    } catch (err) {
      console.error('Failed to export imposed PDF:', err);
    }
  };

  const handleTriggerPrint = () => {
    if (onPrintWithGrid) {
      onPrintWithGrid(gridSettings);
      onClose();
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-7xl h-[94vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-colors ${
          isDark
            ? 'bg-neutral-900 border-neutral-750 text-neutral-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Top Header */}
        <div
          className={`px-5 py-3 border-b flex items-center justify-between transition-colors ${
            isDark ? 'bg-neutral-950/80 border-neutral-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-500">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                مونتاژ و چیدمان جدولی صفحات (N-Up Imposition)
              </h3>
              <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                تنظیم دستی تعداد ردیف و ستون، مارجین ۴ طرفه و کنترل مستقیم روی تصویر
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportImposedPdf}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark
                  ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border-neutral-700'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-xs'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span>ذخیره PDF مونتاژ شده</span>
            </button>

            <button
              onClick={handleTriggerPrint}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>چاپ این چیدمان</span>
            </button>

            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-slate-200 text-slate-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Control Ribbon: Direct Inputs for Rows & Columns, Matrix Picker, Order & Repeat */}
        <div
          className={`px-5 py-2.5 border-b flex flex-wrap items-center justify-between gap-4 transition-colors ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-slate-100/70 border-slate-200'
          }`}
        >
          {/* Direct Manual Number Inputs for Columns & Rows (e.g. 2 x 10) */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 p-1 bg-slate-200/60 dark:bg-neutral-950 rounded-xl border border-slate-300 dark:border-neutral-800">
              <span className="text-xs font-bold px-2 text-neutral-400">تعداد در برگ:</span>

              {/* Matrix popover trigger */}
              <GridMatrixPicker
                rows={gridSettings.rows}
                cols={gridSettings.cols}
                onChange={(r, c) => setGridSettings({ ...gridSettings, rows: r, cols: c })}
                theme={theme}
              />

              <span className="text-xs text-neutral-400 font-bold">یا دستی:</span>

              {/* Direct Columns Input */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-neutral-400">ستون:</span>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={gridSettings.cols}
                  onChange={(e) =>
                    setGridSettings({
                      ...gridSettings,
                      cols: Math.max(1, Math.min(30, parseInt(e.target.value) || 1)),
                    })
                  }
                  className={`w-14 p-1 rounded-lg border text-center text-xs font-bold font-mono focus:outline-none focus:border-blue-500 ${
                    isDark
                      ? 'bg-neutral-900 border-neutral-750 text-white'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  placeholder="ستون"
                />
              </div>

              <span className="text-sm font-bold font-mono text-neutral-400">×</span>

              {/* Direct Rows Input */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-neutral-400">ردیف:</span>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={gridSettings.rows}
                  onChange={(e) =>
                    setGridSettings({
                      ...gridSettings,
                      rows: Math.max(1, Math.min(30, parseInt(e.target.value) || 1)),
                    })
                  }
                  className={`w-14 p-1 rounded-lg border text-center text-xs font-bold font-mono focus:outline-none focus:border-blue-500 ${
                    isDark
                      ? 'bg-neutral-900 border-neutral-750 text-white'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  placeholder="ردیف"
                />
              </div>

              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-600/10 text-blue-500 font-bold">
                = {gridSettings.cols * gridSettings.rows} خانه
              </span>
            </div>

            <div className="h-8 w-[1px] bg-neutral-700/40 hidden lg:block" />

            {/* Order Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-neutral-400">ترتیب:</span>
              <select
                value={gridSettings.order}
                onChange={(e) =>
                  setGridSettings({
                    ...gridSettings,
                    order: e.target.value as GridLayoutSettings['order'],
                  })
                }
                className={`py-1.5 px-2.5 rounded-xl border text-xs font-medium focus:outline-none cursor-pointer ${
                  isDark
                    ? 'bg-neutral-850 border-neutral-700 text-white'
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                <option value="rtl-rows">افقی راست‌به‌چپ (فارسی) [2 1 / 4 3]</option>
                <option value="ltr-rows">افقی چپ‌به‌راست (لاتین) [1 2 / 3 4]</option>
                <option value="rtl-cols">عمودی ستونی راست‌به‌چپ [3 1 / 4 2]</option>
                <option value="ltr-cols">عمودی ستونی چپ‌به‌راست [1 3 / 2 4]</option>
              </select>
            </div>

            {/* Repeat Checkbox */}
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none bg-blue-500/10 dark:bg-blue-950/40 px-3 py-1.5 rounded-xl border border-blue-500/30">
              <input
                type="checkbox"
                checked={gridSettings.repeatPage}
                onChange={(e) =>
                  setGridSettings({ ...gridSettings, repeatPage: e.target.checked })
                }
                className="w-4 h-4 accent-blue-600 cursor-pointer"
              />
              <span className="text-blue-600 dark:text-blue-400">
                تکرار در تمام جدول (Repeat)
              </span>
            </label>

            {/* Orientation */}
            <select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
              className={`py-1 px-2 rounded-lg border text-xs cursor-pointer ${
                isDark
                  ? 'bg-neutral-850 border-neutral-700 text-neutral-300'
                  : 'bg-white border-slate-300 text-slate-700'
              }`}
            >
              <option value="portrait">کاغذ عمودی (Portrait)</option>
              <option value="landscape">کاغذ افقی (Landscape)</option>
            </select>
          </div>

          {/* Quick info badge */}
          <div className="text-xs font-mono text-neutral-400 flex items-center gap-2">
            <span>
              ابعاد هر خانه: {cellWidthMm} × {cellHeightMm} mm
            </span>
          </div>
        </div>

        {/* Content Area: Pages Sidebar on Left, Main Sheet Preview with Direct Manual Overlay in Center, Controls Sidebar on Right */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Sidebar: Pages Previews & Custom Page Assignment */}
          {showPagesSidebar && (
            <div
              className={`w-full md:w-64 border-b md:border-b-0 md:border-e flex flex-col overflow-hidden transition-colors ${
                isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="p-3 border-b border-neutral-800/40 flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-xs">
                  <Layers className="w-4 h-4 text-blue-500" />
                  <span>صفحات سند ({preparedPages.length})</span>
                </span>
                <span className="text-[10px] text-neutral-400">
                  {selectedCellIdx !== null ? `خانه #${selectedCellIdx + 1}` : 'کلیک برای انتخاب'}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                {isLoadingPages ? (
                  <div className="p-4 text-center text-neutral-400 text-xs flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                    <span>در حال بارگذاری صفحات...</span>
                  </div>
                ) : preparedPages.length === 0 ? (
                  <div className="p-4 text-center text-neutral-400 text-xs">
                    هیچ صفحه‌ای یافت نشد.
                  </div>
                ) : (
                  preparedPages.map((pg, pIdx) => (
                    <div
                      key={pIdx}
                      className={`p-2 rounded-xl border transition-all text-xs flex flex-col gap-1.5 ${
                        isDark ? 'bg-neutral-950/80 border-neutral-800' : 'bg-white border-slate-200 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-blue-500">صفحه {pg.pageNumber}</span>
                        <span className="text-[10px] text-neutral-400 truncate max-w-[120px]" title={pg.sourceFileName}>
                          {pg.sourceFileName}
                        </span>
                      </div>

                      <div className="w-full h-24 bg-white rounded-lg border border-slate-200 dark:border-neutral-800 overflow-hidden flex items-center justify-center p-1">
                        <img
                          src={pg.dataUrl}
                          alt={`Page ${pg.pageNumber}`}
                          className="max-w-full max-h-full object-contain pointer-events-none select-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-1 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedCellIdx !== null) {
                              updateCellOverride(selectedCellIdx, { assignedPageIndex: pIdx });
                            }
                          }}
                          className={`py-1 px-1.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer text-center ${
                            isDark
                              ? 'bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-800'
                              : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                          }`}
                          title={`قرار دادن این صفحه در خانه انتخابی #${(selectedCellIdx ?? 0) + 1}`}
                        >
                          جایگذاری در خانه #{(selectedCellIdx ?? 0) + 1}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const totalCells = gridSettings.rows * gridSettings.cols;
                            const newOverrides: Record<number, CustomCellOverride> = {};
                            for (let i = 0; i < totalCells; i++) {
                              newOverrides[i] = {
                                ...(gridSettings.customCellOverrides?.[i] || {}),
                                assignedPageIndex: pIdx,
                              };
                            }
                            setGridSettings((prev) => ({
                              ...prev,
                              customCellOverrides: newOverrides,
                            }));
                          }}
                          className={`py-1 px-1.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer text-center ${
                            isDark
                              ? 'bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800'
                              : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
                          }`}
                          title="تکرار این صفحه در تمام خانه‌های جدول"
                        >
                          تکرار در کل جدول
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Main Sheet Preview Viewport */}
          <div
            className={`flex-1 flex flex-col overflow-hidden relative ${
              isDark ? 'bg-neutral-950' : 'bg-slate-100'
            }`}
          >
            {/* Sheet Pagination & Mode Toolbar */}
            <div
              className={`px-4 py-2 border-b flex items-center justify-between text-xs ${
                isDark ? 'bg-neutral-900/60 border-neutral-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Toggle Pages Sidebar Button */}
                <button
                  type="button"
                  onClick={() => setShowPagesSidebar((v) => !v)}
                  className={`p-1.5 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showPagesSidebar
                      ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                      : isDark
                      ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border-neutral-700'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                  title="نمایش / پنهان‌سازی نوار صفحات"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium">صفحات سند</span>
                </button>

                <span className="font-bold">
                  پیش‌نمایش برگه {currentSheetIdx + 1} از {totalSheets}
                </span>
                <span className="text-[11px] text-blue-500 font-medium hidden sm:inline">
                  (می‌توانید مستقیماً روی هر خانه کلیک کرده و با ۸ نقطه آن را تغییر اندازه و کراپ دهید)
                </span>
                {isRenderingSheet && (
                  <span className="flex items-center gap-1 text-[11px] text-blue-500 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    رندر چیدمان...
                  </span>
                )}
              </div>

              {/* Sheet Pager */}
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentSheetIdx <= 0}
                  onClick={() => setCurrentSheetIdx((idx) => Math.max(0, idx - 1))}
                  className={`p-1 rounded-lg border disabled:opacity-30 ${
                    isDark ? 'border-neutral-750 hover:bg-neutral-800' : 'border-slate-300 hover:bg-slate-100'
                  }`}
                  title="برگه قبل"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs px-2">
                  {currentSheetIdx + 1} / {totalSheets}
                </span>
                <button
                  disabled={currentSheetIdx >= totalSheets - 1}
                  onClick={() => setCurrentSheetIdx((idx) => Math.min(totalSheets - 1, idx + 1))}
                  className={`p-1 rounded-lg border disabled:opacity-30 ${
                    isDark ? 'border-neutral-750 hover:bg-neutral-800' : 'border-slate-300 hover:bg-slate-100'
                  }`}
                  title="برگه بعد"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sheet Canvas Preview Container with Interactive On-Image Drag Overlay */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center">
              <div
                ref={sheetContainerRef}
                dir="ltr"
                style={{ direction: 'ltr' }}
                className={`relative shadow-2xl rounded-sm overflow-hidden border select-none transition-all duration-150 ${
                  orientation === 'portrait'
                    ? 'w-[360px] sm:w-[460px] md:w-[500px] aspect-[1/1.414]'
                    : 'w-[480px] sm:w-[580px] md:w-[660px] aspect-[1.414/1]'
                } ${isDark ? 'border-neutral-700 bg-white' : 'border-slate-300 bg-white'}`}
              >
                {/* Rendered Canvas Image */}
                {sheetPreviewUrl ? (
                  <img
                    src={sheetPreviewUrl}
                    alt={`Sheet ${currentSheetIdx + 1}`}
                    className="w-full h-full object-contain pointer-events-none select-none"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-neutral-400 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                    <span>در حال رندر و چیدمان برگه...</span>
                  </div>
                )}

                {/* Interactive On-Image 4-Sided Margin Drag Guides & Cell Controls */}
                <div className="absolute inset-0 pointer-events-auto">
                  {/* Top Margin Drag Line */}
                  <div
                    onPointerDown={(e) => handlePointerDown('topMargin', e)}
                    style={{ top: `${topMarginPct}%` }}
                    className="absolute left-0 right-0 h-3 -translate-y-1/2 cursor-ns-resize group z-30 flex items-center justify-center"
                    title={`حاشیه بالا: ${gridSettings.marginTopMm}mm`}
                  >
                    <div className="w-full h-[2px] bg-blue-500/70 group-hover:bg-blue-600 transition-colors" />
                    <span className="absolute bg-blue-600 text-white font-mono text-[9px] px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      بالا: {gridSettings.marginTopMm}mm
                    </span>
                  </div>

                  {/* Bottom Margin Drag Line */}
                  <div
                    onPointerDown={(e) => handlePointerDown('bottomMargin', e)}
                    style={{ bottom: `${bottomMarginPct}%` }}
                    className="absolute left-0 right-0 h-3 translate-y-1/2 cursor-ns-resize group z-30 flex items-center justify-center"
                    title={`حاشیه پایین: ${gridSettings.marginBottomMm}mm`}
                  >
                    <div className="w-full h-[2px] bg-blue-500/70 group-hover:bg-blue-600 transition-colors" />
                    <span className="absolute bg-blue-600 text-white font-mono text-[9px] px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      پایین: {gridSettings.marginBottomMm}mm
                    </span>
                  </div>

                  {/* Left Margin Drag Line */}
                  <div
                    onPointerDown={(e) => handlePointerDown('leftMargin', e)}
                    style={{ left: `${leftMarginPct}%` }}
                    className="absolute top-0 bottom-0 w-3 -translate-x-1/2 cursor-ew-resize group z-30 flex items-center justify-center"
                    title={`حاشیه چپ: ${gridSettings.marginLeftMm}mm`}
                  >
                    <div className="h-full w-[2px] bg-blue-500/70 group-hover:bg-blue-600 transition-colors" />
                    <span className="absolute bg-blue-600 text-white font-mono text-[9px] px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      چپ: {gridSettings.marginLeftMm}mm
                    </span>
                  </div>

                  {/* Right Margin Drag Line */}
                  <div
                    onPointerDown={(e) => handlePointerDown('rightMargin', e)}
                    style={{ right: `${rightMarginPct}%` }}
                    className="absolute top-0 bottom-0 w-3 translate-x-1/2 cursor-ew-resize group z-30 flex items-center justify-center"
                    title={`حاشیه راست: ${gridSettings.marginRightMm}mm`}
                  >
                    <div className="h-full w-[2px] bg-blue-500/70 group-hover:bg-blue-600 transition-colors" />
                    <span className="absolute bg-blue-600 text-white font-mono text-[9px] px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      راست: {gridSettings.marginRightMm}mm
                    </span>
                  </div>

                  {/* Interactive Individual Cell Grid Overlay with 8-Point Direct Handles */}
                  <div
                    style={{
                      top: `${topMarginPct}%`,
                      bottom: `${bottomMarginPct}%`,
                      left: `${leftMarginPct}%`,
                      right: `${rightMarginPct}%`,
                      display: 'grid',
                      gridTemplateColumns: `repeat(${gridSettings.cols}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${gridSettings.rows}, minmax(0, 1fr))`,
                      gap: `${(gridSettings.verticalGapMm / paperHeightMm) * 100}% ${(gridSettings.horizontalGapMm / paperWidthMm) * 100}%`,
                    }}
                    className="absolute z-20 pointer-events-auto p-0.5"
                  >
                    {Array.from({ length: gridSettings.rows * gridSettings.cols }).map((_, cellIdx) => {
                      const isSelected = selectedCellIdx === cellIdx;
                      const hasOverride = Boolean(gridSettings.customCellOverrides?.[cellIdx]);
                      const currentOverride = gridSettings.customCellOverrides?.[cellIdx];
                      const isHidden = Boolean(currentOverride?.hidden);

                      return (
                        <div
                          key={cellIdx}
                          onClick={() => setSelectedCellIdx(cellIdx)}
                          className={`grid-cell-container relative rounded-xs transition-all cursor-pointer flex items-center justify-center group ${
                            isSelected
                              ? 'ring-2 ring-blue-500 bg-blue-500/10 border border-blue-400 z-30 shadow-md'
                              : hasOverride
                              ? 'ring-1 ring-purple-500/80 bg-purple-500/10 hover:bg-purple-500/20'
                              : 'border border-dashed border-slate-300/60 dark:border-neutral-700/60 hover:bg-blue-500/10'
                          }`}
                          title={`خانه #${cellIdx + 1} (کلیک برای ویرایش مستقیم روی تصویر)`}
                        >
                          {/* Badge Number */}
                          <span
                            className={`absolute top-1 left-1 font-mono text-[9px] px-1 py-0.5 rounded z-10 pointer-events-none transition-all ${
                              isSelected
                                ? 'bg-blue-600 text-white font-bold scale-110 shadow-xs'
                                : hasOverride
                                ? 'bg-purple-600 text-white font-bold'
                                : 'bg-black/50 text-white opacity-40 group-hover:opacity-100'
                            }`}
                          >
                            #{cellIdx + 1} {isHidden ? '(خالی)' : ''}
                          </span>

                          {/* Direct On-Cell 8-Point Transform & Crop Handles Overlay - Anchored EXACTLY to the Image */}
                          {isSelected && (() => {
                            const shiftX = currentOverride?.offsetXPercent ?? gridSettings.offsetXPercent;
                            const shiftY = currentOverride?.offsetYPercent ?? gridSettings.offsetYPercent;
                            const scale = currentOverride?.scalePercent ?? gridSettings.cellScalePercent;
                            const rot = currentOverride?.rotation ?? 0;
                            const fineAngle = currentOverride?.fineAngle ?? 0;
                            const crop = currentOverride?.crop || { top: 0, bottom: 0, left: 0, right: 0 };

                            const cropW = Math.max(1, 100 - (crop.left || 0) - (crop.right || 0));
                            const cropH = Math.max(1, 100 - (crop.top || 0) - (crop.bottom || 0));

                            // Calculate aspect ratio of cell slot vs source cropped image
                            const cellAspect = cellWidthMm / Math.max(1, cellHeightMm);
                            const pageAspect = (orientation === 'portrait' ? 210 : 297) / (orientation === 'portrait' ? 297 : 210);
                            const imgAspect = (cropW / cropH) * pageAspect;

                            let baseW = 100;
                            let baseH = 100;

                            if (imgAspect > cellAspect) {
                              baseW = 100;
                              baseH = Math.min(100, Math.max(5, (cellAspect / imgAspect) * 100));
                            } else {
                              baseH = 100;
                              baseW = Math.min(100, Math.max(5, (imgAspect / cellAspect) * 100));
                            }

                            // Exact size of the image on screen in percent of cell
                            const innerBoxW = Math.max(5, baseW * (scale / 100));
                            const innerBoxH = Math.max(5, baseH * (scale / 100));

                            return (
                              <div
                                style={{
                                  position: 'absolute',
                                  left: '50%',
                                  top: '50%',
                                  width: `${innerBoxW}%`,
                                  height: `${innerBoxH}%`,
                                  transform: `translate(-50%, -50%) translate(${shiftX}%, ${shiftY}%) rotate(${rot + fineAngle}deg)`,
                                  transformOrigin: 'center center',
                                }}
                                className="pointer-events-auto border-2 border-blue-500 bg-blue-500/10 z-30 shadow-md transition-[transform,width,height] duration-75"
                              >
                                {/* Central Move Drag Area */}
                                <div
                                  onPointerDown={(e) => handleCellPointerDown(cellIdx, 'move', e)}
                                  className="w-full h-full cursor-move flex items-center justify-center hover:bg-blue-500/15 transition-colors"
                                >
                                  <span className="font-mono text-[9px] bg-neutral-900/90 text-white px-1.5 py-0.5 rounded shadow opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                                    برای جابجایی بکشید
                                  </span>
                                </div>

                                {/* Floating Mini Action Bar over Selected Cell Image */}
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-neutral-900/95 text-white p-0.5 rounded-md shadow-lg border border-blue-500/40 text-[9px] z-40 whitespace-nowrap pointer-events-auto"
                                >
                                  <button
                                    type="button"
                                    onClick={() => setCellControlTab('transform')}
                                    className={`px-1 py-0.5 rounded cursor-pointer ${
                                      cellControlTab === 'transform' ? 'bg-blue-600 text-white' : 'hover:bg-neutral-800'
                                    }`}
                                    title="جابجایی و مقیاس"
                                  >
                                    ↔ اندازه
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCellControlTab('crop')}
                                    className={`px-1 py-0.5 rounded cursor-pointer ${
                                      cellControlTab === 'crop' ? 'bg-blue-600 text-white' : 'hover:bg-neutral-800'
                                    }`}
                                    title="کراپ لبه‌ها"
                                  >
                                    ✂️ کراپ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateCellOverride(cellIdx, {
                                        rotation: (((currentOverride?.rotation || 0) + 90) % 360),
                                      })
                                    }
                                    className="px-1 py-0.5 rounded hover:bg-neutral-800 cursor-pointer"
                                    title="چرخش ۹۰ درجه"
                                  >
                                    🔄 +90°
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateCellOverride(cellIdx, {
                                        hidden: !Boolean(currentOverride?.hidden),
                                      })
                                    }
                                    className={`px-1 py-0.5 rounded cursor-pointer ${
                                      currentOverride?.hidden ? 'bg-red-600 text-white' : 'hover:bg-neutral-800'
                                    }`}
                                    title="خالی کردن یا فعال‌سازی این سلول"
                                  >
                                    {currentOverride?.hidden ? 'نمایش' : 'خالی'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => resetCellOverride(cellIdx)}
                                    className="px-1 py-0.5 rounded hover:bg-red-600/80 cursor-pointer text-red-300"
                                    title="ریست این خانه"
                                  >
                                    🧹
                                  </button>
                                </div>

                                {/* In Crop Mode: 4 Crop Handles */}
                                {cellControlTab === 'crop' ? (
                                  <>
                                    {/* Top Crop Handle */}
                                    <div
                                      onPointerDown={(e) => handleCellPointerDown(cellIdx, 'crop-t', e)}
                                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-2 bg-blue-600 border border-white rounded-xs shadow cursor-ns-resize hover:scale-125 transition-transform"
                                      title="درگ برای کراپ بالا"
                                    />
                                    {/* Bottom Crop Handle */}
                                    <div
                                      onPointerDown={(e) => handleCellPointerDown(cellIdx, 'crop-b', e)}
                                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-2 bg-blue-600 border border-white rounded-xs shadow cursor-ns-resize hover:scale-125 transition-transform"
                                      title="درگ برای کراپ پایین"
                                    />
                                    {/* Left Crop Handle */}
                                    <div
                                      onPointerDown={(e) => handleCellPointerDown(cellIdx, 'crop-l', e)}
                                      className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-2 h-6 bg-blue-600 border border-white rounded-xs shadow cursor-ew-resize hover:scale-125 transition-transform"
                                      title="درگ برای کراپ چپ"
                                    />
                                    {/* Right Crop Handle */}
                                    <div
                                      onPointerDown={(e) => handleCellPointerDown(cellIdx, 'crop-r', e)}
                                      className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-2 h-6 bg-blue-600 border border-white rounded-xs shadow cursor-ew-resize hover:scale-125 transition-transform"
                                      title="درگ برای کراپ راست"
                                    />
                                  </>
                                ) : (
                                  /* In Standard / Transform Mode: 8 Points Handles */
                                  <>
                                    {/* Top-Left */}
                                    <div
                                      onPointerDown={(e) => handleCellPointerDown(cellIdx, 'tl', e)}
                                      className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow cursor-nwse-resize hover:scale-125 transition-transform z-30"
                                      title="تغییر اندازه از بالا-چپ"
                                    />
                                    {/* Top-Center */}
                                    <div
                                      onPointerDown={(e) => handleCellPointerDown(cellIdx, 'tc', e)}
                                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow cursor-ns-resize hover:scale-125 transition-transform z-30"
                                      title="تغییر اندازه از بالا"
                                    />
                                    {/* Top-Right */}
                                    <div
                                      onPointerDown={(e) => handleCellPointerDown(cellIdx, 'tr', e)}
                                      className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow cursor-nesw-resize hover:scale-125 transition-transform z-30"
                                      title="تغییر اندازه از بالا-راست"
                                    />
                                    {/* Middle-Left */}
                                    <div
                                      onPointerDown={(e) => handleCellPointerDown(cellIdx, 'ml', e)}
                                      className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow cursor-ew-resize hover:scale-125 transition-transform z-30"
                                      title="تغییر اندازه از چپ"
                                    />
                                    {/* Middle-Right */}
                                    <div
                                      onPointerDown={(e) => handleCellPointerDown(cellIdx, 'mr', e)}
                                      className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow cursor-ew-resize hover:scale-125 transition-transform z-30"
                                      title="تغییر اندازه از راست"
                                    />
                                    {/* Bottom-Left */}
                                    <div
                                      onPointerDown={(e) => handleCellPointerDown(cellIdx, 'bl', e)}
                                      className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow cursor-nesw-resize hover:scale-125 transition-transform z-30"
                                      title="تغییر اندازه از پایین-چپ"
                                    />
                                    {/* Bottom-Center */}
                                    <div
                                      onPointerDown={(e) => handleCellPointerDown(cellIdx, 'bc', e)}
                                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow cursor-ns-resize hover:scale-125 transition-transform z-30"
                                      title="تغییر اندازه از پایین"
                                    />
                                    {/* Bottom-Right */}
                                    <div
                                      onPointerDown={(e) => handleCellPointerDown(cellIdx, 'br', e)}
                                      className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow cursor-nwse-resize hover:scale-125 transition-transform z-30"
                                      title="تغییر اندازه از پایین-راست"
                                    />
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar: 4-Sided Margins, Gutter Spacings & Scale */}
          <div
            className={`w-full md:w-80 border-t md:border-t-0 md:border-s flex flex-col overflow-y-auto transition-colors ${
              isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="p-4 space-y-4 text-xs">
              {/* Section 1: 4-Sided Margins (تنظیم مارجین از چهار طرف) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-xs">
                    <Maximize2 className="w-4 h-4 text-blue-500" />
                    <span>تنظیم مارجین از ۴ طرف (Sheet Margins)</span>
                  </span>
                  <label className="flex items-center gap-1 text-[11px] text-neutral-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={gridSettings.showMarginGuides}
                      onChange={(e) =>
                        setGridSettings({ ...gridSettings, showMarginGuides: e.target.checked })
                      }
                      className="accent-blue-600"
                    />
                    <span>خطوط مارجین</span>
                  </label>
                </div>

                {/* 4 Margins Inputs Grid */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {/* Top */}
                  <div
                    className={`p-2 rounded-xl border ${
                      isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <label className="text-neutral-400 block mb-1">مارجین بالا (Top)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        step="0.5"
                        value={gridSettings.marginTopMm}
                        onChange={(e) =>
                          setGridSettings({
                            ...gridSettings,
                            marginTopMm: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className={`w-16 p-1 rounded-lg border text-xs font-mono font-bold focus:outline-none ${
                          isDark
                            ? 'bg-neutral-900 border-neutral-750 text-white'
                            : 'bg-white border-slate-300 text-slate-800'
                        }`}
                      />
                      <span className="text-neutral-400 font-mono">mm</span>
                    </div>
                  </div>

                  {/* Bottom */}
                  <div
                    className={`p-2 rounded-xl border ${
                      isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <label className="text-neutral-400 block mb-1">مارجین پایین (Bottom)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        step="0.5"
                        value={gridSettings.marginBottomMm}
                        onChange={(e) =>
                          setGridSettings({
                            ...gridSettings,
                            marginBottomMm: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className={`w-16 p-1 rounded-lg border text-xs font-mono font-bold focus:outline-none ${
                          isDark
                            ? 'bg-neutral-900 border-neutral-750 text-white'
                            : 'bg-white border-slate-300 text-slate-800'
                        }`}
                      />
                      <span className="text-neutral-400 font-mono">mm</span>
                    </div>
                  </div>

                  {/* Left */}
                  <div
                    className={`p-2 rounded-xl border ${
                      isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <label className="text-neutral-400 block mb-1">مارجین چپ (Left)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        step="0.5"
                        value={gridSettings.marginLeftMm}
                        onChange={(e) =>
                          setGridSettings({
                            ...gridSettings,
                            marginLeftMm: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className={`w-16 p-1 rounded-lg border text-xs font-mono font-bold focus:outline-none ${
                          isDark
                            ? 'bg-neutral-900 border-neutral-750 text-white'
                            : 'bg-white border-slate-300 text-slate-800'
                        }`}
                      />
                      <span className="text-neutral-400 font-mono">mm</span>
                    </div>
                  </div>

                  {/* Right */}
                  <div
                    className={`p-2 rounded-xl border ${
                      isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <label className="text-neutral-400 block mb-1">مارجین راست (Right)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        step="0.5"
                        value={gridSettings.marginRightMm}
                        onChange={(e) =>
                          setGridSettings({
                            ...gridSettings,
                            marginRightMm: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className={`w-16 p-1 rounded-lg border text-xs font-mono font-bold focus:outline-none ${
                          isDark
                            ? 'bg-neutral-900 border-neutral-750 text-white'
                            : 'bg-white border-slate-300 text-slate-800'
                        }`}
                      />
                      <span className="text-neutral-400 font-mono">mm</span>
                    </div>
                  </div>
                </div>

                {/* Quick Margin Presets */}
                <div className="flex items-center gap-1 pt-1">
                  {[
                    { label: '۰ mm', val: 0 },
                    { label: '۵ mm', val: 5 },
                    { label: '۸ mm', val: 8 },
                    { label: '۱۰ mm', val: 10 },
                    { label: '۱۵ mm', val: 15 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() =>
                        setGridSettings({
                          ...gridSettings,
                          marginTopMm: p.val,
                          marginBottomMm: p.val,
                          marginLeftMm: p.val,
                          marginRightMm: p.val,
                        })
                      }
                      className={`flex-1 py-1 rounded-lg border text-[10px] font-mono transition-colors ${
                        isDark
                          ? 'bg-neutral-800 hover:bg-neutral-750 border-neutral-700 text-neutral-300'
                          : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 2: Spacings between cells (فواصل افقی و عمودی بین خانه‌ها) */}
              <div className={`pt-3 border-t space-y-2.5 ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
                <span className="font-bold flex items-center gap-1.5 text-xs">
                  <Sliders className="w-4 h-4 text-blue-500" />
                  <span>فاصله بین خانه‌ها (Gutter Spacing)</span>
                </span>

                {/* Horizontal Gap */}
                <div
                  className={`p-2.5 rounded-xl border ${
                    isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-neutral-400">فاصله افقی بین ستون‌ها</label>
                    <span className="font-mono text-blue-500 font-bold">
                      {gridSettings.horizontalGapMm} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    step="0.5"
                    value={gridSettings.horizontalGapMm}
                    onChange={(e) =>
                      setGridSettings({
                        ...gridSettings,
                        horizontalGapMm: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                {/* Vertical Gap */}
                <div
                  className={`p-2.5 rounded-xl border ${
                    isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-neutral-400">فاصله عمودی بین ردیف‌ها</label>
                    <span className="font-mono text-blue-500 font-bold">
                      {gridSettings.verticalGapMm} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    step="0.5"
                    value={gridSettings.verticalGapMm}
                    onChange={(e) =>
                      setGridSettings({
                        ...gridSettings,
                        verticalGapMm: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Section 3: Cell Scale & Positioning (تغییر اندازه و جابجایی داخل هر بخش) */}
              <div className={`pt-3 border-t space-y-2.5 ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
                <span className="font-bold flex items-center gap-1.5 text-xs">
                  <Scissors className="w-4 h-4 text-purple-500" />
                  <span>اندازه و موقعیت داخل هر خانه</span>
                </span>

                {/* Scale */}
                <div
                  className={`p-2.5 rounded-xl border ${
                    isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-neutral-400">مقیاس اندازه (Scale)</label>
                    <span className="font-mono text-purple-500 font-bold">
                      {gridSettings.cellScalePercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="140"
                    step="2"
                    value={gridSettings.cellScalePercent}
                    onChange={(e) =>
                      setGridSettings({
                        ...gridSettings,
                        cellScalePercent: parseInt(e.target.value) || 100,
                      })
                    }
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                </div>

                {/* Offset X (جابجایی افقی) */}
                <div
                  className={`p-2.5 rounded-xl border ${
                    isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-neutral-400">جابجایی افقی (Shift X)</label>
                    <span className="font-mono text-neutral-300 font-bold">
                      {gridSettings.offsetXPercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-25"
                    max="25"
                    step="1"
                    value={gridSettings.offsetXPercent}
                    onChange={(e) =>
                      setGridSettings({
                        ...gridSettings,
                        offsetXPercent: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                {/* Offset Y (جابجایی عمودی) */}
                <div
                  className={`p-2.5 rounded-xl border ${
                    isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-neutral-400">جابجایی عمودی (Shift Y)</label>
                    <span className="font-mono text-neutral-300 font-bold">
                      {gridSettings.offsetYPercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-25"
                    max="25"
                    step="1"
                    value={gridSettings.offsetYPercent}
                    onChange={(e) =>
                      setGridSettings({
                        ...gridSettings,
                        offsetYPercent: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                {/* Show Cut Marks checkbox */}
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={gridSettings.showCutMarks}
                    onChange={(e) =>
                      setGridSettings({ ...gridSettings, showCutMarks: e.target.checked })
                    }
                    className="accent-blue-600"
                  />
                  <span>نمایش خطوط راهنمای برش گیوتین (Cut Marks)</span>
                </label>
              </div>

              {/* Section 4: Individual Cell Custom Size & Position (تغییر اندازه و جابجایی هر سلول به صورت جداگانه) */}
              <div className={`pt-3 border-t space-y-3 ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-xs">
                    <Move className="w-4 h-4 text-purple-500" />
                    <span>تغییر اندازه و جابجایی هر خانه جدول</span>
                  </span>
                  {selectedCellIdx !== null && (
                    <span className="font-mono text-purple-500 font-bold text-xs bg-purple-500/10 px-2 py-0.5 rounded">
                      خانه #{selectedCellIdx + 1}
                    </span>
                  )}
                </div>

                {/* Quick Cell Selector Matrix */}
                <div className="space-y-1">
                  <label className="text-neutral-400 text-[11px] block">
                    انتخاب خانه جهت تغییر اندازه و موقعیت:
                  </label>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950">
                    {Array.from({ length: gridSettings.rows * gridSettings.cols }).map((_, idx) => {
                      const isSel = selectedCellIdx === idx;
                      const hasOver = Boolean(gridSettings.customCellOverrides?.[idx]);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedCellIdx(idx)}
                          className={`w-7 h-7 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                            isSel
                              ? 'bg-blue-600 text-white shadow-xs scale-105 ring-1 ring-blue-400'
                              : hasOver
                              ? 'bg-purple-600/30 text-purple-300 border border-purple-500'
                              : isDark
                              ? 'bg-neutral-900 text-neutral-400 hover:text-white'
                              : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedCellIdx !== null && (() => {
                  const currentOverride = gridSettings.customCellOverrides?.[selectedCellIdx];
                  const shiftX = currentOverride?.offsetXPercent ?? gridSettings.offsetXPercent;
                  const shiftY = currentOverride?.offsetYPercent ?? gridSettings.offsetYPercent;
                  const scale = currentOverride?.scalePercent ?? gridSettings.cellScalePercent;
                  const rot = currentOverride?.rotation ?? 0;
                  const fineAngle = currentOverride?.fineAngle ?? 0;
                  const brightness = currentOverride?.brightness ?? 100;
                  const contrast = currentOverride?.contrast ?? 100;
                  const isGray = Boolean(currentOverride?.grayscale);
                  const isThreshold = Boolean(currentOverride?.threshold);
                  const isInvert = Boolean(currentOverride?.invert);
                  const crop = currentOverride?.crop || { top: 0, bottom: 0, left: 0, right: 0 };
                  const hasBorder = Boolean(currentOverride?.border);
                  const isHidden = Boolean(currentOverride?.hidden);

                  return (
                    <div
                      className={`p-3 rounded-xl border space-y-3 ${
                        isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {/* Sub-tabs for Cell Controls */}
                      <div className="flex items-center gap-1 p-0.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-900 text-[10px]">
                        {[
                          { id: 'transform' as const, label: 'موقعیت و اندازه', icon: Move },
                          { id: 'crop' as const, label: 'کراپ', icon: Crop },
                          { id: 'color' as const, label: 'نور و رنگ', icon: Sun },
                          { id: 'rotation' as const, label: 'چرخش', icon: RotateCw },
                          { id: 'border' as const, label: 'کادر و وضعیت', icon: Square },
                        ].map((t) => {
                          const IconComp = t.icon;
                          const isActive = cellControlTab === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setCellControlTab(t.id)}
                              className={`flex-1 py-1 px-1 rounded flex items-center justify-center gap-1 font-medium transition-colors cursor-pointer ${
                                isActive
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : isDark
                                  ? 'text-neutral-400 hover:text-white'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <IconComp className="w-3 h-3 shrink-0" />
                              <span className="hidden sm:inline">{t.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Tab 1: Position & Scale */}
                      {cellControlTab === 'transform' && (
                        <div className="space-y-2.5">
                          {/* Shift X */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-neutral-400 font-medium">جابجایی افقی (Shift X):</span>
                              <span className="font-mono text-purple-500 font-bold">{shiftX}%</span>
                            </div>
                            <input
                              type="range"
                              min="-100"
                              max="100"
                              step="1"
                              value={shiftX}
                              onChange={(e) =>
                                updateCellOverride(selectedCellIdx, {
                                  offsetXPercent: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-full accent-purple-600 cursor-pointer"
                            />
                          </div>

                          {/* Shift Y */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-neutral-400 font-medium">جابجایی عمودی (Shift Y):</span>
                              <span className="font-mono text-purple-500 font-bold">{shiftY}%</span>
                            </div>
                            <input
                              type="range"
                              min="-100"
                              max="100"
                              step="1"
                              value={shiftY}
                              onChange={(e) =>
                                updateCellOverride(selectedCellIdx, {
                                  offsetYPercent: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-full accent-purple-600 cursor-pointer"
                            />
                          </div>

                          {/* Scale */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-neutral-400 font-medium">مقیاس اندازه (Scale):</span>
                              <span className="font-mono text-purple-500 font-bold">{scale}%</span>
                            </div>
                            <input
                              type="range"
                              min="20"
                              max="250"
                              step="2"
                              value={scale}
                              onChange={(e) =>
                                updateCellOverride(selectedCellIdx, {
                                  scalePercent: parseInt(e.target.value) || 100,
                                })
                              }
                              className="w-full accent-purple-600 cursor-pointer"
                            />
                          </div>
                        </div>
                      )}

                      {/* Tab 2: Individual Crop */}
                      {cellControlTab === 'crop' && (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            {/* Top Crop */}
                            <div>
                              <div className="flex justify-between mb-0.5 text-neutral-400">
                                <span>کراپ بالا (Top):</span>
                                <span className="font-mono">{crop.top}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="80"
                                step="1"
                                value={crop.top}
                                onChange={(e) =>
                                  updateCellOverride(selectedCellIdx, {
                                    crop: { ...crop, top: parseInt(e.target.value) || 0 },
                                  })
                                }
                                className="w-full accent-blue-600 cursor-pointer"
                              />
                            </div>

                            {/* Bottom Crop */}
                            <div>
                              <div className="flex justify-between mb-0.5 text-neutral-400">
                                <span>کراپ پایین (Bottom):</span>
                                <span className="font-mono">{crop.bottom}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="80"
                                step="1"
                                value={crop.bottom}
                                onChange={(e) =>
                                  updateCellOverride(selectedCellIdx, {
                                    crop: { ...crop, bottom: parseInt(e.target.value) || 0 },
                                  })
                                }
                                className="w-full accent-blue-600 cursor-pointer"
                              />
                            </div>

                            {/* Left Crop */}
                            <div>
                              <div className="flex justify-between mb-0.5 text-neutral-400">
                                <span>کراپ چپ (Left):</span>
                                <span className="font-mono">{crop.left}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="80"
                                step="1"
                                value={crop.left}
                                onChange={(e) =>
                                  updateCellOverride(selectedCellIdx, {
                                    crop: { ...crop, left: parseInt(e.target.value) || 0 },
                                  })
                                }
                                className="w-full accent-blue-600 cursor-pointer"
                              />
                            </div>

                            {/* Right Crop */}
                            <div>
                              <div className="flex justify-between mb-0.5 text-neutral-400">
                                <span>کراپ راست (Right):</span>
                                <span className="font-mono">{crop.right}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="80"
                                step="1"
                                value={crop.right}
                                onChange={(e) =>
                                  updateCellOverride(selectedCellIdx, {
                                    crop: { ...crop, right: parseInt(e.target.value) || 0 },
                                  })
                                }
                                className="w-full accent-blue-600 cursor-pointer"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              updateCellOverride(selectedCellIdx, {
                                crop: { top: 0, bottom: 0, left: 0, right: 0 },
                              })
                            }
                            className="w-full py-1 rounded text-[10px] text-neutral-400 hover:text-neutral-200 border border-neutral-700/50 hover:border-neutral-600 transition-colors cursor-pointer"
                          >
                            ریست کراپ این خانه
                          </button>
                        </div>
                      )}

                      {/* Tab 3: Light & Color */}
                      {cellControlTab === 'color' && (
                        <div className="space-y-2.5">
                          {/* Brightness */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-neutral-400">روشنایی (Brightness):</span>
                              <span className="font-mono text-amber-500 font-bold">{brightness}%</span>
                            </div>
                            <input
                              type="range"
                              min="50"
                              max="200"
                              step="5"
                              value={brightness}
                              onChange={(e) =>
                                updateCellOverride(selectedCellIdx, {
                                  brightness: parseInt(e.target.value) || 100,
                                })
                              }
                              className="w-full accent-amber-500 cursor-pointer"
                            />
                          </div>

                          {/* Contrast */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-neutral-400">کنتراست (Contrast):</span>
                              <span className="font-mono text-blue-500 font-bold">{contrast}%</span>
                            </div>
                            <input
                              type="range"
                              min="50"
                              max="200"
                              step="5"
                              value={contrast}
                              onChange={(e) =>
                                updateCellOverride(selectedCellIdx, {
                                  contrast: parseInt(e.target.value) || 100,
                                })
                              }
                              className="w-full accent-blue-500 cursor-pointer"
                            />
                          </div>

                          {/* Color Modes Toggles */}
                          <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px]">
                            <button
                              type="button"
                              onClick={() =>
                                updateCellOverride(selectedCellIdx, { grayscale: !isGray })
                              }
                              className={`py-1.5 px-1 rounded-lg border text-center transition-colors cursor-pointer ${
                                isGray
                                  ? 'bg-neutral-600 text-white font-bold border-neutral-500'
                                  : isDark
                                  ? 'bg-neutral-900 border-neutral-800 text-neutral-400'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              خاکستری
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                updateCellOverride(selectedCellIdx, { threshold: !isThreshold })
                              }
                              className={`py-1.5 px-1 rounded-lg border text-center transition-colors cursor-pointer ${
                                isThreshold
                                  ? 'bg-neutral-900 text-white font-bold border-blue-500 ring-1 ring-blue-500'
                                  : isDark
                                  ? 'bg-neutral-900 border-neutral-800 text-neutral-400'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              سیاه/سفید
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                updateCellOverride(selectedCellIdx, { invert: !isInvert })
                              }
                              className={`py-1.5 px-1 rounded-lg border text-center transition-colors cursor-pointer ${
                                isInvert
                                  ? 'bg-purple-700 text-white font-bold border-purple-500'
                                  : isDark
                                  ? 'bg-neutral-900 border-neutral-800 text-neutral-400'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              نگاتیو
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tab 4: Rotation & Angle */}
                      {cellControlTab === 'rotation' && (
                        <div className="space-y-2.5">
                          {/* 90-deg Steps */}
                          <div className="space-y-1">
                            <label className="text-neutral-400 block text-[11px]">
                              چرخش ۹۰ درجه خانه #{selectedCellIdx + 1}:
                            </label>
                            <div className="grid grid-cols-4 gap-1">
                              {[0, 90, 180, 270].map((deg) => (
                                <button
                                  key={deg}
                                  type="button"
                                  onClick={() => updateCellOverride(selectedCellIdx, { rotation: deg })}
                                  className={`py-1.5 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
                                    rot === deg
                                      ? 'bg-purple-600 text-white font-bold'
                                      : isDark
                                      ? 'bg-neutral-900 border border-neutral-750 text-neutral-300'
                                      : 'bg-white border border-slate-200 text-slate-700'
                                  }`}
                                >
                                  {deg}°
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Fine Deskew Angle */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-neutral-400">تراز زاویه دقیق (Deskew):</span>
                              <span className="font-mono text-blue-500 font-bold">{fineAngle}°</span>
                            </div>
                            <input
                              type="range"
                              min="-45"
                              max="45"
                              step="0.5"
                              value={fineAngle}
                              onChange={(e) =>
                                updateCellOverride(selectedCellIdx, {
                                  fineAngle: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-full accent-blue-600 cursor-pointer"
                            />
                          </div>
                        </div>
                      )}

                      {/* Tab 5: Border & Status */}
                      {cellControlTab === 'border' && (
                        <div className="space-y-2.5">
                          {/* Cell Border Toggle */}
                          <label className="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 cursor-pointer text-[11px]">
                            <span className="font-medium flex items-center gap-1.5">
                              <Square className="w-3.5 h-3.5 text-blue-500" />
                              <span>کادر دور این خانه (Cell Border)</span>
                            </span>
                            <input
                              type="checkbox"
                              checked={hasBorder}
                              onChange={(e) =>
                                updateCellOverride(selectedCellIdx, { border: e.target.checked })
                              }
                              className="accent-blue-600 cursor-pointer"
                            />
                          </label>

                          {/* Hide / Blank Slot Toggle */}
                          <label className="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 cursor-pointer text-[11px]">
                            <span className="font-medium flex items-center gap-1.5 text-red-400">
                              <EyeOff className="w-3.5 h-3.5 text-red-500" />
                              <span>خالی گذاشتن این خانه (Blank Slot)</span>
                            </span>
                            <input
                              type="checkbox"
                              checked={isHidden}
                              onChange={(e) =>
                                updateCellOverride(selectedCellIdx, { hidden: e.target.checked })
                              }
                              className="accent-red-600 cursor-pointer"
                            />
                          </label>
                        </div>
                      )}

                      {/* Override Actions */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-neutral-800/40">
                        <button
                          type="button"
                          onClick={() => resetCellOverride(selectedCellIdx)}
                          className={`py-1.5 px-2 rounded-lg border text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                            isDark
                              ? 'bg-neutral-900 hover:bg-neutral-850 border-neutral-750 text-neutral-300'
                              : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                        >
                          <Crosshair className="w-3 h-3 text-neutral-400" />
                          <span>ریست این خانه</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => applyCellOverrideToAll(selectedCellIdx)}
                          className={`py-1.5 px-2 rounded-lg border text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                            isDark
                              ? 'bg-purple-950/60 hover:bg-purple-900/60 border-purple-800 text-purple-200'
                              : 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-900'
                          }`}
                        >
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span>اعمال روی همه</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {Boolean(
                  gridSettings.customCellOverrides &&
                    Object.keys(gridSettings.customCellOverrides).length > 0
                ) && (
                  <button
                    type="button"
                    onClick={resetAllCellOverrides}
                    className="w-full py-1 rounded-lg border text-[11px] text-red-500 border-red-500/30 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    حذف تمام تنظیمات سفارشی خانه‌ها
                  </button>
                )}
              </div>

              {/* Reset to defaults button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setGridSettings({
                      enabled: true,
                      rows: 4,
                      cols: 3,
                      repeatPage: false,
                      order: 'rtl-rows',
                      horizontalGapMm: 3,
                      verticalGapMm: 3,
                      marginTopMm: 8,
                      marginBottomMm: 8,
                      marginLeftMm: 8,
                      marginRightMm: 8,
                      cellScalePercent: 100,
                      offsetXPercent: 0,
                      offsetYPercent: 0,
                      showCutMarks: true,
                      showMarginGuides: true,
                    })
                  }
                  className={`w-full py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-600'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ریست به تنظیمات پیش‌فرض</span>
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div
              className={`p-4 border-t mt-auto flex items-center justify-end gap-2 ${
                isDark ? 'border-neutral-800 bg-neutral-950/70' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <button
                onClick={onClose}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                  isDark
                    ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-750'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {t.close}
              </button>
              <button
                onClick={handleTriggerPrint}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>ارسال به چاپگر</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
