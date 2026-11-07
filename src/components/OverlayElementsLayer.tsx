import React, { useRef, useState, useEffect } from 'react';
import {
  PageOverlayText,
  PageOverlayShape,
  PageOverlayNumbering,
  PageAdjustment,
  CanvasGuideline,
} from '../types';
import { formatPageNumber } from '../utils/overlayRenderUtils';
import { Copy } from 'lucide-react';

interface OverlayElementsLayerProps {
  adjustment: PageAdjustment;
  pageNum: number;
  totalPages: number;
  isSelectedPage?: boolean;
  activeTool: 'move' | 'crop' | 'text' | 'shape' | 'numbering' | 'measure';
  selectedTextId: string | null;
  selectedShapeId: string | null;
  selectedNumberingId?: string | null;
  onSelectText: (id: string | null) => void;
  onSelectShape: (id: string | null) => void;
  onSelectNumbering?: (id: string | null) => void;
  onSelectTool: (tool: 'move' | 'crop' | 'text' | 'shape' | 'numbering' | 'measure') => void;
  onUpdateText: (id: string, updates: Partial<PageOverlayText>) => void;
  onUpdateShape: (id: string, updates: Partial<PageOverlayShape>) => void;
  onUpdateNumbering: (updates: Partial<PageOverlayNumbering>) => void;
  onUpdateNumberingItem?: (id: string, updates: Partial<PageOverlayNumbering>) => void;
  onDuplicateText?: (id: string, offset?: { x: number; y: number }) => string;
  onDuplicateShape?: (id: string, offset?: { x: number; y: number }) => string;
  onDuplicateNumbering?: (id: string, offset?: { x: number; y: number }) => string;
  onDoubleClickElement?: (type: 'text' | 'shape' | 'numbering', id: string) => void;
  snapToGrid?: boolean;
  guidelines?: CanvasGuideline[];
}

