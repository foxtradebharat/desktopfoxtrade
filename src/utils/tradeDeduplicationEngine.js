/**
 * Trade Deduplication Engine for FoxTrade
 * Implements multi-tier deduplication & upsert defense:
 * 1. Exchange Execution Identifiers (allExchangeTradeIds, orderId, tradeId, exchangeTradeId)
 * 2. Broker-Specific Adapters (Zerodha, Dhan, Upstox, Groww, AngelOne, ICICI, Motilal, mStock)
 * 3. Deterministic Content Signature (csvSignatureKey for manual/custom imports)
 * 4. Smart Upsert/Merge (updates open trades with incoming exit data without duplicating)
 */

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

export function buildTradeSignatureKey(trade) {
  if (!trade) return '';
  const sym = String(trade.name || trade.symbol || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!sym) return '';
  const date = String(trade.date || trade.entryDate || '').trim();
  const entry = Number(trade.entry || trade.avgEntry || trade.p1Price || 0).toFixed(2);
  const qty = Number(trade.qty || trade.initialQty || trade.p1Qty || 0);
  const type = String(trade.type || trade.side || 'Buy').toUpperCase();
  return `sig:${sym}|${date}|${type}|${entry}|${qty}`;
}

export function extractTradeIdentifiers(trade) {
  const ids = new Set();

  const directId = normalizeId(trade.id);
  if (directId && !directId.startsWith('trade-import-') && !directId.startsWith('synced_')) {
    ids.add(`id:${directId}`);
  }

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

  const brokerSpecificFields = [
    trade.tradeId, trade.trade_id, trade.exchangeTradeId, trade.exchange_trade_id,
    trade.orderId, trade.order_id, trade.exchangeOrderId, trade.exchange_order_id,
    trade.subtranNo, trade.orderRef
  ];

  brokerSpecificFields.forEach(val => {
    const cleaned = normalizeId(val);
    if (cleaned && cleaned.toUpperCase() !== 'IPO') {
      ids.add(`broker_id:${cleaned}`);
    }
  });

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

export function mergeTradeUpdates(existingTrade, incomingTrade) {
  const merged = { ...existingTrade };

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

    if (incomingTrade.pnl !== undefined) merged.pnl = incomingTrade.pnl;
    if (incomingTrade.realisedAmount !== undefined) merged.realisedAmount = incomingTrade.realisedAmount;
    if (incomingTrade.grossPnl !== undefined) merged.grossPnl = incomingTrade.grossPnl;
    if (incomingTrade.holdingDays) merged.holdingDays = incomingTrade.holdingDays;
    if (incomingTrade.exitTrigger) merged.exitTrigger = incomingTrade.exitTrigger;
  }

  if (!merged.notes && incomingTrade.notes) merged.notes = incomingTrade.notes;
  if (!merged.setup && incomingTrade.setup) merged.setup = incomingTrade.setup;

  return merged;
}

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

      if ((existingStatus === 'open' || existingStatus === 'partial') && (incomingStatus === 'closed' || hasNewExit)) {
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

    const inBatchMatch = findMatchingExistingTrade(incoming, batchIndex);
    if (inBatchMatch) {
      skippedDuplicatesCount++;
      continue;
    }

    const freshTrade = enrichFn({
      ...incoming,
      portfolioId: activePortfolioId,
      id: incoming.id && !incoming.id.startsWith('trade-import-') && !incoming.id.startsWith('synced_')
        ? incoming.id
        : `trade_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
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
