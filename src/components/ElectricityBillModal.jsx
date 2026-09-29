import React, { useRef } from 'react';
import { X, Printer, Download, Share2, Award, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ElectricityBillModal({ isOpen, onClose, trades = [], user }) {
  const statementRef = useRef(null);

  if (!isOpen) return null;

  // Compute Current Month Stats
  const currentMonthStr = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const closedTrades = trades.filter(t => t.status === 'Closed');

  const wins = closedTrades.filter(t => (t.pnl || 0) > 0);
  const losses = closedTrades.filter(t => (t.pnl || 0) <= 0);

  const grossProfit = wins.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((acc, t) => acc + (t.pnl || 0), 0));
  const netEarnings = grossProfit - grossLoss;

  // Estimated Brokerage & STT (approx ₹40/trade + STT)
  const estCharges = closedTrades.length * 45;
  const netTakeHome = netEarnings - estCharges;

  const winRate = closedTrades.length > 0 ? Math.round((wins.length / closedTrades.length) * 100) : 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '580px',
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '16px',
        border: '1px solid var(--border-color, #e5e7eb)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        maxHeight: '92vh'
      }}>
        {/* Top Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-primary, #f9fafb)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="#eab308" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
              Monthly Statement (Electricity Bill Format)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #d1d5db)',
                backgroundColor: 'var(--bg-card, #ffffff)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--text-primary, #374151)'
              }}>
              <Printer size={13} />
              Print / PDF
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #6b7280)',
                cursor: 'pointer',
                padding: '4px'
              }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Bill Container */}
        <div 
          ref={statementRef}
          style={{
            padding: '24px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            backgroundColor: '#ffffff',
            color: '#111827',
            fontSize: '13px',
            lineHeight: 1.5
          }}>
          {/* Bill Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px dashed #9ca3af', paddingBottom: '14px', marginBottom: '16px' }}>
            <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '1px' }}>⚡ ARTHA TRADING JOURNAL ⚡</div>
            <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '2px' }}>MONTHLY TRADING CONSUMPTION & P&L BILL</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Period: {currentMonthStr} | Account: {user?.displayName || 'Registered Retail Trader'}</div>
          </div>

          {/* Meter Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingBottom: '14px', borderBottom: '1px solid #e5e7eb', marginBottom: '14px', fontSize: '12px' }}>
            <div>
              <div style={{ color: '#6b7280' }}>TRADER CONSUMER NO.</div>
              <div style={{ fontWeight: 700 }}>IND-F&O-{user?.uid ? user.uid.slice(0, 8).toUpperCase() : 'DEMO99'}</div>
            </div>
            <div>
              <div style={{ color: '#6b7280' }}>BILLING CYCLE</div>
              <div style={{ fontWeight: 700 }}>01 {currentMonthStr.split(' ')[0]} - 30 {currentMonthStr}</div>
            </div>
          </div>

          {/* Activity Section */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: 800, color: '#1f2937', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              1. Trading Activity Summary
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Total Trades Taken:</span>
              <span style={{ fontWeight: 700 }}>{closedTrades.length} units</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Profitable Trades:</span>
              <span style={{ fontWeight: 700, color: '#059669' }}>{wins.length} ({winRate}%)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Loss-making Trades:</span>
              <span style={{ fontWeight: 700, color: '#dc2626' }}>{losses.length} ({100 - winRate}%)</span>
            </div>
          </div>

          {/* Earnings Breakdown */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: 800, color: '#1f2937', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              2. Earnings & Tariff Breakdown
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Gross Profits Made (+):</span>
              <span style={{ fontWeight: 700, color: '#059669' }}>+₹{Math.round(grossProfit).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Gross Losses Incurred (-):</span>
              <span style={{ fontWeight: 700, color: '#dc2626' }}>-₹{Math.round(grossLoss).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Est. Exchange STT & Brokerage Tariff (-):</span>
              <span style={{ fontWeight: 700, color: '#6b7280' }}>-₹{Math.round(estCharges).toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Total Net Due */}
          <div style={{
            backgroundColor: netTakeHome >= 0 ? '#ecfdf5' : '#fef2f2',
            border: `2px solid ${netTakeHome >= 0 ? '#10b981' : '#ef4444'}`,
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: netTakeHome >= 0 ? '#065f46' : '#991b1b' }}>
                NET MONTHLY TAKE-HOME RESULT
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>After all statutory taxes & deductions</div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: netTakeHome >= 0 ? '#059669' : '#dc2626' }}>
              {netTakeHome >= 0 ? `+₹${Math.round(netTakeHome).toLocaleString('en-IN')}` : `-₹${Math.round(Math.abs(netTakeHome)).toLocaleString('en-IN')}`}
            </div>
          </div>

          {/* Simple Household Takeaway */}
          <div style={{
            borderTop: '1px dashed #d1d5db',
            paddingTop: '12px',
            fontSize: '11px',
            color: '#4b5563'
          }}>
            <div style={{ fontWeight: 700, marginBottom: '4px', color: '#111827' }}>Simple Verdict for Personal Record:</div>
            {netTakeHome >= 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857' }}>
                <CheckCircle2 size={13} />
                <span>You generated surplus wealth this month. Your win rate of {winRate}% was profitable.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309' }}>
                <AlertCircle size={13} />
                <span>Capital deficit this month. Focus on reducing losses on weekly expiry days.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
