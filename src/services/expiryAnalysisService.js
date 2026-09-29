/**
 * Indian F&O Weekly Expiry Analysis Service
 * 
 * Analyzes performance specifically tailored to Indian weekly derivative expiry days:
 * - FINNIFTY: Tuesday
 * - BANKNIFTY: Wednesday
 * - NIFTY 50: Thursday
 * - SENSEX: Friday
 * - MIDCPNIFTY: Monday
 */

export const EXPIRY_SCHEDULE = {
  1: { name: 'Midcap Nifty Expiry', index: 'MIDCPNIFTY', dayName: 'Monday' },
  2: { name: 'FinNifty Expiry', index: 'FINNIFTY', dayName: 'Tuesday' },
  3: { name: 'Bank Nifty Expiry', index: 'BANKNIFTY', dayName: 'Wednesday' },
  4: { name: 'Nifty 50 Expiry', index: 'NIFTY', dayName: 'Thursday' },
  5: { name: 'Sensex Expiry', index: 'SENSEX', dayName: 'Friday' }
};

/**
 * Categorize trade by whether it fell on an Indian weekly expiry day
 */
export function getExpiryDayInfo(tradeDateStr = '') {
  if (!tradeDateStr) return null;
  const parts = tradeDateStr.split('-');
  if (parts.length !== 3) return null;

  // DD-MM-YYYY
  const dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  if (isNaN(dateObj.getTime())) return null;

  const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon ... 5 = Fri, 6 = Sat
  const expiry = EXPIRY_SCHEDULE[dayOfWeek];

  return {
    dayOfWeek,
    isExpiryDay: !!expiry,
    expiryName: expiry ? expiry.name : null,
    expiryIndex: expiry ? expiry.index : null,
    dayName: expiry ? expiry.dayName : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]
  };
}

/**
 * Calculate comprehensive Expiry vs Non-Expiry Statistics
 */
export function calculateExpiryAnalytics(trades = []) {
  const closedTrades = trades.filter(t => t.status === 'Closed' && t.date);

  const expiryTrades = [];
  const nonExpiryTrades = [];

  const dayStats = {
    Monday: { count: 0, wins: 0, pnl: 0, index: 'MIDCPNIFTY', name: 'Midcap Expiry' },
    Tuesday: { count: 0, wins: 0, pnl: 0, index: 'FINNIFTY', name: 'FinNifty Expiry' },
    Wednesday: { count: 0, wins: 0, pnl: 0, index: 'BANKNIFTY', name: 'Bank Nifty Expiry' },
    Thursday: { count: 0, wins: 0, pnl: 0, index: 'NIFTY', name: 'Nifty 50 Expiry' },
    Friday: { count: 0, wins: 0, pnl: 0, index: 'SENSEX', name: 'Sensex Expiry' }
  };

  closedTrades.forEach(t => {
    const pnl = Number(t.pnl || t.realizedPnL || 0);
    const info = getExpiryDayInfo(t.date);
    if (!info) return;

    if (info.isExpiryDay) {
      expiryTrades.push(t);
      if (dayStats[info.dayName]) {
        dayStats[info.dayName].count++;
        if (pnl > 0) dayStats[info.dayName].wins++;
        dayStats[info.dayName].pnl += pnl;
      }
    } else {
      nonExpiryTrades.push(t);
    }
  });

  // Expiry Calculations
  const expWins = expiryTrades.filter(t => (t.pnl || 0) > 0);
  const expLosses = expiryTrades.filter(t => (t.pnl || 0) <= 0);
  const expTotalPnL = expiryTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const expWinRate = expiryTrades.length > 0 ? (expWins.length / expiryTrades.length) * 100 : 0;
  const expAvgWin = expWins.length > 0 ? expWins.reduce((acc, t) => acc + (t.pnl || 0), 0) / expWins.length : 0;
  const expAvgLoss = expLosses.length > 0 ? Math.abs(expLosses.reduce((acc, t) => acc + (t.pnl || 0), 0)) / expLosses.length : 0;

  // Non-Expiry Calculations
  const nonExpWins = nonExpiryTrades.filter(t => (t.pnl || 0) > 0);
  const nonExpLosses = nonExpiryTrades.filter(t => (t.pnl || 0) <= 0);
  const nonExpTotalPnL = nonExpiryTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const nonExpWinRate = nonExpiryTrades.length > 0 ? (nonExpWins.length / nonExpiryTrades.length) * 100 : 0;

  // Time-of-day Theta crash analysis (Trades exited after 2:30 PM)
  const lateExpiryTrades = expiryTrades.filter(t => {
    if (!t.exitTime) return false;
    const hour = parseInt(t.exitTime.split(':')[0], 10);
    const minute = parseInt(t.exitTime.split(':')[1] || '0', 10);
    return hour > 14 || (hour === 14 && minute >= 30);
  });
  const lateExpiryPnL = lateExpiryTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);

  // Key actionable insight
  let primaryInsight = 'Keep trading your plan with disciplined position sizing.';
  if (expTotalPnL < 0 && nonExpTotalPnL > 0) {
    primaryInsight = `You are profitable on standard market days (+₹${Math.round(nonExpTotalPnL).toLocaleString('en-IN')}) but giving back profits on Expiry Days (-₹${Math.round(Math.abs(expTotalPnL)).toLocaleString('en-IN')}). Reducing expiry lot size by 50% can instantly turn your overall curve sharply green!`;
  } else if (lateExpiryPnL < 0) {
    primaryInsight = `Trading past 2:30 PM on expiry days has cost you -₹${Math.round(Math.abs(lateExpiryPnL)).toLocaleString('en-IN')}. Avoid the last 60 minutes gamma swings to lock in morning profits.`;
  }

  return {
    totalTrades: closedTrades.length,
    expiryTradesCount: expiryTrades.length,
    nonExpiryTradesCount: nonExpiryTrades.length,
    expiryWinRate: Math.round(expWinRate * 10) / 10,
    nonExpiryWinRate: Math.round(nonExpWinRate * 10) / 10,
    expiryTotalPnL: Math.round(expTotalPnL),
    nonExpiryTotalPnL: Math.round(nonExpTotalPnL),
    expiryAvgWin: Math.round(expAvgWin),
    expiryAvgLoss: Math.round(expAvgLoss),
    dayStats,
    lateExpiryTradesCount: lateExpiryTrades.length,
    lateExpiryPnL: Math.round(lateExpiryPnL),
    primaryInsight
  };
}
