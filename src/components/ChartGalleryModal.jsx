import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  LayoutGrid, 
  Image as ImageIcon, 
  Filter, 
  ZoomOut, 
  ZoomIn, 
  Download, 
  Maximize2, 
  Minimize2, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Check,
  Info 
} from 'lucide-react';
import SymbolLogo from './SymbolLogo';

/**
 * Modern, aesthetic custom dropdown for filter selections
 * Zero blue colors, smooth subtle gray hover transitions, elevated popover menu, checkmark indicator
 */
function ModernDropdown({
  options = [],
  value,
  onChange,
  isDark = false,
  minWidth = '120px'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  const borderCol = isDark ? 'rgba(255, 255, 255, 0.12)' : '#e5e7eb';
  const borderColHover = isDark ? 'rgba(255, 255, 255, 0.25)' : '#d1d5db';
  const borderColActive = isDark ? 'rgba(255, 255, 255, 0.4)' : '#9ca3af';
  const bgSurface = isDark ? '#111827' : '#ffffff';
  const textPrimary = isDark ? '#f9fafb' : '#111827';
  const textMuted = isDark ? '#9ca3af' : '#6b7280';
  const hoverBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          height: '32px',
          minWidth: minWidth,
          padding: '0 10px',
          borderRadius: '6px',
          border: `1px solid ${isOpen ? borderColActive : borderCol}`,
          backgroundColor: bgSurface,
          color: textPrimary,
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          boxShadow: isOpen 
            ? (isDark ? '0 0 0 2px rgba(255, 255, 255, 0.08)' : '0 0 0 2px rgba(0, 0, 0, 0.04)')
            : '0 1px 2px rgba(0, 0, 0, 0.02)',
          transition: 'border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = borderColHover;
            e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = borderCol;
            e.currentTarget.style.backgroundColor = bgSurface;
          }
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
          {selectedOption?.dot && (
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: selectedOption.dot
            }} />
          )}
          <span>{selectedOption ? selectedOption.label : 'Select'}</span>
        </span>
        <ChevronDown 
          size={13} 
          style={{ 
            color: textMuted, 
            transition: 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0
          }} 
        />
      </button>

      {/* Floating Modern Popover Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 99999,
            minWidth: '100%',
            width: 'max-content',
            maxWidth: '240px',
            backgroundColor: bgSurface,
            borderRadius: '8px',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}`,
            boxShadow: isDark 
              ? '0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.5)' 
              : '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            backdropFilter: 'blur(8px)',
            maxHeight: '260px',
            overflowY: 'auto'
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '6px 8px',
                  borderRadius: '5px',
                  fontSize: '12.5px',
                  fontWeight: isSelected ? 600 : 500,
                  color: isSelected ? textPrimary : textMuted,
                  backgroundColor: isSelected ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)') : 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.12s ease, color 0.12s ease',
                  userSelect: 'none',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = hoverBg;
                  e.currentTarget.style.color = textPrimary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isSelected 
                    ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)') 
                    : 'transparent';
                  e.currentTarget.style.color = isSelected ? textPrimary : textMuted;
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {opt.dot && (
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: opt.dot
                    }} />
                  )}
                  <span>{opt.label}</span>
                </span>
                {isSelected && (
                  <Check size={13} strokeWidth={2.5} style={{ color: textPrimary, flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ChartGalleryModal({ 
  isOpen, 
  onClose, 
  trades = [], 
  themeMode = 'light' 
}) {
  const isDark = themeMode === 'dark' || themeMode === 'pitch-black';

  // Modal & View States
  const [isGridView, setIsGridView] = useState(() => {
    try {
      return localStorage.getItem('chartViewer:isGridView') === 'true';
    } catch {
      return false;
    }
  });
  const [showFilters, setShowFilters] = useState(() => {
    try {
      return localStorage.getItem('chartViewer:showFilters') === 'true';
    } catch {
      return false;
    }
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState('all'); // 'all' | 'beforeEntry' | 'afterExit'
  const [outcomeFilter, setOutcomeFilter] = useState('all'); // 'all' | 'win' | 'loss' | 'breakeven'
  const [setupFilter, setSetupFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [symbolSearch, setSymbolSearch] = useState('');

  const containerRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Persist view states in localStorage
  useEffect(() => {
    try {
      localStorage.setItem('chartViewer:isGridView', String(isGridView));
      localStorage.setItem('chartViewer:showFilters', String(showFilters));
    } catch {}
  }, [isGridView, showFilters]);

  // Extract all trade images into normalized image items
  const allImages = useMemo(() => {
    const list = [];
    (trades || []).forEach((t, tradeIdx) => {
      const tradeNo = t.tradeNo || tradeIdx + 1;
      const tradeName = t.name || t.symbol || 'STOCK';
      const tradeDate = t.date || '';
      const pnl = Number(t.pnl ?? t.pl ?? 0);
      const setup = t.setup || '';
      const entryPrice = t.avgEntry || t.entry || 0;
      const exitPrice = t.avgExitPrice || t.avgExit || 0;

      // Before Entry
      const entryUrl = t.chartBefore || (t.images && t.images[0]) || t.chartUrl || t.screenshot || null;
      if (entryUrl) {
        list.push({
          id: `${t.id || tradeIdx}-beforeEntry`,
          tradeId: t.id || `trade_${tradeIdx}`,
          tradeNo,
          tradeName,
          tradeDate,
          setup,
          pnl,
          entryPrice,
          exitPrice,
          imageType: 'beforeEntry',
          dataUrl: entryUrl,
          filename: `${tradeName}_Trade${tradeNo}_Entry.png`
        });
      }

      // After Exit
      const exitUrl = t.chartAfter || (t.images && t.images[1]) || null;
      if (exitUrl) {
        list.push({
          id: `${t.id || tradeIdx}-afterExit`,
          tradeId: t.id || `trade_${tradeIdx}`,
          tradeNo,
          tradeName,
          tradeDate,
          setup,
          pnl,
          entryPrice,
          exitPrice,
          imageType: 'afterExit',
          dataUrl: exitUrl,
          filename: `${tradeName}_Trade${tradeNo}_Exit.png`
        });
      }
    });
    return list;
  }, [trades]);

  // Apply filters
  const filteredImages = useMemo(() => {
    return allImages.filter(img => {
      // Type
      if (filterType !== 'all' && img.imageType !== filterType) return false;
      // Outcome
      if (outcomeFilter === 'win' && img.pnl <= 0) return false;
      if (outcomeFilter === 'loss' && img.pnl >= 0) return false;
      if (outcomeFilter === 'breakeven' && img.pnl !== 0) return false;
      // Setup
      if (setupFilter !== 'all' && img.setup !== setupFilter) return false;
      // Symbol Search
      if (symbolSearch.trim()) {
        const q = symbolSearch.toLowerCase();
        const matchesName = img.tradeName.toLowerCase().includes(q);
        const matchesNo = String(img.tradeNo).includes(q);
        if (!matchesName && !matchesNo) return false;
      }
      // Date Range
      if (dateRange.start || dateRange.end) {
        const parts = img.tradeDate.split('-');
        let dStr = img.tradeDate;
        if (parts.length === 3 && parts[2].length === 4) {
          dStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        if (dateRange.start && dStr < dateRange.start) return false;
        if (dateRange.end && dStr > dateRange.end) return false;
      }
      return true;
    });
  }, [allImages, filterType, outcomeFilter, setupFilter, symbolSearch, dateRange]);

  // Group images by trade
  const groupedTrades = useMemo(() => {
    const map = new Map();
    filteredImages.forEach((img, index) => {
      if (!map.has(img.tradeId)) {
        map.set(img.tradeId, {
          key: img.tradeId,
          tradeId: img.tradeId,
          tradeNo: img.tradeNo,
          title: `${img.tradeName} - TRADE #${img.tradeNo}`,
          subtitle: img.setup ? `${img.setup}` : 'Trade',
          tradeName: img.tradeName,
          tradeDate: img.tradeDate,
          pnl: img.pnl,
          entry: null,
          exit: null
        });
      }
      const grp = map.get(img.tradeId);
      if (img.imageType === 'beforeEntry' && !grp.entry) {
        grp.entry = { image: img, index };
      } else if (img.imageType === 'afterExit' && !grp.exit) {
        grp.exit = { image: img, index };
      } else if (!grp.entry) {
        grp.entry = { image: img, index };
      } else if (!grp.exit) {
        grp.exit = { image: img, index };
      }
    });
    return Array.from(map.values());
  }, [filteredImages]);

  // Find active group and groupIndex from currentIndex
  const { currentGroup, groupIndex } = useMemo(() => {
    if (groupedTrades.length === 0) return { currentGroup: null, groupIndex: -1 };
    const gIdx = groupedTrades.findIndex(g => g.entry?.index === currentIndex || g.exit?.index === currentIndex);
    const validIdx = gIdx >= 0 ? gIdx : 0;
    return {
      currentGroup: groupedTrades[validIdx] || null,
      groupIndex: validIdx
    };
  }, [groupedTrades, currentIndex]);

  // Unique setups for setup dropdown
  const uniqueSetups = useMemo(() => {
    return Array.from(new Set(allImages.map(img => img.setup).filter(Boolean))).sort();
  }, [allImages]);

  const hasFiltersActive = filterType !== 'all' || 
                           outcomeFilter !== 'all' || 
                           setupFilter !== 'all' || 
                           Boolean(dateRange.start) || 
                           Boolean(dateRange.end) || 
                           Boolean(symbolSearch.trim());

  // Navigation handlers
  const navigatePrevious = useCallback(() => {
    if (groupIndex > 0) {
      const prevGrp = groupedTrades[groupIndex - 1];
      const targetIdx = prevGrp?.entry?.index ?? prevGrp?.exit?.index ?? -1;
      if (targetIdx >= 0) setCurrentIndex(targetIdx);
    }
  }, [groupIndex, groupedTrades]);

  const navigateNext = useCallback(() => {
    if (groupIndex < groupedTrades.length - 1) {
      const nextGrp = groupedTrades[groupIndex + 1];
      const targetIdx = nextGrp?.entry?.index ?? nextGrp?.exit?.index ?? -1;
      if (targetIdx >= 0) setCurrentIndex(targetIdx);
    }
  }, [groupIndex, groupedTrades]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.key === 'ArrowRight') {
        navigateNext();
      } else if (e.key === 'ArrowLeft') {
        navigatePrevious();
      } else if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, navigateNext, navigatePrevious, onClose]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else if (containerRef.current) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Download Handler (Canvas stitching algorithm)
  const handleDownloadCurrent = useCallback(async () => {
    if (!currentGroup) return;
    const items = [currentGroup.entry, currentGroup.exit].filter(Boolean);
    if (!items.length) return;

    const link = document.createElement('a');

    // Single image download
    if (items.length === 1) {
      link.download = items[0].image.filename;
      link.href = items[0].image.dataUrl;
      link.click();
      return;
    }

    // Dual image stitched canvas download
    try {
      const loadedImgs = await Promise.all(items.map(item => new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = item.image.dataUrl;
      })));

      const canvas = document.createElement('canvas');
      canvas.width = loadedImgs[0].naturalWidth + loadedImgs[1].naturalWidth + 24;
      canvas.height = Math.max(loadedImgs[0].naturalHeight, loadedImgs[1].naturalHeight);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      loadedImgs.forEach((img, idx) => {
        const xOffset = idx ? loadedImgs[0].naturalWidth + 24 : 0;
        ctx.drawImage(img, xOffset, (canvas.height - img.naturalHeight) / 2);
        ctx.font = '700 14px sans-serif';
        ctx.fillStyle = '#111827';
        ctx.fillText(idx ? 'EXIT' : 'ENTRY', xOffset + 24, 44);
      });

      link.download = `${currentGroup.title.replace(/[^\w-]+/g, '_')}_entry_exit.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Download error:', err);
    }
  }, [currentGroup]);

  // Pan / Drag handlers when zoomed in
  const handleMouseDown = (e) => {
    if (zoom > 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel zoom handler
  const handleWheel = (e) => {
    if (isGridView || filteredImages.length === 0) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const cursorX = e.clientX - rect.left - rect.width / 2;
    const cursorY = e.clientY - rect.top - rect.height / 2;
    const newZoom = Math.min(5, Math.max(0.1, zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    const scaleRatio = newZoom / zoom;
    setPosition({
      x: cursorX - (cursorX - position.x) * scaleRatio,
      y: cursorY - (cursorY - position.y) * scaleRatio
    });
    setZoom(newZoom);
  };

  if (!isOpen) return null;

  // Counter text
  const counterText = isGridView 
    ? `${groupedTrades.length}` 
    : (groupIndex >= 0 ? `${groupIndex + 1}/${groupedTrades.length}` : '0/0');

  // Header Title text (Visual Chartbook)
  const headerTitle = isGridView 
    ? 'Visual Chartbook' 
    : (currentGroup 
        ? `${currentGroup.tradeName} - ${currentGroup.entry && currentGroup.exit ? 'Entry & Exit' : currentGroup.exit ? 'Exit' : 'Entry'}` 
        : 'Visual Chartbook');

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: isDark ? '#0b0f19' : '#ffffff',
        color: isDark ? '#f3f4f6' : '#111827',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* ── 1. TOP HEADER ─────────────────────────────────────────────────── */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
          padding: '8px 12px',
          backgroundColor: isDark ? '#0b0f19' : '#ffffff',
          minHeight: '49px'
        }}
      >
        {/* Left: Trade Symbol Logo + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
          {currentGroup && !isGridView && (
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden'
            }}>
              <SymbolLogo symbol={currentGroup.tradeName} size={26} style={{ borderRadius: '6px', objectFit: 'contain' }} />
            </div>
          )}
          <span style={{
            fontSize: '14px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: isDark ? '#f9fafb' : '#111827',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {headerTitle}
          </span>
        </div>

        {/* Right: Actions Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexShrink: 0 }}>
          {/* Counter */}
          <div style={{
            fontSize: '12px',
            fontVariantNumeric: 'tabular-nums',
            color: isDark ? '#9ca3af' : '#6b7280',
            flexShrink: 0,
            marginRight: '8px'
          }}>
            {counterText}
          </div>

          {/* Grid / Single View Toggle */}
          <button
            onClick={() => setIsGridView(v => !v)}
            title={isGridView ? "Single View" : "Grid View"}
            aria-label={isGridView ? "Single View" : "Grid View"}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: isGridView ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              transition: 'background-color 0.15s'
            }}
          >
            {isGridView ? <ImageIcon style={{ width: '16px', height: '16px' }} /> : <LayoutGrid style={{ width: '16px', height: '16px' }} />}
          </button>

          {/* Filters Toggle */}
          <button
            onClick={() => setShowFilters(f => !f)}
            title="Filters"
            aria-label="Filters"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: showFilters ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
              color: 'inherit',
              cursor: 'pointer'
            }}
          >
            <Filter style={{ width: '16px', height: '16px' }} />
          </button>

          {/* Zoom Out */}
          <button
            onClick={() => setZoom(z => Math.max(0.1, z / 1.5))}
            disabled={isGridView || filteredImages.length === 0 || zoom <= 0.1}
            title="Zoom out"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'inherit',
              cursor: isGridView || filteredImages.length === 0 || zoom <= 0.1 ? 'not-allowed' : 'pointer',
              opacity: isGridView || filteredImages.length === 0 || zoom <= 0.1 ? 0.3 : 1
            }}
          >
            <ZoomOut style={{ width: '16px', height: '16px' }} />
          </button>

          {/* Zoom Percentage */}
          <div 
            onClick={() => { if (!isGridView && filteredImages.length > 0) { setZoom(1); setPosition({ x: 0, y: 0 }); } }}
            title="Click to reset zoom"
            style={{
              fontSize: '12px',
              width: '40px',
              textAlign: 'center',
              cursor: isGridView || filteredImages.length === 0 ? 'default' : 'pointer',
              opacity: isGridView || filteredImages.length === 0 ? 0.2 : 1
            }}
          >
            {isGridView || filteredImages.length === 0 ? '---' : `${Math.round(zoom * 100)}%`}
          </div>

          {/* Zoom In */}
          <button
            onClick={() => setZoom(z => Math.min(5, z * 1.5))}
            disabled={isGridView || filteredImages.length === 0 || zoom >= 5}
            title="Zoom in"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'inherit',
              cursor: isGridView || filteredImages.length === 0 || zoom >= 5 ? 'not-allowed' : 'pointer',
              opacity: isGridView || filteredImages.length === 0 || zoom >= 5 ? 0.3 : 1
            }}
          >
            <ZoomIn style={{ width: '16px', height: '16px' }} />
          </button>

          {/* Download Current */}
          <button
            onClick={handleDownloadCurrent}
            disabled={!currentGroup}
            title="Download image"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'inherit',
              cursor: !currentGroup ? 'not-allowed' : 'pointer',
              opacity: !currentGroup ? 0.3 : 1
            }}
          >
            <Download style={{ width: '16px', height: '16px' }} />
          </button>

          {/* Maximize / Fullscreen */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'inherit',
              cursor: 'pointer'
            }}
          >
            {isFullscreen ? <Minimize2 style={{ width: '16px', height: '16px' }} /> : <Maximize2 style={{ width: '16px', height: '16px' }} />}
          </button>

          {/* Divider */}
          <div style={{
            width: '1px',
            height: '20px',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
            margin: '0 4px'
          }} />

          {/* Close Button */}
          <button
            onClick={onClose}
            title="Close"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'inherit',
              cursor: 'pointer'
            }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      </div>

      {/* ── 2. FILTER BAR ─────────────────────────────────────────────────── */}
      {showFilters && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          padding: '8px 12px',
          borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'
        }}>
          {/* Modern Type Dropdown */}
          <ModernDropdown
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'beforeEntry', label: 'Entry' },
              { value: 'afterExit', label: 'Exit' }
            ]}
            value={filterType}
            onChange={(val) => setFilterType(val)}
            isDark={isDark}
            minWidth="110px"
          />

          {/* Modern Outcome Dropdown */}
          <ModernDropdown
            options={[
              { value: 'all', label: 'All Outcomes' },
              { value: 'win', label: 'Win', dot: '#10b981' },
              { value: 'loss', label: 'Loss', dot: '#ef4444' },
              { value: 'breakeven', label: 'Breakeven', dot: '#f59e0b' }
            ]}
            value={outcomeFilter}
            onChange={(val) => setOutcomeFilter(val)}
            isDark={isDark}
            minWidth="135px"
          />

          {/* Modern Setup Dropdown */}
          <ModernDropdown
            options={[
              { value: 'all', label: 'All Setups' },
              ...uniqueSetups.map(s => ({ value: s, label: s }))
            ]}
            value={setupFilter}
            onChange={(val) => setSetupFilter(val)}
            isDark={isDark}
            minWidth="120px"
          />

          {/* Date Start */}
          <input 
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            style={{
              height: '32px',
              width: '136px',
              borderRadius: '6px',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #e5e7eb',
              backgroundColor: isDark ? '#111827' : '#ffffff',
              color: 'inherit',
              padding: '0 8px',
              fontSize: '13px',
              outline: 'none',
              colorScheme: isDark ? 'dark' : 'light'
            }}
          />

          {/* Date End */}
          <input 
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            style={{
              height: '32px',
              width: '136px',
              borderRadius: '6px',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #e5e7eb',
              backgroundColor: isDark ? '#111827' : '#ffffff',
              color: 'inherit',
              padding: '0 8px',
              fontSize: '13px',
              outline: 'none',
              colorScheme: isDark ? 'dark' : 'light'
            }}
          />

          {/* Symbol Search */}
          <input 
            type="text"
            placeholder="Search symbol..."
            value={symbolSearch}
            onChange={(e) => setSymbolSearch(e.target.value)}
            style={{
              height: '32px',
              width: '150px',
              borderRadius: '6px',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #e5e7eb',
              backgroundColor: isDark ? '#111827' : '#ffffff',
              color: 'inherit',
              padding: '0 10px',
              fontSize: '13px',
              outline: 'none'
            }}
          />

          {/* Clear Filters */}
          <button
            onClick={() => {
              setFilterType('all');
              setOutcomeFilter('all');
              setSetupFilter('all');
              setDateRange({ start: '', end: '' });
              setSymbolSearch('');
            }}
            disabled={!hasFiltersActive}
            style={{
              height: '32px',
              padding: '0 12px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'inherit',
              fontSize: '14px',
              cursor: hasFiltersActive ? 'pointer' : 'not-allowed',
              opacity: hasFiltersActive ? 1 : 0.4
            }}
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* ── 3. MAIN CONTENT: VIEWPORTS ────────────────────────────────────── */}
      {filteredImages.length === 0 ? (
        /* EMPTY STATE */
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          gap: '8px',
          color: isDark ? '#9ca3af' : '#6b7280'
        }}>
          <Info style={{ width: '24px', height: '24px' }} />
          <div style={{ fontSize: '14px' }}>No chart images found</div>
        </div>
      ) : isGridView ? (
        /* GRID VIEW */
        <div style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
          padding: '24px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
            gap: '20px'
          }}>
            {groupedTrades.map(group => (
              <div 
                key={group.key}
                style={{
                  borderRadius: '12px',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#ffffff',
                  padding: '12px',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
              >
                {/* Card Title Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                      border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb'
                    }}>
                      <SymbolLogo symbol={group.tradeName} size={20} style={{ borderRadius: '4px', objectFit: 'contain' }} />
                    </div>
                    <p style={{ 
                      fontSize: '12px', 
                      fontWeight: 700, 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {group.title}
                    </p>
                  </div>
                  <p style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: isDark ? '#9ca3af' : '#6b7280',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {group.subtitle} {group.tradeDate ? ` · ${group.tradeDate}` : ''}
                  </p>
                </div>

                {/* Entry & Exit Thumbnails */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* Entry Thumbnail */}
                  <div 
                    onClick={() => {
                      if (group.entry?.index !== undefined) {
                        setCurrentIndex(group.entry.index);
                        setIsGridView(false);
                      }
                    }}
                    style={{
                      height: '180px',
                      borderRadius: '8px',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e5e7eb',
                      backgroundColor: isDark ? '#0b0f19' : '#f9fafb',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: group.entry ? 'pointer' : 'default'
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : '#ffffff',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      zIndex: 2
                    }}>
                      ENTRY
                    </span>
                    {group.entry?.image.dataUrl ? (
                      <img 
                        src={group.entry.image.dataUrl} 
                        alt="Entry chart" 
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                      />
                    ) : (
                      <span style={{ fontSize: '11px', color: isDark ? '#6b7280' : '#9ca3af' }}>No entry chart</span>
                    )}
                  </div>

                  {/* Exit Thumbnail */}
                  <div 
                    onClick={() => {
                      if (group.exit?.index !== undefined) {
                        setCurrentIndex(group.exit.index);
                        setIsGridView(false);
                      }
                    }}
                    style={{
                      height: '180px',
                      borderRadius: '8px',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e5e7eb',
                      backgroundColor: isDark ? '#0b0f19' : '#f9fafb',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: group.exit ? 'pointer' : 'default'
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : '#ffffff',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      zIndex: 2
                    }}>
                      EXIT
                    </span>
                    {group.exit?.image.dataUrl ? (
                      <img 
                        src={group.exit.image.dataUrl} 
                        alt="Exit chart" 
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                      />
                    ) : (
                      <span style={{ fontSize: '11px', color: isDark ? '#6b7280' : '#9ca3af' }}>No exit chart</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* DUAL-PANEL SLIDE VIEW */
        <div 
          onWheel={handleWheel}
          style={{
            position: 'relative',
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? '#0b0f19' : '#ffffff'
          }}
        >
          {/* Side-by-side split grid */}
          {currentGroup && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              padding: '16px',
              boxSizing: 'border-box'
            }}>
              {/* ENTRY Panel */}
              <div 
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  width: '100%',
                  height: '100%',
                  cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                }}
              >
                {/* Floating pill badge */}
                <span style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : '#ffffff',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  zIndex: 10
                }}>
                  ENTRY
                </span>

                {currentGroup.entry?.image.dataUrl ? (
                  <img
                    src={currentGroup.entry.image.dataUrl}
                    alt="Entry Chart"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`,
                      transition: isDragging ? 'none' : 'transform 0.1s ease',
                      userSelect: 'none'
                    }}
                  />
                ) : (
                  <div style={{ color: isDark ? '#6b7280' : '#9ca3af', fontSize: '13px' }}>
                    No entry chart available
                  </div>
                )}
              </div>

              {/* EXIT Panel */}
              <div 
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  width: '100%',
                  height: '100%',
                  cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                }}
              >
                {/* Floating pill badge */}
                <span style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : '#ffffff',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  zIndex: 10
                }}>
                  EXIT
                </span>

                {currentGroup.exit?.image.dataUrl ? (
                  <img
                    src={currentGroup.exit.image.dataUrl}
                    alt="Exit Chart"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`,
                      transition: isDragging ? 'none' : 'transform 0.1s ease',
                      userSelect: 'none'
                    }}
                  />
                ) : (
                  <div style={{ color: isDark ? '#6b7280' : '#9ca3af', fontSize: '13px' }}>
                    No exit chart available
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Left Arrow Chevron (button style) */}
          <div style={{ position: 'absolute', insetBlock: 0, left: 0, display: 'flex', alignItems: 'center', zIndex: 20 }}>
            <button
              onClick={navigatePrevious}
              disabled={groupIndex <= 0}
              style={{
                marginLeft: '8px',
                width: '28px',
                height: '28px',
                borderRadius: '999px',
                backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
                backdropFilter: 'blur(4px)',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: groupIndex <= 0 ? 'not-allowed' : 'pointer',
                opacity: groupIndex <= 0 ? 0.3 : 1
              }}
            >
              <ChevronLeft style={{ width: '16px', height: '16px' }} />
            </button>
          </div>

          {/* Right Arrow Chevron (button style) */}
          <div style={{ position: 'absolute', insetBlock: 0, right: 0, display: 'flex', alignItems: 'center', zIndex: 20 }}>
            <button
              onClick={navigateNext}
              disabled={groupIndex < 0 || groupIndex >= groupedTrades.length - 1}
              style={{
                marginRight: '8px',
                width: '28px',
                height: '28px',
                borderRadius: '999px',
                backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
                backdropFilter: 'blur(4px)',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: groupIndex < 0 || groupIndex >= groupedTrades.length - 1 ? 'not-allowed' : 'pointer',
                opacity: groupIndex < 0 || groupIndex >= groupedTrades.length - 1 ? 0.3 : 1
              }}
            >
              <ChevronRight style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
