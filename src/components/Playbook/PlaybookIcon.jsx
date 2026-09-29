import React from 'react';
import playbookIconHd from '../../assets/playbook-icon-hd.png';

/**
 * PlaybookIcon
 * Custom Trading Playbook Emblem (Notebook with candlesticks, strategy arrow, spiral binding & pen).
 * Dynamically adapts to currentColor and theme (Light, Dark, Pitch-Black) via CSS mask.
 */
export default function PlaybookIcon({
  size = 18,
  color = 'currentColor',
  style = {},
  className = '',
  ...props
}) {
  const dimension = typeof size === 'number' ? `${size}px` : size;

  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: dimension,
        height: dimension,
        minWidth: dimension,
        minHeight: dimension,
        backgroundColor: color === 'currentColor' ? 'currentColor' : color,
        mask: `url(${playbookIconHd}) no-repeat center / contain`,
        WebkitMask: `url(${playbookIconHd}) no-repeat center / contain`,
        verticalAlign: 'middle',
        flexShrink: 0,
        lineHeight: 1,
        transition: 'background-color 0.18s ease, color 0.18s ease, transform 0.15s ease',
        ...style
      }}
      {...props}
    />
  );
}

export { playbookIconHd };
