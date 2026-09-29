import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.nseindia.com/',
  'X-Requested-With': 'XMLHttpRequest',
  'Connection': 'keep-alive',
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: false,
    watch: {
      ignored: ['**/public/data/**', '**/*.csv', '**/*.log']
    },
    proxy: {
      // NSE archives (EQUITY_L.csv for stock list)
      '/nse-api': {
        target: 'https://archives.nseindia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nse-api/, ''),
        secure: true,
        headers: {
          ...NSE_HEADERS,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      },
      // NSE main website API (market status, holiday list)
      '/nse-main': {
        target: 'https://www.nseindia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nse-main/, ''),
        secure: true,
        headers: NSE_HEADERS
      },
      // Yahoo Finance API proxy (live CMP fetching)
      '/yahoo-api': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yahoo-api/, ''),
        secure: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      },
      // Screener.in API proxy for live stock suggestions
      '/api/screener': {
        target: 'https://www.screener.in',
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/api\/screener/, '/api'),
        secure: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://www.screener.in/'
        }
      },
      '/screener-api': {
        target: 'https://www.screener.in',
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/screener-api/, '/api'),
        secure: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://www.screener.in/'
        }
      },
      // Yahoo Search API for US equities
      '/yahoo-search': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yahoo-search/, '/v1/finance/search'),
        secure: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      },
      // TradingView WebSocket proxy for local development
      '/tv-ws': {
        target: 'wss://data.tradingview.com',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tv-ws/, '/socket.io/websocket'),
        headers: {
          'Origin': 'https://in.tradingview.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      },
      // ── Broker REST API proxies (dev only — production uses Cloudflare Worker) ──
      '/api/broker/zerodha': {
        target: 'https://api.kite.trade',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/broker\/zerodha/, ''),
        secure: true,
      },
      '/api/broker/dhan': {
        target: 'https://api.dhan.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/broker\/dhan/, ''),
        secure: true,
      },
      '/api/broker/upstox': {
        target: 'https://api.upstox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/broker\/upstox/, '/v2/order'),
        secure: true,
      }
    }
  }
})
