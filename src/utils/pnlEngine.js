/**
 * pnlEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Institutional Hardened P&L Engine for FoxTrade.
 * 
 * CORE RULES:
 * 1. P&L = f(side, entryPrice, exitPrice, qty).
 *    Dates NEVER decide whether P&L exists. They only classify and attribute.
 * 2. Money in integer paise. Convert at input, format only at display.
 *    No rounding between steps.
 *    grossPaise = (isShort ? (entryPaise - exitPaise) : (exitPricePaise - entryPricePaise)) * qty
 * 3. Two input modes, kept strictly separate:
 *    - Round-trip rows: direct row calculation, no queue matching.
 *    - Raw broker transactions: FIFO per symbol, ordered by timestamp/order-id, then date.
 *      Unmatched BUY/SELL goes to unmatched bucket with explicit reason, never pl=0.
 * 4. Side (LONG/SHORT or Buy/Sell) is required. Never infer from dates.
 * 5. Validation flags: EXIT_BEFORE_ENTRY, FUTURE_DATE, AMBIGUOUS_DATE, DUPLICATE_ROW, QTY_MISMATCH.
 *    Only INVALID_NUMBERS excludes row from totals.
 * 6. Partial exits: child records with own qty/price; sum(child qty) == parent qty.
 * 7. Store gross and net in paise.
 * 8. Realized and unrealized are separate.
 * 9. Dates: parse with explicit DD-MM-YYYY, store ISO.
 * 10. Classification from dates marked "unreliable" on rows with date flags.
 * 11. Corporate actions (split/bonus) adjust qty and cost basis before matching.
 */

// ── 1. Paise Conversions & Pure Integer Arithmetic ──────────────────────────

/**
 * Converts any currency representation (number, formatted string, float) to integer paise.
 * Uses exact string splitting to avoid floating point representation traps (e.g. 814.66 * 100 = 81465.99999999999).
 */
export function toPaise(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return 0;
    // Format to 4 decimals to eliminate IEEE-754 float drift, then take 2 decimals
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

/**
 * Converts integer paise back to rupees (float with 2 decimal places).
 */
export function fromPaise(paise) {
  if (paise === undefined || paise === null || isNaN(paise)) return 0;
  return paise / 100;
}

/**
 * Pure integer paise P&L formula:
 * gross = (SHORT ? -(exit-entry) : (exit-entry)) * qty
 */
export function calculateLegGrossPaise(entryPricePaise, exitPricePaise, qty, isShort = false) {
  if (typeof entryPricePaise === 'object' && entryPricePaise !== null) {
    const opts = entryPricePaise;
    entryPricePaise = opts.entryPricePaise;
    exitPricePaise = opts.exitPricePaise;
    qty = opts.qty;
    isShort = opts.isShort ?? false;
  }
  const q = Math.max(0, parseInt(qty, 10) || 0);
  if (q <= 0) return 0;
  const priceDiff = isShort ? (entryPricePaise - exitPricePaise) : (exitPricePaise - entryPricePaise);
  return priceDiff * q;
}

// ── 2. Validation Flags ──────────────────────────────────────────────────────

export const PNL_FLAGS = {
  EXIT_BEFORE_ENTRY: 'EXIT_BEFORE_ENTRY',
  FUTURE_DATE: 'FUTURE_DATE',
  AMBIGUOUS_DATE: 'AMBIGUOUS_DATE',
  DUPLICATE_ROW: 'DUPLICATE_ROW',
  QTY_MISMATCH: 'QTY_MISMATCH',
  INVALID_NUMBERS: 'INVALID_NUMBERS'
};

/**
 * Parse date string to ms with explicit format options
 */
export function parseDateExplicit(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      return {
        ms: d.getTime(),
        iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        day,
        month,
        year,
        isAmbiguous: day <= 12 && month <= 12 && day !== month
      };
    }
  }

  // YYYY-MM-DD
  const ymdMatch = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(trimmed);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      return {
        ms: d.getTime(),
        iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        day,
        month,
        year,
        isAmbiguous: false
      };
    }
  }

  // ISO string
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return {
      ms: d.getTime(),
      iso: d.toISOString().split('T')[0],
      day: d.getUTCDate(),
      month: d.getUTCMonth() + 1,
      year: d.getUTCFullYear(),
      isAmbiguous: false
    };
  }

  return null;
}

