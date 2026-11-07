import React, { useState } from 'react';
import {
  FilePlus,
  Image as ImageIcon,
  Sparkles,
  Bookmark,
  Layers,
  Printer,
  RotateCw,
  Sun,
  Contrast,
  Scissors,
  Type,
  Shapes,
  Hash,
  Ruler,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Grid,
  FileCheck,
  BookOpen,
  ArrowRightLeft,
  SlidersHorizontal,
  ChevronDown,
  Trash2,
  RefreshCw,
  FolderOpen,
  Eye,
  EyeOff,
  Copy,
  Square,
  Check,
  Compass,
  Palette,
  AlignRight,
  AlignCenter,
  AlignLeft,
  Bold,
  Italic,
  Maximize,
  Sliders,
  Move,
  LayoutGrid,
  Grid2X2,
  CheckSquare,
  Circle,
  HelpCircle,
  Triangle,
  Hexagon,
  Diamond,
  Minus,
  Star,
} from 'lucide-react';
import {
  Language,
  RibbonTab,
  PaperSize,
  DuplexMode,
  ColorMode,
  PrintOrientation,
  GridLayoutSettings,
  PageAdjustment,
  PrintProfile,
  defaultPrintProfiles,
  CustomCellOverride,
  GridFlowOrder,
  PageOverlayText,
  PageOverlayShape,
  PageOverlayNumbering,
  ShapeType,
  OverlayTargetScope,
} from '../types';

interface RibbonBarProps {
  lang: Language;
  theme: 'dark' | 'light';
  activeTab: RibbonTab;
  onSelectTab: (tab: RibbonTab) => void;
  isRibbonCollapsed: boolean;
  onToggleCollapse: () => void;

  // Actions for Tab: File
  onAddFiles: () => void;
  onAddImages: () => void;
  onLoadSamples: () => void;
  onClearAll: () => void;
  onOpenProfiles: () => void;
  onSelectProfile: (profile: PrintProfile) => void;

  // Actions for Tab: Page Layout
  paperSize: PaperSize;
  onChangePaperSize: (size: PaperSize) => void;
  orientation: PrintOrientation;
  onChangeOrientation: (o: PrintOrientation) => void;
  duplex: DuplexMode;
  onChangeDuplex: (d: DuplexMode) => void;
  gutterMm: number;
  onChangeGutter: (g: number) => void;
  gridLayout: GridLayoutSettings;
  onChangeGridLayout: (updates: Partial<GridLayoutSettings>) => void;
  scaling: 'fit' | 'actual' | 'shrink';
  onChangeScaling: (s: 'fit' | 'actual' | 'shrink') => void;
  jobFromNewSheet: boolean;
  onToggleJobFromNewSheet: () => void;
  onOpenGridStudio: () => void;
  selectedCellIdx?: number;
  selectedCellIndices?: number[];
  onSelectCell?: (idx: number, isMulti?: boolean) => void;
  onSelectAllCells?: () => void;
  onSelectOddCells?: () => void;
  onSelectEvenCells?: () => void;
  onUpdateCellOverride?: (cellIdx: number | number[], updates: Partial<CustomCellOverride>) => void;
  onResetCellOverride?: (cellIdx: number | number[]) => void;
  onApplyCellOverrideToAll?: (cellIdx: number) => void;
  selectedPagesCount?: number;

  // Actions for Tab: Effects
  activeAdjustment: PageAdjustment;
  onUpdateActiveAdjustment: (updates: Partial<PageAdjustment>) => void;
  onResetAdjustments: () => void;
  onRotateCurrent: () => void;

  // Actions for Tab: Insert & Overlays
  onAddTextOverlay: () => void;
  onAddShapeOverlay: (type?: ShapeType) => void;
  onAddPageNumbering: () => void;
  showCutMarks: boolean;
  onToggleCutMarks: () => void;
  showMeasureTool: boolean;
  onToggleMeasureTool: () => void;
  onOpenPageStudio: () => void;
  activeTool?: 'move' | 'crop' | 'text' | 'shape' | 'numbering' | 'measure';
  onSelectTool?: (tool: 'move' | 'crop' | 'text' | 'shape' | 'numbering' | 'measure') => void;

  // Active element inline formatting inside Ribbon
  selectedText?: PageOverlayText | null;
  onUpdateSelectedText?: (updates: Partial<PageOverlayText>) => void;
  onDeleteSelectedText?: () => void;
  selectedShape?: PageOverlayShape | null;
  onUpdateSelectedShape?: (updates: Partial<PageOverlayShape>) => void;
  onDeleteSelectedShape?: () => void;
  pageNumbering?: PageOverlayNumbering | null;
  onUpdatePageNumbering?: (updates: Partial<PageOverlayNumbering>) => void;

  // Actions for Tab: Crop
  onToggleInteractiveCrop: () => void;
  onTrimScannerBorders: () => void;
  onResetCrop: () => void;
  onCloseCrop?: () => void;
  activeCrop?: { top: number; bottom: number; left: number; right: number };
  onChangeCrop?: (newCrop: { top: number; bottom: number; left: number; right: number }) => void;

  // Actions for Tab: Tools / PDF
  onOpenMergeModal: () => void;
  onOpenImageToPdf: () => void;

  // Actions for Tab: View
  viewMode: 'sheet' | 'cards' | 'table';
  onChangeViewMode: (mode: 'sheet' | 'cards' | 'table') => void;
  zoomLevel: number;
  onChangeZoom: (level: number) => void;
  showRulers: boolean;
  onToggleRulers: () => void;
  showMargins: boolean;
  onToggleMargins: () => void;

  hasFiles: boolean;
}

