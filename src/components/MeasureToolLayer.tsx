import React, { useState, useEffect, useRef } from 'react';
import { Ruler as RulerIcon, X, Lock } from 'lucide-react';

export interface MeasureLine {
  id: string;
  x1Percent: number; // 0 to 100
  y1Percent: number; // 0 to 100
  x2Percent: number; // 0 to 100
  y2Percent: number; // 0 to 100
}

interface MeasureToolLayerProps {
  activeTool: string; // e.g. 'measure' | 'move' | etc.
  pageWidthMm: number;
  pageHeightMm: number;
  theme: 'dark' | 'light';
  measureLine: MeasureLine | null;
  onChangeMeasureLine: (line: MeasureLine | null) => void;
}

export const MeasureToolLayer: React.FC<MeasureToolLayerProps> = ({
  activeTool,
  pageWidthMm,
  pageHeightMm,
  theme,
  measureLine,
  onChangeMeasureLine,
}) => {
  const isDark = theme === 'dark';
  const isMeasureMode = activeTool === 'measure';
  const containerRef = useRef<HTMLDivElement>(null);

  const [isShiftDown, setIsShiftDown] = useState(false);
  const [activeHandle, setActiveDragHandle] = useState<'create' | 'p1' | 'p2' | null>(null);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);

  // Keyboard Shift key listener for angle locking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftDown(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftDown(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Pointer event handlers for drawing or moving measurement line
  const handlePointerDownContainer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMeasureMode) return;
    const container = containerRef.current;
    if (!container) return;

    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };

    const rect = container.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const newLine: MeasureLine = {
      id: `measure-${Date.now()}`,
      x1Percent: Number(xPct.toFixed(2)),
      y1Percent: Number(yPct.toFixed(2)),
      x2Percent: Number(xPct.toFixed(2)),
      y2Percent: Number(yPct.toFixed(2)),
    };

    onChangeMeasureLine(newLine);
    setActiveDragHandle('create');
  };

  const handlePointerMoveContainer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeHandle || !measureLine) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    let rawXPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    let rawYPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    // Shift Key Alignment Lock (Horizontal / Vertical)
    if (e.shiftKey || isShiftDown) {
      if (activeHandle === 'create' || activeHandle === 'p2') {
        const dx = Math.abs((rawXPct - measureLine.x1Percent) * pageWidthMm);
        const dy = Math.abs((rawYPct - measureLine.y1Percent) * pageHeightMm);
        if (dx >= dy) {
          rawYPct = measureLine.y1Percent; // Strict horizontal
        } else {
          rawXPct = measureLine.x1Percent; // Strict vertical
        }
      } else if (activeHandle === 'p1') {
        const dx = Math.abs((measureLine.x2Percent - rawXPct) * pageWidthMm);
        const dy = Math.abs((measureLine.y2Percent - rawYPct) * pageHeightMm);
        if (dx >= dy) {
          rawYPct = measureLine.y2Percent; // Strict horizontal
        } else {
          rawXPct = measureLine.x2Percent; // Strict vertical
        }
      }
    }

    if (activeHandle === 'create' || activeHandle === 'p2') {
      onChangeMeasureLine({
        ...measureLine,
        x2Percent: Number(rawXPct.toFixed(2)),
        y2Percent: Number(rawYPct.toFixed(2)),
      });
    } else if (activeHandle === 'p1') {
      onChangeMeasureLine({
        ...measureLine,
        x1Percent: Number(rawXPct.toFixed(2)),
        y1Percent: Number(rawYPct.toFixed(2)),
      });
    }
  };

  const handlePointerUpContainer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeHandle) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setActiveDragHandle(null);
    }

    if (pointerDownPosRef.current) {
      const dx = Math.abs(e.clientX - pointerDownPosRef.current.x);
      const dy = Math.abs(e.clientY - pointerDownPosRef.current.y);
      const isSimpleClick = dx < 6 && dy < 6;

      if (isSimpleClick && measureLine) {
        // Simple click on empty screen area clears the active measurement!
        onChangeMeasureLine(null);
      }
      pointerDownPosRef.current = null;
    }
  };

  const handleHandlePointerDown = (handle: 'p1' | 'p2', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}
    setActiveDragHandle(handle);
  };

  // If no measureLine and not in measure tool, return null
  if (!measureLine && !isMeasureMode) return null;

  // Real millimeter & centimeter calculation
  let distCm = 0;
  let distMm = 0;
  let deltaXCm = 0;
  let deltaYCm = 0;
  let angleDeg = 0;
  let midXPct = 50;
  let midYPct = 50;

  if (measureLine) {
    const x1Mm = (measureLine.x1Percent / 100) * pageWidthMm;
    const y1Mm = (measureLine.y1Percent / 100) * pageHeightMm;
    const x2Mm = (measureLine.x2Percent / 100) * pageWidthMm;
    const y2Mm = (measureLine.y2Percent / 100) * pageHeightMm;

    const dxMm = x2Mm - x1Mm;
    const dyMm = y2Mm - y1Mm;

    distMm = Math.sqrt(dxMm * dxMm + dyMm * dyMm);
    distCm = distMm / 10;
    deltaXCm = Math.abs(dxMm) / 10;
    deltaYCm = Math.abs(dyMm) / 10;

    angleDeg = Math.atan2(dyMm, dxMm) * (180 / Math.PI);
    if (angleDeg < 0) angleDeg += 360;

    midXPct = (measureLine.x1Percent + measureLine.x2Percent) / 2;
    midYPct = (measureLine.y1Percent + measureLine.y2Percent) / 2;
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDownContainer}
      onPointerMove={handlePointerMoveContainer}
      onPointerUp={handlePointerUpContainer}
      className={`absolute inset-0 z-30 select-none ${
        isMeasureMode ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'
      }`}
    >
      {measureLine && (
        <>
          {/* Measurement Line SVG */}
          <svg className="w-full h-full absolute inset-0 pointer-events-none overflow-visible">
            <defs>
              <marker
                id="measure-arrow"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
              </marker>
            </defs>

            {/* Glowing background line */}
            <line
              x1={`${measureLine.x1Percent}%`}
              y1={`${measureLine.y1Percent}%`}
              x2={`${measureLine.x2Percent}%`}
              y2={`${measureLine.y2Percent}%`}
              stroke="#f59e0b"
              strokeWidth="4"
              strokeOpacity="0.25"
            />

            {/* Main dashed measurement line */}
            <line
              x1={`${measureLine.x1Percent}%`}
              y1={`${measureLine.y1Percent}%`}
              x2={`${measureLine.x2Percent}%`}
              y2={`${measureLine.y2Percent}%`}
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </svg>

          {/* Point 1 Crosshair Handle */}
          <div
            style={{ left: `${measureLine.x1Percent}%`, top: `${measureLine.y1Percent}%` }}
            onPointerDown={(e) => handleHandlePointerDown('p1', e)}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center cursor-crosshair z-30 pointer-events-auto group"
            title="نقطه شروع (درگ کنید)"
          >
            {/* Fine perpendicular crosshair lines */}
            <div className="absolute w-4 h-[1px] bg-amber-500 shadow-sm group-hover:bg-amber-400" />
            <div className="absolute h-4 w-[1px] bg-amber-500 shadow-sm group-hover:bg-amber-400" />
            {/* Precision intersection center dot */}
            <div className="w-1.5 h-1.5 rounded-full bg-white border border-amber-500 shadow-xs z-10" />
          </div>

          {/* Point 2 Crosshair Handle */}
          <div
            style={{ left: `${measureLine.x2Percent}%`, top: `${measureLine.y2Percent}%` }}
            onPointerDown={(e) => handleHandlePointerDown('p2', e)}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center cursor-crosshair z-30 pointer-events-auto group"
            title="نقطه پایان (درگ کنید)"
          >
            {/* Fine perpendicular crosshair lines */}
            <div className="absolute w-4 h-[1px] bg-amber-500 shadow-sm group-hover:bg-amber-400" />
            <div className="absolute h-4 w-[1px] bg-amber-500 shadow-sm group-hover:bg-amber-400" />
            {/* Precision intersection center dot */}
            <div className="w-1.5 h-1.5 rounded-full bg-white border border-amber-500 shadow-xs z-10" />
          </div>

          {/* Center Measurement Results Floating Card */}
          <div
            dir="rtl"
            style={{
              left: `${Math.max(10, Math.min(90, midXPct))}%`,
              top: `${Math.max(8, Math.min(92, midYPct))}%`,
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-auto bg-neutral-900/95 border border-amber-500/60 text-amber-200 p-2 rounded-xl shadow-2xl backdrop-blur-md min-w-[150px] animate-fade-in"
          >
            <div className="flex items-center justify-between pb-1 border-b border-amber-500/20 text-[10px] font-bold">
              <span className="flex items-center gap-1 text-amber-400">
                <RulerIcon className="w-3 h-3 text-amber-400" />
                <span>متر اندازه‌گیری</span>
                {(isShiftDown || activeHandle) && (
                  <span className="text-[8px] bg-amber-500/20 text-amber-300 px-1 rounded flex items-center gap-0.5">
                    <Lock className="w-2 h-2" />
                    Shift
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeMeasureLine(null);
                }}
                className="p-0.5 hover:text-white transition-colors cursor-pointer"
                title="بستن متر"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="pt-1.5 space-y-1 text-[11px] font-mono">
              <div className="flex items-center justify-between font-bold text-amber-300 text-xs">
                <span>فاصله مستقیم:</span>
                <span className="text-white bg-amber-600 px-1.5 py-0.2 rounded">
                  {distCm.toFixed(2)} cm ({distMm.toFixed(0)} mm)
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-neutral-300">
                <span>عرض (ΔX):</span>
                <span>{deltaXCm.toFixed(2)} cm</span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-neutral-300">
                <span>ارتفاع (ΔY):</span>
                <span>{deltaYCm.toFixed(2)} cm</span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-neutral-300 pt-0.5 border-t border-neutral-800">
                <span>زاویه:</span>
                <span>{angleDeg.toFixed(1)}°</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Helper Banner when Measure Mode is active */}
      {isMeasureMode && !measureLine && (
        <div className="absolute top-2 inset-x-0 flex justify-center pointer-events-none z-30">
          <div className="bg-amber-600/90 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 animate-bounce">
            <RulerIcon className="w-3.5 h-3.5" />
            <span>روی دو نقطه بوم کلیک و درگ کنید (نگه‌داشتن Shift = قفل زوایای افقی/عمودی)</span>
          </div>
        </div>
      )}
    </div>
  );
};
