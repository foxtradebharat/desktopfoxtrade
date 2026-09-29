import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  LineChart,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Info,
  Calendar,
  ChevronDown,
  Check
} from 'lucide-react';
import SymbolLogo from '../SymbolLogo';

// ── Indian Benchmark Historical Proxies (FY 2026-2027) ───────────────────────
const INDIAN_BENCHMARKS = [
  {
    id: 'NIFTY 50',
    name: 'NIFTY 50',
    startVal: 24200,
    endVal: 25050,
    annualReturn: 14.8
  },
  {
    id: 'BANK NIFTY',
    name: 'BANK NIFTY',
    startVal: 51200,
    endVal: 53800,
    annualReturn: 12.4
  },
  {
    id: 'NIFTY MIDCAP 150',
    name: 'NIFTY MIDCAP',
    startVal: 20400,
    endVal: 22100,
    annualReturn: 21.4
  }
];

function formatINR(val, showSign = true) {
  const n = Number(val) || 0;
  const abs = Math.abs(n);
  let str = '';
  if (abs >= 10000000) {
    str = (abs / 10000000).toFixed(2) + ' Cr';
  } else if (abs >= 100000) {
    str = (abs / 100000).toFixed(2) + ' L';
  } else {
    str = abs.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  }
  const prefix = n < 0 ? '-₹' : showSign && n > 0 ? '+₹' : '₹';
  return prefix + str;
}

function parseTradeDate(dStr) {
  if (!dStr) return null;
  if (dStr instanceof Date && !isNaN(dStr)) return dStr;
  const s = String(dStr).trim();
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts[0].length === 4) return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  }
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts[2].length === 4) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  }
  return new Date(s);
}

function formatExactINR(val) {
  const n = Math.round(Number(val) || 0);
  const sign = n < 0 ? '-₹' : '₹';
  return sign + Math.abs(n).toLocaleString('en-IN');
}

