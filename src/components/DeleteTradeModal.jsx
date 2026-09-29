import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Trash2, X } from 'lucide-react';
import SymbolLogo from './SymbolLogo';

export default function DeleteTradeModal({ isOpen, onClose, onConfirm, tradeName, tradeNo }) {
  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'modernModalFadeIn 0.15s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '18px',
          border: '1px solid var(--border-color, #e4e4e7)',
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.04)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close 'X' Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            color: 'var(--text-muted, #a1a1aa)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary, #18181b)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #a1a1aa)'}
        >
          <X size={16} strokeWidth={2} />
        </button>

        {/* Trash Icon Badge */}
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            marginBottom: '14px'
          }}
        >
          <Trash2 size={20} strokeWidth={1.8} />
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '17px',
            fontWeight: 700,
            color: 'var(--text-primary, #18181b)',
            margin: '0 0 6px 0',
            letterSpacing: '-0.02em',
            lineHeight: 1.3
          }}
        >
          Delete Trade
        </h3>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary, #71717a)',
            margin: '0 0 16px 0',
            lineHeight: 1.5
          }}
        >
          Are you sure you want to permanently delete this trade? This action cannot be undone.
        </p>

        {/* Miniature Trade Summary Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-hover, #f4f4f5)',
            border: '1px solid var(--border-color, #e4e4e7)',
            marginBottom: '22px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <SymbolLogo symbol={tradeName} size={22} />
            <span
              style={{
                fontSize: '13.5px',
                fontWeight: 700,
                fontFamily: 'monospace',
                color: 'var(--text-primary, #18181b)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {tradeName || 'Untitled Trade'}
            </span>
          </div>

          {tradeNo && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2.5px 8px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border-color, #e4e4e7)',
                color: 'var(--text-secondary, #71717a)',
                letterSpacing: '0.2px',
                flexShrink: 0
              }}
            >
              Trade #{tradeNo}
            </span>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              height: '38px',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #e4e4e7)',
              backgroundColor: 'transparent',
              color: 'var(--text-primary, #18181b)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(0, 0, 0, 0.04))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              height: '38px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(239, 68, 68, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ef4444';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(239, 68, 68, 0.25)';
            }}
          >
            <Trash2 size={13} strokeWidth={2.2} />
            <span>Delete Trade</span>
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
