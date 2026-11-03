@echo off
title ZYPHER MD - DOCKER REBUILD & UPDATE
color 0a
echo ======================================================================
echo          ZYPHER MD DOCKER REBUILD & UPDATE (LIVE CALL ENABLED)
echo ======================================================================
echo.
cd /d "%~dp0"
echo [1/3] Stopping previous container...
docker compose down

echo.
echo [2/3] Rebuilding Docker image with Two-Way Live Call Bridge...
docker compose build --no-cache

echo.
echo [3/3] Starting updated Docker container in background...
docker compose up -d

echo.
echo ======================================================================
echo SUCCESS! Zypher MD Bot & Live Call Bridge updated in Docker!
echo - Web Dashboard: http://localhost:3000
echo - WhatsApp Bot Port: 9090 / 8000
echo ======================================================================
echo.
docker compose ps
echo.
pause

