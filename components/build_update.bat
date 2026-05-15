@echo off
title Building Masjid Display Pro Update
color 0B
cls

echo ========================================================
echo    Building New Updated Version (Masjid Display Pro)
echo ========================================================
echo.
echo [1/2] Installing latest dependencies...
call npm install
echo.
echo [2/2] Compiling and Building .exe file...
call npm run dist
echo.
echo ========================================================
echo    SUCCESS! The new version is in the 'dist' folder.
echo ========================================================
pause