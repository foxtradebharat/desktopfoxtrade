import { describe, it, expect } from 'vitest';
import { computeDrawdown, computeDrawdownDaily } from '../src/utils/drawdown.js';
import {
  buildRealizedEvents,
  formatDrawdownPct,
  formatDrawdownAmount,
  indianRupeeFormatter
} from '../src/utils/tradeMetricsShared.js';

describe('Phase 3: Deterministic Drawdown Verification Suite (T1 - T9)', () => {
  const CAPITAL = 1000000; // ₹10,00,000

  it('T1: days D1..D4 one event each [+1000, -500, +1000, -1000] -> currentPct -0.09985 (shows -0.10), currentAmount -1000, maxPct same, peakEquity 1,001,500, equity 1,000,500', () => {
    const res = computeDrawdownDaily({
      events: [
        { dayKey: '2026-01-01', pnl: 1000 },
        { dayKey: '2026-01-02', pnl: -500 },
        { dayKey: '2026-01-03', pnl: 1000 },
        { dayKey: '2026-01-04', pnl: -1000 }
      ],
      flows: [],
      openingCapital: CAPITAL
    });

    expect(res.available).toBe(true);
    expect(Number(res.currentPct.toFixed(5))).toBe(-0.09985);
    expect(formatDrawdownPct(res.currentPct)).toBe('-0.10');
    expect(Math.round(res.currentAmount)).toBe(-1000);
    expect(Number(res.maxPct.toFixed(5))).toBe(-0.09985);
    expect(res.peakEquity).toBe(1001500);
    expect(res.equity).toBe(1000500);
  });

  it('T2: one day with +1000 and -1500 (net -500) -> pct -0.05, amount -500, peak stays 1,000,000', () => {
    const res = computeDrawdownDaily({
      events: [
        { dayKey: '2026-01-01', pnl: 1000 },
        { dayKey: '2026-01-01', pnl: -1500 }
      ],
      flows: [],
      openingCapital: CAPITAL
    });

    expect(res.available).toBe(true);
    expect(Number(res.currentPct.toFixed(2))).toBe(-0.05);
    expect(Math.round(res.currentAmount)).toBe(-500);
    expect(res.peakEquity).toBe(1000000);
  });

  it('T3: D1 P&L +10,000; D2 deposit 5,00,000 and P&L -5,000 -> pct -0.3311, amount -5000, equity 15,05,000', () => {
    const res = computeDrawdownDaily({
      events: [
        { dayKey: '2026-01-01', pnl: 10000 },
        { dayKey: '2026-01-02', pnl: -5000 }
      ],
      flows: [
        { dayKey: '2026-01-02', amount: 500000 }
      ],
      openingCapital: CAPITAL
    });

    expect(res.available).toBe(true);
    expect(Number(res.currentPct.toFixed(4))).toBe(-0.3311);
    expect(Math.round(res.currentAmount)).toBe(-5000);
    expect(res.equity).toBe(1505000);
  });

  it('T4: D1 +10,000; D2 withdrawal 2,00,000, no P&L -> pct 0.00 exactly', () => {
    const res = computeDrawdownDaily({
      events: [
        { dayKey: '2026-01-01', pnl: 10000 }
      ],
      flows: [
        { dayKey: '2026-01-02', amount: -200000 }
      ],
      openingCapital: CAPITAL
    });

    expect(res.available).toBe(true);
    expect(res.currentPct).toBe(0);
    expect(res.currentAmount).toBe(0);
    expect(formatDrawdownPct(res.currentPct)).toBe('0.00');
  });

  it('T5: openingCapital 0, no flows -> { available: false }', () => {
    const res = computeDrawdownDaily({
      events: [{ dayKey: '2026-01-01', pnl: 1000 }],
      flows: [],
      openingCapital: 0
    });

    expect(res.available).toBe(false);
  });

  it('T6: openingCapital 0; D1 P&L +5,000 (no capital); D2 deposit 10,00,000 with P&L -1,000 -> D1 skipped (skippedDays 1), D2 pct -0.10, amount -1000', () => {
    const res = computeDrawdownDaily({
      events: [
        { dayKey: '2026-01-01', pnl: 5000 },
        { dayKey: '2026-01-02', pnl: -1000 }
      ],
      flows: [
        { dayKey: '2026-01-02', amount: 1000000 }
      ],
      openingCapital: 0
    });

    expect(res.available).toBe(true);
    expect(res.skippedDays.length).toBe(1);
    expect(res.skippedDays[0].date).toBe('2026-01-01');
    expect(res.skippedDays[0].pnl).toBe(5000);
    expect(Number(res.currentPct.toFixed(2))).toBe(-0.10);
    expect(Math.round(res.currentAmount)).toBe(-1000);
  });

  it('T7: a Closed trade with no valid exit date is in excluded and not in the series; a trade whose latest exit is e5Date is dated by e5Date', () => {
    const trades = [
      {
        tradeNo: 101,
        symbol: 'INVALID_EXIT',
        status: 'Closed',
        pnl: -2000,
        // no valid exit legs or exit date
        date: '2026-01-10'
      },
      {
        tradeNo: 102,
        symbol: 'LEG5_TRADE',
        status: 'Closed',
        pnl: 4500,
        e1Qty: 10,
        e1Date: '2026-01-05',
        e5Qty: 20,
        e5Date: '2026-01-20'
      }
    ];

    const { events, excluded } = buildRealizedEvents(trades);

    expect(excluded.length).toBe(1);
    expect(excluded[0].tradeNo).toBe(101);
    expect(excluded[0].symbol).toBe('INVALID_EXIT');
    expect(excluded[0].reason).toBe('Missing or invalid exit date');

    expect(events.length).toBe(1);
    expect(events[0].tradeNo).toBe(102);
    expect(events[0].symbol).toBe('LEG5_TRADE');
    expect(events[0].dayKey).toBe('2026-01-20');
  });

  it('T8: formatting: -0.004 shows "0.00" in green; -0.05 shows "-0.05" in red; 1000000 shows "10,00,000.00"', () => {
    // 1. -0.004 formatted
    const textNegTiny = formatDrawdownPct(-0.004);
    expect(textNegTiny).toBe('0.00');
    const isZeroGreen = Number(Number(-0.004).toFixed(2)) === 0;
    expect(isZeroGreen).toBe(true);

    // 2. -0.05 formatted
    const textNeg = formatDrawdownPct(-0.05);
    expect(textNeg).toBe('-0.05');
    const isZeroRed = Number(Number(-0.05).toFixed(2)) === 0;
    expect(isZeroRed).toBe(false);

    // 3. Indian Rupee grouping 10,00,000.00
    const formattedRupee = indianRupeeFormatter.format(1000000);
    expect(formattedRupee).toBe('10,00,000.00');
  });

  it('T9: the no-flow case of computeDrawdownDaily equals computeDrawdown for the same sequence when each trade is on a different day', () => {
    const pnls = [2500, -1200, 4800, -3100, 1500, -750, 900, -2000];
    const resPerTrade = computeDrawdown(pnls, CAPITAL);

    const events = pnls.map((pnl, i) => ({
      dayKey: `2026-01-${String(i + 1).padStart(2, '0')}`,
      pnl
    }));

    const resDaily = computeDrawdownDaily({
      events,
      flows: [],
      openingCapital: CAPITAL
    });

    expect(resDaily.available).toBe(true);
    expect(resDaily.peakEquity).toBe(resPerTrade.peakEquity);
    expect(resDaily.equity).toBe(resPerTrade.equity);
    expect(Math.abs(resDaily.currentPct - resPerTrade.currentPct)).toBeLessThan(1e-12);
    expect(Math.abs(resDaily.currentAmount - resPerTrade.currentAmount)).toBeLessThan(1e-6);
    expect(Math.abs(resDaily.maxPct - resPerTrade.maxPct)).toBeLessThan(1e-12);
    expect(Math.abs(resDaily.maxAmount - resPerTrade.maxAmount)).toBeLessThan(1e-6);
  });
});
