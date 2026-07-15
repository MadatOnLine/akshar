# Akshar mobile demo launcher (Windows)
# Starts backends + Metro. Launches native Android if SDK is installed,
# otherwise opens an iPhone 13-sized presentation frame in the browser.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$MobileDir = Join-Path $Root "packages\mobile"
$AuthDir = Join-Path $Root "packages\auth"
$AIDir = Join-Path $Root "packages\ai"
$MeshDir = Join-Path $Root "packages\mesh"
$CryptoDir = Join-Path $Root "packages\crypto"

$env:JWT_SECRET = "akshar-dev-secret-change-in-production-32ch"
$env:SERVICE_API_KEY = "akshar-internal-dev-key"
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
    @(
        "${env:ProgramFiles}\nodejs",
        "${env:ProgramFiles(x86)}\nodejs",
        "$env:LOCALAPPDATA\Programs\nodejs"
    ) | Where-Object { $_ -and (Test-Path (Join-Path $_ "node.exe")) } | Select-Object -First 1
}

function Get-NodeExe {
    Refresh-Path
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $nodeDir = Find-NodeInstallDir
    if ($nodeDir) {
        $env:Path = "$nodeDir;$env:Path"
        return (Join-Path $nodeDir "node.exe")
    }
    throw "Node.js 20+ is required. Install from https://nodejs.org/"
}

function Get-NpmCommand {
    Refresh-Path
    $nodeDir = Find-NodeInstallDir
    if ($nodeDir) { $env:Path = "$nodeDir;$env:Path" }
    if ($nodeDir -and (Test-Path (Join-Path $nodeDir "npm.cmd"))) {
        return (Join-Path $nodeDir "npm.cmd")
    }
    throw "npm was not found. Reinstall Node.js LTS."
}

function Test-CouchDb {
    try {
        Invoke-WebRequest -Uri "http://127.0.0.1:5984" -UseBasicParsing -TimeoutSec 3 | Out-Null
        return $true
    } catch { return $false }
}

function Ensure-CouchDb {
    if (Test-CouchDb) {
        Write-Host "CouchDB is already running on port 5984." -ForegroundColor Green
        return
    }
    throw "CouchDB is not running on port 5984. Start it first, or run .\start-demo.ps1 once to verify your setup."
}

function Get-Python311 {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        $exe = & py -3.11 -c "import sys; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $exe) { return $exe.Trim() }
    }
    throw "Python 3.11 is required for auth/ai services."
}

function Ensure-PythonVenv([string]$PackageDir, [string]$VenvName) {
    $pythonExe = Get-Python311
    $venvPath = Join-Path $PackageDir $VenvName
    $venvPython = Join-Path $venvPath "Scripts\python.exe"
    if (-not (Test-Path $venvPython)) {
        & $pythonExe -m venv $venvPath
    }
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
    Write-Host "Waiting for $Label at $Url ..."
    for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
        try {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
            Write-Host "$Label is ready." -ForegroundColor Green
            return
        } catch { Start-Sleep -Seconds 1 }
    }
    throw "$Label did not become ready within ${TimeoutSeconds}s ($Url)"
}

function Find-AndroidSdk {
    if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) { return $env:ANDROID_HOME }
    if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) { return $env:ANDROID_SDK_ROOT }
    $local = Join-Path $env:LOCALAPPDATA "Android\Sdk"
    if (Test-Path $local) { return $local }
    return $null
}

function Test-PortListening([int]$Port) {
    try {
        return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    } catch { return $false }
}

Set-Location $Root
Write-Host "Akshar mobile demo launcher" -ForegroundColor Yellow
Write-Host "Project: $Root"

if (Get-Command xcodebuild -ErrorAction SilentlyContinue) {
    Write-Host ""
    Write-Host "macOS/Xcode detected. Use the native iPhone 13 script instead:" -ForegroundColor Green
    Write-Host "  bash scripts/run-ios-iphone13.sh"
    exit 0
}

Ensure-CouchDb
$nodeExe = Get-NodeExe
$npm = Get-NpmCommand
$nodeVersion = (& $nodeExe --version) -replace '^v', ''
Write-Host "Using Node v$nodeVersion" -ForegroundColor Green

$authPython = Ensure-PythonVenv $AuthDir ".venv-auth"
$aiPython = Ensure-PythonVenv $AIDir ".venv-ai"

