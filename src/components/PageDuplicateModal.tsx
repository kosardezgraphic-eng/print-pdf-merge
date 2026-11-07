import React, { useState } from 'react';
import {
  X,
  Copy,
  PlusCircle,
  Check,
  RefreshCw,
} from 'lucide-react';

interface PageDuplicateModalProps {
  mode: 'duplicate' | 'blank';
  activePage: number;
  totalPages: number;
  theme: 'dark' | 'light';
  isProcessing: boolean;
  onClose: () => void;
  onConfirmDuplicate: (copies: number, insertAt: 'after' | 'end') => void;
  onConfirmBlank: (copies: number, insertAfter: number) => void;
}

export const PageDuplicateModal: React.FC<PageDuplicateModalProps> = ({
  mode,
  activePage,
  totalPages,
  theme,
  isProcessing,
  onClose,
  onConfirmDuplicate,
  onConfirmBlank,
}) => {
  const isDark = theme === 'dark';
  const [count, setCount] = useState<number>(1);
  const [insertPosition, setInsertPosition] = useState<'after' | 'end'>('after');
  const [blankInsertAfter, setBlankInsertAfter] = useState<number>(activePage);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'duplicate') {
      onConfirmDuplicate(count, insertPosition);
    } else {
      onConfirmBlank(count, blankInsertAfter);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${
          isDark ? 'bg-neutral-900 border-neutral-750 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === 'duplicate' ? (
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-500 flex items-center justify-center">
                <Copy className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-500 flex items-center justify-center">
                <PlusCircle className="w-4 h-4" />
              </div>
            )}
            <h3 className="font-bold text-sm">
              {mode === 'duplicate' ? `تکثیر صفحه ${activePage}` : 'ایجاد صفحه خالی جدید'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Count Selector */}
          <div className="space-y-1.5">
            <label className="text-neutral-400 font-medium block text-xs">
              {mode === 'duplicate' ? 'تعداد نسخه جهت تکثیر (کپی):' : 'تعداد صفحات خالی جهت ایجاد:'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100"
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                className={`w-24 p-2 rounded-xl border text-center font-bold text-base font-mono focus:outline-none focus:border-blue-500 ${
                  isDark
                    ? 'bg-neutral-950 border-neutral-750 text-white'
                    : 'bg-slate-100 border-slate-300 text-slate-900'
                }`}
              />

              {/* Quick Count Presets */}
              <div className="flex items-center gap-1 flex-1">
                {[1, 2, 5, 10, 20].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCount(num)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-mono font-bold transition-colors cursor-pointer ${
                      count === num
                        ? 'bg-blue-600 text-white border-blue-500'
                        : isDark
                        ? 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {num}×
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Placement Position */}
          {mode === 'duplicate' ? (
            <div className="space-y-1.5 pt-2 border-t border-neutral-800/40">
              <label className="text-neutral-400 font-medium block text-xs">محل درج نسخه‌های جدید:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInsertPosition('after')}
                  className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-colors cursor-pointer ${
                    insertPosition === 'after'
                      ? 'bg-blue-600 text-white font-bold border-blue-500'
                      : isDark
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-300'
                      : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  بلافاصله پس از صفحه {activePage}
                </button>

                <button
                  type="button"
                  onClick={() => setInsertPosition('end')}
                  className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-colors cursor-pointer ${
                    insertPosition === 'end'
                      ? 'bg-blue-600 text-white font-bold border-blue-500'
                      : isDark
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-300'
                      : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  در انتهای سند (صفحه {totalPages + 1})
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 pt-2 border-t border-neutral-800/40">
              <label className="text-neutral-400 font-medium block text-xs">محل درج صفحات خالی:</label>
              <select
                value={blankInsertAfter}
                onChange={(e) => setBlankInsertAfter(parseInt(e.target.value) || 0)}
                className={`w-full p-2 rounded-xl border text-xs cursor-pointer focus:outline-none ${
                  isDark
                    ? 'bg-neutral-950 border-neutral-750 text-white'
                    : 'bg-slate-100 border-slate-300 text-slate-900'
                }`}
              >
                <option value={0}>در ابتدای سند (قبل از صفحه ۱)</option>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    پس از صفحه {p} {p === activePage ? '(صفحه فعلی)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={onClose}
              className={`px-4 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? 'border-neutral-700 hover:bg-neutral-800 text-neutral-300'
                  : 'border-slate-300 hover:bg-slate-100 text-slate-700'
              }`}
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={isProcessing}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>در حال انجام...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {mode === 'duplicate' ? `تکثیر ${count} نسخه` : `ایجاد ${count} صفحه خالی`}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
