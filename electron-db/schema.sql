-- ============================================================================
-- FOXTRADE MASTER DATABASE SCHEMA (SQLite 3 / better-sqlite3)
-- Target: Electron Desktop Application
-- Schema Version: 1
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PORTFOLIOS (Accounts / Workspaces)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portfolios (
    id TEXT PRIMARY KEY,                       -- UUIDv4 or stable portfolio ID
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

INSERT OR IGNORE INTO portfolios (id, name, currency, base_capital_paise, is_default, display_order, created_at, updated_at)
VALUES ('default', 'My Portfolio', 'INR', 10000000, 1, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- ----------------------------------------------------------------------------
-- 2. PLAYBOOK SETUPS (Trading Systems & Strategies)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS playbook_setups (
    id TEXT PRIMARY KEY,                       -- UUIDv4 or slug (e.g. 'pb-sample')
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
    deleted_at TEXT                            -- Soft-delete
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
    symbol TEXT NOT NULL,                      -- Canonical Ticker (e.g. 'RELIANCE', 'NIFTY')
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
    
    -- Computed / Materialized Metrics (Derived from Executions)
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
-- 6. TRADE RULE CHECKS (Playbook Audits Checklist Rows)
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
-- 8. MISSED TRADES (Playbook Missed Setups / Opportunity Tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS missed_trades (
    id TEXT PRIMARY KEY,                       -- UUIDv4
    playbook_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    segment TEXT DEFAULT 'EQUITY',
    direction TEXT DEFAULT 'LONG',
    date TEXT NOT NULL,                        -- YYYY-MM-DD
    entry_price_paise INTEGER,
    exit_price_paise INTEGER,
    theoretical_stop_paise INTEGER,
    theoretical_pnl_paise INTEGER,
    theoretical_r_multiple REAL,
    status TEXT DEFAULT 'MISSED',
    event_tag TEXT,
    notes TEXT,
    screenshot_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (playbook_id) REFERENCES playbook_setups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_missed_playbook ON missed_trades(playbook_id, deleted_at, date DESC);

-- ----------------------------------------------------------------------------
-- 9. TRADE TAGS (Additive Tagging Overlay)
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
-- 10. TRADE SCREENSHOTS (Files on Disk, Paths in DB)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_screenshots (
    id TEXT PRIMARY KEY,                       -- UUIDv4
    trade_id TEXT NOT NULL,                    -- Foreign Key to trades
    image_type TEXT NOT NULL,                  -- 'BEFORE_ENTRY', 'AFTER_EXIT', 'DURING'
    file_path TEXT NOT NULL,                   -- Relative path: 'screenshots/{tradeId}-{type}.webp'
    file_name TEXT NOT NULL,                   -- Original filename
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
-- 11. FUND TRANSACTIONS (Capital Additions, Withdrawals & Base Adjustments)
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
-- 12. MONTHLY TAX RECORDS & OVERRIDES (Statutory Taxes & Ledger Charges)
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
-- 13. NOTES (Calendar Daily Notes & Independent Productivity Notes)
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
-- 14. APP SETTINGS & KEY-VALUE CONFIG
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,                      -- e.g. 'theme', 'visible_columns', 'active_portfolio_id'
    value TEXT NOT NULL,                       -- JSON string or scalar
    updated_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 15. SCHEMA MIGRATION LEDGER
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,               -- e.g. 1, 2, 3
    name TEXT NOT NULL,                        -- e.g. '001_initial_schema'
    applied_at TEXT NOT NULL
);
