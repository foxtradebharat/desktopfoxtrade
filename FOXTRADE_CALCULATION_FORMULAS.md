# FoxTrade (TradeOnTip) — Master Calculation Engine Specification & Formulas

This document serves as the **single source of truth and authoritative calculation specification** for **FoxTrade / TradeOnTip** (`foxtrade.in`). 
If any part of the calculation engine goes off track during future development or refactoring, use this document to immediately rewire and restore the mathematical logic.

---

## 1. Trade Data Model & Multi-Leg Architecture

A trade supports up to **5 Entry Legs** (Initial + P1..P4), **4 Exit Legs** (E1..E4), Stop Losses per leg, Trailing Stop Loss (TSL), and Current Market Price (CMP).

| Parameter | Identifier | Description |
| :--- | :--- | :--- |
| **Initial Entry** | `entry`, `qty` (or `initialQty`), `date`, `time`, `sl` | Base position entry price, quantity, entry date/time, and stop loss. |
| **Pyramid Entries (P1..P4)** | `p1Price`..`p4Price`, `p1Qty`..`p4Qty`, `p1Date`..`p4Date`, `p1Sl`..`p4Sl` | Additional scale-in entries with leg-specific price, quantity, date, and stop loss. |
| **Exit Legs (E1..E4)** | `e1Price`..`e4Price`, `e1Qty`..`e4Qty`, `e1Date`..`e4Date`, `e1Time`..`e4Time` | Staged partial or complete profit taking/exit legs. |
| **Trailing Stop Loss** | `tsl` | Dynamic stop price protecting open lots. |
| **Market Price** | `cmp` | Live real-time market price (WebSocket / manual override) for open valuation. |
| **Account Capital** | `C` (`portfolioCapital` / `baseFundCapital`) | Active portfolio capital base (e.g. ₹2,00,000.00). |

---

## 2. Core Per-Trade Formulas & Algorithms

### 2.1 Position Size (Total Capital Deployed)
$$\text{Position Size} = \sum_{i=0}^{n} (\text{Entry Price}_i \times \text{Entry Qty}_i) = (\text{Entry} \times \text{Initial Qty}) + \sum_{k=1}^{4} (\text{P}_k\text{Price} \times \text{P}_k\text{Qty})$$

---

### 2.2 Quantities & Position Status Lifecycle
1. **Total Entered Quantity**:
   $$\text{Total Qty Entered} = \text{Initial Qty} + \sum_{k=1}^{4} \text{P}_k\text{Qty}$$
2. **Total Exited Quantity (`exitedQty`)**:
   $$\text{Exited Qty} = \sum_{j=1}^{4} \text{E}_j\text{Qty}$$
3. **Open Quantity (`openQty`)**:
   $$\text{Open Qty} = \max(0, \text{Total Qty Entered} - \text{Exited Qty})$$
4. **Position Status (`status`)**:
   $$\text{Status} = \begin{cases} \mathbf{Closed}, & \text{if } \text{Open Qty} == 0 \text{ and } \text{Exited Qty} > 0 \\ \mathbf{Partial}, & \text{if } \text{Open Qty} > 0 \text{ and } \text{Exited Qty} > 0 \\ \mathbf{Open}, & \text{if } \text{Open Qty} > 0 \text{ and } \text{Exited Qty} == 0 \end{cases}$$

---

### 2.3 Lot-Level Cost Basis Engine & Average Entry (`avgEntry`)
1. **For `Open` and `Closed` Positions (Baseline VWAP)**:
   $$\text{Avg Entry} = \frac{\sum_{i=0}^{n} (\text{Entry Price}_i \times \text{Entry Qty}_i)}{\text{Total Qty Entered}}$$

2. **For `Partial` Positions (LIFO / FIFO Matching Engine)**:
   - **LIFO (Default)**: Exits consume newest entries first ($P_4 \to P_3 \to P_2 \to P_1 \to \text{Initial}$).
   - **FIFO**: Exits consume earliest entries first ($\text{Initial} \to P_1 \to P_2 \to P_3 \to P_4$).
   - `avgEntry` for remaining open lots:
     $$\text{Avg Entry}_{\text{partial}} = \frac{\sum_{\text{remaining lots } r} (\text{Remaining Price}_r \times \text{Remaining Qty}_r)}{\text{Open Qty}}$$

---

### 2.4 Average Exit Price & Realised Amount
1. **Average Exit Price (`avgExitPrice`)**:
   $$\text{Avg Exit Price} = \frac{\sum_{j=1}^{4} (\text{E}_j\text{Price} \times \text{E}_j\text{Qty})}{\text{Exited Qty}}$$
2. **Realised Amount (`realisedAmount`)**:
   $$\text{Realised Amount} = \sum_{j=1}^{4} (\text{E}_j\text{Price} \times \text{E}_j\text{Qty}) = \text{Exited Qty} \times \text{Avg Exit Price}$$

