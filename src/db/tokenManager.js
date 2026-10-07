/**
 * tokenManager.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Google OAuth token lifecycle manager.
 *
 * Resilient Cloud Sync Architecture:
 *   - Google Drive access tokens (1 hour) stored in IndexedDB + localStorage.
 *   - Proactive silent refresh 5 minutes before expiry via GIS prompt:'none' (with email hint)
 *     or Cloudflare Worker /api/auth/refresh (30-day refresh token).
 *   - Cross-tab coordination: BroadcastChannel ('foxtrade_token_channel') + storage events.
 *     When ANY tab refreshes the token, all open tabs immediately receive the fresh token!
 *   - Background tab keepalive: Heartbeat continues running in hidden tabs.
 *   - Web Locks API coordination: Prevents concurrent duplicate refresh requests across tabs.
 *   - Non-destructive resilience: Expired tokens are never aggressively deleted on startup;
 *     instead, silent refresh is attempted first with exponential backoff.
 */

import { getConfig, setConfig, deleteConfig } from './configStore.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Refresh the token 5 minutes before it actually expires */
const TOKEN_BUFFER_MS = 5 * 60 * 1000;

/** How often the heartbeat runs (ms) */
const KEEPALIVE_INTERVAL_MS = 3 * 60 * 1000; // every 3 minutes

/** Cloudflare Worker URL — set in .env.local as VITE_CF_AUTH_WORKER_URL or VITE_BROKER_PROXY */
const CF_WORKER_URL = (() => {
  try { return import.meta.env.VITE_CF_AUTH_WORKER_URL || import.meta.env.VITE_BROKER_PROXY || ''; }
  catch { return ''; }
})();

// Keys in IDB app_config
const KEY_ACCESS_TOKEN  = 'gdrive_access_token';
const KEY_TOKEN_EXPIRY  = 'gdrive_token_expiry';
const KEY_REFRESH_TOKEN = 'gdrive_refresh_token';
const KEY_USER_EMAIL    = 'gdrive_user_email';

// In-memory state
let _refreshTimer               = null;
let _keepaliveTimer             = null;
let _isRefreshing               = false;
let _refreshPromise             = null;
let _keepaliveActive            = false;
let _gsiLoadPromise             = null;
let _consecutiveRefreshFailures = 0;
let _lastSuccessfulRefresh = 0;

// Subscribers
const _expiredListeners = new Set();
const _updateListeners  = new Set();

// ── Multi-Tab Cross-Communication Channel ──────────────────────────────────────
const BROADCAST_CHANNEL_NAME = 'foxtrade_token_channel';
const TAB_ID = typeof crypto !== 'undefined' && crypto.randomUUID 
  ? crypto.randomUUID() 
  : Math.random().toString(36).slice(2);

let _tokenChannel = null;
let _currentCachedToken = (() => {
  try { return (typeof localStorage !== 'undefined' ? localStorage.getItem('tradeontip_token') : null); }
  catch { return null; }
})();

function _initBroadcastChannel() {
  if (typeof BroadcastChannel === 'undefined' || _tokenChannel) return;
  try {
    _tokenChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    _tokenChannel.onmessage = (event) => {
      const msg = event?.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.senderId === TAB_ID) return; // Prevent echo from self

      if (msg.type === 'TOKEN_UPDATE' && msg.accessToken) {
        if (msg.accessToken === _currentCachedToken) return;
        console.log('[TokenManager] Cross-tab: received token update from another tab');
        _handleExternalTokenUpdate(msg.accessToken, msg.expiry, msg.email);
      } else if (msg.type === 'REQUEST_TOKEN') {
        _handleExternalTokenRequest();
      } else if (msg.type === 'TOKEN_REVOKED') {
        _handleExternalTokenRevoked();
      }
    };
  } catch (err) {
    console.warn('[TokenManager] BroadcastChannel init error:', err);
  }
}

// Storage event listener fallback (for older browsers or cross-context syncing)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'tradeontip_token' && e.newValue && e.newValue !== _currentCachedToken) {
      const exp = Number(localStorage.getItem('tradeontip_token_expiry') || (Date.now() + 3600_000));
      _handleExternalTokenUpdate(e.newValue, exp);
    } else if (e.key === 'tradeontip_token' && !e.newValue) {
      _currentCachedToken = null;
      _handleExternalTokenRevoked();
    }
  });
}

function _broadcastMessage(msg) {
  _initBroadcastChannel();
  if (_tokenChannel) {
    try {
      _tokenChannel.postMessage({ ...msg, senderId: TAB_ID });
    } catch {}
  }
}

