# گزارش گام صفر — پروژه print-pdf-merge
*آماده‌سازی برای تایید کاربر قبل از شروع کدنویسی. 언: فارسی (RTL).*

## ۱. ان evangelції قابلیت‌ها (انبانتوری)
هر قابلیت فعلی، مکان فعلی در کد، و جایگاه پیشنهادی در طرح جدید. **هیچ کدام حذف نمی‌شوند**؛ فقط جایگذاری، UI و پی arrière تغییر می‌کنند.

| # | قابلیت | مکان فعلی (فایل / approximat خطوط) | جایگاه در طرح جدید |NOTE |
|---|--------|-------------------------------------|---------------------|-----|
| 1 | ورود فایل Drag&Drop PDF و عکس (JPG,PNG,WebP,TIFF,BMP,SVG) | `DropZone.tsx`، `App.tsx::handleFilesSelected` | ناحیه «کشیده و رها» بالای پنل صفحات؛ تبدیل عکس→PDF در پس‌زمینه عند ورود | حفظ می‌شود |
| 2 | فهرست فایل‌ها (جدول / کارت / شیت زنده) | `FileList.tsx`, `SidebarPages.tsx`, `viewMode: table|cards|sheet` | **پنل بندانگشتی صفحات** (واپرteros-one): هر صفحه آیتم مستقل (شماره، نام مبدا، تیک چاپ، چرخش ۹۰°, حذف، کپی، ابعاد mm) | ولتوالایز + کش + ورکر |
| 3 | جستجو، مرتب‌سازی، انتخاب همه/هیچ، انتخاب چندتایی | `App.tsx` | همان — در بالای پنل Pages | حفظ |
| 4 | ادغام (Merge) PDFها | `MergeModal.tsx` (~۱۸۸۲خط) | **حالت «ادغام» (Merge) ورک‌اسپیس** — панل تنظیمات Right، دکمه خروجی Save As | مودال سنگین → پنل/حالت |
| 5 | N-Up / شیت‌بندی ماتریسی (۱×۱، Many-Up، تکرار N بار) | `GridImpositionModal.tsx` (~۲۲۲۱خط) + `gridImpositionUtils.ts` | **حالت «چیدمان» (Layout)** ورک‌اسپیس؛ منطق در ماژول خالص بازنویسی‌شده + vitest | منطق تست‌پذیر |
| 6 | تبدیل عکس به PDF | `ImageToPdfModal.tsx` (~۴۰۷خط) | تبدیل خودکار beim Drag&Drop؛ مودال حذف می‌شود (صرفاً نوتیفیکیشن) | مودال redundant |
| 7 | Page Studio: نور، کنتراست، Grayscale/Invert/Threshold، کراپ | `PageStudioModal.tsx` (~۲۶۸۸خط) + `pdfRenderUtils.ts` | **حالت «ویرایش صفحه» (Edit)** — панل تنظیمات راست؛ افکت‌ها روی ک্যানvas پیش‌نمایش | حفظ |
| 8 | متن، شکل، شماره‌گذاری روی صفحه (overlay) | `types.ts` (overlays)، `overlayRenderUtils.ts` (راستری روی کanvas) | در حالت Edit؛ در خروجی نهایی **وکتور/متن واقعی pdf-lib** (فونت Vazirmatn) | کیفیت بالاتر |
| 9 | تکثیر صفحه، درج سفید، جابجایی، حذف صفحه | `pdfPageModifier.ts` + `SidebarPages` |-panel Pages (각 페이지 ряд با دکمه‌ها) | حفظ |
| 10 | Crop (حاشیه‌ها) | `InteractiveCropBox.tsx` | حالت Edit — 판ل راست | حفظ |
| 11 | ابزار اندازه‌گیری، خط‌کش، guideها | `MeasureToolLayer.tsx`, `Ruler.tsx`, `GuidelinesLayer.tsx` | نوار ابزار پیش‌نماシェت | حفظ |
| 12 | Preflight (بررسی قبل از چاپ) | `PreflightModal.tsx` | اعلان/پانل «چاپ» قبل از ارسال به پرینتر | حفظ |
| 13 | چاپ دسته‌ای (Batch Print) | `PrintModal.tsx` (~۹۲۴خط) + `printUtils.ts` (راستری HTML → webContents.print) | **بازنویسی کامل**: pdf-lib → PDF وکتوری → فایل temp → موتور چاپnative (SumatraPDF CLI پیشنهادی) با کاغذ/سینی/Duplex/100% | obstacle اصلی |
| 14 | فرم‌ها و ابزارهای PDF | جزئی در Overlay‌ها | حفظ در حالت Edit |吃饱 |
| 15 | حالت‌های نمایش (sheet/cards/table + studio/studioSheet) | `App.tsx` — ۲ مدل موحد نشده | **یک مدل View واحد**: `browse` (فهرست) | `layout` (چیدمان) | `edit` (ویرایش) | `print` (چاپ) | یکپارچه‌سازی viewMode/studioWorkspaceMode |
| 16 | دوزبانه (fa/en) + تم تیره/روشن | `translations.ts` + localStorage theme | حفظ — برچسب‌های فارسی ساده، Tooltip، راهنمای کوتاه | حفظ |
| 17 | Undo/Redo | `App.tsx` (.stackها) | Zustand store یا useReducer — राज्युनिया | حفظ |
| 18 | ذخیره خودکار پروژه و بازیابی | lokalStorage (partial) | ذخیره خودکار_STATE در store + بازیابی beim راه‌اندازی | تقویت |
| 19 | میانبرهای کلید (Ctrl+P/Z/Y/A/Delete) | `App.tsx` | حفظ — فقط وقتی مودال/پانل فعال نیست | حفظ |

