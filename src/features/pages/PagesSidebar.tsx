import React, { useRef, useState, useMemo } from 'react';
import {
  CheckCheck,
  FilePlus2,
  Layers,
  RotateCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { VirtualPageRow } from './VirtualPageRow';

export const DND_MIME_PAGE_ID = 'application/x-kosar-page-id';
export const DND_MIME_REORDER_IDS = 'application/x-kosar-reorder-ids';

interface PagesSidebarProps {
  onTriggerFilePicker: () => void;
}

const ITEM_SLOT_HEIGHT = 104; // 98px card + 6px gap
const OVERSCAN_COUNT = 6;

export const PagesSidebar: React.FC<PagesSidebarProps> = ({ onTriggerFilePicker }) => {
  const pages = useStudioStore((s) => s.pages);
  const selectedPageIds = useStudioStore((s) => s.selectedPageIds);
  const unit = useStudioStore((s) => s.unit);
  const isIngesting = useStudioStore((s) => s.isIngesting);
  const ingestStatusText = useStudioStore((s) => s.ingestStatusText);

  const selectPage = useStudioStore((s) => s.selectPage);
  const selectAllPages = useStudioStore((s) => s.selectAllPages);
  const togglePageEnabled = useStudioStore((s) => s.togglePageEnabled);
  const setAllPagesEnabled = useStudioStore((s) => s.setAllPagesEnabled);
  const rotatePagesClockwise = useStudioStore((s) => s.rotatePagesClockwise);
  const setPageCopies = useStudioStore((s) => s.setPageCopies);
  const removePages = useStudioStore((s) => s.removePages);
  const reorderPages = useStudioStore((s) => s.reorderPages);
  const clearAllWorkspace = useStudioStore((s) => s.clearAllWorkspace);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(720);
  const [dropIndicator, setDropIndicator] = useState<{
    index: number;
    position: 'before' | 'after';
  } | null>(null);

  const selectedSet = useMemo(() => new Set(selectedPageIds), [selectedPageIds]);
  const enabledCount = useMemo(() => pages.filter((p) => p.enabled).length, [pages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    if (e.currentTarget.clientHeight > 0 && e.currentTarget.clientHeight !== viewportHeight) {
      setViewportHeight(e.currentTarget.clientHeight);
    }
  };

  const totalHeight = pages.length * ITEM_SLOT_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_SLOT_HEIGHT) - OVERSCAN_COUNT);
  const endIndex = Math.min(
    pages.length,
    Math.ceil((scrollTop + viewportHeight) / ITEM_SLOT_HEIGHT) + OVERSCAN_COUNT
  );

  const visibleSlice = pages.slice(startIndex, endIndex);

  return (
    <aside className="w-80 shrink-0 h-full border-e border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 flex flex-col select-none">
      {/* Sidebar Header */}
      <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
            صفحات ورودی
          </h2>
          <span className="px-1.5 py-0.5 text-[10px] font-num font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {enabledCount}/{pages.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onTriggerFilePicker}
            title="افزودن فایل PDF یا عکس (Ctrl+O)"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>افزودن</span>
          </button>

          {pages.length > 0 && (
            <button
              type="button"
              onClick={clearAllWorkspace}
              title="پاک کردن تمام صفحات"
              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Batch Multi-Selection Bar */}
      {pages.length > 0 && (
        <div className="px-3 py-1.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/50 flex items-center justify-between gap-1 text-[11px]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAllPagesEnabled(enabledCount < pages.length)}
              className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium cursor-pointer"
            >
              {enabledCount < pages.length ? 'تیک همه' : 'لغو تیک همه'}
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              type="button"
              onClick={selectAllPages}
              className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
              title="انتخاب همه صفحات (Ctrl+A)"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>انتخاب همه</span>
            </button>
          </div>

          {selectedPageIds.length > 1 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-num text-blue-600 dark:text-blue-400 font-semibold">
                {selectedPageIds.length} مورد:
              </span>
              <button
                type="button"
                onClick={() => rotatePagesClockwise(selectedPageIds)}
                title="چرخش ۹۰ درجه انتخاب‌شده‌ها"
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removePages(selectedPageIds)}
                title="حذف صفحات انتخاب‌شده (Delete)"
                className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading Indicator during batch ingestion */}
      {isIngesting && (
        <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/60 border-b border-blue-200 dark:border-blue-900 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
          <span className="truncate">{ingestStatusText || 'در حال پردازش فایل‌ها...'}</span>
        </div>
      )}

      {/* Virtualized Pages List */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDropIndicator(null);
          }
        }}
        className="flex-1 overflow-y-auto px-2.5 py-2"
      >
        {pages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 text-slate-400 dark:text-slate-500">
            <Layers className="w-9 h-9 mb-2 opacity-40" />
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              هنوز فایلی اضافه نشده است
            </p>
            <p className="text-[11px] mt-1 leading-relaxed">
              تک‌تک صفحات هر PDF و هر عکس در این ستون به شکل مستقل لیست می‌شوند.
            </p>
          </div>
        ) : (
          <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
            {visibleSlice.map((page, localIdx) => {
              const globalIdx = startIndex + localIdx;
              const isSelected = selectedSet.has(page.id);

              return (
                <div
                  key={page.id}
                  style={{
                    position: 'absolute',
                    top: `${globalIdx * ITEM_SLOT_HEIGHT}px`,
                    left: 0,
                    right: 0,
                    height: '98px',
                  }}
                >
                  <VirtualPageRow
                    page={page}
                    index={globalIdx}
                    isSelected={isSelected}
                    unit={unit}
                    isDropBefore={
                      dropIndicator?.index === globalIdx && dropIndicator.position === 'before'
                    }
                    isDropAfter={
                      dropIndicator?.index === globalIdx && dropIndicator.position === 'after'
                    }
                    onSelect={(e) =>
                      selectPage(page.id, {
                        shift: e.shiftKey,
                        ctrlOrMeta: e.ctrlKey || e.metaKey,
                      })
                    }
                    onToggleEnabled={() => togglePageEnabled(page.id)}
                    onRotate={() => rotatePagesClockwise([page.id])}
                    onChangeCopies={(c) => setPageCopies(page.id, c)}
                    onDelete={() => removePages([page.id])}
                    onDragStartRow={(e) => {
                      const movingIds = isSelected ? selectedPageIds : [page.id];
                      e.dataTransfer.effectAllowed = 'copyMove';
                      e.dataTransfer.setData(DND_MIME_PAGE_ID, page.id);
                      e.dataTransfer.setData(DND_MIME_REORDER_IDS, JSON.stringify(movingIds));
                    }}
                    onDragOverRow={(e) => {
                      if (!e.dataTransfer.types.includes(DND_MIME_REORDER_IDS)) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos =
                        e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
                      setDropIndicator({ index: globalIdx, position: pos });
                    }}
                    onDropOnRow={(e) => {
                      const raw = e.dataTransfer.getData(DND_MIME_REORDER_IDS);
                      setDropIndicator(null);
                      if (!raw) return;
                      e.preventDefault();
                      try {
                        const movingIds = JSON.parse(raw) as string[];
                        const rect = e.currentTarget.getBoundingClientRect();
                        const insertIndex =
                          e.clientY - rect.top < rect.height / 2
                            ? globalIdx
                            : globalIdx + 1;
                        reorderPages(movingIds, insertIndex);
                      } catch {
                        // Ignore invalid drag data
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
