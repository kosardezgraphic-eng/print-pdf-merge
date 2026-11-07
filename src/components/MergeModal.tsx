import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Merge,
  Save,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle,
  Layers,
  FolderCheck,
  Sun,
  Scissors,
  Hash,
  RefreshCw,
  RotateCw,
  CheckSquare,
  Square,
  Sliders,
  Sparkles,
  Grid,
  Move,
  Type,
  Shapes,
  Copy,
  PlusCircle,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Check,
  CheckCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { translations } from '../utils/translations';
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
import { mergePdfs, mergePdfsWithAdjustments, formatBytes, parsePageRange } from '../utils/pdfUtils';
import { renderPdfPageToDataUrl, defaultAdjustment } from '../utils/pdfRenderUtils';
import { savePdfFile } from '../utils/fileSystem';
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

interface MergeModalProps {
  items: PDFItem[];
  lang: Language;
  theme: 'dark' | 'light';
  onClose: () => void;
}

export interface MergedStudioPageItem {
  globalIndex: number; // 1-based index in merged sequence
  fileId: string;
  fileName: string;
  fileItem: PDFItem;
  pageNumInFile: number;
  adj: PageAdjustment;
}

export const MergeModal: React.FC<MergeModalProps> = ({ items, lang, theme, onClose }) => {
  const t = translations[lang];
  const isDark = theme === 'dark';

  // Modal mode: 'quick' or 'studio'
  const [activeTab, setActiveTab] = useState<'quick' | 'studio'>('studio');

  // Default output filename
  const defaultName = `Merged_Documents_${new Date().toISOString().slice(0, 10)}.pdf`;
  const [fileName, setFileName] = useState(defaultName);
  const [mergeScope, setMergeScope] = useState<'selected' | 'all'>('selected');

  // Target files
  const targetItems =
    mergeScope === 'selected'
      ? items.filter((item) => item.selected)
      : items;

  const totalPagesInScope = targetItems.reduce(
    (sum, item) => sum + (item.pageCount || 0),
    0
  );

  // Process & result states
  const [isMerging, setIsMerging] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [mergedBlob, setMergedBlob] = useState<Blob | null>(null);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [mergedPages, setMergedPages] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [showPreviewResult, setShowPreviewResult] = useState(false);

  // -------------------------------------------------------------
  // ALL PAGES MERGE STUDIO STATE (3-Column Page Studio Parity)
  // -------------------------------------------------------------
  const [studioPages, setStudioPages] = useState<MergedStudioPageItem[]>([]);
  const [activePage, setActivePage] = useState<number>(1);
  const [lastClickedPage, setLastClickedPage] = useState<number>(1);

  // Selected pages for batch synchronization
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [autoSyncToSelected, setAutoSyncToSelected] = useState<boolean>(true);

  // Adjustments map key by global page index (1..N)
  const [adjustments, setAdjustments] = useState<Record<number, PageAdjustment>>({});

  // Caches for thumbnails & high-res canvas
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [highResCache, setHighResCache] = useState<Record<number, string>>({});
  const [loadingActivePage, setLoadingActivePage] = useState(false);

  // Canvas View Controls
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // Active Tool Tab: 'move' | 'crop' | 'text' | 'shape' | 'numbering' | 'measure'
  const [activeTool, setActiveTool] = useState<'move' | 'crop' | 'text' | 'shape' | 'numbering' | 'measure'>('move');

  // Measure Ruler Line State
  const [measureLine, setMeasureLine] = useState<MeasureLine | null>(null);

  // Selected Element IDs
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedNumberingId, setSelectedNumberingId] = useState<string | null>(null);

  // Custom Range Input
  const [customRangeText, setCustomRangeText] = useState<string>('');

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
    const zeroBased = parsePageRange(customRangeText, studioTotalPages);
    const oneBased = new Set(zeroBased.map((idx) => idx + 1));
    setSelectedPages(oneBased);
  };

  // Duplicate Modal State
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Dragging states
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const imageDragRafRef = useRef<number | null>(null);
  const dragImageStartRef = useRef<{
    startX: number;
    startY: number;
    initOffsetX: number;
    initOffsetY: number;
  }>({ startX: 0, startY: 0, initOffsetX: 0, initOffsetY: 0 });

  // Initialize studio pages sequence across target files
  useEffect(() => {
    const list: MergedStudioPageItem[] = [];
    const newAdjustments: Record<number, PageAdjustment> = {};
    let globalIdx = 1;

    for (const item of targetItems) {
      const pageCount = item.pageCount || 1;
      for (let p = 1; p <= pageCount; p++) {
        const existingAdj = item.pageAdjustments?.[p];
        const adjToUse: PageAdjustment = existingAdj
          ? JSON.parse(JSON.stringify(existingAdj))
          : { ...defaultAdjustment, rotation: item.rotation || 0 };

        list.push({
          globalIndex: globalIdx,
          fileId: item.id,
          fileName: item.name,
          fileItem: item,
          pageNumInFile: p,
          adj: adjToUse,
        });

        newAdjustments[globalIdx] = adjToUse;
        globalIdx++;
      }
    }

    setStudioPages(list);
    setAdjustments(newAdjustments);
    setSelectedPages(new Set(Array.from({ length: list.length }, (_, i) => i + 1)));
    if (list.length > 0) {
      setActivePage(1);
      setLastClickedPage(1);
    }
  }, [items, mergeScope]);

  // Total pages in merged studio
  const studioTotalPages = studioPages.length;

  // Load low-res thumbnails for page list
  useEffect(() => {
    if (activeTab !== 'studio' || studioPages.length === 0) return;
    let isMounted = true;

    const loadThumbs = async () => {
      for (const pageItem of studioPages) {
        const gIdx = pageItem.globalIndex;
        if (thumbnails[gIdx]) continue;

        try {
          const res = await renderPdfPageToDataUrl(pageItem.fileItem.file, pageItem.pageNumInFile, 0.4);
          if (!isMounted) break;
          setThumbnails((prev) => ({ ...prev, [gIdx]: res.dataUrl }));
        } catch (err) {
          console.warn(`Failed rendering thumbnail for global page ${gIdx}:`, err);
        }
        await new Promise((r) => setTimeout(r, 10));
      }
    };

    loadThumbs();
    return () => {
      isMounted = false;
    };
  }, [activeTab, studioPages.length]);

  // Load high-res rendering for active page canvas
  useEffect(() => {
    if (activeTab !== 'studio' || !activePage || studioPages.length === 0) return;

    const activeItem = studioPages.find((p) => p.globalIndex === activePage);
    if (!activeItem) return;

    if (highResCache[activePage]) return;

    let isMounted = true;
    setLoadingActivePage(true);

    renderPdfPageToDataUrl(activeItem.fileItem.file, activeItem.pageNumInFile, 2.0)
      .then((res) => {
        if (!isMounted) return;
        setHighResCache((prev) => ({ ...prev, [activePage]: res.dataUrl }));
      })
      .catch((err) => {
        console.error('High res render failed:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingActivePage(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, activePage, studioPages]);

  // Current active page adjustment
  const currentAdj = adjustments[activePage] || { ...defaultAdjustment };

  // Page adjustment updater with real-time batch synchronization
  const updateCurrentAdj = (
    updates: Partial<PageAdjustment> | ((prev: PageAdjustment) => PageAdjustment)
  ) => {
    setAdjustments((prevMap) => {
      const prevAdj = prevMap[activePage] || { ...defaultAdjustment };
      const updatedAdj = typeof updates === 'function' ? updates(prevAdj) : { ...prevAdj, ...updates };

      const nextMap = { ...prevMap, [activePage]: updatedAdj };

      // Synchronize to all selected pages if autoSyncToSelected is enabled
      if (autoSyncToSelected && selectedPages.size > 1) {
        for (const p of selectedPages) {
          if (p === activePage) continue;
          const targetPrev = prevMap[p] || { ...defaultAdjustment };

          nextMap[p] = {
            ...targetPrev,
            brightness: updatedAdj.brightness,
            contrast: updatedAdj.contrast,
            grayscale: updatedAdj.grayscale,
            threshold: updatedAdj.threshold,
            invert: updatedAdj.invert,
            crop: { ...updatedAdj.crop },
            rotation: updatedAdj.rotation,
            fineAngle: updatedAdj.fineAngle,
            offsetX: updatedAdj.offsetX,
            offsetY: updatedAdj.offsetY,
            scale: updatedAdj.scale,
            texts: updatedAdj.texts ? JSON.parse(JSON.stringify(updatedAdj.texts)) : targetPrev.texts,
            shapes: updatedAdj.shapes ? JSON.parse(JSON.stringify(updatedAdj.shapes)) : targetPrev.shapes,
            pageNumbering: updatedAdj.pageNumbering ? { ...updatedAdj.pageNumbering } : targetPrev.pageNumbering,
            pageNumberings: updatedAdj.pageNumberings ? JSON.parse(JSON.stringify(updatedAdj.pageNumberings)) : targetPrev.pageNumberings,
          };
        }
      }

      return nextMap;
    });
  };

  // -------------------------------------------------------------
  // BATCH PAGE SELECTION FILTERS
  // -------------------------------------------------------------
  const handleSelectAllPages = () => {
    setSelectedPages(new Set(Array.from({ length: studioTotalPages }, (_, i) => i + 1)));
  };

  const handleSelectOddPages = () => {
    const odds = new Set<number>();
    for (let p = 1; p <= studioTotalPages; p++) {
      if (p % 2 !== 0) odds.add(p);
    }
    setSelectedPages(odds);
  };

  const handleSelectEvenPages = () => {
    const evens = new Set<number>();
    for (let p = 1; p <= studioTotalPages; p++) {
      if (p % 2 === 0) evens.add(p);
    }
    setSelectedPages(evens);
  };

  const handleInvertPageSelection = () => {
    const inverted = new Set<number>();
    for (let p = 1; p <= studioTotalPages; p++) {
      if (!selectedPages.has(p)) inverted.add(p);
    }
    setSelectedPages(inverted);
  };

  const handleSelectAllForPrint = (enable: boolean) => {
    setAdjustments((prev) => {
      const next = { ...prev };
      for (let p = 1; p <= studioTotalPages; p++) {
        next[p] = { ...(next[p] || defaultAdjustment), selectedForPrint: enable };
      }
      return next;
    });
  };

  const handleSelectOddForPrint = () => {
    setAdjustments((prev) => {
      const next = { ...prev };
      for (let p = 1; p <= studioTotalPages; p++) {
        next[p] = { ...(next[p] || defaultAdjustment), selectedForPrint: p % 2 !== 0 };
      }
      return next;
    });
  };

  const handleSelectEvenForPrint = () => {
    setAdjustments((prev) => {
      const next = { ...prev };
      for (let p = 1; p <= studioTotalPages; p++) {
        next[p] = { ...(next[p] || defaultAdjustment), selectedForPrint: p % 2 === 0 };
      }
      return next;
    });
  };

  // Batch Apply Buttons
  const handleApplyToSelectedPages = () => {
    if (selectedPages.size === 0) return;
    const sourceAdj = adjustments[activePage] || defaultAdjustment;

    setAdjustments((prev) => {
      const next = { ...prev };
      for (const p of selectedPages) {
        next[p] = JSON.parse(JSON.stringify(sourceAdj));
      }
      return next;
    });
  };

  const handleApplyToAllPages = () => {
    const sourceAdj = adjustments[activePage] || defaultAdjustment;
    setAdjustments((prev) => {
      const next = { ...prev };
      for (let p = 1; p <= studioTotalPages; p++) {
        next[p] = JSON.parse(JSON.stringify(sourceAdj));
      }
      return next;
    });
  };

  // -------------------------------------------------------------
  // CROP HANDLER
  // -------------------------------------------------------------
  const handleCropChange = (newCrop: { top: number; bottom: number; left: number; right: number }) => {
    updateCurrentAdj({ crop: newCrop });
  };

  // -------------------------------------------------------------
  // OVERLAY ELEMENTS HANDLERS (TEXT, SHAPE, NUMBERING)
  // -------------------------------------------------------------
  const currentTexts = currentAdj.texts || [];
  const currentShapes = currentAdj.shapes || [];

  const handleAddText = () => {
    const newText: PageOverlayText = {
      id: `text-${Date.now()}`,
      text: 'عنوان یا متن جدید',
      xPercent: 50,
      yPercent: 50,
      fontSize: 18,
      fontFamily: 'Vazirmatn, sans-serif',
      color: '#1e293b',
      align: 'center',
      opacity: 1,
      rotation: 0,
    };
    updateCurrentAdj({ texts: [...currentTexts, newText] });
    setSelectedTextId(newText.id);
    setActiveTool('text');
  };

  const handleUpdateText = (id: string, updates: Partial<PageOverlayText>) => {
    updateCurrentAdj({
      texts: currentTexts.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    });
  };

  const handleDeleteText = (id: string) => {
    updateCurrentAdj({
      texts: currentTexts.filter((t) => t.id !== id),
    });
    if (selectedTextId === id) setSelectedTextId(null);
  };

  const handleDuplicateText = (id: string) => {
    const target = currentTexts.find((t) => t.id === id);
    if (!target) return id;
    const dup: PageOverlayText = {
      ...JSON.parse(JSON.stringify(target)),
      id: `text-${Date.now()}`,
      xPercent: Math.min(95, target.xPercent + 3),
      yPercent: Math.min(95, target.yPercent + 3),
    };
    updateCurrentAdj({ texts: [...currentTexts, dup] });
    setSelectedTextId(dup.id);
    return dup.id;
  };

  const handleAddShape = (type: ShapeType) => {
    const newShape: PageOverlayShape = {
      id: `shape-${Date.now()}`,
      type,
      xPercent: 50,
      yPercent: 50,
      widthPercent: 30,
      heightPercent: 20,
      fillColor: type === 'line' || type === 'arrow' ? 'transparent' : 'rgba(59, 130, 246, 0.15)',
      strokeColor: '#3b82f6',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
      rotation: 0,
    };
    updateCurrentAdj({ shapes: [...currentShapes, newShape] });
    setSelectedShapeId(newShape.id);
    setActiveTool('shape');
  };

  const handleUpdateShape = (id: string, updates: Partial<PageOverlayShape>) => {
    updateCurrentAdj({
      shapes: currentShapes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    });
  };

  const handleDeleteShape = (id: string) => {
    updateCurrentAdj({
      shapes: currentShapes.filter((s) => s.id !== id),
    });
    if (selectedShapeId === id) setSelectedShapeId(null);
  };

  const handleDuplicateShape = (id: string) => {
    const target = currentShapes.find((s) => s.id === id);
    if (!target) return id;
    const dup: PageOverlayShape = {
      ...JSON.parse(JSON.stringify(target)),
      id: `shape-${Date.now()}`,
      xPercent: Math.min(95, target.xPercent + 3),
      yPercent: Math.min(95, target.yPercent + 3),
    };
    updateCurrentAdj({ shapes: [...currentShapes, dup] });
    setSelectedShapeId(dup.id);
    return dup.id;
  };

  // Dynamic Page Numbering
  const currentNumberingsList = currentAdj.pageNumberings && currentAdj.pageNumberings.length > 0
    ? currentAdj.pageNumberings
    : (currentAdj.pageNumbering ? [currentAdj.pageNumbering] : []);

  const handleAddNumbering = () => {
    const newNum: PageOverlayNumbering = {
      id: `num-${Date.now()}`,
      enabled: true,
      xPercent: 50,
      yPercent: 94,
      fontSize: 14,
      fontFamily: 'Vazirmatn, sans-serif',
      color: '#1e293b',
      backgroundColor: 'rgba(255, 255, 255, 0.90)',
      opacity: 1,
      format: 'persian',
      template: 'صفحه {page} از {total}',
      startOffset: 0,
    };
    updateCurrentAdj({ pageNumberings: [...currentNumberingsList, newNum] });
    setSelectedNumberingId(newNum.id);
    setActiveTool('numbering');
  };

  const handleDuplicateNumbering = (id: string) => {
    const target = currentNumberingsList.find((n) => n.id === id);
    if (!target) return id;
    const dup: PageOverlayNumbering = {
      ...JSON.parse(JSON.stringify(target)),
      id: `num-${Date.now()}`,
      xPercent: Math.min(95, target.xPercent + 4),
      yPercent: Math.min(95, target.yPercent + 4),
    };
    updateCurrentAdj({ pageNumberings: [...currentNumberingsList, dup] });
    setSelectedNumberingId(dup.id);
    return dup.id;
  };

  const handleDeleteNumbering = (id: string) => {
    const nextList = currentNumberingsList.filter((n) => n.id !== id);
    updateCurrentAdj({ pageNumberings: nextList, pageNumbering: nextList[0] || undefined });
    if (selectedNumberingId === id) setSelectedNumberingId(nextList[0]?.id || null);
  };

  const handleUpdateNumbering = (updates: Partial<PageOverlayNumbering>) => {
    if (currentNumberingsList.length === 0) {
      handleAddNumbering();
      return;
    }
    const targetId = selectedNumberingId || currentNumberingsList[0].id;
    const nextList = currentNumberingsList.map((n) => (n.id === targetId ? { ...n, ...updates } : n));
    updateCurrentAdj({ pageNumberings: nextList, pageNumbering: nextList[0] });
  };

  const handleUpdateNumberingItem = (id: string, updates: Partial<PageOverlayNumbering>) => {
    const nextList = currentNumberingsList.map((n) => (n.id === id ? { ...n, ...updates } : n));
    updateCurrentAdj({ pageNumberings: nextList, pageNumbering: nextList[0] });
  };

  // Image Dragging
  const handleImagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== 'move') return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}

    dragImageStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initOffsetX: currentAdj.offsetX || 0,
      initOffsetY: currentAdj.offsetY || 0,
    };
    setIsDraggingImage(true);
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

      const newOffsetX = Number((dragImageStartRef.current.initOffsetX + deltaX * 0.25).toFixed(2));
      const newOffsetY = Number((dragImageStartRef.current.initOffsetY + deltaY * 0.25).toFixed(2));

      updateCurrentAdj({
        offsetX: Math.max(-100, Math.min(100, newOffsetX)),
        offsetY: Math.max(-100, Math.min(100, newOffsetY)),
      });
    });
  };

  const handleImagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingImage) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDraggingImage(false);
    if (imageDragRafRef.current !== null) {
      cancelAnimationFrame(imageDragRafRef.current);
      imageDragRafRef.current = null;
    }
  };

  // -------------------------------------------------------------
  // START MERGE FUNCTION (EXECUTE MERGE)
  // -------------------------------------------------------------
  const handleStartMerge = async () => {
    if (activeTab === 'quick') {
      if (targetItems.length < 2) {
        setErrorMessage(t.selectAtLeastTwo);
        return;
      }
    } else {
      const activePagesToMerge = studioPages.filter(
        (p) => adjustments[p.globalIndex]?.selectedForPrint !== false
      );
      if (activePagesToMerge.length < 1) {
        setErrorMessage('لطفاً حداقل یک صفحه برای ادغام انتخاب کنید.');
        return;
      }
    }

    setIsMerging(true);
    setErrorMessage(null);
    setProgressPercent(10);
    setProgressText('در حال پردازش و رندر صفحات ادغام...');

    try {
      let result: { blob: Blob; totalPages: number };

      if (activeTab === 'quick') {
        result = await mergePdfs(targetItems, (current, total, name) => {
          const pct = Math.round((current / total) * 90);
          setProgressPercent(pct);
          setProgressText(`در حال ادغام سریع: ${name} (${current} از ${total})`);
        });
      } else {
        const pagesToProcess = studioPages
          .filter((p) => adjustments[p.globalIndex]?.selectedForPrint !== false)
          .map((p) => ({
            file: p.fileItem.file,
            fileName: p.fileName,
            pageNumInFile: p.pageNumInFile,
            adj: adjustments[p.globalIndex] || defaultAdjustment,
          }));

        result = await mergePdfsWithAdjustments(
          pagesToProcess,
          undefined,
          (current, total, msg) => {
            const pct = Math.round((current / total) * 95);
            setProgressPercent(pct);
            setProgressText(msg);
          }
        );
      }

      const url = URL.createObjectURL(result.blob);
      setMergedBlob(result.blob);
      setMergedUrl(url);
      setMergedPages(result.totalPages);
      setProgressPercent(100);
      setProgressText('ادغام با موفقیت انجام شد!');

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err) {
      console.error('Merge failure:', err);
      setErrorMessage((err as Error).message || t.errorMerging);
    } finally {
      setIsMerging(false);
    }
  };

  const handleSaveToDisk = async () => {
    if (!mergedBlob) return;
    setSaveSuccessMsg(null);
    const res = await savePdfFile(mergedBlob, fileName);
    if (res.success) {
      setSaveSuccessMsg(
        res.method === 'picker'
          ? 'فایل با موفقیت در پوشه ویندوز شما ذخیره شد!'
          : 'فایل با موفقیت دانلود و ذخیره شد!'
      );
    }
  };

  const handleDirectDownload = () => {
    if (!mergedBlob) return;
    const cleanName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    const url = URL.createObjectURL(mergedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setSaveSuccessMsg('فایل آماده دانلود و ذخیره شد.');
  };

  // Dimensions
  const activeItem = studioPages.find((p) => p.globalIndex === activePage);
  const activeImageDataUrl = highResCache[activePage] || thumbnails[activePage];
  const totalPageAngle = ((currentAdj.rotation || 0) + (currentAdj.fineAngle || 0)) % 360;
  const pageWidthMm = 210;
  const pageHeightMm = 297;

  // CSS Filter string for active page image
  const activeFilters = [
    currentAdj.brightness !== 100 ? `brightness(${currentAdj.brightness}%)` : '',
    currentAdj.contrast !== 100 ? `contrast(${currentAdj.contrast}%)` : '',
    currentAdj.grayscale ? 'grayscale(100%)' : '',
    currentAdj.threshold ? 'contrast(200%) grayscale(100%)' : '',
    currentAdj.invert ? 'invert(100%)' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
      <div
        className={`w-full max-w-7xl h-[94vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-colors ${
          isDark
            ? 'bg-neutral-900 border-neutral-750 text-neutral-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Top Header Bar */}
        <div
          className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 ${
            isDark ? 'bg-neutral-950/90 border-neutral-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-500 font-bold">
              <Merge className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>استودیو ادغام و پیش‌نمایش تمام صفحات</span>
                <span className="text-[11px] font-normal text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                  {targetItems.length} فایل · {studioTotalPages} صفحه
                </span>
              </h3>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center gap-2 bg-neutral-900/40 p-1 rounded-xl border border-neutral-800">
            <button
              type="button"
              onClick={() => setActiveTab('studio')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'studio'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark
                  ? 'text-neutral-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>استودیو ۳ ستونه پیش‌نمایش و ادغام</span>
              <Sparkles className="w-3 h-3 text-yellow-300" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('quick')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'quick'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : isDark
                  ? 'text-neutral-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Merge className="w-3.5 h-3.5" />
              <span>ادغام سریع فایلی</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStartMerge}
              disabled={isMerging}
              className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Check className="w-4 h-4" />
              <span>تایید و ادغام</span>
            </button>

            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-slate-500 hover:text-black hover:bg-slate-200'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {mergedBlob ? (
          /* RESULT SCREEN */
          <div className="p-6 space-y-4 max-w-2xl mx-auto overflow-y-auto my-auto w-full">
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                isDark
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-bold">{t.mergeComplete}</h4>
                <p className="text-xs mt-1 leading-relaxed">
                  فایل ادغام شده با تمام فیلترهای کراپ، نور و شماره‌گذاری با موفقیت ساخته شد.
                </p>
                <div className="mt-2.5 flex items-center gap-3 text-xs font-mono">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    {mergedPages} {t.pagesUnit} نهایی
                  </span>
                  <span>·</span>
                  <span>حجم: {formatBytes(mergedBlob.size)}</span>
                </div>
              </div>
            </div>

            {saveSuccessMsg && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                  isDark
                    ? 'bg-blue-950/50 border-blue-800/50 text-blue-300'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}
              >
                <FolderCheck className="w-4 h-4 text-blue-500 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleSaveToDisk}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-600/30 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{t.saveToDisk}</span>
              </button>

              <button
                onClick={handleDirectDownload}
                className={`flex items-center justify-center gap-2 px-4 py-3 font-medium text-sm rounded-xl border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border-neutral-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>{t.directDownload}</span>
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowPreviewResult(!showPreviewResult)}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-neutral-850 hover:bg-neutral-800 text-neutral-300 border-neutral-750'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                }`}
              >
                <Eye className="w-4 h-4 text-blue-500" />
                <span>
                  {showPreviewResult ? 'بستن پیش‌نمایش سند' : t.previewOutput}
                </span>
              </button>

              {showPreviewResult && mergedUrl && (
                <div
                  className={`mt-3 h-96 w-full rounded-xl border overflow-hidden ${
                    isDark ? 'border-neutral-750 bg-neutral-950' : 'border-slate-300 bg-slate-100'
                  }`}
                >
                  <iframe
                    src={`${mergedUrl}#toolbar=1`}
                    title="Merged PDF Preview"
                    className="w-full h-full border-0"
                  />
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'quick' ? (
          /* QUICK MERGE */
          <div className="p-6 space-y-4 max-w-xl mx-auto my-auto w-full">
            <div>
              <label className="block text-xs font-medium mb-1.5">
                {t.outputFileName}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="my_merged_document.pdf"
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none font-mono ${
                    isDark
                      ? 'bg-neutral-950 border-neutral-750 focus:border-blue-500 text-white placeholder:text-neutral-500'
                      : 'bg-slate-50 border-slate-300 focus:border-blue-500 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
                <span className="absolute end-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
                  .pdf
                </span>
              </div>
            </div>

            <div
              className={`border rounded-xl p-3.5 space-y-2 ${
                isDark ? 'bg-neutral-950/80 border-neutral-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-medium">
                <span>خلاصه اسناد ادغام:</span>
                <span className="font-mono text-blue-500 font-bold">
                  {targetItems.length} فایل · {totalPagesInScope} صفحه
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pe-1">
                {targetItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg ${
                      isDark ? 'bg-neutral-900/60 text-neutral-300' : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    <span className="truncate max-w-[280px] font-medium">
                      {idx + 1}. {item.name}
                    </span>
                    <span className="font-mono text-neutral-400">
                      {item.pageCount} صفحه
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {isMerging && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>{progressText}</span>
                  <span className="font-mono font-bold text-blue-500">
                    {progressPercent}%
                  </span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-200 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isMerging}
                className={`px-4 py-2 text-xs font-medium border rounded-xl transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border-neutral-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                {t.cancel}
              </button>

              <button
                type="button"
                onClick={handleStartMerge}
                disabled={isMerging || targetItems.length < 2}
                className="flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-blue-600/30 transition-all cursor-pointer"
              >
                <Merge className="w-4 h-4" />
                <span>{isMerging ? 'در حال ادغام...' : t.startMerge}</span>
              </button>
            </div>
          </div>
        ) : (
          /* FULL 3-COLUMN WORKBENCH STUDIO PARITY */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            {/* Column 1: Left Controls Sidebar */}
            <div
              className={`w-full md:w-80 border-b md:border-b-0 md:border-e flex flex-col overflow-hidden shrink-0 transition-colors ${
                isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200'
              }`}
            >
              {/* Tool Navigation Tabs */}
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
                  title="موقعیت و مقیاس تصویر"
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
                  title="برش و کراپ ۸ نقطه‌ای"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>کراپ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('text')}
                  className={`py-1.5 px-0.5 rounded-lg text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                    activeTool === 'text'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isDark
                      ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                  title="متون و واترمارک روی صفحات"
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>متن ({currentTexts.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('shape')}
                  className={`py-1.5 px-0.5 rounded-lg text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                    activeTool === 'shape'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : isDark
                      ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                  title="اشکال و خطوط گرافیکی"
                >
                  <Shapes className="w-3.5 h-3.5" />
                  <span>اشکال ({currentShapes.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('numbering')}
                  className={`py-1.5 px-0.5 rounded-lg text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                    activeTool === 'numbering'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : isDark
                      ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                  title="شماره‌گذاری پویای صفحات"
                >
                  <Hash className="w-3.5 h-3.5" />
                  <span>شماره ({currentNumberingsList.length})</span>
                </button>
              </div>

              {/* Batch Synchronization Control Box */}
              <div className="p-2.5 border-b space-y-2 bg-blue-950/20 border-blue-900/30">
                <div className="flex items-center justify-between text-xs font-bold text-blue-400">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>اعمال همزمان روی انتخاب‌شده‌ها</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                    {selectedPages.size} صفحه
                  </span>
                </div>

                <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSyncToSelected}
                    onChange={(e) => setAutoSyncToSelected(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-neutral-300 font-semibold">همگام‌سازی زنده و آنی</span>
                </label>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={handleApplyToSelectedPages}
                    className="py-1 px-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg shadow-xs transition-all cursor-pointer truncate"
                  >
                    اعمال روی {selectedPages.size} صفحه انتخاب شده
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyToAllPages}
                    className="py-1 px-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-[10px] font-medium border border-neutral-700 rounded-lg transition-all cursor-pointer truncate"
                  >
                    اعمال روی تمام {studioTotalPages} صفحه
                  </button>
                </div>
              </div>

              {/* Sidebar Active Tool Panel Body */}
              <div className="p-3 overflow-y-auto flex-1 space-y-4">
                {activeTool === 'move' && (
                  <div className="space-y-4 text-xs">
                    {/* Direction Fine Tune */}
                    <div className="space-y-1">
                      <span className="text-neutral-400 text-[11px] font-bold block">جابجایی موقعیت تصویر (پیش‌فرض)</span>
                      <div className="flex items-center justify-between text-[11px]">
                        <span>افقی (X): {currentAdj.offsetX || 0}%</span>
                        <span>عمودی (Y): {currentAdj.offsetY || 0}%</span>
                      </div>
                      <div className="flex items-center justify-center gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => updateCurrentAdj({ offsetY: (currentAdj.offsetY || 0) - 2 })}
                          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCurrentAdj({ offsetX: (currentAdj.offsetX || 0) - 2 })}
                          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCurrentAdj({ offsetX: 0, offsetY: 0 })}
                          className="p-1.5 bg-blue-600 text-white rounded font-bold"
                          title="بازنشانی به مرکز"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCurrentAdj({ offsetX: (currentAdj.offsetX || 0) + 2 })}
                          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCurrentAdj({ offsetY: (currentAdj.offsetY || 0) + 2 })}
                          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Scale */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span>مقیاس اندازه تصویر (Scale):</span>
                        <span className="font-mono font-bold text-blue-400">{currentAdj.scale || 100}%</span>
                      </div>
                      <input
                        type="range"
                        min="40"
                        max="200"
                        value={currentAdj.scale || 100}
                        onChange={(e) => updateCurrentAdj({ scale: Number(e.target.value) })}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                    </div>

                    {/* Brightness & Contrast */}
                    <div className="space-y-2 pt-2 border-t border-neutral-800">
                      <span className="font-bold flex items-center gap-1 text-xs text-amber-400">
                        <Sun className="w-3.5 h-3.5" />
                        <span>نور و کنتراست صفحه</span>
                      </span>

                      <div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span>روشنایی:</span>
                          <span className="font-mono">{currentAdj.brightness || 100}%</span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="200"
                          value={currentAdj.brightness || 100}
                          onChange={(e) => updateCurrentAdj({ brightness: Number(e.target.value) })}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span>کنتراست:</span>
                          <span className="font-mono">{currentAdj.contrast || 100}%</span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="200"
                          value={currentAdj.contrast || 100}
                          onChange={(e) => updateCurrentAdj({ contrast: Number(e.target.value) })}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-1 text-[11px]">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentAdj.grayscale || false}
                            onChange={(e) => updateCurrentAdj({ grayscale: e.target.checked })}
                            className="rounded text-amber-600 focus:ring-0 cursor-pointer"
                          />
                          <span>سیاه‌وسفید</span>
                        </label>

                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentAdj.threshold || false}
                            onChange={(e) => updateCurrentAdj({ threshold: e.target.checked })}
                            className="rounded text-amber-600 focus:ring-0 cursor-pointer"
                          />
                          <span>تک‌رنگ (B&W)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {activeTool === 'crop' && (
                  <div className="space-y-3 text-xs">
                    <span className="font-bold flex items-center gap-1.5 text-purple-400">
                      <Scissors className="w-4 h-4" />
                      <span>تنظیم حاشیه‌های کراپ ۸ نقطه‌ای (٪)</span>
                    </span>

                    <div className="space-y-2">
                      <div>
                        <span className="text-neutral-400 text-[11px]">حاشیه بالا: {currentAdj.crop?.top || 0}%</span>
                        <input
                          type="range"
                          min="0"
                          max="40"
                          value={currentAdj.crop?.top || 0}
                          onChange={(e) => handleCropChange({ ...currentAdj.crop, top: Number(e.target.value) })}
                          className="w-full accent-purple-500 cursor-pointer"
                        />
                      </div>

                      <div>
                        <span className="text-neutral-400 text-[11px]">حاشیه پایین: {currentAdj.crop?.bottom || 0}%</span>
                        <input
                          type="range"
                          min="0"
                          max="40"
                          value={currentAdj.crop?.bottom || 0}
                          onChange={(e) => handleCropChange({ ...currentAdj.crop, bottom: Number(e.target.value) })}
                          className="w-full accent-purple-500 cursor-pointer"
                        />
                      </div>

                      <div>
                        <span className="text-neutral-400 text-[11px]">حاشیه چپ: {currentAdj.crop?.left || 0}%</span>
                        <input
                          type="range"
                          min="0"
                          max="40"
                          value={currentAdj.crop?.left || 0}
                          onChange={(e) => handleCropChange({ ...currentAdj.crop, left: Number(e.target.value) })}
                          className="w-full accent-purple-500 cursor-pointer"
                        />
                      </div>

                      <div>
                        <span className="text-neutral-400 text-[11px]">حاشیه راست: {currentAdj.crop?.right || 0}%</span>
                        <input
                          type="range"
                          min="0"
                          max="40"
                          value={currentAdj.crop?.right || 0}
                          onChange={(e) => handleCropChange({ ...currentAdj.crop, right: Number(e.target.value) })}
                          className="w-full accent-purple-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCropChange({ top: 0, bottom: 0, left: 0, right: 0 })}
                      className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-[11px] rounded-lg border border-neutral-700 cursor-pointer"
                    >
                      حذف کراپ (حاشیه ۰٪)
                    </button>
                  </div>
                )}

                {activeTool === 'text' && (
                  <TextControlPanel
                    texts={currentTexts}
                    selectedTextId={selectedTextId}
                    theme={theme}
                    onSelectText={setSelectedTextId}
                    onAddText={handleAddText}
                    onUpdateText={handleUpdateText}
                    onDeleteText={handleDeleteText}
                    onApplyTextToAllPages={handleApplyToAllPages}
                    onApplyTextToSelectedPages={handleApplyToSelectedPages}
                  />
                )}

                {activeTool === 'shape' && (
                  <ShapeControlPanel
                    shapes={currentShapes}
                    selectedShapeId={selectedShapeId}
                    theme={theme}
                    onSelectShape={setSelectedShapeId}
                    onAddShape={handleAddShape}
                    onUpdateShape={handleUpdateShape}
                    onDeleteShape={handleDeleteShape}
                    onApplyShapeToAllPages={handleApplyToAllPages}
                    onApplyShapeToSelectedPages={handleApplyToSelectedPages}
                  />
                )}

                {activeTool === 'numbering' && (
                  <PageNumberingPanel
                    numbering={currentNumberingsList[0]}
                    numberings={currentNumberingsList}
                    selectedNumberingId={selectedNumberingId}
                    currentPage={activePage}
                    totalPages={studioTotalPages}
                    theme={theme}
                    onSelectNumbering={(id) => setSelectedNumberingId(id)}
                    onAddNumbering={handleAddNumbering}
                    onDuplicateNumbering={handleDuplicateNumbering}
                    onDeleteNumbering={handleDeleteNumbering}
                    onUpdateNumbering={handleUpdateNumbering}
                    onUpdateNumberingItem={handleUpdateNumberingItem}
                    onApplyNumberingToAll={handleApplyToAllPages}
                    onApplyNumberingToOdd={handleSelectOddForPrint}
                    onApplyNumberingToEven={handleSelectEvenForPrint}
                  />
                )}
              </div>
            </div>

            {/* Column 2: Center Interactive Workbench Canvas */}
            <div className="flex-1 flex flex-col overflow-hidden bg-neutral-950 relative">
              {/* Canvas Top Toolbar */}
              <div
                className={`px-3 py-1.5 border-b flex items-center justify-between gap-2 shrink-0 text-xs ${
                  isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-neutral-300">
                    پیش‌نمایش بزرگ صفحه {activePage} از {studioTotalPages}
                  </span>
                  {activeItem && (
                    <span className="text-[10px] text-blue-400 font-mono truncate max-w-[200px]" title={activeItem.fileName}>
                      ({activeItem.fileName} - صفحه {activeItem.pageNumInFile})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGrid(!showGrid)}
                    className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                      showGrid ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>خطوط تراز</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool(activeTool === 'measure' ? 'move' : 'measure')}
                    className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                      activeTool === 'measure'
                        ? 'bg-amber-600 text-white font-bold'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                    title="متر اندازه‌گیری دو نقطه با قفل زوایای افقی/عمودی (Shift)"
                  >
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>متر اندازه‌گیری</span>
                  </button>

                  <div className="flex items-center gap-1 bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700">
                    <button
                      type="button"
                      onClick={() => setZoomLevel(1)}
                      className="px-1.5 text-[10px] text-neutral-300 hover:text-white"
                    >
                      Fit
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.15))}
                      className="p-0.5 text-neutral-300 hover:text-white"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-[10px] w-10 text-center font-bold">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.15))}
                      className="p-0.5 text-neutral-300 hover:text-white"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Rulers and Main Canvas Viewport */}
              <div className="flex-1 flex flex-col relative overflow-auto p-4 items-center justify-center">
                {/* Horizontal Top Ruler */}
                <div className="absolute top-0 start-6 end-0 h-6 z-10 pointer-events-none opacity-80">
                  <Ruler
                    orientation="horizontal"
                    lengthMm={pageWidthMm}
                    cropStartPercent={currentAdj.crop?.left || 0}
                    cropEndPercent={100 - (currentAdj.crop?.right || 0)}
                    theme={theme}
                    onAddGuideline={handleAddGuideline}
                  />
                </div>
                {/* Vertical Left Ruler */}
                <div className="absolute top-6 start-0 bottom-0 w-6 z-10 pointer-events-none opacity-80">
                  <Ruler
                    orientation="vertical"
                    lengthMm={pageHeightMm}
                    cropStartPercent={currentAdj.crop?.top || 0}
                    cropEndPercent={100 - (currentAdj.crop?.bottom || 0)}
                    theme={theme}
                    onAddGuideline={handleAddGuideline}
                  />
                </div>

                {/* Canvas Container */}
                <div
                  className="relative transition-transform duration-75 flex items-center justify-center my-auto"
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                >
                  <div
                    onPointerDown={handleImagePointerDown}
                    onPointerMove={handleImagePointerMove}
                    onPointerUp={handleImagePointerUp}
                    className="relative bg-white shadow-2xl overflow-hidden border border-neutral-700"
                    style={{
                      width: '420px',
                      height: '594px',
                      cursor: activeTool === 'move' ? (isDraggingImage ? 'grabbing' : 'grab') : 'default',
                    }}
                  >
                    {/* Active Page Image */}
                    {activeImageDataUrl ? (
                      <img
                        src={activeImageDataUrl}
                        alt={`Global Page ${activePage}`}
                        style={{
                          filter: activeFilters,
                          transform: `translate(${currentAdj.offsetX || 0}%, ${currentAdj.offsetY || 0}%) rotate(${totalPageAngle}deg) scale(${(currentAdj.scale || 100) / 100})`,
                          transformOrigin: 'center center',
                          transition: isDraggingImage || activeTool === 'move' ? 'none' : 'transform 0.1s ease-out',
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                        }}
                        className="pointer-events-none select-none"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-neutral-400 text-xs">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                        <span>در حال بارگذاری کیفیت بالا...</span>
                      </div>
                    )}

                    {/* Grid Overlay */}
                    {showGrid && (
                      <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-10 grid-rows-14 opacity-20">
                        {Array.from({ length: 140 }).map((_, i) => (
                          <div key={i} className="border-b border-r border-blue-500" />
                        ))}
                      </div>
                    )}

                    {/* Interactive Transform Box when tool is 'move' */}
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

                    {/* Interactive Crop Box when tool is 'crop' */}
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

                    {/* Interactive Guidelines Layer (Cyan Lines with real cm markings) */}
                    <GuidelinesLayer
                      guidelines={guidelines}
                      pageWidthMm={pageWidthMm}
                      pageHeightMm={pageHeightMm}
                      onUpdateGuideline={handleUpdateGuideline}
                      onDeleteGuideline={handleDeleteGuideline}
                      theme={theme}
                    />

                    {/* Interactive Overlays Layer for Text, Shapes, and Page Numbering */}
                    <OverlayElementsLayer
                      adjustment={currentAdj}
                      pageNum={activePage}
                      totalPages={studioTotalPages}
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

            {/* Column 3: Right Page Selector Sidebar */}
            <div
              className={`w-full md:w-80 border-t md:border-t-0 md:border-s flex flex-col overflow-hidden shrink-0 transition-colors ${
                isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200'
              }`}
            >
              {/* Batch Selector Header */}
              <div
                className={`p-2.5 border-b space-y-2 shrink-0 ${
                  isDark ? 'bg-neutral-950/80 border-neutral-800' : 'bg-slate-100 border-slate-200'
                }`}
              >
                {/* Selection Filters */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-neutral-400">انتخاب تنظیمات:</span>
                  <div className="flex items-center gap-1 font-medium">
                    <button
                      type="button"
                      onClick={handleSelectAllPages}
                      className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-blue-400 cursor-pointer"
                    >
                      همه
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={handleSelectOddPages}
                      className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-blue-400 cursor-pointer"
                    >
                      فرد
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={handleSelectEvenPages}
                      className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-blue-400 cursor-pointer"
                    >
                      زوج
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={handleInvertPageSelection}
                      className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-blue-400 cursor-pointer"
                    >
                      معکوس
                    </button>
                  </div>
                </div>

                {/* Custom Page Range Selection Input */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-neutral-800">
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
                {/* Print/Merge Checkbox Filters */}
                <div className="flex items-center justify-between text-[11px] pt-0.5">
                  <span className="font-bold text-emerald-400">چک‌باکس ادغام:</span>
                  <div className="flex items-center gap-1 font-medium">
                    <button
                      type="button"
                      onClick={() => handleSelectAllForPrint(true)}
                      className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-emerald-400 cursor-pointer"
                    >
                      همه ✓
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={handleSelectOddForPrint}
                      className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-emerald-400 cursor-pointer"
                    >
                      فرد
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={handleSelectEvenForPrint}
                      className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-emerald-400 cursor-pointer"
                    >
                      زوج
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAllForPrint(false)}
                      className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-rose-400 cursor-pointer"
                    >
                      لغو ✕
                    </button>
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowDuplicateModal(true)}
                    className="flex-1 py-1.5 px-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>تکثیر صفحه {activePage}</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Page Cards List */}
              <div className="p-2 space-y-2 overflow-y-auto flex-1">
                {studioPages.map((pageItem) => {
                  const gIdx = pageItem.globalIndex;
                  const isActive = activePage === gIdx;
                  const isSelectedForBatch = selectedPages.has(gIdx);
                  const isIncludedInMerge = adjustments[gIdx]?.selectedForPrint !== false;
                  const thumbUrl = thumbnails[gIdx];

                  return (
                    <div
                      key={pageItem.globalIndex}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          const next = new Set(selectedPages);
                          if (next.has(gIdx)) next.delete(gIdx);
                          else next.add(gIdx);
                          setSelectedPages(next);
                        } else {
                          setActivePage(gIdx);
                          setLastClickedPage(gIdx);
                        }
                      }}
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/50 shadow-md'
                          : isSelectedForBatch
                          ? 'bg-neutral-850 border-neutral-700'
                          : isDark
                          ? 'bg-neutral-950 border-neutral-850 hover:border-neutral-750'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Page Checkbox for Merge Include/Exclude */}
                        <input
                          type="checkbox"
                          checked={isIncludedInMerge}
                          onChange={(e) => {
                            e.stopPropagation();
                            setAdjustments((prev) => ({
                              ...prev,
                              [gIdx]: { ...(prev[gIdx] || defaultAdjustment), selectedForPrint: e.target.checked },
                            }));
                          }}
                          className="rounded text-emerald-600 focus:ring-0 cursor-pointer w-4 h-4 shrink-0"
                        />

                        {/* Thumbnail */}
                        <div className="w-12 h-16 bg-neutral-900 border border-neutral-800 rounded overflow-hidden flex items-center justify-center shrink-0 relative">
                          {thumbUrl ? (
                            <img src={thumbUrl} alt={`Page ${gIdx}`} className="w-full h-full object-contain" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5 text-neutral-500 animate-spin" />
                          )}
                          {isActive && (
                            <span className="absolute bottom-0 inset-x-0 bg-blue-600 text-white font-bold text-[8px] text-center py-0.2">
                              میز کار
                            </span>
                          )}
                        </div>

                        {/* Title & info */}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold truncate text-neutral-200">
                            صفحه {gIdx}
                          </h4>
                          <p className="text-[10px] text-neutral-400 truncate" title={pageItem.fileName}>
                            {pageItem.fileName} (ص {pageItem.pageNumInFile})
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Duplicate Modal */}
        {showDuplicateModal && (
          <PageDuplicateModal
            mode="duplicate"
            activePage={activePage}
            totalPages={studioTotalPages}
            theme={theme}
            isProcessing={false}
            onClose={() => setShowDuplicateModal(false)}
            onConfirmDuplicate={(copies: number, insertAt: 'after' | 'end') => {
              setShowDuplicateModal(false);
              const targetStudio = studioPages.find((p) => p.globalIndex === activePage);
              if (!targetStudio) return;

              const copiedList: MergedStudioPageItem[] = [];
              for (let c = 0; c < copies; c++) {
                copiedList.push({ ...targetStudio, globalIndex: 0 });
              }

              const nextList = [...studioPages];
              if (insertAt === 'end') {
                nextList.push(...copiedList);
              } else {
                nextList.splice(activePage, 0, ...copiedList);
              }

              const reindexed = nextList.map((item, idx) => ({ ...item, globalIndex: idx + 1 }));
              setStudioPages(reindexed);
              setSelectedPages(new Set(Array.from({ length: reindexed.length }, (_, i) => i + 1)));
            }}
            onConfirmBlank={(copies: number, insertAfter: number) => {
              setShowDuplicateModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
};
