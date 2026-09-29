import React from 'react';
import ReactDOM from 'react-dom';
import SymbolLogo from './SymbolLogo';
import { Pencil } from 'lucide-react';

function formatDateDisplay(dateStr) {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('/');
    if (parts.length === 3) {
      let d, m, y;
      if (parts[0].length === 4) {
        [y, m, d] = parts;
      } else {
        [d, m, y] = parts;
      }
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = parseInt(m, 10) - 1;
      const monthName = months[monthIdx] || m;
      return `${parseInt(d, 10)} ${monthName} ${y}`;
    }
  } catch (e) {}
  return dateStr;
}

export default function TradeSummaryPopover({
  trade,
  anchorRect,
  visible,
  onMouseEnter,
  onMouseLeave
}) {
  if (!visible || !trade || !anchorRect) return null;

  const formatRupee = (val) => {
    if (val === undefined || val === null || isNaN(val) || val === '') return '-';
    const num = parseFloat(val);
    if (num === 0) return '₹0.00';
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isBuy = (trade.type || 'Buy').toLowerCase() === 'buy';
  const status = trade.status || (trade.openQty > 0 ? (trade.exitedQty > 0 ? 'Partial' : 'Open') : 'Closed');
  const grossPnl = parseFloat(trade.grossPnl ?? trade.pnl ?? 0);
  const pfImpact = parseFloat(trade.pfImpact ?? 0);
  const cummPf = parseFloat(trade.cummPf ?? 0);
  const stockMove = parseFloat(trade.stockMove ?? 0);
  const rewardRisk = (trade.rewardRisk !== undefined && trade.rewardRisk !== null && trade.rewardRisk !== '' && !isNaN(parseFloat(trade.rewardRisk))) ? parseFloat(trade.rewardRisk) : null;
  const holdingDays = trade.holdingDays ?? 0;
  const capitalAtRisk = parseFloat(trade.capitalAtRisk ?? 0);
  const allocation = parseFloat(trade.currentAllocation || trade.peakAllocation || trade.allocation || 0);

  // Collect filled pyramids
  const pyramids = [];
  for (let i = 1; i <= 4; i++) {
    const pQty = parseFloat(trade[`p${i}Qty`]) || 0;
    const pPrice = parseFloat(trade[`p${i}Price`]) || 0;
    const pDate = trade[`p${i}Date`] || '';
    const pSl = parseFloat(trade[`p${i}Sl`]) || 0;
    if (pQty > 0 || pPrice > 0) {
      pyramids.push({ label: `P${i}`, qty: pQty, price: pPrice, date: pDate, sl: pSl });
    }
  }

  // Collect filled exits
  const exits = [];
  for (let i = 1; i <= 4; i++) {
    const eQty = parseFloat(trade[`e${i}Qty`]) || 0;
    const ePrice = parseFloat(trade[`e${i}Price`]) || 0;
    const eDate = trade[`e${i}Date`] || '';
    if (eQty > 0 || ePrice > 0) {
      const avgEntry = parseFloat(trade.avgEntry || trade.entry) || 0;
      const legPnl = isBuy ? (ePrice - avgEntry) * eQty : (avgEntry - ePrice) * eQty;
      exits.push({ label: `E${i}`, qty: eQty, price: ePrice, date: eDate, pnl: legPnl });
    }
  }

  // Calculate Popover Position
  const popWidth = 380;
  const popHeight = 520;
  let left = anchorRect.right + 10;
  let top = anchorRect.top - 12;

  // If overflowing right
  if (left + popWidth > window.innerWidth - 16) {
    left = Math.max(16, anchorRect.left - popWidth - 10);
  }

  // If overflowing bottom
  if (top + popHeight > window.innerHeight - 16) {
    top = Math.max(16, window.innerHeight - popHeight - 16);
  }

  return ReactDOM.createPortal(
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${popWidth}px`,
        maxHeight: '560px',
        overflowY: 'auto',
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '12px',
        border: '1px solid var(--border-color, rgba(0, 0, 0, 0.08))',
        boxShadow: '0 24px 48px -10px rgba(0, 0, 0, 0.4), 0 6px 20px -3px rgba(0, 0, 0, 0.2)',
        zIndex: 9999999,
        padding: '14px',
        fontSize: '11.5px',
        color: 'var(--text-primary, #1f2937)',
        animation: 'foxtradeFadeIn 0.15s ease-out',
        boxSizing: 'border-box',
        pointerEvents: 'auto'
      }}
    >
      <style>{`
        @keyframes foxtradeFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* 1. Header: Logo, Stock Name, Trade #, Segment, Direction & Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color, #f3f4f6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <SymbolLogo symbol={trade.name} size={24} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary, #111827)', letterSpacing: '-0.01em' }}>
                {trade.name || 'STOCK'}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary, #6b7280)', backgroundColor: 'var(--bg-surface, #f3f4f6)', padding: '1px 5px', borderRadius: '4px' }}>
                #{trade.tradeNo || 1}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>
              {formatDateDisplay(trade.date)}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          {/* Segment Tag */}
          <span style={{
            padding: '2px 7px',
            borderRadius: '5px',
            fontSize: '10px',
            fontWeight: 700,
            backgroundColor: 'var(--bg-surface, #f3f4f6)',
            color: 'var(--text-secondary, #4b5563)'
          }}>
            {trade.instrumentType || 'Cash'}
          </span>

          {/* Buy / Sell Badge */}
          <span style={{
            padding: '2px 7px',
            borderRadius: '5px',
            fontSize: '10.5px',
            fontWeight: 700,
            backgroundColor: isBuy ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
            color: 'var(--text-primary, #111827)',
            border: isBuy ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(244, 63, 94, 0.25)'
          }}>
            {trade.type || 'Buy'}
          </span>

          {/* Status Badge */}
          <span style={{
            padding: '2px 7px',
            borderRadius: '5px',
            fontSize: '10.5px',
            fontWeight: 700,
            backgroundColor: status === 'Closed' ? 'var(--bg-surface, #f4f4f5)' : status === 'Partial' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
            color: status === 'Closed' ? 'var(--text-secondary, #52525b)' : status === 'Partial' ? '#b45309' : '#3b82f6',
            border: status === 'Closed' ? '1px solid var(--border-color, #e4e4e7)' : status === 'Partial' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)'
          }}>
            {status}
          </span>
        </div>
      </div>

      {/* 2. Top Highlight Financial Metrics Grid (4 columns x 2 rows) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '6px',
        margin: '10px 0',
        padding: '8px 10px',
        backgroundColor: 'var(--bg-surface, #f9fafb)',
        borderRadius: '8px',
        border: '1px solid var(--border-color, #f3f4f6)'
      }}>
        <div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary, #6b7280)', fontWeight: 600, textTransform: 'uppercase' }}>Gross P/L</div>
          <div style={{
            fontWeight: 700,
            fontSize: '12px',
            fontFamily: 'monospace',
            color: grossPnl > 0 ? '#10b981' : grossPnl < 0 ? '#ef4444' : 'var(--text-primary, #111827)'
          }}>
            {grossPnl > 0 ? '+' : ''}{formatRupee(grossPnl)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary, #6b7280)', fontWeight: 600, textTransform: 'uppercase' }}>PF Impact</div>
          <div style={{
            fontWeight: 700,
            fontSize: '12px',
            fontFamily: 'monospace',
            color: pfImpact > 0 ? '#10b981' : pfImpact < 0 ? '#ef4444' : 'var(--text-primary, #111827)'
          }}>
            {pfImpact > 0 ? '+' : ''}{pfImpact.toFixed(2)}%
          </div>
        </div>

        <div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary, #6b7280)', fontWeight: 600, textTransform: 'uppercase' }}>Cumm. PF</div>
          <div style={{
            fontWeight: 700,
            fontSize: '12px',
            fontFamily: 'monospace',
            color: cummPf > 0 ? '#10b981' : cummPf < 0 ? '#ef4444' : 'var(--text-primary, #111827)'
          }}>
            {cummPf > 0 ? '+' : ''}{cummPf.toFixed(2)}%
          </div>
        </div>

        <div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary, #6b7280)', fontWeight: 600, textTransform: 'uppercase' }}>Stock Move</div>
          <div style={{
            fontWeight: 700,
            fontSize: '12px',
            fontFamily: 'monospace',
            color: stockMove > 0 ? '#10b981' : stockMove < 0 ? '#ef4444' : 'var(--text-primary, #111827)'
          }}>
            {stockMove > 0 ? '+' : ''}{stockMove.toFixed(2)}%
          </div>
        </div>

        <div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary, #6b7280)', fontWeight: 600, textTransform: 'uppercase' }}>R:R</div>
          <div style={{ fontWeight: 700, fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-primary, #111827)' }}>
            {rewardRisk !== null ? `${rewardRisk > 0 ? '+' : ''}${rewardRisk}R` : '—'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary, #6b7280)', fontWeight: 600, textTransform: 'uppercase' }}>Hold Days</div>
          <div style={{ fontWeight: 700, fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-primary, #111827)' }}>
            {holdingDays}d
          </div>
        </div>

        <div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary, #6b7280)', fontWeight: 600, textTransform: 'uppercase' }}>Cap at Risk</div>
          <div style={{ fontWeight: 700, fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-primary, #111827)' }}>
            {capitalAtRisk.toFixed(2)}%
          </div>
        </div>

        <div>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary, #6b7280)', fontWeight: 600, textTransform: 'uppercase' }}>Allocation</div>
          <div style={{ fontWeight: 700, fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-primary, #111827)' }}>
            {allocation > 0 ? `${allocation.toFixed(2)}%` : '0.00%'}
          </div>
        </div>
      </div>

      {/* 3. Core Trade Parameters 3-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 8px', margin: '8px 0', fontSize: '11px' }}>
        <div>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '9.5px' }}>Initial Qty:</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary, #111827)', fontFamily: 'monospace' }}>{trade.qty || 0}</div>
        </div>

        <div>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '9.5px' }}>Pos. Size:</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary, #111827)', fontFamily: 'monospace' }}>{formatRupee(trade.positionSize)}</div>
        </div>

        <div>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '9.5px' }}>Allocation (%):</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary, #111827)', fontFamily: 'monospace' }}>{allocation > 0 ? `${allocation.toFixed(2)}%` : '0.00%'}</div>
        </div>

        <div>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '9.5px' }}>Entry Price:</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary, #111827)', fontFamily: 'monospace' }}>{formatRupee(trade.entry)}</div>
        </div>

        <div>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '9.5px' }}>Avg Entry:</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary, #111827)', fontFamily: 'monospace' }}>{formatRupee(trade.avgEntry)}</div>
        </div>

        <div>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '9.5px' }}>Entry Date:</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary, #111827)' }}>{formatDateDisplay(trade.date)}</div>
        </div>

        <div>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '9.5px' }}>SL / SL %:</div>
          <div style={{ fontWeight: 600, color: '#dc2626', fontFamily: 'monospace' }}>{trade.sl ? `${formatRupee(trade.sl)} ${trade.slPct ? `(${trade.slPct}%)` : ''}` : '—'}</div>
        </div>

        <div>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '9.5px' }}>CMP:</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary, #111827)', fontFamily: 'monospace' }}>{formatRupee(trade.cmp)}</div>
        </div>

        <div>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '9.5px' }}>Open Qty:</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary, #111827)', fontFamily: 'monospace' }}>{trade.openQty ?? 0}</div>
        </div>

        <div>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '9.5px' }}>Exited Qty:</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary, #111827)', fontFamily: 'monospace' }}>{trade.exitedQty ?? 0}</div>
        </div>

        <div>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '9.5px' }}>Avg. Exit:</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary, #111827)', fontFamily: 'monospace' }}>{formatRupee(trade.avgExitPrice)}</div>
        </div>

        <div>
          <div style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '9.5px' }}>Realized Amount:</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary, #111827)', fontFamily: 'monospace' }}>{formatRupee(trade.realisedAmount)}</div>
        </div>
      </div>

      {/* 4. Pyramid Tranches Subgrid (P1..P4) */}
      {pyramids.length > 0 && (
        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--border-color, #e5e7eb)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Pyramid Tranches:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {pyramids.map(p => (
              <div
                key={p.label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '4px',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(124, 58, 237, 0.08)',
                  border: '1px solid rgba(124, 58, 237, 0.2)',
                  fontSize: '10.5px'
                }}
              >
                <div>
                  <span style={{ color: '#8b5cf6', fontWeight: 700 }}>{p.label} Price: </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{formatRupee(p.price)}</span>
                </div>
                <div>
                  <span style={{ color: '#8b5cf6', fontWeight: 700 }}>Qty: </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{p.qty}</span>
                </div>
                <div>
                  <span style={{ color: '#8b5cf6', fontWeight: 700 }}>Date: </span>
                  <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{formatDateDisplay(p.date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Exit Tranches Subgrid (E1..E4) */}
      {exits.length > 0 && (
        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--border-color, #e5e7eb)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Exit Executions:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {exits.map(e => (
              <div
                key={e.label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1.2fr',
                  gap: '4px',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  fontSize: '10.5px'
                }}
              >
                <div>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>{e.label} Price: </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{formatRupee(e.price)}</span>
                </div>
                <div>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>Qty: </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{e.qty}</span>
                </div>
                <div>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>Date: </span>
                  <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{formatDateDisplay(e.date)} </span>
                  <span style={{ fontWeight: 700, color: e.pnl >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
                    ({e.pnl >= 0 ? '+' : ''}{formatRupee(e.pnl)})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Qualitative Psychology & Journal Notes */}
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color, #f3f4f6)', display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10.5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary, #6b7280)' }}>Setup / Entry Type:</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
            {trade.setup || '-'} {trade.entryType ? `(${trade.entryType})` : ''}
          </span>
        </div>

        {trade.planFollowed && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary, #6b7280)' }}>Plan Followed:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary, #111827)' }}>{trade.planFollowed}</span>
          </div>
        )}

        {trade.exitTrigger && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary, #6b7280)' }}>Exit Trigger:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary, #111827)' }}>{trade.exitTrigger}</span>
          </div>
        )}

        {trade.growthAreas && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary, #6b7280)' }}>Growth Areas:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary, #111827)' }}>{trade.growthAreas}</span>
          </div>
        )}

        {trade.quickNote && (
          <div style={{ marginTop: '2px', backgroundColor: 'var(--bg-surface, #f9fafb)', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--border-color, #f3f4f6)' }}>
            <span style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '9.5px', fontWeight: 600, display: 'block' }}>NOTE:</span>
            <span style={{ color: 'var(--text-primary, #374151)', fontStyle: 'italic' }}>{trade.quickNote}</span>
          </div>
        )}
      </div>

      {/* 7. Footer Hint */}
      <div style={{
        marginTop: '10px',
        paddingTop: '8px',
        borderTop: '1px solid var(--border-color, #f3f4f6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        fontSize: '10px',
        color: 'var(--text-muted, #9ca3af)',
        fontWeight: 500
      }}>
        <Pencil size={11} color="var(--text-muted, #9ca3af)" />
        <span>Click pencil icon to edit full trade</span>
      </div>
    </div>,
    document.body
  );
}
