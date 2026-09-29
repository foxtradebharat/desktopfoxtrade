import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export default function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  placeholder = '0',
  prefix = '',
  suffix = '',
  style = {},
  disabled = false
}) {
  const numVal = parseFloat(value) || 0;

  const handleStepUp = (e) => {
    e.stopPropagation();
    const next = numVal + step;
    if (max !== undefined && next > max) return;
    onChange(next);
  };

  const handleStepDown = (e) => {
    e.stopPropagation();
    const next = numVal - step;
    if (min !== undefined && next < min) return;
    onChange(next);
  };

  return (
    <div className="number-input-wrapper" style={{ position: 'relative', width: '100%' }}>
      {prefix && (
        <span style={{
          position: 'absolute',
          left: '8px',
          fontSize: '12px',
          color: '#9ca3af',
          pointerEvents: 'none',
          zIndex: 1
        }}>
          {prefix}
        </span>
      )}

      <input
        type="number"
        value={value !== undefined && value !== null ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%',
          padding: prefix ? '6px 28px 6px 20px' : '6px 28px 6px 8px',
          borderRadius: '6px',
          border: '1px solid var(--border-color, #d0d5dd)',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          fontSize: '13px',
          fontWeight: 500,
          outline: 'none',
          boxSizing: 'border-box',
          ...style
        }}
      />

      {suffix && (
        <span style={{
          position: 'absolute',
          right: '28px',
          fontSize: '12px',
          color: 'var(--text-muted, #9ca3af)',
          pointerEvents: 'none'
        }}>
          {suffix}
        </span>
      )}

      {/* Stepper Buttons (Visible on hover) */}
      <div 
        className="number-stepper-btn"
        style={{
          position: 'absolute',
          right: '4px',
          top: '3px',
          bottom: '3px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '1px',
          zIndex: 2
        }}
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={handleStepUp}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '11px',
            padding: 0,
            border: 'none',
            borderRadius: '2px',
            backgroundColor: 'var(--bg-card, #f3f4f6)',
            color: 'var(--text-secondary, #4b5563)',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover, #e5e7eb)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card, #f3f4f6)'}
        >
          <ChevronUp size={10} color="currentColor" />
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={handleStepDown}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '11px',
            padding: 0,
            border: 'none',
            borderRadius: '2px',
            backgroundColor: 'var(--bg-card, #f3f4f6)',
            color: 'var(--text-secondary, #4b5563)',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover, #e5e7eb)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card, #f3f4f6)'}
        >
          <ChevronDown size={10} color="currentColor" />
        </button>
      </div>
    </div>
  );
}
