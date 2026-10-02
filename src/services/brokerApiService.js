/**
 * DIRECT BROKER API SYNC SERVICE FOR FOXTRADE
 * 
 * Comprehensive Indian Broker Connectivity & Multi-Account Synchronization:
 * 1. Zerodha Kite Connect API (api.kite.trade)
 * 2. Dhan HQ API (api.dhan.co) - with tradebook date pagination & rate-limit backoff
 * 3. Upstox API v2 (api.upstox.com)
 * 4. Fyers API v3 (api-t1.fyers.in)
 * 5. Angel One SmartAPI (apiconnect.angelone.in)
 * 
 * Local encrypted multi-account token management and token health monitors.
 */

export const BROKER_ACCOUNTS_STORAGE_KEY = 'foxtrade_connected_broker_accounts';

// Expiry cutoffs in Indian Standard Time (UTC + 5:30)
// Zerodha: 06:00 AM IST
// Upstox: 03:30 AM IST
// FYERS: 06:00 AM IST
// Angel One: 00:00 AM (Midnight IST)
// Dhan: 30 days or validUntil
const IST_OFFSET_MS = 19800000; // 5h 30m

export function calculateBrokerTokenExpiry(brokerId, connectedAtMs, customExpiryTimestamp) {
  if (customExpiryTimestamp && customExpiryTimestamp > Date.now()) {
    return customExpiryTimestamp;
  }

  const broker = (brokerId || '').toLowerCase();
  if (broker === 'dhan') {
    // Dhan tokens are generally 30 days
    return connectedAtMs + (30 * 24 * 60 * 60 * 1000);
  }

  const cutoffs = {
    zerodha: { hour: 6, minute: 0 },
    upstox: { hour: 3, minute: 30 },
    fyers: { hour: 6, minute: 0 },
    angelone: { hour: 0, minute: 0 },
    kotak: { hour: 6, minute: 0 },
    groww: { hour: 6, minute: 0 },
    mstock: { hour: 0, minute: 0 }
  };

  const cutoff = cutoffs[broker] || { hour: 6, minute: 0 };
  const istDate = new Date(connectedAtMs + IST_OFFSET_MS);
  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth();
  const day = istDate.getUTCDate();

  let expiryUtc = Date.UTC(year, month, day, cutoff.hour, cutoff.minute, 0, 0) - IST_OFFSET_MS;
  if (connectedAtMs >= expiryUtc) {
    expiryUtc += 86400000; // Next day
  }
  return expiryUtc;
}

// ── Multi-Account Storage & Management ─────────────────────────────────────────

export function getConnectedBrokerAccounts(portfolioId = null) {
  try {
    const raw = localStorage.getItem(BROKER_ACCOUNTS_STORAGE_KEY);
    const accounts = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(accounts)) return [];
    if (portfolioId) {
      return accounts.filter(acc => !acc.portfolioId || acc.portfolioId === portfolioId);
    }
    return accounts;
  } catch (err) {
    console.warn('[brokerApiService] Error loading accounts:', err);
    return [];
  }
}

