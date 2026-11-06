@echo off
title TeamManagementSystem

set PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

echo Starting Team Management System...

:: Start Server
start "TMS - Server" cmd /k "cd /d "%PROJECT_DIR%server" && node src/server.js"

:: Wait a moment before starting client
timeout /t 3 /nobreak >nul

:: Start Client (dev mode)
start "TMS - Client" cmd /k "cd /d "%PROJECT_DIR%client" && npx vite"

echo Both server and client have been started.
