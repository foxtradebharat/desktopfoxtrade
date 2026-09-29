import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

/**
 * Modern floating Tooltip with White Theme, Adaptive Sizing & Interactive Hover Bridge
 * Dynamically avoids browser top clipping by placing headers below and table rows above.
 */
export default function Tooltip({
  content,
  children,
  maxWidth = 340,
  className = ''
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [layout, setLayout] = useState({ top: 0, left: 0, placement: 'bottom' });
  const triggerRef = useRef(null);
  const cardRef = useRef(null);
  const closeTimerRef = useRef(null);

  const calculateLayout = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    
    // If trigger is in the upper area of the viewport (e.g. table headers at ~146px),
    // open below to guarantee 100% visibility of all multi-paragraph text without clipping.
    // For rows lower down (y >= 210px), open above.
    const fitsAbove = rect.top >= 215;
    const placement = fitsAbove ? 'top' : 'bottom';

    let top = placement === 'top' ? rect.top - 8 : rect.bottom + 8;
    let left = rect.left + rect.width / 2;

    // Viewport horizontal boundary clamp
    const halfWidth = maxWidth / 2;
    if (left - halfWidth < 12) left = halfWidth + 12;
    if (left + halfWidth > window.innerWidth - 12) left = window.innerWidth - halfWidth - 12;

    setLayout({ top, left, placement });
  };

  const handleTriggerEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    calculateLayout();
    setIsVisible(true);
  };

  const handleTriggerLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 180);
  };

  const handleCardEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsVisible(true);
  };

  const handleCardLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 180);
  };

  useEffect(() => {
    if (isVisible) {
      const handleScroll = () => calculateLayout();
      window.addEventListener('scroll', handleScroll, true);
      return () => window.removeEventListener('scroll', handleScroll, true);
    }
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  if (!content) return <>{children}</>;

  const isTop = layout.placement === 'top';

  const tooltipElement = isVisible ? (
    <div
      ref={cardRef}
      onMouseEnter={handleCardEnter}
      onMouseLeave={handleCardLeave}
      onMouseOver={handleCardEnter}
      onMouseOut={handleCardLeave}
      style={{
        position: 'fixed',
        top: layout.top,
        left: layout.left,
        transform: isTop ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        backgroundColor: '#ffffff',
        color: '#111827',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: '11px',
        fontWeight: 500,
        lineHeight: 1.45,
        width: 'max-content',
        maxWidth: `${maxWidth}px`,
        whiteSpace: 'pre-line',
        textAlign: 'left',
        boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.14), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        zIndex: 999999,
        pointerEvents: 'auto',
        animation: 'nexusTooltipPop 0.14s ease-out',
        cursor: 'default',
        userSelect: 'text'
      }}
    >
      {content}

      {/* Outer Border Arrow */}
      <div
        style={{
          position: 'absolute',
          top: isTop ? '100%' : 'auto',
          bottom: isTop ? 'auto' : '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          borderWidth: '5px',
          borderStyle: 'solid',
          borderColor: isTop
            ? '#e5e7eb transparent transparent transparent'
            : 'transparent transparent #e5e7eb transparent',
          zIndex: 1
        }}
      />

      {/* Inner Fill Arrow */}
      <div
        style={{
          position: 'absolute',
          top: isTop ? 'calc(100% - 1.5px)' : 'auto',
          bottom: isTop ? 'auto' : 'calc(100% - 1.5px)',
          left: '50%',
          transform: 'translateX(-50%)',
          borderWidth: '5px',
          borderStyle: 'solid',
          borderColor: isTop
            ? '#ffffff transparent transparent transparent'
            : 'transparent transparent #ffffff transparent',
          zIndex: 2
        }}
      />
    </div>
  ) : null;

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleTriggerEnter}
      onMouseLeave={handleTriggerLeave}
      onMouseOver={handleTriggerEnter}
      onMouseOut={handleTriggerLeave}
      className={`nexus-tooltip-wrapper ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'help'
      }}
    >
      {children}
      {typeof document !== 'undefined' && tooltipElement && ReactDOM.createPortal(tooltipElement, document.body)}
    </div>
  );
}
