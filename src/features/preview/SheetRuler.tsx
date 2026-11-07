import React from 'react';
import { LengthUnit, MM_PER_INCH } from '../../shared/units';

interface SheetRulerProps {
  axis: 'horizontal' | 'vertical';
  lengthMm: number;
  pxPerMm: number;
  unit: LengthUnit;
}

export const SheetRuler: React.FC<SheetRulerProps> = React.memo(
  ({ axis, lengthMm, pxPerMm, unit }) => {
    const totalPx = Math.max(1, Math.round(lengthMm * pxPerMm));

    // Step configuration in mm depending on unit
    const minorStepMm = unit === 'inch' ? MM_PER_INCH / 8 : 2; // 1/8 in or 2mm

    const ticks: Array<{ posPx: number; isMajor: boolean; isMid: boolean; label?: string }> = [];

    const totalSteps = Math.floor(lengthMm / minorStepMm + 0.0001);
    for (let i = 0; i <= totalSteps; i++) {
      const mm = i * minorStepMm;
      const posPx = mm * pxPerMm;
      const isMajor =
        unit === 'inch' ? i % 8 === 0 : i % 5 === 0;
      const isMid =
        unit === 'inch' ? i % 4 === 0 && !isMajor : false;

      let label: string | undefined;
      if (isMajor) {
        if (unit === 'mm') {
          // Avoid crowding when zoomed way out
          if (pxPerMm >= 1.6 || (i / 5) % 2 === 0) {
            label = String(Math.round(mm));
          }
        } else if (unit === 'cm') {
          label = String(Math.round(mm / 10));
        } else {
          label = String(Math.round(mm / MM_PER_INCH));
        }
      }

      ticks.push({ posPx, isMajor, isMid, label });
    }

    if (axis === 'horizontal') {
      return (
        <div
          dir="ltr"
          style={{ width: `${totalPx}px` }}
          className="h-5 relative bg-slate-200/90 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-t-xs overflow-hidden select-none shrink-0"
        >
          {ticks.map((t, idx) => (
            <div
              key={idx}
              style={{ left: `${t.posPx}px` }}
              className="absolute bottom-0 flex flex-col items-start pointer-events-none"
            >
              {t.label !== undefined && (
                <span className="text-[8px] font-num leading-none text-slate-600 dark:text-slate-400 translate-x-0.5 mb-0.5">
                  {t.label}
                </span>
              )}
              <div
                className={`w-px ${
                  t.isMajor
                    ? 'h-2.5 bg-slate-600 dark:bg-slate-300'
                    : t.isMid
                    ? 'h-2 bg-slate-500 dark:bg-slate-500'
                    : 'h-1 bg-slate-400/80 dark:bg-slate-600'
                }`}
              />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div
        dir="ltr"
        style={{ height: `${totalPx}px` }}
        className="w-5 relative bg-slate-200/90 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-s-xs overflow-hidden select-none shrink-0"
      >
        {ticks.map((t, idx) => (
          <div
            key={idx}
            style={{ top: `${t.posPx}px` }}
            className="absolute right-0 flex items-center justify-end pointer-events-none"
          >
            {t.label !== undefined && (
              <span className="text-[8px] font-num leading-none text-slate-600 dark:text-slate-400 me-0.5">
                {t.label}
              </span>
            )}
            <div
              className={`h-px ${
                t.isMajor
                  ? 'w-2.5 bg-slate-600 dark:bg-slate-300'
                  : t.isMid
                  ? 'w-2 bg-slate-500 dark:bg-slate-500'
                  : 'w-1 bg-slate-400/80 dark:bg-slate-600'
              }`}
            />
          </div>
        ))}
      </div>
    );
  }
);
