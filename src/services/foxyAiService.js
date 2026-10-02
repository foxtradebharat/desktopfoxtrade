/**
 * foxyAiService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Multi-LLM Service for FoxTrade's built-in Foxy AI.
 * Supports:
 * - Google Gemini (gemini-2.5-flash, gemini-1.5-flash, gemini-1.5-pro) - Free tier available
 * - OpenAI (gpt-4o-mini, gpt-4o)
 * - Anthropic Claude (claude-3-5-sonnet, claude-3-5-haiku)
 * - DeepSeek (deepseek-chat, deepseek-reasoner)
 * - Groq (llama-3.3-70b-versatile, mixtral-8x7b-32768) - Free tier available
 * - OpenRouter (auto / any model)
 * - Offline Heuristic Engine (smart rule-based instant fallback)
 *
 * Keys and preferences are stored permanently in IndexedDB via configStore.
 */

import { getConfig, setConfig } from '../db/configStore.js';
import { getValidAccessToken, getActivePortfolioId, getTradesWithDeleted, triggerAutoSync } from '../db/index.js';
import {
  getFoxyChatHistory,
  saveFoxyChatHistory,
  getTraderCommitments,
  saveTraderCommitments,
  addTraderCommitment,
} from '../db/foxyStore.js';
import { calculateTradeDiagnostics } from './aiService.js';
import { runQuery, executeQueryAndFormat } from './tradeQueryEngine.js';
import { getOrComputeDNA, formatDNAForContext } from '../utils/traderDNA.js';
import { fetchAndCacheMarketData, computeMarketCorrelation, formatMarketContextForFoxy } from './marketContextService.js';
import { classifyTradesBatch, summarizeClassification } from '../utils/tradeClassifier.js';
import { parseRawTradeText, calculateIndianCharges, formatExtractedTradesForJournal } from '../utils/contractNoteParser.js';
import { calculateTiltmeterScore } from './tiltmeterService.js';
import { 
  calculateYearlyFundSummary, 
  formatFundManagementForFoxy, 
  getStoredCapitalChanges, 
  getAvailableFundYears 
} from '../utils/fundManagementCalculations.js';
import { 
  calculateTaxMonthlyBreakdown, 
  calculateIndianTaxClassification, 
  formatTaxAnalyticsForFoxy 
} from '../utils/taxAnalyticsCalculations.js';

export const AI_PROVIDERS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    keyPlaceholder: 'AIzaSy...',
    keyHelpUrl: 'https://aistudio.google.com/app/apikey',
    models: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview (Fastest)' },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
      { id: 'gemini-flash-latest', name: 'Gemini Flash Latest' },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
      { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite' }
    ],
    defaultModel: 'gemini-3-flash-preview'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    keyPlaceholder: 'sk-...',
    keyHelpUrl: 'https://platform.deepseek.com/api_keys',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1' }
    ],
    defaultModel: 'deepseek-chat'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    keyPlaceholder: 'sk-proj-...',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4o', name: 'GPT-4o' }
    ],
    defaultModel: 'gpt-4o-mini'
  },
  {
    id: 'groq',
    name: 'Groq',
    keyPlaceholder: 'gsk_...',
    keyHelpUrl: 'https://console.groq.com/keys',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' }
    ],
    defaultModel: 'llama-3.3-70b-versatile'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    keyPlaceholder: 'sk-ant-...',
    keyHelpUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' }
    ],
    defaultModel: 'claude-3-5-sonnet-20241022'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    keyPlaceholder: 'sk-or-v1-...',
    keyHelpUrl: 'https://openrouter.ai/keys',
    models: [
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' }
    ],
    defaultModel: 'google/gemini-2.5-flash'
  }
];

// Config Store Keys
const CONFIG_KEY_PROVIDER = 'foxy_ai_provider';
const CONFIG_KEY_MODEL = 'foxy_ai_model';
const CONFIG_KEY_API_KEY = 'foxy_ai_api_key';
const CONFIG_KEY_CHATS = 'foxy_ai_chats';
const CONFIG_KEY_WEEKLY_REPORT = 'foxy_last_weekly_report_ts';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Get active LLM configuration from IndexedDB
 */
export async function getFoxyConfig() {
  const provider = await getConfig(CONFIG_KEY_PROVIDER, 'gemini');
  let model = await getConfig(CONFIG_KEY_MODEL, 'gemini-flash-latest');
  if (!model || model.includes('1.5') || model.includes('2.5') || model.includes('2.0')) {
    model = 'gemini-flash-latest';
  }
  const apiKey = await getConfig(CONFIG_KEY_API_KEY, '');
  return { provider, model, apiKey };
}

/**
 * Automatically schedule a debounced Google Drive sync if user is authenticated
 */
async function scheduleFoxyDriveSync() {
  try {
    const token = await getValidAccessToken().catch(() => null);
    if (!token || token === 'demo-token') return;
    const portfolioId = await getActivePortfolioId().catch(() => 'default');
    const trades = await getTradesWithDeleted(portfolioId).catch(() => []);
    triggerAutoSync(portfolioId, token, trades);
  } catch (_) {
    // Non-blocking background sync notice
  }
}

/**
 * Save LLM configuration to IndexedDB
 */
export async function saveFoxyConfig({ provider, model, apiKey }) {
  if (provider) await setConfig(CONFIG_KEY_PROVIDER, provider);
  if (model) await setConfig(CONFIG_KEY_MODEL, model);
  if (apiKey !== undefined) await setConfig(CONFIG_KEY_API_KEY, apiKey.trim());
  scheduleFoxyDriveSync();
}

// Re-export structured trader commitments from foxyStore
export { getTraderCommitments, saveTraderCommitments, addTraderCommitment };

/**
 * Check if user is eligible to generate their weekly comprehensive AI report (1 per user per week)
 */
export async function getWeeklyReportQuota() {
  const lastTs = await getConfig(CONFIG_KEY_WEEKLY_REPORT, 0);
  const now = Date.now();
  const elapsed = now - Number(lastTs || 0);
  const canGenerate = elapsed >= WEEK_MS;
  const daysRemaining = Math.max(0, Math.ceil((WEEK_MS - elapsed) / (24 * 60 * 60 * 1000)));
  const nextAvailableDate = new Date(Number(lastTs) + WEEK_MS).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short'
  });
  return {
    canGenerate,
    lastTs: Number(lastTs),
    daysRemaining,
    nextAvailableDate
  };
}

/**
 * Record that a weekly comprehensive AI report was generated
 */
export async function recordWeeklyReportUsage() {
  await setConfig(CONFIG_KEY_WEEKLY_REPORT, Date.now());
}

/**
 * Test & validate user API key by pinging the selected provider
 */