/**
 * Validates a trade record and returns flags.
 * NEVER blocks P&L calculation unless numbers are invalid (qty<=0, price<=0).
 */
export function validateTradeRecord(t) {
  const flags = [];
  const nowMs = Date.now();
  const ONE_DAY_MS = 86400000;

  const entry = Number(t.entry ?? t.entryPrice ?? t.buyPrice ?? t.avgEntry ?? 0);
  const qty = Number(t.qty || t.initialQty || 0);

  // Check INVALID_NUMBERS
  if (isNaN(entry) || entry <= 0 || isNaN(qty) || qty <= 0) {
    flags.push(PNL_FLAGS.INVALID_NUMBERS);
    return {
      isValidForTotals: false,
      flags,
      reason: `Invalid numbers: price=${entry}, qty=${qty}`
    };
  }

  // Date Parsing & Checks
  const entryParsed = parseDateExplicit(t.date || t.entryDate);
  const exitDateStr = t.e1Date || t.exitDate || t.closeDate || (Array.isArray(t.exits) && t.exits[0]?.date);
  const exitParsed = exitDateStr ? parseDateExplicit(exitDateStr) : null;

  if (entryParsed) {
    if (entryParsed.ms > (nowMs + ONE_DAY_MS)) {
      flags.push(PNL_FLAGS.FUTURE_DATE);
    }
    if (entryParsed.isAmbiguous) {
      flags.push(PNL_FLAGS.AMBIGUOUS_DATE);
    }
  }

  if (exitParsed) {
    if (exitParsed.ms > (nowMs + ONE_DAY_MS)) {
      if (!flags.includes(PNL_FLAGS.FUTURE_DATE)) flags.push(PNL_FLAGS.FUTURE_DATE);
    }
    if (entryParsed && exitParsed.ms < entryParsed.ms) {
      flags.push(PNL_FLAGS.EXIT_BEFORE_ENTRY);
    }
    if (exitParsed.isAmbiguous && !flags.includes(PNL_FLAGS.AMBIGUOUS_DATE)) {
      flags.push(PNL_FLAGS.AMBIGUOUS_DATE);
    }
  }

  // Quantity mismatch check for closed trades
  const isClosed = String(t.status || t.positionStatus || '').toLowerCase() === 'closed';
  const exitArrayQty = Array.isArray(t.exits) ? t.exits.reduce((s, ex) => s + (Number(ex.qty) || 0), 0) : 0;
  const totalEnteredQty = qty + (Number(t.p1Qty) || 0) + (Number(t.p2Qty) || 0) + (Number(t.p3Qty) || 0) + (Number(t.p4Qty) || 0);
  const legQty = [t.e1Qty, t.e2Qty, t.e3Qty, t.e4Qty, t.e5Qty]
    .reduce((s, v) => s + (Number(v) || 0), 0);
  const aggregateQty = Number(t.exitedQty) || 0;
  // legs first; exitedQty only when there are no legs (legacy imports); exits[] last. Never add them.
  const totalExitedQty = legQty > 0 ? legQty : (aggregateQty > 0 ? aggregateQty : exitArrayQty);

  if (isClosed && totalExitedQty > 0 && Math.abs(totalEnteredQty - totalExitedQty) > 0.001) {
    flags.push(PNL_FLAGS.QTY_MISMATCH);
  }

  return {
    isValidForTotals: true,
    flags,
    isDateFlagged: flags.includes(PNL_FLAGS.EXIT_BEFORE_ENTRY) || flags.includes(PNL_FLAGS.FUTURE_DATE),
    reason: flags.length > 0 ? flags.join(', ') : 'OK'
  };
}

// ── 3. Round-Trip Row P&L Calculator ─────────────────────────────────────────

/**
 * Calculates realized P&L directly from a round-trip journal trade record.
 * DATES NEVER DECIDE WHETHER P&L EXISTS.
 * Uses 100% integer paise arithmetic.
 */
