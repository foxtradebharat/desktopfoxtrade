import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Info, X, ChevronDown, ChevronLeft, ChevronRight, Check, Filter } from 'lucide-react';
import SymbolLogo from './SymbolLogo';
import BrokerLogo from './BrokerLogo';
import TradeChargesPopover from './TradeChargesPopover';
import NetPnlTrajectoryChart from './NetPnlTrajectoryChart';
import { getBrokerDisplayName } from '../services/brokerLogos';

// ── Broker metadata ──────────────────────────────────────────────────────────
const BROKER_META = {
  zerodha:  { label: 'Zerodha',  initials: 'ZRD', color: '#387ed1', bg: '#e8f0fb' },
  groww:    { label: 'Groww',    initials: 'GRW', color: '#00b386', bg: '#e0f7f1' },
  dhan:     { label: 'Dhan',     initials: 'DHN', color: '#7c3aed', bg: '#ede9fe' },
  upstox:   { label: 'Upstox',  initials: 'UPX', color: '#f97316', bg: '#fff3e8' },
  angelone: { label: 'AngelOne',initials: 'ANG', color: '#ef4444', bg: '#fce8e8' },
  fyers:    { label: 'Fyers',   initials: 'FYR', color: '#0ea5e9', bg: '#e0f2fe' },
  mstock:   { label: 'mStock',  initials: 'MST', color: '#1e3a8a', bg: '#e0e7ff' },
  kotak:    { label: 'Kotak',   initials: 'KTK', color: '#dc2626', bg: '#fee2e2' },
};

const BROKER_FILTER_OPTIONS = [
  { id: 'all',         label: 'All Brokers', initials: 'ALL', color: '#4b5563', bg: '#f3f4f6' },
  { id: 'zerodha',     label: 'Zerodha',     initials: 'ZRD', color: '#387ed1', bg: '#e8f0fb' },
  { id: 'groww',       label: 'Groww',       initials: 'GRW', color: '#00b386', bg: '#e0f7f1' },
  { id: 'dhan',        label: 'Dhan',        initials: 'DHN', color: '#7c3aed', bg: '#ede9fe' },
  { id: 'upstox',      label: 'Upstox',      initials: 'UPX', color: '#f97316', bg: '#fff3e8' },
  { id: 'angelone',    label: 'AngelOne',    initials: 'ANG', color: '#ef4444', bg: '#fce8e8' },
  { id: 'fyers',       label: 'Fyers',       initials: 'FYR', color: '#0ea5e9', bg: '#e0f2fe' },
  { id: 'mstock',      label: 'mStock',      initials: 'MST', color: '#1e3a8a', bg: '#e0e7ff' },
  { id: 'kotak',       label: 'Kotak',       initials: 'KTK', color: '#dc2626', bg: '#fee2e2' },
  { id: 'not_defined', label: 'No Broker',   initials: '—',   color: '#9ca3af', bg: '#f3f4f6' },
];

function BrokerBadge({ broker }) {
  if (!broker || broker === 'not_defined') {
    return (
      <span style={{ fontSize: '11px', color: 'var(--text-muted, #9ca3af)', fontStyle: 'italic', fontWeight: 400 }}>
        No Broker
      </span>
    );
  }
  const label = getBrokerDisplayName(broker);
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '11px',
      fontWeight: 500,
      padding: '2.5px 7px',
      borderRadius: '6px',
      backgroundColor: 'rgba(0, 0, 0, 0.03)',
      color: 'var(--text-primary, #111827)',
      border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)'
    }}>
      <BrokerLogo broker={broker} size={15} />
      <span>{label}</span>
    </span>
  );
}

function SegmentBadge({ segment }) {
  if (!segment) return null;
  const isIntra = segment.toLowerCase() === 'intraday';
  return (
    <span style={{
      fontSize: '9.5px',
      fontWeight: 500,
      padding: '2px 6px',
      borderRadius: '4px',
      backgroundColor: isIntra ? 'rgba(245,158,11,0.08)' : 'rgba(99,102,241,0.07)',
      color: isIntra ? '#d97706' : '#4f46e5',
      textTransform: 'uppercase',
      letterSpacing: '0.04em'
    }}>
      {isIntra ? 'INTRA' : 'DEL'}
    </span>
  );
}

