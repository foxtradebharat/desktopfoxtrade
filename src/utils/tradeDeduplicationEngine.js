/**
 * Trade Deduplication Engine for FoxTrade
 * ─────────────────────────────────────────────────────────────────────────────
 * Implements multi-tier deduplication & smart upsert defense:
 * 1. Canonical Symbol & Date Normalization (NSE/BSE suffixes, Indian date formats)
 * 2. Exchange Execution Identifiers (allExchangeTradeIds, orderId, tradeId, fillId)
 * 3. Broker-Specific Adapters (Zerodha, Dhan, Upstox, Groww, AngelOne, ICICI, Motilal, mStock)
 * 4. Deterministic Content Signature (csvSignatureKey for manual/custom imports)
 * 5. Smart Leg Merging (merges pyramids P1-P4 and exits E1-E5 onto open trades without duplicating)
 */

import { getCanonicalSymbol } from './securityMaster.js';

export function normalizeId(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (
    !str ||
    str === '0' ||
    str === '[]' ||
    str === '{}' ||
    str === '-' ||
    str.toUpperCase() === 'N/A' ||
    str.toUpperCase() === 'NAN' ||
    str.toLowerCase() === 'null' ||
    str.toLowerCase() === 'undefined' ||
    str.toLowerCase() === 'none'
  ) return '';
  return str;
}

/**
 * Normalizes any date representation (ISO, DD-MM-YYYY, DD/MM/YYYY, Timestamp)
 * into a canonical YYYY-MM-DD string for deterministic cross-format matching.
 */
