param(
    [Parameter(Mandatory)]
    [ValidateSet("list","run","create","delete","enable","disable")]
    [string]$Action,
    [string]$Name = "",
    [string]$Command = "",
    [string]$At = "",
    [string]$Repeat = ""
)

switch ($Action) {

    "list" {
        Write-Host ""
        Write-Host "=== Scheduled Tasks (non-Microsoft) ==="
        $tasks = Get-ScheduledTask | Where-Object { $_.TaskPath -notmatch '\\Microsoft\\' } |
            Sort-Object State, TaskName
        if (-not $tasks) {
            Write-Host "No custom scheduled tasks found."
        } else {
            $tasks | ForEach-Object {
                $info = Get-ScheduledTaskInfo -TaskName $_.TaskName -TaskPath $_.TaskPath -ErrorAction SilentlyContinue
                $last = if ($info.LastRunTime -and $info.LastRunTime -ne [datetime]::MinValue) { $info.LastRunTime.ToString("yyyy-MM-dd HH:mm") } else { "Never" }
                $next = if ($info.NextRunTime -and $info.NextRunTime -ne [datetime]::MinValue) { $info.NextRunTime.ToString("yyyy-MM-dd HH:mm") } else { "N/A" }
                Write-Host "  [$($_.State.ToString().PadRight(8))] $($_.TaskName)"
                Write-Host "              Last: $last   Next: $next"
            }
        }
        Write-Host ""
        Write-Host "Total: $($tasks.Count) task(s)"
    }

    "run" {
        if (-not $Name) { Write-Host "ERROR: -Name is required."; exit 1 }
        try {
            Start-ScheduledTask -TaskName $Name -ErrorAction Stop
            Write-Host "Task '$Name' triggered successfully."
        } catch {
            Write-Host "ERROR: Could not run task '$Name'. Check the name with 'list' first."
            Write-Host $_.Exception.Message
        }
    }

    "create" {
        if (-not $Name -or -not $Command) {
            Write-Host "ERROR: -Name and -Command are required."
            Write-Host "Example (one-time): scheduled-tasks.ps1 -Action create -Name 'Backup' -Command 'C:\backup.bat' -At '2024-12-01 22:00'"
            Write-Host "Example (daily):    scheduled-tasks.ps1 -Action create -Name 'Backup' -Command 'C:\backup.bat' -At '22:00' -Repeat Daily"
            exit 1
        }

        $action = New-ScheduledTaskAction -Execute $Command

        if ($Repeat -eq "Daily" -and $At) {
            $time = [datetime]::ParseExact($At, "HH:mm", $null)
            $trigger = New-ScheduledTaskTrigger -Daily -At $time
        } elseif ($Repeat -eq "Weekly" -and $At) {
            $time = [datetime]::ParseExact($At, "HH:mm", $null)
            $trigger = New-ScheduledTaskTrigger -Weekly -At $time -DaysOfWeek Monday
        } elseif ($At) {
            try {
                $runAt = [datetime]::Parse($At)
                $trigger = New-ScheduledTaskTrigger -Once -At $runAt
            } catch {
                Write-Host "ERROR: Could not parse date '$At'. Use format 'yyyy-MM-dd HH:mm' or 'HH:mm'"
                exit 1
            }
        } else {
            Write-Host "ERROR: -At is required (e.g. '2024-12-01 22:00' or '22:00' with -Repeat Daily)"
            exit 1
        }

        $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 2)
        Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
        Write-Host "Task '$Name' created successfully."

        $logDir = Join-Path $PSScriptRoot "..\logs"
        if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
        "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  TASK-CREATE  $Name  CMD:$Command  AT:$At" | Add-Content (Join-Path $logDir "pc-control.log")
    }

    "delete" {
        if (-not $Name) { Write-Host "ERROR: -Name is required."; exit 1 }
        $task = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
        if (-not $task) { Write-Host "No task found named '$Name'."; exit }

        $confirm = Read-Host "Delete scheduled task '$Name'? This cannot be undone. [y/N]"
        if ($confirm -notmatch '^[Yy]$') { Write-Host "Cancelled."; exit }

        Unregister-ScheduledTask -TaskName $Name -Confirm:$false
        Write-Host "Task '$Name' deleted."

        $logDir = Join-Path $PSScriptRoot "..\logs"
        if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
        "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  TASK-DELETE  $Name" | Add-Content (Join-Path $logDir "pc-control.log")
    }

    "enable" {
        if (-not $Name) { Write-Host "ERROR: -Name is required."; exit 1 }
        Enable-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue | Out-Null
        Write-Host "Task '$Name' enabled."
    }

    "disable" {
        if (-not $Name) { Write-Host "ERROR: -Name is required."; exit 1 }
        Disable-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue | Out-Null
        Write-Host "Task '$Name' disabled."
    }
}
