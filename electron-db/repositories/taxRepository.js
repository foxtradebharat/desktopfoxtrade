/**
 * electron-db/repositories/taxRepository.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SQLite repository for Monthly Tax Records & Overrides.
 */

import { getDatabase } from '../database.js';
import { toPaise, fromPaise } from '../calculations.js';

export function getMonthlyTaxRecords(portfolioId = 'default', year = 2026) {
  const db = getDatabase();
  const pid = portfolioId || 'default';
  const numYear = parseInt(year, 10) || 2026;

  const rows = db.prepare(`
    SELECT * FROM monthly_tax_records
    WHERE portfolio_id = ? AND year = ? AND deleted_at IS NULL
    ORDER BY month ASC
  `).all(pid, numYear);

  const result = {};
  rows.forEach(r => {
    // 0-indexed month map for frontend TaxAnalyticsPage
    const monthIdx = r.month - 1;
    result[monthIdx] = {
      tradeBased: {
        stt: fromPaise(r.stt_paise),
        stampDuty: fromPaise(r.stamp_duty_paise),
        exchangeCharges: fromPaise(r.exchange_charges_paise),
        gst: fromPaise(r.gst_paise),
        sebiCharges: fromPaise(r.sebi_charges_paise),
        ipft: fromPaise(r.ipft_paise),
        brokerage: fromPaise(r.brokerage_paise),
        otherCharges: fromPaise(r.other_trade_charges_paise)
      },
      ledgerBased: {
        mtfCharges: fromPaise(r.mtf_charges_paise),
        mtfInterest: fromPaise(r.mtf_interest_paise),
        marginInterest: fromPaise(r.margin_interest_paise),
        dpCharges: fromPaise(r.dp_charges_paise),
        amcMaintenance: fromPaise(r.amc_maintenance_paise),
        ddpiCharges: fromPaise(r.ddpi_charges_paise),
        delayedPayment: fromPaise(r.delayed_payment_paise),
        autoSquareOff: fromPaise(r.auto_square_off_paise)
      },
      totalTaxes: fromPaise(r.total_taxes_paise),
      isManualOverride: Boolean(r.is_manual_override)
    };
  });

  return result;
}

export function saveMonthlyTaxRecord(portfolioId, year, monthIndex, data) {
  const db = getDatabase();
  const pid = portfolioId || 'default';
  const numYear = parseInt(year, 10) || 2026;
  const numMonth = parseInt(monthIndex, 10) + 1; // 1-indexed (1..12)
  const now = new Date().toISOString();
  const id = `tax-${pid}-${numYear}-${numMonth}`;

  db.prepare(`
    INSERT OR IGNORE INTO portfolios (id, name, currency, base_capital_paise, is_default, display_order, created_at, updated_at)
    VALUES (?, 'My Portfolio', 'INR', 10000000, 1, 0, ?, ?)
  `).run(pid, now, now);

  const tb = data.tradeBased || {};
  const lb = data.ledgerBased || {};
  const totalPaise = toPaise(data.totalTaxes);

  db.prepare(`
    INSERT INTO monthly_tax_records (
      id, portfolio_id, year, month,
      stt_paise, stamp_duty_paise, exchange_charges_paise, gst_paise,
      sebi_charges_paise, ipft_paise, brokerage_paise, other_trade_charges_paise,
      mtf_charges_paise, mtf_interest_paise, margin_interest_paise, dp_charges_paise,
      amc_maintenance_paise, ddpi_charges_paise, delayed_payment_paise, auto_square_off_paise,
      total_taxes_paise, is_manual_override, created_at, updated_at, deleted_at
    ) VALUES (
      @id, @portfolio_id, @year, @month,
      @stt_paise, @stamp_duty_paise, @exchange_charges_paise, @gst_paise,
      @sebi_charges_paise, @ipft_paise, @brokerage_paise, @other_trade_charges_paise,
      @mtf_charges_paise, @mtf_interest_paise, @margin_interest_paise, @dp_charges_paise,
      @amc_maintenance_paise, @ddpi_charges_paise, @delayed_payment_paise, @auto_square_off_paise,
      @total_taxes_paise, @is_manual_override, @created_at, @updated_at, NULL
    )
    ON CONFLICT(portfolio_id, year, month) DO UPDATE SET
      stt_paise = excluded.stt_paise,
      stamp_duty_paise = excluded.stamp_duty_paise,
      exchange_charges_paise = excluded.exchange_charges_paise,
      gst_paise = excluded.gst_paise,
      sebi_charges_paise = excluded.sebi_charges_paise,
      ipft_paise = excluded.ipft_paise,
      brokerage_paise = excluded.brokerage_paise,
      other_trade_charges_paise = excluded.other_trade_charges_paise,
      mtf_charges_paise = excluded.mtf_charges_paise,
      mtf_interest_paise = excluded.mtf_interest_paise,
      margin_interest_paise = excluded.margin_interest_paise,
      dp_charges_paise = excluded.dp_charges_paise,
      amc_maintenance_paise = excluded.amc_maintenance_paise,
      ddpi_charges_paise = excluded.ddpi_charges_paise,
      delayed_payment_paise = excluded.delayed_payment_paise,
      auto_square_off_paise = excluded.auto_square_off_paise,
      total_taxes_paise = excluded.total_taxes_paise,
      is_manual_override = excluded.is_manual_override,
      updated_at = excluded.updated_at
  `).run({
    id,
    portfolio_id: pid,
    year: numYear,
    month: numMonth,
    stt_paise: toPaise(tb.stt),
    stamp_duty_paise: toPaise(tb.stampDuty),
    exchange_charges_paise: toPaise(tb.exchangeCharges),
    gst_paise: toPaise(tb.gst),
    sebi_charges_paise: toPaise(tb.sebiCharges),
    ipft_paise: toPaise(tb.ipft),
    brokerage_paise: toPaise(tb.brokerage),
    other_trade_charges_paise: toPaise(tb.otherCharges),
    mtf_charges_paise: toPaise(lb.mtfCharges),
    mtf_interest_paise: toPaise(lb.mtfInterest),
    margin_interest_paise: toPaise(lb.marginInterest),
    dp_charges_paise: toPaise(lb.dpCharges),
    amc_maintenance_paise: toPaise(lb.amcMaintenance),
    ddpi_charges_paise: toPaise(lb.ddpiCharges),
    delayed_payment_paise: toPaise(lb.delayedPayment),
    auto_square_off_paise: toPaise(lb.autoSquareOff),
    total_taxes_paise: totalPaise,
    is_manual_override: data.isManualOverride ? 1 : 0,
    created_at: now,
    updated_at: now
  });

  return getMonthlyTaxRecords(pid, numYear);
}
