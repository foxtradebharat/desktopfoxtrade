/**
 * foxtradeDB.js
 * ─────────────────────────────────────────────────────────────────────────────
 * FoxTrade IndexedDB v3 — Privacy-first local database.
 *
 * Philosophy: ALL trade data lives exclusively in the user's browser (IndexedDB)
 * and their own Google Drive. Zero trade data ever touches any third-party server.
 *
 * DB Name    : foxtrade_v2
 * DB Version : 3
 *
 * Stores:
 *   trades            — per-trade records (not array blobs)
 *   operations_queue  — offline write queue, drained to Drive when online
 *   sync_cursors      — last Drive sync state per portfolio
 *   chart_images      — binary image blobs + Drive sync metadata
 *   app_config        — critical config (replaces fragile localStorage)
 *   monthly_perf      — monthly performance ledger per portfolio
 *   ohlc_cache        — candlestick price cache with TTL (expiresAt index v3)
 *
 * Schema changes:
 *   v3: Added compound index [status, portfolioId] on operations_queue for fast
 *       pending-count queries without full-table scans.
 *       Added expiresAt index on ohlc_cache for TTL cleanup on startup.
 */

const DB_NAME    = 'foxtrade_v2';
const DB_VERSION = 3;
/** Store name constants — use these everywhere, never raw strings */
export const STORES = Object.freeze({
  TRADES:           'trades',
  OPERATIONS_QUEUE: 'operations_queue',
  SYNC_CURSORS:     'sync_cursors',
  CHART_IMAGES:     'chart_images',
  APP_CONFIG:       'app_config',
  MONTHLY_PERF:     'monthly_perf',
  OHLC_CACHE:       'ohlc_cache',
});

/** Singleton DB connection */
let _db = null;

/**
 * Open (or return cached) IndexedDB connection.
 * Handles schema creation and upgrades.
 * @returns {Promise<IDBDatabase>}
 */
