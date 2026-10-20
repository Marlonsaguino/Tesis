@echo off
cd /d "%~dp0"
call npm --prefix apps\gmail ci
if errorlevel 1 goto failed
call npm --prefix apps\outlook ci
if errorlevel 1 goto failed
node scripts\build.mjs
if errorlevel 1 goto failed
echo Compilacion completada. Recarga la extension.
pause
exit /b 0
:failed
echo No se pudo compilar. Comprueba Node.js 24 y la conexion a internet.
pause
exit /b 1
