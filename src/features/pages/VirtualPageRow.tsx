import React, { useEffect, useState } from 'react';
import {
  CheckSquare,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Minus,
  Plus,
  RotateCw,
  Square,
  Trash2,
} from 'lucide-react';
import type { PageItem } from '../../shared/types';
import { formatLength, LengthUnit, UNIT_LABELS } from '../../shared/units';
import { getCachedRenderUrl, renderPagePreviewUrl } from './previewRenderer';

interface VirtualPageRowProps {
  page: PageItem;
  index: number; // 0-based order in workspace
  isSelected: boolean;
  unit: LengthUnit;
  isDropBefore: boolean;
  isDropAfter: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onToggleEnabled: () => void;
  onRotate: () => void;
  onChangeCopies: (copies: number) => void;
  onDelete: () => void;
  onDragStartRow: (e: React.DragEvent) => void;
  onDragOverRow: (e: React.DragEvent) => void;
  onDropOnRow: (e: React.DragEvent) => void;
}

export const VirtualPageRow: React.FC<VirtualPageRowProps> = React.memo(
  ({
    page,
    index,
    isSelected,
    unit,
    isDropBefore,
    isDropAfter,
    onSelect,
    onToggleEnabled,
    onRotate,
    onChangeCopies,
    onDelete,
    onDragStartRow,
    onDragOverRow,
    onDropOnRow,
  }) => {
    const [thumbUrl, setThumbUrl] = useState<string | undefined>(() =>
      getCachedRenderUrl(page.sourceFileId, page.sourcePageIndex, 'thumb')
    );
    const [thumbError, setThumbError] = useState(false);

    useEffect(() => {
      let cancelled = false;
      const existing = getCachedRenderUrl(page.sourceFileId, page.sourcePageIndex, 'thumb');
      if (existing) {
        setThumbUrl(existing);
        return;
      }
      renderPagePreviewUrl(page.sourceFileId, page.sourcePageIndex, 'thumb')
        .then((url) => {
          if (!cancelled) setThumbUrl(url);
        })
        .catch(() => {
          if (!cancelled) setThumbError(true);
        });
      return () => {
        cancelled = true;
      };
    }, [page.sourceFileId, page.sourcePageIndex]);

    const effectiveW =
      page.rotation === 90 || page.rotation === 270 ? page.heightMm : page.widthMm;
    const effectiveH =
      page.rotation === 90 || page.rotation === 270 ? page.widthMm : page.heightMm;

    const dimText = `${formatLength(effectiveW, unit)}×${formatLength(effectiveH, unit)} ${
      UNIT_LABELS[unit].short
    }`;

    return (
      <div
        draggable
        onClick={onSelect}
        onDragStart={onDragStartRow}
        onDragOver={onDragOverRow}
        onDrop={onDropOnRow}
        className={`group relative h-[98px] px-2 py-1.5 rounded-lg border transition-colors flex items-center gap-2 cursor-pointer ${
          isSelected
            ? 'bg-blue-50/90 dark:bg-blue-950/45 border-blue-500 dark:border-blue-500/80 shadow-xs'
            : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        } ${!page.enabled ? 'opacity-55' : ''}`}
      >
        {isDropBefore && (
          <div className="pointer-events-none absolute -top-1 inset-x-1 h-0.5 bg-blue-500 rounded-full z-20" />
        )}
        {isDropAfter && (
          <div className="pointer-events-none absolute -bottom-1 inset-x-1 h-0.5 bg-blue-500 rounded-full z-20" />
        )}

        {/* Drag handle & Print Checkbox */}
        <div className="flex flex-col items-center justify-between h-full py-0.5 shrink-0">
          <span
            className="text-slate-400 dark:text-slate-500 cursor-grab active:cursor-grabbing"
            title="برای جابجایی ترتیب یا انداختن داخل خانه جدول بکشید"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleEnabled();
            }}
            title={page.enabled ? 'حذف موقت از چاپ' : 'فعال‌سازی در چاپ'}
            className="text-blue-600 dark:text-blue-400 hover:scale-110 transition cursor-pointer"
          >
            {page.enabled ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
          </button>

          <span className="text-[10px] font-num font-semibold text-slate-500 dark:text-slate-400">
            #{index + 1}
          </span>
        </div>

        {/* Thumbnail Preview Box */}
        <div className="w-15 h-19 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden shrink-0 relative">
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={page.sourceFileName}
              draggable={false}
              style={{ transform: `rotate(${page.rotation}deg)` }}
              className="max-w-full max-h-full object-contain transition-transform duration-150"
            />
          ) : thumbError ? (
            <FileText className="w-5 h-5 text-rose-400" />
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
          )}
          {page.rotation !== 0 && (
            <span
              dir="ltr"
              className="absolute bottom-0.5 left-0.5 px-1 rounded bg-slate-900/80 text-white text-[9px] font-num"
            >
              {page.rotation}°
            </span>
          )}
        </div>

        {/* Metadata & Inline Actions */}
        <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
          <div>
            <div className="flex items-center gap-1">
              {page.sourceKind === 'pdf' ? (
                <FileText className="w-3 h-3 text-rose-500 shrink-0" />
              ) : (
                <ImageIcon className="w-3 h-3 text-emerald-500 shrink-0" />
              )}
              <span
                className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate"
                title={page.sourceFileName}
              >
                {page.sourceFileName}
              </span>
            </div>

            <div className="flex items-center justify-between gap-1 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
              <span>
                {page.sourceTotalPages > 1
                  ? `صفحه ${page.sourcePageIndex + 1} از ${page.sourceTotalPages}`
                  : page.sourceKind === 'pdf'
                  ? 'تک‌صفحه PDF'
                  : `تصویر ${(page.imageFormat ?? '').toUpperCase()}`}
              </span>
              <span dir="ltr" className="font-num text-[10px] text-slate-500 dark:text-slate-400">
                {dimText}
              </span>
            </div>
          </div>

          {/* Bottom Controls: Copies Stepper + Rotate 90 + Delete */}
          <div
            className="flex items-center justify-between gap-1 pt-1"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Copies stepper */}
            <div
              className="inline-flex items-center rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 h-6"
              title="تعداد تکرار این صفحه در چیدمان"
            >
              <button
                type="button"
                onClick={() => onChangeCopies(Math.max(1, page.copies - 1))}
                className="px-1.5 h-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-s cursor-pointer"
              >
                <Minus className="w-2.5 h-2.5" />
              </button>
              <span className="px-1.5 text-[11px] font-num font-semibold text-slate-800 dark:text-slate-100">
                {page.copies}×
              </span>
              <button
                type="button"
                onClick={() => onChangeCopies(page.copies + 1)}
                className="px-1.5 h-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-e cursor-pointer"
              >
                <Plus className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onRotate}
                title="چرخش ۹۰ درجه ساعت‌گرد"
                className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                title="حذف صفحه"
                className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
