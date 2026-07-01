@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
title Land of Mana Monad $LoN Patch - Windows

echo =====================================================
echo   LAND OF MANA MONAD $LoN PATCH - WINDOWS
echo =====================================================
echo.

if not exist "client\index.html" (
  echo ERROR: I cannot find client\index.html here.
  echo.
  echo Copy ALL files from this ZIP into the main landofmana folder first.
  echo Correct folder contains: client, gameserver, userserver, gameserver-win.bat, userserver-win.bat
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is missing.
  echo Install Node.js LTS from https://nodejs.org/
  echo After install, close this window and double click START HERE WINDOWS.bat again.
  echo.
  pause
  exit /b 1
)

if not exist "tools\apply-landofmana-monad-currency-patch.cjs" (
  echo ERROR: tools\apply-landofmana-monad-currency-patch.cjs not found.
  echo Copy the whole ZIP into the landofmana folder, not only this BAT file.
  echo.
  pause
  exit /b 1
)

echo Applying Monad $LoN patch now...
echo.
node "tools\apply-landofmana-monad-currency-patch.cjs"
if errorlevel 1 (
  echo.
  echo Patch failed. Read the error above.
  pause
  exit /b 1
)

echo.
echo =====================================================
echo PATCH DONE.
echo.
echo After nad.fun launch, edit:
echo   client\custom\lom-web3-config.js
echo.
echo Paste your token CA here:
echo   tokenAddress: '0x...',
echo   contractAddress: '0x...',
echo.
echo =====================================================
echo.

choice /c YN /n /m "Start client now on http://localhost:8080/client/ ? [Y/N] "
if errorlevel 2 goto end

echo.
echo Starting client...
echo.
where npx >nul 2>nul
if errorlevel 1 (
  echo ERROR: npx/npm missing. Reinstall Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)
start "" "http://localhost:8080/client/"
npx http-server . -p 8080 -c-1

:end
echo.
echo Finished.
pause
