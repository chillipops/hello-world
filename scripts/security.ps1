param(
    [Parameter(Mandatory)]
    [ValidateSet("scan","status","firewall","connections","events")]
    [string]$Action
)

switch ($Action) {

    "scan" {
        Write-Host "Starting Windows Defender quick scan (runs in background)..."
        try {
            Start-MpScan -ScanType QuickScan -AsJob | Out-Null
            Write-Host "Scan started. Check 'security.ps1 -Action status' for results when complete."
        } catch {
            Write-Host "ERROR: Could not start scan. Make sure Windows Defender is enabled and you have admin rights."
            Write-Host $_.Exception.Message
        }
    }

    "status" {
        try {
            $mp = Get-MpComputerStatus
            Write-Host ""
            Write-Host "=== Windows Defender Status ==="
            Write-Host "Defender Enabled       : $($mp.AntivirusEnabled)"
            Write-Host "Real-Time Protection   : $($mp.RealTimeProtectionEnabled)"
            Write-Host "Last Quick Scan        : $($mp.QuickScanEndTime)"
            Write-Host "Last Full Scan         : $($mp.FullScanEndTime)"
            Write-Host "Definition Version     : $($mp.AntivirusSignatureVersion)"
            Write-Host "Definitions Updated    : $($mp.AntivirusSignatureLastUpdated)"
            Write-Host "Threats Found          : $($mp.QuickScanOverdue)"
            $threats = Get-MpThreatDetection -ErrorAction SilentlyContinue
            if ($threats) {
                Write-Host ""
                Write-Host "Active Threats:"
                $threats | Select-Object -First 10 | ForEach-Object {
                    Write-Host "  [$($_.InitialDetectionTime)] $($_.ThreatName) - $($_.Resources)"
                }
            } else {
                Write-Host "Active Threats          : None detected"
            }
        } catch {
            Write-Host "ERROR: Could not retrieve Defender status. Run as administrator."
        }
    }

    "firewall" {
        Write-Host ""
        Write-Host "=== Windows Firewall Status ==="
        Get-NetFirewallProfile | ForEach-Object {
            $state = if ($_.Enabled) { "ON" } else { "OFF" }
            Write-Host "$($_.Name.PadRight(10)) : $state  (Inbound: $($_.DefaultInboundAction), Outbound: $($_.DefaultOutboundAction))"
        }
    }

    "connections" {
        Write-Host ""
        Write-Host "=== Active Network Connections ==="
        $procs = Get-Process | Select-Object Id, Name
        Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue |
            Sort-Object RemoteAddress |
            ForEach-Object {
                $proc = $procs | Where-Object Id -eq $_.OwningProcess | Select-Object -First 1
                $name = if ($proc) { $proc.Name } else { "unknown" }
                Write-Host "  $($_.LocalAddress):$($_.LocalPort)  ->  $($_.RemoteAddress):$($_.RemotePort)  [$name]"
            }
    }

    "events" {
        Write-Host ""
        Write-Host "=== Recent Security Events (last 20) ==="
        try {
            Get-EventLog -LogName Security -Newest 20 -ErrorAction Stop |
                ForEach-Object {
                    Write-Host "[$($_.TimeGenerated)] ID:$($_.EventID)  $($_.Message -split "`n" | Select-Object -First 1)"
                }
        } catch {
            Write-Host "ERROR: Could not read Security event log. Run as administrator."
        }
    }
}
