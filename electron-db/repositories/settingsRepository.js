/**
 * electron-db/repositories/settingsRepository.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SQLite key-value store for application configuration and UI preferences.
 */

import { getDatabase } from '../database.js';

export function getSetting(key, defaultValue = null) {
  const db = getDatabase();
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key);
  if (!row) return defaultValue;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

export function setSetting(key, value) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, valStr, now);
}

export function deleteSetting(key) {
  const db = getDatabase();
  db.prepare(`DELETE FROM app_settings WHERE key = ?`).run(key);
}
