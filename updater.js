/**
 * updater.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Production-grade auto-update system for FoxTrade Electron Desktop.
 * Powered by electron-updater, electron-log, and GitHub Releases.
 *
 * Highlights:
 *  - Runs only when packaged (or with DEV_FORCE_UPDATE=true).
 *  - Silent background checks (10s after launch, then every 4h).
 *  - Strict 30-minute throttling guard to prevent GitHub API rate limits.
 *  - Exponential backoff retry on transient download failures (max 3 retries).
 *  - Structured file logging to userData/logs/updater.log via electron-log.
 *  - Pre-install safety: flushes SQLite WAL, backs up foxtrade.db to userData/backups/,
 *    closes SQLite connections cleanly, and then applies quitAndInstall.
 *  - Respects "skip this version" setting and user-chosen "remind later".
 */

import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;
import { app, ipcMain, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import log from 'electron-log';
import { backupDatabase, closeDatabase } from './electron-db/database.js';

// Configure electron-log to write structured logs to userData/logs/updater.log
const logsDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
log.transports.file.resolvePathFn = () => path.join(logsDir, 'updater.log');
log.transports.file.level = 'info';
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
autoUpdater.logger = log;

// ── State Management ─────────────────────────────────────────────────────────
const THROTTLE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes minimum between checks
const PERIODIC_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // Check every 4 hours
const INITIAL_CHECK_DELAY_MS = 10 * 1000; // 10 seconds post-launch

let updateState = {
  status: 'idle', // 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'dev-mode'
  version: null,
  releaseNotes: null,
  releaseName: null,
  progress: 0,
  speed: 0,
  transferred: 0,
  total: 0,
  lastChecked: null,
  error: null,
  autoDownload: true,
  skippedVersion: null,
  isDismissed: false
};

let mainWindowRef = null;
let lastCheckTimestamp = 0;
let periodicTimer = null;
let retryCount = 0;
const MAX_DOWNLOAD_RETRIES = 3;

function broadcastState() {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('update:state-change', { ...updateState });
    // Also send legacy updater:status for full backward compatibility
    mainWindowRef.webContents.send('updater:status', {
      status: updateState.status,
      version: updateState.version,
      releaseNotes: updateState.releaseNotes,
      percent: updateState.progress,
      bytesPerSecond: updateState.speed,
      transferred: updateState.transferred,
      total: updateState.total,
      message: updateState.error
    });
  }
}

/**
 * Check if the current environment is eligible for updates.
 */
function isUpdaterEligible() {
  return app.isPackaged || process.env.DEV_FORCE_UPDATE === 'true';
}

/**
 * Check for updates with rate-limiting guard and silent error handling.
 * @param {boolean} isManual Whether triggered explicitly by user action
 */
export async function checkForUpdates(isManual = false) {
  if (!isUpdaterEligible()) {
    log.info('[Updater] Running in unpacked/dev mode. Updates disabled.');
    updateState.status = 'dev-mode';
    updateState.version = app.getVersion();
    broadcastState();
    return { status: 'dev-mode', version: app.getVersion() };
  }

  const now = Date.now();
  if (now - lastCheckTimestamp < THROTTLE_WINDOW_MS && !isManual) {
    log.info(`[Updater] Check throttled. Last checked ${(now - lastCheckTimestamp) / 1000}s ago.`);
    return { status: updateState.status, throttled: true };
  }

  // If user clicked manually, allow if at least 15s elapsed to avoid double clicks
  if (isManual && now - lastCheckTimestamp < 15 * 1000) {
    return { status: updateState.status, throttled: true };
  }

  lastCheckTimestamp = now;
  updateState.lastChecked = new Date().toISOString();
  updateState.status = 'checking';
  updateState.error = null;
  broadcastState();

  try {
    log.info('[Updater] Checking for updates via GitHub Releases...');
    const result = await autoUpdater.checkForUpdates();
    return { status: 'checking', updateInfo: result?.updateInfo };
  } catch (err) {
    // Network issues, offline, or initial state before first GitHub release should be silent
    const isOffline = err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.message?.includes('net::ERR_INTERNET_DISCONNECTED');
    const isNoReleasesYet = err.message?.includes('No published versions on GitHub') || err.message?.includes('404');
    if (isOffline || isNoReleasesYet) {
      log.info('[Updater] Silent status: ' + (isOffline ? 'Offline' : 'No releases published yet on GitHub.'));
      updateState.status = 'idle';
      updateState.error = null;
    } else {
      log.error('[Updater] Check failed:', err.message);
      updateState.status = 'error';
      updateState.error = err.message || 'Failed to check for updates.';
    }
    broadcastState();
    return { status: updateState.status, error: updateState.error };
  }
}

/**
 * Safe installer: Flushes SQLite WAL, backs up the database, closes connections,
 * and calls quitAndInstall.
 */
export async function installUpdate() {
  log.info('[Updater] Preparing safe installation...');

  try {
    // 1. Automatic pre-update timestamped database backup in userData/backups/
    const backupPath = backupDatabase('pre_update_install');
    if (backupPath) {
      log.info(`[Updater] Database verified and backed up to: ${backupPath}`);
    }

    // 2. Cleanly close SQLite database and flush WAL
    closeDatabase();
    log.info('[Updater] SQLite database closed successfully.');
  } catch (dbErr) {
    log.error('[Updater] Warning during pre-install DB backup:', dbErr);
  }

  // 3. Trigger NSIS silent install and restart
  try {
    log.info('[Updater] Invoking autoUpdater.quitAndInstall(false, true)...');
    autoUpdater.quitAndInstall(false, true);
  } catch (err) {
    log.error('[Updater] Failed to quitAndInstall:', err);
  }
}

