import React from 'react';
import { X, Monitor, ShieldCheck, Zap, FolderOpen, MousePointer, Printer, Sliders } from 'lucide-react';
import { translations } from '../utils/translations';
import { Language } from '../types';

interface WindowsHelpModalProps {
  lang: Language;
  theme: 'dark' | 'light';
  onClose: () => void;
}

export const WindowsHelpModal: React.FC<WindowsHelpModalProps> = ({ lang, theme, onClose }) => {
  const t = translations[lang];
  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden transition-colors ${
          isDark
            ? 'bg-neutral-900 border-neutral-750 text-neutral-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between transition-colors ${
            isDark ? 'bg-neutral-950/70 border-neutral-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-500">
              <Monitor className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold">
              {t.windowsHelpTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-slate-500 hover:text-black hover:bg-slate-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-3.5 text-xs sm:text-sm">
          <div
            className={`flex items-start gap-3 p-3.5 rounded-xl border ${
              isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <Printer className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold mb-1">چاپ دسته‌جمعی با مدیریت سینی و اندازه کاغذ</h4>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-neutral-400' : 'text-slate-600'}`}>
                می‌توانید تمام فایل‌ها یا اسناد انتخابی را همزمان به صف چاپ ارسال کنید. امکان انتخاب نوع چاپگر، اندازه کاغذ (A4, A3, Letter و ...)، سینی کاغذ، چاپ دورو و حالت سیاه و سفید خالص لیزری در دسترس است.
              </p>
            </div>
          </div>

          <div
            className={`flex items-start gap-3 p-3.5 rounded-xl border ${
              isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <Sliders className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold mb-1">تامب‌نیل تمام صفحات، تنظیم نور، کنتراست و کراپ</h4>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-neutral-400' : 'text-slate-600'}`}>
                در بخش استودیو صفحات، تامب‌نیل تک‌تک صفحات نمایش داده می‌شود. می‌توانید روشنایی و کنتراست را تصحیح کنید، حاشیه‌های زائد را کراپ کنید و صفحات را برای چاپ فعال یا غیرفعال نمایید.
              </p>
            </div>
          </div>

          <div
            className={`flex items-start gap-3 p-3.5 rounded-xl border ${
              isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold mb-1">کاملاً آفلاین و امن (Client-side)</h4>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-neutral-400' : 'text-slate-600'}`}>
                تمام فرآیند شمارش صفحات، چاپ، تنظیم نور و ادغام در حافظه سیستم شما بدون نیاز به اینترنت اجرا می‌شود.
              </p>
            </div>
          </div>

          <div
            className={`flex items-start gap-3 p-3.5 rounded-xl border ${
              isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <FolderOpen className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold mb-1">ذخیره مستقیم در پوشه دلخواه ویندوز</h4>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-neutral-400' : 'text-slate-600'}`}>
                با استفاده از کادر رسمی Save As ویندوز، می‌توانید فایل نهایی را با نام دلخواه در هر درایو یا پوشه‌ای از رایانه ذخیره کنید.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3 border-t flex justify-end transition-colors ${
            isDark ? 'border-neutral-800 bg-neutral-950/60' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
