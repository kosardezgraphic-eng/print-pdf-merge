# قرار دادن موتور چاپ SumatraPDF برای بیلد ویندوز

نرم‌افزار **استودیو چاپ کوثر (Kosar Print Studio)** برای ارسال مستقیم فایل PDF برداری به درایور پرینتر ویندوز (با اعمال دقیق سایز کاغذ `paperkind`، سینی کاغذ `bin` مانند Bypass Tray، حالت دورو `duplex` و مقیاس دقیق ۱۰۰٪ `noscale`) از نسخه پرتابل خط فرمان **SumatraPDF** استفاده می‌کند.

## نحوه قرار دادن فایل قبل از اجرای `npm run electron:build`

1. نسخه ۶۴ بیتی پرتابل **SumatraPDF** را از وب‌سایت رسمی دانلود کنید:
   - وب‌سایت رسمی: https://www.sumatrapdfreader.org/download-free-pdf-viewer
   - مخزن کد منبع (GPLv3): https://github.com/sumatrapdfreader/sumatrapdf
2. فایل اجرایی را با نام دقیق **`SumatraPDF.exe`** در همین پوشه (`resources/bin/SumatraPDF.exe`) قرار دهید.
3. هنگام اجرای `npm run electron:build`، ابزار `electron-builder` به صورت خودکار کل محتویات `resources/bin/` (شامل `SumatraPDF.exe` و فایل اعلان لایسنس `LICENSE-SUMATRA-GPLv3-NOTICE.txt`) را در مسیر `resources/bin/` داخل نسخه نصبی (NSIS) و نسخه پرتابل بسته‌بندی می‌کند.

> **نکته:** اگر در محیط توسعه (`electron:dev`) فایل در این مسیر نباشد اما SumatraPDF روی ویندوز نصب شده باشد (`AppData\Local\SumatraPDF` یا `Program Files\SumatraPDF`)، برنامه به صورت خودکار آن را شناسایی می‌کند.