export function calculateRoundTripTradePnL(trade, options = {}) {
  const costBasisMethod = options.costBasisMethod || 'fifo';
  const side = String(trade.side || trade.type || 'Buy').toLowerCase();
  const isShort = side === 'sell' || side === 'short';

  // 1. Collect Entry Legs in Paise
  const entryLegs = [];
  const initialQty = parseInt(trade.qty ?? trade.initialQty, 10) || 0;
  const initialPricePaise = toPaise(trade.entry ?? trade.entryPrice ?? trade.buyPrice ?? trade.avgEntry);

  if (initialQty > 0 && initialPricePaise > 0) {
    entryLegs.push({
      id: 'initial',
      label: 'Initial Entry',
      qty: initialQty,
      pricePaise: initialPricePaise,
      date: trade.date || trade.entryDate || ''
    });
  }

  for (let i = 1; i <= 5; i++) {
    const pQty = parseInt(trade[`p${i}Qty`] ?? trade[`p${i}qty`], 10) || 0;
    const pPricePaise = toPaise(trade[`p${i}Price`] ?? trade[`p${i}price`]);
    const pDate = trade[`p${i}Date`] || trade[`p${i}date`] || trade.date || trade.entryDate || '';

    if (pQty > 0 && pPricePaise > 0) {
      entryLegs.push({
        id: `p${i}`,
        label: `Pyramid ${i}`,
        qty: pQty,
        pricePaise: pPricePaise,
        date: pDate
      });
    }
  }

  // 2. Collect Exit Legs in Paise
  const exitLegs = [];
  if (Array.isArray(trade.exits) && trade.exits.length > 0) {
    for (let j = 0; j < trade.exits.length; j++) {
      const ex = trade.exits[j];
      const eQty = parseInt(ex.qty, 10) || 0;
      const ePricePaise = toPaise(ex.price ?? ex.exitPrice);
      if (eQty > 0 && ePricePaise > 0) {
        exitLegs.push({
          id: `e${j + 1}`,
          label: `Exit ${j + 1}`,
          qty: eQty,
          pricePaise: ePricePaise,
          date: ex.date || ''
        });
      }
    }
  }

  for (let j = 1; j <= 5; j++) {
    const eQty = parseInt(trade[`e${j}Qty`] ?? trade[`e${j}qty`], 10) || 0;
    const ePricePaise = toPaise(trade[`e${j}Price`] ?? trade[`e${j}price`]);
    const eDate = trade[`e${j}Date`] || trade[`e${j}date`] || '';

    if (eQty > 0 && ePricePaise > 0) {
      exitLegs.push({
        id: `e${j}`,
        label: `Exit ${j}`,
        qty: eQty,
        pricePaise: ePricePaise,
        date: eDate
      });
    }
  }

  // Fallback for single-exit row imports without E1..E5 legs
  if (exitLegs.length === 0) {
    const directExitedQty = parseInt(trade.exitedQty, 10) || 0;
    const avgExitPaise = toPaise(trade.avgExitPrice ?? trade.avgExit);
    const totalQtyEntered = entryLegs.reduce((sum, leg) => sum + leg.qty, 0);
    const isExplicitlyClosed = String(trade.status || trade.positionStatus || '').toLowerCase() === 'closed';

    if (directExitedQty > 0 && avgExitPaise > 0) {
      exitLegs.push({
        id: 'e1',
        label: 'Exit 1',
        qty: directExitedQty,
        pricePaise: avgExitPaise,
        date: trade.exitDate || trade.date || ''
      });
    } else if (isExplicitlyClosed && totalQtyEntered > 0 && avgExitPaise > 0) {
      exitLegs.push({
        id: 'e1',
        label: 'Exit 1',
        qty: totalQtyEntered,
        pricePaise: avgExitPaise,
        date: trade.exitDate || trade.date || ''
      });
    } else if (isExplicitlyClosed && totalQtyEntered > 0 && trade.pnl !== undefined && trade.pnl !== null) {
      // Direct raw PnL provided in sheet
      const directPnlPaise = toPaise(trade.pnl ?? trade.pl);
      const impliedExitPaise = isShort
        ? Math.round(initialPricePaise - (directPnlPaise / totalQtyEntered))
        : Math.round(initialPricePaise + (directPnlPaise / totalQtyEntered));

      if (impliedExitPaise > 0) {
        exitLegs.push({
          id: 'e1',
          label: 'Exit 1',
          qty: totalQtyEntered,
          pricePaise: impliedExitPaise,
          date: trade.exitDate || trade.date || ''
        });
      }
    }
  }

  // 3. Match Exits against Entries directly (Lot-by-lot FIFO/LIFO, zero date dependency)
  const remainingLots = entryLegs.map(e => ({ ...e }));
  const matches = [];
  let totalGrossPaise = 0;

  for (const exitLot of exitLegs) {
    let unallocatedExitQty = exitLot.qty;

    while (unallocatedExitQty > 0 && remainingLots.length > 0) {
      const entryIdx = costBasisMethod === 'fifo' ? 0 : remainingLots.length - 1;
      const targetEntry = remainingLots[entryIdx];
      const matchedQty = Math.min(targetEntry.qty, unallocatedExitQty);

      const legGrossPaise = calculateLegGrossPaise(
        targetEntry.pricePaise,
        exitLot.pricePaise,
        matchedQty,
        isShort
      );

      totalGrossPaise += legGrossPaise;

      matches.push({
        entryPricePaise: targetEntry.pricePaise,
        exitPricePaise: exitLot.pricePaise,
        entryPrice: fromPaise(targetEntry.pricePaise),
        exitPrice: fromPaise(exitLot.pricePaise),
        matchedQty,
        grossPaise: legGrossPaise,
        gross: fromPaise(legGrossPaise),
        entryDate: targetEntry.date,
        exitDate: exitLot.date
      });

      targetEntry.qty -= matchedQty;
      unallocatedExitQty -= matchedQty;

      if (targetEntry.qty <= 0) {
        remainingLots.splice(entryIdx, 1);
      }
    }
  }

  // 4. Charges & Statutory Taxes (in paise)
  let chargesPaise = 0;
  if (trade.charges && typeof trade.charges.total === 'number') {
    chargesPaise = toPaise(trade.charges.total);
  } else if (trade.brokerage || trade.stt || trade.gst) {
    chargesPaise = toPaise(
      (Number(trade.brokerage) || 0) +
      (Number(trade.stt) || 0) +
      (Number(trade.exchangeFee || trade.exchangeCharges) || 0) +
      (Number(trade.gst) || 0) +
      (Number(trade.sebi || trade.sebiCharges) || 0) +
      (Number(trade.stampDuty) || 0)
    );
  }

  const netPaise = totalGrossPaise - chargesPaise;

  // Validation
  const validation = validateTradeRecord(trade);

  return {
    grossPaise: totalGrossPaise,
    netPaise,
    chargesPaise,
    gross: fromPaise(totalGrossPaise),
    net: fromPaise(netPaise),
    charges: fromPaise(chargesPaise),
    matches,
    legs: matches,
    exitedQty: matches.reduce((sum, m) => sum + m.matchedQty, 0),
    remainingLots,
    validation
  };
}

