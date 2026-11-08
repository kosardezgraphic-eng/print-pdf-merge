import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Maximize2,
  LayoutGrid,
  MousePointer,
  Crop,
  Type,
  Shapes,
  Hash,
  Ruler as RulerIcon,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Sun,
  Contrast,
  Sparkles,
  Scissors,
  Check,
  RefreshCw,
  Copy,
  PlusCircle,
  Trash2,
  Sliders,
  CheckSquare,
  Square,
  Eye,
  Link2,
  FileText,
  Layers,
  UploadCloud,
  CheckCheck,
  Move,
  Minimize2,
  X,
  Compass,
  Magnet,
  Hand,
} from 'lucide-react';
import {
  PDFItem,
  PrintSettings,
  Language,
  PageAdjustment,
  PageOverlayText,
  PageOverlayShape,
  PageOverlayNumbering,
  CanvasGuideline,
  RibbonTab,
  CustomCellOverride,
} from '../types';
import { renderPdfPageToDataUrl, defaultAdjustment } from '../utils/pdfRenderUtils';
import { calculateGridCellOrder } from '../utils/gridImpositionUtils';
import { PAPER_DIMENSIONS_MM } from './PrintPreviewSheet';
import { Ruler } from './Ruler';
import { GuidelinesLayer } from './GuidelinesLayer';
import { MeasureToolLayer, MeasureLine } from './MeasureToolLayer';
import { InteractiveCropBox } from './InteractiveCropBox';
import { InteractiveTransformBox } from './InteractiveTransformBox';
import { OverlayElementsLayer } from './OverlayElementsLayer';
import { TextControlPanel } from './TextControlPanel';
import { ShapeControlPanel } from './ShapeControlPanel';
import { PageNumberingPanel } from './PageNumberingPanel';
import { InteractiveMarginGuides } from './InteractiveMarginGuides';
import { duplicatePdfPage, insertBlankPdfPage } from '../utils/pdfPageModifier';

interface UnifiedStudioWorkspaceProps {
  items: PDFItem[];
  onUpdateItem: (id: string, updates: Partial<PDFItem>) => void;
  activeGlobalPageIndex: number;
  onSelectGlobalPage: (index: number) => void;
  selectedEditingPageKeys: Set<string>;
  onSelectPageForEdit: (globalIndex: number, item: PDFItem, pageNum: number, isMulti?: boolean) => void;
  onSelectAllEditingPages: () => void;
  onSelectNoneEditingPages: () => void;
  onSelectOddEditingPages: () => void;
  onSelectEvenEditingPages: () => void;
  onInvertEditingSelection: () => void;
  onBatchUpdateAdjustments: (updates: Partial<PageAdjustment>) => void;
  activeRibbonTab: RibbonTab;
  onSelectRibbonTab?: (tab: RibbonTab) => void;
  settings: PrintSettings;
  onChangeSettings: (updates: Partial<PrintSettings>) => void;
  lang: Language;
  theme: 'dark' | 'light';
  zoomLevel: number;
  onChangeZoom: (level: number) => void;
  showRulers: boolean;
  onToggleRulers: () => void;
  showMargins: boolean;
  onToggleMargins: () => void;
  activeTool: 'move' | 'crop' | 'text' | 'shape' | 'numbering' | 'measure';
  onSelectTool: (tool: 'move' | 'crop' | 'text' | 'shape' | 'numbering' | 'measure') => void;
  workspaceMode: 'studio' | 'sheet';
  onChangeWorkspaceMode: (mode: 'studio' | 'sheet') => void;
  onFilesSelected: (files: File[]) => void;
  onImagesSelected: (files: File[]) => void;
  onLoadSamples: () => void;
  showToast: (msg: string) => void;
  pushUndoState: () => void;

  selectedCellIdx?: number;
  selectedCellIndices?: number[];
  onSelectCell?: (idx: number, isMulti?: boolean) => void;
  onUpdateCellOverride?: (cellIdx: number | number[], updates: Partial<CustomCellOverride>) => void;
  onResetCellOverride?: (cellIdx: number | number[]) => void;
  onApplyCellOverrideToAll?: (cellIdx: number) => void;
  selectedTextId?: string | null;
  onSelectTextId?: (id: string | null) => void;
  selectedShapeId?: string | null;
  onSelectShapeId?: (id: string | null) => void;
  currentSheetIndex?: number;
  onChangeSheetIndex?: (idx: number) => void;
}

