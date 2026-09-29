# FoxTrade (TradeOnTip) Calculation Engine Specification, Benchmark & Fix Guide

> **Target Audience:** AI Coding Assistants (Claude 3.7 / 3.5 Sonnet, GPT-4o, Gemini Pro) and Senior Full-Stack Engineers.
> **Scope:** Comprehensive problem report, mathematical formula definitions, 10-trade verification benchmark, and complete drop-in replacement code for the calculation engine in **FoxTrade / TradeOnTip** (`foxtrade.in`).

---

## 1. System Architecture & Context

### 1.1 Project Overview
- **Application:** FoxTrade (`foxtrade.in`) / TradeOnTip — Institutional-grade Indian equity swing trading journal web app.
- **Tech Stack:** React 18 (Vite), Tailwind CSS, Lucide Icons, Lightweight Charts.
- **Key Modules:**
  - `src/Dashboard.jsx`: Main state management, trade calculation engine (`enrichTradeWithLegs`), portfolio KPI aggregation (`metrics`), CSV import/export.
  - `src/components/JournalTable.jsx`: Main journal view, columns rendering, expandable legs, tooltips.
  - `src/components/AddTradeModal.jsx`: Multi-leg entry/exit trade editor.
  - `src/components/ColumnsPopover.jsx`: Customizable table column picker.
  - `src/services/tradingViewSocketService.js`: Real-time WebSocket feed for NSE/BSE stock quotes.

### 1.2 Data Model: Multi-Leg Pyramids & Scaled Exits
A trade record supports up to 5 entry legs (Initial + P1..P4) and up to 4 scaled exit legs (E1..E4):
```typescript
interface TradeRecord {
  id: string;
  tradeNo: number;
  date: string;               // ISO format: YYYY-MM-DD (Initial entry date)
  name: string;               // Symbol (e.g. WIPRO, PAYTM, LT, JSWSTEEL, etc.)
  setup: string;              // Technical setup
  type: "Buy" | "Sell";       // Direction (Long / Short)
  entry: number;              // Initial leg entry price
  qty: number;                // Initial leg quantity
  sl?: number;                // Initial stop loss
  cmp?: number;               // Current market price / test CMP
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

  // Metadata
  planFollowed?: "Yes" | "No";
  exitTrigger?: string;
  growthAreas?: string;
  quickNote?: string;
}
```

---

## 2. Complete 10-Trade Raw Input Dataset

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

## 3. Benchmark Verification Table (`foxtrade_verification_expected_results.csv`)

