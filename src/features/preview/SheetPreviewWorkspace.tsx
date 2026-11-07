import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileUp,
  History,
  Maximize2,
  RotateCcw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  ComputedCellLayout,
  ImpositionPlan,
} from '../imposition/impositionEngine';
import { DND_MIME_PAGE_ID } from '../pages/PagesSidebar';
import { getCachedRenderUrl, renderPagePreviewUrl } from '../pages/previewRenderer';
import { isDriverPaperMatchingSheet, findBestDriverPaper } from '../../shared/paperSizes';
import { EMPTY_SLOT_MARKER } from '../../shared/types';
import { formatLength, UNIT_LABELS } from '../../shared/units';
import { useStudioStore } from '../../store/useStudioStore';
import { SheetRuler } from './SheetRuler';

const DND_MIME_SHEET_CELL = 'application/x-kosar-sheet-cell';
const BASE_PX_PER_MM = 2.6; // ~100% zoom physical screen feel

interface SheetPreviewWorkspaceProps {
  plan: ImpositionPlan;
  onTriggerFilePicker: () => void;
  onFilesDropped: (files: File[]) => void;
  onLoadDemoFiles: () => void;
  onRestoreDesktopManifest: () => void;
}

interface CellArtworkProps {
  cell: ComputedCellLayout;
  pxPerMm: number;
  sheetIndex: number;
  showGuides: boolean;
  onDropPageIntoCell: (pageId: string) => void;
  onSwapCells: (fromSheet: number, fromCell: number) => void;
  onSetCellEmpty: () => void;
  onResetCellOverride: () => void;
}

