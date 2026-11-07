import React, { useState, useEffect } from 'react';
import { X, RotateCw, FileText, Layers, HardDrive, Check, ExternalLink } from 'lucide-react';
import { translations } from '../utils/translations';
import { Language, PDFItem } from '../types';
import { formatBytes } from '../utils/pdfUtils';

interface PreviewModalProps {
  item: PDFItem | null;
  lang: Language;
  theme: 'dark' | 'light';
  onClose: () => void;
  onUpdateItem: (id: string, updates: Partial<PDFItem>) => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  item,
  lang,
  theme,
  onClose,
  onUpdateItem,
}) => {
  const t = translations[lang];
  const isDark = theme === 'dark';
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [pageRange, setPageRange] = useState<string>('all');

  useEffect(() => {
    if (item) {
      const url = URL.createObjectURL(item.file);
      setBlobUrl(url);
      setRotation(item.rotation || 0);
      setPageRange(item.pageRange || 'all');

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [item]);

  if (!item) return null;

  const handleRotate = () => {
    const nextRotation = (rotation + 90) % 360;
    setRotation(nextRotation);
  };

  const handleApplyChanges = () => {
    onUpdateItem(item.id, {
      rotation,
      pageRange: pageRange.trim() === '' ? 'all' : pageRange.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-5xl h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-colors ${
          isDark
            ? 'bg-neutral-900 border-neutral-750 text-neutral-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between transition-colors ${
            isDark ? 'bg-neutral-950/70 border-neutral-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h3 className="text-sm sm:text-base font-bold truncate" title={item.name}>
                {item.name}
              </h3>
              <div
                className={`flex items-center gap-3 text-xs mt-0.5 ${
                  isDark ? 'text-neutral-400' : 'text-slate-500'
                }`}
              >
                <span className="flex items-center gap-1 font-mono">
                  <Layers className="w-3 h-3 text-blue-500" />
                  {item.pageCount} {t.pagesUnit}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1 font-mono">
                  <HardDrive className="w-3 h-3 text-neutral-400" />
                  {formatBytes(item.size)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {blobUrl && (
              <a
                href={blobUrl}
                target="_blank"
                rel="noreferrer"
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  isDark
                    ? 'text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-750 border-neutral-700'
                    : 'text-slate-700 hover:text-black bg-white hover:bg-slate-100 border-slate-200 shadow-xs'
                }`}
                title="باز کردن در پنجره جدید مرورگر"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="text-xs">پنجره جدید</span>
              </a>
            )}
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-slate-500 hover:text-black hover:bg-slate-200'
              }`}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="flex-1 bg-neutral-950 relative flex items-center justify-center overflow-hidden">
          {blobUrl ? (
            <iframe
              src={`${blobUrl}#toolbar=1&navpanes=1`}
              title={item.name}
              className="w-full h-full border-0 bg-neutral-950"
            />
          ) : (
            <div className="text-neutral-400 text-sm">در حال بارگذاری سند...</div>
          )}
        </div>

        {/* Footer Controls: Rotation & Page Range Selection */}
        <div
          className={`px-5 py-3.5 border-t flex flex-wrap items-center justify-between gap-3 transition-colors ${
            isDark ? 'bg-neutral-950/80 border-neutral-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          {/* Page Range selector */}
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
            <label className={`text-xs whitespace-nowrap ${isDark ? 'text-neutral-400' : 'text-slate-600'}`}>
              {t.pageRangeLabel}
            </label>
            <input
              type="text"
              value={pageRange}
              onChange={(e) => setPageRange(e.target.value)}
              placeholder={t.pageRangePlaceholder}
              className={`flex-1 border rounded-lg px-3 py-1.5 text-xs focus:outline-none font-mono ${
                isDark
                  ? 'bg-neutral-900 border-neutral-750 focus:border-blue-500 text-white placeholder:text-neutral-500'
                  : 'bg-white border-slate-300 focus:border-blue-500 text-slate-900 placeholder:text-slate-400'
              }`}
            />
          </div>

          {/* Rotation Control & Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRotate}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isDark
                  ? 'bg-neutral-850 hover:bg-neutral-800 text-neutral-200 border-neutral-700'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.rotate}</span>
              {rotation > 0 && <span className="font-mono text-amber-500">({rotation}°)</span>}
            </button>

            <button
              onClick={handleApplyChanges}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t.saveChanges}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
