import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  X,
  Pencil,
  Calculator,
  IndianRupee,
  FileText,
  Percent,
  Info,
  ChevronDown,
  RotateCcw
} from 'lucide-react';

const TRADE_BASED_FIELDS = [
  { key: 'stt', label: 'Securities Transaction Tax' },
  { key: 'stampDuty', label: 'Stamp Duty' },
  { key: 'exchangeCharges', label: 'Exchange Tx Charges' },
  { key: 'gst', label: 'GST' },
  { key: 'sebiCharges', label: 'SEBI Charges' },
  { key: 'ipft', label: 'IPFT' },
  { key: 'brokerage', label: 'Brokerage' },
  { key: 'otherCharges', label: 'Tax + Other Charges' },
];

const LEDGER_BASED_FIELDS = [
  { key: 'mtfCharges', label: 'MTF Charges' },
  { key: 'mtfInterest', label: 'MTF Interest' },
  { key: 'marginInterest', label: 'Margin Interest' },
  { key: 'dpCharges', label: 'DP Charges' },
  { key: 'amcMaintenance', label: 'AMC / Maintenance' },
  { key: 'ddpiCharges', label: 'DDPI Charges' },
  { key: 'delayedPayment', label: 'Delayed Payment' },
  { key: 'bankUpdate', label: 'Bank Update' },
  { key: 'autoSquareOff', label: 'Auto Square Off' },
];

