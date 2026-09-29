import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronDown,
  Plus,
  Share2,
  Settings,
  BookOpen,
  Target,
  ListOrdered,
  Layers,
  StickyNote,
  CheckSquare,
  ArrowLeft,
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';
import PlaybookLibraryGrid from './PlaybookLibraryGrid';
import PlaybookOverviewTab from './PlaybookOverviewTab';
import PlaybookRulesTab from './PlaybookRulesTab';
import PlaybookExecutedTradesTab from './PlaybookExecutedTradesTab';
import PlaybookMissedTradesTab from './PlaybookMissedTradesTab';
import PlaybookNotesTab from './PlaybookNotesTab';
import PlaybookScratchpad from './PlaybookScratchpad';
import PlaybookBuilderModal from './PlaybookBuilderModal';
import TradeAuditorModal from './TradeAuditorModal';
import PlaybookSidebar from './PlaybookSidebar';
import PlaybookIcon from './PlaybookIcon';
import {
  loadPlaybooks,
  savePlaybooks,
  loadTradeAudits,
  saveTradeAudits,
  loadMissedTrades,
  saveMissedTrades,
  loadPlaybookSettings,
  savePlaybookSettings,
  DEFAULT_PLAYBOOK_SETTINGS,
  DEFAULT_PLAYBOOKS
} from '../../services/playbookService';

