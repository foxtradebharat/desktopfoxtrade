import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ChevronDown, HelpCircle, RotateCcw
} from 'lucide-react';

export const DEFAULT_CHART_SETTINGS = {
  // Candle visual settings
  bodyVisible: true,
  upColor: '#131722',
  downColor: '#131722',
  borderVisible: true,
  borderUpColor: '#131722',
  borderDownColor: '#131722',
  wickVisible: true,
  wickUpColor: '#131722',
  wickDownColor: '#131722',
  
  // Data modification
  adjustDividends: true,
  precision: 'Default',
  timezone: '(UTC+5:30) Kolkata',

  // Canvas settings
  canvasBgColor: 'transparent',
  showWatermark: true,
  vertGridVisible: false,
  vertGridColor: 'rgba(229, 231, 235, 0.35)',
  horzGridVisible: false,
  horzGridColor: 'rgba(229, 231, 235, 0.35)',
  crosshairColor: '#9ca3af',
};

export const COLOR_PRESETS = {
  Classic: {
    name: 'Classic',
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderUpColor: '#26a69a',
    borderDownColor: '#ef5350',
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350'
  },
  Monochrome: {
    name: 'Monochrome',
    upColor: '#111827',
    downColor: '#9ca3af',
    borderUpColor: '#111827',
    borderDownColor: '#9ca3af',
    wickUpColor: '#111827',
    wickDownColor: '#9ca3af'
  },
  Neon: {
    name: 'Neon',
    upColor: '#06b6d4',
    downColor: '#f43f5e',
    borderUpColor: '#06b6d4',
    borderDownColor: '#f43f5e',
    wickUpColor: '#06b6d4',
    wickDownColor: '#f43f5e'
  },
  ProBlue: {
    name: 'Pro Blue',
    upColor: '#3b82f6',
    downColor: '#f97316',
    borderUpColor: '#3b82f6',
    borderDownColor: '#f97316',
    wickUpColor: '#3b82f6',
    wickDownColor: '#f97316'
  },
  EmeraldRuby: {
    name: 'Emerald & Ruby',
    upColor: '#10b981',
    downColor: '#e11d48',
    borderUpColor: '#10b981',
    borderDownColor: '#e11d48',
    wickUpColor: '#10b981',
    wickDownColor: '#e11d48'
  }
};

const TRADINGVIEW_PALETTE_MATRIX = [
  // Row 1: Grayscale
  ['#ffffff', '#e0e3eb', '#d1d4dc', '#b2b5be', '#9598a1', '#787b86', '#5d606b', '#434651', '#2a2e39', '#131722'],
  // Row 2: Standard Vibrant Base Colors
  ['#f23645', '#ff9800', '#ffeb3b', '#4caf50', '#089981', '#00bcd4', '#2962ff', '#673ab7', '#9c27b0', '#e91e63'],
  // Row 3: Lightest Pastels
  ['#fccbcd', '#ffe0b2', '#fff9c4', '#c8e6c9', '#b2dfdb', '#b2ebf2', '#bbdefb', '#d1c4e9', '#e1bee7', '#f8bbd0'],
  // Row 4: Light Tints
  ['#f9989f', '#ffcc80', '#fff59d', '#a5d6a7', '#80cbc4', '#80deea', '#90caf9', '#b39ddb', '#ce93d8', '#f48fb1'],
  // Row 5: Medium Tints
  ['#f56470', '#ffb74d', '#fff176', '#81c784', '#4db6ac', '#4dd0e1', '#64b5f6', '#9575cd', '#ba68c8', '#f06292'],
  // Row 6: Deep Tones
  ['#f23645', '#ffa726', '#ffee58', '#66bb6a', '#26a69a', '#26c6da', '#42a5f5', '#7e57c2', '#ab47bc', '#ec407a'],
  // Row 7: Dark Tones
  ['#c2185b', '#f57c00', '#fbc02d', '#388e3c', '#00897b', '#00acc1', '#1e88e5', '#5e35b1', '#8e24aa', '#d81b60'],
  // Row 8: Deepest Dark Tones
  ['#880e4f', '#e65100', '#f57f17', '#1b5e20', '#004d40', '#006064', '#0d47a1', '#311b92', '#4a148c', '#ad1457']
];

