# FoxTrade Desktop — Local SQLite Database Architecture & Migration Plan
**Document Version:** 1.0.0  
**Status:** PHASE 1 & PHASE 2 COMPLETED • PENDING USER APPROVAL FOR PHASE 3 IMPLEMENTATION  
**Target Engine:** SQLite (`better-sqlite3`) via Electron Main Process + Context-Isolated IPC  
**Compatibility:** 100% Offline-First, Multi-Portfolio, Web-Safe (Web fallback preserved)  

---

## Executive Summary

FoxTrade was originally architected as a client-side web application relying on a hybrid of **IndexedDB (`foxtrade_v2`, `foxtrade_db`, `foxy_config_db`)**, over **70 volatile `localStorage` keys**, and **Google Drive / Firebase Firestore** sync stubs. 

While the mathematical engine in [`src/utils/foxCalculationEngine.js`](file:///d:/ASSSSS/newsamsung/foxtrade/src/utils/foxCalculationEngine.js) and [`src/utils/pnlEngine.js`](file:///d:/ASSSSS/newsamsung/foxtrade/src/utils/pnlEngine.js) implements institutional Nexus trading formulas (LIFO/FIFO lot-matching, paise integer arithmetic, dynamic open heat, and R-multiple expectancy), the **persistence architecture suffers from structural flaws**:
1. Trades are stored with **up to 10 flattened entry/exit leg columns** (`p1Price`..`p5Price`, `e1Price`..`e5Price`) and **pre-baked derived metrics** (`avgEntry`, `pl`, `rewardRisk`, `holdingDays`, `capitalAtRisk`) rather than a normalized trades & executions relational model.
2. In-memory arrays of hundreds of trades are serialized into single JSON blobs in `localStorage` and IndexedDB, risking the 5MB browser quota and silent write failures.
3. Chart screenshots are stored as large Base64 WebP/PNG strings directly inside trade records or IndexedDB Blobs, threatening storage limits.
4. Primary queries across the Dashboard, Analytics, Deep Analytics, and Symbol Deep Dive force full client-side memory scans and manual array filtering (`trades.filter(...)`), due to lack of relational SQL indexing.

This document presents the **complete empirical analysis (Phase 1)** and the **battle-tested SQLite schema and IPC contract (Phase 2 & Phase 3)** designed specifically for FoxTrade desktop.

---

# PHASE 1: Codebase Analysis Findings (Read-Only)

### 1. Complete Inventory of Current Data Storage & Sync Locations

#### A. IndexedDB Databases & Stores
1. **`foxtrade_v2` (Version 3)** — Current primary browser DB ([`src/db/foxtradeDB.js`](file:///d:/ASSSSS/newsamsung/foxtrade/src/db/foxtradeDB.js)):
   - `trades` (Key: `id` | Indexes: `portfolioId`, `updatedAt`, `[portfolioId, status]`, `[portfolioId, symbol]`): Flattened trade objects with CRDT metadata.
   - `operations_queue` (Key: `qid` autoIncrement | Indexes: `status`, `portfolioId`, `createdAt`, `[status, portfolioId]`): Offline write queue intended for Google Drive sync.
   - `sync_cursors` (Key: `portfolioId`): Tracks last Google Drive revision cursor.
   - `chart_images` (Key: `id` | Indexes: `tradeId`, `portfolioId`, `syncedToDrive`): Binary image blobs.
   - `app_config` (Key: `key`): JSON key-value store for device ID, portfolio list, notes, and Foxy AI keys/chats.
   - `monthly_perf` (Key: `pid_year_month` | Index: `portfolioId`): Monthly performance ledger per portfolio/year.
   - `ohlc_cache` (Key: `symbolTimeframe` | Index: `expiresAt`): Candlestick price cache with TTL purge.
2. **`foxtrade_db` (Version 1)** — Legacy DB ([`src/services/indexedDBService.js`](file:///d:/ASSSSS/newsamsung/foxtrade/src/services/indexedDBService.js)):
   - `trades` (Key: `uid`): Stored user trades as a single array blob `{ uid, trades: [...] }`.
   - `settings` (Key: `key`): General app settings.
   - `portfolios` (Key: `uid`): Array of portfolios.
3. **`foxy_config_db` (Version 1)** — Isolated DB ([`src/utils/traderDNA.js`](file:///d:/ASSSSS/newsamsung/foxtrade/src/utils/traderDNA.js)):
   - `foxy_config` (Key: `key`): Stores `trader_dna_v1` profile cache.

#### B. LocalStorage Keys (70+ Active Keys)
- **Trade Caches & Tombstones:** `tradeontip_trades_v5_${uid}_${pid}`, `tradeontip_trades_v5_${pid}`, `tradeontip_trades_v5`, `tradeontip_trades_cache`, `tradeontip_trades_cache_${uid}`, `tradeontip_cleared_${pid}`.
- **Portfolios & Capital:** `tradeontip_portfolios`, `foxtrade_portfolios`, `tradeontip_active_portfolio_id`, `foxtrade_active_portfolio`, `tradeontip_base_capital_${pid}`, `tradeontip_base_capital`.
- **Fund Management Ledger:** `tradeontip_monthly_capital_${pid}_${year}`, `tradeontip_ledger_entries_${pid}_${year}`, `tradeontip_migr_ledger_dates_v1`.
- **Playbook Engine:** `foxtrade_playbooks_v2`, `foxtrade_trade_audits_v2`, `foxtrade_missed_trades_v2`, `foxtrade_playbook_settings_v1`, `foxtrade_playbook_sidebar_collapsed`.
- **Notes Hub:** `foxtrade_notes_v2` (calendar daily notes dictionary), `foxtrade_independent_notes_v2`, `tradeontip_quick_notes`, `foxtrade_notes_calmode`, `foxtrade_notes_viewmode`, `foxtrade_notes_indmode`.
- **Tax Analytics:** `foxtrade_auto_taxes_enabled`, `foxtrade_monthly_taxes_${year}`, `foxtrade_monthly_taxes_detailed_${year}`.
- **UI State & Layout:** `tradeontip_theme`, `tradeontip_settings`, `tradeontip_visible_cols_v5`, `tradeontip_col_order_v5`, `foxtrade_analytics_visible_sections`, `tradeontip_notif_muted`, `tradeontip_drawings_${symbol}`.
- **Auth & Cloud Tokens:** `tradeontip_user`, `tradeontip_token`, `tradeontip_token_expiry`, `tradeontip_gdrive_token`, `tradeontip_drive_status`.

#### C. Remote Services & Cloud Sync: 100% Privacy Mandate
- **Firebase Firestore Elimination:** The user has explicitly mandated that **Firebase Firestore is NOT needed**. As a privacy-first trading journal, **zero trade data may ever touch third-party or shared cloud databases**. All existing Firestore references in [`src/Dashboard.jsx`](file:///d:/ASSSSS/newsamsung/foxtrade/src/Dashboard.jsx) (`journals/{uid}`), [`src/services/playbookService.js`](file:///d:/ASSSSS/newsamsung/foxtrade/src/services/playbookService.js), [`src/components/Pages/TaxAnalyticsPage.jsx`](file:///d:/ASSSSS/newsamsung/foxtrade/src/components/Pages/TaxAnalyticsPage.jsx), and [`src/db/tokenManager.js`](file:///d:/ASSSSS/newsamsung/foxtrade/src/db/tokenManager.js) will be completely removed/bypassed. Firebase Auth remains strictly for user identity authentication if needed, with zero Firestore database interaction.
- **Google Drive Personal Cloud Sync:** Google Drive OAuth sync via [`src/db/syncEngine.js`](file:///d:/ASSSSS/newsamsung/foxtrade/src/db/syncEngine.js) is the **sole authorized cloud backup and cross-device sync mechanism**. Data is saved exclusively into the user's personal Google Drive folder (`FoxTrade Backups/foxtrade-journal-{portfolioId}.json.gz` and `FoxTrade Backups/charts/`). The developer, FoxTrade servers, and third parties have zero access to the user's trading records.
- **Offline-First SQLite + Google Drive Architecture:** In the Electron desktop app, SQLite (`better-sqlite3`) serves as the local database engine. Sync snapshots are serialized directly between SQLite and the user's private Google Drive via the existing Last-Write-Wins (LWW) CRDT merge protocol.

---

### 2. Entity Documentation: Current Structure & Data Types

| Entity | Current Storage | Primary Fields & Types | Files Accessing Entity |
| :--- | :--- | :--- | :--- |
| **Trades** | IDB `foxtrade_v2.trades`, `localStorage.tradeontip_trades_v5` | `id` (str), `tradeNo` (int), `portfolioId` (str), `date` (str DD-MM-YYYY/ISO), `name`/`symbol` (str), `type`/`side` ('Buy'\|'Sell'), `entry` (float), `qty` (float), `sl` (float), `tsl` (float), `cmp` (float), `status` ('Open'\|'Partial'\|'Closed'), `p1Price`..`p5Price` (float), `p1Qty`..`p5Qty` (float), `p1Date`..`p5Date` (str), `p1Sl`..`p4Sl` (float), `e1Price`..`e5Price` (float), `e1Qty`..`e5Qty` (float), `e1Date`..`e5Date` (str), `avgEntry` (float), `avgExitPrice` (float), `openQty` (float), `exitedQty` (float), `pnl`/`pl`/`grossPnl`/`netPnl` (float), `rewardRisk` (float), `capitalAtRisk` (float), `holdingDays` (int), `pfImpact` (float), `broker` (str), `notes` (str), `setup` (str), `chartBefore` (str/base64), `chartAfter` (str/base64), `allExchangeTradeIds` (str[]), `version` (int), `createdAt` (int ms), `updatedAt` (int ms), `deletedAt` (int ms\|null) | `Dashboard.jsx`, `tradeStore.js`, `foxCalculationEngine.js`, `pnlEngine.js`, `tradeImportEngine.js`, `tradeDeduplicationEngine.js`, `AnalyticsPage.jsx`, `DeepAnalyticsPage.jsx`, `SymbolDeepDivePage.jsx` |
| **Executions / Fills** | Inlined inside Trade as `initial`, `p1`..`p5`, `e1`..`e5`; or transient broker arrays in CSV imports | `price` (float), `qty` (float), `date` (str), `time` (str), `sl` (float), `tradeId`/`orderId` (str) | `foxCalculationEngine.js`, `tradeImportEngine.js`, `brokerApiService.js`, `pnlEngine.js` |
| **Portfolios (Accounts)** | IDB `app_config.portfolios`, `localStorage.tradeontip_portfolios` | `id` (str, e.g. `'portfolio-default'`), `name` (str), `currency` (str `'INR'`), `baseCapital` (float), `createdAt` (int ms) | `PortfolioManagerModal.jsx`, `configStore.js`, `Dashboard.jsx`, `fundManagementCalculations.js` |
| **Fund Ledger (Capital Flows)** | `localStorage.tradeontip_ledger_entries_${pid}_${year}` | `id` (str `migr_...`), `portfolioId` (str), `type` ('deposit'\|'withdrawal'), `amount` (float), `date` (str YYYY-MM-DD), `dateApproximate` (bool), `note` (str) | `fundManagementCalculations.js`, `FundManagementPage.jsx`, `Dashboard.jsx` |
| **Playbook Setups** | `localStorage.foxtrade_playbooks_v2`, Firestore `journals/{uid}.playbooks` | `id` (str `pb-...`), `title` (str), `slug` (str), `strategyType` (str `'BREAKOUT'`), `applicableSegments` (str[]), `targetWinRate` (float), `targetRiskReward` (float), `icon` (str), `colorHex` (str), `description` (str), `isActive` (bool), `ruleGroups` (array of `{ id, title, rules: [{ id, text, isRequired }] }`), `notes` (array), `createdAt` (ISO), `updatedAt` (ISO) | `playbookService.js`, `PlaybookEngine.jsx`, `PlaybookOverviewTab.jsx`, `PlaybookRulesTab.jsx`, `SymbolDeepDivePage.jsx` |
| **Trade Rule Checks (Audits)** | `localStorage.foxtrade_trade_audits_v2`, Firestore `journals/{uid}.playbookTradeAudits` | Dictionary keyed by `tradeId`: `{ tradeId, playbookId, isNoSetup (bool), disciplineScore (int 0-100), ruleExecutions: { [ruleId]: { isFollowed (bool) } }, comment (str), auditedAt (ISO) }` | `playbookService.js`, `TradeAuditorModal.jsx`, `SymbolDeepDivePage.jsx`, `PlaybookExecutedTradesTab.jsx` |
| **Missed Trades** | `localStorage.foxtrade_missed_trades_v2`, Firestore `journals/{uid}.missedTrades` | `id` (str), `playbookId` (str), `symbol` (str), `segment` (str), `direction` (str), `date` (str), `entryPrice` (float), `exitPrice` (float), `theoreticalStop` (float), `theoreticalPnl` (float), `theoreticalRoi` (float), `theoreticalRMultiple` (float), `status` (str), `notes` (str), `createdAt` (ISO) | `playbookService.js`, `PlaybookMissedTradesTab.jsx` |
| **Calendar Daily Notes** | IDB `app_config.notes_v2`, `localStorage.foxtrade_notes_v2` | Dictionary keyed by `YYYY-MM-DD`: `{ title (str), content (str), mood (str), tags (str[]), scopedNotes (obj), createdAt (ISO), updatedAt (ISO) }` | `noteStore.js`, `NotesPage.jsx`, `Dashboard.jsx` |
| **Independent Notes** | IDB `app_config.independent_notes_v2`, `localStorage.foxtrade_independent_notes_v2` | `id` (str), `title` (str), `content` (str), `category` ('notes'\|'tasks'\|'resources'\|'goals'), `tags` (str[]), `priority` ('low'\|'medium'\|'high'), `status` ('todo'\|'in_progress'\|'done'), `progress` (int 0-100), `isPinned` (bool), `color` (str), `createdAt` (ISO), `updatedAt` (ISO) | `noteStore.js`, `NotesPage.jsx`, `PlaybookScratchpad.jsx` |
| **Monthly Tax Records** | `localStorage.foxtrade_monthly_taxes_${year}`, `localStorage.foxtrade_monthly_taxes_detailed_${year}` | Per month index (0-11): `tradeBased` (`stt`, `stampDuty`, `exchangeCharges`, `gst`, `sebiCharges`, `ipft`, `brokerage`), `ledgerBased` (`mtfCharges`, `marginInterest`, `dpCharges`, etc.), `totalTaxes` (float) | `taxAnalyticsCalculations.js`, `TaxAnalyticsPage.jsx`, `TaxInputDialog.jsx` |
| **Chart Screenshots** | IDB `foxtrade_v2.chart_images`, trade object properties `chartBefore`/`chartAfter` | `id` (str), `tradeId` (str), `portfolioId` (str), `imageType` ('beforeEntry'\|'afterExit'), `blob` (Blob object) or data URL string, `filename` (str), `sizeBytes` (int), `createdAt` (int ms) | `imageStore.js`, `UploadChartModal.jsx`, `ChartGalleryModal.jsx` |
| **Foxy AI Memory** | IDB `app_config.foxy_ai_chats`, `app_config.foxy_trader_commitments`, IDB `foxy_config_db.trader_dna_v1` | Chat threads (`id`, `title`, `messages: [{ role, content, timestamp }]`), Commitments (`string[]`), Trader DNA (`tradingStyle`, `winRate`, `expectancyR`, `revengeTradingScore`, `lossCuttingDiscipline`, etc.) | `foxyStore.js`, `traderDNA.js`, `tiltmeterService.js`, `FoxyAiPage.jsx` |

---

### 3. Diagnosis of Current Structural Problems

#### A. Derived Values Stored Instead of Dynamically Computed
In current trade objects, **18+ derived variables are saved as persistent record attributes**:
`avgEntry`, `avgExitPrice`, `openQty`, `exitedQty`, `status`, `positionSize`, `currentAllocation`, `peakAllocation`, `slPct`, `stockMove`, `realisedAmount`, `pl`, `pnl`, `grossPnl`, `netPnl`, `grossPaise`, `netPaise`, `unrealized`, `rewardRisk`, `capitalAtRisk`, `openHeat`, `riskAmount`, `profitProtected`, `profitRisk`, `holdingDays`, `pfImpact`, `mae`, `mfe`, `alpha`, `heat`.
- **The Bug:** If a user edits pyramid 2 (`p2Qty`) or deletes exit 1 (`e1Price`), the trade retains stale values for `avgEntry`, `pnl`, and `holdingDays` unless `enrichTradeWithFoxFormulas()` is executed across the entire collection.
- **The Fix:** Executions are the atomic ground truth. All metrics are computed dynamically via deterministic functions or indexed generated views.

#### B. Floating-Point Arithmetic Traps
- Real money values are mixed between raw IEEE-754 floats and integer paise. Calculations such as `814.66 * 100` produce `81465.99999999999` in JavaScript.
- Broker import parsers read decimal rupee strings and perform float subtractions (`exit - entry`) leading to fractional paise discrepancies.
- **The Fix:** In SQLite, all financial figures must be **strictly stored as `INTEGER` paise** (`₹100.50` = `10050`). Quantities are stored as `REAL`, and price conversion occurs at display boundary.

#### C. Duplicated, Inconsistent & Redundant Fields
- **Multi-Leg Flattening:** Storing entries as `p1Price`, `p1Qty`, `p1Date`, `p1Sl` up to `p5` and exits as `e1Price`, `e1Qty` up to `e5` limits scalability (cannot handle 6 pyramids or partial scaling scalpers) and forces null-checks across 30 column slots.
- **Date Chaos:** Three date formats coexist simultaneously: `DD-MM-YYYY` (Indian standard), `YYYY-MM-DD` (ISO date), and millisecond integers (`createdAt`).
- **Duplicate P&L Properties:** A single trade record carries `pnl`, `pl`, `grossPnl`, `netPnl`, `realisedAmount`, `grossPaise`, and `netPaise`.
- **Storage Mirroring Duplication:** `saveUserTrades()` writes the same trade array to 4 different storage targets on every save:
  1. IndexedDB `foxtrade_v2.trades`
  2. `localStorage.setItem('tradeontip_trades_v5_${uid}_${pid}')`
  3. `localStorage.setItem('tradeontip_trades_v5_${pid}')`
  4. `localStorage.setItem('tradeontip_trades_cache')`

#### D. Missing Foreign Keys, Timestamps & Soft Deletes
- Leg entries (`p1`, `e1`) have no unique identifier, preventing execution-level deduplication from broker contract notes.
- Playbook audits exist in a detached localStorage dictionary without foreign key constraints: deleting a trade leaves orphaned audits.
- Multiple entities lack `created_at`, `updated_at`, and `deleted_at` timestamps, preventing Last-Write-Wins (LWW) conflict resolution during cloud synchronization.

#### E. Missing Indexes & Query Bottlenecks
- IndexedDB only indexes `portfolioId` and `status`. Every date range query, symbol lookup, setup search, or win/loss calculation requires downloading all trades into RAM and running JavaScript array `.filter()`.
- On portfolios with 1,000+ trades, re-computing the equity curve or filtering by symbol freezes the React main thread.

#### F. High Risk of Data Loss
- `localStorage` is restricted to ~5MB per origin. When users paste chart snapshots (Base64 strings ~800KB each), the browser throws an unhandled `QuotaExceededError`, terminating writes.
- Browser cache evictions, privacy cleaners, or storage pressure can silently wipe IndexedDB and localStorage partitions.
- Lack of database transaction boundaries means a partial import error leaves corrupted, half-migrated data.

---

### 4. Real Access Patterns & Queries Run by the App

| UI Feature / Component | Query / Calculation Pattern | Data Dependencies | Required Indexing |
| :--- | :--- | :--- | :--- |
| **Header Stat Cards** ([`StatCards.jsx`](file:///d:/ASSSSS/newsamsung/foxtrade/src/components/StatCards.jsx)) | Aggregate count, open positions, gross realized P&L, unrealized P&L, capital at risk, profit protected, % invested, win rate | Active portfolio, non-deleted trades, status in (`Open`, `Partial`, `Closed`) | `(portfolio_id, deleted_at, status)` |
| **Journal Table & Filters** ([`JournalTable.jsx`](file:///d:/ASSSSS/newsamsung/foxtrade/src/components/JournalTable.jsx)) | Paginated, sorted list of trades filtered by: Date Range (`entryDate` between X and Y), Status, Instrument / Asset Class, Outcome (Win/Loss/BE), Direction (Long/Short), Search (Symbol / Tag) | Active portfolio, entry date DESC, symbol search | `(portfolio_id, entry_date DESC)`, `(portfolio_id, symbol)` |
| **Equity Curve & Drawdowns** ([`EquityCurve.jsx`](file:///d:/ASSSSS/newsamsung/foxtrade/src/components/charts/EquityCurve.jsx), [`drawdown.js`](file:///d:/ASSSSS/newsamsung/foxtrade/src/utils/drawdown.js)) | Chronological sequence of closed trade exit events + deposits/withdrawals to build running cumulative equity curve and peak-to-trough drawdown | Closed trades sorted by exit date ASC, fund ledger entries sorted by date ASC | `(portfolio_id, exit_date ASC) WHERE status = 'Closed'`, `(portfolio_id, transaction_date ASC)` |
| **Symbol Deep Dive** ([`SymbolDeepDivePage.jsx`](file:///d:/ASSSSS/newsamsung/foxtrade/src/components/Pages/SymbolDeepDivePage.jsx)) | Fetch all historical trades for a specific ticker (`symbol = ?`), calculate symbol-level win rate, total P&L, average holding period, and matched playbook rules | Active portfolio, symbol exact match, date ASC | `(portfolio_id, symbol, entry_date ASC)` |
| **Deep Analytics & Distributions** ([`DeepAnalyticsPage.jsx`](file:///d:/ASSSSS/newsamsung/foxtrade/src/components/Pages/DeepAnalyticsPage.jsx)) | Group-by queries: P&L and win rate by Day-of-Week, by Hour/Session, by Setup, by Duration buckets, Pareto distribution (top winners) | Closed trades, exit date, setup name, holding days | `(portfolio_id, setup_id)`, `(portfolio_id, exit_date)` |
| **Tax Analytics Hub** ([`TaxAnalyticsPage.jsx`](file:///d:/ASSSSS/newsamsung/foxtrade/src/components/Pages/TaxAnalyticsPage.jsx)) | Split trades by Financial Year (Apr 1 – Mar 31) and segment: Intraday (Speculative), F&O (Non-Speculative), Delivery <= 365d (STCG 111A), Delivery > 365d (LTCG 112A). Sum turnover & charges | Closed trades, exit date range, holding days, asset type | `(portfolio_id, exit_date, asset_type)` |
| **Fund Management & Ledger** ([`FundManagementPage.jsx`](file:///d:/ASSSSS/newsamsung/foxtrade/src/components/Pages/FundManagementPage.jsx)) | Sum deposits, sum withdrawals per month/year, compute monthly opening capital + trading P&L = closing capital | Portfolio ledger entries by date, monthly trade net P&L | `(portfolio_id, transaction_date ASC)` |
| **Playbook Performance Scoring** ([`PlaybookEngine.jsx`](file:///d:/ASSSSS/newsamsung/foxtrade/src/components/Playbook/PlaybookEngine.jsx)) | For each playbook: count tagged trades, win rate, profit factor, adherence score (% checklist rules followed), undisciplined bleed | Trades joined with `trade_rule_checks`, grouped by `playbook_id` | `(portfolio_id, playbook_id)`, `(trade_id)` on rule checks |
| **CSV / Broker Deduplication** ([`tradeDeduplicationEngine.js`](file:///d:/ASSSSS/newsamsung/foxtrade/src/utils/tradeDeduplicationEngine.js)) | Lookup existing trade by exchange order ID or trade signature (`symbol + date + type + entry + qty`) | Execution external ID or composite trade signature | `UNIQUE(external_id)`, `(portfolio_id, symbol, entry_date)` |

---

# PHASE 2: Production SQLite Schema Design

### Architectural Principles
1. **Engine:** `better-sqlite3` embedded in the Electron Main process with synchronous execution, WAL mode (`PRAGMA journal_mode = WAL`), foreign key constraints (`PRAGMA foreign_keys = ON`), and normal synchronous mode (`PRAGMA synchronous = NORMAL`).
2. **Storage Location:** SQLite database file located at `path.join(app.getPath('userData'), 'foxtrade.db')`.
3. **Paise-First Money:** Every monetary value (`price`, `pnl`, `capital`, `charges`, `turnover`) is stored as an integer number of paise (`1 Rupee = 100 Paise`). Floats are strictly prohibited for currency.
4. **Quantities:** Stored as `REAL` (supports fractional equity or crypto shares, integer lot multiples for F&O).
5. **Timestamps:** ISO-8601 UTC strings (`YYYY-MM-DDTHH:MM:SS.SSSZ`).
6. **Cloud-Ready Sync Mirrors:** Every table includes `id TEXT PRIMARY KEY` (UUIDv4), `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`, and `deleted_at TEXT` (soft delete for tombstone propagation). This directly mirrors Supabase PostgreSQL requirements.
7. **Screenshots on Disk:** Stored in `path.join(app.getPath('userData'), 'screenshots')`. The DB only stores the relative path, image type, and file metadata.
8. **Trades & Executions Split:** Every buy/sell fill is an individual row in `executions`. Trade-level fields (`avg_entry_price_paise`, `position_size_paise`, `gross_pnl_paise`, `net_pnl_paise`, `open_quantity`, `exited_quantity`, `status`) are maintained atomically via calculation engine transactions.

---

### The Complete SQLite Schema (`schema.sql`)

```sql
-- ============================================================================
-- FOXTRADE MASTER DATABASE SCHEMA (SQLite 3 / better-sqlite3)
-- Target: Electron Desktop Application
-- Schema Version: 1
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- ----------------------------------------------------------------------------
-- 1. PORTFOLIOS (Accounts / Workspaces)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portfolios (
    id TEXT PRIMARY KEY,                       -- UUIDv4
    name TEXT NOT NULL,                        -- e.g. 'Main Trading', 'Swing Portfolio'
    currency TEXT NOT NULL DEFAULT 'INR',      -- 'INR', 'USD'
    base_capital_paise INTEGER NOT NULL DEFAULT 0, -- Initial base capital in paise
    is_default INTEGER NOT NULL DEFAULT 0,     -- 1 if default portfolio
    display_order INTEGER NOT NULL DEFAULT 0,  -- Ordering in switcher UI
    created_at TEXT NOT NULL,                  -- ISO-8601 UTC
    updated_at TEXT NOT NULL,                  -- ISO-8601 UTC
    deleted_at TEXT                            -- NULL or ISO-8601 UTC soft-delete
);

CREATE INDEX IF NOT EXISTS idx_portfolios_active ON portfolios(deleted_at, display_order);

-- ----------------------------------------------------------------------------
-- 2. PLAYBOOK SETUPS (Trading Systems & Strategies)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS playbook_setups (
    id TEXT PRIMARY KEY,                       -- UUIDv4 or legacy slug (e.g. 'pb-sample')
    portfolio_id TEXT NOT NULL,                -- Scoped to portfolio or 'global'
    title TEXT NOT NULL,                       -- e.g. 'Opening Range Breakout'
    slug TEXT NOT NULL,                        -- e.g. 'orb-setup'
    strategy_type TEXT NOT NULL DEFAULT 'BREAKOUT', -- 'BREAKOUT', 'PULLBACK', 'REVERSAL', 'MOMENTUM', 'IMPULSE'
    applicable_segments TEXT NOT NULL DEFAULT '["EQUITY","FUTURES","OPTIONS"]', -- JSON string array
    target_win_rate REAL DEFAULT 65.0,         -- Target WR %
    target_risk_reward REAL DEFAULT 2.0,       -- Target R:R ratio
    icon TEXT DEFAULT 'BookOpen',              -- Lucide icon name
    color_hex TEXT DEFAULT '#3b82f6',          -- UI Badge Color Hex
    description TEXT,                          -- Setup description & thesis
    is_active INTEGER NOT NULL DEFAULT 1,      -- 1 = Active, 0 = Archived
    is_no_setup INTEGER NOT NULL DEFAULT 0,    -- 1 = Dedicated impulse / no-setup tracker
    created_at TEXT NOT NULL,                  -- ISO-8601 UTC
    updated_at TEXT NOT NULL,                  -- ISO-8601 UTC
    deleted_at TEXT,                           -- Soft-delete
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_playbooks_portfolio ON playbook_setups(portfolio_id, deleted_at, is_active);

-- ----------------------------------------------------------------------------
-- 3. PLAYBOOK SETUP RULES (Checklist Criteria per Setup)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS playbook_setup_rules (
    id TEXT PRIMARY KEY,                       -- UUIDv4
    setup_id TEXT NOT NULL,                    -- Foreign Key to playbook_setups
    group_title TEXT NOT NULL DEFAULT 'Entry Rules', -- 'Entry Rules', 'Exit Rules', 'Risk Rules'
    rule_text TEXT NOT NULL,                   -- e.g. 'Volume >= 20-day SMA on breakout'
    is_required INTEGER NOT NULL DEFAULT 1,    -- 1 = Mandatory, 0 = Optional guideline
    display_order INTEGER NOT NULL DEFAULT 0,  -- Sort order within group
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (setup_id) REFERENCES playbook_setups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rules_setup ON playbook_setup_rules(setup_id, deleted_at, display_order);

-- ----------------------------------------------------------------------------
-- 4. TRADES (Position Parent Record)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,                       -- UUIDv4
    trade_no INTEGER NOT NULL,                 -- Monotonic 1..N sequence per portfolio
    portfolio_id TEXT NOT NULL,                -- Portfolio Workspace
    symbol TEXT NOT NULL,                      -- Canonical Ticker (e.g. 'RELIANCE', 'NIFTY26OCTFUT')
    company_name TEXT,                         -- Full scrip title
    asset_class TEXT NOT NULL DEFAULT 'EQUITY',-- 'EQUITY', 'FUTURES', 'OPTIONS', 'COMMODITY', 'CURRENCY'
    direction TEXT NOT NULL DEFAULT 'LONG',    -- 'LONG' (Buy first) or 'SHORT' (Sell first)
    status TEXT NOT NULL DEFAULT 'OPEN',       -- 'OPEN', 'PARTIAL', 'CLOSED'
    entry_type TEXT DEFAULT 'Market',          -- 'Market', 'Limit', 'Stop', 'Breakout'
    setup_id TEXT,                             -- Foreign Key to playbook_setups
    setup_name TEXT,                           -- Denormalized setup title for instant display
    broker TEXT DEFAULT 'not_defined',         -- Canonical broker identifier ('zerodha', 'dhan', etc.)
    entry_date TEXT NOT NULL,                  -- Earliest execution date (YYYY-MM-DD)
    entry_time TEXT DEFAULT '09:15:00',        -- Initial execution time (HH:MM:SS)
    exit_date TEXT,                            -- Final execution date (YYYY-MM-DD or NULL)
    exit_time TEXT,                            -- Final execution time
    initial_stop_loss_paise INTEGER,           -- Initial Stop Loss in paise
    trailing_stop_loss_paise INTEGER,          -- Current Trailing Stop Loss (TSL) in paise
    target_price_paise INTEGER,                -- Planned Profit Target in paise
    
    -- Cached / Materialized Computed Metrics (Maintained by Nexus Engine on Execution Write)
    total_entered_quantity REAL NOT NULL DEFAULT 0,
    open_quantity REAL NOT NULL DEFAULT 0,
    exited_quantity REAL NOT NULL DEFAULT 0,
    avg_entry_price_paise INTEGER NOT NULL DEFAULT 0,
    avg_exit_price_paise INTEGER DEFAULT 0,
    position_size_paise INTEGER NOT NULL DEFAULT 0, -- Total cost basis deployed in paise
    realised_amount_paise INTEGER NOT NULL DEFAULT 0, -- Total gross exit proceeds in paise
    gross_pnl_paise INTEGER NOT NULL DEFAULT 0,      -- Realized gross profit/loss in paise
    total_charges_paise INTEGER NOT NULL DEFAULT 0,  -- Statutory brokerage + taxes in paise
    net_pnl_paise INTEGER NOT NULL DEFAULT 0,        -- Realized net profit/loss in paise
    reward_risk REAL,                                -- Realized R-Multiple (Gain / Total Initial Risk)
    holding_days INTEGER DEFAULT 0,                  -- Lot-weighted calendar duration
    stock_move_pct REAL DEFAULT 0.0,                 -- Weighted price movement %
    capital_at_risk_pct REAL DEFAULT 0.0,            -- Open Heat % of account capital
    risk_amount_paise INTEGER DEFAULT 0,             -- Rupee amount at risk if stopped out
    profit_protected_paise INTEGER DEFAULT 0,        -- Profit locked in by TSL in paise
    pf_impact_pct REAL DEFAULT 0.0,                  -- Realized P&L as % of base portfolio capital
    mae REAL,                                        -- Maximum Adverse Excursion %
    mfe REAL,                                        -- Maximum Favorable Excursion %
    
    -- Qualitative & Journal Details
    plan_followed INTEGER DEFAULT 1,                 -- 1 = Yes, 0 = No
    exit_trigger TEXT,                               -- Reason for exit ('TARGET', 'STOP_LOSS', 'TRAILING_SL', 'MANUAL')
    notes TEXT,                                      -- Detailed trade narrative / post-mortem
    is_flagged INTEGER DEFAULT 0,                    -- 1 if flagged for audit review
    validation_flags TEXT,                           -- JSON array of flags (e.g. '["EXIT_BEFORE_ENTRY"]')
    
    created_at TEXT NOT NULL,                        -- ISO-8601 UTC
    updated_at TEXT NOT NULL,                        -- ISO-8601 UTC
    deleted_at TEXT,                                 -- Soft-delete
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE,
    FOREIGN KEY (setup_id) REFERENCES playbook_setups(id) ON DELETE SET NULL
);

-- Strategic Indexes Matching Real Dashboard & Analytics Queries
CREATE INDEX IF NOT EXISTS idx_trades_portfolio_entry ON trades(portfolio_id, deleted_at, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_trades_portfolio_exit ON trades(portfolio_id, deleted_at, exit_date ASC);
CREATE INDEX IF NOT EXISTS idx_trades_portfolio_status ON trades(portfolio_id, deleted_at, status);
CREATE INDEX IF NOT EXISTS idx_trades_portfolio_symbol ON trades(portfolio_id, deleted_at, symbol);
CREATE INDEX IF NOT EXISTS idx_trades_portfolio_setup ON trades(portfolio_id, deleted_at, setup_id);
CREATE INDEX IF NOT EXISTS idx_trades_sequence ON trades(portfolio_id, trade_no ASC);

-- ----------------------------------------------------------------------------
-- 5. EXECUTIONS (Atomic Buy / Sell Fills — Normalizes P1-P5 & E1-E5)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY,                       -- UUIDv4
    trade_id TEXT NOT NULL,                    -- Foreign Key to parent trade
    portfolio_id TEXT NOT NULL,                -- Portfolio workspace
    execution_type TEXT NOT NULL,              -- 'ENTRY' (Initial or Pyramid) or 'EXIT' (Scale or Close)
    leg_index INTEGER NOT NULL DEFAULT 0,      -- 0 for Initial Entry, 1..5 for P1..P5, 1..5 for E1..E5
    side TEXT NOT NULL,                        -- 'BUY' or 'SELL'
    quantity REAL NOT NULL,                    -- Quantity traded (shares or lots)
    price_paise INTEGER NOT NULL,              -- Execution price per share in paise
    execution_date TEXT NOT NULL,              -- Execution date (YYYY-MM-DD)
    execution_time TEXT NOT NULL DEFAULT '09:15:00', -- Execution timestamp (HH:MM:SS)
    stop_loss_paise INTEGER,                   -- Leg-specific stop loss in paise (for pyramids)
    
    -- Import & Broker Tracking for 100% Deduplication Defense
    external_id TEXT UNIQUE,                   -- Composite broker exchange trade ID
    broker_order_id TEXT,                      -- Exchange or Broker Order ID
    broker_trade_id TEXT,                      -- Exchange Trade ID (e.g. NSE trade number)
    source TEXT DEFAULT 'MANUAL',              -- 'MANUAL', 'CSV_IMPORT', 'BROKER_SYNC'
    
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE,
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_executions_trade ON executions(trade_id, deleted_at, execution_date ASC, execution_time ASC);
CREATE INDEX IF NOT EXISTS idx_executions_ext_id ON executions(external_id);
CREATE INDEX IF NOT EXISTS idx_executions_date ON executions(portfolio_id, execution_date);

-- ----------------------------------------------------------------------------
-- 6. TRADE RULE CHECKS (Playbook Audits Overlay)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_rule_checks (
    id TEXT PRIMARY KEY,                       -- UUIDv4
    trade_id TEXT NOT NULL,                    -- Foreign Key to trades
    setup_id TEXT NOT NULL,                    -- Foreign Key to playbook_setups
    rule_id TEXT NOT NULL,                     -- Foreign Key to playbook_setup_rules
    is_followed INTEGER NOT NULL DEFAULT 1,    -- 1 = Followed, 0 = Broken
    notes TEXT,                                -- Specific breach note
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    UNIQUE(trade_id, rule_id),
    FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE,
    FOREIGN KEY (setup_id) REFERENCES playbook_setups(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES playbook_setup_rules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checks_trade ON trade_rule_checks(trade_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_checks_rule ON trade_rule_checks(rule_id, is_followed);

-- ----------------------------------------------------------------------------
-- 7. TRADE AUDIT SUMMARIES (Discipline Scoring per Trade)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_audits (
    trade_id TEXT PRIMARY KEY,                 -- 1-to-1 with trades
    setup_id TEXT,                             -- Audited Setup ID (or NULL if impulse)
    is_no_setup INTEGER NOT NULL DEFAULT 0,    -- 1 if marked as impulse trade
    discipline_score INTEGER NOT NULL DEFAULT 100, -- 0 to 100 percentage
    total_rules_checked INTEGER NOT NULL DEFAULT 0,
    rules_followed_count INTEGER NOT NULL DEFAULT 0,
    comment TEXT,                              -- Trader's audit post-mortem
    audited_at TEXT NOT NULL,                  -- ISO-8601 UTC
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE,
    FOREIGN KEY (setup_id) REFERENCES playbook_setups(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 8. TRADE TAGS (Additive Tagging Overlay)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,                       -- UUIDv4
    name TEXT NOT NULL UNIQUE,                 -- e.g. 'Earnings Winner', 'FOMO', 'Gap Up'
    color_hex TEXT DEFAULT '#6b7280',          -- Tag UI color
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trade_tags (
    trade_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (trade_id, tag_id),
    FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 9. TRADE SCREENSHOTS (Files on Disk, Paths in DB)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_screenshots (
    id TEXT PRIMARY KEY,                       -- UUIDv4
    trade_id TEXT NOT NULL,                    -- Foreign Key to trades
    image_type TEXT NOT NULL,                  -- 'BEFORE_ENTRY', 'AFTER_EXIT', 'DURING'
    file_path TEXT NOT NULL,                   -- Relative path on disk: 'screenshots/{tradeId}-{type}.webp'
    file_name TEXT NOT NULL,                   -- Original or generated filename
    file_size_bytes INTEGER NOT NULL,          -- Size on disk
    mime_type TEXT NOT NULL DEFAULT 'image/webp',
    width INTEGER,
    height INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_screenshots_trade ON trade_screenshots(trade_id, deleted_at);

-- ----------------------------------------------------------------------------
-- 10. FUND TRANSACTIONS (Capital Additions, Withdrawals & Base Adjustments)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fund_transactions (
    id TEXT PRIMARY KEY,                       -- UUIDv4
    portfolio_id TEXT NOT NULL,                -- Portfolio workspace
    transaction_type TEXT NOT NULL,            -- 'DEPOSIT', 'WITHDRAWAL', 'BASE_ADJUSTMENT'
    amount_paise INTEGER NOT NULL,             -- Transaction amount in paise (positive integer)
    transaction_date TEXT NOT NULL,            -- YYYY-MM-DD
    is_approximate_date INTEGER NOT NULL DEFAULT 0, -- 1 if migrated from monthly aggregate
    note TEXT,                                 -- Reason / Note
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_funds_portfolio_date ON fund_transactions(portfolio_id, deleted_at, transaction_date ASC);

-- ----------------------------------------------------------------------------
-- 11. MONTHLY TAX RECORDS & OVERRIDES (Statutory Taxes & Ledger Charges)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_tax_records (
    id TEXT PRIMARY KEY,                       -- UUIDv4 (e.g. 'tax-{portfolioId}-{year}-{month}')
    portfolio_id TEXT NOT NULL,
    year INTEGER NOT NULL,                     -- e.g. 2026
    month INTEGER NOT NULL,                    -- 1..12 (1 = Jan, 12 = Dec)
    
    -- Trade-based statutory charges in paise
    stt_paise INTEGER DEFAULT 0,
    stamp_duty_paise INTEGER DEFAULT 0,
    exchange_charges_paise INTEGER DEFAULT 0,
    gst_paise INTEGER DEFAULT 0,
    sebi_charges_paise INTEGER DEFAULT 0,
    ipft_paise INTEGER DEFAULT 0,
    brokerage_paise INTEGER DEFAULT 0,
    other_trade_charges_paise INTEGER DEFAULT 0,
    
    -- Ledger-based recurring charges in paise
    mtf_charges_paise INTEGER DEFAULT 0,
    mtf_interest_paise INTEGER DEFAULT 0,
    margin_interest_paise INTEGER DEFAULT 0,
    dp_charges_paise INTEGER DEFAULT 0,
    amc_maintenance_paise INTEGER DEFAULT 0,
    ddpi_charges_paise INTEGER DEFAULT 0,
    delayed_payment_paise INTEGER DEFAULT 0,
    auto_square_off_paise INTEGER DEFAULT 0,
    
    total_taxes_paise INTEGER NOT NULL DEFAULT 0,
    is_manual_override INTEGER NOT NULL DEFAULT 0, -- 1 if manually entered via TaxInputDialog
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    UNIQUE(portfolio_id, year, month),
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 12. NOTES (Calendar Daily Notes & Independent Productivity Notes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,                       -- UUIDv4 or date string 'YYYY-MM-DD'
    portfolio_id TEXT NOT NULL,
    note_type TEXT NOT NULL,                   -- 'CALENDAR_DAY' or 'INDEPENDENT'
    date_str TEXT,                             -- 'YYYY-MM-DD' for calendar notes
    title TEXT,
    content TEXT NOT NULL DEFAULT '',
    mood TEXT,                                 -- 'bullish', 'neutral', 'cautious', 'frustrated'
    category TEXT DEFAULT 'notes',             -- 'notes', 'tasks', 'resources', 'goals'
    priority TEXT DEFAULT 'medium',            -- 'low', 'medium', 'high'
    status TEXT DEFAULT 'todo',                -- 'todo', 'in_progress', 'done'
    progress INTEGER DEFAULT 0,                -- 0..100
    is_pinned INTEGER DEFAULT 0,
    color TEXT,
    tags TEXT DEFAULT '[]',                    -- JSON string array
    scoped_notes TEXT,                         -- JSON object for ticker-scoped sub-notes
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notes_calendar ON notes(portfolio_id, note_type, date_str);
CREATE INDEX IF NOT EXISTS idx_notes_independent ON notes(portfolio_id, note_type, category, deleted_at);

-- ----------------------------------------------------------------------------
-- 13. APP SETTINGS & KEY-VALUE CONFIG
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,                      -- e.g. 'theme', 'visible_columns', 'active_portfolio_id'
    value TEXT NOT NULL,                       -- JSON string or scalar
    updated_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 14. SCHEMA MIGRATION LEDGER
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,               -- e.g. 1, 2, 3
    name TEXT NOT NULL,                        -- e.g. '001_initial_schema'
    applied_at TEXT NOT NULL
);
```

---

# PHASE 3: Implementation Deliverables

### 1. Storage Mapping: Old Storage → New Schema

| Old Storage Location & Key | Old Shape / Type | New SQLite Table | New SQLite Column(s) | Transformation / Conversion Logic |
| :--- | :--- | :--- | :--- | :--- |
| `IDB: foxtrade_v2.trades` / `LS: tradeontip_trades_v5` | Flat trade object with `p1..p5`, `e1..e5` | `trades` | Parent position columns (`id`, `trade_no`, `symbol`, `status`, `notes`) | Extracted as parent trade; ID normalized to UUID. |
| Initial Entry (`trade.entry`, `trade.qty`, `trade.date`, `trade.time`) | Flat fields on trade | `executions` | Row: `execution_type='ENTRY'`, `leg_index=0`, `side='BUY'`, `price_paise=toPaise(entry)`, `quantity=qty` | Converted to first execution row in `executions`. |
| Pyramids (`trade.p1Price`, `trade.p1Qty`, `trade.p1Date`, `trade.p1Sl`..`p5`) | Flat fields on trade | `executions` | Rows: `execution_type='ENTRY'`, `leg_index=1..5`, `price_paise=toPaise(pPrice)`, `quantity=pQty` | Split into discrete `executions` rows linked by `trade_id`. |
| Exits (`trade.e1Price`, `trade.e1Qty`, `trade.e1Date`..`e5`) | Flat fields on trade | `executions` | Rows: `execution_type='EXIT'`, `leg_index=1..5`, `side='SELL'`, `price_paise=toPaise(ePrice)`, `quantity=eQty` | Split into discrete `executions` rows linked by `trade_id`. |
| Exchange IDs (`trade.allExchangeTradeIds`) | Array of strings | `executions.external_id` / `broker_trade_id` | Stored on matching execution leg | Preserves broker audit trail and guarantees import deduplication. |
| `LS: foxtrade_playbooks_v2` / Firestore | Array of playbook objects with nested `ruleGroups` | `playbook_setups` + `playbook_setup_rules` | Normalised into setups table and child rules table | Flattened `ruleGroups.rules` into relational child rows. |
| `LS: foxtrade_trade_audits_v2` | Object map `{ [tradeId]: { disciplineScore, ruleExecutions, comment } }` | `trade_audits` + `trade_rule_checks` | `trade_audits` (score, comment) + `trade_rule_checks` (one row per checked rule) | Keyed by `(trade_id, rule_id)` with `is_followed` flag. |
| `LS: tradeontip_ledger_entries_${pid}_${year}` | Array of `{ id, type, amount, date, note }` | `fund_transactions` | `id`, `portfolio_id`, `transaction_type`, `amount_paise`, `transaction_date`, `note` | Amount converted via `toPaise(amount)`. |
| `IDB: foxtrade_v2.chart_images` / Base64 on trade | Binary Blob in IDB or Base64 data URL string | Files on Disk + `trade_screenshots` | File written to `screenshots/{tradeId}-{type}.webp`, DB stores `file_path`, `size_bytes` | Blobs/Base64 extracted and saved to disk. |
| `IDB: app_config.notes_v2` / `LS: foxtrade_notes_v2` | Object map `{ [YYYY-MM-DD]: { title, content, mood, tags } }` | `notes` | Row: `note_type='CALENDAR_DAY'`, `date_str=YYYY-MM-DD`, `content`, `mood`, `tags` | One row per calendar date. |
| `IDB: app_config.independent_notes_v2` | Array of note objects | `notes` | Row: `note_type='INDEPENDENT'`, `category`, `priority`, `status`, `progress` | Direct column-to-column mapping. |
| `LS: foxtrade_monthly_taxes_${year}` | Object map of months 0-11 with charge breakdowns | `monthly_tax_records` | `stt_paise`, `gst_paise`, `brokerage_paise`, `total_taxes_paise` | Rupee floats multiplied by 100 to integer paise. |
| `IDB: app_config.portfolios` | Array of portfolio objects | `portfolios` | `id`, `name`, `currency`, `base_capital_paise` | Base capital converted to paise. |

---

### 2. Data Migration Plan (Zero-Loss with Full Rollback)

#### Step 1: Pre-Migration Backup Snapshot
Before reading or converting any data, the migration runner writes a complete JSON file snapshot to disk:
`path.join(app.getPath('userData'), 'backups', 'pre_migration_backup_${Date.now()}.json')`.
This file contains the exact unadulterated contents of:
- All IndexedDB `foxtrade_v2` object stores (`trades`, `chart_images`, `app_config`, `monthly_perf`, `operations_queue`).
- All `localStorage` keys matching `tradeontip_*` and `foxtrade_*`.
- Legacy `foxtrade_db` (if present).

#### Step 2: Atomic SQLite Transaction Execution
The migration runner runs in the Electron Main process:
1. Opens `foxtrade.db` with `better-sqlite3`.
2. Verifies current `PRAGMA user_version`. If 0, applies `001_initial_schema.sql`.
3. Begins an exclusive transaction: `const tx = db.transaction(() => { ... })`.
4. Inserts portfolios, generating or preserving stable UUIDs.
5. Ingests playbook setups and child rules.
6. For every trade:
   - Inserts the parent `trades` row.
   - Extracts initial entry, pyramids P1..P5, and exits E1..E5 as rows into `executions`.
   - Computes canonical `avg_entry_price_paise`, `position_size_paise`, `gross_pnl_paise`, `net_pnl_paise`, `reward_risk`, and `holding_days` using the authoritative formulas in [`src/utils/foxCalculationEngine.js`](file:///d:/ASSSSS/newsamsung/foxtrade/src/utils/foxCalculationEngine.js).
   - Ingests audits into `trade_audits` and `trade_rule_checks`.
   - Extracts screenshots to disk in `userData/screenshots/` and creates records in `trade_screenshots`.
7. Ingests fund transactions, monthly taxes, and notes.
8. Sets `PRAGMA user_version = 1`.
9. Commits the transaction.

#### Step 3: Rollback Path
If any error occurs during the transaction:
1. SQLite automatically issues a complete `ROLLBACK`, leaving `foxtrade.db` untouched or clean.
2. The user's IndexedDB and `localStorage` are **never deleted or modified** during migration. They remain 100% intact as a read-only source of truth until the user explicitly confirms successful operation.
3. If the user chooses "Revert to Previous Version" in settings, the app can delete `foxtrade.db` and continue reading from IndexedDB/localStorage fallback.

---

### 3. Preload IPC API Contract (`preload.js` & `electronAPI`)

To maintain Electron security best practices (`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`), the renderer process interacts with SQLite strictly via typed IPC channels exposed in `preload.js`:

```javascript
// preload.js API Specification
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  // Database Management
  db: {
    // Trades & Executions
    getTrades: (portfolioId, filters) => ipcRenderer.invoke('db:trades:get', { portfolioId, filters }),
    getTradeById: (tradeId) => ipcRenderer.invoke('db:trades:getById', { tradeId }),
    saveTrade: (portfolioId, tradeData, executionsData) => ipcRenderer.invoke('db:trades:save', { portfolioId, tradeData, executionsData }),
    deleteTrade: (tradeId) => ipcRenderer.invoke('db:trades:delete', { tradeId }),
    bulkSaveTrades: (portfolioId, tradesList) => ipcRenderer.invoke('db:trades:bulkSave', { portfolioId, tradesList }),
    resequenceTradeNumbers: (portfolioId) => ipcRenderer.invoke('db:trades:resequence', { portfolioId }),

    // Analytics & Metrics Queries (Pre-Aggregated in SQLite for Instant Response)
    getDashboardMetrics: (portfolioId) => ipcRenderer.invoke('db:metrics:getDashboard', { portfolioId }),
    getEquityCurveData: (portfolioId) => ipcRenderer.invoke('db:metrics:getEquityCurve', { portfolioId }),
    getSymbolDeepDive: (portfolioId, symbol) => ipcRenderer.invoke('db:metrics:getSymbolDeepDive', { portfolioId, symbol }),
    getDeepAnalyticsData: (portfolioId, filters) => ipcRenderer.invoke('db:metrics:getDeepAnalytics', { portfolioId, filters }),

    // Portfolios
    getPortfolios: () => ipcRenderer.invoke('db:portfolios:getAll'),
    savePortfolio: (portfolio) => ipcRenderer.invoke('db:portfolios:save', { portfolio }),
    deletePortfolio: (portfolioId) => ipcRenderer.invoke('db:portfolios:delete', { portfolioId }),

    // Playbook Engine
    getPlaybooks: (portfolioId) => ipcRenderer.invoke('db:playbook:getAll', { portfolioId }),
    savePlaybook: (playbook) => ipcRenderer.invoke('db:playbook:save', { playbook }),
    deletePlaybook: (playbookId) => ipcRenderer.invoke('db:playbook:delete', { playbookId }),
    saveTradeAudit: (tradeId, auditData) => ipcRenderer.invoke('db:playbook:saveAudit', { tradeId, auditData }),
    getTradeAudit: (tradeId) => ipcRenderer.invoke('db:playbook:getAudit', { tradeId }),

    // Fund Transactions
    getFundTransactions: (portfolioId, year) => ipcRenderer.invoke('db:funds:get', { portfolioId, year }),
    saveFundTransaction: (transaction) => ipcRenderer.invoke('db:funds:save', { transaction }),
    deleteFundTransaction: (id) => ipcRenderer.invoke('db:funds:delete', { id }),

    // Taxes
    getMonthlyTaxRecords: (portfolioId, year) => ipcRenderer.invoke('db:tax:getYear', { portfolioId, year }),
    saveMonthlyTaxRecord: (taxRecord) => ipcRenderer.invoke('db:tax:save', { taxRecord }),

    // Notes
    getCalendarNotes: (portfolioId) => ipcRenderer.invoke('db:notes:getCalendar', { portfolioId }),
    saveDayNote: (portfolioId, dateStr, noteData) => ipcRenderer.invoke('db:notes:saveDay', { portfolioId, dateStr, noteData }),
    getIndependentNotes: (portfolioId) => ipcRenderer.invoke('db:notes:getIndependent', { portfolioId }),
    saveIndependentNote: (note) => ipcRenderer.invoke('db:notes:saveIndependent', { note }),
    deleteIndependentNote: (id) => ipcRenderer.invoke('db:notes:deleteIndependent', { id }),

    // Screenshots
    saveScreenshot: (tradeId, imageType, bufferOrBase64, filename) => 
      ipcRenderer.invoke('db:screenshots:save', { tradeId, imageType, bufferOrBase64, filename }),
    getScreenshotsForTrade: (tradeId) => ipcRenderer.invoke('db:screenshots:getByTrade', { tradeId }),
    deleteScreenshot: (screenshotId) => ipcRenderer.invoke('db:screenshots:delete', { screenshotId }),

    // Settings & Migration
    getSetting: (key, defaultValue) => ipcRenderer.invoke('db:settings:get', { key, defaultValue }),
    setSetting: (key, value) => ipcRenderer.invoke('db:settings:set', { key, value }),
    runMigrationFromWeb: (migrationPayload) => ipcRenderer.invoke('db:migrate:fromWeb', migrationPayload),
    createBackupArchive: () => ipcRenderer.invoke('db:backup:createArchive'),
  }
});
```

---

### 4. Complete List of Files to Change in Implementation Phase

```
📁 electron/
  ├── main.js                          [MODIFY] Add DB initialization, migration runner & register IPC handlers
  ├── preload.js                       [MODIFY] Expose typed db methods via contextBridge.electronAPI.db
  ├── db/
  │   ├── database.js                 [NEW] better-sqlite3 connection manager & WAL config
  │   ├── migrator.js                 [NEW] PRAGMA user_version migration engine (.sql runner)
  │   ├── migrations/
  │   │   └── 001_initial_schema.sql  [NEW] Full SQLite schema definition
  │   ├── repositories/
  │   │   ├── tradeRepository.js      [NEW] CRUD for trades & executions with Nexus calculation hooks
  │   │   ├── playbookRepository.js   [NEW] CRUD for setups, rules, and trade rule audits
  │   │   ├── fundRepository.js       [NEW] CRUD for fund transactions & base capital
  │   │   ├── taxRepository.js        [NEW] CRUD for monthly tax records & overrides
  │   │   ├── noteRepository.js       [NEW] CRUD for calendar & independent notes
  │   │   └── screenshotRepository.js [NEW] Disk image writer & DB path tracker
  │   └── ipcHandlers.js              [NEW] Maps all IPC channels to repository methods
📁 src/
  ├── services/
  │   ├── dbAdapter.js                [NEW] Unified DB adapter: calls window.electronAPI.db if in Electron,
  │   │                                     falls back to foxtradeDB / localStorage if in Web browser
  │   ├── dbService.js                [MODIFY] Wire saveUserTrades / getUserTrades through dbAdapter
  │   ├── playbookService.js          [MODIFY] Delegate load/save playbooks & audits through dbAdapter
  │   ├── indexedDBService.js         [MODIFY] Mark legacy methods to delegate to dbAdapter
  ├── db/
  │   ├── index.js                    [MODIFY] Re-export dbAdapter methods to maintain backwards compatibility
  │   ├── tradeStore.js               [MODIFY] Forward putTrade/getTrades to dbAdapter
  │   ├── noteStore.js                [MODIFY] Forward note queries to dbAdapter
  │   ├── configStore.js              [MODIFY] Forward settings/capital queries to dbAdapter
  ├── components/
  │   ├── UploadChartModal.jsx        [MODIFY] Save image files to disk via IPC instead of inline Base64
  │   ├── ChartGalleryModal.jsx       [MODIFY] Load screenshot file URLs from IPC
  │   ├── PortfolioManagerModal.jsx   [MODIFY] Query and save portfolios via dbAdapter
  │   ├── SettingsModal.jsx           [MODIFY] Add "Database Status: SQLite (WAL Active)" & "Export Backup"
  └── package.json                    [MODIFY] Add better-sqlite3 to dependencies
```

---

### 5. Risks & Open Questions for User Approval

#### Critical Architectural Risks
1. **`better-sqlite3` Native C++ Compilation on Windows:**
   - `better-sqlite3` requires precompiled native binaries for Electron (`electron-rebuild` or `@electron/rebuild`).
   - *Mitigation:* We will configure the build script with prebuilt binaries or `better-sqlite3`'s precompiled Electron wheels so you do not need full Visual Studio C++ build tools installed.
2. **Dual-Environment Maintenance (Desktop vs Web):**
   - The user specified: *"Keep the web version working."*
   - *Mitigation:* We design `dbAdapter.js` as an isomorphic strategy pattern:
     ```javascript
     export const db = (typeof window !== 'undefined' && window.electronAPI?.isElectron)
       ? electronSqliteAdapter
       : indexedDbWebAdapter;
     ```
     In the browser, it continues operating seamlessly on IndexedDB without throwing undefined IPC errors.
3. **Execution Splitting for Legacy Flattened Imports:**
   - Historical CSVs imported without granular exit legs (where only `pnl` or `avgExitPrice` was provided) must be translated into a synthetic `E1` exit execution during migration so that the trade-executions relational invariant holds.

#### Open Questions for the User
1. **Trade Number Sequencing across Portfolios:**
   - Currently, `tradeNo` is resequenced 1..N per portfolio. Should the SQLite schema maintain strict sequential numbers per portfolio via a trigger/service logic, or should `trade_no` be user-editable?
2. **Cloud Sync Strategy (Resolved):**
   - **User Decision Confirmed:** Firebase Firestore database is eliminated. Google Drive OAuth sync is the sole cloud backup and multi-device sync solution, keeping trade data 100% private to the user's personal Google Drive.
3. **Screenshot Storage Directory:**
   - By default, images will be saved in `app.getPath('userData')/screenshots/`. Would you like an option in Settings allowing users to choose a custom local folder for their charts (e.g. on external SSD)?

---

## Verdict & Next Steps

This plan provides a **production-grade, zero-loss, offline-first SQLite foundation** built strictly around FoxTrade's real code and calculation engine.

**I am ready to proceed with Phase 3 implementation upon your approval.** Please review the questions above and confirm if you would like me to begin setting up the SQLite migration and IPC bridge.
