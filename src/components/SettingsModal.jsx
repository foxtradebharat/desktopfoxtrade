import React, { useEffect, useState } from 'react';
import { X, RotateCcw } from 'lucide-react';

const FONT_OPTIONS = [
  {
    id: 'default',
    title: 'Default',
    subLabel: 'Inter',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  },
  {
    id: 'soft',
    title: 'Soft',
    subLabel: 'Nunito Sans',
    fontFamily: "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  },
  {
    id: 'modern',
    title: 'Modern',
    subLabel: 'DM Sans',
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  },
  {
    id: 'classic',
    title: 'Classic',
    subLabel: 'Lora',
    fontFamily: "'Lora', Georgia, serif"
  }
];

const WEIGHT_OPTIONS = [
  { id: 'light', label: 'Light', value: '300' },
  { id: 'regular', label: 'Regular', value: '400' },
  { id: 'medium', label: 'Medium', value: '500' }
];

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  settings = {},
  onUpdateSetting
}) {
  const currentFont = settings.fontFamily || 'default';
  const currentWeight = settings.fontWeight || 'regular';
  const currentScale = settings.scale || settings.fontSize || 100;

  const [autoLaunch, setAutoLaunch] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [updaterState, setUpdaterState] = useState({ status: 'idle', lastChecked: null, version: null });
  const [autoDownload, setAutoDownload] = useState(true);
  const isDesktop = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);

  useEffect(() => {
    if (isDesktop && window.electronAPI?.system?.getAutoLaunch) {
      window.electronAPI.system.getAutoLaunch().then(enabled => {
        setAutoLaunch(Boolean(enabled));
      }).catch(() => {});
    }
    if (isDesktop && window.electronAPI?.notifications?.getStatus) {
      window.electronAPI.notifications.getStatus().then(status => {
        if (status && typeof status.enabled === 'boolean') {
          setNotificationsEnabled(status.enabled);
        }
      }).catch(() => {});
    }
    if (isDesktop) {
      const updater = window.updater || window.electronAPI?.updater;
      if (updater) {
        updater.getVersion?.().then(v => { if (v) setAppVersion(v); }).catch(() => {});
        updater.getState?.().then(st => {
          if (st) {
            setUpdaterState(st);
            if (typeof st.autoDownload === 'boolean') setAutoDownload(st.autoDownload);
          }
        }).catch(() => {});
        const unsub = updater.onState?.(st => {
          if (st) {
            setUpdaterState(st);
            if (typeof st.autoDownload === 'boolean') setAutoDownload(st.autoDownload);
          }
        });
        return () => {
          if (typeof unsub === 'function') unsub();
        };
      }
    }
  }, [isOpen, isDesktop]);

  const handleToggleAutoLaunch = async () => {
    if (!isDesktop || !window.electronAPI?.system?.setAutoLaunch) return;
    try {
      const next = !autoLaunch;
      const res = await window.electronAPI.system.setAutoLaunch(next);
      setAutoLaunch(Boolean(res));
    } catch (err) {
      console.error('Failed to toggle auto launch:', err);
    }
  };

  const handleToggleNotifications = async () => {
    if (!isDesktop || !window.electronAPI?.notifications?.setEnabled) return;
    try {
      const next = !notificationsEnabled;
      const res = await window.electronAPI.notifications.setEnabled(next);
      setNotificationsEnabled(Boolean(res));
    } catch (err) {
      console.error('Failed to toggle notifications:', err);
    }
  };

  const handleSendTestNotification = () => {
    if (isDesktop && window.electronAPI?.notifications?.show) {
      window.electronAPI.notifications.show({
        title: 'FoxTrade — Notification Test',
        body: 'Windows native notifications are working perfectly!'
      });
    }
  };

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

  const handleSelectFont = (fontId) => {
    if (onUpdateSetting) {
      onUpdateSetting('fontFamily', fontId);
    }
  };

  const handleSelectWeight = (weightId) => {
    if (onUpdateSetting) {
      onUpdateSetting('fontWeight', weightId);
    }
  };

  const handleScaleChange = (newScale) => {
    const val = parseInt(newScale, 10);
    if (onUpdateSetting && !isNaN(val)) {
      onUpdateSetting('scale', val);
      onUpdateSetting('fontSize', val);
    }
  };

  const handleResetDefaults = () => {
    if (onUpdateSetting) {
      onUpdateSetting('fontFamily', 'default');
      onUpdateSetting('fontWeight', 'regular');
      onUpdateSetting('scale', 100);
      onUpdateSetting('fontSize', 100);
    }
  };

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
      {/* Modal Card Container */}
      <div 
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '24px',
          border: '1px solid var(--border-color, #e5e7eb)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.1)',
          padding: '24px 28px 28px 28px',
          position: 'relative',
          color: 'var(--text-primary, #111827)',
          animation: 'modernDropdownFadeIn 0.15s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Right Controls: Reset to default button + Close X */}
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {/* Small button with reverse icon: Reset to default */}
          <button
            type="button"
            onClick={handleResetDefaults}
            title="Reset to default"
            aria-label="Reset to default"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              fontSize: '11.5px',
              fontWeight: 600,
              color: 'var(--text-secondary, #4b5563)',
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)';
              e.currentTarget.style.color = 'var(--text-primary, #111827)';
              e.currentTarget.style.borderColor = 'var(--border-color, #d1d5db)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
              e.currentTarget.style.color = 'var(--text-secondary, #4b5563)';
              e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface, #e5e7eb)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)';
            }}
          >
            <RotateCcw size={12} strokeWidth={2.2} />
            <span>Reset to default</span>
          </button>

          {/* Close Button X */}
          <button
            onClick={onClose}
            aria-label="Close Settings"
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              borderRadius: '50%',
              cursor: 'pointer',
              color: 'var(--text-muted, #6b7280)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)';
              e.currentTarget.style.color = 'var(--text-primary, #111827)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted, #6b7280)';
            }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* ── Top Header: [T] Icon + Typography Title & Subtitle ────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          {/* Rounded square with letter 'T' */}
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-surface, #f4f4f5)',
            border: '1px solid var(--border-color, #e4e4e7)',
            boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: 500,
            fontFamily: "'Lora', Georgia, serif",
            color: 'var(--text-primary, #18181b)',
            userSelect: 'none',
            flexShrink: 0
          }}>
            T
          </div>

          <div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-primary, #111827)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}>
              Typography
            </h2>
            <p style={{
              fontSize: '12.5px',
              color: 'var(--text-secondary, #6b7280)',
              margin: '3px 0 0 0',
              fontWeight: 400
            }}>
              Adjust readability across the application
            </p>
          </div>
        </div>

        {/* ── Main Settings Card Container (1:1 with Image 1) ───────────────── */}
        <div style={{
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '16px',
          padding: '20px',
          backgroundColor: 'var(--bg-surface, #ffffff)'
        }}>
          {/* Row 1: UI font header + Light | Regular | Medium segmented pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div>
              <div style={{
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--text-primary, #111827)'
              }}>
                UI font
              </div>
              <div style={{
                fontSize: '11.5px',
                color: 'var(--text-secondary, #6b7280)',
                marginTop: '2px',
                lineHeight: 1.4
              }}>
                Applies across FoxTrade. Prices and table data stay aligned.
              </div>
            </div>

            {/* Segmented Switcher: Light | Regular | Medium */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-card, #f3f4f6)',
              borderRadius: '9999px',
              padding: '3px',
              gap: '2px',
              flexShrink: 0
            }}>
              {WEIGHT_OPTIONS.map((opt) => {
                const isSelected = currentWeight === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectWeight(opt.id)}
                    style={{
                      border: isSelected ? '1px solid var(--border-color, rgba(0, 0, 0, 0.06))' : '1px solid transparent',
                      backgroundColor: isSelected ? 'var(--bg-surface, #ffffff)' : 'transparent',
                      color: isSelected ? 'var(--text-primary, #111827)' : 'var(--text-secondary, #6b7280)',
                      borderRadius: '9999px',
                      padding: '4px 11px',
                      fontSize: '11.5px',
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-surface, #e5e7eb)';
                        e.currentTarget.style.color = 'var(--text-primary, #111827)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary, #6b7280)';
                      }
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 2: 2x2 Grid of Font Options (Default, Soft, Modern, Classic) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            marginTop: '16px'
          }}>
            {FONT_OPTIONS.map((font) => {
              const isSelected = currentFont === font.id;
              return (
                <div
                  key={font.id}
                  onClick={() => handleSelectFont(font.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: isSelected ? '1.5px solid var(--text-primary, #111827)' : '1px solid var(--border-color, #e5e7eb)',
                    backgroundColor: isSelected ? 'var(--bg-primary, #f9fafb)' : 'var(--bg-card, #ffffff)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 1px 2px rgba(0, 0, 0, 0.04)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)';
                      e.currentTarget.style.borderColor = 'var(--border-color, #d1d5db)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
                      e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
                    }
                  }}
                >
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-primary, #111827)',
                    fontFamily: font.fontFamily
                  }}>
                    {font.title}
                  </div>
                  <div style={{
                    fontSize: '11.5px',
                    color: 'var(--text-secondary, #6b7280)',
                    marginTop: '2px',
                    fontFamily: font.fontFamily
                  }}>
                    {font.subLabel}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Row 3: Horizontal Divider */}
          <div style={{
            height: '1px',
            backgroundColor: 'var(--border-color, #f0f0f2)',
            margin: '20px 0'
          }} />

          {/* Row 4: Scale Slider Section */}
          <div>
            {/* Scale title & current percentage badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px'
            }}>
              <span style={{
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--text-secondary, #4b5563)'
              }}>
                Scale
              </span>
              <span style={{
                fontSize: '12.5px',
                fontWeight: 700,
                color: 'var(--text-primary, #111827)'
              }}>
                {currentScale}%
              </span>
            </div>

            {/* Slider Input with monochrome styling */}
            <input
              type="range"
              min="60"
              max="140"
              step="5"
              value={currentScale}
              onChange={(e) => handleScaleChange(e.target.value)}
              style={{
                width: '100%',
                height: '4px',
                cursor: 'pointer',
                accentColor: 'var(--text-primary, #111827)',
                marginBottom: '10px'
              }}
            />

            {/* Scale Range Anchor Labels: COMPACT | COMFORTABLE | SPACIOUS */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              userSelect: 'none'
            }}>
              <span
                onClick={() => handleScaleChange(75)}
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: currentScale <= 80 ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary, #111827)'}
                onMouseLeave={(e) => {
                  if (currentScale > 80) e.currentTarget.style.color = 'var(--text-muted, #9ca3af)';
                }}
              >
                COMPACT
              </span>
              <span
                onClick={() => handleScaleChange(100)}
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: (currentScale > 80 && currentScale < 120) ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary, #111827)'}
                onMouseLeave={(e) => {
                  if (currentScale <= 80 || currentScale >= 120) e.currentTarget.style.color = 'var(--text-muted, #9ca3af)';
                }}
              >
                COMFORTABLE
              </span>
              <span
                onClick={() => handleScaleChange(125)}
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: currentScale >= 120 ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary, #111827)'}
                onMouseLeave={(e) => {
                  if (currentScale < 120) e.currentTarget.style.color = 'var(--text-muted, #9ca3af)';
                }}
              >
                SPACIOUS
              </span>
            </div>
          </div>
        </div>

        {/* ── Windows Desktop Settings (Visible only in Electron) ────────── */}
        {isDesktop && (
          <div style={{
            marginTop: '16px',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: '16px',
            padding: '20px',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* Row 1: Auto-Launch */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div>
                <div style={{
                  fontSize: '13.5px',
                  fontWeight: 700,
                  color: 'var(--text-primary, #111827)'
                }}>
                  Launch on Windows startup
                </div>
                <div style={{
                  fontSize: '11.5px',
                  color: 'var(--text-secondary, #6b7280)',
                  marginTop: '2px',
                  lineHeight: 1.4
                }}>
                  Automatically start FoxTrade when your computer boots up.
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={autoLaunch}
                onClick={handleToggleAutoLaunch}
                style={{
                  width: '42px',
                  height: '24px',
                  borderRadius: '9999px',
                  backgroundColor: autoLaunch ? '#2563eb' : 'var(--border-color, #d1d5db)',
                  border: 'none',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  flexShrink: 0,
                  padding: 0
                }}
              >
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  position: 'absolute',
                  top: '3px',
                  left: autoLaunch ? '21px' : '3px',
                  transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </button>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--border-color, #f3f4f6)' }} />

            {/* Row 2: Market & Journaling Notifications */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div>
                <div style={{
                  fontSize: '13.5px',
                  fontWeight: 700,
                  color: 'var(--text-primary, #111827)'
                }}>
                  Market & Journaling Reminders
                </div>
                <div style={{
                  fontSize: '11.5px',
                  color: 'var(--text-secondary, #6b7280)',
                  marginTop: '2px',
                  lineHeight: 1.4
                }}>
                  Pre-market checklist at 09:00 AM & post-market review prompt at 03:45 PM IST.
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={notificationsEnabled}
                onClick={handleToggleNotifications}
                style={{
                  width: '42px',
                  height: '24px',
                  borderRadius: '9999px',
                  backgroundColor: notificationsEnabled ? '#2563eb' : 'var(--border-color, #d1d5db)',
                  border: 'none',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  flexShrink: 0,
                  padding: 0
                }}
              >
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  position: 'absolute',
                  top: '3px',
                  left: notificationsEnabled ? '21px' : '3px',
                  transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </button>
            </div>

            {/* Row 3: Send Test Notification Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
              <button
                type="button"
                onClick={handleSendTestNotification}
                style={{
                  background: 'none',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  borderRadius: '8px',
                  padding: '5px 12px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'var(--text-secondary, #4b5563)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--text-primary, #111827)';
                  e.currentTarget.style.color = 'var(--text-primary, #111827)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
                  e.currentTarget.style.color = 'var(--text-secondary, #4b5563)';
                }}
              >
                Send Test Notification
              </button>
            </div>
          </div>
        )}

        {/* ── 5. About FoxTrade & Auto-Updates (Desktop Only) ── */}
        {isDesktop && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-primary, #f9fafb)',
            border: '1px solid var(--border-color, #e5e7eb)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--text-primary, #111827)'
                }}>
                  About FoxTrade & Updates
                </div>
                <div style={{
                  fontSize: '11.5px',
                  color: 'var(--text-secondary, #6b7280)',
                  marginTop: '2px'
                }}>
                  Current Version: <strong>v{appVersion}</strong>
                  {updaterState.lastChecked && (
                    <span> · Last checked: {new Date(updaterState.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const updater = window.updater || window.electronAPI?.updater;
                  updater?.check?.();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                Check for Updates
              </button>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--border-color, #f3f4f6)' }} />

            {/* Toggle: Download updates automatically */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #111827)'
                }}>
                  Download updates automatically
                </div>
                <div style={{
                  fontSize: '11.5px',
                  color: 'var(--text-secondary, #6b7280)',
                  marginTop: '1px'
                }}>
                  Automatically downloads signed releases in background and notifies you when ready.
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={autoDownload}
                onClick={() => {
                  const updater = window.updater || window.electronAPI?.updater;
                  const next = !autoDownload;
                  setAutoDownload(next);
                  updater?.setAutoDownload?.(next);
                }}
                style={{
                  width: '42px',
                  height: '24px',
                  borderRadius: '9999px',
                  backgroundColor: autoDownload ? '#2563eb' : 'var(--border-color, #d1d5db)',
                  border: 'none',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  flexShrink: 0,
                  padding: 0
                }}
              >
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  position: 'absolute',
                  top: '3px',
                  left: autoDownload ? '21px' : '3px',
                  transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </button>
            </div>

            {/* Open logs action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
              <button
                type="button"
                onClick={() => {
                  const updater = window.updater || window.electronAPI?.updater;
                  updater?.openLogs?.();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: '11.5px',
                  color: 'var(--text-secondary, #6b7280)',
                  textDecoration: 'underline',
                  cursor: 'pointer'
                }}
              >
                Open Updater Logs Folder
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
