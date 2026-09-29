import React from 'react';
import { GalleryVerticalEnd } from 'lucide-react';

export default function PortfolioIcon({ size = 18, strokeWidth = 2, style = {}, className = '', color = 'currentColor' }) {
  return (
    <GalleryVerticalEnd
      size={size}
      strokeWidth={strokeWidth}
      color={color}
      className={`portfolio-icon ${className}`}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style
      }}
    />
  );
}
