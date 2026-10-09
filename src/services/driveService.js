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
  const result = await saveToDrive(portfolioId, trades, accessToken);
  return { success: result.success, mode: 'local', merged: result.merged, error: result.error };
}

/**
 * Load trades from local database snapshot.
 * @param {string} accessToken
 * @param {string} [portfolioId]
 */
export async function loadTradesFromDrive(accessToken, portfolioId = 'default') {
  return loadFromDrive(portfolioId, accessToken);
}

/**
 * Debounced auto-backup trigger.
 * @param {object[]} trades
 * @param {string}   accessToken
 * @param {string}   [portfolioId]
 */
export async function triggerAutoBackup(trades, accessToken, portfolioId = 'default') {
  triggerAutoSync(portfolioId, accessToken, trades);
}
