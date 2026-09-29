/**
 * driveService.js  (v2 — thin wrapper over syncEngine)
 * ─────────────────────────────────────────────────────────────────────────────
 * Backward-compatible Drive API kept for any components that import directly.
 * All real logic now lives in src/db/syncEngine.js
 */

import { saveToDrive, loadFromDrive, triggerAutoSync } from '../db/syncEngine.js';
import { getValidAccessToken }                         from '../db/tokenManager.js';

export { saveToDrive, loadFromDrive };

/**
 * Save trades to Google Drive (compressed gzip + CRDT merge).
 * @param {object[]} trades
 * @param {string}   accessToken
 * @param {string}   [portfolioId]
 */
export async function saveTradesToDrive(trades, accessToken, portfolioId = 'default') {
  const token = await getValidAccessToken().catch(() => accessToken);
  if (!token || token === 'demo-token') {
    return { success: true, mode: 'local' };
  }
  const result = await saveToDrive(portfolioId, trades, token);
  return { success: result.success, mode: 'drive', merged: result.merged, error: result.error };
}

/**
 * Load trades from Google Drive.
 * @param {string} accessToken
 * @param {string} [portfolioId]
 */
export async function loadTradesFromDrive(accessToken, portfolioId = 'default') {
  const token = await getValidAccessToken().catch(() => accessToken);
  if (!token || token === 'demo-token') return [];
  return loadFromDrive(portfolioId, token);
}

/**
 * Debounced auto-backup trigger.
 * @param {object[]} trades
 * @param {string}   accessToken
 * @param {string}   [portfolioId]
 */
export async function triggerAutoBackup(trades, accessToken, portfolioId = 'default') {
  if (!accessToken || accessToken === 'demo-token') return;
  const token = await getValidAccessToken().catch(() => accessToken);
  if (!token) return;
  triggerAutoSync(portfolioId, token, trades);
}
