// Full Dynamic Fund Management & Portfolio Capital Calculation Engine
// 100% Mathematical & Data-driven parity with Nexus Journal

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function getStoredCapitalChanges(portfolioId = 'portfolio-default', year = '2026') {
  try {
    const key = `tradeontip_monthly_capital_${portfolioId}_${year}`;
    const fallbackKey = `tradeontip_monthly_capital_${year}`;
    const saved = localStorage.getItem(key) || localStorage.getItem(fallbackKey);
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
    localStorage.setItem(`tradeontip_monthly_capital_${year}`, JSON.stringify(data));

    // Also derive and sync tradeontip_base_capital with Fund Management additions
    let initialAdded = 0;
    for (let m = 0; m < 12; m++) {
      const added = Number(data[m]?.added || 0);
      if (added > 0) {
        initialAdded = added;
        break;
      }
    }
    localStorage.setItem('tradeontip_base_capital', String(initialAdded));

    window.dispatchEvent(new CustomEvent('tradeontip_capital_updated', { detail: { portfolioId, year, data, baseCapital: initialAdded } }));
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

import { matchLots } from './nexusCalculationEngine.js';

/**
 * Calculates dynamic month-by-month compounding performance matrix matching Nexus Journal
 */
export function calculateMonthlyPerformance(trades = [], capitalChanges = {}, selectedYear = '2026') {
  let runningCapital = 0;
  let cumulativeMultiplier = 1.0;
  let firstTradeMonthIdx = -1;
  let latestTradeMonthIdx = -1;
  const numYear = parseInt(selectedYear, 10) || 2026;

  // Compute each trade's exit contributions by month dynamically
  const monthlyTradeStats = {};

  trades.forEach(t => {
    const side = (t.type || t.side || 'Buy');
    const isSell = String(side).toLowerCase() === 'sell';

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

    // Collect Exit Legs
    const exitLots = [
      { id: 'e1', price: parseFloat(t.e1Price) || 0, qty: parseFloat(t.e1Qty) || 0, date: t.e1Date },
      { id: 'e2', price: parseFloat(t.e2Price) || 0, qty: parseFloat(t.e2Qty) || 0, date: t.e2Date },
      { id: 'e3', price: parseFloat(t.e3Price) || 0, qty: parseFloat(t.e3Qty) || 0, date: t.e3Date },
      { id: 'e4', price: parseFloat(t.e4Price) || 0, qty: parseFloat(t.e4Qty) || 0, date: t.e4Date },
    ].filter(l => l.qty > 0 && l.price > 0 && l.date);

    if (exitLots.length > 0 && entryLots.length > 0) {
      const { matches } = matchLots(entryLots, exitLots, 'fifo', side);

      // Group matched realized P/L by exit month
      const matchesByMonth = {};
      matches.forEach(m => {
        const d = parseMonthAndYear(m.exitDate || t.date);
        if (d && d.year === numYear) {
          if (!matchesByMonth[d.month]) {
            matchesByMonth[d.month] = { netPl: 0, count: 0, gains: [], lossVals: [] };
          }
          matchesByMonth[d.month].netPl += m.pl;
          matchesByMonth[d.month].count += 1;
        }
      });

      Object.entries(matchesByMonth).forEach(([mIdxStr, monthData]) => {
        const mIdx = parseInt(mIdxStr, 10);
        if (firstTradeMonthIdx === -1 || mIdx < firstTradeMonthIdx) firstTradeMonthIdx = mIdx;
        if (mIdx > latestTradeMonthIdx) latestTradeMonthIdx = mIdx;

        if (!monthlyTradeStats[mIdx]) {
          monthlyTradeStats[mIdx] = { netPl: 0, trades: 0, wins: 0, losses: 0, gains: [], lossVals: [], rrList: [], holdingDays: [] };
        }

        monthlyTradeStats[mIdx].netPl += monthData.netPl;
        monthlyTradeStats[mIdx].trades += 1; // count trade once per month it exits in

        if (monthData.netPl > 0) {
          monthlyTradeStats[mIdx].wins += 1;
          const avgEntry = parseFloat(t.avgEntry || t.entry) || 0;
          const avgExitPrice = parseFloat(t.avgExitPrice) || 0;
          const movePct = avgEntry > 0 ? Math.abs((avgExitPrice - avgEntry) / avgEntry * 100) : 0;
          monthlyTradeStats[mIdx].gains.push(movePct);
        } else if (monthData.netPl < 0) {
          monthlyTradeStats[mIdx].losses += 1;
          const avgEntry = parseFloat(t.avgEntry || t.entry) || 0;
          const avgExitPrice = parseFloat(t.avgExitPrice) || 0;
          const movePct = avgEntry > 0 ? Math.abs((avgExitPrice - avgEntry) / avgEntry * 100) : 0;
          monthlyTradeStats[mIdx].lossVals.push(movePct);
        }

        if (t.rewardRisk !== undefined && t.rewardRisk !== null && t.rewardRisk !== '' && !isNaN(parseFloat(t.rewardRisk))) {
          monthlyTradeStats[mIdx].rrList.push(parseFloat(t.rewardRisk));
        }
        if (t.holdingDays !== undefined && t.holdingDays !== null && t.holdingDays !== '' && !isNaN(parseInt(t.holdingDays, 10))) {
          monthlyTradeStats[mIdx].holdingDays.push(parseInt(t.holdingDays, 10));
        }
      });
    } else if (t.status === 'Closed' && (t.pnl !== undefined || t.avgExitPrice !== undefined)) {
      // Fallback: no exit leg data — use stored pnl and exitDate
      const d = parseMonthAndYear(t.exitDate || t.date);
      if (d && d.year === numYear) {
        const mIdx = d.month;
        if (firstTradeMonthIdx === -1 || mIdx < firstTradeMonthIdx) firstTradeMonthIdx = mIdx;
        if (mIdx > latestTradeMonthIdx) latestTradeMonthIdx = mIdx;

        if (!monthlyTradeStats[mIdx]) {
          monthlyTradeStats[mIdx] = { netPl: 0, trades: 0, wins: 0, losses: 0, gains: [], lossVals: [], rrList: [], holdingDays: [] };
        }
        const tradePl = (t.pnl !== undefined && t.pnl !== null && !isNaN(parseFloat(t.pnl))) ? parseFloat(t.pnl) : 0;
        monthlyTradeStats[mIdx].netPl += tradePl;
        monthlyTradeStats[mIdx].trades += 1;

        // P/L Method: breakeven excluded from win/loss decided count (same as stat card)
        if (tradePl > 0) {
          monthlyTradeStats[mIdx].wins += 1;
          if (t.stockMove !== undefined && t.stockMove !== null && t.stockMove !== '' && !isNaN(parseFloat(t.stockMove))) {
            monthlyTradeStats[mIdx].gains.push(Math.abs(parseFloat(t.stockMove)));
          }
        } else if (tradePl < 0) {
          monthlyTradeStats[mIdx].losses += 1;
          if (t.stockMove !== undefined && t.stockMove !== null && t.stockMove !== '' && !isNaN(parseFloat(t.stockMove))) {
            monthlyTradeStats[mIdx].lossVals.push(Math.abs(parseFloat(t.stockMove)));
          }
        }
        // Breakeven: tradePl === 0 → not counted in wins/losses/gains/lossVals

        if (t.rewardRisk !== undefined && t.rewardRisk !== null && t.rewardRisk !== '' && !isNaN(parseFloat(t.rewardRisk))) {
          monthlyTradeStats[mIdx].rrList.push(parseFloat(t.rewardRisk));
        }
        if (t.holdingDays !== undefined && t.holdingDays !== null && t.holdingDays !== '' && !isNaN(parseInt(t.holdingDays, 10))) {
          monthlyTradeStats[mIdx].holdingDays.push(parseInt(t.holdingDays, 10));
        }
      }
    }
  });

  return MONTH_NAMES.map((month, idx) => {
    const added = parseFloat(capitalChanges[idx]?.added) || 0;
    const addedNotes = capitalChanges[idx]?.addedNotes || '';
    const withdrawn = parseFloat(capitalChanges[idx]?.withdrawn) || 0;
    const withdrawnNotes = capitalChanges[idx]?.withdrawnNotes || '';

    const stats = monthlyTradeStats[idx] || { netPl: 0, trades: 0, wins: 0, losses: 0, gains: [], lossVals: [], rrList: [], holdingDays: [] };
    const netPl = Math.round(stats.netPl * 100) / 100;
    const tradeCount = stats.trades;
    const decided = stats.wins + stats.losses;
    const winPct = decided > 0 ? (stats.wins / decided) * 100 : 0;
    const avgGainPct = stats.gains.length > 0 ? stats.gains.reduce((a, b) => a + b, 0) / stats.gains.length : 0;
    const avgLossPct = stats.lossVals.length > 0 ? stats.lossVals.reduce((a, b) => a + b, 0) / stats.lossVals.length : 0;
    const avgRR = stats.rrList.length > 0 ? stats.rrList.reduce((a, b) => a + b, 0) / stats.rrList.length : 0;
    const avgDays = stats.holdingDays.length > 0 ? Math.round(stats.holdingDays.reduce((a, b) => a + b, 0) / stats.holdingDays.length) : 0;

    // Capital Rollover & Compounding:
    let startingCapital = runningCapital;
    if (idx === 0) {
      startingCapital = added - withdrawn;
      runningCapital = startingCapital;
    } else {
      startingCapital = runningCapital + added - withdrawn;
      runningCapital = startingCapital;
    }

    const finalCapital = startingCapital + netPl;
    runningCapital = finalCapital;

    const pctPl = startingCapital > 0 && netPl !== 0 ? (netPl / startingCapital) * 100 : 0;

    // Compounded Multiplier:
    if (startingCapital > 0 && netPl !== 0) {
      cumulativeMultiplier *= (1 + netPl / startingCapital);
    }

    // Exact Nexus Annualized CAGR Formula:
    let cagr = 0;
    if (firstTradeMonthIdx !== -1 && idx >= firstTradeMonthIdx && idx <= latestTradeMonthIdx) {
      const elapsedYears = (idx + 1) / 12;
      if (elapsedYears > 0) {
        if (cumulativeMultiplier >= 0) {
          cagr = (Math.pow(cumulativeMultiplier, 1 / elapsedYears) - 1) * 100;
        } else {
          cagr = -((Math.pow(Math.abs(cumulativeMultiplier), 1 / elapsedYears) - 1) * 100);
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
      startingCapital,
      netPl,
      pctPl,
      finalCapital,
      trades: tradeCount,
      winPct,
      avgGainPct,
      avgLossPct,
      avgRR,
      avgDays,
      cagr,
      cumulativeMultiplier
    };
  });
}

/**
 * Returns the active portfolio capital to use in the Journal StatCards
 */
export function getActivePortfolioCapital(trades = [], capitalChanges = {}, selectedYear = '2026', targetMonthIdx = 7) {
  const monthlyData = calculateMonthlyPerformance(trades, capitalChanges, selectedYear);
  
  // Current active month starting capital (August 2026)
  const currentMonthData = monthlyData[targetMonthIdx] || monthlyData[monthlyData.length - 1];
  if (currentMonthData && currentMonthData.startingCapital > 0) {
    return currentMonthData.startingCapital;
  }

  for (let i = targetMonthIdx; i >= 0; i--) {
    if (monthlyData[i]?.finalCapital > 0) return monthlyData[i].finalCapital;
  }

  return 0;
}
