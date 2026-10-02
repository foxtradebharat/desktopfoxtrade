/**
 * configStore.js
 * ─────────────────────────────────────────────────────────────────────────────
 * App config stored in IndexedDB — NOT localStorage.
 * localStorage can be wiped by OS, incognito mode, or storage pressure.
 * IDB is the only reliable persistent store in the browser.
 *
 * Keys managed here:
 *   deviceId            — unique device identifier (generated once, never changes)
 *   activePortfolioId   — currently selected portfolio
 *   portfolios          — list of all portfolio objects
 *   gdrive_access_token — Google Drive access token
 *   gdrive_token_expiry — token expiry timestamp (ms)
 *   gdrive_refresh_token— refresh token (long-lived, 30 days)
 *   gdrive_user_email   — authenticated user email
 *   monthly_*           — monthly performance data per portfolio/year
 */

import { idbGet, idbPut, idbDelete, STORES } from './foxtradeDB.js';

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Read a config value from IDB.
 * @param {string} key
 * @param {*} defaultValue
 * @returns {Promise<any>}
 */
export async function getConfig(key, defaultValue = null) {
  try {
    const record = await idbGet(STORES.APP_CONFIG, key);
    return record !== null ? record.value : defaultValue;
  } catch (err) {
    console.warn(`[ConfigStore] getConfig("${key}") failed:`, err.message);
    // Graceful fallback: try localStorage for migration period
    try {
      const raw = localStorage.getItem(`foxtrade_config_${key}`);
      return raw !== null ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  }
}

/**
 * Write a config value to IDB.
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
export async function setConfig(key, value) {
  try {
    await idbPut(STORES.APP_CONFIG, { key, value, updatedAt: Date.now() });
  } catch (err) {
    console.warn(`[ConfigStore] setConfig("${key}") failed:`, err.message);
    // Fallback: write to localStorage so at least something persists
    try {
      localStorage.setItem(`foxtrade_config_${key}`, JSON.stringify(value));
    } catch { /* storage quota — nothing we can do */ }
  }
}

/**
 * Delete a config key from IDB.
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function deleteConfig(key) {
  try {
    await idbDelete(STORES.APP_CONFIG, key);
    localStorage.removeItem(`foxtrade_config_${key}`);
  } catch (err) {
    console.warn(`[ConfigStore] deleteConfig("${key}") failed:`, err.message);
  }
}

// ── Device Identity ────────────────────────────────────────────────────────────

/**
 * Get or generate a unique device ID.
 * Generated once, stored forever in IDB.
 * Used for CRDT conflict attribution ("which device last wrote this trade").
 * @returns {Promise<string>}
 */
export async function getDeviceId() {
  let id = await getConfig('deviceId');
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await setConfig('deviceId', id);
  }
  return id;
}

// ── Portfolio Management ──────────────────────────────────────────────────────

/**
 * Get the currently active portfolio ID.
 * @returns {Promise<string>}
 */
export async function getActivePortfolioId() {
  // First check IDB, then fall back to localStorage (migration path)
  const fromIDB = await getConfig('activePortfolioId');
  if (fromIDB) return fromIDB;

  const fromLS = localStorage.getItem('tradeontip_active_portfolio_id')
              || localStorage.getItem('foxtrade_active_portfolio');
  return fromLS || 'default';
}

/**
 * Set the active portfolio ID.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function setActivePortfolioId(id) {
  await setConfig('activePortfolioId', id);
  // Keep localStorage in sync during migration period
  try { localStorage.setItem('tradeontip_active_portfolio_id', id); } catch {}
}

/**
 * Get all portfolios.
 * @returns {Promise<Array<{id: string, name: string, createdAt: number}>>}
 */
