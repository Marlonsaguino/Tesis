@echo off
cd /d "%~dp0"
if not exist backend\.venv\Scripts\python.exe goto missing
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if errorlevel 1 goto failed
backend\.venv\Scripts\python.exe scripts\configure_database.py
if errorlevel 1 goto failed
pause
exit /b 0
:missing
echo Ejecuta primero CONFIGURAR_SERVIDOR.cmd.
pause
exit /b 1
:failed
echo No se completo la configuracion. Revisa el mensaje anterior.
pause
exit /b 1
