import React, { useState } from 'react';
import {
  X,
  Image as ImageIcon,
  FileText,
  Layers,
  ArrowUp,
  ArrowDown,
  Trash2,
  Check,
  RefreshCw,
  Plus,
  Maximize2,
  FileCheck,
} from 'lucide-react';
import { translations } from '../utils/translations';
import { Language } from '../types';
import { convertImagesToPdfFiles, ImageToPdfOptions } from '../utils/imageToPdfUtils';

interface ImageToPdfModalProps {
  initialFiles: File[];
  lang: Language;
  theme: 'dark' | 'light';
  onClose: () => void;
  onConverted: (pdfFiles: File[]) => void;
}

export const ImageToPdfModal: React.FC<ImageToPdfModalProps> = ({
  initialFiles,
  lang,
  theme,
  onClose,
  onConverted,
}) => {
  const t = translations[lang];
  const isDark = theme === 'dark';

  const [files, setFiles] = useState<File[]>(initialFiles);
  const [docName, setDocName] = useState<string>('مجموعه_تصاویر.pdf');
  const [mode, setMode] = useState<'merged' | 'separate'>('merged');
  const [pageSize, setPageSize] = useState<'A4' | 'fit'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'auto'>('auto');
  const [marginMm, setMarginMm] = useState<number>(5);
  const [isConverting, setIsConverting] = useState<boolean>(false);

  // Preview URLs for images
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    initialFiles.forEach((f) => {
      map[f.name + f.size] = URL.createObjectURL(f);
    });
    return map;
  });

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setFiles((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === files.length - 1) return;
    setFiles((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  const handleRemove = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddMore = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
      const newMap = { ...previewUrls };
      newFiles.forEach((f) => {
        newMap[f.name + f.size] = URL.createObjectURL(f);
      });
      setPreviewUrls(newMap);
    }
  };

  const handleConvert = async () => {
    if (files.length === 0) return;
    setIsConverting(true);

    try {
      const options: ImageToPdfOptions = {
        mode,
        pageSize,
        orientation,
        marginMm,
        documentName: docName,
      };

      const pdfFiles = await convertImagesToPdfFiles(files, options);
      onConverted(pdfFiles);
      onClose();
    } catch (err) {
      console.error('Failed to convert images to PDF:', err);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-3xl rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-colors ${
          isDark
            ? 'bg-neutral-900 border-neutral-750 text-neutral-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between transition-colors ${
            isDark ? 'bg-neutral-950/80 border-neutral-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                تبدیل تصاویر به فایل PDF (Images to PDF)
              </h3>
              <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                {files.length} تصویر انتخاب شده برای تبدیل، ویرایش و چیدمان
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-slate-200 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Mode Selector (Merged vs Separate) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold">نحوه تبدیل تصاویر:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMode('merged')}
                className={`p-3.5 rounded-xl border text-start transition-all cursor-pointer ${
                  mode === 'merged'
                    ? isDark
                      ? 'bg-emerald-950/50 border-emerald-500 text-white ring-1 ring-emerald-500'
                      : 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500'
                    : isDark
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Layers className="w-4 h-4 text-emerald-500" />
                  <span>ادغام همه در یک فایل PDF پیوسته</span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  تمام {files.length} تصویر به عنوان صفحات متوالی در قالب ۱ فایل PDF واحد ذخیره می‌شوند.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('separate')}
                className={`p-3.5 rounded-xl border text-start transition-all cursor-pointer ${
                  mode === 'separate'
                    ? isDark
                      ? 'bg-blue-950/50 border-blue-500 text-white ring-1 ring-blue-500'
                      : 'bg-blue-50 border-blue-500 text-blue-950 ring-1 ring-blue-500'
                    : isDark
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span>تبدیل هر عکس به یک فایل PDF جداگانه</span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  هر تصویر به یک فایل PDF یک صفحه‌ای مستقل تبدیل و به لیست اضافه می‌شود.
                </p>
              </button>
            </div>
          </div>

          {/* Merged Document Name (if merged mode) */}
          {mode === 'merged' && (
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-1.5">
                نام فایل نهایی PDF:
              </label>
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:border-emerald-500 font-medium ${
                  isDark
                    ? 'bg-neutral-950 border-neutral-750 text-white'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
                placeholder="مثال: مجموعه_تصاویر.pdf"
              />
            </div>
          )}

          {/* Page Sizing & Margins Options */}
          <div
            className={`p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs ${
              isDark ? 'bg-neutral-950/40 border-neutral-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div>
              <label className="text-neutral-400 block mb-1 font-medium">قطع کاغذ (Paper Size):</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as 'A4' | 'fit')}
                className={`w-full p-2 rounded-lg border text-xs ${
                  isDark ? 'bg-neutral-900 border-neutral-750 text-white' : 'bg-white border-slate-300'
                }`}
              >
                <option value="A4">A4 (استاندارد چاپ و اداری)</option>
                <option value="fit">تطبیق دقیق با ابعاد عکس (Fit to Image)</option>
              </select>
            </div>

            <div>
              <label className="text-neutral-400 block mb-1 font-medium">جهت کاغذ (Orientation):</label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape' | 'auto')}
                disabled={pageSize === 'fit'}
                className={`w-full p-2 rounded-lg border text-xs disabled:opacity-40 ${
                  isDark ? 'bg-neutral-900 border-neutral-750 text-white' : 'bg-white border-slate-300'
                }`}
              >
                <option value="auto">تشخیص خودکار بر اساس ابعاد عکس</option>
                <option value="portrait">عمودی (Portrait)</option>
                <option value="landscape">افقی (Landscape)</option>
              </select>
            </div>

            <div>
              <label className="text-neutral-400 block mb-1 font-medium">حاشیه سفید دور عکس:</label>
              <select
                value={marginMm}
                onChange={(e) => setMarginMm(parseInt(e.target.value) || 0)}
                disabled={pageSize === 'fit'}
                className={`w-full p-2 rounded-lg border text-xs disabled:opacity-40 ${
                  isDark ? 'bg-neutral-900 border-neutral-750 text-white' : 'bg-white border-slate-300'
                }`}
              >
                <option value="0">بدون حاشیه (۰ mm)</option>
                <option value="5">حاشیه ملایم (۵ mm)</option>
                <option value="10">حاشیه استاندارد (۱۰ mm)</option>
                <option value="15">حاشیه پهن (۱۵ mm)</option>
              </select>
            </div>
          </div>

          {/* Selected Images List with Ordering */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold">
                تصاویر جهت تبدیل ({files.length} تصویر):
              </span>
              <label className="text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن تصویر دیگر</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleAddMore}
                  className="hidden"
                />
              </label>
            </div>

            <div
              className={`max-h-56 overflow-y-auto rounded-xl border p-2 space-y-1.5 ${
                isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              {files.map((file, idx) => {
                const key = file.name + file.size;
                const preview = previewUrls[key];
                return (
                  <div
                    key={key + idx}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs border ${
                      isDark
                        ? 'bg-neutral-900 border-neutral-800'
                        : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-neutral-400 w-5 text-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-slate-200 dark:bg-neutral-800 border shrink-0 flex items-center justify-center">
                        {preview ? (
                          <img
                            src={preview}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-neutral-400" />
                        )}
                      </div>
                      <span className="truncate font-medium">{file.name}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-neutral-800 disabled:opacity-20 transition-colors"
                        title="انتقال به بالا"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === files.length - 1}
                        className="p-1 rounded hover:bg-neutral-800 disabled:opacity-20 transition-colors"
                        title="انتقال به پایین"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(idx)}
                        className="p-1 rounded text-red-500 hover:bg-red-500/10 transition-colors ms-1"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isConverting}
              className={`px-4 py-2 text-xs font-medium rounded-xl transition-colors ${
                isDark
                  ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-750'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {t.cancel}
            </button>

            <button
              type="button"
              onClick={handleConvert}
              disabled={isConverting || files.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
            >
              {isConverting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال تبدیل به PDF...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  <span>تبدیل و افزودن به لیست اسناد</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