---

### 2.5 Realized Profit & Loss (`pl` / `grossPnl`)
Calculated by matching each exit lot against entry lots according to LIFO / FIFO order:
- **For Buy (Long) Trades**:
  $$\text{Realized P/L} = \sum_{\text{matched lots } m} \text{Matched Qty}_m \times (\text{Exit Price}_m - \text{Entry Price}_m)$$
- **For Sell (Short) Trades**:
  $$\text{Realized P/L} = \sum_{\text{matched lots } m} \text{Matched Qty}_m \times (\text{Entry Price}_m - \text{Exit Price}_m)$$

---

### 2.6 Unrealized Profit & Loss (`unrealized`)
Evaluated strictly on remaining open lots at live Market Price (`CMP`):
$$\text{Unrealized P/L} = \begin{cases} \text{Open Qty} \times (\text{CMP} - \text{Avg Entry}_{\text{open}}), & \text{for Buy (Long)} \\ \text{Open Qty} \times (\text{Avg Entry}_{\text{open}} - \text{CMP}), & \text{for Sell (Short)} \\ 0, & \text{if } \text{Open Qty} == 0 \end{cases}$$

---

### 2.7 Stop Loss Percentage (`slPct`)
Calculated strictly with respect to the initial base entry price:
$$\text{SL \%} = \frac{|\text{Initial Entry} - \text{Initial SL}|}{\text{Initial Entry}} \times 100$$
*(If no SL is provided, renders `—` / `null`)*

---

### 2.8 Stock Move Percentage (`stockMove`)
Status-dependent blended price move formula:

1. **For `Closed` Position**:
   $$\text{Stock Move \%} = \begin{cases} \frac{\text{Avg Exit Price} - \text{Avg Entry}}{\text{Avg Entry}} \times 100, & \text{for Buy} \\ \frac{\text{Avg Entry} - \text{Avg Exit Price}}{\text{Avg Entry}} \times 100, & \text{for Sell} \end{cases}$$

2. **For `Open` Position**:
   $$\text{Stock Move \%} = \begin{cases} \frac{\text{CMP} - \text{Avg Entry}}{\text{Avg Entry}} \times 100, & \text{for Buy} \\ \frac{\text{Avg Entry} - \text{CMP}}{\text{Avg Entry}} \times 100, & \text{for Sell} \end{cases}$$

3. **For `Partial` Position (Weighted Blended Move)**:
   $$\text{Stock Move \%} = \frac{\text{Exited Qty} \times \text{Move}(\text{Avg Exit Price}, \text{Avg Entry}) + \text{Open Qty} \times \text{Move}(\text{CMP}, \text{Avg Entry})}{\text{Exited Qty} + \text{Open Qty}}$$
   where $\text{Move}(P, E) = \frac{P - E}{E} \times 100$ for Buy, and $\frac{E - P}{E} \times 100$ for Sell.

---

### 2.9 Reward : Risk Ratio (R-Multiple) (`rewardRisk` / `weightedRR`)
1. **Total Initial Risk**: Sum of initial risk over each entered leg:
   $$\text{Leg Risk}_i = \text{Qty}_i \times |\text{Price}_i - \text{Effective Initial SL}_i|$$
   $$\text{Total Initial Risk} = \sum_{i} \text{Leg Risk}_i$$
   *(where $\text{Effective Initial SL}_i$ falls back to Initial SL if $\text{P}_i\text{SL}$ is not specified)*

2. **Total Gain**:
   $$\text{Total Gain} = \text{Realized P/L} + \text{Unrealized P/L}$$

3. **R-Multiple**:
   $$\text{Reward : Risk} = \frac{\text{Total Gain}}{\text{Total Initial Risk}}$$

---

### 2.10 Capital at Risk % / Open Heat (`capitalAtRisk` / `openHeat`)
1. For each remaining open lot $i$, determine its **Effective Stop**:
   $$\text{Effective Stop}_i = \begin{cases} \max(\text{Leg SL}_i, \text{TSL}), & \text{for Buy} \\ \min(\text{Leg SL}_i, \text{TSL}), & \text{for Sell} \end{cases}$$

2. Calculate **P/L if stopped out** for each open lot:
   $$\text{P/L at Stop}_i = \begin{cases} \text{Remaining Qty}_i \times (\text{Effective Stop}_i - \text{Price}_i), & \text{for Buy} \\ \text{Remaining Qty}_i \times (\text{Price}_i - \text{Effective Stop}_i), & \text{for Sell} \end{cases}$$

3. Calculate **Net P/L at Stop**:
   $$\text{Net P/L at Stop} = \sum_{i} \text{P/L at Stop}_i$$

