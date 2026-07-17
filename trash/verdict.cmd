@echo off
setlocal
node "%~dp0tools\verdict-cli\verdict.mjs" %*
exit /b %errorlevel%
