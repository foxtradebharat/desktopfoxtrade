import React from 'react';
import {
  PanelLeft,
  Activity,
  ListChecks,
  TrendingUp,
  Target,
  FileText,
  PenTool,
  CheckSquare
} from 'lucide-react';
import { PlaybookIconView } from './playbookIcons';

export default function PlaybookSidebar({
  selectedPlaybook,
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  onOpenAuditModal
}) {
  const isNoSetup = !!selectedPlaybook?.isNoSetup;

  // Grouped Navigation Items (Clean SVG icons only — zero emojis)
  const navSections = [
    {
      id: 'analysis',
      title: 'Analysis',
      items: [
        { id: 'overview', label: 'Overview', icon: Activity },
        ...(!isNoSetup ? [{ id: 'rules', label: 'Playbook Rules', icon: ListChecks }] : [])
      ]
    },
    {
      id: 'trades',
      title: 'Trades',
      items: [
        {
          id: 'executed',
          label: isNoSetup ? 'Impulse Trades' : 'Executed Trades',
          icon: TrendingUp
        },
        ...(!isNoSetup ? [{ id: 'missed', label: 'Missed Trades', icon: Target }] : [])
      ]
    },
    {
      id: 'documentation',
      title: 'Documentation',
      items: [
        {
          id: 'notes',
          label: isNoSetup ? 'Psychology Lessons' : 'Notes',
          icon: FileText
        },
        { id: 'scratchpad', label: 'Scratchpad', icon: PenTool }
      ]
    }
  ];

  return (
    <aside
      aria-label="Playbook Navigation"
      style={{
        width: isCollapsed ? 64 : 220,
        minWidth: isCollapsed ? 64 : 220,
        background: 'var(--bg-card)',
        borderRight: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        height: '100%',
        overflow: 'hidden',
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      {/* ── Top Header & Toggle Button ──────────────────────────────── */}
      <div style={{
        padding: isCollapsed ? '16px 11px 12px 11px' : '16px 14px 12px 14px',
        borderBottom: '1px solid color-mix(in srgb, var(--border-color) 15%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        gap: 10
      }}>
        {!isCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, overflow: 'hidden' }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `color-mix(in srgb, ${selectedPlaybook?.colorHex || '#3b82f6'} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${selectedPlaybook?.colorHex || '#3b82f6'} 26%, transparent)`,
              flexShrink: 0
            }}>
              <PlaybookIconView
                name={selectedPlaybook?.icon}
                size={14}
                color={selectedPlaybook?.colorHex || '#3b82f6'}
                strokeWidth={2.2}
              />
            </div>
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {selectedPlaybook?.title || 'Playbook Menu'}
            </span>
          </div>
        )}

        {/* The Toggle Logo / Button — Clicking collapses or opens the sidebar */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.15s, border-color 0.15s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 7%, var(--bg-surface))';
            e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 40%, transparent)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--bg-surface)';
            e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 20%, transparent)';
          }}
        >
          <PanelLeft size={17} strokeWidth={2} />
        </button>
      </div>

      {/* ── Middle: Categorized Nav Items ────────────────────────────── */}
      <div style={{
        flex: 1,
        padding: isCollapsed ? '12px 10px' : '12px 10px',
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: isCollapsed ? 12 : 16
      }}>
        {navSections.map((section, sIdx) => (
          <div key={section.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Section Header (when expanded) or Thin Divider (when collapsed) */}
            {!isCollapsed ? (
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.06em',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                padding: '4px 10px 2px 10px'
              }}>
                {section.title}
              </div>
            ) : (
              sIdx > 0 && (
                <div style={{
                  height: 1,
                  background: 'color-mix(in srgb, var(--border-color) 18%, transparent)',
                  margin: '4px 4px 6px 4px'
                }} />
              )
            )}

            {/* Menu Items */}
            {section.items.map(item => {
              const IconComponent = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  title={item.label}
                  aria-label={item.label}
                  style={{
                    width: '100%',
                    height: isCollapsed ? 42 : 38,
                    padding: isCollapsed ? 0 : '0 12px',
                    borderRadius: 10,
                    border: isActive
                      ? '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)'
                      : '1px solid transparent',
                    background: isActive
                      ? 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))'
                      : 'transparent',
                    color: isActive
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    gap: 12,
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: isActive ? 600 : 450,
                    transition: 'all 0.18s ease',
                    outline: 'none',
                    boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.04)' : 'none'
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 5%, transparent)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  <IconComponent
                    size={17}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    style={{ flexShrink: 0 }}
                  />
                  {!isCollapsed && (
                    <span style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Bottom Action: Quick Audit Trade ─────────────────────────── */}
      {onOpenAuditModal && (
        <div style={{
          padding: isCollapsed ? '12px 10px 16px 10px' : '12px 12px 16px 12px',
          borderTop: '1px solid color-mix(in srgb, var(--border-color) 15%, transparent)'
        }}>
          <button
            type="button"
            onClick={onOpenAuditModal}
            title="Audit Trade Execution"
            aria-label="Audit Trade Execution"
            style={{
              width: '100%',
              height: isCollapsed ? 40 : 36,
              padding: isCollapsed ? 0 : '0 10px',
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: 8,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              transition: 'all 0.18s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 7%, var(--bg-surface))';
              e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 40%, transparent)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--bg-surface)';
              e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 25%, transparent)';
            }}
          >
            <CheckSquare size={15} style={{ flexShrink: 0 }} />
            {!isCollapsed && (
              <span style={{ whiteSpace: 'nowrap' }}>Audit Trade</span>
            )}
          </button>
        </div>
      )}
    </aside>
  );
}