export function saveBrokerAccount(accountData) {
  const accounts = getConnectedBrokerAccounts();
  const id = accountData.id || `acc_${accountData.broker}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const connectedAt = accountData.connectedAt || now;
  const expiresAt = calculateBrokerTokenExpiry(accountData.broker, connectedAt, accountData.expiresAt);

  const newAccount = {
    id,
    broker: accountData.broker,
    accountName: accountData.accountName || `${accountData.broker.toUpperCase()} Account`,
    clientId: accountData.clientId || accountData.userId || '',
    userId: accountData.userId || accountData.clientId || '',
    apiKey: accountData.apiKey || '',
    apiSecret: accountData.apiSecret || '',
    accessToken: accountData.accessToken || '',
    totpKey: accountData.totpKey || '',
    pin: accountData.pin || '',
    portfolioId: accountData.portfolioId || 'portfolio-default',
    connectedAt,
    expiresAt,
    lastSync: accountData.lastSync || null,
    status: accountData.status || 'connected',
    autoSyncEnabled: accountData.autoSyncEnabled ?? true
  };

  const existingIdx = accounts.findIndex(a => a.id === id);
  if (existingIdx !== -1) {
    accounts[existingIdx] = { ...accounts[existingIdx], ...newAccount };
  } else {
    accounts.push(newAccount);
  }

  localStorage.setItem(BROKER_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  window.dispatchEvent(new CustomEvent('foxtrade_broker_accounts_updated', { detail: accounts }));
  return newAccount;
}

export function removeBrokerAccount(accountId) {
  const accounts = getConnectedBrokerAccounts();
  const filtered = accounts.filter(a => a.id !== accountId);
  localStorage.setItem(BROKER_ACCOUNTS_STORAGE_KEY, JSON.stringify(filtered));
  window.dispatchEvent(new CustomEvent('foxtrade_broker_accounts_updated', { detail: filtered }));
  return filtered;
}

export function checkAccountHealth(account) {
  if (!account || !account.accessToken) return 'disconnected';
  if (account.status === 'disconnected') return 'disconnected';
  if (account.expiresAt && Date.now() >= account.expiresAt) return 'expired';
  return 'connected';
}

/**
 * DIRECT BROKER API SYNC SERVICE
 *
 * Supports Direct Live Sync with Indian Broker APIs via CORS-safe proxy:
 *   Dev:  Vite proxy (/api/broker/*)  →  broker REST APIs
 *   Prod: Cloudflare Worker (/api/broker/*) →  broker REST APIs
 *
 * Supported brokers:
 *   1. Zerodha Kite Connect API (api.kite.trade)
 *   2. Dhan HQ API (api.dhan.co)
 *   3. Upstox API v2 (api.upstox.com)
 */

// Proxy base — empty string means "same origin" which works for both Vite proxy (dev)
// and Cloudflare Worker (prod, set VITE_BROKER_PROXY in .env.production)
const BROKER_PROXY_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BROKER_PROXY) || '';

// Helper: Convert Indian Broker Trade Timestamp into DD-MM-YYYY & HH:MM
function parseBrokerDate(dateString) {
  if (!dateString) {
    return {
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' }).replace(/\//g, '-'),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
    };
  }

  const d = new Date(dateString);
  if (isNaN(d.getTime())) {
    return {
      date: String(dateString).split(' ')[0] || '',
      time: String(dateString).split(' ')[1] || ''
    };
  }

  return {
    date: d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' }).replace(/\//g, '-'),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  };
}

/**
 * 1. ZERODHA KITE CONNECT SYNC
 * Routes through: /api/broker/zerodha/trades
 */
export async function syncZerodhaTrades({ apiKey, accessToken }) {
  if (!apiKey || !accessToken) {
    throw new Error('Zerodha API Key and Access Token are required.');
  }

  const response = await fetch(`${BROKER_PROXY_BASE}/api/broker/zerodha/trades`, {
    method: 'GET',
    headers: {
      'X-Kite-Version': '3',
      'Authorization': `token ${apiKey}:${accessToken}`
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Zerodha API Error (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const rawTrades = result.data || [];

  return normalizeZerodhaTrades(rawTrades);
}

export function normalizeZerodhaTrades(rawTrades = []) {
  return rawTrades.map((t, idx) => {
    const { date, time } = parseBrokerDate(t.fill_timestamp || t.order_timestamp);
    const isBuy = (t.transaction_type || '').toUpperCase() === 'BUY';
    const symbol = t.tradingsymbol || 'ZERODHA_TRADE';
    const isOption = symbol.endsWith('CE') || symbol.endsWith('PE');
    const isFuture = symbol.includes('FUT');
    const instrumentType = isOption ? 'Options' : isFuture ? 'Futures' : 'Equity';

    return {
      id: `zerodha_${t.trade_id || idx}_${Date.now()}`,
      tradeId: String(t.trade_id || ''),
      orderId: String(t.order_id || ''),
      allExchangeTradeIds: [String(t.trade_id || ''), String(t.order_id || '')].filter(Boolean),
      name: symbol,
      symbol: symbol,
      type: isBuy ? 'BUY' : 'SELL',
      direction: isBuy ? 'LONG' : 'SHORT',
      instrumentType: instrumentType,
      status: 'Closed',
      date: date,
      entryTime: time,
      exitTime: time,
      qty: Math.abs(t.quantity || 1),
      price: Number(t.average_price || t.price || 0),
      avgEntry: Number(t.average_price || t.price || 0),
      avgExit: Number(t.average_price || t.price || 0),
      pnl: 0,
      broker: 'Zerodha',
      source: 'Direct API Sync',
      setup: 'Broker Auto-Sync',
      tradeNo: idx + 1
    };
  });
}

// ── 2. DHAN HQ API SYNC (with date range & pagination) ──────────────────────────
export async function syncDhanTrades({ clientId, accessToken, fromDate, toDate }) {
  if (!clientId || !accessToken) {
    throw new Error('Dhan Client ID and Access Token are required.');
  }

  const PROXY = import.meta.env.VITE_BROKER_PROXY || '';
  let rawTrades = [];

  // If fromDate and toDate are given, use paginated tradebook API
  if (fromDate && toDate) {
    let page = 0;
    let hasMore = true;
    while (hasMore && page < 20) {
      const resp = await fetch(`${PROXY}/api/broker/dhan/trades/${fromDate}/${toDate}/${page}`, {
        method: 'GET',
        headers: {
          'access-token': accessToken,
          'client-id': clientId,
          'Accept': 'application/json'
        }
      });
      if (!resp.ok) {
        if (resp.status === 404 || resp.status === 400) break;
        const errText = await resp.text();
        throw new Error(`Dhan API Error (${resp.status}): ${errText}`);
      }
      const pageData = await resp.json();
      if (Array.isArray(pageData) && pageData.length > 0) {
        rawTrades.push(...pageData);
        page++;
      } else {
        hasMore = false;
      }
    }
  } else {
    // Standard daily trades endpoint
    const response = await fetch(`${PROXY}/api/broker/dhan/trades`, {
      method: 'GET',
      headers: {
        'access-token': accessToken,
        'client-id': clientId,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Dhan API Error (${response.status}): ${errText}`);
    }

    const result = await response.json();
    rawTrades = Array.isArray(result) ? result : result.data || [];
  }

  return normalizeDhanTrades(rawTrades);
}

