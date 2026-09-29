# FoxTrade (TradeOnTip) Calculation Engine: Comprehensive Problem Report & Verification Benchmark

> **Objective:** This document provides the complete project context, raw test data, expected verification benchmarks, and live application discrepancies for the **FoxTrade / TradeOnTip** trading journal. It is structured so that an external AI assistant or engineer can independently analyze the codebase, diagnose the calculation bugs, and propose the optimal architectural fixes.

---

## 1. System Architecture & Codebase Overview

### 1.1 Project Structure
- **Application:** FoxTrade (`foxtrade.in`) / TradeOnTip — Indian Equity Trading Journal.
- **Tech Stack:** React 18 (Vite), Tailwind CSS, Lucide Icons.
- **Key Modules & Current Roles:**
  - `src/Dashboard.jsx`: Primary state orchestrator. Houses `enrichTradeWithLegs(trade)` which calculates all derived metrics per trade, and `metrics` which aggregates portfolio-level KPIs.
  - `src/components/JournalTable.jsx`: Main UI table displaying trade rows, leg breakdowns, and dynamic column formatting.
  - `src/components/AddTradeModal.jsx`: Multi-leg entry/exit modal and form editor.
  - `src/components/ColumnsPopover.jsx`: Column visibility configuration.
  - `src/services/tradingViewSocketService.js`: Live real-time market data WebSocket pipeline.

### 1.2 Multi-Leg Data Model
Each trade supports up to 5 entry legs (Initial + P1..P4 pyramiding) and up to 4 exit legs (E1..E4 scaled exits):
```typescript
interface TradeRecord {
  id: string;
  tradeNo: number;
  date: string;               // ISO format: YYYY-MM-DD (Initial entry date)
  name: string;               // Symbol (e.g., WIPRO, PAYTM, LT, JSWSTEEL, etc.)
  setup: string;              // Technical setup
  type: "Buy" | "Sell";       // Direction (Buy / Sell)
  entry: number;              // Initial leg entry price
  qty: number;                // Initial leg quantity
  sl?: number;                // Initial stop loss
  cmp?: number;               // Current market price / benchmark test CMP
  entryType: "VCP" | "PIVOT" | string;
  
  // Pyramid Entry Legs (P1 - P4)
  p1Price?: number; p1Qty?: number; p1Date?: string; p1Sl?: number;
  p2Price?: number; p2Qty?: number; p2Date?: string; p2Sl?: number;
  p3Price?: number; p3Qty?: number; p3Date?: string; p3Sl?: number;
  p4Price?: number; p4Qty?: number; p4Date?: string; p4Sl?: number;
  
  // Trailing Stop Loss
  tsl?: number;
  
  // Scale Exit Legs (E1 - E4)
  e1Price?: number; e1Qty?: number; e1Date?: string;
  e2Price?: number; e2Qty?: number; e2Date?: string;
  e3Price?: number; e3Qty?: number; e3Date?: string;
  e4Price?: number; e4Qty?: number; e4Date?: string;

  // Stored / Derived Metadata
  planFollowed?: "Yes" | "No";
  exitTrigger?: string;
  growthAreas?: string;
  quickNote?: string;
}
```

---

## 2. The 10 Test Trades Raw Input Data

