import * as XLSX from 'xlsx';
import { pairExecutionFills } from '../services/brokerApiService.js';
import { enrichTradeWithFoxFormulas } from './foxCalculationEngine.js';
import { getCanonicalSymbol } from './securityMaster.js';

export const SUPPORTED_BROKERS = [
  { id: 'zerodha', name: 'Zerodha Kite', markers: ['order execution time', 'order_execution_time', 'trade_type'], mandatory: ['trade date', 'trade type'] },
  { id: 'dhan', name: 'Dhan HQ', markers: ['quantity/lot', 'trade price', 'trade value'], mandatory: ['trade price'] },
  { id: 'upstox', name: 'Upstox', markers: ['scrip code', 'trade time'], mandatory: ['scrip code'] },
  { id: 'groww', name: 'Groww', markers: ['isin', 'execution date and time'], mandatory: ['isin'] },
  { id: 'angelone', name: 'Angel One', markers: ['scrip/contract', 'sebi tax'], mandatory: ['scrip/contract'] },
  { id: 'fyers', name: 'FYERS', markers: ['fyers order id', 'date & time'], mandatory: ['fyers order id'] },
  { id: 'mstock', name: 'mStock', markers: ['trade date', 'scrip / contract', 'trade id'], mandatory: ['trade date', 'scrip / contract'] },
  { id: 'sharekhan', name: 'Sharekhan', markers: ['trandate', 'scriptname', 'transtype'], mandatory: ['scriptname'] },
  { id: 'icici', name: 'ICICI Direct', markers: ['order ref.', 'dp id'], mandatory: ['order ref.'] },
  { id: 'motilal', name: 'Motilal Oswal', markers: ['scrip name', 'trade date', 'buy/sell'], mandatory: ['scrip name'] },
  { id: 'kotak', name: 'Kotak Neo', markers: ['order no', 'exchange trade id'], mandatory: ['order no'] },
  { id: 'stockymind', name: 'Stocky Mind', markers: ['position status', 'plan followed?'], mandatory: ['stock symbol'] },
  { id: 'generic_journal', name: 'Journal Export (CSV)', markers: ['tradeno', 'initialqty', 'p1price', 'positionstatus', 'pfimpact', 'cummpf'], mandatory: ['tradeno'] },
  { id: 'foxtrade', name: 'FoxTrade Journal', markers: ['trade no.', 'initial qty/lot', 'p1 price (₹)', 'position status'], mandatory: ['trade no.'] },
];

/**
 * Detect Broker from headers using marker heuristics
 */
export function detectBrokerFromHeaders(headers = []) {
  if (!headers || headers.length === 0) return { id: 'unknown', name: 'Custom CSV / Excel' };
  const lowerH = headers.map(h => String(h || '').toLowerCase().trim());
  const flat = lowerH.join('|');

  // Check unique markers and mandatory fields
  for (const broker of SUPPORTED_BROKERS) {
    const hasMarker = broker.markers.some(m => flat.includes(m));
    const hasMandatory = broker.mandatory.every(m => flat.includes(m));
    if (hasMarker || hasMandatory) {
      return broker;
    }
  }

  // Fallbacks based on common column combos
  if (flat.includes('stock name') && flat.includes('execution date')) return { id: 'groww', name: 'Groww' };
  if (flat.includes('scrip code') && flat.includes('side')) return { id: 'upstox', name: 'Upstox' };
  if (flat.includes('trade price') && flat.includes('trade value')) return { id: 'dhan', name: 'Dhan HQ' };
  if (flat.includes('order execution time')) return { id: 'zerodha', name: 'Zerodha Kite' };
  if (flat.includes('tradeno') || flat.includes('trade no')) return { id: 'foxtrade', name: 'FoxTrade Journal' };

  return { id: 'unknown', name: 'Custom CSV / Excel' };
}

/**
 * Normalizes date inputs with explicit format override support (DD-MM-YYYY vs MM-DD-YYYY vs YYYY-MM-DD)
 */
export function normalizeDateString(val, formatOverride = 'auto') {
  if (val === undefined || val === null || val === '') {
    return new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '-');
  }

  if (val instanceof Date && !isNaN(val.getTime())) {
    const day = String(val.getDate()).padStart(2, '0');
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const year = val.getFullYear();
    return `${day}-${month}-${year}`;
  }

  // Handle number or numeric string (Excel serial date code like 46263)
  const numVal = typeof val === 'number'
    ? val
    : (typeof val === 'string' && /^\d+(\.\d+)?$/.test(val.trim()) ? parseFloat(val.trim()) : NaN);

  if (!isNaN(numVal) && numVal > 20000 && numVal < 80000) {
    const utcDays = Math.floor(numVal - 25569);
    const ms = utcDays * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}-${month}-${year}`;
    }
  }

  const str = String(val).trim();

  // ISO string e.g. 2026-04-05T00:00:00.000Z
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}-${month}-${year}`;
    }
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymd = /^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/.exec(str);
  if (ymd) {
    const day = String(parseInt(ymd[3], 10)).padStart(2, '0');
    const month = String(parseInt(ymd[2], 10)).padStart(2, '0');
    const year = ymd[1];
    return `${day}-${month}-${year}`;
  }

  // Handle user-specified format override
  if (formatOverride === 'MM-DD-YYYY') {
    const mdy = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})/.exec(str);
    if (mdy) {
      const month = String(parseInt(mdy[1], 10)).padStart(2, '0');
      const day = String(parseInt(mdy[2], 10)).padStart(2, '0');
      const year = mdy[3];
      return `${day}-${month}-${year}`;
    }
  }

  // Default: DD-MM-YYYY or DD/MM/YYYY
  const dmy = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})/.exec(str);
  if (dmy) {
    let p1 = parseInt(dmy[1], 10);
    let p2 = parseInt(dmy[2], 10);
    const year = dmy[3];

    // If format is auto and first part > 12, it must be DD-MM-YYYY
    // If second part > 12, it must be MM-DD-YYYY
    if (formatOverride === 'auto' && p1 <= 12 && p2 > 12) {
      const month = String(p1).padStart(2, '0');
      const day = String(p2).padStart(2, '0');
      return `${day}-${month}-${year}`;
    }

    const day = String(p1).padStart(2, '0');
    const month = String(p2).padStart(2, '0');
    return `${day}-${month}-${year}`;
  }

  // Parse generic date string
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  return str;
}

