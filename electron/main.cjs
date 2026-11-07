const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { listInstalledPrinters, getNativePrinterCapabilities } = require('./winspool.cjs');
const {
  printPdfWithSumatra,
  openWindowsPrinterPreferences,
  sweepTempPrintFolder,
} = require('./printEngine.cjs');

let mainWindow = null;

const ALLOWED_LOCAL_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.tif',
  '.tiff',
  '.bmp',
]);

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.bmp': 'image/bmp',
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'استودیو چاپ کوثر | Kosar Print Studio',
    backgroundColor: '#090d16',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
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

// 1) List printers with real online/offline status
ipcMain.handle('printer:list', async () => {
  try {
    return await listInstalledPrinters(mainWindow?.webContents);
  } catch (err) {
    console.error('[IPC printer:list] Error:', err);
    return [];
  }
});

// 2) Read real driver capabilities (papers, trays/bins, duplex, color) via winspool.drv
ipcMain.handle('printer:capabilities', async (_event, payload) => {
  if (!payload || typeof payload.printerName !== 'string' || !payload.printerName.trim()) {
    throw new Error('نام چاپگر مشخص نشده است.');
  }
  const portName = typeof payload.portName === 'string' ? payload.portName : '';
  return getNativePrinterCapabilities(payload.printerName.trim(), portName);
});

// 3) Open native Windows Driver Preferences dialog
ipcMain.handle('printer:open-preferences', async (_event, printerName) => {
  const printers = await listInstalledPrinters(mainWindow?.webContents);
  return openWindowsPrinterPreferences(printerName, printers);
});

// 4) Native PDF Print via SumatraPDF CLI with guaranteed temp file cleanup
ipcMain.handle('printer:print-pdf', async (event, request) => {
  if (!request || typeof request !== 'object') {
    return { ok: false, errorCode: 'BAD_REQUEST', errorMessageFa: 'پارامترهای چاپ نامعتبر است.' };
  }
  const printers = await listInstalledPrinters(mainWindow?.webContents);
  return printPdfWithSumatra(app, request, printers, (status) => {
    try {
      if (!event.sender.isDestroyed()) {
        event.sender.send('printer:status', status);
      }
    } catch {
      // Ignore destroyed sender
    }
  });
});

// 5) Save generated PDF via native OS Save Dialog
ipcMain.handle('file:save-pdf', async (_event, payload) => {
  if (!payload || !payload.pdfBytes) {
    return { ok: false, error: 'داده فایل PDF خالی است.' };
  }
  const suggested =
    typeof payload.suggestedName === 'string' && payload.suggestedName.trim()
      ? payload.suggestedName.trim()
      : 'Kosar_Output.pdf';

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'ذخیره فایل PDF خروجی',
    defaultPath: suggested,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  try {
    const buf = Buffer.from(payload.pdfBytes);
    await fs.promises.writeFile(result.filePath, buf);
    return { ok: true, savedPath: result.filePath };
  } catch (err) {
    return { ok: false, error: `خطا در نوشتن فایل روی دیسک: ${err.message}` };
  }
});

// 6) Read local project file for Auto-Save restoration (strictly restricted to allowed print extensions)
ipcMain.handle('file:read-local', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    return { ok: false, error: 'مسیر فایل معتبر نیست.' };
  }
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_LOCAL_EXTENSIONS.has(ext)) {
    return { ok: false, error: 'پسوند فایل مجاز نیست.' };
  }
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile() || stat.size === 0 || stat.size > 600 * 1024 * 1024) {
      return { ok: false, error: 'فایل در مسیر قبلی یافت نشد یا حجم آن بیش از حد مجاز است.' };
    }
    const buf = await fs.promises.readFile(filePath);
    return {
      ok: true,
      name: path.basename(filePath),
      mimeType: MIME_BY_EXT[ext] || 'application/octet-stream',
      bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
    };
  } catch {
    return { ok: false, error: 'فایل یافت نشد.' };
  }
});

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

  app.whenReady().then(async () => {
    await sweepTempPrintFolder(app);
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('will-quit', () => {
  void sweepTempPrintFolder(app);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