Write-Step "Building @akshar/crypto"
Push-Location $CryptoDir
if (-not (Test-Path "node_modules")) { & $npm install }
& $npm run build
Pop-Location

Write-Step "Installing mesh + mobile dependencies"
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
`$env:COUCHDB_URL = '$env:COUCHDB_URL'
`$env:COUCHDB_USER = '$env:COUCHDB_USER'
`$env:COUCHDB_PASSWORD = '$env:COUCHDB_PASSWORD'
& '$authPython' -m uvicorn app.main:app --host 0.0.0.0 --port 8001
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
& '$aiPython' -m uvicorn app.main:app --host 0.0.0.0 --port 8002
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

Wait-ForHealth "http://127.0.0.1:8001/auth/health" "Auth service" 90
Wait-ForHealth "http://127.0.0.1:8002/ai/health" "AI service" 180
Wait-ForHealth "http://127.0.0.1:8003/mesh/health" "Mesh service" 90

Write-Step "Starting Metro bundler (React Native)"
Start-ServiceScript "Akshar Metro :8081" @"
`$host.UI.RawUI.WindowTitle = 'Akshar Metro :8081'
`$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
Set-Location '$MobileDir'
& '$npm' start
"@

$sdk = Find-AndroidSdk
$adb = if ($sdk) { Join-Path $sdk "platform-tools\adb.exe" } else { $null }
$emulator = if ($sdk) { Join-Path $sdk "emulator\emulator.exe" } else { $null }

if ($adb -and (Test-Path $adb) -and $emulator -and (Test-Path $emulator)) {
    Write-Step "Android SDK found - launching native app on emulator"
    $env:ANDROID_HOME = $sdk
    $platformTools = Join-Path $sdk "platform-tools"
    $emulatorDir = Join-Path $sdk "emulator"
    $env:Path = "$platformTools;$emulatorDir;$env:Path"

    $devices = & $adb devices 2>$null
    if ($devices -notmatch "emulator-") {
        $avds = & $emulator -list-avds 2>$null
        if ($avds) {
            $avd = ($avds | Select-Object -First 1)
            Write-Host "Starting Android emulator: $avd"
            Start-Process $emulator -ArgumentList @("-avd", $avd) | Out-Null
            for ($i = 0; $i -lt 90; $i++) {
                Start-Sleep -Seconds 2
                $devices = & $adb devices 2>$null
                if ($devices -match "emulator-") { break }
            }
        }
    }

    & $adb reverse tcp:8001 tcp:8001 | Out-Null
    & $adb reverse tcp:8002 tcp:8002 | Out-Null
    & $adb reverse tcp:8003 tcp:8003 | Out-Null
    & $adb reverse tcp:8081 tcp:8081 | Out-Null

    Push-Location $MobileDir
    & $npm run android
    Pop-Location

    Write-Host ""
    Write-Host "Native Android app launched (closest Windows option to a phone emulator)." -ForegroundColor Green
    exit 0
}

Write-Step "Opening iPhone 13 presentation frame (Windows fallback)"
Start-Process "http://127.0.0.1:8003/iphone13.html"

Write-Host ""
Write-Host "IMPORTANT - iPhone Simulator requires macOS + Xcode." -ForegroundColor Yellow
Write-Host "It cannot run natively on Windows."
Write-Host ""
Write-Host "Your options for a real iPhone 13 demo:" -ForegroundColor Cyan
Write-Host "  1. Mac (UTD lab Mac, borrow a MacBook):"
Write-Host "       bash scripts/run-ios-iphone13.sh"
Write-Host "  2. Physical iPhone (after one Mac build): install the .app, point Metro at your PC LAN IP"
Write-Host "  3. Right now on Windows: use the iPhone 13 frame in your browser (just opened)"
Write-Host ""
Write-Host "Presentation URLs:" -ForegroundColor Green
Write-Host "  iPhone 13 frame: http://127.0.0.1:8003/iphone13.html"
Write-Host "  Full web app:      http://127.0.0.1:8003"
Write-Host "  Metro bundler:     http://127.0.0.1:8081"
Write-Host ""
Write-Host "Demo flow: Allow camera -> Enroll face -> Chat / Feed / Profile (trust score)" -ForegroundColor Yellow
