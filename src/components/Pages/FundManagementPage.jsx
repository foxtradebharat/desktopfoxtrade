import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Pencil, Info, X, Calendar, ChevronDown, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import Tooltip from '../Tooltip';
import {
  calculateMonthlyPerformance,
  calculateYearlyFundSummary,
  getStoredCapitalChanges,
  saveCapitalChanges,
  parseMonthAndYear,
  MONTH_NAMES
} from '../../utils/fundManagementCalculations';

const COLUMN_HELP_TEXTS = {
  added: `Total funds deposited into the trading account during the month. Includes pay-ins, UPI/NEFT deposits, and external transfers.\n\nNote: Exact transaction dates are immaterial; all additions are assumed to occur on the 1st day of the month.`,
  withdrawn: `Total funds withdrawn from the trading account during the month. Includes pay-outs, settlements, and quarterly settlement transfers.\n\nInternal margin blocks, obligations, settlements between broker segments, and trading charges are ignored.\n\nNote: Exact transaction dates are immaterial; all withdrawals are assumed to occur on the 1st day of the month.`,
  startingCapital: `The effective capital available at the start of the month.\n\nFormula: [Prev Month Final Capital + Added - Withdrawn]`,
  netPl: `Net profit or loss after deducting all taxes and charges.\n\nFormula: [Gross P/L - Taxes/Charges]`,
  pctPl: `Monthly percentage return on effective starting capital.\n\nFormula: [Net P/L / Starting Capital] × 100`,
  finalCapital: `Account balance at month-end.\n\nFormula: [Starting Capital + Additions - Withdrawals + Net P/L]`,
  trades: `Total number of trades executed and closed within this month`,
  winPct: `The percentage of profitable trades out of total trades taken this month`,
  avgGainPct: `Average percentage gain across all winning trades`,
  avgLossPct: `Average percentage loss across all losing trades`,
  avgRR: `Average signed effective R per eligible trade contributing to this month.\n\nFormula: Sum of each eligible trade's effective R / Number of eligible trades\n\nWinners contribute positive R; losers contribute negative R.`,
  avgDays: `Average holding period in days for trades closed in this month`,
  cagr: `Compounded Annual Growth Rate (CAGR) / Cumulative return on initial capital up to this month.`
};

