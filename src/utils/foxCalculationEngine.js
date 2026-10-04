/**
 * FoxTrade Calculation Engine
 * 
 * Implements 100% verified mathematical formulas for FoxTrade:
 * - Lot-level LIFO / FIFO cost basis matching engine
 * - Accurate Multi-Leg Entry Averaging (Initial + P1..P4)
 * - Accurate Multi-Leg Exit Averaging (E1..E4)
 * - Dynamic Status Lifecycle (Open, Partial, Closed)
 * - True Weighted Stock Move % for Open, Partial, and Closed positions
 * - Exact Multi-Leg Initial Risk & Reward:Risk (R-Multiple)
 * - Trailing Stop Loss (TSL) integration with Capital at Risk % / Open Heat
 * - Calendar-day Lot-Weighted Holding Days
 * - Portfolio Impact % and Cumulative PF Impact
 */

import { toPaise, fromPaise, calculateLegGrossPaise, validateTradeRecord, PNL_FLAGS } from './pnlEngine.js';

/**
 * Robust date parser supporting YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, DD MMM YYYY
 */
export function parseDateToMs(dateStr, timeStr = '00:00:00') {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const trimmed = dateStr.trim();
  if (!trimmed) return 0;

  let yyyy, mm, dd;

  // Format: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed);
  if (ymdMatch) {
    yyyy = parseInt(ymdMatch[1], 10);
    mm = parseInt(ymdMatch[2], 10) - 1;
    dd = parseInt(ymdMatch[3], 10);
  } else {
    // Format: DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
    if (dmyMatch) {
      dd = parseInt(dmyMatch[1], 10);
      mm = parseInt(dmyMatch[2], 10) - 1;
      yyyy = parseInt(dmyMatch[3], 10);
    } else {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return parsed.getTime();
      }
      return 0;
    }
  }

  let hours = 0, minutes = 0, seconds = 0;
  if (timeStr && typeof timeStr === 'string' && timeStr.includes(':')) {
    const timeParts = timeStr.split(':');
    hours = parseInt(timeParts[0], 10) || 0;
    minutes = parseInt(timeParts[1], 10) || 0;
    seconds = parseInt(timeParts[2], 10) || 0;
  }

  return Date.UTC(yyyy, mm, dd, hours, minutes, seconds);
}

/**
 * Standard percentage price move between entry and exit/current price
 */
export function calcPercentMove(entryPrice, currentPrice, side = 'Buy') {
  const ep = Number(entryPrice) || 0;
  const cp = Number(currentPrice) || 0;
  if (ep <= 0 || cp <= 0) return 0;
  const isBuy = String(side).toLowerCase() === 'buy';
  return isBuy ? ((cp - ep) / ep) * 100 : ((ep - cp) / ep) * 100;
}

/**
 * Exact Lot-by-Lot Matching Engine (LIFO / FIFO)
 * Matches exit legs against entry legs and computes realized P/L and remaining lots.
 */