| Trade No | Name | Field | Expected Value | Derivation & Calculation Rule |
| :---: | :--- | :--- | :--- | :--- |
| **1** | WIPRO | Avg Entry | `450.00` | Single leg, no VWAP needed. |
| **1** | WIPRO | Avg Exit Price | `480.00` | Single exit leg. |
| **1** | WIPRO | Open Qty | `0` | Fully exited. |
| **1** | WIPRO | Position Status | `Closed` | `openQty === 0` |
| **1** | WIPRO | Stock Move % | `6.67%` | `(480 - 450) / 450 * 100` |
| **1** | WIPRO | SL % | `4.44%` | `|450 - 430| / 450 * 100` |
| **1** | WIPRO | Reward:Risk | `1.50` | `reward = 30`, `risk = 20` $\rightarrow$ `30 / 20 = 1.50R` |
| **1** | WIPRO | Holding Days | `10` | `2026-05-01` to `2026-05-11` (10 calendar days). |
| **1** | WIPRO | Realised P/L | `3000.00` | `(480 - 450) * 100` |
| **1** | WIPRO | Realised Amount (Buy) | `48000.00` | `avgExit * qty = 480 * 100` |
| **2** | PAYTM | Avg Entry | `800.00` | Single short entry leg. |
| **2** | PAYTM | Avg Exit Price | `750.00` | Single cover exit leg. |
| **2** | PAYTM | Position Status | `Closed` | `openQty === 0` |
| **2** | PAYTM | Realised P/L | `5000.00` | SELL: `(800 - 750) * 100 = +5000.00` (must be positive). |
| **2** | PAYTM | Stock Move % | `-6.25%` | Raw price move `(750 - 800) / 800 * 100 = -6.25%` (negative price change). |
| **2** | PAYTM | SL % | `5.00%` | `|800 - 840| / 800 * 100` |
| **2** | PAYTM | Reward:Risk | `1.25` | Economic reward = 50, risk = 40 $\rightarrow$ `50 / 40 = 1.25R`. |
| **2** | PAYTM | Holding Days | `5` | `2026-05-05` to `2026-05-10` (5 calendar days). |
| **2** | PAYTM | Realised Amount (Sell) | `85000.00` | Documented standard: `avgEntry * qty + pnl = 800 * 100 + 5000 = 85000.00`. |
| **3** | LT | Avg Entry (VWAP) | `3250.00` | `(3200 * 20 + 3300 * 20) / 40` |
| **3** | LT | Avg Exit Price | `3500.00` | Exit leg price. |
| **3** | LT | Stock Move % | `7.69%` | `(3500 - 3250) / 3250 * 100` (measured against VWAP). |
| **3** | LT | SL % | `3.13%` | Uses INITIAL entry 3200: `|3200 - 3100| / 3200 * 100`. |
| **3** | LT | Position Size | `130000.00` | `avgEntry * totalQtyEntered = 3250 * 40`. |
| **3** | LT | Realised P/L | `10000.00` | `(3500 - 3250) * 40`. |
| **3** | LT | Holding Days | `20` | `2026-05-10` to `2026-05-30` (20 calendar days). |
| **4** | JSWSTEEL | Avg Entry (VWAP, short) | `890.00` | `(900 * 50 + 880 * 50) / 100`. |
| **4** | JSWSTEEL | Open Qty | `50` | `100 entered - 50 exited`. |
| **4** | JSWSTEEL | Exited Qty | `50` | Partial cover leg qty. |
| **4** | JSWSTEEL | Position Status | `Partial` | `openQty > 0 && exitedQty > 0`. |
| **4** | JSWSTEEL | Avg Exit Price | `850.00` | Partial cover exit price. |
| **4** | JSWSTEEL | Realised P/L | `2000.00` | SELL: `(890 - 850) * 50`. |
| **4** | JSWSTEEL | Unrealised P/L | `1500.00` | SELL at CMP 860: `(890 - 860) * 50 = +1500.00`. |
| **4** | JSWSTEEL | Gross P/L | `3500.00` | `2000 realised + 1500 unrealised`. |
| **4** | JSWSTEEL | Profit Protected | `1000.00` | TSL 870 < avgEntry 890 for Short $\rightarrow$ `(890 - 870) * 50 = 1000.00`. |
| **4** | JSWSTEEL | Holding Days (partial exit leg) | `11` (or 15 cal) | `2026-05-20` to `2026-06-04` (15 calendar / 11 trading days). |
| **5** | TATASTEEL | Avg Entry | `165.00` | Single entry leg. |
| **5** | TATASTEEL | SL % | `BLANK or N/A` | No SL set $\rightarrow$ must render `—`, never `0.00%` or crash. |
| **5** | TATASTEEL | Reward:Risk | `BLANK or N/A` | Risk undefined without SL $\rightarrow$ must render `—`. |
| **5** | TATASTEEL | Position Status | `Open` | Fully active position. |
| **5** | TATASTEEL | Holding Days | `17` | `2026-08-15` to `2026-09-01` (today). |
| **5** | TATASTEEL | Unrealised P/L | `2000.00` | BUY at test CMP 175: `(175 - 165) * 200`. |
| **6** | BEL | Avg Entry | `280.00` | Single entry leg. |
| **6** | BEL | Position Status | `Open` | Fully active position. |
| **6** | BEL | Capital At Risk | `0.00 (₹0.00)` | TSL 300 > avgEntry 280 $\rightarrow$ zero downside risk below cost basis. |
| **6** | BEL | Profit Protected | `2000.00` | `(TSL 300 - avgEntry 280) * 100 = 2000.00`. |
| **6** | BEL | Profit Risk (rupee) | `1000.00` | `max(0, CMP 310 - TSL 300) * 100 = 1000.00` (must be nonzero). |
| **6** | BEL | Unrealised P/L | `3000.00` | BUY at test CMP 310: `(310 - 280) * 100`. |
| **7** | ONGC | Avg Exit Price (4 legs) | `285.00` | `(270*20 + 280*20 + 290*20 + 300*20) / 80`. |
| **7** | ONGC | Realised P/L | `2000.00` | `(285 - 260) * 80`. |
| **7** | ONGC | Position Status | `Closed` | Fully exited after 4th leg. |
| **7** | ONGC | E4 field wired up? | `300 / 20 / 2026-07-25` | Confirms E4 leg is correctly parsed into arithmetic. |
| **7** | ONGC | Holding Days | `50` | `2026-06-05` to `2026-07-25` (final exit date E4). |
| **8** | IRCTC | Holding Days | `0` | Same date entry & exit `2026-07-10` $\rightarrow$ must show `0`, not blank or 1. |
| **8** | IRCTC | Realised P/L | `750.00` | `(715 - 700) * 50`. |
| **8** | IRCTC | Position Status | `Closed` | Fully exited. |
| **9** | VEDL | Avg Entry | `420.00` | Short trade entry. |
| **9** | VEDL | Position Status | `Open` | Fully active short position. |
| **9** | VEDL | Unrealised P/L | `3000.00` | SELL at test CMP 400: `(420 - 400) * 150`. |
| **9** | VEDL | Capital At Risk (rupee) | `2250.00` | Short downside risk: `(SL 435 - avgEntry 420) * 150 = 2250.00`. |
| **10** | BAJFINANCE | Realised P/L | `0.00` | Exact breakeven trade. |
| **10** | BAJFINANCE | Stock Move % | `0.00%` | Zero price movement. |
| **10** | BAJFINANCE | Win Rate treatment | `EXCLUDED` | Breakeven excluded from both numerator and denominator in Win Rate. |