export const OverlayElementsLayer: React.FC<OverlayElementsLayerProps> = ({
  adjustment,
  pageNum,
  totalPages,
  isSelectedPage = true,
  activeTool,
  selectedTextId,
  selectedShapeId,
  selectedNumberingId,
  onSelectText,
  onSelectShape,
  onSelectNumbering,
  onSelectTool,
  onUpdateText,
  onUpdateShape,
  onUpdateNumbering,
  onUpdateNumberingItem,
  onDuplicateText,
  onDuplicateShape,
  onDuplicateNumbering,
  onDoubleClickElement,
  snapToGrid = false,
  guidelines = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementsDomMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const [isCtrlDown, setIsCtrlDown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Check if an overlay element is visible on this page based on targetScope
  const isElementVisible = (targetScope?: string) => {
    const scope = targetScope || 'current';
    if (scope === 'all') return true;
    if (scope === 'even') return pageNum % 2 === 0;
    if (scope === 'odd') return pageNum % 2 !== 0;
    if (scope === 'first') return pageNum === 1;
    if (scope === 'last') return pageNum === totalPages;
    if (scope === 'selected') return isSelectedPage !== false;
    return true; // 'current' or unspecified
  };

  // Track Ctrl/Alt/Meta key globally for cursor & duplicate badge
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) {
        setIsCtrlDown(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        setIsCtrlDown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // High-Performance Drag state with Direct DOM style updates
  const dragRef = useRef<{
    type: 'text' | 'shape' | 'numbering';
    id: string;
    handle?: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'w' | 'e';
    startX: number;
    startY: number;
    initX: number;
    initY: number;
    initW: number;
    initH: number;
    containerW: number;
    containerH: number;
    isCloned: boolean;
    pendingUpdates: any;
  } | null>(null);

  const rafIdRef = useRef<number | null>(null);

  const handlePointerDown = (
    type: 'text' | 'shape' | 'numbering',
    id: string,
    handle: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'w' | 'e',
    e: React.PointerEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const isCloneIntent = (e.ctrlKey || e.altKey || e.metaKey) && handle === 'move';
    let targetId = id;

    if (type === 'text') {
      onSelectTool('text');
      if (isCloneIntent && onDuplicateText) {
        const newCloneId = onDuplicateText(id, { x: 0, y: 0 });
        if (newCloneId) {
          targetId = newCloneId;
        }
      }
      onSelectText(targetId);
      const item = adjustment.texts?.find((t) => t.id === id);
      if (!item) return;

      dragRef.current = {
        type: 'text',
        id: targetId,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        initX: item.xPercent,
        initY: item.yPercent,
        initW: 0,
        initH: 0,
        containerW: rect.width || 1,
        containerH: rect.height || 1,
        isCloned: isCloneIntent,
        pendingUpdates: null,
      };
    } else if (type === 'shape') {
      onSelectTool('shape');
      if (isCloneIntent && onDuplicateShape) {
        const newCloneId = onDuplicateShape(id, { x: 0, y: 0 });
        if (newCloneId) {
          targetId = newCloneId;
        }
      }
      onSelectShape(targetId);
      const item = adjustment.shapes?.find((s) => s.id === id);
      if (!item) return;

      dragRef.current = {
        type: 'shape',
        id: targetId,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        initX: item.xPercent,
        initY: item.yPercent,
        initW: item.widthPercent,
        initH: item.heightPercent,
        containerW: rect.width || 1,
        containerH: rect.height || 1,
        isCloned: isCloneIntent,
        pendingUpdates: null,
      };
    } else if (type === 'numbering') {
      onSelectTool('numbering');
      if (isCloneIntent && onDuplicateNumbering) {
        const newCloneId = onDuplicateNumbering(id, { x: 0, y: 0 });
        if (newCloneId) {
          targetId = newCloneId;
        }
      }
      if (onSelectNumbering) {
        onSelectNumbering(targetId);
      }

      const numberingsList = adjustment.pageNumberings && adjustment.pageNumberings.length > 0
        ? adjustment.pageNumberings
        : (adjustment.pageNumbering ? [adjustment.pageNumbering] : []);

      const item = numberingsList.find((n) => n.id === id) || adjustment.pageNumbering;
      if (!item) return;

      dragRef.current = {
        type: 'numbering',
        id: targetId,
        handle: 'move',
        startX: e.clientX,
        startY: e.clientY,
        initX: item.xPercent,
        initY: item.yPercent,
        initW: 0,
        initH: 0,
        containerW: rect.width || 1,
        containerH: rect.height || 1,
        isCloned: isCloneIntent,
        pendingUpdates: null,
      };
    }

    setIsDragging(true);

    let latestEvX = e.clientX;
    let latestEvY = e.clientY;

    const onPointerMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      latestEvX = ev.clientX;
      latestEvY = ev.clientY;

      if (rafIdRef.current !== null) return;

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (!dragRef.current) return;

        const d = dragRef.current;
        const deltaX = latestEvX - d.startX;
        const deltaY = latestEvY - d.startY;
        const pctX = (deltaX / d.containerW) * 100;
        const pctY = (deltaY / d.containerH) * 100;

        let updates: any = {};

        if (d.type === 'text' || d.type === 'numbering') {
          let nextX = Math.max(0, Math.min(100, Number((d.initX + pctX).toFixed(2))));
          let nextY = Math.max(0, Math.min(100, Number((d.initY + pctY).toFixed(2))));

          if (snapToGrid) {
            if (guidelines && guidelines.length > 0) {
              for (const g of guidelines) {
                if (g.type === 'vertical' && Math.abs(nextX - g.positionPercent) < 1.5) {
                  nextX = g.positionPercent;
                }
                if (g.type === 'horizontal' && Math.abs(nextY - g.positionPercent) < 1.5) {
                  nextY = g.positionPercent;
                }
              }
            }
            const round5X = Math.round(nextX / 5) * 5;
            if (Math.abs(nextX - round5X) < 1.0) nextX = round5X;
            const round5Y = Math.round(nextY / 5) * 5;
            if (Math.abs(nextY - round5Y) < 1.0) nextY = round5Y;
          }

          updates = { xPercent: nextX, yPercent: nextY };

          // Direct DOM style mutation for zero input lag at 120FPS
          const domEl = elementsDomMap.current.get(d.id);
          if (domEl) {
            domEl.style.left = `${nextX}%`;
            domEl.style.top = `${nextY}%`;
          }
        } else if (d.type === 'shape') {
          if (d.handle === 'move') {
            let nextX = Math.max(0, Math.min(100 - d.initW, Number((d.initX + pctX).toFixed(2))));
            let nextY = Math.max(0, Math.min(100 - d.initH, Number((d.initY + pctY).toFixed(2))));

            if (snapToGrid) {
              if (guidelines && guidelines.length > 0) {
                for (const g of guidelines) {
                  if (g.type === 'vertical' && Math.abs(nextX - g.positionPercent) < 1.5) {
                    nextX = g.positionPercent;
                  }
                  if (g.type === 'horizontal' && Math.abs(nextY - g.positionPercent) < 1.5) {
                    nextY = g.positionPercent;
                  }
                }
              }
              const round5X = Math.round(nextX / 5) * 5;
              if (Math.abs(nextX - round5X) < 1.0) nextX = round5X;
              const round5Y = Math.round(nextY / 5) * 5;
              if (Math.abs(nextY - round5Y) < 1.0) nextY = round5Y;
            }

            updates = { xPercent: nextX, yPercent: nextY };

            const domEl = elementsDomMap.current.get(d.id);
            if (domEl) {
              domEl.style.left = `${nextX}%`;
              domEl.style.top = `${nextY}%`;
            }
          } else if (d.handle === 'se') {
            const nextW = Math.max(2, Math.min(100 - d.initX, Number((d.initW + pctX).toFixed(2))));
            const nextH = Math.max(2, Math.min(100 - d.initY, Number((d.initH + pctY).toFixed(2))));
            updates = { widthPercent: nextW, heightPercent: nextH };

            const domEl = elementsDomMap.current.get(d.id);
            if (domEl) {
              domEl.style.width = `${nextW}%`;
              domEl.style.height = `${nextH}%`;
            }
          } else if (d.handle === 'sw') {
            const nextX = Math.max(0, Math.min(d.initX + d.initW - 2, Number((d.initX + pctX).toFixed(2))));
            const nextW = Math.max(2, Number((d.initW - pctX).toFixed(2)));
            const nextH = Math.max(2, Math.min(100 - d.initY, Number((d.initH + pctY).toFixed(2))));
            updates = { xPercent: nextX, widthPercent: nextW, heightPercent: nextH };

            const domEl = elementsDomMap.current.get(d.id);
            if (domEl) {
              domEl.style.left = `${nextX}%`;
              domEl.style.width = `${nextW}%`;
              domEl.style.height = `${nextH}%`;
            }
          } else if (d.handle === 'ne') {
            const nextY = Math.max(0, Math.min(d.initY + d.initH - 2, Number((d.initY + pctY).toFixed(2))));
            const nextW = Math.max(2, Math.min(100 - d.initX, Number((d.initW + pctX).toFixed(2))));
            const nextH = Math.max(2, Number((d.initH - pctY).toFixed(2)));
            updates = { yPercent: nextY, widthPercent: nextW, heightPercent: nextH };

            const domEl = elementsDomMap.current.get(d.id);
            if (domEl) {
              domEl.style.top = `${nextY}%`;
              domEl.style.width = `${nextW}%`;
              domEl.style.height = `${nextH}%`;
            }
          } else if (d.handle === 'nw') {
            const nextX = Math.max(0, Math.min(d.initX + d.initW - 2, Number((d.initX + pctX).toFixed(2))));
            const nextY = Math.max(0, Math.min(d.initY + d.initH - 2, Number((d.initY + pctY).toFixed(2))));
            const nextW = Math.max(2, Number((d.initW - pctX).toFixed(2)));
            const nextH = Math.max(2, Number((d.initH - pctY).toFixed(2)));
            updates = { xPercent: nextX, yPercent: nextY, widthPercent: nextW, heightPercent: nextH };

            const domEl = elementsDomMap.current.get(d.id);
            if (domEl) {
              domEl.style.left = `${nextX}%`;
              domEl.style.top = `${nextY}%`;
              domEl.style.width = `${nextW}%`;
              domEl.style.height = `${nextH}%`;
            }
          } else if (d.handle === 'e') {
            // Horizontal stretch right
            const nextW = Math.max(2, Math.min(100 - d.initX, Number((d.initW + pctX).toFixed(2))));
            updates = { widthPercent: nextW };

            const domEl = elementsDomMap.current.get(d.id);
            if (domEl) {
              domEl.style.width = `${nextW}%`;
            }
          } else if (d.handle === 'w') {
            // Horizontal stretch left
            const nextX = Math.max(0, Math.min(d.initX + d.initW - 2, Number((d.initX + pctX).toFixed(2))));
            const nextW = Math.max(2, Number((d.initW - pctX).toFixed(2)));
            updates = { xPercent: nextX, widthPercent: nextW };

            const domEl = elementsDomMap.current.get(d.id);
            if (domEl) {
              domEl.style.left = `${nextX}%`;
              domEl.style.width = `${nextW}%`;
            }
          } else if (d.handle === 's') {
            // Vertical stretch bottom
            const nextH = Math.max(2, Math.min(100 - d.initY, Number((d.initH + pctY).toFixed(2))));
            updates = { heightPercent: nextH };

            const domEl = elementsDomMap.current.get(d.id);
            if (domEl) {
              domEl.style.height = `${nextH}%`;
            }
          } else if (d.handle === 'n') {
            // Vertical stretch top
            const nextY = Math.max(0, Math.min(d.initY + d.initH - 2, Number((d.initY + pctY).toFixed(2))));
            const nextH = Math.max(2, Number((d.initH - pctY).toFixed(2)));
            updates = { yPercent: nextY, heightPercent: nextH };

            const domEl = elementsDomMap.current.get(d.id);
            if (domEl) {
              domEl.style.top = `${nextY}%`;
              domEl.style.height = `${nextH}%`;
            }
          }
        }

        d.pendingUpdates = updates;
      });
    };

    const onPointerUp = (ev: PointerEvent) => {
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch {}

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      // Single deferred React state commit on drop
      if (dragRef.current && dragRef.current.pendingUpdates) {
        const { type, id, pendingUpdates } = dragRef.current;
        if (type === 'text') {
          onUpdateText(id, pendingUpdates);
        } else if (type === 'shape') {
          onUpdateShape(id, pendingUpdates);
        } else if (type === 'numbering') {
          if (onUpdateNumberingItem) {
            onUpdateNumberingItem(id, pendingUpdates);
          } else {
            onUpdateNumbering(pendingUpdates);
          }
        }
      }

      dragRef.current = null;
      setIsDragging(false);

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Compile list of page numbering instances
  const numberingsList: PageOverlayNumbering[] = [];
  if (adjustment.pageNumberings && adjustment.pageNumberings.length > 0) {
    numberingsList.push(...adjustment.pageNumberings);
  } else if (adjustment.pageNumbering) {
    numberingsList.push(adjustment.pageNumbering);
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-20 overflow-hidden"
    >
      {/* 1. Shapes Layer */}
      {adjustment.shapes?.map((shape) => {
        if (!isElementVisible(shape.targetScope)) return null;
        const isSelected = selectedShapeId === shape.id && activeTool === 'shape';
        return (
          <div
            key={shape.id}
            ref={(el) => {
              if (el) elementsDomMap.current.set(shape.id, el);
              else elementsDomMap.current.delete(shape.id);
            }}
            onPointerDown={(e) => handlePointerDown('shape', shape.id, 'move', e)}
            onClick={(e) => {
              e.stopPropagation();
              onSelectShape(shape.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onSelectShape(shape.id);
              onSelectTool('shape');
              onDoubleClickElement?.('shape', shape.id);
            }}
            style={{
              position: 'absolute',
              left: `${shape.xPercent}%`,
              top: `${shape.yPercent}%`,
              width: `${shape.widthPercent}%`,
              height: `${shape.heightPercent}%`,
              opacity: shape.opacity ?? 1,
              transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
              pointerEvents: 'auto',
              cursor: isCtrlDown ? 'copy' : 'move',
              transition: 'none',
              willChange: 'left, top, width, height, transform',
            }}
            className={`group ${
              isSelected
                ? 'ring-2 ring-blue-500 shadow-xl'
                : 'hover:ring-1 hover:ring-blue-400/80'
            }`}
            title="برای انتخاب و ویرایش کلیک کنید · با نگه داشتن Ctrl و درگ، تکثیر می‌شود"
          >
            {/* Ctrl Duplicate Badge on Hover */}
            {isCtrlDown && (
              <div className="absolute -top-3.5 right-0 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md flex items-center gap-0.5 z-30 pointer-events-none">
                <Copy className="w-2.5 h-2.5" />
                <span>تکثیر با درگ</span>
              </div>
            )}

            {/* Render shape visually */}
            {shape.type === 'rectangle' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: shape.fillColor || 'transparent',
                  borderColor: shape.strokeColor || '#000000',
                  borderWidth: `${shape.strokeWidth || 2}px`,
                  borderStyle: shape.strokeStyle || 'solid',
                }}
              />
            )}
            {shape.type === 'rounded-rect' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: shape.fillColor || 'transparent',
                  borderColor: shape.strokeColor || '#000000',
                  borderWidth: `${shape.strokeWidth || 2}px`,
                  borderStyle: shape.strokeStyle || 'solid',
                  borderRadius: `${shape.borderRadius || 12}px`,
                }}
              />
            )}
            {(shape.type === 'circle' || shape.type === 'ellipse') && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: shape.fillColor || 'transparent',
                  borderColor: shape.strokeColor || '#000000',
                  borderWidth: `${shape.strokeWidth || 2}px`,
                  borderStyle: shape.strokeStyle || 'solid',
                  borderRadius: '9999px',
                }}
              />
            )}
            {shape.type === 'line' && (
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                <line
                  x1="0"
                  y1="50"
                  x2="100"
                  y2="50"
                  stroke={shape.strokeColor || '#000000'}
                  strokeWidth={shape.strokeWidth || 2}
                  strokeDasharray={shape.strokeStyle === 'dashed' ? '8,4' : shape.strokeStyle === 'dotted' ? '3,3' : undefined}
                />
              </svg>
            )}
            {shape.type === 'arrow' && (
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line
                  x1="0"
                  y1="50"
                  x2="85"
                  y2="50"
                  stroke={shape.strokeColor || '#000000'}
                  strokeWidth={shape.strokeWidth || 3}
                  strokeDasharray={shape.strokeStyle === 'dashed' ? '6,4' : shape.strokeStyle === 'dotted' ? '3,3' : undefined}
                />
                <polygon
                  points="80,35 100,50 80,65"
                  fill={shape.strokeColor || '#000000'}
                />
              </svg>
            )}
            {shape.type === 'triangle' && (
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polygon
                  points="50,2 98,98 2,98"
                  fill={shape.fillColor || 'transparent'}
                  stroke={shape.strokeColor || '#000000'}
                  strokeWidth={shape.strokeWidth || 2}
                  strokeDasharray={shape.strokeStyle === 'dashed' ? '6,4' : shape.strokeStyle === 'dotted' ? '3,3' : undefined}
                />
              </svg>
            )}
            {shape.type === 'polygon' && (
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polygon
                  points="25,2 75,2 98,50 75,98 25,98 2,50"
                  fill={shape.fillColor || 'transparent'}
                  stroke={shape.strokeColor || '#000000'}
                  strokeWidth={shape.strokeWidth || 2}
                  strokeDasharray={shape.strokeStyle === 'dashed' ? '6,4' : shape.strokeStyle === 'dotted' ? '3,3' : undefined}
                />
              </svg>
            )}
            {shape.type === 'diamond' && (
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polygon
                  points="50,2 98,50 50,98 2,50"
                  fill={shape.fillColor || 'transparent'}
                  stroke={shape.strokeColor || '#000000'}
                  strokeWidth={shape.strokeWidth || 2}
                  strokeDasharray={shape.strokeStyle === 'dashed' ? '6,4' : shape.strokeStyle === 'dotted' ? '3,3' : undefined}
                />
              </svg>
            )}
            {shape.type === 'star' && (
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polygon
                  points="50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36"
                  fill={shape.fillColor || 'transparent'}
                  stroke={shape.strokeColor || '#000000'}
                  strokeWidth={shape.strokeWidth || 2}
                  strokeDasharray={shape.strokeStyle === 'dashed' ? '6,4' : shape.strokeStyle === 'dotted' ? '3,3' : undefined}
                />
              </svg>
            )}
            {shape.type === 'badge' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: shape.fillColor || 'transparent',
                  borderColor: shape.strokeColor || '#000000',
                  borderWidth: `${shape.strokeWidth || 2}px`,
                  borderRadius: '9999px',
                }}
                className="flex items-center justify-center font-bold text-xs"
              />
            )}

            {/* Resize & Stretch Handles if Selected */}
            {isSelected && (
              <>
                {/* 4 Corner Handles */}
                <div
                  onPointerDown={(e) => handlePointerDown('shape', shape.id, 'nw', e)}
                  className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-xs cursor-nwse-resize z-30 shadow-xs"
                  title="تغییر اندازه از گوشه بالا-چپ"
                />
                <div
                  onPointerDown={(e) => handlePointerDown('shape', shape.id, 'ne', e)}
                  className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-xs cursor-nesw-resize z-30 shadow-xs"
                  title="تغییر اندازه از گوشه بالا-راست"
                />
                <div
                  onPointerDown={(e) => handlePointerDown('shape', shape.id, 'se', e)}
                  className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-xs cursor-nwse-resize z-30 shadow-xs"
                  title="تغییر اندازه از گوشه پایین-راست"
                />
                <div
                  onPointerDown={(e) => handlePointerDown('shape', shape.id, 'sw', e)}
                  className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-xs cursor-nesw-resize z-30 shadow-xs"
                  title="تغییر اندازه از گوشه پایین-چپ"
                />

                {/* 4 Directional Edge Stretch Handles (کشیدن و تغییر اندازه) */}
                <div
                  onPointerDown={(e) => handlePointerDown('shape', shape.id, 'n', e)}
                  className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-purple-600 rounded-xs cursor-ns-resize z-30 shadow-xs"
                  title="کشش عمودی به بالا"
                />
                <div
                  onPointerDown={(e) => handlePointerDown('shape', shape.id, 's', e)}
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-purple-600 rounded-xs cursor-ns-resize z-30 shadow-xs"
                  title="کشش عمودی به پایین"
                />
                <div
                  onPointerDown={(e) => handlePointerDown('shape', shape.id, 'w', e)}
                  className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-purple-600 rounded-xs cursor-ew-resize z-30 shadow-xs"
                  title="کشش افقی به چپ"
                />
                <div
                  onPointerDown={(e) => handlePointerDown('shape', shape.id, 'e', e)}
                  className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-purple-600 rounded-xs cursor-ew-resize z-30 shadow-xs"
                  title="کشش افقی به راست"
                />
              </>
            )}
          </div>
        );
      })}

      {/* 2. Text Overlays Layer */}
      {adjustment.texts?.map((textObj) => {
        if (!isElementVisible(textObj.targetScope)) return null;
        const isSelected = selectedTextId === textObj.id && activeTool === 'text';
        return (
          <div
            key={textObj.id}
            ref={(el) => {
              if (el) elementsDomMap.current.set(textObj.id, el);
              else elementsDomMap.current.delete(textObj.id);
            }}
            onPointerDown={(e) => handlePointerDown('text', textObj.id, 'move', e)}
            onClick={(e) => {
              e.stopPropagation();
              onSelectText(textObj.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onSelectText(textObj.id);
              onSelectTool('text');
              onDoubleClickElement?.('text', textObj.id);
            }}
            style={{
              position: 'absolute',
              left: `${textObj.xPercent}%`,
              top: `${textObj.yPercent}%`,
              transform: `translate(-50%, -50%) ${textObj.rotation ? `rotate(${textObj.rotation}deg)` : ''}`,
              fontSize: `${textObj.fontSize || 18}px`,
              fontFamily: textObj.fontFamily || 'Vazirmatn, sans-serif',
              fontWeight: textObj.bold ? 'bold' : 'normal',
              fontStyle: textObj.italic ? 'italic' : 'normal',
              textDecoration: textObj.underline ? 'underline' : 'none',
              textAlign: textObj.align || 'center',
              color: textObj.color || '#000000',
              backgroundColor: textObj.backgroundColor || 'transparent',
              opacity: textObj.opacity ?? 1,
              pointerEvents: 'auto',
              cursor: isCtrlDown ? 'copy' : 'move',
              transition: 'none',
              willChange: 'left, top, transform',
            }}
            className={`px-2 py-1 rounded whitespace-pre-wrap select-none ${
              isSelected
                ? 'ring-2 ring-blue-500 bg-blue-500/10 shadow-lg'
                : 'hover:ring-1 hover:ring-blue-400/80'
            }`}
            title="برای انتخاب و ویرایش کلیک کنید · با نگه داشتن Ctrl و درگ، تکثیر می‌شود"
          >
            {/* Ctrl Duplicate Badge on Hover */}
            {isCtrlDown && (
              <div className="absolute -top-4 right-0 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md flex items-center gap-0.5 z-30 pointer-events-none whitespace-nowrap">
                <Copy className="w-2.5 h-2.5" />
                <span>تکثیر با درگ</span>
              </div>
            )}

            {textObj.text || 'متن جدید'}
            {textObj.syncGroupId && (
              <span className="absolute -top-3 left-0 text-[9px] bg-purple-600 text-white px-1 rounded font-sans font-bold">
                همگام
              </span>
            )}
          </div>
        );
      })}

      {/* 3. Dynamic Page Numbering Overlays Layer */}
      {numberingsList.map((numConfig) => {
        if (!numConfig.enabled || !isElementVisible(numConfig.targetScope)) return null;
        const formatted = formatPageNumber(pageNum, totalPages, numConfig);
        const isSelected = activeTool === 'numbering' && (selectedNumberingId === numConfig.id || numberingsList.length === 1);

        return (
          <div
            key={numConfig.id}
            ref={(el) => {
              if (el) elementsDomMap.current.set(numConfig.id, el);
              else elementsDomMap.current.delete(numConfig.id);
            }}
            onPointerDown={(e) => handlePointerDown('numbering', numConfig.id, 'move', e)}
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectNumbering) {
                onSelectNumbering(numConfig.id);
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (onSelectNumbering) {
                onSelectNumbering(numConfig.id);
              }
              onSelectTool('numbering');
              onDoubleClickElement?.('numbering', numConfig.id);
            }}
            style={{
              position: 'absolute',
              left: `${numConfig.xPercent}%`,
              top: `${numConfig.yPercent}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: `${numConfig.fontSize || 14}px`,
              fontFamily: numConfig.fontFamily || 'Vazirmatn, sans-serif',
              fontWeight: numConfig.bold ? 'bold' : 'normal',
              fontStyle: numConfig.italic ? 'italic' : 'normal',
              color: numConfig.color || '#1e293b',
              backgroundColor: numConfig.backgroundColor || 'transparent',
              opacity: numConfig.opacity ?? 1,
              pointerEvents: 'auto',
              cursor: isCtrlDown ? 'copy' : 'move',
              transition: 'none',
              willChange: 'left, top, transform',
            }}
            className={`px-2 py-0.5 rounded whitespace-nowrap select-none ${
              isSelected
                ? 'ring-2 ring-emerald-500 bg-emerald-500/15 shadow-lg'
                : 'hover:ring-1 hover:ring-emerald-400/80'
            }`}
            title="شماره صفحه (برای انتخاب کلیک کنید، یا برای جابجایی بکشید. با Ctrl و درگ تکثیر می‌شود)"
          >
            {/* Ctrl Duplicate Badge on Hover */}
            {isCtrlDown && (
              <div className="absolute -top-4 right-0 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md flex items-center gap-0.5 z-30 pointer-events-none whitespace-nowrap">
                <Copy className="w-2.5 h-2.5" />
                <span>تکثیر با درگ</span>
              </div>
            )}

            {formatted}
          </div>
        );
      })}
    </div>
  );
};