/**
 * Clean numeric strings
 */
export function cleanNumber(val, fallback = 0) {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const cleaned = String(val).replace(/[₹$,% ]/g, '').trim();
  if (cleaned === '' || cleaned === '-' || cleaned === 'N/A' || cleaned === 'null') return fallback;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? fallback : parsed;
}

export function cleanOptionalNumber(val) {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'number') return isNaN(val) ? undefined : val;
  const cleaned = String(val).replace(/[₹$,% ]/g, '').trim();
  if (cleaned === '' || cleaned === '-' || cleaned === 'N/A' || cleaned === 'null') return undefined;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Finds the header row dynamically by inspecting first 25 rows
 */
export function findHeaderRow(rows) {
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) continue;
    const cleanCells = row.map(c => String(c).toUpperCase().replace(/[^A-Z0-9]/g, ''));

    const hasSymbol = cleanCells.some(c =>
      c === 'SYMBOL' || c === 'TRADINGSYMBOL' || c === 'NAME' || c === 'STOCK' ||
      c === 'SCRIP' || c === 'SCRIPNAME' || c === 'INSTRUMENT' || c === 'STOCKNAME'
    );
    const hasDateOrQty = cleanCells.some(c =>
      c.includes('DATE') || c.includes('QTY') || c.includes('QUANTITY') ||
      c === 'BUYSELL' || c === 'SIDE' || c === 'TYPE' || c === 'PRICE' || c === 'RATE'
    );
    const hasTradeNo = cleanCells.some(c =>
      c === 'TRADENO' || c === 'ID' || c === 'NO' || c === 'SETUP' || c === 'TRADE'
    );

    if ((hasSymbol && hasDateOrQty) || (hasTradeNo && hasSymbol)) {
      return { headerRowIndex: r, headers: row.map(h => String(h).trim()) };
    }
  }

  if (rows.length > 0 && rows[0].length > 0) {
    return { headerRowIndex: 0, headers: rows[0].map(h => String(h).trim()) };
  }

  return { headerRowIndex: -1, headers: [] };
}

/**
 * Helper to match column names strictly avoiding partial leg overlap
 */
function createColumnMatcher(headers) {
  const cleanHeaders = headers.map(h => String(h).toUpperCase().replace(/[^A-Z0-9]/g, ''));

  return (possibleNames, disallowedPrefixes = []) => {
    const cleanPossibles = possibleNames.map(p => p.toUpperCase().replace(/[^A-Z0-9]/g, ''));

    // First pass: Exact match (highest priority)
    for (let hIdx = 0; hIdx < cleanHeaders.length; hIdx++) {
      const cleanH = cleanHeaders[hIdx];
      if (!cleanH) continue;
      if (disallowedPrefixes.some(pref => cleanH.startsWith(pref) || cleanH === pref)) continue;
      if (cleanPossibles.some(p => cleanH === p)) return hIdx;
    }

    // Second pass: Suffix / Substring match avoiding false-positives on short tokens
    for (let hIdx = 0; hIdx < cleanHeaders.length; hIdx++) {
      const cleanH = cleanHeaders[hIdx];
      if (!cleanH) continue;
      if (disallowedPrefixes.some(pref => cleanH.startsWith(pref) || cleanH === pref)) continue;

      for (const p of cleanPossibles) {
        if (cleanH === p) return hIdx;
        // Never allow short abbreviations (<= 3 chars, like 'ID', 'SL', 'NO') to match as arbitrary substrings of words like 'SIDE' or 'NOTES'
        if (p.length <= 3) {
          if (cleanH.endsWith(p) && !['SIDE', 'GUIDE', 'DIVIDEND', 'CONFIDENCE', 'SLIPPAGE', 'NOTES'].includes(cleanH)) {
            // E.g. 'TRADEID', 'ROWID'
            return hIdx;
          }
          continue;
        }
        if (cleanH.includes(p)) return hIdx;
      }
    }

    return -1;
  };
}

/**
 * Read File (File object or ArrayBuffer or CSV text) into 2D Array
 */
