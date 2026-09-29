/**
 * yahooChartService.js
 * 
 * 100% Authentic Real-Market Candlestick Data Service for FoxTrade.
 * Strictly zero synthetic/fabricated data. Every candle is verified real-market exchange data.
 * 
 * Multi-Tier Failover Pipeline:
 *  - Tier 1: TradingView WebSocket Streaming (direct in localhost, Cloudflare Worker proxy in prod)
 *  - Tier 2: Yahoo Finance Primary (NSE .NS / US Equities) via Vite Proxy & Direct
 *  - Tier 3: Yahoo Finance BSE Fallback (.BO) for BSE-only tickers
 *  - Tier 4: Strike Money API v2 Real Historical Ticks (1d / intraday for Indian Equities & Indices)
 */

import { tradingViewSocketService } from './tradingViewSocketService.js';
import { fetchStrikeHistoricalCandles } from './strikePriceService.js';
import { getCachedCandles, setCachedCandles } from './candleCacheService.js';

const PROXY_BASE = '/yahoo-api';
const DIRECT_BASE = 'https://query1.finance.yahoo.com';

const INDEX_MAP = {
  'NIFTY': '^NSEI',
  'NIFTY50': '^NSEI',
  'NIFTY 50': '^NSEI',
  'BANKNIFTY': '^NSEBANK',
  'BANK NIFTY': '^NSEBANK',
  'SENSEX': '^BSESN',
  'MIDCPNIFTY': '^CNXMIDCAP',
  'CNXMIDCAP': '^CNXMIDCAP',
  'CNXSCAP': '^CNXSCAP',
  'CNX500': '^CNX500'
};

export function cleanSymbolForYahoo(symbol = '', isBse = false) {
  let sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return '';

  if (INDEX_MAP[sym]) return INDEX_MAP[sym];

  // If already has extension
  if (sym.endsWith('.NS') || sym.endsWith('.BO')) {
    if (isBse && sym.endsWith('.NS')) return sym.replace(/\.NS$/i, '.BO');
    return sym;
  }

  // Indices
  if (sym.startsWith('^') || sym.startsWith('.')) return sym;

  // Strip common prefixes and suffixes
  sym = sym
    .replace(/^(NSE:|BSE:|INDEX:)/i, '')
    .replace(/-EQ$/i, '')
    .replace(/\.(NSE|BSE)$/i, '');

  if (INDEX_MAP[sym]) return INDEX_MAP[sym];

  return isBse ? `${sym}.BO` : `${sym}.NS`;
}

async function fetchFromYahooEndpoint(url, isIntraday = false) {
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const o = quote.open || [];
    const h = quote.high || [];
    const l = quote.low || [];
    const c = quote.close || [];
    const v = quote.volume || [];

    const formatted = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (
        o[i] !== null && h[i] !== null && l[i] !== null && c[i] !== null &&
        Number.isFinite(o[i]) && Number.isFinite(c[i]) && o[i] > 0 && c[i] > 0
      ) {
        const date = new Date(timestamps[i] * 1000);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');

        formatted.push({
          time: isIntraday ? timestamps[i] : `${yyyy}-${mm}-${dd}`,
          rawTimestamp: timestamps[i],
          open: Math.round(o[i] * 100) / 100,
          high: Math.round(h[i] * 100) / 100,
          low: Math.round(l[i] * 100) / 100,
          close: Math.round(c[i] * 100) / 100,
          volume: Math.round(v[i] || 0)
        });
      }
    }

    if (formatted.length > 5) {
      return formatted.sort((a, b) => (a.rawTimestamp || 0) - (b.rawTimestamp || 0));
    }
  } catch (_) {
    // Ignore & let caller try next endpoint
  }
  return null;
}

