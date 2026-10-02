/**
 * tokenManager.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Google OAuth token lifecycle manager.
 *
 * WHY THIS EXISTS:
 * The old code stored tokens in localStorage — which gets wiped by OS cleanup,
 * incognito mode, and storage pressure. This stores tokens in IndexedDB instead.
 *
 * The old code used GIS implicit flow — which only gives 1-hour access tokens
 * with NO refresh token. This routes through a Cloudflare Worker that holds the
 * client_secret and exchanges auth codes for proper 30-day refresh tokens.
 *
 * Token storage keys (in IDB app_config):
 *   gdrive_access_token  — current short-lived access token (1 hour)
 *   gdrive_token_expiry  — expiry timestamp in ms
 *   gdrive_refresh_token — long-lived refresh token (30 days)
 *   gdrive_user_email    — authenticated user email
 *
 * Flow:
 *   1. User signs in → Firebase Auth → getAccessToken from credential
 *   2. (Optional) Exchange auth code via CF Worker → get refresh_token
 *   3. On every Drive API call → getValidAccessToken()
 *      → if valid: return it
 *      → if expiring: call CF Worker /api/auth/refresh → new access token
 *      → if no CF Worker configured: fall back to GIS silent refresh
 *   4. On 401 from Drive → getValidAccessTokenWithRetry() handles it transparently
 *   5. If all refresh paths fail → subscribeToTokenExpired fires → UI shows reconnect banner
 *
 * Keepalive strategy (prevents disconnect when tab sleeps > 1 hour):
 *   - In-memory setTimeout (cleared on sleep, reset on visibilitychange)
 *   - visibilitychange listener: checks expiry on every tab focus
 *   - Proactive: refreshes 5 minutes BEFORE expiry, never waits for a 401
 */

import { getConfig, setConfig, deleteConfig } from './configStore.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Refresh the token 5 minutes before it actually expires */
const TOKEN_BUFFER_MS = 5 * 60 * 1000;

/** How often the visibility-check heartbeat runs when the tab is visible (ms) */
const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000; // every 4 minutes

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
let _refreshTimer    = null;
let _keepaliveTimer  = null;
let _isRefreshing    = false;         // prevents concurrent refresh races
let _refreshPromise  = null;          // shared promise during in-flight refresh
let _keepaliveActive = false;

// Token-expired subscribers — fire when all refresh paths fail
const _expiredListeners = new Set();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Subscribe to token-expired events.
 * Fires when the access token has expired AND all silent refresh paths have failed.
 * UI should show a "Reconnect Google Drive" banner when this fires.
 *
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
 * Store tokens after successful OAuth (called from firebase.js / googleDrive.js).
 *
 * @param {object} params
 * @param {string} params.accessToken
 * @param {string} [params.refreshToken]  — only available when CF Worker is used
 * @param {number} [params.expiresIn]     — seconds until access token expires (default 3600)
 * @param {string} [params.email]
 * @returns {Promise<void>}
 */
export async function storeTokens({ accessToken, refreshToken, expiresIn = 3600, email }) {
  const expiry = Date.now() + expiresIn * 1000;
  await setConfig(KEY_ACCESS_TOKEN, accessToken);
  await setConfig(KEY_TOKEN_EXPIRY, expiry);
  if (refreshToken) await setConfig(KEY_REFRESH_TOKEN, refreshToken);
  if (email)        await setConfig(KEY_USER_EMAIL,    email);

  try {
    localStorage.setItem('tradeontip_token', accessToken);
    localStorage.setItem('tradeontip_token_expiry', String(expiry));
  } catch {}

  // Schedule proactive auto-refresh
  _scheduleAutoRefresh(expiry);
  // Ensure keepalive is running
  initTokenKeepalive();
}

/**
 * Get a valid access token, refreshing automatically if needed.
 * This is the ONLY function that should be called before Drive API requests.
 *
 * @returns {Promise<string|null>} access token or null if not authenticated
 */
