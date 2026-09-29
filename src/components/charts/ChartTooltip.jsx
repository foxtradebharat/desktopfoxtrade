import React from 'react';

/**
 * Reusable FoxTrade Chart Tooltip
 * Premium, minimal, data-focused tooltip component matching FoxTrade design system.
 */
export default function ChartTooltip({
  active,
  payload,
  label,
  title,
  unit = '',
  hideValues = false,
  formatter,
  customHeader,
  footer
}) {
  if (!active || !payload || !payload.length) return null;

  const displayTitle = title || label || (payload[0]?.payload?.xLabel) || (payload[0]?.payload?.date);
  const data = payload[0]?.payload || {};

  const formatVal = (val, name) => {
    if (hideValues) return '••••••';
    if (formatter) return formatter(val, name, data);
    if (typeof val !== 'number') return val;

    if (unit === '%') {
      return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
    }

    if (unit === '₹' || unit === 'INR' || !unit) {
      const sign = val > 0 ? '+' : val < 0 ? '-' : '';
      const abs = Math.abs(val);
      const formatted = abs.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      return `${sign}₹${formatted}`;
    }

    if (unit === 'R') {
      return `${val >= 0 ? '+' : ''}${val.toFixed(2)}R`;
    }

    return `${val.toLocaleString('en-IN')}${unit ? ' ' + unit : ''}`;
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface, rgba(255, 255, 255, 0.96))',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '12px',
        padding: '12px 14px',
        boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        minWidth: '200px',
        color: 'var(--text-primary, #111827)',
        fontSize: '12px',
        fontFamily: "'Inter', -apple-system, sans-serif",
        lineHeight: 1.4,
        pointerEvents: 'none'
      }}
    >
      {/* Header */}
      {customHeader ? (
        customHeader(data)
      ) : displayTitle ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '8px',
            paddingBottom: '6px',
            borderBottom: '1px solid var(--border-color, #f3f4f6)'
          }}
        >
          <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary, #111827)' }}>
            {displayTitle}
          </span>
          {data.ticker && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#4f46e5',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                padding: '1px 6px',
                borderRadius: '4px'
              }}
            >
              {data.ticker}
            </span>
          )}
        </div>
      ) : null}

      {/* Series Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {payload
          .filter((item) => item.value !== undefined && item.name !== '_hidden')
          .map((item, idx) => {
            const seriesColor = item.color || item.fill || item.stroke || '#3b82f6';
            const valNum = Number(item.value);
            const isValPositive = !isNaN(valNum) && valNum >= 0;

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: seriesColor,
                      flexShrink: 0
                    }}
                  />
                  <span style={{ color: 'var(--text-muted, #6b7280)', fontSize: '11.5px', fontWeight: 500 }}>
                    {item.name || item.dataKey}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '12px',
                    fontVariantNumeric: 'tabular-nums',
                    color: item.name?.toLowerCase().includes('loss') || (typeof valNum === 'number' && valNum < 0 && !item.name?.toLowerCase().includes('gross'))
                      ? '#ef4444'
                      : item.name?.toLowerCase().includes('win') || item.name?.toLowerCase().includes('profit') || (isValPositive && !item.name?.toLowerCase().includes('gross'))
                      ? '#10b981'
                      : 'var(--text-primary, #111827)'
                  }}
                >
                  {formatVal(item.value, item.name)}
                </span>
              </div>
            );
          })}
      </div>

      {/* Optional Footer */}
      {footer && (
        <div
          style={{
            marginTop: '8px',
            paddingTop: '6px',
            borderTop: '1px dashed var(--border-color, #e5e7eb)',
            fontSize: '11px',
            color: 'var(--text-muted, #6b7280)'
          }}
        >
          {typeof footer === 'function' ? footer(data) : footer}
        </div>
      )}
    </div>
  );
}
