/**
 * foxtrade-proxy-worker.js - Cloudflare Unified Worker v3.0
 *
 * Triple-purpose Worker for FoxTrade:
 *   1. TradingView WebSocket relay  (wss → data.tradingview.com)
 *   2. Indian Broker REST API proxy (GET /api/broker/{broker}/trades)
 *   3. Google OAuth Token Exchange & Refresh (POST /api/auth/exchange, /api/auth/refresh)
 *
 * ZERO trade data ever passes through this worker.
 *
 * Secrets needed in Cloudflare Dashboard:
 *   GOOGLE_CLIENT_ID     (66478562619-0m5i6qs0uje6s6qqngak5mdi175aqisa.apps.googleusercontent.com)
 *   GOOGLE_CLIENT_SECRET (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)
 */

const ALLOWED_ORIGINS = [
  'https://foxtrade.in',
  'https://www.foxtrade.in',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:5173',
];

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Kite-Version, access-token, client-id',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonRes(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// ── 1. ZERODHA PROXY ──────────────────────────────────────────────────────────
async function proxyZerodha(request, origin) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('token ')) return jsonRes({ error: 'Missing Zerodha Authorization header' }, 401, origin);
  const upstream = await fetch('https://api.kite.trade/trades', { headers: { 'X-Kite-Version': '3', 'Authorization': auth } });
  const body = await upstream.text();
  return new Response(body, { status: upstream.status, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } });
}

// ── 2. DHAN PROXY ─────────────────────────────────────────────────────────────
async function proxyDhan(request, origin) {
  const token = request.headers.get('access-token') || '';
  const clientId = request.headers.get('client-id') || '';
  if (!token || !clientId) return jsonRes({ error: 'Missing Dhan headers' }, 401, origin);
  const upstream = await fetch('https://api.dhan.co/trades', { headers: { 'access-token': token, 'client-id': clientId, 'Content-Type': 'application/json' } });
  const body = await upstream.text();
  return new Response(body, { status: upstream.status, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } });
}

// ── 3. UPSTOX PROXY ───────────────────────────────────────────────────────────
async function proxyUpstox(request, origin) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return jsonRes({ error: 'Missing Upstox Bearer token' }, 401, origin);
  const upstream = await fetch('https://api.upstox.com/v2/order/trades/get-trades-for-day', { headers: { 'Authorization': auth, 'Accept': 'application/json' } });
  const body = await upstream.text();
  return new Response(body, { status: upstream.status, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } });
}

// ── 4. TRADINGVIEW WEBSOCKET RELAY ───────────────────────────────────────────
async function proxyTradingViewWS() {
  const targetWsUrl = 'wss://data.tradingview.com/socket.io/websocket?origin=https://in.tradingview.com';
  const [clientWs, serverWs] = Object.values(new WebSocketPair());
  const tvResponse = await fetch(targetWsUrl, { headers: { 'Upgrade': 'websocket', 'Origin': 'https://in.tradingview.com', 'User-Agent': 'Mozilla/5.0' } });
  const upstreamWs = tvResponse.webSocket;
  if (!upstreamWs) return new Response('Failed to connect upstream', { status: 502 });
  upstreamWs.accept();
  serverWs.accept();
  serverWs.addEventListener('message', e => { try { if (upstreamWs.readyState === WebSocket.OPEN) upstreamWs.send(e.data); } catch (_) {} });
  upstreamWs.addEventListener('message', e => { try { if (serverWs.readyState === WebSocket.OPEN) serverWs.send(e.data); } catch (_) {} });
  serverWs.addEventListener('close', () => { try { upstreamWs.close(); } catch (_) {} });
  upstreamWs.addEventListener('close', () => { try { serverWs.close(); } catch (_) {} });
  return new Response(null, { status: 101, webSocket: clientWs });
}

// ── 5. GOOGLE OAUTH AUTH CODE EXCHANGE ────────────────────────────────────────
async function handleExchange(request, env, origin) {
  let body;
  try { body = await request.json(); } catch { return jsonRes({ error: 'Invalid JSON body' }, 400, origin); }

  const { code, redirectUri } = body;
  if (!code) return jsonRes({ error: 'Missing code' }, 400, origin);

  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return jsonRes({ error: 'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in worker secrets' }, 500, origin);
  }

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri || 'postmessage',
    grant_type: 'authorization_code',
  });

  try {
    const resp = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return jsonRes({ error: data.error_description || data.error || 'Token exchange failed' }, resp.status, origin);
    }

    return jsonRes({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
    }, 200, origin);
  } catch (err) {
    return jsonRes({ error: `Exchange failed: ${err.message}` }, 500, origin);
  }
}

// ── 6. GOOGLE OAUTH TOKEN REFRESH ─────────────────────────────────────────────
async function handleRefresh(request, env, origin) {
  let body;
  try { body = await request.json(); } catch { return jsonRes({ error: 'Invalid JSON body' }, 400, origin); }

  const { refreshToken } = body;
  if (!refreshToken) return jsonRes({ error: 'Missing refreshToken' }, 400, origin);

  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return jsonRes({ error: 'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in worker secrets' }, 500, origin);
  }

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  try {
    const resp = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return jsonRes({ error: data.error_description || data.error || 'Token refresh failed' }, resp.status, origin);
    }

    return jsonRes({
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
    }, 200, origin);
  } catch (err) {
    return jsonRes({ error: `Refresh failed: ${err.message}` }, 500, origin);
  }
}

// ── MAIN DISPATCHER ──────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonRes({
        status: 'healthy',
        service: 'FoxTrade Unified Worker',
        version: '3.0.0',
        features: ['tradingview-ws', 'broker-proxy', 'google-auth-proxy'],
        brokers: ['zerodha', 'dhan', 'upstox'],
      }, 200, origin);
    }

    // 1. TradingView WebSocket relay
    if (request.headers.get('Upgrade') === 'websocket' || url.pathname === '/tv-ws') {
      return proxyTradingViewWS();
    }

    // 2. Broker APIs
    if (url.pathname === '/api/broker/zerodha/trades') return proxyZerodha(request, origin);
    if (url.pathname === '/api/broker/dhan/trades')    return proxyDhan(request, origin);
    if (url.pathname === '/api/broker/upstox/trades')  return proxyUpstox(request, origin);

    // 3. Google OAuth Token Services (Zero trade data)
    if (url.pathname === '/api/auth/exchange' && request.method === 'POST') {
      return handleExchange(request, env, origin);
    }
    if (url.pathname === '/api/auth/refresh' && request.method === 'POST') {
      return handleRefresh(request, env, origin);
    }

    return jsonRes({ error: 'Unknown route', path: url.pathname }, 404, origin);
  },
};
