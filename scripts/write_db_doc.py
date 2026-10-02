import os

content = """# 🦊 FoxTrade (foxtrade.in) — Complete Database & Storage Architecture Manual

> **Document Type:** Institutional Database Architecture, Data Models, Storage Hierarchy & Sync Specification  
> **System Name:** **FoxTrade** (TradeOnTip)  
> **Primary Client Database:** IndexedDB (`foxtrade_v2`)  
> **Cloud Persistence Model:** 100% Zero-Knowledge User-Owned Google Drive via Restricted Scoped OAuth (`drive.file`)  
> **Identity Layer:** Firebase Authentication (Strictly for Google Identity Token, Zero Trade Data)  
> **Target Path:** `D:\\ASSSSS\\DATABASE_ARCHITECTURE.md`

---

## 📑 Table of Contents

1. [Architectural Overview & Core Philosophy](#1-architectural-overview--core-philosophy)
2. [High-Level Tiered Storage Diagram](#2-high-level-tiered-storage-diagram)
3. [Entity-Relationship (ER) Diagram](#3-entity-relationship-er-diagram)
4. [IndexedDB (`foxtrade_v2`) Schema Specifications](#4-indexeddb-foxtrade_v2-schema-specifications)
   - Store 1: `trades` (Per-Trade Versioned Records)
   - Store 2: `operations_queue` (Offline-Safe Write Ahead Queue)
   - Store 3: `sync_cursors` (ETag & Sync State Tracker)
   - Store 4: `chart_images` (Binary Image Blob Store)
   - Store 5: `app_config` (Durable Application Configuration)
   - Store 6: `monthly_perf` (Fund Ledger & Monthly Return Matrix)
   - Store 7: `ohlc_cache` (High-Performance Candlestick Cache)
5. [Data Flow & Synchronization Sequence Diagram](#5-data-flow--synchronization-sequence-diagram)
6. [Local-First Reactive State & Caching Hierarchy](#6-local-first-reactive-state--caching-hierarchy)
7. [Zero-Knowledge Google Drive Security & Sync Architecture](#7-zero-knowledge-google-drive-security--sync-architecture)
8. [Conflict Resolution Engine (CRDT & Vector Clocks)](#8-conflict-resolution-engine-crdt--vector-clocks)
9. [Crash Resilience & Tab-Close Flush Mechanics](#9-crash-resilience--tab-close-flush-mechanics)

---

## 1. Architectural Overview & Core Philosophy

FoxTrade follows an **offline-first, zero-knowledge, local-authoritative architecture**. Unlike conventional trading journals (such as Tradervue or TraderSync) that store sensitive trade records, capital sizes, and trading strategies in centralized corporate databases:

1. **Zero Central Database:** No user trade data is ever transmitted to or stored on FoxTrade servers or central multi-tenant databases.
2. **Local-First Speed (0ms Latency):** All reads, analytical queries, math calculations, and UI updates execute locally in the browser via `IndexedDB` and in-memory cache.
3. **Private Cloud Backup:** Data is encrypted and synchronized directly between the trader's browser and their private **Google Drive** using the restricted `drive.file` OAuth scope.
4. **Crash-Proof Write Ahead Queue:** Every trade action is queued in an indexed operation store before attempting any network transfer, preventing silent data loss during unexpected tab closes or internet drops.

---

## 2. High-Level Tiered Storage Diagram

```mermaid
graph TD
    subgraph ClientDevice ["User Local Environment (Browser / App)"]
        UI["React 18 UI Layer<br><i>(Journal Table, Analytics, Charts, Deep Dive)</i>"]
        
        subgraph MemoryTier ["Tier 1: In-Memory Reactive Cache"]
            State["React Context & State Hooks<br><i>(Fast 60fps render cycle)</i>"]
            LS["LocalStorage Sync Shims<br><i>(tradeontip_trades_v5, active_id)</i>"]
        end

        subgraph LocalDatabase ["Tier 2: Primary Client DB (IndexedDB: foxtrade_v2)"]
            T1[("Store: trades<br><i>(Per-trade versioned records)</i>")]
            T2[("Store: operations_queue<br><i>(Offline write queue)</i>")]
            T3[("Store: chart_images<br><i>(Binary BLOBs)</i>")]
            T4[("Store: sync_cursors<br><i>(ETag & timestamps)</i>")]
            T5[("Store: app_config<br><i>(Portfolios, tokens, themes)</i>")]
            T6[("Store: monthly_perf<br><i>(Capital ledger matrix)</i>")]
            T7[("Store: ohlc_cache<br><i>(Candlestick cache)</i>")]
        end

        SyncWorker["Background Web Worker & Sync Engine<br><i>(useBrokerSync / syncEngine.js)</i>"]
    end

    subgraph AuthLayer ["Identity Verification Only"]
        FB["Firebase Auth<br><i>(Google OAuth Identity Only - 0 Trade Data)</i>"]
    end

    subgraph CloudStorage ["Tier 3: User-Owned Private Cloud (Google Drive)"]
        GD_JSON["foxtrade_journal.json<br><i>(Encrypted full tradebook & settings)</i>"]
        GD_MEDIA["FoxTrade_Charts/ Folder<br><i>(Separate binary chart snapshots)</i>"]
    end

    UI <--> State
    State <--> LS
    State <--> LocalDatabase
    LocalDatabase <--> SyncWorker
    UI -.->|Authenticate| FB
    SyncWorker <===>|Direct Scoped OAuth<br>drive.file Scope| CloudStorage
```

---

## 3. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    PORTFOLIO ||--o{ TRADE : "contains"
    PORTFOLIO ||--o{ MONTHLY_PERF : "tracks capital progression"
    PORTFOLIO ||--o{ SYNC_CURSOR : "maintains sync state"
    PORTFOLIO ||--o{ OPERATION_QUEUE : "enqueues pending changes"

    TRADE ||--o{ SCALE_IN_LEG : "has P1 to P4 additions"
    TRADE ||--o{ SCALE_OUT_LEG : "has E1 to E4 exits"
    TRADE ||--o{ CHART_IMAGE : "attaches visual proof"
    TRADE ||--|| PSYCHOLOGY_AUDIT : "logs discipline & emotions"
    TRADE ||--|| CHARGES_BREAKDOWN : "computes taxes & levies"

    PORTFOLIO {
        string id PK "e.g. portfolio-default, UUID"
        string name "e.g. Swing Trading Book"
        number baseCapital "e.g. 500000.00"
        string currency "INR or USD"
        string createdAt "ISO timestamp"
        boolean isArchived "Soft delete flag"
    }

    TRADE {
        string id PK "trade-1740900000000 / UUID"
        string portfolioId FK "Associated portfolio"
        number tradeNo "Sequential index (1..N)"
        string date "Entry date (DD-MM-YYYY)"
        string symbol "Canonical ticker (e.g. RELIANCE)"
        string side "Buy / Long or Sell / Short"
        number entry "Initial price per share"
        number qty "Initial quantity"
        number sl "Initial Stop Loss"
        number cmp "Live Current Market Price"
        number tsl "Dynamic Trailing Stop Loss"
        string status "Open | Partial | Closed"
        number grossPnl "Realized + Unrealized ₹"
        number netPnl "After taxes & broker fees ₹"
        number rewardRisk "Calculated R-Multiple"
        number openQty "Remaining open shares"
        number exitedQty "Total shares closed"
        number holdingDays "Duration held in days"
        number updatedAt "Epoch ms for CRDT sync"
        number version "Monotonic record version"
        boolean isDeleted "Tombstone flag"
    }

    SCALE_IN_LEG {
        string legId "p1, p2, p3, p4"
        number price "Executed price"
        number qty "Quantity added"
        string date "Date added"
        number stopLoss "Updated SL for leg"
    }

    SCALE_OUT_LEG {
        string legId "e1, e2, e3, e4"
        number price "Exit price"
        number qty "Quantity trimmed"
        string date "Date exited"
    }

    CHART_IMAGE {
        string id PK "Unique image hash"
        string tradeId FK "Linked trade"
        string timing "before_entry or after_exit"
        string mimeType "image/png, image/jpeg"
        blob dataBlob "Local binary storage"
        string driveFileId "Remote Google Drive ID"
        boolean syncedToDrive "Sync completion flag"
    }

    PSYCHOLOGY_AUDIT {
        string mood "great | good | neutral | frustrated | terrible"
        string planFollowed "Yes | No | Partial"
        string exitTrigger "Target | SL Hit | TSL Hit | Panic | Rule Violation"
        string growthAreas "Identified operational mistakes"
        string noteTitle "Trade reflection headline"
        string notes "Markdown / HTML analysis notes"
        array tags "Strategy tags (e.g. #Breakout, #VCP)"
    }

    CHARGES_BREAKDOWN {
        number brokerage "Broker commission"
        number stt "Securities Transaction Tax"
        number gst "18% Goods & Services Tax"
        number stampDuty "State stamp duty"
        number sebiTurnover "SEBI & Exchange fees"
        number totalCharges "Aggregated deductions"
    }

    MONTHLY_PERF {
        string monthKey PK "YYYY-MM (e.g. 2026-04)"
        string portfolioId FK "Portfolio ID"
        number startingCapital "Opening balance ₹"
        number added "Pay-ins / deposits"
        number withdrawn "Pay-outs / withdrawals"
        number netPnl "Monthly realized return ₹"
        number returnPct "Percentage gain/loss"
        number tradeCount "Trades executed in month"
        number winRate "Winning percentage"
    }

    OPERATION_QUEUE {
        number qid PK "Auto-increment queue ID"
        string portfolioId FK "Target portfolio"
        string operationType "UPSERT_TRADE | DELETE_TRADE | BATCH_IMPORT"
        object payload "Payload data"
        number createdAt "Enqueue timestamp"
        string status "pending | syncing | failed"
        number retryCount "Retry attempts"
    }

    SYNC_CURSOR {
        string portfolioId PK "Portfolio ID"
        string driveFileId "Remote Google Drive file ID"
        string eTag "HTTP Entity Tag for conflict check"
        number lastSyncTime "Last successful sync epoch"
        number remoteVersion "Remote file revision"
    }
```

---

## 4. IndexedDB (`foxtrade_v2`) Schema Specifications

The core offline database is instantiated as **`foxtrade_v2`** with 7 specialized object stores:

### Store 1: `trades`
Stores individual trade records. Unlike legacy setups that serialize an entire trading book as a single monolithic JSON blob, each trade is an individual atomic record.

- **Primary Key:** `id` (`string`, e.g., `"trade-1740900000000"`)
- **Indexes:**
  - `portfolioId` (`portfolioId`): Fast multi-portfolio workspace filtering.
  - `updatedAt` (`updatedAt`): Time-travel and incremental CRDT delta extraction.
  - `portfolioId_status` (`['portfolioId', 'status']`): Instant retrieval of active Open vs Closed trades.
  - `portfolioId_symbol` (`['portfolioId', 'symbol']`): High-speed lookup for Symbol Deep Dive post-trade reviews.

### Store 2: `operations_queue`
Guarantees **zero data loss**. Every mutation made while offline or between sync intervals is enqueued here first.

- **Primary Key:** `qid` (`number`, auto-increment)
- **Indexes:**
  - `status` (`status`): Filters `"pending"`, `"syncing"`, or `"failed"` items.
  - `portfolioId` (`portfolioId`): Enforces sequential FIFO ordering per trading book.
  - `createdAt` (`createdAt`): Ensures deterministic operational replay.

### Store 3: `sync_cursors`
Maintains synchronization watermarks and Google Drive HTTP ETags.

- **Primary Key:** `portfolioId` (`string`)
- **Fields:** `driveFileId`, `eTag`, `lastSyncTime`, `remoteVersion`, `lastConflictTime`.

### Store 4: `chart_images`
Manages visual trade documentation (Before Entry / After Exit chart snapshots). Binary blobs are stored natively in IndexedDB and uploaded as independent image files to Google Drive, ensuring the main `foxtrade_journal.json` remains lightweight and fast.

- **Primary Key:** `id` (`string`, image hash or UUID)
- **Indexes:**
  - `tradeId` (`tradeId`): Binds screenshots directly to parent trade records.
  - `portfolioId` (`portfolioId`): Groups images by workspace.
  - `syncedToDrive` (`syncedToDrive`): Flags pending image uploads.

### Store 5: `app_config`
Durable configuration storage that replaces fragile `localStorage` (which can be cleared by aggressive OS memory cleaners).

- **Primary Key:** `key` (`string`, e.g., `"activePortfolioId"`, `"theme"`, `"user_settings"`)
- **Fields:** `key`, `value`, `updatedAt`.

### Store 6: `monthly_perf`
Holds the Fund Management monthly ledger matrix, starting balances, capital additions, and monthly returns.

- **Primary Key:** `compositeKey` (`string`, e.g., `"portfolio-default_2026-04"`)
- **Fields:** `portfolioId`, `year`, `month`, `startingCapital`, `added`, `withdrawn`, `netPnl`.

### Store 7: `ohlc_cache`
High-speed candlestick caching engine for Lightweight Charts v5.2, storing historical daily/weekly OHLC data with TTL expiry to eliminate redundant proxy calls.

- **Primary Key:** `symbol_timeframe` (`string`, e.g., `"RELIANCE_1D"`)
- **Fields:** `symbol`, `timeframe`, `candles`, `cachedAt`, `expiresAt`.

---

## 5. Data Flow & Synchronization Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Trader as Trader (User Interface)
    participant UI as React State & Table
    participant IDB as IndexedDB (foxtrade_v2)
    participant Queue as Operations Queue
    participant Sync as Background Sync Engine
    participant Drive as User Google Drive

    Trader->>UI: Enter Trade / Edit Cell (Inline)
    UI->>UI: Recalculate VWAP, P&L, R:R in memory (0ms)
    UI->>IDB: Atomic Put: trades store (id: trade-101)
    UI->>Queue: Enqueue Write: {type: 'UPSERT', payload}
    UI-->>Trader: Visual instant confirmation (60fps)

    Note over Sync: 15-Second Debounce Timer or Tab Close Trigger
    Sync->>Queue: Drain pending operations (status: 'pending')
    Sync->>Drive: GET metadata & ETag (foxtrade_journal.json)
    
    alt Remote ETag Matches (No Conflict)
        Sync->>Drive: PATCH / Upload updated JSON payload
        Drive-->>Sync: HTTP 200 OK (New ETag)
        Sync->>IDB: Update sync_cursors & clear Queue
    else Remote ETag Changed (Another Tab / Device Edited)
        Drive-->>Sync: HTTP 412 / Newer Version Detected
        Sync->>Drive: Download remote foxtrade_journal.json
        Sync->>Sync: Execute CRDT Merge (Field-level LWW by updatedAt)
        Sync->>IDB: Store reconciled records
        Sync->>Drive: Upload reconciled JSON
        Sync->>UI: Trigger reactive re-render with merged data
    end
```

---

## 6. Local-First Reactive State & Caching Hierarchy

To deliver instant rendering without stuttering during large CSV imports (1,000+ trades), FoxTrade employs a 3-tier caching hierarchy:

```
┌─────────────────────────────────────────────────────────────┐
│  Tier 1: In-Memory React Hooks & Contexts                   │
│  • tradesState, portfolioStats, activePortfolio             │
│  • Sub-millisecond synchronous reads for UI components      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Synchronous Mirror
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Tier 2: Browser Local Storage (Fast Shims)                │
│  • tradeontip_trades_v5 (legacy fallbacks)                  │
│  • tradeontip_active_portfolio_id                           │
│  • tradeontip_theme ('light' | 'dark' | 'pitch-black')      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Async Persistence
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Tier 3: IndexedDB Database (foxtrade_v2)                   │
│  • 7 Indexed Object Stores with transaction isolation       │
│  • Crash-resilient, holds 100,000+ trades + image BLOBs     │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Zero-Knowledge Google Drive Security & Sync Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Browser / Device                       │
│    (FoxTrade Single Page Application · Zero Analytics Data Harvested)   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                     Direct Encrypted HTTPS REST Calls
                  OAuth Scope: https://www.googleapis.com/
                               auth/drive.file
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      User's Personal Google Drive                       │
│                                                                         │
│   📁 Root Folder                                                        │
│   └── 📄 foxtrade_journal.json         <-- Complete encrypted tradebook │
│                                                                         │
│   📁 FoxTrade_Charts/ (Folder)                                          │
│   ├── 🖼️ img_trade_101_before.png      <-- Uncompressed chart snapshots │
│   └── 🖼️ img_trade_101_after.png                                       │
│                                                                         │
│   • 100% Owned by the Trader                                            │
│   • Zero Access by FoxTrade Staff, Servers, or Third Parties            │
│   • Read/Write permissions restricted exclusively to FoxTrade files     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Security Guarantees:
- **Restricted Scope (`drive.file`):** FoxTrade **cannot** see, browse, read, or modify any other files in the user's Google Drive. It is cryptographically sandboxed to only access files created by FoxTrade itself.
- **Client-Side Marshaling:** Data is converted to JSON and parsed directly inside the browser's JavaScript V8 sandbox.
- **No Third-Party Analytics Leaks:** No trade quantities, rupee balances, or ticker symbols are sent to external analytics tools (e.g., Mixpanel, Google Analytics).

---

## 8. Conflict Resolution Engine (CRDT & Vector Clocks)

When multiple browser tabs or devices edit the tradebook simultaneously, FoxTrade prevents data overwriting using a **Conflict-Free Replicated Data Type (CRDT) Last-Write-Wins (LWW)** algorithm:

1. Every trade object carries an immutable `id` and a monotonic timestamp `updatedAt` (epoch ms).
2. During synchronization:
   - If a trade exists locally but not remotely $\implies$ **Added to Remote**.
   - If a trade exists remotely but not locally $\implies$ **Added to Local**.
   - If a trade exists on both:
     $$\text{Winning Record} = \begin{cases} \text{Local Record}, & \text{if } \text{Local.updatedAt} \ge \text{Remote.updatedAt} \\ \text{Remote Record}, & \text{if } \text{Remote.updatedAt} > \text{Local.updatedAt} \end{cases}$$
3. **Tombstone Deletes:** Deleted trades are not immediately expunged; they are marked with `{ isDeleted: true, updatedAt: now }`. This guarantees deletion intents propagate across all user devices rather than being resurrected by stale devices.

---

## 9. Crash Resilience & Tab-Close Flush Mechanics

To prevent data loss when a user enters a trade and immediately closes their laptop or browser tab:

- **`pagehide` & `beforeunload` Hooks:** `dbService.js` registers native browser lifecycle listeners.
- **`navigator.sendBeacon` Fallback:** If asynchronous `fetch` is interrupted by browser termination, the sync engine dispatches the payload via browser beacons or executes synchronous atomic commits to `IndexedDB` before the process unloads.
- **Auto-Repair on Startup:** During initialization, FoxTrade scans the `operations_queue` store for any uncommitted items from previous sessions and replays them immediately upon reconnection.

---

*Verified & Exported to `D:\\ASSSSS\\DATABASE_ARCHITECTURE.md` for FoxTrade Engineering.*
"""

target_path = r"D:\ASSSSS\DATABASE_ARCHITECTURE.md"
with open(target_path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Successfully written {len(content)} characters to {target_path}")
