/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { QuickAccessBar } from './components/QuickAccessBar';
import { RibbonBar } from './components/RibbonBar';
import { SidebarPages } from './components/SidebarPages';
import { UnifiedStudioWorkspace } from './components/UnifiedStudioWorkspace';
import { BottomStatusBar } from './components/BottomStatusBar';
import { PreflightModal } from './components/PreflightModal';
import { StatsBar } from './components/StatsBar';
import { Toolbar } from './components/Toolbar';
import { FileList } from './components/FileList';
import { MergeModal } from './components/MergeModal';
import { PrintModal } from './components/PrintModal';
import { ImageToPdfModal } from './components/ImageToPdfModal';
import { WindowsHelpModal } from './components/WindowsHelpModal';
import {
  PDFItem,
  Language,
  SortBy,
  PageAdjustment,
  GridLayoutSettings,
  RibbonTab,
  PrintSettings,
  PaperSize,
  DuplexMode,
  ColorMode,
  PrintOrientation,
  PrintProfile,
  defaultPrintProfiles,
  defaultGridLayoutSettings,
  CustomCellOverride,
  PageOverlayText,
  PageOverlayShape,
  PageOverlayNumbering,
} from './types';
import { defaultAdjustment } from './utils/pdfRenderUtils';
import { getPdfPageCount, generateSamplePdfs } from './utils/pdfUtils';
import { translations } from './utils/translations';
import { CheckCircle2 } from 'lucide-react';
import {
  reorderPdfPage,
  movePageBetweenPdfs,
  duplicatePdfPage,
  insertBlankPdfPage,
  deletePdfPage,
} from './utils/pdfPageModifier';
import { calculateGridCellOrder } from './utils/gridImpositionUtils';

import { convertImagesToPdfFiles } from './utils/imageToPdfUtils';

