import React, { useState } from 'react';
import {
  GridLayoutSettings,
  CustomCellOverride,
  GridFlowOrder,
} from '../types';
import {
  RotateCw,
  Sun,
  Contrast,
  Sliders,
  Sparkles,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Square,
  X,
  Check,
  LayoutGrid,
  Grid,
  Scissors,
  Repeat,
  Layers,
  ArrowDownUp,
  ArrowLeftRight,
} from 'lucide-react';

interface MatrixCellControlsProps {
  gridLayout: GridLayoutSettings;
  selectedCellIdx: number;
  totalCells: number;
  isDark: boolean;
  isFa: boolean;
  onSelectCell: (idx: number) => void;
  onUpdateCellOverride: (cellIdx: number, updates: Partial<CustomCellOverride>) => void;
  onResetCellOverride: (cellIdx: number) => void;
  onApplyCellOverrideToAll: (cellIdx: number) => void;
  onChangeGridLayout?: (updates: Partial<GridLayoutSettings>) => void;
  onClose: () => void;
}

export const MatrixCellControls: React.FC<MatrixCellControlsProps> = ({
  gridLayout,
  selectedCellIdx,
  totalCells,
  isDark,
  isFa,
  onSelectCell,
  onUpdateCellOverride,
  onResetCellOverride,
  onApplyCellOverrideToAll,
  onChangeGridLayout,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'cell'>('cell');
  const currentOverrides = gridLayout.customCellOverrides || {};
  const currentOverride: CustomCellOverride = currentOverrides[selectedCellIdx] || {
    offsetXPercent: gridLayout.offsetXPercent || 0,
    offsetYPercent: gridLayout.offsetYPercent || 0,
    scalePercent: gridLayout.cellScalePercent || 100,
    rotation: 0,
    fineAngle: 0,
    brightness: 100,
    contrast: 100,
    grayscale: false,
    threshold: false,
    invert: false,
    crop: { top: 0, bottom: 0, left: 0, right: 0 },
    border: false,
    hidden: false,
  };

  const rows = gridLayout.rows || 1;
  const cols = gridLayout.cols || 1;

  return (
    <div
      className={`absolute bottom-3 start-1/2 -translate-x-1/2 w-[96%] max-w-3xl p-3.5 rounded-2xl border shadow-2xl z-40 backdrop-blur-md transition-all text-xs select-none ${
        isDark
          ? 'bg-neutral-900/95 border-neutral-750 text-neutral-100'
          : 'bg-white/95 border-slate-300 text-slate-900 shadow-xl'
      }`}
    >
      {/* Header: Mode Tabs, Cell Switcher, Close */}
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          {/* Tabs: Matrix Layout vs Individual Cell */}
          <div className="flex items-center bg-black/10 dark:bg-neutral-800 p-0.5 rounded-xl border border-neutral-300 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => setActiveTab('cell')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'cell'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isFa ? `تنظیم خانه #${selectedCellIdx + 1}` : `Cell #${selectedCellIdx + 1}`}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'matrix'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{isFa ? `ساختار ماتریس (${rows}×${cols})` : `Matrix Grid (${rows}×${cols})`}</span>
            </button>
          </div>

          {/* Quick Cell Selector in Cell tab */}
          {activeTab === 'cell' && (
            <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] sm:max-w-xs no-scrollbar ms-1">
              {Array.from({ length: totalCells }).map((_, idx) => {
                const isSelected = idx === selectedCellIdx;
                const hasOverride = Boolean(currentOverrides[idx]);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectCell(idx)}
                    className={`w-5 h-5 rounded-md text-[10px] font-mono font-bold flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : hasOverride
                        ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
                        : isDark
                        ? 'bg-neutral-800 text-neutral-400 hover:text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title={isFa ? `انتخاب خانه ${idx + 1}` : `Select cell ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {activeTab === 'cell' && (
            <>
              <button
                type="button"
                onClick={() => onApplyCellOverrideToAll(selectedCellIdx)}
                className="px-2 py-1 rounded-lg bg-blue-600/15 text-blue-500 hover:bg-blue-600 hover:text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title={isFa ? 'اعمال تنظیمات این خانه به تمام خانه‌های ماتریس' : 'Apply to all cells'}
              >
                <Copy className="w-3 h-3" />
                <span>{isFa ? 'اعمال به همه' : 'Apply All'}</span>
              </button>

              <button
                type="button"
                onClick={() => onResetCellOverride(selectedCellIdx)}
                className="p-1 rounded text-neutral-400 hover:text-amber-500 cursor-pointer"
                title={isFa ? 'ریست تنظیمات این خانه' : 'Reset this cell'}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-white cursor-pointer"
            title={isFa ? 'بستن پنل' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TAB 1: INDIVIDUAL CELL CONTROLS */}
      {activeTab === 'cell' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Scale */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] text-neutral-400">
              <span>{isFa ? 'مقیاس سلول:' : 'Scale:'}</span>
              <span className="font-mono font-bold">{currentOverride.scalePercent || 100}%</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  onUpdateCellOverride(selectedCellIdx, {
                    scalePercent: Math.max(30, (currentOverride.scalePercent || 100) - 5),
                  })
                }
                className="w-6 h-6 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-blue-600 hover:text-white font-bold flex items-center justify-center cursor-pointer"
              >
                -
              </button>
              <input
                type="range"
                min={30}
                max={200}
                value={currentOverride.scalePercent || 100}
                onChange={(e) =>
                  onUpdateCellOverride(selectedCellIdx, {
                    scalePercent: parseInt(e.target.value, 10),
                  })
                }
                className="flex-1 accent-blue-600"
              />
              <button
                type="button"
                onClick={() =>
                  onUpdateCellOverride(selectedCellIdx, {
                    scalePercent: Math.min(200, (currentOverride.scalePercent || 100) + 5),
                  })
                }
                className="w-6 h-6 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-blue-600 hover:text-white font-bold flex items-center justify-center cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Offset X & Y */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] text-neutral-400">
              <span>{isFa ? 'جابجایی (افقی/عمودی):' : 'Offset (X, Y):'}</span>
              <span className="font-mono font-bold">
                {currentOverride.offsetXPercent || 0}%, {currentOverride.offsetYPercent || 0}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <input
                type="range"
                min={-50}
                max={50}
                value={currentOverride.offsetXPercent || 0}
                onChange={(e) =>
                  onUpdateCellOverride(selectedCellIdx, {
                    offsetXPercent: parseInt(e.target.value, 10),
                  })
                }
                className="accent-blue-600"
                title="X Offset"
              />
              <input
                type="range"
                min={-50}
                max={50}
                value={currentOverride.offsetYPercent || 0}
                onChange={(e) =>
                  onUpdateCellOverride(selectedCellIdx, {
                    offsetYPercent: parseInt(e.target.value, 10),
                  })
                }
                className="accent-blue-600"
                title="Y Offset"
              />
            </div>
          </div>

          {/* Rotation & Deskew */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] text-neutral-400">
              <span>{isFa ? 'چرخش:' : 'Rotation:'}</span>
              <span className="font-mono font-bold">
                {(currentOverride.rotation || 0) + (currentOverride.fineAngle || 0)}°
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const cur = currentOverride.rotation || 0;
                  onUpdateCellOverride(selectedCellIdx, { rotation: (cur + 90) % 360 });
                }}
                className="flex-1 py-1 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-blue-600 hover:text-white flex items-center justify-center gap-1 font-semibold text-[10px] cursor-pointer"
              >
                <RotateCw className="w-3 h-3 text-blue-500" />
                <span>۹۰°</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateCellOverride(selectedCellIdx, {
                    fineAngle: Math.max(-15, (currentOverride.fineAngle || 0) - 0.5),
                  })
                }
                className="px-1.5 py-1 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-blue-600 hover:text-white font-mono text-[10px] cursor-pointer"
                title="-0.5° Deskew"
              >
                -
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateCellOverride(selectedCellIdx, {
                    fineAngle: Math.min(15, (currentOverride.fineAngle || 0) + 0.5),
                  })
                }
                className="px-1.5 py-1 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-blue-600 hover:text-white font-mono text-[10px] cursor-pointer"
                title="+0.5° Deskew"
              >
                +
              </button>
            </div>
          </div>

          {/* Filters, Border & Visibility */}
          <div className="space-y-1">
            <span className="text-[10px] text-neutral-400 block">{isFa ? 'جلوه‌ها و نمایش:' : 'Effects & Visibility:'}</span>
            <div className="flex items-center gap-1">
              {/* Grayscale */}
              <button
                type="button"
                onClick={() =>
                  onUpdateCellOverride(selectedCellIdx, { grayscale: !currentOverride.grayscale })
                }
                className={`p-1.5 rounded flex-1 flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors ${
                  currentOverride.grayscale
                    ? 'bg-purple-600 text-white'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400'
                }`}
                title={isFa ? 'سیاه‌سفید' : 'Grayscale'}
              >
                {isFa ? 'B&W' : 'B&W'}
              </button>

              {/* Cell Border Frame */}
              <button
                type="button"
                onClick={() =>
                  onUpdateCellOverride(selectedCellIdx, { border: !currentOverride.border })
                }
                className={`p-1.5 rounded flex-1 flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors ${
                  currentOverride.border
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400'
                }`}
                title={isFa ? 'کادر دور خانه' : 'Border'}
              >
                <Square className="w-3.5 h-3.5" />
              </button>

              {/* Hide / Show Cell */}
              <button
                type="button"
                onClick={() =>
                  onUpdateCellOverride(selectedCellIdx, { hidden: !currentOverride.hidden })
                }
                className={`p-1.5 rounded flex-1 flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors ${
                  currentOverride.hidden
                    ? 'bg-rose-600 text-white'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400'
                }`}
                title={isFa ? 'مخفی کردن این خانه' : 'Hide this cell'}
              >
                {currentOverride.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MATRIX GRID STRUCTURE & SHEET IMPOSITION */}
      {activeTab === 'matrix' && onChangeGridLayout && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Rows & Cols */}
          <div className="space-y-1">
            <span className="text-[10px] text-neutral-400 font-semibold">{isFa ? 'تعداد ردیف و ستون:' : 'Rows & Cols:'}</span>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 flex items-center gap-1 bg-black/10 dark:bg-neutral-800 p-1 rounded-lg border border-neutral-300 dark:border-neutral-700">
                <span className="text-[10px] text-neutral-400">{isFa ? 'ردیف:' : 'R:'}</span>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={rows}
                  onChange={(e) =>
                    onChangeGridLayout({ rows: Math.max(1, Math.min(8, parseInt(e.target.value, 10) || 1)) })
                  }
                  className="w-full text-center font-mono font-bold text-xs bg-transparent focus:outline-none"
                />
              </div>
              <span className="font-bold text-neutral-500">×</span>
              <div className="flex-1 flex items-center gap-1 bg-black/10 dark:bg-neutral-800 p-1 rounded-lg border border-neutral-300 dark:border-neutral-700">
                <span className="text-[10px] text-neutral-400">{isFa ? 'ستون:' : 'C:'}</span>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={cols}
                  onChange={(e) =>
                    onChangeGridLayout({ cols: Math.max(1, Math.min(8, parseInt(e.target.value, 10) || 1)) })
                  }
                  className="w-full text-center font-mono font-bold text-xs bg-transparent focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Gaps (Spacings) */}
          <div className="space-y-1">
            <span className="text-[10px] text-neutral-400 font-semibold">{isFa ? 'فاصله بین خانه‌ها (mm):' : 'Gaps (mm):'}</span>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 flex items-center gap-1 bg-black/10 dark:bg-neutral-800 p-1 rounded-lg border border-neutral-300 dark:border-neutral-700">
                <span className="text-[10px] text-neutral-400">{isFa ? 'افقی:' : 'H:'}</span>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={gridLayout.horizontalGapMm || 0}
                  onChange={(e) =>
                    onChangeGridLayout({ horizontalGapMm: Math.max(0, parseInt(e.target.value, 10) || 0) })
                  }
                  className="w-full text-center font-mono font-bold text-xs bg-transparent focus:outline-none"
                />
              </div>
              <div className="flex-1 flex items-center gap-1 bg-black/10 dark:bg-neutral-800 p-1 rounded-lg border border-neutral-300 dark:border-neutral-700">
                <span className="text-[10px] text-neutral-400">{isFa ? 'عمودی:' : 'V:'}</span>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={gridLayout.verticalGapMm || 0}
                  onChange={(e) =>
                    onChangeGridLayout({ verticalGapMm: Math.max(0, parseInt(e.target.value, 10) || 0) })
                  }
                  className="w-full text-center font-mono font-bold text-xs bg-transparent focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Imposition Order */}
          <div className="space-y-1">
            <span className="text-[10px] text-neutral-400 font-semibold">{isFa ? 'ترتیب چیدمان صفحات:' : 'Page Order:'}</span>
            <select
              value={gridLayout.order || 'rtl-rows'}
              onChange={(e) => onChangeGridLayout({ order: e.target.value as GridFlowOrder })}
              className={`w-full p-1 text-[11px] font-semibold rounded-lg border cursor-pointer focus:outline-none ${
                isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-slate-300 text-slate-800'
              }`}
            >
              <option value="rtl-rows">{isFa ? 'سطری راست به چپ (فارسی)' : 'RTL Row-first'}</option>
              <option value="ltr-rows">{isFa ? 'سطری چپ به راست (انگلیسی)' : 'LTR Row-first'}</option>
              <option value="rtl-cols">{isFa ? 'ستونی راست به چپ' : 'RTL Column-first'}</option>
              <option value="ltr-cols">{isFa ? 'ستونی چپ به راست' : 'LTR Column-first'}</option>
            </select>
          </div>

          {/* Repeat & Cut Marks Toggles */}
          <div className="space-y-1">
            <span className="text-[10px] text-neutral-400 font-semibold">{isFa ? 'تنظیمات برگه و برش:' : 'Sheet & Marks:'}</span>
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={Boolean(gridLayout.repeatPage)}
                  onChange={(e) => onChangeGridLayout({ repeatPage: e.target.checked })}
                  className="rounded accent-purple-600"
                />
                <span className="font-semibold">{isFa ? 'تکرار یک برگه در تمام خانه‌ها' : 'Repeat Single Page'}</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={Boolean(gridLayout.showCutMarks)}
                  onChange={(e) => onChangeGridLayout({ showCutMarks: e.target.checked })}
                  className="rounded accent-purple-600"
                />
                <span>{isFa ? 'خطوط برش گیوتین' : 'Cut Marks'}</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
