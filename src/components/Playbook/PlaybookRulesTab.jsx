import React, { useState, useMemo } from 'react';
import {
  GripVertical,
  Plus,
  MoreVertical,
  Trash2,
  Edit2,
  Check,
  X,
  Sparkles,
  Info,
  Layers
} from 'lucide-react';
import {
  calculateRuleAnalytics,
  genRuleId,
  genGroupId,
  getPlaybookTrades
} from '../../services/playbookService';

export default function PlaybookRulesTab({
  playbook,
  allTrades = [],
  tradeAudits = {},
  settings = null,
  onUpdatePlaybook
}) {
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState(null);
  const [ruleTextInput, setRuleTextInput] = useState('');
  const [ruleIsRequired, setRuleIsRequired] = useState(true);

  const [activeMenuRuleId, setActiveMenuRuleId] = useState(null);

  // Inline group creation state (replaces browser prompt())
  const [showAddGroupInput, setShowAddGroupInput] = useState(false);
  const [addGroupTitleInput, setAddGroupTitleInput] = useState('');

  // Inline delete confirmation state (replaces browser confirm())
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState(null);

  // Playbook trades for rule compliance calculation using unified binding
  const pbTrades = useMemo(() => {
    return getPlaybookTrades(playbook, allTrades, tradeAudits, settings);
  }, [allTrades, tradeAudits, playbook, settings]);

  const groups = playbook.ruleGroups || [];

  // Group Handlers
  const handleAddGroup = () => {
    setAddGroupTitleInput('');
    setShowAddGroupInput(true);
  };

  const handleConfirmAddGroup = () => {
    if (!addGroupTitleInput.trim()) return;
    const newGroup = {
      id: genGroupId(),
      title: addGroupTitleInput.trim(),
      rules: []
    };
    const updated = {
      ...playbook,
      ruleGroups: [...groups, newGroup],
      updatedAt: new Date().toISOString()
    };
    onUpdatePlaybook(updated);
    setShowAddGroupInput(false);
    setAddGroupTitleInput('');
  };

  const handleDeleteGroup = (groupId) => {
    setConfirmDeleteGroupId(groupId);
  };

  const handleConfirmDeleteGroup = () => {
    if (!confirmDeleteGroupId) return;
    const updated = {
      ...playbook,
      ruleGroups: groups.filter(g => g.id !== confirmDeleteGroupId),
      updatedAt: new Date().toISOString()
    };
    onUpdatePlaybook(updated);
    setConfirmDeleteGroupId(null);
  };

  const handleRenameGroup = (groupId, newTitle) => {
    if (!newTitle.trim()) return;
    const updated = {
      ...playbook,
      ruleGroups: groups.map(g => g.id === groupId ? { ...g, title: newTitle.trim() } : g),
      updatedAt: new Date().toISOString()
    };
    onUpdatePlaybook(updated);
    setEditingGroupId(null);
  };

  // Rule Handlers
  const handleOpenAddRule = (groupId) => {
    setTargetGroupId(groupId);
    setRuleTextInput('');
    setRuleIsRequired(true);
    setShowAddRuleModal(true);
  };

  const handleSaveRule = () => {
    if (!ruleTextInput.trim() || !targetGroupId) return;
    const newRule = {
      id: genRuleId(),
      text: ruleTextInput.trim(),
      isRequired: ruleIsRequired
    };

    const updated = {
      ...playbook,
      ruleGroups: groups.map(g => {
        if (g.id === targetGroupId) {
          return { ...g, rules: [...(g.rules || []), newRule] };
        }
        return g;
      }),
      updatedAt: new Date().toISOString()
    };

    onUpdatePlaybook(updated);
    setShowAddRuleModal(false);
  };

  const handleDeleteRule = (groupId, ruleId) => {
    const updated = {
      ...playbook,
      ruleGroups: groups.map(g => {
        if (g.id === groupId) {
          return { ...g, rules: (g.rules || []).filter(r => r.id !== ruleId) };
        }
        return g;
      }),
      updatedAt: new Date().toISOString()
    };
    onUpdatePlaybook(updated);
    setActiveMenuRuleId(null);
  };

  const indianRulePresets = [
    'RVOL > 2.0 on 5-minute breakout candle',
    'Price above session VWAP and 20 EMA',
    'India VIX between 13.0 and 20.0',
    'NIFTY 50 and Sector Index trend alignment',
    'No entry within 30 min of RBI Policy / Budget announcement',
    'Target 1:2 Risk:Reward booked mechanically',
    'Trailing stop loss moved to breakeven after Target 1',
    'Hard stop loss strictly at prior swing pivot'
  ];

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    const sign = num < 0 ? '-' : num > 0 ? '+' : '';
    return `${sign}₹${Math.abs(num).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top action row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Execution Criteria & Quantified Compliance
          </span>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            Every rule is tracked against your live trade journal to reveal which rules drive profits and which cause leaks.
          </p>
        </div>

        <button
          onClick={handleAddGroup}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            borderRadius: 8,
            border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
            background: 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))',
            color: 'var(--text-primary)',
            fontSize: 12,
            fontWeight: 550,
            cursor: 'pointer',
            transition: 'all 0.18s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 12%, var(--bg-surface))'}
          onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))'}
        >
          <Plus size={13} />
          <span>Create Group</span>
        </button>
      </div>

      {/* ── Inline: Create Group Input ──────────────────────── */}
      {showAddGroupInput && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          background: 'var(--bg-surface)',
          border: '1px solid color-mix(in srgb, var(--border-color) 70%, transparent)',
          borderRadius: 10,
          borderLeft: '3px solid var(--text-primary)'
        }}>
          <input
            autoFocus
            placeholder="Group name — e.g. Entry Rules, Exit Rules, Market Conditions"
            value={addGroupTitleInput}
            onChange={e => setAddGroupTitleInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleConfirmAddGroup();
              if (e.key === 'Escape') { setShowAddGroupInput(false); setAddGroupTitleInput(''); }
            }}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: 12.5,
              outline: 'none'
            }}
          />
          <button
            onClick={handleConfirmAddGroup}
            style={{
              padding: '6px 14px', borderRadius: 7,
              border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
              background: 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))',
              color: 'var(--text-primary)',
              fontSize: 12, fontWeight: 550, cursor: 'pointer',
              transition: 'all 0.18s ease'
            }}
          >
            <Check size={13} />
          </button>
          <button
            onClick={() => { setShowAddGroupInput(false); setAddGroupTitleInput(''); }}
            style={{
              padding: '6px 10px', borderRadius: 7,
              border: '1px solid var(--border-color)',
              background: 'transparent', color: 'var(--text-muted)',
              fontSize: 12, cursor: 'pointer'
            }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Inline: Delete Group Confirmation ──────────────── */}
      {confirmDeleteGroupId && (() => {
        const gTitle = groups.find(g => g.id === confirmDeleteGroupId)?.title || 'this group';
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 16px',
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10,
            borderLeft: '3px solid #ef4444'
          }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>
              Delete group <strong>"{gTitle}"</strong> and all its rules?
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleConfirmDeleteGroup}
                style={{
                  padding: '5px 14px', borderRadius: 7, border: 'none',
                  background: '#ef4444', color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer'
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDeleteGroupId(null)}
                style={{
                  padding: '5px 12px', borderRadius: 7,
                  border: '1px solid var(--border-color)',
                  background: 'transparent', color: 'var(--text-muted)',
                  fontSize: 12, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })()}

      {/* Rule Groups matching Image 4 */}
      {groups.length === 0 ? (
        <div style={{
          padding: '48px 24px',
          textAlign: 'center',
          background: 'var(--bg-surface)',
          borderRadius: 10,
          border: '1px dashed var(--border-color)'
        }}>
          <Layers size={32} style={{ color: 'var(--text-muted)', marginBottom: 10, opacity: 0.5 }} />
          <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>No Rule Groups Defined</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Create groups like Entry Rules, Exit Rules, and Market Conditions to start auditing discipline.
          </p>
          <button
            onClick={handleAddGroup}
            style={{
              padding: '7px 16px',
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
              background: 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 550,
              cursor: 'pointer',
              transition: 'all 0.18s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 12%, var(--bg-surface))'}
            onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))'}
          >
            + Add First Group
          </button>
        </div>
      ) : (
        groups.map(group => (
          <div
            key={group.id}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
              borderRadius: 12,
              overflow: 'hidden'
            }}
          >
            {/* Group Header */}
            <div style={{
              padding: '12px 18px',
              background: 'var(--bg-card)',
              borderBottom: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <GripVertical size={14} color="var(--text-muted)" style={{ cursor: 'grab', opacity: 0.4 }} />
                {editingGroupId === group.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      autoFocus
                      value={newGroupTitle}
                      onChange={e => setNewGroupTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameGroup(group.id, newGroupTitle);
                        if (e.key === 'Escape') setEditingGroupId(null);
                      }}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
                        background: 'var(--bg-primary)',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={() => handleRenameGroup(group.id, newGroupTitle)}
                      style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', display: 'flex' }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingGroupId(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {group.title}
                  </span>
                )}

                {editingGroupId !== group.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
                    <button
                      onClick={() => {
                        setEditingGroupId(group.id);
                        setNewGroupTitle(group.title);
                      }}
                      title="Rename Group"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        padding: 3,
                        opacity: 0.6
                      }}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      title="Delete Group"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        display: 'flex',
                        padding: 3,
                        opacity: 0.6
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                {(group.rules || []).length} criteria
              </span>
            </div>

            {/* Table of Rules */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
                    background: 'var(--bg-primary)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.02em'
                  }}>
                    <th style={{ padding: '10px 18px', width: '45%' }}>Rule Name</th>
                    <th style={{ padding: '10px 14px', width: '15%' }}>Follow Rate</th>
                    <th style={{ padding: '10px 14px', width: '15%' }}>Net P&L</th>
                    <th style={{ padding: '10px 14px', width: '12%' }}>Profit Factor</th>
                    <th style={{ padding: '10px 14px', width: '10%' }}>Win Rate</th>
                    <th style={{ padding: '10px 14px', width: '3%', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(group.rules || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                        No criteria in this group yet. Click below to add a rule.
                      </td>
                    </tr>
                  ) : (
                    group.rules.map(rule => {
                      const stats = calculateRuleAnalytics(rule, pbTrades, tradeAudits);
                      const followRateColor = stats.followRate >= 90 ? '#10b981' : stats.followRate >= 60 ? '#f59e0b' : '#ef4444';
                      const pnlColor = stats.netPnL > 0 ? '#10b981' : stats.netPnL < 0 ? '#ef4444' : 'var(--text-muted)';

                      return (
                        <tr
                          key={rule.id}
                          style={{
                            borderBottom: '1px solid color-mix(in srgb, var(--border-color) 18%, transparent)',
                            fontSize: 12.5,
                            transition: 'background 0.1s ease'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {/* Rule Name */}
                          <td style={{ padding: '12px 18px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <GripVertical size={13} color="var(--text-muted)" style={{ cursor: 'grab', opacity: 0.35 }} />
                              <span style={{ fontWeight: 450, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                                {rule.text}
                              </span>
                              {rule.isRequired && (
                                <span style={{
                                  fontSize: 9.5,
                                  fontWeight: 500,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  background: 'var(--bg-primary)',
                                  border: '1px solid color-mix(in srgb, var(--border-color) 30%, transparent)',
                                  color: 'var(--text-muted)',
                                  textTransform: 'uppercase'
                                }}>
                                  Req
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Follow Rate % */}
                          <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                            <span style={{
                              fontWeight: 600,
                              fontFamily: 'var(--font-mono)',
                              color: followRateColor,
                              fontSize: 12.5
                            }}>
                              {stats.followRate}%
                            </span>
                          </td>

                          {/* Net Profit / Loss */}
                          <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                            <span style={{
                              fontWeight: 500,
                              fontFamily: 'var(--font-mono)',
                              color: pnlColor,
                              fontSize: 12.5
                            }}>
                              {formatCurrency(stats.netPnL)}
                            </span>
                          </td>

                          {/* Profit Factor */}
                          <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                            <span style={{
                              fontWeight: 500,
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-primary)',
                              fontSize: 12.5
                            }}>
                              {stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : 'N/A'}
                            </span>
                          </td>

                          {/* Win Rate */}
                          <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                            <span style={{
                              fontWeight: 500,
                              fontFamily: 'var(--font-mono)',
                              color: stats.winRate >= 50 ? '#10b981' : 'var(--text-muted)',
                              fontSize: 12.5
                            }}>
                              {stats.executedCount > 0 ? `${stats.winRate.toFixed(1)}%` : '—'}
                            </span>
                          </td>

                          {/* Action */}
                          <td style={{ padding: '12px 14px', verticalAlign: 'middle', textAlign: 'center', position: 'relative' }}>
                            <button
                              onClick={() => setActiveMenuRuleId(activeMenuRuleId === rule.id ? null : rule.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: 4,
                                display: 'flex',
                                borderRadius: 4,
                                opacity: 0.6
                              }}
                            >
                              <MoreVertical size={14} />
                            </button>

                            {activeMenuRuleId === rule.id && (
                              <div style={{
                                position: 'absolute',
                                right: 14,
                                top: '80%',
                                zIndex: 100,
                                background: 'var(--bg-card)',
                                border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
                                borderRadius: 8,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                padding: 4,
                                minWidth: 120
                              }}>
                                <button
                                  onClick={() => handleDeleteRule(group.id, rule.id)}
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 10px',
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    borderRadius: 6
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                  <Trash2 size={12} />
                                  <span>Delete Rule</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom + Create new rule button */}
            <div style={{ padding: '10px 18px', borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)' }}>
              <button
                onClick={() => handleOpenAddRule(group.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '4px 0'
                }}
              >
                <Plus size={13} strokeWidth={2} />
                <span>Create new rule</span>
              </button>
            </div>
          </div>
        ))
      )}

      {/* ── Modal to Add Rule ─────────────────────────────────────────────── */}
      {showAddRuleModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            width: '100%',
            maxWidth: 520,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                Add Checklist Rule
              </span>
              <button
                onClick={() => setShowAddRuleModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                RULE CRITERIA TEXT
              </label>
              <textarea
                autoFocus
                rows={3}
                value={ruleTextInput}
                onChange={e => setRuleTextInput(e.target.value)}
                placeholder="e.g. 5m breakout candle closes above VWAP on RVOL > 2.0..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Quick Presets */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                <Sparkles size={12} color="#10b981" />
                <span>QUICK INDIAN MARKET PRESETS:</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 110, overflowY: 'auto' }}>
                {indianRulePresets.map(preset => (
                  <button
                    key={preset}
                    onClick={() => setRuleTextInput(preset)}
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '4px 8px',
                      borderRadius: 6,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Required Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input
                type="checkbox"
                id="isRuleRequired"
                checked={ruleIsRequired}
                onChange={e => setRuleIsRequired(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--text-primary)', cursor: 'pointer' }}
              />
              <label htmlFor="isRuleRequired" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                Mark as Mandatory / Required Rule
              </label>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => setShowAddRuleModal(false)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                disabled={!ruleTextInput.trim()}
                style={{
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: ruleTextInput.trim() ? 'var(--text-primary)' : 'var(--border-color)',
                  color: 'var(--bg-card)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: ruleTextInput.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Add Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
