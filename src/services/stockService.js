/**
 * stockService.js
 * Comprehensive Multi-Tier Stock Search & Master List Service for FoxTrade
 * 
 * Sources:
 * 1. Indian Equities:
 *    - Local master datasets (/data/EQUITY_L.csv + /data/symbol-mappings.json)
 *    - Live Screener.in API search proxy (/api/screener/company/search?q=...)
 *    - Major indices (NIFTY, BANKNIFTY, SENSEX, FINNIFTY, etc.)
 * 
 * 2. US Equities:
 *    - Dhan INX search API (https://inx-ow-search.dhan.co/Search/api/Search/getUSScrip)
 *    - Yahoo Finance US search API (/yahoo-search?q=...)
 *    - Major US mega-caps & ETFs (AAPL, NVDA, MSFT, TSLA, SPY, QQQ, etc.)
 */
import { getCanonicalSymbol, findCorporateActionMatches, getHistoricalAliasNote } from '../utils/securityMaster.js';

const CACHE_KEY_INDIA = 'tradeontip_nse_equity_list';
const CACHE_TS_KEY_INDIA = 'tradeontip_nse_equity_list_ts';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory caches for instant responses
let _cachedIndiaStocks = null;
let _cachedMappings = null;
const _liveSearchCache = new Map(); // queryKey -> { results, timestamp }
const LIVE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Major Indian Indices & Benchmarks
export const ALWAYS_INCLUDE_INDIA = [
  { symbol: 'NIFTY', name: 'NIFTY 50 Index', exchange: 'NSE', isIndex: true },
  { symbol: 'BANKNIFTY', name: 'Bank Nifty Index', exchange: 'NSE', isIndex: true },
  { symbol: 'FINNIFTY', name: 'Fin Nifty Index', exchange: 'NSE', isIndex: true },
  { symbol: 'MIDCPNIFTY', name: 'Midcap Nifty Index', exchange: 'NSE', isIndex: true },
  { symbol: 'NIFTYNXT50', name: 'Nifty Next 50 Index', exchange: 'NSE', isIndex: true },
  { symbol: 'SENSEX', name: 'BSE Sensex Index', exchange: 'BSE', isIndex: true },
  { symbol: 'BANKEX', name: 'BSE Bankex Index', exchange: 'BSE', isIndex: true },
  { symbol: 'INDIAVIX', name: 'India Volatility Index', exchange: 'NSE', isIndex: true }
];

// Major US Equities & ETFs
export const ALWAYS_INCLUDE_US = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (Class A)', exchange: 'NASDAQ' },
  { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE Arca' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq 100)', exchange: 'NASDAQ' },
  { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF', exchange: 'NYSE Arca' },
  { symbol: 'AMD', name: 'Advanced Micro Devices Inc.', exchange: 'NASDAQ' },
  { symbol: 'NFLX', name: 'Netflix Inc.', exchange: 'NASDAQ' },
  { symbol: 'PLTR', name: 'Palantir Technologies Inc.', exchange: 'NYSE' },
  { symbol: 'COIN', name: 'Coinbase Global Inc.', exchange: 'NASDAQ' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc.', exchange: 'NYSE' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE' },
  { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE' },
  { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE' },
  { symbol: 'DIS', name: 'The Walt Disney Company', exchange: 'NYSE' }
];

/** Parse CSV text of EQUITY_L.csv */
function parseEquityCSV(csvText) {
  const lines = csvText.split('\n');
  const stocks = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 2) continue;

    const symbol = parts[0]?.trim();
    const name = parts[1]?.trim().replace(/^"|"$/g, '');
    const series = parts[2]?.trim();

    if (symbol && name && (series === 'EQ' || series === 'BE' || series === 'SM' || series === 'ST' || !series)) {
      stocks.push({ symbol, name, exchange: 'NSE' });
    }
  }

  return stocks;
}

/** Load symbol mappings dictionary */
async function loadSymbolMappings() {
  if (_cachedMappings) return _cachedMappings;
  try {
    const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';
    const res = await fetch(`${baseUrl}data/symbol-mappings.json`);
    if (res.ok) {
      const data = await res.json();
      _cachedMappings = Array.isArray(data) ? data : (data.specificMappings || []);
      return _cachedMappings;
    }
  } catch {}
  return [];
}

