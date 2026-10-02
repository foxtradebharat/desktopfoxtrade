import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, RotateCcw, PenLine, Trash2, 
  Maximize2, ExternalLink, ArrowUpRight, ArrowDownRight, Layers
} from 'lucide-react';
import { createChart, CandlestickSeries, BarSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';
import { fetchHistoricalCandles } from '../services/yahooChartService';
import { getGlobalChartPreferences, subscribeChartPreferences } from '../services/chartPreferencesService';
import SymbolLogo from './SymbolLogo';

// Global In-Memory Cache for Historical Candles to prevent redundant network fetches
const CANDLE_CACHE = new Map();
// Simple concurrency queue for fetching candles
const activeFetchQueue = [];
let ongoingFetches = 0;
const MAX_CONCURRENT_FETCHES = 3;

function processFetchQueue() {
  if (ongoingFetches >= MAX_CONCURRENT_FETCHES || activeFetchQueue.length === 0) return;
  const nextTask = activeFetchQueue.shift();
  ongoingFetches++;
  nextTask()
    .finally(() => {
      ongoingFetches--;
      processFetchQueue();
    });
}

function queueCandleFetch(symbol) {
  return new Promise((resolve, reject) => {
    activeFetchQueue.push(async () => {
      try {
        const data = await fetchHistoricalCandles(symbol, '1y', '1d');
        resolve(data);
      } catch (err) {
        reject(err);
      }
    });
    processFetchQueue();
  });
}

// Date parsing helper
function parseTradeDate(dStr) {
  if (!dStr) return null;
  const s = String(dStr).trim();
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(s)) {
    const [d, m, y] = s.split(/[-/]/);
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split(/[-/]/);
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

// Find nearest candle date in trading days
function findNearestCandle(targetDate, candleList) {
  if (!targetDate || !candleList || candleList.length === 0) return null;
  const exact = candleList.find(c => c.time === targetDate);
  if (exact) return exact.time;

  const targetTs = new Date(targetDate).getTime();
  if (isNaN(targetTs)) return null;

  let closest = candleList[0];
  let minDiff = Math.abs(new Date(closest.time).getTime() - targetTs);

  for (let i = 1; i < candleList.length; i++) {
    const diff = Math.abs(new Date(candleList[i].time).getTime() - targetTs);
    if (diff < minDiff) {
      minDiff = diff;
      closest = candleList[i];
    }
  }

  // Max 14-day tolerance for weekend / holiday proximity
  if (minDiff <= 14 * 24 * 60 * 60 * 1000) {
    return closest.time;
  }
  return null;
}

export default function ActiveStockChartCard({
  position,
  activePfCapital = 212880.89,
  hideValues = false,
  onOpenStockChart,
  onOpenDeepDive
}) {
  const cardRef = useRef(null);
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const mainSeriesRef = useRef(null);

  const [isInView, setIsInView] = useState(false);
  const [activeTheme, setActiveTheme] = useState(() => {
    return document.documentElement.getAttribute('data-theme') || 'light';
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      setActiveTheme(current);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Global Chart Visualization Preferences (Candle Type, Up/Down Colors, Wicks)
  const [chartPrefs, setChartPrefs] = useState(() => getGlobalChartPreferences());
  useEffect(() => {
    return subscribeChartPreferences(newPrefs => setChartPrefs(newPrefs));
  }, []);

  const [candles, setCandles] = useState(() => {
    const sym = (position?.name || position?.symbol || '').toUpperCase().trim();
    return CANDLE_CACHE.get(sym) || null;
  });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Trendline drawing state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [trendlines, setTrendlines] = useState(() => {
    const sym = (position?.name || position?.symbol || '').toUpperCase().trim();
    try {
      const saved = localStorage.getItem(`foxtrade_chart_view_lines_${sym}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [drawingDraft, setDrawingDraft] = useState(null);
  const [, setRenderVersion] = useState(0);

  const sym = (position?.name || position?.symbol || 'STOCK').toUpperCase().trim();
  const openQty = parseFloat(position?.openQty ?? position?.qty) || 0;
  const initialEntry = parseFloat(position?.entry) || 0;
  const avgEntry = parseFloat(position?.avgEntry ?? position?.entry) || 0;
  const cmp = parseFloat(position?.cmp) || avgEntry;

  const isSell = (position?.side || position?.type || 'Buy').toLowerCase() === 'sell';
  const unrealizedAmt = position?.unrealized !== undefined && !isNaN(parseFloat(position?.unrealized))
    ? parseFloat(position.unrealized)
    : (isSell ? (avgEntry - cmp) * openQty : (cmp - avgEntry) * openQty);
  const movePct = avgEntry > 0 ? (isSell ? ((avgEntry - cmp) / avgEntry) * 100 : ((cmp - avgEntry) / avgEntry) * 100) : 0;
  const isProfit = unrealizedAmt >= 0;

  const allocationPct = activePfCapital > 0 
    ? ((avgEntry * openQty) / activePfCapital) * 100 
    : 0;

  // 1. Intersection Observer for Lazy Rendering
  useEffect(() => {
    if (!cardRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        } else {
          // Keep candles in cache, but can unmount canvas when scrolled far away (>800px)
          const rect = entry.boundingClientRect;
          const vh = window.innerHeight;
          if (rect.bottom < -800 || rect.top > vh + 800) {
            setIsInView(false);
          }
        }
      },
      { rootMargin: '350px 0px' }
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  // 2. Fetch Candlestick Data when card enters viewport
  useEffect(() => {
    if (!isInView || !sym) return;

    if (CANDLE_CACHE.has(sym)) {
      setCandles(CANDLE_CACHE.get(sym));
      return;
    }

    let isMounted = true;
    setLoading(true);
    setLoadError(null);

    queueCandleFetch(sym)
      .then(data => {
        if (!isMounted) return;
        if (data && data.length > 0) {
          CANDLE_CACHE.set(sym, data);
          setCandles(data);
        } else {
          setLoadError('No historical exchange data');
        }
      })
      .catch(err => {
        if (!isMounted) return;
        console.warn(`Candles fetch failed for ${sym}:`, err);
        setLoadError('Chart data unavailable');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isInView, sym]);

  // 3. Initialize & Sync Lightweight-Charts Canvas
  useEffect(() => {
    if (!isInView || !chartContainerRef.current || !candles || candles.length === 0) {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      return;
    }

    const container = chartContainerRef.current;
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Detect theme
    const themeAttr = document.documentElement.getAttribute('data-theme') || 'light';
    const isDark = themeAttr === 'dark' || themeAttr === 'pitch-black';
    const isPitchBlack = themeAttr === 'pitch-black';

    const bgColor = isPitchBlack ? '#000000' : (isDark ? '#0b0f17' : '#ffffff');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
    const textColor = isDark ? '#9ca3af' : '#6b7280';

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 290,
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
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.22 },
        textColor: textColor,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: isDark ? '#4b5563' : '#cbd5e1', width: 1, style: 3 },
        horzLine: { color: isDark ? '#4b5563' : '#cbd5e1', width: 1, style: 3 },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

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

    let mainSeries;
    if (chartType === 'bars') {
      const barOpts = {
        upColor,
        downColor,
        openVisible: true,
        thinBars: false,
        priceLineVisible: false,
        lastValueVisible: false,
      };
      mainSeries = typeof chart.addBarSeries === 'function'
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
      mainSeries = typeof chart.addCandlestickSeries === 'function'
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
      mainSeries = typeof chart.addCandlestickSeries === 'function'
        ? chart.addCandlestickSeries(candleOpts)
        : chart.addSeries(CandlestickSeries, candleOpts);
    }

    mainSeries.setData(candles);
    mainSeriesRef.current = mainSeries;

    // Volume Histogram Series at bottom
    try {
      const volumeData = candles.map(c => ({
        time: c.time,
        value: c.volume || 0,
        color: c.close >= c.open ? `${upColor}59` : `${downColor}59`
      }));

      const volOpts = {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume_scale',
        priceLineVisible: false,
        lastValueVisible: false,
      };

      const volumeSeries = typeof chart.addHistogramSeries === 'function'
        ? chart.addHistogramSeries(volOpts)
        : chart.addSeries(HistogramSeries, volOpts);

      chart.priceScale('volume_scale').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volumeSeries.setData(volumeData);
    } catch (volErr) {
      console.warn('Volume series init:', volErr);
    }

    // ── NATIVE CANVAS SERIES MARKERS ──────────────────────────
    const markers = [];
    const rawEntryDate = parseTradeDate(position?.date || position?.entryDate || position?.entryLegs?.[0]?.date);
    const entryCandleTime = findNearestCandle(rawEntryDate, candles);

    if (entryCandleTime) {
      markers.push({
        time: entryCandleTime,
        position: 'belowBar',
        color: '#10b981',
        shape: 'arrowUp',
        text: 'Entry'
      });
    }

    // Pyramid Legs (P1, P2, P3...)
    if (Array.isArray(position?.entryLegs) && position.entryLegs.length > 1) {
      position.entryLegs.slice(1).forEach((leg, idx) => {
        const rawDate = parseTradeDate(leg?.date);
        const pTime = findNearestCandle(rawDate, candles);
        if (pTime) {
          markers.push({
            time: pTime,
            position: 'belowBar',
            color: '#059669',
            shape: 'arrowUp',
            text: `P${idx + 1}`
          });
        }
      });
    } else {
      const pyramids = [
        { date: position?.p1Date, label: 'P1' },
        { date: position?.p2Date, label: 'P2' },
        { date: position?.p3Date, label: 'P3' },
        { date: position?.p4Date, label: 'P4' },
      ];
      pyramids.forEach(p => {
        if (p.date) {
          const rawDate = parseTradeDate(p.date);
          const pTime = findNearestCandle(rawDate, candles);
          if (pTime) {
            markers.push({
              time: pTime,
              position: 'belowBar',
              color: '#059669',
              shape: 'arrowUp',
              text: p.label
            });
          }
        }
      });
    }

    // Exit Legs (E1, E2, E3...) - strictly labeled E1, E2... instead of "Partial"
    if (Array.isArray(position?.exitLegs) && position.exitLegs.length > 0) {
      position.exitLegs.forEach((leg, idx) => {
        const rawDate = parseTradeDate(leg?.date);
        const exitTime = findNearestCandle(rawDate, candles);
        if (exitTime) {
          markers.push({
            time: exitTime,
            position: 'aboveBar',
            color: '#ef4444',
            shape: 'arrowDown',
            text: `E${idx + 1}`
          });
        }
      });
    } else {
      const exits = [
        { date: position?.e1Date, label: 'E1' },
        { date: position?.e2Date, label: 'E2' },
        { date: position?.e3Date, label: 'E3' },
        { date: position?.e4Date, label: 'E4' },
      ];
      let hasExplicitExit = false;
      exits.forEach(e => {
        if (e.date) {
          const rawDate = parseTradeDate(e.date);
          const exitTime = findNearestCandle(rawDate, candles);
          if (exitTime) {
            hasExplicitExit = true;
            markers.push({
              time: exitTime,
              position: 'aboveBar',
              color: '#ef4444',
              shape: 'arrowDown',
              text: e.label
            });
          }
        }
      });

      // Fallback for partial exit or closed trade with single exitDate
      if (!hasExplicitExit && (position?.status === 'Partial' || position?.status === 'Closed' || position?.exitDate)) {
        const rawDate = parseTradeDate(position?.exitDate || position?.e1Date || position?.eDate);
        const exitTime = findNearestCandle(rawDate, candles);
        if (exitTime) {
          markers.push({
            time: exitTime,
            position: 'aboveBar',
            color: '#ef4444',
            shape: 'arrowDown',
            text: 'E1'
          });
        }
      }
    }

    // Sort markers chronologically
    markers.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    if (markers.length > 0) {
      try {
        if (typeof createSeriesMarkers === 'function') {
          createSeriesMarkers(mainSeries, markers);
        } else if (typeof mainSeries.setMarkers === 'function') {
          mainSeries.setMarkers(markers);
        }
      } catch (markErr) {
        console.warn('Set markers error:', markErr);
      }
    }

    // Fit content initially with reasonable zoom
    chart.timeScale().fitContent();

    // Auto-Resize observer
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0 || !chartRef.current) return;
      const { width } = entries[0].contentRect;
      if (width > 0) {
        chartRef.current.applyOptions({ width });
        setRenderVersion(v => v + 1);
      }
    });
    resizeObserver.observe(container);

    // Sync trendline overlay when zoom or pan happens
    const handleViewportChange = () => setRenderVersion(v => v + 1);
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleViewportChange);
    chart.timeScale().subscribeVisibleTimeRangeChange(handleViewportChange);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        try {
          chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(handleViewportChange);
          chartRef.current.timeScale().unsubscribeVisibleTimeRangeChange(handleViewportChange);
        } catch {}
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [isInView, candles, sym, position, activeTheme, chartPrefs]);

  // Reset chart zoom to fit all data
  const handleResetZoom = (e) => {
    e.stopPropagation();
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  // ── TRENDLINE INTERACTION ─────────────────────────────────────────────────
  const handleSvgClick = (e) => {
    if (!isDrawingMode || !chartRef.current || !mainSeriesRef.current || !chartContainerRef.current) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = Math.max(10, Math.min(rect.width - 50, e.clientX - rect.left));
    const y = Math.max(10, Math.min(rect.height - 20, e.clientY - rect.top));

    const timeScale = chartRef.current.timeScale();
    const series = mainSeriesRef.current;

    let time = timeScale.coordinateToTime(x);
    let price = series.coordinateToPrice(y);

    if (!time && candles && candles.length > 0) {
      time = x < rect.width / 2 ? candles[0].time : candles[candles.length - 1].time;
    }
    if (price === null || price === undefined) {
      price = candles && candles.length > 0 ? candles[candles.length - 1].close : 100;
    }

    if (!time || price === null || price === undefined) return;

    if (!drawingDraft) {
      // First point clicked
      setDrawingDraft({ time1: time, price1: price, x1: x, y1: y });
    } else {
      // Second point clicked -> save line
      const newLine = {
        id: `tl_${Date.now()}`,
        time1: drawingDraft.time1,
        price1: drawingDraft.price1,
        time2: time,
        price2: price
      };
      const updated = [...trendlines, newLine];
      setTrendlines(updated);
      try {
        localStorage.setItem(`foxtrade_chart_view_lines_${sym}`, JSON.stringify(updated));
      } catch {}
      setDrawingDraft(null);
      setIsDrawingMode(false);
    }
  };

  const handleClearTrendlines = (e) => {
    e.stopPropagation();
    setTrendlines([]);
    setDrawingDraft(null);
    try {
      localStorage.removeItem(`foxtrade_chart_view_lines_${sym}`);
    } catch {}
  };

  // Convert saved trendlines (time/price) into pixel coordinates
  const renderedTrendlines = useMemo(() => {
    if (!chartRef.current || !mainSeriesRef.current) return [];
    const timeScale = chartRef.current.timeScale();
    const series = mainSeriesRef.current;

    return trendlines.map(line => {
      const x1 = timeScale.timeToCoordinate(line.time1);
      const x2 = timeScale.timeToCoordinate(line.time2);
      const y1 = series.priceToCoordinate(line.price1);
      const y2 = series.priceToCoordinate(line.price2);
      if (x1 === null || x2 === null || y1 === null || y2 === null) return null;
      return { id: line.id, x1, y1, x2, y2 };
    }).filter(Boolean);
  }, [trendlines, chartRef.current, mainSeriesRef.current, candles]);

  return (
    <div
      ref={cardRef}
      className="group relative z-10 transition-all duration-300 rounded-xl border border-border/40 bg-card shadow-sm hover:shadow-lg hover:border-border/60 overflow-hidden flex flex-col"
      style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderColor: 'var(--border-color, rgba(0, 0, 0, 0.08))',
        position: 'relative'
      }}
    >
      {/* Partial Exit Top Blue Accent & Badge */}
      {position?.status === 'Partial' && (
        <>
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '42px',
              height: '2.5px',
              backgroundColor: '#2563eb',
              zIndex: 30
            }} 
          />
          <span 
            style={{
              position: 'absolute',
              top: '4px',
              left: '6px',
              zIndex: 30,
              fontSize: '8.5px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#2563eb',
              backgroundColor: 'rgba(239, 246, 255, 0.95)',
              padding: '1px 5px',
              borderRadius: '4px',
              lineHeight: 1
            }}
          >
            Partial
          </span>
        </>
      )}

      {/* ── CARD HEADER ─────────────────────────────────── */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          position: 'relative',
          padding: '8px 12px 6px 12px',
          minHeight: '48px',
          borderBottom: '1px solid var(--border-color, rgba(0, 0, 0, 0.05))'
        }}
      >
        {/* Left: Logo, Symbol, Direction & Qty */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div 
            onClick={() => onOpenStockChart && onOpenStockChart(sym)}
            style={{ cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}
            title={`Open full ${sym} chart`}
          >
            <SymbolLogo symbol={sym} size={22} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h4 
                onClick={() => onOpenStockChart && onOpenStockChart(sym)}
                style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: 'var(--text-primary, #111827)',
                  cursor: 'pointer',
                  lineHeight: 1.2
                }}
              >
                {sym}
              </h4>
              {onOpenDeepDive && (
                <button
                  onClick={() => onOpenDeepDive(sym, position?.tradeNo)}
                  title="Open Symbol Deep Dive"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px',
                    cursor: 'pointer',
                    color: 'var(--text-muted, #9ca3af)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <ExternalLink size={11} />
                </button>
              )}
            </div>
            <p 
              style={{
                margin: 0,
                fontSize: '9px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--text-muted, #9ca3af)',
                lineHeight: 1.2,
                marginTop: '1px'
              }}
            >
              {position?.type ? position.type.toUpperCase() : 'BUY'} · {openQty} QTY
            </p>
          </div>
        </div>

        {/* Center: Setup / Tag Badge */}
        {position?.setup && (
          <div 
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10
            }}
          >
            <span 
              style={{
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.02em',
                color: '#ffffff',
                backgroundColor: position.setup.length <= 4 ? '#475569' : '#3b82f6',
                padding: '2px 8px',
                borderRadius: '4px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
                whiteSpace: 'nowrap'
              }}
            >
              {position.setup}
            </span>
          </div>
        )}

        {/* Right: Unrealized P&L & Percentage */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div 
            style={{
              fontSize: '15px',
              fontWeight: 600,
              fontFamily: 'monospace',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: isProfit ? '#16a34a' : '#ef4444'
            }}
          >
            {hideValues ? '••••••' : `${isProfit ? '+' : ''}₹${unrealizedAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '2px',
              fontSize: '10.5px',
              fontWeight: 500,
              fontFamily: 'monospace',
              color: isProfit ? 'rgba(22, 163, 74, 0.8)' : 'rgba(239, 68, 68, 0.8)',
              marginTop: '1px'
            }}
          >
            {isProfit ? <ArrowUpRight size={11} strokeWidth={2.2} /> : <ArrowDownRight size={11} strokeWidth={2.2} />}
            <span>{isProfit ? '+' : ''}{movePct.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* Sub-row: Allocation and Entry / CMP stats */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          fontSize: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.015)',
          color: 'var(--text-muted, #9ca3af)',
          borderBottom: '1px solid var(--border-color, rgba(0, 0, 0, 0.04))'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary, #6b7280)' }}>
            {allocationPct.toFixed(1)}% alloc
          </span>
          <span>•</span>
          <span>Avg: <strong style={{ color: 'var(--text-primary, #111827)', fontFamily: 'monospace' }}>₹{avgEntry.toFixed(2)}</strong></span>
          <span>•</span>
          <span>LTP: <strong style={{ color: 'var(--text-primary, #111827)', fontFamily: 'monospace' }}>₹{cmp.toFixed(2)}</strong></span>
        </div>

        {/* Maximize Full Chart action */}
        <button
          onClick={() => onOpenStockChart && onOpenStockChart(sym)}
          title="Open Full Chart"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            color: 'var(--text-muted, #9ca3af)',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '9.5px',
            fontWeight: 600,
            transition: 'color 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary, #111827)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #9ca3af)'}
        >
          <Maximize2 size={10} />
          <span>Open Full Chart</span>
        </button>
      </div>

      {/* ── INTERACTIVE LIGHTWEIGHT-CHARTS CANVAS BODY ────────────────────── */}
      <div 
        style={{
          position: 'relative',
          height: '290px',
          width: '100%',
          backgroundColor: 'var(--bg-card, #ffffff)',
          overflow: 'hidden'
        }}
      >
        {/* Chart Watermark Overlay */}
        <div 
          style={{
            position: 'absolute',
            left: '50%',
            top: '14px',
            transform: 'translateX(-50%)',
            zIndex: 15,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: 0.18,
            transition: 'opacity 0.2s ease'
          }}
        >
          <SymbolLogo symbol={sym} size={18} />
          <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-primary, #111827)' }}>
            {sym}
          </span>
        </div>

        {/* Left Toolbar: Draw Trendline Button */}
        <div 
          style={{
            position: 'absolute',
            left: '10px',
            top: '12px',
            zIndex: 35,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <button
            onClick={() => setIsDrawingMode(!isDrawingMode)}
            title={isDrawingMode ? "Click on chart to place points (or click to cancel)" : "Draw Trendline"}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              border: isDrawingMode ? '1px solid #3b82f6' : '1px solid var(--border-color, #e5e7eb)',
              backgroundColor: isDrawingMode ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card, #ffffff)',
              color: isDrawingMode ? '#3b82f6' : 'var(--text-muted, #6b7280)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              transition: 'all 0.15s ease'
            }}
          >
            <PenLine size={13} strokeWidth={isDrawingMode ? 2.2 : 1.8} />
          </button>

          {trendlines.length > 0 && (
            <button
              onClick={handleClearTrendlines}
              title="Clear all trendlines"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e5e7eb)',
                backgroundColor: 'var(--bg-card, #ffffff)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                transition: 'all 0.15s ease'
              }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        {/* Center-Bottom Floating Reset Zoom Button */}
        <button
          onClick={handleResetZoom}
          title="Reset chart view"
          aria-label="Reset chart to fit all data"
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 35,
            width: '22px',
            height: '22px',
            borderRadius: '6px',
            border: '1px solid var(--border-color, #e5e7eb)',
            backgroundColor: 'var(--bg-card, rgba(255, 255, 255, 0.9))',
            color: 'var(--text-muted, #6b7280)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary, #111827)';
            e.currentTarget.style.borderColor = 'var(--border-hover, #cbd5e1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted, #6b7280)';
            e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
          }}
        >
          <RotateCcw size={11} />
        </button>

        {/* Interactive SVG Trendline Overlay */}
        <svg 
          onClick={handleSvgClick}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: isDrawingMode ? 'auto' : 'none',
            cursor: isDrawingMode ? 'crosshair' : 'default',
            zIndex: 25,
            overflow: 'hidden'
          }}
        >
          {renderedTrendlines.map(line => (
            <line
              key={line.id}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}

          {/* Active drawing draft */}
          {drawingDraft && (
            <circle
              cx={drawingDraft.x1}
              cy={drawingDraft.y1}
              r="4"
              fill="#3b82f6"
            />
          )}
        </svg>

        {/* Lightweight Charts Canvas Root */}
        <div 
          ref={chartContainerRef} 
          style={{ 
            width: '100%', 
            height: '100%',
            visibility: loading || loadError || !candles ? 'hidden' : 'visible'
          }} 
        />

        {/* Skeleton Shimmer Loading Placeholder */}
        {(!isInView || loading || (!candles && !loadError)) && (
          <div 
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              backgroundColor: 'var(--bg-card, #ffffff)',
              zIndex: 20
            }}
          >
            <div 
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '2.5px solid var(--border-color, #e5e7eb)',
                borderTopColor: '#3b82f6',
                animation: 'spin 0.8s linear infinite'
              }} 
            />
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #9ca3af)' }}>
              Loading {sym} candles...
            </span>
          </div>
        )}

        {/* Error State */}
        {loadError && !candles && (
          <div 
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-card, #ffffff)',
              zIndex: 20,
              padding: '16px',
              textAlign: 'center'
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #9ca3af)' }}>
              {loadError}
            </span>
            <button
              onClick={() => {
                CANDLE_CACHE.delete(sym);
                setLoadError(null);
                setLoading(true);
                queueCandleFetch(sym)
                  .then(d => { CANDLE_CACHE.set(sym, d); setCandles(d); })
                  .catch(() => setLoadError('Retry failed'))
                  .finally(() => setLoading(false));
              }}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#3b82f6',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                marginTop: '4px'
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
