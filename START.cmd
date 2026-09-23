@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer from https://nodejs.org and try again.
  pause
  exit /b 1
)
if not exist "out\index.html" (
  if not exist "node_modules\next" (
    call npm.cmd ci
    if errorlevel 1 exit /b 1
  )
  call npm.cmd run build
  if errorlevel 1 exit /b 1
)
node scripts\serve.mjs --open
if errorlevel 1 pause