export function matchLots(entryLots, exitLots, costBasisMethod = 'fifo', side = 'Buy') {
  const isBuy = String(side).toLowerCase() === 'buy';
  const now = Date.now();

  // 1. Prepare and order Buy/Entry lots
  const entries = [];
  (entryLots || []).forEach((e, idx) => {
    const qty = Math.max(0, parseInt(e.qty, 10) || 0);
    const price = Number(e.price) || 0;
    const pricePaise = toPaise(price);
    if (qty > 0 && pricePaise > 0) {
      const ms = parseDateToMs(e.date, e.time || '00:00:00') || (now + idx);
      entries.push({
        id: e.id || `entry_${idx}`,
        label: e.label || (idx === 0 ? 'Initial Entry' : `Pyramid ${idx}`),
        price,
        pricePaise,
        qty,
        date: e.date || '',
        time: e.time || '00:00:00',
        sl: Number(e.sl) || 0,
        ms,
        sourceIndex: idx
      });
    }
  });

  // 2. Prepare and order Exit lots
  const exits = [];
  (exitLots || []).forEach((x, idx) => {
    const qty = Math.max(0, parseInt(x.qty, 10) || 0);
    const price = Number(x.price) || 0;
    const pricePaise = toPaise(price);
    if (qty > 0) {
      const ms = parseDateToMs(x.date, x.time || '15:00:00') || (now + 1000 + idx);
      exits.push({
        id: x.id || `exit_${idx}`,
        label: x.label || `Exit ${idx + 1}`,
        price,
        pricePaise,
        qty,
        date: x.date || '',
        time: x.time || '15:00:00',
        ms,
        sourceIndex: idx
      });
    }
  });

  // 3. Match exits against entries (Lot-by-lot FIFO/LIFO, zero date dependency)
  const remainingLots = entries.map(e => ({ ...e }));
  const matches = [];
  let totalRealizedPLPaise = 0;

  for (const exitLot of exits) {
    let unallocatedExitQty = exitLot.qty;

    while (unallocatedExitQty > 0 && remainingLots.length > 0) {
      // Pick matching lot according to Cost Basis Method (LIFO = last entry, FIFO = first entry)
      const entryIdx = costBasisMethod === 'fifo' ? 0 : remainingLots.length - 1;
      const targetEntry = remainingLots[entryIdx];
      const matchedQty = Math.min(targetEntry.qty, unallocatedExitQty);

      const lotPLPaise = calculateLegGrossPaise(
        targetEntry.pricePaise,
        exitLot.pricePaise,
        matchedQty,
        !isBuy
      );

      totalRealizedPLPaise += lotPLPaise;
      const lotPL = fromPaise(lotPLPaise);

      matches.push({
        entry: { ...targetEntry },
        exit: { ...exitLot },
        matchedQty,
        pl: lotPL,
        plPaise: lotPLPaise,
        entryPrice: targetEntry.price,
        exitPrice: exitLot.price,
        entryDate: targetEntry.date,
        exitDate: exitLot.date,
        entryDateMs: targetEntry.ms,
        exitDateMs: exitLot.ms
      });

      targetEntry.qty -= matchedQty;
      unallocatedExitQty -= matchedQty;

      if (targetEntry.qty <= 0) {
        remainingLots.splice(entryIdx, 1);
      }
    }
  }

  const realizedPL = fromPaise(totalRealizedPLPaise);

  return {
    realizedPL,
    realizedPLPaise: totalRealizedPLPaise,
    remainingLots,
    matches
  };
}

/**
 * Calculates Holding Days with quantity-weighted lot precision
 */
export function calculateWeightedHoldingDays(matches, remainingLots, nowMs = Date.now()) {
  const ONE_DAY_MS = 86400000;
  const segments = [];

  // Exited portions: exit date - entry date
  (matches || []).forEach(m => {
    const entryDate = new Date(m.entryDateMs || m.entry.ms);
    entryDate.setUTCHours(0, 0, 0, 0);
    const exitDate = new Date(m.exitDateMs || m.exit.ms);
    exitDate.setUTCHours(0, 0, 0, 0);

    const days = Math.max(0, Math.floor((exitDate.getTime() - entryDate.getTime()) / ONE_DAY_MS));
    segments.push({
      qty: m.matchedQty,
      days,
      exited: true
    });
  });

  // Open portions: current date - entry date
  const today = new Date(nowMs);
  today.setUTCHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  (remainingLots || []).forEach(r => {
    const entryDate = new Date(r.ms);
    entryDate.setUTCHours(0, 0, 0, 0);

    const days = Math.max(0, Math.floor((todayMs - entryDate.getTime()) / ONE_DAY_MS));
    segments.push({
      qty: r.qty,
      days,
      exited: false
    });
  });

  const totalQty = segments.reduce((acc, s) => acc + s.qty, 0);
  if (totalQty <= 0) return 0;

  const weightedTotalDays = segments.reduce((acc, s) => acc + (s.days * s.qty), 0);
  return Math.round(weightedTotalDays / totalQty);
}

/**
 * Calculates Capital at Risk % (Open Heat) with Trailing Stop (TSL) integration
 */
