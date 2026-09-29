import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';

// Crisp Vector SVGs for Indian & US Flags
export const IndianFlag = ({ size = 16, style = {} }) => (
  <svg viewBox="0 0 60 40" style={{ width: `${size * 1.5}px`, height: `${size}px`, borderRadius: '2px', overflow: 'hidden', flexShrink: 0, boxShadow: '0 0 0 0.5px rgba(0,0,0,0.15)', ...style }}>
    <rect width="60" height="13.33" fill="#FF9933" />
    <rect y="13.33" width="60" height="13.34" fill="#ffffff" />
    <rect y="26.67" width="60" height="13.33" fill="#138808" />
    <circle cx="30" cy="20" r="4" fill="none" stroke="#000080" strokeWidth="0.6" />
    <circle cx="30" cy="20" r="0.8" fill="#000080" />
    {Array.from({ length: 24 }, (_, i) => {
      const n = (i * 15 * Math.PI) / 180;
      return (
        <line
          key={i}
          x1={30 + Math.cos(n) * 0.9}
          y1={20 + Math.sin(n) * 0.9}
          x2={30 + Math.cos(n) * 3.8}
          y2={20 + Math.sin(n) * 3.8}
          stroke="#000080"
          strokeWidth="0.3"
        />
      );
    })}
  </svg>
);

export const UsFlag = ({ size = 16, style = {} }) => (
  <svg viewBox="0 0 60 30" style={{ width: `${size * 1.5}px`, height: `${size}px`, borderRadius: '2px', overflow: 'hidden', flexShrink: 0, boxShadow: '0 0 0 0.5px rgba(0,0,0,0.15)', ...style }}>
    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
      <rect key={i} y={(30 / 13) * i} width="60" height={30 / 13} fill={i % 2 === 0 ? '#B22234' : '#fff'} />
    ))}
    <rect width="24" height={210 / 13} fill="#3C3B6E" />
    {[
      [2.4, 1.6], [7.2, 1.6], [12, 1.6], [16.8, 1.6], [21.6, 1.6],
      [4.8, 3.3], [9.6, 3.3], [14.4, 3.3], [19.2, 3.3],
      [2.4, 5], [7.2, 5], [12, 5], [16.8, 5], [21.6, 5],
      [4.8, 6.7], [9.6, 6.7], [14.4, 6.7], [19.2, 6.7],
      [2.4, 8.4], [7.2, 8.4], [12, 8.4], [16.8, 8.4], [21.6, 8.4],
      [4.8, 10.1], [9.6, 10.1], [14.4, 10.1], [19.2, 10.1],
      [2.4, 11.8], [7.2, 11.8], [12, 11.8], [16.8, 11.8], [21.6, 11.8],
      [4.8, 13.5], [9.6, 13.5], [14.4, 13.5], [19.2, 13.5],
      [2.4, 15.2], [7.2, 15.2], [12, 15.2], [16.8, 15.2], [21.6, 15.2]
    ].map(([x, y], idx) => (
      <circle key={idx} cx={x} cy={y} r="0.6" fill="#fff" />
    ))}
  </svg>
);

export default function MarketSwitcher({ 
  tradingMarket = 'india', 
  onMarketChange 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const isIndia = tradingMarket === 'india';

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (market) => {
    if (onMarketChange) onMarketChange(market);
    try {
      localStorage.setItem('tradeontip_trading_market', market);
      window.dispatchEvent(new CustomEvent('tradeontip_market_changed', { detail: { market } }));
    } catch {}
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {/* Trigger Button Pill Beside 'All Time' */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={isIndia ? 'Trading Market: Indian Equities (Click to switch)' : 'Trading Market: US Equities (Click to switch)'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          height: '28px',
          padding: '0 8px',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-primary, #111827)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f9fafb)';
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.18)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-surface, #ffffff)';
          e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
        }}
      >
        {isIndia ? <IndianFlag size={12} /> : <UsFlag size={12} />}
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2px' }}>
          {isIndia ? 'IN' : 'US'}
        </span>
        <ChevronDown size={11} color="var(--text-muted, #9ca3af)" style={{ transition: 'transform 0.2s ease', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '34px',
            left: 0,
            width: '210px',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 4px 10px -3px rgba(0,0,0,0.05)',
            zIndex: 1000,
            padding: '4px',
            fontSize: '13px',
            color: 'var(--text-primary, #111827)',
            animation: 'dropdownFadeIn 0.15s ease forwards'
          }}
        >
          <div style={{
            padding: '6px 10px 4px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.6px',
            color: 'var(--text-muted, #9ca3af)',
            textTransform: 'uppercase',
            borderBottom: '1px solid var(--border-color, #f3f4f6)',
            marginBottom: '4px'
          }}>
            Trading Market
          </div>

          {/* Option 1: Indian Equities */}
          <div
            data-market-option="india"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect('india'); }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect('india'); }}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: isIndia ? 'rgba(249, 115, 22, 0.08)' : 'transparent',
              color: isIndia ? 'var(--accent-orange, #ea580c)' : 'var(--text-primary, #111827)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              transition: 'background 0.12s ease'
            }}
            onMouseEnter={(e) => {
              if (!isIndia) e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f3f4f6)';
            }}
            onMouseLeave={(e) => {
              if (!isIndia) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IndianFlag size={14} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: isIndia ? 700 : 500, fontSize: '12px' }}>Indian Equities</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted, #6b7280)' }}>NSE & BSE · ₹ INR</span>
              </div>
            </div>
            {isIndia && <Check size={14} color="var(--accent-orange, #ea580c)" />}
          </div>

          {/* Option 2: US Equities */}
          <div
            data-market-option="us"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect('us'); }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect('us'); }}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: !isIndia ? 'rgba(249, 115, 22, 0.08)' : 'transparent',
              color: !isIndia ? 'var(--accent-orange, #ea580c)' : 'var(--text-primary, #111827)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              transition: 'background 0.12s ease'
            }}
            onMouseEnter={(e) => {
              if (isIndia) e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f3f4f6)';
            }}
            onMouseLeave={(e) => {
              if (isIndia) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UsFlag size={14} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: !isIndia ? 700 : 500, fontSize: '12px' }}>US Equities</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted, #6b7280)' }}>NASDAQ & NYSE · $ USD</span>
              </div>
            </div>
            {!isIndia && <Check size={14} color="var(--accent-orange, #ea580c)" />}
          </div>
        </div>
      )}
    </div>
  );
}
