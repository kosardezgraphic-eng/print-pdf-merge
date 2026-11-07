import { create } from 'zustand';
import {
  BUILTIN_LAYOUT_PRESETS,
  DEFAULT_LAYOUT_SETTINGS,
} from '../features/imposition/defaultPresets';
import type { ImpositionPlan } from '../features/imposition/impositionEngine';
import {
  clearVault,
  getSourceFromVault,
  listVaultMetas,
  removeUnusedSourcesFromVault,
} from '../features/pages/fileVault';
import { evictPdfProxyCache } from '../features/pages/previewRenderer';
import { findBestDriverPaper, resolveSheetDimensionsMm } from '../shared/paperSizes';
import {
  DriverBinCapability,
  DriverPaperCapability,
  EMPTY_SLOT_MARKER,
  LayoutPreset,
  LayoutSettings,
  PageItem,
  PrintJobSettings,
  PrintProgressState,
  PrinterCapabilities,
  PrinterInfo,
  RotationDegrees,
  SlotOverridesMap,
} from '../shared/types';
import type { LengthUnit } from '../shared/units';

const STORAGE_KEY = 'kosar_print_studio_state_v2';
const MAX_HISTORY = 40;
const HISTORY_COALESCE_MS = 400;

export interface HistorySnapshot {
  pages: PageItem[];
  layout: LayoutSettings;
  slotOverrides: SlotOverridesMap;
}

export interface PersistedPageEntry {
  filePath: string;
  sourcePageIndex: number;
  rotation: RotationDegrees;
  enabled: boolean;
  copies: number;
}

interface PersistedWorkspaceData {
  theme: 'dark' | 'light';
  unit: LengthUnit;
  showRulers: boolean;
  showGuides: boolean;
  layout: LayoutSettings;
  customPresets: LayoutPreset[];
  printJob: PrintJobSettings;
  desktopPageManifest?: PersistedPageEntry[];
}

function loadPersistedData(): Partial<PersistedWorkspaceData> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedWorkspaceData>;
  } catch {
    return {};
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(state: StudioStoreState): void {
  if (typeof window === 'undefined') return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const metasById = new Map(listVaultMetas().map((m) => [m.id, m]));
      const desktopManifest: PersistedPageEntry[] = [];
      for (const p of state.pages) {
        const meta = metasById.get(p.sourceFileId);
        if (meta?.filePath) {
          desktopManifest.push({
            filePath: meta.filePath,
            sourcePageIndex: p.sourcePageIndex,
            rotation: p.rotation,
            enabled: p.enabled,
            copies: p.copies,
          });
        }
      }

      const payload: PersistedWorkspaceData = {
        theme: state.theme,
        unit: state.unit,
        showRulers: state.showRulers,
        showGuides: state.showGuides,
        layout: state.layout,
        customPresets: state.customPresets,
        printJob: state.printJob,
        desktopPageManifest: desktopManifest.length > 0 ? desktopManifest : undefined,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota errors
    }
  }, 250);
}

export interface ToastNotice {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface StudioStoreState {
  // UI Preferences
  theme: 'dark' | 'light';
  unit: LengthUnit;
  inspectorTab: 'layout' | 'print';
  zoom: number;
  showRulers: boolean;
  showGuides: boolean;
  activeSheetIndex: number;

  // Pages & Selection
  pages: PageItem[];
  selectedPageIds: string[];
  lastSelectedPageId: string | null;
  isIngesting: boolean;
  ingestStatusText: string;

  // Layout & Presets
  layout: LayoutSettings;
  slotOverrides: SlotOverridesMap;
  customPresets: LayoutPreset[];

  // Printer & Native Print Job
  printers: PrinterInfo[];
  capabilities: PrinterCapabilities | null;
  isLoadingPrinters: boolean;
  isLoadingCapabilities: boolean;
  printJob: PrintJobSettings;
  printProgress: PrintProgressState;

  // Undo / Redo
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];
  lastHistoryTimestamp: number;

  // Notifications
  toasts: ToastNotice[];
  desktopManifestToRestore: PersistedPageEntry[];

  // Actions: UI
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setUnit: (unit: LengthUnit) => void;
  setInspectorTab: (tab: 'layout' | 'print') => void;
  setZoom: (zoom: number) => void;
  setShowRulers: (show: boolean) => void;
  setShowGuides: (show: boolean) => void;
  setActiveSheetIndex: (idx: number) => void;
  pushToast: (type: ToastNotice['type'], message: string) => void;
  dismissToast: (id: string) => void;

