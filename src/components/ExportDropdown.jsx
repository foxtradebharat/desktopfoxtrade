import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, FileCode, Archive } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ExportDropdown({
  trades = [],
  portfolios = [],
  capitalChanges = {},
  settings = {},
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const getTimestamp = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  // 1. Export CSV
  const handleExportCSV = () => {
    setIsOpen(false);
    if (!trades || trades.length === 0) {
      alert('No trades available to export.');
      return;
    }

    const headers = [
      'TRADE NO.', 'DATE', 'NAME', 'SETUP', 'BUY/SELL', 'ENTRY (₹)', 
      'AVG ENTRY (₹)', 'SL (₹)', 'CMP (₹)', 'ENTRY TYPE', 'INITIAL QTY/LOT',
      'P1 PRICE (₹)', 'P1 QTY/LOT', 'P1 DATE', 'P1 SL (₹)',
      'P2 PRICE (₹)', 'P2 QTY/LOT', 'P2 DATE', 'P2 SL (₹)',
      'P3 PRICE (₹)', 'P3 QTY/LOT', 'P3 DATE', 'P3 SL (₹)',
      'P4 PRICE (₹)', 'P4 QTY/LOT', 'P4 DATE', 'P4 SL (₹)',
      'TSL (₹)', 'POSITION SIZE (₹)', 'CURRENT ALLOCATION (%)', 'PEAK ALLOCATION (%)', 'SL %',
      'E1 PRICE (₹)', 'E1 QTY/LOT', 'E1 DATE',
      'E2 PRICE (₹)', 'E2 QTY/LOT', 'E2 DATE',
      'E3 PRICE (₹)', 'E3 QTY/LOT', 'E3 DATE',
      'E4 PRICE (₹)', 'E4 QTY/LOT', 'E4 DATE',
      'OPEN QTY/LOT', 'EXITED QTY/LOT', 'AVG EXIT PRICE (₹)',
      'STOCK MOVE', 'REWARD:RISK', 'HOLDING DAYS', 'POSITION STATUS', 
      'REALISED AMOUNT (₹)', 'Gross P/L (₹)', 'PF IMPACT (%)', 'CUMM PF IMPACT (%)',
      'PLAN FOLLOWED', 'EXIT TRIGGER', 'GROWTH AREAS', 'CAPITAL AT RISK (%)',
      'BASE DURATION', 'QUICK NOTE', 'UNREALIZED P/L (₹)'
    ];

    const rows = trades.map(t => [
      t.tradeNo || '',
      t.date || '',
      t.name || t.symbol || '',
      t.setup || '',
      t.type || 'Buy',
      t.entry || 0,
      t.avgEntry || 0,
      t.sl !== null && t.sl !== undefined ? t.sl : '',
      t.cmp ?? 0,
      t.entryType || 'Market',
      t.qty ?? 0,
      t.p1Price ?? 0,
      t.p1Qty ?? 0,
      t.p1Date || '',
      t.p1Sl !== null && t.p1Sl !== undefined ? t.p1Sl : '',
      t.p2Price ?? 0,
      t.p2Qty ?? 0,
      t.p2Date || '',
      t.p2Sl !== null && t.p2Sl !== undefined ? t.p2Sl : '',
      t.p3Price ?? 0,
      t.p3Qty ?? 0,
      t.p3Date || '',
      t.p3Sl !== null && t.p3Sl !== undefined ? t.p3Sl : '',
      t.p4Price ?? 0,
      t.p4Qty ?? 0,
      t.p4Date || '',
      t.p4Sl !== null && t.p4Sl !== undefined ? t.p4Sl : '',
      t.tsl ?? 0,
      t.positionSize ?? 0,
      t.currentAllocation ?? 0,
      t.peakAllocation ?? 0,
      t.slPct !== null && t.slPct !== undefined ? t.slPct : '',
      t.e1Price ?? 0,
      t.e1Qty ?? 0,
      t.e1Date || '',
      t.e2Price ?? 0,
      t.e2Qty ?? 0,
      t.e2Date || '',
      t.e3Price ?? 0,
      t.e3Qty ?? 0,
      t.e3Date || '',
      t.e4Price ?? 0,
      t.e4Qty ?? 0,
      t.e4Date || '',
      t.openQty ?? 0,
      t.exitedQty ?? 0,
      t.avgExitPrice ?? 0,
      t.stockMove ?? 0,
      t.rewardRisk !== null && t.rewardRisk !== undefined ? t.rewardRisk : '',
      t.holdingDays ?? 0,
      t.status || 'Open',
      t.realisedAmount ?? 0,
      t.grossPnl ?? t.pnl ?? 0,
      t.pfImpact ?? 0,
      t.cummPf ?? 0,
      t.planFollowed || '',
      t.exitTrigger || '',
      t.growthAreas || '',
      t.capitalAtRisk ?? 0,
      t.baseDuration || '',
      `"${(t.quickNote || '').replace(/"/g, '""')}"`,
      t.unrealized ?? 0
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `foxtrade_trades_${getTimestamp()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 2. Export Excel (.xlsx)
  const handleExportExcel = () => {
    setIsOpen(false);
    if (!trades || trades.length === 0) {
      alert('No trades available to export.');
      return;
    }

    try {
      const dataRows = trades.map(t => ({
        'TRADE NO.': t.tradeNo || '',
        'DATE': t.date || '',
        'NAME': t.name || t.symbol || '',
        'SETUP': t.setup || '',
        'BUY/SELL': t.type || 'Buy',
        'ENTRY (₹)': t.entry ?? 0,
        'AVG ENTRY (₹)': t.avgEntry ?? 0,
        'SL (₹)': t.sl !== null && t.sl !== undefined ? t.sl : '',
        'CMP (₹)': t.cmp ?? 0,
        'ENTRY TYPE': t.entryType || '',
        'INITIAL QTY/LOT': t.qty ?? 0,
        'P1 PRICE (₹)': t.p1Price ?? 0,
        'P1 QTY/LOT': t.p1Qty ?? 0,
        'P1 DATE': t.p1Date || '',
        'P1 SL (₹)': t.p1Sl !== null && t.p1Sl !== undefined ? t.p1Sl : '',
        'P2 PRICE (₹)': t.p2Price ?? 0,
        'P2 QTY/LOT': t.p2Qty ?? 0,
        'P2 DATE': t.p2Date || '',
        'P2 SL (₹)': t.p2Sl !== null && t.p2Sl !== undefined ? t.p2Sl : '',
        'P3 PRICE (₹)': t.p3Price ?? 0,
        'P3 QTY/LOT': t.p3Qty ?? 0,
        'P3 DATE': t.p3Date || '',
        'P3 SL (₹)': t.p3Sl !== null && t.p3Sl !== undefined ? t.p3Sl : '',
        'P4 PRICE (₹)': t.p4Price ?? 0,
        'P4 QTY/LOT': t.p4Qty ?? 0,
        'P4 DATE': t.p4Date || '',
        'P4 SL (₹)': t.p4Sl !== null && t.p4Sl !== undefined ? t.p4Sl : '',
        'TSL (₹)': t.tsl ?? 0,
        'POSITION SIZE (₹)': t.positionSize ?? 0,
        'CURRENT ALLOCATION (%)': t.currentAllocation ?? 0,
        'PEAK ALLOCATION (%)': t.peakAllocation ?? 0,
        'SL %': t.slPct !== null && t.slPct !== undefined ? t.slPct : '',
        'E1 PRICE (₹)': t.e1Price ?? 0,
        'E1 QTY/LOT': t.e1Qty ?? 0,
        'E1 DATE': t.e1Date || '',
        'E2 PRICE (₹)': t.e2Price ?? 0,
        'E2 QTY/LOT': t.e2Qty ?? 0,
        'E2 DATE': t.e2Date || '',
        'E3 PRICE (₹)': t.e3Price ?? 0,
        'E3 QTY/LOT': t.e3Qty ?? 0,
        'E3 DATE': t.e3Date || '',
        'E4 PRICE (₹)': t.e4Price ?? 0,
        'E4 QTY/LOT': t.e4Qty ?? 0,
        'E4 DATE': t.e4Date || '',
        'OPEN QTY/LOT': t.openQty ?? 0,
        'EXITED QTY/LOT': t.exitedQty ?? 0,
        'AVG EXIT PRICE (₹)': t.avgExitPrice ?? 0,
        'STOCK MOVE (%)': t.stockMove ?? 0,
        'REWARD:RISK': t.rewardRisk !== null && t.rewardRisk !== undefined ? t.rewardRisk : '',
        'HOLDING DAYS': t.holdingDays ?? 0,
        'POSITION STATUS': t.status || 'Open',
        'REALISED AMOUNT (₹)': t.realisedAmount ?? 0,
        'GROSS P/L (₹)': t.grossPnl ?? t.pnl ?? 0,
        'PF IMPACT (%)': t.pfImpact ?? 0,
        'CUMM PF IMPACT (%)': t.cummPf ?? 0,
        'PLAN FOLLOWED': t.planFollowed || '',
        'EXIT TRIGGER': t.exitTrigger || '',
        'GROWTH AREAS': t.growthAreas || '',
        'CAPITAL AT RISK (%)': t.capitalAtRisk ?? 0,
        'BASE DURATION': t.baseDuration || '',
        'QUICK NOTE': t.quickNote || '',
        'UNREALIZED P/L (₹)': t.unrealized ?? 0
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Trade Journal');

      // Auto-fit column widths
      const colWidths = Object.keys(dataRows[0] || {}).map(key => ({
        wch: Math.max(key.length + 3, 12)
      }));
      worksheet['!cols'] = colWidths;

      XLSX.writeFile(workbook, `foxtrade_trades_${getTimestamp()}.xlsx`);
    } catch (err) {
      console.error('Excel Export Error:', err);
      // Fallback to CSV
      handleExportCSV();
    }
  };

  // 3. Export Comprehensive Backup (JSON)
  const handleExportJSON = () => {
    setIsOpen(false);
    const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      source: 'FoxTrade Indian Equity Trading Journal',
      trades,
      portfolios,
      capitalChanges,
      settings
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `foxtrade_backup_${getTimestamp()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 4. Export Comprehensive Backup (JSON.GZ)
  const handleExportJSONGZ = async () => {
    setIsOpen(false);
    const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      source: 'FoxTrade Indian Equity Trading Journal',
      trades,
      portfolios,
      capitalChanges,
      settings
    };

    const jsonStr = JSON.stringify(backupData, null, 2);

    try {
      if (typeof CompressionStream !== 'undefined') {
        const stream = new Blob([jsonStr], { type: 'application/json' }).stream();
        const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
        const response = new Response(compressedStream);
        const blob = await response.blob();
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `foxtrade_backup_${getTimestamp()}.json.gz`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        handleExportJSON();
      }
    } catch (err) {
      console.warn('Gzip Compression Error, falling back to raw JSON:', err);
      handleExportJSON();
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        title="Export options"
        aria-label="Export options"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: isOpen ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
          color: 'var(--text-secondary, #6b7280)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: 0,
          transition: 'all 0.15s ease',
          outline: 'none'
        }}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Download size={15} strokeWidth={1.4} />
      </button>

      {/* Floating Modern Popover */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 100,
            minWidth: '210px',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            borderRadius: '16px',
            border: '1px solid var(--border-color, rgba(0, 0, 0, 0.08))',
            boxShadow: '0 16px 48px -12px rgba(0, 0, 0, 0.18), 0 8px 16px -6px rgba(0, 0, 0, 0.06)',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            animation: 'foxtradeFadeZoom 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            transformOrigin: 'top right'
          }}
        >
          {/* Section 1: Quick Export */}
          <div style={{
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            color: 'var(--text-muted, #9ca3af)',
            padding: '6px 10px 4px 10px',
            userSelect: 'none'
          }}>
            Quick Export
          </div>

          {/* Item 1: Export CSV */}
          <div
            role="menuitem"
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '7px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--text-primary, #111827)',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'background-color 0.12s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <FileText size={15} strokeWidth={1.4} color="var(--text-secondary, #4b5563)" />
            <span>Export CSV</span>
          </div>

          {/* Item 2: Export Excel */}
          <div
            role="menuitem"
            onClick={handleExportExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '7px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--text-primary, #111827)',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'background-color 0.12s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <FileSpreadsheet size={15} strokeWidth={1.4} color="var(--text-secondary, #4b5563)" />
            <span>Export Excel</span>
          </div>

          {/* Divider */}
          <div style={{
            height: '1px',
            backgroundColor: 'var(--border-color, rgba(0, 0, 0, 0.08))',
            margin: '4px 6px',
            opacity: 0.8
          }} />

          {/* Section 2: Comprehensive Backup */}
          <div style={{
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            color: 'var(--text-muted, #9ca3af)',
            padding: '6px 10px 4px 10px',
            userSelect: 'none'
          }}>
            Comprehensive Backup
          </div>

          {/* Item 3: Complete Data (JSON) */}
          <div
            role="menuitem"
            onClick={handleExportJSON}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '7px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--text-primary, #111827)',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'background-color 0.12s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <FileCode size={15} strokeWidth={1.4} color="var(--text-secondary, #4b5563)" />
            <span>Complete Data (JSON)</span>
          </div>

          {/* Item 4: Complete Data (JSON.GZ) */}
          <div
            role="menuitem"
            onClick={handleExportJSONGZ}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '7px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--text-primary, #111827)',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'background-color 0.12s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Archive size={15} strokeWidth={1.4} color="var(--text-secondary, #4b5563)" />
            <span>Complete Data (JSON.GZ)</span>
          </div>
        </div>
      )}
    </div>
  );
}
