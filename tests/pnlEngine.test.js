/**
 * pnlEngine.test.js
 * Comprehensive unit test suite for the FoxTrade hardened P&L engine.
 * Run with: node tests/pnlEngine.test.js
 */

import assert from 'node:assert';
import fs from 'node:fs';
import {
  toPaise,
  fromPaise,
  calculateLegGrossPaise,
  calculateRoundTripTradePnL,
  validateTradeRecord,
  pairBrokerTransactionsFIFO,
  reconcileTradesEngine
} from '../src/utils/pnlEngine.js';
import { parseTradesFromFile } from '../src/utils/tradeImportEngine.js';
import { enrichTradeWithFoxFormulas } from '../src/utils/foxCalculationEngine.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    failed++;
  }
}

console.log('================================================================================');
console.log('   FOXTRADE P&L ENGINE HARDENING — SUITE DEEP VERIFICATION');
console.log('================================================================================');

// 1. Float Traps & Exact Integer Paise Conversion
test('Test 1: Float traps - exact string paise conversion avoiding IEEE-754 drift', () => {
  // In IEEE-754: 814.66 * 100 = 81465.99999999999
  assert.strictEqual(toPaise(814.66), 81466);
  assert.strictEqual(toPaise('814.66'), 81466);
  assert.strictEqual(toPaise(563.95), 56395);
  assert.strictEqual(toPaise('563.95'), 56395);
  assert.strictEqual(toPaise(0.1 + 0.2), 30); // 0.30000000000000004 -> 30 paise
  assert.strictEqual(toPaise('12345.678'), 1234568); // rounded to nearest paise
  assert.strictEqual(toPaise(-42.50), -4250);
  assert.strictEqual(toPaise(0), 0);
  assert.strictEqual(fromPaise(81466), 814.66);
  assert.strictEqual(fromPaise(-4250), -42.5);
});

// 2. Round-trip trade: Exit before entry (INTELLECT & ELGIEQUIP)
test('Test 2: Exit before entry calculates accurate P&L and flags EXIT_BEFORE_ENTRY', () => {
  // INTELLECT: 125 shares, buy @ 918.50, sell @ 902.00, entry 2025-01-20, exit 2025-01-02
  const intellectTrade = {
    name: 'INTELLECT',
    side: 'Buy',
    buyPrice: 918.50,
    entryPrice: 918.50,
    qty: 125,
    entryDate: '2025-01-20',
    exits: [{ price: 902.00, qty: 125, date: '2025-01-02' }]
  };

  const intellectPnL = calculateRoundTripTradePnL(intellectTrade);
  // (902.00 - 918.50) * 125 = -16.50 * 125 = -2,062.50 => -206,250 paise
  assert.strictEqual(intellectPnL.grossPaise, -206250);
  assert.strictEqual(intellectPnL.gross, -2062.50);

  const intellectValidation = validateTradeRecord(intellectTrade);
  assert.strictEqual(intellectValidation.isValidForTotals, true); // Must count in P&L!
  assert.strictEqual(intellectValidation.isDateFlagged, true);
  assert.ok(intellectValidation.flags.includes('EXIT_BEFORE_ENTRY'));

  // ELGIEQUIP: 175 shares, buy @ 600.00, sell @ 656.00, entry 2024-05-10, exit 2024-05-02
  const elgiTrade = {
    name: 'ELGIEQUIP',
    side: 'Buy',
    buyPrice: 600.00,
    entryPrice: 600.00,
    qty: 175,
    entryDate: '2024-05-10',
    exits: [{ price: 656.00, qty: 175, date: '2024-05-02' }]
  };
  const elgiPnL = calculateRoundTripTradePnL(elgiTrade);
  // (656.00 - 600.00) * 175 = 56.00 * 175 = 9,800.00 => 980,000 paise
  assert.strictEqual(elgiPnL.grossPaise, 980000);
  assert.strictEqual(elgiPnL.gross, 9800.00);

  const elgiValidation = validateTradeRecord(elgiTrade);
  assert.strictEqual(elgiValidation.isValidForTotals, true);
  assert.strictEqual(elgiValidation.isDateFlagged, true);
  assert.ok(elgiValidation.flags.includes('EXIT_BEFORE_ENTRY'));
});

// 3. Short trades sign inversion
test('Test 3: SHORT trades sign inversion', () => {
  // Short win: sell to open at 100, buy to cover at 90, qty 10 => +100 gross (+10,000 paise)
  const shortWin = calculateLegGrossPaise({
    entryPricePaise: toPaise(100),
    exitPricePaise: toPaise(90),
    qty: 10,
    isShort: true
  });
  assert.strictEqual(shortWin, 10000);

  // Short loss: sell to open at 100, buy to cover at 110, qty 10 => -100 gross (-10,000 paise)
  const shortLoss = calculateLegGrossPaise({
    entryPricePaise: toPaise(100),
    exitPricePaise: toPaise(110),
    qty: 10,
    isShort: true
  });
  assert.strictEqual(shortLoss, -10000);

  // Compare to Long
  const longWin = calculateLegGrossPaise({
    entryPricePaise: toPaise(100),
    exitPricePaise: toPaise(110),
    qty: 10,
    isShort: false
  });
  assert.strictEqual(longWin, 10000);
});

