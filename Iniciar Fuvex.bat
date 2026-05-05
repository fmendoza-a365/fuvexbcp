@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
cd /d "%ROOT%"

title Fuvex Manager A365 - Inicio Unificado
mode con: cols=130 lines=42

echo.
echo ===============================================================
echo   FUVEX MANAGER A365 - SISTEMA LOCAL + APP MOVIL
echo ===============================================================
echo.

if /i "%FUVEX_USE_NGROK%"=="1" set "FUVEX_START_MODE=2"
if defined FUVEX_NGROK_DOMAIN set "FUVEX_START_MODE=2"

if not defined FUVEX_START_MODE (
  echo Selecciona modo de trabajo:
  echo   1. Local WiFi  - PC y celular en la misma red
  echo   2. Remoto      - ngrok para datos moviles u otra red WiFi
  echo.
  set /p "FUVEX_START_MODE=Modo [1/2, Enter=1]: "
)

if "%FUVEX_START_MODE%"=="" set "FUVEX_START_MODE=1"
if /i "%FUVEX_START_MODE%"=="LOCAL" set "FUVEX_START_MODE=1"
if /i "%FUVEX_START_MODE%"=="NGROK" set "FUVEX_START_MODE=2"
if /i "%FUVEX_START_MODE%"=="REMOTO" set "FUVEX_START_MODE=2"

if "%FUVEX_START_MODE%"=="2" (
  set "FUVEX_USE_NGROK=1"
  set "FUVEX_MODE_LABEL=REMOTO CON NGROK"
) else (
  set "FUVEX_USE_NGROK="
  set "FUVEX_MODE_LABEL=LOCAL WIFI"
)

echo [OK] Modo seleccionado: %FUVEX_MODE_LABEL%
echo.

echo [1/7] Cerrando servidores locales activos...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "$ports=@(3001,5173,8081,8082,8083,19000,19001,19002,19006,4040);" ^
  "$processIds=@();" ^
  "foreach($port in $ports){$processIds += Get-NetTCPConnection -LocalPort $port | Select-Object -ExpandProperty OwningProcess};" ^
  "$processIds=$processIds | Where-Object { $_ -and $_ -ne $PID } | Sort-Object -Unique;" ^
  "foreach($id in $processIds){Stop-Process -Id $id -Force};" ^
  "Get-Process ngrok | Stop-Process -Force"

timeout /t 2 >nul
echo [OK] Puertos liberados: 3001, 5173, 8081-8083, 19000-19006, 4040.
echo.

echo [2/7] Validando instalacion local...
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro npm.cmd. Instala Node.js 20+ y vuelve a ejecutar.
  goto :error
)

if not exist "%ROOT%node_modules" (
  echo [ERROR] No existe node_modules en la raiz.
  echo Ejecuta primero: npm install --legacy-peer-deps
  goto :error
)

if not exist "%ROOT%apps\backend\.env" (
  echo [ERROR] Falta apps\backend\.env.
  echo Copia apps\backend\.env.example a apps\backend\.env y completa las credenciales.
  goto :error
)
echo [OK] Dependencias y entorno local encontrados.
echo.

echo [3/7] Preparando base de datos, cliente Prisma y catalogos operativos...
cd /d "%ROOT%apps\backend"
if not exist "%ROOT%data" mkdir "%ROOT%data"
if not exist "%ROOT%logs" mkdir "%ROOT%logs"
call npx.cmd prisma generate
if errorlevel 1 goto :error
call npx.cmd prisma migrate deploy
if errorlevel 1 goto :error
call npx.cmd prisma db seed
if errorlevel 1 goto :error
echo [OK] Base de datos lista con convenios, cargos y RCI.
echo.

echo [4/7] Verificando compilacion de Backend, Web y App Movil...
cd /d "%ROOT%"
call npm.cmd exec --workspace backend -- tsc --noEmit -p tsconfig.json
if errorlevel 1 goto :error
call npm.cmd run build --workspace web
if errorlevel 1 goto :error
call npm.cmd exec --workspace mobile -- tsc --noEmit -p tsconfig.json
if errorlevel 1 goto :error
echo [OK] Compilacion validada y Web publica actualizada.
echo.

set "FUVEX_ROOT=%ROOT%"

