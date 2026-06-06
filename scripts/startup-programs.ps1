param(
    [Parameter(Mandatory)]
    [ValidateSet("list","enable","disable","add","remove")]
    [string]$Action,
    [string]$Name = "",
    [string]$Path = ""
)

$runKeys = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run"
)
$disabledKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"
$startupFolder = [Environment]::GetFolderPath("Startup")

function Get-AllStartupEntries {
    $entries = @()
    foreach ($key in $runKeys) {
        if (Test-Path $key) {
            $props = Get-ItemProperty $key -ErrorAction SilentlyContinue
            $props.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object {
                $entries += [PSCustomObject]@{ Name = $_.Name; Path = $_.Value; Source = $key }
            }
        }
    }
    if (Test-Path $startupFolder) {
        Get-ChildItem $startupFolder | ForEach-Object {
            $entries += [PSCustomObject]@{ Name = $_.BaseName; Path = $_.FullName; Source = "StartupFolder" }
        }
    }
    return $entries
}

switch ($Action) {

    "list" {
        Write-Host ""
        Write-Host "=== Startup Programs ==="
        $entries = Get-AllStartupEntries
        if (-not $entries) {
            Write-Host "No startup entries found."
        } else {
            $entries | ForEach-Object {
                $src = ($_.Source -replace 'HKCU:\\|HKLM:\\|Software\\Microsoft\\Windows\\CurrentVersion\\', '').Split('\')[-1]
                Write-Host "  [$src] $($_.Name)"
                Write-Host "         $($_.Path)"
            }
        }
        Write-Host ""
        Write-Host "Total: $($entries.Count) startup item(s)"
    }

    "add" {
        if (-not $Name -or -not $Path) {
            Write-Host "ERROR: -Name and -Path are required for 'add'."
            Write-Host "Example: startup-programs.ps1 -Action add -Name 'MyApp' -Path 'C:\Apps\myapp.exe'"
            exit 1
        }
        $key = $runKeys[0]  # HKCU
        Set-ItemProperty -Path $key -Name $Name -Value $Path
        Write-Host "Added '$Name' to startup: $Path"

        $logDir = Join-Path $PSScriptRoot "..\logs"
        if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
        "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  STARTUP-ADD  $Name = $Path" | Add-Content (Join-Path $logDir "pc-control.log")
    }

    "remove" {
        if (-not $Name) { Write-Host "ERROR: -Name is required."; exit 1 }
        $found = $false
        foreach ($key in $runKeys) {
            if (Test-Path $key) {
                $val = (Get-ItemProperty $key -ErrorAction SilentlyContinue).$Name
                if ($val) {
                    $confirm = Read-Host "Remove '$Name' ($val) from startup? [y/N]"
                    if ($confirm -notmatch '^[Yy]$') { Write-Host "Cancelled."; exit }
                    Remove-ItemProperty -Path $key -Name $Name -ErrorAction SilentlyContinue
                    Write-Host "Removed '$Name' from startup."
                    $found = $true

                    $logDir = Join-Path $PSScriptRoot "..\logs"
                    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
                    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  STARTUP-REMOVE  $Name" | Add-Content (Join-Path $logDir "pc-control.log")
                    break
                }
            }
        }
        $shortcut = Join-Path $startupFolder "$Name.lnk"
        if (Test-Path $shortcut) {
            $confirm = Read-Host "Remove '$Name' from Startup folder? [y/N]"
            if ($confirm -match '^[Yy]$') { Remove-Item $shortcut -Force; Write-Host "Removed from Startup folder." }
            $found = $true
        }
        if (-not $found) { Write-Host "No startup entry found named '$Name'." }
    }

    "disable" {
        Write-Host "To disable startup items, use Task Manager -> Startup tab, or use 'remove' to delete the entry."
        Write-Host "Run: taskmgr (then go to Startup tab)"
    }

    "enable" {
        Write-Host "To re-enable a startup item that was disabled in Task Manager, use Task Manager -> Startup tab."
        Write-Host "To add a new startup entry, use: startup-programs.ps1 -Action add -Name '<name>' -Path '<path>'"
    }
}