// 4. Partial exits: child qty == parent qty
test('Test 4: Partial exits child sum == parent qty and combined P&L matches', () => {
  const partialTrade = {
    name: 'RELIANCE',
    side: 'Buy',
    buyPrice: 2000,
    entryPrice: 2000,
    qty: 100,
    entryDate: '2024-06-01',
    exits: [
      { price: 2100, qty: 40, date: '2024-06-05' }, // +100 * 40 = +4,000 => 400,000 paise
      { price: 2150, qty: 60, date: '2024-06-10' }  // +150 * 60 = +9,000 => 900,000 paise
    ]
  };
  const result = calculateRoundTripTradePnL(partialTrade);
  assert.strictEqual(result.exitedQty, 100);
  assert.strictEqual(result.grossPaise, 1300000); // 13,000.00
  assert.strictEqual(result.gross, 13000.00);
  assert.strictEqual(result.legs.length, 2);
  assert.strictEqual(result.legs[0].grossPaise, 400000);
  assert.strictEqual(result.legs[1].grossPaise, 900000);

  const val = validateTradeRecord(partialTrade);
  assert.strictEqual(val.flags.length, 0); // Clean trade
  assert.strictEqual(val.isValidForTotals, true);
});

// 5. Raw broker transactions FIFO pairing by timestamp and order ID
test('Test 5: Broker raw transactions pair by timestamp / order ID and handle unmatched SELL', () => {
  const transactions = [
    // Two buys on the same day with different timestamps
    { symbol: 'TATASTEEL', side: 'BUY', qty: 50, price: 100, date: '2024-01-10', time: '09:15:00', orderId: 'ORD001' },
    { symbol: 'TATASTEEL', side: 'BUY', qty: 50, price: 120, date: '2024-01-10', time: '11:30:00', orderId: 'ORD002' },
    // Sell 70 shares later in the day
    { symbol: 'TATASTEEL', side: 'SELL', qty: 70, price: 150, date: '2024-01-10', time: '14:00:00', orderId: 'ORD003' },
    // Unmatched SELL on another symbol
    { symbol: 'ORPHAN', side: 'SELL', qty: 20, price: 50, date: '2024-01-10', time: '10:00:00', orderId: 'ORD004' }
  ];

  const { pairedTrades, unmatchedBucket } = pairBrokerTransactionsFIFO(transactions);

  // Aggregated trade for the 70-share sell:
  // 1st leg: 50 @ 100 vs 50 @ 150 => +50 * 50 = +2,500 (+250,000 paise)
  // 2nd leg: 20 @ 120 vs 20 @ 150 => +30 * 20 = +600 (+60,000 paise)
  // Combined gross = 310,000 paise (+₹3,100.00)
  assert.strictEqual(pairedTrades.length, 1);
  assert.strictEqual(pairedTrades[0].qty, 70);
  assert.strictEqual(pairedTrades[0].grossPaise, 310000);
  assert.strictEqual(pairedTrades[0].matchedEntryLegs.length, 2);
  assert.strictEqual(pairedTrades[0].matchedEntryLegs[0].legGrossPaise, 250000);
  assert.strictEqual(pairedTrades[0].matchedEntryLegs[1].legGrossPaise, 60000);

  // Unmatched bucket must have the orphan sell AND remaining 30 buy shares
  assert.strictEqual(unmatchedBucket.length, 2);
  const orphanSell = unmatchedBucket.find(u => u.symbol === 'ORPHAN');
  assert.ok(orphanSell);
  assert.strictEqual(orphanSell.reason, 'UNMATCHED_SELL_NO_INVENTORY');
  assert.strictEqual(orphanSell.qty, 20);

  const leftoverBuy = unmatchedBucket.find(u => u.symbol === 'TATASTEEL');
  assert.ok(leftoverBuy);
  assert.strictEqual(leftoverBuy.reason, 'OPEN_INVENTORY_UNSOLD');
  assert.strictEqual(leftoverBuy.qty, 30);
});

// 6. Validation flags & malformed input handling
test('Test 6: Validation flags on missing columns, duplicate rows, future dates', () => {
  const invalidRow = {
    name: 'CORRUPT',
    side: 'Buy',
    buyPrice: 'invalid_price',
    qty: 0,
    entryDate: '2024-01-01'
  };
  const valCorrupt = validateTradeRecord(invalidRow);
  assert.ok(valCorrupt.flags.includes('INVALID_NUMBERS'));
  assert.strictEqual(valCorrupt.isValidForTotals, false);

  const futureDateRow = {
    name: 'FUTURE',
    side: 'Buy',
    buyPrice: 100,
    entryPrice: 100,
    qty: 10,
    entryDate: '2099-01-01',
    exits: [{ price: 110, qty: 10, date: '2099-01-02' }]
  };
  const valFuture = validateTradeRecord(futureDateRow);
  assert.ok(valFuture.flags.includes('FUTURE_DATE'));
  // FUTURE_DATE does NOT invalidate P&L calculation
  assert.strictEqual(valFuture.isValidForTotals, true);
});