```json
[
  {
    "tradeNo": 1,
    "name": "WIPRO",
    "type": "Buy",
    "setup": "Breakout",
    "entryType": "VCP",
    "date": "2026-05-01",
    "entry": 450.00,
    "qty": 100,
    "sl": 430.00,
    "cmp": 480.00,
    "e1Price": 480.00,
    "e1Qty": 100,
    "e1Date": "2026-05-11",
    "planFollowed": "Yes",
    "exitTrigger": "Target Hit",
    "quickNote": "Baseline single-leg closed trade"
  },
  {
    "tradeNo": 2,
    "name": "PAYTM",
    "type": "Sell",
    "setup": "Breakdown",
    "entryType": "PIVOT",
    "date": "2026-05-05",
    "entry": 800.00,
    "qty": 100,
    "sl": 840.00,
    "cmp": 750.00,
    "e1Price": 750.00,
    "e1Qty": 100,
    "e1Date": "2026-05-10",
    "planFollowed": "Yes",
    "exitTrigger": "Target Hit",
    "quickNote": "Short trade, closed in profit"
  },
  {
    "tradeNo": 3,
    "name": "LT",
    "type": "Buy",
    "setup": "Cup with Handle",
    "entryType": "VCP",
    "date": "2026-05-10",
    "entry": 3200.00,
    "qty": 20,
    "sl": 3100.00,
    "cmp": 3500.00,
    "p1Price": 3300.00,
    "p1Qty": 20,
    "p1Date": "2026-05-15",
    "p1Sl": 3200.00,
    "e1Price": 3500.00,
    "e1Qty": 40,
    "e1Date": "2026-05-30",
    "planFollowed": "Yes",
    "exitTrigger": "Target Hit",
    "quickNote": "2-leg pyramid VWAP test"
  },
  {
    "tradeNo": 4,
    "name": "JSWSTEEL",
    "type": "Sell",
    "setup": "Breakdown",
    "entryType": "PIVOT",
    "date": "2026-05-20",
    "entry": 900.00,
    "qty": 50,
    "sl": 930.00,
    "cmp": 860.00,
    "p1Price": 880.00,
    "p1Qty": 50,
    "p1Date": "2026-05-24",
    "p1Sl": 900.00,
    "tsl": 870.00,
    "e1Price": 850.00,
    "e1Qty": 50,
    "e1Date": "2026-06-04",
    "planFollowed": "Yes",
    "quickNote": "Short, pyramided, partial cover, TSL below avgEntry locks profit"
  },
  {
    "tradeNo": 5,
    "name": "TATASTEEL",
    "type": "Buy",
    "setup": "Breakout",
    "entryType": "PIVOT",
    "date": "2026-08-15",
    "entry": 165.00,
    "qty": 200,
    "sl": null,
    "cmp": 175.00,
    "planFollowed": "Yes",
    "quickNote": "No SL entered - tests R:R / SL% with missing stop"
  },
  {
    "tradeNo": 6,
    "name": "BEL",
    "type": "Buy",
    "setup": "Breakout",
    "entryType": "VCP",
    "date": "2026-07-01",
    "entry": 280.00,
    "qty": 100,
    "sl": 270.00,
    "cmp": 310.00,
    "tsl": 300.00,
    "planFollowed": "Yes",
    "quickNote": "TSL=300 (above entry), CMP=310 (above TSL) - profit-at-risk must be nonzero"
  },
  {
    "tradeNo": 7,
    "name": "ONGC",
    "type": "Buy",
    "setup": "Pullback",
    "entryType": "PIVOT",
    "date": "2026-06-05",
    "entry": 260.00,
    "qty": 80,
    "sl": 250.00,
    "cmp": 300.00,
    "e1Price": 270.00,
    "e1Qty": 20,
    "e1Date": "2026-06-15",
    "e2Price": 280.00,
    "e2Qty": 20,
    "e2Date": "2026-06-25",
    "e3Price": 290.00,
    "e3Qty": 20,
    "e3Date": "2026-07-10",
    "e4Price": 300.00,
    "e4Qty": 20,
    "e4Date": "2026-07-25",
    "planFollowed": "Yes",
    "exitTrigger": "Target Hit",
    "quickNote": "4-leg scaled exit, tests E4 wiring"
  },
  {
    "tradeNo": 8,
    "name": "IRCTC",
    "type": "Buy",
    "setup": "Scalp",
    "entryType": "PIVOT",
    "date": "2026-07-10",
    "entry": 700.00,
    "qty": 50,
    "sl": 690.00,
    "cmp": 715.00,
    "e1Price": 715.00,
    "e1Qty": 50,
    "e1Date": "2026-07-10",
    "planFollowed": "Yes",
    "exitTrigger": "Target Hit",
    "quickNote": "Same-day close - holding days must show 0"
  },
  {
    "tradeNo": 9,
    "name": "VEDL",
    "type": "Sell",
    "setup": "Breakdown",
    "entryType": "PIVOT",
    "date": "2026-08-10",
    "entry": 420.00,
    "qty": 150,
    "sl": 435.00,
    "cmp": 400.00,
    "planFollowed": "Yes",
    "quickNote": "Pure short, no TSL - capital at risk should be nonzero"
  },
  {
    "tradeNo": 10,
    "name": "BAJFINANCE",
    "type": "Buy",
    "setup": "Range",
    "entryType": "PIVOT",
    "date": "2026-06-20",
    "entry": 6800.00,
    "qty": 10,
    "sl": 6700.00,
    "cmp": 6800.00,
    "e1Price": 6800.00,
    "e1Qty": 10,
    "e1Date": "2026-06-25",
    "planFollowed": "Yes",
    "exitTrigger": "Target Hit",
    "quickNote": "Exact breakeven - win-rate exclusion test"
  }
]
```

