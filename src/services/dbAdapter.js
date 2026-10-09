/**
 * src/services/dbAdapter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Isomorphic Database Adapter for FoxTrade.
 *
 * Automatically detects environment:
 * - Desktop (Electron): Routes calls to native SQLite via window.electronAPI.db IPC.
 * - Web Browser: Seamlessly falls back to IndexedDB (foxtrade_v2) and localStorage.
 *
 * Guaranteed zero disruption to the FoxTrade calculation engine:
 * Trades returned to React retain the exact object shapes and fields required.
 */

import {
  getTrades as idbGetTrades,
  bulkPutTrades as idbBulkPutTrades,
  deleteTrade as idbDeleteTrade,
  clearTrades as idbClearTrades,
} from '../db/index.js';

export function isElectron() {
  return Boolean(
    typeof window !== 'undefined' &&
    window.electronAPI &&
    window.electronAPI.isElectron &&
    window.electronAPI.db
  );
}

// ── Trades & Executions ──────────────────────────────────────────────────────

export async function getTrades(portfolioId = 'default', filters = {}) {
  if (isElectron()) {
    try {
      const trades = await window.electronAPI.db.getTrades(portfolioId, filters);
      return Array.isArray(trades) ? trades : [];
    } catch (err) {
      console.error('[dbAdapter:getTrades Electron Error]', err);
    }
  }

  // Web fallback: IndexedDB
  return idbGetTrades(portfolioId);
}

export async function getTradeById(tradeId) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.getTradeById(tradeId);
    } catch (err) {
      console.error('[dbAdapter:getTradeById Electron Error]', err);
    }
  }

  // Web fallback: search from IndexedDB
  const all = await idbGetTrades('default');
  return all.find(t => t.id === tradeId) || null;
}

export async function saveTrade(portfolioId = 'default', trade, executions = null) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.saveTrade(portfolioId, trade, executions);
    } catch (err) {
      console.error('[dbAdapter:saveTrade Electron Error]', err);
    }
  }

  // Web fallback
  await idbBulkPutTrades(portfolioId, [trade], false);
  return trade;
}

export async function saveTradesBatch(portfolioId = 'default', trades = []) {
  if (!Array.isArray(trades) || trades.length === 0) return [];

  if (isElectron()) {
    try {
      const results = [];
      for (const t of trades) {
        const saved = await window.electronAPI.db.saveTrade(portfolioId, t, t.executions || null);
        results.push(saved);
      }
      return results;
    } catch (err) {
      console.error('[dbAdapter:saveTradesBatch Electron Error]', err);
    }
  }

  // Web fallback
  await idbBulkPutTrades(portfolioId, trades, false);
  return trades;
}

export async function deleteTrade(portfolioId = 'default', tradeId) {
  if (isElectron()) {
    try {
      await window.electronAPI.db.deleteTrade(tradeId);
      return true;
    } catch (err) {
      console.error('[dbAdapter:deleteTrade Electron Error]', err);
    }
  }

  // Web fallback
  await idbDeleteTrade(portfolioId, tradeId);
  return true;
}

export async function resequenceTrades(portfolioId = 'default') {
  if (isElectron()) {
    try {
      await window.electronAPI.db.resequenceTradeNumbers(portfolioId);
      return true;
    } catch (err) {
      console.error('[dbAdapter:resequenceTrades Electron Error]', err);
    }
  }
  return true;
}

export async function getDashboardMetrics(portfolioId = 'default') {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.getDashboardMetrics(portfolioId);
    } catch (err) {
      console.error('[dbAdapter:getDashboardMetrics Electron Error]', err);
    }
  }
  return null;
}

// ── Portfolios & Funds ───────────────────────────────────────────────────────

export async function getPortfolios() {
  if (isElectron()) {
    try {
      const pfs = await window.electronAPI.db.getPortfolios();
      if (Array.isArray(pfs) && pfs.length > 0) return pfs;
    } catch (err) {
      console.error('[dbAdapter:getPortfolios Electron Error]', err);
    }
  }

  // Web fallback
  try {
    const raw = localStorage.getItem('tradeontip_portfolios_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}

  return [{
    id: 'default',
    name: 'My Portfolio',
    currency: 'INR',
    baseCapital: 100000,
    isDefault: true,
    createdAt: Date.now()
  }];
}

export async function savePortfolio(portfolio) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.savePortfolio(portfolio);
    } catch (err) {
      console.error('[dbAdapter:savePortfolio Electron Error]', err);
    }
  }

  // Web fallback
  try {
    const current = await getPortfolios();
    const idx = current.findIndex(p => p.id === portfolio.id);
    if (idx >= 0) current[idx] = { ...current[idx], ...portfolio };
    else current.push(portfolio);
    localStorage.setItem('tradeontip_portfolios_v1', JSON.stringify(current));
  } catch (_) {}
  return portfolio;
}

