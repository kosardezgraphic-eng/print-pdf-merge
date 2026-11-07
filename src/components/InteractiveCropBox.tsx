import React, { useRef, useState, useEffect } from 'react';
import { CanvasGuideline } from '../types';

export type HandleType =
  | 'tl' // top-left
  | 'tc' // top-center
  | 'tr' // top-right
  | 'ml' // middle-left
  | 'mr' // middle-right
  | 'bl' // bottom-left
  | 'bc' // bottom-center
  | 'br' // bottom-right
  | 'move'; // whole box move

interface InteractiveCropBoxProps {
  crop: {
    top: number; // 0 to 100%
    bottom: number;
    left: number;
    right: number;
  };
  onChange: (newCrop: { top: number; bottom: number; left: number; right: number }) => void;
  pageWidthMm?: number;
  pageHeightMm?: number;
  snapToGrid?: boolean;
  guidelines?: CanvasGuideline[];
  transform?: {
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    rotation?: number;
  };
}

export const InteractiveCropBox: React.FC<InteractiveCropBoxProps> = ({
  crop,
  onChange,
  pageWidthMm = 210,
  pageHeightMm = 297,
  snapToGrid = false,
  guidelines = [],
  transform,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeHandle, setActiveHandle] = useState<HandleType | null>(null);

  // Store drag initial coordinates and initial crop
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startCrop: { top: number; bottom: number; left: number; right: number };
    rectWidth: number;
    rectHeight: number;
  }>({
    startX: 0,
    startY: 0,
    startCrop: { top: 0, bottom: 0, left: 0, right: 0 },
    rectWidth: 1,
    rectHeight: 1,
  });

  const handlePointerDown = (handle: HandleType, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
      rectWidth: rect.width || 1,
      rectHeight: rect.height || 1,
    };

    setActiveHandle(handle);
  };

  useEffect(() => {
    if (!activeHandle) return;

    let rafId: number | null = null;
    let latestEvX = 0;
    let latestEvY = 0;

    const handlePointerMove = (e: PointerEvent) => {
      latestEvX = e.clientX;
      latestEvY = e.clientY;

      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        rafId = null;
        const { startX, startY, startCrop, rectWidth, rectHeight } = dragRef.current;

        // Delta in screen pixels converted to percentage of container
        const deltaXPercent = ((latestEvX - startX) / rectWidth) * 100;
        const deltaYPercent = ((latestEvY - startY) / rectHeight) * 100;

        const minDimension = 4; // minimum 4% width or height

        let nextTop = startCrop.top;
        let nextBottom = startCrop.bottom;
        let nextLeft = startCrop.left;
        let nextRight = startCrop.right;

        switch (activeHandle) {
          case 'tl':
            nextTop = Math.max(0, Math.min(100 - startCrop.bottom - minDimension, startCrop.top + deltaYPercent));
            nextLeft = Math.max(0, Math.min(100 - startCrop.right - minDimension, startCrop.left + deltaXPercent));
            break;
          case 'tc':
            nextTop = Math.max(0, Math.min(100 - startCrop.bottom - minDimension, startCrop.top + deltaYPercent));
            break;
          case 'tr':
            nextTop = Math.max(0, Math.min(100 - startCrop.bottom - minDimension, startCrop.top + deltaYPercent));
            nextRight = Math.max(0, Math.min(100 - startCrop.left - minDimension, startCrop.right - deltaXPercent));
            break;
          case 'ml':
            nextLeft = Math.max(0, Math.min(100 - startCrop.right - minDimension, startCrop.left + deltaXPercent));
            break;
          case 'mr':
            nextRight = Math.max(0, Math.min(100 - startCrop.left - minDimension, startCrop.right - deltaXPercent));
            break;
          case 'bl':
            nextBottom = Math.max(0, Math.min(100 - startCrop.top - minDimension, startCrop.bottom - deltaYPercent));
            nextLeft = Math.max(0, Math.min(100 - startCrop.right - minDimension, startCrop.left + deltaXPercent));
            break;
          case 'bc':
            nextBottom = Math.max(0, Math.min(100 - startCrop.top - minDimension, startCrop.bottom - deltaYPercent));
            break;
          case 'br':
            nextBottom = Math.max(0, Math.min(100 - startCrop.top - minDimension, startCrop.bottom - deltaYPercent));
            nextRight = Math.max(0, Math.min(100 - startCrop.left - minDimension, startCrop.right - deltaXPercent));
            break;
          case 'move': {
            const boxWidth = 100 - startCrop.left - startCrop.right;
            const boxHeight = 100 - startCrop.top - startCrop.bottom;

            let targetLeft = startCrop.left + deltaXPercent;
            let targetTop = startCrop.top + deltaYPercent;

            targetLeft = Math.max(0, Math.min(100 - boxWidth, targetLeft));
            targetTop = Math.max(0, Math.min(100 - boxHeight, targetTop));

            nextLeft = targetLeft;
            nextRight = 100 - (targetLeft + boxWidth);
            nextTop = targetTop;
            nextBottom = 100 - (targetTop + boxHeight);
            break;
          }
        }

        if (snapToGrid) {
          // Snap helper
          const snapEdge = (val: number, isVerticalAxis: boolean) => {
            if (val < 1.2) return 0; // snap to 0% edge
            const round5 = Math.round(val / 5) * 5;
            if (Math.abs(val - round5) < 1.2) return round5;
            // Check against guidelines
            for (const g of guidelines) {
              const matchesAxis = isVerticalAxis ? g.type === 'horizontal' : g.type === 'vertical';
              if (matchesAxis && Math.abs(val - g.positionPercent) < 1.5) {
                return g.positionPercent;
              }
            }
            return val;
          };

          nextTop = snapEdge(nextTop, true);
          nextBottom = snapEdge(nextBottom, true);
          nextLeft = snapEdge(nextLeft, false);
          nextRight = snapEdge(nextRight, false);
        }

        onChange({
          top: Number(nextTop.toFixed(2)),
          bottom: Number(nextBottom.toFixed(2)),
          left: Number(nextLeft.toFixed(2)),
          right: Number(nextRight.toFixed(2)),
        });
      });
    };

    const handlePointerUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setActiveHandle(null);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeHandle, onChange]);

  // Derived dimensions
  const cropWidthPct = Math.max(4, 100 - crop.left - crop.right);
  const cropHeightPct = Math.max(4, 100 - crop.top - crop.bottom);

  const cropWidthMm = Math.round((cropWidthPct / 100) * pageWidthMm);
  const cropHeightMm = Math.round((cropHeightPct / 100) * pageHeightMm);

  const scaleVal = transform?.scale ? transform.scale / 100 : 1;
  const offX = transform?.offsetX || 0;
  const offY = transform?.offsetY || 0;
  const rot = transform?.rotation || 0;

  return (
    <div
      ref={containerRef}
      dir="ltr"
      style={{
        direction: 'ltr',
        transform: transform ? `translate(${offX}%, ${offY}%) rotate(${rot}deg) scale(${scaleVal})` : undefined,
        transformOrigin: 'center center',
        transition: activeHandle ? 'none' : 'transform 0.1s ease-out',
      }}
      className="absolute inset-0 pointer-events-auto select-none overflow-hidden"
    >
      {/* 4 Dimmed Masks strictly positioned with physical coordinates */}
      {/* Top Mask */}
      <div
        className="absolute bg-black/60 pointer-events-none"
        style={{ top: 0, left: 0, right: 0, height: `${crop.top}%` }}
      />
      {/* Bottom Mask */}
      <div
        className="absolute bg-black/60 pointer-events-none"
        style={{ bottom: 0, left: 0, right: 0, height: `${crop.bottom}%` }}
      />
      {/* Left Mask */}
      <div
        className="absolute bg-black/60 pointer-events-none"
        style={{
          top: `${crop.top}%`,
          bottom: `${crop.bottom}%`,
          left: 0,
          width: `${crop.left}%`,
        }}
      />
      {/* Right Mask */}
      <div
        className="absolute bg-black/60 pointer-events-none"
        style={{
          top: `${crop.top}%`,
          bottom: `${crop.bottom}%`,
          right: 0,
          width: `${crop.right}%`,
        }}
      />

      {/* Interactive Crop Box Rectangle */}
      <div
        className="absolute border-2 border-dashed border-blue-500 shadow-xl transition-shadow cursor-move"
        style={{
          top: `${crop.top}%`,
          left: `${crop.left}%`,
          width: `${cropWidthPct}%`,
          height: `${cropHeightPct}%`,
        }}
        onPointerDown={(e) => handlePointerDown('move', e)}
      >
        {/* Rule-of-Thirds Grid lines */}
        <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-30">
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div />
        </div>

        {/* Live Dimension Tag */}
        <div
          dir="ltr"
          className="absolute top-1.5 left-1.5 bg-blue-600/90 text-white font-mono text-[10px] px-1.5 py-0.5 rounded shadow pointer-events-none backdrop-blur-xs flex items-center gap-1"
        >
          <span>
            {cropWidthMm} × {cropHeightMm} mm
          </span>
          <span className="opacity-70">
            ({Math.round(cropWidthPct)}% × {Math.round(cropHeightPct)}%)
          </span>
        </div>

        {/* 8 Drag Handles strictly positioned with physical coordinates */}
        {/* 1. Top-Left */}
        <div
          onPointerDown={(e) => handlePointerDown('tl', e)}
          style={{ top: -7, left: -7 }}
          className="absolute w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow-md cursor-nwse-resize z-20 hover:scale-125 transition-transform"
          title="گوشه بالا-چپ"
        />

        {/* 2. Top-Center */}
        <div
          onPointerDown={(e) => handlePointerDown('tc', e)}
          style={{ top: -7, left: '50%', transform: 'translateX(-50%)' }}
          className="absolute w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow-md cursor-ns-resize z-20 hover:scale-125 transition-transform"
          title="لبه بالا"
        />

        {/* 3. Top-Right */}
        <div
          onPointerDown={(e) => handlePointerDown('tr', e)}
          style={{ top: -7, right: -7 }}
          className="absolute w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow-md cursor-nesw-resize z-20 hover:scale-125 transition-transform"
          title="گوشه بالا-راست"
        />

        {/* 4. Middle-Right */}
        <div
          onPointerDown={(e) => handlePointerDown('mr', e)}
          style={{ top: '50%', right: -7, transform: 'translateY(-50%)' }}
          className="absolute w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow-md cursor-ew-resize z-20 hover:scale-125 transition-transform"
          title="لبه راست"
        />

        {/* 5. Bottom-Right */}
        <div
          onPointerDown={(e) => handlePointerDown('br', e)}
          style={{ bottom: -7, right: -7 }}
          className="absolute w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow-md cursor-nwse-resize z-20 hover:scale-125 transition-transform"
          title="گوشه پایین-راست"
        />

        {/* 6. Bottom-Center */}
        <div
          onPointerDown={(e) => handlePointerDown('bc', e)}
          style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
          className="absolute w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow-md cursor-ns-resize z-20 hover:scale-125 transition-transform"
          title="لبه پایین"
        />

        {/* 7. Bottom-Left */}
        <div
          onPointerDown={(e) => handlePointerDown('bl', e)}
          style={{ bottom: -7, left: -7 }}
          className="absolute w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow-md cursor-nesw-resize z-20 hover:scale-125 transition-transform"
          title="گوشه پایین-چپ"
        />

        {/* 8. Middle-Left */}
        <div
          onPointerDown={(e) => handlePointerDown('ml', e)}
          style={{ top: '50%', left: -7, transform: 'translateY(-50%)' }}
          className="absolute w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow-md cursor-ew-resize z-20 hover:scale-125 transition-transform"
          title="لبه چپ"
        />
      </div>
    </div>
  );
};
