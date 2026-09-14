# Run this from anywhere in PowerShell (Win+X -> Terminal)

$project = "D:\X_aaoms\Pramod\kkpramod-site"
Set-Location $project

Write-Host "Node version:" (node -v)
Write-Host "npm version:" (npm -v)

Write-Host "`nInstalling dependencies..."
npm install --omit=dev

if (Test-Path ".\node_modules\express") {
    Write-Host "`nExpress installed OK." -ForegroundColor Green
} else {
    Write-Host "`nnode_modules\express not found - check the npm install output above for errors." -ForegroundColor Red
    exit 1
}

$zipPath = Join-Path (Split-Path $project -Parent) "kkpramod-site-deploy.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }

Write-Host "`nZipping project (including node_modules) to $zipPath ..."
Compress-Archive -Path (Join-Path $project '*') -DestinationPath $zipPath -Force

Write-Host "`nDone. Upload this file to HostingRaja:" -ForegroundColor Cyan
Write-Host $zipPath
