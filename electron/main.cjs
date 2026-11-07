const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    title: 'سیستم مونتاژ و چاپ PDF و تصاویر (PDF Print Studio)',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    show: false, // Don't show until ready-to-show to prevent flicker
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
    },
  });

  // Open external links in default browser instead of electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // In production, load the built dist/index.html
  // In dev, load localhost:3000
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools in dev mode
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle native Windows printer detection and silent/configured printing
ipcMain.handle('get-printers', async () => {
  try {
    let electronPrinters = [];
    if (mainWindow && mainWindow.webContents && mainWindow.webContents.getPrintersAsync) {
      try {
        electronPrinters = (await mainWindow.webContents.getPrintersAsync()) || [];
      } catch (e) {
        console.warn('getPrintersAsync error:', e);
      }
    }

    if (electronPrinters && electronPrinters.length > 0) {
      return electronPrinters;
    }

    // PowerShell fallback on Windows to query Win32_Printer directly
    if (process.platform === 'win32') {
      const psPrinters = await new Promise((resolve) => {
        exec(
          'powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Printer | Select-Object Name, Default, PrinterStatus, PortName | ConvertTo-Json -Compress"',
          { timeout: 6000 },
          (err, stdout) => {
            if (err || !stdout || !stdout.trim()) {
              resolve([]);
              return;
            }
            try {
              const raw = stdout.trim();
              const parsed = JSON.parse(raw);
              const list = Array.isArray(parsed) ? parsed : [parsed];
              resolve(
                list
                  .filter((p) => p && p.Name)
                  .map((p) => ({
                    name: p.Name,
                    displayName: p.Name,
                    isDefault: Boolean(p.Default),
                    status: p.PrinterStatus || 0,
                    portName: p.PortName || '',
                  }))
              );
            } catch (e) {
              console.warn('Failed parsing PowerShell printer JSON:', e);
              resolve([]);
            }
          }
        );
      });

      if (psPrinters && psPrinters.length > 0) {
        return psPrinters;
      }
    }

    return electronPrinters || [];
  } catch (err) {
    console.error('Failed to get system printers:', err);
    return [];
  }
});

ipcMain.handle('print-to-device', async (event, options) => {
  if (!mainWindow) throw new Error('No active window');

  return new Promise(async (resolve, reject) => {
    let printWin = new BrowserWindow({
      show: false,
      width: 1200,
      height: 1600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    let tempHtmlPath = null;

    const cleanupTempFile = () => {
      if (tempHtmlPath) {
        try {
          if (fs.existsSync(tempHtmlPath)) {
            fs.unlinkSync(tempHtmlPath);
          }
        } catch (e) {
          console.warn('Temp print file cleanup warning:', e);
        }
        tempHtmlPath = null;
      }
    };

    try {
      if (options.htmlContent) {
        // Write to local temporary HTML file to avoid Chromium 2MB data: URL length ceiling
        tempHtmlPath = path.join(
          app.getPath('temp'),
          `print_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.html`
        );
        fs.writeFileSync(tempHtmlPath, options.htmlContent, 'utf8');
        await printWin.loadFile(tempHtmlPath);
      } else if (options.url) {
        await printWin.loadURL(options.url);
      } else {
        if (printWin) printWin.close();
        cleanupTempFile();
        reject(new Error('No content provided for printing'));
        return;
      }
    } catch (err) {
      if (printWin) printWin.close();
      cleanupTempFile();
      reject(err);
      return;
    }

    printWin.webContents.on('did-finish-load', async () => {
      // Ensure all images are fully loaded and decoded before rasterizing the print job
      try {
        await printWin.webContents.executeJavaScript(`
          Promise.all(
            Array.from(document.images).map(img => {
              if (img.complete && img.naturalWidth > 0) {
                return 'decode' in img ? img.decode().catch(() => {}) : Promise.resolve();
              }
              return new Promise(res => {
                img.onload = () => {
                  if ('decode' in img) img.decode().catch(() => {}).then(res);
                  else res();
                };
                img.onerror = res;
              });
            })
          )
        `);
      } catch (e) {
        console.warn('Wait for images in printWin error:', e);
      }

      // Small paint buffer
      await new Promise((r) => setTimeout(r, 200));

      if (!printWin) {
        cleanupTempFile();
        return;
      }

      // Map duplexMode correctly: handles duplexLong, duplexShort, and booklet
      let duplexMode = 'simplex';
      if (
        options.duplex === 'duplexLong' ||
        options.duplex === 'duplex-long' ||
        options.duplex === 'longEdge'
      ) {
        duplexMode = 'longEdge';
      } else if (
        options.duplex === 'duplexShort' ||
        options.duplex === 'duplex-short' ||
        options.duplex === 'shortEdge' ||
        options.duplex === 'booklet'
      ) {
        duplexMode = options.landscape ? 'shortEdge' : 'longEdge';
      }

      // Paper size mapping: Electron requires standard name or { width, height } in microns
      let pageSize = options.paperSize || 'A4';
      if (options.paperSize === 'B5') {
        pageSize = { width: 176000, height: 250000 };
      } else if (typeof options.paperSize === 'object' && options.paperSize.widthMm) {
        pageSize = { width: options.paperSize.widthMm * 1000, height: options.paperSize.heightMm * 1000 };
      }

      const printOpts = {
        silent: options.silent !== false && !!options.deviceName,
        printBackground: true,
        deviceName: options.deviceName || '',
        color: options.colorMode !== 'bw' && options.color !== false,
        margins: { marginType: 'none' },
        landscape: options.landscape || false,
        pagesPerSheet: 1,
        collate: options.collate !== false,
        copies: Math.max(1, options.copies || 1),
        header: '',
        footer: '',
        pageSize,
        duplexMode,
      };

      printWin.webContents.print(printOpts, (success, errorType) => {
        if (printWin) {
          printWin.close();
          printWin = null;
        }
        cleanupTempFile();
        if (!success) {
          if (errorType === 'cancelled') {
            resolve({ success: false, cancelled: true });
          } else {
            reject(new Error(errorType || 'Printing failed'));
          }
        } else {
          resolve({ success: true });
        }
      });
    });

    printWin.webContents.on('did-fail-load', (e, code, desc) => {
      if (printWin) {
        printWin.close();
        printWin = null;
      }
      cleanupTempFile();
      reject(new Error(desc || 'Failed to load print document'));
    });
  });
});

// Single instance lock to prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