---

## 3. Expected Benchmark Results (`foxtrade_verification_expected_results.csv`)

| Trade No | Name | Field | Expected Value | Derivation & Benchmark Rule |
| :---: | :--- | :--- | :--- | :--- |
| **1** | WIPRO | Avg Entry | `450.00` | Single leg, no VWAP needed |
| **1** | WIPRO | Avg Exit Price | `480.00` | Single exit leg |
| **1** | WIPRO | Open Qty | `0` | Fully exited |
| **1** | WIPRO | Position Status | `Closed` | `openQty === 0` |
| **1** | WIPRO | Stock Move % | `6.67%` | `(480 - 450) / 450 * 100` |
| **1** | WIPRO | SL % | `4.44%` | `\|450 - 430\| / 450 * 100` |
| **1** | WIPRO | Reward:Risk | `1.50` | `reward = 30`, `risk = 20` $\rightarrow$ `30 / 20 = 1.50R` |
| **1** | WIPRO | Holding Days | `10` | `2026-05-01` to `2026-05-11` (10 calendar days) |
| **1** | WIPRO | Realised P/L | `3000.00` | `(480 - 450) * 100` |
| **1** | WIPRO | Realised Amount (Buy) | `48000.00` | `avgExit * qty = 480 * 100` |
| **2** | PAYTM | Avg Entry | `800.00` | Single short entry leg |
| **2** | PAYTM | Avg Exit Price | `750.00` | Single cover exit leg |
| **2** | PAYTM | Position Status | `Closed` | `openQty === 0` |
| **2** | PAYTM | Realised P/L | `5000.00` | SELL: `(800 - 750) * 100 = 5000` (must be POSITIVE) |
| **2** | PAYTM | Stock Move % | `-6.25%` | Raw price move `(750 - 800) / 800 * 100` (Negative price change) |
| **2** | PAYTM | SL % | `5.00%` | `\|800 - 840\| / 800 * 100` |
| **2** | PAYTM | Reward:Risk | `1.25` | Economic reward = 50, risk = 40 $\rightarrow$ `1.25` |
| **2** | PAYTM | Holding Days | `5` | `2026-05-05` to `2026-05-10` (5 calendar days) |
| **2** | PAYTM | Realised Amount (Sell) | `85000.00` | FoxTrade formula: `avgEntry * qty + pnl = 800 * 100 + 5000 = 85000` |
| **3** | LT | Avg Entry (VWAP) | `3250.00` | `(3200 * 20 + 3300 * 20) / 40` |
| **3** | LT | Avg Exit Price | `3500.00` | Single exit leg |
| **3** | LT | Stock Move % | `7.69%` | `(3500 - 3250) / 3250 * 100` (measured against VWAP) |
| **3** | LT | SL % | `3.13%` | Uses INITIAL entry 3200: `\|3200 - 3100\| / 3200 * 100` |
| **3** | LT | Position Size | `130000.00` | `avgEntry * totalQtyEntered = 3250 * 40` |
| **3** | LT | Realised P/L | `10000.00` | `(3500 - 3250) * 40` |
| **3** | LT | Holding Days | `20` | `2026-05-10` to `2026-05-30` (20 calendar days) |
| **4** | JSWSTEEL | Avg Entry (VWAP, short) | `890.00` | `(900 * 50 + 880 * 50) / 100` |
| **4** | JSWSTEEL | Open Qty | `50` | `100 entered - 50 exited` |
| **4** | JSWSTEEL | Exited Qty | `50` | Partial exit leg |
| **4** | JSWSTEEL | Position Status | `Partial` | `openQty > 0 && exitedQty > 0` |
| **4** | JSWSTEEL | Avg Exit Price | `850.00` | Partial cover exit price |
| **4** | JSWSTEEL | Realised P/L | `2000.00` | SELL: `(890 - 850) * 50` |
| **4** | JSWSTEEL | Unrealised P/L | `1500.00` | SELL at CMP 860: `(890 - 860) * 50` |
| **4** | JSWSTEEL | Gross P/L | `3500.00` | `2000 realised + 1500 unrealised` |
| **4** | JSWSTEEL | Profit Protected | `1000.00` | TSL 870 < avgEntry 890 for Short $\rightarrow$ `(890 - 870) * 50 = 1000` |
| **4** | JSWSTEEL | Holding Days (partial exit leg) | `11` (or 15 cal) | `2026-05-20` to `2026-06-04` (15 calendar / 11 trading days) |
| **5** | TATASTEEL | Avg Entry | `165.00` | Single entry leg |
| **5** | TATASTEEL | SL % | `BLANK or N/A` | No SL set $\rightarrow$ must render `—`, never `0.00%` or crash |
| **5** | TATASTEEL | Reward:Risk | `BLANK or N/A` | Risk undefined without SL $\rightarrow$ must render `—` |
| **5** | TATASTEEL | Position Status | `Open` | Active position |
| **5** | TATASTEEL | Holding Days | `17` | `2026-08-15` to `2026-09-01` (today) |
| **5** | TATASTEEL | Unrealised P/L | `2000.00` | BUY at test CMP 175: `(175 - 165) * 200` |
| **6** | BEL | Avg Entry | `280.00` | Single entry leg |
| **6** | BEL | Position Status | `Open` | Active position |
| **6** | BEL | Capital At Risk | `0.00 (₹0.00)` | TSL 300 > entry 280 $\rightarrow$ locked profit, zero risk below cost |
| **6** | BEL | Profit Protected | `2000.00` | `(TSL 300 - avgEntry 280) * 100 = 2000` |
| **6** | BEL | Profit Risk (rupee) | `1000.00` | `max(0, CMP 310 - TSL 300) * 100 = 1000` (must be nonzero) |
| **6** | BEL | Unrealised P/L | `3000.00` | BUY at test CMP 310: `(310 - 280) * 100` |
| **7** | ONGC | Avg Exit Price (4 legs) | `285.00` | `(270*20 + 280*20 + 290*20 + 300*20) / 80` |
| **7** | ONGC | Realised P/L | `2000.00` | `(285 - 260) * 80` |
| **7** | ONGC | Position Status | `Closed` | Fully exited after 4th leg |
| **7** | ONGC | E4 field wired up? | `300 / 20 / 2026-07-25` | Confirms 4th exit leg (E4) is wired into stat calculations |
| **7** | ONGC | Holding Days | `50` | `2026-06-05` to `2026-07-25` (final exit date E4) |
| **8** | IRCTC | Holding Days | `0` | Same date entry & exit `2026-07-10` $\rightarrow$ must show `0`, not blank/1 |
| **8** | IRCTC | Realised P/L | `750.00` | `(715 - 700) * 50` |
| **8** | IRCTC | Position Status | `Closed` | Fully exited |
| **9** | VEDL | Avg Entry | `420.00` | Short trade entry |
| **9** | VEDL | Position Status | `Open` | Active short position |
| **9** | VEDL | Unrealised P/L | `3000.00` | SELL at test CMP 400: `(420 - 400) * 150` |
| **9** | VEDL | Capital At Risk (rupee) | `2250.00` | Short downside risk: `(SL 435 - avgEntry 420) * 150 = 2250` |
| **10** | BAJFINANCE | Realised P/L | `0.00` | Exact breakeven trade |
| **10** | BAJFINANCE | Stock Move % | `0.00%` | Zero price movement |
| **10** | BAJFINANCE | Win Rate treatment | `EXCLUDED` | Breakeven excluded from both numerator and denominator in Win Rate |

