import { isElectron } from './dbAdapter.js';

export const LS_PLAYBOOKS_KEY = 'foxtrade_playbooks_v2';
export const LS_AUDITS_KEY = 'foxtrade_trade_audits_v2';
export const LS_MISSED_KEY = 'foxtrade_missed_trades_v2';
export const LS_PLAYBOOK_SETTINGS_KEY = 'foxtrade_playbook_settings_v1';

// ── Default Curated Playbooks for Indian Markets ─────────────────────────────
// For new users, we provide 1 clean Sample Playbook so the studio is modern,
// airy, and not flooded with dummy setups. Users can easily customize or create their own setups.
export const DEFAULT_PLAYBOOKS = [
  {
    id: 'pb-sample',
    title: 'Sample Playbook',
    slug: 'sample-playbook',
    strategyType: 'BREAKOUT',
    applicableSegments: ['EQUITY', 'FUTURES', 'OPTIONS'],
    targetWinRate: 65,
    targetRiskReward: 2.0,
    icon: 'BookOpen',
    colorHex: '#3b82f6',
    description: 'A sample trading playbook demonstrating setup checklist rules, entry and exit criteria, and trade tracking. Customize or delete this anytime.',
    isActive: true,
    isShared: false,
    isSample: true,
    createdAt: '2026-01-10T09:15:00.000Z',
    updatedAt: '2026-02-15T15:30:00.000Z',
    ruleGroups: [
      {
        id: 'group-entry',
        title: 'Entry Rules',
        rules: [
          { id: 'r-sample-1', text: 'Market direction aligned with higher timeframe trend', isRequired: true },
          { id: 'r-sample-2', text: 'Clear breakout or key level confirmation with volume', isRequired: true },
          { id: 'r-sample-3', text: 'Defined stop loss and minimum 1:2 risk-reward ratio', isRequired: true }
        ]
      },
      {
        id: 'group-exit',
        title: 'Exit Rules',
        rules: [
          { id: 'r-sample-4', text: 'Take profit at predetermined target level', isRequired: true },
          { id: 'r-sample-5', text: 'Trail stop loss to breakeven after reaching 1R', isRequired: false },
          { id: 'r-sample-6', text: 'Strictly exit if stop loss level is breached', isRequired: true }
        ]
      }
    ],
    notes: [
      {
        id: 'note-sample-1',
        title: 'Sample Strategy Guide',
        content: `<h3>Sample Playbook Overview</h3>
<p>This is a sample playbook demonstrating how to structure your trading strategies in FoxTrade.</p>
<ul>
  <li>Define systematic entry and exit rules to eliminate emotional trading.</li>
  <li>Audit executed trades against these checklist rules.</li>
  <li>Log missed setups to measure opportunity cost and execution edge.</li>
</ul>`,
        createdAt: '2026-01-15T09:30:00.000Z',
        updatedAt: '2026-02-10T11:45:00.000Z'
      }
    ]
  }
];

// Dedicated Virtual Playbook for Impulse & No Setup Trades
export const NO_SETUP_PLAYBOOK = {
  id: 'pb-no-setup',
  title: 'No Setup / Impulse Trades',
  slug: 'no-setup',
  strategyType: 'IMPULSE',
  applicableSegments: ['EQUITY', 'FUTURES', 'OPTIONS', 'COMMODITY', 'CURRENCY'],
  targetWinRate: 0,
  targetRiskReward: 0,
  icon: 'CircleSlash',
  colorHex: '#ef4444',
  description: 'Trades taken impulsively without an explicit system, edge, or checklist criteria. Tracking these reveals the true cost of indiscipline.',
  isActive: true,
  isShared: false,
  isNoSetup: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ruleGroups: [],
  notes: []
};

// Sample default missed trades for instant realistic exploration
export const DEFAULT_MISSED_TRADES = [
  {
    id: 'missed-1',
    playbookId: 'pb-sample',
    symbol: 'BANKNIFTY',
    segment: 'FUTURES',
    direction: 'SHORT',
    date: '2026-02-24',
    entryPrice: 48250,
    exitPrice: 47900,
    theoreticalStop: 48400,
    theoreticalPnl: 5250,
    theoreticalRoi: 3.25,
    theoreticalRMultiple: 2.33,
    status: 'WIN',
    eventTag: 'EXPIRY_DAY',
    notes: 'Sample missed trade: Setup triggered exactly on breakdown below VWAP. Target 1 was hit cleanly.',
    screenshotUrl: '',
    createdAt: '2026-02-24T10:15:00.000Z'
  },
  {
    id: 'missed-2',
    playbookId: 'pb-sample',
    symbol: 'NIFTY',
    segment: 'OPTIONS',
    direction: 'SHORT',
    date: '2026-02-21',
    entryPrice: 185.50,
    exitPrice: 185.00,
    theoreticalStop: 160.00,
    theoreticalPnl: 25,
    theoreticalRoi: 0.15,
    theoreticalRMultiple: 0.02,
    status: 'BE',
    eventTag: 'RBI_POLICY',
    notes: 'Sample missed trade: Breakeven exit rule would have triggered safely.',
    screenshotUrl: '',
    createdAt: '2026-02-21T11:00:00.000Z'
  }
];

// Legacy default setup IDs that were previously hardcoded and should not clutter accounts
const LEGACY_DEFAULT_IDS = new Set([
  'pb-morning-top-reversal',
  'pb-no-setup',
  'pb-opening-sell-off',
  'pb-midday-reversal',
  'pb-opening-drive',
  'pb-gap-and-go',
  'pb-gap-up-and-fail',
  'pb-10am-reversal',
  'pb-second-day-play',
  'pb-volume-delta-imbalance',
  'pb-vwap-pullback',
  'pb-stage2-momentum'
]);

// ── Persistence Handlers ─────────────────────────────────────────────────────

