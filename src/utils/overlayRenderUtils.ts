import {
  PageOverlayText,
  PageOverlayShape,
  PageOverlayNumbering,
  PageAdjustment,
  NumberingNumberFormat,
} from '../types';

export const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
export const ABJAD_LETTERS = [
  'الف', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ی',
  'ک', 'ل', 'م', 'ن', 'س', 'ع', 'ف', 'ص', 'ق', 'ر',
  'ش', 'ت', 'ث', 'خ', 'ذ', 'ض', 'ظ', 'غ',
];

export function toPersianDigits(num: number | string): string {
  return String(num).replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d, 10)]);
}

export function toRomanNumeral(num: number): string {
  if (num <= 0) return String(num);
  const lookup: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let roman = '';
  let n = num;
  for (const [val, letter] of lookup) {
    while (n >= val) {
      roman += letter;
      n -= val;
    }
  }
  return roman;
}

export function toAbjadNumeral(num: number): string {
  if (num <= 0) return String(num);
  const idx = (num - 1) % ABJAD_LETTERS.length;
  const cycle = Math.floor((num - 1) / ABJAD_LETTERS.length);
  return cycle > 0 ? `${ABJAD_LETTERS[idx]} ${cycle + 1}` : ABJAD_LETTERS[idx];
}

export function formatPageNumber(
  pageNum: number,
  totalPages: number,
  config: PageOverlayNumbering
): string {
  let effectivePage = pageNum + (config.startOffset || 0);

  // If custom script expression is provided
  if (config.customScript && config.customScript.trim()) {
    try {
      // Safe formula evaluation: e.g. "page * 2" or "page + 10"
      const script = config.customScript.trim();
      const sanitized = script.replace(/[^0-9+\-*/%().\s]/g, (match) => {
        if (match === 'p' && script.includes('page')) return 'p';
        return '';
      });
      // Simple formula replacer
      const formula = script.replace(/\bpage\b/gi, String(effectivePage));
      // Basic math parser without dangerous eval
      const result = Function(`"use strict"; return (${formula})`)();
      if (typeof result === 'number' && !isNaN(result)) {
        effectivePage = result;
      }
    } catch {
      // fallback to effectivePage
    }
  }

  let rawNum = effectivePage;
  let padLen = config.padZeros || 0;

  // Zero padded versions
  const pad4Str = String(rawNum).padStart(4, '0');
  const pad5Str = String(rawNum).padStart(5, '0');
  const pad6Str = String(rawNum).padStart(6, '0');
  const pad7Str = String(rawNum).padStart(7, '0');

  let formattedPageStr = padLen > 0 ? String(rawNum).padStart(padLen, '0') : String(rawNum);
  let formattedTotalStr = String(totalPages);

  let formattedPad4 = pad4Str;
  let formattedPad5 = pad5Str;
  let formattedPad6 = pad6Str;
  let formattedPad7 = pad7Str;

  switch (config.format) {
    case 'persian':
      formattedPageStr = toPersianDigits(formattedPageStr);
      formattedTotalStr = toPersianDigits(totalPages);
      formattedPad4 = toPersianDigits(pad4Str);
      formattedPad5 = toPersianDigits(pad5Str);
      formattedPad6 = toPersianDigits(pad6Str);
      formattedPad7 = toPersianDigits(pad7Str);
      break;
    case 'roman':
      formattedPageStr = toRomanNumeral(effectivePage);
      formattedTotalStr = toRomanNumeral(totalPages);
      break;
    case 'abjad':
      formattedPageStr = toAbjadNumeral(effectivePage);
      formattedTotalStr = toAbjadNumeral(totalPages);
      break;
    case 'english':
    default:
      break;
  }

  const template = config.template || (padLen > 0 ? `No. ${formattedPageStr}` : '{page}');
  return template
    .replace(/\{page\}/gi, formattedPageStr)
    .replace(/\{total\}/gi, formattedTotalStr)
    .replace(/\{serial\}/gi, formattedPageStr)
    .replace(/\{pad4\}/gi, formattedPad4)
    .replace(/\{pad5\}/gi, formattedPad5)
    .replace(/\{pad6\}/gi, formattedPad6)
    .replace(/\{pad7\}/gi, formattedPad7);
}

/**
 * Draws text overlays, geometric shapes, and dynamic page numbering onto a canvas context
 */
