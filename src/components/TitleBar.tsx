import React from 'react';
import { FileText, ShieldCheck, Sun, Moon, Globe, HelpCircle, Monitor } from 'lucide-react';
import { translations } from '../utils/translations';
import { Language } from '../types';

interface TitleBarProps {
  lang: Language;
  onToggleLang: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenHelp: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  lang,
  onToggleLang,
  theme,
  onToggleTheme,
  onOpenHelp,
}) => {
  const t = translations[lang];
  const isDark = theme === 'dark';

  return (
    <header
      className={`w-full border-b backdrop-blur sticky top-0 z-40 transition-colors ${
        isDark
          ? 'bg-neutral-900/90 border-neutral-800 text-neutral-100'
          : 'bg-white/95 border-slate-200 text-slate-900 shadow-xs'
      }`}
    >
      {/* Windows 11 Style Titlebar Strip */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Left Zone: Brand / Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight leading-tight">
                {t.appTitle}
              </h1>
              <span
                className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                  isDark
                    ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60'
                    : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {t.offlineBadge}
              </span>
            </div>
            <p className={`text-xs hidden md:block ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
              {t.appSubtitle}
            </p>
          </div>
        </div>

        {/* Right Zone: Controls & Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Windows Platform Indicator */}
          <div
            className={`hidden lg:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border ${
              isDark
                ? 'text-neutral-300 bg-neutral-800/80 border-neutral-700/60'
                : 'text-slate-600 bg-slate-100 border-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5 text-blue-500" />
            <span>ویندوز دسکتاپ (Windows Desktop)</span>
          </div>

          {/* Help Button */}
          <button
            onClick={onOpenHelp}
            title={t.windowsHelpTitle}
            className={`p-2 rounded-lg transition-colors border ${
              isDark
                ? 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 border-transparent hover:border-neutral-700'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border-transparent hover:border-slate-200'
            }`}
            aria-label="Help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Language Switcher */}
          <button
            onClick={onToggleLang}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
              isDark
                ? 'text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-750 border-neutral-700/80'
                : 'text-slate-700 hover:text-black bg-slate-100 hover:bg-slate-200 border-slate-200'
            }`}
            title="تغییر زبان / Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-neutral-400" />
            <span>{t.languageToggle}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-lg transition-colors border ${
              isDark
                ? 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 border-transparent hover:border-neutral-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent hover:border-slate-200'
            }`}
            title={isDark ? t.themeLight : t.themeDark}
            aria-label="Toggle Theme"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
