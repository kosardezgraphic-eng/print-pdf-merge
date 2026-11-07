import React, { useState } from 'react';
import { Plus } from 'lucide-react';

interface RulerProps {
  orientation: 'horizontal' | 'vertical';
  lengthMm: number; // e.g. 210 for A4 width, 297 for A4 height
  cropStartPercent: number; // 0 to 100
  cropEndPercent: number; // 0 to 100
  theme: 'dark' | 'light';
  onAddGuideline?: (type: 'horizontal' | 'vertical', posPercent: number) => void;
}

export const Ruler: React.FC<RulerProps> = ({
  orientation,
  lengthMm,
  cropStartPercent,
  cropEndPercent,
  theme,
  onAddGuideline,
}) => {
  const isDark = theme === 'dark';
  const isHorizontal = orientation === 'horizontal';
  const [hoverPct, setHoverPct] = useState<number | null>(null);

  // Generate tick marks in real physical centimeters (1 cm = 10 mm)
  const lengthCm = lengthMm / 10;
  const ticks: { posMm: number; isMajor: boolean; label?: string }[] = [];

  // Major ticks every 10mm (1cm), minor ticks every 2mm, half-cm at 5mm
  for (let mm = 0; mm <= lengthMm; mm += 2) {
    const isCm = mm % 10 === 0;
    const isHalfCm = mm % 5 === 0;
    if (isCm || isHalfCm || mm === lengthMm) {
      ticks.push({
        posMm: mm,
        isMajor: isCm,
        label: isCm ? `${mm / 10}` : undefined,
      });
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let pct = 0;
    if (isHorizontal) {
      pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    } else {
      pct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    }
    setHoverPct(pct);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onAddGuideline) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let pct = 0;
    if (isHorizontal) {
      pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      onAddGuideline('vertical', Number(pct.toFixed(2)));
    } else {
      pct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      onAddGuideline('horizontal', Number(pct.toFixed(2)));
    }
  };

  if (isHorizontal) {
    return (
      <div
        dir="ltr"
        style={{ direction: 'ltr' }}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverPct(null)}
        onPointerDown={handlePointerDown}
        className={`w-full h-6 border-b relative select-none overflow-hidden font-mono text-[9px] group cursor-pointer ${
          isDark
            ? 'bg-neutral-900 border-neutral-750 text-neutral-400'
            : 'bg-slate-100 border-slate-300 text-slate-600'
        }`}
        title="جهت ایجاد خط راهنمای عمودی روی خط‌کش کلیک کنید"
      >
        {/* Active Crop Range Highlight on Ruler */}
        <div
          className="absolute top-0 bottom-0 bg-blue-500/20 border-l border-r border-blue-500 pointer-events-none transition-all duration-75"
          style={{
            left: `${cropStartPercent}%`,
            width: `${Math.max(0, cropEndPercent - cropStartPercent)}%`,
          }}
        />

        {/* Hover Indicator */}
        {hoverPct !== null && (
          <div
            className="absolute top-0 bottom-0 w-[1.5px] bg-cyan-400 z-10 pointer-events-none flex flex-col items-center"
            style={{ left: `${hoverPct}%` }}
          >
            <span className="bg-cyan-600 text-white text-[8px] font-mono px-1 rounded -translate-y-full font-bold">
              {((hoverPct / 100) * lengthCm).toFixed(1)} cm
            </span>
          </div>
        )}

        {/* Real Centimeter Ticks and Labels */}
        {ticks.map((tick) => {
          const pct = (tick.posMm / lengthMm) * 100;
          return (
            <div
              key={tick.posMm}
              className="absolute bottom-0 flex flex-col items-center -translate-x-1/2 pointer-events-none"
              style={{ left: `${pct}%` }}
            >
              {tick.label && (
                <span className="text-[8px] font-mono font-semibold leading-none mb-0.5 opacity-90">
                  {tick.label}
                </span>
              )}
              <div
                className={`w-[1px] ${
                  tick.isMajor
                    ? isDark ? 'h-3 bg-neutral-300' : 'h-3 bg-slate-600'
                    : isDark ? 'h-1.5 bg-neutral-600' : 'h-1.5 bg-slate-400'
                }`}
              />
            </div>
          );
        })}

        {/* Add Guideline Badge on Hover */}
        <span className="absolute right-2 top-0.5 text-[8px] font-bold text-cyan-400 bg-cyan-950/80 px-1 rounded border border-cyan-800 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
          <Plus className="w-2.5 h-2.5" />
          <span>خط راهنما</span>
        </span>
      </div>
    );
  }

  // Vertical Ruler
  return (
    <div
      dir="ltr"
      style={{ direction: 'ltr' }}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHoverPct(null)}
      onPointerDown={handlePointerDown}
      className={`h-full w-6 border-r relative select-none overflow-hidden font-mono text-[9px] group cursor-pointer ${
        isDark
          ? 'bg-neutral-900 border-neutral-750 text-neutral-400'
          : 'bg-slate-100 border-slate-300 text-slate-600'
      }`}
      title="جهت ایجاد خط راهنمای افقی روی خط‌کش کلیک کنید"
    >
      {/* Active Crop Range Highlight on Ruler */}
      <div
        className="absolute left-0 right-0 bg-blue-500/20 border-t border-b border-blue-500 pointer-events-none transition-all duration-75"
        style={{
          top: `${cropStartPercent}%`,
          height: `${Math.max(0, cropEndPercent - cropStartPercent)}%`,
        }}
      />

      {/* Hover Indicator */}
      {hoverPct !== null && (
        <div
          className="absolute left-0 right-0 h-[1.5px] bg-cyan-400 z-10 pointer-events-none flex items-center justify-end"
          style={{ top: `${hoverPct}%` }}
        >
          <span className="bg-cyan-600 text-white text-[8px] font-mono px-1 rounded font-bold">
            {((hoverPct / 100) * lengthCm).toFixed(1)} cm
          </span>
        </div>
      )}

      {/* Real Centimeter Ticks and Labels */}
      {ticks.map((tick) => {
        const pct = (tick.posMm / lengthMm) * 100;
        return (
          <div
            key={tick.posMm}
            className="absolute right-0 flex items-center -translate-y-1/2 pointer-events-none"
            style={{ top: `${pct}%` }}
          >
            {tick.label && (
              <span className="text-[8px] font-mono font-semibold leading-none me-1 opacity-90">
                {tick.label}
              </span>
            )}
            <div
              className={`h-[1px] ${
                tick.isMajor
                  ? isDark ? 'w-3 bg-neutral-300' : 'w-3 bg-slate-600'
                  : isDark ? 'w-1.5 bg-neutral-600' : 'w-1.5 bg-slate-400'
              }`}
            />
          </div>
        );
      })}

      {/* Add Guideline Badge on Hover */}
      <span className="absolute bottom-2 left-0.5 text-[8px] font-bold text-cyan-400 bg-cyan-950/80 px-1 rounded border border-cyan-800 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
        <Plus className="w-2.5 h-2.5" />
      </span>
    </div>
  );
};
