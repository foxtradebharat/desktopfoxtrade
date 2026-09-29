/**
 * FoxTrade Stock Classification & Sector Peer Discovery Service
 * Powered by foxtrade_market_taxonomy.json with 3,380+ Indian Equities.
 * Provides multi-layer taxonomy: Niche Themes, Industries, Sectors, and Peer Companies.
 */

import foxtradeTaxonomy from '../data/foxtrade_market_taxonomy.json';

// FoxTrade Color Palette for visual DNA categories
export const FOXTRADE_DNA_PALETTE = [
  '#6366f1', // Indigo (Pharma)
  '#f43f5e', // Rose / Red (Pharma - Formulators)
  '#10b981', // Emerald / Green (Energy Conglomerate)
  '#3b82f6', // Blue
  '#f59e0b', // Amber / Orange
  '#8b5cf6', // Violet / Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#84cc16', // Lime
  '#e11d48', // Crimson
  '#eab308', // Yellow
  '#64748b', // Slate
];

// In-memory indexing maps for instant O(1) lookups
const SYMBOL_TAXONOMY_INDEX = new Map();
const NAME_TAXONOMY_INDEX = new Map();
const THEME_PEERS_INDEX = new Map();
const INDUSTRY_PEERS_INDEX = new Map();
const SECTOR_PEERS_INDEX = new Map();

// Initialize index from foxtrade_market_taxonomy.json
if (foxtradeTaxonomy && Array.isArray(foxtradeTaxonomy.stocks)) {
  foxtradeTaxonomy.stocks.forEach((item, idx) => {
    const cleanSym = (item.symbol || '').toUpperCase().trim();
    const companyName = item.name || cleanSym;
    const theme = item.theme || item.subIndustry || `${cleanSym} Theme`;
    const industry = item.industry || `${cleanSym} Industry`;
    const sector = item.sector || 'General Market';

    const entry = {
      symbol: cleanSym,
      name: companyName,
      niche: theme,
      industry: industry,
      sector: sector,
      subIndustry: item.subIndustry,
      marketCap: item.marketCap,
      revenue: item.revenue,
      color: FOXTRADE_DNA_PALETTE[idx % FOXTRADE_DNA_PALETTE.length],
      emergingThemes: [theme, industry],
      nicheThemes: [theme]
    };

    if (cleanSym) {
      SYMBOL_TAXONOMY_INDEX.set(cleanSym, entry);
      // Also index BSE code if present so lookups by numeric code work
      if (item.bseCode) {
        SYMBOL_TAXONOMY_INDEX.set(item.bseCode, entry);
      }
    }

    if (companyName) {
      NAME_TAXONOMY_INDEX.set(companyName.toLowerCase().trim(), entry);
    }

    // Index peers by theme (Niche)
    const mcapNum = typeof item.marketCap === 'number' ? item.marketCap : (parseFloat(item.marketCap) || 0);
    const peerItem = { 
      symbol: cleanSym, 
      bseCode: item.bseCode,
      name: companyName, 
      industry, 
      sector, 
      theme,
      marketCap: mcapNum
    };

    if (theme) {
      const themeKey = theme.toLowerCase().trim();
      if (!THEME_PEERS_INDEX.has(themeKey)) THEME_PEERS_INDEX.set(themeKey, []);
      THEME_PEERS_INDEX.get(themeKey).push(peerItem);
    }

    // Index peers by industry
    if (industry) {
      const indKey = industry.toLowerCase().trim();
      if (!INDUSTRY_PEERS_INDEX.has(indKey)) INDUSTRY_PEERS_INDEX.set(indKey, []);
      INDUSTRY_PEERS_INDEX.get(indKey).push(peerItem);
    }

    // Index peers by sector
    if (sector) {
      const secKey = sector.toLowerCase().trim();
      if (!SECTOR_PEERS_INDEX.has(secKey)) SECTOR_PEERS_INDEX.set(secKey, []);
      SECTOR_PEERS_INDEX.get(secKey).push(peerItem);
    }
  });
}

