@echo off
:: Forzar codificación UTF-8
chcp 65001 >nul
cd /d "%~dp0"

:: Limpieza total de procesos
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.exe >nul 2>&1
taskkill /f /im npx.exe >nul 2>&1
taskkill /f /im ngrok.exe >nul 2>&1
powershell -Command "Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }" >nul 2>&1
timeout /t 2 >nul

title Bearlytics Core - Secure Terminal
mode con: cols=150 lines=50

:: Logo Bearlytics Pixel-Elite v3.8 (Ajuste Tipográfico)
echo.
powershell -NoProfile -Command "${b}=[char]27+'[38;5;33m'; ${r}=[char]27+'[31m'; ${w}=[char]27+'[37m'; ${rst}=[char]27+'[0m'; Write-Host (\"    ${b}!!!!!                     !!!!${rst}`n  ${b}!!!!!!!!!      !!!!!      !!!!!!!!!${rst}`n ${b}!!!${r}?????${b}!!!!!!!!!!!!!!!!!!!!!${r}????${b}!!!${rst}`n ${b}!!!${r}???${b}!!!!!!!!!!!!!!!!!!!!!!!!${r}???${b}!!!     ${r}??????? ${b}!!!!!!!!!!  !!!!!!!!!  !!!!!!!!!${rst}`n  ${b}!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!   ${r}???    ?? ${b}!!!    !!!  !!         !!${rst}`n    ${b}!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!    ${r}???     ??     ${b}!!!!!   !!!!!!!!!  !!!!!!!!!${rst}`n   ${b}!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!   ${r}??????????     ${b}!!!!!!  !!!!!!!!!         !!!${rst}`n  ${b}!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!  ${r}???     ?? ${b}!!!     !!  !!     !!  !!     !!!${rst}`n ${b}!!!!!!!!${w}35554${b}!!${r}??????${b}?!?${w}45552${b}!!!!!!!  ${r}???     ??  ${b}!!!!!!!!!  !!!!!!!!!  !!!!!!!!!${rst}`n ${b}!!!!!!!!!${r}?${w}3${b}!!${r}???${w}45552${r}???${b}!${w}13${b}!!!!!!!!!!${rst}`n${b}!!!!!!!!!!!!!${r}?????${w}351${r}????${b}!!!!!!!!!!!!! ${w}777777777 77777777  7777777 77777777 77     7     7777777777 77 77777777 77777777${rst}`n${b}!!!!!!!!!!!!!${r}????${w}15540${r}????${b}!!!!!!!!!!!! ${w}777    77 77       77    77 77    77 77     7     77   77    77 77     7 77     7${rst}`n ${b}!!!!!!!!!!!!${r}???${w}41${r}???${w}32${r}???${b}!!!!!!!!!!!! ${w}77777777  7777777 777777777 77777777 77      77777     77    77 77       77777777${rst}`n ${b}!!!!!!!!!!!!${r}????????????${b}!!!!!!!!!!!!! ${w}777    77 77      777777777 7777777  77        7       77    77 77     7  7     7${rst}`n  ${b}!!!!!!!!!!!!!${r}????????${b}!!!!!!!!!!!!!!  ${w}777777777 7777777777     77 77    77 77777777  7       77    77  7777777  7777777${rst}`n   ${b}!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!${rst}`n      ${b}!!!!!!!!!!!!!!!!!!!!!!!!!!!${rst}`n            ${b}!!!!!!!!!!!!!!${rst}\")"

echo.
echo  [SYSTEM] BEARLYTICS CORE PIXEL-ELITE v3.8 OPERATIVO...
echo.

:: 0. Internet Tunnel (Ngrok opcional)
if defined FUVEX_NGROK_DOMAIN (
    if exist ".\ngrok.exe" (
        echo  [*] Abriendo puente a internet (Remote Demo)...
        start "Ngrok Tunnel" /min cmd /c ".\ngrok.exe http 3001 --domain=%FUVEX_NGROK_DOMAIN%"
        echo  [OK] Puente establecido: https://%FUVEX_NGROK_DOMAIN%
    ) else (
        echo  [WARN] FUVEX_NGROK_DOMAIN definido, pero ngrok.exe no existe en este directorio.
    )
) else (
    echo  [INFO] Tunel ngrok desactivado. Defina FUVEX_NGROK_DOMAIN para demo remota.
)
echo.

:: 1. Database
echo  [*] Sincronizando Nucleo de Datos...
cd "apps\backend"
if not exist "..\..\data" mkdir "..\..\data"
call npx prisma generate > nul
call npx prisma migrate deploy > nul
echo  [OK] Datos listos.

:: 2. Backend
echo  [*] Activando Servidor de Inteligencia...
start /b cmd /c "npm run dev"
echo  [OK] Backend operativo.

:: 3. Web Dashboard
echo  [*] Lanzando Consola de Mando...
timeout /t 3 > nul
start http://localhost:3001

:: 4. Mobile
echo.
echo  ===============================================
echo    BEARLYTICS OPERATIVO - LANZANDO NODO MOVIL
echo  ===============================================
echo.
cd "..\mobile"
call npx expo start --tunnel -c

pause
