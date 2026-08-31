@echo off
title Consumo Insumos CX - Servidor Completo
echo ========================================================
echo   Iniciando Dashboard de Consumo Insumos CX
echo   Base de Datos: PostgreSQL (icosalud_quinta)
echo   Puerto: http://localhost:5000
echo ========================================================
echo.
timeout /t 2 /nobreak >nul
start http://localhost:5000
python server.py
pause
