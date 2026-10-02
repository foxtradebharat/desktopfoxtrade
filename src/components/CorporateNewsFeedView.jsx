import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, ChevronDown, ChevronUp, Smile, Frown, TrendingUp, TrendingDown, X } from 'lucide-react';
import { fetchLiveIndianCorporateNews } from '../services/dhanNewsService';

const CATEGORIES = [
  'All',
  'My Portfolio',
  'Earnings',
  'Corporate Action',
  'Corporate Governance',
  'Stock',
  'Global',
  'Ipo'
];

export default function CorporateNewsFeedView({ trades = [], onOpenStockChart }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [news, setNews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Extract set of user's portfolio / trade symbols
  const userPortfolioSymbols = useMemo(() => {
    if (!Array.isArray(trades) || trades.length === 0) return new Set();
    const set = new Set();
    trades.forEach(t => {
      const raw = String(t.symbol || t.name || '').trim().toUpperCase();
      if (!raw) return;
      const clean = raw
        .replace(/^(NSE:|BSE:|INDEX:)/i, '')
        .replace(/\.(NS|BO|EQ|NF|BF)$/i, '')
        .replace(/-EQ$/i, '')
        .trim();
      if (clean) set.add(clean);
    });
    return set;
  }, [trades]);

  // Check if a news item relates to user's portfolio stocks
  const isPortfolioItem = useCallback((item) => {
    if (!userPortfolioSymbols || userPortfolioSymbols.size === 0 || !item) return false;
    const itemSym = String(item.symbol || '').trim().toUpperCase();
    if (itemSym && userPortfolioSymbols.has(itemSym)) return true;

    if (item.title) {
      const upperTitle = item.title.toUpperCase();
      for (const sym of userPortfolioSymbols) {
        if (sym.length >= 3) {
          const regex = new RegExp(`\\b${sym}\\b`, 'i');
          if (regex.test(upperTitle)) return true;
        }
      }
    }
    return false;
  }, [userPortfolioSymbols]);

  // Count of portfolio news items
  const portfolioNewsCount = useMemo(() => {
    return news.filter(item => isPortfolioItem(item)).length;
  }, [news, isPortfolioItem]);

  // Fetch news on mount & auto-refresh silently every 60 seconds
  const loadNews = useCallback(async () => {
    try {
      const data = await fetchLiveIndianCorporateNews();
      if (Array.isArray(data) && data.length > 0) {
        setNews(data);
      }
    } catch (err) {
      console.error('[CorporateNewsFeedView] Error loading live news:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNews();
    const interval = setInterval(loadNews, 60000);
    return () => clearInterval(interval);
  }, [loadNews]);

  // Filter news
  const filteredNews = useMemo(() => {
    return news.filter((item) => {
      // Category filter
      if (selectedCategory === 'My Portfolio') {
        if (!isPortfolioItem(item)) return false;
      } else if (selectedCategory !== 'All') {
        const cat = (item.category || '').toLowerCase();
        const selected = selectedCategory.toLowerCase();
        if (selected === 'stock') {
          if (cat !== 'stock' && !item.symbol) return false;
        } else if (cat !== selected) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchDesc = (item.desc || '').toLowerCase().includes(q);
        const matchSymbol = (item.symbol || '').toLowerCase().includes(q);
        return matchTitle || matchDesc || matchSymbol;
      }

      return true;
    });
  }, [news, selectedCategory, searchQuery, isPortfolioItem]);

  return (
    <div 
      style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '6px 24px 90px 24px'
      }}
    >
      {/* ── Top Bar: Aesthetic Navigation & Expandable Search ── */}
      <div 
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          padding: '10px 0',
          borderBottom: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          backdropFilter: 'blur(10px)'
        }}
      >
        {/* Category Pills with Subtle Dividers */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px', 
            overflowX: 'auto' 
          }} 
          className="no-scrollbar"
        >
          {CATEGORIES.map((cat, idx) => {
            const isActive = selectedCategory === cat;
            return (
              <React.Fragment key={cat}>
                {idx > 0 && (
                  <div 
                    style={{
                      width: '1px',
                      height: '14px',
                      backgroundColor: 'color-mix(in srgb, var(--border-color, #e5e7eb) 45%, transparent)',
                      flexShrink: 0,
                      margin: '0 4px'
                    }} 
                  />
                )}
                <button
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 11px',
                    borderRadius: '7px',
                    fontSize: '11.5px',
                    fontWeight: isActive ? 600 : 500,
                    letterSpacing: '0.01em',
                    color: isActive ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
                    backgroundColor: isActive ? 'color-mix(in srgb, var(--border-color, #e5e7eb) 35%, transparent)' : 'transparent',
                    border: '1px solid transparent',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: isActive ? '0 1px 2px rgba(0, 0, 0, 0.03)' : 'none',
                    transition: 'all 0.15s ease',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--text-primary, #111827)';
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--text-muted, #9ca3af)';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <span>{cat}</span>
                  {cat === 'My Portfolio' && portfolioNewsCount > 0 && (
                    <span
                      style={{
                        padding: '1px 5px',
                        fontSize: '10px',
                        fontWeight: 600,
                        borderRadius: '9999px',
                        backgroundColor: isActive ? 'var(--text-primary, #111827)' : 'color-mix(in srgb, var(--border-color, #e5e7eb) 75%, transparent)',
                        color: isActive ? 'var(--bg-card, #ffffff)' : 'var(--text-secondary, #4b5563)',
                        lineHeight: 1.2
                      }}
                    >
                      {portfolioNewsCount}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Minimalist Search Icon & Input */}
        <div 
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
            borderRadius: '8px',
            padding: '4px 10px',
            backgroundColor: 'var(--bg-card, #ffffff)',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
            transition: 'all 0.2s ease'
          }}
        >
          <Search size={13} style={{ color: 'var(--text-muted, #9ca3af)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search news..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '11.5px',
              color: 'var(--text-primary, #111827)',
              padding: '0 0 0 7px',
              width: searchQuery ? '170px' : '115px',
              transition: 'width 0.2s ease'
            }}
            onFocus={(e) => e.target.style.width = '180px'}
            onBlur={(e) => { if (!searchQuery) e.target.style.width = '115px'; }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 2px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--text-muted, #9ca3af)'
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── 2-Column Grid of Authentic News Cards ── */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: '20px'
        }}
      >
        {/* Skeletons while loading */}
        {isLoading && news.length === 0 ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={`skeleton-${idx}`}
              style={{
                backgroundColor: 'var(--bg-card, #ffffff)',
                border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 50%, transparent)',
                borderRadius: '16px',
                padding: '20px 22px',
                display: 'flex',
                gap: '16px'
              }}
              className="animate-pulse"
            >
              <div 
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'color-mix(in srgb, var(--border-color, #e5e7eb) 40%, transparent)',
                  flexShrink: 0
                }} 
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ height: '16px', width: '75%', borderRadius: '4px', backgroundColor: 'color-mix(in srgb, var(--border-color, #e5e7eb) 35%, transparent)' }} />
                <div style={{ height: '13px', width: '92%', borderRadius: '4px', backgroundColor: 'color-mix(in srgb, var(--border-color, #e5e7eb) 25%, transparent)' }} />
                <div style={{ height: '13px', width: '55%', borderRadius: '4px', backgroundColor: 'color-mix(in srgb, var(--border-color, #e5e7eb) 20%, transparent)' }} />
              </div>
            </div>
          ))
        ) : filteredNews.length === 0 ? (
          <div 
            className="col-span-full"
            style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 'calc(65vh - 120px)',
              width: '100%',
              textAlign: 'center',
              color: 'var(--text-muted, #9ca3af)',
              fontSize: '13px',
              letterSpacing: '0.01em'
            }}
          >
            {selectedCategory === 'My Portfolio' 
              ? 'No recent news for your portfolio stocks.' 
              : 'No news found in this category.'}
          </div>
        ) : (
          filteredNews.map((item, index) => {
            const itemId = item.id ? `${item.id}-${index}` : `news-${index}`;
            const isExpanded = expandedId === itemId;
            const hasCmp = item.price !== null && item.price !== undefined;
            const isPositive = item.isPositive;
            const inPortfolio = isPortfolioItem(item);

            return (
              <div
                key={itemId}
                onClick={() => {
                  if (item.desc && item.desc.length > 110) {
                    setExpandedId(isExpanded ? null : itemId);
                  }
                }}
                style={{
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  border: inPortfolio 
                    ? '1px solid color-mix(in srgb, #0284c7 35%, var(--border-color, #e5e7eb))' 
                    : '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 60%, transparent)',
                  borderRadius: '16px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02), 0 4px 12px rgba(0, 0, 0, 0.015)',
                  padding: '20px 22px',
                  cursor: item.desc && item.desc.length > 110 ? 'pointer' : 'default',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = inPortfolio 
                    ? 'color-mix(in srgb, #0284c7 60%, transparent)' 
                    : 'color-mix(in srgb, var(--text-primary, #111827) 22%, transparent)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.02)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = inPortfolio 
                    ? 'color-mix(in srgb, #0284c7 35%, var(--border-color, #e5e7eb))' 
                    : 'color-mix(in srgb, var(--border-color, #e5e7eb) 60%, transparent)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.02), 0 4px 12px rgba(0, 0, 0, 0.015)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    {/* Company / Brand Logo */}
                    <div style={{ flexShrink: 0, paddingTop: '1px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(0, 0, 0, 0.02)',
                          border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 45%, transparent)',
                          overflow: 'hidden'
                        }}
                      >
                        <img
                          src={item.logo}
                          alt={`${item.symbol} logo`}
                          style={{ width: '26px', height: '26px', objectFit: 'contain', borderRadius: '4px' }}
                          loading="lazy"
                          onError={(e) => {
                            if (!e.currentTarget.src.includes('country/IN.svg')) {
                              e.currentTarget.src = 'https://s3-symbol-logo.tradingview.com/country/IN.svg';
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Content Area */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      {/* Title & Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                        <h4 
                          style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            lineHeight: 1.45,
                            letterSpacing: '-0.01em',
                            color: 'var(--text-primary, #111827)',
                            margin: 0,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            transition: 'color 0.15s ease'
                          }}
                        >
                          {item.title}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          {inPortfolio && (
                            <span 
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: '#0284c7',
                                backgroundColor: 'rgba(2, 132, 199, 0.08)',
                                border: '1px solid rgba(2, 132, 199, 0.25)',
                                borderRadius: '9999px',
                                padding: '2px 7px',
                                whiteSpace: 'nowrap',
                                letterSpacing: '0.01em'
                              }}
                            >
                              ✦ In Portfolio
                            </span>
                          )}
                          <span 
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 500,
                              color: 'var(--text-muted, #9ca3af)',
                              backgroundColor: 'rgba(0, 0, 0, 0.03)',
                              border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 40%, transparent)',
                              borderRadius: '9999px',
                              padding: '2px 7px',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}
                          >
                            {item.time}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      {item.desc && (
                        <div style={{ marginBottom: '4px' }}>
                          <p 
                            style={{
                              fontSize: '12.5px',
                              lineHeight: 1.65,
                              color: 'var(--text-secondary, #4b5563)',
                              letterSpacing: '0.005em',
                              margin: 0,
                              ...(isExpanded ? {} : {
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              })
                            }}
                          >
                            {item.desc}
                          </p>
                          {item.desc.length > 110 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedId(isExpanded ? null : itemId);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '4px 0 0 0',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '11.5px',
                                fontWeight: 500,
                                color: 'var(--text-muted, #9ca3af)',
                                transition: 'color 0.15s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary, #111827)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #9ca3af)'}
                            >
                              {isExpanded ? (
                                <>Show less <ChevronUp size={12} /></>
                              ) : (
                                <>Read more <ChevronDown size={12} /></>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Sentiment Smile on left, CMP on right */}
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    marginTop: '14px',
                    borderTop: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 35%, transparent)'
                  }}
                >
                  {/* Sentiment Icon Pill */}
                  <div 
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      backgroundColor: 'rgba(0, 0, 0, 0.02)',
                      border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 45%, transparent)',
                      borderRadius: '9999px',
                      padding: '3px 8px'
                    }}
                  >
                    {item.sentiment === 'negative' ? (
                      <Frown size={14} color="#f43f5e" />
                    ) : (
                      <Smile size={14} color="#10b981" />
                    )}
                  </div>

                  {/* Price Pill */}
                  {hasCmp ? (
                    <div 
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono, monospace)',
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.06)' : 'rgba(244, 63, 94, 0.06)',
                        border: `1px solid ${isPositive ? 'rgba(16, 185, 129, 0.22)' : 'rgba(244, 63, 94, 0.22)'}`,
                        color: isPositive ? '#047857' : '#be123c'
                      }}
                    >
                      <span>
                        ₹{typeof item.price === 'number'
                          ? item.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : item.price}
                      </span>
                      {item.changePct !== null && item.changePct !== undefined && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '11px' }}>
                          {isPositive ? (
                            <TrendingUp size={12} style={{ marginRight: '2px' }} strokeWidth={2} />
                          ) : (
                            <TrendingDown size={12} style={{ marginRight: '2px' }} strokeWidth={2} />
                          )}
                          {Math.abs(item.changePct).toFixed(2)}%
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>
                      {item.symbol || ''}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
