$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Run-Step([string]$Name, [string]$Directory, [scriptblock]$Command) {
  Write-Host "`n== $Name ==" -ForegroundColor Cyan
  Push-Location $Directory
  try {
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Name failed with exit code $LASTEXITCODE." }
  } finally {
    Pop-Location
  }
}

Run-Step 'Company portal tests' (Join-Path $root 'company-admin\frontend') { npm.cmd test }
Run-Step 'Super Admin tests' (Join-Path $root 'super-admin\frontend') { npm.cmd test }

$backendTests = Get-ChildItem -LiteralPath (Join-Path $root 'backend\tests') -Filter '*.test.mjs' |
  Where-Object Name -ne 'device-admission.test.mjs' |
  ForEach-Object FullName
Run-Step 'Backend core tests' (Join-Path $root 'backend') { node --test $backendTests }

Run-Step 'Company portal production build' (Join-Path $root 'company-admin\frontend') { npm.cmd run build }
Run-Step 'Super Admin production build' (Join-Path $root 'super-admin\frontend') { npm.cmd run build }

Write-Host "`nWeb platform source verification passed." -ForegroundColor Green