function _broadcastTokenUpdate(accessToken, expiry, email) {
  _broadcastMessage({
    type: 'TOKEN_UPDATE',
    accessToken,
    expiry,
    email,
  });
}

function _broadcastTokenRevoked() {
  _broadcastMessage({ type: 'TOKEN_REVOKED' });
}

function _broadcastRequestToken() {
  _broadcastMessage({ type: 'REQUEST_TOKEN' });
}

async function _handleExternalTokenUpdate(accessToken, expiry, email) {
  if (!accessToken || accessToken === _currentCachedToken) return;
  _currentCachedToken = accessToken;

  await setConfig(KEY_ACCESS_TOKEN, accessToken).catch(() => {});
  if (expiry) await setConfig(KEY_TOKEN_EXPIRY, expiry).catch(() => {});
  if (email)  await setConfig(KEY_USER_EMAIL,    email).catch(() => {});

  try {
    if (localStorage.getItem('tradeontip_token') !== accessToken) {
      localStorage.setItem('tradeontip_token', accessToken);
    }
    if (expiry && localStorage.getItem('tradeontip_token_expiry') !== String(expiry)) {
      localStorage.setItem('tradeontip_token_expiry', String(expiry));
    }
  } catch {}

  _consecutiveRefreshFailures = 0;
  _notifyTokenUpdate(accessToken);

  if (expiry) {
    _scheduleAutoRefresh(expiry);
  }
}

async function _handleExternalTokenRequest() {
  const token  = (await getConfig(KEY_ACCESS_TOKEN).catch(() => null)) || (typeof localStorage !== 'undefined' ? localStorage.getItem('tradeontip_token') : null);
  const expiry = (await getConfig(KEY_TOKEN_EXPIRY).catch(() => null)) || (typeof localStorage !== 'undefined' ? Number(localStorage.getItem('tradeontip_token_expiry')) : null);
  const email  = await getConfig(KEY_USER_EMAIL).catch(() => null);

  if (token && expiry && (expiry - Date.now()) > TOKEN_BUFFER_MS) {
    _broadcastTokenUpdate(token, expiry, email);
  }
}

function _handleExternalTokenRevoked() {
  if (_refreshTimer)   { clearTimeout(_refreshTimer);   _refreshTimer   = null; }
  if (_keepaliveTimer) { clearInterval(_keepaliveTimer); _keepaliveTimer = null; }
  _keepaliveActive = false;
  _notifyTokenUpdate(null);
}

// ── GIS Script Loader ─────────────────────────────────────────────────────────

/**
 * Ensure the Google Identity Services script is loaded into the page.
 * Idempotent — safe to call multiple times.
 * @returns {Promise<void>}
 */
export function ensureGsiLoaded() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (_gsiLoadPromise) return _gsiLoadPromise;

  _gsiLoadPromise = new Promise((resolve) => {
    if (document.querySelector('script[src*="gsi/client"]')) {
      const check = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(check);
        resolve();
      }, 10_000);
      return;
    }
    const script   = document.createElement('script');
    script.src     = 'https://accounts.google.com/gsi/client';
    script.async   = true;
    script.defer   = true;
    script.onload  = () => resolve();
    script.onerror = (err) => {
      console.warn('[TokenManager] Failed to load Google GIS script:', err);
      resolve();
    };
    document.head.appendChild(script);
  });
  return _gsiLoadPromise;
}

// ── Public Subscriptions ──────────────────────────────────────────────────────

/**
 * Subscribe to token-expired events.
 * Fires ONLY when all silent refresh paths have genuinely failed on an expired session.
 * @param {() => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribeToTokenExpired(callback) {
  _expiredListeners.add(callback);
  return () => _expiredListeners.delete(callback);
}

function _notifyTokenExpired() {
  _expiredListeners.forEach(cb => { try { cb(); } catch (_) {} });
}

/**
 * Subscribe to token updates (fires when a fresh token is acquired, refreshed, or received from another tab).
 * @param {(accessToken: string|null) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribeToTokenUpdate(callback) {
  _updateListeners.add(callback);
  // Immediately notify with current token if available
  getConfig(KEY_ACCESS_TOKEN).then(tok => {
    if (tok) callback(tok);
  }).catch(() => {});
  return () => _updateListeners.delete(callback);
}

function _notifyTokenUpdate(token) {
  _updateListeners.forEach(cb => { try { cb(token); } catch (_) {} });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Store tokens after OAuth (called from login / refresh).
 *
 * @param {object} params
 * @param {string} params.accessToken
 * @param {string} [params.refreshToken]
 * @param {number} [params.expiresIn]
 * @param {string} [params.email]
 * @returns {Promise<void>}
 */