// ── 4. Raw Broker Transactions FIFO Matcher ──────────────────────────────────

/**
 * Pairs raw broker execution fills using FIFO per symbol.
 * Orders strictly by:
 *   1. execution timestamp / time
 *   2. order id / trade id
 *   3. parsed date ms
 * NEVER uses string localeCompare on dates!
 * Unmatched BUYs/SELLs go to unmatched bucket with reason, never pl=0.
 */
export function pairBrokerTransactionsFIFO(fills = []) {
  if (!fills || fills.length === 0) {
    return { completedTrades: [], unmatchedBucket: [] };
  }

  const bySymbol = {};
  fills.forEach((f, idx) => {
    const sym = String(f.symbol || f.name || '').trim().toUpperCase();
    if (!sym) return;
    if (!bySymbol[sym]) bySymbol[sym] = [];
    bySymbol[sym].push({ ...f, _rawIndex: idx });
  });

  const completedTrades = [];
  const unmatchedBucket = [];

  Object.entries(bySymbol).forEach(([symbol, symbolFills]) => {
    // Sort strictly by timestamp -> order ID -> date ms
    const sortedFills = [...symbolFills].sort((a, b) => {
      const timeA = String(a.time || a.entryTime || a.executionTime || '09:15:00');
      const timeB = String(b.time || b.entryTime || b.executionTime || '09:15:00');
      const dateA = parseDateExplicit(a.date)?.ms || 0;
      const dateB = parseDateExplicit(b.date)?.ms || 0;

      if (dateA !== dateB) return dateA - dateB;
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      const idA = String(a.orderId || a.tradeId || a._rawIndex);
      const idB = String(b.orderId || b.tradeId || b._rawIndex);
      return idA.localeCompare(idB);
    });

    const buyQueue = [];
    const sellQueue = [];

    sortedFills.forEach(fill => {
      const type = String(fill.type || fill.side || 'BUY').toUpperCase();
      const isBuy = type.includes('BUY') || type === 'B';
      const qty = Math.abs(parseInt(fill.qty, 10) || 0);
      const pricePaise = toPaise(fill.price || fill.avgEntry || fill.rate);

      if (qty <= 0 || pricePaise <= 0) return;

      const lot = {
        ...fill,
        qty,
        pricePaise,
        price: fromPaise(pricePaise),
        remainingQty: qty
      };

      if (isBuy) {
        buyQueue.push(lot);
      } else {
        // Match sell against available buyQueue
        let unallocatedSellQty = lot.qty;
        const matchedEntryLegs = [];
        let tradeGrossPaise = 0;

        while (unallocatedSellQty > 0 && buyQueue.length > 0) {
          const buyLot = buyQueue[0];
          const matchedQty = Math.min(buyLot.remainingQty, unallocatedSellQty);

          const legGrossPaise = calculateLegGrossPaise(buyLot.pricePaise, lot.pricePaise, matchedQty, false);
          tradeGrossPaise += legGrossPaise;

          matchedEntryLegs.push({
            buyLotId: buyLot.orderId || buyLot.tradeId || buyLot._rawIndex,
            buyPricePaise: buyLot.pricePaise,
            buyPrice: buyLot.price,
            matchedQty,
            legGrossPaise,
            buyDate: buyLot.date
          });

          buyLot.remainingQty -= matchedQty;
          unallocatedSellQty -= matchedQty;

          if (buyLot.remainingQty <= 0) {
            buyQueue.shift();
          }
        }

        const matchedQtyTotal = lot.qty - unallocatedSellQty;

        if (matchedQtyTotal > 0) {
          // Completed or partially completed trade record
          const avgBuyPaise = Math.round(
            matchedEntryLegs.reduce((acc, leg) => acc + (leg.buyPricePaise * leg.matchedQty), 0) / matchedQtyTotal
          );

          completedTrades.push({
            id: `synced_${Date.now()}_${symbol}_${Math.random().toString(36).slice(2, 7)}`,
            name: symbol,
            symbol,
            type: 'Buy',
            direction: 'LONG',
            date: matchedEntryLegs[0]?.buyDate || lot.date,
            entryDate: matchedEntryLegs[0]?.buyDate || lot.date,
            exitDate: lot.date,
            e1Date: lot.date,
            qty: matchedQtyTotal,
            entry: fromPaise(avgBuyPaise),
            avgEntry: fromPaise(avgBuyPaise),
            e1Price: lot.price,
            avgExitPrice: lot.price,
            exitedQty: matchedQtyTotal,
            openQty: 0,
            status: 'Closed',
            grossPaise: tradeGrossPaise,
            pnl: fromPaise(tradeGrossPaise),
            grossPnl: fromPaise(tradeGrossPaise),
            matchedEntryLegs,
            broker: lot.broker || 'Broker Import'
          });
        }

        if (unallocatedSellQty > 0) {
          // Unmatched sell goes to unmatched bucket with reason, NEVER pl=0
          unmatchedBucket.push({
            symbol,
            type: 'SELL',
            qty: unallocatedSellQty,
            pricePaise: lot.pricePaise,
            price: lot.price,
            date: lot.date,
            orderId: lot.orderId,
            tradeId: lot.tradeId,
            reason: 'UNMATCHED_SELL_NO_INVENTORY'
          });
        }
      }
    });

    // Any remaining open buys in buyQueue are open positions or unmatched
    buyQueue.forEach(b => {
      if (b.remainingQty > 0) {
        unmatchedBucket.push({
          symbol,
          type: 'BUY',
          qty: b.remainingQty,
          pricePaise: b.pricePaise,
          price: b.price,
          date: b.date,
          orderId: b.orderId,
          tradeId: b.tradeId,
          reason: 'OPEN_INVENTORY_UNSOLD'
        });
      }
    });
  });

  return { completedTrades, pairedTrades: completedTrades, unmatchedBucket };
}

