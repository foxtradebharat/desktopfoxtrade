import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, GripVertical, Calendar, Pencil, ChevronDown, Upload, ChevronLeft, ChevronRight, 
  Trash2, Columns, ArrowUpRight, Image as ImageIcon, UploadCloud, Hash, PenLine, Folder,
  Check, X, CheckSquare, Loader2
} from 'lucide-react';
import TradeHoverCard from './TradeHoverCard';
import StockAutocomplete from './StockAutocomplete';
import SymbolLogo from './SymbolLogo';
import UploadChartModal from './UploadChartModal';
import ModernDropdown from './ModernDropdown';
import SetupDropdown from './SetupDropdown';
import BrokerDropdown from './BrokerDropdown';
import EntryTypeDropdown from './EntryTypeDropdown';
import GrowthAreaDropdown from './GrowthAreaDropdown';
import ExitTriggerDropdown from './ExitTriggerDropdown';
import TradeSummaryPopover from './TradeSummaryPopover';
import { fetchLiveCMPForSymbol, getCachedCMP } from '../services/strikePriceService';

const COLUMNS = [
  { id: 'tradeNo', label: 'TRADE NO.', width: '108px' },
  { id: 'date', label: 'DATE', width: '164px' },
  { id: 'name', label: 'NAME', width: '170px' },
  { id: 'broker', label: 'BROKER', width: '135px' },
  { id: 'setup', label: 'SETUP', width: '185px' },
  { id: 'type', label: 'BUY/SELL', width: '105px' },
  { id: 'entry', label: 'ENTRY', unit: '(₹)', width: '115px', align: 'right' },
  { id: 'avgEntry', label: 'AVG ENTRY', unit: '(₹)', width: '115px', align: 'right' },
  { id: 'sl', label: 'SL', unit: '(₹)', width: '110px', align: 'right' },
  { id: 'cmp', label: 'CMP', unit: '(₹)', width: '115px', align: 'right' },
  { id: 'entryType', label: 'ENTRY TYPE', width: '135px' },
  { id: 'qty', label: 'INITIAL QTY/LOT', width: '120px', align: 'right' },
  // P1
  { id: 'p1Price', label: 'P1 PRICE', unit: '(₹)', width: '115px', align: 'right' },
  { id: 'p1Qty', label: 'P1 QTY/LOT', width: '110px', align: 'right' },
  { id: 'p1Date', label: 'P1 DATE', width: '135px' },
  { id: 'p1Sl', label: 'P1 SL', unit: '(₹)', width: '110px', align: 'right' },
  // P2
  { id: 'p2Price', label: 'P2 PRICE', unit: '(₹)', width: '115px', align: 'right' },
  { id: 'p2Qty', label: 'P2 QTY/LOT', width: '110px', align: 'right' },
  { id: 'p2Date', label: 'P2 DATE', width: '135px' },
  { id: 'p2Sl', label: 'P2 SL', unit: '(₹)', width: '110px', align: 'right' },
  // P3
  { id: 'p3Price', label: 'P3 PRICE', unit: '(₹)', width: '115px', align: 'right' },
  { id: 'p3Qty', label: 'P3 QTY/LOT', width: '110px', align: 'right' },
  { id: 'p3Date', label: 'P3 DATE', width: '135px' },
  { id: 'p3Sl', label: 'P3 SL', unit: '(₹)', width: '110px', align: 'right' },
  // P4
  { id: 'p4Price', label: 'P4 PRICE', unit: '(₹)', width: '115px', align: 'right' },
  { id: 'p4Qty', label: 'P4 QTY/LOT', width: '110px', align: 'right' },
  { id: 'p4Date', label: 'P4 DATE', width: '135px' },
  { id: 'p4Sl', label: 'P4 SL', unit: '(₹)', width: '110px', align: 'right' },
  // TSL
  { id: 'tsl', label: 'TSL', unit: '(₹)', width: '115px', align: 'right' },
  { id: 'tslGroups', label: 'TSL GROUPS', width: '125px', align: 'center' },
  // Positions & Allocations
  { id: 'positionSize', label: 'POSITION SIZE', unit: '(₹)', width: '130px', align: 'right' },
  { id: 'currentAllocation', label: 'CURRENT ALLOCATION', unit: '(%)', width: '145px', align: 'right' },
  { id: 'peakAllocation', label: 'PEAK ALLOCATION', unit: '(%)', width: '145px', align: 'right' },
  { id: 'slPct', label: 'SL', unit: '%', width: '90px', align: 'right' },
  // E1
  { id: 'e1Price', label: 'E1 PRICE', unit: '(₹)', width: '115px', align: 'right' },
  { id: 'e1Qty', label: 'E1 QTY/LOT', width: '110px', align: 'right' },
  { id: 'e1Date', label: 'E1 DATE', width: '135px' },
  // E2
  { id: 'e2Price', label: 'E2 PRICE', unit: '(₹)', width: '115px', align: 'right' },
  { id: 'e2Qty', label: 'E2 QTY/LOT', width: '110px', align: 'right' },
  { id: 'e2Date', label: 'E2 DATE', width: '135px' },
  // E3
  { id: 'e3Price', label: 'E3 PRICE', unit: '(₹)', width: '115px', align: 'right' },
  { id: 'e3Qty', label: 'E3 QTY/LOT', width: '110px', align: 'right' },
  { id: 'e3Date', label: 'E3 DATE', width: '135px' },
  // E4
  { id: 'e4Price', label: 'E4 PRICE', unit: '(₹)', width: '115px', align: 'right' },
  { id: 'e4Qty', label: 'E4 QTY/LOT', width: '110px', align: 'right' },
  { id: 'e4Date', label: 'E4 DATE', width: '135px' },
  // Exits summary
  { id: 'openQty', label: 'OPEN QTY/LOT', width: '120px', align: 'right' },
  { id: 'exitedQty', label: 'EXITED QTY/LOT', width: '120px', align: 'right' },
  { id: 'avgExitPrice', label: 'AVG EXIT PRICE', unit: '(₹)', width: '130px', align: 'right' },
  { id: 'stockMove', label: 'STOCK MOVE', width: '110px', align: 'right' },
  { id: 'rewardRisk', label: 'REWARD:RISK', width: '110px', align: 'right' },
  { id: 'holdingDays', label: 'HOLDING DAYS', width: '110px', align: 'right' },
  { id: 'status', label: 'POSITION STATUS', width: '125px' },
  { id: 'realisedAmount', label: 'REALISED AMOUNT', unit: '(₹)', width: '140px', align: 'right' },
  { id: 'grossPnl', label: 'Gross P/L', unit: '(₹)', width: '125px', align: 'right' },
  { id: 'pfImpact', label: 'PF IMPACT', unit: '(%)', width: '115px', align: 'right' },
  { id: 'cummPf', label: 'CUMM PF IMPACT', unit: '(%)', width: '140px', align: 'right' },
  { id: 'planFollowed', label: 'PLAN FOLLOWED', width: '130px' },
  { id: 'exitTrigger', label: 'EXIT TRIGGER', width: '140px' },
  { id: 'growthAreas', label: 'GROWTH AREAS', width: '150px' },
  { id: 'capitalAtRisk', label: 'CAPITAL AT RISK', unit: '(%)', width: '145px', align: 'right' },
  { id: 'baseDuration', label: 'BASE DURATION', width: '130px' },
  { id: 'quickNote', label: 'QUICK NOTE', width: '180px' },
  { id: 'unrealized', label: 'UNREALIZED P/L', unit: '(₹)', width: '135px', align: 'right' },
  { id: 'selfRating', label: 'SELF RATING', width: '110px' },
  { id: 'totalQtyBought', label: 'TOTAL QTY BOUGHT', width: '130px', align: 'right' },
  { id: 'mae', label: 'MAE', unit: '(%)', width: '110px', align: 'right' },
  { id: 'mfe', label: 'MFE', unit: '(%)', width: '110px', align: 'right' },
  { id: 'exchangeTradeIds', label: 'EXCHANGE TRADE IDS', width: '150px' },
  { id: 'transactionHistory', label: 'TRANSACTION HISTORY', width: '150px' }
];

const DEFAULT_VISIBLE_COL_IDS = [
  'tradeNo', 'date', 'name', 'broker', 'setup', 'type', 'entry', 'avgEntry', 'sl', 'cmp', 'entryType', 'qty',
  'p1Price', 'p1Qty', 'p1Date', 'p1Sl',
  'p2Price', 'p2Qty', 'p2Date', 'p2Sl',
  'p3Price', 'p3Qty', 'p3Date', 'p3Sl',
  'p4Price', 'p4Qty', 'p4Date', 'p4Sl',
  'tsl', 'tslGroups',
  'positionSize', 'currentAllocation', 'peakAllocation', 'slPct',
  'e1Price', 'e1Qty', 'e1Date',
  'e2Price', 'e2Qty', 'e2Date',
  'e3Price', 'e3Qty', 'e3Date',
  'e4Price', 'e4Qty', 'e4Date',
  'openQty', 'exitedQty', 'avgExitPrice', 'stockMove', 'rewardRisk', 'holdingDays', 'status',
  'realisedAmount', 'grossPnl', 'pfImpact', 'cummPf', 'planFollowed', 'exitTrigger', 'growthAreas',
  'capitalAtRisk', 'baseDuration', 'quickNote', 'unrealized'
];

/**
 * Format standard Indian currency (₹1,476.90)
 */
function formatRupee(num) {
  if (num === null || num === undefined || isNaN(num)) return '₹0.00';
  const val = Number(num);
  return '₹' + val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Safely parse Gross P/L value from trade object
 */
function parseGrossPnl(trade) {
  if (!trade) return 0;
  const raw = trade.grossPnl !== undefined && trade.grossPnl !== null && trade.grossPnl !== ''
    ? trade.grossPnl
    : (trade.pnl !== undefined && trade.pnl !== null && trade.pnl !== ''
      ? trade.pnl
      : (trade.pl !== undefined && trade.pl !== null && trade.pl !== '' ? trade.pl : 0));
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  const cleaned = String(raw).replace(/[₹$,% ]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Helper to convert various date formats (DD-MM-YYYY, DD/MM/YYYY, DD MMM YYYY) to YYYY-MM-DD for <input type="date">
 */
function toInputDateFormat(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  
  // DD-MM-YYYY or DD/MM/YYYY
  const parts = trimmed.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 2 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  // DD MMM YYYY (e.g. 08 Apr 2026)
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
}

/**
 * Helper to format date for display (DD-MM-YYYY)
 */
function toDisplayDateFormat(dateStr) {
  if (!dateStr) return '-';
  const inputFmt = toInputDateFormat(dateStr);
  if (inputFmt) {
    const [y, m, d] = inputFmt.split('-');
    return `${d}-${m}-${y}`;
  }
  return dateStr;
}

/**
 * Clean inline editable cell
 */
function EditableCell({ value, placeholder = '0.00', isCurrency = false, isInteger = false, onChange, align = 'left', isCmp = false, isFetching = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempVal, setTempVal] = useState(value || '');
  const inputRef = useRef(null);

  useEffect(() => {
    setTempVal(value || '');
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (tempVal !== value) {
      onChange(tempVal);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setTempVal(value || '');
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={isInteger ? 'number' : 'text'}
        value={tempVal}
        placeholder={placeholder}
        onChange={(e) => setTempVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          fontSize: '13px',
          fontWeight: 500,
          textAlign: align,
          height: '28px',
          padding: '2px 6px',
          borderRadius: '6px',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--accent-orange, #f97316)',
          boxShadow: '0 0 0 1px var(--accent-orange, #f97316)',
          outline: 'none',
          boxSizing: 'border-box'
        }}
      />
    );
  }

  if (isFetching) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          width: '100%',
          height: '28px',
          padding: '2px 6px',
          gap: '5px',
          boxSizing: 'border-box'
        }}
      >
        <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite', color: '#10b981', flexShrink: 0 }} />
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>Live...</span>
      </div>
    );
  }

  let formatted = value ? String(value) : placeholder;
  const num = parseFloat(value);
  if (!isNaN(num) && value !== '' && value !== null) {
    if (isCurrency) {
      formatted = formatRupee(num);
    } else if (isInteger) {
      formatted = Math.round(num).toString();
    }
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        width: '100%',
        height: '28px',
        padding: '2px 6px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: 450,
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--text-primary, #111827)',
        cursor: 'text',
        userSelect: 'none',
        transition: 'background-color 0.1s ease',
        boxSizing: 'border-box'
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <span>{formatted}</span>
      {isCmp && (
        <PenLine size={11} style={{ color: 'var(--text-muted, #6b7280)', opacity: 0.5, marginLeft: '3px', flexShrink: 0 }} />
      )}
    </div>
  );
}

