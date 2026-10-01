import React from 'react';
import foxyAiBrain from '../assets/foxy-ai-brain.png';

/**
 * FoxyAiIcon
 * Custom Foxy AI Emblem (AI Brain with microchip processor).
 * Uses CSS mask to dynamically adapt to currentColor and themes (Light, Dark, Pitch-Black).
 */
export default function FoxyAiIcon({
  size = 15,
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
        mask: `url(${foxyAiBrain}) no-repeat center / contain`,
        WebkitMask: `url(${foxyAiBrain}) no-repeat center / contain`,
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

export { foxyAiBrain };
