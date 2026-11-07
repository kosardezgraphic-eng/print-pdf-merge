import React from 'react';
import {
  Hash,
  Sparkles,
  Link2,
  Code,
  Layout,
  Plus,
  Copy,
  Trash2,
} from 'lucide-react';
import { PageOverlayNumbering, NumberingNumberFormat } from '../types';
import { formatPageNumber } from '../utils/overlayRenderUtils';
import { POPULAR_PERSIAN_FONTS } from './TextControlPanel';

interface PageNumberingPanelProps {
  numbering?: PageOverlayNumbering;
  numberings?: PageOverlayNumbering[];
  selectedNumberingId?: string | null;
  currentPage: number;
  totalPages: number;
  theme: 'dark' | 'light';
  onSelectNumbering?: (id: string) => void;
  onAddNumbering?: () => void;
  onDuplicateNumbering?: (id: string) => void;
  onDeleteNumbering?: (id: string) => void;
  onUpdateNumbering: (updates: Partial<PageOverlayNumbering>) => void;
  onUpdateNumberingItem?: (id: string, updates: Partial<PageOverlayNumbering>) => void;
  onApplyNumberingToAll: () => void;
  onApplyNumberingToOdd: () => void;
  onApplyNumberingToEven: () => void;
}

export const PageNumberingPanel: React.FC<PageNumberingPanelProps> = ({
  numbering,
  numberings,
  selectedNumberingId,
  currentPage,
  totalPages,
  theme,
  onSelectNumbering,
  onAddNumbering,
  onDuplicateNumbering,
  onDeleteNumbering,
  onUpdateNumbering,
  onUpdateNumberingItem,
  onApplyNumberingToAll,
  onApplyNumberingToOdd,
  onApplyNumberingToEven,
}) => {
  const isDark = theme === 'dark';

  const numberingsList: PageOverlayNumbering[] = numberings && numberings.length > 0
    ? numberings
    : (numbering ? [numbering] : []);

  const activeNumberingObj = numberingsList.find((n) => n.id === selectedNumberingId) || numberingsList[0] || {
    id: 'page-numbering',
    enabled: true,
    xPercent: 50,
    yPercent: 95,
    fontSize: 14,
    fontFamily: 'Vazirmatn, sans-serif',
    color: '#1e293b',
    backgroundColor: 'transparent',
    bold: true,
    italic: false,
    opacity: 1,
    format: 'persian' as NumberingNumberFormat,
    template: 'صفحه {page} از {total}',
    startOffset: 0,
    customScript: '',
  };

  const handleUpdateActive = (updates: Partial<PageOverlayNumbering>) => {
    if (onUpdateNumberingItem && activeNumberingObj.id) {
      onUpdateNumberingItem(activeNumberingObj.id, updates);
    } else {
      onUpdateNumbering(updates);
    }
  };

  const livePreview = formatPageNumber(currentPage, totalPages, activeNumberingObj);

  return (
    <div className="space-y-4 text-xs">
      {/* Header with Enable/Disable Toggle & Add New */}
      <div className="p-2.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold flex items-center gap-1.5 text-xs">
            <Hash className="w-4 h-4 text-emerald-500" />
            <span>شماره‌گذاری هوشمند و پویا صفحات</span>
          </span>

          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={activeNumberingObj.enabled}
              onChange={(e) => handleUpdateActive({ enabled: e.target.checked })}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
            />
            <span className={activeNumberingObj.enabled ? 'text-emerald-500' : 'text-neutral-400'}>
              {activeNumberingObj.enabled ? 'فعال' : 'غیرفعال'}
            </span>
          </label>
        </div>

        {/* Add & Duplicate Buttons Bar */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200 dark:border-neutral-800/80">
          {onAddNumbering && (
            <button
              type="button"
              onClick={onAddNumbering}
              className="flex-1 py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>افزودن شماره صفحه جدید</span>
            </button>
          )}

          {onDuplicateNumbering && activeNumberingObj && (
            <button
              type="button"
              onClick={() => onDuplicateNumbering(activeNumberingObj.id)}
              className="py-1 px-2.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
              title="تکثیر این شماره صفحه با تمام تنظیمات"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>تکثیر</span>
            </button>
          )}
        </div>
      </div>

      {/* Multiple Page Numbering Selector Tabs if > 1 */}
      {numberingsList.length > 1 && (
        <div className="space-y-1">
          <span className="text-[11px] text-neutral-400 font-semibold block">
            لیست شماره صفحات موجود روی برگه ({numberingsList.length}):
          </span>
          <div className="flex flex-wrap gap-1">
            {numberingsList.map((num, idx) => {
              const isSelected = num.id === activeNumberingObj.id;
              const previewStr = formatPageNumber(currentPage, totalPages, num);
              return (
                <div
                  key={num.id}
                  onClick={() => onSelectNumbering?.(num.id)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-500 font-bold shadow-sm'
                      : isDark
                      ? 'bg-neutral-900 border-neutral-750 text-neutral-300 hover:bg-neutral-800'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Hash className="w-3 h-3 opacity-70" />
                  <span>شماره {idx + 1}: {previewStr}</span>
                  {numberingsList.length > 1 && onDeleteNumbering && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNumbering(num.id);
                      }}
                      className="p-0.5 hover:bg-rose-500/30 rounded text-rose-300 transition-colors"
                      title="حذف این شماره صفحه"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeNumberingObj.enabled ? (
        <div
          className={`p-3 rounded-xl border space-y-3.5 ${
            isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          {/* Live Preview Box */}
          <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between">
            <span className="text-[11px] text-emerald-400 font-bold">پیش‌نمایش شماره انتخاب‌شده:</span>
            <span className="font-bold font-mono text-sm text-emerald-300">{livePreview}</span>
          </div>

          {/* Quick Preset Positions */}
          <div className="space-y-1">
            <label className="text-neutral-400 block text-[11px] flex items-center gap-1">
              <Layout className="w-3.5 h-3.5 text-blue-500" />
              <span>موقعیت قرارگیری روی برگه:</span>
            </label>
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: 'بالا - راست', x: 85, y: 5 },
                { label: 'بالا - وسط', x: 50, y: 5 },
                { label: 'بالا - چپ', x: 15, y: 5 },
                { label: 'پایین - راست', x: 85, y: 95 },
                { label: 'پایین - وسط', x: 50, y: 95 },
                { label: 'پایین - چپ', x: 15, y: 95 },
              ].map((pos) => (
                <button
                  key={pos.label}
                  type="button"
                  onClick={() => handleUpdateActive({ xPercent: pos.x, yPercent: pos.y })}
                  className={`py-1 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                    Math.abs(activeNumberingObj.xPercent - pos.x) < 5 && Math.abs(activeNumberingObj.yPercent - pos.y) < 5
                      ? 'bg-emerald-600 text-white font-bold border-emerald-500'
                      : isDark
                      ? 'bg-neutral-900 border-neutral-750 text-neutral-300 hover:text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-neutral-400 block pt-0.5">
              (همچنین می‌توانید نشان شماره صفحه را مستقیماً روی برگه با ماوس بگیرید و جابجا یا با Ctrl تکثیر کنید)
            </span>
          </div>

          {/* Number Format (Persian, English, Roman, Abjad) */}
          <div className="space-y-1">
            <label className="text-neutral-400 block text-[11px]">فرمت ارقام و کاراکترها:</label>
            <div className="grid grid-cols-2 gap-1">
              {[
                { id: 'persian' as NumberingNumberFormat, label: 'فارسی (۱، ۲، ۳...)' },
                { id: 'english' as NumberingNumberFormat, label: 'انگلیسی (1, 2, 3...)' },
                { id: 'roman' as NumberingNumberFormat, label: 'یونانی / رومی (I, II, III...)' },
                { id: 'abjad' as NumberingNumberFormat, label: 'حروف ابجد (الف، ب، ج...)' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleUpdateActive({ format: f.id })}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer text-center ${
                    activeNumberingObj.format === f.id
                      ? 'bg-emerald-600 text-white font-bold border-emerald-500'
                      : isDark
                      ? 'bg-neutral-900 border-neutral-750 text-neutral-300'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Print-House Receipt & Invoice Serial Numbering Section */}
          <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-rose-500 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>شماره‌زن چاپخانه (قبض، فاکتور، رسید و بلیط)</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  handleUpdateActive({
                    color: '#dc2626',
                    fontFamily: 'Courier New, monospace',
                    padZeros: 6,
                    template: 'No. {pad6}',
                    bold: true,
                    format: 'english',
                  })
                }
                className="text-[10px] px-2 py-0.5 rounded-full bg-rose-600 text-white font-bold hover:bg-rose-500 transition-colors shadow-xs cursor-pointer"
              >
                شماره‌زن کلاسیک قرمز
              </button>
            </div>

            {/* Quick Invoice/Receipt Presets */}
            <div className="grid grid-cols-2 gap-1 pt-1">
              {[
                { label: 'No. 000125 (۶ رقمی)', tpl: 'No. {pad6}', pad: 6, color: '#dc2626', format: 'english' as NumberingNumberFormat },
                { label: 'شماره: ۰۰۰۱۲۵ (فارسی)', tpl: 'شماره: {pad6}', pad: 6, color: '#dc2626', format: 'persian' as NumberingNumberFormat },
                { label: 'سریال: ۰۰۱۲۴ (۵ رقمی)', tpl: 'سریال: {pad5}', pad: 5, color: '#b91c1c', format: 'persian' as NumberingNumberFormat },
                { label: 'رسید مشتری: ۰۰۰۱', tpl: 'رسید مشتری: {pad4}', pad: 4, color: '#1e293b', format: 'persian' as NumberingNumberFormat },
                { label: 'ته‌قبض: ۰۰۰۱', tpl: 'ته‌قبض: {pad4}', pad: 4, color: '#1e293b', format: 'persian' as NumberingNumberFormat },
                { label: 'فاکتور #{pad4}', tpl: 'فاکتور #{pad4}', pad: 4, color: '#2563eb', format: 'persian' as NumberingNumberFormat },
              ].map((rec) => (
                <button
                  key={rec.label}
                  type="button"
                  onClick={() =>
                    handleUpdateActive({
                      template: rec.tpl,
                      padZeros: rec.pad,
                      color: rec.color,
                      format: rec.format,
                      bold: true,
                    })
                  }
                  className="py-1 px-1.5 rounded-lg border text-[10px] font-medium transition-colors cursor-pointer text-start hover:border-rose-500 bg-white/80 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 flex items-center justify-between"
                >
                  <span>{rec.label}</span>
                </button>
              ))}
            </div>

            {/* Zero Padding Selector */}
            <div className="flex items-center justify-between pt-1 text-[11px]">
              <span className="text-neutral-400">تعداد ارقام صفر پرکننده:</span>
              <div className="flex items-center gap-1">
                {[0, 3, 4, 5, 6, 7].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleUpdateActive({ padZeros: num })}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                      (activeNumberingObj.padZeros || 0) === num
                        ? 'bg-rose-600 text-white border-rose-500'
                        : isDark
                        ? 'bg-neutral-900 border-neutral-750 text-neutral-300'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    {num === 0 ? 'ساده' : `${num}رقم`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Template Script Formatter */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px] text-neutral-400">
              <span className="flex items-center gap-1">
                <Code className="w-3.5 h-3.5 text-blue-400" />
                <span>الگو و اسکریپت عبارت:</span>
              </span>
              <span className="font-mono text-[10px] text-blue-400">{'تگ‌ها: {page}, {pad6}, {total}'}</span>
            </div>
            <input
              type="text"
              value={activeNumberingObj.template}
              onChange={(e) => handleUpdateActive({ template: e.target.value })}
              className={`w-full p-2 rounded-lg border text-xs font-mono focus:outline-none focus:border-emerald-500 ${
                isDark
                  ? 'bg-neutral-900 border-neutral-750 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
              placeholder="مثال: No. {pad6} یا صفحه {page}"
            />

            {/* Quick Template Presets */}
            <div className="flex flex-wrap gap-1 pt-1">
              {[
                '{page}',
                'No. {pad6}',
                'شماره: {pad6}',
                'صفحه {page}',
                'صفحه {page} از {total}',
                'Page {page}',
                '- {page} -',
              ].map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => handleUpdateActive({ template: tpl })}
                  className="px-2 py-0.5 rounded text-[10px] font-mono border border-slate-300 dark:border-neutral-750 hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {tpl}
                </button>
              ))}
            </div>
          </div>

          {/* Start Offset / Shift Number */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-neutral-400 block text-[11px]">عدد شروع (Offset):</label>
              <input
                type="number"
                value={activeNumberingObj.startOffset || 0}
                onChange={(e) =>
                  handleUpdateActive({ startOffset: parseInt(e.target.value) || 0 })
                }
                className={`w-full p-1.5 rounded-lg border text-xs font-mono focus:outline-none ${
                  isDark
                    ? 'bg-neutral-900 border-neutral-750 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
                placeholder="0"
              />
            </div>

            {/* Custom Mathematical Formula / Script */}
            <div className="space-y-1">
              <label className="text-neutral-400 block text-[11px]" title="فرمول محاسباتی اختیاری برای شماره صفحه">
                فرمول اسکریپت (اختیاری):
              </label>
              <input
                type="text"
                value={activeNumberingObj.customScript || ''}
                onChange={(e) => handleUpdateActive({ customScript: e.target.value })}
                className={`w-full p-1.5 rounded-lg border text-xs font-mono focus:outline-none ${
                  isDark
                    ? 'bg-neutral-900 border-neutral-750 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
                placeholder="مثال: page * 2"
              />
            </div>
          </div>

          {/* Font & Styling Options */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-neutral-400 block text-[11px]">فونت:</label>
              <select
                value={activeNumberingObj.fontFamily}
                onChange={(e) => handleUpdateActive({ fontFamily: e.target.value })}
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

            <div className="space-y-1">
              <label className="text-neutral-400 block text-[11px]">رنگ متن:</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={activeNumberingObj.color || '#1e293b'}
                  onChange={(e) => handleUpdateActive({ color: e.target.value })}
                  className="w-8 h-8 rounded border border-neutral-700 cursor-pointer p-0.5 bg-transparent"
                />
                <span className="font-mono text-xs">{activeNumberingObj.color || '#1e293b'}</span>
              </div>
            </div>
          </div>

          {/* Multi-page Apply & Sync Actions */}
          <div className="pt-2 border-t border-neutral-800/40 space-y-2">
            <span className="text-neutral-400 font-bold block text-[11px]">
              اعمال شماره‌گذاری روی صفحات:
            </span>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={onApplyNumberingToAll}
                className="py-1.5 px-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[10px] font-semibold flex flex-col items-center gap-0.5 transition-colors cursor-pointer"
                title="اعمال شماره‌گذاری خودکار روی تمام صفحات سند"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>تمام صفحات</span>
              </button>

              <button
                type="button"
                onClick={onApplyNumberingToOdd}
                className="py-1.5 px-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-[10px] font-semibold flex flex-col items-center gap-0.5 transition-colors cursor-pointer"
                title="اعمال شماره‌گذاری فقط روی صفحات فرد (۱، ۳، ۵...)"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>صفحات فرد</span>
              </button>

              <button
                type="button"
                onClick={onApplyNumberingToEven}
                className="py-1.5 px-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-lg text-[10px] font-semibold flex flex-col items-center gap-0.5 transition-colors cursor-pointer"
                title="اعمال شماره‌گذاری فقط روی صفحات زوج (۲، ۴، ۶...)"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>صفحات زوج</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 text-center text-neutral-400 text-xs border border-dashed rounded-xl border-neutral-800">
          برای فعال‌سازی شماره‌گذاری صفحات، تیک گزینه «فعال» در بالا را بزنید.
        </div>
      )}
    </div>
  );
};
