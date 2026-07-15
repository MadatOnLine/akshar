# Launch Akshar native mobile app on Android (Pixel 6 emulator = iPhone 13 tier).
# First time only: powershell -ExecutionPolicy Bypass -File .\scripts\install-android-sdk.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$MobileDir = Join-Path $Root "packages\mobile"
$AuthDir = Join-Path $Root "packages\auth"
$AIDir = Join-Path $Root "packages\ai"
$MeshDir = Join-Path $Root "packages\mesh"
$CryptoDir = Join-Path $Root "packages\crypto"
$AvdName = "Akshar_Pixel6"

$env:JWT_SECRET = "akshar-dev-secret-change-in-production-32ch"
$env:SERVICE_API_KEY = "akshar-internal-dev-key"
$env:JAVA_HOME = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { (Get-ChildItem "C:\Program Files\Microsoft\jdk-*" -ErrorAction SilentlyContinue | Select-Object -First 1).FullName }
$env:COUCHDB_URL = "http://127.0.0.1:5984"
$env:COUCHDB_USER = "admin"
$env:COUCHDB_PASSWORD = "admin"
$env:AI_SERVICE_URL = "http://127.0.0.1:8002"
$env:AUTH_SERVICE_URL = "http://127.0.0.1:8001"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Refresh-Path {
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
}

function Find-NodeInstallDir {
    @("${env:ProgramFiles}\nodejs", "$env:LOCALAPPDATA\Programs\nodejs") |
        Where-Object { Test-Path (Join-Path $_ "node.exe") } | Select-Object -First 1
}

function Get-NpmCommand {
    Refresh-Path
    $nodeDir = Find-NodeInstallDir
    if ($nodeDir) { $env:Path = "$nodeDir;$env:Path" }
    $npm = Join-Path $nodeDir "npm.cmd"
    if ($nodeDir -and (Test-Path $npm)) { return $npm }
    throw "Node.js/npm not found. Install from https://nodejs.org/"
}

function Find-AndroidSdk {
    foreach ($p in @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, "$env:LOCALAPPDATA\Android\Sdk")) {
        if ($p -and (Test-Path $p)) { return $p }
    }
    return $null
}

function Test-CouchDb {
    try {
        Invoke-WebRequest -Uri "http://127.0.0.1:5984" -UseBasicParsing -TimeoutSec 3 | Out-Null
        return $true
    } catch { return $false }
}

function Ensure-CouchDb {
    if (Test-CouchDb) {
        Write-Host "CouchDB is running." -ForegroundColor Green
        return
    }
    throw "CouchDB not running on 5984. Run .\start-demo.ps1 once or start CouchDB manually."
}

function Get-Python311 {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        $exe = & py -3.11 -c "import sys; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $exe) { return $exe.Trim() }
    }
    throw "Python 3.11 required for auth/ai services."
}

function Ensure-PythonVenv([string]$PackageDir, [string]$VenvName) {
    $pythonExe = Get-Python311
    $venvPath = Join-Path $PackageDir $VenvName
    $venvPython = Join-Path $venvPath "Scripts\python.exe"
    if (-not (Test-Path $venvPython)) { & $pythonExe -m venv $venvPath }
    & $venvPython -m pip install -q --upgrade pip
    if ($PackageDir -eq $AIDir) {
        & $venvPython -m pip install -q --default-timeout=300 -r (Join-Path $PackageDir "requirements.txt")
    } else {
        & $venvPython -m pip install -q -r (Join-Path $PackageDir "requirements.txt")
    }
    return $venvPython
}

function Start-ServiceScript([string]$Title, [string]$ScriptContent) {
    $runDir = Join-Path $Root ".demo-run"
    New-Item -ItemType Directory -Force -Path $runDir | Out-Null
    $safeTitle = ($Title -replace '[^\w\- ]', '') -replace ' ', '-'
    $scriptPath = Join-Path $runDir "$safeTitle.ps1"
    Set-Content -Path $scriptPath -Value $ScriptContent -Encoding UTF8
    Start-Process powershell -ArgumentList @("-NoExit", "-File", $scriptPath) | Out-Null
}

