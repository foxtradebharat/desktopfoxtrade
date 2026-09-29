/**
 * operationsQueue.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Offline write queue — the crash-safety net.
 *
 * Every trade write is enqueued here BEFORE being synced to Drive.
 * If the browser crashes or the tab closes mid-save, the queue persists
 * in IndexedDB and is drained automatically on the next app open.
 *
 * This eliminates the #1 Nexus problem: trades entered just before closing
 * the tab being silently lost (their 60s debounce timer never fires).
 *
 * Operation lifecycle:
 *   enqueue() → status: 'pending'
 *   drain()   → markOpDone() → status: 'done'
 *   on error  → markOpFailed() → retries++
 *               if retries >= 3 → status: 'failed' (manual intervention needed)
 *               else stays 'pending' for next drain
 *   clearDoneOps() — called periodically to keep the queue lean
 */

import { getDB, STORES } from './foxtradeDB.js';

// ── Types (JSDoc only) ────────────────────────────────────────────────────────

/**
 * @typedef {Object} QueuedOperation
 * @property {number}  [qid]        — auto-increment primary key
 * @property {'INSERT'|'UPDATE'|'DELETE'} op — operation type
 * @property {'trade'|'note'|'image'} entity — entity type
 * @property {string}  entityId     — the trade/note/image ID
 * @property {string}  portfolioId  — portfolio scope
 * @property {object}  payload      — full entity for INSERT/UPDATE, {id} for DELETE
 * @property {'pending'|'done'|'failed'} status
 * @property {number}  retries      — number of failed attempts
 * @property {number}  createdAt    — Date.now()
 */

const MAX_RETRIES = 3;

// ── Internal helpers ──────────────────────────────────────────────────────────

function getAllByIndex(db, storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).index(indexName).getAll(value);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });
}

function putRecord(db, storeName, record) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readwrite').objectStore(storeName).put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Add a new operation to the queue.
 * Called by tradeStore after every write.
 *
 * @param {Omit<QueuedOperation, 'qid'|'status'|'retries'|'createdAt'>} op
 * @returns {Promise<number>} the auto-generated qid
 */
export async function enqueue(op) {
  const db = await getDB();
  const record = {
    ...op,
    status:    'pending',
    retries:   0,
    createdAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORES.OPERATIONS_QUEUE, 'readwrite')
                  .objectStore(STORES.OPERATIONS_QUEUE)
                  .add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Get all pending operations, optionally filtered by portfolioId.
 * Returns in insertion order (lowest qid first — FIFO).
 *
 * @param {string} [portfolioId]
 * @returns {Promise<QueuedOperation[]>}
 */
export async function getPendingOps(portfolioId) {
  const db  = await getDB();
  let   ops = await getAllByIndex(db, STORES.OPERATIONS_QUEUE, 'status', 'pending');

  if (portfolioId) {
    ops = ops.filter(op => op.portfolioId === portfolioId);
  }

  // Sort ascending by qid (insertion order)
  ops.sort((a, b) => a.qid - b.qid);
  return ops;
}

/**
 * Mark a queued operation as successfully completed.
 * @param {number} qid
 * @returns {Promise<void>}
 */
export async function markOpDone(qid) {
  const db  = await getDB();
  const tx  = db.transaction(STORES.OPERATIONS_QUEUE, 'readwrite');
  const st  = tx.objectStore(STORES.OPERATIONS_QUEUE);

  return new Promise((resolve, reject) => {
    const getReq = st.get(qid);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) { resolve(); return; }
      const putReq = st.put({ ...record, status: 'done', completedAt: Date.now() });
      putReq.onsuccess = () => resolve();
      putReq.onerror   = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Mark a queued operation as failed.
 * If retries < MAX_RETRIES: keeps status 'pending' so it retries on next drain.
 * If retries >= MAX_RETRIES: marks as 'failed' permanently (needs manual action).
 *
 * @param {number} qid
 * @param {string} [reason] — error message for debugging
 * @returns {Promise<void>}
 */
export async function markOpFailed(qid, reason = '') {
  const db  = await getDB();
  const tx  = db.transaction(STORES.OPERATIONS_QUEUE, 'readwrite');
  const st  = tx.objectStore(STORES.OPERATIONS_QUEUE);

  return new Promise((resolve, reject) => {
    const getReq = st.get(qid);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) { resolve(); return; }

      const newRetries = (record.retries || 0) + 1;
      const newStatus  = newRetries >= MAX_RETRIES ? 'failed' : 'pending';

      const putReq = st.put({
        ...record,
        status:      newStatus,
        retries:     newRetries,
        lastError:   reason,
        lastFailedAt: Date.now(),
      });
      putReq.onsuccess = () => resolve();
      putReq.onerror   = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Delete all completed ('done') operations to keep the queue lean.
 * Call this periodically — e.g., after each successful Drive sync.
 *
 * @returns {Promise<number>} count of ops deleted
 */
export async function clearDoneOps() {
  const db   = await getDB();
  const done = await getAllByIndex(db, STORES.OPERATIONS_QUEUE, 'status', 'done');
  if (done.length === 0) return 0;

  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORES.OPERATIONS_QUEUE, 'readwrite');
    const st  = tx.objectStore(STORES.OPERATIONS_QUEUE);
    done.forEach(op => st.delete(op.qid));
    tx.oncomplete = () => resolve(done.length);
    tx.onerror    = () => reject(tx.error);
  });
}

/**
 * Count pending operations (used for UI badge — "X unsynced changes").
 * @param {string} [portfolioId]
 * @returns {Promise<number>}
 */
export async function getPendingCount(portfolioId) {
  const db  = await getDB();
  let   ops = await getAllByIndex(db, STORES.OPERATIONS_QUEUE, 'status', 'pending');
  if (portfolioId) ops = ops.filter(op => op.portfolioId === portfolioId);
  return ops.length;
}

/**
 * Reset permanently-failed ops back to 'pending' so they retry.
 * Call this after user manually reconnects Drive or resolves an error.
 *
 * @param {string} [portfolioId]
 * @returns {Promise<number>} count of ops requeued
 */
export async function requeueFailedOps(portfolioId) {
  const db     = await getDB();
  const failed = await getAllByIndex(db, STORES.OPERATIONS_QUEUE, 'status', 'failed');
  const toRequeue = portfolioId
    ? failed.filter(op => op.portfolioId === portfolioId)
    : failed;

  if (toRequeue.length === 0) return 0;

  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORES.OPERATIONS_QUEUE, 'readwrite');
    const st  = tx.objectStore(STORES.OPERATIONS_QUEUE);
    toRequeue.forEach(op => st.put({ ...op, status: 'pending', retries: 0 }));
    tx.oncomplete = () => resolve(toRequeue.length);
    tx.onerror    = () => reject(tx.error);
  });
}

/**
 * Get a summary of queue state (for debugging / status UI).
 * @returns {Promise<{pending: number, done: number, failed: number, total: number}>}
 */
export async function getQueueStats() {
  const db  = await getDB();
  const all = await new Promise((resolve, reject) => {
    const req = db.transaction(STORES.OPERATIONS_QUEUE, 'readonly')
                  .objectStore(STORES.OPERATIONS_QUEUE)
                  .getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });

  return {
    pending: all.filter(op => op.status === 'pending').length,
    done:    all.filter(op => op.status === 'done').length,
    failed:  all.filter(op => op.status === 'failed').length,
    total:   all.length,
  };
}