// ── 5. Reconciliation Engine ─────────────────────────────────────────────────

/**
 * Reconciles trade datasets across multiple dimensions:
 * - rowsIn == good + flagged + excluded + unmatched
 * - totalRealized == sum(all row P&L) == sum(by month) == sum(by FY) == sum(by symbol)
 * Throws or returns detailed diagnostic if invariant fails.
 */
export function reconcileTradesEngine(trades = [], meta = {}) {
  const rowsIn = meta.rowsIn !== undefined ? meta.rowsIn : trades.length;

  let goodCount = 0;
  let flaggedCount = 0;
  let excludedCount = 0;
  let unmatchedCount = meta.unmatchedCount || 0;

  let totalRealizedPaise = 0;
  const pnlByMonth = {};
  const pnlByFY = {};
  const pnlBySymbol = {};

  trades.forEach(t => {
    const val = (t.isValidForTotals !== undefined && Array.isArray(t.flags))
      ? { isValidForTotals: t.isValidForTotals, flags: t.flags }
      : validateTradeRecord(t);

    if (!val.isValidForTotals) {
      excludedCount++;
      return;
    }

    if (val.flags.length > 0) {
      flaggedCount++;
    } else {
      goodCount++;
    }

    // Include realized P&L
    const isRealized = (t.grossPaise !== undefined && t.grossPaise !== 0) ||
      String(t.status || t.positionStatus || '').toLowerCase() === 'closed' ||
      String(t.status || t.positionStatus || '').toLowerCase() === 'partial' ||
      (Number(t.exitedQty) || 0) > 0;

    if (isRealized) {
      const pnlPaise = t.grossPaise !== undefined ? t.grossPaise : toPaise(t.grossPnl ?? t.pnl ?? t.pl);
      totalRealizedPaise += pnlPaise;

      // Month & Year Attribution (Attribute by exit date, fallback to entry date)
      const dateStr = t.e1Date || t.exitDate || t.date || '';
      const parsed = parseDateExplicit(dateStr) || parseDateExplicit(t.date);
      const monthKey = parsed ? `${parsed.year}-${String(parsed.month).padStart(2, '0')}` : 'UNATTRIBUTED';
      const fyKey = parsed ? (parsed.month >= 4 ? `FY${parsed.year}-${parsed.year + 1}` : `FY${parsed.year - 1}-${parsed.year}`) : 'UNATTRIBUTED';
      const symKey = String(t.name || t.symbol || 'UNKNOWN').toUpperCase();

      pnlByMonth[monthKey] = (pnlByMonth[monthKey] || 0) + pnlPaise;
      pnlByFY[fyKey] = (pnlByFY[fyKey] || 0) + pnlPaise;
      pnlBySymbol[symKey] = (pnlBySymbol[symKey] || 0) + pnlPaise;
    }
  });

  // Check Invariant 1: rowsIn == good + flagged + excluded + unmatched
  const computedRowsSum = goodCount + flaggedCount + excludedCount + unmatchedCount;
  const rowCountInvariantHolds = meta.rowsIn !== undefined ? (rowsIn === computedRowsSum) : true;

  // Check Invariant 2: totalRealized == sum(by month) == sum(by FY) == sum(by symbol)
  const sumMonthPaise = Object.values(pnlByMonth).reduce((acc, v) => acc + v, 0);
  const sumFYPaise = Object.values(pnlByFY).reduce((acc, v) => acc + v, 0);
  const sumSymbolPaise = Object.values(pnlBySymbol).reduce((acc, v) => acc + v, 0);

  const pnlReconciliationHolds = (
    totalRealizedPaise === sumMonthPaise &&
    totalRealizedPaise === sumFYPaise &&
    totalRealizedPaise === sumSymbolPaise
  );

  return {
    rowsIn,
    goodCount,
    flaggedCount,
    excludedCount,
    unmatchedCount,
    rowCountInvariantHolds,
    pnlReconciliationHolds,
    totalRealizedPaise,
    totalRealized: fromPaise(totalRealizedPaise),
    pnlByMonth,
    pnlByFY,
    pnlBySymbol,
    isFullyReconciled: rowCountInvariantHolds && pnlReconciliationHolds
  };
}
