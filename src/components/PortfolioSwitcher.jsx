import React, { useState, useEffect, useRef } from 'react';
import { 
  Layers, 
  ChevronDown, 
  Check, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  Plus, 
  X, 
  AlertTriangle 
} from 'lucide-react';
import PortfolioIcon from './PortfolioIcon';

export default function PortfolioSwitcher({
  portfolios = [],
  activePortfolioId = 'portfolio-default',
  onSelectPortfolio,
  onUpdatePortfolios,
  onOpenCreatePortfolio,
  onShowToast,
  trades = []
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const containerRef = useRef(null);
  const editInputRef = useRef(null);

  const activePortfolio = portfolios.find(p => p.id === activePortfolioId) || portfolios[0] || { id: 'portfolio-default', name: 'My Portfolio' };

  // Calculate live trade counts for each portfolio accurately
  const getPortfolioTradeCount = (portfolioId) => {
    // 1. If this is the active portfolio and trades are loaded in state, use live trades
    if (portfolioId === activePortfolioId && Array.isArray(trades)) {
      return trades.filter(t => (t.portfolioId || 'portfolio-default') === activePortfolioId && Boolean((t.name || t.symbol || '').trim())).length;
    }
    // 2. Check portfolio-specific cache in localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.endsWith(`_${portfolioId}`) || key === `tradeontip_trades_v5_${portfolioId}`) && key.startsWith('tradeontip_trades_v5')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              return parsed.filter(t => (t.portfolioId || 'portfolio-default') === portfolioId && Boolean((t.name || t.symbol || '').trim())).length;
            }
          }
        }
      }
    } catch (_) {}
    // 3. Fallback to master cache
    try {
      const saved = localStorage.getItem('tradeontip_trades_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(t => {
            const pId = t.portfolioId || 'portfolio-default';
            return pId === portfolioId && Boolean((t.name || t.symbol || '').trim());
          }).length;
        }
      }
    } catch (_) {}
    return 0;
  };

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Handle outside clicks to close dropdown & menus
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setMenuOpenId(null);
        setEditingId(null);
        setDeletingId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation (Escape to cancel)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (deletingId) {
          setDeletingId(null);
        } else if (editingId) {
          setEditingId(null);
        } else if (menuOpenId) {
          setMenuOpenId(null);
        } else if (isOpen) {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deletingId, editingId, menuOpenId, isOpen]);

  const handleStartRename = (portfolio, e) => {
    e.stopPropagation();
    setEditingId(portfolio.id);
    setEditingName(portfolio.name);
    setMenuOpenId(null);
    setDeletingId(null);
  };

  const handleSaveRename = (portfolioId, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }

    const updated = portfolios.map(p => {
      if (p.id === portfolioId) {
        return { ...p, name: trimmed };
      }
      return p;
    });

    onUpdatePortfolios(updated);
    setEditingId(null);

    if (onShowToast) {
      onShowToast({
        id: Date.now(),
        type: 'info',
        title: 'Portfolio Renamed',
        description: `Portfolio renamed to "${trimmed}".`
      });
    }
  };

  const handleCancelRename = (e) => {
    if (e) e.stopPropagation();
    setEditingId(null);
    setEditingName('');
  };

  const handlePromptDelete = (portfolio, e) => {
    e.stopPropagation();
    setMenuOpenId(null);
    setDeletingId(portfolio.id);
  };

  const handleConfirmDelete = (portfolioId, e) => {
    e.stopPropagation();
    if (portfolios.length <= 1) {
      setDeletingId(null);
      return;
    }

    const portToDelete = portfolios.find(p => p.id === portfolioId);
    const updated = portfolios.filter(p => p.id !== portfolioId);
    onUpdatePortfolios(updated);

    if (activePortfolioId === portfolioId) {
      onSelectPortfolio(updated[0].id);
    }

    setDeletingId(null);

    if (onShowToast) {
      onShowToast({
        id: Date.now(),
        type: 'info',
        title: 'Portfolio Deleted',
        description: `"${portToDelete?.name || 'Portfolio'}" was removed.`
      });
    }
  };

  const handleCancelDelete = (e) => {
    if (e) e.stopPropagation();
    setDeletingId(null);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* ── TOP BAR TRIGGER PILL ────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev);
          setMenuOpenId(null);
          setEditingId(null);
          setDeletingId(null);
        }}
        title={`Current Portfolio: ${activePortfolio.name}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '5px 12px',
          backgroundColor: isOpen ? 'var(--bg-surface-hover, rgba(0,0,0,0.06))' : 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover, rgba(0,0,0,0.03))';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
        }}
      >
        <PortfolioIcon size={18} />
        <span style={{ 
          maxWidth: '140px', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap' 
        }}>
          {activePortfolio.name}
        </span>
        <ChevronDown 
          size={13} 
          color="var(--text-muted, #9ca3af)"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}
        />
      </button>

      {/* ── DROPDOWN MENU ──────────────────────────────────────────────── */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: '280px',
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, rgba(0, 0, 0, 0.12))',
            borderRadius: '12px',
            boxShadow: '0 16px 40px -10px rgba(0, 0, 0, 0.2), 0 4px 14px rgba(0, 0, 0, 0.06)',
            zIndex: 1000,
            padding: '6px',
            animation: 'modernDropdownFadeIn 0.15s ease-out',
            color: 'var(--text-primary, #111827)',
            userSelect: 'none'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Label */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px 4px 10px',
            fontSize: '10px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted, #9ca3af)'
          }}>
            <span>Portfolios</span>
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary, #6b7280)' }}>
              {portfolios.length}
            </span>
          </div>

          {/* Scrollable Portfolios List (Comfortably fits up to 3 items, scrollable for more) */}
          <div style={{
            maxHeight: portfolios.length > 3 ? '195px' : 'none',
            overflowY: portfolios.length > 3 ? 'auto' : 'visible',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            paddingRight: '2px',
            marginTop: '2px'
          }}>
            {portfolios.map((portfolio) => {
              const isActive = activePortfolioId === portfolio.id;
              const isEditing = editingId === portfolio.id;
              const isMenuOpen = menuOpenId === portfolio.id;
              const isDeleting = deletingId === portfolio.id;
              const tradeCount = getPortfolioTradeCount(portfolio.id);

              return (
                <div
                  key={portfolio.id}
                  style={{
                    position: 'relative',
                    borderRadius: '8px',
                    backgroundColor: isActive ? 'var(--bg-surface, rgba(0,0,0,0.04))' : 'transparent',
                    border: isActive ? '1px solid var(--border-color, rgba(0,0,0,0.08))' : '1px solid transparent',
                    transition: 'all 0.12s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive && !isEditing && !isDeleting) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-surface, rgba(0,0,0,0.025))';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive && !isEditing && !isDeleting) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {/* INLINE EDIT MODE */}
                  {isEditing ? (
                    <form 
                      onSubmit={(e) => handleSaveRename(portfolio.id, e)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 8px'
                      }}
                    >
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        placeholder="Portfolio Name"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: '4px 8px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: '1px solid #3b82f6',
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          color: 'var(--text-primary, #111827)',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="submit"
                        title="Save name"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '4px',
                          cursor: 'pointer',
                          color: '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px'
                        }}
                      >
                        <Check size={14} strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelRename}
                        title="Cancel"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '4px',
                          cursor: 'pointer',
                          color: '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px'
                        }}
                      >
                        <X size={14} strokeWidth={2} />
                      </button>
                    </form>
                  ) : (
                    /* NORMAL VIEW MODE */
                    <div
                      onClick={() => {
                        onSelectPortfolio(portfolio.id);
                        setIsOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        cursor: 'pointer'
                      }}
                    >
                      {/* Left: Icon & Portfolio Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <PortfolioIcon size={17} />
                        <span style={{
                          fontSize: '12.5px',
                          fontWeight: isActive ? 600 : 450,
                          color: isActive ? 'var(--text-primary, #111827)' : 'var(--text-secondary, #4b5563)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {portfolio.name}
                        </span>
                      </div>

                      {/* Right: Number of Trades Badge & Active Check / 3-dots Menu Button */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: isActive ? 600 : 450,
                          backgroundColor: isActive ? 'var(--bg-hover, rgba(0, 0, 0, 0.07))' : 'rgba(0, 0, 0, 0.035)',
                          color: isActive ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
                          padding: '1.5px 7px',
                          borderRadius: '9999px',
                          whiteSpace: 'nowrap',
                          border: `1px solid ${isActive ? 'color-mix(in srgb, var(--border-color, #e5e7eb) 45%, transparent)' : 'transparent'}`,
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}>
                          {tradeCount} {tradeCount === 1 ? 'trade' : 'trades'}
                        </span>

                        {isActive && (
                          <Check size={13} strokeWidth={2.5} style={{ color: 'var(--text-primary, #111827)', flexShrink: 0 }} />
                        )}

                        {/* 3 Vertical Dots Action Trigger */}
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingId(null);
                              setMenuOpenId(isMenuOpen ? null : portfolio.id);
                            }}
                            title="Portfolio actions"
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '4px',
                              cursor: 'pointer',
                              color: isMenuOpen ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.12s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)'}
                            onMouseLeave={(e) => {
                              if (!isMenuOpen) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <MoreVertical size={14} />
                          </button>

                          {/* 3-DOTS ACTION POPOVER */}
                          {isMenuOpen && (
                            <div
                              style={{
                                position: 'absolute',
                                right: '28px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                zIndex: 1010,
                                width: '130px',
                                backgroundColor: 'var(--bg-card, #ffffff)',
                                border: '1px solid var(--border-color, rgba(0, 0, 0, 0.12))',
                                borderRadius: '8px',
                                boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.18)',
                                padding: '4px',
                                animation: 'modernDropdownFadeIn 0.12s ease-out'
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Edit Action */}
                              <button
                                type="button"
                                onClick={(e) => handleStartRename(portfolio, e)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  width: '100%',
                                  padding: '6px 8px',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  color: 'var(--text-primary, #111827)',
                                  background: 'none',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface, rgba(0,0,0,0.05))'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <Edit3 size={13} color="var(--text-secondary, #6b7280)" />
                                <span>Edit Name</span>
                              </button>

                              {/* Delete Action */}
                              <button
                                type="button"
                                disabled={portfolios.length <= 1}
                                onClick={(e) => {
                                  if (portfolios.length > 1) {
                                    handlePromptDelete(portfolio, e);
                                  }
                                }}
                                title={portfolios.length <= 1 ? "Cannot delete only remaining portfolio" : "Delete portfolio"}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  width: '100%',
                                  padding: '6px 8px',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  color: portfolios.length <= 1 ? 'var(--text-muted, #a1a1aa)' : '#ef4444',
                                  background: 'none',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: portfolios.length <= 1 ? 'not-allowed' : 'pointer',
                                  textAlign: 'left',
                                  opacity: portfolios.length <= 1 ? 0.5 : 1
                                }}
                                onMouseEnter={(e) => {
                                  if (portfolios.length > 1) e.currentTarget.style.backgroundColor = '#fee2e2';
                                }}
                                onMouseLeave={(e) => {
                                  if (portfolios.length > 1) e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <Trash2 size={13} />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── DELETE CONFIRMATION POPOVER ──────────────────────────── */}
                  {isDeleting && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'var(--bg-card, #ffffff)',
                        borderRadius: '8px',
                        border: '1px solid #fca5a5',
                        zIndex: 1020,
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.12)',
                        animation: 'modernDropdownFadeIn 0.12s ease-out'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                        <AlertTriangle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#b91c1c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Delete portfolio?
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={handleCancelDelete}
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 500,
                            borderRadius: '4px',
                            border: '1px solid var(--border-color, #e5e7eb)',
                            backgroundColor: 'transparent',
                            color: 'var(--text-secondary, #6b7280)',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleConfirmDelete(portfolio.id, e)}
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(239, 68, 68, 0.2)'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{
            height: '1px',
            backgroundColor: 'var(--border-color, rgba(0,0,0,0.08))',
            margin: '6px 0 4px 0'
          }} />

          {/* ── CREATE A NEW PORTFOLIO BUTTON ────────────────────────────── */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              if (onOpenCreatePortfolio) {
                onOpenCreatePortfolio();
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '7px 10px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary, #111827)',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.12s ease',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface, rgba(0,0,0,0.05))'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: '1px dashed var(--border-color, #a1a1aa)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary, #71717a)'
            }}>
              <Plus size={12} strokeWidth={2.5} />
            </div>
            <span>Create a new portfolio</span>
          </button>
        </div>
      )}
    </div>
  );
}