export async function testFoxyApiKey(providerId, modelId, apiKey) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Please enter a valid API key.');
  }
  const key = apiKey.trim();

  if (providerId === 'gemini') {
    const candidateTestModels = [
      modelId,
      'gemini-3-flash-preview',
      'gemini-3.8-flash',
      'gemini-flash-latest',
      'gemini-3.5-flash',
      'gemini-flash-lite-latest'
    ].filter(m => m && !m.includes('1.5') && !m.includes('2.0') && !m.includes('2.5') && !m.includes('pro'));

    let lastErr = null;
    for (const testM of candidateTestModels) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${testM}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Ping. Respond with only "Pong".' }] }]
          })
        });
        if (res.ok) return true;
        const errData = await res.json().catch(() => ({}));
        lastErr = new Error(errData?.error?.message || `Gemini API returned status ${res.status}`);
        if (res.status === 503 || res.status === 429) continue; // try next candidate model
        throw lastErr;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Gemini API verification failed.');
  }

  if (providerId === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: modelId || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `OpenAI API returned status ${res.status}`);
    }
    return true;
  }

  if (providerId === 'deepseek') {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: modelId || 'deepseek-chat',
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `DeepSeek API returned status ${res.status}`);
    }
    return true;
  }

  if (providerId === 'groq') {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: modelId || 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Groq API returned status ${res.status}`);
    }
    return true;
  }

  if (providerId === 'openrouter') {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: modelId || 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `OpenRouter API returned status ${res.status}`);
    }
    return true;
  }

  return true;
}

/**
 * Load capital changes from localStorage for fund management context
 */
function loadCapitalChangesFromStorage(portfolioId = 'portfolio-default', year = '2026') {
  try {
    const key = `tradeontip_monthly_capital_${portfolioId}_${year}`;
    const fallback = `tradeontip_monthly_capital_${year}`;
    const raw = localStorage.getItem(key) || localStorage.getItem(fallback);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/**
 * Parse date string → { year: string, monthIdx: 0-11 } or null
 */
function parseDateFoxy(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s);
  if (ymd) return { year: ymd[1], monthIdx: parseInt(ymd[2], 10) - 1 };
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);
  if (dmy) return { year: dmy[3], monthIdx: parseInt(dmy[2], 10) - 1 };
  const d = new Date(s);
  if (!isNaN(d.getTime())) return { year: String(d.getFullYear()), monthIdx: d.getMonth() };
  return null;
}

function parseFullDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s);
  if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3]);
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Builds high-density, token-efficient trading journal context
 * Includes ALL modules: Fund Management, Deep Analytics, Tax Analytics, Position Sizing
 */
export function buildFoxyJournalContext(trades = [], portfolioId = 'portfolio-default', metrics = null, portfolioCapital = 0, capitalChanges = null) {
  if (!trades || trades.length === 0) {
    return 'No trades recorded in the journal yet.';
  }

  const diagnostics = calculateTradeDiagnostics(trades);
  // Active open positions strictly require openQty > 0
  const openTrades = trades.filter(t => (t.status === 'Open' || t.status === 'Partial') && (Number(t.openQty || 0) > 0));
  const closedWithPnl = trades.filter(t => (t.status === 'Closed' || t.status === 'Partial') && Number(t.pnl ?? t.pl ?? 0) !== 0);

  // ─── DEEP ANALYTICS ENGINE ────────────────────────────────────────────────

  // A. R-Multiple & Expectancy Engine
  let totalNetR = 0, totalWinR = 0, totalLossR = 0;
  let winRCount = 0, lossRCount = 0, tradesWithR = 0;
  const rList = [];

  closedWithPnl.forEach(t => {
    const r = parseFloat(t.rewardRisk ?? t.rMultiple);
    if (!isNaN(r) && r !== 0) {
      tradesWithR++;
      totalNetR += r;
      rList.push(r);
      if (r > 0) { winRCount++; totalWinR += r; }
      else { lossRCount++; totalLossR += Math.abs(r); }
    }
  });

  const avgWinR = winRCount > 0 ? (totalWinR / winRCount).toFixed(2) : '0.00';
  const avgLossR = lossRCount > 0 ? (totalLossR / lossRCount).toFixed(2) : '0.00';
  const winFraction = tradesWithR > 0 ? winRCount / tradesWithR : 0;
  const lossFraction = tradesWithR > 0 ? lossRCount / tradesWithR : 0;
  const expectancyR = (winFraction * parseFloat(avgWinR) - lossFraction * parseFloat(avgLossR)).toFixed(3);
  const profitFactor = totalLossR > 0 ? (totalWinR / totalLossR).toFixed(2) : (totalWinR > 0 ? '∞' : '0.00');

  // Sharpe-like R ratio
  let rMean = 0, rVariance = 0;
  if (rList.length > 1) {
    rMean = rList.reduce((a, b) => a + b, 0) / rList.length;
    rVariance = rList.reduce((a, r) => a + Math.pow(r - rMean, 2), 0) / (rList.length - 1);
  }
  const rStdDev = Math.sqrt(rVariance);
  const sharpeR = rStdDev > 0 ? (rMean / rStdDev).toFixed(2) : '0.00';

  // B. Position Sizing Simulation (2% and 1% fixed risk)
  const baseCap = 100000;
  let equity2pct = baseCap, equity1pct = baseCap;
  let maxDD2pct = 0, peak2pct = baseCap;

  closedWithPnl.forEach(t => {
    const r = parseFloat(t.rewardRisk ?? t.rMultiple);
    if (!isNaN(r) && r !== 0) {
      const gain2 = equity2pct * (0.02 * r);
      equity2pct = Math.max(0, equity2pct + gain2);
      if (equity2pct > peak2pct) peak2pct = equity2pct;
      const dd = ((peak2pct - equity2pct) / peak2pct) * 100;
      if (dd > maxDD2pct) maxDD2pct = dd;
      const gain1 = equity1pct * (0.01 * r);
      equity1pct = Math.max(0, equity1pct + gain1);
    }
  });

  const linear2pctGain1L = Math.round(totalNetR * 2000);
  const linear1pctGain1L = Math.round(totalNetR * 1000);
  const linear2pctGain5L = Math.round(totalNetR * 10000);

  // C. Win/Loss Streak Analysis
  let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0;
  const sorted = [...closedWithPnl].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  sorted.forEach(t => {
    const pnl = Number(t.pnl ?? t.pl ?? 0);
    if (pnl > 0) { curWin++; curLoss = 0; if (curWin > maxWinStreak) maxWinStreak = curWin; }
    else if (pnl < 0) { curLoss++; curWin = 0; if (curLoss > maxLossStreak) maxLossStreak = curLoss; }
  });

  // D. Holding Period Analysis
  const holdingDays = closedWithPnl.map(t => Number(t.holdingDays || 0)).filter(d => d > 0);
  const avgHoldingDays = holdingDays.length > 0 ? Math.round(holdingDays.reduce((a, b) => a + b, 0) / holdingDays.length) : 0;
  const intraday = closedWithPnl.filter(t => Number(t.holdingDays || 0) === 0).length;
  const swingShort = closedWithPnl.filter(t => { const d = Number(t.holdingDays || 0); return d >= 1 && d <= 5; }).length;
  const swingMedium = closedWithPnl.filter(t => { const d = Number(t.holdingDays || 0); return d >= 6 && d <= 20; }).length;
  const positional = closedWithPnl.filter(t => Number(t.holdingDays || 0) > 20).length;

  // E. Setup/Playbook Performance Matrix
  const setupsMap = {};
  trades.forEach(t => {
    const setup = t.setup || t.strategy || 'Discretionary';
    if (!setupsMap[setup]) setupsMap[setup] = { trades: 0, wins: 0, pnl: 0, netR: 0 };
    setupsMap[setup].trades++;
    const pnl = Number(t.pnl ?? t.pl ?? 0);
    setupsMap[setup].pnl += pnl;
    if (pnl > 0) setupsMap[setup].wins++;
    const r = parseFloat(t.rewardRisk ?? t.rMultiple);
    if (!isNaN(r)) setupsMap[setup].netR += r;
  });

  const setupRows = Object.entries(setupsMap)
    .sort((a, b) => b[1].pnl - a[1].pnl)
    .map(([setup, d]) => {
      const wr = d.trades > 0 ? Math.round((d.wins / d.trades) * 100) : 0;
      const sign = d.pnl >= 0 ? '+' : '';
      return `${setup}: ${d.trades} trades | ${wr}% WR | P&L: ${sign}₹${Math.round(d.pnl).toLocaleString('en-IN')} | Net R: ${d.netR.toFixed(1)}R`;
    })
    .join('\n  • ');

  // F. MAE / MFE Summary
  const maeList = closedWithPnl.map(t => Number(t.mae || t.maePercent || 0)).filter(v => v > 0);
  const mfeList = closedWithPnl.map(t => Number(t.mfe || t.mfePercent || 0)).filter(v => v > 0);
  const avgMAE = maeList.length > 0 ? (maeList.reduce((a, b) => a + b, 0) / maeList.length).toFixed(2) : 'N/A';
  const avgMFE = mfeList.length > 0 ? (mfeList.reduce((a, b) => a + b, 0) / mfeList.length).toFixed(2) : 'N/A';

  // G. Outlier Winners & Losers (Top 5)
  const sortedByPnL = [...closedWithPnl]
    .filter(t => t.name || t.symbol)
    .sort((a, b) => Number(b.pnl ?? 0) - Number(a.pnl ?? 0));

  const top5Wins = sortedByPnL.slice(0, 5).map(t => {
    const sym = t.name || t.symbol;
    const pnl = Math.round(Number(t.pnl ?? 0));
    const r = t.rewardRisk ? `${Number(t.rewardRisk).toFixed(1)}R` : '';
    return `${sym} (+₹${pnl.toLocaleString('en-IN')}, ${r}, ${t.setup || '-'}, ${t.date || '-'})`;
  }).join('; ');

  const top5Losses = sortedByPnL.slice(-5).reverse().map(t => {
    const sym = t.name || t.symbol;
    const pnl = Math.round(Number(t.pnl ?? 0));
    const r = t.rewardRisk ? `${Number(t.rewardRisk).toFixed(1)}R` : '';
    return `${sym} (₹${pnl.toLocaleString('en-IN')}, ${r}, ${t.setup || '-'}, ${t.date || '-'})`;
  }).join('; ');

  // H. Missing SL & Open Positions
  const missingSlPositions = openTrades
    .filter(t => !t.stopLoss && !t.sl && !t.tsl)
    .map(t => t.symbol || t.stockName || t.name).filter(Boolean);

  const openPositionsList = openTrades.map(t => {
    const sym = (t.symbol || t.stockName || t.name || 'TRADE').toUpperCase();
    const qty = t.openQty || t.qty;
    const entry = Number(t.avgEntry || t.entry || 0);
    const cmp = Number(t.cmp || entry || 0);
    const sl = (t.sl !== undefined && t.sl !== null && t.sl !== '' && !isNaN(Number(t.sl)) && Number(t.sl) > 0) ? Number(t.sl) : null;
    const tsl = (t.tsl !== undefined && t.tsl !== null && t.tsl !== '' && !isNaN(Number(t.tsl)) && Number(t.tsl) > 0) ? Number(t.tsl) : null;
    const unrealized = t.unrealized !== undefined ? `₹${Math.round(t.unrealized).toLocaleString('en-IN')}` : '₹0';
    const capitalAtRisk = t.capitalAtRisk ? `${Number(t.capitalAtRisk).toFixed(2)}%` : '-';
    let slInfo = sl !== null ? `SL: ₹${sl}` : 'NO SL (UNPROTECTED RISK)';
    if (sl !== null && cmp > 0) {
      const slDist = Math.abs(cmp - sl).toFixed(1);
      const slDistPct = ((Math.abs(cmp - sl) / cmp) * 100).toFixed(1);
      slInfo += ` (Dist: ₹${slDist} / ${slDistPct}%)`;
    }
    if (tsl) slInfo += ` | TSL: ₹${tsl}`;
    return `${sym}: ${qty} shares | Entry: ₹${entry} | CMP: ₹${cmp} | ${slInfo} | Unrealized: ${unrealized} | Capital at Risk: ${capitalAtRisk}`;
  }).join('\n  • ');

  // ─── FUND MANAGEMENT ENGINE ───────────────────────────────────────────────
  const currentYear = String(new Date().getFullYear());
  const effectiveCapChanges = capitalChanges || loadCapitalChangesFromStorage(portfolioId, currentYear);
  const fundSummary = calculateYearlyFundSummary(trades, effectiveCapChanges, currentYear);
  const fundFormatted = formatFundManagementForFoxy(fundSummary);

  // ─── TAX ANALYTICS & STATUTORY AUDIT ENGINE ───────────────────────────────
  const taxMonthlyBreakdown = calculateTaxMonthlyBreakdown(trades, {
    selectedYear: currentYear,
    periodMode: 'calendar',
    portfolioValue: portfolioCapital || fundSummary.startingCapital
  });
  const taxClassification = calculateIndianTaxClassification(trades, { selectedYear: currentYear });
  const taxFormatted = formatTaxAnalyticsForFoxy(taxMonthlyBreakdown, taxClassification);

  // ─── MISTAKE COST & PSYCHOLOGICAL LEAK ENGINE ────────────────────────────
  const avgDownTrades = closedWithPnl.filter(t => 
    Number(t.e2Price || 0) > 0 && 
    Number(t.e2Price) < Number(t.e1Price || t.entry) && 
    Number(t.pnl ?? t.pl ?? 0) < 0
  );
  const avgDownBleed = Math.abs(avgDownTrades.reduce((acc, t) => acc + Number(t.pnl ?? t.pl ?? 0), 0));

  const planViolationTrades = closedWithPnl.filter(t => 
    (t.planFollowed === false || t.planFollowed === 'No') && 
    Number(t.pnl ?? t.pl ?? 0) < 0
  );
  const planViolationBleed = Math.abs(planViolationTrades.reduce((acc, t) => acc + Number(t.pnl ?? t.pl ?? 0), 0));

  let negativeSetupBleed = 0;
  const negativeSetupsList = [];
  Object.entries(setupsMap).forEach(([setup, d]) => {
    const wr = d.trades > 0 ? (d.wins / d.trades) * 100 : 0;
    if (wr < 35 && d.pnl < 0) {
      negativeSetupBleed += Math.abs(d.pnl);
      negativeSetupsList.push(`${setup} (-₹${Math.round(Math.abs(d.pnl)).toLocaleString('en-IN')})`);
    }
  });

  const totalAvoidableBleed = Math.round(avgDownBleed + planViolationBleed + (negativeSetupBleed * 0.5));
  const potentialCleanPnL = Math.round(diagnostics.totalPnL + totalAvoidableBleed);

  // ─── WEEKLY PERFORMANCE SNAPSHOT (MOST RECENT TRADING WEEK) ──────────────
  const validDates = closedWithPnl.map(t => {
    const d = parseFullDate(t.date);
    return d ? { d, trade: t } : null;
  }).filter(Boolean).sort((a, b) => b.d - a.d);

  let weeklySummary = 'No weekly trades found.';
  let weeklyGrade = 'B';
  let weeklyScore = 75;

  if (validDates.length > 0) {
    const latestDate = validDates[0].d;
    const dayOfWeek = latestDate.getDay();
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const monday = new Date(latestDate);
    monday.setDate(latestDate.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weekTrades = validDates.filter(v => v.d >= monday && v.d <= sunday).map(v => v.trade);
    const weekTradesCount = weekTrades.length;
    const weekWins = weekTrades.filter(t => Number(t.pnl ?? 0) > 0).length;
    const weekLosses = weekTrades.filter(t => Number(t.pnl ?? 0) < 0).length;
    const weekWinRate = (weekWins + weekLosses > 0) ? Math.round((weekWins / (weekWins + weekLosses)) * 100) : 0;
    const weekPnL = Math.round(weekTrades.reduce((acc, t) => acc + Number(t.pnl ?? 0), 0));
    const weekNetR = weekTrades.reduce((acc, t) => {
      const r = parseFloat(t.rewardRisk ?? t.rMultiple);
      return !isNaN(r) ? acc + r : acc;
    }, 0);

    let scoreRisk = 22;
    const missingSlInWeek = weekTrades.filter(t => !t.sl && !t.stopLoss).length;
    if (missingSlInWeek > 0) scoreRisk -= 10;
    if (weekLosses > 0 && Math.abs(weekPnL) > 5000) scoreRisk -= 4;

    let scoreSetup = 20;
    const badSetupInWeek = weekTrades.filter(t => (t.setup || '').toLowerCase().includes('pivot') || (t.setup || '').toLowerCase().includes('cheat')).length;
    if (badSetupInWeek > 0) scoreSetup -= Math.min(10, badSetupInWeek * 3);

    let scorePayoff = 20;
    if (weekWinRate >= 50) scorePayoff += 4;
    else if (weekWinRate < 35) scorePayoff -= 6;

    let scoreDiscipline = 22;
    const planNoInWeek = weekTrades.filter(t => t.planFollowed === false || t.planFollowed === 'No').length;
    if (planNoInWeek > 0) scoreDiscipline -= (planNoInWeek * 5);

    weeklyScore = Math.max(10, Math.min(100, scoreRisk + scoreSetup + scorePayoff + scoreDiscipline));
    weeklyGrade = weeklyScore >= 90 ? 'A+' : weeklyScore >= 80 ? 'A' : weeklyScore >= 70 ? 'B' : weeklyScore >= 60 ? 'C' : weeklyScore >= 50 ? 'D' : 'F';

    const monStr = monday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const sunStr = sunday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    weeklySummary = `Week of ${monStr} - ${sunStr}: ${weekTradesCount} trades | ${weekWinRate}% WR | Gross P/L: ${weekPnL >= 0 ? '+' : ''}₹${weekPnL.toLocaleString('en-IN')} | Net R: ${weekNetR >= 0 ? '+' : ''}${weekNetR.toFixed(2)}R | Executive Grade: ${weeklyGrade} (${weeklyScore}/100)`;
  }

  // ─── AI BEHAVIORAL MISTAKE & PLAYBOOK TAXONOMY ────────────────────────────
  const classifiedTrades = classifyTradesBatch(trades);
  const classificationSummary = summarizeClassification(classifiedTrades);
  const topMistakeRows = classificationSummary.topMistakes.slice(0, 5).map(m => 
    `${m.mistake}: ${m.count} trades`
  ).join('\n  • ');

  // ─── COMPLETE EXECUTION LOG (ENRICHED WITH PSYCHOLOGY & PLAN AUDIT) ───────
  // ─── RECENT EXECUTION LOG (TOKEN-OPTIMIZED FOR SPEED & ACCURACY) ───────────
  const recentTrades = trades.length > 30 ? trades.slice(-25) : trades;
  const csvHeader = "#|Date|Symbol|Type|Setup|Qty|Entry|Exit|SL|PnL|R|Status|Days|Plan|ExitTrig|AvgDown|Notes";
  const csvRows = recentTrades.map((t, idx) => {
    const sym = (t.name || t.symbol || 'DRAFT').toUpperCase();
    const type = t.type || 'Buy';
    const setup = t.setup || '-';
    const qty = t.openQty || t.qty || 0;
    const entry = Math.round(Number(t.avgEntry || t.entry || 0));
    const exit = Math.round(Number(t.avgExitPrice || t.exitPrice || 0));
    const sl = Math.round(Number(t.sl || 0));
    const pnl = Math.round(Number(t.pnl ?? t.pl ?? 0));
    const r = (t.rewardRisk !== null && t.rewardRisk !== undefined && !isNaN(Number(t.rewardRisk)))
      ? Number(t.rewardRisk).toFixed(2) : '-';
    const status = t.status || 'Open';
    const days = t.holdingDays || 0;
    const plan = (t.planFollowed === true || t.planFollowed === 'Yes') ? 'YES' : ((t.planFollowed === false || t.planFollowed === 'No') ? 'NO' : '-');
    const exitTrig = t.exitTrigger ? String(t.exitTrigger).slice(0, 10) : '-';
    const avgDown = (Number(t.e2Price || 0) > 0 && Number(t.e2Price) < Number(t.e1Price || t.entry)) ? 'YES' : 'NO';
    const rawNote = String(t.quickNote || t.notes || '').replace(/[\r\n|]/g, ' ').trim();
    const noteSnippet = rawNote ? rawNote.slice(0, 40) : '-';
    return `${idx + 1}|${t.date || '-'}|${sym}|${type}|${setup}|${qty}|${entry}|${exit}|${sl}|${pnl}|${r}|${status}|${days}|${plan}|${exitTrig}|${avgDown}|${noteSnippet}`;
  });
  const fullTradeCsv = [csvHeader, ...csvRows].join('\n');

  // Tiltmeter & Psychology Guard computation
  const tilt = calculateTiltmeterScore(trades);

  // Exact Single Source of Record for Header Stat Cards
  const exactTotalTrades = metrics?.totalTrades ?? diagnostics.totalTrades;
  const exactOpenPositions = metrics?.openPositions ?? diagnostics.openPositions;
  const exactWinRate = metrics?.winRate ?? diagnostics.winRatePct;
  const exactGrossRealizedPL = metrics?.grossRealizedPL !== undefined ? Number(metrics.grossRealizedPL) : diagnostics.totalPnL;
  const exactUnrealizedPL = metrics?.unrealizedPL !== undefined ? Number(metrics.unrealizedPL) : diagnostics.unrealizedPnL;
  const exactUnrealizedPLPct = metrics?.unrealizedPLPct ?? '0.00';
  const exactCapitalAtRiskPct = metrics?.capitalAtRisk ?? '0.00';
  const exactTotalRisk = metrics?.totalRisk !== undefined ? Number(metrics.totalRisk) : 0;
  const exactTotalInvested = metrics?.totalInvested !== undefined ? Number(metrics.totalInvested) : 0;
  const exactPortfolioCapital = Number(metrics?.portfolioCapital || portfolioCapital || 0);

  // Institutional Sanity Check for % Invested (protect against tiny cash denominator)
  let exactPercentInvested = metrics?.percentInvested ?? '0.00';
  const rawInvested = Number(exactPercentInvested);
  if ((rawInvested > 100 || isNaN(rawInvested)) && exactTotalInvested > 0 && exactPortfolioCapital > 0) {
    exactPercentInvested = Math.min(100, (exactTotalInvested / exactPortfolioCapital) * 100).toFixed(2);
  }

  const exactProfitRiskPct = metrics?.profitRisk ?? '0.00';
  const exactProfitProtected = metrics?.profitProtected !== undefined ? Number(metrics.profitProtected) : 0;
  const exactProfitProtectedPct = metrics?.profitProtectedPct ?? '0.00';
  const exactGrossPFImpact = metrics?.grossPFImpact ?? '0.00';

  // Institutional Sanity Check for Drawdown (DD = (Peak - Current) / Peak * 100; cannot be < -100%)
  let exactDrawdownAmt = metrics?.currentDrawdownAmount !== undefined ? Number(metrics.currentDrawdownAmount) : 0;
  let exactDrawdownPct = metrics?.currentDrawdown ?? '0.00';
  const rawDd = Number(exactDrawdownPct);
  if (rawDd < -100 || isNaN(rawDd)) {
    const baseEquity = exactPortfolioCapital > 0 ? exactPortfolioCapital : 100000;
    const peakEquity = baseEquity + exactDrawdownAmt;
    if (peakEquity > 0 && exactDrawdownAmt > 0) {
      exactDrawdownPct = (-((exactDrawdownAmt / peakEquity) * 100)).toFixed(2);
    } else {
      exactDrawdownPct = '0.00';
    }
  }

  return `
[FOXTRADE OFFICIAL STATS & DATA COCKPIT — ${currentYear}]
================================================================================
LIVE DASHBOARD HEADER STAT CARDS (EXACT SYSTEM OF RECORD — ZERO HALLUCINATION):
- Total Recorded Trades: ${exactTotalTrades}
- Active Open Positions: ${exactOpenPositions} (strictly openQty > 0)
- Win Rate (FoxTrade P/L Method): ${exactWinRate}%
- Gross Realized P/L: ${exactGrossRealizedPL >= 0 ? '▲ +' : '▼ '}₹${Math.round(Math.abs(exactGrossRealizedPL)).toLocaleString('en-IN')}
- Total Unrealized P/L (open positions): ${exactUnrealizedPL >= 0 ? '▲ +' : '▼ '}₹${Math.round(Math.abs(exactUnrealizedPL)).toLocaleString('en-IN')} (${exactUnrealizedPLPct}% of portfolio)
- Capital at Risk (Downside to SL): ${exactCapitalAtRiskPct}% (₹${Math.round(exactTotalRisk).toLocaleString('en-IN')})
- Profit Risk: ${exactProfitRiskPct}%
- Profit Protected: ₹${Math.round(exactProfitProtected).toLocaleString('en-IN')} (${exactProfitProtectedPct}% of portfolio)
- % Invested: ${exactPercentInvested}% (₹${Math.round(exactTotalInvested).toLocaleString('en-IN')})
- Current Pre-tax Drawdown: ${exactDrawdownPct}% (₹${Math.round(exactDrawdownAmt).toLocaleString('en-IN')})
- Portfolio Capital Base: ₹${Math.round(exactPortfolioCapital).toLocaleString('en-IN')}
- Gross PF Impact %: ${exactGrossPFImpact}%
- Open Positions with NO Stop Loss: ${missingSlPositions.length > 0 ? missingSlPositions.join(', ') : 'None — 100% SL coverage'}
CRITICAL INSTRUCTION: When asked about ANY header stat card metric (Gross Realized P&L, Win Rate, Capital at Risk, Invested %, Drawdown, etc.), ALWAYS quote these exact figures from the LIVE DASHBOARD HEADER STAT CARDS above. Never recalculate or estimate them differently.

================================================================================
REAL-TIME TILTMETER & TRADER PSYCHOLOGY GUARD:
- Emotional State: ${tilt.status} (Tilt Risk Score: ${tilt.score}/100)
- Verdict: ${tilt.verdict}
- Recommended Protocol: ${tilt.action}
${tilt.triggers && tilt.triggers.length > 0 ? '- Active Emotional Triggers:\n' + tilt.triggers.map(tr => `  • [${tr.level}] ${tr.title}: ${tr.desc}`).join('\n') : '- No active emotional risk triggers detected. Execution psychology is calm.'}

================================================================================
DEEP ANALYTICS — RISK & EXPECTANCY:
- Total Net R-Multiple Accumulated: ${totalNetR >= 0 ? '+' : ''}${totalNetR.toFixed(2)}R across ${tradesWithR} evaluated trades
- Total Win R: +${totalWinR.toFixed(2)}R | Total Loss R: -${totalLossR.toFixed(2)}R
- Avg Win R: +${avgWinR}R | Avg Loss R: -${avgLossR}R
- Expectancy (R): ${parseFloat(expectancyR) >= 0 ? '+' : ''}${expectancyR}R per trade (POSITIVE = edge exists)
- Profit Factor: ${profitFactor} (>1.5 = good, >2.0 = strong)
- Sharpe-like R Ratio: ${sharpeR} (higher = more consistent edge)
- Win Streak Max: ${maxWinStreak} | Loss Streak Max: ${maxLossStreak}
- Avg Holding Period: ${avgHoldingDays} days
  • Intraday (0 days): ${intraday} trades
  • Short Swing (1–5 days): ${swingShort} trades
  • Medium Swing (6–20 days): ${swingMedium} trades
  • Positional (>20 days): ${positional} trades
- MAE Avg: ${avgMAE}% | MFE Avg: ${avgMFE}% (N/A = column not enabled in journal)

================================================================================
FIXED-RISK POSITION SIZING SIMULATIONS:
- SIMULATION A — FIXED 2% RISK PER TRADE:
  * Linear Return: ${totalNetR >= 0 ? '+' : ''}${(totalNetR * 2).toFixed(2)}% | On ₹1L: ${linear2pctGain1L >= 0 ? '+' : ''}₹${Math.abs(linear2pctGain1L).toLocaleString('en-IN')} | On ₹5L: ${linear2pctGain5L >= 0 ? '+' : ''}₹${Math.abs(linear2pctGain5L).toLocaleString('en-IN')}
  * Compounded Equity (start ₹1,00,000): ₹${equity2pct.toLocaleString('en-IN')} (${equity2pct >= baseCap ? '+' : ''}${(((equity2pct - baseCap) / baseCap) * 100).toFixed(1)}% return)
  * Max Drawdown in 2% run: ${maxDD2pct.toFixed(1)}%
- SIMULATION B — FIXED 1% RISK PER TRADE:
  * Linear Return: ${totalNetR >= 0 ? '+' : ''}${(totalNetR * 1).toFixed(2)}% | On ₹1L: ${linear1pctGain1L >= 0 ? '+' : ''}₹${Math.abs(linear1pctGain1L).toLocaleString('en-IN')}
  * Compounded Equity (start ₹1,00,000): ₹${equity1pct.toLocaleString('en-IN')}
- POSITION SIZING ROOT CAUSE DIAGNOSIS:
  Edge exists (+${totalNetR.toFixed(1)}R net), but rupee P/L is ${diagnostics.totalPnL >= 0 ? 'positive' : 'negative'} (₹${diagnostics.totalPnL.toLocaleString('en-IN')}).
  ${diagnostics.totalPnL < 0 ? 'CAUSE: Erratic position sizing — oversized losses, undersized winners. Fix: strict fixed-fractional risk (1-2% per trade via qty = capital × risk% / SL distance).' : 'Position sizing is consistent with edge performance.'}

================================================================================
FUND MANAGEMENT — DYNAMIC CAPITAL & PERFORMANCE MATRIX (${currentYear}):
${fundFormatted}

================================================================================
TAX ANALYTICS & STATUTORY CHARGES AUDIT (${currentYear}):
${taxFormatted}

================================================================================
MISTAKE COST & PSYCHOLOGICAL LEAK AUDIT (WHAT MISTAKES COST THIS ACCOUNT):
- Averaging Down on Losers: ${avgDownTrades.length} trades | Cumulative Bleed: ▼ -₹${avgDownBleed.toLocaleString('en-IN')}
- Plan Violations (planFollowed = No): ${planViolationTrades.length} trades | Cumulative Bleed: ▼ -₹${planViolationBleed.toLocaleString('en-IN')}
- Destructive Negative-Expectancy Setups: ${negativeSetupsList.join(', ') || 'None'} | Bleed: ▼ -₹${Math.round(negativeSetupBleed).toLocaleString('en-IN')}
- TOTAL AVOIDABLE EMOTIONAL BLEED: ▼ -₹${totalAvoidableBleed.toLocaleString('en-IN')}
- POTENTIAL CLEAN-EXECUTION P/L (If avoidable leaks eliminated): ${potentialCleanPnL >= 0 ? '▲ +' : '▼ -'}₹${Math.abs(potentialCleanPnL).toLocaleString('en-IN')}

================================================================================
LATEST WEEKLY PERFORMANCE SNAPSHOT:
- ${weeklySummary}

================================================================================
AI BEHAVIORAL MISTAKE & PLAYBOOK TAXONOMY CLASSIFICATION:
- Total Trades Analyzed: ${classificationSummary.totalTrades}
- Clean Execution Trades: ${classificationSummary.cleanTrades} (${Math.round((classificationSummary.cleanTrades / (classificationSummary.totalTrades || 1)) * 100)}%)
- Trades with Behavioral Mistakes: ${classificationSummary.mistakeTrades}
- Average Execution Quality Score: ${classificationSummary.avgExecutionScore}/100
- Total Financial Bleed from Mistakes: ▼ -₹${classificationSummary.totalMistakeBleed.toLocaleString('en-IN')}
- Top Recurring Mistake Categories:
  • ${topMistakeRows || 'None'}

================================================================================
ACTIVE OPEN HOLDINGS (${exactOpenPositions}):
  • ${openPositionsList || 'None'}

================================================================================
SETUP & PLAYBOOK PERFORMANCE MATRIX:
  • ${setupRows || 'None'}

================================================================================
TOP 5 OUTLIER WINNERS:
${top5Wins || 'None'}

TOP 5 OUTLIER LOSERS:
${top5Losses || 'None'}

================================================================================
RECENT EXECUTION LOG (${recentTrades.length} OF ${trades.length} TRADES IN CSV):
${fullTradeCsv}
NOTE: Full journal contains ${trades.length} trades. The ${recentTrades.length} most recent trades are listed above. To search, filter, count, group, or list any trades across the complete journal, invoke the run_trade_query tool.
================================================================================
`.trim();
}

/**
 * System Prompt for Foxy AI — with FoxTrade calculation formulas and response formatting rules
 */
export function getFoxySystemPrompt(journalContext) {
  return `You are "Foxy AI", FoxTrade's resident quantitative risk officer, automated trading journal intelligence, and behavioral performance coach.
You advise Indian equity and derivatives traders with uncompromising mathematical rigor, absolute fidelity to their real journal records, and actionable tactical clarity.

${journalContext}

═══════════════════════════════════════════════════════════════════
FOXTRADE CALCULATION METHODOLOGY (KNOW THESE TO RULE OUT CONFLICTS):
═══════════════════════════════════════════════════════════════════

1. WIN RATE = wins / (wins + losses) — breakeven trades (pnl = 0) are EXCLUDED from the count.
   Formula: Win Rate % = (count of trades where pnl > 0) / (count of trades where pnl ≠ 0) × 100

2. GROSS REALIZED P/L = sum of pnl for ALL Closed + Partial status trades (not just fully closed).
   Partial = some exits done, openQty > 0 still remaining. Their booked portion IS included.

3. OPEN POSITIONS = trades where (status = 'Open' OR status = 'Partial') AND openQty > 0.
   Ghost rows with status='Open' but openQty=0 are NOT counted.

4. R-MULTIPLE (rewardRisk field) = realized pnl / initial risk per unit × 1
   Initial risk per unit = (avgEntry - SL) for long trades
   Pre-calculated by FoxTrade's Calculation Engine for each trade.

5. CAPITAL AT RISK (openHeat) = (entry - SL) × openQty / portfolioCapital × 100
   Represents the % of portfolio at risk if SL is hit on an open position.

6. PF IMPACT % = (realized pnl / portfolioCapital) × 100
   Shows what % of the portfolio this single trade affected.

7. POSITION SIZING FORMULA (for fixed-risk sizing):
   Quantity = (Account Capital × Risk%) / (Entry Price − Stop Loss Price)
   Example: ₹5,00,000 × 1% / (₹500 − ₹480) = ₹5,000 / ₹20 = 250 shares

8. PROFIT FACTOR = Total Win R / Total Loss R (or Total Gross Wins / Total Gross Losses in ₹)
   >1 = profitable system, >1.5 = good, >2 = strong

9. EXPECTANCY (R) = (Win Rate × Avg Win R) − (Loss Rate × Avg Loss R)
   Positive = edge exists, negative = system loses money over time statistically

10. STATUS LIFECYCLE: Open → Partial (partial exits, openQty > 0 still) → Closed (openQty = 0)
    Fund Management monthly P/L uses EXIT date for attribution; Dashboard uses ENTRY date.

11. FUND MANAGEMENT COMPOUNDING:
    Starting Capital[month] = Previous FinalCapital + Added − Withdrawn
    Final Capital[month] = Starting Capital + Net P/L
    % Return = Net P/L / Starting Capital × 100

12. TAX CLASSIFICATION (Indian Statutory Tax Law — Union Budget 2024 Slabs):
    - F&O DERIVATIVES: Non-Speculative Business Income (taxed at individual slab rates; audit under Section 44AB if turnover thresholds met).
    - INTRADAY EQUITY: Speculative Business Income (holding = 0 days, taxed at applicable slab rates).
    - STCG (Short-Term Capital Gains): Delivery equity held ≤ 365 days (taxed at 20% under Section 111A post-Budget 2024).
    - LTCG (Long-Term Capital Gains): Delivery equity held > 365 days (taxed at 12.5% above ₹1.25 Lakh exemption under Section 112A).
    - STT (Securities Transaction Tax): 0.1% on delivery sell side; 0.125% on option exercise; 0.02% on futures sell.

═══════════════════════════════════════════════════════════════════
RESPONSE RULES — MANDATORY FORMAT:
═══════════════════════════════════════════════════════════════════

1. STRICT FACTUAL FIDELITY (ZERO HALLUCINATION):
   - Every statistic, scrip name, rupee figure, date, and percentage MUST come from the FoxTrade dataset above.
   - Never invent, assume, or extrapolate trades, prices, or numbers not present in the data.

2. COLOR-CODED P/L FORMAT (ALWAYS):
   - Positive P/L values: prefix with ▲ and show as +₹X,XX,XXX (e.g., ▲ +₹12,500)
   - Negative P/L values: prefix with ▼ and show as -₹X,XX,XXX (e.g., ▼ -₹3,200)
   - Positive percentages: prefix with ▲ (e.g., ▲ +2.4%)
   - Negative percentages: prefix with ▼ (e.g., ▼ -1.8%)

3. RESPONSE STRUCTURE (UNCLUTTERED, MINIMALIST & INTEL-GRADE):
   - NEVER use markdown header hashes (#, ##, ###, ####). For section headings, ALWAYS write bold text like **Section Title** on its own line.
   - NEVER use asterisk bullets (*). ALWAYS use standard pointer bullet points (•).
   - NEVER use horizontal rule dividers like ---, *** or ASCII separator boxes.
   - Keep answers beautifully uncluttered, executive, visually clear, and easy to read.
   - Use **bold** for key numbers, scrip names, and conclusions.
   - Maximum 3-4 lines per bullet point.
   - Use markdown tables when comparing multiple trades or setups.
   - NEVER output SEBI disclaimer boilerplate.

4. CITE SPECIFIC SCRIPS AND TRADES:
   - When discussing setups, losses, or wins, cite exact scrip names from the execution log.
   - Reference trade dates when relevant (e.g., "RRKABEL entry 2024-08-12").

5. INDIAN MARKET CONVENTIONS:
   - Use ₹ (not $), Lakhs (not thousands), Crores (not millions).
   - 1 Lakh = ₹1,00,000 | 1 Crore = ₹1,00,00,000
   - Reference Nifty, Bank Nifty, NSE/BSE conventions where relevant.

6. QUANTITATIVE SIMULATION PROTOCOL:
   - For "what if I risk X%" questions: directly reference the pre-computed simulation tables above.
   - Show the position sizing formula explicitly.
   - Explain the R-multiple edge vs rupee P/L disparity if relevant.

7. TOOL USE — ZERO-HALLUCINATION QUERY PROTOCOL:
   - You have the run_trade_query tool. Use it for ANY question requiring precise counting, filtering, grouping, or aggregation.
   - Examples: "How many trades on Thursdays?", "Win rate for Breakout setups in Q3?", "All trades where R < -1", "Best setup by profit factor this year?"
   - NEVER guess when the tool gives exact answers. Always call run_trade_query first, then synthesize.

8. GENERATIVE UI BLOCKS — USE THESE IN EVERY ANALYTICAL RESPONSE:
   Embed these special blocks for visual impact. The UI renders them as interactive visual cards.
   - [METRIC: Label | Value | color]  — color: green/red/blue/orange/gray
     Example: [METRIC: Win Rate | 42% | orange]  [METRIC: Profit Factor | 1.42 | green]
   - [TABLE: Col1,Col2,Col3 | row1v1,row1v2,row1v3 | row2v1,row2v2,row2v3]
     Example: [TABLE: Setup,Trades,WinRate | Breakout,45,▲62% | Reversal,12,▼28%]
   - [VERDICT: score | label | color]  — score 0-100
     Example: [VERDICT: 68 | REDUCE SIZE | orange]
   - [CHART: bar | Label1:val1,Label2:val2,Label3:val3]
     Example: [CHART: bar | Mon:38,Tue:55,Wed:61,Thu:44,Fri:29]
   Rules: Start responses with 2-4 [METRIC] blocks. Use [TABLE] when comparing 3+ items. Use [CHART] for time/day patterns.

9. MARKET CONTEXT AWARENESS:
   - If VIX/Nifty correlation data is in context, reference it when analysing losses or drawdowns.
   - Example: "72% of your losses occurred when India VIX > 18 — reduce position size in high-volatility regimes."
   - Classify market conditions as Bull (Nifty trending up, VIX < 14) / Bear (Nifty falling, VIX > 18) / Neutral.

10. AUTOMATED END-OF-DAY (EOD) SESSION REVIEW PROTOCOL:
   When asked for an EOD review, daily recap, session debrief, or when user clicks EOD:
   - Identify trades taken today (or the most recent trading date in the journal if today has no trades). State the specific date being reviewed clearly at the top.
   - Deliver an institutional 5-pillar debrief:
     1) TOP DASHBOARD: Start immediately with 3-4 [METRIC: ...] cards (e.g. Session P/L, Trades Taken, Win Rate, Discipline Score) followed by [VERDICT: score | label | color] indicating execution quality (e.g., [VERDICT: 85 | DISCIPLINED EXECUTION | green] or [VERDICT: 40 | HIGH IMPULSIVITY | red]).
     2) EXECUTION BREAKDOWN: Scrip-by-scrip breakdown of entries, exits, R-multiple captured, and whether trade plans and stop losses were strictly honored.
     3) BEHAVIORAL & EMOTIONAL AUDIT: Explicitly audit for FOMO, revenge trades after a loss, oversizing, or hesitation. Relate to Trader Behavioral DNA.
     4) REGIME & BENCHMARK ALIGNMENT: Relate session performance to Nifty 50 trend and India VIX volatility environment.
     5) TOMORROW'S GAME PLAN: 3 concrete, non-negotiable action rules for next market open (e.g., max daily loss limit, specific focus setup, max position size).

