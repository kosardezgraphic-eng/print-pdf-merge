@echo off
chcp 65001 > nul
echo ========================================================
echo   در حال ساخت نسخه دسکتاپ ویندوز استودیو چاپ کوثر 2.0
echo   Kosar Print Studio — NSIS Installer ^& Portable EXE
echo ========================================================
echo.

if not exist "resources\bin\SumatraPDF.exe" (
  echo [هشدار] فایل resources\bin\SumatraPDF.exe یافت نشد!
  echo برای فعال بودن چاپ مستقیم سینی و کاغذ، قبل از بیلد نهایی فایل SumatraPDF.exe را در پوشه resources\bin قرار دهید.
  echo.
)

echo [1/3] نصب وابستگی‌ها...
call npm install

echo.
echo [2/3] اجرای تست‌های کنترل کیفیت...
call npm test

echo.
echo [3/3] ساخت فایل نصبی NSIS و پرتابل در پوشه release...
call npm run electron:build

echo.
echo ========================================================
echo   عملیات به پایان رسید. خروجی‌ها در پوشه release قرار دارند.
echo ========================================================
pause
