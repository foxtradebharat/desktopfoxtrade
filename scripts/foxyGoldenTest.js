// scripts/foxyGoldenTest.js
// Deterministic Golden Test Set for FoxTrade Foxy AI & Trade Query Engine
// 32+ automated test questions with independently computed ground-truth

import { runQuery, executeQueryAndFormat } from '../src/services/tradeQueryEngine.js';

// --- Ground Truth Raw Dataset (50 Diverse Trades) ---
export const RAW_TEST_TRADES = [
  // Breakout Setups
  { id: 1, name: 'RELIANCE', setup: 'Breakout', type: 'Buy', status: 'Closed', pnl: 4500, entry: 2900, exitPrice: 2990, sl: 2855, qty: 50, date: '2026-09-01 09:35:00', holdingDays: 1, rewardRisk: 2.0, segment: 'Equity' },
  { id: 2, name: 'TCS', setup: 'Breakout', type: 'Buy', status: 'Closed', pnl: -2200, entry: 4200, exitPrice: 4156, sl: 4156, qty: 50, date: '2026-09-01 10:15:00', holdingDays: 0, rewardRisk: -1.0, segment: 'Equity' },
  { id: 3, name: 'INFY', setup: 'Breakout', type: 'Buy', status: 'Closed', pnl: 3100, entry: 1850, exitPrice: 1912, sl: 1820, qty: 50, date: '2026-09-02 09:40:00', holdingDays: 2, rewardRisk: 2.07, segment: 'Equity' },
  { id: 4, name: 'HDFCBANK', setup: 'Breakout', type: 'Buy', status: 'Closed', pnl: -1800, entry: 1650, exitPrice: 1632, sl: 1632, qty: 100, date: '2026-09-03 11:20:00', holdingDays: 1, rewardRisk: -1.0, segment: 'Equity' },
  { id: 5, name: 'ICICIBANK', setup: 'Breakout', type: 'Buy', status: 'Closed', pnl: 6200, entry: 1200, exitPrice: 1262, sl: 1180, qty: 100, date: '2026-09-04 14:10:00', holdingDays: 3, rewardRisk: 3.1, segment: 'Equity' },
  { id: 6, name: 'SBIN', setup: 'Breakout', type: 'Buy', status: 'Closed', pnl: 2800, entry: 800, exitPrice: 828, sl: 790, qty: 100, date: '2026-09-07 09:20:00', holdingDays: 1, rewardRisk: 2.8, segment: 'Equity' },
  { id: 7, name: 'BHARTIARTL', setup: 'Breakout', type: 'Buy', status: 'Closed', pnl: -1500, entry: 1500, exitPrice: 1485, sl: 1485, qty: 100, date: '2026-09-08 13:45:00', holdingDays: 0, rewardRisk: -1.0, segment: 'Equity' },
  { id: 8, name: 'LT', setup: 'Breakout', type: 'Buy', status: 'Closed', pnl: 5400, entry: 3600, exitPrice: 3708, sl: 3550, qty: 50, date: '2026-09-09 10:05:00', holdingDays: 2, rewardRisk: 2.16, segment: 'Equity' },
  { id: 9, name: 'KOTAKBANK', setup: 'Breakout', type: 'Buy', status: 'Closed', pnl: -2000, entry: 1800, exitPrice: 1780, sl: 1780, qty: 100, date: '2026-09-10 15:15:00', holdingDays: 0, rewardRisk: -1.0, segment: 'Equity' },
  { id: 10, name: 'AXISBANK', setup: 'Breakout', type: 'Buy', status: 'Closed', pnl: 3500, entry: 1150, exitPrice: 1185, sl: 1135, qty: 100, date: '2026-09-11 09:30:00', holdingDays: 1, rewardRisk: 2.33, segment: 'Equity' },

  // Mean Reversion Setups
  { id: 11, name: 'RELIANCE', setup: 'Mean Reversion', type: 'Buy', status: 'Closed', pnl: 1800, entry: 2880, exitPrice: 2916, sl: 2850, qty: 50, date: '2026-09-02 11:15:00', holdingDays: 1, rewardRisk: 1.2, segment: 'Equity' },
  { id: 12, name: 'TCS', setup: 'Mean Reversion', type: 'Buy', status: 'Closed', pnl: -1600, entry: 4180, exitPrice: 4148, sl: 4148, qty: 50, date: '2026-09-03 14:00:00', holdingDays: 1, rewardRisk: -1.0, segment: 'Equity' },
  { id: 13, name: 'INFY', setup: 'Mean Reversion', type: 'Buy', status: 'Closed', pnl: 2200, entry: 1820, exitPrice: 1864, sl: 1800, qty: 50, date: '2026-09-04 10:30:00', holdingDays: 1, rewardRisk: 2.2, segment: 'Equity' },
  { id: 14, name: 'HDFCBANK', setup: 'Mean Reversion', type: 'Buy', status: 'Closed', pnl: -1200, entry: 1620, exitPrice: 1608, sl: 1608, qty: 100, date: '2026-09-07 11:45:00', holdingDays: 0, rewardRisk: -1.0, segment: 'Equity' },
  { id: 15, name: 'ICICIBANK', setup: 'Mean Reversion', type: 'Buy', status: 'Closed', pnl: 2900, entry: 1180, exitPrice: 1209, sl: 1165, qty: 100, date: '2026-09-08 09:25:00', holdingDays: 2, rewardRisk: 1.93, segment: 'Equity' },
  { id: 16, name: 'SBIN', setup: 'Mean Reversion', type: 'Buy', status: 'Closed', pnl: -900, entry: 790, exitPrice: 781, sl: 781, qty: 100, date: '2026-09-09 13:20:00', holdingDays: 0, rewardRisk: -1.0, segment: 'Equity' },
  { id: 17, name: 'BHARTIARTL', setup: 'Mean Reversion', type: 'Buy', status: 'Closed', pnl: 3400, entry: 1460, exitPrice: 1494, sl: 1440, qty: 100, date: '2026-09-10 10:10:00', holdingDays: 3, rewardRisk: 1.7, segment: 'Equity' },
  { id: 18, name: 'LT', setup: 'Mean Reversion', type: 'Buy', status: 'Closed', pnl: -2500, entry: 3550, exitPrice: 3500, sl: 3500, qty: 50, date: '2026-09-11 14:40:00', holdingDays: 1, rewardRisk: -1.0, segment: 'Equity' },

  // Trend Pullback Setups
  { id: 19, name: 'NIFTY', setup: 'Trend Pullback', type: 'Buy', status: 'Closed', pnl: 7500, entry: 24800, exitPrice: 24950, sl: 24700, qty: 50, date: '2026-09-01 11:00:00', holdingDays: 0, rewardRisk: 1.5, segment: 'F&O' },
  { id: 20, name: 'NIFTY', setup: 'Trend Pullback', type: 'Buy', status: 'Closed', pnl: -5000, entry: 24900, exitPrice: 24800, sl: 24800, qty: 50, date: '2026-09-02 14:15:00', holdingDays: 0, rewardRisk: -1.0, segment: 'F&O' },
  { id: 21, name: 'BANKNIFTY', setup: 'Trend Pullback', type: 'Buy', status: 'Closed', pnl: 9200, entry: 51200, exitPrice: 51660, sl: 51000, qty: 20, date: '2026-09-03 09:45:00', holdingDays: 0, rewardRisk: 2.3, segment: 'F&O' },
  { id: 22, name: 'BANKNIFTY', setup: 'Trend Pullback', type: 'Buy', status: 'Closed', pnl: -6000, entry: 51500, exitPrice: 51200, sl: 51200, qty: 20, date: '2026-09-04 15:00:00', holdingDays: 0, rewardRisk: -1.0, segment: 'F&O' },
  { id: 23, name: 'NIFTY', setup: 'Trend Pullback', type: 'Buy', status: 'Closed', pnl: 6000, entry: 24750, exitPrice: 24870, sl: 24670, qty: 50, date: '2026-09-07 10:30:00', holdingDays: 0, rewardRisk: 1.5, segment: 'F&O' },
  { id: 24, name: 'BANKNIFTY', setup: 'Trend Pullback', type: 'Buy', status: 'Closed', pnl: 8400, entry: 51000, exitPrice: 51420, sl: 50800, qty: 20, date: '2026-09-08 11:10:00', holdingDays: 0, rewardRisk: 2.1, segment: 'F&O' },
  { id: 25, name: 'NIFTY', setup: 'Trend Pullback', type: 'Buy', status: 'Closed', pnl: -4500, entry: 24850, exitPrice: 24760, sl: 24760, qty: 50, date: '2026-09-09 14:50:00', holdingDays: 0, rewardRisk: -1.0, segment: 'F&O' },
  { id: 26, name: 'BANKNIFTY', setup: 'Trend Pullback', type: 'Buy', status: 'Closed', pnl: 11000, entry: 51300, exitPrice: 51850, sl: 51100, qty: 20, date: '2026-09-10 09:30:00', holdingDays: 0, rewardRisk: 2.75, segment: 'F&O' },

  // Scalp Setups
  { id: 27, name: 'RELIANCE', setup: 'Scalp', type: 'Buy', status: 'Closed', pnl: 950, entry: 2910, exitPrice: 2929, sl: 2900, qty: 50, date: '2026-09-01 12:15:00', holdingDays: 0, rewardRisk: 1.9, segment: 'Equity' },
  { id: 28, name: 'TCS', setup: 'Scalp', type: 'Buy', status: 'Closed', pnl: -800, entry: 4190, exitPrice: 4174, sl: 4174, qty: 50, date: '2026-09-02 12:45:00', holdingDays: 0, rewardRisk: -1.0, segment: 'Equity' },
  { id: 29, name: 'INFY', setup: 'Scalp', type: 'Buy', status: 'Closed', pnl: 1100, entry: 1830, exitPrice: 1852, sl: 1820, qty: 50, date: '2026-09-03 13:00:00', holdingDays: 0, rewardRisk: 2.2, segment: 'Equity' },
  { id: 30, name: 'HDFCBANK', setup: 'Scalp', type: 'Buy', status: 'Closed', pnl: -750, entry: 1630, exitPrice: 1622.5, sl: 1622.5, qty: 100, date: '2026-09-04 11:10:00', holdingDays: 0, rewardRisk: -1.0, segment: 'Equity' },
  { id: 31, name: 'SBIN', setup: 'Scalp', type: 'Buy', status: 'Closed', pnl: 850, entry: 795, exitPrice: 803.5, sl: 790, qty: 100, date: '2026-09-07 14:20:00', holdingDays: 0, rewardRisk: 1.7, segment: 'Equity' },
  { id: 32, name: 'ICICIBANK', setup: 'Scalp', type: 'Buy', status: 'Closed', pnl: -600, entry: 1190, exitPrice: 1184, sl: 1184, qty: 100, date: '2026-09-08 12:30:00', holdingDays: 0, rewardRisk: -1.0, segment: 'Equity' },
  { id: 33, name: 'BHARTIARTL', setup: 'Scalp', type: 'Buy', status: 'Closed', pnl: 1400, entry: 1470, exitPrice: 1484, sl: 1460, qty: 100, date: '2026-09-09 11:30:00', holdingDays: 0, rewardRisk: 1.4, segment: 'Equity' },
  { id: 34, name: 'LT', setup: 'Scalp', type: 'Buy', status: 'Closed', pnl: -1200, entry: 3580, exitPrice: 3556, sl: 3556, qty: 50, date: '2026-09-10 13:10:00', holdingDays: 0, rewardRisk: -1.0, segment: 'Equity' },
  { id: 35, name: 'KOTAKBANK', setup: 'Scalp', type: 'Buy', status: 'Closed', pnl: 1600, entry: 1790, exitPrice: 1806, sl: 1780, qty: 100, date: '2026-09-11 11:00:00', holdingDays: 0, rewardRisk: 1.6, segment: 'Equity' },
  { id: 36, name: 'AXISBANK', setup: 'Scalp', type: 'Buy', status: 'Closed', pnl: -950, entry: 1160, exitPrice: 1150.5, sl: 1150.5, qty: 100, date: '2026-09-14 12:00:00', holdingDays: 0, rewardRisk: -1.0, segment: 'Equity' },

  // Gap Fill Setups
  { id: 37, name: 'RELIANCE', setup: 'Gap Fill', type: 'Buy', status: 'Closed', pnl: 3200, entry: 2870, exitPrice: 2934, sl: 2840, qty: 50, date: '2026-09-14 09:20:00', holdingDays: 1, rewardRisk: 2.13, segment: 'Equity' },
  { id: 38, name: 'TCS', setup: 'Gap Fill', type: 'Buy', status: 'Closed', pnl: -2400, entry: 4160, exitPrice: 4112, sl: 4112, qty: 50, date: '2026-09-15 09:25:00', holdingDays: 0, rewardRisk: -1.0, segment: 'Equity' },
  { id: 39, name: 'INFY', setup: 'Gap Fill', type: 'Buy', status: 'Closed', pnl: 2750, entry: 1810, exitPrice: 1865, sl: 1790, qty: 50, date: '2026-09-15 09:30:00', holdingDays: 1, rewardRisk: 2.75, segment: 'Equity' },
  { id: 40, name: 'HDFCBANK', setup: 'Gap Fill', type: 'Buy', status: 'Closed', pnl: -1400, entry: 1610, exitPrice: 1596, sl: 1596, qty: 100, date: '2026-09-16 09:20:00', holdingDays: 0, rewardRisk: -1.0, segment: 'Equity' },
  { id: 41, name: 'ICICIBANK', setup: 'Gap Fill', type: 'Buy', status: 'Closed', pnl: 3800, entry: 1170, exitPrice: 1208, sl: 1155, qty: 100, date: '2026-09-16 09:45:00', holdingDays: 1, rewardRisk: 2.53, segment: 'Equity' },
  { id: 42, name: 'SBIN', setup: 'Gap Fill', type: 'Buy', status: 'Closed', pnl: -1100, entry: 785, exitPrice: 774, sl: 774, qty: 100, date: '2026-09-17 09:20:00', holdingDays: 0, rewardRisk: -1.0, segment: 'Equity' },

  // Breakeven Closed Trade (pl === 0)
  { id: 43, name: 'BHARTIARTL', setup: 'Breakout', type: 'Buy', status: 'Closed', pnl: 0, entry: 1480, exitPrice: 1480, sl: 1465, qty: 100, date: '2026-09-17 14:00:00', holdingDays: 0, rewardRisk: 0, segment: 'Equity' },

  // Partial Trades (Open remaining qty, some booked P/L)
  { id: 44, name: 'RELIANCE', setup: 'Breakout', type: 'Buy', status: 'Partial', pnl: 2500, entry: 2920, exitPrice: 2970, sl: 2920, qty: 50, openQty: 25, date: '2026-09-18 10:00:00', holdingDays: 1, rewardRisk: 1.5, segment: 'Equity' },
  { id: 45, name: 'TCS', setup: 'Trend Pullback', type: 'Buy', status: 'Partial', pnl: -1000, entry: 4210, exitPrice: 4190, sl: 4170, qty: 50, openQty: 25, date: '2026-09-18 13:00:00', holdingDays: 1, rewardRisk: -0.5, segment: 'Equity' },

  // Completely Open Positions (Unrealized P/L)
  { id: 46, name: 'INFY', setup: 'Breakout', type: 'Buy', status: 'Open', pnl: 1500, entry: 1840, cmp: 1870, sl: 1810, qty: 50, openQty: 50, date: '2026-09-21 09:30:00', holdingDays: 2, rewardRisk: 1.0, segment: 'Equity' },
  { id: 47, name: 'HDFCBANK', setup: 'Mean Reversion', type: 'Buy', status: 'Open', pnl: -800, entry: 1640, cmp: 1632, sl: 1615, qty: 100, openQty: 100, date: '2026-09-21 11:00:00', holdingDays: 2, rewardRisk: -0.32, segment: 'Equity' },
  { id: 48, name: 'ICICIBANK', setup: 'Breakout', type: 'Buy', status: 'Open', pnl: 2200, entry: 1210, cmp: 1232, sl: 1195, qty: 100, openQty: 100, date: '2026-09-22 09:45:00', holdingDays: 1, rewardRisk: 1.47, segment: 'Equity' },
  { id: 49, name: 'NIFTY', setup: 'Trend Pullback', type: 'Buy', status: 'Open', pnl: 3500, entry: 24900, cmp: 24970, sl: 24820, qty: 50, openQty: 50, date: '2026-09-22 14:00:00', holdingDays: 0, rewardRisk: 0.88, segment: 'F&O' },
  { id: 50, name: 'BANKNIFTY', setup: 'Scalp', type: 'Buy', status: 'Open', pnl: -2400, entry: 51600, cmp: 51480, sl: 51350, qty: 20, openQty: 20, date: '2026-09-22 15:00:00', holdingDays: 0, rewardRisk: -0.48, segment: 'F&O' }
];

