@echo off
echo Starting Zypher MD Bot in Docker (with Live Call Bridge)...
cd /d "%~dp0"
docker compose up -d --build
echo.
echo ===========================================
echo Bot & Live Call Bridge running in Docker!
echo - Web Dashboard: http://localhost:3000
echo To view live logs, open docker-logs.bat
echo To stop the bot, open docker-stop.bat
echo ===========================================
echo.
pause

