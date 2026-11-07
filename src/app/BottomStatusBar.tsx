import React from 'react';
import { Printer, Wifi, WifiOff } from 'lucide-react';
import type { ImpositionPlan } from '../features/imposition/impositionEngine';
import { formatLength, UNIT_LABELS } from '../shared/units';
import { useStudioStore } from '../store/useStudioStore';

interface BottomStatusBarProps {
  plan: ImpositionPlan;
}

export const BottomStatusBar: React.FC<BottomStatusBarProps> = ({ plan }) => {
  const unit = useStudioStore((s) => s.unit);
  const printers = useStudioStore((s) => s.printers);
  const printJob = useStudioStore((s) => s.printJob);
  const capabilities = useStudioStore((s) => s.capabilities);

  const activePrinter = printers.find((p) => p.name === printJob.printerName) ?? null;
  const activeBin =
    capabilities?.bins.find((b) => b.id === printJob.binId) ?? null;

  return (
    <footer className="h-7 px-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 text-[11px] text-slate-600 dark:text-slate-400 shrink-0 select-none">
      {/* Right: Printer & Tray Live Status */}
      <div className="flex items-center gap-2 min-w-0">
        {activePrinter ? (
          <>
            {activePrinter.isOffline ? (
              <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            )}
            <span className="truncate font-medium text-slate-700 dark:text-slate-200">
              {activePrinter.displayName}
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="truncate">
              سینی: <strong>{activeBin ? activeBin.name : 'خودکار درایور'}</strong>
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Printer className="w-3 h-3" />
            <span>چاپگری انتخاب نشده</span>
          </span>
        )}
      </div>

      {/* Left: Exact Physical Sheet Dimensions in unit + PDF points */}
      <div className="hidden sm:flex items-center gap-3 shrink-0 font-num" dir="ltr">
        <span>
          Sheet: {formatLength(plan.sheetWidthMm, unit)}×
          {formatLength(plan.sheetHeightMm, unit)} {UNIT_LABELS[unit].short} (
          {plan.sheetWidthPt.toFixed(1)}×{plan.sheetHeightPt.toFixed(1)} pt)
        </span>
        <span>·</span>
        <span>
          Grid: {plan.effectiveRows}×{plan.effectiveCols}
        </span>
      </div>
    </footer>
  );
};
