/**
 * electron-db/calculations.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Institutional Nexus Trade Calculations & Lot-Matching in Pure Integer Paise.
 * Authoritative mathematical engine for the Electron SQLite layer.
 */

export function toPaise(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return 0;
    return Math.round(val * 100);
  }
  const str = String(val).trim();
  if (str === '' || str === '-' || str === 'N/A' || str === 'null') return 0;
  const isNegative = /^\(.*\)$/.test(str) || (str.startsWith('-') && !str.includes('+'));
  const cleaned = str.replace(/[^0-9.]/g, '');
  if (cleaned === '' || cleaned === '.') return 0;

  const parts = cleaned.split('.');
  const whole = parseInt(parts[0] || '0', 10);
  let fraction = 0;
  if (parts.length > 1) {
    const fracStr = parts[1].slice(0, 2);
    fraction = parseInt(fracStr.padEnd(2, '0'), 10);
    if (parts[1].length > 2 && parseInt(parts[1][2], 10) >= 5) {
      fraction += 1;
    }
  }
  const paise = (whole * 100) + fraction;
  return isNegative ? -paise : paise;
}

export function fromPaise(paise) {
  if (paise === undefined || paise === null || isNaN(paise)) return 0;
  return paise / 100;
}

/**
 * Gross PnL in integer paise:
 * LONG:  (exitPricePaise - entryPricePaise) * qty
 * SHORT: (entryPricePaise - exitPricePaise) * qty
 */
export function calculateLegGrossPaise(entryPricePaise, exitPricePaise, qty, isShort = false) {
  const q = Math.max(0, Number(qty) || 0);
  if (q <= 0) return 0;
  const priceDiff = isShort ? (entryPricePaise - exitPricePaise) : (exitPricePaise - entryPricePaise);
  return Math.round(priceDiff * q);
}

/**
 * Matches exit legs against entry legs using FIFO/LIFO.
 * @param {Array} entryLots - [{ qty, price_paise, execution_date, execution_time }]
 * @param {Array} exitLots  - [{ qty, price_paise, execution_date, execution_time }]
 * @param {'fifo'|'lifo'} costBasisMethod
 * @param {boolean} isShort
 */
export function matchExecutions(entryLots = [], exitLots = [], costBasisMethod = 'fifo', isShort = false) {
  const entries = entryLots.map((e, idx) => ({
    ...e,
    qty: Math.max(0, Number(e.quantity || e.qty) || 0),
    pricePaise: Number(e.price_paise || e.pricePaise || 0),
    date: e.execution_date || e.date || '',
    time: e.execution_time || e.time || '09:15:00',
    index: idx
  })).filter(e => e.qty > 0 && e.pricePaise > 0);

  const exits = exitLots.map((x, idx) => ({
    ...x,
    qty: Math.max(0, Number(x.quantity || x.qty) || 0),
    pricePaise: Number(x.price_paise || x.pricePaise || 0),
    date: x.execution_date || x.date || '',
    time: x.execution_time || x.time || '15:00:00',
    index: idx
  })).filter(x => x.qty > 0 && x.pricePaise > 0);

  const remainingEntries = entries.map(e => ({ ...e }));
  const matches = [];
  let totalRealizedPaise = 0;

  for (const exitLot of exits) {
    let unallocatedExitQty = exitLot.qty;

    while (unallocatedExitQty > 0 && remainingEntries.length > 0) {
      const entryIdx = costBasisMethod === 'fifo' ? 0 : remainingEntries.length - 1;
      const targetEntry = remainingEntries[entryIdx];
      const matchedQty = Math.min(targetEntry.qty, unallocatedExitQty);

      const legPLPaise = calculateLegGrossPaise(
        targetEntry.pricePaise,
        exitLot.pricePaise,
        matchedQty,
        isShort
      );

      totalRealizedPaise += legPLPaise;

      matches.push({
        entryPricePaise: targetEntry.pricePaise,
        exitPricePaise: exitLot.pricePaise,
        matchedQty,
        grossPaise: legPLPaise,
        entryDate: targetEntry.date,
        exitDate: exitLot.date
      });

      targetEntry.qty -= matchedQty;
      unallocatedExitQty -= matchedQty;

      if (targetEntry.qty <= 0) {
        remainingEntries.splice(entryIdx, 1);
      }
    }
  }

  return {
    realizedGrossPaise: totalRealizedPaise,
    remainingEntries,
    matches
  };
}