---

## 4. Live Verification Comparison Table

| Trade # | Name | Field | Expected | Actual (FoxTrade Live) | Match Y/N |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | WIPRO | Avg Entry | 450.00 | ₹450.00 | **Y** |
| **1** | WIPRO | Avg Exit Price | 480.00 | ₹480.00 | **Y** |
| **1** | WIPRO | Open Qty | 0 | 0 | **Y** |
| **1** | WIPRO | Position Status | Closed | Closed | **Y** |
| **1** | WIPRO | Stock Move % | 6.67% | +6.67% | **Y** |
| **1** | WIPRO | SL % | 4.44% | 4.44% | **Y** |
| **1** | WIPRO | Reward:Risk | 1.50 | +1.50R | **Y** |
| **1** | WIPRO | Holding Days | 10 | 10 days | **Y** |
| **1** | WIPRO | Realised P/L | 3000.00 | +₹3,000.00 | **Y** |
| **1** | WIPRO | Realised Amount (Buy) | 48000.00 | ₹48,000.00 | **Y** |
| **2** | PAYTM | Avg Entry | 800.00 | ₹800.00 | **Y** |
| **2** | PAYTM | Avg Exit Price | 750.00 | ₹750.00 | **Y** |
| **2** | PAYTM | Position Status | Closed | Closed | **Y** |
| **2** | PAYTM | Realised P/L | 5000.00 | +₹5,000.00 | **Y** |
| **2** | PAYTM | Stock Move % | -6.25% | -6.25% | **Y** |
| **2** | PAYTM | SL % | 5.00% | 5.00% | **Y** |
| **2** | PAYTM | Reward:Risk | 1.25 | +1.25R | **Y** |
| **2** | PAYTM | Holding Days | 5 | 5 days | **Y** |
| **2** | PAYTM | Realised Amount (Sell) | 85000.00 | ₹85,000.00 | **Y** |
| **3** | LT | Avg Entry (VWAP) | 3250.00 | ₹3,250.00 | **Y** |
| **3** | LT | Avg Exit Price | 3500.00 | ₹3,500.00 | **Y** |
| **3** | LT | Stock Move % | 7.69% | +7.69% | **Y** |
| **3** | LT | SL % | 3.13% | 3.13% | **Y** |
| **3** | LT | Position Size | 130000.00 | ₹1,30,000.00 | **Y** |
| **3** | LT | Realised P/L | 10000.00 | +₹10,000.00 | **Y** |
| **3** | LT | Holding Days | 20 | 18 days | **N** |
| **4** | JSWSTEEL | Avg Entry (VWAP, short) | 890.00 | ₹890.00 | **Y** |
| **4** | JSWSTEEL | Open Qty | 50 | 50 | **Y** |
| **4** | JSWSTEEL | Exited Qty | 50 | 50 | **Y** |
| **4** | JSWSTEEL | Position Status | Partial | Partial | **Y** |
| **4** | JSWSTEEL | Avg Exit Price | 850.00 | ₹850.00 | **Y** |
| **4** | JSWSTEEL | Realised P/L | 2000.00 | -₹19,175.00 *(Gross P/L displayed)* | **N** |
| **4** | JSWSTEEL | Unrealised P/L | 1500.00 | -₹21,175.00 *(Live CMP: ₹1,313.50)* | **N** |
| **4** | JSWSTEEL | Gross P/L | 3500.00 | -₹19,175.00 *(Live CMP: ₹1,313.50)* | **N** |
| **4** | JSWSTEEL | Profit Protected | 1000.00 | Top KPI: ₹3,000 *(No per-row col)* | **N** |
| **4** | JSWSTEEL | Holding Days (partial exit leg) | 11 | 58 days | **N** |
| **5** | TATASTEEL | Avg Entry | 165.00 | ₹165.00 | **Y** |
| **5** | TATASTEEL | SL % | BLANK or N/A | — | **Y** |
| **5** | TATASTEEL | Reward:Risk | BLANK or N/A | — | **Y** |
| **5** | TATASTEEL | Position Status | Open | Open | **Y** |
| **5** | TATASTEEL | Holding Days | 17 | 17 days | **Y** |
| **5** | TATASTEEL | Unrealised P/L | 2000.00 | +₹3,814.00 *(Live CMP: ₹184.07)* | **N** |
| **6** | BEL | Avg Entry | 280.00 | ₹280.00 | **Y** |
| **6** | BEL | Position Status | Open | Open | **Y** |
| **6** | BEL | Capital At Risk | 0.00 (rupee: 0) | 0.00% (₹0.00) | **Y** |
| **6** | BEL | Profit Protected | 2000.00 | Top KPI: ₹3,000 *(No per-row col)* | **N** |
| **6** | BEL | Profit Risk (rupee) | 1000.00 | Top KPI: 171.80% *(No per-row col)* | **N** |
| **6** | BEL | Unrealised P/L | 3000.00 | +₹13,120.00 *(Live CMP: ₹411.20)* | **N** |
| **7** | ONGC | Avg Exit Price (4 legs) | 285.00 | ₹285.00 | **Y** |
| **7** | ONGC | Realised P/L | 2000.00 | +₹2,000.00 | **Y** |
| **7** | ONGC | Position Status | Closed | Closed | **Y** |
| **7** | ONGC | E4 field wired up? | Must show 300 / 20 / 2026-07-25 | 300 / 20 / 2026-07-25 | **Y** |
| **7** | ONGC | Holding Days | 50 | 29 days | **N** |
| **8** | IRCTC | Holding Days | 0 | 0 days | **Y** |
| **8** | IRCTC | Realised P/L | 750.00 | +₹750.00 | **Y** |
| **8** | IRCTC | Position Status | Closed | Closed | **Y** |
| **9** | VEDL | Avg Entry | 420.00 | ₹420.00 | **Y** |
| **9** | VEDL | Position Status | Open | Open | **Y** |
| **9** | VEDL | Unrealised P/L | 3000.00 | +₹21,900.00 *(Live CMP: ₹274.00)* | **N** |
| **9** | VEDL | Capital At Risk (rupee) | 2250.00 | 2.25% (Top KPI: ₹2,250) | **Y** |
| **10** | BAJFINANCE | Realised P/L | 0.00 | ₹0.00 | **Y** |
| **10** | BAJFINANCE | Stock Move % | 0.00% | 0.00% | **Y** |
| **10** | BAJFINANCE | Win Rate treatment | EXCLUDED from wins AND losses | EXCLUDED (Win Rate: 100.00%) | **Y** |