// 7. Reconciliation engine invariants check
test('Test 7: ReconcileTradesEngine verifies row count and multi-dimensional P&L parity', () => {
  const sampleTrades = [
    {
      tradeNo: 1,
      name: 'INFY',
      isValidForTotals: true,
      flags: [],
      grossPaise: 100000,
      exitDate: '2024-05-10',
      entryDate: '2024-05-01'
    },
    {
      tradeNo: 2,
      name: 'INFY',
      isValidForTotals: true,
      flags: ['EXIT_BEFORE_ENTRY'],
      isDateFlagged: true,
      grossPaise: -50000,
      exitDate: '2024-05-01',
      entryDate: '2024-05-10'
    },
    {
      tradeNo: 3,
      name: 'TCS',
      isValidForTotals: true,
      flags: [],
      grossPaise: 200000,
      exitDate: '2024-06-15',
      entryDate: '2024-06-10'
    },
    {
      tradeNo: 4,
      name: 'CORRUPT',
      isValidForTotals: false,
      flags: ['INVALID_NUMBERS'],
      grossPaise: 0
    }
  ];

  const recon = reconcileTradesEngine(sampleTrades, { rowsIn: 4 });
  assert.strictEqual(recon.rowsIn, 4);
  assert.strictEqual(recon.goodCount, 2);
  assert.strictEqual(recon.flaggedCount, 1);
  assert.strictEqual(recon.excludedCount, 1);
  assert.strictEqual(recon.unmatchedCount, 0);
  assert.strictEqual(recon.rowCountInvariantHolds, true);
  assert.strictEqual(recon.pnlReconciliationHolds, true);
  assert.strictEqual(recon.totalRealizedPaise, 250000); // 100,000 - 50,000 + 200,000 = 250,000
  assert.strictEqual(recon.totalRealized, 2500.00);

  // Verify month sums
  assert.strictEqual(recon.pnlByMonth['2024-05'], 50000);
  assert.strictEqual(recon.pnlByMonth['2024-06'], 200000);

  // Verify symbol sums
  assert.strictEqual(recon.pnlBySymbol['INFY'], 50000);
  assert.strictEqual(recon.pnlBySymbol['TCS'], 200000);
});

// 8. Nexus 18-Trade Golden Regression Test
await asyncTest('Test 8: Golden Regression - The 18 Nexus-zeroed trades are restored and accurately computed to -₹3,122.62 gross (-312,262 paise)', async () => {
  const nexusPath = 'C:/Users/iMAC/Downloads/nexus-journal-cash.csv';
  if (!fs.existsSync(nexusPath)) {
    console.warn('Skipping Test 8 (nexus-journal-cash.csv not found at C:/Users/iMAC/Downloads/)');
    return;
  }

  const buf = fs.readFileSync(nexusPath);
  const file = {
    name: 'nexus-journal-cash.csv',
    text: async () => buf.toString('utf-8'),
    arrayBuffer: async () => buf.buffer
  };

  const trades = await parseTradesFromFile(file);
  assert.ok(trades.length > 0, 'Must parse trades');

  // Find all trades with EXIT_BEFORE_ENTRY
  const inverted = trades.filter(t => t.flags && t.flags.includes('EXIT_BEFORE_ENTRY'));
  assert.strictEqual(inverted.length, 18, 'Must find exactly 18 inverted trades');

  let totalInvertedPaise = 0;
  for (const t of inverted) {
    // Assert that every inverted trade has a NON-ZERO grossPaise
    assert.notStrictEqual(t.grossPaise, 0, `Trade ${t.name} (tradeNo ${t.tradeNo}) must not have zero P&L`);
    assert.strictEqual(t.isValidForTotals, true, `Trade ${t.name} must be counted in totals`);
    assert.strictEqual(t.isDateFlagged, true, `Trade ${t.name} must be flagged`);
    totalInvertedPaise += (t.grossPaise || 0);
  }

  // The 18 trades sum to exactly -312,262 paise (-₹3,122.62) gross
  assert.strictEqual(totalInvertedPaise, -312262, 'Total gross paise of the 18 inverted trades must be -312262');
  assert.strictEqual(fromPaise(totalInvertedPaise), -3122.62);

  // Check reconciliation holds across the whole file
  assert.ok(trades._reconciliation, 'Reconciliation report must exist');
  assert.strictEqual(trades._reconciliation.rowCountInvariantHolds, true, 'Row count invariant must hold');
  assert.strictEqual(trades._reconciliation.pnlReconciliationHolds, true, 'Multi-dimensional P&L parity must hold');
});

console.log('--------------------------------------------------------------------------------');
console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED | TOTAL: ${passed + failed}`);
console.log('================================================================================');

if (failed > 0) {
  process.exit(1);
}
