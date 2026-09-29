const fs = require('fs');
const path = require('path');

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

const csvPath = 'C:\\Users\\iMAC\\Downloads\\nexus-journal-cash.csv';
const fileContent = fs.readFileSync(csvPath, 'utf8');
const lines = fileContent.split(/\r?\n/).filter(l => l.trim().length > 0);
const headers = parseCSVLine(lines[0]);

console.log('Headers count:', headers.length);
console.log('Total CSV rows:', lines.length - 1);

const trades = [];

for (let i = 1; i < lines.length; i++) {
  const row = parseCSVLine(lines[i]);
  const obj = {};
  headers.forEach((h, idx) => {
    obj[h] = row[idx] || '';
  });

  const pnlVal = parseFloat(obj.pl) || 0;
  const stockMoveVal = parseFloat(obj.stockMove) || 0;
  const rrVal = parseFloat(obj.rewardRisk) || 0;
  const pfImpVal = parseFloat(obj.pfImpact) || 0;
  const cummVal = parseFloat(obj.cummPf) || 0;

  trades.push({
    id: obj.id || `trade_${obj.tradeNo || i}`,
    tradeNo: parseInt(obj.tradeNo) || i,
    date: formatDate(obj.date),
    name: obj.name || '',
    symbol: obj.name || '',
    setup: obj.setup || '',
    type: obj.side || 'Buy',
    entry: parseFloat(obj.entry) || 0,
    avgEntry: parseFloat(obj.avgEntry) || parseFloat(obj.entry) || 0,
    sl: parseFloat(obj.sl) || 0,
    tsl: parseFloat(obj.tsl) || 0,
    cmp: parseFloat(obj.cmp) || 0,
    qty: parseFloat(obj.initialQty) || 0,
    p1Price: parseFloat(obj.p1Price) || 0,
    p1Qty: parseFloat(obj.p1Qty) || 0,
    p1Date: formatDate(obj.p1Date),
    p1Sl: parseFloat(obj.p1Sl) || 0,
    p2Price: parseFloat(obj.p2Price) || 0,
    p2Qty: parseFloat(obj.p2Qty) || 0,
    p2Date: formatDate(obj.p2Date),
    p2Sl: parseFloat(obj.p2Sl) || 0,
    p3Price: parseFloat(obj.p3Price) || 0,
    p3Qty: parseFloat(obj.p3Qty) || 0,
    p3Date: formatDate(obj.p3Date),
    p3Sl: parseFloat(obj.p3Sl) || 0,
    positionSize: parseFloat(obj.positionSize) || 0,
    currentAllocation: parseFloat(obj['Current Allocation (%)']) || 0,
    peakAllocation: parseFloat(obj['Peak Allocation (%)']) || 0,
    slPct: parseFloat(obj.slPct) || 0,
    e1Price: parseFloat(obj.e1Price) || 0,
    e1Qty: parseFloat(obj.e1Qty) || 0,
    e1Date: formatDate(obj.e1Date),
    e2Price: parseFloat(obj.e2Price) || 0,
    e2Qty: parseFloat(obj.e2Qty) || 0,
    e2Date: formatDate(obj.e2Date),
    e3Price: parseFloat(obj.e3Price) || 0,
    e3Qty: parseFloat(obj.e3Qty) || 0,
    e3Date: formatDate(obj.e3Date),
    openQty: parseFloat(obj.openQty) || 0,
    exitedQty: parseFloat(obj.exitedQty) || 0,
    avgExitPrice: parseFloat(obj.avgExitPrice) || 0,
    stockMove: stockMoveVal,
    rewardRisk: rrVal,
    holdingDays: parseInt(obj.holdingDays) || 0,
    status: obj.positionStatus || 'Closed',
    realisedAmount: parseFloat(obj.realisedAmount) || 0,
    pnl: pnlVal,
    pl: pnlVal,
    pfImpact: pfImpVal,
    cummPf: cummVal,
    planFollowed: obj.planFollowed === 'true' || obj.planFollowed === true ? 'Yes' : (obj.planFollowed === 'false' || obj.planFollowed === false ? 'No' : (obj.planFollowed || 'Yes')),
    exitTrigger: obj.exitTrigger || '',
    growthAreas: obj.growthAreas || '',
    capitalAtRisk: parseFloat(obj.openHeat) || 0,
    baseDuration: parseFloat(obj.baseDuration) || 0,
    quickNote: obj.notes || '',
    unrealized: parseFloat(obj.unrealizedPL) || 0,
    unrealizedPL: parseFloat(obj.unrealizedPL) || 0
  });
}

const outputPath = path.join(__dirname, '..', 'src', 'data', 'nexusImportedTrades.json');
fs.writeFileSync(outputPath, JSON.stringify(trades, null, 2));
console.log('Successfully written', trades.length, 'trades to', outputPath);
