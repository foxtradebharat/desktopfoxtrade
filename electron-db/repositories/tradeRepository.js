/**
 * electron-db/repositories/tradeRepository.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SQLite repository for Trades and Executions with Nexus calculation engine.
 */

import { randomUUID } from 'node:crypto';
import { getDatabase } from '../database.js';
import { computeTradeMetrics, toPaise, fromPaise } from '../calculations.js';

function genUuid() {
  return randomUUID ? randomUUID() : `trade-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Fetch all active trades for a portfolio, including associated executions.
 * @param {string} portfolioId
 * @param {object} [filters]
 * @returns {Array<object>}
 */
export function getTrades(portfolioId, filters = {}) {
  const db = getDatabase();
  const targetPid = portfolioId || 'portfolio-default';

  let sql = `
    SELECT * FROM trades
    WHERE (portfolio_id = ? OR portfolio_id = 'default' OR ? = 'all')
      AND deleted_at IS NULL
  `;
  const params = [targetPid, targetPid];

  if (filters.status) {
    sql += ` AND status = ?`;
    params.push(filters.status.toUpperCase());
  }
  if (filters.symbol) {
    sql += ` AND symbol = ?`;
    params.push(filters.symbol.toUpperCase());
  }

  sql += ` ORDER BY trade_no ASC, entry_date ASC`;

  const tradeRows = db.prepare(sql).all(...params);
  if (tradeRows.length === 0) return [];

  // Fetch all executions for these trades in one batch query
  const tradeIds = tradeRows.map(t => t.id);
  const placeholders = tradeIds.map(() => '?').join(',');
  const execRows = db.prepare(`
    SELECT * FROM executions
    WHERE trade_id IN (${placeholders}) AND deleted_at IS NULL
    ORDER BY execution_date ASC, execution_time ASC, leg_index ASC
  `).all(...tradeIds);

  const execsByTrade = new Map();
  execRows.forEach(exec => {
    if (!execsByTrade.has(exec.trade_id)) execsByTrade.set(exec.trade_id, []);
    execsByTrade.get(exec.trade_id).push(exec);
  });

  // Map to frontend-friendly trade object
  return tradeRows.map(t => formatTradeForFrontend(t, execsByTrade.get(t.id) || []));
}

/**
 * Fetch single trade by ID with its executions.
 */
export function getTradeById(tradeId) {
  const db = getDatabase();
  const trade = db.prepare(`SELECT * FROM trades WHERE id = ? AND deleted_at IS NULL`).get(tradeId);
  if (!trade) return null;

  const execs = db.prepare(`
    SELECT * FROM executions WHERE trade_id = ? AND deleted_at IS NULL
    ORDER BY execution_date ASC, execution_time ASC, leg_index ASC
  `).all(tradeId);

  return formatTradeForFrontend(trade, execs);
}

/**
 * Save (insert or update) a trade and its executions atomically.
 * Automatically runs Nexus formulas to calculate avg entry, PnL, R-multiple, etc.
 *
 * @param {string} portfolioId
 * @param {object} rawTrade
 * @param {Array}  [rawExecutions]
 * @returns {object} saved trade
 */
export function saveTrade(portfolioId, rawTrade, rawExecutions = null) {
  const db = getDatabase();
  const pid = portfolioId || rawTrade.portfolioId || 'portfolio-default';
  const now = new Date().toISOString();

  // Get portfolio base capital for PF impact calculation
  const pfRow = db.prepare(`SELECT base_capital_paise FROM portfolios WHERE id = ?`).get(pid);
  const baseCapitalPaise = pfRow?.base_capital_paise || 10000000; // default 1 Lakh

  return db.transaction(() => {
    // Ensure portfolio exists to satisfy foreign key constraint
    db.prepare(`
      INSERT OR IGNORE INTO portfolios (id, name, currency, base_capital_paise, is_default, display_order, created_at, updated_at)
      VALUES (?, 'My Portfolio', 'INR', 10000000, 1, 0, ?, ?)
    `).run(pid, now, now);

    const tradeId = rawTrade.id || genUuid();

    // 1. Resolve Executions: either provided explicitly or extracted from flattened legs
    let executions = [];
    if (Array.isArray(rawExecutions) && rawExecutions.length > 0) {
      executions = rawExecutions;
    } else {
      executions = extractExecutionsFromFlatTrade(tradeId, pid, rawTrade);
    }

    // Assign stable IDs to executions
    executions = executions.map((ex, idx) => ({
      ...ex,
      id: ex.id || `exec-${tradeId}-${idx}-${Date.now().toString(36)}`,
      trade_id: tradeId,
      portfolio_id: pid,
      leg_index: ex.leg_index !== undefined ? ex.leg_index : idx,
      created_at: ex.created_at || now,
      updated_at: now,
      deleted_at: null
    }));

    // 2. Compute Master Metrics from executions
    const computed = computeTradeMetrics(
      {
        ...rawTrade,
        id: tradeId,
        portfolio_id: pid,
        symbol: String(rawTrade.symbol || rawTrade.name || '').trim().toUpperCase(),
        direction: (rawTrade.direction || rawTrade.type || 'LONG').toUpperCase(),
        initial_stop_loss_paise: toPaise(rawTrade.sl ?? rawTrade.stopLoss),
        trailing_stop_loss_paise: toPaise(rawTrade.tsl ?? rawTrade.trailingSl),
        target_price_paise: toPaise(rawTrade.targetPrice ?? rawTrade.target),
        broker: rawTrade.broker || 'not_defined',
        setup_id: rawTrade.setup_id || rawTrade.playbookId || null,
        setup_name: rawTrade.setup || rawTrade.setup_name || null,
        entry_type: rawTrade.entryType || 'Market',
        notes: rawTrade.notes || rawTrade.observations || '',
        plan_followed: rawTrade.planFollowed === false || rawTrade.planFollowed === 'No' ? 0 : 1,
        exit_trigger: rawTrade.exitTrigger || null,
        is_flagged: rawTrade.is_flagged ? 1 : 0
      },
      executions,
      baseCapitalPaise
    );

    // Determine trade number
    let tradeNo = Number(rawTrade.tradeNo || rawTrade.trade_no);
    if (!tradeNo || isNaN(tradeNo)) {
      const maxNoRow = db.prepare(`SELECT MAX(trade_no) as max_no FROM trades WHERE portfolio_id = ? AND deleted_at IS NULL`).get(pid);
      tradeNo = (maxNoRow?.max_no || 0) + 1;
    }

    // 3. Upsert Parent Trade
    db.prepare(`
      INSERT INTO trades (
        id, trade_no, portfolio_id, symbol, company_name, asset_class, direction,
        status, entry_type, setup_id, setup_name, broker, entry_date, entry_time,
        exit_date, exit_time, initial_stop_loss_paise, trailing_stop_loss_paise, target_price_paise,
        total_entered_quantity, open_quantity, exited_quantity, avg_entry_price_paise,
        avg_exit_price_paise, position_size_paise, realised_amount_paise, gross_pnl_paise,
        total_charges_paise, net_pnl_paise, reward_risk, holding_days, stock_move_pct,
        capital_at_risk_pct, risk_amount_paise, profit_protected_paise, pf_impact_pct,
        mae, mfe, plan_followed, exit_trigger, notes, is_flagged, validation_flags,
        created_at, updated_at, deleted_at
      ) VALUES (
        @id, @trade_no, @portfolio_id, @symbol, @company_name, @asset_class, @direction,
        @status, @entry_type, @setup_id, @setup_name, @broker, @entry_date, @entry_time,
        @exit_date, @exit_time, @initial_stop_loss_paise, @trailing_stop_loss_paise, @target_price_paise,
        @total_entered_quantity, @open_quantity, @exited_quantity, @avg_entry_price_paise,
        @avg_exit_price_paise, @position_size_paise, @realised_amount_paise, @gross_pnl_paise,
        @total_charges_paise, @net_pnl_paise, @reward_risk, @holding_days, @stock_move_pct,
        @capital_at_risk_pct, @risk_amount_paise, @profit_protected_paise, @pf_impact_pct,
        @mae, @mfe, @plan_followed, @exit_trigger, @notes, @is_flagged, @validation_flags,
        @created_at, @updated_at, @deleted_at
      )
      ON CONFLICT(id) DO UPDATE SET
        trade_no = excluded.trade_no,
        symbol = excluded.symbol,
        direction = excluded.direction,
        status = excluded.status,
        setup_id = excluded.setup_id,
        setup_name = excluded.setup_name,
        broker = excluded.broker,
        entry_date = excluded.entry_date,
        entry_time = excluded.entry_time,
        exit_date = excluded.exit_date,
        exit_time = excluded.exit_time,
        initial_stop_loss_paise = excluded.initial_stop_loss_paise,
        trailing_stop_loss_paise = excluded.trailing_stop_loss_paise,
        total_entered_quantity = excluded.total_entered_quantity,
        open_quantity = excluded.open_quantity,
        exited_quantity = excluded.exited_quantity,
        avg_entry_price_paise = excluded.avg_entry_price_paise,
        avg_exit_price_paise = excluded.avg_exit_price_paise,
        position_size_paise = excluded.position_size_paise,
        realised_amount_paise = excluded.realised_amount_paise,
        gross_pnl_paise = excluded.gross_pnl_paise,
        net_pnl_paise = excluded.net_pnl_paise,
        reward_risk = excluded.reward_risk,
        holding_days = excluded.holding_days,
        stock_move_pct = excluded.stock_move_pct,
        pf_impact_pct = excluded.pf_impact_pct,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `).run({
      id: tradeId,
      trade_no: tradeNo,
      portfolio_id: pid,
      symbol: computed.symbol,
      company_name: computed.company_name || null,
      asset_class: computed.asset_class || 'EQUITY',
      direction: computed.direction,
      status: computed.status,
      entry_type: computed.entry_type || 'Market',
      setup_id: computed.setup_id || null,
      setup_name: computed.setup_name || null,
      broker: computed.broker || 'not_defined',
      entry_date: computed.entry_date || now.slice(0, 10),
      entry_time: computed.entry_time || '09:15:00',
      exit_date: computed.exit_date || null,
      exit_time: computed.exit_time || null,
      initial_stop_loss_paise: computed.initial_stop_loss_paise || null,
      trailing_stop_loss_paise: computed.trailing_stop_loss_paise || null,
      target_price_paise: computed.target_price_paise || null,
      total_entered_quantity: computed.total_entered_quantity || 0,
      open_quantity: computed.open_quantity || 0,
      exited_quantity: computed.exited_quantity || 0,
      avg_entry_price_paise: computed.avg_entry_price_paise || 0,
      avg_exit_price_paise: computed.avg_exit_price_paise || 0,
      position_size_paise: computed.position_size_paise || 0,
      realised_amount_paise: computed.realised_amount_paise || 0,
      gross_pnl_paise: computed.gross_pnl_paise || 0,
      total_charges_paise: computed.total_charges_paise || 0,
      net_pnl_paise: computed.net_pnl_paise || 0,
      reward_risk: computed.reward_risk !== null ? computed.reward_risk : null,
      holding_days: computed.holding_days || 0,
      stock_move_pct: computed.stock_move_pct || 0,
      capital_at_risk_pct: computed.capital_at_risk_pct || 0,
      risk_amount_paise: computed.risk_amount_paise || 0,
      profit_protected_paise: computed.profit_protected_paise || 0,
      pf_impact_pct: computed.pf_impact_pct || 0,
      mae: computed.mae || null,
      mfe: computed.mfe || null,
      plan_followed: computed.plan_followed !== undefined ? computed.plan_followed : 1,
      exit_trigger: computed.exit_trigger || null,
      notes: computed.notes || '',
      is_flagged: computed.is_flagged ? 1 : 0,
      validation_flags: computed.validation_flags ? JSON.stringify(computed.validation_flags) : null,
      created_at: rawTrade.created_at || rawTrade.createdAt || now,
      updated_at: now,
      deleted_at: null
    });

    // 4. Soft-delete old executions not in this batch and insert updated executions
    db.prepare(`UPDATE executions SET deleted_at = ? WHERE trade_id = ?`).run(now, tradeId);

    const insertExec = db.prepare(`
      INSERT INTO executions (
        id, trade_id, portfolio_id, execution_type, leg_index, side,
        quantity, price_paise, execution_date, execution_time, stop_loss_paise,
        external_id, broker_order_id, broker_trade_id, source,
        created_at, updated_at, deleted_at
      ) VALUES (
        @id, @trade_id, @portfolio_id, @execution_type, @leg_index, @side,
        @quantity, @price_paise, @execution_date, @execution_time, @stop_loss_paise,
        @external_id, @broker_order_id, @broker_trade_id, @source,
        @created_at, @updated_at, NULL
      )
      ON CONFLICT(id) DO UPDATE SET
        quantity = excluded.quantity,
        price_paise = excluded.price_paise,
        execution_date = excluded.execution_date,
        execution_time = excluded.execution_time,
        stop_loss_paise = excluded.stop_loss_paise,
        deleted_at = NULL,
        updated_at = excluded.updated_at
    `);

    executions.forEach(ex => {
      insertExec.run({
        id: ex.id,
        trade_id: tradeId,
        portfolio_id: pid,
        execution_type: ex.execution_type,
        leg_index: ex.leg_index,
        side: ex.side,
        quantity: ex.quantity,
        price_paise: ex.price_paise,
        execution_date: ex.execution_date,
        execution_time: ex.execution_time || '09:15:00',
        stop_loss_paise: ex.stop_loss_paise || null,
        external_id: ex.external_id || null,
        broker_order_id: ex.broker_order_id || null,
        broker_trade_id: ex.broker_trade_id || null,
        source: ex.source || 'MANUAL',
        created_at: ex.created_at || now,
        updated_at: now
      });
    });

    return formatTradeForFrontend(
      db.prepare(`SELECT * FROM trades WHERE id = ?`).get(tradeId),
      executions
    );
  })();
}

/**
 * Soft-delete a trade.
 */
export function deleteTrade(tradeId) {
  const db = getDatabase();
  const now = new Date().toISOString();
  return db.transaction(() => {
    db.prepare(`UPDATE trades SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(now, now, tradeId);
    db.prepare(`UPDATE executions SET deleted_at = ?, updated_at = ? WHERE trade_id = ?`).run(now, now, tradeId);
    db.prepare(`UPDATE trade_rule_checks SET deleted_at = ?, updated_at = ? WHERE trade_id = ?`).run(now, now, tradeId);
  })();
}

