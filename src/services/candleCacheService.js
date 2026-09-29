/**
 * candleCacheService.js
 * 
 * High-performance client-side candle cache and replay timeline utility.
 * Caches fetched candlestick data per symbol + timeframe + range to eliminate
 * redundant network and Supabase/Yahoo calls during replay and scrubbing.
 */

const MEMORY_CACHE = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function getCandleCacheKey(symbol, interval = '1d', range = '1y') {
  const cleanSym = String(symbol || '').trim().toUpperCase();
  const cleanInt = String(interval || '1d').toLowerCase();
  const cleanRange = String(range || '1y').toLowerCase();
  return `${cleanSym}_${cleanInt}_${cleanRange}`;
}

export function getCachedCandles(symbol, interval = '1d', range = '1y') {
  const key = getCandleCacheKey(symbol, interval, range);
  const entry = MEMORY_CACHE.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    MEMORY_CACHE.delete(key);
    return null;
  }

  return entry.candles;
}

export function setCachedCandles(symbol, interval = '1d', range = '1y', candles = []) {
  if (!symbol || !Array.isArray(candles) || candles.length === 0) return;
  const key = getCandleCacheKey(symbol, interval, range);
  MEMORY_CACHE.set(key, {
    candles,
    timestamp: Date.now()
  });

  // Also opportunistically store in sessionStorage if size permits
  try {
    if (typeof window !== 'undefined' && window.sessionStorage && candles.length <= 1500) {
      window.sessionStorage.setItem(`ft_cache_${key}`, JSON.stringify({
        candles,
        timestamp: Date.now()
      }));
    }
  } catch (_) {
    // SessionStorage quota exceeded or disabled
  }
}

/**
 * Normalizes candle timestamp to Unix seconds (number)
 */
export function getCandleTimestampSeconds(candle) {
  if (!candle) return 0;
  if (candle.rawTimestamp && typeof candle.rawTimestamp === 'number') {
    return candle.rawTimestamp;
  }
  if (typeof candle.time === 'number') {
    return candle.time;
  }
  if (typeof candle.time === 'string') {
    const d = new Date(candle.time);
    const ts = d.getTime();
    if (!isNaN(ts)) return Math.floor(ts / 1000);
  }
  return 0;
}

/**
 * Finds the index of the candle closest to a given target timestamp.
 * Used for seamless timeframe switching mid-replay without losing position.
 * 
 * @param {Array} candles - Array of candle objects
 * @param {number|string} targetTime - Unix timestamp in seconds or Date string
 * @returns {number} 0-based index in candles array
 */
export function findNearestCandleIndex(candles, targetTime) {
  if (!candles || candles.length === 0 || !targetTime) return 0;

  let targetSec = 0;
  if (typeof targetTime === 'number') {
    // If milliseconds, convert to seconds
    targetSec = targetTime > 1e11 ? Math.floor(targetTime / 1000) : targetTime;
  } else if (typeof targetTime === 'string') {
    const d = new Date(targetTime);
    const ts = d.getTime();
    targetSec = isNaN(ts) ? 0 : Math.floor(ts / 1000);
  }

  if (targetSec <= 0) return 0;

  // Binary search for nearest bar
  let low = 0;
  let high = candles.length - 1;
  let bestIdx = 0;
  let minDiff = Infinity;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midSec = getCandleTimestampSeconds(candles[mid]);
    const diff = Math.abs(midSec - targetSec);

    if (diff < minDiff) {
      minDiff = diff;
      bestIdx = mid;
    }

    if (midSec === targetSec) {
      return mid;
    } else if (midSec < targetSec) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return bestIdx;
}

export default {
  getCandleCacheKey,
  getCachedCandles,
  setCachedCandles,
  getCandleTimestampSeconds,
  findNearestCandleIndex
};
