/**
 * strikePriceService.js
 * 
 * Strike Money REST Price Service (Tier-2 Real-Time / Intraday Fallback)
 * Fetches 1-minute intraday candle ticks for NSE/BSE equities and indices.
 * 
 * Endpoint: https://api-v2.strike.money/v2/api/equity/priceticks
 */

const INDEX_TICKERS = new Set([
  'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'CNX500', 'CNXSCAP',
  'CNXMIDCAP', 'NIFMSC400', 'SENSEX', 'NIFTYNXT50', 'NIFTY50'
]);

function formatStrikeDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}%3A${pad(date.getMinutes())}%3A${pad(date.getSeconds())}%2B05%3A30`;
}

export async function fetchStrikePrice(symbol) {
  if (!symbol) return null;
  const clean = String(symbol)
    .trim()
    .toUpperCase()
    .replace(/^(NSE:|BSE:|INDEX:)/i, '')
    .replace(/\.(NS|BO|EQ|NF|BF)$/i, '')
    .replace(/-EQ$/i, '');

  const isIndex = INDEX_TICKERS.has(clean);
  const securityParam = isIndex ? `EQ%3A${clean}%3AINDEX` : `EQ%3A${clean}`;

  const now = new Date();
  // Look back 48 hours to reliably fetch the latest intraday 1m ticks during off-market hours & weekends
  const fromDate = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const from5dDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Past 7 days fallback

  const fromStr = formatStrikeDate(fromDate);
  const from5dStr = formatStrikeDate(from5dDate);
  const toStr = formatStrikeDate(now);

  const fetchTicks = async (interval, from) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const url = `https://api-v2.strike.money/v2/api/equity/priceticks?candleInterval=${interval}&from=${from}&to=${toStr}&securities=${securityParam}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const data = await res.json();
      return data.data?.ticks?.[clean] || data.data?.ticks?.[symbol];
    } catch (_) {
      return null;
    }
  };

  try {
    let ticks = await fetchTicks('1m', fromStr);
    if (!Array.isArray(ticks) || ticks.length === 0) {
      ticks = await fetchTicks('1d', from5dStr);
    }

    if (Array.isArray(ticks) && ticks.length > 0) {
      const latestTick = ticks[ticks.length - 1];
      // Tick array format: [timestampStr, open, high, low, close, volume, deliveryVolume]
      const closePrice = Number(latestTick[4]);
      if (Number.isFinite(closePrice) && closePrice > 0) {
        return {
          symbol: clean,
          price: closePrice,
          open: Number(latestTick[1]),
          high: Number(latestTick[2]),
          low: Number(latestTick[3]),
          volume: Number(latestTick[5]),
          timestamp: Date.now(),
          status: 'strike'
        };
      }
    }
  } catch (err) {
    // Network / abort error
  }

  return null;
}

const STRIKE_INDEX_MAP = {
  '^NSEI': 'NIFTY',
  'NIFTY': 'NIFTY',
  'NIFTY50': 'NIFTY',
  'NIFTY 50': 'NIFTY',
  '^NSEBANK': 'BANKNIFTY',
  'BANKNIFTY': 'BANKNIFTY',
  'BANK NIFTY': 'BANKNIFTY',
  '^BSESN': 'SENSEX',
  'SENSEX': 'SENSEX',
  '^CNXMIDCAP': 'CNXMIDCAP',
  'NIFMSC400': 'NIFMSC400',
  'MIDCPNIFTY': 'MIDCPNIFTY',
  'FINNIFTY': 'FINNIFTY',
  '^CNXSCAP': 'CNXSCAP',
  'CNXSCAP': 'CNXSCAP',
  '^CNX500': 'CNX500',
  'CNX500': 'CNX500',
  'NIFTYNXT50': 'NIFTYNXT50'
};

/**
 * Fetch authentic historical candles from Strike Money REST API
 * Tier-4 Authentic Real-Market Fallback
 * @param {string} symbol - Ticker
 * @param {string} range - Time range ('1mo', '3mo', '6mo', '1y', '2y', '5y', 'max')
 * @param {string} interval - Interval ('1d', '1w', '1mo', '60m', '15m', '5m', '1m')
 * @param {Date|string} customFrom - Optional custom start date
 * @param {Date|string} customTo - Optional custom end date
 * @returns {Promise<Array|null>} Real OHLCV candles
 */
