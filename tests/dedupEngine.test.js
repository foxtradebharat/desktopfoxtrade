/**
 * dedupEngine.test.js
 * Verification suite for FoxTrade Trade Deduplication Engine
 */

import {
  normalizeDateToCanonical,
  normalizeSymbol,
  buildTradeSignatureKey,
  deduplicateAndMergeTrades
} from '../src/utils/tradeDeduplicationEngine.js';

let passed = 0;
let total = 0;

function assert(cond, msg) {
  total++;
  if (cond) {
    passed++;
    console.log(`[PASS] Test ${total}: ${msg}`);
  } else {
    console.error(`[FAIL] Test ${total}: ${msg}`);
    process.exitCode = 1;
  }
}

console.log('='.repeat(80));
console.log('   FOXTRADE TRADE DEDUPLICATION ENGINE — DEEP VERIFICATION');
console.log('='.repeat(80));

// Test 1: Date Normalization to Canonical YYYY-MM-DD
const d1 = normalizeDateToCanonical('15/09/2026');
const d2 = normalizeDateToCanonical('15-09-2026');
const d3 = normalizeDateToCanonical('2026-09-15');
const d4 = normalizeDateToCanonical('2026/09/15');
assert(d1 === '2026-09-15' && d2 === '2026-09-15' && d3 === '2026-09-15' && d4 === '2026-09-15',
  'Date normalization converts ISO, DD/MM/YYYY, DD-MM-YYYY to canonical YYYY-MM-DD');

// Test 2: Symbol Normalization (.NS, .BO, -EQ stripping)
const s1 = normalizeSymbol('RELIANCE.NS');
const s2 = normalizeSymbol('RELIANCE-EQ');
const s3 = normalizeSymbol('RELIANCE');
assert(s1 === 'RELIANCE' && s2 === 'RELIANCE' && s3 === 'RELIANCE',
  'Symbol normalization strips .NS, -EQ, and exchange suffixes to match base ticker');

// Test 3: Signature Key Invariance across different broker date & symbol formats
const tradeA = { name: 'RELIANCE', date: '2026-09-15', entry: 2980.5, qty: 50, type: 'Buy' };
const tradeB = { symbol: 'RELIANCE.NS', date: '15/09/2026', price: 2980.50, quantity: 50, side: 'BUY' };
const sigA = buildTradeSignatureKey(tradeA);
const sigB = buildTradeSignatureKey(tradeB);
assert(sigA === sigB && sigA === 'sig:RELIANCE|2026-09-15|BUY|2980.50|50',
  'Content signature matches across different field names (name vs symbol, entry vs price, date vs DD/MM)');

// Test 4: Re-importing exact identical CSV results in 0 new trades & 100% skipped duplicates
const existingJournal = [
  { id: 't1', tradeNo: 1, portfolioId: 'default', symbol: 'TCS', date: '2026-09-10', entry: 4200, qty: 25, status: 'Open' },
  { id: 't2', tradeNo: 2, portfolioId: 'default', symbol: 'INFY', date: '2026-09-12', entry: 1850, qty: 100, status: 'Open' }
];
const duplicateImport = [
  { name: 'TCS', date: '10/09/2026', entry: 4200, qty: 25, type: 'Buy' },
  { name: 'INFY', date: '2026-09-12', entry: 1850, qty: 100, type: 'Buy' }
];
const res1 = deduplicateAndMergeTrades(existingJournal, duplicateImport, { activePortfolioId: 'default' });
assert(res1.newTradesCount === 0 && res1.skippedDuplicatesCount === 2 && res1.combinedTrades.length === 2,
  'Re-importing existing trades correctly flags 2 duplicates and adds 0 rows');

// Test 5: Open position receives Exit leg from broker tradebook -> Merged without duplicating
const openTrade = [
  { id: 't3', tradeNo: 1, portfolioId: 'default', symbol: 'HDFCBANK', date: '2026-09-01', entry: 1650, qty: 100, status: 'Open' }
];
const exitFill = [
  { name: 'HDFCBANK', date: '2026-09-01', entry: 1650, qty: 100, avgExitPrice: 1720, exitedQty: 100, status: 'Closed', pnl: 7000 }
];
const res2 = deduplicateAndMergeTrades(openTrade, exitFill, { activePortfolioId: 'default' });
assert(res2.newTradesCount === 0 && res2.updatedTradesCount === 1 && res2.combinedTrades.length === 1 && res2.combinedTrades[0].status === 'Closed' && res2.combinedTrades[0].pnl === 7000,
  'Incoming exit fill updates open position to Closed with PnL without creating a second row');

// Test 6: Open position receives Pyramid (P1) leg -> Merged without duplicating
const openBase = [
  { id: 't4', tradeNo: 1, portfolioId: 'default', symbol: 'BAJFINANCE', date: '2026-09-05', entry: 7100, qty: 20, status: 'Open' }
];
const pyramidFill = [
  { name: 'BAJFINANCE', date: '2026-09-05', entry: 7100, qty: 20, p1Price: 7250, p1Qty: 10, p1Date: '2026-09-08' }
];
const res3 = deduplicateAndMergeTrades(openBase, pyramidFill, { activePortfolioId: 'default' });
assert(res3.newTradesCount === 0 && res3.updatedTradesCount === 1 && res3.combinedTrades[0].p1Price === 7250,
  'Incoming pyramid leg (P1) correctly attaches to open base position without creating duplicate row');

// Test 7: In-batch duplicate suppression (Same trade repeated in single imported CSV)
const rawBatch = [
  { name: 'SBIN', date: '2026-09-14', entry: 810, qty: 150, type: 'Buy' },
  { name: 'SBIN', date: '2026-09-14', entry: 810, qty: 150, type: 'Buy' }, // exact duplicate in same batch
  { name: 'WIPRO', date: '2026-09-14', entry: 540, qty: 200, type: 'Buy' }
];
const res4 = deduplicateAndMergeTrades([], rawBatch, { activePortfolioId: 'default' });
assert(res4.newTradesCount === 2 && res4.skippedDuplicatesCount === 1 && res4.combinedTrades.length === 2,
  'In-batch duplicate within the same CSV is dropped; only 2 distinct trades added');

// Test 8: Multi-portfolio isolation (Trade in Portfolio A does not suppress trade in Portfolio B)
const multiPf = [
  { id: 't_a', tradeNo: 1, portfolioId: 'swing', symbol: 'TITAN', date: '2026-09-15', entry: 3500, qty: 30 }
];
const incomingB = [
  { name: 'TITAN', date: '2026-09-15', entry: 3500, qty: 30, type: 'Buy' }
];
const res5 = deduplicateAndMergeTrades(multiPf, incomingB, { activePortfolioId: 'fno' });
assert(res5.newTradesCount === 1 && res5.combinedTrades.length === 2,
  'Multi-portfolio isolation: Trade with same parameters is permitted in a separate portfolio');

console.log('-'.repeat(80));
console.log(`RESULTS: ${passed} PASSED | ${total - passed} FAILED | TOTAL: ${total}`);
console.log('='.repeat(80));
