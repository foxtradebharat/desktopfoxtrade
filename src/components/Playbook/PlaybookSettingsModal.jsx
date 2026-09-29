import React, { useEffect, useRef } from 'react';
import {
  X,
  RotateCcw,
  SlidersHorizontal,
  Target,
  ShieldCheck,
  LayoutGrid,
  Download,
  Upload,
  BookOpen,
  Check
} from 'lucide-react';
import { exportAllPlaybooksToJSON } from '../../services/playbookService';

export default function PlaybookSettingsModal({
  isOpen,
  onClose,
  settings = {},
  onUpdateSetting,
  onResetDefaults,
  playbooks = [],
  onImportPlaybooks,
  onReseedSamplePlaybook
}) {
  const fileInputRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const defaultRiskReward = settings.defaultRiskReward ?? 2.0;
  const defaultWinRate = settings.defaultWinRate ?? 65;
  const defaultRiskAmount = settings.defaultRiskAmount ?? 2500;
  const excludeBreakevenFromWinRate = settings.excludeBreakevenFromWinRate !== false;
  const autoTagTradesByName = settings.autoTagTradesByName !== false;
  const strictDisciplineThreshold = settings.strictDisciplineThreshold ?? 80;
  const defaultViewMode = settings.defaultViewMode || 'list';
  const pageSize = settings.pageSize || 12;
  const showSampleBenchmarks = settings.showSampleBenchmarks !== false;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed && Array.isArray(parsed.playbooks)) {
          if (onImportPlaybooks) {
            onImportPlaybooks(parsed.playbooks);
          }
          if (parsed.settings && onUpdateSetting) {
            Object.entries(parsed.settings).forEach(([k, v]) => onUpdateSetting(k, v));
          }
        } else if (Array.isArray(parsed)) {
          if (onImportPlaybooks) onImportPlaybooks(parsed);
        }
      } catch (err) {
        console.error('Failed to parse playbooks JSON file:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Reusable Pill Button with gray transition (Never Pitch Black)
  const renderPillButton = (label, isSelected, onClick) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: isSelected ? 600 : 450,
        cursor: 'pointer',
        border: isSelected
          ? '1px solid color-mix(in srgb, var(--text-primary) 35%, transparent)'
          : '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
        background: isSelected
          ? 'color-mix(in srgb, var(--text-primary) 12%, var(--bg-surface))'
          : 'var(--bg-surface)',
        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
        transition: 'all 0.15s ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6
      }}
      onMouseEnter={e => {
        if (!isSelected) {
          e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 6%, var(--bg-surface))';
          e.currentTarget.style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          e.currentTarget.style.background = 'var(--bg-surface)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      {isSelected && <Check size={12} strokeWidth={2.5} />}
      <span>{label}</span>
    </button>
  );

  // Reusable Modern Gray Toggle Switch (Gray when active, Never pitch black)
  const renderToggle = (id, title, desc, value, onChange) => (
    <div
      onClick={() => onChange(!value)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        cursor: 'pointer',
        userSelect: 'none'
      }}
    >
      <div style={{ paddingRight: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 550, color: 'var(--text-primary)' }}>
          {title}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
          {desc}
        </div>
      </div>

      <div
        style={{
          width: 38,
          height: 22,
          borderRadius: 9999,
          backgroundColor: value
            ? 'color-mix(in srgb, var(--text-primary) 35%, var(--bg-surface))'
            : 'color-mix(in srgb, var(--border-color) 60%, transparent)',
          border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
          position: 'relative',
          transition: 'background-color 0.18s ease',
          flexShrink: 0
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: value ? 'var(--text-primary)' : 'var(--text-muted)',
            position: 'absolute',
            top: 2,
            left: 2,
            transform: value ? 'translateX(16px)' : 'translateX(0px)',
            transition: 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)'
          }}
        />
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(6px)',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '20px',
          border: '1px solid color-mix(in srgb, var(--border-color) 45%, transparent)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          color: 'var(--text-primary)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top-Right Controls: Reset to default + Close X */}
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 10
        }}>
          <button
            type="button"
            onClick={onResetDefaults}
            title="Reset to default"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 11.5,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <RotateCcw size={12} strokeWidth={2.2} />
            <span>Reset to default</span>
          </button>

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              padding: 6,
              borderRadius: '50%',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Header */}
        <div style={{
          padding: '24px 28px 18px 28px',
          borderBottom: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexShrink: 0
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: 'color-mix(in srgb, var(--text-primary) 6%, var(--bg-surface))',
            border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            flexShrink: 0
          }}>
            <SlidersHorizontal size={18} strokeWidth={2} />
          </div>

          <div>
            <h2 style={{ fontSize: 17, fontWeight: 650, margin: 0, letterSpacing: '-0.01em' }}>
              Playbook Studio Settings
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0 0', lineHeight: 1.4 }}>
              Configure strategy defaults, checklist evaluation, and library views
            </p>
          </div>
        </div>

        {/* Scrollable Body */}
        <div style={{
          padding: '22px 28px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 26
        }}>
          {/* Section 1: Strategy Benchmarks & Risk Targets */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Target size={15} color="var(--text-primary)" strokeWidth={2} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                Strategy Benchmarks &amp; Risk Targets
              </span>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 14px 23px' }}>
              Baseline targets used when creating new playbook setups and calculating R-multiples
            </p>

            <div style={{
              border: '1px solid color-mix(in srgb, var(--border-color) 30%, transparent)',
              borderRadius: 14,
              padding: '16px 18px',
              backgroundColor: 'var(--bg-surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              {/* Default Target R:R */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
                  Default Target Risk-to-Reward (R:R)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[1.5, 2.0, 2.5, 3.0].map(rr => (
                    <React.Fragment key={rr}>
                      {renderPillButton(`1:${rr.toFixed(1)}`, defaultRiskReward === rr, () => onUpdateSetting('defaultRiskReward', rr))}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Default Win Rate Target */}
              <div style={{ borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', paddingTop: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
                  Default Target Win Rate %
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[50, 60, 65, 70, 75].map(wr => (
                    <React.Fragment key={wr}>
                      {renderPillButton(`${wr}%`, defaultWinRate === wr, () => onUpdateSetting('defaultWinRate', wr))}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Baseline Risk Per Trade */}
              <div style={{ borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', paddingTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-primary)' }}>
                    Baseline Risk per Trade (R Unit)
                  </label>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Used when trade SL risk isn't explicitly entered
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {[1000, 2500, 5000, 10000].map(amt => (
                    <React.Fragment key={amt}>
                      {renderPillButton(`₹${amt.toLocaleString('en-IN')}`, defaultRiskAmount === amt, () => onUpdateSetting('defaultRiskAmount', amt))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Execution & Discipline Evaluation */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <ShieldCheck size={15} color="var(--text-primary)" strokeWidth={2} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                Execution &amp; Discipline Evaluation
              </span>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 14px 23px' }}>
              Set rules for trade auto-linking, win rate calculation, and discipline scoring
            </p>

            <div style={{
              border: '1px solid color-mix(in srgb, var(--border-color) 30%, transparent)',
              borderRadius: 14,
              padding: '6px 18px',
              backgroundColor: 'var(--bg-surface)'
            }}>
              {renderToggle(
                'autoTagTradesByName',
                'Auto-Tag Trades by Setup Name',
                'Automatically associate journal trades with playbooks when the trade setup matches the strategy title or slug',
                autoTagTradesByName,
                val => onUpdateSetting('autoTagTradesByName', val)
              )}

              <div style={{ borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)' }} />

              {renderToggle(
                'excludeBreakevenFromWinRate',
                'Exclude Breakeven Trades from Win Rate %',
                'Formula: Wins / (Wins + Losses). Breakeven trades (₹0 P&L) will not dilute your systematic win percentage (Nexus standard)',
                excludeBreakevenFromWinRate,
                val => onUpdateSetting('excludeBreakevenFromWinRate', val)
              )}

              <div style={{ borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)' }} />

              <div style={{ padding: '12px 0' }}>
                <div style={{ fontSize: 13, fontWeight: 550, color: 'var(--text-primary)', marginBottom: 2 }}>
                  Strict Discipline Threshold
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>
                  Minimum checklist score required for an audited trade to receive a "Flawless Discipline" badge
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[70, 80, 90, 100].map(thresh => (
                    <React.Fragment key={thresh}>
                      {renderPillButton(`${thresh}%`, strictDisciplineThreshold === thresh, () => onUpdateSetting('strictDisciplineThreshold', thresh))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Library & Display */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <LayoutGrid size={15} color="var(--text-primary)" strokeWidth={2} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                Library &amp; Display
              </span>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 14px 23px' }}>
              Customise default layout view and pagination density
            </p>

            <div style={{
              border: '1px solid color-mix(in srgb, var(--border-color) 30%, transparent)',
              borderRadius: 14,
              padding: '16px 18px',
              backgroundColor: 'var(--bg-surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
                  Default Library View
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {renderPillButton('Table List View', defaultViewMode === 'list', () => onUpdateSetting('defaultViewMode', 'list'))}
                  {renderPillButton('Card Grid View', defaultViewMode === 'grid', () => onUpdateSetting('defaultViewMode', 'grid'))}
                  {renderPillButton('Compare Matrix', defaultViewMode === 'compare', () => onUpdateSetting('defaultViewMode', 'compare'))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', paddingTop: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
                  Setups Per Page
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[8, 12, 24, 48].map(ps => (
                    <React.Fragment key={ps}>
                      {renderPillButton(String(ps), pageSize === ps, () => onUpdateSetting('pageSize', ps))}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', paddingTop: 6 }}>
                {renderToggle(
                  'showSampleBenchmarks',
                  'Show Sample Benchmarks for New Setups',
                  'Display sample distribution benchmarks when a newly created setup has 0 live trades tagged',
                  showSampleBenchmarks,
                  val => onUpdateSetting('showSampleBenchmarks', val)
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Data Management & Backup */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <BookOpen size={15} color="var(--text-primary)" strokeWidth={2} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                Data Management &amp; Backup
              </span>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 14px 23px' }}>
              Export your playbooks for safekeeping, import from backup, or restore the default Sample Playbook
            </p>

            <div style={{
              border: '1px solid color-mix(in srgb, var(--border-color) 30%, transparent)',
              borderRadius: 14,
              padding: '16px 18px',
              backgroundColor: 'var(--bg-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Export All */}
                <button
                  type="button"
                  onClick={() => exportAllPlaybooksToJSON(playbooks, settings)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 550,
                    cursor: 'pointer',
                    background: 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))',
                    border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
                    color: 'var(--text-primary)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 12%, var(--bg-surface))'}
                  onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))'}
                >
                  <Download size={13} />
                  <span>Export All Playbooks (.JSON)</span>
                </button>

                {/* Import Backup */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json"
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 550,
                    cursor: 'pointer',
                    background: 'var(--bg-surface)',
                    border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
                    color: 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 6%, var(--bg-surface))';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--bg-surface)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <Upload size={13} />
                  <span>Import Playbooks</span>
                </button>
              </div>

              {/* Re-seed Sample Playbook */}
              {onReseedSamplePlaybook && (
                <button
                  type="button"
                  onClick={onReseedSamplePlaybook}
                  title="Restores the clean default Sample Playbook"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    background: 'transparent',
                    border: '1px dashed color-mix(in srgb, var(--border-color) 50%, transparent)',
                    color: 'var(--text-muted)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--text-primary)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 50%, transparent)';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Re-seed Sample Playbook</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
          backgroundColor: 'var(--bg-surface)',
          flexShrink: 0
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 550,
              cursor: 'pointer',
              background: 'color-mix(in srgb, var(--text-primary) 10%, var(--bg-surface))',
              border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
              color: 'var(--text-primary)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 15%, var(--bg-surface))'}
            onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 10%, var(--bg-surface))'}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
