@echo off
title ZYPHER MD - TWO-WAY REAL-TIME LIVE CALL CENTER
color 0b
echo ======================================================================
echo    ZYPHER MD TWO-WAY REAL-TIME VOIP CALL CENTER (SINHALA AI)
echo ======================================================================
echo.
echo [1/2] Starting Live Call Bridge Server on http://localhost:3000 ...
start "" http://localhost:3000
node live-call-bridge.js
pause

