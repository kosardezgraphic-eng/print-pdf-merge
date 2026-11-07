import React, { useRef, useState } from 'react';
import { UploadCloud, FolderPlus, FilePlus, Sparkles, Image as ImageIcon } from 'lucide-react';
import { translations } from '../utils/translations';
import { Language } from '../types';

interface DropZoneProps {
  lang: Language;
  theme: 'dark' | 'light';
  onFilesSelected: (files: File[]) => void;
  onImagesSelected?: (files: File[]) => void;
  onLoadSamples: () => void;
  hasFiles: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  lang,
  theme,
  onFilesSelected,
  onImagesSelected,
  onLoadSamples,
  hasFiles,
}) => {
  const t = translations[lang];
  const isDark = theme === 'dark';
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const isImageFile = (f: File) => {
    return (
      f.type.startsWith('image/') ||
      /\.(png|jpe?g|webp|bmp|tiff?|svg)$/i.test(f.name)
    );
  };

  const isPdfFile = (f: File) => {
    return f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const items = e.dataTransfer.items;
    const pdfFiles: File[] = [];
    const imageFiles: File[] = [];

    if (items && items.length > 0) {
      const queue: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) {
          queue.push(entry);
        } else {
          const file = items[i].getAsFile();
          if (file) {
            if (isPdfFile(file)) pdfFiles.push(file);
            else if (isImageFile(file)) imageFiles.push(file);
          }
        }
      }

      if (queue.length > 0) {
        const readEntry = async (entry: FileSystemEntry): Promise<void> => {
          if (entry.isFile) {
            return new Promise((resolve) => {
              (entry as FileSystemFileEntry).file(
                (f) => {
                  if (isPdfFile(f)) pdfFiles.push(f);
                  else if (isImageFile(f)) imageFiles.push(f);
                  resolve();
                },
                () => resolve()
              );
            });
          } else if (entry.isDirectory) {
            const dirReader = (entry as FileSystemDirectoryEntry).createReader();
            const readEntries = async (): Promise<void> => {
              return new Promise((resolve) => {
                dirReader.readEntries(
                  async (entries) => {
                    if (entries.length === 0) {
                      resolve();
                    } else {
                      for (const child of entries) {
                        await readEntry(child);
                      }
                      await readEntries();
                      resolve();
                    }
                  },
                  () => resolve()
                );
              });
            };
            await readEntries();
          }
        };

        for (const entry of queue) {
          await readEntry(entry);
        }
      }
    } else if (e.dataTransfer.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i];
        if (isPdfFile(f)) pdfFiles.push(f);
        else if (isImageFile(f)) imageFiles.push(f);
      }
    }

    if (pdfFiles.length > 0) {
      onFilesSelected(pdfFiles);
    }
    if (imageFiles.length > 0 && onImagesSelected) {
      onImagesSelected(imageFiles);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      const pdfs = selected.filter(isPdfFile);
      const images = selected.filter(isImageFile);

      if (pdfs.length > 0) onFilesSelected(pdfs);
      if (images.length > 0 && onImagesSelected) onImagesSelected(images);

      e.target.value = '';
    }
  };

  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const images = Array.from(e.target.files);
      if (onImagesSelected) onImagesSelected(images);
      e.target.value = '';
    }
  };

  // Compact Ribbon Bar (When files exist)
  if (hasFiles) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          onChange={handleFileInputChange}
          className="hidden"
        />
        <input
          ref={imageInputRef}
          type="file"
          multiple
          accept="image/*,.png,.jpg,.jpeg,.webp,.bmp"
          onChange={handleImageInputChange}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is standard for folder upload
          webkitdirectory="true"
          directory="true"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full py-3 px-4 rounded-xl border-2 border-dashed transition-all flex flex-wrap items-center justify-between gap-3 text-xs ${
            isDragOver
              ? isDark
                ? 'border-blue-500 bg-blue-950/40 text-blue-200 scale-[1.005]'
                : 'border-blue-500 bg-blue-50 text-blue-900 scale-[1.005]'
              : isDark
              ? 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 text-neutral-400'
              : 'border-slate-300 bg-white hover:border-slate-400 text-slate-600 shadow-xs'
          }`}
        >
          <div className="flex items-center gap-3">
            <UploadCloud className={`w-5 h-5 ${isDragOver ? 'text-blue-500 animate-bounce' : 'text-blue-500'}`} />
            <span>
              {isDragOver
                ? t.dropActive
                : 'برای اضافه کردن PDF یا تصویر، آن‌ها را اینجا رها کنید'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
                isDark
                  ? 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border-emerald-800/60'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}
              title="افزودن و تبدیل عکس و تصویر به PDF"
            >
              <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
              <span>افزودن عکس (Image)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
                isDark
                  ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border-neutral-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <FilePlus className="w-3.5 h-3.5 text-blue-500" />
              <span>{t.addFiles}</span>
            </button>

            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
                isDark
                  ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border-neutral-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.addFolder}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full Hero Dropzone (Empty State)
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*,.png,.jpg,.jpeg,.webp,.bmp"
        onChange={handleImageInputChange}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard for folder upload
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all ${
          isDragOver
            ? isDark
              ? 'border-blue-500 bg-blue-950/30 scale-[1.008]'
              : 'border-blue-500 bg-blue-50/50 scale-[1.008]'
            : isDark
            ? 'border-neutral-750 hover:border-neutral-600 bg-neutral-900/40'
            : 'border-slate-300 hover:border-slate-400 bg-white shadow-xs'
        }`}
      >
        <div className="max-w-md mx-auto flex flex-col items-center">
          <div
            className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 ${
              isDragOver
                ? 'scale-110 bg-blue-600 text-white shadow-xl shadow-blue-500/30'
                : isDark
                ? 'bg-neutral-850 text-blue-500 border border-neutral-750'
                : 'bg-blue-50 text-blue-600 border border-blue-100 shadow-sm'
            }`}
          >
            <UploadCloud className="w-10 h-10 stroke-[1.75]" />
          </div>

          <h3 className="text-lg sm:text-xl font-bold tracking-tight">
            {isDragOver ? t.dropActive : t.dropTitle}
          </h3>

          <p
            className={`mt-2 text-xs sm:text-sm leading-relaxed ${
              isDark ? 'text-neutral-400' : 'text-slate-500'
            }`}
          >
            {t.dropSubtitle} یا تصاویر مورد نظر را بکشید و اینجا رها کنید
          </p>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <FilePlus className="w-4 h-4" />
              <span>{t.addFiles}</span>
            </button>

            <button
              onClick={() => imageInputRef.current?.click()}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer ${
                isDark
                  ? 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border-emerald-800/60'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-emerald-500" />
              <span>افزودن عکس و تصویر</span>
            </button>

            <button
              onClick={() => folderInputRef.current?.click()}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer ${
                isDark
                  ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border-neutral-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <FolderPlus className="w-4 h-4 text-amber-500" />
              <span>{t.addFolder}</span>
            </button>
          </div>

          {/* Samples */}
          <div className="mt-7 pt-5 border-t border-neutral-800/40 w-full flex items-center justify-center gap-2">
            <button
              onClick={onLoadSamples}
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer ${
                isDark ? 'text-neutral-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.loadSamples}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
