/**
 * electron-db/repositories/fundRepository.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SQLite repository for Portfolios, Capital Ledger & Fund Transactions.
 */

import { getDatabase } from '../database.js';
import { toPaise, fromPaise } from '../calculations.js';

export function getPortfolios() {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM portfolios
    WHERE deleted_at IS NULL
    ORDER BY display_order ASC, created_at ASC
  `).all();

  if (rows.length === 0) {
    // Return standard default portfolio if empty
    return [{
      id: 'default',
      name: 'My Portfolio',
      currency: 'INR',
      baseCapital: 100000,
      baseCapitalPaise: 10000000,
      isDefault: true,
      createdAt: Date.now()
    }];
  }

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    currency: r.currency,
    baseCapital: fromPaise(r.base_capital_paise),
    baseCapitalPaise: r.base_capital_paise,
    isDefault: Boolean(r.is_default),
    createdAt: r.created_at
  }));
}

export function savePortfolio(p) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = p.id || `portfolio-${Date.now().toString(36)}`;
  const basePaise = toPaise(p.baseCapital ?? p.base_capital ?? 100000);

  db.prepare(`
    INSERT INTO portfolios (
      id, name, currency, base_capital_paise, is_default, display_order, created_at, updated_at, deleted_at
    ) VALUES (
      @id, @name, @currency, @base_capital_paise, @is_default, @display_order, @created_at, @updated_at, NULL
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      currency = excluded.currency,
      base_capital_paise = excluded.base_capital_paise,
      is_default = excluded.is_default,
      display_order = excluded.display_order,
      updated_at = excluded.updated_at
  `).run({
    id,
    name: p.name || 'New Portfolio',
    currency: p.currency || 'INR',
    base_capital_paise: basePaise,
    is_default: p.isDefault ? 1 : 0,
    display_order: p.displayOrder || 0,
    created_at: p.createdAt || now,
    updated_at: now
  });

  return getPortfolios().find(x => x.id === id);
}

export function deletePortfolio(portfolioId) {
  const db = getDatabase();
  const now = new Date().toISOString();
  return db.prepare(`UPDATE portfolios SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(now, now, portfolioId);
}

export function getBaseCapital(portfolioId = 'default') {
  const db = getDatabase();
  const row = db.prepare(`SELECT base_capital_paise FROM portfolios WHERE id = ? AND deleted_at IS NULL`).get(portfolioId);
  return row ? fromPaise(row.base_capital_paise) : 100000;
}

export function setBaseCapital(portfolioId, amountRupees) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const paise = toPaise(amountRupees);
  db.prepare(`
    UPDATE portfolios SET base_capital_paise = ?, updated_at = ? WHERE id = ?
  `).run(paise, now, portfolioId || 'default');
}

export function getFundTransactions(portfolioId = 'default', year = null) {
  const db = getDatabase();
  const pid = portfolioId || 'default';

  let sql = `
    SELECT * FROM fund_transactions
    WHERE portfolio_id = ? AND deleted_at IS NULL
  `;
  const params = [pid];

  if (year) {
    sql += ` AND transaction_date LIKE ?`;
    params.push(`${year}-%`);
  }

  sql += ` ORDER BY transaction_date ASC, created_at ASC`;

  const rows = db.prepare(sql).all(...params);
  return rows.map(r => ({
    id: r.id,
    portfolioId: r.portfolio_id,
    type: r.transaction_type.toLowerCase(),
    amount: fromPaise(r.amount_paise),
    amountPaise: r.amount_paise,
    date: r.transaction_date,
    dateApproximate: Boolean(r.is_approximate_date),
    note: r.note || '',
    createdAt: r.created_at
  }));
}

export function saveFundTransaction(tx) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = tx.id || `fund-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const paise = toPaise(tx.amount);
  const type = String(tx.type || 'DEPOSIT').toUpperCase();
  const pid = tx.portfolioId || tx.portfolio_id || 'default';

  db.prepare(`
    INSERT OR IGNORE INTO portfolios (id, name, currency, base_capital_paise, is_default, display_order, created_at, updated_at)
    VALUES (?, 'My Portfolio', 'INR', 10000000, 1, 0, ?, ?)
  `).run(pid, now, now);

  db.prepare(`
    INSERT INTO fund_transactions (
      id, portfolio_id, transaction_type, amount_paise, transaction_date,
      is_approximate_date, note, created_at, updated_at, deleted_at
    ) VALUES (
      @id, @portfolio_id, @transaction_type, @amount_paise, @transaction_date,
      @is_approximate_date, @note, @created_at, @updated_at, NULL
    )
    ON CONFLICT(id) DO UPDATE SET
      transaction_type = excluded.transaction_type,
      amount_paise = excluded.amount_paise,
      transaction_date = excluded.transaction_date,
      is_approximate_date = excluded.is_approximate_date,
      note = excluded.note,
      updated_at = excluded.updated_at
  `).run({
    id,
    portfolio_id: tx.portfolioId || tx.portfolio_id || 'default',
    transaction_type: type,
    amount_paise: paise,
    transaction_date: tx.date || tx.transaction_date || now.slice(0, 10),
    is_approximate_date: tx.dateApproximate ? 1 : 0,
    note: tx.note || '',
    created_at: tx.createdAt || now,
    updated_at: now
  });

  return {
    id,
    portfolioId: tx.portfolioId || 'default',
    type: type.toLowerCase(),
    amount: fromPaise(paise),
    date: tx.date || now.slice(0, 10),
    note: tx.note || ''
  };
}

export function deleteFundTransaction(id) {
  const db = getDatabase();
  const now = new Date().toISOString();
  return db.prepare(`UPDATE fund_transactions SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(now, now, id);
}