/**
 * Resequence trade numbers sequentially 1..N for a portfolio based on date.
 */
export function resequenceTradeNumbers(portfolioId) {
  const db = getDatabase();
  const targetPid = portfolioId || 'portfolio-default';
  return db.transaction(() => {
    const trades = db.prepare(`
      SELECT id, entry_date, trade_no FROM trades
      WHERE portfolio_id = ? AND deleted_at IS NULL
      ORDER BY entry_date ASC, id ASC
    `).all(targetPid);

    const updateStmt = db.prepare(`UPDATE trades SET trade_no = ? WHERE id = ?`);
    trades.forEach((t, idx) => {
      updateStmt.run(idx + 1, t.id);
    });
  })();
}

/**
 * Fast SQL-calculated Dashboard metrics.
 */
export function getDashboardMetrics(portfolioId) {
  const db = getDatabase();
  const targetPid = portfolioId || 'portfolio-default';

  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total_trades,
      SUM(CASE WHEN status IN ('OPEN', 'PARTIAL') THEN 1 ELSE 0 END) AS open_positions,
      SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) AS closed_positions,
      SUM(CASE WHEN status IN ('CLOSED', 'PARTIAL') THEN gross_pnl_paise ELSE 0 END) AS total_gross_pnl_paise,
      SUM(CASE WHEN status IN ('CLOSED', 'PARTIAL') THEN net_pnl_paise ELSE 0 END) AS total_net_pnl_paise,
      SUM(CASE WHEN status = 'CLOSED' AND gross_pnl_paise > 0 THEN 1 ELSE 0 END) AS winning_trades,
      SUM(CASE WHEN status = 'CLOSED' AND gross_pnl_paise < 0 THEN 1 ELSE 0 END) AS losing_trades,
      SUM(CASE WHEN status = 'CLOSED' AND gross_pnl_paise = 0 THEN 1 ELSE 0 END) AS breakeven_trades,
      SUM(CASE WHEN status IN ('OPEN', 'PARTIAL') THEN risk_amount_paise ELSE 0 END) AS total_risk_paise,
      SUM(CASE WHEN status IN ('OPEN', 'PARTIAL') THEN profit_protected_paise ELSE 0 END) AS total_profit_protected_paise
    FROM trades
    WHERE portfolio_id = ? AND deleted_at IS NULL
  `).get(targetPid);

  const closed = stats.closed_positions || 0;
  const wins = stats.winning_trades || 0;
  const decided = wins + (stats.losing_trades || 0);
  const winRate = decided > 0 ? Number(((wins / decided) * 100).toFixed(2)) : 0;

  return {
    totalTrades: stats.total_trades || 0,
    openPositions: stats.open_positions || 0,
    closedPositions: closed,
    grossPnl: fromPaise(stats.total_gross_pnl_paise || 0),
    netPnl: fromPaise(stats.total_net_pnl_paise || 0),
    winRate,
    winningTrades: wins,
    losingTrades: stats.losing_trades || 0,
    breakevenTrades: stats.breakeven_trades || 0,
    totalRiskAmount: fromPaise(stats.total_risk_paise || 0),
    totalProfitProtected: fromPaise(stats.total_profit_protected_paise || 0)
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractExecutionsFromFlatTrade(tradeId, portfolioId, t) {
  const execs = [];
  const entryDate = t.date || t.entryDate || t.entry_date || new Date().toISOString().slice(0, 10);
  const entryTime = t.time || t.entryTime || t.entry_time || '09:15:00';
  const isShort = String(t.direction || t.type || '').toUpperCase() === 'SHORT' ||
                  String(t.direction || t.type || '').toUpperCase() === 'SELL';

  // 1. Initial Entry
  const initialQty = Number(t.qty || t.initialQty || t.quantity) || 0;
  const initialPrice = Number(t.entry || t.entryPrice || t.price || t.avgEntry) || 0;
  if (initialQty > 0 && initialPrice > 0) {
    execs.push({
      execution_type: 'ENTRY',
      leg_index: 0,
      side: isShort ? 'SELL' : 'BUY',
      quantity: initialQty,
      price_paise: toPaise(initialPrice),
      execution_date: entryDate,
      execution_time: entryTime,
      stop_loss_paise: toPaise(t.sl ?? t.stopLoss)
    });
  }

  // 2. Pyramids P1..P5
  for (let i = 1; i <= 5; i++) {
    const pPrice = Number(t[`p${i}Price`] ?? t[`p${i}price`]);
    const pQty = Number(t[`p${i}Qty`] ?? t[`p${i}qty`]);
    const pDate = t[`p${i}Date`] || t[`p${i}date`] || entryDate;
    const pSl = toPaise(t[`p${i}Sl`] ?? t[`p${i}sl`]);

    if (pPrice > 0 && pQty > 0) {
      execs.push({
        execution_type: 'ENTRY',
        leg_index: i,
        side: isShort ? 'SELL' : 'BUY',
        quantity: pQty,
        price_paise: toPaise(pPrice),
        execution_date: pDate,
        execution_time: t[`p${i}Time`] || '10:00:00',
        stop_loss_paise: pSl > 0 ? pSl : null
      });
    }
  }

  // 3. Exits E1..E5
  for (let j = 1; j <= 5; j++) {
    const ePrice = Number(t[`e${j}Price`] ?? t[`e${j}price`]);
    const eQty = Number(t[`e${j}Qty`] ?? t[`e${j}qty`]);
    const eDate = t[`e${j}Date`] || t[`e${j}date`] || t.exitDate || t.date || entryDate;

    if (ePrice > 0 && eQty > 0) {
      execs.push({
        execution_type: 'EXIT',
        leg_index: j,
        side: isShort ? 'BUY' : 'SELL',
        quantity: eQty,
        price_paise: toPaise(ePrice),
        execution_date: eDate,
        execution_time: t[`e${j}Time`] || '15:00:00'
      });
    }
  }

  // Fallback for single exit imports
  if (execs.filter(e => e.execution_type === 'EXIT').length === 0) {
    const exitedQty = Number(t.exitedQty || t.exited_quantity) || 0;
    const avgExit = Number(t.avgExitPrice || t.avgExit || t.exitPrice) || 0;
    if (exitedQty > 0 && avgExit > 0) {
      execs.push({
        execution_type: 'EXIT',
        leg_index: 1,
        side: isShort ? 'BUY' : 'SELL',
        quantity: exitedQty,
        price_paise: toPaise(avgExit),
        execution_date: t.exitDate || t.e1Date || entryDate,
        execution_time: '15:00:00'
      });
    }
  }

  return execs;
}

function formatTradeForFrontend(trade, execs = []) {
  const isShort = trade.direction === 'SHORT';
  const entryExecs = execs.filter(e => e.execution_type === 'ENTRY');
  const exitExecs  = execs.filter(e => e.execution_type === 'EXIT');

  // Format flattened legs so Dashboard table and modals continue to function with zero changes
  const legs = {};
  entryExecs.forEach(e => {
    if (e.leg_index === 0) {
      legs.entry = fromPaise(e.price_paise);
      legs.qty = e.quantity;
      legs.date = e.execution_date;
      legs.time = e.execution_time;
      if (e.stop_loss_paise) legs.sl = fromPaise(e.stop_loss_paise);
    } else if (e.leg_index <= 5) {
      legs[`p${e.leg_index}Price`] = fromPaise(e.price_paise);
      legs[`p${e.leg_index}Qty`] = e.quantity;
      legs[`p${e.leg_index}Date`] = e.execution_date;
      if (e.stop_loss_paise) legs[`p${e.leg_index}Sl`] = fromPaise(e.stop_loss_paise);
    }
  });

  exitExecs.forEach(e => {
    if (e.leg_index <= 5) {
      legs[`e${e.leg_index}Price`] = fromPaise(e.price_paise);
      legs[`e${e.leg_index}Qty`] = e.quantity;
      legs[`e${e.leg_index}Date`] = e.execution_date;
    }
  });

  return {
    ...trade,
    ...legs,
    id: trade.id,
    tradeNo: trade.trade_no,
    portfolioId: trade.portfolio_id,
    name: trade.symbol,
    symbol: trade.symbol,
    type: isShort ? 'Sell' : 'Buy',
    direction: trade.direction,
    status: trade.status === 'CLOSED' ? 'Closed' : trade.status === 'PARTIAL' ? 'Partial' : 'Open',
    entry: fromPaise(trade.avg_entry_price_paise),
    avgEntry: fromPaise(trade.avg_entry_price_paise),
    qty: trade.total_entered_quantity,
    openQty: trade.open_quantity,
    exitedQty: trade.exited_quantity,
    avgExitPrice: fromPaise(trade.avg_exit_price_paise || 0),
    positionSize: fromPaise(trade.position_size_paise),
    realisedAmount: fromPaise(trade.realised_amount_paise || 0),
    pnl: fromPaise(trade.gross_pnl_paise),
    pl: fromPaise(trade.gross_pnl_paise),
    grossPnl: fromPaise(trade.gross_pnl_paise),
    netPnl: fromPaise(trade.net_pnl_paise),
    grossPaise: trade.gross_pnl_paise,
    netPaise: trade.net_pnl_paise,
    rewardRisk: trade.reward_risk,
    holdingDays: trade.holding_days,
    stockMove: trade.stock_move_pct,
    capitalAtRisk: trade.capital_at_risk_pct,
    openHeat: trade.capital_at_risk_pct,
    riskAmount: fromPaise(trade.risk_amount_paise || 0),
    profitProtected: fromPaise(trade.profit_protected_paise || 0),
    pfImpact: trade.pf_impact_pct,
    sl: trade.initial_stop_loss_paise ? fromPaise(trade.initial_stop_loss_paise) : null,
    tsl: trade.trailing_stop_loss_paise ? fromPaise(trade.trailing_stop_loss_paise) : null,
    setup: trade.setup_name || '',
    broker: trade.broker || 'not_defined',
    notes: trade.notes || '',
    executions: execs.map(e => ({
      id: e.id,
      type: e.execution_type,
      legIndex: e.leg_index,
      side: e.side,
      qty: e.quantity,
      price: fromPaise(e.price_paise),
      date: e.execution_date,
      time: e.execution_time
    }))
  };
}
