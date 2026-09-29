import React from 'react';

/**
 * PnlIcon component
 * Renders the custom P&L icon (ascending bars, upward growth curve, and green/red profit/loss indicator).
 * 
 * Supports:
 * - 'vector' (default): Pixel-perfect SVG that dynamically matches the button's active/inactive text color
 *   for the bars and arrow, while preserving vibrant green (#10b981) and red (#ef4444) for the indicators.
 * - 'image': Renders the user's high-res transparent PNG (chart-only cropped).
 * - 'image-full': Renders the full PNG including the 'P&L' text.
 */
export default function PnlIcon({ 
  size = 15, 
  variant = 'vector', 
  className = '', 
  style = {} 
}) {
  if (variant === 'image' || variant === 'image-full') {
    const src = variant === 'image-full' ? '/pnl-icon.png' : '/pnl-icon-chart.png';
    return (
      <img
        src={src}
        alt="P&L"
        width={size}
        height={size}
        className={`pnl-icon-img ${className}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: 'contain',
          display: 'inline-block',
          verticalAlign: 'middle',
          flexShrink: 0,
          ...style
        }}
      />
    );
  }

  // Pixel-perfect SVG vector recreation of the user's emblem
  // Scalable, crisp at 14-18px, responsive to currentColor, works seamlessly in Light and Dark modes
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`pnl-icon-svg ${className}`}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style
      }}
    >
      {/* 4 Ascending Volume/Profit Bars */}
      <rect x="1.5" y="14" width="2.8" height="6.5" rx="0.75" fill="currentColor" />
      <rect x="5.2" y="11.2" width="2.8" height="9.3" rx="0.75" fill="currentColor" />
      <rect x="8.9" y="8.2" width="2.8" height="12.3" rx="0.75" fill="currentColor" />
      <rect x="12.6" y="5.2" width="2.8" height="15.3" rx="0.75" fill="currentColor" />

      {/* Upward Growth Trend Curve */}
      <path
        d="M 1.5 11 C 5 8.5 9.5 5.5 13.5 3.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Trend Arrowhead */}
      <path
        d="M 11.5 2.2 L 15.2 2.2 L 15.2 5.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Green Up Triangle (Profit/Gain) */}
      <path
        d="M 19.5 7.5 L 17 11.5 H 22 Z"
        fill="#10b981"
      />

      {/* Red Down Triangle (Loss/Risk) */}
      <path
        d="M 19.5 18.5 L 22 14.5 H 17 Z"
        fill="#ef4444"
      />
    </svg>
  );
}
