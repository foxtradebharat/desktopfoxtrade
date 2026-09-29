import React from 'react';

/**
 * NewsIcon component
 * Renders the custom financial news & corporate announcements emblem
 * (market newspaper with candlesticks, trend arrow, and headline bars).
 * 
 * Supports:
 * - 'image' (default): High-res transparent PNG derived directly from the user's icon with theme-aware CSS filtering.
 * - 'vector': Pixel-perfect SVG vector reproduction that scales smoothly and responds directly to currentColor.
 */
export default function NewsIcon({ 
  size = 15, 
  variant = 'image', 
  className = '', 
  style = {} 
}) {
  if (variant === 'image') {
    return (
      <img
        src="/news-icon.png"
        alt="News"
        width={size}
        height={size}
        className={`news-icon-img ${className}`}
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

  // Vector SVG reproduction
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`news-icon-svg ${className}`}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style
      }}
    >
      {/* Left folded page spine */}
      <path
        d="M 6.5 7.5 C 4.2 7.5 3.2 8.8 3.2 10.5 V 16.5 C 3.2 19.2 4.8 21 7.2 21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      
      {/* Main newspaper card outline */}
      <rect
        x="6"
        y="3"
        width="15.5"
        height="18"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      {/* Candlestick 1 */}
      <line x1="8.6" y1="7.8" x2="8.6" y2="13.2" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
      <rect x="7.7" y="9.2" width="1.8" height="2.8" rx="0.3" fill="currentColor" />

      {/* Candlestick 2 */}
      <line x1="11.4" y1="6" x2="11.4" y2="12.8" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
      <rect x="10.5" y="7.3" width="1.8" height="4" rx="0.3" fill="currentColor" />

      {/* Candlestick 3 */}
      <line x1="14.2" y1="4.5" x2="14.2" y2="12" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
      <rect x="13.3" y="5.8" width="1.8" height="4.8" rx="0.3" fill="currentColor" />

      {/* Upward Trend Arrow */}
      <path
        d="M 15.6 12.2 L 17.2 9.8 L 18.2 10.8 L 20.3 7.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points="20.5,6.5 18.8,6.8 20.8,8.8"
        fill="currentColor"
      />

      {/* Headline / Summary horizontal lines */}
      <rect x="7.8" y="14.4" width="12" height="1.5" rx="0.75" fill="currentColor" />
      <rect x="7.8" y="16.9" width="12" height="1.5" rx="0.75" fill="currentColor" />
      <rect x="7.8" y="19.3" width="8.2" height="1.5" rx="0.75" fill="currentColor" />
    </svg>
  );
}
