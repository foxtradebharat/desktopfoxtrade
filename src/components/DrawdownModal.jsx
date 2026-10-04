import React, { useState, useMemo } from 'react';
import { X, LineChart, Table } from 'lucide-react';
import DrawdownChart from './charts/DrawdownChart';
import { Button } from '@/components/ui/button';
import { formatFullIndianRupee } from '../utils/indianCurrencyFormatter';
import { computeDrawdown } from '../utils/drawdown';
import { getTradePnl, isClosedTrade, isPartialTrade, sortTradesByEffectiveExitDate } from '../utils/tradeMetricsShared';

export default function DrawdownModal({ isOpen, onClose, trades = [], hideValues = false, metrics = {} }) {
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'visualizer'

  // Dynamic Drawdown calculations matching journal sequence & formulas
  const ddData = useMemo(() => {
    // Tracks equity curve and portfolio impact strictly in effective exit date sequence (D5)
    const closed = sortTradesByEffectiveExitDate(
      (trades || []).filter(t => isClosedTrade(t) || (isPartialTrade(t) && getTradePnl(t) !== 0))
    );

    const startingCapital = Number(metrics?.startingCapitalBasis ?? metrics?.startingCapital) > 0
      ? Number(metrics.startingCapitalBasis ?? metrics.startingCapital)
      : null;

    const pnls = closed.map(getTradePnl);
    const ddResult = computeDrawdown(pnls, startingCapital);

    if (closed.length === 0 || !ddResult.available) {
      return {
        available: ddResult.available,
        rows: closed.map((t, idx) => ({
          tradeNo: t.tradeNo || idx + 1,
          date: t.date || t.e1Date || `T#${idx + 1}`,
          symbol: t.name || t.symbol || '—',
          stockPfImpact: null,
          cummPfImpact: null,
          ddPct: null,
          drawdownPct: null,
          ddAmount: null,
          amount: null,
          equity: null,
          peak: null,
          pnl: getTradePnl(t),
          runningNet: null,
          peakNet: null,
          commentary: 'Set starting capital'
        })),
        chartData: [],
        currentDD: null,
        currentDDAmount: null,
        maxDD: null,
        maxDDAmount: null,
        ulcerIndex: null,
        ulcerLabel: 'Unavailable',
        historicalPeakPct: null,
        historicalPeakAmount: null,
        portfolioHealth: 'Unavailable',
        healthSub: 'Set starting capital',
        healthColor: 'var(--text-muted)'
      };
    }

    let cummPfImpact = 0;
    let peakCummPfImpact = 0;
    let sumSqDd = 0;

    const rows = closed.map((t, idx) => {
      const net = getTradePnl(t);
      const step = ddResult.series[idx];

      const pfImpact = t.pfImpact !== undefined && t.pfImpact !== null
        ? Number(t.pfImpact)
        : Number(((net / startingCapital) * 100).toFixed(2));

      // Cumulative portfolio impact is either stored directly or accumulated
      if (t.cummPf !== undefined && t.cummPf !== null && t.cummPf !== 0) {
        cummPfImpact = Number(t.cummPf);
      } else {
        cummPfImpact = Number((cummPfImpact + pfImpact).toFixed(2));
      }

      if (cummPfImpact > peakCummPfImpact) peakCummPfImpact = cummPfImpact;

      const ddPct = step ? step.pct : 0;
      const ddAmount = step ? step.amt : 0;

      sumSqDd += Math.pow(Math.abs(ddPct), 2);

      let commentary = 'Peak Equity';
      if (ddPct < 0) {
        if (Math.abs(ddPct) >= 10) commentary = 'Major Drawdown';
        else if (Math.abs(ddPct) >= 4) commentary = 'Moderate Pullback';
        else commentary = 'Minor Dip';
      }

      return {
        tradeNo: t.tradeNo || idx + 1,
        date: t.date || t.e1Date || `T#${idx + 1}`,
        symbol: t.name || t.symbol || '—',
        stockPfImpact: pfImpact,
        cummPfImpact,
        ddPct: Math.min(0, Math.round(ddPct * 100) / 100),
        drawdownPct: Math.min(0, Math.round(ddPct * 100) / 100),
        ddAmount,
        amount: ddAmount,
        equity: step.equity,
        peak: step.peak,
        pnl: net,
        runningNet: step.equity - startingCapital,
        peakNet: step.peak - startingCapital,
        commentary
      };
    });

    const currentDD = ddResult.currentPct;
    const currentDDAmount = Math.abs(ddResult.currentAmount);

    const ulcerIndex = Math.sqrt(sumSqDd / Math.max(1, rows.length));
    let ulcerLabel = 'Smooth';
    if (ulcerIndex >= 5) ulcerLabel = 'Stress';
    else if (ulcerIndex >= 2) ulcerLabel = 'Moderate';

    let portfolioHealth = 'Peak Achievement';
    let healthSub = 'All-time high equity';
    let healthColor = 'var(--color-green, #10b981)';

    if (currentDD < 0) {
      if (Math.abs(currentDD) >= 10) {
        portfolioHealth = 'High Stress Drawdown';
        healthColor = '#ef4444';
      } else if (Math.abs(currentDD) >= 3) {
        portfolioHealth = 'Drawdown Phase';
        healthColor = '#f59e0b';
      } else {
        portfolioHealth = 'Mild Pullback';
        healthColor = '#f59e0b';
      }
      healthSub = `${currentDD.toFixed(2)}% from peak`;
    }

    const peakPfDisplay = peakCummPfImpact > 0
      ? peakCummPfImpact
      : (metrics?.grossPFImpact ? Number(metrics.grossPFImpact) : 0);

    return {
      available: true,
      rows,
      chartData: rows,
      currentDD,
      currentDDAmount,
      maxDD: ddResult.maxPct,
      maxDDAmount: Math.abs(ddResult.maxAmount),
      ulcerIndex,
      ulcerLabel,
      historicalPeakPct: peakPfDisplay,
      historicalPeakAmount: ddResult.peakEquity,
      portfolioHealth,
      healthSub,
      healthColor
    };
  }, [trades, metrics]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '880px',
        border: '1px solid color-mix(in srgb, var(--border-color) 45%, transparent)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
        padding: '28px',
        color: 'var(--text-primary)',
        fontFamily: "'Inter', sans-serif"
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          borderBottom: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
          paddingBottom: '18px'
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Drawdown Breakdown
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Visualizer Toggle Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'table' ? 'visualizer' : 'table')}
              className="gap-1.5 h-8 text-xs font-medium border-border/40 text-foreground hover:bg-muted/50 rounded-lg transition-colors"
            >
              {viewMode === 'table' ? <LineChart size={14} /> : <Table size={14} />}
              <span>Visualizer</span>
            </Button>

            {/* Close button */}
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
                borderRadius: '6px',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '28px'
        }}>
          {[
            {
              label: 'Portfolio Health',
              val: ddData.portfolioHealth,
              sub: ddData.healthSub,
              valColor: ddData.healthColor
            },
            {
              label: 'Ulcer Index',
              val: hideValues ? '•••' : (ddData.ulcerIndex !== null ? ddData.ulcerIndex.toFixed(2) : '—'),
              sub: hideValues ? '••••' : (ddData.maxDD !== null ? `Max ${Math.abs(ddData.maxDD).toFixed(2)}% | ${ddData.ulcerLabel}` : 'Set starting capital')
            },
            {
              label: 'Historical Peak (Pre-Tax)',
              val: hideValues ? '•••' : (ddData.historicalPeakPct !== null ? `${ddData.historicalPeakPct > 0 ? '+' : ''}${ddData.historicalPeakPct.toFixed(2)}%` : '—'),
              sub: hideValues ? '••••' : (ddData.historicalPeakAmount !== null ? `Peak ${formatFullIndianRupee(ddData.historicalPeakAmount)}` : 'Set starting capital')
            },
            {
              label: 'Current Drawdown',
              val: hideValues ? '•••' : (ddData.currentDD !== null ? `${ddData.currentDD.toFixed(2)}%` : '—'),
              sub: hideValues ? '••••' : (ddData.currentDD !== null ? (ddData.currentDD === 0 ? '0.00% from peak' : `${formatFullIndianRupee(ddData.currentDDAmount)} from peak`) : 'Set starting capital'),
              valColor: ddData.currentDD === 0 ? 'var(--color-green, #10b981)' : (ddData.currentDD === null ? 'var(--text-muted)' : '#ef4444')
            },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: 'color-mix(in srgb, var(--bg-surface) 70%, var(--bg-primary))',
                borderRadius: '12px',
                border: '1px solid color-mix(in srgb, var(--border-color) 45%, transparent)',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '88px'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.02em', lineHeight: 1.5 }}>
                {item.label}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: item.valColor || 'var(--text-primary)', marginTop: '4px', lineHeight: 1.3 }}>
                {item.val}
              </div>
              {item.sub && (
                <div style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
                  {item.sub}
                </div>
              )}
            </div>
          ))}
        </div>

        {!ddData.available && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            borderRadius: '8px',
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            color: '#eab308',
            fontSize: '12px'
          }}>
            <span>Set your starting capital (portfolio base capital or a ledger deposit) to see drawdown analysis.</span>
          </div>
        )}

        {/* Main View: Table vs Visualizer Chart */}
        {viewMode === 'table' ? (
          <div style={{
            overflowX: 'auto',
            maxHeight: '380px',
            overflowY: 'auto',
            border: '1px solid color-mix(in srgb, var(--border-color) 45%, transparent)',
            borderRadius: '12px'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 45%, transparent)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  position: 'sticky',
                  top: 0,
                  backgroundColor: 'var(--bg-surface)',
                  zIndex: 2
                }}>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Symbol</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>Stock PF Impact</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>Cum PF Impact</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>DD %</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>DD Amount</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500 }}>Commentary</th>
                </tr>
              </thead>
              <tbody>
                {ddData.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontWeight: 400 }}>
                      No closed trade records found for drawdown analysis.
                    </td>
                  </tr>
                ) : (
                  ddData.rows.map((row, idx) => {
                    const isAtPeak = row.ddPct === 0;
                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                          transition: 'background-color 0.12s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <td style={{ padding: '13px 16px', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 400 }}>
                          {row.date}
                        </td>
                        <td style={{ padding: '13px 16px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {row.symbol}
                        </td>
                        <td style={{
                          padding: '13px 16px',
                          textAlign: 'right',
                          fontWeight: 450,
                          color: row.stockPfImpact === null ? 'var(--text-muted)' : (row.stockPfImpact >= 0 ? 'var(--color-green, #10b981)' : '#ef4444')
                        }}>
                          {hideValues ? '•••' : (row.stockPfImpact !== null ? `${row.stockPfImpact >= 0 ? '+' : ''}${row.stockPfImpact.toFixed(2)}%` : '—')}
                        </td>
                        <td style={{
                          padding: '13px 16px',
                          textAlign: 'right',
                          fontWeight: 450,
                          color: row.cummPfImpact === null ? 'var(--text-muted)' : (row.cummPfImpact >= 0 ? 'var(--color-green, #10b981)' : '#ef4444')
                        }}>
                          {hideValues ? '•••' : (row.cummPfImpact !== null ? `${row.cummPfImpact >= 0 ? '+' : ''}${row.cummPfImpact.toFixed(2)}%` : '—')}
                        </td>
                        <td style={{
                          padding: '13px 16px',
                          textAlign: 'right',
                          fontWeight: 500,
                          color: row.ddPct === null ? 'var(--text-muted)' : (isAtPeak ? 'var(--color-green, #10b981)' : '#ef4444')
                        }}>
                          {hideValues ? '•••' : (row.ddPct !== null ? `${row.ddPct.toFixed(2)}%` : '—')}
                        </td>
                        <td style={{
                          padding: '13px 16px',
                          textAlign: 'right',
                          color: row.ddAmount === null ? 'var(--text-muted)' : (isAtPeak ? 'var(--text-muted)' : '#ef4444'),
                          fontWeight: 400
                        }}>
                          {hideValues ? '••••' : (row.ddAmount === null ? '—' : (isAtPeak ? '₹0.00' : formatFullIndianRupee(row.ddAmount)))}
                        </td>
                        <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 500,
                            backgroundColor: isAtPeak ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                            color: isAtPeak ? 'var(--color-green, #10b981)' : '#ef4444'
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
        ) : (
          <div style={{
            padding: '18px 20px',
            backgroundColor: 'color-mix(in srgb, var(--bg-surface) 70%, var(--bg-primary))',
            borderRadius: '12px',
            border: '1px solid color-mix(in srgb, var(--border-color) 45%, transparent)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                Underwater Drawdown Curve (% from Peak)
              </span>
              <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>
                Peak-to-trough equity declines
              </span>
            </div>
            <DrawdownChart data={ddData.chartData} maxDrawdown={ddData.maxDD} hideValues={hideValues} height={240} />
          </div>
        )}
      </div>
    </div>
  );
}
