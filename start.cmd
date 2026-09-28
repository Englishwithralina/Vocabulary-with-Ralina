@echo off
setlocal
cd /d "%~dp0"
if exist "%~dp0.tools\node-v22.16.0-win-x64\node.exe" set "PATH=%~dp0.tools\node-v22.16.0-win-x64;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22.12 or newer from https://nodejs.org then try again.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  call npm.cmd install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm.cmd run dev -- --open
pause
