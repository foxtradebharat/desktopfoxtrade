import React, { useState, useEffect, useRef } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

export default function ClearAllDataModal({ isOpen, onClose, onConfirm, portfolioName }) {
  const [confirmInput, setConfirmInput] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmInput('');
      setError('');
      setIsSubmitting(false);
      const timer = setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDone = async () => {
    const trimmed = confirmInput.trim();
    if (trimmed.toUpperCase() !== 'DELETE') {
      setError('Please type "DELETE" to confirm.');
      if (inputRef.current) inputRef.current.focus();
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await onConfirm();
    } catch (err) {
      console.error('Clear data error:', err);
      setError(err?.message || 'Failed to clear data');
      setIsSubmitting(false);
    }
  };

  const handleKeyDownInput = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleDone();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          color: 'var(--text-primary, #111827)',
          borderRadius: '20px',
          border: '1px solid var(--border-color, rgba(0, 0, 0, 0.08))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.1)',
          padding: '24px 24px 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          position: 'relative',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Icon Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close dialog"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-muted, #9ca3af)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)';
            e.currentTarget.style.color = 'var(--text-primary, #111827)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted, #9ca3af)';
          }}
        >
          <X size={18} strokeWidth={2} />
        </button>

        {/* Header with Icon */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#dc2626'
            }}
          >
            <Trash2 size={22} color="#dc2626" strokeWidth={2} />
          </div>
          <div style={{ minWidth: 0, paddingRight: '24px' }}>
            <h3
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: 'var(--text-primary, #111827)',
                margin: 0,
                lineHeight: 1.3
              }}
            >
              Clear All Data
            </h3>
            <p
              style={{
                fontSize: '12.5px',
                color: 'var(--text-secondary, #6b7280)',
                margin: '3px 0 0 0',
                lineHeight: 1.4
              }}
            >
              {portfolioName
                ? `This action will reset your "${portfolioName}" data and cannot be undone.`
                : 'This action will reset your workspace data and cannot be undone.'}
            </p>
          </div>
        </div>

        {/* Warning Content Details Box */}
        <div
          style={{
            fontSize: '12.5px',
            color: 'var(--text-secondary, #374151)',
            backgroundColor: 'var(--bg-surface, #f9fafb)',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: '12px',
            padding: '14px 16px',
            lineHeight: 1.55
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-primary, #111827)', marginBottom: '6px' }}>
            This will clear ALL your data including:
          </div>
          <ul
            style={{
              margin: '0 0 8px 0',
              paddingLeft: '20px',
              color: 'var(--text-secondary, #4b5563)',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px'
            }}
          >
            <li>Trading journal</li>
            <li>Tax data</li>
            <li>Fund Management data</li>
            <li>Notes</li>
            <li>Cache and stored images</li>
          </ul>
          <div
            style={{
              fontSize: '11.5px',
              color: 'var(--text-muted, #6b7280)',
              borderTop: '1px solid var(--border-color, #e5e7eb)',
              paddingTop: '8px',
              marginTop: '4px',
              fontStyle: 'italic'
            }}
          >
            Only portfolio structure and broker tokens will be preserved.
          </div>
        </div>

        {/* Input Confirmation Section */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--text-primary, #1f2937)',
              marginBottom: '6px'
            }}
          >
            Type{' '}
            <span
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#dc2626',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '12px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '6px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                letterSpacing: '0.04em'
              }}
            >
              DELETE
            </span>{' '}
            to confirm:
          </label>
          <input
            ref={inputRef}
            type="text"
            value={confirmInput}
            onChange={(e) => {
              setConfirmInput(e.target.value);
              if (error) setError('');
            }}
            onKeyDown={handleKeyDownInput}
            placeholder='Type "DELETE"'
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: error ? '1.5px solid #ef4444' : '1px solid var(--border-color, #d1d5db)',
              backgroundColor: 'var(--bg-card, #ffffff)',
              color: 'var(--text-primary, #111827)',
              fontSize: '13.5px',
              fontWeight: 600,
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxShadow: error
                ? '0 0 0 3px rgba(239, 68, 68, 0.15)'
                : '0 1px 2px rgba(0, 0, 0, 0.04)'
            }}
            onFocus={(e) => {
              if (!error) {
                e.target.style.borderColor = 'var(--text-primary, #111827)';
                e.target.style.boxShadow = '0 0 0 3px rgba(17, 24, 39, 0.08)';
              }
            }}
            onBlur={(e) => {
              if (!error) {
                e.target.style.borderColor = 'var(--border-color, #d1d5db)';
                e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
              }
            }}
          />
          {error && (
            <div
              style={{
                fontSize: '12px',
                color: '#dc2626',
                fontWeight: 600,
                marginTop: '5px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <AlertTriangle size={13} color="#dc2626" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '4px'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #d1d5db)',
              backgroundColor: 'var(--bg-card, #ffffff)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary, #374151)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f9fafb)';
                e.currentTarget.style.borderColor = 'var(--border-hover, #9ca3af)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
                e.currentTarget.style.borderColor = 'var(--border-color, #d1d5db)';
              }
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDone}
            disabled={isSubmitting}
            style={{
              padding: '9px 20px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#dc2626',
              fontSize: '13px',
              fontWeight: 700,
              color: '#ffffff',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isSubmitting ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#b91c1c';
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#dc2626';
            }}
          >
            <Trash2 size={14} color="#ffffff" />
            <span>{isSubmitting ? 'Deleting...' : 'Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