export async function storeTokens({ accessToken, refreshToken, expiresIn = 3600, email }) {
  if (!accessToken) return;
  const isSame = accessToken === _currentCachedToken;
  _currentCachedToken = accessToken;

  const expiry = Date.now() + expiresIn * 1000;
  await setConfig(KEY_ACCESS_TOKEN, accessToken);
  await setConfig(KEY_TOKEN_EXPIRY, expiry);
  if (refreshToken) await setConfig(KEY_REFRESH_TOKEN, refreshToken);
  if (email)        await setConfig(KEY_USER_EMAIL,    email);

  try {
    if (localStorage.getItem('tradeontip_token') !== accessToken) {
      localStorage.setItem('tradeontip_token', accessToken);
    }
    if (localStorage.getItem('tradeontip_token_expiry') !== String(expiry)) {
      localStorage.setItem('tradeontip_token_expiry', String(expiry));
    }
  } catch {}

  _consecutiveRefreshFailures = 0;
  _lastSuccessfulRefresh = Date.now();

  if (!isSame) {
    // Broadcast token update to other tabs
    _broadcastTokenUpdate(accessToken, expiry, email);

    // Notify local subscribers
    _notifyTokenUpdate(accessToken);
  }

  // Schedule proactive auto-refresh
  _scheduleAutoRefresh(expiry);

  // Ensure keepalive is running
  initTokenKeepalive();
}

/**
 * Get a valid access token, refreshing automatically if needed.
 * Safe for multi-tab environments.
 *
 * @returns {Promise<string|null>} access token or null if not authenticated
 */
export async function getValidAccessToken() {
  let token  = await getConfig(KEY_ACCESS_TOKEN).catch(() => null);
  let expiry = await getConfig(KEY_TOKEN_EXPIRY).catch(() => null);

  // Fallback to localStorage if IDB hasn't loaded or is empty
  if (!token && typeof localStorage !== 'undefined') {
    token = localStorage.getItem('tradeontip_token');
    const expStr = localStorage.getItem('tradeontip_token_expiry');
    if (expStr) expiry = Number(expStr);
  }

  if (!token) return null;

  // Token is still fresh — return directly
  if (expiry && (expiry - Date.now()) > TOKEN_BUFFER_MS) {
    return token;
  }

  // Token is expiring or expired — deduplicate concurrent refresh calls
  if (_isRefreshing && _refreshPromise) {
    return _refreshPromise;
  }

  console.log('[TokenManager] Access token expiring soon or expired, refreshing...');
  _isRefreshing   = true;
  _refreshPromise = _doRefresh(token, expiry);

  try {
    return await _refreshPromise;
  } finally {
    _isRefreshing   = false;
    _refreshPromise = null;
  }
}

/**
 * Wrapper for Drive calls that automatically retries once on 401.
 *
 * @param {(token: string) => Promise<Response>} driveCall
 * @returns {Promise<Response>}
 */
export async function withAutoRefresh(driveCall) {
  let token = await getValidAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive.');

  const response = await driveCall(token);

  if (response.status === 401) {
    console.warn('[TokenManager] Drive API returned 401 — force-refreshing token and retrying...');
    const newToken = await refreshAccessToken(/* forceRefresh */ true);
    if (!newToken) {
      _notifyTokenExpired();
      throw new Error('Google Drive session expired. Please reconnect Google Drive.');
    }
    return driveCall(newToken);
  }

  return response;
}

/**
 * Refresh the access token using CF Worker (preferred) or GIS silent refresh.
 *
 * @param {boolean} [force]
 * @returns {Promise<string|null>} new access token or null on failure
 */
