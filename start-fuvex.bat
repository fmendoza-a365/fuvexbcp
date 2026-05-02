@echo off
echo =======================================================
echo          Iniciando Fuvex Manager a365 (Local)
echo =======================================================
echo.
echo [1/2] Iniciando Servidor Backend y Web Dashboard...
start cmd /k "cd apps\backend && npx ts-node src\server.ts"

echo [2/2] Iniciando Servidor de App Movil (Expo)...
start cmd /k "cd apps\mobile && npm start"

echo.
echo =======================================================
echo ✅ SERVICIOS INICIADOS
echo.
echo 🖥️  Web Dashboard:  http://localhost:3000
echo 📱 App Movil:      Escanea el QR en la otra ventana con Expo Go
echo.
echo Para apagar el sistema, cierra las dos ventanas negras nuevas.
echo =======================================================
pause
