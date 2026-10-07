import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, Search, BarChart2, Calendar, Check, 
  ArrowUpRight, RotateCcw, FastForward, Sliders, 
  Eye, EyeOff, Palette, Layers, RefreshCw, ChevronDown, Filter,
  SlidersHorizontal, X, ArrowRight, Settings,
  MousePointer, Minus, Ruler, Trash2,
  Play, Pause, SkipForward, Scissors,
  Target, Download, Expand, Shrink, FileText, Image as ImageIcon
} from 'lucide-react';
import { createChart, CandlestickSeries, LineSeries, AreaSeries, BarSeries, HistogramSeries, createSeriesMarkers, LineStyle } from 'lightweight-charts';
import { jsPDF } from 'jspdf';
import { fetchHistoricalCandles } from '../../services/yahooChartService';
import SymbolLogo from '../SymbolLogo';
import StockAutocomplete from '../StockAutocomplete';
import ModernDropdown from '../ModernDropdown';
import FoxTradeLogo, { foxtradeEmblem } from '../FoxTradeLogo';
import StockChartSettingsModal, { DEFAULT_CHART_SETTINGS } from '../StockChartSettingsModal';
import { getGlobalChartPreferences, setGlobalChartType, setGlobalChartSettings } from '../../services/chartPreferencesService';
import ReplayPlayerBar from '../charts/ReplayPlayerBar';
import ReplayTradeDetailPanel from '../charts/ReplayTradeDetailPanel';
import ReplayPracticePanel from '../charts/ReplayPracticePanel';
import { findNearestCandleIndex, getCandleTimestampSeconds } from '../../services/candleCacheService';