export function getDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('[FoxTradeDB] IndexedDB not available in this environment.'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db  = event.target.result;
      const oldVersion = event.oldVersion;

      // ── trades ────────────────────────────────────────────────────────────
      // Each trade is its own record. Enables per-trade versioning & CRDT merge.
      if (!db.objectStoreNames.contains(STORES.TRADES)) {
        const ts = db.createObjectStore(STORES.TRADES, { keyPath: 'id' });
        ts.createIndex('portfolioId',        'portfolioId',              { unique: false });
        ts.createIndex('updatedAt',          'updatedAt',                { unique: false });
        ts.createIndex('portfolioId_status', ['portfolioId', 'status'],  { unique: false });
        ts.createIndex('portfolioId_symbol', ['portfolioId', 'symbol'],  { unique: false });
      }

      // ── operations_queue ──────────────────────────────────────────────────
      // Every write is enqueued here. Drained to Drive when online.
      // Survives browser crashes — trade data is never lost.
      if (!db.objectStoreNames.contains(STORES.OPERATIONS_QUEUE)) {
        const oqs = db.createObjectStore(STORES.OPERATIONS_QUEUE, {
          keyPath:       'qid',
          autoIncrement: true,
        });
        oqs.createIndex('status',             'status',                    { unique: false });
        oqs.createIndex('portfolioId',        'portfolioId',               { unique: false });
        oqs.createIndex('createdAt',          'createdAt',                 { unique: false });
        // v3: compound index for fast pending-count per portfolio
        oqs.createIndex('status_portfolioId', ['status', 'portfolioId'],   { unique: false });
      } else if (oldVersion < 3) {
        // v2 → v3 upgrade: add compound index to existing store
        const tx  = event.target.transaction;
        const oqs = tx.objectStore(STORES.OPERATIONS_QUEUE);
        if (!oqs.indexNames.contains('status_portfolioId')) {
          oqs.createIndex('status_portfolioId', ['status', 'portfolioId'], { unique: false });
        }
      }

      // ── sync_cursors ──────────────────────────────────────────────────────
      // Tracks last Drive sync state per portfolio.
      // Used for incremental sync and ETag-based conflict detection.
      if (!db.objectStoreNames.contains(STORES.SYNC_CURSORS)) {
        db.createObjectStore(STORES.SYNC_CURSORS, { keyPath: 'portfolioId' });
      }

      // ── chart_images ──────────────────────────────────────────────────────
      // Binary image blobs stored locally + synced to user's Drive as separate
      // binary files (never base64'd into the main backup JSON).
      if (!db.objectStoreNames.contains(STORES.CHART_IMAGES)) {
        const cis = db.createObjectStore(STORES.CHART_IMAGES, { keyPath: 'id' });
        cis.createIndex('tradeId',       'tradeId',       { unique: false });
        cis.createIndex('portfolioId',   'portfolioId',   { unique: false });
        cis.createIndex('syncedToDrive', 'syncedToDrive', { unique: false });
      }

      // ── app_config ────────────────────────────────────────────────────────
      // Replaces localStorage for critical config that must survive storage pressure.
      // Keys: activePortfolioId, portfolios, deviceId, gdrive_*, notes_*, etc.
      if (!db.objectStoreNames.contains(STORES.APP_CONFIG)) {
        db.createObjectStore(STORES.APP_CONFIG, { keyPath: 'key' });
      }

      // ── monthly_perf ──────────────────────────────────────────────────────
      // Monthly performance ledger. keyPath = `${portfolioId}_${year}_${month}`
      if (!db.objectStoreNames.contains(STORES.MONTHLY_PERF)) {
        const mps = db.createObjectStore(STORES.MONTHLY_PERF, {
          keyPath: 'pid_year_month',
        });
        mps.createIndex('portfolioId', 'portfolioId', { unique: false });
      }

      // ── ohlc_cache ────────────────────────────────────────────────────────
      // OHLC candlestick cache. keyPath = `${symbol}_${timeframe}`
      // expiresAt field enables TTL cleanup on startup.
      if (!db.objectStoreNames.contains(STORES.OHLC_CACHE)) {
        const oc = db.createObjectStore(STORES.OHLC_CACHE, { keyPath: 'symbolTimeframe' });
        // v3: expiresAt index — used by purgeExpiredOhlcCache() on app start
        oc.createIndex('expiresAt', 'expiresAt', { unique: false });
      } else if (oldVersion < 3) {
        // v2 → v3 upgrade: add expiresAt index to existing store
        const tx = event.target.transaction;
        const oc = tx.objectStore(STORES.OHLC_CACHE);
        if (!oc.indexNames.contains('expiresAt')) {
          oc.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      }
    };

    req.onsuccess = (event) => {
      _db = event.target.result;

      // If another tab opens a newer version, close gracefully
      _db.onversionchange = () => {
        _db.close();
        _db = null;
        console.warn('[FoxTradeDB] Database version changed by another tab. Reconnecting on next access.');
      };

      resolve(_db);
    };

    req.onerror = () => {
      console.error('[FoxTradeDB] Failed to open database:', req.error);
      reject(req.error);
    };

    req.onblocked = () => {
      console.warn('[FoxTradeDB] Database upgrade blocked — please close other FoxTrade tabs.');
    };
  });
}

/**
 * Reset the cached DB connection (used after version changes or in tests).
 */
export function resetDB() {
  if (_db) {
    try { _db.close(); } catch (_) {}
    _db = null;
  }
}

// ── Generic transaction helpers ───────────────────────────────────────────────
// These are the ONLY functions that touch IDB transactions directly.
// All higher-level stores use these helpers.

/**
 * Get a single record by key.
 * @param {string} storeName
 * @param {*} key
 * @returns {Promise<any>}
 */
export function idbGet(storeName, key) {
  return getDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly')
                  .objectStore(storeName)
                  .get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  }));
}

