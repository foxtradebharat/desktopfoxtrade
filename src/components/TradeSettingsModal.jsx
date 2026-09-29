import React, { useEffect } from 'react';
import { 
  X, RotateCcw, SlidersHorizontal, Globe, BookOpen, LayoutGrid, Scale, CheckCircle2, Circle 
} from 'lucide-react';

export default function TradeSettingsModal({
  isOpen,
  onClose,
  settings = {},
  onUpdateSetting
}) {
  const tradingMarket = settings.tradingMarket || 'india';
  const columnTerminology = settings.columnTerminology || 'pyramidExit';
  const costBasisMethod = settings.costBasisMethod || 'fifo';

  // Journal Display toggles with sensible defaults matching Nexus
  const statsInHoldings = settings.statsInHoldings !== false;
  const statsInBrokers = settings.statsInBrokers === true;
  const tradeReviewIndicators = settings.tradeReviewIndicators === true;
  const columnReorderHandles = settings.columnReorderHandles !== false;
  const bulkTradeActions = settings.bulkTradeActions === true;

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleResetDefaults = () => {
    if (onUpdateSetting) {
      onUpdateSetting('tradingMarket', 'india');
      onUpdateSetting('columnTerminology', 'pyramidExit');
      onUpdateSetting('costBasisMethod', 'fifo');
      onUpdateSetting('statsInHoldings', true);
      onUpdateSetting('statsInBrokers', false);
      onUpdateSetting('tradeReviewIndicators', false);
      onUpdateSetting('columnReorderHandles', true);
      onUpdateSetting('bulkTradeActions', false);
    }
  };

  const toggleSetting = (key, currentVal) => {
    if (onUpdateSetting) {
      onUpdateSetting(key, !currentVal);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(6px)',
        padding: '16px'
      }}
      onClick={onClose}
    >
      {/* Modal Card Container */}
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '88vh',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '24px',
          border: '1px solid var(--border-color, #e5e7eb)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          color: 'var(--text-primary, #111827)',
          animation: 'modernDropdownFadeIn 0.15s ease-out',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Right Controls: Reset to default button + Close X */}
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 10
        }}>
          {/* Small button with reverse icon: Reset to default */}
          <button
            type="button"
            onClick={handleResetDefaults}
            title="Reset to default"
            aria-label="Reset to default"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              fontSize: '11.5px',
              fontWeight: 600,
              color: 'var(--text-secondary, #4b5563)',
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)';
              e.currentTarget.style.color = 'var(--text-primary, #111827)';
              e.currentTarget.style.borderColor = 'var(--border-color, #d1d5db)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
              e.currentTarget.style.color = 'var(--text-secondary, #4b5563)';
              e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface, #e5e7eb)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)';
            }}
          >
            <RotateCcw size={12} strokeWidth={2.2} />
            <span>Reset to default</span>
          </button>

          {/* Close Button X */}
          <button
            onClick={onClose}
            aria-label="Close Trade Settings"
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              borderRadius: '50%',
              cursor: 'pointer',
              color: 'var(--text-muted, #6b7280)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)';
              e.currentTarget.style.color = 'var(--text-primary, #111827)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted, #6b7280)';
            }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* ── Fixed Header ────────────────────────────────────────────── */}
        <div style={{
          padding: '24px 28px 16px 28px',
          borderBottom: '1px solid var(--border-color, #f0f0f2)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          flexShrink: 0
        }}>
          {/* Rounded square badge with SlidersHorizontal icon */}
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-surface, #f4f4f5)',
            border: '1px solid var(--border-color, #e4e4e7)',
            boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary, #18181b)',
            userSelect: 'none',
            flexShrink: 0
          }}>
            <SlidersHorizontal size={18} strokeWidth={2} />
          </div>

          <div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-primary, #111827)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}>
              Trade Settings
            </h2>
            <p style={{
              fontSize: '12.5px',
              color: 'var(--text-secondary, #6b7280)',
              margin: '3px 0 0 0',
              fontWeight: 400
            }}>
              Configure execution market, journal display &amp; nomenclature
            </p>
          </div>
        </div>

        {/* ── Scrollable Body Area ────────────────────────────────────── */}
        <div style={{
          padding: '20px 28px 28px 28px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* ── 1. Trading Market Section (Exact Match to Nexus Screenshot) ─ */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface, #f4f4f5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary, #18181b)'
              }}>
                <Globe size={15} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                  Trading Market
                </div>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary, #6b7280)', margin: '0 0 12px 0', paddingLeft: '38px' }}>
              Set the market, quote source, and currency context for this portfolio
            </p>

            {/* India vs US 2-Card Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* India Card */}
              <div
                onClick={() => onUpdateSetting && onUpdateSetting('tradingMarket', 'india')}
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: tradingMarket === 'india' ? '1.5px solid var(--text-primary, #111827)' : '1px solid var(--border-color, #e5e7eb)',
                  backgroundColor: tradingMarket === 'india' ? 'var(--bg-primary, #f9fafb)' : 'var(--bg-card, #ffffff)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                  boxShadow: tradingMarket === 'india' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (tradingMarket !== 'india') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)';
                    e.currentTarget.style.borderColor = 'var(--border-color, #d1d5db)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (tradingMarket !== 'india') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
                    e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 7px', borderRadius: '6px', backgroundColor: 'var(--bg-surface, #f3f4f6)', color: 'var(--text-primary, #374151)' }}>IN</span>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>India</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary, #6b7280)', marginTop: '1px' }}>NSE/BSE (Rupee)</div>
                  </div>
                </div>

                {tradingMarket === 'india' ? (
                  <CheckCircle2 size={18} color="var(--text-primary, #111827)" fill="var(--text-primary, #111827)" stroke="var(--bg-card, #ffffff)" />
                ) : (
                  <Circle size={18} color="var(--border-color, #d1d5db)" />
                )}
              </div>

              {/* United States Card */}
              <div
                onClick={() => onUpdateSetting && onUpdateSetting('tradingMarket', 'us')}
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: tradingMarket === 'us' ? '1.5px solid var(--text-primary, #111827)' : '1px solid var(--border-color, #e5e7eb)',
                  backgroundColor: tradingMarket === 'us' ? 'var(--bg-primary, #f9fafb)' : 'var(--bg-card, #ffffff)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                  boxShadow: tradingMarket === 'us' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (tradingMarket !== 'us') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)';
                    e.currentTarget.style.borderColor = 'var(--border-color, #d1d5db)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (tradingMarket !== 'us') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
                    e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 7px', borderRadius: '6px', backgroundColor: 'var(--bg-surface, #f3f4f6)', color: 'var(--text-primary, #374151)' }}>US</span>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>United States</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary, #6b7280)', marginTop: '1px' }}>NASDAQ/NYSE ($)</div>
                  </div>
                </div>

                {tradingMarket === 'us' ? (
                  <CheckCircle2 size={18} color="var(--text-primary, #111827)" fill="var(--text-primary, #111827)" stroke="var(--bg-card, #ffffff)" />
                ) : (
                  <Circle size={18} color="var(--border-color, #d1d5db)" />
                )}
              </div>
            </div>
          </div>

          {/* ── 2. Journal Display Section (5 Toggles Matching Nexus 1:1) ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface, #f4f4f5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary, #18181b)'
              }}>
                <BookOpen size={15} strokeWidth={2} />
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                Journal Display
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary, #6b7280)', margin: '0 0 12px 0', paddingLeft: '38px' }}>
              Choose the controls and summaries shown around the trade journal
            </p>

            {/* Card Container with Toggles */}
            <div style={{
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '16px',
              padding: '8px 18px',
              backgroundColor: 'var(--bg-card, #ffffff)'
            }}>
              {[
                {
                  id: 'statsInHoldings',
                  title: 'Stats in Holdings',
                  desc: 'Show journal statistics above active portfolio holdings',
                  val: statsInHoldings
                },
                {
                  id: 'statsInBrokers',
                  title: 'Stats in Brokers',
                  desc: 'Show journal statistics above broker summaries',
                  val: statsInBrokers
                },
                {
                  id: 'tradeReviewIndicators',
                  title: 'Trade Review Indicators',
                  desc: 'Show note and chart review status beside trade numbers',
                  val: tradeReviewIndicators
                },
                {
                  id: 'columnReorderHandles',
                  title: 'Column Reorder Handles',
                  desc: 'Show drag handles in table headers for column reordering',
                  val: columnReorderHandles
                },
                {
                  id: 'bulkTradeActions',
                  title: 'Bulk Trade Actions',
                  desc: 'Show trade selectors for batch updates and deletions',
                  val: bulkTradeActions
                }
              ].map((item, idx, arr) => (
                <React.Fragment key={item.id}>
                  <div
                    onClick={() => toggleSetting(item.id, item.val)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 0',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ paddingRight: '16px' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary, #6b7280)', marginTop: '2px', lineHeight: 1.4 }}>
                        {item.desc}
                      </div>
                    </div>

                    {/* Modern Monochrome Toggle Switch (Black when ON, Gray when OFF) */}
                    <div
                      style={{
                        width: '38px',
                        height: '22px',
                        borderRadius: '9999px',
                        backgroundColor: item.val ? 'var(--text-primary, #111827)' : 'var(--border-color, #e5e7eb)',
                        position: 'relative',
                        transition: 'background-color 0.2s ease',
                        flexShrink: 0
                      }}
                    >
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          position: 'absolute',
                          top: '2px',
                          left: '2px',
                          transform: item.val ? 'translateX(16px)' : 'translateX(0px)',
                          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                        }}
                      />
                    </div>
                  </div>
                  {idx < arr.length - 1 && (
                    <div style={{ height: '1px', backgroundColor: 'var(--border-color, #f0f0f2)' }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* ── 3. Grid Terminology Section ───────────────────────────── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface, #f4f4f5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary, #18181b)'
              }}>
                <LayoutGrid size={15} strokeWidth={2} />
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                Grid Terminology
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary, #6b7280)', margin: '0 0 12px 0', paddingLeft: '38px' }}>
              Choose your preferred trading nomenclature across the journal
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                type="button"
                onClick={() => onUpdateSetting && onUpdateSetting('columnTerminology', 'pyramidExit')}
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: columnTerminology === 'pyramidExit' ? '1.5px solid var(--text-primary, #111827)' : '1px solid var(--border-color, #e5e7eb)',
                  backgroundColor: columnTerminology === 'pyramidExit' ? 'var(--bg-primary, #f9fafb)' : 'var(--bg-card, #ffffff)',
                  color: 'var(--text-primary, #111827)',
                  fontSize: '12px',
                  fontWeight: columnTerminology === 'pyramidExit' ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: columnTerminology === 'pyramidExit' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (columnTerminology !== 'pyramidExit') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)';
                    e.currentTarget.style.borderColor = 'var(--border-color, #d1d5db)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (columnTerminology !== 'pyramidExit') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
                    e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
                  }
                }}
              >
                Pyramid &amp; Exit (P1, P2 / E1, E2)
              </button>

              <button
                type="button"
                onClick={() => onUpdateSetting && onUpdateSetting('columnTerminology', 'buySell')}
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: columnTerminology === 'buySell' ? '1.5px solid var(--text-primary, #111827)' : '1px solid var(--border-color, #e5e7eb)',
                  backgroundColor: columnTerminology === 'buySell' ? 'var(--bg-primary, #f9fafb)' : 'var(--bg-card, #ffffff)',
                  color: 'var(--text-primary, #111827)',
                  fontSize: '12px',
                  fontWeight: columnTerminology === 'buySell' ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: columnTerminology === 'buySell' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (columnTerminology !== 'buySell') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)';
                    e.currentTarget.style.borderColor = 'var(--border-color, #d1d5db)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (columnTerminology !== 'buySell') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
                    e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
                  }
                }}
              >
                Buy &amp; Sell (B1, B2 / S1, S2)
              </button>
            </div>
          </div>

          {/* ── 4. Cost Basis Method Section ──────────────────────────── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface, #f4f4f5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary, #18181b)'
              }}>
                <Scale size={15} strokeWidth={2} />
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                Cost Basis Method
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary, #6b7280)', margin: '0 0 12px 0', paddingLeft: '38px' }}>
              Determines how partial exits match against entry lots in profit calculations
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                type="button"
                onClick={() => onUpdateSetting && onUpdateSetting('costBasisMethod', 'fifo')}
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: costBasisMethod === 'fifo' ? '1.5px solid var(--text-primary, #111827)' : '1px solid var(--border-color, #e5e7eb)',
                  backgroundColor: costBasisMethod === 'fifo' ? 'var(--bg-primary, #f9fafb)' : 'var(--bg-card, #ffffff)',
                  color: 'var(--text-primary, #111827)',
                  fontSize: '12px',
                  fontWeight: costBasisMethod === 'fifo' ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: costBasisMethod === 'fifo' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (costBasisMethod !== 'fifo') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)';
                    e.currentTarget.style.borderColor = 'var(--border-color, #d1d5db)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (costBasisMethod !== 'fifo') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
                    e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
                  }
                }}
              >
                FIFO (First In, First Out)
              </button>

              <button
                type="button"
                onClick={() => onUpdateSetting && onUpdateSetting('costBasisMethod', 'lifo')}
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: costBasisMethod === 'lifo' ? '1.5px solid var(--text-primary, #111827)' : '1px solid var(--border-color, #e5e7eb)',
                  backgroundColor: costBasisMethod === 'lifo' ? 'var(--bg-primary, #f9fafb)' : 'var(--bg-card, #ffffff)',
                  color: 'var(--text-primary, #111827)',
                  fontSize: '12px',
                  fontWeight: costBasisMethod === 'lifo' ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: costBasisMethod === 'lifo' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (costBasisMethod !== 'lifo') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)';
                    e.currentTarget.style.borderColor = 'var(--border-color, #d1d5db)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (costBasisMethod !== 'lifo') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
                    e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
                  }
                }}
              >
                LIFO (Last In, First Out)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
