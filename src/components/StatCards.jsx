import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ListChecks, Zap, IndianRupee, TrendingUp, Flame, Timer, TrendingDown, 
  Info, RefreshCw, X, Check, ToggleLeft, ToggleRight, List, Activity, 
  Target, PieChart, BarChart2, Shield, Sparkles, Award, Wallet, Clock, Lock, 
  Coins, Scale, Percent, ChevronDown, ArrowUpDown
} from 'lucide-react';
import SymbolLogo from './SymbolLogo';
import DrawdownModal from './DrawdownModal';
import { 
  formatIndianRupee, 
  formatIndianNumber, 
  formatFullIndianRupee 
} from '../utils/indianCurrencyFormatter';
import { calculateMonthlyPerformance, getStoredCapitalChanges, getCapital } from '../utils/fundManagementCalculations';
import { formatDrawdownAmount, formatDrawdownPct } from '../utils/tradeMetricsShared';

const ICON_COMPONENTS = {
  list: ListChecks,
  activity: Activity,
  target: Target,
  rupee: IndianRupee,
  'trending-up': TrendingUp,
  flame: Flame,
  pie: PieChart,
  'trending-down': TrendingDown,
  bar: BarChart2,
  shield: Shield,
  zap: Zap,
  sparkles: Sparkles,
  award: Award,
  wallet: Wallet,
  clock: Clock,
  lock: Lock
};

/* ─────────────────────────────────────────────────────────────
   PnLSparkline – Butter-smooth morphing SVG area chart
   ───────────────────────────────────────────────────────────── */
