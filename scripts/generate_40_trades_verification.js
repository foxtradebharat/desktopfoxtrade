// scripts/generate_40_trades_verification.js
import fs from 'fs';
import path from 'path';
import { enrichTradeWithFoxFormulas } from '../src/utils/foxCalculationEngine.js';

const CAPITAL = 500000; // 5 Lakhs

const TRADES_RAW = [
  // --- 1 to 10: Clean Single Leg Closed Trades ---
  {
    tradeNo: 1, date: '2026-01-05', name: 'RELIANCE', setup: 'Breakout', side: 'Buy',
    entry: 2500, initialQty: 20, sl: 2450,
    e1Price: 2600, e1Qty: 20, e1Date: '2026-01-08',
    exitTrigger: 'Target Hit', notes: 'Clean 2R target hit'
  },
  {
    tradeNo: 2, date: '2026-01-06', name: 'TCS', setup: 'Breakout', side: 'Buy',
    entry: 4000, initialQty: 10, sl: 3900,
    e1Price: 3900, e1Qty: 10, e1Date: '2026-01-07',
    exitTrigger: 'Stop Loss Hit', notes: 'Initial 1R stop hit'
  },
  {
    tradeNo: 3, date: '2026-01-08', name: 'INFY', setup: 'Trend Pullback', side: 'Buy',
    entry: 1500, initialQty: 30, sl: 1450,
    e1Price: 1600, e1Qty: 30, e1Date: '2026-01-14',
    exitTrigger: 'Target Hit', notes: '2R pullback target hit'
  },
  {
    tradeNo: 4, date: '2026-01-12', name: 'HDFCBANK', setup: 'Mean Reversion', side: 'Buy',
    entry: 1600, initialQty: 25, sl: 1560,
    e1Price: 1560, e1Qty: 25, e1Date: '2026-01-13',
    exitTrigger: 'Stop Loss Hit', notes: 'Mean reversion failed at SL'
  },
  {
    tradeNo: 5, date: '2026-01-15', name: 'ICICIBANK', setup: 'Breakout', side: 'Buy',
    entry: 1000, initialQty: 50, sl: 970,
    e1Price: 1060, e1Qty: 50, e1Date: '2026-01-20',
    exitTrigger: 'Target Hit', notes: '2R breakout win'
  },
  {
    tradeNo: 6, date: '2026-01-19', name: 'SBIN', setup: 'Breakout', side: 'Buy',
    entry: 800, initialQty: 50, sl: 770,
    e1Price: 770, e1Qty: 50, e1Date: '2026-01-20',
    exitTrigger: 'Stop Loss Hit', notes: 'PSU bank false breakout stop'
  },
  {
    tradeNo: 7, date: '2026-01-22', name: 'BHARTIARTL', setup: 'Breakout', side: 'Buy',
    entry: 1200, initialQty: 30, sl: 1160,
    e1Price: 1280, e1Qty: 30, e1Date: '2026-01-27',
    exitTrigger: 'Target Hit', notes: 'Telecom momentum 2R win'
  },
  {
    tradeNo: 8, date: '2026-01-26', name: 'LT', setup: 'Trend Pullback', side: 'Buy',
    entry: 3500, initialQty: 10, sl: 3400,
    e1Price: 3400, e1Qty: 10, e1Date: '2026-01-28',
    exitTrigger: 'Stop Loss Hit', notes: 'Support break 1R loss'
  },
  {
    tradeNo: 9, date: '2026-01-28', name: 'ITC', setup: 'Breakout', side: 'Buy',
    entry: 500, initialQty: 100, sl: 485,
    e1Price: 530, e1Qty: 100, e1Date: '2026-02-03',
    exitTrigger: 'Target Hit', notes: 'FMCG range expansion 2R'
  },
  {
    tradeNo: 10, date: '2026-02-02', name: 'KOTAKBANK', setup: 'Mean Reversion', side: 'Buy',
    entry: 1800, initialQty: 20, sl: 1750,
    e1Price: 1750, e1Qty: 20, e1Date: '2026-02-04',
    exitTrigger: 'Stop Loss Hit', notes: 'Failed bounce stopped'
  },

  // --- 11 to 18: Pyramid Scaling Trades ---
  {
    tradeNo: 11, date: '2026-02-03', name: 'AXISBANK', setup: 'Breakout', side: 'Buy',
    entry: 1000, initialQty: 20, sl: 960,
    p1Price: 1040, p1Qty: 20, p1Date: '2026-02-05', p1Sl: 980,
    e1Price: 1100, e1Qty: 40, e1Date: '2026-02-10',
    exitTrigger: 'Target Hit', notes: 'Pyramid average up 20sh @ 1040. Full exit @ 1100'
  },
  {
    tradeNo: 12, date: '2026-02-06', name: 'TATAMOTORS', setup: 'Trend Pullback', side: 'Buy',
    entry: 600, initialQty: 25, sl: 570,
    p1Price: 640, p1Qty: 25, p1Date: '2026-02-09', p1Sl: 600,
    e1Price: 700, e1Qty: 50, e1Date: '2026-02-16',
    exitTrigger: 'Target Hit', notes: 'Pyramid win at 700'
  },
  {
    tradeNo: 13, date: '2026-02-12', name: 'MARUTI', setup: 'Breakout', side: 'Buy',
    entry: 11000, initialQty: 2, sl: 10700,
    p1Price: 11200, p1Qty: 2, p1Date: '2026-02-13', p1Sl: 10900,
    e1Price: 10900, e1Qty: 4, e1Date: '2026-02-17',
    exitTrigger: 'Stop Loss Hit', notes: 'Pyramid cut at raised stop 10900'
  },
  {
    tradeNo: 14, date: '2026-02-16', name: 'SUNPHARMA', setup: 'Breakout', side: 'Buy',
    entry: 1500, initialQty: 20, sl: 1450,
    p1Price: 1560, p1Qty: 10, p1Date: '2026-02-18', p1Sl: 1480,
    e1Price: 1650, e1Qty: 30, e1Date: '2026-02-24',
    exitTrigger: 'Target Hit', notes: 'Pharma scale-in win'
  },
  {
    tradeNo: 15, date: '2026-02-19', name: 'TITAN', setup: 'Trend Pullback', side: 'Buy',
    entry: 3200, initialQty: 10, sl: 3100,
    p1Price: 3320, p1Qty: 5, p1Date: '2026-02-20', p1Sl: 3200,
    e1Price: 3500, e1Qty: 15, e1Date: '2026-02-27',
    exitTrigger: 'Target Hit', notes: 'Titan scale-in target hit'
  },
  {
    tradeNo: 16, date: '2026-02-23', name: 'BAJFINANCE', setup: 'Breakout', side: 'Buy',
    entry: 6500, initialQty: 4, sl: 6300,
    p1Price: 6800, p1Qty: 2, p1Date: '2026-02-24', p1Sl: 6400,
    e1Price: 6400, e1Qty: 6, e1Date: '2026-02-26',
    exitTrigger: 'Stop Loss Hit', notes: 'Pyramid stopped at 6400'
  },
  {
    tradeNo: 17, date: '2026-02-25', name: 'WIPRO', setup: 'Mean Reversion', side: 'Buy',
    entry: 500, initialQty: 50, sl: 480,
    p1Price: 520, p1Qty: 50, p1Date: '2026-02-26', p1Sl: 500,
    e1Price: 495, e1Qty: 100, e1Date: '2026-03-02',
    exitTrigger: 'Stop Loss Hit', notes: 'Pyramid failed at 495 stop'
  },
  {
    tradeNo: 18, date: '2026-02-27', name: 'NTPC', setup: 'Breakout', side: 'Buy',
    entry: 300, initialQty: 50, sl: 285,
    p1Price: 320, p1Qty: 50, p1Date: '2026-03-02', p1Sl: 300,
    p2Price: 340, p2Qty: 50, p2Date: '2026-03-04', p2Sl: 320,
    e1Price: 360, e1Qty: 150, e1Date: '2026-03-09',
    exitTrigger: 'Target Hit', notes: 'Double pyramid 3-leg winner'
  },

  // --- 19 to 24: Multi-Stage Partial Exit Trades ---
  {
    tradeNo: 19, date: '2026-03-02', name: 'ONGC', setup: 'Breakout', side: 'Buy',
    entry: 240, initialQty: 150, sl: 230,
    e1Price: 260, e1Qty: 75, e1Date: '2026-03-06',
    e2Price: 280, e2Qty: 75, e2Date: '2026-03-11',
    exitTrigger: 'Target Hit', notes: '2-stage partial exit win'
  },
  {
    tradeNo: 20, date: '2026-03-04', name: 'POWERGRID', setup: 'Breakout', side: 'Buy',
    entry: 300, initialQty: 120, sl: 285,
    e1Price: 320, e1Qty: 60, e1Date: '2026-03-09',
    e2Price: 340, e2Qty: 60, e2Date: '2026-03-13',
    exitTrigger: 'Target Hit', notes: 'Partial profit booking 50/50'
  },
  {
    tradeNo: 21, date: '2026-03-06', name: 'TATASTEEL', setup: 'Breakout', side: 'Buy',
    entry: 150, initialQty: 300, sl: 142,
    e1Price: 160, e1Qty: 150, e1Date: '2026-03-11',
    e2Price: 170, e2Qty: 150, e2Date: '2026-03-17',
    exitTrigger: 'Target Hit', notes: 'Metal momentum scale out'
  },
  {
    tradeNo: 22, date: '2026-03-09', name: 'COALINDIA', setup: 'Trend Pullback', side: 'Buy',
    entry: 400, initialQty: 100, sl: 385,
    e1Price: 420, e1Qty: 50, e1Date: '2026-03-13',
    e2Price: 440, e2Qty: 50, e2Date: '2026-03-19',
    exitTrigger: 'Target Hit', notes: 'Pullback partial profit booking'
  },
  {
    tradeNo: 23, date: '2026-03-11', name: 'HCLTECH', setup: 'Breakout', side: 'Buy',
    entry: 1400, initialQty: 30, sl: 1350,
    e1Price: 1480, e1Qty: 15, e1Date: '2026-03-16',
    e2Price: 1400, e2Qty: 15, e2Date: '2026-03-20',
    exitTrigger: 'Target & Breakeven', notes: 'E1 target win, E2 stopped at breakeven'
  },
  {
    tradeNo: 24, date: '2026-03-13', name: 'ADANIENT', setup: 'Breakout', side: 'Buy',
    entry: 3000, initialQty: 15, sl: 2900,
    e1Price: 3150, e1Qty: 5, e1Date: '2026-03-17',
    e2Price: 3300, e2Qty: 5, e2Date: '2026-03-20',
    e3Price: 3450, e3Qty: 5, e3Date: '2026-03-25',
    exitTrigger: 'Target Hit', notes: '3-tier scale out winner'
  },

  // --- 25 to 30: Trailing Stop Loss (TSL) Closed Trades ---
  {
    tradeNo: 25, date: '2026-03-16', name: 'JSWSTEEL', setup: 'Breakout', side: 'Buy',
    entry: 900, initialQty: 50, sl: 860, tsl: 950,
    e1Price: 950, e1Qty: 50, e1Date: '2026-03-23',
    exitTrigger: 'Trailing Stop Hit', notes: 'TSL profit lock hit @ 950'
  },
  {
    tradeNo: 26, date: '2026-03-17', name: 'TECHM', setup: 'Breakout', side: 'Buy',
    entry: 1300, initialQty: 30, sl: 1250, tsl: 1380,
    e1Price: 1380, e1Qty: 30, e1Date: '2026-03-24',
    exitTrigger: 'Trailing Stop Hit', notes: 'TSL profit lock hit @ 1380'
  },
  {
    tradeNo: 27, date: '2026-03-18', name: 'BEL', setup: 'Breakout', side: 'Buy',
    entry: 280, initialQty: 150, sl: 268, tsl: 300,
    e1Price: 300, e1Qty: 150, e1Date: '2026-03-25',
    exitTrigger: 'Trailing Stop Hit', notes: 'Defense rally TSL exit @ 300'
  },
  {
    tradeNo: 28, date: '2026-03-20', name: 'GRASIM', setup: 'Trend Pullback', side: 'Buy',
    entry: 2200, initialQty: 20, sl: 2120,
    e1Price: 2120, e1Qty: 20, e1Date: '2026-03-24',
    exitTrigger: 'Stop Loss Hit', notes: 'Failed pullback stopped out'
  },
  {
    tradeNo: 29, date: '2026-03-23', name: 'DRREDDY', setup: 'Breakout', side: 'Buy',
    entry: 6000, initialQty: 8, sl: 5850,
    e1Price: 5850, e1Qty: 8, e1Date: '2026-03-26',
    exitTrigger: 'Stop Loss Hit', notes: 'Pharma consolidation stopped'
  },
  {
    tradeNo: 30, date: '2026-03-24', name: 'CIPLA', setup: 'Breakout', side: 'Buy',
    entry: 1400, initialQty: 30, sl: 1360, tsl: 1400,
    e1Price: 1400, e1Qty: 30, e1Date: '2026-03-27',
    exitTrigger: 'Breakeven Exit', notes: 'Scratch trade exited at entry cost'
  },

  // --- 31 to 40: Active Open & Partial Positions (As of April 2026) ---
  {
    tradeNo: 31, date: '2026-03-25', name: 'RELIANCE', setup: 'Breakout', side: 'Buy',
    entry: 2600, initialQty: 15, sl: 2500, cmp: 2700,
    notes: 'Open swing with +1500 unrealized gain'
  },
  {
    tradeNo: 32, date: '2026-03-26', name: 'TCS', setup: 'Trend Pullback', side: 'Buy',
    entry: 4000, initialQty: 10, sl: 3880, tsl: 4100, cmp: 4180,
    notes: 'Open swing with TSL at 4100 locking 1000 profit'
  },
  {
    tradeNo: 33, date: '2026-03-27', name: 'INFY', setup: 'Breakout', side: 'Buy',
    entry: 1600, initialQty: 20, sl: 1560,
    p1Price: 1660, p1Qty: 10, p1Date: '2026-03-31', p1Sl: 1600, cmp: 1680,
    notes: 'Open pyramid with +1800 unrealized gain'
  },
  {
    tradeNo: 34, date: '2026-03-27', name: 'HDFCBANK', setup: 'Mean Reversion', side: 'Buy',
    entry: 1600, initialQty: 30, sl: 1540,
    e1Price: 1680, e1Qty: 15, e1Date: '2026-04-01', cmp: 1700,
    notes: 'Partial open position: 15 exited @ 1680, 15 open @ CMP 1700'
  },
  {
    tradeNo: 35, date: '2026-03-30', name: 'ICICIBANK', setup: 'Breakout', side: 'Buy',
    entry: 1100, initialQty: 40, sl: 1060, cmp: 1080,
    notes: 'Open position holding support dip (-800)'
  },
  {
    tradeNo: 36, date: '2026-03-30', name: 'SBIN', setup: 'Breakout', side: 'Buy',
    entry: 800, initialQty: 50, sl: 770, tsl: 820, cmp: 850,
    notes: 'Open position with TSL @ 820 (+1000 protected)'
  },
  {
    tradeNo: 37, date: '2026-03-31', name: 'LT', setup: 'Trend Pullback', side: 'Buy',
    entry: 3600, initialQty: 12, sl: 3480, cmp: 3720,
    notes: 'Open position +1440 unrealized gain'
  },
  {
    tradeNo: 38, date: '2026-03-31', name: 'BHARTIARTL', setup: 'Breakout', side: 'Buy',
    entry: 1300, initialQty: 30, sl: 1250, tsl: 1340,
    e1Price: 1380, e1Qty: 15, e1Date: '2026-04-03', cmp: 1400,
    notes: 'Partial open position with TSL @ 1340'
  },
  {
    tradeNo: 39, date: '2026-04-01', name: 'TITAN', setup: 'Breakout', side: 'Buy',
    entry: 3500, initialQty: 12, sl: 3380, cmp: 3600,
    notes: 'Open position +1200 unrealized gain'
  },
  {
    tradeNo: 40, date: '2026-04-01', name: 'MARUTI', setup: 'Breakout', side: 'Buy',
    entry: 12000, initialQty: 4, sl: 11600, cmp: 11850,
    notes: 'Open position holding pullback (-600)'
  }
];

