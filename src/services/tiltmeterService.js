/**
 * Real-Time Institutional Tiltmeter & Psychology Guard Service
 * 
 * Monitors emotional biases and trading psychology leaks:
 * 1. Consecutive Loss Spirals (2 or 3+ losses in a row)
 * 2. Loss Recovery Size Spikes (Revenge sizing >1.5x)
 * 3. Same-Symbol Rapid Revenge Re-entry (Re-entering stopped-out scrip immediately)
 * 4. Stop-Loss Removal / Unprotected Open Exposure
 * 5. Averaging Down on Losing Positions
 * 6. Disposition Effect (Holding losers significantly longer than winners)
 * 7. Session Overtrading relative to trader's baseline
 */

function parseDateTs(s) {
  if (!s) return 0;
  if (s instanceof Date) return s.getTime();
  const d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

export function calculateTiltmeterScore(trades = []) {
  if (!trades || trades.length === 0) {
    return {
      status: 'CALM',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.1)',
      score: 10,
      triggers: [],
      verdict: 'Trading with balanced psychology. No emotional triggers detected.',
      action: 'Continue executing your setup rules.'
    };
  }

  const triggers = [];
  let riskScore = 10;

  // Look at latest 15 trades for short-term behavioural patterns
  const recentTrades = [...trades].slice(-15);

  // 1. Consecutive Losses
  let consecutiveLosses = 0;
  for (let i = recentTrades.length - 1; i >= 0; i--) {
    const pnl = Number(recentTrades[i].pnl ?? recentTrades[i].pl ?? 0);
    if (pnl < 0) {
      consecutiveLosses++;
    } else if (pnl > 0) {
      break;
    }
  }

  if (consecutiveLosses >= 3) {
    riskScore += 35;
    triggers.push({
      level: 'HIGH',
      title: `${consecutiveLosses} Consecutive Losses Detected`,
      desc: 'Emotional pressure is elevated. High risk of revenge trading.'
    });
  } else if (consecutiveLosses === 2) {
    riskScore += 15;
    triggers.push({
      level: 'MED',
      title: '2 Consecutive Losses',
      desc: 'Pause for 15 minutes before considering another entry.'
    });
  }

  // 2. Sizing Spikes (Revenge Position Sizing)
  for (let i = 1; i < recentTrades.length; i++) {
    const prev = recentTrades[i - 1];
    const curr = recentTrades[i];
    const prevPnl = Number(prev.pnl ?? prev.pl ?? 0);
    const prevQty = Number(prev.qty || 1);
    const currQty = Number(curr.qty || 1);

    if (prevPnl < 0 && currQty >= prevQty * 1.5) {
      riskScore += 25;
      triggers.push({
        level: 'HIGH',
        title: 'Revenge Size Spike',
        desc: `Position size increased by ${Math.round((currQty / prevQty) * 100)}% (${currQty} vs ${prevQty}) immediately after a loss.`
      });
      break;
    }
  }

  // 3. Same-Symbol Rapid Revenge Re-entry
  for (let i = 1; i < recentTrades.length; i++) {
    const prev = recentTrades[i - 1];
    const curr = recentTrades[i];
    const prevPnl = Number(prev.pnl ?? prev.pl ?? 0);
    const prevSym = (prev.name || prev.symbol || '').toUpperCase();
    const currSym = (curr.name || curr.symbol || '').toUpperCase();

    if (prevPnl < 0 && prevSym && prevSym === currSym) {
      const timeDiffMs = Math.abs(parseDateTs(curr.date) - parseDateTs(prev.date));
      // Within 2 hours or same day
      if (timeDiffMs <= 2 * 60 * 60 * 1000 || curr.date === prev.date) {
        riskScore += 25;
        triggers.push({
          level: 'HIGH',
          title: `Same-Symbol Revenge: ${currSym}`,
          desc: `Re-entered ${currSym} immediately after suffering a loss. High risk of emotional attachment.`
        });
        break;
      }
    }
  }

  // 4. Unprotected Positions (Open positions with NO Stop-Loss)
  const openWithoutSl = trades.filter(t => 
    (t.status === 'Open' || (t.status === 'Partial' && Number(t.openQty || 0) > 0)) && 
    Number(t.avgEntry || t.entry || 0) > 0 && 
    (!t.sl || Number(t.sl) === 0)
  );

  if (openWithoutSl.length > 0) {
    riskScore += 20;
    triggers.push({
      level: 'HIGH',
      title: `${openWithoutSl.length} Unprotected Position(s) Without Stop-Loss`,
      desc: `Open trades in [${openWithoutSl.map(t => t.name || t.symbol).join(', ')}] have no active stop-loss defined.`
    });
  }

  // 5. Averaging Down on Losing Trades
  const avgDownTrades = recentTrades.filter(t => 
    Number(t.e2Price || 0) > 0 && 
    Number(t.e2Price) < Number(t.e1Price || t.entry || 0) && 
    Number(t.pnl ?? t.pl ?? 0) < 0
  );

  if (avgDownTrades.length > 0) {
    riskScore += 20;
    triggers.push({
      level: 'MED',
      title: 'Averaging Down Pattern',
      desc: 'Attempted to lower cost basis on losing positions instead of cutting losses at initial stop.'
    });
  }

  // 6. Disposition Effect (Holding losers significantly longer than winners)
  const closedWins = trades.filter(t => (t.status === 'Closed' || t.status === 'Partial') && Number(t.pnl ?? t.pl ?? 0) > 0);
  const closedLosses = trades.filter(t => (t.status === 'Closed' || t.status === 'Partial') && Number(t.pnl ?? t.pl ?? 0) < 0);

  if (closedWins.length >= 3 && closedLosses.length >= 3) {
    const avgWinHolding = closedWins.reduce((s, t) => s + Number(t.holdingDays || 0), 0) / closedWins.length;
    const avgLossHolding = closedLosses.reduce((s, t) => s + Number(t.holdingDays || 0), 0) / closedLosses.length;

    if (avgLossHolding > Math.max(1, avgWinHolding * 1.8) && avgLossHolding >= 2) {
      riskScore += 15;
      triggers.push({
        level: 'MED',
        title: 'Disposition Effect Warning',
        desc: `Holding losing trades (${avgLossHolding.toFixed(1)} days avg) nearly 2x longer than winning trades (${avgWinHolding.toFixed(1)} days avg).`
      });
    }
  }

  // 7. Dynamic Session Overtrading Check
  const lastDate = recentTrades[recentTrades.length - 1]?.date ? String(recentTrades[recentTrades.length - 1].date).slice(0, 10) : '';
  const todayTrades = lastDate ? recentTrades.filter(t => String(t.date || '').slice(0, 10) === lastDate) : [];
  
  if (todayTrades.length >= 6) {
    riskScore += 25;
    triggers.push({
      level: 'HIGH',
      title: 'Session Overtrading Warning',
      desc: `${todayTrades.length} trades executed in current session. Diminishing edge and decision fatigue.`
    });
  } else if (todayTrades.length >= 4) {
    riskScore += 15;
    triggers.push({
      level: 'MED',
      title: 'Elevated Session Activity',
      desc: `${todayTrades.length} trades today. Approaching maximum daily allocation.`
    });
  }

  // Cap score between 10 and 100
  riskScore = Math.min(Math.max(riskScore, 10), 100);

  let status = 'CALM';
  let color = '#10b981';
  let bg = 'rgba(16, 185, 129, 0.1)';
  let verdict = 'Trading mind is clear. Disciplined execution in progress.';
  let action = 'Stick to your daily trade plan.';

  if (riskScore >= 60) {
    status = 'TILT DETECTED';
    color = '#ef4444';
    bg = 'rgba(239, 68, 68, 0.12)';
    verdict = 'High emotional distortion detected. Stepping away from terminals is strongly recommended.';
    action = 'STOP TRADING. Take a 30-minute break or shut down for the day.';
  } else if (riskScore >= 35) {
    status = 'CAUTION';
    color = '#f59e0b';
    bg = 'rgba(245, 158, 11, 0.12)';
    verdict = 'Subtle psychological drift detected. Risk of forced setups.';
    action = 'Reduce next position size by 50% and wait for A+ setups only.';
  }

  return {
    status,
    color,
    bg,
    score: riskScore,
    triggers,
    verdict,
    action,
    consecutiveLosses,
    todayTradesCount: todayTrades.length
  };
}