export async function fetchStrikeHistoricalCandles(symbol, range = '1y', interval = '1d', customFrom = null, customTo = null) {
  if (!symbol) return null;

  let clean = String(symbol)
    .trim()
    .toUpperCase()
    .replace(/^(NSE:|BSE:|INDEX:)/i, '')
    .replace(/\.(NS|BO|EQ|NF|BF)$/i, '')
    .replace(/-EQ$/i, '');

  if (STRIKE_INDEX_MAP[clean]) {
    clean = STRIKE_INDEX_MAP[clean];
  }

  const isIndex = INDEX_TICKERS.has(clean) || Boolean(STRIKE_INDEX_MAP[clean]);
  const securityParam = isIndex ? `EQ%3A${clean}%3AINDEX` : `EQ%3A${clean}`;

  const now = new Date();
  let fromDate;
  let toDate = customTo ? new Date(customTo) : now;

  if (customFrom) {
    fromDate = new Date(customFrom);
  } else {
    fromDate = new Date(now);
    switch (range) {
      case '1d':
      case '1D':
        fromDate.setDate(now.getDate() - 2);
        break;
      case '5d':
      case '5D':
        fromDate.setDate(now.getDate() - 8);
        break;
      case '1mo':
      case '1M':
        fromDate.setMonth(now.getMonth() - 1);
        break;
      case '3mo':
      case '3M':
        fromDate.setMonth(now.getMonth() - 3);
        break;
      case '6mo':
      case '6M':
        fromDate.setMonth(now.getMonth() - 6);
        break;
      case '2y':
      case '2Y':
        fromDate.setFullYear(now.getFullYear() - 2);
        break;
      case '5y':
      case '5Y':
        fromDate.setFullYear(now.getFullYear() - 5);
        break;
      case 'max':
      case 'all':
        fromDate.setFullYear(now.getFullYear() - 10);
        break;
      case '1y':
      case '1Y':
      default:
        fromDate.setFullYear(now.getFullYear() - 1);
        break;
    }
  }

  const fromStr = formatStrikeDate(fromDate);
  const toStr = formatStrikeDate(toDate);

  // Map interval for Strike API
  let candleInterval = '1d';
  const cleanInt = String(interval || '1d').toLowerCase();
  if (cleanInt === '1m' || cleanInt === '1min') candleInterval = '1m';
  else if (cleanInt === '5m' || cleanInt === '5min') candleInterval = '5m';
  else if (cleanInt === '15m' || cleanInt === '15min') candleInterval = '15m';
  else if (cleanInt === '60m' || cleanInt === '1h') candleInterval = '60m';
  else candleInterval = '1d';

  const url = `https://api-v2.strike.money/v2/api/equity/priceticks?candleInterval=${candleInterval}&from=${fromStr}&to=${toStr}&securities=${securityParam}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const json = await res.json();
    const rawTicks = json.data?.ticks?.[clean] || 
                     json.data?.ticks?.[`EQ:${clean}`] || 
                     json.data?.ticks?.[symbol.toUpperCase()] ||
                     json.data?.ticks?.[symbol];

    if (!Array.isArray(rawTicks) || rawTicks.length === 0) return null;

    const candles = rawTicks.map(tick => {
      const d = new Date(tick[0]);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      
      const timeStr = (candleInterval === '1d') 
        ? `${yyyy}-${mm}-${dd}`
        : Math.floor(d.getTime() / 1000);

      return {
        time: timeStr,
        rawTimestamp: Math.floor(d.getTime() / 1000),
        open: Number(tick[1]),
        high: Number(tick[2]),
        low: Number(tick[3]),
        close: Number(tick[4]),
        volume: Number(tick[5]) || 0
      };
    }).filter(c => Number.isFinite(c.open) && Number.isFinite(c.close) && c.open > 0 && c.close > 0);

    if (candles.length > 0) {
      candles.sort((a, b) => (a.rawTimestamp || 0) - (b.rawTimestamp || 0));
      return candles;
    }
  } catch (_) {
    // Return null to allow next tier or caller handling
  }

  return null;
}

export default {
  fetchStrikePrice,
  fetchStrikeHistoricalCandles
};
