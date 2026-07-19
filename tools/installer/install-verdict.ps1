[CmdletBinding()]
param(
    [string]$Server = "http://localhost:8080",
    [string]$DownloadBase = "",
    [string]$SourceRoot = "",
    [string]$PayloadDir = "",
    [string]$InstallDir = "",
    [string]$LogFile = "",
    [switch]$NoNodeInstall,
    [switch]$NoStartMenu,
    [switch]$SkipPath,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

$installDir = if ($InstallDir) { $InstallDir } else { Join-Path $env:LOCALAPPDATA "VERDICT CLI" }
$logDir = Join-Path $env:LOCALAPPDATA "VERDICT\logs"
if (-not $LogFile) {
    $LogFile = Join-Path $logDir ("installer-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
}
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
New-Item -ItemType Directory -Path $installDir -Force | Out-Null

# ── Logging ──────────────────────────────────────────────────────────
$script:logLines = @()
function Write-Log([string]$Message) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    $script:logLines += $line
    Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
}
function Write-Step([string]$Message) {
    Write-Host "`n  $Message" -ForegroundColor Cyan
    Write-Log "STEP: $Message"
}
function Write-Result([string]$Message) {
    Write-Host "  $Message" -ForegroundColor DarkGray
    Write-Log "INFO: $Message"
}
function Write-Error([string]$Message) {
    Write-Host "  $Message" -ForegroundColor Red
    Write-Log "ERROR: $Message"
}
function Save-Log {
    if (-not (Test-Path -LiteralPath $LogFile)) {
        $script:logLines -join "`n" | Out-File -FilePath $LogFile -Encoding UTF8
    }
}

$exeFile = Join-Path $installDir "verdict.exe"
$mjsFile = Join-Path $installDir "verdict.mjs"
$launcherFile = Join-Path $installDir "verdict.cmd"
$shaFile = Join-Path $installDir "verdict.exe.sha256"
$uninstallerFile = Join-Path $installDir "uninstall-verdict.ps1"

trap {
    $message = $_.Exception.Message
    Write-Log "FATAL: $message"
    Write-Log "POSITION: $($_.InvocationInfo.PositionMessage)"
    Write-Host ""
    Write-Host "  VERDICT CLI INSTALLATION FAILED" -ForegroundColor Red
    Write-Host "  $message" -ForegroundColor White
    Write-Host ""
    Write-Host "  A complete log was saved to:" -ForegroundColor Yellow
    Write-Host "  $LogFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  You can send that log when asking for support." -ForegroundColor DarkGray
    if (-not $Quiet) {
        Read-Host "Press Enter to close" | Out-Null
    }
    exit 1
}

# ── SHA-256 verification ─────────────────────────────────────────────
function Test-Checksum([string]$FilePath, [string]$ExpectedHash) {
    if (-not $ExpectedHash) { return $true }
    if (-not (Test-Path $FilePath)) { return $false }
    $actual = (Get-FileHash $FilePath -Algorithm SHA256).Hash.ToLower()
    return ($actual -eq $ExpectedHash.ToLower())
}

function Read-Checksum([string]$ShaFilePath) {
    if (-not (Test-Path $ShaFilePath)) { return "" }
    $content = (Get-Content $ShaFilePath -Raw).Trim()
    return ($content -split '\s+')[0]
}

function Resolve-Node {
    $command = Get-Command node -ErrorAction SilentlyContinue
    if ($command) {
        $major = [int]((& $command.Source --version).TrimStart("v").Split(".")[0])
        if ($major -ge 22) {
            return $command.Source
        }
    }
    return $null
}

function Broadcast-PathChange {
    # Notify Windows that environment variables changed so CMD/WT can pick up the new PATH
    try {
        $user32 = Add-Type -MemberDefinition @'
[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
public static extern IntPtr SendMessageTimeout(
    IntPtr hWnd, uint Msg, IntPtr wParam, string lParam,
    uint fuFlags, uint uTimeout, out IntPtr lpdwResult);
'@ -Name "User32" -Namespace "Win32" -PassThru
        $HWND_BROADCAST = [IntPtr] 0xFFFF
        $WM_SETTINGCHANGE = 0x001A
        $SMTO_ABORTIFHUNG = 0x0002
        $null = $user32::SendMessageTimeout($HWND_BROADCAST, $WM_SETTINGCHANGE, [IntPtr]::Zero, "Environment", $SMTO_ABORTIFHUNG, 5000, [ref] [IntPtr]::Zero)
        Write-Result "Environment-change notification broadcast."
    } catch {
        Write-Result "Could not broadcast PATH change (non-fatal): $_"
    }
}

# ── Welcome ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  VERDICT CLI INSTALLER" -ForegroundColor Red
Write-Host "  Secure terminal access for your VERDICT workspace" -ForegroundColor DarkGray
Write-Log "Installer started. Server=$Server DownloadBase=$DownloadBase SourceRoot=$SourceRoot"

# ── Phase 1: Resolve executable ──────────────────────────────────────
$hasExe = $false
$hasMjs = $false
$verifiedSha = ""

if ($DownloadBase) {
    $base = $DownloadBase.TrimEnd("/")
    # Try to download the standalone exe first
    Write-Step "Downloading verdict.exe (standalone, no Node.js needed)..."
    try {
        Invoke-WebRequest "$base/verdict.exe" -UseBasicParsing -OutFile $exeFile -ErrorAction Stop
        # Try to download SHA-256 manifest
        try {
            Invoke-WebRequest "$base/verdict.exe.sha256" -UseBasicParsing -OutFile $shaFile -ErrorAction SilentlyContinue
            $verifiedSha = Read-Checksum $shaFile
            if ($verifiedSha -and -not (Test-Checksum $exeFile $verifiedSha)) {
                throw "SHA-256 verification failed. The downloaded file may be corrupted."
            }
        } catch {
            Write-Result "SHA-256 manifest not available; skipping verification."
        }
        $hasExe = $true
        Write-Result "verdict.exe downloaded and verified."
    } catch {
        Write-Result "verdict.exe not available at server; falling back to Node.js version."
        try {
            Invoke-WebRequest "$base/verdict.mjs" -UseBasicParsing -OutFile $mjsFile -ErrorAction Stop
            $hasMjs = $true
        } catch {
            throw "Neither verdict.exe nor verdict.mjs could be downloaded from $base"
        }
    }
    # Download README
    try {
        Invoke-WebRequest "$base/README.txt" -UseBasicParsing -OutFile (Join-Path $installDir "README.txt") -ErrorAction SilentlyContinue
    } catch { Write-Result "README.txt not available (non-fatal)." }
} elseif ($PayloadDir) {
    $exeSource = Join-Path $PayloadDir "verdict.exe"
    $shaSource = Join-Path $PayloadDir "verdict.exe.sha256"
    $readmeSource = Join-Path $PayloadDir "README.txt"
    if (-not (Test-Path $exeSource)) {
        throw "The Windows installer payload is missing verdict.exe."
    }
    Write-Step "Installing the packaged Windows executable..."
    Copy-Item $exeSource $exeFile -Force
    if (Test-Path $shaSource) {
        Copy-Item $shaSource $shaFile -Force
        $verifiedSha = Read-Checksum $shaFile
        if ($verifiedSha -and -not (Test-Checksum $exeFile $verifiedSha)) {
            throw "SHA-256 verification failed. The packaged executable may be corrupted."
        }
    }
    if (Test-Path $readmeSource) {
        Copy-Item $readmeSource (Join-Path $installDir "README.txt") -Force
    }
    $hasExe = $true
    Write-Result "Packaged verdict.exe verified."
} elseif ($SourceRoot) {
    # Source install — prefer exe over mjs
    $exeSource = Join-Path $SourceRoot "dist\verdict.exe"
    $shaSource = Join-Path $SourceRoot "dist\verdict.exe.sha256"
    $mjsSource = Join-Path $SourceRoot "tools\verdict-cli\verdict.mjs"
    $readmeSource = Join-Path $SourceRoot "tools\verdict-cli\README.txt"

    if (Test-Path $exeSource) {
        Write-Step "Installing verdict.exe from source..."
        Copy-Item $exeSource $exeFile -Force
        if (Test-Path $shaSource) {
            Copy-Item $shaSource $shaFile -Force
            $verifiedSha = Read-Checksum $shaFile
            if ($verifiedSha -and -not (Test-Checksum $exeFile $verifiedSha)) {
                throw "SHA-256 verification failed. The source file may be corrupted."
            }
        }
        $hasExe = $true
    } else {
        Write-Step "No verdict.exe found; installing Node.js version..."
        if (-not (Test-Path $mjsSource)) {
            throw "Neither dist/verdict.exe nor tools/verdict-cli/verdict.mjs found in source."
        }
        Copy-Item $mjsSource $mjsFile -Force
        $hasMjs = $true
    }
    if (Test-Path $readmeSource) {
        Copy-Item $readmeSource (Join-Path $installDir "README.txt") -Force
    }
} else {
    throw "The installer needs DownloadBase, PayloadDir, or SourceRoot."
}

# ── Phase 2: Ensure Node.js (only needed for MJS) ────────────────────
$nodePath = $null
if (-not $hasExe) {
    $nodePath = Resolve-Node
    if (-not $nodePath -and -not $NoNodeInstall) {
        Write-Step "Node.js 22+ is required. Installing the current LTS release..."
        if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
            throw "Node.js 22+ was not found and winget is unavailable. Install Node.js, then run this installer again."
        }
        & winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
        $env:Path = "$env:ProgramFiles\nodejs;$env:Path"
        $nodePath = Resolve-Node
        if (-not $nodePath) {
            throw "Node.js was installed but could not be resolved. Restart your terminal and re-run this installer."
        }
    }
    if (-not $nodePath) {
        throw "Node.js 22 or newer is required."
    }
    Write-Step "Using $(& $nodePath --version) from $nodePath"
}

Write-Step "Installing into $installDir"

# ── Phase 3: Create launcher ─────────────────────────────────────────
if ($hasExe) {
    @"
@echo off
"%~dp0verdict.exe" %*
exit /b %errorlevel%
"@ | Set-Content -Path $launcherFile -Encoding ASCII
    Write-Result "Launcher configured to use verdict.exe (self-contained)."
} else {
    @"
@echo off
node "%~dp0verdict.mjs" %*
exit /b %errorlevel%
"@ | Set-Content -Path $launcherFile -Encoding ASCII
    Write-Result "Launcher configured to use verdict.mjs via Node.js."
}

# ── Phase 4: Create uninstaller ──────────────────────────────────────
@'
[CmdletBinding()]
param([switch]$KeepAccountData, [switch]$Quiet)
$ErrorActionPreference = "Stop"
$installDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$nextPath = (($userPath -split ";" | Where-Object { $_ -and $_.TrimEnd("\") -ine $installDir.TrimEnd("\") }) -join ";")
[Environment]::SetEnvironmentVariable("Path", $nextPath, "User")
# Broadcast change so open terminals see the removal
try {
    $user32 = Add-Type -MemberDefinition @"
[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
public static extern IntPtr SendMessageTimeout(
    IntPtr hWnd, uint Msg, IntPtr wParam, string lParam,
    uint fuFlags, uint uTimeout, out IntPtr lpdwResult);
"@ -Name "User32Uninstall" -Namespace "Win32" -PassThru
    $HWND_BROADCAST = [IntPtr] 0xFFFF
    $WM_SETTINGCHANGE = 0x001A
    $SMTO_ABORTIFHUNG = 0x0002
    $null = $user32::SendMessageTimeout($HWND_BROADCAST, $WM_SETTINGCHANGE, [IntPtr]::Zero, "Environment", $SMTO_ABORTIFHUNG, 5000, [ref] [IntPtr]::Zero)
} catch {}
if (-not $KeepAccountData) {
    Remove-Item (Join-Path $env:APPDATA "VERDICT") -Recurse -Force -ErrorAction SilentlyContinue
}
$startMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\VERDICT CLI"
Remove-Item $startMenu -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "VERDICT CLI was removed. Open terminals will keep the old PATH until restarted." -ForegroundColor Green
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList "-NoProfile", "-Command", "Start-Sleep 1; Remove-Item -LiteralPath '$installDir' -Recurse -Force"
if (-not $Quiet) { Read-Host "Press Enter to close" | Out-Null }
'@ | Set-Content -Path $uninstallerFile -Encoding UTF8

# ── Phase 5: PATH ────────────────────────────────────────────────────
if (-not $SkipPath) {
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $pathEntries = @($userPath -split ";" | Where-Object { $_ })
    $normalDir = $installDir.TrimEnd("\")
    $alreadyInPath = $pathEntries | Where-Object { $_.TrimEnd("\") -ieq $normalDir }
    if (-not $alreadyInPath) {
        $nextPath = (@($pathEntries) + $installDir) -join ";"
        [Environment]::SetEnvironmentVariable("Path", $nextPath, "User")
        Write-Result "Added $installDir to User PATH."
    } else {
        Write-Result "$installDir already in PATH."
    }
}
$env:Path = "$installDir;$env:Path"
Broadcast-PathChange

# ── Phase 6: Configure server (only for MJS — exe uses same config) ──
if ($hasExe) {
    # verdict.exe reads the same config file; configure it
    & $exeFile config set server $Server
    if ($LASTEXITCODE -ne 0) {
        throw "The CLI was installed, but its server profile could not be configured."
    }
} else {
    & $nodePath $mjsFile config set server $Server
    if ($LASTEXITCODE -ne 0) {
        throw "The CLI was installed, but its server profile could not be configured."
    }
}

# ── Phase 7: Start Menu shortcuts ────────────────────────────────────
if (-not $NoStartMenu) {
    Write-Step "Creating Start menu shortcuts"
    $startMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\VERDICT CLI"
    New-Item -ItemType Directory -Path $startMenu -Force | Out-Null
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut((Join-Path $startMenu "VERDICT CLI.lnk"))
    $shortcut.TargetPath = $env:ComSpec
    $shortcut.Arguments = "/k `"`"$launcherFile`" help`""
    $shortcut.WorkingDirectory = $env:USERPROFILE
    $shortcut.Save()
    $removeShortcut = $shell.CreateShortcut((Join-Path $startMenu "Uninstall VERDICT CLI.lnk"))
    $removeShortcut.TargetPath = "powershell.exe"
    $removeShortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$uninstallerFile`""
    $removeShortcut.Save()
}

Save-Log

# ── Done ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  VERDICT CLI IS READY" -ForegroundColor Green
Write-Host "  Server:  $Server"
Write-Host "  Command: verdict"
if ($hasExe) {
    Write-Host "  Mode:    Standalone executable (no Node.js needed)" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "  Next: open VERDICT Profile, generate a pairing code, then run:" -ForegroundColor Yellow
Write-Host "        verdict connect ABCD-EFGH" -ForegroundColor White
Write-Host ""
Write-Host "  New terminals can use verdict immediately." -ForegroundColor DarkGray
Write-Host "  Log:     $LogFile" -ForegroundColor DarkGray
if (-not $Quiet) {
    Read-Host "Press Enter to close" | Out-Null
}
