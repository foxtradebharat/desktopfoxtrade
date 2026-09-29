import React, { useState, useMemo } from 'react';
import { X, LineChart, Table } from 'lucide-react';
import DrawdownChart from './charts/DrawdownChart';
import { Button } from '@/components/ui/button';
import { formatFullIndianRupee } from '../utils/indianCurrencyFormatter';

export default function DrawdownModal({ isOpen, onClose, trades = [], hideValues = false, metrics = {} }) {
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'visualizer'

  // Dynamic Drawdown calculations matching 100% exact Nexus Journal sequence & formulas
  const ddData = useMemo(() => {
    // Nexus tracks equity curve and portfolio impact strictly in Journal sequence (tradeNo)
    const closed = (trades || [])
      .filter(t => t.status === 'Closed' || (t.status === 'Partial' && (parseFloat(t.pnl) || parseFloat(t.pl) || 0) !== 0))
      .sort((a, b) => (Number(a.tradeNo) || 0) - (Number(b.tradeNo) || 0));

    if (closed.length === 0) {
      return {
        rows: [],
        chartData: [],
        currentDD: 0,
        currentDDAmount: 0,
        maxDD: 0,
        maxDDAmount: 0,
        ulcerIndex: 0,
        ulcerLabel: 'Smooth',
        historicalPeakPct: 0,
        historicalPeakAmount: 0,
        portfolioHealth: 'Peak Achievement',
        healthSub: 'All-time high equity',
        healthColor: 'var(--color-green, #10b981)'
      };
    }

    let runningNet = 0;
    let peakNet = 0;
    let cummPfImpact = 0;
    let peakCummPfImpact = 0;
    let maxDdPct = 0;
    let maxDdAmount = 0;
    let sumSqDd = 0;

    const rows = closed.map((t, idx) => {
      const net = Number(t.pnl ?? t.pl ?? t.netPnl ?? 0);
      const pfImpact = t.pfImpact !== undefined && t.pfImpact !== null
        ? Number(t.pfImpact)
        : Number(((net / 200000) * 100).toFixed(2));

      runningNet += net;

      // In Nexus, cumulative portfolio impact is either stored directly or accumulated
      if (t.cummPf !== undefined && t.cummPf !== null && t.cummPf !== 0) {
        cummPfImpact = Number(t.cummPf);
      } else {
        cummPfImpact = Number((cummPfImpact + pfImpact).toFixed(2));
      }

      if (runningNet > peakNet) peakNet = runningNet;
      if (cummPfImpact > peakCummPfImpact) peakCummPfImpact = cummPfImpact;

      const ddAmount = runningNet < peakNet ? runningNet - peakNet : 0;
      const cap = Number(metrics?.portfolioCapital) || 200000;
      const ddPct = peakNet > 0
        ? (ddAmount / peakNet) * 100
        : (runningNet < 0 ? (runningNet / cap) * 100 : 0);

      if (ddPct < maxDdPct) maxDdPct = ddPct;
      if (ddAmount < maxDdAmount) maxDdAmount = ddAmount;

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
        cummPfImpact: cummPfImpact,
        ddPct: Math.min(0, Math.round(ddPct * 100) / 100),
        drawdownPct: Math.min(0, Math.round(ddPct * 100) / 100),
        ddAmount: ddAmount,
        amount: ddAmount,
        equity: runningNet,
        peak: peakNet,
        pnl: net,
        runningNet,
        peakNet,
        commentary
      };
    });

    const lastRow = rows[rows.length - 1];
    const currentDD = lastRow ? lastRow.ddPct : 0;
    const currentDDAmount = lastRow ? lastRow.ddAmount : 0;

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
      rows,
      chartData: rows,
      currentDD,
      currentDDAmount,
      maxDD: maxDdPct,
      maxDDAmount: maxDdAmount,
      ulcerIndex,
      ulcerLabel,
      historicalPeakPct: peakPfDisplay,
      historicalPeakAmount: peakNet,
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
              val: hideValues ? '•••' : ddData.ulcerIndex.toFixed(2),
              sub: hideValues ? '••••' : `Max ${Math.abs(ddData.maxDD).toFixed(2)}% | ${ddData.ulcerLabel}`
            },
            {
              label: 'Historical Peak (Pre-Tax)',
              val: hideValues ? '•••' : `${ddData.historicalPeakPct > 0 ? '+' : ''}${ddData.historicalPeakPct.toFixed(2)}%`,
              sub: hideValues ? '••••' : `Peak ${formatFullIndianRupee(ddData.historicalPeakAmount)}`
            },
            {
              label: 'Current Drawdown',
              val: hideValues ? '•••' : `${ddData.currentDD.toFixed(2)}%`,
              sub: hideValues ? '••••' : (ddData.currentDD === 0 ? '0.00% from peak' : `${formatFullIndianRupee(ddData.currentDDAmount)} from peak`),
              valColor: ddData.currentDD === 0 ? 'var(--color-green, #10b981)' : '#ef4444'
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
                          color: row.stockPfImpact >= 0 ? 'var(--color-green, #10b981)' : '#ef4444'
                        }}>
                          {hideValues ? '•••' : `${row.stockPfImpact >= 0 ? '+' : ''}${row.stockPfImpact.toFixed(2)}%`}
                        </td>
                        <td style={{
                          padding: '13px 16px',
                          textAlign: 'right',
                          fontWeight: 450,
                          color: row.cummPfImpact >= 0 ? 'var(--color-green, #10b981)' : '#ef4444'
                        }}>
                          {hideValues ? '•••' : `${row.cummPfImpact >= 0 ? '+' : ''}${row.cummPfImpact.toFixed(2)}%`}
                        </td>
                        <td style={{
                          padding: '13px 16px',
                          textAlign: 'right',
                          fontWeight: 500,
                          color: isAtPeak ? 'var(--color-green, #10b981)' : '#ef4444'
                        }}>
                          {hideValues ? '•••' : `${row.ddPct.toFixed(2)}%`}
                        </td>
                        <td style={{
                          padding: '13px 16px',
                          textAlign: 'right',
                          color: isAtPeak ? 'var(--text-muted)' : '#ef4444',
                          fontWeight: 400
                        }}>
                          {hideValues ? '••••' : (isAtPeak ? '₹0.00' : formatFullIndianRupee(row.ddAmount))}
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
