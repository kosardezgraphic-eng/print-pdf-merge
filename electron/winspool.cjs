const { execFile } = require('child_process');

// Win32 wingdi.h DeviceCapabilitiesW constants
const DC_PAPERS = 2;
const DC_PAPERSIZE = 3;
const DC_BINS = 6;
const DC_DUPLEX = 7;
const DC_BINNAMES = 12;
const DC_PAPERNAMES = 16;
const DC_COLORDEVICE = 32;

// Win32 Printer Status flags
const PRINTER_STATUS_OFFLINE = 0x00000080;
const PRINTER_STATUS_ERROR = 0x00000002;
const PRINTER_STATUS_PAPER_OUT = 0x00000010;
const PRINTER_STATUS_PAPER_JAM = 0x00000008;
const PRINTER_STATUS_NOT_AVAILABLE = 0x00001000;

let cachedDeviceCapabilitiesFn = undefined;

/**
 * Bind DeviceCapabilitiesW from winspool.drv lazily via koffi (MIT FFI, <5ms call time).
 */
function getWinspoolDeviceCapabilitiesFn() {
  if (cachedDeviceCapabilitiesFn !== undefined) {
    return cachedDeviceCapabilitiesFn;
  }
  if (process.platform !== 'win32') {
    cachedDeviceCapabilitiesFn = null;
    return null;
  }
  try {
    const koffi = require('koffi');
    const winspool = koffi.load('winspool.drv');
    // int __stdcall DeviceCapabilitiesW(LPCWSTR pDevice, LPCWSTR pPort, WORD fwCapability, void *pOutput, const void *pDevMode)
    cachedDeviceCapabilitiesFn = winspool.func(
      'int __stdcall DeviceCapabilitiesW(str16 pDevice, str16 pPort, uint16 fwCapability, void *pOutput, void *pDevMode)'
    );
    return cachedDeviceCapabilitiesFn;
  } catch (err) {
    console.warn('[winspool] koffi binding unavailable, will use PowerShell P/Invoke fallback:', err.message);
    cachedDeviceCapabilitiesFn = null;
    return null;
  }
}

/**
 * Decode a fixed-width UTF-16LE null-terminated WCHAR[charCount] slot from a Buffer.
 */
function readFixedUtf16String(buf, byteOffset, maxChars) {
  const maxBytes = maxChars * 2;
  let end = byteOffset;
  const limit = Math.min(buf.length, byteOffset + maxBytes);
  while (end + 1 < limit) {
    if (buf[end] === 0 && buf[end + 1] === 0) {
      break;
    }
    end += 2;
  }
  return buf.toString('utf16le', byteOffset, end).trim();
}

/**
 * Query real printer driver capabilities via koffi -> winspool.drv!DeviceCapabilitiesW
 */