// ── Breakdown Popover ─────────────────────────────────────────────────────────
function BreakdownPopover({ onClose, totalGross, totalChargesObj, totalNet, tradesWithoutBroker, hideValues }) {
  const fmt = (v) =>
    hideValues
      ? '\u2022\u2022\u2022\u2022\u2022\u2022'
      : '\u20b9' + Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = (v) => (v >= 0 ? '+' : '-');
  const rows = [
    { label: 'STT', value: totalChargesObj.stt },
    { label: 'Brokerage', value: totalChargesObj.brokerage },
    { label: 'Exchange Fees', value: totalChargesObj.exchangeFee },
    { label: 'GST on Brokerage', value: totalChargesObj.gst },
    { label: 'SEBI Charges', value: totalChargesObj.sebi },
    { label: 'Stamp Duty', value: totalChargesObj.stampDuty },
  ];
  return (
    <div
      style={{
        position: 'absolute',
        top: '110%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 500,
        backgroundColor: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, rgba(0,0,0,0.10))',
        borderRadius: '16px',
        boxShadow: '0 20px 40px -8px rgba(0,0,0,0.18)',
        padding: '18px 20px',
        minWidth: '310px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>P&L Breakdown</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #9ca3af)', display: 'flex', padding: '2px' }}
        >
          <X size={14} />
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #374151)' }}>Gross P&L (Realized)</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: totalGross >= 0 ? '#16a34a' : '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
          {hideValues ? '••••••' : sign(totalGross) + fmt(totalGross)}
        </span>
      </div>
      <div style={{ borderTop: '1px dashed var(--border-color, #e5e7eb)', margin: '10px 0' }} />
      {rows.map(({ label, value }) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #6b7280)' }}>{label}</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
            {hideValues ? '••••' : value > 0 ? '-' + fmt(value) : '₹0.00'}
          </span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid var(--border-color, #e5e7eb)', margin: '10px 0 8px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #374151)' }}>Total Charges</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
          {hideValues ? '••••••' : totalChargesObj.total > 0 ? '-' + fmt(totalChargesObj.total) : '₹0.00'}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: totalNet >= 0 ? 'rgba(22,163,74,0.06)' : 'rgba(239,68,68,0.06)',
          border: '1px solid ' + (totalNet >= 0 ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.15)'),
          borderRadius: '10px',
          padding: '10px 12px'
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>Net P&L</span>
        <span style={{ fontSize: '14px', fontWeight: 800, color: totalNet >= 0 ? '#16a34a' : '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
          {hideValues ? '\u2022\u2022\u2022\u2022\u2022\u2022' : sign(totalNet) + fmt(totalNet)}
        </span>
      </div>
      {tradesWithoutBroker > 0 && (
        <div style={{ marginTop: '12px', fontSize: '11px', color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: '8px', padding: '8px 10px', lineHeight: 1.5 }}>
          \u26a0 {tradesWithoutBroker} trade{tradesWithoutBroker > 1 ? 's have' : ' has'} no broker set \u2014 charges not included for those.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function TradeGridMatrixView({
  trades = [],
  portfolioCapital = 212880.89,
  metrics = {},
  hideValues = false,
  searchTerm = '',
  sortBy = 'pnl_pct',
  onOpenStockChart,
  onEditTrade,
  onUpdateTrade
}) {
  const [editingCmpId, setEditingCmpId] = useState(null);
  const [editingCmpValue, setEditingCmpValue] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showGrossTooltip, setShowGrossTooltip] = useState(false);
  const [viewMode, setViewMode] = useState('closed'); // 'closed' | 'open'
  const [sortMode, setSortMode] = useState('pnl'); // 'pnl' | 'name' | 'date'

  // Broker filter state
  const [brokerFilter, setBrokerFilter] = useState('all');
  const [isBrokerFilterOpen, setIsBrokerFilterOpen] = useState(false);
  const brokerFilterRef = useRef(null);

  // Pagination states (matching journal trade logging section)
  const [pageSize, setPageSize] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRowsDropdownOpen, setIsRowsDropdownOpen] = useState(false);
  const rowsDropdownRef = useRef(null);

  const breakdownRef = useRef(null);
  const grossRef = useRef(null);
  const capital = metrics?.portfolioCapital || portfolioCapital;

  // Close popovers on outside click
  useEffect(() => {
    const handler = (e) => {
      if (showBreakdown && breakdownRef.current && !breakdownRef.current.contains(e.target)) {
        setShowBreakdown(false);
      }
      if (showGrossTooltip && grossRef.current && !grossRef.current.contains(e.target)) {
        setShowGrossTooltip(false);
      }
      if (isRowsDropdownOpen && rowsDropdownRef.current && !rowsDropdownRef.current.contains(e.target)) {
        setIsRowsDropdownOpen(false);
      }
      if (isBrokerFilterOpen && brokerFilterRef.current && !brokerFilterRef.current.contains(e.target)) {
        setIsBrokerFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showBreakdown, showGrossTooltip, isRowsDropdownOpen, isBrokerFilterOpen]);

  // Reset page to 1 when switching views, search, or broker filter
  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, searchTerm, brokerFilter]);

  // ── Closed Trades (filtered by search and broker) ──────────────────────────
  const closedTrades = useMemo(() => {
    let list = (trades || []).filter((t) => t.status === 'Closed');

    // Broker filter
    if (brokerFilter !== 'all') {
      if (brokerFilter === 'not_defined') {
        list = list.filter((t) => !t.broker || t.broker === 'not_defined');
      } else {
        list = list.filter((t) => (t.broker || '').toLowerCase() === brokerFilter.toLowerCase());
      }
    }

    // Search term
    if (searchTerm?.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((t) => (t.name || '').toLowerCase().includes(q) || (t.symbol || '').toLowerCase().includes(q));
    }

    // Sorting
    list.sort((a, b) => {
      if (sortMode === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortMode === 'date') return (b.e1Date || b.date || '').localeCompare(a.e1Date || a.date || '');
      return Math.abs(Number(b.netPnl ?? b.grossPnl ?? b.pl ?? 0)) - Math.abs(Number(a.netPnl ?? a.grossPnl ?? a.pl ?? 0));
    });
    return list;
  }, [trades, searchTerm, sortMode, brokerFilter]);

  // ── Open Holdings ──────────────────────────────────────────────────────────
  const openPositions = useMemo(() => {
    let list = (trades || []).filter(
      (t) => (t.status === 'Open' || t.status === 'Partial') && (parseFloat(t.openQty ?? t.qty) || 0) > 0
    );

    // Broker filter
    if (brokerFilter !== 'all') {
      if (brokerFilter === 'not_defined') {
        list = list.filter((t) => !t.broker || t.broker === 'not_defined');
      } else {
        list = list.filter((t) => (t.broker || '').toLowerCase() === brokerFilter.toLowerCase());
      }
    }

    if (searchTerm?.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((t) => (t.name || '').toLowerCase().includes(q) || (t.symbol || '').toLowerCase().includes(q));
    }
    return list;
  }, [trades, searchTerm, brokerFilter]);

  // ── Broker Counts for Dropdown ─────────────────────────────────────────────
  const brokerCounts = useMemo(() => {
    const counts = {};
    const relevantTrades = (trades || []).filter((t) => (viewMode === 'closed' ? t.status === 'Closed' : t.status === 'Open' || t.status === 'Partial'));
    counts['all'] = relevantTrades.length;
    BROKER_FILTER_OPTIONS.forEach((opt) => {
      if (opt.id === 'all') return;
      if (opt.id === 'not_defined') {
        counts['not_defined'] = relevantTrades.filter((t) => !t.broker || t.broker === 'not_defined').length;
      } else {
        counts[opt.id] = relevantTrades.filter((t) => (t.broker || '').toLowerCase() === opt.id).length;
      }
    });
    return counts;
  }, [trades, viewMode]);

  const activeBrokerOpt = BROKER_FILTER_OPTIONS.find((b) => b.id === brokerFilter) || BROKER_FILTER_OPTIONS[0];

  // ── Summary Metrics ────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let totalGross = 0, totalNet = 0;
    let brokerage = 0, stt = 0, exchangeFee = 0, gst = 0, sebi = 0, stampDuty = 0, totalCharges = 0;
    let tradesWithoutBroker = 0;

    closedTrades.forEach((t) => {
      const gross = Number(t.grossPnl ?? t.pl ?? t.pnl ?? 0);
      const net = Number(t.netPnl ?? gross);
      totalGross += gross;
      totalNet += net;
      if (t.charges?.hasCharges) {
        brokerage += Number(t.charges.brokerage || 0);
        stt += Number(t.charges.stt || 0);
        exchangeFee += Number(t.charges.exchangeFee || 0);
        gst += Number(t.charges.gst || 0);
        sebi += Number(t.charges.sebi || 0);
        stampDuty += Number(t.charges.stampDuty || 0);
        totalCharges += Number(t.charges.total || 0);
      } else if (!t.broker || t.broker === 'not_defined') {
        tradesWithoutBroker++;
      }
    });

    const r = (v) => Math.round(v * 100) / 100;
    return {
      totalGross: r(totalGross),
      totalNet: r(totalNet),
      isProfit: totalNet >= 0,
      pfImpact: r(capital > 0 ? (totalNet / capital) * 100 : 0),
      chargesObj: {
        brokerage: r(brokerage),
        stt: r(stt),
        exchangeFee: r(exchangeFee),
        gst: r(gst),
        sebi: r(sebi),
        stampDuty: r(stampDuty),
        total: r(totalCharges),
      },
      tradesWithoutBroker,
      hasAnyCharges: totalCharges > 0,
    };
  }, [closedTrades, capital]);

  // ── Pagination Calculation ─────────────────────────────────────────────────
  const currentList = viewMode === 'closed' ? closedTrades : openPositions;
  const totalTradesCount = currentList.length;
  const totalPages = Math.max(1, Math.ceil(totalTradesCount / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safeCurrentPage - 1) * pageSize;
  const paginatedList = currentList.slice(startIdx, startIdx + pageSize);
  const startItem = totalTradesCount === 0 ? 0 : startIdx + 1;
  const endItem = Math.min(startIdx + pageSize, totalTradesCount);

  const handleSaveCmp = (id) => {
    const val = parseFloat(editingCmpValue);
    if (!isNaN(val) && val > 0 && onUpdateTrade) {
      const t = trades.find((x) => x.id === id);
      if (t) onUpdateTrade({ ...t, cmp: val });
    }
    setEditingCmpId(null);
  };

  const fmt = (v) =>
    hideValues
      ? '\u2022\u2022\u2022\u2022\u2022\u2022'
      : '\u20b9' + Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = (v) => (v >= 0 ? '+' : '-');

  return (
    <div style={{ padding: '0 28px 80px 28px', maxWidth: '1640px', margin: '0 auto' }}>
      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .pnl-grid-row {
          transition: background-color 0.12s ease;
        }
        .pnl-grid-row:hover,
        .pnl-grid-row:hover > td {
          background-color: var(--bg-hover, #f3f4f6) !important;
        }
        [data-theme="dark"] .pnl-grid-row:hover,
        [data-theme="dark"] .pnl-grid-row:hover > td,
        .dark .pnl-grid-row:hover,
        .dark .pnl-grid-row:hover > td {
          background-color: rgba(255, 255, 255, 0.06) !important;
        }
        [data-theme="pitch-black"] .pnl-grid-row:hover,
        [data-theme="pitch-black"] .pnl-grid-row:hover > td,
        body[data-theme="pitch-black"] .pnl-grid-row:hover,
        body[data-theme="pitch-black"] .pnl-grid-row:hover > td {
          background-color: rgba(255, 255, 255, 0.08) !important;
        }
        .pnl-table-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .pnl-table-scroll::-webkit-scrollbar-thumb {
          background: var(--border-hover, rgba(0, 0, 0, 0.15));
          border-radius: 4px;
        }
        .pnl-table-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>

      {/* ── TOP NET P&L SUMMARY CARD ───────────────────────────────────────── */}
      <div
        style={{
          maxWidth: '460px',
          margin: '8px auto 28px auto',
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
          borderRadius: '16px',
          padding: '22px 28px',
          boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0, 0, 0, 0.03))',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Net P&L
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#16a34a', opacity: 0.9 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#16a34a',
                display: 'inline-block',
                animation: 'livePulse 2s ease-in-out infinite'
              }}
            />
            LIVE
          </span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <span
            style={{
              fontSize: '28px',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
              color: closedTrades.length === 0 ? '#9ca3af' : summary.isProfit ? '#16a34a' : '#ef4444'
            }}
          >
            {closedTrades.length === 0 ? '\u20b90.00' : hideValues ? '\u2022\u2022\u2022\u2022\u2022\u2022' : sign(summary.totalNet) + fmt(summary.totalNet)}
          </span>
        </div>

        {closedTrades.length > 0 && (
          <div
            style={{
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: 500,
              marginBottom: '16px',
              color: summary.isProfit ? 'rgba(22,163,74,0.85)' : 'rgba(239,68,68,0.85)'
            }}
          >
            {hideValues ? 'PF Impact \u2022\u2022\u2022' : 'PF Impact ' + (summary.isProfit ? '+' : '') + summary.pfImpact.toFixed(2) + '%'}
          </div>
        )}

        {closedTrades.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              borderTop: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 50%, transparent)',
              paddingTop: '16px',
              gap: '8px'
            }}
          >
            <div ref={grossRef} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted, #6b7280)', fontWeight: 500, marginBottom: '2px' }}>
                <span>Gross P&L</span>
                <button
                  type="button"
                  aria-label="About Gross P&L"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowGrossTooltip((v) => !v);
                  }}
                  onMouseEnter={() => setShowGrossTooltip(true)}
                  onMouseLeave={() => setShowGrossTooltip(false)}
                  style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', padding: '1px', background: 'none', border: 'none' }}
                >
                  <Info size={11} style={{ color: showGrossTooltip ? '#374151' : '#9ca3af', opacity: 0.7, transition: 'color 0.15s' }} />
                </button>
              </div>
              {showGrossTooltip && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 8px)',
                    left: '0',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 75%, transparent)',
                    color: 'var(--text-primary, #111827)',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    lineHeight: 1.45,
                    width: '230px',
                    boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 100,
                    pointerEvents: 'none'
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '3px', color: 'var(--text-primary, #111827)', fontSize: '11.5px' }}>Closed Trades Only</div>
                  <div style={{ color: 'var(--text-muted, #6b7280)', fontSize: '11px' }}>
                    This Gross P&L is calculated strictly from 100% closed trades. Partial profit bookings on open holdings are excluded here.
                  </div>
                </div>
              )}
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary, #111827)', fontVariantNumeric: 'tabular-nums' }}>
                {hideValues ? '••••••' : sign(summary.totalGross) + fmt(summary.totalGross)}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', fontWeight: 500, marginBottom: '2px' }}>Charges</div>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                {hideValues ? '\u2022\u2022\u2022\u2022' : summary.chargesObj.total > 0 ? '-' + fmt(summary.chargesObj.total) : '\u20b90.00'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', fontWeight: 500, marginBottom: '2px' }}>Net P&L</div>
              <div
                style={{
                  fontSize: '13.5px',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: summary.isProfit ? '#16a34a' : '#ef4444'
                }}
              >
                {hideValues ? '\u2022\u2022\u2022\u2022\u2022\u2022' : sign(summary.totalNet) + fmt(summary.totalNet)}
              </div>
            </div>
          </div>
        )}

        {closedTrades.length === 0 && (
          <div style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
            Net P&L appears here once you close a trade.
          </div>
        )}

        {closedTrades.length > 0 && (
          <div ref={breakdownRef} style={{ position: 'absolute', top: '14px', right: '14px' }}>
            <button
              onClick={() => setShowBreakdown((o) => !o)}
              title="View P&L breakdown"
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: showBreakdown ? 'rgba(0,0,0,0.05)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
                e.currentTarget.style.color = '#374151';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = showBreakdown ? 'rgba(0,0,0,0.05)' : 'transparent';
                e.currentTarget.style.color = '#9ca3af';
              }}
            >
              <Info size={14} />
            </button>
            {showBreakdown && (
              <BreakdownPopover
                onClose={() => setShowBreakdown(false)}
                totalGross={summary.totalGross}
                totalChargesObj={summary.chargesObj}
                totalNet={summary.totalNet}
                tradesWithoutBroker={summary.tradesWithoutBroker}
                hideValues={hideValues}
              />
            )}
          </div>
        )}
      </div>

      {/* ── VIEW TOGGLE & SORT / BROKER FILTER CONTROLS ───────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        {/* Left: View Toggle (Closed vs Open) */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.03)',
            border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
            borderRadius: '9999px',
            padding: '3px',
            gap: '2px'
          }}
        >
          {[
            { id: 'closed', label: `Net P\u0026L \u2014 Closed (${closedTrades.length})` },
            { id: 'open', label: `Open Holdings (${openPositions.length})` },
          ].map((item) => {
            const active = viewMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setViewMode(item.id)}
                style={{
                  border: 'none',
                  padding: '5px 14px',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: active ? 600 : 500,
                  transition: 'all 0.15s ease',
                  backgroundColor: active ? 'var(--bg-card, #ffffff)' : 'transparent',
                  color: active ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
                  boxShadow: active ? 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))' : 'none'
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Right side controls: Broker Filter Dropdown + Sort pills (Name, Date, P&L) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* ── VERTICAL BROKER FILTER DROPDOWN ── */}
          <div ref={brokerFilterRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsBrokerFilterOpen((prev) => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                height: '32px',
                padding: '0 12px',
                borderRadius: '9999px',
                border: brokerFilter !== 'all' ? '1px solid var(--border-color, #d1d5db)' : '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
                backgroundColor: 'var(--bg-surface, #ffffff)',
                color: 'var(--text-primary, #111827)',
                fontSize: '12px',
                fontWeight: brokerFilter !== 'all' ? 600 : 500,
                cursor: 'pointer',
                boxShadow: brokerFilter !== 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease',
                userSelect: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f9fafb)';
                e.currentTarget.style.borderColor = 'var(--border-color, #d1d5db)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface, #ffffff)';
                e.currentTarget.style.borderColor = brokerFilter !== 'all' ? 'var(--border-color, #d1d5db)' : 'color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)';
              }}
            >
              {brokerFilter !== 'all' ? (
                <BrokerLogo broker={activeBrokerOpt.id} size={15} />
              ) : (
                <Filter size={12} style={{ color: 'var(--text-muted, #6b7280)' }} />
              )}

              <span>{activeBrokerOpt.label}</span>

              <ChevronDown
                size={12}
                style={{
                  color: 'var(--text-muted, #6b7280)',
                  transition: 'transform 0.15s ease',
                  transform: isBrokerFilterOpen ? 'rotate(180deg)' : 'none'
                }}
              />
            </button>

            {/* Vertical Dropdown Popover */}
            {isBrokerFilterOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  zIndex: 100,
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  borderRadius: '12px',
                  border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 75%, transparent)',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
                  minWidth: '200px',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  animation: 'brkIn 0.12s ease forwards'
                }}
              >
                <div
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 600,
                    color: 'var(--text-muted, #9ca3af)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '5px 8px 6px'
                  }}
                >
                  Filter By Broker
                </div>

                <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {BROKER_FILTER_OPTIONS.map((opt) => {
                    const isSelected = brokerFilter === opt.id;
                    const count = brokerCounts[opt.id] || 0;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setBrokerFilter(opt.id);
                          setIsBrokerFilterOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 8px',
                          borderRadius: '6px',
                          backgroundColor: isSelected ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '12.5px',
                          color: isSelected ? 'var(--text-primary, #111827)' : 'var(--text-secondary, #374151)',
                          fontWeight: isSelected ? 600 : 400,
                          transition: 'background-color 0.1s ease',
                          userSelect: 'none'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {opt.id === 'all' ? (
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                padding: '1.5px 5px',
                                borderRadius: '4px',
                                backgroundColor: '#f3f4f6',
                                color: '#4b5563',
                                letterSpacing: '0.04em'
                              }}
                            >
                              ALL
                            </span>
                          ) : (
                            <BrokerLogo broker={opt.id} size={16} />
                          )}
                          <span>{opt.label}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', color: isSelected ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>
                            {count}
                          </span>
                          {isSelected && <Check size={13} strokeWidth={2} color="var(--text-primary, #111827)" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── SORT PILLS: P&L | Name | Date ── */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.03)',
              border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
              borderRadius: '9999px',
              padding: '3px',
              gap: '2px'
            }}
          >
            {[
              { id: 'pnl', label: 'P&L' },
              { id: 'name', label: 'Name' },
              { id: 'date', label: 'Date' }
            ].map((item) => {
              const active = sortMode === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSortMode(item.id)}
                  style={{
                    border: 'none',
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: active ? 600 : 500,
                    transition: 'all 0.15s ease',
                    backgroundColor: active ? 'var(--bg-card, #ffffff)' : 'transparent',
                    color: active ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
                    boxShadow: active ? 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))' : 'none'
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── GRID TABLE CONTAINER ───────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0,0,0,0.02))',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Scrollable Table View with Sticky Header */}
        <div
          className="pnl-table-scroll"
          style={{
            maxHeight: '520px',
            overflowY: 'auto',
            overflowX: 'auto',
            position: 'relative'
          }}
        >
          {viewMode === 'closed' ? (
            /* ══════ CLOSED TRADES P&L GRID ══════ */
            closedTrades.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted, #9ca3af)' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #374151)', marginBottom: '4px' }}>
                  {brokerFilter !== 'all' ? `No closed trades for ${activeBrokerOpt.label}` : 'No closed trades yet'}
                </div>
                <div style={{ fontSize: '12px' }}>
                  {brokerFilter !== 'all' ? (
                    <button
                      type="button"
                      onClick={() => setBrokerFilter('all')}
                      style={{ border: 'none', background: 'none', color: 'var(--text-primary, #111827)', fontWeight: 600, cursor: 'pointer', marginTop: '6px', textDecoration: 'underline' }}
                    >
                      Clear broker filter
                    </button>
                  ) : (
                    'Net P&L, charges, and broker breakdown will appear here once you close a trade.'
                  )}
                </div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '920px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-card, #ffffff)', boxShadow: '0 1px 0 color-mix(in srgb, var(--border-color, #e5e7eb) 45%, transparent)' }}>
                  <tr>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Ticker
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Status
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Broker
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Days Held
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Exit Date
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Setup
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Gross P&L
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Charges
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Net P&L
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Net %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedList.map((pos) => {
                    const sym = (pos.name || pos.symbol || 'TRADE').toUpperCase().trim();
                    const gross = Number(pos.grossPnl ?? pos.pl ?? pos.pnl ?? 0);
                    const net = Number(pos.netPnl ?? gross);
                    const charges = pos.charges;
                    const isProfit = net >= 0;
                    const grossIsProfit = gross >= 0;
                    const holdingDays = pos.holdingDays ?? 0;
                    const costBasis = parseFloat(pos.costBasis ?? pos.positionSize ?? 0) || (parseFloat(pos.avgEntry ?? pos.entry ?? 0) * (parseFloat(pos.exitedQty ?? pos.qty ?? 0)));
                    const netPct = costBasis > 0 ? (net / costBasis) * 100 : 0;

                    return (
                      <tr key={pos.id} className="pnl-grid-row" style={{ borderBottom: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 45%, transparent)' }}>
                        {/* TICKER */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle' }}>
                          <div
                            onClick={() => onOpenStockChart?.(sym)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', cursor: 'pointer' }}
                          >
                            <SymbolLogo symbol={sym} size={24} />
                            <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary, #111827)', letterSpacing: '-0.01em' }}>
                              {sym}
                            </span>
                          </div>
                        </td>

                        {/* STATUS */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 500,
                                padding: '2px 7px',
                                borderRadius: '6px',
                                backgroundColor: 'var(--bg-hover, rgba(107,114,128,0.08))',
                                color: 'var(--text-secondary, #4b5563)'
                              }}
                            >
                              Closed
                            </span>
                            {pos.segment && <SegmentBadge segment={pos.segment} />}
                          </div>
                        </td>

                        {/* BROKER */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle' }}>
                          <BrokerBadge broker={pos.broker} />
                        </td>

                        {/* DAYS HELD */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
                            {holdingDays}{' '}
                            <span style={{ fontWeight: 400, color: 'var(--text-muted, #6b7280)', fontSize: '12px' }}>
                              day{holdingDays !== 1 ? 's' : ''}
                            </span>
                          </span>
                        </td>

                        {/* EXIT DATE */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle', fontSize: '12.5px', color: 'var(--text-muted, #6b7280)' }}>
                          {pos.e1Date || pos.exitDate || pos.date || '—'}
                        </td>

                        {/* SETUP */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle' }}>
                          {pos.setup ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 9px',
                                borderRadius: '9999px',
                                border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
                                backgroundColor: 'var(--bg-surface, #ffffff)',
                                fontSize: '11.5px',
                                fontWeight: 500,
                                color: 'var(--text-secondary, #374151)'
                              }}
                            >
                              {pos.setup}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted, #9ca3af)' }}>—</span>
                          )}
                        </td>

                        {/* GROSS P&L */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500, fontSize: '13px', color: grossIsProfit ? '#16a34a' : '#ef4444' }}>
                          {hideValues ? '••••••' : `${grossIsProfit ? '+' : '-'}${fmt(gross)}`}
                        </td>

                        {/* CHARGES */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '12.5px', color: charges?.hasCharges ? '#ef4444' : 'var(--text-muted, #9ca3af)', fontWeight: 400 }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                            <span>
                              {hideValues
                                ? '••••'
                                : charges?.hasCharges
                                ? `-${fmt(charges.total)}`
                                : '—'}
                            </span>
                            <TradeChargesPopover
                              trade={pos}
                              charges={charges}
                              hideValues={hideValues}
                            />
                          </div>
                        </td>

                        {/* NET P&L */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          <span
                            style={{
                              fontSize: '13.5px',
                              fontWeight: 600,
                              color: isProfit ? '#16a34a' : '#ef4444'
                            }}
                          >
                            {hideValues ? '••••••' : `${isProfit ? '+' : '-'}${fmt(net)}`}
                          </span>
                        </td>

                        {/* NET % */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          <span
                            style={{
                              fontSize: '12.5px',
                              fontWeight: 600,
                              color: isProfit ? '#16a34a' : '#ef4444'
                            }}
                          >
                            {hideValues ? '•••' : `${isProfit ? '+' : ''}${netPct.toFixed(2)}%`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            /* ══════ OPEN HOLDINGS GRID ══════ */
            openPositions.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted, #9ca3af)' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #374151)', marginBottom: '4px' }}>
                  {brokerFilter !== 'all' ? `No open positions for ${activeBrokerOpt.label}` : 'No open positions'}
                </div>
                <div style={{ fontSize: '12px' }}>
                  {brokerFilter !== 'all' ? (
                    <button
                      type="button"
                      onClick={() => setBrokerFilter('all')}
                      style={{ border: 'none', background: 'none', color: 'var(--text-primary, #111827)', fontWeight: 600, cursor: 'pointer', marginTop: '6px', textDecoration: 'underline' }}
                    >
                      Clear broker filter
                    </button>
                  ) : (
                    'Open or partial trades appear here with live unrealized P&L.'
                  )}
                </div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '920px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-card, #ffffff)', boxShadow: '0 1px 0 color-mix(in srgb, var(--border-color, #e5e7eb) 45%, transparent)' }}>
                  <tr>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Ticker
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Status
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Broker
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Days Held
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Setup
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Qty
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Avg Entry
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      CMP
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Invested
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      Unrealized P&L
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, rgba(0, 0, 0, 0.55))', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', backgroundColor: 'var(--bg-card, #ffffff)' }}>
                      P&L %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedList.map((pos) => {
                    const sym = (pos.name || pos.symbol || 'TRADE').toUpperCase().trim();
                    const openQty = parseFloat(pos.openQty ?? pos.qty) || 0;
                    const avgEntry = parseFloat(pos.avgEntry ?? pos.entry) || 0;
                    const cmp = parseFloat(pos.cmp) || avgEntry;
                    const inv = avgEntry * openQty;
                    const currVal = cmp * openQty;
                    const unrealized = Number(pos.unrealized ?? (currVal - inv));
                    const isProfit = unrealized >= 0;
                    const pnlPct = inv > 0 ? (unrealized / inv) * 100 : 0;
                    const isEditingCmp = editingCmpId === pos.id;
                    const holdingDays = pos.holdingDays ?? 0;

                    return (
                      <tr key={pos.id} className="pnl-grid-row" style={{ borderBottom: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 45%, transparent)' }}>
                        {/* TICKER */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle' }}>
                          <div
                            onClick={() => onOpenStockChart?.(sym)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', cursor: 'pointer' }}
                          >
                            <SymbolLogo symbol={sym} size={24} />
                            <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary, #111827)', letterSpacing: '-0.01em' }}>
                              {sym}
                            </span>
                          </div>
                        </td>

                        {/* STATUS */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 500,
                              padding: '2px 7px',
                              borderRadius: '6px',
                              backgroundColor: pos.status === 'Partial' ? 'rgba(0,0,0,0.06)' : 'rgba(16,185,129,0.08)',
                              color: pos.status === 'Partial' ? 'var(--text-primary, #111827)' : '#059669'
                            }}
                          >
                            {pos.status || 'Open'}
                          </span>
                        </td>

                        {/* BROKER */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle' }}>
                          <BrokerBadge broker={pos.broker} />
                        </td>

                        {/* DAYS HELD */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
                            {holdingDays}{' '}
                            <span style={{ fontWeight: 400, color: 'var(--text-muted, #6b7280)', fontSize: '12px' }}>
                              day{holdingDays !== 1 ? 's' : ''}
                            </span>
                          </span>
                        </td>

                        {/* SETUP */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle' }}>
                          {pos.setup ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 9px',
                                borderRadius: '9999px',
                                border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
                                backgroundColor: 'var(--bg-surface, #ffffff)',
                                fontSize: '11.5px',
                                fontWeight: 500,
                                color: 'var(--text-secondary, #374151)'
                              }}
                            >
                              {pos.setup}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted, #9ca3af)' }}>—</span>
                          )}
                        </td>

                        {/* QTY */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle', textAlign: 'right', fontWeight: 500, color: 'var(--text-primary, #111827)', fontSize: '13px' }}>
                          {openQty}
                        </td>

                        {/* AVG ENTRY */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500, fontSize: '13px', color: 'var(--text-secondary, #374151)' }}>
                          {hideValues ? '••••' : fmt(avgEntry)}
                        </td>

                        {/* CMP (Manual editable) */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {isEditingCmp ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="number"
                                step="0.05"
                                autoFocus
                                value={editingCmpValue}
                                onChange={(e) => setEditingCmpValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveCmp(pos.id);
                                  if (e.key === 'Escape') setEditingCmpId(null);
                                }}
                                style={{
                                  width: '78px',
                                  height: '24px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid #f97316',
                                  outline: 'none',
                                  backgroundColor: 'var(--bg-card, #fff)',
                                  color: 'var(--text-primary, #111827)',
                                  textAlign: 'right'
                                }}
                              />
                              <button
                                onClick={() => handleSaveCmp(pos.id)}
                                style={{ background: '#16a34a', border: 'none', borderRadius: '3px', padding: '3px', color: '#fff', cursor: 'pointer', display: 'flex' }}
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditingCmpId(null)}
                                style={{ background: '#ef4444', border: 'none', borderRadius: '3px', padding: '3px', color: '#fff', cursor: 'pointer', display: 'flex' }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingCmpId(pos.id);
                                setEditingCmpValue(String(cmp));
                              }}
                              title="Click to update Manual CMP"
                              style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: cmp > avgEntry ? '#16a34a' : cmp < avgEntry ? '#ef4444' : 'var(--text-primary, #111827)',
                                fontVariantNumeric: 'tabular-nums',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                transition: 'background 0.12s'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              {hideValues ? '••••' : fmt(cmp)}
                            </div>
                          )}
                        </td>

                        {/* INVESTED */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '13px', color: 'var(--text-secondary, #374151)', fontWeight: 500 }}>
                          {hideValues ? '••••••' : fmt(inv)}
                        </td>

                        {/* UNREALIZED P&L */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          <span
                            style={{
                              fontSize: '13.5px',
                              fontWeight: 600,
                              color: isProfit ? '#16a34a' : '#ef4444'
                            }}
                          >
                            {hideValues ? '••••••' : `${isProfit ? '+' : '-'}${fmt(unrealized)}`}
                          </span>
                        </td>

                        {/* P&L % */}
                        <td style={{ padding: '12px 18px', verticalAlign: 'middle', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          <span
                            style={{
                              fontSize: '12.5px',
                              fontWeight: 600,
                              color: isProfit ? '#16a34a' : '#ef4444'
                            }}
                          >
                            {hideValues ? '•••' : `${isProfit ? '+' : ''}${pnlPct.toFixed(2)}%`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* ── FOOTER PAGINATION BAR ────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            borderTop: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 45%, transparent)',
            backgroundColor: 'var(--bg-card, #ffffff)'
          }}
        >
          {/* Left spacer */}
          <div style={{ minWidth: '80px' }} />

          {/* Center: Pagination numbers & arrows */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                width: '28px',
                height: '28px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: safeCurrentPage <= 1 ? 'var(--text-muted, #d1d5db)' : 'var(--text-secondary, #4b5563)',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: safeCurrentPage <= 1 ? 'default' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              const isCurrent = safeCurrentPage === p;
              return (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  style={{
                    width: '28px',
                    height: '28px',
                    fontSize: '12px',
                    fontWeight: isCurrent ? 600 : 500,
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: isCurrent ? 'var(--text-primary, #111827)' : 'transparent',
                    color: isCurrent ? 'var(--bg-card, #ffffff)' : 'var(--text-secondary, #4b5563)',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(0,0,0,0.04))';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {p}
                </button>
              );
            })}

            <button
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{
                width: '28px',
                height: '28px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: safeCurrentPage >= totalPages ? 'var(--text-muted, #d1d5db)' : 'var(--text-secondary, #4b5563)',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: safeCurrentPage >= totalPages ? 'default' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Right: ROWS [12 v] | 1-5 of 5 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div ref={rowsDropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ROWS
              </span>
              <button
                type="button"
                onClick={() => setIsRowsDropdownOpen(!isRowsDropdownOpen)}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--text-primary, #111827)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}
              >
                <span>{pageSize}</span>
                <ChevronDown
                  size={12}
                  style={{
                    opacity: 0.6,
                    transition: 'transform 0.15s ease',
                    transform: isRowsDropdownOpen ? 'rotate(180deg)' : 'none'
                  }}
                />
              </button>

              {/* Floating Upward Popover Menu for Page Size */}
              {isRowsDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 6px)',
                    right: 0,
                    zIndex: 60,
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    borderRadius: '10px',
                    padding: '4px',
                    minWidth: '85px',
                    border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
                    boxShadow: '0 8px 20px -4px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1px'
                  }}
                >
                  {[10, 12, 25, 50, 100].map((size) => {
                    const isSelected = pageSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setPageSize(Number(size));
                          setCurrentPage(1);
                          setIsRowsDropdownOpen(false);
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? 'var(--text-primary, #111827)' : 'var(--text-secondary, #4b5563)',
                          backgroundColor: isSelected ? 'var(--bg-hover, rgba(0, 0, 0, 0.05))' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(0,0,0,0.03))';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <span>{size}</span>
                        {isSelected && <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--text-primary, #111827)' }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ height: '16px', width: '1px', backgroundColor: 'color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)' }} />

            <div style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted, #6b7280)', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
              <span style={{ color: 'var(--text-primary, #111827)', fontWeight: 500 }}>{startItem}-{endItem}</span> of <span style={{ color: 'var(--text-primary, #111827)', fontWeight: 500 }}>{totalTradesCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── PERFORMANCE & CHARGES TRAJECTORY CHART VIEW ── */}
      <NetPnlTrajectoryChart
        trades={closedTrades}
        hideValues={hideValues}
        brokerFilter={brokerFilter}
        capital={capital}
      />
    </div>
  );
}
