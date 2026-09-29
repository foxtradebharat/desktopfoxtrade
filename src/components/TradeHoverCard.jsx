import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import SymbolLogo from './SymbolLogo';

export default function TradeHoverCard({ trade, position, onOpenChart, onOpenDeepDive, onMouseEnter, onMouseLeave }) {
  if (!trade) return null;

  const symbol = trade.name || trade.symbol || 'STOCK';
  const instrumentType = trade.instrumentType || 'Cash';

  const formatNumber = (val, prefix = '', suffix = '') => {
    if (val === undefined || val === null || val === '') return '0.00';
    if (typeof val === 'number') {
      return `${prefix}${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
    }
    return `${prefix}${val}${suffix}`;
  };

  const handleCardClick = (e) => {
    e.stopPropagation();
    if (onOpenDeepDive) {
      onOpenDeepDive(symbol, trade.tradeNo, trade.id);
    } else if (onOpenChart) {
      onOpenChart(symbol);
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        top: position?.top || '100px',
        left: position?.left || '100px',
        backgroundColor: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '16px',
        padding: '16px 18px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 10px 15px -3px rgba(0, 0, 0, 0.2)',
        width: '460px',
        zIndex: 999999,
        fontSize: '11px',
        cursor: 'pointer',
        animation: 'fadeIn 0.15s ease-out',
        transition: 'transform 0.1s ease, box-shadow 0.15s ease'
      }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Top Header line with Logo, Stock Name, Arrow & Cash/Segment tag */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '14px',
        paddingBottom: '10px',
        borderBottom: '1px solid var(--border-color, #f3f4f6)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SymbolLogo symbol={symbol} size={22} />
          <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary, #111827)', letterSpacing: '-0.2px' }}>
            {symbol}
          </span>
          <span 
            onClick={handleCardClick}
            title="Click to open full deep dive & technical chart"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.08)',
              borderRadius: '6px',
              padding: '2px 6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease'
            }}>
            Deep Dive <ArrowUpRight size={12} style={{ marginLeft: '2px' }} />
          </span>
        </div>

        <span style={{
          padding: '3px 10px',
          borderRadius: '6px',
          backgroundColor: 'var(--bg-surface, #f3f4f6)',
          color: 'var(--text-secondary, #4b5563)',
          fontSize: '11px',
          fontWeight: 700
        }}>
          {instrumentType}
        </span>
      </div>

      {/* 3-Column Grid of 14 Rounded Metric Boxes (1:1 with Screenshot) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        marginBottom: '10px'
      }}>
        {/* Box 1: Initial Qty */}
        <div style={{ backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '6px 8px' }}>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '10px' }}>Initial Qty:</div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary, #111827)', fontFamily: 'monospace', fontSize: '11px' }}>
            {formatNumber(trade.qty)}
          </div>
        </div>

        {/* Box 2: Pos. Size */}
        <div style={{ backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '6px 8px' }}>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '10px' }}>Pos. Size:</div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary, #111827)', fontFamily: 'monospace', fontSize: '11px' }}>
            {formatNumber(trade.positionSize || (trade.avgEntry * trade.qty))}
          </div>
        </div>

        {/* Box 3: Allocation (%) */}
        <div style={{ backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '6px 8px' }}>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '10px' }}>Allocation (%):</div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary, #111827)', fontFamily: 'monospace', fontSize: '11px' }}>
            {formatNumber(trade.currentAllocation || trade.peakAllocation)}
          </div>
        </div>

        {/* Box 4: Open Qty */}
        <div style={{ backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '6px 8px' }}>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '10px' }}>Open Qty:</div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary, #111827)', fontFamily: 'monospace', fontSize: '11px' }}>
            {formatNumber(trade.openQty !== undefined ? trade.openQty : (trade.status === 'Closed' ? 0 : trade.qty))}
          </div>
        </div>

        {/* Box 5: Exited Qty */}
        <div style={{ backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '6px 8px' }}>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '10px' }}>Exited Qty:</div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary, #111827)', fontFamily: 'monospace', fontSize: '11px' }}>
            {formatNumber(trade.exitedQty !== undefined ? trade.exitedQty : (trade.status === 'Closed' ? trade.qty : 0))}
          </div>
        </div>

        {/* Box 6: Avg. Exit (₹) */}
        <div style={{ backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '6px 8px' }}>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '10px' }}>Avg. Exit (₹):</div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary, #111827)', fontFamily: 'monospace', fontSize: '11px' }}>
            {formatNumber(trade.avgExit || trade.avgExitPrice)}
          </div>
        </div>

        {/* Box 7: Stock Move (%) */}
        <div style={{ backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '6px 8px' }}>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '10px' }}>Stock Move (%):</div>
          <div style={{
            fontWeight: 700,
            color: (trade.stockMove ?? trade.pnlPct ?? 0) >= 0 ? '#059669' : '#dc2626',
            fontFamily: 'monospace',
            fontSize: '11px'
          }}>
            {formatNumber(trade.stockMove ?? trade.pnlPct ?? 0)}%
          </div>
        </div>

        {/* Box 8: Status */}
        <div style={{ backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '6px 8px' }}>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '10px' }}>Status:</div>
          <div style={{
            fontWeight: 700,
            color: trade.status === 'Closed' ? '#059669' : '#2563eb',
            fontSize: '11px'
          }}>
            {trade.status || 'Open'}
          </div>
        </div>

        {/* Box 9: Realized Amount (₹) */}
        <div style={{ backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '6px 8px' }}>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '10px' }}>Realized Amount (₹):</div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary, #111827)', fontFamily: 'monospace', fontSize: '11px' }}>
            {formatNumber(trade.realisedAmount ?? ((trade.avgExit ?? 0) * (trade.qty ?? 0)))}
          </div>
        </div>

        {/* Box 10: Realized P/L (₹) */}
        <div style={{ backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '6px 8px' }}>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '10px' }}>Realized P/L (₹):</div>
          <div style={{
            fontWeight: 800,
            color: (trade.pnl ?? 0) >= 0 ? '#059669' : '#dc2626',
            fontFamily: 'monospace',
            fontSize: '11px'
          }}>
            {formatNumber(trade.pnl ?? 0)}
          </div>
        </div>

        {/* Box 11: PF Impact (%) */}
        <div style={{ backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '6px 8px' }}>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '10px' }}>PF Impact (%):</div>
          <div style={{ fontWeight: 700, color: (trade.pfImpact ?? 0) >= 0 ? '#059669' : '#dc2626', fontFamily: 'monospace', fontSize: '11px' }}>
            {formatNumber(trade.pfImpact ?? 0)}
          </div>
        </div>

        {/* Box 12: Cumulative PF impact (%) */}
        <div style={{ backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '6px 8px' }}>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '10px' }}>Cumulative PF impact (%):</div>
          <div style={{ fontWeight: 700, color: (trade.cummPf ?? 0) >= 0 ? '#059669' : '#dc2626', fontFamily: 'monospace', fontSize: '11px' }}>
            {formatNumber(trade.cummPf ?? 0)}
          </div>
        </div>

        {/* Box 13: R:R */}
        <div style={{ backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '6px 8px' }}>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '10px' }}>R:R:</div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary, #111827)', fontFamily: 'monospace', fontSize: '11px' }}>
            {trade.rewardRisk !== undefined && trade.rewardRisk !== null ? `${trade.rewardRisk}R` : '-'}
          </div>
        </div>

        {/* Box 14: Holding Days (spans 2 cols) */}
        <div style={{ gridColumn: 'span 2', backgroundColor: 'var(--bg-surface, #ffffff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '8px', padding: '6px 8px' }}>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '10px' }}>Holding Days (Open-weighted)...</div>
          <div style={{ fontWeight: 700, color: 'var(--text-secondary, #4b5563)', fontFamily: 'monospace', fontSize: '11px' }}>
            {trade.holdingDays !== undefined ? `${trade.holdingDays} days` : 'unassigned'}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div style={{
        textAlign: 'center',
        paddingTop: '6px',
        borderTop: '1px dashed var(--border-color, #e5e7eb)',
        color: '#3b82f6',
        fontSize: '11px',
        fontWeight: 600
      }}>
        Click anywhere to open full technical candlestick chart ↗
      </div>
    </div>
  );
}