11. ON-DEMAND WEEKLY REPORT CARD & ₹ MISTAKE COST PROTOCOL:
   When asked for a weekly report card, weekly review, mistake cost audit, or when user clicks Weekly:
   - Identify the trading week being reviewed (cite Monday to Sunday dates from LATEST WEEKLY PERFORMANCE SNAPSHOT above).
   - Deliver an institutional 5-part executive debrief:
     1) TOP REPORT CARD DASHBOARD:
        - Start immediately with [VERDICT: score | GRADE: X | color] (e.g. [VERDICT: 84 | GRADE: A | green], [VERDICT: 72 | GRADE: B | green], [VERDICT: 58 | GRADE: C | orange], or [VERDICT: 42 | GRADE: D | red]).
        - Render 4 [METRIC: ...] cards:
          * [METRIC: Weekly Net P/L | +/-₹... | color]
          * [METRIC: Win Rate | ...% | color]
          * [METRIC: ₹ Mistake Leak | -₹... | red]
          * [METRIC: Clean Execution P/L | +/-₹... | green]
     2) 4-PILLAR REPORT CARD EVALUATION:
        - Grade Risk Management (Stop loss compliance, max risk per trade): Grade A-F with 2 lines of quantitative justification.
        - Grade Setup Discipline (Filtering high-expectancy setups vs banned setups): Grade A-F with 2 lines of quantitative justification.
        - Grade Payoff & Expectancy (Profit factor, holding duration, avg win/loss): Grade A-F with 2 lines of quantitative justification.
        - Grade Emotional Control (Revenge trading score, FOMO, sizing consistency): Grade A-F with 2 lines of quantitative justification.
     3) "WHAT DID YOUR MISTAKES COST YOU?" (₹ LEAK AUDIT):
        - Render a structured table comparing avoidable errors:
          [TABLE: Mistake Category,Trades,Total ₹ Bleed,Actionable Antidote | Averaging Down on Losers,X,-₹...,Hard Stop Invalidation | Plan Violations,Y,-₹...,Pre-Trade Checklist Rule | Destructive/Banned Setups,Z,-₹...,Immediate Trading Quarantine]
        - Conclude with the explicit punchline: "If you plugged these emotional leaks, your net realized P/L would be [Clean Execution P/L]."
     4) STAR OF THE WEEK vs COSTLIEST MISTAKE:
        - Cite the single best executed trade of the week (scrip, entry, R-captured, plan followed).
        - Cite the single costliest trade of the week and the behavioral mistake that triggered it.
     5) WEEKEND HOMEWORK DRILL (BEFORE MONDAY 9:15 AM OPEN):
        - 2 concrete, non-negotiable drills for the weekend (e.g., chart review on losing setups, setting hard bracket orders).

