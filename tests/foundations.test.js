import { describe, it, expect } from 'vitest';
import { num, sum, getTradePnl, isClosedTrade, isPartialTrade, getR } from '../src/utils/tradeMetricsShared.js';
import { normalizeBrokerId } from '../src/utils/brokerIds.js';
import { computeDrawdown } from '../src/utils/drawdown.js';

describe('Step 0 Foundations', () => {
  it('num and sum work reliably', () => {
    expect(num('10.5')).toBe(10.5);
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num('abc')).toBe(0);
    expect(sum([1, 2, 3, 4])).toBe(10);
  });

  it('getTradePnl reads netPnl ?? pnl ?? pl', () => {
    expect(getTradePnl({ netPnl: 100, pnl: 200, pl: 300 })).toBe(100);
    expect(getTradePnl({ pnl: 200, pl: 300 })).toBe(200);
    expect(getTradePnl({ pl: 300 })).toBe(300);
    expect(getTradePnl({})).toBe(0);
  });

  it('status helpers identify closed and partial', () => {
    expect(isClosedTrade({ status: 'Closed' })).toBe(true);
    expect(isClosedTrade({ positionStatus: 'closed' })).toBe(true);
    expect(isClosedTrade({ status: 'Partial' })).toBe(false);
    expect(isPartialTrade({ status: 'Partial' })).toBe(true);
    expect(isPartialTrade({ positionStatus: 'partial' })).toBe(true);
    expect(isPartialTrade({ status: 'Open' })).toBe(false);
  });

  it('getR returns first valid numeric R value or null', () => {
    expect(getR({ weightedRR: '2.5' })).toBe(2.5);
    expect(getR({ weightedRR: null, rewardRisk: 3.1 })).toBe(3.1);
    expect(getR({ rr: 1.8 })).toBe(1.8);
    expect(getR({})).toBe(null);
    expect(getR({ weightedRR: '' })).toBe(null);
  });

  it('normalizeBrokerId handles aliases, case, and unknown brokers', () => {
    expect(normalizeBrokerId('Zerodha Kite')).toBe('zerodha');
    expect(normalizeBrokerId('zerodha')).toBe('zerodha');
    expect(normalizeBrokerId('Kite')).toBe('zerodha');
    expect(normalizeBrokerId('angel broking')).toBe('angelone');
    expect(normalizeBrokerId('Kotak Securities')).toBe('kotak');
    expect(normalizeBrokerId('')).toBe('not_defined');
    expect(normalizeBrokerId(null)).toBe('not_defined');
    expect(normalizeBrokerId('UnknownBrokerXYZ')).toBe(null);
  });

  it('computeDrawdown on 10L capital matches peak-equity math', () => {
    const res1 = computeDrawdown([1000, -500], 1000000);
    expect(res1.available).toBe(true);
    expect(res1.peakEquity).toBe(1001000);
    expect(res1.currentAmount).toBe(-500);
    expect(Number(res1.currentPct.toFixed(2))).toBe(-0.05);

    const res2 = computeDrawdown([1000, -1000], 1000000);
    expect(res2.available).toBe(true);
    expect(res2.peakEquity).toBe(1001000);
    expect(res2.currentAmount).toBe(-1000);
    expect(Number(res2.currentPct.toFixed(2))).toBe(-0.10);

    const resNull = computeDrawdown([1000, -500], 0);
    expect(resNull.available).toBe(false);
  });
});
