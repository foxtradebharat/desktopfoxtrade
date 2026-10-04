/**
 * tradeStore.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Per-trade CRUD operations.
 *
 * Key architecture benefits:
 *   OLD: All trades stored as ONE JSON blob per user → load = download everything
 *   NEW: Each trade is its own IDB record → load = indexed reads, instant
 *
 * Every trade gets CRDT metadata on write:
 *   version          — incremented on every write (conflict detection)
 *   deviceId         — which device last wrote this trade
 *   clientUpdatedAt  — timestamp of the write (CRDT tie-breaker)
 *   deletedAt        — soft delete (tombstone propagation across devices)
 */

import { getDB, STORES, idbGet, idbPut, idbDelete, idbGetByIndex, idbBulkPut } from './foxtradeDB.js';
import { enqueue } from './operationsQueue.js';
import { getDeviceId } from './configStore.js';
import { normalizeBrokerId } from '../utils/brokerIds.js';

// ── Internal: build IDB-ready trade record ────────────────────────────────────

/**
 * Decorate a raw trade with CRDT metadata and portfolio scoping.
 * @param {object} trade — raw trade from UI
 * @param {string} portfolioId
 * @param {string} deviceId
 * @param {object} [existing] — existing IDB record (for version increment)
 * @returns {object}
 */
function decorateTrade(trade, portfolioId, deviceId, existing = null) {
  const now = Date.now();
  return {
    ...trade,
    // Ensure trade has a stable ID
    id: trade.id || trade.uid || `trade-${portfolioId}-${now}-${Math.random().toString(36).slice(2, 7)}`,
    portfolioId,
    // CRDT metadata
    version:         (existing?.version ?? 0) + 1,
    deviceId,
    clientUpdatedAt: now,
    updatedAt:       now,
    createdAt:       trade.createdAt || existing?.createdAt || now,
    deletedAt:       trade.deletedAt ?? null,
    // Derived status (computed from exit legs)
    status: trade.status || _computeStatus(trade),
  };
}

/**
 * Derive position status from trade fields.
 * Mirrors the foxCalculationEngine logic for IDB indexing.
 */