### وابستگی‌های npm مورد حذف (در کد import نشده‌اند)
`@google/genai`, `express`, `dotenv`, `motion`, `tsx` (devDependency) و `.env.example` (متعلق به Gemini) — مطابق دستور کاربر حذف می‌شوند. بقیه وابستگی‌ها حفظ می‌شوند.

---

## ۲. تکرارها و باگ‌های مهم (تایید شده با خواندن کد)

### تکرار / شلوغی (بدون حذف قابلیت)
1. **سه نام محصول متفاوت**: `package.json` → `react-example` / `PDF Print Studio`; `index.html` و `<title>` → `Remix PDF Counter & Merger Pro`; `metadata.json` → `Remix PDF Counter & Merger Pro`; `translations.fa.appTitle` → `شمارنده، چاپگر و ادغام‌ساز PDF ویندوز`. → یک نام یکسان (پیشنهاد: **PDF Print Studio**) در همه جا.
2. **دو مدل نمایش موحد نشده**: `viewMode` (`sheet|cards|table`) و `studioWorkspaceMode` (`studio|sheet`) با مرز نامشخص؛ هر دو状態 را نگه می‌دارند. → یک مدل `view` واحد.
3. **شش مودال سنگین با کار هم‌پوشانی**: `MergeModal`, `GridImpositionModal`, `PageStudioModal`, `PrintModal`, `PreflightModal`, `ImageToPdfModal` — کار اصلی را می‌پوشانند و ناوبری را شکست می‌دهند. → مودال فقط برای کارهای جانبی (مثلاً About/Help/Confirm); کارهای اصلی در ورک‌اسپیس/پنل.
4. **App.tsx ~۱۸۲۶ خط و ~۲۰ useState**; `RibbonBar.tsx` ۱۸۱۹، `PageStudioModal.tsx` ۲۶۸۸، `GridImpositionModal.tsx` ۲۲۲۱، `MergeModal.tsx` ۱۸۸۲، `UnifiedStudioWorkspace.tsx` ۲۳۱۴ — «components’ave حل نشده. → تقسیم به feature-folders و کامپوننت‌های کوچک.
5. **ریbben ۷ تب** (`file|layout|effects|insert|crop|tools|view`) بدون گروه‌بندی rõ. → ۳–۴ تب منطقی (صفحه‌آرایی، ویرایش، چاپ، ابزارها/نما) با بخش «پیشرفته».
6. dataUrlهای حجیم در state نگه‌داشته می‌شوند (`previewUrl`، رندر sheet به JPEG) → فشار بر حافظه. → Blob/ObjectURL + آزادسازی.

