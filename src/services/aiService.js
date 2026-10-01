/**
 * AI TRADE COACH & LOSS DIAGNOSTIC SERVICE
 * 
 * Powered by Google Gemini API.
 * Reads a trader's journal execution history and provides deep behavioural analytics:
 * - "Why you are losing money" (Performance leaks)
 * - Top 3 strategic fixes tailored to the trader
 * - Risk management & Position sizing score
 */

/**
 * Calculate statistical trade log summary for AI context
 */
export function calculateTradeDiagnostics(trades = []) {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      closedTradesCount: 0,
      openPositions: 0,
      winRatePct: 0,
      totalPnL: 0,
      unrealizedPnL: 0,
      avgWin: 0,
      avgLoss: 0,
      winLossRatio: 0,
      maxDrawdownPct: 0,
      holdingTimeWinsDays: 0,
      holdingTimeLossesDays: 0,
      profitGivebackPct: 0,
      hasEnoughData: false
    };
  }

  // Active open positions strictly require openQty > 0
  const openTrades = trades.filter(t => (t.status === 'Open' || t.status === 'Partial') && (Number(t.openQty || 0) > 0));
  const closedTrades = trades.filter(t => t.status === 'Closed');
  
  let totalPnL = 0;
  let winsCount = 0;
  let lossesCount = 0;
  let totalWinPnL = 0;
  let totalLossPnL = 0;

  // Realized Gross P/L includes closed and partial trades (consistent with FoxTrade dashboard)
  trades.forEach(t => {
    if (t.status === 'Closed' || t.status === 'Partial') {
      const pnl = Number(t.realizedPnL ?? t.pnl ?? t.pl ?? 0);
      totalPnL += pnl;
    }
  });

  closedTrades.forEach(t => {
    const pnl = Number(t.realizedPnL ?? t.pnl ?? t.pl ?? 0);
    if (pnl > 0) {
      winsCount++;
      totalWinPnL += pnl;
    } else if (pnl < 0) {
      lossesCount++;
      totalLossPnL += Math.abs(pnl);
    }
  });

  const totalTrades = trades.length;
  const decidedTradesCount = winsCount + lossesCount;
  const winRatePct = decidedTradesCount > 0 ? (winsCount / decidedTradesCount) * 100 : (closedTrades.length > 0 ? (winsCount / closedTrades.length) * 100 : 0);
  const avgWin = winsCount > 0 ? totalWinPnL / winsCount : 0;
  const avgLoss = lossesCount > 0 ? totalLossPnL / lossesCount : 0;
  const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 99 : 0;
  const unrealizedPnL = openTrades.reduce((sum, t) => sum + (Number(t.unrealized || 0)), 0);

  return {
    totalTrades,
    closedTradesCount: closedTrades.length,
    openPositions: openTrades.length,
    winsCount,
    lossesCount,
    winRatePct: Math.round(winRatePct * 10) / 10,
    totalPnL: Math.round(totalPnL * 100) / 100,
    unrealizedPnL: Math.round(unrealizedPnL * 100) / 100,
    avgWin: Math.round(avgWin),
    avgLoss: Math.round(avgLoss),
    winLossRatio: Math.round(winLossRatio * 100) / 100,
    hasEnoughData: totalTrades >= 3
  };
}

/**
 * Generate AI Loss & Strategy Diagnostic Report
 */
