# FoxTrade Desktop — Release & Auto-Update Guide

This document explains how the production-grade auto-update system works for FoxTrade Desktop, how to configure your GitHub repository, how to release updates with one command, and how to verify that updates install seamlessly while keeping user data 100% safe.

---

## 1. Architecture Overview

- **Engine**: Powered by `electron-updater` configured with NSIS target (`oneClick: true`, `perMachine: false`).
- **Release Host**: GitHub Releases.
- **Update Files**:
  - `FoxTrade-Setup-<version>.exe` (silent installer).
  - `latest.yml` (version metadata, SHA-512 hashes, release notes).
  - `FoxTrade-Setup-<version>.exe.blockmap` (differential blockmap for delta updates).
- **Update Lifecycle**:
  - Background check runs 10 seconds post-launch, then automatically every 4 hours.
  - Rate-limit guard prevents checking more than once every 30 minutes.
  - Safe installer: Flushes SQLite WAL, backs up `foxtrade.db` to `userData/backups/`, cleanly closes connections, and installs silently.
  - Database schema migrations run on next launch via `PRAGMA user_version`. If a migration fails, the pre-migration backup is restored automatically.
  - User settings, Google Auth tokens, and trades persist permanently in `userData` (never in the app program directory).

---

## 2. One-Time Setup Checklist

### Step 1: Set your GitHub Details in `package.json`
Open `package.json` and locate the `build.publish` section:
```json
"publish": [
  {
    "provider": "github",
    "owner": "foxtradebharat",
    "repo": "desktopfoxtrade",
    "releaseType": "release"
  }
]
```
Configured for repository `https://github.com/foxtradebharat/desktopfoxtrade.git`.

> **CRITICAL WARNING:**
> Never change `build.appId` (`com.foxtrade.app`) or `build.productName` (`FoxTrade`). Changing either of these changes the Windows registry path and breaks auto-updating for existing installations.

---

### Step 2: Configure GitHub Repository Permissions
1. Navigate to your repository on GitHub.
2. Go to **Settings** > **Actions** > **General**.
3. Under **Workflow permissions**, select:
   - **Read and write permissions**.
4. Check **Allow GitHub Actions to create and approve pull requests**.
5. Click **Save**.

---

### Step 3: Public vs Private Repositories
- **Public Repository (Recommended)**: GitHub Releases are publicly accessible over HTTPS. Auto-updates work out of the box with zero client configuration.
- **Private Repository**: GitHub requires an authorization token to read release assets.
  - **Do NOT embed a personal access token (PAT) inside the client app**, as it can be easily extracted from the binary.
  - **Best Practice for Private Repos**: Create a dedicated lightweight public repository (e.g., `YOUR_GH_USERNAME/foxtrade-releases`) to host the `.exe`, `latest.yml`, and `.blockmap` files. Set `package.json`'s `publish.repo` to that public repository while keeping your source code private.

---

## 3. How to Ship an Update

You can ship an update with **one command**:

### Method A: One-Command Git Tag Release (Automated CI/CD)
To publish a patch release (e.g., `1.0.0` → `1.0.1`):
```bash
npm run release:patch
```
For minor or major releases:
```bash
npm run release:minor   # 1.0.0 → 1.1.0
npm run release:major   # 1.0.0 → 2.0.0
```

**What happens automatically:**
1. `npm version` increments the version in `package.json` and commits it.
2. A matching git tag (e.g. `v1.0.1`) is created.
3. `git push --follow-tags` pushes the commit and tag to GitHub.
4. GitHub Actions workflow (`.github/workflows/release.yml`) automatically triggers:
   - Checks out code and installs dependencies.
   - Runs unit tests and Foxy golden suite.
   - Runs `npm run build`.
   - Runs `electron-builder --win --publish always`.
   - Publishes the GitHub release with `FoxTrade-Setup-1.0.1.exe`, `latest.yml`, and the `.blockmap`.

---

### Method B: Manual Local Release (Direct from Developer Machine)
If you want to build and upload directly from your local machine:
```bash
# 1. Set your GitHub Personal Access Token (repo scope)
$env:GH_TOKEN="ghp_yourPersonalAccessTokenHere"

# 2. Build and publish
npm run release:local
```

---

## 4. End-to-End Verification Test Plan

Follow these steps to test the entire auto-update cycle:

1. **Build and Install v1.0.0**:
   - Set version to `1.0.0` in `package.json`.
   - Run `npm run electron:build`.
   - Run the installer from `release/FoxTrade-Setup-1.0.0.exe`.
   - Log in, create a few test trades, and verify the app displays `v1.0.0`.
2. **Publish v1.0.1**:
   - Update `package.json` version to `1.0.1`.
   - Run `npm run release:patch` (or publish manually to GitHub).
   - Verify the GitHub release contains:
     - `FoxTrade-Setup-1.0.1.exe`
     - `latest.yml`
     - `FoxTrade-Setup-1.0.1.exe.blockmap`
3. **Verify Desktop App Detection**:
   - Open the installed `FoxTrade` app.
   - Within 10 seconds, the top bar or title bar displays the animated pill: `Updating... X%`.
   - Once downloaded, the accent pill pulses: `Restart to update v1.0.1`.
   - A one-time success toast appears: `FoxTrade Update Ready`.
4. **Verify Silent Restart & Data Preservation**:
   - Click the pill or click **Restart Now** in the update modal.
   - The app closes, automatically applies the update silently in the background, and restarts.
   - Verify:
     - Version now reads `v1.0.1`.
     - User session remains signed in.
     - All trade records, portfolios, and settings are intact.
     - A timestamped backup exists in `%APPDATA%\FoxTrade\backups\`.

---

## 5. Troubleshooting Guide

| Issue | Likely Cause | Solution |
| :--- | :--- | :--- |
| **Update not detected** | Check was throttled within the 30-minute window | Click "Check for Updates" manually in Settings > About or Help menu. |
| **404 on `latest.yml`** | GitHub Release is a Draft or missing `latest.yml` | Ensure the GitHub release is Published (not Draft). Re-run with `--publish always`. |
| **Windows SmartScreen warning** | The binary is not signed with an EV Code Signing Certificate | Normal for newly released open-source Windows apps. Click "More info" → "Run anyway". Buying a Sectigo/DigiCert code-signing certificate eliminates this. |
| **Antivirus false positive** | Generic heuristic block on fresh `.exe` | Submit the installer to Microsoft Security Intelligence portal or sign with certificate. |
| **Private repo 404** | Client cannot authenticate to private GitHub release | Publish releases to a secondary public repo as described in Step 3. |
| **Wrong `appId`** | Changed `com.foxtrade.app` | Revert `appId` to `com.foxtrade.app`. Changing appId treats the install as a completely different app. |
| **Corrupted download** | Network dropped mid-download | Auto-updater automatically retries 3 times with exponential backoff. If all fail, it waits for the next 4-hour cycle without corrupting the app. |

---

## 6. Rollback Procedure

If a published version contains a critical bug:
1. **Never attempt to downgrade versions** (`electron-updater` ignores versions lower than the installed version).
2. **Option A (Recommended)**: Fix the bug immediately and publish a higher patch version (e.g., if `v1.0.1` had a bug, publish `v1.0.2`). All clients on `v1.0.0` and `v1.0.1` will immediately upgrade to `v1.0.2`.
3. **Option B (Emergency Stop)**: Delete the GitHub Release for `v1.0.1` or set it to Draft. Clients that have not yet downloaded `v1.0.1` will stop seeing it.
