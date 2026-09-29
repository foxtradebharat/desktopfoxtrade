/**
 * brokerChargesService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads broker_charges.csv and computes exact Indian market charges per trade.
 *
 * CSV location: src/data/broker_charges.csv
 * To update any broker's fees → just edit the CSV. No code changes needed.
 *
 * Columns in CSV:
 *   broker, segment, brokerage_type, brokerage_flat_inr, brokerage_pct_max,
 *   stt_buy_pct, stt_sell_pct, exchange_fee_pct, gst_pct,
 *   sebi_per_crore, stamp_duty_buy_pct
 *
 * Segment auto-detection:
 *   holdingDays === 0  → 'intraday'
 *   holdingDays >= 1   → 'delivery'
 *   (Futures/Options: passed explicitly)
 */

// ── Parse raw CSV text into a keyed lookup map ───────────────────────────────
function parseChargesCSV(csvText) {
  const lines = csvText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  const headers = lines[0].split(',').map(h => h.trim());
  const map = {}; // key: "broker:segment"

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length < headers.length) continue;

    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] || '0'; });

    const key = `${row.broker.toLowerCase()}:${row.segment.toLowerCase()}`;
    map[key] = {
      brokerageType:   row.brokerage_type,
      brokerageFlatInr: parseFloat(row.brokerage_flat_inr) || 0,
      brokeragePctMax:  parseFloat(row.brokerage_pct_max) || 0,
      sttBuyPct:        parseFloat(row.stt_buy_pct) || 0,
      sttSellPct:       parseFloat(row.stt_sell_pct) || 0,
      exchangeFeePct:   parseFloat(row.exchange_fee_pct) || 0,
      gstPct:           parseFloat(row.gst_pct) || 18,
      sebiPerCrore:     parseFloat(row.sebi_per_crore) || 10,
      stampDutyBuyPct:  parseFloat(row.stamp_duty_buy_pct) || 0,
    };
  }

  return map;
}

// ── Module-level cache ───────────────────────────────────────────────────────
let _chargesMap = null;

/**
 * Load broker_charges.csv once and cache it.
 * Uses Vite's ?raw import via dynamic import or fetch in the browser.
 */
export async function loadBrokerCharges() {
  if (_chargesMap) return _chargesMap;

  try {
    // Vite serves files from /src/data/ via public or raw import
    const response = await fetch('/broker_charges.csv');
    if (!response.ok) throw new Error('CSV fetch failed');
    const text = await response.text();
    _chargesMap = parseChargesCSV(text);
  } catch {
    // Fallback: embedded minimal defaults (Zerodha only)
    const fallback = `broker,segment,brokerage_type,brokerage_flat_inr,brokerage_pct_max,stt_buy_pct,stt_sell_pct,exchange_fee_pct,gst_pct,sebi_per_crore,stamp_duty_buy_pct
zerodha,intraday,lower_of_flat_or_pct,20,0.03,0,0.025,0.00322,18,10,0.003
zerodha,delivery,free,0,0,0.1,0.1,0.00322,18,10,0.015`;
    _chargesMap = parseChargesCSV(fallback);
  }

  return _chargesMap;
}

/**
 * Synchronously get the cached map (call loadBrokerCharges() first).
 */
export function getChargesMap() {
  return _chargesMap || {};
}

/**
 * Auto-detect segment from holdingDays.
 *   holdingDays <= 1 → 'intraday' (less than 1 or within 1 day)
 *   holdingDays > 1  → 'delivery' (greater than 1)
 *   Pass 'futures' or 'options' explicitly if known.
 */
export function detectSegment(holdingDays, explicitSegment) {
  if (explicitSegment && explicitSegment !== 'auto') return explicitSegment.toLowerCase();
  const days = Number(holdingDays) || 0;
  return days <= 1 ? 'intraday' : 'delivery';
}

