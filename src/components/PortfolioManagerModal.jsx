import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
  X, 
  Plus, 
  Folder, 
  Check, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  Sparkles, 
  LayoutGrid, 
  Calendar, 
  Layers 
} from 'lucide-react';
import PortfolioIcon from './PortfolioIcon';
import { setBaseCapital } from '../db/configStore';

const PORTFOLIOS_STORAGE_KEY = 'tradeontip_portfolios';
const ACTIVE_PORTFOLIO_KEY = 'tradeontip_active_portfolio_id';

const DEFAULT_PORTFOLIOS = [
  {
    id: 'portfolio-default',
    name: 'My Portfolio',
    description: 'Default trading portfolio',
    baseCapital: 100000,
    currency: 'INR',
    createdAt: '2026-08-30'
  }
];

export function getStoredPortfolios() {
  try {
    const saved = localStorage.getItem(PORTFOLIOS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    return DEFAULT_PORTFOLIOS;
  } catch {
    return DEFAULT_PORTFOLIOS;
  }
}

export function getStoredActivePortfolioId() {
  try {
    const saved = localStorage.getItem(ACTIVE_PORTFOLIO_KEY);
    return saved || 'portfolio-default';
  } catch {
    return 'portfolio-default';
  }
}

export default function PortfolioManagerModal({
  isOpen,
  onClose,
  activePortfolioId,
  onSelectPortfolio,
  portfolios = [],
  onUpdatePortfolios,
  onShowToast,
  isPro = false,
  initialTab = 'list'
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'list'); // 'list' | 'create'
  const [menuOpenId, setMenuOpenId] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseCapitalInput, setBaseCapitalInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'list');
    } else {
      setActiveTab('list');
      setName('');
      setDescription('');
      setBaseCapitalInput('');
      setErrorMsg('');
      setMenuOpenId(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleCreatePortfolio = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a portfolio name');
      return;
    }

    const todayDate = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const parsedCap = Number(baseCapitalInput.trim() || 0);

    const newPortfolio = {
      id: `portfolio-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || 'No description provided.',
      baseCapital: parsedCap,
      currency: 'INR',
      createdAt: todayDate
    };

    // Store portfolio-specific base capital cleanly
    try {
      localStorage.setItem(`tradeontip_base_capital_${newPortfolio.id}`, String(parsedCap));
      setBaseCapital(newPortfolio.id, parsedCap).catch(() => {});
    } catch (_) {}

    // Clean local cache for this new portfolio ID before selecting it so it starts completely fresh
    try {
      const user = JSON.parse(localStorage.getItem('tradeontip_user') || '{}');
      if (user?.uid) {
        localStorage.setItem(`tradeontip_trades_v5_${user.uid}_${newPortfolio.id}`, '[]');
      }
      localStorage.setItem(`tradeontip_trades_v5_${newPortfolio.id}`, '[]');
    } catch (_) {}

    const updated = [...portfolios, newPortfolio];
    onUpdatePortfolios(updated);
    onSelectPortfolio(newPortfolio.id);

    if (onShowToast) {
      onShowToast({
        id: Date.now(),
        type: 'info',
        title: 'Portfolio created',
        description: `${newPortfolio.name} has been added to your portfolios`
      });
    }

    setName('');
    setDescription('');
    setErrorMsg('');
    setActiveTab('list');
  };

  const handleDeletePortfolio = (id, e) => {
    e.stopPropagation();
    if (portfolios.length <= 1) {
      alert('You must have at least one active portfolio.');
      return;
    }

    const portToDelete = portfolios.find(p => p.id === id);
    if (window.confirm(`Delete portfolio "${portToDelete?.name}"? All associated trades will be preserved.`)) {
      const updated = portfolios.filter((p) => p.id !== id);
      onUpdatePortfolios(updated);

      if (activePortfolioId === id) {
        onSelectPortfolio(updated[0].id);
      }

      if (onShowToast) {
        onShowToast({
          id: Date.now(),
          type: 'info',
          title: 'Portfolio deleted',
          description: `${portToDelete?.name || 'Portfolio'} was removed`
        });
      }
    }
    setMenuOpenId(null);
  };

  const handleSwitchPortfolio = (id, e) => {
    e.stopPropagation();
    onSelectPortfolio(id);
  };

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(6px)',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '780px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '20px',
          border: '1px solid var(--border-color, rgba(0, 0, 0, 0.12))',
          boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.25)',
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          overflow: 'hidden',
          color: 'var(--text-primary, #111827)',
          animation: 'modernDropdownFadeIn 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface, #fafafa)',
            borderRight: '1px solid var(--border-color, #f3f4f6)',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            {/* Logo Icon */}
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border-color, #e5e7eb)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: 'var(--text-primary, #111827)'
              }}
            >
              <PortfolioIcon size={20} />
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', letterSpacing: '-0.01em' }}>
              Portfolio Manager
            </h3>

            <p style={{ fontSize: '12px', color: 'var(--text-muted, #71717a)', lineHeight: '1.5', margin: 0 }}>
              Seamlessly specialized environments for your different trading strategies.
            </p>
          </div>

          {/* Bottom Summary: Total Portfolios */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary, #52525b)' }}>
                Total Portfolios
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #18181b)' }}>
                {portfolios.length}
              </span>
            </div>

            {/* Subtle Progress Bar */}
            <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-color, #e4e4e7)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  backgroundColor: '#18181b',
                  borderRadius: '9999px'
                }} 
              />
            </div>
          </div>
        </div>

        {/* ── RIGHT MAIN PANEL ──────────────────────────────────────────────── */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', minHeight: '380px' }}>
          
          {/* TAB 1: LIST VIEW */}
          {activeTab === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Header Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                  Your Portfolios
                </h4>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #e5e7eb)',
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      color: 'var(--text-primary, #18181b)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f4f4f5)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)'}
                  >
                    <Plus size={13} strokeWidth={2.5} />
                    <span>New Portfolio</span>
                    <Sparkles size={12} color="#f59e0b" />
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close modal"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '6px',
                      cursor: 'pointer',
                      color: 'var(--text-muted, #a1a1aa)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary, #18181b)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #a1a1aa)'}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Portfolio Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                {portfolios.map((portfolio) => {
                  const isActive = activePortfolioId === portfolio.id;
                  const isMenuOpen = menuOpenId === portfolio.id;

                  return (
                    <div
                      key={portfolio.id}
                      onClick={() => onSelectPortfolio(portfolio.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        borderRadius: '14px',
                        border: '1px solid var(--border-color, #e5e7eb)',
                        backgroundColor: 'var(--bg-card, #ffffff)',
                        transition: 'all 0.15s ease',
                        position: 'relative',
                        cursor: isActive ? 'default' : 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-hover, #cbd5e1)';
                        const switchBtn = e.currentTarget.querySelector('.switch-btn');
                        if (switchBtn) switchBtn.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
                        const switchBtn = e.currentTarget.querySelector('.switch-btn');
                        if (switchBtn) switchBtn.style.opacity = '0';
                      }}
                    >
                      {/* Left: Icon & Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg-surface, #f4f4f5)',
                            color: 'var(--text-secondary, #71717a)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <PortfolioIcon size={20} />
                        </div>

                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary, #18181b)' }}>
                            {portfolio.name}
                          </div>

                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #71717a)', marginTop: '2px' }}>
                            {portfolio.description || 'No description provided.'}
                          </div>

                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #a1a1aa)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={11} strokeWidth={1.5} />
                              {portfolio.createdAt || 'Aug 30, 2026'}
                            </span>
                            <span>•</span>
                            <span>{portfolio.currency || 'INR'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Badge, Switch Button, and Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isActive ? (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              letterSpacing: '0.02em',
                              backgroundColor: 'var(--bg-hover, #f4f4f5)',
                              color: 'var(--text-primary, #18181b)',
                              border: '1px solid var(--border-color, #e5e7eb)',
                              padding: '2.5px 8px',
                              borderRadius: '9999px',
                              textTransform: 'uppercase'
                            }}
                          >
                            Active
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="switch-btn"
                            onClick={(e) => handleSwitchPortfolio(portfolio.id, e)}
                            style={{
                              opacity: 0,
                              padding: '4px 10px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              borderRadius: '6px',
                              border: '1px solid var(--border-color, #e5e7eb)',
                              backgroundColor: 'var(--bg-card, #ffffff)',
                              color: 'var(--text-primary, #18181b)',
                              cursor: 'pointer',
                              transition: 'opacity 0.15s ease'
                            }}
                          >
                            Switch
                          </button>
                        )}

                        {/* 3-dots Menu Button */}
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(isMenuOpen ? null : portfolio.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '4px',
                              cursor: 'pointer',
                              color: 'var(--text-muted, #a1a1aa)',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>

                          {/* Action Popover Menu */}
                          {isMenuOpen && (
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                zIndex: 1000,
                                width: '130px',
                                backgroundColor: 'var(--bg-card, #ffffff)',
                                border: '1px solid var(--border-color, #e5e7eb)',
                                borderRadius: '10px',
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                                padding: '4px',
                                animation: 'modernDropdownFadeIn 0.12s ease-out'
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                disabled={portfolios.length <= 1}
                                onClick={(e) => handleDeletePortfolio(portfolio.id, e)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  width: '100%',
                                  padding: '7px 10px',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  color: portfolios.length <= 1 ? '#d4d4d8' : '#ef4444',
                                  background: 'none',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: portfolios.length <= 1 ? 'not-allowed' : 'pointer',
                                  textAlign: 'left'
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
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CREATE NEW VIEW (Matching video 00:24 - 00:36) */}
          {activeTab === 'create' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Header Tab Navigator */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-muted, #71717a)',
                      cursor: 'pointer'
                    }}
                  >
                    Portfolios
                  </button>

                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #18181b)' }}>
                    Create New
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close modal"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '6px',
                    cursor: 'pointer',
                    color: 'var(--text-muted, #a1a1aa)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleCreatePortfolio} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                {/* Plus Circle Icon */}
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    border: '1px dashed var(--border-color, #d4d4d8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted, #71717a)',
                    marginBottom: '14px'
                  }}
                >
                  <Plus size={18} strokeWidth={2} />
                </div>

                <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0' }}>
                  Create a New Portfolio
                </h4>

                <p style={{ fontSize: '12px', color: 'var(--text-muted, #71717a)', margin: '0 0 24px 0' }}>
                  Add a distinct workspace for your trading needs.
                </p>

                {/* Form Fields */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted, #71717a)', marginBottom: '6px' }}>
                      NAME
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Options Strategy"
                      value={name}
                      autoFocus
                      onChange={(e) => {
                        setName(e.target.value);
                        setErrorMsg('');
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: errorMsg ? '1px solid #ef4444' : '1px solid var(--border-color, #e4e4e7)',
                        backgroundColor: 'var(--bg-card, #ffffff)',
                        color: 'var(--text-primary, #18181b)',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    {errorMsg && (
                      <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                        {errorMsg}
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted, #71717a)', marginBottom: '6px' }}>
                      DESCRIPTION
                    </label>
                    <input
                      type="text"
                      placeholder="Optional brief description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color, #e4e4e7)',
                        backgroundColor: 'var(--bg-card, #ffffff)',
                        color: 'var(--text-primary, #18181b)',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted, #71717a)', marginBottom: '6px' }}>
                      STARTING CAPITAL (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="0 (or enter initial capital)"
                      value={baseCapitalInput}
                      onChange={(e) => setBaseCapitalInput(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color, #e4e4e7)',
                        backgroundColor: 'var(--bg-card, #ffffff)',
                        color: 'var(--text-primary, #18181b)',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Bottom Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: 'auto', paddingTop: '24px', width: '100%' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    style={{
                      padding: '9px 24px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color, #e4e4e7)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary, #52525b)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(0, 0, 0, 0.04))'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    style={{
                      padding: '9px 24px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color, #e4e4e7)',
                      backgroundColor: 'var(--bg-hover, #f4f4f5)',
                      color: 'var(--text-primary, #18181b)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-color, #e5e7eb)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f4f4f5)'}
                  >
                    Create Portfolio
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