echo [5/7] Iniciando Backend API en segundo plano: http://localhost:3001 ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root=$env:FUVEX_ROOT;" ^
  "$logs=Join-Path $root 'logs';" ^
  "New-Item -ItemType Directory -Force -Path $logs | Out-Null;" ^
  "$p=Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm.cmd run dev' -WorkingDirectory (Join-Path $root 'apps\backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'backend.log') -RedirectStandardError (Join-Path $logs 'backend-error.log') -PassThru;" ^
  "$p.Id | Set-Content -Path (Join-Path $logs 'backend.pid')"
if errorlevel 1 goto :error
echo [OK] Backend en proceso oculto. Logs: logs\backend.log
echo.

echo [6/7] Iniciando Web Dashboard en segundo plano: http://localhost:5173 ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root=$env:FUVEX_ROOT;" ^
  "$logs=Join-Path $root 'logs';" ^
  "New-Item -ItemType Directory -Force -Path $logs | Out-Null;" ^
  "$p=Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm.cmd run dev -- --host 0.0.0.0' -WorkingDirectory (Join-Path $root 'apps\web') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'web.log') -RedirectStandardError (Join-Path $logs 'web-error.log') -PassThru;" ^
  "$p.Id | Set-Content -Path (Join-Path $logs 'web.pid')"
if errorlevel 1 goto :error
echo [OK] Web en proceso oculto. Logs: logs\web.log
echo.

set "NGROK_PUBLIC_URL="
if defined FUVEX_NGROK_DOMAIN (
  if exist "%ROOT%ngrok.exe" (
    echo [INFO] Iniciando tunel ngrok para backend en segundo plano...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$root=$env:FUVEX_ROOT;" ^
      "$logs=Join-Path $root 'logs';" ^
      "$domain=($env:FUVEX_NGROK_DOMAIN -replace '^https?://','' -replace '/.*$','');" ^
      "$p=Start-Process -FilePath (Join-Path $root 'ngrok.exe') -ArgumentList 'http','3001',('--domain=' + $domain) -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'ngrok.log') -RedirectStandardError (Join-Path $logs 'ngrok-error.log') -PassThru;" ^
      "$p.Id | Set-Content -Path (Join-Path $logs 'ngrok.pid')"
    call :ResolveNgrokUrl
    if defined NGROK_PUBLIC_URL (
      echo [OK] Tunel ngrok activo: !NGROK_PUBLIC_URL!. Logs: logs\ngrok.log
    ) else (
      echo [WARN] Ngrok fue iniciado, pero no se pudo confirmar la URL publica en http://127.0.0.1:4040.
    )
  ) else (
    echo [WARN] FUVEX_NGROK_DOMAIN esta definido, pero no existe ngrok.exe en la raiz.
  )
) else if /i "%FUVEX_USE_NGROK%"=="1" (
  if exist "%ROOT%ngrok.exe" (
    echo [INFO] Iniciando tunel ngrok temporal para backend en segundo plano...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$root=$env:FUVEX_ROOT;" ^
      "$logs=Join-Path $root 'logs';" ^
      "$p=Start-Process -FilePath (Join-Path $root 'ngrok.exe') -ArgumentList 'http','3001' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'ngrok.log') -RedirectStandardError (Join-Path $logs 'ngrok-error.log') -PassThru;" ^
      "$p.Id | Set-Content -Path (Join-Path $logs 'ngrok.pid')"
    call :ResolveNgrokUrl
    if defined NGROK_PUBLIC_URL (
      echo [OK] Tunel ngrok temporal activo: !NGROK_PUBLIC_URL!. Logs: logs\ngrok.log
    ) else (
      echo [WARN] Ngrok fue iniciado, pero no se pudo confirmar la URL publica en http://127.0.0.1:4040.
    )
  ) else (
    echo [WARN] FUVEX_USE_NGROK=1, pero no existe ngrok.exe en la raiz.
  )
) else (
  echo [INFO] Ngrok desactivado. Define FUVEX_USE_NGROK=1 para tunel temporal o FUVEX_NGROK_DOMAIN para dominio reservado.
)
echo.

