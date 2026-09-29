import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Search, X, Plus,
  Calendar, List, Mic, Download, FileText,
  LayoutTemplate, AtSign, BookOpen, Target,
  Pin, Trash2, ChevronDown, ListOrdered,
  List as ListIcon, Quote, Code, Link2, Check,
  StickyNote, Globe, Printer, FileDown,
  ClipboardList, Grid, Maximize2, Minimize2,
  Tag, ArrowRight, ArrowUpDown, Filter,
  TrendingUp, TrendingDown
} from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import SymbolLogo from '../SymbolLogo';
import PlaybookEngine from '../Playbook/PlaybookEngine';
import PlaybookIcon from '../Playbook/PlaybookIcon';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_NAMES_SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const MOOD_OPTIONS = [
  { key: 'great',      emoji: String.fromCodePoint(0x1F600), label: 'Very Happy',  color: '#10b981' },
  { key: 'good',       emoji: String.fromCodePoint(0x1F642), label: 'Happy',       color: '#34d399' },
  { key: 'neutral',    emoji: String.fromCodePoint(0x1F610), label: 'Neutral',     color: '#9ca3af' },
  { key: 'frustrated', emoji: String.fromCodePoint(0x1F641), label: 'Sad',         color: '#f97316' },
  { key: 'terrible',   emoji: String.fromCodePoint(0x1F621), label: 'Very Sad',    color: '#ef4444' },
];

const LS_NOTES_KEY    = 'foxtrade_notes_v2';
const LS_IND_KEY      = 'foxtrade_independent_notes_v2';
const LS_VIEWMODE_KEY = 'foxtrade_notes_viewmode';
const LS_CALMODE_KEY  = 'foxtrade_notes_calmode';
const LS_INDMODE_KEY  = 'foxtrade_notes_independent';

const IND_CATEGORIES = [
  { key: 'notes',     label: 'Notes',     icon: StickyNote },
  { key: 'tasks',     label: 'Tasks',     icon: ClipboardList },
  { key: 'resources', label: 'Resources', icon: BookOpen },
  { key: 'goals',     label: 'Goals',     icon: Target },
];

