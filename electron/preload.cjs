const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,

  getFilePath: (file) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file) || '';
      }
      return '';
    } catch {
      return '';
    }
  },

  readLocalFile: (filePath) => ipcRenderer.invoke('file:read-local', filePath),

  savePdfDialog: (pdfBytes, suggestedName) =>
    ipcRenderer.invoke('file:save-pdf', { pdfBytes, suggestedName }),

  getPrinters: () => ipcRenderer.invoke('printer:list'),

  getPrinterCapabilities: (printerName, portName) =>
    ipcRenderer.invoke('printer:capabilities', { printerName, portName }),

  openPrinterPreferences: (printerName) =>
    ipcRenderer.invoke('printer:open-preferences', printerName),

  printPdfNative: (request) => ipcRenderer.invoke('printer:print-pdf', request),

  onPrintStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('printer:status', listener);
    return () => ipcRenderer.removeListener('printer:status', listener);
  },
});
