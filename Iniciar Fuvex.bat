@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
cd /d "%ROOT%"

title Fuvex Manager A365 - Inicio
mode con: cols=132 lines=44

echo.
echo ===============================================================
echo   FUVEX MANAGER A365 - INICIO COMPLETO
echo ===============================================================
echo.
echo Este inicio levanta:
echo   - Backend API en http://localhost:3001
echo   - Web local en http://localhost:5173
echo   - Expo Go con QR en modo local
echo   - Ngrok para web/API publica en modo remoto
echo.
echo Modo 1 LOCAL:
echo   PC y celular en la misma red WiFi. Expo usa LAN.
echo.
echo Modo 2 REMOTO:
echo   Celular en datos moviles u otra red. Backend/Web usan ngrok.
echo   Para movil se usa la APK de prueba con la URL API configurable en login.
echo.

if /i "%FUVEX_USE_NGROK%"=="1" set "FUVEX_MODE=2"
if defined FUVEX_NGROK_DOMAIN set "FUVEX_MODE=2"

if not defined FUVEX_MODE (
  set /p "FUVEX_MODE=Elige modo [1 Local / 2 Remoto, Enter=1]: "
)

if "%FUVEX_MODE%"=="" set "FUVEX_MODE=1"
if /i "%FUVEX_MODE%"=="LOCAL" set "FUVEX_MODE=1"
if /i "%FUVEX_MODE%"=="LAN" set "FUVEX_MODE=1"
if /i "%FUVEX_MODE%"=="REMOTO" set "FUVEX_MODE=2"
if /i "%FUVEX_MODE%"=="NGROK" set "FUVEX_MODE=2"

if not "%FUVEX_MODE%"=="2" set "FUVEX_MODE=1"

if "%FUVEX_MODE%"=="2" (
  set "MODE_LABEL=REMOTO CON NGROK"
  set "NEEDS_NGROK=1"
) else (
  set "MODE_LABEL=LOCAL WIFI"
  set "NEEDS_NGROK=0"
)

echo.
echo [OK] Modo seleccionado: %MODE_LABEL%
echo.

call :StopServers
if errorlevel 1 goto :error

call :ValidateEnvironment
if errorlevel 1 goto :error

call :PrepareDatabase
if errorlevel 1 goto :error

call :BuildAndValidate
if errorlevel 1 goto :error

call :StartBackend
if errorlevel 1 goto :error

call :StartWeb
if errorlevel 1 goto :error

if "%NEEDS_NGROK%"=="1" (
  call :StartNgrok
  if errorlevel 1 goto :error
)

call :PrepareMobileEnvironment
if errorlevel 1 goto :error

call :PrintSummary

if "%NEEDS_NGROK%"=="1" (
  echo.
  echo ===============================================================
  echo   MODO REMOTO LISTO
  echo ===============================================================
  echo No se abre QR en modo remoto.
  echo Expo Go por QR remoto depende de Expo tunnel y fallo en este equipo.
  echo Usa la APK de prueba e ingresa esta URL en la seccion API del login:
  echo.
  echo   %MOBILE_API_URL%
  echo.
  echo La web publica queda abierta en el navegador.
  echo Para detener backend/ngrok, vuelve a ejecutar este BAT y cierra despues del paso 1.
  echo.
  if /i "%FUVEX_NO_PAUSE%"=="1" exit /b 0
  pause
  exit /b 0
)

cd /d "%ROOT%apps\mobile"
set "EXPO_PUBLIC_API_URL=%MOBILE_API_URL%"
set "EXPO_NO_TELEMETRY=1"

echo.
echo ===============================================================
echo   EXPO GO
echo ===============================================================
echo Escanea el QR que aparece abajo con Expo Go.
echo Para detener Expo usa Ctrl+C en esta ventana.
echo.

call npm.cmd run start -- %EXPO_ARGS%
exit /b %errorlevel%

:StopServers
echo [1/8] Cerrando procesos previos...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "$ports=@(3001,5173,8081,8082,8083,19000,19001,19002,19006,4040);" ^
  "$ids=@();" ^
  "foreach($port in $ports){$ids += Get-NetTCPConnection -LocalPort $port | Select-Object -ExpandProperty OwningProcess};" ^
  "$ids=$ids | Where-Object { $_ -and $_ -ne $PID } | Sort-Object -Unique;" ^
  "foreach($id in $ids){Stop-Process -Id $id -Force};" ^
  "Get-Process ngrok | Stop-Process -Force"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 2"
echo [OK] Puertos liberados.
echo.
exit /b 0

:ValidateEnvironment
echo [2/8] Validando entorno...
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro npm.cmd. Instala Node.js 20+.
  exit /b 1
)

if not exist "%ROOT%node_modules" (
  echo [ERROR] Falta node_modules.
  echo Ejecuta: npm install --legacy-peer-deps
  exit /b 1
)

if not exist "%ROOT%apps\backend\.env" (
  echo [ERROR] Falta apps\backend\.env.
  echo Copia apps\backend\.env.example a apps\backend\.env y completa credenciales.
  exit /b 1
)

