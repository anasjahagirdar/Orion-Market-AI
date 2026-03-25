@echo off
setlocal
cd /d "%~dp0"

pm2 start ecosystem.config.cjs
if errorlevel 1 goto :end

pm2 save
if errorlevel 1 goto :end

pm2 logs

:end
endlocal
