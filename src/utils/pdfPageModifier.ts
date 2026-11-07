import { PDFDocument } from 'pdf-lib';

/**
 * Duplicates a specified page in a PDF file by `copies` count
 */
export async function duplicatePdfPage(
  file: File,
  pageNumber: number, // 1-based page number
  copies: number = 1,
  insertAt: 'after' | 'end' = 'after'
): Promise<{ newFile: File; newPageCount: number }> {
  const fileBytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(fileBytes);
  const totalPages = pdfDoc.getPageCount();

  const pageIndex = Math.max(0, Math.min(totalPages - 1, pageNumber - 1));

  // Copy pages
  const copiedIndices = new Array(copies).fill(pageIndex);
  const copiedPages = await pdfDoc.copyPages(pdfDoc, copiedIndices);

  if (insertAt === 'end') {
    for (const page of copiedPages) {
      pdfDoc.addPage(page);
    }
  } else {
    // Insert immediately after current page
    let insertIdx = pageIndex + 1;
    for (const page of copiedPages) {
      pdfDoc.insertPage(insertIdx, page);
      insertIdx++;
    }
  }

  const modifiedBytes = await pdfDoc.save();
  const newFile = new File([modifiedBytes as unknown as BlobPart], file.name, {
    type: 'application/pdf',
    lastModified: Date.now(),
  });

  return {
    newFile,
    newPageCount: pdfDoc.getPageCount(),
  };
}

/**
 * Inserts one or more blank white pages into a PDF file
 */
export async function insertBlankPdfPage(
  file: File,
  afterPageNumber: number, // 1-based (0 means at start)
  copies: number = 1,
  widthMm: number = 210,
  heightMm: number = 297
): Promise<{ newFile: File; newPageCount: number }> {
  const fileBytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(fileBytes);
  const totalPages = pdfDoc.getPageCount();

  // 1 mm = 2.83465 pt (72 pt / 25.4 mm)
  let ptWidth = widthMm * 2.83465;
  let ptHeight = heightMm * 2.83465;

  // If document has pages, match current page size
  if (totalPages > 0) {
    const refPageIdx = Math.max(0, Math.min(totalPages - 1, afterPageNumber - 1));
    const refPage = pdfDoc.getPage(refPageIdx);
    const { width, height } = refPage.getSize();
    ptWidth = width;
    ptHeight = height;
  }

  let insertIdx = Math.max(0, Math.min(totalPages, afterPageNumber));

  for (let i = 0; i < copies; i++) {
    if (insertIdx >= pdfDoc.getPageCount()) {
      pdfDoc.addPage([ptWidth, ptHeight]);
    } else {
      pdfDoc.insertPage(insertIdx, [ptWidth, ptHeight]);
    }
    insertIdx++;
  }

  const modifiedBytes = await pdfDoc.save();
  const newFile = new File([modifiedBytes as unknown as BlobPart], file.name, {
    type: 'application/pdf',
    lastModified: Date.now(),
  });

  return {
    newFile,
    newPageCount: pdfDoc.getPageCount(),
  };
}

/**
 * Deletes a specified page from a PDF file
 */
export async function deletePdfPage(
  file: File,
  pageNumber: number // 1-based
): Promise<{ newFile: File; newPageCount: number }> {
  const fileBytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(fileBytes);
  const totalPages = pdfDoc.getPageCount();

  if (totalPages <= 1) {
    throw new Error('سند باید حداقل دارای یک صفحه باشد.');
  }

  const pageIndex = Math.max(0, Math.min(totalPages - 1, pageNumber - 1));
  pdfDoc.removePage(pageIndex);

  const modifiedBytes = await pdfDoc.save();
  const newFile = new File([modifiedBytes as unknown as BlobPart], file.name, {
    type: 'application/pdf',
    lastModified: Date.now(),
  });

  return {
    newFile,
    newPageCount: pdfDoc.getPageCount(),
  };
}

/**
 * Reorders a page within the same PDF file
 */
export async function reorderPdfPage(
  file: File,
  fromPageNumber: number, // 1-based
  toPageNumber: number // 1-based
): Promise<{ newFile: File; newPageCount: number }> {
  if (fromPageNumber === toPageNumber) {
    return { newFile: file, newPageCount: 1 };
  }

  const fileBytes = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(fileBytes);
  const totalPages = srcDoc.getPageCount();

  const fromIdx = Math.max(0, Math.min(totalPages - 1, fromPageNumber - 1));
  const toIdx = Math.max(0, Math.min(totalPages - 1, toPageNumber - 1));

  const pageIndices: number[] = Array.from({ length: totalPages }, (_, i) => i);
  // Remove fromIdx and insert at toIdx
  const [removed] = pageIndices.splice(fromIdx, 1);
  pageIndices.splice(toIdx, 0, removed);

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  const modifiedBytes = await newDoc.save();
  const newFile = new File([modifiedBytes as unknown as BlobPart], file.name, {
    type: 'application/pdf',
    lastModified: Date.now(),
  });

  return {
    newFile,
    newPageCount: newDoc.getPageCount(),
  };
}

/**
 * Moves a page from source PDF to target PDF at target index
 */
export async function movePageBetweenPdfs(
  sourceFile: File,
  sourcePageNum: number, // 1-based
  targetFile: File,
  targetPageNum: number // 1-based
): Promise<{
  newSourceFile: File;
  newSourcePageCount: number;
  newTargetFile: File;
  newTargetPageCount: number;
}> {
  const srcBytes = await sourceFile.arrayBuffer();
  const tgtBytes = await targetFile.arrayBuffer();

  const srcDoc = await PDFDocument.load(srcBytes);
  const tgtDoc = await PDFDocument.load(tgtBytes);

  const srcIdx = Math.max(0, Math.min(srcDoc.getPageCount() - 1, sourcePageNum - 1));
  const tgtIdx = Math.max(0, Math.min(tgtDoc.getPageCount(), targetPageNum));

  // Copy page from source into target
  const [copiedPage] = await tgtDoc.copyPages(srcDoc, [srcIdx]);
  if (tgtIdx >= tgtDoc.getPageCount()) {
    tgtDoc.addPage(copiedPage);
  } else {
    tgtDoc.insertPage(tgtIdx, copiedPage);
  }

  // Remove page from source
  if (srcDoc.getPageCount() > 1) {
    srcDoc.removePage(srcIdx);
  }

  const newSrcBytes = await srcDoc.save();
  const newTgtBytes = await tgtDoc.save();

  const newSourceFile = new File([newSrcBytes as unknown as BlobPart], sourceFile.name, {
    type: 'application/pdf',
    lastModified: Date.now(),
  });

  const newTargetFile = new File([newTgtBytes as unknown as BlobPart], targetFile.name, {
    type: 'application/pdf',
    lastModified: Date.now(),
  });

  return {
    newSourceFile,
    newSourcePageCount: srcDoc.getPageCount(),
    newTargetFile,
    newTargetPageCount: tgtDoc.getPageCount(),
  };
}

