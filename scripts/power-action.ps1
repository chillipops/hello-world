param(
    [Parameter(Mandatory)]
    [ValidateSet("restart","shutdown","sleep","hibernate","lock")]
    [string]$Action,
    [int]$DelaySeconds = 30
)

$descriptions = @{
    restart   = "RESTART the computer (unsaved work will be lost)"
    shutdown  = "SHUT DOWN the computer (unsaved work will be lost)"
    sleep     = "put the computer to SLEEP"
    hibernate = "HIBERNATE the computer"
    lock      = "LOCK the screen"
}

Write-Host "You are about to $($descriptions[$Action])."
$confirm = Read-Host "Confirm? [y/N]"
if ($confirm -notmatch '^[Yy]$') {
    Write-Host "Cancelled."
    exit
}

$logDir = Join-Path $PSScriptRoot "..\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir "pc-control.log"
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  POWER  $($Action.ToUpper())" | Add-Content $logFile

switch ($Action) {
    "restart"   { shutdown /r /t $DelaySeconds /c "Claude Code: scheduled restart" }
    "shutdown"  { shutdown /s /t $DelaySeconds /c "Claude Code: scheduled shutdown" }
    "sleep"     { rundll32.exe powrprof.dll,SetSuspendState 0,1,0 }
    "hibernate" { shutdown /h }
    "lock"      { rundll32.exe user32.dll,LockWorkStation }
}

if ($Action -in @("restart","shutdown")) {
    Write-Host "System will $Action in $DelaySeconds seconds. Run 'shutdown /a' to cancel."
} else {
    Write-Host "$Action initiated."
}
