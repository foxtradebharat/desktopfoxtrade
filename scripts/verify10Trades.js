import fs from 'fs';
import { enrichTradeWithFoxFormulas } from '../src/utils/foxCalculationEngine.js';

const dummyLines = fs.readFileSync('dummy_fox_10_trades.csv', 'utf8').trim().split('\n');
const headers = dummyLines[0].split(',').map(h => h.trim());

const trades = dummyLines.slice(1).map(line => {
  const row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; }
    else if (c === ',' && !inQuotes) { row.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  row.push(cur.trim());
  const obj = {};
  headers.forEach((h, i) => obj[h] = row[i] || '');
  return obj;
});

console.log('Loaded', trades.length, 'trades.');
const portfolioCapital = 895000;

let allMatch = true;
trades.forEach((t) => {
  const rawTrade = {
    id: t.id,
    tradeNo: Number(t.tradeNo),
    name: t.name,
    setup: t.setup,
    type: t.side || 'Buy',
    entry: Number(t.entry),
    qty: Number(t.initialQty),
    sl: Number(t.sl),
    cmp: Number(t.cmp),
    entryType: t.entryType,
    tsl: Number(t.tsl),
    p1Price: Number(t.p1Price) || undefined,
    p1Qty: Number(t.p1Qty) || undefined,
    p1Date: t.p1Date || undefined,
    p1Sl: Number(t.p1Sl) || undefined,
    p2Price: Number(t.p2Price) || undefined,
    p2Qty: Number(t.p2Qty) || undefined,
    p2Date: t.p2Date || undefined,
    p2Sl: Number(t.p2Sl) || undefined,
    e1Price: Number(t.e1Price) || undefined,
    e1Qty: Number(t.e1Qty) || undefined,
    e1Date: t.e1Date || undefined,
    e2Price: Number(t.e2Price) || undefined,
    e2Qty: Number(t.e2Qty) || undefined,
    e2Date: t.e2Date || undefined,
    e3Price: Number(t.e3Price) || undefined,
    e3Qty: Number(t.e3Qty) || undefined,
    e3Date: t.e3Date || undefined,
    date: t.date
  };

  const enriched = enrichTradeWithFoxFormulas(rawTrade, portfolioCapital);
  console.log(`\n--- Trade #${t.tradeNo} (${t.name}) ---`);
  console.log(`Status:      Calc = ${enriched.status.padEnd(8)} | Exp = ${t.positionStatus}`);
  console.log(`AvgEntry:    Calc = ${String(enriched.avgEntry).padEnd(8)} | Exp = ${t.avgEntry}`);
  console.log(`AvgExit:     Calc = ${String(enriched.avgExitPrice || 0).padEnd(8)} | Exp = ${t.avgExitPrice}`);
  console.log(`OpenQty:     Calc = ${String(enriched.openQty).padEnd(8)} | Exp = ${t.openQty}`);
  console.log(`ExitedQty:   Calc = ${String(enriched.exitedQty).padEnd(8)} | Exp = ${t.exitedQty}`);
  console.log(`PnL:         Calc = ${String(enriched.pl).padEnd(8)} | Exp = ${t.pl}`);
  console.log(`Unrealized:  Calc = ${String(enriched.unrealized || 0).padEnd(8)} | Exp = ${t.unrealizedPL || 0}`);
  console.log(`StockMove%:  Calc = ${String(enriched.stockMove).padEnd(8)} | Exp = ${t.stockMove}`);
  console.log(`RewardRisk:  Calc = ${String(enriched.rewardRisk).padEnd(8)} | Exp = ${t.rewardRisk}`);
  console.log(`PF Impact%:  Calc = ${String(enriched.pfImpact).padEnd(8)} | Exp = ${t.pfImpact}`);
});