function _computeStatus(trade) {
  if (trade.status) return trade.status;
  const exitedQty = (Number(trade.e1Qty) || 0) + (Number(trade.e2Qty) || 0) + (Number(trade.e3Qty) || 0) + (Number(trade.e4Qty) || 0) + (Number(trade.e5Qty) || 0);
  const totalQty  = (Number(trade.qty) || 0) + (Number(trade.p1Qty) || 0) + (Number(trade.p2Qty) || 0) + (Number(trade.p3Qty) || 0) + (Number(trade.p4Qty) || 0);
  if (exitedQty === 0)            return 'Open';
  if (exitedQty >= totalQty)      return 'Closed';
  return 'Partial';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Upsert a single trade.
 * Increments version, sets CRDT metadata, enqueues for Drive sync.
 *
 * @param {string} portfolioId
 * @param {object} trade — raw trade object from UI
 * @returns {Promise<object>} the saved trade record
 */
export async function putTrade(portfolioId, trade) {
  const deviceId = await getDeviceId();
  const existing = await idbGet(STORES.TRADES, trade.id || trade.uid);
  const record   = decorateTrade(trade, portfolioId, deviceId, existing);

  await idbPut(STORES.TRADES, record);

  // Enqueue for Drive sync (drained when online)
  await enqueue({
    op:          existing ? 'UPDATE' : 'INSERT',
    entity:      'trade',
    entityId:    record.id,
    portfolioId,
    payload:     record,
  });

  return record;
}

/**
 * Get all active (non-deleted) trades for a portfolio.
 * Sorted by tradeNo ascending (same order as the journal table).
 *
 * @param {string} portfolioId
 * @returns {Promise<object[]>}
 */
export async function getTrades(portfolioId) {
  const all = await idbGetByIndex(STORES.TRADES, 'portfolioId', portfolioId);
  return all
    .filter(t => !t.deletedAt)
    .sort((a, b) => (a.tradeNo ?? 0) - (b.tradeNo ?? 0));
}

/**
 * Get ALL trades including soft-deleted ones.
 * Used by the sync engine for CRDT merge (tombstones must propagate).
 *
 * @param {string} portfolioId
 * @returns {Promise<object[]>}
 */
export async function getTradesWithDeleted(portfolioId) {
  const all = await idbGetByIndex(STORES.TRADES, 'portfolioId', portfolioId);
  return all.sort((a, b) => (a.tradeNo ?? 0) - (b.tradeNo ?? 0));
}

/**
 * Get a single trade by its ID.
 * @param {string} tradeId
 * @returns {Promise<object|null>}
 */
export async function getTradeById(tradeId) {
  return idbGet(STORES.TRADES, tradeId);
}

/**
 * Soft-delete a trade (sets deletedAt timestamp).
 * Tombstone propagates to other devices via Drive sync merge.
 *
 * @param {string} portfolioId
 * @param {string} tradeId
 * @returns {Promise<void>}
 */
export async function deleteTrade(portfolioId, tradeId) {
  const existing = await idbGet(STORES.TRADES, tradeId);
  if (!existing) return;

  const deviceId = await getDeviceId();
  const now      = Date.now();
  const record   = {
    ...existing,
    deletedAt:       now,
    clientUpdatedAt: now,
    updatedAt:       now,
    version:         (existing.version ?? 0) + 1,
    deviceId,
  };

  await idbPut(STORES.TRADES, record);

  await enqueue({
    op:          'DELETE',
    entity:      'trade',
    entityId:    tradeId,
    portfolioId,
    payload:     { id: tradeId, deletedAt: now },
  });
}

/**
 * Bulk upsert trades in a single IDB transaction.
 * Used for: initial data restore, Drive sync merge, migration from v1.
 *
 * @param {string} portfolioId
 * @param {object[]} trades — array of trade objects
 * @param {boolean} [skipQueue=false] — skip enqueueing (use true on restore/migrate)
 * @returns {Promise<number>} count of trades saved
 */
export async function bulkPutTrades(portfolioId, trades, skipQueue = false) {
  if (!trades || trades.length === 0) return 0;

  const deviceId = await getDeviceId();
  const now      = Date.now();

  const records = trades.map(trade => ({
    ...trade,
    id:              trade.id || trade.uid || `trade-${portfolioId}-${now}-${Math.random().toString(36).slice(2, 7)}`,
    portfolioId,
    version:         trade.version || 1,
    deviceId:        trade.deviceId || deviceId,
    clientUpdatedAt: trade.clientUpdatedAt || now,
    updatedAt:       trade.updatedAt || now,
    createdAt:       trade.createdAt || now,
    deletedAt:       trade.deletedAt ?? null,
    status:          trade.status || _computeStatus(trade),
  }));

  await idbBulkPut(STORES.TRADES, records);

  return records.length;
}

/**
 * Hard-clear all trade records for a portfolio from IDB.
 * Used when user does "Clear All Data" in settings.
 * WARNING: This is irreversible locally — only Drive backup remains.
 *
 * @param {string} portfolioId
 * @returns {Promise<number>} count of records deleted
 */
export async function clearTrades(portfolioId) {
  const db  = await getDB();
  const all = await idbGetByIndex(STORES.TRADES, 'portfolioId', portfolioId);

  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORES.TRADES, 'readwrite');
    const st  = tx.objectStore(STORES.TRADES);
    all.forEach(t => st.delete(t.id));
    tx.oncomplete = () => resolve(all.length);
    tx.onerror    = () => reject(tx.error);
  });
}