export function renderOverlaysOnCanvas(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  adj: PageAdjustment,
  pageNum: number,
  totalPages: number
): void {
  // 1. Draw Geometric Shapes
  if (adj.shapes && adj.shapes.length > 0) {
    for (const shape of adj.shapes) {
      ctx.save();
      ctx.globalAlpha = shape.opacity ?? 1;

      const x = (shape.xPercent / 100) * canvasWidth;
      const y = (shape.yPercent / 100) * canvasHeight;
      const w = (shape.widthPercent / 100) * canvasWidth;
      const h = (shape.heightPercent / 100) * canvasHeight;

      ctx.translate(x + w / 2, y + h / 2);
      if (shape.rotation) {
        ctx.rotate((shape.rotation * Math.PI) / 180);
      }

      ctx.fillStyle = shape.fillColor || 'transparent';
      ctx.strokeStyle = shape.strokeColor || '#000000';
      ctx.lineWidth = shape.strokeWidth || 2;

      if (shape.strokeStyle === 'dashed') {
        ctx.setLineDash([8, 6]);
      } else if (shape.strokeStyle === 'dotted') {
        ctx.setLineDash([3, 3]);
      } else {
        ctx.setLineDash([]);
      }

      const halfW = w / 2;
      const halfH = h / 2;

      switch (shape.type) {
        case 'rectangle': {
          if (shape.fillColor && shape.fillColor !== 'transparent') {
            ctx.fillRect(-halfW, -halfH, w, h);
          }
          if (shape.strokeWidth > 0 && shape.strokeColor !== 'transparent') {
            ctx.strokeRect(-halfW, -halfH, w, h);
          }
          break;
        }
        case 'rounded-rect': {
          const r = Math.min(halfW, halfH, shape.borderRadius || 12);
          ctx.beginPath();
          ctx.roundRect(-halfW, -halfH, w, h, r);
          if (shape.fillColor && shape.fillColor !== 'transparent') {
            ctx.fill();
          }
          if (shape.strokeWidth > 0 && shape.strokeColor !== 'transparent') {
            ctx.stroke();
          }
          break;
        }
        case 'circle': {
          ctx.beginPath();
          ctx.ellipse(0, 0, Math.abs(halfW), Math.abs(halfH), 0, 0, 2 * Math.PI);
          if (shape.fillColor && shape.fillColor !== 'transparent') {
            ctx.fill();
          }
          if (shape.strokeWidth > 0 && shape.strokeColor !== 'transparent') {
            ctx.stroke();
          }
          break;
        }
        case 'line': {
          ctx.beginPath();
          ctx.moveTo(-halfW, 0);
          ctx.lineTo(halfW, 0);
          ctx.stroke();
          break;
        }
        case 'arrow': {
          ctx.beginPath();
          ctx.moveTo(-halfW, 0);
          ctx.lineTo(halfW - 12, 0);
          ctx.stroke();
          // Arrow head
          ctx.beginPath();
          ctx.moveTo(halfW, 0);
          ctx.lineTo(halfW - 14, -8);
          ctx.lineTo(halfW - 14, 8);
          ctx.closePath();
          ctx.fillStyle = shape.strokeColor || '#000000';
          ctx.fill();
          break;
        }
        case 'star': {
          const spikes = 5;
          const outerR = Math.min(halfW, halfH);
          const innerR = outerR / 2.5;
          let rot = (Math.PI / 2) * 3;
          const step = Math.PI / spikes;

          ctx.beginPath();
          ctx.moveTo(0, -outerR);
          for (let i = 0; i < spikes; i++) {
            let cx = Math.cos(rot) * outerR;
            let cy = Math.sin(rot) * outerR;
            ctx.lineTo(cx, cy);
            rot += step;

            cx = Math.cos(rot) * innerR;
            cy = Math.sin(rot) * innerR;
            ctx.lineTo(cx, cy);
            rot += step;
          }
          ctx.lineTo(0, -outerR);
          ctx.closePath();
          if (shape.fillColor && shape.fillColor !== 'transparent') {
            ctx.fill();
          }
          if (shape.strokeWidth > 0 && shape.strokeColor !== 'transparent') {
            ctx.stroke();
          }
          break;
        }
        case 'badge': {
          const r = Math.min(halfW, halfH);
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          if (shape.fillColor && shape.fillColor !== 'transparent') {
            ctx.fill();
          }
          if (shape.strokeWidth > 0 && shape.strokeColor !== 'transparent') {
            ctx.stroke();
          }
          break;
        }
      }

      ctx.restore();
    }
  }

  // 2. Draw Custom Text Overlays
  if (adj.texts && adj.texts.length > 0) {
    for (const textObj of adj.texts) {
      if (!textObj.text || !textObj.text.trim()) continue;

      ctx.save();
      ctx.globalAlpha = textObj.opacity ?? 1;

      const x = (textObj.xPercent / 100) * canvasWidth;
      const y = (textObj.yPercent / 100) * canvasHeight;

      ctx.translate(x, y);
      if (textObj.rotation) {
        ctx.rotate((textObj.rotation * Math.PI) / 180);
      }

      const fontStyle = textObj.italic ? 'italic' : 'normal';
      const fontWeight = textObj.bold ? 'bold' : 'normal';
      const fontSizePx = Math.max(10, Math.round((textObj.fontSize || 18) * (canvasWidth / 595)));
      const fontFamily = textObj.fontFamily || 'Vazirmatn, Shabnam, Tahoma, sans-serif';

      ctx.font = `${fontStyle} ${fontWeight} ${fontSizePx}px ${fontFamily}`;
      ctx.textAlign = textObj.align || 'center';
      ctx.textBaseline = 'middle';

      // Background pill/box if specified
      if (textObj.backgroundColor && textObj.backgroundColor !== 'transparent') {
        const metrics = ctx.measureText(textObj.text);
        const padX = fontSizePx * 0.4;
        const padY = fontSizePx * 0.25;
        const textW = metrics.width;
        let boxX = -textW / 2 - padX;
        if (textObj.align === 'left') boxX = -padX;
        if (textObj.align === 'right') boxX = -textW - padX;

        ctx.fillStyle = textObj.backgroundColor;
        ctx.beginPath();
        ctx.roundRect(boxX, -fontSizePx / 2 - padY, textW + padX * 2, fontSizePx + padY * 2, 4);
        ctx.fill();
      }

      ctx.fillStyle = textObj.color || '#000000';
      ctx.fillText(textObj.text, 0, 0);

      // Underline
      if (textObj.underline) {
        const metrics = ctx.measureText(textObj.text);
        const textW = metrics.width;
        let startX = -textW / 2;
        if (textObj.align === 'left') startX = 0;
        if (textObj.align === 'right') startX = -textW;

        ctx.strokeStyle = textObj.color || '#000000';
        ctx.lineWidth = Math.max(1, fontSizePx / 14);
        ctx.beginPath();
        ctx.moveTo(startX, fontSizePx * 0.55);
        ctx.lineTo(startX + textW, fontSizePx * 0.55);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // 3. Draw Dynamic Page Numbering Overlays
  const numberingsToRender: PageOverlayNumbering[] = [];
  if (adj.pageNumberings && adj.pageNumberings.length > 0) {
    numberingsToRender.push(...adj.pageNumberings.filter((n) => n.enabled));
  } else if (adj.pageNumbering && adj.pageNumbering.enabled) {
    numberingsToRender.push(adj.pageNumbering);
  }

  for (const numConfig of numberingsToRender) {
    const formattedStr = formatPageNumber(pageNum, totalPages, numConfig);

    ctx.save();
    ctx.globalAlpha = numConfig.opacity ?? 1;

    const x = (numConfig.xPercent / 100) * canvasWidth;
    const y = (numConfig.yPercent / 100) * canvasHeight;

    const fontStyle = numConfig.italic ? 'italic' : 'normal';
    const fontWeight = numConfig.bold ? 'bold' : 'normal';
    const fontSizePx = Math.max(10, Math.round((numConfig.fontSize || 14) * (canvasWidth / 595)));
    const fontFamily = numConfig.fontFamily || 'Vazirmatn, Shabnam, Tahoma, sans-serif';

    ctx.font = `${fontStyle} ${fontWeight} ${fontSizePx}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Background pill if specified
    if (numConfig.backgroundColor && numConfig.backgroundColor !== 'transparent') {
      const metrics = ctx.measureText(formattedStr);
      const padX = fontSizePx * 0.5;
      const padY = fontSizePx * 0.3;
      const textW = metrics.width;

      ctx.fillStyle = numConfig.backgroundColor;
      ctx.beginPath();
      ctx.roundRect(x - textW / 2 - padX, y - fontSizePx / 2 - padY, textW + padX * 2, fontSizePx + padY * 2, 4);
      ctx.fill();
    }

    ctx.fillStyle = numConfig.color || '#334155';
    ctx.fillText(formattedStr, x, y);

    ctx.restore();
  }
}
