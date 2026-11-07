import { PDFDocument } from 'pdf-lib';

export interface ImageToPdfOptions {
  mode: 'merged' | 'separate';
  pageSize: 'A4' | 'fit';
  orientation: 'portrait' | 'landscape' | 'auto';
  marginMm: number; // 0, 5, 10
  documentName?: string;
}

/**
 * Loads any image file (PNG, JPG, WebP, BMP, etc.) into an HTML5 Canvas
 * and converts to a crisp JPEG DataURL with natural dimensions
 */
export async function loadImageToCanvasData(file: File): Promise<{
  dataUrl: string;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to get 2d canvas context'));
          return;
        }

        // Draw background white for transparent PNG/WebP
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
        URL.revokeObjectURL(objectUrl);

        resolve({
          dataUrl,
          width: canvas.width,
          height: canvas.height,
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}

/**
 * Converts a list of image files into one or more PDF Files
 */
export async function convertImagesToPdfFiles(
  imageFiles: File[],
  options: ImageToPdfOptions
): Promise<File[]> {
  if (imageFiles.length === 0) return [];

  // 1. Separate Mode: each image produces 1 PDF file
  if (options.mode === 'separate') {
    const resultFiles: File[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const imgFile = imageFiles[i];
      const imgData = await loadImageToCanvasData(imgFile);

      const pdfDoc = await PDFDocument.create();
      const imageBytes = await fetch(imgData.dataUrl).then((r) => r.arrayBuffer());
      const embeddedImg = await pdfDoc.embedJpg(imageBytes);

      // Standard A4: 595.28 x 841.89 pt (1 mm = 2.83465 pt)
      let pageW = 595.28;
      let pageH = 841.89;

      if (options.pageSize === 'fit') {
        pageW = imgData.width * 0.75; // 96dpi to 72dpi
        pageH = imgData.height * 0.75;
      } else {
        const isLandscape =
          options.orientation === 'landscape' ||
          (options.orientation === 'auto' && imgData.width > imgData.height);
        if (isLandscape) {
          pageW = 841.89;
          pageH = 595.28;
        }
      }

      const page = pdfDoc.addPage([pageW, pageH]);
      const marginPt = options.marginMm * 2.83465;

      const availW = Math.max(10, pageW - 2 * marginPt);
      const availH = Math.max(10, pageH - 2 * marginPt);

      // Fit aspect ratio
      const imgAspect = imgData.width / imgData.height;
      const boxAspect = availW / availH;

      let drawW = availW;
      let drawH = availH;

      if (imgAspect > boxAspect) {
        drawW = availW;
        drawH = availW / imgAspect;
      } else {
        drawH = availH;
        drawW = availH * imgAspect;
      }

      const drawX = marginPt + (availW - drawW) / 2;
      const drawY = marginPt + (availH - drawH) / 2;

      page.drawImage(embeddedImg, {
        x: drawX,
        y: drawY,
        width: drawW,
        height: drawH,
      });

      const pdfBytes = await pdfDoc.save();
      const baseName = imgFile.name.replace(/\.[^/.]+$/, '');
      const outPdf = new File(
        [pdfBytes as unknown as BlobPart],
        `${baseName}.pdf`,
        { type: 'application/pdf' }
      );
      resultFiles.push(outPdf);
    }

    return resultFiles;
  }

  // 2. Merged Mode: all images into 1 combined multi-page PDF document
  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < imageFiles.length; i++) {
    const imgFile = imageFiles[i];
    const imgData = await loadImageToCanvasData(imgFile);

    const imageBytes = await fetch(imgData.dataUrl).then((r) => r.arrayBuffer());
    const embeddedImg = await pdfDoc.embedJpg(imageBytes);

    let pageW = 595.28;
    let pageH = 841.89;

    if (options.pageSize === 'fit') {
      pageW = imgData.width * 0.75;
      pageH = imgData.height * 0.75;
    } else {
      const isLandscape =
        options.orientation === 'landscape' ||
        (options.orientation === 'auto' && imgData.width > imgData.height);
      if (isLandscape) {
        pageW = 841.89;
        pageH = 595.28;
      }
    }

    const page = pdfDoc.addPage([pageW, pageH]);
    const marginPt = options.marginMm * 2.83465;

    const availW = Math.max(10, pageW - 2 * marginPt);
    const availH = Math.max(10, pageH - 2 * marginPt);

    const imgAspect = imgData.width / imgData.height;
    const boxAspect = availW / availH;

    let drawW = availW;
    let drawH = availH;

    if (imgAspect > boxAspect) {
      drawW = availW;
      drawH = availW / imgAspect;
    } else {
      drawH = availH;
      drawW = availH * imgAspect;
    }

    const drawX = marginPt + (availW - drawW) / 2;
    const drawY = marginPt + (availH - drawH) / 2;

    page.drawImage(embeddedImg, {
      x: drawX,
      y: drawY,
      width: drawW,
      height: drawH,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const docName =
    options.documentName?.trim() ||
    `Images_Converted_${new Date().toISOString().slice(0, 10)}.pdf`;
  const finalName = docName.endsWith('.pdf') ? docName : `${docName}.pdf`;

  const mergedFile = new File(
    [pdfBytes as unknown as BlobPart],
    finalName,
    { type: 'application/pdf' }
  );

  return [mergedFile];
}