// --- Independent Mathematical Ground Truth Computations ---

// Pure closed trades (excluding Partial and Open)
const strictlyClosedTrades = RAW_TEST_TRADES.filter(t => t.status === 'Closed');
const closedWithNonZeroPnl = strictlyClosedTrades.filter(t => t.pnl !== 0);

const groundTruthWins = strictlyClosedTrades.filter(t => t.pnl > 0);
const groundTruthLosses = strictlyClosedTrades.filter(t => t.pnl < 0);
const groundTruthGrossWin = groundTruthWins.reduce((s, t) => s + t.pnl, 0);
const groundTruthGrossLoss = Math.abs(groundTruthLosses.reduce((s, t) => s + t.pnl, 0));
const groundTruthTotalClosedPnl = strictlyClosedTrades.reduce((s, t) => s + t.pnl, 0);
const groundTruthClosedWinRate = Number(((groundTruthWins.length / closedWithNonZeroPnl.length) * 100).toFixed(1));
const groundTruthProfitFactor = Number((groundTruthGrossWin / groundTruthGrossLoss).toFixed(2));
const groundTruthAvgWin = Number((groundTruthGrossWin / groundTruthWins.length).toFixed(2));
const groundTruthAvgLoss = Number((groundTruthGrossLoss / groundTruthLosses.length).toFixed(2));