export function loadPlaybooks() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LS_PLAYBOOKS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Migration: Prune legacy empty preset setups that were previously hardcoded
          const cleaned = parsed.filter(p => !LEGACY_DEFAULT_IDS.has(p.id));
          if (cleaned.length === 0) {
            savePlaybooks(DEFAULT_PLAYBOOKS);
            return DEFAULT_PLAYBOOKS;
          }
          if (cleaned.length !== parsed.length) {
            savePlaybooks(cleaned);
            return cleaned;
          }
          return parsed;
        }
      }
    }
  } catch (e) {
    console.error('Failed to load playbooks:', e);
  }
  // Initialize with single default sample preset
  savePlaybooks(DEFAULT_PLAYBOOKS);
  return DEFAULT_PLAYBOOKS;
}

export function savePlaybooks(playbooks, user = null) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_PLAYBOOKS_KEY, JSON.stringify(playbooks));
    }
    if (isElectron() && Array.isArray(playbooks)) {
      playbooks.forEach(pb => {
        window.electronAPI.db.savePlaybook('default', pb).catch(() => {});
      });
    }
  } catch (e) {
    console.error('Failed to save playbooks:', e);
  }
}

export const DEFAULT_TRADE_AUDITS = {
  'demo_1': {
    tradeId: 'demo_1',
    playbookId: 'pb-sample',
    isNoSetup: false,
    disciplineScore: 100,
    ruleExecutions: {
      'r-sample-1': { isFollowed: true },
      'r-sample-2': { isFollowed: true },
      'r-sample-3': { isFollowed: true },
      'r-sample-4': { isFollowed: true },
      'r-sample-5': { isFollowed: true },
      'r-sample-6': { isFollowed: true }
    },
    comment: 'Sample trade executed according to all playbook rules.',
    auditedAt: '2026-08-15T15:00:00.000Z'
  }
};

export function loadTradeAudits() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LS_AUDITS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
    }
  } catch (e) {}
  saveTradeAudits(DEFAULT_TRADE_AUDITS);
  return DEFAULT_TRADE_AUDITS;
}

export function saveTradeAudits(audits, user = null) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_AUDITS_KEY, JSON.stringify(audits));
    }
    if (isElectron() && audits && typeof audits === 'object') {
      Object.entries(audits).forEach(([tradeId, auditData]) => {
        window.electronAPI.db.saveTradeAudit(tradeId, auditData).catch(() => {});
      });
    }
  } catch (e) {}
}

export function loadMissedTrades() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LS_MISSED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (e) {}
  saveMissedTrades(DEFAULT_MISSED_TRADES);
  return DEFAULT_MISSED_TRADES;
}

export function saveMissedTrades(missedTrades, user = null) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_MISSED_KEY, JSON.stringify(missedTrades));
    }
  } catch (e) {}
}

// ── Playbook Settings Persistence & Defaults ─────────────────────────────────

export const DEFAULT_PLAYBOOK_SETTINGS = {
  defaultRiskReward: 2.0,            // 1.5, 2.0, 2.5, 3.0
  defaultWinRate: 65,                // 50, 60, 65, 70, 75
  defaultSegment: 'ALL',             // 'ALL', 'EQUITY', 'FUTURES', 'OPTIONS'
  defaultRiskAmount: 2500,           // ₹ baseline risk for R-multiple if not specified
  excludeBreakevenFromWinRate: true, // BE trades excluded from denominator
  autoTagTradesByName: true,         // Match journal setup name to playbook title/slug
  strictDisciplineThreshold: 80,     // Adherence % required for "Flawless Discipline"
  defaultViewMode: 'list',           // 'list', 'grid', or 'compare'
  pageSize: 12,                      // 8, 12, 24, 48
  showSampleBenchmarks: true         // Display benchmark distribution when 0 trades tagged
};

export function loadPlaybookSettings() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LS_PLAYBOOK_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_PLAYBOOK_SETTINGS, ...parsed };
        }
      }
    }
  } catch (e) {
    console.error('Failed to load playbook settings:', e);
  }
  return { ...DEFAULT_PLAYBOOK_SETTINGS };
}

export function savePlaybookSettings(settings, user = null) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_PLAYBOOK_SETTINGS_KEY, JSON.stringify(settings));
    }
  } catch (e) {
    console.error('Failed to save playbook settings:', e);
  }
}

