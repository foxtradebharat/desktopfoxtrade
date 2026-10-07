/**
 * taxAnalyticsCalculations.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Institutional Pure-Math Tax Analytics Calculation Engine for FoxTrade.
 * 100% Deterministic & Data-Driven Indian Tax Calculations.
 *
 * Covers:
 * 1. Monthly Gross & Net P/L, Auto Brokerage & Statutory Charges (STT, Stamp Duty, GST, Exchange, SEBI)
 * 2. Section 111A STCG (Short-Term Capital Gains @ 20% on Equity Delivery <= 365 days)
 * 3. Section 112A LTCG (Long-Term Capital Gains @ 12.5% on Equity Delivery > 365 days above ₹1.25L exemption)
 * 4. Speculative Business Income (Equity Intraday 0 holding days @ slab rates)
 * 5. Non-Speculative Business Income (Futures & Options @ slab rates)
 * 6. Section 44AB Tax Audit & Turnover Assessment (ICAI Guidance Note formula)
 * 7. Cumulative Drawdown, Watermark Highs, and Giveback calculations
 */

import { calculateCharges, getChargesMap } from './brokerChargesService.js';
import { toPaise, fromPaise } from './pnlEngine.js';

export const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Robust date parser supporting ISO strings, YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY
 */
export function parseDateParts(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();

  // 1. ISO string or YYYY-MM-DD / YYYY/MM/DD
  const ymdMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s);
  if (ymdMatch) {
    return {
      year: ymdMatch[1],
      month: parseInt(ymdMatch[2], 10) - 1, // 0-indexed
      day: parseInt(ymdMatch[3], 10)
    };
  }

  // 2. DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);
  if (dmyMatch) {
    return {
      year: dmyMatch[3],
      month: parseInt(dmyMatch[2], 10) - 1,
      day: parseInt(dmyMatch[1], 10)
    };
  }

  // 3. Native Date parse fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return {
      year: String(d.getFullYear()),
      month: d.getMonth(),
      day: d.getDate()
    };
  }

  return null;
}

/**
 * Extract realized P/L and check if trade has realized outcome
 */
export function getTradeRealizedPl(t) {
  return Number(t.grossPnl ?? t.pl ?? t.pnl ?? 0);
}

export function isTradeRealized(t) {
  const status = String(t.positionStatus || t.status || '').toLowerCase();
  const pl = getTradeRealizedPl(t);
  const exitedQty = Number(t.exitedQty || 0);
  return status === 'closed' || status === 'partial' || pl !== 0 || exitedQty > 0;
}

/**
 * Calculate or extract exact charges for a single trade
 */
export function getTradeCharges(t, externalChargesMap = null) {
  if (t.charges && t.charges.hasCharges) return t.charges;
  const chargesMap = externalChargesMap || getChargesMap();
  if (t.broker && chargesMap && Object.keys(chargesMap).length > 0) {
    const buyTurnover = Number(t.entry || t.avgEntry || 0) * Number(t.qty || t.initialQty || 0);
    const sellTurnover = Number(t.avgExitPrice || t.exitPrice || t.cmp || 0) * Number(t.exitedQty || t.qty || 0);
    const segment = t.segment || (Number(t.holdingDays || 0) <= 0 ? 'intraday' : 'delivery');
    const calc = calculateCharges(t.broker, segment, buyTurnover, sellTurnover, Number(t.exitedQty || t.qty || 0), chargesMap);
    if (calc && calc.hasCharges) return calc;
  }
  return {
    brokerage: Number(t.brokerage || 0),
    stt: Number(t.stt || 0),
    exchangeFee: Number(t.exchangeFee || t.exchangeCharges || 0),
    gst: Number(t.gst || 0),
    sebi: Number(t.sebi || t.sebiCharges || 0),
    stampDuty: Number(t.stampDuty || 0),
    total: Number(t.totalCharges || 0),
  };
}

/**
 * Returns month sequence based on period mode ('calendar' Jan-Dec or 'fy' Apr-Mar)
 */