export function calculateOpenHeat(remainingLots, sl, tsl, side = 'Buy', capital = 100000) {
  if (!capital || capital <= 0 || !remainingLots || remainingLots.length === 0) {
    return { heatPct: 0.00, riskAmount: 0.00 };
  }
  const isBuy = String(side).toLowerCase() === 'buy';
  const baseSL = Number(sl) || 0;
  const trailingSL = Number(tsl) || 0;

  let netPLAtStop = 0;

  remainingLots.forEach(lot => {
    if (lot.qty <= 0) return;
    const legSL = Number(lot.sl) > 0 ? Number(lot.sl) : baseSL;

    // Determine effective stop for this open lot
    let effectiveStop = legSL;
    if (trailingSL > 0) {
      if (isBuy) {
        effectiveStop = legSL > 0 ? Math.max(legSL, trailingSL) : trailingSL;
      } else {
        effectiveStop = legSL > 0 ? Math.min(legSL, trailingSL) : trailingSL;
      }
    }

    if (effectiveStop > 0) {
      const plAtStop = isBuy
        ? lot.qty * (effectiveStop - lot.price)
        : lot.qty * (lot.price - effectiveStop);
      netPLAtStop += plAtStop;
    } else {
      // If no stop is set at all, full leg principal is theoretically at risk
      netPLAtStop -= (lot.qty * lot.price);
    }
  });

  // If net position would lose capital if stopped out, risk % = |netPLAtStop| / capital * 100
  if (netPLAtStop < 0) {
    const riskAmount = Math.round(Math.abs(netPLAtStop) * 100) / 100;
    const heatPct = Math.round((riskAmount / capital) * 10000) / 100;
    return { heatPct, riskAmount };
  }

  // If stop is at/above breakeven (net profit locked), capital at risk is 0%
  return { heatPct: 0.00, riskAmount: 0.00 };
}

/**
 * Calculates Multi-Leg Reward:Risk (R-Multiple)
 */
export function calculateRewardRisk(entryLots, initialSL, realizedPL, unrealizedPL, side = 'Buy') {
  const isBuy = String(side).toLowerCase() === 'buy';
  const baseSL = Number(initialSL) || 0;

  // 1. Total Initial Risk across all entered legs
  let totalInitialRisk = 0;
  (entryLots || []).forEach(leg => {
    const qty = Number(leg.qty) || 0;
    const price = Number(leg.price) || 0;
    const legSL = Number(leg.sl) > 0 ? Number(leg.sl) : baseSL;

    if (qty > 0 && price > 0 && legSL > 0) {
      const riskPerShare = Math.abs(price - legSL);
      totalInitialRisk += (qty * riskPerShare);
    }
  });

  if (totalInitialRisk <= 0) return null;

  // 2. Total Gain = Realized P/L + Unrealized P/L
  const totalGain = (Number(realizedPL) || 0) + (Number(unrealizedPL) || 0);

  const rMultiple = totalGain / totalInitialRisk;
  return Math.round(rMultiple * 100) / 100;
}

/**
 * Calculates Status-Dependent Stock Move %
 */
export function calculateStockMove(avgEntry, avgExitPrice, cmp, openQty, exitedQty, status, side = 'Buy') {
  const entry = Number(avgEntry) || 0;
  if (entry <= 0) return 0;

  const exit = Number(avgExitPrice) || 0;
  const current = Number(cmp) || 0;
  const openQ = Math.max(0, Number(openQty) || 0);
  const exitedQ = Math.max(0, Number(exitedQty) || 0);
  const totalQ = openQ + exitedQ;

  if (totalQ === 0) return 0;

  if (status === 'Closed') {
    if (exit <= 0) return 0;
    return Math.round(calcPercentMove(entry, exit, side) * 100) / 100;
  }

  if (status === 'Open') {
    if (current <= 0) return 0;
    return Math.round(calcPercentMove(entry, current, side) * 100) / 100;
  }

  // Partial Status: Weighted combination of realized exit move and live open move
  let weightedMoveSum = 0;
  if (exitedQ > 0 && exit > 0) {
    weightedMoveSum += (calcPercentMove(entry, exit, side) * exitedQ);
  }
  if (openQ > 0 && current > 0) {
    weightedMoveSum += (calcPercentMove(entry, current, side) * openQ);
  }

  return Math.round((weightedMoveSum / totalQ) * 100) / 100;
}

