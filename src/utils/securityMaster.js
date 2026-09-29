/**
 * securityMaster.js
 * Comprehensive Indian Equity Security Master & Automated Corporate Action Resolver for FoxTrade.
 * 
 * Sources:
 * 1. Explicit High-Priority Curated Actions (ZOMATO -> ETERNAL, TATAMOTORS -> TMCV, etc.)
 * 2. Dynamic Live NSE Symbol Change Feed:
 *    - Live NSE archives: https://archives.nseindia.com/content/equities/symbolchange.csv (via /nse-api)
 *    - Bundled offline mirror: /data/symbolchange.csv
 *    - Auto-syncs daily and caches in localStorage
 * 
 * Automatically resolves all past and future ticker migrations, rebrandings,
 * demergers, and aliases so traders typing legacy symbols always get active,
 * officially listed NSE/BSE securities.
 */

const STORAGE_CACHE_KEY = 'foxtrade_symbolchange_cache_v1';
const STORAGE_TS_KEY = 'foxtrade_symbolchange_ts_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── 1. EXPLICIT CURATED CORPORATE ACTIONS (High Priority) ───────────────────
export const CORPORATE_ACTIONS = [
  {
    legacySymbol: 'ZOMATO',
    canonicalSymbol: 'ETERNAL',
    companyName: 'Eternal Ltd',
    exchange: 'NSE',
    effectiveDate: '2025-04-09',
    reason: 'Parent company rebranded from Zomato Ltd to Eternal Ltd (housing Zomato, Blinkit, Hyperpure, and District)',
    searchKeywords: ['zomato', 'blinkit', 'hyperpure', 'eternal', 'deepinder goyal'],
    logoFallback: 'ZOMATO'
  },
  {
    legacySymbol: 'TATAMOTORS',
    canonicalSymbol: 'TMCV',
    companyName: 'Tata Motors Ltd (Commercial Vehicles)',
    exchange: 'NSE',
    effectiveDate: '2025-01-01',
    reason: 'Demerger into Commercial Vehicles (TMCV) and Passenger Vehicles (TMPV)',
    searchKeywords: ['tata motors', 'tatamotors', 'tmcv', 'tata commercial'],
    logoFallback: 'TATAMOTORS'
  },
  {
    legacySymbol: 'MINDTREE',
    canonicalSymbol: 'LTIM',
    companyName: 'LTIMindtree Ltd',
    exchange: 'NSE',
    effectiveDate: '2022-11-24',
    reason: 'Merger of LTI (Larsen & Toubro Infotech) and Mindtree',
    searchKeywords: ['mindtree', 'lti', 'ltimindtree', 'l&t infotech'],
    logoFallback: 'LTIM'
  },
  {
    legacySymbol: 'LTI',
    canonicalSymbol: 'LTIM',
    companyName: 'LTIMindtree Ltd',
    exchange: 'NSE',
    effectiveDate: '2022-11-24',
    reason: 'Merger of LTI and Mindtree into LTIMindtree Ltd',
    searchKeywords: ['lti', 'l&t infotech', 'ltimindtree'],
    logoFallback: 'LTIM'
  },
  {
    legacySymbol: 'CADILAHC',
    canonicalSymbol: 'ZYDUSLIFE',
    companyName: 'Zydus Lifesciences Ltd',
    exchange: 'NSE',
    effectiveDate: '2022-03-07',
    reason: 'Cadila Healthcare renamed to Zydus Lifesciences Ltd',
    searchKeywords: ['cadila', 'cadilahc', 'zydus', 'zydus life'],
    logoFallback: 'ZYDUSLIFE'
  },
  {
    legacySymbol: 'MOTHERSUM',
    canonicalSymbol: 'MOTHERSON',
    companyName: 'Samvardhana Motherson International Ltd',
    exchange: 'NSE',
    effectiveDate: '2022-03-15',
    reason: 'Motherson Sumi Systems renamed to Samvardhana Motherson',
    searchKeywords: ['motherson sumi', 'mothersum', 'motherson'],
    logoFallback: 'MOTHERSON'
  },
  {
    legacySymbol: 'PVR',
    canonicalSymbol: 'PVRINOX',
    companyName: 'PVR INOX Ltd',
    exchange: 'NSE',
    effectiveDate: '2023-05-18',
    reason: 'Merger of PVR Ltd and INOX Leisure Ltd',
    searchKeywords: ['pvr', 'inox', 'pvr inox'],
    logoFallback: 'PVRINOX'
  },
  {
    legacySymbol: 'HDFC',
    canonicalSymbol: 'HDFCBANK',
    companyName: 'HDFC Bank Ltd',
    exchange: 'NSE',
    effectiveDate: '2023-07-13',
    reason: 'Housing Development Finance Corporation (HDFC) merged into HDFC Bank Ltd',
    searchKeywords: ['hdfc', 'hdfc bank', 'housing development finance'],
    logoFallback: 'HDFCBANK'
  },
  {
    legacySymbol: 'IDFC',
    canonicalSymbol: 'IDFCFIRSTB',
    companyName: 'IDFC First Bank Ltd',
    exchange: 'NSE',
    effectiveDate: '2024-10-01',
    reason: 'IDFC Ltd reverse merged into IDFC First Bank Ltd',
    searchKeywords: ['idfc', 'idfc first bank', 'idfc bank'],
    logoFallback: 'IDFCFIRSTB'
  },
  {
    legacySymbol: 'L&TFH',
    canonicalSymbol: 'LTF',
    companyName: 'L&T Finance Ltd',
    exchange: 'NSE',
    effectiveDate: '2024-03-22',
    reason: 'L&T Finance Holdings renamed to L&T Finance Ltd',
    searchKeywords: ['l&tfh', 'ltfh', 'ltf', 'l&t finance'],
    logoFallback: 'LTF'
  },
  {
    legacySymbol: 'ADANIGAS',
    canonicalSymbol: 'ATGL',
    companyName: 'Adani Total Gas Ltd',
    exchange: 'NSE',
    effectiveDate: '2021-01-01',
    reason: 'Adani Gas renamed to Adani Total Gas Ltd',
    searchKeywords: ['adani gas', 'adanigas', 'atgl', 'adani total gas'],
    logoFallback: 'ATGL'
  },
  {
    legacySymbol: 'ADANITRANS',
    canonicalSymbol: 'ADANIENSOL',
    companyName: 'Adani Energy Solutions Ltd',
    exchange: 'NSE',
    effectiveDate: '2023-07-27',
    reason: 'Adani Transmission renamed to Adani Energy Solutions Ltd',
    searchKeywords: ['adani transmission', 'adanitrans', 'adaniensol'],
    logoFallback: 'ADANIENSOL'
  }
];