export function getMonthSequence(periodMode = 'calendar') {
  if (periodMode === 'fy') {
    return [
      { label: 'April', index: 3, short: 'Apr' },
      { label: 'May', index: 4, short: 'May' },
      { label: 'June', index: 5, short: 'Jun' },
      { label: 'July', index: 6, short: 'Jul' },
      { label: 'August', index: 7, short: 'Aug' },
      { label: 'September', index: 8, short: 'Sep' },
      { label: 'October', index: 9, short: 'Oct' },
      { label: 'November', index: 10, short: 'Nov' },
      { label: 'December', index: 11, short: 'Dec' },
      { label: 'January', index: 0, short: 'Jan' },
      { label: 'February', index: 1, short: 'Feb' },
      { label: 'March', index: 2, short: 'Mar' },
    ];
  }
  return [
    { label: 'January', index: 0, short: 'Jan' },
    { label: 'February', index: 1, short: 'Feb' },
    { label: 'March', index: 2, short: 'Mar' },
    { label: 'April', index: 3, short: 'Apr' },
    { label: 'May', index: 4, short: 'May' },
    { label: 'June', index: 5, short: 'Jun' },
    { label: 'July', index: 6, short: 'Jul' },
    { label: 'August', index: 7, short: 'Aug' },
    { label: 'September', index: 8, short: 'Sep' },
    { label: 'October', index: 9, short: 'Oct' },
    { label: 'November', index: 10, short: 'Nov' },
    { label: 'December', index: 11, short: 'Dec' },
  ];
}

/**
 * Detect if a trade is a derivative (F&O / Futures / Options)
 */
export function isDerivativeTrade(t) {
  const seg = String(t.segment || t.type || '').toUpperCase();
  const sym = String(t.name || t.symbol || '').toUpperCase();
  return seg.includes('F&O') || seg.includes('FUT') || seg.includes('OPT') ||
         sym.includes('CE') || sym.includes('PE') || sym.includes('FUT') ||
         sym.endsWith('FUT') || sym.endsWith('CE') || sym.endsWith('PE');
}

/**
 * Computes full monthly tax breakdown and cumulative metrics
 */
