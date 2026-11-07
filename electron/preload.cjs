const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printToDevice: (options) => ipcRenderer.invoke('print-to-device', options),
});
