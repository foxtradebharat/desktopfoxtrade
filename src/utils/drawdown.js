/**
 * drawdown.js
 * Pure functions for drawdown calculations.
 * Divides drawdown shortfall by peak equity (startingCapital + peak cum PnL), not peak cumulative PnL.
 */

/**
 * Computes equity curve and drawdown metrics.
 * Note: Mid-period deposits and withdrawals are not modeled in this equity curve;
 * equity is tracked relative to startingCapital + cumulative realized PnL.
 *
 * @param {number[]} pnls - realized P&L per trade in chronological order (D1 basis, D5 ordering)
 * @param {number} startingCapital - real capital from Fund Management (base capital + net flows). Must be > 0.
 * @returns {object} drawdown result
 */
export function computeDrawdown(pnls, startingCapital) {
  if (!(startingCapital > 0) || !Array.isArray(pnls)) {
    return { available: false };
  }

  let equity = startingCapital;
  let peak = startingCapital;
  let maxPct = 0;
  let maxAmt = 0;
  const series = [];

  for (const p of pnls) {
    const val = Number(p) || 0;
    equity += val;
    if (equity > peak) peak = equity;
    const amt = equity - peak;      // <= 0
    const pct = peak > 0 ? (amt / peak) * 100 : 0; // <= 0
    if (pct < maxPct) maxPct = pct;
    if (amt < maxAmt) maxAmt = amt;
    series.push({ equity, peak, amt, pct });
  }

  const last = series[series.length - 1] || { equity: startingCapital, peak, amt: 0, pct: 0 };

  return {
    available: true,
    currentPct: last.pct,
    currentAmount: last.amt,
    maxPct,
    maxAmount: maxAmt,
    peakEquity: peak,
    equity: last.equity,
    series,
  };
}

