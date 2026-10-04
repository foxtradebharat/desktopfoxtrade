/**
 * Contract Note & Paste-to-Import Parser for Foxy AI
 * Parses raw text, broker clipboard pastes, and contract note summaries for Indian markets (NSE/BSE).
 */

import { normalizeBrokerId } from './brokerIds.js';

function cleanNumber(val, fallback = 0) {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const cleaned = String(val).replace(/[₹$,% ]/g, '').trim();
  if (cleaned === '' || cleaned === '-' || cleaned === 'N/A' || cleaned === 'null') return fallback;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? fallback : parsed;
}

function normalizeDateString(val) {
  if (!val) {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  }
  const str = String(val).trim();
  const ymd = /^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/.exec(str);
  if (ymd) {
    return `${String(ymd[3]).padStart(2, '0')}-${String(ymd[2]).padStart(2, '0')}-${ymd[1]}`;
  }
  const dmy = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})/.exec(str);
  if (dmy) {
    return `${String(dmy[1]).padStart(2, '0')}-${String(dmy[2]).padStart(2, '0')}-${dmy[3]}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  }
  return str;
}

/**
 * Budget 2024 Statutory Charges & STT Calculation
 * Effective Oct 1, 2024: Futures STT = 0.02%, Options Premium STT = 0.1%
 */
export function calculateIndianCharges({ segment = 'EQUITY_DELIVERY', buyValue = 0, sellValue = 0, broker = 'zerodha' }) {
  const totalTurnover = buyValue + sellValue;
  let brokerage = 0;
  let exchangeCharges = totalTurnover * 0.0000345;
  let sebiCharges = totalTurnover * 0.000001;
  let stampDuty = buyValue * 0.00015;
  let stt = 0;

  if (segment === 'EQUITY_DELIVERY') {
    brokerage = broker.toLowerCase() === 'zerodha' ? 0 : Math.min(20, totalTurnover * 0.0003);
    stt = totalTurnover * 0.001; // 0.1% on delivery buy and sell
  } else if (segment === 'EQUITY_INTRADAY') {
    brokerage = Math.min(20, buyValue * 0.0003) + Math.min(20, sellValue * 0.0003);
    stt = sellValue * 0.00025; // 0.025% on intraday sell
  } else if (segment === 'FNO_FUTURES') {
    brokerage = Math.min(20, totalTurnover * 0.0003);
    stt = sellValue * 0.0002; // Budget 2024 revised STT from Oct 1, 2024: 0.02%
  } else if (segment === 'FNO_OPTIONS') {
    brokerage = 40;
    stt = sellValue * 0.001; // Budget 2024 revised STT from Oct 1, 2024: 0.1% on premium
  }

  const gst = (brokerage + exchangeCharges + sebiCharges) * 0.18;
  const totalCharges = Math.round(brokerage + stt + exchangeCharges + sebiCharges + stampDuty + gst);

  return {
    brokerage: Math.round(brokerage),
    stt: Math.round(stt),
    exchangeCharges: Math.round(exchangeCharges),
    stampDuty: Math.round(stampDuty),
    sebiCharges: Math.round(sebiCharges),
    gst: Math.round(gst),
    totalCharges
  };
}

/**
 * Parses raw text pasted by user or extracted from contract notes
 */
export function parseRawTradeText(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const trades = [];

  // Check if it's CSV / TSV
  if (lines.length > 1 && (lines[0].includes(',') || lines[0].includes('\t'))) {
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
    
    const symIdx = headers.findIndex(h => h.includes('symbol') || h.includes('scrip') || h.includes('name') || h.includes('stock'));
    const sideIdx = headers.findIndex(h => h.includes('type') || h.includes('side') || h.includes('action') || h.includes('buy/sell'));
    const qtyIdx = headers.findIndex(h => h.includes('qty') || h.includes('quantity') || h.includes('shares'));
    const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('rate') || h.includes('avg'));
    const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('time'));
    const slIdx = headers.findIndex(h => h.includes('sl') || h.includes('stop'));

    if (symIdx !== -1 && (qtyIdx !== -1 || priceIdx !== -1)) {
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delimiter).map(p => p.trim());
        if (parts.length <= symIdx) continue;
        const sym = parts[symIdx].toUpperCase().replace(/[^A-Z0-9&-]/g, '');
        if (!sym) continue;

        const sideRaw = sideIdx !== -1 ? String(parts[sideIdx]).toUpperCase() : 'BUY';
        const side = (sideRaw.includes('SELL') || sideRaw === 'S') ? 'Sell' : 'Buy';
        const qty = cleanNumber(parts[qtyIdx], 1);
        const price = cleanNumber(parts[priceIdx], 0);
        const date = normalizeDateString(dateIdx !== -1 ? parts[dateIdx] : new Date());
        const sl = slIdx !== -1 ? cleanNumber(parts[slIdx], 0) : 0;

        trades.push({
          symbol: sym,
          side,
          qty,
          price,
          sl,
          date,
          broker: 'Zerodha'
        });
      }
      if (trades.length > 0) return trades;
    }
  }

  // Regex patterns for natural language & single line pastes
  const falsePositives = [
    'BUY', 'SELL', 'BOUGHT', 'SOLD', 'SHORT', 'LONG', 'SHARES', 'QTY', 'QUANTITY', 'LOTS', 
    'DATE', 'PRICE', 'STOP', 'LOSS', 'STOPLOSS', 'TARGET', 'ENTRY', 'EXIT', 'TODAY', 'YESTERDAY',
    'TOTAL', 'ORDER', 'TRADE', 'CONTRACT', 'NOTE', 'BROKER', 'CHARGES', 'TAX', 'TAXES', 'NET', 'GROSS'
  ];

  for (const line of lines) {
    const candidateMatches = [...line.matchAll(/\b([A-Za-z][A-Za-z0-9&-]{2,14})\b/g)];
    let sym = null;
    for (const cm of candidateMatches) {
      const candidate = cm[1].toUpperCase();
      if (!falsePositives.includes(candidate)) {
        sym = candidate;
        break;
      }
    }

    const qtyMatch = line.match(/\b(\d+)\s*(?:shares|qty|lots)?\b/i);
    const priceMatch = line.match(/(?:at|@|price|entry)\s*[:=]?\s*([0-9,.]+)/i);
    const slMatch = line.match(/(?:sl|stop|stoploss)\s*[:=]?\s*([0-9,.]+)/i);
    const sideMatch = line.match(/\b(buy|bought|sell|sold|short)\b/i);
    const dateMatch = line.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/);

    if (sym && priceMatch) {
      const side = sideMatch ? (sideMatch[1].toLowerCase().startsWith('s') ? 'Sell' : 'Buy') : 'Buy';
      const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
      const price = cleanNumber(priceMatch[1], 0);
      const sl = slMatch ? cleanNumber(slMatch[1], 0) : 0;
      const date = dateMatch ? normalizeDateString(dateMatch[1]) : normalizeDateString(new Date());

      trades.push({
        symbol: sym,
        side,
        qty,
        price,
        sl,
        date,
        broker: 'Custom'
      });
    }
  }

  return trades;
}

/**
 * Sanitizes user-provided or OCR-pasted text against prompt injection tokens
 */
function sanitizeImportField(str, maxLength = 100) {
  if (!str) return '';
  return String(str)
    .replace(/<\/?(?:script|iframe|style|object|embed)[^>]*>/gi, '')
    .replace(/\[\/?(?:SYSTEM|INSTRUCTION|ASSISTANT|IMPORT_READY|METRIC|TABLE|VERDICT|CHART)[^\]]*\]/gi, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Formats extracted trades into FoxTrade journal schema
 * Features:
 * - 500-row batch limit
 * - Deterministic deduplication ID hash
 * - Prompt injection sanitization
 */
export function formatExtractedTradesForJournal(parsedTrades = [], portfolioId = 'default') {
  const capped = parsedTrades.slice(0, 500);

  return capped.map((pt, idx) => {
    const isBuy = pt.side === 'Buy';
    const entry = isBuy ? pt.price : 0;
    const exit = !isBuy ? pt.price : 0;
    const qty = Math.max(1, pt.qty || 1);
    const now = Date.now();
    
    // Deterministic deduplication hash
    const cleanSym = sanitizeImportField(pt.symbol, 30).toUpperCase();
    const cleanDate = (pt.date || normalizeDateString(new Date())).replace(/[^0-9]/g, '');
    const tradePrice = Math.round(entry || exit);
    const tradeId = `import_${cleanSym}_${cleanDate}_${isBuy ? 'buy' : 'sell'}_${tradePrice}_${qty}`;

    return {
      id: tradeId,
      tradeNo: idx + 1,
      portfolioId: portfolioId || 'default',
      name: cleanSym,
      date: pt.date || normalizeDateString(new Date()),
      type: pt.side || 'Buy',
      setup: 'Discretionary',
      broker: normalizeBrokerId(pt.broker) || 'zerodha',
      entry: entry,
      avgEntry: entry,
      avgExitPrice: exit,
      qty: qty,
      initialQty: qty,
      openQty: isBuy ? qty : 0,
      exitedQty: !isBuy ? qty : 0,
      sl: pt.sl || 0,
      status: isBuy ? 'Open' : 'Closed',
      pnl: 0,
      notes: sanitizeImportField(`Imported via Foxy AI Contract Note Parser`, 150),
      quickNote: `Foxy AI Import`,
      planFollowed: 'true',
      version: 1,
      createdAt: now,
      updatedAt: now
    };
  });
}
