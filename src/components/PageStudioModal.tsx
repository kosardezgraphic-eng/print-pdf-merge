import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sun,
  Crop,
  Check,
  RotateCw,
  Eye,
  CheckSquare,
  Square,
  Contrast,
  RefreshCw,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Scissors,
  CheckCheck,
  MousePointer,
  HelpCircle,
  Grid,
  Compass,
  RotateCcw,
  Move,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Type,
  Hash,
  Shapes,
  Copy,
  PlusCircle,
  Trash2,
  AlignRight,
  AlignCenter,
  AlignLeft,
  Bold,
  Italic,
  Underline,
  Link2,
} from 'lucide-react';
import {
  Language,
  PDFItem,
  PageAdjustment,
  PageOverlayText,
  PageOverlayShape,
  PageOverlayNumbering,
  ShapeType,
  CanvasGuideline,
} from '../types';
import { translations } from '../utils/translations';
import { renderPdfPageToDataUrl, defaultAdjustment } from '../utils/pdfRenderUtils';
import { parsePageRange } from '../utils/pdfUtils';
import { Ruler } from './Ruler';
import { GuidelinesLayer } from './GuidelinesLayer';
import { MeasureToolLayer, MeasureLine } from './MeasureToolLayer';
import { InteractiveCropBox } from './InteractiveCropBox';
import { InteractiveTransformBox } from './InteractiveTransformBox';
import { OverlayElementsLayer } from './OverlayElementsLayer';
import { TextControlPanel } from './TextControlPanel';
import { ShapeControlPanel } from './ShapeControlPanel';
import { PageNumberingPanel } from './PageNumberingPanel';
import { PageDuplicateModal } from './PageDuplicateModal';
import { duplicatePdfPage, insertBlankPdfPage } from '../utils/pdfPageModifier';

interface PageStudioModalProps {
  item: PDFItem;
  lang: Language;
  theme: 'dark' | 'light';
  onClose: () => void;
  onSaveAdjustments: (itemId: string, adjustments: Record<number, PageAdjustment>) => void;
  onUpdatePdfItem?: (updatedItem: PDFItem) => void;
}

