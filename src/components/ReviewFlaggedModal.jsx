import React, { useState } from 'react';
import { AlertTriangle, X, ArrowLeftRight, Check } from 'lucide-react';

/**
 * ReviewFlaggedModal
 * ─────────────────────────────────────────────────────────────────────────────
 * Clean monochrome White & Black modal for reviewing and fixing flagged trade dates.
 * Uses Lucide icons only (no emojis), with green/red for financial figures.
 */
export function ReviewFlaggedModal({ isOpen, onClose, flaggedTrades = [], onUpdateTrade }) {
  const [swappedIds, setSwappedIds] = useState(new Set());
  const [isDonePressed, setIsDonePressed] = useState(false);

  if (!isOpen) return null;

  const handleSwapDates = (trade) => {
    if (!onUpdateTrade) return;
    const entryDate = trade.date || trade.entryDate;
    const exitDate = trade.e1Date || trade.exitDate;
    if (entryDate && exitDate) {
      onUpdateTrade(trade.id, 'date', exitDate);
      onUpdateTrade(trade.id, 'e1Date', entryDate);
      if (trade.exitDate) onUpdateTrade(trade.id, 'exitDate', entryDate);
      setSwappedIds(prev => new Set(prev).add(trade.id));
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-surface, #ffffff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '880px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        color: 'var(--text-primary, #09090b)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={17} color="var(--text-primary, #09090b)" />
              <span>Trades Requiring Date Review</span>
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '9999px',
                border: '1px solid var(--border-color, #e5e7eb)',
                background: 'var(--bg-muted, rgba(0, 0, 0, 0.04))',
                color: 'var(--text-secondary, #71717a)',
                fontWeight: 600
              }}>
                {flaggedTrades.length} Flagged
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #71717a)', marginTop: '4px' }}>
              Realized P&amp;L is 100% computed from execution prices. Fix date typos to ensure 100% correct month &amp; FY attribution.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #71717a)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-muted, rgba(0, 0, 0, 0.05))'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Table */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid var(--border-color, #e5e7eb)',
                color: 'var(--text-muted, #71717a)',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                textAlign: 'left'
              }}>
                <th style={{ padding: '8px 10px' }}>#</th>
                <th style={{ padding: '8px 10px' }}>Symbol</th>
                <th style={{ padding: '8px 10px' }}>Entry Date</th>
                <th style={{ padding: '8px 10px' }}>Exit Date (E1)</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Realized P&amp;L</th>
                <th style={{ padding: '8px 10px' }}>Issue Flag</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Fix</th>
              </tr>
            </thead>
            <tbody>
              {flaggedTrades.map((t, idx) => {
                const pl = Number(t.pnl ?? t.pl ?? (t.grossPaise ? t.grossPaise / 100 : 0));
                // Red and green strictly for numbers
                const plColor = pl > 0 ? '#16a34a' : pl < 0 ? '#dc2626' : 'var(--text-muted, #71717a)';
                const hasExitBeforeEntry = t.flags && t.flags.includes('EXIT_BEFORE_ENTRY');
                const isSwapped = swappedIds.has(t.id);

                return (
                  <tr key={t.id || idx} style={{ borderBottom: '1px solid var(--border-color, rgba(0, 0, 0, 0.06))' }}>
                    <td style={{ padding: '10px 10px', color: 'var(--text-muted, #71717a)', fontSize: '12px' }}>
                      {t.tradeNo || (idx + 1)}
                    </td>
                    <td style={{ padding: '10px 10px', fontWeight: 600 }}>
                      {t.name || t.symbol}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <input
                        type="text"
                        defaultValue={t.date || ''}
                        onBlur={(e) => onUpdateTrade && onUpdateTrade(t.id, 'date', e.target.value)}
                        style={{
                          background: 'var(--bg-primary, #ffffff)',
                          border: '1px solid var(--border-color, #d4d4d8)',
                          borderRadius: '6px',
                          color: 'var(--text-primary, #09090b)',
                          padding: '4px 8px',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          width: '105px',
                          outline: 'none'
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <input
                        type="text"
                        defaultValue={t.e1Date || t.exitDate || ''}
                        onBlur={(e) => {
                          if (onUpdateTrade) {
                            onUpdateTrade(t.id, 'e1Date', e.target.value);
                            onUpdateTrade(t.id, 'exitDate', e.target.value);
                          }
                        }}
                        style={{
                          background: 'var(--bg-primary, #ffffff)',
                          border: '1px solid var(--border-color, #d4d4d8)',
                          borderRadius: '6px',
                          color: 'var(--text-primary, #09090b)',
                          padding: '4px 8px',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          width: '105px',
                          outline: 'none'
                        }}
                      />
                    </td>
                    <td style={{
                      padding: '10px 10px',
                      textAlign: 'right',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      color: plColor
                    }}>
                      {pl > 0 ? `+₹${pl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` :
                       pl < 0 ? `-₹${Math.abs(pl).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` :
                       `₹0.00`}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      {(t.flags || []).map((flag, fIdx) => {
                        const isEbe = flag === 'EXIT_BEFORE_ENTRY';
                        return (
                          <span key={fIdx} style={{
                            display: 'inline-block',
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: isEbe ? '1px solid rgba(220, 38, 38, 0.25)' : '1px solid var(--border-color, #e4e4e7)',
                            background: isEbe ? 'rgba(220, 38, 38, 0.08)' : 'var(--bg-muted, rgba(0, 0, 0, 0.04))',
                            color: isEbe ? '#dc2626' : 'var(--text-secondary, #52525b)',
                            marginRight: '4px'
                          }}>
                            {isEbe ? 'Exit < Entry' : flag}
                          </span>
                        );
                      })}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                      {hasExitBeforeEntry && (
                        <button
                          onClick={() => handleSwapDates(t)}
                          disabled={isSwapped}
                          title="Swap Entry and Exit Dates"
                          style={{
                            background: isSwapped ? 'var(--bg-muted, rgba(0,0,0,0.05))' : 'var(--bg-primary, #ffffff)',
                            border: '1px solid var(--border-color, #d4d4d8)',
                            color: isSwapped ? '#16a34a' : 'var(--text-primary, #09090b)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: isSwapped ? 'default' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {isSwapped ? <Check size={12} /> : <ArrowLeftRight size={12} />}
                          <span>{isSwapped ? 'Fixed' : 'Swap'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px'
        }}>
          <button
            onClick={onClose}
            className="review-action-btn"
            style={{
              padding: '7px 20px',
              borderRadius: '6px',
              backgroundColor: isDonePressed ? '#6b7280' : 'var(--text-primary, #09090b)',
              color: 'var(--bg-primary, #ffffff)',
              border: `1px solid ${isDonePressed ? '#6b7280' : 'var(--text-primary, #09090b)'}`,
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.08s ease'
            }}
            onMouseDown={() => setIsDonePressed(true)}
            onMouseUp={() => setIsDonePressed(false)}
            onMouseEnter={(e) => {
              if (!isDonePressed) e.currentTarget.style.backgroundColor = '#27272a';
            }}
            onMouseLeave={(e) => {
              setIsDonePressed(false);
              e.currentTarget.style.backgroundColor = 'var(--text-primary, #09090b)';
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReviewFlaggedModal;