/**
 * Clean & normalize a stock ticker symbol
 */
export function normalizeSymbol(raw) {
  return (raw || '')
    .toUpperCase()
    .trim()
    .replace(/\.(NS|BO|NSE|BSE)$/i, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Retrieve multi-layer taxonomy for any stock symbol or company name
 */
export function getStockClassification(rawSymbol, rawCompanyName = '') {
  const cleanSym = normalizeSymbol(rawSymbol);

  // 1. Direct symbol match in 3,380 taxonomy dataset
  if (SYMBOL_TAXONOMY_INDEX.has(cleanSym)) {
    return SYMBOL_TAXONOMY_INDEX.get(cleanSym);
  }

  // 2. Lookup by company name
  if (rawCompanyName) {
    const cleanName = rawCompanyName.toLowerCase().trim();
    if (NAME_TAXONOMY_INDEX.has(cleanName)) {
      return NAME_TAXONOMY_INDEX.get(cleanName);
    }
  }

  // 3. Fallback partial matching
  for (const [sym, entry] of SYMBOL_TAXONOMY_INDEX.entries()) {
    if (cleanSym && sym.includes(cleanSym)) {
      return entry;
    }
  }

  // 4. Clean fallback for unknown stocks
  const hash = cleanSym.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = FOXTRADE_DNA_PALETTE[Math.abs(hash) % FOXTRADE_DNA_PALETTE.length];

  return {
    symbol: cleanSym || 'UNKNOWN',
    name: rawCompanyName || cleanSym || 'Unknown Stock',
    niche: `${cleanSym || 'Market'} Theme`,
    industry: `${cleanSym || 'Market'} Industry`,
    sector: 'General Market',
    color,
    emergingThemes: [`${cleanSym} Strategic Focus`],
    nicheThemes: [`${cleanSym} Core Business`]
  };
}

/**
 * Retrieve peers by category type: 'NICHE' (Theme), 'INDUSTRY', or 'SECTOR'
 */
export function getPeersByTaxonomy(type, key) {
  if (!key) return [];
  const normalizedKey = key.toLowerCase().trim();
  let list = [];

  if (type === 'NICHE' || type === 'THEME') {
    list = THEME_PEERS_INDEX.get(normalizedKey) || [];
  } else if (type === 'INDUSTRY') {
    list = INDUSTRY_PEERS_INDEX.get(normalizedKey) || [];
  } else if (type === 'SECTOR') {
    list = SECTOR_PEERS_INDEX.get(normalizedKey) || [];
  }

  // Deduplicate by symbol
  const seen = new Set();
  const deduped = [];
  for (const item of list) {
    if (!seen.has(item.symbol)) {
      seen.add(item.symbol);
      deduped.push(item);
    }
  }

  // Sort peers:
  // 1. Prioritize large-cap/mid-cap industry leaders (Market Cap descending)
  // 2. Fallback to alphabetical symbol
  return deduped.sort((a, b) => {
    const mcapA = a.marketCap || 0;
    const mcapB = b.marketCap || 0;
    if (mcapB !== mcapA) return mcapB - mcapA;
    return a.symbol.localeCompare(b.symbol);
  });
}

/**
 * Legacy support for getSectorPeers
 */
export function getSectorPeers(sectorName) {
  if (!sectorName) return [];
  const normalized = sectorName.toLowerCase().trim();
  const peers = SECTOR_PEERS_INDEX.get(normalized);
  if (peers && peers.length > 0) return peers;

  // Fallback to searching sector keys partially
  for (const [secKey, list] of SECTOR_PEERS_INDEX.entries()) {
    if (secKey.includes(normalized) || normalized.includes(secKey)) {
      return list;
    }
  }

  return [];
}

// Fallback legacy SECTOR_DATABASE export for backward compatibility
export const SECTOR_DATABASE = {};
