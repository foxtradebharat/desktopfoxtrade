/**
 * Cloudflare Worker — FoxTrade Auth Worker
 * ─────────────────────────────────────────────────────────────────────────────
 * Privacy-first OAuth token broker for FoxTrade.
 *
 * PURPOSE: Holds the Google OAuth client_secret so it never appears in
 * the browser bundle. Exchanges auth codes for refresh tokens, refreshes
 * expired access tokens, and performs cheap keep-alive pings.
 * ZERO trade data ever passes through this worker.
 *
 * Routes:
 *   POST /api/auth/exchange   — exchange one-time auth code → refresh token
 *   POST /api/auth/refresh    — use refresh token → new access token (with invalid_grant detection)
 *   POST /api/auth/keepalive  — cheap weekly keepalive (drive.about.get) to prevent token revocation
 *   GET  /api/health          — health check
 *
 * Scheduled:
 *   CRON trigger ("0 0 * * 1" — weekly Monday at midnight UTC)
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_ABOUT_URL = 'https://www.googleapis.com/drive/v3/about?fields=user';

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

function errorResponse(message, status = 400, origin = '*', env = {}, extra = {}) {
  return jsonResponse({ error: message, ...extra }, status, origin, env);
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
      const isInvalidGrant = data.error === 'invalid_grant';
      return errorResponse(data.error_description || data.error || 'Token exchange failed', resp.status, origin, env, {
        code: isInvalidGrant ? 'invalid_grant' : 'exchange_failed',
        driveStatus: isInvalidGrant ? 'needs_reconnect' : undefined,
      });
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
 * Detects invalid_grant specifically to signal the client when a reconnect is required.
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
      console.error('[AuthWorker] Refresh failed:', data);
      const isInvalidGrant = data.error === 'invalid_grant' || (data.error_description && data.error_description.toLowerCase().includes('revoked'));
      return errorResponse(data.error_description || data.error || 'Token refresh failed', resp.status, origin, env, {
        code: isInvalidGrant ? 'invalid_grant' : 'refresh_failed',
        driveStatus: isInvalidGrant ? 'needs_reconnect' : undefined,
      });
    }

    return jsonResponse({
      access_token:  data.access_token,
      expires_in:    data.expires_in,
      token_type:    data.token_type,
      // refresh_token is only returned if Google rotates it
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
      driveStatus:   'connected',
    }, 200, origin, env);

  } catch (err) {
    return errorResponse(`Refresh request failed: ${err.message}`, 500, origin, env);
  }
}

/**
 * POST /api/auth/keepalive
 * Makes a cheap drive.about.get call using a fresh or refreshed token
 * to keep the token active and verify grant validity.
 *
 * Body: { refreshToken: string, accessToken?: string }
 */
async function handleKeepalive(request, env, origin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, origin, env);
  }

  const { refreshToken, accessToken } = body;
  if (!refreshToken && !accessToken) {
    return errorResponse('Missing refreshToken or accessToken', 400, origin, env);
  }

  let activeToken = accessToken;
  let rotatedRefreshToken = null;

  // If no accessToken provided or we want to verify via refresh token
  if (!activeToken && refreshToken) {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return errorResponse('Worker not configured', 500, origin, env);
    }

    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type:    'refresh_token',
    });

    const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
    });

    const tokenData = await tokenResp.json();
    if (!tokenResp.ok) {
      const isInvalidGrant = tokenData.error === 'invalid_grant';
      return errorResponse(tokenData.error_description || tokenData.error || 'Keepalive refresh failed', tokenResp.status, origin, env, {
        code: isInvalidGrant ? 'invalid_grant' : 'refresh_failed',
        driveStatus: isInvalidGrant ? 'needs_reconnect' : undefined,
      });
    }

    activeToken = tokenData.access_token;
    rotatedRefreshToken = tokenData.refresh_token || null;
  }

  try {
    const aboutResp = await fetch(GOOGLE_DRIVE_ABOUT_URL, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });

    if (!aboutResp.ok) {
      const errData = await aboutResp.json().catch(() => ({}));
      const is401 = aboutResp.status === 401;
      return errorResponse(errData?.error?.message || 'Drive about ping failed', aboutResp.status, origin, env, {
        code: is401 ? 'invalid_grant' : 'ping_failed',
        driveStatus: is401 ? 'needs_reconnect' : undefined,
      });
    }

    const aboutData = await aboutResp.json();
    return jsonResponse({
      status: 'connected',
      user: aboutData.user,
      access_token: activeToken,
      ...(rotatedRefreshToken ? { refresh_token: rotatedRefreshToken } : {}),
      checkedAt: Date.now(),
    }, 200, origin, env);

  } catch (err) {
    return errorResponse(`Keepalive request failed: ${err.message}`, 500, origin, env);
  }
}

// ── Main fetch & scheduled handlers ──────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    // Routes
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return jsonResponse({ status: 'ok', service: 'foxtrade-auth-worker' }, 200, origin, env);
    }

    if (url.pathname === '/api/auth/exchange' && request.method === 'POST') {
      return handleExchange(request, env, origin);
    }

    if (url.pathname === '/api/auth/refresh' && request.method === 'POST') {
      return handleRefresh(request, env, origin);
    }

    if (url.pathname === '/api/auth/keepalive' && request.method === 'POST') {
      return handleKeepalive(request, env, origin);
    }

    return errorResponse('Not found', 404, origin, env);
  },

  async scheduled(event, env, ctx) {
    console.log('[AuthWorker] Running scheduled weekly cron keepalive check...');
    // In a multi-tenant setup with D1 or KV, iterate over connected users here.
    // In the privacy-first client-owned architecture, clients also trigger weekly pings.
  },
};
