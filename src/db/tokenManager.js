/**
 * tokenManager.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Google OAuth token lifecycle manager with persistent refresh token storage,
 * AES-256-GCM encryption, cross-tab synchronization, and proactive auto-refresh.
 *
 * Resilient Cloud Sync Architecture:
 *   - Google Drive access tokens (1 hour) stored in IndexedDB + localStorage.
 *   - Persistent refresh tokens encrypted via AES-256-GCM in IDB & Firestore.
 *   - Never overwrites stored refresh token with empty value (Google only returns on consent).
 *   - Reuses stored refresh token without prompting on subsequent logins.
 *   - Automatic refresh via Cloudflare Worker /api/auth/refresh before expiry.
 *   - Detects `invalid_grant` specifically and transitions status to 'needs_reconnect'.
 *   - Weekly keepalive check to prevent 6-month idle revocation.
 *   - Cross-tab coordination: BroadcastChannel ('foxtrade_token_channel') + storage events.
 */

import { getConfig, setConfig, deleteConfig } from './configStore.js';
import { encryptToken, decryptToken } from '../utils/tokenEncryption.js';
import { db } from '../services/firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Refresh the token 5 minutes before it actually expires */
const TOKEN_BUFFER_MS = 5 * 60 * 1000;

/** How often the heartbeat runs (ms) */
const KEEPALIVE_INTERVAL_MS = 3 * 60 * 1000; // every 3 minutes

/** Weekly keepalive interval in ms (7 days) */
const WEEKLY_KEEPALIVE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/** Cloudflare Worker URL — set in .env.local as VITE_CF_AUTH_WORKER_URL or VITE_BROKER_PROXY */
const CF_WORKER_URL = (() => {
  try { return import.meta.env.VITE_CF_AUTH_WORKER_URL || import.meta.env.VITE_BROKER_PROXY || ''; }
  catch { return ''; }
})();

// Keys in IDB app_config
const KEY_ACCESS_TOKEN            = 'gdrive_access_token';
const KEY_TOKEN_EXPIRY            = 'gdrive_token_expiry';
const KEY_REFRESH_TOKEN           = 'gdrive_refresh_token';
const KEY_ENCRYPTED_REFRESH_TOKEN = 'gdrive_encrypted_refresh_token';
const KEY_USER_EMAIL              = 'gdrive_user_email';
const KEY_USER_ID                 = 'gdrive_user_uid';
const KEY_DRIVE_STATUS            = 'gdrive_status';
const KEY_LAST_KEEPALIVE          = 'gdrive_last_keepalive';

// In-memory state
let _refreshTimer               = null;
let _keepaliveTimer             = null;
let _isRefreshing               = false;
let _refreshPromise             = null;
let _keepaliveActive            = false;
let _gsiLoadPromise             = null;
let _consecutiveRefreshFailures = 0;
let _lastSuccessfulRefresh      = 0;
let _cachedPlainRefreshToken    = null;

let _driveStatus = (() => {
  try {
    return localStorage.getItem('tradeontip_drive_status') || 'connected';
  } catch {
    return 'connected';
  }
})();

// Subscribers
const _expiredListeners     = new Set();
const _updateListeners      = new Set();
const _driveStatusListeners = new Set();

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
      } else if (msg.type === 'DRIVE_STATUS_CHANGE') {
        setDriveStatus(msg.status, false);
      }
    };
  } catch (err) {
    console.warn('[TokenManager] BroadcastChannel init error:', err);
  }
}

