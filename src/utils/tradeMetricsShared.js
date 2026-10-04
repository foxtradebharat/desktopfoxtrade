/**
 * tradeMetricsShared.js
 * Pure functions for calculation of trade metrics (PnL, R, win/loss stats, Sharpe, etc.)
 * Strictly free of React, localStorage, and DOM dependencies for use in both frontend and Node.
 */

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const sum = (arr) => arr.reduce((a, b) => a + b, 0);

// D1: single P&L accessor. Do not read t.pnl / t.pl / t.activePnl directly in metric code.
export const getTradePnl = (t) => {
  if (!t) return 0;
  return num(t.netPnl ?? t.pnl ?? t.pl);
};

// Status-only helpers. Enriched trades always carry status ('Open'|'Partial'|'Closed').
export const isClosedTrade = (t) =>
  String(t?.status || t?.positionStatus || '').toLowerCase() === 'closed';

export const isPartialTrade = (t) =>
  String(t?.status || t?.positionStatus || '').toLowerCase() === 'partial';

// One R accessor. Returns null when no usable value.
export function getR(t) {
  if (!t) return null;
  for (const v of [t.weightedRR, t.rewardRisk, t.rr]) {
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Single source of truth for closed trades performance metrics.
 * Fix 4.1: Harmonized across Analytics and Deep Analytics pages.
 */
export function computeClosedMetrics(trades) {
  if (!Array.isArray(trades)) {
    return {
      closedCount: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      grossWin: 0,
      grossLoss: 0,
      avgWin: 0,
      avgLoss: 0,
      expectancy: 0,
      profitFactor: null,
      highestR: 0,
      highestRTrade: null,
      lowestR: 0,
      lowestRTrade: null,
      avgR: 0,
    };
  }

  const closed = trades.filter(isClosedTrade);
  const pnl = closed.map(getTradePnl);
  const wins = pnl.filter(p => p > 0);
  const losses = pnl.filter(p => p < 0);
  const grossWin = sum(wins);
  const grossLoss = Math.abs(sum(losses));
  const n = closed.length;
  const decided = wins.length + losses.length;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;

  // D3: expectancy per closed trade; equals sum(pnl) / n
  const expectancy = n ? (wins.length / n) * avgWin - (losses.length / n) * avgLoss : 0;

  // D4: Profit factor when there are no losses is null ("∞"), not sentinel numbers (99.9 or 9.99)
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? null : 0);

  const rs = closed.map(t => ({ t, r: getR(t) })).filter(x => x.r !== null);
  const best = rs.reduce((a, b) => (a === null || b.r > a.r ? b : a), null);
  const worst = rs.reduce((a, b) => (a === null || b.r < a.r ? b : a), null);

  return {
    closedCount: n,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: decided ? (wins.length / decided) * 100 : 0,
    grossWin,
    grossLoss,
    avgWin,
    avgLoss,
    expectancy,
    profitFactor,
    highestR: best ? best.r : 0,
    highestRTrade: best ? best.t : null,
    lowestR: worst ? worst.r : 0,
    lowestRTrade: worst ? worst.t : null,
    avgR: rs.length ? sum(rs.map(x => x.r)) / rs.length : 0,
  };
}

// D2: partial exits reported separately, never mixed into closed metrics
export function computePartialSummary(trades) {
  if (!Array.isArray(trades)) return { count: 0, realizedPnl: 0 };
  const partial = trades.filter(isPartialTrade);
  return {
    count: partial.length,
    realizedPnl: sum(partial.map(getTradePnl))
  };
}

export const RISK_FREE_ANNUAL = 0.065; // D7 (RBI 91-day T-Bill baseline approx ~6.5%)

/**
 * Sharpe Ratio computation based on portfolio daily returns across trading calendar days.
 * Fix 5.1
 */
export function computeSharpe(events, startingCapital, calendarDays, rfAnnual = RISK_FREE_ANNUAL) {
  if (!(startingCapital > 0)) return { available: false, reason: 'no_capital' };
  if (!Array.isArray(events) || !Array.isArray(calendarDays) || calendarDays.length === 0) {
    return { available: false, reason: 'insufficient_days' };
  }

  const byDay = new Map();
  for (const e of events) {
    if (e && e.dayKey) {
      // Sum rupees, not percentages
      byDay.set(e.dayKey, (byDay.get(e.dayKey) || 0) + (Number(e.pnl) || 0));
    }
  }

  const rfDaily = Math.pow(1 + rfAnnual, 1 / 252) - 1;
  let cum = 0;
  const excess = [];

  for (const d of calendarDays) {
    const dayPnl = byDay.get(d) || 0;
    const equityStart = startingCapital + cum;
    if (equityStart <= 0) {
      excess.push(-rfDaily);
    } else {
      excess.push(dayPnl / equityStart - rfDaily);
    }
    cum += dayPnl;
  }

  if (excess.length < 20) {
    return { available: false, reason: 'insufficient_days', days: excess.length };
  }

  const mean = sum(excess) / excess.length;
  const variance = sum(excess.map(x => (x - mean) ** 2)) / (excess.length - 1); // Bessel correction (N - 1)
  const sd = Math.sqrt(variance);

  if (!(sd > 0)) {
    return { available: false, reason: 'zero_variance' };
  }

  return {
    available: true,
    sharpe: (mean / sd) * Math.sqrt(252),
    days: excess.length,
    meanDailyReturn: mean,
    dailySd: sd
  };
}
