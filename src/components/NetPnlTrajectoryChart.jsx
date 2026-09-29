import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Layers, Calendar, Hash, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import BrokerLogo from './BrokerLogo';
import SymbolLogo from './SymbolLogo';
import { PnLChart, TradeDistribution } from './charts';

export default function NetPnlTrajectoryChart({
  trades = [],
  hideValues = false,
  brokerFilter = 'all',
  capital = 212880.89
}) {
  const [viewMode, setViewMode] = useState('dual'); // 'dual' | 'cumulative' | 'perTrade'
  const [xAxisMode, setXAxisMode] = useState('seq'); // 'seq' (Trade #) | 'date' (Exit Date)
  const [linesMode, setLinesMode] = useState('both'); // 'both' | 'net' | 'gross'

  // Format currency helpers
  const fmt = (num) =>
    Number(num || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const sign = (num) => (num > 0 ? '+' : num < 0 ? '-' : '');

  // ── Prepare and Sort Closed Trades Chronologically ─────────────────────────
  const chartData = useMemo(() => {
    // 1. Filter only closed trades
    let list = (trades || []).filter((t) => t.status === 'Closed');

    // 2. Sort chronologically by date/exit date
    list.sort((a, b) => {
      const parseDate = (dStr) => {
        if (!dStr) return new Date(0);
        const parts = String(dStr).split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) return new Date(parts[0], parts[1] - 1, parts[2]);
          return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        return new Date(dStr);
      };
      const dateA = parseDate(a.e1Date || a.exitDate || a.date);
      const dateB = parseDate(b.e1Date || b.exitDate || b.date);
      return dateA - dateB;
    });

    let runningGross = 0;
    let runningCharges = 0;
    let runningNet = 0;

    const points = list.map((t, idx) => {
      const gross = Number(t.grossPnl ?? t.pl ?? t.pnl ?? 0);
      const chg = Number(t.charges?.total ?? 0);
      const net = Number(t.netPnl ?? (gross - chg));

      runningGross += gross;
      runningCharges += chg;
      runningNet += net;

      const rawDate = t.e1Date || t.exitDate || t.date || `T${idx + 1}`;
      let shortDate = rawDate;
      const parts = String(rawDate).split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          shortDate = `${parts[2]}/${parts[1]}`;
        } else {
          shortDate = `${parts[0]}/${parts[1]}`;
        }
      }

      const dragPct = runningGross !== 0 ? (runningCharges / Math.abs(runningGross)) * 100 : 0;

      return {
        id: t.id || idx,
        seq: idx + 1,
        ticker: t.name || t.symbol || 'Trade',
        broker: t.broker || 'not_defined',
        date: rawDate,
        shortDate,
        xLabel: xAxisMode === 'seq' ? `#${idx + 1} ${t.name || ''}` : shortDate,
        grossPnl: gross,
        charges: chg,
        netPnl: net,
        cumGross: Math.round(runningGross * 100) / 100,
        cumCharges: Math.round(runningCharges * 100) / 100,
        cumNet: Math.round(runningNet * 100) / 100,
        dragPct: Math.round(dragPct * 10) / 10,
        chargesBreakdown: t.charges || {}
      };
    });

    return points;
  }, [trades, xAxisMode]);

  // ── Aggregate Summary for Header Badges ─────────────────────────────────────
  const aggregateSummary = useMemo(() => {
    let gross = 0;
    let charges = 0;
    let net = 0;
    let wins = 0;
    let losses = 0;
    let totalWinPnl = 0;
    let totalLossPnl = 0;

    chartData.forEach((d) => {
      gross += d.grossPnl;
      charges += d.charges;
      net += d.netPnl;
      if (d.netPnl > 0) {
        wins++;
        totalWinPnl += d.netPnl;
      } else if (d.netPnl < 0) {
        losses++;
        totalLossPnl += Math.abs(d.netPnl);
      }
    });

    const totalTrades = chartData.length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const dragPct = gross !== 0 ? (charges / Math.abs(gross)) * 100 : 0;
    const pfImpact = capital > 0 ? (net / capital) * 100 : 0;
    const avgWin = wins > 0 ? totalWinPnl / wins : 0;
    const avgLoss = losses > 0 ? totalLossPnl / losses : 0;
    const profitFactor = totalLossPnl > 0 ? (totalWinPnl / totalLossPnl).toFixed(2) : totalWinPnl > 0 ? '∞' : '0.00';

    return {
      totalGross: gross,
      totalCharges: charges,
      totalNet: net,
      dragPct: Math.round(dragPct * 10) / 10,
      winRate: Math.round(winRate * 10) / 10,
      winCount: wins,
      lossCount: losses,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      profitFactor,
      totalTrades,
      pfImpact: Math.round(pfImpact * 100) / 100
    };
  }, [chartData, capital]);

  // ── Interactive Tooltip ────────────────────────────────────────────────────
  const CustomChartTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    const isNetPositive = data.netPnl >= 0;
    const isCumNetPositive = data.cumNet >= 0;

    return (
      <div
        style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '12px 14px',
          boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.2)',
          minWidth: '220px',
          color: 'var(--text-primary, #111827)',
          fontSize: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <SymbolLogo symbol={data.ticker} size={20} />
            <span style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-primary, #111827)' }}>{data.ticker}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary, #64748b)', backgroundColor: 'var(--bg-surface, #f1f5f9)', padding: '1px 5px', borderRadius: '4px' }}>#{data.seq}</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>{data.date}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px dashed var(--border-color, #e2e8f0)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary, #64748b)' }}>Trade Net P&L:</span>
            <span style={{ fontWeight: 700, color: isNetPositive ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
              {hideValues ? '••••••' : `${sign(data.netPnl)}₹${fmt(Math.abs(data.netPnl))}`}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary, #64748b)' }}>Gross P&L:</span>
            <span style={{ fontWeight: 500, color: data.grossPnl >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
              {hideValues ? '••••••' : `${sign(data.grossPnl)}₹${fmt(Math.abs(data.grossPnl))}`}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary, #64748b)' }}>Charges:</span>
            <span style={{ fontWeight: 500, color: '#ef4444', fontFamily: 'monospace' }}>
              {hideValues ? '••••••' : `-₹${fmt(data.charges)}`}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary, #64748b)' }}>Cum. Net P&L:</span>
            <span style={{ fontWeight: 700, color: isCumNetPositive ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
              {hideValues ? '••••••' : `${sign(data.cumNet)}₹${fmt(Math.abs(data.cumNet))}`}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary, #64748b)' }}>Total Fee Drag:</span>
            <span style={{ fontWeight: 500, color: '#ef4444', fontFamily: 'monospace' }}>
              {hideValues ? '••••••' : `-₹${fmt(data.cumCharges)} (${data.dragPct}%)`}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // ── Empty State ────────────────────────────────────────────────────────────
  if (!chartData || chartData.length === 0) {
    return (
      <div
        style={{
          marginTop: '20px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '16px',
          border: '1px solid var(--border-color, #f1f5f9)',
          padding: '40px 24px',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-surface, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto',
            color: 'var(--text-muted, #94a3b8)'
          }}
        >
          <Layers size={20} />
        </div>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #111827)', margin: '0 0 4px 0' }}>
          No Closed Trades To Chart
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', margin: 0 }}>
          Close positions in your journal to visualize your performance trajectory and trade distribution.
        </p>
      </div>
    );
  }

  const isNetTotalProfit = aggregateSummary.totalNet >= 0;
  const chartHeight = viewMode === 'dual' ? 320 : 360;

  return (
    <div
      style={{
        marginTop: '24px',
        width: '100%',
        maxWidth: viewMode === 'dual' ? '1240px' : '920px',
        marginInline: 'auto',
        padding: '0 12px',
        boxSizing: 'border-box',
        transition: 'max-width 0.25s ease'
      }}
    >
      {/* ── TOP CONTROLS BAR: Subtle & Minimal ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          padding: '0 2px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-muted, #64748b)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Analytics
          </span>
          {brokerFilter !== 'all' && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--text-secondary, #475569)',
                backgroundColor: 'var(--bg-card, #ffffff)',
                border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
                padding: '2px 8px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <BrokerLogo broker={brokerFilter} size={12} />
              {brokerFilter.toUpperCase()}
            </span>
          )}
        </div>

        {/* View Mode Switcher: Dual / Cumulative / Per-Trade */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface, rgba(0,0,0,0.03))',
            border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 60%, transparent)',
            borderRadius: '9999px',
            padding: '2px',
            gap: '2px'
          }}
        >
          {[
            { id: 'dual', label: 'Dual View' },
            { id: 'cumulative', label: 'Cumulative' },
            { id: 'perTrade', label: 'Per-Trade' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              style={{
                border: 'none',
                padding: '4px 12px',
                borderRadius: '9999px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: viewMode === tab.id ? 600 : 500,
                backgroundColor: viewMode === tab.id ? 'var(--bg-card, #ffffff)' : 'transparent',
                color: viewMode === tab.id ? 'var(--text-primary, #0f172a)' : 'var(--text-muted, #64748b)',
                boxShadow: viewMode === tab.id ? 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SIDE BY SIDE / CENTERED CHARTS GRID ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: viewMode === 'dual' ? 'repeat(auto-fit, minmax(460px, 1fr))' : '1fr',
          gap: '16px',
          alignItems: 'stretch'
        }}
      >
        {/* ── CARD 1: CUMULATIVE GROSS VS NET P&L ── */}
        {(viewMode === 'dual' || viewMode === 'cumulative') && (
          <div
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
              borderRadius: '16px',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0, 0, 0, 0.02))'
            }}
          >
            {/* Header: Title & Badges */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: '28px',
                marginBottom: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                  Cumulative Gross vs Net P&L
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    color: isNetTotalProfit ? '#059669' : '#dc2626',
                    backgroundColor: isNetTotalProfit ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    border: `1px solid ${isNetTotalProfit ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                    padding: '2px 7px',
                    borderRadius: '6px'
                  }}
                >
                  {sign(aggregateSummary.totalNet)}₹{fmt(Math.abs(aggregateSummary.totalNet))}
                </span>
              </div>

              {/* Lines Mode Toggle: Both / Net / Gross */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--bg-surface, rgba(0,0,0,0.03))',
                  borderRadius: '9999px',
                  padding: '2px',
                  gap: '2px',
                  border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 50%, transparent)'
                }}
              >
                {[
                  { id: 'both', label: 'Both' },
                  { id: 'net', label: 'Net' },
                  { id: 'gross', label: 'Gross' }
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => setLinesMode(btn.id)}
                    style={{
                      border: 'none',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      cursor: 'pointer',
                      fontSize: '10.5px',
                      fontWeight: linesMode === btn.id ? 600 : 500,
                      backgroundColor: linesMode === btn.id ? 'var(--bg-card, #ffffff)' : 'transparent',
                      color: linesMode === btn.id ? 'var(--text-primary, #0f172a)' : 'var(--text-muted, #94a3b8)',
                      boxShadow: linesMode === btn.id ? 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.04))' : 'none'
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Header: Legend & X-Axis Switcher */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '8px',
                borderBottom: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 35%, transparent)',
                marginBottom: '8px',
                minHeight: '22px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', opacity: 0.85 }} />
                  <span>Gross</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isNetTotalProfit ? '#10b981' : '#ef4444', opacity: 0.85 }} />
                  <span>Net</span>
                </div>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted, #94a3b8)' }}>
                  Fee Drag: <strong style={{ color: '#ef4444', fontWeight: 500 }}>-₹{fmt(aggregateSummary.totalCharges)}</strong>
                </span>
              </div>

              {/* X-Axis Scale Toggle: Seq (#) / Date */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => setXAxisMode('seq')}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: xAxisMode === 'seq' ? 600 : 400,
                    color: xAxisMode === 'seq' ? 'var(--text-primary, #0f172a)' : 'var(--text-muted, #94a3b8)',
                    padding: '1px 4px'
                  }}
                >
                  # Trade
                </button>
                <span style={{ color: 'color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)', fontSize: '11px' }}>|</span>
                <button
                  onClick={() => setXAxisMode('date')}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: xAxisMode === 'date' ? 600 : 400,
                    color: xAxisMode === 'date' ? 'var(--text-primary, #0f172a)' : 'var(--text-muted, #94a3b8)',
                    padding: '1px 4px'
                  }}
                >
                  Date
                </button>
              </div>
            </div>

            {/* PnL Line Chart */}
            <div style={{ flex: 1, minHeight: `${chartHeight}px` }}>
              <PnLChart
                data={chartData}
                linesMode={linesMode}
                height={chartHeight}
                hideValues={hideValues}
                customTooltip={<CustomChartTooltip />}
              />
            </div>
          </div>
        )}

        {/* ── CARD 2: INDIVIDUAL TRADE NET P&L (BAR CHART) ── */}
        {(viewMode === 'dual' || viewMode === 'perTrade') && (
          <div
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
              borderRadius: '16px',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0, 0, 0, 0.02))'
            }}
          >
            {/* Header: Title & Badges */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: '28px',
                marginBottom: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                  Individual Trade Net P&L
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#059669',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    padding: '2px 7px',
                    borderRadius: '6px'
                  }}
                >
                  {aggregateSummary.winRate}% Win Rate
                </span>
              </div>

              {/* Profit Factor & Payoff */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                <span>PF: <strong style={{ color: 'var(--text-primary, #0f172a)', fontWeight: 600 }}>{aggregateSummary.profitFactor}</strong></span>
              </div>
            </div>

            {/* Sub-Header: Legend & Trades Count */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '8px',
                borderBottom: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 35%, transparent)',
                marginBottom: '8px',
                minHeight: '22px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '2px', backgroundColor: '#10b981', opacity: 0.85 }} />
                  <span>Win ({aggregateSummary.winCount})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '2px', backgroundColor: '#ef4444', opacity: 0.85 }} />
                  <span>Loss ({aggregateSummary.lossCount})</span>
                </div>
              </div>

              <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
                {chartData.length} trades
              </span>
            </div>

            {/* Redesigned Recharts Bar Chart */}
            <div style={{ flex: 1, minHeight: `${chartHeight}px` }}>
              <TradeDistribution
                data={chartData}
                height={chartHeight}
                hideValues={hideValues}
                customTooltip={<CustomChartTooltip />}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
