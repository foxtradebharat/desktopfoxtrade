import React, { useState, useEffect, useRef } from 'react';
import { 
  createChart, 
  CandlestickSeries, 
  BarSeries, 
  HistogramSeries, 
  createSeriesMarkers,
  LineStyle 
} from 'lightweight-charts';
import { RotateCcw, Eye, EyeOff, Layers, Activity } from 'lucide-react';
import { fetchHistoricalCandles } from '../../services/yahooChartService';
import { getGlobalChartPreferences, subscribeChartPreferences } from '../../services/chartPreferencesService';

// Global memory cache to prevent re-fetching on tab switching
const CANDLE_CACHE = new Map();

/**
 * Normalizes any date string into YYYY-MM-DD
 */
function parseToYMD(dStr) {
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

/**
 * Finds the nearest trading candle in the dataset for a given date
 */
function findNearestCandle(targetDateYMD, candleList) {
  if (!targetDateYMD || !candleList || candleList.length === 0) return null;
  const exact = candleList.find(c => c.time === targetDateYMD);
  if (exact) return exact.time;

  const targetTs = new Date(targetDateYMD).getTime();
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

  // Max 14 days tolerance for weekend/holiday gap
  if (minDiff <= 14 * 24 * 60 * 60 * 1000) {
    return closest.time;
  }
  return null;
}

export default function InteractiveTradeChart({
  trade,
  symbol,
  height = 460,
  showControls = true,
  onCandlesLoaded
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const priceLinesRef = useRef([]);

  const cleanSym = String(symbol || trade?.name || trade?.symbol || 'RELIANCE').trim().toUpperCase();

  const [timeframe, setTimeframe] = useState('1d'); // '1d' | '1h' | '15m' | '5m'
  const [candles, setCandles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showPriceLines, setShowPriceLines] = useState(true);

  // Theme tracking
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'light');
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'light');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // Global Chart Preferences
  const [chartPrefs, setChartPrefs] = useState(() => getGlobalChartPreferences());
  useEffect(() => {
    return subscribeChartPreferences(p => setChartPrefs(p));
  }, []);

  // Fetch candle data
  useEffect(() => {
    if (!cleanSym) return;

    const cacheKey = `${cleanSym}_${timeframe}`;
    if (CANDLE_CACHE.has(cacheKey)) {
      const cached = CANDLE_CACHE.get(cacheKey);
      setCandles(cached);
      if (onCandlesLoaded) onCandlesLoaded(cached);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);

    let range = '1y';
    if (timeframe === '1h') range = '1mo';
    if (timeframe === '15m' || timeframe === '5m') range = '5d';

    fetchHistoricalCandles(cleanSym, range, timeframe)
      .then(data => {
        if (!isMounted) return;
        if (data && data.length > 0) {
          CANDLE_CACHE.set(cacheKey, data);
          setCandles(data);
          if (onCandlesLoaded) onCandlesLoaded(data);
        } else {
          // Fallback to 1d if intraday has no data
          if (timeframe !== '1d') {
            setTimeframe('1d');
          } else {
            setLoadError('No exchange data available for symbol.');
          }
        }
      })
      .catch(() => {
        if (!isMounted) return;
        if (timeframe !== '1d') {
          setTimeframe('1d');
        } else {
          setLoadError('Chart data temporarily unavailable.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [cleanSym, timeframe]);

  // Render & Synchronize lightweight-charts Canvas
  useEffect(() => {
    if (!containerRef.current || !candles || candles.length === 0) return;

    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (_) {}
      chartRef.current = null;
    }

    const isDark = theme === 'dark' || theme === 'pitch-black';
    const isPitchBlack = theme === 'pitch-black';

    const bgColor = isPitchBlack ? '#000000' : (isDark ? '#0b0f19' : '#ffffff');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.05)';
    const textColor = isDark ? '#9ca3af' : '#6b7280';

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 700,
      height: height,
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
        scaleMargins: { top: 0.12, bottom: 0.22 },
        textColor: textColor,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: timeframe !== '1d',
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: isDark ? '#4b5563' : '#cbd5e1', width: 1, style: 3 },
        horzLine: { color: isDark ? '#4b5563' : '#cbd5e1', width: 1, style: 3 },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });
    chartRef.current = chart;

    // Series config
    const { chartType = 'candles', settings = {} } = chartPrefs || {};
    const upColor = settings.upColor || '#10b981';
    const downColor = settings.downColor || '#ef4444';
    const borderUpColor = settings.borderUpColor || upColor;
    const borderDownColor = settings.borderDownColor || downColor;
    const wickUpColor = settings.wickUpColor || upColor;
    const wickDownColor = settings.wickDownColor || downColor;

    let mainSeries;
    if (chartType === 'bars') {
      const barOpts = { upColor, downColor, openVisible: true, thinBars: false, priceLineVisible: false, lastValueVisible: false };
      mainSeries = typeof chart.addBarSeries === 'function' ? chart.addBarSeries(barOpts) : chart.addSeries(BarSeries, barOpts);
    } else {
      const candleOpts = {
        upColor,
        downColor,
        borderVisible: true,
        borderColor: borderUpColor,
        borderUpColor,
        borderDownColor,
        wickVisible: true,
        wickUpColor,
        wickDownColor,
        priceLineVisible: false,
        lastValueVisible: false,
      };
      mainSeries = typeof chart.addCandlestickSeries === 'function' ? chart.addCandlestickSeries(candleOpts) : chart.addSeries(CandlestickSeries, candleOpts);
    }

    mainSeries.setData(candles);
    mainSeriesRef.current = mainSeries;

    // Volume Series
    try {
      const volOpts = {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume_scale',
        priceLineVisible: false,
        lastValueVisible: false,
      };
      const volumeSeries = typeof chart.addHistogramSeries === 'function' ? chart.addHistogramSeries(volOpts) : chart.addSeries(HistogramSeries, volOpts);
      chart.priceScale('volume_scale').applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });
      volumeSeries.setData(candles.map(c => ({
        time: c.time,
        value: c.volume || 0,
        color: c.close >= c.open ? `${upColor}40` : `${downColor}40`
      })));
    } catch (_) {}

    // ── Native Price Lines (SL, Target, BE) ───────────────────────────────────
    priceLinesRef.current = [];
    if (showPriceLines && trade && mainSeries) {
      const entryPrice = parseFloat(trade.avgEntry ?? trade.entry ?? 0) || 0;
      const slPrice = parseFloat(trade.sl ?? trade.p1Sl ?? 0) || 0;
      const targetPrice = parseFloat(trade.target ?? trade.takeProfit ?? 0) || 0;
      const isShort = String(trade.type || trade.side || '').toLowerCase() === 'sell';

      // 1. Stop Loss Line (Crimson Dashed)
      if (slPrice > 0) {
        const slDiff = entryPrice > 0 ? ((slPrice - entryPrice) / entryPrice * 100) : 0;
        const slLine = mainSeries.createPriceLine({
          price: slPrice,
          color: '#ef4444',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `SL ₹${slPrice.toFixed(2)} (${slDiff >= 0 ? '+' : ''}${slDiff.toFixed(1)}%)`
        });
        priceLinesRef.current.push(slLine);
      }

      // 2. Target / Take-Profit Line (Emerald Dashed)
      if (targetPrice > 0) {
        const tgtDiff = entryPrice > 0 ? ((targetPrice - entryPrice) / entryPrice * 100) : 0;
        const tgtLine = mainSeries.createPriceLine({
          price: targetPrice,
          color: '#10b981',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `Target ₹${targetPrice.toFixed(2)} (${tgtDiff >= 0 ? '+' : ''}${tgtDiff.toFixed(1)}%)`
        });
        priceLinesRef.current.push(tgtLine);
      }

      // 3. Breakeven / Entry Price Line (Slate Dotted)
      if (entryPrice > 0) {
        const beLine = mainSeries.createPriceLine({
          price: entryPrice,
          color: '#64748b',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `Entry ₹${entryPrice.toFixed(2)}`
        });
        priceLinesRef.current.push(beLine);
      }
    }

    // ── Dynamic Markers (Entry, Pyramids, Exits) ──────────────────────────────
    if (showMarkers && trade && mainSeries) {
      const markers = [];
      const isShort = String(trade.type || trade.side || '').toLowerCase() === 'sell';

      // 1. Initial Entry Marker
      const rawEntryDate = parseToYMD(trade.date || trade.entryDate || trade.entryLegs?.[0]?.date);
      const entryTime = findNearestCandle(rawEntryDate, candles);
      const entryPrice = parseFloat(trade.entry ?? trade.avgEntry ?? 0) || 0;

      if (entryTime) {
        markers.push({
          time: entryTime,
          position: isShort ? 'aboveBar' : 'belowBar',
          color: isShort ? '#ef4444' : '#10b981',
          shape: isShort ? 'arrowDown' : 'arrowUp',
          text: `${isShort ? 'Short' : 'Buy'} ${entryPrice > 0 ? `₹${entryPrice}` : ''}`
        });
      }

      // 2. Pyramid Additions (P1, P2, P3, P4)
      const pyramids = [
        { date: trade.p1Date, price: trade.p1Price, label: 'P1' },
        { date: trade.p2Date, price: trade.p2Price, label: 'P2' },
        { date: trade.p3Date, price: trade.p3Price, label: 'P3' },
        { date: trade.p4Date, price: trade.p4Price, label: 'P4' },
      ];
      pyramids.forEach(p => {
        if (p.date) {
          const rawPDate = parseToYMD(p.date);
          const pTime = findNearestCandle(rawPDate, candles);
          if (pTime) {
            markers.push({
              time: pTime,
              position: isShort ? 'aboveBar' : 'belowBar',
              color: '#059669',
              shape: isShort ? 'arrowDown' : 'arrowUp',
              text: `${p.label} ${p.price ? `₹${p.price}` : ''}`
            });
          }
        }
      });

      // 3. Exit Legs (E1, E2, E3, E4) or Final Exit
      const exits = [
        { date: trade.e1Date, price: trade.e1Price, label: 'E1' },
        { date: trade.e2Date, price: trade.e2Price, label: 'E2' },
        { date: trade.e3Date, price: trade.e3Price, label: 'E3' },
        { date: trade.e4Date, price: trade.e4Price, label: 'E4' },
      ];
      let hasExplicitExit = false;
      exits.forEach(e => {
        if (e.date) {
          const rawEDate = parseToYMD(e.date);
          const exitTime = findNearestCandle(rawEDate, candles);
          if (exitTime) {
            hasExplicitExit = true;
            markers.push({
              time: exitTime,
              position: isShort ? 'belowBar' : 'aboveBar',
              color: '#ef4444',
              shape: isShort ? 'arrowUp' : 'arrowDown',
              text: `${e.label} ${e.price ? `₹${e.price}` : ''}`
            });
          }
        }
      });

      // Single exit fallback
      if (!hasExplicitExit && (trade.status === 'Closed' || trade.exitDate)) {
        const rawExitDate = parseToYMD(trade.exitDate || trade.date);
        const exitTime = findNearestCandle(rawExitDate, candles);
        const exitPrice = parseFloat(trade.avgExitPrice ?? trade.exit ?? trade.cmp ?? 0) || 0;
        if (exitTime) {
          markers.push({
            time: exitTime,
            position: isShort ? 'belowBar' : 'aboveBar',
            color: (parseFloat(trade.pnl || 0) >= 0) ? '#10b981' : '#ef4444',
            shape: isShort ? 'arrowUp' : 'arrowDown',
            text: `Exit ${exitPrice > 0 ? `₹${exitPrice}` : ''}`
          });
        }
      }

      markers.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      if (markers.length > 0) {
        try {
          if (typeof createSeriesMarkers === 'function') {
            createSeriesMarkers(mainSeries, markers);
          } else if (typeof mainSeries.setMarkers === 'function') {
            mainSeries.setMarkers(markers);
          }
        } catch (_) {}
      }
    }

    // Fit content
    try {
      chart.timeScale().fitContent();
    } catch (_) {}

    // Auto-Resize observer
    const ro = new ResizeObserver(entries => {
      if (!entries || entries.length === 0 || !chartRef.current) return;
      const { width } = entries[0].contentRect;
      if (width > 0) {
        chartRef.current.applyOptions({ width });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (_) {}
        chartRef.current = null;
      }
    };
  }, [candles, trade, theme, chartPrefs, showMarkers, showPriceLines, timeframe]);

  const handleResetZoom = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', position: 'relative' }}>
      {/* Top HUD Controls Bar */}
      {showControls && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)'
        }}>
          {/* Timeframe Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '4px' }}>
              Timeframe
            </span>
            {[
              { id: '1d', label: '1D' },
              { id: '1h', label: '1H' },
              { id: '15m', label: '15M' },
              { id: '5m', label: '5M' },
            ].map(tf => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '5px',
                  border: '1px solid',
                  borderColor: timeframe === tf.id ? 'var(--text-primary)' : 'var(--border-color)',
                  backgroundColor: timeframe === tf.id ? 'var(--text-primary)' : 'transparent',
                  color: timeframe === tf.id ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Marker & Risk Line Toggles + Reset Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setShowMarkers(v => !v)}
              title={showMarkers ? 'Hide execution markers' : 'Show execution markers'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                backgroundColor: showMarkers ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                color: showMarkers ? '#10b981' : 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {showMarkers ? <Eye size={12} /> : <EyeOff size={12} />}
              <span>Markers</span>
            </button>

            <button
              onClick={() => setShowPriceLines(v => !v)}
              title={showPriceLines ? 'Hide SL/Target lines' : 'Show SL/Target lines'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                backgroundColor: showPriceLines ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                color: showPriceLines ? '#3b82f6' : 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Layers size={12} />
              <span>Risk Lines</span>
            </button>

            <button
              onClick={handleResetZoom}
              title="Reset Zoom / Fit Content"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={11} />
              <span>Fit</span>
            </button>
          </div>
        </div>
      )}

      {/* Chart Canvas Area */}
      <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
        {isLoading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600
            }}>
              <Activity size={14} className="animate-spin" />
              <span>Fetching exchange candles for {cleanSym}...</span>
            </div>
          </div>
        )}

        {loadError && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{
              padding: '16px 24px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              fontSize: '13px'
            }}>
              {loadError}
            </div>
          </div>
        )}

        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
