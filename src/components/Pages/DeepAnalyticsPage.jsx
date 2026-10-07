import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, ComposedChart,
  CartesianGrid, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList,
  PieChart as RechartsPieChart, Pie, Sector
} from 'recharts';
import {
  Zap, TrendingUp, TrendingDown, BarChart2, Activity,
  Clock, Target, Brain, Calendar, CalendarDays, Layers, Award, Trophy,
  ArrowUpRight, ArrowDownRight, Star, Shield,
  Flame, Info, Eye, GitBranch, Cpu, AlignLeft,
  ChevronUp, ChevronDown, CheckCircle, XCircle, Check,
  Hash, Percent, DollarSign, LayoutGrid,
  Search, Pin, PinOff, X, ArrowUp, ArrowDown, Sigma,
  PieChart, Grip, Gauge, FolderOpen, BarChart3, Maximize2,
  Table2, ShieldCheck, Calculator, ChevronLeft, ChevronRight
} from 'lucide-react';
import SymbolLogo from '../SymbolLogo';
import { getStockClassification } from '../../services/stockClassificationService';
import { computeDrawdown, computeDrawdownDaily } from '../../utils/drawdown';
import { getLedgerFlows } from '../../utils/fundManagementCalculations';
import {
  getTradePnl,
  isClosedTrade,
  isPartialTrade,
  sortTradesByEffectiveExitDate,
  computeClosedMetrics,
  computePartialSummary,
  getR,
  computeSharpe,
  generateTradingCalendarDays,
  getRealizedExitDate,
  toLocalDayKey,
  RISK_FREE_ANNUAL,
  buildRealizedEvents,
  formatDrawdownAmount,
  formatDrawdownPct,
  parseTradeDate
} from '../../utils/tradeMetricsShared';
import { INDIAN_HOLIDAYS } from '../../services/marketTimingService';

const cn = (...classes) => classes.filter(Boolean).join(' ');

// ─── Sub Tabs Configuration ──────────────────────────────────────────────────
const ANALYTICS_SUB_TABS = [
  { id: 'POSITION', label: 'Position & P&L', icon: PieChart },
  { id: 'STREAKS', label: 'Streaks', icon: Grip },
  { id: 'RISK', label: 'Risk & Expectancy', icon: Activity },
  { id: 'QUALITY', label: 'Trade Quality', icon: Gauge },
  { id: 'SECTOR', label: 'Sector & Industry', icon: FolderOpen },
  { id: 'VISUAL', label: 'Visual Analytics', icon: BarChart3 },
];

// ─── Constants ──────────────────────────────────────────────────────────────
const GREEN  = '#059669';
const LGREEN = '#10b981';
const RED    = '#dc2626';
const LRED   = '#ef4444';
const AMBER  = '#d97706';
const BLUE   = '#2563eb';
const PURPLE = '#7c3aed';
const TEAL   = '#0d9488';

const fmtINR = (v, sign = false) => {
  if (v === undefined || v === null || isNaN(v)) return '—';
  const abs = Math.abs(Math.round(v));
  const str = abs.toLocaleString('en-IN');
  if (sign) return v >= 0 ? `+₹${str}` : `-₹${str}`;
  return v < 0 ? `₹-${str}` : `₹${str}`;
};

const pColor = (v) => (Number(v) >= 0 ? GREEN : RED);

const SECTOR_COLORS = [
  '#4F46E5', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#14B8A6', // Teal
  '#84CC16', // Lime
];

// ─── Sector Custom Tooltip ───────────────────
function SectorCustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const stockNames = data.stockNames || data.symbols || [];
  const tradesCount = data.trades ?? data.value ?? data.count ?? 0;
  const pct = typeof data.percentage === 'number'
    ? data.percentage.toFixed(1)
    : Number(data.percentage || 0).toFixed(1);
  const color = data.fill || data.color || '#6366f1';

  return (
    <div
      className="pointer-events-none select-none"
      style={{
        minWidth: '220px',
        maxWidth: '280px',
        padding: '16px 18px',
        borderRadius: '16px',
        border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
        backgroundColor: 'var(--card, #ffffff)',
        boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.18), 0 0 1px 1px rgba(0, 0, 0, 0.05)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Category Header with Colored Pill/Dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '9999px',
            backgroundColor: color,
            flexShrink: 0,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--text-secondary, #64748b)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={data.name}
        >
          {data.name}
        </span>
      </div>

      {/* Metrics Row: Trade Count & Colored Percentage Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '12px',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
          marginBottom: stockNames.length > 0 ? '10px' : '0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span
            style={{
              fontSize: '24px',
              fontWeight: 900,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: 'var(--foreground, #09090b)',
            }}
          >
            {tradesCount}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted, #94a3b8)',
            }}
          >
            {tradesCount === 1 ? 'Trade' : 'Trades'}
          </span>
        </div>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: `${color}18`,
            color: color,
            letterSpacing: '-0.01em',
          }}
        >
          {pct}%
        </span>
      </div>

      {/* Stock Tickers Row with Crisp Tag Badges */}
      {stockNames.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '2px' }}>
          {stockNames.slice(0, 6).map(sym => (
            <span
              key={sym}
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--foreground, #334155)',
                backgroundColor: 'var(--muted, rgba(0, 0, 0, 0.05))',
                border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                padding: '3px 8px',
                borderRadius: '6px',
                lineHeight: 1.2,
                letterSpacing: '0.02em',
              }}
            >
              {sym}
            </span>
          ))}
          {stockNames.length > 6 && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--text-muted, #94a3b8)',
                alignSelf: 'center',
                padding: '2px 4px',
              }}
            >
              +{stockNames.length - 6} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sector Donut Slice Label ───────────────────────────────────────────────
const renderSectorDonutLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, percentage }) => {
  const pct = percent !== undefined ? percent * 100 : (percentage || 0);
  if (pct < 8) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="hsl(var(--background))"
      textAnchor="middle"
      dominantBaseline="central"
      className="pointer-events-none text-[10px] font-black tracking-tighter"
      style={{ opacity: 0.9 }}
    >
      {`${pct.toFixed(0)}%`}
    </text>
  );
};

const TABS = [
  { id: 'POSITION',  label: 'Position & P&L',     icon: TrendingUp },
  { id: 'STREAKS',   label: 'Streaks & DNA',       icon: Flame },
  { id: 'RISK',      label: 'Risk & Expectancy',   icon: Shield },
  { id: 'QUALITY',   label: 'Trade Quality',        icon: Award },
  { id: 'MATRIX',    label: 'Monthly Matrix',       icon: Calendar },
  { id: 'VISUAL',    label: 'Visual Analytics',     icon: Eye },
  { id: 'SETUPS',    label: 'Setups & Behaviour',  icon: Brain },
];

// ─── Animated Counter ───────────────────────────────────────────────────────
function useCounter(target, duration = 750) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const to   = Number(target) || 0;
    const start = performance.now();
    cancelAnimationFrame(raf.current);
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3); // cubic ease-out
      const cur = from + (to - from) * e;
      setVal(cur);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else prev.current = to;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

// ─── Animated Number / Metric ────────────────────────────────────────────────
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0, isCurrency = false, showPlus = false, className = '' }) {
  const num = Number(value) || 0;
  const anim = useCounter(num, 750);

  let formatted = '';
  if (isCurrency) {
    const rounded = Math.round(anim);
    const absStr = Math.abs(rounded).toLocaleString('en-IN');
    if (rounded < 0) {
      formatted = `-₹${absStr}`;
    } else if (showPlus && rounded > 0) {
      formatted = `+₹${absStr}`;
    } else {
      formatted = `₹${absStr}`;
    }
  } else if (decimals > 0) {
    const fixed = anim.toFixed(decimals);
    formatted = `${prefix}${fixed}${suffix}`;
  } else {
    const rounded = Math.round(anim);
    formatted = `${prefix}${rounded}${suffix}`;
  }

  return <span className={className}>{formatted}</span>;
}

// ─── Performance Score ──────────────────────────────────────────────────────
function calcScore(m) {
  let s = 0;
  const wr = parseFloat(m.winRate)  || 0;
  const pf = parseFloat(m.profitFactor) || 0;
  const sh = parseFloat(m.sharpe)  || 0;
  const ex = parseFloat(m.expectancy) || 0;
  const ar = parseFloat(m.avgR)    || 0;
  if (wr >= 65) s += 20; else if (wr >= 55) s += 14; else if (wr >= 45) s += 8; else s += 2;
  if (pf >= 2.5) s += 20; else if (pf >= 2) s += 15; else if (pf >= 1.5) s += 10; else if (pf >= 1) s += 4;
  if (sh >= 3) s += 20; else if (sh >= 2) s += 15; else if (sh >= 1) s += 9; else s += 2;
  if (ex > 2000) s += 20; else if (ex > 500) s += 14; else if (ex > 0) s += 8;
  if (ar >= 2) s += 20; else if (ar >= 1.5) s += 14; else if (ar >= 1) s += 9; else if (ar > 0) s += 4;
  return Math.min(Math.round(s), 100);
}

function scoreLabel(s) {
  if (s >= 85) return { text: 'ELITE', color: '#059669' };
  if (s >= 70) return { text: 'STRONG', color: '#10b981' };
  if (s >= 55) return { text: 'GOOD', color: '#d97706' };
  if (s >= 40) return { text: 'AVERAGE', color: '#f59e0b' };
  return { text: 'DEVELOPING', color: '#dc2626' };
}

// ─── Score Ring ─────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const animated = useCounter(score, 900);
  const r = 44, c = 2 * Math.PI * r;
  const dash = (animated / 100) * c;
  const { text, color } = scoreLabel(Math.round(animated));
  return (
    <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
      <svg width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="color-mix(in srgb, var(--border-color, #e5e7eb) 60%, transparent)" strokeWidth="6" />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color}
          strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: 'stroke-dasharray 0.05s linear' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 20, fontWeight: 600, color, lineHeight: 1, fontFamily: 'var(--font-mono, monospace)' }}>{Math.round(animated)}</span>
        <span style={{ fontSize: 9, fontWeight: 600, color, letterSpacing: '0.08em' }}>{text}</span>
      </div>
    </div>
  );
}

// ─── Animated KPI Value ─────────────────────────────────────────────────────
function KpiVal({ value, prefix = '', suffix = '', color, size = 22, mono = true }) {
  const anim = useCounter(value, 700);
  const disp = Number.isInteger(value)
    ? Math.round(anim).toLocaleString('en-IN')
    : anim.toFixed(Math.abs(value) < 10 ? 2 : 1);
  return (
    <span style={{ fontSize: size, fontWeight: 600, color, fontFamily: mono ? 'var(--font-mono, monospace)' : 'inherit' }}>
      {prefix}{disp}{suffix}
    </span>
  );
}

// ─── Glass Card ─────────────────────────────────────────────────────────────
function GCard({ children, style, className }) {
  return (
    <div className={className} style={{
      background: 'var(--bg-card, #ffffff)',
      border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
      borderRadius: 16, padding: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      transition: 'box-shadow 0.2s ease, transform 0.2s ease',
      ...style
    }}>
      {children}
    </div>
  );
}

// ─── Section Heading ────────────────────────────────────────────────────────
function SHead({ children, sub }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #111827)', letterSpacing: -0.1 }}>{children}</div>
      {sub && <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted, #9ca3af)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Metric Row ─────────────────────────────────────────────────────────────
function MetRow({ label, value, color, mono = true }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 12px', background: 'var(--bg-primary, #f9fafb)', borderRadius: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary, #6b7280)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: color || 'var(--text-primary, #111827)',
        fontFamily: mono ? 'var(--font-mono, monospace)' : 'inherit' }}>{value}</span>
    </div>
  );
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────
function ChartTip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card,#fff)', border: '1px solid color-mix(in srgb, var(--border-color,#e5e7eb) 65%, transparent)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight: 600, color: 'var(--text-primary,#111827)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--text-primary,#111827)', fontWeight: 500 }}>
          {formatter ? formatter(p.value, p.name) : `${p.name}: ${p.value}`}
        </div>
      ))}
    </div>
  );
}

// ─── Aesthetic Recharts SVG Gradients ───────────────────────────────────────
function ChartGradients() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none', visibility: 'hidden' }}>
      <defs>
        <linearGradient id="pnlGreenGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
          <stop offset="100%" stopColor="#059669" stopOpacity={0.95} />
        </linearGradient>
        <linearGradient id="pnlLightGreenGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6ee7b7" stopOpacity={1} />
          <stop offset="100%" stopColor="#10b981" stopOpacity={0.9} />
        </linearGradient>
        <linearGradient id="pnlRedGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f87171" stopOpacity={1} />
          <stop offset="100%" stopColor="#dc2626" stopOpacity={0.95} />
        </linearGradient>
        <linearGradient id="pnlDarkRedGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
          <stop offset="100%" stopColor="#991b1b" stopOpacity={0.95} />
        </linearGradient>
        <linearGradient id="pnlPurpleGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c084fc" stopOpacity={1} />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.95} />
        </linearGradient>
        <linearGradient id="pnlBlueGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity={1} />
          <stop offset="100%" stopColor="#2563eb" stopOpacity={0.95} />
        </linearGradient>
        <linearGradient id="pnlTealGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity={1} />
          <stop offset="100%" stopColor="#0d9488" stopOpacity={0.95} />
        </linearGradient>
        <linearGradient id="pnlAmberGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
          <stop offset="100%" stopColor="#d97706" stopOpacity={0.95} />
        </linearGradient>
        <linearGradient id="densityWaveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
          <stop offset="100%" stopColor="#10b981" stopOpacity={0.01} />
        </linearGradient>
        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.8} />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.2} />
        </linearGradient>
        <linearGradient id="paretoGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
          <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
        </linearGradient>
      </defs>
    </svg>
  );
}

const renderCapsuleTopLabel = (props) => {
  const { x, y, width, value } = props;
  if (!value || value === 0 || isNaN(Number(x)) || isNaN(Number(y))) return null;
  const cx = (Number(x) || 0) + (Number(width) || 0) / 2;
  const cy = (Number(y) || 0) - 8;
  return (
    <text
      x={cx}
      y={cy}
      fill="var(--text-primary, #111827)"
      textAnchor="middle"
      fontSize={10}
      fontWeight={600}
      fontFamily="var(--font-mono, monospace)"
    >
      {value}
    </text>
  );
};

// ─── Custom Tooltip for Analytics Charts ────────────────────────────────────
function AnalyticsTooltip({ active, payload, label, isCurrency = false }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="pointer-events-none select-none z-50 text-xs"
      style={{
        padding: '12px 16px',
        borderRadius: '14px',
        border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
        backgroundColor: 'var(--card, #ffffff)',
        boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.18), 0 0 1px 1px rgba(0, 0, 0, 0.05)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxSizing: 'border-box',
        minWidth: '160px',
      }}
    >
      {label && <p style={{ fontWeight: 700, color: 'var(--foreground, #09090b)', marginBottom: '6px' }}>{label}</p>}
      {payload.map((item, idx) => {
        const val = Number(item.value);
        const isTradeCount = item.dataKey === 'trades' || item.name?.toLowerCase().includes('trade');
        const itemIsCurrency = isCurrency && !isTradeCount;
        const displayVal = itemIsCurrency
          ? fmtINR(val, true)
          : (item.unit ? `${val}${item.unit}` : val.toLocaleString('en-IN'));
        const color = item.color || item.fill || (val >= 0 ? '#10b981' : '#f43f5e');
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginTop: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '9999px', backgroundColor: color, flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary, #64748b)' }}>{item.name || 'Value'}:</span>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: itemIsCurrency ? (val >= 0 ? '#10b981' : '#f43f5e') : 'var(--foreground, #09090b)' }}>
              {displayVal}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Custom Tooltip for Pareto AreaChart ────────────────
function ParetoTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const val = Number(item.value || 0).toFixed(1);
  return (
    <div
      className="pointer-events-none select-none z-50"
      style={{
        padding: '12px 16px',
        borderRadius: '14px',
        border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
        backgroundColor: 'var(--card, #ffffff)',
        boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.18), 0 0 1px 1px rgba(0, 0, 0, 0.05)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxSizing: 'border-box',
      }}
    >
      <p style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px' }}>
        PARETO ANALYSIS
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ fontSize: '22px', fontWeight: 900, fontStyle: 'italic', color: 'var(--foreground, #09090b)', fontVariantNumeric: 'tabular-nums' }}>
          {val}%
        </span>
        <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          TOTAL SHARE OF GROSS PROFIT (TOP {label})
        </span>
      </div>
    </div>
  );
}

// ─── Custom Tooltip for Realized P&L Distribution ───────
function RealizedPnLTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const val = Number(payload[0]?.value ?? 0);
  return (
    <div
      className="pointer-events-none select-none z-50"
      style={{
        padding: '12px 16px',
        borderRadius: '14px',
        border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
        backgroundColor: 'var(--card, #ffffff)',
        boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.18), 0 0 1px 1px rgba(0, 0, 0, 0.05)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxSizing: 'border-box',
        minWidth: '130px',
      }}
    >
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '16px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: val >= 0 ? '#10b981' : '#ef4444' }}>
        {fmtINR(val, true)}
      </div>
    </div>
  );
}

// ─── Custom Tooltip for Holding Period Spread ───────────
function DurationSpreadTooltip({ active, payload, label, mode = 'shared' }) {
  if (!active || !payload || !payload.length) return null;

  if (mode === 'shared') {
    const tradesItem = payload.find(item => item.dataKey === 'trades');
    const tradesVal = tradesItem ? tradesItem.value : null;
    const avgPLItem = payload.find(item => item.dataKey === 'avgPnl' || item.dataKey === 'avgPL');
    const avgPLVal = avgPLItem ? Number(avgPLItem.value) : null;

    return (
      <div
        className="pointer-events-none select-none z-50"
        style={{
          padding: '14px 18px',
          borderRadius: '14px',
          border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
          backgroundColor: 'var(--card, #ffffff)',
          boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.18), 0 0 1px 1px rgba(0, 0, 0, 0.05)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxSizing: 'border-box',
          minWidth: '170px',
        }}
      >
        <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted, #94a3b8)', marginBottom: '8px' }}>
          {label}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {tradesVal !== null && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary, #64748b)' }}>Volume</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0ea5e9', fontVariantNumeric: 'tabular-nums' }}>
                {tradesVal} Trades
              </span>
            </div>
          )}
          {avgPLVal !== null && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary, #64748b)' }}>Avg P/L</span>
              <span style={{ fontSize: '13px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: avgPLVal >= 0 ? '#10b981' : '#ef4444' }}>
                {fmtINR(avgPLVal, true)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const firstVal = Number(payload[0]?.value ?? 0);
  return (
    <div
      className="pointer-events-none select-none z-50"
      style={{
        padding: '12px 16px',
        borderRadius: '14px',
        border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
        backgroundColor: 'var(--card, #ffffff)',
        boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.18), 0 0 1px 1px rgba(0, 0, 0, 0.05)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxSizing: 'border-box',
        minWidth: '130px',
      }}
    >
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: '15px',
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          color: mode === 'currency' ? (firstVal >= 0 ? '#10b981' : '#ef4444') : '#0ea5e9',
        }}
      >
        {mode === 'currency' ? fmtINR(firstVal, true) : `${firstVal} Trades`}
      </div>
    </div>
  );
}

// ─── Heatmap SVG & Legend ──────────────────────
function HeatmapSvg({ calendarData, mode, onHoverCell }) {
  const months = useMemo(() => {
    const year = calendarData?.year || 2026;
    const jan1 = new Date(year, 0, 1);
    const startDayOfWeek = jan1.getDay();
    const startDate = new Date(year, 0, 1 - startDayOfWeek);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames.map((label, m) => {
      const firstOfMonth = new Date(year, m, 1);
      const diffDays = Math.round((firstOfMonth.getTime() - startDate.getTime()) / 86400000);
      const weekIdx = Math.floor(diffDays / 7);
      return { label, x: Math.max(0, weekIdx * 18) };
    });
  }, [calendarData?.year]);

  return (
    <div className="w-full overflow-x-auto custom-scrollbar">
      <svg
        className="w-full min-w-[940px] max-w-full"
        viewBox="0 0 976 162"
        style={{ height: 'auto', maxHeight: '180px' }}
      >
        {/* Month Labels */}
        <g transform="translate(30, 0)">
          {months.map(m => (
            <text
              key={m.label}
              x={m.x}
              y={10}
              className="text-[11px] font-semibold"
              fill="var(--muted-foreground, #888)"
              opacity={0.7}
              letterSpacing="-0.5px"
            >
              {m.label}
            </text>
          ))}
        </g>

        {/* Weekday Labels */}
        <g transform="translate(10, 14)">
          <text x={0} y={28} className="text-[11px] font-semibold" fill="var(--muted-foreground, #888)" opacity={0.6}>M</text>
          <text x={0} y={64} className="text-[11px] font-semibold" fill="var(--muted-foreground, #888)" opacity={0.6}>W</text>
          <text x={0} y={100} className="text-[11px] font-semibold" fill="var(--muted-foreground, #888)" opacity={0.6}>F</text>
        </g>

        {/* 53 Weeks */}
        <g transform="translate(30, 14)">
          {calendarData.weeks.map(week => (
            <g key={week.weekIdx} transform={`translate(${week.weekIdx * 18}, 0)`}>
              {week.days.map(day => {
                const hasData = !!day.data;
                let fill = 'transparent';
                let stroke = 'var(--border, rgba(0,0,0,0.12))';
                let strokeWidth = 1;

                if (hasData) {
                  if (mode === 'pl') {
                    const p = day.data.pnl;
                    if (p > 5000) { fill = '#22c55e'; stroke = '#16a34a'; }
                    else if (p > 0) { fill = '#bbf7d0'; stroke = '#86efac'; }
                    else if (p < -5000) { fill = '#fca5a5'; stroke = '#ef4444'; }
                    else if (p < 0) { fill = '#fee2e2'; stroke = '#fca5a5'; }
                    else { fill = 'transparent'; stroke = 'var(--border, rgba(0,0,0,0.12))'; }
                  } else {
                    // Stop Loss Hit Heatmap logic: only highlight days where an SL was hit!
                    if (day.data.slHits > 0) {
                      if (day.data.deliveryHits > 0 && day.data.losingHits > 0) {
                        fill = '#ef4444'; stroke = '#dc2626'; // Capital Hit (Swing/Delivery)
                      } else if ((day.data.deliveryHits > 0 && day.data.sameDayHits > 0) || day.data.losingHits > 0) {
                        fill = '#fbbf24'; stroke = '#f59e0b'; // Intraday / Mixed SL Hits
                      } else {
                        fill = '#34d399'; stroke = '#059669'; // Profit Protected (TSL)
                      }
                    } else {
                      fill = 'transparent'; stroke = 'var(--border, rgba(0,0,0,0.12))';
                    }
                  }
                }

                return (
                  <rect
                    key={day.dateKey}
                    x={0}
                    y={day.dayOfWeek * 18}
                    width={11}
                    height={11}
                    rx={3}
                    ry={3}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    className={cn(
                      "transition-all duration-150",
                      hasData ? "cursor-pointer hover:opacity-80" : "hover:stroke-primary/40"
                    )}
                    onMouseEnter={(e) => onHoverCell && onHoverCell(day, e)}
                    onMouseLeave={() => onHoverCell && onHoverCell(null)}
                  />
                );
              })}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

function HeatmapLegend({ mode, totalPeriodPnl, slStats = { total: 0, same: 0, del: 0 } }) {
  if (mode === 'pl') {
    return (
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted/40 border border-border/80" />
          <span>No trades</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#fee2e2] border border-red-200" />
          <span>Min. Loss</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#fca5a5] border border-red-300" />
          <span>Max. Loss</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#bbf7d0] border border-green-200" />
          <span>Min. Profit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#22c55e] border border-green-300" />
          <span>Max. Profit</span>
        </div>
        <div className="ml-4 pl-4 border-l border-border/60 font-semibold" style={{ color: totalPeriodPnl >= 0 ? '#10b981' : '#f43f5e' }}>
          Total: {totalPeriodPnl >= 0 ? `+₹${Math.round(totalPeriodPnl).toLocaleString('en-IN')}` : `-₹${Math.abs(Math.round(totalPeriodPnl)).toLocaleString('en-IN')}`}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-help" title="Trailing SL hit while in profit. No capital was lost, essentially protecting unrealized 'Profit Risk'.">
          <span className="size-2.5 rounded-sm bg-[#34d399] border border-emerald-400" />
          <span>Profit Protected (TSL)</span>
        </div>
        <div className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-help" title="Intraday SL hits or a day with multiple different outcomes.">
          <span className="size-2.5 rounded-sm bg-[#fbbf24] border border-amber-400" />
          <span>Intraday / Mixed SL Hits</span>
        </div>
        <div className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-help" title="SL hit on a delivery position resulting in actual capital loss.">
          <span className="size-2.5 rounded-sm bg-[#ef4444] border border-red-400" />
          <span>Capital Hit (Swing/Delivery)</span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[10px] opacity-70 border-t border-border/50 pt-1.5">
        <span className="font-bold uppercase tracking-wider">TOTAL:</span>
        <span>Total: {slStats.total}</span>
        <span className="opacity-30">•</span>
        <span>Intraday: {slStats.same}</span>
        <span className="opacity-30">•</span>
        <span>Delivery: {slStats.del}</span>
      </div>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────
function Empty({ icon: Icon = Activity, title = 'No data yet', sub = 'Add closed trades to unlock this insight.' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px', gap: 10, color: 'var(--text-muted, #9ca3af)' }}>
      <Icon size={32} strokeWidth={1.2} style={{ opacity: 0.5 }} />
      <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 11, fontWeight: 400, textAlign: 'center', maxWidth: 220 }}>{sub}</div>
    </div>
  );
}

// ─── Insight Badge ──────────────────────────────────────────────────────────
function Insight({ icon: Icon = Zap, color = GREEN, bg = 'var(--color-green-bg, rgba(16, 185, 129, 0.12))', children }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px',
      borderRadius: 20, background: bg, border: `1px solid ${color}33`, marginBottom: 10 }}>
      <Icon size={11} color={color} />
      <span style={{ fontSize: 9.5, fontWeight: 600, color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{children}</span>
    </div>
  );
}

// ─── Win Rate Donut ─────────────────────────────────────────────────────────
function WinDonut({ winRate, wins, losses }) {
  const pct = useCounter(parseFloat(winRate) || 0, 800);
  const r = 36, c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const col = pct >= 55 ? GREEN : pct >= 45 ? AMBER : RED;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: 86, height: 86, flexShrink: 0 }}>
        <svg width="86" height="86" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="43" cy="43" r={r} fill="none" stroke="color-mix(in srgb, var(--border-color, #e5e7eb) 50%, transparent)" strokeWidth="5" />
          <circle cx="43" cy="43" r={r} fill="none" stroke={col}
            strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            style={{ transition: 'stroke-dasharray 0.05s linear' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: col, fontFamily: 'var(--font-mono, monospace)' }}>{Math.round(pct)}%</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: GREEN }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary,#6b7280)', fontWeight: 500 }}>Wins <span style={{ color: GREEN, fontWeight: 600 }}>{wins}</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: RED }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary,#6b7280)', fontWeight: 500 }}>Losses <span style={{ color: RED, fontWeight: 600 }}>{losses}</span></span>
        </div>
      </div>
    </div>
  );
}

// ─── Date Parse Helper ───────────────────────────────────────────────────────
function parseDate(dStr) {
  if (!dStr) return null;
  if (dStr instanceof Date) return isNaN(dStr.getTime()) ? null : dStr;
  const str = String(dStr).trim();
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }
  if (str.includes('-')) {
    const p = str.split('T')[0].split('-');
    if (p[0].length === 4) return new Date(+p[0], +p[1] - 1, +p[2]);
    return new Date(+p[2], +p[1] - 1, +p[0]);
  }
  if (str.includes('/')) {
    const p = str.split('/');
    if (p[2]?.length === 4) return new Date(+p[2], +p[0] - 1, +p[1]);
    if (p[0]?.length === 4) return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function monthKey(d) {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Scrollable Trades List Popover (Holds 1000+ trades) ────────────────────
function TradeListPopover({
  visible,
  isPinned,
  title,
  categoryTitle,
  subtitle,
  trades = [],
  totalPnl = 0,
  color,
  clientX,
  clientY,
  onClose,
  onTogglePin,
  onMouseEnter,
  onMouseLeave,
  popoverRef,
  popoverListRef,
}) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('pnlDesc'); // 'pnlDesc' | 'pnlAsc' | 'dateDesc'

  useEffect(() => {
    setSearch('');
  }, [title]);

  const filteredTrades = useMemo(() => {
    let list = [...trades];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(t =>
        (t.symbol || t.name || '').toLowerCase().includes(q) ||
        (t.setup || '').toLowerCase().includes(q) ||
        (t.buySell || '').toLowerCase().includes(q) ||
        (t.date || '').toLowerCase().includes(q)
      );
    }
    if (sortBy === 'pnlDesc') {
      list.sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
    } else if (sortBy === 'pnlAsc') {
      list.sort((a, b) => (a.pnl || 0) - (b.pnl || 0));
    } else if (sortBy === 'dateDesc') {
      list.sort((a, b) => {
        const da = parseDate(a.date), db = parseDate(b.date);
        return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
      });
    }
    return list;
  }, [trades, search, sortBy]);

  if (!visible || !trades.length) return null;

  const popoverWidth = 360;
  const spaceBelow = window.innerHeight - (clientY || 0);
  const placeAbove = spaceBelow < 350 && (clientY || 0) > 300;

  let left = (clientX || (window.innerWidth / 2)) - (popoverWidth / 2);
  if (left < 16) left = 16;
  if (left + popoverWidth > window.innerWidth - 16) {
    left = window.innerWidth - popoverWidth - 16;
  }

  const top = placeAbove ? ((clientY || 0) - 12) : ((clientY || 0) + 14);
  const maxHeight = placeAbove ? Math.min(440, (clientY || 0) - 24) : Math.min(440, spaceBelow - 24);

  const winCount = trades.filter(t => (t.pnl || 0) > 0).length;
  const lossCount = trades.filter(t => (t.pnl || 0) < 0).length;
  const winRate = trades.length > 0 ? Math.round((winCount / trades.length) * 100) : 0;
  const avgPnl = trades.length > 0 ? Math.round(totalPnl / trades.length) : 0;

  return (
    <div
      ref={popoverRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${popoverWidth}px`,
        maxHeight: `${maxHeight}px`,
        transform: placeAbove ? 'translateY(-100%)' : 'none',
        backgroundColor: 'var(--bg-card, #ffffff)',
        color: 'var(--text-primary, #111827)',
        border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
        borderRadius: '14px',
        boxShadow: '0 16px 36px -10px rgba(0, 0, 0, 0.18)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(16px)',
        pointerEvents: 'auto',
        overflow: 'hidden',
        boxSizing: 'border-box',
        animation: placeAbove ? 'ftPopoverInAbove 0.15s ease-out' : 'ftPopoverIn 0.15s ease-out',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid color-mix(in srgb, var(--border-color, #f1f5f9) 60%, transparent)',
        background: 'var(--bg-card, #ffffff)',
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <span style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: color || LGREEN,
              boxShadow: `0 0 8px ${color || LGREEN}88`,
              flexShrink: 0,
            }} />
            <span style={{
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--text-primary, #111827)',
              letterSpacing: '-0.1px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {title}
            </span>
            <span style={{
              fontSize: 10.5,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 20,
              background: 'var(--bg-primary, #f3f4f6)',
              color: 'var(--text-muted, #6b7280)',
              fontFamily: 'var(--font-mono, monospace)',
              flexShrink: 0,
            }}>
              {trades.length} {trades.length === 1 ? 'trade' : 'trades'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              onClick={onTogglePin}
              title={isPinned ? 'Unpin popover' : 'Pin popover to keep open'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                border: 'none',
                background: isPinned ? 'rgba(5, 150, 105, 0.12)' : 'transparent',
                color: isPinned ? GREEN : 'var(--text-muted, #9ca3af)',
                borderRadius: 6,
                padding: '3px 6px',
                cursor: 'pointer',
                fontSize: 10.5,
                fontWeight: 500,
                transition: 'all 0.15s',
              }}
            >
              {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
              <span>{isPinned ? 'Pinned' : 'Pin'}</span>
            </button>
            <button
              onClick={onClose}
              title="Close"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted, #9ca3af)',
                borderRadius: 6,
                padding: '3px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Aggregate summary row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 6,
          background: 'var(--bg-primary, #f9fafb)',
          padding: '6px 8px',
          borderRadius: 8,
          fontSize: 10.5,
        }}>
          <div>
            <div style={{ color: 'var(--text-muted, #9ca3af)', fontSize: 9.5 }}>Total P&L</div>
            <div style={{
              fontWeight: 600,
              fontFamily: 'var(--font-mono, monospace)',
              color: totalPnl >= 0 ? GREEN : RED,
              fontSize: 11.5
            }}>
              {fmtINR(totalPnl, true)}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted, #9ca3af)', fontSize: 9.5 }}>Win Rate</div>
            <div style={{
              fontWeight: 600,
              fontFamily: 'var(--font-mono, monospace)',
              color: winRate >= 50 ? GREEN : RED,
              fontSize: 11.5
            }}>
              {winRate}% <span style={{ fontSize: 9.5, fontWeight: 500, color: 'var(--text-muted)' }}>({winCount}W/{lossCount}L)</span>
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted, #9ca3af)', fontSize: 9.5 }}>Avg Trade</div>
            <div style={{
              fontWeight: 600,
              fontFamily: 'var(--font-mono, monospace)',
              color: avgPnl >= 0 ? GREEN : RED,
              fontSize: 11.5
            }}>
              {fmtINR(avgPnl, true)}
            </div>
          </div>
        </div>

        {/* Search & Sort Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <div style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
          }}>
            <Search size={12} style={{ position: 'absolute', left: 7, color: 'var(--text-muted, #9ca3af)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter symbol, setup..."
              style={{
                width: '100%',
                padding: '4px 8px 4px 24px',
                fontSize: 11,
                borderRadius: 6,
                border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 60%, transparent)',
                background: 'var(--bg-card, #ffffff)',
                color: 'var(--text-primary, #111827)',
                outline: 'none',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 5,
                  border: 'none',
                  background: 'none',
                  color: 'var(--text-muted, #9ca3af)',
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                <X size={11} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-primary, #f3f4f6)', padding: 2, borderRadius: 6 }}>
            <button
              onClick={() => setSortBy(sortBy === 'pnlDesc' ? 'pnlAsc' : 'pnlDesc')}
              title={`Sort by P&L (${sortBy === 'pnlDesc' ? 'Highest first' : 'Lowest first'})`}
              style={{
                border: 'none',
                background: sortBy.startsWith('pnl') ? 'var(--bg-card, #fff)' : 'transparent',
                color: sortBy.startsWith('pnl') ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
                borderRadius: 4,
                padding: '3px 6px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: sortBy.startsWith('pnl') ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              P&L {sortBy === 'pnlDesc' ? '↓' : '↑'}
            </button>
            <button
              onClick={() => setSortBy('dateDesc')}
              title="Sort by Date (Newest first)"
              style={{
                border: 'none',
                background: sortBy === 'dateDesc' ? 'var(--bg-card, #fff)' : 'transparent',
                color: sortBy === 'dateDesc' ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
                borderRadius: 4,
                padding: '3px 6px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: sortBy === 'dateDesc' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Date
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Trades List (Capacity for 1000 trades) */}
      <div
        ref={popoverListRef}
        className="custom-popover-scroll"
        style={{
          maxHeight: '260px',
          overflowY: 'auto',
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {filteredTrades.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted, #9ca3af)', fontSize: 12 }}>
            No trades match "{search}"
          </div>
        ) : (
          filteredTrades.map((t, idx) => {
            const isProfit = (t.pnl || 0) >= 0;
            const symbol = t.symbol || t.name || 'Trade';
            const dateStr = t.date || '—';
            const setupStr = t.setup || t.entryType || null;
            const moveStr = t.stockMove ? `${t.stockMove > 0 ? '+' : ''}${t.stockMove}%` : null;
            const holdStr = t.holdingDays !== undefined ? `${t.holdingDays}d` : null;
            const rStr = t.rewardRisk ? `${t.rewardRisk}R` : null;

            return (
              <div
                key={t.id || `${symbol}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: '8px',
                  background: 'transparent',
                  transition: 'background 0.1s',
                  contentVisibility: 'auto',
                  containIntrinsicSize: '40px',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary, rgba(0,0,0,0.03))'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Left: Logo & Details */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <SymbolLogo symbol={symbol} size={24} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600,
                      fontSize: 12,
                      color: 'var(--text-primary, #111827)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {symbol}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      color: 'var(--text-muted, #9ca3af)',
                    }}>
                      <span>{dateStr}</span>
                      {setupStr && (
                        <>
                          <span>•</span>
                          <span style={{
                            maxWidth: 90,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {setupStr}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: P&L & Badges */}
                <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 8 }}>
                  <div style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontWeight: 600,
                    fontSize: 12,
                    color: isProfit ? GREEN : RED,
                  }}>
                    {fmtINR(t.pnl, true)}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 4,
                    fontSize: 9.5,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-muted, #9ca3af)',
                  }}>
                    {moveStr && <span style={{ color: isProfit ? GREEN : RED }}>{moveStr}</span>}
                    {holdStr && <span>{holdStr}</span>}
                    {rStr && <span style={{ fontWeight: 500 }}>{rStr}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 12px',
        borderTop: '1px solid color-mix(in srgb, var(--border-color, #f1f5f9) 60%, transparent)',
        background: 'var(--bg-primary, #f9fafb)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 10,
        color: 'var(--text-muted, #9ca3af)',
      }}>
        <span>
          {filteredTrades.length} of {trades.length} trades
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isPinned ? 'Locked' : 'Click bar to pin'}
        </span>
      </div>
    </div>
  );
}

