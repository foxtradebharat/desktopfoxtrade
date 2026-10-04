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
    expect(resKite.stt).toBe(102.4);
    expect(resKite.exchangeFee).toBe(3.3);
    expect(resKite.gst).toBe(0.59);
    expect(resKite.sebi).toBe(0.1);
    expect(resKite.stampDuty).toBe(7.5);
    expect(resKite.total).toBe(113.89);

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