export async function generateAiTradeDiagnostic(trades = [], apiKey = '') {
  const metrics = calculateTradeDiagnostics(trades);

  // If Gemini API Key is provided, fetch dynamic response from Gemini model endpoint
  if (apiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are an elite hedge fund risk officer analyzing a trader's journal data:
Total Trades: ${metrics.totalTrades}
Win Rate: ${metrics.winRatePct}%
Total Realized P&L: ₹${metrics.totalPnL}
Average Win: ₹${metrics.avgWin}
Average Loss: ₹${metrics.avgLoss}
Reward-to-Risk Ratio: ${metrics.winLossRatio}

Analyze why this trader is losing or underperforming, and return JSON ONLY in this format:
{
  "headline": "Short punchy diagnostic verdict",
  "riskScore": number (1-100),
  "primaryLeak": "Explanation of primary performance leak",
  "leaks": ["Leak 1", "Leak 2", "Leak 3"],
  "actionableFixes": ["Fix 1", "Fix 2", "Fix 3"],
  "aiVerdict": "Comprehensive paragraph of advice"
}`
            }]
          }]
        })
      });

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (err) {
      console.warn('[aiService] Gemini API call error:', err.message);
    }
  }

  // Smart heuristic rule-based AI generator (instant offline fallback)
  return generateHeuristicDiagnostic(metrics);
}

/**
 * Smart Offline Rule-Based AI Generator
 */
function generateHeuristicDiagnostic(metrics) {
  const { winRatePct, winLossRatio, avgWin, avgLoss, totalPnL, totalTrades } = metrics;

  let headline = 'Balanced Execution';
  let riskScore = 78;
  let primaryLeak = 'Inconsistent position sizing across trades.';
  let leaks = [];
  let actionableFixes = [];
  let aiVerdict = '';

  if (totalTrades < 3) {
    return {
      headline: 'Need More Trade Data',
      riskScore: 50,
      primaryLeak: 'Logged trades dataset is too small to diagnose statistical biases.',
      leaks: ['Log at least 5-10 trades to unlock deep AI behavioral insights.'],
      actionableFixes: ['Log all your open & closed positions in the Journal tab.'],
      aiVerdict: 'AI Diagnostic requires a minimum of 3 to 5 trades to calculate win-loss expectancy, profit giveback, and risk-reward ratios accurately.'
    };
  }

  if (winLossRatio < 1.0) {
    headline = 'Asymmetric Risk Deficit (Losses Exceed Wins)';
    riskScore = 42;
    primaryLeak = `Your average loss (₹${avgLoss}) is larger than your average win (₹${avgWin}). You are cutting winners early while letting losses ride.`;
    leaks = [
      `Average loss (₹${avgLoss}) exceeds average win (₹${avgWin}).`,
      'Exiting winning trades pre-maturely out of anxiety.',
      'Holding losing positions past pre-defined Stop Loss levels.'
    ];
    actionableFixes = [
      'Set hard Stop Losses in your broker system before entering any trade.',
      'Use a 1:2 Minimum Risk-to-Reward ratio (target at least 2x your risk amount).',
      'Implement trailing stop losses to capture larger trend moves.'
    ];
    aiVerdict = `Statistical analysis indicates your main profitability bottleneck is not your win rate (${winRatePct}%), but your reward-to-risk asymmetry. By ensuring your average win is at least 1.5x to 2x your average loss, your overall P&L will shift positive rapidly.`;
  } else if (winRatePct < 45.0) {
    headline = 'Low Win Rate Expectancy';
    riskScore = 58;
    primaryLeak = `Win rate is currently ${winRatePct}%. Low-selectivity entries are reducing your overall edge.`;
    leaks = [
      'Over-trading on low probability consolidation setups.',
      'Entering positions without waiting for candle confirmation.'
    ];
    actionableFixes = [
      'Filter setups to focus only on high-conviction daily/weekly EMA trend alignment.',
      'Limit trading to maximum 2-3 quality setups per day.'
    ];
    aiVerdict = `Your risk-to-reward ratio is healthy (${winLossRatio}), but low entry selectivity (${winRatePct}% win rate) is creating unnecessary drawdown cycles. Raising your entry criteria will increase overall portfolio growth.`;
  } else {
    headline = 'Strong Execution & High Disciplined Strategy';
    riskScore = 88;
    primaryLeak = 'Minor profit giveback during late-stage market trends.';
    leaks = [
      'Slight profit giveback when trend reverses near key resistance.',
      'Unused capital capacity on high-conviction breakout setups.'
    ];
    actionableFixes = [
      'Implement tranche scaling (book 50% at 2R, let 50% trail with TSL).',
      'Increase allocation size on grade-A setups while keeping tight risk.'
    ];
    aiVerdict = `Excellent statistical performance! Your Win Rate is ${winRatePct}% and your Reward-to-Risk ratio is ${winLossRatio}. Maintain your position sizing discipline and focus on scale-up opportunities.`;
  }

  return {
    headline,
    riskScore,
    primaryLeak,
    leaks,
    actionableFixes,
    aiVerdict
  };
}
