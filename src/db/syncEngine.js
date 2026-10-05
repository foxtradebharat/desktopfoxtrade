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

// Automatically bridge token expiration into sync error state
subscribeToTokenExpired(() => {
  setSyncError('Google Drive session expired. Please click "Reconnect Google Drive" to refresh your session.');
});

// Automatically clear sync error state as soon as a fresh valid token is active
subscribeToTokenUpdate((tok) => {
  if (tok && tok !== 'demo-token') {
    setSyncError(null);
  }
});

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
        msg.includes('invalid_token')
      ) {
        return 'Google Drive session expired (1-hour token limit). Please click "Reconnect Google Drive" to refresh your session.';
      }
      return msg;
    }
  } catch {}
  if (resp.status === 401) {
    return 'Google Drive session expired (1-hour token limit). Please click "Reconnect Google Drive" to refresh your session.';
  }
  return `${actionName} failed: ${detail}`;
}

// ── Drive fetch wrapper with transparent 401 retry ─────────────────────────────

/**
 * Resilient fetch wrapper for all Google Drive API requests.
 * Automatically handles Bearer Authorization and transparently retries ONCE
 * after force-refreshing the token if Google returns 401 Unauthorized.
 */
async function driveFetch(url, options = {}, token = null) {
  let currentToken = token || (await getValidAccessToken().catch(() => null));
  if (!currentToken || currentToken === 'demo-token') {
    throw new Error('Not authenticated with Google Drive.');
  }

  const baseHeaders = options.headers || {};
  let reqHeaders;
  if (typeof Headers !== 'undefined' && baseHeaders instanceof Headers) {
    reqHeaders = new Headers(baseHeaders);
    reqHeaders.set('Authorization', `Bearer ${currentToken}`);
  } else {
    reqHeaders = {
      ...baseHeaders,
      Authorization: `Bearer ${currentToken}`,
    };
  }

  let resp = await fetch(url, { ...options, headers: reqHeaders });

  // On 401 Unauthorized: automatically force-refresh token and retry ONCE
  if (resp.status === 401) {
    console.warn('[SyncEngine] Drive API returned 401 — force-refreshing token and retrying once...');
    const refreshedToken = await refreshAccessToken(true).catch(() => null);
    if (refreshedToken) {
      if (typeof Headers !== 'undefined' && reqHeaders instanceof Headers) {
        reqHeaders.set('Authorization', `Bearer ${refreshedToken}`);
      } else {
        reqHeaders.Authorization = `Bearer ${refreshedToken}`;
      }
      resp = await fetch(url, { ...options, headers: reqHeaders });
      if (resp.ok) {
        setSyncError(null);
      }
    }
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
export function mergeTradeArrays(local, remote) {
  const map = new Map();

  // Seed with local
  for (const t of local) map.set(t.id, t);

  // Merge remote
  for (const remoteTrade of remote) {
    const localTrade = map.get(remoteTrade.id);

    if (!localTrade) {
      // New trade from other device — include it
      map.set(remoteTrade.id, remoteTrade);
      continue;
    }

    const localTs  = localTrade.clientUpdatedAt  || localTrade.updatedAt  || 0;
    const remoteTs = remoteTrade.clientUpdatedAt || remoteTrade.updatedAt || 0;

    // Deletion always wins (tombstone propagation)
    const winner = (remoteTrade.deletedAt && !localTrade.deletedAt)
      ? { ...localTrade, deletedAt: remoteTrade.deletedAt }
      : (localTrade.deletedAt && !remoteTrade.deletedAt)
        ? localTrade
        : remoteTs > localTs
          ? remoteTrade
          : localTrade;

    map.set(remoteTrade.id, winner);
  }

  return Array.from(map.values());
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
export async function buildDrivePayload(portfolioId, trades, deviceId) {
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
    console.warn('[SyncEngine] Error reading notes for backup:', err);
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
    console.warn('[SyncEngine] Error reading Foxy AI data for backup:', err);
  }

  // 3. Settings & Preferences
  let journalSettings = null;
  try {
    const rawSettings = localStorage.getItem('tradeontip_settings');
    if (rawSettings) journalSettings = JSON.parse(rawSettings);
  } catch (_) {}

  // 4. Fund Management & Capital Base
  let fundManagement = null;
  let baseCapital = null;
  try {
    const rawCap = localStorage.getItem('tradeontip_base_capital');
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

  // 5. Monthly Performance Records (from dedicated IDB monthly_perf store)
  let monthlyPerf = null;
  try {
    const db = await getDB();
    if (db.objectStoreNames.contains(STORES.MONTHLY_PERF)) {
      const allMonthly = await idbGetAll(STORES.MONTHLY_PERF);
      const pfMonthly = allMonthly.filter(m => !m.portfolioId || m.portfolioId === portfolioId);
      if (pfMonthly.length > 0) monthlyPerf = pfMonthly;
    }
  } catch (err) {
    console.warn('[SyncEngine] Error reading monthlyPerf for backup:', err);
  }

  // 6. Tax Analytics Data (monthly tax records & auto tax settings)
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
    console.warn('[SyncEngine] Error reading taxAnalytics for backup:', err);
  }

  // 7. App Preferences & Column Layout
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
    console.warn('[SyncEngine] Error reading appSettings for backup:', err);
  }

  // 8. Broker Credentials (Encrypted AES-GCM ciphertext)
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
    console.warn('[SyncEngine] Error reading brokerTokens for backup:', err);
  }

  const payload = {
    version:       BACKUP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    portfolioId,
    deviceId,
    exportedAt:    new Date().toISOString(),
    trades,
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
      tradeCount:          trades.filter(t => !t.deletedAt).length,
      lastTradeUpdatedAt:  Math.max(0, ...trades.map(t => t.clientUpdatedAt || 0)),
      hasFoxyData:         !!(foxyChats?.length || foxyCommitments?.length || foxyConfig?.apiKey),
      hasFundData:         !!(fundManagement || baseCapital || monthlyPerf),
      hasSettingsData:     !!(journalSettings || appSettings),
      hasTaxData:          !!taxAnalytics,
    },
  };
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
 * Save all trades for a portfolio to Google Drive with CRDT merge.
 *
 * Steps:
 *   1. Get or create FoxTrade Backups folder
 *   2. Check if remote file exists and get its current state
 *   3. If remote changed since last sync → download, merge, then upload merged
 *   4. If no conflict → upload directly
 *   5. Update sync cursor in IDB
 *
 * @param {string} portfolioId
 * @param {object[]} trades  — ALL trades including soft-deleted
 * @param {string} accessToken
 * @returns {Promise<{success: boolean, merged: boolean, tradeCount: number, error?: string}>}
 */
