/**
 * Date parsing helper
 * Supports YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY
 * @param {string|Date} s
 * @returns {Date|null}
 */
function parseDate(s) {
  if (!s) return null;
  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(s));
  if (ymd) return new Date(+ymd[1], +ymd[2]-1, +ymd[3]);
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(String(s));
  if (dmy) return new Date(+dmy[3], +dmy[2]-1, +dmy[1]);
  const d = new Date(s); return isNaN(d) ? null : d;
}

/**
 * Computes position risk based on entry, stop loss, target, quantity, and portfolio capital.
 * @param {number} entryPrice
 * @param {number} slPrice
 * @param {number} targetPrice
 * @param {number} qty
 * @param {number} portfolioCapital
 * @returns {Object}
 */
export function computePositionRisk(entryPrice, slPrice, targetPrice, qty, portfolioCapital) {
  const slDistance = Math.abs(entryPrice - slPrice);
  const capitalAtRisk = portfolioCapital ? ((slDistance * qty) / portfolioCapital) * 100 : 0;
  const projectedRR = slDistance === 0 ? 0 : Math.abs(targetPrice - entryPrice) / slDistance;
  const recommended1pctQty = slDistance === 0 ? 0 : Math.floor(portfolioCapital * 0.01 / slDistance);
  const recommended2pctQty = slDistance === 0 ? 0 : Math.floor(portfolioCapital * 0.02 / slDistance);
  const dollarRisk = slDistance * qty;
  const positionValue = entryPrice * qty;
  const positionAsPortfolioPct = portfolioCapital ? (positionValue / portfolioCapital) * 100 : 0;

  return {
    slDistance,
    capitalAtRisk,
    projectedRR,
    recommended1pctQty,
    recommended2pctQty,
    dollarRisk,
    positionValue,
    positionAsPortfolioPct
  };
}

/**
 * Analyzes last 20 closed trades sorted by date descending to get behavioral state.
 * @param {Array} trades
 * @returns {Object}
 */
export function getBehavioralState(trades) {
  const closedTrades = (trades || [])
    .filter(t => t.status === 'Closed' || t.closedWithPnl !== undefined)
    .map(t => ({
      ...t,
      parsedDate: parseDate(t.date || t.closedDate || t.entryDate)
    }))
    .sort((a, b) => {
      if (!a.parsedDate && !b.parsedDate) return 0;
      if (!a.parsedDate) return 1;
      if (!b.parsedDate) return -1;
      return b.parsedDate - a.parsedDate;
    });

  const last20 = closedTrades.slice(0, 20);
  
  let recentStreak = { type: null, count: 0 };
  if (last20.length > 0) {
    const isWin = (t) => (t.realizedPnl && t.realizedPnl > 0) || (t.closedWithPnl && t.closedWithPnl > 0);
    recentStreak.type = isWin(last20[0]) ? 'WIN' : 'LOSS';
    for (let t of last20) {
      if ((recentStreak.type === 'WIN' && isWin(t)) || (recentStreak.type === 'LOSS' && !isWin(t))) {
        recentStreak.count++;
      } else {
        break;
      }
    }
  }

  // Revenge trading risk
  // based on % of times next trade was entered within 2 calendar days after a loss
  let revengeTradingRisk = 'LOW';
  let lossCount = 0;
  let revengeCount = 0;
  for (let i = 0; i < closedTrades.length - 1; i++) {
    const t = closedTrades[i]; // newer trade
    const prev = closedTrades[i + 1]; // older trade
    if (prev && (!prev.realizedPnl || prev.realizedPnl < 0) && (!prev.closedWithPnl || prev.closedWithPnl < 0)) {
      lossCount++;
      if (t.parsedDate && prev.parsedDate) {
        const diffTime = Math.abs(t.parsedDate - prev.parsedDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 2) {
          revengeCount++;
        }
      }
    }
  }
  
  if (lossCount > 0) {
    const revengePct = revengeCount / lossCount;
    if (revengePct > 0.5) revengeTradingRisk = 'HIGH';
    else if (revengePct > 0.2) revengeTradingRisk = 'MEDIUM';
  }

  // Oversizing risk
  let oversizingRisk = 'LOW';
  if (closedTrades.length >= 5) {
    const getPosValue = (t) => t.positionValue || ((t.qty || t.quantity || 0) * (t.entryPrice || t.avgEntry || 0));
    const overallAvg = closedTrades.reduce((sum, t) => sum + getPosValue(t), 0) / closedTrades.length;
    const last5Avg = closedTrades.slice(0, 5).reduce((sum, t) => sum + getPosValue(t), 0) / 5;
    if (overallAvg > 0 && (last5Avg / overallAvg) > 1.4) {
      oversizingRisk = 'HIGH';
    }
  }

  // Day of week stats
  const dayOfWeekStats = {};
  for (let i = 0; i < 7; i++) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    dayOfWeekStats[i] = { day: days[i], winRate: 0, trades: 0, wins: 0 };
  }
  
  closedTrades.forEach(t => {
    if (t.parsedDate) {
      const day = t.parsedDate.getDay();
      dayOfWeekStats[day].trades++;
      if ((t.realizedPnl && t.realizedPnl > 0) || (t.closedWithPnl && t.closedWithPnl > 0)) {
        dayOfWeekStats[day].wins++;
      }
    }
  });
  
  for (let i = 0; i < 7; i++) {
    if (dayOfWeekStats[i].trades > 0) {
      dayOfWeekStats[i].winRate = (dayOfWeekStats[i].wins / dayOfWeekStats[i].trades) * 100;
    }
  }

  const currentDayOfWeek = new Date().getDay();
  const currentDayWinRate = dayOfWeekStats[currentDayOfWeek].winRate;
  
  let lastLossDate = null;
  const lastLoss = closedTrades.find(t => (t.realizedPnl && t.realizedPnl < 0) || (t.closedWithPnl && t.closedWithPnl < 0));
  if (lastLoss) {
    if (lastLoss.parsedDate) {
      lastLossDate = lastLoss.parsedDate.toISOString().split('T')[0];
    } else {
      lastLossDate = lastLoss.date || lastLoss.closedDate || lastLoss.entryDate;
    }
  }

  return {
    recentStreak,
    revengeTradingRisk,
    oversizingRisk,
    dayOfWeekStats,
    currentDayOfWeek,
    currentDayWinRate,
    lastLossDate
  };
}

