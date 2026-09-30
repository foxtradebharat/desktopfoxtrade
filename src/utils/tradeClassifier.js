/**
 * Trade Playbook & Mistake Classifier Engine for Foxy AI
 * Institutional rule-based + heuristic classifier matching TradeZella AI behavioral taxonomy
 */

export const MISTAKE_TAXONOMY = {
  AVERAGED_DOWN: 'Averaged Down on Loser',
  PANIC_SELL: 'Panic Sell / Shaken Out',
  IMPULSIVE_RANDOM: 'Impulsive Entry / No Setup',
  PLAN_VIOLATION: 'Plan Violation',
  NO_STOP_LOSS: 'No Stop Loss / Naked Risk',
  EARLY_EXIT: 'Cut Winner Early (<1R)',
  IGNORED_SL: 'Ignored SL / Excessive Bleed',
  FOMO_CHASED: 'FOMO / Chased Entry',
  REVENGE_TRADE: 'Revenge Trade',
  OVERSIZED: 'Oversized Position (>2.5% Risk)',
  CLEAN_EXECUTION: 'Clean Execution'
};

export const PLAYBOOK_TAXONOMY = {
  REVERSAL: 'Reversal',
  PULLBACK: 'Pullback',
  BREAKOUT: 'Breakout',
  IPO_BASE: 'IPO Base',
  CHEAT: 'Cheat',
  FLAG: 'Flag',
  CONTINUATION: 'Continuation',
  DISCRETIONARY: 'Discretionary'
};