function YearSelector({ value, onChange, options = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          height: '36px',
          padding: '0 14px',
          borderRadius: '10px',
          border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
          backgroundColor: isOpen ? 'var(--bg-hover)' : 'var(--bg-card)',
          color: 'var(--text-primary)',
          fontSize: '12.5px',
          fontWeight: 600,
          fontFamily: 'var(--font-mono, monospace)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          outline: 'none',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          transition: 'all 0.15s ease',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = 'var(--bg-card)';
        }}
      >
        <Calendar size={13} color="var(--text-muted)" strokeWidth={2} style={{ flexShrink: 0 }} />
        <span style={{ letterSpacing: '0.02em' }}>{value}</span>
        <ChevronDown
          size={13}
          color="var(--text-muted)"
          style={{
            marginLeft: '2px',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 150,
            minWidth: '115px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.12), 0 4px 10px -2px rgba(0, 0, 0, 0.04)',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            animation: 'modernDropdownFadeIn 0.14s ease-out'
          }}
        >
          {options.map((yr) => {
            const isSelected = String(yr) === String(value);
            return (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  onChange(yr);
                  setIsOpen(false);
                }}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '12.5px',
                  fontWeight: isSelected ? 600 : 500,
                  fontFamily: 'var(--font-mono, monospace)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  transition: 'background-color 0.12s ease',
                  width: '100%',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span>{yr}</span>
                {isSelected && (
                  <Check size={13} color="var(--color-green, #10b981)" strokeWidth={2.5} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FundManagementPage({
  trades = [],
  allTrades = [],
  user,
  activePortfolioId = 'portfolio-default',
  onUpdateCapitalBase,
  dateRange = 'All Time',
  resolvedDateFilter = null
}) {
  // Dynamically extract all available years: Present Year + any years with logged trades or saved capital changes
  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    const presentYear = new Date().getFullYear();
    yearsSet.add(String(presentYear));
    yearsSet.add(String(presentYear + 1));

    // Extract years from all trade entry/exit dates and pyramid legs
    const sourceTrades = (allTrades && allTrades.length > 0) ? allTrades : trades;
    if (Array.isArray(sourceTrades)) {
      sourceTrades.forEach((t) => {
        if (!t) return;
        const dateCandidates = [
          t.date, t.entryDate, t.exitDate,
          t.p1Date, t.p2Date, t.p3Date, t.p4Date,
          t.e1Date, t.e2Date, t.e3Date, t.e4Date
        ];
        dateCandidates.forEach((dStr) => {
          if (!dStr) return;
          const parsed = parseMonthAndYear(String(dStr));
          if (parsed?.year && parsed.year >= 2000 && parsed.year <= 2100) {
            yearsSet.add(String(parsed.year));
          } else {
            const match = String(dStr).match(/\b(20\d\d)\b/);
            if (match) yearsSet.add(match[1]);
          }
        });
      });
    }

    // Scan localStorage for stored capital changes in other years
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(`foxtrade_capital_changes_${activePortfolioId}_`) || key.startsWith(`tradeontip_capital_changes_${activePortfolioId}_`))) {
          const yr = key.split('_').pop();
          if (yr && /^\d{4}$/.test(yr)) yearsSet.add(yr);
        }
      }
    } catch {}

    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [allTrades, trades, activePortfolioId]);

  const [selectedYear, setSelectedYear] = useState(() => {
    if (resolvedDateFilter?.from) {
      return String(resolvedDateFilter.from.getFullYear());
    }
    return new Date().getFullYear().toString();
  });

  // Auto-sync selectedYear when date filter changes
  useEffect(() => {
    if (resolvedDateFilter?.from) {
      setSelectedYear(String(resolvedDateFilter.from.getFullYear()));
    } else if (dateRange === 'Pick This FY' || dateRange === 'This FY') {
      const today = new Date();
      const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      setSelectedYear(String(fyStartYear));
    } else if (dateRange?.year) {
      setSelectedYear(String(dateRange.year));
    } else if (dateRange?.fy) {
      setSelectedYear(String(dateRange.fy));
    }
  }, [resolvedDateFilter, dateRange]);

  // Keep selectedYear valid within availableYears
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const [capitalChanges, setCapitalChanges] = useState(() =>
    getStoredCapitalChanges(activePortfolioId, new Date().getFullYear().toString())
  );

  // Inline editing state: { monthIdx, field: 'added' | 'withdrawn' }
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Note popover modal state: { monthIdx, field: 'added' | 'withdrawn' }
  const [noteModal, setNoteModal] = useState(null);
  const [noteText, setNoteText] = useState('');

  // Listen for external updates or reload when active portfolio / year changes
  useEffect(() => {
    setCapitalChanges(getStoredCapitalChanges(activePortfolioId, selectedYear));

    const handleUpdate = (e) => {
      if (e.detail?.portfolioId === activePortfolioId) {
        setCapitalChanges(e.detail.data || {});
      }
    };
    window.addEventListener('tradeontip_capital_updated', handleUpdate);
    return () => window.removeEventListener('tradeontip_capital_updated', handleUpdate);
  }, [activePortfolioId, selectedYear]);

  const [showPreTax, setShowPreTax] = useState(false);

  // Compute monthly matrix dynamically from current trades and capital changes
  const monthlyData = useMemo(() => {
    return calculateMonthlyPerformance(trades, capitalChanges, selectedYear, { 
      portfolioId: activePortfolioId,
      allTrades: (allTrades && allTrades.length > 0) ? allTrades : trades
    });
  }, [trades, allTrades, capitalChanges, selectedYear, activePortfolioId]);

  // Compute yearly fund summary and footer total metrics
  const yearlySummary = useMemo(() => {
    return calculateYearlyFundSummary(trades, capitalChanges, selectedYear, { 
      portfolioId: activePortfolioId,
      allTrades: (allTrades && allTrades.length > 0) ? allTrades : trades
    });
  }, [trades, allTrades, capitalChanges, selectedYear, activePortfolioId]);

  // Save changes to localStorage and notify parent
  const handleSaveValue = (monthIdx, field) => {
    const num = parseFloat(editValue) || 0;
    const currentMonth = capitalChanges[monthIdx] || {};
    const updatedMonth = {
      ...currentMonth,
      [field]: num
    };
    const updatedData = {
      ...capitalChanges,
      [monthIdx]: updatedMonth
    };

    setCapitalChanges(updatedData);
    saveCapitalChanges(activePortfolioId, selectedYear, updatedData);
    setEditingCell(null);

    // Capital update propagates automatically via tradeontip_capital_updated event in saveCapitalChanges()
  };

  // Save notes
  const handleSaveNote = () => {
    if (!noteModal) return;
    const { monthIdx, field } = noteModal;
    const notesKey = field === 'added' ? 'addedNotes' : 'withdrawnNotes';
    const currentMonth = capitalChanges[monthIdx] || {};
    const updatedMonth = {
      ...currentMonth,
      [notesKey]: noteText
    };
    const updatedData = {
      ...capitalChanges,
      [monthIdx]: updatedMonth
    };

    setCapitalChanges(updatedData);
    saveCapitalChanges(activePortfolioId, selectedYear, updatedData);
    setNoteModal(null);
  };

  const activeMonthlyAvg = showPreTax ? (yearlySummary.preTaxMonthlyAvgReturn ?? yearlySummary.monthlyAvgReturn) : yearlySummary.monthlyAvgReturn;
  const activeTotalCompounded = showPreTax ? (yearlySummary.preTaxTotalCompounded ?? yearlySummary.totalCompounded) : yearlySummary.totalCompounded;
  const activeCagr = showPreTax ? (yearlySummary.preTaxAnnualizedCagr ?? yearlySummary.annualizedCagr) : yearlySummary.annualizedCagr;
  const hasUnsetCapital = monthlyData.some(m => !m.capitalIsReal);

  return (
    <div style={{ padding: '0 24px 80px 24px', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* Header Section */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
            fontStyle: 'normal',
            letterSpacing: '-0.01em'
          }}>
            Fund Management
          </h1>
          <p style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginTop: '4px',
            margin: 0,
            fontStyle: 'normal',
            fontWeight: 400
          }}>
            Track and manage your month-over-month portfolio growth and attribution
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <YearSelector
            value={selectedYear}
            onChange={setSelectedYear}
            options={availableYears}
          />
        </div>
      </div>

      {/* Starting Capital Unset Banner */}
      {hasUnsetCapital && (
        <div style={{
          marginBottom: '20px',
          padding: '12px 18px',
          borderRadius: '12px',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          color: '#d97706',
          fontSize: '13px',
          fontWeight: 500,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>ℹ️</span>
            <span>
              Set your starting capital (portfolio base capital or a ledger deposit) to see returns. Cumulative Net P&L: <strong>₹ {yearlySummary.totalNetPl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '1240px', fontSize: '13px', textAlign: 'right' }}>
            <thead>
              <tr style={{ height: '48px', backgroundColor: 'var(--bg-surface)' }}>
                <th style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 20,
                  backgroundColor: 'var(--bg-card)',
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  borderRight: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  padding: '12px 20px',
                  textAlign: 'left',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  MONTH
                </th>

                {/* ADDED */}
                <th style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  padding: '12px 20px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>ADDED (₹)</span>
                    <Pencil size={11} className="text-muted-foreground opacity-60" />
                    <Tooltip content={COLUMN_HELP_TEXTS.added}>
                      <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center">
                        <Info size={11} color="var(--text-muted)" />
                      </span>
                    </Tooltip>
                  </div>
                </th>

                {/* WITHDRAWN */}
                <th style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  padding: '12px 20px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>WITHDRAWN (₹)</span>
                    <Pencil size={11} className="text-muted-foreground opacity-60" />
                    <Tooltip content={COLUMN_HELP_TEXTS.withdrawn}>
                      <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center">
                        <Info size={11} color="var(--text-muted)" />
                      </span>
                    </Tooltip>
                  </div>
                </th>

                {/* STARTING CAPITAL */}
                <th style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  padding: '12px 20px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>STARTING CAPITAL (₹)</span>
                    <Tooltip content={COLUMN_HELP_TEXTS.startingCapital}>
                      <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center">
                        <Info size={11} color="var(--text-muted)" />
                      </span>
                    </Tooltip>
                  </div>
                </th>

                {/* NET P/L */}
                <th style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  padding: '12px 20px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>NET P/L (₹)</span>
                    <Tooltip content={COLUMN_HELP_TEXTS.netPl}>
                      <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center">
                        <Info size={11} color="var(--text-muted)" />
                      </span>
                    </Tooltip>
                  </div>
                </th>

                {/* % P/L */}
                <th style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  padding: '12px 20px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>% P/L</span>
                    <Tooltip content={COLUMN_HELP_TEXTS.pctPl}>
                      <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center">
                        <Info size={11} color="var(--text-muted)" />
                      </span>
                    </Tooltip>
                  </div>
                </th>

                {/* FINAL CAPITAL */}
                <th style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  padding: '12px 20px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>FINAL CAPITAL (₹)</span>
                    <Tooltip content={COLUMN_HELP_TEXTS.finalCapital}>
                      <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center">
                        <Info size={11} color="var(--text-muted)" />
                      </span>
                    </Tooltip>
                  </div>
                </th>

                {/* TRADES */}
                <th style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  padding: '12px 20px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>TRADES</span>
                    <Tooltip content={COLUMN_HELP_TEXTS.trades}>
                      <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center">
                        <Info size={11} color="var(--text-muted)" />
                      </span>
                    </Tooltip>
                  </div>
                </th>

                {/* % WIN */}
                <th style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  padding: '12px 20px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>% WIN</span>
                    <Tooltip content={COLUMN_HELP_TEXTS.winPct}>
                      <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center">
                        <Info size={11} color="var(--text-muted)" />
                      </span>
                    </Tooltip>
                  </div>
                </th>

                {/* AVG GAIN */}
                <th style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  padding: '12px 20px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>AVG GAIN</span>
                    <Tooltip content={COLUMN_HELP_TEXTS.avgGainPct}>
                      <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center">
                        <Info size={11} color="var(--text-muted)" />
                      </span>
                    </Tooltip>
                  </div>
                </th>

                {/* AVG LOSS */}
                <th style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  padding: '12px 20px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>AVG LOSS</span>
                    <Tooltip content={COLUMN_HELP_TEXTS.avgLossPct}>
                      <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center">
                        <Info size={11} color="var(--text-muted)" />
                      </span>
                    </Tooltip>
                  </div>
                </th>

                {/* MONTHLY AVG R */}
                <th style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  padding: '12px 20px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>MONTHLY AVG R</span>
                    <Tooltip content={COLUMN_HELP_TEXTS.avgRR}>
                      <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center">
                        <Info size={11} color="var(--text-muted)" />
                      </span>
                    </Tooltip>
                  </div>
                </th>

                {/* AVG DAYS */}
                <th style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  padding: '12px 20px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>AVG DAYS</span>
                    <Tooltip content={COLUMN_HELP_TEXTS.avgDays}>
                      <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center">
                        <Info size={11} color="var(--text-muted)" />
                      </span>
                    </Tooltip>
                  </div>
                </th>

                {/* CAGR */}
                <th style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  padding: '12px 20px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>CAGR</span>
                    <Tooltip content={COLUMN_HELP_TEXTS.cagr}>
                      <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center">
                        <Info size={11} color="var(--text-muted)" />
                      </span>
                    </Tooltip>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {monthlyData.map((row, idx) => {
                const isAddedEditing = editingCell?.monthIdx === idx && editingCell?.field === 'added';
                const isWithdrawnEditing = editingCell?.monthIdx === idx && editingCell?.field === 'withdrawn';

                return (
                  <tr
                    key={idx}
                    style={{
                      height: '54px',
                      borderBottom: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.015)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {/* Month Name */}
                    <td style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      backgroundColor: 'var(--bg-card)',
                      borderRight: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
                      padding: '12px 20px',
                      textAlign: 'left',
                      fontWeight: 600,
                      fontStyle: 'normal',
                      color: 'var(--text-primary)'
                    }}>
                      {row.month}
                    </td>

                    {/* Added Amount */}
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono, monospace)' }}>
                      {isAddedEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleSaveValue(idx, 'added')}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveValue(idx, 'added')}
                            autoFocus
                            style={{
                              width: '100px',
                              textAlign: 'right',
                              fontSize: '13px',
                              fontWeight: 500,
                              fontFamily: 'var(--font-mono, monospace)',
                              padding: '4px 6px',
                              borderRadius: '6px',
                              border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                              outline: 'none',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-primary)'
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', cursor: 'pointer' }}
                          onClick={() => {
                            setEditingCell({ monthIdx: idx, field: 'added' });
                            setEditValue(row.added > 0 ? String(row.added) : '');
                          }}
                        >
                          <span style={{
                            color: row.added > 0 ? '#10b981' : 'var(--text-muted)',
                            fontWeight: row.added > 0 ? 600 : 400,
                            borderBottom: '1px dashed rgba(16, 185, 129, 0.3)',
                            paddingBottom: '1px',
                            whiteSpace: 'nowrap'
                          }}>
                            {row.added > 0 ? `₹${row.added.toLocaleString('en-IN')}` : '₹ 0'}
                          </span>
                          <Tooltip content={row.addedNotes || "Click to add/edit note"}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setNoteModal({ monthIdx: idx, field: 'added' });
                                setNoteText(row.addedNotes || '');
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: row.addedNotes ? 1 : 0.4 }}
                            >
                              <Info size={12} color={row.addedNotes ? '#10b981' : 'var(--text-muted)'} />
                            </button>
                          </Tooltip>
                        </div>
                      )}
                    </td>

                    {/* Withdrawn Amount */}
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono, monospace)' }}>
                      {isWithdrawnEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleSaveValue(idx, 'withdrawn')}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveValue(idx, 'withdrawn')}
                            autoFocus
                            style={{
                              width: '100px',
                              textAlign: 'right',
                              fontSize: '13px',
                              fontWeight: 500,
                              fontFamily: 'var(--font-mono, monospace)',
                              padding: '4px 6px',
                              borderRadius: '6px',
                              border: '1px solid #ef4444',
                              outline: 'none',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-primary)'
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', cursor: 'pointer' }}
                          onClick={() => {
                            setEditingCell({ monthIdx: idx, field: 'withdrawn' });
                            setEditValue(row.withdrawn > 0 ? String(row.withdrawn) : '');
                          }}
                        >
                          <span style={{
                            color: row.withdrawn > 0 ? '#ef4444' : 'var(--text-muted)',
                            fontWeight: row.withdrawn > 0 ? 600 : 400,
                            borderBottom: '1px dashed rgba(239, 68, 68, 0.3)',
                            paddingBottom: '1px',
                            whiteSpace: 'nowrap'
                          }}>
                            {row.withdrawn > 0 ? `₹${row.withdrawn.toLocaleString('en-IN')}` : '₹ 0'}
                          </span>
                          <Tooltip content={row.withdrawnNotes || "Click to add/edit note"}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setNoteModal({ monthIdx: idx, field: 'withdrawn' });
                                setNoteText(row.withdrawnNotes || '');
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: row.withdrawnNotes ? 1 : 0.4 }}
                            >
                              <Info size={12} color={row.withdrawnNotes ? '#ef4444' : 'var(--text-muted)'} />
                            </button>
                          </Tooltip>
                        </div>
                      )}
                    </td>

                    {/* Starting Capital */}
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {row.startingCapital !== null ? `₹ ${row.startingCapital.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                    </td>

                    {/* Net P/L */}
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {row.netPl !== 0 ? (
                        <span style={{ color: row.netPl > 0 ? '#10b981' : '#ef4444' }}>
                          ₹ {row.netPl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>

                    {/* % P/L */}
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {row.pctPl !== null && row.pctPl !== 0 ? (
                        <span style={{ color: row.pctPl > 0 ? '#10b981' : '#ef4444' }}>
                          {row.pctPl.toFixed(2)}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Final Capital */}
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {row.finalCapital !== null ? `₹ ${row.finalCapital.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                    </td>

                    {/* Trades */}
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {row.trades > 0 ? row.trades : '-'}
                    </td>

                    {/* % Win */}
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
                      {row.trades > 0 ? (
                        <span style={{ color: row.winPct >= 50 ? '#10b981' : (row.winPct > 0 ? '#f59e0b' : '#ef4444') }}>
                          {row.winPct.toFixed(2)}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>

                    {/* Avg Gain */}
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono, monospace)', color: row.avgGainPct > 0 ? '#10b981' : 'var(--text-muted)', fontWeight: 500 }}>
                      {row.avgGainPct.toFixed(2)}%
                    </td>

                    {/* Avg Loss */}
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono, monospace)', color: row.avgLossPct > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: 500 }}>
                      {row.avgLossPct.toFixed(2)}%
                    </td>

                    {/* Monthly Avg R */}
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)', fontWeight: 500 }}>
                      {row.avgRR.toFixed(2)}
                    </td>

                    {/* Avg Days */}
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {row.avgDays % 1 === 0 ? row.avgDays : Number(row.avgDays.toFixed(2))}
                    </td>

                    {/* CAGR */}
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
                      {row.cagr !== null && row.cagr !== 0 ? (
                        <span style={{ color: row.cagr >= 0 ? '#10b981' : '#ef4444' }}>
                          {row.cagr.toFixed(2)}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Table Footer */}
            <tfoot
              style={{
                borderTop: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                boxShadow: '0 -2px 10px rgba(0,0,0,0.02)'
              }}
            >
              <tr style={{ height: '44px' }}>
                {/* Sticky left Total & Pre/Post-Tax toggle */}
                <td
                  style={{
                    padding: '8px 20px',
                    position: 'sticky',
                    left: 0,
                    zIndex: 20,
                    backgroundColor: 'var(--bg-card)',
                    borderRight: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                    fontFamily: 'inherit'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)' }}>
                      Total
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPreTax(!showPreTax)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '9px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        color: showPreTax ? '#3b82f6' : '#10b981',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {showPreTax ? (
                        <>
                          <ToggleLeft size={13} />
                          <span>Pre-Tax</span>
                        </>
                      ) : (
                        <>
                          <ToggleRight size={13} />
                          <span>Post-Tax</span>
                        </>
                      )}
                    </button>
                  </div>
                </td>

                {/* Added */}
                <td style={{ padding: '8px 20px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'rgba(150, 150, 150, 0.4)' }}>-</td>
                {/* Withdrawn */}
                <td style={{ padding: '8px 20px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'rgba(150, 150, 150, 0.4)' }}>-</td>
                {/* Starting Capital */}
                <td style={{ padding: '8px 20px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'rgba(150, 150, 150, 0.4)' }}>-</td>
                {/* Net P/L */}
                <td style={{ padding: '8px 20px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'rgba(150, 150, 150, 0.4)' }}>-</td>

                {/* % P/L */}
                <td style={{ padding: '8px 20px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '4px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted)' }}>Monthly Avg:</span>
                      <span style={{ marginLeft: '4px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: activeMonthlyAvg > 0 ? '#10b981' : (activeMonthlyAvg < 0 ? '#ef4444' : 'var(--text-muted)') }}>
                        {activeMonthlyAvg !== null ? `${activeMonthlyAvg.toFixed(2)}% @ pm` : '—'}
                      </span>
                      <span style={{ marginLeft: '6px', display: 'flex', alignItems: 'center' }}>
                        <Tooltip content="Geometric Mean Monthly Return. Represents the constant monthly growth rate. Formula: [(1 + Total Compounded)^(1/n) - 1]">
                          <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center">
                            <Info size={10} color="var(--text-muted)" />
                          </span>
                        </Tooltip>
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '4px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted)' }}>Total Compounded:</span>
                      <span style={{ marginLeft: '4px', fontSize: '12px', fontWeight: 900, fontFamily: 'var(--font-mono, monospace)', color: activeTotalCompounded > 0 ? '#10b981' : (activeTotalCompounded < 0 ? '#ef4444' : 'var(--text-muted)') }}>
                        {activeTotalCompounded !== null ? `${activeTotalCompounded >= 0 ? '+' : ''}${activeTotalCompounded.toFixed(2)}% pa` : '—'}
                      </span>
                      <span style={{ marginLeft: '6px', display: 'flex', alignItems: 'center' }}>
                        <Tooltip content="Time-Weighted Return (TWR) for the period. Formula: [Product of (1 + Monthly P/L%) - 1]">
                          <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center">
                            <Info size={10} color="var(--text-muted)" />
                          </span>
                        </Tooltip>
                      </span>
                    </div>
                  </div>
                </td>

                {/* Final Capital */}
                <td style={{ padding: '8px 20px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'rgba(150, 150, 150, 0.4)' }}>-</td>
                {/* Trades */}
                <td style={{ padding: '8px 20px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'rgba(150, 150, 150, 0.4)' }}>-</td>
                {/* % Win */}
                <td style={{ padding: '8px 20px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'rgba(150, 150, 150, 0.4)' }}>-</td>
                {/* Avg Gain */}
                <td style={{ padding: '8px 20px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'rgba(150, 150, 150, 0.4)' }}>-</td>
                {/* Avg Loss */}
                <td style={{ padding: '8px 20px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'rgba(150, 150, 150, 0.4)' }}>-</td>
                {/* Monthly Avg R */}
                <td style={{ padding: '8px 20px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'rgba(150, 150, 150, 0.4)' }}>-</td>
                {/* Avg Days */}
                <td style={{ padding: '8px 20px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'rgba(150, 150, 150, 0.4)' }}>-</td>

                {/* CAGR */}
                <td style={{ padding: '8px 20px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '4px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>CAGR:</span>
                      <span style={{ fontSize: '12px', fontWeight: 900, fontFamily: 'var(--font-mono, monospace)', color: activeCagr > 0 ? '#10b981' : (activeCagr < 0 ? '#ef4444' : 'var(--text-muted)') }}>
                        {activeCagr !== null ? `${activeCagr >= 0 ? '+' : ''}${activeCagr.toFixed(2)}%` : '—'}
                      </span>
                      <span style={{ marginLeft: '6px', display: 'flex', alignItems: 'center' }}>
                        <Tooltip content="Compound Annual Growth Rate. Formula: [(1 + Total Compounded)^(12/n) - 1]">
                          <span className="opacity-40 hover:opacity-100 transition-opacity cursor-help inline-flex items-center">
                            <Info size={10} color="var(--text-muted)" />
                          </span>
                        </Tooltip>
                      </span>
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Notes Popover Modal */}
      {noteModal && (
        <div
          onClick={() => setNoteModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(3px)'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
              borderRadius: '16px',
              padding: '20px',
              width: '360px',
              boxShadow: '0 16px 36px rgba(0,0,0,0.18)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {MONTH_NAMES[noteModal.monthIdx]} {noteModal.field.toUpperCase()} Notes
              </span>
              <button onClick={() => setNoteModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add notes for this capital adjustment..."
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: '8px',
                border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                padding: '8px 10px',
                fontSize: '12px',
                outline: 'none',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                resize: 'none'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button
                onClick={() => setNoteModal(null)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  background: 'none',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-surface)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