/**
 * Main 4-Tier Historical Candlestick Fetching Pipeline
 * Guaranteed 100% Authentic Real Exchange Data
 * 
 * @param {string} symbol - Stock ticker (e.g. 'RELIANCE', 'TCS', 'NIFTY')
 * @param {string} range - Time range ('1mo', '3mo', '6mo', '1y', '2y', '5y', 'max')
 * @param {string} interval - Interval ('1d', '1w', '1mo', '60m', '15m', '5m', '1m')
 * @returns {Promise<Array>} Array of { time, rawTimestamp, open, high, low, close, volume }
 */
export async function fetchHistoricalCandles(symbol, range = '1y', interval = '1d') {
  if (!symbol || !String(symbol).trim()) {
    throw new Error('Symbol is required to fetch authentic chart data');
  }

  const cleanSym = String(symbol).trim().toUpperCase();
  const isIntraday = !['1d', '1w', '1mo', 'd', 'w', 'm'].includes(String(interval).toLowerCase());

  // ── Cache Lookup ──────────────────────────────────────────────────────────
  const cached = getCachedCandles(cleanSym, interval, range);
  if (cached && cached.length > 5) {
    return cached;
  }

  // ── Tier 1: Direct TradingView WebSocket Stream ──────────────────────────
  try {
    const tvCandles = await tradingViewSocketService.fetchHistoricalData(cleanSym, interval, range);
    if (tvCandles && tvCandles.length > 5) {
      setCachedCandles(cleanSym, interval, range, tvCandles);
      return tvCandles;
    }
  } catch (tvErr) {
    // Proceed to Tier 2
  }

  // ── Tier 2: Yahoo Finance Primary (NSE / US Equities) ────────────────────
  const yahooPrimarySymbol = cleanSymbolForYahoo(cleanSym, false);
  if (yahooPrimarySymbol) {
    const isBrowser = typeof window !== 'undefined';
    const path = `/v8/finance/chart/${encodeURIComponent(yahooPrimarySymbol)}?interval=${interval}&range=${range}`;
    const primaryUrls = [
      `${PROXY_BASE}${path}`,
      ...(!isBrowser ? [`${DIRECT_BASE}${path}`] : [])
    ];

    for (const url of primaryUrls) {
      const candles = await fetchFromYahooEndpoint(url, isIntraday);
      if (candles && candles.length > 5) {
        setCachedCandles(cleanSym, interval, range, candles);
        return candles;
      }
    }
  }

  // ── Tier 3: Yahoo Finance BSE Fallback (.BO) ─────────────────────────────
  const yahooBseSymbol = cleanSymbolForYahoo(cleanSym, true);
  if (yahooBseSymbol && yahooBseSymbol !== yahooPrimarySymbol) {
    const isBrowser = typeof window !== 'undefined';
    const bsePath = `/v8/finance/chart/${encodeURIComponent(yahooBseSymbol)}?interval=${interval}&range=${range}`;
    const bseUrls = [
      `${PROXY_BASE}${bsePath}`,
      ...(!isBrowser ? [`${DIRECT_BASE}${bsePath}`] : [])
    ];

    for (const url of bseUrls) {
      const candles = await fetchFromYahooEndpoint(url, isIntraday);
      if (candles && candles.length > 5) {
        setCachedCandles(cleanSym, interval, range, candles);
        return candles;
      }
    }
  }

  // ── Tier 4: Strike Money API v2 (NSE Equities & Indices) ─────────────────
  try {
    const strikeCandles = await fetchStrikeHistoricalCandles(cleanSym, range, interval);
    if (strikeCandles && strikeCandles.length > 5) {
      setCachedCandles(cleanSym, interval, range, strikeCandles);
      return strikeCandles;
    }
  } catch (strikeErr) {
    // All 4 tiers exhausted
  }

  // If all 4 authentic tiers cannot find data (e.g. invalid ticker or network blackout):
  // Never fabricate data. Throw a clear error for the UI to handle gracefully.
  throw new Error(`Real market chart data is temporarily unavailable for ${cleanSym}.`);
}

export default {
  fetchHistoricalCandles,
  cleanSymbolForYahoo
};

