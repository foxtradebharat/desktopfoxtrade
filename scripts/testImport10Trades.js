import fs from 'fs';
import * as XLSX from 'xlsx';
import { enrichTradeWithFoxFormulas } from '../src/utils/foxCalculationEngine.js';

// Read benchmark file
const fileBuffer = fs.readFileSync('dummy_fox_10_trades.csv');
const wb = XLSX.read(fileBuffer, { type: 'buffer' });
const sheetName = wb.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

console.log('Total rows read:', rows.length);
const headers = rows[0].map(h => String(h || '').trim());
console.log('Headers count:', headers.length);

const headerIndex = {};
headers.forEach((h, idx) => {
  headerIndex[h.toLowerCase()] = idx;
});

const trades = [];
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  if (!row || row.length === 0 || !row[headerIndex['name']]) continue;

  const t = {
    tradeNo: Number(row[headerIndex['tradeno']]) || r,
    date: row[headerIndex['date']],
    name: row[headerIndex['name']],
    setup: row[headerIndex['setup']],
    type: row[headerIndex['side']] || 'Buy',
    entry: Number(row[headerIndex['entry']]),
    qty: Number(row[headerIndex['initialqty']]),
    sl: Number(row[headerIndex['sl']]),
    cmp: Number(row[headerIndex['cmp']]),
    entryType: row[headerIndex['entrytype']],
    tsl: Number(row[headerIndex['tsl']]),
    p1Price: Number(row[headerIndex['p1price']]) || 0,
    p1Qty: Number(row[headerIndex['p1qty']]) || 0,
    p1Date: row[headerIndex['p1date']] || '',
    p1Sl: Number(row[headerIndex['p1sl']]) || 0,
    p2Price: Number(row[headerIndex['p2price']]) || 0,
    p2Qty: Number(row[headerIndex['p2qty']]) || 0,
    p2Date: row[headerIndex['p2date']] || '',
    p2Sl: Number(row[headerIndex['p2sl']]) || 0,
    e1Price: Number(row[headerIndex['e1price']]) || 0,
    e1Qty: Number(row[headerIndex['e1qty']]) || 0,
    e1Date: row[headerIndex['e1date']] || '',
    e2Price: Number(row[headerIndex['e2price']]) || 0,
    e2Qty: Number(row[headerIndex['e2qty']]) || 0,
    e2Date: row[headerIndex['e2date']] || '',
    e3Price: Number(row[headerIndex['e3price']]) || 0,
    e3Qty: Number(row[headerIndex['e3qty']]) || 0,
    e3Date: row[headerIndex['e3date']] || '',
    notes: row[headerIndex['notes']] || ''
  };

  const enriched = enrichTradeWithFoxFormulas(t, 895000);
  trades.push(enriched);
}

console.log(`Successfully parsed & enriched ${trades.length} trades.`);
trades.forEach(t => {
  console.log(`[Trade ${t.tradeNo}] ${t.name}: Status=${t.status}, Realized PnL=₹${t.pl}, Open Qty=${t.openQty}, Unrealized=₹${t.unrealized || 0}`);
});
