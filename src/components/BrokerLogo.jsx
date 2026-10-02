import React, { useState } from 'react';
import { getBrokerLogo, getBrokerDisplayName } from '../services/brokerLogos';

/**
 * BrokerLogo Component
 * 
 * Renders official broker logo image.
 * Falls back to clean initials or neutral dash if image is missing or errors.
 */
export default function BrokerLogo({
  broker,
  size = 16,
  style = {},
  className = '',
  showFallbackText = false
}) {
  const [hasError, setHasError] = useState(false);
  const logoUrl = getBrokerLogo(broker);
  const displayName = getBrokerDisplayName(broker);

  if (!broker || broker === 'not_defined' || !logoUrl || hasError) {
    const initial = broker && broker !== 'not_defined' ? displayName.slice(0, 2).toUpperCase() : '—';
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${size}px`,
          height: `${size}px`,
          minWidth: `${size}px`,
          borderRadius: '4px',
          backgroundColor: '#f3f4f6',
          color: '#6b7280',
          fontSize: `${Math.max(9, Math.round(size * 0.55))}px`,
          fontWeight: 700,
          userSelect: 'none',
          flexShrink: 0,
          ...style
        }}
        className={className}
        title={displayName}
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${displayName} logo`}
      loading="lazy"
      onError={() => setHasError(true)}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        objectFit: 'contain',
        borderRadius: '3px',
        flexShrink: 0,
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style
      }}
      className={className}
      title={displayName}
    />
  );
}