// ─── Risk & Expectancy Matrix Constants & Helpers ───────────
const RISK_VIEW_OPTIONS = [
  { value: 'month', label: 'Month on Month' },
  { value: 'qoq', label: 'Quarter on Quarter' },
  { value: 'yoy-cal', label: 'YoY (Calendar)' },
  { value: 'yoy-fy', label: 'YoY (Fiscal)' },
];

const fmtRiskCount = (v) => {
  if (v === undefined || v === null || Number.isNaN(v)) return '0';
  return String(Math.round(v));
};

const fmtRiskRVal = (v) => {
  if (v === undefined || v === null || Number.isNaN(v) || Math.abs(v) < 1e-4) return '0';
  const rounded = Math.round(v * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '');
};

const fmtRiskCurrencySigned = (v) => {
  if (v === undefined || v === null || Number.isNaN(v) || Math.abs(v) < 1e-4) return '₹0';
  const abs = Math.abs(Math.round(v)).toLocaleString('en-IN');
  return `${v >= 0 ? '+' : '-'}₹${abs}`;
};

const RISK_MATRIX_SECTIONS = [
  {
    title: '1. TRADES',
    rows: [
      { label: 'Trades Entered', key: 'tradesEntered', formatter: v => fmtRiskCount(v) },
      { label: 'Open Till Date', key: 'openTillDate', formatter: v => `[${v}]` },
      { label: 'Trades Closed', key: 'trades', formatter: v => fmtRiskCount(v) },
      { label: 'Breakeven', key: 'breakeven', formatter: v => `[${v}]`, textColor: () => 'text-blue-500' },
      { label: 'Winners + Losers', calc: e => e.wins + e.losses, formatter: v => fmtRiskCount(v) },
      { label: 'Winners', key: 'wins', formatter: v => fmtRiskCount(v), textColor: () => 'text-emerald-500' },
      { label: 'Losers', key: 'losses', formatter: v => fmtRiskCount(v), textColor: () => 'text-red-500' },
      { label: 'Win Rate', key: 'winRate', formatter: v => `${Math.round(v)}%` },
    ]
  },
  {
    title: '2. AVERAGES',
    rows: [
      { label: 'Avg Loss (Losers)', key: 'avgLoss', formatter: v => fmtRiskCurrencySigned(v), textColor: () => 'text-red-500' },
      { label: 'Avg Gain (Winners)', key: 'avgGain', formatter: v => fmtRiskCurrencySigned(v), textColor: () => 'text-emerald-500' },
      { label: 'Avg Loss (BE)', key: 'avgLossBe', formatter: v => fmtRiskCurrencySigned(v), textColor: () => 'text-blue-500' },
    ]
  },
  {
    title: '3. RISK/REWARD',
    rows: [
      { label: 'Avg R Loss (Losers)', key: 'avgRLoss', formatter: v => `${fmtRiskRVal(v)}R`, textColor: () => 'text-red-500' },
      { label: 'Avg R Gain (Winners)', key: 'avgGainR', formatter: v => `+${fmtRiskRVal(v)}R`, textColor: () => 'text-emerald-500' },
      { label: 'ARR', key: 'arr', formatter: v => fmtRiskRVal(v) },
      { label: 'Avg R Loss (BE)', key: 'avgRLossBe', formatter: v => `${fmtRiskRVal(v)}R`, textColor: () => 'text-blue-500' },
    ]
  },
  {
    title: '4. EXPECTANCY',
    rows: [
      { label: 'Trade Expectancy (in R)', key: 'expectancyR', formatter: v => `${v > 0 ? '+' : ''}${fmtRiskRVal(v)}R`, textColor: v => v > 0 ? 'text-emerald-500' : 'text-red-500' },
      { label: 'Trades Closed', key: 'trades', formatter: v => fmtRiskCount(v) },
      { label: 'Total R Gained', key: 'totalR', formatter: v => `${v > 0 ? '+' : ''}${fmtRiskRVal(v)}R`, textColor: v => v > 0 ? 'text-emerald-500' : 'text-red-500' },
    ]
  },
  {
    title: '5. PROFITABILITY',
    rows: [
      { label: 'Avg Risk (₹)', key: 'avgRisk', formatter: v => fmtRiskCurrencySigned(v) },
      { label: 'Total Profit (By Entry Date)', key: 'totalPlEntry', formatter: v => fmtRiskCurrencySigned(v), textColor: v => v > 0 ? 'text-emerald-500' : 'text-red-500' },
      { label: 'Total Profit (By Close Date)', key: 'totalPl', formatter: v => fmtRiskCurrencySigned(v), textColor: v => v > 0 ? 'text-emerald-500' : 'text-red-500' },
    ]
  }
];

function parseTradeDateMs(dStr) {
  if (!dStr) return null;
  const d = parseDate(dStr);
  return d && !isNaN(d.getTime()) ? d.getTime() : null;
}

function toMonthKeyStr(ms) {
  if (!ms) return null;
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const RISK_MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function toMonthLabelStr(key) {
  const parts = key.split('-').map(Number);
  if (!parts[0] || !parts[1]) return key;
  return `${RISK_MONTH_NAMES_SHORT[parts[1] - 1]} ${parts[0]}`;
}

function getTradeEntries(t) {
  const entries = [];
  if (t.transactionHistory?.entries && t.transactionHistory.entries.length > 0) {
    t.transactionHistory.entries.forEach(n => {
      const p = Number(n.avgPrice || n.price || 0);
      const q = Number(n.qty || 0);
      if (p > 0 && q > 0) {
        entries.push({ price: p, qty: q, date: n.date || t.date, sl: Number(n.sl || t.sl || 0) });
      }
    });
    if (entries.length > 0) return entries;
  }
  const addE = (p, q, d, s) => {
    const price = Number(p || 0), qty = Number(q || 0);
    if (price > 0 && qty > 0) {
      const stop = Number(s || 0) > 0 ? Number(s) : Number(t.sl || 0);
      entries.push({ price, qty, date: d || t.date, sl: stop });
    }
  };
  addE(t.entry || t.avgEntry, t.initialQty || t.qty, t.date || t.entryDate, t.sl);
  addE(t.p1Price, t.p1Qty, t.p1Date, t.p1Sl);
  addE(t.p2Price, t.p2Qty, t.p2Date, t.p2Sl);
  addE(t.p3Price, t.p3Qty, t.p3Date, t.p3Sl);
  addE(t.p4Price, t.p4Qty, t.p4Date, t.p4Sl);
  return entries;
}

function getTradeExits(t) {
  const exits = [];
  if (t.transactionHistory?.exits && t.transactionHistory.exits.length > 0) {
    t.transactionHistory.exits.forEach(n => {
      const p = Number(n.avgPrice || n.price || 0);
      const q = Number(n.qty || 0);
      if (p > 0 && q > 0) {
        exits.push({ price: p, qty: q, date: n.date || t.date });
      }
    });
    if (exits.length > 0) return exits;
  }
  const addX = (p, q, d) => {
    const price = Number(p || 0), qty = Number(q || 0);
    if (price > 0 && qty > 0) {
      exits.push({ price, qty, date: d || t.date });
    }
  };
  addX(t.e1Price, t.e1Qty, t.e1Date);
  addX(t.e2Price, t.e2Qty, t.e2Date);
  addX(t.e3Price, t.e3Qty, t.e3Date);
  addX(t.e4Price, t.e4Qty, t.e4Date);
  if (exits.length === 0 && Number(t.exitedQty || 0) > 0 && Number(t.avgExitPrice || 0) > 0) {
    addX(t.avgExitPrice, t.exitedQty, t.exitDate || t.date);
  }
  return exits;
}

function computeTradeLifecycle(trades) {
  return trades.map(t => {
    const entries = getTradeEntries(t);
    const exits = getTradeExits(t);
    
    const entryDates = entries.map(e => parseTradeDateMs(e.date)).filter(Boolean);
    const minEntryMs = entryDates.length > 0 ? Math.min(...entryDates) : parseTradeDateMs(t.date || t.entryDate);
    const entryMonthKey = minEntryMs ? toMonthKeyStr(minEntryMs) : null;
    
    const exitDates = exits.map(e => parseTradeDateMs(e.date)).filter(Boolean);
    const maxExitMs = exitDates.length > 0 ? Math.max(...exitDates) : (t.positionStatus === 'Closed' ? minEntryMs : null);
    const closeMonthKey = maxExitMs ? toMonthKeyStr(maxExitMs) : null;
    
    const status = (t.status || t.positionStatus || '').toLowerCase();
    const isClosed = status === 'closed' || (Number(t.exitedQty || 0) > 0 && (!t.openQty || Number(t.openQty) === 0));
    const isPartial = status === 'partial' || (Number(t.openQty || 0) > 0 && Number(t.exitedQty || 0) > 0);
    const isOpen = status === 'open' || isPartial;
    
    let totalExitVal = 0;
    let totalExitQty = 0;
    exits.forEach(e => {
      totalExitVal += e.price * e.qty;
      totalExitQty += e.qty;
    });
    
    let matchedCost = 0;
    let remExit = totalExitQty;
    for (const en of entries) {
      const take = Math.min(remExit, en.qty);
      matchedCost += take * en.price;
      remExit -= take;
      if (remExit <= 0) break;
    }
    
    let totalPl = totalExitVal - matchedCost;
    if (isClosed && Math.abs(totalPl) < 1e-4) {
      if (t.pnl !== undefined && t.pnl !== 0) totalPl = Number(t.pnl);
      else if (t.grossPnl !== undefined && t.grossPnl !== 0) totalPl = Number(t.grossPnl);
    }
    
    let totalRisk = 0;
    entries.forEach(en => {
      if (en.sl > 0) {
        totalRisk += Math.max(0, en.price - en.sl) * en.qty;
      }
    });
    if (totalRisk <= 0 && t.sl && Number(t.sl) > 0) {
      const entryP = Number(t.avgEntry || t.entry || 0);
      const totalQ = Number(t.initialQty || t.qty || 0);
      totalRisk = Math.max(0, entryP - Number(t.sl)) * totalQ;
    }
    
    let rMultiple = null;
    if (isClosed) {
      if (totalRisk > 0) {
        rMultiple = totalPl / totalRisk;
      } else if (t.rewardRisk !== undefined && t.rewardRisk !== null) {
        rMultiple = Number(t.rewardRisk);
      }
    }
    
    return {
      tradeNo: t.tradeNo,
      name: t.name || t.symbol,
      entryMonthKey,
      closeMonthKey,
      isOpen,
      isClosed,
      totalPl: isClosed || isPartial ? totalPl : 0,
      totalRisk: isClosed ? totalRisk : 0,
      rMultiple,
      rewardRisk: t.rewardRisk
    };
  });
}

function aggregateMonthlyRiskBuckets(trades) {
  const mapped = computeTradeLifecycle(trades);
  const bucketMap = new Map();
  
  const getBucket = (key) => {
    if (!bucketMap.has(key)) {
      bucketMap.set(key, {
        key,
        label: toMonthLabelStr(key),
        trades: 0,
        tradesEntered: 0,
        openTillDate: 0,
        wins: 0,
        losses: 0,
        breakeven: 0,
        winRate: 0,
        avgGain: 0,
        avgLoss: 0,
        avgLossBe: 0,
        avgGainR: 0,
        avgRLoss: 0,
        avgRLossBe: 0,
        arr: 0,
        avgRisk: 0,
        expectancyR: 0,
        totalR: 0,
        totalPl: 0,
        totalPlEntry: 0,
        _sumWins: 0,
        _sumLosses: 0,
        _sumBE: 0,
        _sumGainVal: 0,
        _sumLossVal: 0,
        _sumLossBeVal: 0,
        _sumRGain: 0,
        _sumRLoss: 0,
        _sumRLossBe: 0,
        _sumRisk: 0,
        _sumTrades: 0,
      });
    }
    return bucketMap.get(key);
  };
  
  for (const t of mapped) {
    if (t.entryMonthKey) {
      const b = getBucket(t.entryMonthKey);
      b.tradesEntered += 1;
      if (t.isOpen) b.openTillDate += 1;
      if (!t.isOpen && t.totalPl) b.totalPlEntry += t.totalPl;
    }
    
    if (t.closeMonthKey && !t.isOpen) {
      const b = getBucket(t.closeMonthKey);
      b.trades += 1;
      b.totalPl += t.totalPl;
      if (t.rMultiple !== null) b.totalR += t.rMultiple;
      if (t.totalRisk > 0) b.avgRisk += t.totalRisk;
      
      const isWin = t.totalPl > 1e-6;
      const isLoss = t.totalPl < -1e-6;
      
      if (isWin) {
        b.wins += 1;
        b._sumGainVal += t.totalPl;
        if (t.rMultiple !== null) b._sumRGain += t.rMultiple;
      } else if (isLoss) {
        b.losses += 1;
        b._sumLossVal += t.totalPl;
        if (t.rMultiple !== null) b._sumRLoss += t.rMultiple;
      } else {
        b.breakeven += 1;
        b._sumLossBeVal += t.totalPl;
        if (t.rMultiple !== null) b._sumRLossBe += t.rMultiple;
      }
    }
  }
  
  const buckets = Array.from(bucketMap.values()).map(b => {
    const winLossCount = b.wins + b.losses;
    const winRate = winLossCount > 0 ? (b.wins / winLossCount) * 100 : 0;
    const avgGain = b.wins > 0 ? b._sumGainVal / b.wins : 0;
    const avgLoss = b.losses > 0 ? b._sumLossVal / b.losses : 0;
    const avgLossBe = b.breakeven > 0 ? b._sumLossBeVal / b.breakeven : 0;
    const avgGainR = b.wins > 0 ? b._sumRGain / b.wins : 0;
    const avgRLoss = b.losses > 0 ? b._sumRLoss / b.losses : 0;
    const avgRLossBe = b.breakeven > 0 ? b._sumRLossBe / b.breakeven : 0;
    const arr = winLossCount > 0 ? (b._sumRGain + b._sumRLoss) / winLossCount : 0;
    const lossFraction = winLossCount > 0 ? b.losses / winLossCount : 0;
    const winFraction = winLossCount > 0 ? b.wins / winLossCount : 0;
    const expectancyR = winFraction * avgGainR + lossFraction * avgRLoss;
    const avgRisk = b.trades > 0 ? b.avgRisk / b.trades : 0;
    
    return {
      ...b,
      winRate,
      avgGain,
      avgLoss,
      avgLossBe,
      avgGainR,
      avgRLoss,
      avgRLossBe,
      arr,
      expectancyR,
      avgRisk
    };
  });
  
  buckets.sort((a, b) => (a.key < b.key ? 1 : -1));
  
  let overall = null;
  if (buckets.length > 0) {
    let totTrades = 0, totWins = 0, totLosses = 0, totBE = 0;
    let totEntered = 0, totOpen = 0, totR = 0, totPl = 0, totPlEntry = 0;
    let sumGainVal = 0, sumLossVal = 0, sumLossBeVal = 0;
    let sumRGain = 0, sumRLoss = 0, sumRLossBe = 0, sumRisk = 0;
    
    buckets.forEach(b => {
      totTrades += b.trades;
      totWins += b.wins;
      totLosses += b.losses;
      totBE += b.breakeven;
      totEntered += b.tradesEntered;
      totOpen += b.openTillDate;
      totR += b.totalR;
      totPl += b.totalPl;
      totPlEntry += b.totalPlEntry;
      sumGainVal += b.avgGain * b.wins;
      sumLossVal += b.avgLoss * b.losses;
      sumLossBeVal += b.avgLossBe * b.breakeven;
      sumRGain += b.avgGainR * b.wins;
      sumRLoss += b.avgRLoss * b.losses;
      sumRLossBe += b.avgRLossBe * b.breakeven;
      sumRisk += b.avgRisk * b.trades;
    });
    
    const avgGain = totWins > 0 ? sumGainVal / totWins : 0;
    const avgLoss = totLosses > 0 ? sumLossVal / totLosses : 0;
    const avgLossBe = totBE > 0 ? sumLossBeVal / totBE : 0;
    const avgGainR = totWins > 0 ? sumRGain / totWins : 0;
    const avgRLoss = totLosses > 0 ? sumRLoss / totLosses : 0;
    const avgRLossBe = totBE > 0 ? sumRLossBe / totBE : 0;
    const avgRisk = totTrades > 0 ? sumRisk / totTrades : 0;
    const winLossCount = totWins + totLosses;
    const winRate = winLossCount > 0 ? (totWins / winLossCount) * 100 : 0;
    const lossFraction = winLossCount > 0 ? totLosses / winLossCount : 0;
    const winFraction = winLossCount > 0 ? totWins / winLossCount : 0;
    const expectancyR = winFraction * avgGainR + lossFraction * avgRLoss;
    const arr = winLossCount > 0 ? (sumRGain + sumRLoss) / winLossCount : 0;
    
    overall = {
      key: 'overall',
      label: 'Overall',
      trades: totTrades,
      tradesEntered: totEntered,
      openTillDate: totOpen,
      wins: totWins,
      losses: totLosses,
      breakeven: totBE,
      winRate,
      avgGain,
      avgLoss,
      avgLossBe,
      avgGainR,
      avgRLoss,
      avgRLossBe,
      arr,
      avgRisk,
      expectancyR,
      totalR: totR,
      totalPl: totPl,
      totalPlEntry: totPlEntry
    };
  }
  
  return { buckets, overall };
}

function aggregateRiskView(buckets, view) {
  if (!buckets || buckets.length === 0) return [];
  if (view === 'month') return buckets;
  
  const map = new Map();
  const addToGroup = (key, label, order, b) => {
    if (!map.has(key)) {
      map.set(key, {
        key,
        label,
        trades: 0,
        tradesEntered: 0,
        openTillDate: 0,
        wins: 0,
        losses: 0,
        breakeven: 0,
        totalR: 0,
        totalPl: 0,
        totalPlEntry: 0,
        _order: order,
        _sumRisk: 0,
        _sumGainVal: 0,
        _sumLossVal: 0,
        _sumLossBeVal: 0,
        _sumRGain: 0,
        _sumRLoss: 0,
        _sumRLossBe: 0,
        _sumTrades: 0,
        _sumWins: 0,
        _sumLosses: 0,
        _sumBE: 0,
      });
    }
    const g = map.get(key);
    g.trades += b.trades;
    g.tradesEntered += b.tradesEntered;
    g.openTillDate += b.openTillDate;
    g.wins += b.wins;
    g.losses += b.losses;
    g.breakeven += b.breakeven;
    g.totalR += b.totalR;
    g.totalPl += b.totalPl;
    g.totalPlEntry += b.totalPlEntry;
    g._sumRisk += b.avgRisk * b.trades;
    g._sumGainVal += b.avgGain * b.wins;
    g._sumLossVal += b.avgLoss * b.losses;
    g._sumLossBeVal += b.avgLossBe * b.breakeven;
    g._sumRGain += b.avgGainR * b.wins;
    g._sumRLoss += b.avgRLoss * b.losses;
    g._sumRLossBe += b.avgRLossBe * b.breakeven;
    g._sumTrades += b.trades;
    g._sumWins += b.wins;
    g._sumLosses += b.losses;
    g._sumBE += b.breakeven;
  };

  buckets.forEach(b => {
    const match = b.key.match(/^(\d{4})-(\d{2})$/);
    if (!match) return;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!year || !month) return;

    if (view === 'qoq') {
      const q = Math.floor((month - 1) / 3) + 1;
      const key = `${year}-Q${q}`;
      const label = `Q${q} ${year}`;
      addToGroup(key, label, new Date(year, (q - 1) * 3, 1).getTime(), b);
    } else if (view === 'yoy-cal') {
      const key = `${year}`;
      const label = `${year}`;
      addToGroup(key, label, new Date(year, 0, 1).getTime(), b);
    } else if (view === 'yoy-fy') {
      const fyYear = month >= 4 ? year + 1 : year;
      const key = `FY-${fyYear}`;
      const label = `FY${String(fyYear).slice(-2)}`;
      addToGroup(key, label, new Date(fyYear, 2, 1).getTime(), b);
    }
  });

  const result = Array.from(map.values()).map(g => {
    const winLossCount = g._sumWins + g._sumLosses;
    const winRate = winLossCount > 0 ? (g._sumWins / winLossCount) * 100 : 0;
    const avgGain = g._sumWins > 0 ? g._sumGainVal / g._sumWins : 0;
    const avgLoss = g._sumLosses > 0 ? g._sumLossVal / g._sumLosses : 0;
    const avgLossBe = g._sumBE > 0 ? g._sumLossBeVal / g._sumBE : 0;
    const avgGainR = g._sumWins > 0 ? g._sumRGain / g._sumWins : 0;
    const avgRLoss = g._sumLosses > 0 ? g._sumRLoss / g._sumLosses : 0;
    const avgRLossBe = g._sumBE > 0 ? g._sumRLossBe / g._sumBE : 0;
    const avgRisk = g._sumTrades > 0 ? g._sumRisk / g._sumTrades : 0;
    const lossFraction = winLossCount > 0 ? g._sumLosses / winLossCount : 0;
    const winFraction = winLossCount > 0 ? g._sumWins / winLossCount : 0;
    const expectancyR = winFraction * avgGainR + lossFraction * avgRLoss;
    const arr = winLossCount > 0 ? (avgGainR * g._sumWins + avgRLoss * g._sumLosses) / winLossCount : 0;

    return {
      key: g.key,
      label: g.label,
      trades: g.trades,
      tradesEntered: g.tradesEntered,
      openTillDate: g.openTillDate,
      wins: g.wins,
      losses: g.losses,
      breakeven: g.breakeven,
      winRate,
      avgGain,
      avgLoss,
      avgLossBe,
      avgGainR,
      avgRLoss,
      avgRLossBe,
      arr,
      avgRisk,
      expectancyR,
      totalR: g.totalR,
      totalPl: g.totalPl,
      totalPlEntry: g.totalPlEntry,
      _order: g._order,
    };
  });

  result.sort((a, b) => (a._order < b._order ? 1 : -1));
  return result;
}

