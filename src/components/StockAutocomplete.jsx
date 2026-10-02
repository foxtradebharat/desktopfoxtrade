import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { searchStocks, getFallbackList } from '../services/stockService';
import { getCanonicalSymbol } from '../utils/securityMaster.js';
import SymbolLogo from './SymbolLogo';

export default function StockAutocomplete({ 
  value, 
  onChange, 
  placeholder = 'Stock name',
  width = '100%',
  market = 'india',
  style = {} 
}) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const highlightedRef = useRef(0);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 280 });
  const [suggestions, setSuggestions] = useState(() => getFallbackList(market).slice(0, 10));
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const isSelectingRef = useRef(false);

  // Sync external value
  useEffect(() => { setQuery(value || ''); }, [value]);

  // Keep highlighted suggestion in view when navigating via arrow keys
  useEffect(() => {
    if (open && listRef.current) {
      // Child 0 is header, so child (highlighted + 1) is the item
      const itemEl = listRef.current.children[highlighted + 1];
      if (itemEl && typeof itemEl.scrollIntoView === 'function') {
        itemEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlighted, open]);

  // Execute search when query or market changes
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const q = query.trim();
    if (!q) {
      setSuggestions(getFallbackList(market).slice(0, 10));
      highlightedRef.current = 0;
      setHighlighted(0);
      return;
    }

    setLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchStocks(q, market, 12);
        setSuggestions(results);
        highlightedRef.current = 0;
        setHighlighted(0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 40); // 40ms debounce for ultra-responsive feel

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query, market]);

  // Close on outside click
  useEffect(() => {
    const handle = (e) => {
      if (!inputRef.current?.contains(e.target)) {
        const portals = document.querySelectorAll('[data-stock-portal]');
        let clickedPortal = false;
        portals.forEach(p => { if (p.contains(e.target)) clickedPortal = true; });
        if (!clickedPortal) setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Compute dropdown position from input's bounding rect
  const updateDropPos = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropPos({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: Math.max(rect.width, 300),
    });
  }, []);

  const openDropdown = useCallback(() => {
    updateDropPos();
    setOpen(true);
    highlightedRef.current = 0;
    setHighlighted(0);
  }, [updateDropPos]);

  const commitSelection = (chosenSymbol) => {
    if (!chosenSymbol) return;
    isSelectingRef.current = true;
    const finalVal = getCanonicalSymbol(chosenSymbol);
    setQuery(finalVal);
    if (inputRef.current) {
      inputRef.current.value = finalVal;
    }
    setOpen(false);
    if (onChange && finalVal !== value) {
      onChange(finalVal);
    }
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 150);
  };

  const handleInput = (e) => {
    const val = e.target.value.toUpperCase();
    setQuery(val);
    highlightedRef.current = 0;
    setHighlighted(0);
    if (val.trim().length > 0) {
      updateDropPos();
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { 
      if (!open) {
        e.preventDefault();
        openDropdown();
        return;
      }
      e.preventDefault();
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        const next = Math.min(highlightedRef.current + 1, suggestions.length - 1);
        highlightedRef.current = next;
        setHighlighted(next); 
      } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
        const prev = Math.max(highlightedRef.current - 1, 0);
        highlightedRef.current = prev;
        setHighlighted(prev); 
      }
    }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const targetIdx = highlightedRef.current;
      if (open && suggestions.length > 0 && suggestions[targetIdx]) {
        commitSelection(suggestions[targetIdx].symbol);
      } else if (query.trim()) {
        commitSelection(query.trim().toUpperCase());
      }
      inputRef.current?.blur();
    } else if (e.key === 'Escape') { 
      setOpen(false); 
    }
    else if (e.key === 'Tab') { 
      const targetIdx = highlightedRef.current;
      if (open && suggestions.length > 0 && suggestions[targetIdx]) {
        commitSelection(suggestions[targetIdx].symbol);
      } else {
        setOpen(false); 
      }
    }
  };

  const handleSelect = (stock) => {
    commitSelection(stock.symbol);
  };

  // Portal dropdown
  const dropdown = open && suggestions.length > 0
    ? ReactDOM.createPortal(
        <div
          ref={listRef}
          data-stock-portal="true"
          style={{
            position: 'absolute',
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 99999,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: '0 20px 40px -8px rgba(0,0,0,0.3), 0 8px 16px -6px rgba(0,0,0,0.15)',
            maxHeight: '290px',
            overflowY: 'auto',
            padding: '4px 0'
          }}>
          {/* Header */}
          <div style={{
            padding: '6px 12px 4px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.6px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>{market === 'us' ? 'US Equities & ETFs' : 'Indian Equities (NSE/BSE)'}</span>
            <span>{suggestions.length} result{suggestions.length !== 1 ? 's' : ''}</span>
          </div>

          {suggestions.map((stock, i) => (
            <div
              key={`${stock.symbol}-${stock.exchange || 'NSE'}`}
              data-stock-portal="true"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(stock); }}
              onMouseEnter={() => {
                highlightedRef.current = i;
                setHighlighted(i);
              }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor: i === highlighted ? 'var(--bg-hover)' : 'transparent',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-color)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                transition: 'background 0.1s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                <SymbolLogo symbol={stock.symbol} companyName={stock.name} size={22} />
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontWeight: 700,
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      lineHeight: 1.2
                    }}>
                      {stock.symbol}
                    </span>
                    {stock.alias && (
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        padding: '1.5px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-hover, #f3f4f6)',
                        color: 'var(--text-primary, #111827)',
                        border: '1px solid var(--border-color, #e5e7eb)',
                        letterSpacing: '0.25px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        lineHeight: 1.2
                      }}>
                        <span style={{ opacity: 0.75 }}>Formerly</span>
                        <span style={{ fontWeight: 700 }}>{stock.alias}</span>
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {stock.name}
                  </span>
                </div>
              </div>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '5px',
                backgroundColor: stock.exchange === 'BSE' ? '#fef3c7' : (stock.exchange === 'NASDAQ' ? '#e0f2fe' : '#ecfdf5'),
                color: stock.exchange === 'BSE' ? '#92400e' : (stock.exchange === 'NASDAQ' ? '#0369a1' : '#065f46'),
                flexShrink: 0,
                letterSpacing: '0.4px'
              }}>
                {stock.exchange || 'NSE'}
              </span>
            </div>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: width }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        style={{
          width: '100%',
          padding: '4px 6px',
          borderRadius: '6px',
          border: '1px solid transparent',
          backgroundColor: 'transparent',
          outline: 'none',
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          boxSizing: 'border-box',
          cursor: 'text',
          transition: 'all 0.15s ease',
          ...style
        }}
        onMouseEnter={(e) => {
          if (document.activeElement !== e.target) {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          }
        }}
        onMouseLeave={(e) => {
          if (document.activeElement !== e.target) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
        onFocus={(e) => {
          e.target.select();
          e.currentTarget.style.border = '1px solid var(--border-color)';
          e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
        }}
        onBlur={(e) => {
          if (isSelectingRef.current) return;
          const rawVal = e.target.value.trim().toUpperCase();
          const finalVal = getCanonicalSymbol(rawVal);
          setQuery(finalVal);
          if (onChange && finalVal !== value) {
            onChange(finalVal);
          }
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.style.border = '1px solid transparent';
              inputRef.current.style.backgroundColor = 'transparent';
            }
          }, 200);
        }}
      />
      {dropdown}
    </div>
  );
}
