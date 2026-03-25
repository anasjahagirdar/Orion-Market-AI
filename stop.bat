@echo off
setlocal
cd /d "%~dp0"

pm2 stop all
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :8000') DO taskkill /PID %%P /F 2>nul
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :3000') DO taskkill /PID %%P /F 2>nul

endlocal
