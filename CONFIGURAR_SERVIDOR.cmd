@echo off
cd /d "%~dp0"
python scripts\configure_server.py
if errorlevel 1 goto failed
if not exist backend\.venv\Scripts\python.exe python -m venv backend\.venv
if errorlevel 1 goto failed
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if errorlevel 1 goto failed
echo Configuracion completada. Edita backend\.env y configura la extension.
pause
exit /b 0
:failed
echo No se pudo completar. Comprueba que Python 3.12 este instalado.
pause
exit /b 1
