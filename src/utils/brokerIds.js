/**
 * brokerIds.js
 * Broker alias mapping and canonical broker ID normalization.
 * Pure JS, free of assets/images for use in both frontend and Node.
 */

export const BROKER_ALIASES = {
  angel: 'angelone',
  angelone: 'angelone',
  'angel one': 'angelone',
  'angel broking': 'angelone',
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
  'zerodha kite': 'zerodha',
  zerodhakite: 'zerodha',
  kotak: 'kotak',
  kotakneo: 'kotak',
  'kotak neo': 'kotak',
  'kotak securities': 'kotak',
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
 * Returns a canonical id, 'not_defined', or null when the string is not recognised.
 */
export function normalizeBrokerId(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return 'not_defined';
  const s = String(raw).trim().toLowerCase();
  if (s === 'not_defined') return 'not_defined';
  if (BROKER_ALIASES[s]) return BROKER_ALIASES[s];
  const compact = s.replace(/[^a-z0-9]/g, '');
  if (BROKER_ALIASES[compact]) return BROKER_ALIASES[compact];
  for (const tok of s.split(/[^a-z0-9]+/).filter(Boolean)) {
    if (BROKER_ALIASES[tok]) return BROKER_ALIASES[tok];
  }
  return null;
}
