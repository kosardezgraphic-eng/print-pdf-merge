import React from 'react';
import {
  Type,
  Plus,
  Trash2,
  Bold,
  Italic,
  Underline,
  AlignRight,
  AlignCenter,
  AlignLeft,
  RotateCw,
  Sparkles,
  Link2,
} from 'lucide-react';
import { PageOverlayText } from '../types';

export const POPULAR_PERSIAN_FONTS = [
  { id: 'Vazirmatn, sans-serif', label: 'وزیرمتن (Vazirmatn)' },
  { id: 'Shabnam, sans-serif', label: 'شبنم (Shabnam)' },
  { id: 'Sahel, sans-serif', label: 'ساحل (Sahel)' },
  { id: 'B Titr, sans-serif', label: 'تیتر (B Titr)' },
  { id: 'B Mitra, sans-serif', label: 'میترا (B Mitra)' },
  { id: 'IranNastaliq, cursive', label: 'نستعلیق (Nastaliq)' },
  { id: 'Tahoma, sans-serif', label: 'تاهوماه (Tahoma)' },
  { id: 'Arial, sans-serif', label: 'Arial' },
  { id: 'Times New Roman, serif', label: 'Times New Roman' },
];

interface TextControlPanelProps {
  texts: PageOverlayText[];
  selectedTextId: string | null;
  theme: 'dark' | 'light';
  onSelectText: (id: string | null) => void;
  onAddText: () => void;
  onUpdateText: (id: string, updates: Partial<PageOverlayText>) => void;
  onDeleteText: (id: string) => void;
  onApplyTextToAllPages: (textId: string) => void;
  onApplyTextToSelectedPages: (textId: string) => void;
}

