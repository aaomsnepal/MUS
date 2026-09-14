<#
================================================================
  make-deploy.ps1
  Builds a clean upload package for HostingRaja.

  Save this file inside:  D:\X_aaoms\Pramod\kkpramod-site
  Then run it from PowerShell:

      cd "D:\X_aaoms\Pramod\kkpramod-site"
      .\make-deploy.ps1

  Options:
      .\make-deploy.ps1 -NoEnv        leave the .env file out
                                      (set the keys in HostingRaja instead)
      .\make-deploy.ps1 -FreshData    empty the jobs, orders, messages and
                                      posts so the live site starts clean
================================================================
#>

param(
    [switch]$NoEnv,
    [switch]$FreshData
)

$ErrorActionPreference = "Stop"

$Source  = $PSScriptRoot
$OutDir  = Join-Path (Split-Path $Source -Parent) "deploy"
$Stamp   = Get-Date -Format "yyyyMMdd-HHmm"
$Staging = Join-Path $env:TEMP "kkpramod-deploy-$Stamp"
$ZipPath = Join-Path $OutDir "kkpramod-deploy-$Stamp.zip"

Write-Host ""
Write-Host "  Building deploy package" -ForegroundColor Cyan
Write-Host "  from  $Source"
Write-Host ""

# --- sanity check ---------------------------------------------------
if (-not (Test-Path (Join-Path $Source "server.js"))) {
    Write-Host "  server.js not found here. Run this from the project folder." -ForegroundColor Red
    exit 1
}

# --- fresh staging copy ---------------------------------------------
if (Test-Path $Staging) { Remove-Item $Staging -Recurse -Force }
New-Item -ItemType Directory -Path $Staging | Out-Null
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$Skip = @(
    "node_modules",           # HostingRaja installs these itself
    "deploy",
    ".git",
    "data\uploads",           # user uploads, regenerated live
    "data\media"
)

Write-Host "  Copying files..." -ForegroundColor DarkGray
Get-ChildItem -Path $Source -Recurse -Force | Where-Object {
    $rel = $_.FullName.Substring($Source.Length).TrimStart('\')
    $keep = $true
    foreach ($s in $Skip) { if ($rel -eq $s -or $rel.StartsWith("$s\")) { $keep = $false } }
    if ($_.Name -like "*.tmp")        { $keep = $false }
    if ($_.Name -eq "make-deploy.ps1"){ $keep = $false }
    if ($_.Name -eq ".DS_Store")      { $keep = $false }
    $keep
} | ForEach-Object {
    $rel  = $_.FullName.Substring($Source.Length).TrimStart('\')
    $dest = Join-Path $Staging $rel
    if ($_.PSIsContainer) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
    } else {
        $parent = Split-Path $dest -Parent
        if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Copy-Item $_.FullName -Destination $dest -Force
    }
}

# --- keep the empty upload folders so the server does not have to create them
foreach ($d in @("data\uploads", "data\media", "data\product-files")) {
    $p = Join-Path $Staging $d
    if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
}

# --- optional: drop the secrets file --------------------------------
$envFile = Join-Path $Staging ".env"
if ($NoEnv) {
    if (Test-Path $envFile) { Remove-Item $envFile -Force }
    Write-Host "  .env left out - set the keys in the HostingRaja panel" -ForegroundColor Yellow
} elseif (Test-Path $envFile) {
    Write-Host "  .env INCLUDED - this package holds your live payment keys" -ForegroundColor Yellow
}

# --- optional: start the live site with empty records ---------------
if ($FreshData) {
    foreach ($f in @("jobs.json", "orders.json", "messages.json", "posts.json")) {
        $p = Join-Path $Staging "data\$f"
        if (Test-Path $p) { Set-Content -Path $p -Value "[]" -NoNewline }
    }
    Write-Host "  Records cleared - the live site starts empty" -ForegroundColor DarkGray
}

# --- zip it ----------------------------------------------------------
Write-Host "  Compressing..." -ForegroundColor DarkGray
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path (Join-Path $Staging "*") -DestinationPath $ZipPath -Force
Remove-Item $Staging -Recurse -Force

$size  = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)

Write-Host ""
Write-Host "  Done." -ForegroundColor Green
Write-Host "  $ZipPath  ($size MB)"
Write-Host ""
Write-Host "  Upload steps on HostingRaja" -ForegroundColor Cyan
Write-Host "    1. File Manager - upload this zip, then Extract it"
Write-Host "    2. Node App panel:"
Write-Host "         Application root     = the folder you extracted into"
Write-Host "         Application startup  = server.js"
Write-Host "         Node version         = 18 or newer"
Write-Host "    3. Click Run NPM Install, then Start"
if ($NoEnv) {
    Write-Host "    4. Add the environment variables from .env.example"
} else {
    Write-Host "    4. Keys are already inside .env - nothing else to set"
}
Write-Host "    5. Point kkpramod.com.np at the app, then verify in Search Console"
Write-Host ""
Write-Host "  Delete this zip from your PC once it is uploaded." -ForegroundColor DarkGray
Write-Host ""
