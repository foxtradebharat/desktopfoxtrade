import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus,
  List as ListIcon,
  LayoutGrid,
  Settings,
  MoreVertical,
  Trash2,
  Edit2,
  Copy,
  Users,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Search,
  ArrowUpDown,
  ExternalLink,
  FileSpreadsheet,
  FileCode,
  Target,
  Activity,
  Layers,
  TrendingUp,
  TrendingDown,
  Zap,
  AlertTriangle,
  Clock,
  Flame,
  BarChart2,
  Sparkles,
  CircleSlash,
  BookOpen,
  ArrowRight,
  Award
} from 'lucide-react';
import PlaybookCard from './PlaybookCard';
import PlaybookSettingsModal from './PlaybookSettingsModal';
import { PlaybookIconView } from './playbookIcons';
import {
  calculatePlaybookMetrics,
  calculateCostOfIndiscipline,
  exportPlaybookToCSV,
  exportPlaybookToJSON,
  getTradePnL
} from '../../services/playbookService';

export default function PlaybookLibraryGrid({
  playbooks = [],
  allTrades = [],
  tradeAudits = {},
  missedTrades = [],
  onSelectPlaybook,
  onOpenCreateModal,
  onDeletePlaybook,
  onDuplicatePlaybook,
  settings = {},
  onUpdateSetting = null,
  onResetSettings = null,
  onImportPlaybooks = null,
  onReseedSamplePlaybook = null
}) {
  const [activeSubTab, setActiveSubTab] = useState('my'); // 'my' | 'shared'
  const [viewMode, setViewMode] = useState(() => settings.defaultViewMode || 'list');
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const pageSize = settings.pageSize || 12;

  // Inline delete confirmation (replaces browser confirm())
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, bottom: 0, right: 0, openUpwards: false });

  // Click-outside + Escape + Scroll handler for action menu
  const menuRef = useRef(null);
  useEffect(() => {
    if (!activeMenuId) return;
    const handleClickOutside = (e) => {
      if (e.target.closest('[data-playbook-menu-btn]')) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuId(null);
        setConfirmDeleteId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveMenuId(null);
        setConfirmDeleteId(null);
      }
    };
    const handleScrollOrResize = () => {
      setActiveMenuId(null);
      setConfirmDeleteId(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeMenuId]);

  // Compute metrics for each playbook
  const playbookRows = useMemo(() => {
    return playbooks.map(pb => {
      const metrics = calculatePlaybookMetrics(pb, allTrades, tradeAudits, missedTrades, settings);
      return {
        ...pb,
        metrics
      };
    });
  }, [playbooks, allTrades, tradeAudits, missedTrades, settings]);

  // Filter based on 'my' vs 'shared'
  const displayedPlaybooks = useMemo(() => {
    if (activeSubTab === 'shared') {
      return playbookRows.filter(p => p.isShared);
    }
    return playbookRows;
  }, [playbookRows, activeSubTab]);

  const totalCount = displayedPlaybooks.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    if (num === 0) return '₹0.00';
    const sign = num < 0 ? '-' : '+';
    return `${sign}₹${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatExpectancy = (val) => {
    const num = Number(val) || 0;
    if (num === 0) return '₹0.00';
    const sign = num < 0 ? '-' : '';
    return `${sign}₹${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // ── Compare Matrix Sorting & Summary ──────────────────────────────
  const [compareSortField, setCompareSortField] = useState('netPnL');
  const [compareSortDirection, setCompareSortDirection] = useState('desc');

  const handleCompareSort = (field) => {
    if (compareSortField === field) {
      setCompareSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setCompareSortField(field);
      setCompareSortDirection('desc');
    }
  };

  const compareSummary = useMemo(() => {
    let totalRealizedPnL = 0;
    let totalAuditedTrades = 0;
    let topRealized = null;
    let edgeLeader = null;
    let disciplineLeader = null;

    displayedPlaybooks.forEach(pb => {
      const m = pb.metrics || {};
      totalRealizedPnL += (m.netPnL || 0);
      totalAuditedTrades += (m.totalTrades || 0);

      if (m.totalTrades > 0) {
        if (!topRealized || (m.netPnL || 0) > (topRealized.metrics?.netPnL || 0)) {
          topRealized = pb;
        }
        const currentEdge = (m.profitFactor || 0) * 10 + (m.winRate || 0);
        const topEdge = ((edgeLeader?.metrics?.profitFactor || 0) * 10) + (edgeLeader?.metrics?.winRate || 0);
        if (!edgeLeader || currentEdge > topEdge) {
          edgeLeader = pb;
        }
        if (!disciplineLeader || (m.rulesFollowedScore || 0) > (disciplineLeader.metrics?.rulesFollowedScore || 0)) {
          disciplineLeader = pb;
        }
      }
    });

    return {
      totalRealizedPnL,
      totalAuditedTrades,
      topRealized,
      edgeLeader,
      disciplineLeader,
      setupsCount: displayedPlaybooks.length
    };
  }, [displayedPlaybooks]);

  const sortedCompareRows = useMemo(() => {
    const rows = [...displayedPlaybooks];
    rows.sort((a, b) => {
      let aVal = 0;
      let bVal = 0;
      if (compareSortField === 'name') {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return compareSortDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      if (compareSortField === 'totalTrades') {
        aVal = a.metrics?.totalTrades || 0;
        bVal = b.metrics?.totalTrades || 0;
      } else if (compareSortField === 'winRate') {
        aVal = a.metrics?.winRate || 0;
        bVal = b.metrics?.winRate || 0;
      } else if (compareSortField === 'avgRMultiple') {
        aVal = a.metrics?.avgRMultiple || 0;
        bVal = b.metrics?.avgRMultiple || 0;
      } else if (compareSortField === 'profitFactor') {
        aVal = a.metrics?.profitFactor || 0;
        bVal = b.metrics?.profitFactor || 0;
      } else if (compareSortField === 'rulesFollowedScore') {
        aVal = a.metrics?.rulesFollowedScore || 0;
        bVal = b.metrics?.rulesFollowedScore || 0;
      } else if (compareSortField === 'costOfIndiscipline') {
        aVal = a.metrics?.costOfIndiscipline || 0;
        bVal = b.metrics?.costOfIndiscipline || 0;
      } else {
        aVal = a.metrics?.netPnL || 0;
        bVal = b.metrics?.netPnL || 0;
      }
      return compareSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return rows;
  }, [displayedPlaybooks, compareSortField, compareSortDirection]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Top Bar matching Reference Image (media_1788627797817.png) ──── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        {/* Left: Tab Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setActiveSubTab('my')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: activeSubTab === 'my' ? 550 : 450,
              cursor: 'pointer',
              border: activeSubTab === 'my'
                ? '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)'
                : '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
              background: activeSubTab === 'my'
                ? 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))'
                : 'var(--bg-surface)',
              color: activeSubTab === 'my' ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'all 0.18s ease'
            }}
          >
            My Playbook
          </button>

          <button
            onClick={() => setActiveSubTab('shared')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: activeSubTab === 'shared' ? 550 : 450,
              cursor: 'pointer',
              border: activeSubTab === 'shared'
                ? '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)'
                : '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
              background: activeSubTab === 'shared'
                ? 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))'
                : 'var(--bg-surface)',
              color: activeSubTab === 'shared' ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'all 0.18s ease'
            }}
          >
            Shared Playbook
          </button>
        </div>

        {/* Right: + Create Playbook, Settings, View Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onOpenCreateModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 16px',
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
              background: 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))',
              color: 'var(--text-primary)',
              fontSize: 12.5,
              fontWeight: 550,
              cursor: 'pointer',
              transition: 'all 0.18s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 12%, var(--bg-surface))'}
            onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))'}
          >
            <Plus size={14} strokeWidth={2} />
            <span>Create Playbook</span>
          </button>

          {/* Settings Button — opens PlaybookSettingsModal */}
          <button
            title="Playbook Studio Settings"
            onClick={() => setIsSettingsModalOpen(true)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: isSettingsModalOpen
                ? '1px solid color-mix(in srgb, var(--text-primary) 35%, transparent)'
                : '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
              background: isSettingsModalOpen
                ? 'color-mix(in srgb, var(--text-primary) 10%, var(--bg-surface))'
                : 'var(--bg-surface)',
              color: isSettingsModalOpen ? 'var(--text-primary)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.18s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))';
            }}
            onMouseLeave={e => {
              if (!isSettingsModalOpen) {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.background = 'var(--bg-surface)';
              }
            }}
          >
            <Settings size={14} />
          </button>

          {/* View Switcher: List vs Grid */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
            borderRadius: 8,
            padding: 2,
            gap: 2
          }}>
            <button
              onClick={() => setViewMode('list')}
              title="Table List View"
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: viewMode === 'list'
                  ? '1px solid color-mix(in srgb, var(--border-color) 30%, transparent)'
                  : '1px solid transparent',
                background: viewMode === 'list'
                  ? 'color-mix(in srgb, var(--text-primary) 10%, var(--bg-surface))'
                  : 'transparent',
                color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.18s ease'
              }}
            >
              <ListIcon size={14} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              title="Card Grid View"
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: viewMode === 'grid'
                  ? '1px solid color-mix(in srgb, var(--border-color) 30%, transparent)'
                  : '1px solid transparent',
                background: viewMode === 'grid'
                  ? 'color-mix(in srgb, var(--text-primary) 10%, var(--bg-surface))'
                  : 'transparent',
                color: viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.18s ease'
              }}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('compare')}
              title="Compare Setups Matrix"
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: viewMode === 'compare'
                  ? '1px solid color-mix(in srgb, var(--border-color) 30%, transparent)'
                  : '1px solid transparent',
                background: viewMode === 'compare'
                  ? 'color-mix(in srgb, var(--text-primary) 10%, var(--bg-surface))'
                  : 'transparent',
                color: viewMode === 'compare' ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.18s ease'
              }}
            >
              <BarChart2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── LIST VIEW (Table matching media_1788627797817.png) ─────────── */}
      {viewMode === 'list' ? (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
          borderRadius: 14,
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                  background: 'var(--bg-primary)',
                  fontSize: 11,
                  fontWeight: 450,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.04em'
                }}>
                  <th style={{ padding: '16px 22px', width: '28%' }}>Playbook Name</th>
                  <th style={{ padding: '16px 14px', width: '10%', textAlign: 'center' }}>Trades</th>
                  <th style={{ padding: '16px 16px', width: '14%', textAlign: 'right' }}>Net P&amp;L</th>
                  <th style={{ padding: '16px 14px', width: '12%', textAlign: 'right' }}>Win Rate</th>
                  <th style={{ padding: '16px 14px', width: '12%', textAlign: 'center' }}>Missed</th>
                  <th style={{ padding: '16px 16px', width: '12%', textAlign: 'right' }}>Expectancy</th>
                  <th style={{ padding: '16px 14px', width: '12%', textAlign: 'center' }}>Shared</th>
                  <th style={{ padding: '16px 14px', width: '4%', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {displayedPlaybooks.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No playbooks found. Click &quot;Create Playbook&quot; to define your trading strategy.
                    </td>
                  </tr>
                ) : (
                  displayedPlaybooks.map(pb => renderPlaybookRow(pb))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination matching media_1788627797817.png */}
          <div style={{
            padding: '14px 20px',
            borderTop: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--text-muted)'
          }}>
            <span>Result: 1 - {totalCount} of {totalCount} playbooks</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.3 : 1,
                  display: 'flex',
                  color: 'var(--text-primary)',
                  padding: 2
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{
                padding: '2px 8px',
                borderRadius: 6,
                background: 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))',
                color: 'var(--text-primary)',
                border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
                fontWeight: 600,
                fontSize: 11
              }}>
                1
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.3 : 1,
                  display: 'flex',
                  color: 'var(--text-primary)',
                  padding: 2
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── GRID VIEW (Card Grid) ─────────────────────────────────────── */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 24
        }}>
          {displayedPlaybooks.map(pb => (
            <PlaybookCard
              key={pb.id}
              playbook={pb}
              allTrades={allTrades}
              tradeAudits={tradeAudits}
              missedTrades={missedTrades}
              settings={settings}
              onSelectPlaybook={onSelectPlaybook}
            />
          ))}

          {/* Add Playbook Placeholder */}
          <div
            onClick={onOpenCreateModal}
            style={{
              background: 'transparent',
              border: '1.5px dashed color-mix(in srgb, var(--border-color) 35%, transparent)',
              borderRadius: 16,
              padding: '28px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              minHeight: 200,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--text-primary)';
              e.currentTarget.style.background = 'var(--bg-surface)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 35%, transparent)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: 'var(--bg-surface)',
              border: '1px solid color-mix(in srgb, var(--border-color) 30%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Plus size={16} color="var(--text-primary)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)', display: 'block', lineHeight: 1.4 }}>
                Create New Playbook
              </span>
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginTop: 2, display: 'block', lineHeight: 1.4 }}>
                Document rules, win rate &amp; R:R targets
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ── COMPARE MATRIX VIEW ───────────────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Top 4 Comparative Summary KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 16
          }}>
            {/* 1. Top Realized Setup */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
              borderRadius: 12,
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Top Realized Setup
                </span>
                <div style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: 'color-mix(in srgb, #22c55e 12%, var(--bg-surface))',
                  color: '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Award size={14} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{
                  fontSize: 19,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: (compareSummary.topRealized?.metrics?.netPnL || 0) > 0 ? '#22c55e' : (compareSummary.topRealized?.metrics?.netPnL || 0) < 0 ? '#ef4444' : 'var(--text-primary)'
                }}>
                  {compareSummary.topRealized ? formatCurrency(compareSummary.topRealized.metrics?.netPnL || 0) : '₹0.00'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {compareSummary.topRealized ? (compareSummary.topRealized.title || compareSummary.topRealized.name) : 'No trades recorded'}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {compareSummary.topRealized
                  ? `${compareSummary.topRealized.metrics?.totalTrades || 0} trades • ${(compareSummary.topRealized.metrics?.winRate || 0).toFixed(1)}% WR`
                  : 'Tag setups to track edge'}
              </span>
            </div>

            {/* 2. Edge Leader */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
              borderRadius: 12,
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Edge Leader (PF / WR)
                </span>
                <div style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: 'color-mix(in srgb, #3b82f6 12%, var(--bg-surface))',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Flame size={14} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 19, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {compareSummary.edgeLeader ? `${(compareSummary.edgeLeader.metrics?.profitFactor || 0).toFixed(2)} PF` : 'N/A'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {compareSummary.edgeLeader ? (compareSummary.edgeLeader.title || compareSummary.edgeLeader.name) : 'No trades recorded'}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {compareSummary.edgeLeader
                  ? `WR: ${(compareSummary.edgeLeader.metrics?.winRate || 0).toFixed(1)}% • Avg R: ${compareSummary.edgeLeader.metrics?.avgRMultiple ? compareSummary.edgeLeader.metrics.avgRMultiple.toFixed(2) + 'R' : 'N/A'}`
                  : 'Document setups to benchmark edge'}
              </span>
            </div>

            {/* 3. Discipline Leader */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
              borderRadius: 12,
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Discipline Leader
                </span>
                <div style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: 'color-mix(in srgb, #a855f7 12%, var(--bg-surface))',
                  color: '#a855f7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ShieldCheck size={14} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{
                  fontSize: 19,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: (compareSummary.disciplineLeader?.metrics?.rulesFollowedScore || 0) >= 80 ? '#22c55e' : 'var(--text-primary)'
                }}>
                  {compareSummary.disciplineLeader ? `${compareSummary.disciplineLeader.metrics?.rulesFollowedScore || 0}%` : '100%'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {compareSummary.disciplineLeader ? (compareSummary.disciplineLeader.title || compareSummary.disciplineLeader.name) : 'All rules respected'}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {compareSummary.disciplineLeader
                  ? `Indiscipline cost: ${formatCurrency(compareSummary.disciplineLeader.metrics?.costOfIndiscipline || 0)}`
                  : 'Audit trades to evaluate adherence'}
              </span>
            </div>

            {/* 4. Total Setups Realized P&L */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
              borderRadius: 12,
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Total Realized P&amp;L
                </span>
                <div style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <TrendingUp size={14} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{
                  fontSize: 19,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: compareSummary.totalRealizedPnL > 0 ? '#22c55e' : compareSummary.totalRealizedPnL < 0 ? '#ef4444' : 'var(--text-primary)'
                }}>
                  {formatCurrency(compareSummary.totalRealizedPnL)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Across {compareSummary.setupsCount} Playbooks
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {compareSummary.totalAuditedTrades} total executed trades recorded
              </span>
            </div>
          </div>

          {/* Comparative Matrix Table */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
            borderRadius: 14,
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                    background: 'var(--bg-primary)',
                    fontSize: 11,
                    fontWeight: 450,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.04em'
                  }}>
                    <th
                      onClick={() => handleCompareSort('name')}
                      style={{
                        padding: '14px 20px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        color: compareSortField === 'name' ? 'var(--text-primary)' : 'var(--text-muted)'
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span>Setup Name</span>
                        <ArrowUpDown size={11} style={{ opacity: compareSortField === 'name' ? 1 : 0.4 }} />
                      </div>
                    </th>
                    <th style={{ padding: '14px 14px' }}>Archetype</th>
                    <th
                      onClick={() => handleCompareSort('totalTrades')}
                      style={{
                        padding: '14px 14px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        color: compareSortField === 'totalTrades' ? 'var(--text-primary)' : 'var(--text-muted)'
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                        <span>Trades (W / L)</span>
                        <ArrowUpDown size={11} style={{ opacity: compareSortField === 'totalTrades' ? 1 : 0.4 }} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleCompareSort('winRate')}
                      style={{
                        padding: '14px 14px',
                        textAlign: 'right',
                        cursor: 'pointer',
                        userSelect: 'none',
                        color: compareSortField === 'winRate' ? 'var(--text-primary)' : 'var(--text-muted)'
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        <span>Win Rate</span>
                        <ArrowUpDown size={11} style={{ opacity: compareSortField === 'winRate' ? 1 : 0.4 }} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleCompareSort('avgRMultiple')}
                      style={{
                        padding: '14px 14px',
                        textAlign: 'right',
                        cursor: 'pointer',
                        userSelect: 'none',
                        color: compareSortField === 'avgRMultiple' ? 'var(--text-primary)' : 'var(--text-muted)'
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        <span>Avg R:R</span>
                        <ArrowUpDown size={11} style={{ opacity: compareSortField === 'avgRMultiple' ? 1 : 0.4 }} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleCompareSort('profitFactor')}
                      style={{
                        padding: '14px 14px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        color: compareSortField === 'profitFactor' ? 'var(--text-primary)' : 'var(--text-muted)'
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                        <span>Profit Factor</span>
                        <ArrowUpDown size={11} style={{ opacity: compareSortField === 'profitFactor' ? 1 : 0.4 }} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleCompareSort('rulesFollowedScore')}
                      style={{
                        padding: '14px 14px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        color: compareSortField === 'rulesFollowedScore' ? 'var(--text-primary)' : 'var(--text-muted)'
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                        <span>Discipline</span>
                        <ArrowUpDown size={11} style={{ opacity: compareSortField === 'rulesFollowedScore' ? 1 : 0.4 }} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleCompareSort('costOfIndiscipline')}
                      style={{
                        padding: '14px 16px',
                        textAlign: 'right',
                        cursor: 'pointer',
                        userSelect: 'none',
                        color: compareSortField === 'costOfIndiscipline' ? 'var(--text-primary)' : 'var(--text-muted)'
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        <span>Indiscipline Cost</span>
                        <ArrowUpDown size={11} style={{ opacity: compareSortField === 'costOfIndiscipline' ? 1 : 0.4 }} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleCompareSort('netPnL')}
                      style={{
                        padding: '14px 18px',
                        textAlign: 'right',
                        cursor: 'pointer',
                        userSelect: 'none',
                        color: compareSortField === 'netPnL' ? 'var(--text-primary)' : 'var(--text-muted)'
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        <span>Net Realized P&amp;L</span>
                        <ArrowUpDown size={11} style={{ opacity: compareSortField === 'netPnL' ? 1 : 0.4 }} />
                      </div>
                    </th>
                    <th style={{ padding: '14px 16px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCompareRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No playbooks available to compare. Click &quot;Create Playbook&quot; to begin.
                      </td>
                    </tr>
                  ) : (
                    sortedCompareRows.map(pb => {
                      const m = pb.metrics || {};
                      const hasTrades = (m.totalTrades || 0) > 0;
                      const title = pb.title || pb.name;
                      const pnlVal = m.netPnL || 0;
                      const pnlColor = pnlVal > 0 ? '#22c55e' : pnlVal < 0 ? '#ef4444' : 'var(--text-muted)';
                      const targetWR = pb.targetWinRate || 65;
                      const actualWR = m.winRate || 0;
                      const wrDiff = actualWR - targetWR;
                      const targetRR = pb.targetRiskReward || 2.0;

                      return (
                        <tr
                          key={pb.id}
                          style={{
                            borderBottom: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
                            fontSize: 13,
                            transition: 'background 0.12s ease'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {/* Playbook Name & Icon */}
                          <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 30,
                                height: 30,
                                borderRadius: 7,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: `color-mix(in srgb, ${pb.colorHex || '#3b82f6'} 14%, transparent)`,
                                border: `1px solid color-mix(in srgb, ${pb.colorHex || '#3b82f6'} 26%, transparent)`,
                                flexShrink: 0
                              }}>
                                <PlaybookIconView name={pb.icon} size={15} color={pb.colorHex || '#3b82f6'} strokeWidth={2.2} />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                <span
                                  onClick={() => onSelectPlaybook(pb)}
                                  style={{
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                  onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                >
                                  {title}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {pb.rules?.length || 0} checklist rules
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Archetype Tag */}
                          <td style={{ padding: '16px 14px', verticalAlign: 'middle' }}>
                            <span style={{
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: 'color-mix(in srgb, var(--text-primary) 5%, var(--bg-surface))',
                              border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                              color: 'var(--text-secondary)',
                              whiteSpace: 'nowrap'
                            }}>
                              {pb.archetype || pb.category || 'Discretionary'}
                            </span>
                          </td>

                          {/* Trades */}
                          <td style={{ padding: '16px 14px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                                {m.totalTrades || 0}
                              </span>
                              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {m.winningTrades || 0}W / {m.losingTrades || 0}L
                              </span>
                            </div>
                          </td>

                          {/* Win Rate vs Target */}
                          <td style={{ padding: '16px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                              <span style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 650,
                                fontSize: 13,
                                color: hasTrades ? (actualWR >= targetWR ? '#22c55e' : '#ef4444') : 'var(--text-muted)'
                              }}>
                                {hasTrades ? `${actualWR.toFixed(1)}%` : '-'}
                              </span>
                              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                                Target: {targetWR}% {hasTrades && `(${wrDiff >= 0 ? '+' : ''}${wrDiff.toFixed(1)}%)`}
                              </span>
                            </div>
                          </td>

                          {/* Avg R:R vs Target */}
                          <td style={{ padding: '16px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 650, fontSize: 13, color: 'var(--text-primary)' }}>
                                {hasTrades && m.avgRMultiple ? `${m.avgRMultiple.toFixed(2)}R` : '-'}
                              </span>
                              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                                Target: {targetRR}R
                              </span>
                            </div>
                          </td>

                          {/* Profit Factor */}
                          <td style={{ padding: '16px 14px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <span style={{
                              display: 'inline-block',
                              fontSize: 11.5,
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 650,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: hasTrades
                                ? (m.profitFactor >= 1.5
                                  ? 'color-mix(in srgb, #22c55e 12%, var(--bg-surface))'
                                  : m.profitFactor >= 1.0
                                    ? 'color-mix(in srgb, #eab308 12%, var(--bg-surface))'
                                    : 'color-mix(in srgb, #ef4444 12%, var(--bg-surface))')
                                : 'transparent',
                              color: hasTrades
                                ? (m.profitFactor >= 1.5
                                  ? '#22c55e'
                                  : m.profitFactor >= 1.0
                                    ? '#eab308'
                                    : '#ef4444')
                                : 'var(--text-muted)'
                            }}>
                              {hasTrades && m.profitFactor !== undefined ? m.profitFactor.toFixed(2) : '-'}
                            </span>
                          </td>

                          {/* Discipline Score */}
                          <td style={{ padding: '16px 14px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <div style={{
                                width: 42,
                                height: 5,
                                borderRadius: 3,
                                background: 'color-mix(in srgb, var(--border-color) 35%, transparent)',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${m.rulesFollowedScore || 0}%`,
                                  height: '100%',
                                  background: (m.rulesFollowedScore || 0) >= 80 ? '#22c55e' : (m.rulesFollowedScore || 0) >= 50 ? '#eab308' : '#ef4444'
                                }} />
                              </div>
                              <span style={{
                                fontSize: 11.5,
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: (m.rulesFollowedScore || 0) >= 80 ? '#22c55e' : (m.rulesFollowedScore || 0) >= 50 ? '#eab308' : '#ef4444'
                              }}>
                                {m.rulesFollowedScore || 0}%
                              </span>
                            </div>
                          </td>

                          {/* Indiscipline Cost */}
                          <td style={{
                            padding: '16px 16px',
                            textAlign: 'right',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12,
                            fontWeight: 550,
                            verticalAlign: 'middle',
                            color: (m.costOfIndiscipline || 0) > 0 ? '#ef4444' : 'var(--text-muted)'
                          }}>
                            {(m.costOfIndiscipline || 0) > 0 ? `-${formatCurrency(m.costOfIndiscipline)}` : '₹0.00'}
                          </td>

                          {/* Net Realized P&L */}
                          <td style={{
                            padding: '16px 18px',
                            textAlign: 'right',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            fontSize: 13.5,
                            verticalAlign: 'middle',
                            color: pnlColor
                          }}>
                            {formatCurrency(pnlVal)}
                          </td>

                          {/* Action: Open deep dive */}
                          <td style={{ padding: '16px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <button
                              onClick={() => onSelectPlaybook(pb)}
                              title="Open Playbook Deep Dive"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '5px 12px',
                                borderRadius: 7,
                                border: '1px solid color-mix(in srgb, var(--border-color) 30%, transparent)',
                                background: 'color-mix(in srgb, var(--text-primary) 6%, var(--bg-surface))',
                                color: 'var(--text-primary)',
                                fontSize: 11.5,
                                fontWeight: 550,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 12%, var(--bg-surface))'}
                              onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 6%, var(--bg-surface))'}
                            >
                              <span>Open</span>
                              <ArrowRight size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Playbook Studio Settings Modal */}
      <PlaybookSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdateSetting={onUpdateSetting}
        onResetDefaults={onResetSettings}
        playbooks={playbooks}
        onImportPlaybooks={onImportPlaybooks}
        onReseedSamplePlaybook={onReseedSamplePlaybook}
      />
    </div>
  );

  function renderPlaybookRow(pb) {
    const m = pb.metrics;
    const isProfit = m.netPnL > 0;
    const isLoss = m.netPnL < 0;
    const pnlColor = isProfit ? '#10b981' : isLoss ? '#ef4444' : 'var(--text-muted)';

    return (
      <tr
        key={pb.id}
        onClick={() => onSelectPlaybook(pb)}
        style={{
          borderBottom: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
          fontSize: 13,
          cursor: 'pointer',
          transition: 'background 0.12s ease'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {/* Playbook Name */}
        <td style={{ padding: '18px 22px', verticalAlign: 'middle' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `color-mix(in srgb, ${pb.colorHex || '#3b82f6'} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${pb.colorHex || '#3b82f6'} 26%, transparent)`,
              flexShrink: 0
            }}>
              <PlaybookIconView name={pb.icon} size={15} color={pb.colorHex || '#3b82f6'} strokeWidth={2.2} />
            </div>
            <span style={{ fontWeight: 550, color: 'var(--text-primary)' }}>
              {pb.title}
            </span>
          </div>
        </td>

        {/* Trades */}
        <td style={{ padding: '18px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 450, color: 'var(--text-primary)' }}>
          {m.totalTrades}
        </td>

        {/* Net P&L */}
        <td style={{
          padding: '18px 16px',
          textAlign: 'right',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: pnlColor
        }}>
          {formatCurrency(m.netPnL)}
        </td>

        {/* Win Rate */}
        <td style={{ padding: '18px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 450, color: 'var(--text-primary)' }}>
          {m.winRate.toFixed(2)}%
        </td>

        {/* Missed Trades */}
        <td style={{ padding: '18px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 450, color: 'var(--text-secondary)' }}>
          {m.missedTradesCount}
        </td>

        {/* Expectancy */}
        <td style={{
          padding: '18px 16px',
          textAlign: 'right',
          fontFamily: 'var(--font-mono)',
          fontWeight: 450,
          color: m.expectancy >= 0 ? 'var(--text-primary)' : '#ef4444'
        }}>
          {formatExpectancy(m.expectancy)}
        </td>

        {/* Shared Playbooks */}
        <td style={{ padding: '18px 14px', textAlign: 'center' }}>
          {pb.isShared ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)'
            }}>
              <Users size={14} />
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>—</span>
          )}
        </td>

        {/* Actions */}
        <td style={{ padding: '18px 14px', textAlign: 'center' }}>
          <button
            data-playbook-menu-btn={pb.id}
            onClick={e => {
              e.stopPropagation();
              if (activeMenuId === pb.id) {
                setActiveMenuId(null);
                setConfirmDeleteId(null);
              } else {
                setConfirmDeleteId(null);
                const rect = e.currentTarget.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const openUpwards = spaceBelow < 185;
                setMenuPosition({
                  top: rect.bottom + 4,
                  bottom: window.innerHeight - rect.top + 4,
                  right: Math.max(16, window.innerWidth - rect.right),
                  openUpwards
                });
                setActiveMenuId(pb.id);
              }
            }}
            style={{
              background: activeMenuId === pb.id ? 'color-mix(in srgb, var(--text-primary) 10%, var(--bg-surface))' : 'none',
              border: 'none',
              color: activeMenuId === pb.id ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4
            }}
          >
            <MoreVertical size={14} />
          </button>

          {activeMenuId === pb.id && (
            <div
              ref={menuRef}
              style={{
                position: 'fixed',
                top: menuPosition.openUpwards ? 'auto' : `${menuPosition.top}px`,
                bottom: menuPosition.openUpwards ? `${menuPosition.bottom}px` : 'auto',
                right: `${menuPosition.right}px`,
                zIndex: 99999,
                background: 'var(--bg-card)',
                border: '1px solid color-mix(in srgb, var(--border-color) 70%, transparent)',
                borderRadius: 8,
                boxShadow: '0 10px 28px rgba(0,0,0,0.22)',
                padding: 4,
                minWidth: 140,
                textAlign: 'left'
              }}
            >
              {confirmDeleteId === pb.id ? (
                /* Inline Delete Confirmation */
                <div style={{ padding: '8px 10px' }}>
                  <p style={{ fontSize: 11.5, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.4 }}>
                    Delete <strong>"{pb.title || pb.name}"</strong>?
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onDeletePlaybook(pb.id);
                        setConfirmDeleteId(null);
                        setActiveMenuId(null);
                      }}
                      style={{
                        flex: 1, padding: '5px 0', borderRadius: 6, border: 'none',
                        background: '#ef4444', color: '#fff', fontSize: 11.5,
                        fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                      style={{
                        flex: 1, padding: '5px 0', borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        background: 'transparent', color: 'var(--text-muted)',
                        fontSize: 11.5, cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onSelectPlaybook(pb);
                      setActiveMenuId(null);
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', background: 'none', border: 'none',
                      color: 'var(--text-primary)', fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', borderRadius: 6
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <Edit2 size={12} />
                    <span>Edit Setup</span>
                  </button>

                  <button
                    onClick={e => {
                      e.stopPropagation();
                      exportPlaybookToCSV(pb, allTrades, tradeAudits);
                      setActiveMenuId(null);
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', background: 'none', border: 'none',
                      color: 'var(--text-primary)', fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', borderRadius: 6
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <FileSpreadsheet size={12} />
                    <span>Export CSV</span>
                  </button>

                  <button
                    onClick={e => {
                      e.stopPropagation();
                      exportPlaybookToJSON(pb);
                      setActiveMenuId(null);
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', background: 'none', border: 'none',
                      color: 'var(--text-primary)', fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', borderRadius: 6
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <FileCode size={12} />
                    <span>Export JSON</span>
                  </button>

                  {onDeletePlaybook && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setConfirmDeleteId(pb.id);
                      }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 10px', background: 'none', border: 'none',
                        color: '#ef4444', fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', borderRadius: 6
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </td>
      </tr>
    );
  }
}
