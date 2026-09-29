/**
 * brokerLogos.js
 * 
 * Official broker logos extracted directly from Nexus Journal (nexusjournal.co.in).
 * Matches Nexus's broker registry and logo mappings 1:1.
 */

export const BROKER_LOGOS = {
  zerodha: 'https://kite.zerodha.com/static/images/kite-logo.svg',
  dhan: 'https://dhan.co/_next/static/media/dhanns.91594e14.svg',
  upstox: 'https://assets.upstox.com/website/images/upstox-new-logo.svg',
  groww: 'https://groww.in/favicon.ico',
  angelone: 'https://angelone.in/favicon.ico',
  fyers: 'https://fyers.in/_next/static/media/fyers-logo.ea21448c.svg',
  mstock: 'https://cdn.mirae-asset.co.in/mstock-assets/v1/assets/images/mstock-logo.svg',
  kotak: 'https://www.kotakneo.com/assets/Kotak_Neo_Website_dark_mode.svg',
  motilal: 'https://www.motilaloswal.com/media_15c0fcdc4deef99d8a791fee00d99b2066c8eb40a.svg',
  icici: 'https://encrypted-tbn2.gstatic.com/faviconV2?url=https://secure.icicidirect.com&client=VFE&size=64&type=FAVICON&fallback_opts=TYPE,SIZE,URL&nfrp=2',
  sharekhan: 'https://www.sharekhan.com/MediaGalary/image/Press-Release-Blog-Post_H-202411291304334580910.png',
  ibkr: 'https://www.interactivebrokers.com/images/common/logos/ibkr/interactive-brokers.svg',
  prostocks: 'https://www.nexusjournal.co.in/prostocks-logo.svg',
};

// Nexus-compatible alias lookup
const BROKER_ALIASES = {
  angel: 'angelone',
  angelone: 'angelone',
  'angel one': 'angelone',
  dhan: 'dhan',
  fyers: 'fyers',
  groww: 'groww',
  ibkr: 'ibkr',
  interactivebrokers: 'ibkr',
  'interactive brokers': 'ibkr',
  mstock: 'mstock',
  upstox: 'upstox',
  zerodha: 'zerodha',
  kite: 'zerodha',
  kotak: 'kotak',
  kotakneo: 'kotak',
  'kotak neo': 'kotak',
  motilal: 'motilal',
  motilaloswal: 'motilal',
  'motilal oswal': 'motilal',
  icici: 'icici',
  icicidirect: 'icici',
  'icici direct': 'icici',
  sharekhan: 'sharekhan',
  prostocks: 'prostocks',
};

/**
 * Normalizes broker name/key and returns official logo URL or null.
 */
export function getBrokerLogo(brokerKey) {
  if (!brokerKey) return null;
  const raw = String(brokerKey).toLowerCase().replace(/[\s_-]+/g, '');
  const mappedKey = BROKER_ALIASES[raw] || raw;
  return BROKER_LOGOS[mappedKey] || null;
}

/**
 * Clean display name for broker
 */
export function getBrokerDisplayName(brokerKey) {
  if (!brokerKey || brokerKey === 'not_defined') return 'Not Defined';
  const raw = String(brokerKey).toLowerCase().replace(/[\s_-]+/g, '');
  const key = BROKER_ALIASES[raw] || raw;
  switch (key) {
    case 'zerodha': return 'Zerodha';
    case 'groww': return 'Groww';
    case 'dhan': return 'Dhan';
    case 'upstox': return 'Upstox';
    case 'angelone': return 'AngelOne';
    case 'fyers': return 'Fyers';
    case 'mstock': return 'mStock';
    case 'kotak': return 'Kotak Neo';
    case 'motilal': return 'Motilal Oswal';
    case 'icici': return 'ICICI Direct';
    case 'sharekhan': return 'Sharekhan';
    case 'ibkr': return 'Interactive Brokers';
    case 'prostocks': return 'ProStocks';
    default: return brokerKey;
  }
}

/**
 * Primary broker list for dropdowns and filters
 */
export const BROKER_DEFINITIONS = [
  { id: 'not_defined', label: 'Not Defined', initials: '—',   color: '#9ca3af', bg: '#f3f4f6', logo: null },
  { id: 'zerodha',     label: 'Zerodha',     initials: 'ZRD', color: '#387ed1', bg: '#e8f0fb', logo: BROKER_LOGOS.zerodha },
  { id: 'groww',       label: 'Groww',       initials: 'GRW', color: '#00b386', bg: '#e0f7f1', logo: BROKER_LOGOS.groww },
  { id: 'dhan',        label: 'Dhan',        initials: 'DHN', color: '#7c3aed', bg: '#ede9fe', logo: BROKER_LOGOS.dhan },
  { id: 'upstox',      label: 'Upstox',      initials: 'UPX', color: '#f97316', bg: '#fff3e8', logo: BROKER_LOGOS.upstox },
  { id: 'angelone',    label: 'AngelOne',    initials: 'ANG', color: '#ef4444', bg: '#fce8e8', logo: BROKER_LOGOS.angelone },
  { id: 'fyers',       label: 'Fyers',       initials: 'FYR', color: '#0ea5e9', bg: '#e0f2fe', logo: BROKER_LOGOS.fyers },
  { id: 'mstock',      label: 'mStock',      initials: 'MST', color: '#1e3a8a', bg: '#e0e7ff', logo: BROKER_LOGOS.mstock },
  { id: 'kotak',       label: 'Kotak',       initials: 'KTK', color: '#dc2626', bg: '#fee2e2', logo: BROKER_LOGOS.kotak },
];
