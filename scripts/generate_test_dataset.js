import fs from 'fs';

const BASE_CAPITAL = 895000;

const tradesData = [
  {
    tradeNo: 1,
    date: "2026-04-05T00:00:00.000Z",
    name: "TCS",
    setup: "Breakout",
    side: "Buy",
    entry: 3500,
    initialQty: 25,
    sl: 3360,
    cmp: 3850,
    entryType: "PIVOT",
    p1Price: 3600,
    p1Qty: 15,
    p1Date: "2026-04-10T00:00:00.000Z",
    p1Sl: 3500,
    p2Price: 0,
    p2Qty: 0,
    p2Date: "",
    p2Sl: 0,
    tsl: 3700,
    e1Price: 3750,
    e1Qty: 20,
    e1Date: "2026-04-18T00:00:00.000Z",
    e2Price: 3850,
    e2Qty: 20,
    e2Date: "2026-04-25T00:00:00.000Z",
    e3Price: 0,
    e3Qty: 0,
    e3Date: "",
    planFollowed: "Yes",
    exitTrigger: "Target Hit",
    growthAreas: "",
    notes: "Clean breakout above resistance with volume",
    id: "019de44d-0001-70bd-b0c7-trade001"
  },
  {
    tradeNo: 2,
    date: "2026-04-12T00:00:00.000Z",
    name: "RELIANCE",
    setup: "Pullback",
    side: "Buy",
    entry: 2900,
    initialQty: 30,
    sl: 2784,
    cmp: 2760,
    entryType: "PIVOT",
    p1Price: 0,
    p1Qty: 0,
    p1Date: "",
    p1Sl: 0,
    p2Price: 0,
    p2Qty: 0,
    p2Date: "",
    p2Sl: 0,
    tsl: 0,
    e1Price: 2784,
    e1Qty: 30,
    e1Date: "2026-04-16T00:00:00.000Z",
    e2Price: 0,
    e2Qty: 0,
    e2Date: "",
    e3Price: 0,
    e3Qty: 0,
    e3Date: "",
    planFollowed: "Yes",
    exitTrigger: "SL",
    growthAreas: "Failed market breadth",
    notes: "Stopped out strictly according to plan",
    id: "019de44d-0002-70bd-b0c7-trade002"
  },
  {
    tradeNo: 3,
    date: "2026-04-20T00:00:00.000Z",
    name: "HDFCBANK",
    setup: "Flag",
    side: "Buy",
    entry: 1620,
    initialQty: 50,
    sl: 1555,
    cmp: 1740,
    entryType: "VCP",
    p1Price: 0,
    p1Qty: 0,
    p1Date: "",
    p1Sl: 0,
    p2Price: 0,
    p2Qty: 0,
    p2Date: "",
    p2Sl: 0,
    tsl: 1680,
    e1Price: 1735,
    e1Qty: 50,
    e1Date: "2026-05-02T00:00:00.000Z",
    e2Price: 0,
    e2Qty: 0,
    e2Date: "",
    e3Price: 0,
    e3Qty: 0,
    e3Date: "",
    planFollowed: "Yes",
    exitTrigger: "Trailing Stop",
    growthAreas: "",
    notes: "High tightness flag breakout",
    id: "019de44d-0003-70bd-b0c7-trade003"
  },
  {
    tradeNo: 4,
    date: "2026-04-26T00:00:00.000Z",
    name: "TATAMOTORS",
    setup: "Reversal",
    side: "Buy",
    entry: 980,
    initialQty: 80,
    sl: 940,
    cmp: 980,
    entryType: "PIVOT",
    p1Price: 0,
    p1Qty: 0,
    p1Date: "",
    p1Sl: 0,
    p2Price: 0,
    p2Qty: 0,
    p2Date: "",
    p2Sl: 0,
    tsl: 980,
    e1Price: 980,
    e1Qty: 80,
    e1Date: "2026-05-04T00:00:00.000Z",
    e2Price: 0,
    e2Qty: 0,
    e2Date: "",
    e3Price: 0,
    e3Qty: 0,
    e3Date: "",
    planFollowed: "Yes",
    exitTrigger: "Breakeven",
    growthAreas: "Lost momentum early",
    notes: "Scratched at cost after stalled thrust",
    id: "019de44d-0004-70bd-b0c7-trade004"
  },
  {
    tradeNo: 5,
    date: "2026-05-02T00:00:00.000Z",
    name: "INFY",
    setup: "Cup with Handle",
    side: "Buy",
    entry: 1540,
    initialQty: 40,
    sl: 1478,
    cmp: 1680,
    entryType: "VCP",
    p1Price: 1580,
    p1Qty: 20,
    p1Date: "2026-05-08T00:00:00.000Z",
    p1Sl: 1540,
    p2Price: 0,
    p2Qty: 0,
    p2Date: "",
    p2Sl: 0,
    tsl: 1620,
    e1Price: 1660,
    e1Qty: 60,
    e1Date: "2026-05-20T00:00:00.000Z",
    e2Price: 0,
    e2Qty: 0,
    e2Date: "",
    e3Price: 0,
    e3Qty: 0,
    e3Date: "",
    planFollowed: "Yes",
    exitTrigger: "Climax bar",
    growthAreas: "",
    notes: "Solid follow through after quarterly results",
    id: "019de44d-0005-70bd-b0c7-trade005"
  },
  {
    tradeNo: 6,
    date: "2026-05-15T00:00:00.000Z",
    name: "ICICIBANK",
    setup: "Breakout",
    side: "Buy",
    entry: 1150,
    initialQty: 60,
    sl: 1104,
    cmp: 1120,
    entryType: "PIVOT",
    p1Price: 0,
    p1Qty: 0,
    p1Date: "",
    p1Sl: 0,
    p2Price: 0,
    p2Qty: 0,
    p2Date: "",
    p2Sl: 0,
    tsl: 1110,
    e1Price: 1115,
    e1Qty: 60,
    e1Date: "2026-05-22T00:00:00.000Z",
    e2Price: 0,
    e2Qty: 0,
    e2Date: "",
    e3Price: 0,
    e3Qty: 0,
    e3Date: "",
    planFollowed: "Yes",
    exitTrigger: "SL",
    growthAreas: "Sector weakness",
    notes: "Failed breakout, cut with minimal loss",
    id: "019de44d-0006-70bd-b0c7-trade006"
  },
  {
    tradeNo: 7,
    date: "2026-05-25T00:00:00.000Z",
    name: "BHARTIARTL",
    setup: "Cheat",
    side: "Buy",
    entry: 1320,
    initialQty: 40,
    sl: 1267,
    cmp: 1510,
    entryType: "PIVOT",
    p1Price: 1360,
    p1Qty: 25,
    p1Date: "2026-06-01T00:00:00.000Z",
    p1Sl: 1320,
    p2Price: 1410,
    p2Qty: 15,
    p2Date: "2026-06-08T00:00:00.000Z",
    p2Sl: 1360,
    tsl: 1450,
    e1Price: 1440,
    e1Qty: 30,
    e1Date: "2026-06-15T00:00:00.000Z",
    e2Price: 1490,
    e2Qty: 30,
    e2Date: "2026-06-24T00:00:00.000Z",
    e3Price: 1520,
    e3Qty: 20,
    e3Date: "2026-07-02T00:00:00.000Z",
    planFollowed: "Yes",
    exitTrigger: "Target Hit",
    growthAreas: "",
    notes: "3-stage pyramiding and systematic 3-stage scaling exit",
    id: "019de44d-0007-70bd-b0c7-trade007"
  },
  {
    tradeNo: 8,
    date: "2026-06-10T00:00:00.000Z",
    name: "SBIN",
    setup: "Pullback",
    side: "Buy",
    entry: 840,
    initialQty: 90,
    sl: 806,
    cmp: 915,
    entryType: "PIVOT",
    p1Price: 0,
    p1Qty: 0,
    p1Date: "",
    p1Sl: 0,
    p2Price: 0,
    p2Qty: 0,
    p2Date: "",
    p2Sl: 0,
    tsl: 880,
    e1Price: 895,
    e1Qty: 90,
    e1Date: "2026-06-25T00:00:00.000Z",
    e2Price: 0,
    e2Qty: 0,
    e2Date: "",
    e3Price: 0,
    e3Qty: 0,
    e3Date: "",
    planFollowed: "Yes",
    exitTrigger: "Target Hit",
    growthAreas: "",
    notes: "Clean support bounce",
    id: "019de44d-0008-70bd-b0c7-trade008"
  },
  {
    tradeNo: 9,
    date: "2026-07-15T00:00:00.000Z",
    name: "HAL",
    setup: "Base on Base",
    side: "Buy",
    entry: 4650,
    initialQty: 18,
    sl: 4464,
    cmp: 5120.50,
    entryType: "VCP",
    p1Price: 4800,
    p1Qty: 12,
    p1Date: "2026-07-22T00:00:00.000Z",
    p1Sl: 4650,
    p2Price: 0,
    p2Qty: 0,
    p2Date: "",
    p2Sl: 0,
    tsl: 4950,
    e1Price: 5050,
    e1Qty: 15,
    e1Date: "2026-08-05T00:00:00.000Z",
    e2Price: 0,
    e2Qty: 0,
    e2Date: "",
    e3Price: 0,
    e3Qty: 0,
    e3Date: "",
    planFollowed: "Yes",
    exitTrigger: "Climax bar",
    growthAreas: "",
    notes: "PARTIAL EXIT: Booked half at 5050, riding remaining 15 qty with 4950 TSL",
    id: "019de44d-0009-70bd-b0c7-trade009"
  },
  {
    tradeNo: 10,
    date: "2026-08-10T00:00:00.000Z",
    name: "ZOMATO",
    setup: "High Tight Flag",
    side: "Buy",
    entry: 260,
    initialQty: 300,
    sl: 247,
    cmp: 295.40,
    entryType: "PIVOT",
    p1Price: 275,
    p1Qty: 150,
    p1Date: "2026-08-18T00:00:00.000Z",
    p1Sl: 260,
    p2Price: 0,
    p2Qty: 0,
    p2Date: "",
    p2Sl: 0,
    tsl: 280,
    e1Price: 0,
    e1Qty: 0,
    e1Date: "",
    e2Price: 0,
    e2Qty: 0,
    e2Date: "",
    e3Price: 0,
    e3Qty: 0,
    e3Date: "",
    planFollowed: "Yes",
    exitTrigger: "",
    growthAreas: "",
    notes: "FULLY OPEN TRADE: 450 total shares active, trailing stop at 280 (above entry)",
    id: "019de44d-0010-70bd-b0c7-trade010"
  }
];

