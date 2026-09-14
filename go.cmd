taskkill /f /im node.exe 2>nul
timeout /t 2 /nobreak >nul
cd /d D:\X_aaoms\Pramod\kkpramod-siteX
node server.js
