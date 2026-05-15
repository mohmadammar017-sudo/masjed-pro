# Masjid Display Pro - Windows Application

هذا المشروع مهيأ للعمل كتطبيق سطح مكتب (Windows) باستخدام Electron.

## متطلبات التشغيل
1. تثبيت [Node.js](https://nodejs.org/) (إصدار 18 أو أحدث).
2. تثبيت [Visual Studio Code](https://code.visualstudio.com/).

## خطوات التشغيل من Visual Studio Code
1. افتح المجلد الخاص بالمشروع في VS Code.
2. افتح التيرمينال (Terminal) داخل VS Code (Ctrl + `).
3. قم بتثبيت المكتبات اللازمة بتنفيذ الأمر التالي:
   ```bash
   npm install
   ```
4. لتشغيل التطبيق في وضع التطوير (Development):
   ```bash
   npm run electron:dev
   ```

## خطوات بناء تطبيق Windows (.exe)
لإنشاء ملف تثبيت للتطبيق يعمل على أي جهاز ويندوز:
1. في التيرمينال، نفذ الأمر التالي:
   ```bash
   npm run dist
   ```
2. بعد انتهاء العملية، ستجد ملف الـ `.exe` داخل مجلد جديد يسمى `dist`.

## ملاحظات
- تم ضبط الزوم التلقائي ليتناسب مع حجم الشاشات المختلفة (4K, Full HD).
- يمكنك التحكم في الزوم يدوياً باستخدام `Ctrl +` و `Ctrl -`.