if "%NEEDS_NGROK%"=="1" (
  if not exist "%ROOT%ngrok.exe" (
    echo [ERROR] Modo remoto requiere ngrok.exe en la raiz del proyecto.
    exit /b 1
  )
)

echo [OK] Entorno listo.
echo.
exit /b 0

:PrepareDatabase
echo [3/8] Preparando base de datos y catalogos...
cd /d "%ROOT%apps\backend"
if not exist "%ROOT%data" mkdir "%ROOT%data"
if not exist "%ROOT%logs" mkdir "%ROOT%logs"
call npx.cmd prisma generate
if errorlevel 1 exit /b 1
call npx.cmd prisma migrate deploy
if errorlevel 1 exit /b 1
call npx.cmd prisma db seed
if errorlevel 1 exit /b 1
echo [OK] Catalogos, convenios, cargos y RCI cargados.
echo.
exit /b 0

:BuildAndValidate
echo [4/8] Compilando y validando proyecto...
cd /d "%ROOT%"
call npm.cmd exec --workspace backend -- tsc --noEmit -p tsconfig.json
if errorlevel 1 exit /b 1
call npm.cmd run build --workspace web
if errorlevel 1 exit /b 1
call npm.cmd exec --workspace mobile -- tsc --noEmit -p tsconfig.json
if errorlevel 1 exit /b 1
echo [OK] Backend, web y mobile validados.
echo.
exit /b 0

:StartBackend
echo [5/8] Iniciando backend en segundo plano...
set "FUVEX_ROOT=%ROOT%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root=$env:FUVEX_ROOT;" ^
  "$logs=Join-Path $root 'logs';" ^
  "New-Item -ItemType Directory -Force -Path $logs | Out-Null;" ^
  "$p=Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm.cmd run dev' -WorkingDirectory (Join-Path $root 'apps\backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'backend.log') -RedirectStandardError (Join-Path $logs 'backend-error.log') -PassThru;" ^
  "$p.Id | Set-Content -Path (Join-Path $logs 'backend.pid')"
if errorlevel 1 exit /b 1

call :WaitForUrl "http://127.0.0.1:3001/api/health" "Backend"
if errorlevel 1 exit /b 1
echo.
exit /b 0

:StartWeb
echo [6/8] Iniciando web local en segundo plano...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root=$env:FUVEX_ROOT;" ^
  "$logs=Join-Path $root 'logs';" ^
  "New-Item -ItemType Directory -Force -Path $logs | Out-Null;" ^
  "$p=Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm.cmd run dev -- --host 0.0.0.0' -WorkingDirectory (Join-Path $root 'apps\web') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'web.log') -RedirectStandardError (Join-Path $logs 'web-error.log') -PassThru;" ^
  "$p.Id | Set-Content -Path (Join-Path $logs 'web.pid')"
if errorlevel 1 exit /b 1
echo [OK] Web local solicitada en http://localhost:5173
echo.
exit /b 0

:StartNgrok
echo [7/8] Iniciando ngrok para backend y web publica...
set "NGROK_PUBLIC_URL="
if defined FUVEX_NGROK_DOMAIN (
  set "NGROK_DOMAIN_CLEAN=%FUVEX_NGROK_DOMAIN:http://=%"
  set "NGROK_DOMAIN_CLEAN=!NGROK_DOMAIN_CLEAN:https://=!"
  set "NGROK_DOMAIN_CLEAN=!NGROK_DOMAIN_CLEAN:/=!"
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$root=$env:FUVEX_ROOT;" ^
    "$logs=Join-Path $root 'logs';" ^
    "$domain=$env:NGROK_DOMAIN_CLEAN;" ^
    "$p=Start-Process -FilePath (Join-Path $root 'ngrok.exe') -ArgumentList 'http','3001',('--domain=' + $domain) -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'ngrok.log') -RedirectStandardError (Join-Path $logs 'ngrok-error.log') -PassThru;" ^
    "$p.Id | Set-Content -Path (Join-Path $logs 'ngrok.pid')"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$root=$env:FUVEX_ROOT;" ^
    "$logs=Join-Path $root 'logs';" ^
    "$p=Start-Process -FilePath (Join-Path $root 'ngrok.exe') -ArgumentList 'http','3001' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'ngrok.log') -RedirectStandardError (Join-Path $logs 'ngrok-error.log') -PassThru;" ^
    "$p.Id | Set-Content -Path (Join-Path $logs 'ngrok.pid')"
)
if errorlevel 1 exit /b 1

call :ResolveNgrokUrl
if not defined NGROK_PUBLIC_URL (
  echo [ERROR] No se pudo obtener URL publica de ngrok.
  echo Revisa logs\ngrok-error.log.
  exit /b 1
)

call :WaitForUrl "!NGROK_PUBLIC_URL!/api/health" "Ngrok"
if errorlevel 1 (
  echo [WARN] No se pudo validar la URL publica desde PowerShell.
  echo [WARN] Si el navegador abre !NGROK_PUBLIC_URL!/api/health, puedes continuar.
)
echo [OK] Ngrok activo: !NGROK_PUBLIC_URL!
echo.
exit /b 0

