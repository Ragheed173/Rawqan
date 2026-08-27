$ErrorActionPreference = 'Stop'

$edgeCandidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
)
$edgePath = $edgeCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1

if (-not $edgePath) {
    Write-Host 'Microsoft Edge was not found. Install Edge, then run this setup again.' -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}

$desktopPath = [Environment]::GetFolderPath('Desktop')
$profilePath = Join-Path $env:LOCALAPPDATA 'RawaqanPOS\EdgeProfile'
$shortcutPath = Join-Path $desktopPath 'Rawaqan POS.lnk'
$posUrl = 'https://rawqan-frontend-sigma.vercel.app/pos'

New-Item -ItemType Directory -Path $profilePath -Force | Out-Null

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $edgePath
$shortcut.Arguments = "--user-data-dir=`"$profilePath`" --app=`"$posUrl`" --start-maximized --kiosk-printing --no-first-run --no-default-browser-check"
$shortcut.WorkingDirectory = Split-Path -Parent $edgePath
$shortcut.IconLocation = "$edgePath,0"
$shortcut.Description = 'Rawaqan POS - direct receipt printing'
$shortcut.Save()

$posPrinter = Get-Printer -Name 'POS-80' -ErrorAction SilentlyContinue
if ($posPrinter) {
    $network = New-Object -ComObject WScript.Network
    $network.SetDefaultPrinter('POS-80')
    Write-Host 'POS-80 is now the default printer.' -ForegroundColor Green
} else {
    Write-Host 'POS-80 was not found. Set the thermal receipt printer as the Windows default printer before taking payments.' -ForegroundColor Yellow
    Write-Host 'Available printers:' -ForegroundColor Yellow
    Get-Printer | Select-Object -ExpandProperty Name | ForEach-Object { Write-Host "  - $_" }
}

Write-Host ''
Write-Host 'Rawaqan POS was installed on the cashier desktop.' -ForegroundColor Green
Write-Host 'Always open it from the Rawaqan POS desktop shortcut.'
Write-Host 'Sign in once, initialize offline mode, and print one test receipt.'
Write-Host ''

Start-Process -FilePath $shortcutPath
Read-Host 'Press Enter after Rawaqan POS opens'
