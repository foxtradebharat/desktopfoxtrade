/**
 * syncEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Drive sync engine with CRDT merge.
 *
 * Architecture:
 *   - Google Drive is the user's personal cloud backup (they own it, not us)
 *   - Every write is stored locally in IDB first (instant, offline-safe)
 *   - This engine syncs IDB → Drive in the background (15s debounce)
 *   - On conflict (another device changed Drive): CRDT merge resolves it
 *   - On page hide / tab close: immediate flush (no data loss on close)
 *
 * Drive file structure (user's Google Drive):
 *   FoxTrade Backups/
 *     foxtrade-journal-{portfolioId}.json.gz   ← main backup (metadata + trades)
 *     charts/
 *       {portfolioId}/
 *         {tradeId}-beforeEntry.webp           ← images as separate binary files
 *         {tradeId}-afterExit.webp
 *
 * Backup format (v3.0):
 *   {
 *     version: '3.0',
 *     schemaVersion: 2,
 *     portfolioId: string,
 *     deviceId: string,
 *     exportedAt: ISO string,
 *     trades: Trade[],          ← ALL trades incl. soft-deleted (tombstones)
 *     metadata: {
 *       tradeCount: number,
 *       lastTradeUpdatedAt: number
 *     }
 *   }
 *
 * CRDT Merge Strategy (Last-Write-Wins per trade):
 *   - Compare by clientUpdatedAt timestamp
 *   - Deletion (deletedAt set) always wins over edit
 *   - Trades only in local → keep (new trade from this device)
 *   - Trades only in remote → keep (new trade from another device)
 *   - Trade in both → take whichever has higher clientUpdatedAt
 */

import { idbGet, idbPut, idbGetAll, getDB, STORES } from './foxtradeDB.js';
import { getDeviceId, getConfig, setConfig } from './configStore.js';
import { clearDoneOps } from './operationsQueue.js';
import { syncPendingImages } from './imageStore.js';
import {
  getCalendarNotes,
  getIndependentNotes,
  saveCalendarNotes,
  saveIndependentNotes,
} from './noteStore.js';
import {
  getValidAccessToken,
  refreshAccessToken,
  subscribeToTokenExpired,
  subscribeToTokenUpdate,
} from './tokenManager.js';
import { getDriveClient, subscribeToDriveStatus } from '../services/driveClient.js';
import { buildTradeSignatureKey, extractTradeIdentifiers } from '../utils/tradeDeduplicationEngine.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const FOLDER_NAME         = 'FoxTrade Backups';
const BACKUP_VERSION      = '3.0';
const SCHEMA_VERSION      = 2;
const DRIVE_API           = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API    = 'https://www.googleapis.com/upload/drive/v3/files';
const AUTO_SYNC_DEBOUNCE  = 15_000; // 15 seconds (was 30s in old code)

// In-memory debounce timer & live syncing status
let _syncTimer    = null;
let _syncActive   = false;
let _isSyncing    = false;
const _syncListeners = new Set();
let _lastSyncError = null;
const _syncErrorListeners = new Set();

/**
 * Listeners that fire when a CRDT Drive merge produces new/updated trades.
 * Used by dbService.js to notify UI subscribers in real-time after cross-device sync.
 */
const _mergeListeners = new Set();

/**
 * Subscribe to CRDT merge events — fires when a Drive sync merges remote trades
 * that were added or changed by another device. Use this to refresh the UI without
 * requiring a page reload.
 *
 * @param {(mergedTrades: object[], portfolioId: string) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribeToMergedTrades(callback) {
  _mergeListeners.add(callback);
  return () => _mergeListeners.delete(callback);
}

function _notifyMerge(mergedTrades, portfolioId) {
  _mergeListeners.forEach(cb => {
    try { cb(mergedTrades, portfolioId); } catch (_) {}
  });
}

/**
 * Subscribe to live syncing state changes (for UI cloud icon animation).
 * @param {(isSyncing: boolean) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribeToSyncStatus(callback) {
  _syncListeners.add(callback);
  callback(_isSyncing);
  return () => _syncListeners.delete(callback);
}

function setSyncingState(syncing) {
  _isSyncing = !!syncing;
  _syncListeners.forEach(cb => {
    try { cb(_isSyncing); } catch (_) {}
  });
}

/**
 * Subscribe to Drive sync errors.
 * @param {(error: string|null) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribeToSyncError(callback) {
  _syncErrorListeners.add(callback);
  callback(_lastSyncError);
  return () => _syncErrorListeners.delete(callback);
}

export function setSyncError(error) {
  _lastSyncError = error || null;
  _syncErrorListeners.forEach(cb => {
    try { cb(_lastSyncError); } catch (_) {}
  });
}

export function getLastSyncError() {
  return _lastSyncError;
}

// Drive session listeners disabled: app runs completely offline with local storage


// ── Compression helpers ───────────────────────────────────────────────────────

async function compressJSON(data) {
  const json = JSON.stringify(data);
  if (typeof CompressionStream === 'undefined') {
    return new TextEncoder().encode(json); // fallback: uncompressed
  }
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  writer.write(new TextEncoder().encode(json));
  writer.close();
  const chunks = [];
  const reader = stream.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total  = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let   offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

async function decompressBuffer(buffer) {
  try {
    if (typeof DecompressionStream !== 'undefined') {
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      writer.write(new Uint8Array(buffer));
      writer.close();
      const chunks = [];
      const reader = stream.readable.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const total  = chunks.reduce((s, c) => s + c.length, 0);
      const merged = new Uint8Array(total);
      let   offset = 0;
      for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
      return new TextDecoder().decode(merged);
    }
  } catch { /* not gzip — try as plain text */ }
  return new TextDecoder().decode(new Uint8Array(buffer));
}