export async function getValidAccessToken() {
  const token  = await getConfig(KEY_ACCESS_TOKEN);
  const expiry = await getConfig(KEY_TOKEN_EXPIRY);

  if (!token) return null;

  // Token is still fresh — return it directly
  if (expiry && (expiry - Date.now()) > TOKEN_BUFFER_MS) {
    return token;
  }

  // Token is expiring or expired — deduplicate concurrent refresh calls
  if (_isRefreshing && _refreshPromise) {
    return _refreshPromise;
  }

  // Try to refresh
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
 * Get a valid token, and if a Drive API call returns 401, automatically
 * force-refresh and retry ONCE. Use this as the wrapper for all Drive calls.
 *
 * @param {(token: string) => Promise<Response>} driveCall — fn that takes a token and returns a fetch Response
 * @returns {Promise<Response>}
 */
export async function withAutoRefresh(driveCall) {
  let token = await getValidAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive.');

  const response = await driveCall(token);

  // On 401: force-refresh token and retry ONCE
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
 * Refresh the access token using the CF Worker (preferred) or GIS silent refresh.
 * Called automatically by getValidAccessToken() — rarely needed directly.
 *
 * @param {boolean} [force] — skip cache check and refresh unconditionally
 * @returns {Promise<string|null>} new access token or null on failure
 */
export async function refreshAccessToken(force = false) {
  // ── Path 1: CF Worker (proper refresh token, 30-day expiry) ──────────────
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
            await storeTokens({
              accessToken:  data.access_token,
              refreshToken: data.refresh_token || refreshToken, // keep old if not rotated
              expiresIn:    data.expires_in || 3600,
            });
            console.log('[TokenManager] Token refreshed via CF Worker ✓');
            return data.access_token;
          }
        } else {
          const errText = await resp.text().catch(() => '');
          console.warn('[TokenManager] CF Worker refresh failed:', resp.status, errText);
          // 400 = invalid_grant (refresh token revoked by user) → notify UI
          if (resp.status === 400 || resp.status === 401) {
            _notifyTokenExpired();
          }
        }
      } catch (err) {
        console.warn('[TokenManager] CF Worker refresh error:', err.message);
      }
    }
  }

  // ── Path 2: GIS silent refresh (no CF Worker configured) ─────────────────
  // Uses prompt: 'none' — works only while user has active Google session.
  const silentToken = await _silentGisRefresh();
  if (silentToken) return silentToken;

  // All paths failed — notify UI to show reconnect banner
  _notifyTokenExpired();
  return null;
}

/**
 * Clear all stored tokens (called on logout or Drive disconnect).
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

  // Also clear legacy localStorage tokens (including expiry key — was previously leaked)
  try {
    localStorage.removeItem('tradeontip_token');
    localStorage.removeItem('tradeontip_token_expiry');
    localStorage.removeItem('tradeontip_gdrive_token');
  } catch {}
}

/**
 * Check if user is authenticated with Drive.
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  const token = await getConfig(KEY_ACCESS_TOKEN);
  return !!token;
}

/**
 * Get the stored user email.
 * @returns {Promise<string|null>}
 */
export async function getStoredEmail() {
  return getConfig(KEY_USER_EMAIL);
}

/**
 * Get current token health status (for UI indicators).
 * @returns {Promise<{hasToken: boolean, hasRefreshToken: boolean, expiresIn: number|null, isExpired: boolean}>}
 */
export async function getTokenStatus() {
  const token        = await getConfig(KEY_ACCESS_TOKEN);
  const expiry       = await getConfig(KEY_TOKEN_EXPIRY);
  const refreshToken = await getConfig(KEY_REFRESH_TOKEN);
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
 * Exchange a Firebase/Google auth code for tokens via CF Worker.
 * Call this after Google sign-in to get a proper refresh token.
 *
 * @param {string} authCode — the one-time auth code from Google OAuth
 * @param {string} [email]
 * @returns {Promise<boolean>} true if successful
 */
export async function exchangeAuthCode(authCode, email) {
  if (!CF_WORKER_URL) {
    console.warn('[TokenManager] CF Worker URL not configured — cannot get refresh token');
    return false;
  }

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
    console.warn('[TokenManager] Auth code exchange failed:', resp.status);
    return false;
  } catch (err) {
    console.warn('[TokenManager] Auth code exchange error:', err.message);
    return false;
  }
}

/**
 * Store a direct access token (from Firebase credential).
 * Used when CF Worker is not configured — stores without refresh token.
 *
 * @param {string} accessToken
 * @param {string} [email]
 * @returns {Promise<void>}
 */
export async function storeDirectToken(accessToken, email) {
  await storeTokens({ accessToken, expiresIn: 3600, email });
}

