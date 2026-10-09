/**
 * noteStore.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Structured Notes Storage Engine for FoxTrade.
 *
 * Manages:
 *   1. Calendar Daily Notes (dated journal entries, daily mood, scoped notes)
 *   2. Independent Notes (tasks, resources, goals, playbook scratchpad)
 *
 * Architecture:
 *   - Primary Store: IndexedDB `foxtrade_v2` -> `app_config` store
 *     Keys: 'notes_v2', 'independent_notes_v2'
 *   - Fast Zero-Latency Cache: Synchronous localStorage mirror for instant UI mounting
 *   - Real-Time Drive Sync: Automatically triggers Google Drive auto-sync on every edit
 *   - Privacy-First: All notes stay in user's IndexedDB and private Google Drive.
 *     Zero data leakage to external databases.
 */

import { getConfig, setConfig } from './configStore.js';
import { getValidAccessToken } from './tokenManager.js';
import { getActivePortfolioId } from './configStore.js';
import { getTradesWithDeleted } from './tradeStore.js';
import { triggerAutoSync } from './syncEngine.js';

// ── Storage Keys ──────────────────────────────────────────────────────────────
export const KEY_CALENDAR_NOTES = 'notes_v2';
export const KEY_INDEPENDENT_NOTES = 'independent_notes_v2';

export const LS_CALENDAR_NOTES = 'foxtrade_notes_v2';
export const LS_INDEPENDENT_NOTES = 'foxtrade_independent_notes_v2';

// ── In-Memory Listeners for Real-Time Cross-Component Updates ──────────────────
const _calendarListeners = new Set();
const _independentListeners = new Set();

export function subscribeToCalendarNotes(callback) {
  _calendarListeners.add(callback);
  return () => _calendarListeners.delete(callback);
}

export function subscribeToIndependentNotes(callback) {
  _independentListeners.add(callback);
  return () => _independentListeners.delete(callback);
}

function _notifyCalendar(notes) {
  _calendarListeners.forEach(cb => { try { cb(notes); } catch (_) {} });
}

function _notifyIndependent(notes) {
  _independentListeners.forEach(cb => { try { cb(notes); } catch (_) {} });
}

// ── Automatic Background Drive Sync Dispatcher ────────────────────────────────
let _syncDebounceTimer = null;
function scheduleDriveSync() {
  if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
  _syncDebounceTimer = setTimeout(async () => {
    try {
      const portfolioId = await getActivePortfolioId().catch(() => 'default');
      const trades = await getTradesWithDeleted(portfolioId).catch(() => []);
      triggerAutoSync(portfolioId, null, trades);
    } catch (err) {
      console.warn('[NoteStore] Background sync trigger notice:', err.message);
    }
  }, 1000); // 1-second debounce after typing
}

// ── Schemas & Sanitizers ──────────────────────────────────────────────────────

/**
 * Validates and normalizes a single independent note.
 * @param {object} raw
 * @returns {object} sanitized note
 */
