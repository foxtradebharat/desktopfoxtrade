import React from 'react';
import foxtradeEmblem from '../assets/foxtrade-square.png';

/**
 * FoxTrade Vector Emblem Logo
 * Sourced from IMG_3584-removebg-preview.png
 * Adaptively styled for Light, Dark, and Pitch-Black modes.
 */
export default function FoxTradeLogo({ 
  size = 24, 
  style = {}, 
  className = '',
  invertInLight = true
}) {
  const dimension = typeof size === 'number' ? `${size}px` : size;

  return (
    <img
      src={foxtradeEmblem}
      alt="FoxTrade Emblem"
      style={{
        width: dimension,
        height: dimension,
        objectFit: 'contain',
        flexShrink: 0,
        filter: invertInLight ? 'var(--foxtrade-logo-filter, none)' : 'none',
        ...style
      }}
      className={className}
      aria-hidden="true"
    />
  );
}

export { foxtradeEmblem };