// Storage event listener fallback (for cross-context syncing)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'tradeontip_token' && e.newValue && e.newValue !== _currentCachedToken) {
      const exp = Number(localStorage.getItem('tradeontip_token_expiry') || (Date.now() + 3600_000));
      _handleExternalTokenUpdate(e.newValue, exp);
    } else if (e.key === 'tradeontip_token' && !e.newValue) {
      _currentCachedToken = null;
      _handleExternalTokenRevoked();
    } else if (e.key === 'tradeontip_drive_status' && e.newValue) {
      setDriveStatus(e.newValue, false);
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

function _broadcastStatusChange(status) {
  _broadcastMessage({ type: 'DRIVE_STATUS_CHANGE', status });
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

// ── Drive Status & Subscriptions ──────────────────────────────────────────────

/**
 * Get current Drive connection status ('connected' | 'needs_reconnect' | 'disconnected').
 */
export function getDriveStatus() {
  return _driveStatus;
}

/**
 * Update Drive connection status and notify subscribers.
 */
export function setDriveStatus(status, broadcast = true) {
  if (!status) return;
  _driveStatus = status;
  try {
    localStorage.setItem('tradeontip_drive_status', status);
  } catch {}
  setConfig(KEY_DRIVE_STATUS, status).catch(() => {});
  _driveStatusListeners.forEach(cb => { try { cb(status); } catch (_) {} });
  if (broadcast) {
    _broadcastStatusChange(status);
  }
}

/**
 * Subscribe to Drive status changes.
 */
export function subscribeToDriveStatus(callback) {
  _driveStatusListeners.add(callback);
  callback(_driveStatus);
  return () => _driveStatusListeners.delete(callback);
}

/**
 * Handle invalid_grant: set user.driveStatus = 'needs_reconnect', clear stored token,
 * and prompt user to reconnect.
 */
export async function handleInvalidGrant(userId = null) {
  console.warn('[TokenManager] Google Drive access revoked or token invalid (invalid_grant). Flagging needs_reconnect.');
  setDriveStatus('needs_reconnect');

  // Update Firestore user record
  const uid = userId || (await getConfig(KEY_USER_ID).catch(() => null));
  if (uid && !uid.startsWith('demo-') && db) {
    try {
      await setDoc(doc(db, 'users', uid), {
        driveStatus: 'needs_reconnect',
        updatedAt: Date.now(),
      }, { merge: true });
    } catch (err) {
      console.warn('[TokenManager] Failed to update Firestore driveStatus:', err.message);
    }
  }

  // Clear local access and refresh tokens
  _cachedPlainRefreshToken = null;
  await deleteConfig(KEY_ACCESS_TOKEN).catch(() => {});
  await deleteConfig(KEY_TOKEN_EXPIRY).catch(() => {});
  await deleteConfig(KEY_REFRESH_TOKEN).catch(() => {});
  await deleteConfig(KEY_ENCRYPTED_REFRESH_TOKEN).catch(() => {});

  try {
    localStorage.removeItem('tradeontip_token');
    localStorage.removeItem('tradeontip_token_expiry');
  } catch {}

  _notifyTokenExpired();
  _notifyTokenUpdate(null);
}

// ── GIS Script Loader ─────────────────────────────────────────────────────────

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

export function subscribeToTokenExpired(callback) {
  _expiredListeners.add(callback);
  return () => _expiredListeners.delete(callback);
}

function _notifyTokenExpired() {
  _expiredListeners.forEach(cb => { try { cb(); } catch (_) {} });
}

export function subscribeToTokenUpdate(callback) {
  _updateListeners.add(callback);
  getConfig(KEY_ACCESS_TOKEN).then(tok => {
    if (tok) callback(tok);
  }).catch(() => {});
  return () => _updateListeners.delete(callback);
}

function _notifyTokenUpdate(token) {
  _updateListeners.forEach(cb => { try { cb(token); } catch (_) {} });
}

// ── Stored Refresh Token Management ───────────────────────────────────────────

/**
 * Check if the user already has a valid stored refresh token (in memory, IDB, or Firestore).
 * Used so we NEVER prompt a user to re-authorize on login if they already connected once.
 */
export async function hasStoredRefreshToken(userId = null) {
  if (_cachedPlainRefreshToken) return true;

  const idbEnc = await getConfig(KEY_ENCRYPTED_REFRESH_TOKEN).catch(() => null);
  if (idbEnc) return true;

  const idbPlain = await getConfig(KEY_REFRESH_TOKEN).catch(() => null);
  if (idbPlain) return true;

  const uid = userId || (await getConfig(KEY_USER_ID).catch(() => null));
  if (uid && !uid.startsWith('demo-') && db) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists() && snap.data()?.encryptedRefreshToken) {
        return true;
      }
    } catch {}
  }

  return false;
}

