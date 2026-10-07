/**
 * googleDrive.js  (v2 — Privacy-First Rewrite)
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Drive authentication using the new TokenManager.
 *
 * WHAT CHANGED FROM v1:
 *   ❌ REMOVED: Tokens stored in localStorage (fragile, wiped by OS/incognito)
 *   ❌ REMOVED: GIS implicit flow as primary (no refresh token, 1hr expiry)
 *   ✅ ADDED: Tokens stored in IndexedDB via tokenManager
 *   ✅ ADDED: CF Worker path for proper refresh tokens (30-day expiry)
 *   ✅ ADDED: GIS silent refresh as fallback when CF Worker not configured
 *   ✅ KEPT:  Same exported function signatures for backward compatibility
 */

import {
  storeDirectToken,
  getValidAccessToken,
  clearTokens,
  isAuthenticated,
  getStoredEmail,
  exchangeAuthCode,
  ensureGsiLoaded,
} from '../db/tokenManager.js';
import { saveToDrive, loadFromDrive, clearAllDriveBackups as clearAllDriveBackupsEngine, deleteBackupForPortfolio as deleteBackupForPortfolioEngine } from '../db/syncEngine.js';
import { bulkPutTrades }              from '../db/tradeStore.js';
import { loginWithGoogle }            from './firebase.js';

// Re-export tokenManager functions for direct use
export { getValidAccessToken, clearTokens, isAuthenticated, getStoredEmail, ensureGsiLoaded };

/**
 * Load the Google Identity Services script.
 * Idempotent — safe to call multiple times.
 * @returns {Promise<void>}
 */
export function loadGoogleGsiScript() {
  return ensureGsiLoaded();
}

/**
 * Request a Google Drive access token.
 *
 * Priority order:
 *   1. Return stored valid token from IDB (instant, no network)
 *   2. Use GIS Token Client to get fresh token (shows consent if needed)
 *
 * @returns {Promise<string>} access token
 */
export async function requestAccessToken() {
  // 1. Return stored valid token if not expired
  const stored = await getValidAccessToken().catch(() => null);
  if (stored) return stored;

  // 2. Request fresh Google token via Firebase Google Auth
  try {
    const res = await loginWithGoogle();
    if (res?.accessToken) {
      await storeDirectToken(res.accessToken, res.user?.email || '');
      try {
        localStorage.setItem('tradeontip_token', res.accessToken);
        localStorage.setItem('tradeontip_token_expiry', String(Date.now() + 3500 * 1000));
      } catch {}
      return res.accessToken;
    }
  } catch (err) {
    console.warn('[GoogleDrive] Google Auth token request failed:', err);
  }
  return '';
}

/**
 * Request an offline authorization code and exchange it via Cloudflare Worker
 * to obtain a 30-day refresh token.
 */
export async function requestOfflineRefreshToken(email) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return false;

  await loadGoogleGsiScript().catch(() => {});
  if (!window.google?.accounts?.oauth2) return false;

  return new Promise((resolve) => {
    try {
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        ux_mode: 'popup',
        prompt: 'select_account',
        callback: async (response) => {
          if (response.code) {
            console.log('[GoogleDrive] Received offline auth code, exchanging via CF Worker...');
            const success = await exchangeAuthCode(response.code, email);
            resolve(success);
          } else {
            resolve(false);
          }
        },
        error_callback: (err) => {
          console.warn('[GoogleDrive] Code client error:', err);
          resolve(false);
        }
      });
      client.requestCode();
    } catch (err) {
      console.warn('[GoogleDrive] initCodeClient error:', err);
      resolve(false);
    }
  });
}

/**
 * Store a Drive access token obtained from Firebase Auth credential.
 * Called from App.jsx after Google sign-in.
 *
 * @param {string} accessToken
 * @param {string} [email]
 * @returns {Promise<void>}
 */
export async function storeDriveToken(accessToken, email) {
  if (!accessToken || accessToken === 'demo-token') return;
  await storeDirectToken(accessToken, email);
}

/**
 * Download trades backup from Google Drive.
 * Delegates to syncEngine.loadFromDrive.
 *
 * @param {string} token — access token (ignored if IDB has valid token)
 * @param {string} [portfolioId]
 * @returns {Promise<object[]>}
 */
export async function downloadBackupFromDrive(token, portfolioId = 'default') {
  const validToken = await getValidAccessToken().catch(() => token);
  if (!validToken) return [];
  return loadFromDrive(portfolioId, validToken);
}

/**
 * Upload trades backup to Google Drive.
 * @param {string} token
 * @param {object[]} trades
 * @param {string} [portfolioId]
 */
export async function uploadBackupToDrive(token, trades, portfolioId = 'default', forceOverwrite = false) {
  const validToken = await getValidAccessToken().catch(() => token);
  if (!validToken) return false;
  const result = await saveToDrive(portfolioId, trades, validToken, forceOverwrite);
  return result.success;
}

/**
 * Delete all FoxTrade backup files from Google Drive.
 * @param {string} token
 * @returns {Promise<boolean>}
 */
export async function clearAllDriveBackups(token) {
  const validToken = await getValidAccessToken().catch(() => token);
  if (!validToken) return false;
  return clearAllDriveBackupsEngine(validToken);
}

/**
 * Delete backup file for a specific portfolio from Google Drive.
 * @param {string} token
 * @param {string} portfolioId
 * @returns {Promise<boolean>}
 */
export async function deleteBackupForPortfolio(token, portfolioId) {
  const validToken = await getValidAccessToken().catch(() => token);
  if (!validToken) return false;
  return deleteBackupForPortfolioEngine(portfolioId, validToken);
}