---

## 5. Detailed Problem Breakdown & Current Code Implementations

### Problem 1: Holding Days Calculation Issues
**Current Code Location:** `src/Dashboard.jsx:743-765`
```javascript
// Current snippet:
let holdingDays = (t.holdingDays !== undefined && t.holdingDays !== null && t.holdingDays !== '' && !isNaN(Number(t.holdingDays)))
  ? Number(t.holdingDays)
  : undefined;

if (holdingDays === undefined) {
  if (t.date) {
    const parseD = (str) => {
      if (!str) return null;
      if (str.includes('-')) {
        const parts = str.split('-');
        if (parts[0].length === 4) return new Date(parts[0], parts[1] - 1, parts[2]);
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
      return new Date(str);
    };
    const d1 = parseD(t.date);
    const lastExitDateStr = t.e4Date || t.e3Date || t.e2Date || t.e1Date || t.exitDate;
    const isClosed = t.status === 'Closed' || openQty === 0;
    const d2 = isClosed && lastExitDateStr ? parseD(lastExitDateStr) : (lastExitDateStr ? parseD(lastExitDateStr) : new Date());
    if (d1 && !isNaN(d1.getTime()) && d2 && !isNaN(d2.getTime())) {
      holdingDays = Math.max(0, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }
}
```
**Symptoms / Failure Points:**
1. **Trade 3 (LT):** Entry `2026-05-10`, Exit `2026-05-30`. Expected = `20 days`. Displayed = `18 days`. (Bypassed by static `t.holdingDays` value from import).
2. **Trade 4 (JSWSTEEL):** Entry `2026-05-20`, Partial Exit `2026-06-04`. Expected = `11 trading / 15 calendar days`. Displayed = `58 days` because `isClosed` is `false`, which made `d2` fall back to `new Date()` (today).
3. **Trade 7 (ONGC):** Entry `2026-06-05`, Final E4 Exit `2026-07-25`. Expected = `50 days`. Displayed = `29 days` (from stale imported field instead of calculating against E4 exit date).

