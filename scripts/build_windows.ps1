$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
npm run build:engine
if ($LASTEXITCODE -ne 0) { throw 'Engine build failed' }
if (Test-Path -LiteralPath (Join-Path $PWD '.build-deps/PyInstaller')) { $env:PYTHONPATH = (Join-Path $PWD '.build-deps') }
$releaseDirectory = Join-Path $PWD ('dist/releases/' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
python -m PyInstaller --noconfirm --distpath $releaseDirectory NoitaSeedLab.spec
if ($LASTEXITCODE -ne 0) { throw 'PyInstaller build failed' }
Write-Host ('Ready: ' + (Join-Path $releaseDirectory 'NoitaSeedLab/NoitaSeedLab.exe'))
