# 📖 Document 4 of 4 — The Technical Build Plan
### What Stack, How to Build It, Step by Step — Explained Simply

> **Who this is for:** You (the founder) + any developer you hire. Every tech decision explained in plain English so you can make informed decisions and talk to developers confidently.

---

## 🧱 First — What is a "Tech Stack"?

Imagine building a house. You need:
- **Foundation** — holds everything up
- **Walls** — structure
- **Electrical wiring** — makes things work
- **Plumbing** — data flow
- **Roof** — security/protection
- **Interior design** — what users actually see

A tech stack is the same — different technologies, each doing a specific job.

---

## 🗺️ System Overview (Big Picture)

```
                        USER
                          │
                    ┌─────▼──────┐
                    │  Browser   │   (Chrome, Safari, Firefox)
                    │  or App    │   (Android, iOS)
                    └─────┬──────┘
                          │ HTTPS (secure connection)
                    ┌─────▼──────┐
                    │  Frontend  │   What users SEE and CLICK
                    │  (Next.js) │
                    └─────┬──────┘
                          │ API calls
                    ┌─────▼──────┐
                    │  Backend   │   The BRAIN — processes data
                    │ (Node.js)  │
                    └──┬──┬──┬───┘
                       │  │  │
           ┌───────────┘  │  └──────────────┐
           ▼              ▼                 ▼
    ┌──────────┐   ┌──────────┐    ┌──────────────┐
    │ Database │   │  Cache   │    │   AI Engine  │
    │(Postgres)│   │ (Redis)  │    │  (OpenAI/    │
    └──────────┘   └──────────┘    │   Gemini)    │
                                   └──────────────┘
           │              │
           ▼              ▼
    ┌──────────┐   ┌──────────┐
    │  Broker  │   │WhatsApp  │
    │   APIs   │   │   Bot    │
    └──────────┘   └──────────┘
```

---

# 🔧 LAYER 1: Frontend (What Users See)

## Technology: **Next.js 15** (React-based)

### What is Next.js? (Simple explanation)
Next.js is like a factory that builds web pages. When you visit our website on your phone or laptop, Next.js builds and sends you the exact page you need — fast.

### Why Next.js and not something else?

| Technology | Why we chose / rejected |
|-----------|------------------------|
| **Next.js** ✅ | Fast, SEO-friendly, works for web AND mobile web, massive community, used by Zerodha, Notion, TikTok |
| Plain HTML/CSS | Too slow to build complex features, no code reuse |
| Vue.js | Good but smaller community = fewer developers to hire |
| Angular | Too complex, overkill for this |
| React alone | Next.js IS React, just with superpowers added |

### What Next.js does for us:
1. **Server-Side Rendering (SSR)** — Pages load fast even on 4G connections (important for Tier-2 cities)
2. **SEO** — Google can read our pages → free organic traffic (crucial for "Zerodha trading journal" search rankings)
3. **App Router** — Build complex multi-page apps cleanly
4. **API Routes** — Can handle simple backend logic within Next.js itself

---

## Styling: **Tailwind CSS + Shadcn/UI**

### What is Tailwind? (Simple)
Tailwind is like a set of LEGO blocks for design. Instead of writing long CSS code, you use small pre-built pieces. Faster to build, consistent look everywhere.

### What is Shadcn/UI?
Pre-built beautiful components (buttons, forms, tables, charts) that you just copy-paste and customize. Like buying furniture vs. building from scratch.

### Result: Beautiful, consistent UI built 3x faster.

---

## Mobile App: **React Native (Expo)**

### What is React Native? (Simple)
Write code ONCE. It works on both Android and iOS. No need to build separate Android app (Java/Kotlin) and iPhone app (Swift). One codebase = half the development time and cost.

### Expo:
A tool on top of React Native that makes it even easier:
- Build and test without a Mac (can build iOS app from Windows)
- Easy push notifications
- OTA (Over-The-Air) updates — push updates without App Store review

### Important:
Since we're using React/Next.js for web, the same React knowledge and components can be shared with the mobile app. Your developer knows one thing, builds three products: Web, Android, iOS.

---

## Charts & Graphs: **Recharts + TradingView Lightweight Charts**

### Recharts:
For our analytics dashboards — bar charts, line charts, pie charts, heatmaps. Free, open-source, beautiful.

### TradingView Lightweight Charts:
For showing actual stock price charts inside our journal. The SAME charts you see on TradingView.com — but embedded inside our app. Free open-source library from TradingView.

