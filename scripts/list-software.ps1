param(
    [string]$Filter = ""
)

if ($Filter) {
    Write-Host "Installed software matching '$Filter':"
    winget list --query $Filter --accept-source-agreements
} else {
    Write-Host "All installed software:"
    winget list --accept-source-agreements
}
