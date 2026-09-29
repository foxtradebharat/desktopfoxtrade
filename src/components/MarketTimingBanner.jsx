import React, { useState, useEffect, useRef } from 'react';
import { MarketTimingService } from '../services/marketTimingService';

export default function MarketTimingBanner({ 
  tradingMarket = 'india',
  className = ''
}) {
  const [marketStatus, setMarketStatus] = useState(() => 
    MarketTimingService.getMarketStatus('equity', tradingMarket)
  );
  const [countdown, setCountdown] = useState(() => 
    MarketTimingService.formatCountdown(marketStatus.timeUntilNext)
  );

  const initialTimeRef = useRef(Date.now());
  const initialTimeUntilRef = useRef(marketStatus.timeUntilNext);

  useEffect(() => {
    // Reset references whenever tradingMarket changes or market status updates
    const initialStatus = MarketTimingService.getMarketStatus('equity', tradingMarket);
    setMarketStatus(initialStatus);
    initialTimeRef.current = Date.now();
    initialTimeUntilRef.current = initialStatus.timeUntilNext;
    setCountdown(MarketTimingService.formatCountdown(initialStatus.timeUntilNext));

    const interval = setInterval(() => {
      const elapsed = Date.now() - initialTimeRef.current;
      const remaining = Math.max(0, initialTimeUntilRef.current - elapsed);

      if (remaining === 0) {
        // Status transitioned, re-fetch full market status
        const nextStatus = MarketTimingService.getMarketStatus('equity', tradingMarket);
        setMarketStatus(nextStatus);
        initialTimeRef.current = Date.now();
        initialTimeUntilRef.current = nextStatus.timeUntilNext;
        setCountdown(MarketTimingService.formatCountdown(nextStatus.timeUntilNext));
      } else {
        setCountdown(MarketTimingService.formatCountdown(remaining));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [tradingMarket]);

  // Dot type & colors matching Nexus Journal
  const dotType = (() => {
    if (marketStatus.isOpen) return marketStatus.isPreMarket ? 'pre' : 'open';
    if (marketStatus.isHolidayToday) {
      const name = marketStatus.holidayInfo?.holiday.toLowerCase() || '';
      if (name.includes('muhurat') || name.includes('union budget')) return 'special';
    }
    if (marketStatus.isMarketOpeningSoon) return 'special';
    return 'closed';
  })();

  const dotColorClass = {
    open: 'bg-emerald-500',
    closed: 'bg-rose-500',
    pre: 'bg-blue-500',
    special: 'bg-amber-500'
  }[dotType];

  const dotHexColor = {
    open: '#10b981',
    closed: '#f43f5e',
    pre: '#3b82f6',
    special: '#f59e0b'
  }[dotType];

  // Title matching Nexus Journal
  const title = (() => {
    if (marketStatus.isOpen) {
      if (marketStatus.currentSession) {
        if (marketStatus.isHolidayToday) {
          const name = marketStatus.holidayInfo?.holiday.toLowerCase() || '';
          if (name.includes('muhurat') || name.includes('union budget')) {
            return `${marketStatus.currentSession.name} - ${marketStatus.holidayInfo?.holiday}`;
          }
        }
        return `${marketStatus.currentSession.name} Session`;
      }
      return 'Market is Open';
    }
    if (marketStatus.isHolidayToday && marketStatus.holidayInfo) {
      return marketStatus.holidayInfo.holiday;
    }
    return marketStatus.isWeekend ? 'Weekend' : 'Market Closed';
  })();

  // Status Badge matching Nexus Journal
  const statusBadge = (() => {
    if (marketStatus.isOpen) {
      return marketStatus.isPreMarket ? (
        <span className="text-[10px] font-bold tracking-widest text-blue-600 dark:text-blue-400 uppercase">
          Pre-Market
        </span>
      ) : (
        <span className="text-[10px] font-bold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase">
          Open
        </span>
      );
    }
    if (marketStatus.isHolidayToday && marketStatus.nextSession && marketStatus.holidayInfo) {
      const name = marketStatus.holidayInfo.holiday.toLowerCase();
      if (name.includes('muhurat') || name.includes('union budget')) {
        return (
          <span className="text-[10px] font-bold tracking-widest text-amber-600 dark:text-amber-400 uppercase">
            Opening Soon
          </span>
        );
      }
    }
    if (marketStatus.isMarketOpeningSoon) {
      return (
        <span className="text-[10px] font-bold tracking-widest text-amber-600 dark:text-amber-400 uppercase">
          Opening Soon
        </span>
      );
    }
    if (marketStatus.isWeekend) return null;
    return (
      <span className="text-[10px] font-bold tracking-widest text-rose-600 dark:text-rose-400 uppercase">
        Closed
      </span>
    );
  })();

  // Countdown element
  const renderCountdown = () => {
    if (marketStatus.isOpen || !marketStatus.nextSession) return null;
    return (
      <div 
        className="flex items-center gap-2 ml-auto pl-2 border-l"
        style={{ borderColor: 'color-mix(in srgb, var(--border-color) 40%, transparent)' }}
      >
        <span 
          className="text-[10px] uppercase tracking-wider font-medium hidden sm:inline-block"
          style={{ color: 'var(--text-muted, #94a3b8)' }}
        >
          Market opens in
        </span>
        <span 
          className="text-xs font-mono font-medium tracking-tight px-1.5 py-0.5 rounded-[4px]"
          style={{
            color: 'var(--text-primary)',
            backgroundColor: 'var(--bg-hover, rgba(0,0,0,0.04))'
          }}
        >
          {countdown}
        </span>
      </div>
    );
  };

  // Check if holiday description has specific notes (like MCX evening session)
  const isGenericDesc = marketStatus.isHolidayToday && 
    marketStatus.holidayInfo?.description === `Market closed for ${marketStatus.holidayInfo?.holiday}`;
  const showDetail = marketStatus.isHolidayToday && marketStatus.holidayInfo?.description && !isGenericDesc;
  const mcxEveningNotice = marketStatus.isHolidayToday && marketStatus.holidayInfo?.mcxStatus?.evening 
    ? 'MCX: Evening session open from 5:00 PM to 11:30 PM IST' 
    : null;

  return (
    <div 
      className={`mb-3 py-2 px-3.5 rounded-[10px] border shadow-xs flex flex-col transition-all ${className}`}
      style={{
        borderColor: 'color-mix(in srgb, var(--border-color) 40%, transparent)',
        backgroundColor: 'color-mix(in srgb, var(--bg-surface) 65%, transparent)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)'
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Status Dot with animate-ping */}
          <span className="relative flex h-2 w-2 shrink-0">
            {dotType !== 'closed' && (
              <span 
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 duration-1000 ${dotColorClass}`}
                style={{ backgroundColor: dotHexColor }}
              />
            )}
            <span 
              className={`relative inline-flex rounded-full h-2 w-2 ${dotColorClass}`}
              style={{ backgroundColor: dotHexColor }}
            />
          </span>

          <div className="flex items-center gap-1.5">
            <span 
              className="text-xs font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </span>
            {statusBadge && (
              <>
                <span style={{ color: 'color-mix(in srgb, var(--border-color) 60%, transparent)' }} className="mx-0.5">•</span>
                {statusBadge}
              </>
            )}
          </div>
        </div>

        {/* Right side opens in countdown */}
        {renderCountdown()}
      </div>

      {/* Extra description or MCX notice if applicable */}
      {(showDetail || mcxEveningNotice) && (
        <div 
          className="mt-1 text-[11px] leading-snug"
          style={{ color: 'var(--text-secondary, #64748b)' }}
        >
          {showDetail ? marketStatus.holidayInfo.description : mcxEveningNotice}
        </div>
      )}
    </div>
  );
}