export async function refreshAccessToken(force = false) {
  // If we recently refreshed successfully within the last 10 seconds and have a valid cached token, return it
  if (Date.now() - _lastSuccessfulRefresh < 10000 && _currentCachedToken) {
    return _currentCachedToken;
  }

  // If we already have a refresh running, await it
  if (_isRefreshing && _refreshPromise) {
    return _refreshPromise;
  }

  // ── Path 1: CF Worker (refresh token exchange) ───────────────────────────
  if (CF_WORKER_URL) {
    const refreshToken = await getConfig(KEY_REFRESH_TOKEN);
    if (refreshToken) {
      try {
        const resp = await fetch(`${CF_WORKER_URL}/api/auth/refresh`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ refreshToken }),
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data.access_token) {
            _consecutiveRefreshFailures = 0;
            await storeTokens({
              accessToken:  data.access_token,
              refreshToken: data.refresh_token || refreshToken,
              expiresIn:    data.expires_in || 3600,
            });
            console.log('[TokenManager] Token refreshed via CF Worker ✓');
            return data.access_token;
          }
        } else {
          const errText = await resp.text().catch(() => '');
          console.warn('[TokenManager] CF Worker refresh failed:', resp.status, errText);
          if (resp.status === 400 || resp.status === 401) {
            _notifyTokenExpired();
            return null;
          }
        }
      } catch (err) {
        console.warn('[TokenManager] CF Worker refresh error:', err.message);
      }
    }
  }

  // ── Path 2: GIS silent refresh (Identity Services prompt:'none' + hint) ──
  const silentToken = await _silentGisRefresh();
  if (silentToken) {
    _consecutiveRefreshFailures = 0;
    return silentToken;
  }

  _consecutiveRefreshFailures++;

  // Check if current token in IDB / localStorage is still technically valid
  const currentExpiry = (await getConfig(KEY_TOKEN_EXPIRY).catch(() => null)) ||
    (typeof localStorage !== 'undefined' ? Number(localStorage.getItem('tradeontip_token_expiry')) : null);
  const isStillValid = currentExpiry && (currentExpiry - Date.now()) > 0;

  if (isStillValid) {
    // Proactive refresh failed, but token has NOT expired yet!
    // Never show an error banner to the user. Schedule a retry in 45s.
    console.log(`[TokenManager] Proactive refresh attempt ${_consecutiveRefreshFailures} failed, token still valid for ${Math.round((currentExpiry - Date.now()) / 1000)}s. Retrying in 45s...`);
    setTimeout(() => {
      refreshAccessToken().catch(() => {});
    }, 45_000);
    const existingTok = await getConfig(KEY_ACCESS_TOKEN).catch(() => null);
    return existingTok;
  }

  // If token is genuinely expired, retry up to 2 times before declaring disconnect
  if (_consecutiveRefreshFailures < 3) {
    console.warn(`[TokenManager] Silent refresh attempt ${_consecutiveRefreshFailures} failed on expired token. Retrying in 6s...`);
    setTimeout(() => {
      refreshAccessToken().catch(() => {});
    }, 6_000);
    return null;
  }

  console.warn('[TokenManager] All silent refresh paths failed after multiple attempts — notifying token expired.');
  _notifyTokenExpired();
  return null;
}

/**
 * Clear all stored tokens (called on explicit user sign-out).
 * @returns {Promise<void>}
 */
export async function clearTokens() {
  if (_refreshTimer)   { clearTimeout(_refreshTimer);   _refreshTimer   = null; }
  if (_keepaliveTimer) { clearInterval(_keepaliveTimer); _keepaliveTimer = null; }
  _keepaliveActive = false;

  await deleteConfig(KEY_ACCESS_TOKEN);
  await deleteConfig(KEY_TOKEN_EXPIRY);
  await deleteConfig(KEY_REFRESH_TOKEN);
  await deleteConfig(KEY_USER_EMAIL);

  try {
    localStorage.removeItem('tradeontip_token');
    localStorage.removeItem('tradeontip_token_expiry');
    localStorage.removeItem('tradeontip_gdrive_token');
  } catch {}

  _broadcastTokenRevoked();
  _notifyTokenUpdate(null);
}

/**
 * Check if user is authenticated with Drive.
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  const token = (await getConfig(KEY_ACCESS_TOKEN).catch(() => null)) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('tradeontip_token') : null);
  return !!token;
}

/**
 * Get stored user email.
 * @returns {Promise<string|null>}
 */
export async function getStoredEmail() {
  return getConfig(KEY_USER_EMAIL);
}

/**
 * Get current token health status.
 * @returns {Promise<{hasToken: boolean, hasRefreshToken: boolean, expiresIn: number|null, isExpired: boolean, canSilentRefresh: boolean}>}
 */
