// Finnhub API Integration Service for Live & Authentic Financial News
const FINNHUB_API_KEY = 'da9at21r01qvfj5v7kugda9at21r01qvfj5v7kv0';
const BASE_URL = 'https://finnhub.io/api/v1';

let cachedNews = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

// Indian & Global prominent ticker symbol dictionary for smart tagging
const KNOWN_TICKERS = [
  'RELIANCE', 'TATASTEEL', 'HDFCBANK', 'ICICIBANK', 'INFY', 'TCS', 'SBIN', 'BHARTIARTL',
  'ITC', 'KOTAKBANK', 'LT', 'AXISBANK', 'ASIANPAINT', 'TATAMOTORS', 'MARUTI', 'SUNPHARMA',
  'TITAN', 'BAJFINANCE', 'DMART', 'NESTLEIND', 'ULTRACEMCO', 'WIPRO', 'ONGC', 'NTPC',
  'POWERGRID', 'COALINDIA', 'ADANIENT', 'ADANIPORTS', 'JSWSTEEL', 'HINDALCO', 'TATACONSUM',
  'VEDL', 'HAL', 'BEL', 'IRFC', 'RVNL', 'ZOMATO', 'PAYTM', 'JIOFIN', 'NVDA', 'AAPL',
  'TSLA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'AMD', 'INTC', 'BEML', 'ACC', 'ASHOKA',
  'BAJAJ-AUTO', 'BAJAJFINSV', 'EICHERMOT', 'HEROMOTOCO', 'CIPLA', 'DRREDDY', 'APOLLOHOSP',
  'DIVISLAB', 'TECHM', 'HCLTECH', 'LTIM', 'INDUSINDBK', 'BANDHANBNK', 'IDFCFIRSTB',
  'FEDERALBNK', 'PNB', 'BANKBARODA', 'CANBK', 'BPCL', 'IOC', 'GAIL', 'PETRONET', 'RECLTD',
  'PFC', 'BHEL', 'SAIL', 'NMDC', 'TRENT', 'POLYCAB', 'DIXON', 'PERSISTENT', 'COFORGE',
  'KPITTECH', 'SUZLON', 'IREDA', 'SWIGGY', 'NYKAA', 'POLICYBZR', 'ZOMATO'
];

const COMPANY_ALIASES = [
  { regex: /\b(reliance|jio)\b/i, symbol: 'RELIANCE', company: 'Reliance Industries' },
  { regex: /\b(tata steel)\b/i, symbol: 'TATASTEEL', company: 'Tata Steel' },
  { regex: /\b(tata motors|jaguar land rover|jlr)\b/i, symbol: 'TATAMOTORS', company: 'Tata Motors' },
  { regex: /\b(hdfc bank|hdfc)\b/i, symbol: 'HDFCBANK', company: 'HDFC Bank' },
  { regex: /\b(icici bank|icici)\b/i, symbol: 'ICICIBANK', company: 'ICICI Bank' },
  { regex: /\b(state bank of india|sbi)\b/i, symbol: 'SBIN', company: 'SBI' },
  { regex: /\b(infosys|infy)\b/i, symbol: 'INFY', company: 'Infosys' },
  { regex: /\b(tcs|tata consultancy)\b/i, symbol: 'TCS', company: 'TCS' },
  { regex: /\b(bharti airtel|airtel)\b/i, symbol: 'BHARTIARTL', company: 'Bharti Airtel' },
  { regex: /\b(larsen & toubro|l&t)\b/i, symbol: 'LT', company: 'L&T' },
  { regex: /\b(adani)\b/i, symbol: 'ADANIENT', company: 'Adani Group' },
  { regex: /\b(zomato)\b/i, symbol: 'ZOMATO', company: 'Zomato' },
  { regex: /\b(paytm)\b/i, symbol: 'PAYTM', company: 'Paytm' },
  { regex: /\b(nvidia)\b/i, symbol: 'NVDA', company: 'Nvidia' },
  { regex: /\b(apple|iphone|ipad)\b/i, symbol: 'AAPL', company: 'Apple' },
  { regex: /\b(tesla)\b/i, symbol: 'TSLA', company: 'Tesla' },
  { regex: /\b(microsoft)\b/i, symbol: 'MSFT', company: 'Microsoft' },
  { regex: /\b(google|alphabet)\b/i, symbol: 'GOOGL', company: 'Alphabet Google' },
  { regex: /\b(amazon|aws)\b/i, symbol: 'AMZN', company: 'Amazon' },
  { regex: /\b(meta|facebook|instagram)\b/i, symbol: 'META', company: 'Meta' },
  { regex: /\b(netflix)\b/i, symbol: 'NFLX', company: 'Netflix' },
  { regex: /\b(nifty 50|nifty)\b/i, symbol: 'NIFTY', company: 'Nifty 50' },
  { regex: /\b(bank nifty|banknifty)\b/i, symbol: 'BANKNIFTY', company: 'Bank Nifty' },
  { regex: /\b(brent|crude oil|wti|petroleum)\b/i, symbol: 'CRUDEOIL', company: 'Crude Oil' },
  { regex: /\b(gold|bullion)\b/i, symbol: 'GOLD', company: 'Gold' },
  { regex: /\b(boeing)\b/i, symbol: 'BA', company: 'Boeing' },
  { regex: /\b(bank of america)\b/i, symbol: 'BAC', company: 'Bank of America' },
  { regex: /\b(jpmorgan|jp morgan)\b/i, symbol: 'JPM', company: 'JPMorgan Chase' },
  { regex: /\b(goldman sachs)\b/i, symbol: 'GS', company: 'Goldman Sachs' },
  { regex: /\b(suzlon)\b/i, symbol: 'SUZLON', company: 'Suzlon Energy' },
  { regex: /\b(swiggy)\b/i, symbol: 'SWIGGY', company: 'Swiggy' },
  { regex: /\b(trent)\b/i, symbol: 'TRENT', company: 'Trent' }
];