function hexToRgb(hex) {
  if (!hex) return { r: 38, g: 166, b: 154 };
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return { r: 38, g: 166, b: 154 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function parseColorToHexAndOpacity(colorStr) {
  if (!colorStr) return { hex: '#26a69a', opacity: 100 };
  const str = String(colorStr).trim();
  if (str.startsWith('rgba') || str.startsWith('rgb')) {
    const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      const a = match[4] !== undefined ? parseFloat(match[4]) : 1;
      const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
      return { hex, opacity: Math.round(a * 100) };
    }
  }
  if (str.startsWith('#')) {
    if (str.length === 9) {
      const hex = str.slice(0, 7);
      const alphaHex = str.slice(7, 9);
      const alpha = parseInt(alphaHex, 16) / 255;
      return { hex, opacity: Math.round(alpha * 100) };
    }
    return { hex: str, opacity: 100 };
  }
  return { hex: '#26a69a', opacity: 100 };
}

function composeColor(hex, opacity) {
  if (opacity >= 100) return hex;
  const { r, g, b } = hexToRgb(hex);
  const alpha = (opacity / 100).toFixed(2);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 1:1 TradingView Color Picker Popover Component
function ColorPickerSwatch({ value, onChange, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [customColors, setCustomColors] = useState(['#e91e63', '#00e676']);
  const customInputRef = useRef(null);

  const { hex: activeHex, opacity: activeOpacity } = parseColorToHexAndOpacity(value);

  const handleSelectColor = (selectedHex) => {
    const nextColor = composeColor(selectedHex, activeOpacity);
    onChange(nextColor);
  };

  const handleOpacityChange = (newOpacity) => {
    const nextColor = composeColor(activeHex, parseInt(newOpacity, 10));
    onChange(nextColor);
  };

  const handleAddCustomColor = (newHex) => {
    if (!customColors.includes(newHex)) {
      setCustomColors(prev => [newHex, ...prev].slice(0, 8));
    }
    handleSelectColor(newHex);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Swatch Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          width: '28px',
          height: '24px',
          borderRadius: '6px',
          border: isOpen ? '2px solid #2962ff' : '1.5px solid #d1d5db',
          backgroundColor: value || '#26a69a',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.35 : 1,
          padding: 0,
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 1px #2962ff' : '0 1px 2px rgba(0,0,0,0.06)',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
        }}
        onMouseEnter={(e) => { if (!disabled && !isOpen) e.currentTarget.style.borderColor = '#9ca3af'; }}
        onMouseLeave={(e) => { if (!disabled && !isOpen) e.currentTarget.style.borderColor = '#d1d5db'; }}
      />

      {/* TradingView Color Palette Popover (1:1 with Screenshot) */}
      {isOpen && (
        <>
          <div 
            onClick={() => setIsOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1050, background: 'transparent' }}
          />
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '32px',
              right: 0,
              zIndex: 1060,
              width: '246px',
              backgroundColor: '#1e222d',
              borderRadius: '10px',
              border: '1px solid #2a2e39',
              boxShadow: '0 20px 45px rgba(0,0,0,0.7)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              animation: 'fadeIn 0.12s ease',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', Roboto, sans-serif"
            }}
          >
            {/* 8x10 Palette Matrix */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 1fr)',
              gap: '3px',
              userSelect: 'none'
            }}>
              {TRADINGVIEW_PALETTE_MATRIX.map((row, rIdx) => 
                row.map((colHex, cIdx) => {
                  const isSelected = activeHex.toLowerCase() === colHex.toLowerCase();
                  return (
                    <div
                      key={`${rIdx}-${cIdx}`}
                      onClick={() => handleSelectColor(colHex)}
                      title={colHex}
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '3px',
                        backgroundColor: colHex,
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                        border: isSelected ? '2px solid #ffffff' : (colHex === '#ffffff' ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent'),
                        boxShadow: isSelected ? '0 0 0 1px #131722' : 'none',
                        transition: 'transform 0.08s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    />
                  );
                })
              )}
            </div>

            {/* Subtle Divider */}
            <div style={{ borderTop: '1px solid #2a2e39', margin: '2px 0 0 0' }} />

            {/* Custom Colors & Add Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {customColors.map((c, i) => {
                const isSelected = activeHex.toLowerCase() === c.toLowerCase();
                return (
                  <div
                    key={i}
                    onClick={() => handleSelectColor(c)}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      backgroundColor: c,
                      cursor: 'pointer',
                      border: isSelected ? '2px solid #ffffff' : '1px solid #363a45',
                      boxShadow: isSelected ? '0 0 0 1px #131722' : 'none'
                    }}
                  />
                );
              })}

              {/* Plus Button for Custom Color */}
              <button
                type="button"
                onClick={() => customInputRef.current?.click()}
                title="Add custom color"
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: '1px dashed #50535e',
                  backgroundColor: 'transparent',
                  color: '#868993',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  padding: 0,
                  lineHeight: 1
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ffffff'; e.currentTarget.style.color = '#ffffff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#50535e'; e.currentTarget.style.color = '#868993'; }}
              >
                +
              </button>

              <input
                ref={customInputRef}
                type="color"
                value={activeHex}
                onChange={(e) => handleAddCustomColor(e.target.value)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              />
            </div>

            {/* Opacity Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#868993' }}>
                Opacity
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ position: 'relative', flex: 1, height: '14px', display: 'flex', alignItems: 'center' }}>
                  {/* Custom Checkered Gradient Track */}
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    height: '6px',
                    borderRadius: '9999px',
                    background: `linear-gradient(to right, transparent, ${activeHex}), repeating-conic-gradient(#434651 0% 25%, #2a2e39 0% 50%) 50% / 8px 8px`,
                    pointerEvents: 'none'
                  }} />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={activeOpacity}
                    onChange={(e) => handleOpacityChange(e.target.value)}
                    style={{
                      width: '100%',
                      opacity: 0,
                      cursor: 'pointer',
                      zIndex: 2,
                      height: '14px'
                    }}
                  />
                  {/* Visual Thumb Follower */}
                  <div style={{
                    position: 'absolute',
                    left: `calc(${activeOpacity}% - 7px)`,
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    border: '2px solid #131722',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                    pointerEvents: 'none',
                    zIndex: 1
                  }} />
                </div>

                <div style={{
                  width: '46px',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  backgroundColor: '#131722',
                  border: '1px solid #363a45',
                  color: '#f0f3fa',
                  fontSize: '11px',
                  fontWeight: 600,
                  textAlign: 'center'
                }}>
                  {activeOpacity}%
                </div>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}

