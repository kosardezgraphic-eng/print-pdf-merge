import React, { useState, useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { CanvasGuideline } from '../types';

interface GuidelinesLayerProps {
  guidelines: CanvasGuideline[];
  pageWidthMm: number;
  pageHeightMm: number;
  onUpdateGuideline: (id: string, newPosPercent: number) => void;
  onDeleteGuideline: (id: string) => void;
  theme: 'dark' | 'light';
}

export const GuidelinesLayer: React.FC<GuidelinesLayerProps> = ({
  guidelines,
  pageWidthMm,
  pageHeightMm,
  onUpdateGuideline,
  onDeleteGuideline,
  theme,
}) => {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isHoveringDelete, setIsHoveringDelete] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}

    setActiveDragId(id);
  };

  const handlePointerMove = (id: string, type: 'horizontal' | 'vertical', e: React.PointerEvent) => {
    if (activeDragId !== id) return;
    const container = containerRef.current?.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    let isOutside = false;

    if (type === 'horizontal') {
      const relY = e.clientY - rect.top;
      // If dragged into ruler area (above canvas top) or off bottom
      if (relY < -10 || relY > rect.height + 10) {
        isOutside = true;
      }
      const pct = Math.max(-5, Math.min(105, (relY / rect.height) * 100));
      onUpdateGuideline(id, Number(pct.toFixed(2)));
    } else {
      const relX = e.clientX - rect.left;
      // If dragged into left ruler area (left of canvas) or off right
      if (relX < -10 || relX > rect.width + 10) {
        isOutside = true;
      }
      const pct = Math.max(-5, Math.min(105, (relX / rect.width) * 100));
      onUpdateGuideline(id, Number(pct.toFixed(2)));
    }

    setIsHoveringDelete((prev) => ({ ...prev, [id]: isOutside }));
  };

  const handlePointerUp = (id: string, e: React.PointerEvent) => {
    if (activeDragId === id) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}

      setActiveDragId(null);

      // If released outside canvas bounds or dragged into ruler, delete guideline!
      const targetGuide = guidelines.find((g) => g.id === id);
      if (
        targetGuide &&
        (targetGuide.positionPercent < -2 ||
          targetGuide.positionPercent > 102 ||
          isHoveringDelete[id])
      ) {
        onDeleteGuideline(id);
      }
    }
  };

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-20">
      {guidelines.map((guide) => {
        const isHoriz = guide.type === 'horizontal';
        const isDragging = activeDragId === guide.id;
        const isMarkedDelete = isHoveringDelete[guide.id] || guide.positionPercent < 0 || guide.positionPercent > 100;

        // Line color: Cyan when normal, Red when dragged to ruler for deletion
        const lineColor = isMarkedDelete ? '#ef4444' : (guide.color || '#06b6d4');

        // Calculate position in real cm
        const posCm = isHoriz
          ? ((Math.max(0, Math.min(100, guide.positionPercent)) / 100) * (pageHeightMm / 10)).toFixed(1)
          : ((Math.max(0, Math.min(100, guide.positionPercent)) / 100) * (pageWidthMm / 10)).toFixed(1);

        if (isHoriz) {
          return (
            <div
              key={guide.id}
              style={{ top: `${guide.positionPercent}%` }}
              className="absolute start-0 end-0 h-2 group pointer-events-auto cursor-row-resize flex items-center justify-between -translate-y-1/2 z-20"
              onPointerDown={(e) => handlePointerDown(guide.id, e)}
              onPointerMove={(e) => handlePointerMove(guide.id, 'horizontal', e)}
              onPointerUp={(e) => handlePointerUp(guide.id, e)}
            >
              {/* Ultra Thin 1px Line */}
              <div
                className={`w-full h-[1px] transition-colors ${
                  isMarkedDelete
                    ? 'bg-red-500 border-b border-dashed border-red-500'
                    : 'bg-cyan-500/90 shadow-2xs'
                }`}
                style={{ backgroundColor: lineColor }}
              />

              {/* Minimal Fine Specs Pill */}
              <div
                className={`absolute start-2 top-1/2 -translate-y-1/2 text-[8px] font-mono font-medium px-1.5 py-0.2 rounded-xs shadow-xs flex items-center gap-1 transition-all select-none ${
                  isMarkedDelete
                    ? 'bg-red-600 text-white'
                    : 'bg-cyan-600/90 hover:bg-cyan-600 text-white'
                }`}
              >
                <span>{isMarkedDelete ? 'حذف خط راهنما' : `Y: ${posCm} cm`}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteGuideline(guide.id);
                  }}
                  className="hover:text-red-200 transition-colors cursor-pointer ms-0.5 opacity-80 hover:opacity-100"
                  title="حذف خط راهنما"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          );
        }

        // Vertical Line
        return (
          <div
            key={guide.id}
            style={{ left: `${guide.positionPercent}%` }}
            className="absolute top-0 bottom-0 w-2 group pointer-events-auto cursor-col-resize flex flex-col items-center justify-between -translate-x-1/2 z-20"
            onPointerDown={(e) => handlePointerDown(guide.id, e)}
            onPointerMove={(e) => handlePointerMove(guide.id, 'vertical', e)}
            onPointerUp={(e) => handlePointerUp(guide.id, e)}
          >
            {/* Ultra Thin 1px Line */}
            <div
              className={`h-full w-[1px] transition-colors ${
                isMarkedDelete
                  ? 'bg-red-500 border-r border-dashed border-red-500'
                  : 'bg-cyan-500/90 shadow-2xs'
              }`}
              style={{ backgroundColor: lineColor }}
            />

            {/* Minimal Fine Specs Pill */}
            <div
              className={`absolute top-2 start-1/2 -translate-x-1/2 text-[8px] font-mono font-medium px-1.5 py-0.2 rounded-xs shadow-xs flex items-center gap-1 transition-all select-none ${
                isMarkedDelete
                  ? 'bg-red-600 text-white'
                  : 'bg-cyan-600/90 hover:bg-cyan-600 text-white'
              }`}
            >
              <span>{isMarkedDelete ? 'حذف' : `X: ${posCm} cm`}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteGuideline(guide.id);
                }}
                className="hover:text-red-200 transition-colors cursor-pointer ms-0.5 opacity-80 hover:opacity-100"
                title="حذف خط راهنما"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