function PnLSparkline({ trades = [] }) {
  const W = 220, H = 52;
  const PAD = { top: 5, bottom: 5, left: 2, right: 2 };
  const N = 50; // always normalize to N points for smooth morphing
  const DURATION = 900; // ms per transition

  // ── 1. Build raw cumulative P/L points ──
  const rawPoints = useMemo(() => {
    const closed = trades
      .filter(t => t.status === 'Closed' || (t.status === 'Partial' && (parseFloat(t.pnl) || 0) !== 0))
      .map(t => ({ date: t.e1Date || t.date || '', pnl: parseFloat(t.pnl) || 0 }))
      .filter(t => t.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (closed.length === 0) return [0, 0];
    let cum = 0;
    const pts = [0, ...closed.map(t => { cum += t.pnl; return cum; })];
    return pts;
  }, [trades]);

  // ── 2. Normalize any-length array → exactly N points (linear interpolation) ──
  const normalize = (pts) => {
    if (pts.length === 0) return new Array(N).fill(0);
    if (pts.length === 1) return new Array(N).fill(pts[0]);
    return Array.from({ length: N }, (_, i) => {
      const t = i / (N - 1);
      const ri = t * (pts.length - 1);
      const lo = Math.floor(ri), hi = Math.min(Math.ceil(ri), pts.length - 1);
      return pts[lo] + (pts[hi] - pts[lo]) * (ri - lo);
    });
  };

  // ── 3. Animated points state – drives SVG path recomputation every frame ──
  const [animPts, setAnimPts] = useState(() => new Array(N).fill(0));
  const animPtsRef = useRef(new Array(N).fill(0));
  const animFrameRef = useRef(null);
  const startPtsRef = useRef(new Array(N).fill(0));
  const targetPtsRef = useRef(new Array(N).fill(0));
  const startTsRef = useRef(null);

  useEffect(() => {
    const target = normalize(rawPoints);
    targetPtsRef.current = target;
    startPtsRef.current = [...animPtsRef.current];
    startTsRef.current = null;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const tick = (ts) => {
      if (!startTsRef.current) startTsRef.current = ts;
      const t = Math.min((ts - startTsRef.current) / DURATION, 1);
      const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const cur = startPtsRef.current.map((s, i) => s + (targetPtsRef.current[i] - s) * e);
      animPtsRef.current = cur;
      setAnimPts([...cur]);
      if (t < 1) animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [rawPoints]);

  // ── 4. Compute SVG geometry from animated points (runs every frame) ──
  const geo = useMemo(() => {
    const pts = animPts;
    const minVal = Math.min(...pts, 0);
    const maxVal = Math.max(...pts, 0);
    const range = maxVal - minVal || 1;
    const drawW = W - PAD.left - PAD.right;
    const drawH = H - PAD.top - PAD.bottom;
    const toX = (i) => PAD.left + (i / (N - 1)) * drawW;
    const toY = (v) => PAD.top + drawH - ((v - minVal) / range) * drawH;
    const zeroY = toY(0);
    const isPositive = pts[N - 1] >= 0;
    const color = isPositive ? '#10b981' : '#ef4444';

    // Smooth path using cardinal spline approximation (catmull-rom feel)
    const coords = pts.map((v, i) => [toX(i), toY(v)]);
    let pathD = `M ${coords[0][0].toFixed(1)} ${coords[0][1].toFixed(1)}`;
    for (let i = 1; i < coords.length; i++) {
      const [x0, y0] = coords[i - 1];
      const [x1, y1] = coords[i];
      const cpx = (x0 + x1) / 2;
      pathD += ` C ${cpx.toFixed(1)} ${y0.toFixed(1)}, ${cpx.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    const lastX = coords[N - 1][0], lastY = coords[N - 1][1];
    const areaD = pathD + ` L ${lastX.toFixed(1)} ${zeroY.toFixed(1)} L ${coords[0][0].toFixed(1)} ${zeroY.toFixed(1)} Z`;

    return { pathD, areaD, color, lastX, lastY, zeroY, isPositive };
  }, [animPts]);

  const { pathD, areaD, color, lastX, lastY, zeroY, isPositive } = geo;
  const gradId = isPositive ? 'pnl-g-pos' : 'pnl-g-neg';

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ display: 'block', overflow: 'visible', borderRadius: '0 0 8px 8px' }}>
      <defs>
        <linearGradient id="pnl-g-pos" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="pnl-g-neg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.01" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.32" />
        </linearGradient>
        <filter id="pnl-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Zero baseline */}
      <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY}
        stroke="var(--border-color,#e5e7eb)" strokeWidth="0.6" strokeDasharray="3 3" />
      {/* Area fill */}
      <path d={areaD} fill={`url(#${gradId})`} />
      {/* Line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Glowing tip dot */}
      <circle cx={lastX} cy={lastY} r={4} fill={color} filter="url(#pnl-glow)" opacity="0.7" />
      <circle cx={lastX} cy={lastY} r={2.2} fill={color} />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   SemiGauge – Generic animated semicircular arc gauge
   Used by: Win Rate card, Capital at Risk card
   ───────────────────────────────────────────────────────────── */
function SemiGauge({ value = 0, maxValue = 100, color = '#10b981', hideValues = false, suffix = '%', label = null, gradId = 'sg-grad', filterId = 'sg-glow' }) {
  const animRef = useRef(null);
  // Clamp pct 0–100
  const pct = Math.min(100, Math.max(0, (value / maxValue) * 100));
  const [displayed, setDisplayed] = useState(pct);
  const prevPctRef = useRef(pct);

  useEffect(() => {
    const from = prevPctRef.current;
    const to = pct;
    prevPctRef.current = to;
    if (Math.abs(from - to) < 0.05) {
      setDisplayed(to);
      return;
    }
    let start = null;
    const duration = 300;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(from + (to - from) * eased);
      if (progress < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [pct]);

  const trackColor = 'var(--border-color, #e5e7eb)';
  const SIZE = 110;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 40;
  const STROKE = 7;
  const circumference = Math.PI * R;

  const fillLength = (displayed / 100) * circumference;
  const gapLength = circumference - fillLength;
  const arcPath = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
  const arcAngle = Math.PI - (displayed / 100) * Math.PI;
  const dotX = CX + R * Math.cos(arcAngle);
  const dotY = CY - R * Math.sin(arcAngle);

  // Displayed value in original units
  const displayedValue = (displayed / 100) * maxValue;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '2px', marginBottom: '-4px', userSelect: 'none' }}>
      <svg width={SIZE} height={SIZE / 2 + 16} viewBox={`0 0 ${SIZE} ${SIZE / 2 + 16}`} style={{ overflow: 'visible' }}>
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Track */}
        <path d={arcPath} fill="none" stroke={trackColor} strokeWidth={STROKE} strokeLinecap="round" />
        {/* Filled arc */}
        {displayed > 0.1 && (
          <path d={arcPath} fill="none" stroke={`url(#${gradId})`} strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={`${fillLength} ${gapLength + 1}`} style={{ transition: 'none' }} />
        )}
        {/* Center value */}
        <text x={CX} y={CY + 6} textAnchor="middle" fontSize="15" fontWeight="600" fontFamily="inherit" fill={color} letterSpacing="-0.02em">
          {hideValues ? '••' : `${displayedValue.toFixed(displayedValue < 10 ? 2 : 1)}${suffix}`}
        </text>
      </svg>

    </div>
  );
}

// WinRateGauge — thin wrapper around SemiGauge for backward compat
function WinRateGauge({ winRate = 0, plMethod = 'PL', hideValues = false }) {
  const color = plMethod === 'RR' ? '#2563eb' : '#10b981';
  return <SemiGauge value={winRate} maxValue={100} color={color} hideValues={hideValues} suffix="%" gradId="wr-grad" filterId="wr-glow" />;
}

export default function StatCards({ metrics, hideValues, trades = [], settings = {}, onUpdateSetting }) {

  const [activePopover, setActivePopover] = useState(null); // 'totalTrades' | 'openPositions' | 'plMethod' | 'grossImpact' | 'unrealized' | 'risk' | 'invested' | 'monthlyMatrix'
  const [plMethod, setPlMethod] = useState('PL'); // 'PL' | 'RR'
  const [groupSymbols, setGroupSymbols] = useState(true);
  const [isDrawdownModalOpen, setIsDrawdownModalOpen] = useState(false);
  const [selectedPfMonth, setSelectedPfMonth] = useState('ALL MONTHS');
  const [selectedPfYear, setSelectedPfYear] = useState('ALL TIME');
  const [openPfDropdown, setOpenPfDropdown] = useState(null); // 'month' | 'year' | null
  const [investedSymbolIdx, setInvestedSymbolIdx] = useState(0);

  const ALL_MONTH_NAMES = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  const leaveTimerRef = useRef(null);

  const openPopover = (name) => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setActivePopover(name);
  };

  const closePopoverWithGrace = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
    }
    leaveTimerRef.current = setTimeout(() => {
      setActivePopover(null);
    }, 150);
  };

  const cancelClose = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  // Helper to check if a metric is enabled in Customize tab
  const isEnabled = (metricId) => {
    if (!settings?.dashboardMetrics || !Array.isArray(settings.dashboardMetrics)) {
      if (metricId === 'availableCash' || metricId === 'profitGiveback') return false;
      return true;
    }
    const item = settings.dashboardMetrics.find(m => m.id === metricId);
    return item ? item.enabled : true;
  };

  // Helper to get custom icon for a card
  const getCardIcon = (statId, fallbackKey = 'list') => {
    const iconKey = settings?.statIcons?.[statId] || fallbackKey;
    return ICON_COMPONENTS[iconKey] || ListChecks;
  };

  // Win rate calculation based on active method (strictly on fully closed trades)
  const calculatedWinRate = useMemo(() => {
    const eligibleTrades = (trades || []).filter(t => t.status === 'Closed');
    if (eligibleTrades.length === 0) return '0.00';

    if (plMethod === 'RR') {
      const rrTrades = eligibleTrades.filter(t => t.rewardRisk !== undefined && t.rewardRisk !== null && t.rewardRisk !== 0);
      if (rrTrades.length === 0) return '0.00';
      const rrWins = rrTrades.filter(t => (t.rewardRisk || 0) >= 1).length;
      return ((rrWins / rrTrades.length) * 100).toFixed(2);
    } else {
      const decidedTrades = eligibleTrades.filter(t => (t.pnl || 0) !== 0);
      if (decidedTrades.length === 0) return '0.00';
      const wins = decidedTrades.filter(t => (t.pnl || 0) > 0).length;
      return ((wins / decidedTrades.length) * 100).toFixed(2);
    }
  }, [trades, plMethod]);

  // Realized trades overlay list
  const realizedTradesForOverlay = useMemo(() => {
    const closed = (trades || []).filter(t => (t.status === 'Closed' || (t.status === 'Partial' && (parseFloat(t.pnl) || 0) !== 0)));
    
    if (groupSymbols) {
      const map = {};
      closed.forEach(t => {
        const sym = (t.name || t.symbol || 'OTHER').toUpperCase().trim();
        if (!map[sym]) {
          map[sym] = {
            symbol: sym,
            pnl: 0,
            pfImpact: 0,
            rrTotal: 0,
            rrCount: 0,
            tradeCount: 0
          };
        }
        map[sym].pnl += (t.pnl || 0);
        map[sym].pfImpact += (t.pfImpact || 0);
        map[sym].tradeCount += 1;
        if (t.rewardRisk !== undefined && t.rewardRisk !== null && t.rewardRisk !== '') {
          map[sym].rrTotal += Number(t.rewardRisk) || 0;
          map[sym].rrCount += 1;
        }
      });

      return Object.values(map)
        .map(item => ({
          symbol: item.symbol,
          pnl: item.pnl,
          pfImpact: item.pfImpact,
          rr: item.rrCount > 0 ? (item.rrTotal / item.rrCount).toFixed(1) : '1.0',
          tradeCount: item.tradeCount
        }))
        .sort((a, b) => b.pnl - a.pnl);
    } else {
      return closed
        .map(t => ({
          symbol: (t.name || t.symbol || 'TRADE').toUpperCase().trim(),
          pnl: t.pnl || 0,
          pfImpact: t.pfImpact || 0,
          rr: t.rewardRisk !== undefined && t.rewardRisk !== null && t.rewardRisk !== '' ? Number(t.rewardRisk).toFixed(1) : '1.0',
          tradeCount: 1
        }))
        .sort((a, b) => b.pnl - a.pnl);
    }
  }, [trades, groupSymbols]);

  const pfImpactTotal = useMemo(() => {
    return (trades || []).reduce((sum, t) => {
      if (t.status === 'Closed' || t.status === 'Partial') {
        return sum + (t.pfImpact || 0);
      }
      return sum;
    }, 0);
  }, [trades]);

  // Open trades list for popovers
  const openTradesList = useMemo(() => {
    const openTrades = (trades || []).filter(t => (t.status === 'Open' || t.status === 'Partial') && (parseFloat(t.openQty ?? t.qty ?? t.initialQty ?? t.initial_qty) || 0) > 0);
    return openTrades.map(t => {
      const sym = (t.name || t.symbol || 'TRADE').toUpperCase().trim();
      const isSell = (t.type || 'Buy').toLowerCase() === 'sell';
      const openQty = parseFloat(t.openQty ?? t.qty ?? t.initialQty ?? t.initial_qty) || 0;
      const initialEntry = parseFloat(t.entry) || 0;
      const avgEntry = parseFloat(t.avgEntry ?? t.entry) || 0;
      const cmp = parseFloat(t.cmp) || avgEntry;
      const sl = parseFloat(t.sl) || 0;
      const tsl = parseFloat(t.tsl) || 0;
      const unrealizedAmt = t.unrealized !== undefined && !isNaN(parseFloat(t.unrealized))
        ? parseFloat(t.unrealized)
        : (isSell ? (avgEntry - cmp) * openQty : (cmp - avgEntry) * openQty);
      const movePct = avgEntry > 0 ? (isSell ? ((avgEntry - cmp) / avgEntry) * 100 : ((cmp - avgEntry) / avgEntry) * 100) : 0;
      const isProfit = unrealizedAmt >= 0;
      const invested = openQty * avgEntry;

      return {
        id: t.id || `${sym}_${openQty}`,
        symbol: sym,
        type: (t.type || 'BUY').toUpperCase(),
        status: t.status,
        openQty,
        avgEntry,
        cmp,
        sl,
        tsl,
        unrealizedAmt,
        movePct,
        isProfit,
        invested
      };
    });
  }, [trades]);

  const totalInvestedInOpen = useMemo(() => {
    return openTradesList.reduce((sum, p) => sum + p.invested, 0);
  }, [openTradesList]);

  const openPositionsBreakdown = useMemo(() => {
    const pfCapital = metrics?.currentPfCapital || metrics?.portfolioCapital || getCapital({ trades });
    return openTradesList.map(t => ({
      id: t.id,
      symbol: t.symbol,
      openQty: t.openQty,
      avgEntry: t.avgEntry,
      cmp: t.cmp,
      amount: t.unrealizedAmt,
      percent: pfCapital > 0 ? (t.unrealizedAmt / pfCapital) * 100 : 0
    }));
  }, [openTradesList, metrics?.currentPfCapital, metrics?.portfolioCapital, trades]);

  // Available Cash
  const availableCashValue = useMemo(() => {
    const baseCap = metrics?.portfolioCapital || getCapital({ trades });
    const invested = (metrics?.totalInvested !== undefined) ? metrics.totalInvested : (totalInvestedInOpen || 0);
    return Math.max(0, baseCap - invested);
  }, [metrics?.portfolioCapital, metrics?.totalInvested, totalInvestedInOpen, trades]);

  // Active open trade displayed in % INVESTED card header
  const activeInvestedTrade = useMemo(() => {
    if (openTradesList.length === 0) return null;
    return openTradesList[investedSymbolIdx % openTradesList.length];
  }, [openTradesList, investedSymbolIdx]);

  const activeTradeAllocationPct = useMemo(() => {
    if (!activeInvestedTrade) return '0.00';
    const pfCapital = metrics?.currentPfCapital || metrics?.portfolioCapital || getCapital({ trades });
    return pfCapital > 0 ? ((activeInvestedTrade.invested / pfCapital) * 100).toFixed(2) : '0.00';
  }, [activeInvestedTrade, metrics?.currentPfCapital, metrics?.portfolioCapital, trades]);

  // Available years from trades history
  const availableYears = useMemo(() => {
    const years = new Set(['2026', '2025', '2024']);
    (trades || []).forEach(t => {
      const dStr = t.e1Date || t.date || '';
      if (dStr) {
        const parts = dStr.split('-');
        if (parts.length === 3) {
          const y = parts[0].length === 4 ? parts[0] : parts[2];
          if (y && y.length === 4) years.add(y);
        }
      }
    });
    return ['ALL TIME', ...Array.from(years).sort((a, b) => b.localeCompare(a))];
  }, [trades]);

  // Dynamic Month-by-Month PF Impact Breakdown Calculation
  const monthlyBreakdownData = useMemo(() => {
    const baseCap = metrics?.portfolioCapital || metrics?.currentPfCapital || getCapital({ trades });
    const capitalChanges = selectedPfYear !== 'ALL TIME' ? getStoredCapitalChanges('portfolio-default', selectedPfYear) : {};
    const perfChain = selectedPfYear !== 'ALL TIME' ? calculateMonthlyPerformance(trades || [], capitalChanges, selectedPfYear) : null;

    return ALL_MONTH_NAMES.map((mName, mIdx) => {
      const monthTrades = (trades || []).filter(t => {
        const exitDate = t.e1Date || t.date || '';
        if (!exitDate) return false;
        const parts = exitDate.split('-');
        if (parts.length !== 3) return false;
        const yr = parts[0].length === 4 ? parts[0] : parts[2];
        const mo = parts[0].length === 4 ? parseInt(parts[1], 10) - 1 : parseInt(parts[1], 10) - 1;

        if (mo !== mIdx) return false;
        if (selectedPfYear !== 'ALL TIME' && yr !== selectedPfYear) return false;
        return true;
      });

      const grossPl = monthTrades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0);
      const taxes = monthTrades.reduce((sum, t) => sum + (parseFloat(t.taxes || t.charges || t.brokerage) || 0), 0);
      const netPl = grossPl - taxes;

      const monthStartingCap = (perfChain && perfChain[mIdx]?.startingCapital > 0)
        ? perfChain[mIdx].startingCapital
        : baseCap;

      const grossPf = monthStartingCap > 0 ? (grossPl / monthStartingCap) * 100 : 0;
      const netPf = monthStartingCap > 0 ? (netPl / monthStartingCap) * 100 : 0;
      const taxPct = grossPl > 0 && taxes > 0 ? (taxes / grossPl) * 100 : 0;

      return {
        monthName: mName,
        monthIdx: mIdx,
        grossPl,
        grossPf,
        taxes,
        netPl,
        netPf,
        taxPct,
        tradeCount: monthTrades.length
      };
    });
  }, [trades, selectedPfYear, metrics?.portfolioCapital, metrics?.currentPfCapital]);

  // Formatting helpers matching Lakhs and Crores requirements
  const formatValue = (val, prefix = '', suffix = '') => {
    if (hideValues) return '••••••';
    return `${prefix}${val}${suffix}`;
  };

  const formatRupee = (val) => {
    if (hideValues) return '••••••';
    return formatIndianRupee(val, { hideValues, compact: true });
  };

  const formatFullTooltip = (val) => formatFullIndianRupee(val, 2, hideValues);

  return (
    <div style={{
      padding: '0 24px 24px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      {/* Responsive Dynamic Grid: auto-fills all enabled stat cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
        gap: '14px'
      }}>

        {/* ── CARD 1: TOTAL TRADES ── */}
        {isEnabled('totalTrades') && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            borderRadius: '16px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100px',
            boxShadow: 'var(--shadow-card)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                TOTAL TRADES
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#3b82f6',
                  opacity: 0.85
                }}>
                  {React.createElement(getCardIcon('totalTrades', 'list'), { size: 15, color: '#3b82f6' })}
                </div>
                <div 
                  onMouseEnter={() => openPopover('totalTrades')}
                  onMouseLeave={closePopoverWithGrace}
                  style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <button
                    onMouseEnter={() => openPopover('totalTrades')}
                    aria-label="Total Trades Info"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                    <Info size={14} color="var(--text-muted)" />
                  </button>

                  {activePopover === 'totalTrades' && (
                    <div 
                      onMouseEnter={cancelClose}
                      onMouseLeave={closePopoverWithGrace}
                      style={{
                        position: 'absolute', top: 'calc(100% + 4px)', right: '0px',
                        backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)',
                        borderRadius: '10px', boxShadow: '0 10px 25px -4px rgba(0,0,0,0.14)',
                        padding: '8px 12px', zIndex: 100, width: '170px', fontSize: '10.5px',
                        animation: 'foxTooltipPop 0.14s ease-out'
                      }}>
                      {/* Invisible Hover Bridge */}
                      <div style={{ position: 'absolute', top: '-10px', left: 0, right: 0, height: '10px', background: 'transparent' }} />
                      {/* Upward Pointer Arrow */}
                      <div style={{ position: 'absolute', bottom: '100%', right: '4px', borderWidth: '4px', borderStyle: 'solid', borderColor: 'transparent transparent #e5e7eb transparent', zIndex: 1 }} />
                      <div style={{ position: 'absolute', bottom: 'calc(100% - 1px)', right: '4px', borderWidth: '4px', borderStyle: 'solid', borderColor: 'transparent transparent #ffffff transparent', zIndex: 2 }} />
                      <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Total number of recorded trades.</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
              {formatValue(metrics?.totalTrades ?? (trades || []).length)}
            </div>
          </div>
        )}

        {/* ── CARD 2: OPEN POSITIONS ── */}
        {isEnabled('openPositions') && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            borderRadius: '16px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100px',
            boxShadow: 'var(--shadow-card)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                OPEN POSITIONS
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-orange)',
                  opacity: 0.85
                }}>
                  {React.createElement(getCardIcon('openPositions', 'activity'), { size: 15, color: 'var(--accent-orange)' })}
                </div>
                <div 
                  onMouseEnter={() => openPopover('openPositions')}
                  onMouseLeave={closePopoverWithGrace}
                  style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <button
                    onMouseEnter={() => openPopover('openPositions')}
                    aria-label="Open Positions Info"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                    <Info size={14} color="var(--text-muted)" />
                  </button>

                  {activePopover === 'openPositions' && (
                    <div 
                      onMouseEnter={cancelClose}
                      onMouseLeave={closePopoverWithGrace}
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        right: '0px',
                        backgroundColor: 'var(--bg-surface, #ffffff)',
                        border: '1px solid var(--border-color, #e5e7eb)',
                        borderRadius: '12px',
                        boxShadow: '0 12px 28px -4px rgba(0,0,0,0.18)',
                        padding: '12px',
                        zIndex: 100,
                        width: '280px',
                        fontSize: '11px',
                        animation: 'foxTooltipPop 0.14s ease-out'
                      }}>
                      {/* Invisible Hover Bridge */}
                      <div style={{ position: 'absolute', top: '-10px', left: 0, right: 0, height: '10px', background: 'transparent' }} />
                      {/* Upward Pointer Arrow */}
                      <div style={{ position: 'absolute', bottom: '100%', right: '6px', borderWidth: '5px', borderStyle: 'solid', borderColor: 'transparent transparent #e5e7eb transparent', zIndex: 1 }} />
                      <div style={{ position: 'absolute', bottom: 'calc(100% - 1px)', right: '6px', borderWidth: '5px', borderStyle: 'solid', borderColor: 'transparent transparent #ffffff transparent', zIndex: 2 }} />

                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color, #f3f4f6)', paddingBottom: '6px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-primary, #111827)', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                          OPEN POSITIONS ({openTradesList.length})
                        </div>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: '#10b981', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1px 5px', borderRadius: '4px' }}>
                          Live Feed
                        </span>
                      </div>

                      {/* Positions List */}
                      {openTradesList.length === 0 ? (
                        <div style={{ color: 'var(--text-muted, #9ca3af)', textAlign: 'center', padding: '12px 0', fontSize: '11px' }}>
                          No open positions currently active.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                          {openTradesList.map(pos => (
                            <div 
                              key={pos.id}
                              style={{
                                padding: '8px',
                                borderRadius: '8px',
                                backgroundColor: 'var(--bg-primary, #f9fafb)',
                                border: '1px solid var(--border-color, #f3f4f6)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                              }}
                            >
                              {/* Row 1: Logo, Symbol, Qty, Status & Unrealized P/L */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <SymbolLogo symbol={pos.symbol} size={18} />
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
                                        {pos.symbol}
                                      </span>
                                      {pos.status === 'Partial' && (
                                        <span style={{ fontSize: '7.5px', fontWeight: 800, color: '#2563eb', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '2px', padding: '0px 3px' }}>
                                          PARTIAL
                                        </span>
                                      )}
                                    </div>
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted, #6b7280)', fontWeight: 600 }}>
                                      {pos.type} • {pos.openQty} QTY
                                    </span>
                                  </div>
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                  <div 
                                    title={formatFullTooltip(pos.unrealizedAmt)}
                                    style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'monospace', color: pos.isProfit ? '#10b981' : '#ef4444' }}
                                  >
                                    {hideValues ? '••••••' : formatIndianRupee(pos.unrealizedAmt, { showPositiveSign: true, compact: true })}
                                  </div>
                                  <div style={{ fontSize: '9px', fontWeight: 700, color: pos.isProfit ? '#10b981' : '#ef4444' }}>
                                    {pos.isProfit ? '↗ +' : '↘ '}{pos.movePct.toFixed(2)}%
                                  </div>
                                </div>
                              </div>

                              {/* Row 2: Micro Data Matrix (Avg Entry | CMP | Stop Loss) */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '8.5px',
                                color: 'var(--text-muted, #6b7280)',
                                borderTop: '1px dashed var(--border-color, #e5e7eb)',
                                paddingTop: '4px',
                                marginTop: '2px'
                              }}>
                                <div>
                                  <span>AVG: </span>
                                  <strong style={{ color: 'var(--text-primary, #111827)', fontFamily: 'monospace' }}>
                                    {hideValues ? '••••' : pos.avgEntry.toFixed(2)}
                                  </strong>
                                </div>
                                <div>
                                  <span>LTP: </span>
                                  <strong style={{ color: 'var(--text-primary, #111827)', fontFamily: 'monospace' }}>
                                    {hideValues ? '••••' : pos.cmp.toFixed(2)}
                                  </strong>
                                </div>
                                <div>
                                  <span>{pos.tsl > 0 ? 'TSL: ' : 'SL: '}</span>
                                  <strong style={{ color: pos.tsl > 0 ? '#ea580c' : '#ef4444', fontFamily: 'monospace' }}>
                                    {hideValues ? '••••' : (pos.tsl > 0 ? pos.tsl : pos.sl).toFixed(2)}
                                  </strong>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Footer summary */}
                      {openTradesList.length > 0 && (
                        <div style={{
                          marginTop: '8px',
                          borderTop: '1px solid var(--border-color, #f3f4f6)',
                          paddingTop: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '9.5px',
                          fontWeight: 700,
                          color: 'var(--text-muted, #6b7280)'
                        }}>
                          <span>Total Invested:</span>
                          <strong 
                            title={formatFullTooltip(totalInvestedInOpen)}
                            style={{ color: 'var(--text-primary, #111827)', fontFamily: 'monospace' }}
                          >
                            {formatRupee(totalInvestedInOpen)}
                          </strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-orange)', marginTop: '8px' }}>
              {formatValue(metrics?.openPositions ?? openTradesList.length)}
            </div>
          </div>
        )}

        {/* ── CARD 3: WIN RATE ── */}
        {isEnabled('winRate') && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            borderRadius: '16px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100px',
            boxShadow: 'var(--shadow-card)',
            position: 'relative',
            zIndex: activePopover === 'plMethod' ? 150 : 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                WIN RATE
              </span>

              {/* Toggle Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopover(prev => prev === 'plMethod' ? null : 'plMethod');
                }}
                title="Change win rate calculation method"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  border: plMethod === 'RR' ? '1px solid rgba(37, 99, 235, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                  backgroundColor: plMethod === 'RR' ? 'rgba(37, 99, 235, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                  color: plMethod === 'RR' ? '#2563eb' : '#059669',
                  fontSize: '10px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ whiteSpace: 'nowrap' }}>
                  {plMethod === 'RR' ? 'R:R Method' : 'P/L Method'}
                </span>
                {plMethod === 'RR' ? (
                  <ToggleRight size={14} color="#2563eb" />
                ) : (
                  <ToggleLeft size={14} color="#10b981" />
                )}
              </button>
            </div>

            {/* ── Animated Semicircular Gauge ── */}
            <WinRateGauge
              winRate={parseFloat(calculatedWinRate)}
              plMethod={plMethod}
              hideValues={hideValues}
            />

            {/* Popover Backdrop */}
            {activePopover === 'plMethod' && (
              <div 
                onClick={(e) => { e.stopPropagation(); setActivePopover(null); }}
                style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'transparent' }} 
              />
            )}

            {/* Win Rate Calculation Method Popover */}
            {activePopover === 'plMethod' && (
              <div 
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '48px',
                  left: '10px',
                  width: '290px',
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  borderRadius: '14px',
                  boxShadow: '0 12px 30px -5px rgba(0,0,0,0.18)',
                  padding: '14px 16px',
                  zIndex: 100,
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  animation: 'foxTooltipPop 0.14s ease-out'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px', color: 'var(--text-primary)' }}>
                  Win Rate Calculation Method
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Choose how win rate is calculated:
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* R:R Method Option */}
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlMethod('RR');
                      setActivePopover(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      borderRadius: '8px',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: plMethod === 'RR' ? '4px solid #2563eb' : '1.5px solid var(--border-color, #d1d5db)',
                      backgroundColor: '#ffffff',
                      marginTop: '2px',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '12px', color: plMethod === 'RR' ? '#2563eb' : 'var(--text-primary)' }}>
                        R:R Method
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.4' }}>
                        Uses effective R:R ratio: &gt;1R = Win, 1R = Breakeven, &lt;1R = Loss.<br />
                        Only trades with R:R data are considered
                      </div>
                    </div>
                  </button>

                  {/* P/L Method Option (Default) */}
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlMethod('PL');
                      setActivePopover(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      borderRadius: '8px',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: plMethod === 'PL' ? '4px solid #10b981' : '1.5px solid var(--border-color, #d1d5db)',
                      backgroundColor: '#ffffff',
                      marginTop: '2px',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '12px', color: plMethod === 'PL' ? '#10b981' : 'var(--text-primary)' }}>
                        P/L Method (Default)
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.4' }}>
                        Uses gross P/L: &gt;₹0 = Win, &lt;₹0 = Loss, ₹0 = Breakeven
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CARD 4: GROSS REALIZED P/L (Lakhs & Crores formatted) ── */}
        {isEnabled('realizedPnl') && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            borderRadius: '16px',
            padding: '18px 20px 0 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100px',
            boxShadow: 'var(--shadow-card)',
            position: 'relative',
            zIndex: activePopover === 'grossImpact' ? 150 : 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                GROSS REALIZED P/L
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '22px', height: '22px',
                  color: '#10b981', opacity: 0.85,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {React.createElement(getCardIcon('realizedPnl', 'rupee'), { size: 15, color: '#10b981' })}
                </div>
                <div 
                  onMouseEnter={() => openPopover('grossImpact')}
                  onMouseLeave={closePopoverWithGrace}
                  style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <button
                    onMouseEnter={() => openPopover('grossImpact')}
                    aria-label="View Gross PF Impact Breakdown"
                    title="View Gross PF Impact Breakdown"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                    <Info size={14} color="var(--text-muted)" />
                  </button>

                  {/* Scrollable Gross PF Impact Overlay Popover */}
                  {activePopover === 'grossImpact' && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      onWheel={(e) => e.stopPropagation()}
                      onMouseEnter={cancelClose}
                      onMouseLeave={closePopoverWithGrace}
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        right: '0px',
                        width: '270px',
                        backgroundColor: 'var(--bg-surface, #ffffff)',
                        border: '1px solid var(--border-color, #e5e7eb)',
                        borderRadius: '12px',
                        boxShadow: '0 12px 30px -4px rgba(0,0,0,0.16)',
                        zIndex: 100,
                        overflow: 'hidden',
                        fontSize: '11px',
                        color: 'var(--text-primary)',
                        animation: 'foxTooltipPop 0.14s ease-out'
                      }}
                    >
                      {/* Invisible Hover Bridge */}
                      <div style={{ position: 'absolute', top: '-10px', left: 0, right: 0, height: '10px', background: 'transparent' }} />
                      {/* Upward Pointer Arrow */}
                      <div style={{ position: 'absolute', bottom: '100%', right: '4px', borderWidth: '4px', borderStyle: 'solid', borderColor: 'transparent transparent #e5e7eb transparent', zIndex: 1 }} />
                      <div style={{ position: 'absolute', bottom: 'calc(100% - 1px)', right: '4px', borderWidth: '4px', borderStyle: 'solid', borderColor: 'transparent transparent #ffffff transparent', zIndex: 2 }} />

                      <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--border-color, #f3f4f6)', backgroundColor: 'var(--bg-surface, #ffffff)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-primary, #111827)', letterSpacing: '0.4px' }}>
                              GROSS PF IMPACT
                            </div>
                            <div style={{ fontSize: '9.5px', color: 'var(--text-muted, #71717a)', marginTop: '1px' }}>
                              Capital-weighted impact of realized trades.
                            </div>
                          </div>
                          <div style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '9999px',
                            backgroundColor: pfImpactTotal >= 0 ? '#ecfdf5' : '#fef2f2',
                            border: pfImpactTotal >= 0 ? '1px solid #a7f3d0' : '1px solid #fecaca',
                            color: pfImpactTotal >= 0 ? '#059669' : '#dc2626'
                          }}>
                            {pfImpactTotal >= 0 ? '+' : ''}{pfImpactTotal.toFixed(2)}%
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 12px',
                        backgroundColor: 'rgba(0, 0, 0, 0.02)',
                        borderBottom: '1px solid var(--border-color, #f3f4f6)',
                        fontSize: '9.5px',
                        fontWeight: 600,
                        color: 'var(--text-muted, #71717a)'
                      }}>
                        <span style={{ letterSpacing: '0.4px' }}>TOP REALIZED</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            checked={groupSymbols}
                            onChange={(e) => setGroupSymbols(e.target.checked)}
                            style={{ cursor: 'pointer', accentColor: '#2563eb', width: '11px', height: '11px' }}
                          />
                          <span>Group Symbols</span>
                        </label>
                      </div>

                      <div style={{
                        maxHeight: '120px',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        padding: '2px 0',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#d1d5db transparent'
                      }}>
                        {realizedTradesForOverlay.length === 0 ? (
                          <div style={{ padding: '12px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '10px' }}>
                            No realized trades found.
                          </div>
                        ) : (
                          realizedTradesForOverlay.map((t, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '4px 12px',
                                transition: 'background 0.12s ease',
                                cursor: 'default'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                <SymbolLogo symbol={t.symbol} size={18} />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <div style={{
                                      width: '5px',
                                      height: '5px',
                                      borderRadius: '2px',
                                      backgroundColor: t.pnl >= 0 ? '#10b981' : '#ef4444',
                                      flexShrink: 0
                                    }} />
                                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-primary, #111827)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {t.symbol}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: '9px', color: 'var(--text-muted, #9ca3af)', marginTop: '0px', marginLeft: '9px' }}>
                                    ({t.rr !== null ? `${t.rr}R` : '1.0R'}, {t.tradeCount} TRD)
                                  </div>
                                </div>
                              </div>

                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div 
                                  title={formatFullTooltip(t.pnl)}
                                  style={{ fontSize: '10.5px', fontWeight: 700, color: t.pnl >= 0 ? '#059669' : '#dc2626' }}
                                >
                                  {formatRupee(t.pnl)}
                                </div>
                                <div style={{ fontSize: '9px', fontWeight: 600, color: t.pfImpact >= 0 ? '#059669' : '#dc2626' }}>
                                  ({t.pfImpact >= 0 ? '+' : ''}{t.pfImpact.toFixed(2)}%)
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Value + Sparkline section */}
            <div style={{ position: 'relative', marginTop: '6px' }}>
              {/* P/L value overlaid on top-left of sparkline */}
              <div
                title={formatFullTooltip(metrics?.grossRealizedPL ?? 0)}
                style={{
                  position: 'absolute',
                  top: '0px',
                  left: '0px',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: (metrics?.grossRealizedPL ?? 0) >= 0 ? 'var(--color-green)' : '#ef4444',
                  zIndex: 2,
                  lineHeight: 1
                }}
              >
                {formatRupee(metrics?.grossRealizedPL ?? 0)}
              </div>
              {/* Sparkline — flush to card bottom */}
              <div style={{ marginTop: '26px' }}>
                <PnLSparkline trades={trades} />
              </div>
            </div>
          </div>
        )}

        {/* ── CARD 5: UNREALIZED P/L (Lakhs & Crores formatted) ── */}
        {isEnabled('unrealizedPnl') && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            borderRadius: '16px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100px',
            boxShadow: 'var(--shadow-card)',
            position: 'relative',
            zIndex: activePopover === 'unrealized' ? 150 : 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  UNREALIZED P/L
                </span>
                {settings?.liveCmpEnabled !== false ? (
                  <span
                    title="Live Market Quotes Active"
                    style={{
                      display: 'inline-block',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      animation: 'statLivePing 1.8s ease-in-out infinite',
                      cursor: 'help'
                    }}
                  />
                ) : (
                  <span
                    title="File Snapshot Quotes (Live CMP Disabled)"
                    style={{
                      display: 'inline-block',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--text-muted, #9ca3af)',
                      opacity: 0.5,
                      cursor: 'help'
                    }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '22px', height: '22px',
                  color: (metrics?.unrealizedPnl || 0) >= 0 ? '#10b981' : '#ef4444',
                  opacity: 0.85,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {React.createElement(getCardIcon('unrealizedPnl', 'trending-up'), { size: 15, color: (metrics?.unrealizedPnl || 0) >= 0 ? '#10b981' : '#ef4444' })}
                </div>
                <div 
                  onMouseEnter={() => openPopover('unrealized')}
                  onMouseLeave={closePopoverWithGrace}
                  style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <button
                    onMouseEnter={() => openPopover('unrealized')}
                    aria-label="Unrealized P/L info"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                    <Info size={14} color="var(--text-muted)" />
                  </button>

                  {/* Unrealized P/L Popover */}
                  {activePopover === 'unrealized' && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      onMouseEnter={cancelClose}
                      onMouseLeave={closePopoverWithGrace}
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        right: '0px',
                        width: openPositionsBreakdown.length === 0 ? '180px' : '260px',
                        backgroundColor: 'var(--bg-surface, #ffffff)',
                        border: '1px solid var(--border-color, #e5e7eb)',
                        borderRadius: '12px',
                        boxShadow: '0 12px 30px -4px rgba(0,0,0,0.16)',
                        padding: '10px 12px',
                        zIndex: 100,
                        fontSize: '11px',
                        color: 'var(--text-primary)',
                        animation: 'foxTooltipPop 0.14s ease-out'
                      }}
                    >
                      {/* Invisible Hover Bridge */}
                      <div style={{ position: 'absolute', top: '-10px', left: 0, right: 0, height: '10px', background: 'transparent' }} />
                      {/* Upward Pointer Arrow */}
                      <div style={{ position: 'absolute', bottom: '100%', right: '4px', borderWidth: '4px', borderStyle: 'solid', borderColor: 'transparent transparent #e5e7eb transparent', zIndex: 1 }} />
                      <div style={{ position: 'absolute', bottom: 'calc(100% - 1px)', right: '4px', borderWidth: '4px', borderStyle: 'solid', borderColor: 'transparent transparent #ffffff transparent', zIndex: 2 }} />

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ fontSize: '9.5px', color: 'var(--text-muted, #71717a)', lineHeight: '1.2' }}>
                          Running impact on portfolio capital
                        </div>
                        {onUpdateSetting && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateSetting('liveCmpEnabled', settings?.liveCmpEnabled === false ? true : false);
                            }}
                            title="Toggle between Live Market Quotes (Nexus default) and Imported File Snapshot Quotes"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '9.5px',
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: '5px',
                              border: '1px solid var(--border-color, #e5e7eb)',
                              backgroundColor: 'var(--bg-card, #f9fafb)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              transition: 'background-color 0.15s ease'
                            }}
                            onMouseDown={(e) => { e.currentTarget.style.backgroundColor = '#9ca3af'; }}
                            onMouseUp={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-card, #f9fafb)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-card, #f9fafb)'; }}
                          >
                            <Activity size={10} color={settings?.liveCmpEnabled !== false ? '#10b981' : 'var(--text-muted)'} />
                            {settings?.liveCmpEnabled !== false ? 'Live (Nexus)' : 'File CSV'}
                          </button>
                        )}
                      </div>
                      <div style={{ height: '1px', backgroundColor: 'var(--border-color, #f3f4f6)', marginBottom: '6px' }} />

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '130px', overflowY: 'auto' }}>
                        {openPositionsBreakdown.length === 0 ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: '10.5px', textAlign: 'center', padding: '6px 0' }}>
                            No unrealized P/L
                          </div>
                        ) : (
                          openPositionsBreakdown.map((item) => {
                            const isPositive = item.amount >= 0;
                            return (
                              <div
                                key={item.id || item.symbol}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '4px 6px',
                                  borderRadius: '6px',
                                  transition: 'background-color 0.15s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                  <SymbolLogo symbol={item.symbol} size={20} />
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                                      {item.symbol}
                                    </span>
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                      {item.openQty} @ {formatRupee(item.avgEntry)} • CMP {formatRupee(item.cmp)}
                                    </span>
                                  </div>
                                </div>

                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  <div 
                                    title={formatFullTooltip(item.amount)}
                                    style={{
                                      fontFamily: 'monospace',
                                      fontWeight: 700,
                                      fontSize: '11px',
                                      color: isPositive ? '#10b981' : '#ef4444'
                                    }}>
                                    {formatRupee(item.amount)}
                                  </div>
                                  <div style={{
                                    fontFamily: 'monospace',
                                    fontWeight: 600,
                                    fontSize: '9.5px',
                                    color: isPositive ? '#10b981' : '#ef4444',
                                    opacity: 0.8,
                                    marginTop: '1px'
                                  }}>
                                    ({isPositive ? '+' : ''}{item.percent.toFixed(2)}%)
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '8px' }}>
              <div 
                title={formatFullTooltip(metrics?.unrealizedPL ?? 0)}
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: (metrics?.unrealizedPL ?? 0) >= 0 ? 'var(--color-green)' : '#ef4444',
                  letterSpacing: '-0.02em',
                  lineHeight: '1.1'
                }}
              >
                {formatRupee(metrics?.unrealizedPL ?? 0)}
              </div>
              {metrics?.unrealizedPL !== 0 && (
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 450,
                  marginTop: '3px',
                  lineHeight: '1.5'
                }}>
                  ({metrics?.unrealizedPLPct}% of pf)
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CARD 6: CAPITAL AT RISK (Lakhs & Crores formatted) ── */}
        {isEnabled('capitalAtRisk') && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            borderRadius: '16px',
            padding: '18px 20px 14px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100px',
            boxShadow: 'var(--shadow-card)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                CAPITAL AT RISK
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '22px', height: '22px',
                  color: '#ef4444', opacity: 0.85,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {React.createElement(getCardIcon('capitalAtRisk', 'flame'), { size: 15, color: '#ef4444' })}
                </div>
                <div 
                  onMouseEnter={() => openPopover('risk')}
                  onMouseLeave={closePopoverWithGrace}
                  style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <button
                    onMouseEnter={() => openPopover('risk')}
                    aria-label="Capital at risk info"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                    <Info size={14} color="var(--text-muted)" />
                  </button>

                  {activePopover === 'risk' && (
                    <div 
                      onMouseEnter={cancelClose}
                      onMouseLeave={closePopoverWithGrace}
                      style={{
                        position: 'absolute', top: 'calc(100% + 4px)', right: '0px',
                        backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)',
                        borderRadius: '10px', boxShadow: '0 10px 25px -4px rgba(0,0,0,0.14)',
                        padding: '8px 12px', zIndex: 100, width: '170px', fontSize: '10.5px',
                        animation: 'foxTooltipPop 0.14s ease-out'
                      }}>
                      {/* Invisible Hover Bridge */}
                      <div style={{ position: 'absolute', top: '-10px', left: 0, right: 0, height: '10px', background: 'transparent' }} />
                      {/* Upward Pointer Arrow */}
                      <div style={{ position: 'absolute', bottom: '100%', right: '4px', borderWidth: '4px', borderStyle: 'solid', borderColor: 'transparent transparent #e5e7eb transparent', zIndex: 1 }} />
                      <div style={{ position: 'absolute', bottom: 'calc(100% - 1px)', right: '4px', borderWidth: '4px', borderStyle: 'solid', borderColor: 'transparent transparent #ffffff transparent', zIndex: 2 }} />
                      <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Portfolio total capital at risk from stops.</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Red semicircular gauge — 0 to 100% scale */}
            <SemiGauge
              value={parseFloat(metrics?.capitalAtRisk ?? 0)}
              maxValue={100}
              color="#ef4444"
              hideValues={hideValues}
              suffix="%"
              gradId="risk-grad"
              filterId="risk-glow"
            />
            {metrics?.totalRisk > 0 && (
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#ef4444', fontWeight: 500, marginTop: '2px', lineHeight: '1.5' }}>
                ({formatRupee(metrics.totalRisk)})
              </div>
            )}
          </div>
        )}

        {/* ── CARD 7: PROFIT RISK ── */}
        {isEnabled('profitRisk') && ((metrics?.openPositions || 0) > 0) && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            borderRadius: '16px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100px',
            boxShadow: 'var(--shadow-card)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                PROFIT RISK
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '22px', height: '22px',
                  color: '#ea580c', opacity: 0.85,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {React.createElement(getCardIcon('profitRisk', 'flame'), { size: 15, color: '#ea580c' })}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#ea580c', marginTop: '8px', lineHeight: '1.1' }}>
              {formatValue(metrics?.profitRisk ?? '111.63', '', '%')}
            </div>
          </div>
        )}

        {/* ── CARD 8: PROFIT PROTECTED (Lakhs & Crores formatted) ── */}
        {isEnabled('profitProtected') && ((metrics?.openPositions || 0) > 0) && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            borderRadius: '16px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100px',
            boxShadow: 'var(--shadow-card)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                PROFIT PROTECTED
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '22px', height: '22px',
                  color: '#10b981', opacity: 0.85,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {React.createElement(getCardIcon('profitProtected', 'shield'), { size: 15, color: '#10b981' })}
                </div>
              </div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <div 
                title={formatFullTooltip(metrics?.profitProtected ?? 345)}
                style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-green)', letterSpacing: '-0.02em', lineHeight: '1.1' }}
              >
                {formatRupee(metrics?.profitProtected ?? 345)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 450, marginTop: '3px', lineHeight: '1.5' }}>
                ({metrics?.profitProtectedPct ?? '2.68'}% of pf)
              </div>
            </div>
          </div>
        )}

        {/* ── CARD 9: % INVESTED ── */}
        {isEnabled('pctInvested') && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            borderRadius: '16px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100px',
            boxShadow: 'var(--shadow-card)',
            position: 'relative',
            zIndex: activePopover === 'invested' ? 160 : 1
          }}>
            {/* Header: Title Left, Clean Icon Right */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                % INVESTED
              </span>
              <div style={{
                width: '22px',
                height: '22px',
                color: '#ea580c',
                opacity: 0.85,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <PieChart size={15} color="#ea580c" />
              </div>
            </div>

            {/* Metrics: Percentage Main + Rupee Subtitle Below */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: (trades || []).length === 0 ? 'var(--text-muted, #71717a)' : 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: '1.1' }}>
                {(trades || []).length === 0 ? 'N/A' : formatValue(metrics?.percentInvested ?? '0.00', '', '%')}
              </div>
              {(trades || []).length > 0 && ((metrics?.totalInvested ?? totalInvestedInOpen) > 0) && (
                <div 
                  title={formatFullTooltip(metrics?.totalInvested ?? totalInvestedInOpen)}
                  style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 450, marginTop: '3px', lineHeight: '1.5' }}
                >
                  ({formatFullIndianRupee(metrics?.totalInvested ?? totalInvestedInOpen, 0, hideValues)})
                </div>
              )}
            </div>

            {/* Floating Right Edge (i) Button & Popover (Opening ABOVE) */}
            <div 
              onMouseEnter={() => openPopover('invested')}
              onMouseLeave={closePopoverWithGrace}
              style={{
                position: 'absolute',
                top: '50%',
                right: '-9px',
                transform: 'translateY(-50%)',
                zIndex: 10
              }}
            >
              <button
                onMouseEnter={(e) => {
                  openPopover('invested');
                  e.currentTarget.style.borderColor = 'var(--text-muted)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                aria-label="% Invested info"
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  color: 'var(--text-muted, #71717a)',
                  fontSize: '10px',
                  fontWeight: 500,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'all 0.15s ease'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
                  e.currentTarget.style.color = 'var(--text-muted, #71717a)';
                }}
              >
                i
              </button>

              {/* % INVESTED Popover Opening ABOVE Card with Downward Pointer Arrow */}
              {activePopover === 'invested' && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  onMouseEnter={cancelClose}
                  onMouseLeave={closePopoverWithGrace}
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 6px)',
                    right: '-4px',
                    width: '230px',
                    backgroundColor: 'var(--bg-surface, #ffffff)',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    borderRadius: '12px',
                    boxShadow: '0 12px 30px -4px rgba(0,0,0,0.16)',
                    padding: '10px 12px',
                    zIndex: 200,
                    fontSize: '10.5px',
                    color: 'var(--text-primary)',
                    animation: 'foxTooltipPop 0.14s ease-out'
                  }}
                >
                  {/* Invisible Hover Bridge */}
                  <div style={{ position: 'absolute', bottom: '-10px', left: 0, right: 0, height: '10px', background: 'transparent' }} />
                  {/* Downward Pointer Arrow */}
                  <div style={{ position: 'absolute', top: '100%', right: '8px', borderWidth: '4px', borderStyle: 'solid', borderColor: 'var(--border-color, #e5e7eb) transparent transparent transparent', zIndex: 1 }} />
                  <div style={{ position: 'absolute', top: 'calc(100% - 1px)', right: '8px', borderWidth: '4px', borderStyle: 'solid', borderColor: 'var(--bg-surface, #ffffff) transparent transparent transparent', zIndex: 2 }} />

                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                    CAPITAL ALLOCATION
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px', marginBottom: '8px' }}>
                    Total portfolio capital deployed.
                  </div>
                  <div style={{ height: '1px', backgroundColor: 'var(--border-color, #f3f4f6)', marginBottom: '8px' }} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Invested:</span>
                      <strong style={{ color: '#ea580c' }}>{formatFullIndianRupee(metrics?.totalInvested || totalInvestedInOpen, 0, hideValues)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Free Cash:</span>
                      <strong style={{ color: '#10b981' }}>{formatFullIndianRupee(availableCashValue, 0, hideValues)}</strong>
                    </div>
                  </div>

                  {openTradesList.length > 0 && (
                    <>
                      <div style={{ height: '1px', backgroundColor: 'var(--border-color, #f3f4f6)', margin: '8px 0 6px 0' }} />
                      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.3px' }}>
                        OPEN POSITIONS ({openTradesList.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '110px', overflowY: 'auto' }}>
                        {openTradesList.map(t => {
                          const pfCapital = metrics?.currentPfCapital || metrics?.portfolioCapital || 212880.89;
                          const allocPct = pfCapital > 0 ? ((t.invested / pfCapital) * 100).toFixed(2) : '0.00';
                          return (
                            <div
                              key={t.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '3px 4px',
                                borderRadius: '6px',
                                transition: 'background-color 0.12s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                <SymbolLogo symbol={t.symbol} size={16} />
                                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {t.symbol}
                                </span>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#ea580c' }}>
                                  {formatFullIndianRupee(t.invested, 0, hideValues)}
                                </div>
                                <div style={{ fontSize: '8.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                  ({allocPct}%)
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CARD 10: AVAILABLE CASH (Lakhs & Crores formatted) ── */}
        {isEnabled('availableCash') && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            borderRadius: '16px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100px',
            boxShadow: 'var(--shadow-card)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                AVAILABLE CASH
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '22px', height: '22px',
                  color: '#10b981', opacity: 0.85,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {React.createElement(getCardIcon('availableCash', 'rupee'), { size: 15, color: '#10b981' })}
                </div>
              </div>
            </div>
            <div 
              title={formatFullTooltip(availableCashValue)}
              style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px', lineHeight: '1.1' }}
            >
              {formatRupee(availableCashValue)}
            </div>
          </div>
        )}

        {/* ── CARD 11: GROSS PF IMPACT % (ALL-TIME) ── */}
        {isEnabled('pfImpact') && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            borderRadius: '16px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100px',
            boxShadow: 'var(--shadow-card)',
            position: 'relative',
            zIndex: activePopover === 'monthlyMatrix' ? 150 : 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                GROSS PF IMPACT % (ALL-TIME)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '22px', height: '22px',
                  color: '#10b981', opacity: 0.85,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {React.createElement(getCardIcon('pfImpact', 'list'), { size: 15, color: '#10b981' })}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePopover(prev => prev === 'monthlyMatrix' ? null : 'monthlyMatrix');
                  }}
                  title="Choose year and view monthly breakdown"
                  aria-label="Choose year and view monthly breakdown"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <Info size={14} color="var(--text-muted)" />
                </button>
              </div>
            </div>

            <div style={{ fontSize: '22px', fontWeight: 700, color: (metrics?.grossPFImpact ?? 0) >= 0 ? 'var(--color-green)' : '#ef4444', marginTop: '8px', lineHeight: '1.1' }}>
              {formatValue(metrics?.grossPFImpact ?? '0.00', '', '%')}
            </div>

            {/* Popover Backdrop */}
            {activePopover === 'monthlyMatrix' && (
              <div 
                onClick={(e) => { e.stopPropagation(); setActivePopover(null); setOpenPfDropdown(null); }}
                style={{ position: 'fixed', inset: 0, zIndex: 155, background: 'transparent' }} 
              />
            )}

            {/* Monthly Matrix Popover (PF IMPACT BREAKDOWN) opening BELOW */}
            {activePopover === 'monthlyMatrix' && (
              <div 
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: '0px',
                  width: '320px',
                  maxWidth: 'calc(100vw - 32px)',
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  borderRadius: '14px',
                  boxShadow: '0 16px 36px -4px rgba(0,0,0,0.20)',
                  zIndex: 160,
                  fontSize: '11px',
                  color: 'var(--text-primary)',
                  animation: 'foxTooltipPop 0.14s ease-out'
                }}
              >
                {/* Upward Pointer Arrow */}
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  right: '18px',
                  borderWidth: '5px',
                  borderStyle: 'solid',
                  borderColor: 'transparent transparent var(--border-color, #e5e7eb) transparent',
                  zIndex: 1
                }} />
                <div style={{
                  position: 'absolute',
                  bottom: 'calc(100% - 1px)',
                  right: '18px',
                  borderWidth: '5px',
                  borderStyle: 'solid',
                  borderColor: 'transparent transparent var(--bg-surface, #ffffff) transparent',
                  zIndex: 2
                }} />

                {/* Popover Header */}
                <div style={{
                  padding: '12px 14px 10px 14px',
                  borderBottom: '1px solid var(--border-color, #f3f4f6)',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  borderTopLeftRadius: '14px',
                  borderTopRightRadius: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: 'var(--text-primary, #111827)',
                        letterSpacing: '0.4px',
                        textTransform: 'uppercase'
                      }}>
                        PF IMPACT BREAKDOWN
                      </div>
                      <div style={{ fontSize: '9.5px', color: 'var(--text-muted, #6b7280)', marginTop: '2px' }}>
                        Allocation-weighted impact on capital.
                      </div>
                    </div>
                    <button
                      onClick={() => setActivePopover(null)}
                      aria-label="Close monthly breakdown"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center' }}>
                      <X size={14} />
                    </button>
                  </div>

                  {/* Filter Controls Row: Custom Modern Aesthetic Month & Timeframe Dropdowns */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', position: 'relative' }}>
                    {/* Modern Month Dropdown */}
                    <div style={{ position: 'relative', flex: 1 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenPfDropdown(prev => prev === 'month' ? null : 'month');
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          color: 'var(--text-primary, #111827)',
                          backgroundColor: 'var(--bg-primary, #f9fafb)',
                          border: '1px solid var(--border-color, #e5e7eb)',
                          borderRadius: '8px',
                          padding: '5px 8px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedPfMonth}
                        </span>
                        <ChevronDown
                          size={12}
                          color="var(--text-muted, #9ca3af)"
                          style={{
                            transform: openPfDropdown === 'month' ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.15s ease',
                            flexShrink: 0
                          }}
                        />
                      </button>

                      {/* Month Menu */}
                      {openPfDropdown === 'month' && (
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: '0px',
                            width: '160px',
                            backgroundColor: 'var(--bg-surface, #ffffff)',
                            border: '1px solid var(--border-color, #e5e7eb)',
                            borderRadius: '10px',
                            boxShadow: '0 12px 28px -4px rgba(0,0,0,0.18), 0 4px 10px -2px rgba(0,0,0,0.06)',
                            padding: '4px',
                            zIndex: 220,
                            maxHeight: '170px',
                            overflowY: 'auto',
                            scrollbarWidth: 'thin',
                            animation: 'foxTooltipPop 0.12s ease-out'
                          }}
                        >
                          {['ALL MONTHS', ...ALL_MONTH_NAMES].map(m => {
                            const isSelected = selectedPfMonth === m;
                            return (
                              <div
                                key={m}
                                onClick={() => {
                                  setSelectedPfMonth(m);
                                  setOpenPfDropdown(null);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  fontSize: '10px',
                                  fontWeight: isSelected ? 700 : 500,
                                  color: isSelected ? '#2563eb' : 'var(--text-primary, #1f2937)',
                                  backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                                  cursor: 'pointer',
                                  transition: 'background 0.12s ease'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <span>{m}</span>
                                {isSelected && <Check size={11} color="#2563eb" />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Modern Year Dropdown */}
                    <div style={{ position: 'relative', width: '95px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenPfDropdown(prev => prev === 'year' ? null : 'year');
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          color: 'var(--text-primary, #111827)',
                          backgroundColor: 'var(--bg-primary, #f9fafb)',
                          border: '1px solid var(--border-color, #e5e7eb)',
                          borderRadius: '8px',
                          padding: '5px 8px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedPfYear}
                        </span>
                        <ChevronDown
                          size={12}
                          color="var(--text-muted, #9ca3af)"
                          style={{
                            transform: openPfDropdown === 'year' ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.15s ease',
                            flexShrink: 0
                          }}
                        />
                      </button>

                      {/* Year Menu */}
                      {openPfDropdown === 'year' && (
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            right: '0px',
                            width: '110px',
                            backgroundColor: 'var(--bg-surface, #ffffff)',
                            border: '1px solid var(--border-color, #e5e7eb)',
                            borderRadius: '10px',
                            boxShadow: '0 12px 28px -4px rgba(0,0,0,0.18), 0 4px 10px -2px rgba(0,0,0,0.06)',
                            padding: '4px',
                            zIndex: 220,
                            maxHeight: '160px',
                            overflowY: 'auto',
                            scrollbarWidth: 'thin',
                            animation: 'foxTooltipPop 0.12s ease-out'
                          }}
                        >
                          {availableYears.map(yr => {
                            const isSelected = selectedPfYear === yr;
                            return (
                              <div
                                key={yr}
                                onClick={() => {
                                  setSelectedPfYear(yr);
                                  setOpenPfDropdown(null);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  fontSize: '10px',
                                  fontWeight: isSelected ? 700 : 500,
                                  color: isSelected ? '#2563eb' : 'var(--text-primary, #1f2937)',
                                  backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                                  cursor: 'pointer',
                                  transition: 'background 0.12s ease'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <span>{yr}</span>
                                {isSelected && <Check size={11} color="#2563eb" />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Scrollable Month List */}
                <div style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  padding: '10px 14px',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#d1d5db transparent'
                }}>
                  {monthlyBreakdownData
                    .filter(m => selectedPfMonth === 'ALL MONTHS' || m.monthName === selectedPfMonth)
                    .map((m, idx, arr) => (
                      <div
                        key={m.monthName}
                        style={{
                          paddingBottom: idx < arr.length - 1 ? '8px' : '2px',
                          marginBottom: idx < arr.length - 1 ? '8px' : '0px',
                          borderBottom: idx < arr.length - 1 ? '1px solid var(--border-color, #f3f4f6)' : 'none'
                        }}
                      >
                        {/* Month Header */}
                        <div style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: 'var(--text-muted, #71717a)',
                          letterSpacing: '0.4px',
                          marginBottom: '4px'
                        }}>
                          {m.monthName}
                        </div>

                        {/* 2-Column Matrix */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 14px', fontSize: '10.5px' }}>
                          {/* Left Column: Gross PF, Gross P/L, Taxes */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-muted, #71717a)' }}>Gross PF</span>
                              <span style={{ fontWeight: 700, color: m.grossPf >= 0 ? '#10b981' : '#ef4444' }}>
                                {m.grossPf.toFixed(2)}%
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-muted, #71717a)' }}>Gross P/L</span>
                              <span 
                                title={formatFullTooltip(m.grossPl)}
                                style={{ fontWeight: 700, color: m.grossPl >= 0 ? '#10b981' : '#ef4444' }}
                              >
                                {formatRupee(m.grossPl)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-muted, #71717a)' }}>Taxes</span>
                              <span style={{ fontWeight: 600, color: 'var(--text-muted, #71717a)' }}>
                                {formatRupee(m.taxes)}
                              </span>
                            </div>
                          </div>

                          {/* Right Column: Net PF, Net P/L, Tax % */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-muted, #71717a)' }}>Net PF</span>
                              <span style={{ fontWeight: 700, color: m.netPf >= 0 ? '#10b981' : '#ef4444' }}>
                                {m.netPf.toFixed(2)}%
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-muted, #71717a)' }}>Net P/L</span>
                              <span 
                                title={formatFullTooltip(m.netPl)}
                                style={{ fontWeight: 700, color: m.netPl >= 0 ? '#10b981' : '#ef4444' }}
                              >
                                {formatRupee(m.netPl)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-muted, #71717a)' }}>Tax %</span>
                              <span style={{ fontWeight: 600, color: m.taxPct > 0 ? '#ef4444' : 'var(--text-muted, #71717a)' }}>
                                {m.taxPct.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CARD 12: CURRENT DD (Realized) ── */}
        {isEnabled('currentDd') && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            borderRadius: '16px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100px',
            boxShadow: 'var(--shadow-card)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                title="Realized, net of charges. Closed and partial exits only. Unrealized P&L of open positions is not included. Open-position P&L uses the last entered prices and is shown before exit charges. This is a journal estimate, not a broker statement."
                style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.05em' }}
              >
                CURRENT DD (Realized)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '22px', height: '22px',
                  color: '#ef4444', opacity: 0.85,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {React.createElement(getCardIcon('currentDd', 'trending-down'), { size: 15, color: '#ef4444' })}
                </div>
                <button
                  onClick={() => setIsDrawdownModalOpen(true)}
                  title="Drawdown Breakdown — Realized, net of charges. Closed and partial exits only. Open-position P&L uses the last entered prices and is shown before exit charges. This is a journal estimate, not a broker statement."
                  aria-label="Click for Drawdown Breakdown"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <Info size={14} color="var(--text-muted)" />
                </button>
              </div>
            </div>

            <div style={{ marginTop: '8px' }}>
              {metrics?.currentDrawdown === null ? (
                <>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '-0.02em', lineHeight: '1.1' }}>
                    —
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 450, marginTop: '3px', lineHeight: '1.5' }}>
                    (Set starting capital)
                  </div>
                </>
              ) : (() => {
                const ddNum = Number(metrics?.currentDrawdown ?? 0);
                const v = Number(ddNum.toFixed(2));
                const text = v === 0 ? '0.00' : v.toFixed(2);
                const color = v === 0 ? 'var(--color-green, #10b981)' : '#ef4444';

                const live = metrics?.liveDdResult;
                let liveText = null;
                let liveColor = 'var(--text-muted)';
                let liveAmtFormatted = null;
                let oldestPriceFormatted = null;

                if (live) {
                  const liveV = Number(Number(live.livePct || 0).toFixed(2));
                  liveText = liveV === 0 ? '0.00' : liveV.toFixed(2);
                  if (live.isStale) {
                    liveColor = 'var(--text-muted)';
                  } else {
                    liveColor = liveV === 0 ? 'var(--color-green, #10b981)' : '#ef4444';
                  }
                  if (live.liveAmount && Math.abs(live.liveAmount) > 0) {
                    liveAmtFormatted = formatDrawdownAmount(Math.abs(live.liveAmount));
                  }
                  if (live.oldestCmpUpdatedAt) {
                    try {
                      const d = new Date(live.oldestCmpUpdatedAt);
                      oldestPriceFormatted = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } catch {}
                  }
                }

                const unpriced = Number(metrics?.unpricedOpenCount || 0);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* Row 1: Realized */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>Realized:</span>
                      <span style={{ fontSize: '18px', fontWeight: 700, color, letterSpacing: '-0.02em', lineHeight: '1.1' }}>
                        {formatValue(text, '', '%')}
                      </span>
                      {(trades || []).length > 0 && Number(metrics?.currentDrawdownAmount || 0) > 0 && (
                        <span 
                          title={`₹${formatDrawdownAmount(metrics.currentDrawdownAmount)}`}
                          style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 450 }}
                        >
                          (₹{formatDrawdownAmount(metrics.currentDrawdownAmount)})
                        </span>
                      )}
                    </div>

                    {/* Row 2: Live (incl. open P&L) - hidden if live is null */}
                    {live && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)', paddingTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>Live (incl. open P&L):</span>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: liveColor, letterSpacing: '-0.02em', lineHeight: '1.1' }}>
                            {formatValue(liveText, '', '%')}
                          </span>
                          {liveAmtFormatted && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 450 }}>
                              (₹{liveAmtFormatted})
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          {oldestPriceFormatted && <span>prices as of {oldestPriceFormatted}</span>}
                          {live.isStale && <span style={{ color: '#f59e0b', fontWeight: 500 }}>(stale prices)</span>}
                        </div>
                      </div>
                    )}

                    {/* Unpriced open positions alert */}
                    {unpriced > 0 && (
                      <div style={{ fontSize: '10px', color: '#f59e0b', lineHeight: 1.2 }}>
                        {unpriced} open {unpriced === 1 ? 'position has' : 'positions have'} no price and {unpriced === 1 ? 'is' : 'are'} excluded
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── CARD 13: PROFIT GIVEBACK (Pre-tax) ── */}
        {isEnabled('profitGiveback') && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            borderRadius: '16px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '100px',
            boxShadow: 'var(--shadow-card)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                PROFIT GIVEBACK (Pre-tax)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '22px', height: '22px',
                  color: '#ef4444', opacity: 0.85,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {React.createElement(getCardIcon('profitGiveback', 'trending-down'), { size: 15, color: '#ef4444' })}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#ef4444', marginTop: '8px' }}>
              {formatValue('0.00', '', '%')}
            </div>
          </div>
        )}
      </div>

      {/* Drawdown Breakdown Modal */}
      <DrawdownModal
        isOpen={isDrawdownModalOpen}
        onClose={() => setIsDrawdownModalOpen(false)}
        trades={trades}
        hideValues={hideValues}
        metrics={metrics}
      />
    </div>
  );
}
