# Nexus Journal — Complete Calculation Engine Specification & Formulas

This document provides the **100% exact mathematical formulas, algorithms, and logic** extracted directly from the verified client-side computation engine of **Nexus Trading Journal** (`useLicense-giTSfLCY.js`, `tradeAllocationCalculations-B8jbgRXm.js`, `holdingDays-BBAtQu6g.js`, `tradeMetricsUtils-ZSCimCoT.js`, and `JournalStatsWidget-DBPL06jY.js`).

---

## 1. Trade Data Model & Leg Structure

A trade in Nexus consists of multiple **Entry Legs** (Initial Entry, Pyramid 1..4), **Exit Legs** (Exit 1..4), Stop Losses per leg, a Trailing Stop Loss (TSL), and a Current Market Price (CMP).

| Field Type | Identifiers | Description |
| :--- | :--- | :--- |
| **Initial Entry** | `entry`, `qty` (or `initialQty`), `date`, `time`, `sl` | Base position entry price, quantity, timestamp, and initial stop loss. |
| **Pyramid Entries** | `p1Price`..`p4Price`, `p1Qty`..`p4Qty`, `p1Date`..`p4Date`, `p1Sl`..`p4Sl` | Additional entries (pyramiding) with individual prices, quantities, and stop losses. |
| **Exit Legs** | `e1Price`..`e4Price`, `e1Qty`..`e4Qty`, `e1Date`..`e4Date`, `e1Time`..`e4Time` | Staged partial or complete exits. |
| **Trailing Stop** | `tsl` | Dynamic trailing stop price protecting open lots. |
| **Market Price** | `cmp` | Live / Current Market Price for open lot valuation. |
| **Account Capital** | `ESC` (Effective Starting Capital) | Monthly performance base capital or active portfolio capital. |

---

## 2. Mathematical Formulas & Calculation Logic

### A. Position Size (Total Capital Deployed)
The total capital committed across all entry legs:
$$\text{Position Size} = \sum_{i=0}^{n} (\text{Entry Price}_i \times \text{Entry Qty}_i)$$
$$\text{Position Size} = (\text{Entry} \times \text{Initial Qty}) + \sum_{k=1}^{4} (\text{P}_k\text{Price} \times \text{P}_k\text{Qty})$$

---

### B. Quantities & Position Status Lifecycle
1. **Total Entered Quantity**:
   $$\text{Total Qty Entered} = \text{Initial Qty} + \sum_{k=1}^{4} \text{P}_k\text{Qty}$$
2. **Total Exited Quantity (`exitedQty`)**:
   $$\text{Exited Qty} = \sum_{j=1}^{4} \text{E}_j\text{Qty}$$
3. **Open Quantity (`openQty`)**:
   $$\text{Open Qty} = \max(0, \text{Total Qty Entered} - \text{Exited Qty})$$
4. **Position Status (`status`)**:
   $$\text{Status} = \begin{cases} \mathbf{Closed}, & \text{if } \text{Open Qty} == 0 \text{ and } \text{Exited Qty} > 0 \\ \mathbf{Partial}, & \text{if } \text{Open Qty} > 0 \text{ and } \text{Exited Qty} > 0 \\ \mathbf{Open}, & \text{if } \text{Open Qty} > 0 \text{ and } \text{Exited Qty} == 0 \end{cases}$$

---

### C. Average Entry Price (`avgEntry`)
Nexus computes `avgEntry` differently depending on the position lifecycle:

1. **For `Open` and `Closed` Positions (or baseline VWAP)**:
   $$\text{Avg Entry} = \frac{\sum_{i=0}^{n} (\text{Entry Price}_i \times \text{Entry Qty}_i)}{\text{Total Qty Entered}}$$

2. **For `Partial` Exits (Lot-Level Cost Basis Engine)**:
   Nexus matches exits against entry lots using the configured **Cost Basis Method** (`LIFO` or `FIFO`):
   - **LIFO (Default)**: Exits consume the most recent pyramid entries first ($P_4 \to P_3 \to P_2 \to P_1 \to \text{Initial}$).
   - **FIFO**: Exits consume the initial entry first ($\text{Initial} \to P_1 \to P_2 \to P_3 \to P_4$).
   - `avgEntry` for a partial position is the **weighted average price of the remaining open lots**:
     $$\text{Avg Entry}_{\text{partial}} = \frac{\sum_{\text{remaining lots } r} (\text{Remaining Price}_r \times \text{Remaining Qty}_r)}{\text{Open Qty}}$$

---

### D. Exit Averaging & Realised Amount
1. **Average Exit Price (`avgExitPrice`)**:
   $$\text{Avg Exit Price} = \frac{\sum_{j=1}^{4} (\text{E}_j\text{Price} \times \text{E}_j\text{Qty})}{\text{Exited Qty}}$$
2. **Realised Amount (`realisedAmount`)**:
   $$\text{Realised Amount} = \sum_{j=1}^{4} (\text{E}_j\text{Price} \times \text{E}_j\text{Qty}) = \text{Exited Qty} \times \text{Avg Exit Price}$$

