@echo off
:: Instalador de Servicio Windows con NSSM (Non-Sucking Service Manager)
echo ==============================================================================
echo  Instalador de Servicio Windows: Dashboard Consumo Insumos CX CNC
echo ==============================================================================

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [AVISO] Debes ejecutar este archivo como Administrador (clic derecho -> Ejecutar como administrador).
    pause
    exit /b 1
)

set SERVICE_NAME=DashboardConsumoCNC
set APP_DIR=%~dp0
set PYTHON_EXE=C:\Users\CNESTAD003\AppData\Local\Programs\Python\Python310\python.exe
set SERVER_PY=%APP_DIR%server.py

echo Configurando servicio %SERVICE_NAME%...

:: Si nssm.exe esta en la carpeta o en PATH
where nssm >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo [INFO] Si usas NSSM, descarga nssm.exe de https://nssm.cc/download
    echo y colocalo en esta carpeta o en System32.
    echo.
    echo O usa el script alternativo: crear_tarea_programada.bat
    echo.
    pause
    exit /b 1
)

nssm stop %SERVICE_NAME% >nul 2>&1
nssm remove %SERVICE_NAME% confirm >nul 2>&1

nssm install %SERVICE_NAME% "%PYTHON_EXE%" "%SERVER_PY%"
nssm set %SERVICE_NAME% AppDirectory "%APP_DIR%"
nssm set %SERVICE_NAME% DisplayName "Dashboard Consumo Insumos CX - Clinica Nueva de Cali"
nssm set %SERVICE_NAME% Description "Servicio en segundo plano para el sistema de estadisticas de consumo quirurgico CNC 2026."
nssm set %SERVICE_NAME% Start SERVICE_AUTO_START
nssm set %SERVICE_NAME% AppStdout "%APP_DIR%servicio_output.log"
nssm set %SERVICE_NAME% AppStderr "%APP_DIR%servicio_error.log"

nssm start %SERVICE_NAME%

echo.
echo [EXITO] Servicio Windows %SERVICE_NAME% instalado e iniciado correctamente!
pause