/**
 * Calculates holding days using quantity-weighted calendar duration.
 */
export function calculateHoldingDays(matches = [], remainingEntries = []) {
  const ONE_DAY_MS = 86400000;
  const segments = [];

  matches.forEach(m => {
    const d1 = new Date(m.entryDate).getTime();
    const d2 = new Date(m.exitDate).getTime();
    const days = (!isNaN(d1) && !isNaN(d2) && d2 >= d1)
      ? Math.floor((d2 - d1) / ONE_DAY_MS)
      : 0;
    segments.push({ qty: m.matchedQty, days });
  });

  const nowMs = Date.now();
  remainingEntries.forEach(r => {
    const d1 = new Date(r.date).getTime();
    const days = (!isNaN(d1) && nowMs >= d1)
      ? Math.floor((nowMs - d1) / ONE_DAY_MS)
      : 0;
    segments.push({ qty: r.qty, days });
  });

  const totalQty = segments.reduce((sum, s) => sum + s.qty, 0);
  if (totalQty <= 0) return 0;
  const weightedDays = segments.reduce((sum, s) => sum + (s.days * s.qty), 0);
  return Math.round(weightedDays / totalQty);
}

/**
 * Re-computes derived trade columns from executions.
 * Returns the updated trade object ready for SQLite persistence.
 *
 * @param {object} trade
 * @param {Array} executions
 * @param {number} baseCapitalPaise
 * @param {object} [options]
 */
