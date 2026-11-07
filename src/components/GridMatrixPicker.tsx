import React, { useState, useRef, useEffect } from 'react';
import { Grid, ChevronDown } from 'lucide-react';

interface GridMatrixPickerProps {
  rows: number;
  cols: number;
  onChange: (rows: number, cols: number) => void;
  theme: 'dark' | 'light';
  maxRows?: number;
  maxCols?: number;
}

export const GridMatrixPicker: React.FC<GridMatrixPickerProps> = ({
  rows,
  cols,
  onChange,
  theme,
  maxRows = 12,
  maxCols = 11,
}) => {
  const isDark = theme === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const [hoverRows, setHoverRows] = useState(rows);
  const [hoverCols, setHoverCols] = useState(cols);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activePagesCount = rows * cols;
  const hoverPagesCount = hoverRows * hoverCols;

  const handleCellClick = (r: number, c: number) => {
    onChange(r, c);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Trigger Button matching screenshot button style */}
      <button
        type="button"
        onClick={() => {
          setHoverRows(rows);
          setHoverCols(cols);
          setIsOpen(!isOpen);
        }}
        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer min-w-[76px] ${
          isOpen
            ? 'bg-blue-600/15 border-blue-500 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
            : isDark
            ? 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700 text-neutral-200'
            : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 shadow-xs'
        }`}
      >
        {/* Visual Mini Grid Icon */}
        <div className="w-6 h-6 grid grid-cols-3 grid-rows-3 gap-[2px] p-0.5 mb-0.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-[1px] ${
                isOpen || activePagesCount > 1
                  ? 'bg-blue-500'
                  : isDark
                  ? 'bg-neutral-500'
                  : 'bg-slate-400'
              }`}
            />
          ))}
        </div>

        <span className="text-[10px] font-mono leading-tight opacity-75">
          ({activePagesCount} صفحه)
        </span>
        <div className="flex items-center gap-0.5 text-xs font-bold font-mono">
          <span>{cols} × {rows}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </div>
      </button>

      {/* 11x12 Grid Popup (Exact Replica of User's Screenshot) */}
      {isOpen && (
        <div
          dir="ltr"
          className={`absolute top-full start-0 mt-2 z-50 p-3 rounded-2xl border shadow-2xl animate-fade-in ${
            isDark
              ? 'bg-neutral-900 border-neutral-750 text-neutral-100 shadow-black/80'
              : 'bg-white border-slate-300 text-slate-900 shadow-slate-400/40'
          }`}
          style={{ width: 'max-content' }}
        >
          {/* Header Title */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800/40 text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <Grid className="w-3.5 h-3.5 text-blue-500" />
              <span>چیدمان جدولی (N-Up Imposition)</span>
            </span>
            <span className="font-mono text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded text-[11px]">
              {hoverCols} × {hoverRows} ({hoverPagesCount} صفحه)
            </span>
          </div>

          {/* Interactive Matrix Grid (Rows x Cols) */}
          <div
            className="grid gap-[3px] p-1 bg-slate-100 dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 select-none"
            style={{
              gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))`,
            }}
            onMouseLeave={() => {
              setHoverRows(rows);
              setHoverCols(cols);
            }}
          >
            {Array.from({ length: maxRows }).map((_, rIdx) => {
              const r = rIdx + 1;
              return Array.from({ length: maxCols }).map((_, cIdx) => {
                const c = cIdx + 1;
                const isHighlighted = r <= hoverRows && c <= hoverCols;
                const isSelected = r <= rows && c <= cols;

                return (
                  <div
                    key={`${r}-${c}`}
                    onMouseEnter={() => {
                      setHoverRows(r);
                      setHoverCols(c);
                    }}
                    onClick={() => handleCellClick(r, c)}
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-[4px] border transition-all cursor-pointer ${
                      isHighlighted
                        ? 'bg-blue-500/80 border-blue-600 scale-95 shadow-xs'
                        : isSelected
                        ? 'bg-blue-500/30 border-blue-400'
                        : isDark
                        ? 'bg-neutral-850 border-neutral-750 hover:border-neutral-600'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                    title={`${c} ستون × ${r} ردیف (${r * c} صفحه)`}
                  />
                );
              });
            })}
          </div>

          {/* Quick presets footer */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-neutral-800/40 text-[11px]">
            <span className="text-neutral-400">پریست‌های متداول:</span>
            <div className="flex items-center gap-1 font-mono">
              {[
                { r: 1, c: 1, label: '1×1' },
                { r: 1, c: 2, label: '2×1' },
                { r: 2, c: 2, label: '2×2' },
                { r: 3, c: 2, label: '2×3' },
                { r: 4, c: 3, label: '3×4' },
                { r: 4, c: 4, label: '4×4' },
                { r: 5, c: 2, label: 'کارت ویزیت ۱۰ تایی (2×5)' },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleCellClick(p.r, p.c)}
                  className={`px-1.5 py-0.5 rounded border transition-colors ${
                    rows === p.r && cols === p.c
                      ? 'bg-blue-600 text-white border-blue-500'
                      : isDark
                      ? 'bg-neutral-800 border-neutral-750 text-neutral-300 hover:bg-neutral-750'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
