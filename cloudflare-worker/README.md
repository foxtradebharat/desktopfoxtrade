# Cloudflare WebSocket Worker for FoxTrade (Production Setup)

This Cloudflare Worker is only required when you deploy FoxTrade to production (e.g. Vercel, Netlify, custom domain), because web browsers prohibit setting custom Origin headers directly when connecting to third-party WebSockets.

---

### Step-by-Step 2-Minute Deployment (100% Free Plan)

1. **Sign up / Log in to Cloudflare**
   - Go to [dash.cloudflare.com](https://dash.cloudflare.com) (Free plan includes 100,000 requests/day).

2. **Create a Worker**
   - Navigate to **Workers & Pages** -> Click **Create application** -> **Create Worker**.
   - Name it (e.g. `foxtrade-tv-ws`).
   - Click **Deploy**.

3. **Paste the Worker Code**
   - Click **Edit code** on the newly created Worker.
   - Replace the entire content with the code from [`tv-proxy-worker.js`](./tv-proxy-worker.js).
   - Click **Save and Deploy**.

4. **Connect FoxTrade to your Worker**
   - Copy your worker URL (e.g. `https://foxtrade-tv-ws.<your-subdomain>.workers.dev`).
   - In your production environment variables (e.g. on Vercel or in `.env.production`), add:
     ```bash
     VITE_TV_WS_PROXY=wss://foxtrade-tv-ws.<your-subdomain>.workers.dev/tv-ws
     ```

---

### Local Development
In local development (`npm run dev`), FoxTrade connects directly to TradingView WebSockets automatically without needing any Cloudflare Worker.
