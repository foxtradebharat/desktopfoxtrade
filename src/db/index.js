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
export {
  getDB,
  resetDB,
  STORES,
  idbGet,
  idbPut,
  idbDelete,
  idbClearStore,
  purgeExpiredOhlcCache,
  idbCountByCompoundIndex,
} from './foxtradeDB.js';

// ── Trade Store ───────────────────────────────────────────────────────────────
export {
  putTrade,
  getTrades,
  getTradesWithDeleted,
  getAllTrades,
  getTradeCount,
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
  clearOpsForPortfolio,
  getPendingCount,
  requeueFailedOps,
  getQueueStats,
} from './operationsQueue.js';

// ── Sync Engine ───────────────────────────────────────────────────────────────
export {
  mergeTradeArrays,
  mergeFoxyChats,
  mergeFoxyCommitments,
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
  subscribeToMergedTrades,
  setSyncError,
  getLastSyncError,
  listDriveBackups,
  downloadBackupFileById,
  deleteBackupFileById,
  deleteBackupForPortfolio,
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
  subscribeToTokenExpired,
  subscribeToTokenUpdate,
  ensureGsiLoaded,
  withAutoRefresh,
  initTokenKeepalive,
  getTokenStatus,
  hasStoredRefreshToken,
  getDriveStatus,
  setDriveStatus,
  subscribeToDriveStatus,
  handleInvalidGrant,
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

// ── Note Store ────────────────────────────────────────────────────────────────
export {
  getCalendarNotes,
  getCalendarNotesSync,
  saveCalendarNotes,
  saveDayNote,
  deleteDayNote,
  getIndependentNotes,
  getIndependentNotesSync,
  saveIndependentNotes,
  putIndependentNote,
  deleteIndependentNote,
  subscribeToCalendarNotes,
  subscribeToIndependentNotes,
  initNoteStore,
} from './noteStore.js';

// ── Foxy AI Store ─────────────────────────────────────────────────────────────
export {
  getFoxyChatHistory,
  saveFoxyChatHistory,
  deleteFoxyChat,
  getTraderCommitments,
  saveTraderCommitments,
  addTraderCommitment,
} from './foxyStore.js';
