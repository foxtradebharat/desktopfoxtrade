import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createChart, CandlestickSeries, BarSeries, createSeriesMarkers } from 'lightweight-charts';
import { RotateCcw } from 'lucide-react';
import { fetchHistoricalCandles } from '../services/yahooChartService';
import { getGlobalChartPreferences, subscribeChartPreferences } from '../services/chartPreferencesService';

const INDICES = [
  { id: 'NIFTY', name: 'NIFTY 50', symbol: '^NSEI' },
  { id: 'BANKNIFTY', name: 'BANK NIFTY', symbol: '^NSEBANK' },
  { id: 'MIDCAP', name: 'MIDCAP 400', symbol: '^CNXMIDCAP' },
  { id: 'SMALLCAP', name: 'SMALLCAP 100', symbol: '^CNXSCAP' },
  { id: 'NIFTY500', name: 'NIFTY 500', symbol: '^CNX500' }
];

// Helper to parse diverse date formats into standard YYYY-MM-DD
function parseTradeDate(d) {
  if (!d) return null;
  if (typeof d === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    // Handle DD-MM-YYYY or DD/MM/YYYY
    const parts = d.split(/[-/.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  try {
    const dt = new Date(d);
    if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
  } catch {}
  return null;
}

// Tolerance matching to locate nearest trading day candle
function findNearestCandle(targetDateStr, candles) {
  if (!targetDateStr || !candles || candles.length === 0) return null;
  const exact = candles.find(c => c.time === targetDateStr);
  if (exact) return exact.time;

  const targetTime = new Date(targetDateStr).getTime();
  if (isNaN(targetTime)) return null;

  let closest = null;
  let minDiff = Infinity;
  for (const c of candles) {
    const cTime = new Date(c.time).getTime();
    const diff = Math.abs(cTime - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closest = c.time;
    }
  }
  // Allow up to 4 calendar days (weekends & market holidays)
  if (minDiff <= 4 * 86400 * 1000) return closest;
  return null;
}

export default function BenchmarkIndexChart({ trades = [], activePositions = [] }) {
  const [selectedIdx, setSelectedIdx] = useState('NIFTY');
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  // Theme observer
  const [themeMode, setThemeMode] = useState(() => {
    return document.documentElement.getAttribute('data-theme') || 'light';
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      setThemeMode(cur);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Global Chart Visualization Preferences (Candle Type, Up/Down Colors, Wicks)
  const [chartPrefs, setChartPrefs] = useState(() => getGlobalChartPreferences());
  useEffect(() => {
    return subscribeChartPreferences(newPrefs => setChartPrefs(newPrefs));
  }, []);

  const activeIndexObj = useMemo(() => {
    return INDICES.find(i => i.id === selectedIdx) || INDICES[0];
  }, [selectedIdx]);

  // Fetch index candles
  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setError(null);

    fetchHistoricalCandles(activeIndexObj.symbol, '1y', '1d')
      .then(data => {
        if (!isCurrent) return;
        if (data && data.length > 0) {
          setCandles(data);
        } else {
          setError('No candle data available for this index');
        }
      })
      .catch(err => {
        if (!isCurrent) return;
        console.warn('Index fetch error:', err);
        setError('Failed to load index data');
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [activeIndexObj]);

  // Mount and update chart
  useEffect(() => {
    if (!containerRef.current || candles.length === 0) {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      return;
    }

    const container = containerRef.current;
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const isDark = themeMode === 'dark' || themeMode === 'pitch-black';
    const isPitchBlack = themeMode === 'pitch-black';
    const bgColor = isPitchBlack ? '#000000' : (isDark ? '#0b0f17' : '#ffffff');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
    const textColor = isDark ? '#9ca3af' : '#6b7280';

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 340,
      layout: {
        background: { color: bgColor },
        textColor: textColor,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      timeScale: {
        borderColor: gridColor,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 8,
        minBarSpacing: 3,
      },
      rightPriceScale: {
        borderColor: gridColor,
        visible: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      crosshair: {
        vertLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
          width: 1,
          style: 3,
          labelBackgroundColor: isDark ? '#1e293b' : '#334155',
        },
        horzLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
          width: 1,
          style: 3,
          labelBackgroundColor: isDark ? '#1e293b' : '#334155',
        },
      },
    });

    chartRef.current = chart;

    // ── DYNAMIC CANDLE / BAR SERIES FROM GLOBAL CHART PREFERENCES ─────────────
    const { chartType = 'candles', settings = {} } = chartPrefs || {};
    const upColor = settings.upColor || '#10b981';
    const downColor = settings.downColor || '#ef4444';
    const borderUpColor = settings.borderUpColor || upColor;
    const borderDownColor = settings.borderDownColor || downColor;
    const wickUpColor = settings.wickUpColor || upColor;
    const wickDownColor = settings.wickDownColor || downColor;
    const bodyVisible = settings.bodyVisible !== false;
    const borderVisible = settings.borderVisible !== false;
    const wickVisible = settings.wickVisible !== false;

    let series;
    if (chartType === 'bars') {
      const barOpts = {
        upColor,
        downColor,
        openVisible: true,
        thinBars: false,
        priceLineVisible: false,
        lastValueVisible: false,
      };
      series = typeof chart.addBarSeries === 'function'
        ? chart.addBarSeries(barOpts)
        : chart.addSeries(BarSeries, barOpts);
    } else if (chartType === 'hollow_candles') {
      const hollowOpts = {
        upColor: 'transparent',
        downColor: bodyVisible ? downColor : 'transparent',
        borderVisible,
        borderColor: borderUpColor,
        borderUpColor,
        borderDownColor,
        wickVisible,
        wickUpColor,
        wickDownColor,
        priceLineVisible: false,
        lastValueVisible: false,
      };
      series = typeof chart.addCandlestickSeries === 'function'
        ? chart.addCandlestickSeries(hollowOpts)
        : chart.addSeries(CandlestickSeries, hollowOpts);
    } else {
      const candleOpts = {
        upColor: bodyVisible ? upColor : 'transparent',
        downColor: bodyVisible ? downColor : 'transparent',
        borderVisible,
        borderColor: borderUpColor,
        borderUpColor,
        borderDownColor,
        wickVisible,
        wickUpColor,
        wickDownColor,
        priceLineVisible: false,
        lastValueVisible: false,
      };
      series = typeof chart.addCandlestickSeries === 'function'
        ? chart.addCandlestickSeries(candleOpts)
        : chart.addSeries(CandlestickSeries, candleOpts);
    }

    series.setData(candles);
    seriesRef.current = series;

    // ── PLOT TRADE MARKERS OVERLAID ON INDEX TIMELINE ─────────────────────────
    // Combine all trades (both active positions and journal history)
    const combinedTrades = trades && trades.length > 0 ? trades : activePositions;
    const entryDateMap = new Map(); // date -> [symbols]
    const exitDateMap = new Map();  // date -> [symbols]

    combinedTrades.forEach(t => {
      const sym = (t.name || t.symbol || 'STOCK').toUpperCase().trim();
      const entryRaw = parseTradeDate(t.date || t.entryDate);
      const entryCandleTime = findNearestCandle(entryRaw, candles);

      if (entryCandleTime) {
        if (!entryDateMap.has(entryCandleTime)) entryDateMap.set(entryCandleTime, new Set());
        entryDateMap.get(entryCandleTime).add(sym.length > 6 ? sym.slice(0, 4) : sym);
      }

      // Exit leg or closed date
      const isClosedOrPartial = t.status === 'Closed' || t.status === 'Partial';
      if (isClosedOrPartial || t.exitDate || t.e1Date) {
        const exitRaw = parseTradeDate(t.exitDate || t.e1Date);
        const exitCandleTime = findNearestCandle(exitRaw, candles);
        if (exitCandleTime) {
          if (!exitDateMap.has(exitCandleTime)) exitDateMap.set(exitCandleTime, new Set());
          exitDateMap.get(exitCandleTime).add(sym.length > 6 ? sym.slice(0, 4) : sym);
        }
      }
    });

    const markers = [];

    // Add entry markers (Green arrowUp)
    entryDateMap.forEach((symbolsSet, time) => {
      markers.push({
        time,
        position: 'belowBar',
        color: '#16a34a',
        shape: 'arrowUp',
        text: Array.from(symbolsSet).join(' • '),
        size: 1
      });
    });

    // Add exit markers (Red arrowDown)
    exitDateMap.forEach((symbolsSet, time) => {
      markers.push({
        time,
        position: 'aboveBar',
        color: '#dc2626',
        shape: 'arrowDown',
        text: Array.from(symbolsSet).join(' • '),
        size: 1
      });
    });

    // Sort markers chronologically
    markers.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    if (markers.length > 0) {
      try {
        if (typeof createSeriesMarkers === 'function') {
          createSeriesMarkers(series, markers);
        } else if (typeof series.setMarkers === 'function') {
          series.setMarkers(markers);
        }
      } catch (e) {
        console.warn('Error setting benchmark index markers:', e);
      }
    }

    chart.timeScale().fitContent();

    // ResizeObserver
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0 || !chartRef.current) return;
      const { width } = entries[0].contentRect;
      if (width > 0) {
        chartRef.current.applyOptions({ width });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles, themeMode, trades, activePositions, chartPrefs]);

  const handleResetZoom = (e) => {
    e.stopPropagation();
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-card, #ffffff)',
      border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
      borderRadius: '20px',
      padding: '20px',
      boxShadow: '0 4px 20px -4px rgba(0,0,0,0.03)',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      position: 'relative'
    }}>
      {/* ── HEADER TABS: NIFTY 50 | BANK NIFTY | MIDCAP 400 | SMALLCAP 100 | NIFTY 500 ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 50%, transparent)',
        paddingBottom: '10px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Index Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto' }}>
          {INDICES.map(idx => {
            const isSelected = selectedIdx === idx.id;
            return (
              <button
                key={idx.id}
                onClick={() => setSelectedIdx(idx.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: isSelected ? '2px solid var(--text-primary, #111827)' : '2px solid transparent',
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontWeight: isSelected ? 600 : 500,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: isSelected ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                {idx.name}
              </button>
            );
          })}
        </div>

        {/* Subtitle Badge */}
        <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #6b7280)' }}>
          Broad Market Benchmark &amp; Execution Rhythm
        </div>
      </div>

      {/* ── CHART CANVAS CONTAINER ── */}
      <div style={{ position: 'relative', width: '100%', minHeight: '340px' }}>
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted, #9ca3af)',
            fontSize: '12px',
            fontWeight: 500
          }}>
            Loading {activeIndexObj.name} Daily Chart...
          </div>
        )}

        {error && !loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            fontSize: '12px',
            fontWeight: 500
          }}>
            {error}
          </div>
        )}

        <div ref={containerRef} style={{ width: '100%', height: '340px' }} />

        {/* Floating Reset Zoom Button */}
        <button
          onClick={handleResetZoom}
          title="Reset chart zoom to fit all data"
          aria-label="Reset chart zoom"
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            color: 'var(--text-muted, #6b7280)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary, #111827)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #6b7280)'}
        >
          <RotateCcw size={13} strokeWidth={2} />
        </button>
      </div>

      {/* ── BOTTOM LEGEND ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        borderTop: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 50%, transparent)',
        paddingTop: '12px',
        fontSize: '11px',
        fontWeight: 500,
        color: 'var(--text-primary, #111827)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#16a34a', fontSize: '13px' }}>▲</span>
          <span>Entry / Open Trade</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#dc2626', fontSize: '13px' }}>▼</span>
          <span>Exit / Closed Leg</span>
        </div>
      </div>
    </div>
  );
}
