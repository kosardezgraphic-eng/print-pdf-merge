import React, { useState, useEffect } from 'react';
import { FileText, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { PDFItem } from '../types';
import { renderPdfPageToDataUrl } from '../utils/pdfRenderUtils';

interface PageThumbnailProps {
  item: PDFItem;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// In-memory global cache for page 1 thumbnails so we don't re-render multiple times
const globalThumbnailsCache = new Map<string, string>();

export const PageThumbnail: React.FC<PageThumbnailProps> = ({
  item,
  size = 'md',
  className = '',
}) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(() => {
    return globalThumbnailsCache.get(item.id) || null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(!thumbUrl);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;

    if (globalThumbnailsCache.has(item.id)) {
      setThumbUrl(globalThumbnailsCache.get(item.id)!);
      setIsLoading(false);
      return;
    }

    async function loadThumb() {
      setIsLoading(true);
      setHasError(false);
      try {
        const res = await renderPdfPageToDataUrl(item.file, 1, 0.45);
        if (!isCancelled) {
          globalThumbnailsCache.set(item.id, res.dataUrl);
          setThumbUrl(res.dataUrl);
          setIsLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn(`Could not render thumbnail for ${item.name}:`, err);
          setHasError(true);
          setIsLoading(false);
        }
      }
    }

    loadThumb();
    return () => {
      isCancelled = true;
    };
  }, [item.id, item.file]);

  // Adjustments applied to page 1
  const adj = item.pageAdjustments?.[1];
  const filters: string[] = [];
  if (adj) {
    if (adj.brightness !== 100) filters.push(`brightness(${adj.brightness}%)`);
    if (adj.contrast !== 100) filters.push(`contrast(${adj.contrast}%)`);
    if (adj.grayscale) filters.push('grayscale(100%)');
    if (adj.invert) filters.push('invert(100%)');
  }

  const totalAngle = (item.rotation || 0) + (adj?.rotation || 0) + (adj?.fineAngle || 0);

  // Size configurations
  const dimensions =
    size === 'sm'
      ? 'w-9 h-12' // for table rows
      : size === 'lg'
      ? 'w-20 h-28'
      : 'w-16 h-22'; // default card thumbnail

  return (
    <div
      className={`relative rounded-md overflow-hidden bg-white dark:bg-neutral-950 border border-slate-300 dark:border-neutral-750 shadow-xs flex items-center justify-center shrink-0 select-none ${dimensions} ${className}`}
    >
      {thumbUrl ? (
        <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
          <img
            src={thumbUrl}
            alt={item.name}
            style={{
              filter: filters.length > 0 ? filters.join(' ') : undefined,
              clipPath:
                adj && (adj.crop.top > 0 || adj.crop.bottom > 0 || adj.crop.left > 0 || adj.crop.right > 0)
                  ? `inset(${adj.crop.top}% ${adj.crop.right}% ${adj.crop.bottom}% ${adj.crop.left}%)`
                  : undefined,
              transform: totalAngle ? `rotate(${totalAngle}deg)` : undefined,
            }}
            className="max-w-full max-h-full object-contain pointer-events-none transition-transform"
          />
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center text-neutral-400 gap-1">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-red-500">
          <FileText className="w-5 h-5 opacity-80" />
        </div>
      )}
    </div>
  );
};
