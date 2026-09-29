/**
 * yahooService.js
 * Fetches real-time stock prices (CMP) and previous close from Yahoo Finance API.
 * Uses the Vite dev proxy (/yahoo-api/*) in development and falls back to direct fetch.
 */

const PROXY_BASE = '/yahoo-api';
const DIRECT_BASE = 'https://query1.finance.yahoo.com';

import { getCanonicalSymbol } from '../utils/securityMaster.js';

function cleanSymbolForYahoo(symbol) {
  let sym = symbol.trim().toUpperCase();
  if (!sym) return '';
  
  // Resolve corporate action ticker changes (e.g. ZOMATO -> ETERNAL, TATAMOTORS -> TMCV)
  sym = getCanonicalSymbol(sym);

  // Handlers for indices
  if (sym === 'NIFTY' || sym === 'NIFTY50' || sym === 'NIFTY 50') return '^NSEI';
  if (sym === 'BANKNIFTY' || sym === 'BANK NIFTY') return '^NSEBANK';
  if (sym === 'SENSEX') return '^BSESN';

  // If it is an option or futures contract (e.g. NIFTY 23200 CE), skip external Yahoo ticker lookup
  if (sym.includes(' CE') || sym.includes(' PE') || sym.includes(' FUT') || sym.includes('FUT')) {
    return null;
  }
  
  // If it already has an exchange suffix, return as is
  if (sym.endsWith('.NS') || sym.endsWith('.BO')) {
    return sym;
  }
  
  // Handlers for special symbols
  if (sym === 'M&M' || sym === 'M_M' || sym === 'MM') return 'M&M.NS';
  if (sym === 'L&TFH' || sym === 'L_TFH') return 'LTF.NS';

  // Default to NSE (.NS) for Indian equities
  const clean = sym.replace(/[^A-Z0-9&]/g, '');
  return clean ? `${clean}.NS` : null;
}

// In-memory price cache & request deduplication to eliminate duplicate calls
const priceCache = new Map(); // key -> { data, expiresAt }
const pendingRequests = new Map(); // key -> Promise
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

export async function fetchStockPrice(symbol) {
  const yahooSymbol = cleanSymbolForYahoo(symbol);
  if (!yahooSymbol) return null;

  const cacheKey = yahooSymbol.toUpperCase();

  // 1. Check TTL Cache
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  // 2. Check in-flight requests (deduplication)
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  // 3. Initiate single request & memoize promise
  const requestPromise = (async () => {
    const path = `/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;
    
    // Try proxy first (development), then direct fallback (Node/SSR only)
    const isBrowser = typeof window !== 'undefined';
    const urls = [
      `${PROXY_BASE}${path}`,
      ...(!isBrowser ? [`${DIRECT_BASE}${path}`] : [])
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: {
            'Accept': 'application/json'
          }
        });
        if (!res.ok) continue;
        const json = await res.json();
        
        const meta = json?.chart?.result?.[0]?.meta;
        if (meta) {
          const regularMarketPrice = meta.regularMarketPrice;
          const previousClose = meta.previousClose || meta.chartPreviousClose || regularMarketPrice;
          const change = regularMarketPrice - previousClose;
          const changePercent = previousClose ? (change / previousClose) * 100 : 0;
          
          const result = {
            symbol: symbol.toUpperCase(),
            cmp: regularMarketPrice,
            price: regularMarketPrice,
            previousClose,
            change: parseFloat(change.toFixed(2)),
            changePercent: parseFloat(changePercent.toFixed(2)),
            currency: meta.currency || 'INR'
          };

          // Store in cache
          priceCache.set(cacheKey, {
            data: result,
            expiresAt: Date.now() + CACHE_TTL_MS
          });

          return result;
        }
      } catch {
        // Continue loop or return fallback
      }
    }

    return null;
  })().finally(() => {
    pendingRequests.delete(cacheKey);
  });

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
}
