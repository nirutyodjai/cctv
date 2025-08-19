@echo off
echo Starting CCTV Planner Server...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: npm is not installed!
    pause
    exit /b 1
)

REM Install dependencies
echo Installing dependencies...
npm install

REM Start server
echo.
echo Starting server on http://localhost:3000
echo Press Ctrl+C to stop the server
echo.
npm start

pause