/**
 * Initialize the persistent token keepalive system.
 * Call once on app init. Idempotent — safe to call multiple times.
 *
 * Strategy:
 *   1. A periodic interval (every 4 min) proactively checks and refreshes the token
 *      while the tab is visible — covers long trading sessions.
 *   2. A visibilitychange listener fires when the user returns to the tab after
 *      a sleep/background period — handles the "left it overnight" case.
 *   3. An online listener fires when the browser reconnects after going offline.
 *
 * @returns {() => void} cleanup function
 */
export function initTokenKeepalive() {
  if (_keepaliveActive) return () => {}; // already running
  _keepaliveActive = true;

  // ── Periodic heartbeat ────────────────────────────────────────────────────
  if (_keepaliveTimer) clearInterval(_keepaliveTimer);
  _keepaliveTimer = setInterval(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const token = await getConfig(KEY_ACCESS_TOKEN).catch(() => null);
    if (!token) return;
    const expiry = await getConfig(KEY_TOKEN_EXPIRY).catch(() => null);
    if (expiry && (expiry - Date.now()) <= TOKEN_BUFFER_MS) {
      console.log('[TokenManager] Keepalive: token expiring, proactively refreshing...');
      refreshAccessToken().catch(() => {});
    }
  }, KEEPALIVE_INTERVAL_MS);

  // ── visibilitychange: re-check on tab focus (covers browser sleep) ─────
  const onVisibilityChange = async () => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    const token  = await getConfig(KEY_ACCESS_TOKEN).catch(() => null);
    const expiry = await getConfig(KEY_TOKEN_EXPIRY).catch(() => null);
    if (!token) return;
    if (expiry && (expiry - Date.now()) <= TOKEN_BUFFER_MS) {
      console.log('[TokenManager] Keepalive: tab focused with expiring token — refreshing...');
      refreshAccessToken().catch(() => {});
    } else if (expiry) {
      // Token still valid — re-arm the in-memory timer in case it was killed by sleep
      _scheduleAutoRefresh(expiry);
    }
  };

  // ── online event: refresh when browser reconnects ─────────────────────
  const onOnline = async () => {
    const token  = await getConfig(KEY_ACCESS_TOKEN).catch(() => null);
    const expiry = await getConfig(KEY_TOKEN_EXPIRY).catch(() => null);
    if (!token) return;
    if (expiry && Date.now() >= expiry - TOKEN_BUFFER_MS) {
      console.log('[TokenManager] Keepalive: back online with expiring token — refreshing...');
      refreshAccessToken().catch(() => {});
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
  }

  return () => {
    _keepaliveActive = false;
    if (_keepaliveTimer) { clearInterval(_keepaliveTimer); _keepaliveTimer = null; }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline);
    }
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Shared refresh logic used by getValidAccessToken to deduplicate concurrent calls.
 */
async function _doRefresh(fallbackToken, expiry) {
  const newToken = await refreshAccessToken();
  if (newToken) return newToken;

  // If token is genuinely expired (past expiry timestamp), do not return dead token
  if (expiry && Date.now() >= expiry) {
    console.warn('[TokenManager] Token has expired and could not be refreshed silently.');
    return null;
  }

  return fallbackToken;
}

/**
 * Schedule automatic token refresh before expiry.
 * @param {number} expiry — timestamp ms when token expires
 */
function _scheduleAutoRefresh(expiry) {
  if (_refreshTimer) clearTimeout(_refreshTimer);

  const msUntilRefresh = expiry - Date.now() - TOKEN_BUFFER_MS;
  if (msUntilRefresh <= 0) {
    // Already expiring — refresh now
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

/**
 * Silent GIS token refresh (fallback when CF Worker not configured).
 * Uses Google Identity Services prompt:'none' — works only with active Google session.
 * @returns {Promise<string|null>}
 */
async function _silentGisRefresh() {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined') { resolve(null); return; }
      if (!window.google?.accounts?.oauth2) { resolve(null); return; }

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
      if (!clientId) { resolve(null); return; }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope:     'https://www.googleapis.com/auth/drive.file',
        callback:  async (response) => {
          if (response.error) { resolve(null); return; }
          await storeTokens({
            accessToken: response.access_token,
            expiresIn:   response.expires_in || 3600,
          });
          // Re-arm the auto-refresh timer after silent success
          _scheduleAutoRefresh(Date.now() + (response.expires_in || 3600) * 1000);
          resolve(response.access_token);
        },
      });

      client.requestAccessToken({ prompt: 'none' });

      // Timeout after 10s — GIS sometimes hangs silently
      setTimeout(() => resolve(null), 10_000);
    } catch {
      resolve(null);
    }
  });
}