export const PageStudioModal: React.FC<PageStudioModalProps> = ({
  item,
  lang,
  theme,
  onClose,
  onSaveAdjustments,
  onUpdatePdfItem,
}) => {
  const t = translations[lang];
  const isDark = theme === 'dark';
  const totalPages = item.pageCount || 1;

  // Active focused page in the main enlarged workbench (1-based)
  const [activePage, setActivePage] = useState<number>(1);
  const [lastClickedPage, setLastClickedPage] = useState<number>(1);

  // Multi-selection of pages for batch adjustments
  const [selectedPages, setSelectedPages] = useState<Set<number>>(() => {
    return new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
  });

  // Real-time simultaneous auto-sync to all selected pages
  const [autoSyncToSelected, setAutoSyncToSelected] = useState<boolean>(true);

  // Map of page adjustments
  const [adjustments, setAdjustments] = useState<Record<number, PageAdjustment>>(() => {
    const initial: Record<number, PageAdjustment> = {};
    for (let p = 1; p <= totalPages; p++) {
      initial[p] = item.pageAdjustments?.[p]
        ? { ...item.pageAdjustments[p] }
        : { ...defaultAdjustment };
    }
    return initial;
  });

  // Thumbnails cache (low-res)
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  // Enlarged high-res workbench cache
  const [highResCache, setHighResCache] = useState<Record<number, string>>({});
  const [loadingActivePage, setLoadingActivePage] = useState(false);

  // Workbench zoom
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // Active Tool: 'move' | 'crop' | 'text' | 'shape' | 'numbering' | 'measure'
  const [activeTool, setActiveTool] = useState<'move' | 'crop' | 'text' | 'shape' | 'numbering' | 'measure'>('move');

  // Measure Ruler Line State
  const [measureLine, setMeasureLine] = useState<MeasureLine | null>(null);
  
  // Selected Text, Shape, and Page Numbering IDs
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedNumberingId, setSelectedNumberingId] = useState<string | null>(null);

  // Custom Range Input
  const [customRangeText, setCustomRangeText] = useState<string>('');

  // Duplicate / Blank Page Modal state
  const [duplicateModalState, setDuplicateModalState] = useState<{
    open: boolean;
    mode: 'duplicate' | 'blank';
  }>({ open: false, mode: 'duplicate' });

  // Interactive Guidelines (cyan lines dragged from ruler)
  const [guidelines, setGuidelines] = useState<CanvasGuideline[]>([]);

  const handleAddGuideline = (type: 'horizontal' | 'vertical', posPercent: number) => {
    const newGuide: CanvasGuideline = {
      id: `guide-${Date.now()}`,
      type,
      positionPercent: posPercent,
      color: '#06b6d4',
    };
    setGuidelines((prev) => [...prev, newGuide]);
  };

  const handleUpdateGuideline = (id: string, newPosPercent: number) => {
    setGuidelines((prev) =>
      prev.map((g) => (g.id === id ? { ...g, positionPercent: newPosPercent } : g))
    );
  };

  const handleDeleteGuideline = (id: string) => {
    setGuidelines((prev) => prev.filter((g) => g.id !== id));
  };

  const handleApplyCustomRange = () => {
    if (!customRangeText.trim()) return;
    const zeroBased = parsePageRange(customRangeText, totalPages);
    const oneBased = new Set(zeroBased.map((idx) => idx + 1));
    setSelectedPages(oneBased);
  };
  const [isModifyingPdf, setIsModifyingPdf] = useState(false);

  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const imageDragRafRef = useRef<number | null>(null);
  const dragImageStartRef = useRef<{
    startX: number;
    startY: number;
    initOffsetX: number;
    initOffsetY: number;
    boxW: number;
    boxH: number;
  }>({
    startX: 0,
    startY: 0,
    initOffsetX: 0,
    initOffsetY: 0,
    boxW: 1,
    boxH: 1,
  });

  // Current active page adjustment
  const currentAdj = adjustments[activePage] || defaultAdjustment;
  const totalPageAngle = (currentAdj.rotation || 0) + (currentAdj.fineAngle || 0);

  // Standard A4 dimensions in mm
  const pageWidthMm = 210;
  const pageHeightMm = 297;

  // Load low-res thumbnails for sidebar gallery
  useEffect(() => {
    let isCancelled = false;

    async function loadAllThumbnails() {
      for (let p = 1; p <= totalPages; p++) {
        if (isCancelled) break;
        try {
          const res = await renderPdfPageToDataUrl(item.file, p, 0.35);
          if (!isCancelled) {
            setThumbnails((prev) => ({ ...prev, [p]: res.dataUrl }));
          }
        } catch (err) {
          console.warn(`Failed thumbnail for page ${p}:`, err);
        }
      }
    }

    loadAllThumbnails();
    return () => {
      isCancelled = true;
    };
  }, [item.file, totalPages]);

  // Load high-res enlarged view for the active page on focus
  useEffect(() => {
    let isCancelled = false;

    async function loadHighResActivePage() {
      if (highResCache[activePage]) return;
      setLoadingActivePage(true);
      try {
        const res = await renderPdfPageToDataUrl(item.file, activePage, 1.25);
        if (!isCancelled) {
          setHighResCache((prev) => ({ ...prev, [activePage]: res.dataUrl }));
        }
      } catch (err) {
        console.warn(`Failed high-res render for page ${activePage}:`, err);
      } finally {
        if (!isCancelled) {
          setLoadingActivePage(false);
        }
      }
    }

    loadHighResActivePage();
    return () => {
      isCancelled = true;
    };
  }, [activePage, highResCache, item.file]);

  // Global keyboard shortcut: Ctrl+A to select all pages
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        const activeEl = document.activeElement;
        if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        setSelectedPages(new Set(Array.from({ length: totalPages }, (_, i) => i + 1)));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages]);

  // Helper to update adjustment - automatically propagates to selectedPages if autoSyncToSelected is ON
  const updateCurrentAdj = (updates: Partial<PageAdjustment>) => {
    setAdjustments((prev) => {
      const next = { ...prev };
      // Target pages: if autoSync is active and active page is in selection and multiple pages selected
      const targetPages =
        autoSyncToSelected && selectedPages.has(activePage) && selectedPages.size > 1
          ? Array.from(selectedPages)
          : [activePage];

      for (const p of targetPages) {
        next[p] = {
          ...(prev[p] || defaultAdjustment),
          ...updates,
        };
      }
      return next;
    });
  };

  const handleCropChange = (newCrop: { top: number; bottom: number; left: number; right: number }) => {
    updateCurrentAdj({ crop: newCrop });
  };

  // Thumbnail click handler: Normal click selects single page & focuses; Ctrl+Click toggles multi-selection; Shift+Click selects range
  const handleThumbnailClick = (pageNum: number, e: React.MouseEvent) => {
    setActivePage(pageNum);

    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click: Toggle this page into/out of multi-selection for adjustment
      setSelectedPages((prev) => {
        const next = new Set(prev);
        if (next.has(pageNum)) {
          if (next.size > 1) next.delete(pageNum);
        } else {
          next.add(pageNum);
        }
        return next;
      });
      setLastClickedPage(pageNum);
    } else if (e.shiftKey) {
      // Shift+Click: Range select from last clicked page to current page
      const start = Math.min(lastClickedPage, pageNum);
      const end = Math.max(lastClickedPage, pageNum);
      setSelectedPages((prev) => {
        const next = new Set(prev);
        for (let p = start; p <= end; p++) {
          next.add(p);
        }
        return next;
      });
    } else {
      // Normal click: Select ONLY this page for adjustments & focus it
      setSelectedPages(new Set([pageNum]));
      setLastClickedPage(pageNum);
    }
  };

  // Checkbox toggle: ONLY for enabling/disabling this page for print/output
  const togglePageActiveForPrint = (pageNum: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setAdjustments((prev) => {
      const current = prev[pageNum] || defaultAdjustment;
      const nextActive = current.selectedForPrint === false ? true : false;
      return {
        ...prev,
        [pageNum]: {
          ...current,
          selectedForPrint: nextActive,
        },
      };
    });
  };

  const handleSelectAll = () => {
    setSelectedPages(new Set(Array.from({ length: totalPages }, (_, i) => i + 1)));
  };

  const handleSelectOdd = () => {
    const odds = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 !== 0);
    setSelectedPages(new Set(odds));
    if (odds.length > 0 && !odds.includes(activePage)) {
      setActivePage(odds[0]);
    }
  };

  const handleSelectEven = () => {
    const evens = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0);
    setSelectedPages(new Set(evens));
    if (evens.length > 0 && !evens.includes(activePage)) {
      setActivePage(evens[0]);
    }
  };

  const handleDeselectAll = () => {
    setSelectedPages(new Set([activePage]));
  };

  const handleInvertSelection = () => {
    setSelectedPages((prev) => {
      const next = new Set<number>();
      for (let p = 1; p <= totalPages; p++) {
        if (!prev.has(p)) next.add(p);
      }
      return next.size > 0 ? next : new Set([activePage]);
    });
  };

  // Checkbox (Selected for Print) bulk actions
  const handleCheckAllForPrint = () => {
    setAdjustments((prev) => {
      const next = { ...prev };
      for (let p = 1; p <= totalPages; p++) {
        next[p] = { ...(prev[p] || defaultAdjustment), selectedForPrint: true };
      }
      return next;
    });
  };

  const handleUncheckAllForPrint = () => {
    setAdjustments((prev) => {
      const next = { ...prev };
      for (let p = 1; p <= totalPages; p++) {
        next[p] = { ...(prev[p] || defaultAdjustment), selectedForPrint: false };
      }
      return next;
    });
  };

  const handleCheckOddForPrint = () => {
    setAdjustments((prev) => {
      const next = { ...prev };
      for (let p = 1; p <= totalPages; p++) {
        next[p] = { ...(prev[p] || defaultAdjustment), selectedForPrint: p % 2 !== 0 };
      }
      return next;
    });
  };

  const handleCheckEvenForPrint = () => {
    setAdjustments((prev) => {
      const next = { ...prev };
      for (let p = 1; p <= totalPages; p++) {
        next[p] = { ...(prev[p] || defaultAdjustment), selectedForPrint: p % 2 === 0 };
      }
      return next;
    });
  };

  const handleInvertCheckForPrint = () => {
    setAdjustments((prev) => {
      const next = { ...prev };
      for (let p = 1; p <= totalPages; p++) {
        const cur = prev[p] || defaultAdjustment;
        next[p] = { ...cur, selectedForPrint: cur.selectedForPrint === false ? true : false };
      }
      return next;
    });
  };

  // Interactive on-canvas image pan/move handlers (when activeTool === 'move')
  const handleImagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== 'move') return;
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    dragImageStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initOffsetX: currentAdj.offsetX || 0,
      initOffsetY: currentAdj.offsetY || 0,
      boxW: rect.width || 1,
      boxH: rect.height || 1,
    };
    setIsDraggingImage(true);
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleImagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingImage || activeTool !== 'move') return;
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (imageDragRafRef.current !== null) return;

    imageDragRafRef.current = requestAnimationFrame(() => {
      imageDragRafRef.current = null;
      const deltaX = clientX - dragImageStartRef.current.startX;
      const deltaY = clientY - dragImageStartRef.current.startY;
      const pctX = (deltaX / dragImageStartRef.current.boxW) * 100;
      const pctY = (deltaY / dragImageStartRef.current.boxH) * 100;
      const newOffX = Math.max(-50, Math.min(50, Number((dragImageStartRef.current.initOffsetX + pctX).toFixed(2))));
      const newOffY = Math.max(-50, Math.min(50, Number((dragImageStartRef.current.initOffsetY + pctY).toFixed(2))));
      updateCurrentAdj({ offsetX: newOffX, offsetY: newOffY });
    });
  };

  const handleImagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (imageDragRafRef.current !== null) {
      cancelAnimationFrame(imageDragRafRef.current);
      imageDragRafRef.current = null;
    }
    if (isDraggingImage) {
      setIsDraggingImage(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Batch Apply adjustments explicitly to selected pages
  const handleApplyToSelected = () => {
    const templateCrop = { ...currentAdj.crop };
    const templateBrightness = currentAdj.brightness;
    const templateContrast = currentAdj.contrast;
    const templateThreshold = currentAdj.threshold;
    const templateGrayscale = currentAdj.grayscale;
    const templateInvert = currentAdj.invert;

    setAdjustments((prev) => {
      const next: Record<number, PageAdjustment> = { ...prev };
      for (const p of selectedPages) {
        const cur = prev[p] || defaultAdjustment;
        next[p] = {
          ...cur,
          crop: { ...templateCrop },
          brightness: templateBrightness,
          contrast: templateContrast,
          threshold: templateThreshold,
          grayscale: templateGrayscale,
          invert: templateInvert,
        };
      }
      return next;
    });
  };

  // Batch Apply adjustments to all pages
  const handleApplyToAll = () => {
    const templateCrop = { ...currentAdj.crop };
    const templateBrightness = currentAdj.brightness;
    const templateContrast = currentAdj.contrast;
    const templateThreshold = currentAdj.threshold;
    const templateGrayscale = currentAdj.grayscale;
    const templateInvert = currentAdj.invert;

    setAdjustments((prev) => {
      const next: Record<number, PageAdjustment> = {};
      for (let p = 1; p <= totalPages; p++) {
        const cur = prev[p] || defaultAdjustment;
        next[p] = {
          ...cur,
          crop: { ...templateCrop },
          brightness: templateBrightness,
          contrast: templateContrast,
          threshold: templateThreshold,
          grayscale: templateGrayscale,
          invert: templateInvert,
        };
      }
      return next;
    });
  };

  // -------------------------------------------------------------
  // Text Overlay Handlers with Real-time Multi-Page Sync
  // -------------------------------------------------------------
  const handleAddText = () => {
    const newId = `txt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newText: PageOverlayText = {
      id: newId,
      text: 'متن جدید',
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
    setActiveTool('text');
  };

  const handleUpdateText = (id: string, updates: Partial<PageOverlayText>) => {
    const existingText = currentAdj.texts?.find((t) => t.id === id);
    const syncGroupId = updates.syncGroupId ?? existingText?.syncGroupId;

    if (syncGroupId) {
      // Live Sync across ALL pages sharing this syncGroupId
      setAdjustments((prev) => {
        const next: Record<number, PageAdjustment> = {};
        for (let p = 1; p <= totalPages; p++) {
          const cur = prev[p] || defaultAdjustment;
          const updatedTexts = (cur.texts || []).map((t) =>
            t.syncGroupId === syncGroupId ? { ...t, ...updates } : t
          );
          next[p] = { ...cur, texts: updatedTexts };
        }
        return next;
      });
    } else {
      // Update only current page
      const nextTexts = (currentAdj.texts || []).map((t) =>
        t.id === id ? { ...t, ...updates } : t
      );
      updateCurrentAdj({ texts: nextTexts });
    }
  };

  const handleDeleteText = (id: string) => {
    const nextTexts = (currentAdj.texts || []).map((t) => t).filter((t) => t.id !== id);
    updateCurrentAdj({ texts: nextTexts });
    setSelectedTextId(null);
  };

  const handleDuplicateText = (id: string, offset = { x: 3, y: 3 }) => {
    const original = currentAdj.texts?.find((t) => t.id === id);
    if (!original) return '';
    const newId = `txt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cloned: PageOverlayText = {
      ...original,
      id: newId,
      xPercent: Math.min(95, original.xPercent + offset.x),
      yPercent: Math.min(95, original.yPercent + offset.y),
      syncGroupId: undefined, // Standalone copy
    };
    updateCurrentAdj({
      texts: [...(currentAdj.texts || []), cloned],
    });
    setSelectedTextId(newId);
    setActiveTool('text');
    return newId;
  };

  const handleApplyTextToAllPages = (textId: string) => {
    const textObj = currentAdj.texts?.find((t) => t.id === textId);
    if (!textObj) return;

    const syncGroupId = textObj.syncGroupId || `sync-txt-${Date.now()}`;
    const syncedTemplate: PageOverlayText = {
      ...textObj,
      syncGroupId,
    };

    setAdjustments((prev) => {
      const next: Record<number, PageAdjustment> = {};
      for (let p = 1; p <= totalPages; p++) {
        const cur = prev[p] || defaultAdjustment;
        const filtered = (cur.texts || []).filter((t) => t.syncGroupId !== syncGroupId && t.id !== textId);
        next[p] = {
          ...cur,
          texts: [...filtered, { ...syncedTemplate, id: `txt-${p}-${syncGroupId}` }],
        };
      }
      return next;
    });
  };

  const handleApplyTextToSelectedPages = (textId: string) => {
    const textObj = currentAdj.texts?.find((t) => t.id === textId);
    if (!textObj) return;

    const syncGroupId = textObj.syncGroupId || `sync-txt-${Date.now()}`;
    const syncedTemplate: PageOverlayText = {
      ...textObj,
      syncGroupId,
    };

    setAdjustments((prev) => {
      const next: Record<number, PageAdjustment> = { ...prev };
      for (const p of selectedPages) {
        const cur = prev[p] || defaultAdjustment;
        const filtered = (cur.texts || []).filter((t) => t.syncGroupId !== syncGroupId && t.id !== textId);
        next[p] = {
          ...cur,
          texts: [...filtered, { ...syncedTemplate, id: `txt-${p}-${syncGroupId}` }],
        };
      }
      return next;
    });
  };

  // -------------------------------------------------------------
  // Geometric Shapes Handlers with Multi-Page Sync
  // -------------------------------------------------------------
  const handleAddShape = (type: ShapeType) => {
    const newId = `shp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newShape: PageOverlayShape = {
      id: newId,
      type,
      xPercent: 30,
      yPercent: 30,
      widthPercent: type === 'line' || type === 'arrow' ? 40 : 35,
      heightPercent: type === 'line' || type === 'arrow' ? 8 : 25,
      fillColor: type === 'line' || type === 'arrow' ? 'transparent' : '#3b82f620',
      strokeColor: '#3b82f6',
      strokeWidth: 3,
      strokeStyle: 'solid',
      opacity: 1,
      rotation: 0,
    };

    updateCurrentAdj({
      shapes: [...(currentAdj.shapes || []), newShape],
    });
    setSelectedShapeId(newId);
    setActiveTool('shape');
  };

  const handleUpdateShape = (id: string, updates: Partial<PageOverlayShape>) => {
    const existingShape = currentAdj.shapes?.find((s) => s.id === id);
    const syncGroupId = updates.syncGroupId ?? existingShape?.syncGroupId;

    if (syncGroupId) {
      setAdjustments((prev) => {
        const next: Record<number, PageAdjustment> = {};
        for (let p = 1; p <= totalPages; p++) {
          const cur = prev[p] || defaultAdjustment;
          const updatedShapes = (cur.shapes || []).map((s) =>
            s.syncGroupId === syncGroupId ? { ...s, ...updates } : s
          );
          next[p] = { ...cur, shapes: updatedShapes };
        }
        return next;
      });
    } else {
      const nextShapes = (currentAdj.shapes || []).map((s) =>
        s.id === id ? { ...s, ...updates } : s
      );
      updateCurrentAdj({ shapes: nextShapes });
    }
  };

  const handleDeleteShape = (id: string) => {
    const nextShapes = (currentAdj.shapes || []).filter((s) => s.id !== id);
    updateCurrentAdj({ shapes: nextShapes });
    setSelectedShapeId(null);
  };

  const handleDuplicateShape = (id: string, offset = { x: 3, y: 3 }) => {
    const original = currentAdj.shapes?.find((s) => s.id === id);
    if (!original) return '';
    const newId = `shp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cloned: PageOverlayShape = {
      ...original,
      id: newId,
      xPercent: Math.min(95 - original.widthPercent, original.xPercent + offset.x),
      yPercent: Math.min(95 - original.heightPercent, original.yPercent + offset.y),
      syncGroupId: undefined,
    };
    updateCurrentAdj({
      shapes: [...(currentAdj.shapes || []), cloned],
    });
    setSelectedShapeId(newId);
    setActiveTool('shape');
    return newId;
  };

  const handleApplyShapeToAllPages = (shapeId: string) => {
    const shapeObj = currentAdj.shapes?.find((s) => s.id === shapeId);
    if (!shapeObj) return;

    const syncGroupId = shapeObj.syncGroupId || `sync-shp-${Date.now()}`;
    const syncedTemplate: PageOverlayShape = {
      ...shapeObj,
      syncGroupId,
    };

    setAdjustments((prev) => {
      const next: Record<number, PageAdjustment> = {};
      for (let p = 1; p <= totalPages; p++) {
        const cur = prev[p] || defaultAdjustment;
        const filtered = (cur.shapes || []).filter((s) => s.syncGroupId !== syncGroupId && s.id !== shapeId);
        next[p] = {
          ...cur,
          shapes: [...filtered, { ...syncedTemplate, id: `shp-${p}-${syncGroupId}` }],
        };
      }
      return next;
    });
  };

  const handleApplyShapeToSelectedPages = (shapeId: string) => {
    const shapeObj = currentAdj.shapes?.find((s) => s.id === shapeId);
    if (!shapeObj) return;

    const syncGroupId = shapeObj.syncGroupId || `sync-shp-${Date.now()}`;
    const syncedTemplate: PageOverlayShape = {
      ...shapeObj,
      syncGroupId,
    };

    setAdjustments((prev) => {
      const next: Record<number, PageAdjustment> = { ...prev };
      for (const p of selectedPages) {
        const cur = prev[p] || defaultAdjustment;
        const filtered = (cur.shapes || []).filter((s) => s.syncGroupId !== syncGroupId && s.id !== shapeId);
        next[p] = {
          ...cur,
          shapes: [...filtered, { ...syncedTemplate, id: `shp-${p}-${syncGroupId}` }],
        };
      }
      return next;
    });
  };

  // -------------------------------------------------------------
  // Dynamic Page Numbering Handlers
  // -------------------------------------------------------------
  const currentNumberingsList = currentAdj.pageNumberings && currentAdj.pageNumberings.length > 0
    ? currentAdj.pageNumberings
    : (currentAdj.pageNumbering ? [currentAdj.pageNumbering] : []);

  const handleAddNumbering = () => {
    const newId = `num-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newNum: PageOverlayNumbering = {
      id: newId,
      enabled: true,
      xPercent: 50,
      yPercent: 95,
      fontSize: 14,
      fontFamily: 'Vazirmatn, sans-serif',
      color: '#1e293b',
      bold: true,
      italic: false,
      opacity: 1,
      format: 'persian',
      template: 'صفحه {page} از {total}',
      startOffset: 0,
    };

    const nextList = [...currentNumberingsList, newNum];
    updateCurrentAdj({ pageNumberings: nextList, pageNumbering: nextList[0] });
    setSelectedNumberingId(newId);
    setActiveTool('numbering');
    return newId;
  };

  const handleDuplicateNumbering = (id: string, offset = { x: 3, y: 3 }) => {
    const original = currentNumberingsList.find((n) => n.id === id) || currentNumberingsList[0];
    const newId = `num-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cloned: PageOverlayNumbering = {
      ...(original || {
        enabled: true,
        fontSize: 14,
        fontFamily: 'Vazirmatn, sans-serif',
        color: '#1e293b',
        bold: true,
        italic: false,
        opacity: 1,
        format: 'persian',
        template: 'صفحه {page} از {total}',
        startOffset: 0,
      }),
      id: newId,
      xPercent: Math.min(95, (original?.xPercent || 50) + offset.x),
      yPercent: Math.min(95, (original?.yPercent || 95) + offset.y),
    };

    const nextList = [...currentNumberingsList, cloned];
    updateCurrentAdj({ pageNumberings: nextList, pageNumbering: nextList[0] });
    setSelectedNumberingId(newId);
    setActiveTool('numbering');
    return newId;
  };

  const handleDeleteNumbering = (id: string) => {
    const nextList = currentNumberingsList.filter((n) => n.id !== id);
    updateCurrentAdj({ pageNumberings: nextList, pageNumbering: nextList[0] || undefined });
    if (selectedNumberingId === id) {
      setSelectedNumberingId(nextList[0]?.id || null);
    }
  };

  const handleUpdateNumberingItem = (id: string, updates: Partial<PageOverlayNumbering>) => {
    let list = [...currentNumberingsList];
    if (list.length === 0) {
      const defaultItem: PageOverlayNumbering = {
        id: id || 'page-numbering',
        enabled: true,
        xPercent: 50,
        yPercent: 95,
        fontSize: 14,
        fontFamily: 'Vazirmatn, sans-serif',
        color: '#1e293b',
        bold: true,
        italic: false,
        opacity: 1,
        format: 'persian',
        template: 'صفحه {page} از {total}',
        startOffset: 0,
      };
      list = [defaultItem];
    }

    const nextList = list.map((n) => (n.id === id || list.length === 1 ? { ...n, ...updates } : n));
    updateCurrentAdj({ pageNumberings: nextList, pageNumbering: nextList[0] });
  };

  const handleUpdateNumbering = (updates: Partial<PageOverlayNumbering>) => {
    const activeId = selectedNumberingId || currentNumberingsList[0]?.id || 'page-numbering';
    handleUpdateNumberingItem(activeId, updates);
  };

  const handleApplyNumberingToAll = () => {
    const list = currentNumberingsList.length > 0 ? currentNumberingsList : [{
      id: 'page-numbering',
      enabled: true,
      xPercent: 50,
      yPercent: 95,
      fontSize: 14,
      fontFamily: 'Vazirmatn, sans-serif',
      color: '#1e293b',
      bold: true,
      italic: false,
      opacity: 1,
      format: 'persian' as const,
      template: 'صفحه {page} از {total}',
      startOffset: 0,
    }];

    setAdjustments((prev) => {
      const next: Record<number, PageAdjustment> = {};
      for (let p = 1; p <= totalPages; p++) {
        const cur = prev[p] || defaultAdjustment;
        next[p] = {
          ...cur,
          pageNumberings: list.map((n) => ({ ...n, enabled: true })),
          pageNumbering: { ...list[0], enabled: true },
        };
      }
      return next;
    });
  };

  const handleApplyNumberingToOdd = () => {
    const list = currentNumberingsList.length > 0 ? currentNumberingsList : [{
      id: 'page-numbering',
      enabled: true,
      xPercent: 50,
      yPercent: 95,
      fontSize: 14,
      fontFamily: 'Vazirmatn, sans-serif',
      color: '#1e293b',
      bold: true,
      italic: false,
      opacity: 1,
      format: 'persian' as const,
      template: 'صفحه {page} از {total}',
      startOffset: 0,
    }];

    setAdjustments((prev) => {
      const next: Record<number, PageAdjustment> = {};
      for (let p = 1; p <= totalPages; p++) {
        const cur = prev[p] || defaultAdjustment;
        const isOdd = p % 2 !== 0;
        next[p] = {
          ...cur,
          pageNumberings: list.map((n) => ({ ...n, enabled: isOdd })),
          pageNumbering: { ...list[0], enabled: isOdd },
        };
      }
      return next;
    });
  };

  const handleApplyNumberingToEven = () => {
    const list = currentNumberingsList.length > 0 ? currentNumberingsList : [{
      id: 'page-numbering',
      enabled: true,
      xPercent: 50,
      yPercent: 95,
      fontSize: 14,
      fontFamily: 'Vazirmatn, sans-serif',
      color: '#1e293b',
      bold: true,
      italic: false,
      opacity: 1,
      format: 'persian' as const,
      template: 'صفحه {page} از {total}',
      startOffset: 0,
    }];

    setAdjustments((prev) => {
      const next: Record<number, PageAdjustment> = {};
      for (let p = 1; p <= totalPages; p++) {
        const cur = prev[p] || defaultAdjustment;
        const isEven = p % 2 === 0;
        next[p] = {
          ...cur,
          pageNumberings: list.map((n) => ({ ...n, enabled: isEven })),
          pageNumbering: { ...list[0], enabled: isEven },
        };
      }
      return next;
    });
  };

  // -------------------------------------------------------------
  // Page Duplication & Blank Page Handlers
  // -------------------------------------------------------------
  const handleConfirmDuplicate = async (copies: number, insertAt: 'after' | 'end') => {
    try {
      setIsModifyingPdf(true);
      const { newFile, newPageCount } = await duplicatePdfPage(item.file, activePage, copies, insertAt);
      const updatedItem: PDFItem = {
        ...item,
        file: newFile,
        pageCount: newPageCount,
      };
      onUpdatePdfItem?.(updatedItem);

      // Rebuild adjustments map
      setAdjustments((prev) => {
        const next: Record<number, PageAdjustment> = {};
        for (let p = 1; p <= newPageCount; p++) {
          next[p] = prev[p] ? { ...prev[p] } : { ...defaultAdjustment };
        }
        return next;
      });

      // Clear caches to force fresh render
      setThumbnails({});
      setHighResCache({});
      setDuplicateModalState({ open: false, mode: 'duplicate' });
    } catch (err) {
      console.error('Failed to duplicate page:', err);
    } finally {
      setIsModifyingPdf(false);
    }
  };

  const handleConfirmBlank = async (copies: number, insertAfter: number) => {
    try {
      setIsModifyingPdf(true);
      const { newFile, newPageCount } = await insertBlankPdfPage(item.file, insertAfter, copies);
      const updatedItem: PDFItem = {
        ...item,
        file: newFile,
        pageCount: newPageCount,
      };
      onUpdatePdfItem?.(updatedItem);

      setAdjustments((prev) => {
        const next: Record<number, PageAdjustment> = {};
        for (let p = 1; p <= newPageCount; p++) {
          next[p] = prev[p] ? { ...prev[p] } : { ...defaultAdjustment };
        }
        return next;
      });

      setThumbnails({});
      setHighResCache({});
      setDuplicateModalState({ open: false, mode: 'blank' });
    } catch (err) {
      console.error('Failed to insert blank page:', err);
    } finally {
      setIsModifyingPdf(false);
    }
  };

  // Presets
  const handleTrim5Percent = () => {
    handleCropChange({ top: 5, bottom: 5, left: 5, right: 5 });
  };

  const handleResetCrop = () => {
    handleCropChange({ top: 0, bottom: 0, left: 0, right: 0 });
  };

  const handleBindingGutter = () => {
    handleCropChange({ top: 4, bottom: 4, left: 9.5, right: 4 });
  };

  const handleSave = () => {
    onSaveAdjustments(item.id, adjustments);
    onClose();
  };

  // Active high-res image data
  const activeImageDataUrl = highResCache[activePage] || thumbnails[activePage];

  // CSS Filter string for active view
  const activeFilters = [
    `brightness(${currentAdj.brightness}%)`,
    `contrast(${currentAdj.contrast}%)`,
    currentAdj.grayscale ? 'grayscale(100%)' : '',
    currentAdj.invert ? 'invert(100%)' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Millimeters conversion for margin inputs
  const topMm = Math.round((currentAdj.crop.top / 100) * pageHeightMm);
  const bottomMm = Math.round((currentAdj.crop.bottom / 100) * pageHeightMm);
  const leftMm = Math.round((currentAdj.crop.left / 100) * pageWidthMm);
  const rightMm = Math.round((currentAdj.crop.right / 100) * pageWidthMm);

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
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-500 shrink-0">
              <Crop className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold truncate">
                  استودیو کراپ ۸ نقطه‌ای و تنظیمات نور صفحات
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  Ctrl + Click چندتایی
                </span>
              </div>
              <p className={`text-xs truncate ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                {item.name} · {totalPages} {t.pagesUnit} ({selectedPages.size} صفحه انتخاب شده)
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t.saveChanges}</span>
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

        {/* 3-Column Studio Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Column 1: Thumbnails Strip with Ctrl/Shift Multi-Select */}
          <div
            className={`w-full md:w-68 border-b md:border-b-0 md:border-e flex flex-col overflow-hidden transition-colors ${
              isDark ? 'bg-neutral-950/70 border-neutral-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            {/* Gallery Top Toolbar with Selection & Checkbox Bulk Controls */}
            <div className={`p-2 border-b flex flex-col gap-1.5 text-xs ${
              isDark ? 'border-neutral-800 bg-neutral-900/60' : 'border-slate-200 bg-white'
            }`}>
              {/* Row 1: Adjustment Selection (Border Ring) */}
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold flex items-center gap-1 text-[11px] text-blue-500">
                  <Layers className="w-3.5 h-3.5" />
                  <span>انتخاب تنظیمات ({selectedPages.size}):</span>
                </span>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-1.5 py-0.5 rounded hover:bg-blue-600/20 text-blue-500 font-medium cursor-pointer"
                    title="انتخاب تمام صفحات جهت اعمال تنظیمات"
                  >
                    همه
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={handleSelectOdd}
                    className="px-1.5 py-0.5 rounded hover:bg-purple-600/20 text-purple-500 font-medium cursor-pointer"
                    title="انتخاب صفحات فرد (۱، ۳، ۵، ...)"
                  >
                    فرد
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={handleSelectEven}
                    className="px-1.5 py-0.5 rounded hover:bg-emerald-600/20 text-emerald-500 font-medium cursor-pointer"
                    title="انتخاب صفحات زوج (۲، ۴، ۶، ...)"
                  >
                    زوج
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={handleInvertSelection}
                    className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                    title="معکوس‌سازی انتخاب تنظیمات"
                  >
                    معکوس
                  </button>
                </div>
              </div>

              {/* Row 2: Checkboxes Bulk Actions (Active in Print) */}
              <div className={`flex items-center justify-between gap-1 pt-1 border-t ${
                isDark ? 'border-neutral-800/60' : 'border-slate-100'
              }`}>
                <span className="font-bold flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>چک‌باکس چاپ:</span>
                </span>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={handleCheckAllForPrint}
                    className="px-1.5 py-0.5 rounded hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 font-medium cursor-pointer"
                    title="فعال کردن تمام چک‌باکس‌ها در چاپ"
                  >
                    همه ✓
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={handleCheckOddForPrint}
                    className="px-1.5 py-0.5 rounded hover:bg-purple-600/20 text-purple-500 font-medium cursor-pointer"
                    title="فعال کردن چک‌باکس صفحات فرد در چاپ (۱، ۳، ۵، ...)"
                  >
                    فرد
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={handleCheckEvenForPrint}
                    className="px-1.5 py-0.5 rounded hover:bg-emerald-600/20 text-emerald-500 font-medium cursor-pointer"
                    title="فعال کردن چک‌باکس صفحات زوج در چاپ (۲، ۴، ۶، ...)"
                  >
                    زوج
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={handleInvertCheckForPrint}
                    className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                    title="معکوس‌سازی وضعیت چک‌باکس‌های چاپ"
                  >
                    معکوس
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={handleUncheckAllForPrint}
                    className="px-1.5 py-0.5 rounded hover:bg-red-600/20 text-red-400 cursor-pointer"
                    title="غیرفعال کردن تمام چک‌باکس‌ها"
                  >
                    لغو ✕
                  </button>
                </div>
              </div>

              {/* Row 2.5: Custom Range Selection Input */}
              <div className={`flex items-center gap-1.5 pt-1 border-t ${
                isDark ? 'border-neutral-800/60' : 'border-slate-100'
              }`}>
                <span className="text-[10px] text-neutral-400 shrink-0 font-medium">بازه صفحات:</span>
                <input
                  type="text"
                  placeholder="مثلاً 1-3, 5, 8-10"
                  value={customRangeText}
                  onChange={(e) => setCustomRangeText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleApplyCustomRange();
                  }}
                  className={`flex-1 px-2 py-0.5 rounded text-[11px] font-mono border focus:outline-none ${
                    isDark
                      ? 'bg-neutral-950 border-neutral-750 text-white placeholder:text-neutral-500 focus:border-blue-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleApplyCustomRange}
                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded cursor-pointer shrink-0 transition-colors"
                >
                  انتخاب
                </button>
              </div>

              {/* Row 3: Duplicate Page & Blank Page Quick Actions */}
              <div className={`grid grid-cols-2 gap-1.5 pt-1.5 border-t ${
                isDark ? 'border-neutral-800/60' : 'border-slate-100'
              }`}>
                <button
                  type="button"
                  onClick={() => setDuplicateModalState({ open: true, mode: 'duplicate' })}
                  disabled={isModifyingPdf}
                  className="py-1 px-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 text-blue-500 border border-blue-500/30 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="تکثیر این صفحه به تعداد دلخواه (۱، ۲، ۵ یا N نسخه)"
                >
                  <Copy className="w-3 h-3" />
                  <span>تکثیر صفحه {activePage}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDuplicateModalState({ open: true, mode: 'blank' })}
                  disabled={isModifyingPdf}
                  className="py-1 px-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-500 border border-emerald-500/30 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="ایجاد و درج صفحه سفید خالی در هر کجای سند"
                >
                  <PlusCircle className="w-3 h-3" />
                  <span>ایجاد صفحه خالی</span>
                </button>
              </div>
            </div>

            {/* Ctrl / Shift Instruction Hint */}
            <div className={`px-2.5 py-1.5 border-b text-[10px] flex items-center justify-between ${
              isDark ? 'bg-neutral-900/40 border-neutral-800/60 text-neutral-400' : 'bg-slate-100/70 border-slate-200 text-slate-600'
            }`}>
              <div className="flex items-center gap-1.5">
                <MousePointer className="w-3 h-3 text-blue-500 shrink-0" />
                <span>کلید <b>Ctrl</b> + کلیک برای چند انتخابی</span>
              </div>
              <span className="text-[9px] text-emerald-500 font-medium">چک‌باکس: خروجی چاپ</span>
            </div>

            {/* Thumbnails Scrollable List */}
            <div className="flex-1 p-2.5 overflow-y-auto space-y-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                const adj = adjustments[pageNum] || defaultAdjustment;
                const isFocused = activePage === pageNum;
                const isSelected = selectedPages.has(pageNum);
                const isActiveForPrint = adj.selectedForPrint !== false;
                const thumb = thumbnails[pageNum];

                const thumbFilters = [
                  `brightness(${adj.brightness}%)`,
                  `contrast(${adj.contrast}%)`,
                  adj.grayscale ? 'grayscale(100%)' : '',
                  adj.invert ? 'invert(100%)' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <div
                    key={pageNum}
                    onClick={(e) => handleThumbnailClick(pageNum, e)}
                    className={`relative rounded-xl border p-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 shadow-sm'
                        : isDark
                        ? 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    } ${!isActiveForPrint ? 'opacity-60' : ''}`}
                  >
                    {/* Print Enable/Disable Checkbox ONLY */}
                    <button
                      type="button"
                      onClick={(e) => togglePageActiveForPrint(pageNum, e)}
                      className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                        isActiveForPrint
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isDark
                          ? 'border border-neutral-600 bg-neutral-950 text-transparent hover:border-neutral-400'
                          : 'border border-slate-300 bg-white text-transparent hover:border-slate-400'
                      }`}
                      title={isActiveForPrint ? 'فعال در چاپ (کلیک برای غیرفعال کردن)' : 'غیرفعال در چاپ (کلیک برای فعال کردن)'}
                    >
                      {isActiveForPrint && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    {/* Thumbnail Viewport with Auto-Fitted Crop & Filters */}
                    <div
                      className={`w-12 aspect-[1/1.4] rounded-md overflow-hidden relative flex items-center justify-center shrink-0 border ${
                        isDark ? 'bg-neutral-950 border-neutral-800' : 'bg-slate-200 border-slate-300'
                      }`}
                    >
                      {thumb ? (() => {
                        const tCropLeft = adj.crop.left || 0;
                        const tCropRight = adj.crop.right || 0;
                        const tCropTop = adj.crop.top || 0;
                        const tCropBottom = adj.crop.bottom || 0;

                        const thumbCropW = Math.max(1, 100 - tCropLeft - tCropRight);
                        const thumbCropH = Math.max(1, 100 - tCropTop - tCropBottom);
                        const hasThumbCrop =
                          tCropTop > 0 || tCropBottom > 0 || tCropLeft > 0 || tCropRight > 0;

                        const pageAspect = (pageWidthMm || 210) / (pageHeightMm || 297);
                        const cropAspect = hasThumbCrop
                          ? (thumbCropW * (pageWidthMm || 210)) / (thumbCropH * (pageHeightMm || 297))
                          : pageAspect;

                        let tBoxW = 100;
                        let tBoxH = 100;

                        if (hasThumbCrop) {
                          if (cropAspect >= pageAspect) {
                            tBoxW = 100;
                            tBoxH = Math.min(100, Math.max(5, (pageAspect / cropAspect) * 100));
                          } else {
                            tBoxH = 100;
                            tBoxW = Math.min(100, Math.max(5, (cropAspect / pageAspect) * 100));
                          }

                          return (
                            <div
                              style={{
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                width: `${tBoxW}%`,
                                height: `${tBoxH}%`,
                                transform: 'translate(-50%, -50%)',
                                overflow: 'hidden',
                              }}
                              className="pointer-events-none select-none"
                            >
                              <img
                                src={thumb}
                                alt={`Thumbnail ${pageNum}`}
                                style={{
                                  filter: thumbFilters,
                                  position: 'absolute',
                                  width: `${(100 / thumbCropW) * 100}%`,
                                  height: `${(100 / thumbCropH) * 100}%`,
                                  left: `${-(tCropLeft / thumbCropW) * 100}%`,
                                  top: `${-(tCropTop / thumbCropH) * 100}%`,
                                  maxWidth: 'none',
                                  maxHeight: 'none',
                                }}
                                className="pointer-events-none select-none"
                              />
                            </div>
                          );
                        }

                        return (
                          <img
                            src={thumb}
                            alt={`Thumbnail ${pageNum}`}
                            style={{
                              filter: thumbFilters,
                              maxWidth: '100%',
                              maxHeight: '100%',
                              objectFit: 'contain',
                            }}
                            className="pointer-events-none select-none"
                          />
                        );
                      })() : (
                        <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="flex items-center justify-between">
                        <span className={`font-bold ${isSelected ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                          صفحه {pageNum}
                        </span>
                        {isFocused && (
                          <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded shadow-xs">
                            میز کار
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-neutral-400">
                        {!isActiveForPrint && (
                          <span className="text-red-500 font-medium">حذف از چاپ</span>
                        )}
                        {(adj.crop.top > 0 || adj.crop.bottom > 0 || adj.crop.left > 0 || adj.crop.right > 0) && (
                          <span className="text-purple-500 font-medium">کراپ</span>
                        )}
                        {(adj.brightness !== 100 || adj.contrast !== 100 || adj.threshold) && (
                          <span className="text-amber-500 font-medium">نور</span>
                        )}
                        {((adj.offsetX || 0) !== 0 || (adj.offsetY || 0) !== 0) && (
                          <span className="text-emerald-500 font-medium">جابجایی</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2: Center Enlarged Workbench with Rulers & 8-Point Crop Box */}
          <div
            className={`flex-1 flex flex-col overflow-hidden relative ${
              isDark ? 'bg-neutral-950' : 'bg-slate-100'
            }`}
          >
            {/* Workbench Top Toolbar: Zoom & Page Info */}
            <div
              className={`px-4 py-2 border-b flex items-center justify-between text-xs ${
                isDark ? 'bg-neutral-900/60 border-neutral-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">
                  پیش‌نمایش بزرگ صفحه {activePage} از {totalPages}
                </span>
                {loadingActivePage && (
                  <span className="flex items-center gap-1 text-[11px] text-blue-500 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    رندر کیفیت بالا...
                  </span>
                )}
              </div>

              {/* Workbench Tool Mode Switcher & Zoom Controls */}
              <div className="flex items-center gap-2">
                {/* Mode Switcher: Move, Crop, Text, Shapes, Page Numbering */}
                <div className={`flex items-center gap-0.5 p-0.5 rounded-lg border ${
                  isDark ? 'bg-neutral-900 border-neutral-750' : 'bg-slate-100 border-slate-300'
                }`}>
                  <button
                    type="button"
                    onClick={() => setActiveTool('move')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      activeTool === 'move'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : isDark
                        ? 'text-neutral-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="جابجایی و تغییر اندازه تصویر در صفحه"
                  >
                    <Move className="w-3.5 h-3.5" />
                    <span>جابجایی</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool('crop')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      activeTool === 'crop'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : isDark
                        ? 'text-neutral-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="برش و کراپ ۸ نقطه‌ای حاشیه‌ها"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>کراپ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool('text')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      activeTool === 'text'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : isDark
                        ? 'text-neutral-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="افزودن و ویرایش متن و نوشته روی صفحه"
                  >
                    <Type className="w-3.5 h-3.5" />
                    <span>متن ({currentAdj.texts?.length || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool('shape')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      activeTool === 'shape'
                        ? 'bg-fuchsia-600 text-white shadow-xs'
                        : isDark
                        ? 'text-neutral-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="افزودن و ویرایش اشکال هندسی (مستطیل، دایره، خط، پیکان، ستاره)"
                  >
                    <Shapes className="w-3.5 h-3.5" />
                    <span>اشکال ({currentAdj.shapes?.length || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool('numbering')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      activeTool === 'numbering'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : isDark
                        ? 'text-neutral-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="تنظیم و شخصی‌سازی شماره‌گذاری صفحات"
                  >
                    <Hash className="w-3.5 h-3.5" />
                    <span>شماره صفحه</span>
                  </button>
                </div>

                <div className="h-4 w-[1px] bg-neutral-700/40 mx-0.5" />

                {/* Zoom Controls */}
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.15))}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    isDark ? 'border-neutral-750 hover:bg-neutral-800' : 'border-slate-300 hover:bg-slate-100'
                  }`}
                  title="کوچک‌نمایی"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-xs w-12 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.15))}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    isDark ? 'border-neutral-750 hover:bg-neutral-800' : 'border-slate-300 hover:bg-slate-100'
                  }`}
                  title="بزرگ‌نمایی"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className={`px-2 py-1 rounded-lg border text-[11px] transition-colors ${
                    isDark ? 'border-neutral-750 hover:bg-neutral-800' : 'border-slate-300 hover:bg-slate-100'
                  }`}
                  title="اندازه طبیعی"
                >
                  Fit
                </button>

                <div className="h-4 w-[1px] bg-neutral-700/40 mx-0.5" />

                {/* Alignment Grid Toggle Button */}
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                    showGrid
                      ? 'bg-blue-600/20 border-blue-500 text-blue-500 font-bold'
                      : isDark
                      ? 'border-neutral-750 text-neutral-400 hover:bg-neutral-800'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                  title="نمایش یا مخفی‌سازی خطوط شطرنجی تراز جهت بررسی زاویه کجی"
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>خطوط تراز {totalPageAngle !== 0 ? `(${totalPageAngle > 0 ? '+' : ''}${totalPageAngle}°)` : ''}</span>
                </button>

                {/* Measure Ruler Tool Toggle Button */}
                <button
                  onClick={() => setActiveTool(activeTool === 'measure' ? 'move' : 'measure')}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                    activeTool === 'measure'
                      ? 'bg-amber-600 border-amber-500 text-white font-bold shadow-xs'
                      : isDark
                      ? 'border-neutral-750 text-neutral-400 hover:bg-neutral-800'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                  title="متر اندازه‌گیری دو نقطه با قفل زوايا (Shift)"
                >
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  <span>متر اندازه‌گیری</span>
                </button>
              </div>
            </div>

            {/* Main Stage with Rulers around the page image */}
            <div className="flex-1 flex flex-col overflow-auto p-4 items-center justify-center relative">
              <div
                dir="ltr"
                style={{
                  direction: 'ltr',
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                }}
                className="relative flex flex-col items-start shadow-2xl transition-transform duration-100"
              >
                {/* Horizontal Ruler on Top aligned with canvas */}
                <div className="w-full flex" style={{ paddingLeft: '24px' }}>
                  <Ruler
                    orientation="horizontal"
                    lengthMm={pageWidthMm}
                    cropStartPercent={currentAdj.crop.left}
                    cropEndPercent={100 - currentAdj.crop.right}
                    theme={theme}
                    onAddGuideline={handleAddGuideline}
                  />
                </div>

                {/* Vertical Ruler + Page Canvas container */}
                <div className="flex items-stretch relative" dir="ltr" style={{ direction: 'ltr' }}>
                  {/* Vertical Ruler along Left Side */}
                  <Ruler
                    orientation="vertical"
                    lengthMm={pageHeightMm}
                    cropStartPercent={currentAdj.crop.top}
                    cropEndPercent={100 - currentAdj.crop.bottom}
                    theme={theme}
                    onAddGuideline={handleAddGuideline}
                  />

                  {/* Page Image Container with Interactive Drag & Crop */}
                  <div
                    dir="ltr"
                    style={{ direction: 'ltr' }}
                    onPointerDown={handleImagePointerDown}
                    onPointerMove={handleImagePointerMove}
                    onPointerUp={handleImagePointerUp}
                    onPointerCancel={handleImagePointerUp}
                    className={`relative w-[340px] sm:w-[420px] md:w-[480px] aspect-[1/1.414] rounded-xs overflow-hidden border shadow-lg select-none ${
                      activeTool === 'move' ? 'cursor-move' : 'cursor-default'
                    } ${isDark ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-slate-300'}`}
                  >
                    {activeImageDataUrl ? (() => {
                      const cropLeft = currentAdj.crop.left || 0;
                      const cropRight = currentAdj.crop.right || 0;
                      const cropTop = currentAdj.crop.top || 0;
                      const cropBottom = currentAdj.crop.bottom || 0;

                      const cropW = Math.max(1, 100 - cropLeft - cropRight);
                      const cropH = Math.max(1, 100 - cropTop - cropBottom);
                      const isCropped =
                        cropTop > 0 || cropBottom > 0 || cropLeft > 0 || cropRight > 0;

                      const pageAspect = (pageWidthMm || 210) / (pageHeightMm || 297);
                      const cropAspect = isCropped
                        ? (cropW * (pageWidthMm || 210)) / (cropH * (pageHeightMm || 297))
                        : pageAspect;

                      let boxW = 100;
                      let boxH = 100;

                      if (isCropped) {
                        if (cropAspect >= pageAspect) {
                          boxW = 100;
                          boxH = Math.min(100, Math.max(5, (pageAspect / cropAspect) * 100));
                        } else {
                          boxH = 100;
                          boxW = Math.min(100, Math.max(5, (cropAspect / pageAspect) * 100));
                        }
                      }

                      // When exiting crop tool, show the fitted cropped sub-rectangle
                      const isFittedCropMode = activeTool !== 'crop' && isCropped;

                      if (isFittedCropMode) {
                        return (
                          <div
                            style={{
                              position: 'absolute',
                              left: '50%',
                              top: '50%',
                              width: `${boxW}%`,
                              height: `${boxH}%`,
                              transform: `translate(-50%, -50%) translate(${currentAdj.offsetX || 0}%, ${currentAdj.offsetY || 0}%) rotate(${totalPageAngle}deg) scale(${(currentAdj.scale || 100) / 100})`,
                              transformOrigin: 'center center',
                              overflow: 'hidden',
                              transition: (isDraggingImage || activeTool === 'move') ? 'none' : 'transform 0.1s ease-out',
                            }}
                            className="pointer-events-none select-none"
                          >
                            <img
                              src={activeImageDataUrl}
                              alt={`Active Page ${activePage}`}
                              style={{
                                filter: activeFilters,
                                position: 'absolute',
                                width: `${(100 / cropW) * 100}%`,
                                height: `${(100 / cropH) * 100}%`,
                                left: `${-(cropLeft / cropW) * 100}%`,
                                top: `${-(cropTop / cropH) * 100}%`,
                                maxWidth: 'none',
                                maxHeight: 'none',
                              }}
                              className="pointer-events-none select-none"
                            />
                          </div>
                        );
                      }

                      return (
                        <img
                          src={activeImageDataUrl}
                          alt={`Active Page ${activePage}`}
                          style={{
                            filter: activeFilters,
                            transform: `translate(${currentAdj.offsetX || 0}%, ${currentAdj.offsetY || 0}%) rotate(${totalPageAngle}deg) scale(${(currentAdj.scale || 100) / 100})`,
                            transformOrigin: 'center center',
                            transition: (isDraggingImage || activeTool === 'move' || activeTool === 'crop') ? 'none' : 'transform 0.1s ease-out',
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                          }}
                          className="pointer-events-none select-none"
                        />
                      );
                    })() : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-neutral-400 text-xs">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                        <span>در حال بارگذاری صفحه با کیفیت بالا...</span>
                      </div>
                    )}

                    {/* Alignment Grid Overlay */}
                    {showGrid && (
                      <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-10 grid-rows-14 opacity-20">
                        {Array.from({ length: 140 }).map((_, i) => (
                          <div key={i} className="border-b border-r border-blue-500" />
                        ))}
                      </div>
                    )}

                    {/* Interactive 8-Point Transform / Resize & Move Box Overlay - when activeTool === 'move' */}
                    {activeTool === 'move' && (
                      <InteractiveTransformBox
                        offsetX={currentAdj.offsetX || 0}
                        offsetY={currentAdj.offsetY || 0}
                        scale={currentAdj.scale || 100}
                        rotation={totalPageAngle}
                        crop={currentAdj.crop}
                        pageWidthMm={pageWidthMm}
                        pageHeightMm={pageHeightMm}
                        onChange={(updates) => updateCurrentAdj(updates)}
                      />
                    )}

                    {/* Interactive 8-Point Crop Box Overlay (anchored to image content) - when activeTool === 'crop' */}
                    {activeTool === 'crop' && (
                      <InteractiveCropBox
                        crop={currentAdj.crop}
                        onChange={handleCropChange}
                        pageWidthMm={pageWidthMm}
                        pageHeightMm={pageHeightMm}
                        transform={{
                          offsetX: currentAdj.offsetX,
                          offsetY: currentAdj.offsetY,
                          scale: currentAdj.scale,
                          rotation: totalPageAngle,
                        }}
                      />
                    )}

                    {/* Interactive Measure Ruler Layer */}
                    <MeasureToolLayer
                      activeTool={activeTool}
                      pageWidthMm={pageWidthMm}
                      pageHeightMm={pageHeightMm}
                      theme={theme}
                      measureLine={measureLine}
                      onChangeMeasureLine={setMeasureLine}
                    />

                    {/* Interactive Guidelines Layer (Cyan Lines with cm markings) */}
                    <GuidelinesLayer
                      guidelines={guidelines}
                      pageWidthMm={pageWidthMm}
                      pageHeightMm={pageHeightMm}
                      onUpdateGuideline={handleUpdateGuideline}
                      onDeleteGuideline={handleDeleteGuideline}
                      theme={theme}
                    />

                    {/* Interactive Overlays Layer for Text, Shapes, and Dynamic Page Numbering */}
                    <OverlayElementsLayer
                      adjustment={currentAdj}
                      pageNum={activePage}
                      totalPages={totalPages}
                      activeTool={activeTool}
                      selectedTextId={selectedTextId}
                      selectedShapeId={selectedShapeId}
                      selectedNumberingId={selectedNumberingId}
                      onSelectText={setSelectedTextId}
                      onSelectShape={setSelectedShapeId}
                      onSelectNumbering={setSelectedNumberingId}
                      onSelectTool={setActiveTool}
                      onUpdateText={handleUpdateText}
                      onUpdateShape={handleUpdateShape}
                      onUpdateNumbering={handleUpdateNumbering}
                      onUpdateNumberingItem={handleUpdateNumberingItem}
                      onDuplicateText={handleDuplicateText}
                      onDuplicateShape={handleDuplicateShape}
                      onDuplicateNumbering={handleDuplicateNumbering}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Control Panel for Margins, Crop, Overlays & Brightness */}
          <div
            className={`w-full md:w-84 border-t md:border-t-0 md:border-s flex flex-col overflow-hidden transition-colors ${
              isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200'
            }`}
          >
            {/* Sidebar Tool Navigation Tabs */}
            <div
              className={`p-2 border-b grid grid-cols-5 gap-1 shrink-0 ${
                isDark ? 'bg-neutral-950/80 border-neutral-800' : 'bg-slate-100 border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveTool('move')}
                className={`py-1.5 px-0.5 rounded-lg text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                  activeTool === 'move'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : isDark
                    ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
                title="جابجایی و مقیاس تصویر در صفحه"
              >
                <Move className="w-3.5 h-3.5" />
                <span>موقعیت</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('crop')}
                className={`py-1.5 px-0.5 rounded-lg text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                  activeTool === 'crop'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : isDark
                    ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
                title="برش و کراپ ۸ نقطه حاشیه‌ها"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>کراپ</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('text')}
                className={`py-1.5 px-0.5 rounded-lg text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                  activeTool === 'text'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isDark
                    ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
                title="متن و تایپ روی صفحه با همگام‌سازی"
              >
                <Type className="w-3.5 h-3.5" />
                <span>متن</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('shape')}
                className={`py-1.5 px-0.5 rounded-lg text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                  activeTool === 'shape'
                    ? 'bg-fuchsia-600 text-white shadow-xs'
                    : isDark
                    ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
                title="اشکال هندسی (کادر، دایره، خط، پیکان، ستاره)"
              >
                <Shapes className="w-3.5 h-3.5" />
                <span>اشکال</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('numbering')}
                className={`py-1.5 px-0.5 rounded-lg text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                  activeTool === 'numbering'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : isDark
                    ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
                title="شماره‌گذاری هوشمند صفحات"
              >
                <Hash className="w-3.5 h-3.5" />
                <span>شماره</span>
              </button>
            </div>

            {/* Tabbed Content Body */}
            <div className="flex-1 p-4 space-y-4 text-xs overflow-y-auto">
              {/* TAB 1: Text Overlays */}
              {activeTool === 'text' && (
                <TextControlPanel
                  texts={currentAdj.texts || []}
                  selectedTextId={selectedTextId}
                  theme={theme}
                  onSelectText={setSelectedTextId}
                  onAddText={handleAddText}
                  onUpdateText={handleUpdateText}
                  onDeleteText={handleDeleteText}
                  onApplyTextToAllPages={handleApplyTextToAllPages}
                  onApplyTextToSelectedPages={handleApplyTextToSelectedPages}
                />
              )}

              {/* TAB 2: Geometric Shapes */}
              {activeTool === 'shape' && (
                <ShapeControlPanel
                  shapes={currentAdj.shapes || []}
                  selectedShapeId={selectedShapeId}
                  theme={theme}
                  onSelectShape={setSelectedShapeId}
                  onAddShape={handleAddShape}
                  onUpdateShape={handleUpdateShape}
                  onDeleteShape={handleDeleteShape}
                  onApplyShapeToAllPages={handleApplyShapeToAllPages}
                  onApplyShapeToSelectedPages={handleApplyShapeToSelectedPages}
                />
              )}

              {/* TAB 3: Dynamic Page Numbering */}
              {activeTool === 'numbering' && (
                <PageNumberingPanel
                  numbering={currentAdj.pageNumbering}
                  numberings={currentAdj.pageNumberings}
                  selectedNumberingId={selectedNumberingId}
                  currentPage={activePage}
                  totalPages={totalPages}
                  theme={theme}
                  onSelectNumbering={setSelectedNumberingId}
                  onAddNumbering={handleAddNumbering}
                  onDuplicateNumbering={handleDuplicateNumbering}
                  onDeleteNumbering={handleDeleteNumbering}
                  onUpdateNumbering={handleUpdateNumbering}
                  onUpdateNumberingItem={handleUpdateNumberingItem}
                  onApplyNumberingToAll={handleApplyNumberingToAll}
                  onApplyNumberingToOdd={handleApplyNumberingToOdd}
                  onApplyNumberingToEven={handleApplyNumberingToEven}
                />
              )}

              {/* TAB 4 & 5: Move & Crop and Image Adjustments */}
              {(activeTool === 'move' || activeTool === 'crop') && (
                <>
                  {/* Simultaneous Multi-Page Batch Apply Card */}
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col gap-2.5 ${
                      isDark
                        ? 'bg-blue-950/40 border-blue-800/60 text-blue-200'
                        : 'bg-blue-50 border-blue-200 text-blue-900'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        <CheckCheck className="w-4 h-4 text-blue-500" />
                        <span>اعمال همزمان روی انتخاب‌شده‌ها</span>
                      </span>
                      <span className="font-mono px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px]">
                        {selectedPages.size} صفحه
                      </span>
                    </div>

                    {/* Auto-Sync Toggle Switch */}
                    <label className="flex items-start gap-2 text-[11px] cursor-pointer select-none bg-blue-600/10 dark:bg-blue-900/30 p-2 rounded-lg border border-blue-500/20">
                      <input
                        type="checkbox"
                        checked={autoSyncToSelected}
                        onChange={(e) => setAutoSyncToSelected(e.target.checked)}
                        className="accent-blue-600 mt-0.5"
                      />
                      <div>
                        <span className="font-bold block">همگام‌سازی زنده و آنی</span>
                        <span className="text-[10px] opacity-80 block">
                          با جابجایی ۸ نقطه یا اسلایدرها، کراپ و نور همزمان روی تمام {selectedPages.size} صفحه تغییر می‌کند.
                        </span>
                      </div>
                    </label>

                    <button
                      onClick={handleApplyToSelected}
                      disabled={selectedPages.size === 0}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>اعمال تنظیمات این صفحه روی {selectedPages.size} صفحه انتخاب شده</span>
                    </button>
                    <button
                      onClick={handleApplyToAll}
                      className={`w-full py-1.5 px-3 rounded-lg border text-[11px] font-medium transition-colors ${
                        isDark
                          ? 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700 text-neutral-300'
                          : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                      }`}
                    >
                      اعمال روی تمام {totalPages} صفحه سند
                    </button>
                  </div>

                  {/* Section 1 (Default & Primary): Image Positioning & Content Offset */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5 text-xs text-blue-500">
                        <Move className="w-4 h-4" />
                        <span>جابجایی موقعیت تصویر در صفحه (پیش‌فرض)</span>
                      </span>
                      {((currentAdj.offsetX || 0) !== 0 || (currentAdj.offsetY || 0) !== 0 || (currentAdj.scale || 100) !== 100) && (
                        <button
                          type="button"
                          onClick={() => updateCurrentAdj({ offsetX: 0, offsetY: 0, scale: 100 })}
                          className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Crosshair className="w-3 h-3" />
                          <span>مرکز صفحه (۰,۰)</span>
                        </button>
                      )}
                    </div>

                    {/* Horizontal Shift (X) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-400 font-medium">جابجایی افقی (X):</span>
                        <div className="flex items-center gap-1 font-mono">
                          <span className={((currentAdj.offsetX || 0) !== 0) ? 'text-blue-500 font-bold' : 'text-neutral-400'}>
                            {currentAdj.offsetX || 0}%
                          </span>
                          <span className="text-[10px] text-neutral-400">
                            ({Math.round(((currentAdj.offsetX || 0) / 100) * pageWidthMm)}mm)
                          </span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="0.5"
                        value={currentAdj.offsetX || 0}
                        onChange={(e) => updateCurrentAdj({ offsetX: parseFloat(e.target.value) || 0 })}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>

                    {/* Vertical Shift (Y) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-400 font-medium">جابجایی عمودی (Y):</span>
                        <div className="flex items-center gap-1 font-mono">
                          <span className={((currentAdj.offsetY || 0) !== 0) ? 'text-blue-500 font-bold' : 'text-neutral-400'}>
                            {currentAdj.offsetY || 0}%
                          </span>
                          <span className="text-[10px] text-neutral-400">
                            ({Math.round(((currentAdj.offsetY || 0) / 100) * pageHeightMm)}mm)
                          </span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="0.5"
                        value={currentAdj.offsetY || 0}
                        onChange={(e) => updateCurrentAdj({ offsetY: parseFloat(e.target.value) || 0 })}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>

                    {/* Scale Factor */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-400 font-medium">مقیاس اندازه تصویر (Scale):</span>
                        <span className="font-mono text-blue-500 font-bold">{currentAdj.scale || 100}%</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="180"
                        step="1"
                        value={currentAdj.scale || 100}
                        onChange={(e) => updateCurrentAdj({ scale: parseInt(e.target.value) || 100 })}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>

                    {/* Directional Nudge Pad (D-Pad) */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-neutral-400">تنظیم دقیق با جهت‌ها:</span>
                      <div className="grid grid-cols-3 gap-1 w-24">
                        <div />
                        <button
                          type="button"
                          onClick={() => updateCurrentAdj({ offsetY: Math.max(-50, (currentAdj.offsetY || 0) - 2) })}
                          className={`p-1 rounded border text-center flex items-center justify-center cursor-pointer ${
                            isDark ? 'bg-neutral-800 hover:bg-neutral-750 border-neutral-700 text-neutral-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                          }`}
                          title="حرکت به بالا"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <div />

                        <button
                          type="button"
                          onClick={() => updateCurrentAdj({ offsetX: Math.max(-50, (currentAdj.offsetX || 0) - 2) })}
                          className={`p-1 rounded border text-center flex items-center justify-center cursor-pointer ${
                            isDark ? 'bg-neutral-800 hover:bg-neutral-750 border-neutral-700 text-neutral-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                          }`}
                          title="حرکت به چپ"
                        >
                          <ArrowLeft className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCurrentAdj({ offsetX: 0, offsetY: 0 })}
                          className="p-1 rounded bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs cursor-pointer"
                          title="ریست به مرکز (۰,۰)"
                        >
                          <Crosshair className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCurrentAdj({ offsetX: Math.min(50, (currentAdj.offsetX || 0) + 2) })}
                          className={`p-1 rounded border text-center flex items-center justify-center cursor-pointer ${
                            isDark ? 'bg-neutral-800 hover:bg-neutral-750 border-neutral-700 text-neutral-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                          }`}
                          title="حرکت به راست"
                        >
                          <ArrowRight className="w-3 h-3" />
                        </button>

                        <div />
                        <button
                          type="button"
                          onClick={() => updateCurrentAdj({ offsetY: Math.min(50, (currentAdj.offsetY || 0) + 2) })}
                          className={`p-1 rounded border text-center flex items-center justify-center cursor-pointer ${
                            isDark ? 'bg-neutral-800 hover:bg-neutral-750 border-neutral-700 text-neutral-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                          }`}
                          title="حرکت به پایین"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <div />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Crop & Margins */}
                  <div className={`pt-3 border-t space-y-3 ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5 text-xs text-purple-500">
                        <Scissors className="w-4 h-4" />
                        <span>برش و کراپ حاشیه‌ها (۸ نقطه)</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTool(activeTool === 'crop' ? 'move' : 'crop')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                            activeTool === 'crop'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : isDark
                              ? 'bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {activeTool === 'crop' ? 'ابزار کراپ فعال است' : 'فعال‌سازی کراپ'}
                        </button>
                        <button
                          onClick={handleResetCrop}
                          className="text-[10px] text-purple-500 hover:underline cursor-pointer"
                        >
                          ریست کراپ
                        </button>
                      </div>
                    </div>

                    {/* 4 Margins Inputs (Top, Bottom, Left, Right) */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {/* Top Margin */}
                      <div
                        className={`p-2 rounded-lg border ${
                          isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <label className="text-neutral-400 block mb-1">
                          حاشیه بالا (Top)
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="40"
                            step="0.5"
                            value={currentAdj.crop.top}
                            onChange={(e) =>
                              handleCropChange({
                                ...currentAdj.crop,
                                top: Math.max(0, Math.min(40, parseFloat(e.target.value) || 0)),
                              })
                            }
                            className={`w-14 p-1 rounded border text-xs font-mono focus:outline-none ${
                              isDark
                                ? 'bg-neutral-900 border-neutral-750 text-white'
                                : 'bg-white border-slate-300 text-slate-800'
                            }`}
                          />
                          <span className="text-[10px] text-neutral-400 font-mono">%</span>
                          <span className="text-[10px] text-purple-500 font-mono ms-auto">
                            {topMm}mm
                          </span>
                        </div>
                      </div>

                      {/* Bottom Margin */}
                      <div
                        className={`p-2 rounded-lg border ${
                          isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <label className="text-neutral-400 block mb-1">
                          حاشیه پایین (Bottom)
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="40"
                            step="0.5"
                            value={currentAdj.crop.bottom}
                            onChange={(e) =>
                              handleCropChange({
                                ...currentAdj.crop,
                                bottom: Math.max(0, Math.min(40, parseFloat(e.target.value) || 0)),
                              })
                            }
                            className={`w-14 p-1 rounded border text-xs font-mono focus:outline-none ${
                              isDark
                                ? 'bg-neutral-900 border-neutral-750 text-white'
                                : 'bg-white border-slate-300 text-slate-800'
                            }`}
                          />
                          <span className="text-[10px] text-neutral-400 font-mono">%</span>
                          <span className="text-[10px] text-purple-500 font-mono ms-auto">
                            {bottomMm}mm
                          </span>
                        </div>
                      </div>

                      {/* Right Margin */}
                      <div
                        className={`p-2 rounded-lg border ${
                          isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <label className="text-neutral-400 block mb-1">
                          حاشیه راست (Right)
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="40"
                            step="0.5"
                            value={currentAdj.crop.right}
                            onChange={(e) =>
                              handleCropChange({
                                ...currentAdj.crop,
                                right: Math.max(0, Math.min(40, parseFloat(e.target.value) || 0)),
                              })
                            }
                            className={`w-14 p-1 rounded border text-xs font-mono focus:outline-none ${
                              isDark
                                ? 'bg-neutral-900 border-neutral-750 text-white'
                                : 'bg-white border-slate-300 text-slate-800'
                            }`}
                          />
                          <span className="text-[10px] text-neutral-400 font-mono">%</span>
                          <span className="text-[10px] text-purple-500 font-mono ms-auto">
                            {rightMm}mm
                          </span>
                        </div>
                      </div>

                      {/* Left Margin */}
                      <div
                        className={`p-2 rounded-lg border ${
                          isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <label className="text-neutral-400 block mb-1">
                          حاشیه چپ (Left)
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="40"
                            step="0.5"
                            value={currentAdj.crop.left}
                            onChange={(e) =>
                              handleCropChange({
                                ...currentAdj.crop,
                                left: Math.max(0, Math.min(40, parseFloat(e.target.value) || 0)),
                              })
                            }
                            className={`w-14 p-1 rounded border text-xs font-mono focus:outline-none ${
                              isDark
                                ? 'bg-neutral-900 border-neutral-750 text-white'
                                : 'bg-white border-slate-300 text-slate-800'
                            }`}
                          />
                          <span className="text-[10px] text-neutral-400 font-mono">%</span>
                          <span className="text-[10px] text-purple-500 font-mono ms-auto">
                            {leftMm}mm
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Crop Presets */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        onClick={handleTrim5Percent}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-neutral-800 hover:bg-neutral-750 border-neutral-700 text-neutral-300'
                            : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                        }`}
                      >
                        حذف ۵٪ حاشیه سفید
                      </button>
                      <button
                        onClick={handleBindingGutter}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-neutral-800 hover:bg-neutral-750 border-neutral-700 text-neutral-300'
                            : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                        }`}
                      >
                        مارجین صحافی (Gutter)
                      </button>
                    </div>
                  </div>

                  {/* Section 3: Brightness & Contrast */}
                  <div className={`pt-3 border-t space-y-3 ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>{t.brightness}</span>
                      </span>
                      <span className="font-mono text-neutral-400 font-medium">
                        {currentAdj.brightness}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="180"
                      step="5"
                      value={currentAdj.brightness}
                      onChange={(e) => updateCurrentAdj({ brightness: Number(e.target.value) })}
                      className="w-full accent-blue-600 cursor-pointer"
                    />

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-bold flex items-center gap-1.5">
                        <Contrast className="w-3.5 h-3.5 text-blue-500" />
                        <span>{t.contrast}</span>
                      </span>
                      <span className="font-mono text-neutral-400 font-medium">
                        {currentAdj.contrast}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="200"
                      step="5"
                      value={currentAdj.contrast}
                      onChange={(e) => updateCurrentAdj({ contrast: Number(e.target.value) })}
                      className="w-full accent-blue-600 cursor-pointer"
                    />

                    {/* Filters */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        onClick={() => updateCurrentAdj({ threshold: !currentAdj.threshold })}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                          currentAdj.threshold
                            ? 'bg-blue-600 text-white border-blue-500'
                            : isDark
                            ? 'bg-neutral-800 border-neutral-750 text-neutral-300 hover:bg-neutral-750'
                            : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {t.filterBw}
                      </button>
                      <button
                        onClick={() => updateCurrentAdj({ grayscale: !currentAdj.grayscale })}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                          currentAdj.grayscale
                            ? 'bg-blue-600 text-white border-blue-500'
                            : isDark
                            ? 'bg-neutral-800 border-neutral-750 text-neutral-300 hover:bg-neutral-750'
                            : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {t.filterGrayscale}
                      </button>
                    </div>
                  </div>

                  {/* Section 4: Deskew & Fine Angle Alignment */}
                  <div className={`pt-3 border-t space-y-3 ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5 text-xs">
                        <Compass className="w-4 h-4 text-emerald-500" />
                        <span>اصلاح زاویه و چرخش سند (Deskew)</span>
                      </span>
                      {((currentAdj.rotation || 0) !== 0 || (currentAdj.fineAngle || 0) !== 0) && (
                        <button
                          onClick={() => updateCurrentAdj({ rotation: 0, fineAngle: 0 })}
                          className="text-[10px] text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>تراز صفر (۰°)</span>
                        </button>
                      )}
                    </div>

                    {/* 90-degree orthogonal rotations */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() =>
                          updateCurrentAdj({
                            rotation: ((currentAdj.rotation || 0) + 90) % 360,
                          })
                        }
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-neutral-800 hover:bg-neutral-750 border-neutral-700 text-neutral-200'
                            : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                        }`}
                        title="چرخش ۹۰ درجه در جهت عقربه‌های ساعت"
                      >
                        <RotateCw className="w-3 h-3 text-emerald-500" />
                        <span>۹۰° راست</span>
                      </button>

                      <button
                        onClick={() =>
                          updateCurrentAdj({
                            rotation: ((currentAdj.rotation || 0) + 270) % 360,
                          })
                        }
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-neutral-800 hover:bg-neutral-750 border-neutral-700 text-neutral-200'
                            : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                        }`}
                        title="چرخش ۹۰ درجه در خلاف جهت عقربه‌های ساعت"
                      >
                        <RotateCcw className="w-3 h-3 text-emerald-500" />
                        <span>۹۰° چپ</span>
                      </button>

                      <button
                        onClick={() =>
                          updateCurrentAdj({
                            rotation: ((currentAdj.rotation || 0) + 180) % 360,
                          })
                        }
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-neutral-800 hover:bg-neutral-750 border-neutral-700 text-neutral-200'
                            : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                        }`}
                        title="چرخش ۱۸۰ درجه وارونه"
                      >
                        <span>۱۸۰° وارونه</span>
                      </button>
                    </div>

                    {/* Fine Angle Slider & Direct Input */}
                    <div
                      className={`p-2.5 rounded-xl border space-y-2 ${
                        isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-neutral-400 font-medium">زاویه دقیق کجی (Fine Angle):</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="-45"
                            max="45"
                            step="0.1"
                            value={currentAdj.fineAngle ?? 0}
                            onChange={(e) =>
                              updateCurrentAdj({
                                fineAngle: Math.max(-45, Math.min(45, parseFloat(e.target.value) || 0)),
                              })
                            }
                            className={`w-16 p-1 rounded-lg border text-center text-xs font-mono font-bold focus:outline-none ${
                              isDark
                                ? 'bg-neutral-900 border-neutral-750 text-emerald-400'
                                : 'bg-white border-slate-300 text-emerald-600'
                            }`}
                          />
                          <span className="font-mono text-emerald-500 font-bold">°</span>
                        </div>
                      </div>

                      {/* Range Slider for Micro-angle Adjustment */}
                      <input
                        type="range"
                        min="-45"
                        max="45"
                        step="0.1"
                        value={currentAdj.fineAngle ?? 0}
                        onChange={(e) =>
                          updateCurrentAdj({
                            fineAngle: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full accent-emerald-500 cursor-pointer"
                      />

                      {/* Quick Fine-Angle Deskew Presets */}
                      <div className="flex items-center gap-1 pt-1 overflow-x-auto pb-0.5">
                        {[
                          { label: '-۵°', val: -5 },
                          { label: '-۲°', val: -2 },
                          { label: '-۱°', val: -1 },
                          { label: '-۰.۵°', val: -0.5 },
                          { label: '۰°', val: 0 },
                          { label: '+۰.۵°', val: 0.5 },
                          { label: '+۱°', val: 1 },
                          { label: '+۲°', val: 2 },
                          { label: '+۵°', val: 5 },
                        ].map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => updateCurrentAdj({ fineAngle: p.val })}
                            className={`flex-1 min-w-[28px] py-1 rounded border text-[10px] font-mono transition-colors ${
                              (currentAdj.fineAngle ?? 0) === p.val
                                ? 'bg-emerald-600 text-white border-emerald-500 font-bold'
                                : isDark
                                ? 'bg-neutral-850 hover:bg-neutral-800 border-neutral-750 text-neutral-300'
                                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
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
                {t.cancel}
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t.saveChanges}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Page Duplicate & Blank Page Modal */}
        {duplicateModalState.open && (
          <PageDuplicateModal
            mode={duplicateModalState.mode}
            activePage={activePage}
            totalPages={totalPages}
            theme={theme}
            isProcessing={isModifyingPdf}
            onClose={() => setDuplicateModalState({ open: false, mode: 'duplicate' })}
            onConfirmDuplicate={handleConfirmDuplicate}
            onConfirmBlank={handleConfirmBlank}
          />
        )}
      </div>
    </div>
  );
};
