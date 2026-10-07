import fs from 'fs';
import { enrichTradeWithFoxFormulas } from '../src/utils/foxCalculationEngine.js';

const csvContent = fs.readFileSync('test_trades_40.csv', 'utf8').trim().split('\n');
const headers = csvContent[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

const rawTrades = csvContent.slice(1).map(line => {
  const row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      row.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  row.push(cur.trim());
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = row[i] !== undefined ? row[i] : '';
  });
  return obj;
});

console.log(`Loaded ${rawTrades.length} trades from test_trades_40.csv\n`);

// Base capital
const baseCapital = 500000;

// Compare trades one by one
const results = [];

rawTrades.forEach((t, index) => {
  const rawTrade = {
    id: `trade_${t['TRADE NO.']}`,
    tradeNo: Number(t['TRADE NO.']),
    name: t['NAME'],
    setup: t['SETUP'],
    type: t['BUY/SELL'] || 'Buy',
    entry: Number(t['ENTRY (₹)']) || 0,
    qty: Number(t['INITIAL QTY/LOT']) || 0,
    sl: Number(t['SL (₹)']) || 0,
    cmp: Number(t['CMP (₹)']) || 0,
    entryType: t['ENTRY TYPE'] || 'Market',
    tsl: Number(t['TSL (₹)']) || 0,
    p1Price: Number(t['P1 PRICE (₹)']) || undefined,
    p1Qty: Number(t['P1 QTY/LOT']) || undefined,
    p1Date: t['P1 DATE'] || undefined,
    p1Sl: Number(t['P1 SL (₹)']) || undefined,
    p2Price: Number(t['P2 PRICE (₹)']) || undefined,
    p2Qty: Number(t['P2 QTY/LOT']) || undefined,
    p2Date: t['P2 DATE'] || undefined,
    p2Sl: Number(t['P2 SL (₹)']) || undefined,
    p3Price: Number(t['P3 PRICE (₹)']) || undefined,
    p3Qty: Number(t['P3 QTY/LOT']) || undefined,
    p3Date: t['P3 DATE'] || undefined,
    p3Sl: Number(t['P3 SL (₹)']) || undefined,
    p4Price: Number(t['P4 PRICE (₹)']) || undefined,
    p4Qty: Number(t['P4 QTY/LOT']) || undefined,
    p4Date: t['P4 DATE'] || undefined,
    p4Sl: Number(t['P4 SL (₹)']) || undefined,
    e1Price: Number(t['E1 PRICE (₹)']) || undefined,
    e1Qty: Number(t['E1 QTY/LOT']) || undefined,
    e1Date: t['E1 DATE'] || undefined,
    e2Price: Number(t['E2 PRICE (₹)']) || undefined,
    e2Qty: Number(t['E2 QTY/LOT']) || undefined,
    e2Date: t['E2 DATE'] || undefined,
    e3Price: Number(t['E3 PRICE (₹)']) || undefined,
    e3Qty: Number(t['E3 QTY/LOT']) || undefined,
    e3Date: t['E3 DATE'] || undefined,
    e4Price: Number(t['E4 PRICE (₹)']) || undefined,
    e4Qty: Number(t['E4 QTY/LOT']) || undefined,
    e4Date: t['E4 DATE'] || undefined,
    date: t['DATE']
  };

  const enriched = enrichTradeWithFoxFormulas(rawTrade, baseCapital);

  // Collect key metrics to check
  const checks = [
    { name: 'Status', exp: t['POSITION STATUS'], calc: enriched.status, type: 'string' },
    { name: 'Avg Entry', exp: Number(t['AVG ENTRY (₹)']), calc: enriched.avgEntry, tol: 0.05 },
    { name: 'Open Qty', exp: Number(t['OPEN QTY/LOT']), calc: enriched.openQty, tol: 0 },
    { name: 'Exited Qty', exp: Number(t['EXITED QTY/LOT']), calc: enriched.exitedQty, tol: 0 },
    { name: 'Avg Exit Price', exp: Number(t['AVG EXIT PRICE (₹)']), calc: enriched.avgExitPrice || 0, tol: 0.05 },
    { name: 'Position Size', exp: Number(t['POSITION SIZE (₹)']), calc: enriched.positionSize, tol: 1 },
    { name: 'SL %', exp: Number(t['SL %']), calc: enriched.slPct, tol: 0.05 },
    { name: 'Stock Move %', exp: Number(t['STOCK MOVE']), calc: enriched.stockMove, tol: 0.05 },
    { name: 'Reward:Risk', exp: Number(t['REWARD:RISK']), calc: enriched.rewardRisk, tol: 0.05 },
    { name: 'Realized P/L', exp: Number(t['Gross P/L (₹)']), calc: enriched.pl, tol: 1 },
    { name: 'Unrealized P/L', exp: Number(t['UNREALIZED P/L (₹)']), calc: enriched.unrealized || 0, tol: 1 },
    { name: 'PF Impact %', exp: Number(t['PF IMPACT (%)']), calc: enriched.pfImpact, tol: 0.05 }
  ];

  const mismatches = [];
  for (const c of checks) {
    if (c.type === 'string') {
      if (String(c.exp).trim().toLowerCase() !== String(c.calc).trim().toLowerCase()) {
        mismatches.push(`${c.name}: Expected "${c.exp}" but Calc "${c.calc}"`);
      }
    } else {
      const diff = Math.abs((c.exp || 0) - (c.calc || 0));
      if (diff > (c.tol || 0.01)) {
        mismatches.push(`${c.name}: Expected ${c.exp} but Calc ${c.calc} (diff: ${diff.toFixed(2)})`);
      }
    }
  }

  results.push({
    tradeNo: t['TRADE NO.'],
    name: t['NAME'],
    status: enriched.status,
    mismatches,
    enriched,
    raw: t
  });
});

const failCount = results.filter(r => r.mismatches.length > 0).length;
console.log(`Verification Complete: ${results.length - failCount}/${results.length} trades matched 100% perfectly.`);

if (failCount > 0) {
  console.log(`\n--- ${failCount} TRADES WITH DISCREPANCIES ---`);
  results.filter(r => r.mismatches.length > 0).forEach(r => {
    console.log(`\nTrade #${r.tradeNo} (${r.name}, ${r.status}):`);
    r.mismatches.forEach(m => console.log(`   ❌ ${m}`));
  });
} else {
  console.log(`\n🎉 ALL 40 TRADES VERIFIED PERFECTLY!`);
}
