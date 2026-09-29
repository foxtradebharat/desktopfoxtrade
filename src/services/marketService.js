/**
 * marketService.js
 *
 * Fetches live market status and trading holiday list from NSE via Vite proxy.
 * Calculates 100% precise Indian Standard Time (IST) market countdowns matching Nexus Journal.
 * 
 * Sessions:
 *   - Pre-Open:        09:00:00 - 09:15:00 IST
 *   - Regular Trading: 09:15:00 - 15:30:00 IST
 *   - Post-Market:     15:30:00 - 16:00:00 IST
 */

const HOLIDAY_CACHE_KEY    = 'nse_holidays';
const HOLIDAY_CACHE_TS_KEY = 'nse_holidays_ts';
const HOLIDAY_CACHE_TTL    = 30 * 24 * 60 * 60 * 1000; // 30 days

const STATUS_CACHE_KEY     = 'nse_market_status';
const STATUS_CACHE_TS_KEY  = 'nse_market_status_ts';
const STATUS_CACHE_TTL     = 60 * 1000; // 60 seconds

import { MarketTimingService, INDIAN_HOLIDAYS } from './marketTimingService';

// Comprehensive NSE 2026 standard holiday list matching Nexus Journal
const DEFAULT_NSE_HOLIDAYS = INDIAN_HOLIDAYS.map(h => h.date);

function readLocalStorage(key, tsKey, ttl) {
  try {
    const ts = parseInt(localStorage.getItem(tsKey) || '0', 10);
    if (Date.now() - ts > ttl) return null;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeLocalStorage(key, tsKey, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem(tsKey, String(Date.now()));
  } catch (e) {
    console.warn('[marketService] localStorage write failed:', e);
  }
}

function parseNSEDate(str) {
  if (!str) return null;
  const months = {
    Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
    Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12'
  };
  const [day, mon, year] = str.split('-');
  if (!day || !mon || !year) return null;
  return `${year}-${months[mon] || '00'}-${day.padStart(2, '0')}`;
}

let _holidaySet = new Set(DEFAULT_NSE_HOLIDAYS);

export async function getHolidaySet() {
  const cached = readLocalStorage(HOLIDAY_CACHE_KEY, HOLIDAY_CACHE_TS_KEY, HOLIDAY_CACHE_TTL);
  if (cached && Array.isArray(cached) && cached.length > 0) {
    _holidaySet = new Set(cached);
    return _holidaySet;
  }

  try {
    const res = await fetch('/nse-main/api/holiday-master?type=trading', {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const segment = json['CM'] || json['CBM'] || json['EQ'] || [];
    const dates = segment.map(h => parseNSEDate(h.tradingDate)).filter(Boolean);

    if (dates.length > 0) {
      writeLocalStorage(HOLIDAY_CACHE_KEY, HOLIDAY_CACHE_TS_KEY, dates);
      _holidaySet = new Set(dates);
    }
    return _holidaySet;
  } catch (err) {
    return _holidaySet;
  }
}

export async function isTodayHoliday() {
  const holidays = await getHolidaySet();
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  return holidays.has(today);
}

export async function fetchMarketStatus() {
  const cached = readLocalStorage(STATUS_CACHE_KEY, STATUS_CACHE_TS_KEY, STATUS_CACHE_TTL);
  if (cached) return cached;

  try {
    const res = await fetch('/nse-main/api/marketStatus', {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const states = json.marketState || [];
    const cm = states.find(s => s.market === 'Capital Market' || s.market === 'Equity') || states[0];
    if (!cm) throw new Error('No Capital Market state found');

    const statusStr = (cm.marketStatus || '').toLowerCase();
    const isOpen = statusStr === 'open';
    const isPreOpen = statusStr.includes('pre');
    const isPostClose = statusStr.includes('post');

    const result = {
      isOpen,
      isPreOpen,
      isPostClose,
      isClosed: !isOpen && !isPreOpen && !isPostClose,
      marketStatus: cm.marketStatus,
      message: cm.marketStatusMessage || cm.marketStatus,
      niftyLast: cm.last || 0,
      niftyChange: cm.variation || 0,
      niftyPct: cm.percentChange || 0,
      tradeDate: cm.tradeDate || '',
      fetchedAt: Date.now(),
    };

    writeLocalStorage(STATUS_CACHE_KEY, STATUS_CACHE_TS_KEY, result);
    return result;
  } catch (err) {
    return null;
  }
}

export async function getMarketInfo() {
  const [status, holidayCheck] = await Promise.all([
    fetchMarketStatus(),
    isTodayHoliday(),
  ]);

  if (status) {
    return {
      source: 'nse',
      isOpen: status.isOpen,
      isPreOpen: status.isPreOpen,
      isPostClose: status.isPostClose,
      isHoliday: holidayCheck && !status.isOpen,
      message: status.message,
      niftyLast: status.niftyLast,
      niftyChange: status.niftyChange,
      niftyPct: status.niftyPct,
    };
  }

  return getCalculatedMarketInfo(holidayCheck);
}

export function getCalculatedMarketInfo(isHoliday = false) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false, weekday: 'short'
  }).formatToParts(new Date());

  const get = (type) => parseInt(parts.find(p => p.type === type)?.value || '0');
  const dayStr = parts.find(p => p.type === 'weekday')?.value;
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[dayStr] ?? 0;

  const h = get('hour'), m = get('minute'), s = get('second');
  const curSec = h * 3600 + m * 60 + s;
  const preOpenStart = 9 * 3600;
  const openSec      = 9 * 3600 + 15 * 60;
  const closeSec     = 15 * 3600 + 30 * 60;
  const postClose    = 15 * 3600 + 40 * 60;

  const isWeekday = day >= 1 && day <= 5;
  const isOpen    = isWeekday && !isHoliday && curSec >= openSec && curSec < closeSec;
  const isPreOpen = isWeekday && !isHoliday && curSec >= preOpenStart && curSec < openSec;
  const isPostCl  = isWeekday && !isHoliday && curSec >= closeSec && curSec < postClose;

  return {
    source: 'calculated',
    isOpen, isPreOpen, isPostClose: isPostCl, isHoliday,
    message: isHoliday ? 'Market Closed (Holiday)' : isOpen ? 'Market Open' : 'Market Closed',
    niftyLast: 0, niftyChange: 0, niftyPct: 0,
  };
}

/**
 * 100% Precise IST Market Countdown Engine
 * Accurately handles weekdays, weekends, live hours, pre-open, post-market, and NSE holiday closures.
 * Returns formatted text matching Nexus Journal: "Market opens on Monday 44h 25m 10s" / "Market closes in 2h 15m 05s"
 */
export function getLiveMarketCountdown(market = 'india') {
  return MarketTimingService.getLiveMarketCountdown(market);
}
