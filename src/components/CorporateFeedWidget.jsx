import React, { useState } from 'react';
import { Newspaper, ChevronDown, ChevronUp, ExternalLink, TrendingUp, TrendingDown, Tag, Clock } from 'lucide-react';

const SAMPLE_CORPORATE_NEWS = [
  {
    id: 1,
    category: 'Corporate Action',
    title: 'Shardul Securities AGM scheduled for Sept 25',
    time: '3m ago',
    description: 'Shardul Securities has scheduled its 41st Annual General Meeting for September 25. The meeting will be held via video conferencing to transact business for FY26.',
    symbol: 'SHARDUL',
    cmp: 52.14,
    changePct: 1.01,
  },
  {
    id: 2,
    category: 'Corporate Governance',
    title: 'Nahar Poly Films files FY26 BRSR sustainability report',
    time: '5m ago',
    description: 'Nahar Poly Films Limited has filed its Business Responsibility and Sustainability Report for FY26 detailing environmental governance metrics.',
    symbol: 'NAHARPOLY',
    cmp: 247.35,
    changePct: 0.32,
  },
  {
    id: 3,
    category: 'Stock',
    title: 'Aayush Wellness enters ₹18,913 Cr respiratory healthcare market',
    time: '8m ago',
    description: 'Aayush Wellness launches new preventive health formulations targeting respiratory recovery with nationwide OTC distribution rollout.',
    symbol: 'AAYUSH',
    cmp: 27.40,
    changePct: 11.65,
  },
  {
    id: 4,
    category: 'Earnings',
    title: 'Tata Steel reports robust domestic volume growth in Q2',
    time: '15m ago',
    description: 'Automotive and infrastructure steel demand drives 12% domestic shipment growth with improved blast furnace utilization.',
    symbol: 'TATASTEEL',
    cmp: 168.50,
    changePct: 2.34,
  },
  {
    id: 5,
    category: 'IPO',
    title: 'NSE SME & Mainboard IPO pipeline surges for H2 FY26',
    time: '25m ago',
    description: 'Over 14 tech and manufacturing companies file draft red herring prospectus (DRHP) with SEBI for festive capital raising.',
    symbol: 'NIFTY',
    cmp: 24350.00,
    changePct: 0.65,
  },
  {
    id: 6,
    category: 'Global',
    title: 'US Fed signals steady policy trajectory aiding FII flows into India',
    time: '40m ago',
    description: 'Cooling inflation metrics boost foreign institutional buying in Indian large-cap banking and IT equities.',
    symbol: 'BANKNIFTY',
    cmp: 51800.00,
    changePct: 0.88,
  }
];

export default function CorporateFeedWidget({ onOpenStockChart }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = ['All', 'Earnings', 'Corporate Action', 'Corporate Governance', 'Stock', 'Global', 'IPO'];

  const filteredNews = activeCategory === 'All'
    ? SAMPLE_CORPORATE_NEWS
    : SAMPLE_CORPORATE_NEWS.filter(n => n.category.toLowerCase() === activeCategory.toLowerCase());

  return (
    <div style={{
      backgroundColor: 'var(--bg-card, #ffffff)',
      border: '1px solid var(--border-color, #e5e7eb)',
      borderRadius: '16px',
      margin: '0 24px 16px 24px',
      padding: '12px 16px',
      boxShadow: 'var(--shadow-card)'
    }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        {/* Left Title & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            backgroundColor: 'rgba(249, 115, 22, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Newspaper size={14} color="#f97316" />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
            Indian Corporate Announcements & Theme Tracker
          </span>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#059669',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            padding: '2px 6px',
            borderRadius: '999px'
          }}>
            LIVE FEED
          </span>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setIsExpanded(true);
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: activeCategory === cat ? 'var(--text-primary, #111827)' : 'var(--bg-surface, #f3f4f6)',
                color: activeCategory === cat ? 'var(--bg-card, #ffffff)' : 'var(--text-muted, #6b7280)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.12s ease'
              }}>
              {cat}
            </button>
          ))}

          {/* Toggle Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary, #6b7280)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              marginLeft: '4px'
            }}>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded News Stream Cards */}
      {isExpanded && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '12px',
          marginTop: '14px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-color, #f3f4f6)'
        }}>
          {filteredNews.map(item => (
            <div
              key={item.id}
              onClick={() => onOpenStockChart && onOpenStockChart(item.symbol)}
              style={{
                backgroundColor: 'var(--bg-primary, #f9fafb)',
                border: '1px solid var(--border-color, #e5e7eb)',
                borderRadius: '12px',
                padding: '12px',
                cursor: 'pointer',
                transition: 'transform 0.12s ease, border-color 0.12s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#f97316';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#ea580c',
                    backgroundColor: 'rgba(249, 115, 22, 0.12)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {item.category}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted, #9ca3af)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <Clock size={10} /> {item.time}
                  </span>
                </div>

                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #111827)', lineHeight: 1.35, marginBottom: '4px' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary, #6b7280)', lineHeight: 1.4 }}>
                  {item.description}
                </div>
              </div>

              {/* Price Pill */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', paddingTop: '6px', borderTop: '1px solid var(--border-color, #f3f4f6)' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
                  {item.symbol}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                    ₹{item.cmp.toLocaleString('en-IN')}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    color: item.changePct >= 0 ? '#059669' : '#dc2626'
                  }}>
                    {item.changePct >= 0 ? `+${item.changePct}%` : `${item.changePct}%`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
