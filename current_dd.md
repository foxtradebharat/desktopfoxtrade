# Drawdown Calculation Engine & Verification Report

## 1. Overview & Methodology

The Drawdown engine measures portfolio decline from the historical high-water mark (peak equity) across realized trading events.

### Core Formula
$$\text{Drawdown \%} = \frac{\text{Equity} - \text{Peak}}{\text{Peak}} \times 100$$
$$\text{Drawdown Amount} = \text{Equity} - \text{Peak}$$

In cash-flow-adjusted daily series (`computeDrawdownDaily`):
$$\text{Index}_t = \text{Index}_{t-1} \times \left(1 + \frac{\text{PnL}_t}{\text{Equity}_{\text{start}, t}}\right)$$
$$\text{Drawdown \%}_t = \left(\frac{\text{Index}_t}{\text{PeakIndex}_t} - 1\right) \times 100$$
$$\text{Drawdown Amount}_t = \text{Equity}_{\text{end}, t} \times \left(1 - \frac{\text{PeakIndex}_t}{\text{Index}_t}\right)$$

### Trade Scope & Attribution Rules
- **P&L Basis:** Realized P&L net of broker charges (`getTradePnl(t)`).
- **Included Trades:** Closed trades and Partial trades where `getTradePnl !== 0`.
- **Open Trades:** Open positions are excluded from drawdown calculations (unrealized P&L / MTM is not included).
- **Date Source:** Strict latest exit leg date (`e1` through `e5` where exit qty > 0 and date is valid), falling back to `exitDate`.
- **Exclusion Audit:** Trades without a valid exit date are strictly preserved, flagged, and reported in `excluded` rather than defaulting to entry date or epoch 0.

---

## 2. Benchmark Verification on `nexus-50-golden-trades.csv`

Real output verified against the golden benchmark dataset (`nexus-50-golden-trades.csv`):

### Dataset Summary
- **Total Trades in File:** 50
- **Closed Trades:** 40
- **Partial Trades:** 5
- **Open Positions:** 5 (excluded; unrealized P&L is not counted)
- **Trades Included in Drawdown:** 45 (40 Closed + 5 Partial)
- **Trades Excluded for Missing/Invalid Exit Date:** 0
- **Capital Basis Used:** ₹10,00,000.00 (`openingCapital`)
- **Total Realized Net P&L:** ₹70,895.00
- **Ending Equity:** ₹10,70,895.00
- **Peak Equity:** ₹10,70,895.00

### Drawdown Results

| Metric | Daily Aggregated (`computeDrawdownDaily`) | Legacy Per-Trade (`computeDrawdown`) |
| :--- | :--- | :--- |
| **Current Drawdown %** | **0.00%** | **0.00%** |
| **Current Drawdown Amount** | **₹0.00** | **₹0.00** |
| **Max Drawdown %** | **-0.17%** (-0.1745%) | **-0.25%** (-0.2454%) |
| **Max Drawdown Amount** | **-₹1,760.00** | **-₹2,600.00** |
| **Max DD Peak Date** | 2026-01-16 | Trade #37 (2026-04-30 intraday) |
| **Max DD Trough Date** | 2026-01-20 | Trade #40 (2026-05-07) |
| **Recovery Date** | 2026-01-22 | Trade #39 (2026-05-08) |
| **Current Underwater Days** | 0 calendar days | 0 |
| **Longest Underwater Days**| 10 calendar days | N/A |
| **Skipped Days (Zero Capital)**| 0 | N/A |

*Note on difference between Daily and Legacy Per-Trade:* On 2026-04-30, two trades closed on the same day: one winner (+₹5,040) and one loser (-₹1,200), netting +₹3,840 for the day. In the legacy per-trade sequential calculation, processing the winner first artificially created a higher intraday peak of ₹10,59,395 before processing the loser, which when followed by a loss of -₹1,400 on 2026-05-07, reported a cumulative drawdown of -₹2,600 (-0.25%). In daily aggregated accounting, the end-of-day realized equity on 2026-04-30 was ₹10,58,195, so the drop on 2026-05-07 was only -₹1,400 from that peak, making 2026-01-20 (-₹1,760 / -0.17%) the true maximum daily drawdown.

### Excluded Trades List
`excluded`: `[]` (0 trades excluded).

### Full Daily Series (41 Trading Days)

