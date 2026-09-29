import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  CheckSquare,
  Square
} from 'lucide-react';
import SymbolLogo from '../SymbolLogo';
import { getTradePnL } from '../../services/playbookService';

export default function TradeAuditorModal({
  isOpen,
  onClose,
  trade,
  allTrades = [],
  allPlaybooks = [],
  tradeAudits = {},
  defaultPlaybookId = null,
  onSaveAudit,
  onUpdateTrade = null
}) {
  const [currentTradeId, setCurrentTradeId] = useState(trade?.id || allTrades[0]?.id || null);

  useEffect(() => {
    if (trade?.id) {
      setCurrentTradeId(trade.id);
    } else if (allTrades.length > 0) {
      setCurrentTradeId(allTrades[0].id);
    }
  }, [trade, allTrades]);

  const activeTrade = useMemo(() => {
    if (trade && trade.id === currentTradeId) return trade;
    return allTrades.find(t => t.id === currentTradeId) || trade || allTrades[0] || null;
  }, [trade, currentTradeId, allTrades]);

  const existingAudit = useMemo(() => {
    if (!activeTrade) return null;
    return tradeAudits[activeTrade.id] || null;
  }, [activeTrade, tradeAudits]);

  const [selectedPlaybookId, setSelectedPlaybookId] = useState(
    existingAudit?.playbookId || activeTrade?.playbookId || defaultPlaybookId || allPlaybooks[0]?.id || ''
  );
  const [isNoSetup, setIsNoSetup] = useState(
    existingAudit?.isNoSetup ?? activeTrade?.isNoSetup ?? false
  );
  const [ruleExecutions, setRuleExecutions] = useState(
    existingAudit?.ruleExecutions || {}
  );
  const [comment, setComment] = useState(existingAudit?.comment || '');

  // Synchronize states when active trade changes
  useEffect(() => {
    if (!activeTrade) return;
    const audit = tradeAudits[activeTrade.id] || null;
    const initialPbId = audit?.playbookId || activeTrade.playbookId || defaultPlaybookId || allPlaybooks[0]?.id || '';
    setSelectedPlaybookId(initialPbId);
    setIsNoSetup(audit?.isNoSetup ?? activeTrade.isNoSetup ?? false);
    setComment(audit?.comment || '');

    // Pre-populate all rules for the active playbook so audit is never empty
    const pb = allPlaybooks.find(p => p.id === initialPbId) || allPlaybooks[0];
    const targetRules = [];
    pb?.ruleGroups?.forEach(g => {
      (g.rules || []).forEach(r => targetRules.push(r));
    });

    const initialExecutions = {};
    targetRules.forEach(r => {
      if (audit?.ruleExecutions?.[r.id] !== undefined) {
        initialExecutions[r.id] = audit.ruleExecutions[r.id];
      } else {
        initialExecutions[r.id] = { isFollowed: true };
      }
    });
    setRuleExecutions(initialExecutions);
  }, [activeTrade?.id, defaultPlaybookId, allPlaybooks]);

  const activePlaybook = allPlaybooks.find(p => p.id === selectedPlaybookId) || null;

  // Flatten all rules from the active playbook
  const allRules = useMemo(() => {
    if (!activePlaybook?.ruleGroups) return [];
    const flat = [];
    activePlaybook.ruleGroups.forEach(g => {
      (g.rules || []).forEach(r => {
        flat.push({ ...r, groupTitle: g.title });
      });
    });
    return flat;
  }, [activePlaybook]);

  // If new playbook selected, ensure all rules have a followed status
  useEffect(() => {
    if (allRules.length > 0) {
      setRuleExecutions(prev => {
        const next = { ...prev };
        allRules.forEach(r => {
          if (next[r.id] === undefined) {
            next[r.id] = { isFollowed: true };
          }
        });
        return next;
      });
    }
  }, [selectedPlaybookId, allRules]);

  const toggleRule = (ruleId) => {
    setRuleExecutions(prev => {
      const current = prev[ruleId]?.isFollowed ?? true;
      return {
        ...prev,
        [ruleId]: { ...prev[ruleId], isFollowed: !current }
      };
    });
  };

  // Live discipline score calculation
  const disciplineScore = useMemo(() => {
    if (isNoSetup) return 0;
    if (allRules.length === 0) return 100;
    let followed = 0;
    allRules.forEach(r => {
      // Use same ?? true default as the rendering (line ~386) so score matches visual state
      if (ruleExecutions[r.id]?.isFollowed ?? true) followed++;
    });
    return Math.round((followed / allRules.length) * 100);
  }, [allRules, ruleExecutions, isNoSetup]);

  const handleSave = () => {
    if (!activeTrade) return;

    // Build complete rule executions mapping for every rule in active playbook
    const finalRuleExecutions = {};
    if (!isNoSetup) {
      allRules.forEach(r => {
        finalRuleExecutions[r.id] = ruleExecutions[r.id] || { isFollowed: true };
      });
    }

    const audit = {
      tradeId: activeTrade.id,
      playbookId: isNoSetup ? null : selectedPlaybookId,
      isNoSetup,
      ruleExecutions: finalRuleExecutions,
      disciplineScore,
      comment: comment.trim(),
      auditedAt: new Date().toISOString()
    };

    onSaveAudit(activeTrade.id, audit);

    // Synchronize playbookId and setup to trade object if onUpdateTrade provided
    if (onUpdateTrade) {
      if (isNoSetup) {
        onUpdateTrade(activeTrade.id, 'playbookId', null);
      } else if (selectedPlaybookId) {
        onUpdateTrade(activeTrade.id, 'playbookId', selectedPlaybookId);
        if (activePlaybook?.title) {
          onUpdateTrade(activeTrade.id, 'setup', activePlaybook.title);
        }
      }
    }

    onClose();
  };

  if (!isOpen || !activeTrade) return null;

  const pnl = getTradePnL(activeTrade);
  const isProfit = pnl >= 0;

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
        maxWidth: 620,
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
          padding: '16px 20px',
          borderBottom: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              Trade Rule Execution Audit
            </span>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Verify whether you followed your setup criteria on this execution.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', opacity: 0.7 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div style={{
          padding: '18px 20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          flex: 1
        }}>
          {/* Trade Selector & Context Card */}
          <div style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: 'var(--bg-surface)',
            border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            {allTrades.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 8, borderBottom: '1px solid color-mix(in srgb, var(--border-color) 18%, transparent)' }}>
                <label htmlFor="auditor-trade-select" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-muted)' }}>
                  Select Trade to Audit
                </label>
                <select
                  id="auditor-trade-select"
                  name="tradeId"
                  value={activeTrade.id}
                  onChange={e => setCurrentTradeId(e.target.value)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: 11.5,
                    fontWeight: 500,
                    padding: '3px 8px',
                    cursor: 'pointer',
                    maxWidth: 280
                  }}
                >
                  {allTrades.map(t => {
                    const tPnl = getTradePnL(t);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.date || t.entryDate} • {t.name || t.symbol} ({tPnl >= 0 ? '+' : ''}₹{Math.round(tPnl)})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <SymbolLogo symbol={activeTrade.name || activeTrade.symbol} size={24} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {activeTrade.name || activeTrade.symbol}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {activeTrade.date || activeTrade.entryDate} &bull; {activeTrade.type || 'BUY'} &bull; {activeTrade.qty || 1} Qty
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-muted)' }}>
                  Realized P&L
                </div>
                <div style={{
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  color: isProfit ? '#10b981' : '#ef4444'
                }}>
                  {pnl >= 0 ? '+' : ''}₹{pnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

        {/* Playbook / Impulse Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label htmlFor="auditor-playbook-select" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-muted)' }}>
              Playbook Assignment
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                id="isNoSetupCheck"
                name="isNoSetup"
                checked={isNoSetup}
                onChange={e => setIsNoSetup(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: '#ef4444', cursor: 'pointer' }}
              />
              <label htmlFor="isNoSetupCheck" style={{ fontSize: 11.5, fontWeight: 600, color: '#ef4444', cursor: 'pointer' }}>
                Mark as "No Setup / Impulse Trade"
              </label>
            </div>
          </div>

          {!isNoSetup && (
            <select
              id="auditor-playbook-select"
              name="playbookId"
              value={selectedPlaybookId}
              onChange={e => setSelectedPlaybookId(e.target.value)}
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
              {allPlaybooks.map(pb => (
                <option key={pb.id} value={pb.id}>
                  {pb.title} ({pb.strategyType})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Live Discipline Score Banner */}
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          background: isNoSetup ? 'rgba(239,68,68,0.05)' : disciplineScore >= 100 ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.05)',
          border: isNoSetup ? '1px solid rgba(239,68,68,0.2)' : disciplineScore >= 100 ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(245,158,11,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {disciplineScore >= 100 && !isNoSetup ? (
              <ShieldCheck size={18} color="#10b981" />
            ) : (
              <ShieldAlert size={18} color={isNoSetup ? '#ef4444' : '#f59e0b'} />
            )}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {isNoSetup ? 'Impulse Execution (0% Discipline)' : disciplineScore === 100 ? 'Flawless Discipline (100%)' : 'Compromised Execution'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {isNoSetup
                  ? 'Trade was taken without a defined setup. Counts toward Undisciplined Bleed.'
                  : `${disciplineScore}% checklist compliance score recorded for analytics.`}
              </div>
            </div>
          </div>

          <div style={{
            fontSize: 18,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: isNoSetup ? '#ef4444' : disciplineScore >= 100 ? '#10b981' : '#f59e0b'
          }}>
            {disciplineScore}%
          </div>
        </div>

        {/* Checklist Items */}
        {!isNoSetup && activePlaybook && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-muted)' }}>
              Checklist Criteria (Click to toggle followed vs violated)
            </span>

            {(activePlaybook.ruleGroups || []).map(group => (
              <div
                key={group.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                  borderRadius: 10,
                  overflow: 'hidden'
                }}
              >
                <div style={{
                  padding: '8px 14px',
                  background: 'var(--bg-primary)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)'
                }}>
                  {group.title}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {(group.rules || []).map(rule => {
                    const isFollowed = ruleExecutions[rule.id]?.isFollowed ?? true;
                    return (
                      <div
                        key={rule.id}
                        onClick={() => toggleRule(rule.id)}
                        style={{
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          cursor: 'pointer',
                          borderBottom: '1px solid color-mix(in srgb, var(--border-color) 18%, transparent)',
                          background: isFollowed ? 'transparent' : 'rgba(239,68,68,0.03)',
                          transition: 'background 0.12s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                          <div style={{
                            width: 17,
                            height: 17,
                            borderRadius: 4,
                            border: isFollowed ? '1px solid #10b981' : '1px solid #ef4444',
                            background: isFollowed ? '#10b981' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            flexShrink: 0
                          }}>
                            {isFollowed ? <Check size={11} strokeWidth={2.5} /> : <X size={11} color="#ef4444" strokeWidth={2.5} />}
                          </div>
                          <span style={{
                            fontSize: 12.5,
                            fontWeight: 450,
                            color: isFollowed ? 'var(--text-primary)' : '#ef4444',
                            lineHeight: 1.4
                          }}>
                            {rule.text}
                          </span>
                        </div>

                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 500,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: isFollowed ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                          color: isFollowed ? '#059669' : '#dc2626'
                        }}>
                          {isFollowed ? 'Followed' : 'Violated'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Commentary */}
        <div>
          <label htmlFor="auditor-comment-input" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
            Audit Notes &amp; Psychology Lessons
          </label>
          <textarea
            id="auditor-comment-input"
            name="auditComment"
            rows={2}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="e.g. Followed all entry rules, but exited 5 minutes too early before 2R target..."
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
              background: 'var(--bg-surface)',
              fontSize: 12.5,
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              boxSizing: 'border-box'
            }}
          />
        </div>

        </div>

        {/* Sticky Footer Actions */}
        <div style={{
          padding: '12px 20px',
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
            type="button"
            onClick={handleSave}
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
            Save Audit
          </button>
        </div>
      </div>
    </div>
  );
}
