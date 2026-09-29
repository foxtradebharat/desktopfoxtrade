import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  BookOpen,
  Target,
  Layers,
  HelpCircle
} from 'lucide-react';
import {
  genPlaybookId,
  genGroupId,
  genRuleId
} from '../../services/playbookService';
import {
  PLAYBOOK_ICONS,
  PLAYBOOK_COLORS,
  PlaybookIconView
} from './playbookIcons';

export default function PlaybookBuilderModal({
  isOpen,
  onClose,
  onSavePlaybook,
  initialData = null
}) {
  const isEdit = !!initialData;

  const [title, setTitle] = useState(initialData?.title || '');
  const [titleError, setTitleError] = useState('');
  const [icon, setIcon] = useState(initialData?.icon || 'BookOpen');
  const [colorHex, setColorHex] = useState(initialData?.colorHex || '#3b82f6');
  const [strategyType, setStrategyType] = useState(initialData?.strategyType || 'BREAKOUT');
  const [segments, setSegments] = useState(initialData?.applicableSegments || ['EQUITY']);
  const [targetWinRate, setTargetWinRate] = useState(initialData?.targetWinRate || 65);
  const [targetRiskReward, setTargetRiskReward] = useState(initialData?.targetRiskReward || 2.5);
  const [description, setDescription] = useState(initialData?.description || '');
  const [methodology, setMethodology] = useState(initialData?.methodology || 'Technical');
  const [primaryTimeframe, setPrimaryTimeframe] = useState(initialData?.primaryTimeframe || '5m');
  const [positionSizing, setPositionSizing] = useState(initialData?.riskManagement?.positionSizing || '1% Account Risk');
  const [stopLossRule, setStopLossRule] = useState(initialData?.riskManagement?.stopLossRule || 'Technical Swing High/Low');
  const [takeProfitRule, setTakeProfitRule] = useState(initialData?.riskManagement?.takeProfitRule || 'Fixed 1:2+ R:R Target');

  // Inline group creation state (replaces browser prompt())
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupTitleInput, setNewGroupTitleInput] = useState('');

  // Default initial groups if brand new
  const [ruleGroups, setRuleGroups] = useState(() => {
    if (initialData?.ruleGroups && initialData.ruleGroups.length > 0) {
      return initialData.ruleGroups;
    }
    return [
      {
        id: genGroupId(),
        title: 'Entry Rules',
        rules: [
          { id: genRuleId(), text: '5m candle closes above VWAP on relative volume > 2.0', isRequired: true }
        ]
      },
      {
        id: genGroupId(),
        title: 'Exit Rules',
        rules: [
          { id: genRuleId(), text: '50% profit booked at 1:2 R:R target', isRequired: true },
          { id: genRuleId(), text: 'Trailing stop loss moved to breakeven after Target 1', isRequired: true }
        ]
      }
    ];
  });

  const [newRuleTexts, setNewRuleTexts] = useState({});

  const toggleSegment = (seg) => {
    if (segments.includes(seg)) {
      if (segments.length > 1) {
        setSegments(segments.filter(s => s !== seg));
      }
    } else {
      setSegments([...segments, seg]);
    }
  };

  const handleAddRuleToGroup = (groupId) => {
    const text = (newRuleTexts[groupId] || '').trim();
    if (!text) return;

    setRuleGroups(groups =>
      groups.map(g => {
        if (g.id === groupId) {
          return {
            ...g,
            rules: [...(g.rules || []), { id: genRuleId(), text, isRequired: true }]
          };
        }
        return g;
      })
    );

    setNewRuleTexts(prev => ({ ...prev, [groupId]: '' }));
  };

  const handleDeleteRule = (groupId, ruleId) => {
    setRuleGroups(groups =>
      groups.map(g => {
        if (g.id === groupId) {
          return {
            ...g,
            rules: (g.rules || []).filter(r => r.id !== ruleId)
          };
        }
        return g;
      })
    );
  };

  const handleConfirmAddGroup = () => {
    if (!newGroupTitleInput.trim()) return;
    setRuleGroups(prev => [
      ...prev,
      {
        id: genGroupId(),
        title: newGroupTitleInput.trim(),
        rules: []
      }
    ]);
    setNewGroupTitleInput('');
    setIsAddingGroup(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError('Please enter a playbook setup title.');
      return;
    }
    setTitleError('');

    const playbook = {
      id: initialData?.id || genPlaybookId(),
      title: title.trim(),
      slug: title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      icon: icon || 'BookOpen',
      colorHex: colorHex || '#3b82f6',
      strategyType,
      applicableSegments: segments,
      methodology,
      primaryTimeframe,
      riskManagement: {
        positionSizing,
        stopLossRule,
        takeProfitRule
      },
      targetWinRate: Number(targetWinRate) || 60,
      targetRiskReward: Number(targetRiskReward) || 2.0,
      description: description.trim(),
      ruleGroups,
      notes: initialData?.notes || [
        {
          id: 'note-1',
          title: 'Setup Thesis & Psychology',
          content: `<p>Document key patterns and conditions required for an A+ trade execution.</p>`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      isActive: true,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSavePlaybook(playbook);
    onClose();
  };

  const STRATEGY_TYPES = [
    { key: 'BREAKOUT', label: 'Breakout' },
    { key: 'TREND_FOLLOWING', label: 'Trend Following' },
    { key: 'MEAN_REVERSION', label: 'Mean Reversion' },
    { key: 'MOMENTUM', label: 'Momentum' },
    { key: 'EVENT_DRIVEN', label: 'Event Driven' },
    { key: 'OPTIONS_INCOME', label: 'Options Income' },
    { key: 'SCALP', label: 'Scalp' },
    { key: 'SWING', label: 'Swing' },
    { key: 'OTHER', label: 'Other' }
  ];

  const SEGMENTS_LIST = ['EQUITY', 'FUTURES', 'OPTIONS', 'COMMODITY', 'CURRENCY'];

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(3px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      <div style={{
        width: '100%',
        maxWidth: 640,
        background: 'var(--bg-card)',
        border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
        borderRadius: 14,
        boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh',
        overflow: 'hidden'
      }}>
        {/* Sticky Header */}
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              {isEdit ? 'Edit Playbook Setup' : 'Create New Playbook Setup'}
            </span>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Define execution rules, win rate targets, and risk parameters.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
          <div style={{
            padding: '18px 22px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            flex: 1
          }}>
          {/* Title */}
          <div>
            <label htmlFor="playbook-builder-title" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: titleError ? '#ef4444' : 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
              Setup Title *
            </label>
            <input
              id="playbook-builder-title"
              name="playbookTitle"
              autoFocus
              value={title}
              onChange={e => { setTitle(e.target.value); if (titleError) setTitleError(''); }}
              placeholder="e.g. Opening Range Breakout, Stage 2 VCP..."
              style={{
                width: '100%',
                height: 38,
                padding: '0 12px',
                borderRadius: 8,
                border: titleError ? '1.5px solid #ef4444' : '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                background: 'var(--bg-surface)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {titleError && (
              <span style={{ fontSize: 11.5, color: '#ef4444', fontWeight: 500, display: 'block', marginTop: 4 }}>
                {titleError}
              </span>
            )}
          </div>

          {/* Icon & Accent Color Picker (TradeZella Style - Pure Lucide Icons & Color Swatches) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-muted)' }}>
                Setup Icon & Accent Color
              </span>
              {/* Live Preview Pill */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 9px',
                borderRadius: 6,
                background: `color-mix(in srgb, ${colorHex} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${colorHex} 30%, transparent)`
              }}>
                <PlaybookIconView name={icon} size={14} color={colorHex} strokeWidth={2.3} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: colorHex, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {title.trim() || 'Setup Preview'}
                </span>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}>
              {/* Color Swatches */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                  Theme Accent Color
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {PLAYBOOK_COLORS.map(c => {
                    const isSelected = colorHex.toLowerCase() === c.hex.toLowerCase();
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setColorHex(c.hex)}
                        title={c.label}
                        aria-label={`Select color ${c.label}`}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: c.hex,
                          border: isSelected ? '2px solid var(--text-primary)' : '2px solid transparent',
                          outline: isSelected ? `2px solid ${c.hex}` : 'none',
                          outlineOffset: 1,
                          cursor: 'pointer',
                          transition: 'transform 0.15s',
                          transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                          padding: 0,
                          flexShrink: 0
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Lucide Icons Grid */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                  Setup Icon ({PLAYBOOK_ICONS.length} Lucide Icons)
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(12, 1fr)',
                  gap: 4
                }}>
                  {PLAYBOOK_ICONS.map(ic => {
                    const isSelected = icon === ic.name;
                    return (
                      <button
                        key={ic.name}
                        type="button"
                        onClick={() => setIcon(ic.name)}
                        title={ic.label}
                        aria-label={`Select icon ${ic.label}`}
                        style={{
                          height: 30,
                          borderRadius: 6,
                          border: isSelected
                            ? `1.5px solid ${colorHex}`
                            : '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
                          background: isSelected
                            ? `color-mix(in srgb, ${colorHex} 18%, var(--bg-card))`
                            : 'var(--bg-card)',
                          color: isSelected ? colorHex : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 40%, transparent)';
                            e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 6%, var(--bg-card))';
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 20%, transparent)';
                            e.currentTarget.style.background = 'var(--bg-card)';
                          }
                        }}
                      >
                        <PlaybookIconView name={ic.name} size={15} color={isSelected ? colorHex : 'var(--text-secondary)'} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Strategy Type & Segments */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="builder-strategy-type" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                Strategy Archetype
              </label>
              <select
                id="builder-strategy-type"
                name="strategyType"
                value={strategyType}
                onChange={e => setStrategyType(e.target.value)}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                  background: 'var(--bg-surface)',
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
              >
                {STRATEGY_TYPES.map(st => (
                  <option key={st.key} value={st.key}>{st.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                Applicable Segments
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {SEGMENTS_LIST.map(seg => {
                  const isChecked = segments.includes(seg);
                  return (
                    <button
                      key={seg}
                      type="button"
                      onClick={() => toggleSegment(seg)}
                      style={{
                        padding: '4px 9px',
                        borderRadius: 6,
                        border: isChecked
                          ? '1px solid color-mix(in srgb, var(--border-color) 45%, transparent)'
                          : '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
                        background: isChecked
                          ? 'color-mix(in srgb, var(--text-primary) 10%, var(--bg-surface))'
                          : 'var(--bg-surface)',
                        color: isChecked ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontSize: 10.5,
                        fontWeight: isChecked ? 600 : 450,
                        cursor: 'pointer',
                        transition: 'all 0.18s ease'
                      }}
                    >
                      {seg}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Targets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="builder-target-winrate" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                Target Win Rate (%)
              </label>
              <input
                id="builder-target-winrate"
                name="targetWinRate"
                type="number"
                min={1}
                max={100}
                value={targetWinRate}
                onChange={e => setTargetWinRate(e.target.value)}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                  background: 'var(--bg-surface)',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label htmlFor="builder-target-rr" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                Target Risk : Reward (e.g. 2.5R)
              </label>
              <input
                id="builder-target-rr"
                name="targetRiskReward"
                type="number"
                step="0.1"
                min={0.5}
                value={targetRiskReward}
                onChange={e => setTargetRiskReward(e.target.value)}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                  background: 'var(--bg-surface)',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="builder-description" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
              Setup Description & Edge
            </label>
            <textarea
              id="builder-description"
              name="description"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What market imbalance or structural edge does this setup exploit?..."
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                background: 'var(--bg-surface)',
                fontSize: 12.5,
                fontWeight: 450,
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Strategy Methodology & Timeframe (Inspired by ProfessionalStrategyBuilder) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="builder-methodology" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                Analysis Methodology
              </label>
              <select
                id="builder-methodology"
                name="methodology"
                value={methodology}
                onChange={e => setMethodology(e.target.value)}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                  background: 'var(--bg-surface)',
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
              >
                <option value="Technical">Technical (Price Action / Charts)</option>
                <option value="Quantitative">Quantitative (Order Flow &amp; Delta)</option>
                <option value="Momentum">Momentum / Breakout</option>
                <option value="Fundamental">Fundamental / Catalyst</option>
                <option value="Hybrid">Hybrid Multi-Factor</option>
              </select>
            </div>

            <div>
              <label htmlFor="builder-timeframe" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                Primary Timeframe
              </label>
              <select
                id="builder-timeframe"
                name="primaryTimeframe"
                value={primaryTimeframe}
                onChange={e => setPrimaryTimeframe(e.target.value)}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                  background: 'var(--bg-surface)',
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
              >
                <option value="1m">1-Minute Scalp</option>
                <option value="3m">3-Minute</option>
                <option value="5m">5-Minute Intraday</option>
                <option value="15m">15-Minute Swing/Intraday</option>
                <option value="1H">1-Hour Swing</option>
                <option value="Daily">Daily Positional</option>
              </select>
            </div>
          </div>

          {/* Risk Management Configuration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="builder-position-sizing" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                Position Sizing
              </label>
              <select
                id="builder-position-sizing"
                name="positionSizing"
                value={positionSizing}
                onChange={e => setPositionSizing(e.target.value)}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                  background: 'var(--bg-surface)',
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
              >
                <option value="1% Account Risk">1% Capital Risk per Trade</option>
                <option value="2% Account Risk">2% Capital Risk per Trade</option>
                <option value="Volatility (ATR) Based">Volatility / ATR Dynamic Sizing</option>
                <option value="Fixed Lot">Fixed Lot Size</option>
              </select>
            </div>

            <div>
              <label htmlFor="builder-stoploss-rule" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                Stop Loss Discipline
              </label>
              <select
                id="builder-stoploss-rule"
                name="stopLossRule"
                value={stopLossRule}
                onChange={e => setStopLossRule(e.target.value)}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                  background: 'var(--bg-surface)',
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
              >
                <option value="Technical Swing High/Low">Technical Swing High / Low</option>
                <option value="1.5x ATR Buffer">1.5x - 2.0x ATR Volatility Buffer</option>
                <option value="Fixed % Stop">Fixed % Loss Cutoff</option>
                <option value="VWAP Anchor">VWAP Benchmark Invalidation</option>
              </select>
            </div>
          </div>

          {/* Initial Rule Groups Builder */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-muted)' }}>
                Checklist Rules Builder
              </span>
              <button
                type="button"
                onClick={() => setIsAddingGroup(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 11.5,
                  fontWeight: 550,
                  cursor: 'pointer'
                }}
              >
                + Add Rule Group
              </button>
            </div>

            {/* Inline Group Creation Banner */}
            {isAddingGroup && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 10,
                padding: '8px 10px',
                background: 'var(--bg-surface)',
                borderRadius: 8,
                border: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
                borderLeft: '3px solid var(--text-primary)'
              }}>
                <input
                  autoFocus
                  id="builder-new-group-title"
                  name="builderNewGroupTitle"
                  value={newGroupTitleInput}
                  onChange={e => setNewGroupTitleInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleConfirmAddGroup();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsAddingGroup(false);
                      setNewGroupTitleInput('');
                    }
                  }}
                  placeholder="Group name (e.g. Market Conditions, Disqualifiers)..."
                  style={{
                    flex: 1,
                    height: 30,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                    background: 'var(--bg-card)',
                    fontSize: 12,
                    fontWeight: 450,
                    color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={handleConfirmAddGroup}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
                    background: 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))',
                    color: 'var(--text-primary)',
                    fontSize: 11.5,
                    fontWeight: 550,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 13%, var(--bg-surface))'}
                  onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))'}
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAddingGroup(false); setNewGroupTitleInput(''); }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: 11.5,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ruleGroups.map(group => (
                <div
                  key={group.id}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
                    borderRadius: 8,
                    padding: 10
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    {group.title}
                  </div>

                  {/* List of rules */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                    {(group.rules || []).map(r => (
                      <div
                        key={r.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          fontSize: 11.5,
                          padding: '4px 8px',
                          background: 'var(--bg-primary)',
                          border: '1px solid color-mix(in srgb, var(--border-color) 15%, transparent)',
                          borderRadius: 6
                        }}
                      >
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 450 }}>• {r.text}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(group.id, r.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2, display: 'flex' }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add rule input row */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      value={newRuleTexts[group.id] || ''}
                      onChange={e => setNewRuleTexts({ ...newRuleTexts, [group.id]: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddRuleToGroup(group.id);
                        }
                      }}
                      placeholder={`Add rule to ${group.title}...`}
                      style={{
                        flex: 1,
                        height: 30,
                        padding: '0 8px',
                        borderRadius: 6,
                        border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                        background: 'var(--bg-card)',
                        fontSize: 11.5,
                        fontWeight: 450,
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddRuleToGroup(group.id)}
                      style={{
                        padding: '0 12px',
                        borderRadius: 6,
                        border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
                        background: 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))',
                        color: 'var(--text-primary)',
                        fontSize: 11,
                        fontWeight: 550,
                        cursor: 'pointer',
                        transition: 'all 0.18s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 13%, var(--bg-surface))'}
                      onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))'}
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          </div>

          {/* Sticky Form Actions Footer */}
          <div style={{
            padding: '14px 22px',
            borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
            background: 'var(--bg-card)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            flexShrink: 0
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
                background: 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 550,
                cursor: 'pointer',
                transition: 'all 0.18s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 13%, var(--bg-surface))'}
              onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))'}
            >
              {isEdit ? 'Save Changes' : 'Create Playbook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
