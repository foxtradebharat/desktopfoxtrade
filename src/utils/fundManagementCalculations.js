// Full Dynamic Fund Management & Portfolio Capital Calculation Engine
// 100% Mathematical & Data-driven logic for FoxTrade

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const LEDGER_MIGRATION_FLAG_KEY = 'tradeontip_migr_ledger_dates_v1';

/**
 * Derives 12-month capital aggregate map from dated entries array.
 * Shape: { 0: { added, addedNotes, withdrawn, withdrawnNotes }, ... 11: { ... } }
 */
export function deriveMonthAggregates(entries = [], year = '2026') {
  const numYear = parseInt(year, 10) || 2026;
  const result = {};
  for (let m = 0; m < 12; m++) {
    result[m] = { added: 0, addedNotes: '', withdrawn: 0, withdrawnNotes: '' };
  }

  const validEntries = Array.isArray(entries) ? entries : [];
  validEntries.forEach(entry => {
    if (!entry || !entry.date) return;
    const parts = String(entry.date).split('-');
    if (parts.length < 3) return;
    const entryYear = parseInt(parts[0], 10);
    const entryMonth = parseInt(parts[1], 10) - 1; // 0-indexed
    if (entryYear !== numYear || entryMonth < 0 || entryMonth > 11) return;

    const amt = Math.max(0, Number(entry.amount) || 0);
    const note = (entry.note || '').trim();

    if (entry.type === 'deposit') {
      result[entryMonth].added += amt;
      if (note) {
        result[entryMonth].addedNotes = result[entryMonth].addedNotes
          ? `${result[entryMonth].addedNotes}; ${note}`
          : note;
      }
    } else if (entry.type === 'withdrawal') {
      result[entryMonth].withdrawn += amt;
      if (note) {
        result[entryMonth].withdrawnNotes = result[entryMonth].withdrawnNotes
          ? `${result[entryMonth].withdrawnNotes}; ${note}`
          : note;
      }
    }
  });

  return result;
}

/**
 * Converts legacy month aggregates object to dated entries on the 1st of each month.
 */
