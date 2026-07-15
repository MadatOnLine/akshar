# Android emulator setup (Windows)

Your teammates can run the **native Akshar mobile app** on a Pixel 6 emulator without a physical phone. The emulator image is **not** stored in git (it is ~2 GB); this folder contains setup scripts and instructions to create it locally.

## What you get

| Item | Details |
|------|---------|
| Virtual device | `Akshar_Pixel6` — Google Pixel 6, Android 14 (similar size/tier to iPhone 13) |
| Camera | Uses your PC webcam for face enrollment / liveness |
| Backend access | `adb reverse` forwards ports 8001–8003 and 8081 to your PC |

## Prerequisites

Install these **once** on Windows:

1. **Node.js 20+** — [https://nodejs.org/](https://nodejs.org/)
2. **Python 3.11** — [https://www.python.org/downloads/](https://www.python.org/downloads/) (enable “py launcher”)
3. **CouchDB** — run `.\start-demo.ps1` once; it checks CouchDB on port 5984
4. **Java 17** — installed automatically by the SDK script via `winget`, or install [Microsoft OpenJDK 17](https://learn.microsoft.com/en-us/java/openjdk/download)

Disk space: allow **~8 GB** for the Android SDK + system image.

## One-time setup (15–25 minutes)

From the **`akshar-app`** folder in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-android-sdk.ps1
```

This script:

- Downloads Android command-line tools to `%LOCALAPPDATA%\Android\Sdk`
- Installs platform-tools, emulator, build-tools, and the Android 34 system image
- Creates the **`Akshar_Pixel6`** AVD
- Points the emulator camera at your **webcam** (`webcam0`)

Close and reopen PowerShell after install so `ANDROID_HOME` is on your PATH.

## Run the full mobile demo

```powershell
powershell -ExecutionPolicy Bypass -File .\start-android-demo.ps1
```

This will:

1. Start Auth (`:8001`), AI (`:8002`), and Mesh (`:8003`) if not already running
2. Boot the Pixel 6 emulator (first boot can take 2–3 minutes)
3. Set up port forwarding (`adb reverse`)
4. Build and install the React Native app

### Demo flow on the emulator

1. Allow **camera** when prompted
2. **Create account & enroll face** or **Log in with face**
3. Use **Chat**, **Feed**, and **Profile**
4. **Profile → Open Account Studio** for trust, analytics, and reports

## Web-only alternative (no emulator)

If you cannot install the SDK:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-demo.ps1
```

Then open [http://127.0.0.1:8003](http://127.0.0.1:8003) in Chrome — same Tier 2 / Account Studio flows in the browser.

iPhone-sized frame: [http://127.0.0.1:8003/iphone13.html](http://127.0.0.1:8003/iphone13.html)

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Android SDK not found` | Run `install-android-sdk.ps1` again; restart terminal |
| Emulator stuck on boot | Wait 3 min; ensure virtualization (Intel HAXM / WHPX) is enabled in BIOS |
| `BUILD FAILED` / Gradle errors | Open Android Studio once, accept SDK licenses; rerun `start-android-demo.ps1` |
| App can’t reach API | Ensure `adb reverse` ran (script does this); backends must be on `127.0.0.1` |
| Camera not working | In AVD settings, front camera = `webcam0`; allow camera permission in emulator |
| Red screen / Metro error | Keep the **Metro :8081** window open; press `R` twice in Metro to reload |

## Files in this folder

| File | Purpose |
|------|---------|
| `README.md` | This guide |
| `../scripts/install-android-sdk.ps1` | One-time SDK + AVD installer |
| `../start-android-demo.ps1` | Start backends + emulator + mobile app |
| `../start-mobile-demo.ps1` | Backends + Metro; uses Android if SDK exists, else browser frame |

## macOS / iPhone

Native iPhone Simulator requires **macOS + Xcode**:

```bash
bash scripts/run-ios-iphone13.sh
```

See `scripts/prepare-ios-cloud-test.ps1` for physical iPhone on the same Wi‑Fi as your dev PC.
