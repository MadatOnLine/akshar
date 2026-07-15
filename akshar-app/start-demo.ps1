# Akshar full-stack demo launcher (Windows)
# Starts CouchDB + auth + ai + mesh, then opens the web app in your browser.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
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

function Test-CouchDb {
    try {
        Invoke-WebRequest -Uri "http://127.0.0.1:5984" -UseBasicParsing -TimeoutSec 3 | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Ensure-CouchDb {
    if (Test-CouchDb) {
        Write-Host "CouchDB is already running on port 5984." -ForegroundColor Green
        return
    }

    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Step "Starting CouchDB with Docker..."
        $existing = docker ps -a --filter "name=akshar-couch" --format "{{.Names}}" 2>$null
        if ($existing -eq "akshar-couch") {
            docker start akshar-couch | Out-Null
        } else {
            docker run -d --name akshar-couch -p 5984:5984 `
                -e COUCHDB_USER=admin -e COUCHDB_PASSWORD=admin couchdb:3 | Out-Null
        }
        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Seconds 1
            if (Test-CouchDb) { return }
        }
        throw "CouchDB container started but port 5984 is not responding."
    }

    throw @"
CouchDB is not running and Docker was not found.

Install ONE of these, then run this script again:
  1. Docker Desktop: https://docs.docker.com/desktop/setup/install/windows-install/
  2. CouchDB for Windows: https://couchdb.apache.org/#download
     (use admin / admin, default port 5984)
"@
}

function Get-Python311 {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        $exe = & py -3.11 -c "import sys; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $exe) { return $exe.Trim() }
    }
    if (Get-Command python -ErrorAction SilentlyContinue) {
        $version = & python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
        if ($version -eq "3.11") {
            return (Get-Command python).Source
        }
    }
    throw "Python 3.11 is required. Install from https://www.python.org/downloads/ and enable 'py' launcher."
}

function Ensure-PythonVenv([string]$PackageDir, [string]$VenvName) {
    $pythonExe = Get-Python311
    $venvPath = Join-Path $PackageDir $VenvName
    $venvPython = Join-Path $venvPath "Scripts\python.exe"
    if (-not (Test-Path $venvPython)) {
        Write-Step "Creating virtual environment in $PackageDir\$VenvName"
        & $pythonExe -m venv $venvPath
    }
    Write-Step "Installing Python dependencies in $PackageDir"
    & $venvPython -m pip install -q --upgrade pip
    if ($PackageDir -eq $AIDir) {
        & $venvPython -m pip install -q --default-timeout=300 -r (Join-Path $PackageDir "requirements.txt")
    } else {
        & $venvPython -m pip install -q -r (Join-Path $PackageDir "requirements.txt")
    }
    if (Test-Path (Join-Path $PackageDir "requirements-dev.txt")) {
        & $venvPython -m pip install -q -r (Join-Path $PackageDir "requirements-dev.txt")
    }
    return $venvPython
}

function Refresh-Path {
    # Cursor/VS Code terminals often keep a stale PATH after installing Node.
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
}

function Find-NodeInstallDir {
    $candidates = @(
        "${env:ProgramFiles}\nodejs",
        "${env:ProgramFiles(x86)}\nodejs",
        "$env:LOCALAPPDATA\Programs\nodejs",
        "$env:APPDATA\npm"
    )
    foreach ($dir in $candidates) {
        if ($dir -and (Test-Path (Join-Path $dir "node.exe"))) {
            return $dir
        }
    }
    return $null
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
    return $null
}

function Get-NpmCommand {
    Refresh-Path
    $nodeDir = Find-NodeInstallDir
    if ($nodeDir) {
        $env:Path = "$nodeDir;$env:Path"
    }
    if ($nodeDir -and (Test-Path (Join-Path $nodeDir "npm.cmd"))) {
        return (Join-Path $nodeDir "npm.cmd")
    }
    if (Get-Command npm.cmd -ErrorAction SilentlyContinue) {
        return (Get-Command npm.cmd).Source
    }
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        return (Get-Command npm).Source
    }
    throw "npm is required but was not found on PATH after installing Node.js."
}

function Ensure-Node {
    $nodeExe = Get-NodeExe
    if (-not $nodeExe) {
        throw @"
Node.js 20+ is required for the web app (mesh service) but was not found.

Install Node.js LTS from https://nodejs.org/ then fully quit and reopen Cursor.

If you already installed it, open a NEW Windows PowerShell (outside Cursor) and run:
  node --version
"@
    }
    $version = (& $nodeExe --version) -replace '^v', ''
    $major = [int]($version.Split('.')[0])
    if ($major -lt 20) {
        throw @"
Node.js 20+ is required, but you have v$version.

Your version is too old for this project. Install the latest LTS from:
  https://nodejs.org/

After installing, close and reopen Cursor, then run:
  node --version
"@
    }
    Get-NpmCommand | Out-Null
    Write-Host "Using Node v$version" -ForegroundColor Green
}

function Ensure-MeshDeps {
    Ensure-Node
    $npm = Get-NpmCommand
    Write-Step "Building @akshar/crypto"
    Push-Location $CryptoDir
    if (-not (Test-Path "node_modules")) { & $npm install }
    & $npm run build
    Pop-Location

    Write-Step "Installing mesh dependencies"
    Push-Location $MeshDir
    if (-not (Test-Path "node_modules")) { & $npm install }
    Pop-Location
}

function Wait-ForHealth([string]$Url, [string]$Label, [int]$TimeoutSeconds = 120) {
    Write-Host "Waiting for $Label at $Url ..."
    for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
        try {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
            Write-Host "$Label is ready." -ForegroundColor Green
            return
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    throw "$Label did not become ready within ${TimeoutSeconds}s ($Url)"
}

function Start-ServiceScript([string]$Title, [string]$ScriptContent) {
    $runDir = Join-Path $Root ".demo-run"
    New-Item -ItemType Directory -Force -Path $runDir | Out-Null
    $safeTitle = ($Title -replace '[^\w\- ]', '') -replace ' ', '-'
    $scriptPath = Join-Path $runDir "$safeTitle.ps1"
    Set-Content -Path $scriptPath -Value $ScriptContent -Encoding UTF8
    Start-Process powershell -ArgumentList @("-NoExit", "-File", $scriptPath) | Out-Null
}

Set-Location $Root
Write-Host "Akshar demo launcher" -ForegroundColor Yellow
Write-Host "Project: $Root"

Ensure-CouchDb
$authPython = Ensure-PythonVenv $AuthDir ".venv-auth"
$aiPython = Ensure-PythonVenv $AIDir ".venv-ai"
Ensure-MeshDeps

Write-Step "Starting services in separate windows (leave them open during the demo)"
$npmCmd = Get-NpmCommand

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

Start-ServiceScript "Akshar Mesh :8003" @"
`$host.UI.RawUI.WindowTitle = 'Akshar Mesh :8003'
`$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
Set-Location '$MeshDir'
`$env:JWT_SECRET = '$env:JWT_SECRET'
`$env:SERVICE_API_KEY = '$env:SERVICE_API_KEY'
`$env:COUCHDB_URL = 'http://admin:admin@127.0.0.1:5984'
`$env:AI_SERVICE_URL = '$env:AI_SERVICE_URL'
`$env:AUTH_SERVICE_URL = '$env:AUTH_SERVICE_URL'
& '$npmCmd' run dev
"@

Wait-ForHealth "http://127.0.0.1:8001/auth/health" "Auth service" 90
Wait-ForHealth "http://127.0.0.1:8002/ai/health" "AI service" 180
Wait-ForHealth "http://127.0.0.1:8003/mesh/health" "Mesh service" 90

Write-Step "Opening demo app"
Start-Process "http://127.0.0.1:8003"

Write-Host ""
Write-Host "Demo is ready for your boss/peers:" -ForegroundColor Green
Write-Host "  Tier 2 demo: http://127.0.0.1:8003/tier2-demo.html"
Write-Host "  Main app:    http://127.0.0.1:8003"
Write-Host "  Account Studio: http://127.0.0.1:8003/account-studio.html"
Write-Host "  Auth API: http://127.0.0.1:8001/auth/health"
Write-Host "  AI API:   http://127.0.0.1:8002/ai/health"
Write-Host ""
Write-Host "Demo flow:" -ForegroundColor Yellow
Write-Host "  1. Enroll or log in on main app"
Write-Host "  2. If account is at risk, mandatory verification popup appears"
Write-Host "  3. Open Account Studio from Profile for analytics, trust, reports & appeals"
Write-Host ""
Write-Host "Main app flow:" -ForegroundColor Yellow
Write-Host "  1. Allow camera access"
Write-Host "  2. Enter your name -> Create account & enroll face"
Write-Host "  3. Use Chat, Feed, and Profile (trust score) tabs"
Write-Host ""
Write-Host "To stop everything, close the 3 service windows or run: .\stop-demo.ps1" -ForegroundColor DarkGray