export async function getPortfolios() {
  const fromIDB = await getConfig('portfolios');
  if (fromIDB && Array.isArray(fromIDB) && fromIDB.length > 0) return fromIDB;

  // Migration: check localStorage for existing portfolios
  try {
    const raw = localStorage.getItem('tradeontip_portfolios')
             || localStorage.getItem('foxtrade_portfolios');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        await setConfig('portfolios', parsed);
        return parsed;
      }
    }
  } catch {}

  // Default: single portfolio
  const defaultPortfolios = [{
    id:        'default',
    name:      'My Portfolio',
    currency:  'INR',
    createdAt: Date.now(),
  }];
  await setConfig('portfolios', defaultPortfolios);
  return defaultPortfolios;
}

/**
 * Save the full portfolios list.
 * @param {Array} portfolios
 * @returns {Promise<void>}
 */
export async function setPortfolios(portfolios) {
  await setConfig('portfolios', portfolios);
  try { localStorage.setItem('tradeontip_portfolios', JSON.stringify(portfolios)); } catch {}
}

// ── Monthly Performance ───────────────────────────────────────────────────────

/**
 * Get monthly performance data for a portfolio/year.
 * Reads from the dedicated monthly_perf store (keyPath = `{portfolioId}_{year}_all`).
 * Falls back to app_config keys and localStorage for migration.
 * @param {string} portfolioId
 * @param {string|number} year
 * @returns {Promise<object|null>}
 */
export async function getMonthlyPerf(portfolioId, year) {
  const storeKey = `${portfolioId}_${year}_all`;
  try {
    const rec = await idbGet(STORES.MONTHLY_PERF, storeKey);
    if (rec) return rec.data;
  } catch {}

  // Migration: check old app_config key
  const legacyKey = `monthly_${portfolioId}_${year}`;
  const fromIDB = await getConfig(legacyKey);
  if (fromIDB) {
    // Migrate into proper store
    await setMonthlyPerf(portfolioId, year, fromIDB);
    return fromIDB;
  }

  // Migration: check localStorage
  try {
    const raw = localStorage.getItem(`tradeontip_monthly_${portfolioId}_${year}`)
             || localStorage.getItem(`foxtrade_monthly_${portfolioId}_${year}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      await setMonthlyPerf(portfolioId, year, parsed);
      return parsed;
    }
  } catch {}

  return null;
}

/**
 * Save monthly performance data for a portfolio/year.
 * Writes to the dedicated monthly_perf store.
 * @param {string} portfolioId
 * @param {string|number} year
 * @param {object} data
 * @returns {Promise<void>}
 */
export async function setMonthlyPerf(portfolioId, year, data) {
  const storeKey = `${portfolioId}_${year}_all`;
  try {
    await idbPut(STORES.MONTHLY_PERF, {
      pid_year_month: storeKey,
      portfolioId,
      year: String(year),
      data,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn(`[ConfigStore] setMonthlyPerf failed, falling back to app_config:`, err.message);
    await setConfig(`monthly_${portfolioId}_${year}`, data);
  }
  try {
    localStorage.setItem(`tradeontip_monthly_${portfolioId}_${year}`, JSON.stringify(data));
  } catch {}
}

// ── Capital Settings ──────────────────────────────────────────────────────────

/**
 * Get base capital for a portfolio.
 * @param {string} portfolioId
 * @returns {Promise<number>}
 */
export async function getBaseCapital(portfolioId = 'default') {
  const key = `base_capital_${portfolioId}`;
  const fromIDB = await getConfig(key);
  if (fromIDB !== null) return fromIDB;

  // Migration from localStorage
  const fromLS = parseFloat(localStorage.getItem('tradeontip_base_capital') || '0');
  return fromLS || 0;
}

/**
 * Set base capital for a portfolio.
 * @param {string} portfolioId
 * @param {number} amount
 * @returns {Promise<void>}
 */
export async function setBaseCapital(portfolioId, amount) {
  await setConfig(`base_capital_${portfolioId}`, amount);
  try { localStorage.setItem('tradeontip_base_capital', String(amount)); } catch {}
}
