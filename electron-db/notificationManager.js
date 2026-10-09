/**
 * electron-db/notificationManager.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Native Windows Toast Notification & Market Scheduler Engine for FoxTrade.
 *
 * Capabilities:
 *   1. Native Windows 10/11 Toast Notifications with App Icon & Focus Click.
 *   2. Pre-Market Checklist Notification (09:00 AM IST, Mon-Fri).
 *   3. Post-Market Journaling Reminder (03:45 PM IST, Mon-Fri).
 *   4. Instant Trader Alerts (Risk limit breach, broker import completion, backup sync).
 *   5. Configurable via Settings (Enabled by default).
 */

import { Notification, ipcMain, app } from 'electron';
import { getSetting, setSetting } from './repositories/settingsRepository.js';

let _mainWindow = null;
let _resolveIconFn = null;
let _schedulerInterval = null;

// Track last fired dates to prevent double-firing on same day
let _lastPreMarketDate = null;
let _lastPostMarketDate = null;

const NOTIFICATION_SETTING_KEY = 'desktop_notifications_enabled';

/**
 * Checks if native notifications are supported and enabled by user.
 */
export function areNotificationsEnabled() {
  if (!Notification.isSupported()) return false;
  return getSetting(NOTIFICATION_SETTING_KEY, true);
}

/**
 * Set user notification preference.
 */
export function setNotificationsEnabled(enabled) {
  setSetting(NOTIFICATION_SETTING_KEY, Boolean(enabled));
  return Boolean(enabled);
}

/**
 * Show a native Windows toast notification.
 */
export function showNativeNotification({ title, body, silent = false }) {
  if (!Notification.isSupported()) {
    console.log('[NotificationManager] Native notifications not supported on this OS.');
    return false;
  }

  if (!areNotificationsEnabled()) {
    console.log('[NotificationManager] Notifications are muted by user preference.');
    return false;
  }

  try {
    const icon = _resolveIconFn ? _resolveIconFn() : undefined;
    const notification = new Notification({
      title: title || 'FoxTrade',
      body: body || '',
      icon,
      silent: Boolean(silent)
    });

    notification.on('click', () => {
      if (_mainWindow && !_mainWindow.isDestroyed()) {
        if (_mainWindow.isMinimized()) _mainWindow.restore();
        _mainWindow.show();
        _mainWindow.focus();
      }
    });

    notification.show();
    return true;
  } catch (err) {
    console.error('[NotificationManager] Failed to show notification:', err);
    return false;
  }
}

/**
 * Converts current UTC time to Indian Standard Time (IST = UTC + 5:30)
 */
function getISTDateParts() {
  const now = new Date();
  // IST offset is +330 minutes (+5 hours 30 mins)
  const istOffsetMs = 330 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);

  const dayOfWeek = istDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  const hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes();
  const dateStr = istDate.toISOString().slice(0, 10); // YYYY-MM-DD in IST

  return { dayOfWeek, hours, minutes, dateStr, isWeekday: dayOfWeek >= 1 && dayOfWeek <= 5 };
}

/**
 * Evaluates market schedule every 30 seconds.
 */
function checkMarketSchedule() {
  if (!areNotificationsEnabled()) return;

  const { isWeekday, hours, minutes, dateStr } = getISTDateParts();
  if (!isWeekday) return; // Only active Monday through Friday for Indian Markets

  // 1. Pre-Market Check: 09:00 AM IST (Window: 09:00 - 09:05)
  if (hours === 9 && minutes >= 0 && minutes <= 5 && _lastPreMarketDate !== dateStr) {
    _lastPreMarketDate = dateStr;
    showNativeNotification({
      title: 'FoxTrade — Market Opens in 15 Minutes',
      body: 'Prepare your trading desk. Review your Playbook rules and stick to your predefined daily risk limit.'
    });
    console.log(`[NotificationManager] Fired Pre-Market Notification for ${dateStr}`);
  }

  // 2. Post-Market Check: 03:45 PM IST (15:45 Window: 15:45 - 15:50)
  if (hours === 15 && minutes >= 45 && minutes <= 50 && _lastPostMarketDate !== dateStr) {
    _lastPostMarketDate = dateStr;
    showNativeNotification({
      title: 'FoxTrade — Market Closed: Time to Journal',
      body: 'The market has wrapped up. Audit your trade executions against your playbook and record today\'s reflections.'
    });
    console.log(`[NotificationManager] Fired Post-Market Notification for ${dateStr}`);
  }
}

/**
 * Initializes the notification engine & IPC listeners.
 */
export function initNotificationManager(mainWindow, resolveAppIcon) {
  _mainWindow = mainWindow;
  _resolveIconFn = resolveAppIcon;

  // Set Windows AppUserModelId for branded toast notifications
  try {
    app.setAppUserModelId('com.foxtrade.app');
  } catch (_) {}

  // Register IPC handlers
  ipcMain.handle('notifications:getStatus', async () => {
    return {
      supported: Notification.isSupported(),
      enabled: areNotificationsEnabled()
    };
  });

  ipcMain.handle('notifications:setEnabled', async (_event, enabled) => {
    return setNotificationsEnabled(enabled);
  });

  ipcMain.handle('notifications:show', async (_event, { title, body, silent }) => {
    return showNativeNotification({ title, body, silent });
  });

  // Start background schedule checker (every 30 seconds)
  if (_schedulerInterval) clearInterval(_schedulerInterval);
  _schedulerInterval = setInterval(checkMarketSchedule, 30000);

  // Initial check on startup
  checkMarketSchedule();

  console.log('[NotificationManager] Native notification manager and market scheduler initialized.');
}

/**
 * Cleanup on quit.
 */
export function stopNotificationManager() {
  if (_schedulerInterval) {
    clearInterval(_schedulerInterval);
    _schedulerInterval = null;
  }
}
