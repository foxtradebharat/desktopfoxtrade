/**
 * liveMarketFeed.js
 * 
 * High-performance Multi-Tier Hybrid Live Market Engine for FoxTrade
 * 
 * Tier 1: Real-time TradingView Quote Session WebSocket (sub-second push streaming)
 * Tier 2: Yahoo Finance REST API (fast, verified official settled/EOD quote with previous close)
 * Tier 3: Strike Money REST 1m Tick API (intraday tick fallback)
 */

import { tvQuoteStreamService } from './tvQuoteStreamService';
import { fetchStrikePrice } from './strikePriceService';
import { fetchStockPrice } from './yahooService';

const SOURCE_PRIORITY = {
  'tv-ws': 3,
  'yahoo': 2,
  'strike': 1,
  'rest': 1
};

class LiveMarketFeedEngine {
  constructor() {
    this.subscribers = new Set();
    this.watchedSymbols = new Set();
    this.latestPrices = {}; // cleanTicker -> { price, prevClose, change, changePercent, timestamp, source }
    this.reconcileInterval = null;
    this.isConnected = false;
    this.reconcileFrequencyMs = 15000; // 15s background sync
    this.unsubscribeTvStream = null;
  }

  cleanSymbol(s = '') {
    return String(s || '')
      .trim()
      .toUpperCase()
      .replace(/^(NSE:|BSE:|INDEX:)/i, '')
      .replace(/\.(NS|BO|EQ|NF|BF)$/i, '')
      .replace(/-EQ$/i, '');
  }

  /**
   * Register symbols to track live
   */
  setWatchedSymbols(symbols = []) {
    const nextSet = new Set(symbols.map(s => this.cleanSymbol(s)).filter(Boolean));
    const changed = nextSet.size !== this.watchedSymbols.size || 
      [...nextSet].some(s => !this.watchedSymbols.has(s));

    if (changed) {
      this.watchedSymbols = nextSet;
      if (this.isConnected) {
        tvQuoteStreamService.subscribeSymbols(Array.from(nextSet));
        this.fetchFastInitialPrices();
      }
    }
  }

  /**
   * Start live feed engine
   */
  start() {
    if (this.isConnected) return;
    this.isConnected = true;

    // 1. Listen to real-time TradingView WebSocket stream
    this.unsubscribeTvStream = tvQuoteStreamService.onGlobalUpdate((symbol, quote) => {
      if (!quote || !quote.price) return;
      const clean = this.cleanSymbol(symbol);
      const prev = this.latestPrices[clean];

      if (!prev || prev.price !== quote.price || prev.source !== 'tv-ws') {
        this.latestPrices[clean] = {
          price: quote.price,
          prevClose: quote.prevClose || prev?.prevClose || null,
          change: quote.change !== undefined ? quote.change : (prev?.change || 0),
          changePercent: quote.changePercent !== undefined ? quote.changePercent : (prev?.changePercent || 0),
          timestamp: quote.timestamp || Date.now(),
          source: 'tv-ws'
        };
        this.notifySubscribers(this.latestPrices);
      }
    });

    // 2. Connect WebSocket and subscribe watched symbols
    if (this.watchedSymbols.size > 0) {
      tvQuoteStreamService.subscribeSymbols(Array.from(this.watchedSymbols));
      this.fetchFastInitialPrices();
    }

    // 3. Background reconciliation interval for symbols that may have dropped
    this.reconcileInterval = setInterval(() => {
      this.reconcileMissingPrices();
    }, this.reconcileFrequencyMs);
  }

  /**
   * Stop live feed engine
   */
  stop() {
    this.isConnected = false;
    if (this.unsubscribeTvStream) {
      this.unsubscribeTvStream();
      this.unsubscribeTvStream = null;
    }
    if (this.reconcileInterval) {
      clearInterval(this.reconcileInterval);
      this.reconcileInterval = null;
    }
    tvQuoteStreamService.disconnect();
  }

