param(
    [Parameter(Mandatory)]
    [ValidateSet("status","wifi","ip","ping")]
    [string]$Action,
    [string]$Target = "google.com"
)

switch ($Action) {

    "status" {
        Write-Host ""
        Write-Host "=== Network Adapters ==="
        Get-NetAdapter | Sort-Object Status | ForEach-Object {
            $speed = if ($_.LinkSpeed) { $_.LinkSpeed } else { "N/A" }
            Write-Host "$($_.Name.PadRight(30)) $($_.Status.PadRight(12)) $speed  [$($_.InterfaceDescription)]"
        }
    }

    "wifi" {
        Write-Host ""
        Write-Host "=== Wi-Fi Information ==="
        $raw = netsh wlan show interfaces 2>&1
        if ($raw -match "There is no wireless interface") {
            Write-Host "No wireless adapter found."
        } else {
            $raw | Where-Object { $_ -match "SSID|Signal|Authentication|State|Radio" } |
                ForEach-Object { Write-Host $_.Trim() }
        }
        Write-Host ""
        Write-Host "--- Available Networks ---"
        netsh wlan show networks mode=bssid 2>&1 |
            Where-Object { $_ -match "SSID|Signal|Authentication" } |
            ForEach-Object { Write-Host $_.Trim() }
    }

    "ip" {
        Write-Host ""
        Write-Host "=== IP Configuration ==="
        Get-NetIPConfiguration | Where-Object { $_.IPv4Address } | ForEach-Object {
            Write-Host "Adapter   : $($_.InterfaceAlias)"
            Write-Host "IPv4      : $($_.IPv4Address.IPAddress)"
            Write-Host "Gateway   : $($_.IPv4DefaultGateway.NextHop)"
            Write-Host "DNS       : $($_.DNSServer.ServerAddresses -join ', ')"
            Write-Host ""
        }
        try {
            $pub = (Invoke-RestMethod -Uri "https://api.ipify.org?format=json" -TimeoutSec 5).ip
            Write-Host "Public IP : $pub"
        } catch {
            Write-Host "Public IP : (could not reach ipify.org)"
        }
    }

    "ping" {
        Write-Host "Pinging $Target..."
        $result = Test-Connection -ComputerName $Target -Count 4 -ErrorAction SilentlyContinue
        if ($result) {
            $avg = ($result | Measure-Object -Property ResponseTime -Average).Average
            Write-Host "Host      : $Target"
            Write-Host "Sent      : 4  Received: $($result.Count)  Lost: $(4 - $result.Count)"
            Write-Host "Avg RTT   : $([math]::Round($avg, 1)) ms"
            Write-Host "Min/Max   : $($result | Measure-Object ResponseTime -Minimum | Select-Object -ExpandProperty Minimum) ms / $($result | Measure-Object ResponseTime -Maximum | Select-Object -ExpandProperty Maximum) ms"
        } else {
            Write-Host "No response from $Target — host may be unreachable."
        }
    }
}