12. TRADE PLAYBOOK AI AUTO-TAGGER & MISTAKE CLASSIFIER PROTOCOL:
   When asked to classify trades, audit mistakes, tag untagged setups, or when user clicks 'Auto-Tag':
   - Reference the AI BEHAVIORAL MISTAKE & PLAYBOOK TAXONOMY CLASSIFICATION in context.
   - Deliver an institutional 4-part classification report:
     1) CLASSIFICATION DASHBOARD:
        - Start immediately with [VERDICT: score | PRIMARY LEAK: X | color] (e.g. [VERDICT: 71 | PRIMARY LEAK: FOMO / CHASED | orange]).
        - Render 4 [METRIC: ...] cards:
          * [METRIC: Clean Execution | X% | green]
          * [METRIC: Mistake Trades | Y | red]
          * [METRIC: Mistake Bleed | -₹... | red]
          * [METRIC: Avg Execution Score | .../100 | orange]
     2) REPRESENTATIVE CLASSIFICATION TABLE:
        - Render a structured [TABLE: Scrip,Date,P&L,Detected Mistake,Playbook,Score | ...] highlighting 5-8 representative flagged trades from the journal (e.g. ZENSARTECH, SOMANYCERA, ITDC, TATAPOWER).
     3) TOP 3 BEHAVIORAL MISTAKES & SYSTEMIC ANTIDOTES:
        - Detail the #1, #2, and #3 recurring mistake patterns (e.g., Averaging Down on Losers, Impulsive Random Entries, Panic Sells).
        - Give the explicit cognitive and execution antidote for each.
     4) 1-CLICK ACTION DIRECTIVE:
        - Give concrete instructions on how to quarantine bad setups and lock in clean execution before the next session.

