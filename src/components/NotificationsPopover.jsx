import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { 
  Bell, 
  X, 
  Trash2, 
  CheckCheck, 
  TrendingUp, 
  AlertCircle, 
  Sparkles, 
  Info, 
  ShieldCheck, 
  BellOff, 
  Check,
  Volume2,
  VolumeX,
  ShieldAlert,
  BellRing
} from 'lucide-react';
import { notificationManager } from '../services/notificationManager';
import { notificationSound } from '../services/notificationSoundService';

export default function NotificationsPopover({ isOpen, onClose, anchorRef }) {
  const [notifications, setNotifications] = useState(() => notificationManager.getNotifications());
  const [isMuted, setIsMuted] = useState(() => notificationSound.getMuted());
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const popoverRef = useRef(null);

  // Subscribe to notificationManager updates
  useEffect(() => {
    const unsubscribe = notificationManager.subscribe((list) => {
      setNotifications(list);
    });
    return () => unsubscribe();
  }, []);

  // Position calculation
  const updatePosition = useCallback(() => {
    if (!anchorRef || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + window.scrollY + 8,
      right: window.innerWidth - rect.right - window.scrollX
    });
  }, [anchorRef]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  // Outside click and resize listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    };

    const handleResizeOrScroll = () => {
      if (isOpen) updatePosition();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
    };
  }, [isOpen, onClose, anchorRef, updatePosition]);

  const handleDelete = (id, e) => {
    e.stopPropagation();
    notificationManager.deleteNotification(id);
  };

  const handleClearAll = (e) => {
    e.stopPropagation();
    notificationManager.clearAll();
  };

  const handleMarkAllAsRead = (e) => {
    e.stopPropagation();
    notificationManager.markAllAsRead();
  };

  const handleItemClick = (notif) => {
    const notifId = typeof notif === 'object' ? notif.id : notif;
    notificationManager.markAsRead(notifId);
    if (typeof notif === 'object' && (notif.action === 'review_flagged' || notif.id === 'date-issues-alert')) {
      window.dispatchEvent(new CustomEvent('foxtrade_open_review_flagged'));
      onClose();
    }
  };

  const handleToggleSound = (e) => {
    e.stopPropagation();
    const nextMuted = notificationSound.toggleMute();
    setIsMuted(nextMuted);
  };

  const handleSimulateAlert = (type) => {
    onClose(); // close popover so user can clearly see the top-drop banner & genie suction into bell!
    setTimeout(() => {
      if (type === 'sl') {
        notificationManager.dispatch({
          title: 'Stop Loss Hit: RELIANCE',
          message: 'CMP ₹2,908.40 reached your SL level (₹2,910.00). Position flagged for exit.',
          type: 'sl'
        });
      } else if (type === 'target') {
        notificationManager.dispatch({
          title: 'Target 1 Hit: ASIANPAINT',
          message: 'Reached Target ₹3,140 (+10.20% gain). Consider trailing SL to breakeven.',
          type: 'success'
        });
      } else if (type === 'welcome') {
        notificationManager.dispatch({
          title: 'Welcome to FoxTrade!',
          message: 'Welcome to FoxTrade! Your trading journal is ready. Start logging trades or import your broker contract notes.',
          type: 'admin'
        });
      } else if (type === 'admin') {
        notificationManager.dispatch({
          title: 'FoxTrade Official Update: v2.4 Live',
          message: 'Real-time multi-leg pyramiding and instant sound alerts are now active!',
          type: 'admin'
        });
      }
    }, 150);
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Group notifications by month
  const groupedNotifications = notifications.reduce((acc, notif) => {
    const groupKey = notif.month || 'Recent';
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(notif);
    return acc;
  }, {});

  const getNotifIcon = (type) => {
    switch (type) {
      case 'sl':
        return (
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldAlert size={14} />
          </div>
        );
      case 'success':
        return (
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={14} />
          </div>
        );
      case 'alert':
        return (
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#fff7ed', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={14} />
          </div>
        );
      case 'admin':
        return (
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BellRing size={14} />
          </div>
        );
      case 'milestone':
        return (
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#f5f3ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles size={14} />
          </div>
        );
      default:
        return (
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Info size={14} />
          </div>
        );
    }
  };

  const popoverContent = (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        top: `${menuPos.top}px`,
        right: `${menuPos.right}px`,
        zIndex: 99999,
        width: '360px',
        maxHeight: '540px',
        backgroundColor: 'var(--bg-card, #ffffff)',
        color: 'var(--text-primary, #111827)',
        borderRadius: '16px',
        border: '1px solid var(--border-color, rgba(0,0,0,0.12))',
        boxShadow: '0 20px 48px -10px rgba(0, 0, 0, 0.22), 0 6px 18px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'modernDropdownFadeIn 0.15s ease-out',
        userSelect: 'none'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color, #f3f4f6)',
          backgroundColor: 'var(--bg-surface, #fafafa)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
            Notifications
          </span>
          {unreadCount > 0 && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                backgroundColor: '#ef4444',
                color: '#ffffff',
                padding: '2px 7px',
                borderRadius: '9999px'
              }}
            >
              {unreadCount} new
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Sound Mute / Unmute Toggle */}
          <button
            type="button"
            onClick={handleToggleSound}
            title={isMuted ? "Unmute notification sound" : "Mute notification sound"}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 6px',
              cursor: 'pointer',
              color: isMuted ? '#ef4444' : 'var(--text-secondary, #4b5563)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              title="Mark all as read"
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 6px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#2563eb',
                cursor: 'pointer',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <CheckCheck size={13} />
              <span>Read all</span>
            </button>
          )}

          {/* Close Cross Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: 'var(--text-muted, #9ca3af)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary, #111827)';
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted, #9ca3af)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Quick Test / Simulator Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderBottom: '1px solid var(--border-color, #f3f4f6)',
        overflowX: 'auto'
      }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
          Test Push:
        </span>
        <button
          type="button"
          onClick={() => handleSimulateAlert('sl')}
          title="Simulate Stop Loss Hit alert with warning sound and genie animation"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '9999px',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            backgroundColor: 'rgba(239, 68, 68, 0.06)',
            color: '#ef4444',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          <ShieldAlert size={11} />
          <span>SL Hit</span>
        </button>

        <button
          type="button"
          onClick={() => handleSimulateAlert('target')}
          title="Simulate Target Achieved alert with victory chord"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '9999px',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            backgroundColor: 'rgba(16, 185, 129, 0.06)',
            color: '#10b981',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          <TrendingUp size={11} />
          <span>Target</span>
        </button>

        <button
          type="button"
          onClick={() => handleSimulateAlert('welcome')}
          title="Simulate New User Sign-Up Welcome notification"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '9999px',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            backgroundColor: 'rgba(139, 92, 246, 0.06)',
            color: '#8b5cf6',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          <Sparkles size={11} />
          <span>Welcome</span>
        </button>

        <button
          type="button"
          onClick={() => handleSimulateAlert('admin')}
          title="Simulate FoxTrade Company Announcement"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '9999px',
            border: '1px solid rgba(249, 115, 22, 0.25)',
            backgroundColor: 'rgba(249, 115, 22, 0.06)',
            color: '#f97316',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          <BellRing size={11} />
          <span>Admin</span>
        </button>
      </div>

      {/* Notifications List (Grouped by Month) */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: '360px',
          padding: '6px 0'
        }}
      >
        {notifications.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-muted, #9ca3af)'
            }}
          >
            <BellOff size={28} style={{ opacity: 0.4, marginBottom: '8px' }} />
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #374151)' }}>
              No notifications
            </div>
            <div style={{ fontSize: '11px', marginTop: '3px' }}>
              You're completely up to date!
            </div>
          </div>
        ) : (
          Object.entries(groupedNotifications).map(([monthGroup, items]) => (
            <div key={monthGroup}>
              {/* Month Header */}
              <div
                style={{
                  padding: '8px 16px 4px 16px',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted, #9ca3af)'
                }}
              >
                {monthGroup}
              </div>

              {/* Items in Month */}
              {items.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 16px',
                    position: 'relative',
                    cursor: 'pointer',
                    backgroundColor: notif.read ? 'transparent' : 'rgba(59, 130, 246, 0.03)',
                    transition: 'background-color 0.15s ease',
                    borderBottom: '1px solid var(--border-color, #f9fafb)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = notif.read ? 'transparent' : 'rgba(59, 130, 246, 0.03)'}
                >
                  {/* Category Icon */}
                  {getNotifIcon(notif.type)}

                  {/* Body */}
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: notif.read ? 600 : 700,
                          color: 'var(--text-primary, #111827)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {notif.title}
                      </span>
                      {!notif.read && (
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: '#ef4444',
                            flexShrink: 0
                          }}
                        />
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: '11.5px',
                        color: 'var(--text-secondary, #4b5563)',
                        marginTop: '2px',
                        lineHeight: '1.4'
                      }}
                    >
                      {notif.message}
                    </div>

                    <div
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-muted, #9ca3af)',
                        marginTop: '4px'
                      }}
                    >
                      {notif.time}
                    </div>
                  </div>

                  {/* Individual Dismiss Cross Button */}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(notif.id, e)}
                    title="Dismiss"
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '12px',
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      cursor: 'pointer',
                      color: 'var(--text-muted, #9ca3af)',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.6,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.color = '#ef4444';
                      e.currentTarget.style.backgroundColor = '#fee2e2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.6';
                      e.currentTarget.style.color = 'var(--text-muted, #9ca3af)';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer (Clear all button) */}
      {notifications.length > 0 && (
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-color, #f3f4f6)',
            backgroundColor: 'var(--bg-surface, #fafafa)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>
            {notifications.length} {notifications.length === 1 ? 'notification' : 'notifications'}
          </span>

          <button
            type="button"
            onClick={handleClearAll}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#ef4444',
              cursor: 'pointer',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Trash2 size={12} />
            <span>Clear all</span>
          </button>
        </div>
      )}
    </div>
  );

  return ReactDOM.createPortal(popoverContent, document.body);
}

// Hook or helper to get unread notification count
export function useUnreadNotificationsCount() {
  const [count, setCount] = useState(() => notificationManager.getUnreadCount());

  useEffect(() => {
    const update = () => setCount(notificationManager.getUnreadCount());
    window.addEventListener('storage', update);
    window.addEventListener('tradeontip_notifications_changed', update);
    window.addEventListener('tradeontip_bell_wobble', update);
    const interval = setInterval(update, 1000);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('tradeontip_notifications_changed', update);
      window.removeEventListener('tradeontip_bell_wobble', update);
      clearInterval(interval);
    };
  }, []);

  return count;
}