function Wait-ForHealth([string]$Url, [string]$Label, [int]$TimeoutSeconds = 120) {
    Write-Host "Waiting for $Label ..."
    for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
        try {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
            Write-Host "$Label ready." -ForegroundColor Green
            return
        } catch { Start-Sleep -Seconds 1 }
    }
    throw "$Label not ready: $Url"
}

function Test-PortListening([int]$Port) {
    try {
        return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    } catch { return $false }
}

Set-Location $Root
Write-Host "Akshar Android demo (Pixel 6 = iPhone 13 equivalent tier)" -ForegroundColor Yellow

$sdk = Find-AndroidSdk
if (-not $sdk) {
    Write-Host ""
    Write-Host "Android SDK not found. Run this first (one-time, ~15 min):" -ForegroundColor Yellow
    Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\install-android-sdk.ps1"
    exit 1
}

$adb = Join-Path $sdk "platform-tools\adb.exe"
$emulator = Join-Path $sdk "emulator\emulator.exe"
if (-not ((Test-Path $adb) -and (Test-Path $emulator))) {
    throw "Android SDK incomplete. Rerun .\scripts\install-android-sdk.ps1"
}

$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$platformTools = Join-Path $sdk "platform-tools"
$emulatorDir = Join-Path $sdk "emulator"
$env:Path = "$platformTools;$emulatorDir;$env:Path"

Ensure-CouchDb
$npm = Get-NpmCommand
$authPython = Ensure-PythonVenv $AuthDir ".venv-auth"
$aiPython = Ensure-PythonVenv $AIDir ".venv-ai"

Write-Step "Building crypto + installing mobile deps"
Push-Location $CryptoDir
if (-not (Test-Path "node_modules")) { & $npm install }
& $npm run build
Pop-Location
Push-Location $MeshDir
if (-not (Test-Path "node_modules")) { & $npm install }
Pop-Location
Push-Location $MobileDir
& $npm install
Pop-Location

if (-not (Test-PortListening 8001)) {
    Start-ServiceScript "Akshar Auth :8001" @"
`$host.UI.RawUI.WindowTitle = 'Akshar Auth :8001'
Set-Location '$AuthDir'
`$env:JWT_SECRET = '$env:JWT_SECRET'
`$env:SERVICE_API_KEY = '$env:SERVICE_API_KEY'
`$env:AI_SERVICE_URL = '$env:AI_SERVICE_URL'
`$env:TIER2_REAUTH_INTERVAL_SEC = '120'
`$env:COUCHDB_URL = '$env:COUCHDB_URL'
`$env:COUCHDB_USER = '$env:COUCHDB_USER'
`$env:COUCHDB_PASSWORD = '$env:COUCHDB_PASSWORD'
& '$authPython' -m uvicorn app.main:app --host 127.0.0.1 --port 8001
"@
}
if (-not (Test-PortListening 8002)) {
    Start-ServiceScript "Akshar AI :8002" @"
`$host.UI.RawUI.WindowTitle = 'Akshar AI :8002'
Set-Location '$AIDir'
`$env:JWT_SECRET = '$env:JWT_SECRET'
`$env:SERVICE_API_KEY = '$env:SERVICE_API_KEY'
`$env:COUCHDB_URL = '$env:COUCHDB_URL'
`$env:COUCHDB_USER = '$env:COUCHDB_USER'
`$env:COUCHDB_PASSWORD = '$env:COUCHDB_PASSWORD'
`$env:TIER2_REAUTH_INTERVAL_SEC = '120'
& '$aiPython' -m uvicorn app.main:app --host 127.0.0.1 --port 8002
"@
}
if (-not (Test-PortListening 8003)) {
    Start-ServiceScript "Akshar Mesh :8003" @"
`$host.UI.RawUI.WindowTitle = 'Akshar Mesh :8003'
`$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
Set-Location '$MeshDir'
`$env:JWT_SECRET = '$env:JWT_SECRET'
`$env:SERVICE_API_KEY = '$env:SERVICE_API_KEY'
`$env:COUCHDB_URL = 'http://admin:admin@127.0.0.1:5984'
`$env:AI_SERVICE_URL = '$env:AI_SERVICE_URL'
`$env:AUTH_SERVICE_URL = '$env:AUTH_SERVICE_URL'
& '$npm' run dev
"@
}

