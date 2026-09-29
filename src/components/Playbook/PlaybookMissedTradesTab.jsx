import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X,
  Calculator,
  Calendar,
  AlertCircle,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import SymbolLogo from '../SymbolLogo';
import { compressImage } from '../../utils/imageCompression';

const INDIAN_INDEX_LOT_PRESETS = [
  { label: 'NIFTY (25)', lotSize: 25 },
  { label: 'BANKNIFTY (15)', lotSize: 15 },
  { label: 'FINNIFTY (25)', lotSize: 25 },
  { label: 'MIDCPNIFTY (50)', lotSize: 50 },
  { label: 'SENSEX (10)', lotSize: 10 }
];

export default function PlaybookMissedTradesTab({
  playbook,
  missedTrades = [],
  onSaveMissedTrades
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filter missed trades for this playbook (or show all if on root)
  const filteredMissed = missedTrades.filter(m => {
    if (!playbook) return true;
    if (playbook.id === 'pb-no-setup' || playbook.isNoSetup) {
      return m.playbookId === 'pb-no-setup' || !m.playbookId;
    }
    return m.playbookId === playbook.id;
  });
  const totalCount = filteredMissed.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginated = filteredMissed.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Form State for + Create Missed Trade
  const [symbol, setSymbol] = useState('');
  const [segment, setSegment] = useState('EQUITY');
  const [direction, setDirection] = useState('LONG');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [lots, setLots] = useState('1');
  const [lotSize, setLotSize] = useState('25');
  const [quantity, setQuantity] = useState('50');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [eventTag, setEventTag] = useState('NONE');
  const [notes, setNotes] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const handleSymbolChange = (val) => {
    setSymbol(val);
    const upper = val.toUpperCase();
    if (upper.includes('BANKNIFTY')) {
      setLotSize('15');
      if (segment === 'EQUITY') setSegment('OPTIONS');
    } else if (upper.includes('FINNIFTY')) {
      setLotSize('25');
      if (segment === 'EQUITY') setSegment('OPTIONS');
    } else if (upper.includes('MIDCPNIFTY')) {
      setLotSize('50');
      if (segment === 'EQUITY') setSegment('OPTIONS');
    } else if (upper.includes('NIFTY')) {
      setLotSize('25');
      if (segment === 'EQUITY') setSegment('OPTIONS');
    } else if (upper.includes('SENSEX')) {
      setLotSize('10');
      if (segment === 'EQUITY') setSegment('OPTIONS');
    } else if (upper.includes('BANKEX')) {
      setLotSize('15');
      if (segment === 'EQUITY') setSegment('OPTIONS');
    }
  };

  const handleScreenshotFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsCompressing(true);
      const compressed = await compressImage(file, { maxDimension: 1200, quality: 0.72 });
      setScreenshotUrl(compressed);
    } catch (err) {
      console.error('Failed to compress screenshot', err);
    } finally {
      setIsCompressing(false);
    }
  };

  // Live theoretical R & Real Contract P&L calculation (Indian F&O + Equity)
  const calculatedStats = React.useMemo(() => {
    const entry = parseFloat(entryPrice) || 0;
    const stop = parseFloat(stopPrice) || 0;
    const exit = parseFloat(exitPrice) || 0;

    if (entry <= 0 || exit <= 0) {
      return { rMultiple: 0, roi: 0, status: 'BE', pnl: 0, points: 0, totalQty: 0 };
    }

    const isFnO = segment === 'OPTIONS' || segment === 'FUTURES';
    const totalQty = isFnO
      ? (parseFloat(lots) || 1) * (parseFloat(lotSize) || 25)
      : (parseFloat(quantity) || 1);

    const points = direction === 'LONG' ? (exit - entry) : (entry - exit);
    const pnl = Math.round(points * totalQty);

    const riskPerShare = stop > 0 ? Math.abs(entry - stop) : 0;
    let rMultiple = 0;
    if (riskPerShare > 0) {
      rMultiple = direction === 'LONG' ? (exit - entry) / riskPerShare : (entry - exit) / riskPerShare;
    }

    const roi = ((points) / entry) * 100;
    const status = points > 0 ? 'WIN' : points < 0 ? 'LOSS' : 'BE';

    return {
      rMultiple: Number(rMultiple.toFixed(2)),
      roi: Number(roi.toFixed(2)),
      status,
      points: Number(points.toFixed(2)),
      totalQty,
      pnl
    };
  }, [entryPrice, stopPrice, exitPrice, direction, segment, lots, lotSize, quantity]);

  const handleCreateMissed = () => {
    if (!symbol.trim() || !entryPrice || !exitPrice) {
      alert('Please fill in at least Symbol, Entry Price, and Exit Price.');
      return;
    }

    const isFnO = segment === 'OPTIONS' || segment === 'FUTURES';

    const newMissed = {
      id: 'missed-' + Date.now().toString(36),
      playbookId: playbook?.id || null,
      symbol: symbol.trim().toUpperCase(),
      segment,
      direction,
      date,
      lots: isFnO ? (parseFloat(lots) || 1) : null,
      lotSize: isFnO ? (parseFloat(lotSize) || 25) : null,
      quantity: calculatedStats.totalQty,
      entryPrice: parseFloat(entryPrice) || 0,
      exitPrice: parseFloat(exitPrice) || 0,
      theoreticalStop: parseFloat(stopPrice) || 0,
      theoreticalPoints: calculatedStats.points,
      theoreticalPnl: calculatedStats.pnl,
      theoreticalRoi: calculatedStats.roi,
      theoreticalRMultiple: calculatedStats.rMultiple,
      status: calculatedStats.status,
      eventTag,
      notes: notes.trim(),
      screenshotUrl: screenshotUrl.trim(),
      createdAt: new Date().toISOString()
    };

    onSaveMissedTrades([newMissed, ...missedTrades]);
    setShowAddModal(false);

    // Reset Form
    setSymbol('');
    setEntryPrice('');
    setStopPrice('');
    setExitPrice('');
    setNotes('');
    setScreenshotUrl('');
    setLots('1');
  };

  const handleDelete = (id) => {
    if (!confirm('Delete this missed trade record?')) return;
    onSaveMissedTrades(missedTrades.filter(m => m.id !== id));
  };

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    const sign = num < 0 ? '-' : num > 0 ? '+' : '';
    return `${sign}₹${Math.abs(num).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const formatPrice = (val) => {
    const num = Number(val) || 0;
    return num > 0 ? `₹${num.toFixed(2)}` : '—';
  };

  const INDIAN_EVENT_TAGS = [
    { key: 'NONE', label: 'Regular Day' },
    { key: 'RBI_POLICY', label: 'RBI Monetary Policy' },
    { key: 'BUDGET_DAY', label: 'Union Budget Day' },
    { key: 'EXPIRY_DAY', label: 'F&O Weekly/Monthly Expiry' },
    { key: 'RESULTS_SEASON', label: 'Earnings / Quarterly Results' },
    { key: 'GLOBAL_CUE', label: 'Fed Decision / US Inflation' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header action bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Missed Setups &amp; Pattern Sandbox ({totalCount})
          </span>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            Theoretical simulation tracking setups that triggered per rules but you hesitated or missed. Purely educational &mdash; zero live P&amp;L contamination.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            borderRadius: 8,
            border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
            background: 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))',
            color: 'var(--text-primary)',
            fontSize: 12,
            fontWeight: 550,
            cursor: 'pointer',
            transition: 'all 0.18s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 12%, var(--bg-surface))'}
          onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))'}
        >
          <Plus size={13} />
          <span>Create Missed Trades</span>
        </button>
      </div>

      {/* Table matching Image 2 */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
        borderRadius: 12,
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
                background: 'var(--bg-primary)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: '0.02em'
              }}>
                <th style={{ padding: '12px 16px' }}>Open Date</th>
                <th style={{ padding: '12px 14px' }}>Symbol</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
                <th style={{ padding: '12px 14px' }}>Close Date</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Entry Price</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Exit Price</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Net P&amp;L (Theo)</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Net ROI / R</th>
                <th style={{ padding: '12px 14px' }}>Event Tag</th>
                <th style={{ padding: '12px 14px' }}>Setup</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No missed trades recorded yet. When a setup triggers and you hesitate, log it here to see if your hesitation is leaking R-multiples!
                  </td>
                </tr>
              ) : (
                paginated.map(m => {
                  const isWin = m.status === 'WIN';
                  const isLoss = m.status === 'LOSS';
                  const isBE = m.status === 'BE';
                  const eventObj = INDIAN_EVENT_TAGS.find(ev => ev.key === m.eventTag);

                  return (
                    <tr
                      key={m.id}
                      style={{
                        borderBottom: '1px solid color-mix(in srgb, var(--border-color) 18%, transparent)',
                        fontSize: 12.5,
                        transition: 'background 0.1s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Open Date */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {m.date || '—'}
                      </td>

                      {/* Symbol */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <SymbolLogo symbol={m.symbol} size={18} />
                          <span style={{ fontWeight: 550, color: 'var(--text-primary)' }}>
                            {m.symbol}
                          </span>
                          {m.screenshotUrl && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewImage(m.screenshotUrl);
                              }}
                              title="View Chart Screenshot"
                              style={{
                                background: 'var(--bg-primary)',
                                border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                                borderRadius: 4,
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 10
                              }}
                            >
                              <ImageIcon size={11} />
                              <span>Chart</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Status Pill (matching Image 2) */}
                      <td style={{ padding: '12px 14px' }}>
                        {isWin && (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: 4,
                            border: '1px solid #10b981',
                            color: '#10b981',
                            fontSize: 10.5,
                            fontWeight: 600,
                            letterSpacing: '0.02em'
                          }}>
                            WIN
                          </span>
                        )}
                        {isLoss && (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: 4,
                            border: '1px solid #ef4444',
                            color: '#ef4444',
                            fontSize: 10.5,
                            fontWeight: 600,
                            letterSpacing: '0.02em'
                          }}>
                            LOSS
                          </span>
                        )}
                        {isBE && (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: 4,
                            border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
                            color: 'var(--text-muted)',
                            fontSize: 10.5,
                            fontWeight: 600,
                            letterSpacing: '0.02em'
                          }}>
                            BE
                          </span>
                        )}
                      </td>

                      {/* Close Date */}
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {m.date || '—'}
                      </td>

                      {/* Entry Price */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                        {formatPrice(m.entryPrice)}
                      </td>

                      {/* Exit Price */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                        {formatPrice(m.exitPrice)}
                      </td>

                      {/* Net P&L (Theoretical) */}
                      <td style={{
                        padding: '12px 14px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 550,
                        color: isWin ? '#10b981' : isLoss ? '#ef4444' : 'var(--text-muted)'
                      }}>
                        {formatCurrency(m.theoreticalPnl)}
                      </td>

                      {/* Net ROI / R Multiple */}
                      <td style={{
                        padding: '12px 14px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 500,
                        color: isWin ? '#10b981' : isLoss ? '#ef4444' : 'var(--text-muted)'
                      }}>
                        {m.theoreticalRMultiple !== undefined ? `${m.theoreticalRMultiple >= 0 ? '+' : ''}${m.theoreticalRMultiple}R` : `${m.theoreticalRoi}%`}
                      </td>

                      {/* Event Tag */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 500,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: 'var(--bg-primary)',
                          border: '1px solid color-mix(in srgb, var(--border-color) 30%, transparent)',
                          color: 'var(--text-secondary)'
                        }}>
                          {eventObj?.label || 'Regular Day'}
                        </span>
                      </td>

                      {/* Setups */}
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>
                        {playbook?.title || '—'}
                      </td>

                      {/* Delete */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDelete(m.id)}
                          title="Delete Missed Trade"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            display: 'flex',
                            opacity: 0.5
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer matching Image 2 */}
        {totalCount > 0 && (
          <div style={{
            padding: '12px 18px',
            borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            fontSize: 12,
            color: 'var(--text-muted)'
          }}>
            <span>Result: {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount} trades</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{
                  background: 'none',
                  border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                  borderRadius: 6,
                  padding: 4,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.4 : 1,
                  display: 'flex',
                  color: 'var(--text-primary)'
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{
                padding: '2px 8px',
                borderRadius: 6,
                background: 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))',
                color: 'var(--text-primary)',
                border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
                fontWeight: 600,
                fontSize: 11
              }}>
                {currentPage}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                style={{
                  background: 'none',
                  border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                  borderRadius: 6,
                  padding: 4,
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.4 : 1,
                  display: 'flex',
                  color: 'var(--text-primary)'
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal to Create Missed Trade ──────────────────────────────────── */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            width: '100%',
            maxWidth: 540,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                Log Missed / Simulated Setup
              </span>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Grid fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Symbol */}
              <div>
                <label htmlFor="missed-symbol-input" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  SYMBOL / CONTRACT
                </label>
                <input
                  id="missed-symbol-input"
                  name="symbol"
                  autoFocus
                  value={symbol}
                  onChange={e => handleSymbolChange(e.target.value)}
                  placeholder="e.g. NIFTY, BANKNIFTY 50500 CE, TATAMOTORS..."
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-surface)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Segment */}
              <div>
                <label htmlFor="missed-segment-select" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  SEGMENT
                </label>
                <select
                  id="missed-segment-select"
                  name="segment"
                  value={segment}
                  onChange={e => setSegment(e.target.value)}
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-surface)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="EQUITY">EQUITY (CASH)</option>
                  <option value="FUTURES">FUTURES (NFO)</option>
                  <option value="OPTIONS">OPTIONS (NFO)</option>
                  <option value="COMMODITY">COMMODITY (MCX)</option>
                  <option value="CURRENCY">CURRENCY (CDS)</option>
                </select>
              </div>

              {/* Direction */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  DIRECTION
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['LONG', 'SHORT'].map(dir => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => setDirection(dir)}
                      style={{
                        flex: 1,
                        height: 34,
                        borderRadius: 6,
                        border: direction === dir ? '1.5px solid var(--text-primary)' : '1px solid var(--border-color)',
                        background: direction === dir ? 'var(--text-primary)' : 'var(--bg-surface)',
                        color: direction === dir ? 'var(--bg-card)' : 'var(--text-secondary)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {dir}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label htmlFor="missed-date-input" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  DATE
                </label>
                <input
                  id="missed-date-input"
                  name="date"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-surface)',
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Position Sizing: Indian F&O Lots vs Equity Quantity */}
            {segment === 'OPTIONS' || segment === 'FUTURES' ? (
              <div style={{
                background: 'var(--bg-primary)',
                border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                borderRadius: 8,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Contract Lots &amp; Multiplier
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    Total: {calculatedStats.totalQty} Qty
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      Lots
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={lots}
                      onChange={e => setLots(e.target.value)}
                      placeholder="1"
                      style={{
                        width: '100%',
                        height: 32,
                        padding: '0 8px',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-surface)',
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-primary)',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      Lot Size (Qty per Lot)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={lotSize}
                      onChange={e => setLotSize(e.target.value)}
                      placeholder="25"
                      style={{
                        width: '100%',
                        height: 32,
                        padding: '0 8px',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-surface)',
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-primary)',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Quick Indian Lot Presets */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>Presets:</span>
                  {INDIAN_INDEX_LOT_PRESETS.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setLotSize(String(p.lotSize))}
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        border: '1px solid color-mix(in srgb, var(--border-color) 30%, transparent)',
                        background: String(lotSize) === String(p.lotSize)
                          ? 'color-mix(in srgb, var(--text-primary) 12%, var(--bg-surface))'
                          : 'var(--bg-surface)',
                        color: String(lotSize) === String(p.lotSize) ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  QUANTITY / SHARES
                </label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="50"
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-surface)',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {/* Price Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label htmlFor="missed-entry-price" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  THEORETICAL ENTRY
                </label>
                <input
                  id="missed-entry-price"
                  name="entryPrice"
                  type="number"
                  step="any"
                  value={entryPrice}
                  onChange={e => setEntryPrice(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-surface)',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label htmlFor="missed-stop-price" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  STOP LOSS
                </label>
                <input
                  id="missed-stop-price"
                  name="stopPrice"
                  type="number"
                  step="any"
                  value={stopPrice}
                  onChange={e => setStopPrice(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-surface)',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label htmlFor="missed-exit-price" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  THEORETICAL EXIT
                </label>
                <input
                  id="missed-exit-price"
                  name="exitPrice"
                  type="number"
                  step="any"
                  value={exitPrice}
                  onChange={e => setExitPrice(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-surface)',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Calculated Outcome Banner */}
            <div style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calculator size={14} color="var(--text-muted)" />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Simulated Outcome:
                </span>
                <span style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 10.5,
                  fontWeight: 800,
                  background: calculatedStats.status === 'WIN' ? 'rgba(16,185,129,0.15)' : calculatedStats.status === 'LOSS' ? 'rgba(239,68,68,0.15)' : 'var(--border-color)',
                  color: calculatedStats.status === 'WIN' ? '#10b981' : calculatedStats.status === 'LOSS' ? '#ef4444' : 'var(--text-muted)'
                }}>
                  {calculatedStats.status}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Points: <strong style={{ color: calculatedStats.points >= 0 ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)' }}>
                    {calculatedStats.points >= 0 ? '+' : ''}{calculatedStats.points}
                  </strong>
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Return: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {calculatedStats.rMultiple ? `${calculatedStats.rMultiple}R` : '—'}
                  </strong>
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Est. P&amp;L: <strong style={{ color: calculatedStats.pnl >= 0 ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(calculatedStats.pnl)}
                  </strong>
                </span>
              </div>
            </div>

            {/* Indian Event Tag */}
            <div>
              <label htmlFor="missed-event-tag" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                INDIAN MARKET EVENT CONTEXT
              </label>
              <select
                id="missed-event-tag"
                name="eventTag"
                value={eventTag}
                onChange={e => setEventTag(e.target.value)}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
              >
                {INDIAN_EVENT_TAGS.map(ev => (
                  <option key={ev.key} value={ev.key}>{ev.label}</option>
                ))}
              </select>
            </div>

            {/* Hesitation Notes */}
            <div>
              <label htmlFor="missed-notes" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                WHY DID YOU MISS OR HESITATE ON THIS SETUP?
              </label>
              <textarea
                id="missed-notes"
                name="notes"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Scared of gap-up, second-guessed the 5m confirmation..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  fontSize: 12.5,
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Chart Screenshot with HTML5 Canvas Auto-Compression */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                  CHART SCREENSHOT
                </label>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Auto-compressed (1200px / JPEG 72%)
                </span>
              </div>

              {screenshotUrl ? (
                <div style={{
                  position: 'relative',
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}>
                  <img
                    src={screenshotUrl}
                    alt="Chart preview"
                    style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                    onClick={() => setPreviewImage(screenshotUrl)}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Screenshot Attached
                    </div>
                    <div style={{ fontSize: 10, color: '#10b981', marginTop: 2 }}>
                      ✓ High-res compressed to local storage
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScreenshotUrl('')}
                    title="Remove Screenshot"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: 6
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ) : (
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px dashed color-mix(in srgb, var(--border-color) 45%, transparent)',
                  background: 'var(--bg-surface)',
                  cursor: isCompressing ? 'wait' : 'pointer',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  transition: 'background 0.15s'
                }}>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isCompressing}
                    onChange={handleScreenshotFile}
                    style={{ display: 'none' }}
                  />
                  {isCompressing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Compressing screenshot...</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon size={14} />
                      <span>Upload Chart Image / Screenshot</span>
                    </>
                  )}
                </label>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateMissed}
                style={{
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
                  background: 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 550,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 12%, var(--bg-surface))'}
                onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))'}
              >
                Log Missed Trade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Preview Lightbox Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.82)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            cursor: 'zoom-out'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <img
              src={previewImage}
              alt="Chart Screenshot"
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8, border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
            />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: -12,
                right: -12,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '50%',
                color: 'var(--text-primary)',
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
