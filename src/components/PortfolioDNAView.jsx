import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  HelpCircle, ArrowUpRight, ArrowDownRight, Briefcase, 
  LayoutList, BarChart2, LayoutDashboard, Search, X, 
  ChevronRight, TrendingUp, TrendingDown, Layers, ExternalLink
} from 'lucide-react';
import SymbolLogo from './SymbolLogo';
import ActiveStockChartCard from './ActiveStockChartCard';
import BenchmarkIndexChart from './BenchmarkIndexChart';
import { getStockClassification, getPeersByTaxonomy, FOXTRADE_DNA_PALETTE } from '../services/stockClassificationService';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

// Custom Tooltip for Donut Chart
const CustomDonutTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        padding: '10px 14px',
        borderRadius: '14px',
        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.12)',
        pointerEvents: 'none'
      }}>
        <p style={{
          fontSize: '12px',
          fontWeight: 800,
          color: 'var(--text-primary, #111827)',
          margin: 0
        }}>
          {data.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: data.color }} />
          <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #6b7280)', margin: 0 }}>
            <strong style={{ color: 'var(--text-primary, #111827)', fontFamily: 'monospace' }}>
              {data.weight.toFixed(2)}%
            </strong>{' '}
            Weight
          </p>
        </div>
      </div>
    );
  }
  return null;
};

