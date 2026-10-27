@echo off
rem Double-click to view the portfolio: starts the local server and opens it in your browser.
rem Close this window to stop the server.
cd /d "%~dp0"
start "" http://localhost:8080/
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\serve.ps1" -Port 8080
