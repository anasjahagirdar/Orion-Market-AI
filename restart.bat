@echo off
setlocal
cd /d "%~dp0"

pm2 restart all

endlocal