export default function PlaybookEngine({
  trades = [],
  user = null,
  onTogglePlaybook,
  initialPlaybookId = null,
  onSelectPlaybookId = null,
  onOpenStockChart = null,
  onUpdateTrade = null
}) {
  // Master persistent state
  const [playbooks, setPlaybooks] = useState(() => loadPlaybooks());
  const [tradeAudits, setTradeAudits] = useState(() => loadTradeAudits());
  const [missedTrades, setMissedTrades] = useState(() => loadMissedTrades());
  const [playbookSettings, setPlaybookSettings] = useState(() => loadPlaybookSettings());

  const handleUpdatePlaybookSetting = useCallback((key, val) => {
    setPlaybookSettings(prev => {
      const next = { ...prev, [key]: val };
      savePlaybookSettings(next, user);
      return next;
    });
  }, [user]);

  const handleResetPlaybookSettings = useCallback(() => {
    setPlaybookSettings(DEFAULT_PLAYBOOK_SETTINGS);
    savePlaybookSettings(DEFAULT_PLAYBOOK_SETTINGS, user);
  }, [user]);

  const handleImportPlaybooks = useCallback((newPlaybooks) => {
    if (Array.isArray(newPlaybooks) && newPlaybooks.length > 0) {
      setPlaybooks(newPlaybooks);
      savePlaybooks(newPlaybooks, user);
    }
  }, [user]);

  const handleReseedSamplePlaybook = useCallback(() => {
    setPlaybooks(prev => {
      const exists = prev.some(p => p.id === 'pb-sample');
      if (exists) return prev;
      const next = [...prev, ...DEFAULT_PLAYBOOKS];
      savePlaybooks(next, user);
      return next;
    });
  }, [user]);

  // Active navigation state
  const [selectedPlaybookId, setSelectedPlaybookId] = useState(initialPlaybookId);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'rules' | 'executed' | 'missed' | 'notes' | 'scratchpad'

  // Collapsible vertical sidebar state (persisted in localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('foxtrade_playbook_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('foxtrade_playbook_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    if (initialPlaybookId !== undefined && initialPlaybookId !== selectedPlaybookId) {
      setSelectedPlaybookId(initialPlaybookId);
    }
  }, [initialPlaybookId]);

  const handleSelectPlaybook = useCallback((id) => {
    setSelectedPlaybookId(id);
    if (onSelectPlaybookId) {
      onSelectPlaybookId(id);
    }
  }, [onSelectPlaybookId]);

  // Modal dialog states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPlaybookData, setEditingPlaybookData] = useState(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditingTrade, setAuditingTrade] = useState(null);
  const [auditTargetPlaybookId, setAuditTargetPlaybookId] = useState(null);

  // Sync state helpers
  const handleSavePlaybook = useCallback((updatedPb) => {
    setPlaybooks(prev => {
      const exists = prev.some(p => p.id === updatedPb.id);
      const next = exists ? prev.map(p => p.id === updatedPb.id ? updatedPb : p) : [updatedPb, ...prev];
      savePlaybooks(next, user);
      return next;
    });
  }, [user]);

  const handleDeletePlaybook = useCallback((playbookId) => {
    setPlaybooks(prev => {
      const next = prev.filter(p => p.id !== playbookId);
      savePlaybooks(next, user);
      return next;
    });

    // Cascade delete: clean up orphaned audits
    setTradeAudits(prev => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach(tradeId => {
        if (next[tradeId]?.playbookId === playbookId) {
          delete next[tradeId];
          changed = true;
        }
      });
      if (changed) saveTradeAudits(next, user);
      return changed ? next : prev;
    });

    // Cascade delete: clean up orphaned missed trades
    setMissedTrades(prev => {
      const next = prev.filter(m => m.playbookId !== playbookId);
      if (next.length !== prev.length) saveMissedTrades(next, user);
      return next;
    });

    if (selectedPlaybookId === playbookId) {
      handleSelectPlaybook(null);
    }
  }, [user, selectedPlaybookId, handleSelectPlaybook]);

  const handleSaveAudit = useCallback((tradeId, auditData) => {
    setTradeAudits(prev => {
      const next = { ...prev, [tradeId]: auditData };
      saveTradeAudits(next, user);
      return next;
    });
  }, [user]);

  const handleSaveMissedTrades = useCallback((newMissed) => {
    setMissedTrades(newMissed);
    saveMissedTrades(newMissed, user);
  }, [user]);

  const selectedPlaybook = useMemo(() => {
    return playbooks.find(p => p.id === selectedPlaybookId) || null;
  }, [playbooks, selectedPlaybookId]);

  const openAuditModal = (trade = null, playbookId = null) => {
    if (trade) {
      setAuditingTrade(trade);
    } else {
      setAuditingTrade(trades[0] || null);
    }
    setAuditTargetPlaybookId(playbookId || selectedPlaybookId);
    setIsAuditModalOpen(true);
  };

  const TABS = useMemo(() => {
    if (selectedPlaybook?.isNoSetup) {
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'executed', label: 'Impulse Trades' },
        { id: 'notes', label: 'Psychology Lessons' },
        { id: 'scratchpad', label: 'Scratchpad' }
      ];
    }
    return [
      { id: 'overview', label: 'Overview' },
      { id: 'rules', label: 'Playbook Rules' },
      { id: 'executed', label: 'Executed Trades' },
      { id: 'missed', label: 'Missed Trades' },
      { id: 'notes', label: 'Notes' },
      { id: 'scratchpad', label: 'Scratchpad' }
    ];
  }, [selectedPlaybook]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 60px)',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      overflow: 'hidden'
    }}>
      {/* ── Top Navigation Bar (Header) ──────────────────────────────────── */}
      <div style={{
        padding: '14px 24px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        flexShrink: 0
      }}>
        {/* Breadcrumb Navigation (matching TradeZella: Playbook / Morning... / Overview) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectedPlaybook ? (
            <>
              <button
                onClick={() => handleSelectPlaybook(null)}
                title="Back to All Playbooks"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '4px 6px',
                  borderRadius: 6,
                  transition: 'color 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <ArrowLeft size={14} />
                <span>Playbooks</span>
              </button>
              <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>/</span>

              {/* Playbook Switcher Dropdown */}
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedPlaybook.id}
                  onChange={e => handleSelectPlaybook(e.target.value)}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  {playbooks.map(pb => (
                    <option key={pb.id} value={pb.id}>{pb.title}</option>
                  ))}
                </select>
              </div>

              <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>/</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                {TABS.find(t => t.id === activeTab)?.label || 'Overview'}
              </span>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'color-mix(in srgb, var(--text-primary) 7%, var(--bg-surface))',
                  border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
                  flexShrink: 0
                }}
              >
                <PlaybookIcon size={22} color="var(--text-primary)" />
              </div>
              <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
                Playbook Studio
              </h1>
              <span style={{
                fontSize: 10.5,
                fontWeight: 500,
                textTransform: 'uppercase',
                padding: '2px 7px',
                borderRadius: 9999,
                background: 'var(--bg-surface)',
                border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                color: 'var(--text-muted)',
                letterSpacing: '0.04em'
              }}>
                {playbooks.length} Setups
              </span>
            </div>
          )}
        </div>

        {/* Right Action Icons: Help, Settings, Active Switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {selectedPlaybook && (
            <button
              onClick={() => openAuditModal(null, selectedPlaybook.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 25%, transparent)'}
            >
              <CheckSquare size={13} />
              <span>Audit Trade</span>
            </button>
          )}

          {/* Institutional Mode Status Badge — non-interactive indicator */}
          <div
            title="Institutional Playbook Mode — all metrics follow Nexus Trading Journal standards"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
              borderLeft: '2px solid #10b981',
              background: 'var(--bg-surface)',
              fontSize: 11.5,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              letterSpacing: '0.01em',
              userSelect: 'none'
            }}
          >
            <span>Institutional Mode</span>
          </div>
        </div>
      </div>

      {/* ── Main Workspace Body ─────────────────────────────────────────── */}
      {!selectedPlaybook ? (
        /* ── Root View: Playbook Library Grid ──────────────────────────── */
        <div style={{ flex: 1, padding: '24px 32px 140px 32px', overflowY: 'auto' }}>
          <PlaybookLibraryGrid
            playbooks={playbooks}
            allTrades={trades}
            tradeAudits={tradeAudits}
            missedTrades={missedTrades}
            onSelectPlaybook={(pb) => {
              handleSelectPlaybook(pb.id);
              setActiveTab('overview');
            }}
            onOpenCreateModal={() => {
              setEditingPlaybookData(null);
              setIsCreateModalOpen(true);
            }}
            onDeletePlaybook={handleDeletePlaybook}
            settings={playbookSettings}
            onUpdateSetting={handleUpdatePlaybookSetting}
            onResetSettings={handleResetPlaybookSettings}
            onImportPlaybooks={handleImportPlaybooks}
            onReseedSamplePlaybook={handleReseedSamplePlaybook}
          />
        </div>
      ) : (
        /* ── Selected Playbook Detail: Sidebar + Content Pane ───────────── */
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
          <PlaybookSidebar
            selectedPlaybook={selectedPlaybook}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
            onOpenAuditModal={() => openAuditModal(null, selectedPlaybook.id)}
          />

          <div style={{ flex: 1, padding: '24px 32px 140px 32px', overflowY: 'auto' }}>
            {activeTab === 'overview' && (
              <PlaybookOverviewTab
                playbook={selectedPlaybook}
                allTrades={trades}
                tradeAudits={tradeAudits}
                missedTrades={missedTrades}
                settings={playbookSettings}
                onOpenAuditModal={openAuditModal}
              />
            )}

            {activeTab === 'rules' && (
              <PlaybookRulesTab
                playbook={selectedPlaybook}
                allTrades={trades}
                tradeAudits={tradeAudits}
                settings={playbookSettings}
                onUpdatePlaybook={handleSavePlaybook}
              />
            )}

            {activeTab === 'executed' && (
              <PlaybookExecutedTradesTab
                playbook={selectedPlaybook}
                allTrades={trades}
                tradeAudits={tradeAudits}
                settings={playbookSettings}
                onOpenAuditModal={openAuditModal}
              />
            )}

            {activeTab === 'missed' && (
              <PlaybookMissedTradesTab
                playbook={selectedPlaybook}
                missedTrades={missedTrades}
                onSaveMissedTrades={handleSaveMissedTrades}
              />
            )}

            {activeTab === 'notes' && (
              <PlaybookNotesTab
                playbook={selectedPlaybook}
                onUpdatePlaybook={handleSavePlaybook}
              />
            )}

            {activeTab === 'scratchpad' && (
              <PlaybookScratchpad user={user} />
            )}
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <PlaybookBuilderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSavePlaybook={handleSavePlaybook}
        initialData={editingPlaybookData}
      />

      <TradeAuditorModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        trade={auditingTrade}
        allTrades={trades}
        allPlaybooks={playbooks}
        tradeAudits={tradeAudits}
        defaultPlaybookId={auditTargetPlaybookId}
        onSaveAudit={handleSaveAudit}
        onUpdateTrade={onUpdateTrade}
      />
    </div>
  );
}
