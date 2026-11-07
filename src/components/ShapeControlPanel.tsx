import React from 'react';
import {
  Shapes,
  Plus,
  Trash2,
  Sparkles,
  Link2,
  Square,
  Circle,
  ArrowRight,
  Star,
  Minus,
  Triangle,
  Hexagon,
  Diamond,
} from 'lucide-react';
import { PageOverlayShape, ShapeType, OverlayTargetScope } from '../types';

interface ShapeControlPanelProps {
  shapes: PageOverlayShape[];
  selectedShapeId: string | null;
  theme: 'dark' | 'light';
  onSelectShape: (id: string | null) => void;
  onAddShape: (type: ShapeType) => void;
  onUpdateShape: (id: string, updates: Partial<PageOverlayShape>) => void;
  onDeleteShape: (id: string) => void;
  onApplyShapeToAllPages: (shapeId: string) => void;
  onApplyShapeToSelectedPages: (shapeId: string) => void;
}

export const ShapeControlPanel: React.FC<ShapeControlPanelProps> = ({
  shapes,
  selectedShapeId,
  theme,
  onSelectShape,
  onAddShape,
  onUpdateShape,
  onDeleteShape,
  onApplyShapeToAllPages,
  onApplyShapeToSelectedPages,
}) => {
  const isDark = theme === 'dark';
  const selectedShape = shapes.find((s) => s.id === selectedShapeId);

  return (
    <div className="space-y-4 text-xs">
      {/* Header with Quick Shape Adders */}
      <div className="space-y-2">
        <span className="font-bold flex items-center gap-1.5 text-xs">
          <Shapes className="w-4 h-4 text-purple-500" />
          <span>اشکال هندسی ({shapes.length})</span>
        </span>

        {/* Quick Geometric Shapes Grid */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { type: 'rectangle' as ShapeType, label: 'مستطیل', icon: Square },
            { type: 'rounded-rect' as ShapeType, label: 'گوشه‌گرد', icon: Square },
            { type: 'circle' as ShapeType, label: 'دایره / بیضی', icon: Circle },
            { type: 'line' as ShapeType, label: 'خط راست', icon: Minus },
            { type: 'triangle' as ShapeType, label: 'مثلث', icon: Triangle },
            { type: 'polygon' as ShapeType, label: 'شش‌ضلعی', icon: Hexagon },
            { type: 'star' as ShapeType, label: 'ستاره', icon: Star },
            { type: 'diamond' as ShapeType, label: 'لوزی', icon: Diamond },
            { type: 'arrow' as ShapeType, label: 'فلش / پیکان', icon: ArrowRight },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => onAddShape(item.type)}
                className={`p-2 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  isDark
                    ? 'bg-neutral-900 hover:bg-neutral-800 border-neutral-750 text-neutral-300'
                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-xs'
                }`}
                title={`افزودن ${item.label}`}
              >
                <Icon className="w-4 h-4 text-purple-500" />
                <span className="font-bold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Shapes List */}
      {shapes.length > 0 && (
        <div className="flex flex-wrap gap-1 p-1 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950">
          {shapes.map((s, idx) => {
            const isSel = s.id === selectedShapeId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectShape(s.id)}
                className={`px-2 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                  isSel
                    ? 'bg-purple-600 text-white font-bold shadow-xs'
                    : isDark
                    ? 'bg-neutral-900 text-neutral-300 hover:text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                شکل #{idx + 1} ({s.type})
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Shape Properties */}
      {selectedShape ? (
        <div
          className={`p-3 rounded-xl border space-y-3 ${
            isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          {/* Colors (Fill & Stroke) */}
          <div className="grid grid-cols-2 gap-2">
            {/* Fill Color */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px] text-neutral-400">
                <span>رنگ داخل:</span>
                <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!selectedShape.fillColor || selectedShape.fillColor === 'transparent'}
                    onChange={(e) =>
                      onUpdateShape(selectedShape.id, {
                        fillColor: e.target.checked ? 'transparent' : '#3b82f6',
                      })
                    }
                    className="accent-blue-600"
                  />
                  <span>بی‌رنگ</span>
                </label>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  disabled={!selectedShape.fillColor || selectedShape.fillColor === 'transparent'}
                  value={
                    selectedShape.fillColor && selectedShape.fillColor !== 'transparent'
                      ? selectedShape.fillColor
                      : '#3b82f6'
                  }
                  onChange={(e) => onUpdateShape(selectedShape.id, { fillColor: e.target.value })}
                  className="w-8 h-8 rounded border border-neutral-700 cursor-pointer p-0.5 bg-transparent disabled:opacity-30"
                />
                <span className="font-mono text-xs truncate">{selectedShape.fillColor || 'بی‌رنگ'}</span>
              </div>
            </div>

            {/* Stroke Color */}
            <div className="space-y-1">
              <label className="text-neutral-400 block text-[11px]">رنگ خط دور:</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={selectedShape.strokeColor || '#000000'}
                  onChange={(e) => onUpdateShape(selectedShape.id, { strokeColor: e.target.value })}
                  className="w-8 h-8 rounded border border-neutral-700 cursor-pointer p-0.5 bg-transparent"
                />
                <span className="font-mono text-xs">{selectedShape.strokeColor || '#000000'}</span>
              </div>
            </div>
          </div>

          {/* Stroke Width & Style */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-400">
                <span>ضخامت خط:</span>
                <span className="font-mono">{selectedShape.strokeWidth || 2}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={selectedShape.strokeWidth || 2}
                onChange={(e) =>
                  onUpdateShape(selectedShape.id, { strokeWidth: parseInt(e.target.value) || 0 })
                }
                className="w-full accent-purple-600 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <label className="text-neutral-400 block text-[11px]">نوع خط دور:</label>
              <select
                value={selectedShape.strokeStyle || 'solid'}
                onChange={(e) =>
                  onUpdateShape(selectedShape.id, {
                    strokeStyle: e.target.value as 'solid' | 'dashed' | 'dotted',
                  })
                }
                className={`w-full p-1.5 rounded-lg border text-xs cursor-pointer focus:outline-none ${
                  isDark
                    ? 'bg-neutral-900 border-neutral-750 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <option value="solid">ممتد (Solid)</option>
                <option value="dashed">خط‌چین (Dashed)</option>
                <option value="dotted">نقطه‌چین (Dotted)</option>
              </select>
            </div>
          </div>

          {/* Opacity & Rotation */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-400">
                <span>شفافیت:</span>
                <span className="font-mono">{Math.round((selectedShape.opacity ?? 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={selectedShape.opacity ?? 1}
                onChange={(e) =>
                  onUpdateShape(selectedShape.id, { opacity: parseFloat(e.target.value) || 1 })
                }
                className="w-full accent-purple-600 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-400">
                <span>چرخش:</span>
                <span className="font-mono">{selectedShape.rotation || 0}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                value={selectedShape.rotation || 0}
                onChange={(e) =>
                  onUpdateShape(selectedShape.id, { rotation: parseInt(e.target.value) || 0 })
                }
                className="w-full accent-purple-600 cursor-pointer"
              />
            </div>
          </div>
          {/* Scope Selector: Where this shape applies */}
          <div className="pt-2 border-t border-neutral-800/40 space-y-1">
            <label className="text-neutral-400 block text-[11px] font-semibold">
              اعمال شکل در چه صفحه‌هایی:
            </label>
            <select
              value={selectedShape.targetScope || 'current'}
              onChange={(e) =>
                onUpdateShape(selectedShape.id, {
                  targetScope: e.target.value as OverlayTargetScope,
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
              تکثیر و همگام‌سازی سریع:
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onApplyShapeToAllPages(selectedShape.id)}
                className="py-1.5 px-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                title="قرار دادن این شکل روی تمام صفحات به صورت همگام"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>اعمال روی تمام صفحات</span>
              </button>

              <button
                type="button"
                onClick={() => onApplyShapeToSelectedPages(selectedShape.id)}
                className="py-1.5 px-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                title="قرار دادن این شکل روی صفحات تیک‌خورده انتخابی"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>اعمال روی انتخاب‌ها</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onDeleteShape(selectedShape.id)}
              className="w-full py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-red-500/30 text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف این شکل</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 text-center text-neutral-400 text-xs border border-dashed rounded-xl border-neutral-800">
          برای ویرایش، روی یکی از اشکال بالا کلیک کنید یا با دکمه‌های بالا شکل جدید بسازید.
        </div>
      )}
    </div>
  );
};