// ── Drive error parser ────────────────────────────────────────────────────────

async function parseDriveResponseError(resp, actionName) {
  let detail = `${resp.status}`;
  try {
    const data = await resp.json();
    if (data?.error?.message) {
      const msg = data.error.message;
      if (
        msg.includes('Google Drive API has not been used') ||
        msg.includes('disabled') ||
        data?.error?.details?.some?.(d => d.reason === 'SERVICE_DISABLED')
      ) {
        return 'Google Drive API is disabled in your Google Cloud Project. Please enable "Google Drive API" in Google Cloud Console.';
      }
      if (
        resp.status === 401 ||
        msg.includes('invalid authentication credentials') ||
        msg.includes('OAuth 2') ||
        msg.includes('invalid_token') ||
        msg.includes('invalid_grant')
      ) {
        return 'Google Drive session expired. Please click "Reconnect Google Drive" to refresh your session.';
      }
      return msg;
    }
  } catch {}
  if (resp.status === 401) {
    return 'Google Drive session expired. Please click "Reconnect Google Drive" to refresh your session.';
  }
  return `${actionName} failed: ${detail}`;
}

// ── Drive fetch wrapper via Centralized Drive Client ──────────────────────────

/**
 * Resilient fetch wrapper routing through the centralized DriveClient.
 * Automatically handles token refresh, transient error retry with backoff,
 * and invalid_grant error detection.
 */
async function driveFetch(url, options = {}, token = null) {
  const client = getDriveClient();
  const resp = await client.fetch(url, options);
  if (resp.ok) {
    setSyncError(null);
  }
  return resp;
}

// ── Drive folder helpers ──────────────────────────────────────────────────────

