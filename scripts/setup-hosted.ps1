# MnemoNotes hosted Supabase setup (Windows)
# Run from repo root:  npm run setup:hosted
#
# Optional in .env.local for non-interactive setup:
#   SUPABASE_DB_PASSWORD=...     (Dashboard -> Project Settings -> Database)
#   SUPABASE_ACCESS_TOKEN=sbp_... (Dashboard -> Account -> Access Tokens)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

function Invoke-Supabase {
  param(
    [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
    [string[]]$SupabaseArgs
  )

  Remove-Item Env:SUPABASE_OUTPUT_FORMAT -ErrorAction SilentlyContinue
  Remove-Item Env:CI -ErrorAction SilentlyContinue

  & npx supabase @SupabaseArgs
  $exitCode = $LASTEXITCODE

  if ($exitCode -ne 0) {
    throw "supabase $($SupabaseArgs -join ' ') failed with exit code $exitCode"
  }
}

Write-Host ""
Write-Host "=== MnemoNotes hosted setup ===" -ForegroundColor Cyan
Write-Host ""

if (Test-Path ".env.local") {
  Get-Content ".env.local" | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)\s*=\s*(.*)\s*$') {
      $name = $matches[1].Trim()
      $value = $matches[2].Trim()
      Set-Item -Path "env:$name" -Value $value
    }
  }
  Write-Host "Loaded .env.local" -ForegroundColor Green
}
else {
  Write-Host "Missing .env.local - copy from .env.example first." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Step 1: Validating environment..." -ForegroundColor Cyan
node scripts/validate-env.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Step 2: Checking schema..." -ForegroundColor Cyan
node scripts/check-hosted.mjs

Write-Host ""
Write-Host "Step 3: Pushing migrations..." -ForegroundColor Cyan
$cliReady = $false
$projectRef = $null
if ($env:VITE_SUPABASE_URL -match 'https://([^.]+)\.supabase\.co') {
  $projectRef = $Matches[1]
}

if ($env:SUPABASE_DB_PASSWORD) {
  node scripts/push-hosted-db.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
else {
  Write-Host "SUPABASE_DB_PASSWORD not set — using Supabase CLI (requires auth)." -ForegroundColor Yellow
  Write-Host "Tip: add SUPABASE_DB_PASSWORD to .env.local to skip CLI login for migrations."
  Write-Host ""

  $cliReady = $false

  try {
    Invoke-Supabase @("projects", "list") | Out-Null
    $cliReady = $true
    Write-Host "Supabase CLI already authenticated." -ForegroundColor Green
  }
  catch {
    Write-Host "Supabase CLI not authenticated yet." -ForegroundColor Yellow
  }

  if (-not $cliReady -and $env:SUPABASE_ACCESS_TOKEN) {
    Write-Host "Using SUPABASE_ACCESS_TOKEN from .env.local..."
    try {
      Invoke-Supabase @("login", "--token", $env:SUPABASE_ACCESS_TOKEN) | Out-Null
      $cliReady = $true
      Write-Host "Supabase CLI authenticated via access token." -ForegroundColor Green
    }
    catch {
      Write-Host "Token login failed." -ForegroundColor Yellow
    }
  }

  if (-not $cliReady) {
    Write-Host "Run browser login. If this fails, add SUPABASE_ACCESS_TOKEN to .env.local"
    Write-Host "(Dashboard -> Account -> Access Tokens -> Generate new token)"
    Write-Host ""
    Invoke-Supabase @("login")
    $cliReady = $true
  }

  $projectRef = $null
  if ($env:VITE_SUPABASE_URL -match 'https://([^.]+)\.supabase\.co') {
    $projectRef = $Matches[1]
  }
  if (-not $projectRef) {
    Write-Host "Could not read project ref from VITE_SUPABASE_URL in .env.local." -ForegroundColor Red
    exit 1
  }

  Write-Host ""
  Write-Host "Linking project $projectRef..." -ForegroundColor Cyan
  Invoke-Supabase @("link", "--project-ref", $projectRef) | Out-Null

  try {
    Invoke-Supabase @("db", "push", "--include-seed", "--yes") | Out-Null
  }
  catch {
    Write-Host ""
    Write-Host "If db push fails, run supabase/hosted-bootstrap.sql in Dashboard SQL Editor." -ForegroundColor Yellow
    Write-Host ""
    throw
  }
}

Write-Host ""
Write-Host "Step 4: Deploying Edge Functions..." -ForegroundColor Cyan
if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "Skipping Edge Functions — add SUPABASE_ACCESS_TOKEN to .env.local, then run:" -ForegroundColor Yellow
  Write-Host "  npm run functions:deploy"
}
else {
  if (-not $cliReady) {
    try {
      Invoke-Supabase @("login", "--token", $env:SUPABASE_ACCESS_TOKEN) | Out-Null
      $cliReady = $true
    }
    catch {
      Write-Host "CLI login failed — run npm run functions:deploy after fixing SUPABASE_ACCESS_TOKEN." -ForegroundColor Yellow
      $cliReady = $false
    }
  }

  if ($cliReady) {
    if (-not $projectRef) {
      if ($env:VITE_SUPABASE_URL -match 'https://([^.]+)\.supabase\.co') {
        $projectRef = $Matches[1]
      }
    }
    if ($projectRef) {
      Invoke-Supabase @("link", "--project-ref", $projectRef) | Out-Null
    }

    $functions = @(
      @{ Name = "admin-records"; Public = $false },
      @{ Name = "admin-provision-company"; Public = $false },
      @{ Name = "admin-invite-owner"; Public = $false },
      @{ Name = "invite-personnel"; Public = $false },
      @{ Name = "accept-invite"; Public = $true }
    )

    foreach ($fn in $functions) {
      Write-Host "  Deploying $($fn.Name)..." -ForegroundColor Cyan
      if ($fn.Public) {
        Invoke-Supabase @("functions", "deploy", $fn.Name, "--no-verify-jwt")
      }
      else {
        Invoke-Supabase @("functions", "deploy", $fn.Name)
      }
    }
  }
}

Write-Host ""
Write-Host "Step 5: Creating platform admin..." -ForegroundColor Cyan
node scripts/admin-create-from-env.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Step 6: Configure Auth URLs in Dashboard:" -ForegroundColor Cyan
Write-Host "  Authentication -> URL Configuration"
Write-Host "  Site URL: http://localhost:5173"
Write-Host "  Redirect URLs: http://localhost:5173/accept-invite"

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
Write-Host "Login: http://localhost:5173/login"
Write-Host "Admin: http://localhost:5173/admin"
Write-Host ""
