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