13. INDIAN BROKER CONTRACT NOTE & TRADEBOOK PARSER PROTOCOL:
   When user pastes trades, contract note text, order summaries, or messages like "Bought 100 shares of TATASTEEL at 184.30 on 2026-08-29, SL 179" or Zerodha/Groww/AngelOne CSV/TSV data:
   - Identify each trade: Scrip, Side (Buy/Sell), Qty, Price, SL, Date, Segment.
   - Show an institutional breakdown table:
     [TABLE: Scrip,Side,Qty,Price,Turnover,STT/Charges,Est Net | ...]
   - Include a summary of Indian statutory taxes (STT, Stamp Duty, GST, Exchange charges) using standard rates.
   - Conclude by providing the parsed trades formatted for 1-click import using this EXACT machine-readable token on its own line:
     [IMPORT_READY: JSON_ARRAY]
     Where JSON_ARRAY is a valid JSON array of objects with keys: symbol, side, qty, price, sl, date, broker.
     Example: [IMPORT_READY: [{"symbol":"TATASTEEL","side":"Buy","qty":100,"price":184.3,"sl":179,"date":"29-08-2026","broker":"Zerodha"}]]
   - The UI will detect [IMPORT_READY: ...] and render an interactive "📥 1-Click Import to Journal" button.`;
}



/**
 * Post-generation verification guard (C2 Zero-Hallucination Enforcer)
 * Checks quoted numbers against official journal ground truth.
 */
export function verifyFoxyResponse(text, { metrics, trades } = {}) {
  if (!text || typeof text !== 'string') return text;

  const discrepancies = [];
  const exactWinRate = metrics?.winRate !== undefined ? Number(metrics.winRate) : null;
  const exactRealizedPnl = metrics?.grossRealizedPL !== undefined ? Number(metrics.grossRealizedPL) : null;

  // 1. Audit Quoted Win Rate
  if (exactWinRate !== null) {
    const wrMatches = [...text.matchAll(/(?:win\s*rate|win-rate|accuracy)[:\s]+([0-9]+(?:\.[0-9]+)?)\s*%/gi)];
    for (const match of wrMatches) {
      const quotedVal = parseFloat(match[1]);
      if (!isNaN(quotedVal) && Math.abs(quotedVal - exactWinRate) > 1.0) {
        discrepancies.push(`Quoted Win Rate ${quotedVal}% vs Official Ground Truth ${exactWinRate}%`);
      }
    }
  }

  // 2. Audit Quoted Realized P/L
  if (exactRealizedPnl !== null) {
    const pnlMatches = [...text.matchAll(/(?:realized\s*(?:p[&/]?l|profit|loss)|gross\s*realized)[:\s]+[₹Rs.\s]*([+\-]?\s*[0-9,]+(?:\.[0-9]+)?)/gi)];
    for (const match of pnlMatches) {
      const rawClean = match[1].replace(/[\s,]/g, '');
      const quotedPnl = parseFloat(rawClean);
      if (!isNaN(quotedPnl) && Math.abs(quotedPnl - exactRealizedPnl) > 50) {
        discrepancies.push(`Quoted Realized P/L ₹${quotedPnl} vs Official Ground Truth ₹${exactRealizedPnl}`);
      }
    }
  }

  // If discrepancies found, append institutional correction note
  if (discrepancies.length > 0) {
    const auditNote = `\n\n> 🔍 **Foxy Ground-Truth Verification:** Note that the official journal ground truth for this period is **Win Rate: ${exactWinRate}%** and **Gross Realized P/L: ₹${Math.round(exactRealizedPnl).toLocaleString('en-IN')}**.`;
    return text + auditNote;
  }

  return text;
}

/**
 * Send user query to the configured LLM and get Foxy's response
 */
export async function askFoxy({
  prompt,
  conversationHistory = [],
  trades = [],
  metrics = null,
  portfolioId = 'portfolio-default',
  portfolioCapital = 0,
  capitalChanges = null,
  onChunk = null,
  signal = null
}) {
  const { provider, model, apiKey } = await getFoxyConfig();
  const currentYearStr = String(new Date().getFullYear());
  const effectiveCapChanges = capitalChanges || loadCapitalChangesFromStorage(portfolioId, currentYearStr);
  const journalContext = buildFoxyJournalContext(trades, portfolioId, metrics, portfolioCapital, effectiveCapChanges);
  const systemPrompt = getFoxySystemPrompt(journalContext);

  // Inject Behavioral DNA
  let dnaText = '';
  try {
    const dna = await getOrComputeDNA(trades).catch(() => null);
    if (dna) dnaText = '\n\n' + formatDNAForContext(dna);
  } catch(e) { /* silent */ }

  // Inject VIX / Nifty Market Correlation
  let marketText = '';
  try {
    const mkt = await fetchAndCacheMarketData().catch(() => null);
    if (mkt && (Object.keys(mkt.nifty || {}).length > 0 || Object.keys(mkt.vix || {}).length > 0)) {
      const corr = computeMarketCorrelation(trades, mkt);
      if (corr && corr.tradeCountWithData > 0) {
        marketText = '\n\n' + formatMarketContextForFoxy(corr);
      }
    }
  } catch(e) { /* silent */ }

  // Inject Contract Note / Paste-to-Import trade data if detected in prompt
  let contractNoteContext = '';
  try {
    const extracted = parseRawTradeText(prompt);
    if (extracted && extracted.length > 0) {
      contractNoteContext = `\n\n[DETECTED RAW TRADES FOR IMPORT]\nThe user pasted trade/contract note text. Pre-extracted trades (${extracted.length}):\n${JSON.stringify(extracted, null, 2)}\nPresent the breakdown table with STT/charges and conclude with this exact machine-readable token:\n[IMPORT_READY: ${JSON.stringify(extracted)}]`;
    }
  } catch(e) { /* silent */ }

  // Inject Persistent Trader Commitments & Personal Rules (M2 Coach Continuity)
  let commitmentsText = '';
  try {
    const comms = await getTraderCommitments().catch(() => []);
    // Also detect if user is establishing a new rule in current prompt
    const ruleMatch = prompt.match(/(?:my rule is|i promise to|set a rule|commit to|my trading rule:?)\s*(.*)/i);
    if (ruleMatch && ruleMatch[1].trim()) {
      await addTraderCommitment(ruleMatch[1].trim());
      comms.push(ruleMatch[1].trim());
    }
    if (comms.length > 0) {
      commitmentsText = `\n\nACTIVE TRADER RULES & COMMITMENTS (PERSISTENT COACH MEMORY):\n` +
        comms.map((c, i) => `• Rule ${i + 1}: ${c}`).join('\n') +
        `\nCRITICAL: Always hold the trader strictly accountable to these rules. Flag any violations in trade logs.`;
    }
  } catch(e) { /* silent */ }

  const fullSystemPrompt = systemPrompt + dnaText + marketText + contractNoteContext + commitmentsText;

  // If no API key configured, use intelligent local heuristic fallback
  if (!apiKey || !apiKey.trim()) {
    const offlineText = generateOfflineFoxyResponse(prompt, trades, metrics);
    if (onChunk) onChunk(offlineText, offlineText);
    return verifyFoxyResponse(offlineText, { metrics, trades });
  }

  const key = apiKey.trim();

  // 1. Google Gemini
  if (provider === 'gemini') {
    const TRADE_QUERY_TOOL = {
      function_declarations: [
        {
          name: 'run_trade_query',
          description: 'Execute a precise analytical query on the user trade journal to get exact numbers or matching trade records. Use this for any question requiring counting, aggregation, filtering, grouping, comparison, or listing trades. Always use this tool instead of guessing.',
          parameters: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Human readable description of what this query computes' },
              filters: {
                type: 'array',
                description: 'Array of filter conditions',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string', description: 'Field: symbol, setup, status, segment, type, entry, exit, sl, cmp, pnl, holdingDays, date, hour, timeOfDay, dayOfWeek, month, year, capitalAtRisk, rewardRisk, dateFrom, dateTo' },
                    op: { type: 'string', enum: ['eq','neq','contains','gt','lt','gte','lte','in'] },
                    value: { type: 'string' }
                  },
                  required: ['field','op','value']
                }
              },
              groupBy: { type: 'string', description: 'Group results by this field: setup, symbol, segment, month, dayOfWeek, hour, year, status' },
              aggregations: {
                type: 'array',
                items: { type: 'string', enum: ['count','wins','losses','winRate','totalPnl','avgPnl','avgWin','avgLoss','totalR','avgR','profitFactor','expectancy','maxDrawdown','streaks','avgHolding'] }
              },
              returnRows: { type: 'boolean', description: 'Set to true to return full matching individual trade records (Scrip, Date, Entry, SL, Exit, PnL, R, Setup) instead of aggregated numbers.' },
              orderBy: { type: 'object', properties: { field: {type:'string'}, dir: {type:'string'} } },
              limit: { type: 'number', description: 'Max rows to return (default 20, max 50)' }
            },
            required: ['description']
          }
        },
        {
          name: 'run_fund_query',
          description: 'Execute dynamic fund management calculation to get exact 100% mathematical capital breakdown for any year (e.g. 2026, 2025). Returns exact starting capital, deposits (added funds), withdrawals, monthly net P/L, ending balance, % return on capital, annualized CAGR, and cumulative multiplier. Always use this tool for questions about fund management, capital breakdown, deposits, withdrawals, ending balance, or CAGR.',
          parameters: {
            type: 'object',
            properties: {
              year: { type: 'string', description: 'Year to analyze (e.g. "2026", "2025"). Default is "2026".' },
              month: { type: 'string', description: 'Optional month name (e.g. "Jan", "Feb", ... or "all"). Default is "all".' }
            },
            required: ['year']
          }
        },
        {
          name: 'run_tax_query',
          description: 'Compute exact 100% deterministic Indian Income Tax and statutory charges analytics. Returns Section 111A STCG (20%), Section 112A LTCG (12.5% with ₹1.25L exemption), Speculative Intraday income, Non-speculative F&O business income, Section 44AB Tax Audit Turnover (F&O absolute profit/loss turnover, Intraday turnover, Delivery turnover, and audit status against ₹10 Cr limit), and itemized statutory charges (STT, Stamp Duty, GST, Exchange charges, SEBI, Brokerage). Always use this tool for questions about tax, capital gains, tax audit, turnover, or charges.',
          parameters: {
            type: 'object',
            properties: {
              year: { type: 'string', description: 'Year e.g. "2026", "2025", or "All"' },
              periodMode: { type: 'string', enum: ['calendar', 'fy'], description: 'Calendar year (Jan-Dec) or Financial Year (Apr-Mar). Default is "calendar".' }
            },
            required: ['year']
          }
        }
      ]
    };

    const handleToolInvocation = (fCall) => {
      if (!fCall || !fCall.name) return null;
      const fName = fCall.name;
      const fArgs = fCall.args || {};

      if (fName === 'run_trade_query') {
        try {
          let qRes = executeQueryAndFormat(trades, {
            filters: fArgs.filters || [],
            groupBy: fArgs.groupBy || null,
            aggregations: fArgs.aggregations || ['count','winRate','totalPnl'],
            returnRows: !!fArgs.returnRows,
            orderBy: fArgs.orderBy,
            limit: Math.min(fArgs.limit || 25, 50)
          });
          if (typeof qRes === 'string' && qRes.length > 3500) {
            qRes = qRes.slice(0, 3500) + '\n... [Remaining rows truncated for token efficiency]';
          }
          return { name: fName, result: qRes };
        } catch (qErr) {
          return { name: fName, result: `Query error: ${qErr.message}` };
        }
      }

      if (fName === 'run_fund_query') {
        try {
          const qYear = String(fArgs.year || '2026');
          const capChanges = effectiveCapChanges || loadCapitalChangesFromStorage(portfolioId, qYear);
          const fundSummary = calculateYearlyFundSummary(trades, capChanges, qYear);
          const formatted = formatFundManagementForFoxy(fundSummary);
          return { name: fName, result: formatted };
        } catch (fErr) {
          return { name: fName, result: `Fund query error: ${fErr.message}` };
        }
      }

      if (fName === 'run_tax_query') {
        try {
          const qYear = String(fArgs.year || '2026');
          const pMode = fArgs.periodMode || 'calendar';
          const breakdown = calculateTaxMonthlyBreakdown(trades, {
            selectedYear: qYear,
            periodMode: pMode,
            portfolioValue: portfolioCapital
          });
          const classification = calculateIndianTaxClassification(trades, { selectedYear: qYear });
          const formatted = formatTaxAnalyticsForFoxy(breakdown, classification);
          return { name: fName, result: formatted };
        } catch (tErr) {
          return { name: fName, result: `Tax query error: ${tErr.message}` };
        }
      }

      return null;
    };

    const candidateModels = Array.from(new Set([
      model,
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.6-flash',
      'gemini-3-flash-preview',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-flash-latest'
    ])).filter(m => m && !m.includes('pro') && !m.includes('1.5') && !m.includes('2.0') && !m.includes('2.5'));

    const systemInstruction = { parts: [{ text: fullSystemPrompt }] };

    // Build contents from conversation history
    let contents = [];
    const histSlice = conversationHistory.slice(-10);
    for (const msg of histSlice) {
      const isUser = msg.role === 'user' || msg.sender === 'user';
      const text = String(msg.content !== undefined && msg.content !== null ? msg.content : (msg.text || '')).trim();
      if (text) {
        contents.push({ role: isUser ? 'user' : 'model', parts: [{ text }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    let lastError = null;
    for (const targetModel of candidateModels) {
      try {
        let loopContents = [...contents];
        let finalText = null;

        // Function calling loop (max 3 rounds)
        for (let round = 0; round < 3; round++) {
          if (signal?.aborted) break;

          const controller = new AbortController();
          const timeoutTimer = setTimeout(() => controller.abort(), onChunk ? 45000 : 15000);
          const onUserAbort = () => controller.abort();
          if (signal) {
            if (signal.aborted) {
              clearTimeout(timeoutTimer);
              return '*(Generation stopped)*';
            }
            signal.addEventListener('abort', onUserAbort, { once: true });
          }

          const endpoint = onChunk
            ? `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:streamGenerateContent?alt=sse`
            : `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`;

          let res;
          try {
            res = await fetch(endpoint, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-goog-api-key': key
              },
              signal: controller.signal,
              body: JSON.stringify({
                system_instruction: systemInstruction,
                contents: loopContents,
                tools: [TRADE_QUERY_TOOL]
              })
            });
          } catch (fetchErr) {
            if (signal?.aborted) {
              return '*(Generation stopped)*';
            }
            throw fetchErr;
          } finally {
            clearTimeout(timeoutTimer);
            if (signal) signal.removeEventListener('abort', onUserAbort);
          }

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            lastError = new Error(errData?.error?.message || `Gemini API error (${res.status})`);
            if (res.status === 503 || res.status === 404 || res.status === 429 || res.status === 400) {
              console.warn(`[Foxy AI] Model ${targetModel} hit status ${res.status}. Falling back to next candidate model...`);
              break;
            }
            throw lastError;
          }

          if (onChunk) {
            // --- SSE Stream Processing ---
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let detectedFuncCall = null;
            let lastCandidateContent = null;
            let roundText = '';

            try {
              while (true) {
                if (signal?.aborted) {
                  try { await reader.cancel(); } catch (e) {}
                  return roundText || '*(Generation stopped)*';
                }

                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const rawLine of lines) {
                  const line = rawLine.trim();
                  if (!line || !line.startsWith('data:')) continue;
                  const jsonStr = line.replace(/^data:\s*/, '').trim();
                  if (!jsonStr) continue;

                  try {
                    const parsed = JSON.parse(jsonStr);
                    const candidate = parsed?.candidates?.[0];
                    if (!candidate) continue;

                    if (candidate.content) {
                      lastCandidateContent = candidate.content;
                    }
                    const parts = candidate.content?.parts || [];

                    for (const part of parts) {
                      if (part.functionCall) {
                        detectedFuncCall = part.functionCall;
                      }
                      if (part.text) {
                        roundText += part.text;
                        onChunk(part.text, roundText);
                      }
                    }
                  } catch (pErr) {
                    // Ignore partial chunk parse error
                  }
                }
              }

              // Flush residual buffer
              if (buffer.trim().startsWith('data:')) {
                try {
                  const jsonStr = buffer.trim().replace(/^data:\s*/, '').trim();
                  const parsed = JSON.parse(jsonStr);
                  const candidate = parsed?.candidates?.[0];
                  if (candidate?.content) lastCandidateContent = candidate.content;
                  const parts = candidate?.content?.parts || [];
                  for (const part of parts) {
                    if (part.functionCall) detectedFuncCall = part.functionCall;
                    if (part.text) {
                      roundText += part.text;
                      onChunk(part.text, roundText);
                    }
                  }
                } catch (e) {}
              }
            } finally {
              try { reader.releaseLock(); } catch (e) {}
            }

            // Check if model called a function
            const invocation = handleToolInvocation(detectedFuncCall);
            if (invocation) {
              loopContents.push(lastCandidateContent || { role: 'model', parts: [{ functionCall: detectedFuncCall }] });
              loopContents.push({
                role: 'user',
                parts: [{ functionResponse: { name: invocation.name, response: { result: invocation.result } } }]
              });
              continue; // next round to get final answer
            }

            if (roundText) {
              finalText = roundText;
              break;
            }

          } else {
            // --- Standard Non-Streaming JSON Response ---
            const data = await res.json();
            const candidate = data?.candidates?.[0];
            const parts = candidate?.content?.parts || [];

            // Check if model wants to call a function
            const funcCall = parts.find(p => p.functionCall)?.functionCall;
            const invocation = handleToolInvocation(funcCall);
            if (invocation) {
              loopContents.push(candidate.content);
              loopContents.push({
                role: 'user',
                parts: [{ functionResponse: { name: invocation.name, response: { result: invocation.result } } }]
              });
              continue; // next round to get final answer
            }

            // Got text response
            const text = parts.find(p => p.text)?.text;
            if (text) { finalText = text; break; }
          }
        }

        if (finalText) {
          const verified = verifyFoxyResponse(finalText, { metrics, trades });
          if (onChunk && verified !== finalText) {
            onChunk('', verified);
          }
          return verified;
        }
      } catch (err) {
        lastError = err;
      }
    }
    console.warn('[Foxy AI] Cloud models exhausted. Falling back to local heuristic response:', lastError?.message);
    return verifyFoxyResponse(generateOfflineFoxyResponse(prompt, trades, metrics, portfolioId, portfolioCapital, effectiveCapChanges), { metrics, trades });
  }

  // 2. Anthropic Claude Direct Browser Execution
  if (provider === 'anthropic') {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 15000);
    try {
      const anthropicMessages = [
        ...conversationHistory.slice(-8)
          .filter(m => (m.content || m.text || '').trim())
          .map(m => ({ 
            role: (m.role === 'user' || m.sender === 'user') ? 'user' : 'assistant', 
            content: (m.content !== undefined && m.content !== null ? m.content : (m.text || '')).trim() 
          })),
        { role: 'user', content: prompt }
      ];

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: model || 'claude-3-5-sonnet-20241022',
          system: fullSystemPrompt,
          messages: anthropicMessages,
          max_tokens: 2000
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Anthropic API error (${res.status})`);
      }

      const data = await res.json();
      const reply = data?.content?.[0]?.text || 'No response generated.';
      return verifyFoxyResponse(reply, { metrics, trades });
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  // 3. OpenAI / DeepSeek / Groq / OpenRouter (All OpenAI-compatible standard)
  let endpoint = 'https://api.openai.com/v1/chat/completions';
  if (provider === 'deepseek') endpoint = 'https://api.deepseek.com/chat/completions';
  if (provider === 'groq') endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  if (provider === 'openrouter') endpoint = 'https://openrouter.ai/api/v1/chat/completions';

  const messages = [
    { role: 'system', content: fullSystemPrompt },
    ...conversationHistory.slice(-8)
      .filter(m => (m.content || m.text || '').trim())
      .map(m => ({ 
        role: (m.role === 'user' || m.sender === 'user') ? 'user' : 'assistant', 
        content: (m.content !== undefined && m.content !== null ? m.content : (m.text || '')).trim() 
      })),
    { role: 'user', content: prompt }
  ];

  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `${provider.toUpperCase()} API error (${res.status})`);
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content || 'No response generated.';
    return verifyFoxyResponse(reply, { metrics, trades });
  } finally {
    clearTimeout(timeoutTimer);
  }
}