export function normalizeDhanTrades(rawTrades = []) {
  return rawTrades.map((t, idx) => {
    const { date, time } = parseBrokerDate(t.createTime || t.exchangeTime);
    const isBuy = (t.transactionType || '').toUpperCase() === 'BUY';
    const symbol = t.customSymbol || t.tradingSymbol || 'DHAN_TRADE';
    const isOption = t.drvOptionType === 'CALL' || t.drvOptionType === 'PUT' || symbol.endsWith('CE') || symbol.endsWith('PE');
    const instrumentType = isOption ? 'Options' : t.exchangeSegment?.includes('FUT') ? 'Futures' : 'Equity';

    return {
      id: `dhan_${t.tradeId || idx}_${Date.now()}`,
      tradeId: String(t.tradeId || ''),
      orderId: String(t.orderId || ''),
      exchangeTradeId: String(t.exchangeTradeId || ''),
      allExchangeTradeIds: [String(t.exchangeTradeId || ''), String(t.tradeId || ''), String(t.orderId || '')].filter(Boolean),
      name: symbol,
      symbol: symbol,
      type: isBuy ? 'BUY' : 'SELL',
      direction: isBuy ? 'LONG' : 'SHORT',
      instrumentType: instrumentType,
      status: 'Closed',
      date: date,
      entryTime: time,
      exitTime: time,
      qty: Math.abs(t.tradedQuantity || 1),
      price: Number(t.tradedPrice || 0),
      avgEntry: Number(t.tradedPrice || 0),
      avgExit: Number(t.tradedPrice || 0),
      pnl: 0,
      broker: 'Dhan',
      source: 'Direct API Sync',
      setup: 'Broker Auto-Sync',
      tradeNo: idx + 1
    };
  });
}

