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

export function parseTradeDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const s = String(val).trim();
  if (!s) return null;

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymd = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Returns latest exit date for a realized trade, or trade date if not exited yet.
 */
export function getEffectiveTradeDate(t) {
  if (!t) return null;
  const exits = [
    { d: t.e5Date, q: Number(t.e5Qty || 0) },
    { d: t.e4Date, q: Number(t.e4Qty || 0) },
    { d: t.e3Date, q: Number(t.e3Qty || 0) },
    { d: t.e2Date, q: Number(t.e2Qty || 0) },
    { d: t.e1Date, q: Number(t.e1Qty || 0) },
  ].filter(e => e.d && e.q > 0);

  if (exits.length > 0) {
    exits.sort((a, b) => {
      const da = parseTradeDate(a.d)?.getTime() || 0;
      const db = parseTradeDate(b.d)?.getTime() || 0;
      return db - da; // latest exit leg
    });
    return parseTradeDate(exits[0].d);
  }
  if (t.exitDate && (Number(t.exitedQty) > 0 || isClosedTrade(t))) {
    return parseTradeDate(t.exitDate);
  }
  return parseTradeDate(t.date || t.entryDate);
}

/**
 * Returns latest exit date for trades with realized exits.
 * Unlike getEffectiveTradeDate, does NOT fall back to entry date for open trades.
 * Returns null if trade has no exit legs / no exited quantity.
 */
export function getRealizedExitDate(t) {
  if (!t) return null;
  // Strictly realized trades only: Open trades never return an exit date
  if (!isClosedTrade(t) && !(isPartialTrade(t) && Number(t.exitedQty) > 0)) {
    return null;
  }
  const exits = [
    { d: t.e4Date, q: Number(t.e4Qty || 0) },
    { d: t.e3Date, q: Number(t.e3Qty || 0) },
    { d: t.e2Date, q: Number(t.e2Qty || 0) },
    { d: t.e1Date, q: Number(t.e1Qty || 0) },
  ].filter(e => e.d && e.q > 0);

  if (exits.length > 0) {
    exits.sort((a, b) => {
      const da = parseTradeDate(a.d)?.getTime() || 0;
      const db = parseTradeDate(b.d)?.getTime() || 0;
      return db - da;
    });
    return parseTradeDate(exits[0].d);
  }
  if (t.exitDate) {
    return parseTradeDate(t.exitDate);
  }
  if (isClosedTrade(t) && t.date) {
    return parseTradeDate(t.date);
  }
  return null;
}

export function toLocalDayKey(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Generates trading days between startDate and endDate (inclusive).
 * Excludes weekends (Sat, Sun) and NSE trading holidays if provided.
 *
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {Set<string>|Array<string>} [holidays] Optional holiday date strings ('YYYY-MM-DD')
 * @returns {string[]} sorted dayKeys ('YYYY-MM-DD')
 */
export function generateTradingCalendarDays(startDate, endDate, holidays = null) {
  if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return [];
  }
  const holidaySet = holidays instanceof Set ? holidays : new Set(Array.isArray(holidays) ? holidays : []);
  const days = [];
  const cur = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  while (cur <= end) {
    const dayOfWeek = cur.getDay(); // 0 = Sun, 6 = Sat
    const key = toLocalDayKey(cur);
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(key)) {
      days.push(key);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// D5: sort by effective exit date, tie-break tradeNo
export function sortTradesByEffectiveExitDate(trades = []) {
  return [...trades].sort((a, b) => {
    const da = getEffectiveTradeDate(a)?.getTime() || 0;
    const db = getEffectiveTradeDate(b)?.getTime() || 0;
    if (da !== db) return da - db;
    return (Number(a.tradeNo) || 0) - (Number(b.tradeNo) || 0);
  });
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

/**
 * Shared Indian Rupee NumberFormat instance with two decimal places.
 * Example: 1000000 -> 10,00,000.00
 */
export const indianRupeeFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/**
 * Formats rupee amount with strict Indian number grouping.
 */
export function formatDrawdownAmount(amt) {
  if (amt === null || amt === undefined || isNaN(amt)) return '—';
  return indianRupeeFormatter.format(Math.abs(Number(amt)));
}

/**
 * Formats drawdown percentage avoiding negative zero (-0.00 -> 0.00).
 */
export function formatDrawdownPct(x) {
  if (x === null || x === undefined || isNaN(x)) return '0.00';
  const numX = Number(x);
  const v = Number(numX.toFixed(2));
  return v === 0 ? '0.00' : v.toFixed(2);
}

/**
 * Shared realized exit event builder for drawdown analysis.
 * Strictly uses exit legs e1..e5 or exitDate.
 *
 * @param {Array} trades
 * @returns {{ events: Array<{ dayKey: string, pnl: number, tradeNo: any, symbol: string, date: Date, trade: any }>, excluded: Array<{ tradeNo: any, symbol: string, reason: string, trade: any }> }}
 */
export function buildRealizedEvents(trades = []) {
  if (!Array.isArray(trades)) return { events: [], excluded: [] };

  const events = [];
  const excluded = [];

  for (let idx = 0; idx < trades.length; idx++) {
    const t = trades[idx];
    if (!t) continue;

    const pnl = getTradePnl(t);
    const isClosed = isClosedTrade(t);
    const isPartialWithPnl = isPartialTrade(t) && pnl !== 0;

    if (!isClosed && !isPartialWithPnl) {
      continue;
    }

    const tradeNo = t.tradeNo ?? t.id ?? idx + 1;
    const symbol = t.symbol || t.name || '—';

    // Strict exit date lookup:
    // Latest exit leg among e1..e5 with qty > 0 and parseable date
    const exits = [
      { d: t.e1Date, q: Number(t.e1Qty || 0) },
      { d: t.e2Date, q: Number(t.e2Qty || 0) },
      { d: t.e3Date, q: Number(t.e3Qty || 0) },
      { d: t.e4Date, q: Number(t.e4Qty || 0) },
      { d: t.e5Date, q: Number(t.e5Qty || 0) },
    ]
      .filter(e => e.d && e.q > 0)
      .map(e => ({ date: parseTradeDate(e.d), q: e.q }))
      .filter(e => e.date !== null);

    let exitDate = null;
    if (exits.length > 0) {
      exits.sort((a, b) => b.date.getTime() - a.date.getTime());
      exitDate = exits[0].date;
    } else if (t.exitDate) {
      exitDate = parseTradeDate(t.exitDate);
    }

    if (!exitDate) {
      // Do NOT fall back to entry date, do NOT use time 0
      excluded.push({
        tradeNo,
        symbol,
        reason: 'Missing or invalid exit date',
        trade: t
      });
      continue;
    }

    const dayKey = toLocalDayKey(exitDate);

    events.push({
      dayKey,
      pnl,
      tradeNo,
      symbol,
      date: exitDate,
      trade: t
    });
  }

  // Sort events chronologically by exit date, tie-break tradeNo
  events.sort((a, b) => {
    const da = a.date.getTime();
    const db = b.date.getTime();
    if (da !== db) return da - db;
    return (Number(a.tradeNo) || 0) - (Number(b.tradeNo) || 0);
  });

  return { events, excluded };
}

