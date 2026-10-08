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
import { buildTradeSignatureKey, extractTradeIdentifiers } from '../utils/tradeDeduplicationEngine.js';

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
 * Automatically deduplicate trades for a portfolio based on canonical content signature and exchange IDs.
 * Purges obsolete duplicate IDs from STORES.TRADES in IndexedDB and re-sequences tradeNo cleanly (1..N).
 *
 * @param {object[]} trades
 * @param {string} portfolioId
 * @returns {Promise<object[]>}
 */
export async function deduplicateTradeRecords(trades = [], portfolioId) {
  if (!Array.isArray(trades) || trades.length <= 1) {
    return Array.isArray(trades) ? trades.map((t, i) => ({ ...t, tradeNo: t.tradeNo || (i + 1) })) : [];
  }

  const targetPid = portfolioId || 'portfolio-default';
  const sigMap = new Map();
  const idMap = new Map();
  const obsoleteIds = new Set();

  for (const t of trades) {
    if (!t) continue;
    const tPid = t.portfolioId || 'portfolio-default';
    if (tPid !== targetPid && targetPid !== 'all') {
      continue;
    }

    const directId = t.id || t.uid;
    const sig = buildTradeSignatureKey(t) || directId;
    const identifiers = extractTradeIdentifiers(t);

    let matchKey = null;
    let existing = null;

    if (directId && idMap.has(directId)) {
      matchKey = idMap.get(directId);
      existing = sigMap.get(matchKey);
    } else {
      for (const ident of identifiers) {
        if (idMap.has(ident)) {
          matchKey = idMap.get(ident);
          existing = sigMap.get(matchKey);
          break;
        }
      }
    }

    if (!existing && sigMap.has(sig)) {
      matchKey = sig;
      existing = sigMap.get(sig);
    }

    if (!existing) {
      const canonicalKey = sig || directId || `tmp-${Math.random()}`;
      sigMap.set(canonicalKey, t);
      if (directId) idMap.set(directId, canonicalKey);
      identifiers.forEach(ident => idMap.set(ident, canonicalKey));
    } else {
      // Conflict / duplicate found: resolve winner
      const exTs = existing.clientUpdatedAt || existing.updatedAt || 0;
      const tTs = t.clientUpdatedAt || t.updatedAt || 0;
      const hasRealBroker = t.broker && t.broker !== 'not_defined';
      const exHasRealBroker = existing.broker && existing.broker !== 'not_defined';

      let winner = existing;
      let loser = t;

      if (hasRealBroker && !exHasRealBroker) {
        winner = t;
        loser = existing;
      } else if (!hasRealBroker && exHasRealBroker) {
        winner = existing;
        loser = t;
      } else if (tTs > exTs) {
        winner = t;
        loser = existing;
      }

      // Preserve stable ID
      const chosenId = (existing.id && !existing.id.startsWith('trade-import-') && !existing.id.startsWith('trade-'))
        ? existing.id
        : (winner.id || existing.id);

      // Preserve exit details if one has exits and the other does not
      const winnerHasExit = winner.status === 'Closed' || winner.avgExitPrice > 0 || winner.e1Price > 0;
      const loserHasExit = loser.status === 'Closed' || loser.avgExitPrice > 0 || loser.e1Price > 0;
      const exitFields = (!winnerHasExit && loserHasExit) ? {
        status: loser.status,
        avgExitPrice: loser.avgExitPrice,
        exitDate: loser.exitDate,
        e1Price: loser.e1Price,
        e1Qty: loser.e1Qty,
        e1Date: loser.e1Date,
        pnl: loser.pnl,
        grossPnl: loser.grossPnl,
        netPnl: loser.netPnl,
        netPaise: loser.netPaise
      } : {};

      const combinedExIds = Array.from(new Set([
        ...(Array.isArray(existing.allExchangeTradeIds) ? existing.allExchangeTradeIds : []),
        ...(Array.isArray(t.allExchangeTradeIds) ? t.allExchangeTradeIds : [])
      ]));

      const merged = {
        ...loser,
        ...winner,
        ...exitFields,
        id: chosenId,
        portfolioId: targetPid,
        allExchangeTradeIds: combinedExIds
      };

      sigMap.set(matchKey, merged);

      if (loser.id && loser.id !== chosenId) {
        obsoleteIds.add(loser.id);
      }
      if (winner.id && winner.id !== chosenId) {
        obsoleteIds.add(winner.id);
      }
    }
  }

  // Purge obsolete duplicate IDs from IndexedDB
  if (obsoleteIds.size > 0) {
    try {
      const db = await getDB();
      const tx = db.transaction(STORES.TRADES, 'readwrite');
      const st = tx.objectStore(STORES.TRADES);
      obsoleteIds.forEach(id => st.delete(id));
      await new Promise((resolve) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      console.log(`[tradeStore] Purged ${obsoleteIds.size} duplicate trade records from IndexedDB`);
    } catch (_) {}
  }

  // Resequence sequentially 1..N
  const result = Array.from(sigMap.values())
    .sort((a, b) => {
      const dateA = a.date || a.entryDate || '';
      const dateB = b.date || b.entryDate || '';
      if (dateA && dateB && dateA !== dateB) {
        const dA = new Date(dateA).getTime();
        const dB = new Date(dateB).getTime();
        if (!isNaN(dA) && !isNaN(dB)) return dA - dB;
      }
      return (a.tradeNo ?? 0) - (b.tradeNo ?? 0);
    })
    .map((t, idx) => ({
      ...t,
      tradeNo: idx + 1
    }));

  return result;
}

/**
 * Get all active (non-deleted) trades for a portfolio.
 * Automatically deduplicated and sequentially numbered.
 *
 * @param {string} portfolioId
 * @returns {Promise<object[]>}
 */
export async function getTrades(portfolioId) {
  const all = await idbGetByIndex(STORES.TRADES, 'portfolioId', portfolioId);
  const active = all.filter(t => !t.deletedAt);
  return deduplicateTradeRecords(active, portfolioId);
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
  return deduplicateTradeRecords(all, portfolioId);
}

/**
 * Get all active trades across all portfolios.
 * @returns {Promise<object[]>}
 */
export async function getAllTrades() {
  const db = await getDB();
  const tx = db.transaction(STORES.TRADES, 'readonly');
  const st = tx.objectStore(STORES.TRADES);
  return new Promise((resolve, reject) => {
    const req = st.getAll();
    req.onsuccess = () => {
      const records = req.result || [];
      resolve(records.filter(t => !t.deletedAt));
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get active trade count for a specific portfolio.
 * @param {string} portfolioId
 * @returns {Promise<number>}
 */
export async function getTradeCount(portfolioId) {
  const trades = await getTrades(portfolioId);
  return trades.length;
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

  const dedupedTrades = await deduplicateTradeRecords(trades, portfolioId);

  const records = dedupedTrades.map(trade => ({
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
  const tx  = db.transaction(STORES.TRADES, 'readwrite');
  const st  = tx.objectStore(STORES.TRADES);

  return new Promise((resolve, reject) => {
    const req = st.getAll();
    req.onsuccess = () => {
      const records = req.result || [];
      let count = 0;
      const targetPid = portfolioId || 'portfolio-default';
      records.forEach(t => {
        const tPid = t.portfolioId || 'portfolio-default';
        if (tPid === targetPid || (targetPid === 'portfolio-default' && (tPid === 'default' || !t.portfolioId))) {
          st.delete(t.id);
          count++;
        }
      });
      tx.oncomplete = () => resolve(count);
    };
    req.onerror = () => reject(tx.error);
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

