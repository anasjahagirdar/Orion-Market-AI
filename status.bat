@echo off
setlocal
cd /d "%~dp0"

pm2 status
if errorlevel 1 goto :end

pm2 logs --lines 50

:end
endlocal