export function sanitizeIndependentNote(raw = {}) {
  const now = new Date().toISOString();
  return {
    id: String(raw.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
    title: String(raw.title || '').trim(),
    content: String(raw.content || ''),
    category: ['notes', 'tasks', 'resources', 'goals'].includes(raw.category) ? raw.category : 'notes',
    tags: Array.isArray(raw.tags) ? raw.tags.map(t => String(t).trim()).filter(Boolean) : [],
    color: raw.color ? String(raw.color) : undefined,
    isPinned: Boolean(raw.isPinned),
    priority: ['low', 'medium', 'high'].includes(raw.priority) ? raw.priority : 'medium',
    progress: typeof raw.progress === 'number' ? Math.max(0, Math.min(100, raw.progress)) : 0,
    status: ['todo', 'in_progress', 'done'].includes(raw.status) ? raw.status : 'todo',
    createdAt: raw.createdAt || now,
    updatedAt: now,
  };
}

/**
 * Validates and normalizes calendar day note.
 * @param {object} raw
 * @returns {object} sanitized day note
 */
export function sanitizeDayNote(raw = {}) {
  const now = new Date().toISOString();
  const base = {
    createdAt: raw.createdAt || now,
    updatedAt: now,
  };

  if (raw.title !== undefined) base.title = String(raw.title);
  if (raw.content !== undefined) base.content = String(raw.content);
  if (raw.mood !== undefined) base.mood = String(raw.mood);
  if (Array.isArray(raw.tags)) base.tags = raw.tags.map(t => String(t).trim()).filter(Boolean);

  if (raw.scopedNotes && typeof raw.scopedNotes === 'object') {
    base.scopedNotes = {};
    for (const [scopeKey, scopeVal] of Object.entries(raw.scopedNotes)) {
      if (scopeVal && typeof scopeVal === 'object') {
        base.scopedNotes[scopeKey] = {
          title: String(scopeVal.title || ''),
          content: String(scopeVal.content || ''),
          tags: Array.isArray(scopeVal.tags) ? scopeVal.tags.map(t => String(t).trim()).filter(Boolean) : [],
          mood: String(scopeVal.mood || 'neutral'),
          scope: String(scopeVal.scope || scopeKey),
        };
      }
    }
  }

  return base;
}

// ── Calendar Notes API ────────────────────────────────────────────────────────

/**
 * Get all calendar notes.
 * Synchronous local cache first for zero UI flicker, followed by async IDB read.
 * @returns {Promise<object>} map of dateStr -> DayNote
 */
export async function getCalendarNotes() {
  // 1. Try reading from IndexedDB
  const idbNotes = await getConfig(KEY_CALENDAR_NOTES, null);
  if (idbNotes && typeof idbNotes === 'object') {
    // Keep local cache synced
    try { localStorage.setItem(LS_CALENDAR_NOTES, JSON.stringify(idbNotes)); } catch {}
    return idbNotes;
  }

  // 2. Migration fallback: read from localStorage and migrate to IDB
  try {
    const raw = localStorage.getItem(LS_CALENDAR_NOTES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        await setConfig(KEY_CALENDAR_NOTES, parsed);
        return parsed;
      }
    }
  } catch {}

  return {};
}

/**
 * Synchronous read from local cache for instant component mount.
 * @returns {object}
 */