export async function getTokenStatus() {
  const token        = (await getConfig(KEY_ACCESS_TOKEN).catch(() => null)) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('tradeontip_token') : null);
  const expiry       = (await getConfig(KEY_TOKEN_EXPIRY).catch(() => null)) ||
    (typeof localStorage !== 'undefined' ? Number(localStorage.getItem('tradeontip_token_expiry')) : null);
  const refreshToken = await getConfig(KEY_REFRESH_TOKEN).catch(() => null);
  const now          = Date.now();
  return {
    hasToken:        !!token,
    hasRefreshToken: !!refreshToken,
    expiresIn:       expiry ? Math.max(0, Math.floor((expiry - now) / 1000)) : null,
    isExpired:       expiry ? now >= expiry : !token ? true : false,
    canSilentRefresh: !!(CF_WORKER_URL && refreshToken) || !!(typeof window !== 'undefined' && window.google?.accounts?.oauth2),
  };
}

/**
 * Exchange auth code via CF Worker.
 * @param {string} authCode
 * @param {string} [email]
 * @returns {Promise<boolean>}
 */
export async function exchangeAuthCode(authCode, email) {
  if (!CF_WORKER_URL) return false;
  try {
    const resp = await fetch(`${CF_WORKER_URL}/api/auth/exchange`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code: authCode, email }),
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data.access_token) {
        await storeTokens({
          accessToken:  data.access_token,
          refreshToken: data.refresh_token,
          expiresIn:    data.expires_in || 3600,
          email,
        });
        console.log('[TokenManager] Auth code exchanged for refresh token ✓');
        return true;
      }
    }
    return false;
  } catch (err) {
    console.warn('[TokenManager] Auth code exchange error:', err.message);
    return false;
  }
}

/**
 * Store a direct access token.
 * @param {string} accessToken
 * @param {string} [email]
 * @returns {Promise<void>}
 */
export async function storeDirectToken(accessToken, email) {
  await storeTokens({ accessToken, expiresIn: 3600, email });
}

/**
 * Initialize persistent token keepalive across all tabs and background windows.
 * @returns {() => void} cleanup function
 */
export function initTokenKeepalive() {
  _initBroadcastChannel();
  ensureGsiLoaded().catch(() => {});

  if (_keepaliveActive) return () => {};
  _keepaliveActive = true;

  // Proactively ask if another active tab already has a fresh token if we lack one
  if (!_currentCachedToken) {
    _broadcastRequestToken();
  }

  // ── Heartbeat (runs in foreground & background tabs) ───────────────────
  if (_keepaliveTimer) clearInterval(_keepaliveTimer);
  _keepaliveTimer = setInterval(async () => {
    const token = (await getConfig(KEY_ACCESS_TOKEN).catch(() => null)) ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('tradeontip_token') : null);
    if (!token) return;

    const expiry = (await getConfig(KEY_TOKEN_EXPIRY).catch(() => null)) ||
      (typeof localStorage !== 'undefined' ? Number(localStorage.getItem('tradeontip_token_expiry')) : null);

    if (expiry && (expiry - Date.now()) <= TOKEN_BUFFER_MS) {
      console.log('[TokenManager] Keepalive: token expiring within buffer — refreshing proactively...');
      // Use Web Locks API if available to coordinate across multiple tabs
      if (typeof navigator !== 'undefined' && navigator.locks) {
        navigator.locks.request('foxtrade_token_refresh', { ifAvailable: true }, async (lock) => {
          if (!lock) {
            console.log('[TokenManager] Another tab is already performing token refresh, standing by.');
            return;
          }
          await refreshAccessToken().catch(() => {});
        }).catch(() => refreshAccessToken().catch(() => {}));
      } else {
        refreshAccessToken().catch(() => {});
      }
    }
  }, KEEPALIVE_INTERVAL_MS);

  // ── visibilitychange: re-check on tab focus / wake ─────────────────────
  const onVisibilityChange = async () => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    const token  = (await getConfig(KEY_ACCESS_TOKEN).catch(() => null)) ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('tradeontip_token') : null);
    const expiry = (await getConfig(KEY_TOKEN_EXPIRY).catch(() => null)) ||
      (typeof localStorage !== 'undefined' ? Number(localStorage.getItem('tradeontip_token_expiry')) : null);

    if (!token) {
      if (!_currentCachedToken) _broadcastRequestToken();
      return;
    }
    if (expiry && (expiry - Date.now()) <= TOKEN_BUFFER_MS) {
      console.log('[TokenManager] Keepalive: tab focused with expiring token — refreshing...');
      refreshAccessToken().catch(() => {});
    } else if (expiry) {
      _scheduleAutoRefresh(expiry);
    }
  };

  // ── window focus event: also triggers on switching browser tabs or windows ───
  const onWindowFocus = async () => {
    const token  = (await getConfig(KEY_ACCESS_TOKEN).catch(() => null)) ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('tradeontip_token') : null);
    const expiry = (await getConfig(KEY_TOKEN_EXPIRY).catch(() => null)) ||
      (typeof localStorage !== 'undefined' ? Number(localStorage.getItem('tradeontip_token_expiry')) : null);

    if (!token) return;
    if (expiry && (expiry - Date.now()) <= TOKEN_BUFFER_MS) {
      refreshAccessToken().catch(() => {});
    }
  };

  // ── online event: refresh when browser reconnects from offline ─────────
  const onOnline = async () => {
    const token  = (await getConfig(KEY_ACCESS_TOKEN).catch(() => null)) ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('tradeontip_token') : null);
    const expiry = (await getConfig(KEY_TOKEN_EXPIRY).catch(() => null)) ||
      (typeof localStorage !== 'undefined' ? Number(localStorage.getItem('tradeontip_token_expiry')) : null);

    if (!token) return;
    if (expiry && (expiry - Date.now()) <= TOKEN_BUFFER_MS) {
      console.log('[TokenManager] Keepalive: back online with expiring token — refreshing...');
      refreshAccessToken().catch(() => {});
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('online', onOnline);
  }

  return () => {
    _keepaliveActive = false;
    if (_keepaliveTimer) { clearInterval(_keepaliveTimer); _keepaliveTimer = null; }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('online', onOnline);
    }
  };
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