export default function App() {
  const [lang, setLang] = useState<Language>('fa');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('pdf_app_theme');
    return (saved as 'dark' | 'light') || 'dark';
  });

  const [items, setItems] = useState<PDFItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('order');

  // View Mode: 'sheet' (WYSIWYG live prepress sheet), 'cards', or 'table'
  const [viewMode, setViewMode] = useState<'sheet' | 'cards' | 'table'>('sheet');
  const [studioWorkspaceMode, setStudioWorkspaceMode] = useState<'studio' | 'sheet'>('studio');
  const [activeTool, setActiveTool] = useState<'move' | 'crop' | 'text' | 'shape' | 'numbering' | 'measure'>('move');

  // Ribbon state
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTab>('layout');
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Active page selection
  const [activeGlobalPageIndex, setActiveGlobalPageIndex] = useState<number>(0);
  // Selected page keys for batch editing: `${itemId}_${pageNum}` (distinct from print checkboxes)
  const [selectedEditingPageKeys, setSelectedEditingPageKeys] = useState<Set<string>>(new Set());
  // Selected cell indices for matrix imposition (supports multi-selection)
  const [selectedCellIndices, setSelectedCellIndices] = useState<number[]>([0]);
  const selectedCellIdx = selectedCellIndices[0] ?? 0;

  // Active Sheet Index in live prepress view
  const [currentSheetIndex, setCurrentSheetIndex] = useState<number>(0);

  // Overlay selections
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

  // Live Print & Imposition Settings
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    printerName: '',
    printSpoolMode: 'continuous',
    paperSize: 'A4',
    paperTray: 'auto',
    colorMode: 'color',
    duplex: 'duplexLong',
    orientation: 'portrait',
    copies: 1,
    scaling: 'fit',
    collate: true,
    gutterMm: 0,
    jobFromNewSheet: false,
    gridLayout: {
      ...defaultGridLayoutSettings,
      enabled: false,
    },
  });

  // Canvas zoom & guides
  const [zoomLevel, setZoomLevel] = useState<number>(0.9);
  const [showRulers, setShowRulers] = useState<boolean>(true);
  const [showMargins, setShowMargins] = useState<boolean>(true);
  const [showMeasureTool, setShowMeasureTool] = useState<boolean>(false);

  // Modals state
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isPreflightModalOpen, setIsPreflightModalOpen] = useState(false);
  const [isImageToPdfModalOpen, setIsImageToPdfModalOpen] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [initialPrintGridSettings, setInitialPrintGridSettings] = useState<GridLayoutSettings | undefined>(undefined);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Undo / Redo history
  const [undoStack, setUndoStack] = useState<PDFItem[][]>([]);
  const [redoStack, setRedoStack] = useState<PDFItem[][]>([]);

  const t = translations[lang];

  // Sync HTML dir and lang attributes
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  }, [lang]);

  // Sync theme class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    localStorage.setItem('pdf_app_theme', theme);
  }, [theme]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3500);
  };

  // Push state to undo stack before mutation
  const pushUndoState = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-20), items]);
    setRedoStack([]);
  }, [items]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, items]);
    setUndoStack((prev) => prev.slice(0, -1));
    setItems(previous);
    showToast(lang === 'fa' ? 'عملیات با موفقیت به عقب برگشت' : 'Undo applied');
  }, [undoStack, items, lang]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, items]);
    setRedoStack((prev) => prev.slice(0, -1));
    setItems(next);
    showToast(lang === 'fa' ? 'انجام دوباره اعمال شد' : 'Redo applied');
  }, [redoStack, items, lang]);

  // Forward declarations for file/image processing
  const processAndLoadFiles = useCallback(
    async (pdfFilesToLoad: File[]) => {
      if (pdfFilesToLoad.length === 0) return;

      pushUndoState();

      const newItems: PDFItem[] = pdfFilesToLoad.map((file, idx) => ({
        id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        size: file.size,
        file,
        pageCount: null,
        status: 'loading',
        selected: true,
        addedAt: Date.now() + idx,
        rotation: 0,
      }));

      setItems((prev) => [...prev, ...newItems]);

      const poolLimit = 6;
      const queue = [...newItems];
      let activeWorkers = 0;

      const runWorker = () => {
        if (queue.length === 0) return;
        const target = queue.shift()!;
        activeWorkers++;

        getPdfPageCount(target.file)
          .then((pages) => {
            setItems((prev) =>
              prev.map((item) =>
                item.id === target.id
                  ? { ...item, pageCount: pages, status: 'ready' }
                  : item
              )
            );
          })
          .catch((err) => {
            console.error(`Counting error on ${target.name}:`, err);
            setItems((prev) =>
              prev.map((item) =>
                item.id === target.id
                  ? { ...item, pageCount: 0, status: 'error', errorMessage: (err as Error).message }
                  : item
              )
            );
          })
          .finally(() => {
            activeWorkers--;
            if (queue.length > 0) {
              runWorker();
            }
          });
      };

      const workersToStart = Math.min(poolLimit, queue.length);
      for (let i = 0; i < workersToStart; i++) {
        runWorker();
      }
    },
    [pushUndoState]
  );

  // Image files picked: Convert directly to PDF so images appear immediately on the main canvas
  const handleImagesSelected = useCallback(
    async (imageFiles: File[]) => {
      if (imageFiles.length === 0) return;
      try {
        showToast(lang === 'fa' ? 'در حال تبدیل و افزودن تصاویر به بوم...' : 'Converting images to PDF...');
        const convertedPdfs = await convertImagesToPdfFiles(imageFiles, {
          mode: 'separate',
          pageSize: 'A4',
          orientation: 'auto',
          marginMm: 0,
        });
        await processAndLoadFiles(convertedPdfs);
      } catch (err) {
        console.error('Error converting images:', err);
        showToast(lang === 'fa' ? 'خطا در افزودن تصویر' : 'Error adding image');
      }
    },
    [processAndLoadFiles, lang]
  );

  // PDF files selected (and mixed image files)
  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const validPdfFiles = files.filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );
      const imageFiles = files.filter(
        (f) =>
          f.type.startsWith('image/') ||
          /\.(png|jpe?g|webp|bmp|tiff?|svg)$/i.test(f.name)
      );

      let convertedImagePdfs: File[] = [];
      if (imageFiles.length > 0) {
        try {
          showToast(lang === 'fa' ? 'در حال تبدیل عکس‌ها به PDF...' : 'Converting images...');
          convertedImagePdfs = await convertImagesToPdfFiles(imageFiles, {
            mode: 'separate',
            pageSize: 'A4',
            orientation: 'auto',
            marginMm: 0,
          });
        } catch (err) {
          console.error('Failed converting image files:', err);
        }
      }

      const allFiles = [...validPdfFiles, ...convertedImagePdfs];

      if (allFiles.length === 0) {
        showToast(lang === 'fa' ? 'لطفاً فایل‌های معتبر PDF یا تصاویر انتخاب کنید.' : 'Please select valid PDF or image files.');
        return;
      }

      await processAndLoadFiles(allFiles);
    },
    [processAndLoadFiles, lang]
  );

  // Load sample PDFs
  const handleLoadSamples = async () => {
    try {
      showToast('در حال ایجاد فایل‌های نمونه آزمایشی...');
      const samples = await generateSamplePdfs();
      await handleFilesSelected(samples);
      showToast(t.sampleFilesCreated);
    } catch (err) {
      console.error('Error generating samples:', err);
      showToast('خطا در تولید فایل‌های نمونه.');
    }
  };

  // Flattened pages list for global index navigation
  const flatPagesList = useMemo(() => {
    const list: {
      globalIndex: number;
      item: PDFItem;
      pageNum: number;
      adjustment: PageAdjustment;
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
        });
      }
    }
    return list;
  }, [items]);

  const activePageInfo = flatPagesList[activeGlobalPageIndex] || flatPagesList[0] || null;

  // Active adjustment for currently focused page
  const activeAdjustment = useMemo(() => {
    if (!activePageInfo) return { ...defaultAdjustment };
    return activePageInfo.adjustment;
  }, [activePageInfo]);

  // Selected Text & Shape overlay element lookups
  const selectedText = useMemo(() => {
    return activeAdjustment.texts?.find((t) => t.id === selectedTextId) || null;
  }, [activeAdjustment.texts, selectedTextId]);

  const selectedShape = useMemo(() => {
    return activeAdjustment.shapes?.find((s) => s.id === selectedShapeId) || null;
  }, [activeAdjustment.shapes, selectedShapeId]);

  const pageNumbering = activeAdjustment.pageNumbering || null;

  const handleUpdateSelectedText = (updates: Partial<PageOverlayText>) => {
    if (!selectedTextId) return;
    pushUndoState();
    const currentTexts = activeAdjustment.texts || [];
    const nextTexts = currentTexts.map((t) => (t.id === selectedTextId ? { ...t, ...updates } : t));
    handleUpdateActiveAdjustment({ texts: nextTexts });
  };

  const handleDeleteSelectedText = () => {
    if (!selectedTextId) return;
    pushUndoState();
    const currentTexts = activeAdjustment.texts || [];
    const nextTexts = currentTexts.filter((t) => t.id !== selectedTextId);
    handleUpdateActiveAdjustment({ texts: nextTexts });
    setSelectedTextId(null);
  };

  const handleUpdateSelectedShape = (updates: Partial<PageOverlayShape>) => {
    if (!selectedShapeId) return;
    pushUndoState();
    const currentShapes = activeAdjustment.shapes || [];
    const nextShapes = currentShapes.map((s) => (s.id === selectedShapeId ? { ...s, ...updates } : s));
    handleUpdateActiveAdjustment({ shapes: nextShapes });
  };

  const handleDeleteSelectedShape = () => {
    if (!selectedShapeId) return;
    pushUndoState();
    const currentShapes = activeAdjustment.shapes || [];
    const nextShapes = currentShapes.filter((s) => s.id !== selectedShapeId);
    handleUpdateActiveAdjustment({ shapes: nextShapes });
    setSelectedShapeId(null);
  };

  const handleUpdatePageNumbering = (updates: Partial<PageOverlayNumbering>) => {
    pushUndoState();
    const cur = activeAdjustment.pageNumbering || {
      id: 'num-primary',
      enabled: true,
      xPercent: 50,
      yPercent: 95,
      format: lang === 'fa' ? 'persian' : 'english',
      template: lang === 'fa' ? 'صفحه {page} از {total}' : 'Page {page} of {total}',
      fontFamily: 'Vazirmatn, sans-serif',
      fontSize: 12,
      color: '#333333',
      startOffset: 1,
      opacity: 1,
    };
    handleUpdateActiveAdjustment({ pageNumbering: { ...cur, ...updates } });
  };

  // Matrix Cell Override Handlers with multi-cell support
  const handleUpdateCellOverride = useCallback(
    (cellIdxOrIndices: number | number[], updates: Partial<CustomCellOverride>) => {
      pushUndoState();
      const indices = Array.isArray(cellIdxOrIndices) ? cellIdxOrIndices : [cellIdxOrIndices];
      setPrintSettings((prev) => {
        const gridLayout = prev.gridLayout || {
          ...defaultGridLayoutSettings,
          enabled: true,
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
        return {
          ...prev,
          gridLayout: {
            ...gridLayout,
            customCellOverrides: currentOverrides,
          },
        };
      });
    },
    [pushUndoState]
  );

  const handleResetCellOverride = useCallback(
    (cellIdxOrIndices: number | number[]) => {
      pushUndoState();
      const indices = Array.isArray(cellIdxOrIndices) ? cellIdxOrIndices : [cellIdxOrIndices];
      setPrintSettings((prev) => {
        if (!prev.gridLayout?.customCellOverrides) return prev;
        const nextOverrides = { ...prev.gridLayout.customCellOverrides };
        for (const idx of indices) {
          delete nextOverrides[idx];
        }
        return {
          ...prev,
          gridLayout: {
            ...prev.gridLayout,
            customCellOverrides: nextOverrides,
          },
        };
      });
      const names = indices.map((i) => `#${i + 1}`).join(', ');
      showToast(lang === 'fa' ? `تنظیمات خانه(${names}) بازنشانی شد` : `Reset cell(s) ${names}`);
    },
    [pushUndoState, lang]
  );

  const handleApplyCellOverrideToAll = useCallback(
    (cellIdx: number) => {
      pushUndoState();
      setPrintSettings((prev) => {
        const gridLayout = prev.gridLayout;
        if (!gridLayout) return prev;
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
        return {
          ...prev,
          gridLayout: {
            ...gridLayout,
            customCellOverrides: newOverrides,
          },
        };
      });
      showToast(lang === 'fa' ? 'تنظیمات این خانه به تمام خانه‌های ماتریس اعمال شد' : 'Applied to all cells');
    },
    [pushUndoState, lang]
  );

  // Active crop (from selected cell override if in grid mode, else page adjustment)
  const activeCrop = useMemo(() => {
    const isGrid = Boolean(
      printSettings.gridLayout?.enabled &&
        ((printSettings.gridLayout.rows || 1) > 1 || (printSettings.gridLayout.cols || 1) > 1)
    );
    if (isGrid && selectedCellIndices.length > 0) {
      const firstOverride = printSettings.gridLayout?.customCellOverrides?.[selectedCellIndices[0]];
      if (firstOverride?.crop) return firstOverride.crop;
    }
    return activeAdjustment.crop || { top: 0, bottom: 0, left: 0, right: 0 };
  }, [printSettings.gridLayout, selectedCellIndices, activeAdjustment.crop]);

  const handleChangeCrop = (newCrop: { top: number; bottom: number; left: number; right: number }) => {
    pushUndoState();
    const isGrid = Boolean(
      printSettings.gridLayout?.enabled &&
        ((printSettings.gridLayout.rows || 1) > 1 || (printSettings.gridLayout.cols || 1) > 1)
    );
    if (isGrid && selectedCellIndices.length > 0) {
      handleUpdateCellOverride(selectedCellIndices, { crop: newCrop });
    }
    handleUpdateActiveAdjustment({ crop: newCrop });
  };

  // Keep selected editing pages initialized
  useEffect(() => {
    if (activePageInfo && selectedEditingPageKeys.size === 0) {
      setSelectedEditingPageKeys(new Set([`${activePageInfo.item.id}_${activePageInfo.pageNum}`]));
    }
  }, [activePageInfo, selectedEditingPageKeys.size]);

  // Update adjustment on all selected editing pages (and all selected cells if in grid mode)
  const handleUpdateActiveAdjustment = (updates: Partial<PageAdjustment>) => {
    const isGrid = Boolean(
      printSettings.gridLayout?.enabled &&
        ((printSettings.gridLayout.rows || 1) > 1 || (printSettings.gridLayout.cols || 1) > 1)
    );

    // In grid mode: apply matching overrides to all selected matrix cells
    if (isGrid && selectedCellIndices.length > 0) {
      const cellUpdates: Partial<CustomCellOverride> = {};
      if (updates.scale !== undefined) cellUpdates.scalePercent = updates.scale;
      if (updates.offsetX !== undefined) cellUpdates.offsetXPercent = updates.offsetX;
      if (updates.offsetY !== undefined) cellUpdates.offsetYPercent = updates.offsetY;
      if (updates.rotation !== undefined) cellUpdates.rotation = updates.rotation;
      if (updates.fineAngle !== undefined) cellUpdates.fineAngle = updates.fineAngle;
      if (updates.crop !== undefined) cellUpdates.crop = updates.crop;
      if (updates.brightness !== undefined) cellUpdates.brightness = updates.brightness;
      if (updates.contrast !== undefined) cellUpdates.contrast = updates.contrast;
      if (updates.grayscale !== undefined) cellUpdates.grayscale = updates.grayscale;
      if (updates.threshold !== undefined) cellUpdates.threshold = updates.threshold;
      if (updates.invert !== undefined) cellUpdates.invert = updates.invert;

      if (Object.keys(cellUpdates).length > 0) {
        handleUpdateCellOverride(selectedCellIndices, cellUpdates);
      }
    }

    if (!activePageInfo && selectedEditingPageKeys.size === 0) return;

    setItems((prev) =>
      prev.map((it) => {
        const currentAdjs = { ...(it.pageAdjustments || {}) };
        let hasModified = false;
        const pCount = it.pageCount || 1;

        for (let p = 1; p <= pCount; p++) {
          const key = `${it.id}_${p}`;
          const isSelected =
            selectedEditingPageKeys.size > 0
              ? selectedEditingPageKeys.has(key)
              : (activePageInfo?.item.id === it.id && activePageInfo.pageNum === p);

          if (isSelected) {
            hasModified = true;
            currentAdjs[p] = {
              ...(currentAdjs[p] || { ...defaultAdjustment }),
              ...updates,
            };
          }
        }

        return hasModified ? { ...it, pageAdjustments: currentAdjs } : it;
      })
    );
  };

  // Matrix Cell Selection Handlers with bidirectional sync to sidebar "انتخاب ویرایش:"
  const handleSelectCell = (idx: number, isMulti?: boolean) => {
    let nextIndices: number[];
    if (!isMulti) {
      nextIndices = [idx];
    } else {
      if (selectedCellIndices.includes(idx)) {
        if (selectedCellIndices.length > 1) {
          nextIndices = selectedCellIndices.filter((i) => i !== idx);
        } else {
          nextIndices = [idx];
        }
      } else {
        nextIndices = [...selectedCellIndices, idx];
      }
    }
    setSelectedCellIndices(nextIndices);

    // Sync with sidebar "انتخاب ویرایش:"
    const rows = printSettings.gridLayout?.rows || 1;
    const cols = printSettings.gridLayout?.cols || 1;
    const cellsPerSheet = rows * cols;
    const order = printSettings.gridLayout?.order || 'rtl-rows';
    const cellOrderIndices = calculateGridCellOrder(rows, cols, order);
    const printablePages = flatPagesList.filter((p) => p.adjustment.selectedForPrint);

    if (printablePages.length > 0) {
      const selectedKeys = new Set<string>();
      let newActiveGlobalIndex = activeGlobalPageIndex;

      for (const cellIdx of nextIndices) {
        let pageTarget: typeof printablePages[0] | undefined;
        if (printSettings.gridLayout?.repeatPage) {
          pageTarget = printablePages[currentSheetIndex] || printablePages[0];
        } else {
          const start = currentSheetIndex * cellsPerSheet;
          const pageOrderIdx = cellOrderIndices[cellIdx] ?? cellIdx;
          pageTarget = printablePages[start + pageOrderIdx];
        }

        if (pageTarget) {
          selectedKeys.add(`${pageTarget.item.id}_${pageTarget.pageNum}`);
          newActiveGlobalIndex = pageTarget.globalIndex;
        }
      }

      if (selectedKeys.size > 0) {
        setSelectedEditingPageKeys(selectedKeys);
        setActiveGlobalPageIndex(newActiveGlobalIndex);
      }
    }
  };

  const handleSelectAllCells = () => {
    const rows = printSettings.gridLayout?.rows || 1;
    const cols = printSettings.gridLayout?.cols || 1;
    const all = Array.from({ length: rows * cols }, (_, i) => i);
    setSelectedCellIndices(all);
    showToast(lang === 'fa' ? 'تمام خانه‌های ماتریس انتخاب شدند' : 'All cells selected');
  };

  const handleSelectOddCells = () => {
    const rows = printSettings.gridLayout?.rows || 1;
    const cols = printSettings.gridLayout?.cols || 1;
    const all = Array.from({ length: rows * cols }, (_, i) => i);
    setSelectedCellIndices(all.filter((i) => (i + 1) % 2 !== 0));
    showToast(lang === 'fa' ? 'خانه‌های فرد انتخاب شدند' : 'Odd cells selected');
  };

  const handleSelectEvenCells = () => {
    const rows = printSettings.gridLayout?.rows || 1;
    const cols = printSettings.gridLayout?.cols || 1;
    const all = Array.from({ length: rows * cols }, (_, i) => i);
    setSelectedCellIndices(all.filter((i) => (i + 1) % 2 === 0));
    showToast(lang === 'fa' ? 'خانه‌های زوج انتخاب شدند' : 'Even cells selected');
  };

  // Rotate currently selected pages by 90 degrees (or rotate selected cell if in grid mode)
  const handleRotateCurrent = () => {
    pushUndoState();
    const isGrid = Boolean(
      printSettings.gridLayout?.enabled &&
        ((printSettings.gridLayout.rows || 1) > 1 || (printSettings.gridLayout.cols || 1) > 1)
    );

    if (isGrid && selectedCellIndices.length > 0) {
      const curOverride = printSettings.gridLayout?.customCellOverrides?.[selectedCellIndices[0]];
      const curRot = curOverride?.rotation || 0;
      const nextRot = (curRot + 90) % 360;
      handleUpdateCellOverride(selectedCellIndices, { rotation: nextRot });
    }
    const currentRot = activeAdjustment.rotation || 0;
    const nextRot = (currentRot + 90) % 360;
    handleUpdateActiveAdjustment({ rotation: nextRot });
  };

  // Reset adjustments on all selected pages
  const handleResetAdjustments = () => {
    pushUndoState();
    const isGrid = Boolean(
      printSettings.gridLayout?.enabled &&
        ((printSettings.gridLayout.rows || 1) > 1 || (printSettings.gridLayout.cols || 1) > 1)
    );
    if (isGrid && selectedCellIndices.length > 0) {
      handleResetCellOverride(selectedCellIndices);
    }
    handleUpdateActiveAdjustment({
      brightness: 100,
      contrast: 100,
      grayscale: false,
      threshold: false,
      invert: false,
      rotation: 0,
      fineAngle: 0,
      crop: { top: 0, bottom: 0, left: 0, right: 0 },
      offsetX: 0,
      offsetY: 0,
      scale: 100,
    });
    showToast(lang === 'fa' ? 'فیلترها و چرخش صفحات انتخابی بازنشانی شد.' : 'Adjustments reset on selected pages.');
  };

  // Selection handlers for editing (bold highlight pages) with sync to matrix cells
  const handleSelectPageForEdit = (globalIndex: number, item: PDFItem, pageNum: number, isMulti?: boolean) => {
    setActiveGlobalPageIndex(globalIndex);
    const key = `${item.id}_${pageNum}`;
    let nextKeys: Set<string>;
    if (!isMulti) {
      nextKeys = new Set([key]);
    } else {
      nextKeys = new Set(selectedEditingPageKeys);
      if (nextKeys.has(key)) {
        if (nextKeys.size > 1) nextKeys.delete(key);
      } else {
        nextKeys.add(key);
      }
    }
    setSelectedEditingPageKeys(nextKeys);

    // In grid mode, find the corresponding cell(s) on the sheet
    const isGrid = Boolean(
      printSettings.gridLayout?.enabled &&
        ((printSettings.gridLayout.rows || 1) > 1 || (printSettings.gridLayout.cols || 1) > 1)
    );
    if (isGrid) {
      const rows = printSettings.gridLayout?.rows || 1;
      const cols = printSettings.gridLayout?.cols || 1;
      const cellsPerSheet = rows * cols;
      const order = printSettings.gridLayout?.order || 'rtl-rows';
      const cellOrderIndices = calculateGridCellOrder(rows, cols, order);
      const printablePages = flatPagesList.filter((p) => p.adjustment.selectedForPrint);

      if (!printSettings.gridLayout?.repeatPage) {
        const printableIdx = printablePages.findIndex((p) => p.item.id === item.id && p.pageNum === pageNum);
        if (printableIdx !== -1) {
          const sheetForPage = Math.floor(printableIdx / cellsPerSheet);
          if (sheetForPage !== currentSheetIndex && !isMulti) {
            setCurrentSheetIndex(sheetForPage);
          }
          const pagePosOnSheet = printableIdx % cellsPerSheet;
          const cellIdx = cellOrderIndices.indexOf(pagePosOnSheet);
          if (cellIdx !== -1) {
            if (!isMulti) {
              setSelectedCellIndices([cellIdx]);
            } else {
              setSelectedCellIndices((prev) =>
                prev.includes(cellIdx) ? prev : [...prev, cellIdx]
              );
            }
          }
        }
      }
    }
  };

  const handleSelectAllEditingPages = () => {
    setSelectedEditingPageKeys(new Set(flatPagesList.map((p) => `${p.item.id}_${p.pageNum}`)));
    const rows = printSettings.gridLayout?.rows || 1;
    const cols = printSettings.gridLayout?.cols || 1;
    const all = Array.from({ length: rows * cols }, (_, i) => i);
    setSelectedCellIndices(all);
    showToast(lang === 'fa' ? 'تمام صفحات برای ویرایش انتخاب شدند' : 'All pages selected for editing');
  };

  const handleSelectNoneEditingPages = () => {
    if (activePageInfo) {
      setSelectedEditingPageKeys(new Set([`${activePageInfo.item.id}_${activePageInfo.pageNum}`]));
    } else {
      setSelectedEditingPageKeys(new Set());
    }
    setSelectedCellIndices([0]);
  };

  const handleSelectOddEditingPages = () => {
    const next = new Set<string>();
    for (const p of flatPagesList) {
      if (p.pageNum % 2 !== 0) {
        next.add(`${p.item.id}_${p.pageNum}`);
      }
    }
    setSelectedEditingPageKeys(next);
    const rows = printSettings.gridLayout?.rows || 1;
    const cols = printSettings.gridLayout?.cols || 1;
    const all = Array.from({ length: rows * cols }, (_, i) => i);
    setSelectedCellIndices(all.filter((i) => (i + 1) % 2 !== 0));
    showToast(lang === 'fa' ? 'صفحات فرد برای ویرایش انتخاب شدند' : 'Odd pages selected for editing');
  };

  const handleSelectEvenEditingPages = () => {
    const next = new Set<string>();
    for (const p of flatPagesList) {
      if (p.pageNum % 2 === 0) {
        next.add(`${p.item.id}_${p.pageNum}`);
      }
    }
    setSelectedEditingPageKeys(next);
    const rows = printSettings.gridLayout?.rows || 1;
    const cols = printSettings.gridLayout?.cols || 1;
    const all = Array.from({ length: rows * cols }, (_, i) => i);
    setSelectedCellIndices(all.filter((i) => (i + 1) % 2 === 0));
    showToast(lang === 'fa' ? 'صفحات زوج برای ویرایش انتخاب شدند' : 'Even pages selected for editing');
  };

  const handleInvertEditingSelection = () => {
    setSelectedEditingPageKeys((prev) => {
      const next = new Set<string>();
      for (const p of flatPagesList) {
        const k = `${p.item.id}_${p.pageNum}`;
        if (!prev.has(k)) {
          next.add(k);
        }
      }
      return next;
    });
    showToast(lang === 'fa' ? 'انتخاب صفحات معکوس شد' : 'Page selection inverted');
  };

  // Reorder page inside same document or move page to another document
  const handleReorderPage = async (
    sourceItemId: string,
    sourcePageNum: number,
    targetItemId: string,
    targetPageNum: number
  ) => {
    pushUndoState();
    try {
      if (sourceItemId === targetItemId) {
        const item = items.find((i) => i.id === sourceItemId);
        if (!item) return;
        const res = await reorderPdfPage(item.file, sourcePageNum, targetPageNum);
        setItems((prev) =>
          prev.map((it) =>
            it.id === sourceItemId
              ? { ...it, file: res.newFile, pageCount: res.newPageCount }
              : it
          )
        );
        showToast(lang === 'fa' ? 'صفحه با موفقیت جابجا شد' : 'Page reordered successfully');
      } else {
        const sourceItem = items.find((i) => i.id === sourceItemId);
        const targetItem = items.find((i) => i.id === targetItemId);
        if (!sourceItem || !targetItem) return;
        const res = await movePageBetweenPdfs(
          sourceItem.file,
          sourcePageNum,
          targetItem.file,
          targetPageNum
        );
        setItems((prev) =>
          prev.map((it) => {
            if (it.id === sourceItemId) {
              return { ...it, file: res.newSourceFile, pageCount: res.newSourcePageCount };
            }
            if (it.id === targetItemId) {
              return { ...it, file: res.newTargetFile, pageCount: res.newTargetPageCount };
            }
            return it;
          })
        );
        showToast(lang === 'fa' ? 'صفحه به فایل دیگر منتقل شد' : 'Page moved to another document');
      }
    } catch (err) {
      console.error(err);
      showToast(lang === 'fa' ? 'خطا در جابجایی صفحه' : 'Error reordering page');
    }
  };

  // Duplicate page arbitrary copies
  const handleDuplicatePage = async (item: PDFItem, pageNum: number, copies: number) => {
    pushUndoState();
    try {
      const res = await duplicatePdfPage(item.file, pageNum, copies, 'after');
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, file: res.newFile, pageCount: res.newPageCount } : it
        )
      );
      showToast(
        lang === 'fa'
          ? `${copies} نسخه از صفحه با موفقیت تکثیر شد`
          : `Duplicated ${copies} copies of page`
      );
    } catch (err) {
      console.error(err);
      showToast(lang === 'fa' ? 'خطا در تکثیر صفحه' : 'Error duplicating page');
    }
  };

  // Insert blank page arbitrary copies
  const handleInsertBlankPage = async (item: PDFItem, pageNum: number, copies: number) => {
    pushUndoState();
    try {
      const res = await insertBlankPdfPage(item.file, pageNum, copies, 210, 297);
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, file: res.newFile, pageCount: res.newPageCount } : it
        )
      );
      showToast(
        lang === 'fa'
          ? `${copies} برگه سفید جدید درج شد`
          : `Inserted ${copies} blank page(s)`
      );
    } catch (err) {
      console.error(err);
      showToast(lang === 'fa' ? 'خطا در درج برگه سفید' : 'Error inserting blank page');
    }
  };

  // Delete page
  const handleDeletePage = async (item: PDFItem, pageNum: number) => {
    if ((item.pageCount || 1) <= 1) {
      showToast(lang === 'fa' ? 'فایل باید حداقل یک صفحه داشته باشد' : 'File must have at least 1 page');
      return;
    }
    pushUndoState();
    try {
      const res = await deletePdfPage(item.file, pageNum);
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, file: res.newFile, pageCount: res.newPageCount } : it
        )
      );
      showToast(lang === 'fa' ? 'صفحه با موفقیت حذف شد' : 'Page deleted');
    } catch (err) {
      console.error(err);
      showToast(lang === 'fa' ? 'خطا در حذف صفحه' : 'Error deleting page');
    }
  };

  // Toggle page inclusion for print
  const handleTogglePagePrint = (item: PDFItem, pageNum: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== item.id) return it;
        const currentAdjs = it.pageAdjustments || {};
        const pageAdj = currentAdjs[pageNum] || { ...defaultAdjustment };
        return {
          ...it,
          pageAdjustments: {
            ...currentAdjs,
            [pageNum]: {
              ...pageAdj,
              selectedForPrint: !pageAdj.selectedForPrint,
            },
          },
        };
      })
    );
  };

  // Batch toggle all pages for print
  const handleSelectAllPagesForPrint = (enabled: boolean) => {
    pushUndoState();
    setItems((prev) =>
      prev.map((it) => {
        const pCount = it.pageCount || 1;
        const newAdjs: Record<number, PageAdjustment> = { ...(it.pageAdjustments || {}) };
        for (let p = 1; p <= pCount; p++) {
          newAdjs[p] = {
            ...(newAdjs[p] || { ...defaultAdjustment }),
            selectedForPrint: enabled,
          };
        }
        return { ...it, pageAdjustments: newAdjs };
      })
    );
  };

  // Apply a preset print profile
  const handleSelectProfile = (profile: PrintProfile) => {
    pushUndoState();
    setPrintSettings((prev) => ({
      ...prev,
      paperSize: profile.settings.paperSize,
      duplex: profile.settings.duplex,
      colorMode: profile.settings.colorMode,
      orientation: profile.settings.orientation,
      scaling: profile.settings.scaling || prev.scaling,
      gutterMm: profile.settings.gutterMm || 0,
      gridLayout: profile.settings.gridLayout
        ? {
            ...prev.gridLayout,
            ...profile.settings.gridLayout,
          } as GridLayoutSettings
        : prev.gridLayout,
    }));
    showToast(`پروفایل «${lang === 'fa' ? profile.nameFa : profile.name}» اعمال شد.`);
  };

  // Keyboard Shortcuts (Ctrl+P, Ctrl+X, Ctrl+Z, Ctrl+Y, Ctrl+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Never intercept when typing inside text inputs, textareas, selects, or editable elements
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // 2. Disable global shortcuts when any modal dialog is open
      if (
        isPrintModalOpen ||
        isPreflightModalOpen ||
        isMergeModalOpen ||
        isImageToPdfModalOpen ||
        isHelpModalOpen ||
        confirmDialog !== null
      ) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsPrintModalOpen(true);
      } else if (isCtrl && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        setIsPreflightModalOpen(true);
      } else if (isCtrl && e.key.toLowerCase() === 'z') {
        if (!e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else {
          e.preventDefault();
          handleRedo();
        }
      } else if (isCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' && activePageInfo) {
        e.preventDefault();
        const docName = activePageInfo.item.name;
        const docId = activePageInfo.item.id;
        setConfirmDialog({
          isOpen: true,
          title: lang === 'fa' ? 'حذف سند' : 'Delete Document',
          message:
            lang === 'fa'
              ? `آیا از حذف سند "${docName}" اطمینان دارید؟`
              : `Are you sure you want to remove "${docName}"?`,
          onConfirm: () => handleRemove(docId),
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleUndo,
    handleRedo,
    activePageInfo,
    isPrintModalOpen,
    isPreflightModalOpen,
    isMergeModalOpen,
    isImageToPdfModalOpen,
    isHelpModalOpen,
    confirmDialog,
    lang,
  ]);

  // File list management handlers
  const handleToggleSelect = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleToggleSelectAll = () => {
    const allSelected = items.every((i) => i.selected);
    setItems((prev) => prev.map((item) => ({ ...item, selected: !allSelected })));
  };

  const handleClearAll = () => {
    setConfirmDialog({
      isOpen: true,
      title: lang === 'fa' ? 'پاک‌سازی تمام فایل‌ها' : 'Clear All Documents',
      message:
        lang === 'fa'
          ? 'آیا مایل به حذف تمام فایل‌های اضافه شده هستید؟'
          : 'Are you sure you want to remove all loaded documents?',
      onConfirm: () => {
        pushUndoState();
        setItems([]);
      },
    });
  };

  const handleRemove = (id: string) => {
    pushUndoState();
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    pushUndoState();
    setItems((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    pushUndoState();
    setItems((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleRotateFile = (id: string) => {
    pushUndoState();
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, rotation: ((item.rotation || 0) + 90) % 360 } : item
      )
    );
  };

  const handleUpdateItem = (id: string, updates: Partial<PDFItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const handleSavePageAdjustments = (itemId: string, adjustments: Record<number, PageAdjustment>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, pageAdjustments: adjustments } : item))
    );
    showToast(t.applySuccess);
  };

  // Filter & Sort items for table/cards view
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }
    switch (sortBy) {
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'pages-asc':
        result.sort((a, b) => (a.pageCount || 0) - (b.pageCount || 0));
        break;
      case 'pages-desc':
        result.sort((a, b) => (b.pageCount || 0) - (a.pageCount || 0));
        break;
      case 'size-asc':
        result.sort((a, b) => a.size - b.size);
        break;
      case 'size-desc':
        result.sort((a, b) => b.size - a.size);
        break;
      default:
        break;
    }
    return result;
  }, [items, searchQuery, sortBy]);

  const allSelected = items.length > 0 && items.every((i) => i.selected);

  return (
    <div
      className={`min-h-screen h-screen flex flex-col overflow-hidden select-none transition-colors duration-150 ${
        theme === 'dark' ? 'bg-neutral-950 text-neutral-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* 1. TOP WINDOWS QUICK ACCESS BAR */}
      <QuickAccessBar
        lang={lang}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onToggleLang={() => setLang((l) => (l === 'fa' ? 'en' : 'fa'))}
        onOpenHelp={() => setIsHelpModalOpen(true)}
        onPrintNow={() => setIsPreflightModalOpen(true)}
        onSaveAsPdf={() => setIsMergeModalOpen(true)}
        onPreviewPdf={() => {
          setViewMode('sheet');
          setStudioWorkspaceMode('studio');
        }}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        currentPageNumber={activePageInfo ? activePageInfo.pageNum : 1}
        totalPageCount={flatPagesList.length}
        onJumpToPage={(pageNum) => {
          const idx = flatPagesList.findIndex((p) => p.pageNum === pageNum);
          if (idx !== -1) setActiveGlobalPageIndex(idx);
        }}
        activePrinterName={printSettings.printerName}
        onChangePrinterName={(name) => setPrintSettings((s) => ({ ...s, printerName: name }))}
        onOpenPreflight={() => setIsPreflightModalOpen(true)}
        onOpenPrinterSettings={() => setIsPrintModalOpen(true)}
        hasFiles={items.length > 0}
      />

      {/* 2. PREPRESS RIBBON BAR */}
      <RibbonBar
        lang={lang}
        theme={theme}
        activeTab={activeRibbonTab}
        onSelectTab={setActiveRibbonTab}
        isRibbonCollapsed={isRibbonCollapsed}
        onToggleCollapse={() => setIsRibbonCollapsed((c) => !c)}
        onAddFiles={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = '.pdf,image/*';
          input.onchange = (e) => {
            const files = Array.from((e.target as HTMLInputElement).files || []);
            handleFilesSelected(files);
          };
          input.click();
        }}
        onAddImages={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = 'image/*';
          input.onchange = (e) => {
            const files = Array.from((e.target as HTMLInputElement).files || []);
            handleImagesSelected(files);
          };
          input.click();
        }}
        onLoadSamples={handleLoadSamples}
        onClearAll={handleClearAll}
        onOpenProfiles={() => {}}
        onSelectProfile={handleSelectProfile}
        paperSize={printSettings.paperSize}
        onChangePaperSize={(sz) => setPrintSettings((s) => ({ ...s, paperSize: sz }))}
        orientation={printSettings.orientation}
        onChangeOrientation={(o) => setPrintSettings((s) => ({ ...s, orientation: o }))}
        duplex={printSettings.duplex}
        onChangeDuplex={(d) => setPrintSettings((s) => ({ ...s, duplex: d }))}
        gutterMm={printSettings.gutterMm || 0}
        onChangeGutter={(g) => setPrintSettings((s) => ({ ...s, gutterMm: g }))}
        gridLayout={printSettings.gridLayout || defaultGridLayoutSettings}
        onChangeGridLayout={(updates) =>
          setPrintSettings((s) => ({
            ...s,
            gridLayout: { ...(s.gridLayout || defaultGridLayoutSettings), ...updates },
          }))
        }
        scaling={printSettings.scaling}
        onChangeScaling={(sc) => setPrintSettings((s) => ({ ...s, scaling: sc }))}
        jobFromNewSheet={Boolean(printSettings.jobFromNewSheet)}
        onToggleJobFromNewSheet={() =>
          setPrintSettings((s) => ({ ...s, jobFromNewSheet: !s.jobFromNewSheet }))
        }
        onOpenGridStudio={() => {
          setViewMode('sheet');
          setStudioWorkspaceMode('studio');
          setPrintSettings((s) => ({
            ...s,
            gridLayout: {
              ...(s.gridLayout || defaultGridLayoutSettings),
              enabled: true,
              rows: s.gridLayout?.rows && s.gridLayout.rows > 1 ? s.gridLayout.rows : 2,
              cols: s.gridLayout?.cols && s.gridLayout.cols > 1 ? s.gridLayout.cols : 2,
              repeatPage: true,
            },
          }));
          showToast(lang === 'fa' ? 'چیدمان ماتریس در بوم زنده فعال شد' : 'Live matrix layout activated');
        }}
        activeAdjustment={activeAdjustment}
        onUpdateActiveAdjustment={handleUpdateActiveAdjustment}
        onResetAdjustments={handleResetAdjustments}
        onRotateCurrent={handleRotateCurrent}
        selectedCellIdx={selectedCellIdx}
        selectedCellIndices={selectedCellIndices}
        onSelectCell={handleSelectCell}
        onSelectAllCells={handleSelectAllCells}
        onSelectOddCells={handleSelectOddCells}
        onSelectEvenCells={handleSelectEvenCells}
        onUpdateCellOverride={handleUpdateCellOverride}
        onResetCellOverride={handleResetCellOverride}
        onApplyCellOverrideToAll={handleApplyCellOverrideToAll}
        selectedPagesCount={selectedEditingPageKeys.size}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        selectedText={selectedText}
        onUpdateSelectedText={handleUpdateSelectedText}
        onDeleteSelectedText={handleDeleteSelectedText}
        selectedShape={selectedShape}
        onUpdateSelectedShape={handleUpdateSelectedShape}
        onDeleteSelectedShape={handleDeleteSelectedShape}
        pageNumbering={pageNumbering}
        onUpdatePageNumbering={handleUpdatePageNumbering}
        onAddTextOverlay={() => {
          setViewMode('sheet');
          setStudioWorkspaceMode('studio');
          setActiveTool('text');
          if (activePageInfo) {
            const newId = `txt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const newText = {
              id: newId,
              text: lang === 'fa' ? 'متن جدید' : 'New Text',
              xPercent: 50,
              yPercent: 50,
              fontSize: 20,
              fontFamily: 'Vazirmatn, sans-serif',
              color: '#000000',
              align: 'center' as const,
              opacity: 1,
              rotation: 0,
              bold: false,
              italic: false,
            };
            handleUpdateActiveAdjustment({
              texts: [...(activeAdjustment.texts || []), newText],
            });
            setSelectedTextId(newId);
          }
        }}
        onAddShapeOverlay={() => {
          setViewMode('sheet');
          setStudioWorkspaceMode('studio');
          setActiveTool('shape');
          if (activePageInfo) {
            const newId = `shp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const newShape = {
              id: newId,
              type: 'rectangle' as const,
              xPercent: 50,
              yPercent: 50,
              widthPercent: 30,
              heightPercent: 20,
              fillColor: 'transparent',
              strokeColor: '#2563eb',
              strokeWidth: 2,
              strokeStyle: 'solid' as const,
              opacity: 1,
              rotation: 0,
            };
            handleUpdateActiveAdjustment({
              shapes: [...(activeAdjustment.shapes || []), newShape],
            });
            setSelectedShapeId(newId);
          }
        }}
        onAddPageNumbering={() => {
          setViewMode('sheet');
          setStudioWorkspaceMode('studio');
          setActiveTool('numbering');
          if (activePageInfo) {
            handleUpdateActiveAdjustment({
              pageNumbering: {
                id: 'num-primary',
                enabled: true,
                xPercent: 50,
                yPercent: 95,
                format: lang === 'fa' ? 'persian' : 'english',
                template: lang === 'fa' ? 'صفحه {page} از {total}' : 'Page {page} of {total}',
                fontFamily: 'Vazirmatn, sans-serif',
                fontSize: 12,
                color: '#333333',
                startOffset: 1,
                opacity: 1,
              },
            });
          }
        }}
        showCutMarks={Boolean(printSettings.gridLayout?.showCutMarks)}
        onToggleCutMarks={() =>
          setPrintSettings((s) => ({
            ...s,
            gridLayout: {
              ...(s.gridLayout || defaultGridLayoutSettings),
              showCutMarks: !s.gridLayout?.showCutMarks,
            },
          }))
        }
        showMeasureTool={showMeasureTool}
        onToggleMeasureTool={() => {
          setViewMode('sheet');
          setStudioWorkspaceMode('studio');
          setActiveTool((cur) => (cur === 'measure' ? 'move' : 'measure'));
          setShowMeasureTool((v) => !v);
        }}
        onOpenPageStudio={() => {
          setViewMode('sheet');
          setStudioWorkspaceMode('studio');
        }}
        onToggleInteractiveCrop={() => {
          setViewMode('sheet');
          setStudioWorkspaceMode('studio');
          setActiveTool((cur) => (cur === 'crop' ? 'move' : 'crop'));
        }}
        onTrimScannerBorders={() => {
          pushUndoState();
          const crop5 = { top: 5, bottom: 5, left: 5, right: 5 };
          const isGrid = Boolean(
            printSettings.gridLayout?.enabled &&
              ((printSettings.gridLayout.rows || 1) > 1 || (printSettings.gridLayout.cols || 1) > 1)
          );
          if (isGrid && selectedCellIndices.length > 0) {
            handleUpdateCellOverride(selectedCellIndices, { crop: crop5 });
          }
          handleUpdateActiveAdjustment({ crop: crop5 });
          showToast(lang === 'fa' ? 'حاشیه ۵٪ اسکنر حذف شد' : '5% scanner border trimmed');
        }}
        onResetCrop={() => {
          pushUndoState();
          const crop0 = { top: 0, bottom: 0, left: 0, right: 0 };
          const isGrid = Boolean(
            printSettings.gridLayout?.enabled &&
              ((printSettings.gridLayout.rows || 1) > 1 || (printSettings.gridLayout.cols || 1) > 1)
          );
          if (isGrid && selectedCellIndices.length > 0) {
            handleUpdateCellOverride(selectedCellIndices, { crop: crop0 });
          }
          handleUpdateActiveAdjustment({ crop: crop0 });
          showToast(lang === 'fa' ? 'کادر برش بازنشانی شد' : 'Crop reset');
        }}
        onCloseCrop={() => setActiveTool('move')}
        activeCrop={activeCrop}
        onChangeCrop={handleChangeCrop}
        onOpenMergeModal={() => setIsMergeModalOpen(true)}
        onOpenImageToPdf={() => setIsImageToPdfModalOpen(true)}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        zoomLevel={zoomLevel}
        onChangeZoom={setZoomLevel}
        showRulers={showRulers}
        onToggleRulers={() => setShowRulers((v) => !v)}
        showMargins={showMargins}
        onToggleMargins={() => setShowMargins((v) => !v)}
        hasFiles={items.length > 0}
      />

      {/* 3. CENTRAL WORKSPACE VIEWPORT */}
      <main className="flex-1 flex overflow-hidden relative z-10">
        {viewMode === 'sheet' ? (
          <>
            {/* Unified Studio & Preview Workspace directly on the first screen */}
            <UnifiedStudioWorkspace
              items={items}
              onUpdateItem={handleUpdateItem}
              activeGlobalPageIndex={activeGlobalPageIndex}
              onSelectGlobalPage={setActiveGlobalPageIndex}
              selectedEditingPageKeys={selectedEditingPageKeys}
              onSelectPageForEdit={handleSelectPageForEdit}
              onSelectAllEditingPages={handleSelectAllEditingPages}
              onSelectNoneEditingPages={handleSelectNoneEditingPages}
              onSelectOddEditingPages={handleSelectOddEditingPages}
              onSelectEvenEditingPages={handleSelectEvenEditingPages}
              onInvertEditingSelection={handleInvertEditingSelection}
              onBatchUpdateAdjustments={handleUpdateActiveAdjustment}
              activeRibbonTab={activeRibbonTab}
              onSelectRibbonTab={setActiveRibbonTab}
              settings={printSettings}
              onChangeSettings={(updates) => setPrintSettings((s) => ({ ...s, ...updates }))}
              lang={lang}
              theme={theme}
              zoomLevel={zoomLevel}
              onChangeZoom={setZoomLevel}
              showRulers={showRulers}
              onToggleRulers={() => setShowRulers((v) => !v)}
              showMargins={showMargins}
              onToggleMargins={() => setShowMargins((v) => !v)}
              activeTool={activeTool}
              onSelectTool={setActiveTool}
              workspaceMode={studioWorkspaceMode}
              onChangeWorkspaceMode={setStudioWorkspaceMode}
              onFilesSelected={handleFilesSelected}
              onImagesSelected={handleImagesSelected}
              onLoadSamples={handleLoadSamples}
              showToast={showToast}
              pushUndoState={pushUndoState}
              selectedCellIdx={selectedCellIdx}
              selectedCellIndices={selectedCellIndices}
              onSelectCell={handleSelectCell}
              onUpdateCellOverride={handleUpdateCellOverride}
              onResetCellOverride={handleResetCellOverride}
              onApplyCellOverrideToAll={handleApplyCellOverrideToAll}
              selectedTextId={selectedTextId}
              onSelectTextId={setSelectedTextId}
              selectedShapeId={selectedShapeId}
              onSelectShapeId={setSelectedShapeId}
              currentSheetIndex={currentSheetIndex}
              onChangeSheetIndex={setCurrentSheetIndex}
            />

            {/* Pages & Bookmarks Sidebar */}
            <SidebarPages
              items={items}
              lang={lang}
              theme={theme}
              activePageGlobalIndex={activeGlobalPageIndex}
              selectedEditingPageKeys={selectedEditingPageKeys}
              onSelectPage={handleSelectPageForEdit}
              onTogglePagePrint={handleTogglePagePrint}
              onSelectAllPagesForPrint={handleSelectAllPagesForPrint}
              onSelectAllEditingPages={handleSelectAllEditingPages}
              onSelectNoneEditingPages={handleSelectNoneEditingPages}
              onSelectOddEditingPages={handleSelectOddEditingPages}
              onSelectEvenEditingPages={handleSelectEvenEditingPages}
              onInvertEditingSelection={handleInvertEditingSelection}
              onRotatePage={(item, pageNum) => {
                const cur = item.pageAdjustments?.[pageNum]?.rotation || 0;
                const nextRot = (cur + 90) % 360;
                const key = `${item.id}_${pageNum}`;
                if (selectedEditingPageKeys.has(key)) {
                  handleUpdateActiveAdjustment({ rotation: nextRot });
                } else {
                  setItems((prev) =>
                    prev.map((it) =>
                      it.id === item.id
                        ? {
                            ...it,
                            pageAdjustments: {
                              ...(it.pageAdjustments || {}),
                              [pageNum]: {
                                ...(it.pageAdjustments?.[pageNum] || { ...defaultAdjustment }),
                                rotation: nextRot,
                              },
                            },
                          }
                        : it
                    )
                  );
                }
              }}
              onOpenPageStudio={(item) => {
                const firstIdx = flatPagesList.findIndex((p) => p.item.id === item.id);
                if (firstIdx !== -1) setActiveGlobalPageIndex(firstIdx);
                setStudioWorkspaceMode('studio');
                setViewMode('sheet');
              }}
              onRemoveFile={handleRemove}
              onMoveFileUp={handleMoveUp}
              onMoveFileDown={handleMoveDown}
              onReorderPage={handleReorderPage}
              onDuplicatePage={handleDuplicatePage}
              onInsertBlankPage={handleInsertBlankPage}
              onDeletePage={handleDeletePage}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
            />
          </>
        ) : (
          /* Cards or Table File Management View */
          <div className="flex-1 flex flex-col overflow-y-auto">
            <StatsBar
              items={items}
              lang={lang}
              theme={theme}
              onOpenMergeModal={() => setIsMergeModalOpen(true)}
              onOpenPrintModal={() => setIsPrintModalOpen(true)}
              onOpenGridModal={() => {
                setViewMode('sheet');
                setStudioWorkspaceMode('studio');
                setPrintSettings((s) => ({
                  ...s,
                  gridLayout: {
                    ...(s.gridLayout || defaultGridLayoutSettings),
                    enabled: true,
                    rows: s.gridLayout?.rows && s.gridLayout.rows > 1 ? s.gridLayout.rows : 2,
                    cols: s.gridLayout?.cols && s.gridLayout.cols > 1 ? s.gridLayout.cols : 2,
                    repeatPage: true,
                  },
                }));
                showToast(lang === 'fa' ? 'چیدمان ماتریس در بوم زنده فعال شد' : 'Live matrix layout activated');
              }}
            />

            <Toolbar
              lang={lang}
              theme={theme}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortBy={sortBy}
              onSortChange={setSortBy}
              viewMode={viewMode === 'table' ? 'table' : 'cards'}
              onViewModeChange={(vm) => setViewMode(vm)}
              allSelected={allSelected}
              onToggleSelectAll={handleToggleSelectAll}
              onClearAll={handleClearAll}
              onLoadSamples={handleLoadSamples}
              onOpenPrintModal={() => setIsPrintModalOpen(true)}
              onOpenGridModal={() => {
                setViewMode('sheet');
                setStudioWorkspaceMode('studio');
                setPrintSettings((s) => ({
                  ...s,
                  gridLayout: {
                    ...(s.gridLayout || defaultGridLayoutSettings),
                    enabled: true,
                    rows: s.gridLayout?.rows && s.gridLayout.rows > 1 ? s.gridLayout.rows : 2,
                    cols: s.gridLayout?.cols && s.gridLayout.cols > 1 ? s.gridLayout.cols : 2,
                    repeatPage: true,
                  },
                }));
                showToast(lang === 'fa' ? 'چیدمان ماتریس در بوم زنده فعال شد' : 'Live matrix layout activated');
              }}
              totalItems={items.length}
            />

            <div className="flex-1 p-4">
              <FileList
                items={filteredAndSortedItems}
                lang={lang}
                theme={theme}
                viewMode={viewMode === 'table' ? 'table' : 'cards'}
                onToggleSelect={handleToggleSelect}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onRemove={handleRemove}
                onRotate={handleRotateFile}
                onPreview={(item) => {
                  const firstIdx = flatPagesList.findIndex((p) => p.item.id === item.id);
                  if (firstIdx !== -1) setActiveGlobalPageIndex(firstIdx);
                  setStudioWorkspaceMode('studio');
                  setViewMode('sheet');
                }}
                onOpenPageStudio={(item) => {
                  const firstIdx = flatPagesList.findIndex((p) => p.item.id === item.id);
                  if (firstIdx !== -1) setActiveGlobalPageIndex(firstIdx);
                  setStudioWorkspaceMode('studio');
                  setViewMode('sheet');
                }}
              />
            </div>
          </div>
        )}
      </main>

      {/* 4. BOTTOM STATUS BAR */}
      <BottomStatusBar
        lang={lang}
        theme={theme}
        currentPageNumber={activePageInfo ? activePageInfo.pageNum : 1}
        totalPageCount={flatPagesList.length}
        totalPhysicalSheets={Math.ceil(flatPagesList.length / (printSettings.gridLayout?.enabled ? (printSettings.gridLayout.rows * printSettings.gridLayout.cols) : 1))}
        currentSheetNumber={Math.floor(activeGlobalPageIndex / (printSettings.gridLayout?.enabled ? (printSettings.gridLayout.rows * printSettings.gridLayout.cols) : 1)) + 1}
        paperSize={printSettings.paperSize}
        orientation={printSettings.orientation}
        duplex={printSettings.duplex}
        zoomLevel={zoomLevel}
        onChangeZoom={setZoomLevel}
        onRotateCurrent={handleRotateCurrent}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        hasFiles={items.length > 0}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-10 start-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm border animate-fade-in ${
            theme === 'dark'
              ? 'bg-neutral-900 border-neutral-750 text-neutral-100'
              : 'bg-white border-slate-200 text-slate-900 shadow-lg'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Pre-flight Checklist Modal */}
      {isPreflightModalOpen && (
        <PreflightModal
          items={items}
          settings={printSettings}
          lang={lang}
          theme={theme}
          onClose={() => setIsPreflightModalOpen(false)}
          onConfirmPrint={() => {
            setIsPreflightModalOpen(false);
            setIsPrintModalOpen(true);
          }}
        />
      )}

      {/* Batch Print Modal */}
      {isPrintModalOpen && (
        <PrintModal
          items={items}
          lang={lang}
          theme={theme}
          onClose={() => {
            setIsPrintModalOpen(false);
            setInitialPrintGridSettings(undefined);
          }}
          initialGridSettings={initialPrintGridSettings || printSettings.gridLayout}
        />
      )}

      {/* Image to PDF Conversion Modal */}
      {isImageToPdfModalOpen && pendingImages.length > 0 && (
        <ImageToPdfModal
          initialFiles={pendingImages}
          lang={lang}
          theme={theme}
          onClose={() => {
            setIsImageToPdfModalOpen(false);
            setPendingImages([]);
          }}
          onConverted={(pdfFiles) => {
            handleFilesSelected(pdfFiles);
            showToast(`${pdfFiles.length} فایل PDF از تصاویر با موفقیت ایجاد و به فهرست افزوده شد`);
          }}
        />
      )}

      {/* Merge Modal */}
      {isMergeModalOpen && (
        <MergeModal
          items={items}
          lang={lang}
          theme={theme}
          onClose={() => setIsMergeModalOpen(false)}
        />
      )}

      {/* Windows Help / Info Modal */}
      {isHelpModalOpen && (
        <WindowsHelpModal
          lang={lang}
          theme={theme}
          onClose={() => setIsHelpModalOpen(false)}
        />
      )}

      {/* In-App Confirmation Modal (replacing window.confirm) */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div
            className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl transition-colors ${
              theme === 'dark'
                ? 'bg-neutral-900 border-neutral-750 text-neutral-100'
                : 'bg-white border-slate-200 text-slate-900 shadow-xl'
            }`}
          >
            <h3 className="text-sm font-bold text-red-500 mb-2">{confirmDialog.title}</h3>
            <p className="text-xs text-neutral-400 mb-5 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  theme === 'dark'
                    ? 'border-neutral-700 hover:bg-neutral-800 text-neutral-300'
                    : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {lang === 'fa' ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  action();
                }}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                {lang === 'fa' ? 'تایید و حذف' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