export async function saveToDrive(portfolioId, trades, accessToken, forceOverwrite = false) {
  const validToken = (await getValidAccessToken().catch(() => null)) || accessToken;
  if (!validToken || validToken === 'demo-token') return { success: true, mode: 'local' };

  setSyncingState(true);
  try {
    const deviceId = await getDeviceId();
    let currentToken = validToken;
    const folderId = await getOrCreateFolder(currentToken, FOLDER_NAME);
    currentToken = (await getValidAccessToken().catch(() => null)) || currentToken;
    const fileName = `foxtrade-journal-${portfolioId}.json.gz`;
    let existing = await findBackupFile(currentToken, fileName);
    if (!existing) {
      existing = await findBackupFile(currentToken, `foxtrade-journal-backup-${portfolioId}.json.gz`);
    }
    currentToken = (await getValidAccessToken().catch(() => null)) || currentToken;

    // Safety guard: Never overwrite an existing Google Drive backup with an empty array
    // unless forceOverwrite is explicitly true (e.g. user clicked "Clear All Data" in settings).
    if (!forceOverwrite && (!trades || trades.length === 0) && existing) {
      console.warn('[SyncEngine] Guard: Refusing to overwrite existing Google Drive backup with empty trades list without forceOverwrite');
      setSyncingState(false);
      return { success: true, mode: 'guarded_empty_skipped' };
    }

    // Read sync cursor — tells us what we last synced
    const cursor   = await idbGet(STORES.SYNC_CURSORS, portfolioId);
    const lastETag = cursor?.lastDriveETag || null;

    let finalTrades = trades;
    let merged      = false;

    // ── Conflict check: did another device update Drive since our last sync? ──
    // Only merge if not forcing overwrite AND local has trades (never resurrect onto empty slate)
    if (!forceOverwrite && trades && trades.length > 0 && existing && lastETag && existing.modifiedTime !== lastETag) {
      console.log('[SyncEngine] Remote changed since last sync — merging...');
      const remoteTrades = await loadFromDrive(portfolioId, validToken);
      if (remoteTrades.length > 0) {
        finalTrades = mergeTradeArrays(trades, remoteTrades);
        merged      = true;
        console.log(`[SyncEngine] Merged: local=${trades.length} remote=${remoteTrades.length} result=${finalTrades.length}`);

        // ── Write merged result back to IDB + notify UI immediately ───────────
        // This is the fix for Critical Bug 3: without this, the UI only sees
        // the remote changes on the next manual reload.
        try {
          const { bulkPutTrades } = await import('./tradeStore.js');
          await bulkPutTrades(portfolioId, finalTrades, true /* skipQueue — already synced */);
          // Fire merge listeners — dbService.js picks this up and notifies React subscribers
          _notifyMerge(finalTrades.filter(t => !t.deletedAt), portfolioId);
        } catch (mergeWriteErr) {
          console.warn('[SyncEngine] Merge write-back to IDB failed:', mergeWriteErr.message);
        }
      }
    }

    // ── Upload ────────────────────────────────────────────────────────────────
    const compressed = await buildDrivePayload(portfolioId, finalTrades, deviceId);
    const blob       = new Blob([compressed], { type: 'application/gzip' });
    const metadata   = { name: fileName, ...(existing ? {} : { parents: [folderId] }) };
    const form       = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const uploadUrl = existing
      ? `${DRIVE_UPLOAD_API}/${existing.id}?uploadType=multipart&fields=id,modifiedTime`
      : `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,modifiedTime`;
    const method = existing ? 'PATCH' : 'POST';

    const uploadResp = await driveFetch(uploadUrl, {
      method,
      body: form,
    }, currentToken);

    if (!uploadResp.ok) {
      const errorMsg = await parseDriveResponseError(uploadResp, 'Drive upload');
      throw new Error(errorMsg);
    }

    const uploadedFile = await uploadResp.json();

    // ── Update sync cursor ────────────────────────────────────────────────────
    await idbPut(STORES.SYNC_CURSORS, {
      portfolioId,
      lastSyncedAt:    Date.now(),
      lastDriveETag:   uploadedFile.modifiedTime || new Date().toISOString(),
      lastDriveFileId: uploadedFile.id || existing?.id,
    });

    // Clean up done operations from queue
    await clearDoneOps().catch(() => {});

    // Sync pending chart images to Drive charts folder
    syncPendingImages(validToken, portfolioId).catch((err) => {
      console.warn('[SyncEngine] Background image sync notice:', err.message);
    });

    console.log(`[SyncEngine] ✓ Synced ${finalTrades.filter(t => !t.deletedAt).length} trades, notes & charts to Drive`);
    setSyncError(null);
    return { success: true, merged, tradeCount: finalTrades.filter(t => !t.deletedAt).length };

  } catch (err) {
    console.error('[SyncEngine] Save to Drive failed:', err.message);
    setSyncError(err.message);
    return { success: false, merged: false, tradeCount: 0, error: err.message };
  } finally {
    setSyncingState(false);
  }
}

