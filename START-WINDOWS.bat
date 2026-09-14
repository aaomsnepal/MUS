@echo off
cd /d "%~dp0"
echo.
echo  kkpramod.com.np — installing and starting...
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install from https://nodejs.org then run this again.
  pause
  exit /b 1
)
call npm install
echo.
echo  Site:  http://localhost:3002
echo  Admin: http://localhost:3002/admin   PIN 6143
echo.
call npm start
pause