  /**
   * Instant initial fetch via Yahoo / Strike while WebSocket handshakes
   */
  async fetchFastInitialPrices() {
    const symbols = Array.from(this.watchedSymbols);
    if (symbols.length === 0) return;

    await Promise.all(
      symbols.map(async (symbol) => {
        const clean = this.cleanSymbol(symbol);
        if (!clean) return;

        // If already streaming via WebSocket and quote is fresh (< 20s), skip REST fetch
        const existing = this.latestPrices[clean];
        if (existing && existing.source === 'tv-ws' && (Date.now() - existing.timestamp < 20000)) {
          return;
        }

        try {
          // Tier 2: Yahoo Finance (fastest, exact official settled/EOD quote with previousClose)
          const yahooData = await fetchStockPrice(clean);
          if (yahooData && (yahooData.cmp || yahooData.price)) {
            const price = parseFloat(yahooData.cmp || yahooData.price);
            if (!isNaN(price) && price > 0) {
              this.updateSinglePrice(clean, price, 'yahoo', yahooData.change, yahooData.changePercent, yahooData.previousClose);
              return;
            }
          }

          // Tier 3: Strike Money fallback
          const strikeData = await fetchStrikePrice(clean);
          if (strikeData && strikeData.price > 0) {
            this.updateSinglePrice(clean, strikeData.price, 'strike');
          }
        } catch (_) {}
      })
    );
  }

  /**
   * Reconcile any symbols that haven't received a live quote in the last 30s
   */
  async reconcileMissingPrices() {
    const now = Date.now();
    const staleSymbols = Array.from(this.watchedSymbols).filter(sym => {
      const q = this.latestPrices[sym];
      return !q || (now - q.timestamp > 30000);
    });

    if (staleSymbols.length === 0) return;

    // Resubscribe on TV WebSocket
    tvQuoteStreamService.subscribeSymbols(staleSymbols);

    // Fallback fetch: Yahoo first, Strike second
    for (const sym of staleSymbols) {
      try {
        const yahooData = await fetchStockPrice(sym);
        if (yahooData && (yahooData.cmp || yahooData.price)) {
          const price = parseFloat(yahooData.cmp || yahooData.price);
          if (!isNaN(price) && price > 0) {
            this.updateSinglePrice(sym, price, 'yahoo', yahooData.change, yahooData.changePercent, yahooData.previousClose);
            continue;
          }
        }

        const strikeData = await fetchStrikePrice(sym);
        if (strikeData && strikeData.price > 0) {
          this.updateSinglePrice(sym, strikeData.price, 'strike');
        }
      } catch (_) {}
    }
  }

  updateSinglePrice(symbol, price, source = 'rest', change = 0, changePercent = 0, prevClose = null) {
    const clean = this.cleanSymbol(symbol);
    if (!clean || !Number.isFinite(price) || price <= 0) return;

    const existing = this.latestPrices[clean];
    const incomingPriority = SOURCE_PRIORITY[source] || 1;
    const existingPriority = SOURCE_PRIORITY[existing?.source] || 1;

    // Never allow a lower-priority source to overwrite a fresh higher-priority source (< 60s)
    if (existing && existingPriority > incomingPriority && (Date.now() - (existing.timestamp || 0) < 60000)) {
      return;
    }

    if (!existing || existing.price !== price || existing.source !== source) {
      this.latestPrices[clean] = {
        price,
        prevClose: prevClose || existing?.prevClose || null,
        change: change || existing?.change || 0,
        changePercent: changePercent || existing?.changePercent || 0,
        timestamp: Date.now(),
        source
      };
      this.notifySubscribers(this.latestPrices);
    }
  }

  /**
   * Fetch latest prices immediately (compatibility method)
   */
  async fetchNow() {
    return this.fetchFastInitialPrices();
  }

  /**
   * Subscribe to live price ticks
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    if (Object.keys(this.latestPrices).length > 0) {
      callback(this.latestPrices);
    }
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(data) {
    this.subscribers.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error('[LiveMarketFeed Subscriber Error]:', e);
      }
    });
  }

  getLatestPrice(symbol) {
    if (!symbol) return null;
    const clean = this.cleanSymbol(symbol);
    return this.latestPrices[clean]?.price || null;
  }
}

export const liveMarketFeed = new LiveMarketFeedEngine();
export default liveMarketFeed;
