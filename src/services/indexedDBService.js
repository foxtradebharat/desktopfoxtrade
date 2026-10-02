/**
 * indexedDBService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * IndexedDB abstraction layer for FoxTrade.
 * Replaces localStorage as the primary trade store — scales to 100k+ trades
 * without the 5MB localStorage limit.
 *
 * DB name    : foxtrade_db
 * Version    : 1
 * Stores     : trades, settings, portfolios
 *
 * Falls back to localStorage if IndexedDB is unavailable.
 */

const DB_NAME = 'foxtrade_db';
const DB_VERSION = 1;
const STORE_TRADES = 'trades';
const STORE_SETTINGS = 'settings';
const STORE_PORTFOLIOS = 'portfolios';
const LS_FALLBACK_KEY = 'tradeontip_trades_cache';

let _db = null;

// ── Open / Init DB ─────────────────────────────────────────────────────────────
function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_TRADES)) {
        db.createObjectStore(STORE_TRADES, { keyPath: 'uid' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_PORTFOLIOS)) {
        db.createObjectStore(STORE_PORTFOLIOS, { keyPath: 'uid' });
      }
    };

    req.onsuccess = (event) => {
      _db = event.target.result;
      resolve(_db);
    };

    req.onerror = (event) => {
      console.warn('[IndexedDB] Open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

function txGet(store, key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function txPut(store, value) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function txDelete(store, key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
}

// ── localStorage fallback helpers ──────────────────────────────────────────────
function lsGet(uid) {
  try {
    const raw = localStorage.getItem(`${LS_FALLBACK_KEY}_${uid}`);
    if (raw) return JSON.parse(raw);
    // Legacy key migration
    const legacy = localStorage.getItem(LS_FALLBACK_KEY);
    return legacy ? JSON.parse(legacy) : null;
  } catch { return null; }
}

function lsSet(uid, trades) {
  try {
    localStorage.setItem(`${LS_FALLBACK_KEY}_${uid}`, JSON.stringify(trades));
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(trades)); // keep legacy in sync
  } catch (e) {
    console.warn('[IndexedDB] localStorage fallback write error:', e.message);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * @deprecated  Use dbService.saveUserTrades() or tradeStore.putTrade() instead.
 *              This function writes to the old foxtrade_db v1 format.
 *              It is kept ONLY for migration reads. DO NOT call this on new code paths.
 */
export async function idbSaveTrades(uid, trades) {
  console.error(
    '[IndexedDB v1] idbSaveTrades() is deprecated and should not be called. ' +
    'Use dbService.saveUserTrades() or tradeStore.putTrade() instead.'
  );
  return false;
}

/**
 * Load all trades for a user from IndexedDB (falls back to localStorage).
 */
export async function idbGetTrades(uid) {
  if (!uid) return [];
  const normalized = uid.startsWith('demo-') ? 'demo' : uid;

  try {
    const record = await txGet(STORE_TRADES, normalized);
    if (record && Array.isArray(record.trades)) {
      lsSet(normalized, record.trades); // keep localStorage in sync
      return record.trades;
    }
  } catch (err) {
    console.warn('[IndexedDB] getTrades fallback to localStorage:', err.message);
  }

  // Fallback: localStorage
  return lsGet(normalized) || [];
}

/**
 * Delete all trades for a user.
 */
export async function idbClearTrades(uid) {
  if (!uid) return;
  const normalized = uid.startsWith('demo-') ? 'demo' : uid;
  try {
    await txDelete(STORE_TRADES, normalized);
  } catch (err) {
    console.warn('[IndexedDB] clearTrades error:', err.message);
  }
  try { localStorage.removeItem(`${LS_FALLBACK_KEY}_${normalized}`); } catch {}
}

/**
 * Save a setting value.
 */
export async function idbSetSetting(key, value) {
  try {
    await txPut(STORE_SETTINGS, { key, value, updatedAt: Date.now() });
  } catch (err) {
    console.warn('[IndexedDB] setSetting error, using localStorage:', err.message);
    try { localStorage.setItem(`foxtrade_setting_${key}`, JSON.stringify(value)); } catch {}
  }
}

/**
 * Get a setting value.
 */
export async function idbGetSetting(key, defaultValue = null) {
  try {
    const record = await txGet(STORE_SETTINGS, key);
    return record ? record.value : defaultValue;
  } catch {
    try {
      const raw = localStorage.getItem(`foxtrade_setting_${key}`);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch { return defaultValue; }
  }
}

/**
 * Check if IndexedDB is available in this browser.
 */
export function isIndexedDBAvailable() {
  return typeof indexedDB !== 'undefined';
}
