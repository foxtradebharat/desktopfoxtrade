import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { 
  TrendingUp, 
  AlertCircle, 
  Sparkles, 
  Info, 
  ShieldAlert, 
  BellRing,
  X
} from 'lucide-react';
import { notificationManager } from '../services/notificationManager';

export default function NotificationDropBanner() {
  const [currentNotif, setCurrentNotif] = useState(null);
  const [animStage, setAnimStage] = useState('idle'); // 'idle' | 'dropped' | 'absorbing'
  const [transformStyle, setTransformStyle] = useState({});
  const bannerRef = useRef(null);
  const isHoveredRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Listen for new banner requests from notificationManager
    const unsubscribe = notificationManager.onBannerRequest((notif) => {
      setCurrentNotif(notif);
      setAnimStage('idle');
      setTransformStyle({
        transform: 'translateX(-50%) translateY(-140%) scale(0.95)',
        opacity: 0
      });

      // Step 1: Slide down from top immediately (Spring Drop)
      requestAnimationFrame(() => {
        setTimeout(() => {
          setAnimStage('dropped');
          setTransformStyle({
            transform: 'translateX(-50%) translateY(18px) scale(1)',
            opacity: 1,
            transition: 'transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.25), opacity 0.3s ease'
          });

          // Step 2: Hold visible for ~1.3s, then initiate Genie Suction
          scheduleSuction(notif);
        }, 30);
      });
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const scheduleSuction = (notif) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      if (isHoveredRef.current) {
        // User is reading/hovering; wait until they unhover
        return;
      }
      triggerGenieSuction(notif);
    }, 1800);
  };

  const triggerGenieSuction = (notif) => {
    if (!bannerRef.current) {
      finalize(notif);
      return;
    }

    setAnimStage('absorbing');

    // Locate TopBar Bell icon element in DOM
    const bellBtn = document.getElementById('topbar-bell-btn');
    let deltaX = 380; // default trajectory fallback towards top-right
    let deltaY = -10;

    if (bellBtn) {
      const bellRect = bellBtn.getBoundingClientRect();
      const bannerRect = bannerRef.current.getBoundingClientRect();

      const bellCenterX = bellRect.left + bellRect.width / 2;
      const bellCenterY = bellRect.top + bellRect.height / 2;

      const bannerCenterX = bannerRect.left + bannerRect.width / 2;
      const bannerCenterY = bannerRect.top + bannerRect.height / 2;

      deltaX = bellCenterX - bannerCenterX;
      deltaY = bellCenterY - bannerCenterY;
    }

    // Step 3: Genie into Aladdin's Lamp Animation
    // Curving acceleration towards the bell, collapsing into a small droplet, scaling to 0.08
    setTransformStyle({
      transform: `translateX(calc(-50% + ${deltaX}px)) translateY(calc(18px + ${deltaY}px)) scale(0.06) rotate(18deg)`,
      opacity: 0,
      borderRadius: '9999px',
      filter: 'blur(2px) brightness(1.3)',
      transition: 'transform 0.62s cubic-bezier(0.55, 0.02, 0.68, 0.18), opacity 0.58s ease-in, border-radius 0.35s ease, filter 0.5s ease'
    });

    // Step 4: When suction finishes, finalize in storage, wobbling bell & incrementing badge
    setTimeout(() => {
      finalize(notif);
    }, 630);
  };

  const finalize = (notif) => {
    notificationManager.finalizeAbsorption(notif);
    setAnimStage('idle');
    setCurrentNotif(null);
    setTransformStyle({});
  };

  const handleMouseEnter = () => {
    isHoveredRef.current = true;
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
    if (animStage === 'dropped' && currentNotif) {
      // Resume suction after leaving
      scheduleSuction(currentNotif);
    }
  };

  const handleDismissImmediately = (e) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    triggerGenieSuction(currentNotif);
  };

  if (!currentNotif || typeof document === 'undefined') return null;

  const getCategoryIcon = (type) => {
    switch (type) {
      case 'sl':
      case 'alert':
        return (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            backgroundColor: 'rgba(239, 68, 68, 0.14)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <ShieldAlert size={18} />
          </div>
        );
      case 'success':
        return (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            backgroundColor: 'rgba(16, 185, 129, 0.14)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <TrendingUp size={18} />
          </div>
        );
      case 'admin':
        return (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            backgroundColor: 'rgba(249, 115, 22, 0.14)',
            color: '#f97316',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <BellRing size={18} />
          </div>
        );
      case 'milestone':
        return (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            backgroundColor: 'rgba(139, 92, 246, 0.14)',
            color: '#8b5cf6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Sparkles size={18} />
          </div>
        );
      default:
        return (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            backgroundColor: 'rgba(59, 130, 246, 0.14)',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Info size={18} />
          </div>
        );
    }
  };

  const bannerContent = (
    <div
      ref={bannerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => {
        if (currentNotif?.action === 'review_flagged' || currentNotif?.id === 'date-issues-alert') {
          window.dispatchEvent(new CustomEvent('foxtrade_open_review_flagged'));
        }
        triggerGenieSuction(currentNotif);
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        zIndex: 999999,
        width: 'min(420px, calc(100vw - 32px))',
        padding: '12px 16px',
        borderRadius: '16px',
        backgroundColor: 'var(--bg-card, #ffffff)',
        color: 'var(--text-primary, #111827)',
        border: '1px solid var(--border-color, rgba(0, 0, 0, 0.15))',
        boxShadow: '0 20px 48px -8px rgba(0, 0, 0, 0.28), 0 6px 18px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer',
        userSelect: 'none',
        pointerEvents: animStage === 'absorbing' ? 'none' : 'auto',
        ...transformStyle
      }}
    >
      {/* Category Icon */}
      {getCategoryIcon(currentNotif.type)}

      {/* Main Copy */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--text-primary, #111827)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {currentNotif.title}
          </div>
          <span style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--text-muted, #9ca3af)',
            flexShrink: 0
          }}>
            {currentNotif.time || 'Just now'}
          </span>
        </div>

        <div style={{
          fontSize: '12px',
          color: 'var(--text-secondary, #4b5563)',
          marginTop: '2px',
          lineHeight: '1.35',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }}>
          {currentNotif.message}
        </div>
      </div>

      {/* Quick close cross */}
      <button
        type="button"
        onClick={handleDismissImmediately}
        title="Dismiss to bell"
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
          opacity: 0.7,
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.7';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <X size={14} />
      </button>
    </div>
  );

  return ReactDOM.createPortal(bannerContent, document.body);
}
