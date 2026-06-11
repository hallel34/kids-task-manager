@echo off
title Hallel Tasks Server
cd /d "C:\Users\halle\Downloads\ניהול-מטלות-בית"
echo Starting tasks app server...
start "Tasks App" cmd /c "npx tsx serve.ts"
timeout /t 2 >nul
echo Starting lock server...
start "Lock Server" cmd /c "npx tsx server/lock-server.ts"
echo.
echo === Servers started! ===
echo App:  http://localhost:3000
echo Lock: http://localhost:3001
echo.
echo You can close this window.
timeout /t 5 >nul
exit