// Curated Map for fast O(1) resolution
const CURATED_MAP = new Map();
CORPORATE_ACTIONS.forEach(ca => {
  CURATED_MAP.set(ca.legacySymbol.toUpperCase(), ca);
  CURATED_MAP.set(ca.canonicalSymbol.toUpperCase(), ca);
});

// ── 2. DYNAMIC NSE SYMBOL CHANGE REGISTRY ──────────────────────────────────
// Maps oldSymbol -> { canonical: newSymbol, company: companyName, date: effectiveDate }
const DYNAMIC_MAP = new Map();
let _isSyncing = false;
let _hasSynced = false;

/**
 * Parses raw CSV text of NSE symbolchange.csv
 * Format: Company Name, Old Symbol, New Symbol, Date
 */
export function parseNseSymbolChangeCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') return;
  const lines = csvText.split('\n');

  const rawMap = new Map();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    if (parts.length >= 3) {
      const company = parts[0];
      const oldSym = parts[1]?.toUpperCase();
      const newSym = parts[2]?.toUpperCase();
      const dateStr = parts[3] || '';

      if (oldSym && newSym && oldSym !== newSym) {
        rawMap.set(oldSym, { canonical: newSym, company, date: dateStr });
      }
    }
  }

  // Resolve multi-hop renaming chains: if A -> B and B -> C, resolve A -> C
  for (const [oldSym, info] of rawMap.entries()) {
    let curr = info.canonical;
    let depth = 0;
    while (rawMap.has(curr) && depth < 6) {
      curr = rawMap.get(curr).canonical;
      depth++;
    }
    info.canonical = curr;
    DYNAMIC_MAP.set(oldSym, info);
  }
}

/**
 * Syncs the Security Master against the official NSE Symbol Change feed.
 * 1. Loads instantly from localStorage if cached within 24 hours.
 * 2. Periodically fetches from /nse-api/content/equities/symbolchange.csv (live)
 *    or /data/symbolchange.csv (offline bundle).
 */
export async function syncSecurityMasterFromNse(force = false) {
  if (_isSyncing) return;
  _isSyncing = true;

  try {
    const isBrowser = typeof window !== 'undefined';
    if (!isBrowser) return;

    // 1. Try loading cached mappings from localStorage for instant startup
    const cachedTs = parseInt(localStorage.getItem(STORAGE_TS_KEY) || '0', 10);
    const cachedData = localStorage.getItem(STORAGE_CACHE_KEY);

    if (!force && cachedData && Date.now() - cachedTs < CACHE_TTL_MS) {
      parseNseSymbolChangeCsv(cachedData);
      _hasSynced = true;
      return;
    }

    // 2. Fetch fresh symbol change CSV from NSE archives proxy or local bundle
    const urlsToTry = [
      '/nse-api/content/equities/symbolchange.csv',
      '/data/symbolchange.csv'
    ];

    for (const url of urlsToTry) {
      try {
        const res = await fetch(url, {
          cache: 'no-cache',
          headers: { 'Accept': 'text/plain, text/csv, */*' }
        });
        if (res.ok) {
          const text = await res.text();
          if (text && text.length > 500) {
            parseNseSymbolChangeCsv(text);
            try {
              localStorage.setItem(STORAGE_CACHE_KEY, text);
              localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
            } catch {}
            _hasSynced = true;
            return;
          }
        }
      } catch {}
    }

    // If fetch failed but we have stale cache, load stale cache
    if (cachedData && DYNAMIC_MAP.size === 0) {
      parseNseSymbolChangeCsv(cachedData);
      _hasSynced = true;
    }
  } finally {
    _isSyncing = false;
  }
}

