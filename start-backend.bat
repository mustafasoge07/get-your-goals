@echo off
cd /d "%~dp0backend"
if not exist node_modules (
  echo Installing backend dependencies...
  call npm install
)
call npm start
pause
