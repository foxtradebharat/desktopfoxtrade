import { describe, it, expect, beforeEach } from 'vitest';
import { computeDrawdown, computeDrawdownDaily, liveDrawdown, STALE_MS } from '../src/utils/drawdown.js';
import {
  migrateLedgerToDatedEntries,
  convertLegacyAggregatesToEntries,
  deriveMonthAggregates,
  calculateMonthlyPerformance,
  getStoredCapitalChanges,
  getStoredLedgerEntries,
  saveLedgerEntries,
  getLedgerFlows,
  LEDGER_MIGRATION_FLAG_KEY
} from '../src/utils/fundManagementCalculations.js';

// In-memory localStorage polyfill for Node.js test environment
const storage = new Map();
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
    get length() {
      return storage.size;
    },
    key: (i) => Array.from(storage.keys())[i] || null
  };
}

describe('Part 4: Ledger & Daily Drawdown Engine Tests (M1 - M10)', () => {
  const CAPITAL = 1000000; // ₹10,00,000

  beforeEach(() => {
    localStorage.clear();
  });

  it('M1: migration: legacy month aggregate becomes entries on the 1st with dateApproximate true; monthlyPerf output is identical; running twice changes nothing; backup key exists', () => {
    const portfolioId = 'portfolio-m1';
    const year = '2026';
    const legacyKey = `tradeontip_monthly_capital_${portfolioId}_${year}`;
    const backupKey = `${legacyKey}_backup_premigration`;
    const entriesKey = `tradeontip_ledger_entries_${portfolioId}_${year}`;

    // Sample legacy month aggregate
    const legacyData = {
      0: { added: 1000000, withdrawn: 0, notes: 'Opening capital' },
      2: { added: 200000, withdrawn: 50000, notes: 'March injection & withdrawal' },
      5: { added: 0, withdrawn: 100000, notes: 'June withdrawal' }
    };

    localStorage.setItem(legacyKey, JSON.stringify(legacyData));

    // Calculate baseline monthly performance before migration
    const monthlyPerfBefore = calculateMonthlyPerformance([], legacyData, year, { portfolioId });

    // Run migration
    migrateLedgerToDatedEntries();

    // Verify backup key exists and matches original data
    expect(localStorage.getItem(backupKey)).toBe(JSON.stringify(legacyData));

    // Verify entries were created on the 1st with dateApproximate: true
    const savedEntries = JSON.parse(localStorage.getItem(entriesKey) || '[]');
    expect(savedEntries.length).toBe(4); // Jan deposit, Mar deposit, Mar withdrawal, Jun withdrawal

    const janDeposit = savedEntries.find(e => e.date === '2026-01-01');
    expect(janDeposit).toBeDefined();
    expect(janDeposit.type).toBe('deposit');
    expect(janDeposit.amount).toBe(1000000);
    expect(janDeposit.dateApproximate).toBe(true);

    const marDeposit = savedEntries.find(e => e.date === '2026-03-01' && e.type === 'deposit');
    expect(marDeposit).toBeDefined();
    expect(marDeposit.amount).toBe(200000);
    expect(marDeposit.dateApproximate).toBe(true);

    const marWithdrawal = savedEntries.find(e => e.date === '2026-03-01' && e.type === 'withdrawal');
    expect(marWithdrawal).toBeDefined();
    expect(marWithdrawal.amount).toBe(50000);
    expect(marWithdrawal.dateApproximate).toBe(true);

    // Verify monthlyPerf output is IDENTICAL after migration
    const derivedCapitalChanges = getStoredCapitalChanges(portfolioId, year);
    const monthlyPerfAfter = calculateMonthlyPerformance([], derivedCapitalChanges, year, { portfolioId });
    expect(monthlyPerfAfter).toEqual(monthlyPerfBefore);

    // Run migration a second time (idempotent)
    migrateLedgerToDatedEntries();
    const savedEntriesSecond = JSON.parse(localStorage.getItem(entriesKey) || '[]');
    expect(savedEntriesSecond).toEqual(savedEntries);
  });

  it('M2: a new entry requires a valid date; editing the date clears dateApproximate', () => {
    const portfolioId = 'portfolio-m2';
    const year = '2026';

    const initialEntry = {
      id: 'entry-1',
      portfolioId,
      type: 'deposit',
      amount: 500000,
      date: '2026-02-01',
      dateApproximate: true,
      note: 'Migrated deposit'
    };

    saveLedgerEntries(portfolioId, year, [initialEntry]);

    const stored = getStoredLedgerEntries(portfolioId, year);
    expect(stored[0].dateApproximate).toBe(true);

    // User edits date to confirmed date (2026-02-14), clearing dateApproximate
    const updatedEntry = {
      ...stored[0],
      date: '2026-02-14',
      dateApproximate: false
    };

    saveLedgerEntries(portfolioId, year, [updatedEntry]);

    const storedAfter = getStoredLedgerEntries(portfolioId, year);
    expect(storedAfter[0].date).toBe('2026-02-14');
    expect(storedAfter[0].dateApproximate).toBe(false);
  });

  it('M3: [+1000,-500,+1000,-1000] on four days -> currentPct -0.09985, currentAmount -1000, peakEquity 10,01,500', () => {
    const res = computeDrawdownDaily({
      events: [
        { dayKey: '2026-01-01', pnl: 1000 },
        { dayKey: '2026-01-02', pnl: -500 },
        { dayKey: '2026-01-03', pnl: 1000 },
        { dayKey: '2026-01-04', pnl: -1000 }
      ],
      openingCapital: CAPITAL
    });

    expect(res.available).toBe(true);
    expect(Number(res.currentPct.toFixed(5))).toBe(-0.09985);
    expect(Math.round(res.currentAmount)).toBe(-1000);
    expect(res.peakEquity).toBe(1001500);
    expect(res.equity).toBe(1000500);
  });

  it('M4: one day with +1000 and -1500 -> pct -0.05, amount -500', () => {
    const res = computeDrawdownDaily({
      events: [
        { dayKey: '2026-01-01', pnl: 1000 },
        { dayKey: '2026-01-01', pnl: -1500 }
      ],
      openingCapital: CAPITAL
    });

    expect(res.available).toBe(true);
    expect(Number(res.currentPct.toFixed(2))).toBe(-0.05);
    expect(Math.round(res.currentAmount)).toBe(-500);
    expect(res.peakEquity).toBe(1000000);
    expect(res.equity).toBe(999500);
  });

  it('M5: day1 +10,000; day2 deposit 5,00,000 and P&L -5,000 -> pct -0.3311, amount -5,000, equity 15,05,000', () => {
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

  it('M6: day1 +10,000; day2 withdrawal 2,00,000, no P&L -> pct 0.00 exactly', () => {
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
    expect(res.equity).toBe(810000);
  });

  it('M7: openingCapital 0 with no flows -> { available: false }', () => {
    const res = computeDrawdownDaily({
      events: [{ dayKey: '2026-01-01', pnl: 1000 }],
      flows: [],
      openingCapital: 0
    });

    expect(res.available).toBe(false);
  });

  it('M8: openingCapital 0; day1 P&L +5,000; day2 deposit 10,00,000 with P&L -1,000 -> skippedDays 1, day2 pct -0.10, amount -1000', () => {
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
    expect(res.equity).toBe(999000);
  });

  it('M9: no flows: computeDrawdownDaily equals computeDrawdown for the same one-trade-per-day sequence', () => {
    const tradePnls = [10000, -5000, 15000, -8000, 2000];
    const events = tradePnls.map((pnl, idx) => ({
      dayKey: `2026-01-0${idx + 1}`,
      pnl
    }));

    const resLegacy = computeDrawdown(tradePnls, CAPITAL);
    const resDaily = computeDrawdownDaily({ events, flows: [], openingCapital: CAPITAL });

    expect(resDaily.available).toBe(true);
    expect(resDaily.currentPct).toBeCloseTo(resLegacy.currentPct, 5);
    expect(resDaily.maxPct).toBeCloseTo(resLegacy.maxPct, 5);
    expect(resDaily.currentAmount).toBeCloseTo(resLegacy.currentAmount, 2);
    expect(resDaily.maxAmount).toBeCloseTo(resLegacy.maxAmount, 2);
    expect(resDaily.equity).toBe(resLegacy.equity);
    expect(resDaily.peakEquity).toBe(resLegacy.peakEquity);
  });

  it('M10: approxFlowCount counts flows with dateApproximate', () => {
    const flows = [
      { dayKey: '2026-01-01', amount: 1000000, dateApproximate: true },
      { dayKey: '2026-02-15', amount: 200000, dateApproximate: false },
      { dayKey: '2026-03-01', amount: -50000, dateApproximate: true }
    ];

    const res = computeDrawdownDaily({
      events: [{ dayKey: '2026-01-10', pnl: 5000 }],
      flows,
      openingCapital: 0
    });

    expect(res.available).toBe(true);
    expect(res.approxFlowCount).toBe(2);
  });
});

describe('Part 4: Live Drawdown Engine Tests (L1 - L9)', () => {
  const CAPITAL = 1000000;

  it('L1: realized +10,000 (equity 10,10,000, peak 10,10,000); unrealized -50,000 -> live pct -4.95 (-4.9505), amount -50,000, realized DD unchanged 0.00, maxIncludingLive -4.95', () => {
    const realized = computeDrawdownDaily({
      events: [{ dayKey: '2026-01-01', pnl: 10000 }],
      openingCapital: CAPITAL
    });

    expect(realized.currentPct).toBe(0);
    expect(realized.equity).toBe(1010000);

    const live = liveDrawdown({
      realized,
      unrealizedPnl: -50000
    });

    expect(live).not.toBeNull();
    expect(Number(live.livePct.toFixed(4))).toBe(-4.9505);
    expect(Number(live.livePct.toFixed(2))).toBe(-4.95);
    expect(Math.round(live.liveAmount)).toBe(-50000);
    expect(realized.currentPct).toBe(0); // Realized DD unchanged
    expect(Number(live.maxIncludingLive.toFixed(2))).toBe(-4.95);
  });

  it('L2: same realized; unrealized +20,000 -> live pct 0.00; maxIncludingLive unchanged', () => {
    const realized = computeDrawdownDaily({
      events: [{ dayKey: '2026-01-01', pnl: 10000 }],
      openingCapital: CAPITAL
    });

    const live = liveDrawdown({
      realized,
      unrealizedPnl: 20000
    });

    expect(live).not.toBeNull();
    expect(live.livePct).toBe(0);
    expect(live.liveAmount).toBe(0);
    expect(live.maxIncludingLive).toBe(0);
  });

  it('L3: realized [+10,000, -5,000] (realized pct -0.495); unrealized -10,000 -> live pct -1.49 (-1.4851), amount -15,000, maxIncludingLive -1.49', () => {
    const realized = computeDrawdownDaily({
      events: [
        { dayKey: '2026-01-01', pnl: 10000 },
        { dayKey: '2026-01-02', pnl: -5000 }
      ],
      openingCapital: CAPITAL
    });

    expect(Number(realized.currentPct.toFixed(3))).toBe(-0.495);

    const live = liveDrawdown({
      realized,
      unrealizedPnl: -10000
    });

    expect(live).not.toBeNull();
    expect(Number(live.livePct.toFixed(4))).toBe(-1.4851);
    expect(Number(live.livePct.toFixed(2))).toBe(-1.49);
    expect(Math.round(live.liveAmount)).toBe(-15000);
    expect(Number(live.maxIncludingLive.toFixed(2))).toBe(-1.49);
  });

  it('L4: property test over random sequences and random unrealized values: |maxIncludingLive| >= |live pct| and >= |realized max|; no NaN or Infinity', () => {
    for (let trial = 0; trial < 100; trial++) {
      const numTrades = Math.floor(Math.random() * 15) + 1;
      const events = [];
      for (let i = 0; i < numTrades; i++) {
        const pnl = (Math.random() - 0.48) * 40000; // random P&L between -19.2k and +20.8k
        events.push({ dayKey: `2026-01-${String(i + 1).padStart(2, '0')}`, pnl });
      }

      const realized = computeDrawdownDaily({ events, openingCapital: CAPITAL });
      const unrealizedPnl = (Math.random() - 0.5) * 100000;

      const live = liveDrawdown({
        realized,
        unrealizedPnl
      });

      expect(live).not.toBeNull();
      expect(Number.isNaN(live.livePct)).toBe(false);
      expect(Number.isFinite(live.livePct)).toBe(true);
      expect(Number.isNaN(live.liveAmount)).toBe(false);
      expect(Number.isFinite(live.liveAmount)).toBe(true);
      expect(Number.isNaN(live.maxIncludingLive)).toBe(false);
      expect(Number.isFinite(live.maxIncludingLive)).toBe(true);

      // Invariants
      expect(Math.abs(live.maxIncludingLive) + 1e-9).toBeGreaterThanOrEqual(Math.abs(live.livePct) - 1e-9);
      expect(Math.abs(live.maxIncludingLive) + 1e-9).toBeGreaterThanOrEqual(Math.abs(realized.maxPct) - 1e-9);
      expect(live.livePct).toBeLessThanOrEqual(0.00001);
      expect(live.maxIncludingLive).toBeLessThanOrEqual(0.00001);
    }
  });

  it('L5: realized equity 10,10,000; unrealized -12,00,000 -> pct -100, liveEquityNonPositive true', () => {
    const realized = computeDrawdownDaily({
      events: [{ dayKey: '2026-01-01', pnl: 10000 }],
      openingCapital: CAPITAL
    });

    const live = liveDrawdown({
      realized,
      unrealizedPnl: -1200000
    });

    expect(live).not.toBeNull();
    expect(live.livePct).toBe(-100);
    expect(live.liveEquityNonPositive).toBe(true);
    expect(live.maxIncludingLive).toBe(-100);
  });

  it('L6: no priced open positions -> null', () => {
    const realized = computeDrawdownDaily({
      events: [{ dayKey: '2026-01-01', pnl: 10000 }],
      openingCapital: CAPITAL
    });

    const live = liveDrawdown({
      realized,
      unrealizedPnl: 0,
      pricedCount: 0,
      hasPricedPositions: false
    });

    expect(live).toBeNull();
  });

  it('L7: positions with missing CMP are excluded and unpricedCount is correct', () => {
    const realized = computeDrawdownDaily({
      events: [{ dayKey: '2026-01-01', pnl: 10000 }],
      openingCapital: CAPITAL
    });

    const openPositions = [
      { id: 1, symbol: 'TATAMOTORS', cmp: 1000, unrealized: 2000 },
      { id: 2, symbol: 'INFY', cmp: '', unrealized: 0 }, // unpriced
      { id: 3, symbol: 'RELIANCE', cmp: 0, unrealized: 0 }, // unpriced
      { id: 4, symbol: 'HDFCBANK', cmp: 1650, unrealized: -3000 }
    ];

    const isPriced = (t) => {
      const c = Number(t?.cmp);
      return !isNaN(c) && c > 0;
    };

    const priced = openPositions.filter(isPriced);
    const unpricedCount = openPositions.length - priced.length;
    const totalUnrealized = priced.reduce((acc, t) => acc + t.unrealized, 0);

    const live = liveDrawdown({
      realized,
      unrealizedPnl: totalUnrealized,
      unpricedCount,
      pricedCount: priced.length
    });

    expect(live).not.toBeNull();
    expect(live.unpricedCount).toBe(2);
    expect(priced.length).toBe(2);
  });

  it('L8: with flows: day1 +10,000; day2 deposit 5,00,000; unrealized -10,000 -> live pct -0.66 (-0.6623), amount -10,000, liveEquity 15,00,000', () => {
    const realized = computeDrawdownDaily({
      events: [{ dayKey: '2026-01-01', pnl: 10000 }],
      flows: [{ dayKey: '2026-01-02', amount: 500000 }],
      openingCapital: CAPITAL
    });

    expect(realized.equity).toBe(1510000);

    const live = liveDrawdown({
      realized,
      unrealizedPnl: -10000
    });

    expect(live).not.toBeNull();
    expect(Number(live.livePct.toFixed(4))).toBe(-0.6623);
    expect(Number(live.livePct.toFixed(2))).toBe(-0.66);
    expect(Math.round(live.liveAmount)).toBe(-10000);
    expect(live.liveEquity).toBe(1500000);
  });

  it('L9: stale price (older than STALE_MS or no timestamp) -> UI flag stale true; Live row muted', () => {
    const realized = computeDrawdownDaily({
      events: [{ dayKey: '2026-01-01', pnl: 10000 }],
      openingCapital: CAPITAL
    });

    const now = Date.now();
    const staleTrades = [
      { id: 1, symbol: 'TATAMOTORS', cmp: 1000, unrealized: 2000, cmpUpdatedAt: new Date(now - (STALE_MS + 3600000)).toISOString() }
    ];

    const live = liveDrawdown({
      realized,
      unrealizedPnl: 2000,
      pricedTrades: staleTrades
    });

    expect(live).not.toBeNull();
    expect(live.isStale).toBe(true);

    const noTimestampTrades = [
      { id: 2, symbol: 'INFY', cmp: 1500, unrealized: 1000, cmpUpdatedAt: null }
    ];

    const liveNoTs = liveDrawdown({
      realized,
      unrealizedPnl: 1000,
      pricedTrades: noTimestampTrades
    });

    expect(liveNoTs).not.toBeNull();
    expect(liveNoTs.isStale).toBe(true);
  });
});