// Expectancy R
const closedWithR = strictlyClosedTrades.filter(t => t.rewardRisk !== null && t.rewardRisk !== undefined && t.rewardRisk !== 0);
const avgWinR = groundTruthWins.reduce((s, t) => s + (t.rewardRisk || 0), 0) / groundTruthWins.length;
const avgLossR = Math.abs(groundTruthLosses.reduce((s, t) => s + (t.rewardRisk || 0), 0) / groundTruthLosses.length);
const winRateFraction = groundTruthWins.length / (groundTruthWins.length + groundTruthLosses.length);
const groundTruthExpectancyR = Number((winRateFraction * avgWinR - (1 - winRateFraction) * avgLossR).toFixed(2));

// Breakout Setup Closed Ground Truth
const breakoutClosed = strictlyClosedTrades.filter(t => t.setup === 'Breakout');
const breakoutWins = breakoutClosed.filter(t => t.pnl > 0);
const breakoutLosses = breakoutClosed.filter(t => t.pnl < 0);
const breakoutWinRate = Number(((breakoutWins.length / (breakoutWins.length + breakoutLosses.length)) * 100).toFixed(1));
const breakoutTotalPnl = breakoutClosed.reduce((s, t) => s + t.pnl, 0);

// Day of Week Ground Truth (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
function getDay(t) { return new Date(t.date).getDay(); }
const mondayClosed = strictlyClosedTrades.filter(t => getDay(t) === 1);
const mondayWins = mondayClosed.filter(t => t.pnl > 0);
const mondayLosses = mondayClosed.filter(t => t.pnl < 0);
const mondayWinRate = Number(((mondayWins.length / (mondayWins.length + mondayLosses.length)) * 100).toFixed(1));