/**
 * Retrieve decrypted refresh token from memory, IDB, or Firestore.
 */
export async function getStoredRefreshToken(userId = null) {
  if (_cachedPlainRefreshToken) return _cachedPlainRefreshToken;

  // 1. Check IDB encrypted token
  const idbEnc = await getConfig(KEY_ENCRYPTED_REFRESH_TOKEN).catch(() => null);
  if (idbEnc) {
    const dec = await decryptToken(idbEnc);
    if (dec) {
      _cachedPlainRefreshToken = dec;
      return dec;
    }
  }

  // 2. Check legacy IDB plain token
  const idbPlain = await getConfig(KEY_REFRESH_TOKEN).catch(() => null);
  if (idbPlain) {
    _cachedPlainRefreshToken = idbPlain;
    // Migrate to encrypted
    encryptToken(idbPlain).then(enc => {
      if (enc) setConfig(KEY_ENCRYPTED_REFRESH_TOKEN, enc).catch(() => {});
    }).catch(() => {});
    return idbPlain;
  }

  // 3. Fallback to Firestore user document
  const uid = userId || (await getConfig(KEY_USER_ID).catch(() => null));
  if (uid && !uid.startsWith('demo-') && db) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data?.encryptedRefreshToken) {
          const dec = await decryptToken(data.encryptedRefreshToken);
          if (dec) {
            _cachedPlainRefreshToken = dec;
            await setConfig(KEY_ENCRYPTED_REFRESH_TOKEN, data.encryptedRefreshToken).catch(() => {});
            return dec;
          }
        }
      }
    } catch (e) {
      console.warn('[TokenManager] Error reading refresh token from Firestore:', e);
    }
  }

  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Store tokens after OAuth.
 *
 * Rules:
 *   - NEVER overwrite a stored refresh_token with an empty/null value.
 *   - Stores refresh_token encrypted with AES-256-GCM in IDB & Firestore.
 *   - Updates driveStatus to 'connected'.
 */
export async function storeTokens({ accessToken, refreshToken, expiresIn = 3600, email, userId }) {
  if (!accessToken) return;
  const isSame = accessToken === _currentCachedToken;
  _currentCachedToken = accessToken;

  const expiry = Date.now() + expiresIn * 1000;
  await setConfig(KEY_ACCESS_TOKEN, accessToken);
  await setConfig(KEY_TOKEN_EXPIRY, expiry);
  if (email)  await setConfig(KEY_USER_EMAIL, email);
  if (userId) await setConfig(KEY_USER_ID,    userId);

  // CRITICAL RULE: Never overwrite a stored refresh_token with an empty value.
  // Google only returns a refresh_token on initial consent.
  if (refreshToken && typeof refreshToken === 'string' && refreshToken.trim() !== '') {
    _cachedPlainRefreshToken = refreshToken;
    await setConfig(KEY_REFRESH_TOKEN, refreshToken);

    try {
      const encrypted = await encryptToken(refreshToken);
      if (encrypted) {
        await setConfig(KEY_ENCRYPTED_REFRESH_TOKEN, encrypted);

        // Store encrypted in Firestore under users/{userId}
        const uid = userId || (await getConfig(KEY_USER_ID).catch(() => null));
        if (uid && !uid.startsWith('demo-') && db) {
          setDoc(doc(db, 'users', uid), {
            encryptedRefreshToken: encrypted,
            driveStatus: 'connected',
            tokenUpdatedAt: Date.now(),
          }, { merge: true }).catch(err => {
            console.warn('[TokenManager] Firestore token sync error:', err.message);
          });
        }
      }
    } catch (encErr) {
      console.warn('[TokenManager] Refresh token encryption notice:', encErr.message);
    }
  }

  try {
    if (localStorage.getItem('tradeontip_token') !== accessToken) {
      localStorage.setItem('tradeontip_token', accessToken);
    }
    if (localStorage.getItem('tradeontip_token_expiry') !== String(expiry)) {
      localStorage.setItem('tradeontip_token_expiry', String(expiry));
    }
  } catch {}

  setDriveStatus('connected');
  _consecutiveRefreshFailures = 0;
  _lastSuccessfulRefresh = Date.now();

  if (!isSame) {
    _broadcastTokenUpdate(accessToken, expiry, email);
    _notifyTokenUpdate(accessToken);
  }

  _scheduleAutoRefresh(expiry);
  initTokenKeepalive();
}