export default function StockChartsPage({ 
  trades = [], 
  allTrades = [],
  selectedSymbol: propSymbol, 
  onSelectSymbol, 
  chartOnly = false,
  onOpenAddTrade,
  onOpenQuickLog,
  onOpenImport,
  onNavigateToJournal,
  dateRange = 'All Time',
  resolvedDateFilter = null
}) {
  // ── 1. Top Metrics Calculation ─────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalTrades = trades.length;
    const closedTrades = trades.filter(t => t.status === 'Closed');
    const closedCount = closedTrades.length;
    const uniqueSymbols = new Set(trades.map(t => (t.name || t.symbol || '').toUpperCase()).filter(Boolean));
    const winTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    const lossTrades = closedTrades.filter(t => (t.pnl || 0) < 0);
    const winCount = winTrades.length;
    const lossCount = lossTrades.length;
    const decidedTrades = closedTrades.filter(t => (t.pnl || 0) !== 0);
    const winRate = decidedTrades.length > 0 ? (winCount / decidedTrades.length) * 100 : (closedCount > 0 ? (winCount / closedCount) * 100 : 0);
    const totalPnl = trades.reduce((acc, t) => acc + (t.pnl || 0), 0);
    const avgPnl = totalTrades > 0 ? totalPnl / totalTrades : 0;

    return {
      totalTrades,
      uniqueCount: uniqueSymbols.size,
      winRate: winRate.toFixed(1),
      winCount,
      lossCount,
      totalPnl: Math.round(totalPnl),
      avgPnl: Math.round(avgPnl)
    };
  }, [trades]);

  // ── 2. Top Winners & Losers Extraction ─────────────────────────────────────
  const [viewTab, setViewTab] = useState('winners'); // 'winners' | 'losers'
  const [sourceMode, setSourceMode] = useState('trades'); // 'trades' | 'stocks'
  const [minGainFilter, setMinGainFilter] = useState(0); // 0, 2, 3, 5, 10, 20
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [customGainThreshold, setCustomGainThreshold] = useState('');

  const { topWinners, topLosers } = useMemo(() => {
    if (sourceMode === 'trades') {
      // Return trades ranked by P&L
      const sortedByPnl = [...trades].sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
      const winners = sortedByPnl.filter(t => (t.pnl || 0) > 0 && Math.abs(t.stockMove || 0) >= minGainFilter);
      const losers = [...trades].sort((a, b) => (a.pnl || 0) - (b.pnl || 0)).filter(t => (t.pnl || 0) < 0);
      return { topWinners: winners, topLosers: losers };
    } else {
      // Aggregated per stock
      const stockMap = {};
      trades.forEach(t => {
        const sym = (t.name || t.symbol || '').toUpperCase().trim();
        if (!sym) return;
        if (!stockMap[sym]) stockMap[sym] = { symbol: sym, pnl: 0, count: 0, winCount: 0, date: t.date, setup: t.setup };
        stockMap[sym].pnl += (t.pnl || 0);
        stockMap[sym].count += 1;
        if ((t.pnl || 0) > 0) stockMap[sym].winCount += 1;
      });
      const list = Object.values(stockMap);
      const winners = list.filter(s => s.pnl > 0).sort((a, b) => b.pnl - a.pnl);
      const losers = list.filter(s => s.pnl < 0).sort((a, b) => a.pnl - b.pnl);
      return { topWinners: winners, topLosers: losers };
    }
  }, [trades, sourceMode, minGainFilter]);

  // Helper to dynamically resolve primary stock from portfolio trades
  const resolveDefaultStock = useCallback(() => {
    if (propSymbol) return propSymbol.toUpperCase().trim();
    if (trades && trades.length > 0) {
      const sortedByPnl = [...trades].sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
      const first = sortedByPnl[0] || trades[0];
      return (first?.name || first?.symbol || '').toUpperCase().trim() || null;
    }
    return null;
  }, [propSymbol, trades]);

  // Selected Stock for Candlestick Chart (Dynamic, 0 hardcoded symbols)
  const [selectedSymbol, setSelectedSymbol] = useState(resolveDefaultStock);
  const [isMarketExplorerMode, setIsMarketExplorerMode] = useState(false);

  useEffect(() => {
    if (propSymbol) {
      setSelectedSymbol(propSymbol.toUpperCase().trim());
      setIsMarketExplorerMode(false);
      return;
    }
    if (trades && trades.length > 0) {
      const exists = selectedSymbol && trades.some(t => (t.name || t.symbol || '').toUpperCase().trim() === selectedSymbol.toUpperCase().trim());
      if (!exists && !isMarketExplorerMode) {
        const sortedByPnl = [...trades].sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
        const first = sortedByPnl[0] || trades[0];
        const next = (first?.name || first?.symbol || '').toUpperCase().trim();
        if (next) {
          setSelectedSymbol(next);
          if (onSelectSymbol) onSelectSymbol(next);
        }
      }
    } else {
      if (!isMarketExplorerMode) {
        setSelectedSymbol(null);
      }
    }
  }, [propSymbol, trades, isMarketExplorerMode]);

  const handleSelectSymbol = (sym) => {
    if (!sym) {
      setSelectedSymbol(null);
      setIsMarketExplorerMode(false);
      if (onSelectSymbol) onSelectSymbol(null);
      return;
    }
    const clean = sym.toUpperCase().trim();
    setSelectedSymbol(clean);
    const inTrades = trades.some(t => (t.name || t.symbol || '').toUpperCase().trim() === clean);
    setIsMarketExplorerMode(!inTrades);
    if (onSelectSymbol) onSelectSymbol(clean);
  };

  const isMarketMode = Boolean(
    selectedSymbol && (!trades || !trades.some(t => (t.name || t.symbol || '').toUpperCase().trim() === selectedSymbol.toUpperCase().trim()))
  );

  const [isStockDropdownOpen, setIsStockDropdownOpen] = useState(false);
  const [stockSearchQuery, setStockSearchQuery] = useState('');

  const uniqueTradeStocks = useMemo(() => {
    const stockMap = {};
    (trades || []).forEach(t => {
      const sym = (t.name || t.symbol || '').toUpperCase().trim();
      if (!sym) return;
      if (!stockMap[sym]) {
        stockMap[sym] = {
          symbol: sym,
          tradesCount: 0,
          pnl: 0,
          winCount: 0
        };
      }
      stockMap[sym].tradesCount += 1;
      stockMap[sym].pnl += (t.pnl || 0);
      if ((t.pnl || 0) > 0) stockMap[sym].winCount += 1;
    });

    return Object.values(stockMap).sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  const filteredTradeStocks = useMemo(() => {
    if (!stockSearchQuery.trim()) return uniqueTradeStocks;
    const q = stockSearchQuery.toUpperCase().trim();
    return uniqueTradeStocks.filter(s => s.symbol.includes(q));
  }, [uniqueTradeStocks, stockSearchQuery]);

  const [range, setRange] = useState('5y'); // '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | 'custom'
  const [chartInterval, setChartInterval] = useState('1d'); // '1d' | '1w' | '1m'
  const [customFromDate, setCustomFromDate] = useState('2023-01-01');
  const [customToDate, setCustomToDate] = useState('2026-08-29');
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showTargetLines, setShowTargetLines] = useState(false);
  const [isQuickDockOpen, setIsQuickDockOpen] = useState(false);
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const targetLinesRef = useRef([]);

  // ── Interactive Chart Drawing Tools ─────────────────────────────────────────
  const [activeDrawingTool, setActiveDrawingTool] = useState('none'); // 'none' | 'trendline' | 'horizontal' | 'measure'
  const [drawings, setDrawings] = useState([]);
  const [draftDrawing, setDraftDrawing] = useState(null);
  const [hoveredDrawingId, setHoveredDrawingId] = useState(null);
  const [drawingRenderVersion, setDrawingRenderVersion] = useState(0);

  // Load saved drawings per symbol
  useEffect(() => {
    if (!selectedSymbol) return;
    try {
      const saved = localStorage.getItem(`tradeontip_drawings_${selectedSymbol}`);
      if (saved) {
        setDrawings(JSON.parse(saved));
      } else {
        setDrawings([]);
      }
    } catch (e) {
      setDrawings([]);
    }
    setDraftDrawing(null);
  }, [selectedSymbol]);

  // Pre-cache stock logo as Data URL so export can execute synchronously without popup blocker issues
  const cachedLogoRef = useRef(null);
  useEffect(() => {
    cachedLogoRef.current = null;
    let isMounted = true;
    const cleanSymbol = (selectedSymbol || '').trim().toUpperCase().replace(/\.(NS|BO|NSE|BSE)$/i, '').replace(/[^A-Z0-9]/g, '');
    if (!cleanSymbol) return;

    fetch(`https://images.dhan.co/symbol/${cleanSymbol}.png`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.blob();
      })
      .then(blob => {
        const reader = new FileReader();
        reader.onload = () => {
          if (!isMounted) return;
          const img = new Image();
          img.onload = () => {
            if (isMounted) cachedLogoRef.current = img;
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {});

    return () => { isMounted = false; };
  }, [selectedSymbol]);

  // Pre-load FoxTrade emblem for chart export watermarks
  const foxEmblemRef = useRef(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => { foxEmblemRef.current = img; };
    img.src = foxtradeEmblem;
  }, []);

  const saveDrawings = (newDrawings) => {
    setDrawings(newDrawings);
    if (!selectedSymbol) return;
    try {
      localStorage.setItem(`tradeontip_drawings_${selectedSymbol}`, JSON.stringify(newDrawings));
    } catch (e) {}
  };

  const deleteDrawing = (id) => {
    const updated = drawings.filter(d => d.id !== id);
    saveDrawings(updated);
  };

  // Escape key cancels active drawing draft
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDraftDrawing(null);
        setActiveDrawingTool('none');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── 4. Chart Settings (Symbol & Canvas Preferences) ─────────────────────────
  const [chartType, setChartType] = useState(() => {
    return getGlobalChartPreferences().chartType;
  });
  const [chartSettings, setChartSettings] = useState(() => {
    return getGlobalChartPreferences().settings;
  });
  const [showChartSettingsModal, setShowChartSettingsModal] = useState(false);

  const handleSetChartType = (newType) => {
    setChartType(newType);
    setGlobalChartType(newType);
  };

  const handleSaveChartSettings = (newSettings) => {
    setChartSettings(newSettings);
    setGlobalChartSettings(newSettings);
  };

  // ── 5. Moving Averages State (SMA / EMA 20, 50, 200) ─────────────────────────
  const [m1, setM1] = useState({ enabled: false, period: 20, type: 'SMA', color: '#3b82f6' }); // Blue
  const [m2, setM2] = useState({ enabled: false, period: 50, type: 'SMA', color: '#ef4444' }); // Red
  const [m3, setM3] = useState({ enabled: false, period: 200, type: 'SMA', color: '#10b981' }); // Green
  const [showMaModal, setShowMaModal] = useState(false);

  // ── 6. Replay Simulator State & Services ──────────────────────────────────
  const [replayModeActive, setReplayModeActive] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isCutModeActive, setIsCutModeActive] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [practicePosition, setPracticePosition] = useState(null);
  const [selectedReplayTrade, setSelectedReplayTrade] = useState(null);

  const replayTimerRef = useRef(null);
  const isCutModeActiveRef = useRef(false);
  isCutModeActiveRef.current = isCutModeActive;
  const initialCutIndexRef = useRef(null);
  const pendingReplayAnchorRef = useRef(null);

  // ── 7. Candles Data Fetching & Mid-Replay Timeframe Anchor ───────────────────
  const [rawCandles, setRawCandles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedSymbol) {
      setRawCandles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchHistoricalCandles(selectedSymbol, range === 'custom' ? '5y' : range, chartInterval)
      .then(data => {
        const candleData = data || [];
        setRawCandles(candleData);
        if (replayModeActive && pendingReplayAnchorRef.current) {
          const newIdx = findNearestCandleIndex(candleData, pendingReplayAnchorRef.current);
          setReplayIndex(Math.max(1, newIdx + 1));
          pendingReplayAnchorRef.current = null;
        } else if (!replayModeActive) {
          setReplayIndex(candleData.length);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Candles error:', err);
        setLoading(false);
      });
  }, [selectedSymbol, range, chartInterval]);

  const candles = useMemo(() => {
    if (range !== 'custom' || !customFromDate || !customToDate) {
      return rawCandles;
    }
    return rawCandles.filter(c => c.time >= customFromDate && c.time <= customToDate);
  }, [rawCandles, range, customFromDate, customToDate]);

  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  const visibleCandles = useMemo(() => {
    if (!replayModeActive || replayIndex >= candles.length) return candles;
    return candles.slice(0, Math.max(1, replayIndex));
  }, [candles, replayModeActive, replayIndex]);

  // Replay playback interval timer
  useEffect(() => {
    if (!isReplaying || !replayModeActive) {
      if (replayTimerRef.current) {
        window.clearInterval(replayTimerRef.current);
        replayTimerRef.current = null;
      }
      return;
    }
    const intervalMs = Math.max(50, Math.round(1000 / replaySpeed));
    replayTimerRef.current = window.setInterval(() => {
      setReplayIndex(prev => {
        if (prev >= candles.length) {
          setIsReplaying(false);
          return candles.length;
        }
        setPracticePosition(pos => {
          if (pos && pos.status === 'OPEN') {
            return { ...pos, barsHeld: (pos.barsHeld || 0) + 1 };
          }
          return pos;
        });
        return prev + 1;
      });
    }, intervalMs);
    return () => {
      if (replayTimerRef.current) {
        window.clearInterval(replayTimerRef.current);
        replayTimerRef.current = null;
      }
    };
  }, [isReplaying, replayModeActive, replaySpeed, candles.length]);

  // Handle timeframe change mid-replay without losing position
  const handleIntervalChange = (newInterval) => {
    if (replayModeActive && visibleCandles.length > 0) {
      const currentCandle = visibleCandles[visibleCandles.length - 1];
      const currentTs = getCandleTimestampSeconds(currentCandle);
      pendingReplayAnchorRef.current = currentTs;
    }
    setChartInterval(newInterval);
  };

  const handleJumpToDate = (targetDateStr) => {
    if (!targetDateStr || candles.length === 0) return;
    const targetTs = new Date(targetDateStr).getTime() / 1000;
    const idx = findNearestCandleIndex(candles, targetTs);
    if (idx >= 0) {
      setIsReplaying(false);
      setReplayIndex(Math.max(1, idx + 1));
      initialCutIndexRef.current = Math.max(1, idx + 1);
    }
  };

  const handleRestartReplay = () => {
    setIsReplaying(false);
    const restartIdx = initialCutIndexRef.current !== null ? initialCutIndexRef.current : Math.max(1, candles.length - 35);
    setReplayIndex(restartIdx);
  };

  const handleOpenPracticePosition = (side, qty, price) => {
    setPracticePosition({
      side,
      qty,
      entryPrice: price,
      entryTime: visibleCandles[visibleCandles.length - 1]?.time,
      status: 'OPEN',
      barsHeld: 0,
      pnl: 0,
      pnlPct: 0
    });
  };

  const handleClosePracticePosition = (exitPrice) => {
    if (!practicePosition || practicePosition.status !== 'OPEN') return;
    const isBuy = practicePosition.side === 'BUY';
    const priceDiff = isBuy ? (exitPrice - practicePosition.entryPrice) : (practicePosition.entryPrice - exitPrice);
    const pnl = priceDiff * practicePosition.qty;
    const pnlPct = (priceDiff / practicePosition.entryPrice) * 100;
    setPracticePosition({
      ...practicePosition,
      status: 'CLOSED',
      exitPrice,
      exitTime: visibleCandles[visibleCandles.length - 1]?.time,
      pnl,
      pnlPct
    });
  };

  const handleResetPracticePosition = () => {
    setPracticePosition(null);
  };

  // Keyboard Shortcuts for Replay Mode (Space = Play/Pause, Left/Right = Step, Escape = Exit)
  useEffect(() => {
    if (!replayModeActive) return;

    const handleKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (replayIndex >= candles.length) {
          setReplayIndex(Math.max(1, candles.length - 35));
          setIsReplaying(true);
        } else {
          setIsReplaying(prev => !prev);
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setIsReplaying(false);
        setReplayIndex(prev => Math.min(candles.length, prev + 1));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setIsReplaying(false);
        setReplayIndex(prev => Math.max(1, prev - 1));
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (selectedReplayTrade) {
          setSelectedReplayTrade(null);
        } else if (isPracticeMode) {
          setIsPracticeMode(false);
        } else {
          setReplayModeActive(false);
          setIsReplaying(false);
          setReplayIndex(candles.length);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [replayModeActive, candles.length, replayIndex, selectedReplayTrade, isPracticeMode]);

  // ── 8. Technical Moving Average Calculations ────────────────────────────────
  const calculateMA = (data, period, type = 'SMA') => {
    if (!data || data.length < period) return [];
    if (type === 'EMA') {
      const k = 2 / (period + 1);
      const ema = [];
      let prevEma = data[0].close;
      for (let i = 0; i < data.length; i++) {
        const val = i === 0 ? data[i].close : (data[i].close * k) + (prevEma * (1 - k));
        prevEma = val;
        if (i >= period - 1) {
          ema.push({ time: data[i].time, value: Math.round(val * 100) / 100 });
        }
      }
      return ema;
    }
    const sma = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) continue;
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close;
      }
      sma.push({ time: data[i].time, value: Math.round((sum / period) * 100) / 100 });
    }
    return sma;
  };

  const parseTradeDate = (dStr) => {
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
  };

  const getCandleMs = (c) => {
    if (!c) return 0;
    if (c.rawTimestamp) return c.rawTimestamp * 1000;
    if (typeof c.time === 'number') return c.time * 1000;
    const t = new Date(c.time).getTime();
    return isNaN(t) ? 0 : t;
  };

  const findNearestCandle = (targetDate, candleList) => {
    if (!targetDate || !candleList || candleList.length === 0) return null;
    const exact = candleList.find(c => c.time === targetDate);
    if (exact) return exact.time;

    const targetTs = new Date(targetDate).getTime();
    if (isNaN(targetTs)) return null;

    let closest = candleList[0];
    let minDiff = Math.abs(getCandleMs(closest) - targetTs);

    for (let i = 1; i < candleList.length; i++) {
      const diff = Math.abs(getCandleMs(candleList[i]) - targetTs);
      if (diff < minDiff) {
        minDiff = diff;
        closest = candleList[i];
      }
    }

    if (minDiff <= 14 * 24 * 60 * 60 * 1000) {
      return closest.time;
    }
    return null;
  };

  const [hoverTooltipData, setHoverTooltipData] = useState(null);

  // ── 9. Lightweight Charts Canvas ──────────────────────────────────────────
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const m1SeriesRef = useRef(null);
  const m2SeriesRef = useRef(null);
  const m3SeriesRef = useRef(null);
  const practiceLineRef = useRef(null);
  const rawMarkerListRef = useRef([]);
  const syncMarkerPositionsRef = useRef(null);
  const [markerElements, setMarkerElements] = useState([]);

  // Compute raw trade execution markers matching visible candles
  const computeRawMarkerList = useCallback((currentCandles) => {
    if (!selectedSymbol || !currentCandles || currentCandles.length === 0) return [];
    const symbolTrades = (trades || []).filter(t => (t.name || t.symbol || '').toUpperCase().trim() === selectedSymbol.toUpperCase().trim());
    if (symbolTrades.length === 0) return [];

    const candleMap = new Map();
    const getCandleLegs = (time) => {
      if (!candleMap.has(time)) {
        candleMap.set(time, { below: [], above: [] });
      }
      return candleMap.get(time);
    };

    symbolTrades.forEach((t) => {
      // 1. Initial Entry
      const rawEntry = parseTradeDate(t.date || t.entryDate || t.entryLegs?.[0]?.date);
      const entryCandle = findNearestCandle(rawEntry, currentCandles);
      if (entryCandle) {
        const legs = getCandleLegs(entryCandle);
        if (!legs.below.includes('Entry')) legs.below.push('Entry');
      }

      // 2. Pyramids
      if (Array.isArray(t.entryLegs) && t.entryLegs.length > 1) {
        t.entryLegs.slice(1).forEach((leg, idx) => {
          if (leg.date && (Number(leg.price) > 0 || Number(leg.qty) > 0)) {
            const rawDate = parseTradeDate(leg.date);
            const cTime = findNearestCandle(rawDate, currentCandles);
            if (cTime) {
              const label = `P${idx + 1}`;
              const legs = getCandleLegs(cTime);
              if (!legs.below.includes(label)) legs.below.push(label);
            }
          }
        });
      } else {
        const pyramids = [
          { date: t.p1Date, price: t.p1Price, qty: t.p1Qty, label: 'P1' },
          { date: t.p2Date, price: t.p2Price, qty: t.p2Qty, label: 'P2' },
          { date: t.p3Date, price: t.p3Price, qty: t.p3Qty, label: 'P3' },
          { date: t.p4Date, price: t.p4Price, qty: t.p4Qty, label: 'P4' },
        ];
        pyramids.forEach(p => {
          if (p.date && (Number(p.price) > 0 || Number(p.qty) > 0)) {
            const rawDate = parseTradeDate(p.date);
            const cTime = findNearestCandle(rawDate, currentCandles);
            if (cTime) {
              const legs = getCandleLegs(cTime);
              if (!legs.below.includes(p.label)) legs.below.push(p.label);
            }
          }
        });
      }

      if (Array.isArray(t.transactionHistory?.entries) && t.transactionHistory.entries.length > 1) {
        t.transactionHistory.entries.slice(1).forEach((leg, idx) => {
          if (leg.date && (Number(leg.price) > 0 || Number(leg.qty) > 0)) {
            const rawDate = parseTradeDate(leg.date);
            const cTime = findNearestCandle(rawDate, currentCandles);
            if (cTime) {
              const label = `P${idx + 1}`;
              const legs = getCandleLegs(cTime);
              if (!legs.below.includes(label)) legs.below.push(label);
            }
          }
        });
      }

      // 3. Exits
      if (Array.isArray(t.exitLegs) && t.exitLegs.length > 0) {
        t.exitLegs.forEach((leg, idx) => {
          if (leg.date && (Number(leg.price) > 0 || Number(leg.qty) > 0)) {
            const rawDate = parseTradeDate(leg.date);
            const cTime = findNearestCandle(rawDate, currentCandles);
            if (cTime) {
              const label = `E${idx + 1}`;
              const legs = getCandleLegs(cTime);
              if (!legs.above.includes(label)) legs.above.push(label);
            }
          }
        });
      } else {
        const exits = [
          { date: t.e1Date, price: t.e1Price, qty: t.e1Qty, label: 'E1' },
          { date: t.e2Date, price: t.e2Price, qty: t.e2Qty, label: 'E2' },
          { date: t.e3Date, price: t.e3Price, qty: t.e3Qty, label: 'E3' },
          { date: t.e4Date, price: t.e4Price, qty: t.e4Qty, label: 'E4' },
        ];
        let foundExit = false;
        exits.forEach(e => {
          if (e.date && (Number(e.price) > 0 || Number(e.qty) > 0)) {
            foundExit = true;
            const rawDate = parseTradeDate(e.date);
            const cTime = findNearestCandle(rawDate, currentCandles);
            if (cTime) {
              const legs = getCandleLegs(cTime);
              if (!legs.above.includes(e.label)) legs.above.push(e.label);
            }
          }
        });

        if (!foundExit && t.exitDate && t.status === 'Closed') {
          const rawDate = parseTradeDate(t.exitDate);
          const cTime = findNearestCandle(rawDate, currentCandles);
          if (cTime) {
            const legs = getCandleLegs(cTime);
            if (!legs.above.includes('Exit')) legs.above.push('Exit');
          }
        }
      }

      if (Array.isArray(t.transactionHistory?.exits) && t.transactionHistory.exits.length > 0) {
        t.transactionHistory.exits.forEach((leg, idx) => {
          if (leg.date && (Number(leg.price) > 0 || Number(leg.qty) > 0)) {
            const rawDate = parseTradeDate(leg.date);
            const cTime = findNearestCandle(rawDate, currentCandles);
            if (cTime) {
              const label = `E${idx + 1}`;
              const legs = getCandleLegs(cTime);
              if (!legs.above.includes(label)) legs.above.push(label);
            }
          }
        });
      }
    });

    const list = [];
    for (const [time, legs] of candleMap.entries()) {
      const candle = currentCandles.find(c => c.time === time);
      if (!candle) continue;

      const matchingTrades = symbolTrades.filter(t => {
        const rawE = parseTradeDate(t.date || t.entryDate || t.entryLegs?.[0]?.date);
        if (findNearestCandle(rawE, currentCandles) === time) return true;

        for (let i = 1; i <= 4; i++) {
          const pD = t[`p${i}Date`] || t.entryLegs?.[i]?.date;
          if (pD && findNearestCandle(parseTradeDate(pD), currentCandles) === time) return true;
        }

        for (let j = 1; j <= 4; j++) {
          const eD = t[`e${j}Date`] || t.exitLegs?.[j - 1]?.date;
          if (eD && findNearestCandle(parseTradeDate(eD), currentCandles) === time) return true;
        }

        if (t.exitDate && findNearestCandle(parseTradeDate(t.exitDate), currentCandles) === time) return true;
        return false;
      });

      if (legs.below.length > 0) {
        list.push({
          id: `below-${time}`,
          time,
          candle,
          position: 'below',
          label: legs.below.join(' • '),
          trades: matchingTrades
        });
      }
      if (legs.above.length > 0) {
        list.push({
          id: `above-${time}`,
          time,
          candle,
          position: 'above',
          label: legs.above.join(' • '),
          trades: matchingTrades
        });
      }
    }
    return list;
  }, [trades, selectedSymbol]);

  // Synchronize on-screen coordinate positions of execution markers
  const syncMarkerPositions = useCallback(() => {
    if (!chartRef.current || !mainSeriesRef.current || !chartContainerRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const series = mainSeriesRef.current;
    const width = chartContainerRef.current.clientWidth;
    const height = chartContainerRef.current.clientHeight;

    const positioned = [];
    for (const m of rawMarkerListRef.current) {
      const x = timeScale.timeToCoordinate(m.time);
      if (x === null || x < -30 || x > width + 30) continue;

      const price = m.position === 'below' ? m.candle.low : m.candle.high;
      const y = series.priceToCoordinate(price);
      if (y === null || y < -30 || y > height + 30) continue;

      positioned.push({
        ...m,
        x,
        y
      });
    }
    setMarkerElements(positioned);
    setDrawingRenderVersion(v => v + 1);
  }, []);

  useEffect(() => {
    syncMarkerPositionsRef.current = syncMarkerPositions;
  }, [syncMarkerPositions]);

  // Effect A: Create Chart Canvas, Base Series & Listeners
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (_) {}
      chartRef.current = null;
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      m1SeriesRef.current = null;
      m2SeriesRef.current = null;
      m3SeriesRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: isChartFullscreen ? (container.clientHeight || (typeof window !== 'undefined' ? window.innerHeight - 130 : 560)) : 560,
      layout: {
        background: { color: chartSettings.canvasBgColor || 'transparent' },
        textColor: '#9ca3af',
        fontFamily: 'Inter, system-ui, sans-serif',
        attributionLogo: false,
      },
      grid: {
        vertLines: { 
          visible: chartSettings.vertGridVisible !== false,
          color: chartSettings.vertGridColor || 'rgba(229, 231, 235, 0.35)' 
        },
        horzLines: { 
          visible: chartSettings.horzGridVisible !== false,
          color: chartSettings.horzGridColor || 'rgba(229, 231, 235, 0.35)' 
        },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.2 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: chartInterval !== '1d' && chartInterval !== '1w' && chartInterval !== '1mo',
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: chartSettings.crosshairColor || '#9ca3af', width: 1, style: 3 },
        horzLine: { color: chartSettings.crosshairColor || '#9ca3af', width: 1, style: 3 },
      },
      handleScroll: (chartOnly && !isChartFullscreen) ? {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      } : {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      },
      handleScale: (chartOnly && !isChartFullscreen) ? {
        mouseWheel: false,
        pinch: true,
        axisPressedMouseMove: true,
        axisDoubleClickReset: true
      } : {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
        axisDoubleClickReset: true
      }
    });

    chartRef.current = chart;

    let mainSeries;
    if (chartType === 'bars') {
      const barOpts = {
        upColor: chartSettings.upColor || '#26a69a',
        downColor: chartSettings.downColor || '#ef5350',
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
        downColor: chartSettings.bodyVisible !== false ? (chartSettings.downColor || '#ef5350') : 'transparent',
        borderVisible: chartSettings.borderVisible !== false,
        borderColor: chartSettings.borderUpColor || chartSettings.upColor || '#26a69a',
        borderUpColor: chartSettings.borderUpColor || chartSettings.upColor || '#26a69a',
        borderDownColor: chartSettings.borderDownColor || chartSettings.downColor || '#ef5350',
        wickVisible: chartSettings.wickVisible !== false,
        wickUpColor: chartSettings.wickUpColor || chartSettings.upColor || '#26a69a',
        wickDownColor: chartSettings.wickDownColor || chartSettings.downColor || '#ef5350',
        priceLineVisible: false,
        lastValueVisible: false,
      };
      mainSeries = typeof chart.addCandlestickSeries === 'function'
        ? chart.addCandlestickSeries(hollowOpts)
        : chart.addSeries(CandlestickSeries, hollowOpts);
    } else {
      const candleOpts = {
        upColor: chartSettings.bodyVisible !== false ? (chartSettings.upColor || '#26a69a') : 'transparent',
        downColor: chartSettings.bodyVisible !== false ? (chartSettings.downColor || '#ef5350') : 'transparent',
        borderVisible: chartSettings.borderVisible !== false,
        borderColor: chartSettings.borderUpColor || chartSettings.upColor || '#26a69a',
        borderUpColor: chartSettings.borderUpColor || chartSettings.upColor || '#26a69a',
        borderDownColor: chartSettings.borderDownColor || chartSettings.downColor || '#ef5350',
        wickVisible: chartSettings.wickVisible !== false,
        wickUpColor: chartSettings.wickUpColor || chartSettings.upColor || '#26a69a',
        wickDownColor: chartSettings.wickDownColor || chartSettings.downColor || '#ef5350',
        priceLineVisible: false,
        lastValueVisible: false,
      };
      mainSeries = typeof chart.addCandlestickSeries === 'function'
        ? chart.addCandlestickSeries(candleOpts)
        : chart.addSeries(CandlestickSeries, candleOpts);
    }
    mainSeriesRef.current = mainSeries;

    // Add Volume Histogram Series if showVolume is enabled
    if (showVolume) {
      try {
        const volumeSeries = typeof chart.addHistogramSeries === 'function'
          ? chart.addHistogramSeries({
              priceFormat: { type: 'volume' },
              priceScaleId: 'volume_scale',
              priceLineVisible: false,
              lastValueVisible: false,
            })
          : chart.addSeries(HistogramSeries, {
              priceFormat: { type: 'volume' },
              priceScaleId: 'volume_scale',
              priceLineVisible: false,
              lastValueVisible: false,
            });

        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
          visible: false,
        });
        volumeSeriesRef.current = volumeSeries;
      } catch (_) {}
    }

    // Moving Averages Line Series
    try {
      const s1 = chart.addLineSeries
        ? chart.addLineSeries({ color: m1.color, lineWidth: 1.5, title: `${m1.type} ${m1.period}`, priceLineVisible: false, lastValueVisible: false })
        : chart.addSeries(LineSeries, { color: m1.color, lineWidth: 1.5, title: `${m1.type} ${m1.period}`, priceLineVisible: false, lastValueVisible: false });
      m1SeriesRef.current = s1;

      const s2 = chart.addLineSeries
        ? chart.addLineSeries({ color: m2.color, lineWidth: 1.5, title: `${m2.type} ${m2.period}`, priceLineVisible: false, lastValueVisible: false })
        : chart.addSeries(LineSeries, { color: m2.color, lineWidth: 1.5, title: `${m2.type} ${m2.period}`, priceLineVisible: false, lastValueVisible: false });
      m2SeriesRef.current = s2;

      const s3 = chart.addLineSeries
        ? chart.addLineSeries({ color: m3.color, lineWidth: 1.5, title: `${m3.type} ${m3.period}`, priceLineVisible: false, lastValueVisible: false })
        : chart.addSeries(LineSeries, { color: m3.color, lineWidth: 1.5, title: `${m3.type} ${m3.period}`, priceLineVisible: false, lastValueVisible: false });
      m3SeriesRef.current = s3;
    } catch (_) {}

    // Click handler on chart for Cut Bar Tool
    const handleChartClick = (param) => {
      if (isCutModeActiveRef.current && param && param.time) {
        const clickedTime = param.time;
        const currentCandles = candlesRef.current || [];
        const clickedIdx = currentCandles.findIndex(c => c.time === clickedTime);
        if (clickedIdx >= 0) {
          setIsReplaying(false);
          setReplayIndex(Math.max(1, clickedIdx + 1));
          initialCutIndexRef.current = Math.max(1, clickedIdx + 1);
          setIsCutModeActive(false);
        }
      }
    };
    chart.subscribeClick(handleChartClick);

    // Keep coordinates synchronized at 60fps on drag, pan, zoom & time range changes
    const handleRangeChange = () => {
      if (syncMarkerPositionsRef.current) syncMarkerPositionsRef.current();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);
    chart.timeScale().subscribeVisibleTimeRangeChange(handleRangeChange);

    const handleResize = () => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({ width: container.clientWidth });
        if (syncMarkerPositionsRef.current) syncMarkerPositionsRef.current();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        try {
          chartRef.current.unsubscribeClick(handleChartClick);
          chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
          chartRef.current.timeScale().unsubscribeVisibleTimeRangeChange(handleRangeChange);
        } catch (_) {}
        try {
          chartRef.current.remove();
        } catch (_) {}
        chartRef.current = null;
        mainSeriesRef.current = null;
        volumeSeriesRef.current = null;
        m1SeriesRef.current = null;
        m2SeriesRef.current = null;
        m3SeriesRef.current = null;
      }
    };
  }, [chartType, chartSettings, isChartFullscreen, showVolume, chartInterval]);

  // Effect B: Synchronize Series Data & Markers smoothly without recreating chart canvas
  useEffect(() => {
    if (!chartRef.current || !mainSeriesRef.current) return;

    if (visibleCandles.length === 0) {
      try {
        mainSeriesRef.current.setData([]);
        if (volumeSeriesRef.current) volumeSeriesRef.current.setData([]);
        if (m1SeriesRef.current) m1SeriesRef.current.setData([]);
        if (m2SeriesRef.current) m2SeriesRef.current.setData([]);
        if (m3SeriesRef.current) m3SeriesRef.current.setData([]);
      } catch (_) {}
      rawMarkerListRef.current = [];
      setMarkerElements([]);
      return;
    }

    // 1. Update Main Price Series
    mainSeriesRef.current.setData(visibleCandles);

    // 2. Update Volume Series
    if (volumeSeriesRef.current && showVolume) {
      const volumeData = visibleCandles.map(c => ({
        time: c.time,
        value: c.volume || Math.round(c.close * 15000),
        color: (c.close >= c.open) ? 'rgba(38, 166, 154, 0.45)' : 'rgba(239, 83, 80, 0.45)'
      }));
      volumeSeriesRef.current.setData(volumeData);
    }

    // 3. Update Moving Averages Data
    if (m1SeriesRef.current) {
      const data = (m1.enabled && visibleCandles.length >= m1.period) ? calculateMA(visibleCandles, m1.period, m1.type) : [];
      m1SeriesRef.current.setData(data);
    }
    if (m2SeriesRef.current) {
      const data = (m2.enabled && visibleCandles.length >= m2.period) ? calculateMA(visibleCandles, m2.period, m2.type) : [];
      m2SeriesRef.current.setData(data);
    }
    if (m3SeriesRef.current) {
      const data = (m3.enabled && visibleCandles.length >= m3.period) ? calculateMA(visibleCandles, m3.period, m3.type) : [];
      m3SeriesRef.current.setData(data);
    }

    // 4. Auto-Scroll to keep newly revealed candle in view during replay
    if (replayModeActive && autoScroll && isReplaying) {
      chartRef.current.timeScale().scrollToPosition(3, false);
    }

    // 5. Compute & sync trade execution markers
    rawMarkerListRef.current = computeRawMarkerList(visibleCandles);
    requestAnimationFrame(() => {
      if (syncMarkerPositionsRef.current) {
        syncMarkerPositionsRef.current();
      }
    });
  }, [visibleCandles, showVolume, m1, m2, m3, autoScroll, replayModeActive, isReplaying, computeRawMarkerList]);

  // Effect C: Simulated Practice Trade Price Line on Chart
  useEffect(() => {
    if (!mainSeriesRef.current) return;
    if (practiceLineRef.current) {
      try {
        mainSeriesRef.current.removePriceLine(practiceLineRef.current);
      } catch (_) {}
      practiceLineRef.current = null;
    }

    if (practicePosition && practicePosition.status === 'OPEN' && practicePosition.entryPrice > 0) {
      const isBuy = practicePosition.side === 'BUY';
      try {
        practiceLineRef.current = mainSeriesRef.current.createPriceLine({
          price: practicePosition.entryPrice,
          color: isBuy ? '#10b981' : '#ef4444',
          lineWidth: 2,
          lineStyle: LineStyle ? LineStyle.Dashed : 2,
          axisLabelVisible: true,
          title: `SIM ${isBuy ? 'BUY' : 'SELL'} @ ₹${practicePosition.entryPrice.toFixed(2)}`
        });
      } catch (_) {}
    }

    return () => {
      if (practiceLineRef.current && mainSeriesRef.current) {
        try {
          mainSeriesRef.current.removePriceLine(practiceLineRef.current);
        } catch (_) {}
        practiceLineRef.current = null;
      }
    };
  }, [practicePosition?.status, practicePosition?.entryPrice, practicePosition?.side]);

  // ── 9b. Automated SL / Entry / 2R Forward Reference Lines ─────────────────
  useEffect(() => {
    if (!chartRef.current || !visibleCandles || visibleCandles.length === 0) return;

    // Clear previous target lines
    if (targetLinesRef.current.length > 0) {
      targetLinesRef.current.forEach(series => {
        try {
          chartRef.current?.removeSeries(series);
        } catch (err) {}
      });
      targetLinesRef.current = [];
    }

    if (!showTargetLines || !selectedSymbol) return;

    const symbolTrades = (trades || []).filter(t => (t.name || t.symbol || '').toUpperCase().trim() === selectedSymbol.toUpperCase().trim());
    if (symbolTrades.length === 0) return;
    const activeTrade = symbolTrades[symbolTrades.length - 1];
    if (!activeTrade) return;

    const entry = Number(activeTrade.entry || activeTrade.avgEntry || 0);
    const sl = Number(activeTrade.sl || activeTrade.stopLoss || 0);
    const p1Sl = Number(activeTrade.p1Sl || 0);
    const p2Sl = Number(activeTrade.p2Sl || 0);
    const tsl = Number(activeTrade.trailingSl || activeTrade.tsl || 0);
    const isShort = activeTrade.type?.toLowerCase() === 'sell';

    // Forward from entry: anchor lines to entry candle date
    const rawEntry = parseTradeDate(activeTrade.date || activeTrade.entryDate);
    const entryCandle = findNearestCandle(rawEntry, visibleCandles);
    const entryTime = entryCandle ? entryCandle.time : null;

    const addForwardLine = (price, color, title) => {
      if (!chartRef.current || !Number.isFinite(price) || price <= 0) return null;
      try {
        const series = chartRef.current.addSeries(LineSeries, {
          color,
          lineWidth: 1.5,
          lineStyle: LineStyle.Dashed,
          title,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false
        });
        const lineData = visibleCandles
          .filter(c => !entryTime || c.time >= entryTime)
          .map(c => ({ time: c.time, value: price }));
        if (lineData.length > 0) {
          series.setData(lineData);
        }
        return series;
      } catch (e) {
        return null;
      }
    };

    const newLines = [];

    // 1. Entry Line (Green)
    if (entry > 0) {
      const entryLine = addForwardLine(entry, '#16a34a', 'Entry');
      if (entryLine) newLines.push(entryLine);
    }

    // 2. Initial Stop Loss Line (Red)
    if (sl > 0) {
      const slLine = addForwardLine(sl, '#dc2626', 'SL');
      if (slLine) newLines.push(slLine);
    }

    // 3. P1 SL (Red)
    if (p1Sl > 0) {
      const p1SlLine = addForwardLine(p1Sl, '#dc2626', 'P1 SL');
      if (p1SlLine) newLines.push(p1SlLine);
    }

    // 4. P2 SL (Red)
    if (p2Sl > 0) {
      const p2SlLine = addForwardLine(p2Sl, '#dc2626', 'P2 SL');
      if (p2SlLine) newLines.push(p2SlLine);
    }

    // 5. Trailing SL (Indigo)
    if (tsl > 0) {
      const tslLine = addForwardLine(tsl, '#6366f1', 'TSL');
      if (tslLine) newLines.push(tslLine);
    }

    // 6. 2R Target (Amber / Gold)
    if (entry > 0 && sl > 0 && Math.abs(entry - sl) > 0.01) {
      const risk = Math.abs(entry - sl);
      const targetPrice = isShort ? entry - risk * 2 : entry + risk * 2;
      const targetLine = addForwardLine(targetPrice, '#f59e0b', '2R Target');
      if (targetLine) newLines.push(targetLine);
    }

    targetLinesRef.current = newLines;

    return () => {
      newLines.forEach(series => {
        try {
          chartRef.current?.removeSeries(series);
        } catch (err) {}
      });
      targetLinesRef.current = [];
    };
  }, [showTargetLines, selectedSymbol, visibleCandles, trades]);

  // ── 9c. Fullscreen Resize & Escape Listener ──────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: isChartFullscreen ? (chartContainerRef.current.clientHeight || (typeof window !== 'undefined' ? window.innerHeight - 130 : 560)) : 560
        });
        chartRef.current.timeScale().fitContent();
      }
    };

    const timer = setTimeout(handleResize, 60);
    window.addEventListener('resize', handleResize);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isChartFullscreen) {
        setIsChartFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isChartFullscreen]);

  // ── 9d. Download PNG & Single-Trade PDF Handlers ─────────────────────────
  // Helper to detect current theme for export
  const getExportTheme = () => {
    const dataTheme = document.documentElement.getAttribute('data-theme') || '';
    const isPitchBlack = dataTheme === 'pitch-black';
    const isDark = dataTheme === 'dark' || 
                   document.documentElement.classList.contains('dark') || 
                   document.body.classList.contains('dark') ||
                   (chartSettings.canvasBgColor && chartSettings.canvasBgColor !== 'transparent' && chartSettings.canvasBgColor !== '#ffffff');

    if (isPitchBlack) {
      return { isDark: true, bgColor: '#0a0a0a' };
    }
    if (isDark) {
      const computedBg = getComputedStyle(document.documentElement).getPropertyValue('--bg-surface').trim();
      return { isDark: true, bgColor: computedBg || '#1f2937' };
    }
    // Light Theme (Clean White)
    return { isDark: false, bgColor: '#ffffff' };
  };

  // Helper to render background FoxTrade emblem and watermark onto export canvas
  const drawExportWatermark = (ctx, centerX, centerY, isDark = false) => {
    if (chartSettings.showWatermark === false) return;
    const foxLogo = foxEmblemRef.current || document.querySelector('img[alt="FoxTrade Emblem"]');
    ctx.save();
    ctx.globalAlpha = isDark ? 0.12 : 0.08;
    ctx.fillStyle = isDark ? '#ffffff' : '#111827';
    ctx.font = '900 32px Inter, -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const text = 'FOXTRADE';
    const logoSize = 46;
    const gap = 16;

    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = '6px';
    }

    const textWidth = ctx.measureText(text).width;
    const totalWidth = (foxLogo ? logoSize + gap : 0) + textWidth;
    let currX = centerX - totalWidth / 2;

    if (foxLogo && foxLogo.complete && foxLogo.naturalWidth > 0) {
      ctx.save();
      if (!isDark) {
        ctx.filter = 'invert(1) brightness(0.15)';
      }
      ctx.drawImage(foxLogo, currX, centerY - logoSize / 2, logoSize, logoSize);
      ctx.restore();
      currX += logoSize + gap;
    }

    if ('letterSpacing' in ctx) {
      ctx.fillText(text, currX, centerY);
    } else {
      const charSpacing = 6;
      for (let i = 0; i < text.length; i++) {
        ctx.fillText(text[i], currX, centerY);
        currX += ctx.measureText(text[i]).width + charSpacing;
      }
    }
    ctx.restore();
  };

  const handleDownloadPng = () => {
    if (!chartRef.current) return;
    try {
      const sourceCanvas = chartRef.current.takeScreenshot();
      if (!sourceCanvas || !selectedSymbol) return;

      const theme = getExportTheme();
      const symbolTrades = (trades || []).filter(t => (t.name || t.symbol || '').toUpperCase().trim() === selectedSymbol.toUpperCase().trim());
      const trade = symbolTrades[symbolTrades.length - 1] || {
        symbol: selectedSymbol,
        tradeNo: 1,
        date: new Date().toLocaleDateString('en-IN').replace(/\//g, '-'),
        setup: 'Setup',
        pnl: 0
      };

      const logoImg = cachedLogoRef.current;
      const headerHeight = 60;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = sourceCanvas.width;
      exportCanvas.height = sourceCanvas.height + headerHeight;
      const ctx = exportCanvas.getContext('2d');

      // 1. Fill solid background based on active theme
      ctx.fillStyle = theme.bgColor;
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

      // 2. Draw FoxTrade background logo & text watermark behind candles
      drawExportWatermark(ctx, exportCanvas.width / 2, headerHeight + sourceCanvas.height / 2, theme.isDark);

      // 3. Draw chart below the header (on top of watermark)
      ctx.drawImage(sourceCanvas, 0, headerHeight);

      // 4. Render Header with Logo & Trade Details
      const padX = 20;
      const logoSize = 34;
      const logoY = (headerHeight - logoSize) / 2;

      // Draw Logo or Fallback Avatar
      if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(padX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(logoImg, padX, logoY, logoSize, logoSize);
        ctx.restore();

        ctx.strokeStyle = theme.isDark ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(padX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const initials = (selectedSymbol || 'ST').slice(0, 2).toUpperCase();
        ctx.save();
        ctx.beginPath();
        ctx.arc(padX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = theme.isDark ? '#312e81' : '#eef2ff';
        ctx.fill();
        ctx.strokeStyle = theme.isDark ? '#4338ca' : '#c7d2fe';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = theme.isDark ? '#a5b4fc' : '#4f46e5';
        ctx.font = 'bold 14px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, padX + logoSize / 2, logoY + logoSize / 2 + 1);
        ctx.restore();
      }

      // Title: Symbol + Trade #
      const textX = padX + logoSize + 12;
      ctx.textAlign = 'left';
      ctx.font = 'bold 15px Inter, -apple-system, sans-serif';
      ctx.fillStyle = theme.isDark ? '#f8fafc' : '#0f172a';
      ctx.fillText(`${selectedSymbol} · Trade #${trade.tradeNo || 1}`, textX, 26);

      // Subtitle: Setup + Date + Interval
      ctx.font = '500 11px Inter, -apple-system, sans-serif';
      ctx.fillStyle = theme.isDark ? '#94a3b8' : '#64748b';
      const setupText = trade.setup ? `${trade.setup} · ` : '';
      const dateText = trade.date ? `${trade.date} · ` : '';
      const intervalText = (chartInterval || '1d').toUpperCase();
      ctx.fillText(`${setupText}${dateText}${intervalText} Chart`, textX, 45);

      // Right Side: P&L + Brand
      const pnlVal = Number(trade.pnl || 0);
      const isWinner = pnlVal > 0;
      const isLoss = pnlVal < 0;

      ctx.textAlign = 'right';
      if (trade.pnl !== undefined && trade.pnl !== null) {
        ctx.font = 'bold 14px Inter, -apple-system, sans-serif';
        ctx.fillStyle = isWinner ? '#059669' : (isLoss ? '#dc2626' : (theme.isDark ? '#94a3b8' : '#64748b'));
        ctx.fillText(`${pnlVal >= 0 ? '+' : ''}₹${Math.abs(pnlVal).toLocaleString('en-IN')}`, exportCanvas.width - padX, 26);
      }

      ctx.font = 'bold 10.5px Inter, -apple-system, sans-serif';
      ctx.fillStyle = theme.isDark ? '#64748b' : '#94a3b8';
      ctx.fillText('FOXTRADE JOURNAL', exportCanvas.width - padX, 45);
      ctx.textAlign = 'left';

      // Header bottom divider line
      ctx.strokeStyle = theme.isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX, headerHeight);
      ctx.lineTo(exportCanvas.width - padX, headerHeight);
      ctx.stroke();

      // 5. Export clean, opaque PNG synchronously
      const filename = `foxtrade-${selectedSymbol}-Trade${trade.tradeNo || 1}-${new Date().toISOString().slice(0, 10)}.png`;
      const dataUrl = exportCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => document.body.removeChild(link), 100);
    } catch (err) {
      console.error('Failed to export PNG', err);
    }
  };

  const handleDownloadPdf = async () => {
    if (!chartRef.current || !selectedSymbol || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const symbolTrades = (trades || []).filter(t => (t.name || t.symbol || '').toUpperCase().trim() === selectedSymbol.toUpperCase().trim());
      const trade = symbolTrades[symbolTrades.length - 1] || {
        symbol: selectedSymbol,
        tradeNo: 1,
        date: new Date().toLocaleDateString('en-IN').replace(/\//g, '-'),
        setup: 'Trade Setup',
        status: 'Closed',
        pnl: 0,
        entry: 0,
        qty: 0,
        sl: 0
      };

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 28;

      // Background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // 1. Setup & Trade Outcome Header
      const setupName = (trade.setup || 'TRADE').toUpperCase();
      const isWinner = (trade.pnl || 0) > 0;
      const isLoss = (trade.pnl || 0) < 0;
      const outcomeText = isWinner ? 'WINNING TRADE' : (isLoss ? 'LOSING TRADE' : 'TRADE REVIEW');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(isWinner ? 4 : (isLoss ? 190 : 71), isWinner ? 120 : (isLoss ? 18 : 85), isWinner ? 87 : (isLoss ? 60 : 105));
      doc.text(`${setupName} SETUP   •   ${outcomeText}`, margin, 24);

      // Separator line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.75);
      doc.line(margin, 30, pageWidth - margin, 30);

      // Stock Name & Trade #
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text(`${selectedSymbol} · Trade #${trade.tradeNo || 1}`, margin, 48);

      // Date & Setup subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`${trade.date || ''} · ${trade.setup || ''}`, margin, 60);

      // Holding & Stock Move
      const stockMove = trade.stockMove !== undefined ? Number(trade.stockMove).toFixed(2) : (trade.exitPrice && trade.entry ? (((trade.exitPrice - trade.entry) / trade.entry) * 100).toFixed(2) : '0.00');
      const holdingDays = trade.holdingDays || trade.hold || '1';
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Stock Move ${Number(stockMove) >= 0 ? '+' : ''}${stockMove}%   ·   Holding ${holdingDays}d`, margin, 72);

      // Top Right: Profit / Loss block
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('PROFIT / LOSS', pageWidth - margin, 42, { align: 'right' });

      doc.setFontSize(14);
      const pnlVal = Number(trade.pnl || 0);
      doc.setTextColor(pnlVal >= 0 ? 4 : 190, pnlVal >= 0 ? 120 : 18, pnlVal >= 0 ? 87 : 60);
      const pnlFormatted = `${pnlVal >= 0 ? '+' : ''} Rs ${Math.abs(pnlVal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      doc.text(pnlFormatted, pageWidth - margin, 58, { align: 'right' });

      // 2. Execution Table (BUY on left, SELL on right)
      const tableTop = 80;
      const colWidth = (pageWidth - margin * 2 - 16) / 2;

      // BUY Box Container
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, tableTop, colWidth, 48, 3, 3, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, tableTop, colWidth, 48, 3, 3, 'S');

      // BUY Badge
      doc.setFillColor(5, 150, 105);
      doc.roundedRect(margin + 6, tableTop + 6, 28, 14, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text('BUY', margin + 20, tableTop + 16, { align: 'center' });

      // BUY Table Headers
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const buyColX = [margin + 44, margin + 110, margin + 155, margin + 215, margin + 275, margin + 335];
      doc.text('Date', buyColX[0], tableTop + 16);
      doc.text('Qty', buyColX[1], tableTop + 16);
      doc.text('Price', buyColX[2], tableTop + 16);
      doc.text('Size', buyColX[3], tableTop + 16);
      doc.text('Move %', buyColX[4], tableTop + 16);
      doc.text('Hold', buyColX[5], tableTop + 16);

      // BUY Row Values
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(trade.date || '-', buyColX[0], tableTop + 30);
      doc.text(String(trade.qty || '-'), buyColX[1], tableTop + 30);
      doc.text(`Rs.${Number(trade.entry || 0).toLocaleString('en-IN')}`, buyColX[2], tableTop + 30);
      const positionSize = Number(trade.entry || 0) * Number(trade.qty || 0);
      doc.text(`Rs.${positionSize.toLocaleString('en-IN')}`, buyColX[3], tableTop + 30);
      doc.text(`${Number(stockMove) >= 0 ? '+' : ''}${stockMove}%`, buyColX[4], tableTop + 30);
      doc.text(`${holdingDays}d`, buyColX[5], tableTop + 30);

      // BUY Sub-bar (Allocation & SL)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const allocation = trade.allocation || trade.allocationPercent || '5.0';
      const slText = trade.sl ? `Rs.${Number(trade.sl).toLocaleString('en-IN')}` : '-';
      doc.text(`Allocation: ${allocation}%   ·   SL: ${slText}`, margin + 44, tableTop + 42);

      // SELL Box Container
      const sellLeft = margin + colWidth + 16;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(sellLeft, tableTop, colWidth, 48, 3, 3, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(sellLeft, tableTop, colWidth, 48, 3, 3, 'S');

      // SELL Badge
      doc.setFillColor(225, 29, 72);
      doc.roundedRect(sellLeft + 6, tableTop + 6, 28, 14, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text('SELL', sellLeft + 20, tableTop + 16, { align: 'center' });

      // SELL Table Headers
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const sellColX = [sellLeft + 44, sellLeft + 125, sellLeft + 185, sellLeft + 260];
      doc.text('Date', sellColX[0], tableTop + 16);
      doc.text('Qty', sellColX[1], tableTop + 16);
      doc.text('Price', sellColX[2], tableTop + 16);
      doc.text('P/L', sellColX[3], tableTop + 16);

      // SELL Row Values
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(trade.exitDate || trade.e1Date || trade.date || '-', sellColX[0], tableTop + 30);
      doc.text(String(trade.exitQty || trade.e1Qty || trade.qty || '-'), sellColX[1], tableTop + 30);
      const exitPrice = trade.exitPrice || trade.e1Price || trade.cmp || trade.entry || 0;
      doc.text(`Rs.${Number(exitPrice).toLocaleString('en-IN')}`, sellColX[2], tableTop + 30);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(pnlVal >= 0 ? 4 : 190, pnlVal >= 0 ? 120 : 18, pnlVal >= 0 ? 87 : 60);
      doc.text(`${pnlVal >= 0 ? '+' : ''}Rs.${Math.abs(pnlVal).toLocaleString('en-IN')}`, sellColX[3], tableTop + 30);

      // SELL Sub-bar (PF Impact)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const pfImpact = trade.pfImpact || (positionSize > 0 ? ((pnlVal / 500000) * 100).toFixed(2) : '0.15');
      doc.text(`PF Impact: +${pfImpact}%   ·   Exit: 100.0%   ·   Overall PF Impact: +${pfImpact}%`, sellColX[0], tableTop + 42);

      // 3. Chart Snapshot (Aspect-Ratio Preserved)
      const maxChartY = tableTop + 54;
      const maxChartWidth = pageWidth - margin * 2;
      const maxChartHeight = pageHeight - maxChartY - 24;

      const sourceCanvas = chartRef.current.takeScreenshot();
      const pdfChartCanvas = document.createElement('canvas');
      pdfChartCanvas.width = sourceCanvas.width;
      pdfChartCanvas.height = sourceCanvas.height;
      const pCtx = pdfChartCanvas.getContext('2d');
      pCtx.fillStyle = '#ffffff';
      pCtx.fillRect(0, 0, pdfChartCanvas.width, pdfChartCanvas.height);
      // Draw FoxTrade background watermark behind candles
      drawExportWatermark(pCtx, pdfChartCanvas.width / 2, pdfChartCanvas.height / 2, false);
      pCtx.drawImage(sourceCanvas, 0, 0);
      const chartImgData = pdfChartCanvas.toDataURL('image/png');

      // Maintain exact source aspect ratio to prevent any stretching or distortion
      const aspect = sourceCanvas.width / sourceCanvas.height;
      let renderWidth = maxChartWidth;
      let renderHeight = renderWidth / aspect;

      if (renderHeight > maxChartHeight) {
        renderHeight = maxChartHeight;
        renderWidth = renderHeight * aspect;
      }

      const renderX = margin + (maxChartWidth - renderWidth) / 2;
      doc.addImage(chartImgData, 'PNG', renderX, maxChartY, renderWidth, renderHeight, undefined, 'FAST');

      // 4. Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Single Image PDF', margin, pageHeight - 8);
      doc.text('Page 1 of 1', pageWidth - margin, pageHeight - 8, { align: 'right' });

      doc.save(`foxtrade-stock-chart-${selectedSymbol}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      alert('Failed to generate chart PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Close export dropdown on outside click
  useEffect(() => {
    if (!isQuickDockOpen) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest?.('[data-download-menu]')) {
        setIsQuickDockOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isQuickDockOpen]);

  // Coordinate helpers for drawings
  const getTimeFromX = (x) => {
    if (!chartRef.current || visibleCandles.length === 0) return null;
    const timeScale = chartRef.current.timeScale();
    if (typeof timeScale.coordinateToLogical === 'function') {
      const logical = timeScale.coordinateToLogical(x);
      if (logical !== null) {
        const idx = Math.max(0, Math.min(Math.round(logical), visibleCandles.length - 1));
        return visibleCandles[idx]?.time || null;
      }
    }
    if (typeof timeScale.coordinateToTime === 'function') {
      const t = timeScale.coordinateToTime(x);
      if (t) {
        if (typeof t === 'string') return t;
        if (typeof t === 'object') return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;
      }
    }
    return null;
  };

  const getPriceFromY = (y) => {
    if (!mainSeriesRef.current) return null;
    return mainSeriesRef.current.coordinateToPrice(y);
  };

  const renderedDrawings = useMemo(() => {
    if (!chartRef.current || !mainSeriesRef.current) return [];
    const timeScale = chartRef.current.timeScale();
    const series = mainSeriesRef.current;
    const width = chartContainerRef.current?.clientWidth || 900;

    return drawings.map(d => {
      if (d.type === 'trendline') {
        const x1 = timeScale.timeToCoordinate(d.time1);
        const y1 = series.priceToCoordinate(d.price1);
        const x2 = timeScale.timeToCoordinate(d.time2);
        const y2 = series.priceToCoordinate(d.price2);
        return { ...d, x1, y1, x2, y2, visible: x1 !== null && y1 !== null && x2 !== null && y2 !== null };
      }
      if (d.type === 'horizontal') {
        const y = series.priceToCoordinate(d.price);
        return { ...d, y, chartWidth: width, visible: y !== null };
      }
      if (d.type === 'measure') {
        const x1 = timeScale.timeToCoordinate(d.time1);
        const y1 = series.priceToCoordinate(d.price1);
        const x2 = timeScale.timeToCoordinate(d.time2);
        const y2 = series.priceToCoordinate(d.price2);
        return { ...d, x1, y1, x2, y2, visible: x1 !== null && y1 !== null && x2 !== null && y2 !== null };
      }
      return d;
    });
  }, [drawings, drawingRenderVersion, selectedSymbol, visibleCandles]);

  const activeStockTrades = useMemo(() => {
    if (!selectedSymbol) return [];
    return trades.filter(t => (t.name || t.symbol || '').toUpperCase().trim() === selectedSymbol.toUpperCase().trim());
  }, [trades, selectedSymbol]);

  return (
    <div style={chartOnly ? { width: '100%', position: 'relative' } : { padding: '0 24px 80px 24px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {!chartOnly && (
        <>
          {/* ── 1. Top Stat Metrics Banner ──────────────── */}
          <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '24px',
        padding: '16px 0 24px 0',
        alignItems: 'center'
      }}>
        {/* Metric 1: Total Trades */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.05em', color: 'var(--text-muted, #71717a)', textTransform: 'uppercase' }}>
            TOTAL TRADES
          </div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary, #111827)', marginTop: '2px' }}>
            {metrics.totalTrades}
          </div>
          <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted, #a1a1aa)', marginTop: '1px' }}>
            ACROSS {metrics.uniqueCount} SYMBOLS
          </div>
        </div>

        {/* Metric 2: Win Rate */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.05em', color: 'var(--text-muted, #71717a)', textTransform: 'uppercase' }}>
            WIN RATE
          </div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary, #111827)', marginTop: '2px' }}>
            {metrics.winRate}%
          </div>
          <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted, #a1a1aa)', marginTop: '1px' }}>
            {metrics.winCount} W / {metrics.lossCount} L
          </div>
        </div>

        {/* Metric 3: Total P&L */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.05em', color: 'var(--text-muted, #71717a)', textTransform: 'uppercase' }}>
            TOTAL P&L
          </div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: metrics.totalPnl >= 0 ? '#059669' : '#dc2626', marginTop: '2px' }}>
            {metrics.totalPnl >= 0 ? `+₹${metrics.totalPnl.toLocaleString('en-IN')}` : `-₹${Math.abs(metrics.totalPnl).toLocaleString('en-IN')}`}
          </div>
          <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted, #a1a1aa)', marginTop: '1px' }}>
            AVG: {metrics.avgPnl >= 0 ? `+₹${metrics.avgPnl.toLocaleString('en-IN')}` : `-₹${Math.abs(metrics.avgPnl).toLocaleString('en-IN')}`}
          </div>
        </div>

        {/* Metric 4: Active Stocks */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.05em', color: 'var(--text-muted, #71717a)', textTransform: 'uppercase' }}>
            ACTIVE STOCKS
          </div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary, #111827)', marginTop: '2px' }}>
            {metrics.uniqueCount}
          </div>
          <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted, #a1a1aa)', marginTop: '1px' }}>
            UNIQUE SYMBOLS
          </div>
        </div>
      </div>

      {/* ── 2. Top Winners & Losers Section ─────────── */}
      {trades.length > 0 && (
      <div style={{ marginBottom: '32px' }}>
        
        {/* Section Header with Segmented Switchers & Filter Dropdown */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary, #111827)', margin: 0 }}>
            {viewTab === 'winners' ? 'Top Winners' : 'Top Losers'}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Trades vs Stocks Segmented Pill */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.03)',
              borderRadius: '6px',
              padding: '2px'
            }}>
              <button
                onClick={() => setSourceMode('trades')}
                style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: sourceMode === 'trades' ? 'var(--bg-surface, #ffffff)' : 'transparent',
                  color: sourceMode === 'trades' ? 'var(--text-primary, #111827)' : 'var(--text-muted, #71717a)',
                  cursor: 'pointer',
                  boxShadow: sourceMode === 'trades' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none'
                }}
              >
                Trades
              </button>
              <button
                onClick={() => setSourceMode('stocks')}
                style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: sourceMode === 'stocks' ? 'var(--bg-surface, #ffffff)' : 'transparent',
                  color: sourceMode === 'stocks' ? 'var(--text-primary, #111827)' : 'var(--text-muted, #71717a)',
                  cursor: 'pointer',
                  boxShadow: sourceMode === 'stocks' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none'
                }}
              >
                Stocks
              </button>
            </div>

            {/* Winners vs Losers Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => setViewTab('winners')}
                style={{
                  fontSize: '11px',
                  fontWeight: viewTab === 'winners' ? 600 : 500,
                  paddingBottom: '2px',
                  border: 'none',
                  background: 'none',
                  borderBottom: viewTab === 'winners' ? '2px solid #10b981' : '2px solid transparent',
                  color: viewTab === 'winners' ? '#059669' : 'var(--text-muted, #71717a)',
                  cursor: 'pointer'
                }}
              >
                Winners
              </button>
              <button
                onClick={() => setViewTab('losers')}
                style={{
                  fontSize: '11px',
                  fontWeight: viewTab === 'losers' ? 600 : 500,
                  paddingBottom: '2px',
                  border: 'none',
                  background: 'none',
                  borderBottom: viewTab === 'losers' ? '2px solid #ef4444' : '2px solid transparent',
                  color: viewTab === 'losers' ? '#dc2626' : 'var(--text-muted, #71717a)',
                  cursor: 'pointer'
                }}
              >
                Losers
              </button>
            </div>

            {/* Filter Icon Dropdown (≥ 2%, 3%, 5%, 10%, 20% gain) */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted, #71717a)',
                  cursor: 'pointer'
                }}
              >
                <SlidersHorizontal size={13} />
              </button>

              {isFilterDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '34px',
                  right: 0,
                  width: '180px',
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                  border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                  borderRadius: '10px',
                  boxShadow: '0 8px 24px -4px rgba(0,0,0,0.08)',
                  padding: '6px',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}>
                  {[
                    { label: 'All Moves', val: 0 },
                    { label: '≥ 2% Gain', val: 2 },
                    { label: '≥ 3% Gain', val: 3 },
                    { label: '≥ 5% Gain', val: 5 },
                    { label: '≥ 10% Gain', val: 10 },
                    { label: '≥ 20% Gain', val: 20 },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => { setMinGainFilter(opt.val); setIsFilterDropdownOpen(false); }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        textAlign: 'left',
                        backgroundColor: minGainFilter === opt.val ? 'rgba(59,130,246,0.08)' : 'transparent',
                        color: minGainFilter === opt.val ? '#2563eb' : 'var(--text-primary, #374151)',
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Container identical to Nexus:
            - Default collapsed height: 152px (~2 rows) with bottom gradient fade
            - On hover or focus-within: expands max-h to 500px, overflow-y-auto becomes active with thin scrollbar
            - Holds unlimited trades (even 1000+ trades) smoothly
        */}
        <div
          className="stock-charts-grid-wrapper group/grid relative outline-none"
          tabIndex={0}
        >
          <div
            className="stock-charts-scroll-container overflow-hidden thin-scrollbar pr-2 snap-y"
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '12px',
              paddingBottom: '8px'
            }}>
              {(viewTab === 'winners' ? topWinners : topLosers).map((item, idx) => {
                const sym = sourceMode === 'trades' ? (item.name || item.symbol) : item.symbol;
                const isSelected = selectedSymbol && selectedSymbol.toUpperCase() === sym.toUpperCase();
                const pnl = item.pnl || 0;
                const isGain = pnl >= 0;

                return (
                  <div
                    key={item.id || idx}
                    onClick={() => handleSelectSymbol(sym)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      border: isSelected ? '1.5px solid #3b82f6' : '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      height: '62px',
                      boxShadow: 'var(--shadow-card, 0 1px 2px rgba(0,0,0,0.02))',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Left Accent Stripe */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '3px',
                      backgroundColor: isGain ? '#10b981' : '#ef4444'
                    }} />

                    {/* Left Side: Trade #, Logo, Symbol & Setup */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, paddingLeft: '4px' }}>
                      {sourceMode === 'trades' && (
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(0,0,0,0.03)',
                          fontSize: '10px',
                          fontWeight: 600,
                          color: 'var(--text-muted, #71717a)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {item.tradeNo || (idx + 1)}
                        </div>
                      )}

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <SymbolLogo symbol={sym} size={16} />
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #111827)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sym}
                          </span>
                        </div>

                        <div style={{ fontSize: '10px', color: 'var(--text-muted, #71717a)', fontWeight: 400, marginTop: '2px' }}>
                          {sourceMode === 'trades' ? (item.setup || 'General') : `${item.count} Trades · ${item.winCount}W`}
                        </div>
                      </div>
                    </div>

                    {/* Right Side: P&L Amount & Date */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        color: isGain ? '#059669' : '#dc2626'
                      }}>
                        {isGain ? `+₹${pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `-₹${Math.abs(pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                      </div>

                      <div style={{ fontSize: '10px', color: 'var(--text-muted, #a1a1aa)', fontWeight: 400, marginTop: '2px' }}>
                        {item.date || 'Active'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Gradient Overlay (Matches Nexus fade out when collapsed) */}
          <div className="stock-charts-fade-overlay" />
        </div>
      </div>
      )}
        </>
      )}

      {/* ── 3. Interactive Candlestick Chart Controls Bar (Merged directly into background) ───── */}
      <div style={isChartFullscreen ? {
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'var(--bg-surface, #ffffff)',
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 18px',
        overflow: 'hidden'
      } : {
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: 0,
        boxShadow: 'none',
        position: 'relative'
      }}>

        {/* Market Analysis Mode Banner (Shown when analyzing a symbol not in portfolio trades) */}
        {isMarketMode && selectedSymbol && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.18)',
            borderRadius: '12px',
            marginBottom: '12px',
            fontSize: '12px',
            color: '#1e40af',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
              <span>
                <strong>Market Analysis Mode:</strong> Viewing live <strong>{selectedSymbol}</strong> price chart. No trade executions logged for this symbol in current portfolio.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {onOpenQuickLog && (
                <button
                  type="button"
                  onClick={() => onOpenQuickLog(selectedSymbol)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  + Log Trade for {selectedSymbol}
                </button>
              )}
              {trades.length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSymbol(null);
                    setIsMarketExplorerMode(false);
                    if (onSelectSymbol) onSelectSymbol(null);
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted, #71717a)',
                    border: '1px solid var(--border-color, #e4e4e7)',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  ← Clear Chart
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Top Control Bar: Symbol Logo & Name, Range, Interval, Custom Date, Replay, Candles, Classic */}
        <div style={{
          padding: '8px 0 16px 0',
          borderBottom: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: 'transparent'
        }}>
          {/* Left Side: Interactive Stock Shuffle Dropdown (No text input field) */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsStockDropdownOpen(!isStockDropdownOpen)}
              title="Click to switch between all journal stocks"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 10px',
                borderRadius: '10px',
                border: isStockDropdownOpen ? '1px solid #3b82f6' : '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                backgroundColor: isStockDropdownOpen ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card, #ffffff)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!isStockDropdownOpen) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
              }}
              onMouseLeave={(e) => {
                if (!isStockDropdownOpen) e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
              }}
            >
              {selectedSymbol ? (
                <SymbolLogo symbol={selectedSymbol} size={22} />
              ) : (
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb'
                }}>
                  <BarChart2 size={13} strokeWidth={2.5} />
                </div>
              )}
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #111827)', letterSpacing: '0.02em' }}>
                {selectedSymbol || 'Select Stock'}
              </span>
              <ChevronDown size={14} color="var(--text-muted, #71717a)" />
            </button>

            {/* Dropdown Popover with all stocks present in user trade entries */}
            {isStockDropdownOpen && (
              <>
                <div
                  onClick={() => setIsStockDropdownOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'transparent' }}
                />
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '42px',
                    left: 0,
                    width: '280px',
                    backgroundColor: 'var(--bg-surface, #ffffff)',
                    border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                    borderRadius: '14px',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
                    zIndex: 100,
                    overflow: 'hidden',
                    animation: 'fadeInPop 0.15s ease'
                  }}
                >
                  <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)', backgroundColor: 'var(--bg-surface, #ffffff)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted, #71717a)', letterSpacing: '0.5px', marginBottom: '6px' }}>
                      JOURNAL STOCKS ({uniqueTradeStocks.length})
                    </div>
                    {/* Search filter within journal stocks */}
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={stockSearchQuery}
                        onChange={(e) => setStockSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && stockSearchQuery.trim()) {
                            e.preventDefault();
                            handleSelectSymbol(stockSearchQuery.trim().toUpperCase());
                            setIsStockDropdownOpen(false);
                            setStockSearchQuery('');
                          }
                        }}
                        placeholder="Search stock or type symbol..."
                        autoFocus
                        style={{
                          width: '100%',
                          padding: '5px 8px 5px 24px',
                          borderRadius: '6px',
                          border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                          fontSize: '11px',
                          outline: 'none',
                          color: 'var(--text-primary, #111827)',
                          backgroundColor: 'var(--bg-card, #ffffff)'
                        }}
                      />
                      <Search size={12} color="#9ca3af" style={{ position: 'absolute', left: '7px', top: '7px' }} />
                    </div>
                  </div>

                  {/* Scrollable list of stocks from trade data entry */}
                  <div style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    padding: '4px 0',
                    scrollbarWidth: 'thin'
                  }}>
                    {filteredTradeStocks.length === 0 ? (
                      <div style={{ padding: '14px 12px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {stockSearchQuery.trim() ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <span>No journal trades for "{stockSearchQuery.trim().toUpperCase()}"</span>
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectSymbol(stockSearchQuery.trim().toUpperCase());
                                setIsStockDropdownOpen(false);
                                setStockSearchQuery('');
                              }}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                backgroundColor: '#2563eb',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Chart Market Symbol
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ marginBottom: '10px', color: 'var(--text-muted, #71717a)' }}>No journal trades in portfolio.</div>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted, #a1a1aa)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px', textAlign: 'left' }}>
                              Explore Market Stocks
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK'].map(popSym => (
                                <div
                                  key={popSym}
                                  onClick={() => {
                                    handleSelectSymbol(popSym);
                                    setIsStockDropdownOpen(false);
                                    setStockSearchQuery('');
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    backgroundColor: 'transparent',
                                    transition: 'background 0.12s ease'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <SymbolLogo symbol={popSym} size={18} />
                                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary, #111827)' }}>{popSym}</span>
                                  </div>
                                  <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 500 }}>Chart →</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      filteredTradeStocks.map((s, i) => {
                        const isSelected = selectedSymbol && selectedSymbol.toUpperCase() === s.symbol.toUpperCase();
                        const isGain = s.pnl >= 0;
                        return (
                          <div
                            key={s.symbol || i}
                            onClick={() => {
                              handleSelectSymbol(s.symbol);
                              setIsStockDropdownOpen(false);
                              setStockSearchQuery('');
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 14px',
                              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                              cursor: 'pointer',
                              transition: 'background 0.12s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <SymbolLogo symbol={s.symbol} size={22} />
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
                                  {s.symbol}
                                </div>
                                <div style={{ fontSize: '9.5px', color: 'var(--text-muted, #71717a)' }}>
                                  {s.tradesCount} {s.tradesCount === 1 ? 'trade' : 'trades'}
                                </div>
                              </div>
                            </div>

                            <div style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              fontFamily: 'monospace',
                              color: isGain ? '#059669' : '#dc2626'
                            }}>
                              {isGain ? '+' : ''}₹{Math.abs(s.pnl).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Controls: Range, Interval, Custom Date, Replay, Chart Type, Theme */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            
            {/* Quick Action Toolbar: Automated SL/Entry/2R and Download Dropdown */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
              borderRadius: '9999px',
              padding: '2px 4px',
              gap: '2px'
            }}>
              {/* 1. Automated SL / Entry / 2R Lines Toggle */}
              <button
                onClick={() => setShowTargetLines(prev => !prev)}
                title={showTargetLines ? "Hide SL / Entry / 2R Lines" : "Show SL / Entry / 2R Lines"}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '24px',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: showTargetLines ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
                  color: showTargetLines ? 'var(--text-primary, #111827)' : 'var(--text-muted, #71717a)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!showTargetLines) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={(e) => {
                  if (!showTargetLines) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Target size={15} />
              </button>

              {/* 2. Download Icon with Vertical Dropdown (PNG & PDF) */}
              <div 
                data-download-menu="true"
                style={{ display: 'flex', alignItems: 'center', position: 'relative' }}
              >
                <button
                  onClick={() => setIsQuickDockOpen(prev => !prev)}
                  title={isQuickDockOpen ? "Close Export Options" : "Export Chart (PNG / PDF)"}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '24px',
                    borderRadius: '9999px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: isQuickDockOpen ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
                    color: isQuickDockOpen ? 'var(--text-primary, #111827)' : 'var(--text-muted, #71717a)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isQuickDockOpen) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isQuickDockOpen) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Download size={14} />
                </button>

                {/* Vertical Dropdown Menu */}
                {isQuickDockOpen && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: '0',
                      zIndex: 60,
                      minWidth: '150px',
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      borderRadius: '8px',
                      border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                      padding: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        handleDownloadPng();
                        setIsQuickDockOpen(false);
                      }}
                      title="Download Chart Screenshot (PNG)"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary, #111827)',
                        fontSize: '11.5px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.12s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <ImageIcon size={13} color="#2563eb" />
                      <span>Download PNG</span>
                    </button>

                    <button
                      onClick={() => {
                        handleDownloadPdf();
                        setIsQuickDockOpen(false);
                      }}
                      disabled={isGeneratingPdf}
                      title="Generate Single-Trade Review PDF"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: isGeneratingPdf ? '#9ca3af' : 'var(--text-primary, #111827)',
                        fontSize: '11.5px',
                        fontWeight: 500,
                        cursor: isGeneratingPdf ? 'wait' : 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.12s ease'
                      }}
                      onMouseEnter={(e) => { if (!isGeneratingPdf) e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)'; }}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <FileText size={13} color="#dc2626" />
                      <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* TradingView-Style Interactive Drawing Tools Toolbar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
              borderRadius: '9999px',
              padding: '2px 4px',
              gap: '2px'
            }}>
              {/* Cursor / Select Mode */}
              <button
                onClick={() => { setActiveDrawingTool('none'); setDraftDrawing(null); }}
                title="Normal Cursor (Pan & Zoom Chart)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeDrawingTool === 'none' ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
                  color: '#111827',
                  fontSize: '11px',
                  fontWeight: activeDrawingTool === 'none' ? 600 : 500,
                  transition: 'all 0.15s ease'
                }}
              >
                <MousePointer size={12} />
              </button>

              {/* Trendline Tool */}
              <button
                onClick={() => { setActiveDrawingTool(prev => prev === 'trendline' ? 'none' : 'trendline'); setDraftDrawing(null); }}
                title="Trendline (Click 2 points on chart)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeDrawingTool === 'trendline' ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
                  color: '#111827',
                  fontSize: '11px',
                  fontWeight: activeDrawingTool === 'trendline' ? 600 : 500,
                  transition: 'all 0.15s ease'
                }}
              >
                <TrendingUp size={12} />
                <span>Trendline</span>
              </button>

              {/* Horizontal Line / Level Tool */}
              <button
                onClick={() => { setActiveDrawingTool(prev => prev === 'horizontal' ? 'none' : 'horizontal'); setDraftDrawing(null); }}
                title="Horizontal Level (Click at any price level)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeDrawingTool === 'horizontal' ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
                  color: '#111827',
                  fontSize: '11px',
                  fontWeight: activeDrawingTool === 'horizontal' ? 600 : 500,
                  transition: 'all 0.15s ease'
                }}
              >
                <Minus size={12} />
                <span>Horizontal</span>
              </button>

              {/* Measure / Ruler Tool */}
              <button
                onClick={() => { setActiveDrawingTool(prev => prev === 'measure' ? 'none' : 'measure'); setDraftDrawing(null); }}
                title="Measure Range / Ruler (Click 2 points)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeDrawingTool === 'measure' ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
                  color: '#111827',
                  fontSize: '11px',
                  fontWeight: activeDrawingTool === 'measure' ? 600 : 500,
                  transition: 'all 0.15s ease'
                }}
              >
                <Ruler size={12} />
                <span>Measure</span>
              </button>

              {/* Clear All Drawings (when drawings exist) */}
              {drawings.length > 0 && (
                <button
                  onClick={() => saveDrawings([])}
                  title={`Clear all ${drawings.length} drawing(s)`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '9999px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    color: '#ef4444',
                    fontSize: '11px',
                    fontWeight: 600,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Trash2 size={11} />
                  <span>{drawings.length}</span>
                </button>
              )}
            </div>

            {/* Hide / Show Volume Button (Left of 5Y Range Selector) */}
            <button
              onClick={() => setShowVolume(prev => !prev)}
              title={showVolume ? 'Hide Volume' : 'Show Volume'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '9999px',
                border: !showVolume ? '1px solid var(--text-primary, #111827)' : '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                backgroundColor: !showVolume ? 'rgba(0, 0, 0, 0.06)' : 'var(--bg-card, #ffffff)',
                color: 'var(--text-primary, #111827)',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              {showVolume ? <EyeOff size={12} /> : <Eye size={12} />}
              <span>{showVolume ? 'Hide Volume' : 'Show Volume'}</span>
            </button>

            {/* Candle Type Switcher Group (Normal Candles, Bar Candles, Hollow Candles) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
              borderRadius: '9999px',
              padding: '2px 4px',
              gap: '2px'
            }}>
              {/* 1. Candles (Normal) */}
              <button
                onClick={() => handleSetChartType('candles')}
                title="Candles (Normal)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '24px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: chartType === 'candles' ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
                  color: chartType === 'candles' ? 'var(--text-primary, #111827)' : 'var(--text-muted, #71717a)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (chartType !== 'candles') e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={(e) => {
                  if (chartType !== 'candles') e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="6" y1="2" x2="6" y2="18" />
                  <rect x="4" y="5" width="4" height="9" fill="currentColor" rx="0.5" />
                  <line x1="14" y1="4" x2="14" y2="16" />
                  <rect x="12" y="7" width="4" height="6" fill="currentColor" rx="0.5" />
                </svg>
              </button>

              {/* 2. Bar Candles (OHLC Bars) */}
              <button
                onClick={() => handleSetChartType('bars')}
                title="Bar Candles (OHLC)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '24px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: chartType === 'bars' ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
                  color: chartType === 'bars' ? 'var(--text-primary, #111827)' : 'var(--text-muted, #71717a)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (chartType !== 'bars') e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={(e) => {
                  if (chartType !== 'bars') e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="7" y1="3" x2="7" y2="17" />
                  <line x1="4" y1="6" x2="7" y2="6" />
                  <line x1="7" y1="14" x2="10" y2="14" />
                  <line x1="14" y1="3" x2="14" y2="17" />
                  <line x1="11" y1="13" x2="14" y2="13" />
                  <line x1="14" y1="7" x2="17" y2="7" />
                </svg>
              </button>

              {/* 3. Hollow Candles */}
              <button
                onClick={() => handleSetChartType('hollow_candles')}
                title="Hollow Candles"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '24px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: chartType === 'hollow_candles' ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
                  color: chartType === 'hollow_candles' ? 'var(--text-primary, #111827)' : 'var(--text-muted, #71717a)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (chartType !== 'hollow_candles') e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={(e) => {
                  if (chartType !== 'hollow_candles') e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="6" y1="2" x2="6" y2="18" />
                  <rect x="4" y="5" width="4" height="9" fill="none" rx="0.5" />
                  <line x1="14" y1="4" x2="14" y2="16" />
                  <rect x="12" y="7" width="4" height="6" fill="none" rx="0.5" />
                </svg>
              </button>
            </div>

            {/* Range Pill - Modernized */}
            <ModernDropdown
              value={range}
              options={[
                { value: '1mo', label: '1M' },
                { value: '3mo', label: '3M' },
                { value: '6mo', label: '6M' },
                { value: '1y', label: '1Y' },
                { value: '2y', label: '2Y' },
                { value: '5y', label: '5Y' },
                { value: 'custom', label: 'Custom' }
              ]}
              variant="pill"
              onChange={(val) => {
                setRange(val);
                if (val === 'custom') setShowCustomDateModal(true);
              }}
            />

            {/* Interval Pill - Modernized */}
            <ModernDropdown
              value={chartInterval}
              options={[
                { value: '5m', label: '5m' },
                { value: '15m', label: '15m' },
                { value: '1h', label: '1h' },
                { value: '1d', label: '1d' },
                { value: '1w', label: '1w' },
                { value: '1m', label: '1m' }
              ]}
              variant="pill"
              onChange={(val) => handleIntervalChange(val)}
            />

            {/* Custom Date Range Pill & Calendar Popover */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowCustomDateModal(!showCustomDateModal)}
                title="Custom Date Range Filter"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  border: range === 'custom' ? '1px solid #3b82f6' : '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  backgroundColor: range === 'custom' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card, #ffffff)',
                  color: range === 'custom' ? '#2563eb' : 'var(--text-primary, #374151)',
                  fontSize: '11px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                <Calendar size={12} color={range === 'custom' ? '#2563eb' : 'var(--text-muted, #71717a)'} />
                <span>Custom</span>
              </button>

              {showCustomDateModal && (
                <div style={{
                  position: 'absolute',
                  top: '34px',
                  right: 0,
                  width: '260px',
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                  border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                  borderRadius: '14px',
                  boxShadow: '0 8px 24px -4px rgba(0,0,0,0.08)',
                  padding: '14px',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
                      Custom Date Range
                    </span>
                    <button
                      onClick={() => setShowCustomDateModal(false)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted, #9ca3af)' }}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted, #71717a)', textTransform: 'uppercase' }}>
                        From Date
                      </label>
                      <input
                        type="date"
                        value={customFromDate}
                        onChange={(e) => setCustomFromDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                          fontSize: '12px',
                          marginTop: '2px',
                          color: 'var(--text-primary, #111827)',
                          backgroundColor: 'var(--bg-card, #ffffff)'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted, #71717a)', textTransform: 'uppercase' }}>
                        To Date
                      </label>
                      <input
                        type="date"
                        value={customToDate}
                        onChange={(e) => setCustomToDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                          fontSize: '12px',
                          marginTop: '2px',
                          color: 'var(--text-primary, #111827)',
                          backgroundColor: 'var(--bg-card, #ffffff)'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <button
                      onClick={() => {
                        setRange('custom');
                        setShowCustomDateModal(false);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Apply Range
                    </button>
                    <button
                      onClick={() => {
                        setRange('1y');
                        setShowCustomDateModal(false);
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-muted, #71717a)',
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* TradingView-Style Bar Replay Button (Between Custom Date and MA) */}
            <button
              onClick={() => {
                if (candles.length === 0 && !replayModeActive) return;
                if (replayModeActive) {
                  setReplayModeActive(false);
                  setIsReplaying(false);
                  setReplayIndex(candles.length);
                  setSelectedReplayTrade(null);
                  setIsCutModeActive(false);
                  setIsPracticeMode(false);
                } else {
                  setReplayModeActive(true);
                  setIsReplaying(false);
                  const cutIdx = Math.max(1, candles.length - 35);
                  setReplayIndex(cutIdx);
                  initialCutIndexRef.current = cutIdx;
                }
              }}
              title="Bar Replay Simulator (TradingView-style)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '9999px',
                border: replayModeActive ? '1px solid #111827' : '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                backgroundColor: replayModeActive ? 'rgba(0, 0, 0, 0.08)' : 'var(--bg-card, #ffffff)',
                color: 'var(--text-primary, #111827)',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <RotateCcw size={12} style={{ transform: replayModeActive ? 'rotate(-45deg)' : 'none', transition: 'transform 0.2s ease' }} />
              <span>Replay</span>
            </button>

            {/* Indicators / Moving Averages Dropdown Pill */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setShowMaModal(!showMaModal);
                  setShowColorModal(false);
                  setShowCustomDateModal(false);
                }}
                title="Toggle Technical Indicators & Moving Averages"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  border: (m1.enabled || m2.enabled || m3.enabled) ? '1px solid #3b82f6' : '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                  backgroundColor: (m1.enabled || m2.enabled || m3.enabled) ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card, #ffffff)',
                  color: (m1.enabled || m2.enabled || m3.enabled) ? '#2563eb' : 'var(--text-primary, #374151)',
                  fontSize: '11px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                <Layers size={12} />
                <span>MA ({(m1.enabled ? 1 : 0) + (m2.enabled ? 1 : 0) + (m3.enabled ? 1 : 0)})</span>
                <ChevronDown size={11} />
              </button>

              {showMaModal && (
                <>
                  <div
                    onClick={() => setShowMaModal(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'transparent' }}
                  />
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: '34px',
                      right: 0,
                      width: '280px',
                      backgroundColor: 'var(--bg-surface, #ffffff)',
                      border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                      borderRadius: '14px',
                      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
                      padding: '14px',
                      zIndex: 100,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      animation: 'fadeInPop 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)', paddingBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
                        Moving Averages
                      </span>
                      <button
                        onClick={() => setShowMaModal(false)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted, #9ca3af)' }}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* M1 Setting */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={m1.enabled}
                          onChange={(e) => setM1(prev => ({ ...prev, enabled: e.target.checked }))}
                          style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: m1.color }}
                        />
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: m1.color }} />
                        <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-primary, #111827)' }}>
                          M1 ({m1.period} {m1.type})
                        </span>
                      </label>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <select
                          value={m1.period}
                          onChange={(e) => setM1(prev => ({ ...prev, period: parseInt(e.target.value) }))}
                          style={{ padding: '3px 6px', borderRadius: '6px', border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', fontSize: '11px', fontWeight: 500, backgroundColor: 'var(--bg-card, #fff)' }}
                        >
                          {[5, 10, 15, 20, 50, 100, 200].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select
                          value={m1.type}
                          onChange={(e) => setM1(prev => ({ ...prev, type: e.target.value }))}
                          style={{ padding: '3px 6px', borderRadius: '6px', border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', fontSize: '11px', fontWeight: 500, backgroundColor: 'var(--bg-card, #fff)' }}
                        >
                          <option value="SMA">SMA</option>
                          <option value="EMA">EMA</option>
                        </select>
                      </div>
                    </div>

                    {/* M2 Setting */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={m2.enabled}
                          onChange={(e) => setM2(prev => ({ ...prev, enabled: e.target.checked }))}
                          style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: m2.color }}
                        />
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: m2.color }} />
                        <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-primary, #111827)' }}>
                          M2 ({m2.period} {m2.type})
                        </span>
                      </label>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <select
                          value={m2.period}
                          onChange={(e) => setM2(prev => ({ ...prev, period: parseInt(e.target.value) }))}
                          style={{ padding: '3px 6px', borderRadius: '6px', border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', fontSize: '11px', fontWeight: 500, backgroundColor: 'var(--bg-card, #fff)' }}
                        >
                          {[5, 10, 15, 20, 50, 100, 200].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select
                          value={m2.type}
                          onChange={(e) => setM2(prev => ({ ...prev, type: e.target.value }))}
                          style={{ padding: '3px 6px', borderRadius: '6px', border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', fontSize: '11px', fontWeight: 500, backgroundColor: 'var(--bg-card, #fff)' }}
                        >
                          <option value="SMA">SMA</option>
                          <option value="EMA">EMA</option>
                        </select>
                      </div>
                    </div>

                    {/* M3 Setting */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={m3.enabled}
                          onChange={(e) => setM3(prev => ({ ...prev, enabled: e.target.checked }))}
                          style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: m3.color }}
                        />
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: m3.color }} />
                        <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-primary, #111827)' }}>
                          M3 ({m3.period} {m3.type})
                        </span>
                      </label>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <select
                          value={m3.period}
                          onChange={(e) => setM3(prev => ({ ...prev, period: parseInt(e.target.value) }))}
                          style={{ padding: '3px 6px', borderRadius: '6px', border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', fontSize: '11px', fontWeight: 500, backgroundColor: 'var(--bg-card, #fff)' }}
                        >
                          {[5, 10, 15, 20, 50, 100, 200].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select
                          value={m3.type}
                          onChange={(e) => setM3(prev => ({ ...prev, type: e.target.value }))}
                          style={{ padding: '3px 6px', borderRadius: '6px', border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', fontSize: '11px', fontWeight: 500, backgroundColor: 'var(--bg-card, #fff)' }}
                        >
                          <option value="SMA">SMA</option>
                          <option value="EMA">EMA</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Chart Settings Vector Icon Button */}
            <button
              onClick={() => setShowChartSettingsModal(true)}
              title="Chart Settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                border: showChartSettingsModal ? '1px solid #3b82f6' : '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                backgroundColor: showChartSettingsModal ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card, #ffffff)',
                color: showChartSettingsModal ? '#2563eb' : 'var(--text-primary, #374151)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!showChartSettingsModal) {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                  e.currentTarget.style.color = 'var(--text-primary, #111827)';
                }
              }}
              onMouseLeave={(e) => {
                if (!showChartSettingsModal) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
                  e.currentTarget.style.color = 'var(--text-primary, #374151)';
                }
              }}
            >
              <Settings size={15} />
            </button>

          </div>
        </div>

        {/* ── Main Chart Canvas with Subtle Watermark ── */}
        <div style={isChartFullscreen ? {
          position: 'relative',
          flex: 1,
          width: '100%',
          minHeight: 0,
          backgroundColor: 'transparent'
        } : {
          position: 'relative',
          height: '560px',
          width: '100%',
          backgroundColor: 'transparent'
        }}>
          {/* Floating Fullscreen Expand / Collapse Toggle (Positioned below stock logo on chart canvas) */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              zIndex: 35
            }}
            data-html2canvas-ignore="true"
          >
            <button
              onClick={() => setIsChartFullscreen(prev => !prev)}
              title={isChartFullscreen ? "Exit Fullscreen (Esc)" : "Full Screen Chart"}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                padding: 0,
                borderRadius: '8px',
                border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                backgroundColor: 'var(--bg-card, rgba(255, 255, 255, 0.92))',
                backdropFilter: 'blur(4px)',
                color: 'var(--text-primary, #111827)',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f3f4f6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card, rgba(255, 255, 255, 0.92))';
              }}
            >
              {isChartFullscreen ? <Shrink size={15} /> : <Expand size={15} />}
            </button>
          </div>

          {loading && selectedSymbol && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.7)',
              zIndex: 10,
              fontSize: '13px',
              fontWeight: 700,
              color: '#3b82f6',
              gap: '8px'
            }}>
              <RefreshCw size={16} className="animate-spin" />
              <span>Fetching candlestick data for {selectedSymbol}...</span>
            </div>
          )}

          {!loading && Boolean(selectedSymbol) && visibleCandles.length === 0 && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'color-mix(in srgb, var(--bg-card, #ffffff) 90%, transparent)',
              zIndex: 10,
              gap: '12px'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary, #6b7280)' }}>
                Real-market candlestick data unavailable for <strong style={{ color: 'var(--text-primary, #111827)' }}>{selectedSymbol}</strong>
              </div>
              <button
                onClick={() => handleSelectSymbol(selectedSymbol)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 16px',
                  borderRadius: '999px',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  background: 'var(--bg-card, #ffffff)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text-primary, #374151)'
                }}
              >
                <RefreshCw size={13} />
                Retry
              </button>
            </div>
          )}

          {/* Central Subtle Watermark */}
          {chartSettings.showWatermark !== false && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              opacity: 0.08,
              fontSize: '36px',
              fontWeight: 900,
              letterSpacing: '0.25em',
              color: 'var(--text-primary, #111827)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              userSelect: 'none'
            }}>
              <FoxTradeLogo size={52} variant="transparent" style={{ filter: 'var(--chart-watermark-filter, none)' }} />
              <span>FOXTRADE</span>
            </div>
          )}

          {/* Floating TradingView-Style Bar Replay Player Bar */}
          {replayModeActive && (
            <ReplayPlayerBar
              isReplaying={isReplaying}
              onTogglePlay={() => {
                if (replayIndex >= candles.length) {
                  setReplayIndex(Math.max(1, candles.length - 35));
                  setIsReplaying(true);
                } else {
                  setIsReplaying(prev => !prev);
                }
              }}
              replayIndex={Math.min(replayIndex, candles.length)}
              totalCandles={candles.length}
              currentCandleTime={visibleCandles[visibleCandles.length - 1]?.time}
              onStepBack={() => {
                setIsReplaying(false);
                setReplayIndex(prev => Math.max(1, prev - 1));
              }}
              onStepForward={() => {
                setIsReplaying(false);
                setReplayIndex(prev => Math.min(candles.length, prev + 1));
              }}
              onSeek={(newIndex) => {
                setIsReplaying(false);
                setReplayIndex(newIndex);
              }}
              replaySpeed={replaySpeed}
              onChangeSpeed={(speed) => setReplaySpeed(speed)}
              onRestart={handleRestartReplay}
              onExitReplay={() => {
                setReplayModeActive(false);
                setIsReplaying(false);
                setReplayIndex(candles.length);
                setSelectedReplayTrade(null);
                setIsCutModeActive(false);
                setIsPracticeMode(false);
              }}
              onJumpToDate={handleJumpToDate}
              isCutModeActive={isCutModeActive}
              onToggleCutMode={() => setIsCutModeActive(prev => !prev)}
              autoScroll={autoScroll}
              onToggleAutoScroll={() => setAutoScroll(prev => !prev)}
              isPracticeMode={isPracticeMode}
              onTogglePracticeMode={() => setIsPracticeMode(prev => !prev)}
              rawCandles={candles}
            />
          )}

          {/* Practice Paper Trading Panel */}
          {replayModeActive && isPracticeMode && (
            <ReplayPracticePanel
              currentCandle={visibleCandles[visibleCandles.length - 1]}
              practicePosition={practicePosition}
              onOpenPosition={handleOpenPracticePosition}
              onClosePosition={handleClosePracticePosition}
              onResetPosition={handleResetPracticePosition}
              onDismiss={() => setIsPracticeMode(false)}
            />
          )}

          {/* Trade Journal Details Slide-over Panel */}
          {selectedReplayTrade && (
            <ReplayTradeDetailPanel
              trade={selectedReplayTrade}
              onClose={() => setSelectedReplayTrade(null)}
            />
          )}

          <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />

          {/* TradingView-Style Interactive SVG Drawing Layer */}
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: activeDrawingTool !== 'none' ? 'auto' : 'none',
              cursor: activeDrawingTool !== 'none' ? 'crosshair' : 'default',
              overflow: 'hidden',
              zIndex: 22
            }}
            onClick={(e) => {
              if (activeDrawingTool === 'none') return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;

              if (activeDrawingTool === 'horizontal') {
                const price = getPriceFromY(y);
                if (price !== null) {
                  saveDrawings([...drawings, {
                    id: 'horz-' + Date.now(),
                    type: 'horizontal',
                    price: Math.round(price * 100) / 100,
                    color: '#f59e0b',
                    width: 1.5
                  }]);
                  setActiveDrawingTool('none');
                }
                return;
              }

              if (activeDrawingTool === 'trendline') {
                if (!draftDrawing) {
                  const time = getTimeFromX(x);
                  const price = getPriceFromY(y);
                  if (time && price !== null) {
                    setDraftDrawing({
                      type: 'trendline',
                      step: 1,
                      time1: time,
                      price1: price,
                      x1: x,
                      y1: y,
                      currentX: x,
                      currentY: y
                    });
                  }
                } else if (draftDrawing.step === 1) {
                  const time2 = getTimeFromX(x);
                  const price2 = getPriceFromY(y);
                  if (time2 && price2 !== null) {
                    saveDrawings([...drawings, {
                      id: 'trend-' + Date.now(),
                      type: 'trendline',
                      time1: draftDrawing.time1,
                      price1: draftDrawing.price1,
                      time2,
                      price2,
                      color: '#111827',
                      width: 2
                    }]);
                    setDraftDrawing(null);
                    setActiveDrawingTool('none');
                  }
                }
                return;
              }

              if (activeDrawingTool === 'measure') {
                if (!draftDrawing) {
                  const time = getTimeFromX(x);
                  const price = getPriceFromY(y);
                  if (time && price !== null) {
                    setDraftDrawing({
                      type: 'measure',
                      step: 1,
                      time1: time,
                      price1: price,
                      x1: x,
                      y1: y,
                      currentX: x,
                      currentY: y
                    });
                  }
                } else if (draftDrawing.step === 1) {
                  const time2 = getTimeFromX(x);
                  const price2 = getPriceFromY(y);
                  if (time2 && price2 !== null) {
                    saveDrawings([...drawings, {
                      id: 'meas-' + Date.now(),
                      type: 'measure',
                      time1: draftDrawing.time1,
                      price1: draftDrawing.price1,
                      time2,
                      price2
                    }]);
                    setDraftDrawing(null);
                    setActiveDrawingTool('none');
                  }
                }
              }
            }}
            onMouseMove={(e) => {
              if (activeDrawingTool === 'none') return;
              const rect = e.currentTarget.getBoundingClientRect();
              const currentX = e.clientX - rect.left;
              const currentY = e.clientY - rect.top;

              if (draftDrawing && draftDrawing.step === 1) {
                setDraftDrawing(prev => ({
                  ...prev,
                  currentX,
                  currentY
                }));
              }
            }}
          >
            {/* Render Saved Drawings */}
            {renderedDrawings.map((d) => {
              if (!d.visible) return null;

              if (d.type === 'trendline') {
                const midX = (d.x1 + d.x2) / 2;
                const midY = (d.y1 + d.y2) / 2;
                const isHovered = hoveredDrawingId === d.id;

                return (
                  <g
                    key={d.id}
                    onMouseEnter={() => setHoveredDrawingId(d.id)}
                    onMouseLeave={() => setHoveredDrawingId(null)}
                    style={{ pointerEvents: 'auto' }}
                  >
                    {/* Transparent wide hit area for easy hover/click */}
                    <line
                      x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}
                      stroke="transparent"
                      strokeWidth={14}
                      style={{ cursor: 'pointer' }}
                    />
                    {/* Visual Line */}
                    <line
                      x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}
                      stroke={d.color || '#111827'}
                      strokeWidth={d.width || 2}
                      strokeLinecap="round"
                    />
                    {/* Anchor points */}
                    <circle cx={d.x1} cy={d.y1} r={4} fill="#ffffff" stroke={d.color || '#111827'} strokeWidth={2} />
                    <circle cx={d.x2} cy={d.y2} r={4} fill="#ffffff" stroke={d.color || '#111827'} strokeWidth={2} />

                    {/* Delete handle when hovered */}
                    {isHovered && (
                      <g
                        transform={`translate(${midX}, ${midY - 14})`}
                        onClick={(e) => { e.stopPropagation(); deleteDrawing(d.id); }}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle r={8} fill="#ef4444" />
                        <text textAnchor="middle" dy="3.5" fill="#ffffff" fontSize="11" fontWeight="bold">×</text>
                      </g>
                    )}
                  </g>
                );
              }

              if (d.type === 'horizontal') {
                const isHovered = hoveredDrawingId === d.id;
                return (
                  <g
                    key={d.id}
                    onMouseEnter={() => setHoveredDrawingId(d.id)}
                    onMouseLeave={() => setHoveredDrawingId(null)}
                    style={{ pointerEvents: 'auto' }}
                  >
                    {/* Transparent hit area */}
                    <line
                      x1={0} y1={d.y} x2={d.chartWidth || 900} y2={d.y}
                      stroke="transparent"
                      strokeWidth={12}
                      style={{ cursor: 'pointer' }}
                    />
                    {/* Dashed line */}
                    <line
                      x1={0} y1={d.y} x2={d.chartWidth || 900} y2={d.y}
                      stroke={d.color || '#f59e0b'}
                      strokeWidth={d.lineWidth || 1.5}
                      strokeDasharray="4 4"
                    />
                    {/* Price tag pill */}
                    <rect
                      x={(d.chartWidth || 900) - 68} y={d.y - 10}
                      width={62} height={20}
                      rx={4}
                      fill={d.color || '#f59e0b'}
                    />
                    <text
                      x={(d.chartWidth || 900) - 37} y={d.y + 4}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="10.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      ₹{d.price.toFixed(1)}
                    </text>

                    {/* Delete handle */}
                    {isHovered && (
                      <g
                        transform={`translate(35, ${d.y - 12})`}
                        onClick={(e) => { e.stopPropagation(); deleteDrawing(d.id); }}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle r={8} fill="#ef4444" />
                        <text textAnchor="middle" dy="3.5" fill="#ffffff" fontSize="11" fontWeight="bold">×</text>
                      </g>
                    )}
                  </g>
                );
              }

              if (d.type === 'measure') {
                const isHovered = hoveredDrawingId === d.id;
                const minX = Math.min(d.x1, d.x2);
                const minY = Math.min(d.y1, d.y2);
                const rectW = Math.abs(d.x2 - d.x1);
                const rectH = Math.abs(d.y2 - d.y1);
                const priceDiff = d.price2 - d.price1;
                const pctDiff = d.price1 !== 0 ? (priceDiff / d.price1) * 100 : 0;
                const isGain = priceDiff >= 0;

                return (
                  <g
                    key={d.id}
                    onMouseEnter={() => setHoveredDrawingId(d.id)}
                    onMouseLeave={() => setHoveredDrawingId(null)}
                    style={{ pointerEvents: 'auto' }}
                  >
                    {/* Shaded Box */}
                    <rect
                      x={minX} y={minY} width={rectW} height={rectH}
                      fill={isGain ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)'}
                      stroke={isGain ? '#10b981' : '#ef4444'}
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                    {/* Measurement Badge in Center */}
                    <rect
                      x={minX + rectW / 2 - 58} y={minY + rectH / 2 - 12}
                      width={116} height={24}
                      rx={6}
                      fill="rgba(17, 24, 39, 0.88)"
                      backdropFilter="blur(4px)"
                    />
                    <text
                      x={minX + rectW / 2} y={minY + rectH / 2 + 4}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="bold"
                    >
                      {isGain ? '+' : ''}₹{priceDiff.toFixed(2)} ({isGain ? '+' : ''}{pctDiff.toFixed(2)}%)
                    </text>

                    {/* Delete handle */}
                    {isHovered && (
                      <g
                        transform={`translate(${minX + rectW / 2 + 58}, ${minY + rectH / 2 - 12})`}
                        onClick={(e) => { e.stopPropagation(); deleteDrawing(d.id); }}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle r={8} fill="#ef4444" />
                        <text textAnchor="middle" dy="3.5" fill="#ffffff" fontSize="11" fontWeight="bold">×</text>
                      </g>
                    )}
                  </g>
                );
              }

              return null;
            })}

            {/* Render In-Progress Draft Drawing */}
            {draftDrawing && draftDrawing.type === 'trendline' && (
              <g>
                <line
                  x1={draftDrawing.x1} y1={draftDrawing.y1}
                  x2={draftDrawing.currentX} y2={draftDrawing.currentY}
                  stroke="#111827"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
                <circle cx={draftDrawing.x1} cy={draftDrawing.y1} r={4} fill="#111827" />
                <circle cx={draftDrawing.currentX} cy={draftDrawing.currentY} r={4} fill="#111827" />
              </g>
            )}

            {draftDrawing && draftDrawing.type === 'measure' && (
              <g>
                <rect
                  x={Math.min(draftDrawing.x1, draftDrawing.currentX)}
                  y={Math.min(draftDrawing.y1, draftDrawing.currentY)}
                  width={Math.abs(draftDrawing.currentX - draftDrawing.x1)}
                  height={Math.abs(draftDrawing.currentY - draftDrawing.y1)}
                  fill="rgba(0, 0, 0, 0.08)"
                  stroke="#111827"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              </g>
            )}
          </svg>

          {/* Interactive Custom Sleek Arrow Markers Overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
            zIndex: 25
          }}>
            {markerElements.map((m) => {
              const isBelow = m.position === 'below';
              return (
                <div
                  key={m.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (m.trades && m.trades.length > 0) {
                      setSelectedReplayTrade(m.trades[0]);
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    const dateObj = new Date(m.time);
                    const formattedDate = !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : m.time;
                    const vol = m.candle.volume || Math.round(m.candle.close * 15000);
                    const volFormatted = vol >= 10000000 ? `${(vol / 10000000).toFixed(2)}Cr` : `${(vol / 100000).toFixed(2)}L`;
                    setHoverTooltipData({
                      time: m.time,
                      dateFormatted: formattedDate,
                      volumeFormatted: volFormatted,
                      candle: m.candle,
                      trades: m.trades,
                      x: m.x,
                      y: m.y
                    });
                  }}
                  onMouseLeave={() => setHoverTooltipData(null)}
                  style={{
                    position: 'absolute',
                    left: `${m.x}px`,
                    top: isBelow ? `${m.y + 3}px` : `${m.y - 3}px`,
                    transform: isBelow ? 'translateX(-50%)' : 'translate(-50%, -100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    transition: 'transform 0.12s ease',
                    userSelect: 'none'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = isBelow ? 'translateX(-50%) scale(1.15)' : 'translate(-50%, -100%) scale(1.15)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = isBelow ? 'translateX(-50%) scale(1)' : 'translate(-50%, -100%) scale(1)';
                  }}
                >
                  {/* For ABOVE (Exits): Badge first, then sleek downward arrow */}
                  {!isBelow && (
                    <>
                      <span style={{
                        marginBottom: '3px',
                        fontSize: '9.5px',
                        fontWeight: 800,
                        color: '#dc2626',
                        backgroundColor: 'var(--bg-card, #ffffff)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        borderRadius: '4px',
                        padding: '1px 5px',
                        lineHeight: 1.1,
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        letterSpacing: '0.02em'
                      }}>
                        {m.label}
                      </span>
                      <svg width="12" height="14" viewBox="0 0 12 14" style={{ overflow: 'visible', display: 'block' }}>
                        <path 
                          d="M6 14 L1 8 H4.5 V0 H7.5 V8 H11 Z" 
                          fill="#dc2626" 
                          stroke="#ffffff" 
                          strokeWidth="0.8" 
                        />
                      </svg>
                    </>
                  )}

                  {/* For BELOW (Entry / Pyramids): Sleek upward arrow first, then badge */}
                  {isBelow && (
                    <>
                      <svg width="12" height="14" viewBox="0 0 12 14" style={{ overflow: 'visible', display: 'block' }}>
                        <path 
                          d="M6 0 L1 6 H4.5 V14 H7.5 V6 H11 Z" 
                          fill="#16a34a" 
                          stroke="#ffffff" 
                          strokeWidth="0.8" 
                        />
                      </svg>
                      <span style={{
                        marginTop: '3px',
                        fontSize: '9.5px',
                        fontWeight: 800,
                        color: '#16a34a',
                        backgroundColor: 'var(--bg-card, #ffffff)',
                        border: '1px solid rgba(22, 163, 74, 0.35)',
                        borderRadius: '4px',
                        padding: '1px 5px',
                        lineHeight: 1.1,
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        letterSpacing: '0.02em'
                      }}>
                        {m.label}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Floating Interactive Hover Tooltip (Aesthetic, Clean & Minimalist Single Card) */}
          {hoverTooltipData && (
            <div style={{
              position: 'absolute',
              left: `${Math.min(Math.max(12, hoverTooltipData.x - 115), (chartContainerRef.current?.clientWidth || 900) - 245)}px`,
              top: `${Math.max(10, Math.min(hoverTooltipData.y > 230 ? hoverTooltipData.y - 200 : hoverTooltipData.y + 20, (chartContainerRef.current?.clientHeight || 560) - 210))}px`,
              zIndex: 50,
              width: '230px',
              backgroundColor: 'var(--bg-surface, #ffffff)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '12px',
              padding: '12px 14px',
              boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04)',
              pointerEvents: 'none',
              animation: 'fadeIn 0.12s ease-out',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              {hoverTooltipData.trades && hoverTooltipData.trades.length > 0 ? (
                hoverTooltipData.trades.map((t, idx) => {
                  const rawE = parseTradeDate(t.date || t.entryDate || t.entryLegs?.[0]?.date);
                  const isEntry = findNearestCandle(rawE, visibleCandles) === hoverTooltipData.time;
                  const isWin = (t.pnl || 0) >= 0;

                  // Find which pyramid legs match this candle
                  const matchingPyramids = [];
                  for (let i = 1; i <= 4; i++) {
                    const pDate = t[`p${i}Date`] || t.entryLegs?.[i]?.date;
                    const pPrice = Number(t[`p${i}Price`] || t.entryLegs?.[i]?.price || 0);
                    const pQty = Number(t[`p${i}Qty`] || t.entryLegs?.[i]?.qty || 0);
                    const pSl = Number(t[`p${i}Sl`] || t.entryLegs?.[i]?.sl || 0);
                    if (pDate && (pPrice > 0 || pQty > 0)) {
                      const cTime = findNearestCandle(parseTradeDate(pDate), visibleCandles);
                      if (cTime === hoverTooltipData.time) {
                        matchingPyramids.push({ label: `P${i}`, price: pPrice, qty: pQty, sl: pSl });
                      }
                    }
                  }

                  // Find which exit legs match this candle
                  const matchingExits = [];
                  for (let j = 1; j <= 4; j++) {
                    const eDate = t[`e${j}Date`] || t.exitLegs?.[j - 1]?.date;
                    const ePrice = Number(t[`e${j}Price`] || t.exitLegs?.[j - 1]?.price || 0);
                    const eQty = Number(t[`e${j}Qty`] || t.exitLegs?.[j - 1]?.qty || 0);
                    if (eDate && (ePrice > 0 || eQty > 0)) {
                      const cTime = findNearestCandle(parseTradeDate(eDate), visibleCandles);
                      if (cTime === hoverTooltipData.time) {
                        matchingExits.push({ label: `E${j}`, price: ePrice, qty: eQty });
                      }
                    }
                  }

                  const rawExitDate = parseTradeDate(t.exitDate || t.e1Date);
                  const isFallbackExit = matchingExits.length === 0 && findNearestCandle(rawExitDate, visibleCandles) === hoverTooltipData.time;

                  const isPyramid = matchingPyramids.length > 0;
                  const isExit = matchingExits.length > 0 || isFallbackExit;

                  let badgeText = 'ENTRY';
                  let badgeBg = 'rgba(16, 185, 129, 0.1)';
                  let badgeColor = '#059669';
                  let badgeBorder = 'rgba(16, 185, 129, 0.25)';

                  if (isPyramid) {
                    badgeText = `PYRAMID (${matchingPyramids[0].label})`;
                    badgeBg = 'rgba(59, 130, 246, 0.1)';
                    badgeColor = '#2563eb';
                    badgeBorder = 'rgba(59, 130, 246, 0.25)';
                  } else if (isExit) {
                    badgeText = matchingExits.length > 0 ? `EXIT (${matchingExits[0].label})` : 'EXIT';
                    badgeBg = 'rgba(239, 68, 68, 0.1)';
                    badgeColor = '#dc2626';
                    badgeBorder = 'rgba(239, 68, 68, 0.25)';
                  }

                  return (
                    <div key={t.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                      {/* Top Header: Badge + Trade Setup */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: badgeColor,
                          backgroundColor: badgeBg,
                          border: `1px solid ${badgeBorder}`,
                          padding: '2px 7px',
                          borderRadius: '5px',
                          letterSpacing: '0.03em'
                        }}>
                          {badgeText}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #71717a)' }}>
                          Trade #{t.tradeNo || (idx + 1)}{t.setup ? ` • ${t.setup}` : ''}
                        </span>
                      </div>

                      {/* Date & Volume Metadata Line */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: 'var(--text-muted, #71717a)'
                      }}>
                        <span>{hoverTooltipData.dateFormatted}</span>
                        <span>Vol {hoverTooltipData.volumeFormatted}</span>
                      </div>

                      <div style={{ height: '1px', backgroundColor: 'var(--border-color, #f3f4f6)', margin: '1px 0' }} />

                      {/* Metric Data 2-Column Grid */}
                      {isEntry && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 12px' }}>
                          <div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', letterSpacing: '0.05em' }}>ENTRY PRICE</div>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary, #111827)', marginTop: '2px' }}>
                              ₹{(t.entry || t.avgEntry || hoverTooltipData.candle.open).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', letterSpacing: '0.05em' }}>QUANTITY</div>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary, #111827)', marginTop: '2px' }}>
                              {t.qty || 10}
                            </div>
                          </div>
                          {t.sl > 0 && (
                            <div>
                              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', letterSpacing: '0.05em' }}>STOP LOSS</div>
                              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#ef4444', marginTop: '2px' }}>
                                ₹{Number(t.sl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', letterSpacing: '0.05em' }}>ALLOCATION</div>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary, #111827)', marginTop: '2px' }}>
                              {t.allocation || `${((((t.avgEntry || 500) * (t.qty || 10)) / 100000) * 100).toFixed(1)}%`}
                            </div>
                          </div>
                        </div>
                      )}

                      {isPyramid && matchingPyramids.map((p, pIdx) => (
                        <div key={pIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 12px' }}>
                          <div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', letterSpacing: '0.05em' }}>PYRAMID PRICE</div>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary, #111827)', marginTop: '2px' }}>
                              ₹{p.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', letterSpacing: '0.05em' }}>ADDED QTY</div>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#2563eb', marginTop: '2px' }}>
                              +{p.qty}
                            </div>
                          </div>
                          {p.sl > 0 && (
                            <div>
                              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', letterSpacing: '0.05em' }}>UPDATED SL</div>
                              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#ef4444', marginTop: '2px' }}>
                                ₹{p.sl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', letterSpacing: '0.05em' }}>TOTAL SHARES</div>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary, #111827)', marginTop: '2px' }}>
                              {(t.qty || 0) + p.qty}
                            </div>
                          </div>
                        </div>
                      ))}

                      {isExit && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 12px' }}>
                          <div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', letterSpacing: '0.05em' }}>EXIT PRICE</div>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary, #111827)', marginTop: '2px' }}>
                              ₹{(matchingExits[0]?.price || t.avgExitPrice || t.avgExit || hoverTooltipData.candle.close).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', letterSpacing: '0.05em' }}>EXITED QTY</div>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#dc2626', marginTop: '2px' }}>
                              {matchingExits[0]?.qty || t.exitedQty || t.qty || 10}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', letterSpacing: '0.05em' }}>TRADE P/L</div>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: isWin ? '#10b981' : '#ef4444', marginTop: '2px' }}>
                              {isWin ? '+' : ''}₹{Number(t.pnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', letterSpacing: '0.05em' }}>OVERALL R:R</div>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: isWin ? '#10b981' : '#ef4444', marginTop: '2px' }}>
                              {t.rewardRisk ? `${t.rewardRisk}R` : isWin ? '+2.50R' : '-1.00R'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : null}
            </div>
          )}

          {/* Floating Reset View Button */}
          <button
            onClick={() => chartRef.current?.timeScale().fitContent()}
            title="Reset chart view to fit all data"
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20,
              backgroundColor: 'var(--bg-surface, rgba(255,255,255,0.9))',
              border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
              borderRadius: '9999px',
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--text-muted, #6b7280)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RotateCcw size={11} />
            <span>Reset View</span>
          </button>
        </div>

      </div>

      {/* Stock Chart Settings Modal (Symbol & Canvas sections) */}
      <StockChartSettingsModal
        isOpen={showChartSettingsModal}
        onClose={() => setShowChartSettingsModal(false)}
        settings={chartSettings}
        onSaveSettings={handleSaveChartSettings}
      />

    </div>
  );
}