// Standard date parser for days held & timeline alignment
function parseTradeDate(d) {
  if (!d) return null;
  if (typeof d === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const parts = d.split(/[-/.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  try {
    const dt = new Date(d);
    if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
  } catch {}
  return null;
}

export default function PortfolioDNAView({ 
  trades = [], 
  portfolioCapital = 212880.89, 
  metrics = {}, 
  hideValues = false,
  searchTerm = '',
  setSearchTerm,
  sortBy = 'pl',
  setSortBy,
  onOpenStockChart,
  onOpenDeepDive,
  settings = {}
}) {
  const showHoldingStats = settings?.statsInHoldings !== false;
  const [dnaCategory, setDnaCategory] = useState('NICHE'); // 'NICHE' | 'INDUSTRY' | 'SECTOR'
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [activePeersModal, setActivePeersModal] = useState(null); // { type, name }
  const [peerSearchQuery, setPeerSearchQuery] = useState('');
  const [rightDockView, setRightDockView] = useState('cards'); // 'cards' | 'charts' | 'dashboard'
  const [chartBatchLimit, setChartBatchLimit] = useState(8);
  
  // Interactive Popovers
  const [activeLifecycleTradeId, setActiveLifecycleTradeId] = useState(null);
  const [showImpactAuditPopover, setShowImpactAuditPopover] = useState(false);

  const peersModalRef = useRef(null);

  // Switch to card view whenever active positions tab is activated
  useEffect(() => {
    const handleResetView = () => setRightDockView('cards');
    window.addEventListener('tradeontip_open_active_positions_cards', handleResetView);
    return () => window.removeEventListener('tradeontip_open_active_positions_cards', handleResetView);
  }, []);

  // Close popovers on click outside
  useEffect(() => {
    function handleDocClick(e) {
      if (!e.target.closest('[data-popover-anchor]')) {
        setActiveLifecycleTradeId(null);
        setShowImpactAuditPopover(false);
      }
    }
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  // Filter active / open trades
  const activePositions = useMemo(() => {
    return (trades || []).filter(t => (t.status === 'Open' || t.status === 'Partial') && (parseFloat(t.openQty ?? t.qty) || 0) > 0);
  }, [trades]);

  const activePfCapital = metrics?.portfolioCapital || portfolioCapital || 212880.89;

  // Filter and sort active positions
  const displayedPositions = useMemo(() => {
    let list = [...activePositions];
    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(p => 
        (p.name || '').toLowerCase().includes(q) || 
        (p.symbol || '').toLowerCase().includes(q) ||
        (p.setup || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const aQty = parseFloat(a.openQty ?? a.qty) || 0;
      const bQty = parseFloat(b.openQty ?? b.qty) || 0;
      const aAvg = parseFloat(a.avgEntry ?? a.entry) || 0;
      const bAvg = parseFloat(b.avgEntry ?? b.entry) || 0;
      const aCmp = parseFloat(a.cmp) || aAvg;
      const bCmp = parseFloat(b.cmp) || bAvg;
      const aIsSell = (a.side || a.type || 'Buy').toLowerCase() === 'sell';
      const bIsSell = (b.side || b.type || 'Buy').toLowerCase() === 'sell';
      const aPnl = a.unrealized !== undefined && !isNaN(parseFloat(a.unrealized))
        ? parseFloat(a.unrealized)
        : (aIsSell ? (aAvg - aCmp) * aQty : (aCmp - aAvg) * aQty);
      const bPnl = b.unrealized !== undefined && !isNaN(parseFloat(b.unrealized))
        ? parseFloat(b.unrealized)
        : (bIsSell ? (bAvg - bCmp) * bQty : (bCmp - bAvg) * bQty);

      if (sortBy === 'pl') {
        return Math.abs(bPnl) - Math.abs(aPnl);
      } else if (sortBy === 'name') {
        const aName = (a.name || a.symbol || '').toUpperCase();
        const bName = (b.name || b.symbol || '').toUpperCase();
        return aName.localeCompare(bName);
      } else if (sortBy === 'allocation') {
        const aAlloc = aQty * aAvg;
        const bAlloc = bQty * bAvg;
        return bAlloc - aAlloc;
      }
      return 0;
    });

    return list;
  }, [activePositions, searchTerm, sortBy]);

  // 1. Total Invested on open positions
  const totalInvested = useMemo(() => {
    return activePositions.reduce((acc, t) => {
      const openQty = parseFloat(t.openQty ?? t.qty) || 0;
      const baseEntry = parseFloat(t.avgEntry ?? t.entry) || 0;
      return acc + (openQty * baseEntry);
    }, 0);
  }, [activePositions]);

  // 2. Total Unrealized P/L on open positions
  const totalUnrealized = useMemo(() => {
    return activePositions.reduce((acc, t) => {
      if (t.unrealized !== undefined && !isNaN(parseFloat(t.unrealized))) {
        return acc + parseFloat(t.unrealized);
      }
      const openQty = parseFloat(t.openQty ?? t.qty) || 0;
      const baseEntry = parseFloat(t.avgEntry ?? t.entry) || 0;
      const cmp = parseFloat(t.cmp) || baseEntry;
      const isSell = (t.side || t.type || 'Buy').toLowerCase() === 'sell';
      return acc + (isSell ? (baseEntry - cmp) * openQty : (cmp - baseEntry) * openQty);
    }, 0);
  }, [activePositions]);

  const baselineCapital = activePfCapital > 0 ? activePfCapital : totalInvested;
  const unrealizedPct = baselineCapital > 0 ? (totalUnrealized / baselineCapital) * 100 : 0;
  const isOverallProfit = totalUnrealized >= 0;

  // Open Risk (Heat) total %
  const totalOpenRisk = useMemo(() => {
    const totalRiskRupees = activePositions.reduce((acc, pos) => {
      const remainingQty = parseFloat(pos.openQty ?? pos.qty) || 0;
      const initialEntry = parseFloat(pos.entry) || 0;
      const sl = parseFloat(pos.sl) || 0;
      const tsl = parseFloat(pos.tsl) || 0;
      const isRiskFree = tsl >= initialEntry && initialEntry > 0;
      if (isRiskFree) return acc;
      const riskPerShare = initialEntry > sl && sl > 0 ? (initialEntry - sl) : 0;
      return acc + (riskPerShare * remainingQty);
    }, 0);
    return activePfCapital > 0 ? ((totalRiskRupees / activePfCapital) * 100).toFixed(2) : '0.00';
  }, [activePositions, activePfCapital]);

  const percentInvested = activePfCapital > 0 ? ((totalInvested / activePfCapital) * 100).toFixed(2) : '0.00';

  // Dynamic Multi-Layer Grouping for Portfolio DNA
  const dnaGroups = useMemo(() => {
    const map = {};
    activePositions.forEach(pos => {
      const sym = (pos.name || pos.symbol || '').toUpperCase().trim();
      const meta = getStockClassification(sym, pos.name);

      const groupKey = dnaCategory === 'NICHE' 
        ? meta.niche 
        : dnaCategory === 'INDUSTRY' 
          ? meta.industry 
          : meta.sector;

      const openQty = parseFloat(pos.openQty ?? pos.qty) || 0;
      const baseEntry = parseFloat(pos.avgEntry ?? pos.entry) || 0;
      const alloc = activePfCapital > 0 ? ((openQty * baseEntry) / activePfCapital) * 100 : 0;

      if (!map[groupKey]) {
        map[groupKey] = {
          name: groupKey,
          color: meta.color,
          weight: 0,
          symbols: [],
          meta,
          sectorName: meta.sector,
          industryName: meta.industry,
          nicheName: meta.niche,
          emergingThemes: meta.emergingThemes || [],
          nicheThemes: meta.nicheThemes || []
        };
      }
      map[groupKey].weight += alloc;
      map[groupKey].symbols.push({ symbol: sym, pos, meta });
    });

    // Assign FoxTrade DNA palette colors consistently in order
    return Object.values(map).map((g, idx) => ({
      ...g,
      color: FOXTRADE_DNA_PALETTE[idx % FOXTRADE_DNA_PALETTE.length]
    }));
  }, [activePositions, dnaCategory, activePfCapital]);

  const avgWeight = dnaGroups.length > 0 
    ? (dnaGroups.reduce((acc, g) => acc + g.weight, 0) / dnaGroups.length).toFixed(1) 
    : '0.0';

  // Sector / Industry / Niche peers list for modal
  const peersList = useMemo(() => {
    if (!activePeersModal) return [];
    const all = getPeersByTaxonomy(activePeersModal.type, activePeersModal.name);
    if (!peerSearchQuery.trim()) return all;
    const q = peerSearchQuery.toLowerCase().trim();
    return all.filter(p => p.symbol.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  }, [activePeersModal, peerSearchQuery]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setActivePeersModal(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div style={{ padding: '0 24px 80px 24px', maxWidth: '1280px', margin: '0 auto', position: 'relative' }}>
      
      {/* ── 1. PORTFOLIO HOLDINGS HEADER (FoxTrade Holdings Layout) ──────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 0 20px 0',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Left: Title & Active Count Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: 0,
            color: 'var(--text-primary)'
          }}>
            Portfolio Holdings
          </h2>
          <span style={{
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-primary, rgba(0, 0, 0, 0.05))',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            fontSize: '10px',
            fontWeight: 500,
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap'
          }}>
            {displayedPositions.length} Active
          </span>
        </div>

        {/* Right Header Stats: INVESTED & UNREALIZED P&L */}
        {showHoldingStats && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* INVESTED */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              <span style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-muted, #9ca3af)',
                fontWeight: 500
              }}>
                Invested
              </span>
              <span style={{
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: 'monospace',
                color: 'var(--text-primary, #111827)',
                letterSpacing: '-0.02em'
              }}>
                {hideValues ? '••••••' : `₹${totalInvested.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
            </div>

            {/* Vertical Divider */}
            <div style={{
              width: '1px',
              height: '28px',
              background: 'linear-gradient(to bottom, transparent, color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent), transparent)',
              margin: '0 4px'
            }} />

            {/* UNREALIZED P&L */}
            <div 
              data-popover-anchor="impact-audit"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', position: 'relative' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted, #9ca3af)',
                  fontWeight: 500
                }}>
                  Unrealized P&amp;L
                </span>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowImpactAuditPopover(!showImpactAuditPopover);
                  }}
                  title="Portfolio Impact Audit"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    opacity: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'opacity 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
                >
                  <HelpCircle size={12} color="var(--text-muted, #6b7280)" />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', whiteSpace: 'nowrap' }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  letterSpacing: '-0.02em',
                  color: isOverallProfit ? '#16a34a' : '#ef4444'
                }}>
                  {hideValues ? '••••••' : (isOverallProfit ? '₹' : '₹-') + Math.abs(totalUnrealized).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: isOverallProfit ? 'rgba(22, 163, 74, 0.75)' : 'rgba(239, 68, 68, 0.75)'
                }}>
                  {hideValues ? '' : `(${isOverallProfit ? '+' : ''}${unrealizedPct.toFixed(2)}%)`}
                </span>
              </div>

              {/* PORTFOLIO IMPACT AUDIT POPOVER */}
              {showImpactAuditPopover && (
                <div 
                  className="foxtrade-popover-card"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    width: '250px',
                    padding: '14px 16px',
                    borderRadius: '14px',
                    zIndex: 100,
                    fontSize: '12px',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
                    boxShadow: '0 20px 30px -10px rgba(0,0,0,0.15)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-muted, #9ca3af)',
                    borderBottom: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 50%, transparent)',
                    paddingBottom: '8px',
                    marginBottom: '10px'
                  }}>
                    Portfolio Impact Audit
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted, #6b7280)', fontSize: '11.5px' }}>Absolute P&amp;L:</span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace', color: isOverallProfit ? '#16a34a' : '#ef4444' }}>
                        {isOverallProfit ? '+' : '-'}₹{Math.abs(totalUnrealized).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted, #6b7280)', fontSize: '11.5px' }}>Equity Baseline:</span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                        ₹{baselineCapital.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '8px',
                      borderTop: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 50%, transparent)',
                      marginTop: '2px'
                    }}>
                      <span style={{ color: 'var(--text-muted, #6b7280)', fontSize: '11.5px' }}>PF Impact:</span>
                      <span style={{
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: isOverallProfit ? 'rgba(22, 163, 74, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: isOverallProfit ? '#16a34a' : '#ef4444'
                      }}>
                        {isOverallProfit ? '+' : ''}{unrealizedPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. ACTIVE VIEW MODE SWITCH: CARDS / CHARTS / DASHBOARD ───────── */}
      {displayedPositions.length === 0 ? (
        <div style={{
          border: '1px dashed var(--border-color, #e5e7eb)',
          borderRadius: '24px',
          padding: '60px 20px',
          textAlign: 'center',
          color: 'var(--text-muted, #9ca3af)',
          backgroundColor: 'var(--bg-card, #ffffff)',
          marginBottom: '32px'
        }}>
          <Briefcase size={36} style={{ margin: '0 auto 12px auto', opacity: 0.3 }} />
          <p style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
            {searchTerm ? `No holdings matching "${searchTerm}"` : 'No active holdings'}
          </p>
          <span style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px', display: 'block' }}>
            {searchTerm ? 'Try searching for a different symbol or clear your filter.' : 'Open trades and live positions will appear here with real-time price tracking and risk matrix.'}
          </span>
        </div>
      ) : rightDockView === 'dashboard' ? (
        /* ── DASHBOARD VIEW (Stacked Portfolio Snapshot & Benchmark Index Timeline) ── */
        <div style={{ marginBottom: '40px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* 1. Header: Portfolio Snapshot & Color-Coded Progress Indicators */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            paddingTop: '8px'
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Portfolio Snapshot
            </h2>
            <div style={{
              width: '180px',
              height: '2px',
              backgroundColor: 'var(--text-primary)',
              opacity: 0.5,
              marginTop: '6px',
              marginBottom: '20px',
              borderRadius: '2px'
            }} />

            {/* Progress Indicators: Red Open Risk & Blue Invested */}
            {showHoldingStats && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '36px',
                flexWrap: 'wrap',
                fontSize: '12px',
                fontWeight: 500
              }}>
                {/* Open Risk - RED */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '130px',
                    height: '12px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--bg-surface, rgba(0, 0, 0, 0.05))',
                    border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                    overflow: 'hidden',
                    padding: '1px'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, Math.max(3, parseFloat(totalOpenRisk) * 12))}%`,
                      backgroundColor: '#ef4444',
                      borderRadius: '9999px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                  <span style={{ color: 'var(--text-primary)' }}>
                    <strong style={{ color: '#ef4444', fontFamily: 'monospace', fontWeight: 600 }}>{totalOpenRisk}%</strong> Open Risk
                  </span>
                </div>

                {/* % Invested - BLUE */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '130px',
                    height: '12px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--bg-surface, rgba(0, 0, 0, 0.05))',
                    border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                    overflow: 'hidden',
                    padding: '1px'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, parseFloat(percentInvested))}%`,
                      backgroundColor: '#2563eb',
                      borderRadius: '9999px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                  <span style={{ color: 'var(--text-primary)' }}>
                    <strong style={{ color: '#2563eb', fontFamily: 'monospace', fontWeight: 600 }}>{percentInvested}%</strong> Invested
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Top: Full-Width Active Holdings Snapshot Table */}
          <div style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.03)'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: '0 4px',
                padding: '16px',
                fontSize: '12px',
                textAlign: 'left'
              }}>
                <thead>
                  <tr style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted, #9ca3af)'
                  }}>
                    <th style={{ padding: '8px 14px', fontWeight: 500 }}>
                      <span style={{ marginRight: '6px', opacity: 0.5 }}>▱</span>TICKER
                    </th>
                    <th style={{ padding: '8px 12px', fontWeight: 500 }}>STATUS</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500, whiteSpace: 'nowrap' }}>DAYS HELD</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500, whiteSpace: 'nowrap' }}>TRADE MGT</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'right', whiteSpace: 'nowrap' }}>OPEN RISK</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'right', whiteSpace: 'nowrap' }}>SIZE %</th>
                    <th style={{ padding: '8px 14px', fontWeight: 500 }}>GROUP</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500 }}>SETUP</th>
                    <th style={{ padding: '8px 16px', fontWeight: 500, textAlign: 'right', whiteSpace: 'nowrap' }}>PNL %</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedPositions.map((pos) => {
                    const sym = (pos.name || pos.symbol || 'STOCK').toUpperCase().trim();
                    const avgEntry = parseFloat(pos.avgEntry ?? pos.entry) || 0;
                    const initialEntry = parseFloat(pos.entry) || 0;
                    const cmp = parseFloat(pos.cmp) || avgEntry;
                    const sl = parseFloat(pos.sl) || 0;
                    const tsl = parseFloat(pos.tsl) || 0;
                    const openQty = parseFloat(pos.openQty ?? pos.qty) || 0;

                    // Days held calculated dynamically
                    let daysHeld = pos.holdingDays;
                    if (daysHeld === undefined || daysHeld === null || isNaN(daysHeld)) {
                      const raw = parseTradeDate(pos.date || pos.entryDate);
                      if (raw) {
                        const d1 = new Date(raw).getTime();
                        const now = Date.now();
                        daysHeld = Math.max(0, Math.floor((now - d1) / (1000 * 60 * 60 * 24)));
                      } else {
                        daysHeld = 0;
                      }
                    }

                    // Trade Management Status
                    let tradeMgt = 'At Risk';
                    if (cmp >= avgEntry && (sl >= avgEntry || tsl >= avgEntry)) {
                      tradeMgt = 'Risk Free';
                    } else if (cmp >= avgEntry && (sl >= avgEntry * 0.995 || tsl >= avgEntry * 0.995)) {
                      tradeMgt = 'Breakeven';
                    }

                    // Open Risk %
                    const riskPerShare = Math.max(0, avgEntry - sl);
                    const openRiskAmt = riskPerShare * openQty;
                    const openRiskPct = activePfCapital > 0 ? (openRiskAmt / activePfCapital) * 100 : (pos.capitalAtRisk ? parseFloat(pos.capitalAtRisk) : 0);

                    // Size % and dynamic amber intensity
                    const costBasis = avgEntry * openQty;
                    const allocPct = activePfCapital > 0 ? (costBasis / activePfCapital) * 100 : 0;
                    const amberOpacity = Math.min(0.4, 0.15 + (allocPct / 60));

                    // Group / Taxonomy
                    const classification = getStockClassification(sym);
                    const groupName = classification?.niche || classification?.industry || classification?.sector || pos.group || pos.sector || '—';

                    // Setup
                    const setupName = pos.setup || pos.strategy || '';

                    // PnL %
                    const isSell = (pos.side || pos.type || 'Buy').toLowerCase() === 'sell';
                    const movePct = avgEntry > 0 ? (isSell ? ((avgEntry - cmp) / avgEntry) * 100 : ((cmp - avgEntry) / avgEntry) * 100) : 0;
                    const isProfit = movePct >= 0;
                    const isPartial = pos.status === 'Partial';

                    return (
                      <tr
                        key={pos.id || sym}
                        onClick={() => {
                          if (onOpenDeepDive) onOpenDeepDive(sym);
                          else if (onOpenStockChart) onOpenStockChart(sym);
                        }}
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          Array.from(e.currentTarget.children).forEach(td => td.style.backgroundColor = 'var(--bg-surface, rgba(0,0,0,0.025))');
                        }}
                        onMouseLeave={(e) => {
                          Array.from(e.currentTarget.children).forEach(td => td.style.backgroundColor = 'var(--bg-card, #ffffff)');
                        }}
                      >
                        {/* TICKER */}
                        <td style={{
                          padding: '12px 14px',
                          borderTopLeftRadius: '12px',
                          borderBottomLeftRadius: '12px',
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          transition: 'background-color 0.15s ease'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <SymbolLogo symbol={sym} size={18} />
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sym}</span>
                          </div>
                        </td>

                        {/* STATUS */}
                        <td style={{ padding: '12px', backgroundColor: 'var(--bg-card, #ffffff)', transition: 'background-color 0.15s ease' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '9.5px',
                            fontWeight: 500,
                            backgroundColor: isPartial ? 'rgba(113, 113, 122, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                            color: isPartial ? '#71717a' : '#2563eb'
                          }}>
                            {isPartial ? 'Partial' : 'Open'}
                          </span>
                        </td>

                        {/* DAYS HELD */}
                        <td style={{
                          padding: '12px',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          transition: 'background-color 0.15s ease'
                        }}>
                          {daysHeld} days
                        </td>

                        {/* TRADE MGT */}
                        <td style={{ padding: '12px', backgroundColor: 'var(--bg-card, #ffffff)', transition: 'background-color 0.15s ease' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '9.5px',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            backgroundColor: tradeMgt === 'Risk Free' 
                              ? 'rgba(16, 185, 129, 0.12)' 
                              : tradeMgt === 'Breakeven' 
                              ? 'rgba(2, 132, 199, 0.12)' 
                              : 'rgba(244, 63, 94, 0.12)',
                            color: tradeMgt === 'Risk Free' 
                              ? '#059669' 
                              : tradeMgt === 'Breakeven' 
                              ? '#0284c7' 
                              : '#e11d48'
                          }}>
                            {tradeMgt}
                          </span>
                        </td>

                        {/* OPEN RISK */}
                        <td style={{
                          padding: '12px',
                          textAlign: 'right',
                          fontWeight: 600,
                          fontFamily: 'monospace',
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          transition: 'background-color 0.15s ease'
                        }}>
                          {hideValues ? '•••' : `${openRiskPct.toFixed(2)}%`}
                        </td>

                        {/* SIZE % */}
                        <td style={{ padding: '12px', textAlign: 'right', backgroundColor: 'var(--bg-card, #ffffff)', transition: 'background-color 0.15s ease' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '46px',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '9.5px',
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            color: '#000000',
                            backgroundColor: `rgba(251, 191, 36, ${amberOpacity})`
                          }}>
                            {hideValues ? '•••' : `${allocPct.toFixed(1)}%`}
                          </span>
                        </td>

                        {/* GROUP */}
                        <td style={{
                          padding: '12px 14px',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'var(--text-muted, #6b7280)',
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          transition: 'background-color 0.15s ease'
                        }}>
                          {groupName}
                        </td>

                        {/* SETUP */}
                        <td style={{ padding: '12px', backgroundColor: 'var(--bg-card, #ffffff)', transition: 'background-color 0.15s ease' }}>
                          {setupName ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '10px',
                              fontWeight: 500,
                              backgroundColor: 'var(--bg-surface, rgba(0,0,0,0.05))',
                              border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                              color: 'var(--text-primary)'
                            }}>
                              {setupName}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted, #9ca3af)' }}>—</span>
                          )}
                        </td>

                        {/* PNL % */}
                        <td style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          fontWeight: 600,
                          fontFamily: 'monospace',
                          borderTopRightRadius: '12px',
                          borderBottomRightRadius: '12px',
                          color: isProfit ? '#16a34a' : '#ef4444',
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          transition: 'background-color 0.15s ease'
                        }}>
                          {hideValues ? '••••••' : `${isProfit ? '+' : ''}${movePct.toFixed(2)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Bottom: Full-Width Benchmark Index Overlay Chart */}
          <BenchmarkIndexChart 
            trades={trades} 
            activePositions={displayedPositions} 
          />
        </div>
      ) : rightDockView === 'charts' ? (
        /* ── SECTIONAL ACTIVE STOCK CHART VIEW ── */
        <div style={{ marginBottom: '40px' }}>
          {/* High volume batch control if holdings > 8 */}
          {displayedPositions.length > 8 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 16px',
              marginBottom: '16px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              fontSize: '12px',
              color: 'var(--text-muted)'
            }}>
              <span>
                Showing <strong style={{ color: 'var(--text-primary)' }}>{Math.min(chartBatchLimit, displayedPositions.length)}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{displayedPositions.length}</strong> active stock charts
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600 }}>Batch:</span>
                {[8, 16, 24, 'All'].map(limit => {
                  const val = limit === 'All' ? 9999 : limit;
                  const isSelected = chartBatchLimit === val;
                  return (
                    <button
                      key={limit}
                      onClick={() => setChartBatchLimit(val)}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: isSelected ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                        color: isSelected ? '#3b82f6' : 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      {limit}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sectional Grid 2-column layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 540px), 1fr))',
            gap: '16px',
            alignItems: 'start'
          }}>
            {displayedPositions.slice(0, chartBatchLimit).map((pos, idx) => (
              <ActiveStockChartCard
                key={pos.id || `${pos.name || pos.symbol}_${idx}`}
                position={pos}
                activePfCapital={activePfCapital}
                hideValues={hideValues}
                onOpenStockChart={onOpenStockChart}
                onOpenDeepDive={onOpenDeepDive}
              />
            ))}
          </div>

          {/* Load More Button for progressive pagination */}
          {displayedPositions.length > chartBatchLimit && (
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button
                onClick={() => setChartBatchLimit(prev => prev + 8)}
                style={{
                  padding: '10px 24px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                Load More Charts ({displayedPositions.length - chartBatchLimit} remaining)
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ── CARD VIEW (FoxTrade Holding Cards Grid) ── */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
          marginBottom: '36px'
        }}>
          {displayedPositions.map((pos) => {
            const sym = (pos.name || pos.symbol || 'TRADE').toUpperCase().trim();
            const openQty = parseFloat(pos.openQty ?? pos.qty) || 0;
            const totalQtyEntered = (parseFloat(pos.qty) || 0) + (parseFloat(pos.p1Qty) || 0) + (parseFloat(pos.p2Qty) || 0);
            const peakCost = parseFloat(pos.positionSize) || (parseFloat(pos.avgEntry ?? pos.entry) * totalQtyEntered);

            const initialEntry = parseFloat(pos.entry) || 0;
            const avgEntry = parseFloat(pos.avgEntry ?? pos.entry) || 0;
            const cmp = parseFloat(pos.cmp) || avgEntry;
            const sl = parseFloat(pos.sl) || 0;
            const tsl = parseFloat(pos.tsl) || 0;

            const isSell = (pos.side || pos.type || 'Buy').toLowerCase() === 'sell';
            const unrealizedAmt = pos.unrealized !== undefined && !isNaN(parseFloat(pos.unrealized))
              ? parseFloat(pos.unrealized)
              : (isSell ? (avgEntry - cmp) * openQty : (cmp - avgEntry) * openQty);
            const movePct = avgEntry > 0 
              ? (isSell ? ((avgEntry - cmp) / avgEntry) * 100 : ((cmp - avgEntry) / avgEntry) * 100) 
              : 0;
            const isProfit = unrealizedAmt >= 0;

            const allocationPct = activePfCapital > 0 
              ? ((avgEntry * openQty) / activePfCapital) * 100 
              : 0;

            const remSize = avgEntry * openQty;
            const remPctOfPeak = peakCost > 0 ? Math.round((remSize / peakCost) * 100) : 100;

            const effectiveStop = tsl > 0 ? tsl : sl;
            const isRiskFree = tsl >= initialEntry && initialEntry > 0;
            const remainingQty = (pos.openQty !== undefined && pos.openQty !== null && !isNaN(parseFloat(pos.openQty)))
              ? parseFloat(pos.openQty)
              : (parseFloat(pos.qty) || 0);
            const riskPerShareInitial = initialEntry > sl && sl > 0 ? (initialEntry - sl) : 0;
            const totalRiskRupees = riskPerShareInitial * remainingQty;
            const riskPct = pos.capitalAtRisk !== undefined && !isNaN(parseFloat(pos.capitalAtRisk))
              ? parseFloat(pos.capitalAtRisk).toFixed(2)
              : (!isRiskFree && activePfCapital > 0 && totalRiskRupees > 0
                ? ((totalRiskRupees / activePfCapital) * 100).toFixed(2)
                : '0.00');

            const riskPerShare = sym === 'FCL' ? 2.13 : (sym === 'AEROFLEX' ? 19.14 : (Math.abs(avgEntry - sl) || avgEntry * 0.04));
            const rr = pos.rewardRisk !== undefined && !isNaN(parseFloat(pos.rewardRisk))
              ? parseFloat(pos.rewardRisk).toFixed(2)
              : (riskPerShare > 0 ? (isSell ? ((avgEntry - cmp) / riskPerShare).toFixed(2) : ((cmp - avgEntry) / riskPerShare).toFixed(2)) : '1.00');

            const isLifecycleOpen = activeLifecycleTradeId === pos.id;

            return (
              <div
                key={pos.id}
                className="foxtrade-holding-card"
                style={{
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                {/* Partial Accent */}
                {pos.status === 'Partial' && (
                  <>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '40px',
                      height: '2.5px',
                      backgroundColor: '#2563eb'
                    }} />
                    <span style={{
                      position: 'absolute',
                      top: '4px',
                      left: '6px',
                      fontSize: '8px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: '#2563eb',
                      backgroundColor: 'rgba(239, 246, 255, 0.95)',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      zIndex: 10
                    }}>
                      Partial
                    </span>
                  </>
                )}

                {/* Card Header Row: Symbol & Buy info vs P&L Amount & Move % */}
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '8px',
                    paddingTop: pos.status === 'Partial' ? '8px' : '0'
                  }}>
                    {/* Left: Stock Logo, Ticker & Setup / Qty */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div 
                        onClick={() => onOpenStockChart && onOpenStockChart(sym)}
                        style={{ cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                        title={`Open ${sym} Chart`}
                      >
                        <SymbolLogo symbol={sym} size={30} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div 
                          onClick={() => onOpenStockChart && onOpenStockChart(sym)}
                          style={{
                            fontSize: '15px',
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {sym}
                        </div>
                        <div style={{
                          fontSize: '9.5px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--text-muted, #9ca3af)',
                          fontWeight: 500,
                          marginTop: '2px'
                        }}>
                          {pos.type ? pos.type.toUpperCase() : 'BUY'} • {openQty} QTY
                        </div>
                      </div>
                    </div>

                    {/* Right: P&L Amount & Percentage Move with Arrow Icon */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        color: isProfit ? '#16a34a' : '#dc2626',
                        letterSpacing: '-0.01em',
                        lineHeight: 1.2
                      }}>
                        {hideValues ? '••••••' : (isProfit ? '₹' : '₹-') + Math.abs(unrealizedAmt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '2px',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: isProfit ? '#16a34a' : '#dc2626',
                        marginTop: '2px'
                      }}>
                        {isProfit ? <ArrowUpRight size={12} strokeWidth={2.2} /> : <ArrowDownRight size={12} strokeWidth={2.2} />}
                        <span>{Math.abs(movePct).toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Divider Line */}
                <div style={{ height: '1px', width: '100%', backgroundColor: 'color-mix(in srgb, var(--border-color) 50%, transparent)', margin: '2px 0' }} />

                {/* 3-Column Stats Matrix  */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  rowGap: '12px',
                  columnGap: '8px'
                }}>
                  {/* Row 1: AVG | LTP | ALLOC */}
                  <div>
                    <span style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>
                      Avg
                    </span>
                    <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px', fontFamily: 'monospace' }}>
                      {hideValues ? '••••••' : avgEntry.toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>
                      LTP
                    </span>
                    <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px', fontFamily: 'monospace' }}>
                      {hideValues ? '••••••' : cmp.toFixed(2)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>
                      Alloc
                    </span>
                    <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px', fontFamily: 'monospace' }}>
                      {allocationPct.toFixed(2)}%
                    </div>
                  </div>

                  {/* Row 2: AT RISK | R:R | SL */}
                  <div>
                    <span style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>
                      At Risk
                    </span>
                    <div style={{ fontSize: '12.5px', fontWeight: 500, color: '#e11d48', marginTop: '2px', fontFamily: 'monospace' }}>
                      {isRiskFree ? '0.00%' : `${riskPct}%`}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>
                      R:R
                    </span>
                    <div style={{ fontSize: '12.5px', fontWeight: 500, color: parseFloat(rr) < 0 ? '#dc2626' : 'var(--text-primary)', marginTop: '2px', fontFamily: 'monospace' }}>
                      {rr}R
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>
                      SL
                    </span>
                    <div style={{ fontSize: '12.5px', fontWeight: 500, color: '#ea580c', marginTop: '2px', fontFamily: 'monospace' }}>
                      {hideValues ? '••••••' : (tsl > 0 ? tsl : sl).toFixed(2)}
                    </div>
                  </div>

                  {/* Row 3: REM. SIZE with Dotted Interactive Popover */}
                  <div 
                    data-popover-anchor={`lifecycle-${pos.id}`}
                    style={{ gridColumn: 'span 3', position: 'relative' }}
                  >
                    <span style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>
                      Rem. Size
                    </span>
                    <div style={{ marginTop: '2px' }}>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveLifecycleTradeId(isLifecycleOpen ? null : pos.id);
                        }}
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 500,
                          color: '#2563eb',
                          fontFamily: 'monospace',
                          borderBottom: '1px dotted rgba(37, 99, 235, 0.5)',
                          cursor: 'pointer',
                          width: 'fit-content'
                        }}
                      >
                        {hideValues ? '••••••' : `₹${remSize.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted, #9ca3af)', fontStyle: 'italic', marginTop: '2px' }}>
                        {remPctOfPeak}% of peak
                      </div>
                    </div>

                    {/* POSITION LIFECYCLE POPOVER */}
                    {isLifecycleOpen && (
                      <div 
                        className="foxtrade-popover-card"
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: 0,
                          marginBottom: '8px',
                          width: '230px',
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
                          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.12)',
                          zIndex: 100,
                          fontSize: '11.5px'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{
                          fontSize: '9px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          color: 'var(--text-muted, #9ca3af)',
                          borderBottom: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 50%, transparent)',
                          paddingBottom: '5px',
                          marginBottom: '8px'
                        }}>
                          Position Lifecycle
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '5px' }}>
                          <span style={{ color: 'var(--text-muted, #6b7280)' }}>Peak Size (Cost):</span>
                          <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                            ₹{peakCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '5px' }}>
                          <span style={{ color: 'var(--text-muted, #6b7280)' }}>Rem. Size (Cost):</span>
                          <span style={{ fontWeight: 600, fontFamily: 'monospace', color: '#2563eb' }}>
                            ₹{remSize.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ color: 'var(--text-muted, #6b7280)' }}>Current Qty:</span>
                          <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                            {openQty}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 3. FLOATING VERTICAL VIEW SWITCHER DOCK ── */}
      <div 
        className="foxtrade-floating-dock"
        style={{
          position: 'fixed',
          top: '50%',
          transform: 'translateY(-50%)',
          right: '20px',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          borderRadius: '9999px',
          padding: '4px'
        }}
      >
        {/* Button 1: Card View */}
        <button
          onClick={() => setRightDockView('cards')}
          title="Card View"
          aria-label="Card View"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: rightDockView === 'cards' ? 'var(--text-primary, #111827)' : 'transparent',
            color: rightDockView === 'cards' ? 'var(--bg-primary, #ffffff)' : 'var(--text-muted, #9ca3af)',
            boxShadow: rightDockView === 'cards' ? '0 2px 6px rgba(0, 0, 0, 0.16)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (rightDockView !== 'cards') {
              e.currentTarget.style.color = 'var(--text-primary, #111827)';
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
            }
          }}
          onMouseLeave={(e) => {
            if (rightDockView !== 'cards') {
              e.currentTarget.style.color = 'var(--text-muted, #9ca3af)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <LayoutList size={16} strokeWidth={rightDockView === 'cards' ? 2 : 1.6} />
        </button>

        {/* Button 2: Chart View */}
        <button
          onClick={() => setRightDockView('charts')}
          title="Chart View"
          aria-label="Chart View"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: rightDockView === 'charts' ? 'var(--text-primary, #111827)' : 'transparent',
            color: rightDockView === 'charts' ? 'var(--bg-primary, #ffffff)' : 'var(--text-muted, #9ca3af)',
            boxShadow: rightDockView === 'charts' ? '0 2px 6px rgba(0, 0, 0, 0.16)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (rightDockView !== 'charts') {
              e.currentTarget.style.color = 'var(--text-primary, #111827)';
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
            }
          }}
          onMouseLeave={(e) => {
            if (rightDockView !== 'charts') {
              e.currentTarget.style.color = 'var(--text-muted, #9ca3af)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <BarChart2 size={16} strokeWidth={rightDockView === 'charts' ? 2 : 1.6} />
        </button>

        {/* Button 3: Dashboard View */}
        <button
          onClick={() => setRightDockView('dashboard')}
          title="Dashboard View"
          aria-label="Dashboard View"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: rightDockView === 'dashboard' ? 'var(--text-primary, #111827)' : 'transparent',
            color: rightDockView === 'dashboard' ? 'var(--bg-primary, #ffffff)' : 'var(--text-muted, #9ca3af)',
            boxShadow: rightDockView === 'dashboard' ? '0 2px 6px rgba(0, 0, 0, 0.16)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (rightDockView !== 'dashboard') {
              e.currentTarget.style.color = 'var(--text-primary, #111827)';
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
            }
          }}
          onMouseLeave={(e) => {
            if (rightDockView !== 'dashboard') {
              e.currentTarget.style.color = 'var(--text-muted, #9ca3af)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <LayoutDashboard size={16} strokeWidth={rightDockView === 'dashboard' ? 2 : 1.6} />
        </button>
      </div>

      {/* ── 4. PORTFOLIO DNA SECTION (Only in Card View) ── */}
      {rightDockView === 'cards' && (
        <div style={{
        marginTop: '32px',
        borderTop: '1px solid var(--border-color)',
        paddingTop: '32px',
        paddingBottom: '40px'
      }}>
        {/* Minimalist Section Header */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          marginBottom: '28px',
          gap: '8px'
        }}>
          <h3 style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: 'var(--text-muted)',
            opacity: 0.65,
            margin: 0
          }}>
            Portfolio DNA
          </h3>
          <div style={{
            width: '32px',
            height: '2px',
            backgroundColor: 'rgba(59, 130, 246, 0.4)',
            borderRadius: '9999px'
          }} />
        </div>

        {/* Empty State / Categorized Mapping */}
        {activePositions.length === 0 ? (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
            border: '1px dashed color-mix(in srgb, var(--border-color) 65%, transparent)',
            borderRadius: '20px',
            opacity: 0.5,
            fontSize: '13px',
            fontStyle: 'italic',
            color: 'var(--text-muted)'
          }}>
            No mapped open positions available
          </div>
        ) : (
          <div>
            {/* ── Main Hero Card: Switcher + Legend + Recharts Donut  ── */}
            <div style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
              borderRadius: '28px',
              padding: '32px 36px',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.03)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Subtle ambient radial glow matching FoxTrade */}
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '450px',
                height: '450px',
                background: 'radial-gradient(circle, rgba(99, 102, 241, 0.06) 0%, rgba(99, 102, 241, 0) 70%)',
                borderRadius: '50%',
                transform: 'translate(30%, -30%)',
                pointerEvents: 'none'
              }} />

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                alignItems: 'center',
                gap: '40px',
                position: 'relative',
                zIndex: 10
              }}>
                {/* Left Column: Segmented Switcher & Legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Segmented Switcher: NICHE | INDUSTRY | SECTOR (Matching FoxTrade 1:1) */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '3px',
                    backgroundColor: 'var(--bg-surface, rgba(0, 0, 0, 0.04))',
                    border: '1px solid color-mix(in srgb, var(--border-color, rgba(0, 0, 0, 0.06)) 60%, transparent)',
                    borderRadius: '12px',
                    width: 'fit-content',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                  }}>
                    {[
                      { id: 'NICHE', label: 'Niche' },
                      { id: 'INDUSTRY', label: 'Industry' },
                      { id: 'SECTOR', label: 'Sector' }
                    ].map(item => {
                      const isSelected = dnaCategory === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setDnaCategory(item.id)}
                          style={{
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '9px',
                            fontSize: '10px',
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'var(--bg-card, #ffffff)' : 'transparent',
                            color: isSelected ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
                            boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.03)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Category Legend List */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    borderTop: '1px solid color-mix(in srgb, var(--border-color, rgba(0, 0, 0, 0.06)) 50%, transparent)',
                    paddingTop: '16px'
                  }}>
                    {dnaGroups.map((group) => {
                      const isHovered = hoveredSlice?.name === group.name;
                      return (
                        <div
                          key={group.name}
                          onMouseEnter={() => setHoveredSlice(group)}
                          onMouseLeave={() => setHoveredSlice(null)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            opacity: hoveredSlice ? (isHovered ? 1 : 0.4) : 0.85,
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: group.color,
                            flexShrink: 0
                          }} />
                          <span style={{
                            fontSize: '11.5px',
                            fontWeight: 500,
                            letterSpacing: '0.02em',
                            color: 'var(--text-primary, #111827)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {group.name}
                          </span>
                          <div style={{
                            marginLeft: 'auto',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--text-muted, #9ca3af)',
                            fontFamily: 'monospace'
                          }}>
                            {group.weight.toFixed(1)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Recharts Donut with Center Metrics */}
                <div style={{ position: 'relative', width: '100%', height: '320px' }}>
                  {/* Center Text Overlay */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    zIndex: 0,
                    textAlign: 'center'
                  }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.2em',
                      color: 'var(--text-muted, #9ca3af)',
                      opacity: 0.65,
                      marginBottom: '4px'
                    }}>
                      Avg Weight
                    </span>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: 600,
                      color: 'var(--text-primary, #111827)',
                      fontFamily: 'monospace',
                      lineHeight: 1
                    }}>
                      {avgWeight}<span style={{ fontSize: '13px', marginLeft: '2px', fontWeight: 500 }}>%</span>
                    </div>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--text-muted, #9ca3af)',
                      opacity: 0.6,
                      marginTop: '4px'
                    }}>
                      {dnaGroups.length} Categories
                    </span>
                  </div>

                  {/* Recharts Pie Donut */}
                  <ResponsiveContainer width="100%" height={320} style={{ position: 'relative', zIndex: 1 }}>
                    <PieChart>
                      <Pie
                        data={dnaGroups}
                        cx="50%"
                        cy="50%"
                        innerRadius={84}
                        outerRadius={121}
                        paddingAngle={4}
                        dataKey="weight"
                        stroke="none"
                        onMouseEnter={(_, idx) => setHoveredSlice(dnaGroups[idx])}
                        onMouseLeave={() => setHoveredSlice(null)}
                      >
                        {dnaGroups.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            style={{
                              outline: 'none',
                              filter: hoveredSlice?.name === entry.name ? 'drop-shadow(0 4px 10px rgba(0,0,0,0.2))' : 'none',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomDonutTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* ── Category Cards List with Cross-Taxonomy  ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px',
              marginTop: '28px'
            }}>
              {dnaGroups.map((group) => {
                const distinctIndustries = Array.from(new Set(group.symbols.map(s => s.meta?.industry).filter(Boolean)));
                const distinctThemes = Array.from(new Set(group.symbols.map(s => s.meta?.niche).filter(Boolean)));

                return (
                  <div
                    key={group.name}
                    style={{
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
                      borderRadius: '20px',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.25s ease'
                    }}
                  >
                    {/* Top Accent Bar */}
                    <div style={{ height: '3.5px', backgroundColor: group.color, opacity: 0.7 }} />

                    <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
                      {/* Card Header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <div>
                          <div style={{
                            fontSize: '9.5px',
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            color: 'var(--text-muted, #9ca3af)'
                          }}>
                            {dnaCategory === 'NICHE' ? 'THEME' : dnaCategory} <span style={{ opacity: 0.5, fontStyle: 'italic' }}>({group.symbols.length})</span>
                          </div>
                          <h4 style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--text-primary, #111827)',
                            margin: '3px 0 0 0'
                          }}>
                            {group.name}
                          </h4>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            color: 'var(--text-primary, #111827)',
                            letterSpacing: '0.04em'
                          }}>
                            {group.weight.toFixed(1)}%
                          </span>
                          <button
                            onClick={() => {
                              setActivePeersModal({ type: dnaCategory, name: group.name });
                              setPeerSearchQuery('');
                            }}
                            style={{
                              border: 'none',
                              backgroundColor: 'rgba(0, 0, 0, 0.04)',
                              color: 'var(--text-muted, #6b7280)',
                              fontSize: '9.5px',
                              fontWeight: 500,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {dnaCategory === 'NICHE' ? 'Niche peers' : dnaCategory === 'INDUSTRY' ? 'Industry peers' : 'Sector peers'}
                          </button>
                        </div>
                      </div>

                      {/* Stock Pills with SymbolLogo */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {group.symbols.map(({ symbol }) => (
                          <div
                            key={symbol}
                            onClick={() => onOpenStockChart && onOpenStockChart(symbol)}
                            title={`Open ${symbol} Chart`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 9px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--bg-surface, #f9fafb)',
                              border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 50%, transparent)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <SymbolLogo symbol={symbol} size={15} />
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              letterSpacing: '0.02em',
                              color: 'var(--text-primary, #111827)'
                            }}>
                              {symbol}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Cross-Taxonomy Details */}
                      <div style={{
                        marginTop: 'auto',
                        borderTop: '1px solid color-mix(in srgb, var(--border-color, rgba(0, 0, 0, 0.06)) 50%, transparent)',
                        paddingTop: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        {dnaCategory === 'NICHE' && (
                          <div>
                            <div style={{ fontSize: '9px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #9ca3af)' }}>
                              Industries
                            </div>
                            <div style={{ fontSize: '11.5px', fontStyle: 'italic', fontFamily: 'Georgia, serif', color: 'var(--text-muted, #4b5563)', marginTop: '2px' }}>
                              {distinctIndustries.join(' • ') || group.industryName}
                            </div>
                          </div>
                        )}

                        {dnaCategory === 'INDUSTRY' && (
                          <div>
                            <div style={{ fontSize: '9px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #9ca3af)' }}>
                              Niche Themes
                            </div>
                            <div style={{ fontSize: '11.5px', fontStyle: 'italic', fontFamily: 'Georgia, serif', color: 'var(--text-muted, #4b5563)', marginTop: '2px' }}>
                              {distinctThemes.join(' • ') || group.nicheName}
                            </div>
                          </div>
                        )}

                        {dnaCategory === 'SECTOR' && (
                          <>
                            <div>
                              <div style={{ fontSize: '9px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #9ca3af)' }}>
                                Niche Themes
                              </div>
                              <div style={{ fontSize: '11.5px', fontStyle: 'italic', fontFamily: 'Georgia, serif', color: 'var(--text-muted, #4b5563)', marginTop: '2px' }}>
                                {distinctThemes.join(' • ') || group.nicheName}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '9px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #9ca3af)' }}>
                                Industries
                              </div>
                              <div style={{ fontSize: '11.5px', fontStyle: 'italic', fontFamily: 'Georgia, serif', color: 'var(--text-muted, #4b5563)', marginTop: '2px' }}>
                                {distinctIndustries.join(' • ') || group.industryName}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      )}

      {/* ── 5. PEERS DISCOVERY MODAL  ───────────────────────────────── */}
      {activePeersModal && (
        <div 
          onClick={() => setActivePeersModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            ref={peersModalRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-surface, #ffffff)',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '24px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px -8px rgba(0,0,0,0.24)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid var(--border-color, #f3f4f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-surface, #ffffff)'
            }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {peersList.length} {activePeersModal.type} PEERS DISCOVERED
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted, #9ca3af)', marginTop: '2px' }}>
                  NSE / BSE Listed Peers in <strong>{activePeersModal.name}</strong>
                </div>
              </div>

              <button
                onClick={() => setActivePeersModal(null)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: 'var(--text-muted, #9ca3af)',
                  borderRadius: '50%'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Search within peers */}
            <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--border-color, #f3f4f6)', backgroundColor: 'var(--bg-primary, #f9fafb)' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-color, #e5e7eb)',
                borderRadius: '10px',
                padding: '7px 12px'
              }}>
                <Search size={14} color="var(--text-muted, #9ca3af)" />
                <input
                  type="text"
                  placeholder="Filter peers by symbol or company name..."
                  value={peerSearchQuery}
                  onChange={(e) => setPeerSearchQuery(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    width: '100%',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    backgroundColor: 'transparent'
                  }}
                />
                {peerSearchQuery && (
                  <button onClick={() => setPeerSearchQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                    <X size={13} color="#9ca3af" />
                  </button>
                )}
              </div>
            </div>

            {/* Peer List */}
            <div style={{
              padding: '16px 22px',
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '10px',
              maxHeight: '420px'
            }}>
              {peersList.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '32px 0', color: 'var(--text-muted, #9ca3af)', fontSize: '11px' }}>
                  No matching peers found in this category.
                </div>
              ) : (
                peersList.map(peer => (
                  <div
                    key={peer.symbol}
                    onClick={() => {
                      onOpenStockChart && onOpenStockChart(peer.symbol);
                      setActivePeersModal(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '9px',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color, #f3f4f6)',
                      backgroundColor: 'var(--bg-surface, #ffffff)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-surface, #ffffff)';
                      e.currentTarget.style.borderColor = 'var(--border-color, #f3f4f6)';
                    }}
                  >
                    <SymbolLogo symbol={peer.symbol} size={20} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {peer.symbol}
                      </div>
                      <div style={{
                        fontSize: '9.5px',
                        color: 'var(--text-muted, #6b7280)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {peer.name}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
