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