/**
 * Intelligent Local Heuristic Response (Offline fallback when no API key is provided)
 */
function generateOfflineFoxyResponse(prompt, trades = [], metrics = null, portfolioId = 'portfolio-default', portfolioCapital = 0, capitalChanges = null) {
  const extracted = parseRawTradeText(prompt);
  if (extracted && extracted.length > 0) {
    const rows = extracted.map(t => `${t.symbol},${t.side},${t.qty},₹${t.price},₹${t.sl || '-'}`).join(' | ');
    const charges = calculateIndianCharges({
      segment: 'EQUITY_DELIVERY',
      buyValue: extracted.reduce((sum, t) => sum + (t.side === 'Buy' ? t.price * t.qty : 0), 0),
      sellValue: extracted.reduce((sum, t) => sum + (t.side === 'Sell' ? t.price * t.qty : 0), 0)
    });

    return `**Parsed Trades from Paste / Contract Note**
Found **${extracted.length}** trade(s) from your input:
[TABLE: Scrip,Side,Qty,Price,SL | ${rows}]

**Estimated Indian Statutory Charges & Taxes**
• Brokerage: ₹${charges.brokerage} | STT: ₹${charges.stt} | Exchange Turnover: ₹${charges.exchangeCharges}
• GST (18%): ₹${charges.gst} | Stamp Duty: ₹${charges.stampDuty} | Total Friction: **₹${charges.totalCharges}**

Click below to import directly into your FoxTrade Journal:

[IMPORT_READY: ${JSON.stringify(extracted)}]`;
  }

  const lower = prompt.toLowerCase();

  // Dynamic Fund Management Intent
  if (lower.includes('fund') || lower.includes('capital breakdown') || lower.includes('deposit') || lower.includes('withdraw') || lower.includes('cagr') || lower.includes('starting capital') || lower.includes('ending capital')) {
    const yrMatch = prompt.match(/\b(20\d\d)\b/);
    const targetYr = yrMatch ? yrMatch[1] : String(new Date().getFullYear());
    const capChanges = capitalChanges || loadCapitalChangesFromStorage(portfolioId, targetYr);
    const fundSummary = calculateYearlyFundSummary(trades, capChanges, targetYr);
    return formatFundManagementForFoxy(fundSummary);
  }

  // Dynamic Indian Tax Analytics & Audit Intent
  if (lower.includes('tax') || lower.includes('stcg') || lower.includes('ltcg') || lower.includes('turnover') || lower.includes('audit') || lower.includes('statutory') || lower.includes('charges') || lower.includes('brokerage') || lower.includes('stt')) {
    const yrMatch = prompt.match(/\b(20\d\d)\b/);
    const targetYr = yrMatch ? yrMatch[1] : String(new Date().getFullYear());
    const periodMode = (lower.includes('fy') || lower.includes('financial')) ? 'fy' : 'calendar';
    const breakdown = calculateTaxMonthlyBreakdown(trades, {
      selectedYear: targetYr,
      periodMode,
      portfolioValue: portfolioCapital || metrics?.portfolioCapital || 0
    });
    const classification = calculateIndianTaxClassification(trades, { selectedYear: targetYr });
    return formatTaxAnalyticsForFoxy(breakdown, classification);
  }

  const diagnostics = calculateTradeDiagnostics(trades);

  let advice = '';
  if (lower.includes('leak') || lower.includes('losing') || lower.includes('why')) {
    if (diagnostics.winLossRatio < 1.0) {
      advice = `**Performance Diagnostics: Asymmetric Risk Deficit**
Your average loss (**₹${diagnostics.avgLoss}**) is larger than your average win (**₹${diagnostics.avgWin}**).
• **Issue**: Cutting winning trades prematurely while letting losing trades exceed planned stop losses.
• **Action**: Maintain a minimum **1:2 Risk-to-Reward ratio**. Avoid positions where the target is less than twice the stop-loss distance.`;
    } else if (diagnostics.winRatePct < 45) {
      advice = `**Performance Diagnostics: Entry Selectivity**
Your current win rate is **${diagnostics.winRatePct}%**.
• **Issue**: Potential overtrading on low-conviction consolidations.
• **Action**: Wait for confirmation above key breakout pivots before entering. Limit daily executions to high-conviction setups.`;
    } else {
      advice = `**Performance Diagnostics: Capital Health Stable**
Your current win rate is **${diagnostics.winRatePct}%** with a **${diagnostics.winLossRatio}x** Reward-to-Risk ratio.
• Continue adhering to your trade plan and risk parameters.`;
    }
  } else if (lower.includes('stop') || lower.includes('sl') || lower.includes('risk')) {
    const missingSl = trades.filter(t => (t.status === 'Open' || t.status === 'Partial') && !t.stopLoss && !t.sl);
    if (missingSl.length > 0) {
      const syms = missingSl.map(t => t.symbol || t.stockName).join(', ');
      advice = `**Risk Audit: Missing Stop Losses**
You have **${missingSl.length}** open position(s) with no stop loss recorded: **${syms}**.
• Protect your capital against unexpected gaps or intraday adverse volatility.
• **Action**: Set a stop loss on these open positions immediately.`;
    } else {
      advice = `**Risk Audit: Stop Loss Discipline**
All active open trades have stop losses recorded. Maintain this discipline and ensure total open portfolio risk stays within planned parameters.`;
    }
  } else {
    const totalTrades = metrics?.totalTrades ?? diagnostics.totalTrades;
    const winRate = metrics?.winRate ?? diagnostics.winRatePct;
    const grossPL = metrics?.grossRealizedPL !== undefined ? Number(metrics.grossRealizedPL) : diagnostics.totalPnL;
    const openPositions = metrics?.openPositions ?? diagnostics.openPositions;
    const capitalAtRisk = metrics?.capitalAtRisk ?? '0.00';
    const currentDrawdown = metrics?.currentDrawdown ?? '0.00';

    const plSign = grossPL >= 0 ? '▲ +' : '▼ ';
    const plColor = grossPL >= 0 ? 'green' : 'red';
    const wrColor = Number(winRate) >= 50 ? 'green' : 'orange';

    advice = `[METRIC: Gross Realized P/L | ${plSign}₹${Math.round(Math.abs(grossPL)).toLocaleString('en-IN')} | ${plColor}] [METRIC: Win Rate | ${winRate}% | ${wrColor}] [METRIC: Capital at Risk | ${capitalAtRisk}% | blue] [METRIC: Drawdown | ${currentDrawdown}% | red]

**Account & Portfolio Summary**
• **Total Trades**: ${totalTrades}
• **Active Open Positions**: ${openPositions}
• **Win Rate**: ${winRate}% (FoxTrade P/L Method)
• **Gross Realized P&L**: ${plSign}₹${Math.round(Math.abs(grossPL)).toLocaleString('en-IN')}
• **Capital at Risk**: ${capitalAtRisk}%
• **Reward-to-Risk Ratio**: ${diagnostics.winLossRatio}x`;
  }

  return advice;
}

// Re-export structured chat history management from foxyStore
export { getFoxyChatHistory, saveFoxyChatHistory };