function PeakAllocationCell({ trade, val, cellStickyStyle }) {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState(null);
  const cellRef = useRef(null);
  const numericVal = parseFloat(val) || 0;

  const entry = parseFloat(trade.entry) || 0;
  const qty = parseFloat(trade.qty) || 0;
  const p1Price = parseFloat(trade.p1Price) || 0;
  const p1Qty = parseFloat(trade.p1Qty) || 0;
  const p2Price = parseFloat(trade.p2Price) || 0;
  const p2Qty = parseFloat(trade.p2Qty) || 0;
  const p3Price = parseFloat(trade.p3Price) || 0;
  const p3Qty = parseFloat(trade.p3Qty) || 0;
  const p4Price = parseFloat(trade.p4Price) || 0;
  const p4Qty = parseFloat(trade.p4Qty) || 0;

  const initialCost = entry * qty;
  const p1Cost = p1Price * p1Qty;
  const p2Cost = p2Price * p2Qty;
  const p3Cost = p3Price * p3Qty;
  const p4Cost = p4Price * p4Qty;
  const totalCost = initialCost + p1Cost + p2Cost + p3Cost + p4Cost;

  let initialAlloc = 0;
  let p1Alloc = 0;
  let p2Alloc = 0;
  let p3Alloc = 0;
  let p4Alloc = 0;

  if (totalCost > 0 && numericVal > 0) {
    initialAlloc = (initialCost / totalCost) * numericVal;
    p1Alloc = (p1Cost / totalCost) * numericVal;
    p2Alloc = (p2Cost / totalCost) * numericVal;
    p3Alloc = (p3Cost / totalCost) * numericVal;
    p4Alloc = (p4Cost / totalCost) * numericVal;
  } else {
    initialAlloc = numericVal;
  }

  const updatePosition = () => {
    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      const placeAbove = rect.top > 220;
      setCoords({
        top: placeAbove ? rect.top - 8 : rect.bottom + 8,
        transform: placeAbove ? 'translateY(-100%)' : 'none',
        right: Math.max(16, window.innerWidth - rect.right)
      });
    }
  };

  const handleMouseEnter = () => {
    updatePosition();
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    updatePosition();
    setIsHovered(prev => !prev);
  };

  return (
    <td
      style={{
        padding: '12px 14px',
        whiteSpace: 'nowrap',
        textAlign: 'right',
        verticalAlign: 'middle',
        fontWeight: 600,
        fontSize: '13px',
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--text-primary)',
        ...cellStickyStyle
      }}
    >
      <div
        ref={cellRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '4px',
          cursor: 'help',
          padding: '2px 4px',
          borderRadius: '4px',
          backgroundColor: isHovered ? 'var(--bg-hover)' : 'transparent',
          transition: 'background-color 0.15s ease'
        }}
      >
        <span>{numericVal.toFixed(2)}%</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.9, flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      {isHovered && coords && createPortal(
        <div
          style={{
            position: 'fixed',
            top: coords.top,
            right: coords.right,
            transform: coords.transform,
            zIndex: 999999,
            width: '230px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 16px 40px -4px rgba(0, 0, 0, 0.3), 0 4px 12px -2px rgba(0, 0, 0, 0.12)',
            padding: '12px 14px',
            fontSize: '12px',
            color: 'var(--text-primary)',
            textAlign: 'left',
            pointerEvents: 'none',
            boxSizing: 'border-box',
            animation: 'foxtradeFadeZoom 0.15s ease'
          }}
        >
          {/* Header */}
          <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '8px', color: 'var(--text-primary)' }}>
            Peak allocation breakdown
          </div>

          {/* Breakdown List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Initial</span>
              <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                {initialAlloc > 0 ? `${initialAlloc.toFixed(2)}%` : '-'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>P1</span>
              <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                {p1Qty > 0 && p1Alloc > 0 ? `${p1Alloc.toFixed(2)}%` : '-'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>P2</span>
              <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                {p2Qty > 0 && p2Alloc > 0 ? `${p2Alloc.toFixed(2)}%` : '-'}
              </span>
            </div>

            {p3Qty > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>P3</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {p3Alloc > 0 ? `${p3Alloc.toFixed(2)}%` : '-'}
                </span>
              </div>
            )}

            {p4Qty > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>P4</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {p4Alloc > 0 ? `${p4Alloc.toFixed(2)}%` : '-'}
                </span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '8px 0' }} />

          {/* Summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '11.5px', color: 'var(--text-primary)' }}>
            <span>Peak deployed</span>
            <span style={{ fontFamily: 'monospace' }}>{numericVal.toFixed(2)}%</span>
          </div>

          {/* Footnote */}
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.3 }}>
            Exits reduce live exposure before later entries.
          </div>
        </div>,
        document.body
      )}
    </td>
  );
}

function parseDateStrToObj(dStr) {
  if (!dStr) return null;
  if (typeof dStr === 'string' && dStr.includes('-')) {
    const parts = dStr.split('-');
    if (parts[0].length === 4) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else if (parts[2].length === 4) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
  }
  const d = new Date(dStr);
  return isNaN(d.getTime()) ? null : d;
}

function getDaysBetween(d1Str, d2Str) {
  const d1 = parseDateStrToObj(d1Str);
  const d2 = parseDateStrToObj(d2Str) || new Date();
  if (!d1) return 0;
  const diffTime = d2.getTime() - d1.getTime();
  return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
}

function StockMoveCell({ trade, val, cellStickyStyle }) {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState(null);
  const cellRef = useRef(null);
  const numericVal = parseFloat(val) || 0;

  const isClosed = trade.status === 'Closed' || (parseFloat(trade.openQty) || 0) === 0;
  const exitOrCmp = isClosed
    ? (parseFloat(trade.avgExitPrice) || parseFloat(trade.cmp) || 0)
    : (parseFloat(trade.cmp) || parseFloat(trade.entry) || 0);

  const isBuy = (trade.type || 'Buy').toLowerCase() === 'buy';

  const entryMoves = [];
  const initialQty = parseFloat(trade.qty) || 0;
  const initialEntry = parseFloat(trade.entry) || 0;
  if (initialQty > 0 && initialEntry > 0) {
    const move = ((exitOrCmp - initialEntry) / initialEntry) * 100;
    entryMoves.push({ label: 'Initial Entry', qty: initialQty, move });
  }

  for (let i = 1; i <= 4; i++) {
    const pQty = parseFloat(trade[`p${i}Qty`]) || 0;
    const pPrice = parseFloat(trade[`p${i}Price`]) || 0;
    if (pQty > 0 && pPrice > 0) {
      const move = ((exitOrCmp - pPrice) / pPrice) * 100;
      entryMoves.push({ label: `P${i}`, qty: pQty, move });
    }
  }

  const updatePosition = () => {
    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      const placeAbove = rect.top > 220;
      setCoords({
        top: placeAbove ? rect.top - 8 : rect.bottom + 8,
        transform: placeAbove ? 'translateY(-100%)' : 'none',
        right: Math.max(16, window.innerWidth - rect.right)
      });
    }
  };

  const handleMouseEnter = () => {
    updatePosition();
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    updatePosition();
    setIsHovered(prev => !prev);
  };

  const color = numericVal > 0 ? '#10b981' : numericVal < 0 ? '#ef4444' : '#6b7280';

  return (
    <td
      style={{
        padding: '12px 14px',
        whiteSpace: 'nowrap',
        textAlign: 'right',
        verticalAlign: 'middle',
        fontWeight: 600,
        fontSize: '13px',
        fontVariantNumeric: 'tabular-nums',
        color,
        ...cellStickyStyle
      }}
    >
      <div
        ref={cellRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '4px',
          cursor: 'help',
          padding: '2px 4px',
          borderRadius: '4px',
          backgroundColor: isHovered ? 'var(--bg-hover)' : 'transparent',
          transition: 'background-color 0.15s ease'
        }}
      >
        <span>{numericVal > 0 ? '+' : ''}{numericVal.toFixed(2)}%</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.9, flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      {isHovered && coords && createPortal(
        <div
          style={{
            position: 'fixed',
            top: coords.top,
            right: coords.right,
            transform: coords.transform,
            zIndex: 999999,
            width: '240px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 16px 40px -4px rgba(0, 0, 0, 0.3), 0 4px 12px -2px rgba(0, 0, 0, 0.12)',
            padding: '12px 14px',
            fontSize: '12px',
            color: 'var(--text-primary)',
            textAlign: 'left',
            pointerEvents: 'none',
            boxSizing: 'border-box',
            animation: 'foxtradeFadeZoom 0.15s ease'
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '8px', color: 'var(--text-primary)' }}>
            Individual Stock Moves:
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px' }}>
            {entryMoves.map((m, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{m.label} ({m.qty} qty)</span>
                <span style={{ 
                  fontWeight: 600, 
                  fontFamily: 'monospace', 
                  color: m.move > 0 ? '#10b981' : m.move < 0 ? '#ef4444' : 'var(--text-primary)' 
                }}>
                  {m.move > 0 ? '+' : ''}{m.move.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.3 }}>
            * Realized moves based on Avg. Exit vs. entry prices.
          </div>
        </div>,
        document.body
      )}
    </td>
  );
}

function RewardRiskCell({ trade, val, cellStickyStyle }) {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState(null);
  const cellRef = useRef(null);
  const numericVal = (val !== null && val !== undefined && val !== '' && !isNaN(parseFloat(val))) 
    ? parseFloat(val) 
    : (trade.rewardRisk !== null && trade.rewardRisk !== undefined && trade.rewardRisk !== '' && !isNaN(parseFloat(trade.rewardRisk)) ? parseFloat(trade.rewardRisk) : null);

  const isBuy = (trade.type || 'Buy').toLowerCase() === 'buy';
  const isClosed = trade.status === 'Closed' || (parseFloat(trade.openQty) || 0) === 0;
  const exitOrCmp = isClosed
    ? (parseFloat(trade.avgExitPrice) || parseFloat(trade.cmp) || 0)
    : (parseFloat(trade.cmp) || parseFloat(trade.entry) || 0);

  const entry = parseFloat(trade.entry) || 0;
  const qty = parseFloat(trade.qty) || 0;
  const sl = (trade.sl !== undefined && trade.sl !== null && trade.sl !== '' && !isNaN(parseFloat(trade.sl)) && parseFloat(trade.sl) > 0) ? parseFloat(trade.sl) : null;

  const entryRrLegs = [];
  let totalRiskAmount = 0;
  let totalRewardAmount = 0;

  // Initial Entry
  if (qty > 0 && entry > 0) {
    const riskPerShare = (sl !== null && sl > 0) ? Math.abs(entry - sl) : null;
    const rewardPerShare = isBuy ? (exitOrCmp - entry) : (entry - exitOrCmp);
    const legRr = (riskPerShare !== null && riskPerShare > 0) ? rewardPerShare / riskPerShare : null;
    const legRiskTotal = (riskPerShare !== null && riskPerShare > 0) ? riskPerShare * qty : 0;
    const legRewardTotal = rewardPerShare * qty;

    totalRiskAmount += legRiskTotal;
    totalRewardAmount += legRewardTotal;

    entryRrLegs.push({
      title: 'Initial Entry',
      entry,
      sl,
      risk: riskPerShare,
      reward: rewardPerShare,
      rr: legRr,
      isRealized: isClosed
    });
  }

  // Pyramids
  for (let i = 1; i <= 4; i++) {
    const pQty = parseFloat(trade[`p${i}Qty`]) || 0;
    const pPrice = parseFloat(trade[`p${i}Price`]) || 0;
    const pSl = (trade[`p${i}Sl`] !== undefined && trade[`p${i}Sl`] !== null && trade[`p${i}Sl`] !== '' && !isNaN(parseFloat(trade[`p${i}Sl`])) && parseFloat(trade[`p${i}Sl`]) > 0) ? parseFloat(trade[`p${i}Sl`]) : sl;
    if (pQty > 0 && pPrice > 0) {
      const riskPerShare = (pSl !== null && pSl > 0) ? Math.abs(pPrice - pSl) : null;
      const rewardPerShare = isBuy ? (exitOrCmp - pPrice) : (pPrice - exitOrCmp);
      const legRr = (riskPerShare !== null && riskPerShare > 0) ? rewardPerShare / riskPerShare : null;
      
      if (riskPerShare !== null && riskPerShare > 0) {
        totalRiskAmount += riskPerShare * pQty;
      }
      totalRewardAmount += rewardPerShare * pQty;

      entryRrLegs.push({
        title: `P${i} Entry`,
        entry: pPrice,
        sl: pSl,
        risk: riskPerShare,
        reward: rewardPerShare,
        rr: legRr,
        isRealized: isClosed
      });
    }
  }

  const effectiveRr = totalRiskAmount > 0 ? totalRewardAmount / totalRiskAmount : numericVal;

  const updatePosition = () => {
    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      const placeAbove = rect.top > 260;
      setCoords({
        top: placeAbove ? rect.top - 8 : rect.bottom + 8,
        transform: placeAbove ? 'translateY(-100%)' : 'none',
        right: Math.max(16, window.innerWidth - rect.right)
      });
    }
  };

  const handleMouseEnter = () => {
    updatePosition();
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    updatePosition();
    setIsHovered(prev => !prev);
  };

  const color = numericVal !== null && numericVal !== undefined 
    ? (numericVal > 0 ? '#10b981' : numericVal < 0 ? '#ef4444' : '#6b7280') 
    : '#6b7280';

  return (
    <td
      style={{
        padding: '12px 14px',
        whiteSpace: 'nowrap',
        textAlign: 'right',
        verticalAlign: 'middle',
        fontWeight: 600,
        fontSize: '13px',
        fontVariantNumeric: 'tabular-nums',
        color,
        ...cellStickyStyle
      }}
    >
      <div
        ref={cellRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '4px',
          cursor: 'help',
          padding: '2px 4px',
          borderRadius: '4px',
          backgroundColor: isHovered ? 'var(--bg-hover)' : 'transparent',
          transition: 'background-color 0.15s ease'
        }}
      >
        <span>{numericVal !== null && numericVal !== undefined ? `${numericVal > 0 ? '+' : ''}${numericVal.toFixed(2)}R` : '—'}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.9, flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      {isHovered && coords && createPortal(
        <div
          style={{
            position: 'fixed',
            top: coords.top,
            right: coords.right,
            transform: coords.transform,
            zIndex: 999999,
            width: '290px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 16px 40px -4px rgba(0, 0, 0, 0.3), 0 4px 12px -2px rgba(0, 0, 0, 0.12)',
            padding: '12px 14px',
            fontSize: '12px',
            color: 'var(--text-primary)',
            textAlign: 'left',
            pointerEvents: 'none',
            boxSizing: 'border-box',
            animation: 'foxtradeFadeZoom 0.15s ease'
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '8px', color: 'var(--text-primary)' }}>
            Reward:Risk Breakdown
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
            {entryRrLegs.map((leg, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', backgroundColor: 'var(--bg-hover)', padding: '6px 8px', borderRadius: '6px' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '11px' }}>{leg.title}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Risk: |Entry - SL| = {leg.entry.toFixed(2)} - {leg.sl.toFixed(2)} = <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{leg.risk.toFixed(2)}</span></div>
                <div style={{ color: 'var(--text-secondary)' }}>Reward: <span style={{ fontWeight: 600, color: leg.reward >= 0 ? '#10b981' : '#ef4444' }}>{leg.reward.toFixed(2)}</span> ({leg.isRealized ? 'Realized' : 'Unrealized'})</div>
                <div style={{ color: 'var(--text-secondary)' }}>R:R: [{leg.reward.toFixed(2)} / {leg.risk.toFixed(2)}] = <span style={{ fontWeight: 700, color: leg.rr >= 0 ? '#10b981' : '#ef4444' }}>{leg.rr >= 0 ? '+' : ''}{leg.rr.toFixed(2)}R</span></div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, fontSize: '11.5px', marginBottom: '6px', color: 'var(--text-primary)' }}>
              Overall R:R Analysis
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Total Risk:</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{formatRupee(totalRiskAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Total Reward:</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace', color: totalRewardAmount >= 0 ? '#10b981' : '#ef4444' }}>
                  {totalRewardAmount < 0 ? `-${formatRupee(Math.abs(totalRewardAmount))}` : `+${formatRupee(totalRewardAmount)}`}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', fontWeight: 700, color: 'var(--text-primary)' }}>
                <span>Effective Position R:R:</span>
                <span style={{ fontFamily: 'monospace', color: effectiveRr >= 0 ? '#10b981' : '#ef4444' }}>
                  {effectiveRr >= 0 ? '+' : ''}{effectiveRr.toFixed(2)}R
                </span>
              </div>
              <div style={{ textAlign: 'right', fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                [ {totalRewardAmount.toFixed(2)} / {totalRiskAmount.toFixed(2)} ]
              </div>
            </div>
          </div>

          <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '8px', lineHeight: 1.3 }}>
            * All rewards are {isClosed ? 'realized (based on actual exit prices)' : 'calculated based on actual exits and CMP'}.
          </div>
        </div>,
        document.body
      )}
    </td>
  );
}

function HoldingDaysCell({ trade, val, cellStickyStyle, costBasisMethod = 'fifo' }) {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState(null);
  const cellRef = useRef(null);
  const numericVal = (val !== null && val !== undefined && !isNaN(parseInt(val, 10))) 
    ? parseInt(val, 10) 
    : ((trade.holdingDays !== null && trade.holdingDays !== undefined && !isNaN(parseInt(trade.holdingDays, 10))) ? parseInt(trade.holdingDays, 10) : 0);

  const holdingBreakdown = useMemo(() => {
    const entryLots = [];
    const initialQty = parseFloat(trade.qty) || 0;
    if (initialQty > 0) {
      entryLots.push({ label: 'Initial Entry', qty: initialQty, date: trade.date });
    }
    for (let i = 1; i <= 4; i++) {
      const pQty = parseFloat(trade[`p${i}Qty`]) || 0;
      if (pQty > 0) {
        entryLots.push({ label: `P${i}`, qty: pQty, date: trade[`p${i}Date`] || trade.date });
      }
    }

    const exitLots = [];
    for (let i = 1; i <= 4; i++) {
      const eQty = parseFloat(trade[`e${i}Qty`]) || 0;
      if (eQty > 0) {
        exitLots.push({ label: `E${i}`, qty: eQty, date: trade[`e${i}Date`] || trade.date });
      }
    }

    const fifoItems = [];
    let closedWeightedSum = 0;
    let totalClosedQty = 0;
    let openWeightedSum = 0;
    let totalOpenQty = 0;

    const remainingEntries = entryLots.map(e => ({ ...e, remQty: e.qty }));
    const isLifo = costBasisMethod === 'lifo';

    exitLots.forEach(exit => {
      let exitQtyToMatch = exit.qty;
      const entriesToScan = isLifo ? [...remainingEntries].reverse() : remainingEntries;
      for (let entry of entriesToScan) {
        if (exitQtyToMatch <= 0) break;
        if (entry.remQty > 0) {
          const matchQty = Math.min(entry.remQty, exitQtyToMatch);
          const days = getDaysBetween(entry.date, exit.date);
          fifoItems.push({
            label: `${entry.label} (sold) - ${matchQty} qty`,
            days,
            qty: matchQty,
            status: 'sold'
          });
          closedWeightedSum += matchQty * days;
          totalClosedQty += matchQty;
          entry.remQty -= matchQty;
          exitQtyToMatch -= matchQty;
        }
      }
    });

    const todayStr = new Date().toISOString().split('T')[0];
    remainingEntries.forEach(entry => {
      if (entry.remQty > 0) {
        const days = getDaysBetween(entry.date, todayStr);
        fifoItems.push({
          label: `${entry.label} (open) - ${entry.remQty} qty`,
          days,
          qty: entry.remQty,
          status: 'open'
        });
        openWeightedSum += entry.remQty * days;
        totalOpenQty += entry.remQty;
      }
    });

    const closedWeighted = totalClosedQty > 0 ? Math.round(closedWeightedSum / totalClosedQty) : 0;
    const openWeighted = totalOpenQty > 0 ? Math.round(openWeightedSum / totalOpenQty) : 0;
    const totalAllQty = totalClosedQty + totalOpenQty;
    const overall = totalAllQty > 0 
      ? Math.round((closedWeightedSum + openWeightedSum) / totalAllQty) 
      : ((numericVal !== null && numericVal !== undefined) ? numericVal : 0);

    return {
      fifoItems,
      openWeighted,
      closedWeighted,
      overall
    };
  }, [trade, numericVal]);

  const updatePosition = () => {
    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      const placeAbove = rect.top > 220;
      setCoords({
        top: placeAbove ? rect.top - 8 : rect.bottom + 8,
        transform: placeAbove ? 'translateY(-100%)' : 'none',
        right: Math.max(16, window.innerWidth - rect.right)
      });
    }
  };

  const handleMouseEnter = () => {
    updatePosition();
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    updatePosition();
    setIsHovered(prev => !prev);
  };

  const displayDays = (holdingBreakdown.overall !== null && holdingBreakdown.overall !== undefined) 
    ? holdingBreakdown.overall 
    : numericVal;

  return (
    <td
      style={{
        padding: '12px 14px',
        whiteSpace: 'nowrap',
        textAlign: 'right',
        verticalAlign: 'middle',
        fontSize: '13px',
        color: 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums',
        ...cellStickyStyle
      }}
    >
      <div
        ref={cellRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '4px',
          cursor: 'help',
          padding: '2px 4px',
          borderRadius: '4px',
          backgroundColor: isHovered ? 'var(--bg-hover)' : 'transparent',
          transition: 'background-color 0.15s ease'
        }}
      >
        <span>{displayDays} {displayDays === 1 ? 'day' : 'days'}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.9, flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      {isHovered && coords && createPortal(
        <div
          style={{
            position: 'fixed',
            top: coords.top,
            right: coords.right,
            transform: coords.transform,
            zIndex: 999999,
            width: '260px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 16px 40px -4px rgba(0, 0, 0, 0.3), 0 4px 12px -2px rgba(0, 0, 0, 0.12)',
            padding: '12px 14px',
            fontSize: '12px',
            color: 'var(--text-primary)',
            textAlign: 'left',
            pointerEvents: 'none',
            boxSizing: 'border-box',
            animation: 'foxtradeFadeZoom 0.15s ease'
          }}
        >
          {/* FIFO Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px' }}>
            {holdingBreakdown.fifoItems.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{item.label}</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {item.days} {item.days === 1 ? 'day' : 'days'}
                </span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '8px 0' }} />

          {/* Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Open-weighted</span>
              <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                {holdingBreakdown.openWeighted} {holdingBreakdown.openWeighted === 1 ? 'day' : 'days'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Closed-weighted</span>
              <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                {holdingBreakdown.closedWeighted} {holdingBreakdown.closedWeighted === 1 ? 'day' : 'days'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--text-primary)' }}>
              <span>Overall</span>
              <span style={{ fontFamily: 'monospace' }}>
                {holdingBreakdown.overall} {holdingBreakdown.overall === 1 ? 'day' : 'days'}
              </span>
            </div>
          </div>

          {/* Footnote */}
          <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '8px', lineHeight: 1.3 }}>
            Entry to exit for each lot ({costBasisMethod.toUpperCase()}).
          </div>
        </div>,
        document.body
      )}
    </td>
  );
}

