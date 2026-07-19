@echo off
setlocal
title VERDICT CLI Setup
color 07

set "LOG_DIR=%LOCALAPPDATA%\VERDICT\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1
set "BOOT_LOG=%LOG_DIR%\setup-bootstrap.log"

echo ================================================================
echo   VERDICT CLI SETUP FOR WINDOWS
echo ================================================================
echo.
echo Installing the standalone Windows connector.
echo No Node.js installation is required.
echo.

echo [%date% %time%] Setup started from %~dp0>>"%BOOT_LOG%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-verdict.ps1" -PayloadDir "%~dp0." -LogFile "%LOG_DIR%\installer-latest.log" -Quiet
set "RESULT=%errorlevel%"

echo.
if not "%RESULT%"=="0" (
    echo ================================================================
    echo   INSTALLATION FAILED
    echo ================================================================
    echo.
    echo The installer returned error code %RESULT%.
    echo.
    echo Logs:
    echo   %LOG_DIR%\installer-latest.log
    echo   %BOOT_LOG%
    echo.
    echo These files contain the information needed to diagnose the error.
    echo [%date% %time%] Setup failed with code %RESULT%.>>"%BOOT_LOG%"
) else (
    echo ================================================================
    echo   VERDICT CLI IS INSTALLED
    echo ================================================================
    echo.
    echo Open your VERDICT Profile, generate a pairing code, then run:
    echo   verdict connect ABCD-EFGH
    echo.
    echo Installation log:
    echo   %LOG_DIR%\installer-latest.log
    echo [%date% %time%] Setup completed successfully.>>"%BOOT_LOG%"
)

echo.
pause
endlocal & exit /b %RESULT%
