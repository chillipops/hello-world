param(
    [Parameter(Mandatory)][string]$AppName,
    [switch]$Silent
)

Write-Host "Searching winget for '$AppName'..."
$search = winget search --query $AppName --accept-source-agreements 2>&1
Write-Host $search

if (-not $Silent) {
    $confirm = Read-Host "Install '$AppName' via winget? [y/N]"
    if ($confirm -notmatch '^[Yy]$') {
        Write-Host "Cancelled."
        exit
    }
}

Write-Host "Installing '$AppName'..."
winget install --query $AppName --accept-package-agreements --accept-source-agreements

$logDir = Join-Path $PSScriptRoot "..\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir "pc-control.log"
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  INSTALL  $AppName" | Add-Content $logFile