---

## 4. Live Verification Results (Expected vs Actual)

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
| **4** | JSWSTEEL | Realised P/L | 2000.00 | -₹19,175.00 *(Gross P/L column)* | **N** |
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

## 5. Root Cause Analysis & Technical Fixes

### 5.1 Bug 1: Holding Days Logic
- **Root Cause:** In `src/Dashboard.jsx:743-765`, `t.holdingDays` from imported CSV bypasses dynamic date calculation. Also, for partial positions (`JSWSTEEL`), `isClosed` is false, causing fallback to `new Date()` (today: 58 days) rather than calculating holding duration of the exit leg.
- **Fix:** Compute dynamically from UTC parsed dates (`d2 - d1`). For `status === "Closed"` or `status === "Partial"`, extract the maximum date from `[e4Date, e3Date, e2Date, e1Date]`.

### 5.2 Bug 2: Live CMP Market WebSocket Overwrite
- **Root Cause:** In `src/Dashboard.jsx:601`, `liveCMPs[t.name]` takes unconditional precedence over `t.cmp`. When viewing backtest trades or manual test inputs, live market price drift alters Unrealised P/L and Gross P/L.
- **Fix:** Support a `t.isManualCmp` flag or allow static `t.cmp` retention when backtesting/verifying.

### 5.3 Bug 3: Realised P/L vs Gross P/L Column Separation
- **Root Cause:** `src/components/JournalTable.jsx` only displays `Gross P/L` by default.
- **Fix:** Add a dedicated `pnl` (`Realised P/L`) column alongside `grossPnl` and `unrealized` in `ColumnsPopover.jsx` and `JournalTable.jsx`.