---

### E. Realized Profit & Loss (`pl` / `grossPnl`)
Calculated by matching each exit lot against entry lots according to LIFO / FIFO order:
- **For Buy (Long) Trades**:
  $$\text{Realized P/L} = \sum_{\text{matched lots } m} \text{Matched Qty}_m \times (\text{Exit Price}_m - \text{Entry Price}_m)$$
- **For Sell (Short) Trades**:
  $$\text{Realized P/L} = \sum_{\text{matched lots } m} \text{Matched Qty}_m \times (\text{Entry Price}_m - \text{Exit Price}_m)$$
*(For fully closed trades, $\text{Realized P/L} = \text{Realised Amount} - \text{Total Cost Basis}$)*.

---

### F. Unrealized Profit & Loss (`unrealized`)
Calculated from the remaining open lots evaluated at Current Market Price (`CMP`):
$$\text{Unrealized P/L} = \begin{cases} \text{Open Qty} \times (\text{CMP} - \text{Avg Entry}_{\text{open}}), & \text{for Buy} \\ \text{Open Qty} \times (\text{Avg Entry}_{\text{open}} - \text{CMP}), & \text{for Sell} \\ 0, & \text{if } \text{Open Qty} == 0 \end{cases}$$

---

### G. Stop Loss Percentage (`slPct`)
Calculated strictly with respect to the initial entry price:
$$\text{SL \%} = \frac{|\text{SL} - \text{Initial Entry}|}{\text{Initial Entry}} \times 100$$

---

### H. Stock Move Percentage (`stockMove`)
Nexus implements a status-dependent formula (`It` function in `useLicense-giTSfLCY.js`):

1. **For `Closed` Position**:
   $$\text{Stock Move \%} = \begin{cases} \frac{\text{Avg Exit Price} - \text{Avg Entry}}{\text{Avg Entry}} \times 100, & \text{for Buy} \\ \frac{\text{Avg Entry} - \text{Avg Exit Price}}{\text{Avg Entry}} \times 100, & \text{for Sell} \end{cases}$$

2. **For `Open` Position**:
   $$\text{Stock Move \%} = \begin{cases} \frac{\text{CMP} - \text{Avg Entry}}{\text{Avg Entry}} \times 100, & \text{for Buy} \\ \frac{\text{Avg Entry} - \text{CMP}}{\text{Avg Entry}} \times 100, & \text{for Sell} \end{cases}$$

3. **For `Partial` Position (Weighted Blended Move)**:
   $$\text{Stock Move \%} = \frac{\text{Exited Qty} \times \text{Move}(\text{Avg Exit Price}, \text{Avg Entry}) + \text{Open Qty} \times \text{Move}(\text{CMP}, \text{Avg Entry})}{\text{Exited Qty} + \text{Open Qty}}$$
   where $\text{Move}(P, E) = \frac{P - E}{E} \times 100$ for Buy, and $\frac{E - P}{E} \times 100$ for Sell.

---

### I. Reward : Risk Ratio (R-Multiple) (`rewardRisk` / `weightedRR`)
Nexus calculates the trade's R-Multiple using function `Kt`:

1. **Total Initial Risk**: Sum of initial risk over each entered leg:
   $$\text{Leg Risk}_i = \text{Qty}_i \times |\text{Price}_i - \text{Effective Initial SL}_i|$$
   *(where $\text{Effective Initial SL}_i$ falls back to Initial SL if $\text{P}_i\text{SL}$ is not specified)*
   $$\text{Total Initial Risk} = \sum_{i} \text{Leg Risk}_i$$

2. **Total Gain**:
   $$\text{Total Gain} = \text{Realized P/L} + \text{Unrealized P/L at CMP}$$

3. **R-Multiple**:
   $$\text{Reward : Risk} = \frac{\text{Total Gain}}{\text{Total Initial Risk}}$$

---

### J. Capital at Risk % / Open Heat (`capitalAtRisk` / `openHeat`)
Calculated using function `qt`:

1. For each remaining open lot $i$, determine its **Effective Stop**:
   $$\text{Effective Stop}_i = \begin{cases} \max(\text{Leg SL}_i, \text{TSL}), & \text{for Buy} \\ \min(\text{Leg SL}_i, \text{TSL}), & \text{for Sell} \end{cases}$$
   *(If $\text{TSL} == 0$, it uses $\text{Leg SL}_i$)*.

2. Calculate the **P/L if stopped out** for each open lot:
   $$\text{P/L at Stop}_i = \begin{cases} \text{Remaining Qty}_i \times (\text{Effective Stop}_i - \text{Price}_i), & \text{for Buy} \\ \text{Remaining Qty}_i \times (\text{Price}_i - \text{Effective Stop}_i), & \text{for Sell} \end{cases}$$

3. Calculate the **Net P/L at Stop** across all open lots:
   $$\text{Net P/L at Stop} = \sum_{i} \text{P/L at Stop}_i$$

