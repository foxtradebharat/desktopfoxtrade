/**
 * tvQuoteStreamService.js
 * 
 * High-performance TradingView Quote Session WebSocket Multiplexer
 * Delivers sub-second real-time streaming price updates (CMP, Prev Close, Change, Change %)
 * for NSE/BSE equities and indices.
 * 
 * Protocol: Socket.io Framing (~m~${length}~m~${payload})
 * Dev Endpoint: wss://data.tradingview.com/socket.io/websocket?origin=https://in.tradingview.com
 * Prod Endpoint: Configurable via Cloudflare Worker proxy
 */

const INDEX_MAP = {
  '^NSEI': 'NSE:NIFTY',
  'NIFTY': 'NSE:NIFTY',
  'NIFTY50': 'NSE:NIFTY',
  'NIFTY 50': 'NSE:NIFTY',
  '^NSEBANK': 'NSE:BANKNIFTY',
  'BANKNIFTY': 'NSE:BANKNIFTY',
  'BANK NIFTY': 'NSE:BANKNIFTY',
  '^CNXMIDCAP': 'NSE:NIFTYMIDSML400',
  'NIFMSC400': 'NSE:NIFTYMIDSML400',
  'MIDCPNIFTY': 'NSE:NIFTYMIDCAP100',
  'FINNIFTY': 'NSE:FINNIFTY',
  '^CNXSCAP': 'NSE:CNXSMALLCAP',
  'CNXSCAP': 'NSE:CNXSMALLCAP',
  '^CNX500': 'NSE:CNX500',
  'CNX500': 'NSE:CNX500',
  '^BSESN': 'BSE:SENSEX',
  'SENSEX': 'BSE:SENSEX',
  '^DJI': 'DJ:DJI',
  '^GSPC': 'SP:SPX',
  '^IXIC': 'NASDAQ:IXIC',
  '^NDX': 'NASDAQ:NDX'
};

class TVQuoteStreamService {
  constructor() {
    this.ws = null;
    this.session = 'qs_live_' + Math.random().toString(36).substring(2, 8);
    this.activeSymbols = new Set();
    this.symbolListeners = new Map();
    this.globalListeners = new Set();
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.latestQuotes = new Map();
  }

  cleanTicker(symbol = '') {
    return String(symbol)
      .trim()
      .toUpperCase()
      .replace(/^(NSE:|BSE:|INDEX:)/i, '')
      .replace(/\.(NS|BO|EQ|NF|BF)$/i, '')
      .replace(/-EQ$/i, '');
  }

  getTVSymbol(symbol = '') {
    const raw = String(symbol).trim().toUpperCase();
    if (INDEX_MAP[raw]) return INDEX_MAP[raw];

    const clean = this.cleanTicker(symbol);
    if (INDEX_MAP[clean]) return INDEX_MAP[clean];

    if (raw.startsWith('NSE:') || raw.startsWith('BSE:') || raw.startsWith('NASDAQ:') || raw.startsWith('NYSE:')) {
      return raw;
    }

    return 'NSE:' + clean;
  }