const wednesdayClosed = strictlyClosedTrades.filter(t => getDay(t) === 3);
const wednesdayWins = wednesdayClosed.filter(t => t.pnl > 0);
const wednesdayLosses = wednesdayClosed.filter(t => t.pnl < 0);
const wednesdayWinRate = Number(((wednesdayWins.length / (wednesdayWins.length + wednesdayLosses.length)) * 100).toFixed(1));

// Hour Ground Truth
function getHour(t) { return new Date(t.date).getHours(); }
const hour9Trades = RAW_TEST_TRADES.filter(t => getHour(t) === 9);
const hour9TotalPnl = hour9Trades.reduce((s, t) => s + (t.pnl || 0), 0);

// Max Drawdown calculation over chronological closed trades
const chronoSorted = [...strictlyClosedTrades].sort((a, b) => new Date(a.date) - new Date(b.date));
let peakCum = 0;
let cum = 0;
let maxShortfall = 0;
for (const t of chronoSorted) {
  cum += t.pnl;
  if (cum > peakCum) peakCum = cum;
  const shortfall = peakCum - cum;
  if (shortfall > maxShortfall) maxShortfall = shortfall;
}

// Streaks
let curWinStreak = 0, maxWinStreak = 0;
let curLossStreak = 0, maxLossStreak = 0;
for (const t of chronoSorted) {
  if (t.pnl > 0) {
    curWinStreak++;
    curLossStreak = 0;
    if (curWinStreak > maxWinStreak) maxWinStreak = curWinStreak;
  } else if (t.pnl < 0) {
    curLossStreak++;
    curWinStreak = 0;
    if (curLossStreak > maxLossStreak) maxLossStreak = curLossStreak;
  }
}

