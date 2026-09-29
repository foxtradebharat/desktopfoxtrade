import fs from 'fs';

// Read raw input CSV
const content = fs.readFileSync("d:/tradeontip/nexus_10_stocks_raw_inputs.csv", "utf8");
const lines = content.trim().split("\n").map(l => l.split(","));
const headers = lines[0];

const cleanNum = (str) => {
  if (!str) return 0;
  const cleaned = String(str).replace(/[₹$,"]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

const cleanOptionalNum = (str) => {
  if (str === undefined || str === null) return undefined;
  const cleaned = String(str).replace(/[₹$,"]/g, '').trim();
  if (cleaned === '') return undefined;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
};

const PORTFOLIO_CAPITAL = 895000;
const BASE_CAPITAL = 895000;

console.log("=== CALCULATING ENGINE OUTPUT ON PURE USER INPUTS ===\n");

const trades = [];

for (let i = 1; i < lines.length; i++) {
  const row = lines[i];
  const t = {};
  headers.forEach((h, idx) => {
    t[h] = row[idx] || "";
  });

  const entry = cleanNum(t.entry);
  const qty = cleanNum(t.initialQty);
  const p1Price = cleanNum(t.p1Price);
  const p1Qty = cleanNum(t.p1Qty);
  const p2Price = cleanNum(t.p2Price);
  const p2Qty = cleanNum(t.p2Qty);
  const e1Price = cleanNum(t.e1Price);
  const e1Qty = cleanNum(t.e1Qty);
  const e2Price = cleanNum(t.e2Price);
  const e2Qty = cleanNum(t.e2Qty);
  const e3Price = cleanNum(t.e3Price);
  const e3Qty = cleanNum(t.e3Qty);
  const sl = cleanNum(t.sl);
  const tsl = cleanNum(t.tsl);
  const cmp = cleanNum(t.cmp);
  const isSell = (t.side || 'Buy').toLowerCase() === 'sell';

  // 1. Calculations for Entry
  const totalQtyEntered = qty + p1Qty + p2Qty;
  const totalCost = (qty * entry) + (p1Qty * p1Price) + (p2Qty * p2Price);
  const avgEntry = totalQtyEntered > 0 ? totalCost / totalQtyEntered : entry;

  // 2. Calculations for Exit
  const totalQtyExited = e1Qty + e2Qty + e3Qty;
  const totalExitValue = (e1Qty * e1Price) + (e2Qty * e2Price) + (e3Qty * e3Price);
  const avgExitPrice = totalQtyExited > 0 ? totalExitValue / totalQtyExited : 0;

  // 3. Open vs Exited Qty & Status
  const openQty = Math.max(0, totalQtyEntered - totalQtyExited);
  const status = openQty <= 0 && totalQtyEntered > 0 ? 'Closed' : (totalQtyExited > 0 ? 'Partial' : 'Open');

  // 4. Position Size & Allocations
  const positionSize = avgEntry * totalQtyEntered;
  const peakAllocation = (positionSize / PORTFOLIO_CAPITAL) * 100;
  const currentAllocation = ((avgEntry * openQty) / PORTFOLIO_CAPITAL) * 100;

  // 5. SL %
  const slPct = entry > 0 ? Math.abs(((entry - sl) / entry) * 100) : 0;

  // 6. Realized P/L
  let pnl = 0;
  if (totalQtyExited > 0) {
    pnl = isSell ? (avgEntry - avgExitPrice) * totalQtyExited : (avgExitPrice - avgEntry) * totalQtyExited;
  }

  // 7. Unrealized P/L
  const unrealized = (openQty > 0 && cmp > 0)
    ? (isSell ? (avgEntry - cmp) * openQty : (cmp - avgEntry) * openQty)
    : 0;

  // 8. Gross P/L
  const grossPnl = pnl + unrealized;

  // 9. PF Impact
  const pfImpact = (pnl / BASE_CAPITAL) * 100;

  // 10. Reward:Risk
  const riskPerShare = Math.abs(entry - sl);
  const rawReward = status === 'Closed' ? (avgExitPrice - avgEntry) : (cmp - avgEntry);
  const rewardRisk = riskPerShare > 0 ? rawReward / riskPerShare : 0;

  // 11. Stock Move
  const exitOrCmp = totalQtyExited > 0 && status === 'Closed' ? avgExitPrice : cmp;
  const stockMove = entry > 0 ? (isSell ? ((entry - exitOrCmp) / entry) * 100 : ((exitOrCmp - entry) / entry) * 100) : 0;

  // 12. Realised Amount
  const realisedAmount = totalQtyExited > 0 ? (avgExitPrice * totalQtyExited) : 0;

  console.log(`[Trade #${t.tradeNo} - ${t.name}]`);
  console.log(`  Status: ${status} | Total Qty: ${totalQtyEntered} | Exited: ${totalQtyExited} | Open: ${openQty}`);
  console.log(`  Avg Entry: ₹${avgEntry.toFixed(2)} | Avg Exit: ₹${avgExitPrice.toFixed(2)} | CMP: ₹${cmp.toFixed(2)}`);
  console.log(`  Realized P&L: ₹${pnl.toFixed(2)} | Unrealized: ₹${unrealized.toFixed(2)} | Gross: ₹${grossPnl.toFixed(2)}`);
  console.log(`  Stock Move: ${stockMove.toFixed(2)}% | R:R: ${rewardRisk.toFixed(2)} | Peak Alloc: ${peakAllocation.toFixed(2)}% | Curr Alloc: ${currentAllocation.toFixed(2)}%\n`);
}