/** Load Indian Master Equity List */
export async function getStockList(market = 'india') {
  if (market === 'us') {
    return ALWAYS_INCLUDE_US;
  }

  if (_cachedIndiaStocks && _cachedIndiaStocks.length > 0) {
    return _cachedIndiaStocks;
  }

  // Check localStorage
  try {
    const ts = parseInt(localStorage.getItem(CACHE_TS_KEY_INDIA) || '0', 10);
    if (Date.now() - ts < CACHE_TTL_MS) {
      const raw = localStorage.getItem(CACHE_KEY_INDIA);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          _cachedIndiaStocks = parsed;
          return parsed;
        }
      }
    }
  } catch {}

  // Try loading from local /data/EQUITY_L.csv first, then fallback to proxy
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';
  const urlsToTry = [
    `${baseUrl}data/EQUITY_L.csv`,
    '/nse-api/content/equities/EQUITY_L.csv'
  ];

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) {
        const csvText = await res.text();
        let parsed = parseEquityCSV(csvText);
        if (parsed.length > 0) {
          _cachedIndiaStocks = [...ALWAYS_INCLUDE_INDIA, ...parsed];
          try {
            localStorage.setItem(CACHE_KEY_INDIA, JSON.stringify(_cachedIndiaStocks));
            localStorage.setItem(CACHE_TS_KEY_INDIA, String(Date.now()));
          } catch {}
          return _cachedIndiaStocks;
        }
      }
    } catch {}
  }

  _cachedIndiaStocks = getFallbackList('india');
  return _cachedIndiaStocks;
}