export function computeTradeMetrics(trade, executions = [], baseCapitalPaise = 10000000, options = {}) {
  const costBasisMethod = options.costBasisMethod || 'fifo';
  const isShort = String(trade.direction || '').toUpperCase() === 'SHORT' ||
                  String(trade.type || '').toUpperCase() === 'SELL';

  const entryExecs = executions.filter(e => (e.execution_type === 'ENTRY' || e.side === (isShort ? 'SELL' : 'BUY')) && !e.deleted_at);
  const exitExecs  = executions.filter(e => (e.execution_type === 'EXIT' || e.side === (isShort ? 'BUY' : 'SELL')) && !e.deleted_at);

  const totalQtyEntered = entryExecs.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
  const totalCostBasisPaise = entryExecs.reduce((sum, e) => sum + Math.round((Number(e.quantity) || 0) * (Number(e.price_paise) || 0)), 0);
  const vwapEntryPaise = totalQtyEntered > 0 ? Math.round(totalCostBasisPaise / totalQtyEntered) : Number(trade.avg_entry_price_paise || 0);

  const totalQtyExited = exitExecs.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
  const totalProceedsPaise = exitExecs.reduce((sum, e) => sum + Math.round((Number(e.quantity) || 0) * (Number(e.price_paise) || 0)), 0);
  const avgExitPricePaise = totalQtyExited > 0 ? Math.round(totalProceedsPaise / totalQtyExited) : 0;

  const openQty = Math.max(0, totalQtyEntered - totalQtyExited);

  // Status lifecycle
  let status = 'OPEN';
  if (totalQtyEntered > 0) {
    if (openQty <= 0) status = 'CLOSED';
    else if (totalQtyExited > 0) status = 'PARTIAL';
    else status = 'OPEN';
  } else {
    status = trade.status ? trade.status.toUpperCase() : 'OPEN';
  }

  // Lot matching
  const { realizedGrossPaise, remainingEntries, matches } = matchExecutions(
    entryExecs,
    exitExecs,
    costBasisMethod,
    isShort
  );

  // Average entry price for remaining open lots (LIFO / FIFO)
  let avgEntryPaise = vwapEntryPaise;
  if (status === 'PARTIAL' && remainingEntries.length > 0) {
    const remCost = remainingEntries.reduce((sum, r) => sum + Math.round(r.qty * r.pricePaise), 0);
    const remQty = remainingEntries.reduce((sum, r) => sum + r.qty, 0);
    if (remQty > 0) {
      avgEntryPaise = Math.round(remCost / remQty);
    }
  }

  // Realized Gross PnL
  const grossPnlPaise = (status === 'CLOSED' || status === 'PARTIAL') ? realizedGrossPaise : 0;
  const totalChargesPaise = Number(trade.total_charges_paise) || 0;
  const netPnlPaise = grossPnlPaise - totalChargesPaise;

  // Holding Days
  const holdingDays = calculateHoldingDays(matches, remainingEntries);

  // R-Multiple (Gain / Total Initial Risk)
  const initialSlPaise = Number(trade.initial_stop_loss_paise) || 0;
  let rewardRisk = null;
  if (initialSlPaise > 0 && totalQtyEntered > 0 && vwapEntryPaise > 0) {
    let totalInitialRiskPaise = 0;
    entryExecs.forEach(leg => {
      const legQty = Number(leg.quantity) || 0;
      const legPricePaise = Number(leg.price_paise) || 0;
      const legSlPaise = Number(leg.stop_loss_paise) > 0 ? Number(leg.stop_loss_paise) : initialSlPaise;
      if (legQty > 0 && legPricePaise > 0 && legSlPaise > 0) {
        totalInitialRiskPaise += Math.round(legQty * Math.abs(legPricePaise - legSlPaise));
      }
    });

    if (totalInitialRiskPaise > 0) {
      rewardRisk = Number((grossPnlPaise / totalInitialRiskPaise).toFixed(2));
    }
  }

  // Stock Move %
  let stockMovePct = 0;
  if (status === 'CLOSED' && avgExitPricePaise > 0 && vwapEntryPaise > 0) {
    stockMovePct = isShort
      ? ((vwapEntryPaise - avgExitPricePaise) / vwapEntryPaise) * 100
      : ((avgExitPricePaise - vwapEntryPaise) / vwapEntryPaise) * 100;
  }

  // Portfolio Impact % (Realized P&L / Account Base Capital)
  const pfImpactPct = baseCapitalPaise > 0
    ? (grossPnlPaise / baseCapitalPaise) * 100
    : 0;

  // Earliest entry date & Latest exit date
  const earliestEntryDate = entryExecs[0]?.execution_date || trade.entry_date;
  const earliestEntryTime = entryExecs[0]?.execution_time || trade.entry_time || '09:15:00';
  const latestExitDate    = exitExecs.length > 0 ? exitExecs[exitExecs.length - 1]?.execution_date : null;
  const latestExitTime    = exitExecs.length > 0 ? exitExecs[exitExecs.length - 1]?.execution_time : null;

  return {
    ...trade,
    entry_date: earliestEntryDate,
    entry_time: earliestEntryTime,
    exit_date: (status === 'CLOSED' || status === 'PARTIAL') ? latestExitDate : null,
    exit_time: (status === 'CLOSED' || status === 'PARTIAL') ? latestExitTime : null,
    status,
    total_entered_quantity: totalQtyEntered,
    open_quantity: openQty,
    exited_quantity: totalQtyExited,
    avg_entry_price_paise: avgEntryPaise,
    avg_exit_price_paise: avgExitPricePaise,
    position_size_paise: totalCostBasisPaise,
    realised_amount_paise: totalProceedsPaise,
    gross_pnl_paise: grossPnlPaise,
    net_pnl_paise: netPnlPaise,
    reward_risk: rewardRisk,
    holding_days: holdingDays,
    stock_move_pct: Number(stockMovePct.toFixed(2)),
    pf_impact_pct: Number(pfImpactPct.toFixed(2)),
  };
}