/**
 * Gets historical stats for a specific setup.
 * @param {Array} trades
 * @param {string} setupTag
 * @param {number} dayOfWeek
 * @returns {Object}
 */
export function getSetupHistoricalStats(trades, setupTag, dayOfWeek) {
  let closed = (trades || []).filter(t => t.status === 'Closed' || t.closedWithPnl !== undefined);
  
  let subset = closed.filter(t => {
    const sTag = (setupTag || '').toLowerCase();
    if (!sTag) return false;
    if (t.setup && String(t.setup).toLowerCase().includes(sTag)) return true;
    if (t.setupTag && String(t.setupTag).toLowerCase().includes(sTag)) return true;
    if (Array.isArray(t.setupTags) && t.setupTags.some(s => String(s).toLowerCase().includes(sTag))) return true;
    return false;
  });

  if (!subset.length) {
    subset = closed;
  }

  let wins = 0;
  let totalRMultiple = 0;
  let rCount = 0;
  let holdingDaysSum = 0;
  let holdingCount = 0;

  const dayOfWeekStats = {};
  for (let i = 0; i < 7; i++) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    dayOfWeekStats[i] = { day: days[i], winRate: 0, trades: 0, wins: 0 };
  }

  subset.forEach(t => {
    const isWin = (t.realizedPnl && t.realizedPnl > 0) || (t.closedWithPnl && t.closedWithPnl > 0);
    if (isWin) wins++;

    if (t.rewardRisk !== undefined) {
      totalRMultiple += Number(t.rewardRisk);
      rCount++;
    }

    const entry = parseDate(t.entryDate || t.date);
    const exit = parseDate(t.closedDate || t.exitDate || t.date);
    if (entry && exit) {
      const diffTime = Math.abs(exit - entry);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      holdingDaysSum += diffDays;
      holdingCount++;
    }

    let parsedDate = entry;
    if (parsedDate) {
      const day = parsedDate.getDay();
      dayOfWeekStats[day].trades++;
      if (isWin) dayOfWeekStats[day].wins++;
    }
  });

  const totalTrades = subset.length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const avgRMultiple = rCount > 0 ? totalRMultiple / rCount : 0;
  const avgHoldingDays = holdingCount > 0 ? holdingDaysSum / holdingCount : 0;

  let bestDayOfWeek = null;
  let worstDayOfWeek = null;
  let bestWR = -1;
  let worstWR = 101;

  for (let i = 0; i < 7; i++) {
    if (dayOfWeekStats[i].trades > 0) {
      dayOfWeekStats[i].winRate = (dayOfWeekStats[i].wins / dayOfWeekStats[i].trades) * 100;
      if (dayOfWeekStats[i].winRate > bestWR) {
        bestWR = dayOfWeekStats[i].winRate;
        bestDayOfWeek = dayOfWeekStats[i].day;
      }
      if (dayOfWeekStats[i].winRate < worstWR) {
        worstWR = dayOfWeekStats[i].winRate;
        worstDayOfWeek = dayOfWeekStats[i].day;
      }
    }
  }

  return {
    winRate,
    avgRMultiple,
    totalTrades,
    avgHoldingDays,
    dayOfWeekStats,
    bestDayOfWeek,
    worstDayOfWeek
  };
}