// -------------------------------------------------------------
// Test Suite Definition: 32+ Deterministic Questions
// -------------------------------------------------------------
export const GOLDEN_TESTS = [
  {
    id: 1,
    name: 'Total Trades Count (All Statuses)',
    spec: { aggregations: ['count'] },
    expected: { count: 50 }
  },
  {
    id: 2,
    name: 'Closed Trades Count',
    spec: { filters: [{ field: 'status', op: 'eq', value: 'Closed' }], aggregations: ['count'] },
    expected: { count: 43 }
  },
  {
    id: 3,
    name: 'Open Trades Count',
    spec: { filters: [{ field: 'status', op: 'eq', value: 'Open' }], aggregations: ['count'] },
    expected: { count: 5 }
  },
  {
    id: 4,
    name: 'Partial Trades Count',
    spec: { filters: [{ field: 'status', op: 'eq', value: 'Partial' }], aggregations: ['count'] },
    expected: { count: 2 }
  },
  {
    id: 5,
    name: 'Total Closed PnL',
    spec: { filters: [{ field: 'status', op: 'eq', value: 'Closed' }], aggregations: ['totalPnl'] },
    expected: { totalPnl: groundTruthTotalClosedPnl }
  },
  {
    id: 6,
    name: 'Closed Win Rate % (Nexus Ground Truth)',
    spec: { filters: [{ field: 'status', op: 'eq', value: 'Closed' }], aggregations: ['winRate'] },
    expected: { winRate: groundTruthClosedWinRate }
  },
  {
    id: 7,
    name: 'Closed Profit Factor',
    spec: { filters: [{ field: 'status', op: 'eq', value: 'Closed' }], aggregations: ['profitFactor'] },
    expected: { profitFactor: groundTruthProfitFactor }
  },
  {
    id: 8,
    name: 'Average Winning Trade PnL',
    spec: { filters: [{ field: 'status', op: 'eq', value: 'Closed' }], aggregations: ['avgWin'] },
    expected: { avgWin: groundTruthAvgWin }
  },
  {
    id: 9,
    name: 'Average Losing Trade PnL',
    spec: { filters: [{ field: 'status', op: 'eq', value: 'Closed' }], aggregations: ['avgLoss'] },
    expected: { avgLoss: groundTruthAvgLoss }
  },
  {
    id: 10,
    name: 'Trade Expectancy in R',
    spec: { filters: [{ field: 'status', op: 'eq', value: 'Closed' }], aggregations: ['expectancy'] },
    expected: { expectancy: groundTruthExpectancyR }
  },
  {
    id: 11,
    name: 'Max Drawdown Shortfall',
    spec: { filters: [{ field: 'status', op: 'eq', value: 'Closed' }], aggregations: ['maxDrawdown'] },
    expected: { maxDrawdown: maxShortfall }
  },
  {
    id: 12,
    name: 'Max Consecutive Win Streak',
    spec: { filters: [{ field: 'status', op: 'eq', value: 'Closed' }], aggregations: ['streaks'] },
    expected: { maxWinStreak: maxWinStreak }
  },
  {
    id: 13,
    name: 'Max Consecutive Loss Streak',
    spec: { filters: [{ field: 'status', op: 'eq', value: 'Closed' }], aggregations: ['streaks'] },
    expected: { maxLossStreak: maxLossStreak }
  },
  {
    id: 14,
    name: 'Breakout Setup Win Rate',
    spec: { filters: [{ field: 'status', op: 'eq', value: 'Closed' }, { field: 'setup', op: 'eq', value: 'Breakout' }], aggregations: ['winRate', 'count'] },
    expected: { winRate: breakoutWinRate, count: 11 }
  },
  {
    id: 15,
    name: 'Breakout Setup Total PnL',
    spec: { filters: [{ field: 'status', op: 'eq', value: 'Closed' }, { field: 'setup', op: 'eq', value: 'Breakout' }], aggregations: ['totalPnl'] },
    expected: { totalPnl: breakoutTotalPnl }
  },
  {
    id: 16,
    name: 'Monday Closed Trades Win Rate',
    spec: { filters: [{ field: 'status', op: 'eq', value: 'Closed' }, { field: 'dayOfWeek', op: 'eq', value: 1 }], aggregations: ['winRate', 'count'] },
    expected: { winRate: mondayWinRate, count: 6 }
  },
  {
    id: 17,
    name: 'Wednesday Closed Trades Win Rate',
    spec: { filters: [{ field: 'status', op: 'eq', value: 'Closed' }, { field: 'dayOfWeek', op: 'eq', value: 3 }], aggregations: ['winRate', 'count'] },
    expected: { winRate: wednesdayWinRate, count: 10 }
  },
  {
    id: 18,
    name: 'Hour of Day Filtering: 09:xx Trades Total PnL',
    spec: { filters: [{ field: 'hour', op: 'eq', value: 9 }], aggregations: ['totalPnl', 'count'] },
    expected: { totalPnl: hour9TotalPnl, count: hour9Trades.length }
  },
  {
    id: 19,
    name: 'Group By Setup (Breakout, Mean Reversion, Scalp, Trend Pullback, Gap Fill)',
    spec: { groupBy: 'setup', aggregations: ['count'] },
    verify: (results) => {
      if (!Array.isArray(results) || results.length < 5) return false;
      const breakoutRow = results.find(r => r.group === 'Breakout');
      return breakoutRow && breakoutRow.count === 14; // 11 closed + 1 partial + 2 open
    }
  },
  {
    id: 20,
    name: 'Group By DayOfWeek (0 to 6)',
    spec: { groupBy: 'dayOfWeek', aggregations: ['count'] },
    verify: (results) => {
      const mon = results.find(r => r.group === 'Monday');
      return mon && mon.count >= 8;
    }
  },
  {
    id: 21,
    name: 'Group By Hour (9, 10, 11, 12, 13, 14, 15)',
    spec: { groupBy: 'hour', aggregations: ['count', 'totalPnl'] },
    verify: (results) => {
      const h9 = results.find(r => r.group === '9' || r.group === '09:00 - 10:00' || r.group === 9);
      return h9 && h9.count === hour9Trades.length;
    }
  },
  {
    id: 22,
    name: 'Numeric String Comparison: pnl > "9" (Must not fail on 1000 due to string comparison)',
    spec: { filters: [{ field: 'pnl', op: 'gt', value: '9' }], aggregations: ['count'] },
    verify: (results) => {
      const actualCount = results[0]?.count;
      const groundCount = RAW_TEST_TRADES.filter(t => t.pnl > 9).length;
      return actualCount === groundCount;
    }
  },
  {
    id: 23,
    name: 'Numeric String Comparison: pnl > "1000"',
    spec: { filters: [{ field: 'pnl', op: 'gt', value: '1000' }], aggregations: ['count'] },
    verify: (results) => {
      const actualCount = results[0]?.count;
      const groundCount = RAW_TEST_TRADES.filter(t => t.pnl > 1000).length;
      return actualCount === groundCount;
    }
  },
  {
    id: 24,
    name: 'Negative Number Comparison: pnl < "-1000"',
    spec: { filters: [{ field: 'pnl', op: 'lt', value: '-1000' }], aggregations: ['count'] },
    verify: (results) => {
      const actualCount = results[0]?.count;
      const groundCount = RAW_TEST_TRADES.filter(t => t.pnl < -1000).length;
      return actualCount === groundCount;
    }
  },
  {
    id: 25,
    name: 'Currency Symbol Parsing: pnl > "₹2,000"',
    spec: { filters: [{ field: 'pnl', op: 'gt', value: '₹2,000' }], aggregations: ['count'] },
    verify: (results) => {
      const actualCount = results[0]?.count;
      const groundCount = RAW_TEST_TRADES.filter(t => t.pnl > 2000).length;
      return actualCount === groundCount;
    }
  },
  {
    id: 26,
    name: 'Exact Date Filter: date eq "2026-09-15"',
    spec: { filters: [{ field: 'date', op: 'eq', value: '2026-09-15' }], aggregations: ['count'] },
    verify: (results) => {
      const actualCount = results[0]?.count;
      // In RAW_TEST_TRADES, trades on 2026-09-15 are id 38 (TCS) and id 39 (INFY)
      return actualCount === 2;
    }
  },
  {
    id: 27,
    name: 'Date Range Filter: dateFrom "2026-09-01" to dateTo "2026-09-07"',
    spec: { filters: [{ field: 'dateFrom', value: '2026-09-01' }, { field: 'dateTo', value: '2026-09-07' }], aggregations: ['count'] },
    verify: (results) => {
      const actualCount = results[0]?.count;
      // Exactly 20 trades fall between 2026-09-01 00:00:00 and 2026-09-07 23:59:59
      return actualCount === 20;
    }
  },
  {
    id: 28,
    name: 'Symbol Filter: RELIANCE Only',
    spec: { filters: [{ field: 'symbol', op: 'eq', value: 'RELIANCE' }], aggregations: ['count'] },
    verify: (results) => {
      const actualCount = results[0]?.count;
      const groundCount = RAW_TEST_TRADES.filter(t => t.name === 'RELIANCE').length;
      return actualCount === groundCount;
    }
  },
  {
    id: 29,
    name: 'Segment Filter: F&O Only',
    spec: { filters: [{ field: 'segment', op: 'eq', value: 'F&O' }], aggregations: ['count'] },
    verify: (results) => {
      const actualCount = results[0]?.count;
      const groundCount = RAW_TEST_TRADES.filter(t => t.segment === 'F&O').length;
      return actualCount === groundCount;
    }
  },
  {
    id: 30,
    name: 'Limit Clamp Guard: Request 5000 Rows (Must clamp to max 50)',
    spec: { returnRows: true, limit: 5000 },
    verify: (results) => {
      // Must be capped at <= 50 rows
      return Array.isArray(results) && results.length <= 50;
    }
  },
  {
    id: 31,
    name: 'Holding Days Filter: holdingDays >= 2',
    spec: { filters: [{ field: 'holdingDays', op: 'gte', value: 2 }], aggregations: ['count'] },
    verify: (results) => {
      const actualCount = results[0]?.count;
      const groundCount = RAW_TEST_TRADES.filter(t => (t.holdingDays || 0) >= 2).length;
      return actualCount === groundCount;
    }
  },
  {
    id: 32,
    name: 'Markdown Table Output Check: executeQueryAndFormat produces valid table',
    spec: { groupBy: 'setup', aggregations: ['count', 'winRate', 'totalPnl'] },
    customTest: () => {
      const md = executeQueryAndFormat(RAW_TEST_TRADES, { groupBy: 'setup', aggregations: ['count', 'winRate', 'totalPnl'] });
      return typeof md === 'string' && md.includes('| group | count |') && md.includes('Breakout');
    }
  }
];

