import React, { useState, useEffect } from 'react';
import {
  LengthUnit,
  mmToUnit,
  unitToMm,
  normalizeDigits,
  UNIT_LABELS,
} from './units';

interface NumericFieldProps {
  label: string;
  valueMm?: number;
  rawValue?: number;
  unit?: LengthUnit; // Pass unit when valueMm is in millimeters; omit for unitless counts (rows/cols/copies)
  min: number; // in mm if valueMm is used, otherwise raw
  max: number; // in mm if valueMm is used, otherwise raw
  sliderMax?: number; // optional soft max for slider while input allows larger numbers
  step?: number; // override step
  showSlider?: boolean;
  disabled?: boolean;
  suffix?: string;
  onChange: (newValue: number) => void;
}

export const NumericField: React.FC<NumericFieldProps> = ({
  label,
  valueMm,
  rawValue,
  unit,
  min,
  max,
  sliderMax,
  step,
  showSlider = false,
  disabled = false,
  suffix,
  onChange,
}) => {
  const isLength = unit !== undefined && valueMm !== undefined;
  const displayVal = isLength
    ? Number(mmToUnit(valueMm, unit).toFixed(UNIT_LABELS[unit].decimals))
    : (rawValue ?? 0);

  const [draft, setDraft] = useState<string>(String(displayVal));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(String(displayVal));
    }
  }, [displayVal, isFocused]);

  const effectiveStep = step ?? (isLength ? UNIT_LABELS[unit].step : 1);
  const displayMin = isLength ? Number(mmToUnit(min, unit).toFixed(2)) : min;
  const displaySliderMax = isLength
    ? Number(mmToUnit(sliderMax ?? max, unit).toFixed(2))
    : (sliderMax ?? max);

  const commitDisplayNumber = (num: number) => {
    if (!Number.isFinite(num)) return;
    const rawMmOrVal = isLength ? unitToMm(num, unit) : num;
    const clamped = Math.min(max, Math.max(min, rawMmOrVal));
    onChange(Number(clamped.toFixed(4)));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDraft(raw);
    const normalized = normalizeDigits(raw).trim();
    if (normalized === '' || normalized === '-' || normalized.endsWith('.')) return;
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed)) {
      commitDisplayNumber(parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const normalized = normalizeDigits(draft).trim();
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed)) {
      commitDisplayNumber(parsed);
    } else {
      setDraft(String(displayVal));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      commitDisplayNumber(displayVal + effectiveStep);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      commitDisplayNumber(displayVal - effectiveStep);
    } else if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const unitText = suffix ?? (isLength ? UNIT_LABELS[unit].short : '');

  return (
    <div className={`space-y-1 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
          {label}
        </label>
        <div className="relative flex items-center">
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            disabled={disabled}
            value={draft}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className={`w-24 h-7 ps-2 ${unitText ? 'pr-7' : 'pr-2'} text-xs font-num text-left rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition`}
          />
          {unitText && (
            <span
              dir="ltr"
              className="pointer-events-none absolute right-1.5 text-[10px] font-num text-slate-400 dark:text-slate-500"
            >
              {unitText}
            </span>
          )}
        </div>
      </div>

      {showSlider && (
        <input
          type="range"
          dir="ltr"
          disabled={disabled}
          min={displayMin}
          max={displaySliderMax}
          step={effectiveStep}
          value={Math.min(displaySliderMax, Math.max(displayMin, displayVal))}
          onChange={(e) => commitDisplayNumber(Number.parseFloat(e.target.value))}
          className="w-full h-1.5 accent-blue-600 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
        />
      )}
    </div>
  );
};
