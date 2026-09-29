/**
 * index.js — FoxTrade Database Public API
 * ─────────────────────────────────────────────────────────────────────────────
 * Single entry point for the entire database layer.
 * Import from here — never import individual db files directly in components.
 *
 * Usage:
 *   import { putTrade, getTrades, triggerAutoSync } from '../db';
 */

// ── Core DB ───────────────────────────────────────────────────────────────────
export { getDB, resetDB, STORES, idbClearStore } from './foxtradeDB.js';

// ── Trade Store ───────────────────────────────────────────────────────────────
export {
  putTrade,
  getTrades,
  getTradesWithDeleted,
  getTradeById,
  deleteTrade,
  bulkPutTrades,
  clearTrades,
  migrateFromV1,
  resequenceTradeNumbers,
} from './tradeStore.js';

// ── Config Store ──────────────────────────────────────────────────────────────
export {
  getConfig,
  setConfig,
  deleteConfig,
  getDeviceId,
  getActivePortfolioId,
  setActivePortfolioId,
  getPortfolios,
  setPortfolios,
  getMonthlyPerf,
  setMonthlyPerf,
  getBaseCapital,
  setBaseCapital,
} from './configStore.js';

// ── Operations Queue ──────────────────────────────────────────────────────────
export {
  enqueue,
  getPendingOps,
  markOpDone,
  markOpFailed,
  clearDoneOps,
  getPendingCount,
  requeueFailedOps,
  getQueueStats,
} from './operationsQueue.js';

// ── Sync Engine ───────────────────────────────────────────────────────────────
export {
  mergeTradeArrays,
  buildDrivePayload,
  parseDrivePayload,
  saveToDrive,
  loadFromDrive,
  triggerAutoSync,
  flushSync,
  getSyncStatus,
  initPageHideFlush,
  subscribeToSyncStatus,
  subscribeToSyncError,
  setSyncError,
  getLastSyncError,
  listDriveBackups,
  downloadBackupFileById,
  deleteBackupFileById,
  clearAllDriveBackups,
} from './syncEngine.js';

// ── Token Manager ─────────────────────────────────────────────────────────────
export {
  storeTokens,
  getValidAccessToken,
  refreshAccessToken,
  clearTokens,
  isAuthenticated,
  getStoredEmail,
  exchangeAuthCode,
  storeDirectToken,
} from './tokenManager.js';

// ── Image Store ───────────────────────────────────────────────────────────────
export {
  saveImage,
  getImagesForTrade,
  getImageUrl,
  deleteImage,
  getUnsyncedImages,
  syncPendingImages,
  getImageCountMap,
} from './imageStore.js';