export function calculateTaxMonthlyBreakdown(trades = [], options = {}) {
  const {
    selectedYear = '2026',
    periodMode = 'calendar',
    dateAttribution = 'entry',
    taxesData = {},
    detailedTaxesData = {},
    isAutoChargesEnabled = true,
    portfolioValue = 0,
    chargesMap = null
  } = options;

  const baseline = Number(portfolioValue) > 0 ? Number(portfolioValue) : 0;
  const monthSeq = getMonthSequence(periodMode);
  let runningCumulativeNetPl = 0;

  const breakdown = monthSeq.map((m) => {
    const monthTrades = trades.filter((t) => {
      if (!isTradeRealized(t)) return false;

      const dateString =
        dateAttribution === 'exit'
          ? t.e3Date || t.e2Date || t.e1Date || t.exitDate || t.closeDate || t.date
          : t.date || t.entryDate;

      let parsed = parseDateParts(dateString);
      if (!parsed || (selectedYear !== 'All' && String(parsed.year) !== String(selectedYear))) {
        const fallbackParsed = parseDateParts(t.date || t.entryDate);
        if (fallbackParsed && (selectedYear === 'All' || String(fallbackParsed.year) === String(selectedYear))) {
          parsed = fallbackParsed;
        } else if (!parsed) {
          return false;
        }
      }

      if (selectedYear !== 'All' && String(parsed.year) !== String(selectedYear)) return false;
      return parsed.month === m.index;
    });

    const grossPlPaise = monthTrades.reduce((acc, t) => acc + toPaise(getTradeRealizedPl(t)), 0);
    const grossPl = fromPaise(grossPlPaise);

    const autoTradeCharges = {
      stt: 0,
      stampDuty: 0,
      exchangeCharges: 0,
      gst: 0,
      sebiCharges: 0,
      brokerage: 0,
      total: 0,
      tradeCount: monthTrades.length,
      brokers: [...new Set(monthTrades.map((t) => t.broker).filter(Boolean))],
    };

    monthTrades.forEach((t) => {
      const c = getTradeCharges(t, chargesMap);
      autoTradeCharges.stt += Number(c.stt || 0);
      autoTradeCharges.stampDuty += Number(c.stampDuty || 0);
      autoTradeCharges.exchangeCharges += Number(c.exchangeFee || c.exchangeCharges || 0);
      autoTradeCharges.gst += Number(c.gst || 0);
      autoTradeCharges.sebiCharges += Number(c.sebi || c.sebiCharges || 0);
      autoTradeCharges.brokerage += Number(c.brokerage || 0);
      autoTradeCharges.total += Number(c.total || 0);
    });

    for (const k in autoTradeCharges) {
      if (typeof autoTradeCharges[k] === 'number') {
        autoTradeCharges[k] = Math.round(autoTradeCharges[k] * 100) / 100;
      }
    }

    let taxPaid = 0;
    let isAutoApplied = false;

    if (isAutoChargesEnabled) {
      const detailed = detailedTaxesData[m.index];
      const ledgerSum = detailed?.ledgerBased
        ? Object.values(detailed.ledgerBased).reduce((acc, v) => acc + (parseFloat(v) || 0), 0)
        : 0;
      const unknownSum = parseFloat(detailed?.unknownCharges || 0);

      if (monthTrades.length > 0 || ledgerSum > 0) {
        taxPaid = Math.round((autoTradeCharges.total + ledgerSum + unknownSum) * 100) / 100;
        isAutoApplied = true;
      } else {
        taxPaid = taxesData[m.index] || 0;
      }
    } else {
      taxPaid = taxesData[m.index] || 0;
    }

    const netPl = grossPl - taxPaid;
    const pfImpact = baseline > 0 ? (grossPl / baseline) * 100 : 0;
    const netPfImpact = baseline > 0 ? (netPl / baseline) * 100 : 0;

    const wins = monthTrades.filter((t) => getTradeRealizedPl(t) > 0);
    const winRate = monthTrades.length > 0 ? (wins.length / monthTrades.length) * 100 : 0;
    const sumWins = wins.reduce((acc, t) => acc + getTradeRealizedPl(t), 0);
    const avgProfit = wins.length > 0 ? sumWins / wins.length : 0;

    const losses = monthTrades.filter((t) => getTradeRealizedPl(t) < 0);
    const sumLosses = losses.reduce((acc, t) => acc + getTradeRealizedPl(t), 0);
    const avgLoss = losses.length > 0 ? Math.abs(sumLosses / losses.length) : 0;

    let avgWinLossRatio = '0.00';
    if (losses.length === 0) {
      avgWinLossRatio = wins.length > 0 ? '∞' : '0.00';
    } else if (avgLoss > 0) {
      avgWinLossRatio = (avgProfit / avgLoss).toFixed(2);
    }

    runningCumulativeNetPl += netPl;
    const cummPLpct = baseline > 0 ? (runningCumulativeNetPl / baseline) * 100 : 0;

    return {
      month: m.label,
      shortMonth: m.short,
      monthIdx: m.index,
      grossPl: parseFloat(grossPl.toFixed(2)),
      taxes: taxPaid,
      taxPct: grossPl > 0 ? parseFloat(((taxPaid / grossPl) * 100).toFixed(2)) : 0,
      netPl: parseFloat(netPl.toFixed(2)),
      pfImpact: parseFloat(pfImpact.toFixed(2)),
      netPfImpact: parseFloat(netPfImpact.toFixed(2)),
      trades: monthTrades.length,
      winRate: parseFloat(winRate.toFixed(1)),
      avgProfit: parseFloat(avgProfit.toFixed(1)),
      avgLoss: parseFloat(avgLoss.toFixed(1)),
      avgWinLossRatio,
      cummPLpct: parseFloat(cummPLpct.toFixed(3)),
      autoTradeCharges,
      isAutoApplied,
    };
  });

  // Calculate High-Watermark Drawdown & Peak Realized
  const totalGross = breakdown.reduce((acc, m) => acc + m.grossPl, 0);
  const totalTaxes = breakdown.reduce((acc, m) => acc + m.taxes, 0);
  const totalNet = totalGross - totalTaxes;

  let peakRealized = 0;
  let runningRealized = 0;
  let maxDrawdownAmt = 0;

  breakdown.forEach((m) => {
    if (m.trades > 0 || m.grossPl !== 0) {
      runningRealized += m.grossPl;
      if (runningRealized > peakRealized) peakRealized = runningRealized;
      const dd = peakRealized - runningRealized;
      if (dd > maxDrawdownAmt) maxDrawdownAmt = dd;
    }
  });

  const currentGiveback = Math.max(0, peakRealized - runningRealized);
  const givebackPct = baseline > 0 ? (currentGiveback / baseline) * 100 : 0;
  const drawdownPct = baseline > 0 ? (maxDrawdownAmt / baseline) * 100 : 0;

  // Aggregated Statutory Charges
  const totalChargesSummary = {
    stt: breakdown.reduce((acc, m) => acc + m.autoTradeCharges.stt, 0),
    stampDuty: breakdown.reduce((acc, m) => acc + m.autoTradeCharges.stampDuty, 0),
    exchangeCharges: breakdown.reduce((acc, m) => acc + m.autoTradeCharges.exchangeCharges, 0),
    gst: breakdown.reduce((acc, m) => acc + m.autoTradeCharges.gst, 0),
    sebiCharges: breakdown.reduce((acc, m) => acc + m.autoTradeCharges.sebiCharges, 0),
    brokerage: breakdown.reduce((acc, m) => acc + m.autoTradeCharges.brokerage, 0),
    total: breakdown.reduce((acc, m) => acc + m.autoTradeCharges.total, 0),
  };

  for (const k in totalChargesSummary) {
    totalChargesSummary[k] = Math.round(totalChargesSummary[k] * 100) / 100;
  }

  return {
    selectedYear,
    periodMode,
    monthlyBreakdown: breakdown,
    totalGross: Math.round(totalGross * 100) / 100,
    totalTaxes: Math.round(totalTaxes * 100) / 100,
    totalNet: Math.round(totalNet * 100) / 100,
    taxPercentOfGross: totalGross > 0 ? Math.round((totalTaxes / totalGross) * 1000) / 10 : 0,
    totalChargesSummary,
    peakRealized: Math.round(peakRealized * 100) / 100,
    currentRealized: Math.round(runningRealized * 100) / 100,
    maxDrawdownAmt: Math.round(maxDrawdownAmt * 100) / 100,
    drawdownPct: Math.round(drawdownPct * 100) / 100,
    currentGiveback: Math.round(currentGiveback * 100) / 100,
    givebackPct: Math.round(givebackPct * 100) / 100,
  };
}