// Enrich trades through master formula engine
let runningCummPf = 0;
const enrichedTrades = TRADES_RAW.map(t => {
  const enriched = enrichTradeWithFoxFormulas(t, CAPITAL);
  if (enriched.status === 'Closed' || enriched.status === 'Partial') {
    runningCummPf += enriched.pfImpact;
  }
  enriched.cummPfImpact = Math.round(runningCummPf * 100) / 100;
  return enriched;
});

// Build CSV
const headers = [
  'TRADE NO.', 'DATE', 'NAME', 'SETUP', 'BUY/SELL', 'ENTRY (₹)', 'AVG ENTRY (₹)', 'SL (₹)', 'CMP (₹)',
  'ENTRY TYPE', 'INITIAL QTY/LOT',
  'P1 PRICE (₹)', 'P1 QTY/LOT', 'P1 DATE', 'P1 SL (₹)',
  'P2 PRICE (₹)', 'P2 QTY/LOT', 'P2 DATE', 'P2 SL (₹)',
  'P3 PRICE (₹)', 'P3 QTY/LOT', 'P3 DATE', 'P3 SL (₹)',
  'P4 PRICE (₹)', 'P4 QTY/LOT', 'P4 DATE', 'P4 SL (₹)',
  'TSL (₹)', 'POSITION SIZE (₹)', 'CURRENT ALLOCATION (%)', 'PEAK ALLOCATION (%)', 'SL %',
  'E1 PRICE (₹)', 'E1 QTY/LOT', 'E1 DATE',
  'E2 PRICE (₹)', 'E2 QTY/LOT', 'E2 DATE',
  'E3 PRICE (₹)', 'E3 QTY/LOT', 'E3 DATE',
  'E4 PRICE (₹)', 'E4 QTY/LOT', 'E4 DATE',
  'OPEN QTY/LOT', 'EXITED QTY/LOT', 'AVG EXIT PRICE (₹)', 'STOCK MOVE', 'REWARD:RISK', 'HOLDING DAYS',
  'POSITION STATUS', 'REALISED AMOUNT (₹)', 'Gross P/L (₹)', 'PF IMPACT (%)', 'CUMM PF IMPACT (%)',
  'PLAN FOLLOWED', 'EXIT TRIGGER', 'GROWTH AREAS', 'CAPITAL AT RISK (%)', 'BASE DURATION', 'QUICK NOTE', 'UNREALIZED P/L (₹)'
];

