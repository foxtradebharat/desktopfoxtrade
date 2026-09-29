import React, { useState } from 'react';
import { TrendingUp, TrendingDown, X, Check, ArrowRight, DollarSign } from 'lucide-react';

export default function ReplayPracticePanel({
  currentCandle,
  practicePosition,
  onOpenPosition,
  onClosePosition,
  onResetPosition,
  onDismiss
}) {
  const [qty, setQty] = useState(100);

  const currentPrice = currentCandle?.close || 0;

  // Calculate live unrealized P&L
  let livePnl = 0;
  let livePnlPct = 0;
  if (practicePosition && practicePosition.status === 'OPEN' && currentPrice > 0) {
    const isBuy = practicePosition.side === 'BUY';
    const priceDiff = isBuy ? (currentPrice - practicePosition.entryPrice) : (practicePosition.entryPrice - currentPrice);
    livePnl = priceDiff * practicePosition.qty;
    livePnlPct = (priceDiff / practicePosition.entryPrice) * 100;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '64px',
        left: '20px',
        zIndex: 38,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '12px',
        boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.12)',
        padding: '10px 14px',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '11px',
        width: '270px',
        animation: 'fadeIn 0.15s ease-out'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 800, color: '#111827' }}>
          <TrendingUp size={13} color="#059669" />
          <span>Practice Paper Trading</span>
        </div>
        <button
          onClick={onDismiss}
          title="Dismiss Practice Panel"
          style={{
            background: 'none',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex'
          }}
        >
          <X size={13} />
        </button>
      </div>

      {!practicePosition || practicePosition.status !== 'OPEN' ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#6b7280' }}>Market Price:</span>
            <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#111827' }}>
              ₹{currentPrice.toFixed(2)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: '#6b7280' }}>Shares:</span>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                width: '70px',
                padding: '3px 6px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                textAlign: 'right',
                fontSize: '11px',
                fontFamily: 'monospace',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              onClick={() => onOpenPosition('BUY', qty, currentPrice)}
              disabled={!currentPrice}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#10b981',
                color: '#ffffff',
                fontWeight: 700,
                cursor: currentPrice ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <TrendingUp size={12} />
              <span>Sim Buy</span>
            </button>

            <button
              onClick={() => onOpenPosition('SELL', qty, currentPrice)}
              disabled={!currentPrice}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontWeight: 700,
                cursor: currentPrice ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <TrendingDown size={12} />
              <span>Sim Sell</span>
            </button>
          </div>

          {practicePosition && practicePosition.status === 'CLOSED' && (
            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e5e7eb' }}>
              <div style={{ fontSize: '10px', color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
                <span>Last Trade Result:</span>
                <span style={{ fontWeight: 700, color: practicePosition.pnl >= 0 ? '#059669' : '#dc2626' }}>
                  {practicePosition.pnl >= 0 ? '+' : ''}₹{practicePosition.pnl.toFixed(2)} ({practicePosition.pnlPct >= 0 ? '+' : ''}{practicePosition.pnlPct.toFixed(2)}%)
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Active Position Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: practicePosition.side === 'BUY' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: practicePosition.side === 'BUY' ? '#059669' : '#dc2626',
                fontWeight: 800,
                fontSize: '10px'
              }}
            >
              {practicePosition.side === 'BUY' ? 'SIM LONG' : 'SIM SHORT'} {practicePosition.qty} Qty
            </span>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>
              Held {practicePosition.barsHeld || 0} bars
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: '4px', color: '#4b5563' }}>
            <span>Entry Price:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>₹{practicePosition.entryPrice.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: '8px', color: '#4b5563' }}>
            <span>Current Price:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>₹{currentPrice.toFixed(2)}</span>
          </div>

          {/* Live P&L Box */}
          <div
            style={{
              padding: '8px',
              borderRadius: '6px',
              backgroundColor: livePnl >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: livePnl >= 0 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
              marginBottom: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#4b5563' }}>Unrealized P&L:</span>
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 800,
                fontSize: '12px',
                color: livePnl >= 0 ? '#059669' : '#dc2626'
              }}
            >
              {livePnl >= 0 ? '+₹' : '-₹'}{Math.abs(livePnl).toFixed(2)} ({livePnlPct >= 0 ? '+' : ''}{livePnlPct.toFixed(2)}%)
            </span>
          </div>

          <button
            onClick={() => onClosePosition(currentPrice)}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#111827',
              color: '#ffffff',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <Check size={12} />
            <span>Close Simulated Position</span>
          </button>
        </div>
      )}
    </div>
  );
}