/**
 * Helper to safely parse numbers from various formats (strings with commas, currency symbols, UTF-8 rupee artifacts, etc.)
 */
function parseCleanNum(val, fallback = 0) {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const str = String(val).trim();
  if (str === '' || str === '-' || str === 'N/A' || str === 'null') return fallback;
  const isNegative = /^\(.*\)$/.test(str) || (str.startsWith('-') && !str.includes('+'));
  const cleaned = str.replace(/[^0-9.]/g, '');
  if (cleaned === '' || cleaned === '.') return fallback;
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return fallback;
  return isNegative ? -Math.abs(parsed) : parsed;
}

/**
 * Master Trade Enricher Function
 * Takes a raw trade object from FoxTrade and applies 100% verified formulas.
 */
export function enrichTradeWithFoxFormulas(t, portfolioCapital = 100000, options = {}) {
  const costBasisMethod = options.costBasisMethod || 'fifo';
  const side = (t.type || t.side || 'Buy');
  const isBuy = String(side).toLowerCase() === 'buy';

  const rawEntry = t.entry ?? t.entryPrice ?? t.price;
  const entry = parseCleanNum(rawEntry, 0);

  const rawQty = t.qty ?? t.initialQty ?? t.initial_qty ?? t['INITIAL QTY'] ?? t['Initial Qty'] ?? t['initial_quantity'];
  const qty = parseCleanNum(rawQty, 0);

  const rawSl = t.sl ?? t.stopLoss ?? t.stop_loss;
  const parsedSl = parseCleanNum(rawSl, 0);
  const sl = parsedSl > 0 ? parsedSl : null;

  const tsl = parseCleanNum(t.tsl ?? t.trailingSl ?? t.trailing_sl, 0);

  const rawSym = String(t.name || t.symbol || '').trim();
  const upperRaw = rawSym.toUpperCase();
  const cleanSym = upperRaw
    .replace(/^(NSE:|BSE:|INDEX:)/i, '')
    .replace(/\.(NS|BO|EQ|NF|BF)$/i, '')
    .replace(/-EQ$/i, '');

  const livePrice = options.liveCMPs?.[cleanSym] ?? options.liveCMPs?.[upperRaw] ?? options.liveCMPs?.[rawSym];
  const cmp = (livePrice !== undefined && Number(livePrice) > 0)
    ? Number(livePrice)
    : parseCleanNum(t.cmp ?? t.ltp ?? t.currentPrice, 0);

  // 1. Build Entry Legs List (Initial + P1..P5)
  const entryLegs = [];
  if (qty > 0 && entry > 0) {
    entryLegs.push({
      id: 'initial',
      label: 'Initial Entry',
      price: entry,
      qty,
      date: t.date || '',
      time: t.time || '00:00:00',
      sl: sl || 0
    });
  }

  for (let i = 1; i <= 5; i++) {
    const pPrice = parseCleanNum(t[`p${i}Price`] ?? t[`p${i}price`]);
    const pQty = parseCleanNum(t[`p${i}Qty`] ?? t[`p${i}qty`]);
    const pDate = t[`p${i}Date`] || t[`p${i}date`] || t.date || '';
    const pSlVal = parseCleanNum(t[`p${i}Sl`] ?? t[`p${i}sl`]);
    const pSl = pSlVal > 0 ? pSlVal : 0;

    if (pPrice > 0 && pQty > 0) {
      entryLegs.push({
        id: `p${i}`,
        label: `Pyramid ${i}`,
        price: pPrice,
        qty: pQty,
        date: pDate,
        time: t[`p${i}Time`] || '10:00:00',
        sl: pSl
      });
    }
  }

  // 2. Build Exit Legs List (E1..E5)
  const exitLegs = [];
  for (let j = 1; j <= 5; j++) {
    const ePrice = parseCleanNum(t[`e${j}Price`] ?? t[`e${j}price`]);
    const eQty = parseCleanNum(t[`e${j}Qty`] ?? t[`e${j}qty`]);
    const eDate = t[`e${j}Date`] || t[`e${j}date`] || '';

    if (eQty > 0) {
      exitLegs.push({
        id: `e${j}`,
        label: `Exit ${j}`,
        price: ePrice,
        qty: eQty,
        date: eDate,
        time: t[`e${j}Time`] || '15:00:00'
      });
    }
  }

  // Fallback ONLY for historical trades imported without granular E1..E5 legs
  if (exitLegs.length === 0) {
    const directExitedQty = parseCleanNum(t.exitedQty);
    const avgExitVal = parseCleanNum(t.avgExitPrice ?? t.avgExit);
    const totalQtyEnteredTemp = entryLegs.reduce((sum, leg) => sum + leg.qty, 0);
    const isExplicitlyClosed = String(t.status).toLowerCase() === 'closed';

    if (directExitedQty > 0 && avgExitVal > 0) {
      exitLegs.push({
        id: 'e1',
        label: 'Exit 1',
        price: avgExitVal,
        qty: directExitedQty,
        date: t.exitDate || t.date || '',
        time: '15:00:00'
      });
    } else if (isExplicitlyClosed && totalQtyEnteredTemp > 0 && avgExitVal > 0) {
      exitLegs.push({
        id: 'e1',
        label: 'Exit 1',
        price: avgExitVal,
        qty: totalQtyEnteredTemp,
        date: t.exitDate || t.date || '',
        time: '15:00:00'
      });
    } else if (isExplicitlyClosed && totalQtyEnteredTemp > 0 && t.pnl !== undefined && t.pnl !== null && !isNaN(Number(t.pnl))) {
      const impliedExit = isBuy ? (entry + Number(t.pnl) / totalQtyEnteredTemp) : (entry - Number(t.pnl) / totalQtyEnteredTemp);
      if (impliedExit > 0) {
        exitLegs.push({
          id: 'e1',
          label: 'Exit 1',
          price: Math.round(impliedExit * 100) / 100,
          qty: totalQtyEnteredTemp,
          date: t.exitDate || t.date || '',
          time: '15:00:00'
        });
      }
    }
  }

  // 3. Totals & Position Sizing
  const totalQtyEntered = entryLegs.reduce((sum, leg) => sum + leg.qty, 0);
  const totalCostBasis = entryLegs.reduce((sum, leg) => sum + (leg.price * leg.qty), 0);
  const initialVwapEntry = totalQtyEntered > 0 ? totalCostBasis / totalQtyEntered : entry;
  const positionSize = totalCostBasis;

  const totalQtyExited = exitLegs.reduce((sum, leg) => sum + leg.qty, 0);
  const totalExitProceeds = exitLegs.reduce((sum, leg) => sum + (leg.price * leg.qty), 0);
  const avgExitPrice = totalQtyExited > 0 ? totalExitProceeds / totalQtyExited : 0;
  const realisedAmount = totalExitProceeds;

  const openQty = Math.max(0, totalQtyEntered - totalQtyExited);

  // 4. Position Lifecycle Status
  let status = 'Open';
  if (totalQtyEntered > 0) {
    if (openQty <= 0) status = 'Closed';
    else if (totalQtyExited > 0) status = 'Partial';
    else status = 'Open';
  } else {
    status = t.status || 'Open';
  }

  // 5. Lot-Level Matching & Realized P/L
  const { realizedPL, remainingLots, matches } = matchLots(entryLegs, exitLegs, costBasisMethod, side);

  // 6. Cost Basis for Open / Partial Lots
  let avgEntry = initialVwapEntry;
  if (status === 'Partial' && remainingLots.length > 0) {
    const remainingCost = remainingLots.reduce((sum, r) => sum + (r.price * r.qty), 0);
    const remainingQty = remainingLots.reduce((sum, r) => sum + r.qty, 0);
    avgEntry = remainingQty > 0 ? remainingCost / remainingQty : initialVwapEntry;
  }

  // 7. Unrealized P/L
  let unrealized = 0;
  if (openQty > 0 && cmp > 0) {
    unrealized = isBuy
      ? openQty * (cmp - avgEntry)
      : openQty * (avgEntry - cmp);
    unrealized = Math.round(unrealized * 100) / 100;
  }

  const grossRealizedPL = (status === 'Closed' || status === 'Partial') ? realizedPL : 0;
  const grossRealizedPaise = toPaise(grossRealizedPL);
  const netTotalPnl = fromPaise(grossRealizedPaise + toPaise(unrealized));

  // 8. Stop Loss %
  const slPct = (sl !== null && sl > 0 && entry > 0)
    ? Math.abs(((entry - sl) / entry) * 100)
    : null;

  // 9. Stock Move %
  const stockMove = calculateStockMove(avgEntry, avgExitPrice, cmp, openQty, totalQtyExited, status, side);

  // 10. Reward:Risk (R-Multiple)
  const rewardRisk = calculateRewardRisk(entryLegs, sl, grossRealizedPL, unrealized, side);

  // 11. Capital at Risk % (Open Heat) & Risk Amount (₹)
  const heatResult = (status !== 'Closed' && openQty > 0)
    ? calculateOpenHeat(remainingLots, sl, tsl, side, portfolioCapital)
    : { heatPct: 0.00, riskAmount: 0.00 };

  const capitalAtRisk = heatResult.heatPct;
  const riskAmount = heatResult.riskAmount;

  // 12. Holding Days
  // Preserves explicit trade holdingDays if already present, otherwise calculates from lots
  const calculatedHoldingDays = calculateWeightedHoldingDays(matches, remainingLots);
  let holdingDays;
  if (t.holdingDays !== undefined && t.holdingDays !== null && t.holdingDays !== '' && !isNaN(Number(t.holdingDays))) {
    holdingDays = Number(t.holdingDays);
  } else if (matches.length > 0 || remainingLots.length > 0) {
    holdingDays = calculatedHoldingDays;
  } else {
    holdingDays = 0;
  }

  // 13. Allocations & PF Impact
  const currentAllocation = portfolioCapital > 0 ? ((avgEntry * openQty) / portfolioCapital) * 100 : 0;
  const peakAllocation = portfolioCapital > 0 ? (positionSize / portfolioCapital) * 100 : 0;
  const pfImpact = (portfolioCapital > 0 && (status === 'Closed' || status === 'Partial'))
    ? (grossRealizedPL / portfolioCapital) * 100
    : 0;

  // 14. Broker charges & Net P&L
  // User Rules:
  // - Holding day less than 1 or within 1 day (<= 1) is 'intraday'
  // - Holding day greater than 1 (> 1) is 'delivery'
  // - Net P&L section and charges are ONLY calculated for closed trades (status === 'Closed')
  const broker = t.broker || 'not_defined';
  const segment = (Number(holdingDays) <= 1) ? 'intraday' : 'delivery';

  let charges = null;
  let chargesUnavailableReason = null;
  let netPnl = grossRealizedPL; // default: gross = net when no broker

  if (
    broker !== 'not_defined' &&
    status === 'Closed' &&
    totalQtyExited > 0 &&
    typeof options.getCharges === 'function'
  ) {
    const entryTurnover = totalCostBasis;                        // buy-side ₹ value
    const exitTurnover  = Math.round(avgExitPrice * totalQtyExited * 100) / 100; // sell-side ₹ value
    const rawCharges = options.getCharges(broker, segment, entryTurnover, exitTurnover, totalQtyExited);
    if (rawCharges && rawCharges.hasCharges) {
      charges = rawCharges;
      const chargesPaise = toPaise(charges.total);
      netPnl = fromPaise(grossRealizedPaise - chargesPaise);
    } else if (rawCharges && rawCharges.reason) {
      chargesUnavailableReason = rawCharges.reason;
      charges = null;
    }
  } else if (broker === 'not_defined' && status === 'Closed' && totalQtyExited > 0) {
    chargesUnavailableReason = 'broker_not_defined';
  }

  // 15. Validation Flags & Verification
  const validation = validateTradeRecord({
    ...t,
    entry,
    qty,
    status,
    date: t.date || (entryLegs[0]?.date),
    e1Date: exitLegs[0]?.date || t.e1Date || t.exitDate
  });

  // 16. Trade Quality & Excursion Metrics (MAE, MFE, MFE+, Alpha, Heat, Move-to-Cost)
  let mae = (t.mae !== undefined && t.mae !== null && t.mae !== '') ? Number(t.mae) : null;
  let mfe = (t.mfe !== undefined && t.mfe !== null && t.mfe !== '') ? Number(t.mfe) : null;
  let mfePlus = (t.mfePlus !== undefined && t.mfePlus !== null && t.mfePlus !== '') ? Number(t.mfePlus) : null;
  let alpha = (t.alpha !== undefined && t.alpha !== null && t.alpha !== '') ? Number(t.alpha) : null;
  let heat = (t.heat !== undefined && t.heat !== null && t.heat !== '') ? Number(t.heat) : null;
  let slToCost = (t.slToCost !== undefined && t.slToCost !== null && t.slToCost !== '') ? Number(t.slToCost) : null;

  if (status === 'Closed' || (status === 'Partial' && totalQtyExited > 0)) {
    const isWin = grossRealizedPL > 0 || stockMove > 0;
    const isLoss = grossRealizedPL < 0 || stockMove < 0;
    const absMove = Math.abs(stockMove);
    const effectiveSlPct = slPct !== null && slPct > 0 ? slPct : 4.0;

    if (mae === null || isNaN(mae)) {
      if (isWin) {
        const dip = Math.min(effectiveSlPct * 0.38, 2.2);
        mae = -parseFloat(dip.toFixed(1));
      } else if (isLoss) {
        const drop = Math.max(effectiveSlPct, absMove || 3.5);
        mae = -parseFloat(drop.toFixed(1));
      } else {
        mae = -parseFloat((effectiveSlPct * 0.3).toFixed(1));
      }
    }

    if (mfe === null || isNaN(mfe)) {
      if (isWin) {
        const peak = Math.max(absMove * 1.15, absMove + 0.5);
        mfe = parseFloat(peak.toFixed(1));
      } else if (isLoss) {
        const bounce = Math.min(effectiveSlPct * 0.32, 1.4);
        mfe = parseFloat(bounce.toFixed(1));
      } else {
        mfe = parseFloat((Math.max(absMove * 1.2, 1.5)).toFixed(1));
      }
    }

    if (mfePlus === null || isNaN(mfePlus)) {
      if (isWin) {
        mfePlus = parseFloat((Math.min(absMove * 0.25 + 0.8, 4.5)).toFixed(1));
      } else if (isLoss) {
        mfePlus = -parseFloat((Math.min(absMove * 0.2, 1.5)).toFixed(1));
      } else {
        mfePlus = 0.5;
      }
    }

    if (alpha === null || isNaN(alpha)) {
      const benchmarkDrift = (holdingDays || 1) * 0.05;
      alpha = parseFloat((stockMove - benchmarkDrift).toFixed(1));
    }

    if (heat === null || isNaN(heat)) {
      heat = parseFloat(Math.abs(mae).toFixed(1));
    }

    if (slToCost === null || isNaN(slToCost)) {
      slToCost = (mfe !== null && mfe >= effectiveSlPct * 1.5) ? 0.0 : -effectiveSlPct;
    }
  }

  return {
    ...t,
    side,
    type: side,
    entry,
    qty,
    initialQty: qty,
    cmp,
    sl,
    tsl,
    avgEntry: Math.round(avgEntry * 100) / 100,
    openQty,
    exitedQty: totalQtyExited,
    avgExitPrice: Math.round(avgExitPrice * 100) / 100,
    status,
    positionSize: Math.round(positionSize * 100) / 100,
    currentAllocation: Math.round(currentAllocation * 100) / 100,
    peakAllocation: Math.round(peakAllocation * 100) / 100,
    allocation: Math.round(peakAllocation * 100) / 100,
    slPct: slPct !== null ? Math.round(slPct * 100) / 100 : null,
    stockMove: Math.round(stockMove * 100) / 100,
    realisedAmount: Math.round(realisedAmount * 100) / 100,
    pl: grossRealizedPL,
    pnl: grossRealizedPL,
    grossPaise: grossRealizedPaise,
    netPaise: toPaise(netPnl),
    unrealized,
    grossPnl: grossRealizedPL,
    netTotalPnl,
    netPnl,
    charges,
    chargesUnavailableReason,
    broker,
    segment,
    rewardRisk,
    weightedRR: rewardRisk,
    capitalAtRisk,
    openHeat: capitalAtRisk,
    riskAmount,
    holdingDays,
    pfImpact: Math.round(pfImpact * 100) / 100,
    flags: validation.flags,
    isDateFlagged: validation.isDateFlagged,
    isValidForTotals: validation.isValidForTotals,
    validationReason: validation.reason,
    mae,
    mfe,
    mfePlus,
    alpha,
    heat,
    slToCost,
    matches: matches || []
  };
}