export function normalizeDateToCanonical(dateVal) {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (!str) return '';

  // 1. ISO format YYYY-MM-DD or YYYY/MM/DD (with optional time)
  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(str);
  if (ymd) {
    const y = ymd[1];
    const m = String(ymd[2]).padStart(2, '0');
    const d = String(ymd[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Indian broker format DD-MM-YYYY or DD/MM/YYYY (with optional time)
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(str);
  if (dmy) {
    const d = String(dmy[1]).padStart(2, '0');
    const m = String(dmy[2]).padStart(2, '0');
    const y = dmy[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Native Date parse fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str;
}

/**
 * Strips broker/exchange artifacts (.NS, .BO, -EQ, -BE) and returns canonical ticker
 */
export function normalizeSymbol(rawSymbol) {
  if (!rawSymbol) return '';
  const s = String(rawSymbol)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/\.(NS|BO|NSE|BSE)$/i, '')
    .replace(/-(EQ|BE|SM|ST)$/i, '');
  try {
    return getCanonicalSymbol ? getCanonicalSymbol(s) : s;
  } catch {
    return s;
  }
}

/**
 * Builds a deterministic content signature for matching trades even when
 * brokers omit exchange order IDs or when importing generic CSVs.
 */
export function buildTradeSignatureKey(trade) {
  if (!trade) return '';
  const sym = normalizeSymbol(trade.name || trade.symbol || trade.scripName || trade.scrip);
  if (!sym) return '';

  const rawDate = trade.date || trade.entryDate || trade.tradeDate || trade.executionDate || trade.orderDate || '';
  const date = normalizeDateToCanonical(rawDate);

  const entry = Number(
    trade.entry ?? trade.avgEntry ?? trade.entryPrice ?? trade.price ?? trade.tradePrice ?? trade.rate ?? trade.p1Price ?? 0
  ).toFixed(2);

  const qty = Number(
    trade.qty ?? trade.initialQty ?? trade.quantity ?? trade.tradeQty ?? trade.tradedQty ?? trade.p1Qty ?? 0
  );

  const type = String(trade.type || trade.side || trade.tradeType || trade.transType || 'Buy').trim().toUpperCase();

  return `sig:${sym}|${date}|${type}|${entry}|${qty}`;
}

export function extractTradeIdentifiers(trade) {
  const ids = new Set();

  const directId = normalizeId(trade.id);
  if (directId && !directId.startsWith('trade-import-') && !directId.startsWith('synced_')) {
    ids.add(`id:${directId}`);
  }

  // 1. All Exchange Trade IDs (comma/semicolon/bracket separated)
  const exchangeIds = Array.isArray(trade.allExchangeTradeIds)
    ? trade.allExchangeTradeIds
    : typeof trade.allExchangeTradeIds === 'string'
      ? trade.allExchangeTradeIds.replace(/[\[\]]/g, '').split(/[,;|]/).map(s => s.trim()).filter(Boolean)
      : [];

  exchangeIds.forEach(id => {
    const cleaned = normalizeId(id);
    if (cleaned && !cleaned.startsWith('JOURNAL-') && cleaned !== '[]' && cleaned !== '{}') {
      ids.add(`ex:${cleaned}`);
    }
  });

  // 2. Broker-Specific IDs & Execution references
  const brokerSpecificFields = [
    trade.tradeId, trade.trade_id, trade.exchangeTradeId, trade.exchange_trade_id,
    trade.orderId, trade.order_id, trade.exchangeOrderId, trade.exchange_order_id,
    trade.orderNo, trade.order_no, trade.orderNumber,
    trade.tradeNo, trade.trade_no, trade.tradeNumber,
    trade.fillId, trade.fill_id, trade.execId, trade.exec_id,
    trade.brokerTradeId, trade.subtranNo, trade.orderRef
  ];

  brokerSpecificFields.forEach(val => {
    const cleaned = normalizeId(val);
    if (cleaned && cleaned.toUpperCase() !== 'IPO') {
      ids.add(`broker_id:${cleaned}`);
    }
  });

  // 3. Deterministic Content Signature (Date + Symbol + Price + Qty)
  const sig = trade.csvSignatureKey || buildTradeSignatureKey(trade);
  if (sig) {
    ids.add(sig);
  }

  return Array.from(ids);
}

export function findMatchingExistingTrade(incomingTrade, existingTradesIndex) {
  const incomingIds = extractTradeIdentifiers(incomingTrade);
  for (const id of incomingIds) {
    if (existingTradesIndex.has(id)) {
      return existingTradesIndex.get(id);
    }
  }
  return null;
}

export function buildExistingTradesIndex(existingTrades = []) {
  const index = new Map();
  for (const trade of existingTrades) {
    const ids = extractTradeIdentifiers(trade);
    for (const id of ids) {
      if (!index.has(id)) {
        index.set(id, trade);
      }
    }
  }
  return index;
}

/**
 * Merges updates (exits, pyramids, stops) from an incoming trade record onto an existing trade.
 */
export function mergeTradeUpdates(existingTrade, incomingTrade) {
  const now = Date.now();
  const merged = { 
    ...existingTrade,
    updatedAt: now,
    clientUpdatedAt: now
  };

  // 1. Combine exchange IDs
  const existingExIds = new Set(
    (Array.isArray(existingTrade.allExchangeTradeIds) ? existingTrade.allExchangeTradeIds : [])
      .map(normalizeId)
      .filter(Boolean)
  );
  const incomingExIds = (Array.isArray(incomingTrade.allExchangeTradeIds) ? incomingTrade.allExchangeTradeIds : [])
    .map(normalizeId)
    .filter(Boolean);
  incomingExIds.forEach(id => existingExIds.add(id));
  merged.allExchangeTradeIds = Array.from(existingExIds);

  // 2. Merge Pyramid Additions (P1 to P4)
  for (let i = 1; i <= 4; i++) {
    if (incomingTrade[`p${i}Price`] && (!merged[`p${i}Price`] || merged[`p${i}Price`] === 0)) {
      merged[`p${i}Price`] = incomingTrade[`p${i}Price`];
      merged[`p${i}Qty`] = incomingTrade[`p${i}Qty`] || 0;
      merged[`p${i}Date`] = incomingTrade[`p${i}Date`] || '';
      if (incomingTrade[`p${i}Sl`]) merged[`p${i}Sl`] = incomingTrade[`p${i}Sl`];
    }
  }

  // 3. Merge Stop Loss, TSL, and Target
  if (incomingTrade.sl && (!merged.sl || merged.sl === 0)) merged.sl = incomingTrade.sl;
  if (incomingTrade.tsl && (!merged.tsl || merged.tsl === 0)) merged.tsl = incomingTrade.tsl;
  if (incomingTrade.cmp && (!merged.cmp || merged.cmp === 0)) merged.cmp = incomingTrade.cmp;
  if (incomingTrade.broker && !merged.broker) merged.broker = incomingTrade.broker;

  // 4. Merge Exit Legs (E1 to E5) and Position Closure
  const incomingStatus = String(incomingTrade.status || incomingTrade.positionStatus || '').trim().toLowerCase();
  const existingStatus = String(existingTrade.status || existingTrade.positionStatus || '').trim().toLowerCase();

  const incomingHasExits = (incomingTrade.avgExitPrice || incomingTrade.avgExit || incomingTrade.e1Price) &&
    (incomingTrade.exitedQty || incomingTrade.e1Qty);

  if ((existingStatus === 'open' || existingStatus === 'partial') && (incomingStatus === 'closed' || incomingHasExits)) {
    merged.status = incomingTrade.status || 'Closed';
    merged.positionStatus = incomingTrade.positionStatus || merged.status;
    merged.avgExit = incomingTrade.avgExit || incomingTrade.avgExitPrice || merged.avgExit;
    merged.avgExitPrice = incomingTrade.avgExitPrice || incomingTrade.avgExit || merged.avgExitPrice;
    merged.exitedQty = incomingTrade.exitedQty || incomingTrade.e1Qty || merged.exitedQty;
    merged.openQty = incomingTrade.openQty !== undefined ? incomingTrade.openQty : 0;
    
    if (incomingTrade.e1Price) merged.e1Price = incomingTrade.e1Price;
    if (incomingTrade.e1Qty) merged.e1Qty = incomingTrade.e1Qty;
    if (incomingTrade.e1Date) merged.e1Date = incomingTrade.e1Date;
    if (incomingTrade.e2Price) merged.e2Price = incomingTrade.e2Price;
    if (incomingTrade.e2Qty) merged.e2Qty = incomingTrade.e2Qty;
    if (incomingTrade.e2Date) merged.e2Date = incomingTrade.e2Date;
    if (incomingTrade.e3Price) merged.e3Price = incomingTrade.e3Price;
    if (incomingTrade.e3Qty) merged.e3Qty = incomingTrade.e3Qty;
    if (incomingTrade.e3Date) merged.e3Date = incomingTrade.e3Date;
    if (incomingTrade.e4Price) merged.e4Price = incomingTrade.e4Price;
    if (incomingTrade.e4Qty) merged.e4Qty = incomingTrade.e4Qty;
    if (incomingTrade.e4Date) merged.e4Date = incomingTrade.e4Date;
    if (incomingTrade.e5Price) merged.e5Price = incomingTrade.e5Price;
    if (incomingTrade.e5Qty) merged.e5Qty = incomingTrade.e5Qty;
    if (incomingTrade.e5Date) merged.e5Date = incomingTrade.e5Date;

    if (incomingTrade.pnl !== undefined) merged.pnl = incomingTrade.pnl;
    if (incomingTrade.realisedAmount !== undefined) merged.realisedAmount = incomingTrade.realisedAmount;
    if (incomingTrade.grossPnl !== undefined) merged.grossPnl = incomingTrade.grossPnl;
    if (incomingTrade.holdingDays) merged.holdingDays = incomingTrade.holdingDays;
    if (incomingTrade.exitTrigger) merged.exitTrigger = incomingTrade.exitTrigger;
  }

  // 5. Notes & Setup preservation
  if (!merged.notes && incomingTrade.notes) merged.notes = incomingTrade.notes;
  if (!merged.setup && incomingTrade.setup) merged.setup = incomingTrade.setup;

  return merged;
}

/**
 * Main Deduplication & Upsert Pipeline
 * Takes current trades and incoming imported trades, drops identical duplicates,
 * merges exits/pyramids onto matching open positions, and appends new trades.
 */
export function deduplicateAndMergeTrades(existingTrades = [], incomingTrades = [], options = {}) {
  const {
    activePortfolioId = 'portfolio-default',
    enrichFn = (t) => t
  } = options;

  const currentPortfolioTrades = existingTrades.filter(
    t => (t.portfolioId || 'portfolio-default') === activePortfolioId
  );
  const otherPortfolioTrades = existingTrades.filter(
    t => (t.portfolioId || 'portfolio-default') !== activePortfolioId
  );

  const existingIndex = buildExistingTradesIndex(currentPortfolioTrades);
  const batchIndex = new Map();

  const finalCurrentPortfolio = [...currentPortfolioTrades];
  let newTradesCount = 0;
  let updatedTradesCount = 0;
  let skippedDuplicatesCount = 0;

  for (const incoming of incomingTrades) {
    const existingMatch = findMatchingExistingTrade(incoming, existingIndex);

    if (existingMatch) {
      const existingStatus = String(existingMatch.status || existingMatch.positionStatus || '').toLowerCase();
      const incomingStatus = String(incoming.status || incoming.positionStatus || '').toLowerCase();
      const hasNewExit = (incoming.avgExitPrice || incoming.e1Price) && !existingMatch.avgExitPrice;
      const hasNewPyramid = (incoming.p1Price && !existingMatch.p1Price) || (incoming.p2Price && !existingMatch.p2Price);

      // Check if incoming provides new exit or pyramid data
      if ((existingStatus === 'open' || existingStatus === 'partial') && (incomingStatus === 'closed' || hasNewExit || hasNewPyramid)) {
        const matchIdx = finalCurrentPortfolio.findIndex(t => t.id === existingMatch.id);
        if (matchIdx !== -1) {
          const merged = mergeTradeUpdates(finalCurrentPortfolio[matchIdx], incoming);
          finalCurrentPortfolio[matchIdx] = enrichFn(merged);
          updatedTradesCount++;
          continue;
        }
      }

      skippedDuplicatesCount++;
      continue;
    }

    // Check for in-batch duplicates within the same import file
    const inBatchMatch = findMatchingExistingTrade(incoming, batchIndex);
    if (inBatchMatch) {
      skippedDuplicatesCount++;
      continue;
    }

    const now = Date.now();
    const freshTrade = enrichFn({
      ...incoming,
      portfolioId: activePortfolioId,
      id: incoming.id && !incoming.id.startsWith('trade-import-') && !incoming.id.startsWith('synced_')
        ? incoming.id
        : `trade_${now}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: incoming.createdAt || now,
      updatedAt: now,
      clientUpdatedAt: now
    });

    finalCurrentPortfolio.push(freshTrade);
    newTradesCount++;

    const freshIds = extractTradeIdentifiers(freshTrade);
    freshIds.forEach(id => {
      existingIndex.set(id, freshTrade);
      batchIndex.set(id, freshTrade);
    });
  }

  const renumberedCurrent = finalCurrentPortfolio.map((t, idx) => ({
    ...t,
    tradeNo: idx + 1
  }));

  return {
    combinedTrades: [...otherPortfolioTrades, ...renumberedCurrent],
    newTradesCount,
    updatedTradesCount,
    skippedDuplicatesCount,
    totalPortfolioTrades: renumberedCurrent.length
  };
}