function formatTimeAgo(unixTimestamp) {
  if (!unixTimestamp) return 'Just now';
  const now = Math.floor(Date.now() / 1000);
  const diffSec = Math.max(0, now - unixTimestamp);
  
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function detectCategory(headline = '', summary = '') {
  const text = `${headline} ${summary}`.toLowerCase();
  if (text.includes('earning') || text.includes('q1') || text.includes('q2') || text.includes('q3') || text.includes('q4') || text.includes('revenue') || text.includes('profit') || text.includes('loss') || text.includes('quarter') || text.includes('sales') || text.includes('ebitda') || text.includes('pat')) {
    return 'Earnings';
  }
  if (text.includes('dividend') || text.includes('split') || text.includes('bonus') || text.includes('buyback') || text.includes('acquisition') || text.includes('merger') || text.includes('deal') || text.includes('stake') || text.includes('takeover') || text.includes('divestment')) {
    return 'Corporate Action';
  }
  if (text.includes('agm') || text.includes('board') || text.includes('director') || text.includes('sebi') || text.includes('sec') || text.includes('resignation') || text.includes('appointment') || text.includes('ceo') || text.includes('cfo') || text.includes('audit') || text.includes('investigation') || text.includes('probe')) {
    return 'Corporate Governance';
  }
  if (text.includes('ipo') || text.includes('listing') || text.includes('public offering') || text.includes('drhp') || text.includes('debut')) {
    return 'Ipo';
  }
  if (text.includes('fed') || text.includes('inflation') || text.includes('interest rate') || text.includes('gdp') || text.includes('crude') || text.includes('oil') || text.includes('brent') || text.includes('war') || text.includes('economy') || text.includes('central bank') || text.includes('ecb') || text.includes('rbi') || text.includes('tariffs') || text.includes('dollar') || text.includes('yield')) {
    return 'Global';
  }
  return 'Stock';
}

function extractTicker(headline = '', summary = '', related = '') {
  if (related && related.trim()) {
    const cleanRel = related.split(',')[0].replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (cleanRel) return cleanRel;
  }
  
  const fullText = `${headline} ${summary}`;
  // Check company aliases first
  for (const item of COMPANY_ALIASES) {
    if (item.regex.test(fullText)) {
      return item.symbol;
    }
  }

  // Check known tickers
  const upperText = fullText.toUpperCase();
  for (const t of KNOWN_TICKERS) {
    const regex = new RegExp(`\\b${t}\\b`, 'i');
    if (regex.test(upperText)) {
      return t;
    }
  }
  return 'MARKET';
}

export async function fetchLiveCorporateNews(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedNews && (now - lastFetchTime < CACHE_TTL_MS)) {
    return cachedNews;
  }

  try {
    const [genRes, mergerRes] = await Promise.all([
      fetch(`${BASE_URL}/news?category=general&token=${FINNHUB_API_KEY}`),
      fetch(`${BASE_URL}/news?category=merger&token=${FINNHUB_API_KEY}`).catch(() => ({ ok: false }))
    ]);

    let rawNews = [];
    if (genRes.ok) {
      const genData = await genRes.json();
      if (Array.isArray(genData)) rawNews = rawNews.concat(genData);
    }
    if (mergerRes.ok) {
      const mergerData = await mergerRes.json();
      if (Array.isArray(mergerData)) rawNews = rawNews.concat(mergerData);
    }

    if (rawNews.length === 0) {
      return cachedNews || [];
    }

    // Deduplicate by ID and sort by latest datetime
    const seenIds = new Set();
    const formatted = [];

    for (const item of rawNews) {
      if (!item.id || seenIds.has(item.id)) continue;
      seenIds.add(item.id);

      const symbol = extractTicker(item.headline, item.summary, item.related);
      const category = detectCategory(item.headline, item.summary);

      formatted.push({
        id: `finnhub-${item.id}`,
        symbol: symbol,
        company: item.source || 'Financial News',
        category: category,
        title: item.headline,
        time: formatTimeAgo(item.datetime),
        rawTime: item.datetime * 1000,
        summary: item.summary || item.headline,
        fullText: `${item.summary || ''}\n\nSource: ${item.source || 'Global Market Wire'}`,
        url: item.url,
        imageUrl: item.image,
        source: item.source,
        price: null, // Fetched dynamically or fallback
        change: null,
        isPositive: true,
        logo: `https://images.dhan.co/symbol/${symbol}.png`
      });
    }

    // Sort by timestamp desc
    formatted.sort((a, b) => b.rawTime - a.rawTime);

    cachedNews = formatted;
    lastFetchTime = now;
    return formatted;
  } catch (error) {
    console.warn('[newsService] Finnhub fetch error:', error);
    return cachedNews || [];
  }
}
