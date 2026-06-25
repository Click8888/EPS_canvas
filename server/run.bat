@echo off
chcp 65001 >nul
cd /d %~dp0
echo ==================================================
echo   EPS backend (с авто-перезапуском при обновлении)
echo ==================================================

:loop
if exist restart.flag del restart.flag
go run main.go
if exist restart.flag (
    echo.
    echo [update] Обновление установлено. Перезапуск бэкенда...
    echo.
    timeout /t 1 /nobreak >nul
    goto loop
)

echo.
echo Бэкенд остановлен.
pause