async function _doRefresh(fallbackToken, expiry) {
  const newToken = await refreshAccessToken();
  if (newToken) return newToken;

  if (expiry && Date.now() >= expiry) {
    console.warn('[TokenManager] Token has expired and could not be refreshed silently.');
    return null;
  }

  return fallbackToken;
}

function _scheduleAutoRefresh(expiry) {
  if (_refreshTimer) clearTimeout(_refreshTimer);

  const msUntilRefresh = expiry - Date.now() - TOKEN_BUFFER_MS;
  if (msUntilRefresh <= 0) {
    refreshAccessToken().catch(err => console.warn('[TokenManager] Auto-refresh error:', err.message));
    return;
  }

  _refreshTimer = setTimeout(async () => {
    _refreshTimer = null;
    try {
      await refreshAccessToken();
    } catch (err) {
      console.warn('[TokenManager] Scheduled refresh failed:', err.message);
    }
  }, msUntilRefresh);
}

async function _silentGisRefresh() {
  return new Promise(async (resolve) => {
    try {
      if (typeof window === 'undefined') { resolve(null); return; }

      await ensureGsiLoaded();

      if (!window.google?.accounts?.oauth2) {
        console.warn('[TokenManager] GIS oauth2 not available');
        resolve(null);
        return;
      }

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
      if (!clientId) {
        console.warn('[TokenManager] No VITE_GOOGLE_CLIENT_ID configured');
        resolve(null);
        return;
      }

      // Retrieve user email hint
      let userEmail = await getConfig(KEY_USER_EMAIL).catch(() => null);
      if (!userEmail) {
        try {
          const uStr = localStorage.getItem('tradeontip_user');
          if (uStr) {
            const u = JSON.parse(uStr);
            if (u?.email) userEmail = u.email;
          }
        } catch {}
      }

      let resolved = false;
      const safeResolve = (val) => {
        if (!resolved) {
          resolved = true;
          resolve(val);
        }
      };

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope:     'https://www.googleapis.com/auth/drive.file',
        callback:  async (response) => {
          if (response?.error) {
            console.warn('[TokenManager] GIS silent refresh error:', response.error, response.error_description);
            safeResolve(null);
            return;
          }
          if (!response?.access_token) {
            safeResolve(null);
            return;
          }

          console.log('[TokenManager] GIS silent refresh successful ✓');
          await storeTokens({
            accessToken: response.access_token,
            expiresIn:   response.expires_in || 3600,
            email:       userEmail,
          });
          safeResolve(response.access_token);
        },
        error_callback: (err) => {
          console.warn('[TokenManager] GIS client error callback:', err);
          safeResolve(null);
        }
      });

      const requestConfig = { prompt: 'none' };
      if (userEmail) {
        requestConfig.hint = userEmail;
      }

      client.requestAccessToken(requestConfig);

      // 12s safety timeout
      setTimeout(() => {
        if (!resolved) {
          console.warn('[TokenManager] GIS silent refresh timed out after 12s');
          safeResolve(null);
        }
      }, 12_000);

    } catch (err) {
      console.warn('[TokenManager] GIS silent refresh exception:', err);
      resolve(null);
    }
  });
}