export async function readFileToRows(fileInput) {
  let workbook;

  if (typeof fileInput === 'string') {
    workbook = XLSX.read(fileInput, { type: 'string', cellDates: true });
  } else if (fileInput instanceof ArrayBuffer) {
    workbook = XLSX.read(new Uint8Array(fileInput), { type: 'array', cellDates: true });
  } else if (fileInput instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(fileInput))) {
    workbook = XLSX.read(fileInput, { type: 'buffer', cellDates: true });
  } else if (fileInput && typeof fileInput.arrayBuffer === 'function') {
    const buffer = await fileInput.arrayBuffer();
    workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
  } else {
    throw new Error('Unsupported file format or input.');
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('File contains no worksheets.');
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false });
}

/**
 * PREVIEW TRADES FROM FILE
 * Inspects file, detects broker, previews parsed trades & date interpretation WITHOUT saving to database.
 */
export async function previewTradesFromFile(fileInput, options = {}) {
  const {
    dateFormat = 'auto',
    consolidate = true,
    activePortfolioId = 'portfolio-default',
    baseCapital = 100000,
    liveCMPs = {}
  } = options;

  const rows = await readFileToRows(fileInput);
  if (!rows || rows.length < 2) {
    throw new Error('File is empty or contains insufficient data rows.');
  }

  const { headerRowIndex, headers } = findHeaderRow(rows);
  if (headerRowIndex === -1 || headers.length === 0) {
    throw new Error('Could not identify header columns in the uploaded file.');
  }

  const detectedBroker = detectBrokerFromHeaders(headers);
  const dataRows = rows.slice(headerRowIndex + 1).filter(r => Array.isArray(r) && r.some(c => String(c).trim() !== ''));

  // Run full parse with specified options
  const parsedTrades = await parseTradesFromFile(fileInput, {
    dateFormat,
    consolidate,
    activePortfolioId,
    baseCapital,
    liveCMPs,
    startingTradeNo: 1
  });

  // Extract sample raw dates for user verification
  const sampleDates = [];
  const idxMatcher = createColumnMatcher(headers);
  const idxDate = idxMatcher(['DATE', 'TRADE_DATE', 'TRADEDATE', 'ORDER_DATE', 'TIME', 'ENTRY DATE'], ['P1', 'P2', 'E1', 'E2']);
  if (idxDate !== -1) {
    for (let r = 0; r < Math.min(dataRows.length, 5); r++) {
      const rawVal = dataRows[r][idxDate];
      if (rawVal) {
        sampleDates.push({
          raw: String(rawVal),
          parsed: normalizeDateString(rawVal, dateFormat)
        });
      }
    }
  }

  return {
    detectedBroker: detectedBroker.id,
    brokerDisplayName: detectedBroker.name,
    headers,
    totalRows: dataRows.length,
    tradesCount: parsedTrades.length,
    trades: parsedTrades,
    sampleDates
  };
}

/**
 * Universal Trade Importer Engine
 * Parses full journal exports (FoxTrade) or Indian broker execution tradebooks.
 */
