import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Info, ShieldAlert } from 'lucide-react';
import BrokerLogo from './BrokerLogo';
import { getBrokerDisplayName } from '../services/brokerLogos';

/**
 * TradeChargesPopover Component
 * 
 * Displays an "i" button next to a trade's charges.
 * Hovering (or clicking) renders a rich portal popover detailing
 * every individual charge (Brokerage, STT, Exchange fee, GST, SEBI, Stamp Duty)
 * and the total charges for that specific trade.
 */
export default function TradeChargesPopover({
  trade = {},
  charges = null,
  hideValues = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [popPos, setPopPos] = useState({ top: 0, left: 0, popUpwards: false });
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const closeTimerRef = useRef(null);

  const hasCharges = Boolean(charges && charges.hasCharges && charges.total > 0);
  const brokerName = getBrokerDisplayName(trade.broker);
  const isIntra = (trade.segment || '').toLowerCase() === 'intraday';

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popWidth = 260;
    const popHeight = hasCharges ? 250 : 130;

    // Check vertical space: pop upwards if too close to bottom
    const spaceBelow = window.innerHeight - rect.bottom;
    const popUpwards = spaceBelow < popHeight && rect.top > popHeight;

    // Position aligned to right of button, bounded within screen
    let left = rect.right - popWidth;
    if (left < 10) left = 10;
    if (left + popWidth > window.innerWidth - 10) {
      left = window.innerWidth - popWidth - 10;
    }

    const top = popUpwards ? rect.top - 6 : rect.bottom + 6;

    setPopPos({ top, left, popUpwards });
  }, [hasCharges]);

  const handleMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    updatePosition();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 120);
  };

  const handlePopoverEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handlePopoverLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 120);
  };

  // Close on outside scroll or resize
  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => {
      updatePosition();
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const fmtCurrency = (val) => {
    if (hideValues) return '••••';
    const num = parseFloat(val) || 0;
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const rows = hasCharges ? [
    { label: 'Brokerage', value: charges.brokerage },
    { label: 'STT / CTT', value: charges.stt },
    { label: 'Exchange Txn Fee', value: charges.exchangeFee },
    { label: 'GST on Brokerage', value: charges.gst },
    { label: 'SEBI Charges', value: charges.sebi },
    { label: 'Stamp Duty', value: charges.stampDuty },
  ] : [];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={(e) => {
          handleMouseEnter();
          e.currentTarget.style.backgroundColor = '#f3f4f6';
          e.currentTarget.style.color = '#111827';
        }}
        onMouseLeave={(e) => {
          handleMouseLeave();
          e.currentTarget.style.backgroundColor = isOpen ? '#f3f4f6' : 'transparent';
          e.currentTarget.style.color = isOpen ? '#111827' : '#9ca3af';
        }}
        onClick={(e) => {
          e.stopPropagation();
          updatePosition();
          setIsOpen((prev) => !prev);
        }}
        aria-label="View trade charges breakdown"
        title="View charges breakdown"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: isOpen ? 'var(--bg-surface, #f3f4f6)' : 'transparent',
          color: isOpen ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
          cursor: 'pointer',
          padding: 0,
          marginLeft: '2px',
          transition: 'all 0.15s ease',
          flexShrink: 0,
          userSelect: 'none'
        }}
      >
        <Info size={12} strokeWidth={2} />
      </button>

      {isOpen &&
        ReactDOM.createPortal(
          <div
            ref={popoverRef}
            onMouseEnter={handlePopoverEnter}
            onMouseLeave={handlePopoverLeave}
            style={{
              position: 'fixed',
              top: popPos.popUpwards ? 'auto' : `${popPos.top}px`,
              bottom: popPos.popUpwards ? `${window.innerHeight - popPos.top}px` : 'auto',
              left: `${popPos.left}px`,
              width: '260px',
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, rgba(0, 0, 0, 0.10))',
              borderRadius: '12px',
              boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.4), 0 4px 8px -2px rgba(0, 0, 0, 0.2)',
              zIndex: 99999,
              padding: '12px 14px',
              boxSizing: 'border-box',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              animation: 'tradeChargeIn 0.12s ease forwards'
            }}
          >
            {/* Header: Broker Logo + Broker Name + Segment */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--border-color, #f3f4f6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BrokerLogo broker={trade.broker} size={15} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                  {trade.broker && trade.broker !== 'not_defined' ? brokerName : 'No Broker'}
                </span>
                {trade.segment && (
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '3px',
                      backgroundColor: isIntra ? 'rgba(245, 158, 11, 0.1)' : 'rgba(99, 102, 241, 0.08)',
                      color: isIntra ? '#d97706' : '#4f46e5',
                      letterSpacing: '0.02em'
                    }}
                  >
                    {isIntra ? 'INTRA' : 'DEL'}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted, #9ca3af)', fontWeight: 600 }}>
                {trade.name || trade.symbol || ''}
              </span>
            </div>

            {/* Breakdown Content */}
            {hasCharges ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4.5px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
                  Charges Breakdown
                </div>

                {rows.map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11.5px',
                      lineHeight: '1.4'
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary, #4b5563)' }}>{label}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
                      {fmtCurrency(value)}
                    </span>
                  </div>
                ))}

                {/* Total Charges summary row */}
                <div style={{ borderTop: '1px dashed var(--border-color, #e5e7eb)', marginTop: '6px', paddingTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>Total Charges</span>
                  <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                    -{fmtCurrency(charges.total)}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ padding: '6px 2px 2px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309' }}>
                  <ShieldAlert size={14} />
                  <span style={{ fontSize: '11.5px', fontWeight: 700 }}>No Broker Assigned</span>
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary, #6b7280)', lineHeight: 1.45 }}>
                  Select a broker in the Journal table to automatically calculate exact STT, GST, SEBI, and brokerage charges.
                </p>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