function parseDayKeyToUtc(key) {
  if (!key) return null;
  const parts = String(key).split('-');
  if (parts.length === 3) {
    return Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  const d = new Date(key);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function daysDiff(key1, key2) {
  const t1 = parseDayKeyToUtc(key1);
  const t2 = parseDayKeyToUtc(key2);
  if (t1 === null || t2 === null) return 0;
  return Math.max(0, Math.round((t2 - t1) / 864e5));
}

/**
 * Computes daily cash-flow-adjusted drawdown series and underwater statistics.
 * Group events by dayKey. Walk every day that has a P&L or a flow in date order.
 *
 * @param {object} options
 * @param {Array<{ dayKey: string, pnl: number }>} [options.events=[]] Realized events
 * @param {Array<{ dayKey: string, amount: number }>} [options.flows=[]] Cash flows (deposits +, withdrawals -)
 * @param {number} [options.openingCapital=0] Starting capital
 * @returns {object} drawdown result
 */
export function computeDrawdownDaily({ events = [], flows = [], openingCapital = 0 } = {}) {
  const validFlows = Array.isArray(flows) ? flows : [];
  const totalDeposits = validFlows
    .filter(f => Number(f?.amount || 0) > 0)
    .reduce((sum, f) => sum + Number(f.amount), 0);
  const initialCap = Number(openingCapital) || 0;
  const approxFlowCount = validFlows.filter(f => Boolean(f?.dateApproximate)).length;

  if (initialCap <= 0 && totalDeposits <= 0) {
    return {
      available: false,
      currentPct: null,
      currentAmount: null,
      maxPct: null,
      maxAmount: null,
      peakEquity: null,
      equity: null,
      index: 1,
      peakIndex: 1,
      series: [],
      skippedDays: [],
      approxFlowCount,
      currentUnderwaterDays: 0,
      longestUnderwaterDays: 0,
      maxDrawdownPeakDate: null,
      maxDrawdownTroughDate: null,
      recoveryDate: null
    };
  }

  const dayPnlMap = new Map();
  for (const e of (Array.isArray(events) ? events : [])) {
    if (!e || !e.dayKey) continue;
    dayPnlMap.set(e.dayKey, (dayPnlMap.get(e.dayKey) || 0) + (Number(e.pnl) || 0));
  }

  const dayFlowMap = new Map();
  for (const f of validFlows) {
    if (!f || !f.dayKey) continue;
    dayFlowMap.set(f.dayKey, (dayFlowMap.get(f.dayKey) || 0) + (Number(f.amount) || 0));
  }

  const allDays = Array.from(new Set([...dayPnlMap.keys(), ...dayFlowMap.keys()])).sort();

  let equityPrev = initialCap;
  let indexPrev = 1;
  let peakIndex = 1;
  let peakEquity = initialCap;
  let peakDate = allDays[0] || null;
  let maxPct = 0;
  let maxAmt = 0;
  let maxDrawdownPeakDate = null;
  let maxDrawdownTroughDate = null;
  let recoveryDate = null;
  let longestUnderwaterDays = 0;
  let underwaterStartDate = null;
  const series = [];
  const skippedDays = [];

  for (const dayKey of allDays) {
    const flow = dayFlowMap.get(dayKey) || 0;
    const pnlDay = dayPnlMap.get(dayKey) || 0;
    const equityStart = equityPrev + flow;

    if (equityStart <= 0) {
      if (dayPnlMap.has(dayKey)) {
        skippedDays.push({ date: dayKey, pnl: pnlDay, reason: 'equity non-positive before P&L' });
      }
      // Equity stays as is
      continue;
    }

    const ret = pnlDay / equityStart;
    const index = indexPrev * (1 + ret);
    const equityEnd = equityStart + pnlDay;

    let pct = 0;
    let amt = 0;

    if (index >= peakIndex) {
      peakIndex = index;
      peakEquity = equityEnd;
      peakDate = dayKey;
      pct = 0;
      amt = 0;
      if (underwaterStartDate !== null) {
        const uw = daysDiff(underwaterStartDate, dayKey);
        if (uw > longestUnderwaterDays) longestUnderwaterDays = uw;
        underwaterStartDate = null;
      }
      if (maxDrawdownTroughDate !== null && recoveryDate === null) {
        recoveryDate = dayKey;
      }
    } else {
      pct = (index / peakIndex - 1) * 100;
      amt = equityEnd * (1 - peakIndex / index);
      if (underwaterStartDate === null) {
        underwaterStartDate = peakDate;
      }
      const uw = daysDiff(underwaterStartDate, dayKey);
      if (uw > longestUnderwaterDays) longestUnderwaterDays = uw;
    }

    if (pct < maxPct) {
      maxPct = pct;
      maxAmt = amt;
      maxDrawdownPeakDate = peakDate;
      maxDrawdownTroughDate = dayKey;
      recoveryDate = null;
    }

    series.push({
      date: dayKey,
      pnl: pnlDay,
      flow,
      equity: equityEnd,
      pct,
      amt
    });

    equityPrev = equityEnd;
    indexPrev = index;
  }

  if (series.length === 0) {
    return {
      available: true,
      currentPct: 0,
      currentAmount: 0,
      maxPct: 0,
      maxAmount: 0,
      peakEquity: initialCap,
      equity: initialCap,
      index: 1,
      peakIndex: 1,
      series: [],
      skippedDays,
      approxFlowCount,
      currentUnderwaterDays: 0,
      longestUnderwaterDays: 0,
      maxDrawdownPeakDate: null,
      maxDrawdownTroughDate: null,
      recoveryDate: null
    };
  }

  const last = series[series.length - 1];
  const currentUnderwaterDays = (last.pct < 0 && peakDate) ? daysDiff(peakDate, last.date) : 0;

  return {
    available: true,
    currentPct: last.pct,
    currentAmount: last.amt,
    maxPct,
    maxAmount: maxAmt,
    peakEquity,
    equity: last.equity,
    index: indexPrev,
    peakIndex,
    series,
    skippedDays,
    approxFlowCount,
    currentUnderwaterDays,
    longestUnderwaterDays,
    maxDrawdownPeakDate,
    maxDrawdownTroughDate,
    recoveryDate
  };
}

export const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Computes live drawdown considering open-position P&L.
 *
 * @param {object} options
 * @param {object} options.realized - Realized drawdown output (from computeDrawdownDaily or computeDrawdown)
 * @param {number} [options.unrealizedPnl=0] - Sum of unrealized P&L across priced open positions
 * @param {number} [options.unpricedCount=0] - Number of open positions with missing/zero/NaN CMP
 * @param {number} [options.pricedCount=0] - Number of open positions with valid CMP
 * @param {boolean} [options.hasPricedPositions] - Explicit flag indicating if priced positions exist
 * @param {Array} [options.pricedTrades=[]] - List of priced trade objects (optional)
 * @param {boolean} [options.isStale=false] - Whether any CMP price is stale or missing timestamp
 * @param {string|null} [options.oldestCmpUpdatedAt=null] - ISO timestamp of oldest price among priced positions
 * @returns {object|null} Live drawdown result, or null if no priced open positions exist
 */
export function liveDrawdown({
  realized,
  unrealizedPnl = 0,
  unpricedCount = 0,
  pricedCount = 0,
  hasPricedPositions,
  pricedTrades = [],
  isStale = false,
  oldestCmpUpdatedAt = null
} = {}) {
  if (!realized || realized.available === false) {
    return null;
  }

  const pricedExists = hasPricedPositions !== undefined
    ? Boolean(hasPricedPositions)
    : (pricedCount > 0 || (Array.isArray(pricedTrades) && pricedTrades.length > 0) || (unrealizedPnl !== 0 && unrealizedPnl !== null && !isNaN(unrealizedPnl)));

  if (!pricedExists) {
    return null;
  }

  let staleFlag = Boolean(isStale);
  let oldestTs = oldestCmpUpdatedAt;
  if (Array.isArray(pricedTrades) && pricedTrades.length > 0) {
    const now = Date.now();
    let minTime = Infinity;
    for (const t of pricedTrades) {
      if (!t.cmpUpdatedAt) {
        staleFlag = true;
      } else {
        const time = new Date(t.cmpUpdatedAt).getTime();
        if (isNaN(time) || (now - time) > STALE_MS) {
          staleFlag = true;
        }
        if (!isNaN(time) && time < minTime) {
          minTime = time;
          oldestTs = t.cmpUpdatedAt;
        }
      }
    }
  }

  const realizedEquity = Number(realized?.equity) || 0;
  const liveEquity = realizedEquity + Number(unrealizedPnl || 0);
  const realizedMaxPct = Number(realized?.maxPct) || 0;

  if (liveEquity <= 0 || realizedEquity <= 0) {
    const pct = -100;
    const maxIncludingLive = Math.min(realizedMaxPct, pct);
    return {
      liveEquity,
      livePct: pct,
      liveAmount: liveEquity - (Number(realized?.peakEquity) || 0),
      maxIncludingLive,
      liveEquityNonPositive: true,
      unpricedCount: Number(unpricedCount) || 0,
      isStale: staleFlag,
      oldestCmpUpdatedAt: oldestTs
    };
  }

  let pct = 0;
  let amt = 0;

  if (realized?.index !== undefined && realized?.peakIndex !== undefined && Number(realized.index) > 0 && Number(realized.peakIndex) > 0) {
    const liveIndex = Number(realized.index) * (1 + (Number(unrealizedPnl) || 0) / realizedEquity);
    const livePeakIndex = Math.max(Number(realized.peakIndex), liveIndex);
    pct = livePeakIndex > 0 ? (liveIndex / livePeakIndex - 1) * 100 : 0;
    amt = liveIndex > 0 ? liveEquity * (1 - livePeakIndex / liveIndex) : 0;
  } else {
    const peakEquity = Number(realized?.peakEquity) || realizedEquity;
    const livePeak = Math.max(peakEquity, liveEquity);
    pct = livePeak > 0 ? ((liveEquity - livePeak) / livePeak) * 100 : 0;
    amt = liveEquity - livePeak;
  }

  if (isNaN(pct) || !isFinite(pct)) pct = 0;
  if (isNaN(amt) || !isFinite(amt)) amt = 0;

  const maxIncludingLive = Math.min(realizedMaxPct, pct);

  return {
    liveEquity,
    livePct: pct,
    liveAmount: amt,
    maxIncludingLive,
    liveEquityNonPositive: false,
    unpricedCount: Number(unpricedCount) || 0,
    isStale: staleFlag,
    oldestCmpUpdatedAt: oldestTs
  };
}


