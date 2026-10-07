/**
 * dbService.js  (v2 — Privacy-First Rewrite)
 * ─────────────────────────────────────────────────────────────────────────────
 * Database abstraction layer for FoxTrade.
 *
 * WHAT CHANGED FROM v1:
 *   ❌ REMOVED: Firebase Firestore trade sync (trade data was going to Google servers)
 *   ❌ REMOVED: localStorage as primary store
 *   ✅ ADDED: Per-trade IndexedDB storage (foxtrade_v2)
 *   ✅ ADDED: Google Drive sync with CRDT merge (user's own Drive — private)
 *   ✅ ADDED: Offline write queue (no more silent data loss on tab close)
 *   ✅ ADDED: Auto-migration from v1 format on first load
 *
 * Firebase is now used ONLY for Google Sign-In (auth identity).
 * Trade data never leaves the user's device + their own Google Drive.
 *
 * PUBLIC API — same signatures as v1 so Dashboard.jsx needs zero changes:
 *   saveUserTrades(uid, trades, portfolioId?)
 *   getUserTrades(uid, portfolioId?)
 *   subscribeToUserTrades(uid, onUpdate)   → returns unsubscribe fn
 *   setDriveContext(accessToken, portfolioId)
 */

import {
  getTrades,
  getTradesWithDeleted,
  bulkPutTrades,
  clearTrades,
  migrateFromV1,
  triggerAutoSync,
  loadFromDrive,
  initPageHideFlush,
  getValidAccessToken,
  storeDirectToken,
  syncPendingImages,
  subscribeToMergedTrades,
  subscribeToTokenExpired,
  subscribeToTokenUpdate,
  initTokenKeepalive,
  initNoteStore,
  purgeExpiredOhlcCache,
  getDB,
  STORES,
  idbClearStore,
  deleteConfig,
} from '../db/index.js';

// ── Module state ──────────────────────────────────────────────────────────────

let _accessToken      = null;
let _activePortfolio  = 'default';
let _currentTrades    = [];          // in-memory cache for page-hide flush
let _listeners        = new Set();   // subscribeToUserTrades callbacks
let _migrationDone    = new Set();   // track which UIDs have been migrated
let _cleanupPageHide  = null;        // cleanup fn for page-hide listeners
let _cleanupMerge     = null;        // cleanup fn for CRDT merge listener

// ── Startup maintenance ───────────────────────────────────────────────────────
// Purge expired OHLC candle cache entries on every app start.
// Uses the expiresAt index (DB v3) — safe no-op on older schema.
purgeExpiredOhlcCache()
  .then(count => { if (count > 0) console.log(`[dbService] Purged ${count} expired OHLC cache entries`); })
  .catch(() => {});

// Start the token keepalive system on every page load.
// Covers the case where the user has a stored IDB token from a previous session
// but the in-memory auto-refresh timer was lost on page reload.
// initTokenKeepalive() is idempotent and also called inside storeTokens().
initTokenKeepalive();

// Initialize structured note store & reconcile legacy localStorage notes to IndexedDB
initNoteStore();

// ── CRDT merge → UI notification bridge ──────────────────────────────────────
// Wire up once at module load: when syncEngine reports a merge (from another
// device syncing to Drive), update the in-memory cache and notify all React
// subscribers so the UI updates immediately without a page reload.
_cleanupMerge = subscribeToMergedTrades((mergedTrades, portfolioId) => {
  if (portfolioId !== _activePortfolio) return; // only care about active portfolio
  _currentTrades = mergedTrades;
  _notifyListeners(mergedTrades);
  console.log(`[dbService] Real-time merge: ${mergedTrades.length} trades updated from Drive`);
});

// Automatically keep in-memory _accessToken updated whenever any tab refreshes token
subscribeToTokenUpdate((tok) => {
  if (tok && tok !== 'demo-token') {
    _accessToken = tok;
  }
});

// Re-export subscribeToTokenExpired so Dashboard.jsx only needs one import
export { subscribeToTokenExpired };