const CellPreviewBox: React.FC<CellArtworkProps> = React.memo(
  ({
    cell,
    pxPerMm,
    sheetIndex,
    showGuides,
    onDropPageIntoCell,
    onSwapCells,
    onSetCellEmpty,
    onResetCellOverride,
  }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const page = cell.content?.page ?? null;

    const [imgUrl, setImgUrl] = useState<string | undefined>(() =>
      page ? getCachedRenderUrl(page.sourceFileId, page.sourcePageIndex, 'sheet') : undefined
    );

    useEffect(() => {
      if (!page) {
        setImgUrl(undefined);
        return;
      }
      let cancelled = false;
      const hit = getCachedRenderUrl(page.sourceFileId, page.sourcePageIndex, 'sheet');
      if (hit) {
        setImgUrl(hit);
        return;
      }
      // Show thumb immediately if available while crisp sheet render finishes
      const thumbHit = getCachedRenderUrl(page.sourceFileId, page.sourcePageIndex, 'thumb');
      if (thumbHit) setImgUrl(thumbHit);

      renderPagePreviewUrl(page.sourceFileId, page.sourcePageIndex, 'sheet')
        .then((url) => {
          if (!cancelled) setImgUrl(url);
        })
        .catch(() => {});

      return () => {
        cancelled = true;
      };
    }, [page?.sourceFileId, page?.sourcePageIndex]);

    const cellLeftPx = cell.xMm * pxPerMm;
    const cellTopPx = cell.yMm * pxPerMm;
    const cellW = Math.max(1, cell.widthMm * pxPerMm);
    const cellH = Math.max(1, cell.heightMm * pxPerMm);

    const placement = cell.content;
    const relLeftPx = placement ? (placement.xMm - cell.xMm) * pxPerMm : 0;
    const relTopPx = placement ? (placement.yMm - cell.yMm) * pxPerMm : 0;
    const boxW = placement ? placement.widthMm * pxPerMm : 0;
    const boxH = placement ? placement.heightMm * pxPerMm : 0;
    const rotCw = placement?.totalRotationCw ?? 0;
    const isQuarterTurn = rotCw === 90 || rotCw === 270;

    return (
      <div
        draggable={Boolean(placement || cell.isExplicitlyEmpty)}
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData(
            DND_MIME_SHEET_CELL,
            JSON.stringify({ sheetIndex, cellIndex: cell.cellIndex })
          );
        }}
        onDragOver={(e) => {
          if (
            e.dataTransfer.types.includes(DND_MIME_PAGE_ID) ||
            e.dataTransfer.types.includes(DND_MIME_SHEET_CELL)
          ) {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(true);
          }
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          setIsDragOver(false);
          const droppedPageId = e.dataTransfer.getData(DND_MIME_PAGE_ID);
          if (droppedPageId) {
            e.preventDefault();
            e.stopPropagation();
            onDropPageIntoCell(droppedPageId);
            return;
          }
          const cellPayload = e.dataTransfer.getData(DND_MIME_SHEET_CELL);
          if (cellPayload) {
            e.preventDefault();
            e.stopPropagation();
            try {
              const parsed = JSON.parse(cellPayload) as {
                sheetIndex: number;
                cellIndex: number;
              };
              onSwapCells(parsed.sheetIndex, parsed.cellIndex);
            } catch {
              // Ignore malformed payload
            }
          }
        }}
        style={{
          left: `${cellLeftPx}px`,
          top: `${cellTopPx}px`,
          width: `${cellW}px`,
          height: `${cellH}px`,
        }}
        className={`group/cell absolute transition-shadow ${
          placement?.requiresClip ? 'overflow-hidden' : ''
        } ${
          isDragOver
            ? 'ring-2 ring-blue-500 bg-blue-500/10 z-20'
            : showGuides
            ? 'outline-1 outline-dashed outline-sky-500/45'
            : ''
        }`}
      >
        {/* Artwork */}
        {placement && imgUrl && (
          <div
            style={{
              position: 'absolute',
              left: `${relLeftPx}px`,
              top: `${relTopPx}px`,
              width: `${boxW}px`,
              height: `${boxH}px`,
            }}
            className="pointer-events-none flex items-center justify-center"
          >
            <img
              src={imgUrl}
              alt={placement.page.sourceFileName}
              draggable={false}
              style={{
                width: `${isQuarterTurn ? boxH : boxW}px`,
                height: `${isQuarterTurn ? boxW : boxH}px`,
                maxWidth: 'none',
                maxHeight: 'none',
                transform: `rotate(${rotCw}deg)`,
                transformOrigin: 'center center',
              }}
              className="object-fill select-none"
            />
          </div>
        )}

        {/* Empty Slot Label */}
        {!placement && showGuides && (
          <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-slate-400 select-none pointer-events-none bg-slate-100/50">
            <span className="font-num font-semibold">خانه {cell.sequenceOrder}</span>
            <span>{cell.isExplicitlyEmpty ? '(خالی دستی)' : '(خالی)'}</span>
          </div>
        )}

        {/* Hover Controls on Cell (Sequence badge + Make Empty / Reset) */}
        <div className="opacity-0 group-hover/cell:opacity-100 transition-opacity absolute top-1 inset-x-1 flex items-center justify-between gap-1 z-30 pointer-events-none">
          <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-white text-[9px] font-num shadow-xs">
            #{cell.sequenceOrder}
          </span>

          <div className="flex items-center gap-0.5 pointer-events-auto">
            {cell.isOverridden && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResetCellOverride();
                }}
                title="بازگردانی این خانه به چیدمان خودکار"
                className="p-1 rounded bg-amber-500 hover:bg-amber-600 text-white shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            )}
            {placement && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetCellEmpty();
                }}
                title="خالی کردن این خانه (ایجاد خانه سفید)"
                className="p-1 rounded bg-slate-900/80 hover:bg-rose-600 text-white shadow-xs cursor-pointer"
              >
                <Ban className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