export const UnifiedStudioWorkspace: React.FC<UnifiedStudioWorkspaceProps> = ({
  items,
  onUpdateItem,
  activeGlobalPageIndex,
  onSelectGlobalPage,
  selectedEditingPageKeys,
  onSelectPageForEdit,
  onSelectAllEditingPages,
  onSelectNoneEditingPages,
  onSelectOddEditingPages,
  onSelectEvenEditingPages,
  onInvertEditingSelection,
  onBatchUpdateAdjustments,
  activeRibbonTab,
  onSelectRibbonTab,
  settings,
  onChangeSettings,
  lang,
  theme,
  zoomLevel,
  onChangeZoom,
  showRulers,
  onToggleRulers,
  showMargins,
  onToggleMargins,
  activeTool,
  onSelectTool,
  workspaceMode,
  onChangeWorkspaceMode,
  onFilesSelected,
  onImagesSelected,
  onLoadSamples,
  showToast,
  pushUndoState,
  selectedCellIdx: propsSelectedCellIdx,
  selectedCellIndices: propsSelectedCellIndices,
  onSelectCell: propsOnSelectCell,
  onUpdateCellOverride: propsOnUpdateCellOverride,
  onResetCellOverride: propsOnResetCellOverride,
  onApplyCellOverrideToAll: propsOnApplyCellOverrideToAll,
  selectedTextId: propsSelectedTextId,
  onSelectTextId: propsOnSelectTextId,
  selectedShapeId: propsSelectedShapeId,
  onSelectShapeId: propsOnSelectShapeId,
  currentSheetIndex: propsCurrentSheetIndex,
  onChangeSheetIndex: propsOnChangeSheetIndex,
}) => {
  const isDark = theme === 'dark';
  const isFa = lang === 'fa';

  // Flat list of all pages across documents
  const flatPages = useMemo(() => {
    const list: {
      globalIndex: number;
      item: PDFItem;
      pageNum: number;
      adjustment: PageAdjustment;
      totalPages: number;
    }[] = [];

    let count = 0;
    for (const item of items) {
      const pCount = item.pageCount || 1;
      for (let p = 1; p <= pCount; p++) {
        const adj = item.pageAdjustments?.[p] || { ...defaultAdjustment };
        list.push({
          globalIndex: count++,
          item,
          pageNum: p,
          adjustment: adj,
          totalPages: pCount,
        });
      }
    }
    return list;
  }, [items]);

  // Current focused page
  const currentPageInfo = useMemo(() => {
    if (flatPages.length === 0) return null;
    const bounded = Math.max(0, Math.min(flatPages.length - 1, activeGlobalPageIndex));
    return flatPages[bounded] || flatPages[0];
  }, [flatPages, activeGlobalPageIndex]);

  // Active adjustment of current page
  const currentAdj = useMemo(() => {
    if (!currentPageInfo) return { ...defaultAdjustment };
    return currentPageInfo.adjustment;
  }, [currentPageInfo]);

  // Printable pages for sheet imposition (strictly driven by checkbox selectedForPrint)
  const printablePages = useMemo(() => {
    return flatPages.filter((p) => p.adjustment.selectedForPrint);
  }, [flatPages]);

  // High-res preview cache for Studio Workbench
  const [studioRenderCache, setStudioRenderCache] = useState<Record<string, string>>({});
  const [isLoadingStudioImage, setIsLoadingStudioImage] = useState<boolean>(false);

  // Sheet Imposition Cache
  const [sheetRenderCache, setSheetRenderCache] = useState<Record<string, string>>({});
  const [viewScrollMode, setViewScrollMode] = useState<'continuous' | 'single'>('continuous');
  const [internalCurrentSheetIndex, setInternalCurrentSheetIndex] = useState<number>(0);
  const currentSheetIndex = propsCurrentSheetIndex !== undefined ? propsCurrentSheetIndex : internalCurrentSheetIndex;
  const setCurrentSheetIndex = (idx: number) => {
    if (propsOnChangeSheetIndex) propsOnChangeSheetIndex(idx);
    else setInternalCurrentSheetIndex(idx);
  };

  // Guidelines state
  const [guidelines, setGuidelines] = useState<CanvasGuideline[]>([]);
  // Measure Line
  const [measureLine, setMeasureLine] = useState<MeasureLine | null>(null);

  // Selected Overlay IDs
  const [internalSelectedTextId, setInternalSelectedTextId] = useState<string | null>(null);
  const selectedTextId = propsSelectedTextId !== undefined ? propsSelectedTextId : internalSelectedTextId;
  const setSelectedTextId = (id: string | null) => {
    if (propsOnSelectTextId) propsOnSelectTextId(id);
    else setInternalSelectedTextId(id);
  };

  const [internalSelectedShapeId, setInternalSelectedShapeId] = useState<string | null>(null);
  const selectedShapeId = propsSelectedShapeId !== undefined ? propsSelectedShapeId : internalSelectedShapeId;
  const setSelectedShapeId = (id: string | null) => {
    if (propsOnSelectShapeId) propsOnSelectShapeId(id);
    else setInternalSelectedShapeId(id);
  };
  const [selectedNumberingId, setSelectedNumberingId] = useState<string | null>(null);

  // Settings Panel visibility: closes on single click on page canvas, opens on double click on elements
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState<boolean>(true);

  // Selection state for Page: deactivated (hidden 8-point handles) on click outside page, activated on click on page
  const [isPageSelected, setIsPageSelected] = useState<boolean>(true);

  // Snap to Grid & Guidelines toggle
  const [snapToGridAndGuides, setSnapToGridAndGuides] = useState<boolean>(true);

  // Spacebar Pan Viewport state
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [viewportPan, setViewportPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ startX: number; startY: number; initPanX: number; initPanY: number }>({
    startX: 0,
    startY: 0,
    initPanX: 0,
    initPanY: 0,
  });

  // Spacebar key detection for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Pan dragging tracking
  useEffect(() => {
    if (!isPanning) return;
    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - panStartRef.current.startX;
      const dy = e.clientY - panStartRef.current.startY;
      setViewportPan({
        x: panStartRef.current.initPanX + dx,
        y: panStartRef.current.initPanY + dy,
      });
    };
    const handlePointerUp = () => {
      setIsPanning(false);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isPanning]);

  // Selected Matrix Cell Indices with Multi-Selection Support
  const [internalSelectedCellIdx, setInternalSelectedCellIdx] = useState<number>(0);
  const effectiveCellIndices = useMemo(() => {
    if (propsSelectedCellIndices && propsSelectedCellIndices.length > 0) {
      return propsSelectedCellIndices;
    }
    return [propsSelectedCellIdx ?? internalSelectedCellIdx ?? 0];
  }, [propsSelectedCellIndices, propsSelectedCellIdx, internalSelectedCellIdx]);
  const selectedCellIdx = effectiveCellIndices[0] ?? 0;

  const onSelectCell = (idx: number, isMulti?: boolean) => {
    if (propsOnSelectCell) {
      propsOnSelectCell(idx, isMulti);
    } else {
      setInternalSelectedCellIdx(idx);
    }
  };

  const lastWheelTimeRef = useRef<number>(0);

  // Matrix Individual Cell Override Helpers
  const updateCellOverride = (
    cellIdxOrIndices: number | number[],
    updates: Partial<CustomCellOverride>
  ) => {
    if (propsOnUpdateCellOverride) {
      propsOnUpdateCellOverride(cellIdxOrIndices, updates);
      return;
    }
    const indices = Array.isArray(cellIdxOrIndices) ? cellIdxOrIndices : [cellIdxOrIndices];
    const gridLayout = settings.gridLayout || {
      enabled: true,
      rows: 1,
      cols: 1,
      repeatPage: true,
      order: 'rtl-rows',
      horizontalGapMm: 2,
      verticalGapMm: 2,
      marginTopMm: 8,
      marginBottomMm: 8,
      marginLeftMm: 8,
      marginRightMm: 8,
      cellScalePercent: 100,
      offsetXPercent: 0,
      offsetYPercent: 0,
      showCutMarks: true,
    };
    const currentOverrides = { ...(gridLayout.customCellOverrides || {}) };
    for (const idx of indices) {
      const existing = currentOverrides[idx] || {
        offsetXPercent: gridLayout.offsetXPercent || 0,
        offsetYPercent: gridLayout.offsetYPercent || 0,
        scalePercent: gridLayout.cellScalePercent || 100,
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
      currentOverrides[idx] = {
        ...existing,
        ...updates,
      };
    }
    onChangeSettings({
      gridLayout: {
        ...gridLayout,
        customCellOverrides: currentOverrides,
      },
    });
  };

  const resetCellOverride = (cellIdxOrIndices: number | number[]) => {
    if (propsOnResetCellOverride) {
      propsOnResetCellOverride(cellIdxOrIndices);
      return;
    }
    if (!settings.gridLayout?.customCellOverrides) return;
    const indices = Array.isArray(cellIdxOrIndices) ? cellIdxOrIndices : [cellIdxOrIndices];
    const nextOverrides = { ...settings.gridLayout.customCellOverrides };
    for (const idx of indices) {
      delete nextOverrides[idx];
    }
    onChangeSettings({
      gridLayout: {
        ...settings.gridLayout,
        customCellOverrides: nextOverrides,
      },
    });
    showToast(isFa ? 'تنظیمات خانه‌های انتخابی بازنشانی شد' : 'Reset cell overrides');
  };

  const applyCellOverrideToAll = (cellIdx: number) => {
    if (propsOnApplyCellOverrideToAll) {
      propsOnApplyCellOverrideToAll(cellIdx);
      return;
    }
    const gridLayout = settings.gridLayout;
    if (!gridLayout) return;
    const currentOverrides = gridLayout.customCellOverrides || {};
    const source = currentOverrides[cellIdx] || {
      offsetXPercent: gridLayout.offsetXPercent || 0,
      offsetYPercent: gridLayout.offsetYPercent || 0,
      scalePercent: gridLayout.cellScalePercent || 100,
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
    const totalCells = (gridLayout.rows || 1) * (gridLayout.cols || 1);
    const newOverrides: Record<number, CustomCellOverride> = {};
    for (let i = 0; i < totalCells; i++) {
      newOverrides[i] = JSON.parse(JSON.stringify(source));
    }
    onChangeSettings({
      gridLayout: {
        ...gridLayout,
        customCellOverrides: newOverrides,
      },
    });
    showToast(isFa ? 'تنظیمات این خانه به تمام خانه‌ها اعمال شد' : 'Applied to all cells');
  };

  // Reset Everything to Pristine Defaults
  const handleResetAllToDefaults = () => {
    pushUndoState();
    // 1. Reset page adjustments (scale, crop, offsets, filters, overlays)
    onBatchUpdateAdjustments({
      scale: 100,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      fineAngle: 0,
      crop: { top: 0, bottom: 0, left: 0, right: 0 },
      brightness: 100,
      contrast: 100,
      grayscale: false,
      invert: false,
      threshold: false,
      texts: [],
      shapes: [],
      pageNumbering: undefined,
    });
    // 2. Reset grid layout to standard 1x1
    onChangeSettings({
      gridLayout: {
        enabled: false,
        rows: 1,
        cols: 1,
        repeatPage: false,
        order: 'rtl-rows',
        horizontalGapMm: 0,
        verticalGapMm: 0,
        marginTopMm: 8,
        marginBottomMm: 8,
        marginLeftMm: 8,
        marginRightMm: 8,
        cellScalePercent: 100,
        offsetXPercent: 0,
        offsetYPercent: 0,
        showCutMarks: false,
        customCellOverrides: {},
      },
      gutterMm: 0,
    });
    // 3. Reset Zoom & Pan
    onChangeZoom(1.0);
    setViewportPan({ x: 0, y: 0 });
    setSelectedTextId(null);
    setSelectedShapeId(null);
    setSelectedNumberingId(null);
    onSelectCell(0);
    showToast(
      isFa
        ? 'تمام تنظیمات، مقیاس، برش، ماتریس و المان‌ها به حالت اولیه بازگردانده شدند'
        : 'All settings reset to default'
    );
  };

  // Inline Page Modification Popover (Duplicate / Insert Blank)
  const [pageActionPopover, setPageActionPopover] = useState<'duplicate' | 'blank' | null>(null);
  const [duplicateCopies, setDuplicateCopies] = useState<number>(1);
  const [blankCopies, setBlankCopies] = useState<number>(1);
  const [isModifyingPdf, setIsModifyingPdf] = useState<boolean>(false);

  // Rulers tracking ref
  const pageImageRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Render high-res image for studio workbench
  useEffect(() => {
    if (!currentPageInfo) return;
    const key = `${currentPageInfo.item.id}_${currentPageInfo.pageNum}_hires`;
    if (studioRenderCache[key]) return;

    let isCancelled = false;
    setIsLoadingStudioImage(true);

    renderPdfPageToDataUrl(currentPageInfo.item.file, currentPageInfo.pageNum, 1.35)
      .then((res) => {
        if (!isCancelled) {
          setStudioRenderCache((prev) => ({ ...prev, [key]: res.dataUrl }));
          setIsLoadingStudioImage(false);
        }
      })
      .catch((err) => {
        console.warn('High-res render error:', err);
        if (!isCancelled) setIsLoadingStudioImage(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [currentPageInfo, studioRenderCache]);

  // Update adjustment helper: delegates to batch update for all highlighted/selected editing pages!
  const updateCurrentAdj = (updates: Partial<PageAdjustment>) => {
    pushUndoState();
    onBatchUpdateAdjustments(updates);
  };

  // Text Overlay Handlers
  const handleAddText = () => {
    const newId = `txt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newText: PageOverlayText = {
      id: newId,
      text: isFa ? 'متن جدید' : 'New Text',
      xPercent: 50,
      yPercent: 50,
      fontSize: 20,
      fontFamily: 'Vazirmatn, sans-serif',
      color: '#000000',
      align: 'center',
      opacity: 1,
      rotation: 0,
      bold: false,
      italic: false,
    };

    updateCurrentAdj({
      texts: [...(currentAdj.texts || []), newText],
    });
    setSelectedTextId(newId);
    onSelectTool('text');
  };

  const handleUpdateText = (id: string, updates: Partial<PageOverlayText>) => {
    const nextTexts = (currentAdj.texts || []).map((t) => (t.id === id ? { ...t, ...updates } : t));
    updateCurrentAdj({ texts: nextTexts });
  };

  const handleDeleteText = (id: string) => {
    const nextTexts = (currentAdj.texts || []).filter((t) => t.id !== id);
    updateCurrentAdj({ texts: nextTexts });
    setSelectedTextId(null);
    onSelectTool('move');
  };

  const handleDuplicateText = (id: string, offset = { x: 3, y: 3 }): string => {
    const source = currentAdj.texts?.find((t) => t.id === id);
    if (!source) return id;
    const newId = `txt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const clone: PageOverlayText = {
      ...source,
      id: newId,
      xPercent: Math.min(95, source.xPercent + offset.x),
      yPercent: Math.min(95, source.yPercent + offset.y),
    };
    updateCurrentAdj({
      texts: [...(currentAdj.texts || []), clone],
    });
    setSelectedTextId(newId);
    showToast(isFa ? 'متن تکثیر شد (Ctrl+Drag)' : 'Text duplicated');
    return newId;
  };

  // Shape Overlay Handlers
  const handleAddShape = () => {
    const newId = `shp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newShape: PageOverlayShape = {
      id: newId,
      type: 'rectangle',
      xPercent: 50,
      yPercent: 50,
      widthPercent: 30,
      heightPercent: 20,
      fillColor: 'transparent',
      strokeColor: '#2563eb',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
      rotation: 0,
    };

    updateCurrentAdj({
      shapes: [...(currentAdj.shapes || []), newShape],
    });
    setSelectedShapeId(newId);
    onSelectTool('shape');
  };

  const handleUpdateShape = (id: string, updates: Partial<PageOverlayShape>) => {
    const nextShapes = (currentAdj.shapes || []).map((s) => (s.id === id ? { ...s, ...updates } : s));
    updateCurrentAdj({ shapes: nextShapes });
  };

  const handleDeleteShape = (id: string) => {
    const nextShapes = (currentAdj.shapes || []).filter((s) => s.id !== id);
    updateCurrentAdj({ shapes: nextShapes });
    setSelectedShapeId(null);
    onSelectTool('move');
  };

  const handleDuplicateShape = (id: string, offset = { x: 3, y: 3 }): string => {
    const source = currentAdj.shapes?.find((s) => s.id === id);
    if (!source) return id;
    const newId = `shp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const clone: PageOverlayShape = {
      ...source,
      id: newId,
      xPercent: Math.min(95, source.xPercent + offset.x),
      yPercent: Math.min(95, source.yPercent + offset.y),
    };
    updateCurrentAdj({
      shapes: [...(currentAdj.shapes || []), clone],
    });
    setSelectedShapeId(newId);
    showToast(isFa ? 'کادر تکثیر شد (Ctrl+Drag)' : 'Shape duplicated');
    return newId;
  };

  // Page Numbering Handlers
  const handleAddOrToggleNumbering = () => {
    if (currentAdj.pageNumbering?.enabled) {
      updateCurrentAdj({
        pageNumbering: { ...currentAdj.pageNumbering, enabled: false },
      });
      setSelectedNumberingId(null);
      onSelectTool('move');
    } else {
      const numbering: PageOverlayNumbering = {
        id: 'num-primary',
        enabled: true,
        xPercent: 50,
        yPercent: 95,
        format: isFa ? 'persian' : 'english',
        template: isFa ? 'صفحه {page} از {total}' : 'Page {page} of {total}',
        fontFamily: 'Vazirmatn, sans-serif',
        fontSize: 12,
        color: '#333333',
        startOffset: 1,
        opacity: 1,
      };
      updateCurrentAdj({ pageNumbering: numbering });
      setSelectedNumberingId('primary');
      onSelectTool('numbering');
    }
  };

  const handleUpdateNumbering = (updates: Partial<PageOverlayNumbering>) => {
    updateCurrentAdj({
      pageNumbering: { ...(currentAdj.pageNumbering || {}), ...updates } as PageOverlayNumbering,
    });
  };

  const handleDuplicateNumbering = (id: string, offset = { x: 3, y: 3 }): string => {
    if (!currentAdj.pageNumbering) return id;
    const newId = `num-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const clone: PageOverlayNumbering = {
      ...currentAdj.pageNumbering,
      id: newId,
      xPercent: Math.min(95, currentAdj.pageNumbering.xPercent + offset.x),
      yPercent: Math.min(95, currentAdj.pageNumbering.yPercent + offset.y),
    };
    updateCurrentAdj({
      pageNumbering: clone,
    });
    setSelectedNumberingId(newId);
    showToast(isFa ? 'شماره‌زن تکثیر شد (Ctrl+Drag)' : 'Numbering duplicated');
    return newId;
  };

  // In-place Page Duplication
  const handleConfirmDuplicate = async () => {
    if (!currentPageInfo) return;
    setIsModifyingPdf(true);
    try {
      pushUndoState();
      const res = await duplicatePdfPage(
        currentPageInfo.item.file,
        currentPageInfo.pageNum,
        duplicateCopies,
        'after'
      );
      onUpdateItem(currentPageInfo.item.id, {
        file: res.newFile,
        pageCount: res.newPageCount,
      });
      setPageActionPopover(null);
      showToast(isFa ? `${duplicateCopies} نسخه از برگه تکثیر شد` : `Page duplicated ${duplicateCopies} times`);
    } catch (err) {
      console.error(err);
      showToast(isFa ? 'خطا در تکثیر برگه' : 'Error duplicating page');
    } finally {
      setIsModifyingPdf(false);
    }
  };

  // In-place Blank Page Insertion
  const handleConfirmInsertBlank = async () => {
    if (!currentPageInfo) return;
    setIsModifyingPdf(true);
    try {
      pushUndoState();
      const res = await insertBlankPdfPage(
        currentPageInfo.item.file,
        currentPageInfo.pageNum,
        blankCopies,
        210,
        297
      );
      onUpdateItem(currentPageInfo.item.id, {
        file: res.newFile,
        pageCount: res.newPageCount,
      });
      setPageActionPopover(null);
      showToast(isFa ? `${blankCopies} برگه سفید جدید درج شد` : `Inserted ${blankCopies} blank page(s)`);
    } catch (err) {
      console.error(err);
      showToast(isFa ? 'خطا در درج برگه سفید' : 'Error inserting blank page');
    } finally {
      setIsModifyingPdf(false);
    }
  };

  // Sheet Imposition calculations
  const isGridEnabled = Boolean(settings.gridLayout?.enabled);
  const gridRows = isGridEnabled ? settings.gridLayout?.rows || 1 : 1;
  const gridCols = isGridEnabled ? settings.gridLayout?.cols || 1 : 1;
  const cellsPerSheet = gridRows * gridCols;

  const totalSheets = useMemo(() => {
    if (printablePages.length === 0) return 0;
    if (settings.gridLayout?.repeatPage) return printablePages.length;
    return Math.ceil(printablePages.length / cellsPerSheet);
  }, [printablePages.length, cellsPerSheet, settings.gridLayout?.repeatPage]);

  // Keep sheet index within range
  useEffect(() => {
    if (totalSheets === 0) setCurrentSheetIndex(0);
    else if (currentSheetIndex >= totalSheets) {
      setCurrentSheetIndex(Math.max(0, totalSheets - 1));
    }
  }, [totalSheets, currentSheetIndex]);

  // Ctrl + Mouse Wheel Zoom & Single-Page / Single-Sheet Wheel Navigation
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        onChangeZoom(Math.max(0.25, Math.min(3.0, Number((zoomLevel + delta).toFixed(2)))));
      } else if (viewScrollMode === 'single') {
        if (Math.abs(e.deltaY) < 5) return;
        const now = Date.now();
        if (now - lastWheelTimeRef.current < 180) {
          e.preventDefault();
          return;
        }

        e.preventDefault();
        lastWheelTimeRef.current = now;

        if (workspaceMode === 'sheet') {
          if (e.deltaY > 0) {
            if (currentSheetIndex < totalSheets - 1) {
              setCurrentSheetIndex(currentSheetIndex + 1);
            }
          } else {
            if (currentSheetIndex > 0) {
              setCurrentSheetIndex(currentSheetIndex - 1);
            }
          }
        } else {
          if (e.deltaY > 0) {
            if (activeGlobalPageIndex < flatPages.length - 1) {
              const nextIdx = activeGlobalPageIndex + 1;
              onSelectGlobalPage(nextIdx);
              const targetPage = flatPages[nextIdx];
              if (targetPage) {
                onSelectPageForEdit(nextIdx, targetPage.item, targetPage.pageNum);
              }
            }
          } else {
            if (activeGlobalPageIndex > 0) {
              const prevIdx = activeGlobalPageIndex - 1;
              onSelectGlobalPage(prevIdx);
              const targetPage = flatPages[prevIdx];
              if (targetPage) {
                onSelectPageForEdit(prevIdx, targetPage.item, targetPage.pageNum);
              }
            }
          }
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [
    zoomLevel,
    onChangeZoom,
    viewScrollMode,
    workspaceMode,
    currentSheetIndex,
    totalSheets,
    activeGlobalPageIndex,
    flatPages,
    onSelectGlobalPage,
    onSelectPageForEdit,
    setCurrentSheetIndex,
  ]);

  const currentSheetPages = useMemo(() => {
    if (printablePages.length === 0) return [];
    if (settings.gridLayout?.repeatPage) {
      const target = printablePages[currentSheetIndex] || printablePages[0];
      return Array(cellsPerSheet).fill(target);
    }
    const start = currentSheetIndex * cellsPerSheet;
    const list = printablePages.slice(start, start + cellsPerSheet);
    const res: (typeof printablePages[0] | null)[] = [...list];
    while (res.length < cellsPerSheet) res.push(null);
    return res;
  }, [printablePages, currentSheetIndex, cellsPerSheet, settings.gridLayout?.repeatPage]);

  const cellOrderIndices = useMemo(() => {
    if (!isGridEnabled) return [0];
    return calculateGridCellOrder(gridRows, gridCols, settings.gridLayout?.order || 'rtl-rows');
  }, [isGridEnabled, gridRows, gridCols, settings.gridLayout?.order]);

  // Sheets to render in continuous vs single mode
  const sheetsToRender = useMemo(() => {
    if (totalSheets === 0) return [];
    if (viewScrollMode === 'single') {
      return [Math.max(0, Math.min(totalSheets - 1, currentSheetIndex))];
    }
    return Array.from({ length: totalSheets }, (_, i) => i);
  }, [totalSheets, viewScrollMode, currentSheetIndex]);

  // Vertically center content when it fits the viewport (single sheet / few sheets) so the page is
  // not cramped under the top toolbar. Keep justify-start for multi-sheet continuous scrolling.
  const isContentCentered =
    viewScrollMode === 'continuous' && sheetsToRender.length <= 1;

  // Single-page view or a single sheet that fits the viewport: center vertically in the available
  // height so the page is fully visible and not stuck under the top toolbar/menu.
  const shouldCenterContentVertically =
    viewScrollMode === 'single' || isContentCentered;

  // Auto-center current page/sheet when changing page or scrolling in single mode
  useEffect(() => {
    if (viewScrollMode === 'single') {
      setViewportPan({ x: 0, y: 0 });
      const container = canvasContainerRef.current;
      if (container) {
        container.scrollTop = 0;
        container.scrollLeft = 0;
      }
      // Center the rendered sheet element in the viewport (same as continuous mode).
      // Must run AFTER scrollTop reset so it centers from the top, not leaves the page at the top.
      const el = document.getElementById(`sheet-${currentSheetIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    } else if (viewScrollMode === 'continuous' && canvasContainerRef.current) {
      const el = document.getElementById(`sheet-${currentSheetIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentSheetIndex, activeGlobalPageIndex, viewScrollMode]);

  // Sync currentSheetIndex with centered sheet when user manually scrolls container in continuous mode
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container || viewScrollMode !== 'continuous') return;

    let isTicking = false;
    const handleContainerScroll = () => {
      if (isTicking) return;
      isTicking = true;
      requestAnimationFrame(() => {
        isTicking = false;
        const containerRect = container.getBoundingClientRect();
        const containerCenterY = containerRect.top + containerRect.height / 2;

        let closestSheetIdx = currentSheetIndex;
        let minDiff = Infinity;

        sheetsToRender.forEach((sIdx) => {
          const el = document.getElementById(`sheet-${sIdx}`);
          if (el) {
            const rect = el.getBoundingClientRect();
            const elCenterY = rect.top + rect.height / 2;
            const diff = Math.abs(containerCenterY - elCenterY);
            if (diff < minDiff) {
              minDiff = diff;
              closestSheetIdx = sIdx;
            }
          }
        });

        if (closestSheetIdx !== currentSheetIndex) {
          setCurrentSheetIndex(closestSheetIdx);
        }
      });
    };

    container.addEventListener('scroll', handleContainerScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleContainerScroll);
    };
  }, [viewScrollMode, sheetsToRender, currentSheetIndex, setCurrentSheetIndex]);

  // Get pages assigned to a given sheet index
  const getSheetPages = (sIdx: number) => {
    if (printablePages.length === 0) return [];
    if (settings.gridLayout?.repeatPage) {
      const target = printablePages[sIdx] || printablePages[0];
      return Array(cellsPerSheet).fill(target);
    }
    const start = sIdx * cellsPerSheet;
    const list = printablePages.slice(start, start + cellsPerSheet);
    const res: (typeof printablePages[0] | null)[] = [...list];
    while (res.length < cellsPerSheet) res.push(null);
    return res;
  };

  // Render sheet preview cells for printable pages
  useEffect(() => {
    let isCancelled = false;
    const pagesToRender = printablePages.slice(0, 60);
    if (pagesToRender.length === 0) return;

    pagesToRender.forEach((pageTask) => {
      const key = `${pageTask.item.id}_${pageTask.pageNum}`;
      if (sheetRenderCache[key]) return;
      renderPdfPageToDataUrl(pageTask.item.file, pageTask.pageNum, 0.45)
        .then((res) => {
          if (!isCancelled) {
            setSheetRenderCache((prev) => ({ ...prev, [key]: res.dataUrl }));
          }
        })
        .catch(() => {});
    });

    return () => {
      isCancelled = true;
    };
  }, [printablePages, sheetRenderCache]);

  // Active page image data
  const hiresImg = currentPageInfo
    ? studioRenderCache[`${currentPageInfo.item.id}_${currentPageInfo.pageNum}_hires`]
    : null;

  // Image filter calculations for studio workbench
  const filterParts: string[] = [];
  if (currentAdj.threshold) {
    filterParts.push('contrast(220%) grayscale(100%)');
  } else if (currentAdj.grayscale) {
    filterParts.push('grayscale(100%)');
  }
  if (currentAdj.brightness && currentAdj.brightness !== 100) {
    filterParts.push(`brightness(${currentAdj.brightness}%)`);
  }
  if (currentAdj.contrast && currentAdj.contrast !== 100) {
    filterParts.push(`contrast(${currentAdj.contrast}%)`);
  }
  if (currentAdj.invert) {
    filterParts.push('invert(100%)');
  }
  const workbenchFilter = filterParts.length > 0 ? filterParts.join(' ') : 'none';

  const totalRotation =
    ((currentPageInfo?.item.rotation || 0) +
      (currentAdj.rotation || 0) +
      (currentAdj.fineAngle || 0)) %
    360;

  // Page transformation values
  const pageScalePct = (currentAdj.scale || 100) / 100;
  const pageOffX = currentAdj.offsetX || 0;
  const pageOffY = currentAdj.offsetY || 0;
  const cropTop = currentAdj.crop?.top || 0;
  const cropRight = currentAdj.crop?.right || 0;
  const cropBottom = currentAdj.crop?.bottom || 0;
  const cropLeft = currentAdj.crop?.left || 0;
  const hasCrop = cropTop > 0 || cropRight > 0 || cropBottom > 0 || cropLeft > 0;

  // Physical sheet dimensions & scaling
  const isLandscape = settings.orientation === 'landscape';
  const effectiveWidthMm = isLandscape
    ? (PAPER_DIMENSIONS_MM[settings.paperSize]?.heightMm || 297)
    : (PAPER_DIMENSIONS_MM[settings.paperSize]?.widthMm || 210);
  const effectiveHeightMm = isLandscape
    ? (PAPER_DIMENSIONS_MM[settings.paperSize]?.widthMm || 210)
    : (PAPER_DIMENSIONS_MM[settings.paperSize]?.heightMm || 297);
  const sheetAspect = effectiveWidthMm / effectiveHeightMm;
  const sheetW = isLandscape ? 680 : 500;
  const sheetH = Math.round(sheetW / sheetAspect);

  // Fit active sheet cleanly inside the viewport bounds
  const fitToViewport = useCallback(() => {
    setViewportPan({ x: 0, y: 0 });
    const container = canvasContainerRef.current;
    if (!container) {
      onChangeZoom(0.8);
      return;
    }
    const containerW = container.clientWidth - 80;
    const containerH = container.clientHeight - 80;
    if (containerW <= 0 || containerH <= 0) return;

    const targetW = sheetW + 40;
    const targetH = sheetH + 80;

    const scaleX = containerW / targetW;
    const scaleY = containerH / targetH;
    const bestScale = Math.min(scaleX, scaleY);

    const clampedScale = Math.max(0.35, Math.min(1.4, Number(bestScale.toFixed(2))));
    onChangeZoom(clampedScale);
  }, [sheetW, sheetH, onChangeZoom]);

  // Automatically fit page to viewport when switching to single page mode
  useEffect(() => {
    if (viewScrollMode === 'single') {
      fitToViewport();
    }
  }, [viewScrollMode, fitToViewport]);

  // Count of selected pages for editing
  const selectedCount = selectedEditingPageKeys.size;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none relative z-10">
      {/* 1. TOP WORKBENCH HEADER & TOOLS BAR */}
      <div
        className={`min-h-[46px] h-[46px] px-3 border-b flex items-center justify-between gap-2 shrink-0 transition-colors z-30 select-none overflow-x-auto no-scrollbar ${
          isDark
            ? 'bg-neutral-900/95 border-neutral-800 text-neutral-200'
            : 'bg-white/95 border-slate-200 text-slate-800 shadow-xs'
        }`}
      >
        {/* RIGHT (RTL START): Sheet Format & Matrix Imposition */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Live Sheet Status Indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 text-xs font-semibold shrink-0">
            <LayoutGrid className="w-3.5 h-3.5 text-blue-500" />
            <span className="font-bold">{isFa ? 'بوم زنده چاپ' : 'Live Sheet'}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300 font-bold">
              {settings.paperSize}
            </span>
            <button
              type="button"
              onClick={() =>
                onChangeSettings({
                  orientation: isLandscape ? 'portrait' : 'landscape',
                })
              }
              className="text-[10px] px-1.5 py-0.5 rounded hover:bg-blue-500/20 cursor-pointer font-sans transition-colors text-blue-600 dark:text-blue-300 font-medium"
              title={isFa ? 'تغییر جهت کاغذ (عمودی / افقی)' : 'Toggle Orientation'}
            >
              {isLandscape ? (isFa ? 'افقی' : 'Landscape') : (isFa ? 'عمودی' : 'Portrait')}
            </button>
          </div>

          {/* Continuous Scroll View Toggle */}
          <button
            type="button"
            onClick={() => setViewScrollMode((v) => (v === 'continuous' ? 'single' : 'continuous'))}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
              viewScrollMode === 'continuous'
                ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                : 'bg-black/5 dark:bg-neutral-800 text-neutral-400 border-neutral-300 dark:border-neutral-700 hover:text-white'
            }`}
            title={isFa ? 'تغییر بین اسکرول پیوسته برگه‌ها و مشاهده تک برگه‌ای' : 'Toggle Continuous Scroll / Single Sheet'}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{viewScrollMode === 'continuous' ? (isFa ? 'اسکرول پیوسته برگه‌ها' : 'Continuous Scroll') : (isFa ? 'تک برگه‌ای' : 'Single Sheet')}</span>
          </button>

          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />

          {/* Matrix N-up Grid Preset Selector */}
          <div className="flex items-center gap-0.5 bg-black/5 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700/60 text-xs shrink-0">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 px-1 font-semibold hidden lg:inline">
              {isFa ? 'ماتریس:' : 'Matrix:'}
            </span>
            {[
              { label: '۱×۱', rows: 1, cols: 1 },
              { label: '۲×۱', rows: 2, cols: 1 },
              { label: '۲×۲', rows: 2, cols: 2 },
              { label: '۳×۲', rows: 3, cols: 2 },
              { label: '۴×۲', rows: 4, cols: 2 },
            ].map((m) => {
              const isSelected = isGridEnabled
                ? gridRows === m.rows && gridCols === m.cols
                : m.rows === 1 && m.cols === 1;
              return (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => {
                    if (m.rows === 1 && m.cols === 1) {
                      onChangeSettings({
                        gridLayout: {
                          order: 'rtl-rows',
                          horizontalGapMm: 0,
                          verticalGapMm: 0,
                          marginTopMm: 0,
                          marginBottomMm: 0,
                          marginLeftMm: 0,
                          marginRightMm: 0,
                          cellScalePercent: 100,
                          offsetXPercent: 0,
                          offsetYPercent: 0,
                          showCutMarks: false,
                          ...(settings.gridLayout || {}),
                          enabled: false,
                          rows: 1,
                          cols: 1,
                          repeatPage: false,
                        },
                      });
                      showToast(isFa ? 'حالت تک صفحه (۱×۱) فعال شد' : 'Single page (1x1) enabled');
                    } else {
                      onChangeSettings({
                        gridLayout: {
                          order: 'rtl-rows',
                          horizontalGapMm: 2,
                          verticalGapMm: 2,
                          marginTopMm: 4,
                          marginBottomMm: 4,
                          marginLeftMm: 4,
                          marginRightMm: 4,
                          cellScalePercent: 100,
                          offsetXPercent: 0,
                          offsetYPercent: 0,
                          showCutMarks: true,
                          ...(settings.gridLayout || {}),
                          enabled: true,
                          rows: m.rows,
                          cols: m.cols,
                          repeatPage: true,
                        },
                      });
                      showToast(
                        isFa
                          ? `ماتریس ${m.label} (${m.rows * m.cols} تایی در ۱ صفحه) فعال شد`
                          : `${m.label} Matrix (${m.rows * m.cols} on 1 page) enabled`
                      );
                    }
                  }}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700/60'
                  }`}
                  title={isFa ? `چیدمان ماتریس ${m.label} (${m.rows * m.cols} تایی در یک برگه)` : `${m.label} Matrix on 1 page`}
                >
                  {m.label}
                </button>
              );
            })}

            {/* Matrix Settings Shortcut into Ribbon */}
            {isGridEnabled && (gridRows > 1 || gridCols > 1) && (
              <button
                type="button"
                onClick={() => {
                  onSelectRibbonTab?.('layout');
                  showToast(isFa ? 'تنظیمات ماتریس و سلول‌ها در تب «چیدمان صفحه» ریبون باز شد' : 'Matrix settings opened in Ribbon');
                }}
                className="px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer bg-purple-600/15 text-purple-600 dark:text-purple-400 hover:bg-purple-600/25"
                title={isFa ? 'مشاهده و ویرایش تنظیمات ماتریس در ریبون' : 'View & Edit Matrix in Ribbon'}
              >
                <Sliders className="w-3 h-3" />
                <span className="hidden xl:inline">{isFa ? 'تنظیمات در ریبون' : 'Ribbon Settings'}</span>
              </button>
            )}
          </div>
        </div>

        {/* CENTER: In-Canvas Primary Creative Tools */}
        <div className="flex items-center gap-0.5 bg-black/5 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700/60 shrink-0">
          <button
            type="button"
            onClick={() => {
              onSelectTool('move');
              setIsPageSelected(true);
              setIsSettingsPanelOpen(true);
            }}
            className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              activeTool === 'move'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700/60'
            }`}
            title={isFa ? 'ابزار انتخاب، جابجایی و تغییر اندازه (Move / Transform)' : 'Move & Transform Tool'}
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline text-[11px] font-medium">{isFa ? 'انتخاب' : 'Select'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectTool('crop');
              setIsPageSelected(true);
              setIsSettingsPanelOpen(true);
            }}
            className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              activeTool === 'crop'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700/60'
            }`}
            title={isFa ? 'کادر برش تعاملی دور شکل (Crop)' : 'Interactive Crop'}
          >
            <Crop className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline text-[11px] font-medium">{isFa ? 'برش' : 'Crop'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleAddText();
              setIsPageSelected(true);
              setIsSettingsPanelOpen(true);
            }}
            className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              activeTool === 'text'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700/60'
            }`}
            title={isFa ? 'افزودن متن روی صفحه' : 'Add Text'}
          >
            <Type className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline text-[11px] font-medium">{isFa ? 'متن' : 'Text'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleAddShape();
              setIsPageSelected(true);
              setIsSettingsPanelOpen(true);
            }}
            className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              activeTool === 'shape'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700/60'
            }`}
            title={isFa ? 'درج کادر مستطیل' : 'Add Rectangle Box'}
          >
            <Shapes className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline text-[11px] font-medium">{isFa ? 'کادر' : 'Box'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleAddOrToggleNumbering();
              setIsPageSelected(true);
              setIsSettingsPanelOpen(true);
            }}
            className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              activeTool === 'numbering' || currentAdj.pageNumbering?.enabled
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700/60'
            }`}
            title={isFa ? 'شماره‌زن چاپخانه، قبض و سریال' : 'Receipt Serial & Numbering'}
          >
            <Hash className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline text-[11px] font-medium">{isFa ? 'شماره‌زن' : 'Number'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectTool(activeTool === 'measure' ? 'move' : 'measure');
              setIsPageSelected(true);
            }}
            className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              activeTool === 'measure'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700/60'
            }`}
            title={isFa ? 'خط‌کش و زاویه‌سنج تعاملی' : 'Measure Tool'}
          >
            <RulerIcon className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline text-[11px] font-medium">{isFa ? 'متر' : 'Measure'}</span>
          </button>
        </div>

        {/* LEFT (RTL END): Batch Selection, Zoom & View Tools */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Selected Pages Info for Batch Editing */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs shrink-0">
              <span
                className="px-2 py-0.5 rounded-lg font-bold text-[11px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1"
                title={isFa ? 'تغییرات به تمام صفحات دارای هایلایت پررنگ اعمال می‌شود' : 'Changes apply to selected pages'}
              >
                <Check className="w-3 h-3" />
                <span>
                  {isFa ? `${selectedCount} صفحه انتخاب شده` : `${selectedCount} selected`}
                </span>
              </span>
            </div>
          )}

          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 text-xs bg-black/5 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700/60 shrink-0">
            <button
              type="button"
              onClick={() => onChangeZoom(Math.max(0.35, zoomLevel - 0.1))}
              className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-pointer"
              title={isFa ? 'کوچک‌نمایی' : 'Zoom Out'}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <span className="font-mono text-[11px] w-9 text-center font-bold">
              {Math.round(zoomLevel * 100)}%
            </span>

            <button
              type="button"
              onClick={() => onChangeZoom(Math.min(2.5, zoomLevel + 0.1))}
              className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-pointer"
              title={isFa ? 'بزرگ‌نمایی' : 'Zoom In'}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setViewportPan({ x: 0, y: 0 });
                onChangeZoom(1.0);
              }}
              className="px-1.5 py-0.5 text-[10px] font-mono rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer text-neutral-600 dark:text-neutral-300 font-semibold"
              title={isFa ? 'زوم ۱۰۰٪' : '100% Zoom'}
            >
              100%
            </button>

            <button
              type="button"
              onClick={fitToViewport}
              className="px-1.5 py-0.5 text-[10px] font-sans font-bold rounded bg-blue-600/15 text-blue-600 dark:text-blue-400 hover:bg-blue-600/25 cursor-pointer flex items-center gap-1 transition-colors"
              title={isFa ? 'تنظیم مقیاس برگه برای جاگیری کامل و تمام صفحه در مرکز' : 'Fit Entire Page in View'}
            >
              <Maximize2 className="w-3 h-3" />
              <span>{isFa ? 'جاگیری کامل' : 'Fit Page'}</span>
            </button>
          </div>

          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />

          {/* Canvas Toggles: Snap, Rulers, Margins, Reset */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Snap to Grid and Guidelines */}
            <button
              type="button"
              onClick={() => setSnapToGridAndGuides((prev) => !prev)}
              className={`p-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                snapToGridAndGuides
                  ? 'bg-emerald-600/15 text-emerald-500 font-bold'
                  : 'text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
              }`}
              title={
                isFa
                  ? `چسبیدن به شبکه و خطوط راهنما: ${snapToGridAndGuides ? 'فعال' : 'غیرفعال'}`
                  : `Snap to Grid & Guides: ${snapToGridAndGuides ? 'Enabled' : 'Disabled'}`
              }
            >
              <Magnet className="w-3.5 h-3.5" />
              <span className="hidden xl:inline text-[10px]">
                {snapToGridAndGuides ? (isFa ? 'اسنپ' : 'Snap') : ''}
              </span>
            </button>

            {/* Rulers Toggle */}
            <button
              type="button"
              onClick={onToggleRulers}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                showRulers
                  ? 'bg-blue-600/15 text-blue-500 font-bold'
                  : 'text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
              }`}
              title={isFa ? 'نمایش خط‌کش‌ها به لبه صفحه (سانتی‌متر)' : 'Toggle Rulers (cm)'}
            >
              <RulerIcon className="w-3.5 h-3.5" />
            </button>

            {/* Safe Margins Toggle */}
            <button
              type="button"
              onClick={onToggleMargins}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                showMargins
                  ? 'bg-blue-600/15 text-blue-500 font-bold'
                  : 'text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
              }`}
              title={isFa ? 'نمایش خطوط امن چاپ و شیرازه' : 'Toggle Safe Margins & Gutter'}
            >
              <Scissors className="w-3.5 h-3.5" />
            </button>

            {/* Fit View / Reset Pan button */}
            {(viewportPan.x !== 0 || viewportPan.y !== 0 || zoomLevel !== 1) && (
              <button
                type="button"
                onClick={() => {
                  setViewportPan({ x: 0, y: 0 });
                  onChangeZoom(1.0);
                }}
                className="px-2 py-0.5 text-[10px] rounded bg-blue-600/15 text-blue-500 hover:bg-blue-600 hover:text-white cursor-pointer font-sans transition-colors"
                title={isFa ? 'تنظیم به مرکز نما' : 'Fit View'}
              >
                {isFa ? 'مرکز نما' : 'Fit'}
              </button>
            )}

            {/* Reset All to Defaults button */}
            <button
              type="button"
              onClick={handleResetAllToDefaults}
              className="p-1.5 rounded-md transition-colors cursor-pointer text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center gap-1 text-xs"
              title={isFa ? 'بازنشانی تمام تنظیمات، مقیاس، برش، ماتریس و المان‌ها به حالت اولیه پیش‌فرض' : 'Reset all settings to defaults'}
            >
              <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden xl:inline text-[10px] font-semibold text-rose-400">
                {isFa ? 'بازنشانی' : 'Reset'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. CENTRAL WORKBENCH VIEWPORT */}
      <div
        ref={canvasContainerRef}
        onPointerDown={(e) => {
          // If holding Space or middle mouse button (button === 1), start panning
          if (isSpacePressed || e.button === 1) {
            e.preventDefault();
            e.stopPropagation();
            setIsPanning(true);
            panStartRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              initPanX: viewportPan.x,
              initPanY: viewportPan.y,
            };
            return;
          }
        }}
        onClick={(e) => {
          // If clicked empty canvas background:
          // Deactivate 8-point selection tool and close floating settings windows
          if (e.target === canvasContainerRef.current) {
            setIsPageSelected(false);
            setIsSettingsPanelOpen(false);
            setSelectedTextId(null);
            setSelectedShapeId(null);
            setSelectedNumberingId(null);
            if (activeTool !== 'crop' && activeTool !== 'measure') {
              onSelectTool('move');
            }
          }
        }}
        className={`flex-1 flex flex-col overflow-y-auto overflow-x-auto relative items-center ${
          viewScrollMode === 'single'
            ? 'justify-center min-h-full py-6'
            : isContentCentered
              ? 'justify-center min-h-full py-12'
              : 'justify-start py-12'
        } px-12 bg-neutral-950/20 dark:bg-black/40 gap-10 scroll-smooth ${
          isSpacePressed ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
      >
        {/* Spacebar Pan Mode Active Badge */}
        {isSpacePressed && (
          <div className="absolute top-4 start-1/2 -translate-x-1/2 bg-blue-600/95 text-white text-xs px-3.5 py-1 rounded-full shadow-xl z-50 pointer-events-none flex items-center gap-1.5 backdrop-blur-xs font-semibold animate-pulse">
            <Hand className="w-3.5 h-3.5" />
            <span>{isFa ? 'حالت جابجایی دید (با درگ ماوس جابجا کنید)' : 'Pan Mode (Drag to move view)'}</span>
          </div>
        )}

        {/* Empty State */}
        {flatPages.length === 0 ? (
          <div className="text-center p-8 max-w-sm border-2 border-dashed border-neutral-300 dark:border-neutral-800 rounded-2xl">
            <UploadCloud className="w-12 h-12 text-blue-500 mx-auto mb-3 opacity-80" />
            <h3 className="font-bold text-sm mb-1">{isFa ? 'هیچ فایلی بارگذاری نشده است' : 'No Files Loaded'}</h3>
            <p className="text-xs text-neutral-400 mb-4">
              {isFa
                ? 'فایل‌های PDF یا تصاویر خود را بکشید یا دکمه زیر را فشار دهید'
                : 'Drag and drop PDF files or click below'}
            </p>
            <div className="flex items-center justify-center gap-2">
              <label className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs">
                <span>{isFa ? 'انتخاب فایل' : 'Choose Files'}</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={(e) => {
                    if (e.target.files) onFilesSelected(Array.from(e.target.files));
                  }}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={onLoadSamples}
                className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isFa ? 'فایل تستی' : 'Sample'}</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ========================================================= */}
            {/* UNIFIED LIVE PRINT & IMPOSITION WORKBENCH CANVAS          */}
            {/* ========================================================= */}
            <div
              style={{
                transform: `translate(${viewportPan.x}px, ${viewportPan.y}px) scale(${zoomLevel})`,
                transformOrigin: 'top center',
                transition: isPanning ? 'none' : 'transform 0.08s ease-out',
              }}
              className={`relative inline-flex flex-col items-center gap-10 select-none pb-16 ${
                shouldCenterContentVertically ? 'my-auto' : ''
              }`}
            >
              {sheetsToRender.map((sIdx) => {
                const sPages = getSheetPages(sIdx);
                const isCurrentSheet = sIdx === currentSheetIndex;

                return (
                  <div
                    key={`sheet-${sIdx}`}
                    id={`sheet-${sIdx}`}
                    onClick={() => {
                      setCurrentSheetIndex(sIdx);
                      const firstPage = sPages.find(Boolean);
                      if (firstPage) {
                        onSelectGlobalPage(firstPage.globalIndex);
                        onSelectPageForEdit(firstPage.globalIndex, firstPage.item, firstPage.pageNum, false);
                      }
                    }}
                    className={`flex flex-col items-center transition-all ${
                      isCurrentSheet ? 'z-20 scale-[1.005]' : 'z-10 opacity-95 hover:opacity-100'
                    }`}
                  >
                    {/* Sheet Header Label Badge */}
                    <div className={`w-full flex items-center justify-between px-3 py-1.5 rounded-t-xl text-xs font-mono font-bold shadow-xs border ${
                      isCurrentSheet
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{isFa ? `برگه شماره ${sIdx + 1} از ${totalSheets}` : `Sheet ${sIdx + 1} of ${totalSheets}`}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-sans">
                        {sPages.filter(Boolean).length > 0 && (
                          <span>
                            {isFa
                              ? `صفحه‌ها: ${sPages.filter(Boolean).map((p) => p?.pageNum).join(', ')}`
                              : `Pages: ${sPages.filter(Boolean).map((p) => p?.pageNum).join(', ')}`}
                          </span>
                        )}
                        {isCurrentSheet && (
                          <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px]">
                            {isFa ? 'برگه فعال جهت ویرایش' : 'Active Sheet'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* TOP BAR: Horizontal Ruler */}
                    {showRulers && (
                      <div className="flex items-center">
                        <div
                          style={{ width: '26px', height: '26px' }}
                          className={`border-b border-r shrink-0 flex items-center justify-center font-mono text-[9px] font-bold ${
                            isDark
                              ? 'bg-neutral-900 border-neutral-750 text-neutral-400'
                              : 'bg-slate-200 border-slate-300 text-slate-600'
                          }`}
                          title={isFa ? 'واحد خط‌کش: سانتی‌متر (cm)' : 'Ruler Unit: Centimeters (cm)'}
                        >
                          cm
                        </div>
                        <div style={{ width: `${sheetW}px`, height: '26px' }} className="relative z-30">
                          <Ruler
                            orientation="horizontal"
                            lengthMm={effectiveWidthMm}
                            cropStartPercent={currentAdj.crop?.left || 0}
                            cropEndPercent={100 - (currentAdj.crop?.right || 0)}
                            theme={theme}
                            onAddGuideline={(type, pos) => {
                              setGuidelines((prev) => [
                                ...prev,
                                {
                                  id: `guide-${Date.now()}`,
                                  type,
                                  positionPercent: pos,
                                },
                              ]);
                              showToast(isFa ? 'خط راهنمای عمودی اضافه شد' : 'Vertical guideline added');
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* MAIN ROW: Vertical Ruler + Physical Paper Canvas */}
                    <div className="flex items-start">
                      {showRulers && (
                        <div style={{ width: '26px', height: `${sheetH}px` }} className="relative z-30 shrink-0">
                          <Ruler
                            orientation="vertical"
                            lengthMm={effectiveHeightMm}
                            cropStartPercent={currentAdj.crop?.top || 0}
                            cropEndPercent={100 - (currentAdj.crop?.bottom || 0)}
                            theme={theme}
                            onAddGuideline={(type, pos) => {
                              setGuidelines((prev) => [
                                ...prev,
                                {
                                  id: `guide-${Date.now()}`,
                                  type,
                                  positionPercent: pos,
                                },
                              ]);
                              showToast(isFa ? 'خط راهنمای افقی اضافه شد' : 'Horizontal guideline added');
                            }}
                          />
                        </div>
                      )}

                      {/* Paper Canvas Frame */}
                      <div
                        ref={isCurrentSheet ? pageImageRef : undefined}
                        onClick={(e) => {
                          setIsPageSelected(true);
                          setIsSettingsPanelOpen(false);
                        }}
                        onDoubleClick={(e) => {
                          setIsPageSelected(true);
                          setIsSettingsPanelOpen(true);
                          onSelectTool('move');
                        }}
                        style={{
                          width: `${sheetW}px`,
                          height: `${sheetH}px`,
                          backgroundColor: '#ffffff',
                        }}
                        className={`relative text-slate-900 rounded-b-xs shadow-[0_20px_60px_rgba(0,0,0,0.45)] border ${
                          isCurrentSheet
                            ? 'border-blue-500 ring-2 ring-blue-500/40'
                            : 'border-slate-300 dark:border-neutral-700'
                        } overflow-hidden cursor-default`}
                      >
                        {/* Cut Marks */}
                        {Boolean(settings.gridLayout?.showCutMarks) && (
                          <>
                            <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-slate-700 pointer-events-none z-30" />
                            <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-slate-700 pointer-events-none z-30" />
                            <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-slate-700 pointer-events-none z-30" />
                            <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-slate-700 pointer-events-none z-30" />
                          </>
                        )}

                        {/* Content rendering (Grid or Single Page) */}
                        {isGridEnabled && (gridRows > 1 || gridCols > 1) ? (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'grid',
                              gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                              gap: '2px',
                              backgroundColor: isDark ? '#1e293b' : '#cbd5e1',
                            }}
                            className="w-full h-full p-0.5"
                          >
                            {Array.from({ length: cellsPerSheet }).map((_, cellIdx) => {
                              const override = settings.gridLayout?.customCellOverrides?.[cellIdx];
                              const isSelectedCell = isCurrentSheet && effectiveCellIndices.includes(cellIdx);
                              const isPrimarySelected = isCurrentSheet && effectiveCellIndices[0] === cellIdx;

                              const cellPage = settings.gridLayout?.repeatPage
                                ? currentPageInfo
                                : (sPages[cellOrderIndices[cellIdx] ?? cellIdx] || currentPageInfo);
                              const cellImgSrc = (cellPage ? sheetRenderCache[`${cellPage.item.id}_${cellPage.pageNum}`] : null) || (cellPage?.globalIndex === currentPageInfo?.globalIndex ? hiresImg : null);
                              const pageAdj = (cellPage ? cellPage.item.pageAdjustments?.[cellPage.pageNum] : null) || currentAdj;

                              const cellScale = ((pageAdj.scale || 100) * ((override?.scalePercent ?? 100) / 100)) / 100;
                              const cellOffX = (pageAdj.offsetX || 0) + (override?.offsetXPercent || 0);
                              const cellOffY = (pageAdj.offsetY || 0) + (override?.offsetYPercent || 0);
                              const cellRot = totalRotation + (override?.rotation || 0) + (override?.fineAngle || 0);
                              const cellCrop = override?.crop || pageAdj.crop;
                              const hasCellCrop = Boolean(cellCrop && (cellCrop.top > 0 || cellCrop.bottom > 0 || cellCrop.left > 0 || cellCrop.right > 0));
                              const isCellHidden = Boolean(override?.hidden);
                              const hasCellBorder = Boolean(override?.border);

                              const effectiveBrightness = ((override?.brightness ?? pageAdj.brightness ?? 100) / 100) * 100;
                              const effectiveContrast = ((override?.contrast ?? pageAdj.contrast ?? 100) / 100) * 100;
                              const isGrayscale = Boolean(pageAdj.grayscale || override?.grayscale);
                              const isInvert = Boolean(pageAdj.invert || override?.invert);
                              const isThreshold = Boolean(pageAdj.threshold || override?.threshold);

                              const cellFilter = [
                                `brightness(${effectiveBrightness}%)`,
                                `contrast(${effectiveContrast}%)`,
                                isGrayscale ? 'grayscale(100%)' : '',
                                isInvert ? 'invert(100%)' : '',
                                isThreshold ? 'contrast(220%) grayscale(100%)' : '',
                              ].filter(Boolean).join(' ');

                              return (
                                <div
                                  key={cellIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentSheetIndex(sIdx);
                                    if (cellPage) {
                                      onSelectGlobalPage(cellPage.globalIndex);
                                      onSelectPageForEdit(cellPage.globalIndex, cellPage.item, cellPage.pageNum, false);
                                    }
                                    onSelectCell(cellIdx, e.shiftKey || e.ctrlKey || e.metaKey);
                                    setIsPageSelected(true);
                                  }}
                                  className={`w-full h-full relative overflow-hidden bg-white flex items-center justify-center cursor-pointer transition-all ${
                                    isSelectedCell
                                      ? 'ring-2 ring-blue-500 ring-offset-2 z-20 shadow-lg'
                                      : 'border border-dashed border-slate-300 dark:border-neutral-700 hover:border-blue-400'
                                  } ${hasCellBorder ? 'border-2 border-slate-900' : ''}`}
                                >
                                  {!isCellHidden && cellImgSrc ? (
                                    <div
                                      style={{
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        clipPath: hasCellCrop
                                          ? `inset(${cellCrop?.top || 0}% ${cellCrop?.right || 0}% ${cellCrop?.bottom || 0}% ${cellCrop?.left || 0}%)`
                                          : 'none',
                                        transform: `translate(${cellOffX}%, ${cellOffY}%) rotate(${cellRot}deg) scale(${cellScale})`,
                                        transformOrigin: 'center center',
                                      }}
                                    >
                                      <img
                                        src={cellImgSrc}
                                        alt={`Matrix cell ${cellIdx + 1}`}
                                        style={{ filter: cellFilter }}
                                        className="max-w-full max-h-full object-contain pointer-events-none select-none"
                                      />
                                    </div>
                                  ) : isCellHidden ? (
                                    <div className="text-[10px] text-slate-300 font-mono italic">
                                      {isFa ? 'مخفی' : 'Hidden'}
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-slate-300 font-mono">#{cellIdx + 1}</div>
                                  )}

                                  {!isCellHidden && (
                                    <OverlayElementsLayer
                                      adjustment={pageAdj}
                                      pageNum={cellPage?.pageNum || 1}
                                      totalPages={cellPage?.totalPages || currentPageInfo?.totalPages || 1}
                                      activeTool="move"
                                      selectedTextId={null}
                                      selectedShapeId={null}
                                      selectedNumberingId={null}
                                      onSelectText={() => {}}
                                      onSelectShape={() => {}}
                                      onSelectNumbering={() => {}}
                                      onSelectTool={() => {}}
                                      onUpdateText={() => {}}
                                      onUpdateShape={() => {}}
                                      onUpdateNumbering={() => {}}
                                      onDuplicateText={handleDuplicateText}
                                      onDuplicateShape={handleDuplicateShape}
                                      onDuplicateNumbering={handleDuplicateNumbering}
                                    />
                                  )}

                                  {isPrimarySelected && activeTool === 'move' && isPageSelected && (
                                    <InteractiveTransformBox
                                      offsetX={override?.offsetXPercent || 0}
                                      offsetY={override?.offsetYPercent || 0}
                                      scale={override?.scalePercent || 100}
                                      rotation={(override?.rotation || 0) + (override?.fineAngle || 0)}
                                      crop={cellCrop}
                                      snapToGrid={snapToGridAndGuides}
                                      guidelines={guidelines}
                                      onChange={(updates) => {
                                        updateCellOverride(effectiveCellIndices, {
                                          ...(updates.offsetX !== undefined ? { offsetXPercent: updates.offsetX } : {}),
                                          ...(updates.offsetY !== undefined ? { offsetYPercent: updates.offsetY } : {}),
                                          ...(updates.scale !== undefined ? { scalePercent: updates.scale } : {}),
                                        });
                                      }}
                                    />
                                  )}

                                  {isPrimarySelected && activeTool === 'crop' && isPageSelected && (
                                    <InteractiveCropBox
                                      crop={cellCrop}
                                      onChange={(newCrop) => {
                                        updateCellOverride(effectiveCellIndices, { crop: newCrop });
                                      }}
                                      snapToGrid={snapToGridAndGuides}
                                      guidelines={guidelines}
                                    />
                                  )}

                                  <div
                                    className={`absolute top-1 end-1 text-[9px] font-mono px-1.5 py-0.5 rounded shadow-xs pointer-events-none flex items-center gap-1 z-30 ${
                                      isSelectedCell
                                        ? 'bg-blue-600 text-white font-bold'
                                        : 'bg-white/90 dark:bg-black/80 text-slate-600 dark:text-neutral-300 border border-slate-300 dark:border-neutral-700'
                                    }`}
                                  >
                                    <span>{isSelectedCell ? `✓ خانه #${cellIdx + 1}` : `#${cellIdx + 1}`}</span>
                                    {override && !isSelectedCell && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          (() => {
                            const sheetPage = sPages[0] || currentPageInfo;
                            const sheetPageImg = (sheetPage ? sheetRenderCache[`${sheetPage.item.id}_${sheetPage.pageNum}`] : null) || hiresImg;
                            const pageAdj = sheetPage?.adjustment || currentAdj;

                            return sheetPageImg ? (
                              <div
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  position: 'relative',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    clipPath: hasCrop
                                      ? `inset(${cropTop}% ${cropRight}% ${cropBottom}% ${cropLeft}%)`
                                      : 'none',
                                    transform: `translate(${pageOffX}%, ${pageOffY}%) rotate(${totalRotation}deg) scale(${pageScalePct})`,
                                    transformOrigin: 'center center',
                                    transition: 'transform 0.08s ease-out',
                                  }}
                                  className="p-1"
                                >
                                  <img
                                    src={sheetPageImg}
                                    alt={`Studio page canvas ${sIdx + 1}`}
                                    style={{ filter: workbenchFilter }}
                                    className="max-w-full max-h-full object-contain pointer-events-none select-none"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                                <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs font-mono">
                                  {isFa ? 'در حال بارگذاری برگه...' : 'Rendering sheet...'}
                                </span>
                              </div>
                            );
                          })()
                        )}

                        {/* Transform & Crop Tool Overlays for active sheet */}
                        {isCurrentSheet && activeTool === 'move' && isPageSelected && !(isGridEnabled && (gridRows > 1 || gridCols > 1)) && (
                          <InteractiveTransformBox
                            offsetX={currentAdj.offsetX || 0}
                            offsetY={currentAdj.offsetY || 0}
                            scale={currentAdj.scale || 100}
                            rotation={totalRotation}
                            crop={currentAdj.crop}
                            pageWidthMm={210}
                            pageHeightMm={297}
                            snapToGrid={snapToGridAndGuides}
                            guidelines={guidelines}
                            onChange={(updates) => updateCurrentAdj(updates)}
                          />
                        )}

                        {isCurrentSheet && activeTool === 'crop' && (
                          <InteractiveCropBox
                            crop={currentAdj.crop}
                            onChange={(newCrop) => updateCurrentAdj({ crop: newCrop })}
                            pageWidthMm={210}
                            pageHeightMm={297}
                            transform={{
                              offsetX: pageOffX,
                              offsetY: pageOffY,
                              scale: currentAdj.scale || 100,
                              rotation: totalRotation,
                            }}
                            snapToGrid={snapToGridAndGuides}
                            guidelines={guidelines}
                          />
                        )}

                        {/* Overlays Layer */}
                        <OverlayElementsLayer
                          adjustment={isCurrentSheet ? currentAdj : (sPages[0]?.adjustment || currentAdj)}
                          pageNum={sPages[0]?.pageNum || 1}
                          totalPages={sPages[0]?.totalPages || currentPageInfo?.totalPages || 1}
                          activeTool={activeTool}
                          selectedTextId={isCurrentSheet ? selectedTextId : null}
                          selectedShapeId={isCurrentSheet ? selectedShapeId : null}
                          selectedNumberingId={isCurrentSheet ? selectedNumberingId : null}
                          onSelectText={(id) => {
                            setCurrentSheetIndex(sIdx);
                            setSelectedTextId(id);
                            setIsPageSelected(true);
                          }}
                          onSelectShape={(id) => {
                            setCurrentSheetIndex(sIdx);
                            setSelectedShapeId(id);
                            setIsPageSelected(true);
                          }}
                          onSelectNumbering={(id) => {
                            setCurrentSheetIndex(sIdx);
                            setSelectedNumberingId(id);
                            setIsPageSelected(true);
                          }}
                          onSelectTool={(tool) => {
                            onSelectTool(tool);
                            setIsSettingsPanelOpen(true);
                          }}
                          onUpdateText={handleUpdateText}
                          onUpdateShape={handleUpdateShape}
                          onUpdateNumbering={handleUpdateNumbering}
                          onDuplicateText={handleDuplicateText}
                          onDuplicateShape={handleDuplicateShape}
                          onDuplicateNumbering={handleDuplicateNumbering}
                          onDoubleClickElement={(type, id) => {
                            setCurrentSheetIndex(sIdx);
                            setIsPageSelected(true);
                            setIsSettingsPanelOpen(true);
                            if (type === 'text') {
                              setSelectedTextId(id);
                              onSelectTool('text');
                            } else if (type === 'shape') {
                              setSelectedShapeId(id);
                              onSelectTool('shape');
                            } else if (type === 'numbering') {
                              setSelectedNumberingId(id);
                              onSelectTool('numbering');
                            }
                          }}
                          snapToGrid={snapToGridAndGuides}
                          guidelines={guidelines}
                        />

                        {/* Margin Guides */}
                        <InteractiveMarginGuides
                          settings={settings}
                          onChangeSettings={onChangeSettings}
                          pageWidthMm={210}
                          pageHeightMm={297}
                          isDark={isDark}
                          isFa={isFa}
                          showMargins={showMargins}
                        />

                        {/* Spine / Gutter */}
                        {Boolean(settings.gutterMm && settings.gutterMm > 0) && (
                          <div
                            style={{
                              width: `${Math.min(30, ((settings.gutterMm || 0) / 210) * 100)}%`,
                              right: 0,
                            }}
                            className="absolute top-0 bottom-0 bg-amber-500/15 border-l-2 border-dashed border-amber-500/80 z-20 pointer-events-none flex flex-col items-center justify-center select-none"
                          >
                            <div className="flex flex-col items-center justify-around h-full py-6">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-600/80" />
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-600/80" />
                              <span className="text-[9px] font-mono font-bold text-amber-700 dark:text-amber-300 rotate-90 whitespace-nowrap bg-white/90 dark:bg-black/80 px-1 py-0.5 rounded shadow-xs">
                                {isFa ? `شیرازه ${settings.gutterMm}mm` : `Spine ${settings.gutterMm}mm`}
                              </span>
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-600/80" />
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-600/80" />
                            </div>
                          </div>
                        )}

                        {/* Safe Margins */}
                        {showMargins && (
                          <div
                            style={{
                              right: `${
                                Boolean(settings.gutterMm && settings.gutterMm > 0)
                                  ? Math.min(30, ((settings.gutterMm || 0) / 210) * 100) + 3
                                  : 5
                              }%`,
                              left: '5%',
                              top: '5%',
                              bottom: '5%',
                            }}
                            className="absolute border border-dashed border-blue-500/60 pointer-events-none z-15 flex flex-col justify-between"
                          >
                            <div className="flex justify-between p-1 text-[8px] font-mono text-blue-600 bg-white/80">
                              <span>210 mm</span>
                              <span>{isFa ? 'حاشیه امن چاپ' : 'Print Safe Area'}</span>
                            </div>
                            <div className="flex justify-between p-1 text-[8px] font-mono text-blue-600 bg-white/80">
                              <span>{isFa ? 'برش گیوتین' : 'Trim Margin'}</span>
                              <span>297 mm</span>
                            </div>
                          </div>
                        )}

                        {/* Guidelines */}
                        <GuidelinesLayer
                          guidelines={guidelines}
                          pageWidthMm={210}
                          pageHeightMm={297}
                          theme={theme}
                          onDeleteGuideline={(id: string) =>
                            setGuidelines((prev) => prev.filter((g) => g.id !== id))
                          }
                          onUpdateGuideline={(id: string, pos: number) =>
                            setGuidelines((prev) =>
                              prev.map((g) => (g.id === id ? { ...g, positionPercent: pos } : g))
                            )
                          }
                        />

                        {/* Measure Tool */}
                        {isCurrentSheet && activeTool === 'measure' && (
                          <MeasureToolLayer
                            activeTool={activeTool}
                            pageWidthMm={210}
                            pageHeightMm={297}
                            theme={theme}
                            measureLine={measureLine}
                            onChangeMeasureLine={setMeasureLine}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </>
        )}
      </div>

      {/* 3. BOTTOM WORKBENCH BAR: PAGE NAV & ACTIONS */}
      <div
        className={`h-10 border-t flex items-center justify-between px-4 text-xs shrink-0 select-none z-20 ${
          isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-300 shadow-xs'
        }`}
      >
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-400 hidden sm:inline">
            {isFa ? 'پیمایش صفحات:' : 'Page Navigation:'}
          </span>
          <button
            type="button"
            disabled={activeGlobalPageIndex <= 0}
            onClick={() => {
              const targetIdx = Math.max(0, activeGlobalPageIndex - 1);
              onSelectGlobalPage(targetIdx);
              const targetPage = flatPages[targetIdx];
              if (targetPage) {
                onSelectPageForEdit(targetIdx, targetPage.item, targetPage.pageNum, false);
              }
            }}
            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30 cursor-pointer"
            title={isFa ? 'صفحه قبلی' : 'Previous Page'}
          >
            {isFa ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <span className="font-mono font-bold px-2 py-0.5 rounded bg-black/10 dark:bg-neutral-800">
            {currentPageInfo ? currentPageInfo.pageNum : 1} / {currentPageInfo ? currentPageInfo.totalPages : 1}
          </span>

          <button
            type="button"
            disabled={activeGlobalPageIndex >= flatPages.length - 1}
            onClick={() => {
              const targetIdx = Math.min(flatPages.length - 1, activeGlobalPageIndex + 1);
              onSelectGlobalPage(targetIdx);
              const targetPage = flatPages[targetIdx];
              if (targetPage) {
                onSelectPageForEdit(targetIdx, targetPage.item, targetPage.pageNum, false);
              }
            }}
            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30 cursor-pointer"
            title={isFa ? 'صفحه بعدی' : 'Next Page'}
          >
            {isFa ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {currentPageInfo && (
            <span className="text-[11px] text-neutral-400 max-w-[140px] truncate hidden md:inline">
              ({currentPageInfo.item.name})
            </span>
          )}
        </div>

        {/* Quick Page Actions Right In-Place (Arbitrary Duplicate & Blank page insertion) */}
        {currentPageInfo && (
          <div className="flex items-center gap-1.5">
            {/* Rotate Page 90 deg */}
            <button
              type="button"
              onClick={() => {
                const cur = currentAdj.rotation || 0;
                updateCurrentAdj({ rotation: (cur + 90) % 360 });
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-xs font-semibold cursor-pointer"
              title={isFa ? 'چرخش ۹۰ درجه صفحات انتخاب شده' : 'Rotate Selected Pages 90 deg'}
            >
              <RotateCw className="w-3.5 h-3.5 text-blue-500" />
              <span>{isFa ? 'چرخش' : 'Rotate'}</span>
            </button>

            {/* Duplicate Page In-Place with arbitrary count */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setPageActionPopover((p) => (p === 'duplicate' ? null : 'duplicate'))}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-xs font-semibold cursor-pointer"
                title={isFa ? 'تکثیر برگه به تعداد دلخواه' : 'Duplicate page arbitrary count'}
              >
                <Copy className="w-3.5 h-3.5 text-emerald-500" />
                <span>{isFa ? 'تکثیر برگه' : 'Duplicate'}</span>
              </button>

              {pageActionPopover === 'duplicate' && (
                <div
                  className={`absolute bottom-full end-0 mb-2 w-64 p-3.5 rounded-xl border shadow-2xl z-50 ${
                    isDark ? 'bg-neutral-900 border-neutral-750 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <div className="font-bold text-xs mb-2 flex items-center justify-between">
                    <span>{isFa ? 'تکثیر برگه به تعداد دلخواه' : 'Duplicate Page'}</span>
                    <button
                      type="button"
                      onClick={() => setPageActionPopover(null)}
                      className="text-neutral-400 hover:text-white"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] text-neutral-400">{isFa ? 'تعداد کپی:' : 'Copies:'}</span>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={duplicateCopies}
                      onChange={(e) => setDuplicateCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-20 px-2 py-1 text-center font-mono rounded border border-neutral-700 bg-neutral-800 text-white text-xs font-bold"
                    />
                  </div>
                  {/* Presets */}
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 5, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setDuplicateCopies(num)}
                        className={`flex-1 py-0.5 text-[10px] rounded border cursor-pointer ${
                          duplicateCopies === num
                            ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                            : 'border-neutral-700 hover:bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={isModifyingPdf}
                    onClick={handleConfirmDuplicate}
                    className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {isModifyingPdf ? (isFa ? 'در حال اعمال...' : 'Processing...') : isFa ? 'تایید و تکثیر' : 'Confirm'}
                  </button>
                </div>
              )}
            </div>

            {/* Insert Blank Page In-Place with arbitrary count */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setPageActionPopover((p) => (p === 'blank' ? null : 'blank'))}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-xs font-semibold cursor-pointer"
                title={isFa ? 'درج صفحه سفید به تعداد دلخواه' : 'Insert Blank Pages'}
              >
                <PlusCircle className="w-3.5 h-3.5 text-blue-500" />
                <span>{isFa ? 'صفحه سفید' : 'Blank Page'}</span>
              </button>

              {pageActionPopover === 'blank' && (
                <div
                  className={`absolute bottom-full end-0 mb-2 w-64 p-3.5 rounded-xl border shadow-2xl z-50 ${
                    isDark ? 'bg-neutral-900 border-neutral-750 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <div className="font-bold text-xs mb-2 flex items-center justify-between">
                    <span>{isFa ? 'درج برگه سفید به تعداد دلخواه' : 'Insert Blank Pages'}</span>
                    <button
                      type="button"
                      onClick={() => setPageActionPopover(null)}
                      className="text-neutral-400 hover:text-white"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] text-neutral-400">{isFa ? 'تعداد برگه:' : 'Pages:'}</span>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={blankCopies}
                      onChange={(e) => setBlankCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-20 px-2 py-1 text-center font-mono rounded border border-neutral-700 bg-neutral-800 text-white text-xs font-bold"
                    />
                  </div>
                  {/* Presets */}
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 5, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setBlankCopies(num)}
                        className={`flex-1 py-0.5 text-[10px] rounded border cursor-pointer ${
                          blankCopies === num
                            ? 'bg-blue-600 text-white border-blue-600 font-bold'
                            : 'border-neutral-700 hover:bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={isModifyingPdf}
                    onClick={handleConfirmInsertBlank}
                    className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {isModifyingPdf ? (isFa ? 'در حال درج...' : 'Processing...') : isFa ? 'تایید و درج' : 'Confirm'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