4. Determine **Capital at Risk**:
   - **If $\text{Net P/L at Stop} < 0$ (Capital loss on stop out):**
     $$\text{Trade Risk Amount (₹)} = |\text{Net P/L at Stop}|$$
     $$\text{Capital at Risk \%} = \frac{\text{Trade Risk Amount}}{\text{Account Capital}} \times 100$$
   - **If $\text{Net P/L at Stop} \ge 0$ (Breakeven or profit locked by stop) OR `Closed`:**
     $$\text{Capital at Risk \%} = \mathbf{0.00\%} \quad (\text{₹0.00})$$

---

### 2.11 Profit Protected (₹ and % of pf)
Guaranteed profit locked in if stopped out:
- **For Buy (Long)**:
  $$\text{Profit Protected (₹)} = \max\Big(0, \, (\text{Effective Stop} - \text{Avg Entry}) \times \text{Open Qty}\Big)$$
- **For Sell (Short)**:
  $$\text{Profit Protected (₹)} = \max\Big(0, \, (\text{Avg Entry} - \text{Effective Stop}) \times \text{Open Qty}\Big)$$

---

### 2.12 Holding Days (`holdingDays`)
Calendar-day quantity-weighted duration:
- For matched exit legs: $\text{Days} = \lfloor(\text{Exit Date Ms} - \text{Entry Date Ms}) / 86,400,000\rfloor$.
- For open lots: $\text{Days} = \lfloor(\text{Current Date Ms} - \text{Entry Date Ms}) / 86,400,000\rfloor$.
- Returns lot-quantity weighted average rounded to nearest integer:
  $$\text{Holding Days} = \text{round}\left(\frac{\sum (\text{Lot Qty}_k \times \text{Days}_k)}{\sum \text{Lot Qty}_k}\right)$$

---

### 2.13 Allocation % & Portfolio Impact %
1. **Current Allocation %**:
   $$\text{Current Allocation \%} = \frac{\text{Avg Entry}_{\text{open}} \times \text{Open Qty}}{\text{Account Capital}} \times 100$$
2. **Peak Allocation %**:
   $$\text{Peak Allocation \%} = \frac{\text{Position Size}}{\text{Account Capital}} \times 100$$
3. **Portfolio Impact % (`pfImpact`)**:
   $$\text{PF Impact \%} = \frac{\text{Realized P/L}}{\text{Account Capital}} \times 100$$

---

## 3. Dashboard Summary Cards Calculation

| Metric Card | Formula / Definition |
| :--- | :--- |
| **Total Trades** | $\text{Count of all trades in selected filter/date range}$ |
| **Open Positions** | $\text{Count of trades where } \text{status} \in \{\text{"Open"}, \text{"Partial"}\} \text{ and } \text{openQty} > 0$ |
| **Win Rate (P/L Method)** | $\frac{\text{Count of Closed/Partial Trades with Realized P/L} > 0}{\text{Total Closed/Partial Trades with Realized P/L} \ne 0} \times 100$ *(0 P/L breakeven excluded)* |
| **Win Rate (R-Multiple Method)**| $\frac{\text{Count of Closed Trades with R-Multiple} \ge 1.0\text{R}}{\text{Total Closed Trades with R-Multiple}} \times 100$ |
| **Gross Realized P/L** | $\sum \text{trade.pl}$ across all closed and partial trades |
| **Unrealized P/L** | $\sum \text{trade.unrealized}$ across all open and partial trades<br>$\text{Unrealized P/L (\% of pf)} = \frac{\text{Unrealized P/L}}{\text{Account Capital}} \times 100$ |
| **Capital at Risk %** | $\sum \text{trade.capitalAtRisk}$ across all open positions<br>$\text{Rupee Risk} = \sum \text{trade.riskAmount}$ |
| **Profit Protected** | $\sum \text{trade.profitProtected}$ across all open positions<br>$\text{Profit Protected (\% of pf)} = \frac{\text{Total Profit Protected}}{\text{Account Capital}} \times 100$ |
| **% Invested** | $\frac{\sum (\text{trade.openQty} \times \text{trade.avgEntry})}{\text{Account Capital}} \times 100$ |
| **Gross PF Impact % (All-Time)**| $\frac{\text{Gross Realized P/L}}{\text{Initial Base Capital}} \times 100$ |
| **Current Drawdown (Pre-Tax)** | Peak-to-trough drop % from highest cumulative equity curve watermark |

---

## 4. Drop-In Code Implementation File Reference

The master logic is implemented across:
- **`src/utils/nexusCalculationEngine.js`**: `matchLots`, `calculateOpenHeat`, `calculateRewardRisk`, `calculateStockMove`, `calculateWeightedHoldingDays`, `enrichTradeWithNexusFormulas`, `calculateDashboardStats`.
- **`src/Dashboard.jsx`**: `enrichTradeWithLegs`, `metrics`.
- **`src/utils/fundManagementCalculations.js`**: Monthly capital performance and CAGR compounding chain.
