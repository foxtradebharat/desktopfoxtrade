/**
 * brokerSyncWorker.js — Web Worker
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs all broker API fetch + normalization off the main thread.
 * The UI never freezes during a sync.
 *
 * Message protocol (main → worker):
 *   { type: 'SYNC', broker: 'zerodha'|'dhan'|'upstox', credentials: {...}, proxyBase: '' }
 *
 * Message protocol (worker → main):
 *   { type: 'PROGRESS', message: string }
 *   { type: 'SUCCESS', fills: [...], rawCount: number }
 *   { type: 'ERROR', message: string }
 */

const IST_OFFSET = 19800000;

function parseBrokerDate(dateString) {
  const fallback = () => {
    const now = new Date();
    return {
      date: now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' }).replace(/\//g, '-'),
      time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
    };
  };
  if (!dateString) return fallback();
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return { date: String(dateString).split(' ')[0] || '', time: String(dateString).split(' ')[1] || '' };
  return {
    date: d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' }).replace(/\//g, '-'),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  };
}

function normalizeZerodha(rawTrades) {
  return rawTrades.map((t, idx) => {
    const { date, time } = parseBrokerDate(t.fill_timestamp || t.order_timestamp);
    const isBuy = (t.transaction_type || '').toUpperCase() === 'BUY';
    const symbol = t.tradingsymbol || 'ZERODHA_TRADE';
    return {
      id: `zerodha_${t.trade_id || idx}_${Date.now()}`,
      tradeId: String(t.trade_id || ''),
      orderId: String(t.order_id || ''),
      allExchangeTradeIds: [String(t.trade_id || ''), String(t.order_id || '')].filter(Boolean),
      name: symbol, symbol,
      type: isBuy ? 'BUY' : 'SELL',
      direction: isBuy ? 'LONG' : 'SHORT',
      instrumentType: symbol.endsWith('CE') || symbol.endsWith('PE') ? 'Options' : symbol.includes('FUT') ? 'Futures' : 'Equity',
      status: 'Closed', date, entryTime: time, exitTime: time,
      qty: Math.abs(t.quantity || 1),
      price: Number(t.average_price || t.price || 0),
      avgEntry: Number(t.average_price || t.price || 0),
      avgExit: Number(t.average_price || t.price || 0),
      pnl: 0, broker: 'Zerodha', source: 'Direct API Sync'
    };
  });
}

function normalizeDhan(rawTrades) {
  return rawTrades.map((t, idx) => {
    const { date, time } = parseBrokerDate(t.createTime || t.exchangeTime);
    const isBuy = (t.transactionType || '').toUpperCase() === 'BUY';
    const symbol = t.customSymbol || t.tradingSymbol || 'DHAN_TRADE';
    return {
      id: `dhan_${t.tradeId || idx}_${Date.now()}`,
      tradeId: String(t.tradeId || ''),
      orderId: String(t.orderId || ''),
      exchangeTradeId: String(t.exchangeTradeId || ''),
      allExchangeTradeIds: [String(t.exchangeTradeId || ''), String(t.tradeId || ''), String(t.orderId || '')].filter(Boolean),
      name: symbol, symbol,
      type: isBuy ? 'BUY' : 'SELL',
      direction: isBuy ? 'LONG' : 'SHORT',
      instrumentType: (t.drvOptionType === 'CALL' || t.drvOptionType === 'PUT' || symbol.endsWith('CE') || symbol.endsWith('PE')) ? 'Options' : t.exchangeSegment?.includes('FUT') ? 'Futures' : 'Equity',
      status: 'Closed', date, entryTime: time, exitTime: time,
      qty: Math.abs(t.tradedQuantity || 1),
      price: Number(t.tradedPrice || 0),
      avgEntry: Number(t.tradedPrice || 0),
      avgExit: Number(t.tradedPrice || 0),
      pnl: 0, broker: 'Dhan', source: 'Direct API Sync'
    };
  });
}

function normalizeUpstox(rawTrades) {
  return rawTrades.map((t, idx) => {
    const { date, time } = parseBrokerDate(t.trade_timestamp || t.order_timestamp);
    const isBuy = (t.transaction_type || '').toUpperCase() === 'BUY';
    const symbol = t.trading_symbol || 'UPSTOX_TRADE';
    return {
      id: `upstox_${t.trade_id || idx}_${Date.now()}`,
      tradeId: String(t.trade_id || ''),
      orderId: String(t.order_id || ''),
      allExchangeTradeIds: [String(t.trade_id || ''), String(t.order_id || '')].filter(Boolean),
      name: symbol, symbol,
      type: isBuy ? 'BUY' : 'SELL',
      direction: isBuy ? 'LONG' : 'SHORT',
      instrumentType: symbol.endsWith('CE') || symbol.endsWith('PE') ? 'Options' : t.instrument_token?.includes('FUT') ? 'Futures' : 'Equity',
      status: 'Closed', date, entryTime: time, exitTime: time,
      qty: Math.abs(t.quantity || 1),
      price: Number(t.average_price || t.price || 0),
      avgEntry: Number(t.average_price || t.price || 0),
      avgExit: Number(t.average_price || t.price || 0),
      pnl: 0, broker: 'Upstox', source: 'Direct API Sync'
    };
  });
}

async function syncZerodha(credentials, proxyBase) {
  const { apiKey, accessToken } = credentials;
  self.postMessage({ type: 'PROGRESS', message: 'Connecting to Zerodha Kite...' });
  const resp = await fetch(`${proxyBase}/api/broker/zerodha/trades`, {
    headers: { 'X-Kite-Version': '3', 'Authorization': `token ${apiKey}:${accessToken}` }
  });
  if (!resp.ok) throw new Error(`Zerodha API Error (${resp.status}): ${await resp.text()}`);
  const result = await resp.json();
  return normalizeZerodha(result.data || []);
}

async function syncDhan(credentials, proxyBase) {
  const { clientId, accessToken } = credentials;
  self.postMessage({ type: 'PROGRESS', message: 'Connecting to Dhan HQ...' });
  const resp = await fetch(`${proxyBase}/api/broker/dhan/trades`, {
    headers: { 'access-token': accessToken, 'client-id': clientId, 'Content-Type': 'application/json' }
  });
  if (!resp.ok) throw new Error(`Dhan API Error (${resp.status}): ${await resp.text()}`);
  const result = await resp.json();
  return normalizeDhan(Array.isArray(result) ? result : result.data || []);
}

async function syncUpstox(credentials, proxyBase) {
  const { accessToken } = credentials;
  self.postMessage({ type: 'PROGRESS', message: 'Connecting to Upstox...' });
  const resp = await fetch(`${proxyBase}/api/broker/upstox/trades`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
  });
  if (!resp.ok) throw new Error(`Upstox API Error (${resp.status}): ${await resp.text()}`);
  const result = await resp.json();
  return normalizeUpstox(result.data || []);
}

self.onmessage = async (event) => {
  const { type, broker, credentials, proxyBase = '' } = event.data;
  if (type !== 'SYNC') return;

  try {
    self.postMessage({ type: 'PROGRESS', message: `Starting ${broker} sync...` });

    let fills = [];
    if (broker === 'zerodha') fills = await syncZerodha(credentials, proxyBase);
    else if (broker === 'dhan') fills = await syncDhan(credentials, proxyBase);
    else if (broker === 'upstox') fills = await syncUpstox(credentials, proxyBase);
    else throw new Error(`Worker: broker "${broker}" not implemented`);

    self.postMessage({ type: 'PROGRESS', message: `Fetched ${fills.length} fills, pairing trades...` });
    self.postMessage({ type: 'SUCCESS', fills, rawCount: fills.length });

  } catch (err) {
    self.postMessage({ type: 'ERROR', message: err.message || 'Unknown sync error' });
  }
};