export const SheetPreviewWorkspace: React.FC<SheetPreviewWorkspaceProps> = ({
  plan,
  onTriggerFilePicker,
  onFilesDropped,
  onLoadDemoFiles,
  onRestoreDesktopManifest,
}) => {
  const pages = useStudioStore((s) => s.pages);
  const layout = useStudioStore((s) => s.layout);
  const slotOverrides = useStudioStore((s) => s.slotOverrides);
  const activeSheetIndex = useStudioStore((s) => s.activeSheetIndex);
  const zoom = useStudioStore((s) => s.zoom);
  const unit = useStudioStore((s) => s.unit);
  const showRulers = useStudioStore((s) => s.showRulers);
  const showGuides = useStudioStore((s) => s.showGuides);
  const capabilities = useStudioStore((s) => s.capabilities);
  const printJob = useStudioStore((s) => s.printJob);
  const desktopManifestToRestore = useStudioStore((s) => s.desktopManifestToRestore);

  const setActiveSheetIndex = useStudioStore((s) => s.setActiveSheetIndex);
  const setZoom = useStudioStore((s) => s.setZoom);
  const assignSlotOverride = useStudioStore((s) => s.assignSlotOverride);
  const swapSlotsOnSheet = useStudioStore((s) => s.swapSlotsOnSheet);
  const resetSlotOverrides = useStudioStore((s) => s.resetSlotOverrides);
  const selectDriverPaper = useStudioStore((s) => s.selectDriverPaper);
  const clearDesktopRestoreManifest = useStudioStore((s) => s.clearDesktopRestoreManifest);

  const [isWorkspaceDragOver, setIsWorkspaceDragOver] = useState(false);

  const totalSheets = plan.sheets.length;
  const clampedSheetIdx =
    totalSheets === 0 ? 0 : Math.min(activeSheetIndex, Math.max(0, totalSheets - 1));

  useEffect(() => {
    if (clampedSheetIdx !== activeSheetIndex) {
      setActiveSheetIndex(clampedSheetIdx);
    }
  }, [clampedSheetIdx, activeSheetIndex, setActiveSheetIndex]);

  const currentSheet = plan.sheets[clampedSheetIdx] ?? null;
  const pxPerMm = BASE_PX_PER_MM * zoom;
  const sheetWidthPx = Math.max(40, Math.round(plan.sheetWidthMm * pxPerMm));
  const sheetHeightPx = Math.max(40, Math.round(plan.sheetHeightMm * pxPerMm));

  // Physical paper sheets consumed calculation
  const sheetsPerCopy =
    printJob.duplex === 'simplex' ? totalSheets : Math.ceil(totalSheets / 2);
  const totalPhysicalPaperCount = sheetsPerCopy * Math.max(1, printJob.copies || 1);

  // Driver paper mismatch check
  const selectedDriverPaper =
    capabilities?.papers.find((p) => p.id === printJob.paperId) ?? null;
  const hasDriverPaperMismatch =
    pages.length > 0 &&
    selectedDriverPaper !== null &&
    !isDriverPaperMatchingSheet(plan.sheetWidthMm, plan.sheetHeightMm, selectedDriverPaper);

  const matchingDriverPaper = capabilities
    ? findBestDriverPaper(
        capabilities.papers,
        plan.sheetWidthMm,
        plan.sheetHeightMm,
        layout.paperSize
      )
    : undefined;

  const hasManualCellOverrides = Object.keys(slotOverrides).length > 0;

  const handleWorkspaceDrop = (e: React.DragEvent<HTMLDivElement>) => {
    // Ignore internal page/cell drags
    if (
      e.dataTransfer.types.includes(DND_MIME_PAGE_ID) ||
      e.dataTransfer.types.includes(DND_MIME_SHEET_CELL)
    ) {
      return;
    }
    e.preventDefault();
    setIsWorkspaceDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length > 0) {
      onFilesDropped(droppedFiles);
    }
  };

  const fitSheetToViewport = () => {
    // Fit nicely inside center panel
    const maxW = 680;
    const maxH = 620;
    const targetZoom = Math.min(
      maxW / (plan.sheetWidthMm * BASE_PX_PER_MM),
      maxH / (plan.sheetHeightMm * BASE_PX_PER_MM)
    );
    setZoom(Math.min(2.0, Math.max(0.35, targetZoom)));
  };

  return (
    <main
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setIsWorkspaceDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsWorkspaceDragOver(false);
        }
      }}
      onDrop={handleWorkspaceDrop}
      onWheel={(e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.08 : -0.08;
          setZoom(zoom + delta);
        }
      }}
      className="flex-1 min-w-0 h-full flex flex-col bg-slate-100 dark:bg-slate-950 relative overflow-hidden"
    >
      {/* Drag-over File Overlay */}
      {isWorkspaceDragOver && (
        <div className="pointer-events-none absolute inset-3 rounded-2xl border-2 border-dashed border-blue-500 bg-blue-600/10 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center text-blue-700 dark:text-blue-300">
          <FileUp className="w-12 h-12 mb-2 animate-bounce" />
          <p className="text-base font-bold">فایل‌های PDF یا تصاویر را اینجا رها کنید</p>
          <p className="text-xs opacity-80 mt-1">PDF, JPG, PNG, WebP, TIFF, BMP</p>
        </div>
      )}

      {/* Top Sheet Navigation & Quick Stats Strip */}
      {pages.length > 0 && (
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xs flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
          {/* Sheet X of Y Navigator */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={clampedSheetIdx <= 0}
              onClick={() => setActiveSheetIndex(0)}
              title="شیت اول"
              className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={clampedSheetIdx <= 0}
              onClick={() => setActiveSheetIndex(clampedSheetIdx - 1)}
              title="شیت قبلی"
              className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100">
              {totalSheets > 0 ? (
                <span>
                  شیت <span className="font-num text-blue-600 dark:text-blue-400">{clampedSheetIdx + 1}</span> از{' '}
                  <span className="font-num">{totalSheets}</span>
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">هیچ صفحه‌ای فعال نیست</span>
              )}
            </div>

            <button
              type="button"
              disabled={clampedSheetIdx >= totalSheets - 1}
              onClick={() => setActiveSheetIndex(clampedSheetIdx + 1)}
              title="شیت بعدی"
              className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={clampedSheetIdx >= totalSheets - 1}
              onClick={() => setActiveSheetIndex(Math.max(0, totalSheets - 1))}
              title="شیت آخر"
              className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            <span className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

            <span className="text-xs text-slate-600 dark:text-slate-300">
              مصرف کل کاغذ:{' '}
              <strong className="font-num text-emerald-600 dark:text-emerald-400">
                {totalPhysicalPaperCount} برگ
              </strong>
              {printJob.duplex !== 'simplex' && (
                <span className="text-[11px] text-slate-400 ms-1">(چاپ دورو)</span>
              )}
            </span>
          </div>

          {/* Right side: Cell dimensions + Reset Manual Slot Overrides + Zoom */}
          <div className="flex items-center gap-2">
            {hasManualCellOverrides && (
              <button
                type="button"
                onClick={resetSlotOverrides}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>بازنشانی چیدمان دستی خانه‌ها</span>
              </button>
            )}

            <span
              dir="ltr"
              className="hidden xl:inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-num text-slate-600 dark:text-slate-300"
              title="ابعاد هر خانه جدول"
            >
              خانه: {formatLength(plan.cellWidthMm, unit)}×{formatLength(plan.cellHeightMm, unit)}{' '}
              {UNIT_LABELS[unit].short}
            </span>

            <div className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-7 px-1 gap-0.5">
              <button
                type="button"
                onClick={() => setZoom(zoom - 0.1)}
                title="کوچک‌نمایی"
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 text-[11px] font-num font-semibold min-w-11 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom(zoom + 0.1)}
                title="بزرگ‌نمایی"
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={fitSheetToViewport}
                title="تنظیم بزرگ‌نمایی متناسب با صفحه"
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Warnings Banner (Overflow / Printable Area / Paper Size Mismatch) */}
      {pages.length > 0 && (plan.warnings.length > 0 || hasDriverPaperMismatch) && (
        <div className="px-4 py-1.5 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800/70 flex flex-col gap-1 z-20 shrink-0">
          {plan.warnings.map((w) => (
            <div
              key={w.code}
              className={`flex items-center gap-2 text-xs ${
                w.severity === 'error'
                  ? 'text-rose-700 dark:text-rose-300 font-semibold'
                  : 'text-amber-800 dark:text-amber-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{w.messageFa}</span>
            </div>
          ))}

          {hasDriverPaperMismatch && selectedDriverPaper && (
            <div className="flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  عدم تطابق کاغذ: شیت چیدمان ({Math.round(plan.sheetWidthMm)}×
                  {Math.round(plan.sheetHeightMm)} mm) با کاغذ انتخابی پرینتر «
                  {selectedDriverPaper.name}» هم‌خوانی ندارد.
                </span>
              </div>
              {matchingDriverPaper && (
                <button
                  type="button"
                  onClick={() => selectDriverPaper(matchingDriverPaper)}
                  className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-medium shrink-0 cursor-pointer"
                >
                  تغییر خودکار به {matchingDriverPaper.name}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Center Canvas / Empty State */}
      {pages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {/* Desktop Auto-Save Restore Banner */}
          {desktopManifestToRestore.length > 0 && (
            <div className="mb-5 max-w-md w-full rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/90 dark:bg-blue-950/50 p-3.5 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <History className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-slate-800 dark:text-slate-100">
                    آخرین پروژه ذخیره‌شده آماده بازیابی است
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    شامل {desktopManifestToRestore.length} صفحه از جلسه کاری قبلی
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={onRestoreDesktopManifest}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  بازیابی
                </button>
                <button
                  type="button"
                  onClick={clearDesktopRestoreManifest}
                  className="px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
                >
                  نادیده
                </button>
              </div>
            </div>
          )}

          <div
            onClick={onTriggerFilePicker}
            className="max-w-lg w-full rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-white/80 dark:bg-slate-900/70 p-10 text-center transition cursor-pointer shadow-xs group"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition">
              <FileUp className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              فایل را اینجا بکشید و رها کنید
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              پشتیبانی هم‌زمان از چند فایل <strong>PDF چندصفحه‌ای</strong> و تصاویر با کیفیت اصلی (
              <strong>JPG, PNG, WebP, TIFF, BMP</strong>) برای چاپ، ادغام یا شیت‌بندی ماتریسی
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTriggerFilePicker();
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                انتخاب فایل از کامپیوتر (Ctrl+O)
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadDemoFiles();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>نمونه آماده تست چاپخانه</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
          <div dir="ltr" className="inline-flex flex-col items-start my-auto">
            {/* Horizontal Ruler */}
            {showRulers && (
              <div className="flex items-end">
                <div className="w-5 h-5 bg-slate-200 dark:bg-slate-900 border-t border-s border-slate-300 dark:border-slate-700 flex items-center justify-center text-[8px] font-num text-slate-500">
                  {UNIT_LABELS[unit].short}
                </div>
                <SheetRuler
                  axis="horizontal"
                  lengthMm={plan.sheetWidthMm}
                  pxPerMm={pxPerMm}
                  unit={unit}
                />
              </div>
            )}

            <div className="flex items-start">
              {/* Vertical Ruler */}
              {showRulers && (
                <SheetRuler
                  axis="vertical"
                  lengthMm={plan.sheetHeightMm}
                  pxPerMm={pxPerMm}
                  unit={unit}
                />
              )}

              {/* Physical White Sheet */}
              <div
                style={{
                  width: `${sheetWidthPx}px`,
                  height: `${sheetHeightPx}px`,
                }}
                className="relative bg-white text-slate-900 shadow-xl ring-1 ring-slate-300 dark:ring-slate-700 overflow-hidden select-none"
              >
                {/* Unprintable Edge Safety Guide */}
                {showGuides && layout.bleedWarningMm > 0 && (
                  <div
                    style={{
                      left: `${layout.bleedWarningMm * pxPerMm}px`,
                      top: `${layout.bleedWarningMm * pxPerMm}px`,
                      right: `${layout.bleedWarningMm * pxPerMm}px`,
                      bottom: `${layout.bleedWarningMm * pxPerMm}px`,
                    }}
                    className="pointer-events-none absolute border border-dotted border-rose-300/80"
                  />
                )}

                {/* Margin Guide Box */}
                {showGuides && (
                  <div
                    style={{
                      left: `${plan.usableBoxMm.x * pxPerMm}px`,
                      top: `${plan.usableBoxMm.y * pxPerMm}px`,
                      width: `${plan.usableBoxMm.width * pxPerMm}px`,
                      height: `${plan.usableBoxMm.height * pxPerMm}px`,
                    }}
                    className="pointer-events-none absolute border border-dashed border-blue-400/60"
                  />
                )}

                {/* Matrix Cells */}
                {currentSheet &&
                  currentSheet.cells.map((cell) => (
                    <CellPreviewBox
                      key={`${currentSheet.sheetIndex}:${cell.cellIndex}`}
                      cell={cell}
                      pxPerMm={pxPerMm}
                      sheetIndex={currentSheet.sheetIndex}
                      showGuides={showGuides}
                      onDropPageIntoCell={(pageId) =>
                        assignSlotOverride(currentSheet.sheetIndex, cell.cellIndex, pageId)
                      }
                      onSwapCells={(fromSheet, fromCell) =>
                        swapSlotsOnSheet(
                          fromSheet,
                          fromCell,
                          currentSheet.sheetIndex,
                          cell.cellIndex,
                          plan
                        )
                      }
                      onSetCellEmpty={() =>
                        assignSlotOverride(
                          currentSheet.sheetIndex,
                          cell.cellIndex,
                          EMPTY_SLOT_MARKER
                        )
                      }
                      onResetCellOverride={() =>
                        assignSlotOverride(currentSheet.sheetIndex, cell.cellIndex, null)
                      }
                    />
                  ))}

                {/* Vector Crop Marks Overlay */}
                {currentSheet && currentSheet.cropMarks.length > 0 && (
                  <svg
                    width={sheetWidthPx}
                    height={sheetHeightPx}
                    className="pointer-events-none absolute inset-0 z-10"
                  >
                    {currentSheet.cropMarks.map((seg, i) => (
                      <line
                        key={i}
                        x1={seg.x1Mm * pxPerMm}
                        y1={seg.y1Mm * pxPerMm}
                        x2={seg.x2Mm * pxPerMm}
                        y2={seg.y2Mm * pxPerMm}
                        stroke="#1e293b"
                        strokeWidth={1}
                      />
                    ))}
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
