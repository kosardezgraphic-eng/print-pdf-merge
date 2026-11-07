import { describe, it, expect } from 'vitest';
import { parsePageRange } from '../utils/pdfUtils';
import { calculateGridCellOrder, calculateBookletPageOrder } from '../utils/gridImpositionUtils';
import { PAPER_DIMENSIONS_MM, DuplexMode, PaperSize } from '../types';

describe('Pure Logic & Prepress Tests', () => {
  describe('Page Range Parser (parsePageRange)', () => {
    it('returns all 0-based indices when empty or "all"', () => {
      expect(parsePageRange('', 5)).toEqual([0, 1, 2, 3, 4]);
      expect(parsePageRange('all', 4)).toEqual([0, 1, 2, 3]);
      expect(parsePageRange(undefined, 3)).toEqual([0, 1, 2]);
    });

    it('parses comma-separated pages correctly (1-based to 0-based)', () => {
      expect(parsePageRange('1, 3, 5', 5)).toEqual([0, 2, 4]);
      // Persian comma support
      expect(parsePageRange('1، 2، 4', 5)).toEqual([0, 1, 3]);
    });

    it('parses ranges like "1-3, 5-6"', () => {
      expect(parsePageRange('1-3, 5-6', 6)).toEqual([0, 1, 2, 4, 5]);
    });

    it('clamps values out of bounds', () => {
      expect(parsePageRange('1-10', 4)).toEqual([0, 1, 2, 3]);
    });
  });

  describe('N-Up Grid Cell Order (calculateGridCellOrder)', () => {
    it('computes RTL rows correctly (Persian reading flow)', () => {
      // 2 rows, 2 cols: Row 0 Right=0, Left=1; Row 1 Right=2, Left=3
      const order = calculateGridCellOrder(2, 2, 'rtl-rows');
      expect(order).toEqual([1, 0, 3, 2]);
    });

    it('computes LTR rows correctly', () => {
      const order = calculateGridCellOrder(2, 2, 'ltr-rows');
      expect(order).toEqual([0, 1, 2, 3]);
    });
  });

  describe('Booklet Imposition Signature (calculateBookletPageOrder)', () => {
    it('pads 4 pages to 4 pages and orders for saddle-stitch folding', () => {
      const pages = [1, 2, 3, 4];
      const blankFactory = () => 0;
      const result = calculateBookletPageOrder(pages, blankFactory);
      // Sheet 1 Front: [4, 1], Back: [2, 3]
      expect(result).toEqual([4, 1, 2, 3]);
    });

    it('pads non-multiples of 4 with blanks (e.g. 5 pages -> 8 pages)', () => {
      const pages = [1, 2, 3, 4, 5];
      const blankFactory = () => 0;
      const result = calculateBookletPageOrder(pages, blankFactory);
      expect(result.length).toBe(8);
      // Padded: [1, 2, 3, 4, 5, 0, 0, 0]
      // Sheet 1 Front: [0, 1], Back: [2, 0]
      // Sheet 2 Front: [0, 3], Back: [4, 5]
      expect(result).toEqual([0, 1, 2, 0, 0, 3, 4, 5]);
    });
  });

  describe('Duplex Mode Mapping', () => {
    function mapDuplexForElectron(duplex: DuplexMode, landscape: boolean): string {
      let duplexMode = 'simplex';
      if (
        duplex === 'duplexLong' ||
        (duplex as string) === 'duplex-long' ||
        (duplex as string) === 'longEdge'
      ) {
        duplexMode = 'longEdge';
      } else if (
        duplex === 'duplexShort' ||
        (duplex as string) === 'duplex-short' ||
        (duplex as string) === 'shortEdge' ||
        duplex === 'booklet'
      ) {
        duplexMode = landscape ? 'shortEdge' : 'longEdge';
      }
      return duplexMode;
    }

    it('maps duplexLong to longEdge', () => {
      expect(mapDuplexForElectron('duplexLong', false)).toBe('longEdge');
    });

    it('maps duplexShort to shortEdge', () => {
      expect(mapDuplexForElectron('duplexShort', false)).toBe('longEdge'); // on portrait or shortEdge
      expect(mapDuplexForElectron('duplexShort', true)).toBe('shortEdge');
    });

    it('maps booklet to appropriate edge based on sheet orientation', () => {
      expect(mapDuplexForElectron('booklet', true)).toBe('shortEdge');
      expect(mapDuplexForElectron('booklet', false)).toBe('longEdge');
    });

    it('maps simplex to simplex', () => {
      expect(mapDuplexForElectron('simplex', false)).toBe('simplex');
    });
  });

  describe('Paper Dimensions (PAPER_DIMENSIONS_MM)', () => {
    it('has exact dimensions for standard prepress sizes', () => {
      expect(PAPER_DIMENSIONS_MM.A4.widthMm).toBe(210);
      expect(PAPER_DIMENSIONS_MM.A4.heightMm).toBe(297);
      expect(PAPER_DIMENSIONS_MM.A3.widthMm).toBe(297);
      expect(PAPER_DIMENSIONS_MM.A3.heightMm).toBe(420);
      expect(PAPER_DIMENSIONS_MM.A5.widthMm).toBe(148);
      expect(PAPER_DIMENSIONS_MM.A5.heightMm).toBe(210);
      expect(PAPER_DIMENSIONS_MM.B5.widthMm).toBe(176);
      expect(PAPER_DIMENSIONS_MM.B5.heightMm).toBe(250);
    });
  });
});
