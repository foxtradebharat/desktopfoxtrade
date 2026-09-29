import React, { useState, useEffect } from 'react';

// Generates a consistent, beautiful color from the stock name
export const getAvatarColor = (name) => {
  const colors = [
    ['#6366f1','#eef2ff'], ['#10b981','#ecfdf5'], ['#f59e0b','#fffbeb'],
    ['#3b82f6','#eff6ff'], ['#ec4899','#fdf2f8'], ['#8b5cf6','#f5f3ff'],
    ['#14b8a6','#f0fdfa'], ['#f97316','#fff7ed'], ['#06b6d4','#ecfeff'],
    ['#84cc16','#f7fee7'],
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

import { getCorporateActionDetails } from '../utils/securityMaster.js';

export default function SymbolLogo({ symbol = '', companyName = '', size = 28, style = {} }) {
  const cleanSymbol = symbol.trim().toUpperCase().replace(/\.(NS|BO|NSE|BSE)$/i, '').replace(/[^A-Z0-9]/g, '');
  const ca = getCorporateActionDetails(cleanSymbol);
  const logoFallback = ca?.logoFallback;

  const slug = (companyName || symbol)
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');

  // Build the list of URLs to try in order
  const urls = [
    `https://images.dhan.co/symbol/${cleanSymbol}.png`,
    ...(logoFallback && logoFallback !== cleanSymbol ? [`https://images.dhan.co/symbol/${logoFallback}.png`] : []),
    `https://s3-symbol-logo.tradingview.com/${slug}.svg`,
    `https://companiesmarketcap.com/img/company-logos/64/${cleanSymbol}.png`,
    `https://s3-symbol-logo.tradingview.com/${cleanSymbol.toLowerCase()}.svg`,
  ];

  const [urlIndex, setUrlIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  // Reset when symbol changes
  useEffect(() => {
    setUrlIndex(0);
    setFailed(false);
  }, [symbol]);

  const handleError = () => {
    if (urlIndex < urls.length - 1) {
      setUrlIndex(urlIndex + 1);
    } else {
      setFailed(true);
    }
  };

  const [fgColor, bgColor] = getAvatarColor(symbol || 'X');
  const initials = symbol ? symbol.slice(0, 2).toUpperCase() : 'ST';

  if (failed || !symbol) {
    return (
      <div style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor: bgColor,
        color: fgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size > 24 ? '11px' : '9px',
        fontWeight: 800,
        flexShrink: 0,
        letterSpacing: '0.3px',
        boxShadow: `0 0 0 1px ${bgColor}, 0 0 0 2px ${fgColor}22`,
        ...style
      }}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={urls[urlIndex]}
      alt={symbol}
      crossOrigin="anonymous"
      onError={handleError}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        objectFit: 'contain',
        flexShrink: 0,
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-color, #e5e7eb)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        ...style
      }}
    />
  );
}
