const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Validate printer name to block control characters / null bytes.
 */
function assertSafePrinterName(printerName) {
  if (
    typeof printerName !== 'string' ||
    printerName.trim().length === 0 ||
    printerName.length > 260 ||
    /[\x00-\x1f\x7f]/.test(printerName)
  ) {
    throw new Error('نام پرینتر انتخاب‌شده نامعتبر است.');
  }
  return printerName.trim();
}

/**
 * Locate SumatraPDF.exe bundled in extraResources or standard Windows paths.
 */
function resolveSumatraPdfBinary(app) {
  const candidates = [];

  if (app && app.isPackaged && process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'bin', 'SumatraPDF.exe'));
  }

  candidates.push(path.join(__dirname, '..', 'resources', 'bin', 'SumatraPDF.exe'));

  if (process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, 'SumatraPDF', 'SumatraPDF.exe'));
  }
  if (process.env.PROGRAMFILES) {
    candidates.push(path.join(process.env.PROGRAMFILES, 'SumatraPDF', 'SumatraPDF.exe'));
  }
  if (process.env['PROGRAMFILES(X86)']) {
    candidates.push(path.join(process.env['PROGRAMFILES(X86)'], 'SumatraPDF', 'SumatraPDF.exe'));
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Ignore inaccessible path
    }
  }

  return null;
}

/**
 * Build SumatraPDF `-print-settings` string with strict 100% scale (`noscale`)
 * and exact Win32 paperkind & bin IDs read from DeviceCapabilitiesW.
 */
