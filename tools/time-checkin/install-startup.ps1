$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $scriptDir "start-hourly.bat"
$startup = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startup "Time Check-in Hourly.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $target
$shortcut.WorkingDirectory = $scriptDir
$shortcut.IconLocation = "$env:SystemRoot\System32\SHELL32.dll,44"
$shortcut.Save()

Write-Host "Installed startup shortcut:"
Write-Host $shortcutPath