  getCustomWsUrl() {
    const isLocal = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (isLocal) {
      return 'wss://data.tradingview.com/socket.io/websocket?origin=https://in.tradingview.com';
    }

    const customWorkerUrl = import.meta.env?.VITE_TV_WS_PROXY;
    if (customWorkerUrl) {
      return customWorkerUrl;
    }
    // High-performance Cloudflare Edge WebSocket relay for TradingView Live Quotes
    return 'wss://nexus-journal-api.aniket-mahato-bcom23.workers.dev/functions/v1/tv-ws';
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    try {
      const wsUrl = this.getCustomWsUrl();
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        this.send('quote_create_session', [this.session]);
        this.send('quote_set_fields', [
          this.session,
          'lp',
          'prev_close_price',
          'ch',
          'chp',
          'volume',
          'high_price',
          'low_price',
          'open_price'
        ]);

        if (this.activeSymbols.size > 0) {
          const symbols = Array.from(this.activeSymbols);
          this.send('quote_add_symbols', [this.session, ...symbols]);
        }
      };

      this.ws.onmessage = (event) => {
        const rawData = String(event.data || '');

        if (rawData.includes('~h~')) {
          const hbMatch = rawData.match(/~m~\d+~m~~h~\d+/);
          if (hbMatch && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(hbMatch[0]);
          }
          return;
        }

        const packets = rawData.split(/~m~\d+~m~/).filter(p => p && p.trim());
        for (const pkt of packets) {
          try {
            const parsed = JSON.parse(pkt);
            if (parsed.m === 'qsd' && parsed.p && parsed.p[1] && parsed.p[1].v) {
              const tvSymbol = parsed.p[1].n;
              const val = parsed.p[1].v;
              const clean = this.cleanTicker(tvSymbol);

              const existing = this.latestQuotes.get(clean) || {};
              const lp = typeof val.lp === 'number' ? val.lp : existing.price;
              const prevClose = typeof val.prev_close_price === 'number' ? val.prev_close_price : existing.prevClose;
              
              let change = typeof val.ch === 'number' ? val.ch : existing.change;
              let changePercent = typeof val.chp === 'number' ? val.chp : existing.changePercent;

              if (lp && prevClose && (!change || isNaN(change))) {
                change = lp - prevClose;
                changePercent = ((lp - prevClose) / prevClose) * 100;
              }

              if (lp !== undefined && lp > 0) {
                const quoteObj = {
                  symbol: clean,
                  tvSymbol,
                  price: lp,
                  prevClose: prevClose || null,
                  change: change || 0,
                  changePercent: changePercent || 0,
                  timestamp: Date.now(),
                  status: 'live'
                };

                this.latestQuotes.set(clean, quoteObj);
                this.dispatchPriceUpdate(clean, quoteObj);
              }
            }
          } catch (_) {}
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[TVQuoteStream] WebSocket error:', err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.isConnecting = false;
        this.ws = null;
        this.scheduleReconnect();
      };
    } catch (err) {
      this.isConnected = false;
      this.isConnecting = false;
      this.ws = null;
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectAttempts += 1;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.activeSymbols.size > 0) {
        this.connect();
      }
    }, delay);
  }

  send(m, p) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const payload = JSON.stringify({ m, p });
    this.ws.send(`~m~${payload.length}~m~${payload}`);
  }

  subscribeSymbols(symbols = []) {
    if (!symbols || symbols.length === 0) return;

    if (!this.isConnected && !this.isConnecting) {
      this.connect();
    }

    const newTVSymbols = [];
    symbols.forEach(sym => {
      if (!sym) return;
      const tvSym = this.getTVSymbol(sym);
      if (!this.activeSymbols.has(tvSym)) {
        this.activeSymbols.add(tvSym);
        newTVSymbols.push(tvSym);
      }
    });

    if (newTVSymbols.length > 0 && this.isConnected) {
      this.send('quote_add_symbols', [this.session, ...newTVSymbols]);
    }
  }

  unsubscribeSymbols(symbols = []) {
    if (!symbols || symbols.length === 0) return;

    const removedTVSymbols = [];
    symbols.forEach(sym => {
      if (!sym) return;
      const tvSym = this.getTVSymbol(sym);
      if (this.activeSymbols.has(tvSym)) {
        this.activeSymbols.delete(tvSym);
        removedTVSymbols.push(tvSym);
      }
    });

    if (removedTVSymbols.length > 0 && this.isConnected) {
      this.send('quote_remove_symbols', [this.session, ...removedTVSymbols]);
    }
  }

  dispatchPriceUpdate(cleanSymbol, quoteObj) {
    const listeners = this.symbolListeners.get(cleanSymbol);
    if (listeners && listeners.size > 0) {
      listeners.forEach(cb => {
        try { cb(quoteObj); } catch (e) { console.error(e); }
      });
    }

    if (this.globalListeners.size > 0) {
      this.globalListeners.forEach(cb => {
        try { cb(cleanSymbol, quoteObj); } catch (e) { console.error(e); }
      });
    }
  }

  onGlobalUpdate(callback) {
    this.globalListeners.add(callback);
    return () => this.globalListeners.delete(callback);
  }

  subscribeSymbolListener(symbol, callback) {
    const clean = this.cleanTicker(symbol);
    if (!this.symbolListeners.has(clean)) {
      this.symbolListeners.set(clean, new Set());
    }
    this.symbolListeners.get(clean).add(callback);
    this.subscribeSymbols([clean]);

    if (this.latestQuotes.has(clean)) {
      callback(this.latestQuotes.get(clean));
    }

    return () => {
      const set = this.symbolListeners.get(clean);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.symbolListeners.delete(clean);
          this.unsubscribeSymbols([clean]);
        }
      }
    };
  }

  getCachedQuote(symbol) {
    const clean = this.cleanTicker(symbol);
    return this.latestQuotes.get(clean) || null;
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
  }
}

export const tvQuoteStreamService = new TVQuoteStreamService();
export default tvQuoteStreamService;
