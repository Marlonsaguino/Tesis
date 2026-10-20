@echo off
cd /d "%~dp0backend"
if not exist .venv\Scripts\python.exe goto missing
if not exist .env goto missing
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
pause
exit /b
:missing
echo Ejecuta primero CONFIGURAR_SERVIDOR.cmd y completa backend\.env.
pause
