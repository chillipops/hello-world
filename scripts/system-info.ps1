$os  = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$ram = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
$ramFree = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
$disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3"

Write-Host ""
Write-Host "=== System Information ==="
Write-Host "OS       : $($os.Caption) ($($os.OSArchitecture))"
Write-Host "Build    : $($os.BuildNumber)"
Write-Host "CPU      : $($cpu.Name)"
Write-Host "Cores    : $($cpu.NumberOfLogicalProcessors) logical / $($cpu.NumberOfCores) physical"
Write-Host "RAM      : ${ramFree} GB free / ${ram} GB total"
Write-Host ""
Write-Host "Disk Usage:"
foreach ($disk in $disks) {
    $size  = [math]::Round($disk.Size / 1GB, 1)
    $free  = [math]::Round($disk.FreeSpace / 1GB, 1)
    $used  = [math]::Round(($disk.Size - $disk.FreeSpace) / 1GB, 1)
    $pct   = [math]::Round(($disk.Size - $disk.FreeSpace) / $disk.Size * 100)
    Write-Host "  $($disk.DeviceID)  ${used}GB used / ${size}GB total  (${pct}% full)  — ${free}GB free"
}
Write-Host ""
Write-Host "Uptime   : $((Get-Date) - $os.LastBootUpTime | ForEach-Object { '{0}d {1}h {2}m' -f $_.Days, $_.Hours, $_.Minutes })"