export async function parseTradesFromFile(fileInput, options = {}) {
  const {
    activePortfolioId = 'portfolio-default',
    baseCapital = 100000,
    liveCMPs = {},
    startingTradeNo = 1,
    dateFormat = 'auto',
    consolidate = true
  } = options;

  const rows = await readFileToRows(fileInput);
  if (!rows || rows.length < 2) {
    throw new Error('File is empty or contains no data rows.');
  }

  const { headerRowIndex, headers } = findHeaderRow(rows);
  if (headerRowIndex === -1 || headers.length === 0) {
    throw new Error('Could not detect header columns in the file.');
  }

  const detectedBroker = detectBrokerFromHeaders(headers);
  const getIndex = createColumnMatcher(headers);

  // Journal specific column checks
  const idxP1Price   = getIndex(['P1PRICE', 'P1 PRICE', 'P1 PRICE(₹)', 'P1_PRICE']);
  const idxE1Price   = getIndex(['E1PRICE', 'E1 PRICE', 'E1 PRICE(₹)', 'E1_PRICE']);
  const idxSetup     = getIndex(['SETUP', 'STRATEGY', 'PATTERN']);
  const idxTradeNo   = getIndex(['TRADENO', 'TRADE NO', 'TRADE_NO', 'SR NO', 'SRNO', 'NO'], ['P1', 'P2', 'P3', 'P4', 'E1', 'E2', 'E3', 'E4']);
  const idxId        = getIndex(['ID', 'UUID', 'TRADE_UUID', 'ROW_ID', 'TRADE_ID'], ['SIDE', 'GUIDE', 'DIVIDEND', 'CONFIDENCE']);
  const idxExchangeTradeIds = getIndex(['ALLEXCHANGETRADEIDS', 'ALL_EXCHANGE_TRADE_IDS', 'EXCHANGE TRADE IDS', 'EXCHANGE_TRADE_IDS', 'TRADE_IDS']);
  const idxBroker    = getIndex(['BROKER', 'BROKER_NAME', 'SOURCE']);
  const idxTransactionHistory = getIndex(['TRANSACTIONHISTORY', 'TRANSACTION_HISTORY']);
  const idxBrokerTradeId = getIndex(['TRADE_ID', 'TRADEID', 'TRADE ID', 'EXCHANGE_TRADE_ID', 'EXCHANGETRADEID', 'FILL_ID']);
  const idxBrokerOrderId = getIndex(['ORDER_ID', 'ORDERID', 'ORDER ID', 'EXCHANGE_ORDER_ID', 'EXCHANGEORDERID']);
  const idxCMP       = getIndex(['CMP', 'CURRENT PRICE', 'LAST PRICE', 'LTP', 'CURRENTPRICE']);
  const idxSL        = getIndex(['SL', 'STOPLOSS', 'STOP LOSS', 'INITIAL SL', 'INITIALSL'], ['P1', 'P2', 'P3', 'P4', 'E1', 'E2', 'E3', 'E4']);

  // Base Entry and Qty columns (strictly excluding P1..P4 and E1..E4)
  const idxEntry     = getIndex(['ENTRY', 'ENTRY PRICE', 'ENTRYPRICE', 'BUY PRICE', 'BUY AVERAGE', 'BUY_PRICE', 'AVGENTRY', 'AVG ENTRY', 'AVERAGE ENTRY', 'PRICE', 'TRADE_PRICE', 'TRADEPRICE', 'RATE'], ['P1', 'P2', 'P3', 'P4', 'E1', 'E2', 'E3', 'E4']);
  const idxQuantity  = getIndex(['INITIALQTY', 'INITIAL QTY', 'QTY', 'QUANTITY', 'TRADE_QTY', 'TRADEQTY', 'FILLED_QTY', 'NO OF SHARES', 'SHARES', 'QUANTITY/LOT'], ['P1', 'P2', 'P3', 'P4', 'E1', 'E2', 'E3', 'E4']);
  const idxSymbol    = getIndex(['NAME', 'SYMBOL', 'TRADINGSYMBOL', 'TRADING_SYMBOL', 'STOCK', 'SCRIP', 'SCRIP NAME', 'INSTRUMENT', 'STOCK NAME', 'SCRIP / CONTRACT', 'SCRIP/CONTRACT']);
  const idxDate      = getIndex(['DATE', 'TRADE_DATE', 'TRADEDATE', 'ORDER_DATE', 'ORDERDATE', 'TIME', 'ENTRY DATE', 'EXECUTION DATE AND TIME', 'DATE & TIME'], ['P1', 'P2', 'P3', 'P4', 'E1', 'E2', 'E3', 'E4']);
  const idxTradeType = getIndex(['SIDE', 'BUY/SELL', 'BUYSELL', 'TRADE_TYPE', 'TRADETYPE', 'TRANSACTION_TYPE', 'TRANSACTIONTYPE', 'TYPE', 'ACTION', 'DIRECTION', 'BUY / SELL']);
  const idxTime      = getIndex(['ORDER_EXECUTION_TIME', 'EXECUTION_TIME', 'TRADE_TIME', 'TIME'], ['P1', 'P2', 'P3', 'P4', 'E1', 'E2', 'E3', 'E4']);

  const isFullJournal = (idxP1Price !== -1 || idxE1Price !== -1 || idxSetup !== -1 || (idxSL !== -1 && idxCMP !== -1));

  const dataRows = rows.slice(headerRowIndex + 1).filter(r => Array.isArray(r) && r.some(c => String(c).trim() !== ''));

  if (dataRows.length === 0) {
    throw new Error('No data rows found below the header.');
  }

  let resultTrades = [];

  // ── BRANCH 1: BROKER TRADEBOOK INDIVIDUAL FILLS ──────────────────────────
  if (!isFullJournal && idxTradeType !== -1 && idxEntry !== -1 && idxSymbol !== -1) {
    const rawFills = [];

    for (let i = 0; i < dataRows.length; i++) {
      const cols = dataRows[i];
      const rawSym = String(cols[idxSymbol] || '').trim();
      if (!rawSym) continue;
      const sym = getCanonicalSymbol(rawSym);

      const typeStr = String(cols[idxTradeType] || 'BUY').toUpperCase();
      const isBuy = typeStr.includes('BUY') || typeStr === 'B';
      const qty = Math.abs(cleanNumber(cols[idxQuantity], 1));
      const price = cleanNumber(cols[idxEntry], 0);
      const dateStr = normalizeDateString(cols[idxDate], dateFormat);
      const timeStr = idxTime !== -1 ? String(cols[idxTime] || '').trim() : '09:30';

      rawFills.push({
        symbol: sym,
        name: sym,
        type: isBuy ? 'BUY' : 'SELL',
        qty,
        price,
        avgEntry: price,
        avgExit: price,
        date: dateStr,
        entryTime: timeStr,
        exitTime: timeStr,
        broker: detectedBroker.name,
        source: `${detectedBroker.name} Tradebook`,
        tradeId: idxBrokerTradeId !== -1 ? String(cols[idxBrokerTradeId] || '').trim() : undefined,
        orderId: idxBrokerOrderId !== -1 ? String(cols[idxBrokerOrderId] || '').trim() : undefined
      });
    }

    if (consolidate) {
      const paired = pairExecutionFills(rawFills);
      resultTrades = paired.map((p, idx) => {
        const tNo = startingTradeNo + idx;
        const rawTrade = {
          id: p.id || `trade-broker-${Date.now()}-${idx}`,
          tradeNo: tNo,
          portfolioId: activePortfolioId,
          date: p.date,
          allExchangeTradeIds: p.allExchangeTradeIds || [],
          name: p.name || p.symbol,
          setup: p.setup || 'Breakout',
          type: p.direction === 'SHORT' ? 'Sell' : 'Buy',
          entry: p.entry || p.avgEntry || 0,
          avgEntry: p.avgEntry || p.entry || 0,
          sl: p.avgEntry > 0 ? Math.round(p.avgEntry * 0.95 * 100) / 100 : undefined,
          cmp: liveCMPs[p.name || p.symbol] || p.avgExit || p.avgEntry || 0,
          entryType: 'Market',
          qty: p.qty || 0,
          p1Price: p.p1Price || 0,
          p1Qty: p.p1Qty || 0,
          p1Date: p.p1Date || '',
          p2Price: p2PriceSafe(p),
          p2Qty: p.p2Qty || 0,
          p2Date: p.p2Date || '',
          e1Price: p.e1Price || (p.status === 'Closed' && p.avgExit ? p.avgExit : 0),
          e1Qty: p.e1Qty || (p.status === 'Closed' && p.qty ? p.qty : 0),
          e1Date: p.e1Date || p.date,
          e2Price: p.e2Price || 0,
          e2Qty: p.e2Qty || 0,
          e2Date: p.e2Date || '',
          e3Price: p.e3Price || 0,
          e3Qty: p.e3Qty || 0,
          e3Date: p.e3Date || '',
          openQty: p.openQty ?? 0,
          exitedQty: p.exitedQty ?? 0,
          avgExitPrice: p.avgExitPrice || p.avgExit || 0,
          planFollowed: 'Yes',
          status: p.status || 'Closed',
          pnl: p.pnl || 0,
          broker: detectedBroker.id !== 'unknown' ? detectedBroker.id : 'Broker Import',
          notes: `Imported from ${detectedBroker.name} tradebook (${p.date})`
        };

        return enrichTradeWithFoxFormulas(rawTrade, baseCapital, { liveCMPs, costBasisMethod: 'lifo' });
      });
    } else {
      // Individual Fills imported directly
      resultTrades = rawFills.map((f, idx) => {
        const isBuy = (f.type || '').toUpperCase().includes('BUY');
        const rawTrade = {
          id: `trade-fill-${Date.now()}-${idx}`,
          tradeNo: startingTradeNo + idx,
          portfolioId: activePortfolioId,
          date: f.date,
          name: f.name || f.symbol,
          setup: 'Execution Fill',
          type: isBuy ? 'Buy' : 'Sell',
          entry: f.price || 0,
          avgEntry: f.price || 0,
          cmp: liveCMPs[f.name || f.symbol] || f.price || 0,
          entryType: 'Market',
          qty: f.qty || 1,
          status: 'Open',
          openQty: f.qty || 1,
          exitedQty: 0,
          pnl: 0,
          broker: detectedBroker.id !== 'unknown' ? detectedBroker.id : 'Broker Import',
          notes: `Raw fill: ${f.orderId ? `Order #${f.orderId}` : ''} at ${f.entryTime}`
        };
        return enrichTradeWithFoxFormulas(rawTrade, baseCapital, { liveCMPs, costBasisMethod: 'lifo' });
      });
    }
  }
  // ── BRANCH 2: FULL JOURNAL EXPORT (FoxTrade / Custom) ───────────
  else {
    const idxEntryType   = getIndex(['ENTRYTYPE', 'ENTRY TYPE', 'ORDER TYPE']);
    const idxAvgEntry    = getIndex(['AVGENTRY', 'AVG ENTRY', 'AVERAGE ENTRY', 'BUY AVERAGE'], ['P1', 'P2', 'P3', 'P4', 'E1', 'E2', 'E3', 'E4']);
    
    const idxP1Qty       = getIndex(['P1QTY', 'P1 QTY', 'P1 QTY/LOT']);
    const idxP1Date      = getIndex(['P1DATE', 'P1 DATE']);
    const idxP1Sl        = getIndex(['P1SL', 'P1 SL', 'P1 SL(₹)']);

    const idxP2Price     = getIndex(['P2PRICE', 'P2 PRICE', 'P2 PRICE(₹)']);
    const idxP2Qty       = getIndex(['P2QTY', 'P2 QTY', 'P2 QTY/LOT']);
    const idxP2Date      = getIndex(['P2DATE', 'P2 DATE']);
    const idxP2Sl        = getIndex(['P2SL', 'P2 SL', 'P2 SL(₹)']);

    const idxP3Price     = getIndex(['P3PRICE', 'P3 PRICE', 'P3 PRICE(₹)']);
    const idxP3Qty       = getIndex(['P3QTY', 'P3 QTY', 'P3 QTY/LOT']);
    const idxP3Date      = getIndex(['P3DATE', 'P3 DATE']);
    const idxP3Sl        = getIndex(['P3SL', 'P3 SL', 'P3 SL(₹)']);

    const idxP4Price     = getIndex(['P4PRICE', 'P4 PRICE', 'P4 PRICE(₹)']);
    const idxP4Qty       = getIndex(['P4QTY', 'P4 QTY', 'P4 QTY/LOT']);
    const idxP4Date      = getIndex(['P4DATE', 'P4 DATE']);
    const idxP4Sl        = getIndex(['P4SL', 'P4 SL', 'P4 SL(₹)']);

    const idxTSL         = getIndex(['TSL', 'TSL(₹)', 'TRAILING SL']);

    const idxE1Qty       = getIndex(['E1QTY', 'E1 QTY', 'E1 QTY/LOT']);
    const idxE1Date      = getIndex(['E1DATE', 'E1 DATE']);

    const idxE2Price     = getIndex(['E2PRICE', 'E2 PRICE', 'E2 PRICE(₹)']);
    const idxE2Qty       = getIndex(['E2QTY', 'E2 QTY', 'E2 QTY/LOT']);
    const idxE2Date      = getIndex(['E2DATE', 'E2 DATE']);

    const idxE3Price     = getIndex(['E3PRICE', 'E3 PRICE', 'E3 PRICE(₹)']);
    const idxE3Qty       = getIndex(['E3QTY', 'E3 QTY', 'E3 QTY/LOT']);
    const idxE3Date      = getIndex(['E3DATE', 'E3 DATE']);

    const idxE4Price     = getIndex(['E4PRICE', 'E4 PRICE', 'E4 PRICE(₹)']);
    const idxE4Qty       = getIndex(['E4QTY', 'E4 QTY', 'E4 QTY/LOT']);
    const idxE4Date      = getIndex(['E4DATE', 'E4 DATE']);

    const idxPlanFollowed = getIndex(['PLANFOLLOWED', 'PLAN FOLLOWED']);
    const idxExitTrigger  = getIndex(['EXITTRIGGER', 'EXIT TRIGGER']);
    const idxGrowthAreas  = getIndex(['GROWTHAREAS', 'GROWTH AREAS']);
    const idxBaseDuration = getIndex(['BASEDURATION', 'BASE DURATION']);
    const idxNotes        = getIndex(['NOTES', 'NOTE', 'QUICK NOTE', 'REMARKS']);
    const idxHoldingDays  = getIndex(['HOLDINGDAYS', 'HOLDING DAYS', 'HOLDING']);

    const idxUnrealized   = getIndex(['UNREALIZEDPL', 'UNREALIZED PL', 'UNREALIZED P/L', 'UNREALIZED', 'OPEN P/L']);
    const idxOpenHeat     = getIndex(['OPENHEAT', 'OPEN HEAT', 'HEAT']);
    const idxPfImpact     = getIndex(['PFIMPACT', 'PF IMPACT', 'PF IMPACT %']);
    const idxGrossPnl     = getIndex(['GROSS P/L', 'GROSSPL', 'GROSS PNL', 'GROSS REALIZED']);
    const idxStatus       = getIndex(['POSITIONSTATUS', 'POSITION STATUS', 'STATUS']);
    const idxAvgExit      = getIndex(['AVGEXITPRICE', 'AVG EXIT PRICE', 'AVG EXIT', 'EXIT PRICE']);
    const idxOpenQty      = getIndex(['OPENQTY', 'OPEN QTY']);
    const idxExitedQty    = getIndex(['EXITEDQTY', 'EXITED QTY', 'EXIT QTY']);
    const idxPnL          = getIndex(['PL', 'REALIZED P/L', 'P/L', 'PNL', 'PROFIT', 'NET REALIZED P/L']);
    const idxCurrentAlloc = getIndex(['CURRENT ALLOCATION (%)', 'CURRENTALLOCATION', 'CURRENT ALLOCATION', 'CURRENTALLOC']);

    for (let i = 0; i < dataRows.length; i++) {
      const cols = dataRows[i];
      const rawName = idxSymbol !== -1 ? String(cols[idxSymbol] || '').trim() : '';
      const tradeNoVal = idxTradeNo !== -1 ? parseInt(cols[idxTradeNo], 10) : (startingTradeNo + i);
      const explicitId = idxId !== -1 && cols[idxId] ? String(cols[idxId]).trim() : '';

      if (!rawName && isNaN(tradeNoVal) && !explicitId) continue;
      const nameVal = rawName ? getCanonicalSymbol(rawName) : '';

      const dateVal = idxDate !== -1 ? normalizeDateString(cols[idxDate], dateFormat) : normalizeDateString(new Date(), dateFormat);
      const setupVal = idxSetup !== -1 ? String(cols[idxSetup] || '').trim() : '';
      const typeVal = idxTradeType !== -1
        ? (String(cols[idxTradeType] || '').toUpperCase().includes('SELL') ? 'Sell' : 'Buy')
        : 'Buy';

      const entryVal = idxEntry !== -1 ? cleanNumber(cols[idxEntry], 0) : 0;
      const slVal = idxSL !== -1 ? cleanOptionalNumber(cols[idxSL]) : undefined;
      const cmpVal = idxCMP !== -1 ? cleanNumber(cols[idxCMP], 0) : (liveCMPs[nameVal] || 0);
      const entryTypeVal = idxEntryType !== -1 && cols[idxEntryType] ? String(cols[idxEntryType]).trim() : 'Market';
      const qtyVal = idxQuantity !== -1 ? cleanNumber(cols[idxQuantity], 0) : 0;

      const p1PriceVal = idxP1Price !== -1 ? cleanNumber(cols[idxP1Price], 0) : 0;
      const p1QtyVal = idxP1Qty !== -1 ? cleanNumber(cols[idxP1Qty], 0) : 0;
      const p1DateVal = idxP1Date !== -1 ? normalizeDateString(cols[idxP1Date], dateFormat) : '';
      const p1SlVal = idxP1Sl !== -1 ? cleanOptionalNumber(cols[idxP1Sl]) : undefined;

      const p2PriceVal = idxP2Price !== -1 ? cleanNumber(cols[idxP2Price], 0) : 0;
      const p2QtyVal = idxP2Qty !== -1 ? cleanNumber(cols[idxP2Qty], 0) : 0;
      const p2DateVal = idxP2Date !== -1 ? normalizeDateString(cols[idxP2Date], dateFormat) : '';
      const p2SlVal = idxP2Sl !== -1 ? cleanOptionalNumber(cols[idxP2Sl]) : undefined;

      const p3PriceVal = idxP3Price !== -1 ? cleanNumber(cols[idxP3Price], 0) : 0;
      const p3QtyVal = idxP3Qty !== -1 ? cleanNumber(cols[idxP3Qty], 0) : 0;
      const p3DateVal = idxP3Date !== -1 ? normalizeDateString(cols[idxP3Date], dateFormat) : '';
      const p3SlVal = idxP3Sl !== -1 ? cleanOptionalNumber(cols[idxP3Sl]) : undefined;

      const p4PriceVal = idxP4Price !== -1 ? cleanNumber(cols[idxP4Price], 0) : 0;
      const p4QtyVal = idxP4Qty !== -1 ? cleanNumber(cols[idxP4Qty], 0) : 0;
      const p4DateVal = idxP4Date !== -1 ? normalizeDateString(cols[idxP4Date], dateFormat) : '';
      const p4SlVal = idxP4Sl !== -1 ? cleanOptionalNumber(cols[idxP4Sl]) : undefined;

      const tslVal = idxTSL !== -1 ? cleanNumber(cols[idxTSL], 0) : 0;

      const e1PriceVal = idxE1Price !== -1 ? cleanNumber(cols[idxE1Price], 0) : 0;
      const e1QtyVal = idxE1Qty !== -1 ? cleanNumber(cols[idxE1Qty], 0) : 0;
      const e1DateVal = idxE1Date !== -1 ? normalizeDateString(cols[idxE1Date], dateFormat) : '';

      const e2PriceVal = idxE2Price !== -1 ? cleanNumber(cols[idxE2Price], 0) : 0;
      const e2QtyVal = idxE2Qty !== -1 ? cleanNumber(cols[idxE2Qty], 0) : 0;
      const e2DateVal = idxE2Date !== -1 ? normalizeDateString(cols[idxE2Date], dateFormat) : '';

      const e3PriceVal = idxE3Price !== -1 ? cleanNumber(cols[idxE3Price], 0) : 0;
      const e3QtyVal = idxE3Qty !== -1 ? cleanNumber(cols[idxE3Qty], 0) : 0;
      const e3DateVal = idxE3Date !== -1 ? normalizeDateString(cols[idxE3Date], dateFormat) : '';

      const e4PriceVal = idxE4Price !== -1 ? cleanNumber(cols[idxE4Price], 0) : 0;
      const e4QtyVal = idxE4Qty !== -1 ? cleanNumber(cols[idxE4Qty], 0) : 0;
      const e4DateVal = idxE4Date !== -1 ? normalizeDateString(cols[idxE4Date], dateFormat) : '';

      const planFollowedVal = idxPlanFollowed !== -1 && cols[idxPlanFollowed] ? String(cols[idxPlanFollowed]).trim() : 'Yes';
      const exitTriggerVal  = idxExitTrigger !== -1 ? String(cols[idxExitTrigger] || '').trim() : '';
      const growthAreasVal  = idxGrowthAreas !== -1 ? String(cols[idxGrowthAreas] || '').trim() : '';
      const baseDurationVal = idxBaseDuration !== -1 ? String(cols[idxBaseDuration] || '').trim() : '';
      const notesVal        = idxNotes !== -1 ? String(cols[idxNotes] || '').trim() : '';
      const holdingDaysVal  = idxHoldingDays !== -1 ? parseInt(cols[idxHoldingDays], 10) : 0;

      const unrealizedVal    = idxUnrealized !== -1 ? cleanOptionalNumber(cols[idxUnrealized]) : undefined;
      const openHeatVal      = idxOpenHeat !== -1 ? cleanOptionalNumber(cols[idxOpenHeat]) : undefined;
      const pfImpactVal      = idxPfImpact !== -1 ? cleanOptionalNumber(cols[idxPfImpact]) : undefined;
      const grossPnlVal      = idxGrossPnl !== -1 ? cleanOptionalNumber(cols[idxGrossPnl]) : undefined;
      const statusVal        = idxStatus !== -1 && String(cols[idxStatus] || '').trim() !== '' ? String(cols[idxStatus]).trim() : undefined;
      const avgEntryVal      = idxAvgEntry !== -1 ? cleanOptionalNumber(cols[idxAvgEntry]) : undefined;
      const avgExitVal       = idxAvgExit !== -1 ? cleanOptionalNumber(cols[idxAvgExit]) : undefined;
      const openQtyVal       = idxOpenQty !== -1 ? cleanOptionalNumber(cols[idxOpenQty]) : undefined;
      const exitedQtyVal     = idxExitedQty !== -1 ? cleanOptionalNumber(cols[idxExitedQty]) : undefined;
      const pnlVal           = idxPnL !== -1 ? cleanOptionalNumber(cols[idxPnL]) : undefined;
      const currentAllocVal  = idxCurrentAlloc !== -1 ? cleanOptionalNumber(cols[idxCurrentAlloc]) : undefined;

      const rawExIds = idxExchangeTradeIds !== -1 && cols[idxExchangeTradeIds] ? String(cols[idxExchangeTradeIds]).trim() : '';
      let exchangeTradeIdsVal = [];
      if (rawExIds && rawExIds !== '[]' && rawExIds !== '{}') {
        if (rawExIds.startsWith('[') && rawExIds.endsWith(']')) {
          try {
            const parsed = JSON.parse(rawExIds);
            if (Array.isArray(parsed)) {
              exchangeTradeIdsVal = parsed.map(s => String(s).trim()).filter(s => s && s !== '0' && s !== '[]' && s !== '{}');
            }
          } catch {
            exchangeTradeIdsVal = rawExIds.replace(/[\[\]]/g, '').split(/[,;|]/).map(s => s.trim()).filter(s => s && s !== '0');
          }
        } else {
          exchangeTradeIdsVal = rawExIds.split(/[,;|]/).map(s => s.trim()).filter(s => s && s !== '0');
        }
      }

      const brokerVal = idxBroker !== -1 && cols[idxBroker] ? String(cols[idxBroker]).trim() : detectedBroker.id;
      const txHistVal = idxTransactionHistory !== -1 && cols[idxTransactionHistory] ? String(cols[idxTransactionHistory]).trim() : undefined;

      const cleanId = (explicitId && !['buy', 'sell', 'true', 'false'].includes(explicitId.toLowerCase()) && explicitId.length > 3)
        ? explicitId
        : `trade_${Date.now()}_${i}`;

      const rawTrade = {
        id: cleanId,
        tradeNo: isNaN(tradeNoVal) ? (startingTradeNo + i) : tradeNoVal,
        portfolioId: activePortfolioId,
        allExchangeTradeIds: exchangeTradeIdsVal,
        broker: brokerVal,
        transactionHistory: txHistVal,
        date: dateVal,
        name: nameVal,
        setup: setupVal,
        type: typeVal,
        entry: entryVal,
        sl: slVal,
        cmp: cmpVal,
        entryType: entryTypeVal,
        qty: qtyVal,
        p1Price: p1PriceVal,
        p1Qty: p1QtyVal,
        p1Date: p1DateVal,
        p1Sl: p1SlVal,
        p2Price: p2PriceVal,
        p2Qty: p2QtyVal,
        p2Date: p2DateVal,
        p2Sl: p2SlVal,
        p3Price: p3PriceVal,
        p3Qty: p3QtyVal,
        p3Date: p3DateVal,
        p3Sl: p3SlVal,
        p4Price: p4PriceVal,
        p4Qty: p4QtyVal,
        p4Date: p4DateVal,
        p4Sl: p4SlVal,
        tsl: tslVal,
        e1Price: e1PriceVal,
        e1Qty: e1QtyVal,
        e1Date: e1DateVal,
        e2Price: e2PriceVal,
        e2Qty: e2QtyVal,
        e2Date: e2DateVal,
        e3Price: e3PriceVal,
        e3Qty: e3QtyVal,
        e3Date: e3DateVal,
        e4Price: e4PriceVal,
        e4Qty: e4QtyVal,
        e4Date: e4DateVal,
        planFollowed: planFollowedVal,
        exitTrigger: exitTriggerVal,
        growthAreas: growthAreasVal,
        baseDuration: baseDurationVal,
        notes: notesVal,
        quickNote: notesVal,
        holdingDays: isNaN(holdingDaysVal) ? 0 : holdingDaysVal,
        avgEntry: avgEntryVal,
        avgExitPrice: avgExitVal,
        openQty: openQtyVal,
        exitedQty: exitedQtyVal,
        pnl: pnlVal,
        unrealized: unrealizedVal,
        openHeat: openHeatVal,
        pfImpact: pfImpactVal,
        grossPnl: grossPnlVal,
        status: statusVal,
        currentAllocation: currentAllocVal,
      };

      resultTrades.push(enrichTradeWithFoxFormulas(rawTrade, baseCapital, { liveCMPs, costBasisMethod: 'lifo' }));
    }
  }

  if (resultTrades.length === 0) {
    throw new Error('No valid trades could be extracted from the file.');
  }

  return resultTrades;
}

function p2PriceSafe(p) {
  return p.p2Price || 0;
}