export function classifyTrade(trade, priorTrade = null) {
  const pnl = Number(trade.pnl ?? trade.pl ?? 0);
  const r = parseFloat(trade.rewardRisk ?? trade.rMultiple);
  const holdingDays = Number(trade.holdingDays || 0);
  const plan = trade.planFollowed;
  const exitTrigger = String(trade.exitTrigger || '').trim();
  const rawNote = String(trade.quickNote || trade.notes || '').toLowerCase();
  const existingGrowth = String(trade.growthAreas || '').trim();
  const setup = String(trade.setup || '').trim();
  const sl = Number(trade.sl || trade.stopLoss || 0);
  const e1 = Number(trade.e1Price || trade.entry || 0);
  const e2 = Number(trade.e2Price || 0);
  const capitalAtRisk = parseFloat(trade.capitalAtRisk || 0);

  let mistakeTag = MISTAKE_TAXONOMY.CLEAN_EXECUTION;
  let severity = 'LOW';
  let score = 90;
  const reasons = [];

  // Check 1: Averaging Down on Loser
  if (e2 > 0 && e2 < e1 && pnl < 0) {
    mistakeTag = MISTAKE_TAXONOMY.AVERAGED_DOWN;
    severity = 'CRITICAL';
    score -= 40;
    reasons.push('Added second entry (e2) below first entry on a losing trade.');
  }
  // Check 2: Ignored SL / Excessive Bleed
  else if (pnl < 0 && !isNaN(r) && r <= -1.4) {
    mistakeTag = MISTAKE_TAXONOMY.IGNORED_SL;
    severity = 'CRITICAL';
    score -= 35;
    reasons.push(`Loss exceeded planned stop loss by ${Math.abs(r).toFixed(1)}R.`);
  }
  // Check 3: No Stop Loss
  else if (sl <= 0 && trade.status !== 'Draft') {
    mistakeTag = MISTAKE_TAXONOMY.NO_STOP_LOSS;
    severity = 'HIGH';
    score -= 30;
    reasons.push('Position entered with zero stop loss protection.');
  }
  // Check 4: Panic Sell
  else if (exitTrigger.toLowerCase().includes('panic') || (holdingDays <= 1 && pnl < 0 && !isNaN(r) && r > -0.5 && r < 0)) {
    mistakeTag = MISTAKE_TAXONOMY.PANIC_SELL;
    severity = 'HIGH';
    score -= 25;
    reasons.push('Exited trade prematurely in panic before structural stop was tested.');
  }
  // Check 5: Revenge Trade
  else if (priorTrade && Number(priorTrade.pnl ?? 0) < 0) {
    const curDate = new Date(trade.date || 0);
    const prevDate = new Date(priorTrade.date || 0);
    const dayDiff = Math.abs((curDate - prevDate) / (1000 * 60 * 60 * 24));
    if (dayDiff <= 1 && ((trade.name || trade.symbol) === (priorTrade.name || priorTrade.symbol) || pnl < 0)) {
      mistakeTag = MISTAKE_TAXONOMY.REVENGE_TRADE;
      severity = 'HIGH';
      score -= 30;
      reasons.push('Entered within 24 hours of a prior loss.');
    }
  }
  // Check 6: FOMO / Chased
  if (mistakeTag === MISTAKE_TAXONOMY.CLEAN_EXECUTION) {
    if (rawNote.includes('fomo') || rawNote.includes('chase') || rawNote.includes('late') || existingGrowth.includes('FOMO') || existingGrowth.includes('Late Entry')) {
      mistakeTag = MISTAKE_TAXONOMY.FOMO_CHASED;
      severity = 'HIGH';
      score -= 25;
      reasons.push('Trade note or record indicates late FOMO entry.');
    }
  }
  // Check 7: Plan Violation
  if (mistakeTag === MISTAKE_TAXONOMY.CLEAN_EXECUTION) {
    if (plan === false || plan === 'No' || plan === 'false') {
      mistakeTag = MISTAKE_TAXONOMY.PLAN_VIOLATION;
      severity = 'MEDIUM';
      score -= 20;
      reasons.push('Trade plan was explicitly marked as NOT followed.');
    }
  }
  // Check 8: Impulsive / Random
  if (mistakeTag === MISTAKE_TAXONOMY.CLEAN_EXECUTION) {
    if (exitTrigger === 'Random' || setup === '-' || !setup) {
      mistakeTag = MISTAKE_TAXONOMY.IMPULSIVE_RANDOM;
      severity = 'MEDIUM';
      score -= 20;
      reasons.push('Exit trigger logged as Random with no structured playbook setup.');
    }
  }
  // Check 9: Oversized Position
  if (capitalAtRisk > 2.5) {
    if (mistakeTag === MISTAKE_TAXONOMY.CLEAN_EXECUTION) {
      mistakeTag = MISTAKE_TAXONOMY.OVERSIZED;
      severity = 'HIGH';
    }
    score -= 15;
    reasons.push(`Capital at risk was ${capitalAtRisk.toFixed(1)}%, exceeding the 2% safety threshold.`);
  }
  // Check 10: Early Exit on Winner
  if (pnl > 0 && !isNaN(r) && r > 0 && r < 0.8 && holdingDays <= 2 && exitTrigger !== 'Target') {
    if (mistakeTag === MISTAKE_TAXONOMY.CLEAN_EXECUTION) {
      mistakeTag = MISTAKE_TAXONOMY.EARLY_EXIT;
      severity = 'LOW';
      score -= 10;
      reasons.push(`Captured only +${r.toFixed(1)}R before exiting, leaving major upside.`);
    }
  }

  // Playbook Recommendation
  let recommendedPlaybook = setup && setup !== '-' ? setup : PLAYBOOK_TAXONOMY.DISCRETIONARY;
  if (!setup || setup === '-' || setup === 'Discretionary') {
    if (holdingDays > 10) recommendedPlaybook = PLAYBOOK_TAXONOMY.CONTINUATION;
    else if (holdingDays >= 2) recommendedPlaybook = PLAYBOOK_TAXONOMY.PULLBACK;
    else recommendedPlaybook = PLAYBOOK_TAXONOMY.BREAKOUT;
  }

  score = Math.max(10, Math.min(100, score));

  return {
    tradeId: trade.id,
    tradeNo: trade.tradeNo,
    symbol: trade.name || trade.symbol,
    date: trade.date,
    pnl: Math.round(pnl),
    rewardRisk: !isNaN(r) ? r.toFixed(2) : '-',
    currentSetup: setup || '-',
    recommendedPlaybook,
    currentMistake: existingGrowth || '-',
    detectedMistake: mistakeTag,
    severity,
    executionScore: score,
    reasons
  };
}

export function classifyTradesBatch(trades = []) {
  const sorted = [...trades].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  const results = [];
  for (let i = 0; i < sorted.length; i++) {
    const prior = i > 0 ? sorted[i - 1] : null;
    results.push(classifyTrade(sorted[i], prior));
  }
  return results;
}

export function summarizeClassification(classifiedTrades = []) {
  const mistakeCounts = {};
  let totalMistakeBleed = 0;
  let totalTrades = classifiedTrades.length;
  let cleanTrades = 0;

  classifiedTrades.forEach(c => {
    if (c.detectedMistake === MISTAKE_TAXONOMY.CLEAN_EXECUTION) {
      cleanTrades++;
    } else {
      mistakeCounts[c.detectedMistake] = (mistakeCounts[c.detectedMistake] || 0) + 1;
      if (c.pnl < 0) totalMistakeBleed += Math.abs(c.pnl);
    }
  });

  const sortedMistakes = Object.entries(mistakeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([mistake, count]) => ({ mistake, count }));

  const avgExecutionScore = totalTrades > 0
    ? Math.round(classifiedTrades.reduce((acc, c) => acc + c.executionScore, 0) / totalTrades)
    : 100;

  return {
    totalTrades,
    cleanTrades,
    mistakeTrades: totalTrades - cleanTrades,
    avgExecutionScore,
    totalMistakeBleed: Math.round(totalMistakeBleed),
    topMistakes: sortedMistakes
  };
}