echo [7/7] Iniciando App Movil con Expo...
set "LOCAL_IP="
for /f "delims=" %%I in ('powershell -NoProfile -Command "$ErrorActionPreference='SilentlyContinue';$socket=New-Object System.Net.Sockets.Socket([System.Net.Sockets.AddressFamily]::InterNetwork,[System.Net.Sockets.SocketType]::Dgram,[System.Net.Sockets.ProtocolType]::Udp);$socket.Connect('8.8.8.8',80);$ip=($socket.LocalEndPoint).Address.ToString();$socket.Dispose();if($ip -and -not $ip.StartsWith('169.254')){$ip}"') do set "LOCAL_IP=%%I"
if not defined LOCAL_IP (
  for /f "delims=" %%I in ('powershell -NoProfile -Command "$ips=[System.Net.Dns]::GetHostEntry([System.Net.Dns]::GetHostName()).AddressList;foreach($ip in $ips){if($ip.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and -not $ip.IPAddressToString.StartsWith('169.254')){$ip.IPAddressToString;break}}"') do set "LOCAL_IP=%%I"
)
if not defined LOCAL_IP set "LOCAL_IP=localhost"

set "MOBILE_API_URL=http://%LOCAL_IP%:3001/api"
if defined NGROK_PUBLIC_URL set "MOBILE_API_URL=!NGROK_PUBLIC_URL!/api"
if defined FUVEX_NGROK_DOMAIN if not defined NGROK_PUBLIC_URL (
  set "FUVEX_NGROK_DOMAIN_CLEAN=%FUVEX_NGROK_DOMAIN:http://=%"
  set "FUVEX_NGROK_DOMAIN_CLEAN=!FUVEX_NGROK_DOMAIN_CLEAN:https://=!"
  set "MOBILE_API_URL=https://!FUVEX_NGROK_DOMAIN_CLEAN!/api"
)
if defined EXPO_PUBLIC_API_URL set "MOBILE_API_URL=%EXPO_PUBLIC_API_URL%"
set "REACT_NATIVE_PACKAGER_HOSTNAME=%LOCAL_IP%"
set "EXPO_NO_TELEMETRY=1"

if not defined FUVEX_EXPO_PORT set "FUVEX_EXPO_PORT=8082"
set "EXPO_ARGS=--lan --clear --go --port %FUVEX_EXPO_PORT%"
if defined FUVEX_EXPO_ARGS set "EXPO_ARGS=%FUVEX_EXPO_ARGS%"
echo [OK] Expo Mobile se abrira en esta misma ventana para mostrar el QR.
echo.

timeout /t 5 >nul
start "" http://localhost:5173

echo URLs locales:
echo   Backend: http://localhost:3001
echo   Backend LAN para mobile: %MOBILE_API_URL%
echo   Web:     http://localhost:5173
echo   Mobile:  QR de Expo Go en esta ventana
echo   Metro LAN host: %REACT_NATIVE_PACKAGER_HOSTNAME%
echo   Metro puerto: %FUVEX_EXPO_PORT%
echo   Modo: %FUVEX_MODE_LABEL%
if defined NGROK_PUBLIC_URL echo   API para APK de prueba: !NGROK_PUBLIC_URL!/api
if not defined NGROK_PUBLIC_URL if "%FUVEX_START_MODE%"=="2" echo   API para APK de prueba: %MOBILE_API_URL%
echo.
echo Backend y Web corren ocultos para no abrir varias ventanas de CMD.
echo Logs:
echo   logs\backend.log
echo   logs\web.log
echo.
echo Modo Expo actual: %EXPO_ARGS%
echo Para Expo Go local usa el QR con el celular en la misma WiFi.
echo Para APK de prueba usa la URL mostrada en "API para APK de prueba" dentro de Configurar API.
echo Si compilas un build final, define EXPO_PUBLIC_API_URL con la API publica antes de compilar.
echo.
echo Iniciando Expo ahora. Para detener Expo usa Ctrl+C en esta ventana.
echo Al volver a ejecutar este BAT, se liberan automaticamente los puertos locales.

cd /d "%ROOT%apps\mobile"
set "EXPO_PUBLIC_API_URL=%MOBILE_API_URL%"
call npm.cmd run start -- %EXPO_ARGS%

exit /b 0

:ResolveNgrokUrl
set "NGROK_PUBLIC_URL="
for /l %%A in (1,1,20) do (
  for /f "delims=" %%U in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue';$response=Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 2;$tunnel=$response.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1;if($tunnel){$tunnel.public_url}"') do set "NGROK_PUBLIC_URL=%%U"
  if defined NGROK_PUBLIC_URL exit /b 0
  timeout /t 1 >nul
)
exit /b 0

:error
echo.
echo [ERROR] No se pudo completar la preparacion del proyecto.
echo Revisa el mensaje anterior y vuelve a ejecutar Iniciar Fuvex.bat.
pause
exit /b 1
