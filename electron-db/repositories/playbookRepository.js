/**
 * electron-db/repositories/playbookRepository.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SQLite repository for Playbook Setups, Checklist Rules, and Trade Audits.
 */

import { getDatabase } from '../database.js';

function genUuid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `pb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get all active playbooks with their checklist rules.
 * @param {string} portfolioId
 * @returns {Array<object>}
 */
export function getPlaybooks(portfolioId = 'default') {
  const db = getDatabase();
  const setups = db.prepare(`
    SELECT * FROM playbook_setups
    WHERE (portfolio_id = ? OR portfolio_id = 'default' OR portfolio_id = 'global')
      AND deleted_at IS NULL
    ORDER BY created_at ASC
  `).all(portfolioId);

  if (setups.length === 0) return [];

  const setupIds = setups.map(s => s.id);
  const placeholders = setupIds.map(() => '?').join(',');
  const rules = db.prepare(`
    SELECT * FROM playbook_setup_rules
    WHERE setup_id IN (${placeholders}) AND deleted_at IS NULL
    ORDER BY display_order ASC, created_at ASC
  `).all(...setupIds);

  const rulesBySetup = new Map();
  rules.forEach(r => {
    if (!rulesBySetup.has(r.setup_id)) rulesBySetup.set(r.setup_id, []);
    rulesBySetup.get(r.setup_id).push(r);
  });

  return setups.map(s => {
    const sRules = rulesBySetup.get(s.id) || [];
    
    // Group rules into Entry, Exit, etc.
    const groupMap = new Map();
    sRules.forEach(r => {
      const gTitle = r.group_title || 'Entry Rules';
      if (!groupMap.has(gTitle)) {
        groupMap.set(gTitle, {
          id: `group-${gTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          title: gTitle,
          rules: []
        });
      }
      groupMap.get(gTitle).rules.push({
        id: r.id,
        text: r.rule_text,
        isRequired: Boolean(r.is_required)
      });
    });

    let applicableSegments = ['EQUITY', 'FUTURES', 'OPTIONS'];
    try {
      if (s.applicable_segments) applicableSegments = JSON.parse(s.applicable_segments);
    } catch (_) {}

    return {
      id: s.id,
      title: s.title,
      slug: s.slug,
      strategyType: s.strategy_type,
      applicableSegments,
      targetWinRate: s.target_win_rate,
      targetRiskReward: s.target_risk_reward,
      icon: s.icon || 'BookOpen',
      colorHex: s.color_hex || '#3b82f6',
      description: s.description || '',
      isActive: Boolean(s.is_active),
      isNoSetup: Boolean(s.is_no_setup),
      ruleGroups: Array.from(groupMap.values()),
      createdAt: s.created_at,
      updatedAt: s.updated_at
    };
  });
}

/**
 * Save (insert or update) a playbook setup with rule groups.
 * @param {object} pb
 * @param {string} [portfolioId]
 */
