# Copy google-services.json from Firebase into the Android app module and rebuild.
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/install-google-services.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/install-google-services.ps1 -SourcePath "$env:USERPROFILE\Downloads\google-services.json"

param(
  [string]$SourcePath = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$target = Join-Path (Get-Location) "android\app\google-services.json"
$expectedPackage = "com.mnemonotes.app"

if (-not $SourcePath) {
  $candidates = @(
    (Join-Path $env:USERPROFILE "Downloads\google-services.json"),
    (Join-Path (Get-Location) "google-services.json")
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      $SourcePath = $candidate
      break
    }
  }
}

if ($SourcePath -and (Test-Path $SourcePath)) {
  $json = Get-Content $SourcePath -Raw | ConvertFrom-Json
  $packageName = $json.client[0].client_info.android_client_info.package_name
  if ($packageName -ne $expectedPackage) {
    Write-Host "ERROR: google-services.json package_name is '$packageName' but must be '$expectedPackage'" -ForegroundColor Red
    exit 1
  }
  Copy-Item $SourcePath $target -Force
  Write-Host "Installed $SourcePath -> $target" -ForegroundColor Green
}
elseif (-not (Test-Path $target)) {
  Write-Host "No google-services.json found." -ForegroundColor Red
  Write-Host ""
  Write-Host "Download from Firebase Console:"
  Write-Host "  1. https://console.firebase.google.com/"
  Write-Host "  2. Project settings -> Your apps -> Android (com.mnemonotes.app)"
  Write-Host "  3. Download google-services.json"
  Write-Host "  4. Re-run: scripts/install-google-services.ps1 -SourcePath `"path\to\google-services.json`""
  exit 1
}
else {
  Write-Host "Using existing $target" -ForegroundColor Green
  $json = Get-Content $target -Raw | ConvertFrom-Json
  Write-Host "  project_id: $($json.project_info.project_id)"
  Write-Host "  package_name: $($json.client[0].client_info.android_client_info.package_name)"
}

Write-Host ""
Write-Host "Rebuilding APK..." -ForegroundColor Cyan
& "$PSScriptRoot\setup-android-build.ps1"
