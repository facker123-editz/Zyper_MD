@echo off
cd /d "%~dp0"
echo Stopping Zypher MD Bot container...
docker compose down
echo.
echo Bot container stopped successfully.
pause

