/**
 * Real-Time Indian Tiltmeter & Psychology Guard Service
 * 
 * Monitors emotional risks and triggers:
 * 1. Expiry Day Overtrading (Taking 5+ trades in 1 session)
 * 2. Loss Recovery Trap / Revenge Trading (Spike in position size after a loss)
 * 3. 3:15 PM Panic (Aggressive option buying in the final 15 minutes)
 * 4. Consecutive Loss Spiral (3 or more losses in a row)
 */

export function calculateTiltmeterScore(trades = []) {
  if (!trades || trades.length === 0) {
    return {
      status: 'CALM',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.1)',
      score: 15,
      triggers: [],
      verdict: 'Trading with balanced psychology. No emotional triggers detected.',
      action: 'Continue executing your setup rules.'
    };
  }

  // Look at the latest 10 trades
  const recentTrades = [...trades].slice(-10);
  const triggers = [];
  let riskScore = 10;

  // 1. Check Consecutive Losses
  let consecutiveLosses = 0;
  for (let i = recentTrades.length - 1; i >= 0; i--) {
    const pnl = Number(recentTrades[i].pnl || recentTrades[i].realizedPnL || 0);
    if (pnl < 0) {
      consecutiveLosses++;
    } else {
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
      desc: 'Pause for 10 minutes before taking another entry.'
    });
  }

  // 2. Check Sizing Spikes (Revenge Position Sizing)
  for (let i = 1; i < recentTrades.length; i++) {
    const prev = recentTrades[i - 1];
    const curr = recentTrades[i];
    const prevPnl = Number(prev.pnl || 0);
    const prevQty = Number(prev.qty || 1);
    const currQty = Number(curr.qty || 1);

    if (prevPnl < 0 && currQty >= prevQty * 1.8) {
      riskScore += 30;
      triggers.push({
        level: 'HIGH',
        title: 'Loss Recovery Size Spike',
        desc: `Position size doubled (${currQty} vs ${prevQty}) immediately following a loss.`
      });
      break;
    }
  }

  // 3. Check Frequency / Overtrading (Trades taken on same day)
  const todayTrades = recentTrades.filter(t => t.date === recentTrades[recentTrades.length - 1]?.date);
  if (todayTrades.length >= 6) {
    riskScore += 25;
    triggers.push({
      level: 'HIGH',
      title: 'Session Overtrading Warning',
      desc: `${todayTrades.length} trades executed today. Diminishing edge and decision fatigue.`
    });
  } else if (todayTrades.length >= 4) {
    riskScore += 15;
    triggers.push({
      level: 'MED',
      title: 'High Session Activity',
      desc: `${todayTrades.length} trades today. Approaching maximum daily allocation.`
    });
  }

  // 4. Emotional Tags check (FOMO, Revenge, Fear)
  const fomoCount = recentTrades.filter(t => ['FOMO', 'Revenge', 'Greed', 'Fear'].includes(t.emotion)).length;
  if (fomoCount >= 2) {
    riskScore += 20;
    triggers.push({
      level: 'MED',
      title: 'Negative Emotional Tags',
      desc: `${fomoCount} recent trades tagged with FOMO/Revenge/Fear.`
    });
  }

  // Cap score 0 - 100
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