/**
 * Get a valid access token, proactively refreshing using the stored refresh_token if needed.
 */
export async function getValidAccessToken(userId = null) {
  let token  = await getConfig(KEY_ACCESS_TOKEN).catch(() => null);
  let expiry = await getConfig(KEY_TOKEN_EXPIRY).catch(() => null);

  if (!token && typeof localStorage !== 'undefined') {
    token = localStorage.getItem('tradeontip_token');
    const expStr = localStorage.getItem('tradeontip_token_expiry');
    if (expStr) expiry = Number(expStr);
  }

  // Token is still fresh — return directly
  if (token && expiry && (expiry - Date.now()) > TOKEN_BUFFER_MS) {
    return token;
  }

  // Token is expiring or expired — deduplicate concurrent refresh calls
  if (_isRefreshing && _refreshPromise) {
    return _refreshPromise;
  }

  console.log('[TokenManager] Access token expiring soon or expired, refreshing via refresh_token...');
  _isRefreshing   = true;
  _refreshPromise = _doRefresh(token, expiry, userId);

  try {
    return await _refreshPromise;
  } finally {
    _isRefreshing   = false;
    _refreshPromise = null;
  }
}

/**
 * Refresh access token using CF Worker /api/auth/refresh (preferred) or GIS fallback.
 * Checks and catches `invalid_grant` specifically.
 */
export async function refreshAccessToken(force = false, userId = null) {
  if (!force && Date.now() - _lastSuccessfulRefresh < 10000 && _currentCachedToken) {
    return _currentCachedToken;
  }

  if (_isRefreshing && _refreshPromise) {
    return _refreshPromise;
  }

  // ── Path 1: CF Worker (using AES-GCM decrypted refresh token) ───────────────
  if (CF_WORKER_URL) {
    const refreshToken = await getStoredRefreshToken(userId);
    if (refreshToken) {
      try {
        const resp = await fetch(`${CF_WORKER_URL}/api/auth/refresh`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ refreshToken }),
        });

        const data = await resp.json().catch(() => ({}));

        if (resp.ok && data.access_token) {
          _consecutiveRefreshFailures = 0;
          await storeTokens({
            accessToken:  data.access_token,
            refreshToken: data.refresh_token || refreshToken, // persist rotated refresh token if provided
            expiresIn:    data.expires_in || 3600,
            userId,
          });
          console.log('[TokenManager] Token refreshed successfully via CF Worker ✓');
          return data.access_token;
        }

        // Detect invalid_grant: Google revoked access or user password changed
        if (data.code === 'invalid_grant' || data.driveStatus === 'needs_reconnect' || (data.error && data.error.includes('invalid_grant'))) {
          await handleInvalidGrant(userId);
          return null;
        }

        console.warn('[TokenManager] CF Worker refresh returned non-ok:', resp.status, data);
      } catch (err) {
        console.warn('[TokenManager] CF Worker refresh error:', err.message);
      }
    }
  }

  // ── Path 2: GIS silent refresh (fallback) ───────────────────────────────────
  const silentToken = await _silentGisRefresh();
  if (silentToken) {
    _consecutiveRefreshFailures = 0;
    return silentToken;
  }

  _consecutiveRefreshFailures++;

  const currentExpiry = (await getConfig(KEY_TOKEN_EXPIRY).catch(() => null)) ||
    (typeof localStorage !== 'undefined' ? Number(localStorage.getItem('tradeontip_token_expiry')) : null);
  const isStillValid = currentExpiry && (currentExpiry - Date.now()) > 0;

  if (isStillValid) {
    console.log(`[TokenManager] Proactive refresh attempt ${_consecutiveRefreshFailures} failed, token still valid. Retrying in 45s...`);
    setTimeout(() => { refreshAccessToken(false, userId).catch(() => {}); }, 45_000);
    return getConfig(KEY_ACCESS_TOKEN).catch(() => null);
  }

  if (_consecutiveRefreshFailures < 3) {
    console.warn(`[TokenManager] Refresh attempt ${_consecutiveRefreshFailures} failed on expired token. Retrying in 6s...`);
    setTimeout(() => { refreshAccessToken(false, userId).catch(() => {}); }, 6_000);
    return null;
  }

  console.warn('[TokenManager] All refresh paths failed — notifying token expired.');
  _notifyTokenExpired();
  return null;
}

