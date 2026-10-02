/**
 * tradingViewSocketService.js
 * 
 * Direct WebSocket Market Data Service connected to TradingView data servers.
 * Provides real-time streaming market quote data.
 * 
 * Protocol: Socket.io Framing (~m~${length}~m~${payload})
 * Endpoint: wss://data.tradingview.com/socket.io/websocket?origin=https://in.tradingview.com
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

class TradingViewSocketService {
  constructor() {
    this.ws = null;
    this.connectionPromise = null;
    this.pendingRequests = new Map();
    this.inFlightRequests = new Map();
    this.isSupported = typeof WebSocket !== 'undefined';
  }

  mapInterval(interval = '1d') {
    const clean = String(interval).toLowerCase();
    switch (clean) {
      case '1m':
      case '1min':
        return '1';
      case '5m':
      case '5min':
        return '5';
      case '15m':
      case '15min':
        return '15';
      case '30m':
      case '30min':
        return '30';
      case '60m':
      case '1h':
        return '60';
      case '1w':
      case 'w':
      case 'week':
        return 'W';
      case '1mo':
      case 'month':
        return 'M';
      case '1d':
      case 'd':
      case 'day':
      default:
        return 'D';
    }
  }

  estimateBars(range = '1y', tvInterval = 'D') {
    if (tvInterval === '1' || tvInterval === '5' || tvInterval === '15' || tvInterval === '30' || tvInterval === '60') {
      return 3000;
    }
    switch (range) {
      case '1mo': return 40;
      case '3mo': return 100;
      case '6mo': return 180;
      case '1y': return 350;
      case '2y': return 700;
      case '5y': return 1750;
      case '10y':
      case 'all': return 4000;
      default: return 1000;
    }
  }

  cleanSymbol(symbol = '') {
    return symbol
      .trim()
      .toUpperCase()
      .replace(/\.(NS|BO|NSE|BSE)$/i, '')
      .replace(/-EQ$/i, '')
      .replace(/&/g, '_');
  }

  getTVSymbolsList(symbol = '') {
    const raw = symbol.trim().toUpperCase();
    if (INDEX_MAP[raw]) {
      return [INDEX_MAP[raw]];
    }

    const clean = this.cleanSymbol(symbol);
    if (INDEX_MAP[clean]) {
      return [INDEX_MAP[clean]];
    }

    // Direct exchange prefix provided
    if (raw.startsWith('NSE:') || raw.startsWith('BSE:') || raw.startsWith('NASDAQ:') || raw.startsWith('NYSE:') || raw.startsWith('AMEX:')) {
      return [raw];
    }

    // Default to NSE primary, BSE secondary fallback
    return [`NSE:${clean}`, `BSE:${clean}`];
  }

  async getPersistentConnection() {
    if (!this.isSupported) {
      throw new Error('WebSockets are not supported in this environment');
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.ws;
    }

    if (this.connectionPromise) {
      await this.connectionPromise;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        return this.ws;
      }
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const isLocal = typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        const wsUrl = isLocal
          ? 'wss://data.tradingview.com/socket.io/websocket?origin=https://in.tradingview.com'
          : (import.meta.env?.VITE_TV_WS_PROXY || 'wss://data.tradingview.com/socket.io/websocket?origin=https://in.tradingview.com');

        const socket = new WebSocket(wsUrl);

        const connectionTimeout = setTimeout(() => {
          if (socket.readyState !== WebSocket.OPEN) {
            try { socket.close(); } catch (_) {}
            reject(new Error('TradingView connection timed out'));
          }
        }, 6000);

        socket.onopen = () => {
          clearTimeout(connectionTimeout);
          this.ws = socket;
          resolve(socket);
        };

        socket.onmessage = (event) => {
          const rawData = String(event.data || '');

          // Heartbeat handling: ~m~${len}~m~~h~${id} -> send back exact ~m~${len}~m~~h~${id}
          if (rawData.includes('~h~')) {
            const hbMatch = rawData.match(/~m~\d+~m~~h~\d+/);
            if (hbMatch && socket.readyState === WebSocket.OPEN) {
              socket.send(hbMatch[0]);
            }
            return;
          }

          // Packet framing split
          const packets = rawData.split(/~m~\d+~m~/).filter(p => p && p.trim());
          for (const pkt of packets) {
            try {
              const parsed = JSON.parse(pkt);
              if (!parsed.p || !Array.isArray(parsed.p)) continue;

              const sessionId = parsed.p[0];
              const request = this.pendingRequests.get(sessionId);
              if (!request) continue;

              // Error from series
              if (parsed.m === 'series_error') {
                clearTimeout(request.timeout);
                this.pendingRequests.delete(sessionId);
                this.cleanupSession(socket, sessionId);
                request.reject(new Error('TradingView series_error for symbol'));
                continue;
              }

              // Timescale update with OHLCV data
              if (parsed.m === 'timescale_update') {
                const s1Data = parsed.p[1]?.s1;
                if (s1Data && Array.isArray(s1Data.s)) {
                  const isIntraday = ['1', '5', '15', '30', '60'].includes(String(request.tvInterval || ''));
                  const candles = s1Data.s.map(bar => {
                    const ts = bar.v[0];
                    const dateObj = new Date(ts * 1000);
                    const yyyy = dateObj.getFullYear();
                    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const dd = String(dateObj.getDate()).padStart(2, '0');
                    const dateStr = `${yyyy}-${mm}-${dd}`;

                    return {
                      time: isIntraday ? ts : dateStr,
                      rawTimestamp: ts,
                      open: Number(bar.v[1]),
                      high: Number(bar.v[2]),
                      low: Number(bar.v[3]),
                      close: Number(bar.v[4]),
                      volume: Number(bar.v[5] || 0)
                    };
                  }).filter(c => Number.isFinite(c.open) && Number.isFinite(c.close) && c.open > 0);

                  clearTimeout(request.timeout);
                  this.pendingRequests.delete(sessionId);
                  this.cleanupSession(socket, sessionId);
                  request.resolve(candles);
                }
              }
            } catch (_) {
              // Ignore partial JSON parse fragments
            }
          }
        };

        socket.onerror = (err) => {
          this.ws = null;
          this.rejectAllPending('TradingView WebSocket error');
          reject(err);
        };

        socket.onclose = () => {
          this.ws = null;
          this.connectionPromise = null;
          this.rejectAllPending('TradingView WebSocket closed');
        };
      } catch (err) {
        this.connectionPromise = null;
        reject(err);
      }
    });

    await this.connectionPromise;
    return this.ws;
  }

  cleanupSession(socket, sessionId) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        const msg = JSON.stringify({ m: 'chart_delete_session', p: [sessionId] });
        socket.send(`~m~${msg.length}~m~${msg}`);
      } catch (_) {}
    }
  }

  rejectAllPending(reason) {
    for (const [id, req] of this.pendingRequests.entries()) {
      clearTimeout(req.timeout);
      req.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  async executeWebSocketFetch(tvSymbol, tvInterval, barsCount) {
    const flightKey = `${tvSymbol}_${tvInterval}_${barsCount}`;
    if (this.inFlightRequests.has(flightKey)) {
      return this.inFlightRequests.get(flightKey);
    }

    const fetchPromise = (async () => {
      const socket = await this.getPersistentConnection();

      return new Promise((resolve, reject) => {
        const sessionId = `cs_${Math.random().toString(36).substring(2, 10)}`;
        
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(sessionId);
          this.cleanupSession(socket, sessionId);
          reject(new Error(`TradingView request timed out for ${tvSymbol}`));
        }, 5000);

        this.pendingRequests.set(sessionId, { resolve, reject, timeout, tvInterval });

        const sendPacket = (method, params) => {
          if (socket.readyState !== WebSocket.OPEN) return;
          const str = JSON.stringify({ m: method, p: params });
          socket.send(`~m~${str.length}~m~${str}`);
        };

        // Initialize chart session & request series
        sendPacket('chart_create_session', [sessionId, '']);
        sendPacket('resolve_symbol', [
          sessionId,
          'symbol_1',
          `={"adjustment":"dividends","session":"regular","symbol":"${tvSymbol}"}`
        ]);
        sendPacket('create_series', [sessionId, 's1', 's1', 'symbol_1', tvInterval, barsCount, '']);
      });
    })();

    this.inFlightRequests.set(flightKey, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      this.inFlightRequests.delete(flightKey);
    }
  }

  /**
   * Main Public Method to fetch historical candlestick series
   * @param {string} symbol - Ticker (e.g. 'RELIANCE', 'ASIANPAINT', 'NIFTY')
   * @param {string} interval - Interval ('1d', '1w', '1mo', '60m', '15m', '5m')
   * @param {string} range - Range ('1mo', '3mo', '6mo', '1y', '2y', '5y')
   * @returns {Promise<Array>} Sorted array of { time, open, high, low, close, volume }
   */
  async fetchHistoricalData(symbol, interval = '1d', range = '1y') {
    if (!symbol) throw new Error('Symbol is required');

    const tvInterval = this.mapInterval(interval);
    const barsCount = this.estimateBars(range, tvInterval);
    const symbolsToTry = this.getTVSymbolsList(symbol);

    let lastError = null;
    for (const tvSym of symbolsToTry) {
      try {
        const candles = await this.executeWebSocketFetch(tvSym, tvInterval, barsCount);
        if (candles && candles.length > 0) {
          return candles.sort((a, b) => (a.rawTimestamp || 0) - (b.rawTimestamp || 0));
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error(`No TradingView data available for ${symbol}`);
  }

  disconnect() {
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
    this.connectionPromise = null;
    this.rejectAllPending('TradingView service disconnected');
  }
}

export const tradingViewSocketService = new TradingViewSocketService();
export default tradingViewSocketService;