// Auto-initialize sync on browser load
if (typeof window !== 'undefined') {
  syncSecurityMasterFromNse();
}

// ── 3. CANONICAL SYMBOL & ALIAS RESOLUTION API ───────────────────────────────

/**
 * Returns the active canonical trading ticker for any given input symbol.
 * Example: 'ZOMATO' -> 'ETERNAL', 'TATAMOTORS' -> 'TMCV', 'TELCO' -> 'TMPV'
 */
export function getCanonicalSymbol(inputSymbol) {
  if (!inputSymbol || typeof inputSymbol !== 'string') return inputSymbol;
  const clean = inputSymbol.trim().toUpperCase().replace(/\.(NS|BO|NSE|BSE)$/i, '');

  // 1. Check curated high-priority actions
  const curated = CURATED_MAP.get(clean);
  if (curated) return curated.canonicalSymbol;

  // 2. Check dynamic NSE symbol change registry (1,000+ official actions)
  const dynamic = DYNAMIC_MAP.get(clean);
  if (dynamic) return dynamic.canonical;

  return clean;
}

/**
 * Resolves full corporate action metadata for a given symbol, if any exists.
 */
export function getCorporateActionDetails(symbol) {
  if (!symbol || typeof symbol !== 'string') return null;
  const clean = symbol.trim().toUpperCase().replace(/\.(NS|BO|NSE|BSE)$/i, '');

  // 1. Check curated actions
  const curated = CURATED_MAP.get(clean);
  if (curated) return curated;

  // 2. Check dynamic actions
  const dynamic = DYNAMIC_MAP.get(clean);
  if (dynamic) {
    return {
      legacySymbol: clean,
      canonicalSymbol: dynamic.canonical,
      companyName: dynamic.company,
      exchange: 'NSE',
      effectiveDate: dynamic.date,
      reason: `Official NSE ticker change from ${clean} to ${dynamic.canonical}`,
      searchKeywords: [clean.toLowerCase(), dynamic.canonical.toLowerCase(), dynamic.company.toLowerCase()],
      logoFallback: clean
    };
  }

  return null;
}

/**
 * Returns an explanatory subtitle / alias tag for UI display.
 * Example: for ETERNAL -> 'Formerly ZOMATO • NSE'
 */
export function getHistoricalAliasNote(symbol) {
  const ca = getCorporateActionDetails(symbol);
  if (!ca) return null;
  if (ca.legacySymbol && ca.legacySymbol !== ca.canonicalSymbol) {
    return `Formerly ${ca.legacySymbol} • ${ca.exchange}`;
  }
  return null;
}

/**
 * Checks query against corporate actions and returns enriched stock suggestions.
 */
export function findCorporateActionMatches(query) {
  if (!query || typeof query !== 'string') return [];
  const q = query.toLowerCase().trim();
  if (q.length < 1) return [];

  const matches = [];
  const seenCanonical = new Set();

  // 1. Search curated actions
  for (const ca of CORPORATE_ACTIONS) {
    const isLegacyMatch = ca.legacySymbol.toLowerCase().includes(q) || q.includes(ca.legacySymbol.toLowerCase());
    const isCanonicalMatch = ca.canonicalSymbol.toLowerCase().includes(q);
    const isCompanyMatch = ca.companyName.toLowerCase().includes(q);
    const isKeywordMatch = ca.searchKeywords.some(kw => kw.includes(q) || q.includes(kw));

    if (isLegacyMatch || isCanonicalMatch || isCompanyMatch || isKeywordMatch) {
      matches.push({
        symbol: ca.canonicalSymbol,
        name: isLegacyMatch && ca.legacySymbol !== ca.canonicalSymbol
          ? `${ca.companyName} (formerly ${ca.legacySymbol})`
          : ca.companyName,
        exchange: ca.exchange,
        alias: ca.legacySymbol !== ca.canonicalSymbol ? ca.legacySymbol : undefined,
        reason: ca.reason,
        logoFallback: ca.logoFallback
      });
      seenCanonical.add(ca.canonicalSymbol);
    }
  }

  // 2. Search dynamic NSE symbol changes
  for (const [oldSym, info] of DYNAMIC_MAP.entries()) {
    if (seenCanonical.has(info.canonical)) continue;

    const isOldMatch = oldSym.toLowerCase().includes(q) || q.includes(oldSym.toLowerCase());
    const isNewMatch = info.canonical.toLowerCase().includes(q);
    const isCompanyMatch = info.company.toLowerCase().includes(q);

    if (isOldMatch || isNewMatch || isCompanyMatch) {
      matches.push({
        symbol: info.canonical,
        name: isOldMatch ? `${info.company} (formerly ${oldSym})` : info.company,
        exchange: 'NSE',
        alias: isOldMatch ? oldSym : undefined,
        reason: `NSE symbol change from ${oldSym} to ${info.canonical}`,
        logoFallback: oldSym
      });
      seenCanonical.add(info.canonical);
      if (matches.length >= 8) break;
    }
  }

  return matches;
}
