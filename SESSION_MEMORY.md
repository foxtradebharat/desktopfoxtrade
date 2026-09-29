# 🧠 FoxTrade / TradeOnTip — Project Memory & Master Knowledge Base

## 1. 📐 Authoritative Calculation Engine Formulas (Memorized)

### A. Quantities & Status Lifecycle
- $\text{Total Qty Entered} = \text{Initial Qty} + \sum_{k=1}^4 \text{P}_k\text{Qty}$
- $\text{Exited Qty} = \sum_{j=1}^4 \text{E}_j\text{Qty}$
- $\text{Open Qty} = \max(0, \text{Total Qty Entered} - \text{Exited Qty})$
- $\text{Status} = \begin{cases} \mathbf{Closed}, & \text{Open Qty} == 0 \land \text{Exited Qty} > 0 \\ \mathbf{Partial}, & \text{Open Qty} > 0 \land \text{Exited Qty} > 0 \\ \mathbf{Open}, & \text{Open Qty} > 0 \land \text{Exited Qty} == 0 \end{cases}$

### B. Average Entry (`avgEntry`) & Lot-Level Cost Basis
- **Open / Closed Positions (VWAP):** $\text{Avg Entry} = \frac{\sum (\text{Entry Price}_i \times \text{Entry Qty}_i)}{\text{Total Qty Entered}}$
- **Partial Exits (LIFO Default):** Exits match against newest pyramid entries first. $\text{Avg Entry}_{\text{partial}} = \frac{\sum (\text{Remaining Price}_r \times \text{Remaining Qty}_r)}{\text{Open Qty}}$.

### C. Realized P/L & Unrealized P/L
- **Realized P/L:** $\sum_{\text{matched lots } m} \text{Matched Qty}_m \times (\text{Exit Price}_m - \text{Entry Price}_m)$ for Buy (reversed for Short).
- **Unrealized P/L:** $\text{Open Qty} \times (\text{CMP} - \text{Avg Entry}_{\text{open}})$ for Buy (reversed for Short).

### D. Capital at Risk % (Open Heat) & Risk Rupee
- For each open lot $i$: $\text{Effective Stop}_i = \max(\text{Leg SL}_i, \text{TSL})$ for Buy (min for Short).
- $\text{Net P/L at Stop} = \sum \text{Remaining Qty}_i \times (\text{Effective Stop}_i - \text{Entry Price}_i)$
- If $\text{Net P/L at Stop} < 0 \implies \text{Trade Risk (₹)} = |\text{Net P/L at Stop}|$, $\text{CAR \%} = \frac{\text{Trade Risk}}{\text{Account Capital}} \times 100$.
- If $\text{Net P/L at Stop} \ge 0 \implies \text{CAR \%} = 0.00\%$, $\text{Trade Risk} = ₹0.00$.

### E. Profit Protected (₹ and % of pf)
- $\text{Profit Protected (₹)} = \max\Big(0, \, (\text{Effective Stop} - \text{Avg Entry}) \times \text{Open Qty}\Big)$ for Buy (reversed for Short).
- $\text{Profit Protected (\% of pf)} = \frac{\text{Total Profit Protected}}{\text{Account Capital}} \times 100$.

### F. % Invested & Allocations
- $\text{Per-Trade Current Allocation \%} = \frac{\text{Avg Entry}_{\text{open}} \times \text{Open Qty}}{\text{Account Capital}} \times 100$.
- $\text{\% Invested (Dashboard Card)} = \frac{\sum (\text{Avg Entry}_{\text{open}} \times \text{Open Qty})}{\text{Account Capital}} \times 100$.

### G. Stock Move % & Reward:Risk (R-Multiple)
- **Stock Move %:** Closed = $\frac{\text{Avg Exit} - \text{Avg Entry}}{\text{Avg Entry}} \times 100$; Open = $\frac{\text{CMP} - \text{Avg Entry}}{\text{Avg Entry}} \times 100$; Partial = Quantity-weighted blend of exit move and open CMP move.
- **Initial Risk:** $\sum \text{Leg Qty}_i \times |\text{Leg Price}_i - \text{Leg SL}_i|$.
- **Reward:Risk:** $\frac{\text{Realized P/L} + \text{Unrealized P/L}}{\text{Total Initial Risk}}$.

### H. Win Rate (P/L Method vs RR Method)
- **P/L Method:** $\frac{\text{Decided Closed Trades with P/L} > 0}{\text{Total Decided Closed Trades with P/L} \ne 0} \times 100$ *(0 P/L breakeven excluded)*.
- **R-Multiple Method:** $\frac{\text{Closed Trades with R-Multiple} \ge 1.0\text{R}}{\text{Total Closed Trades with Valid RR}} \times 100$.

---

## 2. 📡 Market Data & Chart Architecture
- **TradingView Direct WebSocket:** `wss://data.tradingview.com/socket.io/websocket` for sub-second real-time streaming candles and quotes.
- **3-Tier Fallback Hierarchy:** Tier 1 TradingView WS $\to$ Tier 2 Yahoo REST $\to$ Tier 3 Synthetic Candlestick Fail-Safe.

---

## 3. 📂 Core Calculation Files
- [FOXTRADE_CALCULATION_FORMULAS.md](file:///d:/tradeontip/FOXTRADE_CALCULATION_FORMULAS.md) — Master calculation engine specification.
- [nexusCalculationEngine.js](file:///d:/tradeontip/src/utils/nexusCalculationEngine.js) — 100% verified drop-in pure calculation engine.
- [Dashboard.jsx](file:///d:/tradeontip/src/Dashboard.jsx) — State management and metric aggregations.