export default function TaxInputDialog({
  isOpen,
  onClose,
  monthName = 'January',
  monthIndex = 0,
  year = '2026',
  grossPl = 0,
  initialData = {},
  autoTradeCharges = null,
  isAutoChargesEnabled = false,
  onSave,
}) {
  const [tradeCharges, setTradeCharges] = useState({});
  const [ledgerCharges, setLedgerCharges] = useState({});
  const [unknownCharges, setUnknownCharges] = useState(0);
  const [totalTaxesInput, setTotalTaxesInput] = useState('');

  // Sync state when dialog opens or month changes
  useEffect(() => {
    if (isOpen) {
      let tb = initialData?.tradeBased || {};
      const lb = initialData?.ledgerBased || {};

      // If automatic charges mode is ON, automatically pull real-time trade charges
      if (isAutoChargesEnabled && autoTradeCharges && autoTradeCharges.tradeCount > 0) {
        tb = {
          stt: autoTradeCharges.stt || 0,
          stampDuty: autoTradeCharges.stampDuty || 0,
          exchangeCharges: autoTradeCharges.exchangeCharges || 0,
          gst: autoTradeCharges.gst || 0,
          sebiCharges: autoTradeCharges.sebiCharges || 0,
          ipft: autoTradeCharges.ipft || 0,
          brokerage: autoTradeCharges.brokerage || 0,
          otherCharges: autoTradeCharges.otherCharges || 0,
        };
      }

      setTradeCharges({ ...tb });
      setLedgerCharges({ ...lb });

      const sumTB = Object.values(tb).reduce((a, b) => a + (parseFloat(b) || 0), 0);
      const sumLB = Object.values(lb).reduce((a, b) => a + (parseFloat(b) || 0), 0);
      const savedUnknown = Number(initialData?.unknownCharges || 0);
      const initialTotal = Math.round((sumTB + sumLB + savedUnknown) * 100) / 100;

      setTotalTaxesInput(String(initialTotal || ''));
      setUnknownCharges(savedUnknown);
    }
  }, [isOpen, initialData, monthIndex, year, isAutoChargesEnabled, autoTradeCharges]);

  // Compute itemized sums
  const sumTradeBased = useMemo(() => {
    return Object.values(tradeCharges).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
  }, [tradeCharges]);

  const sumLedgerBased = useMemo(() => {
    return Object.values(ledgerCharges).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
  }, [ledgerCharges]);

  // Effective Total Taxes: driven by input or sum
  const effectiveTotal = useMemo(() => {
    const parsed = parseFloat(totalTaxesInput);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
    return sumTradeBased + sumLedgerBased + (parseFloat(unknownCharges) || 0);
  }, [totalTaxesInput, sumTradeBased, sumLedgerBased, unknownCharges]);

  const netPl = useMemo(() => {
    return grossPl - effectiveTotal;
  }, [grossPl, effectiveTotal]);

  const taxImpact = useMemo(() => {
    return grossPl > 0 ? (effectiveTotal / grossPl) * 100 : 0;
  }, [grossPl, effectiveTotal]);

  // Handler when any Trade-based charge changes
  const handleTradeChargeChange = (key, val) => {
    const num = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    const updated = { ...tradeCharges, [key]: num };
    setTradeCharges(updated);

    const newSumTB = Object.values(updated).reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
    const newTotal = newSumTB + sumLedgerBased + (parseFloat(unknownCharges) || 0);
    setTotalTaxesInput(String(Math.round(newTotal * 100) / 100));
  };

  // Handler when any Ledger-based charge changes
  const handleLedgerChargeChange = (key, val) => {
    const num = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    const updated = { ...ledgerCharges, [key]: num };
    setLedgerCharges(updated);

    const newSumLB = Object.values(updated).reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
    const newTotal = sumTradeBased + newSumLB + (parseFloat(unknownCharges) || 0);
    setTotalTaxesInput(String(Math.round(newTotal * 100) / 100));
  };

  // Handler when Total Taxes input is directly modified
  const handleTotalTaxesInputChange = (val) => {
    setTotalTaxesInput(val);
    const parsedTotal = Math.max(0, parseFloat(val) || 0);
    const itemizedSum = sumTradeBased + sumLedgerBased;

    if (parsedTotal > itemizedSum) {
      setUnknownCharges(Math.round((parsedTotal - itemizedSum) * 100) / 100);
    } else {
      setUnknownCharges(0);
    }
  };

  // Reset all fields to zero
  const handleResetAll = () => {
    setTradeCharges({});
    setLedgerCharges({});
    setUnknownCharges(0);
    setTotalTaxesInput('0');
  };

  // Submit & Save
  const handleSave = () => {
    onSave({
      total: effectiveTotal,
      tradeBased: tradeCharges,
      ledgerBased: ledgerCharges,
      unknownCharges,
      monthIndex,
      year,
    });
    onClose();
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
          borderRadius: '20px',
          boxShadow: '0 20px 48px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'taxModalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Tax Input Dialog
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '8px',
                border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                backgroundColor: 'var(--bg-primary)',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
              }}
            >
              <span>{year}</span>
            </div>

            <span
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                padding: '0 8px',
              }}
            >
              {monthName}
            </span>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              className="hover:bg-muted/40 hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Top 4 Summary Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '14px',
            }}
          >
            {/* Card 1: Gross P/L */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '14px',
                border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                  Gross P/L
                </span>
                <IndianRupee size={13} style={{ color: 'var(--text-muted)', opacity: 0.7 }} />
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '-0.02em',
                  color: grossPl >= 0 ? 'var(--text-primary)' : '#f43f5e',
                  marginTop: '2px',
                }}
              >
                ₹{grossPl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>
                {grossPl >= 0 ? 'Profit' : 'Loss'}
              </div>
            </div>

            {/* Card 2: Total Taxes (Real-time Input) */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '14px',
                border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                    Total Taxes
                  </span>
                  <Pencil size={11} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                </div>
                <Calculator size={13} style={{ color: 'var(--text-muted)', opacity: 0.7 }} />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginTop: '2px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '6px',
                  padding: '1px 8px',
                  border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--text-muted)', marginRight: '4px' }}>
                  ₹
                </span>
                <input
                  type="number"
                  value={totalTaxesInput}
                  onChange={(e) => handleTotalTaxesInputChange(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '18px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary)',
                    padding: '2px 0',
                  }}
                />
              </div>
            </div>

            {/* Card 3: Net P/L */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '14px',
                border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                  Net P/L
                </span>
                <FileText size={13} style={{ color: 'var(--text-muted)', opacity: 0.7 }} />
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '-0.02em',
                  color: netPl >= 0 ? '#10b981' : '#f43f5e',
                  marginTop: '2px',
                }}
              >
                ₹{netPl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>
                After Tax
              </div>
            </div>

            {/* Card 4: Tax Impact % */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '14px',
                border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                  Tax Impact
                </span>
                <Percent size={13} style={{ color: 'var(--text-muted)', opacity: 0.7 }} />
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                  marginTop: '2px',
                }}
              >
                {taxImpact.toFixed(2)}%
              </div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>
                of Gross P/L
              </div>
            </div>
          </div>

          {/* Granular Charges: 2-Column Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '24px',
            }}
          >
            {/* Column 1: Trade-Based Charges */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                  Trade-Based Charges
                </span>
                <Pencil size={11} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                <Info size={12} style={{ color: 'var(--text-muted)', opacity: 0.5, cursor: 'help' }} />
              </div>

              <div
                style={{
                  borderRadius: '16px',
                  border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  backgroundColor: 'var(--bg-surface)',
                  padding: '12px 18px',
                }}
              >
                {TRADE_BASED_FIELDS.map((f, i) => (
                  <div
                    key={f.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: i === TRADE_BASED_FIELDS.length - 1 ? 'none' : '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                      {f.label}
                    </span>
                    <input
                      type="number"
                      value={tradeCharges[f.key] !== undefined ? tradeCharges[f.key] : ''}
                      placeholder="0"
                      onChange={(e) => handleTradeChargeChange(f.key, e.target.value)}
                      style={{
                        width: '100px',
                        textAlign: 'right',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                      }}
                      className="focus:bg-muted/20 rounded px-1"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: Ledger-Based Charges */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                  Ledger-Based Charges
                </span>
                <Pencil size={11} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                <Info size={12} style={{ color: 'var(--text-muted)', opacity: 0.5, cursor: 'help' }} />
              </div>

              <div
                style={{
                  borderRadius: '16px',
                  border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  backgroundColor: 'var(--bg-surface)',
                  padding: '12px 18px',
                }}
              >
                {LEDGER_BASED_FIELDS.map((f) => (
                  <div
                    key={f.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                      {f.label}
                    </span>
                    <input
                      type="number"
                      value={ledgerCharges[f.key] !== undefined ? ledgerCharges[f.key] : ''}
                      placeholder="0"
                      onChange={(e) => handleLedgerChargeChange(f.key, e.target.value)}
                      style={{
                        width: '100px',
                        textAlign: 'right',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                      }}
                      className="focus:bg-muted/20 rounded px-1"
                    />
                  </div>
                ))}

                {/* Unknown Charges */}
                {unknownCharges > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#f59e0b' }}>
                      Unknown Charges
                    </span>
                    <input
                      type="number"
                      value={unknownCharges}
                      onChange={(e) => setUnknownCharges(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100px',
                        textAlign: 'right',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#f59e0b',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <button
            type="button"
            onClick={handleResetAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              marginRight: 'auto',
              transition: 'all 0.15s ease',
            }}
            className="hover:bg-muted/30 hover:text-foreground"
            title="Reset all fields to 0"
          >
            <RotateCcw size={12} />
            <span>Reset All</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            className="hover:bg-muted/30"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '9px 22px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-surface)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.15s ease',
            }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