function PfImpactCell({ trade, val, portfolioCapital = 212088.09, cellStickyStyle }) {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState(null);
  const cellRef = useRef(null);
  const numericVal = parseFloat(val) || 0;

  const isBuy = (trade.type || 'Buy').toLowerCase() === 'buy';
  const totalQtyExited = parseFloat(trade.exitedQty) || 0;
  const isClosed = trade.status === 'Closed';
  const totalPnl = (totalQtyExited > 0 || isClosed) ? parseFloat(trade.pnl ?? trade.grossPnl ?? 0) : 0;
  const pfBaseline = parseFloat(trade.portfolioCapital || portfolioCapital || 212088.09);

  // Compute Exit Tranches and FIFO Segments
  const breakdown = useMemo(() => {
    const exits = [];
    for (let i = 1; i <= 4; i++) {
      const eQty = parseFloat(trade[`e${i}Qty`]) || 0;
      const ePrice = parseFloat(trade[`e${i}Price`]) || 0;
      const eDate = trade[`e${i}Date`] || trade.date || '';
      if (eQty > 0) {
        const avgEntry = parseFloat(trade.avgEntry || trade.entry) || 0;
        const legPnl = isBuy ? (ePrice - avgEntry) * eQty : (avgEntry - ePrice) * eQty;
        const legImpact = pfBaseline > 0 ? (legPnl / pfBaseline) * 100 : 0;
        exits.push({
          label: `E${i}`,
          date: eDate,
          price: ePrice,
          qty: eQty,
          pnl: legPnl,
          impact: legImpact
        });
      }
    }

    // FIFO Segments against Entry Lots
    const entryLots = [];
    const initialQty = parseFloat(trade.qty) || 0;
    const initialEntry = parseFloat(trade.entry) || 0;
    if (initialQty > 0 && initialEntry > 0) {
      entryLots.push({ label: 'Initial Entry', qty: initialQty, price: initialEntry, date: trade.date });
    }
    for (let i = 1; i <= 4; i++) {
      const pQty = parseFloat(trade[`p${i}Qty`]) || 0;
      const pPrice = parseFloat(trade[`p${i}Price`]) || 0;
      const pDate = trade[`p${i}Date`] || trade.date;
      if (pQty > 0 && pPrice > 0) {
        entryLots.push({ label: `P${i}`, qty: pQty, price: pPrice, date: pDate });
      }
    }

    const segments = [];
    const remainingEntries = entryLots.map(e => ({ ...e, remQty: e.qty }));

    exits.forEach(exit => {
      let exitQtyToMatch = exit.qty;
      for (let entry of remainingEntries) {
        if (exitQtyToMatch <= 0) break;
        if (entry.remQty > 0) {
          const matchQty = Math.min(entry.remQty, exitQtyToMatch);
          const segmentPnl = isBuy ? (exit.price - entry.price) * matchQty : (entry.price - exit.price) * matchQty;
          const segmentImpact = pfBaseline > 0 ? (segmentPnl / pfBaseline) * 100 : 0;
          segments.push({
            label: `${entry.label} (${entry.date || 'Entry'})`,
            qty: matchQty,
            pnl: segmentPnl,
            impact: segmentImpact,
            pfBaseline
          });
          entry.remQty -= matchQty;
          exitQtyToMatch -= matchQty;
        }
      }
    });

    return { exits, segments };
  }, [trade, isBuy, pfBaseline]);

  const updatePosition = () => {
    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      const placeAbove = rect.top > 280;
      setCoords({
        top: placeAbove ? rect.top - 8 : rect.bottom + 8,
        transform: placeAbove ? 'translateY(-100%)' : 'none',
        right: Math.max(16, window.innerWidth - rect.right)
      });
    }
  };

  const handleMouseEnter = () => {
    updatePosition();
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    updatePosition();
    setIsHovered(prev => !prev);
  };

  const color = numericVal > 0 ? '#10b981' : numericVal < 0 ? '#ef4444' : '#6b7280';

  return (
    <td
      style={{
        padding: '12px 14px',
        whiteSpace: 'nowrap',
        textAlign: 'right',
        verticalAlign: 'middle',
        fontWeight: 600,
        fontSize: '13px',
        fontVariantNumeric: 'tabular-nums',
        color,
        ...cellStickyStyle
      }}
    >
      <div
        ref={cellRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '4px',
          cursor: 'help',
          padding: '2px 4px',
          borderRadius: '4px',
          backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
          transition: 'background-color 0.15s ease'
        }}
      >
        <span>{numericVal > 0 ? '+' : ''}{numericVal.toFixed(2)}%</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.9, flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      {isHovered && coords && createPortal(
        <div
          style={{
            position: 'fixed',
            top: coords.top,
            right: coords.right,
            transform: coords.transform,
            zIndex: 999999,
            width: '320px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 16px 40px -4px rgba(0, 0, 0, 0.3), 0 4px 12px -2px rgba(0, 0, 0, 0.12)',
            padding: '12px 14px',
            fontSize: '12px',
            color: 'var(--text-primary)',
            textAlign: 'left',
            pointerEvents: 'none',
            boxSizing: 'border-box',
            animation: 'foxtradeFadeZoom 0.15s ease'
          }}
        >
          {/* Header */}
          <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '8px', color: 'var(--text-primary)' }}>
            PF Impact Breakdown:
          </div>

          {/* Exit Legs */}
          {breakdown.exits.map((exit, idx) => (
            <div key={idx} style={{ marginBottom: '8px', paddingBottom: '6px', borderBottom: idx < breakdown.exits.length - 1 ? '1px dashed var(--border-color)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--text-primary)' }}>
                <span>{exit.label}</span>
                <span style={{ fontFamily: 'monospace', color: exit.impact >= 0 ? '#10b981' : '#ef4444' }}>
                  {exit.impact > 0 ? '+' : ''}{exit.impact.toFixed(2)}%
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                <div>Date: {exit.date || '-'}</div>
                <div>Price: ₹{exit.price.toFixed(2)}</div>
                <div>P/L: <span style={{ fontWeight: 600, color: exit.pnl >= 0 ? '#10b981' : '#ef4444' }}>{formatRupee(exit.pnl)}</span></div>
              </div>
            </div>
          ))}

          {/* Segments */}
          {breakdown.segments.length > 0 && (
            <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
                Segments:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                {breakdown.segments.map((seg, idx) => (
                  <div key={idx} style={{ backgroundColor: 'var(--bg-hover)', padding: '5px 7px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <span>{seg.label}</span>
                      <span style={{ color: seg.impact >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
                        PF Impact: {seg.impact > 0 ? '+' : ''}{seg.impact.toFixed(2)}%
                      </span>
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      P/L: <span style={{ fontWeight: 600, color: seg.pnl >= 0 ? '#10b981' : '#ef4444' }}>{formatRupee(seg.pnl)}</span> | PF Baseline: {formatRupee(seg.pfBaseline)} (Exit)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '10px 0 8px 0' }} />

          {/* Overall PF Impact */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)' }}>
            <span>Overall PF Impact:</span>
            <span style={{ fontFamily: 'monospace', color: numericVal >= 0 ? '#10b981' : '#ef4444' }}>
              {numericVal > 0 ? '+' : ''}{numericVal.toFixed(2)}%
            </span>
          </div>

          {/* Calculation details */}
          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
            <div>Calculation:</div>
            <div>Total P/L: <span style={{ fontWeight: 600, color: totalPnl >= 0 ? '#10b981' : '#ef4444' }}>{formatRupee(totalPnl)}</span></div>
            <div>PF Baseline: {formatRupee(pfBaseline)}</div>
            <div style={{ fontFamily: 'monospace', marginTop: '2px', color: '#374151' }}>
              = {formatRupee(totalPnl)} / {formatRupee(pfBaseline)} × 100
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, color: numericVal >= 0 ? '#10b981' : '#ef4444' }}>
              = {numericVal > 0 ? '+' : ''}{numericVal.toFixed(2)}%
            </div>
          </div>

          {/* Footnote */}
          <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '8px', lineHeight: 1.3 }}>
            * Capital-weighted | Cash Basis
          </div>
        </div>,
        document.body
      )}
    </td>
  );
}