---

### Problem 2: Live CMP Market Stream Overriding Benchmark/Backtest CMPs
**Current Code Location:** `src/Dashboard.jsx:601`
```javascript
// Current snippet:
const cmp = liveCMPs[t.name?.toUpperCase()] || parseFloat(t.cmp) || 0;
```
**Symptoms / Failure Points:**
- When real-time market data is streaming, `liveCMPs` unconditionally overwrites the test/input `cmp` for open positions:
  - **JSWSTEEL:** Input CMP 860 overridden by live CMP 1313.50 $\rightarrow$ Unrealised P/L drops to `-21,175` instead of `+1500`.
  - **TATASTEEL:** Input CMP 175 overridden by live CMP 184.07 $\rightarrow$ Unrealised P/L shifts from `+2000` to `+3814`.
  - **BEL:** Input CMP 310 overridden by live CMP 411.20 $\rightarrow$ Unrealised P/L shifts from `+3000` to `+13120`.
  - **VEDL:** Input CMP 400 overridden by live CMP 274.00 $\rightarrow$ Unrealised P/L shifts from `+3000` to `+21900`.

---

### Problem 3: Table Column Ambiguity on Partial Trades (Realised vs Gross P/L)
**Current Code Location:** `src/components/JournalTable.jsx:82-84`
```javascript
// Current column definition in JournalTable.jsx:
{ id: 'realisedAmount', label: 'REALISED AMOUNT', unit: '(₹)', width: '140px', align: 'right' },
{ id: 'grossPnl', label: 'Gross P/L', unit: '(₹)', width: '125px', align: 'right' },
```
**Symptoms / Failure Points:**
- For `Partial` trades like **JSWSTEEL**:
  - `Realised P/L` is `+2,000.00` (from 50 shares covered at 850 vs entry 890).
  - `Unrealised P/L` is `+1,500.00` (from remaining 50 open shares at CMP 860 vs entry 890).
  - `Gross P/L` is `+3,500.00`.