/**
 * Calculate all charges for one trade leg.
 *
 * @param {string}  broker        - e.g. 'zerodha', 'groww', 'not_defined'
 * @param {string}  segment       - 'intraday' | 'delivery' | 'futures' | 'options'
 * @param {number}  entryTurnover - avgEntry * totalQtyEntered  (buy-side ₹)
 * @param {number}  exitTurnover  - avgExit  * exitedQty       (sell-side ₹)
 * @param {number}  exitedQty     - number of shares exited
 * @param {object}  chargesMap    - from loadBrokerCharges() / getChargesMap()
 *
 * @returns {{ brokerage, stt, exchangeFee, gst, sebi, stampDuty, total, hasCharges }}
 */
export function calculateCharges(broker, segment, entryTurnover, exitTurnover, exitedQty, chargesMap) {
  const empty = { brokerage: 0, stt: 0, exchangeFee: 0, gst: 0, sebi: 0, stampDuty: 0, total: 0, hasCharges: false };

  if (!broker || broker === 'not_defined' || !chargesMap) return empty;

  const key = `${broker.toLowerCase()}:${segment.toLowerCase()}`;
  const c = chargesMap[key];
  if (!c) return empty;

  const buyTurnover  = Math.max(0, entryTurnover  || 0);
  const sellTurnover = Math.max(0, exitTurnover   || 0);
  const totalTurnover = buyTurnover + sellTurnover;

  // ── 1. Brokerage ────────────────────────────────────────────────────────
  let brokerage = 0;
  if (c.brokerageType === 'free') {
    brokerage = 0;
  } else if (c.brokerageType === 'flat') {
    // ₹flat per executed order (buy + sell = 2 orders)
    brokerage = c.brokerageFlatInr * 2;
  } else if (c.brokerageType === 'lower_of_flat_or_pct') {
    // Apply to both buy and sell sides separately, then sum
    const buyBrokerage  = Math.min(c.brokerageFlatInr, (buyTurnover  * c.brokeragePctMax) / 100);
    const sellBrokerage = Math.min(c.brokerageFlatInr, (sellTurnover * c.brokeragePctMax) / 100);
    brokerage = buyBrokerage + sellBrokerage;
  }
  brokerage = Math.round(brokerage * 100) / 100;

  // ── 2. STT (Securities Transaction Tax) ────────────────────────────────
  const sttBuy  = (buyTurnover  * c.sttBuyPct)  / 100;
  const sttSell = (sellTurnover * c.sttSellPct) / 100;
  const stt = Math.round((sttBuy + sttSell) * 100) / 100;

  // ── 3. Exchange Transaction Fee ─────────────────────────────────────────
  const exchangeFee = Math.round((totalTurnover * c.exchangeFeePct) / 100 * 100) / 100;

  // ── 4. GST on Brokerage + Exchange Fee ──────────────────────────────────
  const gst = Math.round(((brokerage + exchangeFee) * c.gstPct) / 100 * 100) / 100;

  // ── 5. SEBI Charges (₹10 per crore of turnover) ─────────────────────────
  const sebi = Math.round((totalTurnover / 10000000) * c.sebiPerCrore * 100) / 100;

  // ── 6. Stamp Duty (buy-side only) ───────────────────────────────────────
  const stampDuty = Math.round((buyTurnover * c.stampDutyBuyPct) / 100 * 100) / 100;

  const total = Math.round((brokerage + stt + exchangeFee + gst + sebi + stampDuty) * 100) / 100;

  return { brokerage, stt, exchangeFee, gst, sebi, stampDuty, total, hasCharges: true };
}

/**
 * Convenience: detect segment from holdingDays and compute charges in one call.
 */
export function computeNetPnl(grossPnl, broker, holdingDays, entryTurnover, exitTurnover, exitedQty, chargesMap, explicitSegment) {
  const segment = detectSegment(holdingDays, explicitSegment);
  const charges = calculateCharges(broker, segment, entryTurnover, exitTurnover, exitedQty, chargesMap);
  const netPnl = Math.round((grossPnl - charges.total) * 100) / 100;
  return { netPnl, charges, segment };
}
