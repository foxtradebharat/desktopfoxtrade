const fs = require('fs');
const path = require('path');

const srcFile = fs.existsSync('C:\\Users\\iMAC\\Downloads\\foxtrade-complete-data.json')
  ? 'C:\\Users\\iMAC\\Downloads\\foxtrade-complete-data.json'
  : (fs.existsSync('C:\\Users\\iMAC\\Downloads\\complete-data.json') ? 'C:\\Users\\iMAC\\Downloads\\complete-data.json' : 'C:\\Users\\iMAC\\Downloads\\foxtrade-complete-data.json');
const rawData = fs.existsSync(srcFile) ? JSON.parse(fs.readFileSync(srcFile, 'utf8')) : { data: { journal: { rows: [] } } };

// Clone the backup structure and keep only 10 rows
const tenRowsBackup = JSON.parse(JSON.stringify(rawData));
const rows = (rawData.data?.journal?.rows || []).slice(0, 10);
tenRowsBackup.data.journal.rows = rows;

// 1. Save as FoxTrade Backup JSON
const jsonOutputPath = 'C:\\Users\\iMAC\\Downloads\\foxtrade-10-trades.json';
fs.writeFileSync(jsonOutputPath, JSON.stringify(tenRowsBackup, null, 2));
console.log('Saved 10-trades JSON backup to:', jsonOutputPath);

// 2. Format for TradeOnTip
function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

const tradeOnTipTrades = rows.map((r, i) => ({
  id: r.id || `trade_${i + 1}`,
  tradeNo: r.tradeNo || (i + 1),
  date: formatDate(r.date),
  name: r.name || '',
  symbol: r.name || '',
  setup: r.setup || '',
  type: r.side || 'Buy',
  entry: r.entry || 0,
  avgEntry: r.avgEntry || r.entry || 0,
  sl: r.sl || 0,
  tsl: r.tsl || 0,
  cmp: r.cmp || 0,
  qty: r.initialQty || 0,
  p1Price: r.p1Price || 0,
  p1Qty: r.p1Qty || 0,
  p1Date: formatDate(r.p1Date),
  p1Sl: r.p1Sl || 0,
  p2Price: r.p2Price || 0,
  p2Qty: r.p2Qty || 0,
  p2Date: formatDate(r.p2Date),
  p2Sl: r.p2Sl || 0,
  p3Price: r.p3Price || 0,
  p3Qty: r.p3Qty || 0,
  p3Date: formatDate(r.p3Date),
  p3Sl: r.p3Sl || 0,
  positionSize: r.positionSize || 0,
  currentAllocation: r.allocation || 0,
  peakAllocation: r.allocation || 0,
  slPct: parseFloat((r.slPct || r.slPercent || 0).toFixed(2)),
  e1Price: r.e1Price || 0,
  e1Qty: r.e1Qty || 0,
  e1Date: formatDate(r.e1Date),
  e2Price: r.e2Price || 0,
  e2Qty: r.e2Qty || 0,
  e2Date: formatDate(r.e2Date),
  e3Price: r.e3Price || 0,
  e3Qty: r.e3Qty || 0,
  e3Date: formatDate(r.e3Date),
  openQty: r.openQty || 0,
  exitedQty: r.exitedQty || 0,
  avgExitPrice: r.avgExitPrice || 0,
  stockMove: parseFloat((r.stockMove || 0).toFixed(2)),
  rewardRisk: parseFloat((r.rewardRisk || 0).toFixed(2)),
  holdingDays: r.holdingDays || 0,
  status: r.positionStatus || 'Closed',
  realisedAmount: r.realisedAmount || 0,
  pnl: r.pl || 0,
  pl: r.pl || 0,
  pfImpact: parseFloat((r.pfImpact || 0).toFixed(2)),
  cummPf: parseFloat((r.cummPf || 0).toFixed(2)),
  planFollowed: r.planFollowed === 'true' || r.planFollowed === true ? 'Yes' : (r.planFollowed === 'false' || r.planFollowed === false ? 'No' : (r.planFollowed || 'Yes')),
  exitTrigger: r.exitTrigger || '',
  growthAreas: r.growthAreas || '',
  capitalAtRisk: r.openHeat || 0,
  baseDuration: r.baseDuration || 0,
  quickNote: r.notes || '',
  unrealized: r.unrealizedPL || 0,
  unrealizedPL: r.unrealizedPL || 0
}));

const totOutputPath = path.join(__dirname, '..', 'src', 'data', 'foxtradeImportedTrades.json');
fs.writeFileSync(totOutputPath, JSON.stringify(tradeOnTipTrades, null, 2));
console.log('Saved 10 trades to TradeOnTip data file:', totOutputPath);

// 3. Save as CSV
const headers = [
  'tradeNo','date','name','setup','side','entry','avgEntry','sl','cmp','entryType',
  'initialQty','p1Price','p1Qty','p1Date','p1Sl','p2Price','p2Qty','p2Date','p2Sl',
  'tsl','tslGroups','positionSize','Current Allocation (%)','Peak Allocation (%)','slPct',
  'e1Price','e1Qty','e1Date','e2Price','e2Qty','e2Date','e3Price','e3Qty','e3Date',
  'openQty','exitedQty','avgExitPrice','stockMove','rewardRisk','holdingDays','positionStatus',
  'realisedAmount','pl','pfImpact','cummPf','planFollowed','exitTrigger','growthAreas',
  'openHeat','baseDuration','notes','unrealizedPL','brokerage','actions','id','broker',
  'transactionHistory','allExchangeTradeIds'
];

const csvRows = [headers.join(',')];

rows.forEach(r => {
  const vals = [
    r.tradeNo,
    r.date,
    r.name,
    r.setup,
    r.side,
    r.entry,
    r.avgEntry,
    r.sl,
    r.cmp,
    r.entryType || '',
    r.initialQty,
    r.p1Price || 0,
    r.p1Qty || 0,
    r.p1Date || '',
    r.p1Sl || 0,
    r.p2Price || 0,
    r.p2Qty || 0,
    r.p2Date || '',
    r.p2Sl || 0,
    r.tsl || 0,
    r.tslGroups || '',
    r.positionSize || 0,
    r.allocation || 0,
    r.allocation || 0,
    r.slPct || r.slPercent || 0,
    r.e1Price || 0,
    r.e1Qty || 0,
    r.e1Date || '',
    r.e2Price || 0,
    r.e2Qty || 0,
    r.e2Date || '',
    r.e3Price || 0,
    r.e3Qty || 0,
    r.e3Date || '',
    r.openQty || 0,
    r.exitedQty || 0,
    r.avgExitPrice || 0,
    r.stockMove || 0,
    r.rewardRisk || 0,
    r.holdingDays || 0,
    r.positionStatus || 'Closed',
    r.realisedAmount || 0,
    r.pl || 0,
    r.pfImpact || 0,
    r.cummPf || 0,
    r.planFollowed || 'true',
    r.exitTrigger || '',
    r.growthAreas || '',
    r.openHeat || 0,
    r.baseDuration || 0,
    `"${(r.notes || '').replace(/"/g, '""')}"`,
    r.unrealizedPL || 0,
    r.brokerage || 0,
    r.actions || '',
    r.id || '',
    r.broker || '',
    r.transactionHistory || '',
    '[]'
  ];
  csvRows.push(vals.join(','));
});

const csvOutputPath = 'C:\\Users\\iMAC\\Downloads\\foxtrade-10-trades.csv';
fs.writeFileSync(csvOutputPath, csvRows.join('\n'));
console.log('Saved 10-trades CSV to:', csvOutputPath);