export async function deletePortfolio(portfolioId) {
  if (isElectron()) {
    try {
      await window.electronAPI.db.deletePortfolio(portfolioId);
      return true;
    } catch (err) {
      console.error('[dbAdapter:deletePortfolio Electron Error]', err);
    }
  }

  try {
    const current = await getPortfolios();
    const filtered = current.filter(p => p.id !== portfolioId);
    localStorage.setItem('tradeontip_portfolios_v1', JSON.stringify(filtered));
  } catch (_) {}
  return true;
}

export async function getBaseCapital(portfolioId = 'default') {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.getBaseCapital(portfolioId);
    } catch (err) {
      console.error('[dbAdapter:getBaseCapital Electron Error]', err);
    }
  }

  try {
    const saved = localStorage.getItem(`tradeontip_base_capital_${portfolioId}`) ||
                  localStorage.getItem('tradeontip_initial_capital') ||
                  localStorage.getItem('tradeontip_portfolio_capital');
    if (saved) return Number(saved) || 100000;
  } catch (_) {}
  return 100000;
}

export async function setBaseCapital(portfolioId = 'default', amount) {
  const num = Number(amount) || 100000;
  if (isElectron()) {
    try {
      await window.electronAPI.db.setBaseCapital(portfolioId, num);
    } catch (err) {
      console.error('[dbAdapter:setBaseCapital Electron Error]', err);
    }
  }

  try {
    localStorage.setItem(`tradeontip_base_capital_${portfolioId}`, String(num));
    localStorage.setItem('tradeontip_initial_capital', String(num));
  } catch (_) {}
  return num;
}