function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function strToDate(s) {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
function formatDateLabel(dateStr) {
  return strToDate(dateStr).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
function normalizeIsoDate(d) {
  if (!d) return null;
  const raw = String(d).split('T')[0].trim();
  const parts = raw.split('-');
  if (parts.length !== 3) return raw;
  return parts[0].length === 4 ? raw : `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function extractYear(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    if (val >= 1990 && val <= 2100) return val;
    const d = new Date(val);
    const y = d.getFullYear();
    if (!isNaN(y) && y >= 1990 && y <= 2100) return y;
    return null;
  }
  if (val instanceof Date) {
    const y = val.getFullYear();
    if (!isNaN(y) && y >= 1990 && y <= 2100) return y;
    return null;
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return null;
    const iso = normalizeIsoDate(s);
    if (iso && iso.length >= 4) {
      const y = parseInt(iso.slice(0, 4), 10);
      if (!isNaN(y) && y >= 1990 && y <= 2100) return y;
    }
    const match = s.match(/\b(19\d\d|20\d\d)\b/);
    if (match) {
      const y = parseInt(match[1], 10);
      if (!isNaN(y) && y >= 1990 && y <= 2100) return y;
    }
  }
  return null;
}

function formatTradeDate(rawDate) {
  if (!rawDate) return '';
  const iso = normalizeIsoDate(rawDate);
  if (!iso) return String(rawDate);
  try {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return String(rawDate);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(rawDate);
  }
}

function getTradePnL(t) {
  const val = t.pnl ?? t.grossPnl ?? t.realizedPL ?? t.unrealizedPnl ?? 0;
  return Number(val) || 0;
}

/**
 * Calculates FIFO lot matching for a trade's exits against its buy/entry legs.
 * Returns a map of ISO date -> realized P&L on that date.
 * Strictly complies with Indian tax FIFO regulations (and matches Nexus FIFO mode).
 */
function calcTradeFifoLots(t) {
  const datePnl = {};
  if (!t) return datePnl;

  // 1. Build Buy Lots in chronological order (Initial entry, then P1..P4)
  const buyLots = [];
  const entryDate = normalizeIsoDate(t.date || t.entryDate);
  const entryPrice = Number(t.entry || t.avgEntry || 0);
  const entryQty = Number(t.initialQty || t.qty || 0);

  if (entryPrice > 0 && entryQty > 0) {
    buyLots.push({ date: entryDate, price: entryPrice, qty: entryQty, remainingQty: entryQty });
  }

  for (let i = 1; i <= 4; i++) {
    const pDate = normalizeIsoDate(t[`p${i}Date`] || t[`pyramid${i}Date`]);
    const pPrice = Number(t[`p${i}Price`] || t[`pyramid${i}Price`] || 0);
    const pQty = Number(t[`p${i}Qty`] || t[`pyramid${i}Qty`] || 0);
    if (pQty > 0) {
      buyLots.push({
        date: pDate,
        price: pPrice > 0 ? pPrice : entryPrice,
        qty: pQty,
        remainingQty: pQty
      });
    }
  }

  // Fallback buy lot if detailed legs weren't recorded
  if (buyLots.length === 0 && (t.avgEntry || t.entry)) {
    const fallbackPrice = Number(t.avgEntry || t.entry);
    const totalQty = Number(t.exitedQty || t.qty || 1);
    buyLots.push({ date: entryDate, price: fallbackPrice, qty: totalQty, remainingQty: totalQty });
  }

  const side = (t.type || t.side || '').toLowerCase();
  const isShort = side === 'sell' || side === 'short';

  // 2. Build Exit Legs (E1..E4)
  const exits = [];
  for (let i = 1; i <= 4; i++) {
    const eDate = normalizeIsoDate(t[`e${i}Date`] || t[`exit${i}Date`]);
    const ePrice = Number(t[`e${i}Price`] || t[`exit${i}Price`] || 0);
    const eQty = Number(t[`e${i}Qty`] || t[`exit${i}Qty`] || 0);
    if (eDate && eQty > 0) {
      exits.push({ date: eDate, price: ePrice, qty: eQty });
    }
  }

  // If no staged exits, check single exitDate
  if (exits.length === 0 && t.exitDate) {
    const exitDate = normalizeIsoDate(t.exitDate);
    const exitPrice = Number(t.avgExitPrice || t.exitPrice || 0);
    const exitQty = Number(t.exitedQty || t.qty || 0);
    if (exitDate) {
      exits.push({ date: exitDate, price: exitPrice, qty: exitQty, totalPnl: getTradePnL(t) });
    }
  }

  // 3. FIFO Match each exit against earliest available buy lots
  exits.forEach(exit => {
    let remainingExitQty = exit.qty;
    let exitRealized = 0;

    // If direct total P&L is provided without price breakdown
    if (exit.totalPnl !== undefined && (!exit.price || buyLots.length === 0)) {
      datePnl[exit.date] = (datePnl[exit.date] || 0) + exit.totalPnl;
      return;
    }

    for (let b = 0; b < buyLots.length; b++) {
      if (remainingExitQty <= 0) break;
      const lot = buyLots[b];
      if (lot.remainingQty <= 0) continue;

      const matchQty = Math.min(remainingExitQty, lot.remainingQty);
      const lotPnl = isShort
        ? (lot.price - exit.price) * matchQty
        : (exit.price - lot.price) * matchQty;

      exitRealized += lotPnl;
      lot.remainingQty -= matchQty;
      remainingExitQty -= matchQty;
    }

    // If remainingExitQty still > 0, match against avgEntry fallback
    if (remainingExitQty > 0 && exit.price) {
      const fallbackPrice = Number(t.avgEntry || t.entry || 0);
      const lotPnl = isShort
        ? (fallbackPrice - exit.price) * remainingExitQty
        : (exit.price - fallbackPrice) * remainingExitQty;
      exitRealized += lotPnl;
    }

    datePnl[exit.date] = (datePnl[exit.date] || 0) + exitRealized;
  });

  return datePnl;
}

function calcDailyPnL(trades) {
  const map = {};
  if (!Array.isArray(trades)) return map;

  trades.forEach(t => {
    const fifoMap = calcTradeFifoLots(t);
    const dates = Object.keys(fifoMap);

    if (dates.length > 0) {
      dates.forEach(d => {
        map[d] = (map[d] || 0) + fifoMap[d];
      });
    } else {
      // Open trade / no exits yet: ensure entry date is marked as 0 so it stays neutral
      const entryIso = normalizeIsoDate(t.date || t.entryDate);
      if (entryIso && !(entryIso in map)) {
        map[entryIso] = 0;
      }
    }
  });

  return map;
}

/**
 * Returns the FIFO P&L breakdown and role of this trade on a specific date.
 */
function getTradePnLOnDate(trade, dateStr) {
  const fifoMap = calcTradeFifoLots(trade);
  const realizedPnl = fifoMap[dateStr];
  const isExit = realizedPnl !== undefined;

  const entryIso = normalizeIsoDate(trade.date || trade.entryDate);
  const isEntry = entryIso === dateStr;

  let isPyramid = false;
  for (let i = 1; i <= 4; i++) {
    if (normalizeIsoDate(trade[`p${i}Date`] || trade[`pyramid${i}Date`]) === dateStr) {
      isPyramid = true;
      break;
    }
  }

  return {
    pnl: isExit ? realizedPnl : 0,
    hasRealized: isExit,
    isEntry,
    isPyramid,
    fullPnl: getTradePnL(trade)
  };
}

function getTradesForDate(trades, dateStr) {
  if (!Array.isArray(trades)) return [];
  return trades.filter(t => {
    const entryIso = normalizeIsoDate(t.date || t.entryDate);
    const exitIso  = normalizeIsoDate(t.exitDate);
    // Staged exits
    for (let i = 1; i <= 4; i++) {
      if (normalizeIsoDate(t[`e${i}Date`] || t[`exit${i}Date`]) === dateStr) return true;
    }
    // Pyramid addition dates
    for (let i = 1; i <= 4; i++) {
      if (normalizeIsoDate(t[`p${i}Date`] || t[`pyramid${i}Date`]) === dateStr) return true;
    }
    return entryIso === dateStr || exitIso === dateStr;
  });
}
function getMonthlyPnL(trades, year, monthIdx) {
  const map = calcDailyPnL(trades);
  let total = 0;
  Object.entries(map).forEach(([dt, pnl]) => {
    const d = strToDate(dt);
    if (d.getFullYear() === year && d.getMonth() === monthIdx) total += pnl;
  });
  return total;
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function loadNotes() {
  try { return JSON.parse(localStorage.getItem(LS_NOTES_KEY)) || {}; } catch { return {}; }
}
function saveNotesLS(n) {
  try { localStorage.setItem(LS_NOTES_KEY, JSON.stringify(n)); } catch {}
}
function loadIndNotes() {
  try { return JSON.parse(localStorage.getItem(LS_IND_KEY)) || []; } catch { return []; }
}
function saveIndNotesLS(n) {
  try { localStorage.setItem(LS_IND_KEY, JSON.stringify(n)); } catch {}
}

function initScopedNotes(rawNote) {
  const base = (rawNote?.scopedNotes && typeof rawNote.scopedNotes === 'object') ? { ...rawNote.scopedNotes } : {};
  if (!base.general && (rawNote?.title || rawNote?.content || (rawNote?.tags && rawNote.tags.length > 0))) {
    base.general = {
      title: rawNote.title || '',
      content: rawNote.content || '',
      tags: rawNote.tags || [],
      mood: rawNote.mood || 'neutral',
      scope: 'general'
    };
  }
  return base;
}

function getDayNoteInfo(note) {
  if (!note) return { hasNote: false, count: 0, previewTitle: '' };
  if (note.scopedNotes && typeof note.scopedNotes === 'object') {
    const valid = Object.entries(note.scopedNotes).filter(([_, n]) => n && (n.title || n.content));
    if (valid.length > 0) {
      return {
        hasNote: true,
        count: valid.length,
        previewTitle: valid[0][1]?.title || note.title || ''
      };
    }
  }
  const has = !!(note.content || note.title);
  return { hasNote: has, count: has ? 1 : 0, previewTitle: note.title || '' };
}

function getMoodEmoji(moodKey) {
  const found = MOOD_OPTIONS.find(m => m.key === moodKey);
  return found ? found.emoji : null;
}

function getNoteDetails(note) {
  if (!note) return { hasNote: false, count: 0, title: '', excerpt: '', tags: [], mood: null };
  let title = note.title || '';
  let content = note.content || '';
  let tags = Array.isArray(note.tags) ? [...note.tags] : [];
  let mood = note.mood || null;
  let count = 0;

  if (note.scopedNotes && typeof note.scopedNotes === 'object') {
    const valid = Object.values(note.scopedNotes).filter(n => n && (n.title || n.content || (n.tags && n.tags.length > 0)));
    count = valid.length;
    if (count > 0) {
      const primary = valid[0];
      if (!title) title = primary.title || '';
      if (!content) content = primary.content || '';
      if (!mood) mood = primary.mood || null;
      valid.forEach(v => {
        if (Array.isArray(v.tags)) {
          v.tags.forEach(t => { if (!tags.includes(t)) tags.push(t); });
        }
      });
    }
  }

  let cleanText = (content || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  const has = count > 0 || !!(note.content || note.title);
  if (!has) return { hasNote: false, count: 0, title: '', excerpt: '', tags: [], mood: null };

  return {
    hasNote: true,
    count: Math.max(count, has ? 1 : 0),
    title: title || (cleanText ? cleanText.slice(0, 45) : 'Journal Note'),
    excerpt: cleanText.length > 130 ? cleanText.slice(0, 127) + '...' : cleanText,
    tags,
    mood
  };
}


function TBtn({ title, onClick, children, active, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '3px 5px', borderRadius: 5,
        border: active ? '1.5px solid var(--text-primary)' : 'none',
        background: active ? 'var(--border-color)' : 'none',
        cursor: 'pointer',
        color: danger ? '#ef4444' : 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--border-color)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'none'; }}
    >{children}</button>
  );
}
function TDiv() {
  return <div style={{ width: 1, height: 16, background: 'var(--border-color)', margin: '0 3px', flexShrink: 0 }} />;
}

// ─── TEMPLATES ───────────────────────────────────────────────────────────────
const TEMPLATES = {
  'Daily Market Plan': `<p><strong>DAILY MARKET PLAN</strong></p>
<table border="1" style="border-collapse:collapse;width:100%"><tbody>
<tr><td><strong>1. Market Trend</strong></td><td></td></tr>
<tr><td>- Daily Buy Signal? (above 10/20 DMA)</td><td>YES / NO</td></tr>
<tr><td>- Weekly Buy Signal? (above 10/30 WMA)</td><td>YES / NO</td></tr>
<tr><td>- Gained traction last 5 trades?</td><td>YES / NO</td></tr>
<tr><td>- Net 52-Week H/L Trending Positive?</td><td>YES / NO</td></tr>
<tr><td><strong>2. Primary Watchlist</strong></td><td><strong>$Tickers</strong></td></tr>
<tr><td colspan="2" style="text-align:center"><strong>Focus List</strong></td></tr>
<tr><td>&nbsp;</td><td>&nbsp;</td></tr>
<tr><td colspan="2" style="text-align:center"><strong>Watching</strong></td></tr>
<tr><td>&nbsp;</td><td>&nbsp;</td></tr>
<tr><td colspan="2" style="text-align:center"><strong>Emotional Analysis</strong></td></tr>
<tr><td colspan="2">&nbsp;</td></tr>
<tr><td colspan="2" style="text-align:center"><strong>Market Commentary</strong></td></tr>
<tr><td colspan="2">&nbsp;</td></tr>
</tbody></table>`,
  'Pre-Market Prep': `<p><strong>PRE-MARKET PREPARATION</strong></p>
<table border="1" style="border-collapse:collapse;width:100%"><tbody>
<tr><td><strong>SGX / Gift Nifty</strong></td><td></td></tr>
<tr><td><strong>Global Cues (US / Asia)</strong></td><td></td></tr>
<tr><td><strong>Nifty Key Levels</strong></td><td>Support: &nbsp; Resistance:</td></tr>
<tr><td><strong>BankNifty Key Levels</strong></td><td>Support: &nbsp; Resistance:</td></tr>
<tr><td colspan="2"><strong>Top 5 Watchlist</strong></td></tr>
<tr><td>1.</td><td>Setup:</td></tr>
<tr><td>2.</td><td>Setup:</td></tr>
<tr><td>3.</td><td>Setup:</td></tr>
<tr><td>4.</td><td>Setup:</td></tr>
<tr><td>5.</td><td>Setup:</td></tr>
<tr><td><strong>Risk Budget Today (₹)</strong></td><td></td></tr>
<tr><td><strong>Max Trades Allowed</strong></td><td></td></tr>
</tbody></table>`,
  'Post-Market Debrief': `<p><strong>POST-MARKET DEBRIEF</strong></p>
<table border="1" style="border-collapse:collapse;width:100%"><tbody>
<tr><td><strong>Trades Taken</strong></td><td></td></tr>
<tr><td><strong>P&amp;L (Net)</strong></td><td></td></tr>
<tr><td><strong>Win / Loss</strong></td><td>Wins: &nbsp; Losses:</td></tr>
<tr><td><strong>Execution Quality (1-10)</strong></td><td></td></tr>
<tr><td><strong>Did I follow my rules?</strong></td><td>YES / NO</td></tr>
<tr><td><strong>Biggest Mistake</strong></td><td></td></tr>
<tr><td><strong>Best Decision</strong></td><td></td></tr>
<tr><td><strong>FOMO Moments?</strong></td><td></td></tr>
<tr><td><strong>Emotion Level (1-10)</strong></td><td></td></tr>
<tr><td><strong>Tomorrow Focus</strong></td><td></td></tr>
</tbody></table>`,
  'Weekend Review': `<p><strong>WEEKEND DEEP REVIEW</strong></p>
<table border="1" style="border-collapse:collapse;width:100%"><tbody>
<tr><td><strong>Week of</strong></td><td></td></tr>
<tr><td><strong>Weekly P&amp;L</strong></td><td></td></tr>
<tr><td><strong>Total Trades</strong></td><td>Wins: &nbsp; Losses:</td></tr>
<tr><td><strong>Best Trade</strong></td><td></td></tr>
<tr><td><strong>Worst Trade</strong></td><td></td></tr>
<tr><td colspan="2"><strong>Sector Rotation Observations</strong></td></tr>
<tr><td colspan="2">&nbsp;</td></tr>
<tr><td colspan="2"><strong>Strong Sectors</strong></td></tr>
<tr><td colspan="2">&nbsp;</td></tr>
<tr><td colspan="2"><strong>Weak Sectors</strong></td></tr>
<tr><td colspan="2">&nbsp;</td></tr>
<tr><td><strong>Rules Violated</strong></td><td></td></tr>
<tr><td><strong>Next Week Goals</strong></td><td></td></tr>
</tbody></table>`,
};

// ─── Day Hover Popover (Trades & Stats) ───────────────────────────────────────
function DayHoverPopover({ data, position }) {
  if (!data || !position) return null;
  const { ds, pnl, trades = [], note } = data;
  const dateObj = strToDate(ds);
  const formattedDate = dateObj.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });

  const netGrossPnL = pnl !== undefined ? pnl : 0;

  const dateInfos = trades.map(t => ({ trade: t, info: getTradePnLOnDate(t, ds) }));
  const realizedList = dateInfos.filter(d => d.info.hasRealized);
  const winCount = realizedList.filter(d => d.info.pnl > 0).length;
  const lossCount = realizedList.filter(d => d.info.pnl < 0).length;
  const openCount = dateInfos.length - realizedList.length;

  const isWinDay = netGrossPnL > 0;
  const isLossDay = netGrossPnL < 0;
  const isTradeDay = trades.length > 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: position.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        zIndex: 9999999,
        width: 310,
        backgroundColor: 'var(--bg-card, #ffffff)',
        border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 65%, transparent)',
        borderRadius: 14,
        padding: '13px 15px',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.04)',
        pointerEvents: 'none',
        animation: 'popoverFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes popoverFadeIn {
          from { opacity: 0; transform: translate(-50%, ${position.placement === 'top' ? '-96%' : '4px'}) scale(0.97); }
          to { opacity: 1; transform: translate(-50%, ${position.placement === 'top' ? '-100%' : '0'}) scale(1); }
        }
      `}</style>

      {/* Header: Date */}
      <div style={{ marginBottom: 9, borderBottom: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 50%, transparent)', paddingBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
          {formattedDate}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted, #9ca3af)', marginTop: 1 }}>
          {isTradeDay ? `${trades.length} Trade${trades.length > 1 ? 's' : ''}` : 'No trades taken'}
        </div>
      </div>

      {/* Stocks / Trades List (includes Open and Partial) */}
      {trades.length > 0 && (
        <div>
          {/* Header with Trades count & Win / Loss summary */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 6
          }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              TRADES ({trades.length})
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600 }}>
              {winCount > 0 && <span style={{ color: '#10b981' }}>{winCount}W</span>}
              {lossCount > 0 && <span style={{ color: '#ef4444' }}>{lossCount}L</span>}
              {openCount > 0 && <span style={{ color: '#2563eb' }}>{openCount} Open/Entry</span>}
            </div>
          </div>

          {/* Unified Container: Trades and Net Total Gross P&L in ONE box divided by lines */}
          <div style={{
            borderRadius: 8,
            border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 60%, transparent)',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex', flexDirection: 'column',
              maxHeight: 165,
              overflowY: trades.length > 5 ? 'auto' : 'visible'
            }}>
              {dateInfos.map(({ trade: t, info }, idx) => {
                const hasRealized = info.hasRealized;
                const tradePnl = info.pnl;
                const isProfit = hasRealized && tradePnl > 0;
                const isLoss = hasRealized && tradePnl < 0;

                let legBadge = null;
                if (hasRealized) {
                  legBadge = (
                    <span style={{
                      fontSize: 8.5, fontWeight: 600,
                      color: isProfit ? '#047857' : '#dc2626',
                      backgroundColor: isProfit ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)',
                      padding: '1px 5px', borderRadius: 3
                    }}>
                      EXIT
                    </span>
                  );
                } else if (info.isPyramid) {
                  legBadge = (
                    <span style={{
                      fontSize: 8.5, fontWeight: 600,
                      color: '#7c3aed', backgroundColor: 'rgba(124, 58, 237, 0.12)',
                      padding: '1px 5px', borderRadius: 3
                    }}>
                      PYRAMID
                    </span>
                  );
                } else if (info.isEntry) {
                  legBadge = (
                    <span style={{
                      fontSize: 8.5, fontWeight: 600,
                      color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.12)',
                      padding: '1px 5px', borderRadius: 3
                    }}>
                      ENTRY
                    </span>
                  );
                } else {
                  legBadge = (
                    <span style={{
                      fontSize: 8.5, fontWeight: 600,
                      color: '#6b7280', backgroundColor: 'rgba(107, 114, 128, 0.12)',
                      padding: '1px 5px', borderRadius: 3
                    }}>
                      OPEN
                    </span>
                  );
                }

                return (
                  <div key={t.id || idx} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 9px',
                    borderBottom: '1px solid color-mix(in srgb, var(--border-color, #f0f2f5) 45%, transparent)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      <SymbolLogo symbol={t.name || t.symbol} size={17} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: 100 }}>
                        {t.name || t.symbol}
                      </span>
                      {t.tradeNo && (
                        <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 500 }}>
                          #{t.tradeNo}
                        </span>
                      )}
                      {legBadge}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: isProfit ? '#10b981' : isLoss ? '#ef4444' : 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      flexShrink: 0, marginLeft: 6
                    }}>
                      {hasRealized
                        ? `${tradePnl > 0 ? '+' : tradePnl < 0 ? '-' : ''}₹${Math.abs(tradePnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                        : '—'
                      }
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Net Total Gross P&L row inside the same box at the bottom */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 9px',
              backgroundColor: 'var(--bg-primary, #f9fafb)',
              borderTop: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 50%, transparent)'
            }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary, #111827)' }}>
                Net Total Gross P&L
              </span>
              <span style={{
                fontSize: 12.5, fontWeight: 600,
                color: netGrossPnL > 0 ? '#10b981' : netGrossPnL < 0 ? '#ef4444' : 'var(--text-primary, #111827)',
                fontFamily: 'var(--font-mono)'
              }}>
                {netGrossPnL > 0 ? '+' : netGrossPnL < 0 ? '-' : ''}₹{Math.abs(netGrossPnL).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Note: Icon + Title at the bottom below Net Total Gross P&L if present */}
      {note && (() => {
        const scoped = note.scopedNotes ? Object.entries(note.scopedNotes).filter(([_, n]) => n && (n.title || n.content)) : [];
        if (scoped.length > 1) {
          return (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 5,
              padding: '8px 10px', borderRadius: 8,
              backgroundColor: 'var(--bg-primary, #f9fafb)',
              border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 55%, transparent)',
              marginTop: trades.length > 0 ? 8 : 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <FileText size={11} color="var(--text-primary, #111827)" strokeWidth={1.8} />
                <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {scoped.length} Notes Recorded
                </span>
              </div>
              {scoped.map(([scopeKey, n]) => {
                const isGen = scopeKey === 'general';
                const label = isGen ? 'General' : (scopeKey.replace('trade-', 'Trade #'));
                return (
                  <div key={scopeKey} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-primary)' }}>
                    <span style={{
                      fontSize: 8.5, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                      background: isGen ? 'rgba(107, 114, 128, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: isGen ? 'var(--text-secondary)' : '#059669', flexShrink: 0
                    }}>
                      {label}
                    </span>
                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {n.title || 'Untitled Note'}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        } else if (note.title || note.content) {
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 10px', borderRadius: 8,
              backgroundColor: 'var(--bg-primary, #f9fafb)',
              border: '1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 55%, transparent)',
              marginTop: trades.length > 0 ? 8 : 0
            }}>
              <FileText size={13} color="var(--text-primary, #111827)" strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <span style={{
                fontSize: 11.5, fontWeight: 600,
                color: 'var(--text-primary, #111827)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1
              }}>
                {note.title || 'Note'}
              </span>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}

// ─── Note Editor Drawer ───────────────────────────────────────────────────────
function NoteEditor({ note, dateStr, tradesOnDay, allTrades, onSave, onDelete, onClose }) {
  const [scopedNotes, setScopedNotes] = useState(() => initScopedNotes(note));
  const [scope, setScope]             = useState(note?.scope || 'general');
  const [title, setTitle]             = useState(() => {
    const s = note?.scope || 'general';
    const initialScoped = initScopedNotes(note);
    return initialScoped[s]?.title || note?.title || '';
  });
  const [tags, setTags]               = useState(() => {
    const s = note?.scope || 'general';
    const initialScoped = initScopedNotes(note);
    return initialScoped[s]?.tags || note?.tags || [];
  });
  const [tagInput, setTagInput]       = useState('');
  const [mood, setMood]               = useState(() => {
    const s = note?.scope || 'general';
    const initialScoped = initScopedNotes(note);
    return initialScoped[s]?.mood || note?.mood || 'neutral';
  });
  const [charCount, setCharCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [showExport, setShowExport]     = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [formatBlock, setFormatBlock]   = useState('Normal');
  const [isDirty, setIsDirty]           = useState(false);
  const [isSaved, setIsSaved]           = useState(false);
  const [isExpanded, setIsExpanded]     = useState(false);
  const [mentionPopup, setMentionPopup] = useState(null); // { query, node, atSymbolIdx, offset, top, left }
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const editorRef      = useRef(null);
  const exportRef      = useRef(null);
  const templateRef    = useRef(null);
  const mentionMenuRef = useRef(null);

  const activeTrade = scope !== 'general' ? (tradesOnDay.find(t => `trade-${t.tradeNo}` === scope) || allTrades.find(t => `trade-${t.tradeNo}` === scope)) : null;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  useEffect(() => {
    const initialScoped = initScopedNotes(note);
    setScopedNotes(initialScoped);
    const initialScope = note?.scope || 'general';
    setScope(initialScope);

    const activeData = initialScoped[initialScope] || (initialScope === 'general' ? note : null) || {};
    setTitle(activeData.title || '');
    setTags(activeData.tags || []);
    setMood(activeData.mood || 'neutral');
    if (editorRef.current) {
      editorRef.current.innerHTML = activeData.content || '';
      setCharCount((editorRef.current.innerText || '').length);
    }
    setIsDirty(false);
    setIsSaved(false);
  }, [note?.id, dateStr]);

  useEffect(() => {
    function h(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false);
      if (templateRef.current && !templateRef.current.contains(e.target)) setShowTemplate(false);
      if (mentionMenuRef.current && !mentionMenuRef.current.contains(e.target)) setMentionPopup(null);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleSave = () => {
    const currentHtml = editorRef.current?.innerHTML || '';
    const currentData = {
      title,
      tags,
      mood,
      scope,
      content: currentHtml,
    };
    const finalScoped = {
      ...scopedNotes,
      [scope]: currentData,
    };
    setScopedNotes(finalScoped);

    // Primary note for root fields: prefer 'general', fallback to current
    const primary = finalScoped.general || currentData;
    const data = {
      title: primary.title || '',
      tags: primary.tags || [],
      mood: primary.mood || 'neutral',
      content: primary.content || '',
      scope,
      scopedNotes: finalScoped,
    };
    onSave(dateStr, data);
    setIsDirty(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleScope = (newScope) => {
    if (newScope === scope) return;

    // 1. Snapshot current editor into current scope
    const currentHtml = editorRef.current?.innerHTML || '';
    const currentData = {
      title,
      tags,
      mood,
      scope,
      content: currentHtml,
    };
    const nextScoped = {
      ...scopedNotes,
      [scope]: currentData,
    };
    setScopedNotes(nextScoped);

    // 2. Switch to new scope
    setScope(newScope);

    // 3. Load target scope content
    const targetData = nextScoped[newScope] || {};
    setTitle(targetData.title || '');
    setTags(targetData.tags || []);
    setMood(targetData.mood || 'neutral');
    if (editorRef.current) {
      editorRef.current.innerHTML = targetData.content || '';
      setCharCount((editorRef.current.innerText || '').length);
    }
    setIsDirty(false);
    setIsSaved(false);
  };

  const handleDeleteScope = () => {
    const populatedKeys = Object.keys(scopedNotes).filter(k => k !== scope && (scopedNotes[k]?.content || scopedNotes[k]?.title));
    const activeLabel = scope === 'general' ? 'General Note' : `${activeTrade ? activeTrade.name + ' #' + activeTrade.tradeNo : scope} Note`;

    if (populatedKeys.length === 0) {
      if (window.confirm(`Delete ${activeLabel}? This is the only note on this day.`)) {
        if (onDelete) onDelete(dateStr);
        onClose();
      }
      return;
    }

    if (window.confirm(`Delete ${activeLabel}? Other notes for this day will remain saved.`)) {
      const nextScoped = { ...scopedNotes };
      delete nextScoped[scope];
      setScopedNotes(nextScoped);

      // Switch to first remaining note
      const nextScope = populatedKeys[0] || 'general';
      setScope(nextScope);
      const nextData = nextScoped[nextScope] || {};
      setTitle(nextData.title || '');
      setTags(nextData.tags || []);
      setMood(nextData.mood || 'neutral');
      if (editorRef.current) {
        editorRef.current.innerHTML = nextData.content || '';
        setCharCount((editorRef.current.innerText || '').length);
      }

      const primary = nextScoped.general || nextData;
      const data = {
        title: primary.title || '',
        tags: primary.tags || [],
        mood: primary.mood || 'neutral',
        content: primary.content || '',
        scope: nextScope,
        scopedNotes: nextScoped,
      };
      onSave(dateStr, data);
      setIsDirty(false);
    }
  };

  const insertTradeStats = (t) => {
    if (!t) return;
    const pnlVal = t.pnl || t.pl || 0;
    const pnlSign = pnlVal > 0 ? '+' : '';
    const pnlFormatted = `${pnlSign}₹${Math.abs(pnlVal).toLocaleString('en-IN')}`;
    const pnlCol = pnlVal > 0 ? '#10b981' : pnlVal < 0 ? '#ef4444' : '#6b7280';
    const entryPrice = t.avgEntry || t.entry || '—';
    const exitPrice = t.avgExitPrice || t.avgExit || '—';
    const qtyVal = t.qty || t.exitedQty || '—';
    const statsHtml = `<p><strong>${t.name} #${t.tradeNo} Execution Summary:</strong> Setup: <em>${t.setup || 'Breakout'}</em> | Direction: <em>${t.direction || t.type || 'LONG'}</em> | Qty: <em>${qtyVal}</em> | Entry: <em>₹${entryPrice}</em> | Exit: <em>₹${exitPrice}</em> | Realized P&L: <strong style="color:${pnlCol}">${pnlFormatted}</strong></p>`;
    if (editorRef.current) {
      editorRef.current.innerHTML += statsHtml;
      handleEditorInput();
    }
  };

  const execCmd = (cmd, value = null) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    handleEditorInput();
  };

  const availableMentionTrades = useMemo(() => {
    const dayMap = new Set((tradesOnDay || []).map(t => t.tradeNo));
    const dayList = (tradesOnDay || []).map(t => ({ ...t, isDayTrade: true }));
    const otherList = (allTrades || [])
      .filter(t => !dayMap.has(t.tradeNo))
      .map(t => ({ ...t, isDayTrade: false }));
    return [...dayList, ...otherList];
  }, [tradesOnDay, allTrades]);

  const filteredMentionTrades = useMemo(() => {
    if (!mentionPopup) return [];
    const q = (mentionPopup.query || '').trim().toLowerCase();
    if (!q) {
      return availableMentionTrades.slice(0, 15);
    }
    const tokens = q.split(/\s+/).filter(Boolean);
    const monthNames = ['', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

    return availableMentionTrades.filter(t => {
      const name = (t.name || '').toLowerCase();
      const no = String(t.tradeNo || '');
      const setup = (t.setup || '').toLowerCase();
      const rawDate = String(t.date || t.entryDate || t.rawDate || '');
      const parts = rawDate.split('-');
      const day = parts[0] ? String(parseInt(parts[0], 10)) : '';
      const dayPadded = parts[0] || '';
      const monthNum = parts[1] || '';
      const monthName = monthNames[parseInt(monthNum, 10)] || '';

      return tokens.every(tok => {
        if (tok === 'today' && t.isDayTrade) return true;
        if (name.includes(tok)) return true;
        if (no === tok.replace('#', '')) return true;
        if (setup.includes(tok)) return true;
        if (monthName.includes(tok)) return true;
        if (day === tok || dayPadded === tok) return true;
        if (tok.length === 4 && parts[2] === tok) return true;
        return false;
      });
    }).slice(0, 15);
  }, [mentionPopup, availableMentionTrades]);

  useEffect(() => {
    if (mentionActiveIndex >= filteredMentionTrades.length) {
      setMentionActiveIndex(0);
    }
  }, [filteredMentionTrades.length, mentionActiveIndex]);

  const createTradeChipElement = (trade) => {
    const chip = document.createElement('span');
    chip.className = 'trade-mention-chip';
    chip.contentEditable = 'false';
    chip.setAttribute('data-trade-scope', `trade-${trade.tradeNo}`);
    chip.setAttribute('title', `Trade #${trade.tradeNo} · ${trade.name} (Click to switch to trade note)`);
    chip.style.cssText = 'display:inline-flex;align-items:center;gap:3px;padding:2px 7px;margin:0 2px;background:var(--bg-card);border:1px solid var(--text-primary);border-radius:6px;font-size:11.5px;font-weight:600;color:var(--text-primary);cursor:pointer;vertical-align:middle;user-select:all;box-shadow:0 1px 2px rgba(0,0,0,0.03);';
    chip.innerHTML = `<span style="color:#6366f1;font-weight:600;font-size:12px;">@</span><span>${trade.name}</span><span style="font-size:10px;font-weight:500;opacity:0.7;background:var(--bg-surface);padding:0 3px;border-radius:3px;">#${trade.tradeNo}</span>`;
    return chip;
  };

  const createTradeChipHtml = (trade) => {
    return `<span class="trade-mention-chip" contenteditable="false" data-trade-scope="trade-${trade.tradeNo}" title="Trade #${trade.tradeNo} · ${trade.name} (Click to switch to trade note)" style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;margin:0 2px;background:var(--bg-card);border:1px solid var(--text-primary);border-radius:6px;font-size:11.5px;font-weight:600;color:var(--text-primary);cursor:pointer;vertical-align:middle;user-select:all;box-shadow:0 1px 2px rgba(0,0,0,0.03);"><span style="color:#6366f1;font-weight:600;font-size:12px;">@</span><span>${trade.name}</span><span style="font-size:10px;font-weight:500;opacity:0.7;background:var(--bg-surface);padding:0 3px;border-radius:3px;">#${trade.tradeNo}</span></span>`;
  };

  const insertSelectedMention = (trade, statsOnly = false) => {
    if (!trade) {
      setMentionPopup(null);
      return;
    }

    if (statsOnly) {
      insertTradeStats(trade);
      setMentionPopup(null);
      return;
    }

    if (mentionPopup && mentionPopup.node) {
      try {
        const { node, atSymbolIdx, offset } = mentionPopup;
        const range = document.createRange();
        const currentLen = node.textContent.length;
        range.setStart(node, Math.min(atSymbolIdx, currentLen));
        range.setEnd(node, Math.min(offset, currentLen));
        range.deleteContents();

        const chip = createTradeChipElement(trade);
        range.insertNode(chip);

        const space = document.createTextNode('\u00A0');
        if (chip.nextSibling) {
          chip.parentNode.insertBefore(space, chip.nextSibling);
        } else {
          chip.parentNode.appendChild(space);
        }

        const sel = window.getSelection();
        if (sel) {
          const newRange = document.createRange();
          newRange.setStartAfter(space);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
      } catch (err) {
        console.warn('Range insertion error:', err);
        execCmd('insertHTML', createTradeChipHtml(trade) + '&nbsp;');
      }
    } else {
      execCmd('insertHTML', createTradeChipHtml(trade) + '&nbsp;');
    }

    setMentionPopup(null);
    editorRef.current?.focus();
    handleEditorInput();
  };

  const checkMentionTrigger = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      setMentionPopup(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!range.collapsed) {
      setMentionPopup(null);
      return;
    }
    const node = range.startContainer;
    const offset = range.startOffset;
    if (!node || node.nodeType !== Node.TEXT_NODE) {
      setMentionPopup(null);
      return;
    }
    if (!editorRef.current || !editorRef.current.contains(node)) {
      setMentionPopup(null);
      return;
    }

    const textBefore = node.textContent.slice(0, offset);
    const match = textBefore.match(/(?:^|[^\w])@([a-zA-Z0-9_#.-]*(?:\s+[a-zA-Z0-9_#.-]+)*)$/);
    if (!match) {
      setMentionPopup(null);
      return;
    }

    const query = match[1];
    const atSymbolIdx = offset - query.length - 1;

    let top = 0;
    let left = 0;
    let caretTop = 0;
    try {
      const rangeClone = range.cloneRange();
      rangeClone.setStart(node, atSymbolIdx);
      rangeClone.setEnd(node, offset);
      const rect = rangeClone.getBoundingClientRect();
      if (rect && rect.bottom > 0) {
        top = rect.bottom + 6;
        caretTop = rect.top;
        left = rect.left;
      }
    } catch (e) {
      // ignore
    }

    if (!top && editorRef.current) {
      const edRect = editorRef.current.getBoundingClientRect();
      top = edRect.top + 60;
      caretTop = edRect.top;
      left = edRect.left + 20;
    }

    const popupHeight = 240;
    if (left + 330 > window.innerWidth) {
      left = Math.max(12, window.innerWidth - 340);
    }
    // If not enough room below, flip above caret
    if (top + popupHeight > window.innerHeight - 60 && caretTop > popupHeight + 20) {
      top = Math.max(10, caretTop - popupHeight - 8);
    }

    setMentionPopup({
      query,
      node,
      atSymbolIdx,
      offset,
      top,
      left,
    });
    setMentionActiveIndex(0);
  }, []);

  const handleEditorInput = () => {
    const text = editorRef.current?.innerText || '';
    setCharCount(text.length);
    setIsDirty(true);
    setIsSaved(false);
    checkMentionTrigger();
  };

  const handleEditorKeyUp = (e) => {
    if (['Escape', 'Enter', 'Tab', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    checkMentionTrigger();
  };

  const handleEditorKeyDown = (e) => {
    if (mentionPopup && filteredMentionTrades.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionActiveIndex(i => (i + 1) % filteredMentionTrades.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionActiveIndex(i => (i - 1 + filteredMentionTrades.length) % filteredMentionTrades.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSelectedMention(filteredMentionTrades[mentionActiveIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionPopup(null);
        return;
      }
    }
  };

  const handleEditorClick = (e) => {
    const chip = e.target.closest('.trade-mention-chip');
    if (chip) {
      const targetScope = chip.getAttribute('data-trade-scope');
      if (targetScope) {
        handleScope(targetScope);
      }
    }
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim() && tags.length < 8 && !tags.includes(tagInput.trim())) {
      e.preventDefault();
      setTags(prev => [...prev, tagInput.trim()]);
      setTagInput('');
      setIsDirty(true);
      setIsSaved(false);
    }
  };
  const removeTag = (idx) => {
    setTags(prev => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
    setIsSaved(false);
  };
  const handleMood  = (m) => { setMood(m);  setIsDirty(true); setIsSaved(false); };
  const handleTitle = (e) => { const v = e.target.value.slice(0, 80); setTitle(v); setIsDirty(true); setIsSaved(false); };

  const insertTemplate = (key) => {
    if (editorRef.current) {
      editorRef.current.innerHTML += TEMPLATES[key];
      editorRef.current.focus();
      handleEditorInput();
    }
    setShowTemplate(false);
  };

  const insertTradeMention = (trade) => {
    insertSelectedMention(trade);
    setShowTrade(false);
  };

  const handleFormatBlock = (val) => {
    setFormatBlock(val);
    const tagMap = { Normal: '<p>', H1: '<h1>', H2: '<h2>', H3: '<h3>', Quote: '<blockquote>', Code: '<pre>' };
    execCmd('formatBlock', tagMap[val] || '<p>');
  };

  const handleSpeech = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.'); return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!isRecording) {
      const rec = new SR();
      rec.continuous = false; rec.interimResults = false; rec.lang = 'en-IN';
      rec.onstart = () => setIsRecording(true);
      rec.onresult = (e) => execCmd('insertText', e.results[0][0].transcript + ' ');
      rec.onerror = () => setIsRecording(false);
      rec.onend   = () => setIsRecording(false);
      rec.start();
    } else { setIsRecording(false); }
  };

  const handleExport = (type) => {
    const text = editorRef.current?.innerText || '';
    const html = editorRef.current?.innerHTML || '';
    const header = `FoxTrade Note — ${formatDateLabel(dateStr)}\nTitle: ${title}\nMood: ${mood}\nTags: ${tags.join(', ')}\n\n`;
    if (type === 'print') {
      const w = window.open('', '_blank');
      w.document.write(`<html><head><title>FoxTrade Note ${dateStr}</title></head><body style="font-family:sans-serif;padding:20px"><h2>FoxTrade Journal Note</h2><p><strong>Date:</strong> ${formatDateLabel(dateStr)}</p><p><strong>Title:</strong> ${title}</p><p><strong>Mood:</strong> ${mood}</p><p><strong>Tags:</strong> ${tags.join(', ')}</p><hr/>${html}</body></html>`);
      w.document.close(); w.print();
    } else if (type === 'txt') {
      const blob = new Blob([header + text], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `FoxTrade_Note_${dateStr}.txt`; a.click();
    } else if (type === 'md') {
      const blob = new Blob([header + text], { type: 'text/markdown;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `FoxTrade_Note_${dateStr}.md`; a.click();
    } else if (type === 'html') {
      const blob = new Blob([`<!DOCTYPE html><html><body>${html}</body></html>`], { type: 'text/html;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `FoxTrade_Note_${dateStr}.html`; a.click();
    }
    setShowExport(false);
  };

  const recentTrades = allTrades.filter(t => t.status === 'Closed').slice(0, 12);
  const menuSt = {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999,
    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
  };
  const mItemSt = (last) => ({
    padding: '9px 14px', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
    cursor: 'pointer', borderBottom: !last ? '1px solid var(--border-color)' : 'none',
    display: 'flex', alignItems: 'center', gap: 8,
  });

  return (
    <div style={isExpanded ? {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 999999,
      background: 'var(--bg-card)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      boxShadow: '0 25px 60px rgba(0,0,0,0.18)',
    } : {
      width: 440, minWidth: 360, maxWidth: 480, background: 'var(--bg-card)',
      borderLeft: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', display: 'flex',
      flexDirection: 'column', height: '100%', overflow: 'hidden', flexShrink: 0,
      transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative',
        padding: isExpanded ? '14px 36px' : '14px 18px',
        borderBottom: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', flexShrink: 0,
        background: 'var(--bg-card)',
      }}>
        {/* Left: Close & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, zIndex: 1 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4, borderRadius: 6 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--border-color)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
            title="Close Note"
          ><ChevronLeft size={16} /></button>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
            {note?.content || note?.title ? 'Edit Note' : 'Add Note'}
          </span>
        </div>

        {/* Center: Clean Date */}
        <div style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          maxWidth: isExpanded ? '60%' : 'calc(100% - 210px)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          <span style={{
            fontSize: isExpanded ? 14 : 12.5,
            fontWeight: 600,
            color: 'var(--text-primary, #111827)',
            letterSpacing: '0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {formatDateLabel(dateStr)}
          </span>
        </div>

        {/* Right: Expand/Collapse */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, zIndex: 1 }}>
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            title={isExpanded ? 'Collapse to side drawer (Esc)' : 'Expand to full screen'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 9px', borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', background: isExpanded ? 'var(--bg-primary)' : 'var(--bg-surface)',
              color: 'var(--text-primary)', fontSize: 11, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-primary)'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = isExpanded ? 'var(--bg-primary)' : 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 65%, transparent)'; }}
          >
            {isExpanded ? (
              <>
                <Minimize2 size={13} strokeWidth={1.8} />
                <span>Collapse</span>
              </>
            ) : (
              <>
                <Maximize2 size={13} strokeWidth={1.8} />
                <span>Expand</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div style={{
        flex: 1, overflowY: 'auto', width: '100%',
        background: 'var(--bg-card)',
      }}>
        <div style={{
          padding: isExpanded ? '24px 32px 32px' : '16px 18px',
          display: 'flex', flexDirection: 'column', gap: 14,
          maxWidth: isExpanded ? 980 : '100%',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}>
        {/* Scope chips */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>NOTES:</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {activeTrade ? `Editing: ${activeTrade.name} · #${activeTrade.tradeNo}` : 'Editing: General Day Note'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Array.from(new Set(['general', ...tradesOnDay.map(t => `trade-${t.tradeNo}`), ...(scope !== 'general' ? [scope] : [])])).map(s => {
              const isActive = scope === s;
              const trade = s !== 'general' ? (tradesOnDay.find(t => `trade-${t.tradeNo}` === s) || allTrades.find(t => `trade-${t.tradeNo}` === s)) : null;
              const scopeData = scopedNotes[s] || (s === 'general' ? (scopedNotes.general || (note?.content ? note : null)) : null);
              const hasContent = Boolean(scopeData?.content || scopeData?.title);

              return (
                <button
                  key={s}
                  onClick={() => handleScope(s)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 13px', borderRadius: 20,
                    fontSize: 12, fontWeight: isActive ? 600 : 500, cursor: 'pointer',
                    border: isActive ? '1.5px solid var(--text-primary)' : '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                    background: isActive ? 'var(--bg-card)' : 'var(--bg-surface)',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--bg-primary)';
                      e.currentTarget.style.borderColor = 'var(--text-muted)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--bg-surface)';
                      e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 65%, transparent)';
                    }
                  }}
                >
                  {trade && <SymbolLogo symbol={trade.name} size={14} />}
                  <span>{trade ? `${trade.name} · #${trade.tradeNo}` : 'General'}</span>
                  {hasContent && (
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: '#10b981',
                      display: 'inline-block'
                    }} title="Note saved for this scope" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Trade Context Banner if active scope is a trade */}
        {activeTrade && (
          <div style={{
            padding: '8px 12px', borderRadius: 9,
            background: 'var(--bg-surface)', border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <SymbolLogo symbol={activeTrade.name} size={16} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                {activeTrade.name} #{activeTrade.tradeNo}
              </span>
            </div>
            <span style={{
              fontSize: 9.5, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
              background: (activeTrade.type || 'BUY').toUpperCase() === 'BUY' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              color: (activeTrade.type || 'BUY').toUpperCase() === 'BUY' ? '#10b981' : '#ef4444'
            }}>
              {activeTrade.type || 'BUY'}
            </span>
            {activeTrade.setup && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Setup: <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{activeTrade.setup}</strong>
              </span>
            )}
            <span style={{
              fontSize: 11.5, fontWeight: 600,
              color: (activeTrade.pnl || 0) >= 0 ? '#10b981' : '#ef4444',
              fontFamily: 'var(--font-mono)'
            }}>
              {(activeTrade.pnl || 0) >= 0 ? '+' : ''}₹{Math.abs(activeTrade.pnl || 0).toLocaleString('en-IN')}
            </span>
          </div>
        )}

        {/* Title */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>TITLE*</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{title.length}/80</span>
          </div>
          <input
            value={title}
            onChange={handleTitle}
            placeholder={activeTrade ? `E.g. ${activeTrade.name} #${activeTrade.tradeNo} — Post-trade review...` : 'Enter note title...'}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', background: 'var(--bg-surface)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        {/* Tags */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>TAGS:</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tags.length}/8</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 9, border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', background: 'var(--bg-surface)', minHeight: 38 }}>
            {tags.map((tag, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 5, background: 'color-mix(in srgb, var(--border-color) 50%, transparent)', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
                #{tag}
                <button onClick={() => removeTag(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', display: 'flex' }}><X size={10} /></button>
              </span>
            ))}
            {tags.length < 8 && (
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag}
                placeholder={tags.length === 0 ? 'Type tag and press Enter...' : 'Add tag...'}
                style={{ border: 'none', outline: 'none', fontSize: 12, background: 'transparent', color: 'var(--text-primary)', flex: 1, minWidth: 120, fontFamily: 'inherit' }}
              />
            )}
          </div>
        </div>

        {/* Mood + Action row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {MOOD_OPTIONS.map(m => (
              <button key={m.key} onClick={() => handleMood(m.key)} title={m.label} style={{
                background: mood === m.key ? 'var(--border-color)' : 'none',
                border: `2px solid ${mood === m.key ? m.color : 'transparent'}`,
                borderRadius: '50%', padding: 3, cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s',
              }}>{m.emoji}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div ref={exportRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowExport(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                <Download size={11} color="var(--text-muted)" /> Export
              </button>
              {showExport && (
                <div style={{ ...menuSt, right: 0, left: 'auto', minWidth: 200, border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
                  {[{icon:Printer,label:'Print / Save as PDF',key:'print'},{icon:FileDown,label:'Export as Markdown',key:'md'},{icon:Globe,label:'Export as HTML',key:'html'},{icon:FileText,label:'Export as Text',key:'txt'}].map((item,i,arr) => (
                    <div key={item.key} onClick={() => handleExport(item.key)} style={mItemSt(i===arr.length-1)}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    ><item.icon size={13} />{item.label}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Template */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <div ref={templateRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowTemplate(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 500, border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <LayoutTemplate size={12} /> Template <ChevronDown size={10} />
            </button>
            {showTemplate && (
              <div style={{ ...menuSt, minWidth: 220, border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
                {Object.keys(TEMPLATES).map((key, i, arr) => (
                  <div key={key} onClick={() => insertTemplate(key)} style={mItemSt(i===arr.length-1)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >{key}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Formatting toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 3, padding: '6px 8px', borderRadius: 9, border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)', background: 'var(--bg-surface)' }}>
          <select value={formatBlock} onChange={e => handleFormatBlock(e.target.value)}
            style={{ height: 24, padding: '0 4px', borderRadius: 5, fontSize: 11, fontWeight: 500, border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none' }}>
            {['Normal','H1','H2','H3','Quote','Code'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <TDiv />
          <TBtn title="Bold" onClick={() => execCmd('bold')}><span style={{ fontWeight: 600, fontSize: 13 }}>B</span></TBtn>
          <TBtn title="Italic" onClick={() => execCmd('italic')}><span style={{ fontStyle: 'italic', fontSize: 13 }}>I</span></TBtn>
          <TBtn title="Underline" onClick={() => execCmd('underline')}><span style={{ textDecoration: 'underline', fontSize: 13 }}>U</span></TBtn>
          <TBtn title="Strike" onClick={() => execCmd('strikeThrough')}><span style={{ textDecoration: 'line-through', fontSize: 13 }}>S</span></TBtn>
          <TDiv />
          <TBtn title="Ordered list" onClick={() => execCmd('insertOrderedList')}><ListOrdered size={13} /></TBtn>
          <TBtn title="Bullet list" onClick={() => execCmd('insertUnorderedList')}><ListIcon size={13} /></TBtn>
          <TDiv />
          <TBtn title="Blockquote" onClick={() => execCmd('formatBlock', '<blockquote>')}><Quote size={13} /></TBtn>
          <TBtn title="Code block" onClick={() => execCmd('formatBlock', '<pre>')}><Code size={13} /></TBtn>
          <TBtn title="Insert link" onClick={() => { const u = prompt('Enter URL:'); if (u) execCmd('createLink', u); }}><Link2 size={13} /></TBtn>
          <TDiv />
          <TBtn title="Insert 3×2 table" onClick={() => execCmd('insertHTML', '<table border="1" style="border-collapse:collapse;width:100%"><tbody><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><p></p>')}><Grid size={13} /></TBtn>
          <TDiv />
          <TBtn title="Clear formatting" danger onClick={() => execCmd('removeFormat')}><span style={{ fontSize: 11, fontWeight: 600 }}>Tx</span></TBtn>
        </div>

        {/* Editor */}
        <div ref={editorRef} contentEditable suppressContentEditableWarning
          onInput={handleEditorInput}
          onKeyUp={handleEditorKeyUp}
          onKeyDown={handleEditorKeyDown}
          onClick={handleEditorClick}
          data-placeholder="Write down your thoughts... (Type @ to mention any trade)"
          style={{
            minHeight: isExpanded ? 380 : 200,
            maxHeight: isExpanded ? 'none' : 340,
            overflowY: isExpanded ? 'visible' : 'auto',
            padding: '14px 16px', borderRadius: 10,
            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', background: 'var(--bg-surface)',
            fontSize: isExpanded ? 14 : 13.5, lineHeight: 1.7,
            color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
            position: 'relative'
          }}
        />

        {/* Floating @ Mention Autocomplete Menu */}
        {mentionPopup && (
          <div
            ref={mentionMenuRef}
            style={{
              position: 'fixed',
              top: mentionPopup.top,
              left: mentionPopup.left,
              zIndex: 9999999,
              width: 330,
              maxHeight: 255,
              background: 'var(--bg-card)',
              border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
              borderRadius: 12,
              boxShadow: '0 14px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '8px 12px 7px',
              borderBottom: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)',
              background: 'var(--bg-card)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <AtSign size={12} style={{ color: '#6366f1' }} />
                <span>Mention trade</span>
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
                ↑↓ · ↵ · Esc
              </span>
            </div>

            {/* Trades List */}
            <div style={{ overflowY: 'auto', maxHeight: 215, padding: '4px' }}>
              {filteredMentionTrades.length === 0 ? (
                <div style={{ padding: '18px 14px', fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center' }}>
                  No trades matching "{mentionPopup.query}"
                </div>
              ) : (
                filteredMentionTrades.map((t, idx) => {
                  const isSelected = idx === mentionActiveIndex;
                  const isOdd = idx % 2 === 1;
                  const pnlVal = getTradePnL(t);
                  const tradeDateStr = formatTradeDate(t.date || t.entryDate || t.rawDate);

                  const rowBg = isSelected
                    ? 'rgba(99, 102, 241, 0.08)'
                    : (isOdd ? 'var(--bg-primary, #f3f4f6)' : 'var(--bg-card, #ffffff)');

                  return (
                    <div
                      key={t.id || t.tradeNo || idx}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertSelectedMention(t);
                      }}
                      onMouseEnter={() => setMentionActiveIndex(idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        padding: '7px 9px',
                        borderRadius: 7,
                        cursor: 'pointer',
                        background: rowBg,
                        border: isSelected ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent',
                        transition: 'background 0.1s ease',
                      }}
                    >
                      <SymbolLogo symbol={t.name} size={22} />
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {t.name}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                            #{t.tradeNo}
                          </span>
                          {t.isDayTrade && (
                            <span style={{ fontSize: 9, fontWeight: 600, color: '#059669', background: 'rgba(16,185,129,0.12)', padding: '1px 5px', borderRadius: 4 }}>
                              Today
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>
                          {tradeDateStr && <span>{tradeDateStr}</span>}
                          {tradeDateStr && t.setup && <span>·</span>}
                          {t.setup && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.setup}</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                        {pnlVal !== 0 ? (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            fontFamily: 'var(--font-mono)',
                            color: pnlVal > 0 ? '#10b981' : '#ef4444',
                          }}>
                            {pnlVal > 0 ? '+' : '-'}₹{Math.abs(pnlVal).toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>₹0</span>
                        )}

                        <button
                          type="button"
                          title="Insert stats summary"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            insertSelectedMention(t, true);
                          }}
                          style={{
                            fontSize: 9,
                            fontWeight: 500,
                            padding: '1.5px 6px',
                            borderRadius: 4,
                            border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                            background: isSelected ? 'var(--bg-card)' : (isOdd ? 'var(--bg-card)' : 'var(--bg-primary, #f3f4f6)'),
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = 'var(--text-primary)';
                            e.currentTarget.style.borderColor = 'var(--text-primary)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = 'var(--text-secondary)';
                            e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 65%, transparent)';
                          }}
                        >
                          + Stats
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Sticky Bottom Footer */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
        background: 'var(--bg-card)',
        padding: isExpanded ? '12px 32px' : '10px 18px',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          maxWidth: isExpanded ? 980 : '100%', margin: '0 auto', width: '100%', boxSizing: 'border-box',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{charCount}/6000</span>
            {isDirty && (
              <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 500 }}>
                ● Unsaved changes
              </span>
            )}
            {isSaved && (
              <span style={{ fontSize: 11, color: '#10b981', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Check size={12} strokeWidth={2.5} /> Saved
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {Boolean(scopedNotes[scope]?.content || scopedNotes[scope]?.title || note?.content || note?.title) && (
              <button
                onClick={handleDeleteScope}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8,
                  border: '1px solid #fee2e2', background: '#fef2f2', color: '#ef4444',
                  fontSize: 11, fontWeight: 500, cursor: 'pointer'
                }}
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
            <button
              onClick={handleSave}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: 8,
                border: isSaved ? '1.5px solid #10b981' : '1.5px solid var(--text-primary)',
                background: isSaved ? '#10b981' : 'var(--bg-card)',
                color: isSaved ? '#ffffff' : 'var(--text-primary)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
              onMouseEnter={e => {
                if (!isSaved) e.currentTarget.style.background = 'var(--bg-primary)';
              }}
              onMouseLeave={e => {
                if (!isSaved) e.currentTarget.style.background = 'var(--bg-card)';
              }}
            >
              {isSaved ? <><Check size={13} strokeWidth={2.5} /> Saved</> : 'Save Note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── IndNoteEditor ────────────────────────────────────────────────────────────
function IndNoteEditor({ note, onChange, onDelete }) {
  const [title, setTitle]       = useState(note.title || '');
  const [status, setStatus]     = useState(note.status || 'todo');
  const [priority, setPriority] = useState(note.priority || 'medium');
  const [progress, setProgress] = useState(note.progress || 0);
  const [isSaved, setIsSaved]   = useState(false);
  const [isDirty, setIsDirty]   = useState(false);
  const editorRef = useRef(null);

  useEffect(() => {
    setTitle(note.title || ''); setStatus(note.status || 'todo');
    setPriority(note.priority || 'medium'); setProgress(note.progress || 0);
    if (editorRef.current) editorRef.current.innerHTML = note.content || '';
    setIsDirty(false);
    setIsSaved(false);
  }, [note.id]);

  const handleSave = () => {
    onChange({
      title, status, priority, progress,
      content: editorRef.current?.innerHTML || ''
    });
    setIsDirty(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const execCmd = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    setIsDirty(true);
    setIsSaved(false);
  };

  const statusColors   = { todo: '#9ca3af', in_progress: '#f59e0b', done: '#10b981' };
  const priorityColors = { low: '#9ca3af', medium: '#f59e0b', high: '#ef4444' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-surface)' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input value={title} onChange={e => { setTitle(e.target.value); setIsDirty(true); setIsSaved(false); }}
          placeholder="Untitled Note"
          style={{ flex: 1, minWidth: 140, border: 'none', outline: 'none', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', background: 'transparent', fontFamily: 'inherit' }}
        />
        <select value={status} onChange={e => { setStatus(e.target.value); setIsDirty(true); setIsSaved(false); }}
          style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', background: 'var(--bg-surface)', fontSize: 11, fontWeight: 600, color: statusColors[status], cursor: 'pointer', outline: 'none' }}>
          {['todo','in_progress','done'].map(s => <option key={s} value={s}>{s.replace('_',' ').toUpperCase()}</option>)}
        </select>
        <select value={priority} onChange={e => { setPriority(e.target.value); setIsDirty(true); setIsSaved(false); }}
          style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', background: 'var(--bg-surface)', fontSize: 11, fontWeight: 600, color: priorityColors[priority], cursor: 'pointer', outline: 'none' }}>
          {['low','medium','high'].map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
        </select>
        <button
          onClick={handleSave}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 7,
            border: 'none', background: isSaved ? '#10b981' : 'var(--text-primary)', color: 'var(--bg-card)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
          }}
        >
          {isSaved ? <><Check size={12} strokeWidth={2.5}/> Saved</> : 'Save'}
        </button>
        <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, borderRadius: 6, display: 'flex' }}><Trash2 size={14} /></button>
      </div>
      <div style={{ padding: '8px 18px', borderBottom: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>Progress {progress}%</span>
        <input type="range" min={0} max={100} value={progress} onChange={e => { setProgress(Number(e.target.value)); setIsDirty(true); setIsSaved(false); }}
          style={{ flex: 1, accentColor: 'var(--text-primary)', height: 3 }} />
        {isDirty && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 500 }}>● Unsaved</span>}
        {isSaved && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 500 }}>✔ Saved</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', padding: '6px 18px', borderBottom: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)' }}>
        <TBtn title="Bold" onClick={() => execCmd('bold')}><span style={{ fontWeight: 600, fontSize: 13 }}>B</span></TBtn>
        <TBtn title="Italic" onClick={() => execCmd('italic')}><span style={{ fontStyle: 'italic', fontSize: 13 }}>I</span></TBtn>
        <TBtn title="Underline" onClick={() => execCmd('underline')}><span style={{ textDecoration: 'underline', fontSize: 13 }}>U</span></TBtn>
        <TDiv />
        <TBtn title="Ordered" onClick={() => execCmd('insertOrderedList')}><ListOrdered size={13} /></TBtn>
        <TBtn title="Bullet" onClick={() => execCmd('insertUnorderedList')}><ListIcon size={13} /></TBtn>
        <TDiv />
        <TBtn title="Quote" onClick={() => execCmd('formatBlock', '<blockquote>')}><Quote size={13} /></TBtn>
        <TBtn title="Code" onClick={() => execCmd('formatBlock', '<pre>')}><Code size={13} /></TBtn>
        <TDiv />
        <TBtn title="Clear" danger onClick={() => execCmd('removeFormat')}><span style={{ fontSize: 11, fontWeight: 600 }}>Tx</span></TBtn>
      </div>
      <div ref={editorRef} contentEditable suppressContentEditableWarning
        onInput={() => { setIsDirty(true); setIsSaved(false); }}
        data-placeholder="Write your note..."
        style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
      />
    </div>
  );
}

// ─── Independent Notes Panel ─────────────────────────────────────────────────
function IndependentNotesPanel({ user }) {
  const [notes, setNotes]                     = useState(() => loadIndNotes());
  const [activeCategory, setActiveCategory]   = useState('notes');
  const [selectedId, setSelectedId]           = useState(null);
  const [search, setSearch]                   = useState('');

  const persist = useCallback((updated) => {
    setNotes(updated); saveIndNotesLS(updated);
    if (user?.uid && !user.uid.startsWith('demo-')) {
      setDoc(doc(db, 'journals', user.uid), { independentNotes: updated }, { merge: true }).catch(() => {});
    }
  }, [user]);

  const filtered = notes.filter(n =>
    n.category === activeCategory &&
    ((n.title || '').toLowerCase().includes(search.toLowerCase()) ||
     (n.content || '').toLowerCase().includes(search.toLowerCase()))
  );
  const sortedFiltered = [...filtered].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  const selectedNote = notes.find(n => n.id === selectedId) || null;

  const createNote = () => {
    const note = { id: genId(), title: '', content: '', tags: [], category: activeCategory, isPinned: false, priority: 'medium', progress: 0, status: 'todo', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const updated = [note, ...notes];
    persist(updated); setSelectedId(note.id);
  };
  const updateNote = (id, changes) => persist(notes.map(n => n.id === id ? { ...n, ...changes, updatedAt: new Date().toISOString() } : n));
  const deleteNote = (id) => { persist(notes.filter(n => n.id !== id)); if (selectedId === id) setSelectedId(null); };
  const pinNote    = (id) => persist(notes.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n));

  const statusColors = { todo: '#9ca3af', in_progress: '#f59e0b', done: '#10b981' };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Sidebar */}
      <div style={{ width: 280, minWidth: 240, background: 'var(--bg-card)', borderRight: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 12px 0', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {IND_CATEGORIES.map(cat => (
            <button key={cat.key} onClick={() => { setActiveCategory(cat.key); setSelectedId(null); }} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20,
              fontSize: 11, fontWeight: 500, cursor: 'pointer',
              border: activeCategory === cat.key ? '1.5px solid var(--text-primary)' : '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
              background: activeCategory === cat.key ? 'var(--text-primary)' : 'var(--bg-surface)',
              color: activeCategory === cat.key ? 'var(--bg-card)' : 'var(--text-secondary)', transition: 'all 0.15s',
            }}><cat.icon size={11} />{cat.label}</button>
          ))}
        </div>
        <div style={{ padding: '10px 12px', display: 'flex', gap: 6 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              style={{ width: '100%', paddingLeft: 28, paddingRight: 8, height: 30, border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', borderRadius: 8, background: 'var(--bg-surface)', fontSize: 12, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          <button onClick={createNote} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--text-primary)', color: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={14} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sortedFiltered.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>No {activeCategory} yet</p>
              <button onClick={createNote} style={{ padding: '6px 14px', borderRadius: 8, border: '1px dashed color-mix(in srgb, var(--border-color) 65%, transparent)', background: 'none', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>Create first</button>
            </div>
          ) : sortedFiltered.map(note => (
            <div key={note.id} onClick={() => setSelectedId(note.id)}
              style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)', background: selectedId === note.id ? 'var(--bg-primary)' : 'transparent', borderLeft: selectedId === note.id ? '3px solid var(--text-primary)' : '3px solid transparent' }}
              onMouseEnter={e => { if (selectedId !== note.id) e.currentTarget.style.background = 'var(--bg-primary)'; }}
              onMouseLeave={e => { if (selectedId !== note.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3, flex: 1, wordBreak: 'break-word' }}>
                  {note.isPinned && <Pin size={11} color="#f59e0b" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />}{note.title || 'Untitled'}
                </span>
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                  <button onClick={e => { e.stopPropagation(); pinNote(note.id); }} title={note.isPinned ? 'Unpin' : 'Pin'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: note.isPinned ? '#f59e0b' : 'var(--text-muted)', padding: 2 }}><Pin size={11} /></button>
                  <button onClick={e => { e.stopPropagation(); deleteNote(note.id); }} title="Delete"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><Trash2 size={11} /></button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 10, color: statusColors[note.status] || '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{(note.status||'').replace('_',' ')}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(note.updatedAt).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Editor panel */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {!selectedNote ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
            <StickyNote size={36} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>Select a note to edit</p>
            <button onClick={createNote} style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: 'var(--text-primary)', color: 'var(--bg-card)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ New {activeCategory.slice(0,-1)}</button>
          </div>
        ) : (
          <IndNoteEditor key={selectedNote.id} note={selectedNote}
            onChange={ch => updateNote(selectedNote.id, ch)}
            onDelete={() => deleteNote(selectedNote.id)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main NotesPage 2.0 ───────────────────────────────────────────────────────
export default function NotesPage({ trades = [], user, onOpenPlaybook }) {
  const [calMode, setCalMode]         = useState('year');
  const [viewMode, setViewMode]       = useState('calendar');
  const [independent, setIndependent] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [notes, setNotes]             = useState(() => loadNotes());
  const [selectedDate, setSelectedDate] = useState(null);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchText, setSearchText]   = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchActiveIdx, setSearchActiveIdx] = useState(0);
  const [searchTab, setSearchTab]     = useState('all'); // 'all' | 'notes' | 'stocks' | 'tags'
  const searchContainerRef            = useRef(null);
  const searchInputRef                = useRef(null);
  const [listFilter, setListFilter]   = useState('all'); // 'all' | 'notes' | 'wins' | 'losses'
  const [listSort, setListSort]       = useState('newest'); // 'newest' | 'oldest' | 'pnl_desc' | 'pnl_asc'
  const [dateFilter, setDateFilter]   = useState('All Time');
  const [showFilter, setShowFilter]   = useState(false);
  const filterRef                     = useRef(null);


  const [hoveredData, setHoveredData] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(null);
  const hoverTimeoutRef = useRef(null);

  const handleCellMouseEnter = (e, cellDs, pnl) => {
    clearTimeout(hoverTimeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const placement = rect.top > 300 ? 'top' : 'bottom';
    const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8;
    const popoverWidth = 320;
    const centerLeft = rect.left + rect.width / 2;
    const boundedLeft = Math.max(popoverWidth / 2 + 12, Math.min(window.innerWidth - popoverWidth / 2 - 12, centerLeft));

    setHoverPosition({ top, left: boundedLeft, placement });
    setHoveredData({
      ds: cellDs,
      pnl: pnl !== undefined ? pnl : (dailyPnL[cellDs] || 0),
      trades: getTradesForDate(trades, cellDs),
      note: notes[cellDs] || null
    });
  };

  const handleCellMouseLeave = () => {
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredData(null);
      setHoverPosition(null);
    }, 60);
  };

  const year     = currentDate.getFullYear();
  const monthIdx = currentDate.getMonth();
  const todayStr = dateToStr(new Date());

  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    const presentYear = new Date().getFullYear();

    // Always include present year
    yearsSet.add(presentYear);

    // Keep current viewed year visible
    if (year) {
      yearsSet.add(year);
    }

    // Extract all years from trades
    if (Array.isArray(trades)) {
      trades.forEach(t => {
        if (!t) return;
        [
          t.date, t.entryDate, t.exitDate,
          t.p1Date, t.p2Date, t.p3Date, t.p4Date,
          t.pyramid1Date, t.pyramid2Date, t.pyramid3Date, t.pyramid4Date,
          t.e1Date, t.e2Date, t.e3Date, t.e4Date,
          t.exit1Date, t.exit2Date, t.exit3Date, t.exit4Date,
        ].forEach(dStr => {
          const y = extractYear(dStr);
          if (y) yearsSet.add(y);
        });
      });
    }

    // Extract all years from notes
    if (notes && typeof notes === 'object') {
      Object.keys(notes).forEach(ds => {
        const y = extractYear(ds);
        if (y) yearsSet.add(y);
      });
    }

    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [trades, notes, year]);

  const yearIndex = availableYears.indexOf(year);

  useEffect(() => {
    if (user?.uid && !user.uid.startsWith('demo-')) {
      getDoc(doc(db, 'journals', user.uid)).then(d => {
        if (d.exists() && d.data().notesV2) {
          const merged = { ...loadNotes(), ...d.data().notesV2 };
          setNotes(merged); saveNotesLS(merged);
        }
      }).catch(() => {});
    }
  }, [user]);

  useEffect(() => { localStorage.setItem(LS_CALMODE_KEY, calMode); }, [calMode]);
  useEffect(() => { localStorage.setItem(LS_VIEWMODE_KEY, viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem(LS_INDMODE_KEY, String(independent)); }, [independent]);

  useEffect(() => {
    function h(e) { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false); }
    if (showFilter) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showFilter]);

  useEffect(() => {
    function handleSearchOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleSearchOutside);
    return () => document.removeEventListener('mousedown', handleSearchOutside);
  }, []);

  const dailyPnL = useMemo(() => calcDailyPnL(trades), [trades]);

  const saveNote = useCallback((dateStr, data) => {
    setNotes(prev => {
      const existing = prev[dateStr] || {};
      const updated = { ...prev, [dateStr]: { ...existing, ...data, updatedAt: new Date().toISOString(), createdAt: existing.createdAt || new Date().toISOString() } };
      saveNotesLS(updated);
      if (user?.uid && !user.uid.startsWith('demo-')) {
        setDoc(doc(db, 'journals', user.uid), { notesV2: updated }, { merge: true }).catch(() => {});
      }
      return updated;
    });
  }, [user]);

  const deleteNote = useCallback((dateStr) => {
    setNotes(prev => {
      const updated = { ...prev };
      delete updated[dateStr];
      saveNotesLS(updated);
      if (user?.uid && !user.uid.startsWith('demo-')) {
        setDoc(doc(db, 'journals', user.uid), { notesV2: updated }, { merge: true }).catch(() => {});
      }
      return updated;
    });
  }, [user]);

  const yearMonthCells = useMemo(() => {
    return Array.from({ length: 12 }, (_, mIdx) => {
      const firstDay = new Date(year, mIdx, 1);
      const lastDay  = new Date(year, mIdx + 1, 0);
      const cells = [];
      for (let i = 0; i < firstDay.getDay(); i++) cells.push({ isPad: true });
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const ds = `${year}-${String(mIdx+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const info = getDayNoteInfo(notes[ds]);
        cells.push({ day: d, ds, pnl: dailyPnL[ds] || 0, hasNote: info.hasNote, noteCount: info.count });
      }
      return { mIdx, cells, monthPnL: getMonthlyPnL(trades, year, mIdx) };
    });
  }, [year, dailyPnL, notes, trades]);

  const monthCells = useMemo(() => {
    const firstDay = new Date(year, monthIdx, 1);
    const lastDay  = new Date(year, monthIdx + 1, 0);
    const cells = [];
    for (let i = 0; i < firstDay.getDay(); i++) cells.push({ isPad: true });
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const ds = `${year}-${String(monthIdx+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const info = getDayNoteInfo(notes[ds]);
      cells.push({
        day: d,
        ds,
        pnl: dailyPnL[ds] || 0,
        hasNote: info.hasNote,
        noteCount: info.count,
        tradeCount: getTradesForDate(trades, ds).length,
        isToday: ds === todayStr
      });
    }
    return cells;
  }, [year, monthIdx, dailyPnL, notes, trades, todayStr]);

  const allDates = useMemo(() => {
    const set = new Set([...Object.keys(dailyPnL), ...Object.keys(notes)]);
    return Array.from(set);
  }, [dailyPnL, notes]);

  const searchSuggestions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return { all: [], notes: [], symbols: [], tags: [], counts: { all: 0, notes: 0, symbols: 0, tags: 0 } };

    const notesList = [];
    const symbolsList = [];
    const tagsList = [];
    const seenNotes = new Set();

    // 1. Check Matching Notes
    Object.entries(notes).forEach(([ds, noteObj]) => {
      if (!noteObj) return;
      const details = getNoteDetails(noteObj);
      const titleMatch = (details.title || '').toLowerCase().includes(q);
      const excerptMatch = (details.excerpt || '').toLowerCase().includes(q);

      // Check scoped notes
      if (noteObj.scopedNotes && typeof noteObj.scopedNotes === 'object') {
        Object.entries(noteObj.scopedNotes).forEach(([scKey, sn]) => {
          if (!sn) return;
          const snTitle = sn.title || '';
          const snContent = (sn.content || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
          if (snTitle.toLowerCase().includes(q) || snContent.toLowerCase().includes(q)) {
            const key = `note-${ds}-${scKey}`;
            if (!seenNotes.has(key)) {
              seenNotes.add(key);
              notesList.push({
                id: key,
                type: 'note',
                ds,
                title: snTitle || details.title || `Note: ${formatDateLabel(ds)}`,
                subtitle: snContent ? (snContent.length > 65 ? snContent.slice(0, 62) + '...' : snContent) : (details.excerpt ? (details.excerpt.length > 65 ? details.excerpt.slice(0, 62) + '...' : details.excerpt) : `Note on ${ds}`),
                date: ds,
              });
            }
          }
        });
      }

      if (titleMatch || excerptMatch) {
        const key = `note-${ds}-main`;
        if (!seenNotes.has(key)) {
          seenNotes.add(key);
          notesList.push({
            id: key,
            type: 'note',
            ds,
            title: details.title || `Note: ${formatDateLabel(ds)}`,
            subtitle: details.excerpt ? (details.excerpt.length > 65 ? details.excerpt.slice(0, 62) + '...' : details.excerpt) : `Journal note on ${ds}`,
            date: ds,
          });
        }
      }
    });

    // 2. Check Matching Stocks / Trades
    const symbolMap = {};
    if (Array.isArray(trades)) {
      trades.forEach(t => {
        const sym = (t.name || '').toUpperCase();
        if (sym && sym.toLowerCase().includes(q)) {
          if (!symbolMap[sym]) symbolMap[sym] = [];
          const tradeDate = normalizeIsoDate(t.date || t.entryDate || t.exitDate);
          if (tradeDate) symbolMap[sym].push({ date: tradeDate, trade: t });
        }
      });
    }
    Object.entries(symbolMap).forEach(([sym, list]) => {
      const key = `sym-${sym}`;
      const latestEntry = [...list].sort((a, b) => b.date.localeCompare(a.date))[0];
      symbolsList.push({
        id: key,
        type: 'symbol',
        ds: latestEntry.date,
        symbol: sym,
        title: sym,
        subtitle: `${list.length} trade${list.length > 1 ? 's' : ''} logged`,
        date: latestEntry.date,
      });
    });

    // 3. Check Matching Tags (Only tags where the tag text itself includes the query!)
    const tagMap = {};
    const queryClean = q.replace(/^#/, '');
    Object.entries(notes).forEach(([ds, noteObj]) => {
      const details = getNoteDetails(noteObj);
      details.tags.forEach(t => {
        const tagClean = t.replace(/^#/, '');
        if (tagClean.toLowerCase().includes(queryClean)) {
          if (!tagMap[tagClean]) tagMap[tagClean] = [];
          tagMap[tagClean].push(ds);
        }
      });
    });
    Object.entries(tagMap).forEach(([tagClean, dates]) => {
      const key = `tag-${tagClean}`;
      const latestDs = [...dates].sort().reverse()[0];
      tagsList.push({
        id: key,
        type: 'tag',
        ds: latestDs,
        title: `#${tagClean}`,
        subtitle: `Used in ${dates.length} note${dates.length > 1 ? 's' : ''}`,
        date: latestDs,
      });
    });

    const combinedAll = [
      ...notesList.slice(0, 4),
      ...symbolsList.slice(0, 3),
      ...tagsList.slice(0, 3)
    ];

    return {
      all: combinedAll,
      notes: notesList,
      symbols: symbolsList,
      tags: tagsList,
      counts: {
        all: notesList.length + symbolsList.length + tagsList.length,
        notes: notesList.length,
        symbols: symbolsList.length,
        tags: tagsList.length,
      }
    };
  }, [searchText, notes, trades]);

  const displayedSuggestions = useMemo(() => {
    if (searchTab === 'notes') return searchSuggestions.notes || [];
    if (searchTab === 'stocks') return searchSuggestions.symbols || [];
    if (searchTab === 'tags') return searchSuggestions.tags || [];
    return searchSuggestions.all || [];
  }, [searchSuggestions, searchTab]);

  const handleSelectSuggestion = (item) => {
    if (!item?.ds) return;
    const dt = strToDate(item.ds);
    setCurrentDate(dt);
    setSelectedDate(item.ds);
    if (viewMode === 'calendar' && calMode === 'year') {
      setCalMode('month');
    }
    setSearchFocused(false);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchActiveIdx(prev => (prev + 1) % Math.max(1, displayedSuggestions.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchActiveIdx(prev => (prev - 1 + displayedSuggestions.length) % Math.max(1, displayedSuggestions.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (displayedSuggestions.length > 0 && displayedSuggestions[searchActiveIdx]) {
        handleSelectSuggestion(displayedSuggestions[searchActiveIdx]);
      }
    } else if (e.key === 'Escape') {
      setSearchFocused(false);
    }
  };

  const listCounts = useMemo(() => {
    let all = allDates.length;
    let notesCount = 0;
    let wins = 0;
    let losses = 0;

    allDates.forEach(ds => {
      const info = getDayNoteInfo(notes[ds]);
      if (info.hasNote) notesCount++;
      const pnl = dailyPnL[ds] || 0;
      if (pnl > 0) wins++;
      else if (pnl < 0) losses++;
    });

    return { all, notes: notesCount, wins, losses };
  }, [allDates, notes, dailyPnL]);

  const listDays = useMemo(() => {
    return allDates
      .map(ds => {
        const noteDetails = getNoteDetails(notes[ds]);
        const tradesOnDay = getTradesForDate(trades, ds);
        const pnl = dailyPnL[ds] || 0;
        return {
          ds,
          pnl,
          tradesOnDay,
          hasNote: noteDetails.hasNote,
          noteCount: noteDetails.count,
          noteTitle: noteDetails.title,
          noteExcerpt: noteDetails.excerpt,
          noteTags: noteDetails.tags,
          noteMood: noteDetails.mood,
        };
      })
      .filter(d => {
        if (listFilter === 'notes' && !d.hasNote) return false;
        if (listFilter === 'wins' && d.pnl <= 0) return false;
        if (listFilter === 'losses' && d.pnl >= 0) return false;

        if (!searchText.trim()) return true;
        const q = searchText.toLowerCase().trim();
        const noteObj = notes[d.ds];
        const scopedMatches = noteObj?.scopedNotes && Object.values(noteObj.scopedNotes).some(sn =>
          (sn?.title || '').toLowerCase().includes(q) ||
          (sn?.content || '').toLowerCase().includes(q) ||
          (sn?.tags || []).some(t => t.toLowerCase().includes(q))
        );
        return (
          d.ds.includes(q) ||
          d.tradesOnDay.some(t => (t.name || '').toLowerCase().includes(q)) ||
          (noteObj?.title || '').toLowerCase().includes(q) ||
          (noteObj?.content || '').toLowerCase().includes(q) ||
          (noteObj?.tags || []).some(t => t.toLowerCase().includes(q)) ||
          scopedMatches
        );
      })
      .sort((a, b) => {
        if (listSort === 'newest') return b.ds.localeCompare(a.ds);
        if (listSort === 'oldest') return a.ds.localeCompare(b.ds);
        if (listSort === 'pnl_desc') return b.pnl - a.pnl;
        if (listSort === 'pnl_asc') return a.pnl - b.pnl;
        return b.ds.localeCompare(a.ds);
      });
  }, [allDates, notes, trades, dailyPnL, listFilter, listSort, searchText]);

  const pnlColor = (pnl) => pnl > 0 ? '#10b981' : pnl < 0 ? '#ef4444' : 'var(--text-muted)';

  // Intensity-based cell coloring: bigger P&L = deeper tint (same logic as Nexus)
  const BIG_THRESHOLD = 10000;
  const getDayCellStyle = (pnl, isSelected, isToday) => {
    const base = {
      transition: 'all 0.12s ease',
      boxShadow: isSelected ? '0 0 0 2px var(--text-primary)' : 'none',
      zIndex: isSelected ? 2 : (isToday ? 2 : 1),
    };
    if (pnl > 0) {
      const big = pnl >= BIG_THRESHOLD;
      return {
        ...base,
        background: big ? 'rgba(16,185,129,0.30)' : 'rgba(16,185,129,0.14)',
        border: isToday ? '1px solid var(--text-primary)' : (big ? '1.5px solid rgba(16,185,129,0.65)' : '1.5px solid rgba(16,185,129,0.38)'),
        color: '#047857',
      };
    }
    if (pnl < 0) {
      const big = pnl <= -BIG_THRESHOLD;
      return {
        ...base,
        background: big ? 'rgba(239,68,68,0.28)' : 'rgba(239,68,68,0.12)',
        border: isToday ? '1px solid var(--text-primary)' : (big ? '1.5px solid rgba(239,68,68,0.60)' : '1.5px solid rgba(239,68,68,0.38)'),
        color: '#dc2626',
      };
    }
    return {
      ...base,
      background: isSelected ? 'var(--border-color,#e5e7eb)' : 'var(--bg-primary)',
      border: isToday ? '1px solid var(--text-primary)' : '1px solid transparent',
      color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
    };
  };
  const filterMenuSt = {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999,
    background: 'var(--bg-card)', border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', minWidth: 190, overflow: 'hidden',
  };

  const renderPlaybookButton = () => (
    <button
      onClick={() => {
        if (onOpenPlaybook) onOpenPlaybook();
      }}
      title="Open Dedicated Playbook Studio"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        borderRadius: 20,
        cursor: 'pointer',
        border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
        background: 'var(--bg-surface)',
        color: 'var(--text-primary)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--text-primary)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 65%, transparent)';
      }}
    >
      <PlaybookIcon size={14} color="var(--text-primary)" />
      <span style={{
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: '0.01em',
        color: 'var(--text-primary)',
      }}>
        Playbook Studio →
      </span>
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
      {/* Top Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 24px', borderBottom: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', background: 'var(--bg-card)', flexShrink: 0 }}>
        {/* Search */}
        <div ref={searchContainerRef} style={{ position: 'relative' }}>
          {searchOpen ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'var(--bg-surface)',
              border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
              borderRadius: 8,
              padding: '4px 10px',
              width: 250,
              boxShadow: searchFocused ? '0 0 0 2px rgba(16,185,129,0.2)' : 'none',
              transition: 'all 0.15s ease',
            }}>
              <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                autoFocus
                value={searchText}
                onChange={e => {
                  setSearchText(e.target.value);
                  setSearchActiveIdx(0);
                  setSearchFocused(true);
                }}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search notes, tags, stocks..."
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: 12,
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  width: '100%',
                  fontFamily: 'inherit',
                  padding: 0,
                }}
              />
              {searchText && (
                <button
                  onClick={() => { setSearchText(''); searchInputRef.current?.focus(); }}
                  title="Clear text"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
                >
                  <X size={12} />
                </button>
              )}
              <button
                onClick={() => { setSearchOpen(false); setSearchText(''); setSearchFocused(false); }}
                title="Close search"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setSearchOpen(true); setSearchFocused(true); }}
              title="Search notes, tags, trades..."
              style={{
                background: 'none',
                border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '5px 8px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--border-color) 35%, transparent)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              <Search size={13} />
              <span>Search</span>
            </button>
          )}

          {/* Floating Search Suggestions Popover */}
          {searchFocused && searchText.trim().length > 0 && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              width: 390,
              maxHeight: 410,
              overflowY: 'auto',
              background: 'var(--bg-card)',
              border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
              borderRadius: 10,
              boxShadow: '0 12px 32px rgba(0,0,0,0.08)',
              zIndex: 9999,
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              {/* Header: Title & Hotkey instructions */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '2px 4px 6px',
                borderBottom: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)',
              }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Search Results
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Press ↵ to open · Esc to close
                </span>
              </div>

              {/* Filter Tabs: All, Notes, Stocks, Tags */}
              <div style={{ display: 'flex', gap: 4, padding: '2px 0 4px', borderBottom: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)' }}>
                {[
                  { key: 'all', label: 'All', count: searchSuggestions.counts.all },
                  { key: 'notes', label: 'Notes', count: searchSuggestions.counts.notes },
                  { key: 'stocks', label: 'Stocks', count: searchSuggestions.counts.symbols },
                  { key: 'tags', label: 'Tags', count: searchSuggestions.counts.tags },
                ].map(tab => {
                  const isTab = searchTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={(e) => {
                        e.preventDefault();
                        setSearchTab(tab.key);
                        setSearchActiveIdx(0);
                      }}
                      style={{
                        padding: '3px 9px',
                        borderRadius: 6,
                        border: isTab ? '1px solid var(--text-primary)' : '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                        background: isTab ? 'var(--text-primary)' : 'transparent',
                        color: isTab ? 'var(--bg-card)' : 'var(--text-secondary)',
                        fontSize: 11,
                        fontWeight: isTab ? 600 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <span>{tab.label}</span>
                      <span style={{
                        fontSize: 9.5,
                        opacity: isTab ? 0.9 : 0.6,
                        fontWeight: 600,
                      }}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Suggestion Items or Section Groups */}
              {displayedSuggestions.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  No matches found for "{searchText}"
                </div>
              ) : searchTab !== 'all' ? (
                /* Filtered Single Category */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {displayedSuggestions.map((item, idx) => {
                    const isActive = idx === searchActiveIdx;
                    const formattedDate = item.ds ? strToDate(item.ds).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
                    return (
                      <div
                        key={item.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(item);
                        }}
                        onMouseEnter={() => setSearchActiveIdx(idx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '6px 10px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: isActive ? 'var(--bg-primary, #f3f4f6)' : 'transparent',
                          border: isActive ? '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)' : '1px solid transparent',
                          transition: 'all 0.1s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
                          <div style={{
                            width: 22,
                            height: 22,
                            borderRadius: 5,
                            background: 'var(--bg-card)',
                            border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            color: 'var(--text-primary)',
                          }}>
                            {item.type === 'note' ? (
                              <FileText size={12} strokeWidth={1.8} />
                            ) : item.type === 'symbol' ? (
                              <SymbolLogo symbol={item.symbol} size={13} />
                            ) : (
                              <Tag size={12} strokeWidth={1.8} />
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.title}
                            </span>
                            {item.subtitle && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.subtitle}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {formattedDate && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{formattedDate}</span>}
                          <ArrowRight size={11} style={{ color: 'var(--text-muted)', opacity: isActive ? 1 : 0.3 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* All Mode with Clean Black/White Sections */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {searchSuggestions.notes.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        padding: '2px 6px 4px',
                      }}>
                        Notes ({searchSuggestions.notes.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {searchSuggestions.notes.slice(0, 4).map((item) => {
                          const idx = displayedSuggestions.findIndex(s => s.id === item.id);
                          const isActive = idx === searchActiveIdx;
                          const formattedDate = item.ds ? strToDate(item.ds).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
                          return (
                            <div
                              key={item.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectSuggestion(item);
                              }}
                              onMouseEnter={() => setSearchActiveIdx(idx)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                padding: '6px 10px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                background: isActive ? 'var(--bg-primary, #f3f4f6)' : 'transparent',
                                border: isActive ? '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)' : '1px solid transparent',
                                transition: 'all 0.1s ease',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
                                <div style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 5,
                                  background: 'var(--bg-card)',
                                  border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  color: 'var(--text-primary)',
                                }}>
                                  <FileText size={12} strokeWidth={1.8} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.title}
                                  </span>
                                  {item.subtitle && (
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {item.subtitle}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                {formattedDate && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{formattedDate}</span>}
                                <ArrowRight size={11} style={{ color: 'var(--text-muted)', opacity: isActive ? 1 : 0.3 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {searchSuggestions.symbols.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        padding: '4px 6px 4px',
                        borderTop: searchSuggestions.notes.length > 0 ? '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)' : 'none',
                        paddingTop: searchSuggestions.notes.length > 0 ? 6 : 2,
                      }}>
                        Stocks & Trades ({searchSuggestions.symbols.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {searchSuggestions.symbols.slice(0, 3).map((item) => {
                          const idx = displayedSuggestions.findIndex(s => s.id === item.id);
                          const isActive = idx === searchActiveIdx;
                          const formattedDate = item.ds ? strToDate(item.ds).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
                          return (
                            <div
                              key={item.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectSuggestion(item);
                              }}
                              onMouseEnter={() => setSearchActiveIdx(idx)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                padding: '6px 10px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                background: isActive ? 'var(--bg-primary, #f3f4f6)' : 'transparent',
                                border: isActive ? '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)' : '1px solid transparent',
                                transition: 'all 0.1s ease',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
                                <div style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 5,
                                  background: 'var(--bg-card)',
                                  border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}>
                                  <SymbolLogo symbol={item.symbol} size={13} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.title}
                                  </span>
                                  {item.subtitle && (
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {item.subtitle}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                {formattedDate && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{formattedDate}</span>}
                                <ArrowRight size={11} style={{ color: 'var(--text-muted)', opacity: isActive ? 1 : 0.3 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {searchSuggestions.tags.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        padding: '4px 6px 4px',
                        borderTop: (searchSuggestions.notes.length > 0 || searchSuggestions.symbols.length > 0) ? '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)' : 'none',
                        paddingTop: (searchSuggestions.notes.length > 0 || searchSuggestions.symbols.length > 0) ? 6 : 2,
                      }}>
                        Tags ({searchSuggestions.tags.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {searchSuggestions.tags.slice(0, 3).map((item) => {
                          const idx = displayedSuggestions.findIndex(s => s.id === item.id);
                          const isActive = idx === searchActiveIdx;
                          const formattedDate = item.ds ? strToDate(item.ds).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
                          return (
                            <div
                              key={item.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectSuggestion(item);
                              }}
                              onMouseEnter={() => setSearchActiveIdx(idx)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                padding: '6px 10px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                background: isActive ? 'var(--bg-primary, #f3f4f6)' : 'transparent',
                                border: isActive ? '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)' : '1px solid transparent',
                                transition: 'all 0.1s ease',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
                                <div style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 5,
                                  background: 'var(--bg-card)',
                                  border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  color: 'var(--text-primary)',
                                }}>
                                  <Tag size={12} strokeWidth={1.8} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.title}
                                  </span>
                                  {item.subtitle && (
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {item.subtitle}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                {formattedDate && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{formattedDate}</span>}
                                <ArrowRight size={11} style={{ color: 'var(--text-muted)', opacity: isActive ? 1 : 0.3 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* View toggles */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-primary)', borderRadius: 9, padding: 2, border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)', marginLeft: 2 }}>
          {[{key:'calendar',icon:Calendar,label:'Calendar'},{key:'list',icon:List,label:'List'}].map(v => (
            <button key={v.key} onClick={() => setViewMode(v.key)}
              style={{ padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: viewMode===v.key ? 'var(--bg-card)' : 'transparent', color: viewMode===v.key ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: viewMode===v.key ? '0 1px 2px rgba(0,0,0,0.04)' : 'none', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, transition: 'all 0.15s' }}>
              <v.icon size={13} />{v.label}
            </button>
          ))}
        </div>

        {/* YEAR/MONTH (on the left side beside List button) */}
        {viewMode === 'calendar' && (
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-primary)', borderRadius: 9, padding: 2, border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)', marginLeft: 2 }}>
            {['year','month'].map(m => (
              <button key={m} onClick={() => { setCalMode(m); if (m === 'year') setSelectedDate(null); }}
                style={{ padding: '4px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', background: calMode===m ? 'var(--bg-card)' : 'transparent', color: calMode===m ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: calMode===m ? '0 1px 2px rgba(0,0,0,0.04)' : 'none', transition: 'all 0.15s' }}>
                {m}
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Modern Playbook Mode Button */}
        <div>
          {renderPlaybookButton()}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: selectedDate ? '100%' : 920, margin: '0 auto', width: '100%' }}>
              
              {/* Trader-friendly Filter & Sort Toolbar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                background: 'var(--bg-card)',
                border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                borderRadius: 10,
                padding: '7px 12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}>
                {/* Filter Tabs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-primary)', borderRadius: 8, padding: 3, border: '1px solid color-mix(in srgb, var(--border-color) 55%, transparent)' }}>
                  {[
                    { key: 'all', label: 'All Days', count: listCounts.all },
                    { key: 'notes', label: 'With Notes', count: listCounts.notes, icon: FileText },
                    { key: 'wins', label: 'Green Days', count: listCounts.wins, color: '#10b981' },
                    { key: 'losses', label: 'Red Days', count: listCounts.losses, color: '#ef4444' },
                  ].map(tab => {
                    const isTabActive = listFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setListFilter(tab.key)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: 'none',
                          cursor: 'pointer',
                          background: isTabActive ? 'var(--bg-card)' : 'transparent',
                          color: isTabActive ? 'var(--text-primary)' : 'var(--text-muted)',
                          boxShadow: isTabActive ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11.5,
                          fontWeight: isTabActive ? 600 : 500,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {tab.color && <span style={{ width: 7, height: 7, borderRadius: '50%', background: tab.color }} />}
                        {tab.icon && <tab.icon size={11} style={{ color: isTabActive ? 'var(--text-primary)' : 'var(--text-muted)' }} />}
                        <span>{tab.label}</span>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '1px 5px',
                          borderRadius: 10,
                          background: isTabActive ? 'var(--bg-surface)' : 'rgba(0,0,0,0.05)',
                          color: isTabActive ? 'var(--text-primary)' : 'var(--text-muted)',
                        }}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Right controls: Active search indicator, Sort & Count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {searchText.trim() && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: 'var(--bg-surface)',
                      border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                    }}>
                      <span>Filtering: <strong>"{searchText}"</strong></span>
                      <button
                        onClick={() => setSearchText('')}
                        title="Clear search"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', display: 'flex' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
                    <ArrowUpDown size={12} />
                    <span>Sort:</span>
                    <select
                      value={listSort}
                      onChange={e => setListSort(e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        fontSize: 11.5,
                        fontWeight: 500,
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="pnl_desc">Highest Profit</option>
                      <option value="pnl_asc">Biggest Loss</option>
                    </select>
                  </div>

                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                    {listDays.length} {listDays.length === 1 ? 'day' : 'days'}
                  </span>
                </div>
              </div>

              {/* Day Cards */}
              {listDays.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '70px 20px',
                  background: 'var(--bg-card)',
                  borderRadius: 10,
                  border: '1px dashed color-mix(in srgb, var(--border-color) 65%, transparent)',
                  color: 'var(--text-muted)',
                }}>
                  <FileText size={36} style={{ marginBottom: 12, opacity: 0.25 }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>No journal days match this filter</p>
                  <p style={{ fontSize: 12, margin: 0 }}>Try changing your filter tab or clearing your search text.</p>
                </div>
              ) : (
                listDays.map(item => {
                  const isSelected = selectedDate === item.ds;
                  const dayDate = strToDate(item.ds);
                  const isToday = item.ds === todayStr;
                  const dayNum = String(dayDate.getDate()).padStart(2, '0');
                  const dayShort = dayDate.toLocaleDateString('en-GB', { weekday: 'short' });
                  const monthLong = dayDate.toLocaleDateString('en-GB', { month: 'long' });
                  const yearNum = dayDate.getFullYear();

                  const winCount = item.tradesOnDay.filter(t => (t.pnl || 0) > 0).length;
                  const lossCount = item.tradesOnDay.filter(t => (t.pnl || 0) < 0).length;
                  const totalTrades = item.tradesOnDay.length;
                  const winRate = totalTrades > 0 ? Math.round((winCount / totalTrades) * 100) : null;
                  const uniqueSymbols = Array.from(
                    new Set(
                      item.tradesOnDay
                        .map(t => (t.name || t.symbol || '').toUpperCase())
                        .filter(Boolean)
                    )
                  );

                  return (
                    <div
                      key={item.ds}
                      onClick={() => setSelectedDate(isSelected ? null : item.ds)}
                      style={{
                        background: 'var(--bg-card)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: isSelected ? '1px solid var(--text-primary)' : '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                        borderLeft: `4px solid ${item.pnl > 0 ? '#10b981' : item.pnl < 0 ? '#ef4444' : totalTrades > 0 ? 'var(--text-muted)' : 'color-mix(in srgb, var(--border-color) 65%, transparent)'}`,
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 90%, transparent)';
                          e.currentTarget.style.background = 'var(--bg-surface)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 65%, transparent)';
                          e.currentTarget.style.background = 'var(--bg-card)';
                        }
                      }}
                    >
                      {/* Line 1: Date & Net P&L */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                            {dayNum} {dayShort}
                          </span>
                          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                            {monthLong} {yearNum}
                          </span>
                          {isToday && (
                            <span style={{
                              fontSize: 9.5,
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: 'rgba(59,130,246,0.12)',
                              color: '#3b82f6',
                              letterSpacing: '0.04em',
                            }}>
                              TODAY
                            </span>
                          )}
                        </div>

                        <div>
                          {item.pnl !== 0 ? (
                            <span style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: item.pnl > 0 ? '#10b981' : '#ef4444',
                              fontFamily: 'inherit',
                            }}>
                              {item.pnl > 0 ? '+' : ''}₹{Math.abs(item.pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                          ) : totalTrades > 0 ? (
                            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-muted)' }}>
                              ₹0
                            </span>
                          ) : (
                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                              Journal Entry
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Line 2: Win/Loss Summary & Note Presence */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        {totalTrades > 0 ? (
                          <>
                            <span style={{ color: winCount > 0 ? '#10b981' : 'inherit', fontWeight: winCount > 0 ? 500 : 400 }}>
                              {winCount} profitable
                            </span>
                            <span style={{ color: lossCount > 0 ? '#ef4444' : 'inherit', fontWeight: lossCount > 0 ? 500 : 400 }}>
                              {lossCount} losing
                            </span>
                            {winRate !== null && totalTrades > 1 && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                ({winRate}% WR)
                              </span>
                            )}
                          </>
                        ) : (
                          <span>No trades executed</span>
                        )}

                        {item.hasNote && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                            <FileText size={12} style={{ color: 'var(--text-muted)' }} />
                            <span>{item.noteCount > 1 ? `${item.noteCount} notes` : '1 note'}</span>
                            {(item.noteTitle || item.noteExcerpt) && (
                              <>
                                <span style={{ color: 'var(--border-color)' }}>•</span>
                                <span style={{
                                  color: 'var(--text-secondary)',
                                  maxWidth: 380,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {item.noteTitle || item.noteExcerpt}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Line 3: Traded Stock Chips & Tags / Action */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                        {/* Traded Stock Logos & Names */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          {uniqueSymbols.length > 0 ? (
                            uniqueSymbols.map(sym => (
                              <div key={sym} style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 12,
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                              }}>
                                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                  <SymbolLogo symbol={sym} size={15} />
                                </div>
                                <span style={{ whiteSpace: 'nowrap' }}>{sym}</span>
                              </div>
                            ))
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              {item.hasNote ? 'Reflections & Journaling' : 'No stocks traded'}
                            </span>
                          )}
                        </div>

                        {/* Key Tags & Clean Action Hint */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {item.noteTags && item.noteTags.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              {item.noteTags.slice(0, 2).map(tag => (
                                <span key={tag} style={{
                                  fontSize: 10.5,
                                  fontWeight: 500,
                                  color: 'var(--text-secondary)',
                                  background: 'var(--bg-surface)',
                                  border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                }}>
                                  {tag.startsWith('#') ? tag : `#${tag}`}
                                </span>
                              ))}
                              {item.noteTags.length > 2 && (
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
                                  +{item.noteTags.length - 2}
                                </span>
                              )}
                            </div>
                          )}

                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 11,
                            fontWeight: 500,
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                          }}>
                            <span>{isSelected ? 'Editing' : item.hasNote ? 'Edit note' : 'Add note'}</span>
                            <ChevronRight size={12} style={{ transform: isSelected ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* YEAR VIEW */}
          {viewMode === 'calendar' && calMode === 'year' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
                <button
                  disabled={yearIndex <= 0}
                  onClick={() => {
                    if (yearIndex > 0) {
                      const prevY = availableYears[yearIndex - 1];
                      setCurrentDate(d => new Date(prevY, d.getMonth(), 1));
                    }
                  }}
                  title={yearIndex > 0 ? `Go to ${availableYears[yearIndex - 1]}` : 'No earlier trading years'}
                  style={{
                    background: 'none',
                    border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                    borderRadius: 7,
                    padding: '5px 9px',
                    cursor: yearIndex <= 0 ? 'not-allowed' : 'pointer',
                    opacity: yearIndex <= 0 ? 0.35 : 1,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ChevronLeft size={15} />
                </button>

                {availableYears.length > 1 ? (
                  <select
                    value={year}
                    onChange={e => setCurrentDate(d => new Date(Number(e.target.value), d.getMonth(), 1))}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                      background: 'var(--bg-surface)',
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  >
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                ) : (
                  <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>{year}</span>
                )}

                <button
                  disabled={yearIndex >= availableYears.length - 1}
                  onClick={() => {
                    if (yearIndex < availableYears.length - 1) {
                      const nextY = availableYears[yearIndex + 1];
                      setCurrentDate(d => new Date(nextY, d.getMonth(), 1));
                    }
                  }}
                  title={yearIndex < availableYears.length - 1 ? `Go to ${availableYears[yearIndex + 1]}` : 'No later trading years'}
                  style={{
                    background: 'none',
                    border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)',
                    borderRadius: 7,
                    padding: '5px 9px',
                    cursor: yearIndex >= availableYears.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: yearIndex >= availableYears.length - 1 ? 0.35 : 1,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {yearMonthCells.map(({ mIdx, cells, monthPnL }) => (
                  <div key={mIdx}
                    onClick={() => {
                      setCurrentDate(new Date(year, mIdx, 1));
                      setCalMode('month');
                      setSelectedDate(null);
                      setHoveredData(null);
                      setHoverPosition(null);
                    }}
                    style={{
                      background: 'var(--bg-card)', border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', borderRadius: 14,
                      padding: '14px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', cursor: 'pointer',
                      transition: 'all 0.18s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--text-muted)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.05)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 65%, transparent)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{SHORT_MONTHS[mIdx]}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: monthPnL>0?'#10b981':monthPnL<0?'#ef4444':'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {monthPnL>0?'+':''}{monthPnL!==0?`₹${Math.abs(monthPnL).toLocaleString('en-IN',{maximumFractionDigits:0})}`:'—'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
                      {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 500, color: 'var(--text-muted)' }}>{d}</div>)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                      {cells.map((cell, i) => cell.isPad ? <div key={i} /> : (
                        <div key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentDate(new Date(year, mIdx, 1));
                            setCalMode('month');
                            setSelectedDate(null);
                            setHoveredData(null);
                            setHoverPosition(null);
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.transform = 'scale(1.18)';
                            handleCellMouseEnter(e, cell.ds, cell.pnl);
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.transform = 'scale(1)';
                            handleCellMouseLeave();
                          }}
                          style={{
                            height: 24, borderRadius: 5, cursor: 'pointer', position: 'relative',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 500,
                            ...getDayCellStyle(cell.pnl, false, cell.ds === todayStr),
                          }}
                        >
                          {cell.day}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 18, fontSize: 11, color: 'var(--text-muted)', alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                  { bg:'rgba(239,68,68,0.12)', label:'Loss day' },
                  { bg:'rgba(239,68,68,0.28)', label:'Big loss (≥₹10k)' },
                  { bg:'rgba(16,185,129,0.14)', label:'Win day' },
                  { bg:'rgba(16,185,129,0.30)', label:'Big win (≥₹10k)' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: l.bg, display: 'inline-block' }} />{l.label}</div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><FileText size={12} color="var(--text-primary, #000000)" strokeWidth={1.8} /> Note(s)</div>
                <span style={{ fontSize: 10, opacity: 0.65, marginLeft: 8 }}>* Figures shown are gross profit/loss before taxes and charges. Hover on any date to see trades!</span>
              </div>
            </div>
          )}

          {/* MONTH VIEW */}
          {viewMode === 'calendar' && calMode === 'month' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
                <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth()-1, 1))}
                  style={{ background: 'none', border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><ChevronLeft size={15} /></button>
                <select value={monthIdx} onChange={e => setCurrentDate(d => new Date(d.getFullYear(), Number(e.target.value), 1))}
                  style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', background: 'var(--bg-surface)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}>
                  {MONTH_NAMES.map((m,i) => <option key={i} value={i}>{m.toUpperCase()}</option>)}
                </select>
                <select value={year} onChange={e => setCurrentDate(d => new Date(Number(e.target.value), d.getMonth(), 1))}
                  style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', background: 'var(--bg-surface)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}>
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth()+1, 1))}
                  style={{ background: 'none', border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><ChevronRight size={15} /></button>
                {(() => { const mp = getMonthlyPnL(trades, year, monthIdx); return mp!==0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: mp>0?'#10b981':'#ef4444', fontFamily: 'var(--font-mono)' }}>
                    GROSS P/L: {mp>0?'+':''}₹{Math.abs(mp).toLocaleString('en-IN',{maximumFractionDigits:0})}
                  </span>
                ); })()}
              </div>
              <div style={{ background: 'var(--bg-card)', border: '1px solid color-mix(in srgb, var(--border-color) 65%, transparent)', borderRadius: 16, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
                  {DAY_NAMES_SHORT.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0', letterSpacing: '0.04em' }}>{d}</div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
                  {monthCells.map((cell, i) => cell.isPad ? (
                    <div key={i} style={{ minHeight: 76, borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)', opacity: 0.4 }} />
                  ) : (
                    <div key={i}
                      onClick={() => {
                        setSelectedDate(cell.ds === selectedDate ? null : cell.ds);
                        setHoveredData(null);
                        setHoverPosition(null);
                      }}
                      onMouseEnter={e => {
                        if (selectedDate !== cell.ds) e.currentTarget.style.transform = 'scale(1.025)';
                        handleCellMouseEnter(e, cell.ds, cell.pnl);
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)';
                        handleCellMouseLeave();
                      }}
                      style={{
                        minHeight: 78, borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                        ...(() => {
                          const s = getDayCellStyle(cell.pnl, selectedDate === cell.ds, cell.isToday);
                          // Month cells: neutral background should be bg-card not bg-primary
                          if (cell.pnl === 0 && selectedDate !== cell.ds && !cell.isToday) {
                            return { ...s, background: 'var(--bg-card)', border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)' };
                          }
                          if (cell.pnl === 0 && selectedDate !== cell.ds && cell.isToday) {
                            return { ...s, background: 'var(--bg-card)', border: '1px solid var(--text-primary)' };
                          }
                          return s;
                        })(),
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          color: cell.isToday ? 'var(--text-primary)' : cell.pnl > 0 ? '#047857' : cell.pnl < 0 ? '#dc2626' : 'var(--text-secondary)'
                        }}>
                          {cell.day}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {cell.hasNote && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} title={`${cell.noteCount || 1} note(s)`}>
                              <FileText size={11} color="var(--text-primary, #000000)" strokeWidth={1.8} />
                              {cell.noteCount > 1 && (
                                <span style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--text-primary)' }}>{cell.noteCount}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        {cell.pnl > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: '#10b981', fontFamily: 'var(--font-mono)' }}>+₹{cell.pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>}
                        {cell.pnl < 0 && <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', fontFamily: 'var(--font-mono)' }}>-₹{Math.abs(cell.pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>}
                        {cell.tradeCount > 0 && <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>{cell.tradeCount} TRADE{cell.tradeCount > 1 ? 'S' : ''}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11, color: 'var(--text-muted)', alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                  { bg:'rgba(239,68,68,0.12)', label:'Loss day' },
                  { bg:'rgba(239,68,68,0.28)', label:'Big loss (≥₹10k)' },
                  { bg:'rgba(16,185,129,0.14)', label:'Win day' },
                  { bg:'rgba(16,185,129,0.30)', label:'Big win (≥₹10k)' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: l.bg, display: 'inline-block' }} />{l.label}</div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><FileText size={12} color="var(--text-primary, #000000)" strokeWidth={1.8} /> Note(s)</div>
                <span style={{ fontSize: 10, opacity: 0.65, marginLeft: 8 }}>* Figures shown are gross profit/loss before taxes and charges. Hover on any date to see trades!</span>
              </div>
            </div>
          )}
        </div>

        {/* Note Editor Drawer (only shown in Month or List view) */}
        {selectedDate && (viewMode === 'list' || calMode === 'month') && (
          <NoteEditor
            key={selectedDate}
            dateStr={selectedDate}
            note={notes[selectedDate] || null}
            tradesOnDay={getTradesForDate(trades, selectedDate)}
            allTrades={trades}
            onSave={saveNote}
            onDelete={deleteNote}
            onClose={() => setSelectedDate(null)}
          />
        )}
      </div>

      {/* Floating Hover Popover for Calendar Date Boxes */}
      {hoveredData && hoverPosition && (
        <DayHoverPopover data={hoveredData} position={hoverPosition} />
      )}
    </div>
  );
}
