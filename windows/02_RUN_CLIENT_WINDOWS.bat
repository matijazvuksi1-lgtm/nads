@echo off
cd /d "%~dp0.."
where npx >nul 2>nul
if errorlevel 1 (
  echo Node.js/npm is missing. Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)
start "" "http://localhost:8080/client/"
npx http-server . -p 8080 -c-1
pause
