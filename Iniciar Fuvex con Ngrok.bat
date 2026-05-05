@echo off
chcp 65001 >nul
setlocal EnableExtensions

set "FUVEX_USE_NGROK=1"
call "%~dp0Iniciar Fuvex.bat"