/**
 * Download and parse backup from Google Drive.
 * Returns empty array on any error (fail-safe, never throws).
 *
 * @param {string} portfolioId
 * @param {string} accessToken
 * @returns {Promise<object[]>} trade array
 */
export async function loadFromDrive(portfolioId, accessToken) {
  const validToken = (await getValidAccessToken().catch(() => null)) || accessToken;
  if (!validToken || validToken === 'demo-token') return [];

  try {
    const fileName = `foxtrade-journal-${portfolioId}.json.gz`;
    const existing = await findBackupFile(validToken, fileName);

    // Determine which Drive file to download: current name or legacy name
    let fileToDownload = existing;
    if (!fileToDownload) {
      // Try legacy filename from old driveService.js
      const legacy = await findBackupFile(validToken, `foxtrade-journal-backup-${portfolioId}.json.gz`);
      if (!legacy) return [];
      fileToDownload = legacy;
    }

    const resp = await driveFetch(`${DRIVE_API}/${fileToDownload.id}?alt=media`, {}, validToken);
    if (!resp.ok) return [];

    const buffer  = await resp.arrayBuffer();
    const payload = await parseDrivePayload(buffer);
    if (!payload) return [];

    // Restore calendar and independent notes if present in Drive backup
    // Persists to both IDB and localStorage, and notifies active UI subscribers
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

    // Restore Foxy AI chats with smart merge
    if (Array.isArray(payload.foxyChats) && payload.foxyChats.length > 0) {
      try {
        const localChats = await getConfig('foxy_ai_chats', []);
        const mergedChats = mergeFoxyChats(localChats, payload.foxyChats);
        await setConfig('foxy_ai_chats', mergedChats);
      } catch (e) {
        console.warn('[SyncEngine] Restore foxyChats failed:', e);
      }
    }

    // Restore Foxy trader commitments with deduplication
    if (Array.isArray(payload.foxyCommitments) && payload.foxyCommitments.length > 0) {
      try {
        const localComms = await getConfig('foxy_trader_commitments', []);
        const mergedComms = mergeFoxyCommitments(localComms, payload.foxyCommitments);
        await setConfig('foxy_trader_commitments', mergedComms);
      } catch (e) {
        console.warn('[SyncEngine] Restore foxyCommitments failed:', e);
      }
    }

    // Restore Foxy API key and config if present
    if (payload.foxyConfig && typeof payload.foxyConfig === 'object') {
      try {
        const localKey = await getConfig('foxy_ai_api_key', '');
        // Restore key if remote has one and local is empty
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

    // Restore journal settings if present in Drive backup
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

    // Restore fund management & base capital if present in Drive backup
    if (payload.fundManagement && typeof payload.fundManagement === 'object') {
      try {
        await setConfig(`fund_management_${portfolioId}`, payload.fundManagement).catch(() => {});
        Object.entries(payload.fundManagement).forEach(([key, val]) => {
          if (key && val) {
            localStorage.setItem(key, JSON.stringify(val));
          }
        });
        if (payload.baseCapital && Number(payload.baseCapital) > 0) {
          localStorage.setItem('tradeontip_base_capital', String(payload.baseCapital));
          await setConfig(`base_capital_${portfolioId}`, Number(payload.baseCapital)).catch(() => {});
        }
        window.dispatchEvent(new CustomEvent('tradeontip_capital_updated', {
          detail: { portfolioId, year: '2026', data: payload.fundManagement[`tradeontip_monthly_capital_${portfolioId}_2026`] || {} }
        }));
      } catch (e) {
        console.warn('[SyncEngine] Restore fund management failed:', e);
      }
    }

    // Restore monthly performance if present in Drive backup
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

    // Restore tax analytics if present in Drive backup
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

    // Restore app settings & column layout if present in Drive backup
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
    console.warn('[SyncEngine] Load from Drive failed:', err.message);
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
    lastSyncedAt:    cursor?.lastSyncedAt    || null,
    lastDriveFileId: cursor?.lastDriveFileId || null,
  };
}

// ── Auto-sync (debounced) ─────────────────────────────────────────────────────

/**
 * Trigger a debounced Drive sync.
 * Waits 15 seconds after the last call before syncing.
 * On page hide / visibility change → flushes immediately.
 *
 * @param {string} portfolioId
 * @param {string} accessToken
 * @param {object[]} trades  — ALL trades (including soft-deleted) for merge
 */
export function triggerAutoSync(portfolioId, accessToken, trades) {
  if (!accessToken || !portfolioId) return;
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
  if (!accessToken || !portfolioId) return;
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
      const token = await getToken();
      if (!token) return;
      await flushSync(getPortfolioId(), token, getTrades());
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
 * List all available backup files from Google Drive.
 * @param {string} accessToken
 * @returns {Promise<Array<{id: string, name: string, size: number, modifiedTime: string, portfolioId: string}>>}
 */
export async function listDriveBackups(accessToken) {
  if (!accessToken || accessToken === 'demo-token') return [];

  try {
    const q = encodeURIComponent("mimeType != 'application/vnd.google-apps.folder' and (name contains 'foxtrade' or name contains 'tradeontip') and trashed = false");
    const resp = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,name,size,modifiedTime,createdTime,appProperties)&orderBy=modifiedTime desc&pageSize=20`, {}, accessToken);

    if (!resp.ok) return [];
    const { files } = await resp.json();
    if (!Array.isArray(files)) return [];

    return files.map(f => {
      // Extract portfolioId from filename foxtrade-journal-{portfolioId}.json.gz
      const match = f.name.match(/foxtrade-journal-([a-zA-Z0-9_-]+)\./);
      const portfolioId = match ? match[1] : (f.appProperties?.foxtradePHash || 'default');
      return {
        id: f.id,
        name: f.name,
        size: parseInt(f.size || '0', 10),
        modifiedTime: f.modifiedTime,
        createdTime: f.createdTime,
        portfolioId,
      };
    });
  } catch (err) {
    console.warn('[SyncEngine] listDriveBackups error:', err.message);
    return [];
  }
}

/**
 * Download a specific backup file by its Drive fileId.
 * @param {string} fileId
 * @param {string} accessToken
 * @returns {Promise<object|null>} parsed backup object { trades, metadata, exportedAt, version }
 */
export async function downloadBackupFileById(fileId, accessToken) {
  if (!fileId || !accessToken) return null;

  try {
    const resp = await driveFetch(`${DRIVE_API}/${fileId}?alt=media&acknowledgeAbuse=true`, {}, accessToken);
    if (!resp.ok) return null;

    const buffer = await resp.arrayBuffer();
    return parseDrivePayload(buffer);
  } catch (err) {
    console.error('[SyncEngine] downloadBackupFileById error:', err.message);
    return null;
  }
}

/**
 * Delete a backup file by fileId from Google Drive.
 * @param {string} fileId
 * @param {string} accessToken
 * @returns {Promise<boolean>}
 */
export async function deleteBackupFileById(fileId, accessToken) {
  if (!fileId || !accessToken) return false;

  try {
    const resp = await driveFetch(`${DRIVE_API}/${fileId}`, {
      method: 'DELETE',
    }, accessToken);
    return resp.ok;
  } catch (err) {
    console.error('[SyncEngine] deleteBackupFileById error:', err.message);
    return false;
  }
}

/**
 * Delete all FoxTrade backup files from Google Drive.
 * Used on "Clear All Data" so remote backups don't resurrect deleted trades.
 *
 * @param {string} accessToken
 * @returns {Promise<boolean>}
 */
export async function clearAllDriveBackups(accessToken) {
  if (!accessToken || accessToken === 'demo-token') return false;
  try {
    const files = await listDriveBackups(accessToken);
    if (files.length > 0) {
      await Promise.all(files.map(f => deleteBackupFileById(f.id, accessToken)));
    }
    return true;
  } catch (err) {
    console.warn('[SyncEngine] clearAllDriveBackups error:', err);
    return false;
  }
}