function CustomNexusHeroTooltip({ active, payload, label, metricUnit = 'percent', perfTab = 'Growth', baseCapital = 0 }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload || {};

  const displayTitle = d.month || d.displayDate || d.date || label || 'Period';
  const pct = Number(d.plPercentage !== undefined ? d.plPercentage : (d.pct !== undefined ? d.pct : (d.cummPf || 0)));
  const plVal = Number(d.pl !== undefined ? d.pl : (d.pnl !== undefined ? d.pnl : 0));
  const startingCap = Number(d.startingCapital || baseCapital || 0);
  const movers = d.topMoversByImpact || [];

  return (
    <div style={{
      backgroundColor: 'var(--bg-card, #ffffff)',
      border: '1px solid var(--border-color, #e5e7eb)',
      borderRadius: '8px',
      padding: '8px 12px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      fontSize: '12px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      minWidth: '220px',
      pointerEvents: 'none'
    }}>
      {/* Period Header */}
      <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px', color: 'var(--text-primary, #18181b)' }}>
        {displayTitle}
      </div>

      {/* Metrics Section matching Nexus exact labels & colors */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ color: 'var(--text-muted, #71717a)' }}>{metricUnit === 'rupee' ? 'Monthly P&L:' : 'P&L Percentage:'}</span>
          <span style={{ fontWeight: 500, color: 'var(--text-primary, #18181b)' }}>
            {metricUnit === 'rupee' ? formatExactINR(plVal) : `${pct.toFixed(2)}%`}
          </span>
        </div>

        {metricUnit !== 'rupee' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ color: 'var(--text-muted, #71717a)' }}>{perfTab === 'Daily' ? 'Daily P&L:' : 'Monthly P&L:'}</span>
            <span style={{ fontWeight: 500, color: 'var(--text-primary, #18181b)' }}>
              {formatExactINR(plVal)}
            </span>
          </div>
        )}

        {metricUnit === 'rupee' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ color: 'var(--text-muted, #71717a)' }}>Monthly Return:</span>
            <span style={{ fontWeight: 500, color: 'var(--text-primary, #18181b)' }}>
              {pct.toFixed(2)}%
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ color: 'var(--text-muted, #71717a)' }}>Starting Capital:</span>
          <span style={{ fontWeight: 500, color: 'var(--text-primary, #18181b)' }}>
            {formatExactINR(startingCap)}
          </span>
        </div>
      </div>

      {/* Top Movers (PF Impact %) */}
      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color, #e5e7eb)' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #71717a)', marginBottom: '8px' }}>
          Top Movers (PF Impact %)
        </div>
        {movers.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {movers.map((m, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                  <div style={{ width: '16px', height: '16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SymbolLogo symbol={m.symbol} size={16} />
                  </div>
                  <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px', color: 'var(--text-primary, #18181b)' }}>
                    {m.symbol}
                  </span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 500, color: m.pfImpact >= 0 ? '#16a34a' : '#dc2626' }}>
                  {m.pfImpact >= 0 ? '+' : ''}{Number(m.pfImpact).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: '#a1a1aa', fontStyle: 'italic' }}>
            No trades closed in this period
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsPage({
  trades = [],
  portfolioCapital = 0,
  onOpenStockChart
}) {
  // ─── States matching Nexus ──────────────────────────────────────────────────
  const [pnlMode, setPnlMode] = useState('net'); // 'net' | 'gross'
  const [metricUnit, setMetricUnit] = useState('percent'); // 'percent' | 'rupee'
  const [perfTab, setPerfTab] = useState('Growth'); // 'Growth' | 'Monthly' | 'Equity' | 'Daily'
  const [isVsEnabled, setIsVsEnabled] = useState(false);
  const [selectedBenchmark, setSelectedBenchmark] = useState('NIFTY 50');
  const [performerMetric, setPerformerMetric] = useState('R:R'); // 'R:R' | 'Stock Move %' | 'P&L (₹)'
  const [isPerformerDropdownOpen, setIsPerformerDropdownOpen] = useState(false);
  
  // Stock Move % widget controls
  const [stockMoveMetric, setStockMoveMetric] = useState('Move'); // 'Move' | 'R-MULT'
  const [stockMoveInterval, setStockMoveInterval] = useState('Daily'); // 'Daily' | 'Weekly' | 'Monthly'
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isCustomizeBtnHovered, setIsCustomizeBtnHovered] = useState(false);
  const customizeDropdownRef = useRef(null);

  const [visibleSections, setVisibleSections] = useState(() => {
    try {
      const saved = localStorage.getItem('foxtrade_analytics_visible_sections');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      heroChart: true,
      performanceMetrics: true,
      tradeStatistics: true,
      topPerformers: true,
      stockMove: true
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('foxtrade_analytics_visible_sections', JSON.stringify(visibleSections));
    } catch (_) {}
  }, [visibleSections]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (customizeDropdownRef.current && !customizeDropdownRef.current.contains(e.target)) {
        setIsCustomizeOpen(false);
      }
    };
    if (isCustomizeOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCustomizeOpen]);

  const [capitalTick, setCapitalTick] = useState(0);
  useEffect(() => {
    const handleCapChange = () => setCapitalTick(t => t + 1);
    window.addEventListener('tradeontip_capital_updated', handleCapChange);
    return () => window.removeEventListener('tradeontip_capital_updated', handleCapChange);
  }, []);

  const baseCapital = useMemo(() => {
    // 1. Direct prop if passed and >= 50000
    if (Number(portfolioCapital) >= 50000) return Number(portfolioCapital);

    // 2. Active portfolio baseCapital from localStorage
    try {
      const activePfId = localStorage.getItem('tradeontip_active_portfolio_id');
      const pfs = JSON.parse(localStorage.getItem('tradeontip_portfolios') || '[]');
      const match = pfs.find(p => p.id === activePfId);
      if (match && Number(match.baseCapital) > 0) return Number(match.baseCapital);
    } catch (_) {}

    // 3. Direct read from active Fund Management capital additions
    try {
      const activePfId = localStorage.getItem('tradeontip_active_portfolio_id') || 'portfolio-default';
      const yr = new Date().getFullYear().toString();
      const key = `tradeontip_monthly_capital_${activePfId}_${yr}`;
      const fallbackKey = `tradeontip_monthly_capital_${yr}`;
      const raw = localStorage.getItem(key) || localStorage.getItem(fallbackKey);
      if (raw) {
        const changes = JSON.parse(raw);
        if (changes && typeof changes === 'object') {
          for (let m = 0; m < 12; m++) {
            const added = Number(changes[m]?.added || 0);
            if (added > 0) return added;
          }
        }
      }
    } catch (_) {}

    // 4. Direct prop if > 0
    if (Number(portfolioCapital) > 0) return Number(portfolioCapital);

    // 5. Fallback to tradeontip_base_capital ONLY if valid and data not cleared
    try {
      const isCleared = localStorage.getItem('tradeontip_data_cleared');
      if (isCleared === 'true') return 0;
      const stored = localStorage.getItem('tradeontip_base_capital');
      if (stored && Number(stored) > 0) {
        return Number(stored);
      }
    } catch (_) {}

    // 6. Default to 0 when no fund is added
    return 0;
  }, [portfolioCapital, capitalTick]);

  // ─── Indian STT & Net Charges Enrichment ───────────────────────────────────
  const enrichedTrades = useMemo(() => {
    return (trades || [])
      .filter(t => t && (t.name || t.symbol || '').trim())
      .map(t => {
      const rawPnl = t.pnl !== undefined ? Number(t.pnl) : (t.pl !== undefined ? Number(t.pl) : (t.grossPnl !== undefined ? Number(t.grossPnl) : 0));
      let grossPnl = rawPnl;
      let netPnl = grossPnl;
      let totalCharges = 0;

      if (t.charges && typeof t.charges.total === 'number' && t.charges.total > 0) {
        totalCharges = t.charges.total;
        netPnl = grossPnl - totalCharges;
      } else if (typeof t.totalCharges === 'number' && t.totalCharges > 0) {
        totalCharges = t.totalCharges;
        netPnl = grossPnl - totalCharges;
      } else if (typeof t.netPnl === 'number' && typeof t.grossPnl === 'number' && t.grossPnl > t.netPnl) {
        totalCharges = Math.round((t.grossPnl - t.netPnl) * 100) / 100;
        netPnl = t.netPnl;
      } else if (t.brokerage !== undefined && Number(t.brokerage) > 0) {
        totalCharges = Number(t.brokerage);
        netPnl = grossPnl - totalCharges;
      } else if (!t.isManual && t.originalSource !== 'manual' && t.brokerage === undefined) {
        const buyQty = Number(t.qty || t.initialQty || 1);
        const exitQty = Number(t.exitedQty || t.qty || buyQty);
        const buyPrice = Number(t.avgEntry || t.entry || 0);
        const exitPrice = Number(t.avgExitPrice || t.avgExit || t.cmp || buyPrice);
        const buyTurnover = buyPrice * buyQty;
        const sellTurnover = exitPrice * exitQty;
        const totalTurnover = buyTurnover + sellTurnover;

        if (totalTurnover > 0) {
          const isIntraday = t.segment === 'intraday' || /orb|vwap|scalp|5m|15m/i.test(t.setup || '');
          const stt = isIntraday ? (sellTurnover * 0.00025) : ((buyTurnover * 0.001) + (sellTurnover * 0.001));
          const brokerage = Math.min(20, buyTurnover * 0.0003) + Math.min(20, sellTurnover * 0.0003);
          const txn = totalTurnover * 0.0000345;
          const sebi = totalTurnover * 0.000001;
          const stamp = buyTurnover * 0.00015;
          const gst = (brokerage + txn + sebi) * 0.18;
          totalCharges = Math.round((stt + brokerage + txn + sebi + stamp + gst) * 100) / 100;
          netPnl = Math.round((grossPnl - totalCharges) * 100) / 100;
        }
      }

      const parsedDate = parseTradeDate(t.date);
      const closeDateStr = t.exitDate || t.e3Date || t.exit3Date || t.e2Date || t.exit2Date || t.e1Date || t.exit1Date || t.date;
      const parsedCloseDate = parseTradeDate(closeDateStr) || parsedDate;
      const stockMove = Number(t.stockMove !== undefined ? t.stockMove : t.stockMovePct || 0);
      
      const rawRR = (t.rewardRisk !== undefined && t.rewardRisk !== null && t.rewardRisk !== '')
        ? Number(t.rewardRisk)
        : ((t.rr !== undefined && t.rr !== null && t.rr !== '') ? Number(t.rr) : (grossPnl >= 0 ? 1.5 : -1));
      const rewardRisk = isNaN(rawRR) ? 0 : rawRR;

      let holdingDays = 0;
      if (t.holdingDays !== undefined && t.holdingDays !== null && t.holdingDays !== '' && !isNaN(Number(t.holdingDays)) && Number(t.holdingDays) > 0) {
        holdingDays = Number(t.holdingDays);
      } else if (t.holdingPeriod !== undefined && !isNaN(Number(t.holdingPeriod)) && Number(t.holdingPeriod) > 0) {
        holdingDays = Number(t.holdingPeriod);
      } else if (parsedCloseDate && parsedDate && parsedCloseDate >= parsedDate) {
        holdingDays = Math.max(0, Math.round((parsedCloseDate.getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24)));
      }

      const status = t.status || t.positionStatus || (t.exitedQty > 0 || grossPnl !== 0 ? 'Closed' : 'Open');

      return {
        ...t,
        status,
        positionStatus: status,
        grossPnl,
        netPnl,
        activePnl: pnlMode === 'gross' ? grossPnl : netPnl,
        totalCharges,
        parsedDate,
        parsedCloseDate,
        stockMove,
        holdingDays,
        rewardRisk: parseFloat(rewardRisk.toFixed(2))
      };
    });
  }, [trades, pnlMode]);

  const totalIncurredCharges = useMemo(() => {
    return enrichedTrades.reduce((acc, t) => acc + (t.totalCharges || 0), 0);
  }, [enrichedTrades]);

  // ─── 1. Portfolio Performance Chart Time Series (Nexus Exact) ──────────────
  const { performanceData, monthlyData, dailyData, headlineReturnPct, alphaVsBenchmark, heroHasTrades } = useMemo(() => {
    const closed = enrichedTrades
      .filter(t => (t.status === 'Closed' || t.status === 'Partial' || t.positionStatus === 'Closed') && t.parsedDate)
      .sort((a, b) => a.parsedDate - b.parsedDate);

    const bObj = INDIAN_BENCHMARKS.find(b => b.id === selectedBenchmark) || INDIAN_BENCHMARKS[0];
    const today = new Date();

    if (!closed.length) {
      const dummyDaily = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dayStr = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`;
        const isoKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dummyDaily.push({
          date: dayStr,
          fullDate: isoKey,
          displayDate: dayStr,
          month: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
          capital: baseCapital,
          startingCapital: baseCapital,
          pl: 0,
          pnl: 0,
          cummPf: 0,
          pct: 0,
          plPercentage: 0,
          symbols: [],
          topMoversByImpact: []
        });
      }

      // Generate 5 continuous months ending in current month: e.g. May 2026, Jun 2026, Jul 2026, Aug 2026, Sep 2026
      const dummyMonthly = [];
      for (let i = 4; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        dummyMonthly.push({
          monthKey: key,
          date: label,
          month: label,
          displayDate: label,
          pl: 0,
          pnl: 0,
          startingCapital: baseCapital,
          capital: baseCapital,
          pct: 0,
          plPercentage: 0,
          cummPf: 0,
          count: 0,
          topMoversByImpact: [],
          benchmarkPct: 0
        });
      }

      return {
        performanceData: dummyMonthly,
        monthlyData: dummyMonthly,
        dailyData: dummyDaily,
        headlineReturnPct: 0,
        alphaVsBenchmark: 0,
        heroHasTrades: false
      };
    }

    // Monthly Data matching Nexus exact timeline & Top Movers calculation
    const monthMap = {};
    closed.forEach(t => {
      const exitLegs = [
        { date: t.e1Date || t.exit1Date, qty: Number(t.e1Qty || t.exit1Qty || 0), price: Number(t.e1Price || t.exit1Price || 0) },
        { date: t.e2Date || t.exit2Date, qty: Number(t.e2Qty || t.exit2Qty || 0), price: Number(t.e2Price || t.exit2Price || 0) },
        { date: t.e3Date || t.exit3Date, qty: Number(t.e3Qty || t.exit3Qty || 0), price: Number(t.e3Price || t.exit3Price || 0) }
      ].filter(l => l.date && l.qty > 0 && l.price > 0);

      const avgEntry = Number(t.avgEntry || t.entry || 0);
      const totalLegQty = exitLegs.reduce((acc, l) => acc + l.qty, 0);
      const symbol = (t.symbol || t.name || 'Stock').toUpperCase().trim();

      if (exitLegs.length > 1 && totalLegQty > 0 && avgEntry > 0) {
        exitLegs.forEach(leg => {
          const pDate = parseTradeDate(leg.date) || t.parsedCloseDate || t.parsedDate;
          if (!pDate) return;
          const key = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
          const label = pDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
          if (!monthMap[key]) monthMap[key] = { monthKey: key, date: label, month: label, pnl: 0, count: 0, symbolPlMap: {} };
          const legPl = (leg.price - avgEntry) * leg.qty;
          monthMap[key].pnl += legPl;
          monthMap[key].count += 1;
          if (!monthMap[key].symbolPlMap[symbol]) monthMap[key].symbolPlMap[symbol] = 0;
          monthMap[key].symbolPlMap[symbol] += legPl;
        });
      } else {
        const dateToUse = t.parsedCloseDate || t.parsedDate;
        if (!dateToUse) return;
        const key = `${dateToUse.getFullYear()}-${String(dateToUse.getMonth() + 1).padStart(2, '0')}`;
        const label = dateToUse.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        if (!monthMap[key]) monthMap[key] = { monthKey: key, date: label, month: label, pnl: 0, count: 0, symbolPlMap: {} };
        monthMap[key].pnl += t.activePnl;
        monthMap[key].count += 1;
        if (!monthMap[key].symbolPlMap[symbol]) monthMap[key].symbolPlMap[symbol] = 0;
        monthMap[key].symbolPlMap[symbol] += t.activePnl;
      }
    });

    let minTradeDate = null;
    let maxTradeDate = null;
    closed.forEach(t => {
      const d = t.parsedCloseDate || t.parsedDate;
      if (d && !isNaN(d.getTime())) {
        if (!minTradeDate || d < minTradeDate) minTradeDate = new Date(d);
        if (!maxTradeDate || d > maxTradeDate) maxTradeDate = new Date(d);
      }
    });

    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 4, 1);
    const startRange = minTradeDate && minTradeDate < sixMonthsAgo ? minTradeDate : sixMonthsAgo;
    const endRange = (maxTradeDate && maxTradeDate > today) ? maxTradeDate : today;

    const continuousMonthKeys = [];
    const curMonth = new Date(startRange.getFullYear(), startRange.getMonth(), 1);
    const endMonth = new Date(endRange.getFullYear(), endRange.getMonth(), 1);
    while (curMonth <= endMonth) {
      continuousMonthKeys.push(`${curMonth.getFullYear()}-${String(curMonth.getMonth() + 1).padStart(2, '0')}`);
      curMonth.setMonth(curMonth.getMonth() + 1);
    }

    const allMonthKeys = new Set([...continuousMonthKeys, ...Object.keys(monthMap)]);
    const sortedMonthKeys = Array.from(allMonthKeys).sort();

    const effectiveBaseCapital = baseCapital > 0 
      ? baseCapital 
      : (Number(closed.find(t => Number(t.totalCapitalAllocated) > 0)?.totalCapitalAllocated) || (closed.length > 0 ? 500000 : 0));

    let runningCapital = effectiveBaseCapital;
    const monthlyList = sortedMonthKeys.map((k, idx) => {
      const existing = monthMap[k];
      const p = existing ? existing.pnl : 0;
      const count = existing ? existing.count : 0;
      const [y, m] = k.split('-');
      const d = new Date(Number(y), Number(m) - 1, 1);
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      const monthStartCapital = runningCapital;
      const returnPct = monthStartCapital > 0 ? (p / monthStartCapital) * 100 : 0;
      runningCapital += p;

      const symMap = existing ? (existing.symbolPlMap || {}) : {};
      const topMoversByImpact = Object.entries(symMap)
        .map(([symbol, symPl]) => ({
          symbol,
          pl: Math.round(symPl),
          pfImpact: monthStartCapital > 0 ? (symPl / monthStartCapital) * 100 : 0
        }))
        .sort((a, b) => Math.abs(b.pfImpact) - Math.abs(a.pfImpact))
        .slice(0, 5);

      const cummReturnPct = effectiveBaseCapital > 0 ? ((runningCapital - effectiveBaseCapital) / effectiveBaseCapital) * 100 : 0;
      const progress = sortedMonthKeys.length > 1 ? idx / (sortedMonthKeys.length - 1) : 0;
      const benchmarkVal = Math.round(bObj.startVal + (bObj.endVal - bObj.startVal) * progress);
      const benchmarkPct = bObj.startVal > 0 ? ((benchmarkVal - bObj.startVal) / bObj.startVal) * 100 : 0;

      return {
        monthKey: k,
        date: label,
        month: label,
        displayDate: label,
        pl: Math.round(p),
        pnl: Math.round(p),
        startingCapital: monthStartCapital,
        capital: runningCapital,
        pct: parseFloat(returnPct.toFixed(2)),
        plPercentage: parseFloat(returnPct.toFixed(2)),
        cummPf: parseFloat(cummReturnPct.toFixed(2)),
        count,
        topMoversByImpact,
        benchmarkVal,
        benchmarkPct: parseFloat(benchmarkPct.toFixed(2))
      };
    });

    // Daily Continuous Timeline dynamically derived from actual trade dates
    const dailyPlMap = {};
    closed.forEach(t => {
      const exitLegs = [
        { date: t.e1Date || t.exit1Date, qty: Number(t.e1Qty || t.exit1Qty || 0), price: Number(t.e1Price || t.exit1Price || 0) },
        { date: t.e2Date || t.exit2Date, qty: Number(t.e2Qty || t.exit2Qty || 0), price: Number(t.e2Price || t.exit2Price || 0) },
        { date: t.e3Date || t.exit3Date, qty: Number(t.e3Qty || t.exit3Qty || 0), price: Number(t.e3Price || t.exit3Price || 0) }
      ].filter(l => l.date && l.qty > 0 && l.price > 0);

      const avgEntry = Number(t.avgEntry || t.entry || 0);
      const symbol = (t.symbol || t.name || 'Stock').toUpperCase().trim();

      if (exitLegs.length > 1 && avgEntry > 0) {
        exitLegs.forEach(leg => {
          const pDate = parseTradeDate(leg.date) || t.parsedCloseDate || t.parsedDate;
          if (!pDate) return;
          const k = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;
          if (!dailyPlMap[k]) dailyPlMap[k] = { pl: 0, symbols: new Set(), symbolPlMap: {} };
          const legPl = (leg.price - avgEntry) * leg.qty;
          dailyPlMap[k].pl += legPl;
          dailyPlMap[k].symbols.add(symbol);
          dailyPlMap[k].symbolPlMap[symbol] = (dailyPlMap[k].symbolPlMap[symbol] || 0) + legPl;
        });
      } else {
        const pDate = t.parsedCloseDate || t.parsedDate;
        if (!pDate) return;
        const k = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;
        if (!dailyPlMap[k]) dailyPlMap[k] = { pl: 0, symbols: new Set(), symbolPlMap: {} };
        dailyPlMap[k].pl += t.activePnl;
        dailyPlMap[k].symbols.add(symbol);
        dailyPlMap[k].symbolPlMap[symbol] = (dailyPlMap[k].symbolPlMap[symbol] || 0) + t.activePnl;
      }
    });

    const dailyStartDate = minTradeDate ? new Date(minTradeDate.getFullYear(), minTradeDate.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1);
    const finalDate = (maxTradeDate && maxTradeDate > today) ? maxTradeDate : today;

    const dailyList = [];
    let runningDailyCap = effectiveBaseCapital;

    const startMonthShort = dailyStartDate.toLocaleString('en-US', { month: 'short' });
    const startYearShort = String(dailyStartDate.getFullYear()).slice(2);
    dailyList.push({
      date: `1 ${startMonthShort} '${startYearShort}`,
      fullDate: `${dailyStartDate.getFullYear()}-${String(dailyStartDate.getMonth() + 1).padStart(2, '0')}-01`,
      month: `${dailyStartDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })} (Start)`,
      displayDate: `1 ${startMonthShort} '${startYearShort}`,
      capital: effectiveBaseCapital,
      startingCapital: effectiveBaseCapital,
      pl: 0,
      pnl: 0,
      pct: 0,
      plPercentage: 0,
      cummPf: 0,
      symbols: [],
      topMoversByImpact: []
    });

    const curr = new Date(dailyStartDate);
    while (curr <= finalDate) {
      const y = curr.getFullYear();
      const m = curr.getMonth();
      const d = curr.getDate();
      const isoKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const monthShort = curr.toLocaleString('en-US', { month: 'short' });
      const yearShort = String(y).slice(2);
      const dateLabel = `${d} ${monthShort} '${yearShort}`;

      const dayData = dailyPlMap[isoKey];
      const dayPl = dayData ? dayData.pl : 0;
      const daySymbols = dayData ? Array.from(dayData.symbols) : [];
      const dayStartCap = runningDailyCap;

      runningDailyCap += dayPl;
      const returnPct = effectiveBaseCapital > 0 ? ((runningDailyCap - effectiveBaseCapital) / effectiveBaseCapital) * 100 : 0;
      const dayPct = dayStartCap > 0 ? (dayPl / dayStartCap) * 100 : 0;

      const daySymMap = dayData ? (dayData.symbolPlMap || {}) : {};
      const dayTopMovers = Object.entries(daySymMap)
        .map(([symbol, symPl]) => ({
          symbol,
          pl: Math.round(symPl),
          pfImpact: dayStartCap > 0 ? (symPl / dayStartCap) * 100 : 0
        }))
        .sort((a, b) => Math.abs(b.pfImpact) - Math.abs(a.pfImpact))
        .slice(0, 5);

      dailyList.push({
        date: dateLabel,
        fullDate: isoKey,
        month: curr.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        displayDate: dateLabel,
        capital: parseFloat(runningDailyCap.toFixed(2)),
        startingCapital: dayStartCap,
        pl: Math.round(dayPl),
        pnl: Math.round(dayPl),
        pct: parseFloat(dayPct.toFixed(2)),
        plPercentage: parseFloat(dayPct.toFixed(2)),
        cummPf: parseFloat(returnPct.toFixed(3)),
        symbols: daySymbols,
        topMoversByImpact: dayTopMovers
      });

      curr.setDate(curr.getDate() + 1);
    }

    const headlineReturn = effectiveBaseCapital > 0 ? ((runningCapital - effectiveBaseCapital) / effectiveBaseCapital) * 100 : 0;
    const finalBenchPct = monthlyList[monthlyList.length - 1]?.benchmarkPct || 0;
    const alpha = headlineReturn - finalBenchPct;

    return {
      performanceData: monthlyList,
      monthlyData: monthlyList,
      dailyData: dailyList,
      headlineReturnPct: parseFloat(headlineReturn.toFixed(2)),
      alphaVsBenchmark: parseFloat(alpha.toFixed(2)),
      heroHasTrades: true
    };
  }, [enrichedTrades, baseCapital, selectedBenchmark]);

  // Dynamic Y-Axis scale & formatting matching Nexus exact Growth tab
  const growthYAxisConfig = useMemo(() => {
    if (metricUnit === 'percent') {
      if (!heroHasTrades) {
        return {
          domain: [0, 2.5],
          ticks: [0, 0.5, 1.0, 1.5, 2.0, 2.5],
          tickFormatter: (t) => `${Number(t).toFixed(2)}%`
        };
      }
      const pcts = (monthlyData || []).map(d => Number(d.plPercentage || 0));
      const minPct = Math.min(...pcts, 0);
      const maxPct = Math.max(...pcts, 0);
      if (minPct >= 0) {
        const top = Math.max(2.5, Math.ceil(maxPct * 1.15 * 2) / 2);
        return {
          domain: [0, top],
          ticks: undefined,
          tickFormatter: (t) => `${Number(t).toFixed(2)}%`
        };
      }
      return {
        domain: ['auto', 'auto'],
        ticks: undefined,
        tickFormatter: (t) => `${Number(t).toFixed(2)}%`
      };
    } else {
      // Rupee mode
      if (!heroHasTrades) {
        return {
          domain: [0, 10000],
          ticks: [0, 2000, 4000, 6000, 8000, 10000],
          tickFormatter: (t) => `₹${Math.round(t).toLocaleString('en-IN')}`
        };
      }
      const pls = (monthlyData || []).map(d => Number(d.pl || 0));
      const minPl = Math.min(...pls, 0);
      const maxPl = Math.max(...pls, 0);
      return {
        domain: [minPl < 0 ? minPl * 1.1 : 0, Math.max(10000, maxPl * 1.15)],
        ticks: undefined,
        tickFormatter: (t) => `₹${Math.round(t).toLocaleString('en-IN')}`
      };
    }
  }, [metricUnit, heroHasTrades, monthlyData]);

  // ─── 2. Metric Calculations for Column 1 & 2 ───────────────────────────────
  const metrics = useMemo(() => {
    const totalTradesCount = enrichedTrades.length;
    const closed = enrichedTrades.filter(t => t.status === 'Closed' || t.status === 'Partial');
    const open = enrichedTrades.filter(t => t.status === 'Open' || (Number(t.openQty || 0) > 0 && t.status !== 'Closed') || !t.status);

    const closedCount = closed.length;
    const wins = closed.filter(t => t.activePnl > 0);
    const losses = closed.filter(t => t.activePnl < 0);

    const winCount = wins.length;
    const lossCount = losses.length;

    // Win Rate: In Nexus P/L Method, calculated on decided trades (where P/L != 0)
    const decidedTrades = closed.filter(t => t.activePnl !== 0);
    const winRate = decidedTrades.length > 0
      ? (winCount / decidedTrades.length) * 100
      : (closedCount > 0 ? (winCount / closedCount) * 100 : 0);

    const totalWinPnl = wins.reduce((acc, t) => acc + t.activePnl, 0);
    const totalLossPnl = Math.abs(losses.reduce((acc, t) => acc + t.activePnl, 0));
    const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : totalWinPnl > 0 ? 99.9 : 0;

    const avgWinPnl = winCount > 0 ? totalWinPnl / winCount : 0;
    const avgLossPnl = lossCount > 0 ? totalLossPnl / lossCount : 0;

    const expectancy = closedCount > 0
      ? ((winRate / 100) * avgWinPnl) - (((100 - winRate) / 100) * avgLossPnl)
      : 0;

    const avgWinMove = winCount > 0
      ? wins.reduce((acc, t) => acc + Math.abs(t.stockMove || 0), 0) / winCount
      : 0;

    const avgLossMove = lossCount > 0
      ? losses.reduce((acc, t) => acc + Math.abs(t.stockMove || 0), 0) / lossCount
      : 0;

    const avgHoldingDays = closedCount > 0
      ? closed.reduce((acc, t) => acc + (Number(t.holdingDays || 0)), 0) / closedCount
      : 0;

    const avgAllocation = closedCount > 0
      ? closed.reduce((acc, t) => {
          const sz = Number(t.allocation || t.positionSizePct || 0);
          if (sz > 0) return acc + sz;
          const cap = (Number(t.avgEntry || t.entry || 0) * Number(t.qty || 1));
          return acc + (baseCapital > 0 ? (cap / baseCapital) * 100 : 5);
        }, 0) / closedCount
      : 0;

    const avgRR = closedCount > 0
      ? closed.reduce((acc, t) => acc + (typeof t.rewardRisk === 'number' && !isNaN(t.rewardRisk) ? t.rewardRisk : (Number(t.rewardRisk) || 0)), 0) / closedCount
      : 0;

    const planFollowedTrades = closed.filter(t => t.planFollowed === true || String(t.planFollowed).toLowerCase() === 'yes' || t.isPlanned === true);
    const planFollowedPct = closedCount > 0 ? (planFollowedTrades.length / closedCount) * 100 : 0;

    // Cash %: 100% minus total capital invested in active open positions
    const effectiveCap = baseCapital > 0 ? baseCapital : 100000;
    const totalOpenInvestedPct = open.reduce((acc, t) => {
      if (t.currentAllocation !== undefined && Number(t.currentAllocation) > 0) {
        return acc + Number(t.currentAllocation);
      }
      const openQty = Number(t.openQty || t.qty || 0);
      const entryPrice = Number(t.avgEntry || t.entry || 0);
      const openVal = openQty * entryPrice;
      return acc + (effectiveCap > 0 ? (openVal / effectiveCap) * 100 : 0);
    }, 0);
    const cashPct = Math.max(0, 100 - totalOpenInvestedPct);

    return {
      totalTrades: totalTradesCount,
      winRate: winRate.toFixed(2) + '%',
      winRateRaw: winRate,
      avgWinMove: '+' + avgWinMove.toFixed(2) + '%',
      avgLossMove: '-' + avgLossMove.toFixed(2) + '%',
      avgPositionSize: avgAllocation.toFixed(2) + '%',
      avgHoldingDays: avgHoldingDays.toFixed(2),
      planFollowed: planFollowedPct.toFixed(2) + '%',
      avgR: avgRR.toFixed(2) + 'R',
      openPositions: open.length,
      cash: cashPct.toFixed(2) + '%',
      profitFactor: closedCount === 0 ? '0.00×' : (profitFactor >= 99.9 ? '∞' : profitFactor.toFixed(2) + '×'),
      expectancy: formatINR(expectancy),
      avgGain: '+' + avgWinMove.toFixed(2) + '%',
      avgLoss: '-' + avgLossMove.toFixed(2) + '%'
    };
  }, [enrichedTrades, baseCapital]);

  // ─── 3. Top Performers (Highest & Lowest Extreme Cards) ────────────────────
  const { highestTrade, lowestTrade } = useMemo(() => {
    const closed = enrichedTrades.filter(t => t.status === 'Closed' || t.status === 'Partial');
    if (!closed.length) return { highestTrade: null, lowestTrade: null };

    let high = closed[0];
    let low = closed[0];

    if (performerMetric === 'R:R') {
      const sorted = [...closed].sort((a, b) => (b.rewardRisk || 0) - (a.rewardRisk || 0));
      high = sorted[0];
      low = sorted[sorted.length - 1];
    } else if (performerMetric === 'Stock Move %') {
      const sorted = [...closed].sort((a, b) => (b.stockMove || 0) - (a.stockMove || 0));
      high = sorted[0];
      low = sorted[sorted.length - 1];
    } else {
      const sorted = [...closed].sort((a, b) => (b.activePnl || 0) - (a.activePnl || 0));
      high = sorted[0];
      low = sorted[sorted.length - 1];
    }

    return { highestTrade: high, lowestTrade: low };
  }, [enrichedTrades, performerMetric]);

  // ─── 4. Stock Move % Distribution Series (Nexus Exact Aggregation) ─────────
  const { stockMoveSeries, stockMoveHasTrades } = useMemo(() => {
    const validTrades = enrichedTrades.filter(t => 
      (t.status === 'Closed' || t.status === 'Partial' || t.positionStatus === 'Closed' || (t.stockMove !== undefined && Math.abs(t.stockMove) > 0.001)) &&
      (t.parsedCloseDate || t.parsedDate)
    );

    if (!validTrades.length) {
      const today = new Date();
      const dummySeries = [];

      if (stockMoveInterval === 'Daily') {
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          dummySeries.push({
            date: key,
            dateMs: d.getTime(),
            displayDate,
            avgStockMove: 0,
            avgRMultiple: 0,
            avgRating: 0,
            totalPfImpact: 0,
            tradeCount: 0,
            topPerformers: [],
            allTrades: []
          });
        }
      } else if (stockMoveInterval === 'Weekly') {
        for (let w = 4; w >= 0; w--) {
          const d = new Date(today);
          d.setDate(d.getDate() - (w * 7));
          const startOfWeek = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
          const key = `W-${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
          const displayDate = `Week of ${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
          dummySeries.push({
            date: key,
            dateMs: startOfWeek.getTime(),
            displayDate,
            avgStockMove: 0,
            avgRMultiple: 0,
            avgRating: 0,
            totalPfImpact: 0,
            tradeCount: 0,
            topPerformers: [],
            allTrades: []
          });
        }
      } else {
        // Monthly
        for (let m = 5; m >= 0; m--) {
          const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
          const key = `M-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const displayDate = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          dummySeries.push({
            date: key,
            dateMs: d.getTime(),
            displayDate,
            avgStockMove: 0,
            avgRMultiple: 0,
            avgRating: 0,
            totalPfImpact: 0,
            tradeCount: 0,
            topPerformers: [],
            allTrades: []
          });
        }
      }

      return {
        stockMoveSeries: dummySeries,
        stockMoveHasTrades: false
      };
    }

    // Grouping by interval: 'Daily' | 'Weekly' | 'Monthly'
    const groups = {};

    validTrades.forEach(t => {
      const d = t.parsedCloseDate || t.parsedDate;
      if (!d || isNaN(d.getTime())) return;

      let key = '';
      let dateMs = 0;
      let displayDate = '';

      if (stockMoveInterval === 'Daily') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        dateMs = dayDate.getTime();
        displayDate = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } else if (stockMoveInterval === 'Weekly') {
        const startOfWeek = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday start
        key = `W-${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
        dateMs = startOfWeek.getTime();
        displayDate = `Week of ${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      } else {
        // Monthly
        key = `M-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        dateMs = monthStart.getTime();
        displayDate = `${d.getMonth() + 1}/${d.getFullYear()}`;
      }

      if (!groups[key]) {
        groups[key] = {
          date: key,
          dateMs,
          displayDate,
          trades: []
        };
      }
      groups[key].trades.push(t);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => groups[a].dateMs - groups[b].dateMs);

    const mapped = sortedKeys.map(k => {
      const grp = groups[k];
      const trades = grp.trades;
      const count = trades.length;

      const sumStockMove = trades.reduce((acc, t) => acc + (Number(t.stockMove) || 0), 0);
      const sumRMultiple = trades.reduce((acc, t) => acc + (Number(t.rewardRisk) || 0), 0);
      const sumPfImpact = trades.reduce((acc, t) => acc + (Number(t.pfImpact) || 0), 0);
      const sumRating = trades.reduce((acc, t) => acc + (Number(t.rating) || 0), 0);

      const avgStockMove = count > 0 ? parseFloat((sumStockMove / count).toFixed(2)) : 0;
      const avgRMultiple = count > 0 ? parseFloat((sumRMultiple / count).toFixed(2)) : 0;
      const avgRating = count > 0 ? parseFloat((sumRating / count).toFixed(1)) : 0;
      const totalPfImpact = parseFloat(sumPfImpact.toFixed(2));

      // Sort all trades descending by stock move
      const allTrades = [...trades]
        .sort((a, b) => (Number(b.stockMove) || 0) - (Number(a.stockMove) || 0))
        .map((t, idx) => ({
          id: t.id || t.tradeNo || `${t.name || t.symbol}-${idx}`,
          tradeNo: t.tradeNo || idx + 1,
          symbol: t.name || t.symbol || 'STOCK',
          stockMove: Number(t.stockMove) || 0,
          rewardRisk: Number(t.rewardRisk) || 0,
          rating: Number(t.rating) || 0,
          pfImpact: Number(t.pfImpact) || 0,
          positionSize: t.positionSize || 0
        }));

      const topPerformers = allTrades.slice(0, 3);

      return {
        date: grp.date,
        dateMs: grp.dateMs,
        displayDate: grp.displayDate,
        avgStockMove,
        avgRMultiple,
        avgRating,
        totalPfImpact,
        tradeCount: count,
        topPerformers,
        allTrades
      };
    });

    return {
      stockMoveSeries: mapped,
      stockMoveHasTrades: true
    };
  }, [enrichedTrades, stockMoveInterval]);

  const avgStockMovement = useMemo(() => {
    if (!stockMoveHasTrades || !stockMoveSeries.length) return 0;
    const sum = stockMoveSeries.reduce((a, b) => a + (stockMoveMetric === 'Move' ? b.avgStockMove : b.avgRMultiple), 0);
    return parseFloat((sum / stockMoveSeries.length).toFixed(2));
  }, [stockMoveSeries, stockMoveMetric, stockMoveHasTrades]);

  return (
    <main style={{ maxWidth: '1088px', margin: '0 auto', padding: '16px 27px 110px 27px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      
      {/* ── HEADER ROW (NEXUS-EXACT) ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 700,
            fontStyle: 'italic',
            color: '#18181b',
            letterSpacing: '-0.03em',
            margin: '0 0 4px 0',
            lineHeight: 1.15
          }}>
            Analytics
          </h1>
          <p style={{ fontSize: '13px', color: '#71717a', margin: 0 }}>
            Detailed breakdown of your trading performance.
          </p>
        </div>

        {/* Right Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Customize Dashboard Button & Dropdown Menu */}
          <div ref={customizeDropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsCustomizeOpen(prev => !prev)}
              onMouseEnter={() => setIsCustomizeBtnHovered(true)}
              onMouseLeave={() => setIsCustomizeBtnHovered(false)}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                border: (isCustomizeOpen || isCustomizeBtnHovered) ? '1px solid #d4d4d8' : '1px solid #e4e4e7',
                backgroundColor: isCustomizeOpen ? '#e4e4e7' : (isCustomizeBtnHovered ? '#ebebef' : '#f4f4f5'),
                color: (isCustomizeOpen || isCustomizeBtnHovered) ? '#18181b' : '#52525b',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              CUSTOMIZE DASHBOARD
            </button>

            {isCustomizeOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  zIndex: 100,
                  minWidth: '240px',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border-color, #e4e4e7)',
                  borderRadius: '10px',
                  boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.14), 0 4px 12px -2px rgba(0, 0, 0, 0.06)',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  animation: 'fadeIn 0.15s ease-out'
                }}
              >
                {[
                  { id: 'heroChart', label: 'Portfolio Performance' },
                  { id: 'performanceMetrics', label: 'Performance Metrics' },
                  { id: 'tradeStatistics', label: 'Trade Statistics' },
                  { id: 'topPerformers', label: 'Top Performers' },
                  { id: 'stockMove', label: 'Stock Move %' }
                ].map(sec => {
                  const isChecked = Boolean(visibleSections[sec.id]);
                  return (
                    <div
                      key={sec.id}
                      onClick={() => setVisibleSections(prev => ({ ...prev, [sec.id]: !prev[sec.id] }))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'background-color 0.12s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f4f4f5)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary, #18181b)' }}>
                        {sec.label}
                      </span>
                      {/* iOS / Radix style toggle switch matching user screenshot */}
                      <div
                        style={{
                          width: '36px',
                          height: '20px',
                          borderRadius: '9999px',
                          backgroundColor: isChecked ? 'var(--text-primary, #18181b)' : 'var(--border-color, #cbd5e1)',
                          position: 'relative',
                          transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          flexShrink: 0
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
                            transform: isChecked ? 'translateX(16px)' : 'translateX(0px)',
                            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MAIN DASHBOARD GRID (NEXUS EXACT 3-COLUMN STRUCTURE) ──────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '32px',
        marginBottom: '48px'
      }}>

        {/* ── 1. PORTFOLIO PERFORMANCE HERO CHART (lg:col-span-3) ──────────── */}
        {visibleSections.heroChart && (
          <div style={{ gridColumn: 'span 3' }}>
            <div style={{
              borderRadius: '16px',
              border: '1px solid var(--border-color, rgba(228, 228, 231, 0.6))',
              backgroundColor: 'var(--bg-card, #ffffff)',
              padding: '24px',
              height: '520px',
              boxSizing: 'border-box',
              position: 'relative'
            }}>
              <div style={{ width: '100%', height: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
                  
                  {/* Centered Chart Title Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    paddingTop: '2px',
                    paddingBottom: '16px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary, #18181b)', letterSpacing: '-0.015em' }}>
                      Portfolio Performance
                    </div>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: headlineReturnPct >= 0 ? '#dcfce7' : '#fee2e2',
                      color: headlineReturnPct >= 0 ? '#15803d' : '#b91c1c',
                      fontSize: '11px',
                      fontWeight: 600,
                      fontFamily: 'monospace'
                    }}>
                      <TrendingUp size={12} strokeWidth={2} />
                      {headlineReturnPct >= 0 ? `+${headlineReturnPct.toFixed(2)}%` : `${headlineReturnPct.toFixed(2)}%`}
                    </span>
                    <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 400 }}>
                      All time
                    </span>
                    {isVsEnabled && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: alphaVsBenchmark >= 0 ? '#dcfce7' : '#fee2e2',
                        color: alphaVsBenchmark >= 0 ? '#15803d' : '#b91c1c',
                        fontSize: '11px',
                        fontWeight: 600,
                        fontFamily: 'monospace'
                      }}>
                        Alpha: {alphaVsBenchmark >= 0 ? `+${alphaVsBenchmark.toFixed(2)}%` : `${alphaVsBenchmark.toFixed(2)}%`}
                      </span>
                    )}
                  </div>

                  {/* Relative Container with absolute Left and Right Controls */}
                  <div style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
                    
                    {/* Left Sub-Controls: VS Switch + %/₹ */}
                    <div style={{
                      position: 'absolute',
                      left: '8px',
                      top: '-20px',
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      {perfTab !== 'Daily' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setIsVsEnabled(!isVsEnabled)}
                            style={{
                              width: '32px',
                              height: '18px',
                              borderRadius: '9999px',
                              backgroundColor: isVsEnabled ? '#18181b' : '#cbd5e1',
                              border: 'none',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s ease'
                            }}
                          >
                            <span style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '50%',
                              backgroundColor: '#ffffff',
                              transform: isVsEnabled ? 'translateX(14px)' : 'translateX(0px)',
                              transition: 'transform 0.2s ease',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.15)'
                            }} />
                          </button>
                          <span style={{ fontSize: '11px', fontWeight: 500, color: '#71717a' }}>VS</span>
                        </>
                      )}
                      
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color, rgba(228, 228, 231, 0.7))',
                        backgroundColor: 'var(--bg-surface, #ffffff)',
                        overflow: 'hidden'
                      }}>
                        <button
                          type="button"
                          onClick={() => setMetricUnit('percent')}
                          style={{
                            padding: '3px 8px',
                            border: 'none',
                            fontSize: '11px',
                            fontWeight: 500,
                            backgroundColor: metricUnit === 'percent' ? 'var(--bg-hover, #f4f4f5)' : 'transparent',
                            color: metricUnit === 'percent' ? 'var(--text-primary, #18181b)' : 'var(--text-muted, #71717a)',
                            cursor: 'pointer'
                          }}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setMetricUnit('rupee')}
                          style={{
                            padding: '3px 8px',
                            borderLeft: '1px solid var(--border-color, rgba(228, 228, 231, 0.7))',
                            borderRight: 'none',
                            borderTop: 'none',
                            borderBottom: 'none',
                            fontSize: '11px',
                            fontWeight: 500,
                            backgroundColor: metricUnit === 'rupee' ? 'var(--bg-hover, #f4f4f5)' : 'transparent',
                            color: metricUnit === 'rupee' ? 'var(--text-primary, #18181b)' : 'var(--text-muted, #71717a)',
                            cursor: 'pointer'
                          }}
                        >
                          ₹
                        </button>
                      </div>

                      {/* Indian Benchmark Selector Pills when VS active */}
                      {isVsEnabled && (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color, rgba(228, 228, 231, 0.7))',
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          overflow: 'hidden'
                        }}>
                          {INDIAN_BENCHMARKS.map((b, idx) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => setSelectedBenchmark(b.id)}
                              style={{
                                padding: '3px 8px',
                                borderLeft: idx > 0 ? '1px solid var(--border-color, rgba(228, 228, 231, 0.7))' : 'none',
                                borderRight: 'none',
                                borderTop: 'none',
                                borderBottom: 'none',
                                fontSize: '10px',
                                fontWeight: 600,
                                backgroundColor: selectedBenchmark === b.id ? 'var(--bg-hover, #f4f4f5)' : 'transparent',
                                color: selectedBenchmark === b.id ? 'var(--text-primary, #18181b)' : 'var(--text-muted, #71717a)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {b.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right Sub-Controls: Growth / Monthly / Equity / Daily */}
                    <div style={{
                      position: 'absolute',
                      right: '8px',
                      top: '-20px',
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end'
                    }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color, rgba(228, 228, 231, 0.7))',
                        backgroundColor: 'var(--bg-surface, #ffffff)',
                        padding: '1px',
                        gap: '1px'
                      }}>
                        {['Growth', 'Monthly', 'Equity', 'Daily'].map(tab => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setPerfTab(tab)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              border: 'none',
                              fontSize: '10px',
                              fontWeight: perfTab === tab ? 500 : 400,
                              letterSpacing: '-0.01em',
                              backgroundColor: perfTab === tab ? 'var(--bg-hover, #f4f4f5)' : 'transparent',
                              color: perfTab === tab ? 'var(--text-primary, #18181b)' : 'var(--text-muted, #71717a)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Chart Container */}
                    <div style={{ width: '100%', height: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        {perfTab === 'Monthly' ? (
                          <BarChart data={monthlyData} margin={{ top: 28, right: 30, left: 30, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                              dataKey="month"
                              axisLine={false}
                              tickLine={false}
                              dy={10}
                              interval={0}
                              tick={{ fontSize: 11, fill: '#71717a' }}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              fontSize={12}
                              stroke="#71717a"
                              tickFormatter={t => metricUnit === 'rupee' ? `₹${Math.round(t).toLocaleString('en-IN')}` : `${Number(t).toFixed(0)}%`}
                              width={metricUnit === 'rupee' ? 65 : 45}
                            />
                            <Tooltip
                              cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                              content={props => <CustomNexusHeroTooltip {...props} metricUnit={metricUnit} perfTab="Monthly" baseCapital={baseCapital} />}
                            />
                            <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />
                            <Bar
                              dataKey={metricUnit === 'rupee' ? 'pl' : 'plPercentage'}
                              name={metricUnit === 'rupee' ? 'Monthly P&L (₹)' : (pnlMode === 'gross' ? 'Gross PF Returns' : 'Net PF Returns')}
                              radius={[4, 4, 0, 0]}
                              maxBarSize={50}
                              isAnimationActive={true}
                              animationDuration={800}
                              animationEasing="ease-out"
                            >
                              {(monthlyData || []).map((entry, index) => {
                                const val = metricUnit === 'rupee' ? (entry.pl || 0) : (entry.plPercentage || 0);
                                return (
                                  <Cell key={`cell-${index}`} fill={val >= 0 ? '#10b981' : '#ef4444'} />
                                );
                              })}
                            </Bar>
                          </BarChart>
                        ) : perfTab === 'Daily' ? (
                          <AreaChart data={dailyData} margin={{ top: 28, right: 30, left: 30, bottom: 30 }}>
                            <defs>
                              <linearGradient id="colorDaily" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                              dataKey="date"
                              axisLine={false}
                              tickLine={false}
                              dy={10}
                              tick={{ fontSize: 10, fill: '#71717a' }}
                              interval="preserveStartEnd"
                              minTickGap={20}
                            />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              scale="linear"
                              domain={heroHasTrades ? [
                                dataMin => (dataMin < 0 ? Math.floor(dataMin * 1.08) : (metricUnit === 'percent' ? Math.min(0, dataMin) : Math.floor(dataMin * 0.98))),
                                dataMax => (dataMax > 0 ? Math.ceil(dataMax * 1.08) : (metricUnit === 'percent' ? Math.max(0, dataMax) : Math.ceil(dataMax * 1.02)))
                              ] : (metricUnit === 'percent' ? [0, 2.5] : [0, baseCapital > 0 ? baseCapital * 1.1 : 100000])}
                              ticks={!heroHasTrades && metricUnit === 'percent' ? [0, 0.5, 1.0, 1.5, 2.0, 2.5] : undefined}
                              tickFormatter={e => metricUnit === 'percent' ? `${Number(e).toFixed(2)}%` : formatINR(e, false)}
                              stroke="#71717a"
                              fontSize={12}
                              axisLine={false}
                              tickLine={false}
                              width={70}
                            />
                            <ReferenceLine yAxisId="right" y={0} stroke="#e5e7eb" strokeWidth={1} />
                            <Tooltip cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '3 3' }} content={props => <CustomNexusHeroTooltip {...props} metricUnit={metricUnit} perfTab="Daily" baseCapital={baseCapital} />} />
                            <Legend wrapperStyle={{ textAlign: 'center' }} />
                            <Area
                              yAxisId="right"
                              type="monotone"
                              dataKey={metricUnit === 'percent' ? 'cummPf' : 'capital'}
                              name={metricUnit === 'percent' ? 'Daily Equity' : 'Account Balance'}
                              stroke="#3b82f6"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#colorDaily)"
                              dot={false}
                              activeDot={{ r: 4, stroke: '#3b82f6', strokeWidth: 2, fill: '#ffffff' }}
                              isAnimationActive={true}
                              animationDuration={800}
                              animationEasing="ease-out"
                            />
                          </AreaChart>
                        ) : perfTab === 'Equity' ? (
                          <LineChart data={monthlyData} margin={{ top: 28, right: 30, left: 30, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                              dataKey="month"
                              axisLine={false}
                              tickLine={false}
                              dy={10}
                              interval={0}
                              tick={{ fontSize: 11, fill: '#71717a' }}
                            />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              scale="linear"
                              domain={heroHasTrades ? ['auto', 'auto'] : (metricUnit === 'rupee' ? [0, baseCapital > 0 ? baseCapital * 1.1 : 100000] : [0, 2.5])}
                              ticks={heroHasTrades ? undefined : (metricUnit === 'rupee' ? undefined : [0, 0.5, 1.0, 1.5, 2.0, 2.5])}
                              tickFormatter={t => metricUnit === 'rupee' ? formatINR(t, false) : `${Number(t).toFixed(2)}%`}
                              stroke="#71717a"
                              fontSize={12}
                              axisLine={false}
                              tickLine={false}
                              width={metricUnit === 'rupee' ? 75 : 65}
                            />
                            <ReferenceLine yAxisId="right" y={metricUnit === 'rupee' ? (baseCapital || 0) : 0} stroke="#e5e7eb" strokeWidth={1} />
                            <Tooltip cursor={{ stroke: '#60a5fa', strokeWidth: 1, strokeDasharray: '3 3' }} content={props => <CustomNexusHeroTooltip {...props} metricUnit={metricUnit} perfTab="Equity" baseCapital={baseCapital} />} />
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey={metricUnit === 'rupee' ? 'capital' : 'cummPf'}
                              name={metricUnit === 'rupee' ? 'Account Capital' : 'Equity Curve'}
                              stroke="#60a5fa"
                              strokeWidth={3}
                              dot={false}
                              activeDot={{ r: 5, stroke: '#60a5fa', strokeWidth: 2, fill: '#ffffff' }}
                              isAnimationActive={true}
                              animationDuration={800}
                              animationEasing="ease-out"
                            />
                          </LineChart>
                        ) : (
                          /* Growth Tab (Nexus Hero Area Chart) */
                          <ComposedChart data={monthlyData} margin={{ top: 28, right: 30, left: 30, bottom: 30 }}>
                            <defs>
                              <linearGradient id="colorPL" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#86efac" stopOpacity={0.35} />
                                <stop offset="95%" stopColor="#86efac" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorPLRs" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                              dataKey="month"
                              axisLine={false}
                              tickLine={false}
                              dy={10}
                              interval={0}
                              tick={{ fontSize: 11, fill: '#71717a' }}
                            />
                            <YAxis
                              yAxisId="growth"
                              orientation={metricUnit === 'rupee' ? 'left' : 'right'}
                              scale="linear"
                              domain={growthYAxisConfig.domain}
                              ticks={growthYAxisConfig.ticks}
                              tickFormatter={growthYAxisConfig.tickFormatter}
                              axisLine={false}
                              tickLine={false}
                              dx={metricUnit === 'rupee' ? -10 : 0}
                              width={80}
                              stroke="#71717a"
                              tick={{ fontSize: 12 }}
                            />
                            {isVsEnabled && (
                              <YAxis
                                yAxisId="bench"
                                orientation={metricUnit === 'rupee' ? 'right' : 'left'}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#ef4444', fontSize: 11 }}
                                tickFormatter={t => t.toLocaleString('en-IN')}
                                width={55}
                              />
                            )}
                            <Tooltip
                              cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
                              content={props => <CustomNexusHeroTooltip {...props} metricUnit={metricUnit} perfTab="Growth" baseCapital={baseCapital} />}
                            />
                            {metricUnit === 'rupee' ? (
                              <Area
                                yAxisId="growth"
                                type="monotone"
                                dataKey="pl"
                                name="Monthly P&L (₹)"
                                stroke="#2563eb"
                                fillOpacity={1}
                                fill="url(#colorPLRs)"
                                strokeWidth={2}
                                activeDot={{ r: 4, stroke: '#2563eb', strokeWidth: 2, fill: '#ffffff' }}
                                isAnimationActive={true}
                                animationDuration={800}
                                animationEasing="ease-out"
                              />
                            ) : (
                              <Area
                                yAxisId="growth"
                                type="monotone"
                                dataKey="plPercentage"
                                name="P&L Percentage"
                                stroke="#16a34a"
                                fillOpacity={1}
                                fill="url(#colorPL)"
                                strokeWidth={2}
                                activeDot={{ r: 4, stroke: '#16a34a', strokeWidth: 2, fill: '#ffffff' }}
                                isAnimationActive={true}
                                animationDuration={800}
                                animationEasing="ease-out"
                              />
                            )}
                            {isVsEnabled && (
                              <Line
                                yAxisId="bench"
                                type="monotone"
                                dataKey="benchmarkVal"
                                name={selectedBenchmark}
                                stroke="#ef4444"
                                strokeWidth={1.8}
                                strokeDasharray="4 4"
                                dot={false}
                                isAnimationActive={true}
                                animationDuration={800}
                              />
                            )}
                          </ComposedChart>
                        )}
                      </ResponsiveContainer>
                    </div>

                  </div>

                  {/* Chart Bottom Legend (Dynamic matching Nexus active tab) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '24px',
                    fontSize: '11px',
                    color: '#71717a',
                    fontWeight: 450
                  }}>
                    {perfTab === 'Monthly' || perfTab === 'Daily' ? null : perfTab === 'Equity' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60a5fa', fontWeight: 500, fontSize: '11px' }}>
                        <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
                          <line x1="0" y1="5" x2="20" y2="5" stroke="#60a5fa" strokeWidth="2" />
                          <circle cx="10" cy="5" r="2.5" fill="#ffffff" stroke="#60a5fa" strokeWidth="1.5" />
                        </svg>
                        <span>Equity Curve</span>
                      </div>
                    ) : (
                      <>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: metricUnit === 'rupee' ? '#2563eb' : '#16a34a',
                          fontWeight: 500
                        }}>
                          <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
                            <line x1="0" y1="5" x2="20" y2="5" stroke={metricUnit === 'rupee' ? '#2563eb' : '#16a34a'} strokeWidth="2" />
                            <circle cx="10" cy="5" r="2.5" fill="#ffffff" stroke={metricUnit === 'rupee' ? '#2563eb' : '#16a34a'} strokeWidth="1.5" />
                          </svg>
                          <span>{metricUnit === 'rupee' ? 'Monthly P&L (₹)' : 'P&L Percentage'}</span>
                        </div>
                        {isVsEnabled && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: 500 }}>
                            <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
                              <line x1="0" y1="5" x2="20" y2="5" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />
                              <circle cx="10" cy="5" r="2.5" fill="#ffffff" stroke="#ef4444" strokeWidth="1.5" />
                            </svg>
                            <span>{selectedBenchmark}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. COLUMN 1: PERFORMANCE METRICS ──────────────────────────────── */}
        {visibleSections.performanceMetrics && (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary, #18181b)', letterSpacing: '-0.015em', margin: '0 0 12px 0' }}>
              Performance Metrics
            </h2>
            <div style={{
              borderRadius: '16px',
              border: '1px solid var(--border-color, #e5e7eb)',
              backgroundColor: 'var(--bg-card, #ffffff)',
              padding: '28px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px 24px' }}>
                
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Total Trades
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 300, color: 'var(--text-primary, #18181b)', marginTop: '2px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {metrics.totalTrades}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Win Rate
                  </div>
                  <div style={{
                    fontSize: '26px',
                    fontWeight: 300,
                    color: metrics.winRateRaw >= 50 ? '#10b981' : '#ef4444',
                    marginTop: '2px',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}>
                    {metrics.winRate}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Avg + Move
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 300, color: '#10b981', marginTop: '2px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {metrics.avgWinMove}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Avg - Move
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 300, color: '#ef4444', marginTop: '2px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {metrics.avgLossMove}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Avg Position Size
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 300, color: 'var(--text-primary, #18181b)', marginTop: '2px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {metrics.avgPositionSize}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Avg Holding Days
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 300, color: 'var(--text-primary, #18181b)', marginTop: '2px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {metrics.avgHoldingDays}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Plan Followed
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 300, color: '#10b981', marginTop: '2px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {metrics.planFollowed}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Avg R
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 300, color: 'var(--text-primary, #18181b)', marginTop: '2px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {metrics.avgR}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Open Positions
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 300, color: 'var(--text-primary, #18181b)', marginTop: '2px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {metrics.openPositions}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Cash
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 300, color: 'var(--text-primary, #18181b)', marginTop: '2px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {metrics.cash}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ── 3. COLUMN 2: TRADE STATISTICS ─────────────────────────────────── */}
        {visibleSections.tradeStatistics && (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary, #18181b)', letterSpacing: '-0.015em', margin: '0 0 12px 0' }}>
              Trade Statistics
            </h2>
            <div style={{
              borderRadius: '16px',
              border: '1px solid var(--border-color, #e5e7eb)',
              backgroundColor: 'var(--bg-card, #ffffff)',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              {[
                { label: 'Win %', value: metrics.winRate, desc: 'Percentage of profitable closed trades' },
                { label: 'Avg Gain', value: metrics.avgGain, desc: 'Average percentage gain on winning trades', color: '#10b981' },
                { label: 'Avg Loss', value: metrics.avgLoss, desc: 'Average percentage loss on losing trades', color: '#ef4444' },
                { label: 'Avg Position Size', value: metrics.avgPositionSize, desc: 'Average position size as percentage of portfolio' },
                { label: 'Avg Holding Days', value: metrics.avgHoldingDays, desc: 'Average number of days positions are held' },
                { label: 'Avg R:R', value: metrics.avgR, desc: 'Average reward-to-risk ratio across trades' },
                { label: 'Profit Factor', value: metrics.profitFactor, desc: 'Gross profit divided by gross loss' },
                { label: 'Expectancy', value: metrics.expectancy, desc: 'Mathematical rupee expectation per executed trade', color: '#10b981' },
              ].map((row, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderBottom: idx < 7 ? '1px solid var(--border-color, #f4f4f5)' : 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {row.label}
                    </span>
                    <span title={row.desc} style={{ display: 'inline-flex', color: 'var(--text-muted, #a1a1aa)', cursor: 'help' }}>
                      <Info size={12} />
                    </span>
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    color: row.color || 'var(--text-primary, #18181b)'
                  }}>
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. COLUMN 3: TOP PERFORMERS ──────────────────────────────────── */}
        {visibleSections.topPerformers && (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary, #18181b)', letterSpacing: '-0.015em', margin: '0 0 12px 0' }}>
              Top Performers
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Combobox Dropdown on Top Right */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setIsPerformerDropdownOpen(!isPerformerDropdownOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color, #e4e4e7)',
                    backgroundColor: 'var(--bg-surface, #ffffff)',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-primary, #18181b)',
                    cursor: 'pointer',
                    width: '140px'
                  }}
                >
                  <span>{performerMetric}</span>
                  <ChevronDown size={14} color="var(--text-muted, #71717a)" />
                </button>

                {isPerformerDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '36px',
                    zIndex: 30,
                    width: '140px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #e4e4e7)',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    padding: '4px'
                  }}>
                    {['R:R', 'Stock Move %', 'P&L (₹)'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setPerformerMetric(opt);
                          setIsPerformerDropdownOpen(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '6px 10px',
                          fontSize: '12px',
                          fontWeight: performerMetric === opt ? 600 : 500,
                          borderRadius: '4px',
                          border: 'none',
                          backgroundColor: performerMetric === opt ? 'var(--bg-hover, #f4f4f5)' : 'transparent',
                          color: performerMetric === opt ? 'var(--text-primary, #18181b)' : 'var(--text-muted, #71717a)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span>{opt}</span>
                        {performerMetric === opt && <Check size={12} color="var(--text-primary, #18181b)" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Cards Container */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Highest Performer Card */}
                {highestTrade && (
                  <div style={{
                    borderRadius: '12px',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    padding: '16px',
                    transition: 'all 0.15s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Highest {performerMetric}
                      </span>
                      <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'monospace', color: '#16a34a' }}>
                        {performerMetric === 'R:R'
                          ? `+${highestTrade.rewardRisk}R`
                          : performerMetric === 'Stock Move %'
                          ? `+${Math.abs(highestTrade.stockMove || 0)}%`
                          : formatINR(highestTrade.activePnl)}
                      </div>
                    </div>
                    <div style={{ height: '1px', backgroundColor: 'var(--border-color, #f4f4f5)', marginBottom: '12px' }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={14} color="#16a34a" />
                        <SymbolLogo symbol={highestTrade.name || highestTrade.symbol} size={20} />
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary, #18181b)', textTransform: 'uppercase' }}>
                          {highestTrade.name || highestTrade.symbol}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted, #71717a)' }}>
                        <Calendar size={12} />
                        <span>{highestTrade.date}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lowest Performer Card */}
                {lowestTrade && (
                  <div style={{
                    borderRadius: '12px',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    padding: '16px',
                    transition: 'all 0.15s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Lowest {performerMetric}
                      </span>
                      <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'monospace', color: '#dc2626' }}>
                        {performerMetric === 'R:R'
                          ? `${lowestTrade.rewardRisk}R`
                          : performerMetric === 'Stock Move %'
                          ? `-${Math.abs(lowestTrade.stockMove || 0)}%`
                          : formatINR(lowestTrade.activePnl)}
                      </div>
                    </div>
                    <div style={{ height: '1px', backgroundColor: 'var(--border-color, #f4f4f5)', marginBottom: '12px' }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingDown size={14} color="#dc2626" />
                        <SymbolLogo symbol={lowestTrade.name || lowestTrade.symbol} size={20} />
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary, #18181b)', textTransform: 'uppercase' }}>
                          {lowestTrade.name || lowestTrade.symbol}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted, #71717a)' }}>
                        <Calendar size={12} />
                        <span>{lowestTrade.date}</span>
                      </div>
                    </div>
                  </div>
                )}

                {!highestTrade && !lowestTrade && (
                  <div style={{
                    borderRadius: '12px',
                    border: '1px dashed var(--border-color, #e5e7eb)',
                    backgroundColor: 'var(--bg-card, #fafafa)',
                    padding: '36px 16px',
                    textAlign: 'center',
                    color: 'var(--text-muted, #a1a1aa)',
                    fontSize: '12px'
                  }}>
                    No closed trades found in this portfolio to determine top performers.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 5. FULL WIDTH CARD: STOCK MOVE % (NEXUS EXACT ROW 3) ──────────── */}
        {visibleSections.stockMove && (
          <div style={{ gridColumn: 'span 3' }}>
            <div style={{
              borderRadius: '16px',
              border: '1px solid var(--border-color, #e5e7eb)',
              backgroundColor: 'var(--bg-card, #ffffff)',
              padding: '4px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              boxSizing: 'border-box',
              width: '100%',
              height: '592px'
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '584px',
                padding: '20px',
                gap: '16px',
                boxSizing: 'border-box'
              }}>
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      fontStyle: 'italic',
                      color: 'var(--text-primary, rgba(24, 24, 27, 0.8))',
                      letterSpacing: '-0.025em'
                    }}>
                      {stockMoveMetric === 'Move' ? 'Stock Move %' : 'R-Multiple'}
                    </div>
                    {stockMoveHasTrades && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        backgroundColor: avgStockMovement >= 0 ? '#ecfdf5' : '#fef2f2',
                        border: `1px solid ${avgStockMovement >= 0 ? '#a7f3d0' : '#fecaca'}`,
                        fontSize: '11px',
                        fontWeight: 600,
                        color: avgStockMovement >= 0 ? '#10b981' : '#ef4444'
                      }}>
                        Avg: {avgStockMovement >= 0 ? '+' : ''}{avgStockMovement}{stockMoveMetric === 'Move' ? '%' : 'R'}
                      </div>
                    )}
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color, #e5e7eb)',
                      backgroundColor: 'var(--bg-surface, #ffffff)',
                      fontSize: '9px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '-0.05em',
                      overflow: 'hidden'
                    }}>
                      <button
                        type="button"
                        onClick={() => setStockMoveMetric('Move')}
                        style={{
                          padding: '3px 7px',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          backgroundColor: stockMoveMetric === 'Move' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                          color: stockMoveMetric === 'Move' ? '#2563eb' : 'var(--text-muted, #71717a)'
                        }}
                      >
                        Move
                      </button>
                      <button
                        type="button"
                        onClick={() => setStockMoveMetric('R-MULT')}
                        style={{
                          padding: '3px 7px',
                          borderLeft: '1px solid var(--border-color, #e5e7eb)',
                          borderRight: 'none',
                          borderTop: 'none',
                          borderBottom: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          backgroundColor: stockMoveMetric === 'R-MULT' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                          color: stockMoveMetric === 'R-MULT' ? '#2563eb' : 'var(--text-muted, #71717a)'
                        }}
                      >
                        R-MULT
                      </button>
                    </div>
                  </div>

                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    backgroundColor: 'var(--bg-surface, #ffffff)',
                    fontSize: '9px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '-0.05em',
                    overflow: 'hidden'
                  }}>
                    {['Daily', 'Weekly', 'Monthly'].map((inter, idx) => (
                      <button
                        key={inter}
                        type="button"
                        onClick={() => setStockMoveInterval(inter)}
                        style={{
                          padding: '3px 7px',
                          border: 'none',
                          borderLeft: idx > 0 ? '1px solid var(--border-color, #e5e7eb)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          backgroundColor: stockMoveInterval === inter ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                          color: stockMoveInterval === inter ? '#2563eb' : 'var(--text-muted, #71717a)'
                        }}
                      >
                        {inter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recharts ComposedChart */}
                <div style={{ flex: 1, width: '100%', minHeight: 0, position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stockMoveSeries} margin={{ top: 15, right: 25, left: 10, bottom: 25 }}>
                      <defs>
                        <linearGradient id="chartGradientStockMove" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="displayDate"
                        axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                        tickLine={{ stroke: '#e5e7eb' }}
                        dy={8}
                        tick={{ fontSize: 11, fill: '#71717a' }}
                      />
                      <YAxis
                        yAxisId="left"
                        axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                        tickLine={{ stroke: '#e5e7eb' }}
                        dx={-5}
                        width={55}
                        tick={{ fontSize: 11, fill: '#71717a' }}
                        domain={stockMoveHasTrades ? [
                          dataMin => Math.min(0, Math.floor(dataMin - 0.5)),
                          dataMax => Math.max(0, Math.ceil(dataMax + 0.5))
                        ] : (stockMoveMetric === 'Move' ? [-2, 10] : [-0.5, 2.5])}
                        ticks={stockMoveHasTrades ? undefined : (stockMoveMetric === 'Move' ? [-2, 0, 2, 4, 6, 8, 10] : [-0.5, 0, 0.5, 1.0, 1.5, 2.0, 2.5])}
                        tickFormatter={val => stockMoveMetric === 'Move' ? `${val >= 0 ? '+' : ''}${Number(val).toFixed(2)}%` : `${val >= 0 ? '+' : ''}${Number(val).toFixed(2)}R`}
                      />
                      <ReferenceLine yAxisId="left" y={0} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
                      <Tooltip
                        wrapperStyle={{ pointerEvents: 'auto', zIndex: 100 }}
                        content={<CustomStockMoveTooltip metricMode={stockMoveMetric === 'Move' ? 'stockMove' : 'rMultiple'} />}
                      />
                      <Legend
                        verticalAlign="bottom"
                        align="center"
                        wrapperStyle={{ fontSize: '11px', fontWeight: 500, paddingTop: '10px' }}
                        iconSize={9}
                      />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey={stockMoveMetric === 'Move' ? 'avgStockMove' : 'avgRMultiple'}
                        name={stockMoveMetric === 'Move' ? 'Average Stock Movement' : 'Average R-Multiple'}
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#chartGradientStockMove)"
                        strokeWidth={2.2}
                        activeDot={stockMoveHasTrades ? { r: 4 } : false}
                        dot={stockMoveHasTrades ? { r: 3, fillOpacity: 1, strokeWidth: 0, fill: '#3b82f6' } : false}
                        isAnimationActive={true}
                        animationDuration={1000}
                        animationEasing="ease-out"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>



    </main>
  );
}

function CustomNexusTooltip({ active, payload, unit = '%' }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '12px',
        padding: '12px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        fontSize: '12px',
        minWidth: '170px'
      }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary, #18181b)', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid var(--border-color, #f4f4f5)' }}>
          {data.fullDate || data.date || data.month}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', color: 'var(--text-secondary, #71717a)', marginBottom: '4px' }}>
          <span>Return:</span>
          <span style={{ fontWeight: 700, fontFamily: 'monospace', color: (data.pct || data.pnl || 0) >= 0 ? '#10b981' : '#ef4444' }}>
            {(data.pct || data.pnl || 0) >= 0 ? '+' : ''}{data.pct !== undefined ? data.pct : data.pnl}{unit}
          </span>
        </div>
        {data.val !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', color: 'var(--text-secondary, #71717a)' }}>
            <span>Capital:</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary, #18181b)', fontFamily: 'monospace' }}>
              ₹{Math.round(data.val).toLocaleString('en-IN')}
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
}

function CustomNexusMonthlyTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const val = data.plPercentage !== undefined ? data.plPercentage : (data.pct || 0);
    const isPos = val >= 0;
    return (
      <div style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '8px',
        padding: '8px 12px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
        fontSize: '12px'
      }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary, #18181b)', marginBottom: '4px' }}>
          {data.month || data.date}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
          <span style={{ color: 'var(--text-secondary, #71717a)' }}>Return:</span>
          <span style={{ fontWeight: 700, color: isPos ? '#3b82f6' : '#ef4444', fontFamily: 'monospace' }}>
            {isPos ? '+' : ''}{val}%
          </span>
        </div>
        {data.pnl !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', marginTop: '2px' }}>
            <span style={{ color: 'var(--text-secondary, #71717a)' }}>P&L:</span>
            <span style={{ fontWeight: 700, color: isPos ? '#16a34a' : '#ef4444', fontFamily: 'monospace' }}>
              {formatINR(data.pnl)}
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
}

function CustomStockMoveTooltip({ active, payload, label, metricMode = 'stockMove' }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const trades = data.allTrades || [];
    const formatVal = val => metricMode === 'stockMove'
      ? `${Number(val) >= 0 ? '+' : ''}${Number(val).toFixed(2)}%`
      : `${Number(val) >= 0 ? '+' : ''}${Number(val).toFixed(2)}R`;

    return (
      <div style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        width: '240px',
        maxWidth: '250px',
        zIndex: 100,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary, #18181b)', fontSize: '13px', marginBottom: '8px' }}>
          {label || data.displayDate}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-secondary, #71717a)' }}>{metricMode === 'stockMove' ? 'Avg Move:' : 'Avg R:'}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary, #18181b)' }}>
              {formatVal(metricMode === 'stockMove' ? data.avgStockMove : data.avgRMultiple)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-secondary, #71717a)' }}>Trade Count:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary, #18181b)' }}>
              {data.tradeCount} trade{data.tradeCount === 1 ? '' : 's'}
            </span>
          </div>

          {trades.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-color, #e5e7eb)', marginTop: '6px', paddingTop: '6px' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary, #18181b)', fontSize: '11px', marginBottom: '6px' }}>
                All Stocks:
              </div>
              <div style={{
                maxHeight: '130px',
                overflowY: 'auto',
                paddingRight: '4px',
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--border-color, #e5e7eb) transparent'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {trades.map((t, idx) => {
                    const val = metricMode === 'stockMove' ? t.stockMove : t.rewardRisk;
                    return (
                      <div
                        key={t.id || `${t.symbol}-${idx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '11px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary, #71717a)', minWidth: 0, overflow: 'hidden' }}>
                          <span style={{ fontSize: '10px', minWidth: '14px' }}>{idx + 1}.</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                            <img
                              src={`https://images.dhan.co/symbol/${t.symbol}.png`}
                              alt={t.symbol}
                              style={{ width: '14px', height: '14px', borderRadius: '2px', objectFit: 'contain', flexShrink: 0 }}
                              onError={e => { e.target.onerror = null; e.target.src = 'https://s3-symbol-logo.tradingview.com/country/IN.svg'; }}
                            />
                            <span style={{ fontWeight: 600, color: 'var(--text-primary, #18181b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {t.symbol}
                            </span>
                          </div>
                        </div>
                        <span style={{ fontWeight: 600, flexShrink: 0, color: val >= 0 ? '#16a34a' : '#dc2626' }}>
                          {formatVal(val)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}