### باگ‌های مهم (تأثیر مستقیم کاربر)
1. **چاپ ضعیف (مهم‌ترین باگ)**: هر صفحه با kánvas به JPEG (۰٫۸۵–۰٫۹) رستر می‌شود، داخل HTML می‌رود و با `webContents.print` چاپ می‌شود → افت کیفیت، ابعاد غیردقیق، falta کنترل سینی. `PaperTray` در `types.ts` وجود دارد اما **چاپی اثری ندارد**.
2. **تنظیمات پرینتر назناشناس**: فقط نام پرینترها خوانده می‌شود (`getPrintersAsync` + PowerShell fallback). قابلیت‌های واقعی (کاغذ، سینی، duplex، رنگی) از `DeviceCapabilitiesW` نمی‌خوانند. idهای خوانده‌شده به موتور چاپ پاس داده نمی‌شوند.
3. **نامیابی نام محصول**: کاربر نمی‌تواند برنامه را از نام của آن شناسایی کند (react-example / PDF Print Studio / Remix…).

---

## ۳. طرح معماری (پیشنهادی — منتظر تایید)

### A. فضای کار واحد سه‌پنلی (یک صفحه، بدون مودال اصلی)
- **پنل چپ (بندانگشتی صفحات)**: لیست فایل‌ها → هر فایل قابل کشیدن است؛ هر صفحه یک سطر (آیتم مستقل): شماره، نام فایل مبدا، تیک چاپ، چرخش ۹۰°, کپی/تعداد نسخه، ابعاد mm، دکمه حذف. مرتب‌سازی با Drag، انتخاب چندتایی، «انتخاب همه/هیچ». رندر lazy + virtualized + کش (PDF ۵۰۰+ صفحه).
- **پنل میانی (پیش‌نما زنده چندشیتی)**: کanvas-shaped Sheet Preview با نمایش «شیت X از Y»، خط‌کش، guideها، ابزار اندازه‌گیری.
- **پنل راست (تنظیمات)**: تنظیمات پرکاربرد همیشه قابل دید؛ تنظیمات نادر در separé «پیشرفته».

### B. حالت‌ها (به جای viewMode + studioWorkspaceMode)
`view: 'browse' | 'layout' | 'edit' | 'print'`
- `browse`: ورود فایل، فهرست.
- `layout`: موتور چیدمان ماتریسی (N-Up) — پارامترها عددی + اسلایدر + پیش‌نما لحظه‌ای.
- `edit`: Page Studio (متن/شکل/شماره/افکت/کراپ) — وکتور برای خروجی.
- `print`: لیست پرینترها، کاغذ/سینی/duplex/رنگی/نسخه/محدوده، دکمه چاپ و ذخیره PDF.

مودال فقط برای کارهای جانبی (Help, About, Confirm dialogs).

### C.Ribbon (نوار به‌روزرسانی شده)
۳–۴ تب: **صفحه‌آرایی** | **ویرایش** (متن/شکل/شماره/افکت/크اپ) | **چاپ** | **ابزارها و نما**. دکمه‌های «چاپ» و «ذخیره PDF» همیشه دیدны.

### D. لایه государства (State)
Zend State store (یا `useReducer` هم‌ powierzch): `files[]`, `pages[]`, `printSettings`, `ui` (view, theme, lang, selections). undo/redo روی snapshots.

### E. موتور چیدمان (Grid Imposition) — ماژول خالص
`src/features/imposition/gridImposition.ts` (بازنویسی `gridImpositionUtils.ts`):
- ورودی: صفحات، rows, cols, order, gaps (horizontal/vertical جداگانه), margins 4 طرفه (قفل مساوی), اندازه شیت (A3/A4/A5/SRA3/Letter/سفارشی + جهت), cell size auto/manual, fit/fill/stretch/actual, alignment, auto-rotate, units (mm/cm/inch), crop marks, cell move/swap/empty, presets, out-of-printable warning, «شیت X از Y».
- واحد داخلی: **pt** (۱ mm = ۲.۸۳۴۶ pt).
- تست‌ها با **vitest**: ۲×۳ روی A4 با gap و margin مشخص؛ Buchlet Saddle-stitch؛ RTL/LTR流向.

### F. تولید خروجی PDF (pdf-lib)
- `src/features/pdf/buildPdf.ts`: صفحات با `embedPage` (وکتور)، عکس با بایت‌های اصلی، رستر فقط وقتی افکت/overlay مجبور کند (۳۰۰ DPI).
- Overlayها (متن/شکل/شماره) به‌صورت وکتور/متن واقعی با embed فونت **Vazirmatn**.
- فایل خروجی در `temp` نوشته شده و برای چاپ/ذخیره استفاده می‌شود.