// ── Drive context ─────────────────────────────────────────────────────────────

/**
 * Set the Drive access token and active portfolio.
 * Called from Dashboard.jsx after Google sign-in.
 *
 * @param {string} accessToken
 * @param {string} [portfolioId]
 */
export function setDriveContext(accessToken, portfolioId) {
  _accessToken     = accessToken;
  _activePortfolio = portfolioId || 'default';

  // Store token in IDB for persistence across reloads
  if (accessToken && accessToken !== 'demo-token') {
    storeDirectToken(accessToken).catch(() => {});
  }

  // Set up page-hide flush (fires on tab close / page hide)
  if (_cleanupPageHide) _cleanupPageHide();
  _cleanupPageHide = initPageHideFlush(
    ()  => _activePortfolio,
    ()  => _currentTrades,
    ()  => getValidAccessToken().catch(() => _accessToken),
  );
}

// ── Save trades ───────────────────────────────────────────────────────────────

/**
 * Save all trades for a user.
 *
 * Flow:
 *   1. Bulk-upsert into IndexedDB (instant, offline-safe)
 *   2. Notify all active subscribers (real-time UI update)
 *   3. Trigger debounced Drive sync (15s, flushes immediately on tab close)
 *
 * @param {string} uid          — Firebase user UID
 * @param {object[]} trades     — full trade array from UI
 * @param {string} [portfolioId]
 * @returns {Promise<boolean>}
 */
export async function saveUserTrades(uid, trades, portfolioId) {
  if (!uid) return false;
  const pid = portfolioId || _activePortfolio || 'default';

  // If trades array is empty, clear this portfolio's records from IDB
  if (!trades || trades.length === 0) {
    await clearTrades(pid);
    _currentTrades = [];
    _notifyListeners([]);
    return true;
  }

  // Clear any explicit "cleared" tombstone flag on fresh writes
  try {
    localStorage.removeItem(`tradeontip_cleared_${pid}`);
  } catch (_) {}

  // 1. Write to IndexedDB
  await bulkPutTrades(pid, trades, false);

  // 2. Update in-memory cache
  _currentTrades = await getTradesWithDeleted(pid);

  // 3. Notify local subscribers
  _notifyListeners(trades);

  // 4. Drive sync (skip for demo users or if autoBackup disabled)
  if (!uid.startsWith('demo-')) {
    const token = _accessToken || await getValidAccessToken().catch(() => null);
    if (token) {
      let isAutoBackupEnabled = true;
      try {
        const saved = localStorage.getItem('tradeontip_auto_backup');
        if (saved !== null) isAutoBackupEnabled = (saved !== 'false');
      } catch (_) {}

      if (isAutoBackupEnabled) {
        triggerAutoSync(pid, token, _currentTrades);
        // Also sync any pending images
        syncPendingImages(token, pid).catch(() => {});
      }
    }
  }

  return true;
}

// ── Load trades ───────────────────────────────────────────────────────────────

/**
 * Load all trades for a user.
 *
 * Flow:
 *   1. Load from IndexedDB immediately (instant — this is the local cache)
 *   2. If IDB is empty → try to migrate from v1 format
 *   3. If still empty + Drive connected → load from Drive (first time on new device)
 *   4. Return trades to UI
 *
 * @param {string} uid
 * @param {string} [portfolioId]
 * @returns {Promise<object[]>}
 */