/**
 * Computes Indian Income Tax Classification:
 * - Section 111A STCG (@ 20% post Budget July 2024)
 * - Section 112A LTCG (@ 12.5% post Budget July 2024 above ₹1.25L exemption)
 * - Speculative Business Income (Equity Intraday @ slab rates)
 * - Non-Speculative Business Income (F&O @ slab rates)
 * - Section 44AB Tax Audit Turnover Assessment
 */
export function calculateIndianTaxClassification(trades = [], options = {}) {
  const { selectedYear = '2026', chargesMap = null } = options;

  const relevantTrades = trades.filter((t) => {
    if (!isTradeRealized(t)) return false;
    const dateStr = t.date || t.entryDate;
    const parsed = parseDateParts(dateStr);
    if (!parsed) return true;
    if (selectedYear !== 'All' && String(parsed.year) !== String(selectedYear)) return false;
    return true;
  });

  let stcgGross = 0;
  let stcgTradesCount = 0;
  let stcgCharges = 0;

  let ltcgGross = 0;
  let ltcgTradesCount = 0;
  let ltcgCharges = 0;

  let intradayGross = 0;
  let intradayTradesCount = 0;
  let intradayCharges = 0;

  let fnoGross = 0;
  let fnoTradesCount = 0;
  let fnoCharges = 0;

  // Turnover tracking (ICAI Guidance Note formula)
  let fnoTurnover = 0;
  let intradayTurnover = 0;
  let deliveryTurnover = 0;

  relevantTrades.forEach((t) => {
    const pl = getTradeRealizedPl(t);
    const charges = getTradeCharges(t, chargesMap).total || 0;
    const holdingDays = Number(t.holdingDays ?? (t.days || 0));
    const isDeriv = isDerivativeTrade(t);

    if (isDeriv) {
      // F&O Non-Speculative Business Income
      fnoGross += pl;
      fnoTradesCount += 1;
      fnoCharges += charges;

      // F&O Turnover = Sum of absolute P&L + premium received on sale of options
      const optPremium = (String(t.name || t.symbol || '').toUpperCase().includes('CE') ||
                          String(t.name || t.symbol || '').toUpperCase().includes('PE'))
                          ? (Number(t.exitPrice || t.avgExitPrice || 0) * Number(t.exitedQty || t.qty || 0))
                          : 0;
      fnoTurnover += Math.abs(pl) + optPremium;
    } else if (holdingDays === 0) {
      // Equity Intraday Speculative Business Income
      intradayGross += pl;
      intradayTradesCount += 1;
      intradayCharges += charges;

      // Intraday Turnover = Sum of absolute profits and losses
      intradayTurnover += Math.abs(pl);
    } else if (holdingDays <= 365) {
      // Equity Delivery STCG (Section 111A)
      stcgGross += pl;
      stcgTradesCount += 1;
      stcgCharges += charges;

      const sellValue = Number(t.avgExitPrice || t.exitPrice || t.cmp || 0) * Number(t.exitedQty || t.qty || 0);
      deliveryTurnover += sellValue > 0 ? sellValue : Math.abs(pl);
    } else {
      // Equity Delivery LTCG (Section 112A)
      ltcgGross += pl;
      ltcgTradesCount += 1;
      ltcgCharges += charges;

      const sellValue = Number(t.avgExitPrice || t.exitPrice || t.cmp || 0) * Number(t.exitedQty || t.qty || 0);
      deliveryTurnover += sellValue > 0 ? sellValue : Math.abs(pl);
    }
  });

  const stcgNet = Math.round((stcgGross - stcgCharges) * 100) / 100;
  const ltcgNet = Math.round((ltcgGross - ltcgCharges) * 100) / 100;
  const intradayNet = Math.round((intradayGross - intradayCharges) * 100) / 100;
  const fnoNet = Math.round((fnoGross - fnoCharges) * 100) / 100;

  // Section 111A Tax Computation (20% flat rate)
  const stcgTaxRate = 20; // 20% post July 2024 budget
  const estimatedStcgTax = stcgNet > 0 ? Math.round(stcgNet * (stcgTaxRate / 100)) : 0;

  // Section 112A Tax Computation (12.5% on gains exceeding ₹1.25 Lakh)
  const ltcgExemption = 125000;
  const ltcgTaxRate = 12.5;
  const taxableLtcg = Math.max(0, ltcgNet - ltcgExemption);
  const estimatedLtcgTax = taxableLtcg > 0 ? Math.round(taxableLtcg * (ltcgTaxRate / 100)) : 0;

  // Total Business Income (F&O + Speculative Intraday)
  const totalBusinessNet = Math.round((intradayNet + fnoNet) * 100) / 100;

  // Section 44AB Audit Thresholds
  const totalCombinedTurnover = Math.round((fnoTurnover + intradayTurnover + deliveryTurnover) * 100) / 100;
  const auditThresholdDigital = 100000000; // ₹10 Crore for >=95% digital transactions
  const isAuditMandatory44AB = totalCombinedTurnover > auditThresholdDigital;

  return {
    selectedYear,
    totalTradesAnalyzed: relevantTrades.length,
    stcg: {
      section: 'Section 111A',
      trades: stcgTradesCount,
      grossPnl: Math.round(stcgGross * 100) / 100,
      charges: Math.round(stcgCharges * 100) / 100,
      netPnl: stcgNet,
      taxRatePct: stcgTaxRate,
      estimatedTax: estimatedStcgTax,
      treatment: 'Flat 20% on short-term gains from listed equity (Budget 2024)'
    },
    ltcg: {
      section: 'Section 112A',
      trades: ltcgTradesCount,
      grossPnl: Math.round(ltcgGross * 100) / 100,
      charges: Math.round(ltcgCharges * 100) / 100,
      netPnl: ltcgNet,
      exemptionLimit: ltcgExemption,
      taxableAmount: taxableLtcg,
      taxRatePct: ltcgTaxRate,
      estimatedTax: estimatedLtcgTax,
      treatment: '12.5% on long-term gains exceeding ₹1,25,000 exemption (Budget 2024)'
    },
    speculativeIntraday: {
      section: 'Section 43(5) Speculative Business',
      trades: intradayTradesCount,
      grossPnl: Math.round(intradayGross * 100) / 100,
      charges: Math.round(intradayCharges * 100) / 100,
      netPnl: intradayNet,
      treatment: 'Taxed at normal slab rates. Losses can only be set off against speculative profits (carry forward 4 years).'
    },
    nonSpeculativeFno: {
      section: 'Section 43(5) Non-Speculative Business',
      trades: fnoTradesCount,
      grossPnl: Math.round(fnoGross * 100) / 100,
      charges: Math.round(fnoCharges * 100) / 100,
      netPnl: fnoNet,
      treatment: 'Taxed at normal slab rates. Eligible for business expense deductions. Losses set off against any head except salary (carry forward 8 years).'
    },
    turnoverAudit: {
      fnoTurnover: Math.round(fnoTurnover * 100) / 100,
      intradayTurnover: Math.round(intradayTurnover * 100) / 100,
      deliveryTurnover: Math.round(deliveryTurnover * 100) / 100,
      totalCombinedTurnover,
      auditThresholdDigital,
      isAuditMandatory44AB,
      auditStatus: isAuditMandatory44AB
        ? 'MANDATORY TAX AUDIT: Total turnover exceeds ₹10 Crore threshold under Section 44AB.'
        : 'NO AUDIT REQUIRED UNDER 44AB: Turnover is within the ₹10 Crore digital transaction limit.'
    },
    totalEstimatedTaxOnCapitalGains: estimatedStcgTax + estimatedLtcgTax
  };
}

