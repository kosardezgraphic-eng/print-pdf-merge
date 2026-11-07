import React, { useState, useEffect } from 'react';
import {
  Layers,
  FileText,
  RotateCw,
  PlusCircle,
  Copy,
  Trash2,
  CheckSquare,
  Square,
  ChevronRight,
  ChevronLeft,
  Eye,
  Sliders,
  Maximize2,
  FolderOpen,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Sparkles,
  GripVertical,
} from 'lucide-react';
import { PDFItem, Language, PageAdjustment } from '../types';
import { renderPdfPageToDataUrl, defaultAdjustment } from '../utils/pdfRenderUtils';
import { OverlayElementsLayer } from './OverlayElementsLayer';

interface SidebarPagesProps {
  items: PDFItem[];
  lang: Language;
  theme: 'dark' | 'light';
  activePageGlobalIndex: number;
  selectedEditingPageKeys: Set<string>; // Keys format: `${itemId}_${pageNum}`
  onSelectPage: (globalIndex: number, item: PDFItem, pageNum: number, isMulti?: boolean) => void;
  onTogglePagePrint: (item: PDFItem, pageNum: number) => void;
  onSelectAllPagesForPrint: (enabled: boolean) => void;
  onSelectAllEditingPages: () => void;
  onSelectNoneEditingPages: () => void;
  onSelectOddEditingPages: () => void;
  onSelectEvenEditingPages: () => void;
  onInvertEditingSelection: () => void;
  onRotatePage: (item: PDFItem, pageNum: number) => void;
  onOpenPageStudio: (item: PDFItem) => void;
  onRemoveFile: (itemId: string) => void;
  onMoveFileUp: (index: number) => void;
  onMoveFileDown: (index: number) => void;
  onReorderPage: (
    sourceItemId: string,
    sourcePageNum: number,
    targetItemId: string,
    targetPageNum: number
  ) => void;
  onDuplicatePage: (item: PDFItem, pageNum: number, copies: number) => void;
  onInsertBlankPage: (item: PDFItem, pageNum: number, copies: number) => void;
  onDeletePage: (item: PDFItem, pageNum: number) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const SidebarPages: React.FC<SidebarPagesProps> = ({
  items,
  lang,
  theme,
  activePageGlobalIndex,
  selectedEditingPageKeys,
  onSelectPage,
  onTogglePagePrint,
  onSelectAllPagesForPrint,
  onSelectAllEditingPages,
  onSelectNoneEditingPages,
  onSelectOddEditingPages,
  onSelectEvenEditingPages,
  onInvertEditingSelection,
  onRotatePage,
  onOpenPageStudio,
  onRemoveFile,
  onMoveFileUp,
  onMoveFileDown,
  onReorderPage,
  onDuplicatePage,
  onInsertBlankPage,
  onDeletePage,
  isCollapsed,
  onToggleCollapse,
}) => {
  const isDark = theme === 'dark';
  const isFa = lang === 'fa';

  const [sidebarTab, setSidebarTab] = useState<'pages' | 'files'>('pages');
  const [thumbnailCache, setThumbnailCache] = useState<Record<string, string>>({});
  const [draggedPage, setDraggedPage] = useState<{ itemId: string; pageNum: number } | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  // Popover state for duplicate or blank page insertion
  const [activePopover, setActivePopover] = useState<{
    type: 'duplicate' | 'blank';
    itemId: string;
    pageNum: number;
    copies: number;
  } | null>(null);

  // Compute all flat pages with origin metadata
  const flatPages = React.useMemo(() => {
    const list: {
      globalIndex: number;
      item: PDFItem;
      pageNum: number;
      selectedForPrint: boolean;
    }[] = [];

    let count = 0;
    for (const item of items) {
      const pCount = item.pageCount || 1;
      for (let p = 1; p <= pCount; p++) {
        const adj = item.pageAdjustments?.[p];
        const isSelected = adj ? adj.selectedForPrint : true;
        list.push({
          globalIndex: count++,
          item,
          pageNum: p,
          selectedForPrint: isSelected,
        });
      }
    }
    return list;
  }, [items]);

  // Lazy render visible thumbnails
  useEffect(() => {
    let isCancelled = false;

    // Render around active page
    const start = Math.max(0, activePageGlobalIndex - 8);
    const end = Math.min(flatPages.length, start + 30);

    for (let i = start; i < end; i++) {
      const target = flatPages[i];
      if (!target) continue;
      const key = `${target.item.id}_${target.pageNum}`;
      if (!thumbnailCache[key]) {
        renderPdfPageToDataUrl(target.item.file, target.pageNum, 0.3)
          .then((res) => {
            if (!isCancelled) {
              setThumbnailCache((prev) => ({ ...prev, [key]: res.dataUrl }));
            }
          })
          .catch(() => {});
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [activePageGlobalIndex, flatPages, thumbnailCache]);

  if (isCollapsed) {
    return (
      <aside
        className={`w-10 border-s border-neutral-300 dark:border-neutral-800 flex flex-col items-center py-3 shrink-0 relative z-30 transition-all ${
          isDark ? 'bg-neutral-900' : 'bg-slate-50'
        }`}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-100 cursor-pointer"
          title={isFa ? 'باز کردن پنل صفحات' : 'Expand Sidebar'}
        >
          {isFa ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="writing-vertical-lr text-neutral-400 font-semibold text-xs mt-6 tracking-wider">
          {isFa ? 'صفحات و فایل‌ها' : 'Pages & Files'}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`w-80 border-s flex flex-col shrink-0 select-none transition-colors overflow-hidden relative z-20 ${
        isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-slate-50 border-slate-300 text-slate-900'
      }`}
    >
      {/* Sidebar Header with Tabs & Collapse Button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-1 bg-black/5 dark:bg-neutral-800/80 p-0.5 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSidebarTab('pages')}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              sidebarTab === 'pages'
                ? isDark
                  ? 'bg-neutral-700 text-white shadow-xs'
                  : 'bg-white text-slate-900 shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {isFa ? 'صفحات' : 'Pages'} ({flatPages.length})
          </button>
          <button
            type="button"
            onClick={() => setSidebarTab('files')}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              sidebarTab === 'files'
                ? isDark
                  ? 'bg-neutral-700 text-white shadow-xs'
                  : 'bg-white text-slate-900 shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {isFa ? 'فایل‌ها' : 'Files'} ({items.length})
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-black/10 dark:hover:bg-neutral-800 cursor-pointer"
          title={isFa ? 'جمع‌کردن سایدبار' : 'Collapse Sidebar'}
        >
          {isFa ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* TAB 1: ALL PAGES THUMBNAILS */}
      {sidebarTab === 'pages' && (
        <>
          {/* Quick Selection Ribbon for Editing vs Print */}
          <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800/80 flex flex-col gap-1.5 text-[11px] bg-black/5 dark:bg-neutral-950/40">
            {/* ROW 1: Selection for Editing (The bold outline pages) */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                {isFa ? 'انتخاب ویرایش:' : 'Select for Edit:'}
              </span>
              <div className="flex items-center gap-1 font-semibold text-neutral-400">
                <button
                  type="button"
                  onClick={onSelectAllEditingPages}
                  className="hover:text-blue-500 px-1 py-0.5 rounded cursor-pointer"
                  title={isFa ? 'انتخاب همه صفحات' : 'Select All'}
                >
                  {isFa ? 'همه' : 'All'}
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={onSelectNoneEditingPages}
                  className="hover:text-blue-500 px-1 py-0.5 rounded cursor-pointer"
                  title={isFa ? 'لغو انتخاب همه' : 'None'}
                >
                  {isFa ? 'هیچ' : 'None'}
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={onSelectOddEditingPages}
                  className="hover:text-blue-500 px-1 py-0.5 rounded cursor-pointer"
                  title={isFa ? 'انتخاب صفحات فرد' : 'Odd'}
                >
                  {isFa ? 'فرد' : 'Odd'}
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={onSelectEvenEditingPages}
                  className="hover:text-blue-500 px-1 py-0.5 rounded cursor-pointer"
                  title={isFa ? 'انتخاب صفحات زوج' : 'Even'}
                >
                  {isFa ? 'زوج' : 'Even'}
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={onInvertEditingSelection}
                  className="hover:text-amber-500 px-1 py-0.5 rounded cursor-pointer"
                  title={isFa ? 'معکوس کردن انتخاب' : 'Invert'}
                >
                  {isFa ? 'معکوس' : 'Invert'}
                </button>
              </div>
            </div>

            {/* ROW 2: Print Checkboxes Inclusion */}
            <div className="flex items-center justify-between text-[10px] text-neutral-400 border-t border-neutral-200 dark:border-neutral-800/40 pt-1">
              <span>{isFa ? 'چک‌باکس چاپ:' : 'Print Checkbox:'}</span>
              <div className="flex items-center gap-1.5 font-medium">
                <button
                  type="button"
                  onClick={() => onSelectAllPagesForPrint(true)}
                  className="hover:text-emerald-500 cursor-pointer"
                >
                  {isFa ? 'تیک همه' : 'Check All'}
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => onSelectAllPagesForPrint(false)}
                  className="hover:text-red-500 cursor-pointer"
                >
                  {isFa ? 'تیک هیچ' : 'Uncheck All'}
                </button>
              </div>
            </div>
          </div>

          {/* Thumbnails Grid List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {items.length === 0 ? (
              <div className="text-center py-12 text-neutral-400 text-xs">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>{isFa ? 'هیچ سندی بارگذاری نشده است.' : 'No documents loaded.'}</p>
              </div>
            ) : (
              items.map((fileItem) => {
                const pCount = fileItem.pageCount || 1;
                const filePages = flatPages.filter((fp) => fp.item.id === fileItem.id);

                return (
                  <div
                    key={fileItem.id}
                    className={`rounded-xl border overflow-hidden transition-colors ${
                      isDark ? 'bg-neutral-850 border-neutral-750' : 'bg-white border-slate-200'
                    }`}
                  >
                    {/* Document Header */}
                    <div className="px-2.5 py-1.5 bg-black/10 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="font-semibold truncate max-w-[140px]" title={fileItem.name}>
                          {fileItem.name}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">({pCount}ص)</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenPageStudio(fileItem)}
                          className="p-1 rounded hover:bg-blue-500/20 text-neutral-400 hover:text-blue-500 cursor-pointer"
                          title={isFa ? 'فوکوس روی این فایل در بوم زنده' : 'Focus File on Live Canvas'}
                        >
                          <Sliders className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveFile(fileItem.id)}
                          className="p-1 rounded hover:bg-red-500/20 text-neutral-400 hover:text-red-500 cursor-pointer"
                          title={isFa ? 'حذف فایل' : 'Remove File'}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Page Thumbnails inside this file */}
                    <div className="p-2 grid grid-cols-2 gap-2">
                      {filePages.map(({ globalIndex, pageNum, selectedForPrint }) => {
                        const pageKey = `${fileItem.id}_${pageNum}`;
                        const thumbUrl = thumbnailCache[pageKey];
                        const isActive = activePageGlobalIndex === globalIndex;
                        const isSelectedForEdit = selectedEditingPageKeys.has(pageKey);
                        const isDropTarget = dropTargetKey === pageKey;

                        const adj = fileItem.pageAdjustments?.[pageNum] || { ...defaultAdjustment };
                        const totalRotation = ((fileItem.rotation || 0) + (adj.rotation || 0) + (adj.fineAngle || 0)) % 360;
                        const scalePct = (adj.scale || 100) / 100;
                        const offX = adj.offsetX || 0;
                        const offY = adj.offsetY || 0;
                        const cropTop = adj.crop?.top || 0;
                        const cropRight = adj.crop?.right || 0;
                        const cropBottom = adj.crop?.bottom || 0;
                        const cropLeft = adj.crop?.left || 0;
                        const hasCrop = cropTop > 0 || cropRight > 0 || cropBottom > 0 || cropLeft > 0;

                        const filterParts: string[] = [];
                        if (adj.threshold) {
                          filterParts.push('contrast(220%) grayscale(100%)');
                        } else if (adj.grayscale) {
                          filterParts.push('grayscale(100%)');
                        }
                        if (adj.brightness && adj.brightness !== 100) {
                          filterParts.push(`brightness(${adj.brightness}%)`);
                        }
                        if (adj.contrast && adj.contrast !== 100) {
                          filterParts.push(`contrast(${adj.contrast}%)`);
                        }
                        if (adj.invert) {
                          filterParts.push('invert(100%)');
                        }
                        const filterStr = filterParts.length > 0 ? filterParts.join(' ') : 'none';

                        return (
                          <div
                            key={globalIndex}
                            draggable
                            onDragStart={(e) => {
                              setDraggedPage({ itemId: fileItem.id, pageNum });
                              e.dataTransfer.setData('text/plain', JSON.stringify({ itemId: fileItem.id, pageNum }));
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              if (dropTargetKey !== pageKey) {
                                setDropTargetKey(pageKey);
                              }
                            }}
                            onDragLeave={() => {
                              if (dropTargetKey === pageKey) setDropTargetKey(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDropTargetKey(null);
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                                if (data && (data.itemId !== fileItem.id || data.pageNum !== pageNum)) {
                                  onReorderPage(data.itemId, data.pageNum, fileItem.id, pageNum);
                                }
                              } catch {}
                            }}
                            onClick={(e) => {
                              const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;
                              onSelectPage(globalIndex, fileItem, pageNum, isMulti);
                            }}
                            className={`group relative rounded-xl border p-1.5 flex flex-col items-center transition-all cursor-pointer ${
                              isDropTarget
                                ? 'border-amber-500 ring-2 ring-amber-500 bg-amber-500/10'
                                : isSelectedForEdit
                                ? 'border-blue-600 ring-2.5 ring-blue-500/60 bg-blue-500/15 dark:bg-blue-600/20 shadow-md'
                                : isActive
                                ? 'border-blue-400 ring-1.5 ring-blue-400/40 bg-blue-50/20 dark:bg-blue-950/20'
                                : isDark
                                ? 'border-neutral-700/80 hover:border-neutral-600 bg-neutral-800'
                                : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                            }`}
                          >
                            {/* Drag Grip Indicator */}
                            <div className="absolute top-1 start-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-neutral-400">
                              <GripVertical className="w-3.5 h-3.5" />
                            </div>

                            {/* Selected for Edit Check Badge */}
                            {isSelectedForEdit && (
                              <div className="absolute top-1 end-1 z-10 bg-blue-600 text-white rounded-full p-0.5 shadow-xs">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                            )}

                            {/* Thumbnail Canvas Frame */}
                            <div className="w-full aspect-[1/1.4] bg-white rounded-lg flex items-center justify-center overflow-hidden shadow-xs relative mt-0.5">
                              {thumbUrl ? (
                                <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
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
                                      transform: `translate(${offX}%, ${offY}%) rotate(${totalRotation}deg) scale(${scalePct})`,
                                      transformOrigin: 'center center',
                                      transition: 'transform 0.08s ease-out',
                                    }}
                                  >
                                    <img
                                      src={thumbUrl}
                                      alt={`Page ${pageNum}`}
                                      style={{
                                        filter: filterStr,
                                      }}
                                      className="max-w-full max-h-full object-contain pointer-events-none select-none"
                                    />
                                  </div>

                                  {/* Live Overlay Elements on Thumbnail for 100% WYSIWYG */}
                                  {adj && (
                                    <OverlayElementsLayer
                                      adjustment={adj}
                                      pageNum={pageNum}
                                      totalPages={pCount}
                                      activeTool="move"
                                      selectedTextId={null}
                                      selectedShapeId={null}
                                      onSelectText={() => {}}
                                      onSelectShape={() => {}}
                                      onSelectTool={() => {}}
                                      onUpdateText={() => {}}
                                      onUpdateShape={() => {}}
                                      onUpdateNumbering={() => {}}
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-400 font-mono">
                                  #{pageNum}
                                </div>
                              )}

                              {/* Hover Quick Action Buttons */}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                                {/* Rotate */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRotatePage(fileItem, pageNum);
                                  }}
                                  className="p-1 rounded bg-black/70 text-white hover:bg-blue-600 transition-colors"
                                  title={isFa ? 'چرخش ۹۰ درجه' : 'Rotate'}
                                >
                                  <RotateCw className="w-3 h-3" />
                                </button>

                                {/* Duplicate */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActivePopover({
                                      type: 'duplicate',
                                      itemId: fileItem.id,
                                      pageNum,
                                      copies: 1,
                                    });
                                  }}
                                  className="p-1 rounded bg-black/70 text-white hover:bg-emerald-600 transition-colors"
                                  title={isFa ? 'تکثیر برگه' : 'Duplicate'}
                                >
                                  <Copy className="w-3 h-3" />
                                </button>

                                {/* Insert Blank */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActivePopover({
                                      type: 'blank',
                                      itemId: fileItem.id,
                                      pageNum,
                                      copies: 1,
                                    });
                                  }}
                                  className="p-1 rounded bg-black/70 text-white hover:bg-purple-600 transition-colors"
                                  title={isFa ? 'درج صفحه سفید' : 'Insert Blank'}
                                >
                                  <PlusCircle className="w-3 h-3" />
                                </button>

                                {/* Delete */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeletePage(fileItem, pageNum);
                                  }}
                                  className="p-1 rounded bg-black/70 text-white hover:bg-red-600 transition-colors"
                                  title={isFa ? 'حذف صفحه' : 'Delete'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Bottom Controls: Checkbox for Print & Page Number */}
                            <div className="w-full mt-1.5 flex items-center justify-between text-[11px] px-0.5">
                              <label
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 cursor-pointer select-none text-neutral-400 hover:text-neutral-200"
                                title={isFa ? 'فعال / غیرفعال برای چاپ' : 'Include in Print'}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedForPrint}
                                  onChange={() => onTogglePagePrint(fileItem, pageNum)}
                                  className="rounded accent-emerald-600 cursor-pointer w-3.5 h-3.5"
                                />
                                <span className={`text-[10px] font-mono ${isSelectedForEdit ? 'text-blue-500 font-bold' : ''}`}>
                                  {isFa ? `ص ${pageNum}` : `p. ${pageNum}`}
                                </span>
                              </label>

                              {isSelectedForEdit && (
                                <span className="text-[9px] font-bold text-blue-500">
                                  {isFa ? 'ویرایش' : 'Edit'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* TAB 2: FILES ORDERING */}
      {sidebarTab === 'files' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {items.map((file, idx) => (
            <div
              key={file.id}
              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                isDark ? 'bg-neutral-850 border-neutral-750' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold truncate">{file.name}</div>
                  <div className="text-[10px] text-neutral-400 font-mono">
                    {file.pageCount || 1} {isFa ? 'صفحه' : 'pages'} · {(file.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => onMoveFileUp(idx)}
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-neutral-700 disabled:opacity-30 cursor-pointer"
                  title={isFa ? 'حرکت به بالا' : 'Move Up'}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === items.length - 1}
                  onClick={() => onMoveFileDown(idx)}
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-neutral-700 disabled:opacity-30 cursor-pointer"
                  title={isFa ? 'حرکت به پایین' : 'Move Down'}
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveFile(file.id)}
                  className="p-1 rounded hover:bg-red-500/20 text-neutral-400 hover:text-red-500 cursor-pointer"
                  title={isFa ? 'حذف' : 'Remove'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline Modal for Duplicate / Insert Blank */}
      {activePopover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div
            className={`w-full max-w-xs rounded-2xl border p-4 shadow-2xl ${
              isDark ? 'bg-neutral-900 border-neutral-750 text-white' : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between font-bold text-xs mb-3 border-b pb-2">
              <span className="flex items-center gap-1.5">
                {activePopover.type === 'duplicate' ? (
                  <Copy className="w-4 h-4 text-emerald-500" />
                ) : (
                  <PlusCircle className="w-4 h-4 text-purple-500" />
                )}
                <span>
                  {activePopover.type === 'duplicate'
                    ? isFa
                      ? `تکثیر صفحه ${activePopover.pageNum}`
                      : `Duplicate Page ${activePopover.pageNum}`
                    : isFa
                    ? `درج صفحه سفید بعد از صفحه ${activePopover.pageNum}`
                    : `Insert Blank Page after ${activePopover.pageNum}`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setActivePopover(null)}
                className="text-neutral-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-neutral-400">{isFa ? 'تعداد نسخه‌ها:' : 'Copies count:'}</span>
              <input
                type="number"
                min={1}
                max={50}
                value={activePopover.copies}
                onChange={(e) =>
                  setActivePopover({
                    ...activePopover,
                    copies: Math.max(1, parseInt(e.target.value, 10) || 1),
                  })
                }
                className="w-16 px-2 py-1 text-center font-mono rounded-lg border border-neutral-700 bg-neutral-800 text-white text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActivePopover(null)}
                className="px-3 py-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-xs"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetItem = items.find((i) => i.id === activePopover.itemId);
                  if (targetItem) {
                    if (activePopover.type === 'duplicate') {
                      onDuplicatePage(targetItem, activePopover.pageNum, activePopover.copies);
                    } else {
                      onInsertBlankPage(targetItem, activePopover.pageNum, activePopover.copies);
                    }
                  }
                  setActivePopover(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
              >
                {isFa ? 'تایید و اعمال' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
