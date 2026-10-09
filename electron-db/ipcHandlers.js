/**
 * electron-db/ipcHandlers.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Registers all Electron IPC handlers (ipcMain.handle) bridging the React UI
 * to the SQLite repositories.
 */

import { ipcMain } from 'electron';
import * as tradeRepo from './repositories/tradeRepository.js';
import * as playbookRepo from './repositories/playbookRepository.js';
import * as fundRepo from './repositories/fundRepository.js';
import * as taxRepo from './repositories/taxRepository.js';
import * as noteRepo from './repositories/noteRepository.js';
import * as screenshotRepo from './repositories/screenshotRepository.js';
import * as settingsRepo from './repositories/settingsRepository.js';

export function registerIpcHandlers() {
  // ── Trades & Executions ────────────────────────────────────────────────────
  ipcMain.handle('db:trades:get', async (_event, { portfolioId, filters } = {}) => {
    try {
      return tradeRepo.getTrades(portfolioId, filters);
    } catch (err) {
      console.error('[IPC db:trades:get Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:trades:getById', async (_event, tradeId) => {
    try {
      return tradeRepo.getTradeById(tradeId);
    } catch (err) {
      console.error('[IPC db:trades:getById Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:trades:save', async (_event, { portfolioId, trade, executions }) => {
    try {
      return tradeRepo.saveTrade(portfolioId, trade, executions);
    } catch (err) {
      console.error('[IPC db:trades:save Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:trades:delete', async (_event, tradeId) => {
    try {
      return tradeRepo.deleteTrade(tradeId);
    } catch (err) {
      console.error('[IPC db:trades:delete Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:trades:resequence', async (_event, portfolioId) => {
    try {
      return tradeRepo.resequenceTradeNumbers(portfolioId);
    } catch (err) {
      console.error('[IPC db:trades:resequence Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:metrics:getDashboard', async (_event, portfolioId) => {
    try {
      return tradeRepo.getDashboardMetrics(portfolioId);
    } catch (err) {
      console.error('[IPC db:metrics:getDashboard Error]', err);
      throw err;
    }
  });

  // ── Portfolios & Funds ─────────────────────────────────────────────────────
  ipcMain.handle('db:portfolios:getAll', async () => {
    try {
      return fundRepo.getPortfolios();
    } catch (err) {
      console.error('[IPC db:portfolios:getAll Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:portfolios:save', async (_event, portfolio) => {
    try {
      return fundRepo.savePortfolio(portfolio);
    } catch (err) {
      console.error('[IPC db:portfolios:save Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:portfolios:delete', async (_event, portfolioId) => {
    try {
      return fundRepo.deletePortfolio(portfolioId);
    } catch (err) {
      console.error('[IPC db:portfolios:delete Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:portfolios:getBaseCapital', async (_event, portfolioId) => {
    try {
      return fundRepo.getBaseCapital(portfolioId);
    } catch (err) {
      console.error('[IPC db:portfolios:getBaseCapital Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:portfolios:setBaseCapital', async (_event, { portfolioId, amount }) => {
    try {
      return fundRepo.setBaseCapital(portfolioId, amount);
    } catch (err) {
      console.error('[IPC db:portfolios:setBaseCapital Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:funds:get', async (_event, { portfolioId, year } = {}) => {
    try {
      return fundRepo.getFundTransactions(portfolioId, year);
    } catch (err) {
      console.error('[IPC db:funds:get Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:funds:save', async (_event, tx) => {
    try {
      return fundRepo.saveFundTransaction(tx);
    } catch (err) {
      console.error('[IPC db:funds:save Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:funds:delete', async (_event, txId) => {
    try {
      return fundRepo.deleteFundTransaction(txId);
    } catch (err) {
      console.error('[IPC db:funds:delete Error]', err);
      throw err;
    }
  });

  // ── Playbook Setups & Audits ───────────────────────────────────────────────
  ipcMain.handle('db:playbook:getAll', async (_event, portfolioId) => {
    try {
      return playbookRepo.getPlaybooks(portfolioId);
    } catch (err) {
      console.error('[IPC db:playbook:getAll Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:playbook:save', async (_event, { portfolioId, playbook }) => {
    try {
      return playbookRepo.savePlaybook(portfolioId, playbook);
    } catch (err) {
      console.error('[IPC db:playbook:save Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:playbook:delete', async (_event, playbookId) => {
    try {
      return playbookRepo.deletePlaybook(playbookId);
    } catch (err) {
      console.error('[IPC db:playbook:delete Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:playbook:saveAudit', async (_event, { tradeId, auditData }) => {
    try {
      return playbookRepo.saveTradeAudit(tradeId, auditData);
    } catch (err) {
      console.error('[IPC db:playbook:saveAudit Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:playbook:getAudit', async (_event, tradeId) => {
    try {
      return playbookRepo.getTradeAudit(tradeId);
    } catch (err) {
      console.error('[IPC db:playbook:getAudit Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:playbook:getAllAudits', async () => {
    try {
      return playbookRepo.getAllTradeAudits();
    } catch (err) {
      console.error('[IPC db:playbook:getAllAudits Error]', err);
      throw err;
    }
  });

  // ── Monthly Tax Ledger ─────────────────────────────────────────────────────
  ipcMain.handle('db:tax:getYear', async (_event, { portfolioId, year } = {}) => {
    try {
      return taxRepo.getMonthlyTaxRecords(portfolioId, year);
    } catch (err) {
      console.error('[IPC db:tax:getYear Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:tax:saveMonth', async (_event, { portfolioId, year, monthIndex, data }) => {
    try {
      return taxRepo.saveMonthlyTaxRecord(portfolioId, year, monthIndex, data);
    } catch (err) {
      console.error('[IPC db:tax:saveMonth Error]', err);
      throw err;
    }
  });

  // ── Notes (Calendar & Independent) ─────────────────────────────────────────
  ipcMain.handle('db:notes:getCalendar', async (_event, portfolioId) => {
    try {
      return noteRepo.getCalendarNotes(portfolioId);
    } catch (err) {
      console.error('[IPC db:notes:getCalendar Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:notes:saveDay', async (_event, { portfolioId, dateStr, noteData }) => {
    try {
      return noteRepo.saveDayNote(portfolioId, dateStr, noteData);
    } catch (err) {
      console.error('[IPC db:notes:saveDay Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:notes:deleteDay', async (_event, { portfolioId, dateStr }) => {
    try {
      return noteRepo.deleteDayNote(portfolioId, dateStr);
    } catch (err) {
      console.error('[IPC db:notes:deleteDay Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:notes:getIndependent', async (_event, portfolioId) => {
    try {
      return noteRepo.getIndependentNotes(portfolioId);
    } catch (err) {
      console.error('[IPC db:notes:getIndependent Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:notes:saveIndependent', async (_event, { portfolioId, note }) => {
    try {
      return noteRepo.saveIndependentNote(portfolioId, note);
    } catch (err) {
      console.error('[IPC db:notes:saveIndependent Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:notes:deleteIndependent', async (_event, { portfolioId, noteId }) => {
    try {
      return noteRepo.deleteIndependentNote(portfolioId, noteId);
    } catch (err) {
      console.error('[IPC db:notes:deleteIndependent Error]', err);
      throw err;
    }
  });

  // ── Screenshots ────────────────────────────────────────────────────────────
  ipcMain.handle('db:screenshots:save', async (_event, { tradeId, imageType, bufferOrBase64, customFilename }) => {
    try {
      return screenshotRepo.saveScreenshot(tradeId, imageType, bufferOrBase64, customFilename);
    } catch (err) {
      console.error('[IPC db:screenshots:save Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:screenshots:getByTrade', async (_event, tradeId) => {
    try {
      return screenshotRepo.getScreenshotsForTrade(tradeId);
    } catch (err) {
      console.error('[IPC db:screenshots:getByTrade Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:screenshots:delete', async (_event, screenshotId) => {
    try {
      return screenshotRepo.deleteScreenshot(screenshotId);
    } catch (err) {
      console.error('[IPC db:screenshots:delete Error]', err);
      throw err;
    }
  });

  // ── Settings ───────────────────────────────────────────────────────────────
  ipcMain.handle('db:settings:get', async (_event, { key, defaultValue }) => {
    try {
      return settingsRepo.getSetting(key, defaultValue);
    } catch (err) {
      console.error('[IPC db:settings:get Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:settings:set', async (_event, { key, value }) => {
    try {
      return settingsRepo.setSetting(key, value);
    } catch (err) {
      console.error('[IPC db:settings:set Error]', err);
      throw err;
    }
  });

  ipcMain.handle('db:settings:delete', async (_event, key) => {
    try {
      return settingsRepo.deleteSetting(key);
    } catch (err) {
      console.error('[IPC db:settings:delete Error]', err);
      throw err;
    }
  });

  console.log('[SQLite Engine] All SQLite IPC handlers registered successfully.');
}
