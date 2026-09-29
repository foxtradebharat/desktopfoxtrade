/**
 * Cloudflare Worker — FoxTrade Auth Worker
 * ─────────────────────────────────────────────────────────────────────────────
 * Privacy-first OAuth token broker for FoxTrade.
 *
 * PURPOSE: Holds the Google OAuth client_secret so it never appears in
 * the browser bundle. Exchanges auth codes for refresh tokens and refreshes
 * expired access tokens. ZERO trade data ever passes through this worker.
 *
 * Routes:
 *   POST /api/auth/exchange  — exchange one-time auth code → refresh token
 *   POST /api/auth/refresh   — use refresh token → new access token
 *   GET  /api/health         — health check
 *
 * Deploy to Cloudflare Workers (free plan — 100k req/day, no commercial restriction):
 *   1. wrangler login
 *   2. wrangler deploy (from cloudflare-worker/ directory)
 *
 * Required Worker Secrets (set via Cloudflare dashboard or wrangler secret put):
 *   GOOGLE_CLIENT_ID      — from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET  — from Google Cloud Console
 *   ALLOWED_ORIGIN        — your app URL e.g. https://foxtrade.in (or * for dev)
 *
 * See wrangler.toml for deployment config.
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// ── CORS headers ──────────────────────────────────────────────────────────────

function corsHeaders(origin, env) {
  const allowed = env.ALLOWED_ORIGIN || '*';
  const allowedOrigin = allowed === '*' ? '*' : (origin === allowed ? origin : allowed);
  return {
    'Access-Control-Allow-Origin':  allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
  };
}

function jsonResponse(data, status = 200, origin = '*', env = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin, env),
    },
  });
}

function errorResponse(message, status = 400, origin = '*', env = {}) {
  return jsonResponse({ error: message }, status, origin, env);
}

// ── Route handlers ────────────────────────────────────────────────────────────

/**
 * POST /api/auth/exchange
 * Exchange a one-time Google auth code for access_token + refresh_token.
 *
 * Body: { code: string, redirectUri?: string }
 * Returns: { access_token, refresh_token, expires_in, token_type }
 */
async function handleExchange(request, env, origin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, origin, env);
  }

  const { code, redirectUri } = body;
  if (!code) return errorResponse('Missing "code" field', 400, origin, env);

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return errorResponse('Worker not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets', 500, origin, env);
  }

  const params = new URLSearchParams({
    code,
    client_id:     env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri:  redirectUri || 'postmessage',
    grant_type:    'authorization_code',
  });

  try {
    const resp = await fetch(GOOGLE_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('[AuthWorker] Exchange failed:', data);
      return errorResponse(data.error_description || data.error || 'Token exchange failed', resp.status, origin, env);
    }

    // Return only the fields the client needs — never log tokens
    return jsonResponse({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_in:    data.expires_in,
      token_type:    data.token_type,
    }, 200, origin, env);

  } catch (err) {
    return errorResponse(`Exchange request failed: ${err.message}`, 500, origin, env);
  }
}

/**
 * POST /api/auth/refresh
 * Use a stored refresh_token to get a new access_token.
 *
 * Body: { refreshToken: string }
 * Returns: { access_token, expires_in, token_type, refresh_token? }
 */
async function handleRefresh(request, env, origin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, origin, env);
  }

  const { refreshToken } = body;
  if (!refreshToken) return errorResponse('Missing "refreshToken" field', 400, origin, env);

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return errorResponse('Worker not configured', 500, origin, env);
  }

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id:     env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type:    'refresh_token',
  });

  try {
    const resp = await fetch(GOOGLE_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('[AuthWorker] Refresh failed:', data.error);
      return errorResponse(data.error_description || data.error || 'Token refresh failed', resp.status, origin, env);
    }

    return jsonResponse({
      access_token:  data.access_token,
      expires_in:    data.expires_in,
      token_type:    data.token_type,
      // refresh_token may be returned if Google rotates it
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
    }, 200, origin, env);

  } catch (err) {
    return errorResponse(`Refresh request failed: ${err.message}`, 500, origin, env);
  }
}

// ── Main fetch handler ────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    // Route
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return jsonResponse({ status: 'ok', service: 'foxtrade-auth-worker' }, 200, origin, env);
    }

    if (url.pathname === '/api/auth/exchange' && request.method === 'POST') {
      return handleExchange(request, env, origin);
    }

    if (url.pathname === '/api/auth/refresh' && request.method === 'POST') {
      return handleRefresh(request, env, origin);
    }

    return errorResponse('Not found', 404, origin, env);
  },
};