export const TextControlPanel: React.FC<TextControlPanelProps> = ({
  texts,
  selectedTextId,
  theme,
  onSelectText,
  onAddText,
  onUpdateText,
  onDeleteText,
  onApplyTextToAllPages,
  onApplyTextToSelectedPages,
}) => {
  const isDark = theme === 'dark';
  const selectedText = texts.find((t) => t.id === selectedTextId);

  return (
    <div className="space-y-4 text-xs">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <span className="font-bold flex items-center gap-1.5 text-xs">
          <Type className="w-4 h-4 text-blue-500" />
          <span>متن و نوشته روی صفحه ({texts.length})</span>
        </span>

        <button
          type="button"
          onClick={onAddText}
          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>افزودن نوشته</span>
        </button>
      </div>

      {/* Texts List */}
      {texts.length > 0 && (
        <div className="flex flex-wrap gap-1 p-1 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950">
          {texts.map((t, idx) => {
            const isSel = t.id === selectedTextId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectText(t.id)}
                className={`px-2 py-1 rounded-lg text-xs transition-all cursor-pointer truncate max-w-[120px] ${
                  isSel
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : isDark
                    ? 'bg-neutral-900 text-neutral-300 hover:text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {t.text || `متن #${idx + 1}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Text Properties */}
      {selectedText ? (
        <div
          className={`p-3 rounded-xl border space-y-3 ${
            isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          {/* Text Input */}
          <div className="space-y-1">
            <label className="text-neutral-400 block text-[11px]">محتوای متن:</label>
            <textarea
              rows={2}
              value={selectedText.text}
              onChange={(e) => onUpdateText(selectedText.id, { text: e.target.value })}
              className={`w-full p-2 rounded-lg border text-xs focus:outline-none focus:border-blue-500 ${
                isDark
                  ? 'bg-neutral-900 border-neutral-750 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
              placeholder="متن خود را اینجا وارد کنید..."
            />
          </div>

          {/* Font Family Selector */}
          <div className="space-y-1">
            <label className="text-neutral-400 block text-[11px]">نوع فونت:</label>
            <select
              value={selectedText.fontFamily}
              onChange={(e) => onUpdateText(selectedText.id, { fontFamily: e.target.value })}
              className={`w-full p-1.5 rounded-lg border text-xs cursor-pointer focus:outline-none ${
                isDark
                  ? 'bg-neutral-900 border-neutral-750 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              {POPULAR_PERSIAN_FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Font Size & Color Grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* Font Size */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-400">
                <span>اندازه فونت:</span>
                <span className="font-mono">{selectedText.fontSize || 18}pt</span>
              </div>
              <input
                type="range"
                min="8"
                max="80"
                step="1"
                value={selectedText.fontSize || 18}
                onChange={(e) =>
                  onUpdateText(selectedText.id, { fontSize: parseInt(e.target.value) || 18 })
                }
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Font Color */}
            <div className="space-y-1">
              <label className="text-neutral-400 block text-[11px]">رنگ متن:</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={selectedText.color || '#000000'}
                  onChange={(e) => onUpdateText(selectedText.id, { color: e.target.value })}
                  className="w-8 h-8 rounded border border-neutral-700 cursor-pointer p-0.5 bg-transparent"
                />
                <span className="font-mono text-xs">{selectedText.color || '#000000'}</span>
              </div>
            </div>
          </div>

          {/* Text Style Toolbar (Bold, Italic, Underline, Alignments) */}
          <div className="flex items-center justify-between gap-1 p-1 bg-slate-100 dark:bg-neutral-900 rounded-lg border border-slate-200 dark:border-neutral-800">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => onUpdateText(selectedText.id, { bold: !selectedText.bold })}
                className={`p-1.5 rounded cursor-pointer ${
                  selectedText.bold ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
                title="بولد"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateText(selectedText.id, { italic: !selectedText.italic })}
                className={`p-1.5 rounded cursor-pointer ${
                  selectedText.italic ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
                title="ایتالیک"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateText(selectedText.id, { underline: !selectedText.underline })}
                className={`p-1.5 rounded cursor-pointer ${
                  selectedText.underline ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
                title="زیرخط"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-0.5 border-s border-neutral-700/40 ps-1">
              <button
                type="button"
                onClick={() => onUpdateText(selectedText.id, { align: 'right' })}
                className={`p-1.5 rounded cursor-pointer ${
                  selectedText.align === 'right'
                    ? 'bg-blue-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="راست‌چین"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateText(selectedText.id, { align: 'center' })}
                className={`p-1.5 rounded cursor-pointer ${
                  selectedText.align === 'center'
                    ? 'bg-blue-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="وسط‌چین"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateText(selectedText.id, { align: 'left' })}
                className={`p-1.5 rounded cursor-pointer ${
                  selectedText.align === 'left'
                    ? 'bg-blue-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="چپ‌چین"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Opacity & Rotation */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-400">
                <span>شفافیت:</span>
                <span className="font-mono">{Math.round((selectedText.opacity ?? 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={selectedText.opacity ?? 1}
                onChange={(e) =>
                  onUpdateText(selectedText.id, { opacity: parseFloat(e.target.value) || 1 })
                }
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-400">
                <span>چرخش:</span>
                <span className="font-mono">{selectedText.rotation || 0}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                value={selectedText.rotation || 0}
                onChange={(e) =>
                  onUpdateText(selectedText.id, { rotation: parseInt(e.target.value) || 0 })
                }
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Scope Selector: Where this text applies */}
          <div className="pt-2 border-t border-neutral-800/40 space-y-1">
            <label className="text-neutral-400 block text-[11px] font-semibold">
              اعمال متن در چه صفحه‌هایی:
            </label>
            <select
              value={selectedText.targetScope || 'current'}
              onChange={(e) =>
                onUpdateText(selectedText.id, {
                  targetScope: e.target.value as any,
                })
              }
              className={`w-full p-1.5 rounded-lg border text-xs cursor-pointer font-medium ${
                isDark
                  ? 'bg-neutral-900 border-neutral-750 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option value="all">در تمام صفحات (All Pages)</option>
              <option value="even">در صفحات زوج (Even Pages)</option>
              <option value="odd">در صفحات فرد (Odd Pages)</option>
              <option value="first">در اولین برگه (First Page)</option>
              <option value="last">در آخرین برگه (Last Page)</option>
              <option value="selected">در صفحه‌های انتخابی (Selected Pages)</option>
              <option value="current">فقط در همین برگه (Current Page Only)</option>
            </select>
          </div>

          {/* Sync / Replicate Actions */}
          <div className="pt-2 border-t border-neutral-800/40 space-y-2">
            <span className="text-neutral-400 font-bold block text-[11px]">
              تکثیر و همگام‌سازی زنده متن:
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onApplyTextToAllPages(selectedText.id)}
                className="py-1.5 px-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                title="قرار دادن این متن روی تمام صفحات به صورت همگام (تغییر در یکی در همه اعمال می‌شود)"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>اعمال روی تمام صفحات</span>
              </button>

              <button
                type="button"
                onClick={() => onApplyTextToSelectedPages(selectedText.id)}
                className="py-1.5 px-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                title="قرار دادن این متن روی صفحات تیک‌خورده انتخابی"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>اعمال روی انتخاب‌ها</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onDeleteText(selectedText.id)}
              className="w-full py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-red-500/30 text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف این متن</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 text-center text-neutral-400 text-xs border border-dashed rounded-xl border-neutral-800">
          برای ویرایش، روی یکی از متن‌های بالا کلیک کنید یا با دکمه «افزودن نوشته» متن جدید بسازید.
        </div>
      )}
    </div>
  );
};
