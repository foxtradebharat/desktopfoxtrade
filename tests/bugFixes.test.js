import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { calculateCharges, parseChargesCSV } from '../src/utils/brokerChargesService.js';
import { normalizeBrokerId } from '../src/utils/brokerIds.js';

describe('Fix 3: Broker Charges & Zero Taxes Fix', () => {
  const csvPath = path.resolve(__dirname, '../src/data/broker_charges.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const chargesMap = parseChargesCSV(csvContent);

  it('calculates exact Indian delivery charges for Zerodha Kite alias matching zerodha', () => {
    // Turnover: Buy 20 @ 2,500 = 50,000; Sell 20 @ 2,620 = 52,400. Total = 1,02,400
    const resKite = calculateCharges('Zerodha Kite', 'delivery', 50000, 52400, 20, chargesMap);
    const resZerodha = calculateCharges('zerodha', 'delivery', 50000, 52400, 20, chargesMap);

    expect(resKite.hasCharges).toBe(true);
    expect(resKite.brokerage).toBe(0);
    expect(resKite.stt).toBe(102);
    expect(resKite.exchangeFee).toBe(3.3);
    expect(resKite.gst).toBe(0.61);
    expect(resKite.sebi).toBe(0.1);
    expect(resKite.stampDuty).toBe(7.5);
    expect(resKite.total).toBe(113.51);

    expect(resKite).toEqual(resZerodha);
  });

  it('returns unknown_broker when an unrecognized broker is provided', () => {
    const res = calculateCharges('SomeForeignBroker', 'delivery', 50000, 52400, 20, chargesMap);
    expect(res.hasCharges).toBe(false);
    expect(res.reason).toBe('unknown_broker');
    expect(res.total).toBe(0);
  });

  it('returns no_rate_card when broker is known but segment is missing in chargesMap', () => {
    const res = calculateCharges('zerodha', 'non_existent_segment', 50000, 52400, 20, chargesMap);
    expect(res.hasCharges).toBe(false);
    expect(res.reason).toBe('no_rate_card');
  });

  it('returns empty with hasCharges false when broker is not_defined', () => {
    const res = calculateCharges('not_defined', 'delivery', 50000, 52400, 20, chargesMap);
    expect(res.hasCharges).toBe(false);
    expect(res.total).toBe(0);
  });
});

import { calculateMonthlyPerformance } from '../src/utils/fundManagementCalculations.js';

describe('Fix 2: Zero-Capital Compounding & Fund Management Fix', () => {
  const fixtureTrades = [
    { status: 'Closed', pnl: 14335, exitDate: '15-01-2026' },
    { status: 'Closed', pnl: 9450, exitDate: '15-02-2026' },
    { status: 'Closed', pnl: 20825, exitDate: '15-03-2026' },
    { status: 'Closed', pnl: 13585, exitDate: '15-04-2026' },
    { status: 'Closed', pnl: 10700, exitDate: '15-05-2026' },
    { status: 'Closed', pnl: 2000, exitDate: '15-06-2026' },
  ];

  it('nulls pctPl and cagr when there is no ledger and no base capital (prevents 9,000% CAGR)', () => {
    const months = calculateMonthlyPerformance(fixtureTrades, {}, '2026', {
      baseCapital: 0,
      skipPrevYearLookup: true
    });

    months.forEach(m => {
      expect(m.capitalIsReal).toBe(false);
      expect(m.startingCapital).toBe(null);
      expect(m.finalCapital).toBe(null);
      expect(m.pctPl).toBe(null);
      expect(m.cagr).toBe(null);
    });
  });

  it('compounds correctly on ₹10L base capital matching benchmark fixture', () => {
    const months = calculateMonthlyPerformance(fixtureTrades, {}, '2026', {
      baseCapital: 1000000,
      skipPrevYearLookup: true
    });

    // Jan
    expect(months[0].startingCapital).toBe(1000000);
    expect(months[0].pctPl).toBe(1.43);
    expect(months[0].finalCapital).toBe(1014335);

    // Feb
    expect(months[1].startingCapital).toBe(1014335);
    expect(months[1].pctPl).toBe(0.93);
    expect(months[1].finalCapital).toBe(1023785);

    // Mar
    expect(months[2].startingCapital).toBe(1023785);
    expect(months[2].pctPl).toBe(2.03);
    expect(months[2].finalCapital).toBe(1044610);

    // Apr
    expect(months[3].startingCapital).toBe(1044610);
    expect(months[3].pctPl).toBe(1.30);
    expect(months[3].finalCapital).toBe(1058195);

    // May
    expect(months[4].startingCapital).toBe(1058195);
    expect(months[4].pctPl).toBe(1.01);
    expect(months[4].finalCapital).toBe(1068895);

    // Jun
    expect(months[5].startingCapital).toBe(1068895);
    expect(months[5].pctPl).toBe(0.19);
    expect(months[5].finalCapital).toBe(1070895);
  });
});

import { computeDrawdown } from '../src/utils/drawdown.js';
import { getStartingCapitalBasis } from '../src/utils/fundManagementCalculations.js';

describe('Fix 1: Drawdown Calculation Fix', () => {
  it('calculates exact drawdown against peak equity on ₹10L base capital (+1000, -500 gives -0.05%)', () => {
    const res = computeDrawdown([1000, -500], 1000000);
    expect(res.available).toBe(true);
    expect(res.peakEquity).toBe(1001000);
    expect(res.equity).toBe(1000500);
    expect(res.currentAmount).toBe(-500);
    expect(res.currentPct.toFixed(2)).toBe('-0.05');
    expect(res.maxPct.toFixed(2)).toBe('-0.05');
  });

  it('calculates exact drawdown against peak equity on ₹10L base capital (+1000, -1000 gives -0.10%)', () => {
    const res = computeDrawdown([1000, -1000], 1000000);
    expect(res.available).toBe(true);
    expect(res.peakEquity).toBe(1001000);
    expect(res.equity).toBe(1000000);
    expect(res.currentAmount).toBe(-1000);
    expect(res.currentPct.toFixed(2)).toBe('-0.10');
    expect(res.maxPct.toFixed(2)).toBe('-0.10');
  });

  it('returns available: false when starting capital is null, 0, or negative', () => {
    expect(computeDrawdown([1000, -500], null).available).toBe(false);
    expect(computeDrawdown([1000, -500], 0).available).toBe(false);
    expect(computeDrawdown([1000, -500], -50000).available).toBe(false);
  });

  it('getStartingCapitalBasis returns null when no base capital and no deposits', () => {
    const basis = getStartingCapitalBasis([], {}, '2026', { baseCapital: 0, skipPrevYearLookup: true });
    expect(basis).toBe(null);
  });

  it('getStartingCapitalBasis returns ₹10L when base capital is provided', () => {
    const basis = getStartingCapitalBasis([], {}, '2026', { baseCapital: 1000000, skipPrevYearLookup: true });
    expect(basis).toBe(1000000);
  });
});

import { computeClosedMetrics, computePartialSummary } from '../src/utils/tradeMetricsShared.js';

describe('Fix 4: Cross-Page Metric Parity Fix', () => {
  it('computeClosedMetrics returns identical results for Analytics and Deep Analytics inputs', () => {
    // 20 wins, 20 losses, 5 partials, 5 opens
    const sampleTrades = [];
    for (let i = 1; i <= 20; i++) {
      sampleTrades.push({ tradeNo: i, status: 'Closed', pnl: 4356, rewardRisk: (i === 1 ? 3.86 : 1.5) });
    }
    for (let i = 21; i <= 40; i++) {
      sampleTrades.push({ tradeNo: i, status: 'Closed', pnl: -1306.25, rewardRisk: -1.0 });
    }
    // 5 partial trades with high R (e.g. 5.87) that must NOT leak into closed metrics
    for (let i = 41; i <= 45; i++) {
      sampleTrades.push({ tradeNo: i, status: 'Partial', pnl: 1980, rewardRisk: 5.87 });
    }
    // 5 open trades
    for (let i = 46; i <= 50; i++) {
      sampleTrades.push({ tradeNo: i, status: 'Open', pnl: 0, rewardRisk: 0 });
    }

    const m = computeClosedMetrics(sampleTrades);
    expect(m.closedCount).toBe(40);
    expect(m.winCount).toBe(20);
    expect(m.lossCount).toBe(20);
    expect(m.grossWin).toBe(87120);
    expect(m.grossLoss).toBe(26125);
    expect(m.avgWin).toBe(4356);
    expect(m.avgLoss).toBe(1306.25);
    expect(Number(m.profitFactor.toFixed(2))).toBe(3.33);
    expect(Number(m.expectancy.toFixed(2))).toBe(1524.88);
    // Highest R MUST be 3.86 from closed trades, NOT 5.87 from partial
    expect(m.highestR).toBe(3.86);
    expect(m.highestRTrade.tradeNo).toBe(1);

    // Partial trades are isolated in computePartialSummary
    const p = computePartialSummary(sampleTrades);
    expect(p.count).toBe(5);
    expect(p.realizedPnl).toBe(5 * 1980);
  });
});

import {
  computeSharpe,
  generateTradingCalendarDays,
  getRealizedExitDate,
  toLocalDayKey,
  RISK_FREE_ANNUAL,
  isClosedTrade,
  isPartialTrade
} from '../src/utils/tradeMetricsShared.js';

describe('Fix 5: Sharpe Ratio & Trading Calendar Days Fix', () => {
  it('returns available: false with reason no_capital when capital is missing or non-positive', () => {
    const days = Array.from({ length: 25 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);
    const events = [{ dayKey: '2026-01-05', pnl: 5000 }];

    expect(computeSharpe(events, null, days)).toEqual({ available: false, reason: 'no_capital' });
    expect(computeSharpe(events, 0, days)).toEqual({ available: false, reason: 'no_capital' });
    expect(computeSharpe(events, -100000, days)).toEqual({ available: false, reason: 'no_capital' });
  });

  it('returns available: false with reason insufficient_days when trading calendar days < 20', () => {
    const days = ['2026-01-01', '2026-01-02', '2026-01-05'];
    const events = [{ dayKey: '2026-01-02', pnl: 5000 }];
    const res = computeSharpe(events, 1000000, days);
    expect(res.available).toBe(false);
    expect(res.reason).toBe('insufficient_days');
    expect(res.days).toBe(3);
  });

  it('aggregates same-day trades in rupees rather than summing percentages', () => {
    // Generate 25 days
    const days = Array.from({ length: 25 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);
    // On 2026-01-05, trade A wins 3000, trade B loses 1000 -> net +2000
    const events = [
      { dayKey: '2026-01-05', pnl: 3000 },
      { dayKey: '2026-01-05', pnl: -1000 },
      { dayKey: '2026-01-10', pnl: 1500 },
    ];
    // With 22 zero-days and two active days (+2000 and +1500)
    const res = computeSharpe(events, 1000000, days, 0);
    expect(res.available).toBe(true);
    expect(res.days).toBe(25);
    // Mean daily return = (2000/1000000 + 1500/1002000) / 25
    const expectedPnlSum = 2000 / 1000000 + 1500 / 1002000;
    expect(res.meanDailyReturn).toBeCloseTo(expectedPnlSum / 25, 6);
  });

  it('adding zero-return calendar days lowers Sharpe ratio', () => {
    // Series A: 25 consecutive winning trading days
    const daysA = Array.from({ length: 25 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);
    const eventsA = daysA.map(d => ({ dayKey: d, pnl: 2000 }));
    const resA = computeSharpe(eventsA, 1000000, daysA, 0);

    // Series B: same 25 winning events but spread across 50 calendar days (25 zero days)
    const daysB = Array.from({ length: 50 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);
    const resB = computeSharpe(eventsA, 1000000, daysB, 0);

    expect(resA.available).toBe(true);
    expect(resB.available).toBe(true);
    expect(resB.sharpe).toBeLessThan(resA.sharpe);
  });

  it('strictly excludes open trades from exit dates and realized events', () => {
    // Open trades must return null
    expect(getRealizedExitDate({ status: 'Open', date: '2026-01-05', entry: 100, qty: 10 })).toBeNull();
    expect(getRealizedExitDate({ status: 'open', date: '2026-01-05', pnl: 2000 })).toBeNull();
    expect(getRealizedExitDate({ status: 'Partial', exitedQty: 0, date: '2026-01-05' })).toBeNull();

    // Closed trades return exitDate or exit leg
    const closedWithExit = getRealizedExitDate({ status: 'Closed', exitDate: '2026-01-15' });
    expect(toLocalDayKey(closedWithExit)).toBe('2026-01-15');

    const closedWithLegs = getRealizedExitDate({
      status: 'Closed',
      e1Date: '2026-01-10',
      e1Qty: 50,
      e2Date: '2026-01-20',
      e2Qty: 50
    });
    expect(toLocalDayKey(closedWithLegs)).toBe('2026-01-20');

    // Partial trade with exit leg returns the exit leg
    const partialWithExit = getRealizedExitDate({
      status: 'Partial',
      exitedQty: 25,
      e1Date: '2026-02-12',
      e1Qty: 25
    });
    expect(toLocalDayKey(partialWithExit)).toBe('2026-02-12');
  });

  it('calendar generator skips weekends and specified holidays', () => {
    // 2026-01-02 (Fri) to 2026-01-06 (Tue)
    // Sat = Jan 3, Sun = Jan 4. Holiday = Jan 5 (e.g. test holiday)
    const start = new Date(2026, 0, 2);
    const end = new Date(2026, 0, 6);
    const days = generateTradingCalendarDays(start, end, ['2026-01-05']);

    expect(days).toEqual(['2026-01-02', '2026-01-06']);
  });

  it('verifies 50-trade golden benchmark Sharpe ratio is below 8.27 (~5.37 at rf=0%, ~3.32 at rf=6.5%)', () => {
    const csvContent = fs.readFileSync(path.resolve(__dirname, '../nexus-50-golden-trades.csv'), 'utf8');
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');
    const trades = lines.slice(1).map(line => {
      const vals = line.split(',');
      const obj = {};
      headers.forEach((h, i) => obj[h.trim()] = vals[i]?.trim());
      return obj;
    });

    // 50 total trades in benchmark
    expect(trades.length).toBe(50);

    const realizedTrades = trades.filter(t => isClosedTrade(t) || (isPartialTrade(t) && Number(t.exitedQty) > 0));
    expect(realizedTrades.length).toBe(45); // 40 closed + 5 partial

    const events = [];
    const exitDayKeysSet = new Set();
    realizedTrades.forEach(t => {
      const pl = Number(t.pnl || t.pl || 0);
      const exitD = getRealizedExitDate(t);
      if (exitD) {
        const dayKey = toLocalDayKey(exitD);
        events.push({ dayKey, pnl: pl, date: exitD });
        exitDayKeysSet.add(dayKey);
      }
    });

    // 5 Open trades add 0 exit days; exactly 41 active exit days
    expect(exitDayKeysSet.size).toBe(41);

    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    const firstDate = events[0].date;
    const lastDate = events[events.length - 1].date;

    const calendarDays = generateTradingCalendarDays(firstDate, lastDate);
    expect(calendarDays.length).toBeGreaterThan(100);

    const resRf0 = computeSharpe(events, 1000000, calendarDays, 0);
    expect(resRf0.available).toBe(true);
    // Sharpe is clearly below 8.27 (around 5.37)
    expect(resRf0.sharpe).toBeLessThan(6.0);
    expect(resRf0.sharpe).toBeGreaterThan(5.0);
    expect(Number(resRf0.sharpe.toFixed(2))).toBe(5.37);

    const resRf65 = computeSharpe(events, 1000000, calendarDays, RISK_FREE_ANNUAL);
    expect(resRf65.available).toBe(true);
    expect(Number(resRf65.sharpe.toFixed(2))).toBe(3.32);
  });
});



