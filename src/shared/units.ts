export type LengthUnit = 'mm' | 'cm' | 'inch';

/**
 * Exact PostScript / PDF Point conversion factor:
 * 1 inch = 25.4 mm = 72 pt  =>  1 mm = 72 / 25.4 ≈ 2.834645669291339 pt
 */
export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;
export const PT_PER_MM = PT_PER_INCH / MM_PER_INCH; // 2.834645669291339

export const UNIT_LABELS: Record<LengthUnit, { short: string; nameFa: string; step: number; decimals: number }> = {
  mm: { short: 'mm', nameFa: 'میلی‌متر', step: 0.5, decimals: 1 },
  cm: { short: 'cm', nameFa: 'سانتی‌متر', step: 0.1, decimals: 2 },
  inch: { short: 'in', nameFa: 'اینچ', step: 0.05, decimals: 2 },
};

/**
 * Convert millimeters to PDF points (72 DPI)
 */
export function mmToPt(mm: number): number {
  return mm * PT_PER_MM;
}

/**
 * Convert PDF points (72 DPI) to millimeters
 */
export function ptToMm(pt: number): number {
  return pt / PT_PER_MM;
}

/**
 * Convert millimeters to display unit
 */
export function mmToUnit(mm: number, unit: LengthUnit): number {
  switch (unit) {
    case 'mm':
      return mm;
    case 'cm':
      return mm / 10;
    case 'inch':
      return mm / MM_PER_INCH;
  }
}

/**
 * Convert display unit value back to millimeters
 */
export function unitToMm(value: number, unit: LengthUnit): number {
  switch (unit) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'inch':
      return value * MM_PER_INCH;
  }
}

/**
 * Format a millimeter length into the active display unit
 */
export function formatLength(mm: number, unit: LengthUnit, customDecimals?: number): string {
  const val = mmToUnit(mm, unit);
  const decimals = customDecimals ?? UNIT_LABELS[unit].decimals;
  const rounded = Number(val.toFixed(decimals));
  return `${rounded}`;
}

/**
 * Normalize Persian (۰-۹) and Arabic (٠-٩) digits to ASCII (0-9)
 */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

/**
 * Convert ASCII digits to Persian digits for UI badges/labels
 */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => String.fromCharCode(1776 + Number(d)));
}

/**
 * Parse a 1-based sheet/page range string (e.g. "1-3, 5, ۷-۹") into sorted unique 0-based indices.
 * Returns { indices, error } so UI can surface validation feedback cleanly.
 */
export function parseSheetRange(
  rangeStr: string,
  totalCount: number
): { indices: number[]; error: string | null } {
  if (totalCount <= 0) {
    return { indices: [], error: null };
  }

  const normalized = normalizeDigits(rangeStr).trim();
  if (!normalized || normalized.toLowerCase() === 'all' || normalized === 'همه') {
    return {
      indices: Array.from({ length: totalCount }, (_, i) => i),
      error: null,
    };
  }

  const chosen = new Set<number>();
  const tokens = normalized.split(/[,،;؛]+/);

  for (const rawToken of tokens) {
    const token = rawToken.trim();
    if (!token) continue;

    if (token.includes('-')) {
      const parts = token.split('-').map((s) => s.trim());
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return { indices: [], error: `فرمت بازه «${token}» نامعتبر است (مثال صحیح: 1-4, 6)` };
      }
      const start = Number.parseInt(parts[0], 10);
      const end = Number.parseInt(parts[1], 10);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1) {
        return { indices: [], error: `شماره شیت در «${token}» باید عدد مثبت باشد` };
      }
      if (start > totalCount && end > totalCount) {
        return {
          indices: [],
          error: `بازه «${token}» خارج از تعداد کل شیت‌ها (${totalCount}) است`,
        };
      }
      const lo = Math.max(1, Math.min(start, end));
      const hi = Math.min(totalCount, Math.max(start, end));
      for (let s = lo; s <= hi; s++) {
        chosen.add(s - 1);
      }
    } else {
      const single = Number.parseInt(token, 10);
      if (!Number.isFinite(single) || single < 1 || String(single) !== token) {
        return { indices: [], error: `مقدار «${token}» شماره شیت معتبر نیست` };
      }
      if (single > totalCount) {
        return {
          indices: [],
          error: `شیت شماره ${single} وجود ندارد (کل شیت‌ها: ${totalCount})`,
        };
      }
      chosen.add(single - 1);
    }
  }

  const sorted = Array.from(chosen).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return { indices: [], error: 'هیچ شیتی در محدوده واردشده یافت نشد' };
  }

  return { indices: sorted, error: null };
}

/**
 * Format file byte size cleanly
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