Wait-ForHealth "http://127.0.0.1:8001/auth/health" "Auth" 90
Wait-ForHealth "http://127.0.0.1:8002/ai/health" "AI" 180
Wait-ForHealth "http://127.0.0.1:8003/mesh/health" "Mesh" 90

Write-Step "Starting Pixel 6 emulator ($AvdName)"
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$devices = (& $adb devices 2>&1) | Out-String
$ErrorActionPreference = $prevEap
if ($devices -notmatch "emulator-") {
    $avds = & $emulator -list-avds 2>&1
    if ($avds -notmatch $AvdName) {
        throw "AVD '$AvdName' not found. Run .\scripts\install-android-sdk.ps1"
    }
    Start-Process $emulator -ArgumentList @("-avd", $AvdName, "-gpu", "host", "-camera-front", "webcam0", "-camera-back", "webcam0") | Out-Null
    Write-Host "Waiting for emulator to boot (up to 3 min)..."
    $ErrorActionPreference = "Continue"
    & $adb wait-for-device 2>&1 | Out-Null
    for ($i = 0; $i -lt 60; $i++) {
        $boot = (& $adb shell getprop sys.boot_completed 2>&1) | Out-String
        if ($boot -match "1") { break }
        Start-Sleep -Seconds 3
    }
    $ErrorActionPreference = $prevEap
}

Write-Step "Port forwarding (emulator -> your PC backends)"
& $adb reverse tcp:8001 tcp:8001 | Out-Null
& $adb reverse tcp:8002 tcp:8002 | Out-Null
& $adb reverse tcp:8003 tcp:8003 | Out-Null
& $adb reverse tcp:8081 tcp:8081 | Out-Null
& $adb reverse tcp:5984 tcp:5984 | Out-Null

Write-Step "Building and installing Akshar mobile app"
# Short path avoids Windows 260-char limit during native (VisionCamera) builds.
$drive = "A:"
if (-not (Test-Path "${drive}\")) {
    subst $drive $Root 2>$null | Out-Null
}
$env:GRADLE_USER_HOME = "C:\gch"
New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME | Out-Null
$buildRoot = if (Test-Path "${drive}\packages\mobile") { "${drive}\packages\mobile" } else { $MobileDir }

Push-Location $buildRoot
& $npm run android
$code = $LASTEXITCODE
Pop-Location

if ($code -ne 0) {
    Write-Host "Build failed. Common fixes:" -ForegroundColor Yellow
    Write-Host "  - Ensure emulator is fully booted (home screen visible)"
    Write-Host "  - Open Android Studio once and accept SDK licenses"
    Write-Host "  - Rerun: .\start-android-demo.ps1"
    exit $code
}

Write-Host ""
Write-Host "Akshar is running on Android Pixel 6 emulator." -ForegroundColor Green
Write-Host "Device tier: equivalent to iPhone 13 (2021 flagship, 6.4 inch display)"
Write-Host ""
Write-Host "Demo flow on emulator:" -ForegroundColor Cyan
Write-Host "  1. Allow camera (uses your PC webcam in emulator)"
Write-Host "  2. Enroll face + liveness"
Write-Host "  3. Chat, Feed, Profile (trust score)"
Write-Host ""
Write-Host "Physical Android phone instead?" -ForegroundColor Yellow
Write-Host "  1. Enable USB debugging on phone"
Write-Host "  2. Run: .\scripts\prepare-ios-cloud-test.ps1 lan"
Write-Host "  3. Connect USB, rerun: .\start-android-demo.ps1"
