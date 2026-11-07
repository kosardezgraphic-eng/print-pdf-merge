import React, { useRef, useState, useEffect } from 'react';
import { PrintSettings } from '../types';
import { Scissors } from 'lucide-react';

interface InteractiveMarginGuidesProps {
  settings: PrintSettings;
  onChangeSettings: (updates: Partial<PrintSettings>) => void;
  pageWidthMm?: number;
  pageHeightMm?: number;
  isDark?: boolean;
  isFa?: boolean;
  showMargins: boolean;
}

export const InteractiveMarginGuides: React.FC<InteractiveMarginGuidesProps> = ({
  settings,
  onChangeSettings,
  pageWidthMm = 210,
  pageHeightMm = 297,
  isDark = true,
  isFa = true,
  showMargins,
}) => {
  if (!showMargins) return null;

  const containerRef = useRef<HTMLDivElement>(null);
  const [activeHandle, setActiveHandle] = useState<
    'top' | 'bottom' | 'left' | 'right' | 'gutter' | null
  >(null);

  const gridLayout = settings.gridLayout || {
    enabled: false,
    rows: 1,
    cols: 1,
    repeatPage: false,
    order: 'rtl-rows',
    horizontalGapMm: 2,
    verticalGapMm: 2,
    marginTopMm: 8,
    marginBottomMm: 8,
    marginLeftMm: 8,
    marginRightMm: 8,
    cellScalePercent: 100,
    offsetXPercent: 0,
    offsetYPercent: 0,
    showCutMarks: true,
  };

  const topMm = gridLayout.marginTopMm ?? 8;
  const bottomMm = gridLayout.marginBottomMm ?? 8;
  const leftMm = gridLayout.marginLeftMm ?? 8;
  const rightMm = gridLayout.marginRightMm ?? 8;
  const gutterMm = settings.gutterMm ?? 0;

  const topPct = (topMm / pageHeightMm) * 100;
  const bottomPct = (bottomMm / pageHeightMm) * 100;
  const leftPct = (leftMm / pageWidthMm) * 100;
  const rightPct = (rightMm / pageWidthMm) * 100;
  const gutterPct = (gutterMm / pageWidthMm) * 100;

  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initTop: number;
    initBottom: number;
    initLeft: number;
    initRight: number;
    initGutter: number;
  }>({
    startX: 0,
    startY: 0,
    initTop: topMm,
    initBottom: bottomMm,
    initLeft: leftMm,
    initRight: rightMm,
    initGutter: gutterMm,
  });

  const handlePointerDown = (
    handle: 'top' | 'bottom' | 'left' | 'right' | 'gutter',
    e: React.PointerEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveHandle(handle);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initTop: topMm,
      initBottom: bottomMm,
      initLeft: leftMm,
      initRight: rightMm,
      initGutter: gutterMm,
    };
  };

  useEffect(() => {
    if (!activeHandle) return;

    const handlePointerMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const deltaX = e.clientX - dragStartRef.current.startX;
      const deltaY = e.clientY - dragStartRef.current.startY;

      const deltaXMm = (deltaX / rect.width) * pageWidthMm;
      const deltaYMm = (deltaY / rect.height) * pageHeightMm;

      if (activeHandle === 'top') {
        const next = Math.max(0, Math.min(80, Math.round(dragStartRef.current.initTop + deltaYMm)));
        onChangeSettings({
          gridLayout: {
            ...gridLayout,
            marginTopMm: next,
          },
        });
      } else if (activeHandle === 'bottom') {
        const next = Math.max(0, Math.min(80, Math.round(dragStartRef.current.initBottom - deltaYMm)));
        onChangeSettings({
          gridLayout: {
            ...gridLayout,
            marginBottomMm: next,
          },
        });
      } else if (activeHandle === 'left') {
        const next = Math.max(0, Math.min(80, Math.round(dragStartRef.current.initLeft + deltaXMm)));
        onChangeSettings({
          gridLayout: {
            ...gridLayout,
            marginLeftMm: next,
          },
        });
      } else if (activeHandle === 'right') {
        const next = Math.max(0, Math.min(80, Math.round(dragStartRef.current.initRight - deltaXMm)));
        onChangeSettings({
          gridLayout: {
            ...gridLayout,
            marginRightMm: next,
          },
        });
      } else if (activeHandle === 'gutter') {
        const next = Math.max(0, Math.min(50, Math.round(dragStartRef.current.initGutter - deltaXMm)));
        onChangeSettings({
          gutterMm: next,
        });
      }
    };

    const handlePointerUp = () => {
      setActiveHandle(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeHandle, gridLayout, onChangeSettings, pageHeightMm, pageWidthMm]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-25 select-none"
    >
      {/* Top Margin Guideline */}
      <div
        style={{ top: `${topPct}%` }}
        className="absolute left-0 right-0 h-0 border-t-2 border-dashed border-blue-500/80 pointer-events-auto group cursor-ns-resize z-30"
      >
        <div
          onPointerDown={(e) => handlePointerDown('top', e)}
          className="absolute start-6 -top-3.5 px-2 py-0.5 rounded-md bg-blue-600 text-white text-[9px] font-mono font-bold shadow-md flex items-center gap-1 cursor-ns-resize hover:scale-105 transition-transform"
        >
          <span>{isFa ? `بالا: ${(topMm / 10).toFixed(1)} cm` : `Top: ${(topMm / 10).toFixed(1)} cm`}</span>
        </div>
      </div>

      {/* Bottom Margin Guideline */}
      <div
        style={{ bottom: `${bottomPct}%` }}
        className="absolute left-0 right-0 h-0 border-t-2 border-dashed border-blue-500/80 pointer-events-auto group cursor-ns-resize z-30"
      >
        <div
          onPointerDown={(e) => handlePointerDown('bottom', e)}
          className="absolute start-6 -top-3.5 px-2 py-0.5 rounded-md bg-blue-600 text-white text-[9px] font-mono font-bold shadow-md flex items-center gap-1 cursor-ns-resize hover:scale-105 transition-transform"
        >
          <span>{isFa ? `پایین: ${(bottomMm / 10).toFixed(1)} cm` : `Bottom: ${(bottomMm / 10).toFixed(1)} cm`}</span>
        </div>
      </div>

      {/* Left Margin Guideline */}
      <div
        style={{ left: `${leftPct}%` }}
        className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed border-blue-500/80 pointer-events-auto group cursor-ew-resize z-30"
      >
        <div
          onPointerDown={(e) => handlePointerDown('left', e)}
          className="absolute -start-3 top-16 px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[9px] font-mono font-bold shadow-md -rotate-90 whitespace-nowrap cursor-ew-resize hover:scale-105 transition-transform"
        >
          <span>{isFa ? `چپ: ${(leftMm / 10).toFixed(1)} cm` : `Left: ${(leftMm / 10).toFixed(1)} cm`}</span>
        </div>
      </div>

      {/* Right Margin Guideline */}
      <div
        style={{ right: `${rightPct}%` }}
        className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed border-blue-500/80 pointer-events-auto group cursor-ew-resize z-30"
      >
        <div
          onPointerDown={(e) => handlePointerDown('right', e)}
          className="absolute -start-3 top-16 px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[9px] font-mono font-bold shadow-md rotate-90 whitespace-nowrap cursor-ew-resize hover:scale-105 transition-transform"
        >
          <span>{isFa ? `راست: ${(rightMm / 10).toFixed(1)} cm` : `Right: ${(rightMm / 10).toFixed(1)} cm`}</span>
        </div>
      </div>

      {/* Gutter / Spine Guide if set */}
      {gutterMm > 0 && (
        <div
          style={{ right: `${gutterPct}%` }}
          className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed border-amber-500/90 pointer-events-auto group cursor-ew-resize z-30"
        >
          <div
            onPointerDown={(e) => handlePointerDown('gutter', e)}
            className="absolute -start-3 top-36 px-1.5 py-0.5 rounded-md bg-amber-600 text-white text-[9px] font-mono font-bold shadow-md rotate-90 whitespace-nowrap cursor-ew-resize hover:scale-105 transition-transform"
          >
            <span>{isFa ? `شیرازه: ${gutterMm} mm` : `Spine: ${gutterMm} mm`}</span>
          </div>
        </div>
      )}

      {/* Printable Area Box Indicator */}
      <div
        style={{
          top: `${topPct}%`,
          bottom: `${bottomPct}%`,
          left: `${leftPct}%`,
          right: `${rightPct}%`,
        }}
        className="absolute border border-blue-400/30 bg-blue-500/5 pointer-events-none flex items-center justify-center"
      >
        <div className="text-[10px] font-mono text-blue-500/60 font-semibold px-2 py-0.5 rounded bg-white/60 dark:bg-black/40 border border-blue-500/20 backdrop-blur-xs">
          {isFa
            ? `محدوده چاپ: ${(Math.max(0, pageWidthMm - leftMm - rightMm) / 10).toFixed(1)} × ${(Math.max(0, pageHeightMm - topMm - bottomMm) / 10).toFixed(1)} cm`
            : `Print Area: ${(Math.max(0, pageWidthMm - leftMm - rightMm) / 10).toFixed(1)} × ${(Math.max(0, pageHeightMm - topMm - bottomMm) / 10).toFixed(1)} cm`}
        </div>
      </div>
    </div>
  );
};
