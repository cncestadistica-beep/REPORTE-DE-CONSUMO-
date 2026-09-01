@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [AVISO] Ejecuta este archivo como Administrador.
    pause
    exit /b 1
)

echo Eliminando servicio / tarea programada...
schtasks /delete /tn "DashboardConsumoInsumosCNC" /f >nul 2>&1
where nssm >nul 2>&1 && nssm remove DashboardConsumoCNC confirm >nul 2>&1

echo [OK] Servicio detenido y eliminado de Windows.
pause