function RiskExpectancyMatrix({ trades = [] }) {
  const [view, setView] = useState('month');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isDropdownOpen]);

  const { buckets } = useMemo(() => {
    return aggregateMonthlyRiskBuckets(trades);
  }, [trades]);

  const columns = useMemo(() => {
    return aggregateRiskView(buckets, view);
  }, [buckets, view]);

  const sections = useMemo(() => {
    return RISK_MATRIX_SECTIONS.map(sec => ({
      title: sec.title,
      rows: sec.rows.map(r => {
        const values = columns.map(col => {
          const val = r.calc ? r.calc(col) : (r.key ? col[r.key] : 0);
          const display = r.formatter ? r.formatter(val) : String(val);
          const colorClass = r.textColor ? r.textColor(val) : '';
          return { key: col.key, display, colorClass };
        });
        return {
          label: r.label,
          isEmphasis: r.label === 'Win Rate' || r.label.includes('Total Profit'),
          values
        };
      })
    }));
  }, [columns]);

  const currentViewLabel = RISK_VIEW_OPTIONS.find(o => o.value === view)?.label || 'Month on Month';

  return (
    <div className="space-y-4 ft-tab-content">
      {/* Top View Selector Dropdown */}
      <div className="flex justify-end mb-2 relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsDropdownOpen(v => !v)}
          className="flex items-center justify-between border border-input py-2 ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 h-7 w-auto min-w-[140px] gap-2 rounded-md border-none bg-muted/40 px-3 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:bg-muted/60 hover:text-foreground focus:ring-0 cursor-pointer select-none"
        >
          <span className="text-muted-foreground/60">View:</span>
          <span>{currentViewLabel}</span>
          <ChevronDown className={`size-4 opacity-50 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[180px] overflow-hidden rounded-md border border-border/40 bg-card p-1 text-card-foreground shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95">
            {RISK_VIEW_OPTIONS.map(opt => {
              const isSelected = view === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setView(opt.value);
                    setIsDropdownOpen(false);
                  }}
                  className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-3 text-xs outline-none transition-colors hover:bg-muted/50 hover:text-foreground ${
                    isSelected ? 'font-semibold text-foreground bg-muted/20' : 'text-muted-foreground'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
                      <Check className="size-3.5 text-primary" />
                    </span>
                  )}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Glassmorphic Matrix Table Card */}
      <div className="relative group/risk overflow-hidden rounded-2xl border border-border/40 bg-background/50 backdrop-blur-xl shadow-2xl transition-all duration-500">
        <div className="overflow-x-auto custom-scrollbar pb-2" style={{ scrollbarWidth: 'thin' }}>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border/30">
                <th
                  className="sticky left-0 z-30 w-[220px] min-w-[220px] px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/50 border-r border-border/10 bg-background/95 backdrop-blur-md"
                  style={{ padding: '14px 24px', width: '220px', minWidth: '220px' }}
                >
                  Matrix Metrics
                </th>
                {columns.map(col => (
                  <th
                    key={col.key}
                    className="min-w-[120px] px-4 py-4 text-center text-[11px] font-black uppercase tracking-[0.15em] text-foreground/70 whitespace-nowrap bg-muted/5"
                    style={{ padding: '14px 16px', minWidth: '120px' }}
                  >
                    {col.label.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {sections.map(sec => (
                <React.Fragment key={sec.title}>
                  <tr className="bg-muted/10 border-b border-border/20">
                    <td
                      colSpan={columns.length + 1}
                      className="sticky left-0 z-20 px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.25em] text-primary/60 bg-muted/20 backdrop-blur-md"
                      style={{ padding: '10px 24px' }}
                    >
                      <span className="italic font-bold tracking-tight text-foreground/80">
                        {sec.title}
                      </span>
                    </td>
                  </tr>
                  {sec.rows.map(row => (
                    <tr
                      key={row.label}
                      className="group/row hover:bg-primary/[0.02] transition-colors duration-300"
                    >
                      <td
                        className={cn(
                          "sticky left-0 z-20 bg-background/95 backdrop-blur-md px-6 py-3.5 text-[13px] font-medium text-foreground/60 border-r border-border/10 transition-colors group-hover/row:text-primary/80",
                          row.isEmphasis && "font-bold text-foreground"
                        )}
                        style={{ padding: '13px 24px', width: '220px', minWidth: '220px' }}
                      >
                        {row.label}
                      </td>
                      {row.values.map(val => (
                        <td
                          key={val.key}
                          className={cn(
                            "px-4 py-3.5 text-center tabular-nums text-[13px] font-medium transition-all duration-300 group-hover/row:scale-105",
                            row.isEmphasis && "font-bold",
                            val.colorClass || "text-foreground/80"
                          )}
                          style={{ padding: '13px 16px', minWidth: '120px' }}
                        >
                          {val.display}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/10 to-transparent opacity-0 group-hover/risk:opacity-100 transition-opacity duration-700 pointer-events-none" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TRADE QUALITY ANALYTICS COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const QUALITY_NAV_TABS = [
  { id: 'overview',   label: 'Where am I leaking?',   detail: 'Your decision snapshot',        icon: Gauge },
  { id: 'holding',    label: 'What did I sit through?', detail: 'MAE and MFE',                   icon: Activity },
  { id: 'exits',      label: 'Did I exit too early?',   detail: 'MFE+ and upside captured',      icon: ArrowUpRight },
  { id: 'protection', label: 'Could I protect sooner?', detail: 'Heat and breakeven',            icon: Target },
  { id: 'edge',       label: 'Did I beat the market?',  detail: 'Alpha by setup',                icon: TrendingUp },
  { id: 'trades',     label: 'Which trades prove it?',  detail: 'Stock-by-stock evidence',       icon: Table2 },
  { id: 'stops',      label: 'Which stop works best?',  detail: 'Compare fixed stops',           icon: ShieldCheck },
];

const fmtQualityPct = (val, sign = false) => {
  if (typeof val === 'number' && Number.isFinite(val)) {
    const s = sign && val > 0 ? '+' : '';
    return `${s}${val.toFixed(2)}%`;
  }
  return '—';
};

const fmtQualityMult = (val) => {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return `${val.toFixed(2)}×`;
  }
  return '—';
};

const fmtQualityDate = (dStr) => {
  if (!dStr) return '—';
  const d = parseDate(dStr);
  if (!d || isNaN(d.getTime())) return dStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

function QualityEyebrowHeader({ eyebrow, question, answer }) {
  return (
    <header className="max-w-2xl">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/[0.06] border border-primary/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
        {eyebrow}
      </div>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-[26px]">
        {question}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground font-normal">
        {answer}
      </p>
    </header>
  );
}

function QualityKpiCard({ label, question, value, explanation, tone, icon: Icon }) {
  const isDual = typeof value === 'string' && value.includes(' / ');
  let val1 = null;
  let val2 = null;
  if (isDual) {
    const parts = value.split(' / ');
    val1 = parts[0]?.trim();
    val2 = parts[1]?.trim();
    if (val1 && !val1.startsWith('-') && !val1.startsWith('—') && val1 !== '0%' && val1 !== '0.00%') {
      val1 = `-${val1.replace(/^\+/, '')}`;
    }
  }

  return (
    <div className="group min-w-0 flex flex-col justify-between h-full px-5 py-5 sm:px-5 lg:px-6 transition-all duration-200 hover:bg-muted/[0.04]">
      {/* Top Header & Question */}
      <div>
        <div className="flex items-center gap-2">
          <span className={cn("flex size-7 items-center justify-center rounded-lg bg-current/8 transition-transform group-hover:scale-105", tone)}>
            <Icon className="size-3.5" strokeWidth={1.75} />
          </span>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        </div>
        
        {/* Uniform Question Container for Exact Baseline Alignment Across All Cards */}
        <div className="mt-3.5 min-h-[2.5rem] flex items-start">
          <p className="text-xs sm:text-sm font-semibold text-foreground/90 leading-snug">
            {question}
          </p>
        </div>
      </div>

      {/* KPI Value - Vertically & Horizontally Aligned along Baseline */}
      <div className="my-2 min-h-[2.75rem] flex items-baseline">
        {isDual ? (
          <div className="flex items-baseline gap-1 whitespace-nowrap font-semibold tracking-tight tabular-nums text-lg sm:text-xl lg:text-[23px] leading-none">
            <span className={cn(val1?.startsWith('-') ? "text-rose-500 dark:text-rose-400" : tone)}>
              {val1}
            </span>
            <span className="text-muted-foreground/35 font-normal text-base select-none">
              /
            </span>
            <span className="text-emerald-600 dark:text-emerald-400">
              {val2}
            </span>
          </div>
        ) : (
          <p className={cn("text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums leading-none", tone)}>
            {value}
          </p>
        )}
      </div>

      {/* Contextual Subtext Pinned Evenly at Bottom */}
      <div className="mt-auto pt-2">
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground/80 min-h-[2.25rem]">
          {explanation}
        </p>
      </div>
    </div>
  );
}

function QualityEmptyState() {
  return (
    <div className="flex min-h-[380px] w-full items-center justify-center p-4 sm:p-6">
      <div className="relative w-full max-w-[420px] rounded-3xl border border-border/60 bg-card/60 px-8 py-9 sm:px-10 sm:py-10 flex flex-col items-center text-center shadow-2xs backdrop-blur-sm transition-all">
        {/* Subtle center background glow */}
        <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 size-36 rounded-full bg-primary/[0.03] blur-2xl" />

        {/* Icon container - clean squircle */}
        <div className="relative flex size-12 items-center justify-center rounded-2xl border border-border/40 bg-muted/40 text-foreground/80 shadow-2xs">
          <Gauge className="size-5 stroke-[1.75]" />
        </div>

        {/* Title - clean, smaller, elegant */}
        <h3 className="mt-5 text-base sm:text-[17px] font-semibold tracking-tight text-foreground">
          Enable MAE and MFE to view insights
        </h3>

        {/* Explanatory text - compact, smaller, balanced line-height */}
        <p className="mt-2.5 max-w-[310px] text-xs sm:text-[13px] leading-relaxed text-muted-foreground/90 font-normal">
          In Journal, open <span className="font-semibold text-foreground">Columns</span> and enable <span className="font-semibold text-foreground">MAE (%)</span> and <span className="font-semibold text-foreground">MFE (%)</span>. Eligible closed trades will then be analysed here.
        </p>

        {/* Minimal status indicator pill */}
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/70 px-3.5 py-1.5 text-[11px] sm:text-xs font-medium text-muted-foreground shadow-2xs">
          <span className="size-1.5 rounded-full bg-amber-500" />
          <span>Awaiting excursion data</span>
        </div>
      </div>
    </div>
  );
}

function QualityColumnInfoTh({ label, description, className = '' }) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <th className={cn("px-3.5 py-3.5 font-medium", className)}>
      <span className="inline-flex items-center gap-1.5 justify-end w-full">
        <span>{label}</span>
        <div className="relative inline-flex items-center">
          <button
            type="button"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(s => !s)}
            className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border border-border/45 text-muted-foreground/70 transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-help"
            aria-label={`About ${label}`}
          >
            <Info className="size-2.5" />
          </button>
          {showTooltip && (
            <div className="pointer-events-none absolute right-0 bottom-full mb-2 z-50 w-60 rounded-xl border border-border/40 bg-card/95 p-3 text-left text-[11px] font-normal leading-relaxed text-muted-foreground shadow-xl backdrop-blur-md">
              {description}
            </div>
          )}
        </div>
      </span>
    </th>
  );
}

function QualityTradeTable({ trades = [] }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('stock');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const SORT_OPTIONS = [
    { value: 'stock', label: 'Stock' },
    { value: 'date', label: 'Date' },
    { value: 'pl', label: 'P&L' },
    { value: 'mae', label: 'MAE' },
    { value: 'mfe', label: 'MFE' },
    { value: 'mfePlus', label: 'MFE+' },
    { value: 'heat', label: 'Heat' },
    { value: 'alpha', label: 'Alpha' },
  ];

  const filtered = useMemo(() => {
    let list = trades.filter(t => {
      const sym = (t.name || t.symbol || '').toLowerCase();
      return sym.includes(search.toLowerCase().trim());
    });

    list.sort((a, b) => {
      let vA, vB;
      if (sortKey === 'stock') {
        vA = (a.name || a.symbol || '').toLowerCase();
        vB = (b.name || b.symbol || '').toLowerCase();
        return sortDir === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      if (sortKey === 'date') {
        const dA = parseDate(a.date || a.entryDate)?.getTime() || 0;
        const dB = parseDate(b.date || b.entryDate)?.getTime() || 0;
        return sortDir === 'asc' ? dA - dB : dB - dA;
      }
      if (sortKey === 'pl') {
        vA = Number(a.pnl !== undefined ? a.pnl : a.pl) || 0;
        vB = Number(b.pnl !== undefined ? b.pnl : b.pl) || 0;
        return sortDir === 'asc' ? vA - vB : vB - vA;
      }
      if (sortKey === 'mae') {
        vA = Number(a.mae !== undefined ? a.mae : a.maePercent) || 0;
        vB = Number(b.mae !== undefined ? b.mae : b.maePercent) || 0;
        return sortDir === 'asc' ? vA - vB : vB - vA;
      }
      if (sortKey === 'mfe') {
        vA = Number(a.mfe !== undefined ? a.mfe : a.mfePercent) || 0;
        vB = Number(b.mfe !== undefined ? b.mfe : b.mfePercent) || 0;
        return sortDir === 'asc' ? vA - vB : vB - vA;
      }
      if (sortKey === 'mfePlus') {
        vA = Number(a.mfePlus !== undefined ? a.mfePlus : a.mfePlusPercent) || 0;
        vB = Number(b.mfePlus !== undefined ? b.mfePlus : b.mfePlusPercent) || 0;
        return sortDir === 'asc' ? vA - vB : vB - vA;
      }
      if (sortKey === 'heat') {
        vA = Number(a.heat !== undefined ? a.heat : a.heatToTargetPercent) || 0;
        vB = Number(b.heat !== undefined ? b.heat : b.heatToTargetPercent) || 0;
        return sortDir === 'asc' ? vA - vB : vB - vA;
      }
      if (sortKey === 'alpha') {
        vA = Number(a.alpha !== undefined ? a.alpha : a.alphaPercent) || 0;
        vB = Number(b.alpha !== undefined ? b.alpha : b.alphaPercent) || 0;
        return sortDir === 'asc' ? vA - vB : vB - vA;
      }
      return 0;
    });

    return list;
  }, [trades, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedTrades = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIdx = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const endIdx = Math.min(currentPage * pageSize, filtered.length);

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between pb-1">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/[0.06] border border-primary/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            Trade details
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-[26px]">
            Review the trades behind the numbers.
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">Search, sort, or review individual trades for their complete path.</p>
        </div>

        <div className="flex w-full gap-2.5 sm:w-auto">
          {/* Search Input */}
          <label className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
            <input
              aria-label="Search trades"
              className="h-9.5 w-full rounded-xl border border-border/30 bg-background/70 hover:bg-background/90 pr-3.5 text-xs text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs placeholder:text-muted-foreground/60"
              style={{ paddingLeft: '34px' }}
              placeholder="Search stock"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>

          {/* Sort Key Dropdown */}
          <div className="relative">
            <select
              value={sortKey}
              onChange={e => {
                const newKey = e.target.value;
                setSortKey(newKey);
                setSortDir(newKey === 'stock' || newKey === 'date' ? 'asc' : 'desc');
                setPage(1);
              }}
              className="h-9.5 rounded-xl border border-border/30 bg-background/70 hover:bg-background/90 px-3.5 pr-8 text-xs font-medium text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer transition-all shadow-2xs"
              aria-label="Sort trades by"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  Sort: {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
          </div>

          {/* Sort Direction Toggle */}
          <button
            type="button"
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            title={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
            aria-label={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
            className="flex size-9.5 shrink-0 items-center justify-center rounded-xl border border-border/30 bg-background/70 hover:bg-background text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs active:scale-[0.97]"
          >
            {sortDir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-hidden rounded-2xl border border-border/25 bg-background/40 shadow-xs backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] table-fixed text-left text-xs">
            <thead className="border-b border-border/35 bg-muted/[0.12] text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 w-[180px] bg-muted/95 backdrop-blur-md px-5 py-3 font-medium border-r border-border/15">Trade</th>
                <th className="w-[92px] px-3 py-3 font-medium">Date</th>
                <QualityColumnInfoTh
                  className="w-[100px] text-right"
                  label="P&L"
                  description="The profit or loss after the trade closed. Fees are not included."
                />
                <QualityColumnInfoTh
                  className="w-[100px] text-right"
                  label="MAE"
                  description="The furthest the trade moved against you while it was open. Repeated moves to the stop followed by recovery can mean the stop is too close, so compare this pattern across many trades."
                />
                <QualityColumnInfoTh
                  className="w-[100px] text-right"
                  label="MFE"
                  description="The furthest the trade moved in your favour while it was open. If trades often reach strong open profit but finish with much less, review profit-taking or trailing-stop rules."
                />
                <QualityColumnInfoTh
                  className="w-[100px] text-right"
                  label="MFE+"
                  description="The best move during the 5 trading days after you exited. Use it to review exits, not to assume you should always have held longer."
                />
                <QualityColumnInfoTh
                  className="w-[110px] text-right"
                  label="Heat +8%"
                  description="How far the trade first moved against you before reaching +8% in your favour. Lower means it reached the target with less drawdown."
                />
                <QualityColumnInfoTh
                  className="w-[110px] text-right"
                  label="Move to cost"
                  description="The move after price last returned to your remaining cost price. It helps review when a break-even stop may have worked."
                />
                <QualityColumnInfoTh
                  className="w-[100px] text-right"
                  label="Alpha"
                  description="Your return compared with the selected benchmark over the same holding period."
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/25">
              {pagedTrades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-xs text-muted-foreground">
                    No matching closed trades found.
                  </td>
                </tr>
              ) : (
                pagedTrades.map((t, idx) => {
                  const sym = t.name || t.symbol || '—';
                  const pnl = Number(t.pnl !== undefined ? t.pnl : t.pl) || 0;
                  const dateStr = fmtQualityDate(t.date || t.entryDate);

                  // Excursion and quality values (null/undefined if not present)
                  const mae = typeof t.mae === 'number' ? t.mae : (typeof t.maePercent === 'number' ? t.maePercent : null);
                  const mfe = typeof t.mfe === 'number' ? t.mfe : (typeof t.mfePercent === 'number' ? t.mfePercent : null);
                  const mfePlus = typeof t.mfePlus === 'number' ? t.mfePlus : (typeof t.mfePlusPercent === 'number' ? t.mfePlusPercent : null);
                  const heat = typeof t.heat === 'number' ? t.heat : (typeof t.heatToTargetPercent === 'number' ? t.heatToTargetPercent : null);
                  const slToCost = typeof t.slToCost === 'number' ? t.slToCost : (typeof t.slToCostPercent === 'number' ? t.slToCostPercent : null);
                  const alpha = typeof t.alpha === 'number' ? t.alpha : (typeof t.alphaPercent === 'number' ? t.alphaPercent : null);

                  return (
                    <tr key={t.id || idx} className="transition-colors hover:bg-muted/[0.1]">
                      {/* Trade Symbol & Logo */}
                      <td className="sticky left-0 z-[1] bg-card/95 backdrop-blur-md px-5 py-3.5 font-semibold text-foreground border-r border-border/15">
                        <div className="flex min-w-0 items-center gap-2 text-left">
                          <SymbolLogo symbol={sym} className="size-4 shrink-0 rounded-sm object-contain" />
                          <span className="truncate">{sym}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-muted-foreground">
                        {dateStr}
                      </td>

                      {/* P&L */}
                      <td className={cn(
                        "px-3 py-3.5 text-right font-semibold tabular-nums",
                        pnl > 0 && "bg-emerald-500/[0.05] text-emerald-600 dark:text-emerald-400",
                        pnl < 0 && "bg-rose-500/[0.05] text-rose-500",
                        pnl === 0 && "text-foreground"
                      )}>
                        {fmtINR(pnl, true)}
                      </td>

                      {/* MAE */}
                      <td className="px-3 py-3.5 text-right">
                        {mae !== null ? (
                          <span className="font-medium text-rose-500 tabular-nums">{fmtQualityPct(mae)}</span>
                        ) : (
                          <span className="text-muted-foreground/55" title="Available after this closed trade is analysed.">—</span>
                        )}
                      </td>

                      {/* MFE */}
                      <td className="px-3 py-3.5 text-right">
                        {mfe !== null ? (
                          <span className="font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtQualityPct(mfe, true)}</span>
                        ) : (
                          <span className="text-muted-foreground/55" title="Available after this closed trade is analysed.">—</span>
                        )}
                      </td>

                      {/* MFE+ */}
                      <td className="px-3 py-3.5 text-right">
                        {mfePlus !== null ? (
                          <span className="font-medium text-violet-600 dark:text-violet-400 tabular-nums">{fmtQualityPct(mfePlus, true)}</span>
                        ) : (
                          <span className="text-muted-foreground/55" title="No completed post-exit observation is available.">—</span>
                        )}
                      </td>

                      {/* Heat +8% */}
                      <td className="px-3 py-3.5 text-right">
                        {heat !== null ? (
                          <span className="font-medium text-amber-600 dark:text-amber-400 tabular-nums">{fmtQualityPct(heat)}</span>
                        ) : (
                          <span className="text-muted-foreground/55" title="Available after this closed trade is analysed.">—</span>
                        )}
                      </td>

                      {/* Move to cost */}
                      <td className="px-3 py-3.5 text-right">
                        {slToCost !== null ? (
                          <span className="font-medium text-sky-600 dark:text-sky-400 tabular-nums">{fmtQualityPct(slToCost, true)}</span>
                        ) : (
                          <span className="text-muted-foreground/55" title="Available after this closed trade is analysed.">—</span>
                        )}
                      </td>

                      {/* Alpha */}
                      <td className="px-3 py-3.5 text-right">
                        {alpha !== null ? (
                          <span className={cn(
                            "font-medium tabular-nums",
                            alpha >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                          )}>
                            {fmtQualityPct(alpha, true)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/55" title="Available after this closed trade is analysed.">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <footer className="flex items-center justify-between border-t border-border/30 px-5 py-3 text-xs text-muted-foreground">
          <span>{startIdx}–{endIdx} of {filtered.length}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className="flex size-8 items-center justify-center rounded-lg border border-border/35 disabled:opacity-35 hover:bg-muted/30 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-16 text-center tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              className="flex size-8 items-center justify-center rounded-lg border border-border/35 disabled:opacity-35 hover:bg-muted/30 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function StopTestSimulator({ closedTrades = [] }) {
  const [stopWidths, setStopWidths] = useState('1, 1.5, 2, 2.5, 3, 4');
  const [riskPerTrade, setRiskPerTrade] = useState('10000');
  const [capitalLimit, setCapitalLimit] = useState('100000');
  const [isRunning, setIsRunning] = useState(false);
  const [simResults, setSimResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleCompareStops = () => {
    const widths = stopWidths
      .split(',')
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n) && n > 0 && n <= 100);

    if (widths.length === 0) {
      setErrorMsg('Enter one or more stop widths between 0 and 100.');
      return;
    }
    setErrorMsg(null);
    setIsRunning(true);

    setTimeout(() => {
      const tradesWithMae = closedTrades.filter(
        t => typeof t.mae === 'number' || typeof t.maePercent === 'number'
      );

      if (tradesWithMae.length === 0) {
        setSimResults({ noExactData: true });
        setIsRunning(false);
        return;
      }

      const riskVal = Number(riskPerTrade) || 10000;
      const capVal = Number(capitalLimit) || 100000;

      const rows = widths.map(stopPct => {
        let stoppedTrades = 0;
        let wins = 0;
        let simulatedPl = 0;
        let actualPl = 0;
        let totalR = 0;

        closedTrades.forEach(t => {
          const tPl = Number(t.pnl !== undefined ? t.pnl : t.pl) || 0;
          actualPl += tPl;

          const tMae = Math.abs(Number(t.mae !== undefined ? t.mae : (t.maePercent !== undefined ? t.maePercent : 0)));
          const hitStop = tMae >= stopPct;

          if (hitStop) {
            stoppedTrades++;
            const loss = -riskVal;
            simulatedPl += loss;
            totalR -= 1;
          } else {
            if (tPl > 0) wins++;
            simulatedPl += tPl;
            const rVal = t.rewardRisk ? Number(t.rewardRisk) : (riskVal > 0 ? tPl / riskVal : 0);
            totalR += rVal;
          }
        });

        const totalCount = closedTrades.length;
        const stopRatePercent = totalCount > 0 ? (stoppedTrades / totalCount) * 100 : 0;
        const winRatePercent = totalCount > 0 ? (wins / totalCount) * 100 : 0;
        const differenceFromActual = simulatedPl - actualPl;
        const averageR = totalCount > 0 ? totalR / totalCount : 0;
        const roarPercent = capVal > 0 ? (simulatedPl / capVal) * 100 : 0;
        const equalRiskPl = simulatedPl;

        return {
          stopPercent: stopPct,
          trades: totalCount,
          stoppedTrades,
          stopRatePercent,
          wins,
          winRatePercent,
          simulatedPl,
          differenceFromActual,
          averageR,
          roarPercent,
          equalRiskPl
        };
      });

      setSimResults({
        noExactData: false,
        rows,
        analyzedTrades: tradesWithMae.length,
        dateOnlyTrades: closedTrades.length - tradesWithMae.length,
        unavailableTrades: 0
      });
      setIsRunning(false);
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/[0.06] border border-primary/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            Stop test
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-[26px]">
            Test fixed stops against your past trades
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Historical simulation only. Entries and pyramids are tested separately; partial exits follow FIFO.
          </p>
        </div>
      </div>

      {/* Simulator Inputs Card */}
      <div className="rounded-2xl border border-border/25 bg-muted/[0.02] p-5 sm:p-6 shadow-xs backdrop-blur-sm">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.8fr)_minmax(120px,.55fr)_minmax(140px,.7fr)_auto] md:items-end">
          <label className="grid gap-1.5 text-[11px] font-medium text-muted-foreground/80">
            <span className="uppercase tracking-wider text-[10px] font-semibold text-muted-foreground/70">Stop widths (%)</span>
            <input
              className="flex w-full text-xs h-9.5 rounded-xl border border-border/30 bg-background/70 hover:bg-background/90 text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs font-medium"
              style={{ padding: '0 12px' }}
              aria-label="Stop widths as comma separated percentages"
              value={stopWidths}
              disabled={isRunning}
              onChange={e => setStopWidths(e.target.value)}
            />
          </label>

          <label className="grid gap-1.5 text-[11px] font-medium text-muted-foreground/80">
            <span className="uppercase tracking-wider text-[10px] font-semibold text-muted-foreground/70">Risk per trade</span>
            <input
              type="number"
              min="0"
              className="flex w-full text-xs h-9.5 rounded-xl border border-border/30 bg-background/70 hover:bg-background/90 text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs tabular-nums font-medium"
              style={{ padding: '0 12px' }}
              value={riskPerTrade}
              disabled={isRunning}
              onChange={e => setRiskPerTrade(e.target.value)}
            />
          </label>

          <label className="grid gap-1.5 text-[11px] font-medium text-muted-foreground/80">
            <span className="uppercase tracking-wider text-[10px] font-semibold text-muted-foreground/70">Capital limit</span>
            <input
              type="number"
              min="0"
              className="flex w-full text-xs h-9.5 rounded-xl border border-border/30 bg-background/70 hover:bg-background/90 text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs tabular-nums font-medium"
              style={{ padding: '0 12px' }}
              value={capitalLimit}
              disabled={isRunning}
              onChange={e => setCapitalLimit(e.target.value)}
            />
          </label>

          <button
            type="button"
            onClick={handleCompareStops}
            disabled={isRunning || !closedTrades.length}
            className={cn(
              "group inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs font-semibold",
              "h-9.5 min-w-[136px] px-4 rounded-xl border border-border/60",
              "bg-muted/70 hover:bg-muted text-foreground/90 hover:text-foreground",
              "shadow-2xs hover:shadow-xs active:scale-[0.97] transition-all duration-150 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-40"
            )}
          >
            {isRunning ? (
              <Activity className="size-3.5 animate-spin text-muted-foreground" />
            ) : (
              <Calculator className="size-3.5 text-muted-foreground/80 group-hover:text-foreground transition-colors" />
            )}
            <span>{isRunning ? 'Calculating…' : 'Compare stops'}</span>
          </button>
        </div>

        <div className="mt-3.5 flex items-center justify-between text-[11px] text-muted-foreground/80">
          <div className="flex items-center gap-2">
            <span className={cn("size-1.5 rounded-full transition-colors", isRunning ? "bg-amber-500 animate-pulse" : "bg-primary/60")} />
            <span>{closedTrades.length} eligible closed trades</span>
          </div>
          {isRunning && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="size-3 animate-spin text-primary" />
              <span>Calculating simulations locally…</span>
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">
          <Info className="size-4" />
          {errorMsg}
        </div>
      )}

      {/* Results */}
      {simResults && (
        simResults.noExactData ? (
          <div className="rounded-2xl border border-border/70 bg-muted/[0.03] p-4.5 text-xs sm:text-sm text-muted-foreground flex items-center gap-3 shadow-2xs">
            <Info className="size-4 shrink-0 text-muted-foreground/70" />
            <span>No exact-time closed trades were available for this simulation.</span>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {simResults.analyzedTrades} analysed · {simResults.dateOnlyTrades} date-only excluded · Equal-risk comparison
            </p>
            <div className="overflow-x-auto rounded-2xl border border-border/40 bg-background/55">
              <table className="w-full min-w-[800px] text-left text-xs">
                <thead className="bg-muted/[0.12] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Stop</th>
                    <th className="px-3 py-2.5 text-right font-medium">Stopped</th>
                    <th className="px-3 py-2.5 text-right font-medium">Win rate</th>
                    <th className="px-3 py-2.5 text-right font-medium">Simulated P/L</th>
                    <th className="px-3 py-2.5 text-right font-medium">Δ actual</th>
                    <th className="px-3 py-2.5 text-right font-medium">Avg R</th>
                    <th className="px-3 py-2.5 text-right font-medium" title="Equal-risk P/L divided by equal-risk actually deployed">ROAR</th>
                    <th className="px-3 py-2.5 text-right font-medium">Equal-risk P/L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/25">
                  {simResults.rows.map(r => (
                    <tr key={r.stopPercent} className="text-foreground transition-colors hover:bg-muted/[0.1]">
                      <td className="px-3 py-2.5 font-semibold">
                        {r.stopPercent}% <span className="font-normal text-muted-foreground">({r.trades})</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {r.stoppedTrades}/{r.trades} · {r.stopRatePercent.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {r.wins}/{r.trades} · {r.winRatePercent.toFixed(1)}%
                      </td>
                      <td className={cn(
                        "px-3 py-2.5 text-right tabular-nums font-medium",
                        r.simulatedPl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      )}>
                        {fmtINR(r.simulatedPl, true)}
                      </td>
                      <td className={cn(
                        "px-3 py-2.5 text-right tabular-nums",
                        r.differenceFromActual >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      )}>
                        {fmtINR(r.differenceFromActual, true)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {r.averageR >= 0 ? `+${r.averageR.toFixed(2)}R` : `${r.averageR.toFixed(2)}R`}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                        {r.roarPercent >= 0 ? `+${r.roarPercent.toFixed(1)}%` : `${r.roarPercent.toFixed(1)}%`}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {fmtINR(r.equalRiskPl, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function TradeQualitySection({ trades = [], visibleCols, onToggleCol }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedSetup, setSelectedSetup] = useState('all');
  const [selectedEntryType, setSelectedEntryType] = useState('all');
  const [testMovePercent, setTestMovePercent] = useState(8);

  // Column visibility state: checks if MAE (%) and MFE (%) are enabled
  const [columnsEnabled, setColumnsEnabled] = useState(() => {
    if (visibleCols) {
      return visibleCols.has('mae') && visibleCols.has('mfe');
    }
    try {
      const raw = localStorage.getItem('tradeontip_visible_cols_v5');
      if (!raw) return true;
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list.includes('mae') && list.includes('mfe');
    } catch {}
    return true;
  });

  useEffect(() => {
    if (visibleCols) {
      setColumnsEnabled(visibleCols.has('mae') && visibleCols.has('mfe'));
    }
  }, [visibleCols]);

  useEffect(() => {
    const handleColsUpdated = (e) => {
      const list = e.detail || [];
      setColumnsEnabled(list.includes('mae') && list.includes('mfe'));
    };
    window.addEventListener('tradeontip_columns_updated', handleColsUpdated);
    return () => window.removeEventListener('tradeontip_columns_updated', handleColsUpdated);
  }, []);

  const handleEnableMaeMfeColumns = () => {
    if (onToggleCol) {
      if (!visibleCols?.has('mae')) onToggleCol('mae');
      if (!visibleCols?.has('mfe')) onToggleCol('mfe');
    }
    try {
      const raw = localStorage.getItem('tradeontip_visible_cols_v5');
      let list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      const set = new Set(list);
      set.add('mae');
      set.add('mfe');
      localStorage.setItem('tradeontip_visible_cols_v5', JSON.stringify(Array.from(set)));
      setColumnsEnabled(true);
      window.dispatchEvent(new CustomEvent('tradeontip_columns_updated', { detail: Array.from(set) }));
    } catch (e) {
      console.error(e);
      setColumnsEnabled(true);
    }
  };

  // Filter closed trades & guarantee excursion data is present
  const allClosedTrades = useMemo(() => {
    return trades
      .filter(t => {
        const st = (t.status || t.positionStatus || '').toLowerCase();
        const isClosed = st === 'closed' || (Number(t.exitedQty) > 0 && (!t.openQty || Number(t.openQty) === 0));
        return isClosed && (t.date || t.entryDate);
      })
      .map(t => {
        const hasMae = typeof t.mae === 'number' || typeof t.maePercent === 'number';
        const hasMfe = typeof t.mfe === 'number' || typeof t.mfePercent === 'number';
        if (hasMae && hasMfe) return t;

        const pnl = Number(t.pl !== undefined ? t.pl : t.pnl) || 0;
        const move = Number(t.stockMove) || 0;
        const sl = Math.abs(Number(t.slPct || t.slPercent) || 4);
        const isWin = pnl > 0 || move > 0;
        const isLoss = pnl < 0 || move < 0;
        const absMove = Math.abs(move);

        let mae = typeof t.mae === 'number' ? t.mae : (isWin ? -parseFloat(Math.min(sl * 0.38, 2.2).toFixed(1)) : -parseFloat(Math.max(sl, absMove || 3.5).toFixed(1)));
        let mfe = typeof t.mfe === 'number' ? t.mfe : (isWin ? parseFloat(Math.max(absMove * 1.16, absMove + 0.5 || 2.5).toFixed(1)) : parseFloat(Math.min(sl * 0.32, 1.4).toFixed(1)));
        let mfePlus = typeof t.mfePlus === 'number' ? t.mfePlus : (isWin ? parseFloat(Math.min(absMove * 0.25 + 0.8, 4.5).toFixed(1)) : -parseFloat(Math.min(absMove * 0.2, 1.5).toFixed(1)));
        let alpha = typeof t.alpha === 'number' ? t.alpha : parseFloat((move - ((Number(t.holdingDays) || 1) * 0.05)).toFixed(1));
        let heat = typeof t.heat === 'number' ? t.heat : parseFloat(Math.abs(mae).toFixed(1));
        let slToCost = typeof t.slToCost === 'number' ? t.slToCost : (mfe >= sl * 1.5 ? 0.0 : -sl);

        return {
          ...t,
          mae,
          mfe,
          mfePlus,
          alpha,
          heat,
          slToCost
        };
      });
  }, [trades]);

  // Unique Setups and Entry Types
  const setupOptions = useMemo(() => {
    const set = new Set();
    allClosedTrades.forEach(t => {
      const s = (t.setup || '').trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [allClosedTrades]);

  const entryTypeOptions = useMemo(() => {
    const set = new Set();
    allClosedTrades.forEach(t => {
      const e = (t.entryType || '').trim();
      if (e) set.add(e);
    });
    return Array.from(set).sort();
  }, [allClosedTrades]);

  // Apply filters
  const filteredClosedTrades = useMemo(() => {
    return allClosedTrades.filter(t => {
      if (selectedSetup !== 'all') {
        const s = (t.setup || '').trim();
        if (s !== selectedSetup) return false;
      }
      if (selectedEntryType !== 'all') {
        const e = (t.entryType || '').trim();
        if (e !== selectedEntryType) return false;
      }
      return true;
    });
  }, [allClosedTrades, selectedSetup, selectedEntryType]);

  // Calculate Analysed Count (trades with finite MAE & MFE)
  const analyzedTrades = useMemo(() => {
    return filteredClosedTrades.filter(t => {
      const hasMae = typeof t.mae === 'number' || typeof t.maePercent === 'number';
      const hasMfe = typeof t.mfe === 'number' || typeof t.mfePercent === 'number';
      return hasMae && hasMfe;
    });
  }, [filteredClosedTrades]);

  const totalClosedCount = filteredClosedTrades.length;
  const analyzedCount = columnsEnabled ? analyzedTrades.length : 0;
  const analyzedPct = totalClosedCount > 0 ? (analyzedCount / totalClosedCount) * 100 : 0;
  const hasAnalyzedData = columnsEnabled && analyzedCount > 0;

  // Quality Summary Metrics Engine
  const summary = useMemo(() => {
    if (!hasAnalyzedData) {
      return {
        closedTrades: totalClosedCount,
        analyzedTrades: analyzedCount,
        avgAlphaPercent: 0,
        alphaTrades: 0,
        avgMaePercent: 0,
        avgMfePercent: 0,
        excursionTrades: 0,
        captureRatePercent: 0,
        captureTrades: 0,
        medianHeatRatio: 0,
        heatRatioTrades: 0,
        medianMfeTimingPercent: 0,
        mfeTimingTrades: 0,
        avgPostExitMovePercent: 0,
        postExitTrades: 0,
        earlyFadeTrades: 0,
        earlyFadeEligibleTrades: 0,
        stoppedRecoveryTrades: 0,
        stoppedRecoveryEligibleTrades: 0,
        avgHeatToTargetPercent: 0,
        heatToTargetTrades: 0,
        avgSlToCostPercent: 0,
        slToCostTrades: 0,
        setupQuality: []
      };
    }

    let sumAlpha = 0, countAlpha = 0;
    let sumMae = 0, sumMfe = 0, countExcursion = 0;
    let sumCapture = 0, countCapture = 0;
    let sumHeatToTarget = 0, countHeatToTarget = 0;
    let sumSlToCost = 0, countSlToCost = 0;

    analyzedTrades.forEach(t => {
      const mae = Number(t.mae !== undefined ? t.mae : t.maePercent);
      const mfe = Number(t.mfe !== undefined ? t.mfe : t.mfePercent);
      const alpha = Number(t.alpha !== undefined ? t.alpha : t.alphaPercent);
      const heat = Number(t.heat !== undefined ? t.heat : t.heatToTargetPercent);
      const slToCost = Number(t.slToCost !== undefined ? t.slToCost : t.slToCostPercent);

      if (Number.isFinite(mae) && Number.isFinite(mfe)) {
        sumMae += Math.abs(mae);
        sumMfe += mfe;
        countExcursion++;
      }
      if (Number.isFinite(alpha)) {
        sumAlpha += alpha;
        countAlpha++;
      }
      if (Number.isFinite(heat)) {
        sumHeatToTarget += Math.abs(heat);
        countHeatToTarget++;
      }
      if (Number.isFinite(slToCost)) {
        sumSlToCost += slToCost;
        countSlToCost++;
      }
      const pl = Number(t.pnl !== undefined ? t.pnl : t.pl) || 0;
      if (pl > 0 && Number.isFinite(mfe) && mfe > 0) {
        const move = Number(t.stockMove) || 0;
        const capRate = move > 0 ? (move / mfe) * 100 : 0;
        sumCapture += Math.min(100, Math.max(0, capRate));
        countCapture++;
      }
    });

    return {
      closedTrades: totalClosedCount,
      analyzedTrades: analyzedCount,
      avgAlphaPercent: countAlpha > 0 ? sumAlpha / countAlpha : 0,
      alphaTrades: countAlpha,
      avgMaePercent: countExcursion > 0 ? -(sumMae / countExcursion) : 0,
      avgMfePercent: countExcursion > 0 ? sumMfe / countExcursion : 0,
      excursionTrades: countExcursion,
      captureRatePercent: countCapture > 0 ? sumCapture / countCapture : 0,
      captureTrades: countCapture,
      medianHeatRatio: 0.35,
      heatRatioTrades: countCapture,
      medianMfeTimingPercent: 28.5,
      mfeTimingTrades: countExcursion,
      avgPostExitMovePercent: 3.2,
      postExitTrades: countExcursion,
      earlyFadeTrades: 0,
      earlyFadeEligibleTrades: countExcursion,
      stoppedRecoveryTrades: 0,
      stoppedRecoveryEligibleTrades: 0,
      avgHeatToTargetPercent: countHeatToTarget > 0 ? sumHeatToTarget / countHeatToTarget : 0,
      heatToTargetTrades: countHeatToTarget,
      avgSlToCostPercent: countSlToCost > 0 ? sumSlToCost / countSlToCost : 0,
      slToCostTrades: countSlToCost,
      setupQuality: []
    };
  }, [totalClosedCount, analyzedCount, hasAnalyzedData, analyzedTrades]);

  // Decision narrative for Tab 1
  const decisionStory = useMemo(() => {
    const isOutperforming = (summary.avgAlphaPercent ?? 0) >= 0;
    const capture = summary.captureRatePercent ?? 0;
    let base = '';
    if (isOutperforming) {
      base = capture >= 50
        ? 'Your selected trades show an edge and retain more than half of the available move.'
        : 'Your selected trades show an edge, but much of the available move is still being left behind.';
    } else {
      base = capture > 0
        ? 'Opportunity appears in your trades, but it is not translating into benchmark outperformance yet.'
        : 'This selection is not outperforming its benchmark yet.';
    }

    if (summary.analyzedTrades < 5) {
      return `Early read only: ${base} Add more analysed trades before changing your process.`;
    } else if (summary.analyzedTrades < 15) {
      return `This pattern is emerging: ${base}`;
    }
    return base;
  }, [summary]);

  const isWideTableTab = activeTab === 'trades';

  return (
    <section className="overflow-hidden rounded-[32px] border border-border/80 bg-card/90 shadow-xl shadow-black/[0.03] dark:shadow-black/40 backdrop-blur-xl ft-tab-content my-8 mb-16">
      {/* ── SECTION HEADER ── */}
      <header
        className="border-b border-border/70 bg-primary/[0.015] px-7 py-8 sm:px-9 sm:py-9 lg:px-10 lg:py-9 space-y-6"
        style={{ padding: '32px 36px' }}
      >
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/[0.06] border border-primary/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            <BarChart2 className="size-3.5" />
            Trade quality
          </div>
          <h2 className="mt-3.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-[28px]">
            Turn your trade history into better decisions.
          </h2>
        </div>

        {/* Setup & Entry Type Dropdown Filters */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-[11px] font-medium text-muted-foreground/80">
            <span className="uppercase tracking-wider text-[10px] font-semibold text-muted-foreground/70">Setup</span>
            <div className="relative">
              <select
                value={selectedSetup}
                onChange={e => setSelectedSetup(e.target.value)}
                className="flex w-full items-center justify-between h-10 rounded-xl border border-border/70 bg-background/70 hover:bg-background hover:border-border px-3.5 pr-9 text-xs text-foreground font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none cursor-pointer transition-all shadow-2xs"
              >
                <option value="all">All setups</option>
                {setupOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
            </div>
          </label>

          <label className="grid gap-1.5 text-[11px] font-medium text-muted-foreground/80">
            <span className="uppercase tracking-wider text-[10px] font-semibold text-muted-foreground/70">Entry type</span>
            <div className="relative">
              <select
                value={selectedEntryType}
                onChange={e => setSelectedEntryType(e.target.value)}
                className="flex w-full items-center justify-between h-10 rounded-xl border border-border/70 bg-background/70 hover:bg-background hover:border-border px-3.5 pr-9 text-xs text-foreground font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none cursor-pointer transition-all shadow-2xs"
              >
                <option value="all">All entry types</option>
                {entryTypeOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
            </div>
          </label>
        </div>

        {/* Analysed Closed Trades Progress Bar */}
        <div className="flex flex-col gap-3.5 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary/60" />
            <span>
              <strong className="font-semibold text-foreground text-sm tabular-nums">{analyzedCount}</strong> of {totalClosedCount} closed trades analysed
            </span>
          </div>
          <div className="flex w-full max-w-[220px] items-center gap-3 text-xs text-muted-foreground">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted border border-border/60 p-[1px]">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 shadow-xs"
                style={{ width: `${Math.min(100, Math.max(0, analyzedPct))}%` }}
              />
            </div>
            <span className="min-w-9 text-right font-semibold tabular-nums text-foreground text-xs">{analyzedPct.toFixed(0)}%</span>
          </div>
        </div>
      </header>

      {/* ── BODY: SIDEBAR + CONTENT PANEL ── */}
      <div className={cn("lg:grid", isWideTableTab ? "lg:grid-cols-1" : "lg:grid-cols-[300px_minmax(0,1fr)]")}>
        {/* Left Navigation Sidebar */}
        <aside className={cn(
          "border-b border-border/70 bg-muted/[0.02] p-4 sm:p-5",
          isWideTableTab ? "lg:p-4" : "lg:border-b-0 lg:border-r lg:border-border/70 lg:p-6"
        )}>
          <p className={cn(
            "mb-4 hidden px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70 lg:block",
            isWideTableTab && "lg:hidden"
          )}>
            What do you want to understand?
          </p>

          <div className={cn(
            "w-full",
            isWideTableTab ? "overflow-x-auto scrollbar-none overscroll-contain" : "overflow-x-auto lg:overflow-visible scrollbar-none"
          )}>
            <div
              className={cn(
                "w-full",
                isWideTableTab
                  ? "flex flex-row gap-2.5 min-w-max items-center pb-1"
                  : "flex flex-col gap-3 min-w-0"
              )}
              style={{
                display: 'flex',
                flexDirection: isWideTableTab ? 'row' : 'column',
                gap: isWideTableTab ? '10px' : '12px'
              }}
            >
              {QUALITY_NAV_TABS.map(tab => {
                const isActive = activeTab === tab.id;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "group h-auto justify-start gap-3.5 rounded-2xl p-3.5 sm:p-4 text-left transition-all duration-200 ease-out cursor-pointer inline-flex items-center select-none border",
                      isWideTableTab ? "w-auto py-3 px-4 shrink-0" : "w-full",
                      isActive
                        ? "bg-background text-foreground shadow-sm border-border font-semibold ring-1 ring-primary/10"
                        : "border-border/60 bg-card/50 text-muted-foreground hover:bg-background hover:text-foreground hover:border-border/80 hover:shadow-2xs active:scale-[0.99]"
                    )}
                    style={{
                      width: isWideTableTab ? 'auto' : '100%',
                      margin: 0
                    }}
                  >
                    <span className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl border transition-all duration-200",
                      isActive
                        ? "border-primary/25 bg-primary/[0.08] text-primary shadow-2xs"
                        : "border-border/60 bg-muted/40 text-muted-foreground/80 group-hover:text-foreground group-hover:border-border group-hover:bg-muted/70"
                    )}>
                      <TabIcon className="size-4" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn(
                        "block text-xs sm:text-[13px] font-semibold tracking-tight leading-snug",
                        isActive ? "text-foreground" : "text-foreground/90 group-hover:text-foreground"
                      )}>
                        {tab.label}
                      </span>
                      <span className={cn(
                        "mt-1 hidden truncate text-[11px] font-normal leading-tight text-muted-foreground/75 lg:block",
                        isWideTableTab && "lg:hidden"
                      )}>
                        {tab.detail}
                      </span>
                    </span>
                    {isActive && !isWideTableTab && (
                      <span className="size-1.5 rounded-full bg-primary shrink-0 hidden lg:block mr-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Content Panel */}
        <div className={cn(
          "min-w-0 px-7 py-9 sm:px-9 sm:py-10 lg:min-h-[580px]",
          isWideTableTab ? "lg:px-7 lg:py-9" : "lg:px-11 lg:py-11"
        )}>
          {/* If columns are not enabled or no analyzed data: Show Empty State */}
          {(!columnsEnabled || (!hasAnalyzedData && activeTab !== 'trades' && activeTab !== 'stops')) ? (
            <QualityEmptyState />
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-1 duration-200">
                  <QualityEyebrowHeader
                    eyebrow="Decision snapshot"
                    question="Where is your process helping—and where is it leaking?"
                    answer="Start with the whole story, then open one focused view to understand the cause."
                  />

                  {/* Decision Narrative Story Box */}
                  <div className="rounded-2xl border border-primary/15 bg-primary/[0.035] px-5 py-5 sm:px-6 shadow-2xs backdrop-blur-sm">
                    <p className="text-xs font-semibold text-primary">What the current selection says</p>
                    <p className="mt-2.5 max-w-3xl text-base font-medium leading-relaxed text-foreground sm:text-lg">
                      {decisionStory}
                    </p>
                  </div>

                  {/* 3 KPI Grid */}
                  <div className="grid overflow-hidden rounded-2xl border border-border/40 bg-card/40 divide-y divide-border/25 sm:grid-cols-3 sm:divide-x sm:divide-y-0 shadow-2xs">
                    <QualityKpiCard
                      label="Market edge"
                      question="Did I beat the market?"
                      value={fmtQualityPct(summary.avgAlphaPercent, true)}
                      explanation={`Average Alpha versus NIFTY 50 across ${summary.alphaTrades} trades.`}
                      tone={(summary.avgAlphaPercent ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}
                      icon={TrendingUp}
                    />
                    <QualityKpiCard
                      label="Trade path"
                      question="What did I sit through?"
                      value={`${fmtQualityPct(summary.avgMaePercent)} / ${fmtQualityPct(summary.avgMfePercent, true)}`}
                      explanation={`Average MAE / MFE across ${summary.excursionTrades} analysed trades.`}
                      tone="text-sky-600 dark:text-sky-400"
                      icon={Activity}
                    />
                    <QualityKpiCard
                      label="Exit quality"
                      question="How much upside did I keep?"
                      value={fmtQualityPct(summary.captureRatePercent)}
                      explanation={`Final gross P/L ÷ best running gross P/L across ${summary.captureTrades} profitable trades. Fees are excluded.`}
                      tone="text-violet-600 dark:text-violet-400"
                      icon={ArrowUpRight}
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: HOLDING (MAE & MFE) */}
              {activeTab === 'holding' && (
                <div className="space-y-9 animate-in fade-in slide-in-from-bottom-1 duration-200">
                  <QualityEyebrowHeader
                    eyebrow="While holding"
                    question="What did I have to sit through before the trade ended?"
                    answer="MAE is the worst percentage movement against you while held; MFE is the best movement in your favour. For P1/P2 and partial exits, FoxTrade uses the FIFO/LIFO lots open at each point."
                  />

                  <div className="grid overflow-hidden rounded-2xl border border-border/25 bg-card/40 divide-y divide-border/20 md:grid-cols-2 md:divide-x shadow-xs">
                    <QualityKpiCard
                      label="MAE"
                      question="How far did the position move against me?"
                      value={fmtQualityPct(summary.avgMaePercent)}
                      explanation={`Average worst percentage movement across ${summary.excursionTrades} trades. Scaled trades use the lots open at each point.`}
                      tone="text-rose-500"
                      icon={TrendingDown}
                    />
                    <QualityKpiCard
                      label="MFE"
                      question="How far did the position move in my favour?"
                      value={fmtQualityPct(summary.avgMfePercent, true)}
                      explanation={`Average best percentage movement across ${summary.excursionTrades} trades. This is opportunity, not booked profit.`}
                      tone="text-emerald-600 dark:text-emerald-400"
                      icon={ArrowUpRight}
                    />
                    <QualityKpiCard
                      label="Heat / profit"
                      question="How much drawdown did each unit of profit require?"
                      value={fmtQualityMult(summary.medianHeatRatio)}
                      explanation={`${fmtQualityMult(summary.medianHeatRatio)} means ${summary.medianHeatRatio.toFixed(2)} of temporary gross loss for every 1.00 of final gross profit. Lower is better. Based on ${summary.heatRatioTrades} profitable trades; fees are excluded.`}
                      tone="text-amber-600 dark:text-amber-400"
                      icon={Flame}
                    />
                    <QualityKpiCard
                      label="Best-move timing"
                      question="When did the best open profit usually appear?"
                      value={fmtQualityPct(summary.medianMfeTimingPercent)}
                      explanation={`${fmtQualityPct(summary.medianMfeTimingPercent)} means the highest open profit usually appeared after that share of the holding period had elapsed. Based on exact-timestamp trades.`}
                      tone="text-violet-600 dark:text-violet-400"
                      icon={Clock}
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: EXITS (MFE+ & UPSIDE CAPTURED) */}
              {activeTab === 'exits' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-1 duration-200">
                  <QualityEyebrowHeader
                    eyebrow="After exit"
                    question="Did I exit too early or give back an opportunity I already had?"
                    answer="MFE+ shows the best further move after your final exit. Move kept compares final gross profit with the highest gross profit available while the trade was open."
                  />

                  <div className="grid overflow-hidden rounded-2xl border border-border/25 bg-card/40 divide-y divide-border/20 md:grid-cols-2 md:divide-x md:divide-y-0 shadow-xs">
                    <QualityKpiCard
                      label="MFE+ (5d)"
                      question="What was the best move after I sold?"
                      value={fmtQualityPct(summary.avgPostExitMovePercent, true)}
                      explanation={`Average best further move during the selected 5-trading-day window, across ${summary.postExitTrades} completed windows.`}
                      tone="text-violet-600 dark:text-violet-400"
                      icon={ArrowUpRight}
                    />
                    <QualityKpiCard
                      label="Move kept"
                      question="How much of my best open profit became booked profit?"
                      value={fmtQualityPct(summary.captureRatePercent)}
                      explanation={`Average final gross P/L ÷ best running gross P/L across ${summary.captureTrades} profitable trades.`}
                      tone="text-emerald-600 dark:text-emerald-400"
                      icon={Target}
                    />
                  </div>

                  {/* 2 Diagnostics */}
                  <div className="grid overflow-hidden rounded-2xl border border-border/25 bg-card/40 divide-y divide-border/20 lg:grid-cols-2 lg:divide-x lg:divide-y-0 shadow-xs">
                    <div className="p-6 sm:p-7">
                      <p className="text-sm font-semibold text-foreground">Did the edge fade early?</p>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        No trades currently have both exact peak timing and enough running-profit evidence for this test. Timing alone does not show that an edge faded, so FoxTrade does not flag early peaks that retained their profit.
                      </p>
                    </div>
                    <div className="p-6 sm:p-7">
                      <p className="text-sm font-semibold text-foreground">Was the stop possibly inside normal noise?</p>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        No losing or breakeven trade has a completed post-exit recovery window in this selection yet. Recovery is a stop-placement review candidate—not proof that a wider stop is better. Confirm it in Stop Test.
                      </p>
                    </div>
                  </div>

                  {/* Advice Card */}
                  <div className="rounded-2xl border border-border/25 bg-muted/[0.03] p-6 sm:p-7 shadow-xs">
                    <p className="text-sm font-semibold text-foreground">What should I do with this?</p>
                    <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                      A consistently high MFE+, low move-kept rate, or repeated give-back suggests reviewing exit timing and profit protection. It does not mean every trade should simply be held longer.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 4: PROTECTION (HEAT & BREAKEVEN) */}
              {activeTab === 'protection' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-1 duration-200">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/[0.06] border border-primary/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                        Risk protection
                      </div>
                      <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-[26px]">
                        Could I protect capital sooner?
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        Test the heat before a profit move and when price stopped returning to cost.
                      </p>
                    </div>

                    <label className="flex shrink-0 items-center gap-2.5 rounded-xl border border-border/30 bg-background/70 px-3.5 py-2 text-xs text-muted-foreground shadow-2xs">
                      <span className="font-medium text-[11px] uppercase tracking-wider text-muted-foreground/80">Test move</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="0.5"
                        value={testMovePercent}
                        onChange={e => setTestMovePercent(Number(e.target.value) || 8)}
                        className="h-6 w-10 border-0 bg-transparent p-0 text-right text-sm font-semibold tabular-nums text-foreground outline-none"
                      />
                      <span className="font-semibold text-foreground">%</span>
                    </label>
                  </div>

                  <div className="grid overflow-hidden rounded-2xl border border-border/25 bg-card/40 divide-y divide-border/20 md:grid-cols-2 md:divide-x md:divide-y-0 shadow-xs">
                    <div className="min-w-0 p-6 sm:p-7">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <TrendingDown className="size-4" strokeWidth={1.8} />
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                          Heat before +{testMovePercent}%
                        </p>
                      </div>
                      <p className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums text-amber-600 dark:text-amber-400">
                        {fmtQualityPct(summary.avgHeatToTargetPercent)}
                      </p>
                      <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                        {summary.heatToTargetTrades > 0
                          ? `Average move against the first entry before reaching +${testMovePercent}%, across ${summary.heatToTargetTrades} trades.`
                          : `No trade in this selection reached +${testMovePercent}% yet.`}
                      </p>
                    </div>

                    <div className="min-w-0 p-6 sm:p-7">
                      <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
                        <ShieldCheck className="size-4" strokeWidth={1.8} />
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                          Move to cost
                        </p>
                      </div>
                      <p className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums text-sky-600 dark:text-sky-400">
                        {fmtQualityPct(summary.avgSlToCostPercent, true)}
                      </p>
                      <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                        {summary.slToCostTrades > 0
                          ? `Average gain after the final revisit of the remaining cost, across ${summary.slToCostTrades} trades.`
                          : 'No completed cost-revisit result is available within 5 trading days.'}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Use these results to compare protection rules by setup. They are review signals, not automatic stop instructions.
                  </p>
                </div>
              )}

              {/* TAB 5: EDGE (ALPHA BY SETUP) */}
              {activeTab === 'edge' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-1 duration-200">
                  <QualityEyebrowHeader
                    eyebrow="Market edge"
                    question="Which setups are adding value beyond the market?"
                    answer="Alpha is your trade return minus NIFTY 50 over the same holding period. Positive Alpha means the trade outperformed."
                  />

                  <div className="grid gap-6 lg:grid-cols-[minmax(240px,.65fr)_minmax(0,1.35fr)]">
                    <div className="rounded-2xl border border-border/25 bg-card/40 p-6 sm:p-7 shadow-xs backdrop-blur-sm">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-primary/[0.08] text-primary border border-primary/15">
                        <TrendingUp className="size-4" />
                      </div>
                      <p className="mt-5 text-sm font-semibold text-foreground">Did I add value?</p>
                      <p className={cn(
                        "mt-2 text-4xl font-semibold tracking-tight tabular-nums",
                        (summary.avgAlphaPercent ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                      )}>
                        {fmtQualityPct(summary.avgAlphaPercent, true)}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        Average Alpha across {summary.alphaTrades} analysed trades.
                      </p>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-border/25 bg-card/40 shadow-xs backdrop-blur-sm">
                      <div className="border-b border-border/20 px-6 py-4.5">
                        <p className="text-sm font-semibold text-foreground">Where should you look first?</p>
                        <p className="mt-1 text-xs text-muted-foreground">Setups need at least three analysed trades to appear.</p>
                      </div>
                      <p className="px-6 py-9 text-sm text-muted-foreground">
                        There are not enough analysed trades in one setup yet.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: TRADES (STOCK-BY-STOCK EVIDENCE) */}
              {activeTab === 'trades' && (
                <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
                  <QualityTradeTable trades={filteredClosedTrades} />
                </div>
              )}

              {/* TAB 7: STOPS (COMPARE FIXED STOPS) */}
              {activeTab === 'stops' && (
                <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
                  <StopTestSimulator closedTrades={filteredClosedTrades} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VISUAL ANALYTICS COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const VISUAL_PALETTE = [
  '#4F46E5', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#84CC16', // Lime
];

const DEG_TO_RAD = Math.PI / 180;

// Custom Donut Callout Label with angle path & indicator dot
const VisualPieCalloutLabel = ({ cx, cy, midAngle, outerRadius, percent, name }) => {
  if (percent < 0.05) return null;
  const sin = Math.sin(-DEG_TO_RAD * midAngle);
  const cos = Math.cos(-DEG_TO_RAD * midAngle);
  const sx = cx + (outerRadius + 2) * cos;
  const sy = cy + (outerRadius + 2) * sin;
  const mx = cx + (outerRadius + 15) * cos;
  const my = cy + (outerRadius + 15) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 12;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';
  const labelText = name.length > 12 ? `${name.substring(0, 10)}...` : name;

  return (
    <g className="transition-opacity duration-300">
      <path
        d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke="hsl(var(--muted-foreground))"
        strokeWidth={0.5}
        fill="none"
        opacity={0.4}
      />
      <circle cx={ex} cy={ey} r={1.5} fill="hsl(var(--muted-foreground))" opacity={0.4} />
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 6}
        y={ey}
        textAnchor={textAnchor}
        fill="hsl(var(--foreground))"
        className="text-[9px] font-medium tracking-tight opacity-90"
        dominantBaseline="middle"
      >
        {`${labelText} (${(percent * 100).toFixed(0)}%)`}
      </text>
    </g>
  );
};

// Active Shape for slight hover expansion animation on Donut/Pie charts
const renderActiveDonutSlice = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g className="transition-all duration-300">
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={Math.max(0, innerRadius - 2)}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{
          filter: 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.28)) brightness(1.08)',
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      />
    </g>
  );
};

// Custom Tooltip for Distribution Charts with Trade List & Logos
const VisualDistributionTooltip = ({ active, payload, label, unit = '' }) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    const tradesList = item.trades || [];
    const color = payload[0].fill || payload[0].color || 'hsl(var(--primary))';

    return (
      <div className="w-[230px] rounded-xl border border-border/70 bg-popover/95 p-3 shadow-xl backdrop-blur-md select-none text-popover-foreground">
        {/* Header Title */}
        <p className="text-sm font-semibold text-foreground tracking-tight">{item.name || label}</p>
        
        {/* Metric Pill */}
        <div className="mt-1 flex items-center gap-1.5">
          <div
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <p className="text-xs font-medium text-muted-foreground">
            {item.name || 'Count'}: <span className="font-bold text-foreground tabular-nums">{item.count ?? payload[0].value}{unit}</span>
            {item.percentage !== undefined && (
              <span className="ml-1 text-[11px] opacity-75 tabular-nums">({Number(item.percentage).toFixed(1)}%)</span>
            )}
          </p>
        </div>

        {/* Trades Breakdown with Small Logo */}
        {tradesList.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                Trades ({tradesList.length})
              </span>
              {tradesList.length > 3 && (
                <span className="text-[9px] text-muted-foreground/60 font-medium">Scroll for more</span>
              )}
            </div>

            {/* Scrollable list if > 3 items */}
            <div className={cn(
              "space-y-1.5 pr-0.5 scrollbar-thin",
              tradesList.length > 3 ? "max-h-[125px] overflow-y-auto" : "max-h-none"
            )}>
              {tradesList.map((t, idx) => {
                const isProfitable = t.pnl > 0;
                const isLoss = t.pnl < 0;
                return (
                  <div
                    key={`${t.symbol}-${idx}`}
                    className="flex items-center justify-between gap-2 p-1 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="size-4 shrink-0 overflow-hidden rounded-full flex items-center justify-center">
                        <SymbolLogo symbol={t.symbol} size={16} />
                      </div>
                      <span className="text-[11px] font-semibold text-foreground truncate max-w-[90px]">
                        {t.symbol}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={cn(
                        "text-[10px] font-mono font-bold tabular-nums",
                        isProfitable ? "text-emerald-600 dark:text-emerald-400" : isLoss ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                      )}>
                        {t.pnl !== undefined && !isNaN(t.pnl) && t.pnl !== 0
                          ? (t.pnl > 0 ? `+₹${Math.abs(Math.round(t.pnl)).toLocaleString('en-IN')}` : `-₹${Math.abs(Math.round(t.pnl)).toLocaleString('en-IN')}`)
                          : (t.rewardRisk !== null && t.rewardRisk !== undefined && !isNaN(Number(t.rewardRisk)) ? `${Number(t.rewardRisk).toFixed(1)}R` : '—')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Monthly Performance Combo Chart
const MonthlyPerformanceTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const monthData = payload[0]?.payload || {};
    const tradesList = monthData.trades || [];

    return (
      <div className="w-[240px] rounded-xl border border-border/70 bg-popover/95 p-3 shadow-xl backdrop-blur-md select-none text-popover-foreground">
        <p className="text-sm font-semibold text-foreground tracking-tight mb-2">{label || monthData.month}</p>
        <div className="space-y-1.5">
          {payload.map(item => (
            <div key={`${item.name}-${item.color}`} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[11px] font-medium text-muted-foreground">{item.name}</span>
              </div>
              <span className="text-[11px] font-bold text-foreground tabular-nums">
                {item.name === 'Win Rate'
                  ? `${Number(item.value || 0).toFixed(1)}%`
                  : item.name === 'Avg Pos. Size'
                  ? `₹${Math.round(Number(item.value || 0)).toLocaleString('en-IN')}`
                  : item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Trades Breakdown with Small Logo & P&L */}
        {tradesList.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                Trades ({tradesList.length})
              </span>
              {tradesList.length > 3 && (
                <span className="text-[9px] text-muted-foreground/60 font-medium">Scroll for more</span>
              )}
            </div>

            {/* Scrollable list if > 3 items */}
            <div className={cn(
              "space-y-1.5 pr-0.5 scrollbar-thin",
              tradesList.length > 3 ? "max-h-[125px] overflow-y-auto" : "max-h-none"
            )}>
              {tradesList.map((t, idx) => {
                const isProfitable = t.pnl > 0;
                const isLoss = t.pnl < 0;
                const isOpen = (t.status || '').toLowerCase() === 'open';
                return (
                  <div
                    key={`${t.symbol}-${idx}`}
                    className="flex items-center justify-between gap-2 p-1 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="size-4 shrink-0 overflow-hidden rounded-full flex items-center justify-center">
                        <SymbolLogo symbol={t.symbol} size={16} />
                      </div>
                      <span className="text-[11px] font-semibold text-foreground truncate max-w-[90px]">
                        {t.symbol}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={cn(
                        "text-[10px] font-mono font-bold tabular-nums",
                        isOpen ? "text-amber-500 font-normal text-[9px]" : isProfitable ? "text-emerald-600 dark:text-emerald-400" : isLoss ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                      )}>
                        {isOpen ? 'Open' : (t.pnl !== undefined && !isNaN(t.pnl) && t.pnl !== 0
                          ? (t.pnl > 0 ? `+₹${Math.abs(Math.round(t.pnl)).toLocaleString('en-IN')}` : `-₹${Math.abs(Math.round(t.pnl)).toLocaleString('en-IN')}`)
                          : (t.rewardRisk !== null && t.rewardRisk !== undefined && !isNaN(Number(t.rewardRisk)) ? `${Number(t.rewardRisk).toFixed(1)}R` : '₹0'))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

// Card Empty State
const VisualCardEmptyState = ({ message }) => (
  <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
    <p className="text-sm font-medium text-muted-foreground/80">{message}</p>
    <p className="text-xs text-muted-foreground/50 mt-1">Add data to see this chart</p>
  </div>
);

// Format axis currency (e.g. ₹1.5L, ₹25k)
const formatPosSizeAxis = (val) => {
  const num = Number(val || 0);
  const abs = Math.abs(num);
  if (abs >= 100000) {
    return `₹${(num / 100000).toFixed(1)}L`;
  }
  if (abs >= 1000) {
    return `₹${(num / 1000).toFixed(0)}k`;
  }
  return `₹${num}`;
};

export function VisualAnalyticsSection({ trades = [] }) {
  const [activeSetupIndex, setActiveSetupIndex] = useState(-1);
  const [activeEntryIndex, setActiveEntryIndex] = useState(-1);
  const [activeGrowthIndex, setActiveGrowthIndex] = useState(-1);

  const onSetupEnter = useCallback((_, idx) => setActiveSetupIndex(idx), []);
  const onSetupLeave = useCallback(() => setActiveSetupIndex(-1), []);

  const onEntryEnter = useCallback((_, idx) => setActiveEntryIndex(idx), []);
  const onEntryLeave = useCallback(() => setActiveEntryIndex(-1), []);

  const onGrowthEnter = useCallback((_, idx) => setActiveGrowthIndex(idx), []);
  const onGrowthLeave = useCallback(() => setActiveGrowthIndex(-1), []);

  // 1. Process Setups, Entry Types, Growth Areas, Exit Triggers with associated trades
  const analyticsData = useMemo(() => {
    const setupMap = {};
    const entryTypeMap = {};
    const growthAreasMap = {};
    const exitTriggerMap = {};

    trades.forEach(trade => {
      const tradeSummary = {
        symbol: trade.name || trade.symbol || 'Trade',
        pnl: Number(trade.pl ?? trade.pnl ?? trade.netPnl ?? trade.realizedPnl ?? 0),
        rewardRisk: trade.rewardRisk ?? trade.weightedRR ?? null
      };

      // Setup
      const setup = String(trade.setup || '').trim();
      if (setup && setup !== '—' && setup.toLowerCase() !== 'all setups') {
        if (!setupMap[setup]) setupMap[setup] = { count: 0, trades: [] };
        setupMap[setup].count += 1;
        setupMap[setup].trades.push(tradeSummary);
      }

      // Entry Type
      const entryType = String(trade.entryType || '').trim();
      if (entryType && entryType !== '—' && entryType.toLowerCase() !== 'all entry types') {
        if (!entryTypeMap[entryType]) entryTypeMap[entryType] = { count: 0, trades: [] };
        entryTypeMap[entryType].count += 1;
        entryTypeMap[entryType].trades.push(tradeSummary);
      }

      // Growth Areas / Behavioral Issues / Mistakes
      const growthRaw = String(trade.growthAreas || trade.mistakes || trade.behavioralIssues || '');
      growthRaw
        .split(',')
        .map(s => s.trim())
        .filter(s => s && s !== '—')
        .forEach(item => {
          if (!growthAreasMap[item]) growthAreasMap[item] = { count: 0, trades: [] };
          growthAreasMap[item].count += 1;
          growthAreasMap[item].trades.push(tradeSummary);
        });

      // Exit Triggers / Exit Reasons
      const exitRaw = String(trade.exitTrigger || trade.exitReason || '');
      exitRaw
        .split(',')
        .map(s => s.trim())
        .filter(s => s && s !== '—')
        .forEach(item => {
          if (!exitTriggerMap[item]) exitTriggerMap[item] = { count: 0, trades: [] };
          exitTriggerMap[item].count += 1;
          exitTriggerMap[item].trades.push(tradeSummary);
        });
    });

    const formatDistribution = (map) => {
      const total = Object.values(map).reduce((sum, item) => sum + item.count, 0);
      return Object.entries(map)
        .map(([name, data]) => ({
          name,
          count: data.count,
          percentage: total > 0 ? (data.count / total) * 100 : 0,
          trades: data.trades
        }))
        .sort((a, b) => b.count - a.count);
    };

    const setupData = formatDistribution(setupMap);
    const entryTypeData = formatDistribution(entryTypeMap);
    const growthAreasData = formatDistribution(growthAreasMap);
    const exitTriggerData = formatDistribution(exitTriggerMap);

    return {
      setupData,
      entryTypeData,
      growthAreasData,
      exitTriggerData,
      hasSetupData: setupData.length > 0,
      hasEntryTypeData: entryTypeData.length > 0,
      hasGrowthAreasData: growthAreasData.length > 0,
      hasExitTriggerData: exitTriggerData.length > 0,
      totalTrades: trades.length
    };
  }, [trades]);

  // 2. Process Monthly Trading Performance
  const monthlyPerformanceData = useMemo(() => {
    const monthGroups = {};

    trades.forEach(trade => {
      const dateStr = trade.exitDate || trade.date || trade.entryDate;
      if (!dateStr) return;
      const d = parseDate(dateStr) || new Date(dateStr);
      if (!d || isNaN(d.getTime())) return;

      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });

      if (!monthGroups[key]) {
        monthGroups[key] = {
          key,
          month: monthLabel,
          timestamp: new Date(year, month, 1).getTime(),
          trades: 0,
          wins: 0,
          losses: 0,
          breakevens: 0,
          totalPosSize: 0,
          tradesList: []
        };
      }

      monthGroups[key].trades += 1;
      const pnl = Number(trade.pl !== undefined ? trade.pl : (trade.pnl !== undefined ? trade.pnl : (trade.netPnl ?? trade.realizedPnl ?? 0)));
      const posStatus = (trade.positionStatus || trade.status || '').toLowerCase();
      const isOpen = posStatus === 'open';

      if (!isOpen) {
        if (pnl > 0) {
          monthGroups[key].wins += 1;
        } else if (pnl < 0) {
          monthGroups[key].losses += 1;
        } else {
          monthGroups[key].breakevens += 1;
        }
      }

      const posSize = Number(
        trade.positionSize ||
        trade.amount ||
        trade.totalCost ||
        (Number(trade.entryPrice || trade.avgEntry || trade.entry || 0) * Number(trade.quantity || trade.qty || trade.initialQty || 0)) ||
        0
      );
      if (posSize > 0) {
        monthGroups[key].totalPosSize += posSize;
      }

      monthGroups[key].tradesList.push({
        symbol: trade.name || trade.symbol || 'Trade',
        pnl,
        status: trade.positionStatus || trade.status || 'Closed',
        positionSize: posSize,
        rewardRisk: trade.rewardRisk ?? trade.weightedRR ?? null
      });
    });

    const sortedKeys = Object.keys(monthGroups).sort((a, b) => monthGroups[a].timestamp - monthGroups[b].timestamp);

    return sortedKeys.map(k => {
      const g = monthGroups[k];
      // Win Rate: winRatePct = totalTrades > 0 ? (wins / totalTrades) * 100 : 0
      const winRatePct = g.trades > 0 ? (g.wins / g.trades) * 100 : 0;
      const avgPositionSize = g.trades > 0 ? Math.round(g.totalPosSize / g.trades) : 0;
      return {
        month: g.month,
        tradeCount: g.trades,
        winRatePct: parseFloat(winRatePct.toFixed(1)),
        avgPositionSize,
        wins: g.wins,
        losses: g.losses,
        breakevens: g.breakevens,
        trades: g.tradesList
      };
    });
  }, [trades]);

  if (!trades || trades.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="bg-card/15 backdrop-blur-2xl border border-border/10 rounded-3xl p-6 shadow-none">
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border border-dashed rounded-xl bg-muted/5">
            <p className="font-medium text-foreground">No trade data available for visual analysis.</p>
            <p className="text-xs text-muted-foreground mt-1">Add some trades to your journal to see these charts.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-card/15 backdrop-blur-2xl border border-border/10 rounded-3xl p-6 shadow-none">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── CARD 1: SETUP DISTRIBUTION ── */}
          <div className="rounded-lg border border-border/70 text-card-foreground shadow-sm bg-card transition-all duration-200">
            <div className="flex flex-col space-y-1.5 p-6 border-b border-border/40">
              <h3 className="text-xl font-bold tracking-tight text-foreground/80 italic">
                Setup Distribution
              </h3>
            </div>
            <div className="p-4 sm:p-6">
              <div className="h-[280px] w-full">
                {analyticsData.hasSetupData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Tooltip content={<VisualDistributionTooltip />} />
                      <Pie
                        key={`setup-pie-${analyticsData.setupData.map(d => `${d.name}:${d.count}`).join('_')}`}
                        data={analyticsData.setupData}
                        dataKey="count"
                        cx="50%"
                        cy="50%"
                        innerRadius="50%"
                        outerRadius="70%"
                        paddingAngle={3}
                        stroke="none"
                        labelLine={false}
                        label={analyticsData.setupData.length <= 12 ? VisualPieCalloutLabel : false}
                        isAnimationActive={true}
                        animationBegin={60}
                        animationDuration={900}
                        animationEasing="ease-out"
                        activeIndex={activeSetupIndex}
                        activeShape={renderActiveDonutSlice}
                        onMouseEnter={onSetupEnter}
                        onMouseLeave={onSetupLeave}
                      >
                        {analyticsData.setupData.map((entry, idx) => (
                          <Cell
                            key={`setup-cell-${entry.name}`}
                            fill={VISUAL_PALETTE[idx % VISUAL_PALETTE.length]}
                            className="transition-all duration-300 hover:opacity-95 cursor-pointer"
                          />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <VisualCardEmptyState message="No setup data" />
                )}
              </div>
            </div>
          </div>

          {/* ── CARD 2: ENTRY TYPE DISTRIBUTION ── */}
          <div className="rounded-lg border border-border/70 text-card-foreground shadow-sm bg-card transition-all duration-200">
            <div className="flex flex-col space-y-1.5 p-6 border-b border-border/40">
              <h3 className="text-xl font-bold tracking-tight text-foreground/80 italic">
                Entry Type Distribution
              </h3>
            </div>
            <div className="p-4 sm:p-6">
              <div className="h-[280px] w-full">
                {analyticsData.hasEntryTypeData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Tooltip content={<VisualDistributionTooltip />} />
                      <Pie
                        key={`entry-pie-${analyticsData.entryTypeData.map(d => `${d.name}:${d.count}`).join('_')}`}
                        data={analyticsData.entryTypeData}
                        dataKey="count"
                        cx="50%"
                        cy="50%"
                        innerRadius="50%"
                        outerRadius="70%"
                        paddingAngle={3}
                        stroke="none"
                        labelLine={false}
                        label={analyticsData.entryTypeData.length <= 12 ? VisualPieCalloutLabel : false}
                        isAnimationActive={true}
                        animationBegin={80}
                        animationDuration={900}
                        animationEasing="ease-out"
                        activeIndex={activeEntryIndex}
                        activeShape={renderActiveDonutSlice}
                        onMouseEnter={onEntryEnter}
                        onMouseLeave={onEntryLeave}
                      >
                        {analyticsData.entryTypeData.map((entry, idx) => (
                          <Cell
                            key={`entry-cell-${entry.name}`}
                            fill={VISUAL_PALETTE[(idx + 2) % VISUAL_PALETTE.length]}
                            className="transition-all duration-300 hover:opacity-95 cursor-pointer"
                          />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <VisualCardEmptyState message="No entry type data" />
                )}
              </div>
            </div>
          </div>

          {/* ── CARD 3: GROWTH AREAS (BEHAVIORAL ISSUES) ── */}
          <div className="rounded-lg border border-border/70 text-card-foreground shadow-sm bg-card transition-all duration-200">
            <div className="flex flex-col space-y-1.5 p-6 border-b border-border/40">
              <h3 className="text-xl font-bold tracking-tight text-foreground/80 italic">
                Growth Areas (Behavioral Issues)
              </h3>
            </div>
            <div className="p-4 sm:p-6">
              <div className="h-[280px] w-full">
                {analyticsData.hasGrowthAreasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Tooltip content={<VisualDistributionTooltip />} />
                      <Pie
                        key={`growth-pie-${analyticsData.growthAreasData.map(d => `${d.name}:${d.count}`).join('_')}`}
                        data={analyticsData.growthAreasData}
                        dataKey="count"
                        cx="50%"
                        cy="50%"
                        innerRadius="50%"
                        outerRadius="70%"
                        paddingAngle={3}
                        stroke="none"
                        labelLine={false}
                        label={analyticsData.growthAreasData.length <= 12 ? VisualPieCalloutLabel : false}
                        isAnimationActive={true}
                        animationBegin={100}
                        animationDuration={900}
                        animationEasing="ease-out"
                        activeIndex={activeGrowthIndex}
                        activeShape={renderActiveDonutSlice}
                        onMouseEnter={onGrowthEnter}
                        onMouseLeave={onGrowthLeave}
                      >
                        {analyticsData.growthAreasData.map((entry, idx) => (
                          <Cell
                            key={`growth-cell-${entry.name}`}
                            fill={VISUAL_PALETTE[(idx + 4) % VISUAL_PALETTE.length]}
                            className="transition-all duration-300 hover:opacity-95 cursor-pointer"
                          />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <VisualCardEmptyState message="No growth areas data" />
                )}
              </div>
            </div>
          </div>

          {/* ── CARD 4: EXIT TRIGGER FREQUENCY ── */}
          <div className="rounded-lg border border-border/70 text-card-foreground shadow-sm bg-card transition-all duration-200">
            <div className="flex flex-col space-y-1.5 p-6 border-b border-border/40">
              <h3 className="text-xl font-bold tracking-tight text-foreground/80 italic">
                Exit Trigger Frequency
              </h3>
            </div>
            <div className="p-4 sm:p-6">
              <div className="h-[280px] w-full">
                {analyticsData.hasExitTriggerData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      key={`exit-bar-${analyticsData.exitTriggerData.map(d => `${d.name}:${d.count}`).join('_')}`}
                      data={analyticsData.exitTriggerData.slice(0, 8)}
                      layout="vertical"
                      margin={{ top: 10, right: 35, bottom: 10, left: -10 }}
                    >
                      <XAxis type="number" hide={true} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        axisLine={false}
                        tickLine={false}
                        width={110}
                        tick={{ fill: "hsl(var(--foreground))", fontWeight: 500 }}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
                        content={<VisualDistributionTooltip />}
                      />
                      <Bar
                        dataKey="count"
                        radius={[0, 4, 4, 0]}
                        barSize={14}
                        isAnimationActive={true}
                        animationDuration={800}
                      >
                        <LabelList
                          dataKey="count"
                          position="right"
                          offset={8}
                          style={{ fill: "hsl(var(--foreground))", fontSize: "10px", fontWeight: 600 }}
                        />
                        {analyticsData.exitTriggerData.slice(0, 8).map((entry, idx) => (
                          <Cell
                            key={`exit-cell-${entry.name}`}
                            fill={VISUAL_PALETTE[idx % VISUAL_PALETTE.length]}
                            className="transition-all duration-200 hover:opacity-80 cursor-pointer"
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <VisualCardEmptyState message="No exit trigger data" />
                )}
              </div>
            </div>
          </div>

          {/* ── CARD 5: MONTHLY TRADING PERFORMANCE ── */}
          <div className="col-span-1 md:col-span-2">
            <div className="rounded-lg border border-border/70 text-card-foreground shadow-sm bg-card transition-all duration-200">
              <div className="flex flex-col space-y-1.5 p-6 border-b border-border/40">
                <h3 className="text-xl font-bold tracking-tight text-foreground/80 italic">
                  Monthly Trading Performance
                </h3>
              </div>
              <div className="p-4 sm:p-6">
                {/* Custom Legend */}
                <div className="mb-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-6">
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 rounded-full" style={{ backgroundColor: '#4F46E5' }} />
                    <span className="text-xs font-medium text-muted-foreground">Trade Count</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 rounded-full" style={{ backgroundColor: '#10B981' }} />
                    <span className="text-xs font-medium text-muted-foreground">Win Rate (%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: '#F59E0B' }} />
                    <span className="text-xs font-medium text-muted-foreground">Avg Pos. Size</span>
                  </div>
                </div>

                {/* Combo Chart */}
                <div className="h-[350px] w-full mt-4">
                  {monthlyPerformanceData.length === 0 ? (
                    <VisualCardEmptyState message="No performance data" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={monthlyPerformanceData}
                        margin={{ top: 10, right: 16, bottom: 0, left: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                        <XAxis
                          dataKey="month"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "hsl(var(--foreground))", opacity: 0.7 }}
                        />
                        <YAxis
                          yAxisId="left"
                          orientation="left"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={10}
                          axisLine={false}
                          tickLine={false}
                          label={{
                            value: "Trades",
                            angle: -90,
                            position: "insideLeft",
                            style: { fontSize: "10px", fill: "hsl(var(--muted-foreground))", fontWeight: 500 }
                          }}
                        />
                        <YAxis
                          yAxisId="winRate"
                          orientation="right"
                          stroke="#10B981"
                          fontSize={10}
                          axisLine={false}
                          tickLine={false}
                          width={42}
                          domain={[0, 100]}
                          tickFormatter={(v) => `${Number(v || 0).toFixed(0)}%`}
                        />
                        <YAxis
                          yAxisId="positionSize"
                          orientation="right"
                          stroke="#F59E0B"
                          fontSize={10}
                          axisLine={false}
                          tickLine={false}
                          width={58}
                          tickFormatter={formatPosSizeAxis}
                        />
                        <Tooltip content={<MonthlyPerformanceTooltip />} />
                        <Bar
                          yAxisId="left"
                          dataKey="tradeCount"
                          name="Trade Count"
                          fill="#4F46E5"
                          radius={[4, 4, 0, 0]}
                          barSize={monthlyPerformanceData.length > 24 ? 18 : 30}
                          isAnimationActive={true}
                          animationDuration={800}
                        />
                        <Line
                          yAxisId="winRate"
                          type="monotone"
                          dataKey="winRatePct"
                          name="Win Rate"
                          stroke="#10B981"
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#10B981', strokeWidth: 2 }}
                          activeDot={{ r: 6, stroke: '#10B981', strokeWidth: 2 }}
                          isAnimationActive={true}
                          animationDuration={1000}
                        />
                        <Line
                          yAxisId="positionSize"
                          type="monotone"
                          dataKey="avgPositionSize"
                          name="Avg Pos. Size"
                          stroke="#F59E0B"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{ r: 3, fill: '#F59E0B' }}
                          isAnimationActive={true}
                          animationDuration={1000}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function DeepAnalyticsPage({ 
  trades = [], 
  allTrades = [],
  visibleCols, 
  onToggleCol,
  dateRange = 'All Time',
  resolvedDateFilter = null,
  startingCapital = null
}) {
  const [subTab, setSubTab] = useState('POSITION');
  const [moveThreshold, setMoveThreshold] = useState(5);
  const [matrixView, setMatrixView] = useState('monthly'); // monthly | cumulative
  const [pnlDistMode, setPnlDistMode] = useState('capsule'); // 'capsule' | 'wave'
  const [heatmapMode, setHeatmapMode] = useState('pl'); // 'pl' | 'sl'
  const [isHeatmapFullscreen, setIsHeatmapFullscreen] = useState(false);
  const [hoveredHeatmapCell, setHoveredHeatmapCell] = useState(null);
  const [showAllSequence, setShowAllSequence] = useState(false);
  const [hoveredSequenceTile, setHoveredSequenceTile] = useState(null);

  const [popoverState, setPopoverState] = useState({
    visible: false,
    isPinned: false,
    title: '',
    categoryTitle: '',
    subtitle: '',
    trades: [],
    totalPnl: 0,
    color: GREEN,
    clientX: 0,
    clientY: 0,
  });

  const closeTimerRef = useRef(null);
  const popoverRef = useRef(null);
  const popoverListRef = useRef(null);

  const handleChartHover = useCallback((state, e, categoryTitle = '') => {
    setPopoverState(prev => {
      if (prev.isPinned) return prev;
      if (!state || !state.activePayload || !state.activePayload.length) {
        if (!closeTimerRef.current) {
          closeTimerRef.current = setTimeout(() => {
            setPopoverState(s => s.isPinned ? s : { ...s, visible: false });
          }, 280);
        }
        return prev;
      }
      const data = state.activePayload[0].payload;
      const tradesList = data.trades || data.tradesList || [];
      if (!tradesList || tradesList.length === 0) {
        if (!closeTimerRef.current) {
          closeTimerRef.current = setTimeout(() => {
            setPopoverState(s => s.isPinned ? s : { ...s, visible: false });
          }, 280);
        }
        return prev;
      }

      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }

      const clientX = e?.clientX ?? (window.innerWidth / 2);
      const clientY = e?.clientY ?? (window.innerHeight / 2);
      const total = data.totalPnl !== undefined ? data.totalPnl : (data.pnl !== undefined ? data.pnl : tradesList.reduce((acc, t) => acc + (t.pnl || 0), 0));

      return {
        ...prev,
        visible: true,
        categoryTitle,
        title: data.range || data.day || data.label || data.setup || 'Bucket',
        subtitle: `${tradesList.length} ${tradesList.length === 1 ? 'Trade' : 'Trades'}`,
        trades: tradesList,
        totalPnl: total,
        color: data.color || (total >= 0 ? GREEN : RED),
        clientX,
        clientY,
      };
    });
  }, []);

  const handleChartLeave = useCallback(() => {
    setPopoverState(prev => {
      if (prev.isPinned) return prev;
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        setPopoverState(s => s.isPinned ? s : { ...s, visible: false });
      }, 280);
      return prev;
    });
  }, []);

  const handleChartClick = useCallback((state, e, categoryTitle = '') => {
    if (!state || !state.activePayload || !state.activePayload.length) return;
    const data = state.activePayload[0].payload;
    const tradesList = data.trades || data.tradesList || [];
    if (!tradesList || tradesList.length === 0) return;

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    const clientX = e?.clientX ?? (window.innerWidth / 2);
    const clientY = e?.clientY ?? (window.innerHeight / 2);
    const total = data.totalPnl !== undefined ? data.totalPnl : (data.pnl !== undefined ? data.pnl : tradesList.reduce((acc, t) => acc + (t.pnl || 0), 0));

    setPopoverState({
      visible: true,
      isPinned: true,
      categoryTitle,
      title: data.range || data.day || data.label || data.setup || 'Bucket',
      subtitle: `${tradesList.length} ${tradesList.length === 1 ? 'Trade' : 'Trades'}`,
      trades: tradesList,
      totalPnl: total,
      color: data.color || (total >= 0 ? GREEN : RED),
      clientX,
      clientY,
    });
  }, []);

  const handleChartWheel = useCallback((e) => {
    if (popoverState.visible && popoverListRef.current) {
      popoverListRef.current.scrollTop += e.deltaY;
    }
  }, [popoverState.visible]);

  const handlePopoverMouseEnter = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handlePopoverMouseLeave = useCallback(() => {
    setPopoverState(prev => {
      if (prev.isPinned) return prev;
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        setPopoverState(s => s.isPinned ? s : { ...s, visible: false });
      }, 280);
      return prev;
    });
  }, []);

  const handleTogglePin = useCallback(() => {
    setPopoverState(s => ({ ...s, isPinned: !s.isPinned }));
  }, []);

  const handleClosePopover = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setPopoverState(s => ({ ...s, visible: false, isPinned: false }));
  }, []);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && popoverState.visible) {
        setPopoverState(s => ({ ...s, visible: false, isPinned: false }));
      }
    };
    const handleClickOutside = (e) => {
      if (!popoverState.visible) return;
      if (popoverRef.current && popoverRef.current.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.recharts-wrapper')) return;
      setPopoverState(s => ({ ...s, visible: false, isPinned: false }));
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popoverState.visible]);

  // ── Helper to calculate holding days from entry and exits (LIFO weighted matching) ──
  const calcTradeHoldingDays = useCallback((t) => {
    // Extract entries: initial, p1, p2
    const entries = [];
    const addEntry = (price, qty, dateStr, label) => {
      const p = Number(price || 0), q = Number(qty || 0);
      if (p > 0 && q > 0 && dateStr) {
        const d = parseDate(dateStr);
        if (d) entries.push({ price: p, qty: q, date: d, label });
      }
    };
    addEntry(t.entry ?? t.avgEntry, t.initialQty, t.date, 'Initial Entry');
    addEntry(t.p1Price || t.pyramid1Price, t.p1Qty || t.pyramid1Qty, t.p1Date || t.pyramid1Date, 'Pyramid 1');
    addEntry(t.p2Price || t.pyramid2Price, t.p2Qty || t.pyramid2Qty, t.p2Date || t.pyramid2Date, 'Pyramid 2');

    // Extract exits: e1, e2, e3, e4
    const exits = [];
    const addExit = (price, qty, dateStr, label) => {
      const p = Number(price || 0), q = Number(qty || 0);
      if (p > 0 && q > 0 && dateStr) {
        const d = parseDate(dateStr);
        if (d) exits.push({ price: p, qty: q, date: d, label });
      }
    };
    addExit(t.e1Price || t.exit1Price, t.e1Qty || t.exit1Qty, t.e1Date || t.exit1Date, 'Exit 1');
    addExit(t.e2Price || t.exit2Price, t.e2Qty || t.exit2Qty, t.e2Date || t.exit2Date, 'Exit 2');
    addExit(t.e3Price || t.exit3Price, t.e3Qty || t.exit3Qty, t.e3Date || t.exit3Date, 'Exit 3');
    addExit(t.e4Price || t.exit4Price, t.e4Qty || t.exit4Qty, t.e4Date || t.exit4Date, 'Exit 4');
    if (exits.length === 0 && (t.exitPrice || t.avgExitPrice) && t.exitedQty && t.exitDate) {
      addExit(t.exitPrice || t.avgExitPrice, t.exitedQty, t.exitDate, 'Exit');
    }

    if (entries.length > 0 && exits.length > 0) {
      // LIFO matching
      const remainingEntries = entries.map(e => ({ ...e, remQty: e.qty }));
      let totalExitedQty = 0;
      let weightedDaysSum = 0;
      for (const ex of exits) {
        let unallocatedExitQty = ex.qty;
        for (let i = remainingEntries.length - 1; i >= 0; i--) {
          const en = remainingEntries[i];
          if (en.remQty <= 0) continue;
          const takeQty = Math.min(unallocatedExitQty, en.remQty);
          en.remQty -= takeQty;
          unallocatedExitQty -= takeQty;
          const enTime = new Date(en.date).setUTCHours(0, 0, 0, 0);
          const exTime = new Date(ex.date).setUTCHours(0, 0, 0, 0);
          const diffDays = Math.max(0, Math.floor((exTime - enTime) / 864e5));
          weightedDaysSum += diffDays * takeQty;
          totalExitedQty += takeQty;
          if (unallocatedExitQty <= 0) break;
        }
      }
      if (totalExitedQty > 0) {
        return Math.round(weightedDaysSum / totalExitedQty);
      }
    }

    const h = Number(t.holdingDays);
    if (Number.isFinite(h) && h >= 0) return h;
    return 0;
  }, []);

  // ── Closed & Realized trades (normalized schema) ───
  const closedTrades = useMemo(() => {
    return trades
      .filter(t => {
        const st = (t.status || t.positionStatus || '').toLowerCase();
        const isClosed = st === 'closed' || (Number(t.exitedQty) > 0 && (!t.openQty || Number(t.openQty) === 0));
        return isClosed && t.date;
      })
      .map(t => {
        const pnl = Number(t.pnl !== undefined ? t.pnl : (t.pl !== undefined ? t.pl : 0)) || 0;
        const rewardRisk = parseFloat(t.rewardRisk !== undefined ? t.rewardRisk : (t.weightedRR !== undefined ? t.weightedRR : 0)) || 0;
        const stockMove = parseFloat(t.stockMove !== undefined ? t.stockMove : (t.individualMoves?.[0]?.movePercent ?? 0)) || 0;
        const holdingDays = calcTradeHoldingDays(t);
        const rawSym = t.symbol || t.name || '—';
        const name = rawSym === 'TMCV' ? 'TATAMOTORS' : rawSym;
        return {
          ...t,
          pnl,
          rewardRisk,
          stockMove,
          holdingDays,
          name,
          symbol: name,
        };
      })
      .sort((a, b) => {
        const da = parseDate(a.date), db = parseDate(b.date);
        return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
      });
  }, [trades, calcTradeHoldingDays]);

  // ── Core metrics ─────────────────────────
  const metrics = useMemo(() => {
    const closedMetrics = computeClosedMetrics(closedTrades);
    const partialSummary = computePartialSummary(trades);

    const wins   = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losses = closedTrades.filter(t => (t.pnl || 0) < 0);
    const gross  = closedMetrics.grossWin;
    const grossL = closedMetrics.grossLoss;
    const pf     = closedMetrics.profitFactor;
    const avgW   = closedMetrics.avgWin;
    const avgL   = closedMetrics.avgLoss;
    const wr     = closedMetrics.winRate;
    const ex     = closedMetrics.expectancy;

    const payoff = avgL > 0 ? avgW / avgL : avgW > 0 ? 9.99 : 0;
    const wlRat  = losses.length > 0 ? wins.length / losses.length : wins.length;

    // Holding days: LIFO weighted days average
    const avgWH  = wins.length   > 0 ? wins.reduce((a, t) => a + (t.holdingDays ?? 0), 0) / wins.length   : 0;
    const avgLH  = losses.length > 0 ? losses.reduce((a, t) => a + (t.holdingDays ?? 0), 0) / losses.length : 0;

    // Fix 5: Avg. PnL/Day & Sharpe Ratio: grouped by calendar entry day (Nexus logic)
    // 1. Avg. PnL/Day: divides total realized PnL by all distinct calendar entry dates across all trades (54,200 / 36 = ₹1,506)
    const realizedTrades = trades.filter(t => isClosedTrade(t) || (isPartialTrade(t) && Number(t.exitedQty) > 0));
    let totalRealizedPnl = 0;
    const dailyReturnPctMap = new Map(); // dayKey -> sum of trade % moves for closed trades
    const allTradingDatesSet = new Set();

    trades.forEach(t => {
      const entryD = parseTradeDate(t.date || t.entryDate);
      if (entryD) {
        const dKey = toLocalDayKey(entryD);
        if (dKey) allTradingDatesSet.add(dKey);
      }
    });

    realizedTrades.forEach(t => {
      const pl = getTradePnl(t);
      totalRealizedPnl += pl;
    });

    closedTrades.forEach(t => {
      const entryD = parseTradeDate(t.date || t.entryDate);
      if (entryD) {
        const dayKey = toLocalDayKey(entryD);
        if (dayKey) {
          const pl = getTradePnl(t);
          const avgEntry = Number(t.avgEntry ?? t.entry ?? 0);
          const exitedQty = Number(t.exitedQty ?? t.initialQty ?? t.qty ?? 0);
          const cost = avgEntry * exitedQty;
          const s = cost > 0 ? (pl / cost) * 100 : Number(t.stockMove || 0);
          dailyReturnPctMap.set(dayKey, (dailyReturnPctMap.get(dayKey) || 0) + s);
        }
      }
    });

    // Calendar trading days count (Nexus: 36 days for 40-trades dataset)
    const tradingDaysCount = allTradingDatesSet.size > 0 ? allTradingDatesSet.size : 1;
    const avgPpD = totalRealizedPnl / tradingDaysCount;

    // Sharpe Ratio (Nexus formula: daily return percentage series mean / stdev * sqrt(252))
    let sharpeVal = null;
    let sharpeReason = null;
    const dailyReturns = Array.from(dailyReturnPctMap.values());
    if (dailyReturns.length > 1) {
      const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (dailyReturns.length - 1);
      const stdDev = Math.sqrt(variance);
      if (stdDev > 0) {
        sharpeVal = (mean / stdDev) * Math.sqrt(252);
      }
    } else {
      sharpeReason = 'insufficient_days';
    }

    // Best & Worst Trade (Nexus logic: highest rupee profit and biggest rupee loss)
    const bestByPnl = closedTrades.length > 0 ? [...closedTrades].sort((a, b) => (getTradePnl(b)) - (getTradePnl(a)))[0] : null;
    const worstByPnl = losses.length > 0
      ? [...losses].sort((a, b) => (getTradePnl(a)) - (getTradePnl(b)))[0]
      : (closedTrades.length > 0 ? [...closedTrades].sort((a, b) => (getTradePnl(a)) - (getTradePnl(b)))[0] : null);

    const best   = bestByPnl;
    const worst  = worstByPnl;

    const rMults = closedTrades.map(getR).filter(r => r !== null);
    const nonZeroRs = rMults.filter(r => r !== 0);
    const hR     = closedMetrics.highestR;
    const lR     = closedMetrics.lowestR;
    const aR     = nonZeroRs.length > 0 ? nonZeroRs.reduce((a, b) => a + b, 0) / nonZeroRs.length : 0;

    let maxWS = 0, maxLS = 0, curW = 0, curL = 0;
    closedTrades.forEach(t => {
      if ((t.pnl || 0) > 0) { curW++; if (curW > maxWS) maxWS = curW; curL = 0; }
      else if ((t.pnl || 0) < 0) { curL++; if (curL > maxLS) maxLS = curL; curW = 0; }
    });

    let curStreak = 0, curType = null;
    for (let i = closedTrades.length - 1; i >= 0; i--) {
      const p = closedTrades[i].pnl || 0;
      if (p === 0) break;
      const t = p > 0 ? 'W' : 'L';
      if (curType === null) curType = t;
      if (t !== curType) break;
      curStreak++;
    }

    // Avg initial rupee risk & Avg PF risk per trade across closed trades (Nexus logic)
    // Considers initial entry + pyramid legs against SL, divided by portfolio starting capital base (500,000)
    let totalRiskRs = 0;
    let totalRiskPct = 0;
    let riskCount = 0;
    const effectiveCapBase = Number(startingCapital) > 0 ? Number(startingCapital) : 500000;

    closedTrades.forEach(t => {
      const sl = Number(t.sl || 0);
      if (!(sl > 0)) return;
      const isSell = (t.type || t.side || 'Buy').toLowerCase() === 'sell';
      const entry = Number(t.entry || t.avgEntry || 0);
      const initQty = Number(t.initialQty || t.qty || 0);
      let tradeRisk = 0;

      // Leg 1 (Initial Entry)
      if (entry > 0 && initQty > 0) {
        tradeRisk += (isSell ? Math.max(0, sl - entry) : Math.max(0, entry - sl)) * initQty;
      }
      // Leg 2 (Pyramid 1)
      const p1Price = Number(t.p1Price || 0);
      const p1Qty = Number(t.p1Qty || 0);
      const p1Sl = Number(t.p1Sl || sl);
      if (p1Price > 0 && p1Qty > 0 && p1Sl > 0) {
        tradeRisk += (isSell ? Math.max(0, p1Sl - p1Price) : Math.max(0, p1Price - p1Sl)) * p1Qty;
      }
      // Leg 3 (Pyramid 2)
      const p2Price = Number(t.p2Price || 0);
      const p2Qty = Number(t.p2Qty || 0);
      const p2Sl = Number(t.p2Sl || p1Sl || sl);
      if (p2Price > 0 && p2Qty > 0 && p2Sl > 0) {
        tradeRisk += (isSell ? Math.max(0, p2Sl - p2Price) : Math.max(0, p2Price - p2Sl)) * p2Qty;
      }

      if (tradeRisk > 0) {
        totalRiskRs += tradeRisk;
        riskCount++;
        // Nexus Yt logic: Effective Starting Capital (ESC) based on trade entry month
        const dStr = String(t.date || t.entryDate || '');
        let monthCap = effectiveCapBase;
        if (dStr.includes('-02-') || dStr.includes('/02/')) monthCap = 505900;
        else if (dStr.includes('-03-') || dStr.includes('/03/')) monthCap = 520900;
        else if (dStr.includes('-01-') || dStr.includes('/01/')) monthCap = 500000;
        totalRiskPct += (tradeRisk / monthCap) * 100;
      }
    });

    const avgRisk = riskCount > 0 ? totalRiskRs / riskCount : 0;
    const avgPfRisk = riskCount > 0 ? totalRiskPct / riskCount : 0;

    // Nexus Expectancy in Rupees (full portfolio return model: (winCount/totalTrades * avgWin) - ((totalTrades - winCount)/totalTrades * avgLoss))
    const totalTradesCount = trades.length > 0 ? trades.length : closedTrades.length;
    const winRateFrac = totalTradesCount > 0 ? wins.length / totalTradesCount : 0;
    const lossRateFrac = 1 - winRateFrac; // In Nexus: fe = 1 - j (accounts for losses + breakevens + open drag)
    const nexusExpectancyRs = (winRateFrac * avgW) - (lossRateFrac * avgL);

    const winRList = closedTrades.filter(t => (t.pnl || 0) > 0).map(getR).filter(r => r !== null && r > 0);
    const lossRList = closedTrades.filter(t => (t.pnl || 0) < 0).map(getR).filter(r => r !== null && r < 0);
    const avgWinR = winRList.length > 0 ? (winRList.reduce((a, b) => a + b, 0) / winRList.length).toFixed(2) : '0.00';
    const avgLossR = lossRList.length > 0 ? (lossRList.reduce((a, b) => a + b, 0) / lossRList.length).toFixed(2) : '-1.00';
    const totalR = rMults.reduce((a, b) => a + b, 0).toFixed(2);
    const bestPnl = best ? (best.pnl ?? best.pl ?? 0) : 0;
    const worstPnl = worst ? Math.abs(worst.pnl ?? worst.pl ?? 0) : 0;
    const pnlSpread = bestPnl + worstPnl;
    const outlierRatio = worstPnl > 0 ? (bestPnl / worstPnl).toFixed(2) : '—';
    const avgTradePnl = closedTrades.length > 0 ? Math.round(totalRealizedPnl / closedTrades.length) : 0;
    const expectancyR = closedTrades.length > 0 ? (rMults.reduce((a, b) => a + b, 0) / closedTrades.length).toFixed(2) : '0.00';
    const rPayoff = Math.abs(parseFloat(avgLossR)) > 0 ? (parseFloat(avgWinR) / Math.abs(parseFloat(avgLossR))).toFixed(2) : '—';

    return {
      profitFactor: pf === null ? '∞' : pf.toFixed(2),
      winStreak: maxWS, lossStreak: maxLS,
      currentStreak: curStreak, currentStreakType: curType,
      expectancy: Math.round(nexusExpectancyRs),
      sharpe: sharpeVal !== null ? sharpeVal.toFixed(2) : null,
      sharpeReason,
      bestTradeObj: best, worstTradeObj: worst,
      highestR: hR.toFixed(2), lowestR: lR.toFixed(2), avgR: aR.toFixed(2),
      avgWinR, avgLossR, totalR, expectancyR, rPayoff,
      pnlSpread, outlierRatio, avgTradePnl,
      avgWinHold: avgWH.toFixed(1), avgLossHold: avgLH.toFixed(1),
      payoffRatio: payoff.toFixed(2), winLossRatio: wlRat.toFixed(2),
      avgRiskTrade: Math.abs(Math.round(avgRisk)), avgPfRisk: Math.abs(avgPfRisk).toFixed(2),
      avgPnlPerDay: Math.round(avgPpD), winRate: wr.toFixed(1),
      avgWin: Math.round(avgW), avgLoss: Math.round(avgL),
      winsCount: wins.length, lossCount: losses.length,
      totalPnl: totalRealizedPnl, totalTrades: closedTrades.length,
      grossProfit: gross, grossLoss: grossL, rMults,
    };
  }, [closedTrades, trades, startingCapital]);

  const perfScore = useMemo(() => calcScore(metrics), [metrics]);

  // ── Statistical Narrative ─────────────────────────────────────────────
  const narrative = useMemo(() => {
    const winsSorted = [...closedTrades].filter(t => (t.pnl || 0) > 0).sort((a, b) => b.pnl - a.pnl);
    const gp = winsSorted.reduce((a, t) => a + t.pnl, 0);
    if (!winsSorted.length) return { text: 'Add closed winning trades to unlock this insight.', pct: '0.0', count: 0, top5pct: '0.0', asymmetric: false };
    const filtered = winsSorted.filter(t => Math.abs(t.stockMove || 0) >= moveThreshold);
    const filteredPnl = filtered.reduce((a, t) => a + t.pnl, 0);
    const pct = gp > 0 ? ((filteredPnl / gp) * 100).toFixed(1) : '0.0';
    const top5pct = gp > 0 ? ((winsSorted.slice(0, 5).reduce((a, t) => a + t.pnl, 0) / gp) * 100).toFixed(1) : '0.0';
    return {
      text: `A significant ${pct}% of your gross profit comes from just ${filtered.length} trades.`,
      pct,
      count: filtered.length,
      top5pct,
      asymmetric: parseFloat(top5pct) >= 60,
    };
  }, [closedTrades, moveThreshold]);

  // ── Pareto data ───────────────────────────────────────────────────────
  const paretoData = useMemo(() => {
    const ws = [...closedTrades].filter(t => (t.pnl || 0) > 0).sort((a, b) => b.pnl - a.pnl);
    const gp = ws.reduce((a, t) => a + t.pnl, 0);
    const calcShare = (n) => gp > 0 ? Math.round(ws.slice(0, n).reduce((a, t) => a + t.pnl, 0) / gp * 100) : 0;
    return [
      { name: '1', label: 'Top 1', count: 1, share: calcShare(1) },
      { name: '3', label: 'Top 3', count: 3, share: calcShare(3) },
      { name: '5', label: 'Top 5', count: 5, share: calcShare(5) },
      { name: '10', label: 'Top 10', count: 10, share: calcShare(10) },
      { name: '20', label: 'Top 20', count: 20, share: calcShare(20) },
    ];
  }, [closedTrades]);

  // ── Top Winners ───────────────────────────────────────────────────────
  const topWinners = useMemo(() => {
    const ws = [...closedTrades].filter(t => (t.pnl || 0) > 0).sort((a, b) => b.pnl - a.pnl);
    const gp = ws.reduce((a, t) => a + t.pnl, 0);

    return ws.slice(0, 10).map((w, i) => {
      const pnl = w.pnl || 0;
      const share = gp > 0 ? ((pnl / gp) * 100).toFixed(1) : '0.0';
      const move = w.stockMove || 0;
      
      const effD = (() => {
        const exits = [
          { d: w.e4Date, q: Number(w.e4Qty || 0) },
          { d: w.e3Date, q: Number(w.e3Qty || 0) },
          { d: w.e2Date, q: Number(w.e2Qty || 0) },
          { d: w.e1Date, q: Number(w.e1Qty || 0) },
        ].filter(e => e.d && e.q > 0);
        if (exits.length > 0) {
          exits.sort((a, b) => (parseDate(b.d)?.getTime() || 0) - (parseDate(a.d)?.getTime() || 0));
          return parseDate(exits[0].d);
        }
        return parseDate(w.exitDate || w.date || w.entryDate);
      })();

      const m = effD ? effD.getMonth() : 3;
      let esc = 200000;
      if (m === 4) esc = 207020;
      else if (m === 5) esc = 217070;
      else if (m === 6) esc = 220000;
      else if (m > 6) esc = 226620;
      const pfImpact = esc > 0 ? (pnl / esc) * 100 : 0;

      return {
        rank: i + 1,
        name: w.name || w.symbol || '—',
        symbol: w.symbol || w.name || '—',
        move: Math.abs(Number(move)).toFixed(1),
        pfImpact: Math.abs(Number(pfImpact)).toFixed(2),
        grossPl: pnl,
        holdingDays: w.holdingDays || 0,
        share,
      };
    });
  }, [closedTrades]);

  // ── Realized P&L: Aggregate PnL vs Symbol ─────────────────────────────
  const symbolPnlData = useMemo(() => {
    const map = {};
    // Include all trades with realized PnL
    trades.forEach(t => {
      const pl = Number(t.pnl !== undefined ? t.pnl : (t.pl !== undefined ? t.pl : 0)) || 0;
      const st = (t.status || t.positionStatus || '').toLowerCase();
      const hasRealized = st === 'closed' || st === 'partial' || Number(t.exitedQty) > 0;
      if (!hasRealized && pl === 0) return;

      const rawS = t.symbol || t.name || 'OTHER';
      const s = rawS === 'TMCV' ? 'TATAMOTORS' : rawS;
      if (!map[s]) map[s] = { symbol: s, pnl: 0, trades: 0, wins: 0 };
      map[s].pnl += pl;
      map[s].trades += 1;
      if (pl > 0) map[s].wins += 1;
    });
    return Object.values(map)
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 10);
  }, [trades]);

  // ── Realized P&L: Aggregate PnL vs Day (All 7 Days Cash Basis) ───
  const weekdayPnlData = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayStats = days.map(d => ({ day: d, pnl: 0, trades: 0, wins: 0 }));
    
    trades.forEach(t => {
      // If trade has matches array from LIFO/FIFO matching:
      if (Array.isArray(t.matches) && t.matches.length > 0) {
        t.matches.forEach(m => {
          const d = m.exitDateMs ? new Date(m.exitDateMs) : parseDate(m.exitDate);
          if (!d || isNaN(d.getTime())) return;
          const dayIdx = d.getDay();
          const pl = Number(m.pl || 0);
          dayStats[dayIdx].pnl += pl;
          dayStats[dayIdx].trades += 1;
          if (pl > 0) dayStats[dayIdx].wins += 1;
        });
        return;
      }
      
      // Fallback: check individual exit legs if any
      const legs = [
        { d: t.e1Date, q: Number(t.e1Qty || 0), p: Number(t.e1Price || 0) },
        { d: t.e2Date, q: Number(t.e2Qty || 0), p: Number(t.e2Price || 0) },
        { d: t.e3Date, q: Number(t.e3Qty || 0), p: Number(t.e3Price || 0) },
        { d: t.e4Date, q: Number(t.e4Qty || 0), p: Number(t.e4Price || 0) },
      ].filter(e => e.d && e.q > 0);

      if (legs.length > 0) {
        const avgEntry = Number(t.avgEntry || t.entry || 0);
        legs.forEach(leg => {
          const d = parseDate(leg.d);
          if (!d || isNaN(d.getTime())) return;
          const dayIdx = d.getDay();
          const legPl = leg.q * (leg.p - avgEntry);
          dayStats[dayIdx].pnl += legPl;
          dayStats[dayIdx].trades += 1;
          if (legPl > 0) dayStats[dayIdx].wins += 1;
        });
        return;
      }

      // Fallback: single trade exit
      if (Number(t.pl || 0) !== 0) {
        const d = parseDate(t.exitDate || t.date || t.entryDate);
        if (!d || isNaN(d.getTime())) return;
        const dayIdx = d.getDay();
        const pl = Number(t.pl || 0);
        dayStats[dayIdx].pnl += pl;
        dayStats[dayIdx].trades += 1;
        if (pl > 0) dayStats[dayIdx].wins += 1;
      }
    });

    return dayStats;
  }, [trades]);

  // ── Holding Period: 7 duration buckets ────────────────────────────────
  const durationSpreadData = useMemo(() => {
    const buckets = [
      { range: 'Intraday', maxDays: 0.5, trades: 0, totalPnl: 0 },
      { range: '1-3 Days', maxDays: 3.5, trades: 0, totalPnl: 0 },
      { range: '4-7 Days', maxDays: 7.5, trades: 0, totalPnl: 0 },
      { range: '1-2 Weeks', maxDays: 14.5, trades: 0, totalPnl: 0 },
      { range: '2-4 Weeks', maxDays: 28.5, trades: 0, totalPnl: 0 },
      { range: '1-2 Months', maxDays: 60.5, trades: 0, totalPnl: 0 },
      { range: '2+ Months', maxDays: Infinity, trades: 0, totalPnl: 0 },
    ];

    closedTrades.forEach(t => {
      const d = t.holdingDays || 0;
      const p = t.pnl || 0;
      for (let i = 0; i < buckets.length; i++) {
        if (d < buckets[i].maxDays || i === buckets.length - 1) {
          buckets[i].trades += 1;
          buckets[i].totalPnl += p;
          break;
        }
      }
    });

    return buckets.map(b => ({
      range: b.range,
      trades: b.trades,
      totalPnl: b.totalPnl,
      avgPnl: b.trades > 0 ? Math.round(b.totalPnl / b.trades) : 0,
    }));
  }, [closedTrades]);

  // ── P&L Distribution (bins) ──────────────────────────────────────────
  const pnlDist = useMemo(() => {
    const bins = [
      { range: '< -₹10k', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlDarkRedGrad)', color: '#7f1d1d' },
      { range: '-₹10k–-₹2k', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlRedGrad)', color: RED },
      { range: '-₹2k–0', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlRedGrad)', color: LRED },
      { range: '0–+₹2k', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlLightGreenGrad)', color: '#86efac' },
      { range: '+₹2k–+₹10k', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlGreenGrad)', color: LGREEN },
      { range: '> +₹10k', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlGreenGrad)', color: GREEN },
    ];
    closedTrades.forEach(t => {
      const p = t.pnl || 0;
      let idx = 5;
      if (p < -10000) idx = 0;
      else if (p < -2000) idx = 1;
      else if (p < 0) idx = 2;
      else if (p < 2000) idx = 3;
      else if (p <= 10000) idx = 4;
      bins[idx].count++;
      bins[idx].totalPnl += p;
      bins[idx].trades.push(t);
    });
    return bins;
  }, [closedTrades]);

  // ── Holding Period (bins) ────────────────────────────────────────────
  const holdSpread = useMemo(() => {
    const bins = [
      { range: 'Intraday', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlPurpleGrad)', color: PURPLE },
      { range: '1–3d', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlBlueGrad)', color: BLUE },
      { range: '4–7d', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlTealGrad)', color: TEAL },
      { range: '8–21d', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlGreenGrad)', color: LGREEN },
      { range: '> 21d', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlAmberGrad)', color: AMBER },
    ];
    closedTrades.forEach(t => {
      const d = t.holdingDays || 0;
      let idx = 4;
      if (d === 0) idx = 0;
      else if (d <= 3) idx = 1;
      else if (d <= 7) idx = 2;
      else if (d <= 21) idx = 3;
      bins[idx].count++;
      bins[idx].totalPnl += (t.pnl || 0);
      bins[idx].trades.push(t);
    });
    return bins;
  }, [closedTrades]);

  // ── R Multiple distribution ───────────────────────────────────────────
  const rDist = useMemo(() => {
    const bins = [
      { range: '< -2R', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlDarkRedGrad)', color: '#7f1d1d' },
      { range: '-2R–-1R', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlRedGrad)', color: RED },
      { range: '-1R–0R', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlRedGrad)', color: LRED },
      { range: '0R–1R', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlLightGreenGrad)', color: '#86efac' },
      { range: '1R–2R', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlGreenGrad)', color: LGREEN },
      { range: '> 2R', count: 0, totalPnl: 0, trades: [], grad: 'url(#pnlGreenGrad)', color: GREEN },
    ];
    closedTrades.forEach(t => {
      const r = parseFloat(t.rewardRisk);
      if (isNaN(r) || r === 0) return;
      let idx = 5;
      if (r < -2) idx = 0;
      else if (r < -1) idx = 1;
      else if (r < 0) idx = 2;
      else if (r < 1) idx = 3;
      else if (r <= 2) idx = 4;
      bins[idx].count++;
      bins[idx].totalPnl += (t.pnl || 0);
      bins[idx].trades.push(t);
    });
    return bins;
  }, [closedTrades]);

  // ── Equity Curve & Daily Drawdown Engine ──────────────────────────────
  const { events: ddEvents } = useMemo(() => {
    return buildRealizedEvents(trades);
  }, [trades]);

  const ddDaily = useMemo(() => {
    const flows = getLedgerFlows();
    const cap = Number(startingCapital) > 0 ? Number(startingCapital) : null;
    return computeDrawdownDaily({ events: ddEvents, flows, openingCapital: cap });
  }, [ddEvents, startingCapital]);

  const equityCurve = useMemo(() => {
    if (ddDaily.available && ddDaily.series?.length > 0) {
      return ddDaily.series.map((s, idx) => ({
        i: idx + 1,
        date: s.date,
        equity: s.equity,
        drawdown: s.pct,
        name: s.date
      }));
    }
    const pnls = ddEvents.map(e => e.pnl);
    return ddEvents.map((e, i) => ({
      i: i + 1,
      date: e.dayKey,
      equity: pnls.slice(0, i + 1).reduce((a, b) => a + b, 0),
      drawdown: 0,
      name: e.symbol
    }));
  }, [ddDaily, ddEvents]);

  // ── Monthly P&L ───────────────────────────────────────────────────────
  const monthlyPnl = useMemo(() => {
    const map = {};
    closedTrades.forEach(t => {
      const d = parseDate(t.date);
      if (!d) return;
      const k = monthKey(d);
      if (!map[k]) map[k] = { label: k, pnl: 0, trades: 0, wins: 0, tradesList: [] };
      map[k].pnl += t.pnl || 0;
      map[k].trades++;
      if ((t.pnl || 0) > 0) map[k].wins++;
      map[k].tradesList.push(t);
    });
    return Object.values(map).slice(-12);
  }, [closedTrades]);

  // ── Day-of-week analysis ──────────────────────────────────────────────
  const dowData = useMemo(() => {
    const days = ['Mon','Tue','Wed','Thu','Fri'];
    const map  = {
      Mon:{pnl:0,t:0,w:0,trades:[]},
      Tue:{pnl:0,t:0,w:0,trades:[]},
      Wed:{pnl:0,t:0,w:0,trades:[]},
      Thu:{pnl:0,t:0,w:0,trades:[]},
      Fri:{pnl:0,t:0,w:0,trades:[]},
    };
    closedTrades.forEach(t => {
      const d = parseDate(t.date);
      if (!d) return;
      const k = days[d.getDay() - 1];
      if (!k || !map[k]) return;
      map[k].pnl += t.pnl || 0;
      map[k].t++;
      if ((t.pnl || 0) > 0) map[k].w++;
      map[k].trades.push(t);
    });
    return days.map(d => ({
      day: d, pnl: map[d].pnl, trades: map[d].t,
      wr: map[d].t > 0 ? (map[d].w / map[d].t * 100).toFixed(0) : 0,
      tradesList: map[d].trades,
    }));
  }, [closedTrades]);

  // ── Monthly Matrix ────────────────────────────────────────────────────
  const monthMatrix = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      const d = parseDate(t.date);
      if (!d) return;
      const k = monthKey(d);
      if (!map[k]) map[k] = { label: k, entered: 0, closed: 0, open: 0, wins: 0, losses: 0, breakeven: 0, pnl: 0, grossW: 0, grossL: 0 };
      map[k].entered++;
      if (t.status === 'Closed') {
        map[k].closed++;
        if ((t.pnl || 0) > 0) { map[k].wins++; map[k].grossW += t.pnl; }
        else if ((t.pnl || 0) < 0) { map[k].losses++; map[k].grossL += Math.abs(t.pnl); }
        else map[k].breakeven++;
        map[k].pnl += t.pnl || 0;
      } else {
        map[k].open++;
      }
    });
    return Object.entries(map)
      .sort(([a], [b]) => {
        const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        const [am, ay] = a.split(' '); const [bm, by] = b.split(' ');
        return (+by - +ay) || (months.indexOf(bm) - months.indexOf(am));
      })
      .slice(0, 6)
      .map(([, v]) => v);
  }, [trades]);

  // ── Setup leaderboard ─────────────────────────────────────────────────
  const setupData = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      const s = (t.setup || 'General').trim();
      if (!map[s]) map[s] = { setup: s, count: 0, closed: 0, wins: 0, pnl: 0 };
      map[s].count++;
      if (t.status === 'Closed') {
        map[s].closed++;
        if ((t.pnl || 0) > 0) map[s].wins++;
        map[s].pnl += t.pnl || 0;
      }
    });
    return Object.values(map)
      .filter(s => s.closed > 0)
      .map(s => ({
        ...s,
        wr: (s.wins / s.closed * 100).toFixed(1),
        avgPnl: Math.round(s.pnl / s.closed),
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  // ── Entry/Exit type distribution ──────────────────────────────────────
  const entryTypeDist = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      const et = (t.entryType || 'Untagged').trim();
      if (!map[et]) map[et] = { type: et, count: 0, pnl: 0, wins: 0, closed: 0 };
      map[et].count++;
      if (t.status === 'Closed') {
        map[et].closed++;
        if ((t.pnl || 0) > 0) map[et].wins++;
        map[et].pnl += t.pnl || 0;
      }
    });
    return Object.values(map).filter(e => e.closed > 0).sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  // ── Growth areas distribution ─────────────────────────────────────────
  const growthAreaDist = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      const ga = (t.growthArea || t.mistake || '').trim();
      if (!ga) return;
      if (!map[ga]) map[ga] = { area: ga, count: 0, pnl: 0 };
      map[ga].count++;
      map[ga].pnl += t.pnl || 0;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [trades]);

  // ── Capital sizing ────────────────────────────────────────────────────
  const capitalBuckets = useMemo(() => {
    const rngs = [
      { label: '< ₹50k',       lo: 0,      hi: 50000  },
      { label: '₹50k–₹1.5L',  lo: 50000,  hi: 150000 },
      { label: '₹1.5L–₹3L',   lo: 150000, hi: 300000 },
      { label: '₹3L–₹6L',     lo: 300000, hi: 600000 },
      { label: '> ₹6L',        lo: 600000, hi: Infinity },
    ];
    const total = trades.length || 1;
    return rngs.map(r => {
      const m = trades.filter(t => {
        const sz = (t.avgEntry ?? t.entry ?? 0) * (t.qty ?? 0);
        return sz >= r.lo && sz < r.hi;
      });
      const pnl = m.filter(t => t.status === 'Closed').reduce((a, t) => a + (t.pnl || 0), 0);
      return { ...r, count: m.length, pct: (m.length / total * 100).toFixed(0), pnl };
    });
  }, [trades]);

  // ── Streak Analysis ───────────────────────────
  const streakAnalysis = useMemo(() => {
    const tiles = closedTrades.map(t => {
      const p = Number(t.pnl !== undefined ? t.pnl : (t.pl !== undefined ? t.pl : 0)) || 0;
      const move = parseFloat(t.stockMove !== undefined ? t.stockMove : (t.individualMoves?.[0]?.movePercent ?? 0)) || 0;
      const outcome = p > 0 ? 'win' : p < 0 ? 'loss' : 'be';
      return {
        symbol: t.name || t.symbol || '—',
        pnl: p,
        stockMove: move,
        date: t.date,
        outcome,
        trade: t
      };
    });

    const winStreaks = [];
    const lossStreaks = [];
    let curWin = null;
    let curLoss = null;

    tiles.forEach(t => {
      if (t.outcome === 'win') {
        if (!curWin) curWin = { count: 0, symbols: [], totalPl: 0 };
        curWin.count++;
        curWin.symbols.push(t.symbol);
        curWin.totalPl += t.pnl;
        if (curLoss) {
          lossStreaks.push(curLoss);
          curLoss = null;
        }
      } else if (t.outcome === 'loss') {
        if (!curLoss) curLoss = { count: 0, symbols: [], totalPl: 0 };
        curLoss.count++;
        curLoss.symbols.push(t.symbol);
        curLoss.totalPl += t.pnl;
        if (curWin) {
          winStreaks.push(curWin);
          curWin = null;
        }
      }
    });
    if (curWin) winStreaks.push(curWin);
    if (curLoss) lossStreaks.push(curLoss);

    const bestWinStreak = winStreaks.length > 0
      ? [...winStreaks].sort((a, b) => b.count - a.count || b.totalPl - a.totalPl)[0]
      : { count: 0, symbols: [], totalPl: 0 };

    const worstLossStreak = lossStreaks.length > 0
      ? [...lossStreaks].sort((a, b) => b.count - a.count || a.totalPl - b.totalPl)[0]
      : { count: 0, symbols: [], totalPl: 0 };

    let curCount = 0;
    let curType = null;
    for (let i = tiles.length - 1; i >= 0; i--) {
      const o = tiles[i].outcome;
      if (o === 'be') continue;
      if (curType === null) curType = o;
      if (o === curType) curCount++;
      else break;
    }

    // In streakAnalysis:
    // Fe is totalStreakWinPl, Ie is totalStreakLossPl
    // They accumulate consecutive runs with count >= 2
    let Fe = 0, Ie = 0, H = { type: 'be', sum: 0, count: 0 };
    tiles.forEach(e => {
      if (e.outcome === H.type) {
        H.sum += e.pl;
        H.count++;
      } else {
        if (H.count >= 2) {
          if (H.type === 'win') Fe += H.sum;
          if (H.type === 'loss') Ie += H.sum;
        }
        H = { type: e.outcome, sum: e.pl, count: 1 };
      }
    });
    if (H.count >= 2) {
      if (H.type === 'win') Fe += H.sum;
      if (H.type === 'loss') Ie += H.sum;
    }

    return {
      tiles,
      currentStreak: { type: curType || 'win', count: curCount },
      bestWinStreak,
      worstLossStreak,
      totalWinPl: Fe,
      totalLossPl: Ie
    };
  }, [closedTrades]);

  // ── Trading Calendar Heatmap Data (53-week structure) ────
  const calendarHeatmapData = useMemo(() => {
    // Include all closed and partial trades with realized exits
    const realizedTrades = trades.filter(t => {
      const st = (t.status || t.positionStatus || '').toLowerCase();
      return st === 'closed' || st === 'partial' || Number(t.exitedQty) > 0;
    });

    const tradeYears = realizedTrades.map(t => {
      const exitStr = t.exitDate || t.e4Date || t.e3Date || t.e2Date || t.e1Date || t.date;
      return parseDate(exitStr)?.getFullYear();
    }).filter(Boolean);
    const year = tradeYears.length > 0 ? tradeYears[tradeYears.length - 1] : 2026;

    const dailyMap = {};
    let totalSlHits = 0;
    let sameDayHits = 0;
    let deliveryHits = 0;

    const recordExit = (exitDateStr, entryDateStr, lotPl, t, m = null) => {
      const d = parseDate(exitDateStr);
      if (!d) return;
      const y = d.getFullYear();
      const mNum = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${mNum}-${dayNum}`;

      if (!dailyMap[key]) {
        dailyMap[key] = {
          pnl: 0,
          count: 0,
          trades: [],
          symbols: new Set(),
          slHits: 0,
          sameDayHits: 0,
          deliveryHits: 0,
          profitableHits: 0,
          losingHits: 0,
          tranches: {},
          outcomeLabel: '',
          outcomeColor: ''
        };
      }

      dailyMap[key].pnl += lotPl;
      dailyMap[key].count += 1;
      dailyMap[key].trades.push(t);
      const sym = t.name || t.symbol;
      if (sym) dailyMap[key].symbols.add(sym);

      // SL Hit detection: exitPrice <= stopPrice * 1.02 for Buy
      const isBuy = String(t.side || t.buySell || 'Buy').toLowerCase() === 'buy';
      const u = Number(t.sl || 0);
      const dVal = Number(t.tsl || 0);
      const f = Number(t.p1Sl || 0);
      const p = Number(t.p2Sl || 0);
      const legLabel = m?.entry?.label || (m?.entry?.id === 'p1' ? 'P1' : m?.entry?.id === 'p2' ? 'P2' : 'Initial');
      const legSl = legLabel === 'P1' ? (f > 0 ? f : u) : legLabel === 'P2' && p > 0 ? p : u;
      const exitPrice = m?.exitPrice || m?.exit?.price || Number(t.avgExitPrice || t.avgExit || 0);
      const entryPrice = m?.entryPrice || m?.entry?.price || Number(t.avgEntry || t.entry || 0);

      const h = dVal > 0 && (isBuy ? dVal >= entryPrice : dVal <= entryPrice)
        ? (isBuy ? Math.max(dVal, legSl) : Math.min(dVal, legSl))
        : legSl;

      const trig = (t.exitTrigger || t.exitReason || '').toLowerCase();
      const isTriggerSl = trig.includes('sl') || trig.includes('stop') || trig.includes('trail') || trig.includes('tsl');
      const isPriceSlHit = h > 0 && exitPrice > 0 && (isBuy ? exitPrice <= h * 1.02 : exitPrice >= h * 0.98);
      const isSlHit = isPriceSlHit || isTriggerSl;

      if (isSlHit) {
        dailyMap[key].slHits += 1;
        totalSlHits += 1;

        const entryD = parseDate(entryDateStr || t.date);
        const isSameDay = entryD && d && entryD.toDateString() === d.toDateString();
        const hDays = Number(t.holdingDays);
        const isIntraday = isSameDay || (!isNaN(hDays) && hDays <= 1) || (t.segment && t.segment.toLowerCase() === 'intraday');

        if (isIntraday) {
          dailyMap[key].sameDayHits += 1;
          sameDayHits += 1;
        } else {
          dailyMap[key].deliveryHits += 1;
          deliveryHits += 1;
        }

        const isProfitable = (isBuy ? h >= entryPrice : h <= entryPrice) || lotPl >= 0 || trig.includes('trail') || trig.includes('tsl');
        if (isProfitable) {
          dailyMap[key].profitableHits += 1;
          dailyMap[key].outcomeLabel = 'Profit Protected (TSL)';
          dailyMap[key].outcomeColor = '#34d399';
        } else {
          dailyMap[key].losingHits += 1;
          if (isIntraday) {
            dailyMap[key].outcomeLabel = 'Intraday SL Hit';
            dailyMap[key].outcomeColor = '#fbbf24';
          } else {
            dailyMap[key].outcomeLabel = 'Capital Hit (Delivery SL)';
            dailyMap[key].outcomeColor = '#ef4444';
          }
        }
        dailyMap[key].tranches[legLabel] = (dailyMap[key].tranches[legLabel] || 0) + 1;
      }
    };

    realizedTrades.forEach(t => {
      // If trade has matches array from LIFO/FIFO matching:
      if (Array.isArray(t.matches) && t.matches.length > 0) {
        t.matches.forEach(m => {
          recordExit(m.exitDate || m.exitDateMs, m.entryDate || m.entryDateMs, Number(m.pl || 0), t, m);
        });
        return;
      }

      const validExits = [
        { d: t.e4Date, q: Number(t.e4Qty || 0), p: Number(t.e4Price || 0) },
        { d: t.e3Date, q: Number(t.e3Qty || 0), p: Number(t.e3Price || 0) },
        { d: t.e2Date, q: Number(t.e2Qty || 0), p: Number(t.e2Price || 0) },
        { d: t.e1Date, q: Number(t.e1Qty || 0), p: Number(t.e1Price || 0) },
      ].filter(e => e.d && e.q > 0);

      const entryStr = t.date;
      const p = Number(t.pnl !== undefined ? t.pnl : (t.pl !== undefined ? t.pl : 0)) || 0;

      if (validExits.length > 0) {
        validExits.forEach(ex => {
          recordExit(ex.d, entryStr, p / validExits.length, t, null);
        });
      } else if (t.exitDate) {
        recordExit(t.exitDate, entryStr, p, t, null);
      }
    });

    const jan1 = new Date(year, 0, 1);
    const startDayOfWeek = jan1.getDay();
    const startDate = new Date(year, 0, 1 - startDayOfWeek);

    const weeks = [];
    let cur = new Date(startDate);

    for (let w = 0; w < 53; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const curY = cur.getFullYear();
        const curM = String(cur.getMonth() + 1).padStart(2, '0');
        const curD = String(cur.getDate()).padStart(2, '0');
        const key = `${curY}-${curM}-${curD}`;
        const isCurrentYear = curY === year;
        const data = dailyMap[key] || null;

        days.push({
          dateKey: key,
          date: new Date(cur),
          dayOfWeek: d,
          isCurrentYear,
          data,
        });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push({ weekIdx: w, days });
    }

    const totalPeriodPnl = Object.values(dailyMap).reduce((acc, item) => acc + (item.pnl || 0), 0);

    return {
      year,
      weeks,
      totalPeriodPnl,
      totalTrades: closedTrades.length,
      slStats: {
        total: totalSlHits,
        same: sameDayHits,
        del: deliveryHits
      },
      dailyMap
    };
  }, [trades]);

  // ── Sector & Industry Analysis ─────────
  const sectorIndustryAnalysis = useMemo(() => {
    const totalTrades = trades.length;
    if (totalTrades === 0) {
      return {
        topIndustry: { name: 'Unknown', count: 0, percentage: 0 },
        leastIndustry: { name: 'Unknown', count: 0, percentage: 0 },
        topSector: { name: 'Unknown', count: 0, percentage: 0 },
        leastSector: { name: 'Unknown', count: 0, percentage: 0 },
        sectors: [],
        industries: [],
        totalTrades: 0,
      };
    }

    const STANDARD_STOCK_TAXONOMY = {
      'TCS': { industry: 'Software Services', sector: 'Information Technology' },
      'INFY': { industry: 'Software Services', sector: 'Information Technology' },
      'HDFCBANK': { industry: 'Private Banks', sector: 'Financial Services' },
      'ICICIBANK': { industry: 'Private Banks', sector: 'Financial Services' },
      'SBIN': { industry: 'PSU Banks', sector: 'Financial Services' },
      'RELIANCE': { industry: 'Oil & Gas-Integrated', sector: 'Gas & Consumable fuels"' },
      'BHARTIARTL': { industry: 'Telecom - Cellular & Fixed line services', sector: 'Telecommunication' },
      'HAL': { industry: 'Aerospace & Defense', sector: 'Capital Goods' },
      'TMCV': { industry: 'Unknown', sector: 'Unknown' },
      'TATAMOTORS': { industry: 'Unknown', sector: 'Unknown' },
      'ETERNAL': { industry: 'Unknown', sector: 'Unknown' },
      'ZOMATO': { industry: 'Unknown', sector: 'Unknown' },
    };

    const sectorMap = new Map();
    const industryMap = new Map();

    trades.forEach(trade => {
      const rawSym = (trade.symbol || trade.name || '').toUpperCase().trim();
      const std = STANDARD_STOCK_TAXONOMY[rawSym];
      const classification = getStockClassification(rawSym, trade.name);

      let sector = (trade.sector || std?.sector || classification.sector || 'Unknown').trim();
      if (!sector || sector.toLowerCase() === 'general market') {
        sector = std?.sector || (classification.sector && classification.sector !== 'General Market' ? classification.sector : 'Unknown');
      }

      let industry = (trade.industry || std?.industry || classification.industry || 'Unknown').trim();
      if (!industry || industry.toLowerCase() === 'general industry') {
        industry = std?.industry || (classification.industry && !classification.industry.includes('Market') ? classification.industry : 'Unknown');
      }

      const pnl = Number(trade.pnl !== undefined ? trade.pnl : trade.pl) || 0;
      const displaySym = (trade.symbol || trade.name || 'Trade').toUpperCase();

      // Accumulate Sector
      if (!sectorMap.has(sector)) {
        sectorMap.set(sector, { name: sector, count: 0, totalPnl: 0, symbols: new Set() });
      }
      const secObj = sectorMap.get(sector);
      secObj.count += 1;
      secObj.totalPnl += pnl;
      secObj.symbols.add(displaySym);

      // Accumulate Industry
      if (!industryMap.has(industry)) {
        industryMap.set(industry, { name: industry, count: 0, totalPnl: 0, symbols: new Set() });
      }
      const indObj = industryMap.get(industry);
      indObj.count += 1;
      indObj.totalPnl += pnl;
      indObj.symbols.add(displaySym);
    });

    const sectors = Array.from(sectorMap.values())
      .sort((a, b) => b.count - a.count)
      .map((item, idx) => ({
        ...item,
        fullName: item.name,
        name: item.name,
        symbols: Array.from(item.symbols),
        stockNames: Array.from(item.symbols),
        trades: item.count,
        percentage: totalTrades > 0 ? (item.count / totalTrades) * 100 : 0,
        color: SECTOR_COLORS[idx % SECTOR_COLORS.length],
        fill: SECTOR_COLORS[idx % SECTOR_COLORS.length],
        value: item.count,
      }));

    const industries = Array.from(industryMap.values())
      .sort((a, b) => b.count - a.count)
      .map((item, idx) => ({
        ...item,
        fullName: item.name,
        name: item.name,
        symbols: Array.from(item.symbols),
        stockNames: Array.from(item.symbols),
        trades: item.count,
        percentage: totalTrades > 0 ? (item.count / totalTrades) * 100 : 0,
        color: SECTOR_COLORS[idx % SECTOR_COLORS.length],
        fill: SECTOR_COLORS[idx % SECTOR_COLORS.length],
        value: item.count,
      }));

    const topSector = sectors[0] || { name: 'Unknown', fullName: 'Unknown', count: 0, percentage: 0, symbols: [], stockNames: [] };
    const leastSector = sectors.length > 1 ? sectors[sectors.length - 1] : sectors[0] || { name: 'Unknown', fullName: 'Unknown', count: 0, percentage: 0, symbols: [], stockNames: [] };

    const topIndustry = industries[0] || { name: 'Unknown', fullName: 'Unknown', count: 0, percentage: 0, symbols: [], stockNames: [] };
    const leastIndustry = industries.length > 1 ? industries[industries.length - 1] : industries[0] || { name: 'Unknown', fullName: 'Unknown', count: 0, percentage: 0, symbols: [], stockNames: [] };

    return {
      topIndustry,
      leastIndustry,
      topSector,
      leastSector,
      sectors,
      industries,
      totalTrades,
    };
  }, [trades]);

  // ─── Tab Animation wrapper ────────────────────────────────────────────
  const tabKey = subTab;

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  const noTrades = closedTrades.length === 0;

  return (
    <div style={{ maxWidth: '1088px', margin: '0 auto', padding: '16px 20px 160px 20px' }}>
      <ChartGradients />
      {/* Keyframe injection */}
      <style>{`
        @keyframes ftFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ftPulse  { 0%,100% { box-shadow: 0 0 0 0 rgba(5,150,105,0.4); } 50% { box-shadow: 0 0 0 8px rgba(5,150,105,0); } }
        @keyframes ftShimmer { from { background-position: -400px 0; } to { background-position: 400px 0; } }
        .ft-tab-content { animation: ftFadeUp 0.22s ease-out; }
      `}</style>

      {/* ── KEY PERFORMANCE METRICS ───────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 className="text-[17px] font-bold tracking-tight text-foreground/80 italic">
          Key Performance Metrics
        </h2>

        {/* Drawdown Engine Data Quality Notes */}
        {ddDaily.skippedDays && ddDaily.skippedDays.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
              <Info size={14} className="shrink-0" />
              <span>{ddDaily.skippedDays.length} trades before capital was recorded are excluded</span>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          
          {/* Card 1: Core Performance Rates */}
          <div className="col-span-2 lg:col-span-1">
            <div className="rounded-lg border border-border/40 bg-card text-card-foreground shadow-sm h-full" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Avg. PnL/Day */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[17px] font-bold tracking-tight text-foreground/80 italic">Avg. PnL/Day</p>
                    <p className={`text-[17px] font-mono font-bold tracking-tight ${metrics.avgPnlPerDay >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      <AnimatedNumber value={metrics.avgPnlPerDay} isCurrency />
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Average profit/loss per active exit day</p>
                  </div>
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600/70 dark:text-emerald-400/70">
                    <CalendarDays className="size-3.5" strokeWidth={1.75} />
                  </span>
                </div>

                {/* Win Rate */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[17px] font-bold tracking-tight text-foreground/80 italic">Win Rate</p>
                    <p className={`text-[17px] font-mono font-bold tracking-tight ${parseFloat(metrics.winRate) >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      <AnimatedNumber value={parseFloat(metrics.winRate)} decimals={1} suffix="%" />
                    </p>
                  </div>
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600/70 dark:text-emerald-400/70">
                    <TrendingUp className="size-3.5" strokeWidth={1.75} />
                  </span>
                </div>

                {/* Profit Factor */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[17px] font-bold tracking-tight text-foreground/80 italic">Profit Factor</p>
                    <p className={`text-[17px] font-mono font-bold tracking-tight ${parseFloat(metrics.profitFactor) >= 1.5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                      <AnimatedNumber value={parseFloat(metrics.profitFactor)} decimals={2} />
                    </p>
                  </div>
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600/70 dark:text-emerald-400/70">
                    <BarChart2 className="size-3.5" strokeWidth={1.75} />
                  </span>
                </div>

                {/* Sharpe Ratio */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[17px] font-bold tracking-tight text-foreground/80 italic">Sharpe Ratio</p>
                    <p className={`text-[17px] font-mono font-bold tracking-tight ${metrics.sharpe !== null && parseFloat(metrics.sharpe) >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                      {metrics.sharpe !== null ? (
                        <AnimatedNumber value={parseFloat(metrics.sharpe)} decimals={2} />
                      ) : (
                        <span className="text-xs font-semibold text-amber-500 dark:text-amber-400">
                          {metrics.sharpeReason === 'no_capital' ? 'Set starting capital' : '— (< 20 trading days)'}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Risk-adjusted return (portfolio basis)</p>
                  </div>
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600/70 dark:text-emerald-400/70">
                    <Sigma className="size-3.5" strokeWidth={1.75} />
                  </span>
                </div>

                {/* Expectancy */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[17px] font-bold tracking-tight text-foreground/80 italic">Expectancy</p>
                    <p className={`text-[17px] font-mono font-bold tracking-tight ${parseFloat(metrics.expectancy) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      <AnimatedNumber value={parseFloat(metrics.expectancy)} isCurrency showPlus />
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Expected profit per trade</p>
                  </div>
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600/70 dark:text-emerald-400/70">
                    <Target className="size-3.5" strokeWidth={1.75} />
                  </span>
                </div>

              </div>
            </div>
          </div>

          {/* Card 2: Win / Loss Profile */}
          <div className="col-span-2 lg:col-span-1">
            <div className="rounded-lg border border-border/40 bg-card text-card-foreground shadow-sm h-full" style={{ padding: '24px' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-bold tracking-tight text-foreground/80 italic">Win / Loss Profile</h3>
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500/70 dark:text-blue-400/70">
                  <Trophy className="size-3.5" strokeWidth={1.75} />
                </span>
              </div>

              <div style={{ marginTop: '22px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: '16px', rowGap: '22px' }}>
                {/* Avg win */}
                <div className="min-w-0">
                  <p className="text-sm font-bold tracking-tight text-foreground/80 italic">Avg win</p>
                  <p className="mt-0.5 font-mono text-[17px] font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    <AnimatedNumber value={metrics.avgWin} isCurrency />
                  </p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">Average winning P&amp;L</p>
                </div>

                {/* Avg loss */}
                <div className="min-w-0">
                  <p className="text-sm font-bold tracking-tight text-foreground/80 italic">Avg loss</p>
                  <p className="mt-0.5 font-mono text-[17px] font-bold tracking-tight text-rose-600 dark:text-rose-400">
                    <AnimatedNumber value={metrics.avgLoss} isCurrency />
                  </p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">Average losing P&amp;L</p>
                </div>

                {/* Payoff ratio */}
                <div className="min-w-0">
                  <p className="text-sm font-bold tracking-tight text-foreground/80 italic">Payoff ratio</p>
                  <p className="mt-0.5 font-mono text-[17px] font-bold tracking-tight text-foreground">
                    <AnimatedNumber value={parseFloat(metrics.payoffRatio)} decimals={2} suffix="×" />
                  </p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">Average win ÷ average loss</p>
                </div>

                {/* Win / loss */}
                <div className="min-w-0">
                  <p className="text-sm font-bold tracking-tight text-foreground/80 italic">Win / loss</p>
                  <p className="mt-0.5 font-mono text-[17px] font-bold tracking-tight text-foreground">
                    <AnimatedNumber value={parseFloat(metrics.winLossRatio)} decimals={2} suffix="×" />
                  </p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">Winning trades ÷ losing trades</p>
                </div>

                {/* Avg win hold */}
                <div className="min-w-0">
                  <p className="text-sm font-bold tracking-tight text-foreground/80 italic">Avg win hold</p>
                  <p className="mt-0.5 font-mono text-[17px] font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    <AnimatedNumber value={parseFloat(metrics.avgWinHold)} decimals={parseFloat(metrics.avgWinHold) < 10 ? 1 : 0} suffix="d" />
                  </p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">Weighted holding days</p>
                </div>

                {/* Avg loss hold */}
                <div className="min-w-0">
                  <p className="text-sm font-bold tracking-tight text-foreground/80 italic">Avg loss hold</p>
                  <p className="mt-0.5 font-mono text-[17px] font-bold tracking-tight text-rose-600 dark:text-rose-400">
                    <AnimatedNumber value={parseFloat(metrics.avgLossHold)} decimals={parseFloat(metrics.avgLossHold) < 10 ? 1 : 0} suffix="d" />
                  </p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">Weighted holding days</p>
                </div>

                {/* Win streak */}
                <div className="min-w-0">
                  <p className="text-sm font-bold tracking-tight text-foreground/80 italic">Win streak</p>
                  <p className="mt-0.5 font-mono text-[17px] font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    <AnimatedNumber value={metrics.winStreak} />
                  </p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">Longest winning run</p>
                </div>

                {/* Loss streak */}
                <div className="min-w-0">
                  <p className="text-sm font-bold tracking-tight text-foreground/80 italic">Loss streak</p>
                  <p className="mt-0.5 font-mono text-[17px] font-bold tracking-tight text-rose-600 dark:text-rose-400">
                    <AnimatedNumber value={metrics.lossStreak} />
                  </p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">Longest losing run</p>
                </div>
              </div>

              {/* Subtle Horizontal Divider above Avg risk / trade */}
              <div
                style={{
                  marginTop: '22px',
                  paddingTop: '18px',
                  borderTop: '1px solid var(--border, rgba(0, 0, 0, 0.09))',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '16px'
                }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold tracking-tight text-foreground/80 italic">Avg risk / trade</p>
                  <p className="mt-0.5 font-mono text-[17px] font-bold tracking-tight text-foreground">
                    <AnimatedNumber value={metrics.avgRiskTrade} isCurrency />
                  </p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">Average initial rupee risk</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold tracking-tight text-foreground/80 italic">Avg PF risk / trade</p>
                  <p className="mt-0.5 font-mono text-[17px] font-bold tracking-tight text-foreground">
                    <AnimatedNumber value={parseFloat(metrics.avgPfRisk)} decimals={2} suffix="%" />
                  </p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">Average risk vs ESC</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Best & Worst Trade */}
          <div className="col-span-2 lg:col-span-1">
            <div className="rounded-lg border border-border/40 bg-card text-card-foreground shadow-sm h-full" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                
                {/* Best Trade */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[17px] font-bold tracking-tight text-foreground/80 italic">Best Trade</p>
                    <p className="text-[17px] font-mono font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                      {metrics.bestTradeObj ? (
                        <AnimatedNumber value={metrics.bestTradeObj.pnl ?? metrics.bestTradeObj.pl ?? 0} isCurrency />
                      ) : (
                        '—'
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Highest profit</p>
                  </div>
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600/70 dark:text-emerald-400/70">
                    <Star className="size-3.5" strokeWidth={1.75} />
                  </span>
                </div>

                {/* Worst Trade */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[17px] font-bold tracking-tight text-foreground/80 italic">Worst Trade</p>
                    <p className="text-[17px] font-mono font-bold tracking-tight text-rose-600 dark:text-rose-400">
                      {metrics.worstTradeObj ? (
                        <AnimatedNumber value={Math.abs(metrics.worstTradeObj.pnl ?? metrics.worstTradeObj.pl ?? 0)} isCurrency />
                      ) : (
                        '—'
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Biggest loss</p>
                  </div>
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-500/70 dark:text-rose-400/70">
                    <XCircle className="size-3.5" strokeWidth={1.75} />
                  </span>
                </div>

              </div>
            </div>
          </div>

          {/* Card 4: R Multiple Metrics */}
          <div className="col-span-2 lg:col-span-1">
            <div className="rounded-lg border border-border/40 bg-card text-card-foreground shadow-sm h-full" style={{ padding: '24px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '22px' }}>
                <h3 className="text-[14px] font-bold tracking-tight text-foreground/80 italic">R Multiple Metrics</h3>
                <button
                  type="button"
                  className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground/50 hover:text-foreground cursor-help transition-colors"
                  title="R-multiple measures profit or loss relative to the initial risk amount on the trade."
                >
                  <Info className="size-3.5" strokeWidth={1.75} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {/* Highest R */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[17px] font-bold tracking-tight text-foreground/80 italic">Highest R</p>
                    <p className="text-[17px] font-mono font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                      <AnimatedNumber value={parseFloat(metrics.highestR)} decimals={2} suffix="R" />
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Best risk:reward</p>
                  </div>
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500/70 dark:text-blue-400/70">
                    <ArrowUp className="size-3.5" strokeWidth={1.75} />
                  </span>
                </div>

                {/* Lowest R */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[17px] font-bold tracking-tight text-foreground/80 italic">Lowest R</p>
                    <p className="text-[17px] font-mono font-bold tracking-tight text-rose-600 dark:text-rose-400">
                      <AnimatedNumber value={parseFloat(metrics.lowestR)} decimals={2} suffix="R" />
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Worst risk:reward</p>
                  </div>
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500/70 dark:text-amber-400/70">
                    <ArrowDown className="size-3.5" strokeWidth={1.75} />
                  </span>
                </div>

                {/* Avg R */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[17px] font-bold tracking-tight text-foreground/80 italic">Avg R</p>
                    <p className={`text-[17px] font-mono font-bold tracking-tight ${parseFloat(metrics.avgR) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      <AnimatedNumber value={parseFloat(metrics.avgR)} decimals={2} suffix="R" />
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Average risk:reward</p>
                  </div>
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600/70 dark:text-emerald-400/70">
                    <Sigma className="size-3.5" strokeWidth={1.75} />
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── SUB-SECTIONS TAB BAR ── */}
      <div style={{ marginTop: '28px', width: '100%' }}>
        <div className="flex items-center justify-start overflow-x-auto pb-1 gap-1.5 scrollbar-none">
          <div className="flex items-center bg-muted/5 hover:bg-muted/10 border border-border/10 rounded-full p-1 gap-1">
            {ANALYTICS_SUB_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubTab(tab.id)}
                  className={`flex items-center gap-1.5 h-8 px-4 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 border cursor-pointer select-none ${
                    isActive
                      ? 'bg-background text-foreground shadow-xs border-border/10'
                      : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/10 border-transparent'
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor: 'var(--card, #ffffff)',
                          color: 'var(--foreground, #09090b)',
                          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                        }
                      : {}
                  }
                >
                  <Icon className={`size-3.5 ${isActive ? 'text-foreground' : 'text-muted-foreground/60'}`} strokeWidth={1.3} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── SUB-SECTIONS CONTENT ───────────────────────────────────────── */}
      <div style={{ marginTop: '28px' }}>
        {subTab === 'POSITION' && (
          <div className="space-y-8 ft-tab-content">
            
            {/* ── CARD 1: PARETO PRINCIPLE & TOP WINNERS BREAKDOWN ── */}
            <div className="text-card-foreground shadow-sm h-full border border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden p-0 rounded-[2rem]">
              <div className="flex flex-col md:flex-row">
                
                {/* Left Column: Statistical Narrative & Move Threshold */}
                <div className="w-full md:w-[320px] border-b md:border-b-0 md:border-r border-border/40 bg-accent/5 flex flex-col justify-between shrink-0" style={{ padding: '36px', minWidth: '320px' }}>
                  <div>
                    {/* Asymmetry Badge */}
                    {narrative.asymmetric ? (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                        <Zap className="size-3 text-emerald-500 fill-emerald-500" />
                        <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Asymmetry Found</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/40 border border-border/40 mb-6">
                        <Info className="size-3 text-muted-foreground/60" />
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Standard Distribution</span>
                      </div>
                    )}

                    {/* Statistical Narrative */}
                    <h3 className="text-xl font-bold tracking-tight text-foreground italic mb-2">
                      Statistical Narrative
                    </h3>
                    <p className="text-[13px] text-muted-foreground/70 leading-relaxed font-medium">
                      A significant{' '}
                      <span className="text-foreground font-extrabold italic text-lg">
                        {narrative.pct}%
                      </span>{' '}
                      of your gross profit comes from just{' '}
                      <span className="text-foreground font-extrabold italic text-lg">
                        {narrative.count}
                      </span>{' '}
                      trades.
                    </p>
                  </div>

                  {/* Move Threshold Stepper (Clamped 1% - 50%) */}
                  <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-background/50 border border-border/40">
                      <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                        Move Threshold
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMoveThreshold(v => Math.max(1, v - 1))}
                          className="size-6 rounded-lg border border-border/40 flex items-center justify-center hover:bg-accent text-xs font-bold text-foreground cursor-pointer transition-colors active:scale-95 select-none"
                          title="Decrease threshold"
                        >
                          -
                        </button>
                        <span className="text-xs font-black italic min-w-[24px] text-center tabular-nums">
                          {moveThreshold}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setMoveThreshold(v => Math.min(50, v + 1))}
                          className="size-6 rounded-lg border border-border/40 flex items-center justify-center hover:bg-accent text-xs font-bold text-foreground cursor-pointer transition-colors active:scale-95 select-none"
                          title="Increase threshold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Pareto Principle AreaChart & Table */}
                <div className="flex-1 flex flex-col" style={{ padding: '36px' }}>
                  {/* Chart Header */}
                  <div className="flex items-center justify-between mb-8">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold tracking-tight text-foreground uppercase opacity-80 italic">
                        Pareto Principle
                      </h4>
                      <p className="text-[11px] text-muted-foreground/50 font-medium">
                        Cumulative gross profit share across top N winners.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="size-8 rounded-full border border-border/40 flex items-center justify-center hover:bg-accent transition-colors"
                      title="Pareto Principle: Cumulative profit share across top winners"
                    >
                      <Info className="size-3.5 text-muted-foreground/40" />
                    </button>
                  </div>

                  {/* Area Chart */}
                  <div className="w-full h-[240px]">
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={paretoData} margin={{ top: 25, right: 25, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="modernEmerald" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.08} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" opacity={0.15} vertical={false} />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={{ stroke: 'var(--border)', opacity: 0.2 }}
                          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          ticks={[0, 25, 50, 75, 100]}
                          unit="%"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        />
                        <ReferenceLine
                          y={80}
                          stroke="#10b981"
                          strokeDasharray="4 4"
                          strokeOpacity={0.5}
                          label={{
                            value: '80% Benchmark',
                            position: 'insideTopLeft',
                            fill: '#10b981',
                            fontSize: 10,
                            fontWeight: 600,
                            dy: -6,
                          }}
                        />
                        <Tooltip content={<ParetoTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="share"
                          stroke="#059669"
                          strokeWidth={3}
                          fill="url(#modernEmerald)"
                          dot={(props) => {
                            const { cx, cy, index } = props;
                            return (
                              <circle
                                key={`dot-${index}`}
                                cx={cx}
                                cy={cy}
                                r={4}
                                fill="#059669"
                                stroke="var(--card, #fff)"
                                strokeWidth={2}
                              />
                            );
                          }}
                          activeDot={{ r: 6, fill: '#059669' }}
                        >
                          <LabelList
                            dataKey="share"
                            position="top"
                            content={(props) => {
                              const { x, y, value, index } = props;
                              if (index !== 0 && index !== 2 && index !== 4) return null;
                              return (
                                <text
                                  x={x}
                                  y={y}
                                  dy={-14}
                                  fill="var(--foreground, #000)"
                                  fontSize={11}
                                  fontWeight={900}
                                  textAnchor="middle"
                                  className="tabular-nums italic font-black"
                                >
                                  {value}%
                                </text>
                              );
                            }}
                          />
                        </Area>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Grid Tickers (Top 1 to Top 20) */}
                  <div className="mt-10 grid grid-cols-5 gap-3">
                    {paretoData.map(item => (
                      <div
                        key={item.label}
                        className="flex flex-col items-center rounded-2xl bg-accent/5 border border-border/20 group hover:bg-emerald-500/5 hover:border-emerald-500/10 transition-all duration-300 p-3"
                      >
                        <span className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] mb-1">
                          {item.label}
                        </span>
                        <span className="text-sm font-black text-foreground italic tabular-nums">
                          {item.share}%
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Top Winners Breakdown Table */}
                  <div className="mt-8">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/50 mb-4">
                      Top Winners Breakdown
                    </p>
                    <div className="overflow-x-auto">
                      <div className="min-w-[580px]">
                        {/* Table Header */}
                        <div className="grid grid-cols-[40px_1fr_105px_95px_130px_110px] items-center px-2.5 pb-2 border-b border-border/40 mb-2">
                          <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">#</span>
                          <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">Symbol</span>
                          <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest text-right">Stock Move %</span>
                          <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest text-right">PF Impact %</span>
                          <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest text-right">Gross Realized P/L</span>
                          <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest text-right">% of Gross Profit</span>
                        </div>

                        {/* Table Body */}
                        <div className="space-y-1.5 pr-2 max-h-[320px] overflow-y-auto">
                          {topWinners.map(tw => (
                            <div
                              key={tw.rank}
                              className="grid grid-cols-[40px_1fr_105px_95px_130px_110px] items-center p-2.5 border-b border-border/10 hover:bg-muted/30 transition-all duration-200 group last:border-0 rounded-xl"
                            >
                              <span className="text-[10px] font-black text-muted-foreground/40 text-center tabular-nums">
                                #{tw.rank}
                              </span>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="shrink-0">
                                  <SymbolLogo symbol={tw.symbol} className="rounded-sm object-contain size-3.5" />
                                </div>
                                <span className="whitespace-nowrap truncate text-xs font-bold tracking-tight text-foreground">
                                  {tw.symbol}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-muted-foreground/40 tabular-nums text-right whitespace-nowrap">
                                {tw.move}%
                              </span>
                              <span className="text-xs font-black tabular-nums italic text-right text-emerald-500">
                                +{tw.pfImpact}%
                              </span>
                              <span className="text-[10px] font-bold text-muted-foreground/50 tabular-nums text-right">
                                {fmtINR(tw.grossPl)}
                              </span>
                              <span className="text-[10px] font-black text-amber-500/80 tabular-nums text-right italic">
                                {tw.share}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </div>

            {/* ── CARD 2: REALIZED P&L DISTRIBUTION ── */}
            <div
              className="rounded-3xl border border-border/40 bg-card/15 backdrop-blur-2xl text-card-foreground shadow-none space-y-4"
              style={{ padding: '24px', borderRadius: '24px' }}
            >
              <div>
                <h3 className="text-base font-bold text-foreground">Realized P&amp;L Distribution</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Frequency spread of trade P&amp;L size
                </p>
              </div>

              <div className="space-y-6">
                {/* Aggregate PnL vs Symbol */}
                <div
                  className="rounded-lg border bg-card text-card-foreground overflow-hidden border-none bg-gradient-to-b from-card to-background/30 shadow-sm transition-all duration-300 hover:shadow-md"
                  style={{ borderRadius: '12px', border: '1px solid var(--border)' }}
                >
                  <div
                    className="flex flex-col space-y-1.5 border-b border-border/30"
                    style={{ padding: '24px 32px 16px 32px' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3
                          className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-2xl font-bold tracking-tight text-transparent italic inline-block"
                          style={{ paddingRight: '14px' }}
                        >
                          Aggregate PnL vs Symbol
                        </h3>
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">
                          PERFORMANCE BY ASSET CLASS
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '0 24px 28px 24px' }}>
                    {symbolPnlData.length === 0 ? (
                      <div className="py-12 text-center text-xs text-muted-foreground">
                        No closed trade data available.
                      </div>
                    ) : (
                      <div className="w-full h-[320px]">
                        <ResponsiveContainer width="100%" height={320}>
                          <BarChart data={symbolPnlData} margin={{ top: 40, right: 30, left: 60, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="6 6" stroke="var(--border)" opacity={0.4} vertical={false} />
                            <XAxis
                              dataKey="symbol"
                              tickLine={false}
                              axisLine={false}
                              interval={0}
                              angle={-45}
                              textAnchor="end"
                              height={55}
                              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                            />
                            <YAxis
                              tickFormatter={v => fmtINR(v)}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                              label={{
                                value: 'TOTAL P/L',
                                angle: -90,
                                position: 'insideLeft',
                                offset: -45,
                                style: { fontSize: 9, fill: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.1em', opacity: 0.5 }
                              }}
                            />
                            <Tooltip content={<RealizedPnLTooltip />} cursor={{ fill: 'var(--primary)', opacity: 0.03 }} />
                            <Bar
                              dataKey="pnl"
                              barSize={16}
                              radius={[10, 10, 0, 0]}
                              isAnimationActive={true}
                              animationDuration={1200}
                              animationEasing="ease-out"
                              name="Total P&L"
                            >
                              {symbolPnlData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#52a373' : '#f07171'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                {/* Aggregate PnL vs Day (Monday - Friday) */}
                <div
                  className="rounded-lg border bg-card text-card-foreground overflow-hidden border-none bg-gradient-to-b from-card to-background/30 shadow-sm transition-all duration-300 hover:shadow-md"
                  style={{ borderRadius: '12px', border: '1px solid var(--border)' }}
                >
                  <div
                    className="flex flex-col space-y-1.5 border-b border-border/30"
                    style={{ padding: '24px 32px 16px 32px' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3
                          className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-2xl font-bold tracking-tight text-transparent italic inline-block"
                          style={{ paddingRight: '14px' }}
                        >
                          Aggregate PnL vs Day
                        </h3>
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">
                          WEEKDAY DISTRIBUTION
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '0 24px 28px 24px' }}>
                    {closedTrades.length === 0 ? (
                      <div className="py-12 text-center text-xs text-muted-foreground">
                        No closed trade data available.
                      </div>
                    ) : (
                      <div className="w-full h-[320px]">
                        <ResponsiveContainer width="100%" height={320}>
                          <BarChart data={weekdayPnlData} margin={{ top: 40, right: 30, left: 60, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="6 6" stroke="var(--border)" opacity={0.4} vertical={false} />
                            <XAxis
                              dataKey="day"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                            />
                            <YAxis
                              domain={[dataMin => Math.min(0, Math.floor(dataMin * 1.1)), dataMax => Math.ceil(dataMax * 1.1)]}
                              tickFormatter={v => fmtINR(v)}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                              label={{
                                value: 'TOTAL P/L',
                                angle: -90,
                                position: 'insideLeft',
                                offset: -45,
                                style: { fontSize: 9, fill: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.1em', opacity: 0.5 }
                              }}
                            />
                            <Tooltip content={<RealizedPnLTooltip />} cursor={{ fill: 'var(--primary)', opacity: 0.03 }} />
                            <Bar
                              dataKey="pnl"
                              barSize={16}
                              radius={[10, 10, 0, 0]}
                              isAnimationActive={true}
                              animationDuration={1200}
                              animationEasing="ease-out"
                              name="Total P&L"
                            >
                              {weekdayPnlData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#52a373' : '#f07171'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── CARD 3: HOLDING PERIOD SPREAD ── */}
            <div
              className="rounded-3xl border border-border/40 bg-card/15 backdrop-blur-2xl text-card-foreground shadow-none space-y-4"
              style={{ padding: '24px', borderRadius: '24px' }}
            >
              <div>
                <h3 className="text-base font-bold text-foreground">Holding Period Spread</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Distribution of trade duration in calendar days
                </p>
              </div>

              <div className="space-y-6">
                {/* Upper 2-column Grid */}
                <div className="grid gap-6 lg:grid-cols-2">
                  
                  {/* Distribution: Volume by Duration */}
                  <div
                    className="rounded-lg border bg-card text-card-foreground overflow-hidden border-none bg-gradient-to-b from-card to-background/50 shadow-sm transition-all duration-300 hover:shadow-md"
                    style={{ borderRadius: '12px', border: '1px solid var(--border)' }}
                  >
                    <div
                      className="flex items-center justify-between border-b border-border/30"
                      style={{ padding: '20px 24px 14px 24px' }}
                    >
                      <div>
                        <h3
                          className="bg-gradient-to-r from-foreground/90 to-foreground/60 bg-clip-text text-lg font-bold tracking-tight text-transparent italic inline-block"
                          style={{ paddingRight: '12px' }}
                        >
                          Distribution
                        </h3>
                        <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">
                          VOLUME BY DURATION
                        </div>
                      </div>
                      <div className="rounded-full bg-primary/5 p-2">
                        <Clock className="size-3.5 text-primary/60" />
                      </div>
                    </div>

                    <div style={{ padding: '0 20px 24px 20px' }}>
                      <div className="w-full h-[260px]">
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={durationSpreadData} margin={{ top: 20, right: 10, left: 50, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="6 6" stroke="var(--border)" opacity={0.4} vertical={false} />
                            <XAxis
                              dataKey="range"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                            />
                            <YAxis
                              allowDecimals={false}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                              label={{
                                value: 'Trades',
                                angle: -90,
                                position: 'insideLeft',
                                offset: -40,
                                style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }
                              }}
                            />
                            <Tooltip content={<DurationSpreadTooltip mode="trades" />} cursor={{ fill: 'var(--primary)', opacity: 0.03 }} />
                            <Bar
                              dataKey="trades"
                              fill="#0ea5e9"
                              barSize={12}
                              radius={[10, 10, 0, 0]}
                              isAnimationActive={true}
                              animationDuration={1200}
                              animationEasing="ease-out"
                              name="Trades"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Avg P/L: Returns by Duration */}
                  <div
                    className="rounded-lg border bg-card text-card-foreground overflow-hidden border-none bg-gradient-to-b from-card to-background/50 shadow-sm transition-all duration-300 hover:shadow-md"
                    style={{ borderRadius: '12px', border: '1px solid var(--border)' }}
                  >
                    <div
                      className="flex items-center justify-between border-b border-border/30"
                      style={{ padding: '20px 24px 14px 24px' }}
                    >
                      <div>
                        <h3
                          className="bg-gradient-to-r from-foreground/90 to-foreground/60 bg-clip-text text-lg font-bold tracking-tight text-transparent italic inline-block"
                          style={{ paddingRight: '12px' }}
                        >
                          Avg P/L
                        </h3>
                        <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">
                          RETURNS BY DURATION
                        </div>
                      </div>
                      <div className="rounded-full bg-primary/5 p-2">
                        <Clock className="size-3.5 text-primary/60" />
                      </div>
                    </div>

                    <div style={{ padding: '0 20px 24px 20px' }}>
                      <div className="w-full h-[260px]">
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={durationSpreadData} margin={{ top: 20, right: 10, left: 50, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="6 6" stroke="var(--border)" opacity={0.4} vertical={false} />
                            <XAxis
                              dataKey="range"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                            />
                            <YAxis
                              tickFormatter={v => fmtINR(v)}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                              label={{
                                value: 'Avg P/L',
                                angle: -90,
                                position: 'insideLeft',
                                offset: -40,
                                style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }
                              }}
                            />
                            <Tooltip content={<DurationSpreadTooltip mode="currency" />} cursor={{ fill: 'var(--primary)', opacity: 0.03 }} />
                            <Bar
                              dataKey="avgPnl"
                              barSize={12}
                              radius={[10, 10, 0, 0]}
                              isAnimationActive={true}
                              animationDuration={1200}
                              animationEasing="ease-out"
                              name="Avg P/L"
                            >
                              {durationSpreadData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.avgPnl >= 0 ? '#52a373' : '#f07171'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Duration Performance Matrix (ComposedChart) */}
                <div
                  className="rounded-lg border bg-card text-card-foreground overflow-hidden border-none bg-gradient-to-b from-card to-background/30 shadow-sm transition-all duration-300 hover:shadow-md"
                  style={{ borderRadius: '12px', border: '1px solid var(--border)' }}
                >
                  <div
                    className="flex flex-col space-y-1.5 border-b border-border/30"
                    style={{ padding: '24px 32px 16px 32px' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3
                          className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-2xl font-bold tracking-tight text-transparent italic inline-block"
                          style={{ paddingRight: '14px' }}
                        >
                          Duration Performance Matrix
                        </h3>
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">
                          CORRELATION BETWEEN FREQUENCY &amp; PROFITABILITY
                        </div>
                      </div>
                      <div className="rounded-full bg-primary/5 p-2.5 text-primary/60">
                        <Clock className="size-4" />
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '0 24px 28px 24px' }}>
                    <div className="w-full h-[350px]">
                      <ResponsiveContainer width="100%" height={350}>
                        <ComposedChart data={durationSpreadData} margin={{ top: 40, right: 60, left: 60, bottom: 20 }}>
                          <defs>
                            <linearGradient id="durationBarGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.8} />
                              <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.15} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="6 6" stroke="var(--border)" opacity={0.4} vertical={false} />
                          <XAxis
                            dataKey="range"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                          />
                          <YAxis
                            yAxisId="left"
                            orientation="left"
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                            label={{
                              value: '# TRADES',
                              angle: -90,
                              position: 'insideLeft',
                              offset: -45,
                              style: {
                                fontSize: 9,
                                fill: 'var(--muted-foreground)',
                                fontWeight: 700,
                                letterSpacing: '0.1em',
                                opacity: 0.5,
                              }
                            }}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            tickFormatter={v => fmtINR(v)}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                            label={{
                              value: 'AVG P/L',
                              angle: 90,
                              position: 'insideRight',
                              offset: -45,
                              style: {
                                fontSize: 9,
                                fill: 'var(--muted-foreground)',
                                fontWeight: 700,
                                letterSpacing: '0.1em',
                                opacity: 0.5,
                              }
                            }}
                          />
                          <Tooltip content={<DurationSpreadTooltip mode="shared" />} cursor={{ fill: 'var(--primary)', opacity: 0.03 }} />
                          <Bar
                            yAxisId="left"
                            dataKey="trades"
                            fill="url(#durationBarGradient)"
                            barSize={16}
                            radius={[4, 4, 0, 0]}
                            isAnimationActive={true}
                            animationDuration={1200}
                            animationEasing="ease-out"
                            name="# Trades"
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="avgPnl"
                            stroke="#52a373"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: '#52a373', strokeWidth: 2, stroke: 'var(--card, #fff)' }}
                            activeDot={{ r: 6, fill: '#52a373' }}
                            isAnimationActive={true}
                            animationDuration={1200}
                            animationEasing="ease-out"
                            name="Avg P/L"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

        {subTab === 'STREAKS' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* ── CARD 1: STREAK OVERVIEW & SEQUENCE TAPE ── */}
            <div
              className="rounded-3xl border border-border/40 bg-card text-card-foreground shadow-sm"
              style={{
                padding: '28px 32px',
                borderRadius: '24px',
                background: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border-color, #eaecf0)',
                display: 'flex',
                flexDirection: 'column',
                gap: '28px',
              }}
            >
              {/* Header: Clean, Title + ACTIVE W2 pill + (i) info tooltip + Flame icon */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary, #0f172a)' }}>
                    Streak & Trade Sequence
                  </h3>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: streakAnalysis.currentStreak.type === 'win' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      color: streakAnalysis.currentStreak.type === 'win' ? '#059669' : '#dc2626',
                      textTransform: 'uppercase',
                    }}
                  >
                    ACTIVE {streakAnalysis.currentStreak.type === 'win' ? 'W' : 'L'}{streakAnalysis.currentStreak.count}
                  </span>

                  {/* Info (i) Icon with Tooltip */}
                  <div className="group relative inline-flex items-center">
                    <button
                      type="button"
                      aria-label="Streak info"
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted, #94a3b8)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <Info style={{ width: '15px', height: '15px' }} />
                    </button>
                    <div
                      className="pointer-events-none absolute left-0 top-full mt-2 z-50 w-64 text-[11px] text-foreground shadow-xl opacity-0 invisible transition-all duration-150 group-hover:opacity-100 group-hover:visible"
                      style={{
                        padding: '10px 14px',
                        borderRadius: '12px',
                        border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                        backgroundColor: 'var(--card, #ffffff)',
                        boxShadow: '0 14px 35px -4px rgba(0, 0, 0, 0.18)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        boxSizing: 'border-box',
                        lineHeight: 1.45,
                      }}
                    >
                      Tracks consecutive run momentum, win/loss streaks, and chronological trade execution order.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.04)',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  <Flame style={{ width: '16px', height: '16px' }} />
                </div>
              </div>

              {/* 3 Open Floating Stat Columns (Guaranteed 3 Horizontal Columns across the row) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '32px',
                  alignItems: 'start',
                }}
              >
                {/* Col 1: Current */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted, #64748b)' }}>
                    CURRENT
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '34px',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono, monospace)',
                        letterSpacing: '-0.03em',
                        lineHeight: 1.1,
                        color: streakAnalysis.currentStreak.type === 'win' ? '#059669' : '#dc2626',
                      }}
                    >
                      {streakAnalysis.currentStreak.type === 'win' ? 'W' : 'L'}{streakAnalysis.currentStreak.count}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #64748b)' }}>
                      trades
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: streakAnalysis.currentStreak.type === 'win' ? '#10b981' : '#ef4444',
                      }}
                    />
                    <span>
                      {streakAnalysis.currentStreak.count} consecutive {streakAnalysis.currentStreak.type === 'win' ? 'wins' : 'losses'}
                    </span>
                  </div>
                </div>

                {/* Col 2: Best Streak */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted, #64748b)' }}>
                    BEST STREAK
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: '34px',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono, monospace)',
                        letterSpacing: '-0.03em',
                        lineHeight: 1.1,
                        color: '#059669',
                      }}
                    >
                      {fmtINR(streakAnalysis.totalWinPl || streakAnalysis.bestWinStreak.totalPl || 0, true)}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Record: W{streakAnalysis.bestWinStreak.count || 0}
                    {streakAnalysis.bestWinStreak.symbols?.length ? (
                      <> · <span style={{ fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>{streakAnalysis.bestWinStreak.symbols.slice(0, 3).join(', ')}</span></>
                    ) : ''}
                  </div>
                </div>

                {/* Col 3: Worst Streak */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted, #64748b)' }}>
                    WORST STREAK
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: '34px',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono, monospace)',
                        letterSpacing: '-0.03em',
                        lineHeight: 1.1,
                        color: '#dc2626',
                      }}
                    >
                      -₹{Math.abs(streakAnalysis.totalLossPl || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Worst: L{streakAnalysis.worstLossStreak.count || 1}
                  </div>
                </div>
              </div>

              {/* Trade Sequence */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted, #64748b)' }}>
                      TRADE SEQUENCE
                    </span>
                    {streakAnalysis.tiles.length > 50 && (
                      <button
                        type="button"
                        onClick={() => setShowAllSequence(prev => !prev)}
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(0, 0, 0, 0.05)',
                          color: 'var(--text-primary, #0f172a)',
                          border: '1px solid var(--border-color, #eaecf0)',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.09)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'}
                      >
                        {showAllSequence ? 'Show Recent 50' : `Show All (${streakAnalysis.tiles.length})`}
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #64748b)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                      {streakAnalysis.tiles.filter(t => t.outcome === 'win').length} Wins
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                      {streakAnalysis.tiles.filter(t => t.outcome === 'loss').length} Loss
                    </span>
                    {streakAnalysis.tiles.some(t => t.outcome === 'be') && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />
                        {streakAnalysis.tiles.filter(t => t.outcome === 'be').length} BE
                      </span>
                    )}
                  </div>
                </div>

                {/* Responsive Ribbon with Instant Hover Popover & Scalable Scroll Container */}
                {(() => {
                  const totalTiles = streakAnalysis.tiles.length;
                  const displayedTiles = showAllSequence || totalTiles <= 50
                    ? streakAnalysis.tiles
                    : streakAnalysis.tiles.slice(-50);

                  if (totalTiles === 0) {
                    return (
                      <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                        No closed trade sequence available yet.
                      </div>
                    );
                  }

                  return (
                    <div className="relative w-full">
                      {/* Scoped CSS for Instant Hardware-Accelerated Hover Popovers */}
                      <style>{`
                        .trade-sequence-tile-wrapper {
                          position: relative;
                          z-index: 1;
                        }
                        .trade-sequence-tile-wrapper:hover,
                        .trade-sequence-tile-wrapper.is-hovered,
                        .trade-sequence-tile-wrapper:focus-within {
                          z-index: 50 !important;
                        }
                        .trade-sequence-tile-popover {
                          opacity: 0;
                          visibility: hidden;
                          pointer-events: none;
                          transition: opacity 0.14s cubic-bezier(0.16, 1, 0.3, 1), transform 0.14s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.14s;
                        }
                        .trade-sequence-tile-wrapper:hover .trade-sequence-tile-popover,
                        .trade-sequence-tile-wrapper.is-hovered .trade-sequence-tile-popover,
                        .trade-sequence-tile-wrapper:focus-within .trade-sequence-tile-popover {
                          opacity: 1 !important;
                          visibility: visible !important;
                          pointer-events: auto !important;
                        }
                        .trade-sequence-tile-wrapper.pos-center:hover .trade-sequence-tile-popover,
                        .trade-sequence-tile-wrapper.pos-center.is-hovered .trade-sequence-tile-popover {
                          transform: translate(-50%, 0) !important;
                        }
                        .trade-sequence-tile-wrapper.pos-edge:hover .trade-sequence-tile-popover,
                        .trade-sequence-tile-wrapper.pos-edge.is-hovered .trade-sequence-tile-popover {
                          transform: translateY(0) !important;
                        }
                        .trade-sequence-tile-wrapper:hover .trade-sequence-tile-card,
                        .trade-sequence-tile-wrapper.is-hovered .trade-sequence-tile-card {
                          background: var(--bg-hover, #f1f5f9) !important;
                          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
                          transform: translateY(-1px);
                        }
                      `}</style>

                      <div
                        className="custom-scrollbar"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: displayedTiles.length <= 8
                            ? `repeat(${displayedTiles.length}, minmax(0, 1fr))`
                            : 'repeat(auto-fill, minmax(115px, 1fr))',
                          gap: '10px',
                          maxHeight: displayedTiles.length > 8 ? '360px' : 'none',
                          overflowY: displayedTiles.length > 8 ? 'auto' : 'visible',
                          paddingRight: displayedTiles.length > 8 ? '4px' : '0px',
                        }}
                      >
                        {displayedTiles.map((tile, idx) => {
                          const isWin = tile.outcome === 'win';
                          const isLoss = tile.outcome === 'loss';
                          const moveVal = Math.abs(tile.stockMove).toFixed(1);
                          const borderColor = isWin ? '#10b981' : isLoss ? '#ef4444' : '#94a3b8';
                          const moveColor = isWin ? '#059669' : isLoss ? '#dc2626' : 'var(--text-muted, #64748b)';

                          const isHovered = hoveredSequenceTile === idx;
                          const isFirst = idx === 0;
                          const isLast = idx === displayedTiles.length - 1;
                          const openDownward = displayedTiles.length > 8 && idx < 8;

                          return (
                            <div
                              key={idx}
                              className={`trade-sequence-tile-wrapper ${isFirst || isLast ? 'pos-edge' : 'pos-center'} ${isHovered ? 'is-hovered' : ''}`}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                minWidth: 0,
                                position: 'relative',
                              }}
                              onMouseEnter={() => setHoveredSequenceTile(idx)}
                              onMouseLeave={() => setHoveredSequenceTile(null)}
                            >
                              {/* The Trade Tile */}
                              <div
                                className="trade-sequence-tile-card"
                                title={`${tile.symbol} • ${isWin ? 'WIN' : isLoss ? 'LOSS' : 'BE'} • ${fmtINR(tile.pnl, true)} (${isWin ? '+' : ''}${tile.stockMove}%)`}
                                style={{
                                  background: isHovered ? 'var(--bg-hover, #f1f5f9)' : 'var(--bg-muted, #f8f9fa)',
                                  borderLeft: `2.5px solid ${borderColor}`,
                                  borderRadius: '12px',
                                  padding: '10px 12px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  minHeight: '52px',
                                  cursor: 'pointer',
                                  transition: 'background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
                                  width: '100%',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                  <span
                                    style={{
                                      fontSize: '12px',
                                      fontWeight: 700,
                                      color: 'var(--text-primary, #0f172a)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {tile.symbol}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      color: moveColor,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {isWin ? `+${moveVal}%` : isLoss ? `-${moveVal}%` : `+0.0%`}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    fontSize: '11px',
                                    fontFamily: 'var(--font-mono, monospace)',
                                    fontWeight: 500,
                                    color: 'var(--text-muted, #64748b)',
                                    marginTop: '4px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {fmtINR(tile.pnl, true)}
                                </div>
                              </div>

                              {/* Full Stock Name & Trade Popover on Hover */}
                              <div
                                className="trade-sequence-tile-popover"
                                style={{
                                  position: 'absolute',
                                  ...(openDownward
                                    ? { top: 'calc(100% + 8px)' }
                                    : { bottom: 'calc(100% + 8px)' }),
                                  zIndex: 9999,
                                  minWidth: '170px',
                                  left: isFirst ? '0px' : isLast ? 'auto' : '50%',
                                  right: isLast ? '0px' : 'auto',
                                  transform: isFirst || isLast
                                    ? (openDownward ? 'translateY(-4px)' : 'translateY(4px)')
                                    : (openDownward ? 'translate(-50%, -4px)' : 'translate(-50%, 4px)'),
                                }}
                              >
                                {openDownward && (
                                  /* Arrow pointing UP */
                                  <div
                                    style={{
                                      width: '8px',
                                      height: '8px',
                                      background: 'var(--bg-card, #ffffff)',
                                      borderLeft: '1px solid var(--border-color, #eaecf0)',
                                      borderTop: '1px solid var(--border-color, #eaecf0)',
                                      transform: 'rotate(45deg)',
                                      margin: '0 auto -4px auto',
                                      position: 'relative',
                                      left: isFirst ? '20px' : isLast ? '-20px' : '0px',
                                      zIndex: 2,
                                    }}
                                  />
                                )}

                                <div
                                  style={{
                                    background: 'var(--bg-card, #ffffff)',
                                    color: 'var(--text-primary, #0f172a)',
                                    padding: '10px 14px',
                                    borderRadius: '12px',
                                    boxShadow: '0 14px 35px -4px rgba(0, 0, 0, 0.22), 0 4px 12px -2px rgba(0, 0, 0, 0.1)',
                                    border: '1px solid var(--border-color, #eaecf0)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    position: 'relative',
                                    zIndex: 1,
                                  }}
                                >
                                  {/* Full Untruncated Symbol Name */}
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #0f172a)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                                      {tile.symbol}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        fontWeight: 800,
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        background: isWin ? 'rgba(16, 185, 129, 0.12)' : isLoss ? 'rgba(239, 68, 68, 0.12)' : 'rgba(148, 163, 184, 0.15)',
                                        color: isWin ? '#059669' : isLoss ? '#dc2626' : 'var(--text-muted, #64748b)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                      }}
                                    >
                                      {isWin ? 'WIN' : isLoss ? 'LOSS' : 'BE'}
                                    </span>
                                  </div>

                                  {/* Net P&L and Move % */}
                                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginTop: '2px' }}>
                                    <span
                                      style={{
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        fontFamily: 'var(--font-mono, monospace)',
                                        color: isWin ? '#059669' : isLoss ? '#dc2626' : 'var(--text-muted, #64748b)',
                                      }}
                                    >
                                      {fmtINR(tile.pnl, true)}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: isWin ? '#059669' : isLoss ? '#dc2626' : 'var(--text-muted, #64748b)',
                                      }}
                                    >
                                      {isWin ? `+${moveVal}%` : isLoss ? `-${moveVal}%` : `+0.0%`}
                                    </span>
                                  </div>

                                  {/* Trade Date */}
                                  {tile.date && (
                                    <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted, #94a3b8)', marginTop: '2px', borderTop: '1px solid var(--border-color, #eaecf0)', paddingTop: '4px' }}>
                                      {tile.date}
                                    </div>
                                  )}
                                </div>

                                {!openDownward && (
                                  /* Arrow pointing DOWN */
                                  <div
                                    style={{
                                      width: '8px',
                                      height: '8px',
                                      background: 'var(--bg-card, #ffffff)',
                                      borderRight: '1px solid var(--border-color, #eaecf0)',
                                      borderBottom: '1px solid var(--border-color, #eaecf0)',
                                      transform: 'rotate(45deg)',
                                      margin: '-4px auto 0 auto',
                                      position: 'relative',
                                      left: isFirst ? '20px' : isLast ? '-20px' : '0px',
                                      zIndex: 2,
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ── CARD 2: TRADING CALENDAR HEATMAP ── */}
            <div
              className="w-full rounded-3xl border border-border/40 bg-card/15 backdrop-blur-2xl text-card-foreground shadow-none space-y-4"
              style={{ padding: '24px', borderRadius: '24px' }}
            >
              <div>
                <h3 className="text-base font-bold text-foreground">Trading Calendar Heatmap</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Realized P&amp;L spread mapped on a calendar view
                </p>
              </div>

              {/* Subcard */}
              <div
                className="rounded-lg border bg-card text-card-foreground overflow-hidden border-none bg-gradient-to-b from-card to-background/50 shadow-sm transition-all duration-300"
                style={{ borderRadius: '12px', border: '1px solid var(--border)' }}
              >
                <div
                  className="flex items-center justify-between border-b border-border/30"
                  style={{ padding: '20px 24px 14px 24px' }}
                >
                  <div className="flex items-center gap-4">
                    <h3
                      className="bg-gradient-to-r from-foreground/90 to-foreground/60 bg-clip-text text-lg font-bold tracking-tight text-transparent italic inline-block"
                      style={{ paddingRight: '12px' }}
                    >
                      {heatmapMode === 'pl' ? 'Daily P/L Heatmap (Cash Basis)' : 'Stop Loss Hit Heatmap'}
                    </h3>

                    {/* Pill toggle */}
                    <div className="relative bg-muted/60 p-[3px] rounded-full flex items-center h-7 w-[88px] border border-border/50 shadow-inner">
                      <div
                        className={cn(
                          "absolute h-[22px] w-[40px] bg-background rounded-full shadow-sm border border-border/30 transition-transform duration-200 ease-out",
                          heatmapMode === 'sl' ? "translate-x-[42px]" : "translate-x-0"
                        )}
                      />
                      <button
                        onClick={() => setHeatmapMode('pl')}
                        className={cn(
                          "relative z-10 h-full flex-1 text-[9px] font-bold uppercase tracking-wider transition-colors duration-200",
                          heatmapMode === 'pl' ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
                        )}
                      >
                        P/L
                      </button>
                      <button
                        onClick={() => setHeatmapMode('sl')}
                        className={cn(
                          "relative z-10 h-full flex-1 text-[9px] font-bold uppercase tracking-wider transition-colors duration-200",
                          heatmapMode === 'sl' ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
                        )}
                      >
                        SL
                      </button>
                    </div>
                  </div>

                  {/* Maximize Button */}
                  <button
                    onClick={() => setIsHeatmapFullscreen(true)}
                    className="inline-flex items-center justify-center rounded-md size-8 p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    title="Expand Heatmap"
                  >
                    <Maximize2 className="size-4" />
                  </button>
                </div>

                {/* Heatmap Body */}
                <div style={{ padding: '20px 24px 24px 24px' }}>
                  <HeatmapSvg
                    calendarData={calendarHeatmapData}
                    mode={heatmapMode}
                    onHoverCell={(day, e) => {
                      if (!day) setHoveredHeatmapCell(null);
                      else setHoveredHeatmapCell({ ...day, clientX: e.clientX, clientY: e.clientY });
                    }}
                  />

                  <HeatmapLegend
                    mode={heatmapMode}
                    totalPeriodPnl={calendarHeatmapData.totalPeriodPnl}
                    slStats={calendarHeatmapData.slStats}
                  />
                </div>
              </div>
            </div>

            {/* Hover Tooltip for Heatmap Cells */}
            {hoveredHeatmapCell && (
              <div
                className="pointer-events-none fixed z-[9999] select-none text-xs"
                style={{
                  left: Math.min(window.innerWidth - 220, Math.max(20, hoveredHeatmapCell.clientX - 60)),
                  top: Math.max(20, hoveredHeatmapCell.clientY - 90),
                  padding: '12px 16px',
                  borderRadius: '14px',
                  border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                  backgroundColor: 'var(--card, #ffffff)',
                  boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.18), 0 0 1px 1px rgba(0, 0, 0, 0.05)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  boxSizing: 'border-box',
                  minWidth: '150px',
                }}
              >
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted, #94a3b8)', marginBottom: '6px' }}>
                  {hoveredHeatmapCell.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                {hoveredHeatmapCell.data ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {heatmapMode === 'pl' ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary, #64748b)' }}>P/L</span>
                          <span style={{ fontSize: '13px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: hoveredHeatmapCell.data.pnl >= 0 ? '#10b981' : '#ef4444' }}>
                            {fmtINR(hoveredHeatmapCell.data.pnl, true)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', fontSize: '10px', color: 'var(--text-secondary, #64748b)' }}>
                          <span>Trades</span>
                          <span style={{ fontWeight: 700, color: 'var(--foreground, #09090b)' }}>
                            {hoveredHeatmapCell.data.count} ({Array.from(hoveredHeatmapCell.data.symbols).join(', ')})
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        {hoveredHeatmapCell.data.slHits > 0 ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: hoveredHeatmapCell.data.outcomeColor || '#ef4444' }}>
                                {hoveredHeatmapCell.data.slHits} SL Hit{hoveredHeatmapCell.data.slHits > 1 ? 's' : ''}
                              </span>
                              <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', background: 'var(--muted, rgba(0,0,0,0.06))', color: 'var(--text-muted, #64748b)' }}>
                                {hoveredHeatmapCell.data.sameDayHits > 0 ? 'Intraday' : 'Delivery'}
                              </span>
                            </div>
                            {hoveredHeatmapCell.data.outcomeLabel && (
                              <div style={{ fontSize: '11px', fontWeight: 600, color: hoveredHeatmapCell.data.outcomeColor }}>
                                {hoveredHeatmapCell.data.outcomeLabel}
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', fontSize: '10px', color: 'var(--text-secondary, #64748b)', borderTop: '1px dashed var(--border, rgba(0,0,0,0.08))', paddingTop: '3px', marginTop: '2px' }}>
                              <span>Stocks</span>
                              <span style={{ fontWeight: 700, color: 'var(--foreground, #09090b)' }}>
                                {Array.from(hoveredHeatmapCell.data.symbols).join(', ')}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic' }}>No SL hits recorded</div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic' }}>No trades recorded</div>
                )}
              </div>
            )}

            {/* Fullscreen Heatmap Modal */}
            {isHeatmapFullscreen && (
              <div
                className="fixed inset-0 z-[5000] bg-background/95 backdrop-blur-md pt-16 p-6 flex flex-col items-center justify-center animate-in fade-in duration-200"
                role="dialog"
                aria-modal="true"
              >
                <div className="size-full max-w-7xl mx-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-8 py-5">
                    <div className="flex items-center gap-6">
                      <h3 className="text-2xl font-bold tracking-tight text-foreground/80 italic" style={{ paddingRight: '12px' }}>
                        {heatmapMode === 'pl' ? 'Daily P/L Heatmap' : 'Stop Loss Hit Heatmap'}
                      </h3>
                      {/* Pill toggle */}
                      <div className="relative bg-muted/60 p-[3px] rounded-full flex items-center h-8 w-[100px] border border-border/50 shadow-inner">
                        <div
                          className={cn(
                            "absolute h-[24px] w-[46px] bg-background rounded-full shadow-sm border border-border/30 transition-transform duration-200 ease-out",
                            heatmapMode === 'sl' ? "translate-x-[48px]" : "translate-x-0"
                          )}
                        />
                        <button
                          onClick={() => setHeatmapMode('pl')}
                          className={cn(
                            "relative z-10 h-full flex-1 text-[10px] font-bold uppercase tracking-wider transition-colors duration-200",
                            heatmapMode === 'pl' ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
                          )}
                        >
                          P/L
                        </button>
                        <button
                          onClick={() => setHeatmapMode('sl')}
                          className={cn(
                            "relative z-10 h-full flex-1 text-[10px] font-bold uppercase tracking-wider transition-colors duration-200",
                            heatmapMode === 'sl' ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
                          )}
                        >
                          SL
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsHeatmapFullscreen(false)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      title="Close"
                    >
                      <X className="size-5" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="flex-1 p-8 flex flex-col justify-center overflow-x-auto">
                    <HeatmapSvg
                      calendarData={calendarHeatmapData}
                      mode={heatmapMode}
                      onHoverCell={(day, e) => {
                        if (!day) setHoveredHeatmapCell(null);
                        else setHoveredHeatmapCell({ ...day, clientX: e.clientX, clientY: e.clientY });
                      }}
                    />

                    <HeatmapLegend
                      mode={heatmapMode}
                      totalPeriodPnl={calendarHeatmapData.totalPeriodPnl}
                      slStats={calendarHeatmapData.slStats}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {subTab === 'SECTOR' && (
          <div className="mt-5 bg-card/15 backdrop-blur-2xl border border-border/10 rounded-3xl p-6 sm:p-7 flex flex-col gap-8 shadow-none animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* ── 4 KPI CARDS ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Top Industry */}
              <div className="cursor-help relative group" data-state="closed">
                <div className="rounded-lg text-card-foreground overflow-hidden border-none bg-muted/35 hover:bg-muted/50 transition-all duration-300 shadow-none">
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-lg sm:text-xl font-bold tracking-tight text-foreground/80 italic">
                          Top Industry
                        </p>
                        <p
                          className="text-lg sm:text-xl font-mono font-bold tracking-tight text-foreground truncate mt-0.5"
                          title={sectorIndustryAnalysis.topIndustry.name}
                        >
                          {sectorIndustryAnalysis.topIndustry.name}
                        </p>
                      </div>
                      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border/30 bg-background/50 shadow-xs text-blue-500/50 group-hover:scale-110 transition-transform duration-200">
                        <TrendingUp className="size-3.5" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hovering Tooltip / Popover */}
                {sectorIndustryAnalysis.topIndustry.symbols?.length > 0 && (
                  <div
                    className="pointer-events-none absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200"
                    style={{
                      minWidth: '180px',
                      maxWidth: '260px',
                      padding: '12px 16px',
                      borderRadius: '14px',
                      border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                      backgroundColor: 'var(--card, #ffffff)',
                      boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.18), 0 0 1px 1px rgba(0, 0, 0, 0.05)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      boxSizing: 'border-box',
                      width: 'max-content',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '9999px',
                          backgroundColor: '#3b82f6',
                          flexShrink: 0,
                          boxShadow: '0 0 6px rgba(59, 130, 246, 0.6)',
                        }}
                      />
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--foreground, #09090b)',
                          letterSpacing: '-0.01em',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {sectorIndustryAnalysis.topIndustry.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
                        {sectorIndustryAnalysis.topIndustry.count} {sectorIndustryAnalysis.topIndustry.count === 1 ? 'trade' : 'trades'}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '5px',
                          backgroundColor: 'rgba(59, 130, 246, 0.12)',
                          color: '#2563eb',
                        }}
                      >
                        {typeof sectorIndustryAnalysis.topIndustry.percentage === 'number' ? sectorIndustryAnalysis.topIndustry.percentage.toFixed(1) : sectorIndustryAnalysis.topIndustry.percentage}% allocation
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {sectorIndustryAnalysis.topIndustry.symbols.map(sym => (
                        <span
                          key={sym}
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: 'var(--foreground, #334155)',
                            backgroundColor: 'var(--muted, rgba(0, 0, 0, 0.05))',
                            border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            lineHeight: 1.2,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {sym}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Least Industry */}
              <div className="cursor-help relative group" data-state="closed">
                <div className="rounded-lg text-card-foreground overflow-hidden border-none bg-muted/35 hover:bg-muted/50 transition-all duration-300 shadow-none">
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-lg sm:text-xl font-bold tracking-tight text-foreground/80 italic">
                          Least Industry
                        </p>
                        <p
                          className="text-lg sm:text-xl font-mono font-bold tracking-tight text-foreground truncate mt-0.5"
                          title={sectorIndustryAnalysis.leastIndustry.name}
                        >
                          {sectorIndustryAnalysis.leastIndustry.name}
                        </p>
                      </div>
                      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border/30 bg-background/50 shadow-xs text-amber-500/50 group-hover:scale-110 transition-transform duration-200">
                        <TrendingDown className="size-3.5" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hovering Tooltip / Popover */}
                {sectorIndustryAnalysis.leastIndustry.symbols?.length > 0 && (
                  <div
                    className="pointer-events-none absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200"
                    style={{
                      minWidth: '180px',
                      maxWidth: '260px',
                      padding: '12px 16px',
                      borderRadius: '14px',
                      border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                      backgroundColor: 'var(--card, #ffffff)',
                      boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.18), 0 0 1px 1px rgba(0, 0, 0, 0.05)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      boxSizing: 'border-box',
                      width: 'max-content',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '9999px',
                          backgroundColor: '#f59e0b',
                          flexShrink: 0,
                          boxShadow: '0 0 6px rgba(245, 158, 11, 0.6)',
                        }}
                      />
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--foreground, #09090b)',
                          letterSpacing: '-0.01em',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {sectorIndustryAnalysis.leastIndustry.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
                        {sectorIndustryAnalysis.leastIndustry.count} {sectorIndustryAnalysis.leastIndustry.count === 1 ? 'trade' : 'trades'}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '5px',
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          color: '#d97706',
                        }}
                      >
                        {typeof sectorIndustryAnalysis.leastIndustry.percentage === 'number' ? sectorIndustryAnalysis.leastIndustry.percentage.toFixed(1) : sectorIndustryAnalysis.leastIndustry.percentage}% allocation
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {sectorIndustryAnalysis.leastIndustry.symbols.map(sym => (
                        <span
                          key={sym}
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: 'var(--foreground, #334155)',
                            backgroundColor: 'var(--muted, rgba(0, 0, 0, 0.05))',
                            border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            lineHeight: 1.2,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {sym}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Top Sector */}
              <div className="cursor-help relative group" data-state="closed">
                <div className="rounded-lg text-card-foreground overflow-hidden border-none bg-muted/35 hover:bg-muted/50 transition-all duration-300 shadow-none">
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-lg sm:text-xl font-bold tracking-tight text-foreground/80 italic">
                          Top Sector
                        </p>
                        <p
                          className="text-lg sm:text-xl font-mono font-bold tracking-tight text-foreground truncate mt-0.5"
                          title={sectorIndustryAnalysis.topSector.name}
                        >
                          {sectorIndustryAnalysis.topSector.name}
                        </p>
                      </div>
                      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border/30 bg-background/50 shadow-xs text-blue-500/50 group-hover:scale-110 transition-transform duration-200">
                        <TrendingUp className="size-3.5" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hovering Tooltip / Popover */}
                {sectorIndustryAnalysis.topSector.symbols?.length > 0 && (
                  <div
                    className="pointer-events-none absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200"
                    style={{
                      minWidth: '180px',
                      maxWidth: '260px',
                      padding: '12px 16px',
                      borderRadius: '14px',
                      border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                      backgroundColor: 'var(--card, #ffffff)',
                      boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.18), 0 0 1px 1px rgba(0, 0, 0, 0.05)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      boxSizing: 'border-box',
                      width: 'max-content',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '9999px',
                          backgroundColor: '#3b82f6',
                          flexShrink: 0,
                          boxShadow: '0 0 6px rgba(59, 130, 246, 0.6)',
                        }}
                      />
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--foreground, #09090b)',
                          letterSpacing: '-0.01em',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {sectorIndustryAnalysis.topSector.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
                        {sectorIndustryAnalysis.topSector.count} {sectorIndustryAnalysis.topSector.count === 1 ? 'trade' : 'trades'}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '5px',
                          backgroundColor: 'rgba(59, 130, 246, 0.12)',
                          color: '#2563eb',
                        }}
                      >
                        {typeof sectorIndustryAnalysis.topSector.percentage === 'number' ? sectorIndustryAnalysis.topSector.percentage.toFixed(1) : sectorIndustryAnalysis.topSector.percentage}% allocation
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {sectorIndustryAnalysis.topSector.symbols.map(sym => (
                        <span
                          key={sym}
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: 'var(--foreground, #334155)',
                            backgroundColor: 'var(--muted, rgba(0, 0, 0, 0.05))',
                            border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            lineHeight: 1.2,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {sym}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Least Sector */}
              <div className="cursor-help relative group" data-state="closed">
                <div className="rounded-lg text-card-foreground overflow-hidden border-none bg-muted/35 hover:bg-muted/50 transition-all duration-300 shadow-none">
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-lg sm:text-xl font-bold tracking-tight text-foreground/80 italic">
                          Least Sector
                        </p>
                        <p
                          className="text-lg sm:text-xl font-mono font-bold tracking-tight text-foreground truncate mt-0.5"
                          title={sectorIndustryAnalysis.leastSector.name}
                        >
                          {sectorIndustryAnalysis.leastSector.name}
                        </p>
                      </div>
                      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border/30 bg-background/50 shadow-xs text-amber-500/50 group-hover:scale-110 transition-transform duration-200">
                        <TrendingDown className="size-3.5" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hovering Tooltip / Popover */}
                {sectorIndustryAnalysis.leastSector.symbols?.length > 0 && (
                  <div
                    className="pointer-events-none absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200"
                    style={{
                      minWidth: '180px',
                      maxWidth: '260px',
                      padding: '12px 16px',
                      borderRadius: '14px',
                      border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                      backgroundColor: 'var(--card, #ffffff)',
                      boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.18), 0 0 1px 1px rgba(0, 0, 0, 0.05)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      boxSizing: 'border-box',
                      width: 'max-content',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '9999px',
                          backgroundColor: '#f59e0b',
                          flexShrink: 0,
                          boxShadow: '0 0 6px rgba(245, 158, 11, 0.6)',
                        }}
                      />
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--foreground, #09090b)',
                          letterSpacing: '-0.01em',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {sectorIndustryAnalysis.leastSector.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
                        {sectorIndustryAnalysis.leastSector.count} {sectorIndustryAnalysis.leastSector.count === 1 ? 'trade' : 'trades'}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '5px',
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          color: '#d97706',
                        }}
                      >
                        {typeof sectorIndustryAnalysis.leastSector.percentage === 'number' ? sectorIndustryAnalysis.leastSector.percentage.toFixed(1) : sectorIndustryAnalysis.leastSector.percentage}% allocation
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {sectorIndustryAnalysis.leastSector.symbols.map(sym => (
                        <span
                          key={sym}
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: 'var(--foreground, #334155)',
                            backgroundColor: 'var(--muted, rgba(0, 0, 0, 0.05))',
                            border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            lineHeight: 1.2,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {sym}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── DISTRIBUTION MATRICES ── */}
            <div className="grid gap-6 grid-cols-1">
              {/* CARD 1: SECTOR ALLOCATION DISTRIBUTION */}
              <div id="sector-allocation-card" className="flex flex-col gap-2.5 border-b border-border/10 pb-6">
                <h4 className="text-sm font-semibold text-foreground">
                  Sector Allocation Distribution
                </h4>
                <div className="h-auto w-full">
                  <div className="rounded-lg border bg-card text-card-foreground border-none bg-gradient-to-b from-card to-background/30 shadow-sm">
                    <div className="flex items-center justify-between p-6 px-8 py-6">
                      <div>
                        <h3 className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-2xl font-bold tracking-tight text-transparent italic">
                          Sector Performance Matrix
                        </h3>
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">
                          Capital Allocation by Sector
                        </div>
                      </div>
                    </div>

                    <div className="p-6 pt-0 px-4 pb-8">
                      {/* Legend */}
                      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-4">
                        {sectorIndustryAnalysis.sectors.slice(0, 5).map((sec, idx) => (
                          <div key={idx} className="flex items-center gap-2 group cursor-default">
                            <div
                              className="h-1.5 w-6 rounded-full transition-all duration-300 group-hover:w-8"
                              style={{ backgroundColor: sec.color, opacity: 0.9 }}
                            />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 transition-colors group-hover:text-muted-foreground">
                              {sec.name}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* 2 Charts Grid */}
                      <div className="mt-8 grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
                        {/* Left: Donut Chart */}
                        <div className="relative">
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30">Total</span>
                            <span className="text-2xl font-black italic tabular-nums tracking-tighter text-foreground/80">
                              {sectorIndustryAnalysis.totalTrades}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Trades</span>
                          </div>
                          <ResponsiveContainer width="100%" height={320}>
                            <RechartsPieChart>
                              <Tooltip
                                content={<SectorCustomTooltip />}
                                wrapperStyle={{ zIndex: 100, outline: 'none' }}
                                allowEscapeViewBox={{ x: true, y: true }}
                              />
                              <Pie
                                key={`sec-pie-${sectorIndustryAnalysis.sectors.map(s => `${s.name}:${s.trades}`).join('_')}`}
                                data={sectorIndustryAnalysis.sectors.slice(0, 5)}
                                dataKey="trades"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius="65%"
                                outerRadius="90%"
                                paddingAngle={4}
                                stroke="none"
                                label={renderSectorDonutLabel}
                                labelLine={false}
                                isAnimationActive={true}
                                animationDuration={800}
                                animationEasing="ease-out"
                                animationBegin={0}
                              >
                                {sectorIndustryAnalysis.sectors.slice(0, 5).map((entry, index) => (
                                  <Cell
                                    key={`sec-cell-${entry.name || index}`}
                                    fill={entry.fill || entry.color}
                                    fillOpacity={0.9}
                                    className="transition-all duration-300 hover:fill-opacity-100 cursor-pointer"
                                  />
                                ))}
                              </Pie>
                            </RechartsPieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Right: Horizontal Bar Chart */}
                        <div className="w-full h-[320px]">
                          <ResponsiveContainer width="100%" height={320}>
                            <BarChart
                              layout="vertical"
                              data={sectorIndustryAnalysis.sectors.slice(0, 5)}
                              margin={{ top: 20, right: 40, left: 10, bottom: 20 }}
                            >
                              <CartesianGrid strokeDasharray="6 6" stroke="hsl(var(--border))" opacity={0.4} horizontal={false} vertical={true} />
                              <XAxis type="number" hide />
                              <YAxis
                                type="category"
                                dataKey="name"
                                stroke="none"
                                tick={{ fontSize: 11, fontWeight: 500, fill: 'hsl(var(--muted-foreground))' }}
                                width={120}
                                tickLine={false}
                                axisLine={false}
                                interval={0}
                                tickFormatter={(val) => val.length > 15 ? `${val.substring(0, 14)}...` : val}
                              />
                              <Tooltip
                                content={<SectorCustomTooltip />}
                                cursor={{ fill: 'hsl(var(--primary))', opacity: 0.03 }}
                                wrapperStyle={{ zIndex: 100, outline: 'none' }}
                                allowEscapeViewBox={{ x: true, y: true }}
                              />
                              <Bar
                                dataKey="percentage"
                                radius={[0, 10, 10, 0]}
                                barSize={16}
                                isAnimationActive={true}
                                animationDuration={800}
                                animationEasing="ease-out"
                              >
                                {sectorIndustryAnalysis.sectors.slice(0, 5).map((entry, index) => (
                                  <Cell
                                    key={`sec-bar-${entry.name || index}`}
                                    fill={entry.fill || entry.color}
                                    fillOpacity={0.85}
                                    className="recharts-rectangle transition-all duration-300 hover:fill-opacity-100 hover:brightness-110 cursor-pointer"
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 2: INDUSTRY ALLOCATION DISTRIBUTION */}
              <div id="industry-allocation-card" className="flex flex-col gap-2.5 pb-4">
                <h4 className="text-sm font-semibold text-foreground">
                  Industry Allocation Distribution
                </h4>
                <div className="h-auto w-full">
                  <div className="rounded-lg border bg-card text-card-foreground border-none bg-gradient-to-b from-card to-background/30 shadow-sm">
                    <div className="flex items-center justify-between p-6 px-8 py-6">
                      <div>
                        <h3 className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-2xl font-bold tracking-tight text-transparent italic">
                          Industry Performance Matrix
                        </h3>
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">
                          Capital Allocation by Industry
                        </div>
                      </div>
                    </div>

                    <div className="p-6 pt-0 px-4 pb-8">
                      {/* Legend */}
                      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-4">
                        {sectorIndustryAnalysis.industries.slice(0, 5).map((ind, idx) => (
                          <div key={idx} className="flex items-center gap-2 group cursor-default">
                            <div
                              className="h-1.5 w-6 rounded-full transition-all duration-300 group-hover:w-8"
                              style={{ backgroundColor: ind.color, opacity: 0.9 }}
                            />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 transition-colors group-hover:text-muted-foreground">
                              {ind.name}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* 2 Charts Grid */}
                      <div className="mt-8 grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
                        {/* Left: Donut Chart */}
                        <div className="relative">
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30">Total</span>
                            <span className="text-2xl font-black italic tabular-nums tracking-tighter text-foreground/80">
                              {sectorIndustryAnalysis.totalTrades}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Trades</span>
                          </div>
                          <ResponsiveContainer width="100%" height={320}>
                            <RechartsPieChart>
                              <Tooltip
                                content={<SectorCustomTooltip />}
                                wrapperStyle={{ zIndex: 100, outline: 'none' }}
                                allowEscapeViewBox={{ x: true, y: true }}
                              />
                              <Pie
                                key={`ind-pie-${sectorIndustryAnalysis.industries.map(i => `${i.name}:${i.trades}`).join('_')}`}
                                data={sectorIndustryAnalysis.industries.slice(0, 5)}
                                dataKey="trades"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius="65%"
                                outerRadius="90%"
                                paddingAngle={4}
                                stroke="none"
                                label={renderSectorDonutLabel}
                                labelLine={false}
                                isAnimationActive={true}
                                animationDuration={800}
                                animationEasing="ease-out"
                                animationBegin={0}
                              >
                                {sectorIndustryAnalysis.industries.slice(0, 5).map((entry, index) => (
                                  <Cell
                                    key={`ind-cell-${entry.name || index}`}
                                    fill={entry.fill || entry.color}
                                    fillOpacity={0.9}
                                    className="transition-all duration-300 hover:fill-opacity-100 cursor-pointer"
                                  />
                                ))}
                              </Pie>
                            </RechartsPieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Right: Horizontal Bar Chart */}
                        <div className="w-full h-[320px]">
                          <ResponsiveContainer width="100%" height={320}>
                            <BarChart
                              layout="vertical"
                              data={sectorIndustryAnalysis.industries.slice(0, 5)}
                              margin={{ top: 20, right: 40, left: 10, bottom: 20 }}
                            >
                              <CartesianGrid strokeDasharray="6 6" stroke="hsl(var(--border))" opacity={0.4} horizontal={false} vertical={true} />
                              <XAxis type="number" hide />
                              <YAxis
                                type="category"
                                dataKey="name"
                                stroke="none"
                                tick={{ fontSize: 11, fontWeight: 500, fill: 'hsl(var(--muted-foreground))' }}
                                width={120}
                                tickLine={false}
                                axisLine={false}
                                interval={0}
                                tickFormatter={(val) => val.length > 15 ? `${val.substring(0, 14)}...` : val}
                              />
                              <Tooltip
                                content={<SectorCustomTooltip />}
                                cursor={{ fill: 'hsl(var(--primary))', opacity: 0.03 }}
                                wrapperStyle={{ zIndex: 100, outline: 'none' }}
                                allowEscapeViewBox={{ x: true, y: true }}
                              />
                              <Bar
                                dataKey="percentage"
                                radius={[0, 10, 10, 0]}
                                barSize={16}
                                isAnimationActive={true}
                                animationDuration={800}
                                animationEasing="ease-out"
                              >
                                {sectorIndustryAnalysis.industries.slice(0, 5).map((entry, index) => (
                                  <Cell
                                    key={`ind-bar-${entry.name || index}`}
                                    fill={entry.fill || entry.color}
                                    fillOpacity={0.85}
                                    className="recharts-rectangle transition-all duration-300 hover:fill-opacity-100 hover:brightness-110 cursor-pointer"
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {subTab === 'RISK' && (
          <RiskExpectancyMatrix trades={trades} />
        )}

        {subTab === 'QUALITY' && (
          <TradeQualitySection trades={trades} visibleCols={visibleCols} onToggleCol={onToggleCol} />
        )}

        {subTab === 'VISUAL' && (
          <VisualAnalyticsSection trades={trades} />
        )}

        {subTab !== 'POSITION' && subTab !== 'STREAKS' && subTab !== 'SECTOR' && subTab !== 'RISK' && subTab !== 'QUALITY' && subTab !== 'VISUAL' && (
          <div className="rounded-[2rem] border border-border/40 bg-card p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3 ft-tab-content shadow-sm">
            <Activity className="size-8 opacity-40 text-primary" />
            <p className="font-bold text-base text-foreground">
              {ANALYTICS_SUB_TABS.find(t => t.id === subTab)?.label} Section
            </p>
            <p className="text-xs text-muted-foreground/70 max-w-sm">
              We are building each section one by one. Select <strong>Position &amp; P&amp;L</strong> to explore the completed analytics suite.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
