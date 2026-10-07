/**
 * driveClient.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized Google Drive API client with auto-refresh, credential persistence,
 * transient retry with backoff, and robust `invalid_grant` handling.
 *
 * All Drive API operations in FoxTrade (syncEngine, imageStore, backup modals)
 * route through this single helper.
 */

import {
  getValidAccessToken,
  refreshAccessToken,
  handleInvalidGrant,
  getDriveStatus,
  setDriveStatus,
  subscribeToDriveStatus,
  checkWeeklyKeepalive,
} from '../db/tokenManager.js';

const DRIVE_ABOUT_URL = 'https://www.googleapis.com/drive/v3/about?fields=user';

/**
 * Check if an HTTP status code is a transient server error suitable for 1-time retry.
 */
function isTransientError(status) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/**
 * Delay helper for exponential backoff.
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates or retrieves the centralized Drive client instance.
 *
 * @param {string} [userId] - Optional Firebase user UID
 * @returns {object} Drive client interface
 */
export function getDriveClient(userId = null) {
  return {
    getUserId: () => userId,
    getStatus: () => getDriveStatus(),

    /**
     * Centralized fetch wrapper for Google Drive APIs.
     *
     * Features:
     *   1. Obtains fresh token via getValidAccessToken(userId)
     *   2. Injects Bearer token
     *   3. Retries once on transient 408/429/5xx errors with 1000ms backoff
     *   4. On 401, force-refreshes token once and retries
     *   5. Catches `invalid_grant` and transitions driveStatus to 'needs_reconnect'
     *
     * @param {string} url
     * @param {RequestInit} [options={}]
     * @returns {Promise<Response>}
     */
    async fetch(url, options = {}) {
      let currentToken = await getValidAccessToken(userId).catch(() => null);
      if (!currentToken || currentToken === 'demo-token') {
        const status = getDriveStatus();
        if (status === 'needs_reconnect') {
          throw new Error('Google Drive connection was revoked or expired. Please reconnect Google Drive.');
        }
        throw new Error('Not authenticated with Google Drive.');
      }

      const buildHeaders = (tok) => {
        const base = options.headers || {};
        if (typeof Headers !== 'undefined' && base instanceof Headers) {
          const h = new Headers(base);
          h.set('Authorization', `Bearer ${tok}`);
          return h;
        }
        return {
          ...base,
          Authorization: `Bearer ${tok}`,
        };
      };

      let resp;
      try {
        resp = await fetch(url, { ...options, headers: buildHeaders(currentToken) });
      } catch (networkErr) {
        // Retry once on transient network drop with 1000ms backoff
        console.warn('[DriveClient] Network error during Drive fetch, retrying in 1s...', networkErr.message);
        await delay(1000);
        currentToken = (await getValidAccessToken(userId).catch(() => null)) || currentToken;
        resp = await fetch(url, { ...options, headers: buildHeaders(currentToken) });
      }

      // Handle transient server errors (5xx, 429) with 1 retry after backoff
      if (isTransientError(resp.status)) {
        console.warn(`[DriveClient] Transient status ${resp.status} from Drive API, retrying in 1.2s...`);
        await delay(1200);
        resp = await fetch(url, { ...options, headers: buildHeaders(currentToken) });
      }

      // Handle 401 Unauthorized: token expired or revoked
      if (resp.status === 401) {
        console.warn('[DriveClient] Drive API returned 401 Unauthorized — force-refreshing credentials and retrying once...');
        const refreshedToken = await refreshAccessToken(true, userId).catch((err) => {
          if (err?.message?.includes('invalid_grant')) {
            handleInvalidGrant(userId);
          }
          return null;
        });

        if (refreshedToken) {
          resp = await fetch(url, { ...options, headers: buildHeaders(refreshedToken) });
          if (resp.ok) {
            setDriveStatus('connected');
          }
        } else {
          // If refresh returned null/failed due to invalid_grant
          const status = getDriveStatus();
          if (status === 'needs_reconnect') {
            throw new Error('Google Drive session was revoked or expired. Please click "Reconnect Google Drive".');
          }
        }
      }

      return resp;
    },

    /**
     * Cheap drive.about.get call for connection verification & keepalive.
     * @returns {Promise<object>}
     */
    async getAbout() {
      const resp = await this.fetch(DRIVE_ABOUT_URL, { method: 'GET' });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Drive about ping failed: ${resp.status} ${text}`);
      }
      return resp.json();
    },

    /**
     * Keepalive check wrapper.
     */
    async pingKeepalive() {
      return checkWeeklyKeepalive(userId);
    },
  };
}

export { subscribeToDriveStatus, getDriveStatus, setDriveStatus };