/**
 * Formats complete tax analytics and Indian tax classification as markdown for Foxy AI
 */
export function formatTaxAnalyticsForFoxy(breakdownResult, classificationResult) {
  const {
    selectedYear,
    totalGross,
    totalTaxes,
    totalNet,
    taxPercentOfGross,
    totalChargesSummary,
    maxDrawdownAmt,
    currentGiveback,
    monthlyBreakdown
  } = breakdownResult;

  const {
    stcg,
    ltcg,
    speculativeIntraday,
    nonSpeculativeFno,
    turnoverAudit,
    totalEstimatedTaxOnCapitalGains
  } = classificationResult;

  const activeMonths = monthlyBreakdown.filter(m => m.trades > 0 || m.grossPl !== 0);

  let out = `### TAX ANALYTICS & STATUTORY AUDIT (${selectedYear})\n`;
  out += `[METRIC: Gross Realized P/L | ₹${Math.round(totalGross).toLocaleString('en-IN')} | ${totalGross >= 0 ? 'green' : 'red'}]\n`;
  out += `[METRIC: Total Charges & Taxes | ₹${Math.round(totalTaxes).toLocaleString('en-IN')} | orange]\n`;
  out += `[METRIC: Net Post-Tax P/L | ₹${Math.round(totalNet).toLocaleString('en-IN')} | ${totalNet >= 0 ? 'green' : 'red'}]\n`;
  out += `[METRIC: Estimated CG Tax (111A/112A) | ₹${Math.round(totalEstimatedTaxOnCapitalGains).toLocaleString('en-IN')} | blue]\n\n`;

  out += `#### Indian Income Tax Sections Breakdown:\n`;
  out += `• **Section 111A (STCG - Equity Delivery <= 1 yr)**: ${stcg.trades} trades | Net P/L: ₹${Math.round(stcg.netPnl).toLocaleString('en-IN')} | Flat Tax Rate: 20% | **Estimated Tax: ₹${Math.round(stcg.estimatedTax).toLocaleString('en-IN')}**\n`;
  out += `• **Section 112A (LTCG - Equity Delivery > 1 yr)**: ${ltcg.trades} trades | Net P/L: ₹${Math.round(ltcg.netPnl).toLocaleString('en-IN')} | ₹1.25L Exemption Applied | Taxable: ₹${Math.round(ltcg.taxableAmount).toLocaleString('en-IN')} | Tax Rate: 12.5% | **Estimated Tax: ₹${Math.round(ltcg.estimatedTax).toLocaleString('en-IN')}**\n`;
  out += `• **Speculative Business Income (Intraday)**: ${speculativeIntraday.trades} trades | Net P/L: ₹${Math.round(speculativeIntraday.netPnl).toLocaleString('en-IN')} (Taxed at individual slab rates; losses carry forward 4 yrs)\n`;
  out += `• **Non-Speculative Business Income (F&O)**: ${nonSpeculativeFno.trades} trades | Net P/L: ₹${Math.round(nonSpeculativeFno.netPnl).toLocaleString('en-IN')} (Taxed at slab rates; business deductions allowed; losses carry forward 8 yrs)\n\n`;

  out += `#### Section 44AB Tax Audit & Turnover Assessment:\n`;
  out += `• **F&O Absolute Turnover**: ₹${Math.round(turnoverAudit.fnoTurnover).toLocaleString('en-IN')}\n`;
  out += `• **Intraday Turnover**: ₹${Math.round(turnoverAudit.intradayTurnover).toLocaleString('en-IN')}\n`;
  out += `• **Delivery Turnover**: ₹${Math.round(turnoverAudit.deliveryTurnover).toLocaleString('en-IN')}\n`;
  out += `• **Total Tax Turnover**: ₹${Math.round(turnoverAudit.totalCombinedTurnover).toLocaleString('en-IN')} (Threshold: ₹10,00,00,000 / ₹10 Cr)\n`;
  out += `• **Audit Verdict**: ${turnoverAudit.auditStatus}\n\n`;

  out += `#### Statutory Charges Breakdown:\n`;
  out += `• STT: ₹${Math.round(totalChargesSummary.stt).toLocaleString('en-IN')} | Stamp Duty: ₹${Math.round(totalChargesSummary.stampDuty).toLocaleString('en-IN')} | Exchange Fees: ₹${Math.round(totalChargesSummary.exchangeCharges).toLocaleString('en-IN')} | GST: ₹${Math.round(totalChargesSummary.gst).toLocaleString('en-IN')} | Brokerage: ₹${Math.round(totalChargesSummary.brokerage).toLocaleString('en-IN')} | SEBI: ₹${Math.round(totalChargesSummary.sebiCharges).toLocaleString('en-IN')}\n\n`;

  if (activeMonths.length > 0) {
    const tableHeaders = 'Month,Trades,Gross P/L,Charges,Net P/L,Win Rate %';
    const tableRows = activeMonths.map(m => {
      const gSign = m.grossPl >= 0 ? '▲ +' : '▼ -';
      const nSign = m.netPl >= 0 ? '▲ +' : '▼ -';
      return `${m.month},${m.trades},${gSign}₹${Math.round(Math.abs(m.grossPl)).toLocaleString('en-IN')},₹${Math.round(m.taxes).toLocaleString('en-IN')},${nSign}₹${Math.round(Math.abs(m.netPl)).toLocaleString('en-IN')},${m.winRate}%`;
    }).join(' | ');
    out += `[TABLE: ${tableHeaders} | ${tableRows}]\n`;
  }

  return out;
}