export async function getUserTrades(uid, portfolioId) {
  if (!uid) return [];
  const pid = portfolioId || _activePortfolio || 'default';

  // 1. Load from IDB (primary — always fast)
  let trades = await getTrades(pid);

  if (trades.length > 0) {
    _currentTrades = await getTradesWithDeleted(pid);
    return trades;
  }

  // If this portfolio was explicitly cleared, never resurrect trades via migration or cloud
  let wasCleared = false;
  try {
    wasCleared = localStorage.getItem(`tradeontip_cleared_${pid}`) === 'true';
  } catch (_) {}
  if (wasCleared) {
    _currentTrades = [];
    return [];
  }

  // 2. Migration: check if we have v1 data in old IndexedDB or localStorage
  if (!_migrationDone.has(uid)) {
    _migrationDone.add(uid);
    const migrated = await _migrateFromV1Data(uid, pid);
    if (migrated > 0) {
      trades = await getTrades(pid);
      _currentTrades = await getTradesWithDeleted(pid);
      return trades;
    }
  }

  // 3. First time on this device — try loading from Drive
  if (!uid.startsWith('demo-')) {
    const token = _accessToken || await getValidAccessToken().catch(() => null);
    if (token) {
      try {
        const driveTrades = await loadFromDrive(pid, token);
        if (driveTrades.length > 0) {
          await bulkPutTrades(pid, driveTrades, true); // skipQueue=true on restore
          trades = await getTrades(pid);
          _currentTrades = await getTradesWithDeleted(pid);
          console.log(`[dbService] Loaded ${trades.length} trades from Drive`);
          return trades;
        }
      } catch (err) {
        console.warn('[dbService] Drive load failed:', err.message);
      }
    }
  }

  return [];
}

// ── Real-time subscriptions ───────────────────────────────────────────────────

/**
 * Subscribe to trade updates.
 * In this privacy-first architecture, updates come from the local write path
 * (not from a remote server), so this fires whenever saveUserTrades() is called.
 *
 * @param {string} uid
 * @param {function} onTradesUpdated — callback(trades[])
 * @returns {function} unsubscribe function
 */
export function subscribeToUserTrades(uid, onTradesUpdated) {
  if (!uid || uid.startsWith('demo-')) return () => {};

  _listeners.add(onTradesUpdated);
  return () => _listeners.delete(onTradesUpdated);
}

// ── Clear all data ────────────────────────────────────────────────────────────

/**
 * Clear all trades for a portfolio from IDB.
 * @param {string} portfolioId
 * @returns {Promise<number>}
 */
export async function clearUserTrades(portfolioId) {
  const pid = portfolioId || _activePortfolio || 'default';
  _currentTrades = [];
  return clearTrades(pid);
}

/**
 * Hard-clear old foxtrade_db v1 IndexedDB so legacy migration never resurrects old trades.
 * @param {string} uid
 */
export async function clearOldV1IDB(uid) {
  if (!uid || typeof indexedDB === 'undefined') return;
  try {
    const req = indexedDB.open('foxtrade_db', 1);
    req.onsuccess = (e) => {
      const db = e.target.result;
      if (db.objectStoreNames.contains('trades')) {
        const tx = db.transaction('trades', 'readwrite');
        tx.objectStore('trades').delete(uid);
      }
    };
  } catch (_) {}
}

/**
 * Hard-clear all trades, write queues, and sync cursors from local IndexedDB.
 * Used on logout or full user data reset to prevent leaks between accounts.
 */
