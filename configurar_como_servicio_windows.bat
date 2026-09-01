@echo off
:: Script para configurar el Dashboard como Servicio/Tarea en segundo plano al iniciar Windows
echo ==============================================================================
echo Configurando Dashboard de Consumo Insumos CX en Inicio Automatico de Windows
echo ==============================================================================

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [AVISO] Por favor ejecuta este archivo como Administrador.
    pause
    exit /b 1
)

set TASK_NAME=DashboardConsumoInsumosCNC
set APP_DIR=%~dp0
set PYTHON_EXE=python.exe
set SCRIPT_PATH=%APP_DIR%server.py

:: Crear la tarea para iniciar al arrancar Windows sin ventana visible
schtasks /create /tn "%TASK_NAME%" /tr ""%PYTHON_EXE%" "%SCRIPT_PATH%"" /sc onstart /ru SYSTEM /rl HIGHEST /f

if %errorLevel% equ 0 (
    echo.
    echo ==============================================================================
    echo [EXITO] Tarea configurada correctamente en Windows!
    echo Nombre del servicio: %TASK_NAME%
    echo El dashboard iniciara automaticamente al encender el servidor o computador.
    echo ==============================================================================
    echo.
    echo Iniciando el servicio ahora mismo...
    schtasks /run /tn "%TASK_NAME%"
) else (
    echo.
    echo [ERROR] No se pudo registrar la tarea. Verifica permisos de Administrador.
)

pause
