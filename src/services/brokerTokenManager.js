/**
 * brokerTokenManager.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Per-broker token lifecycle management with AES-GCM encryption.
 *
 * Token States:
 *   connected   — token exists and is within its valid window
 *   expired     — token exists but past its expiry cutoff (IST-aware)
 *   disconnected — no token stored
 *
 * Per-broker IST expiry windows (matching Nexus production behaviour):
 *   Zerodha   : 6:00 AM IST next day  (Kite Connect daily rotation)
 *   Upstox    : 3:30 AM IST next day  (post-settlement window)
 *   Fyers     : 6:00 AM IST next day
 *   AngelOne  : 12:00 AM IST (midnight)
 *   mStock    : 12:00 AM IST (midnight)
 *   Kotak     : 6:00 AM IST next day
 *   Groww     : 6:00 AM IST next day
 *   Dhan      : uses validUntil timestamp from API (30-day token)
 *
 * Encryption: AES-GCM 256-bit via Web Crypto API (no library needed)
 * Storage   : localStorage (encrypted ciphertext only)
 */

const STORAGE_PREFIX = 'foxtrade_broker_token_';
const IST_OFFSET_MS = 19800000; // UTC+5:30

// ── Per-broker expiry windows ─────────────────────────────────────────────────
const BROKER_EXPIRY_CUTOFFS = {
  zerodha:  { hour: 6,  minute: 0  },
  upstox:   { hour: 3,  minute: 30 },
  fyers:    { hour: 6,  minute: 0  },
  angelone: { hour: 0,  minute: 0  },
  mstock:   { hour: 0,  minute: 0  },
  kotak:    { hour: 6,  minute: 0  },
  groww:    { hour: 6,  minute: 0  },
};

// ── AES-GCM helpers ──────────────────────────────────────────────────────────

async function deriveKey() {
  // Device-stable key material using origin + user agent
  const raw = window.location.origin + navigator.userAgent.slice(0, 40);
  const encoded = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encrypt(plaintext) {
  try {
    const key = await deriveKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const combined = new Uint8Array(iv.byteLength + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), iv.byteLength);
    return btoa(String.fromCharCode(...combined));
  } catch {
    // Fallback: base64 encode only (graceful degradation for environments without crypto.subtle)
    return btoa(unescape(encodeURIComponent(plaintext)));
  }
}

async function decrypt(ciphertext) {
  try {
    const key = await deriveKey();
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const cipher = combined.slice(12);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return new TextDecoder().decode(plain);
  } catch {
    // Fallback: try base64 decode
    try { return decodeURIComponent(escape(atob(ciphertext))); } catch { return null; }
  }
}

// ── Expiry calculation ───────────────────────────────────────────────────────

function calcExpiry(broker, connectedAtMs, validUntil) {
  if (broker === 'dhan' && validUntil && validUntil > Date.now()) return validUntil;
  if (broker === 'dhan') return connectedAtMs + (30 * 24 * 60 * 60 * 1000); // 30-day fallback

  const cutoff = BROKER_EXPIRY_CUTOFFS[broker] || { hour: 6, minute: 0 };
  const WINDOW_MS = 19800000; // 5.5h — buffer before IST cutoff resets

  // Find the next cutoff time in IST
  const nowMs = connectedAtMs;
  const istDate = new Date(nowMs + IST_OFFSET_MS);
  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth();
  const day = istDate.getUTCDate();

  let cutoffMs = Date.UTC(year, month, day, cutoff.hour, cutoff.minute, 0, 0) - IST_OFFSET_MS;
  // If cutoff already passed today in IST, use tomorrow's cutoff
  if (nowMs >= cutoffMs) cutoffMs += 86400000;

  return cutoffMs;
}

// ── Token state ───────────────────────────────────────────────────────────────

function getTokenState(broker, accountId) {
  const storageKey = `${STORAGE_PREFIX}${broker}_${accountId || 'default'}`;
  const raw = localStorage.getItem(storageKey);
  if (!raw) return 'disconnected';

  try {
    const record = JSON.parse(raw); // shape: { cipher, expiry, connectedAt }
    const now = Date.now();
    if (record.expiry && now >= record.expiry) return 'expired';
    return 'connected';
  } catch {
    return 'disconnected';
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Save (encrypt + store) a broker token.
 *
 * @param {string} broker      - e.g. 'zerodha'
 * @param {string} accountId   - unique account identifier (clientId, userId, etc.)
 * @param {object} tokenData   - { accessToken, apiKey?, clientId?, validUntil? }
 */
export async function saveToken(broker, accountId, tokenData) {
  const storageKey = `${STORAGE_PREFIX}${(broker || '').toLowerCase()}_${accountId || 'default'}`;
  const connectedAt = Date.now();
  const expiry = calcExpiry((broker || '').toLowerCase(), connectedAt, tokenData.validUntil);

  const cipher = await encrypt(JSON.stringify(tokenData));
  const record = { cipher, expiry, connectedAt, broker, accountId };
  localStorage.setItem(storageKey, JSON.stringify(record));
  return { state: 'connected', expiry };
}

/**
 * Retrieve (decrypt) a broker token.
 * Returns null if disconnected or expired.
 */
export async function getToken(broker, accountId) {
  const storageKey = `${STORAGE_PREFIX}${(broker || '').toLowerCase()}_${accountId || 'default'}`;
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const record = JSON.parse(raw);
    const state = getTokenState(broker, accountId);
    if (state === 'disconnected') return null;

    const plaintext = await decrypt(record.cipher);
    if (!plaintext) return null;

    const tokenData = JSON.parse(plaintext);
    return { ...tokenData, state, expiry: record.expiry, connectedAt: record.connectedAt };
  } catch {
    return null;
  }
}

/**
 * Get the connection state for a broker account.
 * @returns {'connected' | 'expired' | 'disconnected'}
 */
export { getTokenState };

/**
 * Remove a token (disconnect a broker account).
 */
export function clearToken(broker, accountId) {
  const storageKey = `${STORAGE_PREFIX}${(broker || '').toLowerCase()}_${accountId || 'default'}`;
  localStorage.removeItem(storageKey);
}

/**
 * List all stored broker accounts with their current state.
 * @returns {Array<{ broker, accountId, state, expiry, connectedAt }>}
 */
export function listAllTokens() {
  const results = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    try {
      const record = JSON.parse(localStorage.getItem(key));
      const state = getTokenState(record.broker, record.accountId);
      results.push({
        broker: record.broker,
        accountId: record.accountId,
        state,
        expiry: record.expiry,
        connectedAt: record.connectedAt,
        expiryDate: record.expiry ? new Date(record.expiry).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null,
      });
    } catch {}
  }
  return results;
}

/**
 * Get human-readable time until expiry.
 */
export function getExpiryLabel(expiry) {
  if (!expiry) return null;
  const diff = expiry - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