let runningCummPf = 0;

const computedRows = tradesData.map(t => {
  const totalQtyEntered = t.initialQty + t.p1Qty + t.p2Qty;
  const totalCost = (t.initialQty * t.entry) + (t.p1Qty * t.p1Price) + (t.p2Qty * t.p2Price);
  const avgEntry = totalQtyEntered > 0 ? totalCost / totalQtyEntered : t.entry;

  const totalQtyExited = t.e1Qty + t.e2Qty + t.e3Qty;
  const totalExitValue = (t.e1Qty * t.e1Price) + (t.e2Qty * t.e2Price) + (t.e3Qty * t.e3Price);
  const avgExitPrice = totalQtyExited > 0 ? totalExitValue / totalQtyExited : 0;

  const openQty = Math.max(0, totalQtyEntered - totalQtyExited);
  const positionStatus = openQty === 0 ? 'Closed' : (totalQtyExited > 0 ? 'Partial' : 'Open');

  const positionSize = avgEntry * totalQtyEntered;
  const peakAlloc = (positionSize / BASE_CAPITAL) * 100;
  const currentAlloc = (avgEntry * openQty / BASE_CAPITAL) * 100;

  const slPct = t.entry > 0 ? Math.abs(((t.entry - t.sl) / t.entry) * 100) : 0;

  // Realized P&L
  const pl = totalQtyExited > 0 ? (avgExitPrice - avgEntry) * totalQtyExited : 0;
  
  // Realized Amount
  const realisedAmount = totalQtyExited > 0 ? (avgExitPrice * totalQtyExited) : 0;

  // Unrealized P&L
  const unrealizedPL = openQty > 0 ? (t.cmp - avgEntry) * openQty : 0;

  // Stock Move % (against initial entry)
  const exitOrCmp = totalQtyExited > 0 && positionStatus === 'Closed' ? avgExitPrice : t.cmp;
  const stockMove = t.entry > 0 ? ((exitOrCmp - t.entry) / t.entry) * 100 : 0;

  // Reward:Risk
  const riskPerShare = Math.abs(t.entry - t.sl);
  const rawReward = positionStatus === 'Closed' ? (avgExitPrice - avgEntry) : (t.cmp - avgEntry);
  const rewardRisk = riskPerShare > 0 ? rawReward / riskPerShare : 0;

  // Holding Days
  const dStart = new Date(t.date);
  const lastExitDate = t.e3Date || t.e2Date || t.e1Date;
  const dEnd = positionStatus === 'Closed' && lastExitDate ? new Date(lastExitDate) : new Date("2026-08-31T00:00:00.000Z");
  const holdingDays = Math.max(0, Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)));

  // PF Impact %
  const pfImpact = (pl / BASE_CAPITAL) * 100;
  runningCummPf += pfImpact;

  // Open Heat / Capital at risk %
  const effectiveSL = t.tsl > t.sl ? t.tsl : t.sl;
  const openHeat = (openQty > 0 && effectiveSL > 0 && avgEntry > effectiveSL)
    ? ((avgEntry - effectiveSL) * openQty / BASE_CAPITAL) * 100
    : 0;

  return {
    tradeNo: t.tradeNo,
    date: t.date,
    name: t.name,
    setup: t.setup,
    side: t.side,
    entry: t.entry.toFixed(2),
    avgEntry: avgEntry.toFixed(2),
    sl: t.sl.toFixed(2),
    cmp: t.cmp.toFixed(2),
    entryType: t.entryType,
    initialQty: t.initialQty,
    p1Price: t.p1Price > 0 ? t.p1Price.toFixed(2) : 0,
    p1Qty: t.p1Qty,
    p1Date: t.p1Date,
    p1Sl: t.p1Sl > 0 ? t.p1Sl.toFixed(2) : 0,
    p2Price: t.p2Price > 0 ? t.p2Price.toFixed(2) : 0,
    p2Qty: t.p2Qty,
    p2Date: t.p2Date,
    p2Sl: t.p2Sl > 0 ? t.p2Sl.toFixed(2) : 0,
    tsl: t.tsl > 0 ? t.tsl.toFixed(2) : 0,
    tslGroups: "",
    positionSize: positionSize.toFixed(2),
    "Current Allocation (%)": currentAlloc.toFixed(2),
    "Peak Allocation (%)": peakAlloc.toFixed(2),
    slPct: slPct.toFixed(2),
    e1Price: t.e1Price > 0 ? t.e1Price.toFixed(2) : 0,
    e1Qty: t.e1Qty,
    e1Date: t.e1Date,
    e2Price: t.e2Price > 0 ? t.e2Price.toFixed(2) : 0,
    e2Qty: t.e2Qty,
    e2Date: t.e2Date,
    e3Price: t.e3Price > 0 ? t.e3Price.toFixed(2) : 0,
    e3Qty: t.e3Qty,
    e3Date: t.e3Date,
    openQty: openQty,
    exitedQty: totalQtyExited,
    avgExitPrice: avgExitPrice > 0 ? avgExitPrice.toFixed(2) : 0,
    stockMove: stockMove.toFixed(2),
    rewardRisk: rewardRisk.toFixed(2),
    holdingDays: holdingDays,
    positionStatus: positionStatus,
    realisedAmount: realisedAmount.toFixed(2),
    pl: pl.toFixed(2),
    pfImpact: pfImpact.toFixed(2),
    cummPf: runningCummPf.toFixed(2),
    planFollowed: t.planFollowed,
    exitTrigger: t.exitTrigger,
    growthAreas: t.growthAreas,
    openHeat: openHeat.toFixed(2),
    baseDuration: "",
    notes: t.notes,
    unrealizedPL: unrealizedPL.toFixed(2),
    brokerage: "0",
    actions: "",
    id: t.id,
    broker: "",
    transactionHistory: "",
    allExchangeTradeIds: ""
  };
});