| Date | Daily P&L (₹) | Flow (₹) | Equity End (₹) | Drawdown % | Drawdown Amount (₹) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| 2026-01-07 | -600.00 | 0.00 | 9,99,400.00 | -0.06% | -600.00 |
| 2026-01-08 | +2,400.00 | 0.00 | 10,01,800.00 | 0.00% | 0.00 |
| 2026-01-14 | -1,280.00 | 0.00 | 10,00,520.00 | -0.13% | -1,280.00 |
| 2026-01-16 | +8,000.00 | 0.00 | 10,08,520.00 | 0.00% | 0.00 |
| 2026-01-20 | -1,760.00 | 0.00 | 10,06,760.00 | -0.17% | -1,760.00 |
| 2026-01-22 | +4,800.00 | 0.00 | 10,11,560.00 | 0.00% | 0.00 |
| 2026-01-27 | -1,125.00 | 0.00 | 10,10,435.00 | -0.11% | -1,125.00 |
| 2026-01-28 | +3,900.00 | 0.00 | 10,14,335.00 | 0.00% | 0.00 |
| 2026-02-03 | -1,400.00 | 0.00 | 10,12,935.00 | -0.14% | -1,400.00 |
| 2026-02-04 | +3,000.00 | 0.00 | 10,15,935.00 | 0.00% | 0.00 |
| 2026-02-06 | -1,300.00 | 0.00 | 10,14,635.00 | -0.13% | -1,300.00 |
| 2026-02-09 | +3,600.00 | 0.00 | 10,18,235.00 | 0.00% | 0.00 |
| 2026-02-12 | -1,200.00 | 0.00 | 10,17,035.00 | -0.12% | -1,200.00 |
| 2026-02-13 | +4,500.00 | 0.00 | 10,21,535.00 | 0.00% | 0.00 |
| 2026-02-20 | -1,000.00 | 0.00 | 10,20,535.00 | -0.10% | -1,000.00 |
| 2026-02-23 | +4,750.00 | 0.00 | 10,25,285.00 | 0.00% | 0.00 |
| 2026-02-26 | -1,500.00 | 0.00 | 10,23,785.00 | -0.15% | -1,500.00 |
| 2026-03-02 | +4,200.00 | 0.00 | 10,27,985.00 | 0.00% | 0.00 |
| 2026-03-05 | -1,200.00 | 0.00 | 10,26,785.00 | -0.12% | -1,200.00 |
| 2026-03-09 | +3,850.00 | 0.00 | 10,30,635.00 | 0.00% | 0.00 |
| 2026-03-10 | -1,040.00 | 0.00 | 10,29,595.00 | -0.10% | -1,040.00 |
| 2026-03-13 | +3,675.00 | 0.00 | 10,33,270.00 | 0.00% | 0.00 |
| 2026-03-17 | -1,800.00 | 0.00 | 10,31,470.00 | -0.17% | -1,800.00 |
| 2026-03-23 | +5,060.00 | 0.00 | 10,36,530.00 | 0.00% | 0.00 |
| 2026-03-25 | +5,400.00 | 0.00 | 10,41,930.00 | 0.00% | 0.00 |
| 2026-03-27 | -1,800.00 | 0.00 | 10,40,130.00 | -0.17% | -1,800.00 |
| 2026-03-31 | +4,480.00 | 0.00 | 10,44,610.00 | 0.00% | 0.00 |
| 2026-04-02 | -1,440.00 | 0.00 | 10,43,170.00 | -0.14% | -1,440.00 |
| 2026-04-07 | +8,000.00 | 0.00 | 10,51,170.00 | 0.00% | 0.00 |
| 2026-04-09 | -1,170.00 | 0.00 | 10,50,000.00 | -0.11% | -1,170.00 |
| 2026-04-15 | +3,500.00 | 0.00 | 10,53,500.00 | 0.00% | 0.00 |
| 2026-04-17 | -1,350.00 | 0.00 | 10,52,150.00 | -0.13% | -1,350.00 |
| 2026-04-23 | +2,205.00 | 0.00 | 10,54,355.00 | 0.00% | 0.00 |
| 2026-04-30 | +3,840.00 | 0.00 | 10,58,195.00 | 0.00% | 0.00 |
| 2026-05-07 | -1,400.00 | 0.00 | 10,56,795.00 | -0.13% | -1,400.00 |
| 2026-05-08 | +4,200.00 | 0.00 | 10,60,995.00 | 0.00% | 0.00 |
| 2026-05-18 | +2,000.00 | 0.00 | 10,62,995.00 | 0.00% | 0.00 |
| 2026-05-22 | +2,700.00 | 0.00 | 10,65,695.00 | 0.00% | 0.00 |
| 2026-05-26 | +1,200.00 | 0.00 | 10,66,895.00 | 0.00% | 0.00 |
| 2026-05-29 | +2,000.00 | 0.00 | 10,68,895.00 | 0.00% | 0.00 |
| 2026-06-02 | +2,000.00 | 0.00 | 10,70,895.00 | 0.00% | 0.00 |

---

## 3. Limitations

1. **Realized P&L Only:** The drawdown engine evaluates closed trades and partial exits where realized P&L is locked in. Unrealized fluctuations, intraday tick-level drawdowns, and open position mark-to-market (MTM) are not included.
2. **Partial Exits Attribution:** Partial exit trades are dated at their latest exit leg (`e1`..`e5` with qty > 0). If multiple exit legs occur across different days, the realized P&L is attributed to the final exit date.
3. **Cash Flow Timing:** When cash flows (`flows`) are provided, deposits and withdrawals are applied at the beginning of the day (`equityStart = equityPrev + flow(day)`).
4. **Fund Management Ledger Granularity:** The application's Fund Management ledger records capital additions and withdrawals on a monthly basis without per-entry calendar dates. As mandated by safety constraints, intra-month cash flow dates are not guessed or fabricated. When daily flow dates become available in the ledger schema, `computeDrawdownDaily` provides full time-weighted cash flow insulation.