/** Synchronous Fallback stock list */
export function getFallbackList(market = 'india') {
  if (market === 'us') return ALWAYS_INCLUDE_US;

  return [
    ...ALWAYS_INCLUDE_INDIA,
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'NSE' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', exchange: 'NSE' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', exchange: 'NSE' },
    { symbol: 'INFY', name: 'Infosys Ltd', exchange: 'NSE' },
    { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', exchange: 'NSE' },
    { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE' },
    { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd', exchange: 'NSE' },
    { symbol: 'AXISBANK', name: 'Axis Bank Ltd', exchange: 'NSE' },
    { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', exchange: 'NSE' },
    { symbol: 'ITC', name: 'ITC Ltd', exchange: 'NSE' },
    { symbol: 'ETERNAL', name: 'Eternal Ltd (formerly Zomato)', exchange: 'NSE', alias: 'ZOMATO' },
    { symbol: 'HAL', name: 'Hindustan Aeronautics Ltd', exchange: 'NSE' },
    { symbol: 'TMCV', name: 'Tata Motors Ltd (Commercial Vehicles)', exchange: 'NSE', alias: 'TATAMOTORS' },
    { symbol: 'TMPV', name: 'Tata Motors Passenger Vehicles Ltd', exchange: 'NSE', alias: 'TATAMOTORS' },
    { symbol: 'LTIM', name: 'LTIMindtree Ltd', exchange: 'NSE', alias: 'MINDTREE' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', exchange: 'NSE' },
    { symbol: 'TATASTEEL', name: 'Tata Steel Ltd', exchange: 'NSE' },
    { symbol: 'TATAPOWER', name: 'Tata Power Company Ltd', exchange: 'NSE' },
    { symbol: 'TATACONSUM', name: 'Tata Consumer Products Ltd', exchange: 'NSE' },
    { symbol: 'WIPRO', name: 'Wipro Ltd', exchange: 'NSE' },
    { symbol: 'HCLTECH', name: 'HCL Technologies Ltd', exchange: 'NSE' },
    { symbol: 'TECHM', name: 'Tech Mahindra Ltd', exchange: 'NSE' },
    { symbol: 'LT', name: 'Larsen & Toubro Ltd', exchange: 'NSE' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', exchange: 'NSE' },
    { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', exchange: 'NSE' },
    { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv Ltd', exchange: 'NSE' },
    { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', exchange: 'NSE' },
    { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd', exchange: 'NSE' },
    { symbol: 'TITAN', name: 'Titan Company Ltd', exchange: 'NSE' },
    { symbol: 'SUNPHARMA', name: 'Sun Pharma Industries', exchange: 'NSE' },
    { symbol: 'NTPC', name: 'NTPC Ltd', exchange: 'NSE' },
    { symbol: 'POWERGRID', name: 'Power Grid Corporation', exchange: 'NSE' },
    { symbol: 'COALINDIA', name: 'Coal India Ltd', exchange: 'NSE' },
    { symbol: 'ONGC', name: 'Oil & Natural Gas Corp', exchange: 'NSE' },
    { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd', exchange: 'NSE' },
    { symbol: 'ADANIPORTS', name: 'Adani Ports & SEZ Ltd', exchange: 'NSE' },
    { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd', exchange: 'NSE' },
    { symbol: 'HINDALCO', name: 'Hindalco Industries Ltd', exchange: 'NSE' },
    { symbol: 'VEDL', name: 'Vedanta Ltd', exchange: 'NSE' },
    { symbol: 'MM', name: 'Mahindra & Mahindra Ltd', exchange: 'NSE' },
    { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp Ltd', exchange: 'NSE' },
    { symbol: 'EICHERMOT', name: 'Eicher Motors Ltd', exchange: 'NSE' },
    { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd', exchange: 'NSE' },
    { symbol: 'GRASIM', name: 'Grasim Industries Ltd', exchange: 'NSE' },
    { symbol: 'DRREDDY', name: 'Dr Reddys Laboratories', exchange: 'NSE' },
    { symbol: 'CIPLA', name: 'Cipla Ltd', exchange: 'NSE' },
  ];
}

/**
 * Query Screener.in live search API for Indian equities
 */
async function searchScreenerIndia(query) {
  if (!query || query.trim().length < 2) return [];
  const cacheKey = `screener_${query.toLowerCase().trim()}`;
  const cached = _liveSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < LIVE_CACHE_TTL) {
    return cached.results;
  }

  const endpoints = [
    `/api/screener/company/search/?q=${encodeURIComponent(query)}&v=3`,
    `/screener-api/company/search/?q=${encodeURIComponent(query)}&v=3`,
    `https://www.screener.in/api/company/search/?q=${encodeURIComponent(query)}&v=3`
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const results = data.map(item => {
            const match = item.url ? item.url.match(/\/company\/([^/]+)\//) : null;
            const symbol = match ? match[1].toUpperCase() : (item.name.split(' ')[0].toUpperCase());
            return {
              symbol,
              name: item.name,
              exchange: 'NSE',
              screenerId: item.id,
              screenerUrl: item.url
            };
          });
          _liveSearchCache.set(cacheKey, { results, timestamp: Date.now() });
          return results;
        }
      }
    } catch {}
  }
  return [];
}

/**
 * Query Dhan INX or Yahoo Search for US Equities
 */
async function searchUsEquities(query) {
  if (!query || query.trim().length < 1) return [];
  const q = query.trim();
  const cacheKey = `us_${q.toLowerCase()}`;
  const cached = _liveSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < LIVE_CACHE_TTL) {
    return cached.results;
  }

  // 1. Try Dhan US Scrip Search API
  try {
    const res = await fetch('https://inx-ow-search.dhan.co/Search/api/Search/getUSScrip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        RequestCode: '1',
        Source: 'W',
        UserId: '1000000000',
        Data: { searchterm: q }
      }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined
    });

    if (res.ok) {
      const json = await res.json();
      const rawData = json?.data;
      if (Array.isArray(rawData) && rawData.length > 0) {
        const results = rawData.map(item => {
          const sym = String(item.symbol || item.exch_symbol || '').toUpperCase().trim();
          const name = String(item.custom_symbol || item.symbol_name || sym).trim();
          const exch = String(item.cust_exchange || item.exchange || 'NASDAQ').trim();
          return {
            symbol: sym,
            name: name,
            exchange: exch
          };
        }).filter(item => item.symbol);

        if (results.length > 0) {
          _liveSearchCache.set(cacheKey, { results, timestamp: Date.now() });
          return results;
        }
      }
    }
  } catch {}

  // 2. Try Yahoo Finance Search
  try {
    const res = await fetch(`/yahoo-search?q=${encodeURIComponent(q)}&lang=en-US&region=US&quotesCount=12`, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined
    });
    if (res.ok) {
      const data = await res.json();
      const quotes = data?.quotes || [];
      const results = quotes
        .filter(q => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
        .map(q => ({
          symbol: String(q.symbol || '').toUpperCase(),
          name: q.longname || q.shortname || q.symbol,
          exchange: q.exchange || 'US'
        }));

      if (results.length > 0) {
        _liveSearchCache.set(cacheKey, { results, timestamp: Date.now() });
        return results;
      }
    }
  } catch {}

  // 3. Fallback: filter pre-bundled US list
  const lowerQ = q.toLowerCase();
  return ALWAYS_INCLUDE_US.filter(s =>
    s.symbol.toLowerCase().includes(lowerQ) || s.name.toLowerCase().includes(lowerQ)
  );
}

/**
 * Main Multi-Tier Stock Search Function
 * Returns structured array of { symbol, name, exchange }
 */
export async function searchStocks(query, market = 'india', limit = 15) {
  const cleanQ = (query || '').trim();
  if (!cleanQ) {
    return (market === 'us' ? ALWAYS_INCLUDE_US : ALWAYS_INCLUDE_INDIA).slice(0, limit);
  }

  const lowerQ = cleanQ.toLowerCase();

  if (market === 'us') {
    const usLive = await searchUsEquities(cleanQ);
    const seen = new Set();
    const merged = [];

    for (const item of usLive) {
      if (!seen.has(item.symbol)) {
        seen.add(item.symbol);
        merged.push(item);
      }
    }
    return merged.slice(0, limit);
  }

  // --- Indian Equities Search Pipeline ---
  const masterList = await getStockList('india');
  const mappings = await loadSymbolMappings();

  // Priority 0: Active Corporate Actions & Ticker Migrations (e.g. ZOMATO -> ETERNAL)
  const corporateMatches = findCorporateActionMatches(cleanQ);

  // Check alias mapping matches
  const mappedMatches = [];
  for (const m of mappings) {
    if (m.from && (m.from.toLowerCase().includes(lowerQ) || lowerQ.includes(m.from.toLowerCase()))) {
      const canonicalSym = getCanonicalSymbol(m.to || m.from);
      const found = masterList.find(s => s.symbol.toUpperCase() === canonicalSym.toUpperCase());
      if (found) {
        mappedMatches.push({ ...found, alias: m.from });
      }
    }
  }

  // Priority 1: Exact symbol matches (checked against canonical symbol first)
  const canonicalQ = getCanonicalSymbol(cleanQ).toLowerCase();
  const exactSym = masterList.filter(s => s.symbol.toLowerCase() === lowerQ || s.symbol.toLowerCase() === canonicalQ);
  // Priority 2: Symbol starts with query
  const startSym = masterList.filter(s => (s.symbol.toLowerCase().startsWith(lowerQ) || s.symbol.toLowerCase().startsWith(canonicalQ)) && s.symbol.toLowerCase() !== lowerQ && s.symbol.toLowerCase() !== canonicalQ);
  // Priority 3: Name starts with query
  const startName = masterList.filter(s => s.name.toLowerCase().startsWith(lowerQ) && !s.symbol.toLowerCase().startsWith(lowerQ));
  // Priority 4: Substring matches in symbol or name
  const subMatch = masterList.filter(s => 
    (s.symbol.toLowerCase().includes(lowerQ) || s.name.toLowerCase().includes(lowerQ)) &&
    !s.symbol.toLowerCase().startsWith(lowerQ) &&
    !s.name.toLowerCase().startsWith(lowerQ)
  );

  const localCandidates = [...corporateMatches, ...exactSym, ...mappedMatches, ...startSym, ...startName, ...subMatch];
  const seenSymbols = new Set();
  const dedupedLocal = [];

  for (const s of localCandidates) {
    const canonicalKey = getCanonicalSymbol(s.symbol);
    if (!seenSymbols.has(canonicalKey)) {
      seenSymbols.add(canonicalKey);
      dedupedLocal.push(s);
    }
  }

  // If local matches are sufficient, return them
  if (dedupedLocal.length >= limit) {
    return dedupedLocal.slice(0, limit);
  }

  // Otherwise, enrich with Screener live auto-suggest
  try {
    const liveScreener = await searchScreenerIndia(cleanQ);
    for (const item of liveScreener) {
      if (!seenSymbols.has(item.symbol)) {
        seenSymbols.add(item.symbol);
        dedupedLocal.push(item);
      }
    }
  } catch {}

  return dedupedLocal.slice(0, limit);
}