### 5.4 Bug 4: Per-Trade Profit Protected & Profit Risk
- **Root Cause:** Computed only at the aggregate portfolio level in `metrics` (`src/Dashboard.jsx:928-948`).
- **Fix:** Attach `profitProtected` and `profitRisk` directly to each enriched trade record.

---

## 6. Complete Drop-In Replacement Code for src/Dashboard.jsx

```javascript
// Replace enrichTradeWithLegs in src/Dashboard.jsx:
export const enrichTradeWithLegs = (t, liveCMPs = {}, PORTFOLIO_CAPITAL = 200000, BASE_CAPITAL = 200000) => {
  const isSell = (t.type || "Buy").toLowerCase() === "sell";
  
  // 1. CMP Resolution: Use manual/frozen CMP if set, otherwise live CMP fallback
  const cmp = t.isManualCmp 
    ? (parseFloat(t.cmp) || 0)
    : (liveCMPs[t.name?.toUpperCase()] || parseFloat(t.cmp) || 0);

  const entry = parseFloat(t.entry) || 0;
  const qty = parseFloat(t.qty) || 0;
  const sl = (t.sl !== undefined && t.sl !== null && t.sl !== "" && !isNaN(Number(t.sl)) && Number(t.sl) > 0) ? Number(t.sl) : null;
  const tsl = parseFloat(t.tsl) || 0;

  const p1Price = parseFloat(t.p1Price) || 0; const p1Qty = parseFloat(t.p1Qty) || 0;
  const p1Sl = parseFloat(t.p1Sl) || null;
  const p2Price = parseFloat(t.p2Price) || 0; const p2Qty = parseFloat(t.p2Qty) || 0;
  const p2Sl = parseFloat(t.p2Sl) || null;
  const p3Price = parseFloat(t.p3Price) || 0; const p3Qty = parseFloat(t.p3Qty) || 0;
  const p3Sl = parseFloat(t.p3Sl) || null;
  const p4Price = parseFloat(t.p4Price) || 0; const p4Qty = parseFloat(t.p4Qty) || 0;
  const p4Sl = parseFloat(t.p4Sl) || null;

  const e1Price = parseFloat(t.e1Price) || 0; const e1Qty = parseFloat(t.e1Qty) || 0;
  const e2Price = parseFloat(t.e2Price) || 0; const e2Qty = parseFloat(t.e2Qty) || 0;
  const e3Price = parseFloat(t.e3Price) || 0; const e3Qty = parseFloat(t.e3Qty) || 0;
  const e4Price = parseFloat(t.e4Price) || 0; const e4Qty = parseFloat(t.e4Qty) || 0;

  // 2. Entry VWAP & Total Position Size
  const totalQtyEntered = qty + p1Qty + p2Qty + p3Qty + p4Qty;
  const totalCost = (qty * entry) + (p1Qty * p1Price) + (p2Qty * p2Price) + (p3Qty * p3Price) + (p4Qty * p4Price);
  const hasLegData = totalQtyEntered > 0 && totalCost > 0;
  const avgEntry = hasLegData ? totalCost / totalQtyEntered : (parseFloat(t.avgEntry) || entry);

  // 3. Exit VWAP
  const totalQtyExited = e1Qty + e2Qty + e3Qty + e4Qty;
  const totalExitValue = (e1Qty * e1Price) + (e2Qty * e2Price) + (e3Qty * e3Price) + (e4Qty * e4Price);
  const hasExitLegData = totalQtyExited > 0 && totalExitValue > 0;
  const avgExitPrice = hasExitLegData ? totalExitValue / totalQtyExited : (parseFloat(t.avgExitPrice) || 0);

  // 4. Quantities & Authoritative Status
  const openQty = Math.max(0, totalQtyEntered - totalQtyExited);
  let status = "Open";
  if (totalQtyEntered > 0) {
    if (openQty <= 0) status = "Closed";
    else if (totalQtyExited > 0) status = "Partial";
    else status = "Open";
  } else {
    status = t.status || "Open";
  }

  // 5. Position Sizing & Allocation
  const positionSize = avgEntry * (totalQtyEntered || qty);
  const peakAllocation = PORTFOLIO_CAPITAL > 0 ? (positionSize / PORTFOLIO_CAPITAL) * 100 : 0;
  const currentAllocation = PORTFOLIO_CAPITAL > 0 ? ((avgEntry * openQty) / PORTFOLIO_CAPITAL) * 100 : 0;

  // 6. Stop Loss % (Based on Initial Entry Price per spec)
  const slPct = (sl !== null && entry > 0) ? (Math.abs(entry - sl) / entry) * 100 : null;

  // 7. Realised P/L, Unrealised P/L, Gross P/L
  let pnl = 0;
  if (totalQtyExited > 0) {
    pnl = isSell ? (avgEntry - avgExitPrice) * totalQtyExited : (avgExitPrice - avgEntry) * totalQtyExited;
  }
  pnl = Math.round(pnl * 100) / 100;

  const unrealized = (openQty > 0 && cmp > 0)
    ? (isSell ? (avgEntry - cmp) * openQty : (cmp - avgEntry) * openQty)
    : 0;

  const grossPnl = Math.round((pnl + unrealized) * 100) / 100;
  const pfImpact = BASE_CAPITAL > 0 ? (pnl / BASE_CAPITAL) * 100 : 0;

  // 8. Profit Protected & Profit Risk (Per-Trade)
  let profitProtected = 0;
  let profitRisk = 0;
  let tradeCapitalAtRisk = 0;

  if (openQty > 0) {
    if (!isSell) {
      // BUY SIDE
      if (tsl > avgEntry) {
        profitProtected = (tsl - avgEntry) * openQty;
      }
      if (cmp > 0 && tsl > 0) {
        profitRisk = Math.max(0, cmp - tsl) * openQty;
      }
      if (tsl > 0 && tsl < avgEntry) {
        tradeCapitalAtRisk = (avgEntry - tsl) * openQty;
      } else if (tsl === 0 && sl !== null && sl < avgEntry) {
        tradeCapitalAtRisk = (avgEntry - sl) * openQty;
      }
    } else {
      // SELL SIDE (SHORT)
      if (tsl > 0 && tsl < avgEntry) {
        profitProtected = (avgEntry - tsl) * openQty;
      }
      if (cmp > 0 && tsl > 0) {
        profitRisk = Math.max(0, tsl - cmp) * openQty;
      }
      if (tsl > 0 && tsl > avgEntry) {
        tradeCapitalAtRisk = (tsl - avgEntry) * openQty;
      } else if (tsl === 0 && sl !== null && sl > avgEntry) {
        tradeCapitalAtRisk = (sl - avgEntry) * openQty;
      }
    }
  }

  const capitalAtRiskPct = PORTFOLIO_CAPITAL > 0 ? (tradeCapitalAtRisk / PORTFOLIO_CAPITAL) * 100 : 0;

  // 9. Reward : Risk (Blended multi-leg pyramid risk)
  const legRisks = [
    { q: qty, ep: entry, lsl: sl },
    { q: p1Qty, ep: p1Price, lsl: p1Sl },
    { q: p2Qty, ep: p2Price, lsl: p2Sl },
    { q: p3Qty, ep: p3Price, lsl: p3Sl },
    { q: p4Qty, ep: p4Price, lsl: p4Sl },
  ].reduce((acc, leg) => {
    if (leg.q > 0 && leg.ep > 0 && leg.lsl !== null && leg.lsl > 0) {
      return acc + leg.q * Math.abs(leg.ep - leg.lsl);
    }
    return acc;
  }, 0);

  const riskPerShare = totalQtyEntered > 0 && legRisks > 0
    ? legRisks / totalQtyEntered
    : (sl !== null && sl > 0 ? Math.abs(entry - sl) : null);

  const rawReward = isSell
    ? (totalQtyExited > 0 ? avgEntry - avgExitPrice : avgEntry - cmp)
    : (totalQtyExited > 0 ? avgExitPrice - avgEntry : cmp - avgEntry);

  const rewardRisk = (riskPerShare !== null && riskPerShare > 0 && (totalQtyExited > 0 || cmp > 0 || (status === "Closed" && avgExitPrice > 0)))
    ? Math.round((rawReward / riskPerShare) * 100) / 100
    : null;

  // 10. Stock Move % (Raw price move against VWAP entry)
  const exitOrCmp = totalQtyExited > 0 ? avgExitPrice : (status === "Closed" && avgExitPrice > 0 ? avgExitPrice : cmp);
  const stockMove = (avgEntry > 0 && exitOrCmp > 0)
    ? ((exitOrCmp - avgEntry) / avgEntry) * 100
    : 0;

  // 11. Realised Amount (₹)
  const realisedAmount = totalQtyExited > 0
    ? (isSell ? (avgEntry * totalQtyExited + pnl) : (avgExitPrice * totalQtyExited))
    : (status === "Closed" && t.realisedAmount ? parseFloat(t.realisedAmount) : 0);

  // 12. Dynamic Calendar Holding Days Calculation
  const parseDate = (str) => {
    if (!str) return null;
    if (str.includes("T")) str = str.split("T")[0];
    const parts = str.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      return new Date(Date.UTC(parts[2], parts[1] - 1, parts[0]));
    }
    return new Date(str);
  };

  let holdingDays = 0;
  if (t.date) {
    const d1 = parseDate(t.date);
    const exitDates = [t.e4Date, t.e3Date, t.e2Date, t.e1Date, t.exitDate]
      .filter(d => d && typeof d === "string" && d.trim() !== "")
      .map(parseDate)
      .filter(d => d && !isNaN(d.getTime()));

    let d2 = null;
    if (status === "Closed" && exitDates.length > 0) {
      d2 = new Date(Math.max(...exitDates.map(d => d.getTime())));
    } else if (status === "Partial" && exitDates.length > 0) {
      d2 = new Date(Math.max(...exitDates.map(d => d.getTime())));
    } else {
      const now = new Date();
      d2 = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    }

    if (d1 && !isNaN(d1.getTime()) && d2 && !isNaN(d2.getTime())) {
      holdingDays = Math.max(0, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }

  return {
    ...t,
    cmp,
    avgEntry: Math.round(avgEntry * 10000) / 10000,
    openQty,
    exitedQty: totalQtyExited,
    avgExitPrice: Math.round(avgExitPrice * 10000) / 10000,
    status,
    positionSize: Math.round(positionSize * 100) / 100,
    currentAllocation: Math.round(currentAllocation * 100) / 100,
    peakAllocation: Math.round(peakAllocation * 100) / 100,
    sl,
    slPct: slPct !== null ? Math.round(slPct * 100) / 100 : null,
    pnl: Math.round(pnl * 100) / 100,
    unrealized: Math.round(unrealized * 100) / 100,
    grossPnl: Math.round(grossPnl * 100) / 100,
    profitProtected: Math.round(profitProtected * 100) / 100,
    profitRisk: Math.round(profitRisk * 100) / 100,
    capitalAtRisk: Math.round(capitalAtRiskPct * 100) / 100,
    tradeCapitalAtRisk: Math.round(tradeCapitalAtRisk * 100) / 100,
    pfImpact: Math.round(pfImpact * 100) / 100,
    rewardRisk,
    stockMove: Math.round(stockMove * 100) / 100,
    realisedAmount: Math.round(realisedAmount * 100) / 100,
    holdingDays
  };
};
```