function buildSumatraPrintSettings(options) {
  const tokens = ['noscale']; // ALWAYS 100% physical scale; layout engine already sized the PDF sheet!

  if (Number.isInteger(options.paperId) && options.paperId > 0) {
    tokens.push(`paperkind=${options.paperId}`);
  } else if (typeof options.paperName === 'string' && options.paperName.trim()) {
    const cleanPaper = options.paperName.replace(/[,;"\r\n]/g, '').trim();
    if (cleanPaper) tokens.push(`paper=${cleanPaper}`);
  }

  if (Number.isInteger(options.binId) && options.binId > 0) {
    tokens.push(`bin=${options.binId}`);
  } else if (
    typeof options.binName === 'string' &&
    options.binName.trim() &&
    !options.binName.includes('Auto') &&
    !options.binName.includes('خودکار')
  ) {
    const cleanBin = options.binName.replace(/[,;"\r\n]/g, '').trim();
    if (cleanBin) tokens.push(`bin=${cleanBin}`);
  }

  if (options.duplex === 'duplexlong' || options.duplex === 'duplexshort' || options.duplex === 'simplex') {
    tokens.push(options.duplex);
  } else {
    tokens.push('simplex');
  }

  if (options.colorMode === 'monochrome') {
    tokens.push('monochrome');
  } else {
    tokens.push('color');
  }

  const copies = Math.max(1, Math.min(999, Math.floor(Number(options.copies) || 1)));
  if (copies > 1) {
    tokens.push(`${copies}x`);
  }

  return tokens.join(',');
}

/**
 * Clean up all leftover temporary print PDF files in our dedicated temp subfolder.
 */
async function sweepTempPrintFolder(app) {
  try {
    const dir = path.join(app.getPath('temp'), 'kosar-print-studio');
    if (!fs.existsSync(dir)) return;
    const entries = await fs.promises.readdir(dir);
    await Promise.all(
      entries
        .filter((f) => f.endsWith('.pdf'))
        .map((f) => fs.promises.unlink(path.join(dir, f)).catch(() => {}))
    );
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Execute asynchronous native PDF print job via SumatraPDF CLI, ensuring temp PDF cleanup.
 */
async function printPdfWithSumatra(app, request, installedPrinters, onStatus) {
  if (process.platform !== 'win32') {
    return {
      ok: false,
      errorCode: 'UNSUPPORTED_OS',
      errorMessageFa: 'موتور چاپ مستقیم ویندوز فقط در سیستم‌عامل Windows فعال است.',
    };
  }

  let printerName;
  try {
    printerName = assertSafePrinterName(request.printerName);
  } catch (err) {
    return { ok: false, errorCode: 'INVALID_PRINTER', errorMessageFa: err.message };
  }

  // Verify printer exists on system so driverless/removed printers don't crash
  const matchedPrinter = Array.isArray(installedPrinters)
    ? installedPrinters.find((p) => p.name === printerName)
    : null;

  if (Array.isArray(installedPrinters) && installedPrinters.length > 0 && !matchedPrinter) {
    return {
      ok: false,
      errorCode: 'PRINTER_NOT_FOUND',
      errorMessageFa: `چاپگر «${printerName}» در ویندوز یافت نشد. لطفاً لیست پرینترها را تازه‌سازی کنید.`,
    };
  }

  const rawBytes = request.pdfBytes;
  const pdfBuffer = Buffer.isBuffer(rawBytes)
    ? rawBytes
    : rawBytes instanceof Uint8Array
    ? Buffer.from(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength)
    : null;

  if (!pdfBuffer || pdfBuffer.length < 16 || pdfBuffer.toString('ascii', 0, 5) !== '%PDF-') {
    return {
      ok: false,
      errorCode: 'INVALID_PDF',
      errorMessageFa: 'داده فایل PDF تولیدشده معتبر نیست.',
    };
  }

  const sumatraExe = resolveSumatraPdfBinary(app);
  if (!sumatraExe) {
    return {
      ok: false,
      errorCode: 'SUMATRA_MISSING',
      errorMessageFa:
        'فایل موتور چاپ SumatraPDF.exe در پوشه resources/bin یافت نشد. لطفاً طبق راهنمای ساخت، فایل SumatraPDF.exe را در مسیر resources/bin قرار دهید یا SumatraPDF را روی ویندوز نصب کنید.',
    };
  }

  const tempDir = path.join(app.getPath('temp'), 'kosar-print-studio');
  await fs.promises.mkdir(tempDir, { recursive: true });
  const tempPdfPath = path.join(tempDir, `print_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.pdf`);

  try {
    onStatus?.({ percent: 85, messageFa: 'در حال نوشتن فایل موقت چاپ با مقیاس دقیق ۱۰۰٪...' });
    await fs.promises.writeFile(tempPdfPath, pdfBuffer, { mode: 0o600 });

    const printSettingsStr = buildSumatraPrintSettings(request);
    const cliArgs = [
      '-print-to',
      printerName,
      '-silent',
      '-exit-when-done',
      '-print-settings',
      printSettingsStr,
      tempPdfPath,
    ];

    onStatus?.({
      percent: 92,
      messageFa: matchedPrinter?.isOffline
        ? `چاپگر «${printerName}» آفلاین است؛ در حال ارسال به صف انتظار ویندوز...`
        : `در حال ارسال مستقیم به درایور «${printerName}»...`,
    });

    await new Promise((resolve, reject) => {
      execFile(
        sumatraExe,
        cliArgs,
        {
          timeout: 120_000,
          windowsHide: true,
        },
        (error, _stdout, stderr) => {
          if (error) {
            const detail = (stderr || error.message || '').trim();
            if (error.killed || error.signal === 'SIGTERM') {
              reject(
                new Error(
                  `پاسخگویی درایور چاپگر «${printerName}» بیش از حد طول کشید (Timeout). وضعیت اتصال پرینتر را بررسی کنید.`
                )
              );
              return;
            }
            reject(
              new Error(
                `ارسال به چاپگر «${printerName}» ناموفق بود${
                  matchedPrinter?.isOffline ? ' (پرینتر آفلاین است)' : ''
                }. ${detail ? `جزئیات: ${detail}` : 'از نصب صحیح درایور پرینتر مطمئن شوید.'}`
              )
            );
            return;
          }
          resolve();
        }
      );
    });

    onStatus?.({ percent: 100, messageFa: 'فرمان چاپ با موفقیت تحویل صف چاپ ویندوز شد.' });

    return {
      ok: true,
      engine: 'SumatraPDF',
      commandSummary: `-print-to "${printerName}" -print-settings "${printSettingsStr}"`,
    };
  } catch (err) {
    return {
      ok: false,
      errorCode: 'PRINT_EXEC_FAILED',
      errorMessageFa: err.message || 'خطای غیرمنتظره هنگام ارسال به چاپگر رخ داد.',
    };
  } finally {
    // Guaranteed cleanup of temp PDF file
    try {
      await fs.promises.unlink(tempPdfPath);
    } catch {
      // Ignore if already deleted
    }
  }
}

/**
 * Open native Windows Printer Driver Printing Preferences dialog (`rundll32 printui.dll,PrintUIEntry /e /n"<name>"`).
 */
async function openWindowsPrinterPreferences(printerName, installedPrinters) {
  if (process.platform !== 'win32') {
    return {
      ok: false,
      errorMessageFa: 'پنجره تنظیمات اختصاصی درایور فقط در سیستم‌عامل ویندوز در دسترس است.',
    };
  }

  let safeName;
  try {
    safeName = assertSafePrinterName(printerName);
  } catch (err) {
    return { ok: false, errorMessageFa: err.message };
  }

  if (
    Array.isArray(installedPrinters) &&
    installedPrinters.length > 0 &&
    !installedPrinters.some((p) => p.name === safeName)
  ) {
    return {
      ok: false,
      errorMessageFa: `چاپگر «${safeName}» در سیستم یافت نشد.`,
    };
  }

  return new Promise((resolve) => {
    const child = execFile(
      'rundll32.exe',
      ['printui.dll,PrintUIEntry', '/e', `/n${safeName}`],
      { windowsHide: false },
      (err) => {
        if (err) {
          console.warn('[printui] Error:', err.message);
        }
      }
    );
    child.on('error', (err) => {
      resolve({
        ok: false,
        errorMessageFa: `امکان باز کردن تنظیمات درایور وجود ندارد: ${err.message}`,
      });
    });
    // PrintUIEntry stays open while user edits preferences; resolve immediately once spawned
    setTimeout(() => resolve({ ok: true }), 180);
  });
}

module.exports = {
  buildSumatraPrintSettings,
  printPdfWithSumatra,
  openWindowsPrinterPreferences,
  sweepTempPrintFolder,
};
