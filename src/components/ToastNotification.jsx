import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function ToastNotification({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast?.id]);

  if (!toast) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: '72px',
        right: '24px',
        zIndex: 9999999,
        pointerEvents: 'auto'
      }}
    >
      <div
        style={{
          width: '356px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          color: 'var(--text-primary, #111827)',
          border: '1px solid var(--border-color, rgba(0, 0, 0, 0.12))',
          borderRadius: '14px',
          boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.05)',
          padding: '14px 16px',
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close toast"
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            color: 'var(--text-muted, #9ca3af)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary, #111827)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #9ca3af)'}
        >
          <X size={13} />
        </button>

        {/* Status Icon based on type */}
        <div style={{ 
          flexShrink: 0, 
          marginTop: '1px', 
          color: toast.type === 'warning' ? '#f59e0b' : toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : 'var(--text-primary, #111827)' 
        }}>
          {toast.type === 'warning' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) : toast.type === 'error' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          ) : toast.type === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" height="18" width="18">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
          )}
        </div>

        {/* Text Content */}
        <div style={{ flex: 1, paddingRight: '12px' }}>
          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary, #111827)', letterSpacing: '-0.01em' }}>
            {toast.title}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted, #6b7280)', marginTop: '3px', lineHeight: '1.4' }}>
            {toast.description || toast.message}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
