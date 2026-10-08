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
  Check,
  Sparkles
} from 'lucide-react';
import SymbolLogo from '../SymbolLogo';
import { getCapital } from '../../utils/fundManagementCalculations';
import { computeClosedMetrics, computePartialSummary, getR, isClosedTrade, isPartialTrade, getTradePnl } from '../../utils/tradeMetricsShared';

// ── Indian Benchmark Historical Proxies (FY 2026-2027) ───────────────────────
const INDIAN_BENCHMARKS = [
  {
    id: 'NIFTY',
    symbol: 'NIFTY',
    name: 'NIFTY 50',
    color: '#ef4444',
    monthlyData: {
      '2026-04': { indexValue: 24196.75, indexPercentage: 6.69, indexMonthlyReturn: 5.66 },
      '2026-05': { indexValue: 23643.50, indexPercentage: 4.25, indexMonthlyReturn: -3.05 },
      '2026-06': { indexValue: 23989.15, indexPercentage: 5.78, indexMonthlyReturn: 2.22 },
      '2026-07': { indexValue: 24072.75, indexPercentage: 6.14, indexMonthlyReturn: 0.86 },
      '2026-08': { indexValue: 24287.65, indexPercentage: 7.09, indexMonthlyReturn: -2.80 }
    }
  },
  {
    id: 'BANKNIFTY',
    symbol: 'BANKNIFTY',
    name: 'BANK NIFTY',
    color: '#10b981',
    monthlyData: {
      '2026-04': { indexValue: 56086.40, indexPercentage: 9.01, indexMonthlyReturn: 6.43 },
      '2026-05': { indexValue: 53710.35, indexPercentage: 4.40, indexMonthlyReturn: -2.25 },
      '2026-06': { indexValue: 57297.15, indexPercentage: 11.37, indexMonthlyReturn: 8.04 },
      '2026-07': { indexValue: 57582.25, indexPercentage: 11.92, indexMonthlyReturn: -1.32 },
      '2026-08': { indexValue: 57497.80, indexPercentage: 11.76, indexMonthlyReturn: -0.38 }
    }
  },
  {
    id: 'NIFMSC400',
    symbol: 'NIFMSC400',
    name: 'NIFTY MIDSMALLCAP 400',
    color: '#8b5cf6',
    monthlyData: {
      '2026-04': { indexValue: 19717.35, indexPercentage: 9.69, indexMonthlyReturn: 11.93 },
      '2026-05': { indexValue: 20217.55, indexPercentage: 12.47, indexMonthlyReturn: 0.25 },
      '2026-06': { indexValue: 20728.75, indexPercentage: 15.32, indexMonthlyReturn: 3.24 },
      '2026-07': { indexValue: 21262.80, indexPercentage: 18.29, indexMonthlyReturn: 0.46 },
      '2026-08': { indexValue: 21584.00, indexPercentage: 20.07, indexMonthlyReturn: 0.72 }
    }
  },
  {
    id: 'CNXSCAP',
    symbol: 'CNXSCAP',
    name: 'NIFTY SMALLCAP 100',
    color: '#f59e0b',
    monthlyData: {
      '2026-04': { indexValue: 17308.85, indexPercentage: 10.18, indexMonthlyReturn: 15.06 },
      '2026-05': { indexValue: 17882.60, indexPercentage: 13.83, indexMonthlyReturn: -0.84 },
      '2026-06': { indexValue: 18477.75, indexPercentage: 17.62, indexMonthlyReturn: 4.87 },
      '2026-07': { indexValue: 19336.25, indexPercentage: 23.08, indexMonthlyReturn: 0.90 },
      '2026-08': { indexValue: 19809.25, indexPercentage: 26.09, indexMonthlyReturn: 1.75 }
    }
  },
  {
    id: 'CNX500',
    symbol: 'CNX500',
    name: 'NIFTY 500',
    color: '#3b82f6',
    monthlyData: {
      '2026-04': { indexValue: 22656.30, indexPercentage: 8.22, indexMonthlyReturn: 8.33 },
      '2026-05': { indexValue: 22531.15, indexPercentage: 7.62, indexMonthlyReturn: -1.72 },
      '2026-06': { indexValue: 22997.25, indexPercentage: 9.85, indexMonthlyReturn: 2.62 },
      '2026-07': { indexValue: 23232.65, indexPercentage: 10.97, indexMonthlyReturn: 0.84 },
      '2026-08': { indexValue: 23564.45, indexPercentage: 12.56, indexMonthlyReturn: -1.48 }
    }
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
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
  }
  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);
  if (dmyMatch) {
    return new Date(parseInt(dmyMatch[3], 10), parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

function formatDateDMY(dStr) {
  const d = parseTradeDate(dStr);
  if (!d) return String(dStr || '');
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function getClosedWeightedHoldingDays(t, costBasis = 'lifo') {
  const entries = [];
  if (Number(t.entry || t.avgEntry || 0) > 0 && Number(t.initialQty || t.qty || 0) > 0) {
    entries.push({ price: Number(t.entry || t.avgEntry), qty: Number(t.initialQty || t.qty), date: t.date });
  }
  if (Number(t.p1Price || 0) > 0 && Number(t.p1Qty || 0) > 0) {
    entries.push({ price: Number(t.p1Price), qty: Number(t.p1Qty), date: t.p1Date || t.date });
  }
  if (Number(t.p2Price || 0) > 0 && Number(t.p2Qty || 0) > 0) {
    entries.push({ price: Number(t.p2Price), qty: Number(t.p2Qty), date: t.p2Date || t.date });
  }

  const exits = [];
  if (Number(t.e1Price || 0) > 0 && Number(t.e1Qty || 0) > 0) {
    exits.push({ price: Number(t.e1Price), qty: Number(t.e1Qty), date: t.e1Date || t.exitDate || t.date });
  }
  if (Number(t.e2Price || 0) > 0 && Number(t.e2Qty || 0) > 0) {
    exits.push({ price: Number(t.e2Price), qty: Number(t.e2Qty), date: t.e2Date || t.exitDate || t.date });
  }
  if (Number(t.e3Price || 0) > 0 && Number(t.e3Qty || 0) > 0) {
    exits.push({ price: Number(t.e3Price), qty: Number(t.e3Qty), date: t.e3Date || t.exitDate || t.date });
  }

  if (exits.length === 0) {
    const st = String(t.positionStatus || t.status || '').toLowerCase();
    if (st === 'closed') {
      return Number(t.holdingDays || 0);
    }
    return 0;
  }

  const msPerDay = 864e5;
  const remEntries = entries.map(e => ({ ...e, rem: e.qty, ms: parseTradeDate(e.date)?.getTime() || 0 }));
  const remExits = exits.map(x => ({ ...x, rem: x.qty, ms: parseTradeDate(x.date)?.getTime() || 0 }));
  let totalExited = 0;
  let totalWeightedDays = 0;

  for (const ex of remExits) {
    while (ex.rem > 0) {
      let candIdx = -1;
      if (costBasis === 'fifo') {
        candIdx = remEntries.findIndex(e => e.rem > 0);
      } else {
        for (let i = remEntries.length - 1; i >= 0; i--) {
          if (remEntries[i].rem > 0) { candIdx = i; break; }
        }
      }
      if (candIdx === -1) break;
      const en = remEntries[candIdx];
      const matchQty = Math.min(en.rem, ex.rem);
      const days = Math.max(0, Math.floor((ex.ms - en.ms) / msPerDay));
      totalWeightedDays += days * matchQty;
      totalExited += matchQty;
      en.rem -= matchQty;
      ex.rem -= matchQty;
    }
  }

  return totalExited > 0 ? Math.round(totalWeightedDays / totalExited) : 0;
}

function formatExactINR(val) {
  const n = Math.round(Number(val) || 0);
  const sign = n < 0 ? '-₹' : '₹';
  return sign + Math.abs(n).toLocaleString('en-IN');
}

function CustomFoxHeroTooltip({ active, payload, label, metricUnit = 'percent', perfTab = 'Growth', baseCapital = 0, isVsEnabled = false, activeBenchmark = null }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload || {};

  const displayTitle = d.month || d.displayDate || d.date || label || 'Period';
  const pct = Number(d.plPercentage !== undefined ? d.plPercentage : (d.pct !== undefined ? d.pct : (d.cummPf || 0)));
  const plVal = Number(d.pl !== undefined ? d.pl : (d.pnl !== undefined ? d.pnl : 0));
  const startingCap = Number(d.startingCapital || baseCapital || 0);
  const movers = d.topMoversByImpact || [];
  const benchName = activeBenchmark?.name || 'Benchmark';

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

      {/* Metrics Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
        {isVsEnabled && perfTab === 'Growth' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: 'var(--text-muted, #71717a)' }}>Portfolio Capital:</span>
              <span style={{ fontWeight: 500, color: '#2563eb' }}>
                {formatExactINR(d.capital)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: 'var(--text-muted, #71717a)' }}>{benchName}:</span>
              <span style={{ fontWeight: 500, color: activeBenchmark?.color || '#ef4444' }}>
                {Number(d.indexValue || d.benchmarkVal || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: 'var(--text-muted, #71717a)' }}>Monthly P&L:</span>
              <span style={{ fontWeight: 500, color: 'var(--text-primary, #18181b)' }}>
                {formatExactINR(plVal)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: 'var(--text-muted, #71717a)' }}>P&L Percentage:</span>
              <span style={{ fontWeight: 500, color: 'var(--text-primary, #18181b)' }}>
                {pct.toFixed(2)}%
              </span>
            </div>
          </>
        ) : isVsEnabled && perfTab === 'Monthly' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: 'var(--text-muted, #71717a)' }}>Net PF Returns:</span>
              <span style={{ fontWeight: 500, color: '#3b82f6' }}>
                {pct.toFixed(2)}%
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: 'var(--text-muted, #71717a)' }}>{benchName}:</span>
              <span style={{ fontWeight: 500, color: activeBenchmark?.color || '#ef4444' }}>
                {Number(d.indexMonthlyReturn !== undefined ? d.indexMonthlyReturn : d.benchmarkMonthlyReturn || 0).toFixed(2)}%
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: 'var(--text-muted, #71717a)' }}>Monthly P&L:</span>
              <span style={{ fontWeight: 500, color: 'var(--text-primary, #18181b)' }}>
                {formatExactINR(plVal)}
              </span>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
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
  allTrades = [],
  portfolioCapital = 0,
  onOpenStockChart,
  chargesMap = null,
  dateRange = 'All Time',
  resolvedDateFilter = null,
  onNavigateToDeepAnalytics = null
}) {
  // ─── States ──────────────────────────────────────────────────
  const [pnlMode, setPnlMode] = useState('gross'); // 'gross' | 'net' (defaults to gross)
  const [metricUnit, setMetricUnit] = useState('percent'); // 'percent' | 'rupee'
  const [perfTab, setPerfTab] = useState('Growth'); // 'Growth' | 'Monthly' | 'Equity' | 'Daily'
  const [isVsEnabled, setIsVsEnabled] = useState(false);
  const [selectedBenchmark, setSelectedBenchmark] = useState('NIFTY');
  const activeBenchmarkObj = useMemo(() => {
    return INDIAN_BENCHMARKS.find(b => b.id === selectedBenchmark || b.symbol === selectedBenchmark || b.name === selectedBenchmark) || INDIAN_BENCHMARKS[0];
  }, [selectedBenchmark]);
  const [performerMetric, setPerformerMetric] = useState('R:R'); // 'R:R' | 'Stock Move' | 'Portfolio Impact' | 'P/L (₹)'
  const [isPerformerDropdownOpen, setIsPerformerDropdownOpen] = useState(false);
  
  // Stock Move % widget controls
  const [stockMoveMetric, setStockMoveMetric] = useState('Move'); // 'Move' | 'R-MULT'
  const [stockMoveInterval, setStockMoveInterval] = useState('Daily'); // 'Daily' | 'Weekly' | 'Monthly'
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isCustomizeBtnHovered, setIsCustomizeBtnHovered] = useState(false);
  const customizeDropdownRef = useRef(null);
  const [activeStatPopover, setActiveStatPopover] = useState(null);

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

function getTradeActualCloseDateStr(t) {
  if (!t) return '';
  if (Number(t.e4Qty || 0) > 0 && (t.e4Date || t.exit4Date)) return t.e4Date || t.exit4Date;
  if (Number(t.e3Qty || 0) > 0 && (t.e3Date || t.exit3Date)) return t.e3Date || t.exit3Date;
  if (Number(t.e2Qty || 0) > 0 && (t.e2Date || t.exit2Date)) return t.e2Date || t.exit2Date;
  if (Number(t.e1Qty || 0) > 0 && (t.e1Date || t.exit1Date)) return t.e1Date || t.exit1Date;
  return t.exitDate || t.date || '';
}

  // ─── Indian STT & Net Charges Enrichment ───────────────────────────────────
  const enrichedTrades = useMemo(() => {
    const valid = (trades || []).filter(t => t && (t.name || t.symbol || '').trim());

    // Group closed trade proceeds by exit month to build monthly starting capital rollover
    const monthlyExitPlMap = {};
    valid.forEach(t => {
      const isClosedOrPartial = t.status === 'Closed' || t.status === 'Partial' || t.positionStatus === 'Closed' || t.positionStatus === 'Partial';
      if (!isClosedOrPartial) return;

      if (t.matches && Array.isArray(t.matches) && t.matches.length > 0) {
        t.matches.forEach(m => {
          const exitD = parseTradeDate(m.exitDate || m.exit?.date || t.date);
          if (!exitD) return;
          const key = `${exitD.getFullYear()}-${String(exitD.getMonth() + 1).padStart(2, '0')}`;
          monthlyExitPlMap[key] = (monthlyExitPlMap[key] || 0) + (Number(m.pl) || 0);
        });
      } else {
        const exitLegs = [
          { date: t.e1Date || t.exit1Date, qty: Number(t.e1Qty || t.exit1Qty || 0), price: Number(t.e1Price || t.exit1Price || 0) },
          { date: t.e2Date || t.exit2Date, qty: Number(t.e2Qty || t.exit2Qty || 0), price: Number(t.e2Price || t.exit2Price || 0) },
          { date: t.e3Date || t.exit3Date, qty: Number(t.e3Qty || t.exit3Qty || 0), price: Number(t.e3Price || t.exit3Price || 0) },
          { date: t.e4Date || t.exit4Date, qty: Number(t.e4Qty || t.exit4Qty || 0), price: Number(t.e4Price || t.exit4Price || 0) }
        ].filter(l => l.date && l.qty > 0 && l.price > 0);

        const avgEntry = Number(t.avgEntry || t.entry || 0);
        const totalLegQty = exitLegs.reduce((acc, l) => acc + l.qty, 0);

        if (exitLegs.length > 1 && totalLegQty > 0 && avgEntry > 0) {
          exitLegs.forEach(leg => {
            const pDate = parseTradeDate(leg.date);
            if (!pDate) return;
            const key = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
            const legPl = (leg.price - avgEntry) * leg.qty;
            monthlyExitPlMap[key] = (monthlyExitPlMap[key] || 0) + legPl;
          });
        } else {
          const closeDateStr = getTradeActualCloseDateStr(t);
          const pClose = parseTradeDate(closeDateStr) || parseTradeDate(t.date);
          if (!pClose) return;
          const key = `${pClose.getFullYear()}-${String(pClose.getMonth() + 1).padStart(2, '0')}`;
          const rawPnl = Number(t.pl !== undefined ? t.pl : (t.grossPnl !== undefined ? t.grossPnl : t.pnl || 0));
          monthlyExitPlMap[key] = (monthlyExitPlMap[key] || 0) + rawPnl;
        }
      }
    });

    const sortedMonthKeys = Object.keys(monthlyExitPlMap).sort();
    const monthlyStartCapMap = {};
    let rollingCap = baseCapital > 0 ? baseCapital : 200000;
    sortedMonthKeys.forEach(mKey => {
      monthlyStartCapMap[mKey] = rollingCap;
      rollingCap += monthlyExitPlMap[mKey];
    });

    const getCapAtDate = (entryDate) => {
      if (!entryDate) return baseCapital > 0 ? baseCapital : 200000;
      const key = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyStartCapMap[key]) return monthlyStartCapMap[key];
      if (sortedMonthKeys.length > 0 && key < sortedMonthKeys[0]) {
        return baseCapital > 0 ? baseCapital : 200000;
      }
      return rollingCap;
    };

    return valid.map(t => {
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
        const isAutoChargesEnabled = typeof localStorage !== 'undefined' && localStorage.getItem('foxtrade_auto_taxes_enabled') === 'true';
        if (isAutoChargesEnabled) {
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
      }

      const parsedDate = parseTradeDate(t.date);
      const closeDateStr = getTradeActualCloseDateStr(t);
      const parsedCloseDate = parseTradeDate(closeDateStr) || parsedDate;
      const stockMove = Number(t.stockMove !== undefined ? t.stockMove : t.stockMovePct || 0);
      
      const rawRR = (t.weightedRR !== undefined && t.weightedRR !== null && !isNaN(Number(t.weightedRR)))
        ? Number(t.weightedRR)
        : ((t.rewardRisk !== undefined && t.rewardRisk !== null && t.rewardRisk !== '')
          ? Number(t.rewardRisk)
          : ((t.rr !== undefined && t.rr !== null && t.rr !== '') ? Number(t.rr) : (grossPnl >= 0 ? 1.5 : -1)));
      const rewardRisk = isNaN(rawRR) ? 0 : rawRR;

      const rawStatus = String(t.status || t.positionStatus || '').trim().toLowerCase();
      let status = 'Open';
      if (rawStatus === 'closed' || (Number(t.openQty || 0) === 0 && (Number(t.exitedQty || 0) > 0 || grossPnl !== 0))) {
        status = 'Closed';
      } else if (rawStatus === 'partial' || (Number(t.exitedQty || 0) > 0 && Number(t.openQty || 0) > 0)) {
        status = 'Partial';
      }

      // Lot-weighted closed holding days
      const closedWeightedDays = getClosedWeightedHoldingDays(t, 'lifo');
      let holdingDays = closedWeightedDays;
      if (status === 'Closed' && (!holdingDays || holdingDays <= 0)) {
        if (t.holdingDays !== undefined && t.holdingDays !== null && t.holdingDays !== '' && !isNaN(Number(t.holdingDays)) && Number(t.holdingDays) > 0) {
          holdingDays = Number(t.holdingDays);
        } else if (t.holdingPeriod !== undefined && !isNaN(Number(t.holdingPeriod)) && Number(t.holdingPeriod) > 0) {
          holdingDays = Number(t.holdingPeriod);
        } else if (parsedCloseDate && parsedDate && parsedCloseDate >= parsedDate) {
          holdingDays = Math.max(0, Math.round((parsedCloseDate.getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24)));
        }
      }
      if (status === 'Open') {
        holdingDays = 0; // Open positions have no closed exit holding days
      }

      // Exact Allocation % matching dynamic running capital
      let allocation = 0;
      const capAtDate = getCapAtDate(parsedDate);
      const posSize = Number(t.positionSize || ((Number(t.entry || t.avgEntry || 0)) * (Number(t.qty || t.initialQty || 1))));
      if (capAtDate > 0 && posSize > 0) {
        allocation = (posSize / capAtDate) * 100;
      } else if (typeof t.allocation === 'number' && !isNaN(t.allocation) && t.allocation > 0) {
        allocation = t.allocation;
      } else if (typeof t.peakAllocation === 'number' && !isNaN(t.peakAllocation) && t.peakAllocation > 0) {
        allocation = t.peakAllocation;
      } else if (typeof t.totalCapitalAllocated === 'number' && !isNaN(t.totalCapitalAllocated) && t.totalCapitalAllocated > 0) {
        allocation = (posSize / t.totalCapitalAllocated) * 100;
      }

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
        allocation,
        rewardRisk: parseFloat(rewardRisk.toFixed(2))
      };
    });
  }, [trades, pnlMode, baseCapital]);

  const totalIncurredCharges = useMemo(() => {
    return enrichedTrades.reduce((acc, t) => acc + (t.totalCharges || 0), 0);
  }, [enrichedTrades]);

  // ─── 1. Portfolio Performance Chart Time Series ──────────────
  const { performanceData, monthlyData, dailyData, headlineReturnPct, alphaVsBenchmark, heroHasTrades } = useMemo(() => {
    const closed = enrichedTrades
      .filter(t => (t.status === 'Closed' || t.status === 'Partial' || t.positionStatus === 'Closed') && t.parsedDate)
      .sort((a, b) => a.parsedDate - b.parsedDate);

    const bObj = activeBenchmarkObj;
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
        const bMonthData = bObj.monthlyData?.[key] || {};
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
          indexValue: bMonthData.indexValue || 0,
          indexPercentage: bMonthData.indexPercentage || 0,
          indexMonthlyReturn: bMonthData.indexMonthlyReturn || 0,
          benchmarkVal: bMonthData.indexValue || 0,
          benchmarkPct: bMonthData.indexPercentage || 0,
          benchmarkMonthlyReturn: bMonthData.indexMonthlyReturn || 0
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

    // Monthly Data timeline & Top Movers calculation
    const monthMap = {};
    closed.forEach(t => {
      const symbol = (t.symbol || t.name || 'Stock').toUpperCase().trim();

      if (t.matches && Array.isArray(t.matches) && t.matches.length > 0) {
        t.matches.forEach(m => {
          const pDate = parseTradeDate(m.exitDate || m.exit?.date || t.date);
          if (!pDate) return;
          const key = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
          const label = pDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
          if (!monthMap[key]) monthMap[key] = { monthKey: key, date: label, month: label, pnl: 0, count: 0, symbolPlMap: {} };
          const legPl = Number(m.pl) || 0;
          monthMap[key].pnl += legPl;
          monthMap[key].count += 1;
          if (!monthMap[key].symbolPlMap[symbol]) monthMap[key].symbolPlMap[symbol] = 0;
          monthMap[key].symbolPlMap[symbol] += legPl;
        });
      } else {
        const exitLegs = [
          { date: t.e1Date || t.exit1Date, qty: Number(t.e1Qty || t.exit1Qty || 0), price: Number(t.e1Price || t.exit1Price || 0) },
          { date: t.e2Date || t.exit2Date, qty: Number(t.e2Qty || t.exit2Qty || 0), price: Number(t.e2Price || t.exit2Price || 0) },
          { date: t.e3Date || t.exit3Date, qty: Number(t.e3Qty || t.exit3Qty || 0), price: Number(t.e3Price || t.exit3Price || 0) }
        ].filter(l => l.date && l.qty > 0 && l.price > 0);

        const avgEntry = Number(t.avgEntry || t.entry || 0);
        const totalLegQty = exitLegs.reduce((acc, l) => acc + l.qty, 0);

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

    const startRange = minTradeDate || new Date(today.getFullYear(), today.getMonth() - 4, 1);
    const endRange = maxTradeDate || today;

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
      const bMonthData = bObj.monthlyData?.[k] || {};
      const indexValue = bMonthData.indexValue || 0;
      const indexPercentage = bMonthData.indexPercentage !== undefined ? bMonthData.indexPercentage : 0;
      const indexMonthlyReturn = bMonthData.indexMonthlyReturn !== undefined ? bMonthData.indexMonthlyReturn : 0;

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
        indexValue,
        indexPercentage,
        indexMonthlyReturn,
        benchmarkVal: indexValue,
        benchmarkPct: parseFloat(indexPercentage.toFixed(2)),
        benchmarkMonthlyReturn: parseFloat(indexMonthlyReturn.toFixed(2))
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

  // Dynamic Y-Axis scale & formatting for Growth tab
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

  // ─── Shared Active Capital Denominator (Base Capital + Deposits - Withdrawals + Realized P&L) ───
  const activeCapital = useMemo(() => {
    return getCapital({
      trades: enrichedTrades,
      portfolioId: (typeof localStorage !== 'undefined' && localStorage.getItem('tradeontip_active_portfolio_id')) || 'portfolio-default',
      year: new Date().getFullYear().toString()
    }) || Number(portfolioCapital || 0) || Number(baseCapital || 0);
  }, [baseCapital, enrichedTrades, portfolioCapital]);

  // ─── 2. Metric Calculations for Column 1 & 2 ─────────
  const metrics = useMemo(() => {
    const totalTradesCount = enrichedTrades.length;
    const isGross = pnlMode === 'gross';
    const closedMetrics = computeClosedMetrics(enrichedTrades, { useGross: isGross });
    const partialSummary = computePartialSummary(enrichedTrades, { useGross: isGross });

    let sumPosMove = 0;
    let countPosMove = 0;
    let sumNegMove = 0;
    let countNegMove = 0;
    let sumAlloc = 0;
    let countAlloc = 0;
    let sumHoldingDays = 0;
    let countHoldingDays = 0;
    let sumR = 0;
    let countR = 0;
    let planFollowedCount = 0;
    let totalPlanned = 0;
    let openPositionsCount = 0;

    for (const t of enrichedTrades) {
      const status = String(t.positionStatus || t.status || '').toLowerCase();
      const isPartial = status === 'partial';
      const isOpen = status === 'open';

      if (isOpen || isPartial) openPositionsCount++;

      // Average Positive & Negative Stock Moves (across all trades in journal)
      const move = Number(t.stockMove !== undefined ? t.stockMove : (t.stockMovePct || 0));
      if (move > 0) {
        sumPosMove += move;
        countPosMove++;
      } else if (move < 0) {
        sumNegMove += Math.abs(move);
        countNegMove++;
      }

      // Average Position Size (% of Base Capital across all trades)
      let alloc = Number(t.allocation || 0);
      if (alloc <= 0) {
        const posSize = Number(t.positionSize || ((Number(t.entry || t.avgEntry || 0)) * (Number(t.qty || t.initialQty || 1))));
        alloc = baseCapital > 0 ? (posSize / baseCapital) * 100 : 0;
      }
      if (alloc > 0) {
        sumAlloc += alloc;
        countAlloc++;
      }

      // Average Holding Days: Lot-weighted closed days on trades with closed exits (> 0)
      const hDays = Number(t.holdingDays || 0);
      if (hDays > 0) {
        sumHoldingDays += hDays;
        countHoldingDays++;
      }

      // Average R:R across all trades in journal
      const rr = getR(t);
      if (rr !== null) {
        sumR += rr;
        countR++;
      }

      if (t.planFollowed !== undefined) {
        totalPlanned++;
        if (t.planFollowed === true || String(t.planFollowed).trim().toLowerCase() === 'yes' || String(t.planFollowed).trim().toLowerCase() === 'true') {
          planFollowedCount++;
        }
      }
    }

    const wins = closedMetrics.winCount;
    const losses = closedMetrics.lossCount;
    const winRate = closedMetrics.winRate;
    const avgWinMove = countPosMove > 0 ? sumPosMove / countPosMove : 0;
    const avgLossMove = countNegMove > 0 ? sumNegMove / countNegMove : 0;
    const avgPositionSize = countAlloc > 0 ? sumAlloc / countAlloc : 0;
    const avgHoldingDays = countHoldingDays > 0 ? sumHoldingDays / countHoldingDays : 0;
    const avgRR = countR > 0 ? sumR / countR : 0;
    const planFollowedPct = totalPlanned > 0 ? (planFollowedCount / totalPlanned) * 100 : 100;

    // Profit Factor & Expectancy from shared closedMetrics (Fix 4)
    const profitFactor = closedMetrics.profitFactor;
    const avgWinPnl = closedMetrics.avgWin;
    const avgLossPnl = closedMetrics.avgLoss;
    const expectancy = closedMetrics.expectancy;
    const totalRealizedPnl = (closedMetrics.grossWin - closedMetrics.grossLoss) + partialSummary.realizedPnl;

    // Cash %: 100% minus total open invested capital as % of active capital (using shared activeCapital)
    const openTrades = enrichedTrades.filter(t => {
      const s = String(t.positionStatus || t.status || '').toLowerCase();
      return s === 'open' || s === 'partial';
    });
    const totalOpenInvested = openTrades.reduce((acc, t) => {
      const openQty = Number(t.openQty || (String(t.status || t.positionStatus).toLowerCase() === 'open' ? t.qty : 0) || 0);
      const entryPrice = Number(t.avgEntry || t.entry || 0);
      return acc + (openQty * entryPrice);
    }, 0);
    const investedPct = activeCapital > 0 ? (totalOpenInvested / activeCapital) * 100 : 0;
    const cashPct = Math.max(0, 100 - investedPct);

    return {
      totalTrades: totalTradesCount,
      winRate: winRate.toFixed(2) + '%',
      winRateRaw: winRate,
      avgWinMove: avgWinMove.toFixed(2) + '%',
      avgLossMove: avgLossMove.toFixed(2) + '%',
      avgPositionSize: avgPositionSize.toFixed(2) + '%',
      avgHoldingDays: avgHoldingDays.toFixed(2),
      planFollowed: planFollowedPct.toFixed(2) + '%',
      avgR: avgRR.toFixed(2),
      openPositions: openPositionsCount,
      cash: cashPct.toFixed(2) + '%',
      profitFactor: profitFactor === null ? '∞' : (profitFactor > 0 ? profitFactor.toFixed(2) + '×' : '0.00×'),
      expectancy: formatINR(expectancy),
      rawExpectancy: expectancy,
      avgGain: avgWinMove.toFixed(2) + '%',
      avgLoss: avgLossMove.toFixed(2) + '%',
      avgWinPnl,
      avgLossPnl,
      totalRealizedPnl,
      partialRealizedPnl: partialSummary.realizedPnl,
      partialTradesCount: partialSummary.count,
      partialRealizedPnlFormatted: formatINR(partialSummary.realizedPnl),
      highestR: closedMetrics.highestR,
      lowestR: closedMetrics.lowestR
    };
  }, [enrichedTrades, activeCapital, baseCapital, pnlMode]);

  // ─── 3. Top Performers (Highest & Lowest Extreme Cards) ────────────────────
  const { highestTrade, lowestTrade } = useMemo(() => {
    // Restricted strictly to Closed trades for statistical integrity (Fix 4.2)
    const eligible = enrichedTrades.filter(isClosedTrade);
    if (!eligible.length) return { highestTrade: null, lowestTrade: null, highVal: 0, lowVal: 0 };

    const getVal = (t, metric) => {
      switch (metric) {
        case 'Stock Move':
        case 'Stock Move %':
          return Number(t.stockMove !== undefined ? t.stockMove : t.stockMovePct || 0);
        case 'Portfolio Impact':
          return (typeof t.pfImpact === 'number' && t.pfImpact !== 0)
            ? t.pfImpact
            : (activeCapital > 0 ? (getTradePnl(t) / activeCapital) * 100 : 0);
        case 'R:R':
          return getR(t) ?? 0;
        case 'P/L (₹)':
        default:
          return getTradePnl(t);
      }
    };

    let high = eligible[0];
    let low = eligible[0];
    let highVal = getVal(high, performerMetric);
    let lowVal = getVal(low, performerMetric);

    for (let i = 1; i < eligible.length; i++) {
      const cur = eligible[i];
      const val = getVal(cur, performerMetric);
      if (val > highVal) {
        high = cur;
        highVal = val;
      }
      if (val < lowVal) {
        low = cur;
        lowVal = val;
      }
    }

    return { highestTrade: high, lowestTrade: low, highVal, lowVal };
  }, [enrichedTrades, performerMetric, activeCapital]);

  // ─── 4. Stock Move % Distribution Series ─────────
  const { stockMoveSeries, stockMoveHasTrades } = useMemo(() => {
    const validTrades = enrichedTrades.filter(t => 
      t && (t.name || t.symbol || '').trim() &&
      (t.parsedDate || t.parsedCloseDate) &&
      Math.abs(Number(t.stockMove !== undefined ? t.stockMove : (t.stockMovePct || 0))) > 0.001
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
      const d = t.parsedDate || t.parsedCloseDate;
      if (!d || isNaN(d.getTime())) return;

      let key = '';
      let dateMs = 0;
      let displayDate = '';
      let fullDate = '';

      if (stockMoveInterval === 'Daily') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        dateMs = dayDate.getTime();
        fullDate = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        displayDate = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (stockMoveInterval === 'Weekly') {
        const startOfWeek = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday start
        key = `W-${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
        dateMs = startOfWeek.getTime();
        fullDate = `Week of ${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        displayDate = startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        // Monthly
        key = `M-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        dateMs = monthStart.getTime();
        fullDate = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        displayDate = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }

      if (!groups[key]) {
        groups[key] = {
          date: key,
          dateMs,
          displayDate,
          fullDate,
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
        fullDate: grp.fullDate,
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

  const stockMoveYAxisConfig = useMemo(() => {
    const isRMult = stockMoveMetric === 'R-MULT';
    const values = (stockMoveSeries || []).map(s => isRMult ? Number(s.avgRMultiple || 0) : Number(s.avgStockMove || 0));

    if (!values.length || !stockMoveHasTrades) {
      return isRMult
        ? { domain: [-1, 3], ticks: [-1, 0, 1, 2, 3] }
        : { domain: [-4, 12], ticks: [-4, 0, 4, 8, 12] };
    }

    const minVal = Math.min(0, ...values);
    const maxVal = Math.max(0, ...values);

    if (isRMult) {
      const range = Math.max(0.1, maxVal - minVal);
      const roughStep = range / 4;
      const steps = [0.25, 0.5, 1, 2, 5];
      let step = steps.find(s => s >= roughStep) || 1;
      if (step < 1 && (maxVal >= 2 || minVal <= -1)) step = 1;

      const tickMin = Math.floor(minVal / step) * step;
      const tickMax = Math.ceil(maxVal / step) * step;
      const ticks = [];
      for (let v = tickMin; v <= tickMax + 0.0001; v += step) {
        ticks.push(Number(v.toFixed(2)));
      }
      return { domain: [tickMin, tickMax], ticks };
    } else {
      const range = Math.max(1, maxVal - minVal);
      const roughStep = range / 4;
      const steps = [1, 2, 4, 5, 10, 20, 25, 50];
      let step = steps.find(s => s >= roughStep) || 4;
      if (step < 4 && (maxVal >= 8 || minVal <= -4)) step = 4;

      const tickMin = Math.floor(minVal / step) * step;
      const tickMax = Math.ceil(maxVal / step) * step;
      const ticks = [];
      for (let v = tickMin; v <= tickMax + 0.0001; v += step) {
        ticks.push(Number(v.toFixed(2)));
      }
      return { domain: [tickMin, tickMax], ticks };
    }
  }, [stockMoveSeries, stockMoveMetric, stockMoveHasTrades]);

  return (
    <main style={{ maxWidth: '1088px', margin: '0 auto', padding: '16px 27px 110px 27px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      
      {/* ── HEADER ROW ──────────────────────────────────────── */}
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
          {onNavigateToDeepAnalytics && (
            <button
              type="button"
              onClick={onNavigateToDeepAnalytics}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                border: '1px solid #10b981',
                backgroundColor: '#ecfdf5',
                color: '#047857',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#d1fae5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ecfdf5';
              }}
              title="Open Deep Analytics suite: Pareto curve, holding period spread, and weekday heatmap"
            >
              <Sparkles size={12} strokeWidth={2.5} />
              Deep Stats &amp; Pareto &rarr;
            </button>
          )}

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

      {/* ── MAIN DASHBOARD GRID (3-COLUMN STRUCTURE) ──────────── */}
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
                    {isVsEnabled && (perfTab === 'Growth' || perfTab === 'Monthly') && (
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
                      {(perfTab === 'Growth' || perfTab === 'Monthly') && (
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
                      
                      {(!isVsEnabled || (perfTab !== 'Growth' && perfTab !== 'Monthly')) && (
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
                      )}

                      {/* Indian Benchmark Selector Pills when VS active on Growth / Monthly */}
                      {isVsEnabled && (perfTab === 'Growth' || perfTab === 'Monthly') && (
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
                                backgroundColor: (selectedBenchmark === b.id || selectedBenchmark === b.name || selectedBenchmark === b.symbol) ? 'var(--bg-hover, #f4f4f5)' : 'transparent',
                                color: (selectedBenchmark === b.id || selectedBenchmark === b.name || selectedBenchmark === b.symbol) ? 'var(--text-primary, #18181b)' : 'var(--text-muted, #71717a)',
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
                              tickFormatter={t => (!isVsEnabled && metricUnit === 'rupee') ? `₹${Math.round(t).toLocaleString('en-IN')}` : `${Number(t).toFixed(0)}%`}
                              width={(!isVsEnabled && metricUnit === 'rupee') ? 65 : 45}
                            />
                            <Tooltip
                              cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                              content={props => <CustomFoxHeroTooltip {...props} metricUnit={metricUnit} perfTab="Monthly" baseCapital={baseCapital} isVsEnabled={isVsEnabled} activeBenchmark={activeBenchmarkObj} />}
                            />
                            <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />
                            {isVsEnabled ? (
                              <>
                                <Bar
                                  dataKey="plPercentage"
                                  name="Net PF Returns"
                                  fill="#3b82f6"
                                  radius={[4, 4, 0, 0]}
                                  maxBarSize={32}
                                  isAnimationActive={true}
                                  animationDuration={800}
                                  animationEasing="ease-out"
                                />
                                <Bar
                                  dataKey="indexMonthlyReturn"
                                  name={activeBenchmarkObj.name}
                                  fill={activeBenchmarkObj.color}
                                  radius={[4, 4, 0, 0]}
                                  maxBarSize={32}
                                  isAnimationActive={true}
                                  animationDuration={800}
                                  animationEasing="ease-out"
                                />
                              </>
                            ) : (
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
                            )}
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
                            <Tooltip cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '3 3' }} content={props => <CustomFoxHeroTooltip {...props} metricUnit={metricUnit} perfTab="Daily" baseCapital={baseCapital} />} />
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
                            <Tooltip cursor={{ stroke: '#60a5fa', strokeWidth: 1, strokeDasharray: '3 3' }} content={props => <CustomFoxHeroTooltip {...props} metricUnit={metricUnit} perfTab="Equity" baseCapital={baseCapital} />} />
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
                          /* Growth Tab (Hero Area Chart / Dual-Line Chart with VS) */
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
                            {isVsEnabled ? (
                              <>
                                <YAxis
                                  yAxisId="left"
                                  orientation="left"
                                  scale="linear"
                                  domain={['auto', 'auto']}
                                  axisLine={false}
                                  tickLine={false}
                                  width={75}
                                  stroke="#71717a"
                                  tickFormatter={t => `₹${Math.round(t).toLocaleString('en-IN')}`}
                                  tick={{ fontSize: 11 }}
                                />
                                <YAxis
                                  yAxisId="right"
                                  orientation="right"
                                  scale="linear"
                                  domain={['auto', 'auto']}
                                  axisLine={false}
                                  tickLine={false}
                                  width={60}
                                  stroke={activeBenchmarkObj.color}
                                  tickFormatter={t => Math.round(t).toLocaleString('en-IN')}
                                  tick={{ fontSize: 11, fill: activeBenchmarkObj.color }}
                                />
                                <Tooltip
                                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
                                  content={props => <CustomFoxHeroTooltip {...props} metricUnit="rupee" perfTab="Growth" baseCapital={baseCapital} isVsEnabled={isVsEnabled} activeBenchmark={activeBenchmarkObj} />}
                                />
                                <Line
                                  yAxisId="left"
                                  type="monotone"
                                  dataKey="capital"
                                  name="Portfolio Value"
                                  stroke="#2563eb"
                                  strokeWidth={2.5}
                                  dot={{ r: 3, fill: '#2563eb' }}
                                  activeDot={{ r: 5, stroke: '#2563eb', strokeWidth: 2, fill: '#ffffff' }}
                                  isAnimationActive={true}
                                  animationDuration={800}
                                  animationEasing="ease-out"
                                />
                                <Line
                                  yAxisId="right"
                                  type="monotone"
                                  dataKey="indexValue"
                                  name={activeBenchmarkObj.name}
                                  stroke={activeBenchmarkObj.color}
                                  strokeWidth={2.5}
                                  dot={{ r: 3, fill: activeBenchmarkObj.color }}
                                  activeDot={{ r: 5, stroke: activeBenchmarkObj.color, strokeWidth: 2, fill: '#ffffff' }}
                                  isAnimationActive={true}
                                  animationDuration={800}
                                  animationEasing="ease-out"
                                />
                              </>
                            ) : (
                              <>
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
                                <Tooltip
                                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
                                  content={props => <CustomFoxHeroTooltip {...props} metricUnit={metricUnit} perfTab="Growth" baseCapital={baseCapital} isVsEnabled={false} />}
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
                              </>
                            )}
                          </ComposedChart>
                        )}
                      </ResponsiveContainer>
                    </div>

                  </div>

                  {/* Chart Bottom Legend (Dynamic matching active tab) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '24px',
                    fontSize: '11px',
                    color: '#71717a',
                    fontWeight: 450
                  }}>
                    {perfTab === 'Daily' ? null : perfTab === 'Equity' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60a5fa', fontWeight: 500, fontSize: '11px' }}>
                        <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
                          <line x1="0" y1="5" x2="20" y2="5" stroke="#60a5fa" strokeWidth="2" />
                          <circle cx="10" cy="5" r="2.5" fill="#ffffff" stroke="#60a5fa" strokeWidth="1.5" />
                        </svg>
                        <span>Equity Curve</span>
                      </div>
                    ) : perfTab === 'Monthly' ? (
                      isVsEnabled ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3b82f6', fontWeight: 500 }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#3b82f6', display: 'inline-block' }} />
                            <span>Net PF Returns</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: activeBenchmarkObj.color, fontWeight: 500 }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: activeBenchmarkObj.color, display: 'inline-block' }} />
                            <span>{activeBenchmarkObj.name}</span>
                          </div>
                        </>
                      ) : null
                    ) : (
                      /* Growth Tab */
                      isVsEnabled ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2563eb', fontWeight: 500 }}>
                            <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
                              <line x1="0" y1="5" x2="20" y2="5" stroke="#2563eb" strokeWidth="2" />
                              <circle cx="10" cy="5" r="2.5" fill="#ffffff" stroke="#2563eb" strokeWidth="1.5" />
                            </svg>
                            <span>Portfolio Value</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: activeBenchmarkObj.color, fontWeight: 500 }}>
                            <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
                              <line x1="0" y1="5" x2="20" y2="5" stroke={activeBenchmarkObj.color} strokeWidth="2" />
                              <circle cx="10" cy="5" r="2.5" fill="#ffffff" stroke={activeBenchmarkObj.color} strokeWidth="1.5" />
                            </svg>
                            <span>{activeBenchmarkObj.name}</span>
                          </div>
                        </>
                      ) : (
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
                      )
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
              overflow: 'visible',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              {[
                { label: 'Win %', value: metrics.winRate, desc: 'Percentage of profitable trades.' },
                { label: 'Avg Gain', value: metrics.avgGain, desc: 'Average gain on winning trades.', color: '#10b981' },
                { label: 'Avg Loss', value: metrics.avgLoss, desc: 'Average loss on losing trades.', color: '#ef4444' },
                { label: 'Avg Position Size', value: metrics.avgPositionSize, desc: 'Average position size vs portfolio.' },
                { label: 'Avg Holding Days', value: metrics.avgHoldingDays, desc: 'Average duration trades are held.' },
                { label: 'Avg R:R', value: metrics.avgR, desc: 'Average reward-to-risk ratio.' },
                { label: 'Profit Factor', value: metrics.profitFactor, desc: 'Gross profits divided by gross losses.' },
                { label: 'Expectancy', value: metrics.expectancy, desc: 'Expected return per trade.', color: '#10b981' },
                ...(metrics.partialTradesCount > 0 ? [{
                  label: 'Realized from partial exits',
                  value: metrics.partialRealizedPnlFormatted,
                  desc: 'Total realized P&L from partially exited positions.',
                  color: metrics.partialRealizedPnl >= 0 ? '#10b981' : '#ef4444'
                }] : []),
              ].map((row, idx, arr) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderBottom: idx < arr.length - 1 ? '1px solid var(--border-color, #f4f4f5)' : 'none',
                    borderTopLeftRadius: idx === 0 ? '16px' : 0,
                    borderTopRightRadius: idx === 0 ? '16px' : 0,
                    borderBottomLeftRadius: idx === arr.length - 1 ? '16px' : 0,
                    borderBottomRightRadius: idx === arr.length - 1 ? '16px' : 0,
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {row.label}
                    </span>
                    <StatInfoButton
                      label={row.label}
                      desc={row.desc}
                      activePopover={activeStatPopover}
                      setActivePopover={setActiveStatPopover}
                    />
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
                    {['R:R', 'Stock Move', 'Portfolio Impact', 'P/L (₹)'].map(opt => (
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
                          ? (highestTrade.rewardRisk >= 0 ? `+${highestTrade.rewardRisk.toFixed(2)}R` : `${highestTrade.rewardRisk.toFixed(2)}R`)
                          : (performerMetric === 'Stock Move' || performerMetric === 'Stock Move %')
                          ? (highestTrade.stockMove >= 0 ? `+${highestTrade.stockMove.toFixed(2)}%` : `${highestTrade.stockMove.toFixed(2)}%`)
                          : performerMetric === 'Portfolio Impact'
                          ? (() => {
                              const v = (typeof highestTrade.pfImpact === 'number' && highestTrade.pfImpact !== 0)
                                ? highestTrade.pfImpact
                                : (activeCapital > 0 ? (Number(highestTrade.activePnl !== undefined ? highestTrade.activePnl : (highestTrade.grossPnl !== undefined ? highestTrade.grossPnl : (highestTrade.pl || 0))) / activeCapital) * 100 : 0);
                              return v >= 0 ? `+${v.toFixed(2)}%` : `${v.toFixed(2)}%`;
                            })()
                          : (highestTrade.activePnl >= 0
                            ? `+₹${Math.round(Math.abs(highestTrade.activePnl)).toLocaleString('en-IN')}`
                            : `-₹${Math.round(Math.abs(highestTrade.activePnl)).toLocaleString('en-IN')}`)}
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
                        <span>{formatDateDMY(highestTrade.date)}</span>
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
                          ? (lowestTrade.rewardRisk >= 0 ? `+${lowestTrade.rewardRisk.toFixed(2)}R` : `${lowestTrade.rewardRisk.toFixed(2)}R`)
                          : (performerMetric === 'Stock Move' || performerMetric === 'Stock Move %')
                          ? (lowestTrade.stockMove >= 0 ? `+${lowestTrade.stockMove.toFixed(2)}%` : `${lowestTrade.stockMove.toFixed(2)}%`)
                          : performerMetric === 'Portfolio Impact'
                          ? (() => {
                              const v = (typeof lowestTrade.pfImpact === 'number' && lowestTrade.pfImpact !== 0)
                                ? lowestTrade.pfImpact
                                : (activeCapital > 0 ? (Number(lowestTrade.activePnl !== undefined ? lowestTrade.activePnl : (lowestTrade.grossPnl !== undefined ? lowestTrade.grossPnl : (lowestTrade.pl || 0))) / activeCapital) * 100 : 0);
                              return v >= 0 ? `+${v.toFixed(2)}%` : `${v.toFixed(2)}%`;
                            })()
                          : (lowestTrade.activePnl >= 0
                            ? `+₹${Math.round(Math.abs(lowestTrade.activePnl)).toLocaleString('en-IN')}`
                            : `-₹${Math.round(Math.abs(lowestTrade.activePnl)).toLocaleString('en-IN')}`)}
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
                        <span>{formatDateDMY(lowestTrade.date)}</span>
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

        {/* ── 5. FULL WIDTH CARD: STOCK MOVE % (ROW 3) ──────────── */}
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
                          transition: 'all 0.2s ease',
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
                          transition: 'all 0.2s ease',
                          backgroundColor: stockMoveMetric === 'R-MULT' ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                          color: stockMoveMetric === 'R-MULT' ? '#8b5cf6' : 'var(--text-muted, #71717a)'
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

                {/* Recharts ComposedChart with Smooth Color Transition */}
                <div className="stock-move-chart-container" style={{ flex: 1, width: '100%', minHeight: 0, position: 'relative' }}>
                  <style>{`
                    .stock-move-chart-container path.recharts-curve {
                      transition: stroke 0.45s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .stock-move-chart-container path.recharts-area-area {
                      transition: fill 0.45s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .stock-move-chart-container .recharts-legend-item path,
                    .stock-move-chart-container .recharts-legend-icon path {
                      transition: stroke 0.45s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .stock-move-chart-container stop {
                      transition: stop-color 0.45s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                  `}</style>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stockMoveSeries} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
                      <defs>
                        <linearGradient id="chartGradientStockMove" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={stockMoveMetric === 'R-MULT' ? '#8b5cf6' : '#3b82f6'} stopOpacity={0.3} style={{ transition: 'stop-color 0.45s ease' }} />
                          <stop offset="95%" stopColor={stockMoveMetric === 'R-MULT' ? '#8b5cf6' : '#3b82f6'} stopOpacity={0} style={{ transition: 'stop-color 0.45s ease' }} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="displayDate"
                        axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                        tickLine={{ stroke: '#e5e7eb' }}
                        interval="preserveStartEnd"
                        minTickGap={28}
                        dy={8}
                        tick={{ fontSize: 11, fill: '#71717a' }}
                      />
                      <YAxis
                        yAxisId="left"
                        axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                        tickLine={{ stroke: '#e5e7eb' }}
                        dx={-5}
                        width={50}
                        tick={{ fontSize: 11, fill: '#71717a' }}
                        domain={stockMoveYAxisConfig.domain}
                        ticks={stockMoveYAxisConfig.ticks}
                        tickFormatter={val => stockMoveMetric === 'R-MULT' ? `${Number(val) >= 0 ? '+' : ''}${Number(val).toFixed(2)}R` : `${Number(val) >= 0 ? '+' : ''}${Number(val).toFixed(2)}%`}
                      />
                      <ReferenceLine yAxisId="left" y={0} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
                      <Tooltip
                        wrapperStyle={{ pointerEvents: 'auto', zIndex: 100 }}
                        content={<CustomStockMoveTooltip metricMode={stockMoveMetric === 'R-MULT' ? 'rMultiple' : 'stockMove'} />}
                      />
                      <Legend
                        layout={typeof window !== 'undefined' && window.innerWidth < 768 ? 'horizontal' : 'vertical'}
                        verticalAlign={typeof window !== 'undefined' && window.innerWidth < 768 ? 'bottom' : 'middle'}
                        align={typeof window !== 'undefined' && window.innerWidth < 768 ? 'center' : 'left'}
                        wrapperStyle={{ fontSize: '11px', fontWeight: 500, paddingLeft: typeof window !== 'undefined' && window.innerWidth < 768 ? '0' : '10px', paddingTop: typeof window !== 'undefined' && window.innerWidth < 768 ? '10px' : '0' }}
                        iconSize={10}
                      />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey={stockMoveMetric === 'R-MULT' ? 'avgRMultiple' : 'avgStockMove'}
                        name={stockMoveMetric === 'R-MULT' ? 'Average R-Multiple' : 'Average Stock Movement'}
                        stroke={stockMoveMetric === 'R-MULT' ? '#8b5cf6' : '#3b82f6'}
                        fillOpacity={1}
                        fill="url(#chartGradientStockMove)"
                        strokeWidth={2}
                        activeDot={stockMoveHasTrades ? { r: 4, stroke: stockMoveMetric === 'R-MULT' ? '#8b5cf6' : '#3b82f6' } : false}
                        dot={stockMoveHasTrades ? { r: 3, fillOpacity: 1, strokeWidth: 0, fill: stockMoveMetric === 'R-MULT' ? '#8b5cf6' : '#3b82f6' } : false}
                        isAnimationActive={true}
                        animationDuration={650}
                        animationEasing="ease-in-out"
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

function StatInfoButton({ label, desc, activePopover, setActivePopover }) {
  const [isHovered, setIsHovered] = useState(false);
  const isPinned = activePopover === label;
  const isOpen = isPinned || (!activePopover && isHovered);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isPinned) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setActivePopover(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActivePopover(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPinned, setActivePopover]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (setActivePopover) {
      setActivePopover(prev => (prev === label ? null : label));
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Info about ${label}`}
        style={{
          border: 'none',
          backgroundColor: isOpen ? '#f4f4f5' : 'transparent',
          color: isOpen ? '#18181b' : 'var(--text-muted, #a1a1aa)',
          padding: '2px',
          margin: 0,
          cursor: 'pointer',
          borderRadius: '4px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          outline: 'none'
        }}
      >
        <Info size={12} strokeWidth={2} />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 7px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            backgroundColor: '#ffffff',
            color: '#18181b',
            border: '1px solid #e4e4e7',
            borderRadius: '8px',
            padding: '7px 11px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 10px -3px rgba(0, 0, 0, 0.05)',
            fontSize: '11px',
            fontWeight: 500,
            lineHeight: 1.35,
            width: 'max-content',
            maxWidth: '200px',
            textAlign: 'center',
            whiteSpace: 'normal',
            pointerEvents: 'auto',
            letterSpacing: '-0.01em',
            boxSizing: 'border-box',
            userSelect: 'none'
          }}
        >
          {desc}
          {/* Subtle bottom arrow */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '4.5px solid transparent',
              borderRight: '4.5px solid transparent',
              borderTop: '5px solid #ffffff'
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 1px)',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '4.5px solid transparent',
              borderRight: '4.5px solid transparent',
              borderTop: '5px solid #e4e4e7',
              zIndex: -1
            }}
          />
        </div>
      )}
    </div>
  );
}

function CustomFoxTooltip({ active, payload, unit = '%' }) {
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

function CustomFoxMonthlyTooltip({ active, payload }) {
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
          {data.fullDate || data.displayDate || label}
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