function queryCapabilitiesViaKoffi(printerName, portName = '') {
  const DeviceCapabilitiesW = getWinspoolDeviceCapabilitiesFn();
  if (!DeviceCapabilitiesW) return null;

  const portArg = portName || null;

  // 1) Papers count, IDs, names, and physical 0.1mm dimensions
  const paperCount = DeviceCapabilitiesW(printerName, portArg, DC_PAPERS, null, null);
  const papers = [];

  if (paperCount > 0 && paperCount < 2000) {
    const idsBuf = Buffer.alloc(paperCount * 2); // WORD[count]
    const namesBuf = Buffer.alloc(paperCount * 64 * 2); // WCHAR[count][64]
    const sizesBuf = Buffer.alloc(paperCount * 8); // POINT[count] (2 x int32 in 0.1mm)

    const gotIds = DeviceCapabilitiesW(printerName, portArg, DC_PAPERS, idsBuf, null);
    const gotNames = DeviceCapabilitiesW(printerName, portArg, DC_PAPERNAMES, namesBuf, null);
    const gotSizes = DeviceCapabilitiesW(printerName, portArg, DC_PAPERSIZE, sizesBuf, null);

    const n = Math.min(
      paperCount,
      gotIds > 0 ? gotIds : paperCount,
      gotNames > 0 ? gotNames : paperCount
    );

    const seenIds = new Set();
    for (let i = 0; i < n; i++) {
      const id = idsBuf.readUInt16LE(i * 2);
      if (id === 0 || seenIds.has(id)) continue;
      seenIds.add(id);

      const rawName = readFixedUtf16String(namesBuf, i * 128, 64) || `Paper #${id}`;
      let widthMm = 0;
      let heightMm = 0;
      if (gotSizes > i) {
        const wTenths = sizesBuf.readInt32LE(i * 8);
        const hTenths = sizesBuf.readInt32LE(i * 8 + 4);
        if (wTenths > 0 && hTenths > 0) {
          widthMm = Number((wTenths / 10).toFixed(1));
          heightMm = Number((hTenths / 10).toFixed(1));
        }
      }
      papers.push({ id, name: rawName, widthMm, heightMm });
    }
  }

  // 2) Bins / Trays count, IDs, and names
  const binCount = DeviceCapabilitiesW(printerName, portArg, DC_BINS, null, null);
  const bins = [];

  if (binCount > 0 && binCount < 500) {
    const binIdsBuf = Buffer.alloc(binCount * 2); // WORD[count]
    const binNamesBuf = Buffer.alloc(binCount * 24 * 2); // WCHAR[count][24]

    const gotBinIds = DeviceCapabilitiesW(printerName, portArg, DC_BINS, binIdsBuf, null);
    const gotBinNames = DeviceCapabilitiesW(printerName, portArg, DC_BINNAMES, binNamesBuf, null);

    const m = Math.min(
      binCount,
      gotBinIds > 0 ? gotBinIds : binCount,
      gotBinNames > 0 ? gotBinNames : binCount
    );

    const seenBins = new Set();
    for (let i = 0; i < m; i++) {
      const id = binIdsBuf.readUInt16LE(i * 2);
      if (id === 0 || seenBins.has(id)) continue;
      seenBins.add(id);

      const rawName = readFixedUtf16String(binNamesBuf, i * 48, 24) || `Tray #${id}`;
      bins.push({ id, name: rawName });
    }
  }

  // 3) Duplex & Color capabilities
  const duplexRes = DeviceCapabilitiesW(printerName, portArg, DC_DUPLEX, null, null);
  const colorRes = DeviceCapabilitiesW(printerName, portArg, DC_COLORDEVICE, null, null);

  return {
    printerName,
    papers,
    bins,
    supportsDuplex: duplexRes === 1,
    supportsColor: colorRes === 1,
    source: 'winspool',
  };
}

/**
 * Fallback: PowerShell inline C# P/Invoke to winspool.drv DeviceCapabilitiesW if koffi fails.
 */
