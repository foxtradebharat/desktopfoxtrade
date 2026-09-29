import React, { useEffect } from 'react';
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
      </div>
    </div>
  );
}