async function getOrCreateFolder(accessToken, name, parentId = null) {
  const parentQ = parentId ? ` and '${parentId}' in parents` : '';
  const q       = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentQ}`;
  const search  = await driveFetch(`${DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`, {}, accessToken);
  if (!search.ok) {
    const errorMsg = await parseDriveResponseError(search, 'Drive folder search');
    throw new Error(errorMsg);
  }
  const { files } = await search.json();
  if (files?.[0]?.id) return files[0].id;

  const body = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) body.parents = [parentId];
  const create = await driveFetch(DRIVE_API, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }, accessToken);
  if (!create.ok) {
    const errorMsg = await parseDriveResponseError(create, 'Drive folder create');
    throw new Error(errorMsg);
  }
  const folder = await create.json();
  return folder.id;
}

async function findBackupFile(accessToken, fileName) {
  const q    = `name='${fileName}' and trashed=false`;
  const resp = await driveFetch(`${DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,size,modifiedTime)&pageSize=1`, {}, accessToken);
  if (!resp.ok) return null;
  const { files } = await resp.json();
  return files?.[0] || null;
}

// ── CRDT Merge ────────────────────────────────────────────────────────────────

/**
 * Merge local and remote trade arrays using Last-Write-Wins CRDT.
 *
 * Rules:
 *   1. If trade exists only in local  → include (new trade from this device)
 *   2. If trade exists only in remote → include (new trade from other device)
 *   3. If trade exists in both        → take whichever has higher clientUpdatedAt
 *   4. If deletedAt is set on either  → deletion wins (tombstone propagation)
 *
 * @param {object[]} local  — trades from IDB (including soft-deleted)
 * @param {object[]} remote — trades from Drive backup
 * @returns {object[]} merged trade array
 */
export function mergeTradeArrays(local = [], remote = []) {
  const localList = Array.isArray(local) ? local : [];
  const remoteList = Array.isArray(remote) ? remote : [];

  const idMap = new Map();
  const identMap = new Map();

  function resolveWinner(a, b) {
    if (!a) return b;
    if (!b) return a;

    // Deletion always wins (tombstone propagation)
    if (a.deletedAt || b.deletedAt) {
      return {
        ...a,
        ...b,
        deletedAt: a.deletedAt || b.deletedAt,
        version: Math.max(a.version || 1, b.version || 1) + 1
      };
    }

    const aTs = a.clientUpdatedAt || a.updatedAt || 0;
    const bTs = b.clientUpdatedAt || b.updatedAt || 0;
    const baseWinner = bTs > aTs ? b : a;
    const secondary = bTs > aTs ? a : b;

    // Preserve non-empty broker
    const broker = (baseWinner.broker && baseWinner.broker !== 'not_defined')
      ? baseWinner.broker
      : (secondary.broker && secondary.broker !== 'not_defined') ? secondary.broker : baseWinner.broker;

    // Preserve exit details if one has exits and the other does not
    const hasExit = baseWinner.status === 'Closed' || baseWinner.avgExitPrice > 0 || baseWinner.e1Price > 0;
    const secHasExit = secondary.status === 'Closed' || secondary.avgExitPrice > 0 || secondary.e1Price > 0;
    const exitData = (!hasExit && secHasExit) ? {
      status: secondary.status,
      avgExitPrice: secondary.avgExitPrice,
      exitDate: secondary.exitDate,
      e1Price: secondary.e1Price,
      e1Qty: secondary.e1Qty,
      e1Date: secondary.e1Date,
      pnl: secondary.pnl,
      grossPnl: secondary.grossPnl,
      netPnl: secondary.netPnl,
      netPaise: secondary.netPaise
    } : {};

    // Combine exchange IDs
    const exIds = new Set([
      ...(Array.isArray(a.allExchangeTradeIds) ? a.allExchangeTradeIds : []),
      ...(Array.isArray(b.allExchangeTradeIds) ? b.allExchangeTradeIds : [])
    ]);

    const chosenId = (a.id && !a.id.startsWith('trade-import-')) ? a.id : b.id;

    return {
      ...secondary,
      ...baseWinner,
      ...exitData,
      broker,
      allExchangeTradeIds: Array.from(exIds),
      id: chosenId
    };
  }

  function register(trade) {
    if (!trade) return;
    const id = trade.id || trade.uid;
    if (id) idMap.set(id, trade);

    const idents = extractTradeIdentifiers(trade);
    idents.forEach(ident => {
      identMap.set(ident, trade);
    });
  }

  function findMatch(trade) {
    if (!trade) return null;
    const id = trade.id || trade.uid;
    if (id && idMap.has(id)) return idMap.get(id);

    const idents = extractTradeIdentifiers(trade);
    for (const ident of idents) {
      if (identMap.has(ident)) return identMap.get(ident);
    }
    return null;
  }

  // 1. Seed local
  for (const t of localList) {
    const existing = findMatch(t);
    if (!existing) {
      register(t);
    } else {
      const winner = resolveWinner(existing, t);
      if (existing.id && existing.id !== winner.id) idMap.delete(existing.id);
      register(winner);
    }
  }

  // 2. Merge remote
  for (const rt of remoteList) {
    const existing = findMatch(rt);
    if (!existing) {
      register(rt);
    } else {
      const winner = resolveWinner(existing, rt);
      if (existing.id && existing.id !== winner.id) idMap.delete(existing.id);
      register(winner);
    }
  }

  // Final pass: ensure strict uniqueness by signature to prevent any duplicate entries
  const dedupedMap = new Map();
  for (const trade of idMap.values()) {
    const sig = buildTradeSignatureKey(trade) || trade.id;
    if (!dedupedMap.has(sig)) {
      dedupedMap.set(sig, trade);
    } else {
      const winner = resolveWinner(dedupedMap.get(sig), trade);
      dedupedMap.set(sig, winner);
    }
  }

  return Array.from(dedupedMap.values());
}

/**
 * Merge two Foxy chat arrays by conversation ID without duplicates.
 * Preserves the chat with the latest timestamp or most messages.
 * @param {object[]} local
 * @param {object[]} remote
 * @returns {object[]}
 */
export function mergeFoxyChats(local = [], remote = []) {
  if (!Array.isArray(local) || local.length === 0) return Array.isArray(remote) ? remote : [];
  if (!Array.isArray(remote) || remote.length === 0) return local;

  const getContentLength = (chat) => {
    if (!Array.isArray(chat?.messages)) return 0;
    return chat.messages.reduce((sum, m) => sum + (m?.content?.length || m?.text?.length || 0), 0);
  };

  const map = new Map();
  for (const c of local) {
    if (c && c.id) map.set(c.id, c);
  }

  for (const rc of remote) {
    if (!rc || !rc.id) continue;
    const lc = map.get(rc.id);
    if (!lc) {
      map.set(rc.id, rc);
    } else {
      const lcChars = getContentLength(lc);
      const rcChars = getContentLength(rc);
      if (rcChars > lcChars) {
        map.set(rc.id, rc);
      } else if (lcChars > rcChars) {
        // Keep local with more content
      } else {
        const lcLen = lc.messages?.length || 0;
        const rcLen = rc.messages?.length || 0;
        if (rcLen > lcLen || (rc.updatedAt || 0) > (lc.updatedAt || 0)) {
          map.set(rc.id, rc);
        }
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
}

/**
 * Merge two commitment rule arrays with deduplication.
 * @param {string[]} local
 * @param {string[]} remote
 * @returns {string[]}
 */
export function mergeFoxyCommitments(local = [], remote = []) {
  const combined = [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])];
  const unique = [];
  for (const rule of combined) {
    if (typeof rule === 'string' && rule.trim() && !unique.includes(rule.trim())) {
      unique.push(rule.trim());
    }
  }
  return unique.slice(-15);
}

// ── Build / Parse backup payload ──────────────────────────────────────────────

/**
 * Build a compressed gzip backup payload.
 * @param {string} portfolioId
 * @param {object[]} trades  — ALL trades including soft-deleted
 * @param {string} deviceId
 * @returns {Promise<Uint8Array>}
 */
/**
 * Build a full uncompressed backup snapshot containing all domains:
 * trades, notes, foxy AI, settings, fund management, monthly performance, tax analytics, app preferences.
 *
 * @param {string} portfolioId
 * @param {object[]} trades
 * @param {string} [deviceId]
 * @returns {Promise<object>} full snapshot object
 */
export async function buildFullBackupSnapshot(portfolioId, trades, deviceId) {
  let notes = null;
  let independentNotes = null;
  try {
    const rawCalendar = await getCalendarNotes();
    if (rawCalendar && typeof rawCalendar === 'object' && Object.keys(rawCalendar).length > 0) {
      notes = rawCalendar;
    }
    const rawInd = await getIndependentNotes();
    if (Array.isArray(rawInd) && rawInd.length > 0) {
      independentNotes = rawInd;
    }
  } catch (err) {
    console.warn('[SyncEngine] Error reading notes for snapshot:', err);
  }

  let foxyChats = null;
  let foxyCommitments = null;
  let foxyConfig = null;
  try {
    const rawChats = await getConfig('foxy_ai_chats', null);
    if (Array.isArray(rawChats) && rawChats.length > 0) foxyChats = rawChats;

    const rawComms = await getConfig('foxy_trader_commitments', null);
    if (Array.isArray(rawComms) && rawComms.length > 0) foxyCommitments = rawComms;

    const provider = await getConfig('foxy_ai_provider', null);
    const model = await getConfig('foxy_ai_model', null);
    const apiKey = await getConfig('foxy_ai_api_key', null);
    if (apiKey || provider || model) {
      foxyConfig = { provider, model, apiKey };
    }
  } catch (err) {
    console.warn('[SyncEngine] Error reading Foxy AI data for snapshot:', err);
  }

  // Settings & Preferences
  let journalSettings = null;
  try {
    const rawSettings = localStorage.getItem('tradeontip_settings');
    if (rawSettings) journalSettings = JSON.parse(rawSettings);
  } catch (_) {}

  // Fund Management & Capital Base
  let fundManagement = null;
  let baseCapital = null;
  try {
    const rawCap = localStorage.getItem(`tradeontip_base_capital_${portfolioId}`) || localStorage.getItem('tradeontip_base_capital');
    if (rawCap) baseCapital = Number(rawCap);

    const capMap = {};
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith(`tradeontip_monthly_capital_${portfolioId}_`) || 
          key.startsWith('tradeontip_monthly_capital_') ||
          key.startsWith(`tradeontip_ledger_entries_${portfolioId}_`) ||
          key.startsWith('tradeontip_ledger_entries_')
        )) {
          try {
            capMap[key] = JSON.parse(localStorage.getItem(key));
          } catch (_) {}
        }
      }
    }
    if (Object.keys(capMap).length > 0) fundManagement = capMap;
  } catch (_) {}

  // Monthly Performance Records (from dedicated IDB monthly_perf store)
  let monthlyPerf = null;
  try {
    const db = await getDB();
    if (db.objectStoreNames.contains(STORES.MONTHLY_PERF)) {
      const allMonthly = await idbGetAll(STORES.MONTHLY_PERF);
      const pfMonthly = allMonthly.filter(m => !m.portfolioId || m.portfolioId === portfolioId);
      if (pfMonthly.length > 0) monthlyPerf = pfMonthly;
    }
  } catch (err) {
    console.warn('[SyncEngine] Error reading monthlyPerf for snapshot:', err);
  }

  // Tax Analytics Data
  let taxAnalytics = null;
  try {
    const taxMap = {};
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('foxtrade_monthly_taxes_') || key === 'foxtrade_auto_taxes_enabled')) {
          try {
            taxMap[key] = JSON.parse(localStorage.getItem(key));
          } catch (_) {
            taxMap[key] = localStorage.getItem(key);
          }
        }
      }
    }
    if (Object.keys(taxMap).length > 0) taxAnalytics = taxMap;
  } catch (err) {
    console.warn('[SyncEngine] Error reading taxAnalytics for snapshot:', err);
  }

  // App Preferences & Column Layout
  let appSettings = null;
  try {
    const appSettingsMap = {};
    const appKeys = [
      'tradeontip_visible_cols_v5',
      'tradeontip_col_order_v5',
      'tradeontip_theme',
      'tradeontip_trading_market',
    ];
    appKeys.forEach(k => {
      try {
        const val = localStorage.getItem(k);
        if (val) appSettingsMap[k] = JSON.parse(val);
      } catch (_) {
        const raw = localStorage.getItem(k);
        if (raw) appSettingsMap[k] = raw;
      }
    });
    if (Object.keys(appSettingsMap).length > 0) appSettings = appSettingsMap;
  } catch (err) {
    console.warn('[SyncEngine] Error reading appSettings for snapshot:', err);
  }

  // Broker Credentials
  let brokerTokens = null;
  try {
    const brokerMap = {};
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('foxtrade_broker_token_')) {
          brokerMap[key] = localStorage.getItem(key);
        }
      }
    }
    if (Object.keys(brokerMap).length > 0) brokerTokens = brokerMap;
  } catch (err) {
    console.warn('[SyncEngine] Error reading brokerTokens for snapshot:', err);
  }

  return {
    version:       BACKUP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    portfolioId,
    deviceId:      deviceId || 'local-device',
    exportedAt:    new Date().toISOString(),
    trades:        trades || [],
    ...(notes ? { notes } : {}),
    ...(independentNotes ? { independentNotes } : {}),
    ...(foxyChats ? { foxyChats } : {}),
    ...(foxyCommitments ? { foxyCommitments } : {}),
    ...(foxyConfig ? { foxyConfig } : {}),
    ...(journalSettings ? { journalSettings } : {}),
    ...(fundManagement ? { fundManagement } : {}),
    ...(baseCapital ? { baseCapital } : {}),
    ...(monthlyPerf ? { monthlyPerf } : {}),
    ...(taxAnalytics ? { taxAnalytics } : {}),
    ...(appSettings ? { appSettings } : {}),
    ...(brokerTokens ? { brokerTokens } : {}),
    metadata: {
      tradeCount:          (trades || []).filter(t => !t.deletedAt).length,
      lastTradeUpdatedAt:  Math.max(0, ...(trades || []).map(t => t.clientUpdatedAt || 0)),
      hasFoxyData:         !!(foxyChats?.length || foxyCommitments?.length || foxyConfig?.apiKey),
      hasFundData:         !!(fundManagement || baseCapital || monthlyPerf),
      hasSettingsData:     !!(journalSettings || appSettings),
      hasTaxData:          !!taxAnalytics,
    },
  };
}

/**
 * Build a compressed gzip backup payload.
 * @param {string} portfolioId
 * @param {object[]} trades  — ALL trades including soft-deleted
 * @param {string} deviceId
 * @returns {Promise<Uint8Array>}
 */
export async function buildDrivePayload(portfolioId, trades, deviceId) {
  const payload = await buildFullBackupSnapshot(portfolioId, trades, deviceId);
  return compressJSON(payload);
}

/**
 * Parse a Drive backup payload (handles both gzip and plain JSON).
 * @param {ArrayBuffer} buffer
 * @returns {Promise<object|null>}
 */
export async function parseDrivePayload(buffer) {
  try {
    const text = await decompressBuffer(buffer);
    const data = JSON.parse(text);
    // Normalise: handle old v2.0 format (has data.trades)
    if (Array.isArray(data.trades)) return data;
    if (Array.isArray(data))        return { trades: data };
    return null;
  } catch (err) {
    console.error('[SyncEngine] Failed to parse Drive payload:', err.message);
    return null;
  }
}

// ── Core sync operations ──────────────────────────────────────────────────────

/**
 * Save all trades and application state for a portfolio to local storage.
 *
 * @param {string} portfolioId
 * @param {object[]} trades  — ALL trades including soft-deleted
 * @param {string} [accessToken]
 * @param {boolean} [forceOverwrite]
 * @returns {Promise<{success: boolean, mode: string, merged: boolean, tradeCount: number, error?: string, snapshot?: object}>}
 */
export async function saveToDrive(portfolioId, trades, accessToken, forceOverwrite = false) {
  setSyncingState(true);
  try {
    const pid = portfolioId || 'default';
    const devId = await getDeviceId().catch(() => 'local-device');
    const snapshot = await buildFullBackupSnapshot(pid, trades || [], devId);

    try {
      localStorage.setItem(`foxtrade_local_snapshot_${pid}`, JSON.stringify(snapshot));
    } catch (_) {}

    await clearDoneOps().catch(() => {});
    setSyncError(null);
    setSyncingState(false);
    return { success: true, mode: 'local', merged: false, tradeCount: (trades || []).length, snapshot };
  } catch (err) {
    console.error('[SyncEngine] Save local snapshot failed:', err.message);
    setSyncError(err.message);
    setSyncingState(false);
    return { success: false, merged: false, tradeCount: 0, error: err.message };
  }
}

/**
 * Restore and load state from local storage snapshot.
 * Restores notes, foxy AI, settings, fund management, taxes, and returns trades.
 *
 * @param {string} portfolioId
 * @param {string} [accessToken]
 * @returns {Promise<object[]>} trade array
 */
export async function loadFromDrive(portfolioId, accessToken) {
  try {
    const pid = portfolioId || 'default';
    const raw = localStorage.getItem(`foxtrade_local_snapshot_${pid}`);
    if (!raw) return [];
    const payload = JSON.parse(raw);
    if (!payload) return [];

    // 1. Restore calendar and independent notes
    if (payload.notes && typeof payload.notes === 'object') {
      try {
        await saveCalendarNotes(payload.notes);
      } catch (e) {
        console.warn('[SyncEngine] Failed to restore calendar notes:', e);
      }
    }
    if (Array.isArray(payload.independentNotes)) {
      try {
        await saveIndependentNotes(payload.independentNotes);
      } catch (e) {
        console.warn('[SyncEngine] Failed to restore independent notes:', e);
      }
    }

    // 2. Restore Foxy AI chats
    if (Array.isArray(payload.foxyChats) && payload.foxyChats.length > 0) {
      try {
        const localChats = await getConfig('foxy_ai_chats', []);
        const mergedChats = mergeFoxyChats(localChats, payload.foxyChats);
        await setConfig('foxy_ai_chats', mergedChats);
      } catch (e) {
        console.warn('[SyncEngine] Restore foxyChats failed:', e);
      }
    }

    // 3. Restore Foxy trader commitments
    if (Array.isArray(payload.foxyCommitments) && payload.foxyCommitments.length > 0) {
      try {
        const localComms = await getConfig('foxy_trader_commitments', []);
        const mergedComms = mergeFoxyCommitments(localComms, payload.foxyCommitments);
        await setConfig('foxy_trader_commitments', mergedComms);
      } catch (e) {
        console.warn('[SyncEngine] Restore foxyCommitments failed:', e);
      }
    }

    // 4. Restore Foxy API key and config
    if (payload.foxyConfig && typeof payload.foxyConfig === 'object') {
      try {
        const localKey = await getConfig('foxy_ai_api_key', '');
        if (payload.foxyConfig.apiKey && (!localKey || localKey.trim() === '')) {
          await setConfig('foxy_ai_api_key', payload.foxyConfig.apiKey);
        }
        if (payload.foxyConfig.provider) {
          await setConfig('foxy_ai_provider', payload.foxyConfig.provider);
        }
        if (payload.foxyConfig.model) {
          await setConfig('foxy_ai_model', payload.foxyConfig.model);
        }
      } catch (e) {
        console.warn('[SyncEngine] Restore foxyConfig failed:', e);
      }
    }

    // 5. Restore journal settings
    if (payload.journalSettings && typeof payload.journalSettings === 'object') {
      try {
        const localSettingsStr = localStorage.getItem('tradeontip_settings');
        const localSettings = localSettingsStr ? JSON.parse(localSettingsStr) : {};
        const mergedSettings = { ...payload.journalSettings, ...localSettings };
        localStorage.setItem('tradeontip_settings', JSON.stringify(mergedSettings));
        await setConfig('journal_settings', mergedSettings).catch(() => {});
        window.dispatchEvent(new CustomEvent('tradeontip_settings_updated', { detail: mergedSettings }));
      } catch (e) {
        console.warn('[SyncEngine] Restore journal settings failed:', e);
      }
    }

    // 6. Restore fund management & base capital
    if (payload.fundManagement && typeof payload.fundManagement === 'object') {
      try {
        await setConfig(`fund_management_${portfolioId}`, payload.fundManagement).catch(() => {});
        Object.entries(payload.fundManagement).forEach(([key, val]) => {
          if (key && val) {
            localStorage.setItem(key, JSON.stringify(val));
          }
        });

        if (payload.baseCapital && Number(payload.baseCapital) > 0) {
          localStorage.setItem(`tradeontip_base_capital_${portfolioId}`, String(payload.baseCapital));
          if (portfolioId === 'portfolio-default') {
            localStorage.setItem('tradeontip_base_capital', String(payload.baseCapital));
          }
          await setConfig(`base_capital_${portfolioId}`, Number(payload.baseCapital)).catch(() => {});
        }

        window.dispatchEvent(new CustomEvent('tradeontip_capital_updated', {
          detail: { portfolioId, year: '2026' }
        }));
      } catch (e) {
        console.warn('[SyncEngine] Restore fund management failed:', e);
      }
    }

    // 7. Restore monthly performance
    if (Array.isArray(payload.monthlyPerf)) {
      try {
        for (const item of payload.monthlyPerf) {
          if (item && item.pid_year_month && item.data) {
            await idbPut(STORES.MONTHLY_PERF, item).catch(() => {});
          }
        }
      } catch (e) {
        console.warn('[SyncEngine] Restore monthlyPerf failed:', e);
      }
    }

    // 8. Restore tax analytics
    if (payload.taxAnalytics && typeof payload.taxAnalytics === 'object') {
      try {
        Object.entries(payload.taxAnalytics).forEach(([k, v]) => {
          if (k && v !== undefined) {
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
          }
        });
        window.dispatchEvent(new CustomEvent('tradeontip_taxes_updated', { detail: { portfolioId } }));
      } catch (e) {
        console.warn('[SyncEngine] Restore taxAnalytics failed:', e);
      }
    }

    // 9. Restore app settings & column layout
    if (payload.appSettings && typeof payload.appSettings === 'object') {
      try {
        Object.entries(payload.appSettings).forEach(([k, v]) => {
          if (k && v !== undefined) {
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
          }
        });
        if (payload.appSettings['tradeontip_visible_cols_v5']) {
          window.dispatchEvent(new CustomEvent('tradeontip_columns_updated', { detail: payload.appSettings['tradeontip_visible_cols_v5'] }));
        }
      } catch (e) {
        console.warn('[SyncEngine] Restore appSettings failed:', e);
      }
    }

    return Array.isArray(payload.trades) ? payload.trades : [];
  } catch (err) {
    console.warn('[SyncEngine] Load from local snapshot failed:', err.message);
    return [];
  }
}

/**
 * Get sync status for a portfolio.
 * @param {string} portfolioId
 * @returns {Promise<{lastSyncedAt: number|null, lastDriveFileId: string|null}>}
 */
export async function getSyncStatus(portfolioId) {
  const cursor = await idbGet(STORES.SYNC_CURSORS, portfolioId);
  return {
    lastSyncedAt:    cursor?.lastSyncedAt    || Date.now(),
    lastDriveFileId: cursor?.lastDriveFileId || 'local',
  };
}

// ── Auto-sync (debounced) ─────────────────────────────────────────────────────

/**
 * Trigger a debounced local database sync.
 * Waits 15 seconds after the last call before syncing.
 *
 * @param {string} portfolioId
 * @param {string} accessToken
 * @param {object[]} trades  — ALL trades (including soft-deleted)
 */
export function triggerAutoSync(portfolioId, accessToken, trades) {
  if (!portfolioId) return;
  if (_syncTimer) clearTimeout(_syncTimer);

  _syncTimer = setTimeout(() => {
    _syncTimer = null;
    if (_syncActive) return;
    _syncActive = true;
    saveToDrive(portfolioId, trades, accessToken)
      .catch(err => console.warn('[SyncEngine] Auto-sync error:', err.message))
      .finally(() => { _syncActive = false; });
  }, AUTO_SYNC_DEBOUNCE);
}

/**
 * Flush immediately (bypass debounce).
 * Called on page hide / tab close to prevent data loss.
 *
 * @param {string} portfolioId
 * @param {string} accessToken
 * @param {object[]} trades
 */
export async function flushSync(portfolioId, accessToken, trades) {
  if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null; }
  if (!portfolioId) return;
  try {
    await saveToDrive(portfolioId, trades, accessToken);
  } catch (err) {
    console.warn('[SyncEngine] Flush sync error:', err.message);
  }
}

/**
 * Set up page-hide / visibility-change listeners for immediate flush on close.
 * Call once on app init. Returns a cleanup function.
 *
 * @param {() => string}   getPortfolioId  — fn returning current portfolio ID
 * @param {() => object[]} getTrades       — fn returning current trades array
 * @param {() => Promise<string|null>} getToken — fn returning valid access token
 * @returns {() => void} cleanup function
 */
export function initPageHideFlush(getPortfolioId, getTrades, getToken) {
  const flush = async () => {
    try {
      await flushSync(getPortfolioId(), null, getTrades());
    } catch {}
  };

  const onHide       = () => { if (document.visibilityState === 'hidden') flush(); };
  const onPageHide   = () => flush();

  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onPageHide);

  return () => {
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onPageHide);
  };
}

// ── Backup Management for Restore UI ──────────────────────────────────────────

/**
 * List all available local database snapshots.
 * @param {string} accessToken
 * @returns {Promise<Array<{id: string, name: string, size: number, modifiedTime: string, portfolioId: string, isLocal: boolean}>>}
 */
export async function listDriveBackups(accessToken) {
  try {
    const list = [];
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('foxtrade_local_snapshot_')) {
          const raw = localStorage.getItem(key);
          try {
            const data = JSON.parse(raw);
            const pid = data.portfolioId || key.replace('foxtrade_local_snapshot_', '');
            const tradeCount = Array.isArray(data.trades) ? data.trades.filter(t => !t.deletedAt).length : 0;
            list.push({
              id: key,
              name: `Local Snapshot (${pid})`,
              size: raw ? raw.length : 0,
              modifiedTime: data.exportedAt || new Date().toISOString(),
              createdTime: data.exportedAt || new Date().toISOString(),
              portfolioId: pid,
              tradeCount,
              isLocal: true,
              data
            });
          } catch (_) {}
        }
      }
    }
    return list.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
  } catch (err) {
    console.warn('[SyncEngine] listDriveBackups error:', err.message);
    return [];
  }
}

/**
 * Download a specific local backup snapshot by key.
 * @param {string} fileId
 * @param {string} accessToken
 * @returns {Promise<object|null>} parsed backup object { trades, metadata, exportedAt, version }
 */
export async function downloadBackupFileById(fileId, accessToken) {
  if (!fileId) return null;
  try {
    const raw = localStorage.getItem(fileId);
    if (raw) return JSON.parse(raw);

    const byPid = localStorage.getItem(`foxtrade_local_snapshot_${fileId}`);
    if (byPid) return JSON.parse(byPid);

    return null;
  } catch (err) {
    console.error('[SyncEngine] downloadBackupFileById error:', err.message);
    return null;
  }
}

/**
 * Delete a local backup snapshot.
 * @param {string} fileId
 * @param {string} accessToken
 * @returns {Promise<boolean>}
 */
export async function deleteBackupFileById(fileId, accessToken) {
  if (!fileId) return false;
  try {
    localStorage.removeItem(fileId);
    if (!fileId.startsWith('foxtrade_local_snapshot_')) {
      localStorage.removeItem(`foxtrade_local_snapshot_${fileId}`);
    }
    return true;
  } catch (err) {
    console.error('[SyncEngine] deleteBackupFileById error:', err.message);
    return false;
  }
}

/**
 * Delete all FoxTrade local backup snapshots.
 * @param {string} accessToken
 * @returns {Promise<boolean>}
 */
export async function clearAllDriveBackups(accessToken) {
  try {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('foxtrade_local_snapshot_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
    return true;
  } catch (err) {
    console.warn('[SyncEngine] clearAllDriveBackups error:', err);
    return false;
  }
}

/**
 * Delete local backup snapshot for a specific portfolio.
 * @param {string} portfolioId
 * @param {string} accessToken
 * @returns {Promise<boolean>}
 */
export async function deleteBackupForPortfolio(portfolioId, accessToken) {
  if (!portfolioId) return false;
  try {
    localStorage.removeItem(`foxtrade_local_snapshot_${portfolioId}`);
    return true;
  } catch (err) {
    console.warn('[SyncEngine] deleteBackupForPortfolio error:', err);
    return false;
  }
}