function BaseDurationCell({ trade, val, onUpdateTrade, cellStickyStyle }) {
  const [isEditing, setIsEditing] = useState(false);
  const [localVal, setLocalVal] = useState(val ?? 0);
  const inputRef = useRef(null);

  useEffect(() => {
    setLocalVal(val ?? 0);
  }, [val]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    const parsed = parseInt(localVal) || 0;
    if (parsed !== (parseInt(val) || 0)) {
      onUpdateTrade(trade.id, 'baseDuration', parsed);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setLocalVal(val ?? 0);
      setIsEditing(false);
    }
  };

  return (
    <td
      style={{
        padding: '12px 14px',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        ...cellStickyStyle
      }}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          min="0"
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{
            width: '60px',
            height: '28px',
            padding: '2px 8px',
            borderRadius: '6px',
            border: '1px solid #3b82f6',
            boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)',
            outline: 'none',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'monospace',
            backgroundColor: '#ffffff',
            color: '#111827',
            textAlign: 'left'
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minWidth: '54px',
            height: '28px',
            padding: '2px 10px',
            borderRadius: '6px',
            backgroundColor: 'rgba(0, 0, 0, 0.03)',
            border: '1px solid transparent',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'monospace',
            color: '#111827',
            cursor: 'text',
            transition: 'all 0.12s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.06)';
            e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
            e.currentTarget.style.borderColor = 'transparent';
          }}
        >
          {val !== undefined && val !== null && val !== '' ? val : 0}
        </button>
      )}
    </td>
  );
}

function ExcursionCell({ trade, colId, val, onUpdateTrade, cellStickyStyle }) {
  const [isEditing, setIsEditing] = useState(false);
  const [localVal, setLocalVal] = useState(val !== undefined && val !== null ? String(val) : '');
  const inputRef = useRef(null);

  useEffect(() => {
    setLocalVal(val !== undefined && val !== null ? String(val) : '');
  }, [val]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (localVal === '' || localVal === '-') {
      if (onUpdateTrade) onUpdateTrade(trade.id, colId, null);
      return;
    }
    const clean = localVal.replace('%', '').trim();
    const parsed = parseFloat(clean);
    if (!isNaN(parsed) && onUpdateTrade) {
      onUpdateTrade(trade.id, colId, parsed);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setLocalVal(val !== undefined && val !== null ? String(val) : '');
      setIsEditing(false);
    }
  };

  const isMae = colId === 'mae';
  const hasValue = val !== undefined && val !== null && val !== '' && !isNaN(Number(val));
  const numVal = hasValue ? Number(val) : null;

  return (
    <td
      style={{
        padding: '12px 14px',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        textAlign: 'right',
        ...cellStickyStyle
      }}
    >
      {isEditing ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end' }}>
          <input
            ref={inputRef}
            type="number"
            step="0.1"
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="0.0"
            style={{
              width: '68px',
              height: '28px',
              padding: '2px 6px',
              borderRadius: '6px',
              border: '1px solid #3b82f6',
              boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)',
              outline: 'none',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'monospace',
              backgroundColor: '#ffffff',
              color: '#111827',
              textAlign: 'right'
            }}
          />
          <span style={{ fontSize: '11px', color: '#6b7280' }}>%</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          title={`Click to edit ${isMae ? 'MAE' : 'MFE'} (%)`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            minWidth: '50px',
            height: '28px',
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            border: '1px dashed transparent',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: 'monospace',
            color: hasValue
              ? (isMae ? '#e11d48' : '#059669')
              : '#9ca3af',
            cursor: 'text',
            transition: 'all 0.12s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
            e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }}
        >
          {hasValue ? `${numVal > 0 && !isMae ? '+' : ''}${numVal.toFixed(1)}%` : '—'}
        </button>
      )}
    </td>
  );
}