/**
 * Put (upsert) a single record.
 * @param {string} storeName
 * @param {object} value
 * @returns {Promise<IDBValidKey>}
 */
export function idbPut(storeName, value) {
  return getDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readwrite')
                  .objectStore(storeName)
                  .put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  }));
}

/**
 * Delete a single record by key.
 * @param {string} storeName
 * @param {*} key
 * @returns {Promise<void>}
 */
export function idbDelete(storeName, key) {
  return getDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readwrite')
                  .objectStore(storeName)
                  .delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  }));
}

/**
 * Get ALL records from a store.
 * @param {string} storeName
 * @returns {Promise<any[]>}
 */
export function idbGetAll(storeName) {
  return getDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly')
                  .objectStore(storeName)
                  .getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  }));
}

/**
 * Get all records matching an index value.
 * @param {string} storeName
 * @param {string} indexName
 * @param {*} value
 * @returns {Promise<any[]>}
 */
export function idbGetByIndex(storeName, indexName, value) {
  return getDB().then(db => new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req   = index.getAll(value);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  }));
}

/**
 * Put multiple records in a single transaction (bulk upsert).
 * @param {string} storeName
 * @param {object[]} values
 * @returns {Promise<void>}
 */
export function idbBulkPut(storeName, values) {
  if (!values || values.length === 0) return Promise.resolve();
  return getDB().then(db => new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    values.forEach(v => store.put(v));
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
    tx.onabort    = () => reject(tx.error);
  }));
}

/**
 * Count all records matching an index value.
 * @param {string} storeName
 * @param {string} indexName
 * @param {*} value
 * @returns {Promise<number>}
 */
export function idbCountByIndex(storeName, indexName, value) {
  return getDB().then(db => new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readonly');
    const index = tx.objectStore(storeName).index(indexName);
    const req   = index.count(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  }));
}

/**
 * Clear all records from a store.
 * @param {string} storeName
 * @returns {Promise<void>}
 */
export function idbClearStore(storeName) {
  return getDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readwrite')
                  .objectStore(storeName)
                  .clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  }));
}

/**
 * Delete all expired OHLC cache records (where expiresAt < Date.now()).
 * Call once on app startup to prevent stale candle data accumulating indefinitely.
 * Requires the expiresAt index (added in DB v3).
 * @returns {Promise<number>} count of purged records
 */
export function purgeExpiredOhlcCache() {
  return getDB().then(db => new Promise((resolve, reject) => {
    const tx    = db.transaction(STORES.OHLC_CACHE, 'readwrite');
    const store = tx.objectStore(STORES.OHLC_CACHE);

    // Guard: index may not exist on browsers that never upgraded to v3
    if (!store.indexNames.contains('expiresAt')) { resolve(0); return; }

    const now    = Date.now();
    const range  = IDBKeyRange.upperBound(now, false); // expiresAt <= now
    const index  = store.index('expiresAt');
    const req    = index.openCursor(range);
    let   count  = 0;

    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) { resolve(count); return; }
      cursor.delete();
      count++;
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  }));
}

/**
 * Count records matching a compound index key (e.g. [status, portfolioId]).
 * Falls back to full-scan filter if the index doesn't exist (pre-v3 DBs).
 * @param {string} storeName
 * @param {string} indexName
 * @param {Array}  value     — compound key array, e.g. ['pending', 'default']
 * @returns {Promise<number>}
 */
export function idbCountByCompoundIndex(storeName, indexName, value) {
  return getDB().then(db => new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);

    if (!store.indexNames.contains(indexName)) {
      // Fallback for pre-v3: getAll + filter in memory
      const req = store.getAll();
      req.onsuccess = () => {
        const [statusVal, pidVal] = value;
        const count = req.result.filter(
          r => r.status === statusVal && r.portfolioId === pidVal
        ).length;
        resolve(count);
      };
      req.onerror = () => reject(req.error);
      return;
    }

    const index = store.index(indexName);
    const req   = index.count(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  }));
}