export function exportAllPlaybooksToJSON(playbooks = [], settings = null) {
  try {
    const backupData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      playbooks,
      settings: settings || DEFAULT_PLAYBOOK_SETTINGS
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `foxtrade-playbooks-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Failed to export playbooks backup:', e);
  }
}

// ── Metrics Calculation Engine ───────────────────────────────────────────────

/**
 * Parses any trade date representation (ISO 8601, YYYY-MM-DD, DD-MM-YYYY, ms timestamp)
 * into a monotonic UNIX timestamp in milliseconds.
 */
export function parseTradeDateMs(tradeOrDate) {
  if (!tradeOrDate) return 0;
  if (typeof tradeOrDate === 'number') return isNaN(tradeOrDate) ? 0 : tradeOrDate;
  if (typeof tradeOrDate === 'object') {
    if (tradeOrDate.ms) return Number(tradeOrDate.ms) || 0;
    if (tradeOrDate.entryDateMs) return Number(tradeOrDate.entryDateMs) || 0;
    const raw = tradeOrDate.exitDate || tradeOrDate.date || tradeOrDate.entryDate || '';
    return parseTradeDateMs(raw);
  }
  const str = String(tradeOrDate).trim();
  if (!str) return 0;

  // 1. YYYY-MM-DD or YYYY/MM/DD
  const ymd = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(str);
  if (ymd) {
    const tm = /T?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/.exec(str);
    const d = new Date(
      parseInt(ymd[1], 10),
      parseInt(ymd[2], 10) - 1,
      parseInt(ymd[3], 10),
      tm ? parseInt(tm[1], 10) : 0,
      tm ? parseInt(tm[2], 10) : 0,
      tm && tm[3] ? parseInt(tm[3], 10) : 0
    );
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  // 2. DD-MM-YYYY or DD/MM/YYYY (Standard Indian format)
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(str);
  if (dmy) {
    const tm = /T?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/.exec(str);
    const d = new Date(
      parseInt(dmy[3], 10),
      parseInt(dmy[2], 10) - 1,
      parseInt(dmy[1], 10),
      tm ? parseInt(tm[1], 10) : 0,
      tm ? parseInt(tm[2], 10) : 0,
      tm && tm[3] ? parseInt(tm[3], 10) : 0
    );
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

/**
 * Formats any trade date representation to ISO 'YYYY-MM-DD' for monotonic map keys and charts.
 */
export function normalizeTradeDateString(tradeOrDate) {
  const ms = parseTradeDateMs(tradeOrDate);
  if (!ms) return 'Unknown';
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Extracts the trade's entry time as minutes from midnight IST (09:15 = 555 mins).
 * Indian Standard Time (IST) is UTC + 5:30 (330 mins).
 */
export function getTradeMinutesIST(trade) {
  if (!trade) return null;

  // Check explicit time strings like "09:30", "14:15:00"
  const rawTime = trade.entryTime || trade.time || trade.tradeTime || trade.orderTime || '';
  if (rawTime && typeof rawTime === 'string') {
    const m = /(\d{1,2}):(\d{1,2})/.exec(rawTime);
    if (m) {
      let hr = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      if (/pm/i.test(rawTime) && hr < 12) hr += 12;
      if (/am/i.test(rawTime) && hr === 12) hr = 0;
      return hr * 60 + min;
    }
  }

  // Check ISO string with UTC or timezone
  const dateStr = trade.entryDate || trade.date || trade.exitDate || trade.orderTimestamp || '';
  if (typeof dateStr === 'string' && dateStr.includes('T')) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
      return (utcMinutes + 330) % 1440;
    }
  }

  return null;
}

/**
 * Calculates net P&L for a trade, adhering to FoxTrade formulas.
 */
export function getTradePnL(t) {
  if (!t) return 0;
  const val = t.netPnl ?? t.pnl ?? t.grossPnl ?? t.realisedAmount ?? t.realizedPL ?? 0;
  return Number(val) || 0;
}

/**
 * Calculates trade R-multiple
 */
export function getTradeRMultiple(t, baselineRisk = null) {
  if (!t) return 0;
  const r = t.rewardRisk ?? t.rMultiple ?? t.rr;
  const parsed = typeof r === 'number' ? r : parseFloat(r);
  if (!isNaN(parsed) && parsed !== 0) return parsed;
  const pnl = getTradePnL(t);
  const risk = t.plannedRisk || t.risk || t.riskAmount || (t.stopLoss && t.buyPrice && t.qty ? Math.abs(t.buyPrice - t.stopLoss) * t.qty : null);
  if (risk && risk > 0) {
    return Number((pnl / risk).toFixed(2));
  }
  if (pnl !== 0) {
    const fallbackUnit = baselineRisk || loadPlaybookSettings()?.defaultRiskAmount || 2500;
    return Number((pnl / fallbackUnit).toFixed(2));
  }
  return 0;
}

/**
 * Determines whether a trade is closed / completed (handles zero openQty, exitDate, or realized PnL).
 */
export function isTradeClosed(t) {
  if (!t) return false;
  const s = String(t.status || t.positionStatus || '').toLowerCase();
  if (s === 'closed' || s === 'completed' || s === 'partial') return true;
  if (t.exitDate || t.exitPrice || t.e1Price) return true;
  if (t.openQty !== undefined && parseFloat(t.openQty) === 0) return true;
  if (getTradePnL(t) !== 0) return true;
  return false;
}

/**
 * Unified Trade Binding Filter: Determines which trades belong to a playbook.
 * Single source of truth used across metrics, charts, rules tab, and executed tab.
 */
export function getPlaybookTrades(playbook, allTrades = [], tradeAudits = {}, settings = null) {
  if (!playbook || !Array.isArray(allTrades)) return [];

  const autoTag = settings?.autoTagTradesByName !== false;
  const pbId = playbook.id;
  const isNoSetupPlaybook = pbId === 'pb-no-setup' || playbook.isNoSetup;

  return allTrades.filter(t => {
    if (!t) return false;
    const audit = tradeAudits[t.id];
    const isImpulse = Boolean(audit?.isNoSetup || audit?.playbookId === 'pb-no-setup' || t.isNoSetup);

    if (isNoSetupPlaybook) {
      if (isImpulse) return true;
      // If trade is assigned to another valid playbook, it is not an impulse trade
      if ((audit?.playbookId && audit.playbookId !== 'pb-no-setup') || (t.playbookId && t.playbookId !== 'pb-no-setup')) {
        return false;
      }
      if (!t.setup || t.setup.trim() === '' || t.setup.toLowerCase().includes('no setup') || t.setup.toLowerCase().includes('impulse')) {
        return true;
      }
      return false;
    }

    // Normal playbooks: strictly exclude trades audited as no-setup / impulse!
    if (isImpulse) return false;

    // Direct binding via audit or trade property
    if (audit?.playbookId === pbId) return true;
    if (t.playbookId === pbId) return true;

    // Automatic setup name matching if enabled in settings
    if (autoTag && t.setup) {
      const parts = t.setup.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const pbTitle = (playbook.title || '').trim().toLowerCase();
      const pbSlug = (playbook.slug || '').trim().toLowerCase();
      if (parts.includes(pbTitle) || (pbSlug && parts.includes(pbSlug))) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Calculates comprehensive 12-KPI Playbook Performance Metrics (Matching Image 5)
 */
export function calculatePlaybookMetrics(playbook, allTrades = [], tradeAudits = {}, missedTrades = [], settings = null) {
  if (!playbook) return null;

  const currentSettings = settings || loadPlaybookSettings();
  const pbTrades = getPlaybookTrades(playbook, allTrades, tradeAudits, currentSettings);

  const closedTrades = pbTrades.filter(isTradeClosed);
  const totalTradesCount = pbTrades.length;

  const winners = closedTrades.filter(t => getTradePnL(t) > 0);
  const losers = closedTrades.filter(t => getTradePnL(t) < 0);
  const beTrades = closedTrades.filter(t => getTradePnL(t) === 0);

  // Net P&L
  const netPnL = closedTrades.reduce((sum, t) => sum + getTradePnL(t), 0);

  // Win Rate % (governed by excludeBreakevenFromWinRate setting)
  const excludeBE = currentSettings.excludeBreakevenFromWinRate !== false;
  const denominator = excludeBE ? (winners.length + losers.length) : closedTrades.length;
  const winRate = denominator > 0 ? (winners.length / denominator) * 100 : 0;

  // Gross profit & Gross loss
  const grossProfit = winners.reduce((sum, t) => sum + getTradePnL(t), 0);
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + getTradePnL(t), 0));

  // Profit Factor
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : grossProfit > 0 ? 9.99 : 0;

  // Averages & Extremes
  const avgWinner = winners.length > 0 ? (grossProfit / winners.length) : 0;
  const avgLoser = losers.length > 0 ? (grossLoss / losers.length) : 0;
  const largestProfit = winners.length > 0 ? Math.max(...winners.map(t => getTradePnL(t))) : 0;
  const largestLoss = losers.length > 0 ? Math.min(...losers.map(t => getTradePnL(t))) : 0;

  // Expectancy: (win_rate_fraction * avg_win) - (loss_rate_fraction * avg_loss)
  const decidedCount = winners.length + losers.length;
  const winRateFrac = decidedCount > 0 ? (winners.length / decidedCount) : 0;
  const lossRateFrac = decidedCount > 0 ? (losers.length / decidedCount) : 0;
  const expectancy = (winRateFrac * avgWinner) - (lossRateFrac * avgLoser);

  // R-Multiple
  const rValues = closedTrades.map(t => getTradeRMultiple(t, currentSettings.defaultRiskAmount)).filter(r => r !== 0);
  const totalRMultiple = rValues.reduce((sum, r) => sum + r, 0);
  const avgRMultiple = rValues.length > 0 ? (totalRMultiple / rValues.length) : 0;

  // Rules Followed (Discipline Score)
  let totalRulesChecked = 0;
  let totalRulesFollowed = 0;

  pbTrades.forEach(t => {
    const audit = tradeAudits[t.id];
    if (audit?.ruleExecutions) {
      Object.values(audit.ruleExecutions).forEach(rx => {
        totalRulesChecked++;
        if (rx.isFollowed) totalRulesFollowed++;
      });
    }
  });

  const rulesFollowedScore = (playbook.isNoSetup || playbook.id === 'pb-no-setup')
    ? 0
    : totalRulesChecked > 0
      ? Math.round((totalRulesFollowed / totalRulesChecked) * 100)
      : 100;

  // Missed trades count for this playbook
  const pbMissedCount = missedTrades.filter(m => m.playbookId === playbook.id).length;

  return {
    netPnL,
    totalTrades: totalTradesCount,
    closedTradesCount: closedTrades.length,
    winnersCount: winners.length,
    losersCount: losers.length,
    beTradesCount: beTrades.length,
    winRate,
    profitFactor,
    missedTradesCount: pbMissedCount,
    expectancy,
    rulesFollowedScore,
    avgWinner,
    avgLoser,
    largestProfit,
    largestLoss,
    totalRMultiple,
    avgRMultiple,
    pbTrades
  };
}

/**
 * Computes the Daily Net Cumulative P&L curve for Recharts (Image 5 chart)
 * Guaranteed monotonic chronological sorting across all date formats.
 */
export function calculateDailyCumulativePnL(trades = []) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return [
      { date: 'Start', pnl: 0, cumulativePnL: 0 }
    ];
  }

  // Sort trades chronologically using monotonic timestamp parser
  const sorted = [...trades]
    .filter(t => t.date || t.entryDate || t.exitDate || t.ms)
    .sort((a, b) => parseTradeDateMs(a) - parseTradeDateMs(b));

  if (sorted.length === 0) {
    return [{ date: 'Start', pnl: 0, cumulativePnL: 0 }];
  }

  const dateMap = {};
  sorted.forEach(t => {
    const d = normalizeTradeDateString(t);
    if (d && d !== 'Unknown') {
      dateMap[d] = (dateMap[d] || 0) + getTradePnL(t);
    }
  });

  // ISO strings ('YYYY-MM-DD') sort cleanly and monotonically
  const dates = Object.keys(dateMap).sort();
  let running = 0;
  const points = [];

  dates.forEach(d => {
    const dayPnl = dateMap[d];
    running += dayPnl;
    points.push({
      date: d,
      pnl: dayPnl,
      cumulativePnL: Math.round(running)
    });
  });

  if (points.length === 1) {
    return [
      { date: 'Baseline', pnl: 0, cumulativePnL: 0 },
      points[0]
    ];
  }

  return points.length > 0 ? points : [{ date: 'Start', pnl: 0, cumulativePnL: 0 }];
}

/**
 * Computes Quantified Rule-Level Analytics (Matching Image 4)
 * For each rule in the playbook: Follow Rate %, Net Profit/Loss when followed, Profit Factor, Win Rate %
 */
export function calculateRuleAnalytics(rule, playbookTrades = [], tradeAudits = {}) {
  let executedCount = 0;
  let followedCount = 0;
  const followedTrades = [];
  const brokenTrades = [];

  playbookTrades.forEach(t => {
    const audit = tradeAudits[t.id];
    if (audit?.ruleExecutions && audit.ruleExecutions[rule.id] !== undefined) {
      executedCount++;
      const isF = audit.ruleExecutions[rule.id].isFollowed;
      if (isF) {
        followedCount++;
        followedTrades.push(t);
      } else {
        brokenTrades.push(t);
      }
    }
  });

  const followRate = executedCount > 0 ? Math.round((followedCount / executedCount) * 100) : 100;

  // When rule followed:
  const pnl = followedTrades.reduce((acc, t) => acc + getTradePnL(t), 0);
  const wins = followedTrades.filter(t => getTradePnL(t) > 0);
  const losses = followedTrades.filter(t => getTradePnL(t) < 0);
  const decided = wins.length + losses.length;
  const winRate = decided > 0 ? (wins.length / decided) * 100 : 0;

  const grossProfit = wins.reduce((acc, t) => acc + getTradePnL(t), 0);
  const grossLoss = Math.abs(losses.reduce((acc, t) => acc + getTradePnL(t), 0));
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : grossProfit > 0 ? 9.99 : 0;

  return {
    followRate,
    followedCount,
    executedCount,
    netPnL: pnl,
    profitFactor,
    winRate
  };
}

/**
 * Quantifies Cost of Indiscipline / Undisciplined Bleed (Spec Section 4 & 5.D)
 * Undisciplined Bleed = Sum of gross losses from compromised (< threshold) and impulse trades.
 */
export function calculateCostOfIndiscipline(trades = [], tradeAudits = {}, settings = null) {
  const threshold = settings?.strictDisciplineThreshold ?? 100;
  const disciplinedTrades = [];
  const compromisedTrades = [];
  const impulseTrades = [];

  trades.forEach(t => {
    const audit = tradeAudits[t.id];
    if (t.isNoSetup || audit?.isNoSetup || (!audit?.playbookId && !t.playbookId && !t.setup)) {
      impulseTrades.push(t);
    } else {
      const score = audit?.disciplineScore !== undefined ? audit.disciplineScore : 100;
      if (score >= threshold) {
        disciplinedTrades.push(t);
      } else {
        compromisedTrades.push(t);
      }
    }
  });

  const pnlDisc = disciplinedTrades.reduce((sum, t) => sum + getTradePnL(t), 0);
  const pnlComp = compromisedTrades.reduce((sum, t) => sum + getTradePnL(t), 0);
  const pnlImp = impulseTrades.reduce((sum, t) => sum + getTradePnL(t), 0);

  // Undisciplined Bleed = sum of losses from compromised + impulse trades only
  const compLosses = compromisedTrades.filter(t => getTradePnL(t) < 0).reduce((sum, t) => sum + getTradePnL(t), 0);
  const impLosses = impulseTrades.filter(t => getTradePnL(t) < 0).reduce((sum, t) => sum + getTradePnL(t), 0);
  const bleed = Math.abs(compLosses + impLosses);

  const calcWr = (list) => {
    const w = list.filter(t => getTradePnL(t) > 0).length;
    const l = list.filter(t => getTradePnL(t) < 0).length;
    return (w + l) > 0 ? ((w / (w + l)) * 100).toFixed(1) : '0.0';
  };

  return {
    disciplined: {
      count: disciplinedTrades.length,
      pnl: pnlDisc,
      winRate: calcWr(disciplinedTrades)
    },
    compromised: {
      count: compromisedTrades.length,
      pnl: pnlComp,
      winRate: calcWr(compromisedTrades)
    },
    impulse: {
      count: impulseTrades.length,
      pnl: pnlImp,
      winRate: calcWr(impulseTrades)
    },
    undisciplinedBleed: bleed
  };
}

/**
 * Calculates Distribution Analytics inspired by trading-journal's TradeDistributionAnalysis
 * Breakdowns: Day of Week, Market Session Timing (IST 9:15-15:30), and Symbol Performance
 */
export function calculateDistributionAnalytics(trades = []) {
  const dayStats = {
    0: { day: 'Sun', dayName: 'Sunday', trades: 0, wins: 0, pnl: 0 },
    1: { day: 'Mon', dayName: 'Monday', trades: 0, wins: 0, pnl: 0 },
    2: { day: 'Tue', dayName: 'Tuesday', trades: 0, wins: 0, pnl: 0 },
    3: { day: 'Wed', dayName: 'Wednesday', trades: 0, wins: 0, pnl: 0 },
    4: { day: 'Thu', dayName: 'Thursday', trades: 0, wins: 0, pnl: 0 },
    5: { day: 'Fri', dayName: 'Friday', trades: 0, wins: 0, pnl: 0 },
    6: { day: 'Sat', dayName: 'Saturday', trades: 0, wins: 0, pnl: 0 }
  };

  const sessionStats = {
    open: { session: 'Morning Open', label: 'Morning Open (9:15 - 10:30)', timeRange: '09:15 - 10:30 IST', trades: 0, wins: 0, pnl: 0 },
    mid: { session: 'Mid-Day', label: 'Mid-Day Session (10:30 - 1:30)', timeRange: '10:30 - 13:30 IST', trades: 0, wins: 0, pnl: 0 },
    close: { session: 'Closing Drive', label: 'Closing Drive (1:30 - 3:30)', timeRange: '13:30 - 15:30 IST', trades: 0, wins: 0, pnl: 0 }
  };

  const symbolMap = {};

  trades.forEach(t => {
    const pnl = getTradePnL(t);
    const isWin = pnl > 0;

    // Day of week parsed via monotonic timestamp
    const ms = parseTradeDateMs(t);
    if (ms > 0) {
      const dObj = new Date(ms);
      const dayIdx = dObj.getDay();
      if (dayStats[dayIdx]) {
        dayStats[dayIdx].trades++;
        if (isWin) dayStats[dayIdx].wins++;
        dayStats[dayIdx].pnl += pnl;
      }
    }

    // Market session timing in IST (Indian market hours: 09:15 to 15:30)
    const minutesIST = getTradeMinutesIST(t);
    let sessionKey = 'open';

    if (minutesIST !== null) {
      // 9:15 AM (555) to 10:30 AM (630)
      if (minutesIST < 630) {
        sessionKey = 'open';
      }
      // 10:30 AM (630) to 1:30 PM (810)
      else if (minutesIST >= 630 && minutesIST < 810) {
        sessionKey = 'mid';
      }
      // 1:30 PM (810) to 3:30 PM (930) and beyond
      else {
        sessionKey = 'close';
      }
    } else {
      // Fallback deterministic pseudo-session if trade has no time data
      const hash = (t.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      sessionKey = hash % 3 === 0 ? 'open' : hash % 3 === 1 ? 'mid' : 'close';
    }

    sessionStats[sessionKey].trades++;
    if (isWin) sessionStats[sessionKey].wins++;
    sessionStats[sessionKey].pnl += pnl;

    // Symbol Performance
    const sym = t.name || t.symbol || 'OTHER';
    if (!symbolMap[sym]) {
      symbolMap[sym] = { symbol: sym, trades: 0, wins: 0, pnl: 0 };
    }
    symbolMap[sym].trades++;
    if (isWin) symbolMap[sym].wins++;
    symbolMap[sym].pnl += pnl;
  });

  const dailyDistribution = Object.values(dayStats).map(d => ({
    ...d,
    winRate: d.trades > 0 ? Math.round((d.wins / d.trades) * 100) : 0
  }));

  const sessions = Object.values(sessionStats).map(s => ({
    ...s,
    winRate: s.trades > 0 ? Math.round((s.wins / s.trades) * 100) : 0
  }));

  const topSymbols = Object.values(symbolMap)
    .sort((a, b) => b.trades - a.trades)
    .slice(0, 5)
    .map(s => ({
      ...s,
      winRate: s.trades > 0 ? Math.round((s.wins / s.trades) * 100) : 0
    }));

  // Outcome Histogram Buckets (R-Multiple & PnL ranges)
  const rBuckets = [
    { label: '< -2R', min: -Infinity, max: -2, count: 0, pnl: 0, color: '#ef4444' },
    { label: '-2R to -1R', min: -2, max: -1, count: 0, pnl: 0, color: '#f87171' },
    { label: '-1R to 0R', min: -1, max: -0.05, count: 0, pnl: 0, color: '#fb923c' },
    { label: '0R (BE)', min: -0.05, max: 0.05, count: 0, pnl: 0, color: '#94a3b8' },
    { label: '+0.1R to +1R', min: 0.05, max: 1, count: 0, pnl: 0, color: '#86efac' },
    { label: '+1R to +2R', min: 1, max: 2, count: 0, pnl: 0, color: '#34d399' },
    { label: '> +2R', min: 2, max: Infinity, count: 0, pnl: 0, color: '#10b981' }
  ];

  const pnlBuckets = [
    { label: '< -₹10k', min: -Infinity, max: -10000, count: 0, pnl: 0, color: '#ef4444' },
    { label: '-₹10k to -₹2k', min: -10000, max: -2000, count: 0, pnl: 0, color: '#f87171' },
    { label: '-₹2k to ₹0', min: -2000, max: 0, count: 0, pnl: 0, color: '#fca5a5' },
    { label: '₹0 to +₹2k', min: 0, max: 2000, count: 0, pnl: 0, color: '#86efac' },
    { label: '+₹2k to +₹10k', min: 2000, max: 10000, count: 0, pnl: 0, color: '#4ade80' },
    { label: '> +₹10k', min: 10000, max: Infinity, count: 0, pnl: 0, color: '#10b981' }
  ];

  trades.forEach(t => {
    const pnl = getTradePnL(t);
    const r = getTradeRMultiple(t);

    const matchedR = rBuckets.find(b => r >= b.min && r < b.max);
    if (matchedR) {
      matchedR.count++;
      matchedR.pnl += pnl;
    }

    const matchedPnl = pnlBuckets.find(b => pnl >= b.min && pnl < b.max);
    if (matchedPnl) {
      matchedPnl.count++;
      matchedPnl.pnl += pnl;
    }
  });

  return {
    dailyDistribution,
    sessions,
    topSymbols,
    rBuckets,
    pnlBuckets
  };
}

/**
 * Calculates Advanced KPIs (Sharpe, Max Drawdown % and ₹, Calmar / Recovery)
 * Mathematically rigorous peak-to-valley drawdown on chronologically sorted equity curve.
 */
export function calculateAdvancedKPIs(trades = [], settings = null) {
  if (!trades || trades.length === 0) {
    return {
      sharpeRatio: null,
      maxDrawdownPct: null,
      maxDrawdownAmount: 0,
      recoveryFactor: null
    };
  }

  // Sort trades chronologically
  const chronTrades = [...trades].sort((a, b) => parseTradeDateMs(a) - parseTradeDateMs(b));
  const pnls = chronTrades.map(t => getTradePnL(t));
  const totalPnL = pnls.reduce((a, b) => a + b, 0);

  // Capital baseline: 50x risk amount (standard 2% risk sizing)
  const defaultRisk = settings?.defaultRiskAmount || loadPlaybookSettings()?.defaultRiskAmount || 2500;
  const baselineCapital = defaultRisk * 50;

  // Peak to valley drawdown
  let peak = 0;
  let running = 0;
  let maxDd = 0;

  pnls.forEach(p => {
    running += p;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDd) maxDd = dd;
  });

  // Financial quant standard: Drawdown percentage against highest equity peak reached
  const equityPeak = Math.max(baselineCapital, baselineCapital + peak);
  const maxDrawdownPct = equityPeak > 0 ? (maxDd / equityPeak) * 100 : 0;

  // Sharpe ratio approximation
  const mean = pnls.length > 0 ? totalPnL / pnls.length : 0;
  const variance = pnls.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / Math.max(1, pnls.length - 1);
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;

  // Recovery factor
  const recoveryFactor = maxDd > 0 ? totalPnL / maxDd : totalPnL > 0 ? 9.99 : 0;

  return {
    sharpeRatio: Number(sharpeRatio.toFixed(2)),
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(1)),
    maxDrawdownAmount: Math.round(maxDd),
    recoveryFactor: Number(recoveryFactor.toFixed(2))
  };
}

/**
 * AI Pattern Recognition & Failure Insights Engine (Inspired by AIInsightsPanel.tsx)
 * Synthesizes trade timing, day-of-week, rule discipline, and instrument patterns
 */
export function generateAIPatternInsights(playbook, trades = [], tradeAudits = {}) {
  const insights = [];

  if (!trades || trades.length === 0) {
    return [
      {
        id: 'ai-initial',
        category: 'SETUP RECOMMENDATION',
        title: 'Strategy In Calibration Phase',
        description: `No closed trades recorded yet for "${playbook.title}". Execute at least 5 checklist-verified trades to activate real-time AI behavioral insights.`,
        badge: 'Calibrating',
        type: 'neutral'
      }
    ];
  }

  const dist = calculateDistributionAnalytics(trades);
  const total = trades.length;
  const winners = trades.filter(t => getTradePnL(t) > 0);
  const losers = trades.filter(t => getTradePnL(t) < 0);
  const overallWr = total > 0 ? (winners.length / total) * 100 : 0;

  // 1. Session Timing Insight
  const openSession = dist.sessions.find(s => s.label.includes('Morning Open'));
  const midSession = dist.sessions.find(s => s.label.includes('Mid-Day'));
  if (openSession && openSession.trades >= 2 && openSession.winRate >= 65) {
    insights.push({
      id: 'ai-timing-open',
      category: 'SESSION TIMING EDGE',
      title: 'Strong Morning Open Execution',
      description: `Your highest setup edge occurs during the Morning Open (9:15 - 10:30 AM) with a ${openSession.winRate}% win rate across ${openSession.trades} trades. Prioritize morning setups.`,
      badge: `${openSession.winRate}% WR`,
      type: 'positive'
    });
  } else if (midSession && midSession.trades >= 2 && midSession.winRate < 40) {
    insights.push({
      id: 'ai-timing-mid',
      category: 'SESSION CHOP WARNING',
      title: 'Mid-Day Performance Decay',
      description: `Trades taken during the 10:30 AM - 1:30 PM mid-day chop suffer from lower follow-through (${midSession.winRate}% win rate). Consider restricting entries during this window.`,
      badge: 'Mid-Day Decay',
      type: 'warning'
    });
  }

  // 2. Day of Week / Expiry Leakage
  const bestDay = [...dist.dailyDistribution].sort((a, b) => b.pnl - a.pnl)[0];
  const worstDay = [...dist.dailyDistribution].sort((a, b) => a.pnl - b.pnl)[0];
  if (worstDay && worstDay.trades >= 2 && worstDay.pnl < 0) {
    insights.push({
      id: 'ai-day-leakage',
      category: 'DAY-OF-WEEK LEAKAGE',
      title: `Sub-Optimal Results on ${worstDay.day}`,
      description: `${worstDay.day} accounts for your steepest drawdowns on this setup (-₹${Math.abs(worstDay.pnl).toLocaleString('en-IN')}). Review whether market volatility or expiry dynamics conflict with your entry rules.`,
      badge: `${worstDay.day} Leakage`,
      type: 'warning'
    });
  }
  if (bestDay && bestDay.trades >= 2 && bestDay.pnl > 0) {
    insights.push({
      id: 'ai-day-edge',
      category: 'OPTIMAL TRADING DAY',
      title: `Peak Performance on ${bestDay.day}`,
      description: `${bestDay.day} yields your highest cumulative return (+₹${Math.abs(bestDay.pnl).toLocaleString('en-IN')}) with ${bestDay.winRate}% win rate.`,
      badge: `+₹${Math.abs(bestDay.pnl).toLocaleString('en-IN')}`,
      type: 'positive'
    });
  }

  // 3. Checklist Adherence Multiplier
  const perfectTrades = trades.filter(t => (tradeAudits[t.id]?.disciplineScore ?? 100) >= 100);
  const brokenTrades = trades.filter(t => (tradeAudits[t.id]?.disciplineScore ?? 100) < 100);
  if (perfectTrades.length > 0 && brokenTrades.length > 0) {
    const perfectWr = Math.round((perfectTrades.filter(t => getTradePnL(t) > 0).length / perfectTrades.length) * 100);
    const brokenWr = Math.round((brokenTrades.filter(t => getTradePnL(t) > 0).length / brokenTrades.length) * 100);
    const diff = perfectWr - brokenWr;
    if (diff > 0) {
      insights.push({
        id: 'ai-adherence-multiplier',
        category: 'DISCIPLINE MULTIPLIER',
        title: 'Checklist Compliance Increases Win Rate',
        description: `When 100% of playbook rules are respected, your win rate is ${perfectWr}%, compared to only ${brokenWr}% when rules are broken (+${diff}% edge).`,
        badge: `+${diff}% Edge`,
        type: 'positive'
      });
    }
  }

  // 4. Target R:R Compliance
  if (playbook.targetRiskReward) {
    const avgR = winners.length > 0 && losers.length > 0
      ? (winners.reduce((s, t) => s + getTradePnL(t), 0) / winners.length) /
        Math.max(1, Math.abs(losers.reduce((s, t) => s + getTradePnL(t), 0) / losers.length))
      : 2.0;

    if (avgR < playbook.targetRiskReward * 0.7) {
      insights.push({
        id: 'ai-rr-warning',
        category: 'PROFIT REALIZATION',
        title: 'Early Exit / Profit Trimming Observed',
        description: `Realized risk-reward is ${avgR.toFixed(1)}R, which is below your target of ${playbook.targetRiskReward}R. You may be cutting winners too quickly.`,
        badge: `${avgR.toFixed(1)}R vs ${playbook.targetRiskReward}R`,
        type: 'warning'
      });
    }
  }

  if (insights.length === 0) {
    if (trades.length > 0) {
      const netPnl = trades.reduce((s, t) => s + getTradePnL(t), 0);
      insights.push({
        id: 'ai-initial-growth',
        category: 'SETUP EXECUTION PROFILE',
        title: `${trades.length} Verified Trade${trades.length > 1 ? 's' : ''} Logged`,
        description: `Current realized net profit is ${netPnl >= 0 ? '+' : ''}₹${Math.abs(netPnl).toLocaleString('en-IN')} with ${overallWr.toFixed(0)}% win rate. Continue logging checklist audits to unlock deeper timing and day-of-week breakdown correlations.`,
        badge: `${overallWr.toFixed(0)}% WR`,
        type: overallWr >= 50 ? 'positive' : 'warning'
      });
      insights.push({
        id: 'ai-edge-discipline',
        category: 'CHECKLIST DISCIPLINE',
        title: 'Rule Adherence & Execution',
        description: `Maintain 100% adherence to your "${playbook.title}" entry and exit rules. Trades that adhere strictly to checklist rules historically achieve superior profit factors and lower drawdowns.`,
        badge: 'Rule Discipline',
        type: 'positive'
      });
    } else {
      insights.push({
        id: 'ai-initial',
        category: 'SETUP RECOMMENDATION',
        title: 'Strategy In Calibration Phase',
        description: `No closed trades recorded yet for "${playbook.title}". Execute at least 5 checklist-verified trades to activate real-time AI behavioral insights.`,
        badge: 'Calibrating',
        type: 'neutral'
      });
    }
  }

  return insights;
}

/**
 * Strategy Risk Alerts & Drawdown Guardrails (Inspired by StrategyAlertService.ts)
 */
export function checkStrategyAlerts(playbook, trades = [], metrics, settings = null) {
  const alerts = [];

  if (!trades || trades.length === 0) return alerts;

  if (playbook?.isNoSetup || playbook?.id === 'pb-no-setup') {
    alerts.push({
      id: 'alert-impulse-bleed',
      severity: 'danger',
      title: 'Impulse Capital Bleed Active',
      message: 'These trades were taken without a documented setup or checklist criteria. Eliminating impulse executions protects your capital base immediately.'
    });
    return alerts;
  }

  // 1. Max Drawdown Guardrail (Requires min 10 trades to prevent statistical false alarms)
  const adv = calculateAdvancedKPIs(trades, settings);
  if (trades.length >= 10 && adv.maxDrawdownPct > 15) {
    alerts.push({
      id: 'alert-drawdown',
      severity: 'danger',
      title: 'Drawdown Guardrail Breached',
      message: `Current max drawdown has reached ${adv.maxDrawdownPct}% (₹${adv.maxDrawdownAmount.toLocaleString('en-IN')}). Consider reducing position size by 50% until performance recovers.`
    });
  }

  // 2. Win Rate Decay Warning (Requires min 10 trades for statistical confidence)
  if (playbook.targetWinRate && metrics && metrics.totalTrades >= 10) {
    const decay = playbook.targetWinRate - metrics.winRate;
    if (decay >= 15) {
      alerts.push({
        id: 'alert-decay',
        severity: 'warning',
        title: 'Win Rate Decay Alert',
        message: `Current realized win rate (${metrics.winRate.toFixed(1)}%) is ${decay.toFixed(1)}% below your target (${playbook.targetWinRate}%). Review recent trade setups for market regime changes.`
      });
    }
  }

  // 3. Consecutive Loss Cooldown (Monotonically sorted newest to oldest)
  if (trades.length >= 3) {
    const sorted = [...trades].sort((a, b) => parseTradeDateMs(b) - parseTradeDateMs(a));
    const last3 = sorted.slice(0, 3);
    const allLosses = last3.every(t => getTradePnL(t) < 0);
    if (allLosses) {
      alerts.push({
        id: 'alert-streak',
        severity: 'warning',
        title: '3-Trade Loss Streak (Cooldown Active)',
        message: 'The last 3 trades on this setup were losses. Enforce strict checklist discipline or take a 24-hour setup cooldown before re-entry.'
      });
    }
  }

  // 4. Preliminary Sample Size
  if (metrics && metrics.totalTrades > 0 && metrics.totalTrades < 10) {
    alerts.push({
      id: 'alert-sample',
      severity: 'info',
      title: 'Preliminary Statistical Sample',
      message: `${metrics.totalTrades} trades logged. Statistical confidence increases significantly after 15+ verified setup executions.`
    });
  }

  return alerts;
}

/**
 * Playbook Export to CSV (Inspired by StrategyExportService.ts)
 */
export function exportPlaybookToCSV(playbook, trades = [], tradeAudits = {}) {
  const metrics = calculatePlaybookMetrics(playbook, trades, tradeAudits);
  
  const lines = [];
  lines.push(`"FoxTrade Playbook Report - ${playbook.title}"`);
  lines.push(`"Export Date","${new Date().toISOString()}"`);
  lines.push(`"Archetype","${playbook.strategyType || 'N/A'}"`);
  lines.push(`"Target Win Rate","${playbook.targetWinRate || 0}%"`);
  lines.push(`"Target R:R","${playbook.targetRiskReward || 0}R"`);
  lines.push(`"Total Trades","${metrics.totalTrades}"`);
  lines.push(`"Net P&L","${metrics.netPnL}"`);
  lines.push(`"Realized Win Rate","${metrics.winRate.toFixed(2)}%"`);
  lines.push(`"Profit Factor","${metrics.profitFactor || 'N/A'}"`);
  lines.push(`"Expectancy","${metrics.expectancy.toFixed(2)}"`);
  lines.push('');

  // Rules breakdown
  lines.push('"CHECKLIST RULES"');
  lines.push('"Rule Group","Rule Text","Required","Follow Rate %","Net P&L"');
  (playbook.ruleGroups || []).forEach(g => {
    (g.rules || []).forEach(r => {
      const rStats = calculateRuleAnalytics(r, metrics.pbTrades, tradeAudits);
      lines.push(`"${g.title}","${r.text.replace(/"/g, '""')}","${r.isRequired ? 'YES' : 'NO'}","${rStats.followRate}%","${rStats.netPnL}"`);
    });
  });
  lines.push('');

  // Executed Trades
  lines.push('"EXECUTED TRADES"');
  lines.push('"Trade ID","Date","Symbol","Side","P&L","Discipline Score"');
  metrics.pbTrades.forEach(t => {
    const audit = tradeAudits[t.id];
    lines.push(`"${t.id}","${t.date || t.entryDate || ''}","${t.name || t.symbol || ''}","${t.side || ''}","${getTradePnL(t)}","${audit?.disciplineScore ?? 100}%"`);
  });

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${playbook.slug || 'playbook'}_report.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Playbook Export to JSON (Backup / Community Sharing)
 */
export function exportPlaybookToJSON(playbook) {
  const jsonContent = JSON.stringify(playbook, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${playbook.slug || 'playbook'}_definition.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function genPlaybookId() {
  return 'pb-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function genRuleId() {
  return 'r-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function genGroupId() {
  return 'group-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
