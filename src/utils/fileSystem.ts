/**
 * Utility to save a file to a specific folder on Windows or disk.
 * Uses the File System Access API (showSaveFilePicker) when available,
 * allowing the user to select the target directory and filename natively.
 * Falls back to standard browser download if not supported.
 */
export async function savePdfFile(blob: Blob, suggestedFileName: string): Promise<{ success: boolean; canceled?: boolean; method: 'picker' | 'fallback' }> {
  // Ensure .pdf extension
  const fileName = suggestedFileName.toLowerCase().endsWith('.pdf')
    ? suggestedFileName
    : `${suggestedFileName}.pdf`;

  // Check if File System Access API is supported (Windows Edge, Chrome, Opera, etc.)
  if ('showSaveFilePicker' in window) {
    try {
      const pickerOpts = {
        suggestedName: fileName,
        types: [
          {
            description: 'PDF Document (*.pdf)',
            accept: {
              'application/pdf': ['.pdf'],
            },
          },
        ],
      };

      // @ts-expect-error window.showSaveFilePicker is not in standard ts lib
      const handle = await window.showSaveFilePicker(pickerOpts);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { success: true, method: 'picker' };
    } catch (err) {
      // AbortError means the user clicked Cancel in the Windows Save dialog
      if ((err as Error).name === 'AbortError') {
        return { success: false, canceled: true, method: 'picker' };
      }
      console.warn('showSaveFilePicker failed, falling back to direct download:', err);
    }
  }

  // Fallback to standard anchor download
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return { success: true, method: 'fallback' };
  } catch (err) {
    console.error('Download error:', err);
    return { success: false, method: 'fallback' };
  }
}
