import React, { useState } from 'react';
import {
  BookmarkPlus,
  CopyPlus,
  FileSpreadsheet,
  Grid2X2,
  Lock,
  RotateCw,
  Scissors,
  Square,
  Trash2,
  Unlock,
} from 'lucide-react';
import { NumericField } from '../../shared/NumericField';
import { PAPER_SIZE_LIST, STANDARD_PAPERS } from '../../shared/paperSizes';
import type {
  CellScaleMode,
  FlowDirection,
  HorizontalAlign,
  ImpositionMode,
  PaperSizeId,
  VerticalAlign,
} from '../../shared/types';
import { formatLength, UNIT_LABELS } from '../../shared/units';
import { getAllPresets, useStudioStore } from '../../store/useStudioStore';
import type { ImpositionPlan } from './impositionEngine';

interface LayoutTabPanelProps {
  plan: ImpositionPlan;
}

export const LayoutTabPanel: React.FC<LayoutTabPanelProps> = ({ plan }) => {
  const layout = useStudioStore((s) => s.layout);
  const unit = useStudioStore((s) => s.unit);
  const customPresets = useStudioStore((s) => s.customPresets);

  const updateLayout = useStudioStore((s) => s.updateLayout);
  const updateMarginSide = useStudioStore((s) => s.updateMarginSide);
  const setMarginsLocked = useStudioStore((s) => s.setMarginsLocked);
  const applyPreset = useStudioStore((s) => s.applyPreset);
  const saveCustomPreset = useStudioStore((s) => s.saveCustomPreset);
  const deleteCustomPreset = useStudioStore((s) => s.deleteCustomPreset);
  const pushToast = useStudioStore((s) => s.pushToast);

  const [newPresetName, setNewPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  const allPresets = getAllPresets(customPresets);

  const modeOptions: Array<{ id: ImpositionMode; label: string; sub: string; icon: React.ReactNode }> = [
    {
      id: 'single',
      label: 'تک‌صفحه',
      sub: '۱ صفحه در شیت',
      icon: <Square className="w-3.5 h-3.5" />,
    },
    {
      id: 'nup',
      label: 'چندصفحه‌ای',
      sub: 'چیدمان N-Up',
      icon: <Grid2X2 className="w-3.5 h-3.5" />,
    },
    {
      id: 'repeat',
      label: 'تکرار در شیت',
      sub: 'کارت ویزیت / لیبل',
      icon: <CopyPlus className="w-3.5 h-3.5" />,
    },
  ];

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    saveCustomPreset(newPresetName.trim());
    pushToast('success', `پریست «${newPresetName.trim()}» ذخیره شد.`);
    setNewPresetName('');
    setIsSavingPreset(false);
  };

  return (
    <div className="space-y-4 p-3.5 text-xs">
      {/* 1. Imposition Mode */}
      <section className="space-y-2">
        <span className="font-bold text-slate-700 dark:text-slate-200 block">
          حالت چیدمان شیت
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {modeOptions.map((opt) => {
            const active = layout.mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateLayout({ mode: opt.id }, false)}
                className={`p-2 rounded-lg border text-center flex flex-col items-center gap-1 transition cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {opt.icon}
                <span className="font-bold text-[11px] leading-tight">{opt.label}</span>
                <span
                  className={`text-[9px] leading-none ${
                    active ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  {opt.sub}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Presets */}
      <section className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
            <span>پریست‌های آماده</span>
          </span>
          <button
            type="button"
            onClick={() => setIsSavingPreset((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            <BookmarkPlus className="w-3 h-3" />
            <span>ذخیره فعلی</span>
          </button>
        </div>

        {isSavingPreset && (
          <form onSubmit={handleSavePreset} className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="نام پریست (مثلاً: لیبل ۱۶تایی)..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="flex-1 h-7 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-2.5 h-7 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer"
            >
              ثبت
            </button>
          </form>
        )}

        <select
          value=""
          onChange={(e) => {
            const found = allPresets.find((p) => p.id === e.target.value);
            if (found) {
              applyPreset(found);
              pushToast('info', `پریست «${found.name}» اعمال شد.`);
            }
          }}
          className="w-full h-8 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
        >
          <option value="" disabled>
            انتخاب سریع پریست چیدمان...
          </option>
          {allPresets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.isBuiltIn ? p.name : `★ ${p.name}`}
            </option>
          ))}
        </select>

        {customPresets.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {customPresets.map((cp) => (
              <div
                key={cp.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[10px] text-blue-700 dark:text-blue-300"
              >
                <button
                  type="button"
                  onClick={() => applyPreset(cp)}
                  className="hover:underline cursor-pointer"
                >
                  {cp.name}
                </button>
                <button
                  type="button"
                  onClick={() => deleteCustomPreset(cp.id)}
                  title="حذف پریست"
                  className="text-rose-500 hover:text-rose-700 cursor-pointer"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Sheet Paper Size & Orientation */}
      <section className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
        <span className="font-bold text-slate-700 dark:text-slate-200 block">
          اندازه و جهت کاغذ شیت
        </span>

        <select
          value={layout.paperSize}
          onChange={(e) => updateLayout({ paperSize: e.target.value as PaperSizeId }, false)}
          className="w-full h-8 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
        >
          {PAPER_SIZE_LIST.map((pid) => (
            <option key={pid} value={pid}>
              {pid === 'Custom' ? 'ابعاد سفارشی (Custom)' : STANDARD_PAPERS[pid].nameFa}
            </option>
          ))}
        </select>

        {layout.paperSize === 'Custom' && (
          <div className="grid grid-cols-1 gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <NumericField
              label="عرض کاغذ سفارشی"
              valueMm={layout.customWidthMm}
              unit={unit}
              min={30}
              max={1500}
              onChange={(v) => updateLayout({ customWidthMm: v })}
            />
            <NumericField
              label="ارتفاع کاغذ سفارشی"
              valueMm={layout.customHeightMm}
              unit={unit}
              min={30}
              max={1500}
              onChange={(v) => updateLayout({ customHeightMm: v })}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => updateLayout({ orientation: 'portrait' }, false)}
            className={`h-8 rounded-md border font-semibold transition cursor-pointer ${
              layout.orientation === 'portrait'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            عمودی (Portrait)
          </button>
          <button
            type="button"
            onClick={() => updateLayout({ orientation: 'landscape' }, false)}
            className={`h-8 rounded-md border font-semibold transition cursor-pointer ${
              layout.orientation === 'landscape'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            افقی (Landscape)
          </button>
        </div>
      </section>

      {/* 4. Matrix Rows, Cols & Flow Order (when mode !== 'single') */}
      {layout.mode !== 'single' && (
        <section className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <span className="font-bold text-slate-700 dark:text-slate-200 block">
            ابعاد ماتریس جدول (سطر و ستون)
          </span>

          <NumericField
            label="تعداد سطرها (عمودی)"
            rawValue={layout.rows}
            min={1}
            max={30}
            sliderMax={12}
            step={1}
            showSlider
            onChange={(v) => updateLayout({ rows: Math.round(v) })}
          />

          <NumericField
            label="تعداد ستون‌ها (افقی)"
            rawValue={layout.cols}
            min={1}
            max={30}
            sliderMax={10}
            step={1}
            showSlider
            onChange={(v) => updateLayout({ cols: Math.round(v) })}
          />

          {layout.mode === 'nup' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                ترتیب چیدن صفحات در جدول
              </label>
              <select
                value={layout.flowDirection}
                onChange={(e) =>
                  updateLayout({ flowDirection: e.target.value as FlowDirection }, false)
                }
                className="w-full h-8 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              >
                <option value="rtl-row">راست به چپ — سطری (استاندارد فارسی)</option>
                <option value="ltr-row">چپ به راست — سطری (انگلیسی)</option>
                <option value="rtl-col">راست به چپ — ستونی</option>
                <option value="ltr-col">چپ به راست — ستونی</option>
              </select>
            </div>
          )}
        </section>
      )}

      {/* 5. Margins (Top / Bottom / Right / Left + Equal Lock) */}
      <section className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-700 dark:text-slate-200">
            حاشیه اطراف شیت
          </span>
          <button
            type="button"
            onClick={() => setMarginsLocked(!layout.marginsLocked)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition cursor-pointer ${
              layout.marginsLocked
                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {layout.marginsLocked ? (
              <>
                <Lock className="w-3 h-3" />
                <span>قفل برابر</span>
              </>
            ) : (
              <>
                <Unlock className="w-3 h-3" />
                <span>چهار طرف مجزا</span>
              </>
            )}
          </button>
        </div>

        {layout.marginsLocked ? (
          <NumericField
            label="حاشیه هر ۴ طرف"
            valueMm={layout.marginsMm.top}
            unit={unit}
            min={0}
            max={100}
            sliderMax={40}
            showSlider
            onChange={(v) => updateMarginSide('top', v)}
          />
        ) : (
          <div className="space-y-2">
            <NumericField
              label="حاشیه بالا"
              valueMm={layout.marginsMm.top}
              unit={unit}
              min={0}
              max={100}
              sliderMax={40}
              showSlider
              onChange={(v) => updateMarginSide('top', v)}
            />
            <NumericField
              label="حاشیه پایین"
              valueMm={layout.marginsMm.bottom}
              unit={unit}
              min={0}
              max={100}
              sliderMax={40}
              showSlider
              onChange={(v) => updateMarginSide('bottom', v)}
            />
            <NumericField
              label="حاشیه راست"
              valueMm={layout.marginsMm.right}
              unit={unit}
              min={0}
              max={100}
              sliderMax={40}
              showSlider
              onChange={(v) => updateMarginSide('right', v)}
            />
            <NumericField
              label="حاشیه چپ"
              valueMm={layout.marginsMm.left}
              unit={unit}
              min={0}
              max={100}
              sliderMax={40}
              showSlider
              onChange={(v) => updateMarginSide('left', v)}
            />
          </div>
        )}
      </section>

      {/* 6. Cell Gaps & Cell Size (Auto vs Manual) */}
      {layout.mode !== 'single' && (
        <section className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <span className="font-bold text-slate-700 dark:text-slate-200 block">
            فاصله و اندازه خانه‌های جدول
          </span>

          <NumericField
            label="فاصله افقی بین ستون‌ها"
            valueMm={layout.gapHorizontalMm}
            unit={unit}
            min={0}
            max={60}
            sliderMax={25}
            showSlider
            onChange={(v) => updateLayout({ gapHorizontalMm: v })}
          />

          <NumericField
            label="فاصله عمودی بین سطرها"
            valueMm={layout.gapVerticalMm}
            unit={unit}
            min={0}
            max={60}
            sliderMax={25}
            showSlider
            onChange={(v) => updateLayout({ gapVerticalMm: v })}
          />

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => updateLayout({ cellSizeMode: 'auto' }, false)}
              className={`h-7 rounded border text-[11px] font-semibold transition cursor-pointer ${
                layout.cellSizeMode === 'auto'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              تقسیم خودکار مساوی
            </button>
            <button
              type="button"
              onClick={() => updateLayout({ cellSizeMode: 'manual' }, false)}
              className={`h-7 rounded border text-[11px] font-semibold transition cursor-pointer ${
                layout.cellSizeMode === 'manual'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              ابعاد دستی خانه
            </button>
          </div>

          {layout.cellSizeMode === 'manual' ? (
            <div className="space-y-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <NumericField
                label="عرض دقیق هر خانه"
                valueMm={layout.manualCellWidthMm}
                unit={unit}
                min={10}
                max={600}
                sliderMax={210}
                showSlider
                onChange={(v) => updateLayout({ manualCellWidthMm: v })}
              />
              <NumericField
                label="ارتفاع دقیق هر خانه"
                valueMm={layout.manualCellHeightMm}
                unit={unit}
                min={10}
                max={600}
                sliderMax={297}
                showSlider
                onChange={(v) => updateLayout({ manualCellHeightMm: v })}
              />
            </div>
          ) : (
            <div className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
              <span>ابعاد محاسبه‌شده هر خانه:</span>
              <strong dir="ltr" className="font-num text-slate-800 dark:text-slate-200">
                {formatLength(plan.cellWidthMm, unit)} × {formatLength(plan.cellHeightMm, unit)}{' '}
                {UNIT_LABELS[unit].short}
              </strong>
            </div>
          )}
        </section>
      )}

      {/* 7. Fit / Fill / Stretch / Actual + Alignment + AutoRotate + CropMarks */}
      <section className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
        <span className="font-bold text-slate-700 dark:text-slate-200 block">
          نحوه جاگیری محتوا و خطوط برش
        </span>

        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              { id: 'fit', label: 'تناسب کامل (Fit)' },
              { id: 'fill', label: 'پر کردن کادر (Fill)' },
              { id: 'stretch', label: 'کشیدن (Stretch)' },
              { id: 'actual', label: 'اندازه اصلی (۱:۱)' },
            ] as Array<{ id: CellScaleMode; label: string }>
          ).map((sm) => (
            <button
              key={sm.id}
              type="button"
              onClick={() => updateLayout({ scaleMode: sm.id }, false)}
              className={`h-7 rounded border text-[11px] font-medium transition cursor-pointer ${
                layout.scaleMode === sm.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {sm.label}
            </button>
          ))}
        </div>

        {/* 3x3 Alignment Picker */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-600 dark:text-slate-300">تراز محتوا در خانه:</span>
          <div
            dir="ltr"
            className="grid grid-cols-3 gap-1 p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
          >
            {(['top', 'middle', 'bottom'] as VerticalAlign[]).map((va) =>
              (['left', 'center', 'right'] as HorizontalAlign[]).map((ha) => {
                const active =
                  layout.alignVertical === va && layout.alignHorizontal === ha;
                return (
                  <button
                    key={`${va}-${ha}`}
                    type="button"
                    onClick={() =>
                      updateLayout({ alignVertical: va, alignHorizontal: ha }, false)
                    }
                    title={`${va} - ${ha}`}
                    className={`w-4 h-4 rounded-xs transition cursor-pointer ${
                      active
                        ? 'bg-blue-600'
                        : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                    }`}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Auto-Rotate & Crop Marks checkboxes */}
        <div className="space-y-2 pt-1">
          <label className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 cursor-pointer">
            <div className="flex items-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-medium">چرخش خودکار بهینه در خانه</span>
            </div>
            <input
              type="checkbox"
              checked={layout.autoRotate}
              onChange={(e) => updateLayout({ autoRotate: e.target.checked }, false)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 cursor-pointer">
            <div className="flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-medium">چاپ خطوط راهنمای برش (Crop Marks)</span>
            </div>
            <input
              type="checkbox"
              checked={layout.cropMarks}
              onChange={(e) => updateLayout({ cropMarks: e.target.checked }, false)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
          </label>
        </div>
      </section>
    </div>
  );
};