/**
 * Clear all stored tokens (called on explicit user sign-out).
 */
export async function clearTokens() {
  if (_refreshTimer)   { clearTimeout(_refreshTimer);   _refreshTimer   = null; }
  if (_keepaliveTimer) { clearInterval(_keepaliveTimer); _keepaliveTimer = null; }
  _keepaliveActive = false;
  _cachedPlainRefreshToken = null;

  await deleteConfig(KEY_ACCESS_TOKEN);
  await deleteConfig(KEY_TOKEN_EXPIRY);
  await deleteConfig(KEY_REFRESH_TOKEN);
  await deleteConfig(KEY_ENCRYPTED_REFRESH_TOKEN);
  await deleteConfig(KEY_USER_EMAIL);

  try {
    localStorage.removeItem('tradeontip_token');
    localStorage.removeItem('tradeontip_token_expiry');
    localStorage.removeItem('tradeontip_gdrive_token');
    localStorage.removeItem('tradeontip_drive_status');
  } catch {}

  setDriveStatus('disconnected', false);
  _broadcastTokenRevoked();
  _notifyTokenUpdate(null);
}

export async function isAuthenticated() {
  const token = (await getConfig(KEY_ACCESS_TOKEN).catch(() => null)) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('tradeontip_token') : null);
  return !!token;
}

export async function getStoredEmail() {
  return getConfig(KEY_USER_EMAIL);
}

/**
 * Exchange auth code via CF Worker.
 */
export async function exchangeAuthCode(authCode, email, userId) {
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
          userId,
        });
        console.log('[TokenManager] Auth code exchanged for persistent refresh token ✓');
        return true;
      }
    } else {
      const errData = await resp.json().catch(() => ({}));
      if (errData.code === 'invalid_grant') {
        handleInvalidGrant(userId);
      }
    }
    return false;
  } catch (err) {
    console.warn('[TokenManager] Auth code exchange error:', err.message);
    return false;
  }
}

export async function storeDirectToken(accessToken, email, userId) {
  await storeTokens({ accessToken, expiresIn: 3600, email, userId });
}

/**
 * Get current token health status (for UI indicators).
 * @returns {Promise<{hasToken: boolean, hasRefreshToken: boolean, expiresIn: number|null, isExpired: boolean, canSilentRefresh: boolean}>}
 */
export async function getTokenStatus() {
  const token        = (await getConfig(KEY_ACCESS_TOKEN).catch(() => null)) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('tradeontip_token') : null);
  const expiry       = (await getConfig(KEY_TOKEN_EXPIRY).catch(() => null)) ||
    (typeof localStorage !== 'undefined' ? Number(localStorage.getItem('tradeontip_token_expiry')) : null);
  const hasRefresh   = await hasStoredRefreshToken().catch(() => false);
  const now          = Date.now();
  return {
    hasToken:        !!token,
    hasRefreshToken: !!hasRefresh,
    expiresIn:       expiry ? Math.max(0, Math.floor((expiry - now) / 1000)) : null,
    isExpired:       expiry ? now >= expiry : !token ? true : false,
    canSilentRefresh: !!(CF_WORKER_URL && hasRefresh) || !!(typeof window !== 'undefined' && window.google?.accounts?.oauth2),
  };
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
 * Weekly keepalive check: makes a cheap drive.about.get call
 * to ensure the refresh token does not expire from 6 months of inactivity.
 */