export async function clearAllLocalTrades() {
  _currentTrades = [];
  _migrationDone.clear();
  try {
    const db = await getDB();
    if (db.objectStoreNames.contains(STORES.TRADES)) {
      await idbClearStore(STORES.TRADES);
    }
    if (db.objectStoreNames.contains(STORES.OPERATIONS_QUEUE)) {
      await idbClearStore(STORES.OPERATIONS_QUEUE);
    }
    if (db.objectStoreNames.contains(STORES.SYNC_CURSORS)) {
      await idbClearStore(STORES.SYNC_CURSORS);
    }
    if (db.objectStoreNames.contains(STORES.MONTHLY_PERF)) {
      await idbClearStore(STORES.MONTHLY_PERF);
    }
    if (db.objectStoreNames.contains(STORES.CHART_IMAGES)) {
      await idbClearStore(STORES.CHART_IMAGES);
    }
    // Purge transactional user data from APP_CONFIG store
    await deleteConfig('notes_v2');
    await deleteConfig('independent_notes_v2');
    await deleteConfig('foxy_ai_chats');
    await deleteConfig('foxy_trader_commitments');
    await deleteConfig('journal_settings');
    await deleteConfig('base_capital_default');
  } catch (err) {
    console.warn('[dbService] clearAllLocalTrades error:', err);
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _notifyListeners(trades) {
  _listeners.forEach(cb => {
    try { cb(trades); } catch (err) {
      console.warn('[dbService] Subscriber error:', err.message);
    }
  });
}

/**
 * Try to migrate data from old v1 storage formats.
 * Checks ONLY the authenticated user's scoped cache — never demo or shared caches.
 */
async function _migrateFromV1Data(uid, portfolioId) {
  if (!uid || uid.startsWith('demo-')) return 0;

  // Try old IndexedDB (foxtrade_db v1)
  try {
    const v1Trades = await _readFromOldIDB(uid);
    if (v1Trades.length > 0) {
      const count = await migrateFromV1(uid, v1Trades, portfolioId);
      console.log(`[dbService] Migrated ${count} trades from foxtrade_db v1`);
      return count;
    }
  } catch {}

  // Try scoped localStorage fallback (check v5 first, then legacy cache)
  const candidateKeys = [
    `tradeontip_trades_v5_${uid}`,
    `tradeontip_trades_cache_${uid}`,
    'tradeontip_trades_v5',
    'tradeontip_trades_cache'
  ];
  for (const lsKey of candidateKeys) {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : (parsed?.trades || []);
        if (arr.length > 0) {
          const count = await migrateFromV1(uid, arr, portfolioId);
          console.log(`[dbService] Migrated ${count} trades from localStorage (${lsKey})`);
          return count;
        }
      }
    } catch {}
  }

  return 0;
}

/**
 * Read trades from the old foxtrade_db v1 IndexedDB for a specific UID.
 */
function _readFromOldIDB(uid) {
  return new Promise((resolve) => {
    if (!uid || typeof indexedDB === 'undefined') { resolve([]); return; }
    const req = indexedDB.open('foxtrade_db', 1);
    req.onerror = () => resolve([]);
    req.onsuccess = (e) => {
      const db  = e.target.result;
      if (!db.objectStoreNames.contains('trades')) { db.close(); resolve([]); return; }
      const tx  = db.transaction('trades', 'readonly');
      const get = tx.objectStore('trades').get(uid);
      get.onsuccess = () => {
        db.close();
        const result = get.result;
        resolve((result && Array.isArray(result.trades)) ? result.trades : []);
      };
      get.onerror = () => { db.close(); resolve([]); };
    };
    req.onblocked = () => resolve([]);
  });
}

// ── Leaderboard & Community (Firebase — not trade data) ───────────────────────
// These stay on Firebase Firestore because they are community/social features
// (not private trade data). Import from dbService_community.js if needed.

const DEMO_LEADERBOARD = [
  { id:'1', rank:1, name:'Vikram Sharma',  returnPct:24.8, winRate:78.5, profitFactor:3.4, tradesCount:42, isCrown:true, crownType:'Gold' },
  { id:'2', rank:2, name:'Ananya Roy',     returnPct:19.4, winRate:72.0, profitFactor:2.8, tradesCount:35, isCrown:true, crownType:'Silver' },
  { id:'3', rank:3, name:'Rajesh K.',      returnPct:16.2, winRate:69.4, profitFactor:2.5, tradesCount:29, isCrown:true, crownType:'Bronze' },
  { id:'4', rank:4, name:'Neha Gupta',     returnPct:14.1, winRate:65.0, profitFactor:2.1, tradesCount:38, isCrown:true, crownType:'Top 5' },
  { id:'5', rank:5, name:'Siddharth M.',   returnPct:12.7, winRate:62.8, profitFactor:1.9, tradesCount:24, isCrown:true, crownType:'Top 5' },
];

export async function getMonthlyLeaderboard() { return DEMO_LEADERBOARD; }

export async function getCommunityPosts()    { return []; }
export async function createCommunityPost()  { return null; }
export async function likeCommunityPost()    { return false; }
