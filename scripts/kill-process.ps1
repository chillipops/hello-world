param(
    [Parameter(Mandatory)][string]$ProcessName
)

# Never kill critical system processes
$protected = @('lsass','csrss','winlogon','smss','wininit','services','svchost','system','registry')
if ($protected -contains $ProcessName.ToLower() -or $protected -contains ($ProcessName -replace '\.exe$','').ToLower()) {
    Write-Host "ERROR: '$ProcessName' is a protected system process and cannot be terminated."
    exit 1
}

$procs = Get-Process -Name ($ProcessName -replace '\.exe$','') -ErrorAction SilentlyContinue
if (-not $procs) {
    Write-Host "No running process found matching '$ProcessName'."
    exit
}

Write-Host "Found $($procs.Count) process(es):"
$procs | ForEach-Object { Write-Host "  PID $($_.Id)  $($_.Name)  $($_.MainWindowTitle)" }

$confirm = Read-Host "Kill these process(es)? [y/N]"
if ($confirm -notmatch '^[Yy]$') {
    Write-Host "Cancelled."
    exit
}

$procs | Stop-Process -Force
Write-Host "Terminated $($procs.Count) process(es)."

$logDir = Join-Path $PSScriptRoot "..\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir "pc-control.log"
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  KILL-PROCESS  $ProcessName (PIDs: $($procs.Id -join ', '))" | Add-Content $logFile