export async function getFundTransactions(portfolioId = 'default', year = null) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.getFundTransactions(portfolioId, year);
    } catch (err) {
      console.error('[dbAdapter:getFundTransactions Electron Error]', err);
    }
  }

  try {
    const raw = localStorage.getItem(`tradeontip_fund_txs_${portfolioId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export async function saveFundTransaction(tx) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.saveFundTransaction(tx);
    } catch (err) {
      console.error('[dbAdapter:saveFundTransaction Electron Error]', err);
    }
  }

  try {
    const pid = tx.portfolioId || 'default';
    const list = await getFundTransactions(pid);
    list.push(tx);
    localStorage.setItem(`tradeontip_fund_txs_${pid}`, JSON.stringify(list));
  } catch (_) {}
  return tx;
}

export async function deleteFundTransaction(txId) {
  if (isElectron()) {
    try {
      await window.electronAPI.db.deleteFundTransaction(txId);
      return true;
    } catch (err) {
      console.error('[dbAdapter:deleteFundTransaction Electron Error]', err);
    }
  }
  return true;
}

// ── Playbook Setups & Audits ─────────────────────────────────────────────────

export async function getPlaybooks(portfolioId = 'default') {
  if (isElectron()) {
    try {
      const pbs = await window.electronAPI.db.getPlaybooks(portfolioId);
      if (Array.isArray(pbs) && pbs.length > 0) return pbs;
    } catch (err) {
      console.error('[dbAdapter:getPlaybooks Electron Error]', err);
    }
  }

  try {
    const raw = localStorage.getItem('foxtrade_playbooks_v2');
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export async function savePlaybook(portfolioId = 'default', playbook) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.savePlaybook(portfolioId, playbook);
    } catch (err) {
      console.error('[dbAdapter:savePlaybook Electron Error]', err);
    }
  }

  // Web fallback: write to localStorage
  try {
    const pbs = await getPlaybooks(portfolioId);
    const idx = pbs.findIndex(p => p.id === playbook.id);
    if (idx >= 0) pbs[idx] = playbook;
    else pbs.push(playbook);
    localStorage.setItem('foxtrade_playbooks_v2', JSON.stringify(pbs));
  } catch (_) {}
  return playbook;
}

export async function deletePlaybook(playbookId) {
  if (isElectron()) {
    try {
      await window.electronAPI.db.deletePlaybook(playbookId);
      return true;
    } catch (err) {
      console.error('[dbAdapter:deletePlaybook Electron Error]', err);
    }
  }

  try {
    const pbs = await getPlaybooks();
    const filtered = pbs.filter(p => p.id !== playbookId);
    localStorage.setItem('foxtrade_playbooks_v2', JSON.stringify(filtered));
  } catch (_) {}
  return true;
}

export async function saveTradeAudit(tradeId, auditData) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.saveTradeAudit(tradeId, auditData);
    } catch (err) {
      console.error('[dbAdapter:saveTradeAudit Electron Error]', err);
    }
  }

  try {
    const raw = localStorage.getItem('foxtrade_trade_audits_v2');
    const audits = raw ? JSON.parse(raw) : {};
    audits[tradeId] = auditData;
    localStorage.setItem('foxtrade_trade_audits_v2', JSON.stringify(audits));
  } catch (_) {}
  return auditData;
}

export async function getTradeAudit(tradeId) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.getTradeAudit(tradeId);
    } catch (err) {
      console.error('[dbAdapter:getTradeAudit Electron Error]', err);
    }
  }

  try {
    const raw = localStorage.getItem('foxtrade_trade_audits_v2');
    const audits = raw ? JSON.parse(raw) : {};
    return audits[tradeId] || null;
  } catch (_) {
    return null;
  }
}

export async function getAllTradeAudits() {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.getAllTradeAudits();
    } catch (err) {
      console.error('[dbAdapter:getAllTradeAudits Electron Error]', err);
    }
  }

  try {
    const raw = localStorage.getItem('foxtrade_trade_audits_v2');
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

// ── Monthly Tax Ledger ───────────────────────────────────────────────────────

export async function getMonthlyTaxRecords(portfolioId = 'default', year = 2026) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.getMonthlyTaxRecords(portfolioId, year);
    } catch (err) {
      console.error('[dbAdapter:getMonthlyTaxRecords Electron Error]', err);
    }
  }

  try {
    const raw = localStorage.getItem(`foxtrade_tax_${portfolioId}_${year}`);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

export async function saveMonthlyTaxRecord(portfolioId = 'default', year = 2026, monthIndex = 0, data = {}) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.saveMonthlyTaxRecord(portfolioId, year, monthIndex, data);
    } catch (err) {
      console.error('[dbAdapter:saveMonthlyTaxRecord Electron Error]', err);
    }
  }

  try {
    const records = await getMonthlyTaxRecords(portfolioId, year);
    records[monthIndex] = data;
    localStorage.setItem(`foxtrade_tax_${portfolioId}_${year}`, JSON.stringify(records));
  } catch (_) {}
  return data;
}

// ── Notes (Calendar & Independent) ───────────────────────────────────────────

export async function getCalendarNotes(portfolioId = 'default') {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.getCalendarNotes(portfolioId);
    } catch (err) {
      console.error('[dbAdapter:getCalendarNotes Electron Error]', err);
    }
  }

  try {
    const raw = localStorage.getItem('tradeontip_daily_notes_v2') ||
                localStorage.getItem('tradeontip_notes_v1');
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

export async function saveDayNote(portfolioId = 'default', dateStr, noteData) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.saveDayNote(portfolioId, dateStr, noteData);
    } catch (err) {
      console.error('[dbAdapter:saveDayNote Electron Error]', err);
    }
  }

  try {
    const notes = await getCalendarNotes(portfolioId);
    notes[dateStr] = noteData;
    localStorage.setItem('tradeontip_daily_notes_v2', JSON.stringify(notes));
  } catch (_) {}
  return noteData;
}

export async function deleteDayNote(portfolioId = 'default', dateStr) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.deleteDayNote(portfolioId, dateStr);
    } catch (err) {
      console.error('[dbAdapter:deleteDayNote Electron Error]', err);
    }
  }

  try {
    const notes = await getCalendarNotes(portfolioId);
    delete notes[dateStr];
    localStorage.setItem('tradeontip_daily_notes_v2', JSON.stringify(notes));
  } catch (_) {}
  return true;
}

export async function getIndependentNotes(portfolioId = 'default') {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.getIndependentNotes(portfolioId);
    } catch (err) {
      console.error('[dbAdapter:getIndependentNotes Electron Error]', err);
    }
  }

  try {
    const raw = localStorage.getItem('tradeontip_independent_notes_v1');
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export async function saveIndependentNote(portfolioId = 'default', note) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.saveIndependentNote(portfolioId, note);
    } catch (err) {
      console.error('[dbAdapter:saveIndependentNote Electron Error]', err);
    }
  }

  try {
    const notes = await getIndependentNotes(portfolioId);
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx >= 0) notes[idx] = note;
    else notes.unshift(note);
    localStorage.setItem('tradeontip_independent_notes_v1', JSON.stringify(notes));
  } catch (_) {}
  return note;
}

export async function deleteIndependentNote(portfolioId = 'default', noteId) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.deleteIndependentNote(portfolioId, noteId);
    } catch (err) {
      console.error('[dbAdapter:deleteIndependentNote Electron Error]', err);
    }
  }

  try {
    const notes = await getIndependentNotes(portfolioId);
    const filtered = notes.filter(n => n.id !== noteId);
    localStorage.setItem('tradeontip_independent_notes_v1', JSON.stringify(filtered));
  } catch (_) {}
  return true;
}

// ── Screenshots ──────────────────────────────────────────────────────────────

export async function saveScreenshot(tradeId, imageType, bufferOrBase64, customFilename = null) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.saveScreenshot(tradeId, imageType, bufferOrBase64, customFilename);
    } catch (err) {
      console.error('[dbAdapter:saveScreenshot Electron Error]', err);
    }
  }
  return null;
}

export async function getScreenshotsForTrade(tradeId) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.getScreenshotsForTrade(tradeId);
    } catch (err) {
      console.error('[dbAdapter:getScreenshotsForTrade Electron Error]', err);
    }
  }
  return [];
}

// ── Application Settings ─────────────────────────────────────────────────────

export async function getSetting(key, defaultValue = null) {
  if (isElectron()) {
    try {
      return await window.electronAPI.db.getSetting(key, defaultValue);
    } catch (err) {
      console.error('[dbAdapter:getSetting Electron Error]', err);
    }
  }

  try {
    const val = localStorage.getItem(`foxtrade_setting_${key}`);
    return val !== null ? JSON.parse(val) : defaultValue;
  } catch (_) {
    return defaultValue;
  }
}

export async function setSetting(key, value) {
  if (isElectron()) {
    try {
      await window.electronAPI.db.setSetting(key, value);
    } catch (err) {
      console.error('[dbAdapter:setSetting Electron Error]', err);
    }
  }

  try {
    localStorage.setItem(`foxtrade_setting_${key}`, JSON.stringify(value));
  } catch (_) {}
  return value;
}

// ── One-Time Migration: LocalStorage / IndexedDB → SQLite ─────────────────────

export async function checkAndMigrateLegacyDataToSqlite() {
  if (!isElectron()) return;

  const MIGRATION_KEY = 'foxtrade_sqlite_v1_migrated';
  if (localStorage.getItem(MIGRATION_KEY) === 'true') {
    return; // Already migrated
  }

  try {
    console.log('[dbAdapter] Checking for legacy data to migrate into SQLite...');

    // 1. Check if SQLite trades table is empty
    const existingTrades = await window.electronAPI.db.getTrades('default', {});
    if (!existingTrades || existingTrades.length === 0) {
      // Find trades from IndexedDB or localStorage
      let legacyTrades = await idbGetTrades('default');
      if (!legacyTrades || legacyTrades.length === 0) {
        const raw = localStorage.getItem('tradeontip_trades_cache') ||
                    localStorage.getItem('tradeontip_trades_v5_default');
        if (raw) {
          try { legacyTrades = JSON.parse(raw); } catch (_) {}
        }
      }

      if (Array.isArray(legacyTrades) && legacyTrades.length > 0) {
        console.log(`[dbAdapter] Migrating ${legacyTrades.length} legacy trades into SQLite...`);
        for (const t of legacyTrades) {
          await window.electronAPI.db.saveTrade('default', t, t.executions || null);
        }
        console.log('[dbAdapter] Trades migrated successfully.');
      }
    }

    // 2. Migrate Playbooks from localStorage if SQLite is empty
    const existingPbs = await window.electronAPI.db.getPlaybooks('default');
    if (!existingPbs || existingPbs.length === 0) {
      const rawPb = localStorage.getItem('foxtrade_playbooks_v2');
      if (rawPb) {
        try {
          const pbs = JSON.parse(rawPb);
          if (Array.isArray(pbs) && pbs.length > 0) {
            console.log(`[dbAdapter] Migrating ${pbs.length} playbooks into SQLite...`);
            for (const pb of pbs) {
              await window.electronAPI.db.savePlaybook('default', pb);
            }
          }
        } catch (_) {}
      }
    }

    // 3. Migrate Trade Audits if any
    const rawAudits = localStorage.getItem('foxtrade_trade_audits_v2');
    if (rawAudits) {
      try {
        const audits = JSON.parse(rawAudits);
        for (const [tradeId, auditData] of Object.entries(audits)) {
          await window.electronAPI.db.saveTradeAudit(tradeId, auditData);
        }
      } catch (_) {}
    }

    // 4. Migrate Calendar Notes if any
    const rawNotes = localStorage.getItem('tradeontip_daily_notes_v2');
    if (rawNotes) {
      try {
        const notes = JSON.parse(rawNotes);
        for (const [dateStr, noteData] of Object.entries(notes)) {
          await window.electronAPI.db.saveDayNote('default', dateStr, noteData);
        }
      } catch (_) {}
    }

    localStorage.setItem(MIGRATION_KEY, 'true');
    console.log('[dbAdapter] One-time SQLite migration completed.');
  } catch (err) {
    console.error('[dbAdapter] Legacy migration error:', err);
  }
}
