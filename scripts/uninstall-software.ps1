param(
    [Parameter(Mandatory)][string]$AppName
)

Write-Host "Searching for installed package matching '$AppName'..."
$search = winget list --query $AppName 2>&1
Write-Host $search

$confirm = Read-Host "Uninstall '$AppName'? This cannot be undone. [y/N]"
if ($confirm -notmatch '^[Yy]$') {
    Write-Host "Cancelled."
    exit
}

Write-Host "Uninstalling '$AppName'..."
winget uninstall --query $AppName --accept-source-agreements

$logDir = Join-Path $PSScriptRoot "..\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir "pc-control.log"
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  UNINSTALL  $AppName" | Add-Content $logFile
