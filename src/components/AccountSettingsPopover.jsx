import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { 
  Sparkles, 
  Link2, 
  Monitor, 
  SlidersHorizontal,
  Trash2,
  LogOut
} from 'lucide-react';

export default function AccountSettingsPopover({
  isOpen,
  onClose,
  anchorRef,
  user,
  isDemo = false,
  onGoogleLogin,
  onOpenBrokerConnections,
  onOpenDisplaySettings,
  onOpenTradeSettings,
  onClearAllData,
  onLogout
}) {
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const popoverRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!anchorRef || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.top - 8,
      right: Math.max(8, window.innerWidth - rect.right)
    });
  }, [anchorRef]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    // Small delay to ensure the opening click/pointerdown event does not immediately close the popover
    const timerId = setTimeout(() => {
      const handleOutsideClick = (e) => {
        const isInsidePopover = popoverRef.current && popoverRef.current.contains(e.target);
        const isInsideAnchor = anchorRef.current && anchorRef.current.contains(e.target);

        if (!isInsidePopover && !isInsideAnchor) {
          onClose();
        }
      };

      const handleResizeOrScroll = () => {
        if (isOpen) updatePosition();
      };

      document.addEventListener('pointerdown', handleOutsideClick);
      window.addEventListener('resize', handleResizeOrScroll);
      window.addEventListener('scroll', handleResizeOrScroll, true);

      return () => {
        document.removeEventListener('pointerdown', handleOutsideClick);
        window.removeEventListener('resize', handleResizeOrScroll);
        window.removeEventListener('scroll', handleResizeOrScroll, true);
      };
    }, 10);

    return () => clearTimeout(timerId);
  }, [isOpen, onClose, anchorRef, updatePosition]);

  if (!isOpen) return null;

  const userEmail = (user && user.email) ? user.email : 'Logged In Trader';

  const popoverContent = (
    <div style={{ position: 'relative', zIndex: 999999 }}>
      {/* ── MAIN POPOVER ──────────────────────────────────────────────────── */}
      <div
        ref={popoverRef}
        style={{
          position: 'fixed',
          top: `${menuPos.top}px`,
          right: `${menuPos.right}px`,
          transform: 'translateY(-100%)',
          zIndex: 999999,
          width: '240px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          color: 'var(--text-primary, #111827)',
          borderRadius: '12px',
          border: '1px solid var(--border-color, rgba(0, 0, 0, 0.12))',
          boxShadow: '0 16px 48px -12px rgba(0, 0, 0, 0.25), 0 4px 16px rgba(0, 0, 0, 0.06)',
          padding: '6px',
          animation: 'modernDropdownFadeIn 0.15s ease-out',
          userSelect: 'none'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: MY ACCOUNT */}
        <div style={{ padding: '8px 10px 6px 10px' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #9ca3af)' }}>
            My Account
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '3px', gap: '8px' }}>
            <div 
              style={{ 
                fontSize: '11.5px', 
                color: 'var(--text-secondary, #4b5563)', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                flex: 1
              }} 
              title={userEmail}
            >
              {userEmail}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                if (onLogout) onLogout();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 7px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
                backgroundColor: 'var(--bg-surface, rgba(0,0,0,0.03))',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-secondary, #4b5563)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fef2f2';
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface, rgba(0,0,0,0.03))';
                e.currentTarget.style.color = 'var(--text-secondary, #4b5563)';
                e.currentTarget.style.borderColor = 'var(--border-color, rgba(0,0,0,0.08))';
              }}
              title="Sign out of FoxTrade"
            >
              <LogOut size={11} strokeWidth={2} />
              <span>Sign out</span>
            </button>
          </div>
        </div>

        {/* Free Plan / Upgrade */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 10px',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-surface, rgba(0,0,0,0.04))';
          }}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            alert('Pro Plan upgrade coming soon!');
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
            <Sparkles size={14} color="var(--text-muted, #6b7280)" />
            <span>Free Plan</span>
          </div>
          <span style={{ fontSize: '10.5px', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>
            Upgrade →
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: 'var(--border-color, rgba(0,0,0,0.06))', margin: '4px 0' }} />

        {/* Broker Connections */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 10px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-surface, rgba(0,0,0,0.04))';
          }}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            onOpenBrokerConnections();
          }}
        >
          <Link2 size={15} color="var(--text-muted, #6b7280)" />
          <span>Broker Connections</span>
        </div>

        {/* Display Settings */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 10px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-surface, rgba(0,0,0,0.04))';
          }}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            onOpenDisplaySettings();
          }}
        >
          <Monitor size={15} color="var(--text-muted, #6b7280)" />
          <span>Display Settings</span>
        </div>

        {/* Trade Settings */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 10px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-surface, rgba(0,0,0,0.04))';
          }}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            if (onOpenTradeSettings) onOpenTradeSettings();
          }}
        >
          <SlidersHorizontal size={15} color="var(--text-muted, #6b7280)" />
          <span>Trade Settings</span>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: 'var(--border-color, rgba(0,0,0,0.06))', margin: '4px 0' }} />

        {/* Clear All Data */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 10px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            color: '#ef4444',
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
          }}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            onClearAllData();
          }}
        >
          <Trash2 size={15} color="#ef4444" />
          <span>Clear All Data</span>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(popoverContent, document.body);
}