const csvRows = [headers.join(',')];

for (const t of enrichedTrades) {
  const row = [
    t.tradeNo,
    t.date,
    t.name,
    t.setup,
    t.side || 'Buy',
    t.entry,
    t.avgEntry !== undefined ? Math.round(t.avgEntry * 100) / 100 : t.entry,
    t.sl || '',
    t.cmp || 0,
    t.entryType || 'Market',
    t.qty || 0,
    t.p1Price || '', t.p1Qty || '', t.p1Date || '', t.p1Sl || '',
    t.p2Price || '', t.p2Qty || '', t.p2Date || '', t.p2Sl || '',
    '', '', '', '', // P3
    '', '', '', '', // P4
    t.tsl || '',
    t.positionSize || 0,
    Math.round(t.currentAllocation * 100) / 100,
    Math.round(t.peakAllocation * 100) / 100,
    t.slPct !== null ? Math.round(t.slPct * 100) / 100 : '',
    t.e1Price || '', t.e1Qty || '', t.e1Date || '',
    t.e2Price || '', t.e2Qty || '', t.e2Date || '',
    t.e3Price || '', t.e3Qty || '', t.e3Date || '',
    '', '', '', // E4
    t.openQty,
    t.exitedQty,
    t.avgExitPrice ? Math.round(t.avgExitPrice * 100) / 100 : 0,
    t.stockMove !== undefined ? Math.round(t.stockMove * 100) / 100 : 0,
    t.rewardRisk !== null && t.rewardRisk !== undefined ? t.rewardRisk : '',
    t.holdingDays || 0,
    t.status,
    t.realisedAmount || 0,
    t.pnl || 0,
    Math.round(t.pfImpact * 100) / 100,
    t.cummPfImpact,
    'Yes',
    t.exitTrigger || '',
    '',
    t.capitalAtRisk !== undefined ? t.capitalAtRisk : 0,
    'Swing',
    `"${(t.notes || '').replace(/"/g, '""')}"`,
    t.unrealized !== undefined ? t.unrealized : 0
  ];
  csvRows.push(row.join(','));
}