  // Actions: Pages
  setIngestStatus: (isIngesting: boolean, text?: string) => void;
  appendPages: (newPages: PageItem[]) => void;
  selectPage: (pageId: string, modifiers?: { shift?: boolean; ctrlOrMeta?: boolean }) => void;
  selectAllPages: () => void;
  clearPageSelection: () => void;
  togglePageEnabled: (pageId: string) => void;
  setAllPagesEnabled: (enabled: boolean) => void;
  rotatePagesClockwise: (pageIds: string[]) => void;
  setPageCopies: (pageId: string, copies: number) => void;
  removePages: (pageIds: string[]) => void;
  reorderPages: (draggedIds: string[], targetIndex: number) => void;
  clearAllWorkspace: () => void;
  clearDesktopRestoreManifest: () => void;

  // Actions: Layout & Matrix Cells
  updateLayout: (updates: Partial<LayoutSettings>, coalesceHistory?: boolean) => void;
  updateMarginSide: (
    side: 'top' | 'bottom' | 'left' | 'right',
    valueMm: number,
    coalesceHistory?: boolean
  ) => void;
  setMarginsLocked: (locked: boolean) => void;
  assignSlotOverride: (sheetIndex: number, cellIndex: number, pageIdOrEmpty: string | null) => void;
  swapSlotsOnSheet: (
    fromSheet: number,
    fromCell: number,
    toSheet: number,
    toCell: number,
    currentPlan: ImpositionPlan
  ) => void;
  resetSlotOverrides: () => void;

  // Actions: Presets
  applyPreset: (preset: LayoutPreset) => void;
  saveCustomPreset: (name: string, description?: string) => void;
  deleteCustomPreset: (presetId: string) => void;

  // Actions: Printer
  setPrinters: (printers: PrinterInfo[]) => void;
  setIsLoadingPrinters: (loading: boolean) => void;
  setCapabilities: (caps: PrinterCapabilities | null) => void;
  setIsLoadingCapabilities: (loading: boolean) => void;
  updatePrintJob: (updates: Partial<PrintJobSettings>) => void;
  selectDriverPaper: (paper: DriverPaperCapability) => void;
  selectDriverBin: (bin: DriverBinCapability | null) => void;
  setPrintProgress: (progress: PrintProgressState) => void;

  // Actions: Undo / Redo
  undo: () => void;
  redo: () => void;
}

const persisted = loadPersistedData();

const initialLayout: LayoutSettings = {
  ...DEFAULT_LAYOUT_SETTINGS,
  ...(persisted.layout ?? {}),
  marginsMm: {
    ...DEFAULT_LAYOUT_SETTINGS.marginsMm,
    ...(persisted.layout?.marginsMm ?? {}),
  },
};

const initialPrintJob: PrintJobSettings = {
  printerName: persisted.printJob?.printerName ?? '',
  paperId: persisted.printJob?.paperId ?? 9, // A4 default
  paperName: persisted.printJob?.paperName ?? 'A4',
  binId: persisted.printJob?.binId ?? null,
  binName: persisted.printJob?.binName ?? 'انتخاب خودکار سینی (Auto)',
  duplex: persisted.printJob?.duplex ?? 'simplex',
  colorMode: persisted.printJob?.colorMode ?? 'color',
  copies: persisted.printJob?.copies ?? 1,
  collate: persisted.printJob?.collate ?? true,
  sheetRangeMode: 'all',
  customSheetRange: '',
};

function cloneSnapshot(state: Pick<StudioStoreState, 'pages' | 'layout' | 'slotOverrides'>): HistorySnapshot {
  return {
    pages: state.pages.map((p) => ({ ...p })),
    layout: {
      ...state.layout,
      marginsMm: { ...state.layout.marginsMm },
    },
    slotOverrides: { ...state.slotOverrides },
  };
}

function recordHistory(
  state: StudioStoreState,
  coalesce = false
): { historyPast: HistorySnapshot[]; historyFuture: HistorySnapshot[]; lastHistoryTimestamp: number } {
  const now = Date.now();
  if (coalesce && now - state.lastHistoryTimestamp < HISTORY_COALESCE_MS && state.historyPast.length > 0) {
    return {
      historyPast: state.historyPast,
      historyFuture: [],
      lastHistoryTimestamp: now,
    };
  }
  const snap = cloneSnapshot(state);
  const nextPast = [...state.historyPast.slice(-(MAX_HISTORY - 1)), snap];
  return {
    historyPast: nextPast,
    historyFuture: [],
    lastHistoryTimestamp: now,
  };
}

