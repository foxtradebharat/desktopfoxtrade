import React, { useState, useMemo, useRef, useEffect } from 'react';
import { db } from './services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { saveUserTrades, getUserTrades, subscribeToUserTrades, setDriveContext, clearAllLocalTrades } from './services/dbService';
import { fetchStockPrice } from './services/yahooService';
import { fetchLiveCMPForSymbol, getCachedCMP } from './services/strikePriceService';
import { liveMarketFeed } from './services/liveMarketFeed';
import { loadGoogleGsiScript, requestAccessToken, downloadBackupFromDrive, uploadBackupToDrive, clearAllDriveBackups } from './services/googleDrive';
import { subscribeToTokenUpdate, getValidAccessToken } from './db/index';
import TopBar from './components/TopBar';
import Toolbar from './components/Toolbar';
import StatCards from './components/StatCards';
import JournalTable from './components/JournalTable';
import BottomDock from './components/BottomDock';
import AddTradeModal from './components/AddTradeModal';
import DeleteTradeModal from './components/DeleteTradeModal';
import ClearAllDataModal from './components/ClearAllDataModal';
import SettingsModal from './components/SettingsModal';
import TradeSettingsModal from './components/TradeSettingsModal';
import BrokerImportModal from './components/BrokerImportModal';
import BrokerConnectivityModal from './components/BrokerConnectivityModal';
import QuickLogModal from './components/QuickLogModal';
import ElectricityBillModal from './components/ElectricityBillModal';
import ChartGalleryModal from './components/ChartGalleryModal';
import ReviewFlaggedModal from './components/ReviewFlaggedModal';
import PortfolioDNAView from './components/PortfolioDNAView';
import TradeGridMatrixView from './components/TradeGridMatrixView';
import JournalNotesInlineView from './components/JournalNotesInlineView';
import CorporateNewsFeedView from './components/CorporateNewsFeedView';
import { AlertTriangle } from 'lucide-react';

// Tab Pages
import AnalyticsPage from './components/Pages/AnalyticsPage';
import StockChartsPage from './components/Pages/StockChartsPage';
import TaxAnalyticsPage from './components/Pages/TaxAnalyticsPage';
import FundManagementPage from './components/Pages/FundManagementPage';
import DeepAnalyticsPage from './components/Pages/DeepAnalyticsPage';
import NotesPage from './components/Pages/NotesPage';
import CommunityPage from './components/Pages/CommunityPage';
import FoxyAiPage from './components/Pages/FoxyAiPage';
import ExpiryTrackerPage from './components/Pages/ExpiryTrackerPage';
import MilestonesPage from './components/Pages/MilestonesPage';
import SymbolDeepDivePage from './components/Pages/SymbolDeepDivePage';
import PlaybookEngine from './components/Playbook/PlaybookEngine';
import TradeAuditorModal from './components/Playbook/TradeAuditorModal';
import {
  loadPlaybooks,
  loadTradeAudits,
  saveTradeAudits
} from './services/playbookService';
import { JOURNAL_COLUMNS, DEFAULT_VISIBLE_COL_IDS } from './components/ColumnsPopover';
import ToastNotification from './components/ToastNotification';
import { notificationManager } from './services/notificationManager';
import PortfolioManagerModal, { getStoredPortfolios, getStoredActivePortfolioId } from './components/PortfolioManagerModal';
import {
  calculateMonthlyPerformance,
  getStoredCapitalChanges,
  getActivePortfolioCapital,
  getCapital
} from './utils/fundManagementCalculations';
import {
  enrichTradeWithFoxFormulas,
  calculateDashboardStats
} from './utils/foxCalculationEngine';
import { parseTradesFromFile } from './utils/tradeImportEngine';
import { deduplicateAndMergeTrades } from './utils/tradeDeduplicationEngine';
import { loadBrokerCharges, calculateCharges, detectSegment } from './utils/brokerChargesService';
import { getCanonicalSymbol, getCorporateActionDetails } from './utils/securityMaster.js';
import { toPaise, fromPaise } from './utils/pnlEngine.js';
import { computeDrawdown, computeDrawdownDaily } from './utils/drawdown.js';
import { getLedgerFlows } from './utils/fundManagementCalculations.js';
import { getTradePnl, isClosedTrade, isPartialTrade, sortTradesByEffectiveExitDate, buildRealizedEvents, formatDrawdownPct } from './utils/tradeMetricsShared.js';
/**
 * Robust date parser supporting Indian DD-MM-YYYY / DD/MM/YYYY and ISO YYYY-MM-DD
 */
function parseDateToLocalDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  if (typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const ymdMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(trimmed);
  if (ymdMatch) {
    return new Date(parseInt(ymdMatch[1], 10), parseInt(ymdMatch[2], 10) - 1, parseInt(ymdMatch[3], 10));
  }
  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(trimmed);
  if (dmyMatch) {
    return new Date(parseInt(dmyMatch[3], 10), parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
  }
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export default function Dashboard({ user, accessToken, onLogout, onGoogleLogin }) {
  const [toastNotification, setToastNotification] = useState(null);

  useEffect(() => {
    const handleToastEvent = (e) => {
      if (e.detail) setToastNotification(e.detail);
    };
    window.addEventListener('foxtrade_toast', handleToastEvent);
    return () => window.removeEventListener('foxtrade_toast', handleToastEvent);
  }, []);
  const [chargesMap, setChargesMap] = useState(null);
  const [portfolios, setPortfolios] = useState(() => getStoredPortfolios());
  const [activePortfolioId, setActivePortfolioId] = useState(() => getStoredActivePortfolioId());
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false);
  const [portfolioModalTab, setPortfolioModalTab] = useState('list');
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
  const [isReviewFlaggedOpen, setIsReviewFlaggedOpen] = useState(false);
  const [isReviewPressed, setIsReviewPressed] = useState(false);
  const [capitalChanges, setCapitalChanges] = useState(() =>
    getStoredCapitalChanges(activePortfolioId, '2026')
  );
  const [portfolioCapital, setPortfolioCapital] = useState(() => {
    try {
      const initialChanges = getStoredCapitalChanges(activePortfolioId, '2026');
      if (initialChanges && typeof initialChanges === 'object') {
        for (let m = 0; m < 12; m++) {
          const added = Number(initialChanges[m]?.added || 0);
          if (added > 0) return added;
        }
      }
      const saved = localStorage.getItem('tradeontip_base_capital');
      if (saved && Number(saved) > 0 && saved !== '500000') return Number(saved);
    } catch {}
    return 0;
  });

  // Load broker charges CSV once on mount
  useEffect(() => {
    loadBrokerCharges().then(map => setChargesMap(map)).catch(() => setChargesMap({}));
  }, []);

  // Activate Google Drive auto-backup context when user is authenticated
  useEffect(() => {
    if (user?.uid && !user.uid.startsWith('demo-')) {
      if (accessToken) {
        setDriveContext(accessToken, activePortfolioId);
      } else {
        getValidAccessToken().then(tok => {
          if (tok) setDriveContext(tok, activePortfolioId);
        }).catch(() => {});
      }
    }
    const unsub = subscribeToTokenUpdate((newTok) => {
      if (newTok && user?.uid && !user.uid.startsWith('demo-')) {
        setDriveContext(newTok, activePortfolioId);
      }
    });
    return unsub;
  }, [accessToken, user?.uid, activePortfolioId]);

  useEffect(() => {
    const handleCapUpdate = (e) => {
      if (!e.detail?.portfolioId || e.detail?.portfolioId === activePortfolioId) {
        const newData = e.detail?.data || {};
        setCapitalChanges(newData);
        let newBase = 0;
        for (let m = 0; m < 12; m++) {
          const added = Number(newData[m]?.added || 0);
          if (added > 0) {
            newBase = added;
            break;
          }
        }
        setPortfolioCapital(newBase);
        localStorage.setItem('tradeontip_base_capital', String(newBase));
      }
    };
    window.addEventListener('tradeontip_capital_updated', handleCapUpdate);
    return () => window.removeEventListener('tradeontip_capital_updated', handleCapUpdate);
  }, [activePortfolioId]);

  const [themeMode, setThemeMode]       = useState(() => {
    try {
      return localStorage.getItem('tradeontip_theme') || 'light';
    } catch {
      return 'light';
    }
  }); // 'light' | 'dark' | 'pitch-black'
  const [dateRange, setDateRange]       = useState('All Time');
  const [tradingMarket, setTradingMarket] = useState(() => {
    try {
      const settingsSaved = localStorage.getItem('tradeontip_settings');
      if (settingsSaved) {
        const parsed = JSON.parse(settingsSaved);
        if (parsed.tradingMarket) return parsed.tradingMarket;
      }
      const saved = localStorage.getItem('tradeontip_trading_market');
      return saved || 'india';
    } catch {
      return 'india';
    }
  });

  useEffect(() => {
    const handleMarketChange = (e) => {
      if (e.detail?.market) {
        setTradingMarket(e.detail.market);
        setJournalSettings(prev => ({ ...prev, tradingMarket: e.detail.market }));
      }
    };
    window.addEventListener('tradeontip_market_changed', handleMarketChange);
    return () => window.removeEventListener('tradeontip_market_changed', handleMarketChange);
  }, []);
  const [outcomeFilter, setOutcomeFilter]       = useState(null);
  const [tradeTypeFilter, setTradeTypeFilter]   = useState(null);
  const [instrumentFilter, setInstrumentFilter] = useState('All Instruments');
  const [searchTerm, setSearchTerm]     = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [hideValues, setHideValues]     = useState(false);
  const [activeTab, setActiveTab]       = useState(() => {
    try {
      const path = window.location.pathname.replace(/^\//, '').toLowerCase();
      if (path === 'analytics') return 'analytics';
      if (path === 'playbook') return 'playbook';
      if (path === 'stock-charts' || path === 'charts') return 'stock-charts';
      if (path === 'tax-analytics' || path === 'tax') return 'tax-analytics';
      if (path === 'fund-management' || path === 'funds') return 'fund-management';
      if (path === 'deep-analytics' || path === 'deep') return 'deep-analytics';
      if (path === 'notes') return 'notes';
    } catch {}
    return 'journal';
  });
  const [selectedChartSymbol, setSelectedChartSymbol] = useState(null);
  const [deepDiveConfig, setDeepDiveConfig] = useState(null);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState(null);
  const [pageSize, setPageSize]         = useState(12);
  const [currentPage, setCurrentPage]   = useState(1);

  // Sync activeTab with URL and document.title
  useEffect(() => {
    const newPath = activeTab === 'journal' ? '/' : `/${activeTab}`;
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
    const tabTitles = {
      'journal': 'Journal',
      'analytics': 'Analytics',
      'stock-charts': 'Stock Charts',
      'symbol-deep-dive': 'Symbol Deep Dive',
      'playbook': 'Playbook',
      'tax-analytics': 'Tax Analytics',
      'fund-management': 'Fund Management',
      'fundManagement': 'Fund Management',
      'deep-analytics': 'Deep Analytics',
      'expiry-tracker': 'Expiry Tracker',
      'milestones': 'Milestones',
      'community': 'Community',
      'foxy-ai': 'Foxy AI',
      'foxy': 'Foxy AI',
      'ai-coach': 'Foxy AI',
      'notes': 'Notes'
    };
    const title = tabTitles[activeTab] || 'Journal';
    document.title = `${title} · FoxTrade`;
  }, [activeTab]);

  useEffect(() => {
    const handlePopState = () => {
      try {
        const path = window.location.pathname.replace(/^\//, '').toLowerCase();
        if (path === 'analytics') setActiveTab('analytics');
        else if (path === 'playbook') setActiveTab('playbook');
        else if (path === 'stock-charts' || path === 'charts') setActiveTab('stock-charts');
        else if (path === 'tax-analytics' || path === 'tax') setActiveTab('tax-analytics');
        else if (path === 'fund-management' || path === 'funds') setActiveTab('fund-management');
        else if (path === 'deep-analytics' || path === 'deep') setActiveTab('deep-analytics');
        else if (path === 'notes') setActiveTab('notes');
        else if (path === 'foxy' || path === 'foxy-ai' || path === 'ai-coach') setActiveTab('foxy-ai');
        else setActiveTab('journal');
      } catch {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Column Visibility & Ordering State (Controlled at Dashboard Level)
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const cached = localStorage.getItem('tradeontip_visible_cols_v5') || localStorage.getItem('tradeontip_visible_cols_v4');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const s = new Set(parsed);
          s.add('tsl');
          s.add('tslGroups');
          s.add('e4Price');
          s.add('e4Qty');
          s.add('e4Date');
          s.add('broker'); // Broker column visible by default
          return s;
        }
      }
    } catch {}
    return new Set(DEFAULT_VISIBLE_COL_IDS);
  });

  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const cached = localStorage.getItem('tradeontip_col_order_v5') || localStorage.getItem('tradeontip_col_order_v4');
      if (cached) {
        let parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!parsed.includes('tslGroups')) {
            const tslIdx = parsed.indexOf('tsl');
            if (tslIdx !== -1) parsed.splice(tslIdx + 1, 0, 'tslGroups');
            else parsed.push('tslGroups');
          }
          // Ensure broker is positioned directly after name
          parsed = parsed.filter(id => id !== 'broker');
          const nameIdx = parsed.indexOf('name');
          if (nameIdx !== -1) {
            parsed.splice(nameIdx + 1, 0, 'broker');
          } else {
            parsed.unshift('broker');
          }
          // Ensure E4 columns (e4Price, e4Qty, e4Date) are directly after e3Date
          const e4Cols = ['e4Price', 'e4Qty', 'e4Date'];
          parsed = parsed.filter(id => !e4Cols.includes(id));
          const e3DateIdx = parsed.indexOf('e3Date');
          if (e3DateIdx !== -1) {
            parsed.splice(e3DateIdx + 1, 0, ...e4Cols);
          } else {
            const e1DateIdx = parsed.indexOf('e1Date');
            if (e1DateIdx !== -1) parsed.splice(e1DateIdx + 1, 0, ...e4Cols);
            else parsed.push(...e4Cols);
          }
          return parsed;
        }
      }
    } catch {}
    return JOURNAL_COLUMNS.map(c => c.id);
  });

  // Persist visible columns & column order
  useEffect(() => {
    localStorage.setItem('tradeontip_visible_cols_v5', JSON.stringify(Array.from(visibleCols)));
  }, [visibleCols]);

  useEffect(() => {
    localStorage.setItem('tradeontip_col_order_v5', JSON.stringify(columnOrder));
  }, [columnOrder]);

  const handleToggleCol = (colId) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      window.dispatchEvent(new CustomEvent('tradeontip_columns_updated', { detail: Array.from(next) }));
      return next;
    });
  };

  const handleSelectAllCols = () => {
    setVisibleCols(new Set(JOURNAL_COLUMNS.map(c => c.id)));
  };

  const handleDeselectAllCols = () => {
    // Keep minimal core columns
    setVisibleCols(new Set(['tradeNo', 'name']));
  };

  const handleReorderCols = (newOrder) => {
    setColumnOrder(newOrder);
  };

  const handleOpenStockChart = (symbol) => {
    if (symbol) setSelectedChartSymbol(symbol.toUpperCase());
    setActiveTab('stock-charts');
  };

  const handleOpenDeepDive = (symbol, tradeNo, tradeId) => {
    setDeepDiveConfig({ symbol: symbol || 'WAAREEENER', tradeNo: tradeNo || null, tradeId: tradeId || null });
    setActiveTab('symbol-deep-dive');
  };

  // 1-Click Playbook Trade Auditor from Journal Table
  const [playbookAudits, setPlaybookAudits] = useState(() => loadTradeAudits());
  const [playbooksList, setPlaybooksList] = useState(() => loadPlaybooks());
  const [journalAuditingTrade, setJournalAuditingTrade] = useState(null);
  const [isJournalAuditModalOpen, setIsJournalAuditModalOpen] = useState(false);

  const handleOpenJournalAudit = React.useCallback((trade) => {
    setPlaybookAudits(loadTradeAudits());
    setPlaybooksList(loadPlaybooks());
    setJournalAuditingTrade(trade);
    setIsJournalAuditModalOpen(true);
  }, []);

  const handleSaveJournalAudit = React.useCallback((tradeId, auditData) => {
    setPlaybookAudits(prev => {
      const next = { ...prev, [tradeId]: auditData };
      saveTradeAudits(next, user);
      return next;
    });
  }, [user]);

  // Apply theme to body/root
  React.useEffect(() => {
    if (themeMode === 'light') {
      document.documentElement.removeAttribute('data-theme');
      document.body.removeAttribute('data-theme');
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    } else {
      document.documentElement.setAttribute('data-theme', themeMode);
      document.body.setAttribute('data-theme', themeMode);
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    }
    try {
      localStorage.setItem('tradeontip_theme', themeMode);
    } catch {}
  }, [themeMode]);

  // Load initialBaseCapital from Firestore
  useEffect(() => {
    if (user?.uid && !user.uid.startsWith('demo-')) {
      getDoc(doc(db, 'journals', user.uid)).then(d => {
        if (d.exists() && d.data().initialBaseCapital) {
          setPortfolioCapital(d.data().initialBaseCapital);
        }
      }).catch(() => {});
    }
  }, [user]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [isElectricityBillOpen, setIsElectricityBillOpen] = useState(false);
  const [editingTrade, setEditingTrade]     = useState(null);
  const [deletingTrade, setDeletingTrade]   = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTradeSettingsOpen, setIsTradeSettingsOpen] = useState(false);
  const [isBrokerImportOpen, setIsBrokerImportOpen] = useState(false);
  const [isBrokerConnectivityOpen, setIsBrokerConnectivityOpen] = useState(false);
  const [isChartGalleryOpen, setIsChartGalleryOpen] = useState(false);
  const [journalViewMode, setJournalViewMode] = useState('stats'); // 'stats' | 'portfolio' | 'grid' | 'notes'
  const [holdingsSortBy, setHoldingsSortBy]   = useState('pl'); // 'pl' | 'name' | 'allocation'
  const [journalSettings, setJournalSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('tradeontip_settings');
      const parsed = saved ? JSON.parse(saved) : {};
      if (!parsed.costBasisMethod) {
        parsed.costBasisMethod = 'fifo';
      }
      return parsed;
    } catch {
      return { costBasisMethod: 'fifo' };
    }
  });

  const handleUpdateSetting = (key, value) => {
    setJournalSettings(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('tradeontip_settings', JSON.stringify(updated));
      return updated;
    });
    if (key === 'tradingMarket') {
      setTradingMarket(value);
      try {
        localStorage.setItem('tradeontip_trading_market', value);
        window.dispatchEvent(new CustomEvent('tradeontip_market_changed', { detail: { market: value } }));
      } catch {}
    }
  };

  // ── Dynamic Typography & Scale Application (Matching Image 1) ─────────
  useEffect(() => {
    // 1. Font Family
    const fontChoice = journalSettings.fontFamily || 'default';
    let familyCss = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    if (fontChoice === 'soft') {
      familyCss = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    } else if (fontChoice === 'modern') {
      familyCss = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    } else if (fontChoice === 'classic') {
      familyCss = "'Lora', Georgia, serif";
    }
    document.documentElement.style.setProperty('--font-family', familyCss);
    document.body.style.fontFamily = familyCss;

    // 2. Font Weight
    const weightChoice = journalSettings.fontWeight || 'regular';
    if (weightChoice === 'light') {
      document.body.style.fontWeight = '300';
    } else if (weightChoice === 'medium') {
      document.body.style.fontWeight = '500';
    } else {
      document.body.style.fontWeight = '400';
    }

    // 3. Scale / Zoom
    const scaleVal = parseInt(journalSettings.scale || journalSettings.fontSize || 100, 10);
    if (!isNaN(scaleVal) && scaleVal >= 50 && scaleVal <= 150) {
      document.body.style.zoom = String(scaleVal / 100);
    }
  }, [journalSettings.fontFamily, journalSettings.fontWeight, journalSettings.scale, journalSettings.fontSize]);

  const handleExecuteClearAllData = async () => {
    try {
      // 1. Identify all keys to remove while strictly preserving user auth, portfolios, settings, and broker tokens
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        const isPreserved = 
          key === 'tradeontip_user' ||
          key === 'tradeontip_token' ||
          key === 'tradeontip_portfolios' ||
          key === 'tradeontip_active_portfolio_id' ||
          key === 'tradeontip_settings' ||
          key === 'tradeontip_visible_cols_v5' ||
          key === 'tradeontip_col_order_v5' ||
          key === 'tradeontip_visible_cols_v4' ||
          key === 'tradeontip_col_order_v4' ||
          key.startsWith('tradeontip_broker_') ||
          key.startsWith('tradeontip_dhan_') ||
          key.startsWith('tradeontip_zerodha_') ||
          key.startsWith('tradeontip_upstox_') ||
          key.startsWith('tradeontip_angel_') ||
          key.startsWith('tradeontip_fyers_') ||
          key.startsWith('tradeontip_groww_') ||
          key.startsWith('tradeontip_icici_');

        if (!isPreserved) {
          if (
            key.includes('trade') ||
            key.includes('monthly_capital') ||
            key.includes('base_capital') ||
            key.includes('notes') ||
            key.includes('tax') ||
            key.includes('cache') ||
            key.includes('notification') ||
            key.includes('foxtrade')
          ) {
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(k => localStorage.removeItem(k));

      // Explicitly store empty datasets so on reload it initializes completely empty
      if (user?.uid) {
        localStorage.setItem(`tradeontip_trades_v5_${user.uid}`, JSON.stringify([]));
      }
      localStorage.setItem('tradeontip_trades_v5', JSON.stringify([]));
      localStorage.setItem('tradeontip_trades_cache', JSON.stringify([]));
      localStorage.setItem('tradeontip_data_cleared', 'true');
      localStorage.setItem('tradeontip_monthly_capital_2026', JSON.stringify({}));
      localStorage.setItem(`tradeontip_monthly_capital_${activePortfolioId}_2026`, JSON.stringify({}));
      localStorage.setItem('tradeontip_base_capital', '0');
      localStorage.setItem('tradeontip_notes', JSON.stringify({}));
      localStorage.setItem('tradeontip_quick_notes', JSON.stringify([]));
      localStorage.removeItem('tradeontip_image_cache');
      localStorage.removeItem('tradeontip_stock_cache');
      localStorage.removeItem('tradeontip_stock_cache_ts');
      localStorage.removeItem('tradeontip_notifications');

      // 2. Clear Firestore if user is authenticated (safe catch so permission errors never block)
      if (user?.uid && !user.uid.startsWith('demo-')) {
        try {
          await setDoc(doc(db, 'journals', user.uid), {
            trades: [],
            notes: {},
            monthlyTaxes: {},
            lastUpdated: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        } catch (_) {}
      }

      // 3. Clear Google Drive backups if connected (purge & overwrite)
      const validDriveToken = accessToken || (await getValidAccessToken().catch(() => null));
      if (validDriveToken && validDriveToken !== 'demo-token') {
        await clearAllDriveBackups(validDriveToken).catch(err => console.warn('[Drive Clear Error]:', err));
        await uploadBackupToDrive(validDriveToken, [], activePortfolioId, true).catch(err => console.warn('[Drive Clear Error]:', err));
      }

      // 4. Clear IndexedDB local trade store
      await clearAllLocalTrades().catch(() => {});

      // 5. Clear active React states
      setTrades([]);
      setCapitalChanges({});
      setLiveCMPs({});
      setIsClearDataModalOpen(false);

      // Dispatch capital update event so other open tabs/components sync
      window.dispatchEvent(new CustomEvent('tradeontip_capital_updated', {
        detail: { portfolioId: activePortfolioId, year: '2026', data: {} }
      }));

      // 6. Show success toast notification
      setToastNotification({
        type: 'success',
        title: 'All Data Cleared',
        description: 'Trading journal, tax, fund management, and notes data have been reset.'
      });

      // 7. Cleanly reload to re-initialize clean default state
      setTimeout(() => {
        window.location.reload();
      }, 400);
    } catch (err) {
      console.error('Error clearing data:', err);
      throw err;
    }
  };

  const [trades, setTrades] = useState(() => {
    try {
      const userTradesKey = user?.uid ? `tradeontip_trades_v5_${user.uid}` : 'tradeontip_trades_v5';
      const cached = localStorage.getItem(userTradesKey);
      if (cached !== null) {
        let parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          // Clean up multiple duplicate empty rows accumulated from previous broken clicks
          const emptyIndices = [];
          parsed.forEach((t, i) => {
            if (!(t.name || t.symbol || '').trim() && !t.entry && !t.qty) {
              emptyIndices.push(i);
            }
          });
          if (emptyIndices.length > 1) {
            parsed = parsed.filter(t => Boolean((t.name || t.symbol || '').trim() || t.entry > 0 || t.qty > 0));
            try {
              localStorage.setItem(userTradesKey, JSON.stringify(parsed));
            } catch (_) {}
          }

          const seen = new Set();
          let needsRepair = false;
          parsed.forEach(t => {
            const pId = t.portfolioId || 'portfolio-default';
            const key = `${pId}-${t.tradeNo}`;
            if (!t.tradeNo || seen.has(key)) needsRepair = true;
            seen.add(key);
          });
          if (needsRepair) {
            const portfolioCounters = {};
            return parsed.map(t => {
              const pId = t.portfolioId || 'portfolio-default';
              if (!portfolioCounters[pId]) portfolioCounters[pId] = 1;
              const tradeNo = portfolioCounters[pId]++;
              return { ...t, tradeNo };
            });
          }
          return parsed;
        }
      }
      // Any new user starts completely fresh with a clean empty journal (0 trades)
      return [];
    } catch {
      return [];
    }
  });

  // Switch trades cleanly when user account changes
  useEffect(() => {
    if (!user?.uid) return;
    const userTradesKey = `tradeontip_trades_v5_${user.uid}`;
    const cached = localStorage.getItem(userTradesKey) || localStorage.getItem('tradeontip_trades_cache');
    if (cached !== null) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTrades(parsed);
          return;
        }
      } catch (_) {}
    }
  }, [user?.uid]);

  // Persist trades to cache whenever modified, scoped to the current user
  useEffect(() => {
    try {
      const userTradesKey = user?.uid ? `tradeontip_trades_v5_${user.uid}` : 'tradeontip_trades_v5';
      localStorage.setItem(userTradesKey, JSON.stringify(trades));
    } catch (_) {}
  }, [trades, user?.uid]);

  const [loadingTrades, setLoadingTrades] = useState(() => {
    try {
      const userTradesKey = user?.uid ? `tradeontip_trades_v5_${user.uid}` : 'tradeontip_trades_v5';
      const cached = localStorage.getItem(userTradesKey) || localStorage.getItem('tradeontip_trades_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return false;
      }
    } catch (_) {}
    return true;
  });
  const accessTokenRef = useRef(accessToken);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);
  const [liveCMPs, setLiveCMPs] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('tradeontip_settings');
      const parsedSettings = savedSettings ? JSON.parse(savedSettings) : {};
      if (parsedSettings.liveCmpEnabled === false) {
        return {};
      }
      const cached = sessionStorage.getItem('tradeontip_live_cmps');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Shared sync and warning states
  const [autoBackup, setAutoBackup] = useState(() => {
    try {
      const val = localStorage.getItem('tradeontip_auto_backup');
      return val !== 'false';
    } catch {
      return true;
    }
  });

  const [backupWarning, setBackupWarning] = useState(false);
  const autoBackupFirstRenderRef = useRef(true);

  // Sync preference changes and 2-minute recurring reminder if auto-backup is disabled
  useEffect(() => {
    localStorage.setItem('tradeontip_auto_backup', autoBackup);

    if (autoBackup) {
      if (!autoBackupFirstRenderRef.current) {
        setToastNotification({
          id: Date.now(),
          title: 'Auto Backup Enabled',
          description: 'Auto backup is now active. Your trades will be automatically saved to Google Drive.',
          type: 'success'
        });
      }
      autoBackupFirstRenderRef.current = false;
      return;
    }

    const showAutoBackupOffToast = (isExplicitToggle = false) => {
      setToastNotification({
        id: Date.now(),
        title: isExplicitToggle ? 'Auto Backup Disabled' : 'Auto Backup is Off',
        description: 'Auto backup is currently turned off. Your trades are not being automatically saved to Google Drive.',
        type: 'warning'
      });
    };

    let mountTimeout = null;
    if (autoBackupFirstRenderRef.current) {
      // First mount with auto-backup disabled: notify user after a 1.5s delay
      mountTimeout = setTimeout(() => {
        showAutoBackupOffToast(false);
      }, 1500);
    } else {
      // User explicitly toggled it off in UI
      showAutoBackupOffToast(true);
    }
    autoBackupFirstRenderRef.current = false;

    // Recurring notification every 2 minutes (120,000 ms) while autoBackup is off
    const intervalId = setInterval(() => {
      showAutoBackupOffToast(false);
    }, 2 * 60 * 1000);

    return () => {
      if (mountTimeout) clearTimeout(mountTimeout);
      clearInterval(intervalId);
    };
  }, [autoBackup]);

  // Persistence — load trades on mount & subscribe to real-time updates
  useEffect(() => {
    if (!user?.uid) { setLoadingTrades(false); return; }

    let isMounted = true;
    const userTradesKey = `tradeontip_trades_v5_${user.uid}`;

    // 1. Check local cache first for instant UI response (stale-while-revalidate)
    const cached = localStorage.getItem(userTradesKey) || localStorage.getItem('tradeontip_trades_cache');
    let hasCachedTrades = false;
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          hasCachedTrades = true;
          setTrades(prev => (prev && prev.length > 0 ? prev : parsed));
        }
      } catch (_) {}
    }

    // Only set loading to true if we don't already have trades in cache or state
    if (!hasCachedTrades && (!trades || trades.length === 0)) {
      setLoadingTrades(true);
    }

    // 2. Load from IndexedDB (or fallback migration / cloud restore)
    getUserTrades(user.uid, activePortfolioId)
      .then(async (dbTrades) => {
        if (!isMounted) return;
        if (Array.isArray(dbTrades) && dbTrades.length > 0) {
          setTrades(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(dbTrades)) {
              return dbTrades;
            }
            return prev;
          });
          try {
            localStorage.setItem(userTradesKey, JSON.stringify(dbTrades));
            localStorage.setItem('tradeontip_trades_cache', JSON.stringify(dbTrades));
          } catch (_) {}
        } else if (accessTokenRef.current) {
          // If local IDB was empty, check Google Drive backup directly
          try {
            const driveTrades = await downloadBackupFromDrive(accessTokenRef.current, activePortfolioId);
            if (isMounted && Array.isArray(driveTrades) && driveTrades.length > 0) {
              setTrades(driveTrades);
              try {
                localStorage.setItem(userTradesKey, JSON.stringify(driveTrades));
                localStorage.setItem('tradeontip_trades_cache', JSON.stringify(driveTrades));
              } catch (_) {}
              await saveUserTrades(user.uid, driveTrades, activePortfolioId);
            }
          } catch (err) {
            console.warn('[Google Drive Mount Load Error]:', err);
          }
        }
      })
      .catch(err => console.warn('[Trade Load Error]:', err))
      .finally(() => {
        if (isMounted) setLoadingTrades(false);
      });

    // 3. Subscribe to real-time merge updates
    const unsubscribe = subscribeToUserTrades(user.uid, (remoteTrades) => {
      if (!isMounted) return;
      setTrades(prevTrades => {
        if (JSON.stringify(remoteTrades) !== JSON.stringify(prevTrades)) {
          return remoteTrades;
        }
        return prevTrades;
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user?.uid, activePortfolioId]);

  // Save trades to IndexedDB & Local Cache & Cloud whenever trades change
  const lastSavedTradesJsonRef = useRef('');
  useEffect(() => {
    // CRITICAL GUARD: Never save while initial loading is in progress or user not logged in!
    if (loadingTrades || !user?.uid) return;

    const currentJson = JSON.stringify(trades);
    if (!lastSavedTradesJsonRef.current) {
      // First mount or initial load finish: latch current state without redundant re-saving
      lastSavedTradesJsonRef.current = currentJson;
      return;
    }

    if (currentJson === lastSavedTradesJsonRef.current) {
      // Data hasn't actually changed — skip redundant writes and Drive sync
      return;
    }

    lastSavedTradesJsonRef.current = currentJson;
    // Instant save to IndexedDB and Local Cache (also automatically triggers debounced Drive auto-sync)
    saveUserTrades(user.uid, trades, activePortfolioId);
  }, [trades, loadingTrades, user?.uid, activePortfolioId]);

  // Listen for restored settings from Cloud backup
  useEffect(() => {
    const handleSettingsUpdate = (e) => {
      if (e.detail && typeof e.detail === 'object') {
        setJournalSettings(prev => ({ ...prev, ...e.detail }));
      }
    };
    window.addEventListener('tradeontip_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('tradeontip_settings_updated', handleSettingsUpdate);
  }, []);

  // Listen for restored columns & column order from Cloud backup
  useEffect(() => {
    const handleColsUpdated = (e) => {
      if (Array.isArray(e.detail) && e.detail.length > 0) {
        setVisibleCols(new Set(e.detail));
      }
      try {
        const orderRaw = localStorage.getItem('tradeontip_col_order_v5');
        if (orderRaw) {
          const parsed = JSON.parse(orderRaw);
          if (Array.isArray(parsed) && parsed.length > 0) setColumnOrder(parsed);
        }
      } catch {}
    };
    window.addEventListener('tradeontip_columns_updated', handleColsUpdated);
    return () => window.removeEventListener('tradeontip_columns_updated', handleColsUpdated);
  }, []);

  // Auto-resolve missing CMP for open trades that have a symbol but cmp is 0
  const resolvedMissingCmpRef = useRef(new Set());
  useEffect(() => {
    if (!trades || trades.length === 0) return;
    const tradesMissingCmp = trades.filter(t => 
      (t.status === 'Open' || t.status === 'Partial') && 
      (!t.cmp || Number(t.cmp) === 0) && 
      (t.name || t.symbol) && 
      !resolvedMissingCmpRef.current.has(`${t.id || t.tradeNo}-${t.name || t.symbol}`)
    );
    if (tradesMissingCmp.length === 0) return;

    tradesMissingCmp.forEach(async (t) => {
      const sym = (t.name || t.symbol || '').trim();
      const key = `${t.id || t.tradeNo}-${sym}`;
      resolvedMissingCmpRef.current.add(key);
      try {
        const res = await fetchLiveCMPForSymbol(sym);
        const p = typeof res === 'number' ? res : (res?.cmp || res?.price || 0);
        if (p > 0) {
          setTrades(latest => latest.map(item => {
            const matches = (t.id && item.id === t.id) || (t.tradeNo && item.tradeNo === t.tradeNo);
            if (matches && (!item.cmp || Number(item.cmp) === 0)) {
              return enrichTradeWithLegs({ ...item, cmp: p });
            }
            return item;
          }));
        }
      } catch (_) {}
    });
  }, [trades]);

  // Memoize symbols to stream live quotes (prioritize open/partial positions to avoid rate limits)
  const watchedSymbolsStr = useMemo(() => {
    const openSet = new Set();
    (trades || []).forEach(t => {
      if (t.status === 'Open' || (t.status === 'Partial' && Number(t.openQty) > 0)) {
        const sym = (t.name || t.symbol || '').trim();
        if (sym) openSet.add(sym);
      }
    });
    if (openSet.size === 0) {
      (trades || []).slice(0, 15).forEach(t => {
        const sym = (t.name || t.symbol || '').trim();
        if (sym) openSet.add(sym);
      });
    }
    return Array.from(openSet).sort().join(',');
  }, [trades]);

  // Real-time Live Market Data Feed & WebSocket Engine for NSE
  useEffect(() => {
    const isLiveCmp = journalSettings.liveCmpEnabled !== false;
    if (!watchedSymbolsStr || !isLiveCmp) {
      liveMarketFeed.stop();
      return;
    }

    const symbols = watchedSymbolsStr.split(',').filter(Boolean);
    liveMarketFeed.setWatchedSymbols(symbols);
    liveMarketFeed.start();

    const unsubscribe = liveMarketFeed.subscribe((prices) => {
      setLiveCMPs(prev => {
        const next = { ...prev };
        let changed = false;
        Object.entries(prices).forEach(([sym, info]) => {
          const upper = sym.toUpperCase();
          if (next[upper] !== info.price) {
            next[upper] = info.price;
            changed = true;
          }
        });
        if (changed) {
          try {
            sessionStorage.setItem('tradeontip_live_cmps', JSON.stringify(next));
          } catch (_) {}
          return next;
        }
        return prev;
      });
    });

    return () => {
      unsubscribe();
      liveMarketFeed.stop();
    };
  }, [watchedSymbolsStr, journalSettings.liveCmpEnabled]);

  // File Ref for CSV Import
  const fileInputRef = useRef(null);

  // ── Helper to calculate and enrich trade with exact FoxTrade formulas ────────
  const enrichTradeWithLegs = (t) => {
    const PORTFOLIO_CAPITAL = portfolioCapital || 0;
    const initialFundCapital = (() => {
      try {
        const changes = capitalChanges || {};
        for (let m = 0; m < 12; m++) {
          const added = Number(changes[m]?.added || 0);
          if (added > 0) return added;
        }
      } catch {}
      return 0;
    })();
    const tradeAlloc = Number(t?.totalCapitalAllocated || 0);
    const BASE_CAPITAL = initialFundCapital > 0 
      ? initialFundCapital 
      : (PORTFOLIO_CAPITAL > 0 ? PORTFOLIO_CAPITAL : (tradeAlloc > 0 ? tradeAlloc : 200000));

    const isLiveCmp = journalSettings.liveCmpEnabled !== false;

    const tradeCapital = getCapital({
      baseCapital: BASE_CAPITAL,
      trades: portfolioTrades,
      capitalChanges,
      portfolioId: activePortfolioId
    });

    return enrichTradeWithFoxFormulas(t, tradeCapital, {
      liveCMPs: isLiveCmp ? liveCMPs : {},
      costBasisMethod: journalSettings.costBasisMethod || 'fifo',
      getCharges: (broker, segment, entryTurnover, exitTurnover, exitedQty) =>
        calculateCharges(broker, segment, entryTurnover, exitTurnover, exitedQty, chargesMap || {})
    });
  };

  // ── Computed metrics ────────────────────────────────────────────────────────
  // All formulas verified exactly for FoxTrade calculations
  // Filter trades for the currently active portfolio
  const portfolioTrades = useMemo(() => {
    return trades.filter(t => (t.portfolioId || 'portfolio-default') === activePortfolioId);
  }, [trades, activePortfolioId]);

  const monthlyPerf = useMemo(() => {
    return calculateMonthlyPerformance(portfolioTrades, capitalChanges, '2026', {
      costBasisMethod: journalSettings.costBasisMethod || 'lifo'
    });
  }, [portfolioTrades, capitalChanges, journalSettings.costBasisMethod]);

  const enrichedTrades = useMemo(() => {
    return portfolioTrades.map(t => enrichTradeWithLegs(t));
  }, [portfolioTrades, monthlyPerf, liveCMPs, capitalChanges, portfolioCapital, chargesMap, journalSettings.costBasisMethod, journalSettings.liveCmpEnabled]);

  // ── 1. Welcome Notification for New User Sign Up / First Visit ───────────
  useEffect(() => {
    if (!user?.uid) return;
    const welcomeStorageKey = `tradeontip_welcome_shown_${user.uid}`;
    const alreadyShown = localStorage.getItem(welcomeStorageKey);

    if (!alreadyShown) {
      localStorage.setItem(welcomeStorageKey, 'true');
      const timer = setTimeout(() => {
        notificationManager.dispatch({
          title: 'Welcome to FoxTrade!',
          message: `Welcome, ${user.name || 'Trader'}! Your trading journal is ready. Start logging trades or import your broker contract notes.`,
          type: 'admin'
        });
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [user?.uid, user?.name]);

  // ── 2. Real-Time Stop-Loss (SL & TSL) Breach Watcher ───────────────────────
  const notifiedSlTradesRef = useRef(new Set());
  const isInitialSlMountRef = useRef(true);

  useEffect(() => {
    if (!enrichedTrades || enrichedTrades.length === 0) return;

    // During initial mount (first 2.5 seconds), latch any open positions that are already at/below SL
    // to avoid an alert flood on page load/reload.
    if (isInitialSlMountRef.current) {
      enrichedTrades.forEach(t => {
        if (t.status === 'Closed' || Number(t.openQty || 0) <= 0) return;
        const activeSl = Number(t.tsl) > 0 ? Number(t.tsl) : Number(t.sl);
        const currentCmp = Number(t.cmp);
        if (activeSl > 0 && currentCmp > 0) {
          const isBuy = String(t.side || t.type || 'Buy').toLowerCase() === 'buy';
          const isBreached = isBuy ? currentCmp <= activeSl : currentCmp >= activeSl;
          if (isBreached) {
            notifiedSlTradesRef.current.add(`sl_${t.id || t.tradeNo}_${activeSl}`);
          }
        }
      });
      const timer = setTimeout(() => {
        isInitialSlMountRef.current = false;
      }, 2500);
      return () => clearTimeout(timer);
    }

    // Live monitoring: evaluate each open position against current CMP
    enrichedTrades.forEach(t => {
      if (t.status === 'Closed' || Number(t.openQty || 0) <= 0) return;

      const activeSl = Number(t.tsl) > 0 ? Number(t.tsl) : Number(t.sl);
      const currentCmp = Number(t.cmp);
      if (!activeSl || activeSl <= 0 || !currentCmp || currentCmp <= 0) return;

      const isBuy = String(t.side || t.type || 'Buy').toLowerCase() === 'buy';
      const isBreached = isBuy ? currentCmp <= activeSl : currentCmp >= activeSl;
      const alertKey = `sl_${t.id || t.tradeNo}_${activeSl}`;

      if (isBreached) {
        if (!notifiedSlTradesRef.current.has(alertKey)) {
          notifiedSlTradesRef.current.add(alertKey);

          const sym = t.name || t.symbol || 'Stock';
          notificationManager.dispatch({
            title: `Stop Loss Hit: ${sym}`,
            message: `${sym} CMP ₹${currentCmp.toLocaleString('en-IN', { minimumFractionDigits: 2 })} has hit your SL of ₹${activeSl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Open Qty: ${t.openQty}.`,
            type: 'sl',
            meta: { tradeId: t.id, symbol: sym, cmp: currentCmp, sl: activeSl }
          });
        }
      } else {
        // Hysteresis buffer: if price moves well back away from SL (+1.5%), allow re-alerting if it breaches again later
        const buffer = activeSl * 0.015;
        const isWellClear = isBuy ? currentCmp > activeSl + buffer : currentCmp < activeSl - buffer;
        if (isWellClear && notifiedSlTradesRef.current.has(alertKey)) {
          notifiedSlTradesRef.current.delete(alertKey);
        }
      }
    });
  }, [enrichedTrades]);

  // ── Date range resolver — maps dateRange value → { from, to } or { lastX: N } or null ──
  const resolvedDateFilter = useMemo(() => {
    if (!dateRange || dateRange === 'All Time') return null;

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (dateRange === 'Past 1 Week') {
      const from = new Date(today); from.setDate(from.getDate() - 7); from.setHours(0, 0, 0, 0);
      return { from, to: today };
    }
    if (dateRange === 'Past 1 Month') {
      const from = new Date(today); from.setMonth(from.getMonth() - 1); from.setHours(0, 0, 0, 0);
      return { from, to: today };
    }
    if (dateRange === 'This CY') {
      return { from: new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0), to: new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999) };
    }
    if (dateRange === 'Pick This FY' || dateRange === 'This FY') {
      // Indian FY: Apr 1 of current or previous year → Mar 31 of next year
      const yr = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      return { from: new Date(yr, 3, 1, 0, 0, 0, 0), to: new Date(yr + 1, 2, 31, 23, 59, 59, 999) };
    }
    // Structured object set by picker sub-menus
    if (typeof dateRange === 'object') {
      if (dateRange.type === 'lastX') return { lastX: parseInt(dateRange.count, 10) || 10 };
      if (dateRange.type === 'month') {
        const m = dateRange.month !== undefined ? dateRange.month : today.getMonth();
        const y = dateRange.year || today.getFullYear();
        return {
          from: new Date(y, m, 1, 0, 0, 0, 0),
          to: new Date(y, m + 1, 0, 23, 59, 59, 999)
        };
      }
      if (dateRange.type === 'quarter') {
        const q = dateRange.q || 1;
        const fy = dateRange.fy || (today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1);
        let startMonth = 3, endMonth = 5, yr = fy;
        if (q === 'Q1' || q === 1) { startMonth = 3; endMonth = 5; yr = fy; }
        else if (q === 'Q2' || q === 2) { startMonth = 6; endMonth = 8; yr = fy; }
        else if (q === 'Q3' || q === 3) { startMonth = 9; endMonth = 11; yr = fy; }
        else if (q === 'Q4' || q === 4) { startMonth = 0; endMonth = 2; yr = fy + 1; }
        return {
          from: new Date(yr, startMonth, 1, 0, 0, 0, 0),
          to: new Date(yr, endMonth + 1, 0, 23, 59, 59, 999)
        };
      }
      if (dateRange.from && dateRange.to) {
        const from = parseDateToLocalDate(dateRange.from);
        const to = parseDateToLocalDate(dateRange.to);
        if (from) from.setHours(0, 0, 0, 0);
        if (to) to.setHours(23, 59, 59, 999);
        if (from && to) return { from, to };
      }
    }
    return null;
  }, [dateRange]);

  const filteredTrades = useMemo(() => {
    const enriched = portfolioTrades.map(t => enrichTradeWithLegs(t));

    // Apply search + status + instrument + outcome + tradeType filters
    const lowerSearch = (searchTerm || '').toLowerCase().trim();
    const canonicalSearch = lowerSearch ? getCanonicalSymbol(lowerSearch).toLowerCase() : '';

    const afterSearchStatus = enriched.filter(t => {
      // Always show empty/draft rows so active filters or search don't hide the row the user just added
      const isDraftEmptyRow = !(t.name || t.symbol || '').trim() && !t.entry && !t.qty;
      if (isDraftEmptyRow) return true;

      let matchSearch = true;
      if (lowerSearch) {
        const tSym = (t.symbol || '').toLowerCase();
        const tCanonical = getCanonicalSymbol(t.symbol || '').toLowerCase();
        const tName = (t.name || '').toLowerCase();
        const tSetup = (t.setup || '').toLowerCase();
        const tEntryType = (t.entryType || '').toLowerCase();
        const ca = getCorporateActionDetails(t.symbol);
        const aliasMatch = ca && (
          (ca.legacySymbol && ca.legacySymbol.toLowerCase().includes(lowerSearch)) ||
          (ca.searchKeywords && ca.searchKeywords.some(kw => kw.includes(lowerSearch) || lowerSearch.includes(kw)))
        );

        matchSearch =
          tName.includes(lowerSearch) ||
          tSym.includes(lowerSearch) ||
          (canonicalSearch && (tSym.includes(canonicalSearch) || tCanonical.includes(canonicalSearch))) ||
          tSetup.includes(lowerSearch) ||
          tEntryType.includes(lowerSearch) ||
          Boolean(aliasMatch);
      }

      if (!matchSearch) return false;

      // 1. Status Filter
      const tradeStatus = t.status || (t.openQty > 0 ? (t.exitedQty > 0 ? 'Partial' : 'Open') : 'Closed');
      if (statusFilter === 'Active' || statusFilter === 'Active (Open + Partial)') {
        if (!(tradeStatus === 'Open' || tradeStatus === 'Partial')) return false;
      } else if (statusFilter === 'Open') {
        if (tradeStatus !== 'Open') return false;
      } else if (statusFilter === 'Partial') {
        if (tradeStatus !== 'Partial') return false;
      } else if (statusFilter === 'Closed') {
        if (tradeStatus !== 'Closed') return false;
      }

      // 2. Instrument Filter
      if (instrumentFilter && instrumentFilter !== 'All Instruments' && instrumentFilter !== 'All') {
        const sym = String(t.symbol || t.name || '').toUpperCase().trim();
        const isEtf = sym.endsWith('BEES') || sym.includes('ETF') || sym.includes('NIFTYBEES') || sym.includes('GOLDBEES') || sym.includes('BANKBEES') || sym.includes('JUNIORBEES') || sym.includes('LIQUIDBEES') || sym.includes('MON100');
        if (instrumentFilter === 'EQUITY (No ETFs)') {
          if (isEtf) return false;
        } else if (instrumentFilter === 'Equity+ETF (Cash)') {
          const inst = String(t.instrument || t.segment || '').toLowerCase();
          if (inst.includes('fut') || inst.includes('opt')) return false;
        }
      }

      // 3. Outcome Filter
      if (outcomeFilter && outcomeFilter !== 'All Outcomes' && outcomeFilter !== 'All') {
        const pnlVal = parseFloat(t.grossPnl !== undefined && t.grossPnl !== null ? t.grossPnl : (t.pnl || t.realisedAmount || 0)) || 0;
        if (outcomeFilter === 'Winners') {
          if (pnlVal <= 0.0001) return false;
        } else if (outcomeFilter === 'Losers') {
          if (pnlVal >= -0.0001) return false;
        } else if (outcomeFilter === 'Breakeven') {
          if (Math.abs(pnlVal) > 0.0001) return false;
        }
      }

      // 4. Trade Type Filter
      if (tradeTypeFilter && tradeTypeFilter !== 'All Types' && tradeTypeFilter !== 'All') {
        const typeStr = String(t.tradeType || t.type || '').toLowerCase();
        const isExplicitIntraday = typeStr.includes('intraday');
        const hDays = t.holdingDays !== undefined && t.holdingDays !== null ? String(t.holdingDays) : '';
        const isZeroDays = hDays === '0' || hDays === '0 days' || hDays === 0;
        const entryD = (t.date || t.entryDate || '').trim();
        const exitD = (t.exitDate || t.e1Date || '').trim();
        const sameDate = entryD && exitD && entryD === exitD;
        const isIntraday = isExplicitIntraday || isZeroDays || sameDate;
        if (tradeTypeFilter === 'Intraday' && !isIntraday) return false;
        if (tradeTypeFilter === 'Delivery' && isIntraday) return false;
      }

      return true;
    });

    // 5. Date range filter
    if (!resolvedDateFilter) return afterSearchStatus;

    if (resolvedDateFilter.lastX) {
      return [...afterSearchStatus]
        .sort((a, b) => {
          const tA = parseDateToLocalDate(a.e1Date || a.exitDate || a.date || a.entryDate)?.getTime() || 0;
          const tB = parseDateToLocalDate(b.e1Date || b.exitDate || b.date || b.entryDate)?.getTime() || 0;
          return tB - tA;
        })
        .slice(0, resolvedDateFilter.lastX);
    }

    const { from, to } = resolvedDateFilter;
    return afterSearchStatus.filter(t => {
      const isDraftEmptyRow = !(t.name || t.symbol || '').trim() && !t.entry && !t.qty;
      if (isDraftEmptyRow) return true;

      const dateCandidates = [
        t.exitDate, t.e4Date, t.e3Date, t.e2Date, t.e1Date,
        t.exit4Date, t.exit3Date, t.exit2Date, t.exit1Date,
        t.date, t.entryDate,
        t.p1Date, t.p2Date, t.p3Date, t.p4Date,
        t.pyramid1Date, t.pyramid2Date, t.pyramid3Date, t.pyramid4Date
      ].filter(Boolean);

      if (dateCandidates.length === 0) return true;

      return dateCandidates.some(cand => {
        const d = parseDateToLocalDate(cand);
        return d && d >= from && d <= to;
      });
    });
  }, [portfolioTrades, searchTerm, statusFilter, instrumentFilter, outcomeFilter, tradeTypeFilter, liveCMPs, resolvedDateFilter, journalSettings.liveCmpEnabled]);

  const validFilteredTrades = useMemo(() => {
    return filteredTrades.filter(t => (t.name || t.symbol || '').trim() || t.entry || t.qty);
  }, [filteredTrades]);

  const tradesWithCumm = useMemo(() => {
    let cumm = 0;
    return filteredTrades.map((t, idx) => {
      cumm += (t.pfImpact || 0);
      const cummPf = (t.cummPf !== undefined && t.cummPf !== null && t.cummPf !== 0) ? t.cummPf : cumm;
      const tradeNo = t.tradeNo || (idx + 1);
      return { ...t, tradeNo, cummPf };
    });
  }, [filteredTrades]);

  const flaggedDateTrades = useMemo(() => {
    return (tradesWithCumm || []).filter(t =>
      t.flags && t.flags.some(f => f === 'EXIT_BEFORE_ENTRY' || f === 'FUTURE_DATE')
    );
  }, [tradesWithCumm]);

  const flaggedDateTradesNetPaise = useMemo(() => {
    return flaggedDateTrades.reduce((sum, t) => sum + (t.netPaise ?? t.grossPaise ?? 0), 0);
  }, [flaggedDateTrades]);

  useEffect(() => {
    const handleOpenReview = () => setIsReviewFlaggedOpen(true);
    window.addEventListener('foxtrade_open_review_flagged', handleOpenReview);
    return () => window.removeEventListener('foxtrade_open_review_flagged', handleOpenReview);
  }, []);

  useEffect(() => {
    if (flaggedDateTrades.length > 0) {
      const alreadyNotified = sessionStorage.getItem('foxtrade_notified_date_flags_count');
      if (alreadyNotified !== String(flaggedDateTrades.length)) {
        sessionStorage.setItem('foxtrade_notified_date_flags_count', String(flaggedDateTrades.length));
        notificationManager.dispatch({
          id: 'date-issues-alert',
          title: `${flaggedDateTrades.length} Trades Require Date Review`,
          message: `Inverted or future dates detected. Realized P&L is 100% computed from execution prices. Click to review.`,
          type: 'alert',
          action: 'review_flagged'
        });
      }
    }
  }, [flaggedDateTrades.length]);

  const metrics = useMemo(() => {
    const enriched = validFilteredTrades;
    const totalTrades   = enriched.length;
    const openTrades    = enriched.filter(t => t.status !== 'Closed' && (t.openQty || 0) > 0);
    const openPositions = openTrades.length;

    const closedTrades  = enriched.filter(t => t.status === 'Closed');
    const wins          = closedTrades.filter(t => (t.pnl || 0) > 0).length;

    // ── Win Rate: Exclude 0 P/L (breakeven) trades matching FoxTrade P/L Method ──
    const decidedTrades = closedTrades.filter(t => (t.pnl || 0) !== 0);
    const winRate = decidedTrades.length > 0
      ? ((wins / decidedTrades.length) * 100).toFixed(2)
      : '0.00';

    // ── Gross Realized P/L: sum of closed and partial trades via integer paise ──
    const grossRealizedPaise = enriched.reduce((acc, t) => {
      if (t.status === 'Closed' || t.status === 'Partial') {
        return acc + toPaise(t.pnl ?? t.pl);
      }
      return acc;
    }, 0);
    const grossRealizedPL = fromPaise(grossRealizedPaise);

    // ── Unrealized P/L: sum of open/partial trade unrealized via integer paise ──
    const unrealizedPaise = openTrades.reduce((acc, t) => acc + toPaise(t.unrealized), 0);
    const unrealizedPL = fromPaise(unrealizedPaise);

    // ── Total Invested (₹): sum of (avgEntry * openQty) for open positions ─────
    const totalInvested = openTrades.reduce(
      (acc, t) => acc + (t.avgEntry || t.entry || 0) * (t.openQty || 0),
      0
    );

    // Dynamic base fund capital — reads from Fund Management capital entries.
    // Finds the first month with added capital in the active portfolio.
    // This creates a live connection: Fund Management edit → stat cards update instantly.
    const baseFundCapital = (() => {
      try {
        if (capitalChanges && typeof capitalChanges === 'object') {
          for (let m = 0; m < 12; m++) {
            const added = Number(capitalChanges[m]?.added || 0);
            if (added > 0) return added;
          }
        }
      } catch {}
      if (portfolioCapital > 0) return portfolioCapital;
      const tradeWithAlloc = portfolioTrades.find(t => Number(t.totalCapitalAllocated) > 0);
      if (tradeWithAlloc) return Number(tradeWithAlloc.totalCapitalAllocated);
      return 200000;
    })();

    // Current portfolio capital using shared getCapital formula:
    // Capital = Base Capital + Deposits - Withdrawals + Realized P&L (up to today)
    const currentPfCapital = getCapital({
      baseCapital: baseFundCapital,
      trades: portfolioTrades,
      capitalChanges,
      portfolioId: activePortfolioId
    });

    // ── Unrealized P/L % of portfolio ─────────────────────────────────────────
    const unrealizedPLPct = currentPfCapital > 0
      ? ((unrealizedPL / currentPfCapital) * 100).toFixed(2)
      : '0.00';

    // ── % Invested: sum of open position values / currentPfCapital * 100 ──────
    const percentInvested = currentPfCapital > 0
      ? ((totalInvested / currentPfCapital) * 100).toFixed(2)
      : '0.00';

    // ── Capital at Risk: Multi-Leg & Pyramid Initial downside risk on open positions ─────────────
    const totalRisk = openTrades.reduce((acc, t) => {
      if (t.riskAmount !== undefined && t.riskAmount !== null && !isNaN(Number(t.riskAmount))) {
        return acc + Number(t.riskAmount);
      }
      const isSell = (t.type || 'Buy').toLowerCase() === 'sell';
      const tsl = parseFloat(t.tsl) || 0;
      const entryPrice = parseFloat(t.entry) || parseFloat(t.avgEntry) || 0;
      if (entryPrice <= 0) return acc;

      const initialSL = (t.sl !== undefined && t.sl !== null && t.sl !== '' && !isNaN(parseFloat(t.sl)) && parseFloat(t.sl) > 0) ? parseFloat(t.sl) : null;
      const remainingQty = (t.openQty !== undefined && t.openQty !== null && !isNaN(parseFloat(t.openQty)))
        ? parseFloat(t.openQty)
        : (parseFloat(t.qty) || 0);

      if (remainingQty <= 0) return acc;

      if (!isSell) {
        if (tsl >= entryPrice) return acc;
        if (initialSL !== null && entryPrice > initialSL) {
          return acc + (entryPrice - initialSL) * remainingQty;
        }
      } else {
        if (tsl > 0 && tsl <= entryPrice) return acc;
        if (initialSL !== null && initialSL > entryPrice) {
          return acc + (initialSL - entryPrice) * remainingQty;
        }
      }
      return acc;
    }, 0);

    const riskDenominator = currentPfCapital > 0 ? currentPfCapital : (baseFundCapital > 0 ? baseFundCapital : 0);
    const capitalAtRiskPct = riskDenominator > 0
      ? ((totalRisk / riskDenominator) * 100).toFixed(2)
      : '0.00';

    // ── Profit Risk %: Unrealized open profit that could be lost if stopped out ──
    // Formula: sum of max(0, (CMP - effectiveStop) × openQty) for all profitable open trades
    // "Effective stop" = TSL if set above entry, otherwise original SL.
    // If TSL > CMP (stop hasn't been triggered yet), profit-at-risk from THIS stop = 0 for this trade.
    // We don't add negative values — a TSL above CMP simply means that profit is fully protected.
    const totalProfitAtRisk = openTrades.reduce((acc, t) => {
      const isSell = (t.type || 'Buy').toLowerCase() === 'sell';
      const cmp = parseFloat(t.cmp) || 0;
      const entry = parseFloat(t.avgEntry || t.entry) || 0;
      const tsl = parseFloat(t.tsl) || 0;
      const openQty = parseFloat(t.openQty || t.qty) || 0;
      const sl = (t.sl !== undefined && t.sl !== null && t.sl !== '' && !isNaN(parseFloat(t.sl)) && parseFloat(t.sl) > 0) ? parseFloat(t.sl) : null;

      if (openQty <= 0) return acc;

      if (!isSell) {
        if (cmp > entry) {
          const effectiveStop = tsl > entry ? tsl : (sl !== null ? sl : entry);
          const profitAtRisk = (cmp - effectiveStop) * openQty;
          return acc + Math.max(0, profitAtRisk);
        }
      } else {
        if (cmp < entry && cmp > 0) {
          const effectiveStop = (tsl > 0 && tsl < entry) ? tsl : (sl !== null ? sl : entry);
          const profitAtRisk = (effectiveStop - cmp) * openQty;
          return acc + Math.max(0, profitAtRisk);
        }
      }
      return acc;
    }, 0);
    const profitRiskPct = currentPfCapital > 0
      ? ((totalProfitAtRisk / currentPfCapital) * 100).toFixed(2)
      : '0.00';

    // ── Profit Protected (₹) & % of pf: TSL locked in profit ───────────────
    const profitProtected = openTrades.reduce((acc, t) => {
      let protectedAmt = 0;
      const isSell = (t.type || 'Buy').toLowerCase() === 'sell';
      const entry = parseFloat(t.avgEntry) || parseFloat(t.entry) || 0;
      const tsl = parseFloat(t.tsl) || 0;
      const openQty = parseFloat(t.openQty) || 0;
      if (openQty > 0 && entry > 0 && tsl > 0) {
        if (!isSell) {
          if (tsl > entry) {
            protectedAmt = (tsl - entry) * openQty;
          }
        } else {
          if (tsl < entry) {
            protectedAmt = (entry - tsl) * openQty;
          }
        }
      }
      return acc + protectedAmt;
    }, 0);
    const profitProtectedPct = currentPfCapital > 0
      ? ((profitProtected / currentPfCapital) * 100).toFixed(2)
      : '0.00';

    // ── Gross PF Impact % (All-Time): Compounded CAGR from Fund Management ──
    const grossPFImpact = (baseFundCapital > 0 && grossRealizedPL !== 0)
      ? ((grossRealizedPL / baseFundCapital) * 100).toFixed(2)
      : '0.00';

    // ── Current Drawdown (Realized): Daily cash-flow-adjusted calculation against true peak equity ──
    // Tracks cumulative realized equity curve peak-to-trough drop % and amount.
    const startingCapitalBasis = monthlyPerf?.find(m => m.capitalIsReal && m.startingCapital > 0)?.startingCapital ?? null;
    const { events: realizedEvents, excluded: excludedDdTrades } = buildRealizedEvents(portfolioTrades);
    const flows = getLedgerFlows(activePortfolioId);
    const ddResult = computeDrawdownDaily({ events: realizedEvents, flows, openingCapital: startingCapitalBasis });

    const currentDrawdown = ddResult.available ? formatDrawdownPct(ddResult.currentPct) : null;
    const currentDrawdownAmount = ddResult.available ? Math.abs(ddResult.currentAmount).toFixed(2) : null;
    const maxDrawdown = ddResult.available ? formatDrawdownPct(ddResult.maxPct) : null;
    const maxDrawdownAmount = ddResult.available ? Math.abs(ddResult.maxAmount).toFixed(2) : null;

    return {
      totalTrades,
      openPositions,
      winRate,
      grossRealizedPL,
      unrealizedPL,
      unrealizedPLPct,
      capitalAtRisk: capitalAtRiskPct,
      totalRisk,
      totalInvested,
      percentInvested,
      profitRisk: profitRiskPct,
      profitProtected,
      profitProtectedPct,
      grossPFImpact,
      portfolioCapital: currentPfCapital,
      startingCapitalBasis,
      currentDrawdown,
      currentDrawdownAmount,
      maxDrawdown,
      maxDrawdownAmount,
      excludedDrawdownTrades: excludedDdTrades,
      ddDailyResult: ddResult,
      drawdownFlows: flows,
      skippedDays: ddResult.skippedDays || [],
      approxFlowCount: ddResult.approxFlowCount || 0,
      currentUnderwaterDays: ddResult.currentUnderwaterDays || 0,
      longestUnderwaterDays: ddResult.longestUnderwaterDays || 0,
      maxDrawdownPeakDate: ddResult.maxDrawdownPeakDate || null,
      maxDrawdownTroughDate: ddResult.maxDrawdownTroughDate || null,
      recoveryDate: ddResult.recoveryDate || null
    };
  }, [filteredTrades, capitalChanges, monthlyPerf, liveCMPs, journalSettings.liveCmpEnabled, activePortfolioId]);


  const triggerBackupWarningIfOff = () => {
    if (!autoBackup) {
      setBackupWarning(true);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = setTimeout(() => {
        setBackupWarning(false);
      }, 10000);
    }
  };

  // ── Trade CRUD ──────────────────────────────────────────────────────────────
  const handleOpenAddModal  = () => {
    triggerBackupWarningIfOff();
    setEditingTrade(null);
    setIsAddModalOpen(true);
  };
  const handleOpenEditModal = (trade) => { setEditingTrade(trade); setIsAddModalOpen(true); };

  const handleSaveTrade = (tradeData) => {
    const now = Date.now();
    const enriched = enrichTradeWithLegs({
      id: editingTrade ? editingTrade.id : `trade-${now}`,
      tradeNo: editingTrade ? editingTrade.tradeNo : trades.length + 1,
      ...tradeData,
      clientUpdatedAt: now,
      updatedAt: now,
    });

    if (editingTrade) {
      setTrades(prev => prev.map(t => t.id === editingTrade.id ? enriched : t));
    } else {
      setTrades(prev => [...prev, enriched]);
    }
  };

  const handleConfirmDelete = () => {
    if (deletingTrade) {
      setTrades(prev => {
        const withoutDeleted = prev.filter(t => t.id !== deletingTrade.id);
        let activeCounter = 1;
        return withoutDeleted.map(t => {
          if ((t.portfolioId || 'portfolio-default') === activePortfolioId) {
            return { ...t, tradeNo: activeCounter++ };
          }
          return t;
        });
      });
      setDeletingTrade(null);
    }
  };

  const handleReorderTrades = (reorderedActiveTrades) => {
    if (!reorderedActiveTrades) return;
    setTrades(prev => {
      const otherPortfolioTrades = prev.filter(t => (t.portfolioId || 'portfolio-default') !== activePortfolioId);
      const renumbered = reorderedActiveTrades.map((t, idx) => ({
        ...t,
        tradeNo: idx + 1,
        portfolioId: activePortfolioId || 'portfolio-default'
      }));
      return [...otherPortfolioTrades, ...renumbered];
    });
  };

  const handleUpdateTrade = (id, field, value) => {
    const now = Date.now();
    setTrades(prev => prev.map(t => {
      if (t.id === id) {
        const updated = { ...t, [field]: value, clientUpdatedAt: now, updatedAt: now };
        if (field === 'name') {
          updated.name = value;
          if (!updated.symbol || updated.symbol === t.name) {
            updated.symbol = value;
          }
          if (value) {
            const sym = getCanonicalSymbol(value);
            const cachedPrice = getCachedCMP(sym) || liveCMPs?.[sym] || liveCMPs?.[value.toUpperCase()];
            if (cachedPrice && Number(cachedPrice) > 0) {
              updated.cmp = Number(cachedPrice);
            } else if (!t.cmp || Number(t.cmp) === 0) {
              fetchLiveCMPForSymbol(sym).then(p => {
                if (p > 0) {
                  setTrades(latest => latest.map(item => {
                    if (item.id === id && (!item.cmp || Number(item.cmp) === 0)) {
                      return enrichTradeWithLegs({ ...item, cmp: p });
                    }
                    return item;
                  }));
                }
              }).catch(() => {});
            }
          }
        } else if (field === 'symbol') {
          updated.symbol = value;
          if (!updated.name || updated.name === t.symbol) {
            updated.name = value;
          }
        }
        if (field === 'qty') {
          updated.qty = value;
          updated.initialQty = value;
          updated.initial_qty = value;
        }
        return enrichTradeWithLegs(updated);
      }
      return t;
    }));
  };

  const handleGoogleDriveSync = async () => {
    try {
      await loadGoogleGsiScript();
      const token = await requestAccessToken();
      if (!token) return;

      const driveTrades = await downloadBackupFromDrive(token);
      let mergedTrades = [...trades];
      let hasChanges = false;

      if (Array.isArray(driveTrades) && driveTrades.length > 0) {
        driveTrades.forEach(dt => {
          if (!mergedTrades.some(t => t.id === dt.id)) {
            mergedTrades.push(dt);
            hasChanges = true;
          }
        });
      }

      await uploadBackupToDrive(token, mergedTrades);
      if (hasChanges) {
        setTrades(mergedTrades);
      }
      alert('Google Drive Sync completed successfully! Trades synchronized.');
    } catch (err) {
      console.error('[Google Drive Sync error]:', err);
      alert('Google Drive Sync failed. Please configure your Client ID.');
    }
  };

  const handleRenumberTrades = () => {
    if (!trades || trades.length === 0) return;

    // Check if trades are already properly numbered sequentially from 1 to N
    const isAlreadyProperlyNumbered = trades.every((trade, idx) => Number(trade.tradeNo) === idx + 1);

    if (isAlreadyProperlyNumbered) {
      setToastNotification({
        id: Date.now(),
        type: 'info',
        title: 'Trades already properly numbered',
        description: `All trades are already numbered sequentially from 1 to ${trades.length}.`
      });
      return;
    }

    // Renumber all trades from 1 to last
    setTrades(prev => {
      return prev.map((trade, idx) => ({
        ...trade,
        tradeNo: idx + 1
      }));
    });

    setToastNotification({
      id: Date.now(),
      type: 'info',
      title: 'Trades renumbered',
      description: `All trades have been renumbered sequentially from 1 to ${trades.length}.`
    });
  };

  const handleDeleteMultipleTrades = (tradeIds) => {
    if (!tradeIds || tradeIds.length === 0) return;
    const idSet = new Set(tradeIds);
    setTrades(prev => prev.filter(t => !idSet.has(t.id)));
    if (setToastNotification) {
      setToastNotification({
        id: Date.now(),
        type: 'success',
        title: 'Trades Deleted',
        description: `Successfully deleted ${tradeIds.length} trade${tradeIds.length > 1 ? 's' : ''}.`
      });
    }
  };

  const activePortfolio = portfolios.find(p => p.id === activePortfolioId) || portfolios[0] || { name: 'My Portfolio', baseCapital: 100000 };

  const handleSelectPortfolio = (id) => {
    setActivePortfolioId(id);
    setSelectedChartSymbol(null);
    localStorage.setItem('tradeontip_active_portfolio_id', id);
    const selected = portfolios.find(p => p.id === id);
    if (selected && selected.baseCapital) {
      setPortfolioCapital(selected.baseCapital);
      localStorage.setItem('tradeontip_base_capital', String(selected.baseCapital));
    }
    setToastNotification({
      id: Date.now(),
      type: 'info',
      title: 'Portfolio Switched',
      description: `Active portfolio switched to "${selected?.name || 'My Portfolio'}".`
    });
  };

  const handleUpdatePortfolios = (updated) => {
    setPortfolios(updated);
    localStorage.setItem('tradeontip_portfolios', JSON.stringify(updated));
  };

  const handleAddEmptyRow = () => {
    triggerBackupWarningIfOff();

    // Clear search or conflicting filters so the new trade row is immediately visible
    if (searchTerm) setSearchTerm('');
    if (statusFilter === 'Closed') setStatusFilter('All');
    if (outcomeFilter && outcomeFilter !== 'All') setOutcomeFilter('All');

    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      timeZone: 'Asia/Kolkata'
    }).replace(/\//g, '-');

    const currentPortfolioTrades = trades.filter(t => (t.portfolioId || 'portfolio-default') === activePortfolioId);
    const newTradeNo = currentPortfolioTrades.length + 1;

    const emptyTrade = enrichTradeWithLegs({
      id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tradeNo: newTradeNo,
      date: today,
      name: '',
      symbol: '',
      broker: localStorage.getItem('foxtrade_last_broker') || 'not_defined',
      setup: '',
      type: 'Buy',
      side: 'Buy',
      status: 'Open',
      entry: 0,
      avgEntry: 0,
      sl: 0,
      cmp: 0,
      entryType: '',
      qty: 0,
      initialQty: 0,
      pnl: 0,
      portfolioId: activePortfolioId || 'portfolio-default'
    });

    setTrades(prev => [...prev, emptyTrade]);

    // Ensure the table navigates to the page containing the new row
    const targetPage = Math.max(1, Math.ceil((currentPortfolioTrades.length + 1) / pageSize));
    setCurrentPage(targetPage);

    if (setToastNotification) {
      setToastNotification({
        id: Date.now(),
        type: 'success',
        title: 'Trade Row Added',
        description: `Row #${newTradeNo} added to the trade log. You can edit it directly inline.`
      });
    }
  };

  // ── Universal Trade Import & Export handlers ─────────────────────────────
  const handleImportCSV = async (e) => {
    try {
      const file = e?.target?.files?.[0] || (e instanceof File ? e : e?.file);
      if (!file) return;

      const activePf = portfolios.find(p => p.id === activePortfolioId) || { name: 'My Portfolio' };

      const parsedTrades = await parseTradesFromFile(file, {
        activePortfolioId: activePortfolioId || 'portfolio-default',
        baseCapital: portfolioCapital || 100000,
        liveCMPs,
        costBasisMethod: journalSettings.costBasisMethod || 'fifo',
        startingTradeNo: 1
      });

      if (parsedTrades && parsedTrades.length > 0) {
        let dedupResult = null;

        setTrades(prev => {
          dedupResult = deduplicateAndMergeTrades(prev, parsedTrades, {
            activePortfolioId: activePortfolioId || 'portfolio-default',
            enrichFn: (t) => enrichTradeWithLegs(t)
          });
          return dedupResult.combinedTrades;
        });

        setIsBrokerImportOpen(false);

        if (setToastNotification && dedupResult) {
          const { newTradesCount, updatedTradesCount, skippedDuplicatesCount } = dedupResult;

          if (newTradesCount === 0 && updatedTradesCount === 0 && skippedDuplicatesCount > 0) {
            setToastNotification({
              id: Date.now(),
              type: 'info',
              title: 'No New Trades (Duplicate File)',
              description: `0 trades imported. All ${skippedDuplicatesCount} trade${skippedDuplicatesCount === 1 ? '' : 's'} already exist in "${activePf.name}".`
            });
          } else {
            const parts = [];
            if (newTradesCount > 0) parts.push(`${newTradesCount} new trade${newTradesCount === 1 ? '' : 's'} added`);
            if (updatedTradesCount > 0) parts.push(`${updatedTradesCount} trade${updatedTradesCount === 1 ? '' : 's'} updated`);
            if (skippedDuplicatesCount > 0) parts.push(`${skippedDuplicatesCount} duplicate${skippedDuplicatesCount === 1 ? '' : 's'} skipped`);

            setToastNotification({
              id: Date.now(),
              type: 'success',
              title: 'Trades Processed',
              description: parts.join(' · ') + ` into "${activePf.name}".`
            });
          }
        }
      } else {
        if (setToastNotification) {
          setToastNotification({
            id: Date.now(),
            type: 'error',
            title: 'Import Failed',
            description: 'No valid trades could be parsed from the selected file.'
          });
        }
      }
    } catch (err) {
      console.error('Trade Import Error:', err);
      if (setToastNotification) {
        setToastNotification({
          id: Date.now(),
          type: 'error',
          title: 'Import Failed',
          description: err.message || 'Failed to parse file.'
        });
      } else {
        alert('Failed to parse file: ' + err.message);
      }
    } finally {
      if (e?.target && 'value' in e.target) {
        try { e.target.value = ''; } catch {}
      }
      if (fileInputRef.current) {
        try { fileInputRef.current.value = ''; } catch {}
      }
    }
  };

  const handleExportCSV = () => {
    if (trades.length === 0) {
      alert('No trades available to export.');
      return;
    }

    const headers = [
      'TRADE NO.', 'DATE', 'NAME', 'SETUP', 'BUY/SELL', 'ENTRY (₹)', 
      'AVG ENTRY (₹)', 'SL (₹)', 'CMP (₹)', 'ENTRY TYPE', 'INITIAL QTY/LOT',
      'P1 PRICE (₹)', 'P1 QTY/LOT', 'P1 DATE', 'P1 SL (₹)',
      'P2 PRICE (₹)', 'P2 QTY/LOT', 'P2 DATE', 'P2 SL (₹)',
      'P3 PRICE (₹)', 'P3 QTY/LOT', 'P3 DATE', 'P3 SL (₹)',
      'P4 PRICE (₹)', 'P4 QTY/LOT', 'P4 DATE', 'P4 SL (₹)',
      'TSL (₹)', 'POSITION SIZE (₹)', 'CURRENT ALLOCATION (%)', 'PEAK ALLOCATION (%)', 'SL %',
      'E1 PRICE (₹)', 'E1 QTY/LOT', 'E1 DATE',
      'E2 PRICE (₹)', 'E2 QTY/LOT', 'E2 DATE',
      'E3 PRICE (₹)', 'E3 QTY/LOT', 'E3 DATE',
      'E4 PRICE (₹)', 'E4 QTY/LOT', 'E4 DATE',
      'OPEN QTY/LOT', 'EXITED QTY/LOT', 'AVG EXIT PRICE (₹)',
      'STOCK MOVE', 'REWARD:RISK', 'HOLDING DAYS', 'POSITION STATUS', 
      'REALISED AMOUNT (₹)', 'Gross P/L (₹)', 'PF IMPACT (%)', 'CUMM PF IMPACT (%)',
      'PLAN FOLLOWED', 'EXIT TRIGGER', 'GROWTH AREAS', 'CAPITAL AT RISK (%)',
      'BASE DURATION', 'QUICK NOTE', 'UNREALIZED P/L (₹)'
    ];

    const rows = trades.map(t => [
      t.tradeNo || '',
      t.date || '',
      t.name || t.symbol || '',
      t.setup || '',
      t.type || 'Buy',
      t.entry || 0,
      t.avgEntry || 0,
      t.sl !== null && t.sl !== undefined ? t.sl : '',
      t.cmp ?? 0,
      t.entryType || 'Market',
      t.qty ?? 0,
      t.p1Price ?? 0,
      t.p1Qty ?? 0,
      t.p1Date || '',
      t.p1Sl !== null && t.p1Sl !== undefined ? t.p1Sl : '',
      t.p2Price ?? 0,
      t.p2Qty ?? 0,
      t.p2Date || '',
      t.p2Sl !== null && t.p2Sl !== undefined ? t.p2Sl : '',
      t.p3Price ?? 0,
      t.p3Qty ?? 0,
      t.p3Date || '',
      t.p3Sl !== null && t.p3Sl !== undefined ? t.p3Sl : '',
      t.p4Price ?? 0,
      t.p4Qty ?? 0,
      t.p4Date || '',
      t.p4Sl !== null && t.p4Sl !== undefined ? t.p4Sl : '',
      t.tsl ?? 0,
      t.positionSize ?? 0,
      t.currentAllocation ?? 0,
      t.peakAllocation ?? 0,
      t.slPct !== null && t.slPct !== undefined ? t.slPct : '',
      t.e1Price ?? 0,
      t.e1Qty ?? 0,
      t.e1Date || '',
      t.e2Price ?? 0,
      t.e2Qty ?? 0,
      t.e2Date || '',
      t.e3Price ?? 0,
      t.e3Qty ?? 0,
      t.e3Date || '',
      t.e4Price ?? 0,
      t.e4Qty ?? 0,
      t.e4Date || '',
      t.openQty ?? 0,
      t.exitedQty ?? 0,
      t.avgExitPrice ?? 0,
      t.stockMove ?? 0,
      t.rewardRisk !== null && t.rewardRisk !== undefined ? t.rewardRisk : '',
      t.holdingDays ?? 0,
      t.status || 'Open',
      t.realisedAmount ?? 0,
      t.grossPnl ?? t.pnl ?? 0,
      t.pfImpact ?? 0,
      t.cummPf ?? 0,
      t.planFollowed || '',
      t.exitTrigger || '',
      t.growthAreas || '',
      t.capitalAtRisk ?? 0,
      t.baseDuration || '',
      `"${(t.quickNote || t.notes || '').replace(/"/g, '""')}"`,
      t.unrealized ?? 0
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => {
        const valStr = String(val);
        if (valStr.includes(',') && !valStr.startsWith('"')) {
          return `"${valStr.replace(/"/g, '""')}"`;
        }
        return valStr;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `trades_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDirectSyncedTrades = (syncedTrades = []) => {
    if (!syncedTrades || syncedTrades.length === 0) return;
    const activePf = portfolios.find(p => p.id === activePortfolioId) || { name: 'My Portfolio' };

    let dedupResult = null;

    setTrades(prev => {
      dedupResult = deduplicateAndMergeTrades(prev, syncedTrades, {
        activePortfolioId: activePortfolioId || 'portfolio-default',
        enrichFn: (t) => enrichTradeWithLegs(t)
      });
      return dedupResult.combinedTrades;
    });

    setIsBrokerImportOpen(false);
    setIsBrokerConnectivityOpen(false);

    if (setToastNotification && dedupResult) {
      const { newTradesCount, updatedTradesCount, skippedDuplicatesCount } = dedupResult;

      if (newTradesCount === 0 && updatedTradesCount === 0 && skippedDuplicatesCount > 0) {
        setToastNotification({
          id: Date.now(),
          type: 'info',
          title: 'All Trades Already Synced',
          description: `All ${skippedDuplicatesCount} trade${skippedDuplicatesCount === 1 ? '' : 's'} are already in "${activePf.name}".`
        });
      } else {
        const parts = [];
        if (newTradesCount > 0) parts.push(`${newTradesCount} new trade${newTradesCount === 1 ? '' : 's'} synced`);
        if (updatedTradesCount > 0) parts.push(`${updatedTradesCount} existing trade${updatedTradesCount === 1 ? '' : 's'} updated`);
        if (skippedDuplicatesCount > 0) parts.push(`${skippedDuplicatesCount} duplicate${skippedDuplicatesCount === 1 ? '' : 's'} skipped`);

        setToastNotification({
          id: Date.now(),
          type: 'success',
          title: 'Broker Sync Complete',
          description: parts.join(' · ') + ` in "${activePf.name}".`
        });
      }
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      display: 'flex', flexDirection: 'column'
    }}>
      {activeTab !== 'symbol-deep-dive' && (
        <TopBar
          themeMode={themeMode} setThemeMode={setThemeMode}
          dateRange={dateRange} setDateRange={setDateRange}
          outcomeFilter={outcomeFilter} setOutcomeFilter={setOutcomeFilter}
          tradeTypeFilter={tradeTypeFilter} setTradeTypeFilter={setTradeTypeFilter}
          instrumentFilter={instrumentFilter} setInstrumentFilter={setInstrumentFilter}
          tradingMarket={tradingMarket} setTradingMarket={setTradingMarket}
          user={user} onLogout={onLogout}
          activeTab={activeTab}
          trades={trades}
          portfolios={portfolios}
          activePortfolioId={activePortfolioId}
          onSelectPortfolio={handleSelectPortfolio}
          onUpdatePortfolios={handleUpdatePortfolios}
          onOpenCreatePortfolio={() => {
            setPortfolioModalTab('create');
            setIsPortfolioModalOpen(true);
          }}
          onOpenBrokerConnectivity={() => setIsBrokerConnectivityOpen(true)}
          onShowToast={setToastNotification}
        />
      )}

      {/* Date Issues Notification Banner (Below TopBar/Notification Area, White/Black Theme, Red/Green Numbers, Lucide Icon) */}
      {flaggedDateTrades.length > 0 && (
        <div style={{
          margin: '8px 24px 0 24px',
          padding: '10px 16px',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          color: 'var(--text-primary, #09090b)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-muted, rgba(0, 0, 0, 0.05))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertTriangle size={13} color="var(--text-primary, #09090b)" />
            </div>
            <span>
              <strong style={{ fontWeight: 600 }}>{flaggedDateTrades.length} trades have date issues</strong> (e.g. exit date before entry date).{' '}
              <span style={{ color: 'var(--text-secondary, #71717a)' }}>
                P&amp;L is 100% computed from execution prices (
                <span style={{
                  fontWeight: 700,
                  color: flaggedDateTradesNetPaise >= 0 ? '#16a34a' : '#dc2626'
                }}>
                  {flaggedDateTradesNetPaise >= 0 ? '+' : '-'}₹{Math.abs(flaggedDateTradesNetPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                ); month or FY attribution may be affected.
              </span>
            </span>
          </div>
          <button
            onClick={() => setIsReviewFlaggedOpen(true)}
            className="review-action-btn"
            style={{
              backgroundColor: isReviewFlaggedOpen || isReviewPressed ? '#6b7280' : 'var(--text-primary, #09090b)',
              color: 'var(--bg-primary, #ffffff)',
              border: `1px solid ${isReviewFlaggedOpen || isReviewPressed ? '#6b7280' : 'var(--text-primary, #09090b)'}`,
              borderRadius: '6px',
              padding: '5px 14px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.08s ease',
              flexShrink: 0
            }}
            onMouseDown={() => setIsReviewPressed(true)}
            onMouseUp={() => setIsReviewPressed(false)}
            onMouseEnter={(e) => {
              if (!isReviewFlaggedOpen && !isReviewPressed) e.currentTarget.style.backgroundColor = '#27272a';
            }}
            onMouseLeave={(e) => {
              setIsReviewPressed(false);
              if (!isReviewFlaggedOpen) e.currentTarget.style.backgroundColor = 'var(--text-primary, #09090b)';
            }}
          >
            Review ({flaggedDateTrades.length})
          </button>
        </div>
      )}

      {activeTab === 'journal' && (
        <Toolbar
          searchTerm={searchTerm} setSearchTerm={setSearchTerm}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          hideValues={hideValues} setHideValues={setHideValues}
          journalViewMode={journalViewMode} setJournalViewMode={setJournalViewMode}
          onAddTradeClick={handleOpenAddModal}
          onQuickLogClick={() => setIsQuickLogOpen(true)}
          onElectricityBillClick={() => setIsElectricityBillOpen(true)}
          onImportClick={() => setIsBrokerImportOpen(true)}
          onExportClick={handleExportCSV}
          onGoogleDriveSyncClick={handleGoogleDriveSync}
          onColumnsClick={() => setIsSettingsOpen(true)}
          onViewChartClick={() => setActiveTab('stock-charts')}
          onBrowseImagesClick={() => setIsChartGalleryOpen(true)}
          onFoxyAiClick={() => setActiveTab('foxy-ai')}
          visibleCols={visibleCols}
          onToggleCol={handleToggleCol}
          onSelectAllCols={handleSelectAllCols}
          onDeselectAllCols={handleDeselectAllCols}
          columnOrder={columnOrder}
          onReorderCols={handleReorderCols}
          settings={journalSettings}
          onUpdateSetting={handleUpdateSetting}
          trades={tradesWithCumm}
          portfolios={portfolios}
          capitalChanges={capitalChanges}
          sortBy={holdingsSortBy}
          setSortBy={setHoldingsSortBy}
        />
      )}

      {/* Main Journal View Modes (Stats Table, Portfolio DNA, Grid Matrix, Live News Stream) */}
      <main style={{ flex: 1 }}>
        {activeTab === 'journal' && (
          journalViewMode === 'stats' ? (
            <>
              <StatCards metrics={metrics} hideValues={hideValues} trades={tradesWithCumm} settings={journalSettings} onUpdateSetting={handleUpdateSetting} />
              {loadingTrades && (!tradesWithCumm || tradesWithCumm.length === 0) ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading trades...</div>
              ) : (
                <JournalTable
                  trades={tradesWithCumm}
                  onAddTrade={handleAddEmptyRow}
                  onRenumberTrades={handleRenumberTrades}
                  onReorderTrades={handleReorderTrades}
                  onUpdateTrade={handleUpdateTrade}
                  onEditTrade={handleOpenEditModal}
                  onDeleteClick={(trade) => setDeletingTrade(trade)}
                  onDeleteMultipleTrades={handleDeleteMultipleTrades}
                  onImportClick={() => setIsBrokerImportOpen(true)}
                  onOpenChart={handleOpenStockChart}
                  onOpenDeepDive={handleOpenDeepDive}
                  pageSize={pageSize} setPageSize={setPageSize}
                  currentPage={currentPage} setCurrentPage={setCurrentPage}
                  visibleCols={visibleCols}
                  setVisibleCols={setVisibleCols}
                  columnOrder={columnOrder}
                  setColumnOrder={setColumnOrder}
                  settings={journalSettings}
                  tradingMarket={tradingMarket}
                  themeMode={themeMode}
                  tradeAudits={playbookAudits}
                  onOpenAudit={handleOpenJournalAudit}
                />
              )}

              {/* 1-Click Trade Auditor Modal from Journal Table */}
              {isJournalAuditModalOpen && (
                <TradeAuditorModal
                  isOpen={isJournalAuditModalOpen}
                  onClose={() => {
                    setIsJournalAuditModalOpen(false);
                    setJournalAuditingTrade(null);
                  }}
                  trade={journalAuditingTrade}
                  allPlaybooks={playbooksList}
                  defaultPlaybookId={
                    journalAuditingTrade?.setup
                      ? (playbooksList.find(p => p.title.toLowerCase() === (journalAuditingTrade.setup || '').toLowerCase() || p.id === journalAuditingTrade.setup)?.id || null)
                      : null
                  }
                  tradeAudits={playbookAudits}
                  onSaveAudit={handleSaveJournalAudit}
                  onUpdateTrade={handleUpdateTrade}
                />
              )}
            </>
          ) : journalViewMode === 'portfolio' ? (
            <PortfolioDNAView 
              trades={tradesWithCumm} 
              portfolioCapital={metrics?.portfolioCapital || portfolioCapital} 
              metrics={metrics}
              hideValues={hideValues}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              sortBy={holdingsSortBy}
              setSortBy={setHoldingsSortBy}
              onOpenStockChart={handleOpenStockChart}
              onOpenDeepDive={handleOpenDeepDive}
              settings={journalSettings}
            />
          ) : journalViewMode === 'grid' ? (
            <TradeGridMatrixView 
              trades={tradesWithCumm} 
              portfolioCapital={metrics?.portfolioCapital || portfolioCapital}
              metrics={metrics}
              hideValues={hideValues}
              searchTerm={searchTerm}
              sortBy={holdingsSortBy}
              onOpenStockChart={handleOpenStockChart} 
              onEditTrade={handleOpenEditModal} 
              onUpdateTrade={handleUpdateTrade}
            />
          ) : (
            <CorporateNewsFeedView trades={tradesWithCumm || trades} onOpenStockChart={handleOpenStockChart} />
          )
        )}
        {activeTab === 'analytics'       && (
          <AnalyticsPage 
            trades={validFilteredTrades} 
            allTrades={enrichedTrades}
            portfolioCapital={portfolioCapital || (metrics?.portfolioCapital || 0)} 
            onOpenStockChart={handleOpenStockChart}
            chargesMap={chargesMap}
            dateRange={dateRange}
            resolvedDateFilter={resolvedDateFilter}
          />
        )}
        {activeTab === 'expiry-tracker'  && <ExpiryTrackerPage trades={validFilteredTrades} allTrades={portfolioTrades} />}
        {activeTab === 'milestones'      && <MilestonesPage trades={validFilteredTrades} allTrades={portfolioTrades} />}
        {activeTab === 'playbook' && (
          <PlaybookEngine
            trades={validFilteredTrades}
            allTrades={portfolioTrades}
            user={user}
            initialPlaybookId={selectedPlaybookId}
            onSelectPlaybookId={setSelectedPlaybookId}
            onOpenStockChart={handleOpenStockChart}
            onUpdateTrade={handleUpdateTrade}
          />
        )}
        {activeTab === 'stock-charts'    && (
          <StockChartsPage 
            trades={validFilteredTrades} 
            allTrades={enrichedTrades}
            selectedSymbol={selectedChartSymbol}
            onSelectSymbol={setSelectedChartSymbol}
            onOpenAddTrade={() => setIsAddModalOpen(true)}
            onOpenQuickLog={() => setIsQuickLogOpen(true)}
            onOpenImport={() => setIsBrokerImportOpen(true)}
            onNavigateToJournal={() => setActiveTab('journal')}
            dateRange={dateRange}
            resolvedDateFilter={resolvedDateFilter}
          />
        )}
        {activeTab === 'symbol-deep-dive' && (
          <SymbolDeepDivePage
            trades={validFilteredTrades}
            allTrades={portfolioTrades}
            symbol={deepDiveConfig?.symbol || selectedChartSymbol || 'WAAREEENER'}
            tradeNo={deepDiveConfig?.tradeNo || null}
            tradeId={deepDiveConfig?.tradeId || null}
            themeMode={themeMode}
            onClose={() => setActiveTab('journal')}
            onUpdateTrade={handleUpdateTrade}
            onOpenPlaybook={(pbId) => {
              setSelectedPlaybookId(pbId);
              setActiveTab('playbook');
            }}
          />
        )}
        {(activeTab === 'foxy-ai' || activeTab === 'ai-coach' || activeTab === 'foxy') && (
          <FoxyAiPage 
            trades={validFilteredTrades} 
            allTrades={portfolioTrades} 
            metrics={metrics} 
            user={user} 
            onBackToJournal={() => setActiveTab('journal')} 
            activePortfolioId={activePortfolioId} 
            portfolioCapital={portfolioCapital} 
            capitalChanges={capitalChanges}
            themeMode={themeMode}
          />
        )}
        {(activeTab === 'fund-management' || activeTab === 'fundManagement') && (
          <FundManagementPage 
            trades={validFilteredTrades} 
            allTrades={portfolioTrades}
            user={user} 
            activePortfolioId={activePortfolioId}
            dateRange={dateRange}
            resolvedDateFilter={resolvedDateFilter}
            onUpdateCapitalBase={(val) => {
              setPortfolioCapital(val);
              localStorage.setItem('tradeontip_base_capital', String(val));
            }} 
          />
        )}
        {(activeTab === 'tax-analytics' || activeTab === 'tax') && (
          <TaxAnalyticsPage
            trades={validFilteredTrades}
            allTrades={portfolioTrades}
            user={user}
            portfolioValue={portfolioCapital}
            dateRange={dateRange}
            resolvedDateFilter={resolvedDateFilter}
          />
        )}
        {activeTab === 'deep-analytics'  && (
          <DeepAnalyticsPage 
            trades={validFilteredTrades}
            allTrades={enrichedTrades}
            visibleCols={visibleCols}
            onToggleCol={handleToggleCol}
            dateRange={dateRange}
            resolvedDateFilter={resolvedDateFilter}
            startingCapital={metrics?.startingCapitalBasis}
          />
        )}
        {activeTab === 'notes'           && (
          <NotesPage 
            trades={validFilteredTrades} 
            allTrades={portfolioTrades} 
            user={user} 
            dateRange={dateRange}
            resolvedDateFilter={resolvedDateFilter}
            onOpenPlaybook={() => setActiveTab('playbook')} 
          />
        )}
      </main>

      <QuickLogModal
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        onSaveTrade={handleSaveTrade}
        tradingMarket={tradingMarket}
      />

      <ElectricityBillModal
        isOpen={isElectricityBillOpen}
        onClose={() => setIsElectricityBillOpen(false)}
        trades={trades}
        user={user}
      />

      <AddTradeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSaveTrade={handleSaveTrade}
        initialData={editingTrade}
        isEdit={!!editingTrade}
        tradingMarket={tradingMarket}
      />

      <DeleteTradeModal
        isOpen={!!deletingTrade}
        onClose={() => setDeletingTrade(null)}
        onConfirm={handleConfirmDelete}
        tradeName={deletingTrade?.name}
        tradeNo={deletingTrade?.tradeNo}
      />

      <BrokerImportModal
        isOpen={isBrokerImportOpen}
        onClose={() => setIsBrokerImportOpen(false)}
        onFileSelected={(file) => handleImportCSV(file)}
        onSyncedTrades={handleDirectSyncedTrades}
        onOpenBrokerConnectivity={() => {
          setIsBrokerImportOpen(false);
          setIsBrokerConnectivityOpen(true);
        }}
        activePortfolioId={activePortfolioId}
        portfolios={portfolios}
      />

      <BrokerConnectivityModal
        isOpen={isBrokerConnectivityOpen}
        onClose={() => setIsBrokerConnectivityOpen(false)}
        activePortfolioId={activePortfolioId}
        portfolios={portfolios}
        onSyncedTrades={handleDirectSyncedTrades}
        onSwitchToImportFile={() => {
          setIsBrokerConnectivityOpen(false);
          setIsBrokerImportOpen(true);
        }}
        settings={journalSettings}
      />

      <ClearAllDataModal
        isOpen={isClearDataModalOpen}
        onClose={() => setIsClearDataModalOpen(false)}
        onConfirm={handleExecuteClearAllData}
        portfolioName={portfolios.find(p => p.id === activePortfolioId)?.name || 'My Portfolio'}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onClearAllData={() => setIsClearDataModalOpen(true)}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        settings={journalSettings}
        onUpdateSetting={handleUpdateSetting}
      />

      <TradeSettingsModal
        isOpen={isTradeSettingsOpen}
        onClose={() => setIsTradeSettingsOpen(false)}
        settings={journalSettings}
        onUpdateSetting={handleUpdateSetting}
      />

      <ChartGalleryModal 
        isOpen={isChartGalleryOpen}
        onClose={() => setIsChartGalleryOpen(false)}
        trades={trades}
        onOpenStockChart={handleOpenStockChart}
        themeMode={themeMode}
        onUpdateTrade={handleUpdateTrade}
      />

      <BottomDock 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={onLogout}
        autoBackup={autoBackup}
        setAutoBackup={setAutoBackup}
        backupWarning={backupWarning}
        accessToken={accessToken}
        trades={trades}
        onGoogleDriveSyncClick={handleGoogleDriveSync}
        onGoogleLogin={onGoogleLogin}
        user={user}
        portfolios={portfolios}
        activePortfolioId={activePortfolioId}
        onSelectPortfolio={handleSelectPortfolio}
        activePortfolioName={activePortfolio?.name || 'My Portfolio'}
        onOpenPortfolioModal={() => setIsPortfolioModalOpen(true)}
        onOpenBrokerConnections={() => setIsBrokerConnectivityOpen(true)}
        onOpenDisplaySettings={() => setIsSettingsOpen(true)}
        onOpenTradeSettings={() => setIsTradeSettingsOpen(true)}
        onClearAllData={() => setIsClearDataModalOpen(true)}
        onTradesRestored={setTrades}
        onShowToast={setToastNotification}
      />

      <PortfolioManagerModal
        isOpen={isPortfolioModalOpen}
        onClose={() => setIsPortfolioModalOpen(false)}
        initialTab={portfolioModalTab}
        activePortfolioId={activePortfolioId}
        onSelectPortfolio={handleSelectPortfolio}
        portfolios={portfolios}
        onUpdatePortfolios={handleUpdatePortfolios}
        onShowToast={setToastNotification}
        trades={trades}
      />

      <ReviewFlaggedModal
        isOpen={isReviewFlaggedOpen}
        onClose={() => setIsReviewFlaggedOpen(false)}
        flaggedTrades={flaggedDateTrades}
        onUpdateTrade={handleUpdateTrade}
      />

      {/* Global Toast Notification (FoxTrade Modern Toast style) */}
      <ToastNotification 
        toast={toastNotification} 
        onClose={() => setToastNotification(null)} 
      />

      {/* Hidden file input for CSV Import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept=".csv,.xlsx,.xls,.txt" 
        onChange={handleImportCSV} 
      />
    </div>
  );
}