// ── 3. UPSTOX API v2 SYNC ──────────────────────────────────────────────────────
export async function syncUpstoxTrades({ accessToken }) {
  if (!accessToken) {
    throw new Error('Upstox Access Token is required.');
  }

  const PROXY = import.meta.env.VITE_BROKER_PROXY || '';
  const response = await fetch(`${PROXY}/api/broker/upstox/trades`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Upstox API Error (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const rawTrades = result.data || [];
  return normalizeUpstoxTrades(rawTrades);
}

export function normalizeUpstoxTrades(rawTrades = []) {
  return rawTrades.map((t, idx) => {
    const { date, time } = parseBrokerDate(t.trade_timestamp || t.order_timestamp);
    const isBuy = (t.transaction_type || '').toUpperCase() === 'BUY';
    const symbol = t.trading_symbol || 'UPSTOX_TRADE';
    const isOption = symbol.endsWith('CE') || symbol.endsWith('PE');
    const instrumentType = isOption ? 'Options' : t.instrument_token?.includes('FUT') ? 'Futures' : 'Equity';

    return {
      id: `upstox_${t.trade_id || idx}_${Date.now()}`,
      tradeId: String(t.trade_id || ''),
      orderId: String(t.order_id || ''),
      allExchangeTradeIds: [String(t.trade_id || ''), String(t.order_id || '')].filter(Boolean),
      name: symbol,
      symbol: symbol,
      type: isBuy ? 'BUY' : 'SELL',
      direction: isBuy ? 'LONG' : 'SHORT',
      instrumentType: instrumentType,
      status: 'Closed',
      date: date,
      entryTime: time,
      exitTime: time,
      qty: Math.abs(t.quantity || 1),
      price: Number(t.average_price || t.price || 0),
      avgEntry: Number(t.average_price || t.price || 0),
      avgExit: Number(t.average_price || t.price || 0),
      pnl: 0,
      broker: 'Upstox',
      source: 'Direct API Sync',
      setup: 'Broker Auto-Sync',
      tradeNo: idx + 1
    };
  });
}

// ── 4. FYERS API v3 SYNC ───────────────────────────────────────────────────────
export async function syncFyersTrades({ appId, accessToken }) {
  if (!accessToken) {
    throw new Error('FYERS Access Token is required.');
  }

  const authHeader = appId ? `${appId}:${accessToken}` : accessToken;
  const response = await fetch('https://api-t1.fyers.in/api/v3/tradebook', {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`FYERS API Error (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const rawTrades = result.tradeBook || result.data || [];
  return normalizeFyersTrades(rawTrades);
}

export function normalizeFyersTrades(rawTrades = []) {
  return rawTrades.map((t, idx) => {
    const { date, time } = parseBrokerDate(t.orderDateTime || t.tradeTime);
    const isBuy = Number(t.side) === 1 || String(t.side || '').toUpperCase() === 'BUY';
    const symbol = t.symbol || 'FYERS_TRADE';
    const isOption = symbol.endsWith('CE') || symbol.endsWith('PE');
    const instrumentType = isOption ? 'Options' : symbol.includes('FUT') ? 'Futures' : 'Equity';

    return {
      id: `fyers_${t.id || idx}_${Date.now()}`,
      tradeId: String(t.id || t.tradeNumber || ''),
      orderId: String(t.orderNumber || ''),
      allExchangeTradeIds: [String(t.id || ''), String(t.orderNumber || '')].filter(Boolean),
      name: symbol,
      symbol: symbol,
      type: isBuy ? 'BUY' : 'SELL',
      direction: isBuy ? 'LONG' : 'SHORT',
      instrumentType: instrumentType,
      status: 'Closed',
      date: date,
      entryTime: time,
      exitTime: time,
      qty: Math.abs(t.tradeQty || t.tradedQty || 1),
      price: Number(t.tradePrice || t.tradedPrice || 0),
      avgEntry: Number(t.tradePrice || 0),
      avgExit: Number(t.tradePrice || 0),
      pnl: 0,
      broker: 'Fyers',
      source: 'Direct API Sync',
      setup: 'Broker Auto-Sync',
      tradeNo: idx + 1
    };
  });
}

// ── 5. ANGEL ONE SMARTAPI SYNC ─────────────────────────────────────────────────
export async function syncAngelOneTrades({ clientCode, apiKey, jwtToken }) {
  if (!jwtToken || !apiKey) {
    throw new Error('Angel One API Key and JWT Session Token are required.');
  }

  const response = await fetch('https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/getTradeBook', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': '127.0.0.1',
      'X-ClientPublicIP': '127.0.0.1',
      'X-MACAddress': 'fe80::1',
      'X-PrivateKey': apiKey
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Angel One API Error (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const rawTrades = result.data || [];
  return normalizeAngelOneTrades(rawTrades);
}

export function normalizeAngelOneTrades(rawTrades = []) {
  return rawTrades.map((t, idx) => {
    const { date, time } = parseBrokerDate(t.filltime || t.updatetime);
    const isBuy = (t.transactiontype || '').toUpperCase() === 'BUY';
    const symbol = t.tradingsymbol || t.symbolname || 'ANGELONE_TRADE';
    const isOption = symbol.endsWith('CE') || symbol.endsWith('PE');
    const instrumentType = isOption ? 'Options' : symbol.includes('FUT') ? 'Futures' : 'Equity';

    return {
      id: `angelone_${t.tradeid || idx}_${Date.now()}`,
      tradeId: String(t.tradeid || ''),
      orderId: String(t.orderid || ''),
      allExchangeTradeIds: [String(t.tradeid || ''), String(t.orderid || '')].filter(Boolean),
      name: symbol,
      symbol: symbol,
      type: isBuy ? 'BUY' : 'SELL',
      direction: isBuy ? 'LONG' : 'SHORT',
      instrumentType: instrumentType,
      status: 'Closed',
      date: date,
      entryTime: time,
      exitTime: time,
      qty: Math.abs(Number(t.fillshares || t.quantity || 1)),
      price: Number(t.fillprice || t.price || 0),
      avgEntry: Number(t.fillprice || 0),
      avgExit: Number(t.fillprice || 0),
      pnl: 0,
      broker: 'Angel One',
      source: 'Direct API Sync',
      setup: 'Broker Auto-Sync',
      tradeNo: idx + 1
    };
  });
}

// ── Generic Sync for an Account Record ─────────────────────────────────────────
export async function syncBrokerAccount(account) {
  if (!account || !account.broker) throw new Error('Invalid account configuration');

  const broker = account.broker.toLowerCase();
  let rawTrades = [];

  switch (broker) {
    case 'zerodha':
      rawTrades = await syncZerodhaTrades({
        apiKey: account.apiKey,
        accessToken: account.accessToken
      });
      break;
    case 'dhan':
      rawTrades = await syncDhanTrades({
        clientId: account.clientId,
        accessToken: account.accessToken
      });
      break;
    case 'upstox':
      rawTrades = await syncUpstoxTrades({
        accessToken: account.accessToken
      });
      break;
    case 'fyers':
      rawTrades = await syncFyersTrades({
        appId: account.apiKey || account.clientId,
        accessToken: account.accessToken
      });
      break;
    case 'angelone':
      rawTrades = await syncAngelOneTrades({
        clientCode: account.clientId,
        apiKey: account.apiKey,
        jwtToken: account.accessToken
      });
      break;
    default:
      throw new Error(`Direct API sync for broker "${account.broker}" is not configured.`);
  }

  // Update last sync time
  const updatedAccount = saveBrokerAccount({
    ...account,
    lastSync: Date.now(),
    status: 'connected'
  });

  const pairedTrades = pairExecutionFills(rawTrades);
  return {
    rawCount: rawTrades.length,
    pairedTrades,
    account: updatedAccount
  };
}

// ── Sync All Connected Accounts for a Given Portfolio ─────────────────────────
export async function syncAllActiveBrokerAccounts(portfolioId = null) {
  const accounts = getConnectedBrokerAccounts(portfolioId);
  const activeAccounts = accounts.filter(a => checkAccountHealth(a) === 'connected' && a.autoSyncEnabled !== false);

  const results = [];
  const errors = [];

  for (const acc of activeAccounts) {
    try {
      const res = await syncBrokerAccount(acc);
      results.push({ account: acc, trades: res.pairedTrades, count: res.pairedTrades.length });
    } catch (err) {
      errors.push({ account: acc, error: err.message });
    }
  }

  return { results, errors, totalSynced: results.reduce((sum, r) => sum + r.count, 0) };
}

// ── 6. Match and Pair Buy/Sell Fills into Journal Trades (FIFO Consolidation) ──
export function pairExecutionFills(fills = []) {
  if (!fills || fills.length === 0) return [];

  // Group fills strictly by symbol
  const bySymbol = {};
  fills.forEach(f => {
    const sym = f.symbol || f.name;
    if (!bySymbol[sym]) bySymbol[sym] = [];
    bySymbol[sym].push(f);
  });

  const completedTrades = [];

  Object.entries(bySymbol).forEach(([symbol, symbolFills]) => {
    // Sort fills chronologically
    const sortedFills = [...symbolFills].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateA.localeCompare(dateB);
    });

    const buys = sortedFills.filter(f => (f.type || '').toUpperCase().includes('BUY'));
    const sells = sortedFills.filter(f => (f.type || '').toUpperCase().includes('SELL'));

    // If both buys and sells exist, pair them
    if (buys.length > 0 && sells.length > 0) {
      const totalBuyQty = buys.reduce((acc, b) => acc + (b.qty || 0), 0);
      const totalSellQty = sells.reduce((acc, s) => acc + (s.qty || 0), 0);

      const totalBuyValue = buys.reduce((acc, b) => acc + ((b.qty || 0) * (b.price || b.avgEntry || 0)), 0);
      const totalSellValue = sells.reduce((acc, s) => acc + ((s.qty || 0) * (s.price || b.avgExit || 0)), 0);

      const avgBuyPrice = totalBuyQty > 0 ? totalBuyValue / totalBuyQty : 0;
      const avgSellPrice = totalSellQty > 0 ? totalSellValue / totalSellQty : 0;

      const firstBuy = buys[0];
      const lastSell = sells[sells.length - 1];
      const isClosed = totalBuyQty <= totalSellQty;
      const matchedQty = Math.min(totalBuyQty, totalSellQty);
      const openQty = Math.max(0, totalBuyQty - totalSellQty);
      const pnl = (avgSellPrice - avgBuyPrice) * matchedQty;

      // Collect all exchange trade IDs
      const fillTradeIds = sortedFills.flatMap(f => {
        const ids = [];
        if (f.tradeId) ids.push(String(f.tradeId));
        if (f.orderId) ids.push(String(f.orderId));
        if (f.exchangeTradeId) ids.push(String(f.exchangeTradeId));
        if (Array.isArray(f.allExchangeTradeIds)) ids.push(...f.allExchangeTradeIds);
        return ids;
      }).map(s => String(s).trim()).filter(Boolean);
      const uniqueFillIds = Array.from(new Set(fillTradeIds));

      // Separate pyramid legs if multiple buys exist
      const initialBuy = buys[0];
      const p1 = buys[1] || null;
      const p2 = buys[2] || null;

      // Separate exit legs if multiple sells exist
      const e1 = sells[0] || null;
      const e2 = sells[1] || null;
      const e3 = sells[2] || null;
      const e4 = sells[3] || null;

      completedTrades.push({
        id: 'synced_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        allExchangeTradeIds: uniqueFillIds,
        name: symbol,
        symbol: symbol,
        type: 'Buy',
        direction: 'LONG',
        date: initialBuy?.date || new Date().toLocaleDateString('en-IN').replace(/\//g, '-'),
        entryDate: initialBuy?.date,
        exitDate: isClosed ? lastSell?.date : '',
        qty: initialBuy?.qty || totalBuyQty,
        entry: Math.round((initialBuy?.price || avgBuyPrice) * 100) / 100,
        avgEntry: Math.round(avgBuyPrice * 100) / 100,
        p1Price: p1 ? p1.price : 0,
        p1Qty: p1 ? p1.qty : 0,
        p1Date: p1 ? p1.date : '',
        p2Price: p2 ? p2.price : 0,
        p2Qty: p2 ? p2.qty : 0,
        p2Date: p2 ? p2.date : '',
        e1Price: e1 ? e1.price : (isClosed && avgSellPrice > 0 ? Math.round(avgSellPrice * 100) / 100 : 0),
        e1Qty: e1 ? e1.qty : (isClosed ? matchedQty : 0),
        e1Date: e1 ? e1.date : (lastSell?.date || ''),
        e2Price: e2 ? e2.price : 0,
        e2Qty: e2 ? e2.qty : 0,
        e2Date: e2 ? e2.date : '',
        e3Price: e3 ? e3.price : 0,
        e3Qty: e3 ? e3.qty : 0,
        e3Date: e3 ? e3.date : '',
        e4Price: e4 ? e4.price : 0,
        e4Qty: e4 ? e4.qty : 0,
        e4Date: e4 ? e4.date : '',
        openQty: openQty,
        exitedQty: matchedQty,
        avgExit: avgSellPrice > 0 ? Math.round(avgSellPrice * 100) / 100 : null,
        avgExitPrice: avgSellPrice > 0 ? Math.round(avgSellPrice * 100) / 100 : null,
        status: isClosed ? 'Closed' : (openQty > 0 && matchedQty > 0 ? 'Partial' : 'Open'),
        entryTime: initialBuy?.entryTime || '09:30',
        exitTime: lastSell?.exitTime || '15:15',
        pnl: Math.round(pnl * 100) / 100,
        pnlPct: avgBuyPrice > 0 ? Math.round(((avgSellPrice - avgBuyPrice) / avgBuyPrice) * 1000) / 10 : 0,
        setup: 'Breakout',
        broker: initialBuy?.broker || initialBuy?.source || 'Broker Import'
      });
    } else {
      // Only buys or only sells: each fill represents a leg / open position
      sortedFills.forEach((f, idx) => {
        const isBuy = (f.type || '').toUpperCase().includes('BUY');
        const fIds = [f.tradeId, f.orderId, f.exchangeTradeId, ...(Array.isArray(f.allExchangeTradeIds) ? f.allExchangeTradeIds : [])]
          .map(s => String(s || '').trim()).filter(Boolean);
        const uniqueFIds = Array.from(new Set(fIds));

        completedTrades.push({
          id: 'synced_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          allExchangeTradeIds: uniqueFIds,
          name: symbol,
          symbol: symbol,
          type: isBuy ? 'Buy' : 'Sell',
          direction: isBuy ? 'LONG' : 'SHORT',
          date: f.date || new Date().toLocaleDateString('en-IN').replace(/\//g, '-'),
          qty: f.qty || 1,
          entry: f.price || 0,
          avgEntry: f.price || 0,
          avgExit: null,
          avgExitPrice: null,
          status: 'Open',
          openQty: f.qty || 1,
          exitedQty: 0,
          entryTime: f.entryTime || '09:30',
          pnl: 0,
          pnlPct: 0,
          setup: 'Breakout',
          broker: f.broker || f.source || 'Broker Import'
        });
      });
    }
  });

  return completedTrades;
}