/**
 * Configure and initialize autoUpdater events and schedules.
 * @param {Electron.BrowserWindow} mainWindow
 */
export function initAutoUpdater(mainWindow) {
  mainWindowRef = mainWindow;

  // Configuration options
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  // ── Event Handlers ─────────────────────────────────────────────────────────
  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater Event] checking-for-update');
    updateState.status = 'checking';
    broadcastState();
  });

  autoUpdater.on('update-available', (info) => {
    log.info(`[Updater Event] update-available: v${info.version}`);

    // Check if user chose to skip this specific version
    if (updateState.skippedVersion === info.version) {
      log.info(`[Updater] Version ${info.version} is skipped by user preference.`);
      updateState.status = 'idle';
      broadcastState();
      return;
    }

    updateState.status = autoUpdater.autoDownload ? 'downloading' : 'available';
    updateState.version = info.version;
    updateState.releaseName = info.releaseName || `FoxTrade v${info.version}`;
    updateState.releaseNotes = typeof info.releaseNotes === 'string'
      ? info.releaseNotes
      : (Array.isArray(info.releaseNotes) ? info.releaseNotes.map(n => n.note).join('\n') : '');
    updateState.isDismissed = false;
    retryCount = 0;
    broadcastState();
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info(`[Updater Event] update-not-available (Current v${app.getVersion()})`);
    updateState.status = 'idle';
    updateState.version = app.getVersion();
    updateState.error = null;
    broadcastState();
  });

  autoUpdater.on('download-progress', (progressObj) => {
    updateState.status = 'downloading';
    updateState.progress = Math.round(progressObj.percent);
    updateState.speed = Math.round(progressObj.bytesPerSecond || 0);
    updateState.transferred = Math.round(progressObj.transferred || 0);
    updateState.total = Math.round(progressObj.total || 0);
    broadcastState();
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info(`[Updater Event] update-downloaded: v${info.version}`);
    updateState.status = 'downloaded';
    updateState.version = info.version;
    updateState.progress = 100;
    updateState.isDismissed = false;
    retryCount = 0;
    broadcastState();
  });

  autoUpdater.on('error', (err) => {
    log.warn('[Updater Event] error:', err.message);

    // Auto-retry transient download failures up to 3 times with exponential backoff
    if (updateState.status === 'downloading' && retryCount < MAX_DOWNLOAD_RETRIES) {
      retryCount++;
      const delayMs = Math.pow(2, retryCount) * 2000;
      log.info(`[Updater] Retrying download attempt ${retryCount}/${MAX_DOWNLOAD_RETRIES} in ${delayMs / 1000}s...`);
      setTimeout(() => {
        if (isUpdaterEligible()) {
          autoUpdater.downloadUpdate().catch(e => log.warn('[Updater] Retry download error:', e.message));
        }
      }, delayMs);
      return;
    }

    updateState.status = 'error';
    updateState.error = err.message || 'Unable to complete update check.';
    broadcastState();
  });

  // ── IPC Handlers ───────────────────────────────────────────────────────────
  ipcMain.handle('update:check', async () => checkForUpdates(true));

  ipcMain.handle('update:install', async () => installUpdate());

  ipcMain.handle('update:getState', () => ({ ...updateState }));

  ipcMain.handle('update:dismiss', () => {
    log.info('[Updater] User dismissed update prompt (remind later).');
    updateState.isDismissed = true;
    broadcastState();
    return { success: true };
  });

  ipcMain.handle('update:skipVersion', (_event, ver) => {
    log.info(`[Updater] User skipped version: ${ver}`);
    updateState.skippedVersion = ver;
    updateState.status = 'idle';
    broadcastState();
    return { success: true };
  });

  ipcMain.handle('update:setAutoDownload', (_event, enabled) => {
    updateState.autoDownload = Boolean(enabled);
    autoUpdater.autoDownload = updateState.autoDownload;
    broadcastState();
    return { success: true };
  });

  ipcMain.handle('update:openLogs', () => {
    if (fs.existsSync(logsDir)) {
      shell.openPath(logsDir);
    }
  });

  // Backward compatibility with legacy updater handlers
  ipcMain.handle('updater:check', async () => checkForUpdates(true));
  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });
  ipcMain.handle('updater:install', async () => installUpdate());
  ipcMain.handle('updater:getVersion', () => app.getVersion());

  // ── Scheduling ─────────────────────────────────────────────────────────────
  if (isUpdaterEligible()) {
    // 1. Initial check 10 seconds post-launch
    setTimeout(() => {
      checkForUpdates(false).catch(err => log.warn('[Updater] Initial check notice:', err.message));
    }, INITIAL_CHECK_DELAY_MS);

    // 2. Periodic background check every 4 hours
    periodicTimer = setInterval(() => {
      checkForUpdates(false).catch(err => log.warn('[Updater] Periodic check notice:', err.message));
    }, PERIODIC_CHECK_INTERVAL_MS);
  }
}

/**
 * Teardown timers on app exit.
 */
export function stopAutoUpdater() {
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
}

export function getCurrentUpdateState() {
  return { ...updateState };
}