export const useStudioStore = create<StudioStoreState>((set, get) => ({
  theme: persisted.theme ?? 'dark',
  unit: persisted.unit ?? 'mm',
  inspectorTab: 'layout',
  zoom: 0.85,
  showRulers: persisted.showRulers ?? true,
  showGuides: persisted.showGuides ?? true,
  activeSheetIndex: 0,

  pages: [],
  selectedPageIds: [],
  lastSelectedPageId: null,
  isIngesting: false,
  ingestStatusText: '',

  layout: initialLayout,
  slotOverrides: {},
  customPresets: persisted.customPresets ?? [],

  printers: [],
  capabilities: null,
  isLoadingPrinters: false,
  isLoadingCapabilities: false,
  printJob: initialPrintJob,
  printProgress: {
    phase: 'idle',
    percent: 0,
    messageFa: '',
  },

  historyPast: [],
  historyFuture: [],
  lastHistoryTimestamp: 0,

  toasts: [],
  desktopManifestToRestore: persisted.desktopPageManifest ?? [],

  setTheme: (theme) => {
    set({ theme });
    schedulePersist(get());
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    set({ theme: next });
    schedulePersist(get());
  },

  setUnit: (unit) => {
    set({ unit });
    schedulePersist(get());
  },

  setInspectorTab: (inspectorTab) => set({ inspectorTab }),

  setZoom: (zoom) => set({ zoom: Math.min(3.0, Math.max(0.25, Number(zoom.toFixed(2)))) }),

  setShowRulers: (showRulers) => {
    set({ showRulers });
    schedulePersist(get());
  },

  setShowGuides: (showGuides) => {
    set({ showGuides });
    schedulePersist(get());
  },

  setActiveSheetIndex: (idx) => set({ activeSheetIndex: Math.max(0, idx) }),

  pushToast: (type, message) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({
      toasts: [...s.toasts.slice(-4), { id, type, message }],
    }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 4500);
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  setIngestStatus: (isIngesting, text = '') => {
    set({ isIngesting, ingestStatusText: text });
  },

  appendPages: (newPages) => {
    if (newPages.length === 0) return;
    set((state) => {
      const hist = recordHistory(state, false);
      const merged = [...state.pages, ...newPages];
      return {
        ...hist,
        pages: merged,
        selectedPageIds:
          state.selectedPageIds.length === 0 && newPages[0]
            ? [newPages[0].id]
            : state.selectedPageIds,
        lastSelectedPageId: state.lastSelectedPageId ?? newPages[0]?.id ?? null,
      };
    });
    schedulePersist(get());
  },

  selectPage: (pageId, modifiers) => {
    set((state) => {
      const { pages, selectedPageIds, lastSelectedPageId } = state;
      if (modifiers?.shift && lastSelectedPageId) {
        const a = pages.findIndex((p) => p.id === lastSelectedPageId);
        const b = pages.findIndex((p) => p.id === pageId);
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          const rangeIds = pages.slice(lo, hi + 1).map((p) => p.id);
          const union = Array.from(new Set([...selectedPageIds, ...rangeIds]));
          return { selectedPageIds: union };
        }
      }
      if (modifiers?.ctrlOrMeta) {
        const exists = selectedPageIds.includes(pageId);
        const next = exists
          ? selectedPageIds.filter((id) => id !== pageId)
          : [...selectedPageIds, pageId];
        return { selectedPageIds: next, lastSelectedPageId: pageId };
      }
      return { selectedPageIds: [pageId], lastSelectedPageId: pageId };
    });
  },

  selectAllPages: () => {
    set((state) => ({
      selectedPageIds: state.pages.map((p) => p.id),
    }));
  },

  clearPageSelection: () => set({ selectedPageIds: [], lastSelectedPageId: null }),

  togglePageEnabled: (pageId) => {
    set((state) => {
      const hist = recordHistory(state, false);
      return {
        ...hist,
        pages: state.pages.map((p) =>
          p.id === pageId ? { ...p, enabled: !p.enabled } : p
        ),
      };
    });
    schedulePersist(get());
  },

  setAllPagesEnabled: (enabled) => {
    set((state) => {
      const hist = recordHistory(state, false);
      return {
        ...hist,
        pages: state.pages.map((p) => ({ ...p, enabled })),
      };
    });
    schedulePersist(get());
  },

  rotatePagesClockwise: (pageIds) => {
    if (pageIds.length === 0) return;
    const idSet = new Set(pageIds);
    set((state) => {
      const hist = recordHistory(state, false);
      return {
        ...hist,
        pages: state.pages.map((p) =>
          idSet.has(p.id)
            ? { ...p, rotation: (((p.rotation + 90) % 360) as RotationDegrees) }
            : p
        ),
      };
    });
    schedulePersist(get());
  },

  setPageCopies: (pageId, copies) => {
    const safeCopies = Math.max(1, Math.min(500, Math.floor(copies || 1)));
    set((state) => {
      const hist = recordHistory(state, true);
      return {
        ...hist,
        pages: state.pages.map((p) =>
          p.id === pageId ? { ...p, copies: safeCopies } : p
        ),
      };
    });
    schedulePersist(get());
  },

  removePages: (pageIds) => {
    if (pageIds.length === 0) return;
    const removeSet = new Set(pageIds);
    set((state) => {
      const hist = recordHistory(state, false);
      const remaining = state.pages.filter((p) => !removeSet.has(p.id));
      // Clean any slotOverrides pointing to deleted pages
      const nextOverrides: SlotOverridesMap = {};
      for (const [k, v] of Object.entries(state.slotOverrides)) {
        if (v === EMPTY_SLOT_MARKER || !removeSet.has(v)) {
          nextOverrides[k] = v;
        }
      }
      return {
        ...hist,
        pages: remaining,
        selectedPageIds: state.selectedPageIds.filter((id) => !removeSet.has(id)),
        slotOverrides: nextOverrides,
      };
    });

    // Free binary vault only when no pages reference a source file in current or undo stack
    const st = get();
    const referencedSources = new Set<string>();
    for (const p of st.pages) referencedSources.add(p.sourceFileId);
    for (const snap of st.historyPast) {
      for (const p of snap.pages) referencedSources.add(p.sourceFileId);
    }
    removeUnusedSourcesFromVault(referencedSources);
    schedulePersist(st);
  },

  reorderPages: (draggedIds, targetIndex) => {
    if (draggedIds.length === 0) return;
    set((state) => {
      const dragSet = new Set(draggedIds);
      const moving = state.pages.filter((p) => dragSet.has(p.id));
      if (moving.length === 0) return state;

      const hist = recordHistory(state, false);
      const rest = state.pages.filter((p) => !dragSet.has(p.id));

      // Count how many moved items originally sat before targetIndex
      let removedBefore = 0;
      for (let i = 0; i < Math.min(targetIndex, state.pages.length); i++) {
        if (dragSet.has(state.pages[i].id)) removedBefore++;
      }
      const insertAt = Math.max(0, Math.min(rest.length, targetIndex - removedBefore));
      const reordered = [
        ...rest.slice(0, insertAt),
        ...moving,
        ...rest.slice(insertAt),
      ];
      return {
        ...hist,
        pages: reordered,
      };
    });
    schedulePersist(get());
  },

  clearAllWorkspace: () => {
    set((state) => {
      if (state.pages.length === 0) return state;
      return {
        pages: [],
        selectedPageIds: [],
        lastSelectedPageId: null,
        slotOverrides: {},
        activeSheetIndex: 0,
        historyPast: [],
        historyFuture: [],
      };
    });
    clearVault();
    evictPdfProxyCache();
    schedulePersist(get());
  },

  clearDesktopRestoreManifest: () => {
    set({ desktopManifestToRestore: [] });
  },

  updateLayout: (updates, coalesceHistory = true) => {
    set((state) => {
      const hist = recordHistory(state, coalesceHistory);
      const nextLayout: LayoutSettings = {
        ...state.layout,
        ...updates,
        marginsMm: updates.marginsMm
          ? { ...state.layout.marginsMm, ...updates.marginsMm }
          : { ...state.layout.marginsMm },
      };

      // Auto-sync matching driver paper when layout paperSize changes
      let nextPrintJob = state.printJob;
      if (updates.paperSize && state.capabilities) {
        const dims = resolveSheetDimensionsMm(
          nextLayout.paperSize,
          nextLayout.orientation,
          nextLayout.customWidthMm,
          nextLayout.customHeightMm
        );
        const match = findBestDriverPaper(
          state.capabilities.papers,
          dims.widthMm,
          dims.heightMm,
          nextLayout.paperSize
        );
        if (match) {
          nextPrintJob = {
            ...state.printJob,
            paperId: match.id,
            paperName: match.name,
          };
        }
      }

      return {
        ...hist,
        layout: nextLayout,
        printJob: nextPrintJob,
      };
    });
    schedulePersist(get());
  },

  updateMarginSide: (side, valueMm, coalesceHistory = true) => {
    const safeVal = Math.max(0, Number(valueMm.toFixed(2)));
    set((state) => {
      const hist = recordHistory(state, coalesceHistory);
      const nextMargins = state.layout.marginsLocked
        ? { top: safeVal, bottom: safeVal, left: safeVal, right: safeVal }
        : { ...state.layout.marginsMm, [side]: safeVal };
      return {
        ...hist,
        layout: {
          ...state.layout,
          marginsMm: nextMargins,
        },
      };
    });
    schedulePersist(get());
  },

  setMarginsLocked: (locked) => {
    set((state) => {
      const nextMargins = locked
        ? {
            top: state.layout.marginsMm.top,
            bottom: state.layout.marginsMm.top,
            left: state.layout.marginsMm.top,
            right: state.layout.marginsMm.top,
          }
        : state.layout.marginsMm;
      return {
        layout: {
          ...state.layout,
          marginsLocked: locked,
          marginsMm: nextMargins,
        },
      };
    });
    schedulePersist(get());
  },

  assignSlotOverride: (sheetIndex, cellIndex, pageIdOrEmpty) => {
    set((state) => {
      const hist = recordHistory(state, false);
      const key = `${sheetIndex}:${cellIndex}`;
      const next = { ...state.slotOverrides };
      if (pageIdOrEmpty === null) {
        delete next[key];
      } else {
        next[key] = pageIdOrEmpty;
      }
      return {
        ...hist,
        slotOverrides: next,
      };
    });
  },

  swapSlotsOnSheet: (fromSheet, fromCell, toSheet, toCell, currentPlan) => {
    if (fromSheet === toSheet && fromCell === toCell) return;
    const cellA = currentPlan.sheets[fromSheet]?.cells[fromCell];
    const cellB = currentPlan.sheets[toSheet]?.cells[toCell];
    if (!cellA || !cellB) return;

    const valA = cellA.content ? cellA.content.page.id : EMPTY_SLOT_MARKER;
    const valB = cellB.content ? cellB.content.page.id : EMPTY_SLOT_MARKER;

    set((state) => {
      const hist = recordHistory(state, false);
      return {
        ...hist,
        slotOverrides: {
          ...state.slotOverrides,
          [`${fromSheet}:${fromCell}`]: valB,
          [`${toSheet}:${toCell}`]: valA,
        },
      };
    });
  },

  resetSlotOverrides: () => {
    set((state) => {
      if (Object.keys(state.slotOverrides).length === 0) return state;
      const hist = recordHistory(state, false);
      return {
        ...hist,
        slotOverrides: {},
      };
    });
  },

  applyPreset: (preset) => {
    set((state) => {
      const hist = recordHistory(state, false);
      const nextLayout: LayoutSettings = {
        ...state.layout,
        ...preset.layout,
        marginsMm: {
          ...state.layout.marginsMm,
          ...(preset.layout.marginsMm ?? {}),
        },
      };

      let nextPrintJob = state.printJob;
      if (state.capabilities) {
        const dims = resolveSheetDimensionsMm(
          nextLayout.paperSize,
          nextLayout.orientation,
          nextLayout.customWidthMm,
          nextLayout.customHeightMm
        );
        const match = findBestDriverPaper(
          state.capabilities.papers,
          dims.widthMm,
          dims.heightMm,
          nextLayout.paperSize
        );
        if (match) {
          nextPrintJob = { ...state.printJob, paperId: match.id, paperName: match.name };
        }
      }

      return {
        ...hist,
        layout: nextLayout,
        slotOverrides: {},
        printJob: nextPrintJob,
      };
    });
    schedulePersist(get());
  },

  saveCustomPreset: (name, description = 'پریست ذخیره‌شده کاربر') => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((state) => {
      const newPreset: LayoutPreset = {
        id: `custom_${Date.now().toString(36)}`,
        name: trimmed,
        description,
        isBuiltIn: false,
        layout: {
          ...state.layout,
          marginsMm: { ...state.layout.marginsMm },
        },
      };
      return {
        customPresets: [...state.customPresets, newPreset],
      };
    });
    schedulePersist(get());
  },

  deleteCustomPreset: (presetId) => {
    set((state) => ({
      customPresets: state.customPresets.filter((p) => p.id !== presetId),
    }));
    schedulePersist(get());
  },

  setPrinters: (printers) => {
    set((state) => {
      let chosen = state.printJob.printerName;
      const exists = printers.some((p) => p.name === chosen);
      if (!chosen || !exists) {
        const def = printers.find((p) => p.isDefault) ?? printers[0];
        chosen = def ? def.name : '';
      }
      return {
        printers,
        printJob: {
          ...state.printJob,
          printerName: chosen,
        },
      };
    });
    schedulePersist(get());
  },

  setIsLoadingPrinters: (isLoadingPrinters) => set({ isLoadingPrinters }),

  setCapabilities: (capabilities) => {
    set((state) => {
      if (!capabilities) return { capabilities: null };

      const dims = resolveSheetDimensionsMm(
        state.layout.paperSize,
        state.layout.orientation,
        state.layout.customWidthMm,
        state.layout.customHeightMm
      );

      // Preserve existing paperId if valid in driver list; otherwise pick best matching paper
      let chosenPaper = capabilities.papers.find((p) => p.id === state.printJob.paperId);
      if (!chosenPaper) {
        chosenPaper =
          findBestDriverPaper(
            capabilities.papers,
            dims.widthMm,
            dims.heightMm,
            state.layout.paperSize
          ) ?? capabilities.papers[0];
      }

      // Preserve existing binId if valid in driver list; otherwise default to Auto / first bin
      const chosenBin = capabilities.bins.find((b) => b.id === state.printJob.binId) ?? null;

      return {
        capabilities,
        printJob: {
          ...state.printJob,
          paperId: chosenPaper ? chosenPaper.id : null,
          paperName: chosenPaper ? chosenPaper.name : state.layout.paperSize,
          binId: chosenBin ? chosenBin.id : null,
          binName: chosenBin ? chosenBin.name : 'انتخاب خودکار سینی (Auto)',
          duplex: !capabilities.supportsDuplex ? 'simplex' : state.printJob.duplex,
          colorMode: !capabilities.supportsColor ? 'monochrome' : state.printJob.colorMode,
        },
      };
    });
    schedulePersist(get());
  },

  setIsLoadingCapabilities: (isLoadingCapabilities) => set({ isLoadingCapabilities }),

  updatePrintJob: (updates) => {
    set((state) => ({
      printJob: {
        ...state.printJob,
        ...updates,
      },
    }));
    schedulePersist(get());
  },

  selectDriverPaper: (paper) => {
    set((state) => ({
      printJob: {
        ...state.printJob,
        paperId: paper.id,
        paperName: paper.name,
      },
    }));
    schedulePersist(get());
  },

  selectDriverBin: (bin) => {
    set((state) => ({
      printJob: {
        ...state.printJob,
        binId: bin ? bin.id : null,
        binName: bin ? bin.name : 'انتخاب خودکار سینی (Auto)',
      },
    }));
    schedulePersist(get());
  },

  setPrintProgress: (printProgress) => set({ printProgress }),

  undo: () => {
    set((state) => {
      if (state.historyPast.length === 0) return state;
      const previous = state.historyPast[state.historyPast.length - 1];
      const currentSnap = cloneSnapshot(state);
      // Only restore pages whose source files still exist in vault
      const validPages = previous.pages.filter((p) => Boolean(getSourceFromVault(p.sourceFileId)));
      return {
        pages: validPages,
        layout: previous.layout,
        slotOverrides: previous.slotOverrides,
        historyPast: state.historyPast.slice(0, -1),
        historyFuture: [currentSnap, ...state.historyFuture.slice(0, MAX_HISTORY - 1)],
        lastHistoryTimestamp: 0,
      };
    });
    schedulePersist(get());
  },

  redo: () => {
    set((state) => {
      if (state.historyFuture.length === 0) return state;
      const next = state.historyFuture[0];
      const currentSnap = cloneSnapshot(state);
      const validPages = next.pages.filter((p) => Boolean(getSourceFromVault(p.sourceFileId)));
      return {
        pages: validPages,
        layout: next.layout,
        slotOverrides: next.slotOverrides,
        historyPast: [...state.historyPast, currentSnap],
        historyFuture: state.historyFuture.slice(1),
        lastHistoryTimestamp: 0,
      };
    });
    schedulePersist(get());
  },
}));

export function getAllPresets(customPresets: LayoutPreset[]): LayoutPreset[] {
  return [...BUILTIN_LAYOUT_PRESETS, ...customPresets];
}
