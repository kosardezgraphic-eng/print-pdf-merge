import React, { useRef, useState, useEffect } from 'react';
import { CanvasGuideline } from '../types';

export type TransformHandleType =
  | 'tl' // Top-Left
  | 'tc' // Top-Center
  | 'tr' // Top-Right
  | 'ml' // Middle-Left
  | 'mr' // Middle-Right
  | 'bl' // Bottom-Left
  | 'bc' // Bottom-Center
  | 'br' // Bottom-Right
  | 'move'; // Move/Drag

interface InteractiveTransformBoxProps {
  offsetX: number; // in percent (-50 to +50)
  offsetY: number; // in percent (-50 to +50)
  scale: number;   // in percent (20 to 300, default 100)
  rotation?: number;
  crop?: { top: number; bottom: number; left: number; right: number };
  pageWidthMm?: number;
  pageHeightMm?: number;
  snapToGrid?: boolean;
  guidelines?: CanvasGuideline[];
  onChange: (updates: { offsetX?: number; offsetY?: number; scale?: number }) => void;
  children?: React.ReactNode;
}

export const InteractiveTransformBox: React.FC<InteractiveTransformBoxProps> = ({
  offsetX,
  offsetY,
  scale,
  rotation = 0,
  crop,
  pageWidthMm = 210,
  pageHeightMm = 297,
  snapToGrid = false,
  guidelines = [],
  onChange,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeHandle, setActiveHandle] = useState<TransformHandleType | null>(null);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    initOffsetX: number;
    initOffsetY: number;
    initScale: number;
    parentW: number;
    parentH: number;
  }>({
    startX: 0,
    startY: 0,
    initOffsetX: 0,
    initOffsetY: 0,
    initScale: 100,
    parentW: 1,
    parentH: 1,
  });

  const handlePointerDown = (handle: TransformHandleType, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}

    const container = containerRef.current;
    if (!container) return;

    const parent = container.parentElement;
    const parentRect = parent ? parent.getBoundingClientRect() : container.getBoundingClientRect();

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initOffsetX: offsetX || 0,
      initOffsetY: offsetY || 0,
      initScale: scale || 100,
      parentW: parentRect.width || 1,
      parentH: parentRect.height || 1,
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
        const { startX, startY, initOffsetX, initOffsetY, initScale, parentW, parentH } = dragRef.current;

        const deltaX = latestEvX - startX;
        const deltaY = latestEvY - startY;

        if (activeHandle === 'move') {
          // Move translation with 0.01% precision
          const pctX = (deltaX / parentW) * 100;
          const pctY = (deltaY / parentH) * 100;

          let nextOffX = Math.max(-50, Math.min(50, Number((initOffsetX + pctX).toFixed(2))));
          let nextOffY = Math.max(-50, Math.min(50, Number((initOffsetY + pctY).toFixed(2))));

          if (snapToGrid) {
            // Magnetic snap to center (0%)
            if (Math.abs(nextOffX) < 1.5) nextOffX = 0;
            if (Math.abs(nextOffY) < 1.5) nextOffY = 0;

            // Snap to 5% intervals if close
            const round5X = Math.round(nextOffX / 5) * 5;
            if (Math.abs(nextOffX - round5X) < 1.2) nextOffX = round5X;
            const round5Y = Math.round(nextOffY / 5) * 5;
            if (Math.abs(nextOffY - round5Y) < 1.2) nextOffY = round5Y;
          }

          onChange({ offsetX: nextOffX, offsetY: nextOffY });
          return;
        }

        // Handle 8-point resizing / scaling
        let scaleFactor = 0;

        switch (activeHandle) {
          case 'br':
            scaleFactor = (deltaX / parentW + deltaY / parentH) * 100;
            break;
          case 'tl':
            scaleFactor = (-deltaX / parentW - deltaY / parentH) * 100;
            break;
          case 'tr':
            scaleFactor = (deltaX / parentW - deltaY / parentH) * 100;
            break;
          case 'bl':
            scaleFactor = (-deltaX / parentW + deltaY / parentH) * 100;
            break;
          case 'mr':
            scaleFactor = (deltaX / parentW) * 150;
            break;
          case 'ml':
            scaleFactor = (-deltaX / parentW) * 150;
            break;
          case 'bc':
            scaleFactor = (deltaY / parentH) * 150;
            break;
          case 'tc':
            scaleFactor = (-deltaY / parentH) * 150;
            break;
        }

        let nextScale = Math.max(25, Math.min(300, Number((initScale + scaleFactor).toFixed(1))));

        if (snapToGrid) {
          // Snap scale to common increments: 50, 75, 100, 125, 150, 200
          const commonScales = [50, 75, 100, 125, 150, 200];
          for (const s of commonScales) {
            if (Math.abs(nextScale - s) < 3) {
              nextScale = s;
              break;
            }
          }
        }

        onChange({ scale: nextScale });
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

  const cropLeft = crop?.left || 0;
  const cropRight = crop?.right || 0;
  const cropTop = crop?.top || 0;
  const cropBottom = crop?.bottom || 0;

  const cropW = Math.max(2, 100 - cropLeft - cropRight);
  const cropH = Math.max(2, 100 - cropTop - cropBottom);
  const cropCenterX = cropLeft + cropW / 2;
  const cropCenterY = cropTop + cropH / 2;

  const scaleValue = (scale || 100) / 100;
  const offXVal = offsetX || 0;
  const offYVal = offsetY || 0;

  return (
    <div
      ref={containerRef}
      dir="ltr"
      style={{
        position: 'absolute',
        left: `${cropCenterX}%`,
        top: `${cropCenterY}%`,
        width: `${cropW}%`,
        height: `${cropH}%`,
        pointerEvents: 'none',
        transform: `translate(-50%, -50%) translate(${offXVal}%, ${offYVal}%) rotate(${rotation}deg) scale(${scaleValue})`,
        transformOrigin: 'center center',
        transition: activeHandle ? 'none' : 'transform 0.1s ease-out',
      }}
      className="z-20"
    >
      {/* 8-Point Bounding Box Frame */}
      <div
        style={{ pointerEvents: 'auto' }}
        onPointerDown={(e) => handlePointerDown('move', e)}
        className="w-full h-full relative cursor-move border-2 border-blue-500/80 bg-blue-500/5 group"
      >
        {/* Children (if rendered inside box) */}
        {children}

        {/* Center Move Indicator Badge */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-90 bg-neutral-900/90 text-white text-[10px] font-mono px-2 py-0.5 rounded shadow border border-blue-500/40 transition-opacity">
          اندازه: {scale}% · جابجایی ({offXVal}%, {offYVal}%)
        </div>

        {/* 8 Control Points (Handles) for Resizing */}
        {/* Top-Left */}
        <div
          onPointerDown={(e) => handlePointerDown('tl', e)}
          className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow cursor-nwse-resize hover:scale-125 transition-transform"
          title="تغییر اندازه از بالا-چپ"
        />

        {/* Top-Center */}
        <div
          onPointerDown={(e) => handlePointerDown('tc', e)}
          className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow cursor-ns-resize hover:scale-125 transition-transform"
          title="تغییر اندازه از بالا"
        />

        {/* Top-Right */}
        <div
          onPointerDown={(e) => handlePointerDown('tr', e)}
          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow cursor-nesw-resize hover:scale-125 transition-transform"
          title="تغییر اندازه از بالا-راست"
        />

        {/* Middle-Left */}
        <div
          onPointerDown={(e) => handlePointerDown('ml', e)}
          className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow cursor-ew-resize hover:scale-125 transition-transform"
          title="تغییر اندازه از چپ"
        />

        {/* Middle-Right */}
        <div
          onPointerDown={(e) => handlePointerDown('mr', e)}
          className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow cursor-ew-resize hover:scale-125 transition-transform"
          title="تغییر اندازه از راست"
        />

        {/* Bottom-Left */}
        <div
          onPointerDown={(e) => handlePointerDown('bl', e)}
          className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow cursor-nesw-resize hover:scale-125 transition-transform"
          title="تغییر اندازه از پایین-چپ"
        />

        {/* Bottom-Center */}
        <div
          onPointerDown={(e) => handlePointerDown('bc', e)}
          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow cursor-ns-resize hover:scale-125 transition-transform"
          title="تغییر اندازه از پایین"
        />

        {/* Bottom-Right */}
        <div
          onPointerDown={(e) => handlePointerDown('br', e)}
          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-xs shadow cursor-nwse-resize hover:scale-125 transition-transform"
          title="تغییر اندازه از پایین-راست"
        />
      </div>
    </div>
  );
};