export function savePlaybook(arg1, arg2 = 'default') {
  let pb, portfolioId;
  if (typeof arg1 === 'string') {
    portfolioId = arg1;
    pb = arg2;
  } else {
    pb = arg1;
    portfolioId = typeof arg2 === 'string' ? arg2 : 'default';
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  const id = pb.id || genUuid();
  const pid = portfolioId || pb.portfolio_id || 'default';

  return db.transaction(() => {
    db.prepare(`
      INSERT OR IGNORE INTO portfolios (id, name, currency, base_capital_paise, is_default, display_order, created_at, updated_at)
      VALUES (?, 'My Portfolio', 'INR', 10000000, 1, 0, ?, ?)
    `).run(pid, now, now);
    db.prepare(`
      INSERT INTO playbook_setups (
        id, portfolio_id, title, slug, strategy_type, applicable_segments,
        target_win_rate, target_risk_reward, icon, color_hex, description,
        is_active, is_no_setup, created_at, updated_at, deleted_at
      ) VALUES (
        @id, @portfolio_id, @title, @slug, @strategy_type, @applicable_segments,
        @target_win_rate, @target_risk_reward, @icon, @color_hex, @description,
        @is_active, @is_no_setup, @created_at, @updated_at, NULL
      )
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        slug = excluded.slug,
        strategy_type = excluded.strategy_type,
        applicable_segments = excluded.applicable_segments,
        target_win_rate = excluded.target_win_rate,
        target_risk_reward = excluded.target_risk_reward,
        icon = excluded.icon,
        color_hex = excluded.color_hex,
        description = excluded.description,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `).run({
      id,
      portfolio_id: pid,
      title: pb.title || 'Untitled Playbook',
      slug: pb.slug || (pb.title ? pb.title.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'untitled'),
      strategy_type: pb.strategyType || 'BREAKOUT',
      applicable_segments: JSON.stringify(pb.applicableSegments || ['EQUITY', 'FUTURES', 'OPTIONS']),
      target_win_rate: pb.targetWinRate || 65.0,
      target_risk_reward: pb.targetRiskReward || 2.0,
      icon: pb.icon || 'BookOpen',
      color_hex: pb.colorHex || '#3b82f6',
      description: pb.description || '',
      is_active: pb.isActive !== false ? 1 : 0,
      is_no_setup: pb.isNoSetup ? 1 : 0,
      created_at: pb.createdAt || now,
      updated_at: now
    });

    // Soft delete existing rules not present in update
    db.prepare(`UPDATE playbook_setup_rules SET deleted_at = ? WHERE setup_id = ?`).run(now, id);

    const insertRule = db.prepare(`
      INSERT INTO playbook_setup_rules (
        id, setup_id, group_title, rule_text, is_required, display_order, created_at, updated_at, deleted_at
      ) VALUES (
        @id, @setup_id, @group_title, @rule_text, @is_required, @display_order, @created_at, @updated_at, NULL
      )
      ON CONFLICT(id) DO UPDATE SET
        group_title = excluded.group_title,
        rule_text = excluded.rule_text,
        is_required = excluded.is_required,
        display_order = excluded.display_order,
        deleted_at = NULL,
        updated_at = excluded.updated_at
    `);

    let order = 0;
    (pb.ruleGroups || []).forEach(group => {
      (group.rules || []).forEach(r => {
        order++;
        insertRule.run({
          id: r.id || `r-${Date.now()}-${order}`,
          setup_id: id,
          group_title: group.title || 'Entry Rules',
          rule_text: r.text || '',
          is_required: r.isRequired !== false ? 1 : 0,
          display_order: order,
          created_at: r.createdAt || now,
          updated_at: now
        });
      });
    });

    return getPlaybooks(pid).find(p => p.id === id);
  })();
}

/**
 * Delete a playbook setup.
 */
export function deletePlaybook(playbookId) {
  const db = getDatabase();
  const now = new Date().toISOString();
  return db.transaction(() => {
    db.prepare(`UPDATE playbook_setups SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(now, now, playbookId);
    db.prepare(`UPDATE playbook_setup_rules SET deleted_at = ?, updated_at = ? WHERE setup_id = ?`).run(now, now, playbookId);
  })();
}

/**
 * Save an audit checklist for a trade.
 * @param {string} tradeId
 * @param {object} auditData
 */
export function saveTradeAudit(tradeId, auditData) {
  const db = getDatabase();
  const now = new Date().toISOString();

  return db.transaction(() => {
    const isNoSetup = auditData.isNoSetup ? 1 : 0;
    const setupId = isNoSetup ? null : (auditData.playbookId || null);
    const score = typeof auditData.disciplineScore === 'number' ? auditData.disciplineScore : 100;
    const ruleExecs = auditData.ruleExecutions || {};

    let totalChecked = 0;
    let followedCount = 0;

    // Save summary record
    db.prepare(`
      INSERT INTO trade_audits (
        trade_id, setup_id, is_no_setup, discipline_score, total_rules_checked,
        rules_followed_count, comment, audited_at, created_at, updated_at, deleted_at
      ) VALUES (
        @trade_id, @setup_id, @is_no_setup, @discipline_score, @total_rules_checked,
        @rules_followed_count, @comment, @audited_at, @created_at, @updated_at, NULL
      )
      ON CONFLICT(trade_id) DO UPDATE SET
        setup_id = excluded.setup_id,
        is_no_setup = excluded.is_no_setup,
        discipline_score = excluded.discipline_score,
        total_rules_checked = excluded.total_rules_checked,
        rules_followed_count = excluded.rules_followed_count,
        comment = excluded.comment,
        audited_at = excluded.audited_at,
        updated_at = excluded.updated_at
    `).run({
      trade_id: tradeId,
      setup_id: setupId,
      is_no_setup: isNoSetup,
      discipline_score: score,
      total_rules_checked: Object.keys(ruleExecs).length,
      rules_followed_count: Object.values(ruleExecs).filter(r => r.isFollowed).length,
      comment: auditData.comment || '',
      audited_at: auditData.auditedAt || now,
      created_at: now,
      updated_at: now
    });

    // Save individual rule checks
    const insertCheck = db.prepare(`
      INSERT INTO trade_rule_checks (
        id, trade_id, setup_id, rule_id, is_followed, notes, created_at, updated_at, deleted_at
      ) VALUES (
        @id, @trade_id, @setup_id, @rule_id, @is_followed, @notes, @created_at, @updated_at, NULL
      )
      ON CONFLICT(trade_id, rule_id) DO UPDATE SET
        is_followed = excluded.is_followed,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `);

    if (setupId) {
      Object.entries(ruleExecs).forEach(([ruleId, exec]) => {
        totalChecked++;
        if (exec.isFollowed) followedCount++;
        insertCheck.run({
          id: `check-${tradeId}-${ruleId}`,
          trade_id: tradeId,
          setup_id: setupId,
          rule_id: ruleId,
          is_followed: exec.isFollowed ? 1 : 0,
          notes: exec.notes || '',
          created_at: now,
          updated_at: now
        });
      });
    }

    return getTradeAudit(tradeId);
  })();
}

/**
 * Fetch audit details for a trade.
 */
export function getTradeAudit(tradeId) {
  const db = getDatabase();
  const audit = db.prepare(`SELECT * FROM trade_audits WHERE trade_id = ? AND deleted_at IS NULL`).get(tradeId);
  if (!audit) return null;

  const checks = db.prepare(`SELECT * FROM trade_rule_checks WHERE trade_id = ? AND deleted_at IS NULL`).all(tradeId);
  const ruleExecutions = {};
  checks.forEach(c => {
    ruleExecutions[c.rule_id] = {
      isFollowed: Boolean(c.is_followed),
      notes: c.notes || ''
    };
  });

  return {
    tradeId: audit.trade_id,
    playbookId: audit.setup_id,
    isNoSetup: Boolean(audit.is_no_setup),
    disciplineScore: audit.discipline_score,
    totalRulesChecked: audit.total_rules_checked,
    rulesFollowedCount: audit.rules_followed_count,
    comment: audit.comment || '',
    auditedAt: audit.audited_at,
    ruleExecutions
  };
}

/**
 * Load all trade audits as a dictionary map for fast UI access.
 */
export function getAllTradeAudits() {
  const db = getDatabase();
  const audits = db.prepare(`SELECT * FROM trade_audits WHERE deleted_at IS NULL`).all();
  const checks = db.prepare(`SELECT * FROM trade_rule_checks WHERE deleted_at IS NULL`).all();

  const checksByTrade = new Map();
  checks.forEach(c => {
    if (!checksByTrade.has(c.trade_id)) checksByTrade.set(c.trade_id, {});
    checksByTrade.get(c.trade_id)[c.rule_id] = { isFollowed: Boolean(c.is_followed) };
  });

  const result = {};
  audits.forEach(a => {
    result[a.trade_id] = {
      tradeId: a.trade_id,
      playbookId: a.setup_id,
      isNoSetup: Boolean(a.is_no_setup),
      disciplineScore: a.discipline_score,
      comment: a.comment || '',
      auditedAt: a.audited_at,
      ruleExecutions: checksByTrade.get(a.trade_id) || {}
    };
  });

  return result;
}