const outputPath = path.resolve('D:/tradeontip/foxtrade_40_trades_clean.csv');
fs.writeFileSync(outputPath, csvRows.join('\n'), 'utf8');

console.log(`Generated ${enrichedTrades.length} trades to ${outputPath}`);

// Print summary metrics
const closedTrades = enrichedTrades.filter(t => t.status === 'Closed');
const partialTrades = enrichedTrades.filter(t => t.status === 'Partial');
const openTrades = enrichedTrades.filter(t => t.status === 'Open');
const totalRealizedPL = enrichedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
const totalUnrealizedPL = enrichedTrades.reduce((sum, t) => sum + (t.unrealized || 0), 0);
const wins = closedTrades.filter(t => (t.pnl || 0) > 0).length + partialTrades.filter(t => (t.pnl || 0) > 0).length;
const totalResolved = closedTrades.length + partialTrades.length;
const winRate = (wins / totalResolved) * 100;

console.log(`Summary:`);
console.log(`- Total Trades: ${enrichedTrades.length}`);
console.log(`- Closed Trades: ${closedTrades.length}`);
console.log(`- Partial Trades: ${partialTrades.length}`);
console.log(`- Open Trades: ${openTrades.length}`);
console.log(`- Resolved Trades (Closed + Partial): ${totalResolved}`);
console.log(`- Wins: ${wins}, Losses: ${totalResolved - wins}`);
console.log(`- Win Rate: ${winRate.toFixed(1)}%`);
console.log(`- Total Realized Gross P/L: ₹${totalRealizedPL.toLocaleString('en-IN')}`);
console.log(`- Total Unrealized P/L: ₹${totalUnrealizedPL.toLocaleString('en-IN')}`);
console.log(`- Final Cumm PF Impact: ${runningCummPf.toFixed(2)}%`);