### G. لایه چاپ (Print Pipeline) — بازنویسی کامل
1. pdf-lib → PDF نهایی (صفحات با اندازه دقیق کاغذ انتخابی).
2. فایل temp در `%TEMP%`؛ پاک‌سازی بعد از چاپ.
3. موتور چاپ native: پیشنهاد **SumatraPDF** همراه برنامه (`extraResources`) با CLI:
   `-print-to "<printer>" -print-settings "paperkind=..,bin=..,noscale,duplex=..,color|monochrome"` (لایسنس GPL → بررسی نهایی قبل از bundling؛ اگر مشکل است، fallback به `webContents.print` با orientations/媒체 preserves).
4. Compressive: Compress 100% scaling، progress، خطاهای فارسی قابل فهم، عدم کرش با پرینتر آفلاین (try/catch + پیام).

### H. پرینتر و قابلیت‌های ویندوز
- `getPrintersAsync` + fallback PowerShell (فعلی)، پیش‌فرض، وضعیت، تازه‌سازی، ذخیره آخرین انتخاب.
- **DeviceCapabilitiesW** (`DC_PAPERS`, `DC_PAPERNAMES`, `DC_PAPERSIZE`, `DC_BINS`, `DC_BINNAMES`, `DC_DUPLEX`) via helper کوچک (koffi یا self-contained .NET exe) از طریق IPC امن (contextIsolation + validation).
- idهای خوانده‌شده همان idهایی که به موتور چاپ داده می‌شود → سینی/کاغذ واقعی اعمال می‌شود. `PaperTray` از enum Strait جایگزین لیست واقعی می‌شود.
- UI: dropdown کاغذ واقعی، tray، duplex، رنگی/سیاه‌وسفید، نسخه، محدوده صفحات، collate.
- دکمه «تنظیمات پیشرفته درایور»: `rundll32 printui.dll,PrintUIEntry /e /n"<name>"`.
- هشدار ناسازگاری اندازه شیت با کاغذ پرینتر؛ «چاپ تست یک شیت».

### I. امنیت و 효ک (≥ Elektron 34)
- `nodeIntegration: false`, `contextIsolation: true`, sandbox تا ممکن است.
- IPC handlerها ورودی را validate می‌کنند (نام پرینتر، اعداد، مسیرها whitelist).
- посвяttle: preload فقط `getPrinters` و `printToDevice` را exposing می‌کند.

### J. سotre فایل‌ها (Feature folders)
```
src/
  features/
    files/          # ورود، فهرست، virtualization
    imposition/     # gridImposition.ts + vitest
    pageEdit/       # overlay text/shape/numbering/crop/effects
    pdf/            # buildPdf.ts (pdf-lib), pdfUtils
    print/          # print pipeline, printer capabilities, IPC
    settings/       # profiles, presets, theme/lang
  components/ui/    # klein 캘ب omponents
  components/workspace/ # 3-panel workspace
  lib/store.ts      # Zustand store
  tests/            # pureLogic.test.ts (نشکسته) + grid/print tests
```

### K. استراتژی رگرسیون (هر مرحله)
بعد از هر مرحله، چکلیست: Merge، N-Up، عکس→PDF، Page Studio، تکثیر، متن/شکل، شماره‌گذاری، افکت (brightness/contrast/grayscale/invert/threshold)، Crop، اندازه‌گیری/خط‌کش/guide، Preflight، چاپ دسته‌ای، فرم‌ها، حالت نمایش، دوزبانه/تم، Undo/Redo — همه باید همچنان کار کنند.

---

## مراحل اجرا (بعد از تایید شما)
**(الف) بازسازی ساختار و state** → feature folders + Zustand store، بدون تغییر رفتار.
**(ب) بازچینی UI** → ورک‌اسپیس ۳‌پنلی، ریبن ۳–۴ تب، انتقال مودال‌ها به حالت/پنل.
**(ج) ورود فایل و بندانگشتی** → Drag&Drop بهینه، lazy/virtualized rendering.
**(د) موتور چیدمان** → gridImposition.ts بازنویشی + vitest.
**(ه) تولید PDF** → pdf-lib وکتور/رستر شرطی.
**(و) پرینتر و چاپ** → DeviceCapabilities، SumatraPDF/CLI، temp cleanup، خطاهای فارسی.
در نهایت: README + راهنمای build (NSIS و portable) + تست دستی (۳ فایل، ۲×۳ روی A4، gap=۵mm، margin=۱۰mm، چاپ روی Bypass Tray).

---

**اقدام بعدی:** لطفاً گزارش را بررسی و تایید (یا اصلاح) کنید تا مرحلة (الف) شروع شود.