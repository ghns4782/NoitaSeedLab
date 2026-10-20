param(
    [string]$Python = 'python',
    [string]$ReleaseName = ('slim-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if ($ReleaseName -notmatch '^[A-Za-z0-9][A-Za-z0-9_-]*$') { throw 'Invalid release folder name' }
if (Test-Path -LiteralPath "dist/releases/$ReleaseName") { throw 'Release folder already exists; choose a new ReleaseName' }
$hostPython = (Get-Command $Python).Source
$envPython = Join-Path $PWD '.build-env/Scripts/python.exe'
function Check-Exit { if ($LASTEXITCODE -ne 0) { throw "Command failed: $LASTEXITCODE" } }
if (!(Test-Path -LiteralPath $envPython)) {
    & $hostPython -m venv --without-pip .build-env
    Check-Exit
}
& $envPython -c 'import sys,struct; assert sys.version_info[:2]==(3,13) and struct.calcsize("P")==8, "Slim wheel requires CPython 3.13 x64"'
Check-Exit
& $hostPython -m pip --python .build-env install -r requirements-slim.lock.txt
Check-Exit
$wheel = Join-Path $PWD '.native-build/wheels/numpy-2.5.4-cp313-cp313-win_amd64.whl'
if (!(Test-Path -LiteralPath $wheel)) {
    $originalPath = $env:PATH
    try {
        $env:PATH = (Join-Path $PWD '.build-env/Scripts') + ';' + $env:PATH
        & $hostPython -m pip --python .build-env wheel numpy==2.5.4 --no-binary=numpy --no-deps --no-build-isolation '-Csetup-args=-Dblas=none' '-Csetup-args=-Dlapack=none' '-Csetup-args=-Dallow-noblas=true' '-Csetup-args=--vsenv' '-Ccompile-args=-j4' --wheel-dir .native-build/wheels
        Check-Exit
    } finally { $env:PATH = $originalPath }
}
& $hostPython -m pip --python .build-env install --force-reinstall --no-deps --no-index $wheel
Check-Exit
& $envPython -c 'import numpy as n; c=n.show_config(mode="dicts"); assert c["Build Dependencies"]["blas"]["name"]=="none"'
Check-Exit
node scripts/build-engine.mjs --audit
Check-Exit
$originalPythonPath = $env:PYTHONPATH
try {
    $env:PYTHONPATH = ''
    & $envPython -m PyInstaller --noconfirm --distpath "dist/releases/$ReleaseName" NoitaSeedLab.spec
    Check-Exit
} finally { $env:PYTHONPATH = $originalPythonPath }
Write-Output "Built dist/releases/$ReleaseName/NoitaSeedLab; run regression and frozen self-test before distributing."