This is what Chartlog does (but we'll do it for Indian brokers).

---

# 🔧 LAYER 2: Backend (The Brain)

## Technology: **Node.js + Express.js** (or **Fastify**)

### What is Node.js? (Simple)
Node.js is the engine that runs the "brain" of our app on the server.

When a user uploads their Zerodha tradebook:
1. Node.js receives the file
2. Reads and parses all trade data
3. Calculates P&L, win rates, drawdown, taxes
4. Saves to database
5. Sends back a "success" response

All of this happens on our server — not the user's device.

### Why Node.js?

| Reason | Explanation |
|--------|-------------|
| **Same language as frontend** | Both use JavaScript. One developer can do both. Saves cost. |
| **Fast** | Non-blocking I/O — can handle many users simultaneously |
| **Huge ecosystem** | 2 million npm packages — for anything you need |
| **WhatsApp bot support** | WhatsApp Business API Node.js libraries are excellent |
| **Indian companies use it** | Zerodha, Swiggy, Razorpay all use Node.js |

### Fastify vs Express:
- Express = older, simple, good for MVP
- Fastify = newer, 2x faster, better for production
- Start with Express, migrate to Fastify when scaling

---

## Language: **TypeScript** (on top of JavaScript)

### What is TypeScript? (Simple)
TypeScript is JavaScript with a "spell checker" built in.

Regular JavaScript: You can write `user.nmae` (typo) and it won't warn you until users report bugs.
TypeScript: Immediately underlines `nmae` in red and says "Did you mean `name`?"

Result: 60% fewer bugs. Especially important for financial calculations where a wrong number is catastrophic.

---

## Real-time features: **Socket.io**

### What is Socket.io? (Simple)
Normal web: You ASK the server → server REPLIES. Request → Response.
Socket.io: Keeps a permanent connection open. Server can PUSH data to you any time.

We need this for:
- Real-time P&L updates as market moves
- Instant WhatsApp message → immediately visible in dashboard
- Live Tiltmeter updates during trading session
- Push notifications in the browser

---

# 🔧 LAYER 3: Database (Where Data Lives)

## Primary Database: **PostgreSQL**

### What is PostgreSQL? (Simple)
Think of it as a massive Excel sheet with superpowers. But instead of one sheet, it has hundreds of interconnected tables. And it's extremely fast and reliable.

### Why PostgreSQL (not MySQL, MongoDB)?

| Database | Our take |
|---------|---------|
| **PostgreSQL** ✅ | Best for financial data. Supports JSON + structured data. ACID compliant (no data loss ever). Used by Razorpay, GoJek. |
| MySQL | Good but PostgreSQL is strictly better for financial apps |
| MongoDB | No — financial data needs STRUCTURE. Flexible NoSQL is dangerous when every rupee must be accounted for |
| SQLite | No — only for local apps, not multi-user web apps |

### Key tables we'll have:
```
users          → Account info, settings, subscription status
trades         → Every trade entry (the core)
trade_tags     → Emotion/mistake tags per trade
sessions       → Daily review responses
milestones     → Achievements earned
analytics_cache → Pre-computed analytics for speed
brokers        → Supported broker configurations
imports        → Track every file upload
whatsapp_msgs  → WhatsApp bot message log
```

---

## Cache Layer: **Redis**

### What is Redis? (Simple)
Imagine a library where you read a book every day. Instead of walking to the shelf every time, you keep it on your desk. Redis is "keeping it on your desk."

### We use Redis for:
1. **Session data** — Remember that a user is logged in (much faster than reading database every time)
2. **Analytics cache** — Your win rate calculated once, stored in Redis, served instantly next time
3. **Rate limiting** — Prevent someone from uploading 1,000 files per second (abuse protection)
4. **WhatsApp bot state** — Remember mid-conversation context

---

## File Storage: **AWS S3 / Cloudflare R2**

### What is it? (Simple)
For storing:
- Chart screenshots users upload
- Voice memos
- Exported PDF reports
- CSV backups

S3 = Amazon's cloud storage. R2 = Cloudflare's cheaper alternative (no egress fees = saves money as we scale).

**Recommendation:** Start with Cloudflare R2 — 10x cheaper than S3 for our use case.

---

# 🔧 LAYER 4: AI Engine

## Technology: **OpenAI GPT-4o / Google Gemini 1.5 Pro**

### What the AI does: (Simple)
The AI is given a summary of your trading data and asked to analyze it.

Example prompt we send to AI:
```
"Here is a trader's 3-month data:
- 287 trades
- Win rate: 54%
- Best performing setup: Bank Nifty CE buys on Tuesday morning (71% win rate)
- Worst performing: Short selling (28% win rate)
- Shows revenge trading pattern on 23 occasions (bigger position after loss)
- Expiry day win rate: 31% vs 67% non-expiry
- Average holding: 23 minutes
- Best time: 9:15-10:30 AM
- Worst time: 2:30-3:30 PM

Generate a friendly, personalized coaching report in simple English.
Identify top 3 patterns, top 3 problems, and 1 specific action to take this week.
Keep it under 400 words. Use Indian trading context (NSE/BSE, F&O, lots, expiry days)."
```

The AI replies with exactly the kind of analysis shown in Document 3.

### Cost management:
- Don't run AI on every trade — run monthly reports (once a month per user)
- Cache the AI response for the month
- At ₹399/month pricing, AI cost per user = ~₹15–20/month (viable)

### Which AI to use:
| AI | Cost | Quality | Notes |
|----|------|---------|-------|
| **GPT-4o** | ~$0.15/1M tokens | Excellent | Best reasoning, most reliable |
| **Gemini 1.5 Pro** | ~$0.07/1M tokens | Very good | Cheaper, good for India context |
| **Claude 3.5 Sonnet** | ~$0.15/1M tokens | Excellent | Great at following instructions |

**Recommendation:** GPT-4o for quality, with Gemini as fallback to reduce cost.

---

# 🔧 LAYER 5: WhatsApp Bot

## Technology: **WhatsApp Business API (via Twilio or Interakt)**

### What is WhatsApp Business API? (Simple)
Regular WhatsApp is for personal use. WhatsApp Business API is for companies to send/receive messages programmatically (via code).

### Two providers:
| Provider | Cost | Notes |
|---------|------|-------|
| **Twilio** | ~₹0.80 per message | Global leader, excellent reliability |
| **Interakt** | ₹999/month flat | Indian company, simpler setup, Hindi support |
| **Gupshup** | ₹799/month | Another Indian provider |

**Recommendation:** Start with Interakt (Indian, cheaper, simpler) → Move to Twilio as we scale.

### How the bot works (technical flow):
```
1. User sends WhatsApp message to our number
2. WhatsApp → sends webhook to our server (Node.js)
3. Our server parses the message using NLP
4. Extracts: instrument, entry price, exit price, emotion tag
5. Creates trade entry in database
6. Sends confirmation reply back via WhatsApp API
7. User sees entry in their dashboard
```

### Message parsing examples:
```
User types: "Sold nifty 23200 CE at 285 entry was 210"
We parse:   instrument=NIFTY23200CE, exit=285, entry=210, action=SELL
We calculate: P&L = (285-210) × 50 = ₹3,750

User types: "BANKNIFTY short 51500 put, loss of 3500 today, fear trade"
We parse:   instrument=BANKNIFTY51500PE, P&L=-3500, emotion=fear
```

---

# 🔧 LAYER 6: Broker Integrations

## Phase 1 — CSV Import (File Upload)

### How CSV parsing works: (Simple)
Every broker lets you download your trades as a CSV/Excel file. The format is different for each broker.

We build a "parser" for each broker — a piece of code that knows exactly how to read that broker's specific file format.

### Zerodha tradebook format:
```
trade_date | tradingsymbol | exchange | segment | series | trade_type | quantity | price | order_id | trade_id | order_execution_time
```

### Our parser reads this and converts to our standard format:
```
date: 12-Jul-2026
symbol: NIFTY26JUL23200CE
action: BUY
qty: 50
price: 210.50
type: OPTIONS
```

We need separate parsers for: Zerodha, Groww, Dhan, Upstox, Fyers, Angel One, mStock, ICICI, Kotak, Motilal.

**Timeline:** All 10 parsers = ~4 weeks of developer time.

---

## Phase 2 — Broker API Auto-Sync

### Zerodha Kite Connect API:
Zerodha has a public API called **Kite Connect**. It's a paid API (₹2,000/month flat for our platform — not per user).

Using Kite Connect, we can:
- Get user's trade history with ONE API call
- No file download needed
- Auto-refresh every hour

**Setup process for user:**
1. User clicks "Connect Zerodha" in our app
2. Redirected to Zerodha login page
3. User logs in, approves access
4. Zerodha sends us a token
5. We use that token to read their trades
6. Done! Auto-syncs every hour.

(Same OAuth flow as "Login with Google")

### Cost:
- Kite Connect: ₹2,000/month for our platform
- With 1,000 Zerodha users → ₹2/user/month extra cost (very manageable)

### Other broker APIs:
| Broker | API Name | Status |
|--------|---------|--------|
| Zerodha | Kite Connect | ✅ Available (₹2,000/month) |
| Upstox | Upstox API v2 | ✅ Available (free) |
| Angel One | SmartAPI | ✅ Available (free) |
| Dhan | Dhan API | ✅ Available (free) |
| Fyers | Fyers API v3 | ✅ Available (free) |
| Groww | No public API | ❌ CSV import only (for now) |

---

# 🔧 LAYER 7: Authentication & Security

## Technology: **Auth.js (NextAuth)** + **JWT tokens**

### What is authentication? (Simple)
When you log in, how does our server know it's really YOU? Authentication solves this.

### How it works:
1. User signs up with email + password (or Google/Apple login)
2. Password is **hashed** (converted to unreadable scrambled code — we NEVER store actual passwords)
3. On login → verify → issue a JWT "token" (like a temporary ID card)
4. Every request from user carries this token
5. Our server checks the token before showing any data

### Login options we offer:
- 📧 Email + Password
- 🔵 Google Login (most Indian users already signed into Google)
- 📱 Mobile Number + OTP (most Indian-native apps use this)

### OTP via: **Twilio SMS** or **Fast2SMS** (Indian, cheaper — ₹0.15/OTP)

---

## Data Security:

### Encryption at rest:
All trade data in database is encrypted using **AES-256** (military-grade encryption). Even if someone steals our database file, they see gibberish.

### Encryption in transit:
All data between browser and server travels over **HTTPS/TLS**. Like a locked tunnel.

### Privacy positioning (marketing):
> "We encrypt your trade data so strongly that even our own engineers cannot read your specific trades. Your strategy stays yours."

This is BETTER than Nexus's "data never leaves your browser" approach — because we give you multi-device access AND we give you genuine privacy.

---

# 🔧 LAYER 8: Payments

## Technology: **Razorpay** (Primary) + **PhonePe Business** (Alternative)

### Why Razorpay?
- India's #1 payment gateway
- Accepts: UPI, Credit Card, Debit Card, Net Banking, EMI
- Easy integration with Node.js
- Subscription billing built-in (auto-charge monthly/annual)
- Dashboard to track revenue, failed payments, refunds
- Used by Zerodha, CRED, Swiggy

### Pricing setup in Razorpay:
```
Plans we create:
1. Free Plan     → ₹0 (no payment needed)
2. Starter       → ₹199/month or ₹1,499/year
3. Pro           → ₹399/month or ₹2,999/year
4. Elite         → ₹799/month or ₹5,999/year
```

### Razorpay cost: 2% per transaction (standard Indian rate)
At ₹399/month × 1,000 users = ₹3,99,000 revenue → Razorpay fee = ₹7,980 (2%)

---

# 🔧 LAYER 9: Hosting & Infrastructure

## Option A (Recommended for Start): **Vercel + Railway**

### Vercel (Frontend hosting):
- Next.js was built by Vercel. Best hosting for Next.js.
- Deploy in 1 click from GitHub
- Auto-scales under traffic spikes (if you go viral on Twitter)
- Free tier for early stage
- Paid: ~$20/month for production

### Railway (Backend hosting):
- Simple platform for Node.js + PostgreSQL + Redis
- No complicated server setup needed
- Auto-deploys when you push code to GitHub
- Cost: ~$10–30/month initially

### Total infrastructure cost at start: **~$30–50/month** (₹2,500–4,200/month)

---

## Option B (When Scaling): **AWS / Google Cloud**

When you have 10,000+ users:
- Move to AWS EC2 (virtual servers)
- AWS RDS (managed PostgreSQL)
- AWS ElastiCache (managed Redis)
- AWS S3 (file storage)
- AWS CloudFront (CDN for fast loading globally)

This is more complex but gives more control and better pricing at scale.

---

# 📋 STEP-BY-STEP BUILD ROADMAP

## Phase 0: Before You Write Code (Week 1–2)

```
□ Finalize brand name (Artha Journal / Drishti / other)
□ Register domain (.in + .com)
□ Register company (Private Ltd — needed for Razorpay & APIs)
□ Set up GitHub repository
□ Set up project management (Notion / Linear)
□ Create Figma design mockups for MVP screens
□ Define MVP feature list (ruthlessly minimal)
□ Hire developer (or find co-founder)
```

---

## Phase 1: MVP — The Core Journal (Week 3–10)

**Goal:** Working product that Zerodha users can use.

```
Week 3-4: Foundation
□ Next.js project setup + TypeScript
□ Authentication (email + Google login)
□ Database schema design
□ Basic UI components (design system)
□ Mobile-responsive layout

Week 5-6: Core Trade Data
□ Zerodha CSV import + parser
□ Groww CSV import + parser
□ Trade list display
□ Basic P&L calculation (gross)

Week 7-8: Analytics
□ Win rate calculation
□ Drawdown tracking
□ Profit giveback tracking
□ India tax calculations (STT, SEBI, GST, Stamp Duty)
□ Basic charts (Recharts)

Week 9-10: Journal Features
□ Notes and tags per trade
□ Chart screenshot upload
□ Emotion/psychology tagging
□ Basic dashboard

Launch MVP → Show to 50 beta users → Get feedback
```

---

## Phase 2: Core Features (Week 11–18)

```
Week 11-12: AI Integration
□ Monthly AI trade coaching report
□ Pattern detection on trade data
□ Trading DNA report generation

Week 13-14: More Brokers + Payments
□ Dhan, Upstox, Angel One, Fyers CSV parsers
□ Razorpay subscription integration
□ Free / Starter / Pro plans enforcement

Week 15-16: Engagement Features
□ Tiltmeter (behavioral detection)
□ Daily post-market ritual prompts
□ Milestones + streak system
□ Daily P&L summary (email)

Week 17-18: Mobile
□ React Native (Expo) app setup
□ Login + dashboard on mobile
□ Basic trade list on mobile
□ Push notifications

Beta launch → 500 users → Start charging
```

---

## Phase 3: Differentiation (Week 19–30)

```
Week 19-20: WhatsApp Bot
□ Twilio/Interakt WhatsApp Business API setup
□ Message parser (NLP)
□ Create trade from WhatsApp message
□ Reply with confirmation + P&L

Week 21-22: Auto-Sync
□ Zerodha Kite Connect OAuth integration
□ Automatic hourly trade sync
□ Upstox API integration

Week 23-24: Advanced Analytics
□ F&O expiry day heatmap
□ Time-of-day heatmap
□ MFE/MAE exit quality analysis
□ Pre-market check-in feature
□ Voice memo recording + transcription

Week 25-26: Tax & Compliance
□ ITR-compatible tax export
□ CA sharing portal
□ SEBI compliance checker
□ "Electricity bill" style report

Week 27-28: Community
□ Anonymous performance benchmarking
□ Mentor access feature
□ Trade sharing (with privacy controls)

Week 29-30: Hindi & Regional
□ Hindi language UI translation
□ Hindi AI reports

Scale launch → 5,000 users → ₹20L+ MRR target
```

---

## Phase 4: Market Leadership (Month 8–12)

```
□ Paper trading simulator (historical NSE data)
□ Market replay feature
□ Native iOS app (App Store)
□ Native Android app (Play Store)
□ More broker API syncs (Dhan, Fyers, Angel One)
□ Trading course / content integration
□ Referral program
□ Team accounts (for proprietary trading firms)
□ Tamil, Telugu, Gujarati language support
```

---

# 👥 Team Requirements

## Minimum viable team to build MVP:

| Role | What they do | Monthly cost (India) |
|------|-------------|---------------------|
| **Full-Stack Developer (1)** | Everything — frontend + backend + database | ₹80,000–₹1,50,000 |
| **UI/UX Designer (Part-time)** | Figma designs, user flows | ₹20,000–₹40,000 |
| **You (Founder)** | Product decisions, testing, users, marketing | — |

**Total:** ₹1,00,000–₹2,00,000/month for initial team

## As you grow (after 1,000 paying users):
- 2nd developer (mobile / backend specialist)
- Content writer (blog + SEO)
- Customer support (1 person)
- Data analyst

---

# 💰 Cost Breakdown

## Monthly Running Costs (at Launch):

| Expense | Cost/Month |
|---------|-----------|
| Vercel (hosting) | ₹1,600 ($20) |
| Railway (backend + DB) | ₹2,400 ($30) |
| OpenAI API (AI reports) | ₹5,000 (depends on users) |
| Interakt (WhatsApp) | ₹999 |
| Fast2SMS (OTP) | ₹500 |
| Domain (.in + .com) | ₹150 |
| Kite Connect (Zerodha API) | ₹2,000 |
| **Total** | **~₹12,650/month** |

## Break-even:
- At ₹399/month avg subscription
- Need only **32 paying users** to cover all infrastructure costs
- Very achievable in month 1-2

## Profitability target:
- 100 users × ₹399 = ₹39,900 MRR → Profitable from month 3
- 1,000 users × ₹399 = ₹3,99,000 MRR → ₹3L+ net profit/month
- 10,000 users × ₹399 = ₹39,90,000 MRR → ₹35L+ net profit/month

---

# ❓ Open Questions for You (Founder)

Before a developer starts writing code, you need to decide:

```
1. BRAND NAME: 
   Artha Journal / Drishti / Maya / something else?

2. LEGAL STRUCTURE:
   Have you registered a Private Limited Company?
   (Required for Razorpay + broker API agreements)

3. BUDGET:
   What is your initial runway budget?
   (Minimum ₹5–10L recommended for first 6 months)

4. DEVELOPER:
   Do you have a developer in mind?
   Or do you need help finding one?

5. MVP SCOPE:
   Do you want to start with ONLY Zerodha import first?
   (Recommended: yes — focus beats breadth at start)

6. LAUNCH AUDIENCE:
   Do you have access to a trader community?
   (Twitter/X trading community, Zerodha TradingQ&A, Telegram groups)

7. COMPETITIVE INTELLIGENCE:
   Have you personally used Nexus Journal, TradesViz, OneTradeJournal?
   (You should use all of them before building — know what you're competing with)

8. AI PROVIDER:
   OpenAI (GPT-4o) or Google Gemini?
   (OpenAI = better quality, Gemini = cheaper + Google India presence)

9. WHATSAPP PRIORITY:
   Is WhatsApp bot a Day 1 feature or Phase 2?
   (Recommendation: Phase 2 — get core journal right first)

10. HINDI UI PRIORITY:
    When do you want Hindi language support?
    (Recommendation: Month 6 — after English version is stable)
```

---

# 📚 Learning Resources for You

If you want to understand the tech more deeply:

| Topic | Where to learn |
|-------|---------------|
| Next.js basics | nextjs.org/learn (free, official) |
| How databases work | Fireship.io on YouTube |
| REST APIs explained | Fireship "REST API" video (7 mins) |
| WhatsApp Business API | developers.facebook.com/docs/whatsapp |
| Zerodha Kite Connect | kite.trade/docs |
| Razorpay integration | razorpay.com/docs |
| How to hire developers | Toptal / Internshala / LinkedIn / IIT job boards |

---

# ✅ Summary — Everything in One View

```
FRONTEND:     Next.js 15 + TypeScript + Tailwind CSS + Shadcn
MOBILE:       React Native (Expo)
BACKEND:      Node.js + Express/Fastify + TypeScript
DATABASE:     PostgreSQL (primary) + Redis (cache)
AI:           OpenAI GPT-4o (reports) + Gemini (fallback)
WHATSAPP:     Interakt / Twilio WhatsApp Business API
BROKER APIs:  Kite Connect + Upstox + Dhan + Angel + Fyers
OTP/SMS:      Fast2SMS (India)
PAYMENTS:     Razorpay (UPI + Cards + Net Banking)
FILE STORAGE: Cloudflare R2
HOSTING:      Vercel (frontend) + Railway (backend)
AUTH:         NextAuth + JWT + Google OAuth
SECURITY:     AES-256 encryption + HTTPS everywhere

MVP Timeline: 10 weeks
Full Product:  6–8 months
Team at Start: 1 developer + you
Initial Cost:  ₹1.2L/month (dev + infra)
Break-even:    32 paying users
Target Year 1: 2,000 users = ₹8L MRR
```

---

*Document 4 of 4 complete.*
*All 4 documents together form your complete business + product + tech blueprint.*

---

## 📁 Your Complete Document Set:
- **Doc 1:** `01_nexus_features_explained.md` — Nexus Journal, every feature in baby language
- **Doc 2:** `02_international_giants_explained.md` — TraderSync, Edgewonk, Tradervue, Chartlog
- **Doc 3:** `03_product_blueprint.md` — What to build (features, originals, comparison table)
- **Doc 4:** `04_technical_build_plan.md` — Stack, architecture, roadmap, costs, team
