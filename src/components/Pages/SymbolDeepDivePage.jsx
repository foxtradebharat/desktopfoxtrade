import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { 
  X, ChevronLeft, ChevronRight, Search, TrendingUp, TrendingDown, 
  Calendar, FileText, Image as ImageIcon, Upload, ArrowLeft,
  Activity, Layers, Target, Shield, ShieldCheck, CheckSquare, 
  Square, AlertTriangle, CheckCircle2, Award, Clock, DollarSign, 
  Check, RotateCcw, PenLine, Sparkles, AlertCircle, Save, ExternalLink,
  ZoomIn, ZoomOut, Maximize2, Download, Eye
} from 'lucide-react';
import SymbolLogo from '../SymbolLogo';
import UploadChartModal from '../UploadChartModal';
import InteractiveTradeChart from '../charts/InteractiveTradeChart';
import StockChartsPage from './StockChartsPage';
import { getCanonicalSymbol, getCorporateActionDetails } from '../../utils/securityMaster.js';
import { DEFAULT_PLAYBOOKS, LS_PLAYBOOKS_KEY, LS_AUDITS_KEY, getTradePnL } from '../../services/playbookService';
import { calculateCharges, loadBrokerCharges, detectSegment } from '../../utils/brokerChargesService';

export default function SymbolDeepDivePage({ 
  trades = [], 
  symbol: initialSymbol = 'RELIANCE', 
  tradeNo: initialTradeNo = null, 
  tradeId: initialTradeId = null,
  themeMode: propThemeMode = null,
  onClose,
  onUpdateTrade,
  onOpenPlaybook
}) {
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol || 'RELIANCE');
  const [selectedTradeNo, setSelectedTradeNo] = useState(initialTradeNo);
  const [selectedTradeId, setSelectedTradeId] = useState(initialTradeId);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'legs' | 'psychology' | 'notes'
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [chargesMap, setChargesMap] = useState({});
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (initialSymbol) setSelectedSymbol(initialSymbol);
    if (initialTradeNo) setSelectedTradeNo(initialTradeNo);
    if (initialTradeId) setSelectedTradeId(initialTradeId);
  }, [initialSymbol, initialTradeNo, initialTradeId]);

  // Load Broker Charges once
  useEffect(() => {
    loadBrokerCharges().then(map => {
      if (map) setChargesMap(map);
    }).catch(() => {});
  }, []);

  // All trades for currently selected symbol
  const symbolTrades = useMemo(() => {
    if (!trades || !Array.isArray(trades)) return [];
    return trades
      .filter(t => (t.name || t.symbol || '').toUpperCase().trim() === selectedSymbol.toUpperCase().trim())
      .sort((a, b) => (Number(a.tradeNo) || 0) - (Number(b.tradeNo) || 0));
  }, [trades, selectedSymbol]);

  // Active Trade Resolution (Bulletproof fallback)
  const activeTrade = useMemo(() => {
    if (!trades || !Array.isArray(trades) || trades.length === 0) {
      return { 
        id: 'temp_1', 
        tradeNo: selectedTradeNo || 1, 
        name: selectedSymbol, 
        pnl: 0, 
        date: new Date().toISOString().split('T')[0],
        entry: 0,
        avgExitPrice: 0
      };
    }
    if (selectedTradeId) {
      const foundById = trades.find(t => t.id === selectedTradeId);
      if (foundById) return foundById;
    }
    if (selectedTradeNo) {
      const foundByTradeNo = trades.find(t => Number(t.tradeNo) === Number(selectedTradeNo));
      if (foundByTradeNo) return foundByTradeNo;
    }
    if (symbolTrades.length > 0) {
      return symbolTrades[symbolTrades.length - 1];
    }
    const foundBySym = trades.find(t => (t.name || t.symbol || '').toUpperCase().trim() === selectedSymbol.toUpperCase().trim());
    if (foundBySym) return foundBySym;
    return trades[0];
  }, [symbolTrades, selectedTradeId, selectedTradeNo, trades, selectedSymbol]);

  // Synchronize identifiers when active trade changes
  useEffect(() => {
    if (activeTrade) {
      if (activeTrade.name && activeTrade.name.toUpperCase() !== selectedSymbol.toUpperCase()) {
        setSelectedSymbol(activeTrade.name.toUpperCase());
      }
      setSelectedTradeNo(activeTrade.tradeNo);
      setSelectedTradeId(activeTrade.id);
    }
  }, [activeTrade?.id]);

  // Global sorted trades list for Next/Prev carousel navigation
  const allSortedTrades = useMemo(() => {
    if (!trades || !Array.isArray(trades)) return [];
    return [...trades].sort((a, b) => (Number(a.tradeNo) || 0) - (Number(b.tradeNo) || 0));
  }, [trades]);

  const globalIndex = useMemo(() => {
    if (!activeTrade) return -1;
    return allSortedTrades.findIndex(t => t.id === activeTrade.id || Number(t.tradeNo) === Number(activeTrade.tradeNo));
  }, [allSortedTrades, activeTrade]);

  const prevTrade = globalIndex > 0 ? allSortedTrades[globalIndex - 1] : null;
  const nextTrade = globalIndex >= 0 && globalIndex < allSortedTrades.length - 1 ? allSortedTrades[globalIndex + 1] : null;

  const handleNavigateToTrade = (t) => {
    if (!t) return;
    setSelectedSymbol((t.name || t.symbol || '').toUpperCase());
    setSelectedTradeNo(t.tradeNo);
    setSelectedTradeId(t.id);
  };

  // Theme tracking (black and white / dark / light)
  const [themeMode, setThemeMode] = useState(() => {
    if (propThemeMode) return propThemeMode;
    if (typeof document !== 'undefined') {
      const dt = document.documentElement.getAttribute('data-theme');
      if (dt) return dt;
      const stored = localStorage.getItem('tradeontip_theme');
      if (stored) return stored;
    }
    return 'light';
  });

  useEffect(() => {
    if (propThemeMode) {
      setThemeMode(propThemeMode);
    }
    if (typeof document === 'undefined') return;
    const updateTheme = () => {
      const dt = document.documentElement.getAttribute('data-theme') || localStorage.getItem('tradeontip_theme') || propThemeMode || 'light';
      setThemeMode(dt);
    };
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('storage', updateTheme);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', updateTheme);
    };
  }, [propThemeMode]);

  const isDark = themeMode === 'dark' || themeMode === 'pitch-black';

  // Refined Aesthetic Theme tokens for Lightbox viewer (Minimalist Gray/Monochrome)
  const lbTheme = useMemo(() => ({
    overlayBg: isDark ? 'rgba(10, 10, 10, 0.92)' : 'rgba(250, 250, 250, 0.92)',
    barBg: isDark ? 'rgba(18, 18, 18, 0.92)' : 'rgba(255, 255, 255, 0.92)',
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
    text: isDark ? '#f9fafb' : '#111827',
    mutedText: isDark ? '#9ca3af' : '#6b7280',
    cardBg: isDark ? '#141414' : '#ffffff',
    cardBorder: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
    btnBg: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
    btnBorder: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
    btnHoverBg: isDark ? '#262626' : '#f3f4f6',
    btnActiveBg: isDark ? '#333333' : '#e5e7eb',
    btnHoverColor: isDark ? '#ffffff' : '#111827',
    activeTabBg: isDark ? '#2a2a2a' : '#e5e7eb',
    activeTabColor: isDark ? '#ffffff' : '#111827',
    activeTabBorder: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
    inactiveTabBg: 'transparent',
    inactiveTabColor: isDark ? '#9ca3af' : '#6b7280',
    tradeBadgeBg: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
    tradeBadgeColor: isDark ? '#d1d5db' : '#4b5563',
    boxShadow: isDark 
      ? '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.06)' 
      : '0 20px 50px -12px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)',
    chevronBg: isDark ? 'rgba(28, 28, 28, 0.9)' : 'rgba(255, 255, 255, 0.95)',
    chevronHoverBg: isDark ? '#383838' : '#e5e7eb',
    chevronShadow: isDark ? '0 8px 24px rgba(0,0,0,0.6)' : '0 8px 24px -4px rgba(0, 0, 0, 0.1)'
  }), [isDark]);

  // Lightbox Image Viewer State
  const [lightboxImage, setLightboxImage] = useState(null); // { type: 'before' | 'after', url: string, title: string }
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const handleOpenLightbox = (type) => {
    if (!activeTrade) return;
    const url = type === 'before' ? activeTrade.chartBefore : activeTrade.chartAfter;
    if (!url) return;
    setLightboxImage({
      type,
      url,
      title: type === 'before' ? 'Before Entry Chart' : 'After Exit Chart'
    });
    setLightboxZoom(1);
    setLightboxPan({ x: 0, y: 0 });
  };

  const handleCloseLightbox = () => {
    setLightboxImage(null);
    setLightboxZoom(1);
    setLightboxPan({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleSwitchLightbox = (newType) => {
    if (!activeTrade) return;
    const url = newType === 'before' ? activeTrade.chartBefore : activeTrade.chartAfter;
    if (!url) return;
    setLightboxImage({
      type: newType,
      url,
      title: newType === 'before' ? 'Before Entry Chart' : 'After Exit Chart'
    });
    setLightboxZoom(1);
    setLightboxPan({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setLightboxZoom(prev => Math.min(Number((prev + 0.25).toFixed(2)), 3.5));
  };

  const handleZoomOut = () => {
    setLightboxZoom(prev => {
      const next = Math.max(Number((prev - 0.25).toFixed(2)), 0.75);
      if (next <= 1) setLightboxPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setLightboxZoom(1);
    setLightboxPan({ x: 0, y: 0 });
  };

  const handleDownloadImage = () => {
    if (!lightboxImage?.url) return;
    const link = document.createElement('a');
    link.href = lightboxImage.url;
    link.download = `${activeTrade?.name || 'Trade'}_${lightboxImage.type === 'before' ? 'Before_Entry' : 'After_Exit'}_Chart.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!lightboxImage) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseLightbox();
      } else if (e.key === 'ArrowLeft') {
        if (lightboxImage.type === 'after' && activeTrade?.chartBefore) {
          handleSwitchLightbox('before');
        }
      } else if (e.key === 'ArrowRight') {
        if (lightboxImage.type === 'before' && activeTrade?.chartAfter) {
          handleSwitchLightbox('after');
        }
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage, activeTrade]);

  // Pan & Drag handlers
  const handleMouseDown = (e) => {
    if (lightboxZoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - lightboxPan.x,
      y: e.clientY - lightboxPan.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || lightboxZoom <= 1) return;
    e.preventDefault();
    setLightboxPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    if (!lightboxImage) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      setLightboxZoom(prev => Math.min(Number((prev + 0.15).toFixed(2)), 3.5));
    } else {
      setLightboxZoom(prev => {
        const next = Math.max(Number((prev - 0.15).toFixed(2)), 0.75);
        if (next <= 1) setLightboxPan({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Symbols list for search jumper
  const allTradedSymbols = useMemo(() => {
    if (!trades || !Array.isArray(trades)) return [];
    const map = new Map();
    trades.forEach(t => {
      const sym = (t.name || t.symbol || '').trim().toUpperCase();
      if (!sym) return;
      if (!map.has(sym)) {
        map.set(sym, { symbol: sym, tradeCount: 1, latestTradeNo: t.tradeNo, latestTradeId: t.id });
      } else {
        const entry = map.get(sym);
        entry.tradeCount += 1;
        entry.latestTradeNo = t.tradeNo || entry.latestTradeNo;
        entry.latestTradeId = t.id || entry.latestTradeId;
      }
    });
    return Array.from(map.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [trades]);

  const filteredSymbols = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allTradedSymbols;
    const canonicalQ = getCanonicalSymbol(q).toLowerCase();

    return allTradedSymbols.filter(s => {
      const sym = (s.symbol || '').toLowerCase();
      const canonicalSym = getCanonicalSymbol(s.symbol || '').toLowerCase();
      const ca = getCorporateActionDetails(s.symbol);
      const aliasMatch = ca && (
        (ca.legacySymbol && ca.legacySymbol.toLowerCase().includes(q)) ||
        (ca.searchKeywords && ca.searchKeywords.some(kw => kw.includes(q) || q.includes(kw)))
      );
      return sym.includes(q) || (canonicalQ && (sym.includes(canonicalQ) || canonicalSym.includes(canonicalQ))) || Boolean(aliasMatch);
    });
  }, [allTradedSymbols, searchQuery]);

  // Numeric P&L and ROI
  const numPnl = useMemo(() => {
    if (!activeTrade) return 0;
    const val = activeTrade.pnl !== undefined ? activeTrade.pnl : (activeTrade.pl || 0);
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const clean = String(val).replace(/[₹$,]/g, '').trim();
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }, [activeTrade]);

  const isWin = numPnl >= 0;
  const pnlFormatted = Math.abs(numPnl).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const entryPrice = parseFloat(activeTrade?.avgEntry ?? activeTrade?.entry ?? 0) || 0;
  const exitPrice = parseFloat(activeTrade?.avgExitPrice ?? activeTrade?.exit ?? activeTrade?.cmp ?? 0) || 0;
  const slPrice = parseFloat(activeTrade?.sl ?? activeTrade?.p1Sl ?? 0) || 0;
  const targetPrice = parseFloat(activeTrade?.target ?? activeTrade?.takeProfit ?? 0) || 0;
  const isShort = String(activeTrade?.type || activeTrade?.side || '').toLowerCase() === 'sell';

  // Return % / Stock Move %
  const returnPct = useMemo(() => {
    if (activeTrade?.stockMove !== undefined && !isNaN(parseFloat(activeTrade.stockMove))) {
      return parseFloat(activeTrade.stockMove);
    }
    if (entryPrice > 0 && exitPrice > 0) {
      return isShort ? ((entryPrice - exitPrice) / entryPrice * 100) : ((exitPrice - entryPrice) / entryPrice * 100);
    }
    return 0;
  }, [activeTrade, entryPrice, exitPrice, isShort]);

  // Risk & R-Multiple Calculation
  const riskAmountPerShare = useMemo(() => {
    if (entryPrice > 0 && slPrice > 0) {
      return Math.abs(entryPrice - slPrice);
    }
    return entryPrice * 0.015; // default 1.5% assumption if SL unstated
  }, [entryPrice, slPrice]);

  const rMultiple = useMemo(() => {
    if (activeTrade?.rMultiple !== undefined && !isNaN(parseFloat(activeTrade.rMultiple))) {
      return parseFloat(activeTrade.rMultiple);
    }
    if (activeTrade?.rewardRisk !== undefined && !isNaN(parseFloat(activeTrade.rewardRisk))) {
      const rr = parseFloat(activeTrade.rewardRisk);
      return isWin ? rr : -Math.abs(rr || 1);
    }
    if (riskAmountPerShare > 0 && entryPrice > 0 && exitPrice > 0) {
      const move = isShort ? (entryPrice - exitPrice) : (exitPrice - entryPrice);
      return move / riskAmountPerShare;
    }
    return isWin ? 1.5 : -1.0;
  }, [activeTrade, riskAmountPerShare, entryPrice, exitPrice, isShort, isWin]);

  // Institutional Performance Letter Grade (A, B, C, D, F)
  const performanceGrade = useMemo(() => {
    if (rMultiple >= 2.0 || returnPct >= 6.0) {
      return { letter: 'A', desc: 'Superior Payoff (≥2R)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)' };
    }
    if (rMultiple >= 1.0 || returnPct >= 2.0) {
      return { letter: 'B', desc: 'Solid Execution (1R–2R)', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.25)' };
    }
    if (rMultiple >= 0.0 || (numPnl >= 0 && returnPct >= 0)) {
      return { letter: 'C', desc: 'Breakeven / Scratch', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.25)' };
    }
    if (rMultiple >= -0.5 || returnPct >= -2.0) {
      return { letter: 'D', desc: 'Controlled Drawdown', color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.25)' };
    }
    return { letter: 'F', desc: 'Capital Erosion / Loss', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.25)' };
  }, [rMultiple, returnPct, numPnl]);

  // Indian Regulatory & Brokerage Charges
  const tradeCharges = useMemo(() => {
    if (!activeTrade) return { total: 0, brokerage: 0, stt: 0, exchangeFee: 0, gst: 0, sebi: 0, stampDuty: 0 };
    const broker = (activeTrade.broker || 'zerodha').toLowerCase();
    const segment = detectSegment(activeTrade.holdingDays, activeTrade.segment || 'delivery');
    const totalQty = Number(activeTrade.openQty || activeTrade.qty || 1);
    const exitedQty = Number(activeTrade.exitedQty || activeTrade.qty || 1);
    const buyTurnover = entryPrice * totalQty;
    const sellTurnover = exitPrice * exitedQty;

    return calculateCharges(broker, segment, buyTurnover, sellTurnover, exitedQty, chargesMap);
  }, [activeTrade, entryPrice, exitPrice, chargesMap]);

  // ── Playbooks & Checklist Audit State ──────────────────────────────────────
  const [playbooks, setPlaybooks] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_PLAYBOOKS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_PLAYBOOKS;
    } catch {
      return DEFAULT_PLAYBOOKS;
    }
  });

  const [tradeAudits, setTradeAudits] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_AUDITS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const activeAudit = tradeAudits[activeTrade?.id] || null;

  // Selected Playbook Setup
  const matchedPlaybook = useMemo(() => {
    if (!activeTrade) return playbooks[0] || null;
    if (activeAudit?.playbookId) {
      const found = playbooks.find(p => p.id === activeAudit.playbookId);
      if (found) return found;
    }
    const setupName = String(activeTrade.setup || '').toLowerCase().trim();
    if (setupName) {
      const found = playbooks.find(p => p.title.toLowerCase().includes(setupName) || setupName.includes(p.title.toLowerCase()));
      if (found) return found;
    }
    return playbooks[0] || null;
  }, [playbooks, activeTrade, activeAudit]);

  const [selectedPlaybookId, setSelectedPlaybookId] = useState(matchedPlaybook?.id || playbooks[0]?.id || '');

  useEffect(() => {
    if (matchedPlaybook?.id) {
      setSelectedPlaybookId(matchedPlaybook.id);
    }
  }, [matchedPlaybook?.id]);

  const currentPlaybook = playbooks.find(p => p.id === selectedPlaybookId) || matchedPlaybook || playbooks[0];

  // Flattened rules
  const playbookRules = useMemo(() => {
    if (!currentPlaybook?.ruleGroups) return [];
    const list = [];
    currentPlaybook.ruleGroups.forEach(g => {
      (g.rules || []).forEach(r => {
        list.push({ ...r, groupTitle: g.title });
      });
    });
    return list;
  }, [currentPlaybook]);

  const [ruleExecutions, setRuleExecutions] = useState(() => activeAudit?.ruleExecutions || {});

  useEffect(() => {
    if (activeAudit?.ruleExecutions) {
      setRuleExecutions(activeAudit.ruleExecutions);
    } else {
      // Default: rules initialized to true for positive baseline
      const init = {};
      playbookRules.forEach(r => { init[r.id] = { isFollowed: true }; });
      setRuleExecutions(init);
    }
  }, [activeTrade?.id, activeAudit, playbookRules.length]);

  const toggleRule = (ruleId) => {
    setRuleExecutions(prev => {
      const current = prev[ruleId]?.isFollowed ?? true;
      const updated = {
        ...prev,
        [ruleId]: { ...prev[ruleId], isFollowed: !current }
      };

      // Auto-save audit
      saveAuditState(updated);
      return updated;
    });
  };

  const disciplineScore = useMemo(() => {
    if (playbookRules.length === 0) return 100;
    let followed = 0;
    playbookRules.forEach(r => {
      if (ruleExecutions[r.id]?.isFollowed) followed++;
    });
    return Math.round((followed / playbookRules.length) * 100);
  }, [playbookRules, ruleExecutions]);

  const saveAuditState = (execMap) => {
    if (!activeTrade?.id) return;
    const followed = playbookRules.filter(r => execMap[r.id]?.isFollowed).length;
    const score = playbookRules.length > 0 ? Math.round((followed / playbookRules.length) * 100) : 100;

    const newAudit = {
      tradeId: activeTrade.id,
      playbookId: selectedPlaybookId,
      ruleExecutions: execMap,
      disciplineScore: score,
      auditedAt: new Date().toISOString()
    };

    const nextAudits = { ...tradeAudits, [activeTrade.id]: newAudit };
    setTradeAudits(nextAudits);
    try {
      localStorage.setItem(LS_AUDITS_KEY, JSON.stringify(nextAudits));
    } catch (_) {}

    if (onUpdateTrade) {
      onUpdateTrade(activeTrade.id, 'disciplineScore', score);
    }
  };

  // Cost of Indiscipline
  const costOfIndiscipline = useMemo(() => {
    if (isWin || disciplineScore >= 95) return 0;
    // If loss trade with rule violations, full loss is counted as cost of indiscipline
    return Math.abs(numPnl);
  }, [isWin, disciplineScore, numPnl]);

  // ── Notes Editor State ────────────────────────────────────────────────────
  const [setupThesis, setSetupThesis] = useState('');
  const [inTradeManagement, setInTradeManagement] = useState('');
  const [postTradeLessons, setPostTradeLessons] = useState('');

  useEffect(() => {
    if (!activeTrade) return;
    setSetupThesis(activeTrade.setupThesis || activeTrade.notes || '');
    setInTradeManagement(activeTrade.inTradeManagement || '');
    setPostTradeLessons(activeTrade.postTradeLessons || activeTrade.growthAreas || '');
  }, [activeTrade?.id]);

  const handleSaveNotes = () => {
    if (!activeTrade?.id || !onUpdateTrade) return;
    onUpdateTrade(activeTrade.id, 'setupThesis', setupThesis);
    onUpdateTrade(activeTrade.id, 'inTradeManagement', inTradeManagement);
    onUpdateTrade(activeTrade.id, 'postTradeLessons', postTradeLessons);
    onUpdateTrade(activeTrade.id, 'notes', setupThesis);

    showToast('Reflection notes saved successfully');
  };

  // Psychology tags
  const EMOTIONS_LIST = ['Disciplined', 'Patient', 'Hesitant', 'FOMO', 'Anxious', 'Revenge', 'Calm', 'Greedy'];
  const [selectedEmotion, setSelectedEmotion] = useState(activeTrade?.emotion || activeTrade?.mood || 'Disciplined');

  const handleSelectEmotion = (emo) => {
    setSelectedEmotion(emo);
    if (onUpdateTrade && activeTrade?.id) {
      onUpdateTrade(activeTrade.id, 'emotion', emo);
      onUpdateTrade(activeTrade.id, 'mood', emo);
      showToast(`Logged emotion: ${emo}`);
    }
  };

  // Confidence Stars
  const [confidence, setConfidence] = useState(activeTrade?.confidence || 4);
  const handleSelectConfidence = (val) => {
    setConfidence(val);
    if (onUpdateTrade && activeTrade?.id) {
      onUpdateTrade(activeTrade.id, 'confidence', val);
      showToast(`Confidence set to ${val}/5`);
    }
  };

  // Market Regime Context
  const REGIMES = ['Trending Bullish', 'Rangebound / Consolidation', 'Breakout Run', 'Volatile / News Event', 'Bearish Breakdown'];
  const [marketRegime, setMarketRegime] = useState(activeTrade?.marketCondition || 'Trending Bullish');

  const handleSelectRegime = (reg) => {
    setMarketRegime(reg);
    if (onUpdateTrade && activeTrade?.id) {
      onUpdateTrade(activeTrade.id, 'marketCondition', reg);
      showToast(`Market context set to ${reg}`);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Automated Rule-based Strengths & Improvements
  const auditInsights = useMemo(() => {
    const strengths = [];
    const improvements = [];

    if (isWin) {
      strengths.push(`Profitable outcome (+₹${pnlFormatted})`);
    } else {
      improvements.push(`Trade resulted in a loss of ₹${pnlFormatted}`);
    }

    if (rMultiple >= 1.5) {
      strengths.push(`Achieved favorable Risk-to-Reward ratio (${rMultiple.toFixed(2)}R)`);
    } else if (isWin && rMultiple < 1.0) {
      improvements.push(`Realized reward (${rMultiple.toFixed(2)}R) was below 1:1.5 target`);
    }

    if (slPrice > 0) {
      strengths.push(`Stop Loss defined at ₹${slPrice.toFixed(2)} and strictly respected`);
    } else {
      improvements.push('No initial Stop Loss defined on entry');
    }

    if (disciplineScore >= 80) {
      strengths.push(`High rule adherence score of ${disciplineScore}%`);
    } else {
      improvements.push(`Setup rule compliance dropped to ${disciplineScore}%`);
    }

    if (selectedEmotion === 'Disciplined' || selectedEmotion === 'Patient') {
      strengths.push(`Maintained calm mindset (${selectedEmotion}) during trade`);
    } else if (selectedEmotion === 'FOMO' || selectedEmotion === 'Revenge') {
      improvements.push(`Trade taken with emotional bias (${selectedEmotion})`);
    }

    return { strengths, improvements };
  }, [isWin, pnlFormatted, rMultiple, slPrice, disciplineScore, selectedEmotion]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary, #0b0f19)',
      color: 'var(--text-primary, #ffffff)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      paddingBottom: '120px'
    }}>
      {/* ── 1. Top Header Bar (Spacious, Minimalist, Refined) ───────────────────── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backgroundColor: 'var(--bg-surface, #ffffff)',
        borderBottom: '1px solid var(--border-color, #e5e7eb)',
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        {/* Left: Return & Symbol Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onClose}
            title="Return to Journal"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: isDark ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.03)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#f3f4f6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff'; }}
            onMouseDown={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#333333' : '#e5e7eb'; }}
            onMouseUp={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#f3f4f6'; }}
          >
            <ArrowLeft size={14} />
            <span>Journal</span>
          </button>

          <div style={{ width: '1px', height: '22px', backgroundColor: 'var(--border-color)', opacity: 0.6 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SymbolLogo symbol={selectedSymbol} size={36} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {selectedSymbol}
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: isShort ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                  color: isShort ? '#ef4444' : '#10b981',
                  border: `1px solid ${isShort ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`
                }}>
                  {isShort ? 'SHORT' : 'LONG'}
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)'
                }}>
                  NSE CASH
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                Trade #{activeTrade?.tradeNo || '—'} · {activeTrade?.date || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Center: Carousel Navigation (< Prev | Next >) + Symbol Jumper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              disabled={!prevTrade}
              onClick={() => handleNavigateToTrade(prevTrade)}
              title={prevTrade ? `Previous Trade (#${prevTrade.tradeNo} - ${prevTrade.name})` : 'No previous trade'}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff',
                color: prevTrade ? 'var(--text-primary)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: prevTrade ? 'pointer' : 'default',
                opacity: prevTrade ? 1 : 0.4,
                boxShadow: isDark ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.03)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { if (prevTrade) e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#f3f4f6'; }}
              onMouseLeave={(e) => { if (prevTrade) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff'; }}
              onMouseDown={(e) => { if (prevTrade) e.currentTarget.style.backgroundColor = isDark ? '#333333' : '#e5e7eb'; }}
              onMouseUp={(e) => { if (prevTrade) e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#f3f4f6'; }}
            >
              <ChevronLeft size={16} />
            </button>

            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', padding: '0 6px', fontFamily: 'monospace' }}>
              {globalIndex >= 0 ? `${globalIndex + 1} of ${allSortedTrades.length}` : '—'}
            </span>

            <button
              disabled={!nextTrade}
              onClick={() => handleNavigateToTrade(nextTrade)}
              title={nextTrade ? `Next Trade (#${nextTrade.tradeNo} - ${nextTrade.name})` : 'No next trade'}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff',
                color: nextTrade ? 'var(--text-primary)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: nextTrade ? 'pointer' : 'default',
                opacity: nextTrade ? 1 : 0.4,
                boxShadow: isDark ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.03)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { if (nextTrade) e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#f3f4f6'; }}
              onMouseLeave={(e) => { if (nextTrade) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff'; }}
              onMouseDown={(e) => { if (nextTrade) e.currentTarget.style.backgroundColor = isDark ? '#333333' : '#e5e7eb'; }}
              onMouseUp={(e) => { if (nextTrade) e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#f3f4f6'; }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Autocomplete Symbol Search */}
          <div style={{ position: 'relative', width: '200px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={13} color="var(--text-muted)" style={{ position: 'absolute', left: '10px' }} />
              <input
                type="text"
                placeholder="Search symbol..."
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                style={{
                  width: '100%',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  padding: '0 10px 0 30px',
                  fontSize: '12px',
                  outline: 'none',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff',
                  color: 'var(--text-primary)',
                  boxShadow: isDark ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.02)'
                }}
              />
            </div>

            {isSearchOpen && (
              <>
                <div onClick={() => setIsSearchOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  padding: '4px'
                }}>
                  {filteredSymbols.length > 0 ? (
                    filteredSymbols.map(s => (
                      <button
                        key={s.symbol}
                        onClick={() => {
                          setSelectedSymbol(s.symbol);
                          setSelectedTradeNo(s.latestTradeNo);
                          setSelectedTradeId(s.latestTradeId);
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          border: 'none',
                          borderRadius: '6px',
                          backgroundColor: selectedSymbol === s.symbol ? (isDark ? '#262626' : '#f3f4f6') : 'transparent',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <SymbolLogo symbol={s.symbol} size={18} />
                          <span style={{ fontSize: '11.5px', fontWeight: 700 }}>{s.symbol}</span>
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {s.tradeCount} trades
                        </span>
                      </button>
                    ))
                  ) : (
                    <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                      No symbols found
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Realized P&L, R-Multiple, and Performance Grade */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Performance Grade Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '8px',
            backgroundColor: performanceGrade.bg,
            border: `1px solid ${performanceGrade.border}`
          }}>
            <span style={{ fontSize: '15px', fontWeight: 900, color: performanceGrade.color }}>
              {performanceGrade.letter}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: performanceGrade.color }}>
              {performanceGrade.desc}
            </span>
          </div>

          {/* R-Multiple */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>
              R-Multiple
            </div>
            <div style={{
              fontSize: '15px',
              fontWeight: 800,
              fontFamily: 'monospace',
              color: rMultiple >= 0 ? '#10b981' : '#ef4444'
            }}>
              {rMultiple >= 0 ? '+' : ''}{rMultiple.toFixed(2)}R
            </div>
          </div>

          {/* Net Realized P&L */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>
              Net P&L
            </div>
            <div style={{
              fontSize: '17px',
              fontWeight: 800,
              fontFamily: 'monospace',
              color: isWin ? '#10b981' : '#ef4444'
            }}>
              {isWin ? '+' : '-'}₹{pnlFormatted}
              <span style={{ fontSize: '11px', fontWeight: 600, marginLeft: '4px', opacity: 0.85 }}>
                ({returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Top Navigation Tabs Bar (Spacious, White & Grey Transitions) ────── */}
      <div style={{
        padding: '12px 32px',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '3px',
          borderRadius: '10px',
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
          border: '1px solid var(--border-color)',
          gap: '3px'
        }}>
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'legs', label: 'Execution', icon: Layers },
            { id: 'psychology', label: 'Psychology & Setup', icon: Target },
            { id: 'notes', label: 'Notes & Gallery', icon: FileText },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '7px 16px',
                  borderRadius: '7px',
                  border: isActive 
                    ? (isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)')
                    : '1px solid transparent',
                  backgroundColor: isActive 
                    ? (isDark ? '#262626' : '#ffffff')
                    : 'transparent',
                  color: isActive 
                    ? (isDark ? '#f9fafb' : '#111827')
                    : 'var(--text-secondary)',
                  fontSize: '12.5px',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  boxShadow: isActive 
                    ? (isDark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 2px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)')
                    : 'none',
                  transition: 'all 0.15s ease',
                  outline: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#333333' : '#e5e7eb';
                }}
                onMouseUp={(e) => {
                  if (isActive) {
                    e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#ffffff';
                  }
                }}
              >
                <Icon size={14} color={isActive ? (isDark ? '#f9fafb' : '#111827') : 'var(--text-muted)'} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toast Notification Alert */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 999,
          backgroundColor: isDark ? '#262626' : '#ffffff',
          color: isDark ? '#ffffff' : '#111827',
          border: '1px solid var(--border-color)',
          padding: '10px 18px',
          borderRadius: '10px',
          fontSize: '12px',
          fontWeight: 600,
          boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Check size={14} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── 3. Tab Contents ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '24px 24px 60px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* TAB 1: OVERVIEW & CHART */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Main Interactive Candlestick Chart (Exact FoxTrade Chart Engine) */}
            <div style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '16px',
              padding: '10px 16px 16px 16px',
              position: 'relative',
              boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0,0,0,0.04))'
            }}>
              <StockChartsPage
                trades={trades}
                selectedSymbol={selectedSymbol}
                onSelectSymbol={setSelectedSymbol}
                chartOnly={true}
              />
            </div>

            {/* 5 Execution Metric Cards Strip */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              {/* Card 1: Realized R:R */}
              <div style={{ padding: '14px 18px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Realized Risk:Reward
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'monospace', marginTop: '4px', color: isWin ? '#10b981' : '#ef4444' }}>
                  1 : {Math.abs(rMultiple).toFixed(2)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {rMultiple >= 2.0 ? 'Exceeded 1:2 Setup Target' : rMultiple >= 1.0 ? 'Met minimum risk ratio' : 'Undersized payoff'}
                </div>
              </div>

              {/* Card 2: Initial Capital at Risk (1R) */}
              <div style={{ padding: '14px 18px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Planned 1R Risk
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'monospace', marginTop: '4px', color: 'var(--text-primary)' }}>
                  ₹{(riskAmountPerShare * (activeTrade?.qty || 1)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  SL @ ₹{slPrice > 0 ? slPrice.toFixed(2) : '—'}
                </div>
              </div>

              {/* Card 3: Holding Duration */}
              <div style={{ padding: '14px 18px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Holding Period
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'monospace', marginTop: '4px', color: 'var(--text-primary)' }}>
                  {activeTrade?.holdingDays !== undefined ? `${activeTrade.holdingDays} Days` : 'Intraday'}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Status: {activeTrade?.status || 'Closed'}
                </div>
              </div>

              {/* Card 4: Peak Run / Max Move */}
              <div style={{ padding: '14px 18px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Total Position Size
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'monospace', marginTop: '4px', color: 'var(--text-primary)' }}>
                  ₹{(entryPrice * (activeTrade?.qty || 1)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Qty: {activeTrade?.qty || 1} units
                </div>
              </div>

              {/* Card 5: Plan Discipline Score */}
              <div style={{ padding: '14px 18px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Discipline Score
                </div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  marginTop: '4px',
                  color: disciplineScore >= 80 ? '#10b981' : disciplineScore >= 60 ? '#f97316' : '#ef4444'
                }}>
                  {disciplineScore}%
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {disciplineScore >= 80 ? 'Strict Plan Execution' : 'Checklist Deviations'}
                </div>
              </div>
            </div>

            {/* Rule-based Strengths & Areas for Improvement (Two Columns) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px'
            }}>
              {/* Strengths */}
              <div style={{
                padding: '18px 20px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <CheckCircle2 size={16} color="#10b981" />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#10b981' }}>
                    Execution Strengths
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {auditInsights.strengths.map((s, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px' }}>
                      <span style={{ color: '#10b981', fontWeight: 800 }}>•</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Areas for Improvement */}
              <div style={{
                padding: '18px 20px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <AlertTriangle size={16} color="#f97316" />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#f97316' }}>
                    Areas for Improvement
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {auditInsights.improvements.map((imp, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px' }}>
                      <span style={{ color: '#f97316', fontWeight: 800 }}>•</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{imp}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EXECUTION & LEGS */}
        {activeTab === 'legs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Multi-Leg Table */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '13px', fontWeight: 800 }}>
                  Trade Execution Matrix (Multi-Leg & Pyramiding)
                </span>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Every buy leg, add-on pyramid, trailing stop loss, and exit execution recorded on this trade.
                </p>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700 }}>LEG</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700 }}>ACTION</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700 }}>DATE</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>PRICE (₹)</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>QTY</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>TURNOVER (₹)</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>SL / STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Initial Entry */}
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 800 }}>Initial Entry</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: isShort ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: isShort ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                          {isShort ? 'SELL' : 'BUY'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>{activeTrade?.date || '—'}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>₹{entryPrice.toFixed(2)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{activeTrade?.qty || 1}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace' }}>₹{(entryPrice * (activeTrade?.qty || 1)).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#ef4444' }}>₹{slPrice > 0 ? slPrice.toFixed(2) : 'None'}</td>
                    </tr>

                    {/* Pyramids P1 - P4 */}
                    {[
                      { label: 'P1 (Add-on 1)', price: activeTrade?.p1Price, qty: activeTrade?.p1Qty, date: activeTrade?.p1Date, sl: activeTrade?.p1Sl },
                      { label: 'P2 (Add-on 2)', price: activeTrade?.p2Price, qty: activeTrade?.p2Qty, date: activeTrade?.p2Date, sl: activeTrade?.p2Sl },
                      { label: 'P3 (Add-on 3)', price: activeTrade?.p3Price, qty: activeTrade?.p3Qty, date: activeTrade?.p3Date, sl: activeTrade?.p3Sl },
                    ].filter(p => p.price && Number(p.price) > 0).map((p, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700 }}>{p.label}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(5, 150, 105, 0.1)', color: '#059669', fontWeight: 700 }}>
                            ADD
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>{p.date || '—'}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>₹{Number(p.price).toFixed(2)}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{p.qty || '—'}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace' }}>₹{(Number(p.price) * Number(p.qty || 1)).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#ef4444' }}>{p.sl ? `₹${Number(p.sl).toFixed(2)}` : '—'}</td>
                      </tr>
                    ))}

                    {/* Exits */}
                    <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 800 }}>Final Exit</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 700 }}>
                          EXIT
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>{activeTrade?.exitDate || activeTrade?.date || '—'}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>₹{exitPrice.toFixed(2)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{activeTrade?.exitedQty || activeTrade?.qty || 1}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace' }}>₹{(exitPrice * (activeTrade?.exitedQty || activeTrade?.qty || 1)).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: isWin ? '#10b981' : '#ef4444' }}>
                        {isWin ? '+' : ''}₹{pnlFormatted}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Indian Regulatory & Brokerage Charges Breakdown Card */}
            <div style={{
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 800 }}>
                    Indian Market Statutory & Brokerage Fees
                  </span>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Calculated for Broker: <strong>{(activeTrade?.broker || 'Zerodha').toUpperCase()}</strong> (STT, Turnover Fees, GST & Stamp Duty).
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Charges</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', color: '#ef4444' }}>
                    -₹{tradeCharges.total.toFixed(2)}
                  </div>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px'
              }}>
                <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-surface)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>Brokerage</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', marginTop: '2px' }}>₹{tradeCharges.brokerage.toFixed(2)}</div>
                </div>
                <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-surface)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>STT / CTT</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', marginTop: '2px' }}>₹{tradeCharges.stt.toFixed(2)}</div>
                </div>
                <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-surface)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>Exchange Turnover</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', marginTop: '2px' }}>₹{tradeCharges.exchangeFee.toFixed(2)}</div>
                </div>
                <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-surface)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>GST (18%)</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', marginTop: '2px' }}>₹{tradeCharges.gst.toFixed(2)}</div>
                </div>
                <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-surface)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>Stamp Duty & SEBI</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', marginTop: '2px' }}>₹{(tradeCharges.stampDuty + tradeCharges.sebi).toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PSYCHOLOGY & SETUP AUDIT */}
        {activeTab === 'psychology' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.3fr)', gap: '20px' }}>
            {/* LEFT COLUMN: Psychology, Confidence, Market Regime */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Emotional State */}
              <div style={{ padding: '18px 20px', borderRadius: '12px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '13px', fontWeight: 800 }}>
                  Emotional State at Execution
                </span>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 12px 0' }}>
                  Tag your dominant psychological state during entry and holding.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {EMOTIONS_LIST.map(emo => {
                    const isSelected = selectedEmotion === emo;
                    return (
                      <button
                        key={emo}
                        onClick={() => handleSelectEmotion(emo)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: isSelected 
                            ? (isDark ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid #9ca3af')
                            : '1px solid var(--border-color)',
                          backgroundColor: isSelected 
                            ? (isDark ? '#2e2e2e' : '#ffffff')
                            : (isDark ? 'rgba(255, 255, 255, 0.03)' : '#f9fafb'),
                          color: isSelected 
                            ? (isDark ? '#ffffff' : '#111827')
                            : 'var(--text-secondary)',
                          fontSize: '11.5px',
                          fontWeight: isSelected ? 700 : 500,
                          boxShadow: isSelected 
                            ? (isDark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.08)')
                            : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#f3f4f6';
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.03)' : '#f9fafb';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.backgroundColor = isDark ? '#383838' : '#e5e7eb';
                        }}
                      >
                        {emo}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Confidence Rating (1 - 5) */}
              <div style={{ padding: '18px 20px', borderRadius: '12px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800 }}>
                    Pre-Trade Confidence
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'monospace' }}>
                    {confidence} / 5
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                  How high was your conviction before triggering the order?
                </p>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 3, 4, 5].map(val => {
                    const isFilled = val <= confidence;
                    return (
                      <button
                        key={val}
                        onClick={() => handleSelectConfidence(val)}
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          borderRadius: '8px',
                          border: isFilled
                            ? (isDark ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid #9ca3af')
                            : '1px solid var(--border-color)',
                          backgroundColor: isFilled
                            ? (isDark ? '#2e2e2e' : '#ffffff')
                            : 'transparent',
                          color: isFilled
                            ? (isDark ? '#ffffff' : '#111827')
                            : 'var(--text-muted)',
                          fontSize: '12px',
                          fontWeight: 700,
                          boxShadow: isFilled
                            ? (isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.06)')
                            : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isFilled) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          if (!isFilled) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.backgroundColor = isDark ? '#383838' : '#e5e7eb';
                        }}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Market Regime */}
              <div style={{ padding: '18px 20px', borderRadius: '12px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '13px', fontWeight: 800 }}>
                  Market Context & Regime
                </span>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 12px 0' }}>
                  What was the broader NIFTY/sector environment?
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {REGIMES.map(reg => {
                    const isSelected = marketRegime === reg;
                    return (
                      <button
                        key={reg}
                        onClick={() => handleSelectRegime(reg)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: isSelected
                            ? (isDark ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid #9ca3af')
                            : '1px solid var(--border-color)',
                          backgroundColor: isSelected
                            ? (isDark ? '#2e2e2e' : '#ffffff')
                            : (isDark ? 'rgba(255, 255, 255, 0.03)' : 'var(--bg-surface)'),
                          color: isSelected
                            ? (isDark ? '#ffffff' : '#111827')
                            : 'var(--text-secondary)',
                          fontSize: '11.5px',
                          fontWeight: isSelected ? 700 : 500,
                          boxShadow: isSelected
                            ? (isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.06)')
                            : 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#f3f4f6';
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.03)' : 'var(--bg-surface)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.backgroundColor = isDark ? '#383838' : '#e5e7eb';
                        }}
                      >
                        {reg}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Playbook Setup Checklist & Rule Audit */}
            <div style={{
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 800 }}>
                    Playbook Checklist Audit
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Setup:</span>
                    <select
                      value={selectedPlaybookId}
                      onChange={(e) => {
                        const newPbId = e.target.value;
                        setSelectedPlaybookId(newPbId);
                        const pb = playbooks.find(p => p.id === newPbId);
                        if (pb && onUpdateTrade && activeTrade) {
                          onUpdateTrade(activeTrade.id, 'setup', pb.title);
                          onUpdateTrade(activeTrade.id, 'playbookId', pb.id);
                        }
                      }}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {playbooks.map(pb => (
                        <option key={pb.id} value={pb.id}>
                          {pb.title}
                        </option>
                      ))}
                    </select>

                    {onOpenPlaybook && (
                      <button
                        onClick={() => onOpenPlaybook(selectedPlaybookId)}
                        title="Open this setup in Playbook Studio"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff',
                          color: 'var(--text-primary)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#f3f4f6';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff';
                        }}
                        onMouseDown={e => {
                          e.currentTarget.style.backgroundColor = isDark ? '#383838' : '#e5e7eb';
                        }}
                      >
                        <span>Studio</span>
                        <ExternalLink size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Score Pill */}
                <div style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  backgroundColor: disciplineScore >= 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: disciplineScore >= 80 ? '#10b981' : '#ef4444',
                  fontSize: '12px',
                  fontWeight: 800,
                  fontFamily: 'monospace'
                }}>
                  {disciplineScore}% Adherence
                </div>
              </div>

              {/* Rules List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                {playbookRules.length > 0 ? (
                  playbookRules.map(rule => {
                    const isFollowed = ruleExecutions[rule.id]?.isFollowed ?? true;
                    return (
                      <div
                        key={rule.id}
                        onClick={() => toggleRule(rule.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          backgroundColor: isFollowed ? 'var(--bg-surface)' : 'rgba(239, 68, 68, 0.08)',
                          border: `1px solid ${isFollowed ? 'var(--border-color)' : 'rgba(239, 68, 68, 0.25)'}`,
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ marginTop: '2px', color: isFollowed ? '#10b981' : '#ef4444' }}>
                          {isFollowed ? <CheckSquare size={16} /> : <Square size={16} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: isFollowed ? 'var(--text-primary)' : '#ef4444' }}>
                            {rule.text}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {rule.groupTitle} · {rule.isRequired ? 'Required' : 'Discretionary'}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    No setup checklist rules attached. Add setup in Playbooks studio.
                  </div>
                )}
              </div>

              {/* Cost of Indiscipline Box */}
              {costOfIndiscipline > 0 && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} color="#ef4444" />
                    <div>
                      <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#ef4444' }}>
                        Cost of Indiscipline
                      </span>
                      <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', margin: 0 }}>
                        Avoidable capital loss caused by checklist violations.
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: 900, fontFamily: 'monospace', color: '#ef4444' }}>
                    -₹{costOfIndiscipline.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: NOTES & GALLERY */}
        {activeTab === 'notes' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(360px, 0.9fr)', gap: '20px' }}>
            {/* LEFT: Structured 3-Part Trade Reflection */}
            <div style={{
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 800 }}>
                    Trade Reflection & Post-Mortem
                  </span>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Document the thesis, in-trade behavior, and actionable lessons.
                  </p>
                </div>
                <button
                  onClick={handleSaveNotes}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: isDark ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#f3f4f6'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff'; }}
                  onMouseDown={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#383838' : '#e5e7eb'; }}
                  onMouseUp={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#f3f4f6'; }}
                >
                  <Save size={13} />
                  <span>Save Notes</span>
                </button>
              </div>

              {/* 1. Setup Thesis */}
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  1. Setup Thesis (Why did you enter?)
                </label>
                <textarea
                  rows={3}
                  value={setupThesis}
                  onChange={(e) => setSetupThesis(e.target.value)}
                  placeholder="e.g. Daily close above 20 EMA with RVOL 2.1x, break of swing pivot high..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* 2. In-Trade Management */}
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  2. Position Management & Trailing SL
                </label>
                <textarea
                  rows={3}
                  value={inTradeManagement}
                  onChange={(e) => setInTradeManagement(e.target.value)}
                  placeholder="e.g. Trailed stop loss to breakeven after Target 1, held through intraday pullback..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* 3. Post-Trade Lessons */}
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  3. Key Takeaway / Playbook Lesson
                </label>
                <textarea
                  rows={3}
                  value={postTradeLessons}
                  onChange={(e) => setPostTradeLessons(e.target.value)}
                  placeholder="e.g. Do not chase entries extended >2% from VWAP; wait for the first 15m pullback..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            {/* RIGHT: Pre/Post Chart Comparison Gallery */}
            <div style={{
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800 }}>
                  Chart Screenshots
                </span>
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Upload size={12} />
                  <span>Upload</span>
                </button>
              </div>

              {/* Before Entry Image */}
              <div>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Before Entry Chart
                </span>
                {activeTrade?.chartBefore ? (
                  <div 
                    onClick={() => handleOpenLightbox('before')}
                    className="group"
                    style={{ 
                      position: 'relative', 
                      aspectRatio: '16/9', 
                      borderRadius: '8px', 
                      overflow: 'hidden', 
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid var(--border-color)', 
                      backgroundColor: isDark ? '#000000' : '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <img 
                      src={activeTrade.chartBefore} 
                      alt="Before Entry" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    />
                    
                    {/* Hover Overlay with View Badge */}
                    <div 
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.6)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 16px',
                        borderRadius: '20px',
                        backgroundColor: isDark ? '#262626' : '#ffffff',
                        color: isDark ? '#ffffff' : '#111827',
                        fontSize: '12px',
                        fontWeight: 600,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                        pointerEvents: 'none',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)'}`
                      }}>
                        <Maximize2 size={13} />
                        <span>View Chart</span>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onUpdateTrade) onUpdateTrade(activeTrade.id, 'chartBefore', '');
                      }}
                      title="Remove Chart"
                      style={{ 
                        position: 'absolute', 
                        top: '8px', 
                        right: '8px', 
                        width: '26px', 
                        height: '26px', 
                        borderRadius: '50%', 
                        backgroundColor: isDark ? '#262626' : '#ffffff', 
                        color: 'var(--text-primary)', 
                        border: '1px solid var(--border-color)', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        zIndex: 2,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#333333' : '#f3f4f6'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#ffffff'; }}
                      onMouseDown={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#444444' : '#e5e7eb'; }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsUploadModalOpen(true)}
                    style={{ 
                      aspectRatio: '16/9', 
                      border: isDark ? '1px dashed rgba(255, 255, 255, 0.3)' : '1px dashed var(--border-color)', 
                      borderRadius: '8px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      cursor: 'pointer', 
                      backgroundColor: 'var(--bg-surface)' 
                    }}
                  >
                    <ImageIcon size={18} color="var(--text-muted)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '4px' }}>Upload Setup Chart</span>
                  </div>
                )}
              </div>

              {/* After Exit Image */}
              <div>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  After Exit Chart
                </span>
                {activeTrade?.chartAfter ? (
                  <div 
                    onClick={() => handleOpenLightbox('after')}
                    className="group"
                    style={{ 
                      position: 'relative', 
                      aspectRatio: '16/9', 
                      borderRadius: '8px', 
                      overflow: 'hidden', 
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid var(--border-color)', 
                      backgroundColor: isDark ? '#000000' : '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <img 
                      src={activeTrade.chartAfter} 
                      alt="After Exit" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    />

                    {/* Hover Overlay with View Badge */}
                    <div 
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.6)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 16px',
                        borderRadius: '20px',
                        backgroundColor: isDark ? '#262626' : '#ffffff',
                        color: isDark ? '#ffffff' : '#111827',
                        fontSize: '12px',
                        fontWeight: 600,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                        pointerEvents: 'none',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)'}`
                      }}>
                        <Maximize2 size={13} />
                        <span>View Chart</span>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onUpdateTrade) onUpdateTrade(activeTrade.id, 'chartAfter', '');
                      }}
                      title="Remove Chart"
                      style={{ 
                        position: 'absolute', 
                        top: '8px', 
                        right: '8px', 
                        width: '26px', 
                        height: '26px', 
                        borderRadius: '50%', 
                        backgroundColor: isDark ? '#262626' : '#ffffff', 
                        color: 'var(--text-primary)', 
                        border: '1px solid var(--border-color)', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        zIndex: 2,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#333333' : '#f3f4f6'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#ffffff'; }}
                      onMouseDown={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#444444' : '#e5e7eb'; }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsUploadModalOpen(true)}
                    style={{ 
                      aspectRatio: '16/9', 
                      border: isDark ? '1px dashed rgba(255, 255, 255, 0.3)' : '1px dashed var(--border-color)', 
                      borderRadius: '8px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      cursor: 'pointer', 
                      backgroundColor: 'var(--bg-surface)' 
                    }}
                  >
                    <ImageIcon size={18} color="var(--text-muted)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '4px' }}>Upload Exit Chart</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && activeTrade && (
        <UploadChartModal
          isOpen={isUploadModalOpen}
          trade={activeTrade}
          onClose={() => setIsUploadModalOpen(false)}
          onSave={(tradeId, updates) => {
            if (onUpdateTrade) {
              if (updates.chartBefore !== undefined) onUpdateTrade(tradeId, 'chartBefore', updates.chartBefore);
              if (updates.chartAfter !== undefined) onUpdateTrade(tradeId, 'chartAfter', updates.chartAfter);
            }
          }}
        />
      )}

      {/* Full Screen Image Viewer Lightbox Modal */}
      {lightboxImage && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div
          onClick={handleCloseLightbox}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: lbTheme.overlayBg,
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            userSelect: 'none',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onWheel={handleWheel}
        >
          {/* Top Control Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              height: '56px',
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${lbTheme.border}`,
              backgroundColor: lbTheme.barBg,
              backdropFilter: 'blur(20px)',
              zIndex: 10
            }}
          >
            {/* Left: Trade Info & Chart Type Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SymbolLogo symbol={activeTrade?.name || selectedSymbol} size={22} />
                <span style={{ color: lbTheme.text, fontWeight: 700, fontSize: '14px', letterSpacing: '0.01em' }}>
                  {activeTrade?.name || selectedSymbol}
                </span>
                <span style={{ 
                  color: lbTheme.tradeBadgeColor, 
                  fontSize: '11px', 
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: lbTheme.btnBorder,
                  backgroundColor: lbTheme.tradeBadgeBg
                }}>
                  Trade #{activeTrade?.tradeNo || selectedTradeNo}
                </span>
              </div>

              {/* Segmented Switcher for Before / After */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: lbTheme.tradeBadgeBg,
                padding: '3px',
                borderRadius: '8px',
                gap: '3px',
                border: lbTheme.btnBorder
              }}>
                {activeTrade?.chartBefore && (
                  <button
                    onClick={() => handleSwitchLightbox('before')}
                    style={{
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: lightboxImage.type === 'before' ? 600 : 500,
                      borderRadius: '6px',
                      border: lightboxImage.type === 'before' ? lbTheme.activeTabBorder : '1px solid transparent',
                      backgroundColor: lightboxImage.type === 'before' ? lbTheme.activeTabBg : 'transparent',
                      color: lightboxImage.type === 'before' ? lbTheme.activeTabColor : lbTheme.inactiveTabColor,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (lightboxImage.type !== 'before') {
                        e.currentTarget.style.backgroundColor = lbTheme.btnHoverBg;
                        e.currentTarget.style.color = lbTheme.text;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (lightboxImage.type !== 'before') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = lbTheme.inactiveTabColor;
                      }
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.backgroundColor = lbTheme.btnActiveBg;
                    }}
                  >
                    Before Entry
                  </button>
                )}
                {activeTrade?.chartAfter && (
                  <button
                    onClick={() => handleSwitchLightbox('after')}
                    style={{
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: lightboxImage.type === 'after' ? 600 : 500,
                      borderRadius: '6px',
                      border: lightboxImage.type === 'after' ? lbTheme.activeTabBorder : '1px solid transparent',
                      backgroundColor: lightboxImage.type === 'after' ? lbTheme.activeTabBg : 'transparent',
                      color: lightboxImage.type === 'after' ? lbTheme.activeTabColor : lbTheme.inactiveTabColor,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (lightboxImage.type !== 'after') {
                        e.currentTarget.style.backgroundColor = lbTheme.btnHoverBg;
                        e.currentTarget.style.color = lbTheme.text;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (lightboxImage.type !== 'after') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = lbTheme.inactiveTabColor;
                      }
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.backgroundColor = lbTheme.btnActiveBg;
                    }}
                  >
                    After Exit
                  </button>
                )}
              </div>
            </div>

            {/* Right: Zoom, Download, External, Close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Zoom pill */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: lbTheme.btnBg,
                borderRadius: '8px',
                padding: '2px',
                gap: '2px',
                border: lbTheme.btnBorder,
                boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.03)'
              }}>
                <button
                  onClick={handleZoomOut}
                  title="Zoom Out (-)"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: 'none',
                    border: 'none',
                    color: lbTheme.text,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnHoverBg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  onMouseDown={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnActiveBg; }}
                  onMouseUp={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnHoverBg; }}
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  onClick={handleResetZoom}
                  title="Reset Zoom (0)"
                  style={{
                    padding: '0 8px',
                    height: '28px',
                    background: 'none',
                    border: 'none',
                    color: lbTheme.text,
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnHoverBg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  onMouseDown={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnActiveBg; }}
                  onMouseUp={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnHoverBg; }}
                >
                  {Math.round(lightboxZoom * 100)}%
                </button>
                <button
                  onClick={handleZoomIn}
                  title="Zoom In (+)"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: 'none',
                    border: 'none',
                    color: lbTheme.text,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnHoverBg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  onMouseDown={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnActiveBg; }}
                  onMouseUp={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnHoverBg; }}
                >
                  <ZoomIn size={15} />
                </button>
              </div>

              {/* Download */}
              <button
                onClick={handleDownloadImage}
                title="Download Chart Image"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: lbTheme.btnBg,
                  border: lbTheme.btnBorder,
                  color: lbTheme.text,
                  cursor: 'pointer',
                  boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnHoverBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnBg; }}
                onMouseDown={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnActiveBg; }}
                onMouseUp={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnHoverBg; }}
              >
                <Download size={15} />
              </button>

              {/* Open in New Tab */}
              <button
                onClick={() => window.open(lightboxImage.url, '_blank')}
                title="Open original in new tab"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: lbTheme.btnBg,
                  border: lbTheme.btnBorder,
                  color: lbTheme.text,
                  cursor: 'pointer',
                  boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnHoverBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnBg; }}
                onMouseDown={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnActiveBg; }}
                onMouseUp={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnHoverBg; }}
              >
                <ExternalLink size={15} />
              </button>

              {/* Close Button */}
              <button
                onClick={handleCloseLightbox}
                title="Close (Esc)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: lbTheme.btnBg,
                  border: lbTheme.btnBorder,
                  color: lbTheme.text,
                  cursor: 'pointer',
                  marginLeft: '4px',
                  boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnHoverBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnBg; }}
                onMouseDown={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnActiveBg; }}
                onMouseUp={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnHoverBg; }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Main Stage (Image viewport) */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: '16px',
              cursor: lightboxZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Previous Image Arrow */}
            {lightboxImage.type === 'after' && activeTrade?.chartBefore && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwitchLightbox('before');
                }}
                title="Previous: Before Entry (←)"
                style={{
                  position: 'absolute',
                  left: '24px',
                  zIndex: 20,
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: lbTheme.chevronBg,
                  backdropFilter: 'blur(12px)',
                  border: lbTheme.btnBorder,
                  color: lbTheme.text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: lbTheme.chevronShadow,
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.backgroundColor = lbTheme.chevronHoverBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = lbTheme.chevronBg; }}
                onMouseDown={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnActiveBg; }}
              >
                <ChevronLeft size={22} />
              </button>
            )}

            {/* Next Image Arrow */}
            {lightboxImage.type === 'before' && activeTrade?.chartAfter && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwitchLightbox('after');
                }}
                title="Next: After Exit (→)"
                style={{
                  position: 'absolute',
                  right: '24px',
                  zIndex: 20,
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: lbTheme.chevronBg,
                  backdropFilter: 'blur(12px)',
                  border: lbTheme.btnBorder,
                  color: lbTheme.text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: lbTheme.chevronShadow,
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.backgroundColor = lbTheme.chevronHoverBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = lbTheme.chevronBg; }}
                onMouseDown={(e) => { e.currentTarget.style.backgroundColor = lbTheme.btnActiveBg; }}
              >
                <ChevronRight size={22} />
              </button>
            )}

            {/* The Image Card */}
            <div
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (lightboxZoom === 1) {
                  setLightboxZoom(1.8);
                } else {
                  handleResetZoom();
                }
              }}
              style={{
                transform: `translate(${lightboxPan.x}px, ${lightboxPan.y}px) scale(${lightboxZoom})`,
                transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'inline-block',
                maxWidth: lightboxZoom === 1 ? '92vw' : 'none',
                maxHeight: lightboxZoom === 1 ? '86vh' : 'none',
                borderRadius: '14px',
                border: lbTheme.cardBorder,
                boxShadow: lbTheme.boxShadow,
                overflow: 'hidden',
                backgroundColor: lbTheme.cardBg
              }}
            >
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                draggable={false}
                style={{
                  maxWidth: '100%',
                  maxHeight: '86vh',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