- In the table UI, only `Gross P/L` is displayed, which renders the combined total P/L. There is no discrete `Realised P/L` (`pnl`) column available in the default table view.

---

### Problem 4: Missing Per-Row Columns for `Profit Protected` and `Profit Risk (₹)`
**Current Code Location:** `src/Dashboard.jsx:928-948`
```javascript
// Currently aggregated ONLY at the portfolio level in metrics:
const profitProtected = openTrades.reduce((acc, t) => {
  const avgEntry = t.avgEntry || t.entry || 0;
  const tsl = parseFloat(t.tsl) || 0;
  const openQty = t.openQty || 0;
  const isSell = (t.type || 'Buy').toLowerCase() === 'sell';
  if (openQty <= 0 || tsl <= 0) return acc;
  if (!isSell && tsl > avgEntry) return acc + (tsl - avgEntry) * openQty;
  if (isSell && tsl < avgEntry) return acc + (avgEntry - tsl) * openQty;
  return acc;
}, 0);
```
**Symptoms / Failure Points:**
- Trade 4 (JSWSTEEL) has `Profit Protected = ₹1,000.00` and Trade 6 (BEL) has `Profit Protected = ₹2,000.00`.
- While the top summary header correctly shows `PROFIT PROTECTED = ₹3,000`, individual rows in `JournalTable.jsx` cannot display their respective `Profit Protected` or `Profit Risk` because these fields are not attached to the per-trade enriched object or registered in `ColumnsPopover.jsx`.

---

## 6. What the Incoming AI Assistant / Engineer Needs to Solve

1. **Fix Dynamic Holding Days:**
   - Ensure holding days are calculated directly from trade dates rather than relying on stale imported numbers.
   - For `Closed` trades, calculate the difference between initial entry date and the latest exit leg date.
   - For `Partial` trades, calculate the holding duration of the executed exit legs.
   - For active `Open` trades, calculate days up to the current date.
   - Ensure same-day trades (`Trade 8`) output `0`, not blank or 1.

2. **Handle CMP Precedence:**
   - Allow benchmark/test trades with explicitly fixed CMPs to avoid being unintentionally overridden by live WebSocket market updates.

3. **Expose Discrete P/L and Risk Columns:**
   - Provide distinct fields for `Realised P/L` (`pnl`), `Unrealised P/L` (`unrealized`), `Gross P/L` (`grossPnl`), `Profit Protected` (`profitProtected`), and `Profit Risk` (`profitRisk`) both on the trade object and in the journal table column options.

4. **Preserve Validated Formulas:**
   - Preserve raw price movement tracking for `Stock Move %` (confirming negative price movement on short trades like PAYTM).
   - Ensure `Reward:Risk` and `SL %` handle missing stop loss cleanly (rendering `—` without division by zero errors).
   - Maintain breakeven trade exclusion from Win Rate calculations (`metrics.winRate`).
