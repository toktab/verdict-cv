[CmdletBinding()]
param(
    [string]$Output = "",
    [switch]$KeepStaging
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
$installerSource = Join-Path $root "tools\installer"
$cliSource = Join-Path $root "tools\verdict-cli"
$stage = Join-Path $root "target\windows-installer"
$outputFile = if ($Output) {
    [System.IO.Path]::GetFullPath($Output)
} else {
    Join-Path $dist "VERDICT-Setup-Windows-x64.exe"
}

$required = @(
    (Join-Path $dist "verdict.exe"),
    (Join-Path $dist "verdict.exe.sha256"),
    (Join-Path $installerSource "install-verdict.ps1"),
    (Join-Path $installerSource "install-from-payload.cmd"),
    (Join-Path $cliSource "README.txt")
)
foreach ($file in $required) {
    if (-not (Test-Path -LiteralPath $file)) {
        throw "Required installer payload is missing: $file"
    }
}

$iexpress = Join-Path $env:SystemRoot "System32\iexpress.exe"
if (-not (Test-Path -LiteralPath $iexpress)) {
    throw "Windows IExpress is not available on this computer."
}

if (Test-Path -LiteralPath $stage) {
    Remove-Item -LiteralPath $stage -Recurse -Force
}
New-Item -ItemType Directory -Path $stage -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path -Parent $outputFile) -Force | Out-Null
if (Test-Path -LiteralPath $outputFile) {
    Remove-Item -LiteralPath $outputFile -Force
}
if (Test-Path -LiteralPath "$outputFile.sha256") {
    Remove-Item -LiteralPath "$outputFile.sha256" -Force
}

Copy-Item (Join-Path $dist "verdict.exe") $stage
Copy-Item (Join-Path $dist "verdict.exe.sha256") $stage
Copy-Item (Join-Path $installerSource "install-verdict.ps1") $stage
Copy-Item (Join-Path $installerSource "install-from-payload.cmd") $stage
Copy-Item (Join-Path $cliSource "README.txt") $stage

$sedFile = Join-Path $stage "verdict-setup.sed"
$sourceDirectory = $stage.TrimEnd("\") + "\"
$sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3

[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=0
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=
FinishMessage=
TargetName=$outputFile
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
SourceFiles=SourceFiles

[Strings]
InstallPrompt=
FriendlyName=VERDICT CLI Setup for Windows
AppLaunched=install-from-payload.cmd
FILE0=verdict.exe
FILE1=verdict.exe.sha256
FILE2=install-verdict.ps1
FILE3=install-from-payload.cmd
FILE4=README.txt

[SourceFiles]
SourceFiles0=$sourceDirectory

[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
%FILE3%=
%FILE4%=
"@
Set-Content -LiteralPath $sedFile -Value $sed -Encoding ASCII

Write-Host "Building Windows setup package..." -ForegroundColor Cyan
& $iexpress /N /Q $sedFile

# IExpress can return before its detached MakeCAB process has finished writing
# the package. Watch the artifact itself so a successful build is not reported
# as a failure on larger standalone executables.
$deadline = [DateTime]::UtcNow.AddMinutes(10)
while (-not (Test-Path -LiteralPath $outputFile) -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Seconds 2
}
if (-not (Test-Path -LiteralPath $outputFile)) {
    throw "IExpress could not create the Windows setup package."
}

$hash = (Get-FileHash -LiteralPath $outputFile -Algorithm SHA256).Hash.ToLowerInvariant()
$manifest = "$hash  $([System.IO.Path]::GetFileName($outputFile))"
Set-Content -LiteralPath "$outputFile.sha256" -Value $manifest -Encoding ASCII

$sizeMb = [Math]::Round((Get-Item -LiteralPath $outputFile).Length / 1MB, 1)
Write-Host "Created $outputFile ($sizeMb MB)" -ForegroundColor Green
Write-Host "SHA-256: $hash" -ForegroundColor DarkGray

if (-not $KeepStaging -and (Test-Path -LiteralPath $stage)) {
    Remove-Item -LiteralPath $stage -Recurse -Force
}