export default function StockChartSettingsModal({
  isOpen,
  onClose,
  settings = DEFAULT_CHART_SETTINGS,
  onSaveSettings
}) {
  const [activeTab, setActiveTab] = useState('symbol'); // 'symbol' | 'canvas'
  const [localSettings, setLocalSettings] = useState(settings);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Sync settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings || DEFAULT_CHART_SETTINGS);
      setIsTemplateMenuOpen(false);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const updateSetting = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyPreset = (presetKey) => {
    const preset = COLOR_PRESETS[presetKey];
    if (preset) {
      setLocalSettings(prev => ({
        ...prev,
        upColor: preset.upColor,
        downColor: preset.downColor,
        borderUpColor: preset.borderUpColor,
        borderDownColor: preset.borderDownColor,
        wickUpColor: preset.wickUpColor,
        wickDownColor: preset.wickDownColor
      }));
    }
    setIsTemplateMenuOpen(false);
  };

  const handleResetDefaults = () => {
    setLocalSettings(DEFAULT_CHART_SETTINGS);
    setIsTemplateMenuOpen(false);
  };

  const handleOk = () => {
    if (onSaveSettings) {
      onSaveSettings(localSettings);
    }
    onClose();
  };

  const handleCancel = () => {
    setLocalSettings(settings);
    onClose();
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(6px)',
        padding: '16px',
        animation: 'fadeIn 0.15s ease'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      {/* Modal Dialog (Clean Theme) */}
      <div style={{
        width: '100%',
        maxWidth: '560px',
        height: '490px',
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '16px',
        border: '1px solid var(--border-color, #e5e7eb)',
        boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: 'var(--text-primary, #111827)',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', Roboto, Ubuntu, sans-serif"
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color, #e5e7eb)',
          backgroundColor: 'var(--bg-card, #ffffff)'
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #111827)', margin: 0, letterSpacing: '-0.01em' }}>
            Settings
          </h2>
          <button 
            onClick={handleCancel}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: 'var(--text-muted, #6b7280)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary, #111827)'; e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted, #6b7280)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Main: Sidebar + Content */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left Sidebar (Only Symbol & Canvas tabs) */}
          <div style={{
            width: '170px',
            backgroundColor: 'var(--bg-surface, #f9fafb)',
            borderRight: '1px solid var(--border-color, #e5e7eb)',
            padding: '14px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <button
              onClick={() => setActiveTab('symbol')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                border: activeTab === 'symbol' ? '1px solid var(--border-color, #e5e7eb)' : '1px solid transparent',
                backgroundColor: activeTab === 'symbol' ? 'var(--bg-card, #ffffff)' : 'transparent',
                color: activeTab === 'symbol' ? 'var(--text-primary, #111827)' : 'var(--text-secondary, #6b7280)',
                boxShadow: activeTab === 'symbol' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                fontSize: '13px',
                fontWeight: activeTab === 'symbol' ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'symbol') {
                  e.currentTarget.style.color = 'var(--text-primary, #111827)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f3f4f6)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'symbol') {
                  e.currentTarget.style.color = 'var(--text-secondary, #6b7280)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {/* Candlestick vector icon */}
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2h1v3h2v6H5v3H4v-3H2V5h2V2zm1 4H3v4h2V6zM11 1h1v4h2v5h-2v5h-1v-5H9V5h2V1zm1 5h-2v3h2V6z" />
              </svg>
              <span>Symbol</span>
            </button>

            <button
              onClick={() => setActiveTab('canvas')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                border: activeTab === 'canvas' ? '1px solid var(--border-color, #e5e7eb)' : '1px solid transparent',
                backgroundColor: activeTab === 'canvas' ? 'var(--bg-card, #ffffff)' : 'transparent',
                color: activeTab === 'canvas' ? 'var(--text-primary, #111827)' : 'var(--text-secondary, #6b7280)',
                boxShadow: activeTab === 'canvas' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                fontSize: '13px',
                fontWeight: activeTab === 'canvas' ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'canvas') {
                  e.currentTarget.style.color = 'var(--text-primary, #111827)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f3f4f6)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'canvas') {
                  e.currentTarget.style.color = 'var(--text-secondary, #6b7280)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {/* Pen / Canvas vector icon */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                <path d="m15 5 4 4"/>
              </svg>
              <span>Canvas</span>
            </button>
          </div>

          {/* Right Content Area */}
          <div style={{
            flex: 1,
            padding: '20px 24px',
            overflowY: 'auto',
            backgroundColor: 'var(--bg-card, #ffffff)'
          }}>
            {activeTab === 'symbol' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Section 1: CANDLES */}
                <div>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted, #6b7280)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginBottom: '14px'
                  }}>
                    CANDLES
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Row 1: Body */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={localSettings.bodyVisible}
                          onChange={(e) => updateSetting('bodyVisible', e.target.checked)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: '#2563eb'
                          }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #1f2937)' }}>Body</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ColorPickerSwatch
                          value={localSettings.upColor}
                          onChange={(c) => updateSetting('upColor', c)}
                          disabled={!localSettings.bodyVisible}
                        />
                        <ColorPickerSwatch
                          value={localSettings.downColor}
                          onChange={(c) => updateSetting('downColor', c)}
                          disabled={!localSettings.bodyVisible}
                        />
                      </div>
                    </div>

                    {/* Row 2: Borders */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={localSettings.borderVisible}
                          onChange={(e) => updateSetting('borderVisible', e.target.checked)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: '#2563eb'
                          }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #1f2937)' }}>Borders</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ColorPickerSwatch
                          value={localSettings.borderUpColor}
                          onChange={(c) => updateSetting('borderUpColor', c)}
                          disabled={!localSettings.borderVisible}
                        />
                        <ColorPickerSwatch
                          value={localSettings.borderDownColor}
                          onChange={(c) => updateSetting('borderDownColor', c)}
                          disabled={!localSettings.borderVisible}
                        />
                      </div>
                    </div>

                    {/* Row 3: Wick */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={localSettings.wickVisible}
                          onChange={(e) => updateSetting('wickVisible', e.target.checked)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: '#2563eb'
                          }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #1f2937)' }}>Wick</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ColorPickerSwatch
                          value={localSettings.wickUpColor}
                          onChange={(c) => updateSetting('wickUpColor', c)}
                          disabled={!localSettings.wickVisible}
                        />
                        <ColorPickerSwatch
                          value={localSettings.wickDownColor}
                          onChange={(c) => updateSetting('wickDownColor', c)}
                          disabled={!localSettings.wickVisible}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: DATA MODIFICATION */}
                <div style={{ borderTop: '1px solid var(--border-color, #f3f4f6)', paddingTop: '16px' }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted, #6b7280)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginBottom: '14px'
                  }}>
                    DATA MODIFICATION
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Row 1: Adjust data for dividends */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={localSettings.adjustDividends}
                          onChange={(e) => updateSetting('adjustDividends', e.target.checked)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: '#2563eb'
                          }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #1f2937)' }}>Adjust data for dividends</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <HelpCircle
                          size={15}
                          color="var(--text-muted, #9ca3af)"
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setShowTooltip(true)}
                          onMouseLeave={() => setShowTooltip(false)}
                        />
                        {showTooltip && (
                          <div style={{
                            position: 'absolute',
                            bottom: '22px',
                            right: 0,
                            width: '200px',
                            backgroundColor: 'var(--bg-surface, #1f2937)',
                            color: 'var(--text-primary, #ffffff)',
                            border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                            fontSize: '11px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                            zIndex: 100,
                            pointerEvents: 'none'
                          }}>
                            Adjust historical candle prices for corporate dividend payouts.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Precision */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #1f2937)' }}>Precision</span>
                      <div style={{ position: 'relative', width: '170px' }}>
                        <select
                          value={localSettings.precision}
                          onChange={(e) => updateSetting('precision', e.target.value)}
                          style={{
                            width: '100%',
                            backgroundColor: 'var(--bg-card, #ffffff)',
                            color: 'var(--text-primary, #111827)',
                            border: '1px solid var(--border-color, #d1d5db)',
                            borderRadius: '6px',
                            padding: '6px 28px 6px 10px',
                            fontSize: '12.5px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            appearance: 'none',
                            outline: 'none'
                          }}
                        >
                          <option value="Default">Default</option>
                          <option value="1/10">1/10 (0.1)</option>
                          <option value="1/100">1/100 (0.01)</option>
                          <option value="1/1000">1/1000 (0.001)</option>
                          <option value="1/10000">1/10000 (0.0001)</option>
                        </select>
                        <ChevronDown size={14} color="var(--text-muted, #6b7280)" style={{ position: 'absolute', right: '8px', top: '9px', pointerEvents: 'none' }} />
                      </div>
                    </div>

                    {/* Row 3: Timezone */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #1f2937)' }}>Timezone</span>
                      <div style={{ position: 'relative', width: '170px' }}>
                        <select
                          value={localSettings.timezone}
                          onChange={(e) => updateSetting('timezone', e.target.value)}
                          style={{
                            width: '100%',
                            backgroundColor: 'var(--bg-card, #ffffff)',
                            color: 'var(--text-primary, #111827)',
                            border: '1px solid var(--border-color, #d1d5db)',
                            borderRadius: '6px',
                            padding: '6px 28px 6px 10px',
                            fontSize: '12.5px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            appearance: 'none',
                            outline: 'none',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          <option value="(UTC+5:30) Kolkata">(UTC+5:30) Kolk...</option>
                          <option value="(UTC+0:00) London">(UTC+0:00) London</option>
                          <option value="(UTC-5:00) New York">(UTC-5:00) New York</option>
                          <option value="(UTC+8:00) Singapore">(UTC+8:00) Singapore</option>
                          <option value="(UTC+9:00) Tokyo">(UTC+9:00) Tokyo</option>
                          <option value="(UTC+1:00) Berlin">(UTC+1:00) Berlin</option>
                        </select>
                        <ChevronDown size={14} color="var(--text-muted, #6b7280)" style={{ position: 'absolute', right: '8px', top: '9px', pointerEvents: 'none' }} />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'canvas' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Canvas Background & Watermark */}
                <div>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted, #6b7280)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginBottom: '14px'
                  }}>
                    BACKGROUND & WATERMARK
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Watermark Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={localSettings.showWatermark}
                          onChange={(e) => updateSetting('showWatermark', e.target.checked)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563eb' }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #1f2937)' }}>FoxTrade Watermark</span>
                      </label>
                    </div>

                    {/* Canvas Background Color */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #1f2937)' }}>Chart Background</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => updateSetting('canvasBgColor', localSettings.canvasBgColor === 'transparent' ? '#ffffff' : 'transparent')}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color, #d1d5db)',
                            backgroundColor: localSettings.canvasBgColor === 'transparent' ? 'var(--bg-surface, #f3f4f6)' : 'var(--bg-card, #ffffff)',
                            color: 'var(--text-primary, #111827)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {localSettings.canvasBgColor === 'transparent' ? 'Transparent' : 'Solid Color'}
                        </button>
                        <ColorPickerSwatch
                          value={localSettings.canvasBgColor === 'transparent' ? '#ffffff' : localSettings.canvasBgColor}
                          onChange={(c) => updateSetting('canvasBgColor', c)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grid Lines & Crosshair */}
                <div style={{ borderTop: '1px solid var(--border-color, #f3f4f6)', paddingTop: '16px' }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted, #6b7280)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginBottom: '14px'
                  }}>
                    GRID LINES & CROSSHAIR
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Vert Grid Lines */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={localSettings.vertGridVisible}
                          onChange={(e) => updateSetting('vertGridVisible', e.target.checked)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563eb' }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #1f2937)' }}>Vertical Grid Lines</span>
                      </label>
                      <ColorPickerSwatch
                        value={localSettings.vertGridColor}
                        onChange={(c) => updateSetting('vertGridColor', c)}
                        disabled={!localSettings.vertGridVisible}
                      />
                    </div>

                    {/* Horz Grid Lines */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={localSettings.horzGridVisible}
                          onChange={(e) => updateSetting('horzGridVisible', e.target.checked)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563eb' }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #1f2937)' }}>Horizontal Grid Lines</span>
                      </label>
                      <ColorPickerSwatch
                        value={localSettings.horzGridColor}
                        onChange={(c) => updateSetting('horzGridColor', c)}
                        disabled={!localSettings.horzGridVisible}
                      />
                    </div>

                    {/* Crosshair */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #1f2937)' }}>Crosshair Color</span>
                      <ColorPickerSwatch
                        value={localSettings.crosshairColor}
                        onChange={(c) => updateSetting('crosshairColor', c)}
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* Footer (Template ⌵ on left, Cancel & Ok on right) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color, #e5e7eb)',
          backgroundColor: 'var(--bg-card, #ffffff)',
          position: 'relative'
        }}>
          {/* Template Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsTemplateMenuOpen(!isTemplateMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #d1d5db)',
                backgroundColor: 'var(--bg-surface, #f9fafb)',
                color: 'var(--text-primary, #111827)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f3f4f6)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f9fafb)'}
            >
              <span>Template</span>
              <ChevronDown size={14} color="var(--text-muted, #6b7280)" />
            </button>

            {isTemplateMenuOpen && (
              <>
                <div 
                  onClick={() => setIsTemplateMenuOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 105, background: 'transparent' }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: '38px',
                  left: 0,
                  width: '190px',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  borderRadius: '10px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                  padding: '6px',
                  zIndex: 110,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted, #6b7280)', padding: '4px 8px', letterSpacing: '0.04em' }}>
                    COLOR PRESETS
                  </div>
                  {Object.keys(COLOR_PRESETS).map(key => (
                    <button
                      key={key}
                      onClick={() => handleApplyPreset(key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary, #111827)',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span>{COLOR_PRESETS[key].name}</span>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLOR_PRESETS[key].upColor }} />
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLOR_PRESETS[key].downColor }} />
                      </div>
                    </button>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border-color, #f3f4f6)', margin: '4px 0' }} />
                  <button
                    onClick={handleResetDefaults}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-muted, #6b7280)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary, #111827)'; e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted, #6b7280)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <RotateCcw size={12} />
                    <span>Reset Defaults</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons: Cancel & Ok */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleCancel}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #d1d5db)',
                backgroundColor: 'var(--bg-card, #ffffff)',
                color: 'var(--text-primary, #374151)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f9fafb)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)'}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleOk}
              style={{
                padding: '6px 20px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            >
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
