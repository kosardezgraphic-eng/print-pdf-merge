import React from 'react';
import {
  Search,
  ArrowUpDown,
  LayoutGrid,
  List,
  Trash2,
  CheckSquare,
  Square,
  Sparkles,
  Printer,
  Sliders,
} from 'lucide-react';
import { translations } from '../utils/translations';
import { Language, SortBy, ViewMode } from '../types';

interface ToolbarProps {
  lang: Language;
  theme: 'dark' | 'light';
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onClearAll: () => void;
  onLoadSamples: () => void;
  onOpenPrintModal: () => void;
  onOpenGridModal: () => void;
  totalItems: number;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  lang,
  theme,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  allSelected,
  onToggleSelectAll,
  onClearAll,
  onLoadSamples,
  onOpenPrintModal,
  onOpenGridModal,
  totalItems,
}) => {
  const t = translations[lang];
  const isDark = theme === 'dark';

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
      <div
        className={`rounded-2xl border p-3 flex flex-wrap items-center justify-between gap-3 transition-colors ${
          isDark
            ? 'bg-neutral-900 border-neutral-800 text-neutral-100'
            : 'bg-white border-slate-200 text-slate-800 shadow-xs'
        }`}
      >
        {/* Left Side: Search & Filter */}
        <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-neutral-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t.searchPlaceholder}
              className={`w-full border rounded-xl ps-9 pe-3 py-1.5 text-xs sm:text-sm focus:outline-none transition-colors ${
                isDark
                  ? 'bg-neutral-950 border-neutral-800 focus:border-blue-500 text-neutral-200 placeholder:text-neutral-500'
                  : 'bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900 placeholder:text-slate-400'
              }`}
            />
          </div>
        </div>

        {/* Right Side: Actions, Print, Sort, View Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* N-Up Grid Imposition Button in Toolbar */}
          <button
            onClick={onOpenGridModal}
            disabled={totalItems === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="چیدمان جدولی و فرم‌بندی چند صفحه در یک برگ"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">چیدمان جدولی</span>
          </button>

          {/* Quick Print Button in Toolbar */}
          <button
            onClick={onOpenPrintModal}
            disabled={totalItems === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title={t.printBtn}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t.printBtn}</span>
          </button>

          {/* Select / Deselect All */}
          <button
            onClick={onToggleSelectAll}
            disabled={totalItems === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 disabled:opacity-50 rounded-lg text-xs font-medium border transition-colors ${
              isDark
                ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border-neutral-700/60'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title={allSelected ? t.deselectAll : t.selectAll}
          >
            {allSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
            ) : (
              <Square className="w-3.5 h-3.5 text-neutral-400" />
            )}
            <span className="hidden sm:inline">
              {allSelected ? t.deselectAll : t.selectAll}
            </span>
          </button>

          {/* Sort Dropdown */}
          <div
            className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-xs ${
              isDark
                ? 'bg-neutral-800 border-neutral-700/60 text-neutral-300'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortBy)}
              className="bg-transparent text-xs focus:outline-none cursor-pointer"
            >
              <option value="order" className={isDark ? 'bg-neutral-850 text-white' : 'bg-white text-slate-900'}>
                {t.sortDefault}
              </option>
              <option value="name-asc" className={isDark ? 'bg-neutral-850 text-white' : 'bg-white text-slate-900'}>
                {t.sortNameAsc}
              </option>
              <option value="name-desc" className={isDark ? 'bg-neutral-850 text-white' : 'bg-white text-slate-900'}>
                {t.sortNameDesc}
              </option>
              <option value="pages-asc" className={isDark ? 'bg-neutral-850 text-white' : 'bg-white text-slate-900'}>
                {t.sortPagesAsc}
              </option>
              <option value="pages-desc" className={isDark ? 'bg-neutral-850 text-white' : 'bg-white text-slate-900'}>
                {t.sortPagesDesc}
              </option>
              <option value="size-asc" className={isDark ? 'bg-neutral-850 text-white' : 'bg-white text-slate-900'}>
                {t.sortSizeAsc}
              </option>
              <option value="size-desc" className={isDark ? 'bg-neutral-850 text-white' : 'bg-white text-slate-900'}>
                {t.sortSizeDesc}
              </option>
            </select>
          </div>

          {/* View Mode Toggle: Cards vs Table */}
          <div
            className={`flex items-center p-0.5 rounded-lg border ${
              isDark ? 'bg-neutral-950 border-neutral-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              onClick={() => onViewModeChange('table')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table'
                  ? isDark
                    ? 'bg-neutral-800 text-blue-400 shadow-sm'
                    : 'bg-white text-blue-600 shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-600'
              }`}
              title={t.viewTable}
              aria-label={t.viewTable}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('cards')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'cards'
                  ? isDark
                    ? 'bg-neutral-800 text-blue-400 shadow-sm'
                    : 'bg-white text-blue-600 shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-600'
              }`}
              title={t.viewCards}
              aria-label={t.viewCards}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Clear All */}
          {totalItems > 0 && (
            <button
              onClick={onClearAll}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors ${
                isDark
                  ? 'bg-red-950/40 hover:bg-red-900/60 text-red-300 border-red-800/40'
                  : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
              }`}
              title={t.clearAll}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.clearAll}</span>
            </button>
          )}

          {/* Load Sample Files */}
          <button
            onClick={onLoadSamples}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors ${
              isDark
                ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border-neutral-700/60'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title={t.loadSamples}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden lg:inline">{t.loadSamples}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
