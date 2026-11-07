import React from 'react';
import { LayoutGrid, Printer } from 'lucide-react';
import type { ImpositionPlan } from '../features/imposition/impositionEngine';
import { LayoutTabPanel } from '../features/imposition/LayoutTabPanel';
import { PrintTabPanel } from '../features/printer/PrintTabPanel';
import { isDriverPaperMatchingSheet } from '../shared/paperSizes';
import { useStudioStore } from '../store/useStudioStore';

interface InspectorPanelProps {
  plan: ImpositionPlan;
  onRefreshPrinters: () => void;
  onExecutePrint: (mode: 'all' | 'test-single-sheet') => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  plan,
  onRefreshPrinters,
  onExecutePrint,
}) => {
  const inspectorTab = useStudioStore((s) => s.inspectorTab);
  const setInspectorTab = useStudioStore((s) => s.setInspectorTab);
  const capabilities = useStudioStore((s) => s.capabilities);
  const printJob = useStudioStore((s) => s.printJob);
  const pagesCount = useStudioStore((s) => s.pages.length);

  const selectedPaper =
    capabilities?.papers.find((p) => p.id === printJob.paperId) ?? null;
  const hasPrintWarning =
    pagesCount > 0 &&
    selectedPaper !== null &&
    !isDriverPaperMatchingSheet(plan.sheetWidthMm, plan.sheetHeightMm, selectedPaper);

  return (
    <aside className="w-84 shrink-0 h-full border-s border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 flex flex-col select-none">
      {/* Focused 2-Tab Header: چیدمان | چاپ */}
      <div className="grid grid-cols-2 p-1.5 gap-1 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 shrink-0">
        <button
          type="button"
          onClick={() => setInspectorTab('layout')}
          className={`h-8 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            inspectorTab === 'layout'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>چیدمان</span>
          {plan.warnings.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setInspectorTab('print')}
          className={`h-8 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            inspectorTab === 'print'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Printer className="w-3.5 h-3.5" />
          <span>چاپ</span>
          {hasPrintWarning && (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>
      </div>

      {/* Scrollable Active Tab Body */}
      <div className="flex-1 overflow-y-auto">
        {inspectorTab === 'layout' ? (
          <LayoutTabPanel plan={plan} />
        ) : (
          <PrintTabPanel
            plan={plan}
            onRefreshPrinters={onRefreshPrinters}
            onExecutePrint={onExecutePrint}
          />
        )}
      </div>
    </aside>
  );
};
