@echo off
setlocal
title VERDICT CLI Installer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\install-verdict.ps1" -SourceRoot "%~dp0" %*
set "VERDICT_INSTALL_EXIT=%errorlevel%"
if not "%VERDICT_INSTALL_EXIT%"=="0" (
  echo.
  echo Installation failed with exit code %VERDICT_INSTALL_EXIT%.
  echo Retry with -LogFile "%%TEMP%%\verdict-install.log" for debug details.
  pause
)
exit /b %VERDICT_INSTALL_EXIT%
