import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Edit2,
  Pencil,
  Check,
  X,
  Info,
  PanelTop,
  ArrowUpDown,
  Calendar,
  Layers,
  ChevronDown,
  Zap
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ModernDropdown from '../ModernDropdown';
import TaxInputDialog from './TaxInputDialog';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { formatIndianRupee, formatIndianNumber } from '../../utils/indianCurrencyFormatter';
import { calculateCharges, getChargesMap } from '../../utils/brokerChargesService';
import { getStoredCapitalChanges, getPreviousYearEndingCapital } from '../../utils/fundManagementCalculations';
import { matchLots } from '../../utils/foxCalculationEngine';

/**
 * Robust date parser supporting ISO strings, YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY
 */
function parseDateParts(dateStr) {
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
function getTradeRealizedPl(t) {
  return Number(t.grossRealizedPL ?? t.grossPL ?? t.grossPnl ?? t.pl ?? t.pnl ?? 0);
}

function isTradeRealized(t) {
  const status = String(t.positionStatus || t.status || '').toLowerCase();
  const pl = getTradeRealizedPl(t);
  const exitedQty = Number(t.exitedQty || 0);
  return status === 'closed' || status === 'partial' || pl !== 0 || exitedQty > 0;
}

function getTradeCharges(t) {
  if (t.charges && t.charges.hasCharges) return t.charges;
  const chargesMap = getChargesMap();
  if (t.broker && chargesMap && Object.keys(chargesMap).length > 0) {
    const buyTurnover = Number(t.entry || t.avgEntry || 0) * Number(t.qty || t.initialQty || 0);
    const sellTurnover = Number(t.avgExitPrice || t.cmp || 0) * Number(t.exitedQty || t.qty || 0);
    const segment = t.segment || (Number(t.holdingDays || 0) <= 0 ? 'intraday' : 'delivery');
    const calc = calculateCharges(t.broker, segment, buyTurnover, sellTurnover, Number(t.exitedQty || t.qty || 0), chargesMap);
    if (calc && calc.hasCharges) return calc;
    if (calc && calc.reason) return calc;
  }
  return {
    brokerage: Number(t.brokerage || 0),
    stt: Number(t.stt || 0),
    exchangeFee: Number(t.exchangeFee || t.exchangeCharges || 0),
    gst: Number(t.gst || 0),
    sebi: Number(t.sebi || t.sebiCharges || 0),
    stampDuty: Number(t.stampDuty || 0),
    total: Number(t.totalCharges || 0),
    reason: t.chargesUnavailableReason || (!t.broker || t.broker === 'not_defined' ? 'broker_not_defined' : null)
  };
}

/**
 * Decompose a trade into exact lot-matched exit events (Cash Basis)
 */
function getTradeExitMatches(t, costBasisMethod = 'fifo') {
  // If trade already has pre-computed lot matches (from journal / trade entry)
  if (Array.isArray(t.matches) && t.matches.length > 0) {
    return t.matches.map((m) => ({
      exitDate: m.exitDate || m.exit?.date || t.date || '',
      exitTime: m.exit?.time || '15:00:00',
      pl: Number(m.pl || 0),
      qty: Number(m.matchedQty || m.qty || 0),
      trade: t,
    }));
  }

  const side = (t.type || t.side || 'Buy');

  // Entry lots
  const entryLots = [];
  const initialQty = parseFloat(t.qty || t.initialQty) || 0;
  const initialPrice = parseFloat(t.entry || t.avgEntry) || 0;
  if (initialQty > 0 && initialPrice > 0) {
    entryLots.push({
      id: 'initial',
      price: initialPrice,
      qty: initialQty,
      date: t.date || t.entryDate || ''
    });
  }
  for (let i = 1; i <= 4; i++) {
    const pQty = parseFloat(t[`p${i}Qty`]) || 0;
    const pPrice = parseFloat(t[`p${i}Price`]) || 0;
    const pDate = t[`p${i}Date`] || t.date || t.entryDate || '';
    if (pQty > 0 && pPrice > 0) {
      entryLots.push({
        id: `p${i}`,
        price: pPrice,
        qty: pQty,
        date: pDate
      });
    }
  }

  // Exit lots - strictly require qty > 0 and price > 0 and date
  const exitLots = [
    { id: 'e1', price: parseFloat(t.e1Price) || 0, qty: parseFloat(t.e1Qty) || 0, date: t.e1Date, time: t.e1Time },
    { id: 'e2', price: parseFloat(t.e2Price) || 0, qty: parseFloat(t.e2Qty) || 0, date: t.e2Date, time: t.e2Time },
    { id: 'e3', price: parseFloat(t.e3Price) || 0, qty: parseFloat(t.e3Qty) || 0, date: t.e3Date, time: t.e3Time },
    { id: 'e4', price: parseFloat(t.e4Price) || 0, qty: parseFloat(t.e4Qty) || 0, date: t.e4Date, time: t.e4Time },
  ].filter(l => l.qty > 0 && l.price > 0 && l.date);

  if (exitLots.length > 0 && entryLots.length > 0) {
    const res = matchLots(entryLots, exitLots, costBasisMethod, side);
    if (res && res.matches && res.matches.length > 0) {
      return res.matches.map(m => ({
        exitDate: m.exitDate || t.date || '',
        exitTime: m.exit?.time || '15:00:00',
        pl: Number(m.pl || 0),
        qty: Number(m.matchedQty || m.qty || 0),
        trade: t
      }));
    }
  }

  // Fallback for single-exit / legacy trades
  const pl = getTradeRealizedPl(t);
  const exitDate = t.exitDate || t.closeDate || t.e1Date || t.date || t.entryDate || '';
  return [{
    exitDate,
    exitTime: t.time || '15:00:00',
    pl,
    qty: Number(t.exitedQty || t.qty || 1),
    trade: t
  }];
}

export default function TaxAnalyticsPage({ 
  trades = [], 
  allTrades = [], 
  user, 
  portfolioValue = 0,
  dateRange = 'All Time',
  resolvedDateFilter = null
}) {
  const [selectedYear, setSelectedYear] = useState(() => {
    if (resolvedDateFilter?.from) {
      return String(resolvedDateFilter.from.getFullYear());
    }
    return '2026';
  });
  const [periodMode, setPeriodMode] = useState(() => {
    if (dateRange === 'Pick This FY' || dateRange === 'This FY') return 'fy';
    return 'calendar';
  }); // 'calendar' (Jan-Dec) | 'fy' (Apr-Mar)
  const [dateAttribution, setDateAttribution] = useState('exit'); // 'exit' (Accounting / Cash Basis style) | 'entry' (Trade Entry style)

  // Auto-sync selectedYear and periodMode with global dateRange
  useEffect(() => {
    if (!dateRange || dateRange === 'All Time') {
      // Keep or allow full flexibility
    } else if (dateRange === 'Pick This FY' || dateRange === 'This FY') {
      setPeriodMode('fy');
      const today = new Date();
      const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      setSelectedYear(String(fyStartYear));
    } else if (dateRange === 'This CY') {
      setPeriodMode('calendar');
      setSelectedYear(String(new Date().getFullYear()));
    } else if (resolvedDateFilter?.from) {
      const fromYr = resolvedDateFilter.from.getFullYear();
      const toYr = resolvedDateFilter.to ? resolvedDateFilter.to.getFullYear() : fromYr;
      if (fromYr === toYr) {
        setSelectedYear(String(fromYr));
      } else {
        setSelectedYear('All');
      }
    }
  }, [dateRange, resolvedDateFilter]);

  const [isAutoChargesEnabled, setIsAutoChargesEnabled] = useState(() => {
    try {
      return localStorage.getItem('foxtrade_auto_taxes_enabled') === 'true';
    } catch {
      return false; // OFF by default
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('foxtrade_auto_taxes_enabled', String(isAutoChargesEnabled));
    } catch {}
  }, [isAutoChargesEnabled]);

  const [taxesData, setTaxesData] = useState({}); // { [monthIndex]: totalAmount }
  const [detailedTaxesData, setDetailedTaxesData] = useState({}); // { [monthIndex]: { total, tradeBased, ledgerBased, unknownCharges } }
  const [activeTaxDialogMonth, setActiveTaxDialogMonth] = useState(null); // monthIndex or null
  const [activeTooltipKey, setActiveTooltipKey] = useState(null);
  const [isDrawdownModalOpen, setIsDrawdownModalOpen] = useState(false);
  const tooltipRef = useRef(null);
  const [showAutoInfoPopover, setShowAutoInfoPopover] = useState(false);
  const infoTimeoutRef = useRef(null);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const downloadDropdownRef = useRef(null);

  const unavailableChargesInfo = useMemo(() => {
    let count = 0;
    const reasons = new Set();
    (trades || []).forEach(t => {
      const isRealized = (t.status === 'Closed' || Number(t.exitedQty) > 0);
      if (isRealized) {
        const c = getTradeCharges(t);
        if (!c.hasCharges && c.reason) {
          count++;
          reasons.add(c.reason);
        }
      }
    });
    return {
      count,
      reasons: Array.from(reasons).join(', ')
    };
  }, [trades]);

  const handleInfoMouseEnter = () => {
    if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    setShowAutoInfoPopover(true);
  };

  const handleInfoMouseLeave = () => {
    infoTimeoutRef.current = setTimeout(() => {
      setShowAutoInfoPopover(false);
    }, 180);
  };

  // Close tooltip on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target) &&
        !e.target.closest('[data-tooltip-trigger]')
      ) {
        setActiveTooltipKey(null);
      }
      if (
        downloadDropdownRef.current &&
        !downloadDropdownRef.current.contains(e.target)
      ) {
        setIsDownloadOpen(false);
      }
    }
    if (activeTooltipKey || isDownloadOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeTooltipKey, isDownloadOpen]);

  // 1. Fetch saved monthly taxes & itemized breakdown from Firebase & localStorage
  useEffect(() => {
    if (!user?.uid || user.uid.startsWith('demo-')) {
      try {
        const cached = localStorage.getItem(`foxtrade_monthly_taxes_${selectedYear}`);
        if (cached) setTaxesData(JSON.parse(cached));
        const cachedDetailed = localStorage.getItem(`foxtrade_monthly_taxes_detailed_${selectedYear}`);
        if (cachedDetailed) setDetailedTaxesData(JSON.parse(cachedDetailed));
      } catch {}
      return;
    }
    getDoc(doc(db, 'journals', user.uid))
      .then((d) => {
        if (d.exists()) {
          const data = d.data();
          if (data.monthlyTaxes && data.monthlyTaxes[selectedYear]) {
            setTaxesData(data.monthlyTaxes[selectedYear] || {});
          }
          if (data.monthlyTaxesDetailed && data.monthlyTaxesDetailed[selectedYear]) {
            setDetailedTaxesData(data.monthlyTaxesDetailed[selectedYear] || {});
          }
        }
      })
      .catch((err) => console.warn('Taxes fetch error:', err));
  }, [user, selectedYear]);

  // Listen for restored tax data from backup
  useEffect(() => {
    const handleTaxesUpdated = () => {
      try {
        const cached = localStorage.getItem(`foxtrade_monthly_taxes_${selectedYear}`);
        if (cached) setTaxesData(JSON.parse(cached));
        const cachedDetailed = localStorage.getItem(`foxtrade_monthly_taxes_detailed_${selectedYear}`);
        if (cachedDetailed) setDetailedTaxesData(JSON.parse(cachedDetailed));
      } catch {}
    };
    window.addEventListener('tradeontip_taxes_updated', handleTaxesUpdated);
    return () => window.removeEventListener('tradeontip_taxes_updated', handleTaxesUpdated);
  }, [selectedYear]);

  // 2. Save detailed taxes from TaxInputDialog
  const handleSaveDetailedTax = (data) => {
    const { monthIndex, total, tradeBased, ledgerBased, unknownCharges } = data;
    const updatedTaxes = { ...taxesData, [monthIndex]: total };
    const updatedDetailed = {
      ...detailedTaxesData,
      [monthIndex]: { total, tradeBased, ledgerBased, unknownCharges },
    };

    setTaxesData(updatedTaxes);
    setDetailedTaxesData(updatedDetailed);
    setActiveTaxDialogMonth(null);

    try {
      localStorage.setItem(`foxtrade_monthly_taxes_${selectedYear}`, JSON.stringify(updatedTaxes));
      localStorage.setItem(`foxtrade_monthly_taxes_detailed_${selectedYear}`, JSON.stringify(updatedDetailed));
    } catch {}

    if (user?.uid && !user.uid.startsWith('demo-')) {
      getDoc(doc(db, 'journals', user.uid)).then((d) => {
        const existing = d.exists() ? d.data() : {};
        const monthlyTaxes = existing.monthlyTaxes || {};
        const monthlyTaxesDetailed = existing.monthlyTaxesDetailed || {};
        monthlyTaxes[selectedYear] = updatedTaxes;
        monthlyTaxesDetailed[selectedYear] = updatedDetailed;
        setDoc(doc(db, 'journals', user.uid), { monthlyTaxes, monthlyTaxesDetailed }, { merge: true });
      });
    }
  };

  // Month definition based on period mode
  const monthSequence = useMemo(() => {
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
  }, [periodMode]);

  // Resolve active portfolio & capital additions/withdrawals for accurate ESC baseline
  const activePortfolioId = typeof window !== 'undefined'
    ? (localStorage.getItem('tradeontip_active_portfolio_id') || 'portfolio-default')
    : 'portfolio-default';

  const capitalChanges = useMemo(() => {
    return getStoredCapitalChanges(activePortfolioId, selectedYear);
  }, [activePortfolioId, selectedYear]);

  const prevYearEndingCapital = useMemo(() => {
    const sourceTrades = (allTrades && allTrades.length > 0) ? allTrades : trades;
    return getPreviousYearEndingCapital(sourceTrades, selectedYear, activePortfolioId);
  }, [allTrades, trades, selectedYear, activePortfolioId]);

  const availableYearOptions = useMemo(() => {
    const currentYr = new Date().getFullYear();
    const yearsSet = new Set([String(currentYr), String(currentYr - 1), '2026', '2025', '2024', '2023']);
    const sourceTrades = (allTrades && allTrades.length > 0) ? allTrades : trades;
    if (Array.isArray(sourceTrades)) {
      sourceTrades.forEach(t => {
        const parsed = parseDateParts(t.date || t.entryDate || t.exitDate || t.e1Date);
        if (parsed?.year) yearsSet.add(String(parsed.year));
      });
    }
    const sorted = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    return [...sorted.map(y => ({ value: y, label: y })), { value: 'All', label: 'All Years' }];
  }, [allTrades, trades]);

  // 3. Compute Monthly Breakdown & Running Trajectory
  const { monthlyBreakdown, chartData } = useMemo(() => {
    // 1. Group trade contributions by month (0-indexed 0..11)
    const monthMatches = Array.from({ length: 12 }, () => ({
      grossPl: 0,
      contributingTrades: [],
      matchEvents: [],
    }));

    trades.forEach((t) => {
      if (!isTradeRealized(t)) return;

      if (dateAttribution === 'exit') {
        const matches = getTradeExitMatches(t, 'fifo');

        matches.forEach((m) => {
          const parsed = parseDateParts(m.exitDate);
          if (!parsed) return;
          if (selectedYear !== 'All' && String(parsed.year) !== String(selectedYear)) return;

          const mIdx = parsed.month;
          if (mIdx >= 0 && mIdx < 12) {
            monthMatches[mIdx].grossPl += m.pl;
            monthMatches[mIdx].matchEvents.push({
              ...m,
              dateMs: new Date(Number(parsed.year), parsed.month, parsed.day).getTime(),
            });

            // Only trades with non-zero PL contribute to month trade count
            if (m.pl !== 0 && !monthMatches[mIdx].contributingTrades.includes(t)) {
              monthMatches[mIdx].contributingTrades.push(t);
            }
          }
        });
      } else {
        // Trade Entry Date Attribution
        const parsed = parseDateParts(t.date || t.entryDate);
        if (!parsed) return;
        if (selectedYear !== 'All' && String(parsed.year) !== String(selectedYear)) return;

        const mIdx = parsed.month;
        if (mIdx >= 0 && mIdx < 12) {
          const pl = getTradeRealizedPl(t);
          monthMatches[mIdx].grossPl += pl;
          monthMatches[mIdx].contributingTrades.push(t);
          monthMatches[mIdx].matchEvents.push({
            exitDate: t.date || t.entryDate,
            exitTime: t.time || '15:00:00',
            pl,
            qty: Number(t.exitedQty || t.qty || 1),
            trade: t,
            dateMs: new Date(Number(parsed.year), parsed.month, parsed.day).getTime(),
          });
        }
      }
    });

    // 2. Track monthly running capital & compute stats
    let runningCapital = prevYearEndingCapital;
    let runningCumulativeNetPl = 0;

    const breakdown = monthSequence.map((m, seqIdx) => {
      const added = parseFloat(capitalChanges[m.index]?.added) || 0;
      const withdrawn = parseFloat(capitalChanges[m.index]?.withdrawn) || 0;

      let startingCapital = runningCapital;
      if (seqIdx === 0) {
        startingCapital = prevYearEndingCapital + added - withdrawn;
      } else {
        startingCapital = runningCapital + added - withdrawn;
      }
      if (startingCapital <= 0 && Number(portfolioValue) > 0) {
        startingCapital = Number(portfolioValue);
      }

      const monthData = monthMatches[m.index];
      const monthTrades = monthData.contributingTrades;
      const grossPl = monthData.grossPl;

      // Auto charges calculation if toggle is enabled
      const autoTradeCharges = {
        stt: 0,
        stampDuty: 0,
        exchangeCharges: 0,
        gst: 0,
        sebiCharges: 0,
        ipft: 0,
        brokerage: 0,
        otherCharges: 0,
        total: 0,
        tradeCount: monthTrades.length,
        brokers: [...new Set(monthTrades.map((t) => t.broker).filter(Boolean))],
      };

      monthTrades.forEach((t) => {
        const c = getTradeCharges(t);
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

      // Advance capital
      runningCapital = startingCapital + netPl;

      // Monthly PF impact calculated against this month's starting capital
      const pfImpact = startingCapital > 0 ? (grossPl / startingCapital) * 100 : 0;
      const netPfImpact = startingCapital > 0 ? (netPl / startingCapital) * 100 : 0;

      // Closed positions rule for Win Rate & Payoff metrics
      const closedTrades = monthTrades.filter(
        (t) => String(t.positionStatus || t.status || '').toLowerCase() === 'closed'
      );
      const wins = closedTrades.filter(
        (t) => (Number(t.grossRealizedPL ?? t.grossPL ?? t.grossPnl ?? t.pnl) > 0 || getTradeRealizedPl(t) > 0)
      );
      const losses = closedTrades.filter(
        (t) => (Number(t.grossRealizedPL ?? t.grossPL ?? t.grossPnl ?? t.pnl) < 0 || getTradeRealizedPl(t) < 0)
      );

      const winRate = monthTrades.length > 0 ? (wins.length / monthTrades.length) * 100 : 0;

      const sumWins = wins.reduce(
        (acc, t) => acc + (Number(t.grossRealizedPL ?? t.grossPL ?? t.grossPnl ?? t.pnl ?? 0) || getTradeRealizedPl(t)),
        0
      );
      const avgProfit = wins.length > 0 ? sumWins / wins.length : 0;

      const sumLosses = losses.reduce(
        (acc, t) => acc + (Number(t.grossRealizedPL ?? t.grossPL ?? t.grossPnl ?? t.pnl ?? 0) || getTradeRealizedPl(t)),
        0
      );
      const avgLoss = losses.length > 0 ? Math.abs(sumLosses / losses.length) : 0;

      const avgWinLossRatio = avgLoss === 0 ? '0.00' : (avgProfit / avgLoss).toFixed(2);

      runningCumulativeNetPl += netPl;
      const cummPLpct = startingCapital > 0 ? (runningCumulativeNetPl / startingCapital) * 100 : 0;

      return {
        month: m.label,
        shortMonth: m.short,
        monthIdx: m.index,
        startingCapital,
        grossPl: parseFloat(grossPl.toFixed(2)),
        taxes: taxPaid,
        taxPct: grossPl > 0 ? parseFloat(((taxPaid / grossPl) * 100).toFixed(2)) : 0,
        netPl: parseFloat(netPl.toFixed(2)),
        pfImpact: parseFloat(pfImpact.toFixed(2)),
        netPfImpact: parseFloat(netPfImpact.toFixed(2)),
        trades: monthTrades.length,
        winRate: Math.round(winRate),
        avgProfit: parseFloat(avgProfit.toFixed(1)),
        avgLoss: parseFloat(avgLoss.toFixed(1)),
        avgWinLossRatio,
        cummPLpct: parseFloat(cummPLpct.toFixed(3)),
        plPercent: parseFloat(pfImpact.toFixed(2)),
        autoTradeCharges,
        isAutoApplied,
        contributingTrades: monthTrades,
        matchEvents: monthData.matchEvents,
      };
    });

    return {
      monthlyBreakdown: breakdown,
      chartData: breakdown,
    };
  }, [trades, taxesData, detailedTaxesData, isAutoChargesEnabled, selectedYear, periodMode, dateAttribution, portfolioValue, monthSequence, capitalChanges, prevYearEndingCapital]);

  // 4. Calculate Tax Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalGross = monthlyBreakdown.reduce((acc, m) => acc + m.grossPl, 0);
    const totalTaxes = monthlyBreakdown.reduce((acc, m) => acc + m.taxes, 0);
    const totalNet = totalGross - totalTaxes;

    const monthStartingCapMap = {};
    monthlyBreakdown.forEach((m) => {
      monthStartingCapMap[m.monthIdx] = m.startingCapital || Number(portfolioValue) || 200000;
    });

    const allEvents = [];
    monthlyBreakdown.forEach((m) => {
      (m.matchEvents || []).forEach((ev) => {
        const monthCap = monthStartingCapMap[m.monthIdx] || Number(portfolioValue) || 200000;
        const pfImpact = monthCap > 0 ? (ev.pl / monthCap) * 100 : 0;
        allEvents.push({
          ...ev,
          monthCap,
          pfImpact,
        });
      });
    });

    allEvents.sort((a, b) => {
      if (a.dateMs !== b.dateMs) return a.dateMs - b.dateMs;
      return (a.exitTime || '').localeCompare(b.exitTime || '');
    });

    let runningCumPf = 0;
    let runningRealized = 0;
    let peakRealized = 0;
    let maxDrawdownAmt = 0;
    let maxCummPF = 0;
    let minCummPF = 0;

    allEvents.forEach((ev) => {
      runningCumPf += ev.pfImpact;
      runningRealized += ev.pl;

      if (runningCumPf > maxCummPF) maxCummPF = runningCumPf;
      if (runningCumPf < minCummPF) minCummPF = runningCumPf;

      if (runningRealized > peakRealized) peakRealized = runningRealized;
      const dd = peakRealized - runningRealized;
      if (dd > maxDrawdownAmt) maxDrawdownAmt = dd;
    });

    const currentRealized = runningRealized;
    const currentGiveback = Math.max(0, peakRealized - currentRealized);
    const givebackPct = peakRealized > 0 ? (currentGiveback / peakRealized) * 100 : 0;
    const currentDrawdownAmt = Math.max(0, peakRealized - currentRealized);
    const currentDrawdownPct = peakRealized > 0 ? (currentDrawdownAmt / peakRealized) * 100 : 0;
    const isAtPeak = currentDrawdownAmt <= 0 || currentDrawdownPct < 0.001;

    return {
      totalGross,
      totalTaxes,
      totalNet,
      taxPercentOfGross: totalGross > 0 ? (totalTaxes / totalGross) * 100 : 0,
      maxCummPF: maxCummPF.toFixed(2),
      minCummPF: minCummPF.toFixed(2),
      drawdownPct: currentDrawdownPct.toFixed(2),
      drawdownAmt: currentDrawdownAmt.toFixed(2),
      maxHistoricalDrawdownAmt: maxDrawdownAmt.toFixed(2),
      isAtPeak,
      givebackPct: givebackPct.toFixed(2),
      givebackAmt: currentGiveback.toFixed(2),
      peakRealized: peakRealized.toFixed(2),
      currentRealized: currentRealized.toFixed(2),
      isAtRealizedPeak: currentGiveback <= 0,
    };
  }, [monthlyBreakdown, portfolioValue]);

  // 5. Table Summary Totals Row
  const tableTotals = useMemo(() => {
    const totalTrades = monthlyBreakdown.reduce((acc, m) => acc + m.trades, 0);
    const totalGross = monthlyBreakdown.reduce((acc, m) => acc + m.grossPl, 0);
    const totalTaxes = monthlyBreakdown.reduce((acc, m) => acc + m.taxes, 0);
    const totalNet = totalGross - totalTaxes;
    const janStartingCap = monthlyBreakdown[0]?.startingCapital || Number(portfolioValue) || 200000;

    const allContributingTrades = Array.from(
      new Set(monthlyBreakdown.flatMap((m) => m.contributingTrades || []))
    );
    const closedContributing = allContributingTrades.filter(
      (t) => String(t.positionStatus || t.status || '').toLowerCase() === 'closed'
    );
    const allWins = closedContributing.filter(
      (t) => (Number(t.grossRealizedPL ?? t.grossPL ?? t.grossPnl ?? t.pnl) > 0 || getTradeRealizedPl(t) > 0)
    );
    const allLosses = closedContributing.filter(
      (t) => (Number(t.grossRealizedPL ?? t.grossPL ?? t.grossPnl ?? t.pnl) < 0 || getTradeRealizedPl(t) < 0)
    );

    const totalWinRate = totalTrades > 0 ? (allWins.length / totalTrades) * 100 : 0;
    const sumProfit = allWins.reduce(
      (acc, t) => acc + (Number(t.grossRealizedPL ?? t.grossPL ?? t.grossPnl ?? t.pnl ?? 0) || getTradeRealizedPl(t)),
      0
    );
    const overallAvgProfit = allWins.length > 0 ? sumProfit / allWins.length : 0;

    const sumLoss = allLosses.reduce(
      (acc, t) => acc + (Number(t.grossRealizedPL ?? t.grossPL ?? t.grossPnl ?? t.pnl ?? 0) || getTradeRealizedPl(t)),
      0
    );
    const overallAvgLoss = allLosses.length > 0 ? Math.abs(sumLoss / allLosses.length) : 0;

    let overallRatio = '0.00';
    if (allLosses.length > 0 && overallAvgLoss > 0) {
      overallRatio = (overallAvgProfit / overallAvgLoss).toFixed(2);
    }

    return {
      totalTrades,
      totalGross,
      totalTaxes,
      totalNet,
      grossPfImpact: janStartingCap > 0 ? (totalGross / janStartingCap) * 100 : 0,
      netPfImpact: janStartingCap > 0 ? (totalNet / janStartingCap) * 100 : 0,
      taxPct: totalGross > 0 ? (totalTaxes / totalGross) * 100 : 0,
      winRate: totalWinRate,
      avgProfit: overallAvgProfit,
      avgLoss: overallAvgLoss,
      avgRatio: overallRatio,
    };
  }, [monthlyBreakdown, portfolioValue]);

  // Active dialog month data
  const activeDialogRow = useMemo(() => {
    if (activeTaxDialogMonth === null) return null;
    return monthlyBreakdown.find((m) => m.monthIdx === activeTaxDialogMonth) || null;
  }, [activeTaxDialogMonth, monthlyBreakdown]);

  // Export Clean CSV Report with Watermark
  const handleExportCSV = () => {
    const closed = trades.filter((t) => isTradeRealized(t));
    const generatedDate = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    // FoxTrade Watermark Header
    const watermarkHeaders = [
      ['=== FOXTRADE (foxtrade.in) — VERIFIED TRADING JOURNAL & TAX REPORT ===', '', '', '', '', '', '', '', '', '', ''],
      ['Generated On:', `"${generatedDate}"`, 'Financial Period:', `"${selectedYear}"`, 'Mode:', `"${periodMode === 'fy' ? 'FY (Apr-Mar)' : 'Jan-Dec'}"`, 'Engine:', '"FoxTrade Automatic Engine"', 'Verification:', '"100% Data-Driven"'],
      ['', '', '', '', '', '', '', '', '', '', ''],
    ];

    const headers = [
      'Trade Date',
      'Symbol',
      'Instrument Type',
      'Direction',
      'Quantity',
      'Avg Entry Price (₹)',
      'Avg Exit Price (₹)',
      'Gross PnL (₹)',
      'Holding Days',
      'Estimated STT (₹)',
      'Tax Class (STCG/LTCG)',
    ];

    const rows = closed.map((t) => {
      const holdingDays = Number(t.holdingDays || 0);
      const pnl = getTradeRealizedPl(t);
      const isLtcg = holdingDays > 365;
      const qty = Number(t.exitedQty || t.qty || 1);
      const exitPrice = Number(t.avgExitPrice || t.avgExit || 0);
      const estStt = Math.round(qty * exitPrice * 0.001);

      return [
        `"${t.date || ''}"`,
        `"${t.symbol || t.name || ''}"`,
        `"${t.instrumentType || 'Equity'}"`,
        `"${t.side || t.type || 'BUY'}"`,
        qty,
        Number(t.avgEntry || t.entry || 0).toFixed(2),
        exitPrice.toFixed(2),
        pnl.toFixed(2),
        holdingDays,
        estStt,
        `"${pnl > 0 ? (isLtcg ? 'LTCG (>1yr)' : 'STCG (<1yr)') : 'Capital Loss'}"`,
      ];
    });

    const watermarkFooter = [
      ['', '', '', '', '', '', '', '', '', '', ''],
      ['* Confidential & Verified Trading Report — Generated automatically by FoxTrade (https://foxtrade.in)', '', '', '', '', '', '', '', '', '', ''],
    ];

    const allLines = [
      ...watermarkHeaders.map((r) => r.join(',')),
      headers.join(','),
      ...rows.map((r) => r.join(',')),
      ...watermarkFooter.map((r) => r.join(',')),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + allLines.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FoxTrade_Tax_Report_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Complete Monthly Tax Breakdown to Excel (.xlsx) with Watermark
  const handleExportExcel = () => {
    const generatedDate = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const wsData = [
      ['FOXTRADE (foxtrade.in) — VERIFIED TAX ANALYTICS REPORT'],
      [`Generated On: ${generatedDate} | Period: ${selectedYear} (${periodMode === 'fy' ? 'FY Apr-Mar' : 'Jan-Dec'}) | Tax Engine: FoxTrade Automatic`],
      [], // blank spacer
      [
        'Month',
        'Gross P/L (₹)',
        'Taxes (₹)',
        'Tax %',
        'Net P/L (₹)',
        'Gross PF Impact %',
        'Net PF Impact %',
        'Trades',
        'Win Rate %',
        'Avg Profit (₹)',
        'Avg Loss (₹)',
        'Avg Win:Loss Ratio',
      ],
      ...monthlyBreakdown.map((r) => [
        r.month,
        r.grossPl,
        r.taxes,
        `${r.taxPct}%`,
        r.netPl,
        `${r.pfImpact}%`,
        `${r.netPfImpact}%`,
        r.trades,
        `${r.winRate}%`,
        r.avgProfit,
        r.avgLoss,
        r.avgWinLossRatio,
      ]),
      [
        'TOTAL',
        tableTotals.totalGross,
        tableTotals.totalTaxes,
        `${tableTotals.taxPct.toFixed(2)}%`,
        tableTotals.totalNet,
        `${tableTotals.grossPfImpact.toFixed(2)}%`,
        `${tableTotals.netPfImpact.toFixed(2)}%`,
        tableTotals.totalTrades,
        `${tableTotals.winRate.toFixed(1)}%`,
        Math.round(tableTotals.avgProfit),
        Math.round(tableTotals.avgLoss),
        tableTotals.avgRatio,
      ],
      [], // blank spacer
      ['* Generated & Verified with FoxTrade Tax Analytics Engine (https://foxtrade.in) — Professional Indian Trading Journal'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths for beautiful layout in Excel
    ws['!cols'] = [
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 10 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
    ];

    const wb = XLSX.utils.book_new();

    // Set Workbook Properties / Watermark Metadata
    wb.Props = {
      Title: `FoxTrade Tax Analytics Report - ${selectedYear}`,
      Subject: 'Verified Tax & Regulatory Charges Analytics',
      Author: 'FoxTrade (foxtrade.in)',
      Manager: 'FoxTrade Trading Journal',
      Company: 'FoxTrade Financial Technologies (foxtrade.in)',
      Category: 'Tax & P&L Analytics',
      Keywords: 'FoxTrade, Tax, ITR, Trading Journal, Stock Market India',
      Comments: 'Verified and generated via FoxTrade Tax Engine (https://foxtrade.in)',
      CreatedDate: new Date(),
    };

    XLSX.utils.book_append_sheet(wb, ws, 'Tax Breakdown');
    XLSX.writeFile(wb, `FoxTrade_Monthly_Tax_Breakdown_${selectedYear}.xlsx`);
  };

  return (
    <div style={{ padding: '0 28px 80px 28px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* ── Header Title & Actions ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          marginTop: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <h1
            style={{
              fontSize: '24px',
              fontStyle: 'normal',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Tax Analytics
          </h1>

          {/* Modern Apple Style Automatic Toggle Button */}
          <div
            onClick={() => setIsAutoChargesEnabled(!isAutoChargesEnabled)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'var(--bg-surface)',
              padding: '5px 10px 5px 14px',
              borderRadius: '9999px',
              border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  letterSpacing: '0.01em',
                  color: 'var(--text-primary)',
                }}
              >
                Automatic
              </span>

              {/* Info 'i' Button with Popover */}
              <div
                style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                onMouseEnter={handleInfoMouseEnter}
                onMouseLeave={handleInfoMouseLeave}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    color: showAutoInfoPopover ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="Information"
                >
                  <Info size={13} />
                </div>

                {/* Popover */}
                {showAutoInfoPopover && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 10px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 100,
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
                      width: '270px',
                      fontSize: '12px',
                      lineHeight: '1.5',
                      color: 'var(--text-secondary)',
                      backdropFilter: 'blur(16px)',
                      pointerEvents: 'auto',
                      cursor: 'default',
                    }}
                    onMouseEnter={handleInfoMouseEnter}
                    onMouseLeave={handleInfoMouseLeave}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Top Arrow Caret */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '-5px',
                        left: '50%',
                        transform: 'translateX(-50%) rotate(45deg)',
                        width: '9px',
                        height: '9px',
                        backgroundColor: 'var(--bg-card)',
                        borderLeft: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                        borderTop: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                      }}
                    />
                    <div>
                      Turning this button on will fill trade based charges automatically.{' '}
                      <a
                        href="#learn-more"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        style={{
                          textDecoration: 'underline',
                          textUnderlineOffset: '3px',
                          color: '#10b981',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-block',
                          transition: 'opacity 0.15s ease',
                        }}
                        className="hover:opacity-80"
                      >
                        Learn more
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Apple-Style Toggle Switch */}
            <div
              style={{
                width: '34px',
                height: '20px',
                borderRadius: '12px',
                backgroundColor: isAutoChargesEnabled ? '#10b981' : 'rgba(156, 163, 175, 0.35)',
                position: 'relative',
                transition: 'background-color 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  position: 'absolute',
                  top: '2px',
                  left: '2px',
                  transform: isAutoChargesEnabled ? 'translateX(14px)' : 'translateX(0px)',
                  transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Modern Download Dropdown Button */}
        <div style={{ position: 'relative' }} ref={downloadDropdownRef}>
          <button
            type="button"
            onClick={() => setIsDownloadOpen((prev) => !prev)}
            title="Download Tax Report"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '7px 15px',
              backgroundColor: isDownloadOpen ? 'var(--bg-subtle, var(--bg-surface))' : 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.02em',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.2s ease',
            }}
          >
            <Download size={14} style={{ color: 'var(--text-primary)' }} />
            <span>Download</span>
            <ChevronDown
              size={12}
              style={{
                color: 'var(--text-secondary)',
                transform: isDownloadOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                marginLeft: '1px',
              }}
            />
          </button>

          {isDownloadOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                borderRadius: '16px',
                padding: '6px',
                boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.1), 0 4px 10px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                minWidth: '170px',
                zIndex: 100,
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* CSV Option */}
              <button
                type="button"
                onClick={() => {
                  handleExportCSV();
                  setIsDownloadOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-subtle, rgba(0, 0, 0, 0.05))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-subtle, rgba(0, 0, 0, 0.06))',
                    color: 'var(--text-primary)',
                    flexShrink: 0,
                  }}
                >
                  <FileText size={15} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    CSV
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '2px' }}>
                    .csv
                  </span>
                </div>
              </button>

              {/* XLSX Option */}
              <button
                type="button"
                onClick={() => {
                  handleExportExcel();
                  setIsDownloadOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-subtle, rgba(0, 0, 0, 0.05))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-subtle, rgba(0, 0, 0, 0.06))',
                    color: 'var(--text-primary)',
                    flexShrink: 0,
                  }}
                >
                  <FileSpreadsheet size={15} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    XLSX
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '2px' }}>
                    .xlsx
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Charges Unavailable Banner ── */}
      {unavailableChargesInfo.count > 0 && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 18px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#ef4444',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <span>
            Charges unavailable for {unavailableChargesInfo.count} {unavailableChargesInfo.count === 1 ? 'trade' : 'trades'} ({unavailableChargesInfo.reasons}). Statutory charges and taxes cannot be computed accurately for these trades until a supported broker and rate card are specified.
          </span>
        </div>
      )}

      {/* ── Top Section: Combo Chart (Left) + Tax Metrics Sidebar (Right) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.85fr) minmax(320px, 1fr)',
          gap: '20px',
          marginBottom: '32px',
        }}
      >
        {/* Left: Dual Y-Axis Combo Chart */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: 'var(--shadow-card, 0 1px 2px rgba(0,0,0,0.02))',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Chart Header Legend Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#3b82f6',
                  }}
                />
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Gross P/L
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#60a5fa',
                  }}
                />
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Net P/L
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#f59e0b',
                  }}
                />
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Taxes
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--text-primary)',
                  }}
                />
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-secondary)',
                  }}
                >
                  P/L %
                </span>
              </div>
            </div>
          </div>

          {/* Chart Canvas */}
          <div style={{ width: '100%', height: '340px', minHeight: '340px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--border-color) 40%, transparent)" opacity={0.5} vertical={false} />
                <XAxis
                  dataKey="shortMonth"
                  stroke="var(--text-muted)"
                  fontSize={11}
                  fontWeight={500}
                  tickLine={false}
                  axisLine={{ stroke: 'color-mix(in srgb, var(--border-color) 60%, transparent)', strokeWidth: 1 }}
                />
                {/* Left Y-Axis (Currency) */}
                <YAxis
                  yAxisId="left"
                  stroke="var(--text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${formatIndianNumber(val, { decimals: 0, compact: true })}`}
                />
                {/* Right Y-Axis (Percentage) */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="var(--text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}%`}
                />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0]?.payload || {};
                      return (
                        <div
                          style={{
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                            borderRadius: '12px',
                            padding: '12px 14px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                            fontSize: '12px',
                            minWidth: '170px',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              marginBottom: '8px',
                              borderBottom: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)',
                              paddingBottom: '4px',
                            }}
                          >
                            {data.month}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                            <span style={{ color: '#3b82f6', fontWeight: 500 }}>Gross P/L:</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                              ₹{data.grossPl?.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                            <span style={{ color: '#60a5fa', fontWeight: 500 }}>Net P/L:</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                              ₹{data.netPl?.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                            <span style={{ color: '#f59e0b', fontWeight: 500 }}>Taxes:</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                              ₹{data.taxes?.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              margin: '6px 0 0 0',
                              borderTop: '1px dashed color-mix(in srgb, var(--border-color) 50%, transparent)',
                              paddingTop: '6px',
                            }}
                          >
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>P/L %:</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#10b981' }}>
                              {data.plPercent > 0 ? `+${data.plPercent}%` : `${data.plPercent}%`}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar yAxisId="left" dataKey="grossPl" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar yAxisId="left" dataKey="netPl" fill="#60a5fa" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar yAxisId="left" dataKey="taxes" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="plPercent"
                  stroke="var(--text-primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: 'var(--text-primary)', strokeWidth: 1.5, stroke: 'var(--bg-surface)' }}
                  activeDot={{ r: 5, fill: '#10b981' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Tax Metrics Sidebar Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            borderRadius: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {/* Header */}
          <div style={{ padding: '20px 20px 10px 20px' }}>
            <h2
              style={{
                fontSize: '18px',
                fontStyle: 'normal',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: 'var(--text-primary)',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Tax Metrics
            </h2>
          </div>

          {/* Metric Rows Container */}
          <div style={{ flex: 1, padding: '10px 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Metric 1: Max Cumm PF (Peak) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                borderRadius: '10px',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Max Cumm PF (Peak)
                </span>
                <button
                  type="button"
                  data-tooltip-trigger="maxCumm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTooltipKey(activeTooltipKey === 'maxCumm' ? null : 'maxCumm');
                  }}
                  onMouseEnter={() => setActiveTooltipKey('maxCumm')}
                  onMouseLeave={() => setActiveTooltipKey(null)}
                  title="Show details"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:text-foreground hover:border-border/80"
                >
                  <Info size={9} />
                </button>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    color: '#10b981',
                  }}
                >
                  {summaryMetrics.maxCummPF}%
                </span>
              </div>

              {/* Tooltip Popover */}
              {activeTooltipKey === 'maxCumm' && (
                <div
                  ref={tooltipRef}
                  style={{
                    position: 'absolute',
                    top: '32px',
                    left: '8px',
                    zIndex: 60,
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    maxWidth: '220px',
                    fontSize: '11px',
                    lineHeight: '1.4',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Highest cumulative profit factor peak reached in this duration.
                </div>
              )}
            </div>

            {/* Metric 2: Min Cumm PF */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                borderRadius: '10px',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Min Cumm PF
                </span>
                <button
                  type="button"
                  data-tooltip-trigger="minCumm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTooltipKey(activeTooltipKey === 'minCumm' ? null : 'minCumm');
                  }}
                  onMouseEnter={() => setActiveTooltipKey('minCumm')}
                  onMouseLeave={() => setActiveTooltipKey(null)}
                  title="Show details"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:text-foreground hover:border-border/80"
                >
                  <Info size={9} />
                </button>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    color: '#f43f5e',
                  }}
                >
                  {summaryMetrics.minCummPF}%
                </span>
              </div>

              {/* Tooltip Popover */}
              {activeTooltipKey === 'minCumm' && (
                <div
                  ref={tooltipRef}
                  style={{
                    position: 'absolute',
                    top: '32px',
                    left: '8px',
                    zIndex: 60,
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    maxWidth: '220px',
                    fontSize: '11px',
                    lineHeight: '1.4',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Lowest performance floor recorded during this period.
                </div>
              )}
            </div>

            {/* Metric 3: Drawdown (Pre-tax) */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setIsDrawdownModalOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
              }}
              className="hover:bg-muted/40"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Drawdown (Pre-tax)
                </span>
                <button
                  type="button"
                  data-tooltip-trigger="drawdown"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTooltipKey(activeTooltipKey === 'drawdown' ? null : 'drawdown');
                  }}
                  onMouseEnter={() => setActiveTooltipKey('drawdown')}
                  onMouseLeave={() => setActiveTooltipKey(null)}
                  title="Show details"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:text-foreground hover:border-border/80"
                >
                  <Info size={9} />
                </button>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    color: summaryMetrics.isAtPeak ? '#10b981' : '#f43f5e',
                  }}
                >
                  {summaryMetrics.drawdownPct}%
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    marginTop: '1px',
                  }}
                >
                  {summaryMetrics.isAtPeak ? 'AT PEAK' : `₹${parseFloat(summaryMetrics.drawdownAmt).toLocaleString('en-IN')}`}
                </span>
              </div>

              {/* Tooltip Popover for Drawdown */}
              {activeTooltipKey === 'drawdown' && (
                <div
                  ref={tooltipRef}
                  style={{
                    position: 'absolute',
                    top: '32px',
                    left: '8px',
                    zIndex: 60,
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    maxWidth: '220px',
                    fontSize: '11px',
                    lineHeight: '1.4',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <div>Maximum portfolio drawdown recorded before taxes.</div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTooltipKey(null);
                      setIsDrawdownModalOpen(true);
                    }}
                    style={{
                      marginTop: '6px',
                      color: '#10b981',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    View Drawdown Matrix →
                  </div>
                </div>
              )}
            </div>

            {/* Metric 4: Profit Giveback (Pre-tax) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                borderRadius: '10px',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Profit Giveback (Pre-tax)
                </span>
                <button
                  type="button"
                  data-tooltip-trigger="giveback"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTooltipKey(activeTooltipKey === 'giveback' ? null : 'giveback');
                  }}
                  onMouseEnter={() => setActiveTooltipKey('giveback')}
                  onMouseLeave={() => setActiveTooltipKey(null)}
                  title="Show details"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:text-foreground hover:border-border/80"
                >
                  <Info size={9} />
                </button>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    color: summaryMetrics.isAtRealizedPeak ? '#10b981' : '#f43f5e',
                  }}
                >
                  {summaryMetrics.givebackPct}%
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    marginTop: '1px',
                  }}
                >
                  {summaryMetrics.isAtRealizedPeak ? 'AT REALIZED PEAK' : `Giveback: ₹${summaryMetrics.givebackAmt}`}
                </span>
              </div>

              {/* Tooltip Popover */}
              {activeTooltipKey === 'giveback' && (
                <div
                  ref={tooltipRef}
                  style={{
                    position: 'absolute',
                    top: '36px',
                    left: '8px',
                    zIndex: 60,
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    maxWidth: '240px',
                    fontSize: '11px',
                    lineHeight: '1.4',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <div>Realized profit given back from the highest cumulative realized P/L peak.</div>
                  <div style={{ marginTop: '6px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    Peak: ₹{parseFloat(summaryMetrics.peakRealized).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    Current: ₹{parseFloat(summaryMetrics.currentRealized).toLocaleString('en-IN')}
                  </div>
                </div>
              )}
            </div>

            {/* Subtle Divider */}
            <div style={{ height: '1px', backgroundColor: 'color-mix(in srgb, var(--border-color) 50%, transparent)', margin: '4px 0' }} />

            {/* Metric 5: Total Gross P/L */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                borderRadius: '10px',
              }}
            >
              <div>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Total Gross P/L
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    color: summaryMetrics.totalGross >= 0 ? '#10b981' : '#f43f5e',
                  }}
                >
                  ₹{summaryMetrics.totalGross.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Metric 6: Total Taxes */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                borderRadius: '10px',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Total Taxes
                </span>
                <button
                  type="button"
                  data-tooltip-trigger="taxes"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTooltipKey(activeTooltipKey === 'taxes' ? null : 'taxes');
                  }}
                  onMouseEnter={() => setActiveTooltipKey('taxes')}
                  onMouseLeave={() => setActiveTooltipKey(null)}
                  title="Show details"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:text-foreground hover:border-border/80"
                >
                  <Info size={9} />
                </button>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    color: '#f43f5e',
                  }}
                >
                  ₹{summaryMetrics.totalTaxes.toLocaleString('en-IN')}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    marginTop: '1px',
                  }}
                >
                  ({summaryMetrics.taxPercentOfGross.toFixed(1)}% of Gross P/L)
                </span>
              </div>

              {/* Taxes Popover */}
              {activeTooltipKey === 'taxes' && (
                <div
                  ref={tooltipRef}
                  style={{
                    position: 'absolute',
                    top: '36px',
                    left: '8px',
                    zIndex: 60,
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                    borderRadius: '10px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    width: '210px',
                    fontSize: '11px',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '10px 12px', maxHeight: '140px', overflowY: 'auto' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Monthly Tax Entries
                    </div>
                    {monthlyBreakdown.filter((m) => m.taxes > 0).length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No tax payments logged.</div>
                    ) : (
                      monthlyBreakdown
                        .filter((m) => m.taxes > 0)
                        .map((m) => (
                          <div
                            key={m.monthIdx}
                            style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}
                          >
                            <span style={{ color: 'var(--text-secondary)' }}>{m.shortMonth}:</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                              ₹{m.taxes.toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-primary)',
                      borderTop: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Total Liability
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      ₹{summaryMetrics.totalTaxes.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Footer Box: TOTAL NET P/L */}
          <div
            style={{
              padding: '14px 20px',
              backgroundColor: 'var(--bg-primary)',
              borderTop: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--text-muted)',
                  display: 'block',
                }}
              >
                Total Net P/L
              </span>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  fontFamily: 'var(--font-mono)',
                  color: summaryMetrics.totalNet >= 0 ? '#10b981' : '#f43f5e',
                  marginTop: '2px',
                }}
              >
                ₹{summaryMetrics.totalNet.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Section: Monthly Tax Breakdown Table ── */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
          borderRadius: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          overflow: 'hidden',
        }}
      >
        {/* Table Header Controls */}
        <div
          style={{
            padding: '22px 24px 18px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '18px',
                fontStyle: 'normal',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Monthly Tax Breakdown
            </h2>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                fontWeight: 400,
                margin: '3px 0 0 0',
              }}
            >
              Detailed monthly analysis of your trading performance and tax liabilities.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Calendar vs Indian Financial Year (FY) Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-primary)',
                padding: '2px',
                borderRadius: '8px',
                border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
              }}
            >
              <button
                type="button"
                onClick={() => setPeriodMode('calendar')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: periodMode === 'calendar' ? 'var(--bg-surface)' : 'transparent',
                  color: periodMode === 'calendar' ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: periodMode === 'calendar' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                Jan - Dec
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('fy')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: periodMode === 'fy' ? 'var(--bg-surface)' : 'transparent',
                  color: periodMode === 'fy' ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: periodMode === 'fy' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                FY (Apr - Mar)
              </button>
            </div>

            {/* Date Attribution: Entry Date vs Exit Date */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-primary)',
                padding: '2px',
                borderRadius: '8px',
                border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
              }}
            >
              <button
                type="button"
                onClick={() => setDateAttribution('entry')}
                title="Attribution by trade entry date (FoxTrade journal standard)"
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: dateAttribution === 'entry' ? 'var(--bg-surface)' : 'transparent',
                  color: dateAttribution === 'entry' ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: dateAttribution === 'entry' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                Entry Date
              </button>
              <button
                type="button"
                onClick={() => setDateAttribution('exit')}
                title="Attribution by exit/close date (tax filing standard)"
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: dateAttribution === 'exit' ? 'var(--bg-surface)' : 'transparent',
                  color: dateAttribution === 'exit' ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: dateAttribution === 'exit' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                Exit Date
              </button>
            </div>


            {/* Year Selector Dropdown */}
            <ModernDropdown
              value={selectedYear}
              options={availableYearOptions}
              variant="table"
              width="105px"
              onChange={(val) => setSelectedYear(val)}
            />
          </div>
        </div>

        {/* The 12-Column Table */}
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  color: 'var(--text-muted)',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                <th style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>MONTH</th>
                <th style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>GROSS P/L</th>
                <th
                  style={{
                    padding: '14px 16px',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                  title="Click to open Real-Time Tax Calculator"
                  onClick={() => setActiveTaxDialogMonth(monthlyBreakdown[0]?.monthIdx ?? 0)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>TAXES</span>
                    <Pencil size={11} style={{ opacity: 0.7 }} />
                  </div>
                </th>
                <th style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>TAX %</th>
                <th style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>NET P/L</th>
                <th style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>GROSS PF IMPACT</th>
                <th style={{ padding: '14px 16px', whiteSpace: 'nowrap', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>NET PF IMPACT</span>
                    <div
                      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                      onMouseEnter={() => setActiveTooltipKey('netPfImpact')}
                      onMouseLeave={() => setActiveTooltipKey(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltipKey(activeTooltipKey === 'netPfImpact' ? null : 'netPfImpact');
                      }}
                    >
                      <button
                        type="button"
                        data-tooltip-trigger="netPfImpact"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: activeTooltipKey === 'netPfImpact' ? 'var(--text-primary)' : 'var(--text-muted)',
                          opacity: activeTooltipKey === 'netPfImpact' ? 1 : 0.65,
                          transition: 'all 0.15s ease',
                        }}
                        title="Net PF Impact details"
                      >
                        <Info size={11} />
                      </button>

                      {activeTooltipKey === 'netPfImpact' && (
                        <div
                          ref={tooltipRef}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 100,
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                            borderRadius: '10px',
                            padding: '10px 12px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                            width: '230px',
                            fontSize: '11px',
                            lineHeight: '1.45',
                            fontWeight: 500,
                            textTransform: 'none',
                            letterSpacing: 'normal',
                            color: 'var(--text-secondary)',
                            backdropFilter: 'blur(12px)',
                            whiteSpace: 'normal',
                            cursor: 'default',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              top: '-5px',
                              left: '50%',
                              transform: 'translateX(-50%) rotate(45deg)',
                              width: '8px',
                              height: '8px',
                              backgroundColor: 'var(--bg-card)',
                              borderLeft: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                              borderTop: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                            }}
                          />
                          Percentage impact of net realized P/L (after deducting all taxes and charges) on your portfolio capital.
                        </div>
                      )}
                    </div>
                  </div>
                </th>
                <th style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>TRADES</th>
                <th style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>WIN RATE</th>
                <th style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>AVG PROFIT</th>
                <th style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>AVG LOSS</th>
                <th style={{ padding: '14px 20px', whiteSpace: 'nowrap', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>AVG WIN:LOSS P/L RATIO</span>
                    <div
                      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                      onMouseEnter={() => setActiveTooltipKey('avgWinLossRatio')}
                      onMouseLeave={() => setActiveTooltipKey(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltipKey(activeTooltipKey === 'avgWinLossRatio' ? null : 'avgWinLossRatio');
                      }}
                    >
                      <button
                        type="button"
                        data-tooltip-trigger="avgWinLossRatio"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: activeTooltipKey === 'avgWinLossRatio' ? 'var(--text-primary)' : 'var(--text-muted)',
                          opacity: activeTooltipKey === 'avgWinLossRatio' ? 1 : 0.65,
                          transition: 'all 0.15s ease',
                        }}
                        title="Avg Win:Loss Ratio details"
                      >
                        <Info size={11} />
                      </button>

                      {activeTooltipKey === 'avgWinLossRatio' && (
                        <div
                          ref={tooltipRef}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            right: '0',
                            zIndex: 100,
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                            borderRadius: '10px',
                            padding: '10px 12px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                            width: '230px',
                            fontSize: '11px',
                            lineHeight: '1.45',
                            fontWeight: 500,
                            textTransform: 'none',
                            letterSpacing: 'normal',
                            color: 'var(--text-secondary)',
                            backdropFilter: 'blur(12px)',
                            whiteSpace: 'normal',
                            cursor: 'default',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              top: '-5px',
                              right: '12px',
                              transform: 'rotate(45deg)',
                              width: '8px',
                              height: '8px',
                              backgroundColor: 'var(--bg-card)',
                              borderLeft: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                              borderTop: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                            }}
                          />
                          Ratio of average winning trade profit to average losing trade loss (Avg Profit / Avg Loss). Measures trade payoff asymmetry.
                        </div>
                      )}
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {monthlyBreakdown.map((row) => (
                <tr
                  key={row.monthIdx}
                  style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
                    transition: 'background-color 0.15s ease',
                  }}
                  className="hover:bg-muted/30"
                >
                  {/* Month */}
                  <td
                    style={{
                      padding: '13px 20px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.month}
                  </td>

                  {/* Gross P/L */}
                  <td
                    style={{
                      padding: '13px 16px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      color:
                        row.grossPl > 0
                          ? '#10b981'
                          : row.grossPl < 0
                          ? '#f43f5e'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {row.grossPl > 0 ? `+₹${row.grossPl.toLocaleString('en-IN')}` : `₹${row.grossPl.toLocaleString('en-IN')}`}
                  </td>

                  {/* TAXES — Simple Black Numeric with Hover Pencil (Image 1 Parity) */}
                  <td style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      onClick={() => setActiveTaxDialogMonth(row.monthIdx)}
                      title={
                        row.isAutoApplied
                          ? `Auto-calculated from ${row.autoTradeCharges.tradeCount} trades (${row.autoTradeCharges.brokers.join(', ') || 'Broker'}). Click to customize or add ledger charges.`
                          : 'Open Real-time Tax Calculator'
                      }
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        borderRadius: '8px',
                        border: '1px solid transparent',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      className="hover:bg-muted/40 hover:border-border/60 hover:shadow-xs group/taxedit"
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                        }}
                      >
                        ₹{row.taxes.toLocaleString('en-IN')}
                      </span>
                      <Pencil
                        size={11}
                        style={{ color: 'var(--text-muted)' }}
                        className="opacity-0 group-hover/taxedit:opacity-80 transition-opacity"
                      />
                    </button>
                  </td>

                  {/* Tax % */}
                  <td
                    style={{
                      padding: '13px 16px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.taxPct.toFixed(2)}%
                  </td>

                  {/* Net P/L */}
                  <td
                    style={{
                      padding: '13px 16px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      color:
                        row.netPl > 0
                          ? '#10b981'
                          : row.netPl < 0
                          ? '#f43f5e'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {row.netPl > 0 ? `+₹${row.netPl.toLocaleString('en-IN')}` : `₹${row.netPl.toLocaleString('en-IN')}`}
                  </td>

                  {/* Gross PF Impact */}
                  <td
                    style={{
                      padding: '13px 16px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.pfImpact > 0 ? `+${row.pfImpact.toFixed(2)}%` : `${row.pfImpact.toFixed(2)}%`}
                  </td>

                  {/* Net PF Impact */}
                  <td
                    style={{
                      padding: '13px 16px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.netPfImpact > 0 ? `+${row.netPfImpact.toFixed(2)}%` : `${row.netPfImpact.toFixed(2)}%`}
                  </td>

                  {/* Trades */}
                  <td
                    style={{
                      padding: '13px 16px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.trades}
                  </td>

                  {/* Win Rate (Progress Bar + Text) */}
                  <td style={{ padding: '13px 20px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '4px',
                          backgroundColor: 'color-mix(in srgb, var(--border-color) 50%, transparent)',
                          borderRadius: '2px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${row.winRate}%`,
                            height: '100%',
                            backgroundColor: '#10b981',
                            borderRadius: '2px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {row.winRate}%
                      </span>
                    </div>
                  </td>

                  {/* Avg Profit */}
                  <td
                    style={{
                      padding: '13px 16px',
                      fontFamily: 'var(--font-mono)',
                      color: '#10b981',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ₹{Math.round(row.avgProfit).toLocaleString('en-IN')}
                  </td>

                  {/* Avg Loss */}
                  <td
                    style={{
                      padding: '13px 16px',
                      fontFamily: 'var(--font-mono)',
                      color: '#f43f5e',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ₹{Math.round(row.avgLoss).toLocaleString('en-IN')}
                  </td>

                  {/* Avg Win:Loss Ratio */}
                  <td style={{ padding: '13px 20px', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                        backgroundColor:
                          parseFloat(row.avgWinLossRatio) >= 2
                            ? 'rgba(16, 185, 129, 0.12)'
                            : parseFloat(row.avgWinLossRatio) >= 1
                            ? 'rgba(59, 130, 246, 0.12)'
                            : 'rgba(244, 63, 94, 0.12)',
                        color:
                          parseFloat(row.avgWinLossRatio) >= 2
                            ? '#10b981'
                            : parseFloat(row.avgWinLossRatio) >= 1
                            ? '#3b82f6'
                            : '#f43f5e',
                        border: `1px solid ${
                          parseFloat(row.avgWinLossRatio) >= 2
                            ? 'rgba(16, 185, 129, 0.25)'
                            : parseFloat(row.avgWinLossRatio) >= 1
                            ? 'rgba(59, 130, 246, 0.25)'
                            : 'rgba(244, 63, 94, 0.25)'
                        }`,
                      }}
                    >
                      {row.avgWinLossRatio}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>

            {/* ── Summary Totals Row ── */}
            <tfoot>
              <tr
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderTop: '1px solid color-mix(in srgb, var(--border-color) 70%, transparent)',
                  fontWeight: 600,
                  fontSize: '12px',
                }}
              >
                <td style={{ padding: '16px 20px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  TOTAL
                </td>
                <td
                  style={{
                    padding: '16px 16px',
                    fontFamily: 'var(--font-mono)',
                    color: tableTotals.totalGross >= 0 ? '#10b981' : '#f43f5e',
                  }}
                >
                  {tableTotals.totalGross >= 0 ? `+₹${tableTotals.totalGross.toLocaleString('en-IN')}` : `₹${tableTotals.totalGross.toLocaleString('en-IN')}`}
                </td>
                <td style={{ padding: '16px 16px', fontFamily: 'var(--font-mono)', color: '#f43f5e' }}>
                  ₹{tableTotals.totalTaxes.toLocaleString('en-IN')}
                </td>
                <td style={{ padding: '16px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {tableTotals.taxPct.toFixed(2)}%
                </td>
                <td
                  style={{
                    padding: '16px 16px',
                    fontFamily: 'var(--font-mono)',
                    color: tableTotals.totalNet >= 0 ? '#10b981' : '#f43f5e',
                  }}
                >
                  {tableTotals.totalNet >= 0 ? `+₹${tableTotals.totalNet.toLocaleString('en-IN')}` : `₹${tableTotals.totalNet.toLocaleString('en-IN')}`}
                </td>
                <td style={{ padding: '16px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {tableTotals.grossPfImpact >= 0 ? `+${tableTotals.grossPfImpact.toFixed(2)}%` : `${tableTotals.grossPfImpact.toFixed(2)}%`}
                </td>
                <td style={{ padding: '16px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {tableTotals.netPfImpact >= 0 ? `+${tableTotals.netPfImpact.toFixed(2)}%` : `${tableTotals.netPfImpact.toFixed(2)}%`}
                </td>
                <td style={{ padding: '16px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {tableTotals.totalTrades}
                </td>
                <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {tableTotals.winRate.toFixed(1)}%
                </td>
                <td style={{ padding: '16px 16px', fontFamily: 'var(--font-mono)', color: '#10b981' }}>
                  ₹{Math.round(tableTotals.avgProfit).toLocaleString('en-IN')}
                </td>
                <td style={{ padding: '16px 16px', fontFamily: 'var(--font-mono)', color: '#f43f5e' }}>
                  ₹{Math.round(tableTotals.avgLoss).toLocaleString('en-IN')}
                </td>
                <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      backgroundColor:
                        parseFloat(tableTotals.avgRatio) >= 2
                          ? 'rgba(16, 185, 129, 0.12)'
                          : parseFloat(tableTotals.avgRatio) >= 1
                          ? 'rgba(59, 130, 246, 0.12)'
                          : 'rgba(244, 63, 94, 0.12)',
                      color:
                        parseFloat(tableTotals.avgRatio) >= 2
                          ? '#10b981'
                          : parseFloat(tableTotals.avgRatio) >= 1
                          ? '#3b82f6'
                          : '#f43f5e',
                      border: `1px solid ${
                        parseFloat(tableTotals.avgRatio) >= 2
                          ? 'rgba(16, 185, 129, 0.25)'
                          : parseFloat(tableTotals.avgRatio) >= 1
                          ? 'rgba(59, 130, 246, 0.25)'
                          : 'rgba(244, 63, 94, 0.25)'
                      }`,
                    }}
                  >
                    {tableTotals.avgRatio}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Real-Time Tax Input Dialog (Image 2 Parity) ── */}
      {activeTaxDialogMonth !== null && activeDialogRow && (
        <TaxInputDialog
          isOpen={activeTaxDialogMonth !== null}
          onClose={() => setActiveTaxDialogMonth(null)}
          monthName={activeDialogRow.month}
          monthIndex={activeDialogRow.monthIdx}
          year={selectedYear}
          grossPl={activeDialogRow.grossPl}
          initialData={detailedTaxesData[activeDialogRow.monthIdx] || { total: taxesData[activeDialogRow.monthIdx] || 0 }}
          autoTradeCharges={activeDialogRow.autoTradeCharges}
          isAutoChargesEnabled={isAutoChargesEnabled}
          onSave={handleSaveDetailedTax}
        />
      )}

      {/* ── Drawdown Details Modal (Portal) ── */}
      {isDrawdownModalOpen &&
        ReactDOM.createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}
            onClick={() => setIsDrawdownModalOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                borderRadius: '20px',
                padding: '28px',
                maxWidth: '440px',
                width: '90%',
                boxShadow: '0 16px 36px rgba(0,0,0,0.18)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontStyle: 'normal', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  Drawdown & Peak Diagnostics
                </h3>
                <button
                  type="button"
                  onClick={() => setIsDrawdownModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'var(--bg-primary)', borderRadius: '10px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: summaryMetrics.isAtPeak ? '#10b981' : '#f43f5e' }}>
                    {summaryMetrics.isAtPeak ? 'AT ALL-TIME PEAK' : 'IN DRAWDOWN'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'var(--bg-primary)', borderRadius: '10px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Peak Portfolio P/L:</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#10b981' }}>
                    ₹{parseFloat(summaryMetrics.peakRealized).toLocaleString('en-IN')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'var(--bg-primary)', borderRadius: '10px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Current Realized P/L:</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    ₹{parseFloat(summaryMetrics.currentRealized).toLocaleString('en-IN')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'var(--bg-primary)', borderRadius: '10px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Drawdown Amount:</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: summaryMetrics.isAtPeak ? '#10b981' : '#f43f5e' }}>
                    ₹{parseFloat(summaryMetrics.drawdownAmt).toLocaleString('en-IN')} ({summaryMetrics.drawdownPct}%)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'var(--bg-primary)', borderRadius: '10px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Realized Giveback:</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: summaryMetrics.isAtRealizedPeak ? '#10b981' : '#f43f5e' }}>
                    ₹{parseFloat(summaryMetrics.givebackAmt).toLocaleString('en-IN')} ({summaryMetrics.givebackPct}%)
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawdownModalOpen(false)}
                style={{
                  width: '100%',
                  marginTop: '20px',
                  padding: '11px',
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-surface)',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