function queryCapabilitiesViaPowerShell(printerName, portName = '') {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(null);
      return;
    }

    const csScript = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public class WinSpoolCaps {
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern int DeviceCapabilitiesW(string pDevice, string pPort, ushort fwCap, IntPtr pOutput, IntPtr pDevMode);

  public static object Query(string dev, string port) {
    int pc = DeviceCapabilitiesW(dev, port, 2, IntPtr.Zero, IntPtr.Zero);
    var papers = new List<Dictionary<string, object>>();
    if (pc > 0 && pc < 2000) {
      IntPtr pIds = Marshal.AllocHGlobal(pc * 2);
      IntPtr pNames = Marshal.AllocHGlobal(pc * 128);
      IntPtr pSizes = Marshal.AllocHGlobal(pc * 8);
      try {
        DeviceCapabilitiesW(dev, port, 2, pIds, IntPtr.Zero);
        DeviceCapabilitiesW(dev, port, 16, pNames, IntPtr.Zero);
        int gs = DeviceCapabilitiesW(dev, port, 3, pSizes, IntPtr.Zero);
        for (int i = 0; i < pc; i++) {
          int id = (ushort)Marshal.ReadInt16(pIds, i * 2);
          string nm = Marshal.PtrToStringUni(IntPtr.Add(pNames, i * 128), 64);
          int nul = nm.IndexOf('\\0');
          if (nul >= 0) nm = nm.Substring(0, nul);
          double w = gs > i ? Marshal.ReadInt32(pSizes, i * 8) / 10.0 : 0;
          double h = gs > i ? Marshal.ReadInt32(pSizes, i * 8 + 4) / 10.0 : 0;
          if (id > 0) {
            var d = new Dictionary<string, object>();
            d["id"] = id; d["name"] = nm.Trim(); d["widthMm"] = w; d["heightMm"] = h;
            papers.Add(d);
          }
        }
      } finally {
        Marshal.FreeHGlobal(pIds); Marshal.FreeHGlobal(pNames); Marshal.FreeHGlobal(pSizes);
      }
    }
    int bc = DeviceCapabilitiesW(dev, port, 6, IntPtr.Zero, IntPtr.Zero);
    var bins = new List<Dictionary<string, object>>();
    if (bc > 0 && bc < 500) {
      IntPtr bIds = Marshal.AllocHGlobal(bc * 2);
      IntPtr bNames = Marshal.AllocHGlobal(bc * 48);
      try {
        DeviceCapabilitiesW(dev, port, 6, bIds, IntPtr.Zero);
        DeviceCapabilitiesW(dev, port, 12, bNames, IntPtr.Zero);
        for (int i = 0; i < bc; i++) {
          int id = (ushort)Marshal.ReadInt16(bIds, i * 2);
          string nm = Marshal.PtrToStringUni(IntPtr.Add(bNames, i * 48), 24);
          int nul = nm.IndexOf('\\0');
          if (nul >= 0) nm = nm.Substring(0, nul);
          if (id > 0) {
            var d = new Dictionary<string, object>();
            d["id"] = id; d["name"] = nm.Trim();
            bins.Add(d);
          }
        }
      } finally {
        Marshal.FreeHGlobal(bIds); Marshal.FreeHGlobal(bNames);
      }
    }
    bool dup = DeviceCapabilitiesW(dev, port, 7, IntPtr.Zero, IntPtr.Zero) == 1;
    bool col = DeviceCapabilitiesW(dev, port, 32, IntPtr.Zero, IntPtr.Zero) == 1;
    return new Dictionary<string, object> {
      { "papers", papers }, { "bins", bins }, { "supportsDuplex", dup }, { "supportsColor", col }
    };
  }
}
"@
$res = [WinSpoolCaps]::Query($env:KOSAR_PRINTER_NAME, $env:KOSAR_PRINTER_PORT)
$res | ConvertTo-Json -Depth 5 -Compress
`;

    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', csScript],
      {
        timeout: 8000,
        env: {
          ...process.env,
          KOSAR_PRINTER_NAME: printerName,
          KOSAR_PRINTER_PORT: portName || '',
        },
      },
      (err, stdout) => {
        if (err || !stdout || !stdout.trim()) {
          resolve(null);
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          resolve({
            printerName,
            papers: Array.isArray(parsed.papers) ? parsed.papers : [],
            bins: Array.isArray(parsed.bins) ? parsed.bins : [],
            supportsDuplex: Boolean(parsed.supportsDuplex),
            supportsColor: Boolean(parsed.supportsColor),
            source: 'powershell',
          });
        } catch {
          resolve(null);
        }
      }
    );
  });
}

/**
 * Query full capabilities for a printer name, using koffi first and PowerShell P/Invoke fallback.
 */
async function getNativePrinterCapabilities(printerName, portName = '') {
  if (!printerName || typeof printerName !== 'string') {
    throw new Error('نام چاپگر نامعتبر است.');
  }

  const koffiRes = queryCapabilitiesViaKoffi(printerName, portName);
  if (koffiRes && (koffiRes.papers.length > 0 || koffiRes.bins.length > 0)) {
    return koffiRes;
  }

  const psRes = await queryCapabilitiesViaPowerShell(printerName, portName);
  if (psRes) {
    return psRes;
  }

  // Safe standard fallback if virtual driver reports 0 papers (e.g. generic XPS/Port)
  return {
    printerName,
    papers: [
      { id: 9, name: 'A4 (210 x 297 mm)', widthMm: 210, heightMm: 297 },
      { id: 8, name: 'A3 (297 x 420 mm)', widthMm: 297, heightMm: 420 },
      { id: 11, name: 'A5 (148 x 210 mm)', widthMm: 148, heightMm: 210 },
      { id: 1, name: 'Letter (8.5 x 11 in)', widthMm: 215.9, heightMm: 279.4 },
    ],
    bins: [{ id: 7, name: 'انتخاب خودکار سینی (Auto)' }],
    supportsDuplex: koffiRes ? koffiRes.supportsDuplex : false,
    supportsColor: koffiRes ? koffiRes.supportsColor : true,
    source: 'simulated',
  };
}

/**
 * Translate Windows printer status flags & WMI status into clear Persian text.
 */
function describePrinterStatus(statusFlags, workOffline = false, wmiPrinterStatus = 0) {
  if (
    workOffline ||
    (statusFlags & PRINTER_STATUS_OFFLINE) !== 0 ||
    (statusFlags & PRINTER_STATUS_NOT_AVAILABLE) !== 0 ||
    wmiPrinterStatus === 7
  ) {
    return { isOffline: true, statusTextFa: 'آفلاین / عدم اتصال' };
  }
  if ((statusFlags & PRINTER_STATUS_PAPER_JAM) !== 0) {
    return { isOffline: false, statusTextFa: 'گیر کردن کاغذ (Paper Jam)' };
  }
  if ((statusFlags & PRINTER_STATUS_PAPER_OUT) !== 0) {
    return { isOffline: false, statusTextFa: 'اتمام کاغذ سینی' };
  }
  if ((statusFlags & PRINTER_STATUS_ERROR) !== 0 || wmiPrinterStatus === 6) {
    return { isOffline: false, statusTextFa: 'خطای سخت‌افزاری پرینتر' };
  }
  return { isOffline: false, statusTextFa: 'آماده به کار (آنلاین)' };
}

/**
 * Query WMI Win32_Printer for accurate WorkOffline, PortName, DriverName, Default, and PrinterStatus.
 */
function queryWin32PrintersWmi() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve([]);
      return;
    }

    const cmd =
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Printer | Select-Object Name, Default, PrinterStatus, WorkOffline, PortName, DriverName | ConvertTo-Json -Compress';

    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', cmd],
      { timeout: 6500 },
      (err, stdout) => {
        if (err || !stdout || !stdout.trim()) {
          resolve([]);
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          resolve(arr.filter((p) => p && typeof p.Name === 'string'));
        } catch {
          resolve([]);
        }
      }
    );
  });
}

/**
 * List installed printers combining Electron's getPrintersAsync() + Windows WMI enrichment.
 */
async function listInstalledPrinters(webContents) {
  let electronPrinters = [];
  if (webContents && typeof webContents.getPrintersAsync === 'function') {
    try {
      electronPrinters = (await webContents.getPrintersAsync()) || [];
    } catch (err) {
      console.warn('[winspool] getPrintersAsync failed:', err.message);
    }
  }

  const wmiList = await queryWin32PrintersWmi();
  const wmiByName = new Map(wmiList.map((w) => [w.Name, w]));

  if (electronPrinters.length > 0) {
    return electronPrinters.map((ep) => {
      const wmi = wmiByName.get(ep.name);
      const workOffline = Boolean(wmi?.WorkOffline);
      const wmiStatus = Number(wmi?.PrinterStatus || 0);
      const { isOffline, statusTextFa } = describePrinterStatus(
        Number(ep.status || 0),
        workOffline,
        wmiStatus
      );
      return {
        name: ep.name,
        displayName: ep.displayName || ep.name,
        isDefault: Boolean(ep.isDefault ?? wmi?.Default),
        isOffline,
        statusCode: Number(ep.status || 0),
        statusTextFa,
        portName: wmi?.PortName || ep.options?.['printer-location'] || '',
        driverName: wmi?.DriverName || ep.description || '',
      };
    });
  }

  if (wmiList.length > 0) {
    return wmiList.map((wmi) => {
      const { isOffline, statusTextFa } = describePrinterStatus(
        0,
        Boolean(wmi.WorkOffline),
        Number(wmi.PrinterStatus || 0)
      );
      return {
        name: wmi.Name,
        displayName: wmi.Name,
        isDefault: Boolean(wmi.Default),
        isOffline,
        statusCode: Number(wmi.PrinterStatus || 0),
        statusTextFa,
        portName: wmi.PortName || '',
        driverName: wmi.DriverName || '',
      };
    });
  }

  return [];
}

module.exports = {
  listInstalledPrinters,
  getNativePrinterCapabilities,
};
