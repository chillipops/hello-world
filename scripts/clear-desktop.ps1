param(
    [switch]$HideIcons,
    [switch]$Archive
)

$desktop = [Environment]::GetFolderPath("Desktop")

if ($HideIcons) {
    $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced"
    $current = (Get-ItemProperty $regPath).HideIcons
    $newVal = if ($current -eq 1) { 0 } else { 1 }
    Set-ItemProperty $regPath -Name HideIcons -Value $newVal
    $state = if ($newVal -eq 1) { "hidden" } else { "visible" }
    & rundll32.exe user32.dll, UpdatePerUserSystemParameters
    Write-Host "Desktop icons are now $state."
    exit
}

$items = Get-ChildItem -Path $desktop -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne "desktop.ini" }

if (-not $items) {
    Write-Host "Desktop is already empty."
    exit
}

Write-Host "Items on desktop:"
$items | ForEach-Object { Write-Host "  $($_.Name)" }
Write-Host ""

if (-not $Archive) {
    $confirm = Read-Host "Move all $($items.Count) item(s) to Desktop\Archive? [y/N]"
    if ($confirm -notmatch '^[Yy]$') {
        Write-Host "Cancelled."
        exit
    }
}

$archivePath = Join-Path $desktop "Archive"
if (-not (Test-Path $archivePath)) {
    New-Item -ItemType Directory -Path $archivePath | Out-Null
}

$items | Where-Object { $_.FullName -ne $archivePath } | ForEach-Object {
    Move-Item -Path $_.FullName -Destination $archivePath -Force
}

$logDir = Join-Path $PSScriptRoot "..\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir "pc-control.log"
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  CLEAR-DESKTOP  Moved $($items.Count) item(s) to Archive" | Add-Content $logFile

Write-Host "Done. Moved $($items.Count) item(s) to $archivePath"