/**
 * Gets sector concentration stats.
 * @param {Array} trades
 * @param {string} symbol
 * @returns {Object}
 */
export function getSectorConcentration(trades, symbol) {
  const openTrades = (trades || []).filter(t => (t.status === 'Open' || t.status === 'Partial') && (t.openQty || t.quantity) > 0);
  const symbolAlreadyOpen = openTrades.some(t => ((t.name || t.symbol || '').toUpperCase()) === (symbol || '').toUpperCase());
  const openPositionsCount = openTrades.length;
  const totalOpenRisk = openTrades.reduce((sum, t) => sum + (Number(t.capitalAtRisk) || 0), 0);
  const openCapital = openTrades.reduce((sum, t) => sum + ((t.openQty || t.quantity || 0) * (t.avgEntry || t.entry || t.entryPrice || 0)), 0);

  return {
    symbolAlreadyOpen,
    openPositionsCount,
    totalOpenRisk,
    openCapital
  };
}

/**
 * Generates a verdict based on risk parameters.
 * @param {Object} scores
 * @returns {Object}
 */
export function generateVerdict({ capitalAtRisk, projectedRR, behavioralState, setupStats, concentration }) {
  let score = 100;
  let keyRisks = [];
  let recommendations = [];

  if (capitalAtRisk > 4) {
    score -= 30;
    keyRisks.push(`Capital at risk (${capitalAtRisk.toFixed(2)}%) exceeds 4%.`);
    recommendations.push('Significantly reduce position size to align with a max 2-3% risk parameter.');
  } else if (capitalAtRisk > 2.5) {
    score -= 15;
    keyRisks.push(`Capital at risk (${capitalAtRisk.toFixed(2)}%) exceeds 2.5%.`);
    recommendations.push('Consider reducing position size slightly to mitigate downside exposure.');
  } else if (capitalAtRisk > 1.5) {
    score -= 5;
    keyRisks.push(`Capital at risk (${capitalAtRisk.toFixed(2)}%) is somewhat high (>1.5%).`);
  }

  if (projectedRR < 1.0) {
    score -= 30;
    keyRisks.push(`Projected R:R (${projectedRR.toFixed(2)}) is less than 1.0.`);
    recommendations.push('Re-evaluate target and stop loss. Trade does not offer enough reward for the risk taken.');
  } else if (projectedRR < 1.5) {
    score -= 15;
    keyRisks.push(`Projected R:R (${projectedRR.toFixed(2)}) is less than 1.5.`);
    recommendations.push('Look for better entry or tighter stop loss to improve R:R profile.');
  } else if (projectedRR < 2.0) {
    score -= 5;
    keyRisks.push(`Projected R:R (${projectedRR.toFixed(2)}) is less than 2.0.`);
  }

  if (behavioralState && behavioralState.revengeTradingRisk === 'HIGH') {
    score -= 20;
    keyRisks.push('High risk of revenge trading detected.');
    recommendations.push('Step away from the screens. Wait for a clear setup or reduce size dramatically.');
  } else if (behavioralState && behavioralState.revengeTradingRisk === 'MEDIUM') {
    score -= 10;
    keyRisks.push('Medium risk of revenge trading detected.');
    recommendations.push('Ensure this trade aligns strictly with your plan and isn\'t forced.');
  }

  if (behavioralState && behavioralState.recentStreak && behavioralState.recentStreak.type === 'LOSS') {
    if (behavioralState.recentStreak.count >= 3) {
      score -= 15;
      keyRisks.push(`Current losing streak is ${behavioralState.recentStreak.count} trades.`);
      recommendations.push('You are on a significant losing streak. Cut position size in half until you log a winning trade.');
    } else if (behavioralState.recentStreak.count >= 2) {
      score -= 8;
      keyRisks.push(`Current losing streak is ${behavioralState.recentStreak.count} trades.`);
    }
  }

  if (behavioralState && behavioralState.currentDayWinRate !== undefined) {
    if (behavioralState.currentDayWinRate < 35) {
      score -= 15;
      keyRisks.push(`Current day-of-week win rate is poor (${behavioralState.currentDayWinRate.toFixed(1)}%).`);
      recommendations.push('Historically, this day of the week underperforms for you. Proceed with caution or trade smaller.');
    } else if (behavioralState.currentDayWinRate < 45) {
      score -= 8;
      keyRisks.push(`Current day-of-week win rate is below average (${behavioralState.currentDayWinRate.toFixed(1)}%).`);
    }
  }

  if (concentration && concentration.symbolAlreadyOpen) {
    score -= 10;
    keyRisks.push('An open position already exists for this symbol.');
    recommendations.push('Avoid adding to this position unless it\'s a planned pyramid entry. Monitor total risk on this asset.');
  }

  if (concentration && concentration.openPositionsCount >= 6) {
    score -= 10;
    keyRisks.push(`High number of open positions (${concentration.openPositionsCount}).`);
    recommendations.push('You have many open positions. Adding another increases overall portfolio correlation risk.');
  }

  if (setupStats) {
    if (setupStats.winRate < 35) {
      score -= 20;
      keyRisks.push(`Historical win rate for this setup is very low (${setupStats.winRate.toFixed(1)}%).`);
      recommendations.push('This setup has a poor track record. Review whether you should continue trading it or drastically reduce size.');
    } else if (setupStats.winRate < 45) {
      score -= 10;
      keyRisks.push(`Historical win rate for this setup is below average (${setupStats.winRate.toFixed(1)}%).`);
    }

    if (setupStats.totalTrades < 5) {
      score -= 5;
      keyRisks.push(`Low historical sample size for this setup (${setupStats.totalTrades} trades).`);
    }
  }

  let verdict = 'GO';
  let verdictColor = '#16a34a';

  if (score >= 70) {
    verdict = 'GO';
    verdictColor = '#16a34a';
  } else if (score >= 50) {
    verdict = 'REDUCE SIZE';
    verdictColor = '#d97706';
  } else if (score >= 35) {
    verdict = 'CAUTION';
    verdictColor = '#dc2626';
  } else {
    verdict = 'AVOID';
    verdictColor = '#7f1d1d';
  }

  return { verdict, score, verdictColor, keyRisks, recommendations };
}

/**
 * Runs the complete pre-trade screener.
 * @param {Object} params - { symbol, entryPrice, slPrice, targetPrice, quantity, setupTag }
 * @param {Array} trades
 * @param {number} portfolioCapital
 * @returns {Object}
 */
export function runPreTradeScreen(params, trades, portfolioCapital) {
  const { symbol, entryPrice, slPrice, targetPrice, quantity, setupTag } = params || {};

  const positionRisk = computePositionRisk(entryPrice, slPrice, targetPrice, quantity, portfolioCapital);
  const behavioralState = getBehavioralState(trades);
  const currentDayOfWeek = behavioralState.currentDayOfWeek !== undefined ? behavioralState.currentDayOfWeek : new Date().getDay();
  const setupStats = getSetupHistoricalStats(trades, setupTag, currentDayOfWeek);
  const concentration = getSectorConcentration(trades, symbol);

  const verdictResult = generateVerdict({
    capitalAtRisk: positionRisk.capitalAtRisk,
    projectedRR: positionRisk.projectedRR,
    behavioralState,
    setupStats,
    concentration
  });

  return {
    positionRisk,
    behavioralState,
    setupStats,
    concentration,
    verdict: verdictResult,
    screenedAt: new Date().toISOString()
  };
}
