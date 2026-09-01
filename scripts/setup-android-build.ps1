# Build MnemoNotes Android APK using the same Supabase project as desktop.
# Run from repo root:  powershell -ExecutionPolicy Bypass -File scripts/setup-android-build.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host ""
Write-Host "=== MnemoNotes Android build ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Ensure production env for Vite build
if (-not (Test-Path ".env.production.local")) {
  if (Test-Path ".env.local") {
    Write-Host "Creating .env.production.local from .env.local (VITE_* only)..." -ForegroundColor Yellow
    Get-Content ".env.local" | Where-Object {
      $_ -match '^\s*VITE_' -or $_ -match '^\s*#'
    } | Set-Content ".env.production.local"
    Write-Host "Created .env.production.local" -ForegroundColor Green
  }
  else {
    Write-Host "Missing .env.production.local and .env.local" -ForegroundColor Red
    Write-Host "Copy .env.production.local.example → .env.production.local and fill Supabase values."
    exit 1
  }
}
else {
  Write-Host "Using existing .env.production.local" -ForegroundColor Green
}

# Step 2: Prefer JDK 21+ for Capacitor 8 / Gradle
$jdk21 = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
$jdk17 = "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
$jdkHome = if (Test-Path $jdk21) { $jdk21 } elseif (Test-Path $jdk17) { $jdk17 } else { $null }
if ($jdkHome) {
  $env:JAVA_HOME = $jdkHome
  $env:Path = "$jdkHome\bin;$env:Path"
  Write-Host "JAVA_HOME = $jdkHome" -ForegroundColor Green
}
else {
  Write-Host "JDK 21 not found" -ForegroundColor Yellow
  Write-Host "Install: winget install Microsoft.OpenJDK.21"
  java -version
}

$sdkPath = "$env:LOCALAPPDATA\Android\Sdk"
if (Test-Path $sdkPath) {
  $env:ANDROID_HOME = $sdkPath
  $escaped = $sdkPath -replace '\\', '\\'
  if (-not (Test-Path "android\local.properties")) {
    "sdk.dir=$($sdkPath -replace '\\', '\\\\')" | Set-Content "android\local.properties"
    Write-Host "ANDROID_HOME = $sdkPath" -ForegroundColor Green
  }
}
else {
  Write-Host "Android SDK not found. Install Android Studio first." -ForegroundColor Yellow
}

# Step 3: Build web + sync Capacitor
Write-Host ""
Write-Host "Building web assets and syncing Android..." -ForegroundColor Cyan
corepack pnpm build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npx cap sync android

# Step 4: Assemble debug APK
Write-Host ""
Write-Host "Assembling debug APK..." -ForegroundColor Cyan
Push-Location android
try {
  .\gradlew.bat assembleDebug
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
  Pop-Location
}

$apk = "android\app\build\outputs\apk\debug\mnemonotes-app.apk"
if (Test-Path $apk) {
  Write-Host ""
  Write-Host "Success: $apk" -ForegroundColor Green
  Write-Host "Install on device: adb install -r $apk"
}
else {
  Write-Host "APK not found at expected path." -ForegroundColor Red
  exit 1
}