const headers = [
  "tradeNo","date","name","setup","side","entry","avgEntry","sl","cmp","entryType","initialQty",
  "p1Price","p1Qty","p1Date","p1Sl","p2Price","p2Qty","p2Date","p2Sl","tsl","tslGroups",
  "positionSize","Current Allocation (%)","Peak Allocation (%)","slPct",
  "e1Price","e1Qty","e1Date","e2Price","e2Qty","e2Date","e3Price","e3Qty","e3Date",
  "openQty","exitedQty","avgExitPrice","stockMove","rewardRisk","holdingDays","positionStatus",
  "realisedAmount","pl","pfImpact","cummPf","planFollowed","exitTrigger","growthAreas",
  "openHeat","baseDuration","notes","unrealizedPL","brokerage","actions","id","broker",
  "transactionHistory","allExchangeTradeIds"
];

const csvRows = [
  headers.join(","),
  ...computedRows.map(r => headers.map(h => {
    let val = r[h] !== undefined ? r[h] : "";
    if (typeof val === 'string' && (val.includes(",") || val.includes('"') || val.includes("\n"))) {
      val = `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }).join(","))
];

const csvContent = csvRows.join("\n");

fs.writeFileSync("d:/tradeontip/dummy_nexus_10_trades.csv", csvContent, "utf8");
try {
  fs.writeFileSync("C:/Users/iMAC/Downloads/dummy_nexus_10_trades.csv", csvContent, "utf8");
  console.log("Saved to Downloads successfully!");
} catch (e) {
  console.log("Could not write directly to Downloads:", e.message);
}

console.log("Generated 10 trades dummy CSV successfully!");
