$startup = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startup "Time Check-in Hourly.lnk"

if (Test-Path $shortcutPath) {
  Remove-Item -LiteralPath $shortcutPath
  Write-Host "Removed startup shortcut:"
  Write-Host $shortcutPath
} else {
  Write-Host "Startup shortcut was not found."
}
