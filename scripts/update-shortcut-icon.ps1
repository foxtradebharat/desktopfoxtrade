$sh = New-Object -ComObject WScript.Shell
$lnkPath = [System.IO.Path]::Combine($env:APPDATA, 'Microsoft\Windows\Start Menu\Programs\FoxTrade.lnk')
$icoPath = "D:\ASSSSS\newsamsung\foxtrade\build\icon.ico"
$exePath = "D:\ASSSSS\newsamsung\foxtrade\release\win-unpacked\FoxTrade.exe"

$lnk = $sh.CreateShortcut($lnkPath)
$lnk.TargetPath = $exePath
$lnk.IconLocation = "$icoPath,0"
$lnk.Description = "FoxTrade Trading Journal"
$lnk.Save()
Write-Output "Updated $lnkPath with icon: $icoPath"

# Also check desktop shortcut
$desktopLnk = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'FoxTrade.lnk')
if (Test-Path $desktopLnk) {
    $dLnk = $sh.CreateShortcut($desktopLnk)
    $dLnk.TargetPath = $exePath
    $dLnk.IconLocation = "$icoPath,0"
    $dLnk.Save()
    Write-Output "Updated desktop shortcut $desktopLnk"
}