/**
 * Migrate trades from the old v1 format (single array blob) to per-trade records.
 * Called once on first run after upgrading to the new DB layer.
 * Safe to call multiple times — skips if trades already exist in v2.
 *
 * @param {string} uid  — Firebase user UID (used to read from old IDB)
 * @param {object[]} v1Trades — trades array from old foxtrade_db
 * @param {string} portfolioId — target portfolio in new DB
 * @returns {Promise<number>} count of trades migrated
 */
export async function migrateFromV1(uid, v1Trades, portfolioId) {
  if (!v1Trades || v1Trades.length === 0) return 0;

  // Check if v2 already has trades for this portfolio — avoid double-migration
  const existingV2 = await idbGetByIndex(STORES.TRADES, 'portfolioId', portfolioId);
  if (existingV2.length > 0) {
    console.log(`[TradeStore] Migration skipped — ${existingV2.length} trades already in v2`);
    return 0;
  }

  const deviceId = await getDeviceId();
  const now      = Date.now();

  // Normalize v1 trades: they may have uid as key, no id field, no CRDT metadata
  const normalized = v1Trades.map((t, idx) => ({
    ...t,
    // Generate stable ID from existing fields or create new
    id:              t.id || t.uid || `trade-${portfolioId}-migrated-${idx}`,
    portfolioId,
    version:         1,
    deviceId,
    clientUpdatedAt: t.timestamp || t.updatedAt || now,
    updatedAt:       t.timestamp || t.updatedAt || now,
    createdAt:       t.timestamp || t.createdAt || now,
    deletedAt:       null,
    status:          t.status || _computeStatus(t),
  }));

  await idbBulkPut(STORES.TRADES, normalized);
  console.log(`[TradeStore] Migrated ${normalized.length} trades from v1 → v2 for portfolio "${portfolioId}"`);
  return normalized.length;
}

/**
 * Reassign trade numbers for all active trades in a portfolio.
 * Called after add/delete to keep tradeNo sequential.
 *
 * @param {string} portfolioId
 * @returns {Promise<void>}
 */
export async function resequenceTradeNumbers(portfolioId) {
  const trades = await getTrades(portfolioId);
  if (trades.length === 0) return;

  const deviceId = await getDeviceId();
  const now      = Date.now();

  const resequenced = trades.map((t, idx) => ({
    ...t,
    tradeNo:         idx + 1,
    version:         (t.version ?? 0) + 1,
    deviceId,
    clientUpdatedAt: now,
    updatedAt:       now,
  }));

  await idbBulkPut(STORES.TRADES, resequenced);
}

/**
 * One-time migration to rewrite trade.broker to canonical broker IDs.
 * Flag key: tradeontip_migr_broker_ids_v1
 */
export async function migrateBrokerIds() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  if (localStorage.getItem('tradeontip_migr_broker_ids_v1')) return;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tradeontip_trades_')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              let changed = false;
              parsed.forEach(t => {
                if (t && t.broker) {
                  const canonical = normalizeBrokerId(t.broker);
                  if (canonical && canonical !== 'not_defined' && canonical !== t.broker) {
                    t.broker = canonical;
                    changed = true;
                  }
                }
              });
              if (changed) {
                localStorage.setItem(key, JSON.stringify(parsed));
              }
            }
          }
        } catch (_) {}
      }
    }

    try {
      const db = await getDB();
      const tx = db.transaction(STORES.TRADES, 'readwrite');
      const store = tx.objectStore(STORES.TRADES);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = req.result;
        if (Array.isArray(records)) {
          records.forEach(t => {
            if (t && t.broker) {
              const canonical = normalizeBrokerId(t.broker);
              if (canonical && canonical !== 'not_defined' && canonical !== t.broker) {
                t.broker = canonical;
                store.put(t);
              }
            }
          });
        }
      };
    } catch (_) {}

    localStorage.setItem('tradeontip_migr_broker_ids_v1', 'true');
    console.log('[TradeStore] Broker ID normalization migration v1 completed.');
  } catch (err) {
    console.error('[TradeStore] Migration error:', err);
  }
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    migrateBrokerIds();
  }, 100);
}

