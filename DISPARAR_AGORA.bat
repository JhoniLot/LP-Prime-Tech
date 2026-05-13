@echo off
title Prime Tech - Disparador de Elite
echo.
echo  =========================================
echo    PRIME TECH - COMANDO DE DISPARO
echo  =========================================
echo.
echo  Buscando ordens de envio...
echo.

powershell -ExecutionPolicy Bypass -File "c:\Users\Vinicius\Desktop\vinicius\Prime Tech\LP-Prime-Tech\saas_demo\Prime Prospect\senders\enviar_emails.ps1"

echo.
echo  =========================================
echo    PROCESSO FINALIZADO
echo  =========================================
echo.
pause
