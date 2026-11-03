@echo off
cd /d "%~dp0"
echo Showing Zypher MD Bot live logs (Press Ctrl+C to exit logs)...
docker compose logs -f