function QuickNoteCell({ trade, val, onUpdateTrade, cellStickyStyle }) {
  const [isEditing, setIsEditing] = useState(false);
  const [localVal, setLocalVal] = useState(val || '');
  const textareaRef = useRef(null);

  useEffect(() => {
    setLocalVal(val || '');
  }, [val]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      textareaRef.current.selectionEnd = textareaRef.current.value.length;
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (localVal.trim() !== (val || '').trim()) {
      onUpdateTrade(trade.id, 'quickNote', localVal);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setLocalVal(val || '');
      setIsEditing(false);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
  };

  return (
    <td
      style={{
        padding: '12px 14px',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        position: 'relative',
        ...cellStickyStyle
      }}
    >
      {isEditing ? (
        <div style={{ position: 'relative', minWidth: '220px', zIndex: 60 }}>
          <textarea
            ref={textareaRef}
            rows={3}
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Enter notes..."
            style={{
              width: '260px',
              minHeight: '64px',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #3b82f6',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12), 0 0 0 2px rgba(59, 130, 246, 0.2)',
              outline: 'none',
              fontSize: '13px',
              fontFamily: 'inherit',
              lineHeight: 1.4,
              backgroundColor: '#ffffff',
              color: '#111827',
              resize: 'none',
              display: 'block'
            }}
          />
        </div>
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          style={{
            padding: '4px 8px',
            borderRadius: '6px',
            cursor: 'text',
            maxWidth: '220px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: '13px',
            color: val ? '#111827' : '#9ca3af',
            transition: 'background-color 0.12s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {val ? (
            <span style={{ fontWeight: 400 }}>{val}</span>
          ) : (
            <span style={{ color: '#9ca3af' }}>Add notes</span>
          )}
        </div>
      )}
    </td>
  );
}

export default function JournalTable({ 
  trades = [], 
  onAddTrade, 
  onRenumberTrades,
  onReorderTrades,
  onUpdateTrade, 
  onEditTrade,
  onDeleteClick,
  onDeleteMultipleTrades,
  onImportClick,
  onOpenChart,
  onOpenDeepDive,
  pageSize,
  setPageSize,
  currentPage,
  setCurrentPage,
  visibleCols: propVisibleCols,
  setVisibleCols: propSetVisibleCols,
  columnOrder: propColumnOrder,
  setColumnOrder: propSetColumnOrder,
  settings = {},
  tradingMarket = 'india',
  themeMode = 'light',
  tradeAudits = {},
  onOpenAudit = null
}) {
  const showReorderHandles = settings?.columnReorderHandles !== false;
  const showReviewIndicators = settings?.tradeReviewIndicators === true;
  const showBulkActions = settings?.bulkTradeActions === true;
  const costBasisMethod = settings?.costBasisMethod || 'fifo';

  const [selectedTradeIds, setSelectedTradeIds] = useState(new Set());

  useEffect(() => {
    if (!showBulkActions) {
      setSelectedTradeIds(new Set());
    }
  }, [showBulkActions]);

  const [hoveredTradeId, setHoveredTradeId] = useState(null);
  const [hoverCardPosition, setHoverCardPosition] = useState(null);
  const [hoveredPencilTrade, setHoveredPencilTrade] = useState(null);
  const [pencilAnchorRect, setPencilAnchorRect] = useState(null);
  const pencilHoverTimerRef = useRef(null);
  
  const [internalVisibleCols, setInternalVisibleCols] = useState(() => {
    try {
      const cached = localStorage.getItem('tradeontip_visible_cols_v4');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const colSet = new Set(parsed);
          colSet.add('broker');
          return colSet;
        }
      }
    } catch {}
    return new Set(DEFAULT_VISIBLE_COL_IDS);
  });

  const visibleCols = propVisibleCols || internalVisibleCols;
  const setVisibleCols = propSetVisibleCols || setInternalVisibleCols;

  const [uploadModalTrade, setUploadModalTrade] = useState(null);
  const [fetchingCmpTradeIds, setFetchingCmpTradeIds] = useState(new Set());
  const [isRowsDropdownOpen, setIsRowsDropdownOpen] = useState(false);
  const rowsDropdownRef = useRef(null);
  const tableCardRef = useRef(null);
  const tableScrollRef = useRef(null);

  // Smooth scroll chaining: scroll window until table header reaches sticky top (0px), then scroll rows internally
  useEffect(() => {
    const scrollEl = tableScrollRef.current;
    const cardEl = tableCardRef.current;
    if (!scrollEl || !cardEl) return;

    const handleWheel = (e) => {
      const cardRect = cardEl.getBoundingClientRect();
      const targetTop = 0; // Sticky top offset
      if (e.deltaY > 0 && cardRect.top > targetTop + 1) {
        // Table has not yet reached the top of the viewport; scroll window down first
        window.scrollBy({ top: e.deltaY, behavior: 'instant' });
        e.preventDefault();
      } else if (e.deltaY < 0 && scrollEl.scrollTop <= 0 && cardRect.top <= targetTop + 1) {
        // Table rows are at top and user scrolls up; scroll window up to reveal stat cards
        window.scrollBy({ top: e.deltaY, behavior: 'instant' });
      }
    };

    scrollEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => scrollEl.removeEventListener('wheel', handleWheel);
  }, []);

  // Close rows dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (rowsDropdownRef.current && !rowsDropdownRef.current.contains(event.target)) {
        setIsRowsDropdownOpen(false);
      }
    }
    if (isRowsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRowsDropdownOpen]);

  // Persist visible columns
  useEffect(() => {
    localStorage.setItem('tradeontip_visible_cols_v4', JSON.stringify(Array.from(visibleCols)));
  }, [visibleCols]);

  const hasLegData = (price, qty, date, sl) => {
    const p = parseFloat(price) || 0;
    const q = parseFloat(qty) || 0;
    const s = parseFloat(sl) || 0;
    const d = (date && typeof date === 'string' && date.trim() !== '') ? date.trim() : '';
    return p > 0 || q > 0 || s > 0 || d !== '';
  };

  // Auto-detect if trades contain P2, P3, P4 or E2, E3, E4 data
  useEffect(() => {
    if (!trades || trades.length === 0) return;
    let needsUpdate = false;
    const nextCols = new Set(visibleCols);

    trades.forEach(t => {
      if (hasLegData(t.p4Price, t.p4Qty, t.p4Date, t.p4Sl)) {
        ['p2Price', 'p2Qty', 'p2Date', 'p2Sl', 'p3Price', 'p3Qty', 'p3Date', 'p3Sl', 'p4Price', 'p4Qty', 'p4Date', 'p4Sl'].forEach(col => {
          if (!nextCols.has(col)) { nextCols.add(col); needsUpdate = true; }
        });
      } else if (hasLegData(t.p3Price, t.p3Qty, t.p3Date, t.p3Sl)) {
        ['p2Price', 'p2Qty', 'p2Date', 'p2Sl', 'p3Price', 'p3Qty', 'p3Date', 'p3Sl'].forEach(col => {
          if (!nextCols.has(col)) { nextCols.add(col); needsUpdate = true; }
        });
      } else if (hasLegData(t.p2Price, t.p2Qty, t.p2Date, t.p2Sl)) {
        ['p2Price', 'p2Qty', 'p2Date', 'p2Sl'].forEach(col => {
          if (!nextCols.has(col)) { nextCols.add(col); needsUpdate = true; }
        });
      }

      if (hasLegData(t.e4Price, t.e4Qty, t.e4Date)) {
        ['e2Price', 'e2Qty', 'e2Date', 'e3Price', 'e3Qty', 'e3Date', 'e4Price', 'e4Qty', 'e4Date'].forEach(col => {
          if (!nextCols.has(col)) { nextCols.add(col); needsUpdate = true; }
        });
      } else if (hasLegData(t.e3Price, t.e3Qty, t.e3Date)) {
        ['e2Price', 'e2Qty', 'e2Date', 'e3Price', 'e3Qty', 'e3Date'].forEach(col => {
          if (!nextCols.has(col)) { nextCols.add(col); needsUpdate = true; }
        });
      } else if (hasLegData(t.e2Price, t.e2Qty, t.e2Date)) {
        ['e2Price', 'e2Qty', 'e2Date'].forEach(col => {
          if (!nextCols.has(col)) { nextCols.add(col); needsUpdate = true; }
        });
      }
    });

    if (needsUpdate) {
      setVisibleCols(nextCols);
    }
  }, [trades]);

  // Column Drag and Drop State
  const [internalColumnOrder, setInternalColumnOrder] = useState(() => {
    try {
      const cached = localStorage.getItem('tradeontip_col_order_v4');
      if (cached) {
        let parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const e4Cols = ['e4Price', 'e4Qty', 'e4Date'];
          parsed = parsed.filter(id => !e4Cols.includes(id));
          const e3DateIdx = parsed.indexOf('e3Date');
          if (e3DateIdx !== -1) {
            parsed.splice(e3DateIdx + 1, 0, ...e4Cols);
          } else {
            const e1DateIdx = parsed.indexOf('e1Date');
            if (e1DateIdx !== -1) parsed.splice(e1DateIdx + 1, 0, ...e4Cols);
            else parsed.push(...e4Cols);
          }
          // Ensure broker is positioned directly after name
          parsed = parsed.filter(id => id !== 'broker');
          const nameIdx = parsed.indexOf('name');
          if (nameIdx !== -1) {
            parsed.splice(nameIdx + 1, 0, 'broker');
          } else {
            parsed.unshift('broker');
          }
          return parsed;
        }
      }
    } catch {}
    return COLUMNS.map(c => c.id);
  });

  const columnOrder = propColumnOrder || internalColumnOrder;
  const setColumnOrder = propSetColumnOrder || setInternalColumnOrder;
  const [draggedColId, setDraggedColId] = useState(null);

  // Persist column order
  useEffect(() => {
    localStorage.setItem('tradeontip_col_order_v4', JSON.stringify(columnOrder));
  }, [columnOrder]);

  const isBuySell = settings?.columnTerminology === 'buySell';

  // Compute ordered and visible columns
  const columnsOrdered = useMemo(() => {
    return columnOrder.map(id => {
      const col = COLUMNS.find(c => c.id === id);
      if (!col) return null;
      if (isBuySell) {
        if (col.id === 'p1Price') return { ...col, label: 'B1 PRICE' };
        if (col.id === 'p1Qty') return { ...col, label: 'B1 QTY/LOT' };
        if (col.id === 'p1Date') return { ...col, label: 'B1 DATE' };
        if (col.id === 'p1Sl') return { ...col, label: 'B1 SL' };
        if (col.id === 'p2Price') return { ...col, label: 'B2 PRICE' };
        if (col.id === 'p2Qty') return { ...col, label: 'B2 QTY/LOT' };
        if (col.id === 'p2Date') return { ...col, label: 'B2 DATE' };
        if (col.id === 'p2Sl') return { ...col, label: 'B2 SL' };
        if (col.id === 'p3Price') return { ...col, label: 'B3 PRICE' };
        if (col.id === 'p3Qty') return { ...col, label: 'B3 QTY/LOT' };
        if (col.id === 'p3Date') return { ...col, label: 'B3 DATE' };
        if (col.id === 'p3Sl') return { ...col, label: 'B3 SL' };
        if (col.id === 'p4Price') return { ...col, label: 'B4 PRICE' };
        if (col.id === 'p4Qty') return { ...col, label: 'B4 QTY/LOT' };
        if (col.id === 'p4Date') return { ...col, label: 'B4 DATE' };
        if (col.id === 'p4Sl') return { ...col, label: 'B4 SL' };
        if (col.id === 'e1Price') return { ...col, label: 'S1 PRICE' };
        if (col.id === 'e1Qty') return { ...col, label: 'S1 QTY/LOT' };
        if (col.id === 'e1Date') return { ...col, label: 'S1 DATE' };
        if (col.id === 'e2Price') return { ...col, label: 'S2 PRICE' };
        if (col.id === 'e2Qty') return { ...col, label: 'S2 QTY/LOT' };
        if (col.id === 'e2Date') return { ...col, label: 'S2 DATE' };
        if (col.id === 'e3Price') return { ...col, label: 'S3 PRICE' };
        if (col.id === 'e3Qty') return { ...col, label: 'S3 QTY/LOT' };
        if (col.id === 'e3Date') return { ...col, label: 'S3 DATE' };
        if (col.id === 'e4Price') return { ...col, label: 'S4 PRICE' };
        if (col.id === 'e4Qty') return { ...col, label: 'S4 QTY/LOT' };
        if (col.id === 'e4Date') return { ...col, label: 'S4 DATE' };
      }
      return col;
    }).filter(Boolean);
  }, [columnOrder, isBuySell]);

  const visibleColsOrdered = useMemo(() => {
    return columnsOrdered.filter(col => visibleCols.has(col.id));
  }, [columnsOrdered, visibleCols]);

  const nameColIndexInVisible = visibleColsOrdered.findIndex(c => c.id === 'name');

  // Dynamic sticky props for frozen columns (Gutter: 48px, then columns up to 'name')
  const getStickyProps = (colId, isHeader = false) => {
    if (colId === 'gutter') {
      return {
        className: isHeader ? '' : 'jt-sticky-cell',
        style: {
          position: 'sticky',
          left: '0px',
          width: '48px',
          minWidth: '48px',
          maxWidth: '48px',
          zIndex: isHeader ? 70 : 50,
          backgroundColor: isHeader ? 'var(--bg-card, #ffffff)' : undefined,
          borderBottom: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 60%, transparent)'
        }
      };
    }

    const colIdx = visibleColsOrdered.findIndex(c => c.id === colId);
    if (colIdx !== -1 && nameColIndexInVisible !== -1 && colIdx <= nameColIndexInVisible) {
      let leftOffset = 48; // gutter width
      for (let i = 0; i < colIdx; i++) {
        const wStr = visibleColsOrdered[i].width || '100px';
        leftOffset += parseInt(wStr) || 100;
      }
      const colWidth = visibleColsOrdered[colIdx].width || '100px';
      const isLastSticky = colIdx === nameColIndexInVisible;
      return {
        isSticky: true,
        className: isHeader ? '' : 'jt-sticky-cell',
        style: {
          position: 'sticky',
          left: `${leftOffset}px`,
          width: colWidth,
          minWidth: colWidth,
          maxWidth: colWidth,
          zIndex: isHeader ? 60 : 40,
          backgroundColor: isHeader ? 'var(--bg-card, #ffffff)' : undefined,
          borderBottom: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 60%, transparent)',
          borderRight: isLastSticky ? '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 60%, transparent)' : 'none',
          boxShadow: isLastSticky ? '4px 0 12px -4px rgba(0, 0, 0, 0.06)' : 'none'
        }
      };
    }

    return {
      isSticky: false,
      className: '',
      style: {
        borderBottom: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 60%, transparent)'
      }
    };
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, colId) => {
    setDraggedColId(colId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetColId) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === targetColId) return;

    const dragIndex = columnOrder.indexOf(draggedColId);
    const targetIndex = columnOrder.indexOf(targetColId);

    if (dragIndex === -1 || targetIndex === -1) return;

    const newOrder = [...columnOrder];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(targetIndex, 0, draggedColId);
    setColumnOrder(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedColId(null);
  };

  // Row Drag and Drop State (Choice A: anchor on TRADE NO. cell)
  const [draggedTradeId, setDraggedTradeId] = useState(null);
  const lastDragOverSwapRef = useRef(0);

  const handleRowDragStart = (e, trade) => {
    setDraggedTradeId(trade.id);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', String(trade.id));
      // Set the entire table row as the dragged ghost image
      const tr = e.currentTarget.closest('tr');
      if (tr && e.dataTransfer.setDragImage) {
        const rect = tr.getBoundingClientRect();
        const handleRect = e.currentTarget.getBoundingClientRect();
        const offsetX = handleRect.left - rect.left + handleRect.width / 2;
        const offsetY = handleRect.top - rect.top + handleRect.height / 2;
        e.dataTransfer.setDragImage(tr, offsetX, offsetY);
      }
    } catch {}
  };

  const handleRowDragOver = (e, targetTrade) => {
    e.preventDefault();
    if (!draggedTradeId || draggedTradeId === targetTrade.id) return;

    // Real-time live reordering while dragging
    const now = Date.now();
    if (now - lastDragOverSwapRef.current < 45) return;
    lastDragOverSwapRef.current = now;

    const sourceIdx = trades.findIndex(t => t.id === draggedTradeId);
    const targetIdx = trades.findIndex(t => t.id === targetTrade.id);

    if (sourceIdx !== -1 && targetIdx !== -1 && sourceIdx !== targetIdx) {
      const nextTrades = [...trades];
      const [movedTrade] = nextTrades.splice(sourceIdx, 1);
      nextTrades.splice(targetIdx, 0, movedTrade);

      if (onReorderTrades) {
        onReorderTrades(nextTrades);
      }
    }
  };

  const handleRowDrop = (e) => {
    e.preventDefault();
    setDraggedTradeId(null);
  };

  const handleRowDragEnd = () => {
    setDraggedTradeId(null);
  };

  const hoveredTrade = useMemo(() => (trades && Array.isArray(trades)) ? trades.find(t => t.id === hoveredTradeId) : null, [trades, hoveredTradeId]);
  const hoverLeaveTimerRef = useRef(null);

  const handleMouseEnterRow = (tradeId, e) => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
    setHoveredTradeId(tradeId);
    const rect = e.currentTarget.getBoundingClientRect();
    const cardHeight = 310;
    const cardWidth = 460;
    const spaceBelow = window.innerHeight - rect.bottom;
    const showAbove = spaceBelow < cardHeight + 20 && rect.top > cardHeight;

    const top = showAbove
      ? `${Math.max(10, rect.top - cardHeight - 2)}px`
      : `${Math.min(window.innerHeight - cardHeight - 10, rect.bottom + 2)}px`;

    const left = `${Math.max(10, Math.min(rect.left - 20, window.innerWidth - cardWidth - 20))}px`;

    setHoverCardPosition({ top, left });
  };

  const handleMouseLeaveRow = () => {
    if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current);
    hoverLeaveTimerRef.current = setTimeout(() => {
      setHoveredTradeId(null);
    }, 220);
  };

  const handleCardMouseEnter = () => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
  };

  const handleCardMouseLeave = () => {
    if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current);
    hoverLeaveTimerRef.current = setTimeout(() => {
      setHoveredTradeId(null);
    }, 150);
  };

  // Helper to determine next pyramid level to add
  const nextPyramidLevel = useMemo(() => {
    if (!visibleCols.has('p2Price')) return 2;
    if (!visibleCols.has('p3Price')) return 3;
    if (!visibleCols.has('p4Price')) return 4;
    return null;
  }, [visibleCols]);

  const handleAddPyramidCols = () => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (!next.has('p2Price')) {
        ['p2Price', 'p2Qty', 'p2Date', 'p2Sl'].forEach(c => next.add(c));
      } else if (!next.has('p3Price')) {
        ['p3Price', 'p3Qty', 'p3Date', 'p3Sl'].forEach(c => next.add(c));
      } else if (!next.has('p4Price')) {
        ['p4Price', 'p4Qty', 'p4Date', 'p4Sl'].forEach(c => next.add(c));
      }
      return next;
    });
  };

  // Helper to determine next exit level to add
  const nextExitLevel = useMemo(() => {
    if (!visibleCols.has('e2Price')) return 2;
    if (!visibleCols.has('e3Price')) return 3;
    if (!visibleCols.has('e4Price')) return 4;
    return null;
  }, [visibleCols]);

  const handleAddExitCols = () => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (!next.has('e2Price')) {
        ['e2Price', 'e2Qty', 'e2Date'].forEach(c => next.add(c));
      } else if (!next.has('e3Price')) {
        ['e3Price', 'e3Qty', 'e3Date'].forEach(c => next.add(c));
      } else if (!next.has('e4Price')) {
        ['e4Price', 'e4Qty', 'e4Date'].forEach(c => next.add(c));
      }
      return next;
    });
  };

  const totalTradesCount = trades ? trades.length : 0;
  const activePageSize = pageSize || 10;
  const totalPages = Math.max(1, Math.ceil(totalTradesCount / activePageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage || 1), totalPages);

  const paginatedTrades = useMemo(() => {
    if (!trades) return [];
    const start = (safeCurrentPage - 1) * activePageSize;
    return trades.slice(start, start + activePageSize);
  }, [trades, safeCurrentPage, activePageSize]);

  const startItem = totalTradesCount === 0 ? 0 : (safeCurrentPage - 1) * activePageSize + 1;
  const endItem = Math.min(safeCurrentPage * activePageSize, totalTradesCount);

  return (
    <div 
      ref={tableCardRef}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        width: '100%', 
        backgroundColor: 'var(--bg-card, #ffffff)', 
        borderRadius: '16px', 
        border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)', 
        boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0,0,0,0.03))', 
        overflow: 'hidden', 
        position: 'sticky',
        top: '0px',
        maxHeight: 'calc(100vh - 66px)',
        zIndex: 20,
        marginBottom: '76px' 
      }}
    >
      <style>{`
        .jt-row {
          transition: background-color 0.15s ease;
        }
        .jt-row > td {
          transition: background-color 0.15s ease;
        }

        /* Profit Row: Subtle airy emerald tint for non-sticky cells, solid opaque for sticky cells */
        .jt-row-profit {
          background-color: rgba(16, 185, 129, 0.035);
        }
        .jt-row-profit > td:not(.jt-sticky-cell) {
          background-color: rgba(16, 185, 129, 0.035) !important;
        }
        .jt-row-profit:hover > td:not(.jt-sticky-cell) {
          background-color: rgba(16, 185, 129, 0.075) !important;
        }
        .jt-row-profit > td.jt-sticky-cell {
          background-color: #f4fbf7 !important;
        }
        .jt-row-profit:hover > td.jt-sticky-cell {
          background-color: #eaf8f1 !important;
        }

        /* Loss Row: Subtle airy rose tint for non-sticky cells, solid opaque for sticky cells */
        .jt-row-loss {
          background-color: rgba(239, 68, 68, 0.035);
        }
        .jt-row-loss > td:not(.jt-sticky-cell) {
          background-color: rgba(239, 68, 68, 0.035) !important;
        }
        .jt-row-loss:hover > td:not(.jt-sticky-cell) {
          background-color: rgba(239, 68, 68, 0.075) !important;
        }
        .jt-row-loss > td.jt-sticky-cell {
          background-color: #fdf6f6 !important;
        }
        .jt-row-loss:hover > td.jt-sticky-cell {
          background-color: #fbeeed !important;
        }

        /* Breakeven Row: Clean neutral */
        .jt-row-breakeven {
          background-color: #ffffff;
        }
        .jt-row-breakeven > td:not(.jt-sticky-cell) {
          background-color: #ffffff !important;
        }
        .jt-row-breakeven:hover > td:not(.jt-sticky-cell) {
          background-color: #f8fafc !important;
        }
        .jt-row-breakeven > td.jt-sticky-cell {
          background-color: #ffffff !important;
        }
        .jt-row-breakeven:hover > td.jt-sticky-cell {
          background-color: #f8fafc !important;
        }

        /* Dark Mode overrides */
        [data-theme="dark"] .jt-row-profit > td:not(.jt-sticky-cell) {
          background-color: rgba(16, 185, 129, 0.07) !important;
        }
        [data-theme="dark"] .jt-row-profit:hover > td:not(.jt-sticky-cell) {
          background-color: rgba(16, 185, 129, 0.14) !important;
        }
        [data-theme="dark"] .jt-row-profit > td.jt-sticky-cell {
          background-color: #172a24 !important;
        }
        [data-theme="dark"] .jt-row-profit:hover > td.jt-sticky-cell {
          background-color: #1c362d !important;
        }

        [data-theme="dark"] .jt-row-loss > td:not(.jt-sticky-cell) {
          background-color: rgba(239, 68, 68, 0.07) !important;
        }
        [data-theme="dark"] .jt-row-loss:hover > td:not(.jt-sticky-cell) {
          background-color: rgba(239, 68, 68, 0.14) !important;
        }
        [data-theme="dark"] .jt-row-loss > td.jt-sticky-cell {
          background-color: #2a191d !important;
        }
        [data-theme="dark"] .jt-row-loss:hover > td.jt-sticky-cell {
          background-color: #351f24 !important;
        }

        [data-theme="dark"] .jt-row-breakeven > td:not(.jt-sticky-cell) {
          background-color: #1f2937 !important;
        }
        [data-theme="dark"] .jt-row-breakeven:hover > td:not(.jt-sticky-cell) {
          background-color: #283548 !important;
        }
        [data-theme="dark"] .jt-row-breakeven > td.jt-sticky-cell {
          background-color: #1f2937 !important;
        }
        [data-theme="dark"] .jt-row-breakeven:hover > td.jt-sticky-cell {
          background-color: #283548 !important;
        }

        /* Pitch Black Mode overrides */
        [data-theme="pitch-black"] .jt-row-profit > td:not(.jt-sticky-cell) {
          background-color: rgba(16, 185, 129, 0.08) !important;
        }
        [data-theme="pitch-black"] .jt-row-profit:hover > td:not(.jt-sticky-cell) {
          background-color: rgba(16, 185, 129, 0.16) !important;
        }
        [data-theme="pitch-black"] .jt-row-profit > td.jt-sticky-cell {
          background-color: #0d1f17 !important;
        }
        [data-theme="pitch-black"] .jt-row-profit:hover > td.jt-sticky-cell {
          background-color: #122c20 !important;
        }

        [data-theme="pitch-black"] .jt-row-loss > td:not(.jt-sticky-cell) {
          background-color: rgba(239, 68, 68, 0.08) !important;
        }
        [data-theme="pitch-black"] .jt-row-loss:hover > td:not(.jt-sticky-cell) {
          background-color: rgba(239, 68, 68, 0.16) !important;
        }
        [data-theme="pitch-black"] .jt-row-loss > td.jt-sticky-cell {
          background-color: #1f0d11 !important;
        }
        [data-theme="pitch-black"] .jt-row-loss:hover > td.jt-sticky-cell {
          background-color: #2b1218 !important;
        }

        [data-theme="pitch-black"] .jt-row-breakeven > td:not(.jt-sticky-cell) {
          background-color: #0a0a0a !important;
        }
        [data-theme="pitch-black"] .jt-row-breakeven:hover > td:not(.jt-sticky-cell) {
          background-color: #171717 !important;
        }
        [data-theme="pitch-black"] .jt-row-breakeven > td.jt-sticky-cell {
          background-color: #0a0a0a !important;
        }
        [data-theme="pitch-black"] .jt-row-breakeven:hover > td.jt-sticky-cell {
          background-color: #171717 !important;
        }

        .jt-row:hover .jt-action-btns {
          opacity: 1 !important;
          transform: translateX(0px) !important;
        }
        .jt-row:hover .jt-deep-dive-btn {
          opacity: 1 !important;
        }
        .jt-table-scroll::-webkit-scrollbar {
          height: 6px;
          width: 6px;
        }
        .jt-table-scroll::-webkit-scrollbar-track {
          background: var(--bg-surface, #f8fafc);
        }
        .jt-table-scroll::-webkit-scrollbar-thumb {
          background: var(--border-hover, rgba(0, 0, 0, 0.15));
          border-radius: 4px;
        }
        .jt-date-input::-webkit-calendar-picker-indicator {
          opacity: 0.6;
          cursor: pointer;
        }
      `}</style>

      {/* Table Scrollable Container or Empty State */}
      {paginatedTrades.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 16px',
          textAlign: 'center',
          minHeight: '260px',
          width: '100%',
          backgroundColor: 'var(--bg-card, #ffffff)'
        }}>
          {/* Top Empty Icon */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-surface, #f4f4f5)',
              border: '1px solid var(--border-color, #e4e4e7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              color: 'var(--text-muted, #71717a)'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.5 9.5v6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-6"></path>
                <path d="M3.5 9.5 12 4l8.5 5.5"></path>
              </svg>
            </div>
          </div>

          {/* Heading */}
          <div style={{
            fontSize: '24px',
            fontWeight: 600,
            color: 'var(--text-primary, #09090b)',
            marginBottom: '8px',
            letterSpacing: '-0.02em'
          }}>
            No trades found
          </div>

          {/* Subtitle */}
          <div style={{
            fontSize: '15px',
            color: 'var(--text-muted, #71717a)',
            marginBottom: '24px',
            maxWidth: '420px',
            lineHeight: '1.5'
          }}>
            Add your first trade to get started with your trading journal
          </div>

          {/* Actions Button Group */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            {/* Add Your First Trade Button */}
            <button
              type="button"
              onClick={onAddTrade}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                height: '40px',
                padding: '8px 20px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-color, #e4e4e7)',
                color: 'var(--text-primary, #09090b)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f4f4f5)';
                e.currentTarget.style.borderColor = 'var(--border-hover, rgba(0, 0, 0, 0.2))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface, #ffffff)';
                e.currentTarget.style.borderColor = 'var(--border-color, #e4e4e7)';
              }}
            >
              <Plus size={16} strokeWidth={2} />
              <span>Add Your First Trade</span>
            </button>

            {/* 'or' separator */}
            <div style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-muted, #a1a1aa)'
            }}>
              or
            </div>

            {/* Import from CSV/Excel Button */}
            <button
              type="button"
              onClick={onImportClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                height: '40px',
                padding: '8px 20px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-hover, #f4f4f5)',
                border: '1px solid var(--border-color, #e4e4e7)',
                color: 'var(--text-primary, #09090b)',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface, #ffffff)';
                e.currentTarget.style.borderColor = 'var(--border-hover, rgba(0, 0, 0, 0.2))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f4f4f5)';
                e.currentTarget.style.borderColor = 'var(--border-color, #e4e4e7)';
              }}
            >
              <Upload size={16} strokeWidth={2} />
              <span>Import from CSV/Excel</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <div 
            ref={tableScrollRef}
            className="jt-table-scroll" 
            style={{ 
              overflowX: 'auto', 
              overflowY: 'auto', 
              flex: 1,
              minHeight: 0,
              position: 'relative', 
              width: '100%' 
            }}
          >
            <table style={{ width: '100%', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
          {/* Table Header */}
          <thead style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'var(--bg-card, #ffffff)', borderBottom: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 60%, transparent)', userSelect: 'none' }}>
            <tr style={{ height: '46px' }}>
              {/* Sticky Gutter (48px) with Add Trade button or Bulk Master Checkbox in Header */}
              <th
                style={{
                  width: '48px',
                  minWidth: '48px',
                  maxWidth: '48px',
                  padding: 0,
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  ...getStickyProps('gutter', true).style
                }}
              >
                {showBulkActions ? (
                  <input
                    type="checkbox"
                    title="Select all on this page"
                    checked={paginatedTrades.length > 0 && paginatedTrades.every(t => selectedTradeIds.has(t.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const next = new Set(selectedTradeIds);
                        paginatedTrades.forEach(t => next.add(t.id));
                        setSelectedTradeIds(next);
                      } else {
                        const next = new Set(selectedTradeIds);
                        paginatedTrades.forEach(t => next.delete(t.id));
                        setSelectedTradeIds(next);
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      accentColor: '#111827',
                      width: '15px',
                      height: '15px',
                      borderRadius: '4px',
                      margin: '0 auto',
                      display: 'block'
                    }}
                  />
                ) : (
                  <button
                    onClick={onAddTrade}
                    title="Add New Trade"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary, #111827)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <Plus size={14} strokeWidth={2.5} color="var(--text-primary, #111827)" />
                  </button>
                )}
              </th>

              {/* Dynamic Columns */}
              {visibleColsOrdered.map((col) => {
                const isExitAddCol = col.id === 'e1Price' || col.id === 'e2Price' || col.id === 'e3Price';
                const isPyramidAddCol = col.id === 'p1Price' || col.id === 'p2Price' || col.id === 'p3Price';
                const isEditableCol = !['tradeNo', 'avgEntry', 'openQty', 'exitedQty', 'avgExitPrice', 'stockMove', 'rewardRisk', 'holdingDays', 'status', 'realisedAmount', 'grossPnl', 'pfImpact', 'cummPf', 'positionSize', 'currentAllocation', 'peakAllocation', 'slPct', 'capitalAtRisk', 'unrealized'].includes(col.id);
                const stickyProps = getStickyProps(col.id, true);

                return (
                  <th
                    key={col.id}
                    draggable={showReorderHandles}
                    onDragStart={showReorderHandles ? (e) => handleDragStart(e, col.id) : undefined}
                    onDragOver={showReorderHandles ? (e) => handleDragOver(e, col.id) : undefined}
                    onDrop={showReorderHandles ? (e) => handleDrop(e, col.id) : undefined}
                    onDragEnd={showReorderHandles ? handleDragEnd : undefined}
                    style={{
                      width: col.width || '110px',
                      minWidth: col.width || '110px',
                      padding: '12px 14px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: 'var(--text-muted, rgba(0, 0, 0, 0.55))',
                      letterSpacing: '0.05em',
                      cursor: showReorderHandles ? 'grab' : 'default',
                      textAlign: col.align === 'right' ? 'right' : 'left',
                      verticalAlign: 'middle',
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      ...stickyProps.style
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: col.align === 'right' ? 'flex-end' : 'flex-start', gap: 0 }}>
                      <span style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {showReorderHandles && (
                          <button
                            type="button"
                            title="Drag to reorder column"
                            style={{ border: 'none', background: 'none', color: 'var(--text-muted, rgba(128,128,128,0.4))', cursor: 'grab', padding: '2px', display: 'flex', alignItems: 'center', marginLeft: '-4px' }}
                          >
                            <GripVertical size={12} />
                          </button>
                        )}
                        <span>{col.label}</span>
                        {isEditableCol && (
                          <Pencil size={10} style={{ color: 'var(--text-muted, #111827)', opacity: 0.4, flexShrink: 0, marginLeft: '2px' }} />
                        )}
                        {isPyramidAddCol && nextPyramidLevel && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAddPyramidCols(); }}
                            title={`Add P${nextPyramidLevel} columns`}
                            style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#9333ea', color: '#ffffff', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                          >
                            <Plus size={10} strokeWidth={3} />
                          </button>
                        )}
                        {isExitAddCol && nextExitLevel && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAddExitCols(); }}
                            title={`Add E${nextExitLevel} columns`}
                            style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#10b981', color: '#ffffff', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                          >
                            <Plus size={10} strokeWidth={3} />
                          </button>
                        )}
                      </span>
                      {col.unit && (
                        <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-muted, rgba(0, 0, 0, 0.45))', letterSpacing: '0.02em', marginTop: '-1px' }}>
                          {col.unit}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {paginatedTrades.map((trade, index) => {
              const grossPnl = parseGrossPnl(trade);
              const isProfit = grossPnl > 0.0001;
              const isLoss = grossPnl < -0.0001;

              let rowToneClass = 'jt-row-breakeven';
              let rowBgColor = '#ffffff';

              if (isProfit) {
                rowToneClass = 'jt-row-profit';
                rowBgColor = (themeMode === 'dark' || themeMode === 'pitch-black') ? 'rgba(16, 185, 129, 0.07)' : '#f6fdfa';
              } else if (isLoss) {
                rowToneClass = 'jt-row-loss';
                rowBgColor = (themeMode === 'dark' || themeMode === 'pitch-black') ? 'rgba(239, 68, 68, 0.07)' : '#fdf8f8';
              }

              return (
                <tr
                  key={trade.id ? `${trade.id}_${index}` : `row_${index}`}
                  className={`jt-row ${rowToneClass}`}
                  onDragOver={(e) => handleRowDragOver(e, trade)}
                  onDrop={handleRowDrop}
                  style={{
                    backgroundColor: draggedTradeId === trade.id
                      ? ((themeMode === 'dark' || themeMode === 'pitch-black') ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)')
                      : rowBgColor,
                    position: 'relative',
                    opacity: draggedTradeId === trade.id ? 0.6 : 1,
                    boxShadow: draggedTradeId === trade.id ? '0 4px 16px rgba(0, 0, 0, 0.14)' : undefined,
                    transition: 'opacity 0.12s ease, background-color 0.12s ease'
                  }}
                >
                  {/* Action Gutter (Pencil & Trash buttons or Row Selection Checkbox) */}
                  <td
                    className={getStickyProps('gutter', false).className}
                    style={{
                      width: '48px',
                      minWidth: '48px',
                      maxWidth: '48px',
                      padding: 0,
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      ...getStickyProps('gutter', false).style
                    }}
                  >
                    {showBulkActions ? (
                      <input
                        type="checkbox"
                        checked={selectedTradeIds.has(trade.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelectedTradeIds(prev => {
                            const next = new Set(prev);
                            if (next.has(trade.id)) next.delete(trade.id);
                            else next.add(trade.id);
                            return next;
                          });
                        }}
                        style={{
                          cursor: 'pointer',
                          accentColor: '#111827',
                          width: '15px',
                          height: '15px',
                          borderRadius: '4px',
                          margin: '0 auto',
                          display: 'block'
                        }}
                      />
                    ) : (
                      <div
                        className="jt-action-btns"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '48px',
                          opacity: 0,
                          transform: 'translateX(-4px)',
                          transition: 'all 0.18s ease'
                        }}
                      >
                        <button
                          onClick={() => {
                            if (pencilHoverTimerRef.current) clearTimeout(pencilHoverTimerRef.current);
                            setHoveredPencilTrade(null);
                            onEditTrade(trade);
                          }}
                          aria-label="Edit Trade"
                          style={{ border: 'none', background: 'none', padding: '3px', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            if (pencilHoverTimerRef.current) clearTimeout(pencilHoverTimerRef.current);
                            pencilHoverTimerRef.current = setTimeout(() => {
                              setPencilAnchorRect(rect);
                              setHoveredPencilTrade(trade);
                            }, 100);
                            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                          }}
                          onMouseLeave={(e) => {
                            if (pencilHoverTimerRef.current) clearTimeout(pencilHoverTimerRef.current);
                            pencilHoverTimerRef.current = setTimeout(() => {
                              setHoveredPencilTrade(null);
                            }, 180);
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Pencil size={12} color="var(--text-primary)" />
                        </button>
                        <button
                          onClick={() => onDeleteClick(trade)}
                          title="Delete Trade"
                          style={{ border: 'none', background: 'none', padding: '3px', borderRadius: '4px', color: 'var(--color-red, #ef4444)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '1px' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-red-bg, rgba(239, 68, 68, 0.12))'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </td>

                  {/* Render Dynamic Columns */}
                  {visibleColsOrdered.map((col) => {
                    const stickyProps = getStickyProps(col.id, false);
                    const cellStickyStyle = stickyProps.style;
                    const cellStickyClass = stickyProps.className;
                    const val = trade[col.id];

                    // 1. TRADE NO. (with Drag Handle, Review Indicators and Upload Chart button)
                    if (col.id === 'tradeNo') {
                      const hasCharts = Boolean(trade.chartBefore || trade.chartAfter);
                      const isRowDragging = draggedTradeId === trade.id;
                      return (
                        <td
                          key={col.id}
                          className={cellStickyClass}
                          style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', ...cellStickyStyle }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              draggable={true}
                              onDragStart={(e) => handleRowDragStart(e, trade)}
                              onDragEnd={handleRowDragEnd}
                              title="Drag to reorder trade"
                              className="jt-drag-handle"
                              style={{
                                cursor: isRowDragging ? 'grabbing' : 'grab',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '2px',
                                borderRadius: '4px',
                                color: isRowDragging
                                  ? ((themeMode === 'dark' || themeMode === 'pitch-black') ? '#ffffff' : '#000000')
                                  : ((themeMode === 'dark' || themeMode === 'pitch-black') ? '#9ca3af' : '#6b7280'),
                                backgroundColor: isRowDragging
                                  ? ((themeMode === 'dark' || themeMode === 'pitch-black') ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.14)')
                                  : 'transparent',
                                transition: 'color 0.12s ease, background-color 0.12s ease',
                                userSelect: 'none'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = (themeMode === 'dark' || themeMode === 'pitch-black') ? '#ffffff' : '#000000';
                                e.currentTarget.style.backgroundColor = (themeMode === 'dark' || themeMode === 'pitch-black') ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)';
                              }}
                              onMouseLeave={(e) => {
                                if (draggedTradeId !== trade.id) {
                                  e.currentTarget.style.color = (themeMode === 'dark' || themeMode === 'pitch-black') ? '#9ca3af' : '#6b7280';
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                              onMouseDown={(e) => {
                                e.currentTarget.style.color = (themeMode === 'dark' || themeMode === 'pitch-black') ? '#ffffff' : '#000000';
                                e.currentTarget.style.backgroundColor = (themeMode === 'dark' || themeMode === 'pitch-black') ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)';
                              }}
                            >
                              <GripVertical size={13} />
                            </span>
                            <span style={{ fontWeight: 600, fontSize: '13px', color: (themeMode === 'dark' || themeMode === 'pitch-black') ? '#f3f4f6' : '#111827', fontVariantNumeric: 'tabular-nums' }}>
                              {trade.tradeNo || ((safeCurrentPage - 1) * activePageSize + index + 1)}
                            </span>
                            {showReviewIndicators && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '1px' }}>
                                {/* Chart indicator */}
                                <span
                                  title={hasCharts ? "Chart reviewed & uploaded" : "No chart uploaded"}
                                  style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: hasCharts ? '#10b981' : '#d1d5db',
                                    display: 'inline-block'
                                  }}
                                />
                                {/* Notes indicator */}
                                <span
                                  title={(trade.quickNote || trade.notes || trade.note) ? "Trade notes recorded" : "No notes recorded"}
                                  style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: (trade.quickNote || trade.notes || trade.note) ? '#3b82f6' : '#d1d5db',
                                    display: 'inline-block'
                                  }}
                                />
                                {/* Plan followed indicator */}
                                {trade.planFollowed && (
                                  <span
                                    title={`Plan followed: ${trade.planFollowed}`}
                                    style={{
                                      width: '6px',
                                      height: '6px',
                                      borderRadius: '50%',
                                      backgroundColor: trade.planFollowed === 'Yes' ? '#10b981' : '#ef4444',
                                      display: 'inline-block'
                                    }}
                                  />
                                )}
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setUploadModalTrade(trade);
                              }}
                              title={hasCharts ? "View / Upload Charts" : "Upload Charts"}
                              aria-label="Upload chart image"
                              style={{
                                width: '22px',
                                height: '22px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                color: (themeMode === 'dark' || themeMode === 'pitch-black') ? '#f3f4f6' : '#111827',
                                borderRadius: '6px',
                                padding: 0,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.15s ease, transform 0.1s ease, color 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = (themeMode === 'dark' || themeMode === 'pitch-black') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                              onMouseDown={(e) => {
                                e.currentTarget.style.backgroundColor = (themeMode === 'dark' || themeMode === 'pitch-black') ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)';
                                e.currentTarget.style.transform = 'scale(0.95)';
                              }}
                              onMouseUp={(e) => {
                                e.currentTarget.style.backgroundColor = (themeMode === 'dark' || themeMode === 'pitch-black') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)';
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                            >
                              <ImageIcon size={14} color={(themeMode === 'dark' || themeMode === 'pitch-black') ? '#f3f4f6' : '#111827'} />
                            </button>
                          </div>
                        </td>
                      );
                    }

                    // 2. DATE (Clean HTML5 Date input)
                    if (col.id === 'date') {
                      const inputDateVal = toInputDateFormat(trade.date);
                      return (
                        <td key={col.id} className={cellStickyClass} style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', ...cellStickyStyle }}>
                          <input
                            type="date"
                            className="jt-date-input"
                            value={inputDateVal}
                            onChange={(e) => {
                              const newDate = e.target.value; // YYYY-MM-DD
                              onUpdateTrade(trade.id, 'date', newDate);
                            }}
                            style={{
                              width: '135px',
                              height: '28px',
                              padding: '0 6px',
                              borderRadius: '6px',
                              backgroundColor: 'transparent',
                              border: '1px solid transparent',
                              fontSize: '13px',
                              fontWeight: 500,
                              color: 'var(--text-primary, #111827)',
                              cursor: 'pointer',
                              outline: 'none',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            onFocus={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)'; }}
                            onBlur={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                          />
                        </td>
                      );
                    }

                    // 3. NAME (Stock Logo + Inline StockAutocomplete + Hover Deep Dive button)
                    if (col.id === 'name') {
                      return (
                        <td
                          key={col.id}
                          className={cellStickyClass}
                          style={{ padding: '10px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', ...cellStickyStyle }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <SymbolLogo symbol={trade.name} size={20} />
                            <div style={{ flex: 1, minWidth: '85px', maxWidth: '130px' }}>
                              <StockAutocomplete
                                value={trade.name || ''}
                                placeholder="Stock name"
                                market={tradingMarket}
                                onChange={async (newSymbol) => {
                                  if (newSymbol !== trade.name) {
                                    onUpdateTrade(trade.id, 'name', newSymbol);
                                    if (newSymbol) {
                                      const cachedPrice = getCachedCMP(newSymbol);
                                      if (cachedPrice > 0) {
                                        onUpdateTrade(trade.id, 'cmp', cachedPrice);
                                      } else {
                                        setFetchingCmpTradeIds(prev => new Set(prev).add(trade.id));
                                        try {
                                          const p = await fetchLiveCMPForSymbol(newSymbol);
                                          if (p > 0) {
                                            onUpdateTrade(trade.id, 'cmp', p);
                                          }
                                        } catch (_) {
                                        } finally {
                                          setFetchingCmpTradeIds(prev => {
                                            const next = new Set(prev);
                                            next.delete(trade.id);
                                            return next;
                                          });
                                        }
                                      }
                                    }
                                  }
                                }}
                              />
                            </div>
                            {trade.name && (
                              <button
                                className="jt-deep-dive-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onOpenDeepDive) onOpenDeepDive(trade.name, trade.tradeNo, trade.id);
                                  else if (onOpenChart) onOpenChart(trade.name);
                                }}
                                title={`Deep dive for ${trade.name}`}
                                style={{
                                  opacity: 0,
                                  border: 'none',
                                  backgroundColor: 'transparent',
                                  padding: '2px',
                                  borderRadius: '4px',
                                  color: '#9ca3af',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'opacity 0.15s ease',
                                  marginLeft: 'auto'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = '#2563eb'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
                              >
                                <ArrowUpRight size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    }

                    // BROKER (BrokerDropdown with logo/initials & scrollable selection)
                    if (col.id === 'broker') {
                      return (
                        <td key={col.id} style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', ...cellStickyStyle }}>
                          <BrokerDropdown
                            value={trade.broker || 'not_defined'}
                            width="125px"
                            onChange={(val) => onUpdateTrade(trade.id, 'broker', val)}
                          />
                        </td>
                      );
                    }

                    // 4. SETUP (SetupDropdown with drag-reorder & custom add)
                    if (col.id === 'setup') {
                      return (
                        <td key={col.id} style={{ padding: '10px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', ...cellStickyStyle }}>
                          <SetupDropdown
                            value={trade.setup || ''}
                            placeholder="Select setup"
                            width="155px"
                            onChange={(val) => onUpdateTrade(trade.id, 'setup', val)}
                          />
                        </td>
                      );
                    }

                    // 5. BUY/SELL Pill
                    if (col.id === 'type') {
                      const isBuy = (trade.type || 'Buy').toLowerCase() === 'buy';
                      return (
                        <td key={col.id} style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', ...cellStickyStyle }}>
                          <button
                            type="button"
                            onClick={() => onUpdateTrade(trade.id, 'type', isBuy ? 'Sell' : 'Buy')}
                            style={{
                              height: '28px',
                              width: '85px',
                              padding: '0 8px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '12px',
                              fontWeight: 500,
                              border: isBuy ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(244, 63, 94, 0.25)',
                              backgroundColor: isBuy ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
                              color: 'var(--text-primary, #111827)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <span>{trade.type || 'Buy'}</span>
                            <ChevronDown size={12} style={{ opacity: 0.5, color: 'var(--text-primary, #111827)' }} />
                          </button>
                        </td>
                      );
                    }

                    // 6. ENTRY TYPE (EntryTypeDropdown with drag-reorder & custom add)
                    if (col.id === 'entryType') {
                      return (
                        <td key={col.id} style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', ...cellStickyStyle }}>
                          <EntryTypeDropdown
                            value={trade.entryType || ''}
                            placeholder="Select entry type"
                            width="130px"
                            onChange={(val) => onUpdateTrade(trade.id, 'entryType', val)}
                          />
                        </td>
                      );
                    }

                    // 7. Numeric Financial Editable Inputs (entry, sl, cmp, p1Price, p1Sl, p2Price, p2Sl, p3Price, p3Sl, p4Price, p4Sl, tsl, e1Price, e2Price, e3Price, e4Price)
                    if (['entry', 'sl', 'cmp', 'p1Price', 'p1Sl', 'p2Price', 'p2Sl', 'p3Price', 'p3Sl', 'p4Price', 'p4Sl', 'tsl', 'e1Price', 'e2Price', 'e3Price', 'e4Price'].includes(col.id)) {
                      return (
                        <td key={col.id} style={{ padding: '12px 14px', whiteSpace: 'nowrap', textAlign: 'right', verticalAlign: 'middle', ...cellStickyStyle }}>
                          <EditableCell
                            value={trade[col.id]}
                            placeholder="0.00"
                            isCurrency={true}
                            align="right"
                            isCmp={col.id === 'cmp'}
                            isFetching={col.id === 'cmp' && fetchingCmpTradeIds.has(trade.id)}
                            onChange={(newVal) => onUpdateTrade(trade.id, col.id, newVal)}
                          />
                        </td>
                      );
                    }

                    // 8. Quantity Editable Inputs (qty, p1Qty, p2Qty, p3Qty, p4Qty, e1Qty, e2Qty, e3Qty, e4Qty)
                    if (['qty', 'p1Qty', 'p2Qty', 'p3Qty', 'p4Qty', 'e1Qty', 'e2Qty', 'e3Qty', 'e4Qty'].includes(col.id)) {
                      return (
                        <td key={col.id} style={{ padding: '12px 14px', whiteSpace: 'nowrap', textAlign: 'right', verticalAlign: 'middle', ...cellStickyStyle }}>
                          <EditableCell
                            value={trade[col.id]}
                            placeholder="0"
                            isInteger={true}
                            align="right"
                            onChange={(newVal) => onUpdateTrade(trade.id, col.id, newVal)}
                          />
                        </td>
                      );
                    }

                    // 9. Leg Date Inputs (p1Date, p2Date, p3Date, p4Date, e1Date, e2Date, e3Date, e4Date)
                    if (['p1Date', 'p2Date', 'p3Date', 'p4Date', 'e1Date', 'e2Date', 'e3Date', 'e4Date'].includes(col.id)) {
                      const legInputDate = toInputDateFormat(trade[col.id]);
                      return (
                        <td key={col.id} style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', ...cellStickyStyle }}>
                          <input
                            type="date"
                            className="jt-date-input"
                            value={legInputDate}
                            onChange={(e) => onUpdateTrade(trade.id, col.id, e.target.value)}
                            style={{
                              height: '28px',
                              padding: '0 6px',
                              borderRadius: '6px',
                              backgroundColor: 'transparent',
                              border: '1px solid transparent',
                              fontSize: '13px',
                              fontWeight: 500,
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              outline: 'none',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            onFocus={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            onBlur={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                          />
                        </td>
                      );
                    }

                    // 10. Plan Followed Dropdown
                    if (col.id === 'planFollowed') {
                      const planOptions = [
                        { value: '', label: '-' },
                        { value: 'Yes', label: 'Yes' },
                        { value: 'No', label: 'No' },
                        { value: 'Partial', label: 'Partial' }
                      ];
                      return (
                        <td key={col.id} style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', ...cellStickyStyle }}>
                          <ModernDropdown
                            value={trade.planFollowed || ''}
                            placeholder="-"
                            options={planOptions}
                            variant="table"
                            width="95px"
                            onChange={(val) => onUpdateTrade(trade.id, 'planFollowed', val)}
                          />
                        </td>
                      );
                    }

                    // 11. Exit Trigger Dropdown
                    if (col.id === 'exitTrigger') {
                      return (
                        <td key={col.id} style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', ...cellStickyStyle }}>
                          <ExitTriggerDropdown
                            value={trade.exitTrigger || ''}
                            placeholder="Select Exit Triggers"
                            width="140px"
                            onChange={(val) => onUpdateTrade(trade.id, 'exitTrigger', val)}
                          />
                        </td>
                      );
                    }

                    // 12. Growth Areas Dropdown (multi-select)
                    if (col.id === 'growthAreas') {
                      return (
                        <td key={col.id} style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', ...cellStickyStyle }}>
                          <GrowthAreaDropdown
                            value={trade.growthAreas || ''}
                            placeholder="Select Growth Areas"
                            width="160px"
                            onChange={(val) => onUpdateTrade(trade.id, 'growthAreas', val)}
                          />
                        </td>
                      );
                    }

                    // TSL Groups
                    if (col.id === 'tslGroups') {
                      const groups = Array.isArray(trade.tslGroups) ? trade.tslGroups : [];
                      return (
                        <td
                          key={col.id}
                          style={{ padding: '12px 14px', whiteSpace: 'nowrap', textAlign: 'center', verticalAlign: 'middle', ...cellStickyStyle }}
                        >
                          {groups.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => onEditTrade && onEditTrade(trade)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                border: '1px solid rgba(234, 88, 12, 0.3)',
                                backgroundColor: '#fff7ed',
                                color: '#c2410c',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              <span>{groups.length} {groups.length === 1 ? 'Group' : 'Groups'}</span>
                            </button>
                          ) : (
                            <span
                              style={{ color: '#9ca3af', fontSize: '13px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}
                              onClick={() => onEditTrade && onEditTrade(trade)}
                              title="Click to configure Staggered TSL Grouping"
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              -
                            </span>
                          )}
                        </td>
                      );
                    }

                    // Position Status
                    if (col.id === 'status') {
                      const isClosed = val === 'Closed';
                      return (
                        <td key={col.id} style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', ...cellStickyStyle }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: isClosed ? '#ecfdf5' : '#eff6ff',
                            color: isClosed ? '#059669' : '#2563eb'
                          }}>
                            {val || 'Open'}
                          </span>
                        </td>
                      );
                    }

                    // Realized P/L, Gross P/L, Unrealized
                    if (col.id === 'pnl' || col.id === 'grossPnl' || col.id === 'unrealized') {
                      const numericVal = parseFloat(val) || 0;
                      return (
                        <td
                          key={col.id}
                          style={{
                            padding: '12px 14px',
                            whiteSpace: 'nowrap',
                            textAlign: 'right',
                            verticalAlign: 'middle',
                            fontWeight: 600,
                            fontSize: '13px',
                            fontVariantNumeric: 'tabular-nums',
                            color: numericVal > 0 ? '#10b981' : numericVal < 0 ? '#ef4444' : '#6b7280',
                            ...cellStickyStyle
                          }}
                        >
                          {numericVal > 0 ? `+${formatRupee(numericVal)}` : numericVal < 0 ? `-${formatRupee(Math.abs(numericVal))}` : '₹0.00'}
                        </td>
                      );
                    }

                    // Peak Allocation with Hover Breakdown Tooltip
                    if (col.id === 'peakAllocation') {
                      return (
                        <PeakAllocationCell
                          key={col.id}
                          trade={trade}
                          val={val}
                          cellStickyStyle={cellStickyStyle}
                        />
                      );
                    }

                    // Stock Move with Breakdown Tooltip
                    if (col.id === 'stockMove') {
                      return (
                        <StockMoveCell
                          key={col.id}
                          trade={trade}
                          val={val}
                          cellStickyStyle={cellStickyStyle}
                        />
                      );
                    }

                    // PF Impact with Breakdown Tooltip
                    if (col.id === 'pfImpact') {
                      return (
                        <PfImpactCell
                          key={col.id}
                          trade={trade}
                          val={val}
                          cellStickyStyle={cellStickyStyle}
                        />
                      );
                    }

                    // Capital At Risk (%)
                    if (col.id === 'capitalAtRisk') {
                      const numericVal = parseFloat(val) || 0;
                      return (
                        <td
                          key={col.id}
                          style={{
                            padding: '12px 14px',
                            whiteSpace: 'nowrap',
                            textAlign: 'right',
                            verticalAlign: 'middle',
                            ...cellStickyStyle
                          }}
                        >
                          <div style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: '13px', fontWeight: 500, color: '#111827' }}>
                            {numericVal.toFixed(2)}%
                          </div>
                        </td>
                      );
                    }

                    // Cumm PF / Allocations / slPct
                    if (['slPct', 'currentAllocation', 'cummPf'].includes(col.id)) {
                      if (col.id === 'slPct') {
                        const isSlValid = val !== null && val !== undefined && val !== '' && !isNaN(parseFloat(val));
                        return (
                          <td
                            key={col.id}
                            style={{
                              padding: '12px 14px',
                              whiteSpace: 'nowrap',
                              textAlign: 'right',
                              verticalAlign: 'middle',
                              fontWeight: 600,
                              fontSize: '13px',
                              fontVariantNumeric: 'tabular-nums',
                              color: '#111827',
                              ...cellStickyStyle
                            }}
                          >
                            {isSlValid ? `${Number(val).toFixed(2)}%` : '—'}
                          </td>
                        );
                      }

                      const numericVal = parseFloat(val) || 0;
                      const isPnlField = col.id === 'cummPf';
                      const color = isPnlField
                        ? (numericVal > 0 ? '#10b981' : numericVal < 0 ? '#ef4444' : '#6b7280')
                        : '#111827';
                      return (
                        <td
                          key={col.id}
                          style={{
                            padding: '12px 14px',
                            whiteSpace: 'nowrap',
                            textAlign: 'right',
                            verticalAlign: 'middle',
                            fontWeight: 600,
                            fontSize: '13px',
                            fontVariantNumeric: 'tabular-nums',
                            color,
                            ...cellStickyStyle
                          }}
                        >
                          {numericVal > 0 && isPnlField ? '+' : ''}
                          {numericVal.toFixed(2)}%
                        </td>
                      );
                    }

                    // Reward:Risk with Breakdown Tooltip
                    if (col.id === 'rewardRisk') {
                      return (
                        <RewardRiskCell
                          key={col.id}
                          trade={trade}
                          val={val}
                          cellStickyStyle={cellStickyStyle}
                        />
                      );
                    }

                    // Holding Days with FIFO Breakdown Tooltip
                    if (col.id === 'holdingDays') {
                      return (
                        <HoldingDaysCell
                          key={col.id}
                          trade={trade}
                          val={val}
                          cellStickyStyle={cellStickyStyle}
                          costBasisMethod={costBasisMethod}
                        />
                      );
                    }

                    // ReadOnly Rupee Fields (avgEntry, positionSize, avgExitPrice, realisedAmount)
                    if (['avgEntry', 'positionSize', 'avgExitPrice', 'realisedAmount'].includes(col.id)) {
                      const numericVal = parseFloat(val) || 0;
                      return (
                        <td key={col.id} style={{ padding: '12px 14px', whiteSpace: 'nowrap', textAlign: 'right', verticalAlign: 'middle', fontSize: '13px', fontWeight: 450, color: 'var(--text-primary, #111827)', fontVariantNumeric: 'tabular-nums', ...cellStickyStyle }}>
                          {numericVal > 0 ? formatRupee(numericVal) : '-'}
                        </td>
                      );
                    }

                    // Open / Exited Qty
                    if (['openQty', 'exitedQty'].includes(col.id)) {
                      const numericVal = parseFloat(val) || 0;
                      return (
                        <td key={col.id} style={{ padding: '12px 14px', whiteSpace: 'nowrap', textAlign: 'right', verticalAlign: 'middle', fontSize: '13px', fontWeight: 450, color: 'var(--text-muted, #4b5563)', fontVariantNumeric: 'tabular-nums', ...cellStickyStyle }}>
                          {numericVal > 0 ? numericVal : '0'}
                        </td>
                      );
                    }

                    // Base Duration
                    if (col.id === 'baseDuration') {
                      return (
                        <BaseDurationCell
                          key={col.id}
                          trade={trade}
                          val={val}
                          onUpdateTrade={onUpdateTrade}
                          cellStickyStyle={cellStickyStyle}
                        />
                      );
                    }

                    // Quick Note
                    if (col.id === 'quickNote') {
                      return (
                        <QuickNoteCell
                          key={col.id}
                          trade={trade}
                          val={val}
                          onUpdateTrade={onUpdateTrade}
                          cellStickyStyle={cellStickyStyle}
                        />
                      );
                    }

                    // MAE & MFE Excursion Cells (Inline Editable)
                    if (col.id === 'mae' || col.id === 'mfe') {
                      return (
                        <ExcursionCell
                          key={col.id}
                          trade={trade}
                          colId={col.id}
                          val={val}
                          onUpdateTrade={onUpdateTrade}
                          cellStickyStyle={cellStickyStyle}
                        />
                      );
                    }

                    // Fallback
                    return (
                      <td key={col.id} style={{ padding: '12px 14px', whiteSpace: 'nowrap', verticalAlign: 'middle', fontSize: '13px', color: '#6b7280', ...cellStickyStyle }}>
                        {val || '-'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

          </tbody>
        </table>
      </div>

      {/* Table Footer Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 60%, transparent)',
        backgroundColor: 'var(--bg-card, #ffffff)',
        padding: '10px 20px',
        userSelect: 'none',
        flexWrap: 'wrap',
        gap: '12px',
        flexShrink: 0
      }}>
        {/* Left: Add Trade button + Auto-number button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onAddTrade}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '32px',
              padding: '0 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary, #111827)',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(0,0,0,0.06))'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Plus size={14} strokeWidth={2.5} color="currentColor" />
            <span>Add Trade</span>
          </button>
        </div>

        {/* Center: Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            disabled={safeCurrentPage <= 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            style={{
              width: '28px',
              height: '28px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: safeCurrentPage <= 1 ? 'var(--text-muted, #9ca3af)' : 'var(--text-secondary, #4b5563)',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: safeCurrentPage <= 1 ? 'default' : 'pointer',
              opacity: safeCurrentPage <= 1 ? 0.35 : 1,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { if (safeCurrentPage > 1) e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(0,0,0,0.05))'; }}
            onMouseLeave={(e) => { if (safeCurrentPage > 1) e.currentTarget.style.backgroundColor = 'transparent'; }}
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
            const isCurrent = safeCurrentPage === p;
            return (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                style={{
                  width: '28px',
                  height: '28px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: isCurrent ? '1px solid var(--text-primary, #111827)' : 'none',
                  backgroundColor: isCurrent ? 'var(--text-primary, #111827)' : 'transparent',
                  color: isCurrent ? 'var(--bg-primary, #ffffff)' : 'var(--text-secondary, #4b5563)',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease'
                }}
                onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(0,0,0,0.05))'; }}
                onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {p}
              </button>
            );
          })}

          <button
            disabled={safeCurrentPage >= totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            style={{
              width: '28px',
              height: '28px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: safeCurrentPage >= totalPages ? 'var(--text-muted, #9ca3af)' : 'var(--text-secondary, #4b5563)',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: safeCurrentPage >= totalPages ? 'default' : 'pointer',
              opacity: safeCurrentPage >= totalPages ? 0.35 : 1,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { if (safeCurrentPage < totalPages) e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(0,0,0,0.05))'; }}
            onMouseLeave={(e) => { if (safeCurrentPage < totalPages) e.currentTarget.style.backgroundColor = 'transparent'; }}
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Right: Page Rows selector & info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div ref={rowsDropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ROWS</span>
            <button
              type="button"
              onClick={() => setIsRowsDropdownOpen(!isRowsDropdownOpen)}
              style={{
                height: '28px',
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 75%, transparent)',
                backgroundColor: 'var(--bg-surface, #ffffff)',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-primary, #111827)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.03))',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface, #ffffff)'; }}
            >
              <span>{activePageSize}</span>
              <ChevronDown size={12} style={{ opacity: 0.6, transition: 'transform 0.15s ease', transform: isRowsDropdownOpen ? 'rotate(180deg)' : 'none' }} />
            </button>

            {/* Floating Popover Menu for Page Size (floats upward) */}
            {isRowsDropdownOpen && (
              <div style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                right: 0,
                zIndex: 60,
                backgroundColor: 'var(--bg-surface, #ffffff)',
                borderRadius: '10px',
                padding: '4px',
                minWidth: '85px',
                border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 85%, transparent)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1px'
              }}>
                {[10, 12, 25, 50, 100].map(size => {
                  const isSelected = activePageSize === size;
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
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? 'var(--text-primary, #111827)' : 'var(--text-secondary, #4b5563)',
                        backgroundColor: isSelected ? 'var(--bg-hover, rgba(0, 0, 0, 0.05))' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(0,0,0,0.03))'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <span>{size}</span>
                      {isSelected && <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--text-primary, #111827)' }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ height: '16px', width: '1px', backgroundColor: 'color-mix(in srgb, var(--border-color, #e5e7eb) 80%, transparent)' }} />

          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-subtle, #6b7280)', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
            <span style={{ color: 'var(--text-primary, #111827)', fontWeight: 600 }}>{startItem}-{endItem}</span> of <span style={{ color: 'var(--text-primary, #111827)', fontWeight: 600 }}>{totalTradesCount}</span>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Top-Level High-Z-Index Trade Hover Card */}
      {hoveredTrade && hoverCardPosition && (
        <TradeHoverCard
          trade={hoveredTrade}
          position={hoverCardPosition}
          onOpenChart={onOpenChart}
          onOpenDeepDive={onOpenDeepDive}
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
        />
      )}

      {/* Trade Summary Popover when hovering on Pen/Edit Trade icon */}
      <TradeSummaryPopover
        trade={hoveredPencilTrade}
        anchorRect={pencilAnchorRect}
        visible={Boolean(hoveredPencilTrade && pencilAnchorRect)}
        onMouseEnter={() => {
          if (pencilHoverTimerRef.current) clearTimeout(pencilHoverTimerRef.current);
        }}
        onMouseLeave={() => {
          setHoveredPencilTrade(null);
        }}
      />

      {/* Upload Chart Images Modal */}
      {uploadModalTrade && (
        <UploadChartModal
          isOpen={Boolean(uploadModalTrade)}
          trade={uploadModalTrade}
          onClose={() => setUploadModalTrade(null)}
          onSave={(tradeId, updates) => {
            if (onUpdateTrade) {
              if (updates.chartBefore !== undefined) onUpdateTrade(tradeId, 'chartBefore', updates.chartBefore);
              if (updates.chartAfter !== undefined) onUpdateTrade(tradeId, 'chartAfter', updates.chartAfter);
            }
          }}
          themeMode={themeMode}
        />
      )}

      {/* Floating Aesthetic Black & White Batch Actions Bar */}
      {showBulkActions && selectedTradeIds.size > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '72px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            backgroundColor: '#111827',
            color: '#ffffff',
            borderRadius: '9999px',
            padding: '8px 18px',
            boxShadow: '0 20px 30px -10px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            fontSize: '12.5px',
            fontWeight: 500,
            animation: 'modernDropdownFadeIn 0.15s ease-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              backgroundColor: '#374151',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '11.5px',
              fontWeight: 700
            }}>
              {selectedTradeIds.size}
            </span>
            <span>trade{selectedTradeIds.size > 1 ? 's' : ''} selected</span>
          </div>

          <div style={{ width: '1px', height: '16px', backgroundColor: '#374151' }} />

          {/* Delete Button */}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete ${selectedTradeIds.size} selected trade${selectedTradeIds.size > 1 ? 's' : ''}?`)) {
                if (onDeleteMultipleTrades) {
                  onDeleteMultipleTrades(Array.from(selectedTradeIds));
                }
                setSelectedTradeIds(new Set());
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'transparent',
              color: '#f87171',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Trash2 size={13} strokeWidth={2} />
            <span>Delete</span>
          </button>

          {/* Mark Plan Followed */}
          <button
            type="button"
            onClick={() => {
              if (onUpdateTrade) {
                selectedTradeIds.forEach(id => {
                  onUpdateTrade(id, 'planFollowed', 'Yes');
                });
              }
              setSelectedTradeIds(new Set());
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'transparent',
              color: '#34d399',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(52, 211, 153, 0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Check size={13} strokeWidth={2.5} />
            <span>Plan: Yes</span>
          </button>

          {/* Deselect All */}
          <button
            type="button"
            onClick={() => setSelectedTradeIds(new Set())}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'transparent',
              color: '#9ca3af',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
          >
            <X size={13} strokeWidth={2} />
            <span>Deselect</span>
          </button>
        </div>
      )}
    </div>
  );
}
