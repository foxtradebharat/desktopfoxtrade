import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, X, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, XCircle, Info, ChevronRight, Activity, Target,
  BarChart2, Clock, DollarSign, Percent, ArrowUpRight, Zap
} from 'lucide-react';

// ─── Color constants ───────────────────────────────────────────────────────
const GREEN  = '#16a34a';
const YELLOW = '#d97706';
const RED    = '#dc2626';

function getVerdictConfig(isDark) {
  return {
    'GO': {
      color: isDark ? '#4ade80' : GREEN,
      bg: isDark ? 'rgba(22, 163, 74, 0.18)' : '#f0fdf4',
      border: isDark ? 'rgba(34, 197, 94, 0.4)' : '#bbf7d0',
      icon: CheckCircle,
      label: '✅ GO'
    },
    'REDUCE SIZE': {
      color: isDark ? '#fbbf24' : YELLOW,
      bg: isDark ? 'rgba(217, 119, 6, 0.18)' : '#fffbeb',
      border: isDark ? 'rgba(245, 158, 11, 0.4)' : '#fde68a',
      icon: AlertTriangle,
      label: '⚠️ REDUCE SIZE'
    },
    'CAUTION': {
      color: isDark ? '#fb923c' : '#c2410c',
      bg: isDark ? 'rgba(194, 65, 12, 0.18)' : '#fff7ed',
      border: isDark ? 'rgba(234, 88, 12, 0.4)' : '#fed7aa',
      icon: AlertTriangle,
      label: '🟠 CAUTION'
    },
    'AVOID': {
      color: isDark ? '#f87171' : RED,
      bg: isDark ? 'rgba(220, 38, 38, 0.18)' : '#fef2f2',
      border: isDark ? 'rgba(239, 68, 68, 0.4)' : '#fecaca',
      icon: XCircle,
      label: '🚫 AVOID'
    },
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function fmt(n, decimals = 0) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function StatRow({ label, value, color, sub, theme }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '7px 0', borderBottom: `1px solid ${theme.border}` }}>
      <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 500 }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: color || theme.textPrimary }}>{value}</span>
        {sub && <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function ScoreMeter({ score, theme }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 70 ? GREEN : pct >= 50 ? YELLOW : pct >= 35 ? '#c2410c' : RED;
  return (
    <div style={{ margin: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Risk Score</span>
        <span style={{ fontSize: 14, fontWeight: 800, color }}>{Math.round(pct)}/100</span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: theme.meterTrack, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: pct >= 70 ? `linear-gradient(90deg, ${GREEN}, #22c55e)` :
                      pct >= 50 ? `linear-gradient(90deg, ${YELLOW}, #f59e0b)` :
                      pct >= 35 ? `linear-gradient(90deg, #c2410c, #ea580c)` :
                                  `linear-gradient(90deg, ${RED}, #ef4444)`,
          borderRadius: 4,
          transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
        }} />
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function FoxyPreTradePanel({
  isOpen,
  onClose,
  trades = [],
  portfolioCapital = 0,
  themeMode,
  isDark: propIsDark
}) {
  const [form, setForm] = useState({
    symbol: '', entryPrice: '', slPrice: '', targetPrice: '', quantity: '', setupTag: '', riskMode: 'qty'
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  // Theme resolution: props take priority, with reactive DOM/localStorage fallback
  const isDark = propIsDark !== undefined
    ? propIsDark
    : (themeMode === 'dark' || themeMode === 'pitch-black' ||
       (typeof document !== 'undefined' && (
         document.documentElement.classList.contains('dark') ||
         document.documentElement.getAttribute('data-theme') === 'dark' ||
         document.documentElement.getAttribute('data-theme') === 'pitch-black'
       )));
  const isPitchBlack = themeMode === 'pitch-black' ||
    (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'pitch-black');

  const theme = {
    bgPanel: isPitchBlack ? '#000000' : isDark ? '#1e293b' : '#ffffff',
    bgSection: isPitchBlack ? '#0a0a0a' : isDark ? '#0f172a' : '#f9fafb',
    bgInput: isPitchBlack ? '#0a0a0a' : isDark ? '#0f172a' : '#f9fafb',
    border: isPitchBlack ? '#262626' : isDark ? '#334155' : '#f0f0f2',
    borderInput: isPitchBlack ? '#333333' : isDark ? '#334155' : '#e5e7eb',
    textPrimary: isPitchBlack ? '#ffffff' : isDark ? '#f8fafc' : '#111827',
    textSecondary: isPitchBlack ? '#d4d4d4' : isDark ? '#cbd5e1' : '#374151',
    textMuted: isPitchBlack ? '#a3a3a3' : isDark ? '#94a3b8' : '#6b7280',
    bgHover: isPitchBlack ? '#171717' : isDark ? '#334155' : '#f3f4f6',
    toggleActiveBg: isDark ? '#3b82f6' : '#111827',
    toggleInactiveBg: isPitchBlack ? '#171717' : isDark ? '#334155' : '#f3f4f6',
    toggleInactiveText: isPitchBlack ? '#a3a3a3' : isDark ? '#94a3b8' : '#6b7280',
    meterTrack: isDark ? '#334155' : '#e5e7eb',
  };

  const inputStyle = {
    width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13,
    border: `1px solid ${theme.borderInput}`, outline: 'none', background: theme.bgInput,
    color: theme.textPrimary, fontFamily: 'inherit', boxSizing: 'border-box',
    transition: 'border-color 0.15s ease',
  };

  const pillBtn = {
    padding: '6px 12px', borderRadius: 20, border: 'none',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.15s ease', flexShrink: 0
  };

  // Reset when opened
  useEffect(() => {
    if (isOpen) { setResult(null); setError(''); }
  }, [isOpen]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setResult(null);
    setError('');
  };

  /** Run the screening inline — no import needed, logic embedded here */
  const runScreen = useCallback(async () => {
    const { symbol, entryPrice, slPrice, targetPrice, quantity, setupTag, riskMode } = form;
    const entry = parseFloat(entryPrice);
    const sl    = parseFloat(slPrice);
    const tgt   = parseFloat(targetPrice);
    let   qty   = parseFloat(quantity);

    // Validation
    if (!symbol.trim())  return setError('Symbol is required.');
    if (!entry || entry <= 0) return setError('Valid entry price required.');
    if (!sl    || sl <= 0)    return setError('Stop loss price required.');
    if (sl >= entry)          return setError('SL must be below entry (long trade).');
    if (!tgt   || tgt <= entry) return setError('Target must be above entry.');

    const cap = portfolioCapital > 0 ? portfolioCapital : 500000; // fallback ₹5L
    const slDist = entry - sl;

    // If user chose % risk mode, compute qty
    if (riskMode === 'pct') {
      const riskPct = qty / 100;
      qty = Math.floor((cap * riskPct) / slDist);
      if (qty <= 0) return setError('Computed quantity is 0. Check your risk % and SL distance.');
    }
    if (!qty || qty <= 0) return setError('Valid quantity or risk% required.');

    setLoading(true);
    setError('');

    try {
      // ── Position Risk ──────────────────────────────────────────────────
      const capitalAtRisk = (slDist * qty / cap) * 100;
      const projectedRR   = (tgt - entry) / slDist;
      const dollarRisk    = slDist * qty;
      const positionValue = entry * qty;
      const posAsPct      = (positionValue / cap) * 100;
      const rec1pctQty    = Math.floor(cap * 0.01 / slDist);
      const rec2pctQty    = Math.floor(cap * 0.02 / slDist);

      // ── Behavioral State ──────────────────────────────────────────────
      const closedTrades = trades
        .filter(t => (t.status === 'Closed' || t.status === 'Partial') && Number(t.pnl ?? 0) !== 0)
        .sort((a, b) => parseDate(a.date) - parseDate(b.date));

      // Recent streak
      let curStreak = 0, streakType = null;
      for (let i = closedTrades.length - 1; i >= 0; i--) {
        const p = Number(closedTrades[i].pnl ?? 0);
        const t = p > 0 ? 'WIN' : 'LOSS';
        if (streakType === null) { streakType = t; curStreak = 1; }
        else if (t === streakType) curStreak++;
        else break;
      }

      // Revenge trading
      let revengeCases = 0;
      const losses = closedTrades.filter(t => Number(t.pnl ?? 0) < 0);
      for (let i = 0; i < losses.length; i++) {
        const lossDate = parseDate(losses[i].date);
        if (!lossDate) continue;
        const lossIdx = closedTrades.indexOf(losses[i]);
        const nextTrade = closedTrades[lossIdx + 1];
        if (nextTrade) {
          const nextDate = parseDate(nextTrade.date);
          if (nextDate && (nextDate - lossDate) / 86400000 <= 2) revengeCases++;
        }
      }
      const revengePct = losses.length > 0 ? (revengeCases / losses.length) * 100 : 0;
      const revengeTradingRisk = revengePct >= 50 ? 'HIGH' : revengePct >= 25 ? 'MEDIUM' : 'LOW';

      // Day of week stats
      const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const dayStats = Array.from({ length: 7 }, (_, i) => ({ day: dayNames[i], wins: 0, total: 0 }));
      closedTrades.forEach(t => {
        const d = parseDate(t.date);
        if (!d) return;
        const dow = d.getDay();
        dayStats[dow].total++;
        if (Number(t.pnl ?? 0) > 0) dayStats[dow].wins++;
      });
      const currentDow = new Date().getDay();
      const todayStat  = dayStats[currentDow];
      const todayWR    = todayStat.total >= 3 ? Math.round((todayStat.wins / todayStat.total) * 100) : null;

      // ── Setup Stats ───────────────────────────────────────────────────
      const tag = setupTag.trim().toLowerCase();
      const setupTrades = tag
        ? closedTrades.filter(t => (t.setup || '').toLowerCase().includes(tag))
        : closedTrades;
      const sWins = setupTrades.filter(t => Number(t.pnl ?? 0) > 0).length;
      const sWR   = setupTrades.length > 0 ? Math.round((sWins / setupTrades.length) * 100) : null;
      const rList = setupTrades.map(t => parseFloat(t.rewardRisk ?? t.rMultiple)).filter(r => !isNaN(r) && r !== 0);
      const avgR  = rList.length > 0 ? rList.reduce((a, b) => a + b, 0) / rList.length : null;

      // ── Concentration ─────────────────────────────────────────────────
      const openTrades = trades.filter(t => (t.status === 'Open' || t.status === 'Partial') && Number(t.openQty ?? 0) > 0);
      const symbolAlreadyOpen = openTrades.some(t => (t.name || t.symbol || '').toUpperCase() === symbol.toUpperCase().trim());
      const totalOpenRisk = openTrades.reduce((a, t) => a + Number(t.capitalAtRisk ?? 0), 0);

      // ── Verdict Scoring ───────────────────────────────────────────────
      let score = 100;
      const keyRisks = [];
      const recommendations = [];

      if (capitalAtRisk > 4) {
        score -= 30;
        keyRisks.push(`Capital at risk is critically high at ${capitalAtRisk.toFixed(1)}% (max safe: 2%)`);
        recommendations.push(`Reduce qty to ${rec1pctQty} for 1% risk or ${rec2pctQty} for 2% risk`);
      } else if (capitalAtRisk > 2.5) {
        score -= 15;
        keyRisks.push(`Capital at risk ${capitalAtRisk.toFixed(1)}% exceeds the recommended 2% threshold`);
        recommendations.push(`Consider reducing qty to ${rec2pctQty} shares (2% risk = ₹${fmt(cap * 0.02)})`);
      } else if (capitalAtRisk > 1.5) {
        score -= 5;
      }

      if (projectedRR < 1.0) {
        score -= 30;
        keyRisks.push(`R:R of ${projectedRR.toFixed(2)} is below 1:1 — not worth the risk`);
        recommendations.push(`Move target to at least ₹${fmt(entry + slDist)} for 1:1, or ₹${fmt(entry + slDist * 2)} for 2:1`);
      } else if (projectedRR < 1.5) {
        score -= 15;
        keyRisks.push(`R:R of ${projectedRR.toFixed(2)} is below the institutional minimum of 1.5:1`);
        recommendations.push(`Ideal target: ₹${fmt(entry + slDist * 2)} for 2:1 R:R`);
      } else if (projectedRR < 2.0) {
        score -= 5;
      }

      if (revengeTradingRisk === 'HIGH') {
        score -= 20;
        keyRisks.push(`HIGH revenge trading risk detected — ${Math.round(revengePct)}% of your post-loss trades were entered within 2 days`);
        recommendations.push('Take a 24-hour cooling off after the most recent loss before entering');
      } else if (revengeTradingRisk === 'MEDIUM') {
        score -= 10;
        keyRisks.push(`MEDIUM revenge trading tendency — ${Math.round(revengePct)}% post-loss trades entered too quickly`);
      }

      if (streakType === 'LOSS' && curStreak >= 3) {
        score -= 15;
        keyRisks.push(`Currently on a ${curStreak}-trade losing streak — reduce risk significantly`);
        recommendations.push('Risk no more than 0.5% per trade until streak breaks');
      } else if (streakType === 'LOSS' && curStreak >= 2) {
        score -= 8;
        keyRisks.push(`On a ${curStreak}-trade losing streak — consider reducing size`);
      }

      if (todayWR !== null && todayWR < 35) {
        score -= 15;
        keyRisks.push(`Your historical win rate on ${dayNames[currentDow]}s is only ${todayWR}% (${todayStat.total} trades)`);
        recommendations.push(`Consider waiting for a higher-conviction setup or skipping ${dayNames[currentDow]} entries`);
      } else if (todayWR !== null && todayWR < 45) {
        score -= 8;
        keyRisks.push(`${dayNames[currentDow]} has a below-average win rate of ${todayWR}% in your journal`);
      }

      if (symbolAlreadyOpen) {
        score -= 10;
        keyRisks.push(`${symbol.toUpperCase()} already has an open position — adding here doubles concentration risk`);
        recommendations.push('Close or partial-exit existing position before adding fresh exposure');
      }

      if (openTrades.length >= 6) {
        score -= 10;
        keyRisks.push(`You already have ${openTrades.length} open positions — portfolio concentration is high`);
        recommendations.push('Consider reducing open count to under 5 before adding new trades');
      }

      if (sWR !== null && setupTrades.length >= 5) {
        if (sWR < 35) {
          score -= 20;
          keyRisks.push(`Your "${setupTag || 'overall'}" setup has only ${sWR}% win rate over ${setupTrades.length} trades`);
          recommendations.push('This setup has a statistically poor edge — reconsider or paper trade it first');
        } else if (sWR < 45) {
          score -= 10;
          keyRisks.push(`Setup "${setupTag || 'overall'}" has a mediocre win rate of ${sWR}% (${setupTrades.length} trades)`);
        }
      }

      score = Math.max(0, Math.min(100, score));

      let verdict;
      if (score >= 70)      verdict = 'GO';
      else if (score >= 50) verdict = 'REDUCE SIZE';
      else if (score >= 35) verdict = 'CAUTION';
      else                  verdict = 'AVOID';

      setResult({
        positionRisk: { capitalAtRisk, projectedRR, dollarRisk, positionValue, posAsPct, rec1pctQty, rec2pctQty, qty, entry, sl, tgt },
        behavioral:   { recentStreak: { type: streakType, count: curStreak }, revengeTradingRisk, revengePct, todayWR, todayDay: dayNames[currentDow] },
        setupStats:   { winRate: sWR, avgR, totalTrades: setupTrades.length, setupTag: tag || 'All setups' },
        concentration:{ symbolAlreadyOpen, openPositionsCount: openTrades.length, totalOpenRisk },
        verdict:      { verdict, score, keyRisks, recommendations }
      });
    } catch (e) {
      setError(`Screening failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [form, trades, portfolioCapital]);

  if (!isOpen) return null;

  const vcMap = getVerdictConfig(isDark);
  const vc = result ? (vcMap[result.verdict.verdict] || vcMap['CAUTION']) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.25)',
          zIndex: 200, backdropFilter: 'blur(3px)'
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420, maxWidth: '100vw',
        background: theme.bgPanel,
        borderLeft: `1px solid ${theme.border}`,
        boxShadow: isDark ? '-8px 0 40px rgba(0,0,0,0.6)' : '-8px 0 40px rgba(0,0,0,0.12)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflowY: 'auto',
        color: theme.textPrimary
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px', borderBottom: `1px solid ${theme.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: theme.bgPanel, zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ShieldAlert size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: theme.textPrimary, letterSpacing: '-0.2px' }}>Pre-Trade Screener</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>Institutional risk gatekeeper</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Pre-Trade Screener"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: theme.textMuted, padding: 6, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.bgHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>
            Trade Details
          </div>

          {/* Symbol + Setup */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500, display: 'block', marginBottom: 4 }}>Symbol</label>
              <input
                value={form.symbol}
                onChange={e => handleChange('symbol', e.target.value.toUpperCase())}
                placeholder="e.g. RRKABEL"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500, display: 'block', marginBottom: 4 }}>Setup Tag</label>
              <input
                value={form.setupTag}
                onChange={e => handleChange('setupTag', e.target.value)}
                placeholder="e.g. Breakout"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Entry, SL, Target */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            {[['Entry ₹', 'entryPrice', '182'], ['SL ₹', 'slPrice', '174'], ['Target ₹', 'targetPrice', '210']].map(([label, field, ph]) => (
              <div key={field}>
                <label style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500, display: 'block', marginBottom: 4 }}>{label}</label>
                <input
                  type="number"
                  value={form[field]}
                  onChange={e => handleChange(field, e.target.value)}
                  placeholder={ph}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>

          {/* Quantity / Risk mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <button
              onClick={() => handleChange('riskMode', 'qty')}
              style={{
                ...pillBtn,
                background: form.riskMode === 'qty' ? theme.toggleActiveBg : theme.toggleInactiveBg,
                color: form.riskMode === 'qty' ? '#fff' : theme.toggleInactiveText
              }}
            >Qty</button>
            <button
              onClick={() => handleChange('riskMode', 'pct')}
              style={{
                ...pillBtn,
                background: form.riskMode === 'pct' ? theme.toggleActiveBg : theme.toggleInactiveBg,
                color: form.riskMode === 'pct' ? '#fff' : theme.toggleInactiveText
              }}
            >% Risk</button>
            <input
              type="number"
              value={form.quantity}
              onChange={e => handleChange('quantity', e.target.value)}
              placeholder={form.riskMode === 'qty' ? 'Shares' : '1.5 (%)'}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>

          {portfolioCapital === 0 && (
            <div style={{
              fontSize: 11,
              color: isDark ? '#fbbf24' : YELLOW,
              background: isDark ? 'rgba(217, 119, 6, 0.15)' : '#fffbeb',
              border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a'}`,
              borderRadius: 8,
              padding: '6px 10px',
              marginBottom: 8
            }}>
              ⚠️ No portfolio capital detected. Calculations will use ₹5L default. Set capital in Fund Management.
            </div>
          )}

          {error && (
            <div style={{
              fontSize: 12,
              color: isDark ? '#f87171' : RED,
              background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
              border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.35)' : '#fecaca'}`,
              borderRadius: 8,
              padding: '6px 10px',
              marginBottom: 8
            }}>
              {error}
            </div>
          )}

          <button
            onClick={runScreen}
            disabled={loading}
            style={{
              width: '100%', padding: '10px', borderRadius: 12, border: 'none',
              background: loading ? (isDark ? '#334155' : '#e5e7eb') : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
              color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: loading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.15s ease', letterSpacing: '-0.1px'
            }}
          >
            {loading
              ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Analyzing...</>
              : <><ShieldAlert size={15} /> Screen This Trade</>
            }
          </button>
        </div>

        {/* Results */}
        {result && (
          <div style={{ padding: '16px 20px', flex: 1 }}>

            {/* Verdict Banner */}
            <div style={{
              padding: '14px 16px', borderRadius: 14, marginBottom: 16,
              background: vc.bg, border: `1.5px solid ${vc.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: vc.color, letterSpacing: '-0.5px' }}>
                  {vc.label}
                </span>
                <span style={{
                  fontSize: 11,
                  color: vc.color,
                  fontWeight: 600,
                  background: isDark ? 'rgba(0,0,0,0.3)' : vc.border,
                  padding: '2px 8px',
                  borderRadius: 20
                }}>
                  Confidence {result.verdict.score}/100
                </span>
              </div>
              <ScoreMeter score={result.verdict.score} theme={theme} />
            </div>

            {/* Position Risk Summary */}
            <Section title="Position Risk" icon={DollarSign} theme={theme}>
              <StatRow label="Capital at Risk"
                value={`${result.positionRisk.capitalAtRisk.toFixed(2)}%`}
                color={result.positionRisk.capitalAtRisk > 2.5 ? RED : result.positionRisk.capitalAtRisk > 1.5 ? YELLOW : GREEN}
                sub={`₹${fmt(result.positionRisk.dollarRisk)} max loss`}
                theme={theme}
              />
              <StatRow label="Risk:Reward Ratio"
                value={`1 : ${result.positionRisk.projectedRR.toFixed(2)}`}
                color={result.positionRisk.projectedRR >= 2 ? GREEN : result.positionRisk.projectedRR >= 1.5 ? YELLOW : RED}
                theme={theme}
              />
              <StatRow label="Position Size"
                value={`${fmt(result.positionRisk.qty)} shares`}
                sub={`₹${fmt(result.positionRisk.positionValue)} (${result.positionRisk.posAsPct.toFixed(1)}% of portfolio)`}
                theme={theme}
              />
              <StatRow label="Recommended (1% Risk)"
                value={`${fmt(result.positionRisk.rec1pctQty)} shares`}
                color={GREEN}
                sub={`₹${fmt(portfolioCapital * 0.01 || 5000)} max risk`}
                theme={theme}
              />
              <StatRow label="Recommended (2% Risk)"
                value={`${fmt(result.positionRisk.rec2pctQty)} shares`}
                color={YELLOW}
                sub={`₹${fmt(portfolioCapital * 0.02 || 10000)} max risk`}
                theme={theme}
              />
            </Section>

            {/* Behavioral State */}
            <Section title="Your Behavioral State" icon={Activity} theme={theme}>
              <StatRow label="Recent Streak"
                value={result.behavioral.recentStreak.type ? `${result.behavioral.recentStreak.count} ${result.behavioral.recentStreak.type}S` : '—'}
                color={result.behavioral.recentStreak.type === 'LOSS' ? RED : GREEN}
                theme={theme}
              />
              <StatRow label="Revenge Trading Risk"
                value={result.behavioral.revengeTradingRisk}
                color={result.behavioral.revengeTradingRisk === 'HIGH' ? RED : result.behavioral.revengeTradingRisk === 'MEDIUM' ? YELLOW : GREEN}
                sub={`${Math.round(result.behavioral.revengePct)}% of post-loss trades were hasty`}
                theme={theme}
              />
              <StatRow label={`Win Rate on ${result.behavioral.todayDay}s`}
                value={result.behavioral.todayWR !== null ? `${result.behavioral.todayWR}%` : 'Insufficient data'}
                color={result.behavioral.todayWR !== null ? (result.behavioral.todayWR >= 50 ? GREEN : result.behavioral.todayWR >= 40 ? YELLOW : RED) : theme.textMuted}
                theme={theme}
              />
            </Section>

            {/* Setup Stats */}
            <Section title={`Setup: "${result.setupStats.setupTag}"`} icon={BarChart2} theme={theme}>
              <StatRow label="Historical Win Rate"
                value={result.setupStats.winRate !== null ? `${result.setupStats.winRate}%` : 'No data'}
                color={result.setupStats.winRate !== null ? (result.setupStats.winRate >= 50 ? GREEN : result.setupStats.winRate >= 40 ? YELLOW : RED) : theme.textMuted}
                sub={`${result.setupStats.totalTrades} trades in journal`}
                theme={theme}
              />
              <StatRow label="Avg R-Multiple"
                value={result.setupStats.avgR !== null ? `${result.setupStats.avgR >= 0 ? '+' : ''}${result.setupStats.avgR.toFixed(2)}R` : '—'}
                color={result.setupStats.avgR !== null ? (result.setupStats.avgR >= 0.5 ? GREEN : result.setupStats.avgR >= 0 ? YELLOW : RED) : theme.textMuted}
                theme={theme}
              />
            </Section>

            {/* Concentration */}
            <Section title="Portfolio Concentration" icon={Target} theme={theme}>
              <StatRow label="Symbol Already Open"
                value={result.concentration.symbolAlreadyOpen ? 'YES — Doubling Up' : 'No'}
                color={result.concentration.symbolAlreadyOpen ? RED : GREEN}
                theme={theme}
              />
              <StatRow label="Total Open Positions"
                value={String(result.concentration.openPositionsCount)}
                color={result.concentration.openPositionsCount >= 6 ? RED : result.concentration.openPositionsCount >= 4 ? YELLOW : GREEN}
                theme={theme}
              />
              <StatRow label="Total Open Portfolio Risk"
                value={`${Number(result.concentration.totalOpenRisk).toFixed(2)}%`}
                color={result.concentration.totalOpenRisk > 8 ? RED : result.concentration.totalOpenRisk > 5 ? YELLOW : GREEN}
                theme={theme}
              />
            </Section>

            {/* Key Risks */}
            {result.verdict.keyRisks.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <SectionTitle title="Key Risks Identified" icon={AlertTriangle} theme={theme} />
                {result.verdict.keyRisks.map((risk, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, padding: '7px 0',
                    borderBottom: i < result.verdict.keyRisks.length - 1 ? `1px solid ${theme.border}` : 'none'
                  }}>
                    <div style={{ width: 5, borderRadius: 4, background: RED, flexShrink: 0, marginTop: 3 }} />
                    <span style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.5 }}>{risk}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {result.verdict.recommendations.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <SectionTitle title="Recommendations" icon={Zap} theme={theme} />
                {result.verdict.recommendations.map((rec, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, padding: '7px 0',
                    borderBottom: i < result.verdict.recommendations.length - 1 ? `1px solid ${theme.border}` : 'none'
                  }}>
                    <div style={{ width: 5, borderRadius: 4, background: GREEN, flexShrink: 0, marginTop: 3 }} />
                    <span style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.5 }}>{rec}</span>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────
function SectionTitle({ title, icon: Icon, theme }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <Icon size={13} color={theme.textMuted} />
      <span style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{title}</span>
    </div>
  );
}

function Section({ title, icon, children, theme }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <SectionTitle title={title} icon={icon} theme={theme} />
      <div style={{ background: theme.bgSection, borderRadius: 10, padding: '0 12px', border: `1px solid ${theme.border}` }}>
        {children}
      </div>
    </div>
  );
}

// ─── Date parser (inline, no import needed) ────────────────────────────────
function parseDate(s) {
  if (!s) return null;
  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(s));
  if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3]);
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(String(s));
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