export function convertLegacyAggregatesToEntries(legacyData = {}, portfolioId = 'portfolio-default', year = '2026') {
  const entries = [];
  if (!legacyData || typeof legacyData !== 'object') return entries;

  for (let m = 0; m < 12; m++) {
    const monthData = legacyData[m] || legacyData[String(m)];
    if (!monthData) continue;

    const added = Number(monthData.added || 0);
    const addedNotes = (monthData.addedNotes || '').trim();
    const withdrawn = Number(monthData.withdrawn || 0);
    const withdrawnNotes = (monthData.withdrawnNotes || '').trim();
    const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-01`;

    if (added > 0) {
      entries.push({
        id: `migr_${portfolioId}_${year}_m${m}_dep`,
        portfolioId,
        type: 'deposit',
        amount: added,
        date: dateStr,
        dateApproximate: true,
        note: addedNotes
      });
    }

    if (withdrawn > 0) {
      entries.push({
        id: `migr_${portfolioId}_${year}_m${m}_wth`,
        portfolioId,
        type: 'withdrawal',
        amount: withdrawn,
        date: dateStr,
        dateApproximate: true,
        note: withdrawnNotes
      });
    }
  }

  return entries;
}

/**
 * Migration: One-time, idempotent migration guarded by flag key.
 * Backs up old data to `key + '_backup_premigration'` before converting.
 */
export function migrateLedgerToDatedEntries() {
  try {
    if (typeof localStorage === 'undefined') return;
    const isMigrated = localStorage.getItem(LEDGER_MIGRATION_FLAG_KEY);
    if (isMigrated === 'true') return;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('tradeontip_monthly_capital_') || key.includes('_backup')) {
        continue;
      }

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      // 1. Create backup key
      const backupKey = `${key}_backup_premigration`;
      if (!localStorage.getItem(backupKey)) {
        localStorage.setItem(backupKey, raw);
      }

      // 2. Parse key to extract portfolioId and year
      const parts = key.replace('tradeontip_monthly_capital_', '').split('_');
      let portfolioId = 'portfolio-default';
      let year = '2026';
      if (parts.length === 1) {
        year = parts[0];
      } else if (parts.length >= 2) {
        portfolioId = parts.slice(0, parts.length - 1).join('_');
        year = parts[parts.length - 1];
      }

      try {
        const legacyData = JSON.parse(raw);
        if (legacyData && typeof legacyData === 'object') {
          const entries = convertLegacyAggregatesToEntries(legacyData, portfolioId, year);
          if (entries.length > 0) {
            const entriesKey = `tradeontip_ledger_entries_${portfolioId}_${year}`;
            localStorage.setItem(entriesKey, JSON.stringify(entries));
          }
        }
      } catch (_) {}
    }

    localStorage.setItem(LEDGER_MIGRATION_FLAG_KEY, 'true');
  } catch (err) {
    console.error('Error during ledger dates migration:', err);
  }
}

/**
 * Retrieves dated ledger entries for a specific portfolio and year.
 */
export function getStoredLedgerEntries(portfolioId = 'portfolio-default', year = '2026') {
  try {
    if (typeof localStorage === 'undefined') return [];
    migrateLedgerToDatedEntries();

    const key = `tradeontip_ledger_entries_${portfolioId}_${year}`;
    let saved = localStorage.getItem(key);
    if (!saved && portfolioId === 'portfolio-default') {
      saved = localStorage.getItem(`tradeontip_ledger_entries_${year}`);
    }
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }

    const legacyKey = `tradeontip_monthly_capital_${portfolioId}_${year}`;
    let legacySaved = localStorage.getItem(legacyKey);
    if (!legacySaved && portfolioId === 'portfolio-default') {
      legacySaved = localStorage.getItem(`tradeontip_monthly_capital_${year}`);
    }
    if (legacySaved) {
      try {
        const legacyData = JSON.parse(legacySaved);
        if (legacyData && typeof legacyData === 'object') {
          const converted = convertLegacyAggregatesToEntries(legacyData, portfolioId, year);
          if (converted.length > 0) {
            saveLedgerEntries(portfolioId, year, converted);
            return converted;
          }
        }
      } catch {}
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Retrieves all ledger flows formatted for computeDrawdownDaily across all years.
 * Returns: [{ dayKey: 'YYYY-MM-DD', amount: number (deposit +, withdrawal -), dateApproximate: boolean, id, note }]
 */
export function getLedgerFlows(portfolioId = 'portfolio-default') {
  try {
    if (typeof localStorage === 'undefined') return [];
    migrateLedgerToDatedEntries();

    const targetPf = portfolioId || 'portfolio-default';
    const entriesMap = new Map();
    const prefix = `tradeontip_ledger_entries_${targetPf}_`;
    const fallbackPrefix = 'tradeontip_ledger_entries_';

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(prefix)) {
        try {
          const arr = JSON.parse(localStorage.getItem(k));
          if (Array.isArray(arr)) {
            arr.forEach(e => { if (e && e.id) entriesMap.set(e.id, e); });
          }
        } catch {}
      }
    }

    if (entriesMap.size === 0 && targetPf === 'portfolio-default') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (/^tradeontip_ledger_entries_\d{4}$/.test(k) && !k.includes('_backup_')) {
          try {
            const arr = JSON.parse(localStorage.getItem(k));
            if (Array.isArray(arr)) {
              arr.forEach(e => { if (e && e.id) entriesMap.set(e.id, e); });
            }
          } catch {}
        }
      }
    }

    return Array.from(entriesMap.values())
      .filter(e => e && e.date && !isNaN(Number(e.amount)))
      .map(e => ({
        dayKey: e.date,
        amount: e.type === 'withdrawal' ? -Math.abs(Number(e.amount)) : Math.abs(Number(e.amount)),
        dateApproximate: Boolean(e.dateApproximate),
        id: e.id,
        note: e.note
      }))
      .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  } catch {
    return [];
  }
}

/**
 * Saves dated ledger entries as single source of truth, deriving month aggregates.
 */
export function saveLedgerEntries(portfolioId = 'portfolio-default', year = '2026', entries = []) {
  try {
    if (typeof localStorage === 'undefined') return;
    const cleanEntries = (Array.isArray(entries) ? entries : []).map((e, idx) => ({
      id: e.id || `entry_${Date.now()}_${idx}`,
      portfolioId: e.portfolioId || portfolioId,
      type: e.type === 'withdrawal' ? 'withdrawal' : 'deposit',
      amount: Math.max(0, Number(e.amount) || 0),
      date: e.date || `${year}-01-01`,
      dateApproximate: Boolean(e.dateApproximate),
      note: String(e.note || '').trim()
    }));

    const key = `tradeontip_ledger_entries_${portfolioId}_${year}`;
    localStorage.setItem(key, JSON.stringify(cleanEntries));
    localStorage.setItem(`tradeontip_ledger_entries_${year}`, JSON.stringify(cleanEntries));

    // Derive month aggregates and save to legacy monthly capital key
    const derivedAggregates = deriveMonthAggregates(cleanEntries, year);
    const legacyKey = `tradeontip_monthly_capital_${portfolioId}_${year}`;
    localStorage.setItem(legacyKey, JSON.stringify(derivedAggregates));
    localStorage.setItem(`tradeontip_monthly_capital_${year}`, JSON.stringify(derivedAggregates));

    let initialAdded = 0;
    for (let m = 0; m < 12; m++) {
      const added = Number(derivedAggregates[m]?.added || 0);
      if (added > 0) {
        initialAdded = added;
        break;
      }
    }

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('tradeontip_capital_updated', {
        detail: { portfolioId, year, data: derivedAggregates, entries: cleanEntries, baseCapital: initialAdded }
      }));
    }

    // Persist to IndexedDB config store and trigger real-time auto-sync
    if (typeof indexedDB !== 'undefined') {
      try {
        import('../db/configStore.js').then(({ setConfig }) => {
          setConfig(key, cleanEntries).catch(() => {});
          setConfig(legacyKey, derivedAggregates).catch(() => {});
        }).catch(() => {});
        import('../db/syncEngine.js').then(({ triggerAutoSync }) => {
          triggerAutoSync(portfolioId);
        }).catch(() => {});
      } catch (_) {}
    }
  } catch (err) {
    console.error('Error saving ledger entries:', err);
  }
}

export function getStoredCapitalChanges(portfolioId = 'portfolio-default', year = '2026') {
  try {
    if (typeof localStorage === 'undefined') return {};
    migrateLedgerToDatedEntries();

    // If dated entries exist, derive month aggregates directly
    const entriesKey = `tradeontip_ledger_entries_${portfolioId}_${year}`;
    let entriesRaw = localStorage.getItem(entriesKey);
    if (!entriesRaw && portfolioId === 'portfolio-default') {
      entriesRaw = localStorage.getItem(`tradeontip_ledger_entries_${year}`);
    }
    if (entriesRaw) {
      try {
        const entries = JSON.parse(entriesRaw);
        if (Array.isArray(entries) && entries.length > 0) {
          return deriveMonthAggregates(entries, year);
        }
      } catch {}
    }

    const key = `tradeontip_monthly_capital_${portfolioId}_${year}`;
    let saved = localStorage.getItem(key);
    if (saved === null && portfolioId === 'portfolio-default') {
      saved = localStorage.getItem(`tradeontip_monthly_capital_${year}`);
    }
    if (saved !== null) {
      try {
        return JSON.parse(saved) || {};
      } catch {
        return {};
      }
    }

    const isCleared = localStorage.getItem('tradeontip_data_cleared');
    if (isCleared === 'true') return {};

    return {};
  } catch {
    return {};
  }
}

export function saveCapitalChanges(portfolioId = 'portfolio-default', year = '2026', data = {}) {
  try {
    const key = `tradeontip_monthly_capital_${portfolioId}_${year}`;
    localStorage.setItem(key, JSON.stringify(data));
    if (portfolioId === 'portfolio-default') {
      localStorage.setItem(`tradeontip_monthly_capital_${year}`, JSON.stringify(data));
    }

    // If legacy saveCapitalChanges is called, keep dated entries in sync
    const entries = convertLegacyAggregatesToEntries(data, portfolioId, year);
    if (entries.length > 0) {
      const entriesKey = `tradeontip_ledger_entries_${portfolioId}_${year}`;
      localStorage.setItem(entriesKey, JSON.stringify(entries));
      if (portfolioId === 'portfolio-default') {
        localStorage.setItem(`tradeontip_ledger_entries_${year}`, JSON.stringify(entries));
      }
    }

    let initialAdded = 0;
    for (let m = 0; m < 12; m++) {
      const added = Number(data[m]?.added || 0);
      if (added > 0) {
        initialAdded = added;
        break;
      }
    }

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('tradeontip_capital_updated', {
        detail: { portfolioId, year, data, entries, baseCapital: initialAdded }
      }));
    }

    // Persist to IndexedDB config store and trigger real-time auto-sync
    if (typeof indexedDB !== 'undefined') {
      try {
        import('../db/configStore.js').then(({ setConfig }) => {
          setConfig(key, data).catch(() => {});
        }).catch(() => {});
        import('../db/syncEngine.js').then(({ triggerAutoSync }) => {
          triggerAutoSync(portfolioId);
        }).catch(() => {});
      } catch (_) {}
    }
  } catch (err) {
    console.error('Error saving capital changes:', err);
  }
}

export function parseMonthAndYear(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const cleaned = dateStr.trim();
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    if (parts[0].length === 4) {
      return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) - 1 };
    } else if (parts[2].length === 4) {
      return { year: parseInt(parts[2], 10), month: parseInt(parts[1], 10) - 1 };
    }
  } else if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    if (parts[2]?.length === 4) {
      return { year: parseInt(parts[2], 10), month: parseInt(parts[0], 10) - 1 };
    }
  }
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() };
  }
  return null;
}

import { matchLots } from './foxCalculationEngine.js';
import { toPaise, fromPaise } from './pnlEngine.js';

/**
 * Resolves December ending capital from the preceding year (or chain of preceding years).
 * Exact FoxTrade rollover logic: closing balance of Dec 31 carries into Jan 1 opening balance.
 */
export function getPreviousYearEndingCapital(trades = [], selectedYear = '2026', portfolioId = 'portfolio-default', options = {}) {
  const numYear = parseInt(selectedYear, 10);
  if (!numYear || isNaN(numYear)) return 0;

  // Scan prior years up to 15 years back
  const priorYears = [];
  for (let yr = numYear - 1; yr >= numYear - 15; yr--) {
    const yrStr = String(yr);
    const capChanges = getStoredCapitalChanges(portfolioId, yrStr);
    const hasCap = Object.values(capChanges).some(m => Number(m?.added || 0) > 0 || Number(m?.withdrawn || 0) > 0);
    const hasTrades = Array.isArray(trades) && trades.some(t => {
      const d = parseMonthAndYear(t.date || t.entryDate || t.exitDate || t.e1Date);
      return d && d.year === yr;
    });

    if (hasCap || hasTrades) {
      priorYears.push(yr);
    }
  }

  if (priorYears.length === 0) {
    return 0;
  }

  // Sort chronologically ascending
  priorYears.sort((a, b) => a - b);
  const earliestPriorYear = priorYears[0];

  // Roll forward from the earliest prior year to numYear - 1
  let rolledDecCapital = 0;
  for (let yr = earliestPriorYear; yr < numYear; yr++) {
    const yrStr = String(yr);
    const capChanges = getStoredCapitalChanges(portfolioId, yrStr);

    const months = calculateMonthlyPerformance(trades, capChanges, yrStr, {
      ...options,
      costBasisMethod: options?.costBasisMethod || 'fifo',
      prevYearDecCapital: rolledDecCapital,
      skipPrevYearLookup: true
    });

    const decMonth = months[11];
    if (decMonth && decMonth.capitalIsReal && decMonth.finalCapital > 0) {
      rolledDecCapital = decMonth.finalCapital;
    }
  }

  return rolledDecCapital;
}

/**
 * Calculates dynamic month-by-month compounding performance matrix for FoxTrade
 */
export function calculateMonthlyPerformance(trades = [], capitalChanges = {}, selectedYear = '2026', options = {}) {
  const costBasisMethod = options?.costBasisMethod || 'fifo';
  let runningCapital = 0;
  let cumulativeMultiplier = 1.0;
  let preTaxCumulativeMultiplier = 1.0;
  let firstTradeMonthIdx = -1;
  let latestTradeMonthIdx = -1;
  const numYear = parseInt(selectedYear, 10) || 2026;

  // Carryover starting capital from prior year December final capital
  let prevYearDecCapital = 0;
  if (options?.prevYearDecCapital !== undefined) {
    prevYearDecCapital = Number(options.prevYearDecCapital) || 0;
  } else if (!options?.skipPrevYearLookup) {
    const portfolioId = options?.portfolioId || 'portfolio-default';
    const sourceTradesForPrior = options?.allTrades || trades;
    prevYearDecCapital = getPreviousYearEndingCapital(sourceTradesForPrior, selectedYear, portfolioId, options);
  }

  // Base capital only applies if explicitly passed by caller in options.
  // Never automatically fetch global tradeontip_base_capital from localStorage across years.
  // In Fund Management, capital starts ONLY when manually entered by user or rolled over from prior year December.
  const baseCapital = Number(options?.baseCapital || 0);

  // Flow basis tracks real money contributions (opening capital + deposits - withdrawals).
  let flowBasis = prevYearDecCapital > 0 ? prevYearDecCapital : (baseCapital > 0 ? baseCapital : 0);
  runningCapital = flowBasis;

  // Determine elapsed months boundary across trading calendar
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  let maxElapsedMonthIdx = -1;
  if (numYear < currentYear) {
    maxElapsedMonthIdx = 11;
  } else if (numYear === currentYear) {
    maxElapsedMonthIdx = currentMonth;
  } else {
    maxElapsedMonthIdx = -1;
  }

  // Compute each trade's exit contributions by month dynamically
  const monthlyTradeStats = {};

  trades.forEach(t => {
    const side = (t.type || t.side || 'Buy');
    const isSell = String(side).toLowerCase() === 'sell';
    const isClosed = String(t.status || t.positionStatus || '').toLowerCase() === 'closed';

    // Collect Entry Legs
    const entryLots = [];
    const initialQty = parseFloat(t.qty || t.initialQty) || 0;
    const initialPrice = parseFloat(t.entry) || 0;
    if (initialQty > 0 && initialPrice > 0) {
      entryLots.push({
        id: 'initial',
        price: initialPrice,
        qty: initialQty,
        date: t.date || ''
      });
    }
    for (let i = 1; i <= 4; i++) {
      const pQty = parseFloat(t[`p${i}Qty`]) || 0;
      const pPrice = parseFloat(t[`p${i}Price`]) || 0;
      const pDate = t[`p${i}Date`] || t.date || '';
      if (pQty > 0 && pPrice > 0) {
        entryLots.push({
          id: `p${i}`,
          price: pPrice,
          qty: pQty,
          date: pDate
        });
      }
    }

    // Collect Exit Legs (fallback to t.exitDate or t.date if leg date missing)
    const exitLots = [
      { id: 'e1', price: parseFloat(t.e1Price) || 0, qty: parseFloat(t.e1Qty) || 0, date: t.e1Date || t.exitDate || t.date || '' },
      { id: 'e2', price: parseFloat(t.e2Price) || 0, qty: parseFloat(t.e2Qty) || 0, date: t.e2Date || t.exitDate || t.date || '' },
      { id: 'e3', price: parseFloat(t.e3Price) || 0, qty: parseFloat(t.e3Qty) || 0, date: t.e3Date || t.exitDate || t.date || '' },
      { id: 'e4', price: parseFloat(t.e4Price) || 0, qty: parseFloat(t.e4Qty) || 0, date: t.e4Date || t.exitDate || t.date || '' },
    ].filter(l => l.qty > 0 && l.price > 0);

    if (exitLots.length > 0 && entryLots.length > 0) {
      const { matches } = matchLots(entryLots, exitLots, costBasisMethod, side);

      // Group matched realized P/L by exit month
      const matchesByMonth = {};
      const isAutoTaxes = typeof localStorage !== 'undefined' && localStorage.getItem('foxtrade_auto_taxes_enabled') === 'true';
      const tradeTaxes = Number(t.taxes || (isAutoTaxes ? (t.charges?.total || 0) : 0) || t.brokerage || 0);
      const totalMatches = matches.length || 1;

      matches.forEach(m => {
        let d = parseMonthAndYear(m.exitDate);
        if (!d || d.year !== numYear) {
          const entryD = parseMonthAndYear(t.date || t.entryDate);
          if (entryD && entryD.year === numYear) {
            d = entryD; // Attributing by entry date if exit date had an inverted year typo
          }
        }

        if (d && d.year === numYear) {
          if (!matchesByMonth[d.month]) {
            matchesByMonth[d.month] = { netPl: 0, grossPl: 0, taxes: 0, count: 0, gains: [], lossVals: [], grossPlPaise: 0, taxesPaise: 0, netPlPaise: 0 };
          }
          const chunkTax = tradeTaxes > 0 ? (tradeTaxes / totalMatches) : 0;
          const chunkGross = m.pl;
          const chunkNet = chunkGross - chunkTax;

          matchesByMonth[d.month].grossPlPaise += toPaise(chunkGross);
          matchesByMonth[d.month].taxesPaise += toPaise(chunkTax);
          matchesByMonth[d.month].netPlPaise += toPaise(chunkNet);
          matchesByMonth[d.month].grossPl = fromPaise(matchesByMonth[d.month].grossPlPaise);
          matchesByMonth[d.month].taxes = fromPaise(matchesByMonth[d.month].taxesPaise);
          matchesByMonth[d.month].netPl = fromPaise(matchesByMonth[d.month].netPlPaise);
          matchesByMonth[d.month].count += 1;
        }
      });

      Object.entries(matchesByMonth).forEach(([mIdxStr, monthData]) => {
        const mIdx = parseInt(mIdxStr, 10);
        if (firstTradeMonthIdx === -1 || mIdx < firstTradeMonthIdx) firstTradeMonthIdx = mIdx;
        if (mIdx > latestTradeMonthIdx) latestTradeMonthIdx = mIdx;

        if (!monthlyTradeStats[mIdx]) {
          monthlyTradeStats[mIdx] = { netPl: 0, grossPl: 0, taxes: 0, trades: 0, wins: 0, losses: 0, gains: [], lossVals: [], rrList: [], holdingDays: [] };
        }

        monthlyTradeStats[mIdx].netPl += monthData.netPl;
        monthlyTradeStats[mIdx].grossPl += monthData.grossPl;
        monthlyTradeStats[mIdx].taxes += monthData.taxes;
        monthlyTradeStats[mIdx].trades += 1; // count trade once per month it exits in

        // Win rate rule: Only Closed positions qualify as wins/losses
        if (isClosed) {
          if (monthData.netPl > 0) {
            monthlyTradeStats[mIdx].wins += 1;
          } else if (monthData.netPl < 0) {
            monthlyTradeStats[mIdx].losses += 1;
          }
        }

        // Gain / Loss move percent
        const rawStockMove = (t.stockMove !== undefined && t.stockMove !== null && t.stockMove !== '' && !isNaN(parseFloat(t.stockMove)))
          ? parseFloat(t.stockMove)
          : null;

        if (rawStockMove !== null) {
          if (rawStockMove > 0) {
            monthlyTradeStats[mIdx].gains.push(Math.abs(rawStockMove));
          } else if (rawStockMove < 0) {
            monthlyTradeStats[mIdx].lossVals.push(Math.abs(rawStockMove));
          }
        } else {
          const avgEntry = parseFloat(t.avgEntry || t.entry) || 0;
          const avgExitPrice = parseFloat(t.avgExitPrice) || 0;
          const movePct = avgEntry > 0 ? Math.abs((avgExitPrice - avgEntry) / avgEntry * 100) : 0;
          if (monthData.netPl > 0) {
            monthlyTradeStats[mIdx].gains.push(movePct);
          } else if (monthData.netPl < 0) {
            monthlyTradeStats[mIdx].lossVals.push(movePct);
          }
        }

        // R rule: Exclude 0R breakeven from the count denominator
        const rrVal = parseFloat(t.weightedRR ?? t.rewardRisk);
        if (!isNaN(rrVal) && rrVal !== 0) {
          monthlyTradeStats[mIdx].rrList.push(rrVal);
        }

        // Holding days
        const daysVal = parseFloat(t.holdingDays);
        if (!isNaN(daysVal) && daysVal > 0) {
          monthlyTradeStats[mIdx].holdingDays.push(daysVal);
        }
      });
    } else if (isClosed && (t.pnl !== undefined || t.avgExitPrice !== undefined)) {
      // Fallback: no exit leg data — use stored pnl and exitDate
      const d = parseMonthAndYear(t.exitDate || t.date);
      if (d && d.year === numYear) {
        const mIdx = d.month;
        if (firstTradeMonthIdx === -1 || mIdx < firstTradeMonthIdx) firstTradeMonthIdx = mIdx;
        if (mIdx > latestTradeMonthIdx) latestTradeMonthIdx = mIdx;

        if (!monthlyTradeStats[mIdx]) {
          monthlyTradeStats[mIdx] = { netPl: 0, grossPl: 0, taxes: 0, trades: 0, wins: 0, losses: 0, gains: [], lossVals: [], rrList: [], holdingDays: [] };
        }
        const tradePl = (t.pnl !== undefined && t.pnl !== null && !isNaN(parseFloat(t.pnl))) ? parseFloat(t.pnl) : 0;
        const isAutoTaxesFallback = typeof localStorage !== 'undefined' && localStorage.getItem('foxtrade_auto_taxes_enabled') === 'true';
        const tradeTaxes = Number(t.taxes || (isAutoTaxesFallback ? (t.charges?.total || 0) : 0) || t.brokerage || 0);
        const tradeGross = Number.isFinite(Number(t.grossRealizedPL ?? t.grossPL ?? t.grossPnl)) ? Number(t.grossRealizedPL ?? t.grossPL ?? t.grossPnl) : (tradePl + tradeTaxes);
        monthlyTradeStats[mIdx].netPl += tradePl;
        monthlyTradeStats[mIdx].grossPl += tradeGross;
        monthlyTradeStats[mIdx].taxes += tradeTaxes;
        monthlyTradeStats[mIdx].trades += 1;

        if (tradePl > 0) {
          monthlyTradeStats[mIdx].wins += 1;
        } else if (tradePl < 0) {
          monthlyTradeStats[mIdx].losses += 1;
        }

        const rawStockMove = (t.stockMove !== undefined && t.stockMove !== null && t.stockMove !== '' && !isNaN(parseFloat(t.stockMove)))
          ? parseFloat(t.stockMove)
          : null;
        if (rawStockMove !== null) {
          if (rawStockMove > 0) {
            monthlyTradeStats[mIdx].gains.push(Math.abs(rawStockMove));
          } else if (rawStockMove < 0) {
            monthlyTradeStats[mIdx].lossVals.push(Math.abs(rawStockMove));
          }
        }

        const rrVal = parseFloat(t.weightedRR ?? t.rewardRisk);
        if (!isNaN(rrVal) && rrVal !== 0) {
          monthlyTradeStats[mIdx].rrList.push(rrVal);
        }

        const daysVal = parseFloat(t.holdingDays);
        if (!isNaN(daysVal) && daysVal > 0) {
          monthlyTradeStats[mIdx].holdingDays.push(daysVal);
        }
      }
    }
  });

  return MONTH_NAMES.map((month, idx) => {
    const added = parseFloat(capitalChanges[idx]?.added) || 0;
    const addedNotes = capitalChanges[idx]?.addedNotes || '';
    const withdrawn = parseFloat(capitalChanges[idx]?.withdrawn) || 0;
    const withdrawnNotes = capitalChanges[idx]?.withdrawnNotes || '';

    const stats = monthlyTradeStats[idx] || { netPl: 0, grossPl: 0, taxes: 0, trades: 0, wins: 0, losses: 0, gains: [], lossVals: [], rrList: [], holdingDays: [] };
    
    // Check manual monthly taxes saved via Tax Input Dialog / Tax Analytics
    let manualMonthTax = 0;
    if (typeof localStorage !== 'undefined') {
      try {
        const storedTaxes = JSON.parse(localStorage.getItem(`foxtrade_monthly_taxes_${numYear}`) || '{}');
        if (storedTaxes[idx] !== undefined && storedTaxes[idx] !== null) {
          manualMonthTax = Number(storedTaxes[idx]) || 0;
        }
      } catch (_) {}
    }

    const isAutoTaxes = typeof localStorage !== 'undefined' && localStorage.getItem('foxtrade_auto_taxes_enabled') === 'true';
    const tradeTaxes = isAutoTaxes ? Math.round((stats.taxes || 0) * 100) / 100 : 0;
    const taxes = Math.round((manualMonthTax > 0 ? manualMonthTax : tradeTaxes) * 100) / 100;
    const grossPl = Math.round((stats.grossPl !== undefined ? stats.grossPl : stats.netPl) * 100) / 100;
    const netPl = Math.round((grossPl - taxes) * 100) / 100;
    const tradeCount = stats.trades;
    // Win rate: Total wins divided by total monthly trade count
    const winPct = tradeCount > 0 ? (stats.wins / tradeCount) * 100 : 0;
    const avgGainPct = stats.gains.length > 0 ? stats.gains.reduce((a, b) => a + b, 0) / stats.gains.length : 0;
    const avgLossPct = stats.lossVals.length > 0 ? stats.lossVals.reduce((a, b) => a + b, 0) / stats.lossVals.length : 0;
    const avgRR = stats.rrList.length > 0 ? stats.rrList.reduce((a, b) => a + b, 0) / stats.rrList.length : 0;
    const avgDays = stats.holdingDays.length > 0 ? (stats.holdingDays.reduce((a, b) => a + b, 0) / stats.holdingDays.length) : 0;

    // Flow basis: opening capital + deposits - withdrawals. Never includes P&L.
    flowBasis += added - withdrawn;
    const capitalIsReal = flowBasis > 0;

    if (!capitalIsReal) {
      // Do NOT roll P&L into runningCapital; there is no capital to roll it into
      runningCapital = 0;
      return {
        month,
        monthIdx: idx,
        added,
        addedNotes,
        withdrawn,
        withdrawnNotes,
        capitalIsReal: false,
        startingCapital: null,
        finalCapital: null,
        pctPl: null,
        preTaxPctPl: null,
        cagr: null,
        netPl,
        grossPl,
        taxes,
        trades: tradeCount,
        winPct,
        avgGainPct,
        avgLossPct,
        avgRR,
        avgDays,
        cumulativeMultiplier,
        preTaxCumulativeMultiplier,
        prevYearDecCapital: idx === 0 ? prevYearDecCapital : 0,
      };
    }

    // Capital Rollover & Compounding:
    let startingCapital = runningCapital;
    if (idx === 0) {
      startingCapital = (prevYearDecCapital > 0 ? prevYearDecCapital : baseCapital) + added - withdrawn;
      runningCapital = startingCapital;
    } else {
      startingCapital = runningCapital + added - withdrawn;
      runningCapital = startingCapital;
    }

    const finalCapital = startingCapital + netPl;
    runningCapital = finalCapital;

    const pctPl = startingCapital > 0 && netPl !== 0 ? Math.round((netPl / startingCapital) * 10000) / 100 : 0;
    const preTaxPctPl = startingCapital > 0 && grossPl !== 0 ? Math.round((grossPl / startingCapital) * 10000) / 100 : 0;

    // Compounded Multiplier (FoxTrade uses rounded monthly plPct for compounding):
    if (startingCapital > 0 && netPl !== 0) {
      cumulativeMultiplier *= (1 + pctPl / 100);
    }
    if (startingCapital > 0 && grossPl !== 0) {
      preTaxCumulativeMultiplier *= (1 + preTaxPctPl / 100);
    }

    // FoxTrade Annualized CAGR Formula across elapsed months
    let cagr = 0;
    if (firstTradeMonthIdx !== -1 && idx >= firstTradeMonthIdx && (maxElapsedMonthIdx === -1 || idx <= maxElapsedMonthIdx)) {
      const elapsedYears = (idx + 1) / 12;
      if (elapsedYears > 0) {
        if (cumulativeMultiplier >= 0) {
          cagr = Math.round(((Math.pow(cumulativeMultiplier, 1 / elapsedYears) - 1) * 100) * 100) / 100;
        } else {
          cagr = Math.round((-((Math.pow(Math.abs(cumulativeMultiplier), 1 / elapsedYears) - 1) * 100)) * 100) / 100;
        }
      }
    }

    return {
      month,
      monthIdx: idx,
      added,
      addedNotes,
      withdrawn,
      withdrawnNotes,
      capitalIsReal: true,
      startingCapital,
      netPl,
      grossPl,
      taxes,
      pctPl,
      preTaxPctPl,
      finalCapital,
      trades: tradeCount,
      winPct,
      avgGainPct,
      avgLossPct,
      avgRR,
      avgDays,
      cagr,
      cumulativeMultiplier,
      preTaxCumulativeMultiplier,
      prevYearDecCapital: idx === 0 ? prevYearDecCapital : 0
    };
  });
}

/**
 * Returns the active portfolio capital to use in the Journal StatCards.
 * Pulls exact live month-over-month compounding capital from Fund Management.
 */
export function getActivePortfolioCapital(trades = [], capitalChanges = {}, selectedYear = '2026', targetMonthIdx = null, options = {}) {
  const numYear = parseInt(selectedYear, 10) || 2026;
  const now = new Date();
  const currentMonthIdx = (targetMonthIdx !== undefined && targetMonthIdx !== null)
    ? targetMonthIdx
    : (numYear === now.getFullYear() ? now.getMonth() : 11);

  const monthlyData = calculateMonthlyPerformance(trades, capitalChanges, String(numYear), {
    ...options,
    portfolioId: options?.portfolioId || 'portfolio-default',
    allTrades: (options?.allTrades && options.allTrades.length > 0) ? options.allTrades : trades
  });
  
  // Current active month capital
  const currentMonthData = monthlyData[currentMonthIdx] || monthlyData[monthlyData.length - 1];
  if (currentMonthData && currentMonthData.capitalIsReal) {
    if (currentMonthData.finalCapital > 0) return currentMonthData.finalCapital;
    if (currentMonthData.startingCapital > 0) return currentMonthData.startingCapital;
  }

  for (let i = currentMonthIdx; i >= 0; i--) {
    if (monthlyData[i]?.capitalIsReal && monthlyData[i]?.finalCapital > 0) return monthlyData[i].finalCapital;
    if (monthlyData[i]?.capitalIsReal && monthlyData[i]?.startingCapital > 0) return monthlyData[i].startingCapital;
  }

  return 0;
}

/**
 * Calculates yearly fund summary with starting, ending, deposits, withdrawals, and CAGR
 */
export function calculateYearlyFundSummary(trades = [], capitalChanges = {}, selectedYear = '2026', options = {}) {
  const months = calculateMonthlyPerformance(trades, capitalChanges, selectedYear, options);
  const activeMonths = months.filter(m => m.trades > 0 || m.added > 0 || m.withdrawn > 0);
  
  const totalAdded = months.reduce((acc, m) => acc + m.added, 0);
  const totalWithdrawn = months.reduce((acc, m) => acc + m.withdrawn, 0);
  const netCapitalChange = totalAdded - totalWithdrawn;
  const totalNetPl = months.reduce((acc, m) => acc + m.netPl, 0);
  const totalTrades = months.reduce((acc, m) => acc + m.trades, 0);

  const anyRealCapital = months.some(m => m.capitalIsReal);
  if (!anyRealCapital) {
    return {
      year: String(selectedYear),
      capitalIsReal: false,
      startingCapital: null,
      totalAdded: Math.round(totalAdded * 100) / 100,
      totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
      netCapitalChange: Math.round(netCapitalChange * 100) / 100,
      totalNetPl: Math.round(totalNetPl * 100) / 100,
      endingCapital: null,
      peakCapital: null,
      totalTrades,
      annualizedCagr: null,
      totalCompounded: null,
      monthlyAvgReturn: null,
      cumulativeMultiplier: 1.0,
      preTaxAnnualizedCagr: null,
      preTaxTotalCompounded: null,
      preTaxMonthlyAvgReturn: null,
      preTaxCumulativeMultiplier: 1.0,
      months,
      activeMonths
    };
  }
  
  let startingCapital = 0;
  const firstActiveMonth = activeMonths[0] || months[0];
  if (firstActiveMonth) {
    startingCapital = firstActiveMonth.startingCapital;
  }
  
  let endingCapital = startingCapital;
  for (let i = months.length - 1; i >= 0; i--) {
    if (months[i].finalCapital !== 0 || months[i].trades > 0 || months[i].added > 0) {
      endingCapital = months[i].finalCapital;
      break;
    }
  }

  let peakCapital = 0;
  months.forEach(m => {
    if (m.finalCapital > peakCapital) peakCapital = m.finalCapital;
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const numYear = parseInt(selectedYear, 10) || 2026;
  const maxElapsedMonthIdx = numYear < currentYear ? 11 : (numYear === currentYear ? currentMonth : -1);

  // Period months for elapsed year
  const elapsedMonths = maxElapsedMonthIdx >= 0 ? months.filter(m => m.monthIdx <= maxElapsedMonthIdx) : [];
  const u = elapsedMonths.length;

  // Post-tax metrics
  const finalMultiplier = elapsedMonths.length > 0 ? elapsedMonths[elapsedMonths.length - 1].cumulativeMultiplier : 1.0;
  const totalCompounded = (finalMultiplier - 1) * 100;
  const monthlyAvgReturn = u > 0 ? (Math.pow(Math.max(0, finalMultiplier), 1 / u) - 1) * 100 : 0;
  const annualizedCagr = u > 0 ? (Math.pow(Math.max(0, finalMultiplier), 12 / u) - 1) * 100 : 0;

  // Pre-tax metrics (for Pre-Tax toggle)
  const preTaxFinalMultiplier = elapsedMonths.length > 0 ? elapsedMonths[elapsedMonths.length - 1].preTaxCumulativeMultiplier : 1.0;
  const preTaxTotalCompounded = (preTaxFinalMultiplier - 1) * 100;
  const preTaxMonthlyAvgReturn = u > 0 ? (Math.pow(Math.max(0, preTaxFinalMultiplier), 1 / u) - 1) * 100 : 0;
  const preTaxAnnualizedCagr = u > 0 ? (Math.pow(Math.max(0, preTaxFinalMultiplier), 12 / u) - 1) * 100 : 0;

  return {
    year: String(selectedYear),
    startingCapital: Math.round(startingCapital * 100) / 100,
    totalAdded: Math.round(totalAdded * 100) / 100,
    totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
    netCapitalChange: Math.round(netCapitalChange * 100) / 100,
    totalNetPl: Math.round(totalNetPl * 100) / 100,
    endingCapital: Math.round(endingCapital * 100) / 100,
    peakCapital: Math.round(peakCapital * 100) / 100,
    totalTrades,
    annualizedCagr: Math.round(annualizedCagr * 100) / 100,
    totalCompounded: Math.round(totalCompounded * 100) / 100,
    monthlyAvgReturn: Math.round(monthlyAvgReturn * 100) / 100,
    cumulativeMultiplier: Math.round(finalMultiplier * 1000) / 1000,
    preTaxAnnualizedCagr: Math.round(preTaxAnnualizedCagr * 100) / 100,
    preTaxTotalCompounded: Math.round(preTaxTotalCompounded * 100) / 100,
    preTaxMonthlyAvgReturn: Math.round(preTaxMonthlyAvgReturn * 100) / 100,
    preTaxCumulativeMultiplier: Math.round(preTaxFinalMultiplier * 1000) / 1000,
    months,
    activeMonths
  };
}

/**
 * Scan trades and storage to return all active years
 */
export function getAvailableFundYears(trades = [], activePortfolioId = 'portfolio-default') {
  const yearsSet = new Set();
  const presentYear = new Date().getFullYear();
  yearsSet.add(String(presentYear));
  yearsSet.add(String(presentYear + 1));

  if (Array.isArray(trades)) {
    trades.forEach(t => {
      if (!t) return;
      const dateCandidates = [t.date, t.entryDate, t.exitDate, t.p1Date, t.e1Date];
      dateCandidates.forEach(dStr => {
        if (!dStr) return;
        const parsed = parseMonthAndYear(String(dStr));
        if (parsed?.year && parsed.year >= 2000 && parsed.year <= 2100) {
          yearsSet.add(String(parsed.year));
        }
      });
    });
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('monthly_capital') || key.includes('capital_changes'))) {
        const match = key.match(/(20\d\d)/);
        if (match) yearsSet.add(match[1]);
      }
    }
  } catch {}

  return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
}

/**
 * Formats fund management performance matrix for Foxy AI
 */
export function formatFundManagementForFoxy(fundSummary) {
  const {
    year,
    startingCapital,
    totalAdded,
    totalWithdrawn,
    netCapitalChange,
    totalNetPl,
    endingCapital,
    peakCapital,
    totalTrades,
    annualizedCagr,
    cumulativeMultiplier,
    activeMonths
  } = fundSummary;

  let out = `### FUND MANAGEMENT BREAKDOWN (${year})\n`;
  out += `[METRIC: Starting Capital | ₹${Math.round(startingCapital).toLocaleString('en-IN')} | blue]\n`;
  out += `[METRIC: Total Deposited | +₹${Math.round(totalAdded).toLocaleString('en-IN')} | green]\n`;
  out += `[METRIC: Total Withdrawn | -₹${Math.round(totalWithdrawn).toLocaleString('en-IN')} | orange]\n`;
  out += `[METRIC: Ending Balance | ₹${Math.round(endingCapital).toLocaleString('en-IN')} | ${endingCapital >= startingCapital ? 'green' : 'red'}]\n\n`;

  out += `#### Key Performance & Capital Metrics:\n`;
  out += `• **Net Realized P/L for ${year}**: ${totalNetPl >= 0 ? '+' : ''}₹${Math.round(totalNetPl).toLocaleString('en-IN')}\n`;
  out += `• **Net Capital Infusion**: ${netCapitalChange >= 0 ? '+' : ''}₹${Math.round(netCapitalChange).toLocaleString('en-IN')}\n`;
  out += `• **Peak Portfolio Value**: ₹${Math.round(peakCapital).toLocaleString('en-IN')}\n`;
  out += `• **Total Closed Trades**: ${totalTrades}\n`;
  out += `• **Compounded Multiplier**: ${cumulativeMultiplier}x\n`;
  if (annualizedCagr !== 0) {
    out += `• **Annualized CAGR**: ${annualizedCagr}%\n`;
  }
  if (startingCapital === 0 && totalAdded === 0) {
    out += `• **Base Capital Advisory**: No initial deposit has been recorded in the Fund Management tab (Base Capital: ₹0). All growth is compounded from ₹0 initial deposit + accumulated trade P/L. To track realistic portfolio percentage returns, enter your starting capital in the Fund Management tab.\n`;
  }
  out += `\n`;

  if (activeMonths && activeMonths.length > 0) {
    const tableHeaders = 'Month,Start Cap,Added,Withdrawn,Net P/L,% Return,End Cap,Trades,Win Rate %';
    const tableRows = activeMonths.map(m => {
      const plSign = m.netPl >= 0 ? '▲ +' : '▼ -';
      const pctSign = m.pctPl >= 0 ? '+' : '';
      const pctReturnFormatted = m.startingCapital > 0 ? `${pctSign}${m.pctPl}%` : '-';
      return `${m.month},₹${Math.round(m.startingCapital).toLocaleString('en-IN')},₹${Math.round(m.added).toLocaleString('en-IN')},₹${Math.round(m.withdrawn).toLocaleString('en-IN')},${plSign}₹${Math.round(Math.abs(m.netPl)).toLocaleString('en-IN')},${pctReturnFormatted},₹${Math.round(m.finalCapital).toLocaleString('en-IN')},${m.trades},${Math.round(m.winPct)}%`;
    }).join(' | ');
    out += `[TABLE: ${tableHeaders} | ${tableRows}]\n`;
  }

  return out;
}

/**
 * Institutional Dynamic Portfolio Capital Resolver for FoxTrade.
 *
 * Formula:
 * Capital = Base Capital + Deposits - Withdrawals + Realized P&L (up to today)
 *
 * - Deposits and withdrawals come from the Fund Management ledger (capitalChanges).
 * - Realized P&L includes the current month and live closed/partial trades up to today.
 * - Guards against Capital <= 0 by returning 0 (never NaN or Infinity).
 * - Fallback when no ledger entries exist: Base Capital + Realized P&L.
 *
 * @param {Object|Array} optionsOrTrades Options object or trades array
 * @param {number} [maybeBaseCapital=0] Base capital if positional args used
 * @param {Object} [maybeCapitalChanges=null] Capital changes if positional args used
 * @returns {number} Active dynamic capital (rounded to 2 decimal places, or 0 if <= 0)
 */
export function getCapital(optionsOrTrades = {}, maybeBaseCapital = 0, maybeCapitalChanges = null) {
  let trades = [];
  let baseCapital = 0;
  let capitalChanges = null;
  let explicitRealizedPnl = null;
  let portfolioId = 'portfolio-default';
  let year = '2026';

  if (optionsOrTrades && typeof optionsOrTrades === 'object' && !Array.isArray(optionsOrTrades)) {
    trades = optionsOrTrades.trades || [];
    baseCapital = Number(optionsOrTrades.baseCapital || 0);
    capitalChanges = optionsOrTrades.capitalChanges ?? optionsOrTrades.ledger ?? null;
    explicitRealizedPnl = optionsOrTrades.realizedPnl !== undefined && optionsOrTrades.realizedPnl !== null
      ? Number(optionsOrTrades.realizedPnl)
      : null;
    portfolioId = optionsOrTrades.portfolioId || 'portfolio-default';
    year = optionsOrTrades.year || '2026';
  } else {
    trades = Array.isArray(optionsOrTrades) ? optionsOrTrades : [];
    baseCapital = Number(maybeBaseCapital || 0);
    capitalChanges = maybeCapitalChanges;
  }

  // 1. First priority: Check exact live capital from Fund Management monthly performance engine
  if (!(baseCapital > 0)) {
    try {
      const activeYear = String(year || '2026');
      const activePfId = portfolioId || 'portfolio-default';
      const capChanges = capitalChanges || (typeof localStorage !== 'undefined' ? getStoredCapitalChanges(activePfId, activeYear) : null);
      const activeFundCap = getActivePortfolioCapital(trades, capChanges, activeYear, null, {
        portfolioId: activePfId,
        allTrades: trades
      });
      if (activeFundCap > 0) {
        return Math.round(activeFundCap * 100) / 100;
      }
    } catch (_) {}
  }

  // 2. Resolve Base Capital fallback if baseCapital is not provided / <= 0
  if (!(baseCapital > 0)) {
    try {
      const activePfId = portfolioId || (typeof localStorage !== 'undefined' && localStorage.getItem('tradeontip_active_portfolio_id')) || 'portfolio-default';
      // 1. Check portfolio-specific base capital first
      if (typeof localStorage !== 'undefined') {
        const pfSaved = Number(localStorage.getItem(`tradeontip_base_capital_${activePfId}`) || 0);
        if (pfSaved > 0) baseCapital = pfSaved;
      }
      // 2. Check portfolio entry in tradeontip_portfolios
      if (!(baseCapital > 0)) {
        const rawPortfolios = typeof localStorage !== 'undefined' ? localStorage.getItem('tradeontip_portfolios') : null;
        if (rawPortfolios) {
          const pfs = JSON.parse(rawPortfolios);
          const match = Array.isArray(pfs) ? pfs.find(p => p.id === activePfId) : null;
          if (match && Number(match.baseCapital) > 0) {
            baseCapital = Number(match.baseCapital);
          }
        }
      }

    } catch (_) {}
  }

  // Fallback default if still not determined
  if (!(baseCapital > 0)) {
    baseCapital = 0;
  }

  // 2. Resolve Deposits and Withdrawals from Fund Management ledger
  let deposits = 0;
  let withdrawals = 0;

  let ledgerData = capitalChanges;
  if (!ledgerData && typeof localStorage !== 'undefined') {
    try {
      ledgerData = getStoredCapitalChanges(portfolioId, String(year));
    } catch (_) {}
  }

  if (ledgerData && typeof ledgerData === 'object') {
    const entries = Array.isArray(ledgerData) ? ledgerData : Object.values(ledgerData);
    entries.forEach(entry => {
      if (!entry || typeof entry !== 'object') return;
      const add = Number(entry.added || entry.deposit || 0);
      const w = Number(entry.withdrawn || entry.withdrawal || 0);
      if (add > 0) deposits += add;
      if (w > 0) withdrawals += w;
    });

    // If baseCapital was already derived from or matches the initial deposit/added capital,
    // do not double-count that initial deposit into the deposits sum.
    if (baseCapital > 0 && deposits > 0) {
      const firstAddEntry = entries.find(e => Number(e?.added || e?.deposit || 0) > 0);
      const firstAdd = Number(firstAddEntry?.added || firstAddEntry?.deposit || 0);
      if (firstAdd > 0 && Math.abs(firstAdd - baseCapital) < 0.01) {
        deposits -= firstAdd;
      }
    }
  }

  // 3. Resolve Realized P&L (up to today, including current month)
  let totalRealizedPnl = 0;
  if (explicitRealizedPnl !== null && !isNaN(explicitRealizedPnl)) {
    totalRealizedPnl = explicitRealizedPnl;
  } else if (Array.isArray(trades) && trades.length > 0) {
    const realizedPaise = trades.reduce((sum, t) => {
      if (!t) return sum;
      const st = String(t.status || t.positionStatus || '').toLowerCase();
      const exitedQty = Number(t.exitedQty || 0);
      const rawPl = t.grossRealizedPL ?? t.grossPnl ?? t.realisedAmount ?? t.pl ?? t.pnl;
      if (st === 'closed' || st === 'partial' || exitedQty > 0 || (rawPl !== undefined && rawPl !== null && Number(rawPl) !== 0)) {
        return sum + toPaise(rawPl || 0);
      }
      return sum;
    }, 0);
    totalRealizedPnl = fromPaise(realizedPaise);
  }

  // 4. Compute Capital
  // Formula: Capital = Base Capital + Deposits - Withdrawals + Realized P&L
  // Fallback if no ledger entries exist: Deposits=0, Withdrawals=0 -> Base Capital + Realized P&L
  const computedCapital = baseCapital + deposits - withdrawals + totalRealizedPnl;

  // 5. Zero-capital & negative guard: return 0, never NaN or Infinity
  if (!isFinite(computedCapital) || computedCapital <= 0) {
    return 0;
  }

  return Math.round(computedCapital * 100) / 100;
}

/**
 * Calculates % Invested using shared getCapital denominator
 * % Invested = sum(Qopen_i x Pentry_i) / Capital x 100
 * Guard Capital <= 0: return 0
 *
 * @param {Array} openTrades Array of open / partial trades
 * @param {number} capital Active capital denominator
 * @returns {number} Percentage invested (e.g. 40.0)
 */
export function calculatePercentInvested(openTrades = [], capital = 0) {
  const cap = Number(capital || 0);
  if (!isFinite(cap) || cap <= 0) return 0;

  const totalOpenCost = (openTrades || []).reduce((sum, t) => {
    if (!t) return sum;
    const openQty = Number(t.openQty || (String(t.status || t.positionStatus).toLowerCase() === 'open' ? t.qty : 0) || 0);
    const entryPrice = Number(t.avgEntry || t.entry || 0);
    return sum + (openQty * entryPrice);
  }, 0);

  return Math.round(((totalOpenCost / cap) * 100) * 100) / 100;
}

/**
 * Calculates Portfolio Impact % using shared getCapital denominator
 * Portfolio Impact = Realized P&L / Capital x 100
 * Guard Capital <= 0: return 0
 *
 * @param {number} realizedPnl Realized P&L in Rupees
 * @param {number} capital Active capital denominator
 * @returns {number} Portfolio Impact % (e.g. 1.5)
 */
export function calculatePortfolioImpact(realizedPnl = 0, capital = 0) {
  const cap = Number(capital || 0);
  if (!isFinite(cap) || cap <= 0) return 0;
  const pnl = Number(realizedPnl || 0);
  if (pnl === 0) return 0;
  return Math.round(((pnl / cap) * 100) * 100) / 100;
}

/**
 * Resolves the starting capital basis for equity curve / drawdown calculations.
 * Reflects real money contributions (opening balance + deposits - withdrawals), excluding accumulated P&L.
 *
 * @param {Array} trades
 * @param {Object} capitalChanges
 * @param {string} selectedYear
 * @param {Object} options
 * @returns {number|null} starting capital basis > 0, or null if unconfigured
 */
export function getStartingCapitalBasis(trades = [], capitalChanges = {}, selectedYear = '2026', options = {}) {
  const months = calculateMonthlyPerformance(trades, capitalChanges, selectedYear, options);
  const firstReal = months.find(m => m.capitalIsReal && m.startingCapital > 0);
  return firstReal ? firstReal.startingCapital : null;
}


