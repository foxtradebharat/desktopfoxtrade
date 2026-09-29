import React from 'react';
import { X, TrendingUp, TrendingDown, Clock, ShieldCheck, Tag, FileText, ArrowRight } from 'lucide-react';
import SymbolLogo from '../SymbolLogo';

function formatDateDisplay(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  } catch (_) {}
  return String(dateStr);
}

function formatRupee(val) {
  if (val === undefined || val === null || isNaN(val) || val === '') return '₹0.00';
  const num = parseFloat(val);
  const prefix = num < 0 ? '-₹' : '+₹';
  return `${prefix}${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReplayTradeDetailPanel({ trade, onClose }) {
  if (!trade) return null;

  const symbol = trade.name || trade.symbol || 'TRADE';
  const isBuy = (trade.type || 'Buy').toLowerCase() === 'buy';
  const pnl = parseFloat(trade.pnl ?? trade.grossPnl ?? 0);
  const isWin = pnl > 0;
  const isLoss = pnl < 0;
  const status = trade.status || (pnl !== 0 ? 'Closed' : 'Open');
  const entryPrice = parseFloat(trade.avgEntry || trade.entry || trade.entryLegs?.[0]?.price || 0);
  const exitPrice = parseFloat(trade.exitPrice || trade.exitLegs?.[0]?.price || 0);
  const qty = parseFloat(trade.qty || trade.totalQty || trade.entryLegs?.[0]?.qty || 0);
  const returnPct = entryPrice > 0 ? ((pnl / (entryPrice * (qty || 1))) * 100) : 0;
  const rewardRisk = trade.rewardRisk || trade.rr || (trade.target && trade.sl ? Math.abs((trade.target - entryPrice) / (entryPrice - trade.sl)).toFixed(2) : null);

  // Pyramids (P1 - P4)
  const pyramids = [];
  for (let i = 1; i <= 4; i++) {
    const pQty = parseFloat(trade[`p${i}Qty`]);
    const pPrice = parseFloat(trade[`p${i}Price`]);
    const pDate = trade[`p${i}Date`];
    if (pQty > 0 || pPrice > 0 || pDate) {
      pyramids.push({ label: `P${i}`, qty: pQty || 0, price: pPrice || 0, date: pDate });
    }
  }

  // Exits (E1 - E4)
  const exits = [];
  for (let i = 1; i <= 4; i++) {
    const eQty = parseFloat(trade[`e${i}Qty`]);
    const ePrice = parseFloat(trade[`e${i}Price`]);
    const eDate = trade[`e${i}Date`];
    if (eQty > 0 || ePrice > 0 || eDate) {
      exits.push({ label: `E${i}`, qty: eQty || 0, price: ePrice || 0, date: eDate });
    }
  }

  // Tags
  const allTags = [];
  if (trade.setup) allTags.push({ label: trade.setup, type: 'setup' });
  if (trade.strategy) allTags.push({ label: trade.strategy, type: 'strategy' });
  if (trade.pattern) allTags.push({ label: trade.pattern, type: 'setup' });
  if (Array.isArray(trade.tags)) {
    trade.tags.forEach(t => allTags.push({ label: String(t), type: 'custom' }));
  }
  if (trade.mistake) allTags.push({ label: trade.mistake, type: 'mistake' });
  if (trade.emotion) allTags.push({ label: trade.emotion, type: 'emotion' });

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '340px',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid var(--border-color, #e5e7eb)',
        boxShadow: '-8px 0 25px rgba(0, 0, 0, 0.12)',
        zIndex: 45,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideInRight 0.2s ease-out',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#fafafa'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SymbolLogo symbol={symbol} size={24} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 800, fontSize: '13px', color: '#111827' }}>
                {symbol}
              </span>
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  padding: '2px 5px',
                  borderRadius: '4px',
                  backgroundColor: isBuy ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: isBuy ? '#059669' : '#dc2626'
                }}
              >
                {isBuy ? 'LONG' : 'SHORT'}
              </span>
            </div>
            <div style={{ fontSize: '10px', color: '#6b7280' }}>
              Trade #{trade.tradeNo || trade.id?.slice(0, 6) || '1'} • {status}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          title="Close Panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#f3f4f6',
            color: '#4b5563',
            cursor: 'pointer'
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Body Scroll Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* P&L Main Card */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: isWin ? 'rgba(16, 185, 129, 0.06)' : isLoss ? 'rgba(239, 68, 68, 0.06)' : '#f9fafb',
            border: isWin ? '1px solid rgba(16, 185, 129, 0.25)' : isLoss ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid #e5e7eb'
          }}
        >
          <div style={{ fontSize: '10.5px', color: '#6b7280', fontWeight: 600 }}>
            Realized Outcome
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
            <span
              style={{
                fontSize: '20px',
                fontWeight: 800,
                fontFamily: 'monospace',
                color: isWin ? '#059669' : isLoss ? '#dc2626' : '#111827'
              }}
            >
              {formatRupee(pnl)}
            </span>
            {returnPct !== 0 && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: isWin ? '#059669' : '#dc2626'
                }}
              >
                {returnPct > 0 ? `+${returnPct.toFixed(2)}%` : `${returnPct.toFixed(2)}%`}
              </span>
            )}
          </div>

          {rewardRisk && (
            <div style={{ marginTop: '6px', fontSize: '10.5px', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={12} color="#059669" />
              <span>Risk:Reward: <strong>{rewardRisk}R</strong></span>
            </div>
          )}
        </div>

        {/* Execution Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '9.5px', color: '#6b7280' }}>Avg Entry</div>
            <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', color: '#111827', marginTop: '2px' }}>
              ₹{entryPrice.toFixed(2)}
            </div>
            <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '2px' }}>
              {formatDateDisplay(trade.date || trade.entryDate)}
            </div>
          </div>

          <div style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '9.5px', color: '#6b7280' }}>Avg Exit</div>
            <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', color: '#111827', marginTop: '2px' }}>
              {exitPrice > 0 ? `₹${exitPrice.toFixed(2)}` : 'Open'}
            </div>
            <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '2px' }}>
              {formatDateDisplay(trade.exitDate)}
            </div>
          </div>

          <div style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '9.5px', color: '#6b7280' }}>Quantity</div>
            <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', color: '#111827', marginTop: '2px' }}>
              {qty.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '9.5px', color: '#6b7280' }}>Holding Time</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827', marginTop: '2px' }}>
              {trade.holdingDays ? `${trade.holdingDays} days` : 'Intraday'}
            </div>
          </div>
        </div>

        {/* Pyramids & Exits Breakdown */}
        {(pyramids.length > 0 || exits.length > 0) && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>
              Scale-In & Exit Legs
            </div>
            
            {pyramids.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                <div style={{ fontSize: '9.5px', fontWeight: 600, color: '#059669' }}>Scale-Ins (Pyramids):</div>
                {pyramids.map(p => (
                  <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#4b5563', fontFamily: 'monospace' }}>
                    <span>{p.label} ({formatDateDisplay(p.date)}):</span>
                    <span>{p.qty} @ ₹{p.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {exits.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '9.5px', fontWeight: 600, color: '#dc2626' }}>Scale-Outs (Exits):</div>
                {exits.map(e => (
                  <div key={e.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#4b5563', fontFamily: 'monospace' }}>
                    <span>{e.label} ({formatDateDisplay(e.date)}):</span>
                    <span>{e.qty} @ ₹{e.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tags Section */}
        {allTags.length > 0 && (
          <div>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#374151', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Tag size={12} />
              <span>Tags & Classifications</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {allTags.map((t, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '9.5px',
                    fontWeight: 600,
                    backgroundColor: t.type === 'mistake' ? 'rgba(239, 68, 68, 0.1)' : t.type === 'setup' ? 'rgba(59, 130, 246, 0.1)' : '#f3f4f6',
                    color: t.type === 'mistake' ? '#dc2626' : t.type === 'setup' ? '#2563eb' : '#374151',
                    border: '1px solid rgba(0,0,0,0.06)'
                  }}
                >
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Journal Notes */}
        {(trade.notes || trade.comments || trade.postAnalysis) && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#374151', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileText size={12} />
              <span>Journal Reflections & Notes</span>
            </div>
            <p style={{ fontSize: '11px', color: '#4b5563', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>
              {trade.notes || trade.comments || trade.postAnalysis}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
