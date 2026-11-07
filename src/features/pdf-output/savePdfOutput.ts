/**
 * Save generated PDF bytes to disk using Electron native Save Dialog when running on desktop,
 * or File System Access API / browser download fallback in web mode.
 */
export async function saveGeneratedPdf(
  pdfBytes: Uint8Array,
  suggestedName: string
): Promise<{ ok: boolean; canceled?: boolean; savedPath?: string; errorMessageFa?: string }> {
  const safeName = suggestedName.toLowerCase().endsWith('.pdf')
    ? suggestedName
    : `${suggestedName}.pdf`;

  if (typeof window !== 'undefined' && window.electronAPI?.savePdfDialog) {
    const res = await window.electronAPI.savePdfDialog(pdfBytes, safeName);
    if (res.canceled) return { ok: false, canceled: true };
    if (!res.ok) {
      return { ok: false, errorMessageFa: res.error || 'خطا در ذخیره فایل PDF روی دیسک' };
    }
    return { ok: true, savedPath: res.savedPath };
  }

  const blob = new Blob([pdfBytes.slice().buffer], { type: 'application/pdf' });

  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      // @ts-expect-error File System Access API optional in TS DOM lib
      const handle = await window.showSaveFilePicker({
        suggestedName: safeName,
        types: [
          {
            description: 'PDF Document (*.pdf)',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { ok: true, savedPath: safeName };
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        return { ok: false, canceled: true };
      }
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { ok: true, savedPath: safeName };
  } catch (err) {
    return {
      ok: false,
      errorMessageFa: `خطا در دانلود فایل PDF: ${(err as Error).message}`,
    };
  }
}
