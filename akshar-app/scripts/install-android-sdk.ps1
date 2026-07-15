# Install Android SDK + Pixel 6 emulator (iPhone 13 tier equivalent) on Windows.
# Run once: powershell -ExecutionPolicy Bypass -File .\scripts\install-android-sdk.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$SdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$CmdLineTools = Join-Path $SdkRoot "cmdline-tools\latest"
$SdkManager = Join-Path $CmdLineTools "bin\sdkmanager.bat"
$AvdManager = Join-Path $CmdLineTools "bin\avdmanager.bat"

function Write-Step([string]$Msg) {
    Write-Host ""
    Write-Host "==> $Msg" -ForegroundColor Cyan
}

function Ensure-Java {
    if (Get-Command java -ErrorAction SilentlyContinue) {
        Write-Host "Java found." -ForegroundColor Green
        return
    }
    $jdk = Get-ChildItem "C:\Program Files\Microsoft\jdk-*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($jdk) {
        $env:JAVA_HOME = $jdk.FullName
        $env:Path = "$($jdk.FullName)\bin;$env:Path"
        Write-Host "Using Java at $($jdk.FullName)" -ForegroundColor Green
        return
    }
    Write-Step "Installing Microsoft OpenJDK 17 (required by Android SDK)"
    winget install Microsoft.OpenJDK.17 --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
        [System.Environment]::GetEnvironmentVariable("Path", "User")
    if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
        throw @"
Java is required but could not be installed automatically (admin prompt may have been declined).

Install ONE of these, then rerun this script:
  1. Microsoft OpenJDK 17: winget install Microsoft.OpenJDK.17
  2. Android Studio (includes JDK): https://developer.android.com/studio
"@
    }
}

function Download-CmdlineTools {
    if (Test-Path $SdkManager) { return }
    Write-Step "Downloading Android command-line tools"
    New-Item -ItemType Directory -Force -Path $SdkRoot | Out-Null
    $zip = Join-Path $env:TEMP "android-cmdline-tools.zip"
    $url = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    $extract = Join-Path $env:TEMP "android-cmdline-tools"
    if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
    Expand-Archive -Path $zip -DestinationPath $extract -Force
    $inner = Get-ChildItem $extract -Recurse -Directory -Filter "cmdline-tools" | Select-Object -First 1
    if (-not $inner) { throw "cmdline-tools folder not found in archive" }
    $dest = Join-Path $SdkRoot "cmdline-tools\latest"
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    $srcContents = Join-Path $inner.FullName "."
    Copy-Item -Path $srcContents -Destination $dest -Recurse -Force
}

function Set-AndroidEnv {
    [System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $SdkRoot, "User")
    [System.Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", $SdkRoot, "User")
    $env:ANDROID_HOME = $SdkRoot
    $env:ANDROID_SDK_ROOT = $SdkRoot
    $platformTools = Join-Path $SdkRoot "platform-tools"
    $emulatorDir = Join-Path $SdkRoot "emulator"
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $add = @($platformTools, $emulatorDir, (Join-Path $CmdLineTools "bin")) | Where-Object { $userPath -notlike "*$_*" }
    if ($add.Count -gt 0) {
        $newPath = ($add + $userPath.Split(';') | Where-Object { $_ }) -join ';'
        [System.Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    }
    $env:Path = "$platformTools;$emulatorDir;$(Join-Path $CmdLineTools 'bin');$env:Path"
}

Write-Host "Akshar Android SDK installer" -ForegroundColor Yellow
Write-Host "Creates: Pixel 6 emulator (closest match to iPhone 13 - 6.1 inch class, 2021 flagship tier)"
Write-Host "SDK path: $SdkRoot"

Ensure-Java
Download-CmdlineTools
Set-AndroidEnv

Write-Step "Installing SDK packages (first run may take 10-20 minutes)"
$packages = @(
    "platform-tools",
    "emulator",
    "platforms;android-34",
    "build-tools;34.0.0",
    "system-images;android-34;google_apis_playstore;x86_64"
)
foreach ($p in $packages) {
    Write-Host "  sdkmanager $p"
    echo y | & $SdkManager $p 2>&1 | Out-Host
}

Write-Step "Creating Pixel 6 virtual device: Akshar_Pixel6"
$avdName = "Akshar_Pixel6"
$existing = & $AvdManager list avd 2>&1
if ($existing -match $avdName) {
    Write-Host "AVD $avdName already exists." -ForegroundColor Green
} else {
    echo no | & $AvdManager create avd -n $avdName -k "system-images;android-34;google_apis_playstore;x86_64" -d "pixel_6" -f
}

$ini = Join-Path $env:USERPROFILE ".android\avd\$avdName.avd\config.ini"
if (Test-Path $ini) {
    (Get-Content $ini) `
        -replace 'hw\.camera\.front\s*=\s*none', 'hw.camera.front = webcam0' `
        -replace 'hw\.camera\.back\s*=\s*emulated', 'hw.camera.back = webcam0' |
        Set-Content $ini
    Write-Host "Configured $avdName front/back camera -> webcam0" -ForegroundColor Green
}

Write-Host ""
Write-Host "Android SDK ready." -ForegroundColor Green
Write-Host "Equivalent device: Google Pixel 6 (6.4 inch, 2021 flagship - same class as iPhone 13)"
Write-Host ""
Write-Host "Next: powershell -ExecutionPolicy Bypass -File .\start-android-demo.ps1" -ForegroundColor Cyan
