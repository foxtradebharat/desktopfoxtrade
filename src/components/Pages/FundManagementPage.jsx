import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Info, X, Calendar, ChevronDown, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import Tooltip from '../Tooltip';
import {
  calculateMonthlyPerformance,
  calculateYearlyFundSummary,
  getStoredCapitalChanges,
  saveCapitalChanges,
  getStoredLedgerEntries,
  saveLedgerEntries,
  deriveMonthAggregates,
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
  const [ledgerEntries, setLedgerEntries] = useState(() =>
    getStoredLedgerEntries(activePortfolioId, selectedYear)
  );

  // Flow Modal State for exact dated entries: { monthIdx, type: 'deposit' | 'withdrawal' }
  const [flowModal, setFlowModal] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [flowAmount, setFlowAmount] = useState('');
  const [flowDate, setFlowDate] = useState('');
  const [flowNote, setFlowNote] = useState('');

  // Inline editing state: { monthIdx, field: 'added' | 'withdrawn' }
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const editingCellRef = useRef(null);
  editingCellRef.current = editingCell;

  // Note popover modal state: { monthIdx, field: 'added' | 'withdrawn' }
  const [noteModal, setNoteModal] = useState(null);
  const [noteText, setNoteText] = useState('');

  // Listen for external updates or reload when active portfolio / year changes
  useEffect(() => {
    setCapitalChanges(getStoredCapitalChanges(activePortfolioId, selectedYear));
    setLedgerEntries(getStoredLedgerEntries(activePortfolioId, selectedYear));

    const handleUpdate = (e) => {
      if (e.detail?.portfolioId === activePortfolioId) {
        setCapitalChanges(e.detail.data || {});
        if (e.detail.entries) {
          setLedgerEntries(e.detail.entries);
        } else {
          setLedgerEntries(getStoredLedgerEntries(activePortfolioId, selectedYear));
        }
      }
    };
    window.addEventListener('tradeontip_capital_updated', handleUpdate);
    return () => window.removeEventListener('tradeontip_capital_updated', handleUpdate);
  }, [activePortfolioId, selectedYear]);

  // Group entries by month for badge & quick display
  const monthEntries = useMemo(() => {
    const map = {};
    for (let m = 0; m < 12; m++) {
      map[m] = { deposits: [], withdrawals: [], hasApproxDeposit: false, hasApproxWithdrawal: false };
    }
    (ledgerEntries || []).forEach(e => {
      if (!e || !e.date) return;
      const parts = String(e.date).split('-');
      if (parts.length < 3) return;
      const y = parts[0];
      const m = parseInt(parts[1], 10) - 1;
      if (y !== String(selectedYear) || m < 0 || m > 11) return;
      if (e.type === 'deposit') {
        map[m].deposits.push(e);
        if (e.dateApproximate) map[m].hasApproxDeposit = true;
      } else if (e.type === 'withdrawal') {
        map[m].withdrawals.push(e);
        if (e.dateApproximate) map[m].hasApproxWithdrawal = true;
      }
    });
    return map;
  }, [ledgerEntries, selectedYear]);

  const openFlowModal = (monthIdx, type) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultDate = `${selectedYear}-${String(monthIdx + 1).padStart(2, '0')}-01`;
    const initialDate = defaultDate <= todayStr ? defaultDate : todayStr;

    setFlowModal({ monthIdx, type });
    setEditingEntry(null);
    setFlowAmount('');
    setFlowDate(initialDate);
    setFlowNote('');
  };

  const handleStartEditEntry = (entry) => {
    setEditingEntry(entry);
    setFlowAmount(String(entry.amount || ''));
    setFlowDate(entry.date || '');
    setFlowNote(entry.note || '');
  };

  const handleSaveEntry = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!flowModal) return;
    const amt = parseFloat(flowAmount) || 0;
    if (amt <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    if (!flowDate || flowDate > todayStr) {
      alert('Date cannot be in the future.');
      return;
    }

    const currentEntries = Array.isArray(ledgerEntries) ? [...ledgerEntries] : [];
    let updated;

    if (editingEntry) {
      // Editing date clears dateApproximate
      updated = currentEntries.map(item => {
        if (item.id === editingEntry.id) {
          return {
            ...item,
            amount: amt,
            date: flowDate,
            dateApproximate: false,
            note: flowNote.trim()
          };
        }
        return item;
      });
    } else {
      const newEntry = {
        id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        portfolioId: activePortfolioId,
        type: flowModal.type,
        amount: amt,
        date: flowDate,
        dateApproximate: false,
        note: flowNote.trim()
      };
      updated = [...currentEntries, newEntry];
    }

    saveLedgerEntries(activePortfolioId, selectedYear, updated);
    setLedgerEntries(updated);
    setCapitalChanges(deriveMonthAggregates(updated, selectedYear));

    setEditingEntry(null);
    setFlowAmount('');
    const defaultDate = `${selectedYear}-${String(flowModal.monthIdx + 1).padStart(2, '0')}-01`;
    setFlowDate(defaultDate <= todayStr ? defaultDate : todayStr);
    setFlowNote('');
  };

  const handleDeleteEntry = (entryId) => {
    const currentEntries = Array.isArray(ledgerEntries) ? [...ledgerEntries] : [];
    const updated = currentEntries.filter(e => e.id !== entryId);
    saveLedgerEntries(activePortfolioId, selectedYear, updated);
    setLedgerEntries(updated);
    setCapitalChanges(deriveMonthAggregates(updated, selectedYear));
    if (editingEntry?.id === entryId) {
      setEditingEntry(null);
      setFlowAmount('');
    }
  };

  const [showPreTax, setShowPreTax] = useState(false);
  const [taxVersion, setTaxVersion] = useState(0);

  useEffect(() => {
    const handleTaxesUpdated = () => {
      setTaxVersion(v => v + 1);
    };
    window.addEventListener('tradeontip_taxes_updated', handleTaxesUpdated);
    return () => window.removeEventListener('tradeontip_taxes_updated', handleTaxesUpdated);
  }, []);

  // Compute monthly matrix dynamically from current trades and capital changes
  const monthlyData = useMemo(() => {
    return calculateMonthlyPerformance(trades, capitalChanges, selectedYear, { 
      portfolioId: activePortfolioId,
      allTrades: (allTrades && allTrades.length > 0) ? allTrades : trades
    });
  }, [trades, allTrades, capitalChanges, selectedYear, activePortfolioId, taxVersion]);

  // Compute yearly fund summary and footer total metrics
  const yearlySummary = useMemo(() => {
    return calculateYearlyFundSummary(trades, capitalChanges, selectedYear, { 
      portfolioId: activePortfolioId,
      allTrades: (allTrades && allTrades.length > 0) ? allTrades : trades
    });
  }, [trades, allTrades, capitalChanges, selectedYear, activePortfolioId, taxVersion]);

  // Start direct inline editing for a cell
  const startEditing = (monthIdx, field) => {
    const cell = { monthIdx, field };
    editingCellRef.current = cell;
    setEditingCell(cell);
    const rowVal = field === 'added' ? monthlyData[monthIdx]?.added : monthlyData[monthIdx]?.withdrawn;
    const currentVal = rowVal ?? (capitalChanges[monthIdx]?.[field] ?? 0);
    setEditValue(currentVal > 0 ? String(currentVal) : '0');
  };

  // Save changes to localStorage, notify parent, and optionally navigate to next cell
  const handleSaveValue = (monthIdx, field, nextCell = null, directValue = null) => {
    const valToUse = directValue !== null && directValue !== undefined ? directValue : editValue;
    const rawNum = String(valToUse).trim();
    const num = rawNum === '' ? 0 : Math.max(0, parseFloat(rawNum) || 0);
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

    if (nextCell) {
      editingCellRef.current = nextCell;
      setEditingCell(nextCell);
      const nextMonthData = updatedData[nextCell.monthIdx] || {};
      const nextVal = nextMonthData[nextCell.field] ?? (nextCell.field === 'added' ? monthlyData[nextCell.monthIdx]?.added : monthlyData[nextCell.monthIdx]?.withdrawn) ?? 0;
      setEditValue(nextVal > 0 ? String(nextVal) : '0');
    } else {
      editingCellRef.current = null;
      setEditingCell(null);
      setEditValue('');
    }
  };

  // Handle cell blur: save and close only if this cell is still the active editing cell
  const handleCellBlur = (e, monthIdx, field) => {
    if (editingCellRef.current?.monthIdx === monthIdx && editingCellRef.current?.field === field) {
      const explicitVal = e?.target?.value !== undefined ? e.target.value : editValue;
      handleSaveValue(monthIdx, field, null, explicitVal);
    }
  };

  // Keyboard navigation matching Nexus: Enter (next row), Tab (next col/row), Arrows, Escape
  const handleCellKeyDown = (e, monthIdx, field) => {
    const currentInputVal = e?.target?.value !== undefined ? e.target.value : editValue;
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextIdx = monthIdx + (e.shiftKey ? -1 : 1);
      if (nextIdx >= 0 && nextIdx < 12) {
        handleSaveValue(monthIdx, field, { monthIdx: nextIdx, field }, currentInputVal);
      } else {
        handleSaveValue(monthIdx, field, null, currentInputVal);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (field === 'withdrawn') {
          handleSaveValue(monthIdx, field, { monthIdx, field: 'added' }, currentInputVal);
        } else if (monthIdx > 0) {
          handleSaveValue(monthIdx, field, { monthIdx: monthIdx - 1, field: 'withdrawn' }, currentInputVal);
        } else {
          handleSaveValue(monthIdx, field, null, currentInputVal);
        }
      } else {
        if (field === 'added') {
          handleSaveValue(monthIdx, field, { monthIdx, field: 'withdrawn' }, currentInputVal);
        } else if (monthIdx < 11) {
          handleSaveValue(monthIdx, field, { monthIdx: monthIdx + 1, field: 'added' }, currentInputVal);
        } else {
          handleSaveValue(monthIdx, field, null, currentInputVal);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (monthIdx < 11) {
        handleSaveValue(monthIdx, field, { monthIdx: monthIdx + 1, field }, currentInputVal);
      } else {
        handleSaveValue(monthIdx, field, null, currentInputVal);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (monthIdx > 0) {
        handleSaveValue(monthIdx, field, { monthIdx: monthIdx - 1, field }, currentInputVal);
      } else {
        handleSaveValue(monthIdx, field, null, currentInputVal);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      editingCellRef.current = null;
      setEditingCell(null);
      setEditValue('');
    }
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
  const [isUnsetCapitalDismissed, setIsUnsetCapitalDismissed] = useState(false);
  const isFundZero = !yearlySummary.capitalIsReal && (yearlySummary.totalAdded || 0) === 0;

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

                    {/* Added Amount (Funds Deposited) */}
                    <td style={{
                      padding: '10px 16px',
                      fontFamily: 'var(--font-mono, monospace)',
                      textAlign: 'right',
                      backgroundColor: 'rgba(16, 185, 129, 0.02)'
                    }}>
                      <div className="group relative" style={{ width: '100%' }}>
                        {isAddedEditing ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            autoFocus
                            value={editValue}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.]/g, '');
                              const parts = val.split('.');
                              if (parts.length > 2) return;
                              setEditValue(val);
                            }}
                            onBlur={(e) => handleCellBlur(e, idx, 'added')}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, 'added')}
                            className="w-full bg-transparent px-0 py-0 font-bold border-0 focus-visible:ring-0 focus-visible:outline-none text-right font-mono text-primary text-[13px]"
                            style={{
                              width: '100%',
                              backgroundColor: 'transparent',
                              padding: '0',
                              fontWeight: 700,
                              border: 'none',
                              outline: 'none',
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono, monospace)',
                              color: 'var(--text-primary)',
                              fontSize: '13px',
                              height: '28px',
                              boxSizing: 'border-box'
                            }}
                          />
                        ) : (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => startEditing(idx, 'added')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                startEditing(idx, 'added');
                              }
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'right',
                              cursor: 'pointer',
                              fontSize: '13px',
                              paddingRight: '2px',
                              transition: 'transform 0.15s ease'
                            }}
                            className="hover:translate-x-[-3px]"
                          >
                            <span
                              style={{
                                borderBottom: '1px dashed color-mix(in srgb, var(--border-color) 60%, transparent)',
                                transition: 'border-color 0.15s ease',
                                display: 'inline-block'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                <span>
                                  {row.added > 0 ? (
                                    <span style={{ color: '#10b981', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                      ₹ {row.added.toLocaleString('en-IN')}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'color-mix(in srgb, var(--text-muted) 50%, transparent)', whiteSpace: 'nowrap' }}>
                                      ₹ 0
                                    </span>
                                  )}
                                </span>

                                <button
                                  type="button"
                                  aria-label="View added amount notes"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNoteModal({ monthIdx: idx, field: 'added' });
                                    setNoteText(capitalChanges[idx]?.addedNotes || '');
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '2px',
                                    borderRadius: '9999px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: capitalChanges[idx]?.addedNotes ? '#10b981' : 'color-mix(in srgb, var(--text-muted) 50%, transparent)',
                                    transition: 'all 0.15s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.12)';
                                    e.currentTarget.style.color = '#10b981';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = capitalChanges[idx]?.addedNotes ? '#10b981' : 'color-mix(in srgb, var(--text-muted) 50%, transparent)';
                                  }}
                                >
                                  <Info size={13} />
                                </button>
                              </div>
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Withdrawn Amount (Funds Withdrawn) */}
                    <td style={{
                      padding: '10px 16px',
                      fontFamily: 'var(--font-mono, monospace)',
                      textAlign: 'right',
                      backgroundColor: 'rgba(239, 68, 68, 0.02)'
                    }}>
                      <div className="group relative" style={{ width: '100%' }}>
                        {isWithdrawnEditing ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            autoFocus
                            value={editValue}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.]/g, '');
                              const parts = val.split('.');
                              if (parts.length > 2) return;
                              setEditValue(val);
                            }}
                            onBlur={(e) => handleCellBlur(e, idx, 'withdrawn')}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, 'withdrawn')}
                            className="w-full bg-transparent px-0 py-0 font-bold border-0 focus-visible:ring-0 focus-visible:outline-none text-right font-mono text-primary text-[13px]"
                            style={{
                              width: '100%',
                              backgroundColor: 'transparent',
                              padding: '0',
                              fontWeight: 700,
                              border: 'none',
                              outline: 'none',
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono, monospace)',
                              color: 'var(--text-primary)',
                              fontSize: '13px',
                              height: '28px',
                              boxSizing: 'border-box'
                            }}
                          />
                        ) : (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => startEditing(idx, 'withdrawn')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                startEditing(idx, 'withdrawn');
                              }
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'right',
                              cursor: 'pointer',
                              fontSize: '13px',
                              paddingRight: '2px',
                              transition: 'transform 0.15s ease'
                            }}
                            className="hover:translate-x-[-3px]"
                          >
                            <span
                              style={{
                                borderBottom: '1px dashed color-mix(in srgb, var(--border-color) 60%, transparent)',
                                transition: 'border-color 0.15s ease',
                                display: 'inline-block'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                <span>
                                  {row.withdrawn > 0 ? (
                                    <span style={{ color: '#ef4444', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                      ₹ {row.withdrawn.toLocaleString('en-IN')}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'color-mix(in srgb, var(--text-muted) 50%, transparent)', whiteSpace: 'nowrap' }}>
                                      ₹ 0
                                    </span>
                                  )}
                                </span>

                                <button
                                  type="button"
                                  aria-label="View withdrawn amount notes"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNoteModal({ monthIdx: idx, field: 'withdrawn' });
                                    setNoteText(capitalChanges[idx]?.withdrawnNotes || '');
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '2px',
                                    borderRadius: '9999px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: capitalChanges[idx]?.withdrawnNotes ? '#ef4444' : 'color-mix(in srgb, var(--text-muted) 50%, transparent)',
                                    transition: 'all 0.15s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                                    e.currentTarget.style.color = '#ef4444';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = capitalChanges[idx]?.withdrawnNotes ? '#ef4444' : 'color-mix(in srgb, var(--text-muted) 50%, transparent)';
                                  }}
                                >
                                  <Info size={13} />
                                </button>
                              </div>
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Starting Capital */}
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {row.startingCapital !== null ? (row.startingCapital === 0 ? '₹ 0' : `₹ ${row.startingCapital.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`) : '₹ 0'}
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
                      {row.finalCapital !== null ? (row.finalCapital === 0 ? '₹ 0' : `₹ ${row.finalCapital.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`) : '₹ 0'}
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
              width: '380px',
              maxWidth: 'calc(100vw - 32px)',
              boxShadow: '0 16px 36px rgba(0,0,0,0.18)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                  {noteModal.field === 'added' ? 'Added Amount Notes' : 'Withdrawn Amount Notes'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                  {MONTH_NAMES[noteModal.monthIdx]} - {noteModal.field === 'added' ? 'Added' : 'Withdrawn'} ₹{((noteModal.field === 'added' ? monthlyData[noteModal.monthIdx]?.added : monthlyData[noteModal.monthIdx]?.withdrawn) || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <button onClick={() => setNoteModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
                <X size={16} />
              </button>
            </div>

            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add notes for this amount..."
              maxLength={2000}
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: '8px',
                border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                padding: '10px 12px',
                fontSize: '12px',
                outline: 'none',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                resize: 'none',
                fontFamily: 'inherit'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {noteText.length}/2000 characters
              </span>
              <button
                type="button"
                onClick={() => {
                  const mIdx = noteModal.monthIdx;
                  const fType = noteModal.field === 'added' ? 'deposit' : 'withdrawal';
                  setNoteModal(null);
                  openFlowModal(mIdx, fType);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Detailed Ledger Entries
              </button>
            </div>

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
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exact Dated Cash Flow (Deposits & Withdrawals) Modal */}
      {flowModal && (
        <div
          onClick={() => setFlowModal(null)}
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
              padding: '24px',
              width: '460px',
              maxWidth: 'calc(100vw - 32px)',
              boxShadow: '0 16px 36px rgba(0,0,0,0.18)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {MONTH_NAMES[flowModal.monthIdx]} {selectedYear} — {flowModal.type === 'deposit' ? 'Deposits (Added Funds)' : 'Withdrawals'}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Exact calendar dates insulate your portfolio drawdown from cash flows.
                </p>
              </div>
              <button
                onClick={() => setFlowModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* List of existing entries in this month */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {((flowModal.type === 'deposit' ? monthEntries[flowModal.monthIdx]?.deposits : monthEntries[flowModal.monthIdx]?.withdrawals) || []).map(entry => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)',
                    fontSize: '12.5px'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: flowModal.type === 'deposit' ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
                        {flowModal.type === 'deposit' ? '+' : '-'}₹{entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        {entry.date}
                      </span>
                    </div>
                    {entry.note && (
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {entry.note}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleStartEditEntry(entry)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        background: 'none',
                        border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: 'var(--text-primary)'
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(entry.id)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        background: 'none',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: '#ef4444'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {((flowModal.type === 'deposit' ? monthEntries[flowModal.monthIdx]?.deposits : monthEntries[flowModal.monthIdx]?.withdrawals) || []).length === 0 && (
                <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No {flowModal.type} entries recorded for this month.
                </div>
              )}
            </div>

            {/* Form to Add / Edit */}
            <form onSubmit={handleSaveEntry} style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)', paddingTop: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {editingEntry ? 'Edit Entry' : `Add New ${flowModal.type === 'deposit' ? 'Deposit' : 'Withdrawal'}`}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                    Amount (₹)*
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={flowAmount}
                    onChange={(e) => setFlowAmount(e.target.value)}
                    placeholder="e.g. 500000"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '7px 9px',
                      borderRadius: '8px',
                      border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                    Date (cannot be future)*
                  </label>
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().split('T')[0]}
                    value={flowDate}
                    onChange={(e) => setFlowDate(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '7px 9px',
                      borderRadius: '8px',
                      border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                  Note / Reference
                </label>
                <input
                  type="text"
                  value={flowNote}
                  onChange={(e) => setFlowNote(e.target.value)}
                  placeholder="e.g. Bank transfer, quarterly settlement"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '7px 9px',
                    borderRadius: '8px',
                    border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                {editingEntry && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEntry(null);
                      setFlowAmount('');
                      setFlowNote('');
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                      background: 'none',
                      fontSize: '12px',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFlowModal(null)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                    background: 'none',
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)'
                  }}
                >
                  Done
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg-surface)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {editingEntry ? 'Update Entry' : 'Add Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Right Notification for Unset Starting Capital */}
      {isFundZero && !isUnsetCapitalDismissed && createPortal(
        <div
          style={{
            position: 'fixed',
            bottom: '72px',
            right: '24px',
            zIndex: 999999,
            width: '356px',
            maxWidth: 'calc(100vw - 32px)',
            backgroundColor: 'var(--bg-card, #ffffff)',
            color: 'var(--text-primary, #111827)',
            border: '1px solid var(--border-color, rgba(0, 0, 0, 0.12))',
            borderRadius: '14px',
            boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.05)',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}
        >
          {/* Lucid Info Icon (Black & White monochrome theme, no emoji) */}
          <div style={{ flexShrink: 0, marginTop: '2px', color: 'var(--text-primary, #111827)' }}>
            <Info size={16} strokeWidth={2} />
          </div>

          <div style={{ flex: 1, paddingRight: '12px' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary, #111827)', letterSpacing: '-0.01em' }}>
              Starting Capital Unset
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #6b7280)', marginTop: '3px', lineHeight: '1.45' }}>
              Set your starting capital (portfolio base capital or a ledger deposit) to calculate returns. Cumulative Net P&L: <strong>₹ {yearlySummary.totalNetPl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsUnsetCapitalDismissed(true)}
            aria-label="Close notification"
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: 'var(--text-muted, #9ca3af)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary, #111827)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #9ca3af)'}
          >
            <X size={14} />
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