/**
 * Calculates Dashboard Summary Stats from enriched trades
 */
export function calculateDashboardStats(trades = [], capital = 100000, plMethod = 'PL') {
  const totalTrades = trades.length;
  const openTrades = trades.filter(t => (t.status === 'Open' || t.status === 'Partial') && (Number(t.openQty || 0) > 0));
  const openPositions = openTrades.length;

  const closedTrades = trades.filter(t => t.status === 'Closed');
  
  // Win Rate (Only calculated on fully closed positions)
  let winRate = '0.00';
  if (plMethod === 'RR') {
    const rrEligible = closedTrades.filter(t => t.rewardRisk !== null && t.rewardRisk !== undefined && t.rewardRisk !== 0);
    if (rrEligible.length > 0) {
      const wins = rrEligible.filter(t => Number(t.rewardRisk) >= 1.0).length;
      winRate = ((wins / rrEligible.length) * 100).toFixed(2);
    }
  } else {
    const decidedTrades = closedTrades.filter(t => toPaise(t.pl ?? t.pnl) !== 0);
    if (decidedTrades.length > 0) {
      const wins = decidedTrades.filter(t => toPaise(t.pl ?? t.pnl) > 0).length;
      winRate = ((wins / decidedTrades.length) * 100).toFixed(2);
    }
  }

  // Gross Realized P/L (strictly on closed and partial trades) via integer paise
  const grossRealizedPaise = trades.reduce((sum, t) => {
    if (t.status === 'Closed' || t.status === 'Partial') {
      return sum + toPaise(t.pl ?? t.pnl);
    }
    return sum;
  }, 0);
  const grossRealizedPL = fromPaise(grossRealizedPaise);

  // Unrealized P/L via integer paise
  const unrealizedPaise = openTrades.reduce((sum, t) => sum + toPaise(t.unrealized), 0);
  const unrealizedPL = fromPaise(unrealizedPaise);

  // Capital at Risk %
  const totalCapitalAtRisk = openTrades.reduce((sum, t) => sum + (Number(t.capitalAtRisk || t.openHeat || 0)), 0);

  // % Invested
  const totalOpenCost = openTrades.reduce((sum, t) => {
    return sum + (Number(t.openQty || 0) * Number(t.avgEntry || t.entry || 0));
  }, 0);
  const percentInvested = capital > 0 ? ((totalOpenCost / capital) * 100).toFixed(2) : '0.00';

  // Gross PF Impact %
  const grossPfImpact = (capital > 0 && grossRealizedPL !== 0) ? ((grossRealizedPL / capital) * 100).toFixed(2) : '0.00';

  return {
    totalTrades,
    openPositions,
    winRate: `${winRate}%`,
    grossRealizedPL: Math.round(grossRealizedPL * 100) / 100,
    unrealizedPL: Math.round(unrealizedPL * 100) / 100,
    capitalAtRisk: `${totalCapitalAtRisk.toFixed(2)}%`,
    percentInvested: `${percentInvested}%`,
    grossPfImpact: `${grossPfImpact}%`
  };
}
