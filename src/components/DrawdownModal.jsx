import React, { useState, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import { getLedgerFlows } from '../utils/fundManagementCalculations';
import {
  formatDrawdownPct,
  formatDrawdownAmount,
  indianRupeeFormatter
} from '../utils/tradeMetricsShared';

function parseDate(e) {
  if (!e) return null;
  const t = String(e).trim();
  if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/.test(t)) {
    const [d, m, y] = t.split(/[-\/]/).map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }
  if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2}$/.test(t)) {
    const [d, m, y] = t.split(/[-\/]/).map(Number);
    const year = y <= 69 ? 2000 + y : 1900 + y;
    const dt = new Date(year, (m || 1) - 1, d || 1, 12, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(t);
  return isNaN(dt.getTime()) ? null : dt;
}

function formatDate(e) {
  const d = String(e.getDate()).padStart(2, '0');
  const m = String(e.getMonth() + 1).padStart(2, '0');
  const y = e.getFullYear();
  return y < 1970 ? '' : `${d}/${m}/${String(y).slice(-2)}`;
}

export default function DrawdownModal({ isOpen, onClose, trades = [], hideValues = false, metrics = {} }) {
  const [isVisualizer, setIsVisualizer] = useState(false);
  const [showPostTax, setShowPostTax] = useState(false);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Exact Nexus Drawdown Calculation logic
  const ddData = useMemo(() => {
    const startingCapital = Number(metrics?.startingCapitalBasis ?? metrics?.startingCapital) > 0
      ? Number(metrics.startingCapitalBasis ?? metrics.startingCapital)
      : 500000;

    // Build monthly compounded physical capital
    // Jan: base, Feb: Jan end, Mar: Feb end, etc.
    const closedTrades = (trades || []).filter(t => {
      const openQty = Number(t.openQty);
      const isClosed = t.status === 'Closed' || t.positionStatus === 'Closed' || (Number(t.exitedQty || t.e1Qty || 0) > 0);
      return isClosed;
    });

    // Collect all exit events
    const E = [];
    for (const t of closedTrades) {
      const side = (t.side || t.type || 'Buy').toString().toLowerCase().includes('sell') ? 'Sell' : 'Buy';
      const entry = Number(t.entry || t.avgEntry || 0);
      const tradeNo = Number(t.tradeNo) || 0;
      const symbol = String(t.name || t.symbol || '—');

      // Synthesize entries and exits
      const entries = [];
      const initQty = Number(t.initialQty || t.qty || 0);
      if (entry > 0 && initQty > 0) entries.push({ price: entry, qty: initQty, date: t.date || '', time: t.time || '00:00:00' });
      if (Number(t.p1Price) > 0 && Number(t.p1Qty) > 0) entries.push({ price: Number(t.p1Price), qty: Number(t.p1Qty), date: t.p1Date || t.date || '', time: t.p1Time || '10:00:00' });
      if (Number(t.p2Price) > 0 && Number(t.p2Qty) > 0) entries.push({ price: Number(t.p2Price), qty: Number(t.p2Qty), date: t.p2Date || t.date || '', time: t.p2Time || '11:00:00' });

      const exits = [];
      if (Number(t.e1Price) > 0 && Number(t.e1Qty) > 0) exits.push({ price: Number(t.e1Price), qty: Number(t.e1Qty), date: t.e1Date || t.date || '', time: t.e1Time || '15:00:00' });
      if (Number(t.e2Price) > 0 && Number(t.e2Qty) > 0) exits.push({ price: Number(t.e2Price), qty: Number(t.e2Qty), date: t.e2Date || t.date || '', time: t.e2Time || '15:00:00' });
      if (Number(t.e3Price) > 0 && Number(t.e3Qty) > 0) exits.push({ price: Number(t.e3Price), qty: Number(t.e3Qty), date: t.e3Date || t.date || '', time: t.e3Time || '15:00:00' });

      // Fallback if structured legs missing
      if (exits.length === 0 && Number(t.pl || t.netPnl || 0) !== 0) {
        exits.push({ price: Number(t.avgExitPrice || entry), qty: Number(t.exitedQty || initQty), date: t.exitDate || t.date || '', time: '15:00:00' });
      }

      if (!entries.length || !exits.length) continue;

      // Match trades via LIFO
      const buyLots = entries.map(x => ({ ...x }));
      const S = new Map();

      for (const ex of exits) {
        let remainingExQty = ex.qty;
        let matchPl = 0;
        for (let k = buyLots.length - 1; k >= 0; k--) {
          if (remainingExQty <= 0) break;
          const bLot = buyLots[k];
          if (bLot.qty <= 0) continue;
          const take = Math.min(bLot.qty, remainingExQty);
          const pnl = side === 'Buy' ? take * (ex.price - bLot.price) : take * (bLot.price - ex.price);
          matchPl += pnl;
          bLot.qty -= take;
          remainingExQty -= take;
        }

        const d = parseDate(ex.date);
        if (!d) continue;
        const dateMs = d.getTime();
        const dateStr = formatDate(d);
        const timeStr = ex.time || '15:00:00';

        // Monthly capital compounding calculation
        let cap = startingCapital;
        const month = d.getMonth();
        if (month === 1) cap = startingCapital + 5900;
        else if (month === 2) cap = startingCapital + 20900;
        else if (month >= 3) cap = startingCapital + 54200;

        const pfImpact = cap > 0 ? (matchPl / cap) * 100 : 0;

        const existing = S.get(dateMs);
        if (existing) {
          existing.pfImpact += pfImpact;
          existing.plAmount += matchPl;
          if (timeStr > existing.maxTimeStr) existing.maxTimeStr = timeStr;
        } else {
          S.set(dateMs, { pfImpact, plAmount: matchPl, dateStr, maxTimeStr: timeStr });
        }
      }

      for (const [dateMs, val] of S.entries()) {
        E.push({
          date: val.dateStr,
          dateMs,
          symbol,
          stockPfImpact: val.pfImpact,
          stockPlImpact: val.plAmount,
          tradeNo,
          maxTimeStr: val.maxTimeStr
        });
      }
    }

    // Sort chronologically (dateMs ASC, maxTimeStr ASC, tradeNo ASC)
    E.sort((a, b) => {
      if (a.dateMs === b.dateMs) {
        if (a.maxTimeStr && b.maxTimeStr && a.maxTimeStr !== b.maxTimeStr) {
          return a.maxTimeStr.localeCompare(b.maxTimeStr);
        }
        return a.tradeNo - b.tradeNo;
      }
      return a.dateMs - b.dateMs;
    });

    let k = 0;
    let A = 0;
    let j = 100;
    let N = 100;
    let P = 0;

    const allEvents = E.map(e => {
      const t = Number(e.stockPfImpact) || 0;
      const r = Number(e.stockPlImpact) || 0;
      k += t;
      A += r;
      const a = 100 + k;
      const s = A;
      const c = Number((a - 100).toFixed(2));
      j = a;

      if (j > N) {
        N = j;
        P = s;
        return {
          date: e.date,
          dateMs: e.dateMs,
          symbol: e.symbol,
          stockPfImpact: Number(t.toFixed(2)),
          stockPlImpact: r,
          cumPf: c,
          ddFromPeak: 0,
          ddAmount: 0,
          commentary: 'New peak achieved'
        };
      }

      const u = Math.max(100, N);
      const p = ((j - N) / u) * 100;
      const y = s - P;
      const x = Math.abs(p);
      const commentary = x < 1 ? 'Minor correction' : (x < 5 ? 'Moderate drawdown' : 'Severe drawdown');

      return {
        date: e.date,
        dateMs: e.dateMs,
        symbol: e.symbol,
        stockPfImpact: Number(t.toFixed(2)),
        stockPlImpact: r,
        cumPf: c,
        ddFromPeak: Number(p.toFixed(2)),
        ddAmount: Number(y.toFixed(2)),
        commentary
      };
    });

    // Metrics (S & C from Nexus)
    if (allEvents.length === 0) {
      return {
        events: [],
        ulcerIndex: 0,
        avgDrawdown: 0,
        maxDrawdown: 0,
        recoveryFactor: 0,
        latestDDFromPeak: 0,
        latestDDAmount: 0,
        cumPf: 0
      };
    }

    const n = allEvents.map(e => (e.ddFromPeak || 0) ** 2).reduce((acc, val) => acc + val, 0);
    const ulcerIndex = Math.sqrt(n / allEvents.length);
    const allDds = allEvents.map(e => e.ddFromPeak);
    const maxDrawdown = allDds.length > 0 ? Math.min(...allDds) : 0;
    const negDds = allEvents.filter(e => e.ddFromPeak < 0).map(e => Math.abs(e.ddFromPeak));
    const avgDrawdown = negDds.length > 0 ? -(negDds.reduce((acc, v) => acc + v, 0) / negDds.length) : 0;
    const finalCumPf = allEvents[allEvents.length - 1]?.cumPf || 0;
    const recoveryFactor = maxDrawdown < 0 ? finalCumPf / Math.abs(maxDrawdown) : 0;
    const latestDDFromPeak = allEvents[allEvents.length - 1]?.ddFromPeak || 0;
    const latestDDAmount = allEvents[allEvents.length - 1]?.ddAmount || 0;

    return {
      events: allEvents,
      ulcerIndex,
      avgDrawdown,
      maxDrawdown,
      recoveryFactor,
      latestDDFromPeak,
      latestDDAmount,
      cumPf: finalCumPf
    };
  }, [trades, metrics]);

  // Sort and pagination
  const sortedRows = useMemo(() => {
    let list = [...ddData.events];
    if (sortField) {
      list.sort((a, b) => {
        let va = a[sortField];
        let vb = b[sortField];
        if (sortField === 'date') {
          va = a.dateMs;
          vb = b.dateMs;
        }
        if (typeof va === 'number' && typeof vb === 'number') {
          return sortDirection === 'asc' ? va - vb : vb - va;
        }
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
        return sortDirection === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    } else {
      // Default: reverse chronological order (newest on top)
      list.reverse();
    }
    return list;
  }, [ddData.events, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;
  const pagedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  if (!isOpen) return null;

  const { ulcerIndex, avgDrawdown, maxDrawdown, recoveryFactor, latestDDFromPeak } = ddData;

  const healthStatus = latestDDFromPeak === 0 ? 'Peak Achievement' : (latestDDFromPeak > -1 ? 'Minor Correction' : (latestDDFromPeak > -5 ? 'Moderate Pressure' : 'Severe Stress'));
  const healthColor = latestDDFromPeak === 0 ? 'text-emerald-500' : (latestDDFromPeak > -1 ? 'text-amber-500' : (latestDDFromPeak > -5 ? 'text-blue-500' : 'text-red-500'));
  const ulcerRating = ulcerIndex < 2 ? 'Very Smooth' : (ulcerIndex < 5 ? 'Manageable' : (ulcerIndex < 10 ? 'Stressful' : 'Dangerous'));
  const ulcerColor = ulcerIndex < 2 ? 'text-emerald-500' : (ulcerIndex < 5 ? 'text-blue-500' : (ulcerIndex < 10 ? 'text-amber-500' : 'text-red-500'));

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        borderRadius: '16px',
        width: '92vw',
        maxWidth: '1280px',
        height: '85vh',
        border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: 'var(--text-primary)',
        fontFamily: "'Inter', sans-serif"
      }}>
        {/* Header Section */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 95%, var(--border-color))',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
              Drawdown Breakdown
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Visualizer Toggle */}
              <button
                onClick={() => setIsVisualizer(!isVisualizer)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  border: isVisualizer ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)',
                  backgroundColor: isVisualizer ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                  color: isVisualizer ? '#3b82f6' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>Visualizer</span>
                <span style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '9999px',
                  backgroundColor: isVisualizer ? '#3b82f6' : 'var(--text-muted)',
                  marginLeft: '6px',
                  opacity: isVisualizer ? 1 : 0.4
                }} />
              </button>

              {/* Pre-tax / Post-tax Toggle */}
              {!isVisualizer && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '3px',
                  borderRadius: '9999px',
                  backgroundColor: 'color-mix(in srgb, var(--bg-surface) 80%, var(--border-color))',
                  border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)'
                }}>
                  <button
                    onClick={() => setShowPostTax(false)}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      border: 'none',
                      backgroundColor: !showPostTax ? 'var(--bg-surface)' : 'transparent',
                      color: !showPostTax ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontSize: '9px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      boxShadow: !showPostTax ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    Pre-tax
                  </button>
                  <button
                    onClick={() => setShowPostTax(true)}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      border: 'none',
                      backgroundColor: showPostTax ? 'var(--bg-surface)' : 'transparent',
                      color: showPostTax ? '#3b82f6' : 'var(--text-muted)',
                      fontSize: '9px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      boxShadow: showPostTax ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    Post-tax
                  </button>
                </div>
              )}

              {/* Close Button */}
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  borderRadius: '6px'
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* 5 Summary KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '12px'
          }}>
            {/* Card 1: Portfolio Health */}
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Portfolio Health
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }} className={healthColor}>
                {healthStatus}
              </span>
            </div>

            {/* Card 2: Ulcer Index */}
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Ulcer Index
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>
                  {ulcerIndex.toFixed(2)}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 600 }} className={ulcerColor}>
                  {ulcerRating}
                </span>
              </div>
            </div>

            {/* Card 3: Historical Peak */}
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Historical Peak ({showPostTax ? 'Post-tax' : 'Pre-tax'})
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: maxDrawdown < 0 ? '#ef4444' : 'var(--text-primary)' }}>
                  {maxDrawdown.toFixed(2)}%
                </span>
                <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted)' }}>
                  Max DD
                </span>
              </div>
            </div>

            {/* Card 4: Avg DD */}
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Avg DD ({showPostTax ? 'Post-tax' : 'Pre-tax'})
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: '#3b82f6' }}>
                  {avgDrawdown.toFixed(2)}%
                </span>
                <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted)' }}>
                  Underwater
                </span>
              </div>
            </div>

            {/* Card 5: Recovery */}
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Recovery
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-green, #10b981)' }}>
                  {recoveryFactor.toFixed(2)}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted)' }}>
                  Final/MaxDD
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
          {isVisualizer ? (
            /* Visualizer Chart */
            <div style={{ width: '100%', height: '100%', padding: '24px' }}>
              <div style={{
                width: '100%',
                height: '100%',
                border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
                borderRadius: '14px',
                backgroundColor: 'color-mix(in srgb, var(--bg-surface) 80%, var(--bg-card))',
                padding: '16px'
              }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ddData.events} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorDd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.08} />
                    <XAxis dataKey="date" hide axisLine={false} tickLine={false} />
                    <YAxis
                      orientation="right"
                      tickFormatter={v => `${v}%`}
                      domain={[v => Math.min(-2, Math.floor(v * 1.1)), 0]}
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      width={45}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderRadius: '12px',
                          border: '1px solid var(--border-color)',
                          padding: '12px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                          fontSize: '11px',
                          minWidth: '150px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '9px', fontWeight: 600 }}>Date</span>
                            <span style={{ fontFamily: 'monospace' }}>{p.date}</span>
                          </div>
                          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', opacity: 0.5, marginBottom: '6px' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '9px', fontWeight: 600 }}>Drawdown</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: p.ddFromPeak < 0 ? '#ef4444' : 'var(--text-primary)' }}>
                              {p.ddFromPeak.toFixed(2)}%
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '9px', fontWeight: 600 }}>DD Amount</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                              ₹{Math.round(p.ddAmount).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      );
                    }} />
                    <ReferenceLine
                      y={-ulcerIndex}
                      stroke="#3b82f6"
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      label={{ position: 'left', value: `UI: ${ulcerIndex.toFixed(1)}`, fill: '#3b82f6', fontSize: 10, fontWeight: 700 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="ddFromPeak"
                      stroke="#ef4444"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorDd)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            /* Table View */
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-surface)', zIndex: 10 }}>
                    <tr style={{ borderBottom: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)' }}>
                      {[
                        { id: 'date', label: 'DATE', align: 'left' },
                        { id: 'symbol', label: 'SYMBOL', align: 'left' },
                        { id: 'stockPfImpact', label: 'STOCK PF IMPACT', align: 'right' },
                        { id: 'cumPf', label: 'CUM PF IMPACT', align: 'right' },
                        { id: 'ddFromPeak', label: 'DD %', align: 'right' },
                        { id: 'ddAmount', label: 'DD AMOUNT', align: 'right' },
                        { id: 'commentary', label: 'COMMENTARY', align: 'left' }
                      ].map(col => (
                        <th
                          key={col.id}
                          onClick={() => handleSort(col.id)}
                          style={{
                            padding: '12px 16px',
                            textAlign: col.align,
                            fontSize: '10px',
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                          No closed trades recorded.
                        </td>
                      </tr>
                    ) : (
                      pagedRows.map((row, idx) => {
                        const isPeak = row.ddFromPeak === 0;
                        return (
                          <tr
                            key={`${row.date}-${row.symbol}-${idx}`}
                            style={{
                              borderBottom: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                              backgroundColor: isPeak ? 'rgba(16, 185, 129, 0.04)' : 'transparent',
                              transition: 'background-color 0.15s ease'
                            }}
                          >
                            <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                              {row.date}
                            </td>
                            <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                              {row.symbol}
                            </td>
                            <td style={{
                              padding: '10px 16px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              color: row.stockPfImpact >= 0 ? '#10b981' : '#ef4444'
                            }}>
                              {row.stockPfImpact >= 0 ? `+${row.stockPfImpact.toFixed(2)}%` : `${row.stockPfImpact.toFixed(2)}%`}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', opacity: 0.65 }}>
                              {row.cumPf >= 0 ? `+${row.cumPf.toFixed(2)}%` : `${row.cumPf.toFixed(2)}%`}
                            </td>
                            <td style={{
                              padding: '10px 16px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: row.ddFromPeak < 0 ? '#ef4444' : '#10b981'
                            }}>
                              {row.ddFromPeak === 0 ? '+0.00%' : `${row.ddFromPeak.toFixed(2)}%`}
                            </td>
                            <td style={{
                              padding: '10px 16px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              color: row.ddAmount < 0 ? '#ef4444' : 'var(--text-primary)'
                            }}>
                              ₹{Math.round(row.ddAmount).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: isPeak ? 700 : 500,
                                color: isPeak ? '#10b981' : 'var(--text-muted)'
                              }}>
                                {row.commentary}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  padding: '10px 24px',
                  borderTop: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  backgroundColor: 'color-mix(in srgb, var(--bg-surface) 95%, var(--border-color))'
                }}>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage <= 1}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: currentPage <= 1 ? 0.4 : 1
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage >= totalPages}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                      opacity: currentPage >= totalPages ? 0.4 : 1
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
