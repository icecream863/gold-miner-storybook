@echo off
setlocal
cd /d "%~dp0"
echo Gold Miner - local preview
echo Open http://127.0.0.1:4173/ in your browser.
echo Keep this window open while playing. Press Ctrl+C to stop.
echo.
if not exist "dist\index.html" (
  echo Building game...
  call npm run build
  if errorlevel 1 goto failed
)
call npm run preview -- --port 4173 --strictPort
if errorlevel 1 (
  echo.
  echo If port 4173 is already in use, the preview may already be running.
  echo Try opening http://127.0.0.1:4173/ first.
)
:failed
pause
