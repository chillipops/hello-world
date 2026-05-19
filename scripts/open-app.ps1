param(
    [Parameter(Mandatory)][string]$AppName
)

$known = @{
    "notepad"    = "notepad.exe"
    "calculator" = "calc.exe"
    "paint"      = "mspaint.exe"
    "explorer"   = "explorer.exe"
    "chrome"     = "chrome.exe"
    "firefox"    = "firefox.exe"
    "edge"       = "msedge.exe"
    "word"       = "winword.exe"
    "excel"      = "excel.exe"
    "outlook"    = "outlook.exe"
    "teams"      = "ms-teams.exe"
    "vscode"     = "code.exe"
    "terminal"   = "wt.exe"
    "task manager" = "taskmgr.exe"
    "settings"   = "ms-settings:"
}

$key = $AppName.ToLower()
$exe = $known[$key]

if ($exe) {
    Start-Process $exe
    Write-Host "Opened $AppName."
} else {
    # Fall back to shell search
    try {
        Start-Process $AppName
        Write-Host "Opened $AppName."
    } catch {
        Write-Host "Could not open '$AppName'. Try the exact executable name."
    }
}
