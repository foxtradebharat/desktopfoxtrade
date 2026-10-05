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

  if (initialCap <= 0 && totalDeposits <= 0) {
    return {
      available: false,
      currentPct: null,
      currentAmount: null,
      maxPct: null,
      maxAmount: null,
      peakEquity: null,
      equity: null,
      series: [],
      skippedDays: [],
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
        skippedDays.push({ date: dayKey, pnl: pnlDay });
      }
      equityPrev = equityStart;
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
      series: [],
      skippedDays,
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
    series,
    skippedDays,
    currentUnderwaterDays,
    longestUnderwaterDays,
    maxDrawdownPeakDate,
    maxDrawdownTroughDate,
    recoveryDate
  };
}