export function getCalendarNotesSync() {
  try {
    const raw = localStorage.getItem(LS_CALENDAR_NOTES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Save full calendar notes map.
 * Persists to both localStorage (sync) and IndexedDB (async), then triggers Drive sync.
 * @param {object} notesMap
 * @returns {Promise<void>}
 */
export async function saveCalendarNotes(notesMap) {
  const safeNotes = (notesMap && typeof notesMap === 'object') ? notesMap : {};

  // 1. Instant synchronous write to localStorage for zero UI latency
  try {
    localStorage.setItem(LS_CALENDAR_NOTES, JSON.stringify(safeNotes));
  } catch (e) {
    console.warn('[NoteStore] LocalStorage quota warning for notes:', e);
  }

  // 2. Notify in-app subscribers
  _notifyCalendar(safeNotes);

  // 3. Persistent asynchronous write to IndexedDB
  await setConfig(KEY_CALENDAR_NOTES, safeNotes);

  // 3b. Sync to local SQLite in Electron
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron && window.electronAPI?.db) {
    try {
      Object.entries(safeNotes).forEach(([dateStr, noteData]) => {
        window.electronAPI.db.saveDayNote('default', dateStr, noteData).catch(() => {});
      });
    } catch (_) {}
  }

  // 4. Trigger debounced Drive auto-sync
  scheduleDriveSync();
}

/**
 * Save or update note for a specific date (e.g. '2026-10-02').
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {object} noteData
 * @returns {Promise<object>} updated full notes map
 */
export async function saveDayNote(dateStr, noteData) {
  const allNotes = await getCalendarNotes();
  const existing = allNotes[dateStr] || {};
  const updatedDay = sanitizeDayNote({ ...existing, ...noteData });

  allNotes[dateStr] = updatedDay;
  await saveCalendarNotes(allNotes);
  return allNotes;
}

/**
 * Delete note for a specific date.
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {Promise<object>} updated full notes map
 */
export async function deleteDayNote(dateStr) {
  const allNotes = await getCalendarNotes();
  if (allNotes[dateStr]) {
    delete allNotes[dateStr];
    await saveCalendarNotes(allNotes);
  }
  return allNotes;
}

// ── Independent Notes API ─────────────────────────────────────────────────────

/**
 * Get all independent notes.
 * @returns {Promise<Array>} array of sanitized IndependentNote objects
 */
export async function getIndependentNotes() {
  // 1. Try reading from IndexedDB
  const idbNotes = await getConfig(KEY_INDEPENDENT_NOTES, null);
  if (Array.isArray(idbNotes)) {
    try { localStorage.setItem(LS_INDEPENDENT_NOTES, JSON.stringify(idbNotes)); } catch {}
    return idbNotes;
  }

  // 2. Migration fallback: read from localStorage and migrate to IDB
  try {
    const raw = localStorage.getItem(LS_INDEPENDENT_NOTES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        await setConfig(KEY_INDEPENDENT_NOTES, parsed);
        return parsed;
      }
    }
  } catch {}

  return [];
}

/**
 * Synchronous read of independent notes from local cache for instant mount.
 * @returns {Array}
 */
export function getIndependentNotesSync() {
  try {
    const raw = localStorage.getItem(LS_INDEPENDENT_NOTES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save full independent notes array.
 * Persists to both localStorage (sync) and IndexedDB (async), then triggers Drive sync.
 * @param {Array} notesList
 * @returns {Promise<void>}
 */
export async function saveIndependentNotes(notesList) {
  const safeList = Array.isArray(notesList) ? notesList.map(sanitizeIndependentNote) : [];

  // 1. Instant synchronous write to localStorage for zero UI latency
  try {
    localStorage.setItem(LS_INDEPENDENT_NOTES, JSON.stringify(safeList));
  } catch (e) {
    console.warn('[NoteStore] LocalStorage quota warning for independent notes:', e);
  }

  // 2. Notify in-app subscribers
  _notifyIndependent(safeList);

  // 3. Persistent asynchronous write to IndexedDB
  await setConfig(KEY_INDEPENDENT_NOTES, safeList);

  // 3b. Sync to local SQLite in Electron
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron && window.electronAPI?.db) {
    try {
      safeList.forEach(note => {
        window.electronAPI.db.saveIndependentNote('default', note).catch(() => {});
      });
    } catch (_) {}
  }

  // 4. Trigger debounced Drive auto-sync
  scheduleDriveSync();
}

/**
 * Add or update an independent note.
 * @param {object} note
 * @returns {Promise<Array>} updated notes list
 */
export async function putIndependentNote(note) {
  const sanitized = sanitizeIndependentNote(note);
  const current = await getIndependentNotes();
  const index = current.findIndex(n => n.id === sanitized.id);

  let updated;
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...current[index], ...sanitized, updatedAt: new Date().toISOString() };
  } else {
    updated = [sanitized, ...current];
  }

  await saveIndependentNotes(updated);
  return updated;
}

/**
 * Delete an independent note by ID.
 * @param {string} id
 * @returns {Promise<Array>} updated notes list
 */
export async function deleteIndependentNote(id) {
  const current = await getIndependentNotes();
  const updated = current.filter(n => n.id !== id);
  await saveIndependentNotes(updated);
  return updated;
}

// ── Startup Auto-Initializer & Migration ──────────────────────────────────────

/**
 * Call on application boot to verify and migrate any stranded localStorage notes to IndexedDB.
 */
export async function initNoteStore() {
  try {
    // 1. Reconcile Calendar Notes
    const idbCalendar = await getConfig(KEY_CALENDAR_NOTES, null);
    const lsCalendarRaw = localStorage.getItem(LS_CALENDAR_NOTES);
    if (!idbCalendar && lsCalendarRaw) {
      const parsed = JSON.parse(lsCalendarRaw);
      if (parsed && typeof parsed === 'object') {
        await setConfig(KEY_CALENDAR_NOTES, parsed);
        console.log('[NoteStore] Migrated calendar notes to IndexedDB ✓');
      }
    } else if (idbCalendar && !lsCalendarRaw) {
      localStorage.setItem(LS_CALENDAR_NOTES, JSON.stringify(idbCalendar));
    }

    // 2. Reconcile Independent Notes
    const idbInd = await getConfig(KEY_INDEPENDENT_NOTES, null);
    const lsIndRaw = localStorage.getItem(LS_INDEPENDENT_NOTES);
    if (!idbInd && lsIndRaw) {
      const parsed = JSON.parse(lsIndRaw);
      if (Array.isArray(parsed)) {
        await setConfig(KEY_INDEPENDENT_NOTES, parsed);
        console.log('[NoteStore] Migrated independent notes to IndexedDB ✓');
      }
    } else if (idbInd && !lsIndRaw) {
      localStorage.setItem(LS_INDEPENDENT_NOTES, JSON.stringify(idbInd));
    }
  } catch (err) {
    console.warn('[NoteStore] Init note store error:', err.message);
  }
}