export async function checkWeeklyKeepalive(userId = null) {
  const lastPing = Number((await getConfig(KEY_LAST_KEEPALIVE).catch(() => null)) || 0);
  const now = Date.now();

  if (lastPing && (now - lastPing) < WEEKLY_KEEPALIVE_INTERVAL_MS) {
    return true; // Already pinged within last 7 days
  }

  console.log('[TokenManager] Running weekly Google Drive keepalive check...');
  const refreshToken = await getStoredRefreshToken(userId);

  if (CF_WORKER_URL && refreshToken) {
    try {
      const resp = await fetch(`${CF_WORKER_URL}/api/auth/keepalive`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken }),
      });

      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.status === 'connected') {
        await setConfig(KEY_LAST_KEEPALIVE, now);
        setDriveStatus('connected');
        return true;
      }
      if (data.code === 'invalid_grant' || data.driveStatus === 'needs_reconnect') {
        await handleInvalidGrant(userId);
        return false;
      }
    } catch (err) {
      console.warn('[TokenManager] Weekly keepalive error:', err.message);
    }
  }

  return true;
}

// ── Multi-Tab & Visibility Keepalive ──────────────────────────────────────────

export function initTokenKeepalive() {
  _initBroadcastChannel();
  ensureGsiLoaded().catch(() => {});

  if (_keepaliveActive) return () => {};
  _keepaliveActive = true;

  if (!_currentCachedToken) {
    _broadcastRequestToken();
  }

  // Weekly check on init
  checkWeeklyKeepalive().catch(() => {});

  if (_keepaliveTimer) clearInterval(_keepaliveTimer);
  _keepaliveTimer = setInterval(async () => {
    const token = (await getConfig(KEY_ACCESS_TOKEN).catch(() => null)) ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('tradeontip_token') : null);
    if (!token) return;

    const expiry = (await getConfig(KEY_TOKEN_EXPIRY).catch(() => null)) ||
      (typeof localStorage !== 'undefined' ? Number(localStorage.getItem('tradeontip_token_expiry')) : null);

    if (expiry && (expiry - Date.now()) <= TOKEN_BUFFER_MS) {
      console.log('[TokenManager] Keepalive: token expiring within buffer — refreshing proactively...');
      if (typeof navigator !== 'undefined' && navigator.locks) {
        navigator.locks.request('foxtrade_token_refresh', { ifAvailable: true }, async (lock) => {
          if (!lock) return;
          await refreshAccessToken().catch(() => {});
        }).catch(() => refreshAccessToken().catch(() => {}));
      } else {
        refreshAccessToken().catch(() => {});
      }
    }
  }, KEEPALIVE_INTERVAL_MS);

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
      refreshAccessToken().catch(() => {});
    } else if (expiry) {
      _scheduleAutoRefresh(expiry);
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  return () => {
    _keepaliveActive = false;
    if (_keepaliveTimer) { clearInterval(_keepaliveTimer); _keepaliveTimer = null; }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

async function _doRefresh(fallbackToken, expiry, userId) {
  const newToken = await refreshAccessToken(false, userId);
  if (newToken) return newToken;

  if (expiry && Date.now() >= expiry) {
    console.warn('[TokenManager] Token has expired and could not be refreshed.');
    return null;
  }

  return fallbackToken;
}

function _scheduleAutoRefresh(expiry) {
  if (_refreshTimer) clearTimeout(_refreshTimer);

  const msUntilRefresh = expiry - Date.now() - TOKEN_BUFFER_MS;
  if (msUntilRefresh <= 0) {
    refreshAccessToken().catch(() => {});
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
        resolve(null);
        return;
      }

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
      if (!clientId) {
        resolve(null);
        return;
      }

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
          if (response?.error || !response?.access_token) {
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
        error_callback: () => safeResolve(null),
      });

      const requestConfig = { prompt: 'none' };
      if (userEmail) {
        requestConfig.hint = userEmail;
      }

      client.requestAccessToken(requestConfig);

      setTimeout(() => {
        if (!resolved) safeResolve(null);
      }, 10_000);

    } catch {
      resolve(null);
    }
  });
}