export const RibbonBar: React.FC<RibbonBarProps> = ({
  lang,
  theme,
  activeTab,
  onSelectTab,
  isRibbonCollapsed,
  onToggleCollapse,
  onAddFiles,
  onAddImages,
  onLoadSamples,
  onClearAll,
  onOpenProfiles,
  onSelectProfile,
  paperSize,
  onChangePaperSize,
  orientation,
  onChangeOrientation,
  duplex,
  onChangeDuplex,
  gutterMm,
  onChangeGutter,
  gridLayout,
  onChangeGridLayout,
  scaling,
  onChangeScaling,
  jobFromNewSheet,
  onToggleJobFromNewSheet,
  onOpenGridStudio,
  selectedCellIdx = 0,
  selectedCellIndices = [0],
  onSelectCell,
  onSelectAllCells,
  onSelectOddCells,
  onSelectEvenCells,
  onUpdateCellOverride,
  onResetCellOverride,
  onApplyCellOverrideToAll,
  selectedPagesCount = 0,
  activeAdjustment,
  onUpdateActiveAdjustment,
  onResetAdjustments,
  onRotateCurrent,
  onAddTextOverlay,
  onAddShapeOverlay,
  onAddPageNumbering,
  showCutMarks,
  onToggleCutMarks,
  showMeasureTool,
  onToggleMeasureTool,
  onOpenPageStudio,
  activeTool = 'move',
  onSelectTool,
  selectedText,
  onUpdateSelectedText,
  onDeleteSelectedText,
  selectedShape,
  onUpdateSelectedShape,
  onDeleteSelectedShape,
  pageNumbering,
  onUpdatePageNumbering,
  onToggleInteractiveCrop,
  onTrimScannerBorders,
  onResetCrop,
  onCloseCrop,
  activeCrop,
  onChangeCrop,
  onOpenMergeModal,
  onOpenImageToPdf,
  viewMode,
  onChangeViewMode,
  zoomLevel,
  onChangeZoom,
  showRulers,
  onToggleRulers,
  showMargins,
  onToggleMargins,
  hasFiles,
}) => {
  const isDark = theme === 'dark';
  const isFa = lang === 'fa';

  const effectiveCellIndices = selectedCellIndices.length > 0 ? selectedCellIndices : [selectedCellIdx];
  const primaryCellIdx = effectiveCellIndices[0] ?? 0;

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const tabs: { id: RibbonTab; labelFa: string; labelEn: string }[] = [
    { id: 'file', labelFa: 'فایل', labelEn: 'File' },
    { id: 'layout', labelFa: 'چیدمان صفحه', labelEn: 'Page Layout' },
    { id: 'effects', labelFa: 'جلوه‌ها و نور', labelEn: 'Effects & Color' },
    { id: 'insert', labelFa: 'درج و ابزارها', labelEn: 'Insert' },
    { id: 'crop', labelFa: 'کادر برش', labelEn: 'Crop' },
    { id: 'tools', labelFa: 'فرم‌ها و PDF', labelEn: 'Tools & PDF' },
    { id: 'view', labelFa: 'نما و زوم', labelEn: 'View' },
  ];

  return (
    <div
      className={`w-full border-b select-none transition-all duration-150 shrink-0 relative z-40 overflow-visible ${
        isDark
          ? 'bg-neutral-900/95 border-neutral-800 text-neutral-200'
          : 'bg-slate-100/95 border-slate-300 text-slate-800'
      }`}
    >
      {/* Ribbon Tabs Header Strip */}
      <div className="flex items-center justify-between px-3 pt-1 border-b border-neutral-200 dark:border-neutral-800/80">
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  onSelectTab(tab.id);
                  if (isRibbonCollapsed) onToggleCollapse();
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? isDark
                      ? 'bg-neutral-800/90 text-blue-400 border-blue-500 shadow-xs'
                      : 'bg-white text-blue-700 border-blue-600 shadow-xs'
                    : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {isFa ? tab.labelFa : tab.labelEn}
              </button>
            );
          })}
        </nav>

        {/* Ribbon Collapse Toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded transition-colors"
          title={isRibbonCollapsed ? (isFa ? 'نمایش ریبون' : 'Expand Ribbon') : isFa ? 'جمع‌کردن ریبون' : 'Collapse Ribbon'}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-150 ${
              isRibbonCollapsed ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Ribbon Body Content (Collapsible) */}
      {!isRibbonCollapsed && (
        <div className="px-3 py-2 overflow-visible min-h-[92px] flex items-center relative z-40">
          {/* TAB 1: FILE */}
          {activeTab === 'file' && (
            <div className="flex items-center gap-3">
              {/* Group: Add Content */}
              <div className="flex items-center gap-1.5 pe-3 border-e border-neutral-300 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={onAddFiles}
                  className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-blue-600/10 active:scale-95 transition-all text-xs font-medium cursor-pointer"
                >
                  <FilePlus className="w-5 h-5 text-blue-500 mb-1" />
                  <span>{isFa ? 'افزودن PDF' : 'Add PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={onAddImages}
                  className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-emerald-600/10 active:scale-95 transition-all text-xs font-medium cursor-pointer"
                >
                  <ImageIcon className="w-5 h-5 text-emerald-500 mb-1" />
                  <span>{isFa ? 'افزودن عکس' : 'Add Images'}</span>
                </button>

                <button
                  type="button"
                  onClick={onLoadSamples}
                  className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-amber-600/10 active:scale-95 transition-all text-xs font-medium cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-amber-500 mb-1" />
                  <span>{isFa ? 'فایل‌های تستی' : 'Sample Files'}</span>
                </button>
              </div>

              {/* Group: Print Profiles */}
              <div className="relative flex items-center gap-1.5 pe-3 border-e border-neutral-300 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen((v) => !v)}
                  className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-purple-600/10 active:scale-95 transition-all text-xs font-medium cursor-pointer"
                >
                  <Bookmark className="w-5 h-5 text-purple-500 mb-1" />
                  <span className="flex items-center gap-0.5">
                    {isFa ? 'پروفایل‌های چاپ' : 'Print Profiles'}
                    <ChevronDown className="w-3 h-3" />
                  </span>
                </button>

                {isProfileMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-45 cursor-default"
                      onClick={() => setIsProfileMenuOpen(false)}
                    />
                    <div
                      className={`absolute top-full start-0 mt-1 w-64 rounded-xl border shadow-2xl p-2 z-50 text-xs ${
                        isDark
                          ? 'bg-neutral-900 border-neutral-750 text-neutral-100'
                          : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    >
                      <div className="px-2 py-1 font-bold text-[11px] text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 mb-1">
                        {isFa ? 'انتخاب قالب آماده چاپ' : 'Select Print Profile Preset'}
                      </div>
                      {defaultPrintProfiles.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            onSelectProfile(p);
                            setIsProfileMenuOpen(false);
                          }}
                          className="w-full text-start p-2 rounded-lg hover:bg-blue-600/10 transition-colors cursor-pointer"
                        >
                          <div className="font-semibold text-blue-500">{isFa ? p.nameFa : p.name}</div>
                          <div className="text-[10px] text-neutral-400 mt-0.5">{p.description}</div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Group: Clear / Manage */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onClearAll}
                  disabled={!hasFiles}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all text-xs font-medium ${
                    hasFiles
                      ? 'hover:bg-red-500/10 text-red-500 cursor-pointer active:scale-95'
                      : 'opacity-40 cursor-not-allowed text-neutral-400'
                  }`}
                >
                  <Trash2 className="w-5 h-5 mb-1" />
                  <span>{isFa ? 'پاک‌سازی همه' : 'Clear All'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PAGE LAYOUT */}
          {activeTab === 'layout' && (
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-0.5 max-w-full">
              {/* Paper Size & Orientation */}
              <div className="flex flex-col gap-1 pe-3 border-e border-neutral-300 dark:border-neutral-800 shrink-0">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                  {isFa ? 'اندازه و جهت کاغذ' : 'Paper & Orientation'}
                </span>
                <div className="flex items-center gap-1.5">
                  <select
                    value={paperSize}
                    onChange={(e) => onChangePaperSize(e.target.value as PaperSize)}
                    className={`px-2 py-1 text-xs rounded-md border font-medium cursor-pointer ${
                      isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-slate-200'
                    }`}
                  >
                    <option value="A4">A4 (210 × 297 mm)</option>
                    <option value="A3">A3 (297 × 420 mm)</option>
                    <option value="A5">A5 (148 × 210 mm)</option>
                    <option value="Letter">Letter (8.5 × 11 in)</option>
                    <option value="Legal">Legal (8.5 × 14 in)</option>
                    <option value="B5">B5 (176 × 250 mm)</option>
                  </select>

                  <div className="flex items-center border border-neutral-300 dark:border-neutral-700 rounded-md overflow-hidden">
                    <button
                      type="button"
                      onClick={() => onChangeOrientation('portrait')}
                      className={`px-2 py-1 text-xs font-medium cursor-pointer ${
                        orientation === 'portrait'
                          ? 'bg-blue-600 text-white font-bold'
                          : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {isFa ? 'عمودی' : 'Portrait'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeOrientation('landscape')}
                      className={`px-2 py-1 text-xs font-medium cursor-pointer ${
                        orientation === 'landscape'
                          ? 'bg-blue-600 text-white font-bold'
                          : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {isFa ? 'افقی' : 'Landscape'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Duplex Mode & Booklet */}
              <div className="flex flex-col gap-1 pe-3 border-e border-neutral-300 dark:border-neutral-800 shrink-0">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                  {isFa ? 'چاپ دورو و شیرازه' : 'Duplex & Gutter'}
                </span>
                <div className="flex items-center gap-1.5">
                  <select
                    value={duplex}
                    onChange={(e) => onChangeDuplex(e.target.value as DuplexMode)}
                    className={`px-2 py-1 text-xs rounded-md border font-medium cursor-pointer ${
                      isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-slate-200'
                    }`}
                  >
                    <option value="simplex">{isFa ? 'یک‌رو (Simplex)' : '1-Sided (Simplex)'}</option>
                    <option value="duplexLong">
                      {isFa ? 'دورو لبه بلند (Long-Edge)' : '2-Sided (Long-Edge)'}
                    </option>
                    <option value="duplexShort">
                      {isFa ? 'دورو لبه کوتاه (Short-Edge)' : '2-Sided (Short-Edge)'}
                    </option>
                    <option value="booklet">
                      {isFa ? 'جزوه و بوکلت تا شده (Booklet)' : 'Booklet Imposition'}
                    </option>
                  </select>

                  {/* Gutter Margin Input */}
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-neutral-400 text-[11px]">{isFa ? 'شیرازه:' : 'Gutter:'}</span>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={gutterMm}
                      onChange={(e) => onChangeGutter(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className={`w-11 px-1.5 py-0.5 text-center font-mono text-xs rounded border ${
                        isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-slate-200'
                      }`}
                    />
                    <span className="text-[10px] text-neutral-400">mm</span>
                  </div>
                </div>
              </div>

              {/* N-Up Multi-Page Presets & Custom Grid Dimensions */}
              <div className="flex flex-col gap-1 pe-3 border-e border-neutral-300 dark:border-neutral-800 shrink-0">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                  {isFa ? 'چیدمان ماتریس (N-Up)' : 'Imposition Grid (N-Up)'}
                </span>
                <div className="flex items-center gap-1">
                  {[
                    { label: '1', rows: 1, cols: 1, isSingle: true },
                    { label: '2', rows: 1, cols: 2 },
                    { label: '4', rows: 2, cols: 2 },
                    { label: '6', rows: 2, cols: 3 },
                    { label: '8', rows: 2, cols: 4 },
                    { label: '12', rows: 4, cols: 3 },
                  ].map((m) => {
                    const isSelected = m.isSingle
                      ? !gridLayout.enabled || (gridLayout.rows === 1 && gridLayout.cols === 1)
                      : gridLayout.enabled && gridLayout.rows === m.rows && gridLayout.cols === m.cols;
                    return (
                      <button
                        key={m.label}
                        type="button"
                        onClick={() => {
                          if (m.isSingle) {
                            onChangeGridLayout({ enabled: false });
                          } else {
                            onChangeGridLayout({
                              enabled: true,
                              rows: m.rows,
                              cols: m.cols,
                              repeatPage: true,
                            });
                          }
                        }}
                        className={`px-2 py-1 text-xs rounded border font-mono transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-xs'
                            : isDark
                            ? 'border-neutral-700 hover:bg-neutral-800 text-neutral-300'
                            : 'border-slate-200 hover:bg-slate-200 text-slate-700'
                        }`}
                        title={m.isSingle ? (isFa ? 'تک صفحه عادی' : 'Single 1-up') : isFa ? `ماتریس ${m.label}تایی (${m.rows}×${m.cols})` : `${m.label}-up Grid`}
                      >
                        {m.label}
                      </button>
                    );
                  })}

                  {/* Rows × Cols Stepper */}
                  <div className="flex items-center gap-1 ms-1 bg-black/10 dark:bg-neutral-800/80 p-0.5 rounded border border-neutral-300 dark:border-neutral-700 text-xs">
                    <span className="text-[10px] text-neutral-400 px-0.5">{isFa ? 'سطر:' : 'R:'}</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={gridLayout.rows || 1}
                      onChange={(e) => {
                        const r = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1));
                        onChangeGridLayout({ enabled: r > 1 || (gridLayout.cols || 1) > 1, rows: r });
                      }}
                      className="w-8 text-center font-mono font-bold bg-transparent text-xs"
                      title={isFa ? 'تعداد ردیف‌های ماتریس' : 'Matrix Rows'}
                    />
                    <span className="text-neutral-400">×</span>
                    <span className="text-[10px] text-neutral-400 px-0.5">{isFa ? 'ستون:' : 'C:'}</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={gridLayout.cols || 1}
                      onChange={(e) => {
                        const c = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1));
                        onChangeGridLayout({ enabled: c > 1 || (gridLayout.rows || 1) > 1, cols: c });
                      }}
                      className="w-8 text-center font-mono font-bold bg-transparent text-xs"
                      title={isFa ? 'تعداد ستون‌های ماتریس' : 'Matrix Columns'}
                    />
                  </div>
                </div>
              </div>

              {/* IF GRID ENABLED: MATRIX SPACING & MARGINS */}
              {gridLayout.enabled && (
                <div className="flex flex-col gap-1 pe-3 border-e border-neutral-300 dark:border-neutral-800 shrink-0">
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                    {isFa ? 'فاصله‌ها و حاشیه‌ها' : 'Gaps & Margins (mm)'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* H Gap */}
                    <div className="flex items-center gap-0.5 text-xs">
                      <span className="text-[10px] text-neutral-400">{isFa ? 'افقی:' : 'H:'}</span>
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={gridLayout.horizontalGapMm ?? 2}
                        onChange={(e) =>
                          onChangeGridLayout({
                            horizontalGapMm: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        className={`w-10 px-1 py-0.5 text-center font-mono text-xs rounded border ${
                          isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-slate-200'
                        }`}
                        title={isFa ? 'فاصله افقی بین خانه‌ها بر حسب میلی‌متر' : 'Horizontal gap between cells'}
                      />
                    </div>

                    {/* V Gap */}
                    <div className="flex items-center gap-0.5 text-xs">
                      <span className="text-[10px] text-neutral-400">{isFa ? 'عمودی:' : 'V:'}</span>
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={gridLayout.verticalGapMm ?? 2}
                        onChange={(e) =>
                          onChangeGridLayout({
                            verticalGapMm: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        className={`w-10 px-1 py-0.5 text-center font-mono text-xs rounded border ${
                          isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-slate-200'
                        }`}
                        title={isFa ? 'فاصله عمودی بین خانه‌ها بر حسب میلی‌متر' : 'Vertical gap between cells'}
                      />
                    </div>

                    {/* Margins */}
                    <div className="flex items-center gap-0.5 text-xs">
                      <span className="text-[10px] text-neutral-400">{isFa ? 'حاشیه:' : 'Margin:'}</span>
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={gridLayout.marginTopMm ?? 4}
                        onChange={(e) => {
                          const m = Math.max(0, parseInt(e.target.value, 10) || 0);
                          onChangeGridLayout({
                            marginTopMm: m,
                            marginBottomMm: m,
                            marginLeftMm: m,
                            marginRightMm: m,
                          });
                        }}
                        className={`w-10 px-1 py-0.5 text-center font-mono text-xs rounded border ${
                          isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-slate-200'
                        }`}
                        title={isFa ? 'حاشیه از لبه برگه (میلی‌متر)' : 'Sheet outer margin in mm'}
                      />
                    </div>

                    {/* Cut marks & Repeat page */}
                    <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none ms-1">
                      <input
                        type="checkbox"
                        checked={Boolean(gridLayout.showCutMarks)}
                        onChange={(e) => onChangeGridLayout({ showCutMarks: e.target.checked })}
                        className="rounded accent-blue-600 cursor-pointer"
                      />
                      <span>{isFa ? 'خطوط برش' : 'Cut Marks'}</span>
                    </label>

                    <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(gridLayout.repeatPage)}
                        onChange={(e) => onChangeGridLayout({ repeatPage: e.target.checked })}
                        className="rounded accent-blue-600 cursor-pointer"
                      />
                      <span>{isFa ? 'تکرار برگه' : 'Repeat'}</span>
                    </label>
                  </div>
                </div>
              )}

              {/* IF GRID ENABLED: MULTI-CELL SELECTOR & INDIVIDUAL CELL SETTINGS (INSIDE RIBBON!) */}
              {gridLayout.enabled && (
                <div className="flex flex-col gap-1 pe-3 border-e border-neutral-300 dark:border-neutral-800 shrink-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                      <LayoutGrid className="w-3 h-3 text-blue-500" />
                      <span>
                        {isFa
                          ? effectiveCellIndices.length > 1
                            ? `تنظیم ${effectiveCellIndices.length} خانه انتخاب‌شده`
                            : `تنظیم خانه #${primaryCellIdx + 1}`
                          : effectiveCellIndices.length > 1
                          ? `${effectiveCellIndices.length} Cells Selected`
                          : `Cell #${primaryCellIdx + 1} Settings`}
                      </span>
                    </span>

                    {/* Quick batch select cells: All, Odd, Even */}
                    <div className="flex items-center gap-1 text-[10px] font-semibold">
                      <button
                        type="button"
                        onClick={onSelectAllCells}
                        className="px-1.5 py-0.2 rounded hover:bg-blue-600/10 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        title={isFa ? 'انتخاب تمام خانه‌های ماتریس' : 'Select all cells'}
                      >
                        {isFa ? 'همه' : 'All'}
                      </button>
                      <span className="text-neutral-400">·</span>
                      <button
                        type="button"
                        onClick={onSelectOddCells}
                        className="px-1.5 py-0.2 rounded hover:bg-blue-600/10 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        title={isFa ? 'انتخاب خانه‌های فرد' : 'Select odd cells'}
                      >
                        {isFa ? 'فرد' : 'Odd'}
                      </button>
                      <span className="text-neutral-400">·</span>
                      <button
                        type="button"
                        onClick={onSelectEvenCells}
                        className="px-1.5 py-0.2 rounded hover:bg-blue-600/10 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        title={isFa ? 'انتخاب خانه‌های زوج' : 'Select even cells'}
                      >
                        {isFa ? 'زوج' : 'Even'}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Cell Picker Chips with Multi-select */}
                    <div className="flex items-center gap-0.5 overflow-x-auto max-w-[200px] no-scrollbar bg-black/10 dark:bg-neutral-800/80 p-0.5 rounded border border-neutral-300 dark:border-neutral-700">
                      {Array.from({ length: (gridLayout.rows || 1) * (gridLayout.cols || 1) }).map((_, cIdx) => {
                        const isSelected = effectiveCellIndices.includes(cIdx);
                        const hasOver = Boolean(gridLayout.customCellOverrides?.[cIdx]);
                        return (
                          <button
                            key={cIdx}
                            type="button"
                            onClick={(e) => onSelectCell?.(cIdx, e.shiftKey || e.ctrlKey || e.metaKey)}
                            className={`w-5 h-5 rounded text-[10px] font-mono font-bold flex items-center justify-center transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-xs'
                                : hasOver
                                ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
                                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                            }`}
                            title={
                              isFa
                                ? `خانه #${cIdx + 1} (برای انتخاب چندتایی کلیک کنید یا با Shift)`
                                : `Cell #${cIdx + 1} (Click to toggle)`
                            }
                          >
                            {cIdx + 1}
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected Cells Scale Stepper & Toggles */}
                    {(() => {
                      const curOverride = gridLayout.customCellOverrides?.[primaryCellIdx];
                      const curScale = curOverride?.scalePercent ?? gridLayout.cellScalePercent ?? 100;
                      const curRot = curOverride?.rotation ?? 0;
                      const curOffX = curOverride?.offsetXPercent ?? 0;
                      const curOffY = curOverride?.offsetYPercent ?? 0;
                      const isBorder = Boolean(curOverride?.border);
                      const isHidden = Boolean(curOverride?.hidden);
                      const isGray = Boolean(curOverride?.grayscale);

                      return (
                        <div className="flex items-center gap-1">
                          {/* Scale Stepper */}
                          <div className="flex items-center border border-neutral-300 dark:border-neutral-700 rounded-md overflow-hidden bg-white dark:bg-neutral-800">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateCellOverride?.(effectiveCellIndices, {
                                  scalePercent: Math.max(25, curScale - 5),
                                })
                              }
                              className="px-1.5 py-0.5 text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                              title={isFa ? 'کاهش مقیاس خانه‌های انتخابی' : 'Decrease scale'}
                            >
                              -
                            </button>
                            <span className="px-1.5 py-0.5 font-mono text-[11px] font-bold min-w-[38px] text-center">
                              {curScale}%
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateCellOverride?.(effectiveCellIndices, {
                                  scalePercent: Math.min(250, curScale + 5),
                                })
                              }
                              className="px-1.5 py-0.5 text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                              title={isFa ? 'افزایش مقیاس خانه‌های انتخابی' : 'Increase scale'}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateCellOverride?.(effectiveCellIndices, {
                                  scalePercent: 100,
                                })
                              }
                              className="px-1 py-0.5 text-[9px] font-mono border-s border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                            >
                              100%
                            </button>
                          </div>

                          {/* Offset X / Y Steppers */}
                          <div className="flex items-center gap-0.5 border border-neutral-300 dark:border-neutral-700 rounded-md px-1 py-0.5 bg-white dark:bg-neutral-800 text-[10px]">
                            <span className="text-neutral-400 font-bold">X:</span>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateCellOverride?.(effectiveCellIndices, {
                                  offsetXPercent: curOffX - 1,
                                })
                              }
                              className="px-1 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                            >
                              -
                            </button>
                            <span className="font-mono font-bold min-w-[20px] text-center">{curOffX}%</span>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateCellOverride?.(effectiveCellIndices, {
                                  offsetXPercent: curOffX + 1,
                                })
                              }
                              className="px-1 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          <div className="flex items-center gap-0.5 border border-neutral-300 dark:border-neutral-700 rounded-md px-1 py-0.5 bg-white dark:bg-neutral-800 text-[10px]">
                            <span className="text-neutral-400 font-bold">Y:</span>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateCellOverride?.(effectiveCellIndices, {
                                  offsetYPercent: curOffY - 1,
                                })
                              }
                              className="px-1 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                            >
                              -
                            </button>
                            <span className="font-mono font-bold min-w-[20px] text-center">{curOffY}%</span>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateCellOverride?.(effectiveCellIndices, {
                                  offsetYPercent: curOffY + 1,
                                })
                              }
                              className="px-1 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          {/* Rotate Cell */}
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateCellOverride?.(effectiveCellIndices, {
                                rotation: (curRot + 90) % 360,
                              })
                            }
                            className="p-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-blue-600 hover:text-white transition-colors cursor-pointer text-neutral-600 dark:text-neutral-300"
                            title={isFa ? 'چرخش ۹۰ درجه خانه‌های انتخابی' : 'Rotate cells 90 deg'}
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Border Frame */}
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateCellOverride?.(effectiveCellIndices, {
                                border: !isBorder,
                              })
                            }
                            className={`p-1 rounded border transition-colors cursor-pointer ${
                              isBorder
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                            }`}
                            title={isFa ? 'کادر دور خانه‌های انتخابی' : 'Toggle cell border'}
                          >
                            <Square className="w-3.5 h-3.5" />
                          </button>

                          {/* B&W filter */}
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateCellOverride?.(effectiveCellIndices, {
                                grayscale: !isGray,
                              })
                            }
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                              isGray
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                            }`}
                            title={isFa ? 'سیاه‌وسفید کردن خانه‌های انتخابی' : 'Grayscale cells'}
                          >
                            B&W
                          </button>

                          {/* Hide/Show cell */}
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateCellOverride?.(effectiveCellIndices, {
                                hidden: !isHidden,
                              })
                            }
                            className={`p-1 rounded border transition-colors cursor-pointer ${
                              isHidden
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                            }`}
                            title={isFa ? 'مخفی/آشکار کردن خانه‌های انتخابی' : 'Hide/show cells'}
                          >
                            {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>

                          {/* Apply to All */}
                          <button
                            type="button"
                            onClick={() => onApplyCellOverrideToAll?.(primaryCellIdx)}
                            className="px-1.5 py-1 rounded bg-blue-600/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-colors text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                            title={isFa ? 'اعمال تنظیمات این خانه به تمام خانه‌های ماتریس' : 'Apply settings to all cells'}
                          >
                            <Copy className="w-3 h-3" />
                            <span>{isFa ? 'به همه' : 'To All'}</span>
                          </button>

                          {/* Reset Cell */}
                          <button
                            type="button"
                            onClick={() => onResetCellOverride?.(effectiveCellIndices)}
                            className="p-1 rounded text-neutral-400 hover:text-amber-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                            title={isFa ? 'بازنشانی تنظیمات خانه‌های انتخابی' : 'Reset cell overrides'}
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Scaling Option if not in grid */}
              {!gridLayout.enabled && (
                <div className="flex flex-col gap-1 shrink-0">
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                    {isFa ? 'مقیاس برگه' : 'Scaling'}
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={scaling}
                      onChange={(e) => onChangeScaling(e.target.value as any)}
                      className={`px-2 py-1 text-xs rounded-md border font-medium cursor-pointer ${
                        isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-slate-200'
                      }`}
                    >
                      <option value="fit">{isFa ? 'برازش کامل (Fit)' : 'Fit to Printable Area'}</option>
                      <option value="actual">{isFa ? 'اندازه واقعی (100%)' : 'Actual Size (1:1)'}</option>
                      <option value="shrink">{isFa ? 'فقط کوچک‌سازی (Shrink)' : 'Shrink Oversized'}</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: EFFECTS */}
          {activeTab === 'effects' && (
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
              {/* Target Indicator in Grid Mode */}
              {gridLayout.enabled && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 text-xs font-semibold shrink-0">
                  <Sliders className="w-3.5 h-3.5 text-blue-500" />
                  <span>
                    {isFa
                      ? `اعمال بر: خانه #${effectiveCellIndices.map((i) => i + 1).join(', ')}`
                      : `Target: Cell #${effectiveCellIndices.map((i) => i + 1).join(', ')}`}
                  </span>
                </div>
              )}

              {/* Brightness & Contrast Sliders */}
              <div className="flex items-center gap-3 pe-3 border-e border-neutral-300 dark:border-neutral-800 shrink-0">
                <div className="flex flex-col gap-1 w-28">
                  <div className="flex justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-amber-500">
                      <Sun className="w-3 h-3" />
                      {isFa ? 'نور' : 'Light'}
                    </span>
                    <span className="font-mono">{activeAdjustment.brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={180}
                    value={activeAdjustment.brightness}
                    onChange={(e) => onUpdateActiveAdjustment({ brightness: parseInt(e.target.value, 10) })}
                    className="accent-blue-600 cursor-pointer h-1.5"
                  />
                </div>

                <div className="flex flex-col gap-1 w-28">
                  <div className="flex justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-blue-500">
                      <Contrast className="w-3 h-3" />
                      {isFa ? 'کنتراست' : 'Contrast'}
                    </span>
                    <span className="font-mono">{activeAdjustment.contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={200}
                    value={activeAdjustment.contrast}
                    onChange={(e) => onUpdateActiveAdjustment({ contrast: parseInt(e.target.value, 10) })}
                    className="accent-blue-600 cursor-pointer h-1.5"
                  />
                </div>
              </div>

              {/* Color Mode Filters */}
              <div className="flex items-center gap-1.5 pe-3 border-e border-neutral-300 dark:border-neutral-800 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateActiveAdjustment({
                      threshold: !activeAdjustment.threshold,
                      grayscale: false,
                    })
                  }
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    activeAdjustment.threshold
                      ? 'bg-neutral-900 text-white border-neutral-950 font-bold dark:bg-white dark:text-neutral-900'
                      : isDark
                      ? 'border-neutral-700 hover:bg-neutral-800'
                      : 'border-slate-200 hover:bg-slate-200'
                  }`}
                  title={isFa ? 'تبدیل متن به سیاه خالص و پس‌زمینه سفید یکدست' : 'Pure Laser B&W Threshold'}
                >
                  {isFa ? 'سیاه‌سفید خالص (B&W)' : 'Pure B&W'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onUpdateActiveAdjustment({
                      grayscale: !activeAdjustment.grayscale,
                      threshold: false,
                    })
                  }
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    activeAdjustment.grayscale
                      ? 'bg-neutral-600 text-white border-neutral-700 font-bold'
                      : isDark
                      ? 'border-neutral-700 hover:bg-neutral-800'
                      : 'border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {isFa ? 'خاکستری (Gray)' : 'Grayscale'}
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateActiveAdjustment({ invert: !activeAdjustment.invert })}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    activeAdjustment.invert
                      ? 'bg-amber-600 text-white border-amber-700 font-bold'
                      : isDark
                      ? 'border-neutral-700 hover:bg-neutral-800'
                      : 'border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {isFa ? 'معکوس (Invert)' : 'Invert'}
                </button>
              </div>

              {/* Fine Deskew & Rotation */}
              <div className="flex items-center gap-2 pe-3 border-e border-neutral-300 dark:border-neutral-800 shrink-0">
                <div className="flex flex-col gap-1 w-28">
                  <div className="flex justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-emerald-500">
                      <Compass className="w-3 h-3" />
                      {isFa ? 'صاف‌کردن کجی' : 'Deskew'}
                    </span>
                    <span className="font-mono text-[10px]">{activeAdjustment.fineAngle || 0}°</span>
                  </div>
                  <input
                    type="range"
                    min={-20}
                    max={20}
                    step={0.5}
                    value={activeAdjustment.fineAngle || 0}
                    onChange={(e) => onUpdateActiveAdjustment({ fineAngle: parseFloat(e.target.value) })}
                    className="accent-emerald-500 cursor-pointer h-1.5"
                  />
                </div>

                <button
                  type="button"
                  onClick={onRotateCurrent}
                  className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                    isDark ? 'border-neutral-700 hover:bg-neutral-800' : 'border-slate-200 hover:bg-slate-200'
                  }`}
                  title={isFa ? 'چرخش ۹۰ درجه' : 'Rotate 90 deg'}
                >
                  <RotateCw className="w-4 h-4 text-blue-500" />
                </button>
              </div>

              {/* Reset Adjustments */}
              <button
                type="button"
                onClick={onResetAdjustments}
                className="text-xs text-neutral-400 hover:text-neutral-200 p-2 rounded flex items-center gap-1 cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isFa ? 'بازنشانی' : 'Reset'}</span>
              </button>
            </div>
          )}

          {/* TAB 4: INSERT & OVERLAYS */}
          {activeTab === 'insert' && (
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
              {/* Primary Element Add Buttons */}
              <div className="flex items-center gap-1.5 pe-3 border-e border-neutral-300 dark:border-neutral-800 shrink-0">
                <button
                  type="button"
                  onClick={onAddTextOverlay}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all text-xs font-medium cursor-pointer ${
                    activeTool === 'text'
                      ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/30'
                      : 'hover:bg-blue-600/10'
                  }`}
                >
                  <Type className="w-5 h-5 text-blue-500 mb-1" />
                  <span>{isFa ? 'افزودن متن فارسی' : 'Text Overlay'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onAddShapeOverlay()}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all text-xs font-medium cursor-pointer ${
                    activeTool === 'shape'
                      ? 'bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30'
                      : 'hover:bg-emerald-600/10'
                  }`}
                >
                  <Shapes className="w-5 h-5 text-emerald-500 mb-1" />
                  <span>{isFa ? 'اشکال هندسی' : 'Shapes'}</span>
                </button>

                <button
                  type="button"
                  onClick={onAddPageNumbering}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all text-xs font-medium cursor-pointer ${
                    activeTool === 'numbering'
                      ? 'bg-amber-600/15 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30'
                      : 'hover:bg-amber-600/10'
                  }`}
                >
                  <Hash className="w-5 h-5 text-amber-500 mb-1" />
                  <span>{isFa ? 'شماره‌گذاری صفحات' : 'Bates Numbering'}</span>
                </button>
              </div>

              {/* INLINE FORMATTING BAR FOR ACTIVE TEXT (NO FLOATING PANELS!) */}
              {selectedText && (
                <div className="flex items-center gap-2 pe-3 border-e border-neutral-300 dark:border-neutral-800 bg-blue-500/5 dark:bg-blue-500/10 p-1 rounded-xl border border-blue-500/20 shrink-0">
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 ps-1">
                    <Type className="w-3.5 h-3.5" />
                    <span>{isFa ? 'متن انتخابی:' : 'Text:'}</span>
                  </span>

                  {/* Text string input */}
                  <input
                    type="text"
                    value={selectedText.text}
                    onChange={(e) => onUpdateSelectedText?.({ text: e.target.value })}
                    className={`w-32 px-2 py-0.5 text-xs rounded border ${
                      isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                    placeholder={isFa ? 'متن...' : 'Text...'}
                  />

                  {/* Font size stepper */}
                  <div className="flex items-center border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-xs">
                    <button
                      type="button"
                      onClick={() => onUpdateSelectedText?.({ fontSize: Math.max(8, (selectedText.fontSize || 16) - 2) })}
                      className="px-1.5 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 font-bold"
                    >
                      -
                    </button>
                    <span className="font-mono px-1 font-bold">{selectedText.fontSize || 16}px</span>
                    <button
                      type="button"
                      onClick={() => onUpdateSelectedText?.({ fontSize: Math.min(72, (selectedText.fontSize || 16) + 2) })}
                      className="px-1.5 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 font-bold"
                    >
                      +
                    </button>
                  </div>

                  {/* Bold & Italic */}
                  <button
                    type="button"
                    onClick={() => onUpdateSelectedText?.({ bold: !selectedText.bold })}
                    className={`p-1 rounded border text-xs font-bold transition-colors ${
                      selectedText.bold
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                    }`}
                    title={isFa ? 'ضخیم (Bold)' : 'Bold'}
                  >
                    <Bold className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSelectedText?.({ italic: !selectedText.italic })}
                    className={`p-1 rounded border text-xs transition-colors ${
                      selectedText.italic
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                    }`}
                    title={isFa ? 'مورب (Italic)' : 'Italic'}
                  >
                    <Italic className="w-3 h-3" />
                  </button>

                  {/* Color picker */}
                  <input
                    type="color"
                    value={selectedText.color || '#000000'}
                    onChange={(e) => onUpdateSelectedText?.({ color: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                    title={isFa ? 'رنگ متن' : 'Text color'}
                  />

                  {/* Alignment */}
                  <div className="flex items-center border border-neutral-300 dark:border-neutral-700 rounded overflow-hidden">
                    {(['right', 'center', 'left'] as const).map((al) => (
                      <button
                        key={al}
                        type="button"
                        onClick={() => onUpdateSelectedText?.({ align: al })}
                        className={`p-1 text-xs transition-colors ${
                          selectedText.align === al
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }`}
                        title={al}
                      >
                        {al === 'right' ? <AlignRight className="w-3 h-3" /> : al === 'center' ? <AlignCenter className="w-3 h-3" /> : <AlignLeft className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>

                  {/* Delete Text */}
                  <button
                    type="button"
                    onClick={onDeleteSelectedText}
                    className="p-1 rounded text-red-500 hover:bg-red-500/10 cursor-pointer"
                    title={isFa ? 'حذف این متن' : 'Delete text'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* INLINE FORMATTING BAR FOR ACTIVE SHAPE */}
              {selectedShape && (
                <div className="flex items-center gap-2 pe-3 border-e border-neutral-300 dark:border-neutral-800 bg-emerald-500/5 dark:bg-emerald-500/10 p-1 rounded-xl border border-emerald-500/20 shrink-0">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 ps-1">
                    <Shapes className="w-3.5 h-3.5" />
                    <span>{isFa ? 'کادر انتخابی:' : 'Shape:'}</span>
                  </span>

                  {/* Shape Type */}
                  <select
                    value={selectedShape.type}
                    onChange={(e) => onUpdateSelectedShape?.({ type: e.target.value as any })}
                    className={`px-1.5 py-0.5 text-xs rounded border ${
                      isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-slate-300'
                    }`}
                  >
                    <option value="rectangle">{isFa ? 'مستطیل' : 'Rectangle'}</option>
                    <option value="rounded">{isFa ? 'گوشه گرد' : 'Rounded'}</option>
                    <option value="circle">{isFa ? 'دایره / بیضی' : 'Circle'}</option>
                  </select>

                  {/* Border Width */}
                  <div className="flex items-center border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-xs">
                    <span className="px-1 text-[10px] text-neutral-400">{isFa ? 'ضخامت:' : 'Width:'}</span>
                    <button
                      type="button"
                      onClick={() => onUpdateSelectedShape?.({ strokeWidth: Math.max(1, (selectedShape.strokeWidth || 2) - 1) })}
                      className="px-1.5 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 font-bold"
                    >
                      -
                    </button>
                    <span className="font-mono px-1 font-bold">{selectedShape.strokeWidth || 2}px</span>
                    <button
                      type="button"
                      onClick={() => onUpdateSelectedShape?.({ strokeWidth: Math.min(20, (selectedShape.strokeWidth || 2) + 1) })}
                      className="px-1.5 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 font-bold"
                    >
                      +
                    </button>
                  </div>

                  {/* Stroke color */}
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-neutral-400">{isFa ? 'خط:' : 'Stroke:'}</span>
                    <input
                      type="color"
                      value={selectedShape.strokeColor || '#2563eb'}
                      onChange={(e) => onUpdateSelectedShape?.({ strokeColor: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                    />
                  </div>

                  {/* Fill color */}
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-neutral-400">{isFa ? 'پر:' : 'Fill:'}</span>
                    <input
                      type="color"
                      value={selectedShape.fillColor === 'transparent' ? '#ffffff' : selectedShape.fillColor}
                      onChange={(e) => onUpdateSelectedShape?.({ fillColor: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                    />
                  </div>

                  {/* Delete Shape */}
                  <button
                    type="button"
                    onClick={onDeleteSelectedShape}
                    className="p-1 rounded text-red-500 hover:bg-red-500/10 cursor-pointer"
                    title={isFa ? 'حذف این شکل' : 'Delete shape'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* INLINE FORMATTING BAR FOR NUMBERING */}
              {pageNumbering?.enabled && (
                <div className="flex items-center gap-2 pe-3 border-e border-neutral-300 dark:border-neutral-800 bg-amber-500/5 dark:bg-amber-500/10 p-1 rounded-xl border border-amber-500/20 shrink-0">
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 ps-1">
                    <Hash className="w-3.5 h-3.5" />
                    <span>{isFa ? 'تنظیم شماره‌زن:' : 'Numbering:'}</span>
                  </span>

                  <select
                    value={pageNumbering.format}
                    onChange={(e) => onUpdatePageNumbering?.({ format: e.target.value as any })}
                    className={`px-1.5 py-0.5 text-xs rounded border ${
                      isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-slate-300'
                    }`}
                  >
                    <option value="persian">{isFa ? 'اعداد فارسی (۱، ۲، ۳)' : 'Persian (1, 2, 3)'}</option>
                    <option value="english">{isFa ? 'اعداد انگلیسی (1, 2, 3)' : 'English (1, 2, 3)'}</option>
                  </select>

                  <input
                    type="text"
                    value={pageNumbering.template}
                    onChange={(e) => onUpdatePageNumbering?.({ template: e.target.value })}
                    className={`w-32 px-1.5 py-0.5 text-xs rounded border ${
                      isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                    title={isFa ? 'قالب: از {page} و {total} استفاده کنید' : 'Template'}
                  />

                  <div className="flex items-center border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-xs">
                    <button
                      type="button"
                      onClick={() => onUpdatePageNumbering?.({ fontSize: Math.max(8, (pageNumbering.fontSize || 12) - 1) })}
                      className="px-1.5 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 font-bold"
                    >
                      -
                    </button>
                    <span className="font-mono px-1 font-bold">{pageNumbering.fontSize || 12}px</span>
                    <button
                      type="button"
                      onClick={() => onUpdatePageNumbering?.({ fontSize: Math.min(36, (pageNumbering.fontSize || 12) + 1) })}
                      className="px-1.5 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 font-bold"
                    >
                      +
                    </button>
                  </div>

                  <input
                    type="color"
                    value={pageNumbering.color || '#333333'}
                    onChange={(e) => onUpdatePageNumbering?.({ color: e.target.value })}
                    className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                  />

                  <button
                    type="button"
                    onClick={() => onUpdatePageNumbering?.({ enabled: false })}
                    className="p-1 rounded text-red-500 hover:bg-red-500/10 cursor-pointer"
                    title={isFa ? 'غیرفعال‌سازی شماره‌زن' : 'Disable numbering'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Tools: Cut Marks, Measure Tool, Live Canvas */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={onToggleCutMarks}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all text-xs font-medium cursor-pointer ${
                    showCutMarks
                      ? 'bg-purple-600/15 text-purple-500 font-bold border border-purple-500/30'
                      : 'hover:bg-purple-600/10 text-neutral-400'
                  }`}
                >
                  <Scissors className="w-5 h-5 mb-1" />
                  <span>{isFa ? 'نشانه‌های برش (Cut)' : 'Cut Marks'}</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleMeasureTool}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all text-xs font-medium cursor-pointer ${
                    showMeasureTool
                      ? 'bg-blue-600/15 text-blue-500 font-bold border border-blue-500/30'
                      : 'hover:bg-blue-600/10 text-neutral-400'
                  }`}
                >
                  <Ruler className="w-5 h-5 mb-1" />
                  <span>{isFa ? 'ابزار خط‌کش و زاویه' : 'Measure Tool'}</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenPageStudio}
                  className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-neutral-700/20 active:scale-95 transition-all text-xs font-medium cursor-pointer"
                >
                  <Maximize2 className="w-5 h-5 text-indigo-400 mb-1" />
                  <span>{isFa ? 'بوم زنده صفحه' : 'Live Canvas'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: CROP - COMPLETE IN-RIBBON RESPONSIVE SUITE */}
          {activeTab === 'crop' && (
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
              {/* Target Indicator */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 text-xs font-semibold shrink-0">
                <Scissors className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-bold">
                  {gridLayout.enabled && effectiveCellIndices.length > 0
                    ? isFa
                      ? `هدف: خانه #${effectiveCellIndices.map((i) => i + 1).join(', ')}`
                      : `Cell #${effectiveCellIndices.map((i) => i + 1).join(', ')}`
                    : isFa
                    ? `هدف: ${selectedPagesCount > 0 ? `${selectedPagesCount} برگه انتخابی` : 'برگه جاری'}`
                    : 'Target: Selected Pages'}
                </span>
              </div>

              {/* Interactive Crop Toggle */}
              <button
                type="button"
                onClick={onToggleInteractiveCrop}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold cursor-pointer shrink-0 ${
                  activeTool === 'crop'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200'
                }`}
              >
                <Scissors className="w-4 h-4" />
                <span>{isFa ? 'کادر برش تعاملی' : 'Interactive Crop Box'}</span>
              </button>

              {/* Done / Confirm and back to move tool */}
              {activeTool === 'crop' && (
                <button
                  type="button"
                  onClick={() => {
                    if (onCloseCrop) onCloseCrop();
                    else onSelectTool?.('move');
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all text-xs font-bold cursor-pointer shadow-xs shrink-0"
                  title={isFa ? 'تایید برش و بازگشت به ابزار جابجایی' : 'Done and return to move'}
                >
                  <Check className="w-4 h-4" />
                  <span>{isFa ? 'تایید و بستن' : 'Done & Close'}</span>
                </button>
              )}

              <div className="h-6 w-px bg-neutral-300 dark:bg-neutral-800 shrink-0" />

              {/* Quick Scanner Border Trim (5%) */}
              <button
                type="button"
                onClick={onTrimScannerBorders}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-amber-600/10 active:scale-95 transition-all text-xs font-medium border border-neutral-300 dark:border-neutral-700 cursor-pointer shrink-0"
                title={isFa ? 'حذف اتوماتیک ۵٪ حاشیه دور کاغذ برای رفع سایه اسکنر' : 'Trim 5% scanner borders'}
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{isFa ? 'حذف حاشیه اسکنر (۵٪)' : 'Trim Borders (5%)'}</span>
              </button>

              {/* Reset Crop */}
              <button
                type="button"
                onClick={onResetCrop}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 active:scale-95 transition-all text-xs font-medium text-neutral-500 hover:text-red-500 border border-neutral-300 dark:border-neutral-700 cursor-pointer shrink-0"
                title={isFa ? 'بازنشانی کادر برش به حالت اولیه' : 'Reset crop'}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isFa ? 'ریست برش' : 'Reset Crop'}</span>
              </button>

              <div className="h-6 w-px bg-neutral-300 dark:bg-neutral-800 shrink-0" />

              {/* Precision Numerical Crop Margins */}
              {(() => {
                const currentCrop = activeCrop || activeAdjustment.crop || { top: 0, bottom: 0, left: 0, right: 0 };
                const updateCrop = (updates: Partial<{ top: number; bottom: number; left: number; right: number }>) => {
                  const nextCrop = {
                    top: Math.max(0, Math.min(45, updates.top ?? currentCrop.top)),
                    bottom: Math.max(0, Math.min(45, updates.bottom ?? currentCrop.bottom)),
                    left: Math.max(0, Math.min(45, updates.left ?? currentCrop.left)),
                    right: Math.max(0, Math.min(45, updates.right ?? currentCrop.right)),
                  };
                  if (onChangeCrop) {
                    onChangeCrop(nextCrop);
                  } else {
                    onUpdateActiveAdjustment({ crop: nextCrop });
                  }
                };

                return (
                  <div className="flex items-center gap-2 text-xs shrink-0">
                    <span className="text-[11px] font-semibold text-neutral-400">
                      {isFa ? 'برش عددی:' : 'Numeric Crop:'}
                    </span>

                    {/* Top */}
                    <div className="flex items-center gap-0.5 border border-neutral-300 dark:border-neutral-700 rounded px-1 py-0.5 bg-white dark:bg-neutral-800">
                      <span className="text-[10px] text-neutral-400 font-bold">{isFa ? 'بالا:' : 'T:'}</span>
                      <button
                        type="button"
                        onClick={() => updateCrop({ top: Math.max(0, currentCrop.top - 1) })}
                        className="px-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono text-[11px] font-bold min-w-[28px] text-center">{currentCrop.top}%</span>
                      <button
                        type="button"
                        onClick={() => updateCrop({ top: Math.min(45, currentCrop.top + 1) })}
                        className="px-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    {/* Bottom */}
                    <div className="flex items-center gap-0.5 border border-neutral-300 dark:border-neutral-700 rounded px-1 py-0.5 bg-white dark:bg-neutral-800">
                      <span className="text-[10px] text-neutral-400 font-bold">{isFa ? 'پایین:' : 'B:'}</span>
                      <button
                        type="button"
                        onClick={() => updateCrop({ bottom: Math.max(0, currentCrop.bottom - 1) })}
                        className="px-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono text-[11px] font-bold min-w-[28px] text-center">{currentCrop.bottom}%</span>
                      <button
                        type="button"
                        onClick={() => updateCrop({ bottom: Math.min(45, currentCrop.bottom + 1) })}
                        className="px-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    {/* Right */}
                    <div className="flex items-center gap-0.5 border border-neutral-300 dark:border-neutral-700 rounded px-1 py-0.5 bg-white dark:bg-neutral-800">
                      <span className="text-[10px] text-neutral-400 font-bold">{isFa ? 'راست:' : 'R:'}</span>
                      <button
                        type="button"
                        onClick={() => updateCrop({ right: Math.max(0, currentCrop.right - 1) })}
                        className="px-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono text-[11px] font-bold min-w-[28px] text-center">{currentCrop.right}%</span>
                      <button
                        type="button"
                        onClick={() => updateCrop({ right: Math.min(45, currentCrop.right + 1) })}
                        className="px-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    {/* Left */}
                    <div className="flex items-center gap-0.5 border border-neutral-300 dark:border-neutral-700 rounded px-1 py-0.5 bg-white dark:bg-neutral-800">
                      <span className="text-[10px] text-neutral-400 font-bold">{isFa ? 'چپ:' : 'L:'}</span>
                      <button
                        type="button"
                        onClick={() => updateCrop({ left: Math.max(0, currentCrop.left - 1) })}
                        className="px-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono text-[11px] font-bold min-w-[28px] text-center">{currentCrop.left}%</span>
                      <button
                        type="button"
                        onClick={() => updateCrop({ left: Math.min(45, currentCrop.left + 1) })}
                        className="px-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1 ms-1">
                      {[0, 2, 5, 10].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => updateCrop({ top: pct, bottom: pct, left: pct, right: pct })}
                          className="px-1.5 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 text-[10px] font-mono hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer"
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 6: TOOLS / PDF */}
          {activeTab === 'tools' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenMergeModal}
                disabled={!hasFiles}
                className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all text-xs font-medium ${
                  hasFiles
                    ? 'hover:bg-blue-600/10 text-blue-500 cursor-pointer active:scale-95'
                    : 'opacity-40 cursor-not-allowed text-neutral-400'
                }`}
              >
                <FileCheck className="w-5 h-5 mb-1" />
                <span>{isFa ? 'ادغام PDF با بوک‌مارک' : 'Merge with Bookmarks'}</span>
              </button>

              <button
                type="button"
                onClick={onOpenImageToPdf}
                className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-emerald-600/10 active:scale-95 transition-all text-xs font-medium cursor-pointer"
              >
                <ImageIcon className="w-5 h-5 text-emerald-500 mb-1" />
                <span>{isFa ? 'تبدیل عکس به PDF' : 'Image to PDF'}</span>
              </button>
            </div>
          )}

          {/* TAB 7: VIEW */}
          {activeTab === 'view' && (
            <div className="flex items-center gap-3">
              {/* View Modes */}
              <div className="flex flex-col gap-1 pe-3 border-e border-neutral-300 dark:border-neutral-800">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                  {isFa ? 'حالت نمایش' : 'View Mode'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onChangeViewMode('sheet')}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                      viewMode === 'sheet'
                        ? 'bg-blue-600 text-white font-bold border-blue-600'
                        : isDark
                        ? 'border-neutral-700 hover:bg-neutral-800'
                        : 'border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {isFa ? 'پیش‌نمایش شیت (WYSIWYG)' : 'Sheet Preview'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeViewMode('cards')}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                      viewMode === 'cards'
                        ? 'bg-blue-600 text-white font-bold border-blue-600'
                        : isDark
                        ? 'border-neutral-700 hover:bg-neutral-800'
                        : 'border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {isFa ? 'کارت‌های اسناد' : 'Document Cards'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeViewMode('table')}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                      viewMode === 'table'
                        ? 'bg-blue-600 text-white font-bold border-blue-600'
                        : isDark
                        ? 'border-neutral-700 hover:bg-neutral-800'
                        : 'border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {isFa ? 'جدول فشرده' : 'Compact Table'}
                  </button>
                </div>
              </div>

              {/* Zoom Controls */}
              <div className="flex flex-col gap-1 pe-3 border-e border-neutral-300 dark:border-neutral-800">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                  {isFa ? 'بزرگ‌نمایی' : 'Zoom'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChangeZoom(Math.max(0.4, zoomLevel - 0.1))}
                    className="p-1 rounded border border-neutral-700 hover:bg-neutral-800 cursor-pointer"
                    title={isFa ? 'کوچک‌نمایی (-)' : 'Zoom Out'}
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-xs w-10 text-center font-bold">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => onChangeZoom(Math.min(1.8, zoomLevel + 0.1))}
                    className="p-1 rounded border border-neutral-700 hover:bg-neutral-800 cursor-pointer"
                    title={isFa ? 'بزرگ‌نمایی (+)' : 'Zoom In'}
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeZoom(1.0)}
                    className="px-2 py-0.5 text-xs rounded border border-neutral-700 hover:bg-neutral-800 font-mono"
                  >
                    100%
                  </button>
                </div>
              </div>

              {/* Rulers & Margins toggles */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showRulers}
                    onChange={onToggleRulers}
                    className="rounded accent-blue-600 cursor-pointer"
                  />
                  <span>{isFa ? 'خط‌کش‌ها (Rulers)' : 'Rulers'}</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showMargins}
                    onChange={onToggleMargins}
                    className="rounded accent-blue-600 cursor-pointer"
                  />
                  <span>{isFa ? 'حاشیه‌های امن' : 'Margin Guides'}</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
