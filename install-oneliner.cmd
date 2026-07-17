@echo off
rem ===========================================================================
rem  VERDICT CLI — Single-file installer
rem  Zero dependencies: this .cmd embeds a fully self-contained PowerShell
rem  installer script so you need only one file.
rem
rem  Usage:
rem    install-oneliner.cmd [--server URL] [--quiet]
rem
rem  Or from a running server:
rem    curl -fsSL https://server/api/system/cli/installer -o install.cmd && install.cmd
rem ===========================================================================
setlocal enabledelayedexpansion
title VERDICT CLI Installer

set "SERVER=http://localhost:8080"
set "QUIET="
set "NODE_INSTALL="
set "LOG_FILE="

:parse_args
if "%~1"=="" goto end_parse
if /i "%~1"=="--server" set "SERVER=%~2"& shift & shift & goto parse_args
if /i "%~1"=="--quiet" set "QUIET=--quiet"& shift & goto parse_args
if /i "%~1"=="--no-node" set "NODE_INSTALL=-NoNodeInstall"& shift & goto parse_args
if /i "%~1"=="--log" set "LOG_FILE=%~2"& shift & shift & goto parse_args
if /i "%~1"=="--help" goto help
shift & goto parse_args

:help
echo VERDICT CLI Installer — single-file edition
echo.
echo Usage: %~nx0 [options]
echo.
echo   --server URL     VERDICT server address
echo                    (default: http://localhost:8080)
echo   --quiet          Suppress prompts
echo   --no-node        Skip automatic Node.js installation
echo   --log FILE       Write installation log to FILE
echo   --help           Show this help
echo.
exit /b 0

:end_parse

rem ── Find our own directory ─────────────────────────────────────────
set "SELF_DIR=%~dp0"

rem ── Create temporary PowerShell script ─────────────────────────────
set "TEMP_PS1=%TEMP%\verdict-install-%RANDOM%.ps1"

rem ── Write embedded PowerShell installer ────────────────────────────
rem The embedded script is a self-contained installer that:
rem   - Downloads or copies verdict.exe (preferred) or verdict.mjs
rem   - Verifies SHA-256 checksum
rem   - Creates launcher, Start Menu shortcuts, uninstaller
rem   - Updates PATH and broadcasts WM_SETTINGCHANGE
rem   - Writes a log file if requested

> "%TEMP_PS1%" (
echo [CmdletBinding^(^)]param^(^)
echo     [string]$Server = '%SERVER%',
echo     [switch]$Quiet = !![bool]'%QUIET%'.Length,
echo     [switch]$NoNodeInstall = !![bool]'%NODE_INSTALL%'.Length,
echo     [string]$LogFile = '%LOG_FILE%'
echo ^)
echo $ErrorActionPreference = 'Stop'
echo $installDir = Join-Path $env:LOCALAPPDATA 'VERDICT CLI'
echo $exeFile = Join-Path $installDir 'verdict.exe'
echo $mjsFile = Join-Path $installDir 'verdict.mjs'
echo $launcherFile = Join-Path $installDir 'verdict.cmd'
echo $shaFile = Join-Path $installDir 'verdict.exe.sha256'
echo $uninstallerFile = Join-Path $installDir 'uninstall-verdict.ps1'
echo $script:logLines = @()
echo function Write-Log^(^[string]$Message^) { $script:logLines += ''[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message'' }
echo function Write-Step^(^[string]$Message^) { Write-Host ''`n  $Message'' -ForegroundColor Cyan; Write-Log ''STEP: $Message'' }
echo function Write-Result^(^[string]$Message^) { Write-Host ''  $Message'' -ForegroundColor DarkGray; Write-Log ''INFO: $Message'' }
echo function Save-Log { if ^($LogFile^) { $script:logLines -join ''`n'' ^| Out-File -FilePath $LogFile -Encoding UTF8 } }
echo function Test-Checksum^(^[string]$FilePath,[string]$ExpectedHash^) {
echo     if ^(-not $ExpectedHash^) { return $true }
echo     if ^(-not ^(Test-Path $FilePath^)^) { return $false }
echo     $actual = ^(Get-FileHash $FilePath -Algorithm SHA256^).Hash.ToLower^(^)
echo     return ^($actual -eq $ExpectedHash.ToLower^(^)^)
echo }
echo function Read-Checksum^(^[string]$ShaFilePath^) {
echo     if ^(-not ^(Test-Path $ShaFilePath^)^) { return '''' }
echo     return ^(^(Get-Content $ShaFilePath -Raw^).Trim^(^) -split '\s+''^)[0]
echo }
echo function Resolve-Node {
echo     $cmd = Get-Command node -ErrorAction SilentlyContinue
echo     if ^($cmd^) { $major = [int]^(^(& $cmd.Source --version^).TrimStart^('v'^).Split^('.'^)[0]^); if ^($major -ge 22^) { return $cmd.Source } }
echo     return $null
echo }
echo function Broadcast-PathChange {
echo     try {
echo         $user32 = Add-Type -MemberDefinition @'
echo [DllImport^("user32.dll", SetLastError = true, CharSet = CharSet.Auto^)]
echo public static extern IntPtr SendMessageTimeout^(IntPtr hWnd, uint Msg, IntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult^);
echo '@ -Name ''User32'' -Namespace ''Win32'' -PassThru
echo         $null = $user32::SendMessageTimeout^(^[IntPtr] 0xFFFF, 0x001A, [IntPtr]::Zero, ''Environment'', 0x0002, 5000, [ref] [IntPtr]::Zero^)
echo     } catch {}
echo }
echo Write-Host ''''
echo Write-Host ''  VERDICT CLI INSTALLER'' -ForegroundColor Red
echo Write-Host ''  Secure terminal access for your VERDICT workspace'' -ForegroundColor DarkGray
echo Write-Log ''Installer started. Server=$Server''
echo Write-Step ''Setting up VERDICT CLI...''
echo Write-Result ''Server: $Server''
echo Write-Result ''Install dir: $installDir''
echo New-Item -ItemType Directory -Path $installDir -Force ^| Out-Null
echo $hasExe = $false
echo $hasMjs = $false
echo $SourceRoot = '%~dp0'
echo $exeSource = Join-Path $SourceRoot 'dist\verdict.exe'
echo $mjsSource = Join-Path $SourceRoot 'tools\verdict-cli\verdict.mjs'
echo $readmeSource = Join-Path $SourceRoot 'tools\verdict-cli\README.txt'
echo if ^(Test-Path $exeSource^) {
echo     Write-Step ''Installing verdict.exe from source...''
echo     Copy-Item $exeSource $exeFile -Force
echo     $shaSource = Join-Path $SourceRoot 'dist\verdict.exe.sha256'
echo     if ^(Test-Path $shaSource^) {
echo         Copy-Item $shaSource $shaFile -Force
echo         $verifiedSha = Read-Checksum $shaFile
echo         if ^($verifiedSha -and -not ^(Test-Checksum $exeFile $verifiedSha^)^) { throw ''SHA-256 verification failed.'' }
echo     }
echo     $hasExe = $true
echo } elseif ^(Test-Path $mjsSource^) {
echo     Write-Step ''Installing verdict.mjs from source...''
echo     Copy-Item $mjsSource $mjsFile -Force
echo     $hasMjs = $true
echo } else {
echo     Write-Step ''Downloading from server...''
echo     $base = ''$Server/api/system/cli/files''
echo     try { Invoke-WebRequest ''$base/verdict.exe'' -UseBasicParsing -OutFile $exeFile -ErrorAction Stop; $hasExe = $true; Write-Result ''Downloaded verdict.exe'' }
echo     catch { try { Invoke-WebRequest ''$base/verdict.mjs'' -UseBasicParsing -OutFile $mjsFile -ErrorAction Stop; $hasMjs = $true; Write-Result ''Downloaded verdict.mjs'' } catch { throw ''Could not download CLI from $base'' } }
echo     try { Invoke-WebRequest ''$base/verdict.exe.sha256'' -UseBasicParsing -OutFile $shaFile -ErrorAction SilentlyContinue } catch {}
echo     try { Invoke-WebRequest ''$base/README.txt'' -UseBasicParsing -OutFile ^(Join-Path $installDir ''README.txt''^) -ErrorAction SilentlyContinue } catch {}
echo }
echo if ^($hasMjs^) {
echo     $nodePath = Resolve-Node
echo     if ^(-not $nodePath -and -not $NoNodeInstall^) {
echo         Write-Step ''Node.js 22+ is required. Installing via winget...''
echo         if ^(-not ^(Get-Command winget -ErrorAction SilentlyContinue^)^) { throw ''Node.js 22+ not found and winget unavailable.'' }
echo         winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
echo         $env:Path = ''$env:ProgramFiles\nodejs;$env:Path''
echo         $nodePath = Resolve-Node
echo     }
echo     if ^(-not $nodePath^) { throw ''Node.js 22+ is required.'' }
echo     Write-Step ''Using $^(& $nodePath --version^) from $nodePath''
echo }
echo if ^($hasExe^) {
echo     @''@echo off''
echo     ''"%~dp0verdict.exe" %*''
echo     ''exit /b %errorlevel%''@ | Set-Content -Path $launcherFile -Encoding ASCII
echo } else {
echo     @''@echo off''
echo     ''node "%~dp0verdict.mjs" %*''
echo     ''exit /b %errorlevel%''@ | Set-Content -Path $launcherFile -Encoding ASCII
echo }
echo # Uninstaller
echo @''
echo [CmdletBinding^(^)]param^([switch]$KeepAccountData,[switch]$Quiet^)
echo $ErrorActionPreference = ''Stop''
echo $installDir = Split-Path -Parent $MyInvocation.MyCommand.Path
echo $userPath = [Environment]::GetEnvironmentVariable^(^"Path^", ''User''^)
echo $nextPath = ^(^($userPath -split '';'' ^| Where-Object { $_ -and $_.TrimEnd^(^"\\^"^) -ine $installDir.TrimEnd^(^"\\^"^) }^) -join '';''^)
echo [Environment]::SetEnvironmentVariable^(^"Path^", $nextPath, ''User''^)
echo try { $null = ^(Add-Type -MemberDefinition @''[DllImport^(^"user32.dll^"^)]public static extern IntPtr SendMessageTimeout^(IntPtr,uint,IntPtr,string,uint,uint,out IntPtr^);''@ -Name U -PassThru^)::SendMessageTimeout^(^[IntPtr]0xFFFF,0x001A,[IntPtr]::Zero,''Environment'',0x0002,5000,[ref][IntPtr]::Zero^) } catch {}
echo Remove-Item ^(Join-Path $env:APPDATA ''VERDICT''^) -Recurse -Force -ErrorAction SilentlyContinue
echo Remove-Item ^(Join-Path $env:APPDATA ''Microsoft\Windows\Start Menu\Programs\VERDICT CLI''^) -Recurse -Force -ErrorAction SilentlyContinue
echo Write-Host ''VERDICT CLI was removed.'' -ForegroundColor Green
echo Start-Process powershell.exe -WindowStyle Hidden -ArgumentList ''-NoProfile'', ''-Command'', ''Start-Sleep 1; Remove-Item -LiteralPath ''$installDir'' -Recurse -Force''
echo if ^(-not $Quiet^) { Read-Host ''Press Enter to close'' ^| Out-Null }
echo '@ | Set-Content -Path $uninstallerFile -Encoding UTF8
echo if ^(-not ^(Get-Command verdict -ErrorAction SilentlyContinue^)^) {
echo     $userPath = [Environment]::GetEnvironmentVariable^(^"Path^", ''User''^)
echo     $normalDir = $installDir.TrimEnd^(^"\\^"^)
echo     $pathEntries = @^($userPath -split '';'' ^| Where-Object { $_ }^)
echo     $already = $pathEntries ^| Where-Object { $_.TrimEnd^(^"\\^"^) -ieq $normalDir }
echo     if ^(-not $already^) {
echo         [Environment]::SetEnvironmentVariable^(^"Path^", ^(@($pathEntries^) + $installDir^) -join '';'', ''User''^)
echo         Write-Result ''Added to PATH.''
echo     }
echo     $env:Path = ''$installDir;$env:Path''
echo     Broadcast-PathChange
echo }
echo if ^($hasExe^) { $exec = $exeFile } else { $exec = $mjsFile }
echo ^& node $exec config set server $Server 2>$null
echo # Start Menu
echo $startMenu = Join-Path $env:APPDATA ''Microsoft\Windows\Start Menu\Programs\VERDICT CLI''
echo New-Item -ItemType Directory -Path $startMenu -Force ^| Out-Null
echo $shell = New-Object -ComObject WScript.Shell
echo $sc = $shell.CreateShortcut^(^(Join-Path $startMenu ''VERDICT CLI.lnk''^)^)
echo $sc.TargetPath = $env:ComSpec; $sc.Arguments = ''/k ""$launcherFile help""''; $sc.WorkingDirectory = $env:USERPROFILE; $sc.Save^(^)
echo $uc = $shell.CreateShortcut^(^(Join-Path $startMenu ''Uninstall VERDICT CLI.lnk''^)^)
echo $uc.TargetPath = ''powershell.exe''; $uc.Arguments = ''-NoProfile -ExecutionPolicy Bypass -File "$uninstallerFile"''; $uc.Save^(^)
echo Save-Log
echo Write-Host ''''
echo Write-Host ''  VERDICT CLI IS READY'' -ForegroundColor Green
echo Write-Host ''  Server:  $Server''
echo Write-Host ''  Command: verdict''
echo if ^($hasExe^) { Write-Host ''  Mode:    Standalone executable (no Node.js needed)'' -ForegroundColor Cyan }
echo Write-Host ''''
echo Write-Host ''  Next: open VERDICT Profile, generate a pairing code, then run:'' -ForegroundColor Yellow
echo Write-Host ''        verdict connect ABCD-EFGH'' -ForegroundColor White
echo Write-Host ''''
echo if ^(-not $Quiet^) { Read-Host ''Press Enter to close'' ^| Out-Null }
)

rem ── Run the embedded installer ──────────────────────────────────────
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%TEMP_PS1%"
set "INSTALL_EXIT=%errorlevel%"

del "%TEMP_PS1%" >nul 2>&1

if not "%INSTALL_EXIT%"=="0" (
    echo.
    echo Installation completed with exit code %INSTALL_EXIT%.
    echo Retry with --log "%%TEMP%%\verdict-install.log" for debug details.
    pause
)

endlocal & exit /b %INSTALL_EXIT%