:PrepareMobileEnvironment
echo [8/8] Preparando Expo Go...
call :DetectLocalIp

if "%NEEDS_NGROK%"=="1" (
  set "MOBILE_API_URL=!NGROK_PUBLIC_URL!/api"
  set "EXPO_ARGS="
  set "REACT_NATIVE_PACKAGER_HOSTNAME="
) else (
  if not defined FUVEX_EXPO_PORT set "FUVEX_EXPO_PORT=8082"
  set "MOBILE_API_URL=http://!LOCAL_IP!:3001/api"
  set "EXPO_ARGS=--lan --go --clear --port !FUVEX_EXPO_PORT!"
  set "REACT_NATIVE_PACKAGER_HOSTNAME=!LOCAL_IP!"
)

if defined EXPO_PUBLIC_API_URL set "MOBILE_API_URL=%EXPO_PUBLIC_API_URL%"
if defined FUVEX_EXPO_ARGS set "EXPO_ARGS=%FUVEX_EXPO_ARGS%"

echo [OK] API movil: %MOBILE_API_URL%
echo [OK] Expo args: %EXPO_ARGS%
echo.
exit /b 0

:DetectLocalIp
set "LOCAL_IP="
for /f "delims=" %%I in ('powershell -NoProfile -Command "$ErrorActionPreference='SilentlyContinue';$socket=New-Object System.Net.Sockets.Socket([System.Net.Sockets.AddressFamily]::InterNetwork,[System.Net.Sockets.SocketType]::Dgram,[System.Net.Sockets.ProtocolType]::Udp);$socket.Connect('8.8.8.8',80);$ip=($socket.LocalEndPoint).Address.ToString();$socket.Dispose();if($ip -and -not $ip.StartsWith('169.254')){$ip}"') do set "LOCAL_IP=%%I"
if not defined LOCAL_IP (
  for /f "delims=" %%I in ('powershell -NoProfile -Command "$ips=[System.Net.Dns]::GetHostEntry([System.Net.Dns]::GetHostName()).AddressList;foreach($ip in $ips){if($ip.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and -not $ip.IPAddressToString.StartsWith('169.254')){$ip.IPAddressToString;break}}"') do set "LOCAL_IP=%%I"
)
if not defined LOCAL_IP set "LOCAL_IP=localhost"
exit /b 0

:ResolveNgrokUrl
set "NGROK_PUBLIC_URL="
for /l %%A in (1,1,30) do (
  for /f "delims=" %%U in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue';$r=Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 2;$t=$r.tunnels | Where-Object { $_.proto -eq 'https' -and $_.config.addr -like '*3001*' } | Select-Object -First 1;if(-not $t){$t=$r.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1};if($t){$t.public_url}"') do set "NGROK_PUBLIC_URL=%%U"
  if defined NGROK_PUBLIC_URL exit /b 0
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 1"
)
exit /b 0

:WaitForUrl
set "WAIT_URL=%~1"
set "WAIT_NAME=%~2"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url=$env:WAIT_URL;" ^
  "$name=$env:WAIT_NAME;" ^
  "$ok=$false;" ^
  "for($i=1;$i -le 90;$i++){" ^
  "  try { [void](Invoke-RestMethod -Uri $url -TimeoutSec 2); $ok=$true; break }" ^
  "  catch { Start-Sleep -Seconds 1 }" ^
  "}" ^
  "if($ok){ Write-Host ('[OK] ' + $name + ' disponible: ' + $url); exit 0 }" ^
  "Write-Host ('[ERROR] ' + $name + ' no respondio: ' + $url); exit 1"
exit /b %errorlevel%

:PrintSummary
echo.
echo ===============================================================
echo   RESUMEN
echo ===============================================================
echo Modo:      %MODE_LABEL%
echo Backend:   http://localhost:3001
echo Web local: http://localhost:5173
echo API movil: %MOBILE_API_URL%
if "%NEEDS_NGROK%"=="1" (
  echo Web publica: !NGROK_PUBLIC_URL!
  echo API publica: !NGROK_PUBLIC_URL!/api
  echo Movil:      APK de prueba con API configurable.
) else (
  echo IP local:   %LOCAL_IP%
  echo Expo QR:    LAN, requiere misma WiFi.
)
echo Logs:
echo   logs\backend.log
echo   logs\web.log
if "%NEEDS_NGROK%"=="1" echo   logs\ngrok.log
echo.
if /i not "%FUVEX_NO_BROWSER%"=="1" (
  start "" http://localhost:5173
  if "%NEEDS_NGROK%"=="1" start "" "!NGROK_PUBLIC_URL!"
)
exit /b 0

:error
echo.
echo ===============================================================
echo   ERROR
echo ===============================================================
echo No se pudo completar el inicio.
echo Revisa el mensaje anterior y los logs en la carpeta logs.
if /i "%FUVEX_NO_PAUSE%"=="1" exit /b 1
pause
exit /b 1
