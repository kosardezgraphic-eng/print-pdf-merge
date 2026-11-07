import React from 'react';
import {
  FileText,
  Eye,
  Trash2,
  RotateCw,
  ChevronUp,
  ChevronDown,
  Check,
  AlertCircle,
  Clock,
  Layers,
  Sliders,
  Crop,
  Printer,
} from 'lucide-react';
import { translations } from '../utils/translations';
import { Language, PDFItem, ViewMode } from '../types';
import { formatBytes } from '../utils/pdfUtils';
import { PageThumbnail } from './PageThumbnail';

interface FileListProps {
  items: PDFItem[];
  lang: Language;
  theme: 'dark' | 'light';
  viewMode: ViewMode;
  onToggleSelect: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (id: string) => void;
  onRotate: (id: string) => void;
  onPreview: (item: PDFItem) => void;
  onOpenPageStudio: (item: PDFItem) => void;
}

export const FileList: React.FC<FileListProps> = ({
  items,
  lang,
  theme,
  viewMode,
  onToggleSelect,
  onMoveUp,
  onMoveDown,
  onRemove,
  onRotate,
  onPreview,
  onOpenPageStudio,
}) => {
  const t = translations[lang];
  const isDark = theme === 'dark';

  if (items.length === 0) {
    return null;
  }

  if (viewMode === 'cards') {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {items.map((item, index) => {
            const isFirst = index === 0;
            const isLast = index === items.length - 1;

            // Check if any adjustments are applied
            const hasAdjustments =
              item.pageAdjustments &&
              Object.values(item.pageAdjustments).some(
                (a) =>
                  a.brightness !== 100 ||
                  a.contrast !== 100 ||
                  a.threshold ||
                  a.crop.top > 0 ||
                  a.crop.bottom > 0
              );

            return (
              <div
                key={item.id}
                className={`relative rounded-2xl border p-4 transition-all flex flex-col justify-between group ${
                  item.selected
                    ? isDark
                      ? 'border-blue-600/60 shadow-md shadow-blue-950/20 bg-neutral-900/90'
                      : 'border-blue-300 shadow-sm bg-white ring-1 ring-blue-100'
                    : isDark
                    ? 'border-neutral-800 bg-neutral-900 opacity-80 hover:opacity-100 hover:border-neutral-700'
                    : 'border-slate-200 bg-white opacity-80 hover:opacity-100 hover:border-slate-300 shadow-xs'
                }`}
              >
                {/* Header row: Checkbox, Order number, and Adjustment badges */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleSelect(item.id)}
                      className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer ${
                        item.selected
                          ? 'bg-blue-600 text-white'
                          : isDark
                          ? 'border border-neutral-600 hover:border-neutral-400 bg-neutral-950'
                          : 'border border-slate-300 hover:border-slate-400 bg-white'
                      }`}
                      aria-label="Select file"
                    >
                      {item.selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                    <span className="text-xs font-mono font-medium text-neutral-400">
                      #{index + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {hasAdjustments && (
                      <span className="text-[10px] font-medium text-purple-600 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 px-1.5 py-0.5 rounded">
                        تنظیمات نور/کراپ
                      </span>
                    )}
                    {item.rotation ? (
                      <span className="text-[10px] font-mono text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 px-1.5 py-0.5 rounded">
                        +{item.rotation}°
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* File Thumbnail & Info */}
                <div
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => onPreview(item)}
                  title={t.preview}
                >
                  <PageThumbnail item={item} size="md" className="hover:scale-105 transition-transform" />
                  <div className="flex-1 min-w-0">
                    <h4
                      className="text-xs sm:text-sm font-semibold truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                      title={item.name}
                    >
                      {item.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400">
                      <span>{formatBytes(item.size)}</span>
                    </div>
                  </div>
                </div>

                {/* Page Studio Quick Button on Card */}
                <div className="mt-3">
                  <button
                    onClick={() => onOpenPageStudio(item)}
                    className={`w-full py-1.5 px-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-neutral-800/80 hover:bg-neutral-750 text-neutral-300 border-neutral-700/60'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5 text-blue-500" />
                    <span>{t.pageStudioBtn}</span>
                  </button>
                </div>

                {/* Page Count Highlight & Actions */}
                <div
                  className={`mt-3 pt-3 border-t flex items-center justify-between ${
                    isDark ? 'border-neutral-800' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    {item.status === 'loading' ? (
                      <span className="flex items-center gap-1 text-xs text-amber-500">
                        <Clock className="w-3 h-3 animate-spin" />
                        در حال شمارش...
                      </span>
                    ) : item.status === 'error' ? (
                      <span className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        خطا
                      </span>
                    ) : (
                      <span className="text-sm font-bold font-mono tabular-nums">
                        {item.pageCount}{' '}
                        <span className="text-xs font-normal text-neutral-400">
                          {t.pagesUnit}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => onMoveUp(index)}
                      disabled={isFirst}
                      className="p-1 text-neutral-400 hover:text-black dark:hover:text-white disabled:opacity-20 hover:bg-neutral-800/20 rounded transition-colors"
                      title={t.moveUp}
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onMoveDown(index)}
                      disabled={isLast}
                      className="p-1 text-neutral-400 hover:text-black dark:hover:text-white disabled:opacity-20 hover:bg-neutral-800/20 rounded transition-colors"
                      title={t.moveDown}
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onRotate(item.id)}
                      className="p-1 text-neutral-400 hover:text-amber-500 hover:bg-neutral-800/20 rounded transition-colors"
                      title={t.rotate}
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onPreview(item)}
                      className="p-1 text-neutral-400 hover:text-blue-500 hover:bg-neutral-800/20 rounded transition-colors"
                      title={t.preview}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="p-1 text-neutral-400 hover:text-red-500 hover:bg-neutral-800/20 rounded transition-colors"
                      title={t.delete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Table View
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-3">
      <div
        className={`rounded-2xl border overflow-hidden transition-colors ${
          isDark
            ? 'bg-neutral-900 border-neutral-800 text-neutral-100'
            : 'bg-white border-slate-200 text-slate-800 shadow-xs'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs sm:text-sm">
            <thead
              className={`border-b font-medium text-[11px] sm:text-xs transition-colors ${
                isDark
                  ? 'bg-neutral-950/70 border-neutral-800 text-neutral-400'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-2 w-10 text-center">انتخاب</th>
                <th className="py-2.5 px-4 text-start">{t.fileName}</th>
                <th className="py-2.5 px-4 text-center w-36">{t.pagesCount}</th>
                <th className="py-2.5 px-4 text-center w-28">{t.fileSize}</th>
                <th className="py-2.5 px-4 text-center w-40">مدیریت صفحات و نور</th>
                <th className="py-2.5 px-4 text-center w-36">{t.actions}</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y transition-colors ${
                isDark ? 'divide-neutral-800/60' : 'divide-slate-200'
              }`}
            >
              {items.map((item, index) => {
                const isFirst = index === 0;
                const isLast = index === items.length - 1;

                const hasAdjustments =
                  item.pageAdjustments &&
                  Object.values(item.pageAdjustments).some(
                    (a) =>
                      a.brightness !== 100 ||
                      a.contrast !== 100 ||
                      a.threshold ||
                      a.crop.top > 0 ||
                      a.crop.bottom > 0
                  );

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      item.selected
                        ? isDark
                          ? 'bg-neutral-900 hover:bg-neutral-850'
                          : 'bg-white hover:bg-slate-50'
                        : isDark
                        ? 'bg-neutral-950/40 opacity-70 hover:opacity-100'
                        : 'bg-slate-50/50 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {/* Index */}
                    <td className="py-3 px-3 text-center font-mono text-xs text-neutral-400">
                      {index + 1}
                    </td>

                    {/* Checkbox */}
                    <td className="py-3 px-2 text-center">
                      <button
                        onClick={() => onToggleSelect(item.id)}
                        className={`w-5 h-5 mx-auto rounded flex items-center justify-center transition-colors cursor-pointer ${
                          item.selected
                            ? 'bg-blue-600 text-white'
                            : isDark
                            ? 'border border-neutral-600 hover:border-neutral-400 bg-neutral-950'
                            : 'border border-slate-300 hover:border-slate-400 bg-white'
                        }`}
                        aria-label="Toggle file selection"
                      >
                        {item.selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                    </td>

                    {/* File Thumbnail & Name */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-3">
                        <PageThumbnail item={item} size="sm" className="hover:scale-125 transition-transform" />
                        <span
                          className="font-medium hover:text-blue-500 cursor-pointer truncate max-w-sm sm:max-w-md text-xs sm:text-sm"
                          onClick={() => onPreview(item)}
                          title={item.name}
                        >
                          {item.name}
                        </span>
                        {hasAdjustments && (
                          <span className="text-[10px] font-medium text-purple-600 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 px-1.5 py-0.5 rounded">
                            نور/کراپ
                          </span>
                        )}
                        {item.rotation ? (
                          <span className="text-[10px] font-mono text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 px-1.5 py-0.5 rounded">
                            +{item.rotation}°
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Page Count */}
                    <td className="py-3 px-4 text-center">
                      {item.status === 'loading' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                          <Clock className="w-3 h-3 animate-spin" />
                          شمارش...
                        </span>
                      ) : item.status === 'error' ? (
                        <span className="text-xs text-red-500">{t.errorCounting}</span>
                      ) : (
                        <span
                          className={`font-mono font-bold tabular-nums px-2.5 py-0.5 rounded-md text-xs sm:text-sm border ${
                            isDark
                              ? 'bg-blue-950/60 border-blue-800/40 text-blue-300'
                              : 'bg-blue-50 border-blue-200 text-blue-800'
                          }`}
                        >
                          {item.pageCount} {t.pagesUnit}
                        </span>
                      )}
                    </td>

                    {/* Size */}
                    <td className="py-3 px-4 text-center font-mono text-xs text-neutral-400 tabular-nums">
                      {formatBytes(item.size)}
                    </td>

                    {/* Page Studio Action */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onOpenPageStudio(item)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border-neutral-700'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        <Sliders className="w-3 h-3 text-blue-500" />
                        <span>{t.pageStudioBtn}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onMoveUp(index)}
                          disabled={isFirst}
                          className="p-1 text-neutral-400 hover:text-black dark:hover:text-white disabled:opacity-20 hover:bg-neutral-800/20 rounded transition-colors"
                          title={t.moveUp}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onMoveDown(index)}
                          disabled={isLast}
                          className="p-1 text-neutral-400 hover:text-black dark:hover:text-white disabled:opacity-20 hover:bg-neutral-800/20 rounded transition-colors"
                          title={t.moveDown}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRotate(item.id)}
                          className="p-1 text-neutral-400 hover:text-amber-500 hover:bg-neutral-800/20 rounded transition-colors"
                          title={t.rotate}
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onPreview(item)}
                          className="p-1 text-neutral-400 hover:text-blue-500 hover:bg-neutral-800/20 rounded transition-colors"
                          title={t.preview}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRemove(item.id)}
                          className="p-1 text-neutral-400 hover:text-red-500 hover:bg-neutral-800/20 rounded transition-colors"
                          title={t.delete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