// --- Test Runner Function ---
export function runGoldenTests() {
  console.log('='.repeat(80));
  console.log('   FOXTRADE FOXY AI — GOLDEN TEST SUITE (32 DETERMINISTIC TESTS)');
  console.log('='.repeat(80));

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const t of GOLDEN_TESTS) {
    try {
      if (t.customTest) {
        const ok = t.customTest();
        if (ok) {
          console.log(`[PASS] Test ${String(t.id).padStart(2, ' ')}: ${t.name}`);
          passed++;
        } else {
          console.log(`[FAIL] Test ${String(t.id).padStart(2, ' ')}: ${t.name} (Custom check failed)`);
          failed++;
          failures.push({ id: t.id, name: t.name, reason: 'Custom check failed' });
        }
        continue;
      }

      const results = runQuery(RAW_TEST_TRADES, t.spec);
      let ok = true;
      let failureReason = '';

      if (t.verify) {
        ok = t.verify(results);
        if (!ok) failureReason = `Verification function returned false. Got: ${JSON.stringify(results)}`;
      } else if (t.expected) {
        const row = results[0] || {};
        for (const [key, expVal] of Object.entries(t.expected)) {
          const actVal = row[key];
          // Allow minor floating point tolerance
          const matches = (typeof expVal === 'number' && typeof actVal === 'number')
            ? Math.abs(expVal - actVal) < 0.15
            : actVal === expVal;
          if (!matches) {
            ok = false;
            failureReason = `Field [${key}] expected ${expVal} but got ${actVal}`;
            break;
          }
        }
      }

      if (ok) {
        console.log(`[PASS] Test ${String(t.id).padStart(2, ' ')}: ${t.name}`);
        passed++;
      } else {
        console.log(`[FAIL] Test ${String(t.id).padStart(2, ' ')}: ${t.name} -> ${failureReason}`);
        failed++;
        failures.push({ id: t.id, name: t.name, reason: failureReason });
      }
    } catch (err) {
      console.log(`[ERROR] Test ${String(t.id).padStart(2, ' ')}: ${t.name} -> ${err.message}`);
      failed++;
      failures.push({ id: t.id, name: t.name, reason: err.message });
    }
  }

  console.log('-'.repeat(80));
  console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED | TOTAL: ${GOLDEN_TESTS.length}`);
  console.log('='.repeat(80));

  return { passed, failed, total: GOLDEN_TESTS.length, failures };
}

// Auto-run if executed directly via Node
if (process.argv[1]?.endsWith('foxyGoldenTest.js')) {
  const result = runGoldenTests();
  process.exit(result.failed > 0 ? 1 : 0);
}
