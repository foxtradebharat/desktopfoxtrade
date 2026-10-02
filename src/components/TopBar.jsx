import React, { useState, useEffect, useRef } from 'react';
import { Filter, Users, Bell, Sun, Moon, Sparkles, ChevronRight, Check } from 'lucide-react';
import { MarketTimingService } from '../services/marketTimingService';
import NotificationsPopover, { useUnreadNotificationsCount } from './NotificationsPopover';
import NotificationDropBanner from './NotificationDropBanner';
import PortfolioSwitcher from './PortfolioSwitcher';
import CommunityPopover from './CommunityPopover';

export default function TopBar({ 
  themeMode, 
  setThemeMode, 
  dateRange, 
  setDateRange,
  outcomeFilter,
  setOutcomeFilter,
  tradeTypeFilter,
  setTradeTypeFilter,
  instrumentFilter = 'All Instruments',
  setInstrumentFilter,
  tradingMarket = 'india',
  setTradingMarket,
  activeTab = 'journal',
  trades = [],
  onOpenCommunity,
  portfolios = [],
  activePortfolioId,
  onSelectPortfolio,
  onUpdatePortfolios,
  onOpenCreatePortfolio,
  onShowToast,
  onOpenBrokerConnectivity
}) {
  const [countdownData, setCountdownData] = useState(() => MarketTimingService.getLiveMarketCountdown(tradingMarket));
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notifAnchorRef = useRef(null);
  const [isCommunityOpen, setIsCommunityOpen] = useState(false);
  const communityAnchorRef = useRef(null);
  const unreadNotifCount = useUnreadNotificationsCount();
  const [isMarketDotHovered, setIsMarketDotHovered] = useState(false);

  // Bell ring wobble & badge bump animation states
  const [isBellWobbling, setIsBellWobbling] = useState(false);
  const [isBadgePopping, setIsBadgePopping] = useState(false);

  useEffect(() => {
    const handleBellWobble = () => {
      setIsBellWobbling(true);
      setIsBadgePopping(true);
      setTimeout(() => setIsBellWobbling(false), 550);
      setTimeout(() => setIsBadgePopping(false), 450);
    };

    window.addEventListener('tradeontip_bell_wobble', handleBellWobble);
    return () => window.removeEventListener('tradeontip_bell_wobble', handleBellWobble);
  }, []);

  // Filter dropdown state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState(null); // 'outcome' | 'tradeType' | 'instrument'

  const filterRef = useRef(null);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setIsFilterOpen(false);
        setActiveSubmenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Live Countdown timer (every second) ────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      setCountdownData(MarketTimingService.getLiveMarketCountdown(tradingMarket));
    };

    const id = setInterval(tick, 1000);
    tick();
    return () => clearInterval(id);
  }, [tradingMarket]);

  // Picker state for complex filters
  const [activePicker, setActivePicker] = useState(null); // 'month' | 'custom' | 'lastX' | 'quarter'
  const [pickerMonth, setPickerMonth] = useState(() => new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [pickerFrom, setPickerFrom] = useState('');
  const [pickerTo, setPickerTo] = useState('');
  const [pickerX, setPickerX] = useState('10');
  const [pickerFY, setPickerFY] = useState(() => {
    const yr = new Date().getFullYear();
    return new Date().getMonth() >= 3 ? yr : yr - 1;
  });
  const [pickerQ, setPickerQ] = useState('Q1');

  // Human-readable label for current dateRange
  const dateRangeLabel = (() => {
    if (!dateRange || dateRange === 'All Time') return 'All Time';
    if (typeof dateRange === 'string') return dateRange;
    if (dateRange.type === 'lastX') return `Last ${dateRange.count} Trades`;
    if (dateRange.type === 'month') {
      const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dateRange.month];
      return `${mn} ${dateRange.year}`;
    }
    if (dateRange.type === 'quarter') return `${dateRange.q} FY${dateRange.fy}-${String(dateRange.fy+1).slice(2)}`;
    if (dateRange.from && dateRange.to) return `${dateRange.from} → ${dateRange.to}`;
    return 'All Time';
  })();

  // Cycle 3 Themes: light ➔ dark (slate) ➔ pitch-black (OLED) ➔ light
  const handleCycleTheme = () => {
    if (themeMode === 'light') setThemeMode('dark');
    else if (themeMode === 'dark') setThemeMode('pitch-black');
    else setThemeMode('light');
  };

  return (
    <header style={{
      position: 'relative',
      zIndex: 1100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 24px',
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-color)',
      fontSize: '13px',
      fontWeight: 500,
      transition: 'background-color 0.2s, border-color 0.2s'
    }}>
      {/* Left: Date Range & Category Filter Pill + Market Switcher (Indian & US Flags) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div ref={filterRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Filter Pill Button */}
          <button 
            type="button"
            onClick={() => {
              setIsFilterOpen(!isFilterOpen);
              setActiveSubmenu(null);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '32px',
              padding: '0 14px',
              borderRadius: '9999px',
              backgroundColor: isFilterOpen ? 'var(--bg-hover, rgba(0, 0, 0, 0.07))' : 'rgba(0, 0, 0, 0.04)',
              border: `1px solid ${isFilterOpen ? 'color-mix(in srgb, var(--border-color) 70%, transparent)' : 'color-mix(in srgb, var(--border-color) 45%, transparent)'}`,
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
              userSelect: 'none',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!isFilterOpen) e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(0, 0, 0, 0.07))';
            }}
            onMouseLeave={(e) => {
              if (!isFilterOpen) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
            }}
          >
            <Filter size={13.5} strokeWidth={1.8} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />
            <span>{dateRangeLabel}</span>
            {/* Subtle badge if sub-filters active */}
            {((outcomeFilter && outcomeFilter !== 'All Outcomes' && outcomeFilter !== 'All') ||
              (tradeTypeFilter && tradeTypeFilter !== 'All Types' && tradeTypeFilter !== 'All') ||
              (instrumentFilter && instrumentFilter !== 'All Instruments' && instrumentFilter !== 'All')) && (
              <span style={{
                fontSize: '10.5px',
                fontWeight: 600,
                padding: '0 6px',
                height: '17px',
                borderRadius: '9999px',
                backgroundColor: 'var(--bg-hover)',
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '2px'
              }}>
                +{[
                  (outcomeFilter && outcomeFilter !== 'All Outcomes' && outcomeFilter !== 'All'),
                  (tradeTypeFilter && tradeTypeFilter !== 'All Types' && tradeTypeFilter !== 'All'),
                  (instrumentFilter && instrumentFilter !== 'All Instruments' && instrumentFilter !== 'All')
                ].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* Quick Clear Button when any filter is applied */}
          {((dateRange && dateRange !== 'All Time') ||
            (outcomeFilter && outcomeFilter !== 'All Outcomes' && outcomeFilter !== 'All') ||
            (tradeTypeFilter && tradeTypeFilter !== 'All Types' && tradeTypeFilter !== 'All') ||
            (instrumentFilter && instrumentFilter !== 'All Instruments' && instrumentFilter !== 'All')) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDateRange('All Time');
                setOutcomeFilter(null);
                setTradeTypeFilter(null);
                if (setInstrumentFilter) setInstrumentFilter('All Instruments');
                setActivePicker(null);
                setIsFilterOpen(false);
              }}
              title="Reset all filters to All Time"
              style={{
                height: '24px',
                padding: '0 8px',
                borderRadius: '9999px',
                border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
                backgroundColor: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <span>Clear</span>
            </button>
          )}

          {/* Minimalist Multi-Level Filter Menu */}
          {isFilterOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              width: '205px',
              backgroundColor: 'var(--bg-surface)',
              backdropFilter: 'blur(20px)',
              border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
              borderRadius: '16px',
              boxShadow: '0 16px 40px -12px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.05)',
              zIndex: 1100,
              padding: '6px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              userSelect: 'none'
            }}>
              {/* 1-5. Simple Date Ranges */}
              {['All Time', 'Past 1 Week', 'Past 1 Month', 'This CY', 'Pick This FY'].map(range => {
                const isActive = dateRange === range || (range === 'Pick This FY' && dateRange === 'This FY');
                return (
                  <div 
                    key={range}
                    onClick={() => {
                      setDateRange(range);
                      setActivePicker(null);
                      setIsFilterOpen(false);
                    }}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontWeight: isActive ? 600 : 450,
                      backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background-color 0.12s ease'
                    }}
                    onMouseEnter={e => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseLeave={e => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span>{range}</span>
                    {isActive && <Check size={13.5} strokeWidth={2.5} style={{ color: 'var(--text-primary)' }} />}
                  </div>
                );
              })}

              {/* 6. Pick Month/Year */}
              <div>
                <div 
                  onClick={() => setActivePicker(activePicker === 'month' ? null : 'month')}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontWeight: dateRange?.type === 'month' ? 600 : 450,
                    backgroundColor: dateRange?.type === 'month' ? 'var(--bg-hover)' : 'transparent',
                    color: 'var(--text-primary)',
                    transition: 'background-color 0.12s ease'
                  }}
                  onMouseEnter={e => {
                    if (dateRange?.type !== 'month') e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={e => {
                    if (dateRange?.type !== 'month') e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>Pick Month/Year</span>
                  <ChevronRight size={13} style={{ color: 'var(--text-muted)', transform: activePicker === 'month' ? 'rotate(90deg)' : 'none', transition: '0.15s ease' }} />
                </div>
                {activePicker === 'month' && (
                  <div style={{
                    padding: '10px',
                    margin: '4px 0',
                    borderRadius: '10px',
                    backgroundColor: 'color-mix(in srgb, var(--bg-hover) 50%, var(--bg-surface))',
                    border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)'
                  }}>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                      <select 
                        value={pickerMonth} 
                        onChange={e => setPickerMonth(+e.target.value)}
                        style={{
                          flex: 1,
                          fontSize: '12px',
                          padding: '4px 6px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          outline: 'none'
                        }}
                      >
                        {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                          <option key={i} value={i}>{m}</option>
                        ))}
                      </select>
                      <input 
                        type="number" 
                        value={pickerYear} 
                        onChange={e => setPickerYear(+e.target.value)}
                        style={{
                          width: '60px',
                          fontSize: '12px',
                          padding: '4px 6px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <button 
                      onClick={() => {
                        const from = new Date(pickerYear, pickerMonth, 1);
                        const to = new Date(pickerYear, pickerMonth + 1, 0);
                        setDateRange({
                          type: 'month',
                          month: pickerMonth,
                          year: pickerYear,
                          from: from.toISOString().slice(0, 10),
                          to: to.toISOString().slice(0, 10)
                        });
                        setIsFilterOpen(false);
                        setActivePicker(null);
                      }}
                      style={{
                        width: '100%',
                        height: '28px',
                        backgroundColor: 'var(--text-primary)',
                        color: 'var(--bg-primary)',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'opacity 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* 7. Pick Quarter of FY */}
              <div>
                <div 
                  onClick={() => setActivePicker(activePicker === 'quarter' ? null : 'quarter')}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontWeight: dateRange?.type === 'quarter' ? 600 : 450,
                    backgroundColor: dateRange?.type === 'quarter' ? 'var(--bg-hover)' : 'transparent',
                    color: 'var(--text-primary)',
                    transition: 'background-color 0.12s ease'
                  }}
                  onMouseEnter={e => {
                    if (dateRange?.type !== 'quarter') e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={e => {
                    if (dateRange?.type !== 'quarter') e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>Pick Quarter of FY</span>
                  <ChevronRight size={13} style={{ color: 'var(--text-muted)', transform: activePicker === 'quarter' ? 'rotate(90deg)' : 'none', transition: '0.15s ease' }} />
                </div>
                {activePicker === 'quarter' && (
                  <div style={{
                    padding: '10px',
                    margin: '4px 0',
                    borderRadius: '10px',
                    backgroundColor: 'color-mix(in srgb, var(--bg-hover) 50%, var(--bg-surface))',
                    border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)'
                  }}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                      {['Q1','Q2','Q3','Q4'].map(q => {
                        const isQSel = pickerQ === q;
                        return (
                          <button 
                            key={q} 
                            onClick={() => setPickerQ(q)}
                            style={{
                              flex: 1,
                              padding: '4px 0',
                              fontSize: '11.5px',
                              fontWeight: isQSel ? 600 : 450,
                              borderRadius: '6px',
                              border: `1px solid ${isQSel ? 'var(--text-primary)' : 'var(--border-color)'}`,
                              background: isQSel ? 'var(--text-primary)' : 'var(--bg-surface)',
                              color: isQSel ? 'var(--bg-primary)' : 'var(--text-primary)',
                              cursor: 'pointer',
                              transition: 'all 0.12s ease'
                            }}
                          >
                            {q}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>FY</span>
                      <input 
                        type="number" 
                        value={pickerFY} 
                        onChange={e => setPickerFY(+e.target.value)}
                        style={{
                          width: '64px',
                          fontSize: '12px',
                          padding: '4px 6px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          outline: 'none'
                        }}
                      />
                      <span style={{ color: 'var(--text-muted)' }}>-{String(pickerFY + 1).slice(2)}</span>
                    </div>
                    <button 
                      onClick={() => {
                        const qMap = { Q1: [3,5], Q2: [6,8], Q3: [9,11], Q4: [0,2] };
                        const [sm, em] = qMap[pickerQ];
                        const yr = pickerQ === 'Q4' ? pickerFY + 1 : pickerFY;
                        const from = new Date(yr, sm, 1).toISOString().slice(0, 10);
                        const to = new Date(yr, em + 1, 0).toISOString().slice(0, 10);
                        setDateRange({ type: 'quarter', q: pickerQ, fy: pickerFY, from, to });
                        setIsFilterOpen(false);
                        setActivePicker(null);
                      }}
                      style={{
                        width: '100%',
                        height: '28px',
                        backgroundColor: 'var(--text-primary)',
                        color: 'var(--bg-primary)',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'opacity 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* 8. Custom Range */}
              <div>
                <div 
                  onClick={() => setActivePicker(activePicker === 'custom' ? null : 'custom')}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontWeight: (dateRange?.from && dateRange?.to && dateRange?.type !== 'month' && dateRange?.type !== 'quarter') ? 600 : 450,
                    backgroundColor: (dateRange?.from && dateRange?.to && dateRange?.type !== 'month' && dateRange?.type !== 'quarter') ? 'var(--bg-hover)' : 'transparent',
                    color: 'var(--text-primary)',
                    transition: 'background-color 0.12s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={e => {
                    if (!(dateRange?.from && dateRange?.to && dateRange?.type !== 'month' && dateRange?.type !== 'quarter')) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <span>Custom Range</span>
                  <ChevronRight size={13} style={{ color: 'var(--text-muted)', transform: activePicker === 'custom' ? 'rotate(90deg)' : 'none', transition: '0.15s ease' }} />
                </div>
                {activePicker === 'custom' && (
                  <div style={{
                    padding: '10px',
                    margin: '4px 0',
                    borderRadius: '10px',
                    backgroundColor: 'color-mix(in srgb, var(--bg-hover) 50%, var(--bg-surface))',
                    border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)'
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>From</div>
                    <input 
                      type="date" 
                      value={pickerFrom} 
                      onChange={e => setPickerFrom(e.target.value)}
                      style={{
                        width: '100%',
                        fontSize: '12px',
                        padding: '4px 6px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        marginBottom: '6px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>To</div>
                    <input 
                      type="date" 
                      value={pickerTo} 
                      onChange={e => setPickerTo(e.target.value)}
                      style={{
                        width: '100%',
                        fontSize: '12px',
                        padding: '4px 6px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        marginBottom: '8px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                    <button 
                      onClick={() => {
                        if (!pickerFrom || !pickerTo) return;
                        setDateRange({ from: pickerFrom, to: pickerTo });
                        setIsFilterOpen(false);
                        setActivePicker(null);
                      }}
                      disabled={!pickerFrom || !pickerTo}
                      style={{
                        width: '100%',
                        height: '28px',
                        backgroundColor: (pickerFrom && pickerTo) ? 'var(--text-primary)' : 'var(--border-color)',
                        color: (pickerFrom && pickerTo) ? 'var(--bg-primary)' : 'var(--text-muted)',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: (pickerFrom && pickerTo) ? 'pointer' : 'not-allowed',
                        transition: 'opacity 0.15s ease'
                      }}
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* 9. Last X Trades */}
              <div>
                <div 
                  onClick={() => setActivePicker(activePicker === 'lastX' ? null : 'lastX')}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontWeight: dateRange?.type === 'lastX' ? 600 : 450,
                    backgroundColor: dateRange?.type === 'lastX' ? 'var(--bg-hover)' : 'transparent',
                    color: 'var(--text-primary)',
                    transition: 'background-color 0.12s ease'
                  }}
                  onMouseEnter={e => {
                    if (dateRange?.type !== 'lastX') e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={e => {
                    if (dateRange?.type !== 'lastX') e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>Last X Trades</span>
                  <ChevronRight size={13} style={{ color: 'var(--text-muted)', transform: activePicker === 'lastX' ? 'rotate(90deg)' : 'none', transition: '0.15s ease' }} />
                </div>
                {activePicker === 'lastX' && (
                  <div style={{
                    padding: '10px',
                    margin: '4px 0',
                    borderRadius: '10px',
                    backgroundColor: 'color-mix(in srgb, var(--bg-hover) 50%, var(--bg-surface))',
                    border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)'
                  }}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                      {[10, 25, 50, 100].map(cnt => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setPickerX(String(cnt))}
                          style={{
                            flex: 1,
                            padding: '3px 0',
                            fontSize: '11px',
                            fontWeight: pickerX === String(cnt) ? 600 : 450,
                            borderRadius: '5px',
                            border: `1px solid ${pickerX === String(cnt) ? 'var(--text-primary)' : 'var(--border-color)'}`,
                            backgroundColor: pickerX === String(cnt) ? 'var(--text-primary)' : 'var(--bg-surface)',
                            color: pickerX === String(cnt) ? 'var(--bg-primary)' : 'var(--text-primary)',
                            cursor: 'pointer'
                          }}
                        >
                          {cnt}
                        </button>
                      ))}
                    </div>
                    <input 
                      type="number" 
                      min="1" 
                      max="1000" 
                      value={pickerX} 
                      onChange={e => setPickerX(e.target.value)}
                      placeholder="Number of trades"
                      style={{
                        width: '100%',
                        fontSize: '12px',
                        padding: '4px 6px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        marginBottom: '8px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                    <button 
                      onClick={() => {
                        setDateRange({ type: 'lastX', count: parseInt(pickerX, 10) || 10 });
                        setIsFilterOpen(false);
                        setActivePicker(null);
                      }}
                      style={{
                        width: '100%',
                        height: '28px',
                        backgroundColor: 'var(--text-primary)',
                        color: 'var(--bg-primary)',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'opacity 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* Minimalist Divider */}
              <div style={{ height: '1px', backgroundColor: 'color-mix(in srgb, var(--border-color) 35%, transparent)', margin: '5px -2px' }} />

              {/* 10. Submenu: Instrument */}
              <div 
                style={{
                  position: 'relative',
                  padding: '7px 12px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontWeight: (instrumentFilter && instrumentFilter !== 'All Instruments' && instrumentFilter !== 'All') ? 600 : 450,
                  backgroundColor: activeSubmenu === 'instrument' ? 'var(--bg-hover)' : 'transparent',
                  color: 'var(--text-primary)',
                  transition: 'background-color 0.12s ease'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSubmenu(prev => prev === 'instrument' ? null : 'instrument');
                }}
                onMouseEnter={() => setActiveSubmenu('instrument')}
                onMouseLeave={() => setActiveSubmenu(null)}
              >
                <span>Instrument</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {instrumentFilter && instrumentFilter !== 'All Instruments' && instrumentFilter !== 'All' 
                      ? (instrumentFilter === 'EQUITY (No ETFs)' ? 'EQUITY' : 'Cash') 
                      : 'All'}
                  </span>
                  <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
                </div>

                {activeSubmenu === 'instrument' && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      left: 'calc(100% + 6px)',
                      top: '-4px',
                      width: '175px',
                      backgroundColor: 'var(--bg-surface)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
                      borderRadius: '14px',
                      boxShadow: '0 16px 40px -12px rgba(0, 0, 0, 0.2)',
                      padding: '6px',
                      zIndex: 1150
                    }}
                  >
                    {['All Instruments', 'EQUITY (No ETFs)', 'Equity+ETF (Cash)'].map(inst => {
                      const isSelected = (instrumentFilter === inst) || ((!instrumentFilter || instrumentFilter === 'All Instruments') && inst === 'All Instruments');
                      return (
                        <div
                          key={inst}
                          onClick={() => {
                            setInstrumentFilter(inst === 'All Instruments' ? null : inst);
                            setIsFilterOpen(false);
                            setActiveSubmenu(null);
                          }}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '8px',
                            fontSize: '12.5px',
                            fontWeight: isSelected ? 600 : 450,
                            backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                            color: 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <span>{inst}</span>
                          {isSelected && <Check size={13.5} strokeWidth={2.5} style={{ color: 'var(--text-primary)' }} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 11. Submenu: Outcome */}
              <div 
                style={{
                  position: 'relative',
                  padding: '7px 12px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontWeight: (outcomeFilter && outcomeFilter !== 'All Outcomes' && outcomeFilter !== 'All') ? 600 : 450,
                  backgroundColor: activeSubmenu === 'outcome' ? 'var(--bg-hover)' : 'transparent',
                  color: 'var(--text-primary)',
                  transition: 'background-color 0.12s ease'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSubmenu(prev => prev === 'outcome' ? null : 'outcome');
                }}
                onMouseEnter={() => setActiveSubmenu('outcome')}
                onMouseLeave={() => setActiveSubmenu(null)}
              >
                <span>Outcome</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {outcomeFilter && outcomeFilter !== 'All Outcomes' && outcomeFilter !== 'All' ? outcomeFilter : 'All'}
                  </span>
                  <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
                </div>

                {activeSubmenu === 'outcome' && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      left: 'calc(100% + 6px)',
                      top: '-4px',
                      width: '165px',
                      backgroundColor: 'var(--bg-surface)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
                      borderRadius: '14px',
                      boxShadow: '0 16px 40px -12px rgba(0, 0, 0, 0.2)',
                      padding: '6px',
                      zIndex: 1150
                    }}
                  >
                    {['All Outcomes', 'Winners', 'Losers', 'Breakeven'].map(outcome => {
                      const isSelected = (outcomeFilter === outcome) || (!outcomeFilter && outcome === 'All Outcomes');
                      return (
                        <div
                          key={outcome}
                          onClick={() => {
                            setOutcomeFilter(outcome === 'All Outcomes' ? null : outcome);
                            setIsFilterOpen(false);
                            setActiveSubmenu(null);
                          }}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '8px',
                            fontSize: '12.5px',
                            fontWeight: isSelected ? 600 : 450,
                            backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                            color: 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <span>{outcome}</span>
                          {isSelected && <Check size={13.5} strokeWidth={2.5} style={{ color: 'var(--text-primary)' }} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 12. Submenu: Trade Type */}
              <div 
                style={{
                  position: 'relative',
                  padding: '7px 12px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontWeight: (tradeTypeFilter && tradeTypeFilter !== 'All Types' && tradeTypeFilter !== 'All') ? 600 : 450,
                  backgroundColor: activeSubmenu === 'tradeType' ? 'var(--bg-hover)' : 'transparent',
                  color: 'var(--text-primary)',
                  transition: 'background-color 0.12s ease'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSubmenu(prev => prev === 'tradeType' ? null : 'tradeType');
                }}
                onMouseEnter={() => setActiveSubmenu('tradeType')}
                onMouseLeave={() => setActiveSubmenu(null)}
              >
                <span>Trade Type</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {tradeTypeFilter && tradeTypeFilter !== 'All Types' && tradeTypeFilter !== 'All' ? tradeTypeFilter : 'All'}
                  </span>
                  <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
                </div>

                {activeSubmenu === 'tradeType' && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      left: 'calc(100% + 6px)',
                      top: '-4px',
                      width: '165px',
                      backgroundColor: 'var(--bg-surface)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
                      borderRadius: '14px',
                      boxShadow: '0 16px 40px -12px rgba(0, 0, 0, 0.2)',
                      padding: '6px',
                      zIndex: 1150
                    }}
                  >
                    {['All Types', 'Intraday', 'Delivery'].map(type => {
                      const isSelected = (tradeTypeFilter === type) || (!tradeTypeFilter && type === 'All Types');
                      return (
                        <div
                          key={type}
                          onClick={() => {
                            setTradeTypeFilter(type === 'All Types' ? null : type);
                            setIsFilterOpen(false);
                            setActiveSubmenu(null);
                          }}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '8px',
                            fontSize: '12.5px',
                            fontWeight: isSelected ? 600 : 450,
                            backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                            color: 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <span>{type}</span>
                          {isSelected && <Check size={13.5} strokeWidth={2.5} style={{ color: 'var(--text-primary)' }} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Portfolio Switcher */}
        <PortfolioSwitcher
          portfolios={portfolios}
          activePortfolioId={activePortfolioId}
          onSelectPortfolio={onSelectPortfolio}
          onUpdatePortfolios={onUpdatePortfolios}
          onOpenCreatePortfolio={onOpenCreatePortfolio}
          onShowToast={onShowToast}
          trades={trades}
        />

      </div>

      {/* Center: Live market timer (True Screen Center) */}
      <div style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--text-primary)',
        letterSpacing: '0.1px',
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        whiteSpace: 'nowrap',
        pointerEvents: 'auto'
      }}>
        {/* Interactive Status Dot with Aesthetic Popover on Hover */}
        <div 
          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
          onMouseEnter={() => setIsMarketDotHovered(true)}
          onMouseLeave={() => setIsMarketDotHovered(false)}
          onMouseOver={() => setIsMarketDotHovered(true)}
        >
          {countdownData?.dot && (
            <span 
              onMouseEnter={() => setIsMarketDotHovered(true)}
              onMouseOver={() => setIsMarketDotHovered(true)}
              style={{
                display: 'inline-block',
                width: '7.5px',
                height: '7.5px',
                borderRadius: '50%',
                backgroundColor: countdownData.dot,
                cursor: 'pointer',
                transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease',
                transform: isMarketDotHovered ? 'scale(1.4)' : 'scale(1)',
                boxShadow: isMarketDotHovered
                  ? `0 0 10px ${countdownData.dot}`
                  : countdownData.status === 'LIVE' ? '0 0 6px rgba(16, 185, 129, 0.6)' : 'none'
              }} 
            />
          )}

          {/* Aesthetic Small Popover */}
          {isMarketDotHovered && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              left: '50%',
              transform: 'translateX(-50%)',
              minWidth: '220px',
              maxWidth: '300px',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-surface, #ffffff)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid color-mix(in srgb, var(--border-color) 70%, transparent)',
              borderRadius: '12px',
              boxShadow: '0 14px 35px -4px rgba(0, 0, 0, 0.2), 0 4px 12px -2px rgba(0, 0, 0, 0.1)',
              zIndex: 9999,
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              animation: 'popoverFadeIn 0.16s ease-out'
            }}>
              {/* Caret pointing upward */}
              <div style={{
                position: 'absolute',
                top: '-5px',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: '10px',
                height: '10px',
                backgroundColor: 'var(--bg-surface, #ffffff)',
                borderLeft: '1px solid color-mix(in srgb, var(--border-color) 70%, transparent)',
                borderTop: '1px solid color-mix(in srgb, var(--border-color) 70%, transparent)'
              }} />

              {/* Header: Status Dot + Title + Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: countdownData?.dot
                  }} />
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.2px'
                  }}>
                    {countdownData?.title || 'Market Status'}
                  </span>
                </div>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                  padding: '1.5px 6px',
                  borderRadius: '4px',
                  color: countdownData?.textColor,
                  backgroundColor: countdownData?.badgeColor
                }}>
                  {countdownData?.status === 'LIVE' ? 'LIVE' : countdownData?.status === 'PRE_MARKET' ? 'PRE-OPEN' : countdownData?.status === 'OPENING_SOON' ? 'OPENING' : 'CLOSED'}
                </span>
              </div>

              {/* Subtitle description */}
              {countdownData?.subtitle && (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.35, marginTop: '2px' }}>
                  {countdownData.subtitle}
                </div>
              )}

              {/* Extra exchange / MCX details */}
              {countdownData?.extra && (
                <div style={{
                  fontSize: '10.5px',
                  color: 'var(--text-muted, #94a3b8)',
                  lineHeight: 1.3,
                  paddingTop: '5px',
                  marginTop: '3px',
                  borderTop: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)'
                }}>
                  {countdownData.extra}
                </div>
              )}
            </div>
          )}
        </div>

        <span style={{ pointerEvents: 'none' }}>{countdownData?.displayText || 'Market status loading...'}</span>
      </div>

      {/* Right: Utility icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '3px 10px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '9999px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}>
        {/* Notification Bell with Dynamic Red Badge, Genie Absorption Target & Month Overlay */}
        <div style={{ position: 'relative' }}>
          <button 
            id="topbar-bell-btn"
            ref={notifAnchorRef}
            onClick={() => {
              setIsNotificationsOpen(!isNotificationsOpen);
              setIsCommunityOpen(false);
            }}
            title="Notifications" 
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '24px', height: '24px', borderRadius: '50%',
              border: 'none', 
              backgroundColor: isNotificationsOpen ? 'rgba(0,0,0,0.08)' : 'transparent',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!isNotificationsOpen) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
            }}
            onMouseLeave={(e) => {
              if (!isNotificationsOpen) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Bell 
              size={14} 
              color="var(--text-secondary)" 
              style={{
                transformOrigin: 'top center',
                animation: isBellWobbling ? 'bellRingWobble 0.52s ease-in-out' : 'none'
              }}
            />
            {unreadNotifCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  borderRadius: '9999px',
                  fontSize: '9px',
                  fontWeight: 700,
                  minWidth: '13px',
                  height: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 2px',
                  border: '1.5px solid var(--bg-surface, #ffffff)',
                  lineHeight: 1,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  animation: isBadgePopping ? 'badgeBumpPop 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none'
                }}
              >
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </span>
            )}
          </button>

          <NotificationsPopover 
            isOpen={isNotificationsOpen} 
            onClose={() => setIsNotificationsOpen(false)} 
            anchorRef={notifAnchorRef} 
          />

          {/* Top Drop Banner with Genie Absorption into Bell */}
          <NotificationDropBanner />
        </div>
        
        <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-color)' }} />
        
        {/* Community Button with White Aesthetic Popover containing Telegram & Discord Logos */}
        <div style={{ position: 'relative' }} ref={communityAnchorRef}>
          <button 
            id="topbar-community-btn"
            onClick={() => {
              setIsCommunityOpen(prev => !prev);
              setIsNotificationsOpen(false);
            }}
            title="Community" 
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '24px', height: '24px', borderRadius: '50%',
              border: 'none', 
              backgroundColor: isCommunityOpen ? 'rgba(0,0,0,0.08)' : 'transparent', 
              cursor: 'pointer',
              position: 'relative',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!isCommunityOpen) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
            }}
            onMouseLeave={(e) => {
              if (!isCommunityOpen) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Users size={14} color={isCommunityOpen ? 'var(--accent-orange, #f97316)' : 'var(--text-secondary)'} />
          </button>

          <CommunityPopover 
            isOpen={isCommunityOpen}
            onClose={() => setIsCommunityOpen(false)}
            anchorRef={communityAnchorRef}
            onShowToast={onShowToast}
          />
        </div>

        <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-color)' }} />

        {/* 3-Theme Switcher Button: Light ➔ Dark (Slate) ➔ Pitch Black (OLED) */}
        <button 
          onClick={handleCycleTheme} 
          title={`Theme: ${themeMode.toUpperCase()} (Click to change)`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '26px', height: '26px', borderRadius: '50%',
            border: 'none', 
            backgroundColor: 'transparent', 
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f3f4f6)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {themeMode === 'light' && <Sun size={15} color="#f59e0b" />}
          {themeMode === 'dark' && <Moon size={15} color="#9ca3af" />}
          {themeMode === 'pitch-black' && <Sparkles size={15} color="#38bdf8" />}
        </button>
      </div>
      </div>
    </header>
  );
}