4. Determine **Capital at Risk %**:
   - If $\text{Net P/L at Stop} < 0$ (the position loses money if stopped out):
     $$\text{Capital at Risk \%} = \frac{|\text{Net P/L at Stop}|}{\text{Account Capital (ESC)}} \times 100$$
   - If $\text{Net P/L at Stop} \ge 0$ (the stop is above breakeven / profit locked in) OR trade is `Closed`:
     $$\text{Capital at Risk \%} = \mathbf{0.00\%}$$

---

### K. Holding Days (`holdingDays`)
Calculated via function `a` in `holdingDays-BBAtQu6g.js`:
- For each matched exit lot: $\text{Days} = \lfloor(\text{Exit Date Ms} - \text{Entry Date Ms}) / 86,400,000\rfloor$.
- For each remaining open lot: $\text{Days} = \lfloor(\text{Current Date Ms} - \text{Entry Date Ms}) / 86,400,000\rfloor$.
- Returns the **lot-quantity weighted average rounded to the nearest whole integer**:
  $$\text{Holding Days} = \text{round}\left(\frac{\sum (\text{Lot Qty}_k \times \text{Days}_k)}{\sum \text{Lot Qty}_k}\right)$$

---

### L. Portfolio Impact % (`pfImpact`) & Cumulative PF Impact (`cummPf`)
1. **Per-Trade Portfolio Impact**:
   $$\text{PF Impact \%} = \frac{\text{Realized P/L}}{\text{Effective Starting Capital (ESC)}} \times 100$$
2. **Cumulative Portfolio Impact (`cummPf`)**:
   Chronological running cumulative sum across all trades in the account:
   $$\text{Cumm PF Impact}_k = \sum_{m=1}^{k} \text{PF Impact}_m$$

---

### M. Current & Peak Allocation (%)
1. **Current Allocation %**:
   $$\text{Current Allocation \%} = \frac{\text{Avg Entry}_{\text{open}} \times \text{Open Qty}}{\text{Account Capital (ESC)}} \times 100$$
2. **Peak Allocation %**:
   The highest active capital exposure reached during the lifecycle of the trade (accounting for intermediate exits and pyramids) as a percentage of ESC.

---

## 3. Dashboard Summary Cards Calculation

| Metric Card | Formula / Definition |
| :--- | :--- |
| **Total Trades** | Count of all trades matching the current filter/date range. |
| **Open Positions** | Count of trades with `status === 'Open' \|\| status === 'Partial'`. |
| **Win Rate (P/L Method)** | $\frac{\text{Number of Closed/Partial Trades with Realized P/L} > 0}{\text{Total Number of Closed/Partial Trades with Realized P/L} \ne 0} \times 100$ |
| **Win Rate (R-Multiple Method)**| $\frac{\text{Number of Closed Trades with R-Multiple} \ge 1.0\text{R}}{\text{Total Closed Trades with R-Multiple}} \times 100$ |
| **Gross Realized P/L** | $\sum \text{trade.pl}$ across all closed and partial trades. |
| **Unrealized P/L** | $\sum \text{trade.unrealized}$ across all open and partial trades. |
| **Capital at Risk %** | $\sum \text{trade.capitalAtRisk}$ across all open positions. |
| **% Invested** | $\frac{\sum (\text{trade.openQty} \times \text{trade.avgEntry})}{\text{Active Account Capital}} \times 100$ |
| **Gross PF Impact % (All-Time)**| Compounded or summed Portfolio Impact % across the entire trading history. |
| **Current Drawdown (Pre-Tax)** | Peak-to-trough drop % from the highest cumulative equity curve watermark. |

---

## 4. Verification Example (Direct Match with Nexus)

| Parameter | Value |
| :--- | :--- |
| **Entries** | Initial: 100 @ ₹2500 (SL: ₹2400)<br>P1: 50 @ ₹2600 (SL: ₹2450)<br>P2: 50 @ ₹2700 (SL: ₹2550) |
| **Exits** | E1: 50 @ ₹2750<br>E2: 50 @ ₹2850<br>E3: 100 @ ₹2900 |
| **Calculations** | • **Total Cost Basis**: $250,000 + 130,000 + 135,000 = ₹5,15,000$<br>• **Avg Entry**: $515,000 / 200 = \mathbf{₹2,575.00}$<br>• **Realised Amount**: $137,500 + 142,500 + 290,000 = \mathbf{₹5,70,000.00}$<br>• **Avg Exit**: $570,000 / 200 = \mathbf{₹2,850.00}$<br>• **Gross Realized P/L**: $570,000 - 515,000 = \mathbf{+₹55,000.00}$<br>• **Stock Move**: $\frac{2850 - 2575}{2575} \times 100 = \mathbf{+10.68\%}$<br>• **Initial Risk**: $100(100) + 50(150) + 50(150) = ₹25,000$<br>• **Reward:Risk**: $55,000 / 25,000 = \mathbf{2.20R}$<br>• **Status**: $\mathbf{Closed}$ |
